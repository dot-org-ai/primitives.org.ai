# The graph.org.ai Rule-Based Semantic Parser — Pipeline, Output, and the LLM Successor

Scope: the **upstream ETL parser** in `graph.org.ai/.scripts/graphdl-parser.ts` and the feeder/batch scripts around it. This is the rule-based engine that decomposes standards activity statements (APQC processes, O*NET tasks, GS1/NAPCS services) into SVO. It is **distinct** from the `@graphdl/core` TypeScript DSL package (covered in `graphdl-parser.md` in this folder — do not conflate them). This document covers the pipeline, the `VerbEntry`/output shape, the grammar and its brittleness, how it feeds canonical verbs, and what an LLM successor would emit to populate `digital-objects` Frames.

## 1. End-to-end pipeline

`/Users/nathanclevenger/projects/graph.org.ai/.scripts/graphdl-parser.ts` is a hand-rolled NLP pipeline. The `GraphDLParser` facade chains five rule-based stages:

1. **`LexiconLoader`** reads seven TSV files from `.source/Language/` (`Language.Verbs.tsv`, `.Concepts.tsv`, `.Prepositions.tsv`, `.Conjunctions.tsv`, `.Determiners.tsv`, `.Pronouns.tsv`, `.Adverbs.tsv`) into a `Lexicon` of `Map`s/`Set`s. Verbs are indexed by **every conjugation** (`canonicalForm`, `predicate`, `event`, `activity`) so any inflected surface form resolves to the same `VerbEntry`.
2. **`Tokenizer`** splits on a regex keeping words (with apostrophes), punctuation, and slashes.
3. **`POSTagger`** assigns one POS per token via lexicon lookup, with two *orthographic fallbacks* that are pure GraphDL convention: **TitleCase → `NOUN`**, **lowercase/camelCase → `UNK-VERB`**. Anything unmatched becomes `UNK`.
4. **`StatementParser`** runs the grammar: concept normalization → conjunction/slash/Oxford-comma detection → single-statement SVO extraction (`parseSingle`).
5. **`GraphDLParser.toGraphDL()`** serializes the parse to dot-notation, with conjunction expansions appended in `[...]`.

The batch feeders (`.scripts/batch-parse-apqc.ts`, `parse-all-apqc.ts`, `.scripts/batch-parse-onet.ts`) instantiate the parser, iterate a source TSV's `name`/`task` column, call `parser.parse(name)` + `parser.toGraphDL(parsed)`, and emit `.output/APQC.Processes.GraphDL.tsv` plus an `.output/APQC.UnknownWords.tsv` vocabulary-gap report (the `UnknownWordAnalyzer` ranks unknown tokens by frequency and guesses POS from casing — the human-in-the-loop signal for expanding the lexicon).

**Real input → output** (from the CLI test harness, lines 768-774):

```
Input:  "Develop Vision and Strategy"
parse → { predicate: "Develop", object: "Vision and Strategy",
          hasConjunction: true,
          expansions: [ {predicate:"Develop", object:"Vision"},
                        {predicate:"Develop", object:"Strategy"} ] }
toGraphDL → "Develop.Vision.and.Strategy [Develop.Vision,Develop.Strategy]"
```

```
Input:  "Define the business concept and long-term vision"
        (concept normalization rewrites "business concept"→BusinessConcept,
         "long-term vision"→LongTermVision via Language.Concepts.tsv)
parse → predicate:"Define", object:"BusinessConcept and LongTermVision"
toGraphDL → "Define.BusinessConcept.and.LongTermVision [Define.BusinessConcept, Define.LongTermVision]"
```

## 2. The `VerbEntry` and output shape (the FRAME)

There are **two** distinct "verb/output" shapes in this codebase:

**(a) `VerbEntry` — the lexicon entry**, loaded from `Language.Verbs.tsv` (433 rows). The TSV header is `canonicalForm  description  predicate  event  activity  actor  object  inverse  source  vocabulary`, e.g.:

```
acquire | Obtain or purchase... | acquires | acquired | acquiring | Acquirer | Acquisition | acquiredBy | https://www.apqc.org/ | APQC PCF 7.0
accept  | Accepting receipt...  | accepts  | accepted | accepting | Accepter | Acceptance | acceptedBy | https://ref.gs1.org/cbv/2.0.0/ | CBV 2.0
```

```ts
export interface VerbEntry {
  canonicalForm: string  // 'acquire'      (lemma / dictionary form)
  predicate: string      // 'acquires'     (3rd-person present)
  event: string          // 'acquired'     (past participle — the event key)
  activity: string       // 'acquiring'    (gerund / process noun)
  actor: string          // 'Acquirer'     (agentive noun)
  object: string         // 'Acquisition'  (result/objectified noun)
  inverse: string        // 'acquiredBy'   (passive/reverse relation)
}
```

This is a pre-computed **conjugation + role-noun bundle** per canonical verb. Crucially it carries `actor`/`object`/`inverse` — the seeds of a frame — but as fixed strings, **not** as typed domain/range slots. The provenance columns (`source`, `vocabulary`) tag each verb's standards origin (GS1 CBV, Schema.org Action, APQC PCF).

**(b) `ParsedStatement` — the per-statement SVO output** the parser produces from a raw statement:

```ts
export interface ParsedStatement {
  original: string
  subject?: string        // usually absent — standards statements are imperative
  predicate?: string      // the matched verb surface form
  object?: string         // direct-object phrase (conjunctions preserved)
  preposition?: string    // 'for' | 'by' | 'of' | 'to' | ...
  complement?: string     // final noun phrase after the preposition
  modifiers: string[]     // adjectives/adverbs collected en route
  confidence: number      // 1.0 minus 0.1 per unknown word
  unknownWords: string[]
  expansions?: ParsedStatement[]  // conjunction fan-out
  hasConjunction?: boolean
}
```

`parseSingle()` is a linear left-to-right scan over the POS tags implementing the imperative template **`VERB [DET] [ADJ]* NOUN [PREP [DET] [ADJ]* NOUN]`**: skip to the first VERB → set `predicate`; collect everything up to a PREP/PUNCT (dropping determiners) → `object`; capture the PREP → `preposition`; collect trailing nouns → `complement`. Adjectives/adverbs are siphoned into `modifiers`. There is **no real subject extraction** — standards statements are imperative, so `subject` is left implicit and only populated later by downstream dot-notation parsers.

The richer service parser `scripts/parse-service-statements.ts` produces a parallel `ServiceStatement` shape with `activities[]` / `objects[]` / `modifiers[]` / `exclusions[]` plus a `scope` boundary, and an `expandServiceStatement()` that materializes the cartesian product (the documented frame is `{predicate[], object, preposition, complement[], exclusions[]}`).

## 3. The semantic grammar and its brittleness

The companion grammar lives in `.org.ai/semantics.org.ai/` (`SemanticStatements`, `SemanticPatterns`, `SemanticRules`, `SemanticModifiers`, `SemanticControlFlow`, `SemanticMapping`). These MDX files are the **aspirational target model** — RDF-style SPO triples, reification, N-ary/association patterns, prepositional/temporal/causal/instrumental modifier taxonomies, conjunction/conditional/cartesian control flow, and crosswalk/alignment mapping. The *parser* implements only a thin slice of this. The structures the rules actually handle:

- **Imperative SVO** (`VERB OBJECT [PREP COMPLEMENT]`) — the core.
- **Multi-word concepts** — longest-match phrase replacement against `Language.Concepts.tsv` (`"long-term vision"` → `LongTermVision`) before tokenizing.
- **Conjunction expansion**, three flavors keyed off `ConjunctionEntry.expansion`: `cartesian` (coordinating and/or), `compound`, `conditional` (subordinating). In practice the parser handles: slash-verbs (`Research/Resolve order exceptions`), simple verb lists (`Verb1 and Verb2 Object`), Oxford-comma verb lists (`Acquire, Construct, and Manage Assets`), and object-list fan-out (`Develop Vision and Strategy` → two subtasks).
- **Modifiers** — adjectives/adverbs collected but not semantically typed.
- **Scope-aware cartesian products** (services only) — `"Maintenance and repair services for automobiles and light trucks"` → 4 services, with `(except ...)` exclusions preserved across all expansions.

