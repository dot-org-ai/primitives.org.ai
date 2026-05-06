# autonomous-customer-success

> **Status: shipping.** First Service (`support-triage`) is live on the v3 `services-as-software` substrate.

Catalog package: customer-success Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for customer-success work that the agentic economy can deliver as software. Sibling of `autonomous-finance-services`, `autonomous-revenue`, `autonomous-developer-experience`.

## Shipped Services

- **`support-triage`** — incoming ticket → classify (Agentic, autonomous — already promoted via TrackRecord) → enrich (Code, CRM lookup) → draft-reply (Generative) → route (Agentic, supervised). High-volume `perInvocation` pricing across three tiers (starter / growth / scale, 1k / 10k / 100k included per month). HITL trigger routes to `human-agent` when `classify.confidence < 0.7`. Refund contract `quality-floor-fail`; authority boundary `tenant-only`; 1-day expiry. EvaluatorPanel of three personas (tone-reviewer, accuracy-reviewer, brand-voice-reviewer) under `all-approve`. Lineage: `business.org.ai/cells/customer-service-representatives/inbound-ticket-handling`.

  ```ts
  import { supportTriage } from 'autonomous-customer-success/support-triage'
  // typed as ServiceInstance<Ticket, Triaged>
  ```

## Future Services (sketched)

- **`nps-followup`** — survey response → sentiment classify → categorize → escalate or thank
- **`onboarding-runbook`** — new customer → tailored onboarding plan → execution + checkpoints
- **`churn-rescue`** — cancellation signal → diagnostic → save offer or graceful exit
- **`account-review`** — quarterly account health → renewal forecast → expansion brief

## Why a separate package

Each catalog package owns one functional area (finance, customer-success, revenue, developer-experience). Each ships independently, has its own release cadence, and depends only on the primitive substrate (services-as-software + autonomous-finance + business-as-code). No cross-domain coupling.

## Status

`support-triage` ships on the v3 substrate (`services-as-software/v3` + `autonomous-finance` `Pricing.perInvocation` + EvaluatorPanel/Personas inline in `services-as-software/v3`). Future Services land per the sketch above.

## References

- Beads epic: `aip-qszv`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design.md` (v1, §3.D Catalog HOW)
  - `docs/plans/2026-05-05-services-as-software-design-v3.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
