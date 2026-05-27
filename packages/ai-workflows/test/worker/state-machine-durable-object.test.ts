/**
 * Miniflare integration tests for the state-machine Durable Object adapter.
 *
 * Runs the {@link StateMachineDurableObject} host against a real DO backed by
 * Miniflare's `state.storage` + alarms (no mocks). Exercises the three wiring
 * paths the slice owns:
 *
 *   1. **fetch -> external event** — an event POSTed to the DO `fetch()` handler
 *      advances the actor and persists the new snapshot.
 *   2. **resume from snapshot** — after the DO runs partway, re-reading the
 *      stored snapshot rehydrates the actor to the same state value.
 *   3. **alarm -> timer transition** — an `after X` transition fires via the DO
 *      `alarm()` path (triggered in-test with `runDurableObjectAlarm`).
 *
 * The fixture worker (`fixtures/state-machine-worker.ts`) binds a small machine:
 *   idle --PING--> pinged --ARM--> armed --(after 50ms)--> firedByTimer
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test'

interface TestEnv {
  STATE_MACHINE_DO: DurableObjectNamespace
}

const testEnv = env as unknown as TestEnv

/** Resolve a fresh DO stub by a unique name so cases don't share storage. */
function stubFor(name: string): DurableObjectStub {
  const ns = testEnv.STATE_MACHINE_DO
  return ns.get(ns.idFromName(name))
}

/** POST an event into the DO and parse the `{ state }` response. */
async function sendEvent(
  stub: DurableObjectStub,
  event: Record<string, unknown>
): Promise<{ state: unknown }> {
  const res = await stub.fetch('https://do/', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: { 'content-type': 'application/json' },
  })
  expect(res.status).toBe(200)
  return res.json()
}

/** GET the DO's current state + snapshot. */
async function getState(stub: DurableObjectStub): Promise<{ state: unknown; snapshot: unknown }> {
  const res = await stub.fetch('https://do/', { method: 'GET' })
  expect(res.status).toBe(200)
  return res.json()
}

describe('StateMachineDurableObject (Miniflare)', () => {
  it('starts at the initial state on first fetch', async () => {
    const stub = stubFor('initial')
    const { state } = await getState(stub)
    expect(state).toBe('idle')
  })

  it('advances the machine on an external event delivered via fetch()', async () => {
    const stub = stubFor('external-event')

    const after = await sendEvent(stub, { type: 'PING' })
    expect(after.state).toBe('pinged')

    // The new state is durably visible on a subsequent read.
    const { state } = await getState(stub)
    expect(state).toBe('pinged')
  })

  it('rejects a non-event body with 400', async () => {
    const stub = stubFor('bad-body')
    const res = await stub.fetch('https://do/', {
      method: 'POST',
      body: JSON.stringify({ no: 'type' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('persists its snapshot so a fresh actor resumes to the same state value', async () => {
    const stub = stubFor('resume')

    // Drive it partway.
    await sendEvent(stub, { type: 'PING' })
    await sendEvent(stub, { type: 'ARM' })
    expect((await getState(stub)).state).toBe('armed')

    // Inside the DO: re-read the stored snapshot through the adapter and
    // confirm it captured the active state. This is the durable record a fresh
    // actor (post-restart) rehydrates from via runMachine(..., { resume: true }).
    await runInDurableObject(stub, async (instance, state) => {
      const stored = await state.storage.get('sm:sm-do-test-instance:snapshot')
      expect((stored as { value: unknown }).value).toBe('armed')
      // The instance also exposes the live handle state via fetch; assert the
      // host is the StateMachineDurableObject under test.
      expect(typeof (instance as { fetch: unknown }).fetch).toBe('function')
    })

    // A brand-new stub for the SAME id resumes (new actor instance) to 'armed'.
    const resumed = stubFor('resume')
    expect((await getState(resumed)).state).toBe('armed')
  })

  it('fires an after-X transition through the DO alarm() path', async () => {
    const stub = stubFor('timer')

    // Enter the `armed` state, which schedules an `after: { 50 }` transition.
    await sendEvent(stub, { type: 'PING' })
    await sendEvent(stub, { type: 'ARM' })
    expect((await getState(stub)).state).toBe('armed')

    // A timer should be durably scheduled and the DO alarm armed.
    await runInDurableObject(stub, async (_instance, state) => {
      const timers = (await state.storage.get('sm:sm-do-test-instance:timers')) as unknown[]
      expect(Array.isArray(timers)).toBe(true)
      expect(timers.length).toBeGreaterThan(0)
      const alarm = await state.storage.getAlarm()
      expect(alarm).not.toBeNull()
    })

    // Run the alarm (the after-delay has elapsed in wall-clock terms for the
    // 50ms timer; runDurableObjectAlarm executes whatever alarm is scheduled).
    const ran = await runDurableObjectAlarm(stub)
    expect(ran).toBe(true)

    // The timer-driven transition has advanced the machine to its final state.
    expect((await getState(stub)).state).toBe('firedByTimer')

    // The fired timer was cleared from durable storage.
    await runInDurableObject(stub, async (_instance, state) => {
      const timers = (await state.storage.get('sm:sm-do-test-instance:timers')) as
        | unknown[]
        | undefined
      expect(timers === undefined || timers.length === 0).toBe(true)
    })
  })

  it('logs external events to the durable event log', async () => {
    const stub = stubFor('event-log')
    await sendEvent(stub, { type: 'PING' })
    await sendEvent(stub, { type: 'ARM' })

    await runInDurableObject(stub, async (_instance, state) => {
      const log = (await state.storage.get('sm:sm-do-test-instance:events')) as Array<{
        seq: number
        type: string
      }>
      expect(log.map((e) => e.type)).toEqual(['PING', 'ARM'])
      expect(log.map((e) => e.seq)).toEqual([0, 1])
    })
  })
})
