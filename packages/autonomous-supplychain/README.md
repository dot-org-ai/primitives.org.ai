# autonomous-supplychain

> **Status: shipped (proof-of-life).** `vendor-onboarding-runbook`, `purchase-order-router`, `inventory-reorder-planner`, `supplier-risk-monitor`, `freight-cost-optimizer`, `customs-compliance-filer`, `demand-forecast-synthesizer`, `manufacturing-quality-incident-investigator`, and `supplier-contract-renewal-orchestrator` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: procurement / supply-chain Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for in-house procurement and supply-chain work — net-new vendor due-diligence + onboarding, PO routing + approval orchestration, multi-SKU reorder optimization, ongoing supplier-risk surveillance, multi-leg freight routing + carrier selection, cross-border customs declaration + HS-code classification, multi-source demand forecasting, production-quality-incident root-cause analysis, and supplier-contract renewal orchestration — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`. Twelfth catalog package; advances v3 §15's "catalog Services" leg into the procurement / supply-chain vertical.

## Shipped Services

- **`vendor-onboarding-runbook`** — net-new vendor due-diligence + onboarding. Trigger: vendor-add request from any team. Cascade: `fetch-vendor-profile-and-spend-projection-and-integration-needs (Code) → due-diligence-checklist-financial-stability-security-posture-reference-check-and-compliance-fit (Generative) → supervised-vendor-questionnaire-and-reference-outreach (Agentic, supervised) → procurement-lead-and-security-reviewer-sign-off (Human, regulatory rationale) → emit-onboarding-packet-and-create-vendor-record (Code)`. EvaluatorPanel of 4 personas (due-diligence-completeness-checker + risk-flag-coverage-reviewer + sox-regulatoryCompliance + securityThreat) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(procurement-lead))`. Pricing: `Pricing.outcome` 3-tier — low-risk / medium-risk / high-risk ($499 / $1,999 / $5,999) — keyed on declared vendor risk band. Service-level reward = `vendor-onboarding-cycle-time-reduction`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/procurement/vendor-onboarding-runbook`.

  ```ts
  import { vendorOnboardingRunbook } from 'autonomous-supplychain/vendor-onboarding-runbook'
  // typed as ServiceInstance<VendorOnboardingRequestInput, VendorOnboardingPacketOutput>
  ```

- **`purchase-order-router`** — PO routing + approval orchestration. Trigger: PO submitted in procurement system. Cascade: `fetch-po-details-budget-context-and-approval-policy (Code) → classify-po-against-policy-in-policy-or-out-of-policy-low-or-out-of-policy-high (Generative) → route-with-rationale-and-alternative-suggestions (Generative) → approver-conditional-on-classification (Human, approval rationale) → emit-po-status-and-audit-log (Code)`. EvaluatorPanel of 3 personas (policy-coverage-checker + routing-rationale-reviewer + procurement-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass)`. Pricing: `Pricing.perInvocation` 3-tier — small / medium / large ($49 / $199 / $799) — keyed on PO amount band. Service-level reward = `po-cycle-time-reduction-and-policy-violation-rate-reduction`. Archetype: `triage`. Lineage: `business.org.ai/cells/procurement/purchase-order-router`.

  ```ts
  import { purchaseOrderRouter } from 'autonomous-supplychain/purchase-order-router'
  // typed as ServiceInstance<PurchaseOrderInput, PurchaseOrderRoutingOutput>
  ```

- **`inventory-reorder-planner`** — multi-SKU reorder optimization. Trigger: weekly cron OR low-stock alert OR demand-forecast update. Cascade: `fetch-current-inventory-sales-velocity-lead-times-and-supplier-MOQs (Code) → synthesize-reorder-recommendations-safety-stock-rationale-and-scenario-analysis-on-demand-shifts (Generative) → draft-reorder-batch-and-supplier-allocation (Generative) → operations-manager-review-and-confirm (Human, approval rationale) → emit-reorder-batch-pos-and-supplier-notifications (Code)`. EvaluatorPanel of 5 personas (forecast-realism-checker + safety-stock-rationale-reviewer + supplier-allocation-soundness + budgetRealism + timelineRealism) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(operations-manager))`. Pricing: `Pricing.percentOf` — 1% (100 bps) of the realised reorder-batch amount, capped at $20k per cycle. Service-level reward = `stockout-rate-reduction-and-inventory-carrying-cost-improvement`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/supply-chain/inventory-reorder-planner`.

  ```ts
  import { inventoryReorderPlanner } from 'autonomous-supplychain/inventory-reorder-planner'
  // typed as ServiceInstance<InventoryReorderCycleInput, InventoryReorderPlanOutput>
  ```

