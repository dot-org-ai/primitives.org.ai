/**
 * Campaign Brief Generator Service — campaign-kickoff brief authoring for the
 * marketing catalog.
 *
 * Distinguishing shape vs. siblings (`seo-content-pillar-author`,
 * `paid-ad-creative-iterator`):
 *   - `content-generation` archetype — the artefact is a CMO-signed campaign
 *     brief doc (narrative + channel mix + creative direction + budget),
 *     not an SEO pillar page or an ad-creative variant set;
 *   - 5-step cascade: Code fan-in (brand voice + audience profile + past
 *     campaign perf) → Generative (synthesize campaign narrative) →
 *     Generative (channel mix + creative direction) → Human (CMO review +
 *     sign) → Code (emit brief doc);
 *   - `Pricing.perInvocation` 3 tiers — tactical / strategic / launch
 *     ($499 / $1,999 / $4,999) — keyed on the campaign-tier band the PMM
 *     declares at intake;
 *   - declarative HITL = mandatory CMO review-and-sign Human Function (the
 *     CMO owns the brand voice and budget envelope), plus OutcomeContract
 *     requires CMO signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(audience-fit +
 *     brand-voice-coherence + budget-realism) + HumanSign(CMO))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (perInvocation pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `campaign-brief-cycle-time-reduction` — the
 * compound metric every CMO/PMM org optimises against (the brief is worth
 * running iff briefs ship in hours not weeks vs. the pre-Service baseline).
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
 * Input — a campaign idea + audience hypothesis from the CMO/PMM. Tight: 6
 * fields cover the campaign identity, the kickoff hypothesis, the audience
 * descriptor, the budget envelope, the in-flight window, and the campaign
 * tier so the perInvocation pricing tier is resolvable at intake.
 */
export const CampaignKickoffInputSchema = z.object({
  campaignId: z.string(),
  kickoffHypothesis: z.string(),
  audienceHypothesis: z.object({
    primarySegmentRef: z.string(),
    secondarySegmentRefs: z.array(z.string()).default([]),
    icpDescriptor: z.string(),
  }),
  budgetEnvelopeCents: z.bigint(),
  flightWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  campaignTier: z.enum(['tactical', 'strategic', 'launch']),
})

/**
 * Output — a CMO-signed campaign brief: the synthesized narrative, the
 * proposed channel mix + creative direction, the CMO-review audit, and
 * pointers to the rendered brief artefact (PDF + Figma board).
 */
export const CampaignBriefOutputSchema = z.object({
  campaignId: z.string(),
  narrative: z.object({
    summary: z.string(),
    coreInsight: z.string(),
    bigIdea: z.string(),
    audienceFit: z.array(
      z.object({
        segmentRef: z.string(),
        rationale: z.string(),
      })
    ),
  }),
  channelMix: z.array(
    z.object({
      channel: z.enum([
        'paid-search',
        'paid-social',
        'organic-social',
        'email',
        'content',
        'pr',
        'events',
        'influencer',
        'display',
      ]),
      budgetAllocationPercent: z.number().min(0).max(100),
      rationale: z.string(),
    })
  ),
  creativeDirection: z.object({
    visualDirection: z.string(),
    voiceTone: z.string(),
    keyMessages: z.array(z.string()).min(1),
  }),
  cmoReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  brief: z.object({
    pdfUrl: z.string(),
    figmaBoardUrl: z.string().optional(),
    pageCount: z.number().int().positive(),
  }),
  generatedAt: z.string(),
})

export type CampaignKickoffInput = z.infer<typeof CampaignKickoffInputSchema>
export type CampaignBriefOutput = z.infer<typeof CampaignBriefOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_briefCycleTime: RewardSignal = {
  keyResultRef: 'kr:campaign-brief-generator:campaign-brief-cycle-time-reduction',
}
const kr_brandVoiceCoverage: RewardSignal = {
  keyResultRef: 'kr:campaign-brief-generator:brand-voice-coverage',
}
const kr_narrativeQuality: RewardSignal = {
  keyResultRef: 'kr:campaign-brief-generator:narrative-quality',
}
const kr_channelMixRealism: RewardSignal = {
  keyResultRef: 'kr:campaign-brief-generator:channel-mix-realism',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:campaign-brief-generator:emit-latency',
}

// ============================================================================
// Campaign Brief Generator Service
// ============================================================================

/**
 * Campaign Brief Generator — campaign-kickoff webhook → CMO-signed campaign
 * brief doc as a Service.
 *
 * Cascade: fetch-brand-voice-audience-profile-and-past-campaign-perf (Code, fan-in)
 *        → synthesize-campaign-narrative (Generative)
 *        → propose-channel-mix-and-creative-direction (Generative)
 *        → cmo-review-and-sign (Human, approval rationale)
 *        → emit-brief-doc (Code, PDF + Figma board fan-out).
 */
