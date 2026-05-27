/**
 * Integration tests for the Postgres state-machine storage adapter.
 *
 * Runs entirely OFFLINE against a fake {@link makeFakeStateMachineExecutor}
 * `PgExecutor` that interprets the SQL the adapter emits (the repo's
 * established offline-pg pattern — no live database, no PGLite). Covers the
 * three behaviours the PRD's pg-adapter slice promises beyond the shared
 * storage contract:
 *
 *   1. **Snapshot persist + resume** — a partway run's snapshot is written to a
 *      `state_machine_instances` row; {@link runStoredMachine} reads it back and
 *      resumes the actor at exactly that state.
 *   2. **Event-log append + replay** — events sent during a run append to
 *      `state_machine_events`; {@link replayMachine} re-applies the log against a
 *      fresh actor and reproduces the same final state.
 *   3. **Timer fires an `after` transition** — a state with an `after` delay
 *      schedules a row in `state_machine_timers`; the
 *      {@link createPostgresStateMachineScheduler} resolves it as due at a given
 *      `now` (deterministic, no wall-clock waiting) and delivering its event
 *      drives the transition.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMachine } from 'xstate'
import { runMachine } from '../src/state-machine/runtime.js'
import type { ActorClock } from '../src/state-machine/runtime.js'
import {
  createPostgresStateMachineStorage,
  createPostgresStateMachineScheduler,
  bootstrapStateMachineSchema,
  runStoredMachine,
  replayMachine,
} from '../src/state-machine/postgres-adapter.js'
import { FakeStateMachineStore, makeFakeStateMachineExecutor } from './helpers/fake-pg-executor.js'

// =============================================================================
// Fixtures
// =============================================================================

/** A flat traffic-light machine — `TIMER` advances green → yellow → red → green. */
function trafficLight() {
  return createMachine({
    id: 'light',
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: { on: { TIMER: 'red' } },
      red: { on: { TIMER: 'green' } },
    },
  })
}

/**
 * A machine with an `after` delayed transition: `idle` auto-advances to
 * `escalated` after 1000ms. Drives the timer-firing path.
 */
function escalationMachine() {
  return createMachine({
    id: 'escalation',
    initial: 'idle',
    states: {
      idle: { after: { 1000: 'escalated' } },
      escalated: { type: 'final' },
    },
  })
}

let store: FakeStateMachineStore

beforeEach(() => {
  store = new FakeStateMachineStore()
})

function freshStorage() {
  return createPostgresStateMachineStorage({ executor: makeFakeStateMachineExecutor(store) })
}

// =============================================================================
// Tests
// =============================================================================

describe('PostgresStateMachineStorage - kind + bootstrap', () => {
  it('reports the postgres kind and exposes its executor + table names', () => {
    const storage = freshStorage()
    expect(storage.kind).toBe('postgres')
    expect(storage.tables.instances).toBe('state_machine_instances')
    expect(storage.tables.events).toBe('state_machine_events')
    expect(storage.tables.timers).toBe('state_machine_timers')
  })

  it('bootstrapStateMachineSchema runs idempotently against the executor', async () => {
    const executor = makeFakeStateMachineExecutor(store)
    await expect(bootstrapStateMachineSchema(executor)).resolves.toBeUndefined()
    // Idempotent — running twice is harmless (the real DDL uses IF NOT EXISTS).
    await expect(bootstrapStateMachineSchema(executor)).resolves.toBeUndefined()
  })
})

describe('PostgresStateMachineStorage - snapshot persist + resume from a row', () => {
  it('persists the snapshot row on transitions and resumes the actor at that state', async () => {
    const storage = freshStorage()
    const machineId = 'tl-1'

    // Run partway: green -> yellow -> red.
    const first = await runMachine(trafficLight(), storage, { machineId })
    first.send('TIMER')
    first.send('TIMER')
    expect(first.getState()).toBe('red')
    first.stop()

    // A snapshot row exists for this machine.
    expect(store.instances.has(machineId)).toBe(true)

    // Resume from the stored row — the actor restarts at exactly 'red'.
    const resumed = await runStoredMachine(trafficLight(), storage, { machineId })
    expect(resumed.getState()).toBe('red')

    // And it keeps advancing from there: red -> green.
    resumed.send('TIMER')
    expect(resumed.getState()).toBe('green')
    resumed.stop()
  })

  it('runStoredMachine starts fresh when no snapshot row exists yet', async () => {
    const storage = freshStorage()
    const handle = await runStoredMachine(trafficLight(), storage, { machineId: 'tl-new' })
    expect(handle.getState()).toBe('green')
    handle.stop()
  })
})

