# Services-as-Software Design v2

**Status:** v2 — supersedes `2026-05-05-services-as-software-design.md`. Incorporates the four-critic review (DX, production-scale, domain-fidelity, adversarial-competitor) and user resolutions.
**Date:** 2026-05-05
**Worked example:** Claude Code wrapped as a Service (§3) anchors every interface decision.
**Companions:** `2026-05-05-business-as-code-stack-design.md`; `packages/autonomous-startups/README.md`; ADR-0003; ADR-0004.

## 1. What changed from v1

| Change | Why |
|---|---|
| Six UI shapes: required → **auto-derived** with opt-in overrides | All four critics agreed on overdesign; Vercel-style schema-driven defaults |
| Type carry-through: `Service<TIn, TOut>` via Standard Schema | DX + competitor + domain-fidelity all flagged `unknown` erasure |
| Function kinds typed as discriminated union: `CodeFunctionRef \| GenerativeFunctionRef \| AgenticFunctionRef \| HumanFunctionRef` | Domain-fidelity: book is emphatic about Four Functions enforcement |
| **`Service.invoke()` pinned** — typed call site with `InvocationHandle`, streaming events, clarification API | DX: "load-bearing missing API" |
| `Service.define()` shrunk to defensible core (~30% of v1 fields required) | Competitor deletion test: 70% was typed-bag re-bundling substrate |
| **Per-Function reward** — `RewardSignal` lives on each FunctionRef, not just on Service | Domain-fidelity: BaC is explicit; without it there's no hill for individual cascade steps to climb |
| **`AgentMode` + `TrackRecord`** added to Workers and Functions | Domain-fidelity: earned autonomy was structurally absent |
| `Service.generate(grid)` **moved to `startup-builder`** | User resolution: sb is the catalog producer; SaS is the abstraction |
| `MarketplaceListing` **kept**, populated by sb, consumed by SaS | User resolution: not skipped, divided |
| `OutcomeContract` separated from `OutputContract` | Domain-fidelity: book treats "definition of done" distinctly from "output schema" |
| 5KB target = **token budget**, not bytes-on-disk | User resolution: production critic's panic is moot |
| Locked stage class annotations (POOL/GATE/GENERATED/DERIVED/RUNTIME) on the cascade | Domain-fidelity: missing from v1 |

## 2. Three layers of the Services-as-Software stack

```
                api.services            ← managed runtime (hosted)
                    │
                    ▼ consumes
              services-as-software      ← THIS DOC: the abstraction
                    │                       (define / order / track / manage / pay / consume)
                    ▼ consumed by
                startup-builder         ← the catalog producer
                                            (Service.generate(grid) lives here;
                                             produces 1M MarketplaceListings)
```

`services-as-software` is the *primitive layer*. It does not produce Services itself; it provides the *typed contract* for what a Service IS and a *runtime* for invoking and delivering it. Catalog production (the (ICP × Context × ProblemSignature) outer-product mint at scale) is `startup-builder`'s job. Hosted operation is `api.services`.

## 3. Worked example: Claude Code as a Service

This is the falsifiable test case. If `Service.define()` can express this Service end-to-end, the design works. **It also is a real software-engineering Service representing $10T in current human labor spend** — proving the pattern generalizes.

### 3.1 The order

```ts
// Customer-side
const handle = await ClaudeCodeFeatureService.invoke({
  repoRef: 'github.com/acme/widget',
  featureBrief: 'Add CSV export to the dashboard with column selection',
  acceptanceCriteria: ['exports valid CSV', 'preserves selection state'],
})

for await (const event of handle.events) {
  // ORDERED → ONBOARDING → ACTIVE → DELIVERING → ... → DELIVERED
  console.log(event.state, event.payload)
}

const result = await handle.result
//   { prRef: 'github.com/acme/widget/pull/142',
//     mergedAt: '...', reviewerApprovals: { qa, arch, security, product } }
```

### 3.2 The cascade

