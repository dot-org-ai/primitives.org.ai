/**
 * PRD Author Service — Product Requirements Document drafting Service for the
 * product-management catalog.
 *
 * Distinguishing shape vs. siblings (`customer-feedback-synthesizer`,
 * `roadmap-tradeoff-evaluator`):
 *   - `content-generation` archetype — the artefact is a PM-and-tech-lead-
 *     reviewed PRD doc with a linked Jira epic, not a multi-source feedback
 *     synthesis or a quarterly tradeoff memo;
 *   - 5-step cascade: Code fan-in (feature context + customer research +
 *     competitor analysis) → Generative (problem statement + user stories +
 *     acceptance criteria) → Generative (success metrics + risks +
 *     dependencies) → Human (PM + tech-lead review) → Code fan-out
 *     (PRD doc + linked Jira epic);
 *   - `Pricing.outcome` 3 tiers keyed on the scope of the PRD — feature /
 *     initiative / product-launch ($799 / $2,999 / $9,999) — a launch-grade
 *     PRD is worth more than a single-feature PRD;
 *   - declarative HITL = mandatory PM + tech-lead review Human Function
 *     (the PM owns the problem framing + the tech-lead owns the feasibility
 *     read; uses `'approval'` rationale because the bar-for-shipping decision
 *     cannot be delegated), plus OutcomeContract requires PM signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(problem-clarity +
 *     acceptance-criteria-coverage + metric-actionability) +
 *     HumanSign(product-manager))`;
 *   - EvaluatorPanel includes `Personas.budgetRealism({ budgetType: 'all' })`
 *     and `Personas.timelineRealism({ dependencyAware: true })` because PRDs
 *     carry implicit cost / scope / timeline claims (engineering effort,
 *     dependency sequencing, ship-date) that must survive a realism audit
 *     before the PM signs.
 *
 * Per design v3 §3 (Catalog HOW product) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `prd-acceptance-rate-on-first-review` — the compound
 * metric every product org optimises against (the author is worth running iff
 * PRDs land first-review-clean vs. the pre-Service revise-and-resubmit cycle).
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
 * Input — a feature / initiative reaches the ready-for-PRD stage. Tight: 7
 * fields cover the artefact identity, the scope (feature / initiative /
 * product-launch — resolves the outcome tier at intake), the assigned PM
 * and tech-lead (Human review routing), the feature title + brief, the
 * connected research sources the cascade should fan-in over, and the
 * trigger stage gating intake.
 */
export const PrdTriggerInputSchema = z.object({
  artefactId: z.string(),
  prdScope: z.enum(['feature', 'initiative', 'product-launch']),
  assignedProductManagerRef: z.string(),
  assignedTechLeadRef: z.string(),
  featureTitle: z.string(),
  featureBrief: z.string(),
  sources: z.object({
    customerResearchRef: z.string().optional(),
    competitorAnalysisRefs: z.array(z.string()).default([]),
    featureContextRef: z.string().optional(),
  }),
  triggerStage: z.literal('ready-for-prd'),
})

/**
 * Output — a PM-and-tech-lead-reviewed PRD doc + linked Jira epic: the
 * synthesised problem statement + user stories + acceptance criteria, the
 * drafted success metrics + risks + dependencies, the review audit, and
 * pointers to the emitted PRD + Jira epic artefacts.
 */
