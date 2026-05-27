/**
 * DurableObjectAdapter — a {@link StateMachineStorage} backed by a Cloudflare
 * Durable Object, plus the {@link StateMachineDurableObject} host class that
 * runs an actor inside a DO and drives `after X` transitions through DO alarms
 * and external events through the DO `fetch()` handler.
 *
 * This is the default durability backend from ADR-0011, for tenant-scoped,
 * latency-sensitive workflows. It maps the port's three concerns onto DO
 * primitives:
 *
 *   - **Snapshot** → a single `state.storage` key per machine
 *     (`sm:<machineId>:snapshot`), replaced on every transition.
 *   - **Event log** → an append-only array under `sm:<machineId>:events`, with a
 *     0-based monotonic `seq` matching the in-memory adapter's behaviour.
 *   - **Timers** → a map under `sm:<machineId>:timers`; `scheduleTimer` arms the
 *     DO alarm at the earliest pending `fireAt`, `cancelTimer` removes the timer
 *     and reschedules the alarm to the next-earliest (or clears it).
 *
 * ## Two pieces, one seam
 *
 *   1. {@link createDurableObjectStateMachineStorage} — the storage adapter. It
 *      is pure storage I/O over a {@link DurableObjectStorageLike} surface
 *      (the subset of `state.storage` it needs). It satisfies the port and is
 *      what the shared storage contract test runs against. It carries no
 *      knowledge of actors, alarms-as-event-delivery, or fetch.
 *
 *   2. {@link StateMachineDurableObject} — the host. It owns a running actor
 *      (via {@link runMachine}), provides xstate a {@link Clock} that translates
 *      delayed transitions into durable timers + DO alarms, resolves due timers
 *      in `alarm()`, and accepts external events in `fetch()`.
 *
 * ## No Workers types at module load
 *
 * Per the port's design, importing this module must not pull in
 * `cloudflare:workers` for non-Workers consumers. The DO surfaces it needs are
 * declared as **structural** TypeScript interfaces ({@link DurableObjectStorageLike},
 * {@link DurableObjectStateLike}); the {@link StateMachineDurableObject} base is
 * resolved lazily so this file imports cleanly under plain Node (the storage
 * adapter is fully usable there with any object satisfying the structural
 * surface — e.g. a Miniflare stub in tests).
 *
 * @packageDocumentation
 */

import { runMachine } from './runtime.js'
import type { MachineHandle, RunnableMachine } from './runtime.js'
import type {
  MachineEventLogEntry,
  PersistedMachineSnapshot,
  ScheduledTimer,
  StateMachineStorage,
} from './storage.js'

// =============================================================================
// Structural DO surfaces (no `cloudflare:workers` import at module load)
// =============================================================================

/**
 * The subset of a Durable Object's `state.storage` the adapter uses. Declared
 * structurally so this module imports under plain Node; the real
 * `DurableObjectStorage` satisfies it, as does a Miniflare stub.
 */
export interface DurableObjectStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
  setAlarm(scheduledTime: number | Date): Promise<void>
  deleteAlarm(): Promise<void>
  getAlarm(): Promise<number | null>
}

/**
 * The subset of `DurableObjectState` (the `ctx` passed to a DO constructor) the
 * host class uses: its `storage` and `blockConcurrencyWhile` for serialising
 * setup. Structural, for the same reason as {@link DurableObjectStorageLike}.
 */
export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike
  blockConcurrencyWhile?<T>(callback: () => Promise<T>): Promise<T>
}

/**
 * xstate's `Clock` shape, re-declared structurally so the adapter does not have
 * to import it from xstate's internals. `setTimeout` returns an opaque handle;
 * `clearTimeout` cancels by that handle.
 */
interface ClockLike {
  setTimeout(fn: (...args: unknown[]) => void, timeoutMs: number): unknown
  clearTimeout(handle: unknown): void
}

// =============================================================================
// Storage-key layout
// =============================================================================

const snapshotKey = (machineId: string): string => `sm:${machineId}:snapshot`
const eventsKey = (machineId: string): string => `sm:${machineId}:events`
const timersKey = (machineId: string): string => `sm:${machineId}:timers`

// =============================================================================
// The storage adapter
// =============================================================================

/**
 * A DO-backed {@link StateMachineStorage}. See {@link createDurableObjectStateMachineStorage}.
 */
export interface DurableObjectStateMachineStorage extends StateMachineStorage {
  readonly kind: 'durable-object'
}

