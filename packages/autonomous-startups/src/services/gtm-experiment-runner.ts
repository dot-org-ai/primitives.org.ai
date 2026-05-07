/**
 * GTM Experiment Runner — go-to-market experiment design + run + readout
 * Service.
 *
 * Distinguishing shape vs. siblings (`claude-code-feature-build`,
 * `wedge-hypothesis-generator`, `competitor-uncopyability-prober`,
 * `runtime-unit-emitter`, `pricing-architect`, `pitch-deck-builder`):
 *   - `multi-step-research` archetype — the artefact is a founder-signed
 *     experiment record + decision log (persist / pivot / kill), not an
 *     FH or a pricing doc;
 *   - 6-step cascade: Code fan-in (current funnel + spend data + audience
 *     segments) → Generative (design experiment: hypothesis + variants +
 *     success criteria + duration) → Agentic (supervised run-experiment
 *     + collect results from channels) → Generative (synthesise readout +
 *     decision recommendation) → Human (founder decision review) →
 *     Code (emit experiment record + decision log);
 *   - `Pricing.percentOf` — the meter is the experiment-spend basis with
 *     a 15% rate (1500 basis points) and a $30k cap per experiment, so
 *     the Service shares risk with the founder: low-cost experiments
 *     pay low fees; high-cost experiments are capped before fees become
 *     uneconomic;
 *   - declarative HITL = mandatory founder decision review Human Function
 *     (uses `'approval'` rationale because the persist / pivot / kill
 *     call is the founder's; the cascade can recommend, the founder
 *     decides), plus OutcomeContract requires founder signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(experiment-
 *     design-soundness + decision-rationale + persistence-or-kill-
 *     readiness) + HumanSign(founder))`;
 *   - EvaluatorPanel includes `Personas.edgeCaseCoverage({
 *     minEdgeCasesPerScenario: 4 })` (experiments must enumerate
 *     pre-mortems for empty-input, malformed-input, extreme-volume,
 *     concurrent-modification, partial-failure cases) and
 *     `Personas.timelineRealism({ dependencyAware: true })` (experiment
 *     duration + sequencing must respect channel-specific dependencies
 *     like Meta-ad-creative-review windows or LinkedIn-impression
 *     dwell times).
 *
 * Per design v3 §3 (Catalog HOW startup) + §6 (binding triggers,
 * conditional HumanSign) + §7 (percent-of pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `pivot-or-persist-decision-quality` — the
 * compound metric every GTM team optimises against (experiment-running
 * is worth running iff the founder's decision (persist / pivot / kill)
 * holds up against the realised funnel after the next two iteration
 * cycles).
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

const FunnelStageSchema = z.object({
  stageId: z.string(),
  label: z.string(),
  conversionRate: z.number().min(0).max(1),
  volumeLast30Days: z.number().int().min(0),
})

const SpendChannelSchema = z.object({
  channelId: z.string(),
  channelName: z.enum([
    'meta-ads',
    'google-ads',
    'linkedin-ads',
    'youtube',
    'tiktok',
    'outbound-email',
    'cold-call',
    'partner',
    'pr',
    'content-seo',
    'community',
    'other',
  ]),
  spendLast30DaysUsd: z.number().min(0),
  cacLast30DaysUsd: z.number().min(0).optional(),
})

const AudienceSegmentSchema = z.object({
  segmentId: z.string(),
  label: z.string(),
  sizeEstimate: z.number().int().min(0),
  qualifyingTraits: z.array(z.string()).min(1),
})

/**
 * Input — a GTM-experiment brief from the founder. `hypothesisStatement`
 * is the founder's stated hypothesis under test; `experimentBudgetUsd`
 * resolves the percent-of cap calculation at intake.
 */
export const GtmExperimentInputSchema = z.object({
  hypothesisStatement: z.string().min(20),
  currentFunnel: z.array(FunnelStageSchema).min(2),
  spendChannels: z.array(SpendChannelSchema).min(1),
  audienceSegments: z.array(AudienceSegmentSchema).min(1),
  experimentBudgetUsd: z.number().min(100),
  experimentMaxDurationDays: z.number().int().min(1).max(180).default(28),
  founderRef: z.string(),
  triggerStage: z.literal('gtm-hypothesis-test'),
})

const ExperimentVariantSchema = z.object({
  variantId: z.string(),
  label: z.string(),
  description: z.string(),
  channelMix: z.array(
    z.object({
      channelId: z.string(),
      allocationPct: z.number().min(0).max(100),
    })
  ),
  expectedLift: z.string(),
})

