# autonomous-operations

> **Status: shipped (proof-of-life).** `incident-commander`, `oncall-handoff-narrator`, and `capacity-planner` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: operations Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for operations work — incident response, on-call handoff, capacity planning — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`. Seventh catalog package; advances v3 §15's "catalog Services" leg into the operations vertical.

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
