# Business-as-Code Stack Design

**Status:** draft (interface skeletons; expected to evolve)
**Date:** 2026-05-05
**Related:** ADR-0001..0004; `docs/plans/2026-05-05-svo-co-design.md`; `docs/plans/2026-05-05-cascade-storage-execution-implementation.md`

## Context

The 2026-05-05 architecture review and subsequent grilling sessions surfaced that several L5 packages (`services-as-software`, `business-as-code`, parts of `human-in-the-loop`) are shallow because the substrate they need does not yet exist as primitives. Downstream consumers (`/Users/nathanclevenger/projects/startup-builder`, the SaS book at `/Users/nathanclevenger/projects/services-as-software`, the BaC book at `/Users/nathanclevenger/projects/business-as-code`, and the Stripe Sessions 2026 launch surface) were each forced to invent the missing pieces independently. This document specifies the substrate they should have been able to import, plus the umbrella `$` runtime that exposes it.

The framing crystallized through the conversation:

- **`business-as-code` is the deterministic rails** that wrap autonomous agents and AI-delivered services. It is not a parallel L5 package — it is the umbrella (L6) that owns the rails (Goals, OKRs, Oversight, Process, Compliance, Audit, the experimentation machine) and re-exports everything below behind a single `$` context.
- **`services-as-software` is the cars on the rails.** A Service is mint-and-deliver — a typed publishable record + a durable invocation FSM — sized down to its actual job once the substrate carries the weight.
- **The Function is the atom**, decomposed into Code / Generative / Agentic / Human kinds (the SaS book's Four Functions; the language is already in `digital-tasks`'s `Task` definition).
- **The agentic economy needs financial rails** (Money, Cost, Card, Account, Ledger, AgentIdentity, AgentMerchant, OutcomeContract, ProofOfResult, SLAPolicy) that are first-class primitives, not bolt-ons. Stripe Sessions 2026 shipped substantial parts of this (MPP, SPTs, Issuing for Agents, Treasury, Streaming Payments, Connect Marketplace Wallets, Privy non-custodial wallets) but did not ship outcome-predicate / proof-of-result release, B2B SLA-shaped refund/credit, agent-as-merchant identity, or provider-agnostic settlement abstraction. Those are the gap-filler primitives the substrate must own.
- **OKRs are the AI agents' objective functions.** A `Function.reward` references a `KeyResult`; the KeyResult must trace lineage to one of two terminal hills (`Profit` or `Growth`); experiments are how variants compete to climb the hill; track records are how earned autonomy is measured.
- **The buyer is also a Worker.** The Worker port (Person/Agent/Role) covers both sides of every transaction. Commerce topology (B2C / B2B / B2B2C / B2A / A2A / B2A2B / B2A2D) is just the shape of the Subject/Recipient axis on the purchase Action; no new vocabulary is needed.

## Locked architectural decisions

