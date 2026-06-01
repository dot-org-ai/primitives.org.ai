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
 * The cascade's typed `output` is threaded in (the thing being judged): the
 * panel rates the delivered `TOut` against the acceptance Metric, not an empty
 * envelope. The verifier is generic over `TOut` so a real rater can read the
 * delivered shape.
 *
 * awaits aip-cnks.5 — the real verifier dispatches the 3 raters (and binds to
 * the acceptance predicates from the OutcomeContract). The default
 * {@link stubVerifier} returns a single deterministic `auto-promote` verdict at
 * the requested `assurance` — a pass-through, not a real panel.
 */
export interface Verifier<TOut = unknown> {
  verify(ctx: VerifyCtx<TOut>): Promise<VerificationVerdict>
}

/** The context a {@link Verifier} runs against. */
export interface VerifyCtx<TOut = unknown> {
  /** The cascade result to judge against the acceptance Metric. */
  output: TOut
  metric: string
  assurance: Assurance
}

/**
 * SETTLEMENT port — drives the terminal `ACCEPTED` / `REFUNDED` phases: charges
 * or refunds via the finance firmware.
 *
 * `charge` now carries the full economic context the finance firmware needs: the
 * gating `basis` (the rung settlement gates at), the `amount` of {@link Money} to
 * capture, the `buyer` to bill, and an optional caller `ref`. It returns a
 * {@link Settlement} that carries the charge id — the handle RETAINS that id so a
 * later `refund` can reference it. `refund` takes that retained `chargeId` (and
 * an optional partial `amount`).
 *
 * awaits aip-cnks.5 — the real settler calls the `business-as-code/finance`
 * Merchant / FinanceProvider ports against the OutcomeContract + RefundContract.
 * The default {@link stubSettler} returns the matching `Settlement` shape with a
 * zero `Money` capture — a no-op, not a real charge.
 */
export interface Settler {
  charge(args: ChargeArgs): Promise<Settlement>
  refund(args: RefundArgs): Promise<Settlement>
}

/** Arguments to {@link Settler.charge} — the full economic context for a capture. */
export interface ChargeArgs {
  /** The gating rung settlement gates at (the assurance→basis ceiling). */
  basis: PricingBasis
  /** The {@link Money} to capture (resolved from the Offer/contract at ORDER). */
  amount: Money
  /** The buyer to bill (from {@link OrderOpts}/{@link CreateHandleOpts}). */
  buyer: string
  /** Optional caller-supplied reference (e.g. an idempotency key). */
  ref?: string
}

