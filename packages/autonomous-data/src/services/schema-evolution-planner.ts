/**
 * Schema Evolution Planner Service — source-schema-change impact analysis +
 * migration plan for the data-engineering / analytics catalog.
 *
 * Distinguishing shape vs. siblings (`dbt-model-author`,
 * `data-quality-incident-triager`, `metrics-catalog-curator`,
 * `pipeline-incident-investigator`, `ml-model-monitor`):
 *   - `forecast-narrative` archetype — the artefact is a data-platform-lead
 *     + analytics-lead-signed migration runbook with downstream-blast-radius
 *     + sequencing + dual-write plan, not a dbt PR, an incident-RCA, a
 *     metrics-catalog curation plan, a pipeline-incident-doc, or an ML
 *     drift report;
 *   - 5-step cascade: Code fan-in (current schema-graph + dependent models +
 *     dashboards + migration policy) → Generative (impact analysis: breaking-
 *     vs-additive + downstream blast-radius) → Generative (draft migration
 *     plan: schema-fanout + backfill-strategy + dual-write window) → Human
 *     (data-platform-lead + analytics-lead review) → Code (emit migration
 *     runbook + create blocked-on-source tickets);
 *   - `Pricing.outcome` 3 tiers keyed on declared change shape — additive /
 *     breaking-narrow / breaking-wide ($199 / $799 / $2,999) — an additive
 *     column addition is worth less than a breaking type change that fans
 *     out into 30+ dependent models / dashboards / reverse-etl jobs;
 *   - declarative HITL = mandatory data-platform-lead + analytics-lead
 *     review (the data-platform lead owns the ingestion-and-storage envelope;
 *     the analytics-lead owns the consumption envelope — `approval`
 *     rationale on both, not `regulatory` / `premium`), plus OutcomeContract
 *     requires data-platform-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(impact-completeness
 *     + migration-safety + sequencing-soundness) + HumanSign(data-platform-
 *     lead))`.
 *
 * Per design v3 §3 (Catalog HOW data) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `schema-migration-cycle-time-and-downstream-
 * breakage-rate-reduction` — the compound metric every data-platform team
 * optimises against (the planner Service is worth running iff schema-
 * migration cycle-time AND downstream-breakage rate both drop vs. the pre-
 * Service baseline).
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
 * Input — a source-schema-change announcement OR a new-field request from
 * a stakeholder. Tight: 7 fields cover the planning request identity, the
 * trigger kind, the declared change shape (so the outcome tier is
 * resolvable at intake), the source-system + schema slice describing the
 * proposed change, the optional new-field-request payload, the migration-
 * policy pointer, and the assigned data-platform-lead + analytics-lead
 * reviewers.
 */
export const SchemaEvolutionPlanInputSchema = z.object({
  planRequestId: z.string(),
  triggerKind: z.enum(['source-schema-change-announced', 'new-field-request']),
  declaredChangeShape: z.enum(['additive', 'breaking-narrow', 'breaking-wide']),
  proposedSchemaChange: z.object({
    sourceSystem: z.enum([
      'postgres',
      'mysql',
      'snowflake',
      'bigquery',
      'redshift',
      'salesforce',
      'hubspot',
      'stripe',
      'segment',
      'kafka',
      'event-stream',
    ]),
    schemaName: z.string(),
    affectedTables: z
      .array(
        z.object({
          tableName: z.string(),
          changeKind: z.enum([
            'added',
            'removed',
            'column-added',
            'column-removed',
            'column-renamed',
            'type-changed',
            'nullability-changed',
            'enum-values-changed',
          ]),
          changeDetail: z.string(),
          announcedEffectiveDate: z.string().optional(),
        })
      )
      .min(1),
  }),
  newFieldRequest: z
    .object({
      requestingTeam: z.enum([
        'finance',
        'marketing',
        'product',
        'sales',
        'operations',
        'executive',
        'engineering',
      ]),
      requestedFields: z.array(z.string()).min(1),
      businessJustification: z.string(),
    })
    .optional(),
  migrationPolicy: z.object({
    policyRef: z.string(),
    dualWriteWindowMaxDays: z.number().int().nonnegative(),
    breakingChangeNoticeMinDays: z.number().int().nonnegative(),
  }),
  reviewers: z.object({
    dataPlatformLeadRef: z.string(),
    analyticsLeadRef: z.string(),
  }),
})

/**
 * Output — a data-platform-lead + analytics-lead-signed migration runbook:
 * the fetched schema-graph snapshot, the impact analysis (breaking vs.
 * additive + downstream blast-radius), the migration plan (schema-fanout +
 * backfill strategy + dual-write window), the reviewers' decisions, and
 * pointers to the emitted runbook + blocked-on-source ticket artefacts.
 */