1. **`business-as-code` is promoted to L6** as the umbrella that exports `$` and re-exports all primitives below. It does not retire `ai-primitives` or `org.ai`; the three umbrellas serve different audiences (paradigm / technical bundle / cross-repo with subpaths).
2. **`autonomous-finance` is a new L3 package** alongside `ai-database` and `ai-workflows`. Naming carries the thesis: autonomous agents transacting through autonomous financial rails. Catalog Services (bookkeeper, controller, AP, AR, tax, treasury, payroll) ship as a subpath: `autonomous-finance/services/*` (logically L5; layer rules preserved by import path).
3. **`ai-experiments` is reclassified as L1 substrate.** `business-as-code` re-exports it as the canonical experimentation API (`$.experiments`).
4. **Token strata (FROZEN / NEGOTIABLE / EXPRESSION / COMPOSITION) are added to `digital-objects` at L0** as a field-level annotation orthogonal to Frame.
5. **The Four Functions (Code / Generative / Agentic / Human) become a typed primitive in `digital-tools`.** The vocabulary is already in `digital-tasks`'s `Task` definition; it gets promoted to a first-class kind on `Tool` with `reward`, `cost`, and `oversight` fields.
6. **The Service is mint vs. deliver.** `Service.define()` returns a publishable typed record (OutputContract + ServiceBinding + EvaluatorPanel + OversightPolicy + Pricing + Reward + CostModel). `Service.invoke()` returns a handle to a durable `ServiceInvocation` FSM (CF Workflows backend per ADR-0004).
7. **`Function.reward` references a KeyResult; KeyResults must ladder up to `Profit` or `Growth`.** The two terminal hills are auto-injected on `business-as-code` import; lineage validation happens at registration time.
8. **The buyer is a Worker.** Commerce topology is encoded by which kinds of Worker fill Subject/Recipient on the purchase Action, not by separate vocabulary.
9. **`$` is the umbrella context with double-entendre.** `$$$` is exported as an alias of `$.money`. Workflow primitives (`$.on`, `$.every`, `$.send`, `$.log`) and BaC-native rails (`$.Goal`, `$.KeyResult`, `$.Reward`, `$.Oversight`) sit at top-level for ergonomics. Entities appear at root in both singular (one-shape) and plural (many-shape) forms.
10. **`$.api` is bidirectional — input AND output APIs on one symmetric primitive.** From outside (calling): `$.api.github.repos.list()`, `$.api.salesforce.contacts.find\`...\``, `$.api.stripe.charges.list()`. From inside (defining): `$.api.POST('/users', handler)`, `$.api.GET('/orders/:id', handler)`. The same `API` object is consumer (Zapier/Composio surface) and provider (your endpoints, callable by SDK or other agents). The symmetry exists because every endpoint your app defines IS callable by anyone else's `$.api` — input/output is just perspective.
11. **`finance-services` does not become its own package.** Catalog Services live at `autonomous-finance/services/*`.

## The stack

### Layer cake

```
   COMMERCIAL   platform.do (managed BaC runtime)  ·  api.services (managed SaS runtime)
   CATALOGS     agents.do (~318 named agents)     ·  startup-builder (1M sb-generated)
                          ──── built on ────  the OSS primitives below ────
              L6 (umbrellas — three coexisting, different audiences)
              ┌────────────────────────────────────────────────────────┐
              │  business-as-code     ai-primitives        org.ai      │
              │  (paradigm / $)       (technical bundle)   (cross-repo │
              │                                             subpaths:  │
              │                                             schema/mdx │
              │                                             /id/...)   │
              └────────────────────────────────────────────────────────┘
                       │                ↓                    ↓
              L5  services-as-software · autonomous-agents
                  human-in-the-loop · digital-products
                  autonomous-finance/services/*           ← catalog (subpath)
                  autonomous-customer-success · autonomous-revenue
                  autonomous-developer-experience         ← catalog packages
              L4  digital-workers · digital-tools · digital-tasks
              L3  ai-database · ai-workflows · autonomous-finance      ← NEW
              L2  ai-functions
              L1  ai-providers · language-models · ai-experiments       ← reclassified
              L0  digital-objects · @org.ai/types · @org.ai/config
                  (external: org.ai · schema.org.ai · mdx.org.ai · id.org.ai)
              Parallel: ai-tests · ai-evaluate · ai-props
```

**Three-tier ecosystem:**
- **OSS primitives** (this repo, npm packages) — the L0–L6 stack above.
- **Commercial managed runtimes** — `platform.do` hosts the full `business-as-code` stack; `api.services` hosts `services-as-software` Service invocations. Sibling commercial offerings; out of scope for this repo.
- **Catalogs** — `agents.do` is a human-curated catalog of ~318 named Service-as-Software agents (`projects/workers/domains/do.tsv`); `startup-builder` is the sb-generated catalog producing 1M Services from (ICP × Context × ProblemSignature) combinators. Both consume the primitives; both are out of primitives.org.ai's scope.

### Dependency graph rooted at `business-as-code`

