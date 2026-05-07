/**
 * Competitor Uncopyability Prober — Stage-5/6 competitor uncopyability
 * verification Service.
 *
 * Distinguishing shape vs. siblings (`claude-code-feature-build`,
 * `wedge-hypothesis-generator`, `runtime-unit-emitter`):
 *   - `multi-step-research` archetype — the artefact is a senior-founder-
 *     signed uncopyability memo per named substitute (structural barriers
 *     + integration depth + 6-month pivot feasibility), not an FH or a
 *     code diff;
 *   - 6-step cascade: Code fan-in (named substitutes + product
 *     positioning + recent roadmap news) → Agentic supervised research
 *     of each substitute → Generative (uncopyability rationale per
 *     substitute) → Generative (red-team counter-arguments) → Human
 *     (senior-founder review) → Code (emit-uncopyability-memo +
 *     cascade-feedback);
 *   - `Pricing.subscription` — recurring per-founder plan ($199/mo) +
 *     metered overage on `uncopyability-memo-emitted` ($49/memo) — the
 *     base subscription covers ongoing wedge-defence monitoring; the
 *     metered fee covers each formal memo emission;
 *   - declarative HITL = mandatory senior-founder review Human Function
 *     (uses `'premium'` rationale — the depth of expertise required to
 *     judge uncopyability over a 6-month pivot horizon cannot be
 *     delegated to a junior reviewer), plus OutcomeContract requires
 *     senior-founder signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(uncopyability-
 *     soundness + counter-argument-completeness) +
 *     HumanSign(senior-founder))`;
 *   - EvaluatorPanel includes `Personas.skeptic({ domain: 'c5-
 *     uncopyable' })` (cluster-5 framework adversarial probe),
 *     `Personas.factualAccuracy({ sourceTypes: ['government',
 *     'industry-standard'] })` (substitute-claims must cite formal
 *     filings / industry-standard reports), and
 *     `Personas.brandSafety({ riskTolerance: 'high' })` (the memo names
 *     competitors directly; the brand-safety bar is high because the
 *     audience is internal-strategy not external-marketing).
 *
 * Per design v3 §3 (Catalog HOW startup) + §6 (binding triggers,
 * conditional HumanSign) + §7 (subscription + metered pricing) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `c5-rubric-pass-rate` — the compound metric
 * the strategy team optimises against (uncopyability proving is worth
 * running iff the memo passes the cluster-5 rubric on first review).
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

const NamedSubstituteSchema = z.object({
  substituteId: z.string(),
  substituteName: z.string(),
  vendorRef: z.string().optional(),
  positioningSummary: z.string(),
})

/**
 * Input — an FH with at least one named substitute, requiring
 * cluster-5-style uncopyability verification. `senior-founder` routing
 * is explicit because the depth of expertise demands a premium-rationale
 * Human step.
 */
export const CompetitorUncopyabilityInputSchema = z.object({
  foundingHypothesisRef: z.string(),
  cellRef: z.string(),
  namedSubstitutes: z.array(NamedSubstituteSchema).min(1),
  seniorFounderRef: z.string(),
  pivotHorizonMonths: z.number().int().min(1).max(24).default(6),
  triggerStage: z.enum(['stage-5-substitute-naming', 'stage-6-uncopyability-verification']),
})

const UncopyabilityRationaleSchema = z.object({
  substituteId: z.string(),
  structuralBarriers: z.array(
    z.object({
      barrierId: z.string(),
      description: z.string(),
      barrierKind: z.enum(['regulatory', 'data-network', 'capital', 'talent', 'distribution']),
      strength: z.enum(['weak', 'moderate', 'strong']),
    })
  ),
  integrationDepth: z.object({
    depthScore: z.number().min(0).max(5),
    rationale: z.string(),
    switchingCostEvidence: z.array(z.string()),
  }),
  pivotFeasibility: z.object({
    horizonMonths: z.number().int().min(1).max(24),
    feasibility: z.enum(['low', 'medium', 'high']),
    rationale: z.string(),
    cuesFromRecentRoadmap: z.array(z.string()),
  }),
  uncopyabilityVerdict: z.enum(['uncopyable', 'copyable-with-friction', 'copyable']),
  uncopyabilityNotes: z.string(),
})