/**
 * Build a {@link StateMachineStorage} backed by a Durable Object's
 * `state.storage`. Pure storage I/O — snapshot, event log, timers — with no
 * actor or alarm-delivery logic (that lives in {@link StateMachineDurableObject}).
 *
 * The `setAlarm` / `cancelTimer` paths keep the DO alarm armed at the earliest
 * pending `fireAt`, so the host's `alarm()` fires when the soonest timer is due.
 *
 * @param storage - a DO `state.storage` (or any {@link DurableObjectStorageLike}).
 *
 * @example
 * ```ts
 * // inside a Durable Object
 * const storage = createDurableObjectStateMachineStorage(state.storage)
 * await storage.setSnapshot('m-1', actor.getPersistedSnapshot())
 * ```
 */
export function createDurableObjectStateMachineStorage(
  storage: DurableObjectStorageLike
): DurableObjectStateMachineStorage {
  async function readEvents(machineId: string): Promise<MachineEventLogEntry[]> {
    return (await storage.get<MachineEventLogEntry[]>(eventsKey(machineId))) ?? []
  }

  async function readTimers(machineId: string): Promise<ScheduledTimer[]> {
    return (await storage.get<ScheduledTimer[]>(timersKey(machineId))) ?? []
  }

  /**
   * Re-arm the DO alarm at the earliest pending `fireAt` across this machine's
   * timers, or clear it when none remain. The DO alarm is a single global
   * wakeup, so the adapter always points it at the soonest deadline.
   */
  async function rearmAlarm(timers: readonly ScheduledTimer[]): Promise<void> {
    if (timers.length === 0) {
      await storage.deleteAlarm()
      return
    }
    const earliest = timers.reduce((min, t) => (t.fireAt < min ? t.fireAt : min), timers[0]!.fireAt)
    await storage.setAlarm(earliest)
  }

  return {
    kind: 'durable-object',

    async setSnapshot(machineId, snapshot) {
      await storage.put(snapshotKey(machineId), snapshot)
    },

    async getSnapshot(machineId) {
      return storage.get<PersistedMachineSnapshot>(snapshotKey(machineId))
    },

    async appendEvent(machineId, event) {
      const events = await readEvents(machineId)
      const entry: MachineEventLogEntry = {
        seq: events.length,
        timestamp: Date.now(),
        type: event.type,
        event: { ...event },
      }
      events.push(entry)
      await storage.put(eventsKey(machineId), events)
      return entry
    },

    async getEvents(machineId) {
      return readEvents(machineId)
    },

    async scheduleTimer(machineId, timer) {
      const timers = await readTimers(machineId)
      const idx = timers.findIndex((t) => t.id === timer.id)
      if (idx >= 0) timers[idx] = timer
      else timers.push(timer)
      await storage.put(timersKey(machineId), timers)
      await rearmAlarm(timers)
    },

    async cancelTimer(machineId, timerId) {
      const timers = await readTimers(machineId)
      const idx = timers.findIndex((t) => t.id === timerId)
      if (idx < 0) return false
      timers.splice(idx, 1)
      if (timers.length === 0) await storage.delete(timersKey(machineId))
      else await storage.put(timersKey(machineId), timers)
      await rearmAlarm(timers)
      return true
    },

    async getTimers(machineId) {
      return readTimers(machineId)
    },
  }
}

// =============================================================================
// The host Durable Object
// =============================================================================

/**
 * Options for {@link StateMachineDurableObject.boot} — the per-machine startup
 * the host performs on first use (or after hibernation).
 */
export interface StateMachineBootOptions {
  /** The statechart to run (a `MachineConfig` or a created machine). */
  machine: RunnableMachine
  /**
   * Stable instance id under which snapshots/events/timers are keyed. Defaults
   * to the DO's own id string when the host can resolve one; supply it
   * explicitly for deterministic keys in tests.
   */
  machineId: string
}

/**
 * A Durable Object that hosts a single running state machine actor.
 *
 * It binds the actor's lifecycle to DO primitives:
 *
 *   - **Resume on boot** — reads the stored snapshot (if any) and rehydrates the
 *     actor via `runMachine(..., { resume: true })`, restoring the full
 *     active-state configuration.
 *   - **Durable timers that survive resume** — xstate's `getPersistedSnapshot()`
 *     does NOT persist pending `after` timers, and `createActor(..., { snapshot })`
 *     does NOT re-arm them. So the host does NOT rely on xstate's clock or any
 *     in-memory callback to fire `after` transitions. Instead, after the actor
 *     starts (fresh OR resumed from a reconstructed DO), it reconciles durable
 *     timers against the actor's *current* pending `after` transitions
 *     ({@link MachineHandle.pendingAfterTransitions}), storing each timer keyed
 *     on xstate's REAL delay-event type (e.g. `xstate.after.50.machine.armed`).
 *     The DO `alarm()` resolves which timers are due and **sends each timer's
 *     real event** into the actor, which then takes the transition normally. The
 *     xstate clock supplied here is a no-op so xstate's own `setTimeout` never
 *     fires — all `after` firing flows through durable timers + DO alarms.
 *   - **External events via fetch** — `fetch()` accepts an event POST, sends it
 *     into the running actor, and persists the resulting snapshot.
 *
 * Subclasses bind a concrete machine by overriding {@link describeMachine}. The
 * base resolves a DO base class lazily so this module imports under plain Node;
 * in the Workers runtime the host extends `cloudflare:workers`' `DurableObject`.
 *
 * @example
 * ```ts
 * export class PrReviewDO extends StateMachineDurableObject {
 *   protected describeMachine() {
 *     return { machine: prReviewMachine, machineId: this.idString }
 *   }
 * }
 * ```
 */