```
business-as-code  (L6 — the only thing app code imports)
   │
   ├── services-as-software        Service.define + ServiceInvocation FSM
   ├── autonomous-agents           Agent + Role (rebased on org.ai)
   ├── human-in-the-loop           Human + HITL Coordinator
   ├── digital-products            Product primitives
   │      │
   │      ├── digital-workers      Worker port + lifecycle DO
   │      ├── digital-tools        Tool (Code/Generative/Agentic/Human + reward + cost)
   │      ├── digital-tasks        Task = Tool + metadata
   │      │      │
   │      │      ├── ai-database         Repo + CascadeEvent log + adapters
   │      │      ├── ai-workflows        Workflow + durable execution + cascade-executor
   │      │      ├── autonomous-finance  Money/Cost/Card/Account/Ledger + adapters
   │      │      │      │
   │      │      │      ├── stripe-adapter    (Issuing/Treasury/MPP/SPT/Streaming/Connect)
   │      │      │      ├── tempo-adapter     (stablecoin micropay)
   │      │      │      ├── x402-adapter      (HTTP 402 facilitator)
   │      │      │      ├── privy-adapter     (non-custodial wallets)
   │      │      │      └── lightspark-adapter (Lightning)
   │      │      │
   │      │      └── ai-functions  AIPromise, generate(), function-registry
   │      │             │
   │      │             ├── ai-providers     unified registry
   │      │             ├── language-models  model resolution
   │      │             └── ai-experiments   bandits, decideThompsonSampling/UCB
   │      │
   │      └── digital-objects      Noun/Verb/Frame/Thing/Action + token strata [NEW]
   │              │
   │              ├── @org.ai/types
   │              ├── @org.ai/config
   │              └── (external: id.org.ai, schema.org.ai, org.ai)
   │
   └── BaC-native, no further deps below:
          Goals, OKRs, KeyResults, Reward (linked to Profit/Growth roots)
          OversightPolicy, EvaluatorPolicy
          Process, Compliance, Audit
          Experiment runner (re-export from ai-experiments)
          Pricing/Plans/Entitlements (re-export from autonomous-finance)
```

## L0 — Token strata in `digital-objects`

A field-level annotation classifying mutation/composition rules. Orthogonal to Frame (which classifies the role a Thing plays in an Action).

```ts
// digital-objects/src/types.ts (additions)

export type TokenStratum =
  | 'frozen'        // set once at creation; never mutates; identity-bearing
  | 'negotiable'    // intentionally null; downstream stage may fill ONCE
  | 'expression'    // free-form mutable content (default; prose, copy, attributes)
  | 'composition'   // bandit-eligible variants picked at render-time

export interface FieldDefinition {
  type: PrimitiveType
  required?: boolean
  stratum?: TokenStratum             // default 'expression'
  variants?: unknown[]                // required iff stratum === 'composition'
  // ...existing fields
}

// Sugar factories used inside schema definitions
export const Frozen      = <T>(type: T, opts?: Partial<FieldDefinition>): FieldDefinition
export const Negotiable  = <T>(type: T, opts?: Partial<FieldDefinition>): FieldDefinition
export const Expression  = <T>(type: T, opts?: Partial<FieldDefinition>): FieldDefinition
export const Composition = <T>(type: T, variants: T[],
                               opts?: Partial<FieldDefinition>): FieldDefinition
```

### Runtime enforcement (every `DigitalObjectsProvider`)

| Stratum | Update behaviour |
|---|---|
| `frozen` | throws `TokenStratumViolation` |
| `negotiable` | OK iff currently null/undefined; second update throws |
| `expression` | always OK |
| `composition` | direct assignment throws; mutate via `pickComposition(thingRef, fieldName, variantIdx)` |

### Queryability

```ts
provider.stratumOf(nounRef, fieldName): TokenStratum
provider.compositionFields(nounRef): { field: string; variants: unknown[] }[]
provider.pickComposition(thingRef, fieldName, variantIdx): Promise<void>
```

### Worked example

```ts
const Service = defineNoun({
  name: 'Service',
  schema: {
    id:           Frozen('string'),
    name:         Frozen('string'),
    description:  Expression('string'),
    pricingTier:  Composition('string', ['basic', 'pro', 'enterprise']),
    industryHint: Negotiable('string'),
  },
})
```

## L3 — `autonomous-finance` core

Types + adapter port + capabilities. Stripe is the first adapter; the port is provider-agnostic.

### Core types

