/**
 * services-as-software v4 — the Invocation RUNTIME (aip-cnks.7.4).
 *
 * The TYPE surface for invocation (the 11-literal {@link InvocationState} union,
 * {@link Terminal}, {@link InvocationEvent}, {@link InvocationHandle},
 * {@link Settlement}, {@link VerificationVerdict}, …) lives in `./types.ts`.
 * This module is the *values* that make those types usable:
 *
 *   1. The {@link VALID_TRANSITIONS} table — the 11-state FSM as data.
 *   2. {@link canTransition} / {@link isTerminal} / {@link assertTransition} —
 *      the guards every drive verb passes through.
 *   3. {@link createInvocationHandle} — an in-memory {@link InvocationHandle}
 *      scaffold that drives the FSM, emits the {@link InvocationEvent} spine,
 *      and exposes the observe / await / drive surface.
 *
 * **What is real here vs. what awaits `aip-cnks.5`.** The FSM mechanics + the
 * handle plumbing (event fan-out, `state()`, `watch`, `result`/`quality`/
 * `settled` promises, the drive verbs guarded by {@link canTransition}) are
 * fully implemented. The three *content* steps that ride the FSM — cascade
 * EXECUTION (`DELIVERING`), 3-rater VERIFICATION (`QUALITY_REVIEW`), and finance
 * SETTLEMENT (`ACCEPTED`/`REFUNDED`) — depend on the `aip-cnks.5` cascade
 * substrate (ai-workflows) and the `business-as-code/finance` merchant ports,
 * neither of which is wired here. They are modelled as INJECTED PORTS
 * ({@link CascadeExecutor} / {@link Verifier} / {@link Settler}) that default to
 * deterministic in-memory stubs. The defaults do NOT fake a real cascade — they
 * return the no-op / pass-through shapes so the FSM can be exercised end-to-end
 * in tests. Replace the defaults with real ports when aip-cnks.5 lands.
 *
 * @packageDocumentation
 */

import type { Money } from 'business-as-code/finance'

import type {
  Assurance,
  EscalationReason,
  EscalationResolution,
  InvocationEvent,
  InvocationHandle,
  InvocationState,
  OfferOf,
  OrderOpts,
  PricingBasis,
  Settled,
  Settlement,
  Terminal,
  VerificationVerdict,
} from './types.js'

// ============================================================================
// The FSM as data — VALID_TRANSITIONS
// ============================================================================

/**
 * The 11-state delivery FSM, exactly per ADR-0011 §4 / the design sketch.
 *
 *   ORDERED → ONBOARDING → ACTIVE → DELIVERING → QUALITY_REVIEW → DELIVERED
 *           → ACCEPTED                                          (happy path)
 *
 * with `CANCELLED` / `ESCALATED` / `ERROR` / `REFUNDED` / `DISPUTED` as the
 * branch + terminal states. `ACCEPTED`, `CANCELLED`, `REFUNDED` are terminal
 * (empty out-edge lists). This is the single source of truth consumed by
 * {@link canTransition}, {@link assertTransition}, and the handle's drive verbs.
 */
export const VALID_TRANSITIONS: Readonly<Record<InvocationState, readonly InvocationState[]>> = {
  ORDERED: ['ONBOARDING', 'CANCELLED', 'ERROR'],
  ONBOARDING: ['ACTIVE', 'CANCELLED', 'ESCALATED', 'ERROR'],
  ACTIVE: ['DELIVERING', 'CANCELLED', 'ESCALATED', 'ERROR'],
  DELIVERING: ['QUALITY_REVIEW', 'ESCALATED', 'ERROR'],
  QUALITY_REVIEW: ['DELIVERED', 'ESCALATED', 'ERROR'],
  DELIVERED: ['ACCEPTED', 'DISPUTED'],
  ESCALATED: ['ACTIVE', 'CANCELLED', 'REFUNDED'],
  ERROR: ['REFUNDED', 'DISPUTED'],
  DISPUTED: ['REFUNDED', 'ACCEPTED'],
  ACCEPTED: [],
  CANCELLED: [],
  REFUNDED: [],
}

