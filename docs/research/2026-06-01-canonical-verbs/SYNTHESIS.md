# SYNTHESIS — Canonical verbs, graphdl deprecation, and real cascade usage

**Date:** 2026-06-01 · sources: verbs.org.ai registry · graphdl parser · explore.startups.studio enrich cascade

Three explorations to ground the canonical verb set before locking the `digital-objects` `Verb`/`Frame`. Headline: **the canonical registry already exists and is substantial; digital-objects has already independently reimplemented graphdl; and the real cascade's `PredicateSpec` confirms D2′ almost exactly.** One earlier decision flips.

## Finding 1 — The canonical registry exists: `verbs.org.ai`, 1,039 verbs

- Published package; **1,039 verbs, one MDX file per lemma**, YAML frontmatter as the structured record. Build Zod-validates → frozen `VERB_DATA`.
- Each entry: `$id`/`$type`/`$context`, `canonicalForm`, `source` (URL) + `vocabulary`, `description`, and **six SVO forms**: `act` / `event` / `activity` / `actor` / `object` / `inverse`.
- **Identity = the camelCase lemma** (the `$id`, filename, key). Standard source codes (APQC 5-digit PCF, O*NET task, GS1-CBV) are **provenance, not the join key**.
- **Crosswalk methodology:** `standards.org.ai` decomposes each standard's activity into SVO (GS1 `Accepting → accept + Goods`), then `mergeVerbsByLemma()` yields one node per lemma, merging when sources agree on `(predicate, object)` — soft provenance reconciliation (ADR 0023 §8), not hard string match. Provenance mix: 823 O*NET/APQC blend · 99 O*NET · 49 schema.org · 39 GS1-CBV · 29 APQC.
- **Critical naming gotcha:** the registry's `inverse` field holds the `*By` **reverse back-reference** (`acceptedBy`), **NOT an antonym** — it maps to our `reverse.by`. The true antonym is absent upstream.
- **No per-verb domain/range** in the registry — Frames must be seeded from the GS1 SVO decomposition or authored.

→ **digital-objects `Verb` grounding work:** (a) reconcile registry `inverse` ↔ our `reverse.by` (and keep our true `inverse` antonym separate); (b) carry the `actor`/`object` nominalizations; (c) widen single `source` → **multi-source `sources[]`** provenance (most verbs blend); (d) ground identity on the **lemma** (`groundedAs` → the verbs.org.ai lemma IRI); (e) Frames are authored/seeded, not pulled from the registry.

## Finding 2 — TWO different "graphdl"s; the in-repo one is NOT deprecated (CORRECTION)

**Correction (2026-06-01):** an earlier pass conflated two distinct things named "graphdl" and wrongly concluded a deprecation / seam-flip. Corrected:

- **`@graphdl/core`** (this repo's `packages/graphdl` — the TypeScript Graph DSL: field-grammar, `-> ~> <- <~` operators, conjugation, inflection, noun metadata, dependency/topology, content-ids) is **NOT deprecated** — it's used in other places. **The earlier "digital-objects extends graphdl" decision stands.** The observation that digital-objects has independently reimplemented parts of it is a *refactor/dedup detail* — whether DO imports `@graphdl/core`'s helpers (notably `canonicalize`/`deriveContentId` for C1, and the topology engine for the cascade Schedule) or carries its own is an **implementation choice to settle later**, NOT grounds to deprecate.
- **The deprecation target is a *different*, older (~6mo) rule-based *semantic parser*** in `graph.org.ai` (`.scripts/graphdl-parser.ts` + the `semantics.org.ai` grammar) — see **Finding 4** and `graphdl-semantic-parser.md`. It is an **upstream ETL concern** (standards → SVO → canonical verbs), and the plan is to replace its hand-rolled rules with an **LLM model**. Unrelated to digital-objects' TypeScript interface.

## Finding 3 — The real cascade `PredicateSpec` confirms D2′

- Real shape (`app/_lib/enrich/matcher.ts`): `{ rel, dstType (plural), fan: 'functional'|'fuzzy', direction: 'direction-bearing'|'similarity-aligned', poolCategory?, madlibQuestion?, closedPool? }`, driving a three-way `find|create|escalate` gate.
- **D2′ confirmed almost exactly:** `fan` is **measured** (#473 avg distinct true-tails/head) then **banded** to `functional`(<3)/`fuzzy`(≥3); `direction` is **declared** per-predicate in a hand-authored canon table (`docs/canon/direction-vs-similarity.md`), grounded in 2026-05-29 embedding measurements. `direction` gates the madlib query-template (asymmetric mode); `fan` gates the regime (adapter-rank vs Flash-Lite ratify). Madlib helps direction-bearing, hurts similarity-aligned/meronymic.
- Authoring is **split across two registries** today: a render manifest (`predicate-manifest.ts`, ~250 verbs — morphology/zone/render, no matching metadata) + the canon matching table (PredicateSpec). PredicateSpec is only wired in tests; production calibration "ran dry."

→ **digital-objects `Frame` relation-role metadata to add:** on relation-bearing roles, carry banded **`fan: 'functional'|'fuzzy'`** (= the `fanRegime` hint from D2′), declared **`direction`**, plus **`closedPool?`**, **`poolCategory?`**, **`madlibQuestion?`**. Keep the plural-`dstType` / singular-`rel` distinction. `PredicateSpec` is then *derivable from a Verb's Frame* — which lets digital-objects **consolidate explore's two split registries** (render manifest + canon table) into one `Verb` (conjugations + Frame), an extraction win.

## Decisions surfaced

1. **`@graphdl/core` stays (NOT deprecated); "digital-objects extends graphdl" holds.** The deprecation target is the *separate* `graph.org.ai` rule-based semantic parser (Finding 4), being switched to an LLM model — an upstream ETL concern, not the TS interface. DO↔`@graphdl/core` dependency direction (import helpers vs coexist) is an implementation detail for the build phase.

### Finding 4 — the rule-based semantic parser (graph.org.ai) → its LLM successor emits `Frame`s
See `graphdl-semantic-parser.md`. Pipeline: `LexiconLoader` (7 TSVs) → tokenizer → POS-by-casing → imperative-template `StatementParser` → `toGraphDL()`. Output: `VerbEntry` (433 lemmas, fixed-string conjugations + role-nouns, **no typed domain/range**) + `ParsedStatement` (`subject?/predicate/object/preposition/complement/modifiers`). It **feeds the canonical verbs** (`parse-graphdl-statements.ts` emits `hasPredicate→verbs.org.ai/{predicate}`, `hasSubject/Object→business.org.ai/Noun/{...}`). Brittle by design (POS-by-casing, regex conjunction-scope failures, complements collapsed into ONE raw-preposition `complement`) — which motivates the LLM switch. **Key tie-in:** `VerbEntry → digital-objects `Verb`` is ~1:1 (`activity`/`event` identical; `actor`/`object`/`inverse`/`source` map cleanly); the gap is exactly that `ParsedStatement` has one untyped `complement` where `Frame` wants 9 typed roles. **So the LLM successor's output schema = digital-objects' `Verb` + `Frame`** — it emits normalized `canonicalForm` + a populated typed `Frame`, closing the registry's "verbs without per-verb domain/range" gap.
2. **Verb grounding to verbs.org.ai** — lemma identity (`groundedAs` → lemma IRI); reconcile registry `inverse` → our `reverse.by` (keep true antonym `inverse` separate); multi-source `sources[]`; carry `actor`/`object` nominalizations; Frames authored, not registry-supplied.
3. **Frame relation-role metadata** — add banded `fan` + declared `direction` + `closedPool?`/`poolCategory?`/`madlibQuestion?`; `PredicateSpec` derivable from the Frame; consolidate explore's split render+match registries into the one `Verb`.
