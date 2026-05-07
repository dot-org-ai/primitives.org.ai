/**
 * Data Quality Incident Triager Service — data-quality alert triage + RCA for
 * the data-engineering / analytics catalog.
 *
 * Distinguishing shape vs. siblings (`dbt-model-author`,
 * `metrics-catalog-curator`):
 *   - `multi-step-research` archetype — the artefact is a data-platform-lead-
 *     signed RCA memo with mitigation plan, not a dbt PR or a metrics-catalog
 *     curation plan;
 *   - 6-step cascade with one supervised Agentic source-system + recent-
 *     deploys investigation step (the only Agentic step in the data-engineering
 *     catalog), bookended by Code fan-in (affected models + recent source
 *     changes + downstream consumers), Generative classification of failure-
 *     mode + blast-radius, Generative synthesis of the RCA + mitigation plan,
 *     a data-platform-lead Human review gate, and Code fan-out (incident doc
 *     + status update);
 *   - `Pricing.perInvocation` 3 tiers keyed on declared blast-radius — P3 /
 *     P2 / P1 ($99 / $499 / $1,999) — a single-model freshness lag is worth
 *     less than a propagated multi-mart breakage that fans out into
 *     executive-tier dashboards;
 *   - declarative HITL = mandatory data-platform-lead review (the lead owns
 *     the data-platform incident-response envelope — `approval` rationale,
 *     not `regulatory` / `premium`), plus OutcomeContract requires data-
 *     platform-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(rca-quality +
 *     mitigation-actionability) + HumanSign(data-platform-lead))`.
 *
 * Per design v3 §3 (Catalog HOW data) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `data-incident-mean-time-to-resolution-improvement`
 * — the compound metric every data-platform team optimises against (the
 * triager Service is worth running iff data-incident MTTR drops vs. the
 * pre-Service baseline, holding RCA-quality flat or improving).
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
 * Input — a data-quality alert firing from one of the standard observability
 * surfaces (dbt test, Monte Carlo, Soda, Great Expectations) plus the
 * affected-models slice. Tight: 7 fields cover the incident identity, the
 * firing alert, the declared blast-radius (so the per-invocation tier is
 * resolvable at intake), the affected models / sources / consumers,
 * the on-call data-platform lead routing target, and the cross-channel
 * status surfaces the incident-doc fan-out updates.
 */
export const DataQualityAlertInputSchema = z.object({
  incidentId: z.string(),
  firingAlert: z.object({
    alertName: z.string(),
    alertSource: z.enum([
      'dbt-test',
      'monte-carlo',
      'soda',
      'great-expectations',
      'custom-monitor',
    ]),
    firedAt: z.string(), // ISO-8601
    failureKind: z.enum([
      'freshness-lag',
      'volume-anomaly',
      'schema-drift',
      'null-rate-spike',
      'distribution-shift',
      'referential-break',
      'uniqueness-violation',
      'custom',
    ]),
    detail: z.string(),
  }),
  declaredBlastRadius: z.enum(['P3', 'P2', 'P1']),
  affectedModelRefs: z.array(z.string()).min(1),
  recentSourceChangeRefs: z.array(z.string()).default([]),
  assignedDataPlatformLeadRef: z.string(),
  statusSurfaces: z.object({
    slackChannel: z.string(),
    incidentTrackerRef: z.string(),
    consumerNotificationChannelRefs: z.array(z.string()).default([]),
  }),
})

/**
 * Output — a data-platform-lead-signed RCA memo + mitigation plan: the
 * fetched-context snapshot, the failure-mode + blast-radius classification,
 * the source-system + recent-deploys investigation findings, the RCA narrative
 * + mitigation plan, the data-platform-lead review audit, and pointers to the
 * emitted incident doc + status-update artefacts.
 */
