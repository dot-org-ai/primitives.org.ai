# explore.startups.studio enrichment cascade — predicate/verb metadata, reconciled against digital-objects' Verb/Frame

Source: `/Users/nathanclevenger/projects/explore.startups.studio` (main branch, not worktrees). Most-recently-modified enrich files: `app/_lib/enrich/{matcher,reverse-mint,thresholds}.ts` (2026-05-30), the canon `docs/canon/direction-vs-similarity.md` (#585, the authoring surface), and `scripts/cascade-gen/loop*.ts` (2026-05-31). The committed digital-objects design under review: `packages/digital-objects/src/types.ts` (`Verb`, `Frame`) plus the 2026-06-01 brainstorm `docs/brainstorms/2026-06-01-digital-objects-svo-usage/` (SYNTHESIS + lens-C).

## 1. The real `PredicateSpec` shape (quoted)

`PredicateSpec` is the keystone struct the matcher gate reads (`app/_lib/enrich/matcher.ts:88`):

```ts
export type FanRegime = "functional" | "fuzzy";          // fan<3 vs fan≥3
export type DirectionClass = "direction-bearing" | "similarity-aligned";

export interface PredicateSpec {
  rel: string;              // rel as it lands in `rels` (singular-dst convention), e.g. "producedBy"
  dstType: string;          // destination Noun DB label (PLURAL), e.g. "Industries" — scopes pool + threshold lookup
  fan: FanRegime;           // measured/estimated regime — picks functional vs fuzzy matching
  direction: DirectionClass;// gates the madlib query-template
  poolCategory?: string;    // graph category the functional pool is constrained by (e.g. a NAICS sector)
  madlibQuestion?: string;  // ONLY used when direction === "direction-bearing"; single {name} placeholder
  closedPool?: boolean;     // closed enum/reference predicate (e.g. the 33-node KSAO set) — NEVER mints
}
```

Note the regime is **two-banded** (`FanRegime` is a string union `functional|fuzzy`, NOT a raw number) and direction is a **two-value class**, not a boolean. `dstType` is plural ("Industries"), distinct from the singular-dst rel convention ("producedBy"). The decision core (`decideMatch`) returns one of three verdicts — `"find" | "create" | "escalate"` — which is the FIND|CREATE|ESCALATE gate the strategic-9 linchpin describes.

## 2. How `fan` and `direction` are determined/used

This validates the **D2′ decision (direction declared, fan measured)** — and the codebase confirms it almost exactly:

- **`fan` is MEASURED**, then banded. The header comment: `fan = avg distinct true-tails per head (#473, measured); functional < 3, fuzzy ≥ 3`. So a per-relation *number* is computed offline (the #473 measurement over real edges), then collapsed to the `functional|fuzzy` band that `PredicateSpec.fan` carries. The Spec stores the **band**, not the raw count — the matcher only needs the regime.
- **`direction` is DECLARED**, per-predicate, in a hand-authored canon table. `docs/canon/direction-vs-similarity.md` is the authoring surface: a ratified table (#585) with one row per generative-frontier predicate, each tagged `direction-bearing` or `similarity-aligned`. It is explicitly *"a measured gate, not a heuristic"* but the per-predicate verdict is **authored/curated** (grounded in 2026-05-29 head-holdout embedding measurements: antonym +0.073, hyponym +0.070, p=0; `composedOf`/hypernym/holonym all HURT under madlib). New predicates are classified by the rule *"does similarity differ from direction for this (src,dst) shape?"* and added to the table before first wired run.
- **`direction` gates the madlib**, `fan` gates the regime. These are orthogonal axes — a predicate is independently `{functional|fuzzy}` × `{direction-bearing|similarity-aligned}`.

## 3. Predicate authoring vs runtime

There are **two distinct verb/predicate registries** in the real repo, and they do different jobs:

- **`app/_lib/predicate-manifest.ts` (the RENDER manifest, `PredicateConfig`)** — ~250 verb entries, the *display* surface. Carries `zone`, `rank`, `render`, `eyebrow`, `label`, `reverse` (morphology pairing, e.g. `partOf↔hasParts`), `symmetric`, `itemprop` (schema.org), `fromFacetDimension`, `dedupWithGraphRel`, `lifecycleOnly`. This is where verb *conjugation/morphology* lives (the `reverse` field pairs forward/inverse lemmas; symmetric verbs point to self). **It carries NO `fan`/`direction`/`madlib`** — rendering doesn't need the matching regime.
- **`docs/canon/direction-vs-similarity.md` + `PredicateSpec` (the MATCHING surface)** — the `fan`/`direction`/`poolCategory`/`madlibQuestion`/`closedPool` metadata the gate reads. Authored in the canon table; consumed (today, only in `matcher.test.ts` — the production wiring that populates `PredicateSpec` from the canon table does not exist yet; calibration "ran dry for lack of seeded ground truth").

So the real authoring surface is **split**: morphology+render in one manifest, match-regime in a separate canon table. The runtime gate needs *both* sets of facts but they are not co-located today.

## 4. The matcher / findOrCreate integration

Three layers compose, cheapest-first (matcher.ts header + `findorcreate.ts`):

1. **`findorcreate.ts`** — pure, deterministic: exact `(type,slug)` match → normalized-name collapse ("Finance Dept"≈"Finance Department"≈"Finance") → else CREATE. Catches cheap exact/near-name dupes. Returns `"find" | "create"`.
2. **`reconcile-pure.ts`** — cosine-cluster collapse (symmetric-centered) above name-normalization.
3. **`matcher.ts` `decideMatch`** — the hard embedding-grounded match. Reads `PredicateSpec.fan` to pick regime:
   - **functional** (`fan<3`): pool-constrain by graph category → InfoNCE adapter-RANK (asymmetric mode) → accept only if `top.score ≥ acceptScore` AND clears `marginOverRunnerUp` (two near-ties → escalate). Below floor in a *populated* pool → escalate, never auto-mint.
   - **fuzzy** (`fan≥3`): propose top-k (`DEFAULT_FUZZY_TOP_K=5`) → Flash-Lite RATIFY → accept if `confidence ≥ ratifyFloor`, else escalate.
   - **empty constrained pool**: open predicate → CREATE (greenfield); `closedPool` predicate → ESCALATE (never mints — absorb the off-rail name).

The madlib is direction-gated at query-build (`buildMatchQuery`, matcher.ts:232): `direction-bearing` + `madlibQuestion` present → instantiate the question (`{name}` substitution); otherwise rank on the **bare candidate name**. Two embedding modes are constants that cannot be flipped: `MATCH_MODE="asymmetric"`, `COLLAPSE_MODE="symmetric-centered"` — the matcher refuses to run a match in collapse mode. Uncertainty *always* fails toward escalate/create, never a wrong collapse. `reverse-mint.ts` reuses the same matcher for Phase-C inbound edges (the reversal curse is mild, cos 0.96, so forward embeddings are reused). `MatchThreshold` is an injected port (`ThresholdLookup`) returning `{acceptScore, marginOverRunnerUp?, ratifyFloor?}`; when uncalibrated it returns `undefined` → conservative defaults (`DEFAULT_FUNCTIONAL_ACCEPT=0.85`, `DEFAULT_FUNCTIONAL_MARGIN=0.05`, `DEFAULT_FUZZY_RATIFY_FLOOR=0.8`).

## 5. What digital-objects' Verb/Frame must match

The committed digital-objects types (`packages/digital-objects/src/types.ts`):

```ts
export interface Verb {            // lines 150-165
  name; action; act; activity; event;            // conjugations
  reverseBy?; reverseAt?; reverseIn?; inverse?;   // reverse forms + inverse lemma
  description?; frame?: Frame; source?: VerbSource; canonical?: boolean; createdAt;
}
export interface Frame {           // lines 110-120
  subject: NounRef | 'any';
  object?; recipient?; source?; destination?; instrument?; topic?; cause?; manner?;
}
```

The graphdl `Verb` (`packages/graphdl/src/types.ts:115`) is the same family — `action/actor/act/activity/result/reverse/inverse` — pure conjugation/morphology, no matching metadata.

**Reconciliation — what matches, what is missing:**

- ✅ **Conjugations** — fully present and *richer* than the cascade needs. The real render manifest only uses `reverse`/`symmetric`/morphology pairing; digital-objects' `Verb` covers that (`inverse`, `reverseBy/At/In`). Match.
- ✅ **Frame / SVO roles** — digital-objects' `Frame` (subject/object/…/instrument/cause/manner) is the (src→dst) shape the canon table's "Subject→Object frame" column expresses informally. `Frame.subject`/`Frame.object` map onto `PredicateSpec`'s src/dst. Good fit.
- ❌ **`fan` and `direction` are NOT on the committed `Verb`/`Frame`.** This is the central gap. The lens-C demand is explicit (`lens-C-economics-findorcreate.md:77`): *"`Frame` carries per-relation `fan` (numeric/banded) and `direction` (direction-bearing|similarity-aligned)" so the gate reads regime off the frame, not runtime sampling. `PredicateSpec.{rel,dstType,fan,direction,closedPool?}` must be derivable from a Verb's Frame."* The SYNTHESIS (line 72) ratifies this: Frame graduates to carry `fan`/`direction` on relation-bearing roles. **So the committed design's *intent* matches real usage, but the committed *code* has not yet added the fields.** D2′ (direction declared / fan measured-then-banded) is exactly what the real repo does — the digital-objects fields should be: `direction: 'direction-bearing'|'similarity-aligned'` (declared) and `fan: FanRegime` (a banded `functional|fuzzy`, populated from the measured #473 number).
- ❌ **`closedPool?: boolean`** — needed verbatim (the KSAO/`mode:"reference"` closed-enum case where an empty pool escalates, never mints). Not present.
- ⚠️ **`madlibQuestion?` and `poolCategory?`** — the real matcher needs these per-relation. `madlibQuestion` is *derivable* from `direction` + the (src→dst) frame (the canon table authors one question string per direction-bearing row), and `poolCategory` is the graph-category pool constraint (NAICS sector, etc.). digital-objects' Frame could carry these as optional per-relation-role fields, or leave them to a separate `PredicateSpec` projection — but they must be *reachable* from the Verb/Frame.
- ⚠️ **`dstType` plural vs singular-rel convention** — the real spec keeps rel singular ("producedBy") and dstType plural ("Industries"). digital-objects' `Frame.object: NounRef` should preserve this distinction so the pool/threshold lookup keys line up.
- ⚠️ **Three-way decision + status** — lens-C also demands `Action` carry a `quarantined`/`escalate` status distinct from `failed` (the ESCALATE branch is a deferred decision, not an error). Committed `ActionStatus` (pending/active/completed/failed/cancelled) lacks it.

**Bottom line:** digital-objects' committed `Verb`/`Frame` matches real usage on **conjugations and SVO frame roles**, and the *committed design intent* (SYNTHESIS/lens-C) matches D2′ precisely. The concrete gap is that the matching metadata the real cascade gate *requires* — `fan` (banded), `direction` (declared), `closedPool`, plus reachable `madlibQuestion`/`poolCategory`/plural-`dstType` — is specified-but-not-yet-on-the-struct. The minimum to make a digital-objects `Verb.frame` drive the real FIND|CREATE|ESCALATE gate is: add `fan: FanRegime` + `direction: DirectionClass` + `closedPool?` to relation-bearing Frame roles, ensure `PredicateSpec.{rel,dstType,fan,direction,closedPool}` projects from the Frame, and add a quarantine Action status.
