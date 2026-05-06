# autonomous-finance

> **Status: stub / scaffolded.** Package depends on `services-as-software` v2 shipping. See [Status](#status).

The financial nervous system for the agentic economy: typed primitives + provider adapters + a canonical catalog of finance Services.

## What this is

Two layers in one package, separated by import path:

### Substrate (L3) — `import { ... } from 'autonomous-finance'`

The typed primitive layer. `services-as-software`, `business-as-code`, and any L4-L5 package can import these:

- **`Money`, `Cost`, `Budget`, `SpendControl`** — value types
- **`Card`, `Account`, `LedgerEntry`** — runtime entities (Issuing, Treasury, ledger)
- **`AgentIdentity`, `AgentMerchant`** — cross-provider identity for agent-as-buyer and agent-as-seller (the four Stripe gaps from Sessions 2026)
- **`OutcomeContract`, `ProofPredicate`, `ProofOfResult`** — definition-of-done + escrow + release machinery (Stripe didn't ship this; we own it)
- **`SLAPolicy`, `RefundContract`, `AuthorityBoundary`** — typed catalogs binding into Service definitions
- **`Pricing.outcome` / `Pricing.subscription` / `Pricing.perInvocation` / `Pricing.composite`** — pricing factory variants
- **`FinanceProvider` port + `ProviderCapabilities`** — adapter contract

### Adapters — `import { stripe, tempo, x402, privy, lightspark } from 'autonomous-finance/adapters/*'`

- **`stripe-adapter`** — Issuing for Agents, Treasury, MPP, SPT, Streaming Payments, Connect Marketplace Wallets, Stripe Projects identity
- **`tempo-adapter`** — stablecoin micropayments (Stripe + Paradigm-backed; mainnet live March 2026)
- **`x402-adapter`** — HTTP 402 facilitator (Coinbase Base + USDC)
- **`privy-adapter`** — non-custodial wallets (150+ markets per Stripe Sessions 2026)
- **`lightspark-adapter`** — Lightning Network

### Catalog Services — moved to `autonomous-finance-services` (sibling package)

Originally planned as `autonomous-finance/services/*` subpath imports. That fails at the workspace dep graph (catalog needs `services-as-software`, but `services-as-software` already depends on `autonomous-finance`'s `Money`/`Pricing`/`OutcomeContract` substrate — Turborepo correctly rejects the cycle even with peer-dep declarations).

Catalog now lives at `packages/autonomous-finance-services/`. Substrate stays clean at L3 with no SaS dep.

Original (pre-split) catalog:

Concrete Services that prove the framework. Each is a full `Service.define({...})` call:

- **`bookkeeper`** — monthly books closed by day 5, GAAP-compliant, audit-ready
- **`controller`** — review books, enforce policy, produce statements
- **`ap`** — invoice → matched → approved/escalated → scheduled
- **`ar`** — invoice → sent → followed-up → collected → reconciled
- **`tax`** — quarterly accrual + annual return + filings + notices
- **`treasury`** — daily cash position + sweep + FX + runway forecast
- **`payroll`** — pay run preparation + approval + execution + tax filing

These are the proof-of-life: if a founder can subscribe and books actually close, the framework is real.

## Status

Scaffolded. Real implementation depends on:

- **`services-as-software` v2** — `Service.define()`, `Service.invoke()`, `EvaluatorPanel`, `OutcomeContract` (forthcoming; see `docs/plans/2026-05-05-services-as-software-design-v2.md`)
- **`business-as-code` `$` umbrella** — `$.Reward`, `$.KeyResult`, `$.Profit`, `$.Growth` (forthcoming; see `docs/plans/2026-05-05-business-as-code-stack-design.md`)
- **`digital-tools` Function-as-typed-primitive** — `Code/Generative/Agentic/Human` discriminated union with per-Function reward + cost + oversight

## Relationship to managed runtime

`autonomous-finance` is the OSS primitive layer. The managed runtime that hosts ledger, issues cards, runs Services, and integrates billing rails will live in a separate commercial offering (sibling to `api.services` + `platform.do`).

## Why "autonomous"

The name carries the thesis: autonomous agents transacting through autonomous financial rails. Agent as buyer (B2A, A2A, B2A2B, B2A2D) AND agent as seller — symmetric. See `docs/plans/2026-05-05-business-as-code-stack-design.md` for the full design.

## References

- Beads epic: `aip-dlmj`
- Companion design docs:
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
- Relevant ADRs: ADR-0003 (storage), ADR-0004 (durable execution); ADR-0007 tenant scoping (forthcoming), ADR-0009 cost-capture write strategy (forthcoming)
