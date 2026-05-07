/**
 * Talent Pipeline Quality Monitor Service — pipeline-quality / DEI signals
 * monitor for the people / HR catalog.
 *
 * Distinguishing shape vs. siblings (`hiring-loop-coordinator`,
 * `performance-review-narrator`, `org-design-impact-modeler`,
 * `compensation-band-analyst`, `candidate-experience-evaluator`):
 *   - `forecast-narrative` archetype — the artefact is a head-of-talent +
 *     people-leadership-signed pipeline-health report (anomaly detections
 *     + drop-off patterns + sourcing-mix drift + prioritised
 *     recommendations + mitigation options), not an offer recommendation,
 *     a candidate-feedback report, an interview-loop schedule, a quarterly
 *     review packet, or an org-design impact memo;
 *   - 5-step cascade: Code fan-in (pipeline funnel + source mix + DEI
 *     signals + benchmark data) → Generative (detect anomalies + drop-off
 *     patterns + sourcing-mix drift) → Generative (synthesise
 *     recommendations with priority + mitigation options) → Human (head-
 *     of-talent + people-leadership review) → Code (emit pipeline-health
 *     report);
 *   - `Pricing.subscription` with metered overage — recurring people-team
 *     subscription ($799/mo) plus metered overage at $99 per `pipeline-
 *     anomaly-flagged` event, because a noisy pipeline week (M&A, layoff
 *     adjacency, market shift) generates more flagged anomalies than a
 *     baseline week and the per-anomaly synthesis is the load-bearing work;
 *   - declarative HITL = mandatory head-of-talent + people-leadership
 *     review Human Function (the people-leader signs because pipeline
 *     decisions ripple into headcount budget + DEI commitments — uses
 *     `'approval'` rationale because the report drives team-level
 *     intervention, not individual feedback), plus OutcomeContract
 *     requires head-of-talent signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(anomaly-precision
 *     + recommendation-actionability) + HumanSign(head-of-talent))`;
 *   - EvaluatorPanel includes `Personas.regulatoryCompliance({ regulator:
 *     'sox' })` because pipeline + DEI signals feed audit trails that SOX
 *     internal controls audit, `Personas.dataPrivacy({ framework:
 *     'general' })` because aggregated DEI data must respect data-
 *     minimization (no individual identification from small-cohort cells),
 *     and `Personas.factualAccuracy({ minCitationsPerClaim: 2 })` because
 *     every anomaly call must be backed by at least two corroborating data
 *     points to qualify as a signal vs. a single-cohort artifact.
 *
 * Per design v3 §3 (Catalog HOW people) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory + metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `time-to-fill-and-pipeline-diversity-score` — the
 * compound metric every TA / people-leader optimises against (the monitor
 * is worth running iff time-to-fill drops vs. the pre-Service baseline AND
 * pipeline-diversity scores hold or improve).
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
 * Input — a weekly cron fires, OR a sourcing-rotation event lands. Tight: 7
 * fields cover the trigger kind, the window the synthesis runs over, the
 * assigned head-of-talent + people-leadership reviewers (Human review
 * routing), the role-family scope, the geo scope, the pipeline-system
 * source, and the benchmark provenance.
 */
export const PipelineMonitorTriggerInputSchema = z.object({
  triggerKind: z.enum(['weekly-cron', 'sourcing-rotation']),
  windowFromDate: z.string(), // ISO-8601
  windowToDate: z.string(), // ISO-8601
  assignedHeadOfTalentRef: z.string(),
  assignedPeopleLeadershipRef: z.string(),
  roleFamilyScope: z.array(z.string()).min(1),
  geoScope: z.array(z.string()).min(1),
  pipelineSystem: z.enum(['greenhouse', 'lever', 'ashby', 'workday-recruiting', 'gem']),
  benchmarkProvenance: z.enum(['industry-standard', 'first-party', 'tenant-internal']),
})

/**
 * Output — a head-of-talent + people-leadership-signed pipeline-health
 * report: the funnel snapshot, the detected anomalies (with citations),
 * the drop-off patterns, the sourcing-mix drift, the prioritised
 * recommendations + mitigation options, the dual review audit, and
 * pointers to the emitted report artefact.
 */
