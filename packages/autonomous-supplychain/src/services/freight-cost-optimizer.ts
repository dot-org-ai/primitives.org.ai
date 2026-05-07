/**
 * Freight Cost Optimizer Service — multi-leg freight routing + carrier
 * selection for the procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`, `inventory-reorder-planner`,
 * `supplier-risk-monitor`, `customs-compliance-filer`):
 *   - `multi-step-research` archetype — the artefact is an operations-manager-
 *     reviewed multi-leg routing plan with cost-time tradeoffs, second-best
 *     alternative, and reliability scoring per carrier, not a vendor packet,
 *     a routing decision, a reorder plan, or a per-supplier risk narrative;
 *   - 5-step cascade: Code fan-in (shipment batch + carrier rates + transit-
 *     time history + fuel-surcharge volatility + customs context) → Generative
 *     (synthesise routing options with cost-time tradeoffs + reliability
 *     scoring) → Generative (draft recommendation with second-best + rationale)
 *     → Human (operations-manager review on cost threshold) → Code fan-out
 *     (routing plan + carrier bookings);
 *   - `Pricing.percentOf` keyed on the realised freight spend routed — 2.5%
 *     (250 basis points) of `freight-spend-routed`, capped at $40k per cycle —
 *     the optimizer's compensation tracks the spend it's routing rather than
 *     a flat per-shipment fee;
 *   - declarative HITL = operations-manager review (the operations-manager
 *     owns the operational-cost envelope — `approval` rationale, not
 *     `regulatory` / `premium`), conditional on a cost threshold; OutcomeContract
 *     requires operations-manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(cost-optimization-
 *     soundness + reliability-scoring + tradeoff-transparency + budgetRealism +
 *     timelineRealism) + HumanSign(operations-manager))`;
 *   - EvaluatorPanel includes `Personas.budgetRealism({ budgetType: 'cost' })`
 *     and `Personas.timelineRealism({ dependencyAware: true })` because
 *     freight routing plans carry explicit cost claims (per-leg carrier-rate
 *     totals) and timeline claims (per-leg transit-time-to-delivery) that must
 *     survive a realism audit before the operations-manager signs.
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * conditional HumanSign) + §7 (percent-of pricing factory with cap) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `landed-cost-per-unit-improvement` — the compound
 * metric every supply-chain org optimises against (the optimizer is worth
 * running iff landed-cost-per-unit drops vs. the pre-Service baseline; cost
 * gains that come at the cost of reliability collapse are not improvements
 * — the EvaluatorPanel's reliability-scoring + tradeoff-transparency
 * personas guard against that failure mode).
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
 * Input — a freight-routing cycle triggered by a shipment batch ready event
 * or a weekly route-optimization cycle. Tight: 8 fields cover the cycle
 * identity, the trigger kind, the shipment-batch scope, the data sources
 * the cascade fans-in over, the carrier-network pointer, the cost-threshold
 * gating operations-manager review, the assigned operations manager, and the
 * trigger stage gating intake.
 */
export const FreightOptimizationCycleInputSchema = z.object({
  cycleId: z.string(),
  triggerKind: z.enum(['shipment-batch-ready', 'weekly-route-optimization']),
  shipmentBatch: z.object({
    batchRef: z.string(),
    shipmentLines: z
      .array(
        z.object({
          lineId: z.string(),
          originCountry: z.string(),
          destinationCountry: z.string(),
          incoterm: z.enum(['EXW', 'FCA', 'FOB', 'CIF', 'CIP', 'DAP', 'DPU', 'DDP']),
          weightKg: z.number().nonnegative(),
          volumeM3: z.number().nonnegative(),
          dangerous: z.boolean(),
          temperatureControlled: z.boolean(),
          neededByIso: z.string(),
        })
      )
      .min(1),
    totalDeclaredValueUsd: z.number().nonnegative(),
  }),
  dataSources: z.object({
    carrierRateCardRef: z.string(),
    transitTimeHistoryRef: z.string(),
    fuelSurchargeFeedRef: z.string(),
    customsContextRef: z.string(),
  }),
  carrierNetwork: z.object({
    eligibleCarrierRefs: z.array(z.string()).min(1),
    contractedCarrierRefs: z.array(z.string()).default([]),
  }),
  reviewThresholds: z.object({
    operationsManagerReviewCostUsd: z.number().nonnegative(),
    cycleCapUsd: z.number().nonnegative(),
  }),
  assignedOperationsManagerRef: z.string(),
  triggerStage: z.literal('freight-optimization-cycle'),
})

