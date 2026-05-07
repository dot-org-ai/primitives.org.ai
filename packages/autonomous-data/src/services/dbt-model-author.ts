/**
 * dbt Model Author Service — analytics-engineering dbt-model authoring +
 * lineage-aware refactor for the data-engineering / analytics catalog.
 *
 * Distinguishing shape vs. siblings (`data-quality-incident-triager`,
 * `metrics-catalog-curator`):
 *   - `quality-review` archetype — the artefact is an analytics-engineer-
 *     signed PR containing staging + intermediate + mart models, dbt tests,
 *     yml config, and a docs update, not an incident-RCA memo or a metrics-
 *     catalog curation plan;
 *   - 5-step cascade: Code fan-in (current schema + downstream graph + recent
 *     PR context) → Generative (synthesise staging + intermediate + mart
 *     models with lineage) → Generative (write dbt tests for quality +
 *     freshness checks) → Human (analytics-engineer review) → Code (emit PR
 *     with yml config + dbt docs update);
 *   - `Pricing.outcome` 3 tiers keyed on lineage-graph size — small / medium
 *     / large ($499 / $1,999 / $5,999) — a single staging model with one
 *     downstream consumer is worth less than a mart-layer rewrite that fans
 *     out into 30+ dashboards;
 *   - declarative HITL = mandatory analytics-engineer review (the analytics-
 *     engineer owns the model-correctness + lineage-coherence envelope —
 *     `approval` rationale, not `regulatory` / `premium`), plus
 *     OutcomeContract requires analytics-engineer signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(test-coverage +
 *     lineage-completeness + naming-convention-adherence) +
 *     HumanSign(analytics-engineer))`.
 *
 * Per design v3 §3 (Catalog HOW data) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `ci-pass-rate-on-first-PR` — the compound metric
 * every analytics-engineering team optimises against (the author Service is
 * worth running iff dbt-CI pass-rate on first-PR submission beats the pre-
 * Service baseline, holding model-correctness flat or improving).
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
 * Input — a dbt-model authoring request triggered by a source-table schema
 * change or a new analytics request from a business stakeholder. Tight: 7
 * fields cover the request identity, the trigger kind, the declared lineage
 * size (so the outcome-tier pricing is resolvable at intake), the source-
 * schema slice, the analytics request payload (when business-stakeholder
 * driven), the warehouse + dbt-project pointer, and the assigned analytics-
 * engineer reviewer.
 */
export const DbtModelRequestInputSchema = z.object({
  requestId: z.string(),
  triggerKind: z.enum(['source-schema-change', 'new-analytics-request']),
  declaredLineageSize: z.enum(['small', 'medium', 'large']),
  sourceSchema: z.object({
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
          ]),
          changeDetail: z.string(),
        })
      )
      .min(0),
  }),
  analyticsRequest: z
    .object({
      requestingTeam: z.enum([
        'finance',
        'marketing',
        'product',
        'sales',
        'operations',
        'executive',
      ]),
      requestedMetrics: z.array(z.string()).min(1),
      businessQuestion: z.string(),
    })
    .optional(),
  dbtProject: z.object({
    projectRef: z.string(),
    warehouse: z.enum(['snowflake', 'bigquery', 'redshift', 'databricks', 'duckdb', 'postgres']),
    targetSchema: z.string(),
    branchRef: z.string(),
  }),
  assignedAnalyticsEngineerRef: z.string(),
})

/**
 * Output — an analytics-engineer-signed dbt PR: the fetched lineage-graph
 * snapshot, the synthesized model-set (staging + intermediate + mart), the
 * dbt-test set (uniqueness / not-null / referential / freshness / custom),
 * the analytics-engineer review audit, and pointers to the emitted PR + dbt-
 * docs update artefacts.
 */
