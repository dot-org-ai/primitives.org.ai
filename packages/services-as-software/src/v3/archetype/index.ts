/**
 * ServiceArchetype — typed catalog of common Service shapes.
 *
 * v3 §S2 ships ten seed archetypes (cold-outbound, data-enrichment,
 * document-extraction, multi-step-research, rag-with-clarification,
 * transactional-workflow, content-generation, quality-review, triage,
 * summarization). Each archetype carries default delivery pattern,
 * input/output shape primitives, oversight defaults, evaluator persona hints,
 * cost estimate, and an optional hero-template UI layout for the catalog.
 *
 * `Service.define()` reads the archetype to fill in unset fields on the
 * Service spec; explicit fields on the spec always win.
 *
 * @packageDocumentation
 */

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
} from './registry.js'

export { ArchetypeRegistry, defineServiceArchetype, archetypes } from './registry.js'

export { defaultArchetypes } from './defaults.js'

export {
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
} from './catalog.js'
