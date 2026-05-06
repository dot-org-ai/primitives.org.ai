/**
 * Capacity Planner Service — quarterly infra capacity-planning Service for
 * the operations catalog.
 *
 * Distinguishing shape vs. siblings (`incident-commander`,
 * `oncall-handoff-narrator`):
 *   - `forecast-narrative` archetype — the artefact is an infra-leader-
 *     approved capacity plan with cost-impact scenarios + procurement
 *     tickets created, not an in-incident mitigation plan or a weekly
 *     handoff doc;
 *   - 5-step cascade: Code fan-in (current utilization + historical trend +
 *     projected growth) → Generative (bottleneck narrative + recommended
 *     capacity changes) → Generative (cost-impact analysis + scenario
 *     tradeoffs) → Human (infra-leader approves) → Code (emit capacity plan +
 *     create procurement tickets);
 *   - `Pricing.subscription` — a recurring infra-team subscription
 *     ($799/mo) plus metered overage at $299 per ad-hoc planning request
 *     above the quarterly cadence baseline (one ad-hoc request per quarter
 *     is a common shape — re-plan when traffic forecasts shift mid-quarter);
 *   - declarative HITL = mandatory infra-leader approval Human Function
 *     (the infra-leader owns the procurement-budget envelope), plus
 *     OutcomeContract requires infra-leader signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(scenario-realism +
 *     cost-analysis-soundness) + HumanSign(infra-leader))`.
 *
 * Per design v3 §3 (Catalog HOW operations) + §6 (binding triggers,
 * conditional HumanSign) + §7 (subscription pricing factory with metered
 * overage) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `capacity-incident-rate-reduction` — the compound
 * metric every infra org optimises against (the planner is worth running
 * iff capacity-driven incidents — saturation, bottleneck-induced cascading
 * failure — drop vs. the pre-Service baseline).
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
 * Input — a quarterly cron firing at capacity-review-due. Tight: 7 fields
 * cover the infra-team identity, the planning horizon, the in-scope
 * services + resource classes (so the cascade fans-in to the right
 * utilisation slice), the projected-growth assumptions the planner
 * synthesises against, the procurement-budget envelope, and the assigned
 * infra-leader (so the Human approval routes to the right inbox).
 */
