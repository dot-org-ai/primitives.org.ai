/**
 * Pipeline Incident Investigator Service — data-pipeline failure investigation
 * + RCA + backfill recommendation for the data-engineering / analytics
 * catalog.
 *
 * Distinguishing shape vs. siblings (`dbt-model-author`,
 * `data-quality-incident-triager`, `metrics-catalog-curator`,
 * `schema-evolution-planner`, `ml-model-monitor`):
 *   - `multi-step-research` archetype — the artefact is a data-platform-lead-
 *     signed incident-doc with a backfill recommendation, not a dbt PR, an
 *     RCA on a data-quality alert, a metrics-catalog curation plan, a schema-
 *     migration runbook, or an ML drift report;
 *   - 6-step cascade with one supervised Agentic source-system + recent-
 *     deploys + correlated-pipelines investigation step — the cascade is
 *     bookended by Code fan-in (pipeline-graph + recent-runs + upstream
 *     dependency status), Generative classification of failure-mode (source-
 *     failure / transformation-error / sla-miss / capacity / config-drift),
 *     Generative synthesis of the RCA + mitigation plan + backfill
 *     recommendation, a data-platform-lead Human review gate, and Code fan-
 *     out (incident-doc + tracking-ticket);
 *   - `Pricing.perInvocation` 3 tiers keyed on declared SLA-impact tier — P3
 *     / P2 / P1 ($149 / $599 / $2,499) — a single non-critical pipeline lag
 *     is worth less than a propagated cross-pipeline breakage that fans out
 *     into executive-tier dashboards or revenue-critical reverse-etl jobs;
 *   - declarative HITL = mandatory data-platform-lead review (the lead owns
 *     the data-platform incident-response envelope — `approval` rationale,
 *     not `regulatory` / `premium`), plus OutcomeContract requires data-
 *     platform-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(rca-quality +
 *     backfill-soundness) + HumanSign(data-platform-lead))`.
 *
 * Per design v3 §3 (Catalog HOW data) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `pipeline-incident-mean-time-to-resolution-
 * improvement` — the compound metric every data-platform team optimises
 * against (the investigator Service is worth running iff pipeline-incident
 * MTTR drops vs. the pre-Service baseline, holding RCA-quality flat or
 * improving).
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
 * Input — a pipeline-failure alert firing from one of the standard
 * orchestration / ingestion surfaces (Airflow, Dagster, dbt-cloud, Fivetran,
 * Singer) plus the affected pipeline + run pointers. Tight: 7 fields cover
 * the incident identity, the firing alert, the declared SLA-impact tier
 * (so the per-invocation tier is resolvable at intake), the affected
 * pipeline + run, the on-call data-platform lead routing target, and the
 * cross-channel status surfaces the incident-doc fan-out updates.
 */
export const PipelineIncidentAlertInputSchema = z.object({
  incidentId: z.string(),
  firingAlert: z.object({
    alertName: z.string(),
    alertSource: z.enum(['airflow', 'dagster', 'dbt-cloud', 'fivetran', 'singer', 'custom']),
    firedAt: z.string(), // ISO-8601
    failureKind: z.enum([
      'task-failure',
      'sla-miss',
      'retry-exhausted',
      'upstream-unavailable',
      'capacity-exhausted',
      'config-drift',
      'unknown',
    ]),
    detail: z.string(),
  }),
  declaredSlaImpactTier: z.enum(['P3', 'P2', 'P1']),
  affectedPipeline: z.object({
    pipelineRef: z.string(),
    runRef: z.string(),
    runStartedAt: z.string(),
    upstreamPipelineRefs: z.array(z.string()).default([]),
    downstreamPipelineRefs: z.array(z.string()).default([]),
  }),
  recentDeployRefs: z.array(z.string()).default([]),
  assignedDataPlatformLeadRef: z.string(),
  statusSurfaces: z.object({
    slackChannel: z.string(),
    incidentTrackerRef: z.string(),
    consumerNotificationChannelRefs: z.array(z.string()).default([]),
  }),
})

/**
 * Output — a data-platform-lead-signed incident doc + backfill
 * recommendation: the fetched-context snapshot, the failure-classification,
 * the source-system + recent-deploys + correlated-pipelines investigation
 * findings, the RCA + mitigation plan, the backfill recommendation, the
 * data-platform-lead review audit, and pointers to the emitted incident-doc
 * + tracking-ticket artefacts.
 */
