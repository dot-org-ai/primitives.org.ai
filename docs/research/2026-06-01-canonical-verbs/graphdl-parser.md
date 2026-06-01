# graphdl Semantic Parser — What It Provides, What's Reused, What's Superseded

Scope: `packages/graphdl/` (npm `@graphdl/core@0.4.0`, Layer 0, zero internal deps). Read to inform the `digital-objects` SVO runtime: decide what DO must absorb vs what is already superseded.

## What the parser provides (by module, real signatures)

**`graph.ts` — the field-string parser + `Graph()` DSL (600 LOC).** `Graph(input: GraphInput): ParsedGraph`. Two-pass: pass 1 parses each entity via `parseEntity`; pass 2 auto-materializes inverse relations from backrefs (`Post.author -> User.posts` synthesizes `User.posts: Post[]`). The grammar lives in private `parseField(name, def: string | [string]): ParsedField`:
- **Sigils, parsed right-to-left in any order:** `?` optional, `[]` array, `!` required+unique (sets both `isRequired` and `isUnique`), `#` indexed. Array literal `['->X']` sets `isArray`.
- **Default values:** `type = value` parsed *before* operators (guards against `=` in prompts). `parseDefaultValue` handles quoted strings, numbers, booleans, `null`, `{}`, `[]`, and function calls `now()` → `{ function: 'now' }`.
- **Parametric types** (`PARAMETRIC_TYPES`): `decimal(10,2)` → `{precision,scale}`; `varchar/char/fixed(n)` → `{length}`.
- **Generic types** (`GENERIC_TYPES`): `map<K,V>`, `struct<N>`, `enum<N>`, `ref<T>`, `list<T>`, with `splitGenericParams` respecting nested `<>`.
- **Aliases:** `TYPE_ALIASES` (`bool`→`boolean`).
- **Relation inference:** dotted `Type.field` → relation+backref; bare PascalCase non-primitive → relation without backref.
- **`$`-directives passthrough:** `$type` captured; other `$partitionBy/$index/$fts/$vector` collected into `entity.directives` untouched (IceType/ClickHouse downstream).
Utilities: `getEntityNames/getTypeUris/getEntity/hasEntity/getRelationshipFields/getReferencingEntities`.

**`relationship.ts` — operator semantics (306 LOC).** `parseOperator(def: string): ParsedRelationship | null`. Four operators in `OPERATOR_SEMANTICS`: `->` forward/exact, `~>` forward/fuzzy, `<-` backward/exact, `<~` backward/fuzzy. Parses (in order): leading prompt text (`What category? ~>Category`), fuzzy threshold `~>Category(0.8)` (with malformed-paren recovery), the four sigils, backref `.field`, and union/polymorphic `->A|B|C` → `unionTypes`. Predicates: `hasOperator/getOperator/isForward/isBackward/isFuzzy/isExactOperator`.

**`verb.ts` — conjugation (218 LOC).** `Verbs` = 11 hand-tuned standard verbs (create/update/delete/publish/archive/approve/reject/assign/complete/submit/review), each with `{action, actor, act, activity, result, reverse:{at,by,in,for}, inverse}`. `conjugate(action): Verb` returns the table entry if known, else derives all forms from `linguistic.ts`. Plus `getVerbFields/isStandardVerb/getStandardVerbs`.

**`linguistic.ts` — inflection engine (446 LOC).** Pure rules: `toPastParticiple/toActor/toPresent/toGerund/toResult` (handles `-ate`, `-ify`, `-ize`, `-y`, CVC consonant-doubling via a ~120-word whitelist), `pluralize/singularize` (irregulars map + regular rules), `capitalize/preserveCase/isVowel/splitCamelCase/toKebabCase`.

**`noun.ts` — noun metadata (201 LOC).** `inferNoun(typeName): Noun` (singular/plural via camel-split + pluralize, default CRUD actions/events). `defineNoun(opts)`, `createTypeMeta(name): TypeMeta` (slug, slugPlural, creator/createdAt/created event names), cached `getTypeMeta`, `Type(name)` proxy, `clearTypeMetaCache`.

