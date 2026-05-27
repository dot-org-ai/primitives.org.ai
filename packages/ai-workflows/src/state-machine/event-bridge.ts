/**
 * Event bridge - bidirectional wiring between an xstate actor and the
 * `ai-workflows` event bus.
 *
 * ADR-0011 makes event integration **bidirectional** and explicitly forbids
 * inventing new event primitives — state-machine transitions ride the existing
 * `on` / `send` surface. This module is the thin shell that does that wiring:
 *
 *   - **Inbound** — bus events (delivered by `send()`, Worker action returns,
 *     webhooks, timers) whose `Noun.event` name matches a configured inbound
 *     pattern translate to `actor.send({ type, ...payload })`. The pattern →
 *     event-type mapping is the `eventBus.inbound` block described below.
 *
 *   - **Outbound** — when the actor *enters* a state configured for emission,
 *     the bridge `send()`s an Action onto the bus, so other workflows / Workers
 *     consume it through the same `on(...)` surface they already use. The
 *     mapping from active-state value → bus event is the `eventBus.outbound`
 *     block.
 *
 *   - **Lifecycle** — {@link bridgeMachineToEventBus} subscribes on call and
 *     returns a disposer. Calling the disposer (or stopping the machine, which
 *     the bridge observes) removes **only** this bridge's bus subscriptions and
 *     unsubscribes from the actor — no leaked listeners across machine stop,
 *     and no disturbance to the rest of the global bus.
 *
 * The bridge composes against the spine's {@link MachineHandle} rather than
 * reaching into xstate, and against the existing `on` / `send` rather than a
 * new bus. It is a standalone composable function so {@link
 * import('./runtime.js').runMachine | runMachine} stays minimal — callers opt
 * into the bridge explicitly.
 *
 * ## Why a `removeEventHandler` was added to `on.ts`
 *
 * The global bus only exposed `registerEventHandler` and the blunt
 * `clearEventHandlers()` (which removes *everyone's* handlers). Clean,
 * leak-free, per-bridge teardown needs the inverse of `registerEventHandler` —
 * remove a single handler by identity. That inverse (`removeEventHandler`) is
 * the same primitive family, not a new event concept, so it stays within the
 * "no new event primitives" constraint.
 *
 * @packageDocumentation
 */

import type { AnyMachineSnapshot, EventObject, StateValue } from 'xstate'
import type { EventHandler, WorkflowContext } from '../types.js'
import { registerEventHandler, removeEventHandler } from '../on.js'
import { send as globalSend } from '../send.js'
import type { MachineHandle } from './runtime.js'

// =============================================================================
// Config shape
// =============================================================================

/**
 * One inbound mapping: a bus `Noun.event` pattern → an actor event.
 *
 * The matched bus payload is forwarded to the actor. By default the bus
 * payload becomes the body of the actor event (`{ type, ...payload }`); supply
 * {@link InboundMapping.mapPayload} to reshape it.
 */
export interface InboundMapping {
  /**
   * The xstate event `type` to send to the actor (e.g. `'REVIEW_COMPLETED'`).
   */
  readonly type: string

  /**
   * Optional transform from the bus payload to the actor-event body. The
   * returned object is spread onto `{ type }`. Defaults to passing the bus
   * payload through unchanged (objects are spread; non-objects are dropped).
   */
  readonly mapPayload?: (payload: unknown) => Record<string, unknown>
}

/**
 * One outbound mapping: an active-state value → a bus event.
 *
 * When the actor enters the keyed state, the bridge `send()`s `event` (a
 * `Noun.event` string) onto the bus with a payload. The state key is matched
 * with the snapshot's `matches(...)` predicate, so it supports nested keys
 * (`'review.awaiting'`) and parallel-region keys exactly as xstate does.
 */
export interface OutboundMapping {
  /** The bus event name to emit, in `Noun.event` form (e.g. `'Review.requested'`). */
  readonly event: string

  /**
   * Optional builder for the bus payload from the actor snapshot. Defaults to
   * emitting `{ state, context }` — the entered state value and the machine
   * context at entry.
   */
  readonly buildPayload?: (snapshot: AnyMachineSnapshot) => unknown
}

/**
 * The `eventBus` config block. Declared as a top-level field on the machine
 * config / run options (decoupled from xstate's own `MachineConfig`, which has
 * no place for transport wiring) and handed to {@link bridgeMachineToEventBus}.
 *
 * @example
 * ```ts
 * const eventBus: MachineEventBusConfig = {
 *   inbound: {
 *     // a bus `Worker.reviewCompleted` message becomes
 *     // actor.send({ type: 'REVIEW_COMPLETED', ...payload })
 *     'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' },
 *   },
 *   outbound: {
 *     // entering the `requestingReview` state emits `Review.requested`
 *     requestingReview: { event: 'Review.requested' },
 *   },
 * }
 * ```
 */
