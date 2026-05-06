# Services-as-Software Design v3

**Status:** v3 — supersedes v2. Incorporates four HOW agents (DX, implementation, catalog, migration) + ecosystem context (`agents.do`, `api.services`, `platform.do`).
**Date:** 2026-05-05
**Worked example:** Claude Code wrapped as a Service (carried from v2).
**Companions:** `2026-05-05-business-as-code-stack-design.md`; `2026-05-05-services-as-software-design.md` (v1, superseded); `2026-05-05-services-as-software-design-v2.md` (v2, superseded); `packages/autonomous-startups/README.md`; `packages/autonomous-finance/README.md`; ADR-0003; ADR-0004.

## 1. What changed from v2

| Change | Source |
|---|---|
| **`triggers:` declarative routing** added to `binding` | Catalog HOW: 3 of 5 seed Services need it (`reconciliation_break > $100`, `confidence < 0.7`, `revenue > $100M`) |
| **`Pricing` factory variants:** `outcome` / `subscription` / `perInvocation` / `composite` | Catalog HOW: 5 Services need 4 different shapes |
| **Extended `ProofPredicate` union:** add `LoadBearingPass(set)` and `OverallFloor(N/total)` | Migration HOW: sb's killThreshold semantics need them |
| **Reusable persona library** in `ai-evaluate`: `pedantic-validator`, `skeptic`, `accuracy-reviewer`, `voice-and-style`, `coverage-pedant`, `domain-expert` | Catalog HOW: 6 archetypes cover ~80% of evaluator slots |
| **`mode: 'aggregate-single-call'`** on `EvaluatorPanel` | Migration HOW: 4-persona panel costs 4× LLM calls vs. today's single-call rubric; cost-aware shortcut |
| **Cascade-event re-emission hook** on `Service.verify()` | Migration HOW: sb's reconciliation predicates depend on verify-time events landing on the cascade-event log |
| **Three-tier ecosystem positioning:** OSS primitives + managed runtimes (`api.services`, `platform.do`) + catalogs (`agents.do`, `startup-builder`) | User context |
| **Service.fromFunction()** as named export at top level | DX HOW: critical for migration story |
| **`Service<TIn, TOut>` value-vs-type rename:** `ServiceInstance<TIn, TOut>` for the type, `Service` namespace for the value | Implementation HOW open question #3 |
| **`InvocationHandle.events` cancellation semantics locked:** abandoning iterator is subscription teardown only; workflow keeps running unless `handle.cancel()` is called | Implementation HOW open question #5 |
| **`autonomous-finance` package scaffolded** (substrate types ship there from day one, not in SaS) | Implementation HOW open question #1 |

## 2. The three-tier ecosystem

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
                 │  services-as-software (this doc)              │  L5
                 │  autonomous-finance, autonomous-{cs,rev,dx}  │  L5
                 │  digital-tools (Function-as-typed-primitive)  │  L4
                 │  ai-workflows, ai-database, autonomous-finance│  L3
                 │  ai-functions                                 │  L2
                 │  ai-providers, language-models, ai-experiments│  L1
                 │  digital-objects (SVO + token strata)        │  L0
                 └──────────────────────────────────────────────┘
