/**
 * services-as-software v4 — the four-layer `Deliverable` type surface.
 *
 * Port of the design sketch
 * (`docs/design/2026-06-01-services-as-software-interface.ts`) and ADR 0011 into
 * real, compiling TypeScript. This is the **TYPE surface** (aip-cnks.7.2):
 * shapes are real; the handful of values that make the types usable (`Service`,
 * `attach`, the FSM helpers) are `declare`d signatures with no bodies.
 *
 * The canonical unit is a four-layer `Deliverable` of
 * `kind: 'service-as-software'`. Three public surfaces compose over the one
 * value:
 *   #1 AUTHOR    — `Service(spec)`      (simple objects → Deliverable; ceiling)
 *   #2 RUN       — `invoke()`→`Handle`  (11-state FSM, event spine, verify)
 *   #3 DISCOVER  — `match` / `derive`   (Demand→Offer; lens projections)
 *
 * External canonical types are **imported, not redefined**:
 *   - `Offer`, `PricingBasis`, `PriceSpecification`, `FundingSource`,
 *     `ItemOfferedRef`, `MetricRef` ← `business-as-code` (re-exports `Offer`,
 *     `PricingBasis`).
 *   - `Money` ← `business-as-code/finance` (settlement firmware).
 *   - `Schema`/`InferOutput` ← `@standard-schema/spec` (via v3 conventions).
 *
 * @packageDocumentation
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  Offer,
  PricingBasis,
  PriceSpecification,
  FundingSource,
  ItemOfferedRef,
} from 'business-as-code'
import type { Money } from 'business-as-code/finance'

// ============================================================================
// Re-exports — the canonical economic primitives originate in business-as-code
// ============================================================================

export type {
  // The canonical schema.org Offer noun (commercial layer). Re-exported, never
  // redefined — its home is `business-as-code` (L5, foundational substrate).
  Offer,
  // The value-capture ladder (VALUE spine). CLOSED, complete by construction.
  PricingBasis,
  // Concrete price shapes + funding — re-exported for convenience at this layer.
  PriceSpecification,
  FundingSource,
  ItemOfferedRef,
  Money,
}

// ============================================================================
// Schema interop (Standard Schema — aligned with v3 conventions)
// ============================================================================

/** Standard-Schema-compatible validator for a typed value `T`. */
export type Schema<T> = StandardSchemaV1<unknown, T>
/** Extract the validated output type from a {@link Schema}. */
export type InferOutput<S> = S extends StandardSchemaV1<infer _I, infer O> ? O : never

// ============================================================================
// Branded refs
// ============================================================================

export type ServiceRef = string & { __brand?: 'ServiceRef' }
export type ProblemRef = string & { __brand?: 'ProblemRef' }
export type MetricRef = string & { __brand?: 'MetricRef' }
export type OutcomeContractRef = string & { __brand?: 'OutcomeContractRef' }
export type RefundContractRef = string & { __brand?: 'RefundContractRef' }
/** ISO-8601 duration, e.g. `'PT2M'`. */
export type Duration = string

/**
 * A v4-local, phantom-carrying view of the canonical {@link Offer}.
 *
 * The canonical `business-as-code` `Offer` is intentionally **non-generic** (it
 * is shared by Product *and* Service). v4 needs to thread the Deliverable's
 * typed `Outcome` output `TOut` through `invoke()` / `Match` for end-to-end
 * inference, so `OfferOf<TOut>` intersects the canonical `Offer` with a phantom
 * carrier. It IS an `Offer` structurally — no shape is redefined, only a
 * compile-time `__out` marker is added.
 */
export type OfferOf<TOut = unknown> = Offer & { readonly __out?: TOut }

// ============================================================================
// schema.org Demand — the dual of Offer over the same itemOffered
// ============================================================================

export interface Demand {
  $type: 'Demand'
  $id: string
  seeks: ServiceRef
  problem?: ProblemRef
  acceptance?: { metric: string; target?: number }
}