```ts
// autonomous-finance/src/types.ts

import type { ActionRef, ThingRef, WorkerRef } from 'digital-objects'

// ── Money ────────────────────────────────────────────────
export type Currency = FiatCurrency | StablecoinCurrency | CryptoCurrency
export type FiatCurrency       = 'USD' | 'EUR' | 'GBP' | string
export type StablecoinCurrency = 'USDC' | 'PYUSD' | 'USDT' | 'USDG'
export type CryptoCurrency     = 'BTC' | 'ETH' | 'SOL'

export interface Money {
  amount: bigint                     // integer in smallest unit (cents/satoshis/wei)
  currency: Currency
}

// ── Cost capture (every Action can incur Cost) ───────────
export interface Cost {
  $id: string
  $type: 'Cost'
  actionRef: ActionRef
  amount: Money
  provider: string                   // 'openai' | 'anthropic' | 'stripe' | ...
  category: 'inference' | 'compute' | 'storage' | 'api' | 'human' | 'rail-fee' | 'other'
  capturedAt: Date
}

// ── Budgets / spend control ──────────────────────────────
export type BudgetScope =
  | { kind: 'worker';     ref: WorkerRef }
  | { kind: 'function';   ref: ThingRef }
  | { kind: 'goal';       ref: ThingRef }
  | { kind: 'experiment'; ref: ThingRef }
  | { kind: 'tenant';     ref: ThingRef }

export interface Budget {
  $id: string
  $type: 'Budget'
  scope: BudgetScope
  cap: Money
  period: 'daily' | 'weekly' | 'monthly' | 'one-time'
  resetAt?: Date
}

export interface SpendControl {
  budgetRef: string
  soft?: number                      // 0-1 of cap; warn at this fraction
  hard: number                       // 0-1 of cap; block/escalate
  onBreach: 'block' | 'escalate' | 'warn'
  escalateTo?: WorkerRef
}

// ── Card (Issuing) ───────────────────────────────────────
export interface Card {
  $id: string
  $type: 'Card'
  scope: 'single-use' | 'recurring'
  workerRef?: WorkerRef
  caps: { perTransaction?: Money; daily?: Money; total?: Money }
  mccAllowed?: string[]
  velocity?: { maxTxPerDay?: number }
  state: 'issued' | 'active' | 'locked' | 'disposed'
  providerData: { provider: string; externalId: string }
}

// ── Account ──────────────────────────────────────────────
export interface Account {
  $id: string
  $type: 'Account'
  tenantRef?: ThingRef
  purpose: string
  currency: Currency
  providerData: { provider: string; externalId: string }
}

// ── Ledger entry — IS an Action under the SVO substrate ──
export interface LedgerEntry {
  $id: string
  $type: 'LedgerEntry'
  actionRef: ActionRef
  debits:  { accountRef: string; amount: Money }[]
  credits: { accountRef: string; amount: Money }[]
  // Invariant: sum(debits.amount) === sum(credits.amount), per currency
}

// ── Identity / Merchant (cross-provider) ─────────────────
export interface AgentIdentity {
  $id: string
  $type: 'AgentIdentity'
  workerRef: WorkerRef
  delegatedFor?: WorkerRef           // for B2A2D / B2A2B; null when buying for self
  scopes: string[]
  providerCreds: Record<string, unknown>
}

export interface AgentMerchant {
  $id: string
  $type: 'AgentMerchant'
  workerRef: WorkerRef
  payoutAccountRef: string
  providerData: Record<string, unknown>
}

// ── Outcome contract (Stripe didn't ship; gap-filler) ────
export interface OutcomeContract {
  $id: string
  $type: 'OutcomeContract'
  buyer: WorkerRef
  seller: WorkerRef
  serviceRef: ThingRef
  predicate: ProofPredicate
  amount: Money
  escrowAccountRef?: string
  expiresAt: Date
}

export type ProofPredicate =
  | { kind: 'schema-match';   schema: unknown }
  | { kind: 'evaluator-pass'; panelRef: ThingRef; minScore: number }
  | { kind: 'human-sign';     signerRoles: string[] }
  | { kind: 'external';       verifier: WorkerRef; spec: unknown }

export interface ProofOfResult {
  $id: string
  $type: 'ProofOfResult'
  contractRef: string
  signedBy: WorkerRef
  signedAt: Date
  outputRef?: ActionRef
  signature?: string
}

// ── SLA policy ───────────────────────────────────────────
export interface SLAPolicy {
  $id: string
  $type: 'SLAPolicy'
  serviceRef: ThingRef
  targets: SLATarget[]
  onBreach: {
    creditPercent?: number
    refundPercent?: number
    escalateTo?: WorkerRef
  }
}

export interface SLATarget {
  metric: 'latency-ms' | 'accuracy' | 'on-time' | 'completeness' | string
  threshold: number | string
}
```

### The port (one interface, many adapters)

