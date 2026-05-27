/**
 * State machine runtime - the actor lifecycle for hierarchical state machine
 * workflows.
 *
 * This is the thin shell around xstate that ADR-0011 calls for: it takes an
 * xstate `MachineConfig` (or an already-created machine), creates an actor,
 * wires every transition to persist a snapshot through the
 * {@link StateMachineStorage} port, and supports resuming from a stored
 * snapshot. It runs as a **peer** to the DAG
 * {@link import('../workflow-builder.js').WorkflowBuilder} — both consume the
 * same durability seam; statecharts and DAGs are different computational
 * models and do not share an executor.
 *
 * In this slice (Slice 1, the spine) the runtime owns:
 *
 *   - **Actor creation** — `createActor(machine)` from a `MachineConfig`, or a
 *     machine created via `createMachine`.
 *   - **Snapshot persistence** — `actor.subscribe` fires on every transition;
 *     the handler writes `actor.getPersistedSnapshot()` through the storage
 *     port.
 *   - **Resume** — `createActor(machine, { snapshot })` rehydrates a fresh
 *     actor from a previously-persisted snapshot, restoring the full active
 *     state configuration (every parallel region, every history slot).
 *   - **A small handle** — `send`, `getState`, `getSnapshot`, `stop`,
 *     `subscribe` — so callers drive the machine without touching xstate
 *     directly.
 *
 * Later slices add the event bridge (bus ↔ actor), the DO / pg adapters, and
 * the mermaid wire format. None of those are in this module yet.
 *
 * @packageDocumentation
 */

import { createActor, createMachine } from 'xstate'
import type {
  AnyActor,
  AnyMachineSnapshot,
  AnyStateMachine,
  EventObject,
  MachineConfig,
  StateValue,
  Subscription,
} from 'xstate'
import type { PersistedMachineSnapshot, StateMachineStorage } from './storage.js'

// =============================================================================
// Inputs
// =============================================================================

/**
 * Accepted machine inputs to {@link runMachine}: either a typed xstate
 * `MachineConfig` (developer-authorable wire format) or an already-created
 * machine from `createMachine`. Both feed the same actor lifecycle.
 *
 * `MachineConfig` is typed loosely here (`any` context/event) because the
 * runtime is wire-format-agnostic — it persists and drives whatever statechart
 * it is handed. Callers that want typed events should pass a machine created
 * with `setup(...).createMachine(...)` and read the typed handle through their
 * own machine reference.
 */
export type RunnableMachine =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnyStateMachine | MachineConfig<any, any>

// =============================================================================
// Options
// =============================================================================

/**
 * Options for {@link runMachine}.
 */
export interface RunMachineOptions {
  /**
   * Stable id for this machine instance. Used as the key under which the
   * runtime reads and writes snapshots / events / timers via the storage
   * port. Defaults to a generated id; supply one to resume a known instance.
   */
  machineId?: string

  /**
   * Resume from a previously-persisted snapshot instead of starting fresh. If
   * `true`, the runtime reads the snapshot for `machineId` from storage and
   * rehydrates the actor from it (restoring the full active-state
   * configuration). If a {@link PersistedMachineSnapshot} is supplied
   * directly, it is used as-is without a storage read. Default: `false`
   * (start fresh from the machine's initial state).
   */
  resume?: boolean | PersistedMachineSnapshot

  /**
   * Start the actor immediately (default `true`). When `false`, callers must
   * call {@link MachineHandle.start} before sending events — useful for tests
   * that want to attach a subscriber before the initial state is entered.
   */
  autoStart?: boolean

  /**
   * Append every sent event to the storage event log (default `true`). The
   * runtime records events as they are sent so a failed run can be replayed.
   */
  logEvents?: boolean

  /**
   * Optional xstate `Clock` for scheduling delayed (`after X`) transitions.
   * Durable backends (the Durable Object adapter) supply a clock that routes
   * delays through their native scheduler — DO `setAlarm` — so timer-driven
   * transitions survive restarts. When omitted, xstate's default clock
   * (`setTimeout`/`clearTimeout`) is used, which is fine for in-process runs.
   */
  clock?: ActorClock
}

/**
 * The xstate `Clock` shape: `setTimeout` returns an opaque handle and
 * `clearTimeout` cancels by it. Re-declared here so callers and adapters need
 * not import it from xstate's internals.
 */
export interface ActorClock {
  setTimeout(fn: (...args: unknown[]) => void, timeoutMs: number): unknown
  clearTimeout(handle: unknown): void
}

/**
 * One `after` (delayed) transition pending in an actor's active-state
 * configuration. Surfaced by {@link MachineHandle.pendingAfterTransitions} and
 * {@link pendingAfterTransitions} so durable adapters can schedule a timer whose
 * stored event is xstate's **real** delay-event type.
 */
export interface PendingAfterTransition {
  /** Resolved delay in milliseconds. */
  readonly delay: number
  /**
   * xstate's generated delay-event type for this transition — the exact event a
   * resumed actor responds to (e.g. `xstate.after.50.machine.armed`). Verified
   * empirically against xstate v5: a reconstructed actor fired from a persisted
   * snapshot takes the `after` transition only when sent **this** event type.
   */
  readonly eventType: string
}