**Where it is brittle** (motivating the LLM switch; see `research/napcs/SERVICE-SEMANTIC-PARSING-SESSION.md`):

- **POS by orthography, not syntax.** TitleCase=Noun / lowercase=verb is a hard convention. Any out-of-lexicon word degrades to `UNK`/`UNK-VERB`, dropping confidence 0.1 per token. ~10% of APQC names carried unknown words.
- **No real subject/clause parsing.** Only the first verb is the predicate; embedded clauses, relative clauses, and purpose clauses are not modeled.
- **Conjunction scope ambiguity** — the headline failure. `"Steam and heated or cooled air or water"` should yield `[Steam, heated air, heated water, cooled air, cooled water]` but the rules over-distribute `Steam` into the cartesian. Regex-based phrase boundaries cannot reliably tell which conjuncts share which head noun.
- **Pattern-matching by regex cascade** — `parseServiceStatement` is a waterfall of 5 hand-ordered regex patterns; new phrasings require new patterns. The session doc explicitly flags "Simple heuristics fail on complex patterns that require understanding semantic scope."
- **No real modifier/preposition semantics** — the `SemanticModifiers` taxonomy (spatial/temporal/causal/instrumental) exists in the grammar docs but the parser only records the raw preposition string.

## 4. How it feeds canonical verbs: graph.org.ai → standards.org.ai → verbs.org.ai

The connection is confirmed in `scripts/parse-graphdl-statements.ts`. After SVO decomposition, each statement is reified into a `Statement` entity (`subject/predicate/object/preposition/complement`) and, critically, **emits relationships that wire the predicate to the verb registry**:

```ts
// from parse-graphdl-statements.ts
{ from: statementUrl, to: `https://verbs.org.ai/${parsed.predicate}`,
  predicate: 'hasPredicate', reverse: 'predicateOf' }
{ from: statementUrl, to: `https://business.org.ai/Noun/${parsed.subject}`,
  predicate: 'hasSubject',  reverse: 'subjectOf' }
{ from: statementUrl, to: `https://business.org.ai/Noun/${parsed.object}`,
  predicate: 'hasObject',   reverse: 'objectOf' }
{ from: statementUrl, to: `https://business.org.ai/Noun/${parsed.complement}`,
  predicate: 'hasComplement', reverse: 'complementOf' }
```

So the path is: **graph.org.ai parse** (raw statement → SVO `Statement` + dot-notation id) → **standards.org.ai** crosswalk/merge (the `.org.ai/standards.org.ai/` domain carries APQC/NAPCS/UNSPSC/Wikidata crosswalks; `SemanticMapping.mdx` is the alignment model) → **verbs.org.ai** registry (the `hasPredicate → verbs.org.ai/{verb}` edge is the registry link; subjects/objects link to `business.org.ai/Noun/{...}`). The verb lemmas themselves come from the merged standards lexicon (`Language.Verbs.tsv`, sourced from GS1 CBV, Schema.org Actions, APQC PCF). Note `verbs.org.ai` is **not yet published** (the `.org.ai/verbs.org.ai/` dir is empty; `digital-objects/types.ts` confirms "none of verbs.org.ai... are published" as of 2026-05).

## 5. The LLM successor → `digital-objects` Frame

**What an LLM model REPLACES:** the entire rule-based decomposition — `Tokenizer` + `POSTagger`'s orthographic guessing + `StatementParser`'s linear scan + the regex-cascade conjunction/scope expansion in `parse-service-statements.ts`. These are exactly the brittle pieces. An LLM reads the raw standards statement and emits the SVO + frame directly, resolving conjunction scope (`Steam` vs. cartesian) and clause structure that the regex grammar cannot.

**What an LLM PRODUCES:** SVO with typed complement roles — i.e. frame-shaped output, including the conjunction fan-out as structured alternatives rather than a `[...]` string.

**What STAYS:** (a) the **canonical-verb lexicon** as the controlled vocabulary the LLM normalizes predicates *into* (the LLM should map a surface verb to a `canonicalForm` + carry its `event`/`activity`/`actor`/`inverse`, not invent verbs); (b) the **standards crosswalk/merge** in standards.org.ai; (c) the **output schema** — the SVO `Statement` + `hasPredicate/hasSubject/hasObject/hasComplement` graph edges, which downstream consumers already expect.

**How close is the parser's output to the `digital-objects` Frame model?** Very close in spirit, but flat. The target (`primitives.org.ai/packages/digital-objects/src/types.ts`):

```ts
export type FrameRole =
  | 'subject' | 'object' | 'recipient' | 'source' | 'destination'
  | 'instrument' | 'topic' | 'cause' | 'manner'

