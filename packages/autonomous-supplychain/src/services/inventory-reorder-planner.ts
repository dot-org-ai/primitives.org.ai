/**
 * Inventory Reorder Planner Service — multi-SKU reorder optimization for the
 * procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`):
 *   - `forecast-narrative` archetype — the artefact is an operations-manager-
 *     signed reorder batch (PO-set + supplier allocation + safety-stock
 *     rationale + scenario analysis), not a vendor onboarding packet or a
 *     PO routing decision;
 *   - 5-step cascade: Code fan-in (current inventory + sales velocity + lead
 *     times + supplier MOQs) → Generative (synthesise reorder recommendations
 *     + safety-stock rationale + scenario analysis on demand shifts) →
 *     Generative (draft reorder batch + supplier allocation) → Human
 *     (operations-manager review and confirm) → Code (emit reorder-batch POs
 *     + supplier notifications);
 *   - `Pricing.percentOf` keyed on the realised reorder-batch amount — 1%
 *     (100 bps) of `reorder-batch-amount`, capped at $20k per cycle — the
 *     planner's compensation tracks the value of the inventory it's
 *     reorganising;
 *   - declarative HITL = mandatory operations-manager review (the operations-
 *     manager owns the working-capital / supplier-allocation envelope —
 *     `approval` rationale, not `regulatory` / `premium`), plus
 *     OutcomeContract requires operations-manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(forecast-realism +
 *     safety-stock-rationale + supplier-allocation-soundness +
 *     budgetRealism + timelineRealism) + HumanSign(operations-manager))`;
 *   - EvaluatorPanel includes `Personas.budgetRealism({ budgetType: 'cost' })`
 *     and `Personas.timelineRealism({ dependencyAware: true })` because
 *     reorder plans carry explicit cost claims (per-line PO totals) and
 *     timeline claims (lead-time-to-arrival) that must survive a realism
 *     audit before the operations-manager signs.
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * conditional HumanSign) + §7 (percent-of pricing factory with cap) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `stockout-rate-reduction-and-inventory-carrying-
 * cost-improvement` — the compound metric every supply-chain org optimises
 * against (the planner is worth running iff stockout rate drops AND
 * inventory carrying cost improves vs. the pre-Service baseline; reductions
 * in stockouts that come at the cost of bloated carrying cost are not
 * improvements).
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
 * Input — a reorder cycle triggered by a weekly cron, a low-stock alert, or a
 * demand-forecast update. Tight: 8 fields cover the cycle identity, the
 * trigger kind, the SKU scope (subset or full catalog), the inventory + sales
 * + lead-time data sources the cascade fans-in over, the supplier-network
 * pointer, the working-capital ceiling, the assigned operations manager, and
 * the trigger stage gating intake.
 */
export const InventoryReorderCycleInputSchema = z.object({
  cycleId: z.string(),
  triggerKind: z.enum(['weekly-cron', 'low-stock-alert', 'demand-forecast-update']),
  skuScope: z.object({
    scopeKind: z.enum(['full-catalog', 'category-subset', 'sku-subset', 'low-stock-only']),
    categoryRefs: z.array(z.string()).default([]),
    skuRefs: z.array(z.string()).default([]),
  }),
  dataSources: z.object({
    inventorySystemRef: z.string(),
    salesVelocityWindowDays: z.number().int().positive(),
    leadTimeRegistryRef: z.string(),
    forecastSystemRef: z.string().optional(),
  }),
  supplierNetwork: z.object({
    supplierDirectoryRef: z.string(),
    moqRegistryRef: z.string(),
    contractRegistryRef: z.string(),
  }),
  workingCapitalCeiling: z.object({
    cycleCeilingUsd: z.number().nonnegative(),
    runwayWeeksMin: z.number().int().positive(),
  }),
  assignedOperationsManagerRef: z.string(),
  triggerStage: z.literal('reorder-cycle'),
})

/**
 * Output — an operations-manager-signed reorder batch: the fetched inventory
 * + velocity + lead-time + MOQ snapshot, the per-SKU reorder recommendations
 * with safety-stock rationale + scenario analysis, the drafted reorder batch
 * + supplier allocation, the operations-manager review audit, and pointers to
 * the emitted reorder-batch POs + supplier notifications.
 */
