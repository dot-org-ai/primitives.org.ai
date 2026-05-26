/**
 * Default archetype specs — the ten seed entries shipped per v3 §S2.
 *
 * Each spec is a plain value (no side effects). `./catalog.ts` registers
 * them on the singleton `archetypes` registry and re-exports the materialised
 * values; consumers that want to construct their own registry import
 * {@link defaultArchetypes} directly.
 *
 * Cost estimates are coarse-grained ($0.005–$5.00 ranges typical of LLM-cost
 * UX) and serve as catalog hints, not billing inputs. Real per-invocation
 * cost lives on each Service's `costModel`.
 *
 * @packageDocumentation
 */

import type { Money } from 'business-as-code/finance'
import type { ServiceArchetypeSpec } from './registry.js'

// ============================================================================
// Internal helpers
// ============================================================================

/** Build a Money value at USD precision (cents in smallest unit). */
const usd = (cents: bigint): Money => ({ amount: cents, currency: 'USD' })

// ============================================================================
// Ten seed archetypes (per v3 §S2)
// ============================================================================

const coldOutbound: ServiceArchetypeSpec = {
  id: 'cold-outbound',
  label: 'Cold outbound outreach',
  defaultDeliveryPattern: 'asynchronous-push',
  inputShape: 'records',
  outputShape: 'records',
  defaultOversight: { defaultMode: 'supervised', requiresHumanSignOff: true },
  defaultEvaluators: [
    {
      personaRef: 'persona:voice-and-style',
      signOff: 'panel',
      description: 'Brand voice + tone alignment',
    },
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Claim grounding against contact data',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(5n),
    maxPerInvocation: usd(50n),
    notes: 'Per-contact LLM gen + enrichment lookup',
  },
}

const dataEnrichment: ServiceArchetypeSpec = {
  id: 'data-enrichment',
  label: 'Data enrichment',
  defaultDeliveryPattern: 'batch',
  inputShape: 'records',
  outputShape: 'records',
  defaultOversight: { defaultMode: 'autonomous', requiresHumanSignOff: false },
  defaultEvaluators: [
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Source-attributed fact checking',
    },
    {
      personaRef: 'persona:coverage-pedant',
      signOff: 'panel',
      description: 'Field-level coverage floor',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(2n),
    maxPerInvocation: usd(25n),
    notes: 'Per-row enrichment via API + LLM normalisation',
  },
}

const documentExtraction: ServiceArchetypeSpec = {
  id: 'document-extraction',
  label: 'Document extraction',
  defaultDeliveryPattern: 'asynchronous-poll',
  inputShape: 'document',
  outputShape: 'structured-record',
  defaultOversight: { defaultMode: 'supervised', requiresHumanSignOff: true },
  defaultEvaluators: [
    {
      personaRef: 'persona:pedantic-validator',
      signOff: 'panel',
      description: 'Strict schema + value-range validation',
    },
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Document-grounded value verification',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(10n),
    maxPerInvocation: usd(200n),
    notes: 'OCR + LLM extraction; multi-page docs scale linearly',
  },
}

const multiStepResearch: ServiceArchetypeSpec = {
  id: 'multi-step-research',
  label: 'Multi-step research',
  defaultDeliveryPattern: 'streaming',
  inputShape: 'query',
  outputShape: 'document',
  defaultOversight: { defaultMode: 'supervised', requiresHumanSignOff: true },
  defaultEvaluators: [
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Source-grounded claim verification',
    },
    {
      personaRef: 'persona:domain-expert',
      signOff: 'panel',
      description: 'Subject-matter expertise check',
    },
    {
      personaRef: 'persona:skeptic',
      signOff: 'panel',
      description: 'Adversarial counterfactual probing',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(50n),
    maxPerInvocation: usd(500n),
    notes: 'Multi-tool, multi-LLM-round investigation',
  },
}

const ragWithClarification: ServiceArchetypeSpec = {
  id: 'rag-with-clarification',
  label: 'RAG with clarification',
  defaultDeliveryPattern: 'synchronous',
  inputShape: 'query',
  outputShape: 'text',
  defaultOversight: { defaultMode: 'autonomous', requiresHumanSignOff: false },
  defaultEvaluators: [
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Citation faithfulness check',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(2n),
    maxPerInvocation: usd(20n),
    notes: 'Vector retrieval + single-shot LLM with optional clarify round',
  },
}