export const PipelineHealthReportOutputSchema = z.object({
  windowFromDate: z.string(),
  windowToDate: z.string(),
  funnelSnapshot: z.object({
    sourcedCount: z.number().int().nonnegative(),
    screenedCount: z.number().int().nonnegative(),
    onsiteCount: z.number().int().nonnegative(),
    offerCount: z.number().int().nonnegative(),
    acceptedCount: z.number().int().nonnegative(),
    perStageConversion: z.array(
      z.object({
        fromStage: z.string(),
        toStage: z.string(),
        conversionRate: z.number().min(0).max(1),
      })
    ),
  }),
  anomalies: z
    .array(
      z.object({
        anomaly: z.string(),
        signalKind: z.enum([
          'funnel-conversion-drop',
          'sourcing-mix-drift',
          'dei-signal-shift',
          'time-in-stage-spike',
          'rejection-reason-cluster',
        ]),
        severity: z.enum(['low', 'medium', 'high']),
        affectedRoleFamily: z.string(),
        evidenceCitations: z.array(z.string()).min(2),
        narrative: z.string(),
      })
    )
    .default([]),
  dropOffPatterns: z
    .array(
      z.object({
        atStage: z.string(),
        dropOffRate: z.number().min(0).max(1),
        comparedToBenchmark: z.number(),
        suspectedRootCauses: z.array(z.string()).min(1),
      })
    )
    .default([]),
  sourcingMixDrift: z.object({
    perSourceShare: z.array(
      z.object({
        sourceChannel: z.string(),
        shareCurrent: z.number().min(0).max(1),
        sharePriorWindow: z.number().min(0).max(1),
        delta: z.number(),
      })
    ),
    summaryNarrative: z.string(),
  }),
  recommendations: z
    .array(
      z.object({
        recommendation: z.string(),
        targetAnomalyRef: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']),
        ownerRef: z.string(),
        mitigationOptions: z.array(z.string()).min(1),
        successCriteria: z.string(),
      })
    )
    .min(1),
  reviewAudit: z.object({
    headOfTalentRef: z.string(),
    peopleLeadershipRef: z.string(),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    signedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    reportUrl: z.string(),
    dashboardSnapshotRef: z.string().optional(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PipelineMonitorTriggerInput = z.infer<typeof PipelineMonitorTriggerInputSchema>
export type PipelineHealthReportOutput = z.infer<typeof PipelineHealthReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToFillAndDiversity: RewardSignal = {
  keyResultRef: 'kr:talent-pipeline-quality-monitor:time-to-fill-and-pipeline-diversity-score',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:talent-pipeline-quality-monitor:signal-coverage',
}
const kr_anomalyPrecision: RewardSignal = {
  keyResultRef: 'kr:talent-pipeline-quality-monitor:anomaly-precision',
}
const kr_recommendationActionability: RewardSignal = {
  keyResultRef: 'kr:talent-pipeline-quality-monitor:recommendation-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:talent-pipeline-quality-monitor:emit-latency',
}

// ============================================================================
// Talent Pipeline Quality Monitor Service
// ============================================================================

/**
 * Talent Pipeline Quality Monitor — weekly-cron + sourcing-rotation trigger
 * → head-of-talent + people-leadership-signed pipeline-health report
 * (anomalies + drop-off patterns + sourcing-mix drift + prioritised
 * recommendations + mitigation options) as a Service.
 *
 * Cascade: fetch-pipeline-funnel-source-mix-dei-signals-and-benchmark-data (Code, fan-in)
 *        → detect-anomalies-drop-off-patterns-and-sourcing-mix-drift (Generative)
 *        → synthesize-recommendations-with-priority-and-mitigation-options (Generative)
 *        → head-of-talent-and-people-leadership-review (Human, approval rationale)
 *        → emit-pipeline-health-report (Code, fan-out).
 */
export const talentPipelineQualityMonitor: ServiceInstance<
  PipelineMonitorTriggerInput,
  PipelineHealthReportOutput
> = Service.define<PipelineMonitorTriggerInput, PipelineHealthReportOutput>({
  name: 'Talent Pipeline Quality Monitor',
  promise:
    'Every week (and every sourcing-rotation), the people org gets a head-of-talent + people-leadership-signed pipeline-health report — anomalies + drop-off patterns + sourcing-mix drift + prioritised recommendations — so time-to-fill drops without the diversity-of-pipeline regressing.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: PipelineMonitorTriggerInputSchema,
    output: PipelineHealthReportOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-pipeline-funnel-source-mix-dei-signals-and-benchmark-data',
        reward: kr_signalCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'detect-anomalies-drop-off-patterns-and-sourcing-mix-drift',
        reward: kr_anomalyPrecision,
      }),
      Generative({
        name: 'synthesize-recommendations-with-priority-and-mitigation-options',
        reward: kr_recommendationActionability,
      }),
      Human({
        name: 'head-of-talent-and-people-leadership-review',
        // `approval` rationale: the people-leader signs because pipeline
        // decisions ripple into headcount budget + DEI commitments —
        // sign-off cannot be delegated.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-pipeline-health-report',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'greenhouse.pipeline',
      'lever.pipeline',
      'ashby.pipeline',
      'workday-recruiting.funnel',
      'gem.sourcing',
      'benchmark.market-funnel',
      'docs.write',
      'pdf.render',
      'dashboard.snapshot',
    ],
    // Pipeline monitor: clarification disabled — the cascade synthesises
    // from funnel + source-mix + DEI + benchmark data; the dual review
    // step is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Sourcing-rotation triggers escalate the anomaly-detection step
        // to a senior people-business-partner supervisor before the dual
        // review (rotation events compound the noise floor and false-
        // positive risk).
        when: 'triggerKind == "sourcing-rotation"',
        action: 'escalate',
      },
      {
        // Every report routes through head-of-talent + people-leadership
        // review before it emits; OutcomeContract enforces the signature,
        // the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'head-of-talent-and-people-leadership-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:talent-pipeline-quality-monitor-review',
    personas: [
      // SOX-controls reviewer — regulator-tier persona that enforces SOX
      // internal-controls requirements on the pipeline + DEI audit trails
      // (pipeline decisions feed headcount budget controls).
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-controls-reviewer',
      }),
      // Data-privacy reviewer — privacy persona enforcing data-
      // minimization on the aggregated DEI signals (no individual
      // identification from small-cohort cells, no PII leakage in the
      // narrative).
      Personas.dataPrivacy({
        framework: 'general',
        name: 'data-privacy-reviewer',
      }),
      // Anomaly-precision reviewer — fact-grounding persona requiring at
      // least 2 corroborating data citations per anomaly call. A signal
      // isn't a signal until it appears across multiple cohorts — single-
      // cohort spikes get filtered as noise.
      Personas.factualAccuracy({
        minCitationsPerClaim: 2,
        name: 'anomaly-precision-checker',
      }),
      // Recommendation-actionability reviewer — adversarially probes
      // whether each recommendation has named mitigation options + an
      // owner + success criteria + a priority justified by the anomaly
      // severity (vs. vague "improve sourcing" hand-waves).
      Personas.skeptic({
        domain: 'recommendation-actionability',
        focus: [
          'mitigation-options-named',
          'owner-assigned',
          'priority-justified-by-anomaly-severity',
          'no-vague-hand-waves',
        ],
        name: 'recommendation-actionability-reviewer',
      }),
      // HR domain reviewer — pulls the senior-talent-partner expert for
      // judgment on the overall pipeline-health-report quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/HumanResourcesManagers',
        name: 'people-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:talent-pipeline-quality-monitor:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-head-of-talent',
    seller: 'svc:talent-pipeline-quality-monitor',
    serviceRef: 'svc:talent-pipeline-quality-monitor',
    // Head-of-talent signs every report before it emits — pipeline-
    // health authority cannot be delegated; the people-leadership co-
    // sign captures the headcount-budget ripple.
    predicate: AND(
      SchemaMatch(PipelineHealthReportOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['head-of-talent'] })
    ),
    amount: { amount: 79900n, currency: 'USD' },
    // 7-day SLA — weekly cohort report should land before the next week's
    // sourcing rotation kicks off.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'talent-pipeline-quality-monitor-monthly',
      amount: 79900n,
      currency: 'USD',
      interval: 'month',
    },
    // Metered overage — pipeline-anomaly-flagged events above the
    // baseline charge $99 each. A noisy pipeline week (M&A, layoff
    // adjacency, market shift) generates more flagged anomalies than a
    // baseline week and the per-anomaly synthesis is the load-bearing
    // work the subscription amortises.
    metered: [
      {
        event: 'pipeline-anomaly-flagged',
        amount: 9900n,
        description: 'Pipeline anomaly flagged above the baseline weekly cohort.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 5500n, perApiCall: 14n },
  reward: kr_timeToFillAndDiversity,

  lineage: {
    cellRef: 'business.org.ai/cells/human-resources-managers/talent-pipeline-quality-monitor',
    icpContextProblemRef: 'icp:talent-pipeline-quality-monitor:v1',
    foundingHypothesisRef: 'fh:talent-pipeline-quality-monitor:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
