/**
 * services-as-software — PROPOSED interface surface (shapes only, no implementation).
 *
 * Companion to ADR 0011
 * (docs/adr/0011-services-as-software-deliverable-envelope-and-service-front-door.md)
 * and beads aip-cnks.7.1–7.5. This file is a DESIGN SKETCH: it lives under docs/
 * and is intentionally NOT part of any tsconfig build. External types are aliased
 * with a comment naming their canonical home; `declare`d functions carry no bodies.
 *
 * The canonical unit is a four-layer `Deliverable` of `kind: 'service-as-software'`.
 * Three public surfaces compose over the one value:
 *   #1 AUTHOR    — `Service(spec)`      (simple objects → Deliverable; compile-time ceiling)
 *   #2 RUN       — `invoke()`→`Handle`  (11-state FSM, event spine, verify, settle)
 *   #3 DISCOVER  — `match` / `derive`   (Demand→Offer; lens projections; ResponseEnvelope)
 */

// ============================================================================
// External types (canonical homes — imported, not redefined, in the real package)
// ============================================================================

/** Standard-Schema validator. `@standard-schema/spec`. */
type Schema<T> = { readonly '~standard': unknown; readonly __out?: T }
type InferOutput<S> = S extends Schema<infer O> ? O : never

/** business-as-code/finance (firmware below — consumed, never reinvented). */
type Money = { amountCents: number; currency: string }
type OutcomeContractRef = string & { __brand?: 'OutcomeContractRef' }
type RefundContractRef = string & { __brand?: 'RefundContractRef' }
type PriceSpecification =
  | { structure: 'SinglePrice'; amountCents: number; currency: string }
  | { structure: 'Tiered'; tiers: ReadonlyArray<{ name: string; amountCents: number }> }
  | { structure: 'UsageMeter'; unit: string; perUnitCents: number }
  | { structure: 'SuccessFee'; pct: number; of: MetricRef }
  | { structure: 'Gainshare'; sharePct: number; baseline: MetricRef }
  | { structure: 'CustomQuote'; rfqUrl?: string }
type FundingSource =
  | { source: 'direct' }
  | { source: 'ad-supported'; network: string }
  | { source: 'equity'; instrument: string }
  | { source: 'barter'; counterparty: string }
  | { source: 'subsidized'; sponsor: string }

/** business-as-code — the canonical schema.org Offer (re-exported by this package). */
interface Offer<TOut = unknown> {
  $type: 'Offer'
  $id: string
  itemOffered: ServiceRef // → the G1 abstract Service category noun
  seller?: string
  promise: string
  gating: { basis: PricingBasis; secondaryBasis?: PricingBasis }
  priceSpecification: PriceSpecification
  fundingSource: FundingSource
  /** phantom carrier of the Deliverable's typed Outcome output, for invoke(). */
  readonly __out?: TOut
}

/** schema.org Demand — the dual of Offer over the same itemOffered. */
interface Demand {
  $type: 'Demand'
  $id: string
  seeks: ServiceRef
  problem?: ProblemRef
  acceptance?: { metric: string; target?: number }
}

/** startup-builder — design-locked wire envelope (5 golden fixtures). */
interface ResponseEnvelope<T = unknown> {
  api: { name: string; docs: string; version: string; home: string }
  $context?: string
  $type?: string
  $id?: string
  links: Record<string, string>
  actions: Record<string, string> // = FSM transitions available from this node
  options: Record<string, string>
  relationships: Record<string, string | object> // out-edges
  references?: { total: number; items: ReadonlyArray<{ $type: string; $id: string; predicate: string }> } // in-edges
  meta: { level: string; scopes: string[] }
  user: { requestId: string; edgeLocation: string }
  // plus the typed payload under its discriminant key:
  [typedKey: string]: unknown
}

type ServiceRef = string & { __brand?: 'ServiceRef' }
type ProblemRef = string & { __brand?: 'ProblemRef' }
type MetricRef = string & { __brand?: 'MetricRef' }
type Duration = string // ISO-8601 duration, e.g. 'PT2M'

