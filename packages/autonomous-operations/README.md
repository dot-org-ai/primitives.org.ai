# autonomous-operations

> **Status: shipped (proof-of-life).** Six Services — `incident-commander`, `oncall-handoff-narrator`, `capacity-planner`, `slo-budget-tracker`, `change-window-coordinator`, `runbook-author` — are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: operations Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for operations work — incident response, on-call handoff, capacity planning, SLO budget tracking, change-window coordination, runbook authoring — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`. Seventh catalog package; advances v3 §15's "catalog Services" leg into the operations vertical.

## Shipped Services

- **`incident-commander`** — SEV1 / SEV2 alert + on-call paged → IC-approved mitigation plan with Slack / PagerDuty / statuspage status updates coordinated end-to-end. Trigger: SEV1 or SEV2 alert fires + on-call paged. Cascade: `fetch-current-status-last-incidents-and-service-graph (Code) → synthesize-initial-runbook-and-mitigation-plan (Generative) → coordinate-status-updates-across-slack-pagerduty-statuspage (Agentic, supervised) → ic-approves-mitigation-actions (Human, regulatory rationale) → emit-incident-timeline-and-post-status-update (Code)`. EvaluatorPanel of 4 personas (runbook-actionability-reviewer + status-clarity-checker + blast-radius-reviewer + sre-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(IC))`. Pricing: `Pricing.outcome` 3-tier — SEV3 / SEV2 / SEV1 ($199 / $999 / $2,999) — keyed on declared severity. Service-level reward = `time-to-mitigation-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/sre-managers/incident-commander`.

  ```ts
  import { incidentCommander } from 'autonomous-operations/incident-commander'
  // typed as ServiceInstance<IncidentTriggerInput, IncidentMitigationOutput>
  ```

- **`oncall-handoff-narrator`** — weekly cron + on-call rotation handoff → handoff narrative + Slack thread covering known-knowns / known-unknowns, active mitigations, and pending investigations. Trigger: weekly cron + on-call rotation handoff. Cascade: `fetch-week-incidents-open-issues-deploys-and-anomalies (Code) → synthesize-handoff-narrative-with-known-knowns-and-known-unknowns (Generative) → highlight-active-mitigations-and-pending-investigations (Generative) → emit-handoff-doc-and-slack-thread (Code)`. EvaluatorPanel of 3 personas (coverage-completeness-checker + signal-clarity-reviewer + sre-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass)` — informational, no HumanSign. Pricing: `Pricing.subscription` $199/mo per on-call team. Service-level reward = `handoff-prep-time-reduction`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/sre-managers/oncall-handoff-narrator`.

  ```ts
  import { oncallHandoffNarrator } from 'autonomous-operations/oncall-handoff-narrator'
  // typed as ServiceInstance<HandoffTriggerInput, HandoffNarrativeOutput>
  ```

- **`capacity-planner`** — quarterly cron + capacity-review-due → infra-leader-approved capacity plan with cost-impact scenarios + procurement tickets created. Trigger: quarterly cron + capacity-review-due. Cascade: `fetch-current-utilization-historical-trend-and-projected-growth (Code) → synthesize-bottleneck-narrative-and-recommended-capacity-changes (Generative) → cost-impact-analysis-with-scenario-tradeoffs (Generative) → infra-leader-approves (Human, approval rationale) → emit-capacity-plan-and-create-procurement-tickets (Code)`. EvaluatorPanel of 4 personas (scenario-realism-reviewer + cost-analysis-soundness-checker + utilization-grounding-checker + infra-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(infra-leader))`. Pricing: `Pricing.subscription` $799/mo for the infra-team subscription with metered overage at $299 per ad-hoc planning request. Service-level reward = `capacity-incident-rate-reduction`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/infrastructure-managers/capacity-planner`.

  ```ts
  import { capacityPlanner } from 'autonomous-operations/capacity-planner'
  // typed as ServiceInstance<CapacityReviewInput, CapacityPlanOutput>
  ```