export interface MachineEventBusConfig {
  /** Bus `Noun.event` pattern → actor event. Empty / omitted = no inbound wiring. */
  readonly inbound?: Readonly<Record<string, InboundMapping>>
  /** Active-state value → bus `Noun.event`. Empty / omitted = no outbound wiring. */
  readonly outbound?: Readonly<Record<string, OutboundMapping>>
}

/**
 * Options for {@link bridgeMachineToEventBus}.
 */
export interface BridgeMachineToEventBusOptions extends MachineEventBusConfig {
  /**
   * Bus injection seam. Defaults to the global `send` from `send.ts` and the
   * global `registerEventHandler` / `removeEventHandler` from `on.ts` — the
   * exact bus `send()` and `on(...)` use. Override only for tests that want an
   * isolated bus.
   */
  readonly bus?: EventBusPort
}

/**
 * The slice of the event bus the bridge programs against — the inbound
 * registration pair (`register` / `remove`, the identity-keyed inverse pair
 * from `on.ts`) and the outbound `send`. Defaults to the global bus; injectable
 * for tests.
 */
export interface EventBusPort {
  /** Register an inbound handler under a `Noun.event` pair (mirrors `registerEventHandler`). */
  register(noun: string, event: string, handler: EventHandler): void
  /** Remove a previously-registered inbound handler by identity (mirrors `removeEventHandler`). */
  remove(noun: string, event: string, handler: EventHandler): void
  /** Emit an outbound bus event (mirrors `send`). */
  send(event: string, data: unknown): void | Promise<void>
}

/**
 * Disposer returned by {@link bridgeMachineToEventBus}. Idempotent — calling it
 * more than once is a no-op after the first call.
 */
export type BridgeDisposer = () => void

// =============================================================================
// Helpers
// =============================================================================

/**
 * The default global bus port: inbound via `on.ts`'s identity-keyed
 * register/remove pair, outbound via `send.ts`'s `send`.
 */
const globalBusPort: EventBusPort = {
  register: registerEventHandler,
  remove: removeEventHandler,
  send: globalSend,
}

/** Split a `Noun.event` bus name into its parts; `null` for malformed input. */
function splitBusEvent(name: string): { noun: string; event: string } | null {
  const parts = name.split('.')
  if (parts.length !== 2) return null
  const [noun, event] = parts
  if (!noun || !event) return null
  return { noun, event }
}

/**
 * Flatten a {@link StateValue} into the set of leaf-path strings it represents,
 * so we can diff two snapshots and find which states were freshly entered.
 *
 * `'green'` → `['green']`; `{ review: 'awaiting' }` → `['review.awaiting']`;
 * `{ a: 'x', b: 'y' }` (parallel) → `['a.x', 'b.y']`. Both the leaf paths and
 * every ancestor prefix are included so an `outbound` key targeting a composite
 * parent (`'review'`) still matches when a child is entered.
 */
function flattenStateValue(value: StateValue, prefix = ''): string[] {
  if (typeof value === 'string') {
    return [prefix ? `${prefix}.${value}` : value]
  }
  const out: string[] = []
  for (const [key, child] of Object.entries(value)) {
    const here = prefix ? `${prefix}.${key}` : key
    out.push(here)
    out.push(...flattenStateValue(child as StateValue, here))
  }
  return out
}

/** Default inbound payload mapping: spread objects, drop non-objects. */
function defaultMapPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? { ...(payload as Record<string, unknown>) } : {}
}

// =============================================================================
// Entry point
// =============================================================================

/**
 * Wire a running machine (a {@link MachineHandle} from `runMachine`) to the
 * `ai-workflows` event bus, bidirectionally.
 *
 * Returns a {@link BridgeDisposer}; call it to tear down every subscription
 * this bridge created. The bridge also observes the actor and disposes itself
 * when the machine stops, so a leaked bus listener cannot outlive the machine.
 *
 * @param handle - the machine handle to bridge.
 * @param options - the `eventBus` config (`inbound` / `outbound`) plus an
 *   optional `bus` injection seam.
 *
 * @example
 * ```ts
 * const handle = await runMachine(reviewMachine, storage, { machineId: 'pr-1' })
 * const dispose = bridgeMachineToEventBus(handle, {
 *   inbound: { 'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' } },
 *   outbound: { requestingReview: { event: 'Review.requested' } },
 * })
 * // ... later, when done:
 * dispose()
 * ```
 */