**`dependency-graph.ts` — topology (504 LOC).** `buildDependencyGraph(schema): DependencyGraph` (hard deps from `->`; soft deps from `~>`/`<~`/optional; `<-` creates no generation dep). `topologicalSort(graph, root, ignoreOptional?)` (DFS, throws `CircularDependencyError` with `cyclePath`), `detectCycles`, `getParallelGroups` (Kahn in-degree waves), `getAllDependencies`, `hasCycles`, `visualizeGraph`. `PRIMITIVE_TYPES` set (the leaf-vs-reference oracle, shared by graph + validate).

**`validate.ts`** — `validateGraph/validateEntity`: unknown-type, unknown-relation-target, directive-field-existence, conflicting-modifier (`!`+`?`) checks.

**`ids/` — content-derived IDs (the genuinely portable asset).** `deriveContentId(type, input, {prefix:12|16}): "{type}_{hex}"` = `sha256(canonicalize(input)).slice(0,prefix)`; `deriveContentHash`; `canonicalize(value): string` (recursive key-sort, array-order-preserving, Date→ISO, NaN/Inf→null, drop-undefined — deterministic across processes); `migrateFromFnv1a[Batch]`. Type tag is *not* mixed into the hash. Exposed at root and `@graphdl/core/ids`.

## Load-bearing reused surface (what breaks on deprecation)

Only **`ai-database`** depends on `@graphdl/core` in this monorepo, and it re-exports almost the whole surface for backward-compat:
- `ai-database/src/linguistic.ts` re-exports `conjugate, pluralize, singularize, inferNoun, createTypeMeta, getTypeMeta, Type, getVerbFields` + all 10 low-level inflectors.
- `ai-database/src/types.ts` re-exports types `Verb, VerbReverse, Noun, NounProperty, NounRelationship, TypeMeta, PrimitiveType` and value `Verbs`.
- `ai-database/src/schema/parse.ts` calls `parseOperator` (aliased `graphdlParseOperator`) as its relationship parser.
- `ai-database/src/schema/dependency-graph.ts` re-exports the entire dependency-graph module (`buildDependencyGraph, topologicalSort, detectCycles, getParallelGroups, getAllDependencies, hasCycles, visualizeGraph, CircularDependencyError, PRIMITIVE_TYPES`, types) under `SchemaDep*` aliases.
The `ids/` content-id helpers are designed for *sibling repos* (icps/services-builder/startup-builder per `derive.ts`); **no in-repo consumer imports them yet** (grep finds zero callers outside graphdl).

## Already superseded by digital-objects (do NOT carry forward)

`digital-objects` already exists and has independently re-implemented most of graphdl's parser surface — and the strategic-hardening plan (`docs/plans/2026-06-01-strategic-primitives-hardening.md`) names `digital-objects` and `@graphdl/core` as co-located L0 foundation, with DO as the canonical home:
- **`digital-objects/src/linguistic.ts`** declares itself "THE CANONICAL SOURCE for linguistic utilities… graphdl pioneered many of these helpers — they are now unified here." It ports the same inflectors and adds `deriveVerb(name)` returning `{action, act, activity, **event**, reverseBy, reverseAt}` with an *irregular past-participle* table (write→written, etc.) graphdl lacks.
- **`digital-objects/src/noun-parse.ts`** re-implements the field/operator/enum/verb-declaration parser (same `-> ~> <- <~`, `!?#`, `enum(...)`, `= default`), adding verb-declaration detection (`qualify: 'Qualified'`) and `null` = disabled-CRUD.
- **`digital-objects/src/noun-verbs.ts`** owns the CRUD/read-verb model; verbs carry an `event` form, not graphdl's `result` noun.
- **`digital-objects/src/token-strata.ts`** introduces the `Frozen/Negotiable/Expression/Composition` stratum sigils (the SVO `=`/`+` strata) — orthogonal to and *replacing* graphdl's `!?#` identity story.
- The SVO co-design (`docs/plans/2026-05-05-svo-co-design.md`) commits to `Verb{conjugations, frame: Frame, source, canonical}` + `Action{verb, subject, object, roles}` with a closed 10-role Frame taxonomy — a richer model than graphdl's flat `Verb`. graphdl's `Verbs` table, `inferNoun`, `createTypeMeta`, and the prompt/threshold relationship extras are all subsumed or reframed.

