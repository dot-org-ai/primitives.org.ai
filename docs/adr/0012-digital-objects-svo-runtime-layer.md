# digital-objects becomes the SVO runtime layer over @graphdl/core

**Status:** accepted
**Date:** 2026-06-01

## Context

`digital-objects` (Layer 0) was a "unified storage primitive" carrying ~7,900 LOC,
most of it dormant Cloudflare Durable Object / SQLite storage (`ns`, `ns-client`,
`r2-persistence`, `worker`, `memory-provider`, `ai-database-adapter` — ~2,951 LOC
with no external importers). Storage belongs to `ai-database`'s `DBProvider`
(ADR-0003). The original task (`aip-cnks.8`, Track D of the strategic-primitives-
hardening epic) was narrow: strip the dormant storage, keep the tech-agnostic SVO
ontology, and resolve the `DO()` / `.do` / Durable-Object naming collision.

A `/design-an-interface` pass (4 divergent designs) plus an extended `/grill-me`
session, two `/divergent-brainstorm` rounds (usage + role-completeness), and three
grounding explorations (canonical verb registry, the graphdl semantic parser, and
the real enrichment cascade) showed the cleanup is really a **redesign**:
`digital-objects` should become the **SVO (Subject-Verb-Object) runtime layer** —
the dynamic, instance/fact half of the ontology that `@graphdl/core` (the static
schema DSL) lacks.

Supporting research (informs, does not bind): the role model is grounded in the
generic thematic-role tradition — **VerbNet** thematic roles and **PropBank**
`ArgM` adjunct modifiers — NOT **FrameNet**'s frame-specific frame elements (the
wrong altitude for a reusable runtime). See
`docs/research/2026-06-01-frame-semantics-thematic-roles.md`,
`docs/brainstorms/2026-06-01-digital-objects-svo-usage/`,
`docs/brainstorms/2026-06-01-frameroles-completeness/`, and
`docs/research/2026-06-01-canonical-verbs/`.

## Decision

### 1. digital-objects extends `@graphdl/core`; it does not duplicate or deprecate it

`@graphdl/core` (the TypeScript Graph DSL — `Graph()`, `Noun`, `Verb`+conjugation,
`-> ~> <- <~` operators, linguistics, validation, dependency/topology, content-IDs,
MDXLD `$id`/`$type`) is the **static schema** engine and **stays** (used in other
places). `digital-objects` provides the **runtime/SVO layer on top**: `Frame`,
`Thing`, `Action`, `Event`, `TokenStratum`, the `DigitalObjectsProvider` port, and
rpc-promise pipelining. Its `Verb` **extends graphdl's `Verb`** (keeping the nested
`reverse: { by, at, in, for }` + `actor`/`result` representation — more elegant and
extensible than flat `reverseBy/At/In`). DO may reuse `@graphdl/core`'s
`canonicalize`/`deriveContentId` and topology helpers or carry its own — a build-
phase detail, not a dependency mandate. (An earlier pass wrongly proposed
deprecating `@graphdl/core`; the real deprecation target is a *separate*, older
rule-based **semantic parser** in `graph.org.ai` — see §9.)

### 2. One factory: `Ontology()`. `DO()` and `Noun()` are retired

`Ontology(schema, opts?)` = graphdl's `Graph(schema)` + Frame layering + provider
binding; a pure, storage-agnostic vocabulary (no I/O). Both `DO()` and `Noun()` are
removed, which **dissolves the `DO` naming collision** (no `DO` symbol remains on
the surface; `.do` the brand and Cloudflare Durable Objects no longer clash).
`ai-database`'s `DB(ontology, { provider })` consumes the ontology and adds the
runtime; `ai-workflows` consumes the Verbs' event forms.

### 3. Roles: a 15-role closed core named by 5W+H

Roles answer **who/what/when/where/why/how** plus precise valency. Names are
SVO/English-native; export maps to schema.org where terms overlap, otherwise to
first-class extensions in the **`schema.org.ai`** superset we own (no `do:` prefix).

- **Core valency** (declared per-Verb in its `Frame`): `subject`(who)→`agent`,
  `object`(what), `recipient`(to-whom), `beneficiary`(for-whom, `schema.org.ai`),
  `source`(from)→`fromLocation`, `destination`(to-where)→`toLocation`,
  `instrument`(with/via), `topic`(about), `result`(into).
- **Universal adjuncts** (attach to any Action/Event): `when` & `where`
  (Action-native: `createdAt`/`completedAt`, `location`), `how` (manner — literal,
  optionally value-constrained per verb, e.g. agent oversight
  autonomous/supervised/human-approved/escalated), `why` (cause — an Action/Event
  ref), plus the four additions from the completeness probe: `purpose` (Goal ref,
  forward-looking "in order to"), `authority` (AuthorityBoundary ref, gate-relevant),
  `approver` (accountable Person/Role, RACI-A ≠ subject), `basis` (PROV
  `wasDerivedFrom` — the grounding of a generated fact).

