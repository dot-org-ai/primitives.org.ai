/**
 * Deprecation notice tests for the `human-in-the-loop` Verb re-exports.
 *
 * The PRD (aip-qozi) Phase 1 keeps the existing Verb exports but logs a
 * one-time deprecation notice on first call so that callers migrate to
 * `digital-workers` (dispatching via `personAsWorker(person)`). This test
 * pins the contract:
 *   - the notice fires on first call
 *   - the notice does NOT fire on subsequent calls in the same process
 *   - the notice references the canonical `digital-workers` import path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { approve, ask, notify, __resetDeprecationNotices } from '../src/helpers.js'

describe('human-in-the-loop helpers — deprecation notices (PRD aip-qozi)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    __resetDeprecationNotices()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('logs the ask deprecation notice exactly once per process', async () => {
    // The Human lifecycle requires an assignee + waits for a response, so we
    // can't await ask() to completion in a unit test. The notice fires at
    // the top of the call — wrap in Promise.race so the test stays fast.
    const calls = [
      ask({
        title: 't1',
        question: 'q1',
        assignee: 'alice',
        timeout: 1, // resolved quickly via lifecycle, but we don't await
      }).catch(() => {}),
      ask({
        title: 't2',
        question: 'q2',
        assignee: 'alice',
        timeout: 1,
      }).catch(() => {}),
      ask({
        title: 't3',
        question: 'q3',
        assignee: 'alice',
        timeout: 1,
      }).catch(() => {}),
    ]

    // We don't need the responses — just check that the deprecation warning
    // fired exactly once across all calls.
    await Promise.race([
      Promise.allSettled(calls),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ])

    const deprecationCalls = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('human-in-the-loop')
    )
    expect(deprecationCalls).toHaveLength(1)
  })

  it('points ask callers at digital-workers + personAsWorker', async () => {
    void ask({ title: 't', question: 'q', assignee: 'alice', timeout: 1 }).catch(() => {})

    const deprecationCall = warnSpy.mock.calls.find((call) =>
      String(call[0]).includes('human-in-the-loop')
    )
    expect(deprecationCall).toBeDefined()
    expect(String(deprecationCall![0])).toContain('digital-workers')
    expect(String(deprecationCall![0])).toContain('personAsWorker')
    expect(String(deprecationCall![0])).toContain('DEPRECATED')
  })

  it('tracks deprecation per-export (ask fires independently of notify)', async () => {
    void ask({ title: 't', question: 'q', assignee: 'alice', timeout: 1 }).catch(() => {})
    await notify({
      type: 'info',
      title: 'n',
      message: 'm',
      recipient: 'alice',
    }).catch(() => {})

    const askCall = warnSpy.mock.calls.find((c) => String(c[0]).includes('`ask` is now dispatched'))
    const notifyCall = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('`notify` is now dispatched')
    )
    expect(askCall).toBeDefined()
    expect(notifyCall).toBeDefined()
  })

  // ==========================================================================
  // PRD aip-9l4r — approve + notify channel-routed Verb deprecation notices
  // ==========================================================================

  it('logs the approve deprecation notice exactly once per process', async () => {
    // The Human lifecycle on approve also requires an assignee + waits for a
    // response, so race with a short timeout to keep the test fast.
    const calls = [
      approve({
        title: 't1',
        description: 'd1',
        subject: 's1',
        input: { v: 1 },
        assignee: 'alice',
        timeout: 1,
      }).catch(() => {}),
      approve({
        title: 't2',
        description: 'd2',
        subject: 's2',
        input: { v: 2 },
        assignee: 'alice',
        timeout: 1,
      }).catch(() => {}),
    ]

    await Promise.race([
      Promise.allSettled(calls),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ])

    const deprecationCalls = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('`approve` is now dispatched')
    )
    expect(deprecationCalls).toHaveLength(1)
  })

  it('points approve callers at digital-workers + personAsWorker', async () => {
    void approve({
      title: 't',
      description: 'd',
      subject: 's',
      input: {},
      assignee: 'alice',
      timeout: 1,
    }).catch(() => {})

    const call = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('`approve` is now dispatched')
    )
    expect(call).toBeDefined()
    expect(String(call![0])).toContain('digital-workers')
    expect(String(call![0])).toContain('personAsWorker')
    expect(String(call![0])).toContain('DEPRECATED')
  })

  it('logs the notify deprecation notice exactly once per process', async () => {
    await notify({ type: 'info', title: 't', message: 'm', recipient: 'a' }).catch(() => {})
    await notify({ type: 'info', title: 't', message: 'm', recipient: 'a' }).catch(() => {})

    const deprecationCalls = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('`notify` is now dispatched')
    )
    expect(deprecationCalls).toHaveLength(1)
  })
})
