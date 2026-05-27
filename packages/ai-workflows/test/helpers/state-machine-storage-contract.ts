/**
 * Shared contract test for the {@link StateMachineStorage} port.
 *
 * The port has one canonical reference implementation (the in-memory adapter in
 * `src/state-machine/storage.ts`) and two production adapters (Durable Object,
 * Postgres). Every adapter must exhibit the *same* observable behaviour for
 * snapshot read/write, event-log append/read (monotonic `seq`, arrival order),
 * and timer schedule/cancel/list. Rather than re-asserting that behaviour in
 * each adapter's test file, this helper captures it once and is run against
 * each adapter.
 *
 * ## Usage
 *
 * Call {@link runStateMachineStorageContract} from inside a test file, passing a
 * label and a factory that produces a fresh, empty {@link StateMachineStorage}
 * per test. The factory may be async (real adapters provision a backend) and may
 * return an optional `cleanup` to tear the backend down after each case.
 *
 * ```ts
 * import { runStateMachineStorageContract } from './helpers/state-machine-storage-contract.js'
 * import { createInMemoryStateMachineStorage } from '../src/state-machine/index.js'
 *
 * runStateMachineStorageContract('in-memory', async () => ({
 *   storage: createInMemoryStateMachineStorage(),
 * }))
 * ```
 *
 * The Durable Object adapter (this slice) and the Postgres adapter (aip-yxss)
 * both consume this helper, so its export signature is a small public contract
 * those slices depend on — keep it adapter-agnostic.
 *
 * @packageDocumentation
 */

import { describe, it, expect, afterEach } from 'vitest'
import type {
  PersistedMachineSnapshot,
  StateMachineStorage,
} from '../../src/state-machine/storage.js'

// =============================================================================
// Factory contract
// =============================================================================

/**
 * What an adapter under test hands back to the contract: a fresh, empty
 * {@link StateMachineStorage} and an optional teardown. The factory is invoked
 * once per test case so cases never share state.
 */
export interface StateMachineStorageHarness {
  /** The adapter instance under test. Must start empty (no machines). */
  readonly storage: StateMachineStorage
  /** Optional teardown run after each case (close connections, clear DO, …). */
  cleanup?: () => void | Promise<void>
}

/**
 * Produces a fresh {@link StateMachineStorageHarness}. May be async so real
 * adapters can provision a backend (a Miniflare DO stub, a pg connection).
 */
export type StateMachineStorageFactory = () =>
  | StateMachineStorageHarness
  | Promise<StateMachineStorageHarness>

// =============================================================================
// Helpers
// =============================================================================

/**
 * A small structurally-serialisable snapshot stand-in. The port treats the
 * snapshot as opaque JSON, so the contract uses a plain object rather than a
 * real xstate snapshot — every persisting adapter must round-trip it byte-for-
 * byte.
 */
function fakeSnapshot(value: string): PersistedMachineSnapshot {
  return {
    status: 'active',
    value,
    output: undefined,
    error: undefined,
  } as PersistedMachineSnapshot
}

// =============================================================================
// The contract
// =============================================================================

/**
 * Run the full {@link StateMachineStorage} observable-behaviour contract against
 * the adapter produced by `factory`, under a `describe(label, …)` block.
 *
 * Asserts, against a freshly-built adapter per case:
 *
 *   - **snapshot** — `getSnapshot` of an unknown id is `undefined`; `setSnapshot`
 *     then `getSnapshot` round-trips; re-writing replaces; snapshots are
 *     isolated per `machineId`.
 *   - **event log** — `appendEvent` assigns a 0-based monotonic `seq` and a
 *     numeric `timestamp`, preserves arrival order and the full event payload,
 *     returns the stored entry, and isolates logs per `machineId`; `getEvents`
 *     of an unknown id is `[]`.
 *   - **timers** — `scheduleTimer` then `getTimers` round-trips; re-scheduling
 *     the same id replaces; `cancelTimer` removes and returns `true`, an unknown
 *     id returns `false`; timers are isolated per `machineId`.
 *
 * @param label - describe-block label identifying the adapter (e.g. `'in-memory'`).
 * @param factory - builds a fresh, empty harness per case.
 */
