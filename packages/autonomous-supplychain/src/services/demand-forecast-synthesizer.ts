/**
 * Demand Forecast Synthesizer Service — multi-source demand forecasting for
 * the procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`, `inventory-reorder-planner`,
 * `supplier-risk-monitor`, `freight-cost-optimizer`,
 * `customs-compliance-filer`):
 *   - `forecast-narrative` archetype — the artefact is a supply-chain-lead-
 *     and-sales-ops-lead-signed monthly demand-forecast narrative (per-
 *     product-line baseline + scenario forecasts + confidence bands +
 *     key-driver attribution + actionable stocking recommendations), not a
 *     vendor packet, a routing decision, a reorder plan, a risk narrative,
 *     a freight routing plan, or a customs declaration;
 *   - 5-step cascade: Code fan-in (historical sales + sales-team-pipeline +
 *     macroeconomic signals + promo calendar + seasonality) → Generative
 *     (synthesise baseline + scenario forecasts + confidence bands) →
 *     Generative (draft narrative with key drivers + risks + actionable
 *     stocking recommendations) → Human (supply-chain-lead + sales-ops-lead
 *     review) → Code fan-out (emit forecast + ERP import + dashboard update);
 *   - `Pricing.subscription` — $1,499/mo recurring plan per supply-chain-org
 *     (the forecast value compounds month-over-month; it pays for the
 *     surveillance baseline + cycle infrastructure even on a quiet month) +
 *     metered overage on `product-line-forecasted` events ($99 each) — the
 *     load-bearing per-product-line work the subscription amortises;
 *   - declarative HITL = mandatory supply-chain-lead + sales-ops-lead review
 *     (both `approval` rationale — the supply-chain-lead owns the stocking
 *     envelope, the sales-ops-lead owns the pipeline-signal envelope; both
 *     route through the single review step but neither role is mandated by
 *     a regulator), plus OutcomeContract requires supply-chain-lead
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(forecast-realism +
 *     driver-attribution + scenario-completeness + statisticalRigor +
 *     assumptionExplicitness) + HumanSign(supply-chain-lead))`;
 *   - EvaluatorPanel includes `Personas.statisticalRigor({ checkSurfaces:
 *     ['confidence-interval', 'effect-size', 'survivorship-bias'], rigorTier:
 *     'mixed' })` and `Personas.assumptionExplicitness({ assumptionLevels:
 *     ['business', 'market', 'operational'], sensitivityAnalysisRequired:
 *     true })` because demand forecasts carry explicit confidence-band /
 *     effect-size / survivorship-bias surfaces (every monthly cycle must
 *     survive a statistical-rigor audit) and explicit business / market /
 *     operational assumption surfaces (every forecast must carry a
 *     sensitivity analysis before the supply-chain-lead signs).
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * mandatory HumanSign) + §7 (subscription pricing factory + metered overage)
 * + §8 (ProofPredicate AND).
 *
 * Service-level reward = `forecast-MAPE-improvement-and-stockout-rate-
 * reduction` — the compound metric every supply-chain org optimises against
 * (the synthesizer is worth running iff forecast MAPE improves AND stockout
 * rate drops vs. the pre-Service baseline; MAPE alone is insufficient — a
 * very accurate forecast that still doesn't translate into stocking
 * decisions doesn't reduce stockouts; a stockout reduction without
 * forecast-MAPE improvement is luck, not synthesis).
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
 * Input — a monthly forecast cycle (or a product-launch ad-hoc cycle) over
 * the product-line portfolio. Tight: 8 fields cover the cycle identity, the
 * trigger kind, the product-line scope, the multi-source data inputs, the
 * forecast-horizon spec, the scenario set requested, the assigned supply-
 * chain-lead + sales-ops-lead, and the trigger stage gating intake.
 */