// ============================================================================
// The two dual spines + the ceiling
// ============================================================================

// NOTE: `PricingBasis` (the VALUE spine) is imported + re-exported from
// business-as-code above — it is NOT redefined here.

/** CONTROL spine — graded verifiability of the acceptance Metric. */
export type Assurance =
  | 'instrumented'
  | 'deterministic'
  | 'proxy'
  | 'sampled'
  | 'attested'
  | 'counterfactual'
  | 'unverifiable'

/**
 * The assurance→gatingBasis ceiling: which rungs of the VALUE ladder each
 * `Assurance` grade may legally reach. `outcome` requires a *verifiable* Metric
 * — only `counterfactual` and `deterministic` unlock it. This is the law where
 * the VALUE and CONTROL spines meet: *"you may not sell on an outcome you never
 * declared."*
 */
export interface GatingCeiling {
  unverifiable: 'access'
  sampled: 'access' | 'effort' | 'usage'
  proxy: 'access' | 'effort' | 'usage'
  attested: 'access' | 'effort' | 'usage' | 'output'
  instrumented: 'access' | 'effort' | 'usage' | 'output'
  counterfactual: 'access' | 'effort' | 'usage' | 'output' | 'outcome'
  deterministic: 'access' | 'effort' | 'usage' | 'output' | 'outcome'
}

/** The set of {@link PricingBasis} rungs legally reachable at assurance `A`. */
export type LegalGating<A extends Assurance> = GatingCeiling[A]

// ============================================================================
// The four-layer Deliverable (canonical unit)
// ============================================================================

export type DeliverableKind = 'service-as-software' | 'agent' | 'software'

export interface Outcome {
  id: string
  /**
   * Sharpened, verifiable: not "books processed" but "books reconciled to GAAP,
   * 0 unmatched, by BD5".
   */
  statement: string
  metric: { ref: MetricRef; unit?: string; verifiability: Assurance }
  /** the Problem (Demand) this mirrors. */
  resolves?: ProblemRef
}

/** Layer 1 — the contract: io schemas + outcome + acceptance predicates. */
export interface ContractLayer<TIn = unknown, TOut = unknown> {
  input: Schema<TIn>
  output: Schema<TOut>
  outcomeContract: {
    outcome: Outcome
    acceptance: ReadonlyArray<{ predicate: string; check?: string }>
  }
}

export type FunctionKind = 'Code' | 'Generative' | 'Agentic' | 'Human'

export interface FunctionDef {
  id: string
  fnKind: FunctionKind
  performs: string
  oversight?: { posture: 'autonomous' | 'spot-check' | 'review-queue' | 'human-required' }
}

/** Layer 2 — the implementation: ≥1 Functions + an optional cascade binding. */
export interface ImplementationLayer {
  /** ≥1 — every Deliverable performs at least one Function. */
  functions: ReadonlyArray<FunctionDef>
  /**
   * carriage `runCascade` over JSON steps with `$ref` resolution (executes via
   * ai-evaluate, ADR-0010). "Binding is data."
   */
  binding?: { cascade: unknown }
}

/** Layer 3 — the dependencies: recursively composes sub-Deliverables. */
export interface DependenciesLayer {
  /** recursion: `service-as-software → agent → software`. */
  composes?: ReadonlyArray<Deliverable>
  integrations?: ReadonlyArray<{
    category: string
    resolution: { mode: 'buy' | 'make'; provider?: string }
  }>
}

/**
 * Layer 4 — the commercial lens: the Offer. One Deliverable → many Offers (a
 * tuple). Pricing is exposed **only** here, never on the bare capability.
 */
export interface CommercialLens {
  gating: { basis: PricingBasis; secondaryBasis?: PricingBasis }
  priceSpecification: PriceSpecification
  fundingSource: FundingSource
  offer: { mode: 'inline'; promise: string; seller?: string } | { mode: 'ref'; offerId: string }
}