- **`slo-budget-tracker`** — weekly cron + monitoring-data ingestion → SRE-lead-approved error-budget burn-down narrative + ship/slow-down/freeze recommendation. Trigger: weekly cron + monitoring-data ingestion (or ad-hoc fast-burn alert). Cascade: `fetch-sli-time-series-error-budget-policy-and-recent-incidents (Code) → synthesize-burn-rate-narrative-with-drivers-and-mitigations (Generative) → draft-recommendation-continue-shipping-slow-down-or-freeze (Generative) → sre-lead-and-service-owner-review (Human, approval rationale) → emit-budget-report-and-dashboard-annotations (Code)`. EvaluatorPanel of 5 personas (burn-rate-precision-checker + recommendation-actionability-reviewer + driver-fact-grounding-checker + recommendation-regression-risk-reviewer + sre-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(SRE-lead))`. Pricing: `Pricing.subscription` $499/mo per SRE-team with metered overage at $99 per `slo-burn-alert`. Service-level reward = `slo-attainment-rate-improvement`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/sre-managers/slo-budget-tracker`.

  ```ts
  import { sloBudgetTracker } from 'autonomous-operations/slo-budget-tracker'
  // typed as ServiceInstance<SloBudgetReviewInput, SloBudgetReportOutput>
  ```

- **`change-window-coordinator`** — release-planned or change-window-scheduled → release-manager-approved change-window runbook with blast-radius bundle + sequencing plan + rollback plan + monitoring watchpoints. Trigger: release planned or change window scheduled. Cascade: `fetch-pending-changes-dependent-services-and-recent-incident-overlap (Code) → synthesize-change-bundle-with-blast-radius-and-sequencing-plan (Generative) → draft-rollback-plan-and-monitoring-watchpoints (Generative) → release-manager-and-sre-lead-go-no-go-review (Human, approval rationale) → emit-change-window-runbook-freeze-overrides-and-audit-log (Code)`. EvaluatorPanel of 6 personas (blast-radius-coverage-checker + rollback-soundness-checker + monitoring-watchpoint-density-checker + change-bundle-regression-risk-reviewer + sequencing-timeline-realism-reviewer + sre-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(release-manager))`. Pricing: `Pricing.outcome` 3-tier — team-window / cross-team-window / company-wide-freeze ($499 / $1,999 / $9,999) — keyed on declared scope tier. Service-level reward = `change-induced-incident-rate-reduction`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/sre-managers/change-window-coordinator`.

  ```ts
  import { changeWindowCoordinator } from 'autonomous-operations/change-window-coordinator'
  // typed as ServiceInstance<ChangeWindowInput, ChangeWindowRunbookOutput>
  ```

- **`runbook-author`** — post-incident-review-complete + missing-runbook-gap identified → IC-approved operational runbook + on-call-tooling registration. Trigger: post-incident review complete + missing-runbook gap identified. Cascade: `fetch-incident-timeline-similar-past-incidents-service-graph-and-tooling-context (Code) → synthesize-runbook-with-triage-tree-commands-escalation-paths-and-edge-cases (Generative) → draft-validation-tests-and-dry-run-procedure (Generative) → ic-and-service-owner-review-and-confirm (Human, regulatory rationale) → emit-runbook-and-register-with-oncall-tooling (Code)`. EvaluatorPanel of 5 personas (triage-completeness-checker + command-precision-checker + edge-case-coverage-checker + runbook-scope-clarity-reviewer + sre-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(IC))`. Pricing: `Pricing.outcome` 3-tier — simple / standard / complex-multi-service ($299 / $999 / $2,999) — keyed on declared complexity tier. Service-level reward = `time-to-mitigation-for-similar-future-incidents`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/sre-managers/runbook-author`.

  ```ts
  import { runbookAuthor } from 'autonomous-operations/runbook-author'
  // typed as ServiceInstance<RunbookAuthoringInput, RunbookOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.subscription({ plan, metered })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (time-to-mitigation-improvement → MTTR / availability terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
