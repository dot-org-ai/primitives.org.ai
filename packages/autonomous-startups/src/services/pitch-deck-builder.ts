/**
 * Pitch Deck Builder — investor / partner pitch-deck authoring Service.
 *
 * Distinguishing shape vs. siblings (`claude-code-feature-build`,
 * `wedge-hypothesis-generator`, `competitor-uncopyability-prober`,
 * `runtime-unit-emitter`, `pricing-architect`, `gtm-experiment-runner`):
 *   - `content-generation` archetype — the artefact is a founder-and-
 *     advisor-signed pitch deck (narrative arc + per-slide content +
 *     speaker notes + appendix), not an FH or a code diff;
 *   - 5-step cascade: Code fan-in (company data + recent traction +
 *     market context + comparable rounds) → Generative (narrative arc:
 *     problem + insight + solution + traction + market + team + ask) →
 *     Generative (per-slide content + design direction + appendix data)
 *     → Human (founder + advisor review) → Code (emit deck source +
 *     speaker notes);
 *   - `Pricing.outcome` 3 tiers keyed on the round being raised — `pre-
 *     seed` (founder-internal narrative-fit, $999) / `seed-or-series-a`
 *     (institutional-grade, $2,999) / `late-stage` (board-and-LP-grade
 *     with full appendix data-room, $9,999) — late-stage decks carry the
 *     heaviest evaluator pass + must survive due-diligence-grade
 *     scrutiny;
 *   - declarative HITL = mandatory founder + advisor review Human
 *     Function (founder uses `'approval'` rationale because the founder
 *     owns the pitch + ask + signs every claim; advisor uses `'trust'`
 *     rationale because investor-trust on the deck depends on the named
 *     advisor's reputation), plus OutcomeContract requires founder
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(narrative-
 *     coherence + traction-verifiability + market-realism + ask-
 *     precision) + HumanSign(founder))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy({
 *     citationRequired: true, sourceTypes: ['first-party',
 *     'industry-standard'] })` because every claim about traction,
 *     market size, or team must be cite-grounded with first-party data
 *     (own metrics) or industry-standard reports (Gartner, IDC, etc.);
 *     misstatement on a fundraise deck is a fiduciary issue.
 *
 * Per design v3 §3 (Catalog HOW startup) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `meeting-conversion-rate-and-term-sheet-rate`
 * — the compound metric every fundraising founder optimises against
 * (deck authoring is worth running iff the deck converts intro emails
 * to meetings and meetings to term sheets at a rate above baseline).
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

const TractionDatumSchema = z.object({
  metricId: z.string(),
  label: z.string(),
  valueAsOf: z.string(),
  value: z.string(),
  trend: z.enum(['up', 'flat', 'down', 'volatile']),
  sourceRef: z.string().optional(),
})

const ComparableRoundSchema = z.object({
  companyRef: z.string(),
  stage: z.enum(['pre-seed', 'seed', 'series-a', 'series-b', 'series-c-plus', 'late-stage']),
  raiseAmountUsd: z.number().min(0),
  postMoneyValuationUsd: z.number().min(0).optional(),
  closedOn: z.string(),
  sourceRef: z.string(),
})

/**
 * Input — a pitch-deck authoring brief from the founder. `roundStage`
 * resolves the outcome tier at intake. `partnershipPitch` distinguishes
 * a fundraise deck from a partnership-pitch deck (different narrative
 * arc weighting: traction-first for partnerships, vision-first for
 * pre-seed fundraise).
 */
export const PitchDeckBuilderInputSchema = z.object({
  companyRef: z.string(),
  roundStage: z.enum(['pre-seed', 'seed-or-series-a', 'late-stage']),
  partnershipPitch: z.boolean().default(false),
  recentTraction: z.array(TractionDatumSchema).min(1),
  marketContextRef: z.string(),
  comparableRounds: z.array(ComparableRoundSchema).default([]),
  founderRef: z.string(),
  advisorRef: z.string(),
  triggerStage: z.enum(['fundraise-prep', 'partnership-pitch']),
})

const NarrativeArcSchema = z.object({
  problem: z.string().min(20),
  insight: z.string().min(20),
  solution: z.string().min(20),
  tractionStory: z.string().min(20),
  marketStory: z.string().min(20),
  teamStory: z.string().min(20),
  ask: z.object({
    amountUsd: z.number().min(0),
    instrument: z.enum(['safe', 'priced-equity', 'convertible', 'partnership-mou']),
    useOfFunds: z.array(z.string()).min(1),
    runwayMonthsAtRaise: z.number().min(0),
  }),
})

