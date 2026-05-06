/**
 * IP Disclosure Triage Service — invention-disclosure-form review for the
 * legal catalog.
 *
 * Distinguishing shape vs. siblings (`contract-reviewer`,
 * `policy-impact-analyzer`):
 *   - `multi-step-research` archetype — the artefact is an IP-counsel-signed
 *     triage memo with novelty / non-obviousness analysis and a protect-as-
 *     patent / hold-as-trade-secret / publish-defensively recommendation,
 *     not an in-document redline or a forward-looking jurisdictional impact
 *     memo;
 *   - 5-step cascade: Code fan-in (fetch disclosure + prior-art search from
 *     internal portfolio) → Generative (novelty + non-obviousness analysis)
 *     → Generative (draft protection recommendation) → Human (IP-counsel
 *     review) → Code (emit triage memo + queue action);
 *   - `Pricing.subscription` — a recurring IP-team subscription
 *     ($1,999/mo) plus metered overage at $499 per disclosure reviewed
 *     above the implicit bundled cadence (one disclosure per week is a
 *     common shape for an active IP-active engineering org);
 *   - declarative HITL = mandatory IP-counsel approval Human Function
 *     (the IP-counsel owns protection-strategy authority — file-patent /
 *     trade-secret / publish recommendations carry strategic IP-portfolio
 *     consequences that require specialised expertise — the rationale is
 *     `premium`, not `regulatory`), plus OutcomeContract requires IP-counsel
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(prior-art-thoroughness +
 *     recommendation-rationale + IP-domain-expert) + HumanSign(IP-counsel))`.
 *
 * Per design v3 §3 (Catalog HOW legal) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory with metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `time-to-protection-decision-improvement` — the
 * compound metric every in-house IP team optimises against (the triage is
 * worth running iff time-from-disclosure-submitted-to-protection-decision
 * drops vs. the pre-Service baseline, holding decision-quality flat or
 * improving).
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
 * Input — an invention disclosure form submitted by an engineer (or an
 * engineer-team) to the legal+IP intake channel. Tight: 7 fields cover the
 * disclosure identity, the inventor roster, the disclosure title + abstract,
 * the disclosure-detail document pointer the cascade fans-in against, the
 * declared disclosure-area (so prior-art search scopes to the right portfolio
 * slice), the public-disclosure clock (any prior public discussion that
 * affects patentability), and the assigned IP-counsel reviewer.
 */
export const DisclosureIntakeInputSchema = z.object({
  disclosureId: z.string(),
  inventors: z
    .array(
      z.object({
        engineerRef: z.string(),
        contributionDescription: z.string(),
      })
    )
    .min(1),
  title: z.string(),
  abstract: z.string(),
  disclosureDocument: z.object({
    documentUrl: z.string(),
    documentSha256: z.string(),
    pageCount: z.number().int().positive(),
  }),
  disclosureArea: z.enum([
    'algorithm',
    'data-processing',
    'ml-model',
    'system-architecture',
    'ui-ux',
    'hardware-integration',
    'protocol',
    'other',
  ]),
  publicDisclosureClock: z.object({
    hasPriorPublicDiscussion: z.boolean(),
    earliestPublicDateIso: z.string().optional(),
    publicForumNotes: z.string().optional(),
  }),
  assignedIpCounselRef: z.string(),
})

/**
 * Output — an IP-counsel-signed triage memo: the disclosure snapshot +
 * prior-art slice, the novelty + non-obviousness analysis, the drafted
 * protection recommendation, the IP-counsel review audit, and pointers to
 * the emitted triage memo + queued-action artefacts.
 */
