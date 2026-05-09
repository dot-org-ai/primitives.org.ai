/**
 * Webinar Funnel Orchestrator Service — webinar lead-gen funnel
 * orchestration for the marketing catalog.
 *
 * Distinguishing shape vs. siblings (`campaign-brief-generator`,
 * `seo-content-pillar-author`, `paid-ad-creative-iterator`,
 * `brand-voice-monitor`, `content-localization-orchestrator`,
 * `campaign-attribution-auditor`, `email-nurture-sequencer`,
 * `competitor-positioning-monitor`):
 *   - `content-generation` archetype — the artefact is a growth-marketer-
 *     launched webinar funnel asset bundle (thesis + abstract + speaker
 *     bios + landing copy + pre-event email + ads + organic-social) with
 *     tracking config wired, not a brief, audit, ad-creative, localised
 *     bundle, positioning report, or nurture sequence;
 *   - 5-step cascade: Code fan-in (fetch audience segments + topic-fit +
 *     speaker pool + prior-webinar performance) → Generative (draft
 *     webinar thesis + abstract + speaker bios + landing copy) →
 *     Generative (synthesize promo sequence: pre-event emails + ads +
 *     organic social) → Human (growth-marketer review-and-launch,
 *     `approval` rationale — the growth-marketer owns the funnel-
 *     launch accountability) → Code (emit asset bundle + tracking
 *     config);
 *   - `Pricing.outcome` 3 tiers (micro / standard / flagship) keyed on
 *     webinar tier ($999 / $2,999 / $9,999) — the funnel is worth more
 *     on a flagship multi-speaker launch than a micro-webinar;
 *   - declarative HITL = mandatory growth-marketer review-and-launch
 *     Human Function (the growth-marketer owns the funnel-launch
 *     accountability), plus OutcomeContract requires growth-marketer
 *     signature with `approval` rationale;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(thesis-clarity
 *     + asset-cohesion + funnel-realism) + HumanSign(growth-marketer))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `webinar-attended-rate-and-MQL-yield` — the
 * compound metric every demand-gen org optimises against (the webinar is
 * worth running iff registrant→attended rate climbs and per-attendee
 * MQL yield meets or beats the pre-Service baseline within the SLA
 * window).
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
 * Input — a planned webinar + audience-hypothesis declaration. Tight: 8
 * fields cover the webinar identity, the planned-date + format, the
 * audience-hypothesis descriptor, the candidate-topic pointer, the speaker
 * pool, prior-webinar-performance ref (so the new funnel learns from past
 * sends), the webinar-tier band so the outcome pricing tier is resolvable
 * at intake, and the assigned growth-marketer (so the Human review step
 * routes to the right inbox).
 */
export const WebinarPlanInputSchema = z.object({
  webinarId: z.string(),
  plannedDate: z.string(), // ISO-8601
  format: z.enum(['live-webinar', 'on-demand-launch', 'multi-day-summit']),
  audienceHypothesis: z.object({
    primarySegmentRef: z.string(),
    descriptor: z.string(),
    estimatedReach: z.number().int().nonnegative(),
  }),
  candidateTopic: z.object({
    topicTitle: z.string(),
    topicAngle: z.string(),
    relatedClusterRefs: z.array(z.string()),
  }),
  speakerPool: z
    .array(
      z.object({
        speakerRef: z.string(),
        nameAndRole: z.string(),
        bioSourceRef: z.string(),
      })
    )
    .min(1),
  priorWebinarPerformanceRef: z.string(),
  webinarTierBand: z.enum(['micro', 'standard', 'flagship']),
  assignedGrowthMarketerRef: z.string(),
})

/**
 * Output — a growth-marketer-launched webinar funnel bundle: the drafted
 * webinar thesis + abstract + speaker bios + landing copy, the synthesized
 * promo sequence (pre-event emails + ads + organic social), the growth-
 * marketer review audit, and pointers to the emitted asset bundle +
 * tracking config.
 */
