// =====================================================================================
// autonomous-startups — the capstone conceptual primitive.
//
// The abstract self-running startup: a definition kit that COMPOSES conceptual primitives
// — `CANONICAL_FIVE` by default (business-as-code, services-as-software, digital-products,
// digital-tools, digital-workers), extensible via the primitive registry (e.g. the composable
// `demand` register) — and walks a construct through lifecycle@1, a versioned stategraph
// (advance / revert / pivot / dissolve / rename, with a `live` predicate). Every mutating
// edge is gated by @org.ai/authority at the type level. Pure domain: no HTTP, no db, no
// platform coupling.
//
// It defines what an autonomous startup IS (the G3 abstraction in the G1–G5 ladder).
// standards seed the graph (G1) → the .org.ai properties canonicalize it (G2) → this
// primitive + the builders build the abstract artifact (G3) → a brand + offer mint the
// startup (G4) → tenants run it on startups.studio (G5). startups.org.ai is its canon;
// startups.studio is its venue; a live running startup is its G5 instance.
// =====================================================================================

// The composition: registry, profiles, and compose().
export {
  PRIMITIVE_REGISTRY,
  CANONICAL_FIVE,
  CANONICAL_FIVE_IDS,
  resolveProfile,
  profileHas,
  compose,
  defineStartup,
} from './primitives.js'
export type { PrimitiveId, SlotName, Cardinality, Primitive, Profile, StartupBlueprint } from './primitives.js'

// The five bound registers + the composable demand slot.
export type { StartupComposition, BusinessModel, Offer, Product, Tool, Worker, WorkerType, DemandRegister } from './composition.js'
export type { Problem, Market } from './demand.js'

// lifecycle@1 — the versioned stategraph.
export {
  LIFECYCLE_VERSION,
  LIFECYCLE_STATES,
  LIVE_STATES,
  TERMINAL_STATES,
  EDGE_KINDS,
  STATEGRAPH,
  NEXT_STATE,
  TRANSITION_DOMAIN,
  isLive,
  edgesFrom,
  edgeFor,
  canTransition,
  legalNextStates,
} from './lifecycle.js'
export type {
  LifecycleVersion,
  LifecycleState,
  LiveState,
  TerminalState,
  EdgeKind,
  LifecycleEdge,
  AdvanceableState,
  RevertableState,
  PivotableState,
  NextOf,
  PrevOf,
  AdvanceDomainOf,
  RevertDomainOf,
  PivotDomain,
  DissolveDomain,
  RenameDomain,
} from './lifecycle.js'

// The capstone construct + the lifecycle@1 edge functions.
export { advance, revert, pivot, dissolve, rename, toStartupNoun } from './startup.js'
export type { StartupSpec, AutonomousStartup, LineageEntry } from './startup.js'

// Readiness validation.
export { validateStartup } from './validate.js'
export type { ValidationResult, ValidationIssue, IssueSeverity } from './validate.js'
