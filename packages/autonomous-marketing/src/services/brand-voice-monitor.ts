/**
 * Brand Voice Monitor Service — cross-channel brand-voice consistency
 * monitoring for the marketing catalog.
 *
 * Distinguishing shape vs. siblings (`campaign-brief-generator`,
 * `seo-content-pillar-author`, `paid-ad-creative-iterator`,
 * `content-localization-orchestrator`, `campaign-attribution-auditor`):
 *   - `quality-review` archetype — the artefact is a brand-manager-signed
 *     audit report that scores published assets across channels (social +
 *     blog + email + ads + sales-collateral) against the brand style guide,
 *     not a campaign brief, ad-creative variant set, or attribution audit;
 *   - 5-step cascade: Code fan-in (fetch published content across channels)
 *     → Generative (extract tone + voice signals + score against style
 *     guide) → Generative (flag deviations + suggest edits) → Human
 *     (brand-manager review + sign) → Code (emit audit report +
 *     per-asset recommendations);
 *   - `Pricing.subscription` — $799/mo per brand recurring plan; the audit
 *     is continuously running, not a one-shot deliverable;
 *   - declarative HITL = mandatory brand-manager review-and-sign Human
 *     Function (the brand-manager owns the brand voice guide), plus
 *     OutcomeContract requires brand-manager signature with `approval`
 *     rationale (not `regulatory`) — the brand-voice ownership cannot be
 *     delegated;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(deviation-detection-
 *     precision + suggestion-quality) + HumanSign(brand-manager))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (subscription pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `brand-voice-consistency-score-improvement` —
 * the compound metric every brand-manager org optimises against (the
 * monitor is worth running iff cross-channel brand-voice consistency
 * climbs vs. the pre-Service baseline week-over-week).
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
 * Input — a brand audit trigger: weekly cron fire OR ad-hoc audit request.
 * Tight: 6 fields cover the brand identity, the cron-or-adhoc signal, the
 * audit window, the channels in scope, the brand style-guide reference, and
 * the assigned brand-manager (so the Human review step routes to the right
 * inbox).
 */
export const BrandAuditTriggerInputSchema = z.object({
  brandId: z.string(),
  triggerSource: z.enum(['weekly-cron', 'ad-hoc-request']),
  auditWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  channelsInScope: z.array(z.enum(['social', 'blog', 'email', 'ads', 'sales-collateral'])).min(1),
  brandStyleGuideRef: z.string(),
  assignedBrandManagerRef: z.string(),
})

/**
 * Output — a brand-manager-signed cross-channel brand-voice audit report:
 * the per-asset tone/voice signal extraction, the per-asset deviation
 * scoring against the style guide, the suggested edits, the brand-manager
 * review audit, and pointers to the emitted audit-report artefact.
 */
export const BrandAuditReportOutputSchema = z.object({
  brandId: z.string(),
  auditWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  perAssetSignals: z
    .array(
      z.object({
        assetId: z.string(),
        channel: z.enum(['social', 'blog', 'email', 'ads', 'sales-collateral']),
        toneSignals: z.array(z.string()).min(1),
        voiceSignals: z.array(z.string()).min(1),
        styleGuideAdherenceScore: z.number().min(0).max(100),
      })
    )
    .min(1),
  flaggedDeviations: z.array(
    z.object({
      assetId: z.string(),
      deviationType: z.enum([
        'tone-drift',
        'vocabulary-off-brand',
        'register-mismatch',
        'value-proposition-drift',
        'persona-violation',
      ]),
      severity: z.enum(['low', 'medium', 'high']),
      explanation: z.string(),
      suggestedEdit: z.string(),
    })
  ),
  brandManagerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-emit', 'edit-and-emit', 'park', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  reportArtefact: z.object({
    pdfUrl: z.string(),
    csvUrl: z.string().optional(),
    overallConsistencyScore: z.number().min(0).max(100),
  }),
  generatedAt: z.string(),
})

export type BrandAuditTriggerInput = z.infer<typeof BrandAuditTriggerInputSchema>
export type BrandAuditReportOutput = z.infer<typeof BrandAuditReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_consistencyImprovement: RewardSignal = {
  keyResultRef: 'kr:brand-voice-monitor:brand-voice-consistency-score-improvement',
}
const kr_publishedContentCoverage: RewardSignal = {
  keyResultRef: 'kr:brand-voice-monitor:published-content-coverage',
}
const kr_signalExtractionQuality: RewardSignal = {
  keyResultRef: 'kr:brand-voice-monitor:signal-extraction-quality',
}
const kr_deviationDetectionPrecision: RewardSignal = {
  keyResultRef: 'kr:brand-voice-monitor:deviation-detection-precision',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:brand-voice-monitor:emit-latency',
}

// ============================================================================
// Brand Voice Monitor Service
// ============================================================================