const SlideSchema = z.object({
  slideId: z.string(),
  order: z.number().int().min(1),
  title: z.string(),
  bodyMarkdown: z.string().min(10),
  designDirection: z.string(),
  speakerNotes: z.string(),
  citations: z.array(z.string()).default([]),
})

const AppendixDataItemSchema = z.object({
  itemId: z.string(),
  label: z.string(),
  contentSummary: z.string(),
  sourceRef: z.string().optional(),
})

/**
 * Output — a founder-and-advisor-signed pitch deck plus the narrative
 * arc, per-slide content, design direction, speaker notes, and
 * appendix data-room. `emittedDeckSourceRef` references the deck
 * source-of-truth (Markdown / Keynote / Figma); `emittedSpeakerNotesRef`
 * references the rendered speaker-notes doc.
 */
export const PitchDeckBuilderOutputSchema = z.object({
  companyRef: z.string(),
  narrativeArc: NarrativeArcSchema,
  slides: z.array(SlideSchema).min(8),
  appendixData: z.array(AppendixDataItemSchema).default([]),
  reviewDecisions: z.object({
    founder: z.object({
      founderRef: z.string(),
      decision: z.enum(['accept', 'request-revision', 'reject']),
      rationale: z.string(),
      decidedAt: z.string(),
    }),
    advisor: z.object({
      advisorRef: z.string(),
      decision: z.enum(['endorse', 'request-revision', 'decline-to-endorse']),
      rationale: z.string(),
      reviewedAt: z.string(),
    }),
  }),
  emittedDeckSourceRef: z.string(),
  emittedSpeakerNotesRef: z.string(),
  generatedAt: z.string(),
})

export type PitchDeckBuilderInput = z.infer<typeof PitchDeckBuilderInputSchema>
export type PitchDeckBuilderOutput = z.infer<typeof PitchDeckBuilderOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_meetingAndTermSheetRate: RewardSignal = {
  keyResultRef: 'kr:pitch-deck-builder:meeting-conversion-rate-and-term-sheet-rate',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:pitch-deck-builder:intake-coverage',
}
const kr_narrativeCoherence: RewardSignal = {
  keyResultRef: 'kr:pitch-deck-builder:narrative-coherence',
}
const kr_slideQuality: RewardSignal = {
  keyResultRef: 'kr:pitch-deck-builder:slide-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:pitch-deck-builder:emit-latency',
}

// ============================================================================
// Pitch Deck Builder Service
// ============================================================================

/**
 * Pitch Deck Builder — fundraise / partnership-pitch trigger →
 * founder-and-advisor-signed pitch deck + speaker notes as a Service.
 *
 * Cascade: fetch-company-data-traction-market-and-comparable-rounds (Code, fan-in)
 *        → synthesize-narrative-arc (Generative)
 *        → emit-per-slide-content-design-direction-and-appendix (Generative)
 *        → founder-and-advisor-review (Human, approval rationale)
 *        → emit-deck-source-and-speaker-notes (Code, fan-out).
 */
