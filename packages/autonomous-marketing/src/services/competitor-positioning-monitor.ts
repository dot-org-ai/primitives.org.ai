/**
 * Competitor Positioning Monitor Service — weekly competitive-positioning
 * intelligence for the marketing catalog.
 *
 * Distinguishing shape vs. siblings (`campaign-brief-generator`,
 * `seo-content-pillar-author`, `paid-ad-creative-iterator`,
 * `brand-voice-monitor`, `content-localization-orchestrator`,
 * `campaign-attribution-auditor`, `email-nurture-sequencer`,
 * `webinar-funnel-orchestrator`):
 *   - `multi-step-research` archetype — the artefact is a PMM-lead-signed
 *     weekly competitive-positioning brief that detects positioning deltas,
 *     pricing changes, persona shifts, and new-feature drops across the
 *     competitor set, then synthesises threat vectors + offensive-or-
 *     defensive recommendations, not a brief, audit, ad-creative,
 *     localised bundle, or webinar funnel;
 *   - 5-step cascade: Code fan-in (fetch competitor product pages + recent
 *     positioning changes + funding/news events) → Agentic supervised
 *     extract (messaging frames + pricing changes + persona shifts + new
 *     features) → Generative (synthesize positioning deltas + threat
 *     vectors + offensive-or-defensive recommendations) → Human (PMM-
 *     lead review, `approval` rationale — the PMM-lead owns competitive
 *     positioning ownership) → Code (emit positioning brief + tracker
 *     update);
 *   - `Pricing.subscription` ($899/mo per PMM-team) + metered overage
 *     `[{ event: 'major-positioning-change-detected', amount: 99 }]` —
 *     the recurring intelligence stream + per-event overage when the
 *     watch list breaks;
 *   - declarative HITL = mandatory PMM-lead review Human Function (the
 *     PMM-lead owns the competitive-positioning narrative + GTM/pricing
 *     handoff), plus OutcomeContract requires PMM-lead signature with
 *     `approval` rationale;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(delta-detection-
 *     precision + threat-prioritization + recommendation-actionability) +
 *     HumanSign(PMM-lead))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (subscription + metered pricing factory) +
 * §8 (ProofPredicate AND).
 *
 * Service-level reward = `competitive-win-rate-improvement` — the
 * compound metric every PMM/competitive-intelligence org optimises against
 * (the monitor is worth running iff sales-cycle competitive win-rate
 * climbs vs. the pre-Service baseline within the SLA window).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a weekly competitive-intelligence trigger. Tight: 6 fields cover
 * the monitor identity, the cron-or-adhoc signal, the audit window, the
 * competitor-set under watch (each with product-page URL + tracker refs),
 * the PMM-team identifier (so the per-team $/mo plan is resolvable), and
 * the assigned PMM-lead (so the Human review step routes to the right
 * inbox).
 */
export const CompetitorMonitorTriggerInputSchema = z.object({
  monitorId: z.string(),
  triggerSource: z.enum(['weekly-cron', 'ad-hoc-request']),
  monitorWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  competitorSet: z
    .array(
      z.object({
        competitorId: z.string(),
        competitorName: z.string(),
        productPageUrls: z.array(z.string()).min(1),
        pricingPageUrl: z.string().optional(),
        newsAndFundingTrackerRefs: z.array(z.string()),
      })
    )
    .min(1),
  pmmTeamRef: z.string(),
  assignedPmmLeadRef: z.string(),
})

/**
 * Output — a PMM-lead-signed weekly competitive-positioning brief: the
 * extracted messaging frames + pricing changes + persona shifts + new
 * features per competitor, the synthesised positioning deltas + threat
 * vectors + recommendations, the PMM-lead review audit, and pointers to
 * the emitted positioning brief + tracker-update.
 */