const CounterArgumentSchema = z.object({
  argumentId: z.string(),
  challengesSubstituteIds: z.array(z.string()).min(1),
  challenge: z.string(),
  rebuttal: z.string(),
  residualRisk: z.enum(['none', 'low', 'medium', 'high']),
})

/**
 * Output — a senior-founder-signed uncopyability memo per substitute,
 * red-teamed against counter-arguments, with cascade-feedback for the
 * upstream wedge author. `cascadeFeedback.recommendedAction` drives
 * upstream wedge revision when residual risk is too high.
 */
export const CompetitorUncopyabilityOutputSchema = z.object({
  foundingHypothesisRef: z.string(),
  uncopyabilityRationales: z.array(UncopyabilityRationaleSchema).min(1),
  counterArguments: z.array(CounterArgumentSchema),
  seniorFounderReview: z.object({
    seniorFounderRef: z.string(),
    decision: z.enum(['accept', 'request-revision', 'reject']),
    rationale: z.string(),
    reviewedAt: z.string(),
  }),
  cascadeFeedback: z.object({
    recommendedAction: z.enum(['proceed', 'revise-wedge', 'kill-wedge']),
    feedbackNotes: z.string(),
  }),
  emittedUncopyabilityMemoRef: z.string(),
  generatedAt: z.string(),
})

export type CompetitorUncopyabilityInput = z.infer<typeof CompetitorUncopyabilityInputSchema>
export type CompetitorUncopyabilityOutput = z.infer<typeof CompetitorUncopyabilityOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_c5RubricPassRate: RewardSignal = {
  keyResultRef: 'kr:competitor-uncopyability-prober:c5-rubric-pass-rate',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:competitor-uncopyability-prober:intake-coverage',
}
const kr_substituteResearchDepth: RewardSignal = {
  keyResultRef: 'kr:competitor-uncopyability-prober:substitute-research-depth',
}
const kr_uncopyabilitySoundness: RewardSignal = {
  keyResultRef: 'kr:competitor-uncopyability-prober:uncopyability-soundness',
}
const kr_redTeamCompleteness: RewardSignal = {
  keyResultRef: 'kr:competitor-uncopyability-prober:red-team-completeness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:competitor-uncopyability-prober:emit-latency',
}

// ============================================================================
// Competitor Uncopyability Prober Service
// ============================================================================

/**
 * Competitor Uncopyability Prober — FH-with-substitutes trigger →
 * senior-founder-signed uncopyability memo + cascade-feedback as a
 * Service.
 *
 * Cascade: fetch-substitutes-positioning-and-roadmap-news (Code, fan-in)
 *        → research-each-substitute-supervised (Agentic, supervised)
 *        → synthesize-uncopyability-rationale-per-substitute (Generative)
 *        → red-team-counter-arguments (Generative)
 *        → senior-founder-review (Human, premium rationale)
 *        → emit-uncopyability-memo-and-cascade-feedback (Code, fan-out).
 */
export const competitorUncopyabilityProber: ServiceInstance<
  CompetitorUncopyabilityInput,
  CompetitorUncopyabilityOutput
