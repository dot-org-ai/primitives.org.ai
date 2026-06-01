# The Canonical Verb Registry (verbs.org.ai) — Structure & What `digital-objects` Must Accommodate

Research date: 2026-06-01. Sources: `standards.org.ai` (the crosswalk pipeline that *generates* the
verb set), the published `verbs.org.ai` package (`/Users/nathanclevenger/platform/ai/packages/verbs.org.ai`),
the curated `Language.Verbs.tsv` + its parser in `explore.startups.studio`, and ADR 0023
(`explore.startups.studio/docs/adr/0023-value-flow-offering-model-and-first-class-verbs.md`). The empty
`graph.org.ai/.org.ai/verbs.org.ai` is a placeholder only.

## 1. The shape of a canonical Verb entry

The registry's atomic unit is **one MDX file per lemma** in
`packages/verbs.org.ai/data/<lemma>.mdx` (1,039 files). The YAML frontmatter *is* the structured record;
the markdown body is human prose + TypeScript usage examples (non-load-bearing). Real example
(`data/accept.mdx`):

```yaml
$type: Verb
$id: accept
$context: https://verbs.org.ai
name: accept
canonicalForm: accept
source: https://ref.gs1.org/cbv/2.0.0/
vocabulary: CBV 2.0
description: Accepting receipt of goods or materials
act: accepts          # 3rd person singular (the "predicate")
event: accepted       # past participle
activity: accepting   # gerund / present participle
actor: Accepter       # agent nominalization
object: Acceptance    # patient/result nominalization
inverse: acceptedBy   # back-reference (*By) form — see naming caveat below
```

The build (`scripts/build-verbs.ts`) validates every file against a Zod `VerbConjugationSchema` and emits
`src/verbs.generated.ts` — a frozen `VERB_DATA` object (`as const satisfies Record<string, VerbConjugation>`)
plus runtime helpers (`isVerb`, `getVerbConjugation`, `getAllVerbs`, `getVerbCount`, `VERBS`, `VERB_CONJUGATIONS_MAP`).
Build hard-fails unless exactly 1,039 verbs parse. The published `VerbConjugation` interface is the canonical
contract:

```ts
interface VerbConjugation {
  $type: 'Verb'; $id: string; $context?: string
  name: string; canonicalForm?: string
  source?: string;      // provenance URL
  vocabulary?: string;  // human label, e.g. "CBV 2.0"
  description?: string
  act: string; event: string; activity: string; actor: string; object: string; inverse: string
}
```

**Six semantic forms** per verb — these are exactly the SVO "madlib" projections Business-as-Code uses:
`act` (predicate, `$.User.analyzes.Data`), `activity` (`$.User.analyzing.Data`), `event`
(`on($.Order.accepted, …)`), `actor` (agent role noun), `object` (result/concept noun), `inverse`
(passive back-reference, `$.Data.analyzedBy.User`).

**Naming caveat (load-bearing).** The frontmatter field named `inverse` does **not** hold an antonym — it
holds the `*By` *reverse back-reference* (`acceptedBy`). The `explore.startups.studio` parser documents this
explicitly (`parse.ts`, `VERB_COLUMNS`): the TSV/MDX column labeled `inverse` maps to CONTEXT.md's `reverse`,
and a true antonym (`inverse`) is *absent in the source* and reserved for later. Any consumer must treat
registry `inverse` as `reverseBy`, not as a semantic opposite.

## 2. Scale & organization