```
ORDERED
   │  payment authorization captured
   ▼
ONBOARDING — GitHub OAuth, repo connect, brief clarifications
   │
   ▼
ACTIVE → DELIVERING — the cascade fires:

  ┌──────────────────────────────────────────────────────────────┐
  │  brainstorm (Generative)   — explore approaches              │ POOL
  │  plan       (Agentic)      — produce typed plan              │ GENERATED
  │  scope      (Agentic)      — emit beads issues               │ DERIVED
  │  dispatch   (Code)         — fan out wave of devs            │ GATE
  │  N × dev    (Agentic)      — produce PR per issue            │ GENERATED
  │                                                              │
  │  EvaluatorPanel (4 AgenticFunctions, each independent):      │
  │    QA reviewer       (rubric + tests)                        │ GATE
  │    arch reviewer     (design-doc fit + dep graph)            │ GATE
  │    security reviewer (sast + auth + secrets)                 │ GATE
  │    product reviewer  (acceptance criteria + UX)              │ GATE
  │                                                              │
  │  iterate until all 4 approve OR escalate                     │
  └──────────────────────────────────────────────────────────────┘
   │
   ▼
QUALITY_REVIEW → final EvaluatorPanel pass
   │
   ▼
DELIVERED → customer reviews PR
   │
   ▼
ACCEPTED  →  merge + charge   (or DISPUTED → ESCALATED → REFUNDED)
```

### 3.3 Field-by-field map to `Service.define()`

```ts
const ClaudeCodeFeatureService = Service.define({
  name: 'Claude Code Feature Build',
  promise: 'Ship a feature to your repo, reviewed by 4 specialists.',
  audience: 'business',
  archetype: 'multi-step-research',                     // open registry; defaults flow from this

  schema: {
    input:  z.object({ repoRef: z.string(), featureBrief: z.string(), acceptanceCriteria: z.array(z.string()) }),
    output: z.object({ prRef: z.string(), mergedAt: z.string(), reviewerApprovals: ReviewerApprovalsSchema }),
  },

  binding: {
    cascade: [
      Generative({ name: 'brainstorm', reward: kr_solutionDiversity }),
      Agentic   ({ name: 'plan',       reward: kr_planFidelity, mode: 'supervised' }),
      Agentic   ({ name: 'scope',      reward: kr_scopeAccuracy, mode: 'supervised' }),
      Code      ({ name: 'dispatch'                                             }),
      Agentic   ({ name: 'dev',        reward: kr_prMergedRate,  mode: 'supervised', concurrency: 'fan-out' }),
    ],
    toolPermissions: ['github.repos', 'github.pulls', 'github.actions'],
    clarificationPolicy: { enabled: true, maxRoundTrips: 3, escalateTo: 'engineer' },
  },

  evaluators: EvaluatorPanel.define({
    personas: [
      Agentic({ name: 'qa-reviewer',       persona: 'rigorous-QA',         signOff: 'must-approve' }),
      Agentic({ name: 'arch-reviewer',     persona: 'design-coherence',    signOff: 'must-approve' }),
      Agentic({ name: 'security-reviewer', persona: 'security-skeptic',    signOff: 'must-approve' }),
      Agentic({ name: 'product-reviewer',  persona: 'product-acceptance',  signOff: 'must-approve' }),
    ],
    iterationPolicy: { maxRounds: 5, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    predicate: AND(
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External    ({ verifier: 'github', spec: { ci: 'passing', merged: true } }),
    ),
    timeoutDays: 14,
  },

  pricing: Pricing.outcome({ tiers: [{ id: 'S', amount: 200_00n }, { id: 'M', amount: 800_00n }, { id: 'L', amount: 2400_00n }] }),
  refundContract: 'quality-floor-fail',                 // ref into autonomous-finance catalog
  authorityBoundary: 'self-only',                       // ref into autonomous-finance catalog
  costModel: { perInvocation: 800n, perDevAgentRound: 50n },
  reward: kr_customerSatisfaction,                      // ladders up to Profit (per company hill)

  // Lineage — only present when produced by startup-builder.Service.generate
  lineage: optional(),
})
```

Everything else (catalog hero copy, order-form layout, onboarding integrations chips, delivery progress UI, portal columns) **derives from this declaration**. Section 8 specifies the auto-derivation rules.

## 4. The `Service<TIn, TOut>` interface