// ============================================================================
// FSM predicates + guard
// ============================================================================

/** The three terminal states (no outbound transitions). */
const TERMINAL_STATES: ReadonlySet<InvocationState> = new Set<Terminal>([
  'ACCEPTED',
  'CANCELLED',
  'REFUNDED',
])

/**
 * True iff `from → to` is a legal edge in {@link VALID_TRANSITIONS}.
 *
 * Used at the FSM boundary so an out-of-band drive (a duplicate `accept()`, a
 * `dispute()` from `ORDERED`, a stale resume) is rejected rather than silently
 * corrupting state.
 */
export function canTransition(from: InvocationState, to: InvocationState): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

/** Type guard: `s` is one of the three {@link Terminal} states. */
export function isTerminal(s: InvocationState): s is Terminal {
  return TERMINAL_STATES.has(s)
}

/** Thrown by {@link assertTransition} when a drive attempts an illegal edge. */
export class IllegalTransitionError extends Error {
  readonly from: InvocationState
  readonly to: InvocationState
  constructor(from: InvocationState, to: InvocationState) {
    super(`illegal FSM transition: ${from} → ${to}`)
    this.name = 'IllegalTransitionError'
    this.from = from
    this.to = to
  }
}

/**
 * Assert `from → to` is legal, throwing {@link IllegalTransitionError}
 * otherwise. The mutating form of {@link canTransition}: the handle's
 * `_transition` helper calls this so an illegal drive fails loudly.
 */
export function assertTransition(from: InvocationState, to: InvocationState): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to)
  }
}

// ============================================================================
// Injected ports — the cascade / verify / settle seams (awaits aip-cnks.5)
// ============================================================================

/**
 * Cascade EXECUTION port — drives the `DELIVERING` phase, producing the typed
 * `TOut` and emitting `cascade-progress` / `cost-incurred` / `preview-available`
 * events along the way.
 *
 * awaits aip-cnks.5 — the real executor runs the Deliverable's `binding.cascade`
 * over JSON steps with `$ref` resolution via the ai-workflows cascade substrate
 * (ADR-0010 / ai-evaluate V8-isolate sandbox). The default
 * {@link stubExecutor} returns the supplied seed output with no cost and no
 * intermediate events — enough to exercise the FSM, never a real cascade.
 */
export interface CascadeExecutor<TIn, TOut> {
  execute(ctx: ExecCtx<TIn, TOut>): Promise<TOut>
}

/** The context a {@link CascadeExecutor} runs against. */
export interface ExecCtx<TIn, TOut> {
  input: TIn
  /** Emit any non-state-changing {@link InvocationEvent} (progress/cost/preview). */
  emit(event: InvocationEvent<TOut>): void
  /** Running cost accumulator the handle exposes via `costSoFar()`. */
  cost: Money
}

/**
 * VERIFICATION port — drives the `QUALITY_REVIEW` phase: runs the acceptance
 * Metric through the 3-rater panel and rolls the verdicts up.
 *
 * awaits aip-cnks.5 — the real verifier dispatches the 3 raters (and binds to
 * the acceptance predicates from the OutcomeContract). The default
 * {@link stubVerifier} returns a single deterministic `auto-promote` verdict at
 * the requested `assurance` — a pass-through, not a real panel.
 */
export interface Verifier {
  verify(ctx: VerifyCtx): Promise<VerificationVerdict>
}

/** The context a {@link Verifier} runs against. */
export interface VerifyCtx {
  metric: string
  assurance: Assurance
}

