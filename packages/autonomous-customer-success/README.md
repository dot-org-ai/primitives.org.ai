# autonomous-customer-success

> **Status: stub / deferred.** Depends on `services-as-software` v2 + `autonomous-finance` substrate.

Catalog package: customer-success Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for customer-success work that the agentic economy can deliver as software. Sibling of `autonomous-finance/services/*`, `autonomous-revenue`, `autonomous-developer-experience`.

## Initial Service

- **`support-triage`** — incoming ticket → categorize → enrich (CRM lookup) → draft reply → route. High-volume per-invocation tier pricing. `autonomous` mode on classify (already promoted via TrackRecord). HITL trigger when classification confidence < 0.7. Lineage: `occupations.org.ai/CustomerServiceRepresentatives` × `processes.org.ai/InboundTicketHandling`.

## Future Services (sketched)

- **`nps-followup`** — survey response → sentiment classify → categorize → escalate or thank
- **`onboarding-runbook`** — new customer → tailored onboarding plan → execution + checkpoints
- **`churn-rescue`** — cancellation signal → diagnostic → save offer or graceful exit
- **`account-review`** — quarterly account health → renewal forecast → expansion brief

## Why a separate package

Each catalog package owns one functional area (finance, customer-success, revenue, developer-experience). Each ships independently, has its own release cadence, and depends only on the primitive substrate (services-as-software + autonomous-finance + business-as-code). No cross-domain coupling.

## Status

Real implementation depends on:

- **`services-as-software` v2** shipping
- **`autonomous-finance`** Pricing primitives (especially `Pricing.perInvocation({ tiers })`)
- **`ai-evaluate`** EvaluatorPanel + reusable persona library (`accuracy-reviewer`, `voice-and-style`)

## References

- Beads epic: `aip-qszv`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
