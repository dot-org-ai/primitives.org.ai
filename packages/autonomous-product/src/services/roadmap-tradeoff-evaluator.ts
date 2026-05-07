/**
 * Roadmap Tradeoff Evaluator Service — quarterly-roadmap tradeoff modeling
 * Service for the product-management catalog.
 *
 * Distinguishing shape vs. siblings (`prd-author`,
 * `customer-feedback-synthesizer`):
 *   - `forecast-narrative` archetype — the artefact is a VP-Product-and-VP-
 *     Eng-and-CFO-signed roadmap decision memo (tradeoff scenarios + primary
 *     recommendation + second-best alternatives + rationale), not a PRD or a
 *     multi-source feedback synthesis;
 *   - 5-step cascade: Code fan-in (feature candidates + revenue-impact
 *     estimates + eng-cost estimates + strategic priorities) → Generative
 *     (model tradeoffs and scenarios) → Generative (draft recommendation
 *     with rationale and second-best alternatives) → Human (VP-Product +
 *     VP-Eng + CFO review) → Code fan-out (roadmap decision memo);
 *   - `Pricing.outcome` 3 tiers keyed on the scope of the planning exercise
 *     — team / function / company-wide ($4,999 / $19,999 / $49,999) — a
 *     company-wide quarterly-planning evaluation is worth more than a
 *     single-team roadmap tradeoff;
 *   - declarative HITL = mandatory VP-Product + VP-Eng + CFO sign-off Human
 *     Function (cross-functional decision authority cannot be delegated;
 *     uses `'approval'` rationale because the spend-and-sequence decision
 *     is the value the customer pays for), plus OutcomeContract requires
 *     VP-Product signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(scenario-completeness
 *     + tradeoff-realism + recommendation-rationale) + HumanSign(vp-product))`;
 *   - EvaluatorPanel includes `Personas.budgetRealism({ budgetType: 'all' })`
 *     and `Personas.timelineRealism({ criticalPathRequired: true })` because
 *     roadmap tradeoffs carry load-bearing cost / scope / timeline claims
 *     across multiple candidates and the critical-path declaration is the
 *     load-bearing artefact the executive trio reads.
 *
 * Per design v3 §3 (Catalog HOW product) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `roadmap-decision-cycle-time-and-q-target-hit-rate`
 * — the compound metric every product org optimises against (the evaluator
 * is worth running iff per-quarter decision cycle time drops + a higher
 * fraction of greenlit features hit their quarter target vs. the pre-Service
 * baseline).
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
 * Input — a quarterly-planning cycle fires + at least 5 feature candidates
 * have been submitted. Tight: 7 fields cover the cycle identity, the planning
 * scope (team / function / company-wide — resolves the outcome tier at
 * intake), the assigned VP-Product / VP-Eng / CFO (Human review routing),
 * the planning quarter, the candidate-feature pointers, and the trigger
 * stage gating intake.
 */
export const RoadmapPlanningInputSchema = z.object({
  cycleId: z.string(),
  planningScope: z.enum(['team', 'function', 'company-wide']),
  assignedVpProductRef: z.string(),
  assignedVpEngRef: z.string(),
  assignedCfoRef: z.string(),
  planningQuarter: z.string(), // e.g. '2026-Q3'
  candidateFeatureRefs: z.array(z.string()).min(5),
  triggerStage: z.literal('quarterly-planning'),
})

/**
 * Output — a VP-Product + VP-Eng + CFO signed roadmap decision memo: the
 * tradeoff scenarios modeled across the candidate slate, the primary
 * recommendation with rationale, the second-best alternatives, the executive
 * trio review audit, and pointers to the emitted decision memo.
 */