/** Arguments to {@link Settler.refund} — references the retained charge. */
export interface RefundArgs {
  /** The charge id retained from the prior {@link Settler.charge}. */
  chargeId: string
  /** Optional partial-refund {@link Money}; absent ⇒ full refund. */
  amount?: Money
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
function stubVerifier<TOut>(): Verifier<TOut> {
  return {
    async verify(ctx: VerifyCtx<TOut>): Promise<VerificationVerdict> {
      // awaits aip-cnks.5 — no real 3-rater panel; a single auto-promote stub.
      // `ctx.output` (the judged cascade result) is accepted but not inspected.
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
    async charge(args: ChargeArgs): Promise<Settlement> {
      // awaits aip-cnks.5 — no real finance capture; a zero-Money charge stub.
      // The charge id is deterministic so a later refund can reference it.
      return {
        outcome: 'charged',
        chargeId: 'stub:charge',
        captured: args.amount ?? ZERO_MONEY,
        basis: args.basis,
        contract: 'stub:outcome-contract',
      }
    },
    async refund(args: RefundArgs): Promise<Settlement> {
      // awaits aip-cnks.5 — no real finance refund; a zero-Money refund stub.
      return {
        outcome: 'refunded',
        amount: args.amount ?? ZERO_MONEY,
        per: 'stub:refund-contract',
        chargeId: args.chargeId,
      }
    },
  }
}

/**
 * Resolve the {@link Money} amount to charge from the Offer's price, gated by the
 * settlement `basis`. An explicit `override` (from {@link CreateHandleOpts.amount})
 * always wins. Otherwise the Offer's `priceSpecification.structure` decides:
 *
 *   - `SinglePrice` → its `price` (the one concrete amount).
 *   - `Tiered`      → the FIRST tier's `price` (the selection rule: the lead
 *     tier is the default offer; a richer tier-selection path arrives with the
 *     finance pricing engine in aip-cnks.5). A Tiered Offer carries a concrete
 *     `price: Money` per tier, so it MUST resolve to that — never zero.
 *
 * For genuinely ORDER-TIME-UNRESOLVABLE structures (`UsageMeter` / `SuccessFee` /
 * `Gainshare` / `CustomQuote`) the amount is known only POST-DELIVERY (metered
 * usage, a realised invoice, a delta over a baseline, or an RFQ) and so resolves
 * to {@link ZERO_MONEY} here, awaiting the finance pricing engine (aip-cnks.5).
 * Returning ZERO is acceptable ONLY because a LIVE settler refuses to act on it:
 * {@link makeFinanceSettler}'s `charge` throws `ZeroChargeError` on a zero/negative
 * amount, so a real $0 capture can never silently happen. The in-memory
 * `stubSettler` (a separate test-only path) is unaffected.
 */
export function resolveAmount(
  offer: OfferOf<unknown>,
  _basis: PricingBasis,
  override?: Money
): Money {
  if (override) return override
  const spec = (
    offer as {
      priceSpecification?: {
        structure?: string
        price?: Money
        tiers?: ReadonlyArray<{ name: string; price: Money }>
      }
    }
  ).priceSpecification
  if (spec && spec.structure === 'SinglePrice' && spec.price) return spec.price
  // Tiered carries a concrete `price: Money` per tier — resolve the first
  // (lead/default) tier rather than zeroing it.
  if (spec && spec.structure === 'Tiered' && spec.tiers && spec.tiers.length > 0) {
    return spec.tiers[0]!.price
  }
  // UsageMeter/SuccessFee/Gainshare/CustomQuote are order-time-unresolvable —
  // see the docblock. A live settler refuses to act on the zero (ZeroChargeError).
  return { ...ZERO_MONEY }
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

  /**
   * The {@link Money} to capture at `accept()`. When omitted, it is resolved
   * from the Offer's `priceSpecification` (a single-price Offer) via
   * {@link resolveAmount}; falls back to zero {@link Money} for free Offers.
   */
  amount?: Money
  /** The buyer billed at settlement (threaded into {@link Settler.charge}). */
  buyer?: string

  // ── injected ports (default to in-memory stubs; awaits aip-cnks.5) ──
  executor?: CascadeExecutor<TIn, TOut>
  verifier?: Verifier<TOut>
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
  const verifier: Verifier<TOut> = opts.verifier ?? stubVerifier<TOut>()
  const settler = opts.settler ?? stubSettler()
  const metric = opts.metric ?? 'stub:metric'
  const assurance: Assurance = opts.assurance ?? 'unverifiable'
  const autoStart = opts.autoStart ?? true

  // The economic context threaded into settlement: the buyer to bill and the
  // Money to capture (resolved from the Offer's price, gated by the ceiling).
  const buyer = opts.buyer ?? opts.orderOpts?.buyer ?? 'anonymous'
  const amount = resolveAmount(opts.offer, opts.ceiling, opts.amount)

  // ── mutable runtime state ──
  let state: InvocationState = 'ORDERED'
  let cost: Money = { ...ZERO_MONEY }
  // The charge id retained from accept()'s settler.charge — threaded into a
  // later settler.refund so the firmware can reverse the exact capture.
  let chargeId: string | undefined
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
      await deliverFromActive('cascade-start')
    } catch (err) {
      fail(err)
    }
  }