// ============================================================================
// The two dual spines + the ceiling
// ============================================================================

/** VALUE spine — the value-capture ladder. CLOSED, complete by construction. */
type PricingBasis = 'access' | 'effort' | 'usage' | 'output' | 'outcome'

/** CONTROL spine — graded verifiability of the acceptance Metric. */
type Assurance =
  | 'instrumented'
  | 'deterministic'
  | 'proxy'
  | 'sampled'
  | 'attested'
  | 'counterfactual'
  | 'unverifiable'

/**
 * The assurance→gatingBasis ceiling: which rungs each assurance grade may reach.
 * `outcome` requires a *verifiable* Metric — only the top grades unlock it.
 * This is the law where the VALUE and CONTROL spines meet.
 */
interface GatingCeiling {
  unverifiable: 'access'
  sampled: 'access' | 'effort' | 'usage'
  proxy: 'access' | 'effort' | 'usage'
  attested: 'access' | 'effort' | 'usage' | 'output'
  instrumented: 'access' | 'effort' | 'usage' | 'output'
  counterfactual: 'access' | 'effort' | 'usage' | 'output' | 'outcome'
  deterministic: 'access' | 'effort' | 'usage' | 'output' | 'outcome'
}
type LegalGating<A extends Assurance> = GatingCeiling[A]

// ============================================================================
// The four-layer Deliverable (canonical unit)
// ============================================================================

type DeliverableKind = 'service-as-software' | 'agent' | 'software'

interface Outcome {
  id: string
  /** Sharpened, verifiable: not "books processed" but "books reconciled to GAAP, 0 unmatched, by BD5". */
  statement: string
  metric: { ref: MetricRef; unit?: string; verifiability: Assurance }
  resolves?: ProblemRef // the Problem (Demand) this mirrors
}

interface ContractLayer<TIn = unknown, TOut = unknown> {
  input: Schema<TIn>
  output: Schema<TOut>
  outcomeContract: {
    outcome: Outcome
    acceptance: ReadonlyArray<{ predicate: string; check?: string }>
  }
}

type FunctionKind = 'Code' | 'Generative' | 'Agentic' | 'Human'
interface FunctionDef {
  id: string
  fnKind: FunctionKind
  performs: string
  oversight?: { posture: 'autonomous' | 'spot-check' | 'review-queue' | 'human-required' }
}
interface ImplementationLayer {
  functions: ReadonlyArray<FunctionDef> // ≥1
  /** carriage runCascade over JSON steps with $ref resolution (executes via ai-evaluate, ADR-0010). */
  binding?: { cascade: unknown }
}

interface DependenciesLayer {
  composes?: ReadonlyArray<Deliverable> // recursion: service-as-software → agent → software
  integrations?: ReadonlyArray<{ category: string; resolution: { mode: 'buy' | 'make'; provider?: string } }>
}

/** The commercial layer carries the Offer. One Deliverable → many Offers (a tuple). */
interface CommercialLens {
  gating: { basis: PricingBasis; secondaryBasis?: PricingBasis }
  priceSpecification: PriceSpecification
  fundingSource: FundingSource
  offer: { mode: 'inline'; promise: string; seller?: string } | { mode: 'ref'; offerId: string }
}

interface Deliverable<TIn = unknown, TOut = unknown> {
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
  readonly offer: Offer<TOut> | ReadonlyArray<Offer<TOut>>
  /** #2 open a runtime invocation against an Offer. */
  invoke(input: TIn, opts?: OrderOpts): Promise<InvocationHandle<TOut>>
  /** #2 fire-and-forget convenience over the handle. */
  reconcile(desired: { input: TIn; onLens?: number; demand?: ProblemRef }): Promise<Settled<TOut>>
}

// ============================================================================
// SURFACE #1 — Service() authoring front door (simple objects → Deliverable)
// ============================================================================