export interface Frame {
  subject: NounRef | 'any'
  object?: NounRef;  recipient?: NounRef;  source?: NounRef;  destination?: NounRef
  instrument?: NounRef | 'Tool';  topic?: NounRef;  cause?: 'Action';  manner?: string[]
}

export interface Verb extends GraphdlVerb {
  name; action; act; activity; event
  reverseBy?; reverseAt?; reverseIn?; inverse?
  frame?: Frame; source?: VerbSource; canonical?: boolean; createdAt: Date
}
```

The mapping is almost 1:1 on the verb side:

| graphdl `VerbEntry` | digital-objects `Verb` | notes |
|---|---|---|
| `canonicalForm` | `action` / `name` | imperative lemma |
| `predicate` | `act` | 3rd-person present |
| `activity` | `activity` | gerund — identical |
| `event` | `event` | past participle — identical (the event-bus key) |
| `actor` | (no direct slot; informs `subject` Noun) | agentive noun |
| `object` | (result noun; informs `object` Noun) | objectified noun |
| `inverse` | `reverseBy` / `inverse` | passive/reverse relation |
| `source`/`vocabulary` (TSV) | `source: VerbSource` (`apqc`/`onet`/`verbs.org.ai`) + `canonical` | provenance maps directly |

And on the statement side, `ParsedStatement{subject, object, preposition, complement, modifiers}` maps onto `Frame` roles: `subject`→`subject`, `object`→`object`, and the **preposition is the discriminator** the rule parser throws away — `for X`→`recipient`/`destination`, `by X`→`instrument`, `of X`→`topic`/`source`, `to X`→`recipient`/`destination`, with `modifiers`→`manner`. The rule parser collapses all complements into a single `complement` string keyed only by raw preposition; the Frame model wants them **routed to the 9 typed roles**.

**What the LLM-based parser must emit to populate `digital-objects` Frames for canonical verbs:** for each standards statement, (1) the normalized `canonicalForm` (resolved against the existing verb lexicon, carrying its conjugations + `source`/`canonical`); and (2) a populated `Frame` — `subject` (often `'any'` for imperative process statements), `object` as a `NounRef`, and the prepositional/adverbial complements **routed to `recipient`/`source`/`destination`/`instrument`/`topic`/`cause`/`manner`** by interpreting the preposition's semantics (precisely the `SemanticModifiers` taxonomy the rule parser only records as raw strings). The conjunction expansions become **multiple frame-shaped Statements / Actions** rather than a `[...]`-suffixed dot-string. This closes the gap noted in the digital-objects design: the canonical-verb registry ships verbs *without* per-verb domain/range, and an LLM successor is what would emit the frame-shaped SVO needed to attach `Frame` slots (domain/range as `NounRef` roles) to each canonical verb at ingestion time.