- **`supplier-risk-monitor`** — ongoing supplier-risk surveillance. Trigger: weekly cron + supplier-portfolio. Cascade: `fetch-supplier-list-recent-public-news-esg-data-financial-distress-and-delivery-perf (Code) → supervised-cross-check-public-news-sanctions-list-and-concentrated-dependency-flags (Agentic, supervised) → synthesize-per-supplier-risk-narrative-and-recommend-actions (Generative) → procurement-lead-and-risk-officer-review (Human, regulatory rationale) → emit-risk-dashboard-update-and-escalation-tickets (Code)`. EvaluatorPanel of 4 personas (signal-precision-checker + recommendation-actionability-reviewer + sox-regulatoryCompliance + factual-accuracy(government + industry-standard)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(risk-officer))`. Pricing: `Pricing.subscription` $1,499/mo per supply-chain-org + metered overage on `supplier-risk-escalation` events ($199 each). Service-level reward = `supplier-disruption-incident-rate-reduction`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/supply-chain/supplier-risk-monitor`.

  ```ts
  import { supplierRiskMonitor } from 'autonomous-supplychain/supplier-risk-monitor'
  // typed as ServiceInstance<SupplierRiskCycleInput, SupplierRiskReportOutput>
  ```

- **`freight-cost-optimizer`** — multi-leg freight routing + carrier selection. Trigger: shipment-batch ready OR weekly route-optimization cycle. Cascade: `fetch-shipment-batch-carrier-rates-transit-time-history-fuel-surcharge-volatility-and-customs-context (Code) → synthesize-routing-options-with-cost-time-tradeoffs-and-reliability-scoring (Generative) → draft-recommendation-with-second-best-and-rationale (Generative) → operations-manager-review-on-cost-threshold (Human, approval rationale) → emit-routing-plan-and-carrier-bookings (Code)`. EvaluatorPanel of 5 personas (cost-optimization-soundness-checker + reliability-scoring-reviewer + tradeoff-transparency-reviewer + budgetRealism + timelineRealism) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(operations-manager))`. Pricing: `Pricing.percentOf` — 2.5% (250 bps) of the realised `freight-spend-routed`, capped at $40k per cycle. Service-level reward = `landed-cost-per-unit-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/supply-chain/freight-cost-optimizer`.

  ```ts
  import { freightCostOptimizer } from 'autonomous-supplychain/freight-cost-optimizer'
  // typed as ServiceInstance<FreightOptimizationCycleInput, FreightRoutingPlanOutput>
  ```

- **`customs-compliance-filer`** — cross-border customs declaration + HS-code classification. Trigger: shipment crossing border OR new product line entering market. Cascade: `fetch-shipment-manifest-product-attributes-trade-agreements-and-prior-filings (Code) → classify-HS-codes-with-rationale-rate-of-duty-calc-and-free-trade-eligibility-check (Generative) → draft-customs-declaration-and-supporting-documentation-checklist (Generative) → customs-broker-or-trade-compliance-officer-review-and-attest (Human, regulatory rationale) → emit-declaration-package-and-broker-handoff (Code)`. EvaluatorPanel of 5 personas (hs-code-accuracy-checker + duty-calculation-precision-reviewer + documentation-completeness-reviewer + fincen-regulatoryCompliance + factual-accuracy(government)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(trade-compliance-officer))`. Pricing: `Pricing.outcome` 3-tier — simple-shipment / multi-line / restricted-goods ($199 / $799 / $2,999) — keyed on declared shipment-complexity band. Service-level reward = `customs-rejection-rate-and-amendment-rate-reduction`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/supply-chain/customs-compliance-filer`.

  ```ts
  import { customsComplianceFiler } from 'autonomous-supplychain/customs-compliance-filer'
  // typed as ServiceInstance<CustomsFilingInput, CustomsDeclarationOutput>
  ```

- **`demand-forecast-synthesizer`** — multi-source demand forecasting. Trigger: monthly cron OR product-launch + need-for-forecast. Cascade: `fetch-historical-sales-sales-team-pipeline-macroeconomic-signals-promo-calendar-and-seasonality (Code) → synthesize-baseline-scenario-forecasts-and-confidence-bands (Generative) → draft-narrative-with-key-drivers-risks-and-actionable-stocking-recommendations (Generative) → supply-chain-lead-and-sales-ops-lead-review (Human, approval rationale) → emit-forecast-erp-import-and-dashboard-update (Code)`. EvaluatorPanel of 5 personas (forecast-realism-checker + driver-attribution-reviewer + scenario-completeness-reviewer + statisticalRigor(confidence-interval + effect-size + survivorship-bias, mixed) + assumptionExplicitness(business + market + operational, sensitivity-required)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(supply-chain-lead))`. Pricing: `Pricing.subscription` $1,499/mo per supply-chain-org + metered overage on `product-line-forecasted` events ($99 each). Service-level reward = `forecast-MAPE-improvement-and-stockout-rate-reduction`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/supply-chain/demand-forecast-synthesizer`.

  ```ts
  import { demandForecastSynthesizer } from 'autonomous-supplychain/demand-forecast-synthesizer'
  // typed as ServiceInstance<DemandForecastCycleInput, DemandForecastReportOutput>
  ```

- **`manufacturing-quality-incident-investigator`** — production-quality-incident root-cause-analysis. Trigger: SPC alert OR customer-quality-complaint OR audit-finding. Cascade: `fetch-incident-data-production-batch-records-supplier-lot-traceability-and-recent-equipment-maintenance (Code) → classify-failure-mode-likely-root-causes-and-impact-blast-radius (Generative) → draft-rca-with-corrective-and-preventive-actions-and-customer-comms-needs (Generative) → quality-manager-and-plant-manager-review (Human, regulatory rationale) → emit-incident-doc-capa-tickets-and-audit-trail (Code)`. EvaluatorPanel of 6 personas (rca-soundness-checker + capa-actionability-reviewer + traceability-completeness-reviewer + factual-accuracy(min 2 citations per claim) + sox-regulatoryCompliance + evidenceTraceability(floor 0.95)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(quality-manager))`. Pricing: `Pricing.perInvocation` 3-tier — minor / major / critical-recall ($199 / $999 / $4,999) — keyed on declared incident severity. Service-level reward = `defect-recurrence-rate-and-time-to-root-cause-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/supply-chain/manufacturing-quality-incident-investigator`.

  ```ts
  import { manufacturingQualityIncidentInvestigator } from 'autonomous-supplychain/manufacturing-quality-incident-investigator'
  // typed as ServiceInstance<QualityIncidentInput, QualityIncidentRcaOutput>
  ```

