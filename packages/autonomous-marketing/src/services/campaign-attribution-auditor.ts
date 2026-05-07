/**
 * Campaign Attribution Auditor Service — multi-touch attribution + campaign-
 * ROI audit for the marketing catalog.
 *
 * Distinguishing shape vs. siblings:
 *   - `multi-step-research` archetype — the artefact is a growth-lead-signed
 *     attribution audit report that reconciles multi-touch attribution
 *     models (linear / time-decay / data-driven) against platform self-
 *     reports, narrates ROI, and flags attribution anomalies, not a brand
 *     audit, campaign brief, or localisation bundle;
 *   - 5-step cascade: Code fan-in (fetch campaign touchpoints + conversion
 *     events + spend data + click-stream) → Generative (model multi-touch
 *     attribution: linear / time-decay / data-driven + reconcile with
 *     platform self-reports) → Generative (synthesize ROI narrative + flag
 *     attribution anomalies) → Human (growth-lead review-and-sign,
 *     `approval` rationale — the growth-lead owns the campaign-ROI
 *     accountability) → Code (emit attribution report + finance-export);
 *   - `Pricing.percentOf` — 0.75% (75 basis points) of campaign-spend
 *     audited, capped at $25k per audit (the Service shares in the spend
 *     it audits without becoming a tax on small campaigns);
 *   - declarative HITL = mandatory growth-lead review-and-sign Human
 *     Function (the growth-lead owns the campaign-ROI narrative + finance-
 *     handoff), plus OutcomeContract requires growth-lead signature with
 *     `approval` rationale (not `regulatory` — the audit isn't filed with
 *     a regulator, it's signed for the CMO + finance);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(attribution-model-
 *     soundness + reconciliation-completeness + anomaly-detection-
 *     precision) + HumanSign(growth-lead))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (percentOf pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `attribution-confidence-score-and-platform-self-
 * report-reconciliation-rate` — the compound metric every growth-lead /
 * CMO org optimises against (the audit is worth running iff the
 * attribution-confidence score climbs and the platform-self-report
 * reconciliation rate climbs vs. the pre-Service baseline).
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
 * Input — a monthly cron + campaign-reporting-cycle trigger. Tight: 7
 * fields cover the audit identity, the cron-or-cycle signal, the audit
 * window, the campaigns in scope, the attribution models requested, the
 * total campaign-spend-audited (so the percentOf basis is resolvable at
 * intake), and the assigned growth-lead (so the Human review step routes
 * to the right inbox).
 */
export const AttributionAuditTriggerInputSchema = z.object({
  auditId: z.string(),
  triggerSource: z.enum(['monthly-cron', 'campaign-reporting-cycle']),
  auditWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  campaignsInScope: z
    .array(
      z.object({
        campaignId: z.string(),
        platform: z.enum([
          'google-ads',
          'meta-ads',
          'linkedin-ads',
          'tiktok-ads',
          'reddit-ads',
          'organic-search',
          'organic-social',
          'email',
          'direct',
        ]),
      })
    )
    .min(1),
  attributionModelsRequested: z.array(z.enum(['linear', 'time-decay', 'data-driven'])).min(1),
  campaignSpendAuditedCents: z.bigint(),
  assignedGrowthLeadRef: z.string(),
})

/**
 * Output — a growth-lead-signed campaign-attribution audit report: the
 * per-model multi-touch-attribution result, the reconciliation against
 * platform self-reports, the ROI narrative, the flagged attribution
 * anomalies, the growth-lead review audit, and pointers to the report +
 * finance-export artefacts.
 */