// =============================================================================
// Handle
// =============================================================================

/**
 * The handle returned by {@link runMachine}. A small surface over the running
 * actor so callers send events and read state without reaching into xstate.
 */
export interface MachineHandle {
  /** The stable instance id this machine runs under in storage. */
  readonly machineId: string

  /** The underlying xstate actor. Escape hatch for advanced callers. */
  readonly actor: AnyActor

  /**
   * Send an event to the machine. Accepts a string shorthand (`'TIMER'`) or a
   * full event object (`{ type: 'REVIEW_COMPLETED', persona: 'security' }`).
   * The resulting snapshot is persisted by the runtime's transition
   * subscription; the event is appended to the log when `logEvents` is on.
   */
  send(event: string | EventObject): void

  /**
   * The current state value — a string for a flat state, or a nested object
   * for composite / parallel states (e.g. `{ review: 'awaiting' }`).
   */
  getState(): StateValue

  /** The current live machine snapshot (xstate's in-memory snapshot). */
  getSnapshot(): AnyMachineSnapshot

  /** The current persisted snapshot, as written to storage on transitions. */
  getPersistedSnapshot(): PersistedMachineSnapshot

  /**
   * The `after` (delayed) transitions pending in the actor's *current* active
   * state configuration, as `{ delay, eventType }` pairs. `delay` is the
   * resolved delay in milliseconds; `eventType` is xstate's **real** generated
   * delay-event type (e.g. `xstate.after.50.machine.armed`) — the exact event a
   * resumed actor responds to to take that transition.
   *
   * Durable adapters use this to (re-)schedule timers whose stored event is the
   * real delay-event type, so a reconstructed actor (post-hibernation) fires the
   * transition when the alarm/scheduler delivers it. See
   * {@link pendingAfterTransitions}.
   */
  pendingAfterTransitions(): PendingAfterTransition[]

  /**
   * Subscribe to snapshot changes. Returns a {@link Subscription}; call
   * `unsubscribe()` to stop. Mirrors `actor.subscribe`.
   */
  subscribe(observer: (snapshot: AnyMachineSnapshot) => void): Subscription

  /** Start the actor (only needed when constructed with `autoStart: false`). */
  start(): void

  /** Stop the actor and release its transition subscription. */
  stop(): void

  /**
   * Resolve once all durable writes queued so far (snapshot persists, event-log
   * appends) have settled. Durable writes are serialised per machine onto a
   * promise tail so they land in order even on a pooled async backend; this
   * awaits that tail. Callers that read storage directly right after `send()`
   * (e.g. assert the event log) should `await handle.whenWritesSettled()` first
   * so the asynchronous writes are visible.
   */
  whenWritesSettled(): Promise<void>
}

// =============================================================================
// Entry point
// =============================================================================

let machineSeq = 0

/**
 * Narrow a {@link RunnableMachine} to a created xstate machine. A created
 * machine exposes a `transition` method (it is a `StateMachine` instance); a
 * plain `MachineConfig` does not.
 */
function isCreatedMachine(input: RunnableMachine): input is AnyStateMachine {
  return typeof (input as AnyStateMachine).transition === 'function'
}

/**
 * Extract the `after` (delayed) transitions pending in a snapshot's current
 * active-state configuration. Walks the snapshot's resolved active state nodes
 * (`_nodes`) — each carries an `after` array of `{ delay, eventType }` where
 * `eventType` is xstate's real generated delay-event type.
 *
 * This is the linchpin of durable `after`-timer survival across resume: xstate's
 * `getPersistedSnapshot()` does NOT persist pending `after` timers and
 * `createActor(machine, { snapshot })` does NOT re-arm them, but the resolved
 * active nodes of the rehydrated actor DO still declare those transitions. A
 * durable adapter reads them here, schedules durable timers keyed on the real
 * `eventType`, and delivers `eventType` to the resumed actor when the timer is
 * due — at which point the actor takes the transition normally.
 */
export function pendingAfterTransitions(snapshot: AnyMachineSnapshot): PendingAfterTransition[] {
  // xstate v5 exposes the resolved active state nodes as `_nodes`. Each node's
  // `after` is the list of delayed transitions armed while that node is active.
  const nodes = (snapshot as unknown as { _nodes?: readonly AfterNode[] })._nodes ?? []
  const out: PendingAfterTransition[] = []
  for (const node of nodes) {
    for (const t of node.after ?? []) {
      if (typeof t.delay === 'number' && typeof t.eventType === 'string') {
        out.push({ delay: t.delay, eventType: t.eventType })
      }
    }
  }
  return out
}

/** The subset of an xstate state node the {@link pendingAfterTransitions} walk reads. */
interface AfterNode {
  after?: ReadonlyArray<{ delay: unknown; eventType: unknown }>
}