export const campaignBriefGenerator: ServiceInstance<CampaignKickoffInput, CampaignBriefOutput> =
  Service.define<CampaignKickoffInput, CampaignBriefOutput>({
    name: 'Campaign Brief Generator',
    promise:
      'Every campaign idea + audience hypothesis becomes a CMO-signed brief — narrative, channel mix, creative direction, budget — in hours, not weeks.',
    audience: 'business',
    archetype: 'content-generation',
    schema: { input: CampaignKickoffInputSchema, output: CampaignBriefOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-brand-voice-audience-profile-and-past-campaign-perf',
          reward: kr_brandVoiceCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-campaign-narrative',
          reward: kr_narrativeQuality,
        }),
        Generative({
          name: 'propose-channel-mix-and-creative-direction',
          reward: kr_channelMixRealism,
        }),
        Human({
          name: 'cmo-review-and-sign',
          // `approval` rationale: CMO sign-off on the campaign brand voice +
          // budget envelope cannot be delegated. The gate stays human.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-brief-doc',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'brand.voice-guide',
        'crm.audience-segments',
        'marketing-analytics.past-campaigns',
        'marketing-analytics.audience-profiles',
        'figma.boards',
        'pdf.render',
        'gmail.send',
      ],
      // Campaign-kickoff brief: clarification disabled — the brief is
      // synthesised from the brand voice + audience profile + past-perf
      // signals; the cascade does not pause to clarify with the PMM. The
      // CMO review step at the end is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Launch-tier campaigns (the highest budget envelope) escalate the
          // narrative + channel-mix synthesis to a senior brand-strategist
          // supervisor before the CMO review.
          when: 'campaignTier == "launch"',
          action: 'escalate',
        },
        {
          // Every brief routes through CMO review-and-sign before it emits;
          // OutcomeContract enforces the signature, the trigger primes the
          // queue.
          when: 'true',
          action: 'route-to',
          target: 'cmo-review-and-sign',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:campaign-brief-generator-review',
      personas: [
        // Audience-fit reviewer — adversarially probes whether the
        // synthesized narrative actually resonates with the declared
        // primary segment, not generic "speak to everyone" boilerplate.
        Personas.skeptic({
          domain: 'audience-fit',
          focus: ['segment-grounded', 'not-generic', 'rationale-cites-icp'],
          name: 'audience-fit-reviewer',
        }),
        // Brand-voice coherence reviewer — pedantic check that the narrative
        // + creative direction match the brand voice guide and don't drift
        // into off-brand territory.
        Personas.pedantic({
          domain: 'brand-voice-coherence',
          rubric: [
            'matches-voice-guide-tone',
            'matches-voice-guide-vocabulary',
            'no-off-brand-claims',
            'creative-direction-consistent-with-narrative',
          ],
          name: 'brand-voice-checker',
        }),
        // Budget-realism reviewer — pedantic check that the proposed channel
        // mix sums to 100%, fits inside the declared budget envelope, and
        // each channel allocation has rationale grounded in the past-perf
        // baseline.
        Personas.pedantic({
          domain: 'budget-realism',
          rubric: [
            'channel-mix-sums-to-100-percent',
            'fits-budget-envelope',
            'every-channel-rationale-cites-past-perf',
            'no-dark-channels-without-justification',
          ],
          name: 'budget-realism-checker',
        }),
        // Marketing domain reviewer — pulls the senior-CMO expert for
        // judgment on the overall brief quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/MarketingManagers',
          name: 'marketing-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:campaign-brief-generator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cmo',
      seller: 'svc:campaign-brief-generator',
      serviceRef: 'svc:campaign-brief-generator',
      // CMO signs every brief before it emits — the brand voice +
      // budget envelope ownership cannot be delegated.
      predicate: AND(
        SchemaMatch(CampaignBriefOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['cmo'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 199900n, currency: 'USD' },
      // 2-day SLA — the brief should land in CMO inbox within 48 hours of
      // kickoff so the campaign cycle isn't bottlenecked on the brief.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.perInvocation({
      tiers: [
        {
          id: 'tactical',
          amount: 49900n,
          includedPerMonth: 12,
          overage: 49900n,
        },
        {
          id: 'strategic',
          amount: 199900n,
          includedPerMonth: 6,
          overage: 199900n,
        },
        {
          id: 'launch',
          amount: 499900n,
          includedPerMonth: 2,
          overage: 499900n,
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 1500n, perApiCall: 8n },
    reward: kr_briefCycleTime,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/campaign-brief-generator',
      icpContextProblemRef: 'icp:campaign-brief-generator:v1',
      foundingHypothesisRef: 'fh:campaign-brief-generator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
