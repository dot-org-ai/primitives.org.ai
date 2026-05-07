/**
 * Compensation Band Analyst Service — comp-band benchmarking + offer-letter
 * advisor for the people / HR catalog.
 *
 * Distinguishing shape vs. siblings (`hiring-loop-coordinator`,
 * `performance-review-narrator`, `org-design-impact-modeler`):
 *   - `quality-review` archetype — the artefact is a CHRO-or-comp-committee-
 *     signed offer recommendation (position-on-band + parity-checks +
 *     flexibility room + rationale + audit trail), not an interview-loop
 *     schedule, a quarterly review packet, or an org-design impact memo;
 *   - 5-step cascade: Code fan-in (role spec + market data + internal comp
 *     band + candidate-or-employee context) → Generative (synthesise
 *     position-on-band + parity-checks against the current team) →
 *     Generative (draft offer recommendation with rationale + flexibility
 *     room) → Human (CHRO-or-comp-committee review) → Code (emit offer
 *     recommendation + audit trail);
 *   - `Pricing.perInvocation` 3 tiers keyed on the role band — IC / senior-IC
 *     / leadership ($299 / $999 / $4,999) — leadership offers compound
 *     parity / pay-equity downstream so the per-invocation ask is higher;
 *   - declarative HITL = mandatory CHRO-or-comp-committee review Human
 *     Function (the comp authority for offer letters at any band sits with
 *     the CHRO or the comp committee — sign-off cannot be delegated to the
 *     hiring manager because of pay-equity / SOX implications), uses
 *     `'approval'` rationale, plus OutcomeContract requires CHRO signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(market-data-recency
 *     + parity-coverage + flexibility-rationale) + HumanSign(CHRO))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy({ citationRequired:
 *     true, sourceTypes: ['industry-standard', 'first-party'] })` and
 *     `Personas.regulatoryCompliance({ regulator: 'sox' })` because comp-
 *     band claims must be backed by industry-standard salary surveys or
 *     first-party internal-comp-band data, and the audit trail must satisfy
 *     SOX internal-controls requirements for compensation decisions.
 *
 * Per design v3 §3 (Catalog HOW people) + §6 (binding triggers, conditional
 * HumanSign) + §7 (perInvocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `offer-acceptance-rate-and-comp-equity-score` — the
 * compound metric every CHRO / comp-committee optimises against (the analyst
 * is worth running iff offers convert above the baseline acceptance rate
 * AND internal pay-equity scores hold or improve, vs. the pre-Service
 * baseline of recruiter-assembled offers).
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
 * Input — a new offer is being assembled for a candidate, or a quarterly
 * comp-band review fires for an in-band employee. Tight: 8 fields cover the
 * trigger kind, the role identity, the role-band so the perInvocation tier
 * is resolvable at intake, the subject (candidate or employee), the assigned
 * recruiter / people-partner, the target effective date, the geographic
 * market, and the requesting cycle.
 */
export const CompBandTriggerInputSchema = z.object({
  triggerKind: z.enum(['new-offer-assembly', 'quarterly-comp-band-review']),
  roleRef: z.string(),
  roleBand: z.enum(['ic', 'senior-ic', 'leadership']),
  subject: z.object({
    kind: z.enum(['candidate', 'employee']),
    subjectRef: z.string(),
  }),
  assignedPartnerRef: z.string(),
  targetEffectiveDate: z.string(), // ISO-8601
  geoMarket: z.string(),
  cycleId: z.string().optional(),
})

/**
 * Output — a CHRO-or-comp-committee-signed offer recommendation: the
 * synthesised position-on-band, the parity-checks against the current team,
 * the drafted offer recommendation (with rationale + flexibility room), the
 * CHRO / comp-committee review audit, and pointers to the emitted
 * recommendation + audit-trail artefacts.
 */
