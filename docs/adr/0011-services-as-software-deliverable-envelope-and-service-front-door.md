# services-as-software: the four-layer Deliverable envelope, `Service()` front door, and a layered three-surface API

**Status:** proposed
**Date:** 2026-06-01

## Context

`aip-cnks.7` (TRACK B of the strategic-primitives hardening, see
`docs/plans/2026-06-01-strategic-primitives-hardening.md`) absorbs the proven
service-delivery implementations that four consumers independently built:

- **carriage** `src/chassis` — `ServiceDefinition`, `runCascade`, the pure
  `derive*` UI projections, an `AuthBroker`/`Substrate` shim.
- **startup-builder** `packages/api-envelope` — the design-locked
  `ResponseEnvelope` (5 golden fixtures); `cascade-runners` stage-25/33 service
  and marketplace-listing derivation ("binding is data").
- **services-builder** `packages/lifecycle` — the 11-state `ServiceInvocation`
  FSM; `packages/match` (pgvector match-or-mint); `packages/verify` (3-rater
  JIT panel); `packages/shared` (BuyerIdentity + attested-intent HMAC).
- **explore.startups.studio** — the `Deliverable` interface (ADR 0064 there) and
  the "economy is three graphs" model (ADR 0058 there).

Two foundational decisions reframed the design before it was finalized.