- **`supplier-contract-renewal-orchestrator`** — supplier-contract renewal cycle. Trigger: supplier contract approaching renewal + 90-day-window. Cascade: `fetch-supplier-perf-spend-analysis-competing-quotes-and-market-benchmarks (Code) → synthesize-negotiation-position-leverage-analysis-and-walkaway-thresholds (Generative) → draft-renewal-proposal-and-rfp-or-renegotiation-strategy (Generative) → procurement-lead-and-finance-lead-review (Human, approval rationale) → emit-renewal-package-and-supplier-communication-batch (Code)`. EvaluatorPanel of 6 personas (leverage-analysis-soundness-checker + walkaway-rationale-reviewer + market-benchmark-recency-reviewer + commercialFit(pricing-realism + unit-economics) + budgetRealism(cost) + contractualClarity(msa, strict)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(procurement-lead))`. Pricing: `Pricing.percentOf` — 0.5% (50 bps) of `contract-value`, capped at $50k per contract. Service-level reward = `renewal-cost-savings-and-cycle-time-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/supply-chain/supplier-contract-renewal-orchestrator`.

  ```ts
  import { supplierContractRenewalOrchestrator } from 'autonomous-supplychain/supplier-contract-renewal-orchestrator'
  // typed as ServiceInstance<ContractRenewalCycleInput, ContractRenewalPackageOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.perInvocation({ tiers })`, `Pricing.percentOf({ basis, rateBasisPoints, cap })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (vendor-onboarding-cycle-time-reduction → procurement-velocity / supplier-trust terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