export const InventoryReorderPlanOutputSchema = z.object({
  cycleId: z.string(),
  inventorySnapshot: z.object({
    snapshotIso: z.string(),
    skusEvaluated: z.number().int().nonnegative(),
    skusAtOrBelowReorderPoint: z.number().int().nonnegative(),
    skusAtRiskOfStockout: z.number().int().nonnegative(),
  }),
  reorderRecommendations: z
    .array(
      z.object({
        recommendationId: z.string(),
        skuRef: z.string(),
        currentOnHand: z.number().nonnegative(),
        salesVelocityPerWeek: z.number().nonnegative(),
        leadTimeDays: z.number().int().nonnegative(),
        recommendedReorderQty: z.number().nonnegative(),
        recommendedSafetyStockUnits: z.number().nonnegative(),
        safetyStockRationaleMarkdown: z.string(),
        scenarioAnalysis: z.object({
          baselineDemand: z.object({
            outcome: z.enum(['ok', 'stockout-risk', 'overstock-risk']),
            narrative: z.string(),
          }),
          demandUp25Pct: z.object({
            outcome: z.enum(['ok', 'stockout-risk', 'overstock-risk']),
            narrative: z.string(),
          }),
          demandDown25Pct: z.object({
            outcome: z.enum(['ok', 'stockout-risk', 'overstock-risk']),
            narrative: z.string(),
          }),
        }),
      })
    )
    .min(1),
  reorderBatch: z.object({
    batchId: z.string(),
    cycleTotalUsd: z.number().nonnegative(),
    perSupplierAllocations: z
      .array(
        z.object({
          allocationId: z.string(),
          supplierRef: z.string(),
          allocatedSkuLines: z
            .array(
              z.object({
                lineId: z.string(),
                skuRef: z.string(),
                quantity: z.number().nonnegative(),
                unitCostUsd: z.number().nonnegative(),
                lineTotalUsd: z.number().nonnegative(),
                meetsMoq: z.boolean(),
              })
            )
            .min(1),
          allocationTotalUsd: z.number().nonnegative(),
          allocationRationaleMarkdown: z.string(),
        })
      )
      .min(1),
    workingCapitalUtilisationPct: z.number().nonnegative(),
  }),
  operationsManagerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['confirm', 'confirm-subset', 'request-edit', 'reject']),
    confirmedAllocationIds: z.array(z.string()),
    notes: z.string().optional(),
    confirmedAt: z.string(),
  }),
  artefacts: z.object({
    emittedPoRefs: z.array(z.string()).min(1),
    supplierNotificationRefs: z.array(z.string()).min(1),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type InventoryReorderCycleInput = z.infer<typeof InventoryReorderCycleInputSchema>
export type InventoryReorderPlanOutput = z.infer<typeof InventoryReorderPlanOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_stockoutAndCarryingCost: RewardSignal = {
  keyResultRef:
    'kr:inventory-reorder-planner:stockout-rate-reduction-and-inventory-carrying-cost-improvement',
}
const kr_dataCoverage: RewardSignal = {
  keyResultRef: 'kr:inventory-reorder-planner:data-coverage',
}
const kr_recommendationQuality: RewardSignal = {
  keyResultRef: 'kr:inventory-reorder-planner:recommendation-quality',
}
const kr_allocationSoundness: RewardSignal = {
  keyResultRef: 'kr:inventory-reorder-planner:allocation-soundness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:inventory-reorder-planner:emit-latency',
}

// ============================================================================
// Inventory Reorder Planner Service
// ============================================================================

/**
 * Inventory Reorder Planner — weekly cron / low-stock alert / demand-
 * forecast update → operations-manager-signed reorder batch (POs + supplier
 * allocation) with safety-stock rationale + scenario analysis as a Service.
 *
 * Cascade: fetch-current-inventory-sales-velocity-lead-times-and-supplier-MOQs (Code, fan-in)
 *        → synthesize-reorder-recommendations-safety-stock-rationale-and-scenario-analysis-on-demand-shifts (Generative)
 *        → draft-reorder-batch-and-supplier-allocation (Generative)
 *        → operations-manager-review-and-confirm (Human, approval rationale)
 *        → emit-reorder-batch-pos-and-supplier-notifications (Code, fan-out).
 */
export const inventoryReorderPlanner: ServiceInstance<
  InventoryReorderCycleInput,
  InventoryReorderPlanOutput
> = Service.define<InventoryReorderCycleInput, InventoryReorderPlanOutput>({
  name: 'Inventory Reorder Planner',
  promise:
    'Every reorder cycle (weekly cron / low-stock alert / forecast update) lands an operations-manager-signed reorder batch — POs grouped by supplier with safety-stock rationale + scenario analysis on demand shifts — so stockout rate drops without bloating carrying cost.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: InventoryReorderCycleInputSchema,
    output: InventoryReorderPlanOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-current-inventory-sales-velocity-lead-times-and-supplier-MOQs',
        reward: kr_dataCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-reorder-recommendations-safety-stock-rationale-and-scenario-analysis-on-demand-shifts',
        reward: kr_recommendationQuality,
      }),
      Generative({
        name: 'draft-reorder-batch-and-supplier-allocation',
        reward: kr_allocationSoundness,
      }),
      Human({
        name: 'operations-manager-review-and-confirm',
        // `approval` rationale: the operations-manager owns the working-
        // capital / supplier-allocation envelope. Every reorder batch
        // routes through ops-manager confirmation before POs emit and
        // supplier notifications fire. The gate stays human regardless of
        // model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-reorder-batch-pos-and-supplier-notifications',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'inventory-system.read',
      'sales-system.read',
      'forecast-system.read',
      'lead-time-registry.read',
      'supplier-directory.read',
      'moq-registry.read',
      'contract-registry.read',
      'procurement-system.write',
      'supplier-notification-channel.write',
    ],
    // Reorder planning: clarification disabled — the cascade synthesises
    // from inventory + velocity + lead-times + MOQs; the operations-
    // manager review step is the single human contact point in the
    // cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Low-stock-alert-triggered cycles escalate the recommendation +
        // allocation steps to a senior supply-chain supervisor before the
        // routine operations-manager review (the manager still confirms,
        // but the supervisor backstops the synthesis on alert-driven
        // cycles where stockout risk has already breached threshold).
        when: 'triggerKind == "low-stock-alert"',
        action: 'escalate',
      },
      {
        // Every cycle routes through operations-manager review before the
        // reorder-batch POs emit and supplier notifications fan out;
        // OutcomeContract enforces the manager signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'operations-manager-review-and-confirm',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:inventory-reorder-planner-review',
    personas: [
      // Forecast-realism reviewer — pedantic check that every reorder
      // recommendation is grounded in the on-hand + velocity + lead-time
      // snapshot (no recommendation invents demand the data doesn't
      // support, no scenario claims an outcome without a narrative).
      Personas.pedantic({
        domain: 'forecast-realism',
        rubric: [
          'every-recommendation-cites-on-hand-and-velocity',
          'lead-time-applied-to-reorder-quantity',
          'scenario-analysis-present-for-each-sku',
          'baseline-up25-down25-scenarios-narrated',
          'no-invented-demand-without-source',
          'no-flat-zero-velocity-recommendations',
        ],
        name: 'forecast-realism-checker',
      }),
      // Safety-stock-rationale reviewer — adversarially probes whether
      // every safety-stock recommendation has a concrete rationale (cites
      // the lead-time variance, the demand variance, the service-level
      // target) vs. surface-level "add 30%" hand-waving.
      Personas.skeptic({
        domain: 'safety-stock-rationale',
        focus: [
          'safety-stock-cites-lead-time-variance',
          'safety-stock-cites-demand-variance',
          'service-level-target-named',
          'no-flat-percentage-padding',
          'rationale-traceable-to-snapshot',
        ],
        name: 'safety-stock-rationale-reviewer',
      }),
      // Supplier-allocation-soundness reviewer — adversarial probe that
      // every supplier allocation respects MOQs (or explicitly flags non-
      // compliance), allocates SKUs to the right supplier per the contract
      // registry, and provides a per-allocation rationale.
      Personas.skeptic({
        domain: 'supplier-allocation-soundness',
        focus: [
          'every-line-flags-moq-compliance',
          'allocations-respect-contracted-supplier-mapping',
          'allocation-rationale-cites-cost-or-lead-time',
          'no-cross-supplier-duplication-without-rationale',
          'working-capital-utilisation-within-ceiling',
        ],
        name: 'supplier-allocation-soundness-reviewer',
      }),
      // Budget-realism reviewer — the reorder batch carries explicit cost
      // claims (per-line PO totals, cycle-total USD) that must survive a
      // cost-axis realism audit.
      Personas.budgetRealism({
        budgetType: 'cost',
        name: 'budget-realism-checker',
      }),
      // Timeline-realism reviewer — dependency-aware schedule realism
      // covering lead-time-to-arrival sequencing across SKUs and
      // suppliers.
      Personas.timelineRealism({
        dependencyAware: true,
        name: 'timeline-realism-checker',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:inventory-reorder-planner:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-operations-manager',
    seller: 'svc:inventory-reorder-planner',
    serviceRef: 'svc:inventory-reorder-planner',
    // Operations-manager signs every reorder batch before POs emit —
    // working-capital + supplier-allocation authority cannot be delegated.
    predicate: AND(
      SchemaMatch(InventoryReorderPlanOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['operations-manager'] })
    ),
    // Mid-tier amount placeholder; per-cycle billing resolves through the
    // percent-of pricing factory below at settlement time.
    amount: { amount: 100000n, currency: 'USD' },
    // 3-day SLA — reorder cycles land inside half a workweek so supplier
    // lead times don't compound the cycle latency.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  // Percent-of pricing — 1% (100 bps) of the realised reorder-batch amount,
  // capped at $20k per cycle. The metering runtime resolves the
  // `reorder-batch-amount` basis to the realised reorder-batch USD at
  // settlement time and computes the charge as
  // `(reorder_batch_amount * 100) / 10000`, clamped by `cap` at $20k.
  pricing: Pricing.percentOf({
    basis: 'reorder-batch-amount',
    rateBasisPoints: 100,
    cap: { amount: 2_000_000n, currency: 'USD' },
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 12000n, perApiCall: 20n },
  reward: kr_stockoutAndCarryingCost,

  lineage: {
    cellRef: 'business.org.ai/cells/supply-chain/inventory-reorder-planner',
    icpContextProblemRef: 'icp:inventory-reorder-planner:v1',
    foundingHypothesisRef: 'fh:inventory-reorder-planner:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