```ts
// autonomous-finance/src/port.ts

export interface FinanceProvider {
  readonly name: string
  readonly capabilities: ProviderCapabilities

  // Charge / refund
  charge(opts: ChargeOpts): Promise<ChargeResult>
  refund(chargeId: string, amount?: Money): Promise<RefundResult>

  // Cards
  issueCard?(spec: CardSpec): Promise<Card>
  lockCard?(cardId: string): Promise<void>

  // Accounts / treasury
  openAccount?(spec: AccountSpec): Promise<Account>
  balance?(accountId: string): Promise<Money>
  transfer?(opts: TransferOpts): Promise<TransferResult>

  // Outcome / escrow (built on MPP Sessions, x402 escrow, or provider-native)
  escrow?(contract: OutcomeContract): Promise<EscrowHandle>
  release?(escrowHandle: string, proof: ProofOfResult): Promise<ReleaseResult>

  // Subscriptions / metering
  subscribe?(opts: SubscribeOpts): Promise<Subscription>
  meter?(event: MeterEvent): Promise<void>
}

export interface ProviderCapabilities {
  payments: boolean
  refunds: boolean
  issuing: boolean
  treasury: boolean
  escrow: boolean
  subscriptions: boolean
  metering: boolean
  multiCurrency: boolean
  currencies: Currency[]
  stablecoins: StablecoinCurrency[]
  rails: ('mpp' | 'spt' | 'x402' | 'streaming' | 'card' | 'wire' | 'ach' | 'lightning')[]
}
```

### Subpath catalog (logical L5, ships in same package)

```
autonomous-finance/services/bookkeeper   — Service.define(...)
autonomous-finance/services/controller   — Service.define(...)
autonomous-finance/services/ap           — Service.define(...)
autonomous-finance/services/ar           — Service.define(...)
autonomous-finance/services/tax          — Service.define(...)
autonomous-finance/services/treasury     — Service.define(...)
autonomous-finance/services/payroll      — Service.define(...)
```

These are the proof-of-life: if a founder can subscribe and books actually close, the framework is real.

## L6 — `$` in `business-as-code`

The umbrella context. Top-level for ergonomics; sub-namespaces for organization; entities flat at root in both singular and plural forms; money as both `$.money` and `$$$`.

### The interface

