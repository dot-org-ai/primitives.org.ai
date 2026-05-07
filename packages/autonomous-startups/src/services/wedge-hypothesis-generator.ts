/**
 * Wedge Hypothesis Generator — startup-builder Stage-3 wedge-hypothesis
 * authoring Service.
 *
 * Distinguishing shape vs. siblings (`claude-code-feature-build`,
 * `competitor-uncopyability-prober`, `runtime-unit-emitter`):
 *   - `multi-step-research` archetype — the artefact is a founder-signed
 *     wedge-hypothesis triplet (customer-shape + problem-friction +
 *     approach-engine) emitted as a Founding Hypothesis (FH), not a code
 *     diff or a competitor uncopyability memo;
 *   - 5-step cascade: Code fan-in (cell + thesis + occupations.org.ai
 *     job-archetype) → Generative (3 wedge candidates) → Generative
 *     (score-each-on-9-rubric-dims + select-strongest) →
 *     Human (founder review + pick) → Code (emit-FH + downstream-cascade-
 *     trigger);
 *   - `Pricing.outcome` 2 tiers keyed on the depth of the FH — `rough`
 *     (founder-internal exploration, $99) / `investment-grade` (the FH a
 *     fund or board partner will fund, $999) — investment-grade FHs carry
 *     the heavier evaluator pass + must survive partner scrutiny;
 *   - declarative HITL = mandatory founder review + pick Human Function
 *     (the founder owns the wedge bet — cannot be delegated; uses
 *     `'approval'` rationale because the cascade ranks but the founder
 *     picks), plus OutcomeContract requires founder signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(rubric-coverage +
 *     wedge-distinctiveness + cell-coherence) + HumanSign(founder))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy` (FH claims
 *     about the customer / problem / approach must be cite-grounded) and
 *     `Personas.budgetRealism` (the FH carries implicit time-to-pmf,
 *     headcount, and capital claims that must survive a realism audit
 *     before the founder commits).
 *
 * Per design v3 §3 (Catalog HOW startup) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `stage-9-pass-rate-of-emitted-FHs` — the
 * compound metric every startup-builder optimises against (wedge
 * generation is worth running iff the emitted FH survives Stage-9
 * critique without a re-author cycle).
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
 * Input — a (cell, thesis) pair fixed by the upstream cascade plus the
 * founder routing context. `wedgeDepth` resolves the outcome tier at
 * intake (rough exploration vs. investment-grade FH). `jobArchetypeRef`
 * pins the occupations.org.ai job-archetype the wedge serves.
 */