export interface Deliverable<TIn = unknown, TOut = unknown> {
  kind: DeliverableKind
  $id: string
  name: string
  description?: string
  contract: ContractLayer<TIn, TOut>
  implementation: ImplementationLayer
  dependencies?: DependenciesLayer
  commercial: CommercialLens | readonly [CommercialLens, ...CommercialLens[]]

  // ── affordances: the one value flows into surfaces #2 and #3 ──
  /** #3 pure projection through a lens → the locked wire envelope. */
  derive(lens: Lens): ResponseEnvelope
  /** the canonical business-as-code Offer(s) this Deliverable is offered as. */
  readonly offer: OfferOf<TOut> | ReadonlyArray<OfferOf<TOut>>
  /** #2 open a runtime invocation against an Offer. */
  invoke(input: TIn, opts?: OrderOpts): Promise<InvocationHandle<TOut>>
  /** #2 fire-and-forget convenience over the handle. */
  reconcile(desired: { input: TIn; onLens?: number; demand?: ProblemRef }): Promise<Settled<TOut>>
}

// ============================================================================
// SURFACE #1 — Service() authoring front door (simple objects → Deliverable)
// ============================================================================

/** A loose, author-friendly shape: `{ url: 'string' }` | a Standard Schema. */
export type Shapeish = Record<string, string> | Schema<unknown>

/** Pricing shorthand → the commercial/Offer layer. */
export type PriceShorthand =
  | { per: 'access'; amount: string; interval?: 'month' | 'year' }
  | { per: 'effort'; unit: 'hour' | 'day' | 'fte'; amount: string }
  | { per: 'usage'; unit: string; amount: string }
  | { per: 'output'; unit: string; amount: string }
  // `outcome` requires a verifiable metric (the ceiling, enforced below).
  | { per: 'outcome'; successFee?: string; gainsharePct?: number }

export interface ServiceSpec {
  // identity
  name: string
  description?: string

  // CONTRACT (flat) — io shapes + an outcome sentence + optional metric/acceptance
  input?: Shapeish
  output?: Shapeish
  outcome?: string | { statement: string; resolves?: ProblemRef }
  /** drives the ceiling. */
  metric?: { name: string; unit?: string; verify?: Assurance }
  accept?: string

  // IMPLEMENTATION (flat) — exactly one authoring style
  /**
   * single Agentic/Code Function shorthand. The param is `any` (not `unknown`)
   * on purpose: authors hand a NARROWLY-typed run — `(input: { url: string }) =>
   * …` — and a contravariant `unknown` param would reject that. Author
   * ergonomics win here over the `no-explicit-any` lint.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- author-facing contravariance
  run?: (input: any) => Promise<any>
  /** pull defaults from the seed catalog. */
  archetype?: string
  functions?: ReadonlyArray<FunctionDef>
  cascade?: unknown

  // DEPENDENCIES (flat)
  composes?: ReadonlyArray<Deliverable>
  integrations?: DependenciesLayer['integrations']

  // COMMERCIAL (flat) — `price` shorthand OR explicit Offer(s); omit ⇒ access/free
  price?: PriceShorthand | ReadonlyArray<PriceShorthand>
  offer?: Offer | ReadonlyArray<Offer>
}

/** The verifiability grade a {@link ServiceSpec} declares (default `unverifiable`). */
export type AssuranceOf<S extends ServiceSpec> = S['metric'] extends {
  verify: infer A extends Assurance
}
  ? A
  : 'unverifiable'

/**
 * Compile-time ceiling guard. If the spec gates on `outcome` (via `price`) but
 * the metric's `verify` grade can't legally reach `outcome`, narrow to `never`
 * so the call does not typecheck — *outcome-pricing without a verifiable metric
 * is a COMPILE error*. Otherwise the spec passes through unchanged.
 */
export type WithinCeiling<S extends ServiceSpec> = HasOutcomePrice<S['price']> extends true
  ? 'outcome' extends LegalGating<AssuranceOf<S>>
    ? S
    : never
  : S

