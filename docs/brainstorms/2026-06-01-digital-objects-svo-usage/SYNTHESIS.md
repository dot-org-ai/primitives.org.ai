# SYNTHESIS — digital-objects SVO usage brainstorm

**Date:** 2026-06-01 · 4 lenses (frame-semantics · event-sourcing · economics/findOrCreate · KR/semantic-web)

The point of this round was to ground the committed `Ontology()` interface in concrete usage **before finalizing**, because the recurring failure has been finalizing interfaces ahead of requirements. The lenses delivered: the strongest findings are the ones where 3–4 disciplines independently demanded the *same* mechanism — those are validated. Where they disagree, that's the grill agenda.

## Lens scorecard

| Lens | Discipline | Highest-leverage use case | Sharpest demand |
|---|---|---|---|
| **A** | Frame semantics / NLG | "Autobiography of a startup" — write-a-fact-through-a-frame, read-it-back-as-a-sentence at population scale | `Frame` must be a complete **bidirectional realization contract** — every role carries fillerKind + required/optional + preposition + surface-order |
| **B** | Event-sourcing / DB eng | Fork-and-replay the multiverse (counterfactual companies) | `perform()` must take a **content-addressable id** and be idempotent → provably replayable log |
| **C** | Economics / findOrCreate | Every relation edge routed through the **fan-typed FIND\|CREATE\|ESCALATE gate** | `Frame` must carry per-relation **`fan` + `direction`**; relation-Actions route *only* through a `link\|mint\|quarantine` decision |
| **D** | KR / semantic web | Lossless **JSON-LD `@context`/`@graph` export** of an `Ontology()` | Ontology serializes **bijectively** to linked data; interop keys on a grounding **IRI**, never `Verb.name` |

## Strong convergent findings (independent arrival = validated)

### C1. Identity is content-derived from the `frozen` stratum — and that one mechanism does three jobs (B + C + D)
Three disciplines, three different motivations, one mechanism:
- **B** wants a content-addressable `Action`/`Thing` id so retries are idempotent and replay is deterministic (`hash(verb, subject, object, roles, payload)`).
- **C** wants `frozen` fields to be the **dedup key** — content-derived and tenant-independent so a `Thing` minted by one startup is `link`-able by another.
- **D** wants `deriveContentId` (graphdl already ships sha256-prefix-12) so the *same* canonical entity gets the *same* global id across orgs, with the **`frozen` fields as the documented canonical projection** feeding the hash.

→ **The `frozen`-stratum fields ARE the canonical projection. A content-derived id over them is simultaneously the idempotency key, the cross-startup dedup key, and the cross-org global identity.** This wires graphdl's existing `deriveContentId` straight into `create()`/`perform()`. This is the single most validated decision in the round.

### C2. `Frame` is the load-bearing center — and it is currently too thin (A + C + D)
Every non-engineering lens independently said the Frame must carry more per role:
- **A**: `fillerKind` (thing/action/tool/literal), `required` vs optional, `preposition` + `surfaceOrder`.
- **C**: per-relation **`fan`** + **`direction`** (so the economic gate reads regime off the Frame, never guesses at runtime).
- **D**: roles map to `rdfs:domain`/`rdfs:range` + schema.org `Action` argument-roles; `manner` governed as an open set.

→ **The Frame is the hinge of the whole interface.** It is read by the NL realizer, the economic gate, AND the JSON-LD exporter. The current `Frame` (bare `NounRef` per role) is under-specified for all three. The Frame must graduate from "which Noun per role" to "a fully-typed per-role descriptor."

### C3. Adopt graphdl's nested `reverse: { by, at, in, for }` + `actor`/`result` (user's call, seconded by A + D)
- **A**: needs the benefactive `for` slot the flat `reverseBy/At/In` form drops; reverse is what synthesizes passive query surfaces (`order.placedBy`).
- **D**: keeping `reverse` structured maps cleanly to `owl:inverseOf` + reverse-direction labels.

→ Confirms the decision already made. `digital-objects`' `Verb extends graphdl.Verb` and inherits the nested `reverse`.

### C4. `Action` is the primary substrate, append-only, immutable, language-neutral (A + B + C + D)
- **B**: Action is the single source of truth; Thing is a projection; replace destructive `deleteAction` with tombstones.
- **C**: the gate is the *only* path to relation creation, so no edge bypasses the economic count.
- **A**: no English strings stored on Action (so it re-renders in any language).
- **D**: an Action serializes as a reified `schema:Action` / `rdf:Statement`.

→ **`Action` must be an immutable, append-only, language-neutral, serializable fact.** No `update` on Action; status is the only mutable field under a transition guard; deletes are tombstone-Actions.

