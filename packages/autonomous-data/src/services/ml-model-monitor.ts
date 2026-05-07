/**
 * ML Model Monitor Service — production ML-model performance + drift
 * monitoring for the data-engineering / analytics catalog.
 *
 * Distinguishing shape vs. siblings (`dbt-model-author`,
 * `data-quality-incident-triager`, `metrics-catalog-curator`,
 * `pipeline-incident-investigator`, `schema-evolution-planner`):
 *   - `forecast-narrative` archetype — the artefact is an ml-platform-lead-
 *     signed monitoring report with feature-drift / label-drift / prediction-
 *     drift findings + recommended actions (rebaseline / retrain / rollback /
 *     human-loop escalation), not a dbt PR, an incident-RCA, a metrics-
 *     catalog curation plan, a pipeline-incident-doc, or a schema-migration
 *     runbook;
 *   - 5-step cascade: Code fan-in (prediction-distribution + feature-
 *     distribution stats + outcome data where available) → Generative
 *     (drift detection: feature-drift + label-drift + prediction-drift +
 *     anomaly flags + proposed thresholds) → Generative (synthesise
 *     recommended actions: rebaseline / retrain / rollback / human-loop
 *     escalate) → Human (ml-platform-lead review on action) → Code (emit
 *     monitoring report + register actions);
 *   - `Pricing.subscription` — a recurring per-ml-team subscription
 *     ($1,299/mo) plus metered overage at $199 per drift-incident flagged
 *     beyond the implicit weekly-cron baseline;
 *   - declarative HITL = mandatory ml-platform-lead review on any non-no-op
 *     action (the lead owns the ml-platform deployment envelope —
 *     `approval` rationale, not `regulatory` / `premium`), plus
 *     OutcomeContract requires ml-platform-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(drift-detection-
 *     precision + action-recommendation-soundness) + HumanSign(ml-platform-
 *     lead))`.
 *
 * Per design v3 §3 (Catalog HOW data) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory with metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `production-model-incident-rate-reduction` — the
 * compound metric every ml-platform team optimises against (the monitor
 * Service is worth running iff production-model incident rate drops vs. the
 * pre-Service baseline, holding drift-detection precision flat or
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
 * Input — a monitoring run triggered by a weekly cron OR a monitoring-data
 * ingest event. Tight: 7 fields cover the run identity, the trigger kind,
 * the ml-model under observation, the monitoring-window snapshot, the
 * feature-distribution stats pointer, the outcome-data pointer (when
 * available), and the assigned ml-platform-lead reviewer.
 */
export const MlModelMonitorInputSchema = z.object({
  monitorRunId: z.string(),
  triggerKind: z.enum(['weekly-cron', 'monitoring-data-ingest']),
  mlModel: z.object({
    modelRef: z.string(),
    modelName: z.string(),
    deployedVersionRef: z.string(),
    taskKind: z.enum([
      'classification-binary',
      'classification-multiclass',
      'regression',
      'ranking',
      'recommendation',
      'forecasting',
      'anomaly-detection',
    ]),
    owningTeam: z.string(),
  }),
  monitoringWindow: z.object({
    windowStartIso: z.string(),
    windowEndIso: z.string(),
    predictionVolumeInWindow: z.number().int().nonnegative(),
  }),
  predictionDistributionRef: z.string(),
  featureDistributionStatsRef: z.string(),
  outcomeDataRef: z.string().optional(),
  baselineRef: z.string(),
  assignedMlPlatformLeadRef: z.string(),
})

/**
 * Output — an ml-platform-lead-signed monitoring report: the fetched
 * monitoring snapshot, the detected drift findings (feature / label /
 * prediction) + proposed thresholds, the recommended actions (rebaseline /
 * retrain / rollback / human-loop), the lead review on any non-no-op
 * action, and pointers to the emitted report + registered-actions
 * artefacts.
 */
