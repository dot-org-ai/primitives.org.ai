/**
 * State machine runtime tests (Slice 1 - the spine).
 *
 * Covers ADR-0011's spine: a hand-written xstate `MachineConfig` driven
 * through transitions via {@link runMachine}, snapshot persist + restore
 * round-trips through the {@link StateMachineStorage} port, and the in-memory
 * adapter's observable behaviour (snapshot read/write, event-log append, timer
 * schedule/cancel).
 *
 * Tests cross the runtime's natural seam — drive the actor with events, assert
 * on the resulting state value and the persisted snapshot. They do not mock
 * xstate internals or assert on intermediate shapes.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import type { MachineConfig } from 'xstate'
import { runMachine, createInMemoryStateMachineStorage, createStateMachine } from '../src/index.js'

// ============================================================================
// Test machines
// ============================================================================

/** A flat traffic-light machine: green -> yellow -> red -> green on TIMER. */
const trafficLight: MachineConfig<Record<string, never>, { type: 'TIMER' }> = {
  id: 'traffic-light',
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
    red: { on: { TIMER: 'green' } },
  },
}

/**
 * A parallel PR-review-ish machine with two orthogonal regions: a review
 * region (awaiting -> changesRequested -> approved) and a cancel-watch region
 * (watching -> cancelled). Proves the persisted snapshot captures the full
 * active-state configuration across regions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prReview: MachineConfig<any, any> = {
  id: 'pr-review',
  type: 'parallel',
  states: {
    review: {
      initial: 'awaiting',
      states: {
        awaiting: {
          on: { REQUEST_CHANGES: 'changesRequested', APPROVE: 'approved' },
        },
        changesRequested: { on: { APPROVE: 'approved' } },
        approved: { type: 'final' },
      },
    },
    cancelWatch: {
      initial: 'watching',
      states: {
        watching: { on: { CANCEL: 'cancelled' } },
        cancelled: { type: 'final' },
      },
    },
  },
}

// ============================================================================
// 1. Driving a hand-written MachineConfig through transitions
// ============================================================================

describe('runMachine - driving transitions', () => {
  it('starts a flat machine at its initial state', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(trafficLight, storage)

    expect(handle.getState()).toBe('green')
  })

  it('advances through transitions on sent events (string shorthand)', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(trafficLight, storage)

    handle.send('TIMER')
    expect(handle.getState()).toBe('yellow')

    handle.send('TIMER')
    expect(handle.getState()).toBe('red')

    handle.send('TIMER')
    expect(handle.getState()).toBe('green')
  })

  it('accepts full event objects', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(trafficLight, storage)

    handle.send({ type: 'TIMER' })
    expect(handle.getState()).toBe('yellow')
  })

  it('drives orthogonal regions of a parallel machine independently', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(prReview, storage)

    expect(handle.getState()).toEqual({
      review: 'awaiting',
      cancelWatch: 'watching',
    })

    handle.send('REQUEST_CHANGES')
    expect(handle.getState()).toEqual({
      review: 'changesRequested',
      cancelWatch: 'watching',
    })

    handle.send('APPROVE')
    expect(handle.getState()).toEqual({
      review: 'approved',
      cancelWatch: 'watching',
    })

    // The cancel-watch region is untouched by review events and still live.
    handle.send('CANCEL')
    expect(handle.getState()).toEqual({
      review: 'approved',
      cancelWatch: 'cancelled',
    })
  })

  it('accepts an already-created machine, not just a config', async () => {
    const storage = createInMemoryStateMachineStorage()
    const machine = createStateMachine(trafficLight)
    const handle = await runMachine(machine, storage)

    handle.send('TIMER')
    expect(handle.getState()).toBe('yellow')
  })
})

// ============================================================================
// 2. Snapshot persist + restore round-trips
// ============================================================================

describe('runMachine - snapshot persist + restore', () => {
  it('persists a snapshot on every transition', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(trafficLight, storage, { machineId: 'tl-1' })

    // Initial snapshot persisted on start.
    const initial = await storage.getSnapshot('tl-1')
    expect(initial).toBeDefined()
    expect((initial as { value: unknown }).value).toBe('green')

    handle.send('TIMER')
    const afterOne = await storage.getSnapshot('tl-1')
    expect((afterOne as { value: unknown }).value).toBe('yellow')
  })

  it('resumes a flat machine at the exact state it was left in', async () => {
    const storage = createInMemoryStateMachineStorage()

    // Run partway, then drop the handle.
    const first = await runMachine(trafficLight, storage, { machineId: 'tl-resume' })
    first.send('TIMER')
    first.send('TIMER')
    expect(first.getState()).toBe('red')
    first.stop()

    // Fresh actor resumed from the stored snapshot.
    const resumed = await runMachine(trafficLight, storage, {
      machineId: 'tl-resume',
      resume: true,
    })
    expect(resumed.getState()).toBe('red')

    // ...and it continues transitioning from there.
    resumed.send('TIMER')
    expect(resumed.getState()).toBe('green')
  })

  it('resumes a parallel machine with the full active-state config intact', async () => {
    const storage = createInMemoryStateMachineStorage()

    const first = await runMachine(prReview, storage, { machineId: 'pr-resume' })
    first.send('REQUEST_CHANGES')
    expect(first.getState()).toEqual({
      review: 'changesRequested',
      cancelWatch: 'watching',
    })
    first.stop()

    const resumed = await runMachine(prReview, storage, {
      machineId: 'pr-resume',
      resume: true,
    })
    // Both regions restored to their exact sub-states.
    expect(resumed.getState()).toEqual({
      review: 'changesRequested',
      cancelWatch: 'watching',
    })

    resumed.send('APPROVE')
    expect(resumed.getState()).toEqual({
      review: 'approved',
      cancelWatch: 'watching',
    })
  })

  it('resumes from an explicitly-supplied snapshot without a storage read', async () => {
    const storage = createInMemoryStateMachineStorage()
    const first = await runMachine(trafficLight, storage, { machineId: 'tl-explicit' })
    first.send('TIMER')
    const snapshot = first.getPersistedSnapshot()
    first.stop()

    const resumed = await runMachine(trafficLight, storage, {
      machineId: 'tl-other-id',
      resume: snapshot,
    })
    expect(resumed.getState()).toBe('yellow')
  })
})

// ============================================================================
// 3. Storage port behaviour (in-memory adapter)
// ============================================================================

describe('InMemoryStateMachineStorage - port behaviour', () => {
  it('reports its kind', () => {
    const storage = createInMemoryStateMachineStorage()
    expect(storage.kind).toBe('in-memory')
  })

  it('returns undefined for an unknown snapshot', async () => {
    const storage = createInMemoryStateMachineStorage()
    expect(await storage.getSnapshot('nope')).toBeUndefined()
  })

  it('sets and gets a snapshot, replacing on re-write', async () => {
    const storage = createInMemoryStateMachineStorage()
    const snapA = { status: 'active', output: undefined, error: undefined } as const
    const snapB = { status: 'done', output: 42, error: undefined } as const

    await storage.setSnapshot('m', snapA)
    expect(await storage.getSnapshot('m')).toEqual(snapA)

    await storage.setSnapshot('m', snapB)
    expect(await storage.getSnapshot('m')).toEqual(snapB)
  })

  it('appends events to the log in arrival order with monotonic seq', async () => {
    const storage = createInMemoryStateMachineStorage()

    const e0 = await storage.appendEvent('m', { type: 'A' })
    const e1 = await storage.appendEvent('m', { type: 'B', payload: 1 })

    expect(e0.seq).toBe(0)
    expect(e1.seq).toBe(1)
    expect(typeof e0.timestamp).toBe('number')

    const log = await storage.getEvents('m')
    expect(log.map((e) => e.type)).toEqual(['A', 'B'])
    expect(log[1]?.event).toEqual({ type: 'B', payload: 1 })
  })

  it('isolates event logs per machine id', async () => {
    const storage = createInMemoryStateMachineStorage()
    await storage.appendEvent('m1', { type: 'A' })
    await storage.appendEvent('m2', { type: 'B' })

    expect((await storage.getEvents('m1')).map((e) => e.type)).toEqual(['A'])
    expect((await storage.getEvents('m2')).map((e) => e.type)).toEqual(['B'])
    expect(await storage.getEvents('unknown')).toEqual([])
  })

  it('schedules, lists, and cancels timers', async () => {
    const storage = createInMemoryStateMachineStorage()
    const timer = { id: 't1', fireAt: Date.now() + 1000, event: { type: 'TIMEOUT' } }

    await storage.scheduleTimer('m', timer)
    expect(await storage.getTimers('m')).toEqual([timer])

    const removed = await storage.cancelTimer('m', 't1')
    expect(removed).toBe(true)
    expect(await storage.getTimers('m')).toEqual([])

    // Cancelling an unknown timer is a no-op returning false.
    expect(await storage.cancelTimer('m', 'nope')).toBe(false)
  })

  it('replaces a re-scheduled timer with the same id', async () => {
    const storage = createInMemoryStateMachineStorage()
    await storage.scheduleTimer('m', { id: 't', fireAt: 1, event: { type: 'X' } })
    await storage.scheduleTimer('m', { id: 't', fireAt: 2, event: { type: 'Y' } })

    const timers = await storage.getTimers('m')
    expect(timers).toHaveLength(1)
    expect(timers[0]?.fireAt).toBe(2)
    expect(timers[0]?.event).toEqual({ type: 'Y' })
  })

  it('clear() removes all machine state', async () => {
    const storage = createInMemoryStateMachineStorage()
    await storage.appendEvent('m', { type: 'A' })
    await storage.setSnapshot('m', { status: 'active', output: undefined, error: undefined })

    storage.clear()

    expect(await storage.getSnapshot('m')).toBeUndefined()
    expect(await storage.getEvents('m')).toEqual([])
  })
})

// ============================================================================
// 4. runMachine integration with the event log
// ============================================================================

describe('runMachine - event logging', () => {
  it('appends sent events to the storage log by default', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(trafficLight, storage, { machineId: 'tl-log' })

    handle.send('TIMER')
    handle.send({ type: 'TIMER' })

    const log = await storage.getEvents('tl-log')
    expect(log.map((e) => e.type)).toEqual(['TIMER', 'TIMER'])
  })

  it('does not log events when logEvents is false', async () => {
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(trafficLight, storage, {
      machineId: 'tl-nolog',
      logEvents: false,
    })

    handle.send('TIMER')
    expect(await storage.getEvents('tl-nolog')).toEqual([])
  })
})