```ts
// services-as-software/src/service.ts

export interface Service<TIn, TOut> {
  readonly $id: string
  readonly $type: 'Service'
  readonly name: string
  readonly promise: string
  readonly audience: Audience | Audience[]
  readonly archetype: ServiceArchetypeRef
  readonly schema: { input: Schema<TIn>; output: Schema<TOut> }      // Standard Schema
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
  readonly catalog?: CatalogShape                                     // override; default derived
  readonly order?: OrderShape                                          // override; default derived
  readonly onboarding?: OnboardingShape                                // override; default derived
  readonly delivery?: DeliveryShape                                    // override; default derived
  readonly portal?: PortalShape                                        // override; default derived

  // Methods
  invoke(input: TIn, opts?: InvokeOpts): InvocationHandle<TOut>
  verify(opts?: VerifyOpts): Promise<VerificationReport>
  publish(opts?: PublishOpts): Promise<MarketplaceListing>
  retire(reason?: string): Promise<void>
}

export const Service = {
  define<TIn, TOut>(spec: ServiceSpec<TIn, TOut>): Service<TIn, TOut>,
  fromFunction<TIn, TOut>(
    fn: (input: TIn) => Promise<TOut>,
    opts: { name: string; promise: string }
  ): Service<TIn, TOut>,                                                // migration adapter
  load<TIn = unknown, TOut = unknown>(ref: ServiceRef): Promise<Service<TIn, TOut>>,
}
```

### 4.1 Tier-0 minimum (the 1-line case)

Three required fields. Everything else inferred or defaulted from `archetype`.

```ts
const summarize = Service.define({
  name: 'Summarize',
  promise: 'One-paragraph summary of any text.',
  do: ($) => $`summarize: ${$.input.text}`,                            // sugar: defines schema + binding
})
```

`do:` is sugar for a single-Generative-Function binding with input/output schemas inferred from the template literal. `archetype` defaults to `'summarization'`. `audience` defaults to `'human'`. All UI shapes derive from `name + promise`. Service is mintable but `unpublishable` (no pricing/reward) until extended.

### 4.2 Tier-1 production (the typical case)

`schema`, `binding`, `evaluators`, `pricing`, `reward` are required. CX shapes derived. Service is publishable.

### 4.3 Tier-2 lineage-bearing (sb-cascade output)

Tier-1 plus `lineage` populated by construction (cellRef + ICPContextProblemRef + foundingHypothesisRef + studioThesisRef + cascadeRunId + versionVector). Reverse-queryable from any upstream entity.

## 5. `Service.invoke()` — the pinned call site

```ts
export interface InvocationHandle<TOut> {
  readonly id: string
  readonly state: InvocationState                                       // current state
  readonly events: AsyncIterable<InvocationEvent<TOut>>                 // streaming
  readonly result: Promise<TOut>                                        // resolves on ACCEPTED

  clarify(response: ClarificationResponse): Promise<void>
  cancel(reason?: string): Promise<void>
  dispute(reason: string): Promise<void>
}

// Discriminated event union — exhaustively typed
export type InvocationEvent<TOut> =
  | { kind: 'state-changed';      state: InvocationState; at: Date }
  | { kind: 'cascade-progress';   functionRef: string; pct: number }
  | { kind: 'cost-incurred';      cost: Money; functionRef?: string }
  | { kind: 'preview-available';  slot: string; payload: Partial<TOut> }
  | { kind: 'clarification-needed'; request: ClarificationRequest<TOut> }
  | { kind: 'evaluator-signoff';  reviewer: string; verdict: 'approve' | 'reject'; rationale: string }
  | { kind: 'delivered';          payload: TOut }
  | { kind: 'failed';             reason: 'timeout' | 'evaluator-blocked' | 'budget-exceeded' | 'external-failure'; detail: string }
```

`InvokeOpts` carries `worker` (the buyer Worker — Person/Agent/Role per commerce topology), `idempotencyKey`, `budget` (per-invocation cost ceiling), `priority`, `tenantRef`. The handle is the single seam for state observation, clarification, cancellation, dispute. Cleanly typed end-to-end via `TIn`/`TOut`.

## 6. Function kinds — typed union

`binding.cascade` is `FunctionRef[]` — a discriminated union, not opaque strings.

