/**
 * Content Localization Orchestrator Service — multi-locale content
 * adaptation for the marketing catalog.
 *
 * Distinguishing shape vs. siblings:
 *   - `content-generation` archetype — the artefact is a localised content
 *     bundle (per-target-locale adaptation of the source piece, with copy +
 *     numerals + cultural-references + RTL-awareness handled), reviewed by
 *     a per-locale reviewer, not a brand audit, campaign brief, or pillar
 *     page;
 *   - 5-step cascade: Code fan-in (fetch source content + target-locale
 *     list + per-locale brand style guides) → Generative (per-locale
 *     adaptation: copy + numerals + cultural references + RTL awareness)
 *     → Generative (market-fit review + sensitivity flags) → Human
 *     (per-locale-reviewer attestation, `trust` rationale — cultural-
 *     context expertise lives in-region) → Code (emit localised bundle +
 *     publish to per-locale targets);
 *   - `Pricing.outcome` 3 tiers (short-copy / medium-asset / long-form)
 *     keyed on artefact length ($99 / $499 / $1,999) — the localised piece
 *     is worth more on a long-form whitepaper than a short social post;
 *   - declarative HITL = mandatory per-locale-reviewer attestation Human
 *     Function (cultural-context expertise cannot be delegated to a model
 *     or to a non-native reviewer); plus OutcomeContract requires per-
 *     locale-reviewer signature with `trust` rationale (the in-region
 *     reviewer is the trust anchor, not a regulator);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(adaptation-fidelity
 *     + cultural-sensitivity + style-guide-adherence) +
 *     HumanSign(per-locale-reviewer))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `localized-content-engagement-vs-source-baseline`
 * — the compound metric every content-localisation org optimises against
 * (the localisation is worth running iff per-locale engagement metrics
 * meet or beat the source-locale baseline within the SLA window).
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
 * Input — a source content piece tagged for localisation. Tight: 7 fields
 * cover the source identity, the source-locale + content-type, the source
 * artefact pointer, the target locale list (each with its own brand style
 * guide ref + assigned reviewer), the artefact-length band so the outcome
 * pricing tier is resolvable at intake, and the publish-targets-per-locale
 * map (so the fan-out Code step knows where each localised piece ships).
 */
export const LocalizationRequestInputSchema = z.object({
  sourcePieceId: z.string(),
  sourceLocale: z.string(), // BCP-47 (e.g. 'en-US')
  contentType: z.enum([
    'social-post',
    'email-campaign',
    'blog-post',
    'landing-page',
    'whitepaper',
    'case-study',
    'product-description',
  ]),
  sourceArtefact: z.object({
    sourceUrl: z.string(),
    bodyMarkdown: z.string(),
    title: z.string(),
  }),
  targetLocales: z
    .array(
      z.object({
        locale: z.string(), // BCP-47
        brandStyleGuideRef: z.string(),
        assignedReviewerRef: z.string(),
      })
    )
    .min(1),
  artefactLengthBand: z.enum(['short-copy', 'medium-asset', 'long-form']),
  publishTargetsPerLocale: z.record(z.string(), z.array(z.string())),
})

/**
 * Output — a per-locale-reviewer-attested localised content bundle: the
 * per-locale adaptation, the per-locale market-fit review + sensitivity
 * flags, the per-locale-reviewer attestation audit, and pointers to the
 * published-per-locale artefacts.
 */
export const LocalizedBundleOutputSchema = z.object({
  sourcePieceId: z.string(),
  perLocaleAdaptations: z
    .array(
      z.object({
        locale: z.string(),
        adaptedTitle: z.string(),
        adaptedBodyMarkdown: z.string(),
        copyAdaptationNotes: z.array(z.string()),
        numeralsAdaptation: z.string(),
        culturalReferencesAdaptation: z.array(z.string()),
        rtlAware: z.boolean(),
      })
    )
    .min(1),
  perLocaleMarketFit: z.array(
    z.object({
      locale: z.string(),
      adaptationFidelityScore: z.number().min(0).max(100),
      culturalSensitivityScore: z.number().min(0).max(100),
      sensitivityFlags: z.array(
        z.object({
          surface: z.enum([
            'idiom',
            'cultural-reference',
            'humour',
            'numeral',
            'date-format',
            'currency',
            'imagery-cue',
            'persona',
          ]),
          severity: z.enum(['low', 'medium', 'high']),
          explanation: z.string(),
        })
      ),
    })
  ),
  perLocaleReview: z
    .array(
      z.object({
        locale: z.string(),
        reviewerRef: z.string(),
        decision: z.enum(['attest-and-publish', 'edit-and-publish', 'park', 'reject']),
        notes: z.string().optional(),
        reviewedAt: z.string(),
      })
    )
    .min(1),
  publishedBundle: z.object({
    perLocalePublishedRefs: z.array(
      z.object({
        locale: z.string(),
        publishedUrls: z.array(z.string()),
        publishedAt: z.string(),
      })
    ),
  }),
  generatedAt: z.string(),
})

export type LocalizationRequestInput = z.infer<typeof LocalizationRequestInputSchema>
export type LocalizedBundleOutput = z.infer<typeof LocalizedBundleOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_localizedEngagement: RewardSignal = {
  keyResultRef:
    'kr:content-localization-orchestrator:localized-content-engagement-vs-source-baseline',
}
const kr_styleGuideCoverage: RewardSignal = {
  keyResultRef: 'kr:content-localization-orchestrator:style-guide-coverage',
}
const kr_adaptationFidelity: RewardSignal = {
  keyResultRef: 'kr:content-localization-orchestrator:adaptation-fidelity',
}
const kr_culturalSensitivity: RewardSignal = {
  keyResultRef: 'kr:content-localization-orchestrator:cultural-sensitivity',
}
const kr_publishLatency: RewardSignal = {
  keyResultRef: 'kr:content-localization-orchestrator:publish-latency',
}