export abstract class StateMachineDurableObject {
  /** The DO state ({@link DurableObjectStateLike}); exposes `storage`. */
  protected readonly state: DurableObjectStateLike
  /** The DO env binding (opaque to the base). */
  protected readonly env: unknown

  /** The DO-backed storage adapter, built once per instance. */
  protected readonly storage: DurableObjectStateMachineStorage

  /** The running actor handle, lazily booted on first use. */
  private handle: MachineHandle | undefined
  /** Resolved boot config (machine + machineId). */
  private boot: StateMachineBootOptions | undefined

  constructor(state: DurableObjectStateLike, env: unknown) {
    this.state = state
    this.env = env
    this.storage = createDurableObjectStateMachineStorage(state.storage)
  }

  /**
   * Bind the concrete machine this DO runs. Subclasses return the statechart
   * and a stable `machineId`. Called once on boot.
   */
  protected abstract describeMachine(): StateMachineBootOptions

  /**
   * A no-op xstate {@link ClockLike}. The host does NOT use xstate's clock to
   * fire `after` transitions — those flow through durable timers + DO alarms,
   * reconciled by {@link syncTimers}. This clock simply prevents xstate's own
   * `setTimeout` from firing in the DO (DOs have no long-lived event loop across
   * hibernation anyway), so the durable path is the single source of truth.
   */
  private noopClock(): ClockLike {
    return {
      setTimeout: (): unknown => undefined,
      clearTimeout: (): void => undefined,
    }
  }

  /**
   * Reconcile durable timers against the actor's *current* pending `after`
   * transitions. This is the durability fix: xstate does not persist or re-arm
   * `after` timers across resume, but the rehydrated actor's active states still
   * declare them ({@link MachineHandle.pendingAfterTransitions}, carrying
   * xstate's real delay-event type). We schedule a durable timer per pending
   * transition keyed on that real event type, and cancel any durable timer that
   * is no longer pending (the state was left before it fired).
   *
   * A durable timer's id is its real delay-event type — stable across resume —
   * so re-running this is idempotent: the same pending transition maps to the
   * same timer id. `nowMs` (default wall-clock) anchors `fireAt`; on resume we
   * cannot recover the original arm time, so the remaining delay is measured
   * from now (an `after X` survives as "X from when the machine came back up",
   * which is the correct durable-resume semantics — a hibernated DO that wakes
   * re-arms its outstanding deadline).
   */
  private async syncTimers(handle: MachineHandle, nowMs: number = Date.now()): Promise<void> {
    const machineId = handle.machineId
    const pending = handle.pendingAfterTransitions()
    const wanted = new Map(pending.map((t) => [t.eventType, t] as const))

    // Cancel durable timers that are no longer pending (state left before fire),
    // but never cancel a still-pending one (that is the resume defect this fixes).
    for (const existing of await this.storage.getTimers(machineId)) {
      if (!wanted.has(existing.id)) {
        await this.storage.cancelTimer(machineId, existing.id)
      }
    }

    // Schedule a durable timer per pending after-transition, keyed on xstate's
    // real delay-event type so a resumed actor responds when we deliver it.
    const current = new Map((await this.storage.getTimers(machineId)).map((t) => [t.id, t]))
    for (const [eventType, t] of wanted) {
      if (current.has(eventType)) continue // already armed; keep its fireAt
      await this.storage.scheduleTimer(machineId, {
        id: eventType,
        fireAt: nowMs + t.delay,
        event: { type: eventType },
      })
    }
  }