export const SchemaEvolutionPlanOutputSchema = z.object({
  planRequestId: z.string(),
  schemaGraphSnapshot: z.object({
    sourceTablesIn: z.array(z.string()).min(1),
    dependentModels: z
      .array(
        z.object({
          modelRef: z.string(),
          layer: z.enum(['staging', 'intermediate', 'mart', 'source']),
          owningTeam: z.string(),
        })
      )
      .min(0),
    dependentDashboards: z
      .array(
        z.object({
          dashboardRef: z.string(),
          surface: z.enum(['looker', 'tableau', 'mode', 'metabase', 'sigma', 'in-house']),
          owningTeam: z.string(),
        })
      )
      .min(0),
    dependentReverseEtlJobs: z
      .array(
        z.object({
          jobRef: z.string(),
          syncTarget: z.string(),
          owningTeam: z.string(),
        })
      )
      .min(0),
    migrationPolicyRef: z.string(),
  }),
  impactAnalysis: z.object({
    overallChangeShape: z.enum(['additive', 'breaking-narrow', 'breaking-wide']),
    breakingChangeFlags: z
      .array(
        z.object({
          flagId: z.string(),
          tableName: z.string(),
          changeKind: z.string(),
          breakingReason: z.string(),
          affectedDownstreamRefs: z.array(z.string()).min(1),
        })
      )
      .min(0),
    additiveChangeFlags: z
      .array(
        z.object({
          flagId: z.string(),
          tableName: z.string(),
          changeKind: z.string(),
          affectedDownstreamRefs: z.array(z.string()).min(0),
        })
      )
      .min(0),
    blastRadiusSummary: z.object({
      totalDependentModelCount: z.number().int().nonnegative(),
      totalDependentDashboardCount: z.number().int().nonnegative(),
      totalDependentReverseEtlJobCount: z.number().int().nonnegative(),
      narrative: z.string(),
    }),
  }),
  migrationPlan: z.object({
    summaryMarkdown: z.string(),
    schemaFanoutSteps: z
      .array(
        z.object({
          stepId: z.string(),
          stepKind: z.enum([
            'add-staging-column',
            'rename-staging-column',
            'fork-model',
            'update-yml-config',
            'update-test-suite',
            'update-dashboard-binding',
            'update-reverse-etl-mapping',
          ]),
          description: z.string(),
          targetRef: z.string(),
          sequenceIndex: z.number().int().nonnegative(),
          ownerRef: z.string(),
        })
      )
      .min(1),
    backfillStrategy: z.object({
      strategy: z.enum(['no-backfill', 'incremental-window', 'full-refresh', 'targeted-partition']),
      windowStart: z.string().optional(),
      windowEnd: z.string().optional(),
      estimatedRunMinutes: z.number().int().nonnegative().optional(),
      rationale: z.string(),
    }),
    dualWriteWindow: z.object({
      requiresDualWrite: z.boolean(),
      windowStart: z.string().optional(),
      windowEnd: z.string().optional(),
      cutoverPlan: z.string().optional(),
    }),
    rollbackPlan: z.string(),
  }),
  reviews: z.object({
    dataPlatformLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
    analyticsLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    migrationRunbookUrl: z.string(),
    blockedOnSourceTicketRefs: z.array(z.string()).min(0),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type SchemaEvolutionPlanInput = z.infer<typeof SchemaEvolutionPlanInputSchema>
export type SchemaEvolutionPlanOutput = z.infer<typeof SchemaEvolutionPlanOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_migrationCycleTime: RewardSignal = {
  keyResultRef:
    'kr:schema-evolution-planner:schema-migration-cycle-time-and-downstream-breakage-rate-reduction',
}
const kr_graphCoverage: RewardSignal = {
  keyResultRef: 'kr:schema-evolution-planner:graph-coverage',
}
const kr_impactCompleteness: RewardSignal = {
  keyResultRef: 'kr:schema-evolution-planner:impact-completeness',
}
const kr_migrationSafety: RewardSignal = {
  keyResultRef: 'kr:schema-evolution-planner:migration-safety',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:schema-evolution-planner:emit-latency',
}

// ============================================================================
// Schema Evolution Planner Service
// ============================================================================

/**
 * Schema Evolution Planner — source-schema-change announcement OR new-field
 * request → data-platform-lead + analytics-lead-signed migration runbook
 * with breaking-vs-additive impact analysis + downstream blast-radius +
 * schema-fanout + backfill strategy + dual-write window as a Service.
 *
 * Cascade: fetch-current-schema-graph-and-dependent-models-and-dashboards-and-migration-policy (Code, fan-in)
 *        → impact-analysis-breaking-vs-additive-and-downstream-blast-radius (Generative)
 *        → draft-migration-plan-schema-fanout-and-backfill-strategy-and-dual-write-window (Generative)
 *        → data-platform-lead-and-analytics-lead-review (Human, approval rationale)
 *        → emit-migration-runbook-and-create-blocked-on-source-tickets (Code, fan-out).
 */
export const schemaEvolutionPlanner: ServiceInstance<
  SchemaEvolutionPlanInput,
  SchemaEvolutionPlanOutput
> = Service.define<SchemaEvolutionPlanInput, SchemaEvolutionPlanOutput>({
  name: 'Schema Evolution Planner',
  promise:
    'Every announced source-schema change and every new-field request lands a data-platform-lead + analytics-lead-signed migration runbook within hours — breaking-vs-additive impact analysis + downstream blast-radius + schema-fanout sequencing + backfill strategy + dual-write window — so schema migrations land predictably without breaking downstream consumers.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: { input: SchemaEvolutionPlanInputSchema, output: SchemaEvolutionPlanOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-current-schema-graph-and-dependent-models-and-dashboards-and-migration-policy',
        reward: kr_graphCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'impact-analysis-breaking-vs-additive-and-downstream-blast-radius',
        reward: kr_impactCompleteness,
      }),
      Generative({
        name: 'draft-migration-plan-schema-fanout-and-backfill-strategy-and-dual-write-window',
        reward: kr_migrationSafety,
      }),
      Human({
        name: 'data-platform-lead-and-analytics-lead-review',
        // `approval` rationale: the data-platform lead owns the ingestion-
        // and-storage envelope; the analytics-lead owns the consumption
        // envelope. Every migration runbook routes through both reviewers
        // before the schema-fanout starts and the dual-write window kicks
        // off. The gate stays human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-migration-runbook-and-create-blocked-on-source-tickets',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'source-systems.read',
      'source-schemas.read',
      'lineage-graph.read',
      'warehouse.metadata',
      'dbt-project.read',
      'dashboard-catalog.read',
      'reverse-etl-catalog.read',
      'migration-policy.read',
      'github.contents',
      'github.pulls',
      'incident-tracker.write',
      'docs.write',
    ],
    // Schema-evolution planning: clarification disabled — the cascade
    // synthesises from the proposed-change slice + dependent-graph + policy
    // signals; the data-platform-lead + analytics-lead review step is the
    // single human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Breaking-wide changes escalate the impact-analysis + migration-
        // plan synthesis to a senior data-platform supervisor before the
        // routine lead review (the leads still sign, but the supervisor
        // backstops the sequencing on the highest-stakes tier where blast-
        // radius spans the full mart layer).
        when: 'declaredChangeShape == "breaking-wide"',
        action: 'escalate',
      },
      {
        // Every plan request routes through data-platform-lead + analytics-
        // lead review before the runbook emits and blocked-on-source
        // tickets fan out; OutcomeContract enforces the data-platform-lead
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'data-platform-lead-and-analytics-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:schema-evolution-planner-review',
    personas: [
      // Regression-risk reviewer (schema) — schema migrations carry data-
      // shape blast radius across every dependent model, dashboard, and
      // reverse-etl job. The regression-risk persona (changeType `schema`,
      // blast-radius required, rollback plan required) is the load-bearing
      // adversarial check on the plan: every breaking-change flag must
      // describe its blast radius and rollback path explicitly.
      Personas.regressionRisk({
        changeType: 'schema',
        blastRadiusRequired: true,
        rollbackPlanRequired: true,
      }),
      // Scope-clarity reviewer (project-brief) — migration runbooks behave
      // as project briefs to the cross-team execution: the scope-clarity
      // persona checks that the runbook names what is in scope (which
      // schema steps, which backfill window, which dual-write window) and
      // what is out-of-scope (downstream-only edits, model rewrites,
      // dashboard re-binding by other teams).
      Personas.scopeClarity({ artifactType: 'project-brief' }),
      // Data-domain reviewer — pulls the senior-data-engineer expert for
      // judgment on the overall migration-plan quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/DataEngineers',
        name: 'data-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:schema-evolution-planner:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-data-platform-lead',
    seller: 'svc:schema-evolution-planner',
    serviceRef: 'svc:schema-evolution-planner',
    // Data-platform-lead signs every migration runbook — schema-evolution
    // authority cannot be delegated; the analytics-lead co-reviews via
    // the cascade Human step but the OutcomeContract anchor is the data-
    // platform lead.
    predicate: AND(
      SchemaMatch(SchemaEvolutionPlanOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['data-platform-lead'] })
    ),
    amount: { amount: 79900n, currency: 'USD' },
    // 3-day SLA — schema-migration plans land inside one analytics-
    // engineering sprint cadence so the source-schema change doesn't block
    // downstream consumers and dual-write windows can be scheduled.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'additive',
        amount: 19900n,
        currency: 'USD',
        description:
          'Additive change — column add / nullable add / new-table add with no breaking impact. $199.',
      },
      {
        id: 'breaking-narrow',
        amount: 79900n,
        currency: 'USD',
        description:
          'Breaking change — narrow blast radius (≤ 15 dependent models / dashboards / reverse-etl jobs). $799.',
      },
      {
        id: 'breaking-wide',
        amount: 299900n,
        currency: 'USD',
        description:
          'Breaking change — wide blast radius (16+ dependent models / dashboards / reverse-etl jobs). $2,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 18n },
  reward: kr_migrationCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/data-platform/schema-evolution-planner',
    icpContextProblemRef: 'icp:schema-evolution-planner:v1',
    foundingHypothesisRef: 'fh:schema-evolution-planner:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
