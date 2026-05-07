/**
 * SLO Budget Tracker Service — error-budget tracking + burn-down narrative
 * Service for the operations catalog.
 *
 * Distinguishing shape vs. siblings (`incident-commander`,
 * `oncall-handoff-narrator`, `capacity-planner`, `change-window-coordinator`,
 * `runbook-author`):
 *   - `forecast-narrative` archetype — the artefact is a weekly SRE-lead-
 *     approved error-budget burn-down narrative + ship/slow-down/freeze
 *     recommendation, not an in-incident mitigation plan, a quarterly capacity
 *     plan, or a change-window runbook;
 *   - 5-step cascade: Code fan-in (SLI time-series + error-budget policy +
 *     recent incidents) → Generative (burn-rate narrative + drivers and
 *     mitigations) → Generative (recommendation: continue-shipping / slow-down
 *     / freeze) → Human (SRE-lead + service-owner review) → Code (emit budget
 *     report + dashboard annotations);
 *   - `Pricing.subscription` — the budget tracker is a recurring weekly
 *     cadence Service consumed by an SRE team ($499/mo per SRE-team) plus
 *     metered overage at $99 per slo-burn-alert (extra burn-rate alert beyond
 *     the regular weekly cadence — shipping freeze incidents fire ad-hoc);
 *   - declarative HITL = mandatory SRE-lead approval (the ship/slow-down/
 *     freeze recommendation gates engineering velocity org-wide); plus
 *     OutcomeContract requires SRE-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(burn-rate-precision +
 *     recommendation-actionability) + HumanSign(SRE-lead))`.
 *
 * Per design v3 §3 (Catalog HOW operations) + §6 (binding triggers,
 * conditional HumanSign) + §7 (subscription pricing factory with metered
 * overage) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `slo-attainment-rate-improvement` — the compound
 * metric every SRE org optimises against (the tracker is worth running iff
 * SLO attainment-rate across the SLO portfolio improves vs. the pre-Service
 * baseline; the tracker turns silent budget-burn into a deliberate
 * ship/slow-down decision before the budget exhausts).
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
 * Input — a weekly cron firing at SLO-budget-review-due (or an ad-hoc fast-
 * burn alert ingestion). Tight: 7 fields cover the SRE-team identity, the
 * review window, the in-scope SLOs (so the cascade fans-in to the right SLI
 * time-series), the error-budget policy reference, the monitoring source,
 * the assigned SRE-lead (so the Human approval routes to the right inbox),
 * and the affected service-owner refs (so the joint review notifies the
 * right product-owners).
 */
export const SloBudgetReviewInputSchema = z.object({
  sreTeamRef: z.string(),
  reviewKind: z.enum(['weekly', 'ad-hoc-fast-burn']),
  reviewWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  inScopeSloRefs: z.array(z.string()).min(1),
  errorBudgetPolicyRef: z.string(),
  monitoringSource: z.enum(['datadog', 'newrelic', 'grafana', 'prometheus', 'cloudwatch']),
  assignedSreLeadRef: z.string(),
  affectedServiceOwnerRefs: z.array(z.string()).default([]),
})

/**
 * Output — an SRE-lead-approved error-budget burn-down narrative + ship/slow-
 * down/freeze recommendation: the SLI time-series fan-in, the per-SLO burn
 * rate snapshot, the burn-rate narrative with drivers + mitigations, the
 * recommendation, the joint SRE-lead + service-owner review audit, and
 * pointers to the emitted budget-report artefact + dashboard annotations.
 */
