/**
 * Email Nurture Sequencer Service — multi-touch email nurture authoring +
 * sequencing for the marketing catalog.
 *
 * Distinguishing shape vs. siblings (`campaign-brief-generator`,
 * `seo-content-pillar-author`, `paid-ad-creative-iterator`,
 * `brand-voice-monitor`, `content-localization-orchestrator`,
 * `campaign-attribution-auditor`, `competitor-positioning-monitor`,
 * `webinar-funnel-orchestrator`):
 *   - `content-generation` archetype — the artefact is a content-marketer-
 *     approved email nurture sequence (5–12 touches with cadence + objective
 *     per touch, each touch with subject + preview + body + CTA + A/B
 *     alternates), staged into the ESP, not a brief, audit, ad-creative,
 *     localised bundle, positioning report, or webinar funnel;
 *   - 5-step cascade: Code fan-in (fetch lead segment + product context +
 *     prior touchpoints + brand voice) → Generative (synthesize nurture
 *     arc: 5–12 touches with cadence + objective per touch) → Generative
 *     (draft each email: subject + preview + body + CTA + A/B alternates)
 *     → Human (content-marketer review-and-approve, `approval` rationale —
 *     the content-marketer owns the conversion-narrative accountability)
 *     → Code (emit sequence config + ESP staging);
 *   - `Pricing.outcome` 3 tiers (short-sequence / standard /
 *     multi-segment-or-localized) keyed on sequence scope ($499 / $1,999
 *     / $5,999) — the nurture is worth more on a multi-segment cross-
 *     locale arc than a single-segment 5-touch arc;
 *   - declarative HITL = mandatory content-marketer review-and-approve
 *     Human Function (the content-marketer owns the conversion narrative
 *     + brand-voice-on-ESP), plus OutcomeContract requires content-
 *     marketer signature with `approval` rationale (not `regulatory` —
 *     the gate is editorial accountability, not compliance);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(arc-coherence +
 *     tone-consistency + cta-precision) + HumanSign(content-marketer))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `nurture-conversion-rate-vs-baseline` — the
 * compound metric every lifecycle-marketing org optimises against (the
 * nurture is worth running iff segment-level conversion rate climbs vs.
 * the pre-Service baseline within the SLA window).
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
 * Input — a lead segment + nurture goal declaration. Tight: 8 fields cover
 * the sequence identity, the lead-segment descriptor, the nurture goal, the
 * product-context pointer, prior-touchpoint refs (so the new arc doesn't
 * collide with already-shipped sends), the brand-voice ref, the
 * sequence-scope band so the outcome pricing tier is resolvable at intake,
 * and the assigned content-marketer (so the Human review step routes to the
 * right inbox).
 */
export const NurtureBriefInputSchema = z.object({
  sequenceId: z.string(),
  leadSegment: z.object({
    segmentId: z.string(),
    segmentDescriptor: z.string(),
    estimatedAudienceSize: z.number().int().nonnegative(),
  }),
  nurtureGoal: z.enum([
    'trial-to-paid',
    'dormant-reactivation',
    'lead-to-MQL',
    'MQL-to-SQL',
    'cross-sell',
    'expansion',
    'win-back',
  ]),
  productContextRef: z.string(),
  priorTouchpointRefs: z.array(z.string()),
  brandVoiceRef: z.string(),
  sequenceScopeBand: z.enum(['short-sequence', 'standard', 'multi-segment-or-localized']),
  assignedContentMarketerRef: z.string(),
})

/**
 * Output — a content-marketer-approved nurture sequence: the synthesized
 * nurture arc, the per-touch drafted email (subject + preview + body + CTA +
 * A/B alternates), the content-marketer review audit, and pointers to the
 * ESP-staged sequence config.
 */