```ts
export type FunctionRef =
  | CodeFunctionRef
  | GenerativeFunctionRef
  | AgenticFunctionRef
  | HumanFunctionRef

export interface BaseFunctionRef {
  $id: string
  name: string
  kind: 'code' | 'generative' | 'agentic' | 'human'
  reward?: RewardSignal                                                 // PER-FUNCTION (not just per-Service)
  costModel?: CostModel
  oversight?: { mode: AgentMode; promotionPolicy?: PromotionPolicy }
  track?: TrackRecord                                                   // earned-autonomy state
}

export interface HumanFunctionRef extends BaseFunctionRef {
  kind: 'human'
  rationale: 'approval' | 'physical' | 'regulatory' | 'trust' | 'premium'  // book demands this
  expirationPolicy: { migrateTo?: AgenticFunctionRef; whenAccuracyExceeds?: number; whenSamplesExceed?: number }
}

// Sugar factories
export const Code      = (spec: Omit<CodeFunctionRef, '$id' | 'kind'>): CodeFunctionRef
export const Generative = (spec: Omit<GenerativeFunctionRef, '$id' | 'kind'>): GenerativeFunctionRef
export const Agentic    = (spec: Omit<AgenticFunctionRef, '$id' | 'kind'>): AgenticFunctionRef
export const Human      = (spec: Omit<HumanFunctionRef, '$id' | 'kind'>): HumanFunctionRef
```

This addresses domain-fidelity's two strongest violations: per-Function reward (the BaC objective-function pattern) and `rationale` on HumanFunctions (the book's "be precise about why each HumanFunction requires a human").

## 7. `EvaluatorPanel` — typed multi-persona

```ts
export interface EvaluatorPanel {
  $id: string
  personas: AgenticFunctionRef[]                                        // each independent
  signOffPolicy: 'all-approve' | 'majority' | 'weighted'
  iterationPolicy: { maxRounds: number; onMaxRoundsExceeded: 'escalate' | 'auto-fail' }
  // Each persona has its own track record → earned autonomy
}

export const EvaluatorPanel = {
  define(spec: EvaluatorPanelSpec): EvaluatorPanel,
}
```

Personas are Agentic (independent search/verify), per book ch.7:223 — not Generative (single-pass). Each persona has its own reward + track record.

## 8. Auto-derivation of UI shapes (zero of six required)

| Shape | Derived from | Override only when |
|---|---|---|
| `catalog` | `name`, `promise`, `audience`, `pricing.summary`, `archetype.heroTemplate` | Custom hero / social proof / comparison rows |
| `order` | `schema.input` + `pricing.tiers` + `audience` (which determines identity flow) | Multi-step guided flow / consultation-first / upsells |
| `onboarding` | `binding.toolPermissions` (OAuth chips per provider in `$.api`) + `audience` (KYC depth per audience) | Custom welcome flow / explicit prerequisites |
| `delivery` | `binding.cascade.length` (progress steps) + `oversight.touchpoints` (HITL labels) + archetype-default time estimates | Custom previews / branded progress UI |
| `portal` | `InvocationHistoryShape` default columns: `state`, `createdAt`, `cost`, `duration` | Custom columns / filtering |
| `integrations` | `binding.toolPermissions` × `$.api` registry metadata | (purely derived; not overridable) |

Sample default `OrderShape` for the Claude Code service: form auto-generated from `schema.input` (`repoRef: text-with-validation`, `featureBrief: textarea`, `acceptanceCriteria: list-of-strings`) + tier picker (S/M/L outcome pricing) + GitHub OAuth chip from `binding.toolPermissions.github.*` + audience='business' identity flow (org context required).

## 9. Earned autonomy

```ts
export type AgentMode = 'manual' | 'supervised' | 'autonomous'

export interface TrackRecord {
  accuracy: number                                                       // 0-1 over recent samples
  samples: number                                                        // sample count
  trend: 'improving' | 'stable' | 'degrading'
  lastUpdated: Date
  costPerSuccess: Money                                                  // earned-autonomy includes economics
  reviewerOverrideRate: number                                           // how often EvaluatorPanel rejects
  digitalScore: number                                                   // 0-1; BaC schema.org.ai property
}

export interface PromotionPolicy {
  promote: { fromMode: AgentMode; toMode: AgentMode; whenAccuracyExceeds: number; minSamples: number }[]
  demote:  { fromMode: AgentMode; toMode: AgentMode; whenAccuracyBelow: number; minSamples: number }[]
  evaluate: 'continuous' | 'daily' | 'weekly'
}
```