export const OfferRecommendationOutputSchema = z.object({
  triggerKind: z.enum(['new-offer-assembly', 'quarterly-comp-band-review']),
  roleRef: z.string(),
  subjectRef: z.string(),
  positionOnBand: z.object({
    bandRef: z.string(),
    bandMin: z.number().nonnegative(),
    bandMid: z.number().nonnegative(),
    bandMax: z.number().nonnegative(),
    proposedBase: z.number().nonnegative(),
    proposedEquity: z.number().nonnegative().optional(),
    percentileWithinBand: z.number().min(0).max(100),
    rationale: z.string(),
    citations: z.array(z.string()).min(1),
  }),
  parityChecks: z
    .array(
      z.object({
        peerRef: z.string(),
        peerBase: z.number().nonnegative(),
        deltaPct: z.number(),
        parityVerdict: z.enum(['within-band', 'above-peer', 'below-peer', 'inversion-risk']),
        rationale: z.string(),
      })
    )
    .min(1),
  offerRecommendation: z.object({
    recommendedBase: z.number().nonnegative(),
    recommendedEquity: z.number().nonnegative().optional(),
    recommendedSignOnBonus: z.number().nonnegative().optional(),
    flexibilityRoom: z.object({
      baseFloor: z.number().nonnegative(),
      baseCeiling: z.number().nonnegative(),
      rationale: z.string(),
    }),
    rationaleMarkdown: z.string(),
  }),
  chroReview: z.object({
    reviewerRef: z.string(),
    reviewerRole: z.enum(['chro', 'comp-committee']),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    recommendationUrl: z.string(),
    auditTrailUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type CompBandTriggerInput = z.infer<typeof CompBandTriggerInputSchema>
export type OfferRecommendationOutput = z.infer<typeof OfferRecommendationOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_offerAcceptanceAndCompEquity: RewardSignal = {
  keyResultRef: 'kr:compensation-band-analyst:offer-acceptance-rate-and-comp-equity-score',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:compensation-band-analyst:intake-coverage',
}
const kr_positionAndParityFit: RewardSignal = {
  keyResultRef: 'kr:compensation-band-analyst:position-and-parity-fit',
}
const kr_recommendationQuality: RewardSignal = {
  keyResultRef: 'kr:compensation-band-analyst:recommendation-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:compensation-band-analyst:emit-latency',
}

// ============================================================================
// Compensation Band Analyst Service
// ============================================================================

/**
 * Compensation Band Analyst — new-offer-assembly OR quarterly-comp-band-
 * review trigger → CHRO-or-comp-committee-signed offer recommendation
 * (position-on-band + parity-checks + flexibility room + rationale + audit
 * trail) as a Service.
 *
 * Cascade: fetch-role-spec-market-data-internal-comp-band-and-subject-context (Code, fan-in)
 *        → synthesize-position-on-band-and-parity-checks-against-current-team (Generative)
 *        → draft-offer-recommendation-with-rationale-and-flexibility-room (Generative)
 *        → chro-or-comp-committee-review (Human, approval rationale)
 *        → emit-offer-recommendation-and-audit-trail (Code, fan-out).
 */
export const compensationBandAnalyst: ServiceInstance<
  CompBandTriggerInput,
  OfferRecommendationOutput
> = Service.define<CompBandTriggerInput, OfferRecommendationOutput>({
  name: 'Compensation Band Analyst',
  promise:
    'Every new offer (or quarterly comp-band review) gets a CHRO-or-comp-committee-signed recommendation — position-on-band + parity-checks + flexibility room — grounded in industry-standard market data and SOX-auditable internal comp bands, so offers convert above baseline without breaking pay-equity.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: CompBandTriggerInputSchema, output: OfferRecommendationOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-role-spec-market-data-internal-comp-band-and-subject-context',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-position-on-band-and-parity-checks-against-current-team',
        reward: kr_positionAndParityFit,
      }),
      Generative({
        name: 'draft-offer-recommendation-with-rationale-and-flexibility-room',
        reward: kr_recommendationQuality,
      }),
      Human({
        name: 'chro-or-comp-committee-review',
        // `approval` rationale: comp authority for offer letters sits with
        // the CHRO or comp committee — sign-off cannot be delegated to the
        // hiring manager because of pay-equity / SOX implications.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-offer-recommendation-and-audit-trail',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'ats.candidates',
      'ats.roles',
      'workday.employees',
      'workday.comp-bands',
      'market-data.salary-surveys',
      'market-data.equity-benchmarks',
      'docs.write',
      'audit-trail.write',
    ],
    // Comp-band recommendation: clarification disabled — the cascade
    // synthesises from the role spec + market data + internal comp band +
    // subject context; the CHRO / comp-committee review step is the single
    // human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Leadership-band offers escalate the recommendation synthesis to a
        // senior comp-partner supervisor before the CHRO review step (pay-
        // equity blast radius and SOX-controls scrutiny are highest at
        // leadership comp).
        when: 'roleBand == "leadership"',
        action: 'escalate',
      },
      {
        // Every recommendation routes through CHRO / comp-committee review
        // before the offer emits; OutcomeContract enforces the signature,
        // the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'chro-or-comp-committee-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:compensation-band-analyst-review',
    personas: [
      // Market-data-recency reviewer — fact-grounding persona requiring
      // citations on every load-bearing comp claim, restricted to industry-
      // standard salary surveys and first-party internal-comp-band data.
      // Off-survey or anecdotal comp claims aren't acceptable for an offer
      // letter recommendation.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['industry-standard', 'first-party'],
        name: 'market-data-recency-checker',
      }),
      // SOX-controls reviewer — regulator-tier persona that enforces SOX
      // internal-controls requirements on the audit trail (every comp
      // decision traceable to the policy + the approver + the cited data).
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-controls-reviewer',
      }),
      // Parity-coverage reviewer — pedantic check that every comparable
      // peer in the affected team is named in the parity-checks slice and
      // that no peer is silently omitted (silent omission masks pay-equity
      // gaps).
      Personas.pedantic({
        domain: 'parity-coverage',
        rubric: [
          'every-comparable-peer-named-in-parity-checks',
          'no-silently-omitted-peers',
          'inversion-risks-explicitly-flagged',
          'parity-verdict-coheres-with-delta-pct',
        ],
        name: 'parity-coverage-checker',
      }),
      // Flexibility-rationale reviewer — adversarially probes whether the
      // flexibility-room band is justified by the recommendation rationale
      // (vs. arbitrary head-room that recruiters use to negotiate).
      Personas.skeptic({
        domain: 'flexibility-rationale',
        focus: [
          'flexibility-bounds-justified-by-rationale',
          'no-arbitrary-headroom',
          'ceiling-coheres-with-band-mid',
        ],
        name: 'flexibility-rationale-reviewer',
      }),
      // HR domain reviewer — pulls the senior-comp-partner expert for
      // judgment on the overall recommendation quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/HumanResourcesManagers',
        name: 'people-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:compensation-band-analyst:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-chro',
    seller: 'svc:compensation-band-analyst',
    serviceRef: 'svc:compensation-band-analyst',
    // CHRO signs every recommendation before it emits — comp authority
    // for offer letters at any band cannot be delegated.
    predicate: AND(
      SchemaMatch(OfferRecommendationOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['chro'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 99900n, currency: 'USD' },
    // 2-day SLA — offer assembly should not bottleneck the pipeline.
    timeoutDays: 2,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'ic',
        amount: 29900n,
        includedPerMonth: 20,
        overage: 29900n,
      },
      {
        id: 'senior-ic',
        amount: 99900n,
        includedPerMonth: 8,
        overage: 99900n,
      },
      {
        id: 'leadership',
        amount: 499900n,
        includedPerMonth: 2,
        overage: 499900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 2500n, perApiCall: 12n },
  reward: kr_offerAcceptanceAndCompEquity,

  lineage: {
    cellRef: 'business.org.ai/cells/human-resources-managers/compensation-band-analyst',
    icpContextProblemRef: 'icp:compensation-band-analyst:v1',
    foundingHypothesisRef: 'fh:compensation-band-analyst:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
