# autonomous-revenue

> **Status: shipped (proof-of-life).** `lead-qualification` is implemented against `services-as-software/v3` + the `autonomous-finance` substrate. Future Services below remain sketched.

Catalog package: revenue / sales Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for revenue-generating work that the agentic economy can deliver as software. Sibling of `autonomous-finance-services`, `autonomous-customer-success`, `autonomous-developer-experience`.

## Shipped Services

- **`lead-qualification`** — inbound lead → enrich (Clearbit + LinkedIn via `$.api.*`) → BANT/MEDDIC qualify → route. External-API integration density (5 tool permissions). Service-level reward = `closed-won-rate` (matches BaC ch.7:138 worked example). Trigger-based HITL routing on revenue threshold (>$100M → SDR review). EvaluatorPanel of two skeptic personas (ICP fit + buying intent). OutcomeContract = AND(SchemaMatch + EvaluatorPass + External Salesforce verification). Outcome pricing at $5.00 per qualified lead, refund contract `no-charge-if-not-qualified`. Lineage: `occupations.org.ai/SalesRepresentatives` × `processes.org.ai/InboundLeadQualification`.

  ```ts
  import { leadQualification } from 'autonomous-revenue/lead-qualification'
  const handle = await leadQualification.invoke({ leadId, source, email, formFields })
  ```

- **`meeting-prep`** — calendar event → research participants + companies → brief + suggested talking points.
- **`proposal-generator`** — qualified opportunity → contextual proposal → review panel → send.
- **`contract-redliner`** — vendor MSA → policy comparison → redline + risk memo.
- **`renewal-workbench`** — upcoming renewal → usage trend + value brief + next-step playbook.
- **`campaign-orchestrator`** — campaign brief → audience build + content draft + send + measure → iterate.
- **`win-loss-analyzer`** — closed-deal post-mortem. Cascade: `extract-opp-history (Code) → conduct-buyer-interview (Agentic, supervised) → synthesize-win-loss-pattern (Generative) → emit-report (Code)`. EvaluatorPanel of 3 personas (insight-novelty-reviewer + actionability-checker + sales-leader-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch, EvaluatorPass, External(salesforce.opportunity-updated))`. Pricing: `Pricing.outcome` across S/M/L deal-size tiers ($199 / $999 / $4,999). Service-level reward = `rep-quota-attainment-improvement`. Lineage: `business.org.ai/cells/sales-managers/win-loss-analysis`.

  ```ts
  import { winLossAnalyzer } from 'autonomous-revenue/win-loss-analyzer'
  // typed as ServiceInstance<ClosedOpportunity, WinLossReport>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `External` predicates
- **`digital-tools`** `Code` / `Agentic` Function sugar with per-Function `RewardSignal`

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (closed-won-rate → Profit terminal hill) — current `kr:lead-qualification:*` are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Beads epic: `aip-f6pi`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
