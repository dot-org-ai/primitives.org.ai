# Strategic primitives hardening — absorb the stabilized consumer implementations

**Status:** proposed
**Date:** 2026-06-01
**Driver:** `explore.startups.studio` is stabilizing; `startup-builder` / `services-builder` are slated to split out of it; `carriage` was just unified onto `services-as-software`. The consuming layer has stopped moving enough to extract the primitives it proved out.

## Thesis

The 9 strategic packages are **under-exposed, not under-built**. The proven, battle-tested implementations live in four stabilizing consumers (`explore.startups.studio`, `carriage`, `services-builder`, `startup-builder`). We deferred extracting the packages because co-evolving consumer + dependency at once was whack-a-mole. Now is the moment to **harden the primitives by absorbing what the consumers proved** — then they delete their local shims and import.

This is **extraction-at-the-right-time**, not a greenfield "find shallow modules" review. The engine/seams graduate to primitives; still-moving research stays in `ai-experiments` behind injected ports.

## The strategic 9 (utilization targets for startups.studio)

`ai-functions · ai-database · ai-workflows · business-as-code · services-as-software · digital-workers · digital-tools · autonomous-agents · human-in-the-loop`

Foundational support (in their dependency closure, not themselves strategic): `@org.ai/types`, `language-models`, `ai-providers`, `ai-evaluate`, `digital-objects`, `@graphdl/core`, `org.ai`, `digital-tasks`.

## Dependency tree (topologically layered)

```
L0  types  language-models  ai-evaluate  digital-objects  graphdl   | config  ai-tests
L1  org.ai  ai-providers  ai-workflows⭐
L2  ai-functions⭐  ◄── CHOKEPOINT & JOIN (117 import sites in explore.startups.studio)
L3  ai-database⭐  digital-workers⭐                                   | ai-props
L4  business-as-code⭐  autonomous-agents⭐                            | ai-experiments  digital-products
L5  digital-tools⭐
L6  services-as-software⭐  digital-tasks                              |
L7  human-in-the-loop⭐
L8  ai-primitives (umbrella)
```

Two structural facts:
1. **`ai-functions` is the chokepoint and join.** All three foundation inputs (model stack · SVO ontology · types/graph) converge there; all 7 upper strategic packages sit on top. Harden first.
2. **The upper strategic layers (L4→L7) form a near-linear chain** — hard to split across sessions. **The real parallelism is at the foundation (L0–L1)** before everything funnels into `ai-functions`.

## Consumer evidence (the under-exposed proof)

- **explore.startups.studio** — uses `ai-functions` as a *type oracle only* (reads the `FunctionDefinition` discriminant + `HumanChannel`), then builds its own runtime: `Function`/`Tool`/`ExecutorRegistry`, a pure agentic loop, and the entire generation engine (`app/_lib/cascade/core.ts` `generateFacetCore`, `facets/schedule.ts`, `cascade/prepare.ts`, `enrich/flow.ts`). Never calls `defineFunction()` or the agentic loop.
- **carriage** — re-implements the *entire* `services-as-software` v3 surface locally (`src/chassis`: `ServiceDefinition`, `runCascade`, `shapes/derive-*`, an `AuthBroker` shim) because the package isn't published consumable. Carriage is the flagship test surface: it deletes its shims when the package ships.
- **services-builder** / **startup-builder** — independently built the *same* abstractions (5-step mint cascade; 42-stage CASCADE; match-or-mint; ResponseEnvelope; lifecycle FSM; multi-provider+batch LLM). Three+ repos reinventing one seam = the strongest extraction signal.

## The linchpin: `ai-functions ↔ ai-database` co-design (THIS session)

One design problem, three seams:

```
ai-functions                                   ai-database
─────────────                                  ──────────
generate seam   (model.run: generateObject     FacetStore (cache / embed-on-write)
                 | agent-parallel-subagent
                 | compute | compose)
findOrCreate PORT + pure gate + bands    ◄──►  findOrCreate ADAPTER (pgvector ANN + LLM ratify)
embeddings socket                              SemanticProvider + ~>/<~ operators
schedule / fan-out                             DBProvider (pg+ch, ADR-0003)
```

