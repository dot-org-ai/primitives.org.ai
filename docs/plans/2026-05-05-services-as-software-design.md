# Services-as-Software Design

**Status:** strawman draft — open to redline; pressure-tested by four divergent critics
**Date:** 2026-05-05
**Related:** `docs/plans/2026-05-05-business-as-code-stack-design.md`; ADR-0003; ADR-0004; `packages/autonomous-startups/README.md`

## Context

`services-as-software` is the first business-model primitive in the broader `autonomous-startups` future (which is deferred — see `packages/autonomous-startups/README.md`). It's the critical path for `/Users/nathanclevenger/projects/startup-builder/`'s thesis: **1,000,000 RuntimeUnits emitted by 2026-05-14, each at ~$0.15 LLM compute and ~5KB token storage**, generated bottoms-up from the (ICP × Context × ProblemSignature) outer product over `business.org.ai`'s published Noun substrate (Industries / Occupations / Tasks / Processes / Services / Tools / Tech as TSVs + MDXLD).

The Service primitive must support:

1. **Bottoms-up mint** — produced by `Service.generate({ cells, theses, budget })` running the combinator + cascade + synthetic-invocation gate end-to-end, populating lineage refs back to business.org.ai entities by construction
2. **Hand-authored mint** — produced by `Service.define({...})` directly, lineage optional
3. **The full customer runtime UI** — six derivable surfaces (catalog / order / onboard / deliver / portal / integrations) renderable from the Service value with no further input
4. **Outcome-priced delivery** — durable FSM with HITL gates, EvaluatorPanel reviews, and SLA-tied refund/dispute machinery
5. **Lineage-bearing provenance** — every Service queryable by its originating cell, ICPContextProblem, FoundingHypothesis, StudioThesis

This document is a **strawman**. Five strawman decisions are flagged in §3 — expect them to be redlined.

## Locked decisions (from prior conversation)

1. **Service is the primitive.** `Startup` is deferred to `autonomous-startups`.
2. **Service.define() drives the entire customer runtime UI.** No screen rendered by reaching past the Service value. The interface IS the test surface.
3. **`Service.generate({ grid })` is the higher-order primitive** that runs the (ICP × Context × ProblemSignature) combinator → cascade → synthetic-invocation gate, returning an `AsyncIterable<ServiceMintResult | SkipResult>`. Cost discipline + quality gates are first-class.
4. **Bottoms-up consumption of business.org.ai** via namespace ref strings (`occupations.org.ai/...`, `processes.org.ai/...`, `tasks.org.ai/<verb.Object.prep.PrepObject>`). The L0 substrate doesn't *invent* Nouns — it *resolves* them.
5. **Two SVO substrates may coexist short-term.** business.org.ai's `Actions.tsv` as published Verb taxonomy; sb's `MarketMemoryEvent` as runtime Action log. Bridge now, collapse later.
6. **Refund / AuthorityBoundary types live in `autonomous-finance`.** `services-as-software` references them, doesn't redeclare them.
7. **`MarketplaceListing` and `RuntimeUnit` are first-class primitives** in `services-as-software`. They're customer-facing state (catalog UI renders MarketplaceListing; integrations + version pinning reference RuntimeUnit).
8. **Service has more knobs than initially drafted.** ServiceArchetype, DeliveryPattern, AuthorityBoundary, AccountabilitySurface, AttestationPath, RefundContract, ListingBuyerRequirements, ToolPermissions, ClarificationPolicy are all load-bearing typed structures.

## Strawman decisions (open to redline)

These are educated guesses on the open grilling questions A–E from the prior turn. Critics: this is your target.

### S1. Two FSMs, not one
- **`ServiceLifecycle` (mint side):** `DRAFT → VERIFIED → PUBLISHED → RETIRED`. Internal to operators; not customer-visible.
- **`InvocationLifecycle` (deliver side):** customer-visible 11-state FSM (full enumeration in §6). Each Service can have many concurrent Invocations.

Rationale: mint is "can this Service be sold?" — published once, retired once. Invocation is "is this customer's order being delivered?" — many per Service. Conflating them leads to either mint having too many customer-facing states or invocation having to know about marketplace publication.

### S2. Archetype catalog as open registry, defaults shipped in `services-as-software/archetypes/*`
Each archetype is a typed value:

```ts
defineServiceArchetype({
  id: 'document-extraction',
  label: 'Document Extraction',
  defaultDeliveryPattern: 'sync-completion',
  inputShape: { schema: ..., uiHints: ... },     // drives order-form rendering
  outputShape: { schema: ..., uiHints: ... },    // drives delivery preview
  defaultOversight: 'supervised',
  defaultEvaluators: ['schema-conformance', 'factual-grounding'],
  estimatedCost: { perInvocation: 0.15n, perTransaction: 0.01n },
})
```

Initial catalog (mirrors sb's): `cold-outbound`, `data-enrichment`, `document-extraction`, `multi-step-research`, `rag-with-clarification`, `transactional-workflow`, `content-generation`, `quality-review`, `triage`, `summarization`. sb registers additional archetypes via `defineServiceArchetype(...)` at module load.

### S3. Lineage as optional field
`Service.define({ ..., lineage?: ServiceLineage })`. `Service.generate({ grid })` always populates `lineage` by construction. UI renders provenance when present, hides when absent. Single Service type with optional lineage; no `AuthoredService` vs. `GeneratedService` split.

### S4. Integrations declaration as canonical strings, runtime-resolved against `$.api`
Define-time:
```ts
onboarding: {
  integrations: [
    { provider: 'salesforce', scopes: ['contacts.read', 'opportunities.read'] },
    { provider: 'quickbooks', scopes: ['accounting.read'] },
  ],
}
```
Runtime: `service.invoke()` resolves `'salesforce'` → `$.api.salesforce`. Define-time strings are typed against the union of registered providers (template literal types over the `$.api` registry). Loose-string fallback for unregistered providers.

### S5. CX shapes inside `services-as-software`
All six UI-surface contracts (`catalog`, `order`, `onboard`, `delivery`, `portal`, `integrations`) live as types inside `services-as-software`. No fragmentation across `digital-products` or a new package — yet. If duplication appears with future business-model primitives (SaaSProduct, APIProduct), extract to `digital-products` later.

## The Service primitive

### Top-level interface

```ts
// services-as-software/src/service.ts

export const Service = {
  /** Hand-author a Service. Lineage optional. */
  define(spec: ServiceSpec): Service,

  /** Cascade-generate Services across an (ICP × Context × ProblemSignature) grid. */
  generate(opts: GenerateOpts): AsyncIterable<ServiceMintResult | SkipResult>,

  /** Resolve from a published MarketplaceListing. */
  load(ref: ServiceRef): Promise<Service>,
}
```

### `ServiceSpec`

```ts
export interface ServiceSpec {
  // ── Identity / discoverability ──
  name: string
  slug?: string                          // auto-derived from name if omitted
  promise: string                        // 1-line tagline; what the customer gets
  description: string                    // 1-paragraph long-form
  category: string
  tags?: string[]
  audience: Audience                     // 'human' | 'business' | 'agent' | Audience[]
  archetype: ServiceArchetypeRef         // open registry; required
  deliveryPattern?: DeliveryPattern      // defaults from archetype

  // ── Mint contract (delivery side) ──
  outputContract: OutputContract
  binding: ServiceBinding                // cascade of Functions + engine + tool perms
  evaluators: EvaluatorPanel             // multi-persona reviewers (ai-evaluate)
  oversight: OversightPolicy             // HITL with migration thresholds (business-as-code)

  // ── Commercial / financial ──
  pricing: Pricing                       // Plans + Entitlements + tier-comparison shape
  refundContract: RefundContractRef      // 7-pattern catalog (autonomous-finance)
  authorityBoundary: AuthorityBoundaryRef // 12-tag catalog (autonomous-finance)
  reward: RewardSignal                   // → KeyResult ladder to Profit/Growth (business-as-code)
  costModel: CostModel                   // declared cost shape (autonomous-finance)

  // ── Customer-facing UI shapes (required; UI must derive from these) ──
  catalog: CatalogShape                  // §5
  order: OrderShape                      // §5
  onboarding: OnboardingShape            // §5
  delivery: DeliveryShape                // §5
  portal: PortalShape                    // §5
  // integrations is part of `onboarding`

  // ── Lineage (optional; populated by Service.generate by construction) ──
  lineage?: ServiceLineage
}
```

### `OutputContract`

```ts
export interface OutputContract {
  input: SchemaWithUI                    // JSON-Schema + UI hints
  output: SchemaWithUI                   // JSON-Schema + UI hints
  sensitivityTier: 'public' | 'internal' | 'identified' | 'PII' | 'regulated'
}

export interface SchemaWithUI {
  schema: unknown                         // JSON Schema (or Zod-derived)
  uiHints: Record<string, FieldUIHint>    // per-field rendering guidance
  examples?: unknown[]
}

export interface FieldUIHint {
  control?: 'text' | 'textarea' | 'select' | 'file-upload' | 'date' | 'currency' | 'json-editor' | string
  label?: string
  placeholder?: string
  helpText?: string
  multiline?: boolean
  // ... extensibility by registry
}
```

### `ServiceBinding`

```ts
export interface ServiceBinding {
  cascade: FunctionRef[]                 // ordered Function chain (Code/Generative/Agentic/Human)
  engineRef?: EngineRef                  // sb-style engine selection
  toolPermissions: ToolPermission[]      // which Tools the cascade can invoke
  clarificationPolicy: ClarificationPolicy
}

export interface ClarificationPolicy {
  enabled: boolean
  maxRoundTrips: number                   // before auto-escalate
  escalateTo: WorkerRef
  triggers: ('schema-validation-fail' | 'evaluator-uncertainty' | 'binding-explicit')[]
}
```

### `ServiceLineage`

```ts
export interface ServiceLineage {
  cellRef: WorkContextCellRef            // Actor + Work + minimumContext
  icpContextProblemRef: ICPContextProblemRef  // ICP × Context × ProblemSignature
  foundingHypothesisRef: FoundingHypothesisRef
  studioThesisRef?: StudioThesisRef      // optional — strategic posture
  cascadeRunId: string                   // for replay / audit
  versionVector: VersionVector           // ontology + generation + engine pins
}

export interface WorkContextCellRef {
  id: string                              // e.g. 'work-contexts.org.ai/accountants-and-auditors-financial-statement-review'
  actor: { ref: string }                  // 'occupations.org.ai/accountants-and-auditors'
  work: { ref: string }                   // 'processes.org.ai/financial-statement-review' OR 'tasks.org.ai/<v.O.p.PO>'
  minimumContext: string[]                // ['industries.org.ai/professional-scientific-and-technical-services', 'document/pdf']
}
```

`WorkContextCell` itself stays sb-internal for now (per L0-L3-L6 doc); SaS only references it.

## ServiceLifecycle FSM (mint side)

```
            DRAFT
              │
              │  Service.define(...)  /  Service.generate(...)
              ▼
            DRAFT
              │
              │  Service.verify()    [synthetic invocation gate; mandatory]
              ▼
        ┌─ VERIFIED ──────────┐
        │                      │
        │  Service.publish()   │  Service.discard()
        ▼                      ▼
   PUBLISHED                DISCARDED
        │
        │  Service.retire()
        ▼
    RETIRED
```

**Invariants:**
- A Service in `DRAFT` cannot be invoked
- A Service in `VERIFIED` cannot be invoked by external customers (internal invocation only)
- A Service in `PUBLISHED` is in the marketplace catalog and is invokable
- A Service in `RETIRED` cannot be newly invoked but can complete in-flight invocations

The synthetic invocation gate (sb's Stage 35) enforces "invocation-ready or it does not count" before Verify→Publish. EvaluatorPanel pre-runs against synthetic input; passing produces a `VerificationReport` attached to the Service record.

## InvocationLifecycle FSM (deliver side)

11 customer-visible states. Each Service has many concurrent Invocations.

```
        ORDERED
            │  customer placed order; payment authorization captured
            ▼
        ONBOARDING                        ──► CANCELLED  (if onboarding never completes)
            │  integrations + verifications + prerequisites
            ▼
         ACTIVE                           ──► CANCELLED  (if subscription churns)
            │  one or more invocations may fire
            │
            │  invocation triggered
            ▼
       DELIVERING ◄─────► NEEDS_CLARIFICATION  (waiting on customer)
            │
            ▼
      QUALITY_REVIEW                       (EvaluatorPanel + HITL gates)
            │
            ▼
        DELIVERED  ──► ACCEPTED  (customer accepts; charge captured if pending)
            │
            └──► DISPUTED  ──► ESCALATED_TO_HUMAN_REVIEW  ──► REFUNDED | CLOSED
```

Each transition is a typed `Action` in the SVO log. Persistence: durable workflow per ADR-0004 (CF Workflows default; Vercel WDK alternate; in-process for tests).

## The six UI surfaces — derivable from Service.define()

### 5.1 `catalog` (browse)

```ts
export interface CatalogShape {
  hero?: { headline?: string; subheadline?: string; visual?: string }
  pricingSummary: 'starting-at' | 'per-call' | 'tier-comparison' | 'contact-us'
  socialProofSlots?: ('testimonials' | 'logos' | 'badges' | 'metrics')[]
  archetypePreviewMode?: 'before-after' | 'live-demo' | 'video' | 'none'
  comparisonRows?: { label: string; values: Record<string, string | boolean> }[]
}
```

The catalog page derives **everything else** from the Service's top-level fields (`name`, `promise`, `description`, `category`, `tags`, `audience`, `pricing` summary).

### 5.2 `order` (buy)

```ts
export interface OrderShape {
  flow: 'instant' | 'guided' | 'consultation-first'
  steps?: OrderStep[]                      // for 'guided'; auto-derived from inputContract if omitted
  upsells?: ServiceRef[]
  legal: { tosRef: string; jurisdictionNotices: string[] }
}

export interface OrderStep {
  title: string
  fields: string[]                         // input field names from outputContract
  helpText?: string
}
```

Order form derives from `outputContract.input` + `pricing` + `audience` (which determines identity/payment flow per the commerce topology).

### 5.3 `onboarding` (set up)

```ts
export interface OnboardingShape {
  integrations: IntegrationRequirement[]
  verifications: VerificationRequirement[]
  prerequisites: PrerequisiteRequirement[]
  welcomeFlow?: WelcomeStep[]
}

export interface IntegrationRequirement {
  provider: string                         // 'salesforce' | 'quickbooks' | string (typed against $.api registry)
  scopes: string[]
  required: boolean
}

export interface VerificationRequirement {
  kind: 'kyc-light' | 'kyc-full' | 'business-verification' | 'tax-form' | 'custom'
  spec?: unknown
}

export interface PrerequisiteRequirement {
  description: string
  check: (ctx: { worker: WorkerRef }) => Promise<boolean>
  resolve?: (ctx: { worker: WorkerRef }) => Promise<void>
}
```

### 5.4 `delivery` (in-flight)

```ts
export interface DeliveryShape {
  estimatedTime: { min: Duration; max: Duration }
  progressIndicators: ProgressIndicator[]
  previewSlots?: PreviewSlot[]
  hitlTouchpoints: HITLTouchpoint[]
}

export interface ProgressIndicator {
  fromState: InvocationState
  label: string                            // human-readable
  estimatedRemaining?: Duration
}

export interface PreviewSlot {
  whenStateReached: InvocationState
  rendererRef: string                      // points at a renderer registered in digital-products / ai-props
}

export interface HITLTouchpoint {
  fromState: 'NEEDS_CLARIFICATION' | 'QUALITY_REVIEW' | 'ESCALATED_TO_HUMAN_REVIEW'
  channel: 'web' | 'email' | 'slack' | 'sms'
  timeoutBehavior: 'auto-proceed' | 'auto-escalate' | 'auto-cancel'
  timeoutAfter: Duration
}
```

### 5.5 `portal` (manage)

```ts
export interface PortalShape {
  subscriptionView?: { columns: string[] }
  invocationHistoryColumns: string[]
  filterableBy: ('state' | 'date' | 'cost' | 'duration')[]
  receiptsEnabled: boolean
  disputeFlow: { enabled: boolean; openableFromStates: InvocationState[] }
}
```

### 5.6 Integrations connection panel

Derived directly from `OnboardingShape.integrations` + the runtime `$.api` registry's provider metadata (OAuth URLs, scope descriptions, connection-health probes).

## `Service.generate({ grid })` — higher-order primitive

```ts
export interface GenerateOpts {
  cells: WorkContextCellRef[]              // from sb's catalog or hand-built
  theses: StudioThesisRef[]
  budget: GenerateBudget                   // cost ceiling + max units + max time
  gates?: GenerateGates                    // override defaults (Click rubric ≥7/9, etc.)
  archetype?: ServiceArchetypeRef          // optional restriction
}

export interface GenerateBudget {
  maxCostUSD: bigint                       // hard ceiling on aggregate LLM spend
  maxUnits: number                         // max Services to mint
  maxDurationMinutes?: number
}

export interface GenerateGates {
  clickRubricMin?: number                  // default 7/9
  messageChangeAblationMin?: number        // default 0.85
  icpDistinctnessMin?: number              // default 0.85
  syntheticInvocationRequired?: boolean    // default true
  perStartupMaxBytes?: number              // default 6144
  perStartupMaxCostUSD?: bigint            // default $0.18
}

export type ServiceMintResult = {
  kind: 'minted'
  service: Service
  cost: Money
  durationMs: number
  versionVector: VersionVector
}

export type SkipResult = {
  kind: 'skipped'
  reason: 'duplicate-causal-signature' | 'gate-failed-rubric' | 'gate-failed-distinctness' | 'budget-exhausted' | string
  candidate: ICPContextProblemRef
  cost: Money                              // cost incurred even on skip
}
```

Internally calls:
1. `combinators.generate({ cells, theses })` — recursive enumerator producing `ICPContextProblem[]`
2. Per survivor: cascade run via `ai-workflows` (Stages 0–9 + 10–17 + 25/27/28/33/35/37 collapsed onto primitives)
3. Synthetic invocation gate
4. `Service.define(...)` with full lineage populated
5. `LedgerEntry` writes via `autonomous-finance` for cost capture

## How sb's cascade collapses

The startup-builder orchestrator today is ~2500 lines (`packages/startup-builder/src/cascade/orchestrator.ts`). Mapping each stage to its primitive home:

| sb stage | Today | After primitives |
|---|---|---|
| 0 — pick StudioThesis | inline | `business-as-code`'s Goal/Reward selection |
| 1 — hydrate WorkContextCell | inline | `digital-objects` Thing.get |
| 2–8 — prose tokens, beachhead, competitors, differentiation, pricing | inline LLM calls | `ai-functions.generate` with `function-registry` Function definitions |
| 9 — Click rubric ≥7/9 commit gate | inline LLM critic | `ai-evaluate.EvaluatorPanel` registered as gate |
| 10–17 — naming pipeline | sb-internal subpackage | stays in sb (catalog-specific) |
| 25 — derive ServiceListing tuple | sb-internal pure function | `services-as-software` `Service.define()` body |
| 27 — bind W6 operations | sb-internal | `digital-tools.Tool` binding |
| 28 — emit evidence scaffold | sb-internal | `services-as-software` `EvaluatorPanel` configuration |
| 33 — emit MarketplaceListing | sb-internal | `services-as-software` `MarketplaceListing` write |
| 35 — synthetic invocation gate | sb-internal | `Service.verify()` step in `ServiceLifecycle` FSM |
| 37 — RuntimeUnit emission | sb-internal | `services-as-software` `RuntimeUnit` (typed publishable record) |
| 36/41/42 — studio allocator + market memory | sb's `@sb/studio` | stays in sb (portfolio-management concern) |

Net: sb's `orchestrator.ts` shrinks to ~150–250 lines: an outer combinator loop, per-iteration `Service.generate(grid)` call (which itself calls into the primitives), and the studio allocator continues to consume CascadeEvents from the SVO substrate. The 14-family `DiscoveryLensFamily` registry, ~12-entry `WorkShapingMechanism` registry, and 10–17 naming pipeline stay sb-owned because they encode catalog-specific knowledge.

## Bottoms-up business.org.ai consumption

A Service references business.org.ai entities by namespace ref strings:

```ts
const bookkeeperService = Service.define({
  name: 'FeeReceipt',
  promise: 'Reconcile your marketplace fee waterfalls weekly, GAAP-grade.',
  archetype: 'document-extraction',
  audience: 'business',
  // ...
  lineage: {
    cellRef: {
      id: 'work-contexts.org.ai/accountants-and-auditors-financial-statement-review',
      actor: { ref: 'occupations.org.ai/accountants-and-auditors' },        // O*NET 13-2011.00
      work: { ref: 'processes.org.ai/financial-statement-review' },         // APQC PCF leaf
      minimumContext: [
        'industries.org.ai/professional-scientific-and-technical-services',  // NAICS
        'document/pdf',
      ],
    },
    icpContextProblemRef: 'icp-context-problem:0xabc...',
    foundingHypothesisRef: 'fh:cellSlug:thesisSlug:v1',
    studioThesisRef: 'T-AIS-LOW-TECH',
    cascadeRunId: 'run:2026-05-05T12:00Z',
    versionVector: { ontology: '...', engine: '...', generation: '...', fh: 'v1' },
  },
})
```

The runtime resolves `occupations.org.ai/accountants-and-auditors` against the canonical business.org.ai store. Reverse queries are supported: "show me every Service for occupation X" / "show me every Service derived from cell Y."

## Open decisions (will be redlined by critics)

- **Catalog row count vs. Service granularity.** If 1M Services are minted, the catalog UI cannot render all of them. Implicit assumption: the customer enters with intent (search / NL query / drill-down by ICP) and the catalog renders a slice. Is that assumption sound, or do we need a `Service.collection(...)` primitive for grouping at presentation time?
- **`Service.verify()` cost.** Synthetic invocation runs the entire cascade once with synthetic input — that's not free. If gate fails, the Service is `DISCARDED` and the cost is borne by the operator. Is that acceptable, or do we need a cheaper pre-gate?
- **Multi-tenant Service isolation.** A Service `PUBLISHED` is globally available. For per-tenant private Services (white-label / enterprise / regulatory-isolated), is `audience` enough, or do we need a tenant-scoping primitive?
- **`Service.invoke()` API shape.** The doc shows lifecycle but not invocation API. Sketched: `service.invoke(input, { worker })` returns an `InvocationHandle` with `.state`, `.subscribe()`, `.clarify(...)`, `.cancel()`, `.dispute(...)`. Needs detail.
- **Versioning semantics.** Two Services with the same `slug` and different `versionVector` — do they coexist as `v1` / `v2`, or does Publish replace? sb's RuntimeUnit version-pins suggest coexistence; UX may demand replacement.
- **Failure modes during `Service.generate(grid)`.** Streaming AsyncIterable means partial results — what's the resume semantics if the runner crashes mid-grid? sb has dedupeKey-based idempotency.
- **The `Service.invoke()` ↔ `$.tasks.create({ tool })` overlap.** Today an Invocation could be modeled as a Task. Are they the same thing under different names?

## Implementation order

1. Land the L0-L3 substrate from `2026-05-05-business-as-code-stack-design.md` (token strata, autonomous-finance core, Repo lift)
2. Promote Function-as-typed-primitive in `digital-tools` (Code/Generative/Agentic/Human + reward + cost + oversight)
3. Define `ServiceArchetype` registry + initial catalog (`services-as-software/archetypes/*`)
4. Define `ServiceSpec`, `OutputContract`, `ServiceBinding`, `ServiceLineage` types
5. Implement `Service.define(spec) → Service` + `Service.verify()` synthetic-invocation gate
6. Implement `ServiceLifecycle` + `InvocationLifecycle` FSMs over `ai-workflows` durable runtime
7. Implement `MarketplaceListing` + `RuntimeUnit` typed records + persistence
8. Implement `Service.generate({ grid })` higher-order primitive (uses combinator stub or sb-internal combinator package by ref)
9. Implement six UI-surface `*.Shape` types + reference renderers in `digital-products` / `ai-props`
10. Migrate `startup-builder/orchestrator.ts` onto the primitives — one stage at a time, behind a feature flag

## Source material

- `/Users/nathanclevenger/projects/business.org.ai/` — canonical Noun substrate (NAICS / O*NET / APQC PCF / NAPCS / UNSPSC / GS1 / BLS / ISO ingested as TSVs + MDXLD)
- `/Users/nathanclevenger/projects/startup-builder/` — production cascade orchestrator (`THESIS.md`, `ROADMAP.md`, `CASCADE.md`, `COMBINATORS.md`, `ENTITIES.md`, `ONTOLOGY.md`, `SERVICES.md`)
- `/Users/nathanclevenger/projects/services-as-software/` — Services-as-Software book manuscript (Four Functions, layered independent verification, HITL with expiration, outcome pricing)
- `/Users/nathanclevenger/projects/business-as-code/` — Business-as-Code book manuscript (typed Goals/OKRs/KeyResults; experimentation machine; earned autonomy)
- Stripe Sessions 2026 (April 29-30, 2026; 288 launches): MPP, SPTs, Issuing for Agents, Treasury, Streaming Payments, Privy non-custodial wallets, Connect Marketplace Wallets, Stripe Projects
- Companion design: `docs/plans/2026-05-05-business-as-code-stack-design.md`
- Deferred meta-package: `packages/autonomous-startups/README.md`