export const DemandForecastCycleInputSchema = z.object({
  cycleId: z.string(),
  triggerKind: z.enum(['monthly-cron', 'product-launch', 'forecast-refresh-request']),
  productLineScope: z.object({
    scopeKind: z.enum(['full-portfolio', 'category-subset', 'product-line-subset', 'launch-only']),
    categoryRefs: z.array(z.string()).default([]),
    productLineRefs: z.array(z.string()).default([]),
  }),
  dataSources: z.object({
    historicalSalesSystemRef: z.string(),
    salesTeamPipelineRef: z.string(),
    macroSignalProviderRef: z.string(),
    promoCalendarRef: z.string(),
    seasonalityModelRef: z.string(),
    historicalLookbackMonths: z.number().int().positive(),
  }),
  horizon: z.object({
    horizonMonths: z.number().int().positive(),
    granularity: z.enum(['weekly', 'monthly', 'quarterly']),
  }),
  scenarioSet: z.object({
    scenarioKinds: z
      .array(z.enum(['baseline', 'upside', 'downside', 'launch-success', 'launch-shortfall']))
      .min(1),
    confidenceBandTargetPct: z.number().min(0).max(1),
  }),
  reviewers: z.object({
    supplyChainLeadRef: z.string(),
    salesOpsLeadRef: z.string(),
  }),
  triggerStage: z.literal('demand-forecast-cycle'),
})

/**
 * Output — a supply-chain-lead-and-sales-ops-lead-signed forecast artefact:
 * the cycle scope snapshot, per-product-line baseline forecast + scenario
 * forecasts + confidence bands, the narrative with key drivers + risks +
 * actionable stocking recommendations, the dual-reviewer sign-off audit, and
 * pointers to the emitted forecast + ERP-import package + dashboard update.
 */
