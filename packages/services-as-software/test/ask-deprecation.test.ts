/**
 * Deprecation notice tests for the `services-as-software` Verb helpers.
 *
 * The PRD (aip-qozi) Phase 1 keeps the existing pass-through Verb helpers but
 * logs a one-time deprecation notice on first call. Endpoint handlers that
 * need to invoke a Worker action should import from `digital-workers` and
 * dispatch through a Worker target (e.g. `agentAsWorker(agent)` or
 * `personAsWorker(person)`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ask, do_, generate, is, notify, __resetDeprecationNotices } from '../src/helpers.js'

describe('services-as-software helpers — deprecation notices (PRD aip-qozi)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDeprecationNotices()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('logs the ask deprecation notice exactly once per process', () => {
    ask(async () => 'answer')
    ask(async () => 'answer')
    ask(async () => 'answer')

    const askDeprecations = warnSpy.mock.calls.filter(
      (c) => String(c[0]).includes('services-as-software') && String(c[0]).includes('`ask`')
    )
    expect(askDeprecations).toHaveLength(1)
  })

  it('points ask callers at digital-workers', () => {
    ask(async () => 'answer')

    const call = warnSpy.mock.calls.find(
      (c) => String(c[0]).includes('services-as-software') && String(c[0]).includes('`ask`')
    )
    expect(call).toBeDefined()
    expect(String(call![0])).toContain('digital-workers')
    expect(String(call![0])).toContain('DEPRECATED')
  })

  it('tracks deprecation per-export (each verb fires once independently)', () => {
    ask(async () => 'a')
    do_(async () => ({}))
    generate(async () => ({}))
    is(async () => true)
    notify(async () => {})

    // One deprecation per Verb (5 total).
    const deprecationCalls = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('services-as-software')
    )
    expect(deprecationCalls).toHaveLength(5)

    // Each Verb's notice points at digital-workers.
    for (const call of deprecationCalls) {
      expect(String(call[0])).toContain('digital-workers')
    }
  })

  it('still returns a working pass-through wrapper after the deprecation notice', async () => {
    const handler = ask(async (question, _context, _ctx) => `Echo: ${question}`)
    const result = await handler({ question: 'hello' }, undefined)
    expect(result).toBe('Echo: hello')
  })
})
