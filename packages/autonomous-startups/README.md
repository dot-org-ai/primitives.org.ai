# autonomous-startups

> **Status: stub / deferred.** This package is intentionally empty. See [Why deferred](#why-deferred).

The meta-primitive for generating and operating autonomous startups, across every business model — not just Services-as-Software.

## What this is

`autonomous-startups` sits above `business-as-code` as the `L7` paradigm for *the autonomous business itself*. Where `business-as-code` provides the deterministic rails (Goals, OKRs, Oversight, Process, the experimentation machine) and `services-as-software` provides one specific business-model primitive (deliver outcomes via cascaded Functions), `autonomous-startups` provides:

- One typed primitive per business-model archetype
- Higher-order generators that produce N businesses across a strategic-token grid (the "1M businesses from every (ICP × Problem)" thesis, generalized beyond Services-as-Software)
- Shared substrate over `business-as-code` rails + `autonomous-finance` economics
- Marketplace, portal, onboarding UI primitives common across business models

## Business models in scope

| Primitive | Maps to business model |
|---|---|
| `Service` | Services-as-Software (cascade-delivered outcome) — lives in `services-as-software` |
| `SaaSProduct` | Headless SaaS — multi-tenant feature-gated software product |
| `APIProduct` | API-as-a-Service — programmable interface as the deliverable |
| `DataProduct` | DaaS — curated dataset as the deliverable |
| `InfraProduct` | IaaS — provisioned infrastructure as the deliverable |
| `PlatformProduct` | PaaS — managed platform as the deliverable |
| `MarketplaceProduct` | Marketplace — multi-sided platform connecting buyers and sellers |
| `DirectoryProduct` | Directory — curated discovery layer |

Each primitive shares structure (a typed mint contract, a durable invocation/usage FSM, pricing, oversight, lineage) but differs in delivery mechanics, customer experience, and economic model.

## Why deferred

This package depends on several primitives that are still being designed and built:

- **`services-as-software`** — the first business-model primitive needs to land first; its shape informs the abstraction over all business models. (Design: `docs/plans/2026-05-05-services-as-software-design.md`.)
- **`business-as-code`** — the `$` umbrella + Goals/OKRs/Reward/Oversight rails. (Design: `docs/plans/2026-05-05-business-as-code-stack-design.md`.)
- **`autonomous-finance`** — the financial substrate (Money/Cost/Card/Account/Ledger/OutcomeContract/SLAPolicy + provider adapters).
- **`digital-tools`** Function-as-typed-primitive — the Four Functions (Code/Generative/Agentic/Human) promoted to a first-class kind.

Designing `autonomous-startups` before these stabilize would bake premature assumptions into the abstraction. We keep this package as a stub to:

1. Reserve the name and the conceptual slot
2. Track the work via beads epic `aip-n1b8`
3. Make the deferral explicit in the package map (so contributors don't propose competing meta-packages)

## What to do here today

Nothing. The work happens in the prerequisites. When `services-as-software` is shipped and at least one other business-model primitive has been prototyped, this package gets a real design pass and starts to fill in.

## References

- Design conversation: 2026-05-05 architecture review session
- Beads epic: `aip-n1b8`
- Companion design docs:
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
  - `docs/plans/2026-05-05-services-as-software-design.md` (forthcoming)