export const NurtureSequenceOutputSchema = z.object({
  sequenceId: z.string(),
  nurtureArc: z.object({
    arcThesis: z.string(),
    touches: z
      .array(
        z.object({
          touchIndex: z.number().int().min(1),
          objective: z.string(),
          cadenceDays: z.number().int().nonnegative(),
          channel: z.literal('email'),
        })
      )
      .min(5)
      .max(12),
  }),
  draftedEmails: z
    .array(
      z.object({
        touchIndex: z.number().int().min(1),
        subject: z.string(),
        preview: z.string(),
        bodyMarkdown: z.string(),
        cta: z.object({
          label: z.string(),
          targetUrl: z.string(),
        }),
        abAlternates: z
          .array(
            z.object({
              variantId: z.string(),
              subject: z.string(),
              preview: z.string().optional(),
              bodyMarkdown: z.string().optional(),
              cta: z
                .object({
                  label: z.string(),
                  targetUrl: z.string(),
                })
                .optional(),
            })
          )
          .min(1),
      })
    )
    .min(5)
    .max(12),
  contentMarketerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-stage', 'edit-and-stage', 'park', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  espStaging: z.object({
    espVendor: z.string(),
    sequenceConfigUrl: z.string(),
    stagedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type NurtureBriefInput = z.infer<typeof NurtureBriefInputSchema>
export type NurtureSequenceOutput = z.infer<typeof NurtureSequenceOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_nurtureConversion: RewardSignal = {
  keyResultRef: 'kr:email-nurture-sequencer:nurture-conversion-rate-vs-baseline',
}
const kr_segmentContextCoverage: RewardSignal = {
  keyResultRef: 'kr:email-nurture-sequencer:segment-context-coverage',
}
const kr_arcCoherence: RewardSignal = {
  keyResultRef: 'kr:email-nurture-sequencer:arc-coherence',
}
const kr_emailDraftQuality: RewardSignal = {
  keyResultRef: 'kr:email-nurture-sequencer:email-draft-quality',
}
const kr_stagingLatency: RewardSignal = {
  keyResultRef: 'kr:email-nurture-sequencer:staging-latency',
}

// ============================================================================
// Email Nurture Sequencer Service
// ============================================================================

/**
 * Email Nurture Sequencer — lead segment + nurture goal declaration →
 * content-marketer-approved multi-touch email nurture sequence staged into
 * the ESP as a Service.
 *
 * Cascade: fetch-segment-product-context-prior-touchpoints-and-brand-voice (Code, fan-in)
 *        → synthesize-nurture-arc-with-cadence-and-per-touch-objective (Generative)
 *        → draft-each-email-subject-preview-body-cta-and-ab-alternates (Generative)
 *        → content-marketer-review-and-approve (Human, approval rationale)
 *        → emit-sequence-config-and-esp-staging (Code, fan-out).
 */
export const emailNurtureSequencer: ServiceInstance<NurtureBriefInput, NurtureSequenceOutput> =
  Service.define<NurtureBriefInput, NurtureSequenceOutput>({
    name: 'Email Nurture Sequencer',
    promise:
      'Every lead segment + nurture goal becomes a content-marketer-approved 5–12-touch email sequence — subject + preview + body + CTA + A/B alternates per touch — staged into the ESP within days, lifting segment conversion rate vs. baseline.',
    audience: 'business',
    archetype: 'content-generation',
    schema: { input: NurtureBriefInputSchema, output: NurtureSequenceOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-segment-product-context-prior-touchpoints-and-brand-voice',
          reward: kr_segmentContextCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-nurture-arc-with-cadence-and-per-touch-objective',
          reward: kr_arcCoherence,
        }),
        Generative({
          name: 'draft-each-email-subject-preview-body-cta-and-ab-alternates',
          reward: kr_emailDraftQuality,
        }),
        Human({
          name: 'content-marketer-review-and-approve',
          // `approval` rationale: the content-marketer owns the
          // conversion-narrative accountability + brand-voice-on-ESP.
          // The gate stays human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-sequence-config-and-esp-staging',
          reward: kr_stagingLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'crm.lead-segments',
        'product.context-store',
        'esp.touchpoint-history',
        'brand.style-guide',
        'esp.sequence-config',
        'esp.staging-environment',
        'gmail.send',
      ],
      // Nurture authoring: clarification disabled — the cascade synthesises
      // from the segment + product-context + prior touchpoints; the
      // content-marketer review step at the end is the single human contact
      // point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Multi-segment / localised sequences escalate the arc-synthesis
          // step to a senior lifecycle-strategist supervisor before the
          // content-marketer review runs.
          when: 'sequenceScopeBand == "multi-segment-or-localized"',
          action: 'escalate',
        },
        {
          // Every sequence routes through content-marketer review before
          // ESP staging; OutcomeContract enforces the signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'content-marketer-review-and-approve',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:email-nurture-sequencer-review',
      personas: [
        // Empathy reviewer — patient/customer-facing nurture copy must land
        // on a reassuring sentiment register without sliding into corporate
        // jargon or condescension. `audienceType: 'customer'` calibrates the
        // prompt to consumer/customer-grade compassion.
        Personas.empathy({
          audienceType: 'customer',
          sentimentTarget: 'reassuring',
          name: 'empathy-and-tone-reviewer',
        }),
        // Brand-safety reviewer — `riskTolerance: 'medium'` — nurture copy
        // can flex with the product/audience but must not introduce
        // off-brand drift across a 5–12-touch arc.
        Personas.brandSafety({
          riskTolerance: 'medium',
          name: 'brand-safety-reviewer',
        }),
        // Handoff-readiness reviewer — the ESP staging artefact has to be
        // pickup-ready by the lifecycle ops team without a back-and-forth.
        // `contextDensity: 'standard'` aligns with the staged-sequence
        // artefact density.
        Personas.handoffReadiness({
          contextDensity: 'standard',
          name: 'handoff-readiness-reviewer',
        }),
        // Marketing domain reviewer — pulls the senior-lifecycle-strategist
        // expert for judgment on the overall nurture-arc + per-touch quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/MarketingManagers',
          name: 'lifecycle-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:email-nurture-sequencer:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-content-marketer',
      seller: 'svc:email-nurture-sequencer',
      serviceRef: 'svc:email-nurture-sequencer',
      // Content-marketer signs every sequence before ESP staging — the
      // conversion-narrative accountability cannot be delegated.
      predicate: AND(
        SchemaMatch(NurtureSequenceOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['content-marketer'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 199900n, currency: 'USD' },
      // 5-day SLA — nurture authoring should land in the content-marketer
      // inbox within a working week.
      timeoutDays: 5,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'short-sequence',
          amount: 49900n,
          currency: 'USD',
          description: 'Short sequence (5–6 touches, single segment) — $499.',
        },
        {
          id: 'standard',
          amount: 199900n,
          currency: 'USD',
          description: 'Standard sequence (7–9 touches, single segment, A/B alternates) — $1,999.',
        },
        {
          id: 'multi-segment-or-localized',
          amount: 599900n,
          currency: 'USD',
          description:
            'Multi-segment or localised sequence (10–12 touches, multi-segment or cross-locale) — $5,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 4000n, perApiCall: 11n },
    reward: kr_nurtureConversion,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/email-nurture-sequencer',
      icpContextProblemRef: 'icp:email-nurture-sequencer:v1',
      foundingHypothesisRef: 'fh:email-nurture-sequencer:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