export function runStateMachineStorageContract(
  label: string,
  factory: StateMachineStorageFactory
): void {
  describe(`StateMachineStorage contract: ${label}`, () => {
    let harness: StateMachineStorageHarness

    /** Build a fresh adapter for a case; registers its cleanup. */
    async function fresh(): Promise<StateMachineStorage> {
      harness = await factory()
      return harness.storage
    }

    afterEach(async () => {
      await harness?.cleanup?.()
    })

    // -- snapshots ----------------------------------------------------------

    it('returns undefined for an unknown snapshot', async () => {
      const storage = await fresh()
      expect(await storage.getSnapshot('nope')).toBeUndefined()
    })

    it('sets and gets a snapshot, replacing on re-write', async () => {
      const storage = await fresh()
      const a = fakeSnapshot('green')
      const b = fakeSnapshot('yellow')

      await storage.setSnapshot('m', a)
      expect(await storage.getSnapshot('m')).toEqual(a)

      await storage.setSnapshot('m', b)
      expect(await storage.getSnapshot('m')).toEqual(b)
    })

    it('isolates snapshots per machine id', async () => {
      const storage = await fresh()
      await storage.setSnapshot('m1', fakeSnapshot('a'))
      await storage.setSnapshot('m2', fakeSnapshot('b'))

      expect((await storage.getSnapshot('m1')) as { value: unknown }).toMatchObject({ value: 'a' })
      expect((await storage.getSnapshot('m2')) as { value: unknown }).toMatchObject({ value: 'b' })
    })

    // -- event log ----------------------------------------------------------

    it('returns an empty log for a machine with no events', async () => {
      const storage = await fresh()
      expect(await storage.getEvents('nope')).toEqual([])
    })

    it('appends events in arrival order with 0-based monotonic seq', async () => {
      const storage = await fresh()

      const e0 = await storage.appendEvent('m', { type: 'A' })
      const e1 = await storage.appendEvent('m', { type: 'B', payload: 1 })
      const e2 = await storage.appendEvent('m', { type: 'C' })

      expect(e0.seq).toBe(0)
      expect(e1.seq).toBe(1)
      expect(e2.seq).toBe(2)
      expect(typeof e0.timestamp).toBe('number')

      const log = await storage.getEvents('m')
      expect(log.map((e) => e.type)).toEqual(['A', 'B', 'C'])
      expect(log.map((e) => e.seq)).toEqual([0, 1, 2])
    })

    it('returns the stored entry from appendEvent including the assigned seq', async () => {
      const storage = await fresh()
      const entry = await storage.appendEvent('m', {
        type: 'REVIEW_COMPLETED',
        persona: 'security',
      })

      expect(entry.seq).toBe(0)
      expect(entry.type).toBe('REVIEW_COMPLETED')
      expect(entry.event).toEqual({ type: 'REVIEW_COMPLETED', persona: 'security' })
    })

    it('preserves the full event payload in the log', async () => {
      const storage = await fresh()
      await storage.appendEvent('m', { type: 'B', payload: 1, nested: { ok: true } })

      const log = await storage.getEvents('m')
      expect(log[0]?.event).toEqual({ type: 'B', payload: 1, nested: { ok: true } })
    })

    it('isolates event logs per machine id', async () => {
      const storage = await fresh()
      await storage.appendEvent('m1', { type: 'A' })
      await storage.appendEvent('m2', { type: 'B' })

      expect((await storage.getEvents('m1')).map((e) => e.type)).toEqual(['A'])
      expect((await storage.getEvents('m2')).map((e) => e.type)).toEqual(['B'])
      // Each machine's seq is independent and 0-based.
      expect((await storage.getEvents('m1'))[0]?.seq).toBe(0)
      expect((await storage.getEvents('m2'))[0]?.seq).toBe(0)
    })

    // -- timers -------------------------------------------------------------

    it('returns an empty timer list for a machine with no timers', async () => {
      const storage = await fresh()
      expect(await storage.getTimers('nope')).toEqual([])
    })

    it('schedules and lists a timer', async () => {
      const storage = await fresh()
      const timer = { id: 't1', fireAt: 1_000, event: { type: 'TIMEOUT' } }

      await storage.scheduleTimer('m', timer)
      expect(await storage.getTimers('m')).toEqual([timer])
    })

    it('replaces a re-scheduled timer with the same id', async () => {
      const storage = await fresh()
      await storage.scheduleTimer('m', { id: 't', fireAt: 1, event: { type: 'X' } })
      await storage.scheduleTimer('m', { id: 't', fireAt: 2, event: { type: 'Y' } })

      const timers = await storage.getTimers('m')
      expect(timers).toHaveLength(1)
      expect(timers[0]?.fireAt).toBe(2)
      expect(timers[0]?.event).toEqual({ type: 'Y' })
    })

    it('cancels a timer by id, returning true; unknown id returns false', async () => {
      const storage = await fresh()
      await storage.scheduleTimer('m', { id: 't1', fireAt: 1_000, event: { type: 'TIMEOUT' } })

      expect(await storage.cancelTimer('m', 't1')).toBe(true)
      expect(await storage.getTimers('m')).toEqual([])

      // Idempotent: cancelling an unknown id is a no-op returning false.
      expect(await storage.cancelTimer('m', 'nope')).toBe(false)
      expect(await storage.cancelTimer('unknown-machine', 't1')).toBe(false)
    })

    it('isolates timers per machine id', async () => {
      const storage = await fresh()
      await storage.scheduleTimer('m1', { id: 't', fireAt: 1, event: { type: 'A' } })
      await storage.scheduleTimer('m2', { id: 't', fireAt: 2, event: { type: 'B' } })

      expect(await storage.getTimers('m1')).toEqual([{ id: 't', fireAt: 1, event: { type: 'A' } }])
      expect(await storage.getTimers('m2')).toEqual([{ id: 't', fireAt: 2, event: { type: 'B' } }])
    })
  })
}