export const AttributionAuditReportOutputSchema = z.object({
  auditId: z.string(),
  auditWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  perModelAttribution: z
    .array(
      z.object({
        model: z.enum(['linear', 'time-decay', 'data-driven']),
        perCampaignAttribution: z.array(
          z.object({
            campaignId: z.string(),
            attributedConversions: z.number().nonnegative(),
            attributedRevenueCents: z.bigint(),
            confidenceScore: z.number().min(0).max(100),
          })
        ),
        modelDescription: z.string(),
      })
    )
    .min(1),
  platformSelfReportReconciliation: z.array(
    z.object({
      campaignId: z.string(),
      platformSelfReportedConversions: z.number().nonnegative(),
      modelAttributedConversions: z.number().nonnegative(),
      varianceBasisPoints: z.number().int(),
      reconciliationStatus: z.enum([
        'reconciled',
        'minor-variance',
        'material-variance',
        'unreconciled',
      ]),
      explanation: z.string(),
    })
  ),
  roiNarrative: z.object({
    summary: z.string(),
    overallRoiBasisPoints: z.number().int(),
    bestPerformingCampaignId: z.string(),
    worstPerformingCampaignId: z.string(),
    keyInsights: z.array(z.string()).min(1),
  }),
  flaggedAnomalies: z.array(
    z.object({
      campaignId: z.string(),
      anomalyType: z.enum([
        'click-fraud-suspected',
        'conversion-double-count',
        'attribution-model-disagreement',
        'spend-mismatch',
        'platform-self-report-divergence',
      ]),
      severity: z.enum(['low', 'medium', 'high']),
      explanation: z.string(),
      citationRefs: z.array(z.string()).min(1),
    })
  ),
  growthLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-emit', 'edit-and-emit', 'park', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  reportArtefact: z.object({
    pdfUrl: z.string(),
    financeExportCsvUrl: z.string(),
    overallAttributionConfidenceScore: z.number().min(0).max(100),
    platformSelfReportReconciliationRatePercent: z.number().min(0).max(100),
  }),
  generatedAt: z.string(),
})

export type AttributionAuditTriggerInput = z.infer<typeof AttributionAuditTriggerInputSchema>
export type AttributionAuditReportOutput = z.infer<typeof AttributionAuditReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_attributionConfidenceAndReconciliation: RewardSignal = {
  keyResultRef:
    'kr:campaign-attribution-auditor:attribution-confidence-score-and-platform-self-report-reconciliation-rate',
}
const kr_dataIngestionCompleteness: RewardSignal = {
  keyResultRef: 'kr:campaign-attribution-auditor:data-ingestion-completeness',
}
const kr_attributionModelSoundness: RewardSignal = {
  keyResultRef: 'kr:campaign-attribution-auditor:attribution-model-soundness',
}
const kr_anomalyDetectionPrecision: RewardSignal = {
  keyResultRef: 'kr:campaign-attribution-auditor:anomaly-detection-precision',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:campaign-attribution-auditor:emit-latency',
}

// ============================================================================
// Campaign Attribution Auditor Service
// ============================================================================

/**
 * Campaign Attribution Auditor — monthly cron + campaign-reporting-cycle
 * trigger → growth-lead-signed multi-touch attribution + ROI audit
 * reconciled against platform self-reports as a Service.
 *
 * Cascade: fetch-campaign-touchpoints-conversion-events-spend-and-click-stream (Code, fan-in)
 *        → model-multi-touch-attribution-and-reconcile-with-platform-self-reports (Generative)
 *        → synthesize-roi-narrative-and-flag-attribution-anomalies (Generative)
 *        → growth-lead-review-and-sign (Human, approval rationale)
 *        → emit-attribution-report-and-finance-export (Code, fan-out).
 */
export const campaignAttributionAuditor: ServiceInstance<
  AttributionAuditTriggerInput,
  AttributionAuditReportOutput