describe('PostgresStateMachineStorage - event-log append + replay reproduces state', () => {
  it('appends sent events to the log and replay reconstructs the final state', async () => {
    const storage = freshStorage()
    const machineId = 'tl-replay'

    const handle = await runMachine(trafficLight(), storage, { machineId })
    handle.send('TIMER') // green -> yellow
    handle.send('TIMER') // yellow -> red
    expect(handle.getState()).toBe('red')
    handle.stop()

    // The log captured both events in arrival order with monotonic seq.
    const log = await storage.getEvents(machineId)
    expect(log.map((e) => e.type)).toEqual(['TIMER', 'TIMER'])
    expect(log.map((e) => e.seq)).toEqual([0, 1])

    // Replay against a fresh actor reproduces 'red' without touching the source.
    const replayed = await replayMachine(trafficLight(), storage, machineId)
    expect(replayed.getState()).toBe('red')
    replayed.stop()

    // Replay ran under a separate id — the source row is untouched.
    expect(store.instances.has(machineId)).toBe(true)
    expect(store.instances.has(`${machineId}:replay`)).toBe(false) // in-memory replay store by default
  })

  it('preserves full event payloads through the log for replay', async () => {
    const storage = freshStorage()
    const machineId = 'payload-fidelity'
    const handle = await runMachine(trafficLight(), storage, { machineId })
    handle.send({ type: 'TIMER', reason: 'sensor', meta: { lane: 3 } })
    handle.stop()

    const log = await storage.getEvents(machineId)
    expect(log[0]?.event).toEqual({ type: 'TIMER', reason: 'sensor', meta: { lane: 3 } })
  })
})

describe('PostgresStateMachineScheduler - a due timer fires an `after` transition', () => {
  /**
   * A deterministic clock: `setTimeout` records the delay callback against a
   * stable timer id (so a durable timer row is scheduled with `fireAt = base +
   * delay`); it never fires on its own. The test drives firing via the
   * scheduler's `pollDueTimers(now)` — no real wall-clock waiting.
   */
  function deterministicClock(base: number) {
    const callbacks = new Map<string, () => void>()
    let seq = 0
    const delays = new Map<string, number>()
    const clock: ActorClock = {
      setTimeout(fn, timeoutMs) {
        const id = `after:${++seq}`
        callbacks.set(id, () => fn())
        delays.set(id, timeoutMs)
        return id
      },
      clearTimeout(handle) {
        callbacks.delete(String(handle))
      },
    }
    return { clock, callbacks, delays, base }
  }

  it('schedules an after-transition timer, resolves it as due, and firing advances the state', async () => {
    const storage = freshStorage()
    const scheduler = createPostgresStateMachineScheduler(storage)
    const machineId = 'esc-1'
    const base = 10_000

    const { clock, callbacks, delays } = deterministicClock(base)
    const handle = await runMachine(escalationMachine(), storage, { machineId, clock })

    // The actor entered `idle` and armed its `after: { 1000 }` delay via our
    // clock. Mirror that into a durable timer row (this is the wiring a pg host
    // does: clock.setTimeout -> storage.scheduleTimer with fireAt = now + delay).
    expect(callbacks.size).toBe(1)
    const [timerId] = [...callbacks.keys()]
    const delayMs = delays.get(timerId!)!
    await storage.scheduleTimer(machineId, {
      id: timerId!,
      fireAt: base + delayMs,
      event: { type: `xstate.after.${timerId}` },
    })
    expect(handle.getState()).toBe('idle')

    // Not yet due at base — nothing fires.
    expect(await scheduler.pollDueTimers(base + 500)).toEqual([])

    // Due at base + 1000 — the scheduler resolves it (deterministically, no wait).
    const due = await scheduler.pollDueTimers(base + 1000)
    expect(due).toHaveLength(1)
    expect(due[0]?.machineId).toBe(machineId)
    expect(due[0]?.timer.id).toBe(timerId)

    // Firing the timer's recorded callback delivers the delay event into the
    // actor, which takes the `after` transition to `escalated`. Then the host
    // removes the timer row (at-least-once: removed only after delivery).
    callbacks.get(timerId!)!()
    await storage.cancelTimer(machineId, timerId!)

    expect(handle.getState()).toBe('escalated')
    expect(await storage.getTimers(machineId)).toEqual([])
    handle.stop()
  })

  it('pollDueTimers spans machines; pollDueTimersFor scopes to one', async () => {
    const storage = freshStorage()
    const scheduler = createPostgresStateMachineScheduler(storage)

    await storage.scheduleTimer('m1', { id: 'a', fireAt: 100, event: { type: 'A' } })
    await storage.scheduleTimer('m2', { id: 'b', fireAt: 200, event: { type: 'B' } })
    await storage.scheduleTimer('m1', { id: 'c', fireAt: 300, event: { type: 'C' } })

    // Cross-machine poll at now=200 returns the two due timers in fire_at order.
    const dueAll = await scheduler.pollDueTimers(200)
    expect(dueAll.map((d) => `${d.machineId}:${d.timer.id}`)).toEqual(['m1:a', 'm2:b'])

    // Scoped poll only returns m1's due timer.
    const dueM1 = await scheduler.pollDueTimersFor('m1', 200)
    expect(dueM1.map((d) => d.timer.id)).toEqual(['a'])

    // pollDueTimers is read-only — the timers remain until explicitly cancelled.
    expect(await storage.getTimers('m1')).toHaveLength(2)
  })
})