The taxonomy is **closed core + a documented `schema.org.ai` extension path** for
domain-specific roles (`participant`/co-agent held in reserve as the first such
extension). Quantities stay `data`; scalar targets (deadline, priority) are
Action-native fields. Renaming jargon→intuition: `manner`→`how`, `cause`→`why`;
`topic` adopts schema.org's `about`.

### 4. Two-tier Frame shape

- A package-level constant `ROLE_META: Record<FrameRole, { word, preposition,
  surfaceOrder, fillerKind: 'thing'|'action'|'tool'|'literal', dereference:
  'get'|'getAction'|'identity', schemaOrg }>` — the realizer/exporter's single
  source of truth (authors never touch it).
- The per-Verb `Frame` declares only valency: each role is a `NounRef` shorthand or
  a `{ noun, required, direction, fanRegime, enum }` object. Relation-bearing roles
  carry the gate's `PredicateSpec` inputs: **declared `direction`**
  (`direction-bearing|similarity-aligned`) + **banded `fan`**
  (`functional|fuzzy`, the regime hint; the precise fan is *measured* in
  `ai-experiments`, never author-set) + `closedPool?`/`poolCategory?`/`madlibQuestion?`.

### 5. TokenStratum is expressed by string sigils, not function wrappers

The `Frozen()`/`Negotiable()` wrappers are removed. In the field-string grammar
(consistent with graphdl's `!`/`?`/`#`): **`=`** = frozen (identity, set-once),
**`+`** = negotiable (filled exactly once, later). `expression` is the default (no
sigil); `composition` keeps the `{ variants }` object form (it needs data, like
generative `{ mdx }`). Both sigils are plain ASCII (touch-typeable). Strata are
load-bearing economic policy: frozen = identity/dedup key, negotiable = fill-once,
composition = render-time bandit, expression = cheap free-form.

### 6. Action vs Event are two types (first-principles split)

The current model conflates "Events + Relationships + Audit Trail" into one
`Action`. Split them (the Command/operation vs Event distinction; CQRS/DDD):

- **`Event`** — the **immutable, append-only** SVO fact `(subject, verb, object,
  roles, at)`. **The graph and audit trail are made of Events.** Never edited/
  deleted. A settled fact (`Post authoredBy Author`) is a direct `Event`.
- **`Action`** — the **mutable operation/aggregate** (verb + intended roles +
  lifecycle `status`), editable/cancellable; it **emits Events**. This is
  `schema.org/Action` with `actionStatus`. Only for operations with a lifecycle.

`status` (the single mutable field, under a transition guard) lives only on
`Action`: `pending → active → completed|failed|cancelled|quarantined`
(`quarantined` is the findOrCreate escalate band — re-drivable, ≠ `failed`). Events
are statusless. `deleteAction` is removed — a "deletion" is a compensating Action
(the verb's `inverse`). `Action` also carries `correlationId` (saga/trace grouping,
distinct from `why`/cause). The `ai-workflows` verb family already encodes this
split: `send`/`track` emit **Events** (durable / telemetry), `do`/`try` run
**Actions** (await-result / non-durable).

### 7. Identity is content-derived from the `=` (frozen) projection

A Thing's `id` is `deriveContentId(noun, canonicalize(<frozen fields>))` when the
Noun has frozen identity fields (else a random id). The content-derived id **is**
the id — it does three jobs at once (the C1 convergence across event-sourcing,
economics, and KR): the **idempotency key**, the cross-startup **dedup key**, and
the cross-org **global identity** (independent mints of the same canonical entity
collide intentionally). Action/Event ids are content-derived from the SVO tuple,
giving idempotent `perform()`/`emit()`. Frozen + settable-once is what keeps a
content-addressed id stable.

### 8. findOrCreate lives above a minimal storage port

`DigitalObjectsProvider` stays a minimal L0 **storage** port (Thing CRUD, Event
append/get/list, Action create/update/cancel, `related`/`edges`, batch, stratum
metadata, `subscribe`/`close`). The `findOrCreate (link|mint|quarantine)` gate is
**NOT on the port** — its pure decision core lives in `ai-functions`
(`find-or-create.ts`), its live adapter (pgvector ANN + Flash-Lite ratify) in
`ai-database`, surfaced as a thin façade on the entity proxy
(`$.Noun.findOrCreate`) + an `ai-workflows` node. digital-objects owes the gate
only **Frame metadata** (`fan`/`direction` → `PredicateSpec`). Embeddings mode is
inferred from call-site shape (`~>` ⇒ asymmetric MATCH; `Noun.findOrCreate` ⇒
symmetric-centered COLLAPSE), never a global flag.

### 9. Canonical-verb grounding (verbs.org.ai)

`verbs.org.ai` is a published registry of **1,039 canonical verbs** (one
MDX/frontmatter per lemma; six SVO forms `act`/`event`/`activity`/`actor`/`object`/
`inverse`; provenance from APQC PCF / O*NET / GS1-CBV / schema.org; **lemma is the
identity**, standard codes are provenance). digital-objects' `Verb` grounds to it:
`groundedAs?: IRI` → the lemma IRI; **multi-source `sources[]`** (most verbs blend
O*NET/APQC); carry the `actor`/`object` nominalizations; **reconcile the registry's
`inverse` (which is the `*By` reverse back-ref) to our `reverse.by`**, keeping our
true antonym `inverse` separate. The registry ships **no per-verb domain/range**, so
Frames are authored/seeded.

The registry is fed by a rule-based **semantic parser** in `graph.org.ai`
(`.scripts/graphdl-parser.ts` + the `semantics.org.ai` grammar) — Lexicon + POS-by-
casing + imperative-template parsing → SVO. It is brittle (POS-by-casing, regex
conjunction-scope failures, complements collapsed into one raw-preposition
`complement`) and is **the deprecation target: it will be replaced by an LLM
model**. Crucially, `VerbEntry → digital-objects Verb` is ~1:1, and the only gap is
the untyped `complement` vs our typed 9 FrameRoles. **digital-objects' `Verb` +
`Frame` is therefore the output schema of the future LLM semantic parser** — the
LLM emits a normalized `canonicalForm` + a populated typed `Frame`, closing the
registry's missing-domain/range gap.

### 10. Canonical/registry/JSON-LD scope (D4)

Build now (cheap, dependency-free): `$type` IRI on `Noun`; `groundedAs?` on `Verb`
+ mutable `source`/`canonical`; optional slots `subClassOf?`/`subPropertyOf?`/
`deprecated?`/`supersededBy?` (fields only, no engine); and the JSON-LD
`@context`/`@graph` **export** serializer (to `schema.org.ai/Action`). Defer (needs
published registries / multi-org reality): the `verbs.org.ai` registry client,
domain→canonical promotion, the versioning/migration engine, cross-graph merge, and
JSON-LD import. Pre-place the optional slots so deferred engines attach with no type
migration.

## Consequences

- The `DO` naming collision is gone; one factory (`Ontology()`) replaces two.
- digital-objects' public surface becomes a coherent SVO runtime: `Ontology` +
  `Noun`/`Verb`/`Thing`/`Action`/`Event`/`Frame`/`FrameRole`/`TokenStratum` +
  `DigitalObjectsProvider` + rpc-promise — grounded in the thematic-role tradition
  (VerbNet/PropBank), not FrameNet's frame-specific FEs.
- The storage strip (`ns`/`ns-client`/`r2-persistence`/`worker`/`memory-provider`/
  `ai-database-adapter`) still applies; `createMemoryProvider` moves to a test
  surface.
- **Migration touch-points:** consumers importing `Action` must distinguish
  `Action` (mutable) from `Event` (immutable, the graph/audit); `ai-database`'s
  `@graphdl/core` re-export shims are unaffected (no deprecation); the live
  `types.ts` (9 FrameRoles, `manner` as a per-verb enum, no `beneficiary`/`result`)
  migrates to the 15-role 5W+H set with `how`/`why` as universal adjuncts.
- The Frame design is the deliberate target for the LLM semantic parser — work on
  that parser (in `graph.org.ai`) and on digital-objects can proceed against one
  shared schema.
- Research stays out of L0: per-relation `fan` calibration and InfoNCE rankers
  remain in `ai-experiments` behind injected ports; digital-objects carries only
  the declared `direction` + banded `fan` hint.

## References

- Frame semantics / thematic roles: Fillmore's frame semantics & **FrameNet**
  (frame-specific FEs — the altitude we reject); **VerbNet** (generic thematic
  roles — our altitude); **PropBank** (Palmer, Gildea, Kingsbury 2005 — `ArgM`
  modifiers ≈ our 5W+H adjuncts); the SRL integration paper
  [Giuglea & Moschitti, COLING-ACL 2006 (ACL Anthology P06-1117)](https://aclanthology.org/P06-1117/).
  Full digest: `docs/research/2026-06-01-frame-semantics-thematic-roles.md`.
- `docs/research/2026-06-01-canonical-verbs/` (verbs registry, graphdl parser,
  enrich cascade, semantic parser, SYNTHESIS).
- `docs/brainstorms/2026-06-01-digital-objects-svo-usage/` (4-lens usage probe).
- `docs/brainstorms/2026-06-01-frameroles-completeness/` (4-lens role-completeness probe).
- ADR-0003 (storage in ai-database), ADR-0002 (function vs digital-objects registry
  separate), `docs/plans/2026-06-01-strategic-primitives-hardening.md`.