```

**Implications for SaS design:** `services-as-software` is the OSS Service primitive. The managed runtime (`api.services`) is responsible for *hosting* invocations — so `Service.invoke()` must produce a result that runs equally well in-process (developer machine), on Cloudflare Workers (open-source self-host), or on `api.services` (managed). Same `Service<TIn, TOut>` value, three execution targets. Catalogs (`agents.do`, `startup-builder`) produce many Service definitions and ship them to one of the runtimes.

## 3. Locked decisions (carried from v2)

1. Service is the primitive. `Startup` deferred to `autonomous-startups`.
2. `Service.define()` drives the entire customer runtime UI.
3. `Service.generate({ grid })` is the higher-order primitive for combinator-driven mint — **lives in `startup-builder`**, not in `services-as-software`.
4. Bottoms-up consumption of `business.org.ai` via namespace ref strings.
5. Two SVO substrates may coexist short-term; bridge via `cascade-event` re-emission (see §11).
6. Refund / AuthorityBoundary types live in `autonomous-finance`. `services-as-software` references them.
7. `MarketplaceListing` and `RuntimeUnit` are first-class primitives in SaS (catalog UI renders MarketplaceListing).
8. Service has rich knobs (ServiceArchetype, DeliveryPattern, AuthorityBoundary, RefundContract, ListingBuyerRequirements, ToolPermissions, ClarificationPolicy).
9. Two FSMs: `ServiceLifecycle` (mint side) + `InvocationLifecycle` (deliver side).
10. Per-Function reward via discriminated `FunctionRef` union.
11. `AgentMode` + `TrackRecord` for earned autonomy on Workers AND Functions.
12. `OutputContract` (technical schema) separate from `OutcomeContract` (definition-of-done predicate).
13. Six UI shapes auto-derived; zero of six required for simplest Service.
14. Storage budget = token budget, not bytes.

## 4. Worked example: Claude Code as a Service

(Carried from v2 §3, unchanged. The cascade is `brainstorm (G) → plan (A) → scope (A) → dispatch (C) → dev × N (A)` with a 4-persona EvaluatorPanel of `qa / arch / security / product` reviewers; OutcomeContract is `AND(EvaluatorPass, External(github: ci+merged))`.)

## 5. The `Service<TIn, TOut>` interface — `ServiceInstance` (the type) vs `Service` (the namespace)

Renamed at the type level to disambiguate from the namespace value. Imports stay clean:

```ts
import { Service } from 'services-as-software'                    // namespace value
import type { ServiceInstance } from 'services-as-software'       // the type
```

Most consumers won't need the type alias — `const svc = Service.define({...})` infers `ServiceInstance<TIn, TOut>` automatically.

```ts
export interface ServiceInstance<TIn, TOut> {
  readonly $id: string
  readonly $type: 'Service'
  readonly name: string
  readonly promise: string
  readonly audience: Audience | Audience[]
  readonly archetype: ServiceArchetypeRef
  readonly schema: { input: Schema<TIn>; output: Schema<TOut> }
  readonly binding: ServiceBinding
  readonly evaluators?: EvaluatorPanel
  readonly outcomeContract?: OutcomeContract
  readonly pricing?: Pricing
  readonly refundContract?: RefundContractRef
  readonly authorityBoundary?: AuthorityBoundaryRef
  readonly costModel?: CostModel
  readonly reward?: RewardSignal
  readonly oversight?: OversightPolicy
  readonly lineage?: ServiceLineage
  readonly catalog?: CatalogShape           // override; default derived
  readonly order?: OrderShape               // override; default derived
  readonly onboarding?: OnboardingShape     // override; default derived
  readonly delivery?: DeliveryShape         // override; default derived
  readonly portal?: PortalShape             // override; default derived

  invoke(input: TIn, opts?: InvokeOpts): InvocationHandle<TOut>
  verify(opts?: VerifyOpts): Promise<VerificationReport>
  publish(opts?: PublishOpts): Promise<MarketplaceListing>
  retire(reason?: string): Promise<void>
}

export const Service = {
  define<TIn, TOut>(spec: ServiceSpec<TIn, TOut>): ServiceInstance<TIn, TOut>,
  fromFunction<TIn, TOut>(
    fn: (input: TIn) => Promise<TOut>,
    opts: { name: string; promise: string; schema?: { input?: Schema<TIn>; output?: Schema<TOut> } }
  ): ServiceInstance<TIn, TOut>,
  load<TIn = unknown, TOut = unknown>(ref: ServiceRef): Promise<ServiceInstance<TIn, TOut>>,
}
```

### Tier-0 (1-line / 5-line case)

```ts
import { $ } from 'business-as-code'

const summarize = $.services.define({
  name: 'Summarize',
  promise: 'One-paragraph summary of any text.',
  do: ($) => $`summarize: ${$.input.text}`,
})

const { result } = await summarize.invoke({ text: longArticle })
```

Three required fields. Schema/binding inferred from `do:` template literal walking `TemplateStringsArray`. Archetype defaults to `'summarization'`. Mintable but unpublishable (no pricing/reward) until extended.

### Tier-2 (full publishable)

(Per v2 §3.3, with the additions in §6–§9 below; complete worked example in v2.)

## 6. `binding.triggers` — declarative routing (NEW)

```ts
export interface ServiceBinding {
  cascade: FunctionRef[]
  toolPermissions: string[]
  clarificationPolicy: ClarificationPolicy
  triggers?: BindingTrigger[]
}