### C5. The status model is incomplete — needs `quarantined`/escalate (B + C)
- **C**: uncertainty must `quarantine`, distinct from `failed` (a deferred decision, re-drivable when adjudication arrives — never auto-mint on uncertainty).
- **B**: status transitions need a guard; quarantine fits the saga/compensation model.

→ Add `quarantined` to `ActionStatusType`; define the legal transition graph.

## Real divergent findings (the grill agenda — decisions to resolve)

### D1. Minimal port vs. rich port — and where does `findOrCreate` live?
**The central tension.** **B** wants an operationally rich port (`subscribe()` changefeed, forward cursor pagination, `ifVersion` optimistic concurrency, per-item batch results) yet also says "keep the port minimal; compose fork/replay on top." **C** wants relation creation to route *exclusively* through a Provider `findOrCreate` returning `link|mint|quarantine`. The original plan puts the findOrCreate **port** in `ai-functions` (type-only), the pure decision core in `ai-functions`, the adapter in `ai-database`. So: does `DigitalObjectsProvider` expose `findOrCreate` + `subscribe` + cursors directly, or does it stay a thin storage port with those composed in `ai-database`/`ai-functions`? **This decides the package boundary and must be resolved first.**

### D2. FrameRole taxonomy — add `beneficiary`? add `result`? align to schema.org?
**A** wants to ADD `beneficiary` (Fillmore's benefactive: "on behalf of" ≠ recipient's "to whom") — pervades services-as-software representation acts. **D** wants role names to MAP onto schema.org `Action` (`subject→agent`, `object→object`, `recipient→recipient`, `instrument→instrument`, **`result`**) — and schema.org has **no beneficiary**, but **does** have `result` (which the current Frame lacks though graphdl's Verb has a `result` conjugation). Decision: final FrameRole set + whether names align to schema.org's published argument-role vocabulary.

### D3. `manner` — closed per-Verb enum vs. open canonical-governed set
**A**: `manner` is a closed `string[]` enum the Verb defines (adverb literals: conditionally/unanimously). **D**: `manner` is an *open, unionable* set governed at the canonical-predicate level so two orgs sharing a canonical verb merge their manner vocabularies. Closed-for-validation vs open-for-interop.

### D4. How much canonical/registry/versioning surface is in-scope NOW?
**D** specifies a large surface: `groundedAs?: IRI`, `subClassOf?`/`subPropertyOf?`, post-mint `source`/`canonical` promotion, JSON-LD bijection, `owl:versionInfo`/`deprecated`/`supersededBy`, semver-pinned registries. `verbs.org.ai`/`schema.org.ai` are **not yet published**. Decision: what is built now (likely: `$type` inheritance + `groundedAs?` slot + a JSON-LD serializer) vs. designed-for-but-deferred (promotion transitions, version migration, merge reconciliation)?

## Committed path forward

**Phase 0 — Adopt the convergent findings (high-confidence, no further debate):**
1. **Content-derived identity** over the `frozen`-stratum canonical projection (wire graphdl `deriveContentId`); it is the dedup key + idempotency key + global id. (C1)
2. **`Frame` graduates to a per-role typed descriptor** — minimally `{ noun, fillerKind, required }` per role + a package-owned `FrameRole → { preposition, surfaceOrder, dereference }` constant + `fan`/`direction` on relation-bearing roles. (C2)
3. **`Verb extends graphdl.Verb`** with nested `reverse` + `frame?`/`source?`/`canonical?`. (C3)
4. **`Action` is immutable/append-only/language-neutral/serializable**; tombstones replace `deleteAction`; `perform()` gains a content-addressable `id?`; add `quarantined` status + transition guard. (C4, C5)
5. **`Noun` inherits graphdl's `$type` IRI**; `Ontology()` gets a JSON-LD `@context`/`@graph` serializer seam. (D-keystone)

**Phase 1 — Grill to resolve D1–D4** (next session). D1 (port boundary + findOrCreate home) is the gating decision; D2–D4 are scoped after it.

**Phase 2 — Re-spec `Ontology()` + the Provider port** against the resolved decisions, then write the aip-cnks.8 implementation plan (dedup-against-graphdl + storage-strip + the new SVO-runtime additions, as tiny commits).

## Parking lot (explicitly NOT covered this round)
- Concrete storage implementation (pg+ch vs DO-SQLite vs Memory) — ai-database's job per ADR-0003; we only specified the port semantics it must honor.
- The findOrCreate *calibration* (InfoNCE adapters, thresholds, Flash-Lite ratify cost) — stays in `ai-experiments` behind the injected ranker port per the plan; we only specified that the Frame must carry `fan`/`direction` so the gate can dispatch.
- Bandit/reward attribution algorithms for `composition` strata — a consumer concern; we only specified `compositionFields()` enumerability + stable arm indexing.
- Localization tables for non-English realization — a consumer concern; we only specified that Action storage stays language-neutral so a realizer can be swapped in.