```ts
// business-as-code/src/dollar.ts

import type { AIPromise } from 'ai-functions'
import type { Money, OutcomeContractSpec, ChargeOpts, EscrowHandle } from 'autonomous-finance'
import type { Action, ActionRef, ListOptions, Thing, ThingInput } from 'digital-objects'

// ── The umbrella interface ──────────────────────────────────────────
export interface Dollar extends EntityRoot {
  // Headline DX: template literal → AI generation
  (strings: TemplateStringsArray, ...values: unknown[]): AIPromise<string>

  // Capability namespaces (organized)
  ai:          AICapabilities
  db:          DBCapabilities
  workflows:   WorkflowCapabilities
  workers:     WorkerCapabilities
  tools:       ToolCapabilities
  tasks:       TaskCapabilities
  agents:      AgentCapabilities
  humans:      HumanCapabilities
  services:    ServiceCapabilities
  experiments: ExperimentCapabilities      // re-export of ai-experiments
  evaluate:    EvaluateCapabilities
  money:       MoneyContext                // alias of $$$
  api:         API                         // bidirectional: input (call out) + output (define endpoints)
  audit:       AuditCapabilities

  // Workflow primitives (top-level for ergonomics)
  on:          EventNamespace              // $.on.Customer.created(handler)
  every:       SchedulerNamespace          // $.every.hour(handler)
  send(verb: string, payload: unknown): Promise<Action>
  log:         Logger

  // BaC-native rails (top-level)
  Goal(spec: GoalSpec): Goal
  OKR(spec: OKRSpec): OKR
  KeyResult(spec: KeyResultSpec): KeyResult
  Reward(kr: KeyResult | { id: string }): RewardSignal
  Oversight(spec: OversightSpec): OversightPolicy

  // Top-level reads of the org's terminal hills
  readonly Profit:  KeyResult              // canonical root
  readonly Growth:  KeyResult              // canonical root
  readonly Finance: FinanceViews           // arr/mrr/grossMargin/runway/...
}

// ── Entity root: typed flat access in both singular AND plural ──────
// linguistic.ts gives runtime singular/plural per Noun;
// type-level inference makes both keys appear in autocomplete.
//
//   $.Customer.get(id)               ← findOne
//   $.Customer.find`...`              ← findOne natural language
//   $.Customers.list()                ← collection
//   $.Customers.find`...`             ← findMany natural language
//   $.Customers.count()
export type EntityRoot =
  & { [K in RegisteredNouns as K['singular']]: SingularNounAccess<K> }
  & { [K in RegisteredNouns as K['plural']]:   PluralNounAccess<K> }

export interface SingularNounAccess<N> {
  get(id: string): AIPromise<Thing<N>>
  find(strings: TemplateStringsArray, ...values: unknown[]): AIPromise<Thing<N>>
  create(input: ThingInput<N>): AIPromise<Thing<N>>
  update(id: string, patch: Partial<ThingInput<N>>): AIPromise<Thing<N>>
  delete(id: string): Promise<void>
}

export interface PluralNounAccess<N> {
  list(opts?: ListOptions): AIPromise<Thing<N>[]>
  find(strings: TemplateStringsArray, ...values: unknown[]): AIPromise<Thing<N>[]>
  count(opts?: ListOptions): AIPromise<number>
}

// ── Money context (also exported as $$$) ────────────────────────────
export interface MoneyContext {
  charge(opts: ChargeOpts): Promise<Action>
  refund(chargeRef: string, amount?: Money): Promise<Action>
  pay(toWorker: WorkerRef, amount: Money): Promise<Action>
  escrow(contract: OutcomeContractSpec): Promise<EscrowHandle>

  readonly balance: Money
  readonly arr: Money
  readonly mrr: Money
  readonly grossMargin: number
  readonly runwayMonths: number
}

// ── API: bidirectional surface ──────────────────────────────────────
// One primitive serves both directions:
//
//   OUTPUT (calling external):
//     await $.api.github.repos.list()
//     await $.api.salesforce.contacts.find`enterprise customers`
//     await $.api.slack.channels.create({ name: 'launch' })
//     await $.api.stripe.charges.list({ customer: 'cus_123' })
//
//   INPUT (defining your own — same object):
//     $.api.POST('/users', handler)
//     $.api.GET('/orders/:id', handler)
//     $.api.WebSocket('/stream', handler)
//
// Endpoints you define ARE callable by anyone's $.api in turn.
// SDKs are auto-generated from the input side and consumed via the output side.
export interface API {
  // Output: provider integrations registered via module augmentation
  //   $.api.github, $.api.stripe, $.api.salesforce, ...
  [provider: string]: APIProvider | unknown

  // Input: define endpoints
  GET    (path: string, handler: APIHandler): RouteRef
  POST   (path: string, handler: APIHandler): RouteRef
  PUT    (path: string, handler: APIHandler): RouteRef
  PATCH  (path: string, handler: APIHandler): RouteRef
  DELETE (path: string, handler: APIHandler): RouteRef
  WebSocket(path: string, handler: WSHandler): RouteRef

  // Reflection: what's defined, what's available
  endpoints(): RouteRef[]
  providers(): string[]
}

export interface APIProvider {
  [resource: string]: APIResource
}

export interface APIResource {
  list(opts?: unknown): AIPromise<unknown[]>
  get(id: string): AIPromise<unknown>
  create(input: unknown): AIPromise<unknown>
  update(id: string, patch: unknown): AIPromise<unknown>
  delete(id: string): Promise<void>
  // Plus provider-specific custom verbs (e.g. github.repos.fork())
}

export type APIHandler = (req: APIRequest, $: Dollar) => Promise<unknown> | unknown
export type WSHandler  = (ws: APIWebSocket, $: Dollar) => Promise<void> | void
```

### Export shape

```ts
// business-as-code/src/index.ts

export const $:   Dollar
export const $$$: MoneyContext      // alias of $.money

// Re-exports — flat, organized by domain (not by package)
export {
  // BaC-native (also accessible via $)
  Goal, OKR, KeyResult, Reward, Oversight, Process, Compliance, Audit,
  // Services
  Service,
  // Workers
  Worker, Agent, Human, Role, Team,
  // Tools / Tasks
  Tool, Task,
  // Substrate
  Money, Cost, Budget, Card, Account, OutcomeContract, SLAPolicy,
  // SVO
  Noun, Verb, Frame, Thing, Action,
  Frozen, Negotiable, Expression, Composition,
  // Lower
  DB, Workflow, Experiment,
}
```

