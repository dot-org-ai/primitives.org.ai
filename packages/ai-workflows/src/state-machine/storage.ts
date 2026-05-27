/**
 * StateMachineStorage - Port for durable state machine persistence backends.
 *
 * Defines a small, backend-agnostic interface that the state machine
 * {@link import('./runtime.js').runMachine | runtime} programs against without
 * knowing which durability backend is wired underneath. It is the durability
 * seam from ADR-0011: a `MachineConfig` runs through `xstate.createActor`, and
 * every transition's snapshot is written through this port; resume reads the
 * snapshot back and rehydrates a fresh actor from it.
 *
 * ## Why this port exists
 *
 * The state machine runtime is a **peer** to {@link import('./runtime.js')}'s
 * sibling, the DAG {@link import('../workflow-builder.js').WorkflowBuilder}.
 * Both run in-process and live only as long as the host process. Long-lived,
 * event-driven, hierarchical workflows (PR-as-a-Service is the canonical
 * example) must survive restarts, respond to outside-world events, and fire
 * timer-driven (`after X`) transitions. That requires an external durable
 * backend.
 *
 * Two production adapters justify the seam from day one (per ADR-0011, both
 * land in later slices):
 *
 *   - **DurableObjectAdapter** (default) — snapshot in DO `state.storage`;
 *     `alarm()` drives `after X` scheduled transitions; `fetch()` receives
 *     external events. For tenant-scoped, latency-sensitive workflows.
 *
 *   - **PostgresAdapter** (via `ai-database`) — snapshot in a
 *     `state_machine_instances` row; event log in an append-only table; the
 *     scheduler against a `state_machine_timers` table. Inherits ADR-0003's
 *     transactional/analytical split — pg-backed machines are queryable and
 *     replayable.
 *
 * Plus the in-process {@link InMemoryStateMachineStorage} in this file — for
 * tests and local development that do not need durability across process
 * restarts. It is the canonical reference for the port's observable
 * behaviour; the contract test runs against it and (later) against both real
 * adapters.
 *
 * ## Shape, mirrored on `DurableExecutionAdapter`
 *
 * This port is modelled on the house style of
 * {@link import('../durable-execution.js').DurableExecutionAdapter}: a small,
 * backend-portable surface where each adapter translates the operations to its
 * native primitive (DO storage + alarms, pg tables + scheduler, in-memory
 * maps). It is intentionally minimal but complete:
 *
 *   - **Snapshot read/write** — the active-state configuration, serialised by
 *     xstate's `actor.getPersistedSnapshot()`. Captures every parallel-region
 *     state and history slot, so resume restores the full configuration.
 *   - **Event-log append/read** — an append-only record of the events the
 *     actor processed, for replay-based root-causing (`getEvents`).
 *   - **Timer schedule/cancel** — backs xstate `after X` transitions. The DO
 *     adapter maps a timer to `state.storage.setAlarm`; the pg adapter to a
 *     row in the timers table. The in-memory adapter just records them.
 *
 * Snapshots and event payloads must be structurally serialisable (JSON-safe)
 * for adapters that persist to storage; the in-memory adapter does not enforce
 * this, matching the in-memory durable-execution stub.
 *
 * @packageDocumentation
 */

import type { Snapshot } from 'xstate'

// =============================================================================
// Serialisable snapshot type
// =============================================================================

/**
 * The persisted form of an actor's state, as returned by
 * `actor.getPersistedSnapshot()`. Opaque to callers — it is written by the
 * runtime on every transition and handed back to `createActor(machine, {
 * snapshot })` on resume. Structurally serialisable for adapters that persist
 * it (DO storage, pg JSONB column).
 */
export type PersistedMachineSnapshot = Snapshot<unknown>

// =============================================================================
// Event log
// =============================================================================

/**
 * One entry in a machine's append-only event log. Records an event the actor
 * processed, in arrival order, so a failed run can be replayed against a fresh
 * actor for root-causing.
 */
export interface MachineEventLogEntry {
  /** Monotonic sequence number assigned by the adapter on append (0-based). */
  readonly seq: number
  /** Wall-clock time the event was appended (epoch ms). */
  readonly timestamp: number
  /** The xstate event type (e.g. `'REVIEW_COMPLETED'`). */
  readonly type: string
  /**
   * The full event object as sent to `actor.send`. Must be JSON-serialisable
   * for persisting adapters.
   */
  readonly event: Record<string, unknown>
}

// =============================================================================
// Timers
// =============================================================================

/**
 * A scheduled timer backing an xstate `after X` transition. The runtime
 * schedules one when the actor enters a state with a delayed transition and
 * cancels it when the state is left before firing. Real adapters translate
 * `fireAt` to their native scheduler (DO `setAlarm`, pg timers table); the
 * in-memory adapter just records it.
 */
export interface ScheduledTimer {
  /** Stable id for the timer (adapter-defined format). Unique per machine. */
  readonly id: string
  /** Absolute time the timer should fire (epoch ms). */
  readonly fireAt: number
  /**
   * The xstate event to send when the timer fires. xstate's `after`
   * transitions are keyed by a generated delay-event type; the adapter sends
   * this back to the actor at `fireAt`.
   */
  readonly event: Record<string, unknown>
}

// =============================================================================
// The port
// =============================================================================

/**
 * Concrete adapter kind. Used only as a discriminant for callers that want to
 * log or branch on the active backend; never relied on for correctness.
 */