/** True iff `price` (shorthand or array of shorthands) gates on `outcome`. */
type HasOutcomePrice<P> = P extends { per: 'outcome' }
  ? true
  : P extends ReadonlyArray<infer E>
  ? E extends { per: 'outcome' }
    ? true
    : false
  : false

/** The concrete {@link Deliverable} type a {@link ServiceSpec} produces. */
export type DeliverableOf<S extends ServiceSpec> = Deliverable<
  S['input'] extends Schema<infer I> ? I : unknown,
  S['output'] extends Schema<infer O> ? O : unknown
>

// NOTE: the `Service()` front door (the authoring factory + its `define` /
// `fromFunction` / `load` secondary constructors) is a *value* — it lives in
// `./service.ts` (aip-cnks.7.3) and is re-exported through `./index.ts`. types.ts
// keeps only the TYPES it consumes ({@link ServiceSpec}, {@link WithinCeiling},
// {@link DeliverableOf}, {@link AssuranceOf}, {@link PriceShorthand}).

// ============================================================================
// SURFACE #2 — Invocation runtime (11-state FSM + event spine + verify + settle)
// ============================================================================

export type InvocationState =
  | 'ORDERED'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'DELIVERING'
  | 'QUALITY_REVIEW'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'CANCELLED'
  | 'ESCALATED'
  | 'ERROR'
  | 'REFUNDED'
  | 'DISPUTED'

export type Terminal = 'ACCEPTED' | 'CANCELLED' | 'REFUNDED'

// NOTE: the FSM *values* (`VALID_TRANSITIONS`, `canTransition`, `isTerminal`,
// `assertTransition`) live in `./invoke.ts` (the runtime, aip-cnks.7.4) and are
// re-exported through `./index.ts`. types.ts keeps only the pure TYPES.

export interface RaterVerdict {
  rater: string
  verdict: 'pass' | 'fail' | 'needs_review'
  rationale: string
}

export interface VerificationVerdict {
  metric: MetricRef
  raters: readonly [RaterVerdict, RaterVerdict, RaterVerdict]
  rollup: 'auto-promote' | 'queue-review' | 'reject'
  assuranceAchieved: Assurance
}

export type Settlement =
  | { outcome: 'charged'; captured: Money; basis: PricingBasis; contract: OutcomeContractRef }
  | { outcome: 'refunded'; amount: Money; per: RefundContractRef }
  | { outcome: 'noop'; reason: 'free' | 'cancelled-pre-charge' }

export interface ClarificationRequest {
  id: string
  question: string
  choices?: string[]
}

export type EscalationReason =
  | 'evaluator-deadlock'
  | 'clarification-timeout'
  | 'authority-boundary'
  | 'buyer-dispute'
export type EscalationResolution = 'resume' | 'cancel' | 'refund'

export type InvocationEvent<TOut> =
  | { kind: 'state-changed'; from: InvocationState; to: InvocationState; at: Date; trigger: string }
  | { kind: 'cascade-progress'; functionRef: string; pct: number; note?: string }
  | { kind: 'cost-incurred'; cost: Money; cumulative: Money; functionRef?: string }
  | { kind: 'preview-available'; slot: keyof TOut & string; payload: Partial<TOut> }
  | { kind: 'clarification-needed'; request: ClarificationRequest }
  | { kind: 'evaluator-signoff'; panel: VerificationVerdict }
  | { kind: 'delivered'; output: TOut; assurance: Assurance }
  | { kind: 'escalated'; reason: EscalationReason }
  | { kind: 'failed'; reason: string; detail: string }
  | { kind: 'settled'; settlement: Settlement }

export interface OrderOpts {
  budget?: Money
  clarificationDwell?: Duration
  autoAccept?: boolean | ((v: VerificationVerdict) => boolean)
  /** requested rung; rejected if above the ceiling. */
  gateAt?: PricingBasis
}