export const DataQualityRcaOutputSchema = z.object({
  incidentId: z.string(),
  contextSnapshot: z.object({
    affectedModels: z
      .array(
        z.object({
          modelRef: z.string(),
          layer: z.enum(['staging', 'intermediate', 'mart', 'source']),
          owningTeam: z.string(),
        })
      )
      .min(1),
    downstreamConsumers: z.array(
      z.object({
        consumerKind: z.enum(['dashboard', 'reverse-etl', 'ml-feature', 'api', 'export']),
        consumerRef: z.string(),
        consumerOwningTeam: z.string(),
      })
    ),
    recentSourceChanges: z.array(
      z.object({
        changeRef: z.string(),
        changeKind: z.enum([
          'source-schema-change',
          'pipeline-deploy',
          'config-change',
          'data-backfill',
        ]),
        landedAt: z.string(),
      })
    ),
  }),
  failureModeClassification: z.object({
    failureMode: z.enum([
      'upstream-source-broke',
      'pipeline-config-drifted',
      'volume-spike',
      'late-arriving-data',
      'expectations-stale',
      'transformation-bug',
      'platform-infra',
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
        observation: z.string(),
        relevanceRationale: z.string(),
      })
    )
    .min(0),
  rcaNarrative: z.object({
    summaryMarkdown: z.string(),
    rootCauseHypothesis: z.string(),
    contributingFactors: z.array(z.string()).min(0),
    evidenceCitations: z.array(z.string()).min(1),
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
    preventionFollowups: z.array(z.string()).min(0),
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
    statusUpdateRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DataQualityAlertInput = z.infer<typeof DataQualityAlertInputSchema>
export type DataQualityRcaOutput = z.infer<typeof DataQualityRcaOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_dataIncidentMttr: RewardSignal = {
  keyResultRef:
    'kr:data-quality-incident-triager:data-incident-mean-time-to-resolution-improvement',
}
const kr_contextCoverage: RewardSignal = {
  keyResultRef: 'kr:data-quality-incident-triager:context-coverage',
}
const kr_classificationAccuracy: RewardSignal = {
  keyResultRef: 'kr:data-quality-incident-triager:classification-accuracy',
}
const kr_investigationCoverage: RewardSignal = {
  keyResultRef: 'kr:data-quality-incident-triager:investigation-coverage',
}
const kr_rcaQuality: RewardSignal = {
  keyResultRef: 'kr:data-quality-incident-triager:rca-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:data-quality-incident-triager:emit-latency',
}

// ============================================================================
// Data Quality Incident Triager Service
// ============================================================================

/**
 * Data Quality Incident Triager — data-quality alert (dbt test / Monte Carlo
 * / Soda / Great Expectations) → data-platform-lead-signed RCA memo +
 * mitigation plan as a Service.
 *
 * Cascade: fetch-affected-models-and-recent-source-changes-and-downstream-consumers (Code, fan-in)
 *        → classify-failure-mode-and-blast-radius (Generative)
 *        → supervised-investigate-source-system-and-recent-deploys (Agentic, supervised)
 *        → draft-RCA-with-mitigation-plan (Generative)
 *        → data-platform-lead-review (Human, approval rationale)
 *        → emit-incident-doc-and-status-update (Code, fan-out).
 */
export const dataQualityIncidentTriager: ServiceInstance<
  DataQualityAlertInput,
  DataQualityRcaOutput
> = Service.define<DataQualityAlertInput, DataQualityRcaOutput>({
  name: 'Data Quality Incident Triager',
  promise:
    'Every data-quality alert lands a data-platform-lead-signed RCA + mitigation plan within hours — failure-mode classification + blast-radius + source-system / deploy investigation + concrete mitigation actions — so MTTR is bounded by the lead review, not the manual triage backlog.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: DataQualityAlertInputSchema, output: DataQualityRcaOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-affected-models-and-recent-source-changes-and-downstream-consumers',
        reward: kr_contextCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'classify-failure-mode-and-blast-radius',
        reward: kr_classificationAccuracy,
      }),
      Agentic({
        name: 'supervised-investigate-source-system-and-recent-deploys',
        reward: kr_investigationCoverage,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'draft-RCA-with-mitigation-plan',
        reward: kr_rcaQuality,
      }),
      Human({
        name: 'data-platform-lead-review',
        // `approval` rationale: the data-platform lead owns the data-
        // platform incident-response envelope — every RCA + mitigation plan
        // routes through lead sign-off before mitigation actions deploy.
        // The gate stays human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-incident-doc-and-status-update',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'dbt-test.read',
      'monte-carlo.read',
      'soda.read',
      'great-expectations.read',
      'lineage-graph.read',
      'warehouse.metadata',
      'warehouse.query',
      'pipeline-deploys.read',
      'source-systems.read',
      'incident-tracker.write',
      'slack.messages',
      'docs.write',
    ],
    // Incident triage: clarification disabled — the cascade synthesises
    // from the firing alert + lineage slice + recent-source-change signals;
    // the data-platform lead review step is the single human contact point
    // during the incident.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // P1 incidents escalate the failure-mode classification + RCA
        // synthesis to a senior data-platform supervisor before the routine
        // lead review (the lead still signs, but the supervisor backstops
        // the synthesis quality on the highest-stakes tier).
        when: 'declaredBlastRadius == "P1"',
        action: 'escalate',
      },
      {
        // Every incident routes through data-platform-lead review before
        // the incident doc emits and the status update fans out;
        // OutcomeContract enforces the signature, the trigger primes the
        // queue.
        when: 'true',
        action: 'route-to',
        target: 'data-platform-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:data-quality-incident-triager-review',
    personas: [
      // RCA-quality reviewer — pedantic check that the RCA narrative cites
      // the load-bearing evidence (failing test output, source-system query,
      // deploy diff), names a concrete root-cause hypothesis, and lists
      // contributing factors rather than ending at the symptom. The risk
      // this guards against is "stopped at symptom, missed cause".
      Personas.pedantic({
        domain: 'rca-quality',
        rubric: [
          'cites-failing-test-or-monitor-output',
          'cites-source-or-deploy-evidence',
          'names-concrete-root-cause-hypothesis',
          'lists-contributing-factors',
          'no-symptom-only-RCA',
        ],
        name: 'rca-quality-reviewer',
      }),
      // Mitigation-actionability reviewer — adversarially probes whether the
      // mitigation plan is concretely actionable (every action names an
      // owner + ETA + requires-human-approval flag, every action is
      // independently runnable) vs. surface-level "investigate the
      // pipeline" hand-waving.
      Personas.skeptic({
        domain: 'mitigation-actionability',
        focus: [
          'every-action-names-owner',
          'every-action-has-eta',
          'every-action-flags-human-approval-need',
          'every-action-independently-runnable',
          'no-investigate-further-actions',
          'no-hand-waves',
        ],
        name: 'mitigation-actionability-checker',
      }),
      // Data-domain reviewer — pulls the senior-data-engineer expert for
      // judgment on the overall RCA + mitigation-plan quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/DataEngineers',
        name: 'data-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:data-quality-incident-triager:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-data-platform-lead',
    seller: 'svc:data-quality-incident-triager',
    serviceRef: 'svc:data-quality-incident-triager',
    // Data-platform-lead signs every RCA + mitigation plan before
    // mitigation actions deploy — data-platform incident-response
    // authority cannot be delegated.
    predicate: AND(
      SchemaMatch(DataQualityRcaOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['data-platform-lead'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 49900n, currency: 'USD' },
    // Sub-day SLA — data-quality incidents need RCA + mitigation posted
    // within hours, not days. Day-level granularity is a floor.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'P3',
        amount: 9900n,
        includedPerMonth: 20,
        overage: 9900n,
      },
      {
        id: 'P2',
        amount: 49900n,
        includedPerMonth: 8,
        overage: 49900n,
      },
      {
        id: 'P1',
        amount: 199900n,
        includedPerMonth: 2,
        overage: 199900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8000n, perApiCall: 18n },
  reward: kr_dataIncidentMttr,

  lineage: {
    cellRef: 'business.org.ai/cells/data-platform/data-quality-incident-triager',
    icpContextProblemRef: 'icp:data-quality-incident-triager:v1',
    foundingHypothesisRef: 'fh:data-quality-incident-triager:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