export const PipelineIncidentRcaOutputSchema = z.object({
  incidentId: z.string(),
  contextSnapshot: z.object({
    pipelineGraph: z.object({
      pipelineRef: z.string(),
      upstreamDependencyStatuses: z
        .array(
          z.object({
            upstreamRef: z.string(),
            statusKind: z.enum(['healthy', 'lagging', 'failing', 'unknown']),
            lastSuccessAt: z.string().optional(),
          })
        )
        .min(0),
      downstreamConsumers: z
        .array(
          z.object({
            consumerKind: z.enum([
              'pipeline',
              'dashboard',
              'reverse-etl',
              'ml-feature',
              'api',
              'export',
            ]),
            consumerRef: z.string(),
            consumerOwningTeam: z.string(),
          })
        )
        .min(0),
    }),
    recentRuns: z
      .array(
        z.object({
          runRef: z.string(),
          startedAt: z.string(),
          finishedAt: z.string().optional(),
          statusKind: z.enum(['success', 'failure', 'running', 'cancelled']),
        })
      )
      .min(0),
    recentDeploys: z
      .array(
        z.object({
          deployRef: z.string(),
          deployKind: z.enum([
            'pipeline-config',
            'transformation-code',
            'infrastructure',
            'connector-version',
          ]),
          landedAt: z.string(),
        })
      )
      .min(0),
  }),
  failureClassification: z.object({
    failureKind: z.enum([
      'source-failure',
      'transformation-error',
      'sla-miss',
      'capacity',
      'config-drift',
      'unknown',
    ]),
    blastRadiusDescription: z.string(),
    confidenceScore: z.number().min(0).max(1),
  }),
  investigationFindings: z
    .array(
      z.object({
        findingId: z.string(),
        sourceSystemRef: z.string().optional(),
        deployRef: z.string().optional(),
        correlatedPipelineRef: z.string().optional(),
        observation: z.string(),
        relevanceRationale: z.string(),
      })
    )
    .min(0),
  rcaNarrative: z.object({
    summaryMarkdown: z.string(),
    rootCauseHypothesis: z.string(),
    contributingFactors: z.array(z.string()).min(0),
    evidenceCitations: z.array(z.string()).min(2),
  }),
  mitigationPlan: z.object({
    summary: z.string(),
    actions: z
      .array(
        z.object({
          actionId: z.string(),
          description: z.string(),
          ownerRef: z.string(),
          estimatedTimeToMitigateMinutes: z.number().int().nonnegative(),
          requiresHumanApproval: z.boolean(),
        })
      )
      .min(1),
  }),
  backfillRecommendation: z.object({
    summaryMarkdown: z.string(),
    backfillRequired: z.boolean(),
    backfillStrategy: z
      .enum(['full-refresh', 'incremental-window', 'targeted-partition', 'no-backfill'])
      .optional(),
    backfillWindowStart: z.string().optional(),
    backfillWindowEnd: z.string().optional(),
    estimatedRunMinutes: z.number().int().nonnegative().optional(),
    blockingDownstreamRefs: z.array(z.string()).default([]),
  }),
  dataPlatformLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-subset', 'request-edit', 'reject']),
    approvedActionIds: z.array(z.string()),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  artefacts: z.object({
    incidentDocUrl: z.string(),
    trackingTicketRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PipelineIncidentAlertInput = z.infer<typeof PipelineIncidentAlertInputSchema>
export type PipelineIncidentRcaOutput = z.infer<typeof PipelineIncidentRcaOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_pipelineIncidentMttr: RewardSignal = {
  keyResultRef:
    'kr:pipeline-incident-investigator:pipeline-incident-mean-time-to-resolution-improvement',
}
const kr_contextCoverage: RewardSignal = {
  keyResultRef: 'kr:pipeline-incident-investigator:context-coverage',
}
const kr_classificationAccuracy: RewardSignal = {
  keyResultRef: 'kr:pipeline-incident-investigator:classification-accuracy',
}
const kr_investigationCoverage: RewardSignal = {
  keyResultRef: 'kr:pipeline-incident-investigator:investigation-coverage',
}
const kr_rcaQuality: RewardSignal = {
  keyResultRef: 'kr:pipeline-incident-investigator:rca-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:pipeline-incident-investigator:emit-latency',
}

// ============================================================================
// Pipeline Incident Investigator Service
// ============================================================================

/**
 * Pipeline Incident Investigator — orchestration / ingestion task-failure
 * alert (Airflow / Dagster / dbt-cloud / Fivetran / Singer) → data-platform-
 * lead-signed incident-doc + RCA + backfill recommendation as a Service.
 *
 * Cascade: fetch-pipeline-graph-and-recent-runs-and-upstream-dependency-status (Code, fan-in)
 *        → classify-failure-mode (Generative)
 *        → supervised-investigate-source-system-and-recent-deploys-and-correlated-pipelines (Agentic, supervised)
 *        → draft-RCA-with-mitigation-plan-and-backfill-recommendation (Generative)
 *        → data-platform-lead-review (Human, approval rationale)
 *        → emit-incident-doc-and-create-tracking-ticket (Code, fan-out).
 */
export const pipelineIncidentInvestigator: ServiceInstance<
  PipelineIncidentAlertInput,
  PipelineIncidentRcaOutput
> = Service.define<PipelineIncidentAlertInput, PipelineIncidentRcaOutput>({
  name: 'Pipeline Incident Investigator',
  promise:
    'Every pipeline-failure alert lands a data-platform-lead-signed incident doc + RCA + backfill recommendation within hours — failure-mode classification + correlated-pipelines investigation + concrete mitigation actions + backfill window — so MTTR is bounded by the lead review, not the manual triage backlog.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: PipelineIncidentAlertInputSchema, output: PipelineIncidentRcaOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-pipeline-graph-and-recent-runs-and-upstream-dependency-status',
        reward: kr_contextCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'classify-failure-mode',
        reward: kr_classificationAccuracy,
      }),
      Agentic({
        name: 'supervised-investigate-source-system-and-recent-deploys-and-correlated-pipelines',
        reward: kr_investigationCoverage,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'draft-RCA-with-mitigation-plan-and-backfill-recommendation',
        reward: kr_rcaQuality,
      }),
      Human({
        name: 'data-platform-lead-review',
        // `approval` rationale: the data-platform lead owns the data-
        // platform incident-response envelope — every RCA + mitigation +
        // backfill recommendation routes through lead sign-off before
        // mitigation actions deploy and the backfill kicks off. The gate
        // stays human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-incident-doc-and-create-tracking-ticket',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'airflow.read',
      'dagster.read',
      'dbt-cloud.read',
      'fivetran.read',
      'singer.read',
      'pipeline-graph.read',
      'pipeline-deploys.read',
      'lineage-graph.read',
      'warehouse.metadata',
      'warehouse.query',
      'source-systems.read',
      'incident-tracker.write',
      'slack.messages',
      'docs.write',
    ],
    // Pipeline-incident triage: clarification disabled — the cascade
    // synthesises from the firing alert + pipeline-graph slice + recent-
    // run / deploy signals; the data-platform lead review step is the
    // single human contact point during the incident.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // P1 incidents escalate the failure-mode classification + RCA +
        // backfill synthesis to a senior data-platform supervisor before
        // the routine lead review (the lead still signs, but the supervisor
        // backstops the synthesis quality on the highest-stakes tier).
        when: 'declaredSlaImpactTier == "P1"',
        action: 'escalate',
      },
      {
        // Every incident routes through data-platform-lead review before
        // the incident doc emits and the tracking ticket fans out;
        // OutcomeContract enforces the signature, the trigger primes the
        // queue.
        when: 'true',
        action: 'route-to',
        target: 'data-platform-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:pipeline-incident-investigator-review',
    personas: [
      // Regression-risk reviewer (config) — the most common pipeline-
      // incident root cause is config-drift on a recent deploy: a connector
      // version bump, an Airflow DAG-config tweak, a Fivetran schema-config
      // change. The regression-risk persona (changeType `config`) probes
      // the investigation findings + RCA for blast-radius clarity and a
      // rollback path on every config-driven hypothesis.
      Personas.regressionRisk({ changeType: 'config' }),
      // Factual-accuracy reviewer — the RCA must cite ≥ 2 load-bearing
      // evidence sources per claim (failing-task log + correlated-pipeline
      // status + recent-deploy diff are the typical pipeline-incident
      // citation triad). The high citation floor guards against "stopped
      // at symptom" or "single-source-of-truth" failures common in
      // pipeline-incident RCAs.
      Personas.factualAccuracy({ minCitationsPerClaim: 2 }),
      // Data-domain reviewer — pulls the senior-data-engineer expert for
      // judgment on the overall RCA + backfill-recommendation quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/DataEngineers',
        name: 'data-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:pipeline-incident-investigator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-data-platform-lead',
    seller: 'svc:pipeline-incident-investigator',
    serviceRef: 'svc:pipeline-incident-investigator',
    // Data-platform-lead signs every RCA + mitigation + backfill
    // recommendation before mitigation actions deploy and the backfill
    // kicks off — data-platform incident-response authority cannot be
    // delegated.
    predicate: AND(
      SchemaMatch(PipelineIncidentRcaOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['data-platform-lead'] })
    ),
    amount: { amount: 59900n, currency: 'USD' },
    // Sub-day SLA — pipeline incidents need RCA + backfill window posted
    // within hours, not days. Day-level granularity is a floor.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'P3',
        amount: 14900n,
        includedPerMonth: 20,
        overage: 14900n,
      },
      {
        id: 'P2',
        amount: 59900n,
        includedPerMonth: 8,
        overage: 59900n,
      },
      {
        id: 'P1',
        amount: 249900n,
        includedPerMonth: 2,
        overage: 249900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 20n },
  reward: kr_pipelineIncidentMttr,

  lineage: {
    cellRef: 'business.org.ai/cells/data-platform/pipeline-incident-investigator',
    icpContextProblemRef: 'icp:pipeline-incident-investigator:v1',
    foundingHypothesisRef: 'fh:pipeline-incident-investigator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
