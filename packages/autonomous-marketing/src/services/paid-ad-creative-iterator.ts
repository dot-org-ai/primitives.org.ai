/**
 * Paid Ad Creative Iterator Service — ad-creative variant generation +
 * performance feedback loop for the marketing catalog.
 *
 * Distinguishing shape vs. siblings (`campaign-brief-generator`,
 * `seo-content-pillar-author`):
 *   - `content-generation` archetype — the artefact is N new ad-creative
 *     variants per identified iteration axis, deployed into the ad
 *     platform after a brand-safety review, not a campaign brief or SEO
 *     pillar page;
 *   - 5-step cascade: Code fan-in (current creative perf + audience
 *     engagement signals) → Generative (synthesize which axes to iterate)
 *     → Generative (emit N variants per axis) → Human (brand-manager
 *     review for brand safety) → Code (deploy to ad platform);
 *   - `Pricing.percentOf` — 8% of ad-spend-attributed conversions, capped
 *     at $50k per account per month (the Service shares in the upside it
 *     creates by lowering CPA);
 *   - declarative HITL = mandatory brand-manager review-and-approve Human
 *     Function (regulatory + brand-safety gate), plus OutcomeContract
 *     requires brand-manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(brand-safety +
 *     variant-distinctiveness + audience-fit) + HumanSign(brand-manager))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (percentOf pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `cost-per-acquisition-improvement-vs-baseline` —
 * the compound metric every paid-media org optimises against (the
 * iterator is worth running iff CPA on iterated variants beats the
 * baseline creative's CPA at the 7-day perf threshold).
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
 * Input — an in-flight ad campaign hitting the 7-day-perf threshold. Tight:
 * 6 fields cover campaign identity, the 7-day perf snapshot driving the
 * iteration trigger, the audience descriptor, the variants-per-axis cap so
 * the generation step is bounded, the platform target, and the assigned
 * brand-manager (so the Human review step routes to the right inbox).
 */
export const AdPerfTriggerInputSchema = z.object({
  campaignId: z.string(),
  perfSnapshot: z.object({
    windowDays: z.literal(7),
    impressions: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
    conversions: z.number().int().nonnegative(),
    spendCents: z.bigint(),
    baselineCpaCents: z.bigint(),
    currentCpaCents: z.bigint(),
  }),
  audienceDescriptor: z.string(),
  variantsPerAxisCap: z.number().int().min(1).max(10),
  adPlatform: z.enum(['google-ads', 'meta-ads', 'linkedin-ads', 'tiktok-ads', 'reddit-ads']),
  assignedBrandManagerRef: z.string(),
})

/**
 * Output — a brand-manager-approved variant set deployed to the ad
 * platform: the identified iteration axes, the per-axis variant set, the
 * brand-manager review audit, and pointers to the deployed ad-platform
 * artefacts.
 */