const ExperimentDesignSchema = z.object({
  hypothesis: z.string().min(20),
  variants: z.array(ExperimentVariantSchema).min(2),
  controlVariantId: z.string(),
  successCriteria: z
    .array(
      z.object({
        criterionId: z.string(),
        metric: z.string(),
        threshold: z.string(),
      })
    )
    .min(1),
  durationDays: z.number().int().min(1),
  preMortems: z
    .array(
      z.object({
        riskId: z.string(),
        riskDescription: z.string(),
        mitigation: z.string(),
      })
    )
    .min(1),
})

const ExperimentResultSchema = z.object({
  variantId: z.string(),
  observations: z.array(
    z.object({
      stageId: z.string(),
      conversionRate: z.number().min(0).max(1),
      volume: z.number().int().min(0),
    })
  ),
  realisedSpendUsd: z.number().min(0),
  realisedCacUsd: z.number().min(0).optional(),
})

const DecisionRecommendationSchema = z.object({
  recommendation: z.enum(['persist', 'pivot', 'kill']),
  rationale: z.string().min(20),
  supportingObservations: z.array(z.string()).min(1),
  residualUncertainty: z.enum(['low', 'medium', 'high']),
  followOnExperimentSeed: z.string().optional(),
})

/**
 * Output — a founder-signed GTM-experiment record plus the design,
 * realised results, decision recommendation, and decision log. The
 * `realisedSpendUsd` total is the basis the percent-of pricing meters
 * against.
 */
export const GtmExperimentOutputSchema = z.object({
  hypothesisStatement: z.string(),
  design: ExperimentDesignSchema,
  results: z.array(ExperimentResultSchema).min(1),
  realisedSpendUsd: z.number().min(0),
  decisionRecommendation: DecisionRecommendationSchema,
  founderDecision: z.object({
    founderRef: z.string(),
    decision: z.enum(['persist', 'pivot', 'kill', 'extend-experiment']),
    rationale: z.string(),
    decidedAt: z.string(),
  }),
  emittedExperimentRecordRef: z.string(),
  emittedDecisionLogRef: z.string(),
  generatedAt: z.string(),
})

export type GtmExperimentInput = z.infer<typeof GtmExperimentInputSchema>
export type GtmExperimentOutput = z.infer<typeof GtmExperimentOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_decisionQuality: RewardSignal = {
  keyResultRef: 'kr:gtm-experiment-runner:pivot-or-persist-decision-quality',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:gtm-experiment-runner:intake-coverage',
}
const kr_designSoundness: RewardSignal = {
  keyResultRef: 'kr:gtm-experiment-runner:design-soundness',
}
const kr_runFidelity: RewardSignal = {
  keyResultRef: 'kr:gtm-experiment-runner:run-fidelity',
}
const kr_readoutClarity: RewardSignal = {
  keyResultRef: 'kr:gtm-experiment-runner:readout-clarity',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:gtm-experiment-runner:emit-latency',
}

// ============================================================================
// GTM Experiment Runner Service
// ============================================================================

/**
 * GTM Experiment Runner — founder-picks-hypothesis trigger →
 * founder-signed GTM-experiment record + decision log as a Service.
 *
 * Cascade: fetch-current-funnel-spend-data-and-audience-segments (Code, fan-in)
 *        → design-experiment-hypothesis-variants-success-criteria-duration (Generative)
 *        → supervised-run-experiment-and-collect-results-from-channels (Agentic, supervised)
 *        → synthesize-readout-and-decision-recommendation (Generative)
 *        → founder-decision-review (Human, approval rationale)
 *        → emit-experiment-record-and-decision-log (Code, fan-out).
 */