export function bridgeMachineToEventBus(
  handle: MachineHandle,
  options: BridgeMachineToEventBusOptions = {}
): BridgeDisposer {
  const bus = options.bus ?? globalBusPort
  const inbound = options.inbound ?? {}
  const outbound = options.outbound ?? {}

  // ---------------------------------------------------------------------------
  // Inbound: bus pattern -> actor.send
  //
  // Each configured pattern registers a bus handler that forwards the matched
  // payload to the actor as a typed event. We keep references to the exact
  // handler functions so we can remove *only* ours on dispose.
  // ---------------------------------------------------------------------------

  const inboundRegistrations: Array<{ noun: string; event: string; handler: EventHandler }> = []

  for (const [pattern, mapping] of Object.entries(inbound)) {
    const parsed = splitBusEvent(pattern)
    if (!parsed) {
      throw new Error(
        `Invalid inbound bus pattern "${pattern}". Expected Noun.event (e.g. "Worker.reviewCompleted").`
      )
    }
    const mapPayload = mapping.mapPayload ?? defaultMapPayload
    // Handler signature is the bus's (data, $) — we ignore $ and forward to the actor.
    const handler: EventHandler = (data: unknown, _$: WorkflowContext) => {
      const event: EventObject = { type: mapping.type, ...mapPayload(data) }
      handle.send(event)
    }
    bus.register(parsed.noun, parsed.event, handler)
    inboundRegistrations.push({ noun: parsed.noun, event: parsed.event, handler })
  }

  // ---------------------------------------------------------------------------
  // Outbound: state entry -> bus send
  //
  // We watch snapshot changes via the handle's subscription (the same surface
  // the spine uses for persistence) and diff the active-state set between
  // snapshots. A state present now but not in the previous snapshot is a
  // freshly *entered* state; if it has an outbound mapping, we emit its event.
  // ---------------------------------------------------------------------------

  // Validate outbound targets up front so config errors surface immediately,
  // not on first transition.
  for (const [stateKey, mapping] of Object.entries(outbound)) {
    if (!splitBusEvent(mapping.event)) {
      throw new Error(
        `Invalid outbound bus event "${mapping.event}" for state "${stateKey}". ` +
          `Expected Noun.event (e.g. "Review.requested").`
      )
    }
  }

  let previousActive = new Set<string>(flattenStateValue(handle.getSnapshot().value))

  // Emit for any outbound state already active at bridge start (the initial
  // state), so a machine whose initial state is an emitting state is not
  // silently skipped.
  const emitFor = (snapshot: AnyMachineSnapshot, stateKeys: Iterable<string>) => {
    for (const stateKey of stateKeys) {
      const mapping = outbound[stateKey]
      if (!mapping) continue
      const payload = mapping.buildPayload
        ? mapping.buildPayload(snapshot)
        : { state: stateKey, context: snapshot.context }
      void bus.send(mapping.event, payload)
    }
  }

  emitFor(handle.getSnapshot(), previousActive)

  const subscription = handle.subscribe((snapshot) => {
    const active = new Set<string>(flattenStateValue(snapshot.value))
    const entered: string[] = []
    for (const stateKey of active) {
      if (!previousActive.has(stateKey)) entered.push(stateKey)
    }
    previousActive = active
    emitFor(snapshot, entered)
  })

  // ---------------------------------------------------------------------------
  // Lifecycle: dispose removes only this bridge's subscriptions. The bridge
  // also disposes itself when the actor reaches a final/stopped status, so a
  // stopped machine cannot leak a live bus listener.
  // ---------------------------------------------------------------------------

  let disposed = false
  let lifecycleSub: { unsubscribe(): void } | undefined

  const dispose: BridgeDisposer = () => {
    if (disposed) return
    disposed = true
    subscription.unsubscribe()
    lifecycleSub?.unsubscribe()
    for (const { noun, event, handler } of inboundRegistrations) {
      bus.remove(noun, event, handler)
    }
  }

  // Self-dispose when the machine stops. Two stop paths must both tear the
  // bridge down so a stopped machine never leaks a live bus listener:
  //   - a *done/error* transition surfaces as a snapshot with a non-'active'
  //     status through the observable's `next`;
  //   - an explicit `actor.stop()` completes the observable, surfaced through
  //     the observable's `complete` callback.
  // We subscribe to the actor directly (the handle exposes it) because the
  // handle's `subscribe` only forwards `next`, not `complete`. `dispose` is
  // fully defined above, so a synchronous emit on subscribe is safe.
  lifecycleSub = handle.actor.subscribe({
    next: (snapshot) => {
      if ((snapshot as AnyMachineSnapshot).status !== 'active') dispose()
    },
    complete: () => dispose(),
    error: () => dispose(),
  })

  return dispose
}