export const DisclosureTriageOutputSchema = z.object({
  disclosureId: z.string(),
  disclosureSnapshot: z.object({
    title: z.string(),
    inventorCount: z.number().int().positive(),
    documentSha256: z.string(),
  }),
  priorArtSlice: z
    .array(
      z.object({
        priorArtId: z.string(),
        kind: z.enum(['internal-patent', 'internal-disclosure', 'external-patent', 'publication']),
        ref: z.string(),
        relevanceScore: z.number().min(0).max(1),
        relevanceRationale: z.string(),
      })
    )
    .min(0),
  noveltyAnalysis: z.object({
    summaryMarkdown: z.string(),
    distinguishingFeatures: z.array(z.string()).min(0),
    overlappingPriorArtIds: z.array(z.string()),
    noveltyScore: z.enum(['low', 'med', 'high']),
  }),
  nonObviousnessAnalysis: z.object({
    summaryMarkdown: z.string(),
    teachingsAwayFromCombination: z.array(z.string()).min(0),
    secondaryConsiderations: z.array(z.string()).min(0),
    nonObviousnessScore: z.enum(['low', 'med', 'high']),
  }),
  protectionRecommendation: z.object({
    recommendedAction: z.enum([
      'file-patent',
      'hold-as-trade-secret',
      'publish-defensively',
      'park-for-now',
    ]),
    rationaleMarkdown: z.string(),
    estimatedFilingCostCents: z.bigint().optional(),
    estimatedTimeToFileDays: z.number().int().nonnegative().optional(),
  }),
  ipCounselReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  artefacts: z.object({
    triageMemoUrl: z.string(),
    queuedActionRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DisclosureIntakeInput = z.infer<typeof DisclosureIntakeInputSchema>
export type DisclosureTriageOutput = z.infer<typeof DisclosureTriageOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToProtectionDecision: RewardSignal = {
  keyResultRef: 'kr:ip-disclosure-triage:time-to-protection-decision-improvement',
}
const kr_priorArtCoverage: RewardSignal = {
  keyResultRef: 'kr:ip-disclosure-triage:prior-art-coverage',
}
const kr_noveltyAnalysisQuality: RewardSignal = {
  keyResultRef: 'kr:ip-disclosure-triage:novelty-analysis-quality',
}
const kr_recommendationRationale: RewardSignal = {
  keyResultRef: 'kr:ip-disclosure-triage:recommendation-rationale',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:ip-disclosure-triage:emit-latency',
}

// ============================================================================
// IP Disclosure Triage Service
// ============================================================================

/**
 * IP Disclosure Triage — engineer submits invention-disclosure form →
 * IP-counsel-signed triage memo with novelty / non-obviousness analysis and
 * a protection-strategy recommendation as a Service.
 *
 * Cascade: fetch-disclosure-and-prior-art-search-from-internal-portfolio (Code, fan-in)
 *        → novelty-and-non-obviousness-analysis (Generative)
 *        → draft-protection-recommendation (Generative)
 *        → ip-counsel-review (Human, premium rationale)
 *        → emit-triage-memo-and-queue-action (Code, fan-out).
 */
export const ipDisclosureTriage: ServiceInstance<DisclosureIntakeInput, DisclosureTriageOutput> =
  Service.define<DisclosureIntakeInput, DisclosureTriageOutput>({
    name: 'IP Disclosure Triage',
    promise:
      'Every invention disclosure submitted by engineering gets an IP-counsel-signed triage memo within the week — prior-art slice + novelty / non-obviousness analysis + file-patent vs. trade-secret vs. publish recommendation — so the protection-decision queue is bounded by IP-counsel sign-off, not the prior-art research backlog.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: DisclosureIntakeInputSchema, output: DisclosureTriageOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-disclosure-and-prior-art-search-from-internal-portfolio',
          reward: kr_priorArtCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'novelty-and-non-obviousness-analysis',
          reward: kr_noveltyAnalysisQuality,
        }),
        Generative({
          name: 'draft-protection-recommendation',
          reward: kr_recommendationRationale,
        }),
        Human({
          name: 'ip-counsel-review',
          // `premium` rationale: protection-strategy authority sits with the
          // IP-counsel — file-patent vs. trade-secret vs. publish-defensively
          // decisions carry strategic IP-portfolio consequences that require
          // specialised IP-counsel expertise (claim-drafting strategy,
          // continuation-strategy implications, secrecy-vs-disclosure
          // tradeoffs). The gate stays human regardless of model accuracy.
          rationale: 'premium',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-triage-memo-and-queue-action',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'disclosure-intake.read',
        'ip-portfolio.read',
        'patent-search.query',
        'publication-search.query',
        'memo-engine.write',
        'action-queue.write',
        'docs.write',
      ],
      // Disclosure triage: clarification disabled — the cascade synthesises
      // from the disclosure document + prior-art slice; the IP-counsel
      // review step is the single human contact point in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Disclosures with an active public-disclosure clock (engineer
          // already gave a conference talk, posted on a public forum, etc)
          // escalate the prior-art + novelty analysis to a senior IP-counsel
          // supervisor before the routine IP-counsel review (the IP-counsel
          // still signs, but the supervisor backstops the synthesis on the
          // highest-stakes priority — the absolute-novelty clock is ticking).
          when: 'publicDisclosureClock.hasPriorPublicDiscussion == true',
          action: 'escalate',
        },
        {
          // Every disclosure routes through IP-counsel review before the
          // triage memo emits and the action queues; OutcomeContract enforces
          // the signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'ip-counsel-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:ip-disclosure-triage-review',
      personas: [
        // Prior-art-thoroughness reviewer — pedantic check that the
        // prior-art slice covered the internal portfolio comprehensively
        // (every relevant patent + disclosure surfaced), the external
        // patent-search ran the right query, and no obviously-overlapping
        // prior art was silently skipped. The risk this guards against is
        // "missed prior art" — the most common failure mode for an
        // automated novelty analysis.
        Personas.pedantic({
          domain: 'prior-art-thoroughness',
          rubric: [
            'internal-portfolio-search-comprehensive',
            'external-patent-search-query-cited',
            'every-overlapping-prior-art-surfaced',
            'no-silent-prior-art-omissions',
            'relevance-scores-justified',
          ],
          name: 'prior-art-thoroughness-checker',
        }),
        // Recommendation-rationale reviewer — adversarially probes whether
        // the recommended-action rationale is concrete (cites the
        // distinguishing features, names the secrecy-vs-disclosure tradeoff,
        // names the estimated filing cost + timeline) vs. surface-level
        // "this looks novel, file a patent" hand-waving.
        Personas.skeptic({
          domain: 'recommendation-rationale',
          focus: [
            'cites-distinguishing-features',
            'names-secrecy-vs-disclosure-tradeoff',
            'cites-prior-art-context',
            'estimated-cost-and-timeline-justified',
            'no-hand-waves',
          ],
          name: 'recommendation-rationale-reviewer',
        }),
        // IP domain reviewer — pulls the senior IP-counsel expert for
        // judgment on the overall triage-memo quality (the IP-domain
        // discriminator is the load-bearing one for protection-strategy
        // recommendations).
        Personas.domain({
          expertRef: 'occupations.org.ai/Lawyers',
          name: 'ip-counsel-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:ip-disclosure-triage:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-ip-counsel',
      seller: 'svc:ip-disclosure-triage',
      serviceRef: 'svc:ip-disclosure-triage',
      // IP-counsel signs every triage memo before the protection-strategy
      // action queues — protection-strategy authority cannot be delegated.
      predicate: AND(
        SchemaMatch(DisclosureTriageOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['ip-counsel'] })
      ),
      amount: { amount: 49900n, currency: 'USD' },
      // 7-day SLA — disclosure-triage runs on weekly rhythms; the triage
      // memo lands inside one rotation so the absolute-novelty clock
      // (where applicable) doesn't expire on the queue.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'ip-disclosure-triage-monthly',
        amount: 199900n,
        currency: 'USD',
        interval: 'month',
      },
      // Metered overage — disclosures reviewed beyond the implicit bundled
      // cadence charge $499 each. The metering runtime resolves
      // `disclosure-reviewed` to invocations beyond the monthly baseline
      // and lines them on the monthly invoice.
      metered: [
        {
          event: 'disclosure-reviewed',
          amount: 49900n,
          description:
            'Disclosure reviewed beyond the bundled IP-team subscription cadence baseline.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 9000n, perApiCall: 16n },
    reward: kr_timeToProtectionDecision,

    lineage: {
      cellRef: 'business.org.ai/cells/intellectual-property-counsel/ip-disclosure-triage',
      icpContextProblemRef: 'icp:ip-disclosure-triage:v1',
      foundingHypothesisRef: 'fh:ip-disclosure-triage:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