export const DbtModelAuthorOutputSchema = z.object({
  requestId: z.string(),
  lineageSnapshot: z.object({
    sourceTablesIn: z.array(z.string()).min(1),
    upstreamModelRefs: z.array(z.string()),
    downstreamModelRefs: z.array(z.string()),
    downstreamConsumerRefs: z.array(
      z.object({
        consumerKind: z.enum(['dashboard', 'reverse-etl', 'ml-feature', 'api', 'export']),
        consumerRef: z.string(),
      })
    ),
    recentPrContextRefs: z.array(z.string()),
  }),
  modelSet: z
    .array(
      z.object({
        modelId: z.string(),
        layer: z.enum(['staging', 'intermediate', 'mart']),
        modelName: z.string(),
        sqlBody: z.string(),
        materialization: z.enum(['view', 'table', 'incremental', 'ephemeral']),
        ymlConfig: z.string(),
        upstreamModelRefs: z.array(z.string()),
      })
    )
    .min(1),
  dbtTests: z
    .array(
      z.object({
        testId: z.string(),
        modelId: z.string(),
        testKind: z.enum([
          'unique',
          'not-null',
          'accepted-values',
          'relationships',
          'freshness',
          'custom',
        ]),
        testBody: z.string(),
        rationale: z.string(),
      })
    )
    .min(1),
  analyticsEngineerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  artefacts: z.object({
    pullRequestUrl: z.string(),
    dbtDocsUpdateUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DbtModelRequestInput = z.infer<typeof DbtModelRequestInputSchema>
export type DbtModelAuthorOutput = z.infer<typeof DbtModelAuthorOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_ciPassRate: RewardSignal = {
  keyResultRef: 'kr:dbt-model-author:ci-pass-rate-on-first-PR',
}
const kr_lineageCoverage: RewardSignal = {
  keyResultRef: 'kr:dbt-model-author:lineage-coverage',
}
const kr_modelSynthQuality: RewardSignal = {
  keyResultRef: 'kr:dbt-model-author:model-synth-quality',
}
const kr_testCoverage: RewardSignal = {
  keyResultRef: 'kr:dbt-model-author:test-coverage',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:dbt-model-author:emit-latency',
}

// ============================================================================
// dbt Model Author Service
// ============================================================================

/**
 * dbt Model Author — source-schema change OR new analytics request →
 * analytics-engineer-signed PR with staging + intermediate + mart models +
 * dbt tests + yml config + docs update as a Service.
 *
 * Cascade: fetch-current-schema-and-downstream-graph-and-recent-PR-context (Code, fan-in)
 *        → synthesize-staging-and-intermediate-and-mart-models-with-lineage (Generative)
 *        → write-dbt-tests-for-quality-and-freshness-checks (Generative)
 *        → analytics-engineer-review (Human, approval rationale)
 *        → emit-PR-with-yml-config-and-dbt-docs-update (Code, fan-out).
 */
export const dbtModelAuthor: ServiceInstance<DbtModelRequestInput, DbtModelAuthorOutput> =
  Service.define<DbtModelRequestInput, DbtModelAuthorOutput>({
    name: 'dbt Model Author',
    promise:
      'Every source-schema change and every new analytics request lands as an analytics-engineer-signed dbt PR within hours — staging + intermediate + mart models + tests + yml config + docs update — so the analytics-engineering queue is bounded by review, not by hand-authoring SQL.',
    audience: 'business',
    archetype: 'quality-review',
    schema: { input: DbtModelRequestInputSchema, output: DbtModelAuthorOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-current-schema-and-downstream-graph-and-recent-PR-context',
          reward: kr_lineageCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-staging-and-intermediate-and-mart-models-with-lineage',
          reward: kr_modelSynthQuality,
        }),
        Generative({
          name: 'write-dbt-tests-for-quality-and-freshness-checks',
          reward: kr_testCoverage,
        }),
        Human({
          name: 'analytics-engineer-review',
          // `approval` rationale: the analytics-engineer owns the model-
          // correctness + lineage-coherence envelope — every dbt PR routes
          // through analytics-engineer sign-off before merging into main.
          // The gate stays human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-PR-with-yml-config-and-dbt-docs-update',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'dbt-project.read',
        'dbt-project.write',
        'warehouse.metadata',
        'warehouse.query',
        'lineage-graph.read',
        'github.pulls',
        'github.contents',
        'dbt-docs.write',
      ],
      // Model authoring: clarification disabled — the cascade synthesises
      // from the source-schema slice + downstream-graph + recent-PR signals;
      // the analytics-engineer review step is the single human contact point
      // in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Large lineage-graph requests escalate the model-synthesis step
          // to a senior analytics-engineering supervisor before the routine
          // analytics-engineer review (the analytics-engineer still signs,
          // but the supervisor backstops the synthesis on the highest-stakes
          // mart-layer rewrites that fan out across many consumers).
          when: 'declaredLineageSize == "large"',
          action: 'escalate',
        },
        {
          // Every request routes through analytics-engineer review before
          // the PR emits; OutcomeContract enforces the signature, the
          // trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'analytics-engineer-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:dbt-model-author-review',
      personas: [
        // Test-coverage reviewer — pedantic check that every model in the
        // synthesized set carries the required test set (unique on PK,
        // not-null on FKs, referential to upstream, freshness on staging
        // sources). The risk this guards against is "shipped without
        // tests" — the most common dbt-PR rejection reason.
        Personas.pedantic({
          domain: 'test-coverage',
          rubric: [
            'every-model-has-pk-uniqueness-test',
            'every-fk-has-not-null-test',
            'every-relationship-has-referential-test',
            'every-staging-source-has-freshness-test',
            'no-model-without-at-least-one-test',
          ],
          name: 'test-coverage-checker',
        }),
        // Lineage-completeness reviewer — adversarially probes whether the
        // synthesized model-set's upstream + downstream references are
        // complete (every source-table referenced is in `upstreamModelRefs`,
        // every consumer-driven mart-layer change names the affected
        // dashboards / reverse-etl jobs / ml-features) vs. silent omissions.
        Personas.skeptic({
          domain: 'lineage-completeness',
          focus: [
            'every-source-table-listed-as-upstream',
            'every-affected-downstream-listed',
            'consumer-impact-evaluated',
            'no-orphan-models',
            'no-hand-waves',
          ],
          name: 'lineage-completeness-reviewer',
        }),
        // Naming-convention-adherence reviewer — pedantic check that every
        // synthesized model name follows the project's `stg_` /
        // `int_` / `fct_` / `dim_` / `mart_` prefix conventions and that
        // column names follow the lowercase-snake_case house style. The
        // risk this guards against is "PR rejected on style".
        Personas.pedantic({
          domain: 'naming-convention-adherence',
          rubric: [
            'staging-models-prefixed-stg_',
            'intermediate-models-prefixed-int_',
            'fact-models-prefixed-fct_',
            'dimension-models-prefixed-dim_',
            'columns-lowercase-snake-case',
            'no-cryptic-abbreviations',
          ],
          name: 'naming-convention-adherence',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:dbt-model-author:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-analytics-engineering-lead',
      seller: 'svc:dbt-model-author',
      serviceRef: 'svc:dbt-model-author',
      // Analytics-engineer signs every dbt PR before merging — model-
      // correctness + lineage-coherence authority cannot be delegated.
      predicate: AND(
        SchemaMatch(DbtModelAuthorOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['analytics-engineer'] })
      ),
      // Mid-tier amount; the per-tier outcome amounts are in `pricing.tiers`.
      amount: { amount: 199900n, currency: 'USD' },
      // 2-day SLA — model authoring lands inside one analytics-engineering
      // sprint cadence so the source-schema change or analytics request
      // doesn't block downstream consumers.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'small',
          amount: 49900n,
          currency: 'USD',
          description:
            'Small lineage graph — single staging model, ≤ 3 downstream consumers. $499.',
        },
        {
          id: 'medium',
          amount: 199900n,
          currency: 'USD',
          description:
            'Medium lineage graph — staging + intermediate + single mart, 4–15 downstream consumers. $1,999.',
        },
        {
          id: 'large',
          amount: 599900n,
          currency: 'USD',
          description:
            'Large lineage graph — multi-mart-layer rewrite, 16+ downstream consumers (dashboards / reverse-etl / ml-features). $5,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 7000n, perApiCall: 14n },
    reward: kr_ciPassRate,

    lineage: {
      cellRef: 'business.org.ai/cells/analytics-engineering/dbt-model-author',
      icpContextProblemRef: 'icp:dbt-model-author:v1',
      foundingHypothesisRef: 'fh:dbt-model-author:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