export const SloBudgetReportOutputSchema = z.object({
  sreTeamRef: z.string(),
  reviewWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  sliTimeSeriesSnapshot: z.array(
    z.object({
      sloRef: z.string(),
      sliKind: z.enum(['availability', 'latency', 'error-rate', 'throughput', 'durability']),
      currentBudgetRemainingPercent: z.number().min(0).max(100),
      historicalBurnRatePercentPerWeek: z.number(),
      projectedBudgetRemainingPercentEndOfWindow: z.number(),
      observedAt: z.string(), // ISO-8601
    })
  ),
  recentIncidentLinks: z.array(
    z.object({
      incidentRef: z.string(),
      severity: z.enum(['SEV1', 'SEV2', 'SEV3']),
      sloRef: z.string(),
      contributedBudgetBurnPercent: z.number().min(0).max(100),
    })
  ),
  burnRateNarrative: z.object({
    summaryMarkdown: z.string(),
    drivers: z
      .array(
        z.object({
          driverId: z.string(),
          sloRef: z.string(),
          rootCauseSummary: z.string(),
          contributionPercent: z.number().min(0).max(100),
          citationRefs: z.array(z.string()).min(2),
        })
      )
      .min(0),
    mitigations: z
      .array(
        z.object({
          mitigationId: z.string(),
          driverId: z.string(),
          description: z.string(),
          ownerRef: z.string(),
          estimatedBudgetRecoveryPercent: z.number(),
        })
      )
      .min(0),
  }),
  recommendation: z.object({
    decision: z.enum(['continue-shipping', 'slow-down', 'freeze']),
    rationale: z.string(),
    durationDays: z.number().int().nonnegative(),
    appliesToServiceRefs: z.array(z.string()).min(1),
    autoLiftCondition: z.string().optional(),
  }),
  jointApproval: z.object({
    sreLeadReviewerRef: z.string(),
    serviceOwnerReviewerRefs: z.array(z.string()),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  budgetReportArtefact: z.object({
    pdfUrl: z.string(),
    dashboardUrl: z.string(),
    dashboardAnnotationRefs: z.array(z.string()),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type SloBudgetReviewInput = z.infer<typeof SloBudgetReviewInputSchema>
export type SloBudgetReportOutput = z.infer<typeof SloBudgetReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_sloAttainmentRate: RewardSignal = {
  keyResultRef: 'kr:slo-budget-tracker:slo-attainment-rate-improvement',
}
const kr_sliCoverage: RewardSignal = {
  keyResultRef: 'kr:slo-budget-tracker:sli-time-series-coverage',
}
const kr_burnRatePrecision: RewardSignal = {
  keyResultRef: 'kr:slo-budget-tracker:burn-rate-precision',
}
const kr_recommendationActionability: RewardSignal = {
  keyResultRef: 'kr:slo-budget-tracker:recommendation-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:slo-budget-tracker:emit-latency',
}

// ============================================================================
// SLO Budget Tracker Service
// ============================================================================

/**
 * SLO Budget Tracker — weekly cron + monitoring-data ingestion → SRE-lead-
 * approved error-budget burn-down narrative + ship/slow-down/freeze
 * recommendation as a Service.
 *
 * Cascade: fetch-sli-time-series-error-budget-policy-and-recent-incidents (Code, fan-in)
 *        → synthesize-burn-rate-narrative-with-drivers-and-mitigations (Generative)
 *        → draft-recommendation-continue-shipping-slow-down-or-freeze (Generative)
 *        → sre-lead-and-service-owner-review (Human, approval rationale)
 *        → emit-budget-report-and-dashboard-annotations (Code, fan-out).
 */
export const sloBudgetTracker: ServiceInstance<SloBudgetReviewInput, SloBudgetReportOutput> =
  Service.define<SloBudgetReviewInput, SloBudgetReportOutput>({
    name: 'SLO Budget Tracker',
    promise:
      'Every week (and every fast-burn alert) the SRE team gets a leader-approved error-budget burn-down narrative + ship/slow-down/freeze recommendation — drivers cited + mitigations owned + recommendation actionable — so silent budget-burn becomes a deliberate engineering decision before the budget exhausts.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: SloBudgetReviewInputSchema, output: SloBudgetReportOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-sli-time-series-error-budget-policy-and-recent-incidents',
          reward: kr_sliCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-burn-rate-narrative-with-drivers-and-mitigations',
          reward: kr_burnRatePrecision,
        }),
        Generative({
          name: 'draft-recommendation-continue-shipping-slow-down-or-freeze',
          reward: kr_recommendationActionability,
        }),
        Human({
          name: 'sre-lead-and-service-owner-review',
          // `approval` rationale: the SRE-lead owns the ship/slow-down/freeze
          // recommendation that gates engineering velocity org-wide; the
          // service-owners own the contributing-driver mitigation commitments.
          // The gate stays human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-budget-report-and-dashboard-annotations',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'datadog.metrics',
        'datadog.slos',
        'newrelic.metrics',
        'grafana.query',
        'prometheus.query',
        'cloudwatch.metrics',
        'incident-history.read',
        'service-graph.read',
        'docs.write',
        'dashboards.annotate',
      ],
      // Weekly + ad-hoc-fast-burn cadence: clarification disabled — the
      // cascade synthesises from the SLI + incident + policy signals; the
      // joint SRE-lead + service-owner review is the single human contact
      // point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Ad-hoc fast-burn reviews escalate the recommendation step to a
          // senior SRE supervisor before the joint review (the SRE-lead still
          // signs, but a supervisor backstops the recommendation quality on
          // fast-burn-tier reviews).
          when: 'reviewKind == "ad-hoc-fast-burn"',
          action: 'escalate',
        },
        {
          // Every report routes through the joint SRE-lead + service-owner
          // review before dashboard-annotations emit; OutcomeContract enforces
          // the signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'sre-lead-and-service-owner-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:slo-budget-tracker-review',
      personas: [
        // Burn-rate-precision reviewer — pedantic check that every per-SLO
        // burn-rate number is computed from the SLI time-series snapshot
        // (not pulled from thin air), every contributedBudgetBurnPercent on
        // a recent incident is signed correctly, and the projected end-of-
        // window remaining is internally consistent with the historical
        // burn-rate.
        Personas.pedantic({
          domain: 'burn-rate-precision',
          rubric: [
            'every-burn-rate-derived-from-sli-snapshot',
            'incident-contribution-percents-coherent',
            'projected-end-of-window-consistent-with-historical-rate',
            'no-double-counted-budget-burn',
            'fast-burn-detection-correct',
          ],
          name: 'burn-rate-precision-checker',
        }),
        // Recommendation-actionability reviewer — adversarially probes whether
        // the ship/slow-down/freeze recommendation cites concrete drivers,
        // names a duration, names the in-scope service-refs, and (for slow-
        // down / freeze) names an autoLiftCondition. The risk this guards
        // against is hand-waved "consider a freeze" recommendations.
        Personas.skeptic({
          domain: 'recommendation-actionability',
          focus: [
            'recommendation-cites-concrete-drivers',
            'duration-and-scope-explicit',
            'auto-lift-condition-named-for-slow-down-or-freeze',
            'no-hand-waves',
          ],
          name: 'recommendation-actionability-reviewer',
        }),
        // Factual-accuracy reviewer — burn-rate drivers are load-bearing
        // claims; require minimum 2 citations per driver claim (the rubric
        // requires `citationRefs.min(2)` in the schema, and the persona
        // enforces source quality across those 2+ references).
        Personas.factualAccuracy({
          minCitationsPerClaim: 2,
          name: 'driver-fact-grounding-checker',
        }),
        // Regression-risk reviewer — the recommendation is a process change
        // (ship-velocity gate); require explicit blast-radius (which services
        // / teams the freeze/slow-down applies to) and rollback plan (the
        // autoLiftCondition).
        Personas.regressionRisk({
          changeType: 'process',
          blastRadiusRequired: true,
          rollbackPlanRequired: true,
          name: 'recommendation-regression-risk-reviewer',
        }),
        // SRE domain reviewer — pulls the senior-SRE expert for judgment on
        // the overall budget-report quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/SiteReliabilityEngineers',
          name: 'sre-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:slo-budget-tracker:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-sre-lead',
      seller: 'svc:slo-budget-tracker',
      serviceRef: 'svc:slo-budget-tracker',
      // SRE-lead signs every budget report before dashboard-annotations
      // commit — ship/slow-down/freeze authority cannot be delegated.
      predicate: AND(
        SchemaMatch(SloBudgetReportOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['sre-lead'] })
      ),
      amount: { amount: 49900n, currency: 'USD' },
      // 2-day SLA — weekly cadence + driver-citation depth means the report
      // ships within 48 hours of the review trigger (faster on ad-hoc fast-
      // burn reviews where the runtime escalates).
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'slo-budget-tracker-monthly',
        amount: 49900n,
        currency: 'USD',
        interval: 'month',
      },
      // Metered overage — extra burn-rate alerts beyond the regular weekly
      // cadence charge $99 each. The metering runtime resolves
      // `slo-burn-alert` to ad-hoc fast-burn invocations beyond the implicit
      // weekly baseline and lines them on the monthly invoice.
      metered: [
        {
          event: 'slo-burn-alert',
          amount: 9900n,
          description:
            'Ad-hoc fast-burn alert beyond the regular weekly SLO budget review cadence.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 4500n, perApiCall: 9n },
    reward: kr_sloAttainmentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/sre-managers/slo-budget-tracker',
      icpContextProblemRef: 'icp:slo-budget-tracker:v1',
      foundingHypothesisRef: 'fh:slo-budget-tracker:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
