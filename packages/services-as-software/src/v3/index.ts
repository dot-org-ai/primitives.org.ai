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
// The five UI override shapes (CatalogShape / OrderShape / OnboardingShape /
// DeliveryShape / PortalShape) live in `./shapes/types.ts` now — re-exported
// in the UI shapes block below to avoid double-declaration.
export type { ServiceSpec, OversightPolicy } from './service-spec.js'

// ServiceInstance (read-only shape returned by Service.define).
// Note: `InvocationHandle` and `InvokeOpts` are re-exported from
// `./service.js` (which re-imports from `./invoke/`) so legacy imports keep
// working; the canonical source is the `./invoke/` block below.
export type {
  ServiceInstance,
  VerifyOpts,
  VerificationReport,
  VerificationFailure,
  VerificationEvaluatorPass,
  VerifyFixture,
  PublishOpts,
  MarketplaceListing,
  MarketplaceListingProvenance,
  MarketplaceListingRendered,
  MarketplaceVisibility,
  RuntimeUnit,
  RuntimeUnitCommitment,
  RuntimeUnitContract,
  RuntimeUnitDemand,
  RuntimeUnitFulfillment,
  RuntimeUnitMarketplace,
} from './service.js'

// ----------------------------------------------------------------------------
// Service.verify + Service.publish + marketplace persistence (v3 §10 + §11)
// ----------------------------------------------------------------------------

export { verifyService } from './service/verify.js'
export { publishService } from './service/publish.js'
export { requiresReverify, BEHAVIORAL_FIELDS } from './service/reverify-policy.js'

export {
  marketplaceStore,
  runtimeUnitStore,
  type MarketplaceListFilter,
  type RuntimeUnitListFilter,
} from './marketplace/index.js'

// ----------------------------------------------------------------------------
// Service.invoke — handle, FSM, event union, options, runtime factory
// (v3 §5 + §10; lives in `./invoke/`)
// ----------------------------------------------------------------------------

export type {
  InvocationHandle,
  InvocationState,
  Transition,
  InvocationEvent,
  ClarificationRequest,
  ClarificationResponse,
  InvokeOpts,
  WorkerRef,
} from './invoke/index.js'
export {
  TRANSITIONS,
  isTerminal,
  isWaitingOnCustomer,
  canTransition,
  InvocationHandleImpl,
  createInvocationHandle,
} from './invoke/index.js'

// ----------------------------------------------------------------------------
// Service namespace value + lifecycle FSM (v3 §5 + §10)
// ----------------------------------------------------------------------------

export { Service, define, fromFunction, load } from './service/index.js'
export type { FromFunctionOpts } from './service/index.js'

export {
  ServiceLifecycle,
  ServicePublishError,
  mintServiceId,
  expandDoSugar,
  NotImplementedError,
} from './service/index.js'
export type {
  ServiceLifecycleState,
  ServiceSpecWithDoSugar,
  TierZeroDoCallback,
} from './service/index.js'

// ----------------------------------------------------------------------------
// UI shapes (v3 §8) — six value types + six derive functions + KNOWN_PROVIDERS
// (`InvocationState` is canonical above from `./invoke/`; not re-exported here.)
// ----------------------------------------------------------------------------

export type {
  // Aggregates
  ServiceShapes,
  Duration,
  // Catalog
  CatalogShape,
  CatalogHero,
  PricingSummary,
  CatalogSocialProofSlot,
  ArchetypePreviewMode,
  CatalogComparisonRow,
  // Order
  OrderShape,
  OrderFlow,
  OrderStep,
  OrderLegal,
  // Onboarding
  OnboardingShape,
  IntegrationRequirement,
  VerificationRequirement,
  PrerequisiteRequirement,
  WelcomeStep,
  // Delivery
  DeliveryShape,
  ProgressIndicator,
  PreviewSlot,
  HITLState,
  HITLChannel,
  HITLTimeoutBehaviour,
  HITLTouchpoint,
  // Portal
  PortalShape,
  PortalFilterableColumn,
  PortalSubscriptionView,
  PortalDisputeFlow,
  // Integrations
  IntegrationsShape,
  IntegrationsProvider,
  // Known-providers metadata
  KnownProviderMeta,
} from './shapes/index.js'

export {
  KNOWN_PROVIDERS,
  parseToolPermission,
  providerScopesFor,
  providerDisplayName,
  deriveCatalog,
  deriveOrder,
  deriveOnboarding,
  deriveDelivery,
  derivePortal,
  deriveIntegrations,
  deriveAll,
} from './shapes/index.js'
