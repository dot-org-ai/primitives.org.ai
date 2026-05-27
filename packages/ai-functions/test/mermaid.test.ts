/**
 * Tests for the `mermaid()` state-machine authoring primitive (ADR-0011, aip-u9ex).
 *
 * Two test surfaces:
 *  - Offline retry path (deterministic, NO live model): inject a fake generator
 *    whose first response is invalid mermaid and whose second is valid. Asserts
 *    the primitive retries, feeds the parse error back into the prompt, and
 *    returns the valid result. This is the important test — it runs without
 *    network.
 *  - Live integration (LLM-dependent, skipped without an API key per repo
 *    convention): `mermaid(prompt)` returns a string that `fromMermaid` parses
 *    into a runnable config.
 */

import { describe, it, expect, vi } from 'vitest'
import { mermaid, type MermaidGenerateFn } from '../src/index.js'
import { fromMermaid } from 'ai-workflows'

// Skip live tests if no gateway / API key configured (matches define.test.ts).
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

const VALID_DIAGRAM = `stateDiagram-v2
  [*] --> idle
  idle --> running : START
  running --> idle : STOP
  running --> [*]`

// A fork pseudostate — unsupported by the parser (fork/join still throw a
// MermaidParseError even with full composite/parallel/history coverage), so it
// reliably forces the retry path. (Composite states are now valid, so they no
// longer serve as "invalid" input.)
const INVALID_DIAGRAM = `stateDiagram-v2
  state f <<fork>>
  [*] --> f
  f --> s1
  f --> s2`

// A diagram that PARSES cleanly via fromMermaid but is REJECTED by
// createMachine: a cross-boundary history target `Work[H]` whose composite never
// declares a `[H]` child, so the emitted `Work.hist` target points at a
// non-existent child → createMachine throws "Child state 'hist' does not exist".
// This is the validator gap mermaid() must close: parse-only validation would
// return this unrunnable diagram. (aip-8nc5 SHOULD-FIX #3.)
const PARSES_BUT_NOT_RUNNABLE = `stateDiagram-v2
  [*] --> Work
  state Work {
    [*] --> a
    a --> b : NEXT
  }
  Work --> Paused : PAUSE
  Paused --> Work[H] : RESUME`

describe('mermaid() — offline retry path (no live model)', () => {
  it('retries on parse failure, feeds the error back, and returns the valid result', async () => {
    // First call returns invalid mermaid; second call returns valid.
    const generate = vi
      .fn<Parameters<MermaidGenerateFn>, ReturnType<MermaidGenerateFn>>()
      .mockResolvedValueOnce(INVALID_DIAGRAM)
      .mockResolvedValueOnce(VALID_DIAGRAM)

    const result = await mermaid('a process that can be idle or running', { generate })

    // Returned source is the valid one and it parses into a runnable config.
    expect(result).toBe(VALID_DIAGRAM)
    const config = fromMermaid(result)
    expect(config.initial).toBe('idle')

    // It made exactly two attempts (one retry).
    expect(generate).toHaveBeenCalledTimes(2)

    // The retry's prompt fed the parse error back to the model.
    const firstCall = generate.mock.calls[0]![0]
    const retryCall = generate.mock.calls[1]![0]
    expect(firstCall.attempt).toBe(0)
    expect(retryCall.attempt).toBe(1)
    expect(retryCall.prompt).toContain('failed to parse')
    expect(retryCall.prompt).toContain('fork') // the specific parser error
    // The original prompt is preserved across the retry.
    expect(retryCall.prompt).toContain('a process that can be idle or running')
  })

  it('retries when a diagram parses but createMachine rejects it (runnable-validation gap)', async () => {
    // First response parses cleanly via fromMermaid but createMachine rejects it
    // (cross-boundary `Work[H]` with no `[H]` child). mermaid() must catch the
    // createMachine throw, feed it back, and retry — returning the runnable one.
    const generate = vi
      .fn<Parameters<MermaidGenerateFn>, ReturnType<MermaidGenerateFn>>()
      .mockResolvedValueOnce(PARSES_BUT_NOT_RUNNABLE)
      .mockResolvedValueOnce(VALID_DIAGRAM)

    const result = await mermaid('a resumable work process', { generate })

    // Sanity: the first candidate genuinely parses (so this exercises the
    // createMachine gate, not the parser) yet is not runnable.
    expect(() => fromMermaid(PARSES_BUT_NOT_RUNNABLE)).not.toThrow()

    // The primitive retried past the unrunnable candidate to the valid one.
    expect(result).toBe(VALID_DIAGRAM)
    expect(generate).toHaveBeenCalledTimes(2)

    // The retry fed the createMachine rejection back to the model.
    const retryCall = generate.mock.calls[1]![0]
    expect(retryCall.attempt).toBe(1)
    expect(retryCall.prompt).toMatch(/does not exist|Child state/i)
  })

  it('returns immediately when the first generation is valid (no retry)', async () => {
    const generate = vi.fn(async () => VALID_DIAGRAM)

    const result = await mermaid('idle/running process', { generate })

    expect(result).toBe(VALID_DIAGRAM)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('strips a markdown code fence the model may have added', async () => {
    const fenced = '```mermaid\n' + VALID_DIAGRAM + '\n```'
    const generate = vi.fn(async () => fenced)

    const result = await mermaid('idle/running process', { generate })

    expect(result).toBe(VALID_DIAGRAM)
    expect(() => fromMermaid(result)).not.toThrow()
  })

  it('throws the final parse error after exhausting retries', async () => {
    const generate = vi.fn(async () => INVALID_DIAGRAM)

    await expect(mermaid('always invalid', { maxRetries: 2, generate })).rejects.toThrow(/fork/)
    // maxRetries: 2 → 3 total attempts.
    expect(generate).toHaveBeenCalledTimes(3)
  })

  it('respects a custom maxRetries (0 → single attempt, no retry)', async () => {
    const generate = vi.fn(async () => INVALID_DIAGRAM)

    await expect(mermaid('one shot', { maxRetries: 0, generate })).rejects.toThrow()
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('passes model / system / temperature through to the generator', async () => {
    const generate = vi.fn(async () => VALID_DIAGRAM)

    await mermaid('idle/running', {
      generate,
      model: 'opus',
      system: 'custom system prompt',
      temperature: 0.3,
    })

    const params = generate.mock.calls[0]![0]
    expect(params.model).toBe('opus')
    expect(params.system).toBe('custom system prompt')
    expect(params.temperature).toBe(0.3)
  })
})

describe.skipIf(!hasGateway)('mermaid() — live integration (LLM-dependent)', () => {
  it('returns a string that fromMermaid parses into a runnable config', async () => {
    const source = await mermaid(
      'a traffic light state machine with red, green, and yellow states that ' +
        'advance on a TIMER event'
    )

    expect(typeof source).toBe('string')
    expect(source.length).toBeGreaterThan(0)

    // The returned source is guaranteed to parse into a runnable MachineConfig.
    const config = fromMermaid(source)
    expect(config.states).toBeDefined()
    expect(Object.keys(config.states ?? {}).length).toBeGreaterThan(0)
  }, 60000)
})