/**
 * Run a state machine end-to-end: create an actor from `config`, persist a
 * snapshot through `storage` on every transition, and return a
 * {@link MachineHandle} for driving it.
 *
 * Resume by passing `options.resume` — the runtime reads the persisted
 * snapshot for `options.machineId` and rehydrates the actor from it, restoring
 * the full active-state configuration.
 *
 * @example Fresh run
 * ```ts
 * const storage = createInMemoryStateMachineStorage()
 * const handle = await runMachine(trafficLight, storage, { machineId: 'tl-1' })
 * handle.send('TIMER')
 * handle.getState() // 'yellow'
 * ```
 *
 * @example Resume
 * ```ts
 * // ... earlier: a machine ran partway under machineId 'tl-1' ...
 * const resumed = await runMachine(trafficLight, storage, {
 *   machineId: 'tl-1',
 *   resume: true,
 * })
 * resumed.getState() // exactly where the prior actor left off
 * ```
 */
export async function runMachine(
  config: RunnableMachine,
  storage: StateMachineStorage,
  options: RunMachineOptions = {}
): Promise<MachineHandle> {
  const machineId = options.machineId ?? `sm-${++machineSeq}`
  const autoStart = options.autoStart ?? true
  const logEvents = options.logEvents ?? true

  const machine = isCreatedMachine(config) ? config : createMachine(config)

  // Resolve the snapshot to resume from, if any.
  let snapshot: PersistedMachineSnapshot | undefined
  if (options.resume === true) {
    snapshot = await storage.getSnapshot(machineId)
  } else if (options.resume && typeof options.resume === 'object') {
    snapshot = options.resume
  }

  // Pass the optional clock through to xstate so durable backends can route
  // `after X` delays through their native scheduler (DO alarms). xstate's
  // `ActorOptions.clock` is typed as its internal `Clock`; our `ActorClock`
  // mirror is structurally identical.
  const actorOptions: Parameters<typeof createActor>[1] = {}
  if (snapshot) actorOptions.snapshot = snapshot
  if (options.clock) actorOptions.clock = options.clock as never
  const actor: AnyActor = createActor(machine, actorOptions)

  // Serialise durable writes per machine. A pooled async backend (pg, DO) can
  // complete writes out of order if two are in flight at once; chaining each
  // write onto a per-machine promise tail makes the next start only after the
  // previous settles, preserving snapshot/event order.
  //
  // The in-memory adapter mutates synchronously, cannot reorder, and is the
  // canonical reference for observable ordering — so it BYPASSES the tail and
  // runs the op inline (the "keep the in-memory path synchronous" requirement),
  // preserving the prior behaviour where a `send()` records its event before
  // control returns. Persisting backends go through the tail; callers that read
  // storage directly right after a write await `handle.whenWritesSettled()`.
  const serialise = storage.kind !== 'in-memory'
  let writeTail: Promise<unknown> | undefined
  const enqueueWrite = (op: () => Promise<unknown>): Promise<unknown> => {
    if (!serialise) return op()
    const next = writeTail ? writeTail.then(op, op) : op()
    // Track the in-flight tail; swallow rejection so one failed write does not
    // poison the chain (callers awaiting the returned promise still see it).
    writeTail = Promise.resolve(next).catch(() => undefined)
    return next
  }

  // Persist a snapshot on every transition. xstate fires the subscriber
  // synchronously after each microstep settles; `getPersistedSnapshot()`
  // returns the serialisable form that captures the full active-state
  // configuration (parallel regions + history slots). The write is serialised
  // onto the per-machine tail so snapshots land in transition order.
  actor.subscribe(() => {
    const snap = actor.getPersistedSnapshot()
    void enqueueWrite(() => storage.setSnapshot(machineId, snap))
  })

  if (autoStart) {
    actor.start()
    // Persist the initial snapshot too — `subscribe` does not fire for the
    // initial state on a fresh start, so capture it explicitly. (On resume the
    // snapshot already exists; re-writing it is harmless and idempotent.)
    await enqueueWrite(() => storage.setSnapshot(machineId, actor.getPersistedSnapshot()))
  }

  function normaliseEvent(event: string | EventObject): EventObject {
    return typeof event === 'string' ? { type: event } : event
  }

  return {
    machineId,
    actor,

    send(event) {
      const evt = normaliseEvent(event)
      if (logEvents) {
        // Serialise the append onto the per-machine tail so events log in the
        // order they were sent even on a pooled async backend.
        void enqueueWrite(() => storage.appendEvent(machineId, { ...evt }))
      }
      actor.send(evt)
    },

    getState() {
      return (actor.getSnapshot() as AnyMachineSnapshot).value
    },

    getSnapshot() {
      return actor.getSnapshot() as AnyMachineSnapshot
    },

    getPersistedSnapshot() {
      return actor.getPersistedSnapshot()
    },

    pendingAfterTransitions() {
      return pendingAfterTransitions(actor.getSnapshot() as AnyMachineSnapshot)
    },

    subscribe(observer) {
      return actor.subscribe((snap) => observer(snap as AnyMachineSnapshot))
    },

    start() {
      actor.start()
    },

    stop() {
      actor.stop()
    },

    async whenWritesSettled() {
      await (writeTail ?? Promise.resolve())
    },
  }
}