export const RoadmapDecisionOutputSchema = z.object({
  cycleId: z.string(),
  planningQuarter: z.string(),
  scenarios: z
    .array(
      z.object({
        scenarioId: z.string(),
        narrative: z.string(),
        includedFeatureRefs: z.array(z.string()).min(1),
        revenueImpactUsd: z.number(),
        engCostWeeks: z.number().int().nonnegative(),
        strategicAlignmentScore: z.number().min(0).max(1),
        criticalPath: z.array(z.string()).min(1),
      })
    )
    .min(2),
  primaryRecommendation: z.object({
    scenarioRef: z.string(),
    rationaleMarkdown: z.string(),
    expectedQuarterTargetHitRate: z.number().min(0).max(1),
  }),
  secondBestAlternatives: z
    .array(
      z.object({
        scenarioRef: z.string(),
        triggerCondition: z.string(),
        rationale: z.string(),
      })
    )
    .min(1),
  reviewAudit: z.object({
    vpProductRef: z.string(),
    vpEngRef: z.string(),
    cfoRef: z.string(),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    signedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    decisionMemoUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type RoadmapPlanningInput = z.infer<typeof RoadmapPlanningInputSchema>
export type RoadmapDecisionOutput = z.infer<typeof RoadmapDecisionOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_decisionCycleTimeAndHitRate: RewardSignal = {
  keyResultRef: 'kr:roadmap-tradeoff-evaluator:roadmap-decision-cycle-time-and-q-target-hit-rate',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:roadmap-tradeoff-evaluator:intake-coverage',
}
const kr_scenarioCompleteness: RewardSignal = {
  keyResultRef: 'kr:roadmap-tradeoff-evaluator:scenario-completeness',
}
const kr_recommendationRationale: RewardSignal = {
  keyResultRef: 'kr:roadmap-tradeoff-evaluator:recommendation-rationale',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:roadmap-tradeoff-evaluator:emit-latency',
}

// ============================================================================
// Roadmap Tradeoff Evaluator Service
// ============================================================================

/**
 * Roadmap Tradeoff Evaluator — quarterly-planning + ≥5 candidate features →
 * VP-Product + VP-Eng + CFO signed roadmap decision memo (scenarios +
 * primary recommendation + second-best alternatives) as a Service.
 *
 * Cascade: fetch-feature-candidates-revenue-eng-cost-and-strategic-priorities (Code, fan-in)
 *        → model-tradeoffs-and-scenarios (Generative)
 *        → draft-recommendation-with-rationale-and-second-best-alternatives (Generative)
 *        → vp-product-and-vp-eng-and-cfo-review (Human, approval rationale)
 *        → emit-roadmap-decision-memo (Code, fan-out).
 */
export const roadmapTradeoffEvaluator: ServiceInstance<
  RoadmapPlanningInput,
  RoadmapDecisionOutput
> = Service.define<RoadmapPlanningInput, RoadmapDecisionOutput>({
  name: 'Roadmap Tradeoff Evaluator',
  promise:
    'Every quarterly-planning cycle gets a VP-Product-and-VP-Eng-and-CFO-signed decision memo — tradeoff scenarios modeled, primary recommendation with rationale, second-best alternatives — so leadership spends the cycle on the decision, not on assembly.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: { input: RoadmapPlanningInputSchema, output: RoadmapDecisionOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-feature-candidates-revenue-eng-cost-and-strategic-priorities',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'model-tradeoffs-and-scenarios',
        reward: kr_scenarioCompleteness,
      }),
      Generative({
        name: 'draft-recommendation-with-rationale-and-second-best-alternatives',
        reward: kr_recommendationRationale,
      }),
      Human({
        name: 'vp-product-and-vp-eng-and-cfo-review',
        // `approval` rationale: cross-functional decision authority across
        // the executive trio cannot be delegated. The memo ships only when
        // all three have signed off on the spend-and-sequence decision.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-roadmap-decision-memo',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'jira.epics',
      'productboard.features',
      'salesforce.opportunities',
      'finance.eng-cost-model',
      'strategy.priorities',
      'docs.write',
      'pdf.render',
    ],
    // Roadmap evaluation: clarification disabled — the cascade synthesises
    // from feature candidates + revenue + eng-cost + strategy; the executive
    // trio review step is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Company-wide-scope cycles escalate the scenario synthesis to a
        // senior product-strategy supervisor before the executive trio
        // review (the cross-portfolio blast-radius compounds at company
        // scope).
        when: 'planningScope == "company-wide"',
        action: 'escalate',
      },
      {
        // Every cycle routes through VP-Product + VP-Eng + CFO review
        // before the memo emits; OutcomeContract enforces the VP-Product
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'vp-product-and-vp-eng-and-cfo-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:roadmap-tradeoff-evaluator-review',
    personas: [
      // Scenario-completeness reviewer — pedantic check that the slate
      // covers a defensible spread of scenarios (not just the favored
      // path), that each scenario is internally consistent, and that no
      // scenario silently omits a candidate from the slate.
      Personas.pedantic({
        domain: 'scenario-completeness',
        rubric: [
          'slate-covers-defensible-scenario-spread',
          'each-scenario-internally-consistent',
          'no-silent-candidate-omissions',
          'critical-path-declared-per-scenario',
        ],
        name: 'scenario-completeness-checker',
      }),
      // Tradeoff-realism reviewer — adversarially probes whether the
      // revenue-impact + eng-cost + strategic-alignment numbers reflect
      // realistic estimates vs. wishful round numbers, and whether the
      // tradeoff narrative names the costs of the favored scenario.
      Personas.skeptic({
        domain: 'tradeoff-realism',
        focus: [
          'revenue-numbers-grounded-in-pipeline-or-history',
          'eng-cost-numbers-coherent-with-historical-velocity',
          'favored-scenario-acknowledges-costs',
          'no-wishful-round-numbers',
        ],
        name: 'tradeoff-realism-reviewer',
      }),
      // Recommendation-rationale reviewer — pedantic check that the
      // primary recommendation cites which scenario it picks, the rationale
      // names which constraints the pick prioritises, and the second-best
      // alternatives have explicit trigger-conditions for re-evaluation.
      Personas.pedantic({
        domain: 'recommendation-rationale',
        rubric: [
          'primary-recommendation-cites-scenario',
          'rationale-names-prioritised-constraints',
          'second-best-alternatives-have-trigger-conditions',
          'no-vague-strategic-language',
        ],
        name: 'recommendation-rationale-checker',
      }),
      // Budget-realism reviewer — roadmap tradeoffs carry load-bearing
      // cost + scope claims across the candidate slate that must survive
      // a realism audit across all axes (cost, time, scope).
      Personas.budgetRealism({
        budgetType: 'all',
        name: 'budget-realism-checker',
      }),
      // Timeline-realism reviewer — critical-path-required schedule realism
      // across the slate; every scenario must declare an explicit critical
      // path the executive trio reads for the spend-and-sequence decision.
      Personas.timelineRealism({
        criticalPathRequired: true,
        name: 'timeline-realism-checker',
      }),
      // Product domain reviewer — pulls the senior-product-manager expert
      // for judgment on the overall decision-memo quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/ProductManagers',
        name: 'product-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:roadmap-tradeoff-evaluator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-vp-product',
    seller: 'svc:roadmap-tradeoff-evaluator',
    serviceRef: 'svc:roadmap-tradeoff-evaluator',
    // VP-Product signs every memo before it emits — cross-functional
    // spend-and-sequence decision authority cannot be delegated.
    predicate: AND(
      SchemaMatch(RoadmapDecisionOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['vp-product'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 1999900n, currency: 'USD' },
    // 14-day SLA — quarterly planning takes a fortnight from cycle-trigger
    // to executive-trio-signed memo.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'team', amount: 499900n },
      { id: 'function', amount: 1999900n },
      { id: 'company-wide', amount: 4999900n },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 12000n, perApiCall: 18n },
  reward: kr_decisionCycleTimeAndHitRate,

  lineage: {
    cellRef: 'business.org.ai/cells/product-managers/roadmap-tradeoff-evaluator',
    icpContextProblemRef: 'icp:roadmap-tradeoff-evaluator:v1',
    foundingHypothesisRef: 'fh:roadmap-tradeoff-evaluator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
