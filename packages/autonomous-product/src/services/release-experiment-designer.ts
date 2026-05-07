/**
 * Release Experiment Designer Service — A/B test design + analysis-plan
 * authoring Service for the product-management catalog.
 *
 * Distinguishing shape vs. siblings (`prd-author`,
 * `customer-feedback-synthesizer`, `roadmap-tradeoff-evaluator`,
 * `feature-deprecation-coordinator`, `jobs-to-be-done-clusterer`):
 *   - `quality-review` archetype — the artefact is a data-PM-and-eng-lead-
 *     reviewed experiment specification (hypothesis + variants + sample-size +
 *     duration + guardrails) plus a paired analysis plan (primary + secondary
 *     metrics + segmentation + stopping rules), not a PRD or a research
 *     synthesis;
 *   - 5-step cascade: Code fan-in (feature context + traffic baseline +
 *     segment availability) → Generative (design-experiment: hypothesis +
 *     variants + sample-size + duration + guardrails) → Generative (draft-
 *     analysis-plan: primary-and-secondary-metrics + segmentation + stopping-
 *     rules) → Human (data-PM + eng-lead review) → Code fan-out (emit-
 *     experiment-spec + register-with-experimentation-platform);
 *   - `Pricing.outcome` 3 tiers keyed on the complexity of the experiment —
 *     feature-toggle / multi-variant / multi-segment ($499 / $1,999 / $4,999)
 *     — a multi-segment power-analysis is worth more than a binary toggle;
 *   - declarative HITL = mandatory data-PM + eng-lead sign-off Human Function
 *     (statistical-validity authority and traffic-impact authority cannot be
 *     delegated; uses `'approval'` rationale because the experiment ships only
 *     when both sign off on the design), plus OutcomeContract requires data-PM
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(power-analysis-
 *     soundness + guardrail-coverage + analysis-plan-clarity) +
 *     HumanSign(data-PM))`;
 *   - EvaluatorPanel includes `Personas.edgeCaseCoverage({
 *     minEdgeCasesPerScenario: 4 })` because the experiment must enumerate
 *     at least four edge cases per primary scenario (segment skew, traffic
 *     ramp anomalies, guardrail-trip handling, partial-failure recovery)
 *     before the data-PM signs, plus `Personas.timelineRealism({
 *     dependencyAware: true })` because experiment duration carries
 *     dependency-aware schedule realism (sample-size accrual, segment-
 *     availability ramp, holdout windows).
 *
 * Per design v3 §3 (Catalog HOW product) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `experiment-decision-actionability-and-time-to-decision`
 * — the compound metric every product org optimises against (the designer is
 * worth running iff the per-experiment decision is actionable end-to-end +
 * the time-to-decision drops vs. the pre-Service baseline of bespoke
 * experiment-spec authoring).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a feature is ready-to-launch and the team has defined an
 * experiment hypothesis. Tight: 8 fields cover the artefact identity,
 * the experiment complexity tier (feature-toggle / multi-variant / multi-
 * segment — resolves the outcome tier at intake), the assigned data-PM
 * + eng-lead (Human review routing), the feature pointer, the team-
 * authored hypothesis, the candidate experimentation platform, the
 * desired runtime ceiling, and the trigger stage gating intake.
 */
export const ExperimentDesignInputSchema = z.object({
  artefactId: z.string(),
  experimentComplexity: z.enum(['feature-toggle', 'multi-variant', 'multi-segment']),
  assignedDataPmRef: z.string(),
  assignedEngLeadRef: z.string(),
  featureRef: z.string(),
  hypothesisStatement: z.string().min(1),
  experimentationPlatform: z.enum(['statsig', 'launchdarkly', 'optimizely', 'split', 'in-house']),
  maxRuntimeDays: z.number().int().positive(),
  triggerStage: z.literal('ready-to-launch'),
})

/**
 * Output — a data-PM-and-eng-lead-reviewed experiment specification + paired
 * analysis plan, the review audit, and pointers to the registered
 * experiment artefacts on the experimentation platform.
 */