export const PrdDocumentOutputSchema = z.object({
  artefactId: z.string(),
  problemStatement: z.object({
    summaryMarkdown: z.string(),
    targetUserSegment: z.string(),
    painPointEvidence: z.array(z.string()).min(1),
  }),
  userStories: z
    .array(
      z.object({
        storyId: z.string(),
        narrative: z.string(),
        priority: z.enum(['must-have', 'should-have', 'nice-to-have']),
      })
    )
    .min(1),
  acceptanceCriteria: z
    .array(
      z.object({
        criterionId: z.string(),
        statement: z.string(),
        coversStoryRefs: z.array(z.string()).min(1),
      })
    )
    .min(1),
  successMetrics: z
    .array(
      z.object({
        metricId: z.string(),
        name: z.string(),
        target: z.string(),
        measurementWindow: z.string(),
      })
    )
    .min(1),
  risksAndDependencies: z.object({
    risks: z
      .array(
        z.object({
          riskId: z.string(),
          description: z.string(),
          severity: z.enum(['low', 'medium', 'high']),
          mitigation: z.string(),
        })
      )
      .default([]),
    dependencies: z
      .array(
        z.object({
          dependencyId: z.string(),
          description: z.string(),
          ownerRef: z.string(),
        })
      )
      .default([]),
  }),
  reviewAudit: z.object({
    productManagerRef: z.string(),
    techLeadRef: z.string(),
    decision: z.enum(['accept', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    prdDocUrl: z.string(),
    jiraEpicRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PrdTriggerInput = z.infer<typeof PrdTriggerInputSchema>
export type PrdDocumentOutput = z.infer<typeof PrdDocumentOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_prdAcceptanceRate: RewardSignal = {
  keyResultRef: 'kr:prd-author:prd-acceptance-rate-on-first-review',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:prd-author:intake-coverage',
}
const kr_problemClarity: RewardSignal = {
  keyResultRef: 'kr:prd-author:problem-clarity',
}
const kr_metricActionability: RewardSignal = {
  keyResultRef: 'kr:prd-author:metric-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:prd-author:emit-latency',
}

// ============================================================================
// PRD Author Service
// ============================================================================

/**
 * PRD Author — feature / initiative ready-for-PRD trigger → PM-and-tech-lead-
 * reviewed PRD doc + linked Jira epic as a Service.
 *
 * Cascade: fetch-feature-context-customer-research-and-competitor-analysis (Code, fan-in)
 *        → synthesize-problem-statement-user-stories-and-acceptance-criteria (Generative)
 *        → draft-success-metrics-risks-and-dependencies (Generative)
 *        → product-manager-and-tech-lead-review (Human, approval rationale)
 *        → emit-prd-doc-and-linked-jira-epic (Code, fan-out).
 */
export const prdAuthor: ServiceInstance<PrdTriggerInput, PrdDocumentOutput> = Service.define<
  PrdTriggerInput,
  PrdDocumentOutput
>({
  name: 'PRD Author',
  promise:
    'Every feature / initiative / launch reaches review with a PM-and-tech-lead-signed PRD — problem statement grounded in customer research, user stories with acceptance criteria, success metrics + risks + dependencies — so PMs spend the cycle on the decision, not on assembly.',
  audience: 'business',
  archetype: 'content-generation',
  schema: { input: PrdTriggerInputSchema, output: PrdDocumentOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-feature-context-customer-research-and-competitor-analysis',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-problem-statement-user-stories-and-acceptance-criteria',
        reward: kr_problemClarity,
      }),
      Generative({
        name: 'draft-success-metrics-risks-and-dependencies',
        reward: kr_metricActionability,
      }),
      Human({
        name: 'product-manager-and-tech-lead-review',
        // `approval` rationale: PM ownership of problem framing + tech-lead
        // ownership of feasibility cannot be delegated. The PRD ships only
        // when both have signed off on the bar for the feature.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-prd-doc-and-linked-jira-epic',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'jira.epics',
      'jira.issues',
      'product-board.features',
      'notion.docs',
      'docs.write',
      'productboard.research',
      'gong.calls',
    ],
    // PRD authoring: clarification disabled — the cascade synthesises from
    // feature context + customer research + competitor analysis; the PM +
    // tech-lead review step is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Product-launch-scope PRDs escalate the problem-statement synthesis
        // to a senior product-strategy supervisor before the PM + tech-lead
        // review (the cross-team blast-radius compounds at launch scope).
        when: 'prdScope == "product-launch"',
        action: 'escalate',
      },
      {
        // Every PRD routes through PM + tech-lead review before the doc
        // emits; OutcomeContract enforces the PM signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'product-manager-and-tech-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:prd-author-review',
    personas: [
      // Problem-clarity reviewer — pedantic check that the problem statement
      // names a target user segment, cites pain-point evidence, and avoids
      // solution-shaped language disguised as problem framing.
      Personas.pedantic({
        domain: 'problem-clarity',
        rubric: [
          'target-user-segment-named',
          'pain-point-evidence-cited',
          'no-solution-disguised-as-problem',
          'no-vague-impact-claims',
        ],
        name: 'problem-clarity-checker',
      }),
      // Acceptance-criteria-coverage reviewer — pedantic check that every
      // user story has at least one acceptance criterion covering it and
      // that no criterion is orphaned (covers no story).
      Personas.pedantic({
        domain: 'acceptance-criteria-coverage',
        rubric: [
          'every-story-has-at-least-one-criterion',
          'no-orphaned-criteria',
          'criteria-are-testable-not-aspirational',
          'priority-bands-coherent-with-stories',
        ],
        name: 'acceptance-criteria-coverage-checker',
      }),
      // Metric-actionability reviewer — adversarially probes whether each
      // success metric is concretely actionable (target + measurement
      // window) vs. vanity-metric framing the team can't move.
      Personas.skeptic({
        domain: 'metric-actionability',
        focus: [
          'concrete-target-value',
          'measurement-window-named',
          'no-vanity-metrics',
          'metric-tied-to-user-outcome',
        ],
        name: 'metric-actionability-reviewer',
      }),
      // Budget-realism reviewer — the PRD carries implicit engineering
      // cost + scope claims (story count, dependency count) that must
      // survive a realism audit across all axes (cost, time, scope).
      Personas.budgetRealism({
        budgetType: 'all',
        name: 'budget-realism-checker',
      }),
      // Timeline-realism reviewer — dependency-aware schedule realism
      // covering the dependency sequencing called out in the PRD risks-
      // and-dependencies section.
      Personas.timelineRealism({
        dependencyAware: true,
        name: 'timeline-realism-checker',
      }),
      // Product domain reviewer — pulls the senior-product-manager expert
      // for judgment on the overall PRD quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/ProductManagers',
        name: 'product-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:prd-author:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-product-manager',
    seller: 'svc:prd-author',
    serviceRef: 'svc:prd-author',
    // PM signs every PRD before the doc emits — bar-for-shipping authority
    // cannot be delegated.
    predicate: AND(
      SchemaMatch(PrdDocumentOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['product-manager'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 299900n, currency: 'USD' },
    // 5-day SLA — PRD authoring takes a workweek from ready-for-PRD intake
    // to PM-signed doc.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'feature', amount: 79900n },
      { id: 'initiative', amount: 299900n },
      { id: 'product-launch', amount: 999900n },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 5000n, perApiCall: 12n },
  reward: kr_prdAcceptanceRate,

  lineage: {
    cellRef: 'business.org.ai/cells/product-managers/prd-author',
    icpContextProblemRef: 'icp:prd-author:v1',
    foundingHypothesisRef: 'fh:prd-author:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
