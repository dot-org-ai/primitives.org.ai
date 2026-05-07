# autonomous-it

> **Status: shipped (proof-of-life).** Three Services — `helpdesk-ticket-resolver`, `endpoint-fleet-monitor`, `identity-lifecycle-orchestrator` — are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: IT-helpdesk / endpoint-management / identity-lifecycle Services-as-Software, defined on the primitive substrate. Distinct from `autonomous-operations` (infra-ops / SRE) and from `autonomous-security` (security-incident response) — this package focuses on the IT-team vertical: Tier-1/Tier-2 helpdesk ticket triage + auto-resolution, endpoint compliance + drift detection + remediation, and joiner/mover/leaver (JML) identity automation.

## What this is

Concrete `Service.define({...})` calls for in-house IT-ops work — IT helpdesk ticket triage with classification + KB-grounded resolution + remote-action permission gating, weekly endpoint-fleet drift monitoring with SOX-grade quarantine + mass-action joint review, and JML identity-lifecycle orchestration with role-fit + segregation-of-duties (SoD) coverage and manager-attestation where required — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`, `autonomous-research`, `autonomous-security`, `autonomous-events`. Sixteenth catalog package; advances v3 §15's "catalog Services" leg into the IT-helpdesk / endpoint-management / identity-lifecycle vertical.

## Shipped Services

- **`helpdesk-ticket-resolver`** — Tier-1/Tier-2 IT helpdesk ticket triage + auto-resolution. Trigger: ticket submitted to IT helpdesk (Zendesk / Jira ServiceDesk / Freshservice). Cascade: `fetch-ticket-user-context-asset-inventory-and-similar-past-tickets (Code) → classify-issue-severity-and-auto-resolution-feasibility (Generative) → draft-resolution-or-escalation-with-KB-link-step-by-step-and-remote-action-permission-request (Generative) → IT-tech-review-on-non-trivial-cases (Human, approval rationale) → apply-resolution-and-emit-ticket-update-and-tracking (Code)`. EvaluatorPanel of 4 personas (classification-precision-checker + resolution-actionability-reviewer + empathy (audience: employee, sentiment: reassuring) + factual-accuracy (≥1 citation per claim)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass)` (HumanSign conditional via binding-trigger on non-auto-resolvable cases). Pricing: `Pricing.perInvocation` 3-tier — auto-resolved / tech-assisted / escalated ($19 / $99 / $399) — keyed on resolution path. Service-level reward = `ticket-deflection-rate-and-mean-time-to-resolution`. Archetype: `triage`. Lineage: `business.org.ai/cells/it-leads/helpdesk-ticket-resolver`.

  ```ts
  import { helpdeskTicketResolver } from 'autonomous-it/helpdesk-ticket-resolver'
  // typed as ServiceInstance<HelpdeskTicketResolverInput, HelpdeskTicketResolverOutput>
  ```

- **`endpoint-fleet-monitor`** — endpoint compliance + drift detection + remediation. Trigger: weekly cron + endpoint-fleet inventory + compliance-policy. Cascade: `fetch-MDM-snapshot-EDR-status-patch-level-and-config-baseline-diff (Code) → detect-drift-out-of-policy-configs-missing-patches-and-compromised-endpoints (Generative) → draft-remediation-plan-auto-remediable-user-assisted-or-quarantine (Generative) → IT-lead-and-security-lead-review-on-quarantine-or-mass-actions (Human, regulatory rationale) → emit-remediation-batch-endpoint-actions-and-audit-log (Code)`. EvaluatorPanel of 4 personas (drift-detection-precision-checker + remediation-actionability-reviewer + regression-risk (config + blast-radius + rollback required) + regulatory-compliance (sox)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(IT-lead))`. Pricing: `Pricing.subscription` $999/mo per IT-team subscription with metered overage at $199 per `endpoint-quarantine-recommended` event. Service-level reward = `endpoint-compliance-rate-improvement`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/it-leads/endpoint-fleet-monitor`.

  ```ts
  import { endpointFleetMonitor } from 'autonomous-it/endpoint-fleet-monitor'
  // typed as ServiceInstance<EndpointFleetMonitorInput, EndpointFleetMonitorOutput>
  ```

- **`identity-lifecycle-orchestrator`** — joiner / mover / leaver (JML) identity automation. Trigger: HRIS event (joiner / mover / leaver) OR weekly access-review trigger. Cascade: `fetch-employee-record-role-template-previous-access-and-system-of-record-config (Code) → synthesize-access-grants-and-revocations-role-fit-checks-and-segregation-of-duties-violations (Generative) → draft-onboarding-or-offboarding-runbook-and-comms-templates (Generative) → IT-lead-and-manager-attestation-where-required (Human, regulatory rationale) → apply-grants-revocations-and-emit-audit-evidence (Code)`. EvaluatorPanel of 5 personas (sod-violation-coverage-checker + role-fit-soundness-reviewer + audit-evidence-completeness-checker + regulatory-compliance (sox) + data-privacy (name / email / phone PII)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(IT-lead))`. Pricing: `Pricing.perInvocation` 3-tier — joiner / mover / leaver ($299 / $499 / $799) — keyed on JML event kind. Service-level reward = `jml-cycle-time-and-orphaned-grant-rate-reduction`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/it-leads/identity-lifecycle-orchestrator`.

  ```ts
  import { identityLifecycleOrchestrator } from 'autonomous-it/identity-lifecycle-orchestrator'
  // typed as ServiceInstance<IdentityLifecycleInput, IdentityLifecycleOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate. Distinct from `autonomous-operations` (which covers SRE / infra-ops / on-call / capacity) and from `autonomous-security` (which covers security-incident response / vuln triage / phishing simulation / threat modeling / audit prep) — IT-ops is a peer vertical with its own buyer (IT-helpdesk-lead / IT-lead) and its own helpdesk + endpoint + identity-lifecycle posture. JML and endpoint-fleet do touch security accountability (security-lead joint-review on quarantine + mass-actions, SoD-violation coverage on identity changes), but the primary buyer remains IT.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.subscription({ plan, metered })`, `Pricing.perInvocation({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (ticket-deflection-and-MTTR / endpoint-compliance-rate / JML-cycle-time-and-orphaned-grant-rate terminal hills) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`, `autonomous-research`, `autonomous-security`, `autonomous-events`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
