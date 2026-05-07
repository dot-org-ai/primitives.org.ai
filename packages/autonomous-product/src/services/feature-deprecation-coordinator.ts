/**
 * Feature Deprecation Coordinator Service — feature-sunset / deprecation
 * coordination Service for the product-management catalog.
 *
 * Distinguishing shape vs. siblings (`prd-author`,
 * `customer-feedback-synthesizer`, `roadmap-tradeoff-evaluator`,
 * `release-experiment-designer`, `jobs-to-be-done-clusterer`):
 *   - `forecast-narrative` archetype — the artefact is a VP-Product-and-
 *     customer-success-lead-reviewed deprecation runbook (timeline +
 *     customer-comms strategy + migration paths + grandfathering rules) plus
 *     the drafted customer notifications + internal runbook, not a PRD or a
 *     feedback synthesis;
 *   - 5-step cascade: Code fan-in (feature usage + dependent features +
 *     customer-segment impact) → Generative (synthesize-deprecation-plan:
 *     timeline + customer-comms strategy + migration paths + grandfathering
 *     rules) → Generative (draft-customer-notifications + internal-runbook)
 *     → Human (VP-Product + customer-success-lead review) → Code fan-out
 *     (emit-deprecation-runbook + schedule-comms);
 *   - `Pricing.subscription` — a recurring product-team subscription
 *     ($699/mo) plus a `metered` overage of $199 per emitted deprecation
 *     runbook (subscription covers the planning cadence; the metered overage
 *     prices each shipped deprecation event);
 *   - declarative HITL = mandatory VP-Product + customer-success-lead
 *     sign-off Human Function (sunset-decision authority + customer-trust
 *     authority cannot be delegated; uses `'approval'` rationale for the
 *     VP-Product because the strategic-product-decision is the value the
 *     customer pays for, plus OutcomeContract requires VP-Product
 *     signature);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(impact-completeness
 *     + comms-clarity + migration-path-coverage) + HumanSign(VP-Product))`;
 *   - EvaluatorPanel includes `Personas.regressionRisk({ changeType:
 *     'process' })` because feature deprecation is a process-change with
 *     blast-radius across customer segments + dependent features that must
 *     have an explicit rollback plan (re-enable / extend grandfathering),
 *     plus `Personas.brandSafety({ riskTolerance: 'low' })` because
 *     deprecation-comms carry reputational risk and must hold a low risk
 *     tolerance bar (any customer-trust regression flagged).
 *
 * Per design v3 §3 (Catalog HOW product) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription-with-metered-overage pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `deprecation-induced-churn-rate-vs-baseline` — the
 * compound metric every product org optimises against (the coordinator is
 * worth running iff the per-deprecation churn rate stays below the pre-
 * Service baseline of bespoke deprecation-comms execution).
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
 * Input — a feature is flagged for sunset and a deprecation date is
 * proposed. Tight: 8 fields cover the artefact identity, the feature
 * pointer, the proposed deprecation date, the assigned VP-Product +
 * customer-success-lead (Human review routing), the urgency band
 * (regulatory-driven sunsets short-circuit grandfathering), the
 * proposed grandfathering window, the connected source-system
 * pointers for usage + dependency analysis, and the trigger stage
 * gating intake.
 */
export const DeprecationCoordinationInputSchema = z.object({
  artefactId: z.string(),
  featureRef: z.string(),
  proposedDeprecationDate: z.string(), // ISO-8601
  assignedVpProductRef: z.string(),
  assignedCustomerSuccessLeadRef: z.string(),
  urgency: z.enum(['standard', 'security', 'regulatory']),
  grandfatheringWindowDays: z.number().int().nonnegative(),
  sources: z.object({
    usageAnalyticsRef: z.string(),
    dependencyGraphRef: z.string().optional(),
    customerSegmentSourceRef: z.string().optional(),
  }),
  triggerStage: z.literal('flagged-for-sunset'),
})

/**
 * Output — a VP-Product + customer-success-lead reviewed deprecation
 * runbook, the drafted customer notifications, the internal runbook,
 * the review audit, and pointers to the emitted deprecation artefacts +
 * the comms schedule.
 */