  /**
   * The re-runnable DELIVERY TAIL: drive ACTIVE → DELIVERING (cascade EXECUTION)
   * → QUALITY_REVIEW (3-rater VERIFICATION) → DELIVERED, then honour
   * `autoAccept`. Entered from {@link start} on the happy path AND from
   * `resolve('resume')` after an ESCALATED→ACTIVE re-drive — so the tail is a
   * single source of truth for "deliver from ACTIVE". Caller MUST be in `ACTIVE`.
   */
  async function deliverFromActive(deliverTrigger: string): Promise<void> {
    go('DELIVERING', deliverTrigger)

    // DELIVERING — cascade EXECUTION via injected port (real executor:
    // `makeCascadeExecutor`; default: in-memory stub).
    const output = await executor.execute({ input: opts.input, emit, cost })

    // QUALITY_REVIEW — 3-rater VERIFICATION via injected port. The delivered
    // `output` is threaded in as the thing being judged against the Metric.
    go('QUALITY_REVIEW', 'cascade-complete')
    const panel = await verifier.verify({ output, metric, assurance })
    emit({ kind: 'evaluator-signoff', panel })

    // DELIVERED — the buyer now drives accept() / dispute(). On a resume re-drive
    // `result`/`quality` may already have settled from the first pass; the
    // `!settled` guards in `emit` make the re-emit idempotent.
    go('DELIVERED', panel.rollup === 'auto-promote' ? 'evaluators-approved' : 'evaluators-queued')
    emit({ kind: 'delivered', output, assurance: panel.assuranceAchieved })

    // autoAccept convenience (boolean true or a predicate over the verdict).
    const auto = opts.orderOpts?.autoAccept
    const shouldAuto = typeof auto === 'function' ? auto(panel) : auto === true
    if (shouldAuto && state === 'DELIVERED') await drive.accept()
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
      const settlement = await settler.charge({ basis: opts.ceiling, amount, buyer })
      // Retain the charge id so a later refund can reference the exact capture.
      if (settlement.outcome === 'charged') chargeId = settlement.chargeId
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
        // Take the ESCALATED→ACTIVE edge, then RE-DRIVE the delivery tail
        // (ACTIVE→DELIVERING via the executor → QUALITY_REVIEW via the verifier
        // → DELIVERED). Now that a real executor exists (aip-cnks.10), the tail
        // is re-runnable: `deliverFromActive` is the same loop `start()` uses,
        // so a resumed invocation completes exactly like a fresh one. Auto-accept
        // is honoured inside the tail; if it didn't auto-settle, we settle here
        // so the contract (resolve returns a `Settlement`) holds.
        go('ACTIVE', 'escalation-resume')
        try {
          await deliverFromActive('cascade-resume')
        } catch (err) {
          fail(err)
          throw err instanceof Error ? err : new Error(String(err))
        }
        // If autoAccept already settled, hand back the same settlement; else
        // drive the terminal accept() now (resume implies the buyer is satisfied
        // the escalation is cleared and the re-delivery should settle).
        if (settledD.settled) return settledD.promise
        if (state === 'DELIVERED') return drive.accept()
        // Neither settled NOR DELIVERED after a resume re-drive — REJECT loudly
        // rather than returning a never-resolving `settledD.promise` that would
        // hang the caller forever (e.g. the re-drive auto-failed into ERROR, or
        // the buyer disputed before this returned).
        throw new Error(
          `resume reached an unexpected non-delivered/non-settled state ('${state}') — ` +
            `the escalation re-drive neither settled nor reached DELIVERED`
        )
      }
      if (r === 'cancel') {
        go('CANCELLED', 'escalation-cancel')
        const settlement: Settlement = { outcome: 'noop', reason: 'cancelled-pre-charge' }
        emit({ kind: 'settled', settlement })
        return settlement
      }
      // refund — reference the retained charge id when a charge happened; this
      // escalation path refunds PRE-charge (no accept() ran yet), so fall back to
      // a `no-prior-charge` sentinel meaning "reverse the guarantee, nothing was
      // captured". A real firmware treats the sentinel as a zero-amount reversal.
      go('REFUNDED', 'escalation-refund')
      const settlement = await settler.refund({ chargeId: chargeId ?? 'no-prior-charge' })
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
// attach — reconnect to a durable run (an INJECTED DurableStore seam)
// ============================================================================

/**
 * The minimal persisted shape a {@link DurableStore} hands back: enough to
 * re-mint an {@link InvocationHandle} view over a run that already exists in a
 * durable backend (CF Workflows per ADR-0004, a DB row, …). It is intentionally
 * thin — the durable FSM itself is server-side; this is the reconnection
 * envelope, not the full run record. The concrete durable adapter (aip-cnks.5)
 * implements {@link DurableStore.load} against its backend; here `attach`
 * depends only on the abstract port, so it is a clean injected seam (not a
 * hardcoded stub).
 */
export interface PersistedInvocation<TOut = unknown> {
  /** Stable invocation `$id`. */
  id: string
  /** The Offer the run was ordered against. */
  offer: OfferOf<TOut>
  /** The assurance→gatingBasis ceiling computed at ORDER. */
  ceiling: PricingBasis
  /** The last-persisted FSM state. */
  state: InvocationState
  /** The replayable event spine (empty when the backend keeps no history). */
  history?: readonly InvocationEvent<TOut>[]
}

/**
 * The durable-reconnection port `attach` walks through. Tests inject a fake
 * (an in-memory map); a concrete durable adapter (CF Workflows / DB) backs it
 * in production. `load` resolves `null` when no run with `id` exists.
 */
export interface DurableStore {
  load<TOut = unknown>(id: string): Promise<PersistedInvocation<TOut> | null>
}

/** Thrown by {@link attach} when no {@link DurableStore} is wired. */
export class NoDurableStoreError extends Error {
  constructor(id: string) {
    super(
      `attach(${id}) requires an injected DurableStore — pass attach(id, store). ` +
        `No durable backend is wired by default (the FSM scaffold is in-memory).`
    )
    this.name = 'NoDurableStoreError'
  }
}

/** Thrown by {@link attach} when the {@link DurableStore} has no such run. */
export class InvocationNotFoundError extends Error {
  constructor(id: string) {
    super(`attach(${id}) — no persisted invocation with that id in the DurableStore`)
    this.name = 'InvocationNotFoundError'
  }
}

/**
 * Reconnect to a durable invocation by id through an INJECTED
 * {@link DurableStore}. This is a clean injected seam: with no `store`, it
 * rejects with {@link NoDurableStoreError} (the in-memory scaffold has no
 * durable backend); with a `store`, it loads the {@link PersistedInvocation}
 * and re-mints a read-only {@link InvocationHandle} view over it. Rejects with
 * {@link InvocationNotFoundError} when the store has no such run.
 *
 * The re-minted handle is a VIEW: it replays the persisted state + history and
 * exposes the observe surface, but its drive verbs (which would mutate the
 * durable run) await the durable adapter's write path (aip-cnks.5). For now the
 * view is enough to reconnect, read state/history, and await a terminal.
 */
export async function attach<TOut>(
  id: string,
  store?: DurableStore
): Promise<InvocationHandle<TOut>> {
  if (!store) throw new NoDurableStoreError(id)
  const persisted = await store.load<TOut>(id)
  if (!persisted) throw new InvocationNotFoundError(id)
  return makeAttachedView<TOut>(persisted)
}

/**
 * Re-mint a read-only {@link InvocationHandle} view from a
 * {@link PersistedInvocation}. The view serves the persisted state + history
 * and resolves the derived promises from the replayed spine; the drive verbs
 * reject pending the durable write path.
 */
function makeAttachedView<TOut>(p: PersistedInvocation<TOut>): InvocationHandle<TOut> {
  const log: readonly InvocationEvent<TOut>[] = p.history ?? []
  const state = p.state

  // Derive the observable promises from the replayed spine.
  const delivered = log.find((e) => e.kind === 'delivered') as
    | Extract<InvocationEvent<TOut>, { kind: 'delivered' }>
    | undefined
  const signoff = log.find((e) => e.kind === 'evaluator-signoff') as
    | Extract<InvocationEvent<TOut>, { kind: 'evaluator-signoff' }>
    | undefined
  const settledEv = log.find((e) => e.kind === 'settled') as
    | Extract<InvocationEvent<TOut>, { kind: 'settled' }>
    | undefined

  const driveRejected = (verb: string): Promise<never> =>
    Promise.reject(
      new Error(`attached view of '${p.id}' is read-only — '${verb}' awaits the durable write path`)
    )

  // Build the derived promises eagerly but attach inert catch handlers so an
  // absent-event rejection (e.g. a run that never `delivered`) does not surface
  // as an unhandled rejection before a consumer attaches. Real awaiters still
  // observe the rejection.
  const resultP: Promise<TOut> = delivered
    ? Promise.resolve(delivered.output)
    : Promise.reject(new Error(`attached view of '${p.id}' has no delivered output`))
  const qualityP: Promise<VerificationVerdict> = signoff
    ? Promise.resolve(signoff.panel)
    : Promise.reject(new Error(`attached view of '${p.id}' has no verification verdict`))
  resultP.catch(() => {})
  qualityP.catch(() => {})

  return {
    id: p.id,
    offer: p.offer,
    ceiling: p.ceiling,

    state: () => state,
    events: {
      [Symbol.asyncIterator](): AsyncIterator<InvocationEvent<TOut>> {
        // Replay the persisted spine, then close.
        let i = 0
        return {
          next() {
            if (i < log.length) return Promise.resolve({ value: log[i++]!, done: false })
            return Promise.resolve({ value: undefined as never, done: true })
          },
        }
      },
    },
    watch: (...states: InvocationState[]) =>
      Promise.resolve(states.includes(state) ? state : state),
    costSoFar: () => {
      const last = [...log].reverse().find((e) => e.kind === 'cost-incurred') as
        | Extract<InvocationEvent<TOut>, { kind: 'cost-incurred' }>
        | undefined
      return last?.cumulative ?? { ...ZERO_MONEY }
    },
    previews: () => ({}),
    history: () => log.slice(),

    result: resultP,
    quality: qualityP,
    settled: () =>
      settledEv
        ? Promise.resolve(settledEv.settlement)
        : Promise.reject(new Error(`attached view of '${p.id}' has not settled`)),

    clarify: () => driveRejected('clarify'),
    accept: () => driveRejected('accept'),
    dispute: () => driveRejected('dispute'),
    escalate: () => driveRejected('escalate'),
    resolve: () => driveRejected('resolve'),
    cancel: () => driveRejected('cancel'),
  }
}
