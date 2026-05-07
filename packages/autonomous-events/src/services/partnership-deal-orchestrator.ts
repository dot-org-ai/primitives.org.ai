/**
 * Partnership Deal Orchestrator Service — partnership opportunity → signed-
 * deal coordination Service for the events catalog.
 *
 * Distinguishing shape vs. siblings (`event-program-curator`,
 * `event-attendee-engagement-monitor`):
 *   - `multi-step-research` archetype — the artefact is a BD-lead-signed
 *     partnership package (thesis + value-exchange options + structure
 *     recommendations + supervised-researched partner-org context + pitch
 *     deck + term-sheet options + comms plan + tracker), not a program-
 *     curation document or a real-time engagement dashboard;
 *   - 6-step cascade: Code fan-in (partner-profile + strategic-fit-criteria
 *     + prior-partnerships) → Generative (synthesize-partnership-thesis +
 *     value-exchange-options + structure-recommendations) → Agentic,
 *     supervised (research-of-partner-org + key-stakeholders +
 *     recent-product-news) → Generative (draft-partnership-deck +
 *     term-sheet-options + comms-plan) → Human (BD-lead + GC + CFO review)
 *     → Code (emit-partnership-package + tracker);
 *   - `Pricing.outcome` 3 tiers keyed on partnership depth — tactical /
 *     strategic / platform-or-OEM ($1,999 / $9,999 / $49,999) — the package
 *     is worth more on a platform-or-OEM partnership than on a tactical
 *     co-marketing handshake;
 *   - declarative HITL = mandatory BD-lead + GC + CFO review Human Function
 *     (the BD-lead owns partnership-deal authority; GC + CFO sign for
 *     legal + financial regulatory review), plus OutcomeContract requires
 *     BD-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(strategic-fit-
 *     soundness + value-exchange-clarity + risk-coverage) + HumanSign(BD-
 *     lead))`.
 *
 * Per design v3 §3 (Catalog HOW partnerships) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome tiered pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `signed-partnership-rate-and-cycle-time-improvement`
 * — the compound metric every BD-team org optimises against (the
 * orchestrator is worth running iff signed-partnership-rate AND
 * inquiry-to-signed cycle time both beat the pre-Service baseline at parity
 * partnership depth).
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
 * Input — a partnership opportunity (inbound inquiry OR strategic-target
 * outbound). Tight: 9 fields cover the opportunity identity, the trigger
 * source (so the cascade calibrates outbound vs. inbound posture), the
 * partnership depth (so the outcome tier resolves at intake), the partner-
 * org reference, the inbound-inquiry payload (when applicable), the
 * strategic-fit criteria, the prior-partnerships reference, and the
 * BD-lead + GC + CFO routing targets.
 */
export const PartnershipDealInputSchema = z.object({
  opportunityId: z.string(),
  triggerSource: z.enum(['inbound-inquiry', 'strategic-target-outbound']),
  partnershipDepth: z.enum(['tactical', 'strategic', 'platform-or-OEM']),
  partnerOrg: z.object({
    orgRef: z.string(),
    legalName: z.string(),
    industry: z.string(),
    websiteUrl: z.string().optional(),
    primaryContactRef: z.string().optional(),
  }),
  inboundInquiryPayload: z
    .object({
      receivedAt: z.string(), // ISO-8601
      channel: z.enum(['email', 'web-form', 'event', 'intro', 'referral']),
      summary: z.string(),
    })
    .optional(),
  strategicFitCriteria: z
    .array(
      z.object({
        criterionId: z.string(),
        label: z.string(),
        weight: z.number().min(0).max(1),
      })
    )
    .min(1),
  priorPartnershipsRef: z.string().optional(),
  bdLeadRef: z.string(),
  gcRef: z.string(),
  cfoRef: z.string(),
})

/**
 * Output — a BD-lead + GC + CFO-signed partnership package: the synthesised
 * partnership thesis + value-exchange options + structure recommendations,
 * the supervised partner-org research dossier, the drafted partnership deck
 * + term-sheet options + comms plan, the BD-lead + GC + CFO review audit,
 * and pointers to the emitted partnership-package + tracker artefacts.
 */