### Worked example (the headline DX)

```ts
import { $, $$$ } from 'business-as-code'

// Strategic Goal — KRs ladder up to Profit/Growth automatically
const profitable = $.Goal({
  objective: 'Profitable growth',
  rollsUpInto: $.Profit,
  keyResults: [
    $.KeyResult({ metric: () => $.Finance.arr,         target: 10_000_000n, deadline: '2026-12-31' }),
    $.KeyResult({ metric: () => $.Finance.grossMargin, target: 0.80,        deadline: '2026-12-31' }),
  ],
})

// A Service that climbs gross margin
const bookkeeper = $.services.define({
  name: 'Bookkeeper',
  outputContract: { audience: 'business', input: TxSchema, output: BooksSchema },
  binding: cascade,
  evaluators: $.evaluate.panel(['skeptic', 'gaap-validator', 'reviewer']),
  oversight:  $.Oversight({ mode: 'supervised', escalateOn: 'reconciliation_break > $100' }),
  pricing:    { plan: 'monthly', sla: { closeBy: 'day-5' } },
  reward:     $.Reward(profitable.keyResults[1]),
  costModel:  { perTx: 0.01n, perInvocation: 0.50n },
})

// Workflow handler
$.on.Invoice.received(async (invoice) => {
  await $.tasks.create({ tool: bookkeeper, input: invoice })
})

// External integration (Zapier/Composio surface)
const tickets = await $.api.zendesk.tickets.find`open billing tickets`

// Single entity in singular, collection in plural
const customer = await $.Customer.get('cus_123')
const churned  = await $.Customers.find`churned in the last 30 days`

// Read terminal hills
console.log(await $.Profit.progress, await $.Growth.progress)
```

## Open decisions

Drafted; still need user input.

### L0 — token strata

- Default stratum if unspecified — `expression` (forgiving) or `frozen` (strict)?
- `Composition` variants: variant-only, or carry weights/priors? Where do priors live — token strata or `ai-experiments`?
- `negotiable`: one fill (sb-style) or many?

### L3 — `autonomous-finance`

- `Money.amount`: `bigint` (precision-safe) vs. `number` (DX-friendly). Currently drafted as `bigint`.
- `OutcomeContract.predicate` kinds — four shipped (`schema-match` / `evaluator-pass` / `human-sign` / `external`). More kinds (cron-deadline / composite-and / composite-or)?
- `LedgerEntry` double-entry invariant — provider-enforced at write-time, or lint-time?
- Provider port: every method optional + capabilities-gated, or split into `PaymentProvider` / `IssuingProvider` / `TreasuryProvider` / `EscrowProvider` and let adapters implement N of M?

### L6 — `$`

- `EntityRoot` — singular AND plural keys for every Noun (decided yes); singular operations include `create` and `update`/`delete` (typically one-shape); plural includes `list`/`find`-many/`count`. Open: should plural also have `createMany`?
- Auto-injected `Profit` / `Growth` roots vs. explicit per-app declaration. Currently drafted as auto-injected.
- `$$$` alias only, or also `$.money` (both currently drafted).
- Workflow primitives (`$.on` / `$.every` / `$.send` / `$.log`) at top level vs. under `$.workflows`. Drafted top-level.
- ~~Where does endpoint-defining live?~~ **Resolved: `$.api` is bidirectional.** Same object handles output (calling external APIs) and input (defining your own endpoints). SDKs are generated from the input side and consumed via the output side; the symmetry means an endpoint your app exposes IS callable by another agent's `$.api`.

## Implementation order

Bottom-up for the substrate (L0 → L3); top-down for the user-facing surface (L4 → L6).

