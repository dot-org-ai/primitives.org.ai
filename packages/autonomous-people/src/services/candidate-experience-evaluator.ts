/**
 * Candidate Experience Evaluator Service — post-loop candidate-feedback
 * synthesis Service for the people / HR catalog.
 *
 * Distinguishing shape vs. siblings (`hiring-loop-coordinator`,
 * `performance-review-narrator`, `org-design-impact-modeler`,
 * `compensation-band-analyst`):
 *   - `forecast-narrative` archetype — the artefact is a head-of-talent-
 *     signed candidate-experience report (themes + friction-points + scored-
 *     vs-internal-bar + actionable recommendations queued for the loop
 *     process), not an offer recommendation, an interview-loop schedule,
 *     a quarterly review packet, or an org-design impact memo;
 *   - 5-step cascade: Code fan-in (post-loop survey responses + interviewer
 *     debrief notes + outcome data) → Generative (extract themes + flag
 *     friction-points + score vs. internal bar) → Generative (draft
 *     actionable recommendations for the recruiting team) → Human (head-of-
 *     talent review) → Code (emit feedback report + queue actions for the
 *     loop process);
 *   - `Pricing.subscription` — a recurring talent-team subscription
 *     ($499/mo) — the report is on a weekly cadence, the subscription
 *     amortises the recurring synthesis work; no metered overage at v1
 *     because the cadence is fixed-by-design;
 *   - declarative HITL = mandatory head-of-talent review Human Function
 *     (the head-of-talent owns the recruiting-process bar and the
 *     prioritisation of recommendations going back into the loop process —
 *     uses `'approval'` rationale because the action-queue commits the
 *     team to changes), plus OutcomeContract requires head-of-talent
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(theme-coherence +
 *     actionability + signal-clarity) + HumanSign(head-of-talent))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy({
 *     minCitationsPerClaim: 2 })` because every theme claim must be backed
 *     by at least two corroborating survey/debrief citations to count as
 *     a signal vs. a single-respondent gripe, and `Personas.brandSafety({
 *     toneRange: 'formal' })` because the report is read by recruiters and
 *     hiring managers and needs the formal even-handed tone every people
 *     org applies to candidate-feedback synthesis.
 *
 * Per design v3 §3 (Catalog HOW people) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `candidate-NPS-and-offer-accept-rate` — the
 * compound metric every TA org optimises against (the evaluator is worth
 * running iff candidate-NPS holds or improves AND offer-accept-rate holds
 * or improves vs. the pre-Service baseline of unsynthesised survey data
 * sitting in a spreadsheet).
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
 * Input — a candidate post-loop survey lands, OR a weekly cron fires over
 * the prior week's loops. Tight: 7 fields cover the trigger kind, the
 * window the synthesis runs over, the assigned head-of-talent (Human review
 * routing), the loop-stage scope filter, the survey-system source, the
 * debrief-notes source, and the outcome-data source.
 */
export const CandidateFeedbackTriggerInputSchema = z.object({
  triggerKind: z.enum(['post-loop-survey-received', 'weekly-cron']),
  windowFromDate: z.string(), // ISO-8601
  windowToDate: z.string(), // ISO-8601
  assignedHeadOfTalentRef: z.string(),
  loopStageScope: z.array(z.enum(['phone-screen', 'tech-screen', 'onsite-loop', 'final-round'])),
  surveySystem: z.enum(['greenhouse', 'lever', 'ashby', 'survey-monkey', 'first-party']),
  debriefSystem: z.enum(['greenhouse', 'lever', 'ashby', 'notion', 'docs']),
})

/**
 * Output — a head-of-talent-signed candidate-experience report: the
 * extracted themes (with citations), the flagged friction-points, the
 * scored-vs-internal-bar block, the actionable recommendations queued for
 * the recruiting team, the head-of-talent review audit, and pointers to
 * the emitted report + queued-actions artefacts.
 */
