/**
 * Archetype catalog — eagerly registers the ten seed archetypes per v3 §S2
 * on the singleton {@link archetypes} registry, and re-exports each
 * materialised value as a named binding so consumers can `import { Summarization }`
 * directly.
 *
 * Registration is idempotent within a process: importing this module multiple
 * times still yields a single set of registered archetypes (the registry
 * throws on duplicate `id`, which we catch on the second import path).
 *
 * @packageDocumentation
 */

import { archetypes, type ServiceArchetype, type ServiceArchetypeRef } from './registry.js'
import { defaultArchetypes } from './defaults.js'

// ============================================================================
// Registration (eager, idempotent)
// ============================================================================

const ensure = (id: ServiceArchetypeRef): ServiceArchetype => {
  const existing = archetypes.get(id)
  if (existing) return existing
  const spec = defaultArchetypes.find((a) => a.id === id)
  if (!spec) throw new Error(`Default archetype missing: ${id}`)
  return archetypes.register(spec)
}

/** All ten seed archetypes, registered + materialised. */
export const archetypeCatalog: ReadonlyArray<ServiceArchetype> = defaultArchetypes.map((spec) =>
  ensure(spec.id)
)

// ============================================================================
// Named exports (one per seed archetype)
// ============================================================================

/** Cold outbound outreach — multi-record async-push send-and-track. */
export const ColdOutbound = ensure('cold-outbound')

/** Data enrichment — batch row-by-row enrichment + normalisation. */
export const DataEnrichment = ensure('data-enrichment')

/** Document extraction — async-poll OCR + LLM structured extraction. */
export const DocumentExtraction = ensure('document-extraction')

/** Multi-step research — streaming multi-tool investigation + report. */
export const MultiStepResearch = ensure('multi-step-research')

/** RAG with clarification — sync retrieval-augmented Q&A with optional clarify. */
export const RagWithClarification = ensure('rag-with-clarification')

/** Transactional workflow — event-triggered multi-step workflow with HITL. */
export const TransactionalWorkflow = ensure('transactional-workflow')

/** Content generation — long-form streaming draft + revision loop. */
export const ContentGeneration = ensure('content-generation')

/** Quality review — sync rubric-driven scoring of submitted work. */
export const QualityReview = ensure('quality-review')

/** Triage — single-shot classification + routing on confidence. */
export const Triage = ensure('triage')

/** Summarization — single-call LLM summary; default archetype for tier-0. */
export const Summarization = ensure('summarization')