> = Service.define<CompetitorUncopyabilityInput, CompetitorUncopyabilityOutput>({
  name: 'Competitor Uncopyability Prober',
  promise:
    'Every FH with named substitutes reaches Stage 6 with a senior-founder-signed uncopyability memo — structural barriers, integration depth, 6-month pivot feasibility, red-teamed against counter-arguments — so wedge defence rests on evidence, not on optimism.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: {
    input: CompetitorUncopyabilityInputSchema,
    output: CompetitorUncopyabilityOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-substitutes-positioning-and-roadmap-news',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'research-each-substitute-supervised',
        reward: kr_substituteResearchDepth,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
        // One supervised research pass per named substitute; the cascade
        // compiler chooses the fan-out width from the upstream substitute
        // count.
        concurrency: 'fan-out',
      }),
      Generative({
        name: 'synthesize-uncopyability-rationale-per-substitute',
        reward: kr_uncopyabilitySoundness,
      }),
      Generative({
        name: 'red-team-counter-arguments',
        reward: kr_redTeamCompleteness,
      }),
      Human({
        name: 'senior-founder-review',
        // `premium` rationale: judging uncopyability over a 6-month pivot
        // horizon demands depth of strategy expertise — cannot be
        // delegated to a junior reviewer.
        rationale: 'premium',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-uncopyability-memo-and-cascade-feedback',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'crunchbase.competitors',
      'pitchbook.market-maps',
      'sec.filings',
      'g2.product-positioning',
      'news.roadmap-feed',
      'memo.registry',
    ],
    clarificationPolicy: { enabled: true, maxRoundTrips: 2, escalateTo: 'engineer' },
    triggers: [
      {
        // High-residual-risk memos escalate to a partner-grade reviewer
        // before emission (kill-wedge recommendations carry compounding
        // strategy blast-radius).
        when: 'cascadeFeedback.recommendedAction == "kill-wedge"',
        action: 'escalate',
      },
      {
        // Every memo routes through senior-founder review before the
        // memo emits; OutcomeContract enforces the senior-founder
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'senior-founder-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:competitor-uncopyability-prober-review',
    personas: [
      // c5-uncopyable skeptic — adversarially probes the cluster-5
      // uncopyability framework: structural barriers, integration depth,
      // pivot feasibility — looking for over-claimed moats.
      Personas.skeptic({
        domain: 'c5-uncopyable',
        focus: [
          'over-claimed-structural-barriers',
          'integration-depth-claims-cite-evidence',
          'pivot-feasibility-grounded-in-roadmap-cues',
          'no-handwaved-uncopyability',
        ],
        name: 'c5-uncopyable-skeptic',
      }),
      // Counter-argument-completeness reviewer — pedantic check that
      // every substitute has at least one red-team challenge and that
      // every challenge has a rebuttal + residual-risk classification.
      Personas.pedantic({
        domain: 'counter-argument-completeness',
        rubric: [
          'every-substitute-has-at-least-one-challenge',
          'every-challenge-has-a-rebuttal',
          'residual-risk-classified',
          'no-strawman-counter-arguments',
        ],
        name: 'counter-argument-completeness-checker',
      }),
      // Factual-accuracy reviewer — substitute claims must cite
      // government filings / industry-standard reports (not just
      // marketing pages).
      Personas.factualAccuracy({
        sourceTypes: ['government', 'industry-standard'],
        minCitationsPerClaim: 2,
      }),
      // Brand-safety reviewer — the memo names competitors directly; the
      // bar is high because the audience is internal strategy (not
      // external marketing) so direct critique is permitted.
      Personas.brandSafety({ riskTolerance: 'high' }),
      // Domain reviewer — pulls the senior-strategy expert for judgment
      // on the overall uncopyability case quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/CorporateStrategists',
        name: 'corporate-strategy-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:competitor-uncopyability-prober:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-senior-founder',
    seller: 'svc:competitor-uncopyability-prober',
    serviceRef: 'svc:competitor-uncopyability-prober',
    // Senior-founder signs every uncopyability memo before emission —
    // the strategy bet authority cannot be delegated.
    predicate: AND(
      SchemaMatch(CompetitorUncopyabilityOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['senior-founder'] })
    ),
    amount: { amount: 19900n, currency: 'USD' },
    // 5-day SLA — competitor research takes a workweek from substitute
    // intake to senior-founder-signed memo.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'competitor-uncopyability-prober-monthly',
      amount: 19900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'uncopyability-memo-emitted',
        amount: 4900n,
        description: 'Per formally emitted, senior-founder-signed uncopyability memo',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 6000n, perAgentRound: 80n, perApiCall: 15n },
  reward: kr_c5RubricPassRate,

  lineage: {
    cellRef: 'business.org.ai/cells/founders/competitor-uncopyability-proving',
    icpContextProblemRef: 'icp:competitor-uncopyability-prober:v1',
    foundingHypothesisRef: 'fh:competitor-uncopyability-prober:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