export const PartnershipDealOutputSchema = z.object({
  opportunityId: z.string(),
  partnershipThesis: z.object({
    summary: z.string(),
    strategicFitScore: z.number().min(0).max(1),
    perCriterionScores: z
      .array(
        z.object({
          criterionId: z.string(),
          score: z.number().min(0).max(1),
          rationale: z.string(),
        })
      )
      .min(1),
    citations: z
      .array(
        z.object({
          sourceType: z.enum(['first-party', 'industry-standard']),
          ref: z.string(),
        })
      )
      .min(1),
  }),
  valueExchangeOptions: z
    .array(
      z.object({
        optionId: z.string(),
        label: z.string(),
        ourValue: z.string(),
        theirValue: z.string(),
        residualRiskNote: z.string(),
      })
    )
    .min(1),
  structureRecommendations: z
    .array(
      z.object({
        recommendationId: z.string(),
        structure: z.enum([
          'co-marketing',
          'reseller',
          'integration',
          'OEM',
          'platform',
          'JV',
          'investment',
        ]),
        rationale: z.string(),
        riskCoverage: z.array(z.string()).min(1),
      })
    )
    .min(1),
  partnerOrgResearch: z.object({
    keyStakeholders: z
      .array(
        z.object({
          stakeholderRef: z.string(),
          role: z.string(),
          relevanceNote: z.string(),
        })
      )
      .min(1),
    recentProductNews: z
      .array(
        z.object({
          publishedAt: z.string(),
          source: z.string(),
          headline: z.string(),
          relevanceNote: z.string(),
        })
      )
      .default([]),
    sourcedAt: z.string(),
  }),
  partnershipDeck: z.object({
    deckUrl: z.string(),
    sectionTitles: z.array(z.string()).min(1),
  }),
  termSheetOptions: z
    .array(
      z.object({
        termSheetId: z.string(),
        recommendedStructureId: z.string(),
        keyTerms: z.array(z.string()).min(1),
        commercials: z.string(),
      })
    )
    .min(1),
  commsPlan: z.object({
    cadence: z.string(),
    perChannelDrafts: z
      .array(
        z.object({
          channel: z.enum(['email', 'in-person', 'video-call', 'press']),
          audience: z.enum(['partner-leadership', 'partner-bd', 'internal', 'public']),
          draft: z.string(),
        })
      )
      .min(1),
  }),
  bdLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-emit', 'edit-and-emit', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  gcReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-emit', 'edit-and-emit', 'request-revision', 'reject']),
    legalRiskNotes: z.array(z.string()).default([]),
    reviewedAt: z.string(),
  }),
  cfoReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-emit', 'edit-and-emit', 'request-revision', 'reject']),
    financialRiskNotes: z.array(z.string()).default([]),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    partnershipPackageRef: z.string(),
    trackerRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PartnershipDealInput = z.infer<typeof PartnershipDealInputSchema>
export type PartnershipDealOutput = z.infer<typeof PartnershipDealOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_signedPartnershipRateAndCycleTime: RewardSignal = {
  keyResultRef:
    'kr:partnership-deal-orchestrator:signed-partnership-rate-and-cycle-time-improvement',
}
const kr_partnerProfileFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:partnership-deal-orchestrator:partner-profile-fan-in-coverage',
}
const kr_thesisSoundness: RewardSignal = {
  keyResultRef: 'kr:partnership-deal-orchestrator:thesis-soundness',
}
const kr_partnerResearchCoverage: RewardSignal = {
  keyResultRef: 'kr:partnership-deal-orchestrator:partner-research-coverage',
}
const kr_packageQuality: RewardSignal = {
  keyResultRef: 'kr:partnership-deal-orchestrator:package-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:partnership-deal-orchestrator:emit-latency',
}

// ============================================================================
// Partnership Deal Orchestrator Service
// ============================================================================

