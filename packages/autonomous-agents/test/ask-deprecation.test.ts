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

import { ask, __resetDeprecationNotices } from '../src/actions.js'

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

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('points callers at digital-workers', async () => {
    await ask('Question')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('digital-workers'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED'))
  })
})
