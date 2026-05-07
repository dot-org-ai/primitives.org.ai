# autonomous-supplychain

> **Status: shipped (proof-of-life).** `vendor-onboarding-runbook`, `purchase-order-router`, and `inventory-reorder-planner` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: procurement / supply-chain Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for in-house procurement and supply-chain work — net-new vendor due-diligence + onboarding, PO routing + approval orchestration, and multi-SKU reorder optimization — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`. Twelfth catalog package; advances v3 §15's "catalog Services" leg into the procurement / supply-chain vertical.

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