- **1,039 verbs** in the published package (the package.json/README still say 209/217 in stale copy — the
  data dir and `build-verbs.ts`'s `EXPECTED_VERB_COUNT` both say 1,039).
- **One file per lemma**, named by the lemma (`accept.mdx`, `analyze.mdx`, `reconcile.mdx`). Flat namespace,
  no sub-grouping; the lemma *is* the key (camelCased for multi-word lemmas, e.g. `reconcileInvoice`).
- **File format:** MDX (`.mdx`) with YAML frontmatter for the package; the upstream curated source is a
  10-column TSV (`Language.Verbs.tsv`, header: `canonicalForm, description, predicate, event, activity,
  actor, object, inverse, source, vocabulary`).
- **Provenance distribution** across the 1,039 (by `vocabulary`): O*NET/APQC blend 823 (`source:
  https://tasks.org.ai`), O*NET 28.0 99, Schema.org 27.0 49, GS1 CBV 2.0 39, APQC PCF 7.0 29. So the bulk is
  the merged occupational-task / process verb spine; GS1-CBV and Schema.org are the smaller, sharply-typed
  contributors.

## 3. Crosswalk methodology — how N standards become ONE verb identity

`standards.org.ai` is a normalization pipeline: raw source data (`.source/<Standard>/`) → transform scripts
(`.scripts/<standard>.ts`, Bun) → uniform 8-column TSV (`.data/`), with cross-standard `sameAs` links and
relationship files (`.crosswalks/`, e.g. `Industry.Occupation.tsv`, `Occupation.Task.tsv`). For verbs
specifically, the merge rule (ADR 0023 §8, "multi-source `sameAs` merge"):

1. **Decompose each standard's activity into SVO.** GS1's `GS1.BusinessStep.VerbMapping.tsv` is the clearest
   evidence: a gerund business step is split into `verb + noun(object)` — `Accepting → accept + Goods`,
   `Shipping → ship + Goods`, `CycleCounting → count + Inventory`, `RetailSelling → sell + Products`. GS1
   dispositions map to verbs too (`Active → activate`, `NonConformant → reject`, `Returned → return`). GS1
   gerunds are normalized to camelCase lemmas on ingest (`Supplies_To → suppliesTo`).
2. **Merge by lemma.** `mergeVerbsByLemma()` (in `explore.startups.studio/app/_lib/standards/parse.ts`)
   produces **one node per camelCase lemma**, accumulating provenance across vocabularies. ADR 0023 phrases
   the merge condition as: identities merge across Standards "when sources agree on `(predicate, object)`"
   (the reconciliation phase, ADR 0019) — a **soft merge via provenance**, deliberately *not* a brittle
   hard string match against the closed CBV.
3. **Field-fill + provenance accumulation.** On merge, the first row to define a morphology slot wins
   (sources agree in practice); the **longest description wins**; and **every contributing source is kept**
   in a `sources: { vocabulary, url }[]` array. So a single canonical lemma can simultaneously carry O*NET,
   APQC, GS1-CBV, and Schema.org provenance — but the published MDX flattens this to a single `source`/`vocabulary`
   pair (the merge currently loses the multi-source array on the way into MDX; the TSV/parser preserves it).

**Four projections of one Verb namespace** (ADR 0023 §2): `Task` (O*NET, Subject=Worker), `Process` (APQC,
Subject=Org), `BizStep` (GS1/EPCIS, Object + `where`=Location), `Service` (UNSPSC/NAPCS, market offering).
These are *lenses on the same verb*, not separate verbs — the canonical identity is the lemma; the standard
is provenance + a focal Frame role.

## 4. Identity scheme

- **Primary key = the camelCase lemma** (`accept`, `reconcileInvoice`), used as `$id`, `name`, filename, and
  `VERB_DATA` key. Stable, label-derived, human-readable.
- **Source codes are provenance, not identity.** APQC 5-digit PCF element IDs, O*NET task codes, and GS1-CBV
  URIs travel as `source`/`vocabulary` (and, in the TSV form, in the `sources[]` array) — they are *not* the
  join key. The lemma is. This is the inverse of the Noun side of `standards.org.ai`, where `code` (e.g. the
  NAICS/UNSPSC/APQC `pcfId`) *is* the join key. Verbs unify on the linguistic lemma; Nouns unify on the code.
- `$context: https://verbs.org.ai` is the namespace IRI; full IRI is `https://verbs.org.ai/<lemma>`.

## 5. What `digital-objects`' `Verb`/`Frame` must accommodate

`digital-objects/src/types.ts` *already* models the target shape — it is ahead of the registry. It defines
`Frame`, `FrameRole`, `VerbSource = 'verbs.org.ai' | 'apqc' | 'onet' | 'domain'`, and a `Verb` with
`frame?`, `source?`, `canonical?`. The runtime `VerbConjugation` (`noun-types.ts`) is still purely
*generative* (`deriveVerb()` synthesizes `action/act/activity/event/reverseBy/reverseAt` locally), and a code
comment notes none of `verbs.org.ai`/`tasks.org.ai`/`process.org.ai` are published yet, so everything defaults
to `source: 'domain'`, `canonical: false`. To *ground against* the real registry, the package must:

1. **Map field names across the naming gap.** Registry `act` ≙ digital-objects `act`; registry `activity`/`event`
   align; registry `actor`/`object` (nominalizations) have **no home** in the current `Verb` and should be
   added (they are the role/concept noun forms the SVO madlib needs). Critically: registry `inverse` ≙
   digital-objects `reverseBy` (the `*By` form) — **not** `Verb.inverse` (which digital-objects reserves for
   the true antonym, currently always absent upstream). Wiring registry `inverse → Verb.inverse` would be a
   semantic bug.
2. **Accept lemma-as-identity + camelCase.** `groundedAs` should point at the registry lemma/`$id`
   (`https://verbs.org.ai/<lemma>`); multi-word grounding must survive camelCasing (`reconcileInvoice`).
3. **Carry multi-source provenance.** `VerbSource` is currently a 4-value enum with a single `source`. The
   registry's identity is *the union of sources* (O*NET + APQC + GS1-CBV + Schema.org). To consume the TSV
   faithfully, `source` wants to become a multi-valued `sources: { vocabulary, url, code? }[]` (matching the
   parser's `ParsedVerb.sources`), with the enum kept as a coarse tag. `canonical: true` flips on when a verb
   is grounded to a registry lemma vs. locally derived.
4. **Populate `Frame` from the projection's focal role.** The registry doesn't ship per-verb domain/range
   slots, but the GS1 SVO decomposition supplies the **object** (`accept`→`Goods`, `ship`→`Goods`,
   `count`→`Inventory`) and ADR 0023 supplies the role taxonomy. `Frame` (`subject`, `object`, `recipient`,
   `source`, `destination`, `instrument`, `topic`, `cause`, `manner`) is the right valency container; grounding
   should seed `frame.object` from the GS1 noun and `frame.destination`/`where`(Location) for BizStep verbs.
   `digital-objects`'s `FrameRole` superset already covers EPCIS's What/Where/Who/recipient roles.
5. **Tolerate registry imperfections:** stale counts (209 vs 1,039), the flattened single-`source` in MDX vs
   the richer multi-source TSV, the de-glued-row data defense in the parser, and the *absent antonym*. Ground
   defensively — registry presence sets `canonical`, absence falls back to `deriveVerb()`.

**Bottom line:** the canonical registry is a flat, lemma-keyed set of ~1,039 six-form SVO verbs, merged
across O*NET/APQC/GS1-CBV/Schema.org by lemma with soft provenance reconciliation, identity = lemma (codes
are provenance). `digital-objects` already has the right primitives (`Verb` + `Frame` + `VerbSource` +
`canonical`/`source`); grounding work is (a) the `inverse`↔`reverseBy` name reconciliation, (b) adding
`actor`/`object` nominalizations, (c) widening `source` to multi-source provenance, and (d) seeding `Frame`
object/destination from the GS1 SVO decomposition rather than expecting the registry to ship per-verb
domain/range.
