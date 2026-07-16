// =====================================================================================
// autonomous-startups — the capstone conceptual primitive.
//
// The abstract self-running startup: a definition kit that composes exactly five
// primitives — business-as-code, services-as-software, digital-products, digital-tools,
// and digital-workers — and walks a construct through its construction lifecycle
// (idea → named → sited → sellable → running), with every mutating transition gated by
// @org.ai/authority at the type level. Pure domain: no HTTP, no db, no platform coupling.
//
// It defines what an autonomous startup IS (the G3 abstraction in the G1–G5 ladder).
// standards seed the graph (G1) → the .org.ai properties canonicalize it (G2) → this
// primitive + the builders build the abstract artifact (G3) → a brand + offer mint the
// startup (G4) → tenants run it on startups.studio (G5). startups.org.ai is its canon;
// startups.studio is its venue; a live running startup is its G5 instance.
// =====================================================================================

// The five-primitive composition.
export type { StartupComposition, BusinessModel, Offer, Product, Tool, Worker, WorkerType } from './composition.js'

// The construction lifecycle.
export {
  LIFECYCLE_STATES,
  NEXT_STATE,
  TRANSITION_DOMAIN,
  legalNextStates,
  canTransition,
} from './lifecycle.js'
export type { LifecycleState, NonTerminalState, NextOf, DomainOf } from './lifecycle.js'

// The capstone construct.
export { defineStartup, advance, toStartupNoun } from './startup.js'
export type { StartupSpec, AutonomousStartup } from './startup.js'

// Readiness validation.
export { validateStartup } from './validate.js'
export type { ValidationResult, ValidationIssue, IssueSeverity } from './validate.js'