export const DemandForecastReportOutputSchema = z.object({
  cycleId: z.string(),
  scopeSnapshot: z.object({
    snapshotIso: z.string(),
    productLinesForecasted: z.number().int().nonnegative(),
    horizonMonths: z.number().int().positive(),
    granularity: z.enum(['weekly', 'monthly', 'quarterly']),
  }),
  productLineForecasts: z
    .array(
      z.object({
        forecastId: z.string(),
        productLineRef: z.string(),
        baseline: z.object({
          pointForecastUnits: z.array(z.number().nonnegative()).min(1),
          confidenceBand: z.object({
            lowerUnits: z.array(z.number().nonnegative()).min(1),
            upperUnits: z.array(z.number().nonnegative()).min(1),
            confidenceLevelPct: z.number().min(0).max(1),
          }),
        }),
        scenarios: z
          .array(
            z.object({
              scenarioKind: z.enum([
                'baseline',
                'upside',
                'downside',
                'launch-success',
                'launch-shortfall',
              ]),
              pointForecastUnits: z.array(z.number().nonnegative()).min(1),
              narrativeMarkdown: z.string(),
            })
          )
          .min(1),
        keyDrivers: z
          .array(
            z.object({
              driverId: z.string(),
              driverKind: z.enum([
                'historical-trend',
                'sales-pipeline',
                'macroeconomic',
                'promo-event',
                'seasonality',
                'product-launch',
              ]),
              effectDirection: z.enum(['positive', 'negative', 'mixed']),
              effectSizePct: z.number(),
              attributionRationaleMarkdown: z.string(),
            })
          )
          .min(1),
        risks: z.array(
          z.object({
            riskId: z.string(),
            severity: z.enum(['info', 'warning', 'critical']),
            riskNarrativeMarkdown: z.string(),
          })
        ),
        actionableStockingRecommendations: z
          .array(
            z.object({
              recommendationId: z.string(),
              actionKind: z.enum([
                'increase-stock',
                'decrease-stock',
                'rebalance-distribution',
                'hold',
                'pre-position-promo',
              ]),
              quantityDeltaUnits: z.number(),
              rationaleMarkdown: z.string(),
            })
          )
          .min(1),
        sensitivityAnalysisMarkdown: z.string(),
      })
    )
    .min(1),
  signOffs: z.object({
    supplyChainLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
    salesOpsLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    forecastPackageRef: z.string(),
    erpImportRef: z.string(),
    dashboardUpdateRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DemandForecastCycleInput = z.infer<typeof DemandForecastCycleInputSchema>
export type DemandForecastReportOutput = z.infer<typeof DemandForecastReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_mapeAndStockoutRate: RewardSignal = {
  keyResultRef:
    'kr:demand-forecast-synthesizer:forecast-MAPE-improvement-and-stockout-rate-reduction',
}
const kr_dataCoverage: RewardSignal = {
  keyResultRef: 'kr:demand-forecast-synthesizer:data-coverage',
}
const kr_forecastQuality: RewardSignal = {
  keyResultRef: 'kr:demand-forecast-synthesizer:forecast-quality',
}
const kr_narrativeQuality: RewardSignal = {
  keyResultRef: 'kr:demand-forecast-synthesizer:narrative-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:demand-forecast-synthesizer:emit-latency',
}

// ============================================================================
// Demand Forecast Synthesizer Service
// ============================================================================

/**
 * Demand Forecast Synthesizer — monthly cron / product-launch / forecast-
 * refresh request → supply-chain-lead-and-sales-ops-lead-signed per-product-
 * line baseline + scenario forecasts + confidence bands + key-driver
 * attribution + actionable stocking recommendations as a Service.
 *
 * Cascade: fetch-historical-sales-sales-team-pipeline-macroeconomic-signals-promo-calendar-and-seasonality (Code, fan-in)
 *        → synthesize-baseline-scenario-forecasts-and-confidence-bands (Generative)
 *        → draft-narrative-with-key-drivers-risks-and-actionable-stocking-recommendations (Generative)
 *        → supply-chain-lead-and-sales-ops-lead-review (Human, approval rationale)
 *        → emit-forecast-erp-import-and-dashboard-update (Code, fan-out).
 */
export const demandForecastSynthesizer: ServiceInstance<
  DemandForecastCycleInput,
  DemandForecastReportOutput
> = Service.define<DemandForecastCycleInput, DemandForecastReportOutput>({
  name: 'Demand Forecast Synthesizer',
  promise:
    'Every monthly cycle (or product-launch ad-hoc cycle) lands a supply-chain-lead-and-sales-ops-lead-signed demand-forecast artefact — per-product-line baseline + scenario forecasts + confidence bands + key-driver attribution + actionable stocking recommendations — so forecast MAPE improves and stockout rate drops against the pre-Service baseline.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: DemandForecastCycleInputSchema,
    output: DemandForecastReportOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-historical-sales-sales-team-pipeline-macroeconomic-signals-promo-calendar-and-seasonality',
        reward: kr_dataCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-baseline-scenario-forecasts-and-confidence-bands',
        reward: kr_forecastQuality,
      }),
      Generative({
        name: 'draft-narrative-with-key-drivers-risks-and-actionable-stocking-recommendations',
        reward: kr_narrativeQuality,
      }),
      Human({
        name: 'supply-chain-lead-and-sales-ops-lead-review',
        // `approval` rationale: the supply-chain-lead owns the stocking
        // envelope; the sales-ops-lead owns the pipeline-signal envelope.
        // Both review every monthly forecast before the ERP import emits and
        // the dashboard update fires. Neither role is regulator-mandated, but
        // both gates stay human regardless of model accuracy because the
        // downstream stocking decisions reshape working-capital allocation
        // for the next month.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-forecast-erp-import-and-dashboard-update',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'historical-sales-system.read',
      'sales-pipeline-system.read',
      'macro-signal-provider.read',
      'promo-calendar.read',
      'seasonality-model.read',
      'forecast-package.write',
      'erp-import-channel.write',
      'forecast-dashboard.write',
    ],
    // Demand forecasting: clarification disabled — the cascade synthesises
    // from historical sales + pipeline + macro + promo + seasonality; the
    // supply-chain-lead + sales-ops-lead review step is the single human
    // contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Product-launch cycles escalate the forecast + narrative steps to a
        // senior demand-planning supervisor before the routine supply-chain-
        // lead + sales-ops-lead review (the leads still sign, but the
        // supervisor backstops the synthesis on launch cycles where there is
        // no historical sales baseline to anchor confidence bands).
        when: 'triggerKind == "product-launch"',
        action: 'escalate',
      },
      {
        // Every cycle routes through supply-chain-lead + sales-ops-lead
        // review before the ERP import emits and the dashboard update fires;
        // OutcomeContract enforces the supply-chain-lead signature, the
        // trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'supply-chain-lead-and-sales-ops-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:demand-forecast-synthesizer-review',
    personas: [
      // Forecast-realism reviewer — pedantic check that every product-line
      // baseline + scenario forecast cites the historical-sales + pipeline +
      // macro + promo + seasonality inputs that produced it (no forecast
      // invents demand the data doesn't support, no scenario claims an
      // outcome without a narrative). The risk this guards against is
      // "hallucinated forecast that doesn't reconcile to fan-in data".
      Personas.pedantic({
        domain: 'forecast-realism',
        rubric: [
          'every-baseline-forecast-cites-historical-window',
          'every-scenario-cites-driver-and-narrative',
          'confidence-band-width-reconciles-with-historical-variance',
          'no-forecast-without-input-traceability',
          'launch-scenarios-flag-no-baseline-when-applicable',
          'no-flat-zero-forecasts-without-rationale',
        ],
        name: 'forecast-realism-checker',
      }),
      // Driver-attribution reviewer — adversarially probes whether every
      // key-driver attribution carries a concrete effect-direction +
      // effect-size + cited rationale (vs. boilerplate "macro tailwinds" or
      // "promo lift"), and whether driver effect sizes sum to a plausible
      // total vs. the baseline-to-scenario delta.
      Personas.skeptic({
        domain: 'driver-attribution',
        focus: [
          'every-driver-cites-effect-direction-and-size',
          'driver-effect-sizes-reconcile-with-scenario-deltas',
          'macro-drivers-cite-specific-signal',
          'promo-drivers-cite-specific-event',
          'no-vague-drivers-without-attribution-rationale',
        ],
        name: 'driver-attribution-reviewer',
      }),
      // Scenario-completeness reviewer — adversarial probe that every
      // requested scenario kind in the cycle's `scenarioSet` is present in
      // the output, that upside / downside scenarios bracket the baseline,
      // and that launch scenarios are present when a `product-launch` trigger
      // is active.
      Personas.skeptic({
        domain: 'scenario-completeness',
        focus: [
          'every-requested-scenario-kind-present',
          'upside-bounds-above-baseline',
          'downside-bounds-below-baseline',
          'launch-scenarios-present-when-trigger-is-product-launch',
          'no-silent-scenario-omissions',
        ],
        name: 'scenario-completeness-reviewer',
      }),
      // Statistical-rigor reviewer — demand forecasts carry explicit
      // confidence-band / effect-size / survivorship-bias surfaces. Every
      // monthly cycle must survive a statistical-rigor audit before the
      // supply-chain-lead signs. `mixed` rigor tier accepts either
      // frequentist or Bayesian conventions (the cascade may produce
      // either).
      Personas.statisticalRigor({
        checkSurfaces: ['confidence-interval', 'effect-size', 'survivorship-bias'],
        rigorTier: 'mixed',
        name: 'statistical-rigor-reviewer',
      }),
      // Assumption-explicitness reviewer — every forecast carries business
      // (pricing / promo plans), market (competitive dynamics), and
      // operational (capacity / lead-time) assumptions. Each must be
      // explicit, and a sensitivity analysis must accompany the forecast
      // (how the forecast changes under varied assumptions). Reject on
      // absence.
      Personas.assumptionExplicitness({
        assumptionLevels: ['business', 'market', 'operational'],
        sensitivityAnalysisRequired: true,
        name: 'assumption-explicitness-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:demand-forecast-synthesizer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-supply-chain-lead',
    seller: 'svc:demand-forecast-synthesizer',
    serviceRef: 'svc:demand-forecast-synthesizer',
    // Supply-chain-lead signs every monthly forecast artefact before the ERP
    // import emits and the dashboard update fires — stocking authority cannot
    // be delegated to the cascade.
    predicate: AND(
      SchemaMatch(DemandForecastReportOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['supply-chain-lead'] })
    ),
    // Mid-tier amount; the recurring plan + metered overage live in `pricing`.
    amount: { amount: 149900n, currency: 'USD' },
    // 7-day SLA — monthly forecast lands within one workweek so the supply-
    // chain organisation has fresh signal before the next supply-chain
    // committee.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  // Subscription pricing — $1,499/mo per supply-chain-org recurring plan.
  // The forecast value compounds month-over-month (the surveillance baseline
  // + cycle infrastructure are paid for even on a quiet month). Metered
  // overage on `product-line-forecasted` events ($99 each) prices the load-
  // bearing per-product-line work the subscription amortises — a portfolio
  // with few product lines pays the base, a portfolio with many product
  // lines pays the metered overage on each one.
  pricing: Pricing.subscription({
    plan: {
      id: 'demand-forecast-synthesizer-monthly',
      amount: 149900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'product-line-forecasted',
        amount: 9900n,
        description:
          'Product-line forecasted event — a single product-line for which a baseline + scenario forecast + confidence band + key-driver attribution + actionable stocking recommendation was produced in the cycle.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9500n, perApiCall: 18n },
  reward: kr_mapeAndStockoutRate,

  lineage: {
    cellRef: 'business.org.ai/cells/supply-chain/demand-forecast-synthesizer',
    icpContextProblemRef: 'icp:demand-forecast-synthesizer:v1',
    foundingHypothesisRef: 'fh:demand-forecast-synthesizer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
