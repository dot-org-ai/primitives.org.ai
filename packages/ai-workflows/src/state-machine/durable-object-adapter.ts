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
 *   - **Timers via alarms** — supplies xstate a {@link ClockLike} whose
 *     `setTimeout` records a durable timer (through the storage adapter, which
 *     arms `state.storage.setAlarm`) and remembers the delayed-event callback;
 *     `clearTimeout` cancels the timer. The DO `alarm()` resolves which timers
 *     are due, invokes their callbacks (delivering the delay event to the
 *     actor), then reschedules to the next-earliest.
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

  /**
   * Live delayed-event callbacks keyed by their durable timer id. xstate's
   * clock hands us the callback when it schedules a delayed transition; the
   * alarm handler invokes it to deliver the delay event into the actor.
   */
  private readonly timerCallbacks = new Map<string, () => void>()

  /** Monotonic source of unique timer ids within this instance. */
  private timerSeq = 0

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
   * The xstate {@link ClockLike} that routes delayed transitions through durable
   * timers and the DO alarm. Each `setTimeout(fn, delayMs)` records a timer with
   * `fireAt = now + delayMs` and remembers `fn`; the alarm fires it.
   */
  private makeClock(machineId: string): ClockLike {
    // Arrow functions keep `this` bound to the host instance (no aliasing).
    return {
      setTimeout: (fn: (...args: unknown[]) => void, timeoutMs: number): unknown => {
        const id = `after:${++this.timerSeq}`
        const fireAt = Date.now() + timeoutMs
        this.timerCallbacks.set(id, () => fn())
        // The delay event is xstate-internal; we persist the timer with a
        // synthetic record so the durable log shows a pending after-transition.
        void this.storage.scheduleTimer(machineId, {
          id,
          fireAt,
          event: { type: `xstate.after:${id}` },
        })
        return id
      },
      clearTimeout: (handle: unknown): void => {
        const id = String(handle)
        this.timerCallbacks.delete(id)
        void this.storage.cancelTimer(machineId, id)
      },
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

    // On resume, xstate re-schedules every still-pending `after` transition via
    // our clock when the rehydrated actor starts (it persists `_scheduledEvents`
    // in the snapshot and re-arms them with fresh clock handles). Clear the prior
    // run's durable timer records first so they don't accumulate as stale entries
    // — the starting actor re-arms exactly the delays it still needs.
    if (existing) {
      for (const timer of await this.storage.getTimers(boot.machineId)) {
        await this.storage.cancelTimer(boot.machineId, timer.id)
      }
    }

    this.handle = await runMachine(boot.machine, this.storage, {
      machineId: boot.machineId,
      resume: existing ? true : false,
      clock: this.makeClock(boot.machineId),
    })
    return this.handle
  }

  /**
   * Cloudflare DO `alarm()` handler. Resolves which timers are due (`fireAt <=
   * now`), invokes their delayed-event callbacks (delivering the after-transition
   * event into the actor), removes the fired timers, then reschedules the alarm
   * to the next-earliest pending timer.
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
      const cb = this.timerCallbacks.get(timer.id)
      // Remove the durable timer record (also reschedules the alarm).
      await this.storage.cancelTimer(machineId, timer.id)
      this.timerCallbacks.delete(timer.id)
      // Fire the delayed transition into the actor.
      if (cb) cb()
    }

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