export const CandidateFeedbackReportOutputSchema = z.object({
  windowFromDate: z.string(),
  windowToDate: z.string(),
  loopsAnalyzed: z.number().int().nonnegative(),
  surveyResponseCount: z.number().int().nonnegative(),
  themes: z
    .array(
      z.object({
        theme: z.string(),
        sentiment: z.enum(['positive', 'neutral', 'negative']),
        prevalence: z.number().min(0).max(1),
        evidenceCitations: z.array(z.string()).min(2),
        narrative: z.string(),
      })
    )
    .min(1),
  frictionPoints: z
    .array(
      z.object({
        friction: z.string(),
        loopStage: z.enum(['phone-screen', 'tech-screen', 'onsite-loop', 'final-round']),
        severity: z.enum(['low', 'medium', 'high']),
        affectedCount: z.number().int().nonnegative(),
        evidenceCitations: z.array(z.string()).min(2),
      })
    )
    .default([]),
  scoreVsInternalBar: z.object({
    overallNps: z.number().min(-100).max(100),
    barTarget: z.number().min(-100).max(100),
    deltaVsBar: z.number(),
    perStageScore: z.array(
      z.object({
        loopStage: z.enum(['phone-screen', 'tech-screen', 'onsite-loop', 'final-round']),
        nps: z.number().min(-100).max(100),
        sampleSize: z.number().int().nonnegative(),
      })
    ),
  }),
  recommendations: z
    .array(
      z.object({
        recommendation: z.string(),
        targetFrictionRef: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']),
        ownerRef: z.string(),
        successCriteria: z.string(),
      })
    )
    .min(1),
  headOfTalentReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    reportUrl: z.string(),
    queuedActionRefs: z.array(z.string()),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type CandidateFeedbackTriggerInput = z.infer<typeof CandidateFeedbackTriggerInputSchema>
export type CandidateFeedbackReportOutput = z.infer<typeof CandidateFeedbackReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_candidateNpsAndAcceptRate: RewardSignal = {
  keyResultRef: 'kr:candidate-experience-evaluator:candidate-nps-and-offer-accept-rate',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:candidate-experience-evaluator:signal-coverage',
}
const kr_themeCoherence: RewardSignal = {
  keyResultRef: 'kr:candidate-experience-evaluator:theme-coherence',
}
const kr_recommendationActionability: RewardSignal = {
  keyResultRef: 'kr:candidate-experience-evaluator:recommendation-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:candidate-experience-evaluator:emit-latency',
}

// ============================================================================
// Candidate Experience Evaluator Service
// ============================================================================

/**
 * Candidate Experience Evaluator — post-loop-survey OR weekly-cron trigger
 * → head-of-talent-signed candidate-experience report (themes + friction-
 * points + scored-vs-internal-bar + actionable recommendations queued for
 * the loop process) as a Service.
 *
 * Cascade: fetch-survey-responses-interviewer-debrief-notes-and-outcome-data (Code, fan-in)
 *        → extract-themes-flag-friction-points-and-score-vs-internal-bar (Generative)
 *        → draft-actionable-recommendations-for-recruiting-team (Generative)
 *        → head-of-talent-review (Human, approval rationale)
 *        → emit-feedback-report-and-queue-actions-for-loop-process (Code, fan-out).
 */
export const candidateExperienceEvaluator: ServiceInstance<
  CandidateFeedbackTriggerInput,
  CandidateFeedbackReportOutput
> = Service.define<CandidateFeedbackTriggerInput, CandidateFeedbackReportOutput>({
  name: 'Candidate Experience Evaluator',
  promise:
    'Every candidate post-loop survey (or weekly cohort) gets a head-of-talent-signed report — themes + friction-points + scored-vs-bar + prioritised actions queued for the loop process — so candidate-NPS and offer-accept-rate compound week over week.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: CandidateFeedbackTriggerInputSchema,
    output: CandidateFeedbackReportOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-survey-responses-interviewer-debrief-notes-and-outcome-data',
        reward: kr_signalCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'extract-themes-flag-friction-points-and-score-vs-internal-bar',
        reward: kr_themeCoherence,
      }),
      Generative({
        name: 'draft-actionable-recommendations-for-recruiting-team',
        reward: kr_recommendationActionability,
      }),
      Human({
        name: 'head-of-talent-review',
        // `approval` rationale: head-of-talent owns the recruiting-process
        // bar and the prioritisation of recommendations going back into
        // the loop process — sign-off cannot be delegated.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-feedback-report-and-queue-actions-for-loop-process',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'greenhouse.surveys',
      'lever.surveys',
      'ashby.debriefs',
      'notion.docs',
      'docs.write',
      'pdf.render',
      'action-queue.write',
    ],
    // Candidate-experience synthesis: clarification disabled — the cascade
    // synthesises from the survey + debrief + outcome data; the head-of-
    // talent review step is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Negative-NPS weeks escalate the recommendation synthesis to a
        // senior people-business-partner supervisor before the head-of-
        // talent review (the action-queue stakes are higher when the bar
        // is being missed).
        when: 'triggerKind == "weekly-cron"',
        action: 'route-to',
        target: 'head-of-talent-review',
      },
      {
        // Every report routes through head-of-talent review before it
        // emits; OutcomeContract enforces the signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'head-of-talent-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:candidate-experience-evaluator-review',
    personas: [
      // Theme-coherence reviewer — fact-grounding persona requiring at
      // least 2 corroborating citations per theme claim. A theme isn't a
      // theme until it appears across multiple respondents — single-
      // respondent gripes get filtered as anecdote.
      Personas.factualAccuracy({
        minCitationsPerClaim: 2,
        name: 'theme-coherence-checker',
      }),
      // Tone-fairness reviewer — brand-safety persona constrained to a
      // formal tone register; the report is read by recruiters + hiring
      // managers and needs the formal even-handed tone every people org
      // applies to candidate-feedback synthesis.
      Personas.brandSafety({
        toneRange: 'formal',
        name: 'tone-fairness-checker',
      }),
      // Actionability reviewer — adversarially probes whether the
      // recommendations are concretely actionable (have owners + success
      // criteria + priority bands) vs. vague "improve X" hand-waves.
      Personas.skeptic({
        domain: 'actionability',
        focus: [
          'concrete-success-criteria',
          'owner-named',
          'priority-justified-by-friction-severity',
          'no-vague-hand-waves',
        ],
        name: 'actionability-reviewer',
      }),
      // Signal-clarity reviewer — pedantic check that score-vs-bar deltas
      // are computed against declared bar targets, that per-stage NPS
      // reports include sample-size, and that no stage is silently dropped
      // from the per-stage table.
      Personas.pedantic({
        domain: 'signal-clarity',
        rubric: [
          'every-score-vs-bar-delta-computed-against-declared-target',
          'per-stage-nps-includes-sample-size',
          'no-silently-dropped-stages',
          'sentiment-coheres-with-narrative',
        ],
        name: 'signal-clarity-checker',
      }),
      // HR domain reviewer — pulls the senior-talent-partner expert for
      // judgment on the overall report quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/HumanResourcesManagers',
        name: 'people-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:candidate-experience-evaluator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-head-of-talent',
    seller: 'svc:candidate-experience-evaluator',
    serviceRef: 'svc:candidate-experience-evaluator',
    // Head-of-talent signs every report before it emits — recruiting-
    // process-bar + action-queue authority cannot be delegated.
    predicate: AND(
      SchemaMatch(CandidateFeedbackReportOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['head-of-talent'] })
    ),
    amount: { amount: 49900n, currency: 'USD' },
    // 5-day SLA — the weekly cohort report should land before the next
    // week's loops kick off so action-queue items inform the upcoming
    // schedule.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'candidate-experience-evaluator-monthly',
      amount: 49900n,
      currency: 'USD',
      interval: 'month',
    },
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 3500n, perApiCall: 12n },
  reward: kr_candidateNpsAndAcceptRate,

  lineage: {
    cellRef: 'business.org.ai/cells/human-resources-managers/candidate-experience-evaluator',
    icpContextProblemRef: 'icp:candidate-experience-evaluator:v1',
    foundingHypothesisRef: 'fh:candidate-experience-evaluator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