export const gtmExperimentRunner: ServiceInstance<GtmExperimentInput, GtmExperimentOutput> =
  Service.define<GtmExperimentInput, GtmExperimentOutput>({
    name: 'GTM Experiment Runner',
    promise:
      'Every GTM hypothesis under test reaches a founder-signed experiment record + decision log — design grounded in funnel + spend + audience, supervised run across channels, readout with persist / pivot / kill recommendation — so founders compound learning instead of accumulating opinions.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: GtmExperimentInputSchema, output: GtmExperimentOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-current-funnel-spend-data-and-audience-segments',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'design-experiment-hypothesis-variants-success-criteria-duration',
          reward: kr_designSoundness,
        }),
        Agentic({
          name: 'supervised-run-experiment-and-collect-results-from-channels',
          reward: kr_runFidelity,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
          // One supervised run pass per variant; the cascade compiler
          // chooses fan-out width from the upstream variant count.
          concurrency: 'fan-out',
        }),
        Generative({
          name: 'synthesize-readout-and-decision-recommendation',
          reward: kr_readoutClarity,
        }),
        Human({
          name: 'founder-decision-review',
          // `approval` rationale: the persist / pivot / kill call is
          // the founder's bet — the cascade can recommend, the founder
          // decides. The authority cannot be delegated.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-experiment-record-and-decision-log',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'analytics.funnel-feed',
        'spend.attribution-feed',
        'audience.segments-registry',
        'meta.ads-runner',
        'google.ads-runner',
        'linkedin.ads-runner',
        'outbound.sequencer',
        'experiment.records',
        'decision.log',
      ],
      // Experiment running: clarification enabled — supervised channel
      // operations sometimes surface ambiguous variant configurations
      // (e.g. unclear bid strategy) where a quick clarification beats
      // a wasted experiment day.
      clarificationPolicy: { enabled: true, maxRoundTrips: 2, escalateTo: 'engineer' },
      triggers: [
        {
          // High-residual-uncertainty readouts escalate to a senior-GTM
          // reviewer before founder decision review (kill recommendations
          // carry compounding strategy blast-radius).
          when: 'decisionRecommendation.residualUncertainty == "high"',
          action: 'escalate',
        },
        {
          // Every experiment routes through founder decision review
          // before the record emits; OutcomeContract enforces the
          // founder signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'founder-decision-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:gtm-experiment-runner-review',
      personas: [
        // Experiment-design-soundness reviewer — pedantic check that
        // the experiment has a control, ≥2 variants, named success
        // criteria with thresholds, and a duration grounded in the
        // expected-effect-size + audience-volume math.
        Personas.pedantic({
          domain: 'experiment-design-soundness',
          rubric: [
            'control-variant-named',
            'at-least-two-variants-defined',
            'success-criteria-have-numeric-thresholds',
            'duration-grounded-in-volume-math',
            'pre-mortems-enumerated',
          ],
          name: 'experiment-design-soundness-checker',
        }),
        // Decision-rationale reviewer — accuracy check that the
        // decision recommendation cites supporting observations from
        // the realised results (no recommendation untethered from
        // the data).
        Personas.accuracy({
          domain: 'decision-rationale',
          name: 'decision-rationale-reviewer',
        }),
        // Persistence-or-kill-readiness reviewer — adversarially
        // probes the readout for premature persistence (continuing on
        // ambiguous data) and premature kill (killing on insufficient
        // sample); flags either failure mode.
        Personas.skeptic({
          domain: 'persistence-or-kill-readiness',
          focus: [
            'no-premature-persistence-on-ambiguous-data',
            'no-premature-kill-on-insufficient-sample',
            'follow-on-experiment-seed-grounded-when-pivoting',
            'residual-uncertainty-classified-honestly',
          ],
          name: 'persistence-or-kill-readiness-skeptic',
        }),
        // Edge-case-coverage reviewer — the experiment design must
        // pre-mortem at least four edge cases per variant
        // (empty-input, malformed-input, extreme-volume, concurrent-
        // modification, partial-failure, etc.) to avoid blowing the
        // budget on a known failure mode.
        Personas.edgeCaseCoverage({ minEdgeCasesPerScenario: 4 }),
        // Timeline-realism reviewer — experiment duration + sequencing
        // must respect channel-specific dependencies (Meta-ad-creative-
        // review windows, LinkedIn-impression dwell times, etc.); the
        // dependency-aware mode catches missing handoffs.
        Personas.timelineRealism({ dependencyAware: true }),
        // Domain reviewer — pulls the senior-GTM-strategist expert for
        // judgment on the overall experiment quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/GtmStrategists',
          name: 'gtm-strategy-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:gtm-experiment-runner:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-founder',
      seller: 'svc:gtm-experiment-runner',
      serviceRef: 'svc:gtm-experiment-runner',
      // Founder signs every experiment record before downstream
      // decision-log emission — the persist / pivot / kill authority
      // cannot be delegated.
      predicate: AND(
        SchemaMatch(GtmExperimentOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['founder'] })
      ),
      // Single-amount headline (percent-of pricing meters at runtime
      // against `realisedSpendUsd`); the headline figure here is the
      // expected fee at the cap.
      amount: { amount: 3000000n, currency: 'USD' },
      // 30-day SLA — experiments take up to a month from intake to
      // founder-signed decision log.
      timeoutDays: 30,
      onTimeout: 'escalate',
    },

    pricing: Pricing.percentOf({
      basis: 'experiment-spend',
      // 15% of realised experiment spend (1500 basis points), capped
      // at $30k per experiment to keep fees economical on the long
      // tail of spend events.
      rateBasisPoints: 1500,
      cap: { amount: 3000000n, currency: 'USD' },
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 8000n, perAgentRound: 100n, perApiCall: 18n },
    reward: kr_decisionQuality,

    lineage: {
      cellRef: 'business.org.ai/cells/founders/gtm-experiment-running',
      icpContextProblemRef: 'icp:gtm-experiment-runner:v1',
      foundingHypothesisRef: 'fh:gtm-experiment-runner:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