/**
 * SETTLEMENT port — drives the terminal `ACCEPTED` / `REFUNDED` phases: charges
 * or refunds via the finance firmware.
 *
 * awaits aip-cnks.5 — the real settler calls the `business-as-code/finance`
 * Merchant / FinanceProvider ports against the OutcomeContract + RefundContract.
 * The default {@link stubSettler} returns the matching `Settlement` shape with a
 * zero `Money` capture — a no-op, not a real charge.
 */
export interface Settler {
  charge(basis: PricingBasis): Promise<Settlement>
  refund(): Promise<Settlement>
}

const ZERO_MONEY: Money = { amount: 0n, currency: 'USD' }

/** Default no-op executor — returns the seeded output, emits nothing. */
function stubExecutor<TIn, TOut>(seed: TOut): CascadeExecutor<TIn, TOut> {
  return {
    async execute() {
      // awaits aip-cnks.5 — no real cascade; the seeded output is returned as-is.
      return seed
    },
  }
}

/** Default pass-through verifier — one deterministic `auto-promote` verdict. */
function stubVerifier(): Verifier {
  return {
    async verify(ctx: VerifyCtx): Promise<VerificationVerdict> {
      // awaits aip-cnks.5 — no real 3-rater panel; a single auto-promote stub.
      const pass = {
        rater: 'stub',
        verdict: 'pass' as const,
        rationale: '(stub) awaits aip-cnks.5 rater panel',
      }
      return {
        metric: ctx.metric,
        raters: [pass, pass, pass],
        rollup: 'auto-promote',
        assuranceAchieved: ctx.assurance,
      }
    },
  }
}

/** Default no-op settler — zero-Money charge / refund of the matching shape. */
function stubSettler(): Settler {
  return {
    async charge(basis: PricingBasis): Promise<Settlement> {
      // awaits aip-cnks.5 — no real finance capture; a zero-Money charge stub.
      return { outcome: 'charged', captured: ZERO_MONEY, basis, contract: 'stub:outcome-contract' }
    },
    async refund(): Promise<Settlement> {
      // awaits aip-cnks.5 — no real finance refund; a zero-Money refund stub.
      return { outcome: 'refunded', amount: ZERO_MONEY, per: 'stub:refund-contract' }
    },
  }
}

// ============================================================================
// createInvocationHandle — the in-memory handle scaffold
// ============================================================================

/** Options that configure a {@link createInvocationHandle} scaffold. */
export interface CreateHandleOpts<TIn, TOut> {
  /** Stable invocation `$id`. Minted if omitted. */
  id?: string
  /** The Offer this invocation runs against (carries the typed `TOut`). */
  offer: OfferOf<TOut>
  /** assurance→gatingBasis ceiling computed at ORDER (the rung settlement gates at). */
  ceiling: PricingBasis
  /** The typed input the cascade executes over. */
  input: TIn
  /** Order-time options (budget, autoAccept, gateAt, …). */
  orderOpts?: OrderOpts
  /** The acceptance Metric ref verified at QUALITY_REVIEW. */
  metric?: string
  /** The assurance grade the verifier attests. */
  assurance?: Assurance
  /**
   * The output the (stub) cascade resolves to. Required for the default stub
   * executor; ignored once a real {@link CascadeExecutor} is injected.
   */
  seedOutput?: TOut

  // ── injected ports (default to in-memory stubs; awaits aip-cnks.5) ──
  executor?: CascadeExecutor<TIn, TOut>
  verifier?: Verifier
  settler?: Settler
  /**
   * Auto-drive the happy path on creation: ORDERED→…→DELIVERED. The buyer then
   * drives the terminal `accept()` / `dispute()`. Defaults to `true`.
   */
  autoStart?: boolean
}

/** A minimal Deferred — exposes `resolve`/`reject` on the surrounding scope. */
interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
  settled: boolean
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const d = { settled: false } as Deferred<T>
  d.promise = new Promise<T>((res, rej) => {
    resolve = (v) => {
      d.settled = true
      res(v)
    }
    reject = (e) => {
      d.settled = true
      rej(e)
    }
  })
  d.resolve = resolve
  d.reject = reject
  return d
}