**1. The control spine is business-as-code's Goal/Metric, not finance.** A
service exists to advance a **Goal**, judged by a **Metric/KeyResult** (the
business-as-code book's pivot: *"Goals Are Tests. Tests Are Rewards."*). The
`business-as-code/finance` substrate (`OutcomeContract`/`Pricing`/`SLAPolicy`/
`Money`) is *settlement firmware* below the service — the book's chapter title is
literally "Finance Is Firmware" — not the conceptual core. So the package binds
**Service → Outcome → Goal/Metric** at the top and *consumes* finance underneath.

**2. The canonical unit is explore's four-layer `Deliverable`, not a bare
Service.** A pre-landing review of explore's **G3 graph** (ADR 0058/0064 there)
found that the unification we were assembling piece-by-piece (Service binding +
acceptance Metric + Offer/pricing) already exists as one envelope. Our
"Service + Offer + Metric" map onto three of its four layers. G3 also splits
what we had been calling "Service" into the abstract **G1 `Service`** category
and the concrete **G3 `Deliverable`** (`kind: 'service-as-software'`) that wraps
it; and it splits **Demand / Problem / ICP** into three distinct things.

The value-capture dimension is a second, *dual* spine. explore's **value-capture
ladder** (`GATING_BASES`, a closed 5-rung enum, "complete by construction") —
`access | effort | usage | output | outcome` — is the basis a payment is
*conditioned on*. Climbing it is climbing the Metric ladder: each rung requires a
stronger contract, and the top rung (`outcome`) *is* the acceptance Metric. The
two spines meet at the **assurance→gatingBasis ceiling**: explore already
encodes `outcomeContract.assurance` (`instrumented → … → unverifiable`) deriving
the legitimate `gatingBasis` — *"you may not sell on an outcome you never
declared."*

An interface was designed three ways in parallel ("Design It Twice"):
envelope-native (the Deliverable value is the API), lifecycle/FSM-native (the
invocation handle is the API), and noun-graph-native (nodes + typed edges + lenses).
The finding: they are not rivals but three **axes** — authoring, runtime,
discovery — and each names the other two as owning its weak spots. Each consumer
needs two of the three.

## Decision

### 1. The package builds `Deliverable`s of `kind: 'service-as-software'`

The canonical, addressable unit is the **four-layer Deliverable envelope**
(adopting the *shape* of explore's `Deliverable`, ADR 0064 there — not its G3
cascade content):

- **`contract`** — `outcomeContract`: an **Outcome** (cross-cutting, the
  "positive mirror of a Problem") + an acceptance **Metric** + a graded
  **`assurance`** ∈ `{instrumented, deterministic, proxy, sampled, attested,
  counterfactual, unverifiable}`.
- **`implementation`** — **Functions** (`kind: Code | Generative | Agentic |
  Human`) + a binding/cascade (carriage's `runCascade` over JSON steps with
  `$ref` resolution; code execution delegates to ai-evaluate per ADR-0010).
- **`dependencies`** — recursively `composes` sub-Deliverables (the stack:
  `service-as-software → agent → software`).
- **`commercial`** — the **Offer**: `gatingBasis` (the value-capture ladder) +
  `priceSpecification` + `fundingSource` + promise/seller.

The honest *type* is `Deliverable` (its `composes` layer holds `agent`/`software`
kinds; naming it `Service` would lie about the recursion). The G1 abstract
`Service` category remains business-as-code's `Service` noun (positioning/catalog),
which a Deliverable's contract `wraps` and an Offer's `itemOffered` references.

### 2. `Offer` is canonical in business-as-code, re-exported here

Pricing is exposed **only** on the `Offer` (`commercial` layer) and its derived
Listing — **never** on the bare capability. `Offer` is a foundational business
type shared by **Product *and* Service**; both live in business-as-code (L5), so
`Offer` cannot live in services-as-software (L6) without a layer inversion.
Therefore:

- **business-as-code** gains a canonical `Offer` noun (schema.org `Offer`,
  `itemOffered → Service|Product`) carrying `gatingBasis` + `priceSpecification`
  + `fundingSource`. The pricing currently smeared inline on the `Product` and
  `Service` nouns (`pricingModel`/`hourlyRate`/…) is factored out onto `Offer`;
  `PricingPlan` becomes one `priceSpecification` shape.
- **services-as-software** *re-exports* `Offer` and `PricingBasis`, and owns the
  service-specialization: binding `Offer.itemOffered` to a Deliverable, the
  assurance→gatingBasis ceiling, and Listing derivation.

`Demand` is the schema.org dual of `Offer` over the same `itemOffered`;
`match-or-mint`/`findOrCreate` is the Demand→Offer matcher; `Outcome.resolves →
Problem` closes the loop. **Listing** is a *published, lens-filtered projection*
of an Offer (representative vs concrete), **not** a stored noun.

### 3. The assurance→gatingBasis ceiling is enforced at four boundaries

The same invariant — *gate at `outcome` only if the Outcome's Metric is
verifiable* — is checked everywhere the value crosses a boundary (defense in
depth):

1. **Author-time** (compile): `Service<const S>(spec)` narrows the legal
   `price.basis` from `spec.metric.verify`. An over-reaching rung does not
   typecheck.
2. **Edge-construction** (compile/load): the graph's `gatedOn` edge constructor
   returns `never` for an illegal (basis, assurance) pair.
3. **Order-time** (runtime): `InvocationHandle.ceiling` is computed at `ORDER`;
   `OrderOpts.gateAt` above the ceiling is rejected before the FSM opens.
4. **Wire** (runtime): explore's `superRefine` backstop for JSON-loaded
   Deliverables.

### 4. A layered three-surface API, envelope as single source of truth

Each axis uses the design that is *deepest* for it; all compose over the one
Deliverable value, so surfaces cannot drift:

- **Author — `Service()` front door (envelope).** A callable factory over
  **simple plain objects** (the business-as-code `Business()`/`Product()`/
  `Goals()` idiom) with progressive disclosure: minimal required fields, the four
  layers inferred and surfaced only when needed. `Service(spec)` returns the
  canonical `Deliverable`. `Service.define`/`fromFunction`/`load` remain as
  secondary constructors; `Service([…])` batch-authors.
- **Discover/price — graph `match` + `derive`/`project` (subset of the graph
  design).** The Deliverable+Offer register as nodes; `match` (Demand→Offer,
  match-or-mint) and `derive.<lens>` (catalog/listing/order/delivery/portal) are
  pure projections. The locked `ResponseEnvelope` is the serialization of a node
  + its edges (`relationships` = out-edges, `references` = in-edges). Hand
  `add`/`link` node authoring is **not** the public surface — the graph is
  *populated by* `Service()`.
- **Run — `invoke()` → `InvocationHandle` (lifecycle/FSM).** The 11-state FSM
  (`ORDERED→…→ACCEPTED`, + `CANCELLED/ESCALATED/ERROR/REFUNDED/DISPUTED`) with an
  event stream spine; `QUALITY_REVIEW` runs the acceptance Metric via the 3-rater
  panel; `DELIVERED→ACCEPTED|DISPUTED` settles or refunds via finance firmware.
  Clarification and escalation are first-class lifecycle branches.
  `reconcile()→Settled` is the fire-and-forget convenience over the handle
  (`await handle.settled()`).

### 5. Extraction boundary: envelope graduates, generation cascade stays closed

Per the cascade-extraction policy, the **transaction/supply envelope** graduates
to the primitive — `Deliverable`, `Offer`, `Demand`, `Outcome`, `Metric`,
`gatingBasis`, `assurance`, Function-kinds. The **G3 generation cascade** stays
closed in explore — **ICP, Thesis, Combinator, Startup, Founding Hypothesis,
Position**, and the population engine — referenced only via injected ports.

## Consequences

- **One source of truth.** Service/Offer/Metric/Listing/Invocation are layers or
  views of the one Deliverable; `derive`/`invoke`/`match` cannot disagree with
  the authored value.
- **The ceiling is unforgeable at authoring time**, with three further backstops.
  Outcome-pricing without a verifiable Metric is a compile error.
- **carriage is the test surface**: it deletes its `src/chassis` shims (its
  `ServiceDefinition`/`runCascade`/`derive*` are subsumed by `Service()` + the
  Deliverable + the graph lenses). startup-builder's `MarketplaceListing` becomes
  the persisted *concrete Offer projection*; its `ResponseEnvelope` is adopted
  verbatim (golden fixtures preserved). services-builder's FSM + match + verify
  back the runtime surface.
- **business-as-code changes too** (the `Offer` extraction + de-inlining of
  Product/Service pricing). This is a coordinated two-package change; the Offer
  noun must land first.
- **Full cascade-runtime wiring depends on `aip-cnks.5`** (ai-workflows cascade
  substrate). The pure shapes (authoring, derivation, FSM types, envelope) land
  independently; `runCascade` execution binds later.
- **Demand-first flows** (start from a raw Problem) are second-class in the
  `Service()`-authoring path; they are first-class in the graph `match` surface,
  which is the intended home for discovery.
- **No new npm package, no new scope.** `Offer` folds into business-as-code's
  existing offerings family; everything else is subpath/export additions to
  `services-as-software`. (Per CLAUDE.md package-creation guardrail.)

## ADRs respected

- ADR-0002 (function registry vs digital-objects registry stay separate) — the
  Deliverable's `implementation` Functions are the function-registry side; G1
  `Service`/nouns are the digital-objects side.
- ADR-0003 (pg+ch storage; DO SQLite first-class but not default) — marketplace
  read-path and FacetStore stay in ai-database's DBProvider.
- ADR-0005 (service-catalog ClickHouse MV) — the Listing/catalog read-path
  primitive is unaffected; Listings remain projections.
- ADR-0006 (service reverify policy) — `assurance` grading composes with the
  existing reverify policy on behavioral fields.
- ADR-0010 (ai-functions delegates code execution to ai-evaluate) — the
  Deliverable's Code/Generative Functions execute through that sandbox.