export const pitchDeckBuilder: ServiceInstance<PitchDeckBuilderInput, PitchDeckBuilderOutput> =
  Service.define<PitchDeckBuilderInput, PitchDeckBuilderOutput>({
    name: 'Pitch Deck Builder',
    promise:
      'Every fundraise round or partnership pitch reaches a founder-and-advisor-signed deck in under a week — narrative arc grounded in traction + market + ask, per-slide content with speaker notes + appendix data-room, every claim cite-grounded — so founders walk into the meeting with a deck the room trusts and the partner can act on.',
    audience: 'business',
    archetype: 'content-generation',
    schema: { input: PitchDeckBuilderInputSchema, output: PitchDeckBuilderOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-company-data-traction-market-and-comparable-rounds',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-narrative-arc',
          reward: kr_narrativeCoherence,
        }),
        Generative({
          name: 'emit-per-slide-content-design-direction-and-appendix',
          reward: kr_slideQuality,
        }),
        Human({
          name: 'founder-and-advisor-review',
          // `approval` rationale: the founder owns the pitch + ask and
          // signs every claim — the authority cannot be delegated. The
          // advisor's `trust` rationale is captured at the OutcomeContract
          // level via the dual-signer downstream HumanSign extension; at
          // the Function level, `approval` reflects the gating call.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-deck-source-and-speaker-notes',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'company.registry',
        'metrics.traction-feed',
        'market.context-feed',
        'comparable-rounds.registry',
        'deck.source-store',
        'speaker-notes.registry',
      ],
      // Deck authoring: clarification disabled — the cascade synthesises
      // from (company, traction, market, comparables); the founder +
      // advisor review step is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Late-stage decks escalate the slide content + appendix data-
          // room emission to a fundraise-strategy partner before founder
          // + advisor review (board-and-LP-grade decks cannot ship on
          // cascade self-scoring alone).
          when: 'roundStage == "late-stage"',
          action: 'escalate',
        },
        {
          // Every deck routes through founder + advisor review before
          // the deck source emits; OutcomeContract enforces the founder
          // signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'founder-and-advisor-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:pitch-deck-builder-review',
      personas: [
        // Narrative-coherence reviewer — pedantic check that the seven
        // arc beats (problem / insight / solution / traction / market /
        // team / ask) connect logically and that each slide reinforces
        // the arc beat it sits in.
        Personas.pedantic({
          domain: 'narrative-coherence',
          rubric: [
            'all-seven-arc-beats-present',
            'slide-order-reinforces-arc',
            'no-orphan-or-redundant-slides',
            'transitions-explicit-in-speaker-notes',
          ],
          name: 'narrative-coherence-checker',
        }),
        // Traction-verifiability reviewer — pedantic check that every
        // traction metric carries a first-party source reference and a
        // valueAsOf date (no rounded-up numbers; no "vanity metrics
        // without method").
        Personas.pedantic({
          domain: 'traction-verifiability',
          rubric: [
            'every-traction-metric-has-source-ref',
            'every-traction-metric-has-value-as-of-date',
            'no-vanity-metrics-without-method',
            'trend-direction-matches-data-point-history',
          ],
          name: 'traction-verifiability-checker',
        }),
        // Market-realism reviewer — adversarially probes the market
        // story for over-claimed TAM / SAM / SOM and unlinked
        // bottom-up vs. top-down sizing.
        Personas.skeptic({
          domain: 'market-realism',
          focus: [
            'tam-sam-som-grounded-in-citation',
            'bottom-up-and-top-down-sizing-converge',
            'no-handwaved-tam-claims',
            'beachhead-segment-explicit',
          ],
          name: 'market-realism-skeptic',
        }),
        // Ask-precision reviewer — accuracy check that the ask amount,
        // instrument, use-of-funds, and runway-at-raise reconcile
        // arithmetically with each other (no math errors; no vague
        // "raising ~$X").
        Personas.accuracy({
          domain: 'ask-precision',
          name: 'ask-precision-reviewer',
        }),
        // Factual-accuracy reviewer — every load-bearing claim must
        // carry a first-party (own metrics) or industry-standard
        // (Gartner, IDC, etc.) citation. Misstatement on a fundraise
        // deck is a fiduciary issue.
        Personas.factualAccuracy({
          citationRequired: true,
          sourceTypes: ['first-party', 'industry-standard'],
          minCitationsPerClaim: 1,
        }),
        // Domain reviewer — pulls the senior-fundraise-strategist
        // expert for judgment on the overall deck quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/FundraiseStrategists',
          name: 'fundraise-strategy-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:pitch-deck-builder:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-founder',
      seller: 'svc:pitch-deck-builder',
      serviceRef: 'svc:pitch-deck-builder',
      // Founder signs every deck before deck-source emits — the pitch +
      // ask authority cannot be delegated.
      predicate: AND(
        SchemaMatch(PitchDeckBuilderOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['founder'] })
      ),
      tiers: [
        {
          id: 'pre-seed',
          amount: 99900n,
          currency: 'USD',
          description: 'Founder-internal narrative-fit deck',
        },
        {
          id: 'seed-or-series-a',
          amount: 299900n,
          currency: 'USD',
          description: 'Institutional-grade fundraise deck',
        },
        {
          id: 'late-stage',
          amount: 999900n,
          currency: 'USD',
          description: 'Board-and-LP-grade deck with full appendix data-room',
        },
      ],
      // 5-day SLA — pitch authoring takes a workweek from intake to
      // founder-and-advisor-signed deck.
      timeoutDays: 5,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        { id: 'pre-seed', amount: 99900n },
        { id: 'seed-or-series-a', amount: 299900n },
        { id: 'late-stage', amount: 999900n },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 7000n, perApiCall: 14n },
    reward: kr_meetingAndTermSheetRate,

    lineage: {
      cellRef: 'business.org.ai/cells/founders/pitch-deck-authoring',
      icpContextProblemRef: 'icp:pitch-deck-builder:v1',
      foundingHypothesisRef: 'fh:pitch-deck-builder:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