export const CompetitorPositioningBriefOutputSchema = z.object({
  monitorId: z.string(),
  monitorWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  perCompetitorExtractions: z
    .array(
      z.object({
        competitorId: z.string(),
        messagingFrames: z.array(z.string()).min(1),
        pricingChanges: z.array(
          z.object({
            sku: z.string(),
            oldPrice: z.string().optional(),
            newPrice: z.string(),
            changeType: z.enum([
              'increase',
              'decrease',
              'new-tier',
              'tier-removed',
              'packaging-shift',
            ]),
            citation: z.string(),
          })
        ),
        personaShifts: z.array(
          z.object({
            fromPersona: z.string(),
            toPersona: z.string(),
            evidence: z.string(),
            citation: z.string(),
          })
        ),
        newFeatures: z.array(
          z.object({
            featureName: z.string(),
            shippedAt: z.string().optional(),
            citation: z.string(),
          })
        ),
      })
    )
    .min(1),
  positioningDeltas: z.array(
    z.object({
      competitorId: z.string(),
      deltaType: z.enum([
        'messaging-frame-shift',
        'pricing-change',
        'persona-shift',
        'new-feature',
        'category-redefinition',
        'positioning-against-self',
      ]),
      severity: z.enum(['low', 'medium', 'major']),
      explanation: z.string(),
      sourceCitations: z.array(z.string()).min(1),
    })
  ),
  threatVectors: z.array(
    z.object({
      competitorId: z.string(),
      threatType: z.enum([
        'pricing-undercut',
        'category-creation',
        'feature-leapfrog',
        'persona-poach',
        'channel-poach',
        'partnership-leverage',
      ]),
      affectedAccounts: z.array(z.string()),
      priority: z.enum(['watch', 'mitigate', 'urgent']),
    })
  ),
  recommendations: z.array(
    z.object({
      stance: z.enum(['offensive', 'defensive', 'observe']),
      action: z.string(),
      ownerRoleHint: z.string(),
      timeHorizon: z.enum(['immediate', '30-day', '60-day', 'next-cycle']),
    })
  ),
  pmmLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-emit', 'edit-and-emit', 'park', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  briefArtefact: z.object({
    pdfUrl: z.string(),
    trackerUpdateRef: z.string(),
  }),
  generatedAt: z.string(),
})

export type CompetitorMonitorTriggerInput = z.infer<typeof CompetitorMonitorTriggerInputSchema>
export type CompetitorPositioningBriefOutput = z.infer<
  typeof CompetitorPositioningBriefOutputSchema
>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_competitiveWinRate: RewardSignal = {
  keyResultRef: 'kr:competitor-positioning-monitor:competitive-win-rate-improvement',
}
const kr_competitorCoverage: RewardSignal = {
  keyResultRef: 'kr:competitor-positioning-monitor:competitor-coverage',
}
const kr_extractionPrecision: RewardSignal = {
  keyResultRef: 'kr:competitor-positioning-monitor:extraction-precision',
}
const kr_deltaSynthesisQuality: RewardSignal = {
  keyResultRef: 'kr:competitor-positioning-monitor:delta-synthesis-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:competitor-positioning-monitor:emit-latency',
}

// ============================================================================
// Competitor Positioning Monitor Service
// ============================================================================

/**
 * Competitor Positioning Monitor — weekly cron or ad-hoc → PMM-lead-signed
 * competitive-positioning brief + tracker update as a Service.
 *
 * Cascade: fetch-competitor-product-pages-recent-positioning-changes-and-funding-news (Code, fan-in)
 *        → supervised-extract-messaging-frames-pricing-changes-persona-shifts-and-new-features (Agentic, supervised)
 *        → synthesize-positioning-deltas-threat-vectors-and-recommendations (Generative)
 *        → pmm-lead-review (Human, approval rationale)
 *        → emit-positioning-brief-and-tracker-update (Code, fan-out).
 */
export const competitorPositioningMonitor: ServiceInstance<
  CompetitorMonitorTriggerInput,
  CompetitorPositioningBriefOutput
