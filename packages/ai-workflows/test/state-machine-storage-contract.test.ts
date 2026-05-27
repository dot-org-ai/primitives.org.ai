/**
 * Runs the shared {@link runStateMachineStorageContract} helper against both the
 * in-memory adapter (the port's reference implementation) and the Durable Object
 * storage adapter (backed here by an in-process stub satisfying
 * {@link DurableObjectStorageLike}).
 *
 * The DO adapter's *storage* behaviour is pure I/O over the structural storage
 * surface, so it is exercised under plain Node here — no Miniflare needed. The
 * full DO host (actor + alarm + fetch) is covered by the Miniflare integration
 * test (`test/worker/state-machine-durable-object.test.ts`). Proving both
 * adapters satisfy the same contract is the whole point of the seam.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { createInMemoryStateMachineStorage } from '../src/state-machine/index.js'
import {
  createDurableObjectStateMachineStorage,
  type DurableObjectStorageLike,
} from '../src/state-machine/durable-object-adapter.js'
import { createPostgresStateMachineStorage } from '../src/state-machine/postgres-adapter.js'
import { runStateMachineStorageContract } from './helpers/state-machine-storage-contract.js'
import { FakeStateMachineStore, makeFakeStateMachineExecutor } from './helpers/fake-pg-executor.js'

// =============================================================================
// In-process Durable Object storage stub
// =============================================================================

/**
 * A minimal in-memory {@link DurableObjectStorageLike} — the structural subset of
 * a DO's `state.storage` the adapter uses. It records the last-set alarm so the
 * adapter's alarm re-arming can be asserted indirectly via the contract.
 *
 * Values are deep-cloned on `put`/`get` to mimic DO storage's serialise-on-write
 * semantics (the real backend stores structured clones), so the contract proves
 * the adapter round-trips JSON-safe values rather than sharing references.
 */
function createFakeDurableObjectStorage(): DurableObjectStorageLike & {
  alarm: number | null
} {
  const map = new Map<string, unknown>()
  let alarm: number | null = null
  const clone = <T>(v: T): T => structuredClone(v)

  return {
    get alarm() {
      return alarm
    },
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return map.has(key) ? clone(map.get(key) as T) : undefined
    },
    async put<T>(key: string, value: T): Promise<void> {
      map.set(key, clone(value))
    },
    async delete(key: string): Promise<boolean> {
      return map.delete(key)
    },
    async setAlarm(scheduledTime: number | Date): Promise<void> {
      alarm = typeof scheduledTime === 'number' ? scheduledTime : scheduledTime.getTime()
    },
    async deleteAlarm(): Promise<void> {
      alarm = null
    },
    async getAlarm(): Promise<number | null> {
      return alarm
    },
  }
}

// =============================================================================
// Contract runs
// =============================================================================

runStateMachineStorageContract('in-memory', () => ({
  storage: createInMemoryStateMachineStorage(),
}))

runStateMachineStorageContract('durable-object (in-process stub)', () => ({
  storage: createDurableObjectStateMachineStorage(createFakeDurableObjectStorage()),
}))

// The Postgres adapter runs OFFLINE here against a fake PgExecutor that
// interprets the SQL family the adapter emits (the repo's established
// offline-pg pattern from ai-database's pg-adapter.test.ts) — no live database,
// no new dependency. Proving it satisfies the same contract is the seam's point.
runStateMachineStorageContract('postgres (fake executor, offline)', () => {
  const store = new FakeStateMachineStore()
  return {
    storage: createPostgresStateMachineStorage({
      executor: makeFakeStateMachineExecutor(store),
    }),
  }
})

// =============================================================================
// DO-specific: alarm arming/clearing (beyond the shared contract)
// =============================================================================

describe('DurableObjectStateMachineStorage - alarm arming', () => {
  it('reports the durable-object kind', () => {
    const storage = createDurableObjectStateMachineStorage(createFakeDurableObjectStorage())
    expect(storage.kind).toBe('durable-object')
  })

  it('arms the DO alarm at the earliest pending timer fireAt', async () => {
    const doStorage = createFakeDurableObjectStorage()
    const storage = createDurableObjectStateMachineStorage(doStorage)

    await storage.scheduleTimer('m', { id: 'a', fireAt: 5_000, event: { type: 'A' } })
    expect(doStorage.alarm).toBe(5_000)

    // A sooner timer re-arms the alarm to the earlier deadline.
    await storage.scheduleTimer('m', { id: 'b', fireAt: 2_000, event: { type: 'B' } })
    expect(doStorage.alarm).toBe(2_000)

    // A later timer leaves the alarm at the still-earliest deadline.
    await storage.scheduleTimer('m', { id: 'c', fireAt: 9_000, event: { type: 'C' } })
    expect(doStorage.alarm).toBe(2_000)
  })

  it('reschedules the alarm to the next-earliest on cancel, clearing when none remain', async () => {
    const doStorage = createFakeDurableObjectStorage()
    const storage = createDurableObjectStateMachineStorage(doStorage)

    await storage.scheduleTimer('m', { id: 'a', fireAt: 5_000, event: { type: 'A' } })
    await storage.scheduleTimer('m', { id: 'b', fireAt: 2_000, event: { type: 'B' } })
    expect(doStorage.alarm).toBe(2_000)

    // Cancelling the earliest reschedules to the next-earliest.
    await storage.cancelTimer('m', 'b')
    expect(doStorage.alarm).toBe(5_000)

    // Cancelling the last timer clears the alarm.
    await storage.cancelTimer('m', 'a')
    expect(doStorage.alarm).toBeNull()
  })
})