const transactionalWorkflow: ServiceArchetypeSpec = {
  id: 'transactional-workflow',
  label: 'Transactional workflow',
  defaultDeliveryPattern: 'asynchronous-push',
  inputShape: 'event',
  outputShape: 'decision',
  defaultOversight: { defaultMode: 'supervised', requiresHumanSignOff: true },
  defaultEvaluators: [
    {
      personaRef: 'persona:pedantic-validator',
      signOff: 'panel',
      description: 'Pre/post-condition validation',
    },
    {
      personaRef: 'persona:domain-expert',
      signOff: 'panel',
      description: 'Domain rule conformance',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(5n),
    maxPerInvocation: usd(75n),
    notes: 'Multi-step state-machine; cost dominated by external API + HITL gates',
  },
}

const contentGeneration: ServiceArchetypeSpec = {
  id: 'content-generation',
  label: 'Content generation',
  defaultDeliveryPattern: 'streaming',
  inputShape: 'text',
  outputShape: 'document',
  defaultOversight: { defaultMode: 'supervised', requiresHumanSignOff: true },
  defaultEvaluators: [
    {
      personaRef: 'persona:voice-and-style',
      signOff: 'panel',
      description: 'Brand voice + tone alignment',
    },
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Factual claim grounding',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(10n),
    maxPerInvocation: usd(150n),
    notes: 'Long-form draft + revision loop',
  },
}

const qualityReview: ServiceArchetypeSpec = {
  id: 'quality-review',
  label: 'Quality review',
  defaultDeliveryPattern: 'synchronous',
  inputShape: 'document',
  outputShape: 'classification',
  defaultOversight: { defaultMode: 'autonomous', requiresHumanSignOff: false },
  defaultEvaluators: [
    {
      personaRef: 'persona:pedantic-validator',
      signOff: 'panel',
      description: 'Rubric-driven scoring',
    },
    {
      personaRef: 'persona:domain-expert',
      signOff: 'panel',
      description: 'Subject-matter pass/fail',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(5n),
    maxPerInvocation: usd(50n),
    notes: 'Single-pass scoring; multi-axis rubric',
  },
}

const triage: ServiceArchetypeSpec = {
  id: 'triage',
  label: 'Triage',
  defaultDeliveryPattern: 'synchronous',
  inputShape: 'event',
  outputShape: 'classification',
  defaultOversight: { defaultMode: 'autonomous', requiresHumanSignOff: false },
  defaultEvaluators: [
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'Classification accuracy on holdout',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(1n),
    maxPerInvocation: usd(10n),
    notes: 'Single-shot classify; routes to specialist on low confidence',
  },
}

const summarization: ServiceArchetypeSpec = {
  id: 'summarization',
  label: 'Summarization',
  defaultDeliveryPattern: 'synchronous',
  inputShape: 'document',
  outputShape: 'text',
  defaultOversight: { defaultMode: 'autonomous', requiresHumanSignOff: false },
  defaultEvaluators: [
    {
      personaRef: 'persona:coverage-pedant',
      signOff: 'panel',
      description: 'Key-point coverage floor',
    },
    {
      personaRef: 'persona:accuracy-reviewer',
      signOff: 'panel',
      description: 'No-fabrication grounding check',
    },
  ],
  estimatedCost: {
    minPerInvocation: usd(1n),
    maxPerInvocation: usd(20n),
    notes: 'Single LLM call; cost scales with input length',
  },
}

// ============================================================================
// Bundle export
// ============================================================================

/**
 * The ten seed archetype specs in registration order. Plain values — no
 * side effects on import. `./catalog.ts` registers them on the singleton
 * registry and re-exports the materialised values.
 */
export const defaultArchetypes: ReadonlyArray<ServiceArchetypeSpec> = [
  coldOutbound,
  dataEnrichment,
  documentExtraction,
  multiStepResearch,
  ragWithClarification,
  transactionalWorkflow,
  contentGeneration,
  qualityReview,
  triage,
  summarization,
]