/** Per-iterator subscription over the event spine — queue + pending waiters. */
interface Subscription<TOut> {
  queue: InvocationEvent<TOut>[]
  waiters: Array<(r: IteratorResult<InvocationEvent<TOut>>) => void>
  done: boolean
}

function mintInvocationId(): string {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 0xffffff).toString(36)
  return `inv:${t}-${r}`
}

/**
 * Mint an in-memory {@link InvocationHandle} scaffold and (optionally) drive it
 * through the FSM happy path. Returns synchronously so a caller can subscribe to
 * `handle.events` before the first event fires.
 *
 * The handle is a subscriber fan-out: each `events[Symbol.asyncIterator]()` call
 * gets its own queue, so concurrent consumers don't steal events from each
 * other. `history()` records every emitted event for replay.
 *
 * The cascade / verify / settle steps run through the injected ports (defaulting
 * to deterministic in-memory stubs — see the module docblock). When aip-cnks.5
 * lands, inject the real executor / verifier / settler.
 */
export function createInvocationHandle<TIn, TOut>(
  opts: CreateHandleOpts<TIn, TOut>
): InvocationHandle<TOut> {
  const id = opts.id ?? mintInvocationId()
  const executor = opts.executor ?? stubExecutor<TIn, TOut>(opts.seedOutput as TOut)
  const verifier = opts.verifier ?? stubVerifier()
  const settler = opts.settler ?? stubSettler()
  const metric = opts.metric ?? 'stub:metric'
  const assurance: Assurance = opts.assurance ?? 'unverifiable'
  const autoStart = opts.autoStart ?? true

  // ── mutable runtime state ──
  let state: InvocationState = 'ORDERED'
  let cost: Money = { ...ZERO_MONEY }
  const log: InvocationEvent<TOut>[] = []
  const previewAcc: Partial<TOut> = {}
  const subs = new Set<Subscription<TOut>>()

  const resultD = deferred<TOut>()
  const qualityD = deferred<VerificationVerdict>()
  const settledD = deferred<Settlement>()

  // Attach inert catch handlers so a rejection (e.g. an executor failure that
  // settles `result`/`quality` before any consumer attaches) never surfaces as
  // an unhandled rejection. Real awaiters still observe the rejection.
  resultD.promise.catch(() => {})
  qualityD.promise.catch(() => {})
  settledD.promise.catch(() => {})

  // ── event spine ──
  function emit(event: InvocationEvent<TOut>): void {
    log.push(event)
    if (event.kind === 'cost-incurred') cost = event.cumulative
    if (event.kind === 'preview-available') Object.assign(previewAcc, event.payload)
    if (event.kind === 'delivered' && !resultD.settled) resultD.resolve(event.output)
    if (event.kind === 'evaluator-signoff' && !qualityD.settled) qualityD.resolve(event.panel)
    if (event.kind === 'settled' && !settledD.settled) settledD.resolve(event.settlement)

    for (const sub of subs) {
      const waiter = sub.waiters.shift()
      if (waiter) waiter({ value: event, done: false })
      else sub.queue.push(event)
    }
  }

  function closeStream(): void {
    for (const sub of subs) {
      sub.done = true
      while (sub.waiters.length > 0) sub.waiters.shift()!({ value: undefined, done: true })
    }
  }

  /** Guarded state advance: asserts the edge then emits `state-changed`. */
  function go(to: InvocationState, trigger: string): void {
    assertTransition(state, to)
    const from = state
    state = to
    emit({ kind: 'state-changed', from, to, at: new Date(), trigger })
    if (isTerminal(to)) closeStream()
  }

  // ── drive: the happy path (ORDERED → … → DELIVERED) ──
  async function start(): Promise<void> {
    try {
      go('ONBOARDING', 'order-accepted')
      go('ACTIVE', 'onboarding-complete')
      go('DELIVERING', 'cascade-start')

      // DELIVERING — cascade EXECUTION via injected port (awaits aip-cnks.5).
      const output = await executor.execute({ input: opts.input, emit, cost })

      // QUALITY_REVIEW — 3-rater VERIFICATION via injected port (awaits aip-cnks.5).
      go('QUALITY_REVIEW', 'cascade-complete')
      const panel = await verifier.verify({ metric, assurance })
      emit({ kind: 'evaluator-signoff', panel })

      // DELIVERED — the buyer now drives accept() / dispute().
      go('DELIVERED', panel.rollup === 'auto-promote' ? 'evaluators-approved' : 'evaluators-queued')
      emit({ kind: 'delivered', output, assurance: panel.assuranceAchieved })

      // autoAccept convenience (boolean true or a predicate over the verdict).
      const auto = opts.orderOpts?.autoAccept
      const shouldAuto = typeof auto === 'function' ? auto(panel) : auto === true
      if (shouldAuto && state === 'DELIVERED') await drive.accept()
    } catch (err) {
      fail(err)
    }
  }

  /** Route a thrown cascade error into the ERROR state + a `failed` event. */
  function fail(err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err)
    if (canTransition(state, 'ERROR')) {
      go('ERROR', 'failure')
      emit({ kind: 'failed', reason: 'cascade-error', detail })
    }
    if (!resultD.settled) resultD.reject(err instanceof Error ? err : new Error(detail))
    if (!qualityD.settled) qualityD.reject(err instanceof Error ? err : new Error(detail))
  }

  // ── drive verbs (each guarded by canTransition) ──
  const drive = {
    async accept(): Promise<Settlement> {
      go('ACCEPTED', 'buyer-accept')
      const settlement = await settler.charge(opts.ceiling)
      emit({ kind: 'settled', settlement })
      return settlement
    },
    async dispute(reason: string): Promise<void> {
      go('DISPUTED', 'buyer-dispute')
      emit({ kind: 'failed', reason: 'buyer-dispute', detail: reason })
    },
    async escalate(reason: EscalationReason): Promise<void> {
      go('ESCALATED', 'escalate')
      emit({ kind: 'escalated', reason })
    },
    async resolve(r: EscalationResolution): Promise<Settlement> {
      if (r === 'resume') {
        go('ACTIVE', 'escalation-resume')
        // The FSM edge ESCALATED→ACTIVE is taken, but re-driving the delivery
        // tail from ACTIVE (cascade → verify → settle) is not wired here — it
        // needs the resumable durable cascade. Rather than hand back a promise
        // that never resolves, REJECT explicitly (same `awaits aip-cnks.5`
        // pattern as attach() / Service.load()). cancel/refund resolve fully.
        return Promise.reject(
          new Error('resolve("resume") awaits aip-cnks.5 — resumable delivery tail not yet wired')
        )
      }
      if (r === 'cancel') {
        go('CANCELLED', 'escalation-cancel')
        const settlement: Settlement = { outcome: 'noop', reason: 'cancelled-pre-charge' }
        emit({ kind: 'settled', settlement })
        return settlement
      }
      // refund
      go('REFUNDED', 'escalation-refund')
      const settlement = await settler.refund()
      emit({ kind: 'settled', settlement })
      return settlement
    },
    async cancel(reason?: string): Promise<void> {
      go('CANCELLED', 'buyer-cancel')
      emit({ kind: 'settled', settlement: { outcome: 'noop', reason: 'cancelled-pre-charge' } })
      if (reason && !resultD.settled) resultD.reject(new Error(`cancelled: ${reason}`))
    },
  }

  // ── observe surface ──
  function makeIterator(): AsyncIterator<InvocationEvent<TOut>> {
    const sub: Subscription<TOut> = { queue: [], waiters: [], done: false }
    subs.add(sub)
    return {
      next() {
        if (sub.queue.length > 0) return Promise.resolve({ value: sub.queue.shift()!, done: false })
        if (sub.done) return Promise.resolve({ value: undefined as never, done: true })
        return new Promise<IteratorResult<InvocationEvent<TOut>>>((resolve) => {
          sub.waiters.push(resolve)
        })
      },
      return() {
        // Iterator detach: subscription-teardown only; the run keeps going.
        subs.delete(sub)
        sub.done = true
        while (sub.waiters.length > 0)
          sub.waiters.shift()!({ value: undefined as never, done: true })
        return Promise.resolve({ value: undefined as never, done: true })
      },
    }
  }

  const handle: InvocationHandle<TOut> = {
    id,
    offer: opts.offer,
    ceiling: opts.ceiling,

    state: () => state,
    events: { [Symbol.asyncIterator]: () => makeIterator() },
    watch(...states: InvocationState[]): Promise<InvocationState> {
      if (states.includes(state)) return Promise.resolve(state)
      return new Promise<InvocationState>((resolve) => {
        void (async () => {
          for await (const event of { [Symbol.asyncIterator]: () => makeIterator() }) {
            if (event.kind === 'state-changed' && states.includes(event.to)) {
              resolve(event.to)
              return
            }
          }
          // Stream closed without hitting a watched state — resolve at terminal.
          resolve(state)
        })()
      })
    },
    costSoFar: () => cost,
    previews: () => ({ ...previewAcc }),
    history: () => log.slice(),

    result: resultD.promise,
    quality: qualityD.promise,
    settled: () => settledD.promise,

    clarify(reply: { requestId: string; choice?: string; payload?: unknown }): Promise<void> {
      // awaits aip-cnks.5 — no paused cascade to resume; recorded for the inbox.
      void reply
      return Promise.resolve()
    },
    accept: () => drive.accept(),
    dispute: (reason: string) => drive.dispute(reason),
    escalate: (reason: EscalationReason) => drive.escalate(reason),
    resolve: (r: EscalationResolution) => drive.resolve(r),
    cancel: (reason?: string) => drive.cancel(reason),
  }

  if (autoStart) queueMicrotask(() => void start())

  return handle
}