export interface InvocationHandle<TOut> {
  readonly id: string
  readonly offer: OfferOf<TOut>
  /** assurance→gatingBasis ceiling, computed at ORDER. */
  readonly ceiling: PricingBasis

  // observe (the event stream is the spine; the rest are derived)
  state(): InvocationState
  readonly events: AsyncIterable<InvocationEvent<TOut>>
  watch(...states: InvocationState[]): Promise<InvocationState>
  costSoFar(): Money
  previews(): Partial<TOut>
  history(): readonly InvocationEvent<TOut>[]

  // await (conveniences)
  readonly result: Promise<TOut>
  readonly quality: Promise<VerificationVerdict>
  settled(): Promise<Settlement>

  // drive (each guarded by VALID_TRANSITIONS)
  clarify(reply: { requestId: string; choice?: string; payload?: unknown }): Promise<void>
  accept(): Promise<Settlement>
  dispute(reason: string): Promise<void>
  escalate(reason: EscalationReason): Promise<void>
  resolve(r: EscalationResolution): Promise<Settlement>
  cancel(reason?: string): Promise<void>
}

export interface Settled<TOut> {
  state: Terminal
  output?: TOut
  verification?: VerificationVerdict
  settlement: Settlement
}

// NOTE: `attach()` (reconnect to a durable run) lives in `./invoke.ts` and is
// re-exported through `./index.ts`.

// ============================================================================
// SURFACE #3 — Graph discovery (match Demand→Offer; derive/project lenses)
// ============================================================================

export type Lens =
  | 'catalog'
  | 'listing'
  | 'marketplace'
  | 'order'
  | 'delivery'
  | 'portal'
  | 'holdco'

export interface LensCtx {
  audience: 'buyer' | 'seller' | 'holdco' | 'public'
  visibility: 'public' | 'tenant' | 'private'
  /** representative Offer vs concrete (live seller). */
  representative?: boolean
}

export interface Match<TOut> {
  offer: OfferOf<TOut> | null
  score: number
  ratified: boolean
  minted: boolean
}

export interface Discovery {
  /** match-or-mint: Demand→Offer via pgvector ANN + ratify; mints a stub if none. */
  match<TOut>(
    demand: Demand,
    opts?: { threshold?: number; ratify?: 'auto' | 'manual' }
  ): Promise<Match<TOut>>
  /** pure projection over the Offer's node + edges → the locked wire envelope. */
  derive: { [L in Lens]: (offer: Offer, ctx: LensCtx) => ResponseEnvelope }
  /** generic projection. */
  project(lens: Lens, root: Offer | Deliverable, ctx: LensCtx): ResponseEnvelope
  /** Outcome→Problem traversal (verify acceptance against the bound Metric). */
  resolve(outcome: Outcome): { problem: ProblemRef; metric: MetricRef }
}

// ============================================================================
// WIRE — the design-locked ResponseEnvelope (startup-builder, 5 golden fixtures)
// ============================================================================

/**
 * The locked wire envelope: the serialization of a graph node + its edges.
 * `relationships` are out-edges, `references` are in-edges, `actions` are the
 * FSM transitions available from this node. The typed payload rides under its
 * own discriminant key (the `[typedKey: string]` index signature).
 */
export interface ResponseEnvelope<_T = unknown> {
  api: { name: string; docs: string; version: string; home: string }
  $context?: string
  $type?: string
  $id?: string
  links: Record<string, string>
  /** = FSM transitions available from this node. */
  actions: Record<string, string>
  options: Record<string, string>
  /** out-edges. */
  relationships: Record<string, string | object>
  /** in-edges. */
  references?: {
    total: number
    items: ReadonlyArray<{ $type: string; $id: string; predicate: string }>
  }
  meta: { level: string; scopes: string[] }
  user: { requestId: string; edgeLocation: string }
  /** plus the typed payload `T` under its discriminant key. */
  [typedKey: string]: unknown
}