export interface BindingTrigger {
  when: string                           // expression evaluated against cascade-step output + invocation context
  action: 'route-to' | 'escalate' | 'auto-fail' | 'auto-accept'
  target?: string                        // FunctionRef name or HumanFunction name; required when action === 'route-to'
}
```

Evaluated after each cascade step; first matching trigger fires. Examples from the catalog:

```ts
// bookkeeper
triggers: [{ when: 'reconciliation_break.amount > 10000n',
             action: 'route-to', target: 'controller-sign-breaks' }]

// support-triage
triggers: [{ when: 'classify.confidence < 0.7',
             action: 'route-to', target: 'human-agent' }]

// lead-qualification
triggers: [{ when: 'enrichment.company.revenue > 100_000_000_00n',
             action: 'route-to', target: 'sdr-review' }]
```

The `when` expression is a typed predicate (compiled at `define()` time against the inferred output types of preceding cascade steps); `target` is type-checked against FunctionRef names in the cascade.

## 7. `Pricing` factory variants (UPDATED)

```ts
export const Pricing = {
  outcome(opts: { tiers: OutcomeTier[]; sla?: SLATarget }): Pricing,
  subscription(opts: {
    plan: { id: string; amount: bigint; currency: Currency; interval: 'day' | 'week' | 'month' | 'quarter' | 'year' }
    metered?: { event: string; amount: bigint }[]
    sla?: SLATarget
  }): Pricing,
  perInvocation(opts: { tiers: PerInvocationTier[] }): Pricing,
  composite(opts: { base: { id: string; amount: bigint; description?: string }; metered: { event: string; amount: bigint; description?: string }[] }): Pricing,
}

export interface OutcomeTier      { id: string; amount: bigint; currency?: Currency; description?: string }
export interface PerInvocationTier { id: string; amount: bigint; includedPerMonth?: number; overage?: bigint }
```

| Variant | Catalog example |
|---|---|
| `outcome` | Claude Code (S/M/L by feature complexity); lead-qualification (per qualified lead) |
| `subscription` | bookkeeper (monthly + per-tx metered + SLA `closeBy: 'day-5'`) |
| `perInvocation` | support-triage (1k/10k/100k tier) |
| `composite` | api-docs-writer (one-time per repo + metered per documented symbol) |

## 8. `ProofPredicate` extended union (UPDATED)

```ts
export type ProofPredicate =
  | { kind: 'schema-match';      schema: unknown }
  | { kind: 'evaluator-pass';    panelRef: ThingRef; minScore: number | 'all-approved' | 'majority' }
  | { kind: 'human-sign';        signerRoles: string[]; when?: string }
  | { kind: 'external';          verifier: WorkerRef | string; spec: unknown }
  | { kind: 'load-bearing-pass'; itemSet: string[] }                                      // NEW
  | { kind: 'overall-floor';     minPasses: number; outOfTotal: number }                  // NEW
  | { kind: 'and';               predicates: ProofPredicate[] }
  | { kind: 'or';                predicates: ProofPredicate[] }

export const SchemaMatch       = (schema: unknown): ProofPredicate => ({ kind: 'schema-match', schema })
export const EvaluatorPass     = (opts: { panelRef: ThingRef | 'self'; minScore: number | 'all-approved' | 'majority' }): ProofPredicate
export const HumanSign         = (opts: { signerRoles: string[]; when?: string }): ProofPredicate
export const External          = (opts: { verifier: WorkerRef | string; spec: unknown }): ProofPredicate
export const LoadBearingPass   = (itemSet: string[]): ProofPredicate                       // NEW
export const OverallFloor      = (opts: { minPasses: number; outOfTotal: number }): ProofPredicate  // NEW
export const AND               = (...predicates: ProofPredicate[]): ProofPredicate
export const OR                = (...predicates: ProofPredicate[]): ProofPredicate
```

`LoadBearingPass` + `OverallFloor` together encode sb's killThreshold semantics:

```ts
// Equivalent to sb's verdictPolicy='all-load-bearing-pass-and-overall-ge-X'
predicate: AND(
  LoadBearingPass(['C1', 'C5', 'C6']),
  OverallFloor({ minPasses: 7, outOfTotal: 9 }),
)
```

## 9. `EvaluatorPanel` — modes + reusable persona library (UPDATED)

> **Package placement DEFERRED.** Earlier drafts placed `EvaluatorPanel` + the persona library in `ai-evaluate`. That is wrong: `ai-evaluate` is the **JS sandbox-execution surface used by AI agents** (Cloudflare worker_loaders / Miniflare), not a multi-persona-reviewer primitive. Don't touch it. `EvaluatorPanel`'s home is open: candidates are `services-as-software` (tight coupling; lands inline) or a new dedicated package (e.g. `ai-reviewers` / `agent-panels`). Decide when SaS implementation begins.

```ts
export interface EvaluatorPanelSpec {
  personas: AgenticFunctionRef[]
  signOffPolicy: 'all-approve' | 'majority' | 'weighted'
  iterationPolicy: { maxRounds: number; onMaxRoundsExceeded: 'escalate' | 'auto-fail' }
  mode?: 'parallel-multi-call' | 'aggregate-single-call'         // NEW
}
```

- **`parallel-multi-call`** (default): each persona makes its own LLM call; runs in parallel; produces N independent verdicts.
- **`aggregate-single-call`** (cost-shortcut): all personas' rubrics merged into one structured-output prompt; one LLM call returns a multi-axis verdict. Used when migrating sb's Stage 9 single-call rubric (Migration HOW risk #2).

### Reusable persona library (whatever package we land it in)

Six factory functions cover ~80 % of seed catalog needs:

```ts
import { Personas } from '<TBD — not ai-evaluate>'