/** A loose, author-friendly shape: { url: 'string' } | a Standard Schema. */
type Shapeish = Record<string, string> | Schema<unknown>

/** Pricing shorthand → the commercial/Offer layer. */
type PriceShorthand =
  | { per: 'access'; amount: string; interval?: 'month' | 'year' }
  | { per: 'effort'; unit: 'hour' | 'day' | 'fte'; amount: string }
  | { per: 'usage'; unit: string; amount: string }
  | { per: 'output'; unit: string; amount: string }
  | { per: 'outcome'; successFee?: string; gainsharePct?: number } // requires a verifiable metric (ceiling)

interface ServiceSpec {
  // identity
  name: string
  description?: string

  // CONTRACT (flat) — io shapes + an outcome sentence + optional metric/acceptance
  input?: Shapeish
  output?: Shapeish
  outcome?: string | { statement: string; resolves?: ProblemRef }
  metric?: { name: string; unit?: string; verify?: Assurance } // drives the ceiling
  accept?: string

  // IMPLEMENTATION (flat) — exactly one authoring style
  run?: (input: any) => Promise<any> // single Agentic/Code Function shorthand
  archetype?: string // pull defaults from the seed catalog
  functions?: ReadonlyArray<FunctionDef>
  cascade?: unknown

  // DEPENDENCIES (flat)
  composes?: ReadonlyArray<Deliverable>
  integrations?: DependenciesLayer['integrations']

  // COMMERCIAL (flat) — `price` shorthand OR explicit Offer(s); omit ⇒ access/free
  price?: PriceShorthand | ReadonlyArray<PriceShorthand>
  offer?: Offer | ReadonlyArray<Offer>
}

/**
 * Compile-time ceiling guard: if the spec gates on `outcome` (via price) but the
 * metric's `verify` grade can't legally reach `outcome`, narrow to `never` so the
 * call does not typecheck. (Illustrative — the real guard maps over price entries.)
 */
type AssuranceOf<S extends ServiceSpec> = S['metric'] extends { verify: infer A extends Assurance }
  ? A
  : 'unverifiable'
type WithinCeiling<S extends ServiceSpec> = S['price'] extends { per: 'outcome' }
  ? 'outcome' extends LegalGating<AssuranceOf<S>>
    ? S
    : never // ← outcome-pricing without a verifiable metric is a COMPILE error
  : S

type DeliverableOf<S extends ServiceSpec> = Deliverable<
  S['input'] extends Schema<infer I> ? I : unknown,
  S['output'] extends Schema<infer O> ? O : unknown
>

/** The front door. Simple object in, canonical four-layer Deliverable out. */
declare function Service<const S extends ServiceSpec>(spec: S & WithinCeiling<S>): DeliverableOf<S>
/** Batch authoring (à la business-as-code `Goals([...])`). */
declare function Service<const S extends ServiceSpec>(specs: readonly S[]): ReadonlyArray<DeliverableOf<S>>

declare namespace Service {
  /** Secondary constructors (existing v3 ergonomics retained). */
  function define<const S extends ServiceSpec>(spec: S & WithinCeiling<S>): DeliverableOf<S>
  function fromFunction(fn: (input: any) => Promise<any>, opts?: Partial<ServiceSpec>): Deliverable
  function load(ref: ServiceRef): Promise<Deliverable>
}

// ============================================================================
// SURFACE #2 — Invocation runtime (11-state FSM + event spine + verify + settle)
// ============================================================================

type InvocationState =
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
type Terminal = 'ACCEPTED' | 'CANCELLED' | 'REFUNDED'

declare const VALID_TRANSITIONS: Readonly<Record<InvocationState, readonly InvocationState[]>>
declare function canTransition(from: InvocationState, to: InvocationState): boolean
declare function isTerminal(s: InvocationState): s is Terminal