/**
 * Brand Voice Monitor — weekly cron or ad-hoc audit → brand-manager-signed
 * cross-channel brand-voice audit report as a Service.
 *
 * Cascade: fetch-published-content-across-channels (Code, fan-in)
 *        → extract-tone-and-voice-signals-and-score-against-style-guide (Generative)
 *        → flag-deviations-and-suggest-edits (Generative)
 *        → brand-manager-review-and-sign (Human, approval rationale)
 *        → emit-audit-report-and-per-asset-recommendations (Code, fan-out).
 */
export const brandVoiceMonitor: ServiceInstance<BrandAuditTriggerInput, BrandAuditReportOutput> =
  Service.define<BrandAuditTriggerInput, BrandAuditReportOutput>({
    name: 'Brand Voice Monitor',
    promise:
      'Every published asset across social + blog + email + ads + sales-collateral gets continuously audited against the brand style guide, with a brand-manager-signed weekly report flagging deviations and suggesting edits — without burning the brand team on manual sweeps.',
    audience: 'business',
    archetype: 'quality-review',
    schema: { input: BrandAuditTriggerInputSchema, output: BrandAuditReportOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-published-content-across-channels',
          reward: kr_publishedContentCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'extract-tone-and-voice-signals-and-score-against-style-guide',
          reward: kr_signalExtractionQuality,
        }),
        Generative({
          name: 'flag-deviations-and-suggest-edits',
          reward: kr_deviationDetectionPrecision,
        }),
        Human({
          name: 'brand-manager-review-and-sign',
          // `approval` rationale: brand-manager sign-off on the brand voice
          // audit + suggested edits cannot be delegated. The gate stays
          // human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-audit-report-and-per-asset-recommendations',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'cms.published-content',
        'social.published-posts',
        'email.broadcast-history',
        'ads.creative-history',
        'sales-collateral.repository',
        'brand.style-guide',
        'pdf.render',
        'csv.render',
        'gmail.send',
      ],
      // Continuous audit: clarification disabled — the cascade synthesises
      // from the published-content corpus + style-guide; the
      // brand-manager review step at the end is the single human contact
      // point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Ad-hoc audit requests escalate the signal-extraction step to a
          // senior brand-strategist supervisor before the brand-manager
          // review (since ad-hoc means something already went wrong).
          when: 'triggerSource == "ad-hoc-request"',
          action: 'escalate',
        },
        {
          // Every audit routes through brand-manager review-and-sign before
          // it emits; OutcomeContract enforces the signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'brand-manager-review-and-sign',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:brand-voice-monitor-review',
      personas: [
        // Brand-safety reviewer — adversarially probes whether the flagged
        // deviations actually represent reputational-risk brand drift vs.
        // false-positives on stylistic variation that's still on-brand.
        // `riskTolerance: 'low'` aligns with the Service's promise: catch
        // any non-trivial deviation, even at the cost of higher recall.
        Personas.brandSafety({
          riskTolerance: 'low',
          name: 'brand-safety-reviewer',
        }),
        // Voice / brand reviewer — pulls the brand-style-guide ref so the
        // persona can score per-asset adherence directly against the
        // canonical voice / vocabulary / register definition.
        Personas.voice({
          brandVoiceRef: 'brand-style-guide-ref',
          name: 'voice-and-style-reviewer',
        }),
        // Deviation-detection precision reviewer — pedantic check that
        // every flagged deviation cites a concrete style-guide rule, with
        // a suggested edit that actually moves the asset toward the rule.
        Personas.pedantic({
          domain: 'deviation-detection-precision',
          rubric: [
            'every-flag-cites-style-guide-rule',
            'every-flag-has-suggested-edit',
            'suggested-edit-moves-toward-rule',
            'severity-grading-justified',
            'no-cosmetic-flags',
          ],
          name: 'deviation-precision-checker',
        }),
        // Marketing domain reviewer — pulls the senior-brand-strategist
        // expert for judgment on the overall audit-report quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/MarketingManagers',
          name: 'brand-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:brand-voice-monitor:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-brand-manager',
      seller: 'svc:brand-voice-monitor',
      serviceRef: 'svc:brand-voice-monitor',
      // Brand-manager signs every audit before it emits — the brand-voice
      // ownership cannot be delegated.
      predicate: AND(
        SchemaMatch(BrandAuditReportOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['brand-manager'] })
      ),
      // Subscription amount per cycle — the per-month plan amount is in
      // `pricing.plan`. Reflected here for predicate-level quote display.
      amount: { amount: 79900n, currency: 'USD' },
      // 7-day SLA — the audit should land in the brand-manager inbox
      // within a week of the cron fire (or ad-hoc request).
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'brand-voice-monitor:standard',
        amount: 79900n,
        currency: 'USD',
        interval: 'month',
      },
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 2500n, perApiCall: 6n },
    reward: kr_consistencyImprovement,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/brand-voice-monitor',
      icpContextProblemRef: 'icp:brand-voice-monitor:v1',
      foundingHypothesisRef: 'fh:brand-voice-monitor:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