export const AdVariantSetOutputSchema = z.object({
  campaignId: z.string(),
  iterationAxes: z
    .array(
      z.object({
        axis: z.enum([
          'headline',
          'body-copy',
          'visual',
          'call-to-action',
          'value-proposition',
          'social-proof',
          'urgency',
        ]),
        rationale: z.string(),
        baselineSignalCitations: z.array(z.string()).min(1),
      })
    )
    .min(1),
  variants: z.array(
    z.object({
      variantId: z.string(),
      axis: z.string(),
      headline: z.string(),
      bodyCopy: z.string(),
      visualBriefMarkdown: z.string(),
      callToAction: z.string(),
    })
  ),
  brandManagerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-all', 'approve-subset', 'reject', 'request-edit']),
    approvedVariantIds: z.array(z.string()),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  deployment: z.object({
    deployedVariantIds: z.array(z.string()),
    platformAdRefs: z.array(z.string()),
    deployedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type AdPerfTriggerInput = z.infer<typeof AdPerfTriggerInputSchema>
export type AdVariantSetOutput = z.infer<typeof AdVariantSetOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_cpaImprovement: RewardSignal = {
  keyResultRef: 'kr:paid-ad-creative-iterator:cost-per-acquisition-improvement-vs-baseline',
}
const kr_perfSignalCoverage: RewardSignal = {
  keyResultRef: 'kr:paid-ad-creative-iterator:perf-signal-coverage',
}
const kr_axisIdentification: RewardSignal = {
  keyResultRef: 'kr:paid-ad-creative-iterator:axis-identification',
}
const kr_variantDistinctiveness: RewardSignal = {
  keyResultRef: 'kr:paid-ad-creative-iterator:variant-distinctiveness',
}
const kr_deployLatency: RewardSignal = {
  keyResultRef: 'kr:paid-ad-creative-iterator:deploy-latency',
}

// ============================================================================
// Paid Ad Creative Iterator Service
// ============================================================================

/**
 * Paid Ad Creative Iterator — 7-day perf-threshold webhook → brand-manager-
 * approved variant set deployed to the ad platform as a Service.
 *
 * Cascade: fetch-current-creative-perf-and-audience-engagement-signals (Code, fan-in)
 *        → synthesize-which-creative-axes-to-iterate (Generative)
 *        → emit-n-new-variants-per-axis (Generative)
 *        → brand-manager-review-for-brand-safety (Human, regulatory rationale)
 *        → deploy-to-ad-platform (Code, fan-out).
 */
export const paidAdCreativeIterator: ServiceInstance<AdPerfTriggerInput, AdVariantSetOutput> =
  Service.define<AdPerfTriggerInput, AdVariantSetOutput>({
    name: 'Paid Ad Creative Iterator',
    promise:
      'Every in-flight ad campaign hitting the 7-day perf threshold gets a brand-manager-approved variant set deployed to the ad platform within hours — and the Service only earns when ad-spend-attributed conversions realise.',
    audience: 'business',
    archetype: 'content-generation',
    schema: { input: AdPerfTriggerInputSchema, output: AdVariantSetOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-current-creative-perf-and-audience-engagement-signals',
          reward: kr_perfSignalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-which-creative-axes-to-iterate',
          reward: kr_axisIdentification,
        }),
        Generative({
          name: 'emit-n-new-variants-per-axis',
          reward: kr_variantDistinctiveness,
        }),
        Human({
          name: 'brand-manager-review-for-brand-safety',
          // `regulatory` rationale: paid ad creative needs a brand-safety
          // + claims-compliance review before it deploys to the platform.
          // The gate stays human regardless of model accuracy.
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'deploy-to-ad-platform',
          reward: kr_deployLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'ads.creative-perf',
        'ads.audience-engagement',
        'google-ads.creatives',
        'meta-ads.creatives',
        'linkedin-ads.creatives',
        'tiktok-ads.creatives',
        'brand.voice-guide',
        'brand.safety-policy',
      ],
      // Perf-triggered iteration: clarification disabled — the cascade
      // synthesises from the perf snapshot + engagement signals; the
      // brand-manager review step at the end is the single human contact
      // point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // High-spend campaigns (> $50k/week) escalate the variant
          // generation step to a senior creative-strategist supervisor
          // before the brand-manager review.
          when: 'perfSnapshot.spendCents > 5000000n',
          action: 'escalate',
        },
        {
          // Every variant set routes through brand-manager review-and-
          // approve before it deploys; OutcomeContract enforces the
          // signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'brand-manager-review-for-brand-safety',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:paid-ad-creative-iterator-review',
      personas: [
        // Brand-safety reviewer — pedantic check that every variant complies
        // with the brand safety policy: no prohibited claims, no off-brand
        // imagery briefs, no platform-policy violations.
        Personas.pedantic({
          domain: 'brand-safety',
          rubric: [
            'no-prohibited-claims',
            'no-off-brand-imagery',
            'no-platform-policy-violations',
            'matches-brand-voice-guide',
          ],
          name: 'brand-safety-checker',
        }),
        // Variant-distinctiveness reviewer — adversarially probes whether
        // each variant is meaningfully distinct on its declared axis vs.
        // near-duplicate restatements that won't move the perf needle.
        Personas.skeptic({
          domain: 'variant-distinctiveness',
          focus: ['axis-grounded', 'not-near-duplicate', 'tests-different-hypothesis'],
          name: 'variant-distinctiveness-reviewer',
        }),
        // Audience-fit reviewer — pedantic check that every variant is
        // anchored on the declared audience descriptor + cites engagement
        // signals from the perf snapshot.
        Personas.pedantic({
          domain: 'audience-fit',
          rubric: [
            'matches-audience-descriptor',
            'cites-engagement-signal',
            'no-generic-cta',
            'value-prop-resonates-with-audience',
          ],
          name: 'audience-fit-checker',
        }),
        // Marketing domain reviewer — pulls the senior-paid-media expert
        // for judgment on the overall variant set quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/AdvertisingAndPromotionsManagers',
          name: 'paid-media-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:paid-ad-creative-iterator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-paid-media-lead',
      seller: 'svc:paid-ad-creative-iterator',
      serviceRef: 'svc:paid-ad-creative-iterator',
      // Brand-manager signs every variant set before it deploys —
      // brand-safety + claims-compliance ownership cannot be delegated.
      predicate: AND(
        SchemaMatch(AdVariantSetOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['brand-manager'] })
      ),
      // Variable amount — settled at conversion-realisation time per the
      // percentOf pricing rule below.
      amount: { amount: 0n, currency: 'USD' },
      // 1-day SLA from perf-threshold fire to deployable variant set.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    // 8% of ad-spend-attributed conversions, capped at $50k per account per
    // month. The metering runtime resolves the
    // `ad-spend-attributed-conversions` basis to the post-settlement
    // attributed-conversion-revenue and computes the charge as
    // `(realised_basis * 800) / 10000`, clamped at the $50k cap.
    pricing: Pricing.percentOf({
      basis: 'ad-spend-attributed-conversions',
      rateBasisPoints: 800,
      cap: { amount: 5000000n, currency: 'USD' },
    }),

    refundContract: 'no-charge-if-not-qualified',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 1200n, perApiCall: 10n },
    reward: kr_cpaImprovement,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/paid-ad-creative-iterator',
      icpContextProblemRef: 'icp:paid-ad-creative-iterator:v1',
      foundingHypothesisRef: 'fh:paid-ad-creative-iterator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
