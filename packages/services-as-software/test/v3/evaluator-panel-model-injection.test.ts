/**
 * Cluster-5 follow-up — EvaluatorPanel model-injection point.
 *
 * The Phase B harness needs the panel's LLM calls to flow through a
 * `wrapForV3(model, { cache, budget, trace })`-wrapped LanguageModelV3 so
 * cache/budget/trace observability hooks bind to the panel's own
 * `generateObject` invocations rather than relying on process-wide env-gated
 * middleware.
 *
 * These tests pin the resolution-order contract:
 *
 *   per-persona modelHint  >  per-call override  >  panel-level default  >
 *   string-name fallback
 *
 * Tests use a hand-rolled `LanguageModelV3` stub that records every
 * `doGenerate` invocation and returns a verdict-shaped JSON payload so
 * `Output.object` parsing succeeds end-to-end.
 */

import { describe, it, expect } from 'vitest'
import type { LanguageModelV3 } from 'ai-functions'

import { EvaluatorPanel, type AgenticPersona } from '../../src/v3/evaluator-panel.js'
import { Personas } from '../../src/v3/personas.js'

// ============================================================================
// Stub LanguageModelV3 — records calls, returns a verdict-shaped JSON payload.
// ============================================================================

interface RecordingV3Stub extends LanguageModelV3 {
  /** Recorded `doGenerate` invocations (one entry per call). */
  calls: Array<{ promptText: string }>
}

/**
 * Build a `LanguageModelV3` whose `doGenerate` records the prompt and returns
 * a `{ verdict, rationale }` JSON payload that `Output.object` can parse.
 *
 * Each stub carries a unique `modelId` / `provider` pair so tests can assert
 * which stub a panel call routed to.
 */
function makeRecordingStub(opts: {
  provider: string
  modelId: string
  verdict?: 'approve' | 'reject'
  rationale?: string
}): RecordingV3Stub {
  const calls: Array<{ promptText: string }> = []
  const verdict = opts.verdict ?? 'approve'
  const rationale = opts.rationale ?? `${opts.modelId} stub response`
  const stub: LanguageModelV3 = {
    specificationVersion: 'v3',
    provider: opts.provider,
    modelId: opts.modelId,
    supportedUrls: {},
    async doGenerate(options) {
      // Flatten the prompt into a single text blob for assertion convenience.
      const promptText = JSON.stringify(options.prompt)
      calls.push({ promptText })
      const json = JSON.stringify({ verdict, rationale })
      return {
        content: [{ type: 'text', text: json }],
        finishReason: 'stop' as const,
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }
    },
    async doStream() {
      throw new Error('doStream not used in EvaluatorPanel tests')
    },
  }
  return Object.assign(stub, { calls })
}

// ============================================================================
// Personas — minimal advisory personas so panel run doesn't hard-block.
// ============================================================================

function makePersona(name: string, extraConfig: Record<string, unknown> = {}): AgenticPersona {
  return {
    name,
    persona: `You are reviewer ${name}.`,
    signOff: 'advisory',
    config: { archetype: 'pedantic', domain: 'test', ...extraConfig },
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('EvaluatorPanel — panel-level model injection', () => {
  it('uses the panel-level model for all internal LLM calls when supplied', async () => {
    const stub = makeRecordingStub({ provider: 'test', modelId: 'panel-default' })
    const panel = EvaluatorPanel.define({
      $id: 'panel:model-injection-default',
      personas: [makePersona('p1'), makePersona('p2')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: stub,
    })

    const verdict = await panel.run({ artifact: 'hello' })

    expect(stub.calls.length).toBe(2) // one call per persona
    expect(verdict.verdict).toBe('all-approved')
    expect(verdict.approvals).toHaveLength(2)
  })

  it('per-call override on `panel.run` wins over the panel-level default', async () => {
    const panelDefault = makeRecordingStub({ provider: 'test', modelId: 'panel-default' })
    const callOverride = makeRecordingStub({ provider: 'test', modelId: 'call-override' })
    const panel = EvaluatorPanel.define({
      $id: 'panel:model-injection-override',
      personas: [makePersona('p1'), makePersona('p2')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: panelDefault,
    })

    await panel.run({ artifact: 'hello' }, { model: callOverride })

    expect(callOverride.calls.length).toBe(2)
    expect(panelDefault.calls.length).toBe(0)
  })

  it('falls back to string-name resolution when no model is provided at either layer', async () => {
    // No `model` on define and no `model` on run() — the panel must NOT throw
    // in a way that requires a real model object. Round-7's existing path
    // routes to ai-providers via the string `'sonnet'` resolver.
    //
    // We can't actually exercise the network here, so we assert structural
    // behaviour: defining a panel WITHOUT `model` produces a panel whose
    // `model` is undefined, preserving the legacy resolution path. The
    // generative call itself is not exercised.
    const panel = EvaluatorPanel.define({
      $id: 'panel:model-injection-fallback',
      personas: [makePersona('p1')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
    })
    // Panel surface stays compatible — no `model` property is required.
    expect(panel.$id).toBe('panel:model-injection-fallback')
    expect(panel.personas).toHaveLength(1)
    // Resolved model surface is undefined when no injection happened.
    expect((panel as { model?: unknown }).model).toBeUndefined()
  })

  it('per-persona modelHint (when present) overrides the panel-level model for that persona', async () => {
    const panelDefault = makeRecordingStub({ provider: 'test', modelId: 'panel-default' })
    // Persona p1 carries a `modelHint`; persona p2 does not.
    const panel = EvaluatorPanel.define({
      $id: 'panel:model-injection-persona-hint',
      personas: [Personas.pedantic({ domain: 'p1', modelHint: 'opus' }), makePersona('p2')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: panelDefault,
    })

    await panel.run({ artifact: 'hello' })

    // p1 had a modelHint — it should NOT have routed to the injected stub.
    // p2 had no modelHint — it MUST have routed to the injected stub.
    expect(panelDefault.calls.length).toBe(1)
  })
})