Mode + TrackRecord + PromotionPolicy live on every Worker AND every Function. Promotion/demotion runs as a `business-as-code` Process triggered by accumulating Actions. The runtime emits `AgentPromoted` / `AgentDemoted` Actions on transitions.

## 10. Two FSMs

### `ServiceLifecycle` (mint side)
`DRAFT → VERIFIED → PUBLISHED → RETIRED` (with `DISCARDED` from `VERIFIED` on Verify failure or operator abandon).

The synthetic-invocation gate (`Service.verify()`) runs the cascade against fixture input — for the Claude Code service, against a fixture repo with a fixture feature brief. Real work; not ceremony.

### `InvocationLifecycle` (deliver side)
11 customer-visible states (ORDERED → ONBOARDING → ACTIVE ↔ DELIVERING ↔ NEEDS_CLARIFICATION → QUALITY_REVIEW → DELIVERED → ACCEPTED | DISPUTED → ESCALATED_TO_HUMAN_REVIEW → REFUNDED | CLOSED). Persisted via CF Workflows per ADR-0004.

## 11. `OutcomeContract` — separated from `OutputContract`

```ts
export interface OutputContract<TIn, TOut> {                            // technical schema
  input: Schema<TIn>
  output: Schema<TOut>
  sensitivityTier: SensitivityTier
}

export interface OutcomeContract {                                      // definition-of-done
  predicate: ProofPredicate                                              // composable: AND, OR, EvaluatorPass, External, HumanSign, SchemaMatch
  timeoutDays: number
  onTimeout: 'auto-cancel' | 'auto-refund' | 'escalate'
}
```

Predicates compose (`AND(EvaluatorPass(panel), External({verifier: 'github', spec}))`). For the Claude Code service: PR merged AND CI passing AND all four reviewers approved.

## 12. Lineage — optional vs. required-by-construction

```ts
export interface ServiceLineage {
  cellRef: WorkContextCellRef                                            // sb-internal type
  icpContextProblemRef: ICPContextProblemRef                             // sb-internal type
  foundingHypothesisRef: FoundingHypothesisRef
  studioThesisRef?: StudioThesisRef
  cascadeRunId: string
  versionVector: VersionVector
}
```

`Service.define()` accepts `lineage` as optional. `startup-builder.Service.generate(grid)` populates it by construction. UI renders provenance when present, hides when absent.

## 13. Catalog read-path (carved out from the production critic)

Catalog UI cannot serve directly from DO SQLite at 1M Services. **Implied requirement, not in this doc's scope:**

- ClickHouse materialized view `services_catalog_mv` from Iceberg via Pipelines fan-out (per ADR-0003)
- `Service.collection(filter)` returns CH-backed cursor with denormalized columns
- Vectorize sidecar for embedding-based search over `name + promise + description`
- Reverse-index queries: "every Service for occupation X" via `lineage_cell_id` secondary index

Specified separately as **ADR-0005: Service catalog read-path = ClickHouse MV from Iceberg.** (TODO before any catalog UI ships.)

## 14. Open decisions (to grill or punt)

### Now resolved (from prior open list)
- ~~Mint-side FSM is ceremony~~ → **Kept.** `VERIFIED` state is real work because synthetic invocation runs the cascade.
- ~~`Service.invoke()` undefined~~ → **Pinned in §5.**
- ~~UI shapes required~~ → **Auto-derived in §8.**
- ~~Type erasure to unknown~~ → **`Service<TIn, TOut>` in §4.**
- ~~Function kinds opaque~~ → **Discriminated union in §6.**
- ~~Per-function reward missing~~ → **Lives on `BaseFunctionRef` in §6.**
- ~~Earned autonomy missing~~ → **`AgentMode` + `TrackRecord` in §9.**
- ~~Outcome conflated with output contract~~ → **Separated in §11.**
- ~~Storage budget show-stopper~~ → **Resolved: token budget, not bytes.**