export type StateMachineStorageKind = 'in-memory' | 'durable-object' | 'postgres'

/**
 * The port. A small, backend-agnostic interface over snapshot read/write,
 * event-log append/read, and timer schedule/cancel — scoped per machine
 * instance by `machineId`.
 *
 * Real adapters live behind separate subpath modules (DO, pg) so importing the
 * port itself does not pull in any backend dependencies. All methods are async
 * so persisting adapters can do I/O; the in-memory adapter resolves
 * synchronously-completed promises.
 */
export interface StateMachineStorage {
  /** Discriminant tag for the active backend. */
  readonly kind: StateMachineStorageKind

  /**
   * Write the current persisted snapshot for `machineId`, replacing any
   * prior snapshot. Called by the runtime on every transition.
   */
  setSnapshot(machineId: string, snapshot: PersistedMachineSnapshot): Promise<void>

  /**
   * Read the persisted snapshot for `machineId`, or `undefined` if none has
   * been written. Used on resume to rehydrate a fresh actor.
   */
  getSnapshot(machineId: string): Promise<PersistedMachineSnapshot | undefined>

  /**
   * Append one event to `machineId`'s log. The adapter assigns the entry its
   * `seq` and `timestamp`; the caller supplies only the event. Returns the
   * stored entry (including the assigned `seq`/`timestamp`).
   */
  appendEvent(
    machineId: string,
    event: { type: string } & Record<string, unknown>
  ): Promise<MachineEventLogEntry>

  /**
   * Read `machineId`'s event log in arrival order. Empty array if the machine
   * has no logged events. Used for replay-based root-causing.
   */
  getEvents(machineId: string): Promise<readonly MachineEventLogEntry[]>

  /**
   * Schedule a timer for `machineId`. The adapter persists it and (for real
   * backends) arms its native scheduler to fire at `timer.fireAt`. The
   * in-memory adapter records it without firing. Re-scheduling a timer with
   * an existing `id` replaces it.
   */
  scheduleTimer(machineId: string, timer: ScheduledTimer): Promise<void>

  /**
   * Cancel a previously-scheduled timer by id. Idempotent — cancelling an
   * unknown id is a no-op. Returns `true` if a timer was removed, `false`
   * otherwise.
   */
  cancelTimer(machineId: string, timerId: string): Promise<boolean>

  /**
   * List `machineId`'s currently-scheduled (not-yet-fired, not-cancelled)
   * timers. Empty array if none. Used by the DO `alarm()` / pg scheduler to
   * resolve which transition fires next.
   */
  getTimers(machineId: string): Promise<readonly ScheduledTimer[]>
}

// =============================================================================
// In-memory adapter for tests
// =============================================================================

/**
 * Per-machine state held by the in-memory adapter.
 */
interface InMemoryMachineState {
  snapshot?: PersistedMachineSnapshot
  events: MachineEventLogEntry[]
  timers: Map<string, ScheduledTimer>
}

/**
 * An in-memory {@link StateMachineStorage} adapter suitable for tests, local
 * development, and validating the port shape. **Not durable** — all state
 * lives in closure for the lifetime of the process.
 *
 * It satisfies the full port surface and is the canonical reference for its
 * observable behaviour: snapshot replace-on-write, event-log append in arrival
 * order with monotonic `seq`, and timer record/cancel. Timers are recorded but
 * never fired — tests that want timer-driven transitions drive them manually.
 *
 * @example
 * ```ts
 * const storage = createInMemoryStateMachineStorage()
 * await storage.setSnapshot('m-1', actor.getPersistedSnapshot())
 * const restored = await storage.getSnapshot('m-1')
 * ```
 */
export interface InMemoryStateMachineStorage extends StateMachineStorage {
  readonly kind: 'in-memory'
  /** Remove all state for every machine. Convenience for test teardown. */
  clear(): void
}

/**
 * @see InMemoryStateMachineStorage
 */
export function createInMemoryStateMachineStorage(): InMemoryStateMachineStorage {
  const machines = new Map<string, InMemoryMachineState>()

  function stateFor(machineId: string): InMemoryMachineState {
    let state = machines.get(machineId)
    if (!state) {
      state = { events: [], timers: new Map() }
      machines.set(machineId, state)
    }
    return state
  }

  return {
    kind: 'in-memory',

    async setSnapshot(machineId, snapshot) {
      stateFor(machineId).snapshot = snapshot
    },

    async getSnapshot(machineId) {
      return machines.get(machineId)?.snapshot
    },

    async appendEvent(machineId, event) {
      const state = stateFor(machineId)
      const entry: MachineEventLogEntry = {
        seq: state.events.length,
        timestamp: Date.now(),
        type: event.type,
        event: { ...event },
      }
      state.events.push(entry)
      return entry
    },

    async getEvents(machineId) {
      return machines.get(machineId)?.events.slice() ?? []
    },

    async scheduleTimer(machineId, timer) {
      stateFor(machineId).timers.set(timer.id, timer)
    },

    async cancelTimer(machineId, timerId) {
      const timers = machines.get(machineId)?.timers
      if (!timers) return false
      return timers.delete(timerId)
    },

    async getTimers(machineId) {
      const timers = machines.get(machineId)?.timers
      return timers ? Array.from(timers.values()) : []
    },

    clear() {
      machines.clear()
    },
  }
}