**Net: graphdl's parser, conjugation, inflection, and noun-metadata are already duplicated/superseded inside digital-objects.** The only thing with no DO equivalent is `ids/` (content-id) and the standalone `dependency-graph.ts` topology engine.

## Absorb-vs-Drop migration surface

| graphdl module / export | Status vs digital-objects | Action if graphdl deprecated |
|---|---|---|
| `ids/` `deriveContentId`, `canonicalize`, `deriveContentHash`, `migrateFromFnv1a*` | **No DO equivalent.** SVO commits to content-id over frozen fields → DO needs this. | **ABSORB** into digital-objects (e.g. `digital-objects/ids` subpath). Pure, zero-dep, portable. Highest-priority. |
| `dependency-graph.ts` (topo/cycles/parallel-groups/`PRIMITIVE_TYPES`) | No DO copy; re-exported wholesale by `ai-database`. Matches the SVO/cascade "Schedule" seam. | **ABSORB or RE-HOME** (DO or a shared L0 schedule module). `ai-database` must repoint its re-export. |
| `linguistic.ts` inflectors | **Superseded** — DO is canonical source, adds irregulars + `deriveVerb`. | **DROP.** Point `ai-database/linguistic.ts` at digital-objects. |
| `verb.ts` `Verbs` / `conjugate` / `getVerbFields` | **Superseded** — DO `noun-verbs` + `deriveVerb` (`event`-shaped, frame-aware). | **DROP** (optionally migrate the 11-verb table's `inverse`/`result` data if still wanted). |
| `noun.ts` `inferNoun`/`defineNoun`/`createTypeMeta`/`Type` | **Superseded** — DO `Noun()`/`noun-registry`/`noun-proxy`. | **DROP** (migrate `TypeMeta` field-name conventions if `ai-database` still needs them). |
| `relationship.ts` `parseOperator` (+ predicates) | **Superseded** — DO `noun-parse` parses the same operators; `ai-database` currently imports graphdl's. | **DROP**, but `ai-database/schema/parse.ts` must switch to DO's parser (behavioral-parity test needed: prompt-prefix, threshold, union, malformed-paren cases). |
| `graph.ts` `Graph()` + field grammar + `$`-directives | **Mostly superseded** by DO `noun-parse` + `token-strata`; `$partitionBy/$index/$fts/$vector` passthrough has no DO equivalent yet. | **DROP** the DSL; **ABSORB** the directive-passthrough convention if IceType/ClickHouse targeting survives. |
| `validate.ts` `validateGraph` | DO has `schema-validation.ts`. | **DROP** (reconcile error codes). |
| Types `ParsedField/ParsedEntity/ParsedGraph/ParsedRelationship` | DO has its own `noun-types`/`types`. | **DROP**; `ai-database` re-exports must repoint. |

**Migration surface summary:** the only *new* code digital-objects must own is (1) the **content-id derivation** (`canonicalize` + `deriveContentId`) — exact, portable, drop-in; and (2) the **dependency/topology engine** (or re-home it as a shared L0 module the cascade Schedule consumes). Everything else — field-string parser, operator parser, conjugation, inflection, noun metadata, validation — is already reimplemented in digital-objects and should be *dropped*, not carried forward. The blast radius is entirely inside `ai-database`, which re-exports graphdl's linguistics, `Noun/Verb` types, `parseOperator`, and dependency-graph; its three re-export shims must repoint to digital-objects (linguistics/verbs/parser) and to the absorbed topology/ids modules. The SVO `=`/`+` strata, Frame 5W+H roles, Action/Event split, and content-id-over-frozen-fields are the explicit *not-carry-forward* boundary — graphdl's `!?#` sigils, flat `Verb`, and `result`-noun conjugation are the superseded predecessors.