export const DeprecationRunbookOutputSchema = z.object({
  artefactId: z.string(),
  featureRef: z.string(),
  deprecationPlan: z.object({
    sunsetDate: z.string(), // ISO-8601
    timeline: z
      .array(
        z.object({
          milestoneId: z.string(),
          name: z.string(),
          targetDate: z.string(),
          ownerRef: z.string(),
        })
      )
      .min(1),
    customerCommsStrategy: z.object({
      cadence: z.enum(['single', 'staggered', 'segment-targeted']),
      channels: z
        .array(z.enum(['in-app', 'email', 'docs', 'release-notes', 'csm-outreach']))
        .min(1),
      summary: z.string(),
    }),
    migrationPaths: z
      .array(
        z.object({
          pathId: z.string(),
          forSegmentRef: z.string(),
          targetFeatureRef: z.string().optional(),
          guidanceMarkdown: z.string(),
        })
      )
      .min(1),
    grandfatheringRules: z
      .array(
        z.object({
          ruleId: z.string(),
          condition: z.string(),
          windowDays: z.number().int().nonnegative(),
        })
      )
      .default([]),
    impactSummary: z.object({
      affectedCustomerCount: z.number().int().nonnegative(),
      affectedDependentFeatureRefs: z.array(z.string()).default([]),
      revenueAtRiskUsd: z.number().nonnegative(),
    }),
  }),
  customerNotifications: z
    .array(
      z.object({
        notificationId: z.string(),
        audienceRef: z.string(),
        channel: z.enum(['in-app', 'email', 'docs', 'release-notes', 'csm-outreach']),
        scheduledAt: z.string(),
        bodyMarkdown: z.string(),
      })
    )
    .min(1),
  internalRunbookMarkdown: z.string(),
  reviewAudit: z.object({
    vpProductRef: z.string(),
    customerSuccessLeadRef: z.string(),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    signedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    runbookUrl: z.string(),
    commsScheduleId: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DeprecationCoordinationInput = z.infer<typeof DeprecationCoordinationInputSchema>
export type DeprecationRunbookOutput = z.infer<typeof DeprecationRunbookOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_deprecationChurnRate: RewardSignal = {
  keyResultRef: 'kr:feature-deprecation-coordinator:deprecation-induced-churn-rate-vs-baseline',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:feature-deprecation-coordinator:intake-coverage',
}
const kr_impactCompleteness: RewardSignal = {
  keyResultRef: 'kr:feature-deprecation-coordinator:impact-completeness',
}
const kr_commsClarity: RewardSignal = {
  keyResultRef: 'kr:feature-deprecation-coordinator:comms-clarity',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:feature-deprecation-coordinator:emit-latency',
}

// ============================================================================
// Feature Deprecation Coordinator Service
// ============================================================================

/**
 * Feature Deprecation Coordinator — feature-flagged-for-sunset + deprecation-
 * date-proposed trigger → VP-Product-and-customer-success-lead-reviewed
 * deprecation runbook + scheduled customer comms as a Service.
 *
 * Cascade: fetch-feature-usage-dependent-features-and-customer-segment-impact (Code, fan-in)
 *        → synthesize-deprecation-plan-timeline-comms-strategy-migration-paths-and-grandfathering-rules (Generative)
 *        → draft-customer-notifications-and-internal-runbook (Generative)
 *        → vp-product-and-customer-success-lead-review (Human, approval rationale)
 *        → emit-deprecation-runbook-and-schedule-comms (Code, fan-out).
 */
export const featureDeprecationCoordinator: ServiceInstance<
  DeprecationCoordinationInput,
  DeprecationRunbookOutput
> = Service.define<DeprecationCoordinationInput, DeprecationRunbookOutput>({
  name: 'Feature Deprecation Coordinator',
  promise:
    'Every feature flagged for sunset gets a VP-Product-and-customer-success-lead-signed deprecation runbook — impact-complete, comms-clear, migration-path-covered — so product teams ship sunset events without the per-deprecation churn spike.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: DeprecationCoordinationInputSchema,
    output: DeprecationRunbookOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-feature-usage-dependent-features-and-customer-segment-impact',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-deprecation-plan-timeline-comms-strategy-migration-paths-and-grandfathering-rules',
        reward: kr_impactCompleteness,
      }),
      Generative({
        name: 'draft-customer-notifications-and-internal-runbook',
        reward: kr_commsClarity,
      }),
      Human({
        name: 'vp-product-and-customer-success-lead-review',
        // `approval` rationale: sunset-decision authority (VP-Product) +
        // customer-trust authority (customer-success-lead) cannot be
        // delegated. The runbook ships only when both have signed off on
        // the deprecation plan.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-deprecation-runbook-and-schedule-comms',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'amplitude.cohorts',
      'mixpanel.events',
      'salesforce.accounts',
      'gainsight.accounts',
      'productboard.features',
      'docs.write',
      'mailgun.send',
      'in-app-banner.schedule',
    ],
    // Deprecation coordination: clarification disabled — the cascade
    // synthesises from feature usage + dependents + customer segments;
    // the VP-Product + customer-success-lead review step is the single
    // human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Regulatory-urgency sunsets escalate the deprecation-plan
        // synthesis to a senior compliance-and-product supervisor before
        // the VP-Product + customer-success-lead review (the regulatory
        // window short-circuits the standard grandfathering buffer).
        when: 'urgency == "regulatory"',
        action: 'escalate',
      },
      {
        // Every deprecation routes through VP-Product + customer-success-
        // lead review before the runbook emits; OutcomeContract enforces
        // the VP-Product signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'vp-product-and-customer-success-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:feature-deprecation-coordinator-review',
    personas: [
      // Impact-completeness reviewer — pedantic check that the impact
      // summary names the affected-customer-count, lists every dependent-
      // feature that breaks at sunset, and quantifies revenue-at-risk.
      Personas.pedantic({
        domain: 'impact-completeness',
        rubric: [
          'affected-customer-count-named',
          'every-dependent-feature-listed',
          'revenue-at-risk-quantified',
          'no-silent-segment-omissions',
        ],
        name: 'impact-completeness-checker',
      }),
      // Comms-clarity reviewer — pedantic check that every notification
      // names the audience segment, the channel, the schedule, and a
      // body that includes both the sunset date and the recommended
      // migration path.
      Personas.pedantic({
        domain: 'comms-clarity',
        rubric: [
          'every-notification-names-audience-segment',
          'every-notification-names-channel-and-schedule',
          'body-includes-sunset-date-and-migration-path',
          'no-vague-deprecation-language',
        ],
        name: 'comms-clarity-checker',
      }),
      // Migration-path-coverage reviewer — adversarially probes whether
      // every affected customer segment has at least one migration-path
      // entry and whether the per-path guidance is concrete (not
      // aspirational).
      Personas.skeptic({
        domain: 'migration-path-coverage',
        focus: [
          'every-affected-segment-has-migration-path',
          'per-path-guidance-concrete-not-aspirational',
          'grandfathering-rules-cover-edge-cases',
          'no-orphaned-customer-segments',
        ],
        name: 'migration-path-coverage-reviewer',
      }),
      // Regression-risk reviewer — feature deprecation is a process-
      // change with cross-segment + cross-feature blast radius that must
      // declare an explicit rollback plan (re-enable / extend grand-
      // fathering) before VP-Product signs.
      Personas.regressionRisk({
        changeType: 'process',
        name: 'regression-risk-checker',
      }),
      // Brand-safety reviewer — deprecation-comms carry reputational
      // risk and must hold a low risk tolerance bar (any customer-trust
      // regression in the comms body / cadence / channel mix is flagged).
      Personas.brandSafety({
        riskTolerance: 'low',
        name: 'brand-safety-checker',
      }),
      // Product domain reviewer — pulls the senior-product-manager expert
      // for judgment on the overall deprecation-runbook quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/ProductManagers',
        name: 'product-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:feature-deprecation-coordinator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-vp-product',
    seller: 'svc:feature-deprecation-coordinator',
    serviceRef: 'svc:feature-deprecation-coordinator',
    // VP-Product signs every deprecation runbook before it emits — sunset-
    // decision authority cannot be delegated.
    predicate: AND(
      SchemaMatch(DeprecationRunbookOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['vp-product'] })
    ),
    amount: { amount: 69900n, currency: 'USD' },
    // 7-day SLA — deprecation coordination takes a week from flagged-for-
    // sunset intake to VP-Product-signed runbook + scheduled comms.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  // Subscription model: $699/mo product-team subscription covers the
  // planning cadence; metered overage at $199 per emitted deprecation
  // runbook prices each shipped sunset event.
  pricing: Pricing.subscription({
    plan: {
      id: 'feature-deprecation-coordinator-monthly',
      amount: 69900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'deprecation-runbook-emitted',
        amount: 19900n,
        description:
          'Per-runbook overage charged on top of the monthly subscription when a deprecation runbook is emitted.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 7000n, perApiCall: 13n },
  reward: kr_deprecationChurnRate,

  lineage: {
    cellRef: 'business.org.ai/cells/product-managers/feature-deprecation-coordinator',
    icpContextProblemRef: 'icp:feature-deprecation-coordinator:v1',
    foundingHypothesisRef: 'fh:feature-deprecation-coordinator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
