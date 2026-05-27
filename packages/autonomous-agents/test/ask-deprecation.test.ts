/**
 * Deprecation notice tests for the `autonomous-agents` Verb re-exports.
 *
 * The PRD (aip-qozi) Phase 1 keeps the existing Verb exports but logs a
 * one-time deprecation notice on first call so that callers migrate to
 * `digital-workers`. This test pins the contract:
 *   - the notice fires on first call
 *   - the notice does NOT fire on subsequent calls in the same process
 *   - the notice references the canonical `digital-workers` import path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { answer: 'mocked', reasoning: 'mocked' },
  }),
}))

import { ask, approve, notify, __resetDeprecationNotices } from '../src/actions.js'

describe('autonomous-agents.ask — deprecation notice (PRD aip-qozi)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDeprecationNotices()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('logs the deprecation notice exactly once per process', async () => {
    await ask('Question 1')
    await ask('Question 2')
    await ask('Question 3')

    const askDeprecations = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('`ask` is now dispatched')
    )
    expect(askDeprecations).toHaveLength(1)
  })

  it('points callers at digital-workers', async () => {
    await ask('Question')

    const call = warnSpy.mock.calls.find((c) => String(c[0]).includes('`ask` is now dispatched'))
    expect(call).toBeDefined()
    expect(String(call![0])).toContain('digital-workers')
    expect(String(call![0])).toContain('DEPRECATED')
  })
})

describe('autonomous-agents.approve / notify — deprecation notices (PRD aip-9l4r)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDeprecationNotices()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('logs the approve deprecation notice exactly once per process', async () => {
    await approve({ title: 't', description: 'd', data: {} })
    await approve({ title: 't', description: 'd', data: {} })

    const approveDeprecations = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('`approve` is now dispatched')
    )
    expect(approveDeprecations).toHaveLength(1)
  })

  it('points approve callers at digital-workers + agentAsWorker / approvePolicy', async () => {
    await approve({ title: 't', description: 'd', data: {} })

    const call = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('`approve` is now dispatched')
    )
    expect(call).toBeDefined()
    expect(String(call![0])).toContain('digital-workers')
    expect(String(call![0])).toContain('agentAsWorker')
    expect(String(call![0])).toContain('approvePolicy')
    expect(String(call![0])).toContain('DEPRECATED')
  })

  it('logs the notify deprecation notice exactly once per process', async () => {
    await notify({ message: 'm1' })
    await notify({ message: 'm2' })

    const notifyDeprecations = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('`notify` is now dispatched')
    )
    expect(notifyDeprecations).toHaveLength(1)
  })

  it('tracks deprecations per-export independently', async () => {
    await ask('q')
    await approve({ title: 't', description: 'd', data: {} })
    await notify({ message: 'm' })

    const ask1 = warnSpy.mock.calls.find((c) => String(c[0]).includes('`ask` is now dispatched'))
    const approve1 = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('`approve` is now dispatched')
    )
    const notify1 = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('`notify` is now dispatched')
    )
    expect(ask1).toBeDefined()
    expect(approve1).toBeDefined()
    expect(notify1).toBeDefined()
  })
})