export const WedgeHypothesisInputSchema = z.object({
  cellRef: z.string(),
  thesisRef: z.string(),
  jobArchetypeRef: z.string().regex(/^occupations\.org\.ai\//),
  wedgeDepth: z.enum(['rough', 'investment-grade']),
  founderRef: z.string(),
  triggerStage: z.literal('stage-3-wedge-authoring'),
})

const WedgeCandidateSchema = z.object({
  candidateId: z.string(),
  customerShape: z.object({
    summary: z.string().min(20),
    icpSegment: z.string(),
    boundaryCriteria: z.array(z.string()).min(1),
  }),
  problemFriction: z.object({
    summary: z.string().min(20),
    frictionEvidence: z.array(z.string()).min(1),
    statusQuoCost: z.string(),
  }),
  approachEngine: z.object({
    summary: z.string().min(20),
    engineMechanism: z.string(),
    leverageRationale: z.string(),
  }),
  rubricScores: z.object({
    customerSpecificity: z.number().min(0).max(5),
    problemFrictionEvidence: z.number().min(0).max(5),
    approachLeverage: z.number().min(0).max(5),
    cellCoherence: z.number().min(0).max(5),
    distinctiveness: z.number().min(0).max(5),
    timingFit: z.number().min(0).max(5),
    margainStructure: z.number().min(0).max(5),
    investorAppeal: z.number().min(0).max(5),
    foundingFitness: z.number().min(0).max(5),
  }),
  rubricNotes: z.string(),
})

/**
 * Output — a founder-signed FH plus the 3 candidate wedges considered,
 * scored against the 9-dim rubric. `selectedCandidateId` references
 * the picked wedge; `emittedFoundingHypothesisRef` is the FH ID emitted
 * downstream. `founderDecision` captures the human pick + rationale.
 */
export const WedgeHypothesisOutputSchema = z.object({
  cellRef: z.string(),
  thesisRef: z.string(),
  candidates: z.array(WedgeCandidateSchema).length(3),
  selectedCandidateId: z.string(),
  founderDecision: z.object({
    founderRef: z.string(),
    decision: z.enum(['accept', 'request-revision', 'reject']),
    rationale: z.string(),
    decidedAt: z.string(),
  }),
  emittedFoundingHypothesisRef: z.string(),
  downstreamCascadeTriggered: z.boolean(),
  generatedAt: z.string(),
})

export type WedgeHypothesisInput = z.infer<typeof WedgeHypothesisInputSchema>
export type WedgeHypothesisOutput = z.infer<typeof WedgeHypothesisOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_stage9PassRate: RewardSignal = {
  keyResultRef: 'kr:wedge-hypothesis-generator:stage-9-pass-rate-of-emitted-fhs',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:wedge-hypothesis-generator:intake-coverage',
}
const kr_candidateDistinctiveness: RewardSignal = {
  keyResultRef: 'kr:wedge-hypothesis-generator:candidate-distinctiveness',
}
const kr_rubricFidelity: RewardSignal = {
  keyResultRef: 'kr:wedge-hypothesis-generator:rubric-fidelity',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:wedge-hypothesis-generator:emit-latency',
}

// ============================================================================
// Wedge Hypothesis Generator Service
// ============================================================================

/**
 * Wedge Hypothesis Generator — (cell, thesis) trigger → founder-signed
 * FH (customer-shape + problem-friction + approach-engine) + downstream
 * cascade trigger as a Service.
 *
 * Cascade: fetch-cell-thesis-and-occupations-job-archetype (Code, fan-in)
 *        → synthesize-3-wedge-candidates (Generative)
 *        → score-on-9-rubric-dims-and-select-strongest (Generative)
 *        → founder-review-and-pick (Human, approval rationale)
 *        → emit-fh-and-trigger-downstream-cascade (Code, fan-out).
 */
export const wedgeHypothesisGenerator: ServiceInstance<
  WedgeHypothesisInput,
  WedgeHypothesisOutput
> = Service.define<WedgeHypothesisInput, WedgeHypothesisOutput>({
  name: 'Wedge Hypothesis Generator',
  promise:
    'Every (cell, thesis) reaches Stage 9 with a founder-signed Founding Hypothesis — three scored wedge candidates against a 9-dim rubric, the founder picks the strongest, the FH emits and triggers the downstream cascade — so founders spend the cycle on the bet, not on the assembly.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: WedgeHypothesisInputSchema, output: WedgeHypothesisOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-cell-thesis-and-occupations-job-archetype',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-3-wedge-candidates',
        reward: kr_candidateDistinctiveness,
      }),
      Generative({
        name: 'score-on-9-rubric-dims-and-select-strongest',
        reward: kr_rubricFidelity,
      }),
      Human({
        name: 'founder-review-and-pick',
        // `approval` rationale: the cascade ranks but the founder picks
        // the wedge bet — this authority cannot be delegated.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-fh-and-trigger-downstream-cascade',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'occupations.org.ai/job-archetypes',
      'business.org.ai/cells',
      'business.org.ai/theses',
      'fh.registry',
      'cascade.runner',
    ],
    // Wedge authoring: clarification disabled — the cascade synthesises
    // from (cell, thesis, job-archetype); the founder review step is the
    // single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Investment-grade wedges escalate the rubric scoring to a
        // partner-grade reviewer before the founder pick (board-ready
        // FHs cannot ship on cascade self-scoring alone).
        when: 'wedgeDepth == "investment-grade"',
        action: 'escalate',
      },
      {
        // Every wedge routes through founder review + pick before the
        // FH emits; OutcomeContract enforces the founder signature, the
        // trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'founder-review-and-pick',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:wedge-hypothesis-generator-review',
    personas: [
      // Rubric-coverage reviewer — pedantic check that all 9 rubric
      // dimensions are scored for every candidate and the selection
      // logic is grounded in the rubric (not arbitrary).
      Personas.pedantic({
        domain: 'rubric-coverage',
        rubric: [
          'all-9-dims-scored-per-candidate',
          'selection-logic-cites-rubric',
          'no-orphaned-or-double-scored-dims',
          'rubric-notes-cite-evidence',
        ],
        name: 'rubric-coverage-checker',
      }),
      // Wedge-distinctiveness reviewer — adversarially probes whether
      // the 3 candidates are genuinely distinct (not three flavours of
      // the same wedge) along customer / problem / engine axes.
      Personas.skeptic({
        domain: 'wedge-distinctiveness',
        focus: [
          'customer-shape-divergence',
          'problem-friction-divergence',
          'approach-engine-divergence',
          'no-trivial-cosmetic-variants',
        ],
        name: 'wedge-distinctiveness-reviewer',
      }),
      // Cell-coherence reviewer — pedantic check that every wedge
      // candidate sits inside the named cell + serves the named
      // occupations.org.ai job-archetype (no scope drift).
      Personas.pedantic({
        domain: 'cell-coherence',
        rubric: [
          'wedge-sits-inside-cell-boundary',
          'wedge-serves-job-archetype',
          'no-cross-cell-blast-radius',
          'thesis-alignment-explicit',
        ],
        name: 'cell-coherence-checker',
      }),
      // Factual-accuracy reviewer — every claim about the customer, the
      // problem friction, or the approach engine must be cite-grounded
      // with at least 2 corroborating sources (high-stakes wedge bet).
      Personas.factualAccuracy({ minCitationsPerClaim: 2 }),
      // Budget-realism reviewer — the FH carries implicit time-to-pmf,
      // headcount, and capital claims; all axes must survive realism
      // audit before the founder commits.
      Personas.budgetRealism({ budgetType: 'all' }),
      // Domain reviewer — pulls the senior-startup-strategist expert
      // for judgment on the overall wedge quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/StartupStrategists',
        name: 'startup-strategy-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:wedge-hypothesis-generator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-founder',
    seller: 'svc:wedge-hypothesis-generator',
    serviceRef: 'svc:wedge-hypothesis-generator',
    // Founder signs every FH before downstream cascade triggers — the
    // wedge bet authority cannot be delegated.
    predicate: AND(
      SchemaMatch(WedgeHypothesisOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['founder'] })
    ),
    tiers: [
      { id: 'rough', amount: 9900n, currency: 'USD', description: 'Rough wedge exploration' },
      {
        id: 'investment-grade',
        amount: 99900n,
        currency: 'USD',
        description: 'Investment-grade FH',
      },
    ],
    // 3-day SLA — wedge authoring takes a long-weekend from cell-thesis
    // intake to founder-signed FH.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'rough', amount: 9900n },
      { id: 'investment-grade', amount: 99900n },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 4000n, perApiCall: 10n },
  reward: kr_stage9PassRate,

  lineage: {
    cellRef: 'business.org.ai/cells/founders/wedge-hypothesis-authoring',
    icpContextProblemRef: 'icp:wedge-hypothesis-generator:v1',
    foundingHypothesisRef: 'fh:wedge-hypothesis-generator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
