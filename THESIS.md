# Thesis

> **The agentic economy is software economics applied to services.** This repo ships the OSS primitives that make it possible.

## 1. The setup

Software ate $1T of consumer attention because once a piece of software is written, the marginal cost of serving the next customer is near zero. Services — legal, accounting, support, sales, operations, software engineering itself — never enjoyed that economics. Every additional customer required additional human labor. The global services market is **~$100T**; it has never been touched by software economics.

AI agents change this. Not by replacing one human with one agent (the jagged-frontier problem makes this naive), but by enabling a structural inversion:

- Customers buy **outcomes**, not seats or hours.
- **Software and AI agents** deliver the work end-to-end.
- **Humans** appear only in oversight, exception handling, regulated steps, premium tiers, or relationship trust roles.

When those three conditions hold, a Service has **software economics on a service deliverable**. We call this **Services-as-Software**.

The same shift inverts the operator side: when the deterministic rails of the business (Goals, OKRs, processes, oversight, reward signals, financial controls) are themselves **executable typed code**, the operations manual *is* the company. We call this **Business-as-Code**.

These two paradigms are the headline products of `primitives.org.ai`. The whole substrate beneath exists to make them buildable.

## 2. Three-tier ecosystem

```
   COMMERCIAL    platform.do  (managed BaC runtime)
   MANAGED       api.services (managed SaS runtime)
                        ▲
                        │ host
                        │
   CATALOGS     agents.do                       startup-builder
                (~318 named human-curated)      (1M sb-generated via combinator)
                        ▲                              ▲
                        │ define on                    │ generate via Service.generate(grid)
                        │
   OSS           ┌──────────────────────────────────────────────┐
   PRIMITIVES    │  business-as-code  ($, Goal, OKR, Reward)    │  L6
   (this repo)   │  services-as-software                         │  L5
                 │  autonomous-finance, autonomous-{cs,rev,dx}   │  L5
                 │  digital-tools (Function-as-typed-primitive)  │  L4
                 │  ai-workflows, ai-database, autonomous-finance│  L3
                 │  ai-functions                                 │  L2
                 │  ai-providers, language-models, ai-experiments│  L1
                 │  digital-objects (SVO + token strata)         │  L0
                 └──────────────────────────────────────────────┘
```