/**
 * Output — an operations-manager-reviewed multi-leg routing plan: the
 * fetched shipment-batch + carrier-rate + transit-time + fuel-surcharge
 * snapshot, the synthesised routing options (with reliability scoring +
 * cost-time tradeoffs), the recommended option with a second-best
 * alternative + rationale, the operations-manager review, and pointers to
 * the emitted routing plan + carrier bookings.
 */
export const FreightRoutingPlanOutputSchema = z.object({
  cycleId: z.string(),
  optimizationSnapshot: z.object({
    snapshotIso: z.string(),
    shipmentLinesEvaluated: z.number().int().nonnegative(),
    carriersEvaluated: z.number().int().nonnegative(),
    routingOptionsConsidered: z.number().int().nonnegative(),
  }),
  routingOptions: z
    .array(
      z.object({
        optionId: z.string(),
        legs: z
          .array(
            z.object({
              legId: z.string(),
              shipmentLineRefs: z.array(z.string()).min(1),
              carrierRef: z.string(),
              modality: z.enum(['ocean', 'air', 'rail', 'truck-ftl', 'truck-ltl', 'parcel']),
              originHub: z.string(),
              destinationHub: z.string(),
              estimatedTransitDays: z.number().nonnegative(),
              quotedCostUsd: z.number().nonnegative(),
              fuelSurchargePctApplied: z.number().nonnegative(),
            })
          )
          .min(1),
        totalCostUsd: z.number().nonnegative(),
        worstCaseTransitDays: z.number().nonnegative(),
        reliabilityScore: z.object({
          score: z.number().min(0).max(1),
          rationaleMarkdown: z.string(),
          historicalOnTimePct: z.number().min(0).max(1),
        }),
        costTimeTradeoffMarkdown: z.string(),
      })
    )
    .min(2),
  recommendation: z.object({
    recommendedOptionId: z.string(),
    secondBestOptionId: z.string(),
    rationaleMarkdown: z.string(),
    sensitivityNotes: z.string(),
  }),
  operationsManagerReview: z
    .object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-second-best', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    })
    .optional(),
  artefacts: z.object({
    routingPlanRef: z.string(),
    carrierBookingRefs: z.array(z.string()).min(1),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type FreightOptimizationCycleInput = z.infer<typeof FreightOptimizationCycleInputSchema>
export type FreightRoutingPlanOutput = z.infer<typeof FreightRoutingPlanOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_landedCostPerUnit: RewardSignal = {
  keyResultRef: 'kr:freight-cost-optimizer:landed-cost-per-unit-improvement',
}
const kr_dataCoverage: RewardSignal = {
  keyResultRef: 'kr:freight-cost-optimizer:data-coverage',
}
const kr_optionDiversity: RewardSignal = {
  keyResultRef: 'kr:freight-cost-optimizer:option-diversity',
}
const kr_recommendationQuality: RewardSignal = {
  keyResultRef: 'kr:freight-cost-optimizer:recommendation-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:freight-cost-optimizer:emit-latency',
}

// ============================================================================
// Freight Cost Optimizer Service
// ============================================================================

/**
 * Freight Cost Optimizer — shipment batch ready / weekly route-optimization
 * cycle → operations-manager-reviewed multi-leg routing plan with reliability
 * scoring, cost-time tradeoffs, and second-best alternative + rationale, plus
 * carrier bookings as a Service.
 *
 * Cascade: fetch-shipment-batch-carrier-rates-transit-time-history-fuel-surcharge-volatility-and-customs-context (Code, fan-in)
 *        → synthesize-routing-options-with-cost-time-tradeoffs-and-reliability-scoring (Generative)
 *        → draft-recommendation-with-second-best-and-rationale (Generative)
 *        → operations-manager-review-on-cost-threshold (Human, approval rationale)
 *        → emit-routing-plan-and-carrier-bookings (Code, fan-out).
 */
export const freightCostOptimizer: ServiceInstance<
  FreightOptimizationCycleInput,
  FreightRoutingPlanOutput
> = Service.define<FreightOptimizationCycleInput, FreightRoutingPlanOutput>({
  name: 'Freight Cost Optimizer',
  promise:
    'Every shipment batch (or weekly route-optimization cycle) lands an operations-manager-reviewed multi-leg routing plan — diverse routing options scored on reliability + cost-time tradeoffs, with a recommended option, a second-best alternative, and a sensitivity-aware rationale — so landed-cost-per-unit drops without trading off carrier reliability.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: {
    input: FreightOptimizationCycleInputSchema,
    output: FreightRoutingPlanOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-shipment-batch-carrier-rates-transit-time-history-fuel-surcharge-volatility-and-customs-context',
        reward: kr_dataCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-routing-options-with-cost-time-tradeoffs-and-reliability-scoring',
        reward: kr_optionDiversity,
      }),
      Generative({
        name: 'draft-recommendation-with-second-best-and-rationale',
        reward: kr_recommendationQuality,
      }),
      Human({
        name: 'operations-manager-review-on-cost-threshold',
        // `approval` rationale: the operations-manager owns the operational-
        // cost envelope. Conditional on cost threshold — sub-threshold
        // routing plans may auto-approve once expirationPolicy thresholds
        // are met, but cycles above `operationsManagerReviewCostUsd` always
        // route through the manager. The gate stays human until the cascade
        // compiler decides to migrate it.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 5_000 },
      }),
      Code({
        name: 'emit-routing-plan-and-carrier-bookings',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'shipment-system.read',
      'carrier-rate-card.read',
      'transit-time-history.read',
      'fuel-surcharge-feed.read',
      'customs-context.read',
      'carrier-network.write',
      'routing-plan.write',
      'notification-channel.write',
    ],
    // Freight optimization: clarification disabled — the cascade synthesises
    // from the shipment batch + carrier rates + transit-time history + fuel-
    // surcharge volatility + customs context; the operations-manager review
    // step is the single conditional human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Cycles whose total declared shipment value exceeds the cycle cap
        // escalate the routing-options + recommendation steps to a senior
        // logistics supervisor before the routine operations-manager review
        // (the manager still approves, but the supervisor backstops the
        // synthesis on the highest-value cycles).
        when: 'shipmentBatch.totalDeclaredValueUsd >= reviewThresholds.cycleCapUsd',
        action: 'escalate',
      },
      {
        // Every cycle routes through operations-manager review (which may
        // auto-approve below the cost threshold once expirationPolicy
        // permits) before the routing plan emits and carrier bookings fan
        // out; OutcomeContract enforces the manager signature.
        when: 'true',
        action: 'route-to',
        target: 'operations-manager-review-on-cost-threshold',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:freight-cost-optimizer-review',
    personas: [
      // Cost-optimization-soundness reviewer — pedantic check that every
      // routing option's totalCostUsd reconciles against the per-leg
      // quotedCostUsd + fuelSurchargePctApplied without material variance,
      // that fuel surcharges are applied consistently across options, and
      // that the recommended option is not silently dominated on cost by
      // any alternative without a rationale (e.g. reliability tradeoff).
      Personas.pedantic({
        domain: 'cost-optimization-soundness',
        rubric: [
          'every-option-cost-reconciles-with-leg-costs',
          'fuel-surcharge-applied-consistently',
          'no-silently-dominated-recommendations',
          'recommendation-cost-traceable-to-rate-card',
          'incoterm-respected-in-leg-cost',
        ],
        name: 'cost-optimization-soundness-checker',
      }),
      // Reliability-scoring reviewer — adversarially probes whether each
      // routing option's reliabilityScore is grounded in the historical
      // on-time pct + per-carrier observed variance vs. surface-level
      // "highly reliable" hand-waving. The risk this guards against is
      // "cheap-but-unreliable wins because reliability was waved off".
      Personas.skeptic({
        domain: 'reliability-scoring',
        focus: [
          'reliability-score-cites-historical-on-time-pct',
          'reliability-rationale-cites-modality-risks',
          'reliability-score-bounded-on-zero-to-one',
          'no-flat-reliability-defaults',
          'modality-risks-named-when-relevant',
        ],
        name: 'reliability-scoring-reviewer',
      }),
      // Tradeoff-transparency reviewer — adversarially probes whether the
      // recommendation explicitly compares the recommended option to the
      // second-best on cost, time, and reliability axes (rather than
      // declaring a winner without articulating the tradeoff).
      Personas.skeptic({
        domain: 'tradeoff-transparency',
        focus: [
          'recommendation-compares-cost-vs-second-best',
          'recommendation-compares-time-vs-second-best',
          'recommendation-compares-reliability-vs-second-best',
          'sensitivity-notes-name-volatile-inputs',
          'no-winner-takes-all-rhetoric',
        ],
        name: 'tradeoff-transparency-reviewer',
      }),
      // Budget-realism reviewer — `budgetType: 'cost'` aligns with the
      // freight plan's spend-side surface: pedantic check that per-leg cost
      // claims are realistic against the rate-card snapshot, that cycle
      // total is plausible against the shipment-batch declared value, and
      // that no option's cost exceeds the cycle cap silently.
      Personas.budgetRealism({
        budgetType: 'cost',
        name: 'budget-realism-checker',
      }),
      // Timeline-realism reviewer — dependency-aware schedule realism
      // covering per-leg transit-time sequencing (e.g. ocean-then-truck
      // hand-off windows realistic vs. the customs-context snapshot).
      Personas.timelineRealism({
        dependencyAware: true,
        name: 'timeline-realism-checker',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:freight-cost-optimizer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-operations-manager',
    seller: 'svc:freight-cost-optimizer',
    serviceRef: 'svc:freight-cost-optimizer',
    // Operations-manager signs every routing plan above the cost threshold
    // before carrier bookings fan out — operational-cost authority cannot be
    // delegated to the cascade for material spend.
    predicate: AND(
      SchemaMatch(FreightRoutingPlanOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['operations-manager'] })
    ),
    // Mid-tier amount placeholder; per-cycle billing resolves through the
    // percent-of pricing factory below at settlement time.
    amount: { amount: 200000n, currency: 'USD' },
    // 2-day SLA — freight routing decisions need to land inside two
    // workdays so carrier capacity windows don't lapse.
    timeoutDays: 2,
    onTimeout: 'escalate',
  },

  // Percent-of pricing — 2.5% (250 basis points) of the realised freight-
  // spend-routed, capped at $40k per cycle. The metering runtime resolves
  // the `freight-spend-routed` basis to the realised carrier-booking USD at
  // settlement time and computes the charge as
  // `(freight_spend_routed * 250) / 10000`, clamped by `cap` at $40k.
  pricing: Pricing.percentOf({
    basis: 'freight-spend-routed',
    rateBasisPoints: 250,
    cap: { amount: 4_000_000n, currency: 'USD' },
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 11000n, perApiCall: 22n },
  reward: kr_landedCostPerUnit,

  lineage: {
    cellRef: 'business.org.ai/cells/supply-chain/freight-cost-optimizer',
    icpContextProblemRef: 'icp:freight-cost-optimizer:v1',
    foundingHypothesisRef: 'fh:freight-cost-optimizer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