  /**
   * Boot (or return the already-booted) actor. Resumes from the stored snapshot
   * if one exists. Idempotent — safe to call from `fetch()` and `alarm()`.
   */
  protected async ensureStarted(): Promise<MachineHandle> {
    if (this.handle) return this.handle
    const boot = (this.boot ??= this.describeMachine())
    const existing = await this.storage.getSnapshot(boot.machineId)

    this.handle = await runMachine(boot.machine, this.storage, {
      machineId: boot.machineId,
      resume: existing ? true : false,
      clock: this.noopClock(),
    })

    // Reconcile durable timers against the actor's pending `after` transitions.
    // On a FRESH start this arms the initial state's timers; on RESUME (after
    // hibernation/eviction) this re-arms still-pending timers that xstate did
    // not restore — the core durability fix. Pending durable timers are never
    // deleted here, only reconciled.
    await this.syncTimers(this.handle)
    return this.handle
  }

  /**
   * Drop the in-memory actor + handle so the next `ensureStarted()` rebuilds a
   * FRESH actor from durable storage — simulating DO hibernation / eviction,
   * where all in-memory state (the actor, any closures) is lost while
   * `state.storage` (snapshot, events, timers) survives. The durable rows are
   * untouched. Intended for tests that must prove an `after` timer fires after
   * reconstruction without relying on any surviving in-memory callback.
   */
  protected forgetInMemoryState(): void {
    this.handle?.stop()
    this.handle = undefined
  }

  /**
   * Cloudflare DO `alarm()` handler. Resolves which timers are due (`fireAt <=
   * now`) and **sends each timer's real delay-event into the actor** (xstate's
   * generated `xstate.after.*` event), which then takes the `after` transition
   * normally — even when the actor was just reconstructed and no in-memory
   * callback survives. After delivery it reconciles timers against the actor's
   * new pending set (arming any newly-entered state's delays, dropping fired
   * ones) and reschedules the alarm.
   */
  async alarm(): Promise<void> {
    const handle = await this.ensureStarted()
    const machineId = handle.machineId
    const timers = await this.storage.getTimers(machineId)
    if (timers.length === 0) return

    // The DO arms its alarm at the *earliest* pending `fireAt`; the alarm firing
    // is the signal that that deadline has arrived. Fire every timer due at-or-
    // before that earliest deadline (using the later of it and wall-clock `now`,
    // so a batch sharing the earliest deadline all fire), leaving strictly-later
    // timers pending for the next alarm.
    const earliest = timers.reduce((min, t) => (t.fireAt < min ? t.fireAt : min), timers[0]!.fireAt)
    const threshold = Math.max(Date.now(), earliest)
    const due = timers.filter((t) => t.fireAt <= threshold)

    for (const timer of due) {
      // Remove the fired durable timer first (at-most-once delivery for this
      // deadline), then deliver xstate's real delay-event into the actor.
      await this.storage.cancelTimer(machineId, timer.id)
      handle.send(timer.event as { type: string } & Record<string, unknown>)
    }

    // Reconcile timers against the post-transition active states: the `after`
    // transition may have entered a new state with its own `after` delays, and
    // the fired transitions' timers are gone. This also re-arms the DO alarm.
    await this.syncTimers(handle)

    // Persist the post-alarm snapshot (the actor's subscription persists on
    // transition, but capture once more to be safe / for cases that no-op).
    await this.storage.setSnapshot(machineId, handle.getPersistedSnapshot())
  }

  /**
   * Cloudflare DO `fetch()` handler. Accepts an external event as a JSON POST
   * (`{ type, ...payload }`), sends it into the running actor, persists the
   * resulting snapshot, and returns the new state value.
   *
   * `GET` returns the current state value and persisted snapshot for inspection.
   */
  async fetch(request: Request): Promise<Response> {
    const handle = await this.ensureStarted()

    if (request.method === 'GET') {
      return jsonResponse({
        machineId: handle.machineId,
        state: handle.getState(),
        snapshot: handle.getPersistedSnapshot(),
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'invalid JSON body' }, 400)
    }

    if (!isEventLike(body)) {
      return jsonResponse({ error: 'event must be an object with a string `type`' }, 400)
    }

    handle.send(body)
    // An external event may enter a state with `after` delays (or leave one),
    // so reconcile durable timers against the new active states. This arms the
    // DO alarm for any newly-pending `after` transition.
    await this.syncTimers(handle)
    // The actor's transition subscription persists asynchronously; capture the
    // post-send snapshot explicitly so the response and storage agree.
    await this.storage.setSnapshot(handle.machineId, handle.getPersistedSnapshot())

    return jsonResponse({
      machineId: handle.machineId,
      state: handle.getState(),
    })
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

/** Narrow an arbitrary parsed body to an xstate-sendable event. */
function isEventLike(value: unknown): value is { type: string } & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}

/** JSON `Response` with the right content-type. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