interface RaterVerdict {
  rater: string
  verdict: 'pass' | 'fail' | 'needs_review'
  rationale: string
}
interface VerificationVerdict {
  metric: MetricRef
  raters: readonly [RaterVerdict, RaterVerdict, RaterVerdict]
  rollup: 'auto-promote' | 'queue-review' | 'reject'
  assuranceAchieved: Assurance
}

type Settlement =
  | { outcome: 'charged'; captured: Money; basis: PricingBasis; contract: OutcomeContractRef }
  | { outcome: 'refunded'; amount: Money; per: RefundContractRef }
  | { outcome: 'noop'; reason: 'free' | 'cancelled-pre-charge' }

interface ClarificationRequest {
  id: string
  question: string
  choices?: string[]
}
type EscalationReason = 'evaluator-deadlock' | 'clarification-timeout' | 'authority-boundary' | 'buyer-dispute'
type EscalationResolution = 'resume' | 'cancel' | 'refund'

type InvocationEvent<TOut> =
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

interface OrderOpts {
  budget?: Money
  clarificationDwell?: Duration
  autoAccept?: boolean | ((v: VerificationVerdict) => boolean)
  gateAt?: PricingBasis // requested rung; rejected if above the ceiling
}

interface InvocationHandle<TOut> {
  readonly id: string
  readonly offer: Offer<TOut>
  readonly ceiling: PricingBasis // assurance→gatingBasis ceiling, computed at ORDER

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

type Settled<TOut> = {
  state: Terminal
  output?: TOut
  verification?: VerificationVerdict
  settlement: Settlement
}

/** Reconnect to a durable run; the handle is a thin view over server-side FSM state. */
declare function attach<TOut>(id: string): Promise<InvocationHandle<TOut>>

// ============================================================================
// SURFACE #3 — Graph discovery (match Demand→Offer; derive/project lenses)
// ============================================================================

type Lens = 'catalog' | 'listing' | 'marketplace' | 'order' | 'delivery' | 'portal' | 'holdco'
interface LensCtx {
  audience: 'buyer' | 'seller' | 'holdco' | 'public'
  visibility: 'public' | 'tenant' | 'private'
  representative?: boolean // representative Offer vs concrete (live seller)
}

interface Match<TOut> {
  offer: Offer<TOut> | null
  score: number
  ratified: boolean
  minted: boolean
}

interface Discovery {
  /** match-or-mint: Demand→Offer via pgvector ANN + ratify; mints a stub Offer if none. */
  match<TOut>(demand: Demand, opts?: { threshold?: number; ratify?: 'auto' | 'manual' }): Promise<Match<TOut>>
  /** pure projection over the Offer's node + edges → the locked wire envelope. */
  derive: { [L in Lens]: (offer: Offer, ctx: LensCtx) => ResponseEnvelope }
  /** generic projection. */
  project(lens: Lens, root: Offer | Deliverable, ctx: LensCtx): ResponseEnvelope
  /** Outcome→Problem traversal (verify acceptance against the bound Metric + Problem). */
  resolve(outcome: Outcome): { problem: ProblemRef; metric: MetricRef }
}

export type {
  // spines + ceiling
  PricingBasis,
  Assurance,
  GatingCeiling,
  LegalGating,
  // deliverable
  Deliverable,
  DeliverableKind,
  ContractLayer,
  ImplementationLayer,
  DependenciesLayer,
  CommercialLens,
  Outcome,
  FunctionKind,
  // offer/demand
  Offer,
  Demand,
  PriceSpecification,
  FundingSource,
  // surface #1
  ServiceSpec,
  PriceShorthand,
  // surface #2
  InvocationHandle,
  InvocationState,
  InvocationEvent,
  VerificationVerdict,
  Settlement,
  Settled,
  OrderOpts,
  // surface #3
  Discovery,
  Lens,
  LensCtx,
  Match,
  // wire
  ResponseEnvelope,
}
export { Service, attach, canTransition, isTerminal, VALID_TRANSITIONS }