1. **L0 token strata** in `digital-objects` — smallest primitive, biggest downstream unlock. Add `TokenStratum`, sugar factories, runtime enforcement in `MemoryProvider` and `NS`. Lift through `DigitalObjectsProvider` interface.
2. **L3 Repo + CascadeEvent log** lifted to a stable interface in `ai-database`. Recent commits (`e1fe8bf`, `5993df0`, `240adb0`) landed cascade emitters; this step formalizes the `Repo` shape with sub-stores and the typed `CascadeEvent` log.
3. **L3 `autonomous-finance` package** scaffolded. Core types + port + capabilities; first adapter is `stripe-adapter` wrapping the Stripe Sessions 2026 surface (Issuing, Treasury, MPP, SPT, Streaming Payments, Connect).
4. **L4 Function-as-typed-primitive** in `digital-tools`. Promote the Four-Function kind language (already in `digital-tasks`'s `Task` definition) to a `Tool` kind field, with `reward`, `cost`, `oversight` fields.
5. **L5 `Service.define()` + `ServiceInvocation` FSM** in `services-as-software`. Mint vs. deliver split. FSM persisted via CF Workflows per ADR-0004.
6. **L5 EvaluatorPanel** in `ai-evaluate` (extension). Multi-persona reviewer panel as a primitive.
7. **L5 OversightPolicy + earned-autonomy track record** — policy in `business-as-code`; track-record Actions in `ai-database`.
8. **L6 `$` umbrella** in `business-as-code`. Wire up all the namespaces + entity root + BaC-native rails + Profit/Growth roots.
9. **L1 `ai-experiments` reclassification** — move tests, update docs; `business-as-code` re-exports as `$.experiments`.
10. **L5 catalog Services** at `autonomous-finance/services/*` — bookkeeper first as the proof-of-life.

## Source material

- **`/Users/nathanclevenger/projects/services-as-software/`** — Services-as-Software book manuscript. Definition of a Service (outcome + agents + humans-only-for-oversight); the Four Functions decomposition; layered independent verification (multi-agent review pattern); HITL with expiration dates; outcome-based pricing with SLA + dispute machinery; the moat is above the model layer.
- **`/Users/nathanclevenger/projects/business-as-code/`** — Business-as-Code book manuscript. Operations manual IS the executable code; typed Goals/OKRs with computable KeyResults; reward signals on every Function; the experimentation machine (event → action → measurement → commit); earned autonomy via track record; teams are emergent (not first-class).
- **`/Users/nathanclevenger/projects/startup-builder/`** — production cascade orchestrator. ServiceListing as typed reference triple (ServiceOffering + ServiceBinding + OutputContract + EvaluatorConfig); 17-state ServiceInvocation FSM; combinator stage classes (POOL/GATE/GENERATED/DERIVED/RUNTIME); token strata; Repo abstraction with sub-stores and CascadeEvent log; immutable lineage stamping. The 2500-line orchestrator is what should collapse to ~200 lines once these primitives ship.
- **Stripe Sessions 2026** (April 29-30, 2026; 288 launches). MPP (Machine Payments Protocol — IETF-track, multi-method); SPTs (Shared Payment Tokens); Issuing for Agents (single-use virtual cards with MCC/velocity/amount controls); new Treasury (15 currencies, 24/7); Streaming Payments (Metronome + Tempo); Link Agent Wallet; Privy non-custodial wallets; Connect Marketplace Wallets; Stripe Projects (delegated agent identities); Agent Guardrails. **Did not ship**: outcome-predicate / proof-of-result release (only escrow primitive); B2B SLA-shaped refund/credit (Smart Disputes are consumer-shape); agent-as-merchant identity model (must wire through Connect manually); provider-agnostic settlement abstraction. Those four are the gap-filler primitives `autonomous-finance` owns.
- **Existing ADRs**: ADR-0001 (`rdb-provider-adapter` is load-bearing); ADR-0002 (`function-registry` and `digital-objects-registry` stay separate); ADR-0003 (storage strategy: PG/CH default + DO SQLite + Pipelines→Iceberg + Vectorize for cascade workloads); ADR-0004 (durable execution: CF Workflows default, Vercel WDK alternate, in-process for tests).
- **Prior plans**: `2026-05-05-svo-co-design.md`; `2026-05-05-cascade-storage-execution-implementation.md`.

## Next

`services-as-software` re-imagining (separate doc). The skeleton is implied by this design — `Service.define()` takes `outputContract` + `binding` + `evaluators` + `oversight` + `pricing` + `reward` + `costModel`; `ServiceInvocation` FSM is a 17-ish-state durable workflow — but the full surface (intake validation, clarification policy, QualityReview routing, dispute machinery, channel adapters by audience) needs its own design pass.