### New, surfaced by critics
- **Re-verify policy** — when does a Service edit re-run synthetic invocation? Field-level diff rules required. → **ADR-0006**
- **Tenant isolation** — `tenantRef` on Service + `MarketplaceListing.visibility`. → **ADR-0007**
- **HITL workflow lifetime caps** — max NEEDS_CLARIFICATION dwell before auto-CANCELLED with refund. → **ADR-0008**
- **Cost-capture write strategy** — LedgerEntry append-only in transactional store; rollups in CH. → **ADR-0009**
- **Catalog read-path** — `Service.collection` over CH MV. → **ADR-0005**

### Carried, deferred
- **`ServiceInvocation` FSM — own (CF Workflows per ADR-0004) or wrap Vercel WDK?** Keep ADR-0004 default unless production blocks.
- **Versioning semantics** — `v1` and `v2` of the same `slug` coexist, or Publish replaces? Punt until first migration.
- **`Service.invoke()` ↔ `$.tasks.create({ tool })` overlap** — do they collapse? Likely yes; deferred.
- **Adversarial-competitor's strategic call: sell catalog vs. primitives** — both, plus managed (api.services). Already resolved in §2 but the polish-allocation question remains.

## 15. Implementation order (revised; smaller surface)

1. Land L0-L3 substrate from `2026-05-05-business-as-code-stack-design.md` (token strata, autonomous-finance core, Repo lift)
2. Promote Function-as-typed-primitive in `digital-tools` with the discriminated union (Code/Generative/Agentic/Human + per-Function reward + track + oversight)
3. Define `ServiceArchetype` registry + initial catalog
4. Define `Service<TIn, TOut>` types + `Service.define()` + `Service.fromFunction()` (migration adapter) + `Service.verify()`
5. Implement `Service.invoke()` + `InvocationHandle<TOut>` + the 11-state `InvocationLifecycle` FSM over `ai-workflows` durable runtime
6. Implement `EvaluatorPanel` + `OutcomeContract` + `ProofPredicate` composition
7. Implement `MarketplaceListing` + `RuntimeUnit` typed records + persistence
8. Implement six UI-shape derivation functions (default renderers in `digital-products` / `ai-props`)
9. ADR-0005..0009 land alongside their respective subsystems
10. Migrate `startup-builder/orchestrator.ts` to the primitives, stage by stage with feature flag — this is also where `Service.generate(grid)` lands (in sb, not in SaS)

## 16. Source material

- `/Users/nathanclevenger/projects/services-as-software/` — SaS book manuscript (Four Functions, layered independent verification, HITL with expiration, outcome pricing, moats above the model)
- `/Users/nathanclevenger/projects/business-as-code/` — BaC book manuscript (typed Goals/OKRs/KeyResults, experimentation machine, earned autonomy, code IS the business)
- `/Users/nathanclevenger/projects/business.org.ai/` — canonical Noun substrate (NAICS / O*NET / APQC PCF / NAPCS / UNSPSC / GS1 / BLS / ISO ingested as TSVs + MDXLD)
- `/Users/nathanclevenger/projects/startup-builder/` — production cascade orchestrator (`THESIS.md`, `ROADMAP.md`, `CASCADE.md`, `COMBINATORS.md`, `ENTITIES.md`, `ONTOLOGY.md`, `SERVICES.md`)
- Stripe Sessions 2026 (April 29-30, 2026) — MPP, SPTs, Issuing for Agents, Treasury, Streaming Payments, Connect Marketplace Wallets, Privy non-custodial wallets, Stripe Projects, Agent Guardrails
- Companion stack design: `docs/plans/2026-05-05-business-as-code-stack-design.md`
- Deferred meta-package: `packages/autonomous-startups/README.md`
- v1 strawman (superseded): `docs/plans/2026-05-05-services-as-software-design.md`
- Critic reports (four divergent reviewers, 2026-05-05): DX (`a3ee4064...`), production-scale (`a85d2cba...`), domain-fidelity (`a2faa2f4...`), adversarial-competitor (`a1108c8f...`)