- **OSS primitives** (this repo, npm packages) — composable typed building blocks.
- **Managed runtimes** — `platform.do` hosts the full BaC stack (operator's plane); `api.services` hosts SaS Service invocations (customer-facing plane). Sibling commercial offerings; out of this repo's scope.
- **Catalogs** — `agents.do` is a curated catalog of ~318 named Services. `startup-builder` is the auto-generated catalog producing 1M Services from the (ICP × Context × ProblemSignature) combinator. Both consume the primitives; both are out of this repo's scope.

A developer who installs `business-as-code` gets the umbrella `$` context; everything below is reachable. A SaaS company who runs on `platform.do` gets the managed version. A buyer who orders a Service from `agents.do` or `startup-builder` consumes the output.

## 3. The deterministic rails / non-deterministic execution dyad

This is the load-bearing architectural claim:

- **`business-as-code` is the deterministic rails.** Typed Goals, OKRs, KeyResults, OversightPolicy, EvaluatorPolicy, Process, Compliance, Audit. Every important concept is a typed value, not prose. The runtime checks invariants continuously. The git log of `business-as-code` IS the business's history.
- **`services-as-software` + `autonomous-agents` + `human-in-the-loop` are the cars on the rails.** Non-deterministic AI/agent execution. Workers (Person/Agent/Role) carry Identities and execute Functions; the cascade of Functions produces Actions; the Actions report back to the rails.
- **`autonomous-finance` is the financial nervous system the rails ride on.** Money, Cost, Card, Account, LedgerEntry, OutcomeContract, ProofPredicate, SLAPolicy, RefundContract, AuthorityBoundary. Substrate that both BaC and SaS consume.

The E-Myth principle, applied at framework scale: **creativity belongs at the system design level (the rails); execution belongs to the agent (the cars).**

## 4. OKRs are the agents' objective functions

Every AI agent needs a hill to climb. The hill is a **typed, computable KeyResult**.

```
                       PROFIT  ×  GROWTH    ← terminal hills (the only valid roots)
                              │
                       Strategic Goal(s)
                              │
                          KeyResult(s)              ← typed: metric (function returning #)
                              │                       + target + deadline; live, continuous
                              ▼
                    Function.reward = ref(KR)       ← every Function declares which KR it climbs
                              │                       lineage to a Profit/Growth root REQUIRED
                              ▼
                    Worker executes Function       ← carries Identity, spend cap (Card from substrate)
                              │
                              ▼
                  Action (with cost from substrate) ← ledger entry; reward delta computed
                              │
                              ▼
                Track record (per Worker, per Function)  ← updates earned-autonomy mode
                              │
                              ▼
                    Experiment (variant compete)   ← decideThompsonSampling already in ai-experiments
                              │
                              ▼
                Winning variant → commit to Service definition  ← git log = business history
                              │
                              ▼
                          KR moves
                              │
                              ▼
                Profit / Growth move
```

Two type-level rules enforce coherence:

- A `Function.reward` must reference a `KeyResult` (not a free-form callback).
- A `KeyResult` must trace lineage to either `Profit` or `Growth` (no orphan vanity metrics).

This collapses three book-level concepts (reward signals, computable OKRs, the experimentation machine) into one wire. Earned autonomy (manual → supervised → autonomous, driven by track record) is its natural extension — agents that reliably climb their assigned hill earn less supervision.

## 5. Bottoms-up from business.org.ai

The economy already has a canonical ontology — public economic standards (NAICS, O*NET / SOC, APQC PCF, NAPCS, UNSPSC, GS1, BLS, ISO). `business.org.ai` ingests them as TSVs + MDXLD, exposing typed Nouns at namespace URIs:

- `industries.org.ai/<NAICS-sector>` — 6-level hierarchy
- `occupations.org.ai/<O*NET-role>` — 4-level taxonomy
- `processes.org.ai/<APQC-PCF>` — 5-level process tree
- `tasks.org.ai/<verb.Object.prep.PrepObject>` — SVO-shaped Verbs
- `services.org.ai/<NAPCS-class>` — service categories
- `tools.org.ai/<O*NET-tool>` + `tech.org.ai/<O*NET-tech>`

The combinator atom is `ICPContextProblem = ICP × Context × ProblemSignature`. Walking the outer product across cells × discovery-lens-families × work-shaping-mechanisms produces millions of candidate (problem, customer) pairs. Quality gates (Click rubric ≥7/9, message-change ablation ≥0.85, ICP distinctness ≥0.85) cull to survivors. Each survivor becomes a `Service.define()` call with full lineage back to its originating cell.

`startup-builder` is the production cascade that runs this end-to-end: 1M RuntimeUnits at ~$0.15 LLM compute and ~5KB token storage each. The thesis is concrete and dated: 2026-05-14.

## 6. What this enables

When the rails + the cars + the financial substrate are all typed primitives, three things become possible that weren't before:

### a. Agents as economic actors

The Worker port (Person/Agent/Role) is symmetric across both sides of every transaction. The buyer is a Worker. The seller is a Worker. New commerce topologies emerge as natural compositions:

- **B2A** — agent buys directly from a business
- **A2A** — agent buys from another agent
- **B2A2B** — intermediating agent buys for a business
- **B2A2D** — intermediating agent buys for a developer (Stripe Projects pattern: agent picks the stack, sends URL to human for click-through pay/legal)

`autonomous-finance` ships AgentIdentity (with delegation), AgentMerchant, OutcomeContract, ProofPredicate — the four primitives Stripe didn't ship at Sessions 2026 — to make these topologies first-class.

### b. The autonomous finance department

CFO-shop work — bookkeeping, controllership, AP, AR, tax, treasury, payroll — is a set of **canonical Services** in `autonomous-finance/services/*`. The framework's proof-of-life is: a founder subscribes to Bookkeeper Service + Controller Service + AP Service + Tax Service, and the books actually close every month with the right numbers.

Same pattern for other departments:

- `autonomous-customer-success` — support-triage, NPS-followup, onboarding-runbook, churn-rescue
- `autonomous-revenue` — lead-qualification, meeting-prep, proposal-generator, contract-redliner
- `autonomous-developer-experience` — api-docs-writer, changelog-generator, sdk-generator

Each function-area is a sibling catalog package that consumes the primitives.

### c. Software engineering itself, as a Service

The headline test case for the framework. A Claude Code agent wrapped with a state machine that brainstorms → plans → scopes → dispatches waves of agents → reviews from divergent perspectives (QA, arch, security, product) → iterates until all reviewers approve the PR. **That is a sellable software engineering Service.** The same pattern generalizes to legal review, compliance audit, financial close, marketing campaign, sales prospecting, customer support, recruitment screening, contract negotiation — each is a 5-6 persona state machine over Functions of the four kinds.

The category is **~$10T** in current human labor spend (software engineering globally is ~$2-3T directly + the latent demand of every org that would buy bespoke if it were affordable). The pattern is uniform; the personas vary by domain.

## 7. The 7 load-bearing principles

These are what makes a system "really" Services-as-Software + Business-as-Code, vs. a typed bag of LLM calls:

1. **Customers buy outcomes, not seats or tokens.** The unit of commerce is the deliverable. Pricing is `outcome` first; subscription / per-invocation / composite are variants.
2. **Functions decompose into four kinds.** Code (deterministic), Generative (single-pass LLM), Agentic (multi-step LLM with tools), Human (with rationale + expiration policy). The kind is enforced at the type level. HumanFunctions carry a migration plan to autonomy.
3. **Multi-agent independent verification is the quality bar.** EvaluatorPanel of N independent personas (skeptic + opposing-counsel + reviewer + domain-expert), each must sign off. Rejection iterates; max-rounds escalates. Built-in or it's a toy.
4. **Outcomes are typed predicates, not prose.** `OutcomeContract.predicate` composes `EvaluatorPass` AND `External` AND `LoadBearingPass` AND `OverallFloor` AND `HumanSign` AND `SchemaMatch`. When the predicate passes, escrow releases.
5. **OKRs are the objective function.** Every Function carries a reward signal; every reward references a KeyResult; every KeyResult ladders to Profit or Growth. No orphan metrics.
6. **Earned autonomy is data-driven.** Workers and Functions carry AgentMode + TrackRecord. Promotion (manual → supervised → autonomous) and demotion are policy-evaluated continuously, not management decisions.
7. **Finance is substrate, not feature.** Money, Cost, Card, Account, LedgerEntry, AgentIdentity, OutcomeContract live in `autonomous-finance` at L3. Both BaC and SaS consume them. The Action SVO log IS the agentic-economy ledger.

## 8. The autonomous-startups frontier (deferred)

`services-as-software` is the **first** business-model primitive. The full picture is `autonomous-startups` — a meta-package that encompasses every autonomous-business model:

| Primitive | Maps to business model |
|---|---|
| `Service` | Services-as-Software (cascade-delivered outcome) |
| `SaaSProduct` | Headless SaaS (multi-tenant feature-gated software product) |
| `APIProduct` | API-as-a-Service |
| `DataProduct` | DaaS (curated dataset as deliverable) |
| `InfraProduct` | IaaS (provisioned infrastructure) |
| `PlatformProduct` | PaaS (managed platform) |
| `MarketplaceProduct` | Multi-sided platform |
| `DirectoryProduct` | Curated discovery layer |

`autonomous-startups` is scaffolded as a stub (`packages/autonomous-startups/`) but deferred until SaS lands. Its design will inform the abstraction over all business models — premature now.

## 9. Why these primitives, not Stripe / Anthropic / Vercel directly

Stripe ships the financial rails (MPP, SPTs, Issuing for Agents, Treasury, Streaming Payments). Anthropic ships the agent runtime (Claude Agent SDK + tool use + MCP). Vercel ships the durable execution (WDK + Worlds backends). Cloudflare ships Workers + Durable Objects + Workflows.

Why a layer above? Two reasons:

1. **The integration surface is the product.** A developer shipping a bookkeeper Service needs Money + AgentIdentity + OutcomeContract + EvaluatorPanel + cascade durability + ledger writes — composed coherently. Wiring those across five vendor SDKs is the work. The primitive layer collapses it into one typed call.
2. **Composability requires a shared SVO substrate.** Every priced exchange, every Goal update, every reward signal firing, every oversight gate passed/escalated — they're all Actions on the SVO substrate. Without that shared substrate, vendors' integrations stay vertical silos. With it, the agentic economy gets its accounting layer.

The depreciation curve is real (some primitives fold into MPP / Stripe Sessions 2027 over 12-18 months). The defensible primitives are the ones encoding **shared semantics across vendors**:

- The Function-as-typed-primitive (Code/Generative/Agentic/Human discriminated union)
- EvaluatorPanel as multi-persona independent verification
- OKRs ladder to Profit/Growth + per-Function reward signals
- Lineage refs back to business.org.ai canonical Nouns
- The synthetic-invocation gate ("invocation-ready or it does not count")

## 10. Source material

Two manuscripts and one production cascade ground this thesis:

- `/Users/nathanclevenger/projects/services-as-software/` — Services-as-Software book manuscript. Defines what a Service IS, the Four Functions, layered independent verification, HITL with expiration, outcome pricing, the moat above the model layer.
- `/Users/nathanclevenger/projects/business-as-code/` — Business-as-Code book manuscript. Defines the experimentation machine, OKRs as agent objective functions, earned autonomy, the operations-manual-IS-the-code thesis.
- `/Users/nathanclevenger/projects/startup-builder/` — production cascade orchestrator. The 1M RuntimeUnits thesis is here (`THESIS.md`, `ROADMAP.md`); the combinator atom (`COMBINATORS.md`); the 42-stage cascade (`CASCADE.md`); the typed entity catalog (`ENTITIES.md`); the cell taxonomy (`ONTOLOGY.md`).
- `/Users/nathanclevenger/projects/business.org.ai/` — canonical Noun substrate. NAICS / O*NET / APQC PCF / NAPCS / UNSPSC / GS1 / BLS / ISO ingested as TSVs + MDXLD.
- Stripe Sessions 2026 (April 29-30, 2026; 288 launches) — MPP, SPTs, Issuing for Agents, Treasury, Streaming Payments, Privy non-custodial wallets, Connect Marketplace Wallets, Stripe Projects, Agent Guardrails. Validates the agentic-finance bet.
- `/Users/nathanclevenger/projects/workers/domains/do.tsv` — `agents.do` catalog of ~318 named agents. Downstream consumer; out of primitive scope.

## 11. Design documentation

- `docs/plans/2026-05-05-business-as-code-stack-design.md` — L0-L3-L6 substrate (token strata, autonomous-finance core, `$` umbrella). Locks 11 architectural decisions.
- `docs/plans/2026-05-05-services-as-software-design-v3.md` — current Service primitive design. Mint vs. deliver split. Two FSMs (`ServiceLifecycle` + `InvocationLifecycle`). `Service<TIn, TOut>` typed via Standard Schema. Discriminated FunctionRef union. EvaluatorPanel + reusable persona library. Pricing factory variants. Extended ProofPredicate union.
- ADRs 0001-0004 (locked); ADRs 0005-0009 (forthcoming alongside their subsystems).

---

**This document is the why.** The design docs are the how. The packages are the what.
