# autonomous-revenue

> **Status: stub / deferred.** Depends on `services-as-software` v2 + `autonomous-finance` substrate.

Catalog package: revenue / sales Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for revenue-generating work that the agentic economy can deliver as software. Sibling of `autonomous-finance/services/*`, `autonomous-customer-success`, `autonomous-developer-experience`.

## Initial Service

- **`lead-qualification`** — inbound lead → enrich (Clearbit + LinkedIn via `$.api.*`) → BANT/MEDDIC qualify → route. External-API integration density (5 tool permissions). Service-level reward = `closed-won-rate` (matches BaC ch.7:138 worked example). Trigger-based HITL routing on revenue threshold (>$100M → SDR review). Lineage: `occupations.org.ai/SalesRepresentatives` × `processes.org.ai/InboundLeadQualification`.

## Future Services (sketched)

- **`meeting-prep`** — calendar event → research participants + companies → brief + suggested talking points
- **`proposal-generator`** — qualified opportunity → contextual proposal → review panel → send
- **`contract-redliner`** — vendor MSA → policy comparison → redline + risk memo
- **`renewal-workbench`** — upcoming renewal → usage trend + value brief + next-step playbook
- **`campaign-orchestrator`** — campaign brief → audience build + content draft + send + measure → iterate

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Real implementation depends on:

- **`services-as-software` v2** shipping (`Service.define` + `Service.invoke` + `OutcomeContract`)
- **`autonomous-finance`** `Pricing.outcome({ tiers })` (per-qualified-lead pricing)
- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (closed-won-rate → Profit terminal hill)
- **`ai-evaluate`** EvaluatorPanel + reusable persona library (`icp-fit-skeptic`, `intent-evaluator`)

## References

- Beads epic: `aip-f6pi`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