// ============================================================================
// Content Localization Orchestrator Service
// ============================================================================

/**
 * Content Localization Orchestrator — content-piece-tagged-for-localisation
 * webhook → per-locale-reviewer-attested localised bundle published to
 * per-locale targets as a Service.
 *
 * Cascade: fetch-source-content-and-per-locale-style-guides (Code, fan-in)
 *        → per-locale-adaptation-copy-numerals-cultural-references-rtl (Generative)
 *        → market-fit-review-and-sensitivity-flags (Generative)
 *        → per-locale-reviewer-attestation (Human, trust rationale)
 *        → emit-localized-bundle-and-publish-targets (Code, fan-out).
 */
export const contentLocalizationOrchestrator: ServiceInstance<
  LocalizationRequestInput,
  LocalizedBundleOutput
> = Service.define<LocalizationRequestInput, LocalizedBundleOutput>({
  name: 'Content Localization Orchestrator',
  promise:
    'Every content piece tagged for localisation becomes a per-locale-reviewer-attested localised bundle — copy + numerals + cultural references + RTL awareness — published to per-locale targets within days, not weeks.',
  audience: 'business',
  archetype: 'content-generation',
  schema: { input: LocalizationRequestInputSchema, output: LocalizedBundleOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-source-content-and-per-locale-style-guides',
        reward: kr_styleGuideCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'per-locale-adaptation-copy-numerals-cultural-references-rtl',
        reward: kr_adaptationFidelity,
      }),
      Generative({
        name: 'market-fit-review-and-sensitivity-flags',
        reward: kr_culturalSensitivity,
      }),
      Human({
        name: 'per-locale-reviewer-attestation',
        // `trust` rationale: cultural-context expertise lives in-region —
        // the in-region reviewer is the trust anchor, not a regulator.
        // The gate stays human regardless of model accuracy.
        rationale: 'trust',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-localized-bundle-and-publish-targets',
        reward: kr_publishLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'cms.source-content',
      'brand.style-guide-per-locale',
      'localization.glossary',
      'localization.tm',
      'cms.publish-targets',
      'i18n.locale-formatters',
      'gmail.send',
    ],
    // Localisation: clarification disabled — the cascade synthesises from
    // the source content + per-locale style guides; the per-locale-
    // reviewer attestation step at the end is the single human contact
    // point per locale.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Long-form artefacts (whitepaper, case-study) escalate the
        // adaptation step to a senior cultural-strategist supervisor
        // before the per-locale-reviewer attestation runs.
        when: 'artefactLengthBand == "long-form"',
        action: 'escalate',
      },
      {
        // Every localised bundle routes through per-locale-reviewer
        // attestation before publish; OutcomeContract enforces the
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'per-locale-reviewer-attestation',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:content-localization-orchestrator-review',
    personas: [
      // Localisation-readiness reviewer — pedantic audit across all seven
      // localisation surfaces (prose / numerals / date-time / currency /
      // RTL / plurals / cultural-references) for every per-locale
      // adaptation in the bundle. The default (universal baseline) lets
      // the persona flag any hard-coded locale assumption regardless of
      // target.
      Personas.localizationReady({
        name: 'localization-readiness-reviewer',
      }),
      // Brand-safety reviewer — `toneRange: 'formal'` aligns with the
      // localisation Service's default tone register (most localisation
      // requests are documentation / marketing collateral that must
      // preserve a formal-respectful tone in target locales). Catches
      // off-brand drift introduced during adaptation.
      Personas.brandSafety({
        toneRange: 'formal',
        name: 'brand-safety-reviewer',
      }),
      // Factual-accuracy reviewer — every load-bearing claim in the
      // localised piece must carry at least one citation; localisation
      // shouldn't introduce unsourced claims that weren't in the source.
      Personas.factualAccuracy({
        minCitationsPerClaim: 1,
        name: 'factual-accuracy-reviewer',
      }),
      // Marketing domain reviewer — pulls the senior-localisation expert
      // for judgment on the overall localised-bundle quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/MarketingManagers',
        name: 'localization-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:content-localization-orchestrator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-content-lead',
    seller: 'svc:content-localization-orchestrator',
    serviceRef: 'svc:content-localization-orchestrator',
    // Per-locale-reviewer signs every localised bundle before publish —
    // cultural-context expertise cannot be delegated to a model or to a
    // non-native reviewer.
    predicate: AND(
      SchemaMatch(LocalizedBundleOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['per-locale-reviewer'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 49900n, currency: 'USD' },
    // 5-day SLA — localisation should land in the per-locale-reviewer
    // inbox within a working week per locale.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'short-copy',
        amount: 9900n,
        currency: 'USD',
        description: 'Short-copy localisation (social posts, ad copy) — $99 per locale.',
      },
      {
        id: 'medium-asset',
        amount: 49900n,
        currency: 'USD',
        description: 'Medium-asset localisation (email, blog, landing page) — $499 per locale.',
      },
      {
        id: 'long-form',
        amount: 199900n,
        currency: 'USD',
        description: 'Long-form localisation (whitepaper, case study) — $1,999 per locale.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 3500n, perApiCall: 10n },
  reward: kr_localizedEngagement,

  lineage: {
    cellRef: 'business.org.ai/cells/marketing-managers/content-localization-orchestrator',
    icpContextProblemRef: 'icp:content-localization-orchestrator:v1',
    foundingHypothesisRef: 'fh:content-localization-orchestrator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