// ============================================================================
// reconcile — fire-and-forget convenience over the handle (Settled<TOut>)
// ============================================================================

/**
 * Drive a freshly-created handle to a terminal state and collapse it to a
 * {@link Settled} record. Auto-accepts at `DELIVERED` (the fire-and-forget
 * contract: order → settle, no buyer round-trip), then awaits settlement.
 */
export async function reconcileHandle<TOut>(
  handle: InvocationHandle<TOut>
): Promise<Settled<TOut>> {
  // Park until the run reaches DELIVERED (or a terminal), then accept if able.
  await handle.watch('DELIVERED', 'ACCEPTED', 'CANCELLED', 'REFUNDED', 'ERROR', 'DISPUTED')
  if (handle.state() === 'DELIVERED') await handle.accept()
  const settlement = await handle.settled()
  let output: TOut | undefined
  let verification: VerificationVerdict | undefined
  try {
    output = await handle.result
  } catch {
    output = undefined
  }
  try {
    verification = await handle.quality
  } catch {
    verification = undefined
  }
  return {
    state: handle.state() as Terminal,
    ...(output !== undefined ? { output } : {}),
    ...(verification !== undefined ? { verification } : {}),
    settlement,
  }
}

// ============================================================================
// attach — reconnect to a durable run (awaits aip-cnks.5)
// ============================================================================

/**
 * Reconnect to a durable invocation by id. awaits aip-cnks.5 — the durable
 * server-side FSM (CF Workflows per ADR-0004) is not wired; this is the thin
 * view seam the durable adapter will back.
 */
export function attach<TOut>(id: string): Promise<InvocationHandle<TOut>> {
  return Promise.reject(
    new Error(`attach(${id}) awaits aip-cnks.5 — durable FSM adapter not yet wired`)
  )
}
