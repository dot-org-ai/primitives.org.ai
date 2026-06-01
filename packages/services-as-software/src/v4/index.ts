/**
 * services-as-software v4 surface — barrel export.
 *
 * The four-layer `Deliverable` envelope (ADR 0011) and its three composing
 * surfaces: `Service()` authoring (#1), `invoke()`→`InvocationHandle` runtime
 * (#2), and `match`/`derive` discovery (#3). Additive over v3 — nothing here
 * touches the v3 surface.
 *
 * The canonical economic primitives (`Offer`, `PricingBasis`,
 * `PriceSpecification`, `FundingSource`, `Money`) originate in `business-as-code`
 * and are re-exported through `./types` — never redefined at this layer.
 *
 * @packageDocumentation
 */

// Spines + ceiling
export type { Assurance, GatingCeiling, LegalGating } from './types.js'

// The four-layer Deliverable
export type {
  Deliverable,
  DeliverableKind,
  ContractLayer,
  ImplementationLayer,
  DependenciesLayer,
  CommercialLens,
  Outcome,
  FunctionKind,
  FunctionDef,
} from './types.js'

// Re-exported economic primitives (canonical home: business-as-code)
export type {
  Offer,
  OfferOf,
  PricingBasis,
  PriceSpecification,
  FundingSource,
  ItemOfferedRef,
  Money,
  Demand,
} from './types.js'

// Schema interop + branded refs
export type {
  Schema,
  InferOutput,
  ServiceRef,
  ProblemRef,
  MetricRef,
  OutcomeContractRef,
  RefundContractRef,
  Duration,
} from './types.js'

// Surface #1 — authoring
export type {
  ServiceSpec,
  Shapeish,
  PriceShorthand,
  AssuranceOf,
  WithinCeiling,
  DeliverableOf,
} from './types.js'
// The `Service()` front door is a VALUE — its home is `./service.ts` (the
// authoring runtime, aip-cnks.7.3), not the type surface.
export { Service } from './service.js'

// Surface #2 — invocation runtime
export type {
  InvocationHandle,
  InvocationState,
  Terminal,
  InvocationEvent,
  RaterVerdict,
  VerificationVerdict,
  Settlement,
  Settled,
  OrderOpts,
  ClarificationRequest,
  EscalationReason,
  EscalationResolution,
} from './types.js'
// Surface #2 — invocation runtime (the FSM values + the in-memory handle
// scaffold live in `./invoke.ts`; the pure TYPES stay in `./types.ts`).
export {
  VALID_TRANSITIONS,
  canTransition,
  isTerminal,
  assertTransition,
  IllegalTransitionError,
  createInvocationHandle,
  reconcileHandle,
  attach,
} from './invoke.js'
export type {
  CreateHandleOpts,
  CascadeExecutor,
  ExecCtx,
  Verifier,
  VerifyCtx,
  Settler,
} from './invoke.js'

// Surface #3 — graph discovery (the discovery TYPES stay in `./types.ts`; the
// projector + lenses + match-or-mint runtime live in `./graph.ts`).
export type { Discovery, Lens, LensCtx, Match } from './types.js'
export { makeDiscovery, discovery, envelope, inMemoryMatcher, ENVELOPE_API } from './graph.js'
export type { DiscoveryPorts, Matcher, EnvelopeOpts } from './graph.js'

// Wire — the locked ResponseEnvelope
export type { ResponseEnvelope } from './types.js'