> = Service.define<AttributionAuditTriggerInput, AttributionAuditReportOutput>({
  name: 'Campaign Attribution Auditor',
  promise:
    'Every campaign-reporting cycle becomes a growth-lead-signed multi-touch-attribution + ROI audit reconciled against platform self-reports — with attribution anomalies flagged and a finance-export ready — in days, not weeks.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: {
    input: AttributionAuditTriggerInputSchema,
    output: AttributionAuditReportOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-campaign-touchpoints-conversion-events-spend-and-click-stream',
        reward: kr_dataIngestionCompleteness,
        handler: () => undefined,
      }),
      Generative({
        name: 'model-multi-touch-attribution-and-reconcile-with-platform-self-reports',
        reward: kr_attributionModelSoundness,
      }),
      Generative({
        name: 'synthesize-roi-narrative-and-flag-attribution-anomalies',
        reward: kr_anomalyDetectionPrecision,
      }),
      Human({
        name: 'growth-lead-review-and-sign',
        // `approval` rationale: growth-lead sign-off on the campaign-ROI
        // narrative + finance-handoff cannot be delegated. The gate stays
        // human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-attribution-report-and-finance-export',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'marketing-analytics.touchpoints',
      'marketing-analytics.conversion-events',
      'marketing-analytics.click-stream',
      'ads.spend-data',
      'google-ads.self-report',
      'meta-ads.self-report',
      'linkedin-ads.self-report',
      'tiktok-ads.self-report',
      'finance.export',
      'pdf.render',
      'csv.render',
      'gmail.send',
    ],
    // Audit cycle: clarification disabled — the cascade synthesises from
    // the campaign-touchpoint corpus + platform self-reports + spend data;
    // the growth-lead review step at the end is the single human contact
    // point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-spend audits (> $1M campaign-spend audited) escalate the
        // attribution-model + reconciliation step to a senior growth-
        // analytics supervisor before the growth-lead review.
        when: 'campaignSpendAuditedCents > 100000000n',
        action: 'escalate',
      },
      {
        // Every audit routes through growth-lead review-and-sign before
        // it emits; OutcomeContract enforces the signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'growth-lead-review-and-sign',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:campaign-attribution-auditor-review',
    personas: [
      // Factual-accuracy reviewer — every attribution claim + every
      // anomaly flag must carry at least 2 corroborating citations
      // (attribution-model output + platform self-report, or attribution-
      // model output + click-stream evidence). Higher-stakes than 1
      // citation: the audit drives finance-export, so corroboration is
      // editorial standard.
      Personas.factualAccuracy({
        minCitationsPerClaim: 2,
        name: 'attribution-factual-accuracy-reviewer',
      }),
      // Budget-realism reviewer — `budgetType: 'cost'` aligns with the
      // audit's spend-side surface: pedantic check that per-campaign
      // attributed spend reconciles against platform self-reports without
      // material variance, that ROI math closes, and that no campaign's
      // attributed spend exceeds the audit-window spend envelope.
      Personas.budgetRealism({
        budgetType: 'cost',
        name: 'budget-realism-reviewer',
      }),
      // Attribution-model-soundness reviewer — pedantic check that each
      // requested attribution model is applied per its definition and
      // that model-disagreement is surfaced (not papered over).
      Personas.pedantic({
        domain: 'attribution-model-soundness',
        rubric: [
          'each-requested-model-applied-per-definition',
          'model-disagreement-surfaced-not-averaged',
          'confidence-scores-justified',
          'data-driven-model-cites-training-window',
          'no-model-cherry-picking',
        ],
        name: 'attribution-model-soundness-checker',
      }),
      // Marketing domain reviewer — pulls the senior-growth-analytics
      // expert for judgment on the overall audit-report quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/MarketingManagers',
        name: 'growth-analytics-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:campaign-attribution-auditor:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cmo',
    seller: 'svc:campaign-attribution-auditor',
    serviceRef: 'svc:campaign-attribution-auditor',
    // Growth-lead signs every audit before it emits — the campaign-ROI
    // accountability cannot be delegated.
    predicate: AND(
      SchemaMatch(AttributionAuditReportOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['growth-lead'] })
    ),
    // Variable amount — settled at audit-emit time per the percentOf
    // pricing rule below (clamped at $25k cap).
    amount: { amount: 0n, currency: 'USD' },
    // 10-day SLA — attribution audits take ~2 working weeks from cron
    // fire / cycle close to growth-lead inbox.
    timeoutDays: 10,
    onTimeout: 'escalate',
  },

  // 0.75% (75 basis points) of campaign-spend audited, capped at $25k per
  // audit. The metering runtime resolves the `campaign-spend-audited`
  // basis to the audit-window spend total (intake-declared) and computes
  // the charge as `(realised_basis * 75) / 10000`, clamped at the $25k cap.
  pricing: Pricing.percentOf({
    basis: 'campaign-spend-audited',
    rateBasisPoints: 75,
    cap: { amount: 2500000n, currency: 'USD' },
  }),

  refundContract: 'no-charge-if-not-qualified',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8000n, perApiCall: 14n },
  reward: kr_attributionConfidenceAndReconciliation,

  lineage: {
    cellRef: 'business.org.ai/cells/marketing-managers/campaign-attribution-auditor',
    icpContextProblemRef: 'icp:campaign-attribution-auditor:v1',
    foundingHypothesisRef: 'fh:campaign-attribution-auditor:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
