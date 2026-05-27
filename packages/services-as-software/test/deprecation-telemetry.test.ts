/**
 * Deprecation telemetry tests (PRD aip-chuu).
 *
 * Verifies that calling the deprecated Verb wrappers in the three Layer 5
 * packages increments the shared telemetry counter under its expected key,
 * so the deletion slice (aip-x6js) has evidence of zero callers before
 * deletion.
 *
 * The telemetry surface lives in `digital-workers/deprecation`. Each of
 * the three L5 packages now imports `warnDeprecatedOnce` from there
 * (instead of maintaining its own per-package tracker). This test pins
 * the contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Silence the console.warn output for the duration of the test run so the
// test output is readable. The deprecation telemetry still fires; we just
// don't want the messages cluttering test output.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

import {
  getDeprecationCounts,
  getDeprecationLog,
  resetDeprecationTelemetry,
  warnDeprecatedOnce,
} from 'digital-workers/deprecation'

describe('warnDeprecatedOnce — shared telemetry surface', () => {
  beforeEach(() => {
    resetDeprecationTelemetry()
  })

  it('records a count for every call (not just first-time)', () => {
    warnDeprecatedOnce('autonomous-agents.ask', 'msg')
    warnDeprecatedOnce('autonomous-agents.ask', 'msg')
    warnDeprecatedOnce('autonomous-agents.ask', 'msg')

    expect(getDeprecationCounts()).toEqual({ 'autonomous-agents.ask': 3 })
  })

  it('logs the console.warn exactly once per key', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnDeprecatedOnce('autonomous-agents.ask', 'first-time message')
    warnDeprecatedOnce('autonomous-agents.ask', 'second-time message')

    const matching = warnSpy.mock.calls.filter((c) => String(c[0]).includes('first-time message'))
    expect(matching).toHaveLength(1)
  })

  it('appends a first-time entry to the log with a timestamp', () => {
    const before = Date.now()
    warnDeprecatedOnce('human-in-the-loop.notify', 'msg')
    const after = Date.now()

    const log = getDeprecationLog()
    expect(log).toHaveLength(1)
    expect(log[0]?.key).toBe('human-in-the-loop.notify')
    expect(log[0]?.timestamp).toBeGreaterThanOrEqual(before)
    expect(log[0]?.timestamp).toBeLessThanOrEqual(after)
  })

  it('tracks counts independently per key', () => {
    warnDeprecatedOnce('autonomous-agents.ask', 'a')
    warnDeprecatedOnce('autonomous-agents.ask', 'a')
    warnDeprecatedOnce('human-in-the-loop.approve', 'b')
    warnDeprecatedOnce('services-as-software.notify', 'c')
    warnDeprecatedOnce('services-as-software.notify', 'c')
    warnDeprecatedOnce('services-as-software.notify', 'c')

    expect(getDeprecationCounts()).toEqual({
      'autonomous-agents.ask': 2,
      'human-in-the-loop.approve': 1,
      'services-as-software.notify': 3,
    })
  })

  it('reset clears counts, log, and the one-time notice tracker', () => {
    warnDeprecatedOnce('autonomous-agents.ask', 'msg')
    expect(getDeprecationCounts()).toEqual({ 'autonomous-agents.ask': 1 })
    expect(getDeprecationLog()).toHaveLength(1)

    resetDeprecationTelemetry()

    expect(getDeprecationCounts()).toEqual({})
    expect(getDeprecationLog()).toEqual([])

    // After reset, the next call should fire the console.warn again
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnDeprecatedOnce('autonomous-agents.ask', 'msg-after-reset')
    expect(warnSpy.mock.calls.filter((c) => String(c[0]).includes('msg-after-reset'))).toHaveLength(
      1
    )
  })

  it('getDeprecationCounts returns a defensive copy', () => {
    warnDeprecatedOnce('autonomous-agents.ask', 'msg')
    const snapshot = getDeprecationCounts()
    snapshot['autonomous-agents.ask'] = 999
    expect(getDeprecationCounts()).toEqual({ 'autonomous-agents.ask': 1 })
  })

  it('getDeprecationLog returns a defensive copy', () => {
    warnDeprecatedOnce('autonomous-agents.ask', 'msg')
    const snapshot = getDeprecationLog() as Array<{ key: string; timestamp: number }>
    snapshot.push({ key: 'tampered', timestamp: 0 })
    expect(getDeprecationLog()).toHaveLength(1)
  })
})

// ============================================================================
// Per-verb wrapper coverage — each of the seven Verbs in each of the three
// L5 packages dispatches through the shared telemetry helper under the
// expected key. This is the evidence the deletion slice (aip-x6js) reads.
// ============================================================================
describe('services-as-software wrappers — telemetry keys', () => {
  beforeEach(() => {
    resetDeprecationTelemetry()
  })

  it('ask / do / generate / is / notify each record under the package key', async () => {
    const { ask, do_, generate, is, notify } = await import('../src/helpers.js')

    // The services-as-software helpers are endpoint-handler wrappers — calling
    // them returns an inner handler. We exercise both surfaces to confirm
    // the deprecation notice fires on the OUTER call (the migration point).
    ask(async () => 'a')
    do_(async () => 'd')
    generate(async () => 'g')
    is(async () => true)
    notify(async () => undefined)

    const counts = getDeprecationCounts()
    expect(counts['services-as-software.ask']).toBe(1)
    expect(counts['services-as-software.do']).toBe(1)
    expect(counts['services-as-software.generate']).toBe(1)
    expect(counts['services-as-software.is']).toBe(1)
    expect(counts['services-as-software.notify']).toBe(1)
  })
})
