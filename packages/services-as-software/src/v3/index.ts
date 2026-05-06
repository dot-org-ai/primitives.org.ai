/**
 * services-as-software v3 surface — barrel export.
 *
 * This file is collectively maintained by multiple v3-implementation agents.
 * Re-exports below are *additive* per-module: do not remove an export to
 * resolve a merge — pull both sides' exports into the same export block.
 *
 * @packageDocumentation
 */

// ----------------------------------------------------------------------------
// EvaluatorPanel + Personas (v3 §9)
// ----------------------------------------------------------------------------

export { EvaluatorPanel } from './evaluator-panel.js'
export type {
  EvaluatorPanelSpec,
  AgenticPersona,
  PanelVerdict,
  PanelRejection,
  PanelApproval,
  PanelRunContext,
} from './evaluator-panel.js'

export { Personas } from './personas.js'
export type {
  PedanticPersonaOpts,
  SkepticPersonaOpts,
  AccuracyPersonaOpts,
  VoicePersonaOpts,
  CoveragePersonaOpts,
  DomainPersonaOpts,
} from './personas.js'

// ----------------------------------------------------------------------------
// Foundation type layer (v3 §5 + §6 + §11)
// ----------------------------------------------------------------------------

// Scalar types
export type {
  Audience,
  SensitivityTier,
  Schema,
  InferOutput,
  ServiceRef,
  EvaluatorPanelRef,
} from './types.js'

// Binding (cascade + tool perms + clarification + triggers)
export type {
  ServiceBinding,
  BindingTrigger,
  BindingTriggerAction,
  ClarificationPolicy,
  ClarificationTrigger,
} from './binding.js'

// OutputContract (technical schema; distinct from autonomous-finance OutcomeContract)
export type { OutputContract, SchemaWithUI, FieldUIHint } from './output-contract.js'

// ServiceLineage (provenance: cell / ICP / hypothesis / studio / cascade run)
export type {
  ServiceLineage,
  WorkContextCellRef,
  IcpContextProblemRef,
  FoundingHypothesisRef,
  StudioThesisRef,
  VersionVector,
} from './lineage.js'

// ServiceArchetype registry + 10 seed catalog (v3 §S2)
export type {
  ServiceArchetypeRef,
  DeliveryPattern,
  InputShapePrimitive,
  OutputShapePrimitive,
  ArchetypeOversightDefaults,
  EvaluatorPersonaHint,
  ArchetypeCostEstimate,
  ArchetypeHeroTemplate,
  ServiceArchetype,
  ServiceArchetypeSpec,
} from './archetype/index.js'
export {
  ArchetypeRegistry,
  defineServiceArchetype,
  archetypes,
  defaultArchetypes,
  archetypeCatalog,
  ColdOutbound,
  DataEnrichment,
  DocumentExtraction,
  MultiStepResearch,
  RagWithClarification,
  TransactionalWorkflow,
  ContentGeneration,
  QualityReview,
  Triage,
  Summarization,
} from './archetype/index.js'

// ServiceSpec (input shape for the future Service.define factory).
// Note: `EvaluatorPanel` itself is exported above from './evaluator-panel.js'
// — `service-spec.ts` consumes that real type, no placeholder needed.
export type {
  ServiceSpec,
  OversightPolicy,
  CatalogShape,
  OrderShape,
  OnboardingShape,
  DeliveryShape,
  PortalShape,
} from './service-spec.js'

// ServiceInstance (read-only shape returned by Service.define)
export type {
  ServiceInstance,
  InvokeOpts,
  InvocationHandle,
  VerifyOpts,
  VerificationReport,
  PublishOpts,
  MarketplaceListing,
} from './service.js'