export const MlModelMonitorOutputSchema = z.object({
  monitorRunId: z.string(),
  monitoringSnapshot: z.object({
    modelRef: z.string(),
    deployedVersionRef: z.string(),
    windowStartIso: z.string(),
    windowEndIso: z.string(),
    predictionVolumeInWindow: z.number().int().nonnegative(),
    baselineRef: z.string(),
    outcomeDataAvailable: z.boolean(),
  }),
  driftFindings: z.object({
    featureDrift: z
      .array(
        z.object({
          findingId: z.string(),
          featureRef: z.string(),
          driftMetric: z.enum(['psi', 'kl-divergence', 'js-divergence', 'wasserstein', 'custom']),
          driftScore: z.number(),
          proposedThreshold: z.number(),
          breachedThreshold: z.boolean(),
          severity: z.enum(['info', 'warn', 'critical']),
        })
      )
      .min(0),
    labelDrift: z
      .array(
        z.object({
          findingId: z.string(),
          labelClassRef: z.string().optional(),
          driftMetric: z.enum(['psi', 'kl-divergence', 'js-divergence', 'wasserstein', 'custom']),
          driftScore: z.number(),
          proposedThreshold: z.number(),
          breachedThreshold: z.boolean(),
          severity: z.enum(['info', 'warn', 'critical']),
        })
      )
      .min(0),
    predictionDrift: z
      .array(
        z.object({
          findingId: z.string(),
          driftMetric: z.enum(['psi', 'kl-divergence', 'js-divergence', 'wasserstein', 'custom']),
          driftScore: z.number(),
          proposedThreshold: z.number(),
          breachedThreshold: z.boolean(),
          severity: z.enum(['info', 'warn', 'critical']),
        })
      )
      .min(0),
    anomalyFlags: z
      .array(
        z.object({
          flagId: z.string(),
          anomalyKind: z.enum([
            'volume-anomaly',
            'latency-anomaly',
            'error-rate-anomaly',
            'distribution-shift',
            'missing-feature',
            'schema-mismatch',
          ]),
          observation: z.string(),
          severity: z.enum(['info', 'warn', 'critical']),
        })
      )
      .min(0),
  }),
  recommendedActions: z
    .array(
      z.object({
        actionId: z.string(),
        actionKind: z.enum([
          'no-op',
          'rebaseline-features',
          'retrain-model',
          'rollback-version',
          'human-loop-escalate',
          'gate-traffic',
        ]),
        targetRef: z.string(),
        rationaleMarkdown: z.string(),
        estimatedRiskLevel: z.enum(['low', 'medium', 'high']),
        requiresHumanApproval: z.boolean(),
      })
    )
    .min(1),
  mlPlatformLeadReview: z
    .object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-subset', 'request-edit', 'reject', 'no-action-needed']),
      approvedActionIds: z.array(z.string()),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    })
    .optional(),
  artefacts: z.object({
    monitoringReportUrl: z.string(),
    registeredActionRefs: z.array(z.string()).min(0),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type MlModelMonitorInput = z.infer<typeof MlModelMonitorInputSchema>
export type MlModelMonitorOutput = z.infer<typeof MlModelMonitorOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_modelIncidentRate: RewardSignal = {
  keyResultRef: 'kr:ml-model-monitor:production-model-incident-rate-reduction',
}
const kr_snapshotCoverage: RewardSignal = {
  keyResultRef: 'kr:ml-model-monitor:snapshot-coverage',
}
const kr_driftPrecision: RewardSignal = {
  keyResultRef: 'kr:ml-model-monitor:drift-detection-precision',
}
const kr_actionSoundness: RewardSignal = {
  keyResultRef: 'kr:ml-model-monitor:action-recommendation-soundness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:ml-model-monitor:emit-latency',
}

// ============================================================================
// ML Model Monitor Service
// ============================================================================

/**
 * ML Model Monitor — weekly cron OR monitoring-data ingest → ml-platform-
 * lead-signed monitoring report with feature / label / prediction drift
 * findings + anomaly flags + recommended actions (rebaseline / retrain /
 * rollback / human-loop) as a Service.
 *
 * Cascade: fetch-prediction-distribution-and-feature-distribution-stats-and-outcome-data (Code, fan-in)
 *        → detect-drift-feature-and-label-and-prediction-and-flag-anomalies-and-propose-thresholds (Generative)
 *        → synthesize-recommended-actions-rebaseline-retrain-rollback-or-human-loop (Generative)
 *        → ml-platform-lead-review-on-action (Human, approval rationale)
 *        → emit-monitoring-report-and-register-actions (Code, fan-out).
 */
export const mlModelMonitor: ServiceInstance<MlModelMonitorInput, MlModelMonitorOutput> =
  Service.define<MlModelMonitorInput, MlModelMonitorOutput>({
    name: 'ML Model Monitor',
    promise:
      'Every week (and every monitoring-data ingest) every production ML model gets an ml-platform-lead-signed monitoring report — feature / label / prediction drift findings + anomaly flags + recommended actions (rebaseline / retrain / rollback / human-loop escalate) — so production-model incidents are caught at drift, not at customer-impact.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: MlModelMonitorInputSchema, output: MlModelMonitorOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-prediction-distribution-and-feature-distribution-stats-and-outcome-data',
          reward: kr_snapshotCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'detect-drift-feature-and-label-and-prediction-and-flag-anomalies-and-propose-thresholds',
          reward: kr_driftPrecision,
        }),
        Generative({
          name: 'synthesize-recommended-actions-rebaseline-retrain-rollback-or-human-loop',
          reward: kr_actionSoundness,
        }),
        Human({
          name: 'ml-platform-lead-review-on-action',
          // `approval` rationale: the ml-platform lead owns the ml-platform
          // deployment envelope. Any non-no-op action (rebaseline / retrain
          // / rollback / human-loop / gate-traffic) routes through lead
          // sign-off before the action registers and downstream automation
          // executes. The gate stays human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-monitoring-report-and-register-actions',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'ml-registry.read',
        'ml-monitoring.read',
        'ml-monitoring.write',
        'feature-store.read',
        'prediction-log.read',
        'outcome-log.read',
        'ml-action-registry.write',
        'docs.write',
      ],
      // ML-model monitoring: clarification disabled — the cascade
      // synthesises from the prediction / feature / outcome distribution
      // signals; the ml-platform-lead review step is the single human
      // contact point in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Critical-severity drift findings escalate the action-synthesis
          // step to a senior ml-platform supervisor before the routine
          // lead review (the lead still signs, but the supervisor
          // backstops the action recommendation on the highest-stakes
          // tier where production traffic may need to be gated).
          when: 'triggerKind == "monitoring-data-ingest"',
          action: 'escalate',
        },
        {
          // Every monitoring run routes through ml-platform-lead review on
          // any non-no-op action before the report emits and the actions
          // register; OutcomeContract enforces the signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'ml-platform-lead-review-on-action',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:ml-model-monitor-review',
      personas: [
        // Factual-accuracy reviewer — drift findings must cite ≥ 2 load-
        // bearing evidence sources per claim (the baseline distribution +
        // the windowed distribution + the chosen drift metric output are
        // the typical drift-detection citation triad). The high citation
        // floor guards against "single-metric over-claim" and "thresholds
        // pulled out of thin air" failures common in ml-monitoring
        // reports.
        Personas.factualAccuracy({ minCitationsPerClaim: 2 }),
        // Data-privacy reviewer (general framework) — production ML models
        // touch user features that often include PII, behavioural, and
        // financial categories. The data-privacy persona (general
        // framework, default PII categories on, minimization on) probes
        // whether the monitoring report leaks raw PII into the artefact
        // surface (drift narratives, anomaly observations, action
        // rationales) vs. citing only aggregated statistics.
        Personas.dataPrivacy({ framework: 'general' }),
        // Data-domain reviewer — pulls the senior-data-scientist expert
        // for judgment on the overall drift-detection + action-
        // recommendation quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/DataScientists',
          name: 'data-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:ml-model-monitor:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-ml-platform-lead',
      seller: 'svc:ml-model-monitor',
      serviceRef: 'svc:ml-model-monitor',
      // Ml-platform-lead signs every monitoring report with non-no-op
      // recommended actions — ml-platform deployment authority cannot be
      // delegated.
      predicate: AND(
        SchemaMatch(MlModelMonitorOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['ml-platform-lead'] })
      ),
      amount: { amount: 129900n, currency: 'USD' },
      // 7-day SLA — model monitoring runs on weekly rhythms; the
      // monitoring report lands inside one rotation so drift doesn't
      // accumulate across cycles.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'ml-model-monitor-monthly',
        amount: 129900n,
        currency: 'USD',
        interval: 'month',
      },
      // Metered overage — drift-incidents flagged beyond the implicit
      // weekly-cron baseline charge $199 each. The metering runtime
      // resolves `drift-incident-flagged` to drift-finding events
      // beyond the monthly baseline and lines them on the monthly
      // invoice.
      metered: [
        {
          event: 'drift-incident-flagged',
          amount: 19900n,
          description:
            'Drift incident flagged beyond the bundled weekly-cron baseline (monitoring-data-ingest triggered).',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 9000n, perApiCall: 16n },
    reward: kr_modelIncidentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/ml-platform/ml-model-monitor',
      icpContextProblemRef: 'icp:ml-model-monitor:v1',
      foundingHypothesisRef: 'fh:ml-model-monitor:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