Personas.pedantic   ({ domain: 'gaap-validation', rubric: [...] })
Personas.skeptic    ({ domain: 'security', focus: ['secrets', 'sast', 'auth'] })
Personas.accuracy   ({ domain: 'fact-grounding', sources: [...] })
Personas.voice      ({ brandVoiceRef: 'ref-into-brand-guide' })
Personas.coverage   ({ minPercent: 0.95 })
Personas.domain     ({ expertRef: 'occupations.org.ai/SeniorAccountant' })  // pulls from business.org.ai
```

Custom personas remain first-class — `Agentic({ name, persona, signOff })` always works.

## 10. `Service.verify()` — cascade-event hook (UPDATED)

`verify()` runs the cascade against fixture input. By default the resulting events stay sandboxed in the `__verify__` tenant. For sb's reconciliation predicates and any consumer that needs verify-time events on the canonical cascade-event log:

```ts
await service.verify({
  fixtures: [...],
  emitToCascadeEventLog: true,                         // NEW; default false
  cascadeEventTags: ['verify', 'spike-001'],
})
```

When `emitToCascadeEventLog: true`, `verify()` emits the same `*Rendered` / `*Published` / `RuntimeUnitEmitted` events as a real publish, tagged so consumers can filter. The `VerificationReport` carries the emitted event refs.

## 11. ADR-0006 boilerplate (re-verify policy)

Per v2 §13, re-verify is required when fields affecting the cascade change. Concrete rule shipped with v3:

| Field changed | Re-verify required? |
|---|---|
| `binding.cascade` (any FunctionRef added/removed/reordered/kind-changed) | YES |
| `binding.toolPermissions` (any added) | YES |
| `outputContract.input.schema`, `outputContract.output.schema` | YES |
| `evaluators.personas` (any added/removed/changed signOff) | YES |
| `outcomeContract.predicate` (any change) | YES |
| `oversight.mode` for any cascade Function | YES |
| `pricing` | NO |
| `catalog`, `order`, `onboarding`, `delivery`, `portal` overrides | NO |
| `name`, `promise`, `description` | NO |
| `lineage` | NO |
| `tags`, `category` | NO |

`Service.publish()` reads the latest `VerificationReport` and computes a field-diff against the version that was verified. Stale → throws `VerifyRequired`. (Full ADR-0006 to follow.)

## 12. Catalog packages (UPDATED — split discovered during round 4)

**Original v3 design (subpath catalog at `autonomous-finance/services/*`) DOES NOT WORK** — Turborepo correctly rejects the cycle: catalog needs `services-as-software`, but `services-as-software` already depends on `autonomous-finance`'s substrate (`Money`/`Pricing`/`OutcomeContract`). Even peer-dep declarations don't break the graph cycle.

**Resolution: each catalog domain ships in its own L5 package.** Substrate (`autonomous-finance`) stays clean at L3 with no SaS dep.

```
packages/
  autonomous-startups/          (deferred meta-package; see README)
  autonomous-finance/           (substrate ONLY — Money / Cost / Card / Account / Ledger
                                / OutcomeContract / ProofPredicate / SLAPolicy / Pricing
                                / RefundContract / AuthorityBoundary / FinanceProvider)
  autonomous-finance-services/  (NEW — catalog: bookkeeper + controller / ap / ar / tax /
                                treasury / payroll)
  autonomous-customer-success/  (catalog: support-triage + future)
  autonomous-revenue/           (catalog: lead-qualification + future)
  autonomous-developer-experience/ (catalog: api-docs-writer + future)
```

Each catalog package depends on `services-as-software`, `autonomous-finance`, `digital-tools`, and Zod. The substrate package depends only on Zod.

Beads epics:
- `aip-n1b8` — autonomous-startups (deferred meta)
- `aip-dlmj` — autonomous-finance (P2; critical-path)
- `aip-qszv` — autonomous-customer-success (P3)
- `aip-f6pi` — autonomous-revenue (P3)
- `aip-viti` — autonomous-developer-experience (P3)

Convention for catalog Services: **module-evaluated TypeScript that yields a typed `ServiceInstance<TIn, TOut>` value, exported as a named binding.** Per Catalog HOW §I — preserves the type carry-through that's the central v2/v3 win.

```ts
// packages/autonomous-finance/services/bookkeeper.ts
export const bookkeeper: ServiceInstance<TxIngest, ClosedBooks> = Service.define({...})
```

Consumers `import { bookkeeper } from 'autonomous-finance/services/bookkeeper'` and get full type inference into `bookkeeper.invoke(input)`.

## 13. Five new ADRs (carried from v2; numbers locked)

- **ADR-0005:** Service catalog read-path = ClickHouse MV from Iceberg
- **ADR-0006:** Re-verify policy and Service revision lifecycle (boilerplate in §11 above)
- **ADR-0007:** Tenant scoping for Services and Invocations
- **ADR-0008:** HITL workflow lifetime caps and refund-on-timeout
- **ADR-0009:** Cost-capture write strategy and rollup model

## 14. Open decisions

### Resolved by HOW agents (struck from v2)
- ~~Mint-side FSM is ceremony~~ → kept (synthetic invocation is real work)
- ~~`Service.invoke()` undefined~~ → pinned in v2 §5
- ~~UI shapes required~~ → auto-derived
- ~~Type erasure to unknown~~ → `ServiceInstance<TIn, TOut>` via Standard Schema
- ~~Function kinds opaque~~ → discriminated union
- ~~Per-function reward missing~~ → `BaseFunctionRef`
- ~~Earned autonomy missing~~ → `AgentMode` + `TrackRecord`
- ~~Outcome conflated with output contract~~ → separated
- ~~Storage budget show-stopper~~ → tokens, not bytes
- ~~`triggers` location~~ → on `binding`
- ~~`Pricing` only `outcome` variant~~ → 4 factory variants
- ~~Custom predicates for sb's killThreshold~~ → `LoadBearingPass` + `OverallFloor`
- ~~`EvaluatorPanel` cost balloon~~ → `mode: 'aggregate-single-call'` shortcut
- ~~`Service.verify()` cascade-event hook~~ → `emitToCascadeEventLog` opt-in flag

### New, surfaced by HOW agents
- **`Human.expirationPolicy.whenAccuracyExceeds` measurement source** — the human's accuracy, or the cascade-without-the-human's? Bookkeeper needs the latter ("could AI have decided this correctly?"). Spec before shipping `autonomous-finance/services/bookkeeper`.
- **`processRef` reconciliation** — five seed Services use plausible namespace refs (`processes.org.ai/FinancialStatementReview`, etc.) but need verification against actual `business.org.ai/.data/Processes.tsv` before catalog packages ship.
- **17-state ServiceInvocation FSM (sb) ↔ 11-state InvocationLifecycle (v3) mapping table** — `IntakeStarted`/`IntakeComplete` collapse into v3 `ONBOARDING`; `PartialCredit` has no v3 equivalent. Resolve before Migration Stage 35 cleanup.
- **`MinimumSellableStartup` shape** — sb's bundle wraps SaS Service + Brand + RuntimeUnit + MarketMemoryEvents + LegalSubject + Offer. Reframe as a sb-internal "kit" wrapping a SaS `ServiceInstance` + `MarketplaceListing` + sb-extras.
- **`OfferToken` location** — sb emits separately for api-services pricing-page handler. Does `Service.define({ pricing })` persist enough that pricing-page render works without a separate event?
- **OAuth chip flow at first invoke** — when `binding.toolPermissions: ['github.repos']` and the developer has never connected GitHub, throw `MissingPermissionError` with copy-pasteable URL (v3) → device-code flow inline (v4).
- **Cost surfacing in autocomplete** — hover on `service.invoke` should show projected cost from `costModel` + cascade length. LSP-side computation; high-value but non-trivial.

### Carried, deferred
- `ServiceInvocation` FSM — own (CF Workflows per ADR-0004) or wrap Vercel WDK? Keep ADR-0004 default unless production blocks.
- Versioning semantics — `v1` and `v2` of the same `slug` coexist, or Publish replaces? Punt until first migration.
- `Service.invoke()` ↔ `$.tasks.create({ tool })` overlap — likely collapse; deferred.

## 15. Implementation order (revised)

1. **L0 token strata** in `digital-objects` (~300 lines)
2. **`autonomous-finance` package real implementation** (substrate types only — Money/Cost/Budget/Card/Account/LedgerEntry + Pricing factory variants + ProofPredicate extended union + RefundContract/AuthorityBoundary catalogs) (~1500 lines initial; adapters land later)
3. **L4 Function-as-typed-primitive** in `digital-tools` (~500 lines) — discriminated union with `Code/Generative/Agentic/Human` factories + per-Function reward/cost/oversight/track
4. **`ai-evaluate` EvaluatorPanel + reusable persona library** (~800 lines) — Personas.pedantic / .skeptic / .accuracy / .voice / .coverage / .domain factories; `mode: 'aggregate-single-call'` shortcut
5. **`services-as-software` v3 core** (~3500 lines, ~38 files per Implementation HOW) — `Service.define` / `Service.invoke` / `Service.verify` / `Service.publish` + auto-derivation + `Service.fromFunction` migration adapter + `triggers` evaluation
6. **`MarketplaceListing` + `RuntimeUnit` typed records + persistence** (lands inside step 5)
7. **Five seed catalog Services** — Claude Code in `autonomous-startups/services/`; bookkeeper in `autonomous-finance/services/`; the three new packages stubbed for the other three
8. **`startup-builder` migration** behind feature flags, cluster-by-cluster, with parity tests — final ~2,545 line deletion (per Migration HOW)
9. **Five ADRs (0005–0009) land alongside their respective subsystems**

## 16. Source material

- `/Users/nathanclevenger/projects/services-as-software/` — SaS book manuscript
- `/Users/nathanclevenger/projects/business-as-code/` — BaC book manuscript
- `/Users/nathanclevenger/projects/business.org.ai/` — canonical Noun substrate (NAICS / O*NET / APQC PCF / NAPCS / UNSPSC / GS1 / BLS / ISO)
- `/Users/nathanclevenger/projects/startup-builder/` — production cascade orchestrator + 1M-startup thesis
- `/Users/nathanclevenger/projects/workers/domains/do.tsv` — `agents.do` catalog, ~318 named agents (downstream consumer; out of primitive scope)
- Stripe Sessions 2026 (April 29-30, 2026) — MPP, SPTs, Issuing for Agents, Treasury, Streaming Payments, Connect Marketplace Wallets, Privy non-custodial wallets, Stripe Projects, Agent Guardrails
- Companion stack design: `docs/plans/2026-05-05-business-as-code-stack-design.md`
- Deferred meta-package: `packages/autonomous-startups/README.md` (epic `aip-n1b8`)
- Scaffolded packages: `packages/autonomous-finance/`, `packages/autonomous-customer-success/`, `packages/autonomous-revenue/`, `packages/autonomous-developer-experience/`
- v1 strawman (superseded): `docs/plans/2026-05-05-services-as-software-design.md`
- v2 design (superseded): `docs/plans/2026-05-05-services-as-software-design-v2.md`
- Four-critic adversarial review (v2 → v3 redline drivers): DX (`a3ee4064...`), production-scale (`a85d2cba...`), domain-fidelity (`a2faa2f4...`), adversarial-competitor (`a1108c8f...`)
- Four HOW agent reports (v2 → v3 implementation drivers): implementation (`afa1900f...`), DX (`a5610eab...`), catalog (`afa91b8b...`), migration (`a6199e52...`)
