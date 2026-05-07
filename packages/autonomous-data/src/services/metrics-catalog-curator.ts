/**
 * Metrics Catalog Curator Service — metrics-layer drift detection + curator
 * for the data-engineering / analytics catalog.
 *
 * Distinguishing shape vs. siblings (`dbt-model-author`,
 * `data-quality-incident-triager`):
 *   - `forecast-narrative` archetype — the artefact is an analytics-lead-
 *     signed metrics-catalog curation plan with name-collision flags,
 *     definition-divergence flags, ownership-gap flags, and a deprecation +
 *     consolidation plan, not a dbt PR or an incident-RCA memo;
 *   - 5-step cascade: Code fan-in (current metrics catalog + recent usage +
 *     business context) → Generative (drift detection — name collisions,
 *     definition divergence, ownership gaps) → Generative (curation
 *     recommendations + deprecation plan) → Human (analytics-lead + data-PM
 *     review) → Code (emit curation PR + announcement);
 *   - `Pricing.subscription` — a recurring per-data-team subscription
 *     ($899/mo) plus metered overage at $199 per curation PR emitted (the
 *     metering runtime resolves `curation-pr-emitted` to invocations beyond
 *     the implicit weekly-cron baseline);
 *   - declarative HITL = mandatory analytics-lead + data-PM review (the
 *     analytics-lead owns the metrics-catalog ownership envelope —
 *     `approval` rationale, not `regulatory` / `premium`), plus
 *     OutcomeContract requires analytics-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(drift-detection-
 *     precision + curation-rationale-clarity) + HumanSign(analytics-lead))`.
 *
 * Per design v3 §3 (Catalog HOW data) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory with metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `metrics-catalog-coherence-score-improvement` — the
 * compound metric every analytics-lead + data-PM org optimises against (the
 * curator Service is worth running iff catalog-coherence — measured as
 * canonical-metric-coverage + ownership-clarity + definition-stability —
 * improves vs. the pre-Service baseline).
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
 * Input — a metrics-catalog curation review triggered by a weekly cron, a new
 * metric-definition PR landing, or a semantic-layer drift alert. Tight: 7
 * fields cover the review identity, the trigger kind, the metrics-layer
 * surface (semantic-layer / metric-store / dbt-metrics) the cascade fans-in
 * against, the catalog-snapshot pointer, the recent-usage observation
 * window, the business-context corpus pointer, and the assigned analytics-
 * lead + data-PM reviewers.
 */
export const MetricsCatalogReviewInputSchema = z.object({
  reviewId: z.string(),
  triggerKind: z.enum(['weekly-cron', 'new-metric-pr', 'semantic-layer-drift-alert']),
  metricsLayerSurface: z.enum([
    'cube',
    'lookml',
    'dbt-semantic-layer',
    'dbt-metrics',
    'transform',
    'metricflow',
    'in-house',
  ]),
  catalogSnapshot: z.object({
    catalogRef: z.string(),
    snapshotSha256: z.string(),
    metricCount: z.number().int().nonnegative(),
  }),
  recentUsageWindow: z.object({
    windowStartIso: z.string(),
    windowEndIso: z.string(),
    queryLogRef: z.string(),
  }),
  businessContextRefs: z.array(z.string()).default([]),
  reviewers: z.object({
    analyticsLeadRef: z.string(),
    dataPmRef: z.string(),
  }),
})

/**
 * Output — an analytics-lead-signed metrics-catalog curation plan: the
 * fetched catalog snapshot + usage + business-context, the detected drift
 * findings (name collisions, definition divergence, ownership gaps), the
 * curation recommendations + deprecation plan, the analytics-lead + data-PM
 * review audit, and pointers to the emitted curation PR + announcement
 * artefacts.
 */