### generate seam
A pluggable `model.run(PreparedGeneration)` where `generateObject`, an agent-parallel-subagent workflow, `compute`, and `compose` are all adapters. The "Claude workflow with parallel subagents" is a *distributed fan-out orchestration layer above* the per-unit core (explore's `cascade-gen --emit-spec` → external Workflow → `--in=envelopes` gate+persist), NOT an in-core switch. Source: `cascade/core.ts:417-1241` (the `CoreEffects` seam: model/store/onOutput/transformOutput/compute/composeCompute/router/findOrCreate).

### findOrCreate seam — the economic gate
The gate that stops the cascade from regenerating semantically-equivalent work (what makes 1M startups tractable). Canonical base: explore `adapters/find-or-create-gate.ts` (Tier 1; resolver-proven, but hot-path cascade dispatch is still Phase-2c even upstream — we design that integration as part of the primitive).

**Decision is 3-way: `FIND | CREATE | ESCALATE`** (= link / mint / quarantine). Uncertainty fails toward escalate/create — **never auto-mint on uncertainty, never a wrong collapse.**

```ts
// PORT — ai-functions/src/find-or-create.ts (imported TYPE-ONLY by ai-database → no cycle)
interface FindOrCreateGate {
  decide(coord, ctx: FindOrCreateContext, policy?: { autoLinkDisabled?: boolean }): Promise<FindOrCreateDecision | null>
}
type FindOrCreateDecision =
  | { kind: 'link';  canonical: Coordinate; reason: string }
  | { kind: 'mint';  reason: string }
  | { kind: 'quarantine'; reason: string }   // = ESCALATE: think-longer / stronger model / human
```

**Match is NOT a single cosine floor.** Per-relation regime by `fan` (avg distinct true-tails per head, #473):
- **functional** (fan<3, direction-bearing, e.g. `producedBy→Industry`): pool-constrain by graph category → **per-relation InfoNCE adapter rank** (beats raw cosine: `producedBy` H@1 0.92; `suppliesTo` prec@1 ~45× chance vs raw 0.06) → accept only at high precision, else escalate.
- **fuzzy** (fan≥3, many-to-many): propose top-k → **small/fast-LLM (Flash-Lite) ratify** (~$8/M edges, precision 0.81) → accept ratified pick, else escalate.

The three "different" findOrCreate impls are **one gate in three bands**: ai-database `~>`/`<~` operators are the *declarative surface*; services-builder's pure-pgvector match is the *autoLink fast path*; the Flash-Lite judge is the *ambiguous band*.

Ports the gate needs (injected — pure decision core): `embed`, `nearest` (pgvector ANN), `loadNeighborNode`, `candidateNode`, `adjudicationAvailable`, `adjudicate`, `thresholds(dimension)`. Live adapter → `ai-database/src/adapters/find-or-create-gate.live.ts` (`makeFindOrCreateGateLive(db, embeddings, judgeModel, thresholds)`).

**Engine design (design-it-twice result):** a layered hybrid of four explored shapes — ② a pure, total, replayable `decide(Evidence)→Verdict` CORE (correctness; never-auto-mint, mode-refusal, fail-safe) + ④ a batch-first cohort COLLECTOR (hot-path economics; the `Cohort` type carries the mode invariant) + ① a minimal `resolve(ref)` verb and ③ the `~>`/`<~` operators as the two ergonomic FAÇADES. Research (InfoNCE rankers, threshold calibration) injects at the ports, in `ai-experiments`.

### Public interface layer (the developer surface) — `aip-cnks.4` + `.5`

The engine above is plumbing; the public API sits on top. **`findOrCreate` is to *semantic* identity what `upsert` is to *exact* identity** — it slots next to the existing `create`/`upsert` on the entity proxy.

`ai-database` — methods on the entity proxy:
```ts
$.Ideas.findOrCreate(input, opts?): Promise<Thing>          // returns linked or minted Thing; throws EscalationRequired on quarantine (opts.onEscalate: 'throw'|'mint'|'skip')
$.Ideas.findOrCreateMany(inputs, opts?): Promise<FindOrCreateResult[]>  // {decision, thing|null, confidence, mechanism, audit} per item — maps to the cohort runtime
// FindOrCreateResult.decision: 'linked' | 'minted' | 'quarantined'
```
Plus the declarative `~>`/`<~` operators resolved in `db.resolve()`.

**Call-site shape picks the mode (developer never flips it):**
- `$.Noun.findOrCreate(entity)` = entity dedup (same-type) → **COLLAPSE / symmetric-centered** (the 0.93 gate). Per-Noun configurable.
- `field: '~>OtherNoun'` = relationship resolution (name → other-type node) → **MATCH / asymmetric** (per-relation rank).

`ai-workflows` — `findOrCreate` as a flow-control gate node:
```ts
workflow('idea-cascade')
  .findOrCreate('Ideas', (ctx) => ctx.input.idea, { onLink: 'short-circuit', onEscalate: route('review') })
  .step('enrich', enrichIdea)   // runs only on CREATE
  .build()
// FIND → short-circuit (reuse, skip downstream) · CREATE → continue · ESCALATE → branch
```

Both `ai-database` methods and the `ai-workflows` node are **thin façades** — adapt args → call the injected gate (collector + pure core) → shape the result (a `Thing`, a verdict list, or a flow branch). No decision logic is duplicated.

#### Verb algebra: `find` / `create` / `generate` + the `Or`-compositions

The `Or`-variants are not primitives — they compose three atomic verbs. The gate (`decide → FIND|CREATE|ESCALATE`) is `find()` + threshold bands; the compositions are the gate with `create()` vs `generate()` as the CREATE materializer; the marginal band → ESCALATE.

| verb | does | side effect | LLM | available on |
|---|---|---|---|---|
| `find(x)` | **tiered hybrid**: exact key → FTS (lexical) → vector (semantic), fused via RRF → `{ thing, confidence } \| null` | none (read) | embed only if cheap tiers inconclusive | all Nouns |
| `create(data)` | persist supplied entity (always new) | write | no | all Nouns |
| `generate(seed)` | LLM-author entity from seed (always new) | write | yes | `$generation !== 'never'` |
| `findOrCreate(entity)` | `find` ?? `create` | write | no | all Nouns |
| `findOrGenerate(seed)` | `find` ?? `generate` | write | yes | `$generation !== 'never'` |

- `find()` is a **cost ladder, not vector-only**: exact/normalized-key (O(1), no embed) → FTS/lexical → vector ANN → fuse via RRF → threshold band. Cheap tiers **short-circuit** — an exact phrase match never touches an embedding (the cost difference at 1M scale). Per-Noun config picks which tiers run (`SKU`/`ISBN` → exact-only; `Problem` → full hybrid). The two embedding modes (symmetric-COLLAPSE for entity dedup / asymmetric-MATCH for seed→entity) apply to the **vector tier only**; exact/FTS are lexical and mode-agnostic. Exact-accept is default but a Noun may require vector/judge confirmation for homonym-prone verticals. (`ai-database` already ships `computeRRF` + hybrid search; the matcher already probes exact-first.) The gate's escalating ladder: exact-accept → FTS+vector hybrid → LLM-ratify (marginal band) → ESCALATE.
- `create`/`generate` don't match on read — they **embed-on-write** so future `find()`s (vector tier) can match them.
- Slots beside the existing family: `get(id)` exact-by-id · `search(q)` ranked list · `create` persist · `upsert` exact-id find-or-create. `find`/`generate`/`findOrCreate`/`findOrGenerate` are the **semantic-identity** row.
- **Closes the embeddings loop:** `find()` = *discriminate* (embeddings); `generate()` = *compose* (LLM). The atoms are the two halves of "embeddings discriminate, LLMs compose"; the `Or`-variants wire discrimination → composition. (This is why delta-vectors were doomed — they made `find` do `generate`'s job.)

#### Generatability is a Noun policy, not a per-call choice (`$generation`)

A `Customer`/`Lead`/`Person` has a real-world referent — must never be fabricated. A `BlogPost`/`Product`/`Offer`/`Problem`/`Startup` is a synthesized artifact — generation is its point. So the **Noun declares it once** and the type system enforces it:

```ts
DB({
  Customer: { name:'string', email:'string', $generation:'never' },   // real-world → never generate
  BlogPost: { title:'string', body:'text',   $generation:'auto' },    // content → generate from seed
  Offer:    { sku:'string', price:'number',  $generation:'review' },  // generate → HITL sign-off
})
```

- `'never'` — CREATE may only **persist** supplied data; `generate()`/`findOrGenerate()` are **absent at the type level** (`$.Customers.generate(...)` doesn't compile). Fabrication is structurally impossible, not a discipline.
- `'auto'` — CREATE generates from a seed and commits.
- `'review'` — generated draft routes through **human-in-the-loop** before commit (the ESCALATE→human path; home for `Offer`/`Product`).

**Cascade safety invariant:** a `CREATE`/mint decision on a `$generation:'never'` Noun becomes **`ESCALATE`, never generation** — the cascade authors *content*, but must never invent the *real-world entities* (the actual Customer/Lead) that content references; it defers to a human or a real data source (CRM/enrichment API).

```
gate.decide(ref) →
  CREATE → Noun.$generation === 'never'  ? ESCALATE (don't fabricate reality)
         : 'review'                      ? generate draft → HITL → commit
         : 'auto'                        ? generate → commit  (mint = enqueue in the cascade)
```

`$generation` is declared on the Noun/schema (`digital-objects` Noun def / `ai-database` schema — the same source of truth as `$id`/`$type`/fields/operators); the gate reads it via the injected registry, `findOrGenerate`/`generate` existence is a conditional type over it, and the cascade + HITL both consult it. One declaration, enforced four places.

### embeddings socket (`ai-functions`)
Expose `EmbeddingMode { model, dims, strategy, postProcess, prefixKind }` + `cosine(a,b,{center})`. **Two modes that must NEVER be globally flipped** (flipping was a real bug — compressed cosine to ~0.07–0.11):
- **`asymmetric`** (query-prefix + bare-doc, NO centering) → retrieval / MATCHING / madlib query-templates. `MATCH_MODE`.
- **`symmetric-centered`** (mean-centered) → dedup / findOrCreate-COLLAPSE / ICP-emergence. `COLLAPSE_MODE`.

**`PredicateSpec`** is part of the interface: `{ rel, dstType, fan, direction: 'direction-bearing'|'similarity-aligned', madlibQuestion?, closedPool? }`. The **direction-gated madlib query-template** (`"What tasks are performed as part of {process}?"`, `"What type of company manufactures {name}?"`) is real, *significant*, but **conditional** — it wins only for direction-bearing predicates and **hurts** similarity-aligned/meronymic ones (`composedOf`, `hypernym`, `holonym`). The matcher gates it.

### schedule / fan-out seam
Pure topological `Schedule` (`facets/schedule.ts`): stage-by-stage, **intra-stage parallel** (`Promise.all`), **sequential across hops** (depth-first in the trace CLI). Layered over the existing batch (`batch-queue.ts` `BatchQueue` + `batch/anthropic.ts` Message-Batches + `batch/bedrock.ts`) AND a distributed worker fan-out. Source enrich flow: `enrich/flow.ts` (gates + grounding ports).

## Borrow catalog (source → target, with maturity)

| Implementation | Source | Target | Maturity |
|---|---|---|---|
| findOrCreate gate (port+adapter, FIND/CREATE/ESCALATE, 2-mode, direction-gated madlib) | explore `adapters/find-or-create-gate.ts`, `findOrCreate/`, `enrich/matcher.ts` | ai-functions (port) + ai-database (adapter) | ★★★★★ arch; calibration/adapters pending |
| match-or-mint (pure pgvector, autoLink fast path) | services-builder `packages/match` | ai-database (fast path of the gate) | ★★★★ production |
| `~>`/`<~` fuzzy operators (declarative surface) | ai-database `schema.ts:3338-3733` | ai-database (unify w/ gate) | ★★★ provider not wired |
| cascade orchestration substrate | services-builder 5-step mint + startup-builder 42-stage CASCADE | ai-workflows | ★★★★ |
| ResponseEnvelope (design-locked, 5 golden fixtures) | startup-builder `packages/api-envelope` | services-as-software | ★★★★★ locked |
| ServiceDefinition + pure `derive*` + runCascade | carriage `src/chassis` | services-as-software | ★★★★ (test surface) |
| service/marketplace-listing derivation ("binding is data") | startup-builder cascade-runners stage-25/33 | services-as-software | ★★★ |
| 11-state ServiceInvocation FSM | services-builder `packages/lifecycle` | services-as-software | ★★★★ |
| JIT lazy-verify runner (3-rater panel) | services-builder `packages/verify` | autonomous-agents + human-in-the-loop | ★★★★ |
| Tool broker + oversight taxonomy (ToolFamily, OversightPattern) | startup-builder `packages/catalog/entities` | digital-tools + autonomous-agents | ★★★ designed, not wired |
| multi-provider LLM + batch + quota-fallback | startup-builder `packages/llm*` | ai-providers / language-models | ★★★★ production |
| BuyerIdentity + attested-intent (HMAC) | services-builder `packages/shared` | human-in-the-loop OR external id.org.ai (**decision**) | ★★★★ |

## Research vs primitive boundary

- **DEAD (validated NO-GO) — the *specific approach*:** a single global linear `W` / additive offset (king−man+woman). Delta-canary: learned < identity on all 6 morphological classes; reversal-curse `cos(fwd,inv)≈0.96`. Contextual models encode relations as rotations, not offsets.
- **OPEN in research (sparks of alpha — keep the door open, do NOT close):** non-global / per-relation mechanisms; the user reports several sparks worth continued research. **Stays in `ai-experiments` behind the injected ranker port** (the InfoNCE per-relation adapters), so a working mechanism plugs in later without redesign.
- **READY now (validation-proved, shipped):** symmetric cosine @ 3072 mean-centered (E1 GO, 100% separable); cosine-collapse dedup @ 0.93; asymmetric doc/query prefixes; the **direction-gated madlib matcher architecture** (alpha real & significant; calibration map + trained adapters injected as research sockets).
- **Principle:** *embeddings discriminate; LLMs compose.* The FIND half is embedding discrimination (cheap); the CREATE half is LLM composition. This is why the delta approach (making embeddings compose) was doomed, and why findOrCreate is the right shape.

## Grounding cases the primitive must deliver on (db4 · problems · startup-builder)

Three earlier cascade-grounding attempts. All three independently invented the `~>`/`<~` operators; **none auto-resolved them or solved semantic dedup** — exactly the gap findOrCreate closes. They validate the direction and hand us a concrete punch-list.

**Validated by both db4 and problems:** prompt-context chaining (parent output → child input) is the right substrate (the cascade `prepare` step); staged dependency-wave execution scales (problems `orchestrator.ts` dependency edges → waves) — matches the schedule seam; deterministic scoped IDs ≠ semantic identity (which is *why* the gate must match by meaning, not id); no minting gate + no batch dedup → duplicate explosion (problems: 5K problems / 254K segments = **98% sparsity**, deferred to post-hoc human curation). FIND|CREATE|ESCALATE + the cohort runtime are the fixes.

**Punch-list (gaps to bake in), by owner seam:**

| # | Gap | Source | Owner |
|---|---|---|---|
| 1 | **Cycle detection** (visited-set), not just a depth cap | db4 (maxDepth only) | schedule |
| 2 | **Tie-break determinism** when two candidates match at ~equal score (idempotency) | db4 | decide() core |
| 3 | **ESCALATE band is explicit** (e.g. 0.85–0.92 → human review) | problems | decide() core |
| 4 | **Collapse preserves provenance** — canonicalize + re-point edges (sameAs/variantOf), never destructively merge; track every source that *exposed* the canonical | problems | decide() core + adapter |
| 5 | **Online FIND vs offline COLLAPSE is a per-Noun policy** (see below) | problems | schedule + cohort |
| 6 | **Draft/Resolve two-phase** — generation emits a draft carrying `$refs`; a resolve pass runs findOrCreate per ref | db4 | generate seam |
| 7 | **Quality/slop gate before an output becomes a parent** (slop amplifies downstream) | problems | generate seam |
| 8 | **Within-parent dedup** (array refs `['AI','ML','AI']`) | db4 | cohort runtime |
| 9 | **Cross-standard merging** (O*NET ≈ APQC ≈ GS1 activity → one Verb/Process identity) | problems | cohort + adapter |
| 10 | **Embedding-model versioning/pinning** (re-embed on encoder change; matches drift) | problems | embeddings socket |
| 11 | **Cohort error semantics** + **context propagation** (tenant/request id through the cascade) | db4 | cohort + ai-workflows |

**The architectural decision `problems` forces — online vs offline.** problems let everything generate unfiltered and deferred dedup to post-hoc human curation; that cleanup "can be substantial at scale." So findOrCreate must support BOTH timings as a **per-Noun policy** (the engine already has both modes; this makes the *timing* first-class):
- **Online FIND** (asymmetric MATCH, in the pre-gen router, during generation): slower generation, **zero** post-hoc cleanup. Right for high-overlap Nouns (Problems, cross-standard Verbs).
- **Offline COLLAPSE** (symmetric-centered @0.93, batch, after generation): fast generation, but a durable cleanup phase. Right for low-overlap Nouns.

**Regression suite (must pass):**
1. Two ICP junctions both produce "Keep audit trails accurate" → COLLAPSE to one canonical Problem linked to ≥2 ICPs (provenance kept), not two rows.
2. O*NET "reconcile discrepancies" + APQC "reconcile AR" + GS1 "verify inventory" → unify under one Verb identity (cross-standard merge).
3. `Post → Author → Org → Posts` cyclic schema → cycle detected, no infinite recursion.
4. Re-run with a new embedding model → matches handled (re-embed or pinned version), no silent drift.
5. 100 Startups referencing "Software Engineer" → one Founder (cohort dedup), not 100 (db4's N+1).

## Parallelization

```
MAIN SESSION (here) ── Generation spine ────────────────────────────────────
  ai-functions engine (design-it-twice: generate + findOrCreate + schedule)
    → ai-database FacetStore + findOrCreate adapter + match → ai-workflows substrate

PARALLEL TRACK A ── Provider/model/batch foundation (independent, L0/L1) ─────
  consolidate multi-provider + batch + quota-fallback into ai-providers/language-models
  source: startup-builder/packages/llm*, services-builder bedrock, ai-functions/batch/*
  sync point: the model.run() seam shape

PARALLEL TRACK B ── services-as-software consumable surface (pure shapes) ─────
  ServiceDefinition + derive* + ResponseEnvelope + listing derivation + FSM
  source: carriage (derive*/ServiceDefinition), startup-builder (envelope/listing), services-builder (FSM)
  test surface: carriage deletes its shims; sync: cascade-runtime wiring (later)

OPTIONAL TRACK D ── digital-objects cleanup (independent, L0) ────────────────
  strip ~2,951 LOC dormant CF DO/SQLite storage (ns, ns-client, r2-persistence,
  worker, memory-provider, ai-database-adapter); keep tech-agnostic SVO ontology;
  resolve DO()/.do/Durable-Object naming collision
```

Tracks A, B, D are mutually independent and touch the main session only at named seams.

## Flagged decisions
- **BuyerIdentity has no home yet** — fold into `human-in-the-loop` or external `id.org.ai`. Do NOT create a new `digital-identity` package without explicit approval (npm package-creation guardrail, CLAUDE.md).
- **ai-workflows layer tension** — the cascade *substrate* conceptually sits above ai-functions' engine but ai-workflows is L1. Likely resolution: pure DSL/graph in ai-workflows, execution binds to ai-functions. Grilling-phase decision.

## ADRs respected
- ADR-0003 (pg+ch first-class; DO SQLite first-class but not default) — storage seam stays in ai-database's DBProvider.
- ADR-0001 (rdb-provider-adapter is load-bearing) — keep.
- ADR-0010 (ai-functions delegates code execution to ai-evaluate) — keep.
- ADR-0002 (function registry vs digital-objects registry stay separate) — keep.