export const ExperimentSpecOutputSchema = z.object({
  artefactId: z.string(),
  featureRef: z.string(),
  experimentDesign: z.object({
    hypothesisStatement: z.string(),
    variants: z
      .array(
        z.object({
          variantId: z.string(),
          name: z.string(),
          allocationPercent: z.number().min(0).max(100),
          isControl: z.boolean(),
        })
      )
      .min(2),
    sampleSize: z.object({
      perVariant: z.number().int().positive(),
      total: z.number().int().positive(),
      mde: z.number().positive(),
      power: z.number().min(0).max(1),
      significanceLevel: z.number().min(0).max(1),
    }),
    durationDays: z.number().int().positive(),
    guardrails: z
      .array(
        z.object({
          guardrailId: z.string(),
          metric: z.string(),
          tripCondition: z.string(),
          autoStop: z.boolean(),
        })
      )
      .min(1),
  }),
  analysisPlan: z.object({
    primaryMetric: z.object({
      metricId: z.string(),
      name: z.string(),
      direction: z.enum(['increase', 'decrease']),
    }),
    secondaryMetrics: z
      .array(
        z.object({
          metricId: z.string(),
          name: z.string(),
          direction: z.enum(['increase', 'decrease']),
        })
      )
      .default([]),
    segmentation: z
      .array(
        z.object({
          segmentId: z.string(),
          definition: z.string(),
        })
      )
      .default([]),
    stoppingRules: z
      .array(
        z.object({
          ruleId: z.string(),
          condition: z.string(),
          action: z.enum(['stop-and-ship', 'stop-and-rollback', 'extend-runtime', 'escalate']),
        })
      )
      .min(1),
  }),
  reviewAudit: z.object({
    dataPmRef: z.string(),
    engLeadRef: z.string(),
    decision: z.enum(['accept', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    experimentSpecUrl: z.string(),
    platformExperimentId: z.string(),
    registeredAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type ExperimentDesignInput = z.infer<typeof ExperimentDesignInputSchema>
export type ExperimentSpecOutput = z.infer<typeof ExperimentSpecOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_decisionActionabilityAndTimeToDecision: RewardSignal = {
  keyResultRef:
    'kr:release-experiment-designer:experiment-decision-actionability-and-time-to-decision',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:release-experiment-designer:intake-coverage',
}
const kr_powerAnalysisSoundness: RewardSignal = {
  keyResultRef: 'kr:release-experiment-designer:power-analysis-soundness',
}
const kr_analysisPlanClarity: RewardSignal = {
  keyResultRef: 'kr:release-experiment-designer:analysis-plan-clarity',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:release-experiment-designer:emit-latency',
}

// ============================================================================
// Release Experiment Designer Service
// ============================================================================

/**
 * Release Experiment Designer — feature-ready-to-launch + experiment-
 * hypothesis-defined trigger → data-PM-and-eng-lead-reviewed experiment
 * spec + analysis plan registered on the experimentation platform as a
 * Service.
 *
 * Cascade: fetch-feature-context-traffic-baseline-and-segment-availability (Code, fan-in)
 *        → design-experiment-hypothesis-variants-sample-size-duration-and-guardrails (Generative)
 *        → draft-analysis-plan-primary-and-secondary-metrics-segmentation-and-stopping-rules (Generative)
 *        → data-pm-and-eng-lead-review (Human, approval rationale)
 *        → emit-experiment-spec-and-register-with-experimentation-platform (Code, fan-out).
 */
export const releaseExperimentDesigner: ServiceInstance<
  ExperimentDesignInput,
  ExperimentSpecOutput
> = Service.define<ExperimentDesignInput, ExperimentSpecOutput>({
  name: 'Release Experiment Designer',
  promise:
    'Every feature ready-to-launch gets a data-PM-and-eng-lead-signed A/B-test spec with a paired analysis plan — sound power analysis, complete guardrails, explicit stopping rules — so teams spend the cycle on the decision, not on experiment-design assembly.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: ExperimentDesignInputSchema, output: ExperimentSpecOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-feature-context-traffic-baseline-and-segment-availability',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'design-experiment-hypothesis-variants-sample-size-duration-and-guardrails',
        reward: kr_powerAnalysisSoundness,
      }),
      Generative({
        name: 'draft-analysis-plan-primary-and-secondary-metrics-segmentation-and-stopping-rules',
        reward: kr_analysisPlanClarity,
      }),
      Human({
        name: 'data-pm-and-eng-lead-review',
        // `approval` rationale: statistical-validity authority (data-PM) +
        // traffic-impact authority (eng-lead) cannot be delegated. The
        // experiment registers only when both have signed off on the design.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-experiment-spec-and-register-with-experimentation-platform',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'statsig.experiments',
      'launchdarkly.flags',
      'optimizely.experiments',
      'amplitude.cohorts',
      'mixpanel.events',
      'segment.traits',
      'docs.write',
    ],
    // Experiment design: clarification disabled — the cascade synthesises
    // from feature context + traffic baseline + segment availability; the
    // data-PM + eng-lead review step is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Multi-segment-complexity experiments escalate the design step to
        // a senior experimentation supervisor before the data-PM + eng-lead
        // review (the segment-skew + sample-size compounding compounds at
        // multi-segment scope).
        when: 'experimentComplexity == "multi-segment"',
        action: 'escalate',
      },
      {
        // Every experiment routes through data-PM + eng-lead review before
        // the spec emits; OutcomeContract enforces the data-PM signature,
        // the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'data-pm-and-eng-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:release-experiment-designer-review',
    personas: [
      // Power-analysis-soundness reviewer — pedantic check that the sample-
      // size calculation cites the MDE, the power, and the significance
      // level coherently, that variant allocations sum to 100, and that the
      // duration is internally consistent with the per-variant sample-size
      // accrual rate implied by the traffic baseline.
      Personas.pedantic({
        domain: 'power-analysis-soundness',
        rubric: [
          'mde-power-and-significance-level-cited',
          'variant-allocations-sum-to-100',
          'duration-consistent-with-sample-size-accrual',
          'control-variant-explicitly-named',
        ],
        name: 'power-analysis-soundness-checker',
      }),
      // Guardrail-coverage reviewer — pedantic check that every experiment
      // has at least one auto-stop guardrail, that guardrail trip-conditions
      // are concrete (not aspirational), and that the guardrail set covers
      // the load-bearing risks (latency / error-rate / business-metric).
      Personas.pedantic({
        domain: 'guardrail-coverage',
        rubric: [
          'at-least-one-auto-stop-guardrail-present',
          'trip-conditions-concrete-not-aspirational',
          'load-bearing-risks-covered',
          'no-orphaned-guardrails',
        ],
        name: 'guardrail-coverage-checker',
      }),
      // Analysis-plan-clarity reviewer — adversarially probes whether the
      // analysis plan's primary metric is unambiguously named with a
      // direction, whether stopping rules cover both ship and rollback
      // paths, and whether segmentation cuts are pre-registered (not
      // post-hoc fishing).
      Personas.skeptic({
        domain: 'analysis-plan-clarity',
        focus: [
          'primary-metric-unambiguously-named-with-direction',
          'stopping-rules-cover-ship-and-rollback',
          'segmentation-pre-registered-not-post-hoc',
          'no-vague-success-language',
        ],
        name: 'analysis-plan-clarity-reviewer',
      }),
      // Edge-case-coverage reviewer — at least 4 edge cases per primary
      // scenario (segment skew, traffic-ramp anomalies, guardrail-trip
      // handling, partial-failure recovery) before the data-PM signs.
      Personas.edgeCaseCoverage({
        minEdgeCasesPerScenario: 4,
        name: 'edge-case-coverage-checker',
      }),
      // Timeline-realism reviewer — dependency-aware schedule realism
      // covering sample-size accrual, segment-availability ramp, and
      // holdout windows declared in the experiment design.
      Personas.timelineRealism({
        dependencyAware: true,
        name: 'timeline-realism-checker',
      }),
      // Product domain reviewer — pulls the senior-product-manager expert
      // for judgment on the overall experiment-spec quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/ProductManagers',
        name: 'product-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:release-experiment-designer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-product-manager',
    seller: 'svc:release-experiment-designer',
    serviceRef: 'svc:release-experiment-designer',
    // Data-PM signs every experiment spec before it registers with the
    // experimentation platform — statistical-validity authority cannot be
    // delegated.
    predicate: AND(
      SchemaMatch(ExperimentSpecOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['data-pm'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 199900n, currency: 'USD' },
    // 3-day SLA — experiment design takes a half-week from ready-to-launch
    // intake to data-PM-signed spec.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'feature-toggle', amount: 49900n },
      { id: 'multi-variant', amount: 199900n },
      { id: 'multi-segment', amount: 499900n },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 6500n, perApiCall: 14n },
  reward: kr_decisionActionabilityAndTimeToDecision,

  lineage: {
    cellRef: 'business.org.ai/cells/product-managers/release-experiment-designer',
    icpContextProblemRef: 'icp:release-experiment-designer:v1',
    foundingHypothesisRef: 'fh:release-experiment-designer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