export const MetricsCatalogCurationOutputSchema = z.object({
  reviewId: z.string(),
  catalogSnapshot: z.object({
    catalogRef: z.string(),
    snapshotSha256: z.string(),
    metricCount: z.number().int().nonnegative(),
    activeMetricCount: z.number().int().nonnegative(),
    deprecatedMetricCount: z.number().int().nonnegative(),
  }),
  driftFindings: z.object({
    nameCollisions: z
      .array(
        z.object({
          collisionId: z.string(),
          metricRefs: z.array(z.string()).min(2),
          collisionKind: z.enum([
            'identical-name-different-definition',
            'near-duplicate-name',
            'ambiguous-overload',
          ]),
          impactNarrative: z.string(),
        })
      )
      .min(0),
    definitionDivergences: z
      .array(
        z.object({
          divergenceId: z.string(),
          metricRef: z.string(),
          previousDefinitionRef: z.string(),
          currentDefinitionRef: z.string(),
          divergenceKind: z.enum([
            'numerator-changed',
            'denominator-changed',
            'filter-changed',
            'grain-changed',
            'aggregation-changed',
          ]),
          breakingChangeFlag: z.boolean(),
        })
      )
      .min(0),
    ownershipGaps: z
      .array(
        z.object({
          gapId: z.string(),
          metricRef: z.string(),
          gapKind: z.enum(['unowned', 'orphaned-team', 'stale-owner', 'multiple-claimants']),
          lastTouchedAt: z.string().optional(),
        })
      )
      .min(0),
  }),
  curationRecommendations: z
    .array(
      z.object({
        recommendationId: z.string(),
        metricRef: z.string(),
        action: z.enum([
          'rename',
          'merge-with',
          'split-into',
          'reassign-owner',
          'deprecate',
          'promote-canonical',
          'document-better',
        ]),
        rationaleMarkdown: z.string(),
        affectedConsumerRefs: z.array(z.string()),
      })
    )
    .min(0),
  deprecationPlan: z.object({
    summaryMarkdown: z.string(),
    deprecatedMetrics: z
      .array(
        z.object({
          metricRef: z.string(),
          replacementMetricRef: z.string().optional(),
          sunsetDateIso: z.string(),
          consumerMigrationNotes: z.string(),
        })
      )
      .min(0),
  }),
  reviews: z.object({
    analyticsLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
    dataPm: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    curationPullRequestUrl: z.string(),
    announcementUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type MetricsCatalogReviewInput = z.infer<typeof MetricsCatalogReviewInputSchema>
export type MetricsCatalogCurationOutput = z.infer<typeof MetricsCatalogCurationOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_catalogCoherence: RewardSignal = {
  keyResultRef: 'kr:metrics-catalog-curator:metrics-catalog-coherence-score-improvement',
}
const kr_catalogCoverage: RewardSignal = {
  keyResultRef: 'kr:metrics-catalog-curator:catalog-coverage',
}
const kr_driftPrecision: RewardSignal = {
  keyResultRef: 'kr:metrics-catalog-curator:drift-detection-precision',
}
const kr_curationRationale: RewardSignal = {
  keyResultRef: 'kr:metrics-catalog-curator:curation-rationale-clarity',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:metrics-catalog-curator:emit-latency',
}

// ============================================================================
// Metrics Catalog Curator Service
// ============================================================================

/**
 * Metrics Catalog Curator — weekly cron / new metric PR / semantic-layer
 * drift alert → analytics-lead + data-PM signed curation plan with name-
 * collision flags + definition-divergence flags + ownership-gap flags +
 * deprecation plan as a Service.
 *
 * Cascade: fetch-current-metrics-catalog-and-recent-usage-and-business-context (Code, fan-in)
 *        → detect-drift-name-collisions-definition-divergence-and-ownership-gaps (Generative)
 *        → draft-curation-recommendations-and-deprecation-plan (Generative)
 *        → analytics-lead-and-data-PM-review (Human, approval rationale)
 *        → emit-curation-PR-and-announcement (Code, fan-out).
 */
export const metricsCatalogCurator: ServiceInstance<
  MetricsCatalogReviewInput,
  MetricsCatalogCurationOutput
> = Service.define<MetricsCatalogReviewInput, MetricsCatalogCurationOutput>({
  name: 'Metrics Catalog Curator',
  promise:
    'Every week (and every drift alert) the analytics team gets an analytics-lead-signed metrics-catalog curation plan — name-collision flags + definition-divergence flags + ownership-gap flags + deprecation plan — so the catalog converges on canonical, owned, stable metrics instead of drifting into ambiguity.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: MetricsCatalogReviewInputSchema,
    output: MetricsCatalogCurationOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-current-metrics-catalog-and-recent-usage-and-business-context',
        reward: kr_catalogCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'detect-drift-name-collisions-definition-divergence-and-ownership-gaps',
        reward: kr_driftPrecision,
      }),
      Generative({
        name: 'draft-curation-recommendations-and-deprecation-plan',
        reward: kr_curationRationale,
      }),
      Human({
        name: 'analytics-lead-and-data-PM-review',
        // `approval` rationale: the analytics-lead owns the metrics-catalog
        // ownership envelope; the data-PM owns the business-context envelope.
        // Every curation PR routes through both reviewers before merging
        // into main. The gate stays human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-curation-PR-and-announcement',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'metrics-catalog.read',
      'metrics-catalog.write',
      'semantic-layer.read',
      'query-log.read',
      'business-context.read',
      'github.pulls',
      'github.contents',
      'docs.write',
      'announcement-channel.write',
    ],
    // Catalog curation: clarification disabled — the cascade synthesises
    // from the catalog + usage + business-context signals; the analytics-
    // lead + data-PM review step is the single human contact point in the
    // cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Drift-alert-triggered reviews escalate the drift-detection step
        // to a senior analytics-engineering supervisor before the routine
        // analytics-lead + data-PM review (the lead + PM still sign, but
        // the supervisor backstops the synthesis on alert-driven reviews
        // where catalog incoherence has already breached threshold).
        when: 'triggerKind == "semantic-layer-drift-alert"',
        action: 'escalate',
      },
      {
        // Every review routes through analytics-lead + data-PM review
        // before the curation PR emits and the announcement fans out;
        // OutcomeContract enforces the analytics-lead signature, the
        // trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'analytics-lead-and-data-PM-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:metrics-catalog-curator-review',
    personas: [
      // Drift-detection-precision reviewer — pedantic check that every
      // drift finding is grounded in the catalog snapshot (every name-
      // collision cites the colliding metric refs, every definition-
      // divergence cites previous + current definition refs, every
      // ownership-gap cites the metric ref) and that no obvious drift
      // was silently skipped. The risk this guards against is "false-
      // positive drift findings" or "missed drift".
      Personas.pedantic({
        domain: 'drift-detection-precision',
        rubric: [
          'every-name-collision-cites-colliding-refs',
          'every-divergence-cites-previous-and-current',
          'every-ownership-gap-cites-metric-ref',
          'no-false-positive-drift',
          'no-silent-drift-omission',
          'breaking-change-flag-justified',
        ],
        name: 'drift-detection-precision-checker',
      }),
      // Curation-rationale-clarity reviewer — adversarially probes whether
      // every curation recommendation has a concrete rationale (cites the
      // drift finding it addresses, names the affected consumers, names
      // the migration path) vs. surface-level "deprecate this" hand-
      // waving.
      Personas.skeptic({
        domain: 'curation-rationale-clarity',
        focus: [
          'every-recommendation-cites-drift-finding',
          'every-recommendation-names-affected-consumers',
          'every-deprecation-has-migration-path',
          'every-promote-canonical-justifies-vs-alternatives',
          'no-hand-waves',
        ],
        name: 'curation-rationale-clarity-reviewer',
      }),
      // Analytics-domain reviewer — pulls the senior-analytics-lead
      // expert for judgment on the overall curation-plan quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/StatisticalAssistants',
        name: 'analytics-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:metrics-catalog-curator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-analytics-lead',
    seller: 'svc:metrics-catalog-curator',
    serviceRef: 'svc:metrics-catalog-curator',
    // Analytics-lead signs every curation PR before merging — metrics-
    // catalog ownership authority cannot be delegated.
    predicate: AND(
      SchemaMatch(MetricsCatalogCurationOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['analytics-lead'] })
    ),
    amount: { amount: 89900n, currency: 'USD' },
    // 7-day SLA — catalog curation runs on weekly rhythms; the curation
    // PR lands inside one rotation so drift doesn't accumulate.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'metrics-catalog-curator-monthly',
      amount: 89900n,
      currency: 'USD',
      interval: 'month',
    },
    // Metered overage — curation PRs emitted beyond the implicit weekly-
    // cron baseline charge $199 each. The metering runtime resolves
    // `curation-pr-emitted` to invocations beyond the monthly baseline
    // and lines them on the monthly invoice.
    metered: [
      {
        event: 'curation-pr-emitted',
        amount: 19900n,
        description:
          'Curation PR emitted beyond the bundled weekly-cron baseline (drift-alert / new-metric-PR triggered).',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 16n },
  reward: kr_catalogCoherence,

  lineage: {
    cellRef: 'business.org.ai/cells/analytics-leads/metrics-catalog-curator',
    icpContextProblemRef: 'icp:metrics-catalog-curator:v1',
    foundingHypothesisRef: 'fh:metrics-catalog-curator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