export const CapacityReviewInputSchema = z.object({
  infraTeamRef: z.string(),
  reviewKind: z.enum(['quarterly', 'ad-hoc']),
  planningHorizon: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  inScopeServices: z.array(z.string()).min(1),
  resourceClasses: z
    .array(z.enum(['compute', 'memory', 'storage', 'network', 'gpu', 'database', 'queue']))
    .min(1),
  projectedGrowth: z.object({
    trafficGrowthPercent: z.number(),
    netNewCustomerCount: z.number().int().nonnegative(),
    netNewProductLines: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
  procurementBudgetEnvelopeCents: z.bigint(),
  assignedInfraLeaderRef: z.string(),
})

/**
 * Output — an infra-leader-approved capacity plan: the current-utilisation
 * snapshot, the bottleneck narrative + recommended capacity changes, the
 * cost-impact analysis with scenario tradeoffs, the infra-leader review
 * audit, the emitted capacity-plan artefact, and the created procurement
 * tickets.
 */
export const CapacityPlanOutputSchema = z.object({
  infraTeamRef: z.string(),
  planningHorizon: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  utilisationSnapshot: z.array(
    z.object({
      serviceRef: z.string(),
      resourceClass: z.enum([
        'compute',
        'memory',
        'storage',
        'network',
        'gpu',
        'database',
        'queue',
      ]),
      currentUtilisationPercent: z.number().min(0).max(200),
      historicalP95Percent: z.number().min(0).max(200),
      projectedP95Percent: z.number().min(0).max(300),
    })
  ),
  bottleneckNarrative: z.object({
    summaryMarkdown: z.string(),
    bottlenecks: z
      .array(
        z.object({
          bottleneckId: z.string(),
          serviceRef: z.string(),
          resourceClass: z.string(),
          severity: z.enum(['low', 'med', 'high']),
          rationale: z.string(),
        })
      )
      .min(0),
  }),
  recommendedChanges: z
    .array(
      z.object({
        changeId: z.string(),
        serviceRef: z.string(),
        resourceClass: z.string(),
        action: z.enum(['scale-up', 'scale-out', 'rearchitect', 'shed-load', 'no-op']),
        targetCapacity: z.string(),
        rationale: z.string(),
      })
    )
    .min(0),
  costImpact: z.object({
    scenarios: z
      .array(
        z.object({
          scenarioId: z.string(),
          label: z.string(),
          projectedRunRateCents: z.bigint(),
          deltaVsCurrentCents: z.bigint(),
          tradeoffNotes: z.string(),
        })
      )
      .min(1),
    recommendedScenarioId: z.string(),
    fitsBudgetEnvelope: z.boolean(),
  }),
  infraLeaderApproval: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  procurementTickets: z.array(
    z.object({
      ticketRef: z.string(),
      changeId: z.string(),
      tracker: z.enum(['jira', 'linear', 'github', 'servicenow']),
      createdAt: z.string(),
    })
  ),
  capacityPlanArtefact: z.object({
    pdfUrl: z.string(),
    dashboardUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type CapacityReviewInput = z.infer<typeof CapacityReviewInputSchema>
export type CapacityPlanOutput = z.infer<typeof CapacityPlanOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_capacityIncidentRate: RewardSignal = {
  keyResultRef: 'kr:capacity-planner:capacity-incident-rate-reduction',
}
const kr_utilisationCoverage: RewardSignal = {
  keyResultRef: 'kr:capacity-planner:utilisation-coverage',
}
const kr_bottleneckQuality: RewardSignal = {
  keyResultRef: 'kr:capacity-planner:bottleneck-narrative-quality',
}
const kr_costAnalysisSoundness: RewardSignal = {
  keyResultRef: 'kr:capacity-planner:cost-analysis-soundness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:capacity-planner:emit-latency',
}

// ============================================================================
// Capacity Planner Service
// ============================================================================

/**
 * Capacity Planner — quarterly cron + capacity-review-due → infra-leader-
 * approved capacity plan with cost-impact scenarios + procurement tickets
 * created as a Service.
 *
 * Cascade: fetch-current-utilization-historical-trend-and-projected-growth (Code, fan-in)
 *        → synthesize-bottleneck-narrative-and-recommended-capacity-changes (Generative)
 *        → cost-impact-analysis-with-scenario-tradeoffs (Generative)
 *        → infra-leader-approves (Human, approval rationale)
 *        → emit-capacity-plan-and-create-procurement-tickets (Code, fan-out).
 */
export const capacityPlanner: ServiceInstance<CapacityReviewInput, CapacityPlanOutput> =
  Service.define<CapacityReviewInput, CapacityPlanOutput>({
    name: 'Capacity Planner',
    promise:
      'Every quarter (and every ad-hoc forecast shift) the infra team gets a leader-approved capacity plan — bottleneck narrative + recommended changes + cost-impact scenarios + procurement tickets — so capacity is planned a quarter ahead instead of reacted-to under saturation.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: CapacityReviewInputSchema, output: CapacityPlanOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-current-utilization-historical-trend-and-projected-growth',
          reward: kr_utilisationCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-bottleneck-narrative-and-recommended-capacity-changes',
          reward: kr_bottleneckQuality,
        }),
        Generative({
          name: 'cost-impact-analysis-with-scenario-tradeoffs',
          reward: kr_costAnalysisSoundness,
        }),
        Human({
          name: 'infra-leader-approves',
          // `approval` rationale: the infra-leader owns the
          // procurement-budget envelope; the recommended scenario commits
          // real spend. The gate stays human.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-capacity-plan-and-create-procurement-tickets',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'datadog.metrics',
        'newrelic.metrics',
        'cloudwatch.metrics',
        'prometheus.query',
        'service-graph.read',
        'cloud-billing.read',
        'jira.issues',
        'linear.issues',
        'servicenow.tickets',
        'docs.write',
      ],
      // Quarterly + ad-hoc cadence: clarification disabled — the cascade
      // synthesises from the utilisation + trend + growth signals; the
      // infra-leader review step is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Plans that don't fit the procurement-budget envelope escalate
          // the cost-impact step to a senior FinOps supervisor before the
          // infra-leader review (the leader still signs, but the FinOps
          // supervisor backstops the scenario quality on budget-strained
          // plans).
          when: 'costImpact.fitsBudgetEnvelope == false',
          action: 'escalate',
        },
        {
          // Every plan routes through infra-leader approval before
          // procurement tickets create; OutcomeContract enforces the
          // signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'infra-leader-approves',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:capacity-planner-review',
      personas: [
        // Scenario-realism reviewer — adversarially probes whether the
        // cost-impact scenarios are realistic (cite real instance types,
        // real reserved-capacity discounts, real cross-region cost deltas)
        // vs. round-number "the cloud bill goes up 20%" hand-waving.
        Personas.skeptic({
          domain: 'scenario-realism',
          focus: [
            'cites-real-instance-types',
            'cites-real-discounts',
            'no-round-number-hand-waves',
          ],
          name: 'scenario-realism-reviewer',
        }),
        // Cost-analysis-soundness reviewer — pedantic check that every
        // scenario's run-rate is computed from the recommended changes
        // (not pulled from thin air), every delta-vs-current is signed
        // correctly, and the recommended scenario is the one that
        // optimises capacity-headroom-per-dollar.
        Personas.pedantic({
          domain: 'cost-analysis-soundness',
          rubric: [
            'every-scenario-run-rate-derived-from-changes',
            'delta-signs-correct',
            'recommended-scenario-justified',
            'fits-budget-envelope-flag-correct',
            'no-double-counted-savings',
          ],
          name: 'cost-analysis-soundness-checker',
        }),
        // Utilisation-grounding reviewer — pedantic check that every
        // recommended capacity change cites the underlying utilisation
        // snapshot (current + historical-p95 + projected-p95) rather than
        // hand-waved "feels saturated" anecdotes.
        Personas.pedantic({
          domain: 'utilisation-grounding',
          rubric: [
            'every-change-cites-utilisation-snapshot',
            'projected-p95-exceeds-historical-p95-justifies-scale',
            'no-scale-without-bottleneck-evidence',
            'no-bottleneck-without-utilisation-evidence',
          ],
          name: 'utilisation-grounding-checker',
        }),
        // Infra domain reviewer — pulls the senior-infra-architect expert
        // for judgment on the overall capacity-plan quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/ComputerNetworkArchitects',
          name: 'infra-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:capacity-planner:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-infra-leader',
      seller: 'svc:capacity-planner',
      serviceRef: 'svc:capacity-planner',
      // Infra-leader signs every capacity plan before procurement tickets
      // create — procurement-budget authority cannot be delegated.
      predicate: AND(
        SchemaMatch(CapacityPlanOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['infra-leader'] })
      ),
      amount: { amount: 79900n, currency: 'USD' },
      // 14-day SLA — quarterly cadence + scenario-tradeoffs depth means
      // the plan ships within a fortnight of the review trigger.
      timeoutDays: 14,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'capacity-planner-monthly',
        amount: 79900n,
        currency: 'USD',
        interval: 'month',
      },
      // Metered overage — ad-hoc planning requests above the quarterly
      // cadence baseline charge $299 each. The metering runtime resolves
      // `ad-hoc-planning-request` to invocations beyond the implicit one-
      // per-quarter baseline and lines them on the monthly invoice.
      metered: [
        {
          event: 'ad-hoc-planning-request',
          amount: 29900n,
          description: 'Ad-hoc capacity-planning request beyond the quarterly cadence baseline.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 8000n, perApiCall: 14n },
    reward: kr_capacityIncidentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/infrastructure-managers/capacity-planner',
      icpContextProblemRef: 'icp:capacity-planner:v1',
      foundingHypothesisRef: 'fh:capacity-planner:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