/**
 * Partnership Deal Orchestrator — inbound partnership inquiry OR strategic-
 * partnership target identified → BD-lead + GC + CFO-signed partnership
 * package (thesis + value-exchange options + structure recommendations +
 * supervised partner-org research + deck + term-sheet options + comms plan
 * + tracker) as a Service.
 *
 * Cascade: fetch-partner-profile-and-strategic-fit-criteria-and-prior-partnerships (Code, fan-in)
 *        → synthesize-partnership-thesis-and-value-exchange-options-and-structure-recommendations (Generative)
 *        → supervised-research-of-partner-org-and-key-stakeholders-and-recent-product-news (Agentic, supervised)
 *        → draft-partnership-deck-and-term-sheet-options-and-comms-plan (Generative)
 *        → BD-lead-and-GC-and-CFO-review (Human, approval + regulatory rationale)
 *        → emit-partnership-package-and-tracker (Code, fan-out).
 */
export const partnershipDealOrchestrator: ServiceInstance<
  PartnershipDealInput,
  PartnershipDealOutput
> = Service.define<PartnershipDealInput, PartnershipDealOutput>({
  name: 'Partnership Deal Orchestrator',
  promise:
    'Every inbound partnership inquiry and every strategic-partnership target lands as a BD-lead + GC + CFO-signed partnership package — thesis + value-exchange options + structure recommendations + supervised-researched partner-org context + pitch deck + term-sheet options + comms plan + tracker — so partnerships move from "interesting" to "signed" with cycle time measured in weeks instead of quarters.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: PartnershipDealInputSchema, output: PartnershipDealOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-partner-profile-and-strategic-fit-criteria-and-prior-partnerships',
        reward: kr_partnerProfileFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-partnership-thesis-and-value-exchange-options-and-structure-recommendations',
        reward: kr_thesisSoundness,
      }),
      Agentic({
        name: 'supervised-research-of-partner-org-and-key-stakeholders-and-recent-product-news',
        // Supervised mode: the agentic loop fans across partner-org research
        // sources (LinkedIn, Crunchbase, press, product blogs, prior
        // partnership history) with a human (BD-lead) backing every load-
        // bearing claim before it commits. The agentic kind is the right
        // shape here because the loop is multi-tool, multi-target, and the
        // research surface evolves as new signals appear.
        mode: 'supervised',
        signOff: 'human',
        reward: kr_partnerResearchCoverage,
      }),
      Generative({
        name: 'draft-partnership-deck-and-term-sheet-options-and-comms-plan',
        reward: kr_packageQuality,
      }),
      Human({
        name: 'BD-lead-and-GC-and-CFO-review',
        // `approval` rationale: BD-lead owns partnership-deal authority and
        // signs every package. GC + CFO co-sign for legal + financial
        // regulatory coverage (term-sheet options carry contractual + revenue-
        // recognition risk). Predicate enforces BD-lead signature; the
        // declarative trigger primes GC + CFO co-sign queues. The gate stays
        // human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-partnership-package-and-tracker',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'crm.read',
      'crm.write',
      'partner-database.read',
      'linkedin.read',
      'crunchbase.read',
      'press-archive.read',
      'product-blog.read',
      'docs.write',
      'slides.render',
      'docusign.draft',
      'gmail.send',
    ],
    // Partnership intake: clarification disabled — the cascade synthesises
    // from the partner-profile + strategic-fit-criteria + supervised
    // partner-org research; the BD-lead + GC + CFO review step at the end
    // is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Platform-or-OEM partnerships escalate the supervised research
        // step to a senior corp-dev supervisor before the BD-lead review
        // (BD-lead still signs, but a senior backstops the synthesis
        // quality on the highest-stakes tier where contractual + go-to-
        // market commitments are most binding).
        when: 'partnershipDepth == "platform-or-OEM"',
        action: 'escalate',
      },
      {
        // Every opportunity routes through BD-lead + GC + CFO review
        // before the partnership package + tracker emit; OutcomeContract
        // enforces the BD-lead signature, the trigger primes the GC + CFO
        // co-sign queue.
        when: 'true',
        action: 'route-to',
        target: 'BD-lead-and-GC-and-CFO-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:partnership-deal-orchestrator-review',
    personas: [
      // Strategic-fit-soundness reviewer — pedantic check that every per-
      // criterion score traces to a non-trivial rationale and that the
      // overall fit-score is consistent with the per-criterion scores
      // (no overall-9 with three 0-rationale criteria).
      Personas.pedantic({
        domain: 'strategic-fit-soundness',
        rubric: [
          'every-per-criterion-score-cites-rationale',
          'overall-fit-score-tracks-per-criterion-scores',
          'rationale-references-strategic-fit-criteria',
          'no-fit-score-without-evidence',
          'partner-research-cited-in-thesis',
        ],
        name: 'strategic-fit-soundness-checker',
      }),
      // Value-exchange-clarity reviewer — pedantic check that every
      // value-exchange option spells out our-value + their-value
      // explicitly with non-empty residual-risk notes (no hand-waving on
      // either side of the exchange).
      Personas.pedantic({
        domain: 'value-exchange-clarity',
        rubric: [
          'every-option-spells-out-our-value',
          'every-option-spells-out-their-value',
          'every-option-has-non-empty-residual-risk-note',
          'options-are-distinct-not-restatements',
          'options-trace-to-structure-recommendations',
        ],
        name: 'value-exchange-clarity-checker',
      }),
      // Risk-coverage reviewer — adversarially probes whether the
      // structure-recommendations adequately surface contractual,
      // financial, and reputational risk surfaces (no "co-marketing"
      // recommendation with empty risk-coverage; OEM recommendations
      // should surface IP + revenue-recognition + exclusivity risks).
      Personas.skeptic({
        domain: 'risk-coverage',
        focus: [
          'every-recommendation-surfaces-contractual-risk',
          'every-recommendation-surfaces-financial-risk',
          'every-recommendation-surfaces-reputational-risk',
          'OEM-and-platform-recommendations-surface-IP-and-exclusivity-risks',
          'risk-coverage-is-specific-not-templated',
        ],
        name: 'risk-coverage-reviewer',
      }),
      // Factual-accuracy reviewer — partner-org research must cite
      // first-party + industry-standard sources only (no scraped-blog
      // hearsay). Citation required = true means every load-bearing
      // claim about the partner org carries an inline citation.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['first-party', 'industry-standard'],
        name: 'factual-accuracy-reviewer',
      }),
      // Commercial-fit reviewer — `audienceForPitch: 'partner'` calibrates
      // the persona to weigh ICP-fit + pricing-realism + competitive-
      // positioning + channel-fit dimensions (the four commercial-fit
      // dimensions a partner counterparty actually weighs when reading
      // an inbound deck).
      Personas.commercialFit({
        audienceForPitch: 'partner',
        name: 'commercial-fit-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:partnership-deal-orchestrator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-bd-lead',
    seller: 'svc:partnership-deal-orchestrator',
    serviceRef: 'svc:partnership-deal-orchestrator',
    // BD-lead signs every partnership package before it emits — partnership-
    // deal authority cannot be delegated. GC + CFO co-sign on the deal
    // routing path but the contractual buyer-side signature is BD-lead's.
    predicate: AND(
      SchemaMatch(PartnershipDealOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['bd-lead'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 999900n, currency: 'USD' },
    // 21-day SLA — partnership work is multi-week; the package lands
    // with the BD-lead + GC + CFO inside three weeks of intake so the
    // deal cycle stays compressed.
    timeoutDays: 21,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'tactical',
        amount: 199900n,
        currency: 'USD',
        description:
          'Tactical partnership — co-marketing or referral handshake, single-quarter scope. Package + tracker delivered in 7 business days. $1,999.',
      },
      {
        id: 'strategic',
        amount: 999900n,
        currency: 'USD',
        description:
          'Strategic partnership — multi-quarter scope, integration / reseller / JV structure, exec sponsorship on both sides. Package + tracker delivered in 14 business days. $9,999.',
      },
      {
        id: 'platform-or-OEM',
        amount: 4999900n,
        currency: 'USD',
        description:
          'Platform or OEM partnership — multi-year scope, IP + exclusivity terms, board-tier visibility. Package + tracker delivered in 21 business days. $49,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 18000n, perApiCall: 26n },
  reward: kr_signedPartnershipRateAndCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/bd-leads/partnership-deal-orchestrator',
    icpContextProblemRef: 'icp:partnership-deal-orchestrator:v1',
    foundingHypothesisRef: 'fh:partnership-deal-orchestrator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