export const WebinarFunnelOutputSchema = z.object({
  webinarId: z.string(),
  thesisAndAbstract: z.object({
    thesisStatement: z.string(),
    abstractMarkdown: z.string(),
    keyTakeaways: z.array(z.string()).min(3),
  }),
  speakerBios: z
    .array(
      z.object({
        speakerRef: z.string(),
        bioMarkdown: z.string(),
        photoUrl: z.string().optional(),
      })
    )
    .min(1),
  landingCopy: z.object({
    headline: z.string(),
    subheadline: z.string(),
    bodyMarkdown: z.string(),
    cta: z.object({
      label: z.string(),
      registerUrl: z.string(),
    }),
  }),
  promoSequence: z.object({
    preEventEmails: z
      .array(
        z.object({
          touchIndex: z.number().int().min(1),
          sendOffsetDays: z.number().int(),
          subject: z.string(),
          bodyMarkdown: z.string(),
        })
      )
      .min(1),
    ads: z.array(
      z.object({
        platform: z.enum([
          'google-ads',
          'meta-ads',
          'linkedin-ads',
          'tiktok-ads',
          'reddit-ads',
          'youtube-ads',
        ]),
        headline: z.string(),
        body: z.string(),
        creativeRef: z.string().optional(),
      })
    ),
    organicSocial: z.array(
      z.object({
        platform: z.enum(['linkedin', 'twitter-x', 'mastodon', 'bluesky', 'instagram', 'tiktok']),
        cadence: z.enum(['daily', 'every-other-day', 'weekly', 'event-week-only']),
        copyMarkdown: z.string(),
      })
    ),
  }),
  growthMarketerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-launch', 'edit-and-launch', 'park', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedBundle: z.object({
    assetBundleUrl: z.string(),
    trackingConfig: z.object({
      utmTemplate: z.string(),
      conversionEventNames: z.array(z.string()),
      attributionWindowDays: z.number().int().positive(),
    }),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type WebinarPlanInput = z.infer<typeof WebinarPlanInputSchema>
export type WebinarFunnelOutput = z.infer<typeof WebinarFunnelOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_attendedRateAndMqlYield: RewardSignal = {
  keyResultRef: 'kr:webinar-funnel-orchestrator:webinar-attended-rate-and-mql-yield',
}
const kr_audienceFitCoverage: RewardSignal = {
  keyResultRef: 'kr:webinar-funnel-orchestrator:audience-fit-coverage',
}
const kr_thesisDraftQuality: RewardSignal = {
  keyResultRef: 'kr:webinar-funnel-orchestrator:thesis-draft-quality',
}
const kr_promoSequenceCohesion: RewardSignal = {
  keyResultRef: 'kr:webinar-funnel-orchestrator:promo-sequence-cohesion',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:webinar-funnel-orchestrator:emit-latency',
}

// ============================================================================
// Webinar Funnel Orchestrator Service
// ============================================================================

/**
 * Webinar Funnel Orchestrator — webinar plan + audience hypothesis →
 * growth-marketer-launched webinar asset bundle + tracking config as a
 * Service.
 *
 * Cascade: fetch-audience-segments-topic-fit-speaker-pool-and-prior-webinar-perf (Code, fan-in)
 *        → draft-webinar-thesis-abstract-speaker-bios-and-landing-copy (Generative)
 *        → synthesize-promo-sequence-pre-event-emails-ads-and-organic-social (Generative)
 *        → growth-marketer-review-and-launch (Human, approval rationale)
 *        → emit-asset-bundle-and-tracking-config (Code, fan-out).
 */
export const webinarFunnelOrchestrator: ServiceInstance<WebinarPlanInput, WebinarFunnelOutput> =
  Service.define<WebinarPlanInput, WebinarFunnelOutput>({
    name: 'Webinar Funnel Orchestrator',
    promise:
      'Every planned webinar becomes a growth-marketer-launched funnel bundle — thesis + abstract + speaker bios + landing copy + pre-event emails + ads + organic social + tracking config — within days, lifting registrant→attended rate and per-attendee MQL yield vs. baseline.',
    audience: 'business',
    archetype: 'content-generation',
    schema: { input: WebinarPlanInputSchema, output: WebinarFunnelOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-audience-segments-topic-fit-speaker-pool-and-prior-webinar-perf',
          reward: kr_audienceFitCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'draft-webinar-thesis-abstract-speaker-bios-and-landing-copy',
          reward: kr_thesisDraftQuality,
        }),
        Generative({
          name: 'synthesize-promo-sequence-pre-event-emails-ads-and-organic-social',
          reward: kr_promoSequenceCohesion,
        }),
        Human({
          name: 'growth-marketer-review-and-launch',
          // `approval` rationale: the growth-marketer owns the funnel-
          // launch accountability + cross-channel asset deployment. The
          // gate stays human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-asset-bundle-and-tracking-config',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'crm.audience-segments',
        'cms.topic-clusters',
        'speaker.bio-store',
        'webinar.prior-perf',
        'cms.landing-pages',
        'esp.broadcast',
        'ads.campaign-config',
        'social.publishing',
        'analytics.tracking-config',
        'gmail.send',
      ],
      // Webinar funnel: clarification disabled — the cascade synthesises
      // from the audience + topic + speaker pool; the growth-marketer
      // review step at the end is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Flagship webinars escalate the thesis-drafting step to a senior
          // demand-gen-strategist supervisor before the growth-marketer
          // review runs (since the launch surface is much wider).
          when: 'webinarTierBand == "flagship"',
          action: 'escalate',
        },
        {
          // Every funnel routes through growth-marketer review before
          // launch; OutcomeContract enforces the signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'growth-marketer-review-and-launch',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:webinar-funnel-orchestrator-review',
      personas: [
        // Brand-safety reviewer — `riskTolerance: 'medium'` — webinar copy
        // can flex with the topic + speaker stance but must not introduce
        // off-brand drift across the cross-channel asset bundle.
        Personas.brandSafety({
          riskTolerance: 'medium',
          name: 'brand-safety-reviewer',
        }),
        // Scope-clarity reviewer — `artifactType: 'project-brief'` — the
        // webinar asset bundle behaves like a project brief: thesis +
        // abstract + speaker bios + landing copy + promo sequence must
        // all share an explicit scope-boundary (what the webinar covers,
        // what it does NOT promise) so the launched assets don't over-
        // commit to undeliverable takeaways.
        Personas.scopeClarity({
          artifactType: 'project-brief',
          name: 'scope-clarity-reviewer',
        }),
        // Funnel-realism reviewer — pedantic check that the promo sequence
        // ladders to the thesis (not generic webinar copy), the per-channel
        // assets cohere on the same value proposition, and the tracking
        // config covers every conversion event the funnel emits.
        Personas.pedantic({
          domain: 'funnel-realism-and-asset-cohesion',
          rubric: [
            'thesis-stated-explicitly',
            'every-asset-laddrs-to-thesis',
            'cross-channel-value-prop-coheres',
            'tracking-config-covers-conversion-events',
            'pre-event-email-cadence-realistic',
            'no-orphan-assets',
          ],
          name: 'funnel-realism-checker',
        }),
        // Marketing domain reviewer — pulls the senior-demand-gen-
        // strategist expert for judgment on the overall funnel quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/MarketingManagers',
          name: 'demand-gen-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:webinar-funnel-orchestrator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-growth-marketer',
      seller: 'svc:webinar-funnel-orchestrator',
      serviceRef: 'svc:webinar-funnel-orchestrator',
      // Growth-marketer signs every funnel before launch — the funnel-
      // launch accountability cannot be delegated.
      predicate: AND(
        SchemaMatch(WebinarFunnelOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['growth-marketer'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 299900n, currency: 'USD' },
      // 7-day SLA — webinar funnel orchestration should land in the
      // growth-marketer inbox within a working week.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'micro',
          amount: 99900n,
          currency: 'USD',
          description: 'Micro webinar (single speaker, single segment) funnel — $999.',
        },
        {
          id: 'standard',
          amount: 299900n,
          currency: 'USD',
          description: 'Standard webinar (1–2 speakers, multi-channel promo) funnel — $2,999.',
        },
        {
          id: 'flagship',
          amount: 999900n,
          currency: 'USD',
          description: 'Flagship webinar / multi-day summit funnel — $9,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 5000n, perApiCall: 13n },
    reward: kr_attendedRateAndMqlYield,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/webinar-funnel-orchestrator',
      icpContextProblemRef: 'icp:webinar-funnel-orchestrator:v1',
      foundingHypothesisRef: 'fh:webinar-funnel-orchestrator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