> = Service.define<CompetitorMonitorTriggerInput, CompetitorPositioningBriefOutput>({
  name: 'Competitor Positioning Monitor',
  promise:
    'Every week the competitor set is monitored for messaging-frame, pricing, persona, and feature shifts — synthesised into a PMM-lead-signed brief with threat vectors and offensive-or-defensive recommendations, lifting competitive win-rate vs. baseline.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: {
    input: CompetitorMonitorTriggerInputSchema,
    output: CompetitorPositioningBriefOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-competitor-product-pages-recent-positioning-changes-and-funding-news',
        reward: kr_competitorCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'supervised-extract-messaging-frames-pricing-changes-persona-shifts-and-new-features',
        reward: kr_extractionPrecision,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'synthesize-positioning-deltas-threat-vectors-and-recommendations',
        reward: kr_deltaSynthesisQuality,
      }),
      Human({
        name: 'pmm-lead-review',
        // `approval` rationale: the PMM-lead owns competitive-positioning
        // accountability + GTM/pricing handoff. The gate stays human
        // regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-positioning-brief-and-tracker-update',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'web.fetch',
      'web.search',
      'competitor.tracker',
      'news.feed',
      'funding.tracker',
      'pmm.brief-store',
      'pdf.render',
      'gmail.send',
    ],
    // Competitive intelligence: clarification disabled — the cascade
    // synthesises from the watch-list + public corpus; the PMM-lead review
    // step at the end is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Ad-hoc requests escalate the extraction step to a senior
        // competitive-intelligence supervisor before the PMM-lead review
        // (since ad-hoc usually means a real-time event surfaced).
        when: 'triggerSource == "ad-hoc-request"',
        action: 'escalate',
      },
      {
        // Every brief routes through PMM-lead review before emit;
        // OutcomeContract enforces the signature, the trigger primes the
        // queue.
        when: 'true',
        action: 'route-to',
        target: 'pmm-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:competitor-positioning-monitor-review',
    personas: [
      // Factual-accuracy reviewer — competitive-intelligence claims must
      // cite first-party sources (the competitor's own product page,
      // pricing page, blog) or industry-standard sources (analyst reports).
      // No second-hand summaries without citations.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['first-party', 'industry-standard'],
        name: 'factual-accuracy-reviewer',
      }),
      // Commercial-fit reviewer — `audienceForPitch: 'internal-stakeholder'`
      // calibrates the review to internal-GTM-team consumption (the brief
      // is for the PMM/CRO/sales-leadership chain, not external pitch).
      Personas.commercialFit({
        audienceForPitch: 'internal-stakeholder',
        name: 'commercial-fit-reviewer',
      }),
      // Threat-prioritisation reviewer — pedantic check that every delta
      // ladders to a threat vector with a stated priority, and every
      // priority lands on a recommendation with a stated stance + time
      // horizon.
      Personas.pedantic({
        domain: 'threat-prioritization-and-recommendation-actionability',
        rubric: [
          'every-delta-ladders-to-threat-vector',
          'every-threat-has-priority-grade',
          'every-recommendation-has-stance-and-time-horizon',
          'no-orphan-observations',
          'no-vague-action-statements',
        ],
        name: 'threat-prioritisation-checker',
      }),
      // Marketing domain reviewer — pulls the senior-PMM expert for
      // judgment on the overall positioning-brief quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/MarketingManagers',
        name: 'pmm-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:competitor-positioning-monitor:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-pmm-lead',
    seller: 'svc:competitor-positioning-monitor',
    serviceRef: 'svc:competitor-positioning-monitor',
    // PMM-lead signs every brief before it emits — the competitive-
    // positioning ownership cannot be delegated.
    predicate: AND(
      SchemaMatch(CompetitorPositioningBriefOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['PMM-lead'] })
    ),
    // Subscription amount per cycle — the per-month plan amount is in
    // `pricing.plan`. Reflected here for predicate-level quote display.
    amount: { amount: 89900n, currency: 'USD' },
    // 7-day SLA — the brief should land in the PMM-lead inbox within a
    // week of the cron fire (or ad-hoc request).
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'competitor-positioning-monitor:standard',
      amount: 89900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'major-positioning-change-detected',
        amount: 9900n,
        description:
          'Per major-positioning-change overage — fires when an extracted delta is graded `major` severity (pricing change, category redefinition, or feature leapfrog).',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 5500n, perApiCall: 14n },
  reward: kr_competitiveWinRate,

  lineage: {
    cellRef: 'business.org.ai/cells/marketing-managers/competitor-positioning-monitor',
    icpContextProblemRef: 'icp:competitor-positioning-monitor:v1',
    foundingHypothesisRef: 'fh:competitor-positioning-monitor:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
