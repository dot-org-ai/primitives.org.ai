# SEED — How would the `digital-objects` SVO runtime layer actually be USED?

**Date:** 2026-06-01
**Mode:** HOW (generative). Imagine concrete, creative use cases. NOT risk analysis.
**Purpose:** We `/design-an-interface`'d `digital-objects` and committed to a shape (below). Before finalizing, we are grounding the interface in concrete usage. A recurring failure in this codebase has been *finalizing interfaces before having a solid sense of requirements.* This brainstorm generates concrete use cases across 4 orthogonal consumer lenses so we can **synthesize requirements and then pressure-test (grill) the committed interface against them.**

Your job as a lens subagent: imagine **8–12 concrete, specific use cases** from your discipline's vantage — with real-ish code/scenario sketches — and for **each**, name **what it DEMANDS of the interface** (the requirement it imposes). That dual output (use case + demand) is what makes synthesis able to pressure-test the shape.

---

## What `digital-objects` is (post-cleanup)

A **tech-agnostic SVO (Subject–Verb–Object) runtime ontology layer**. It has NO storage of its own (storage lives in `ai-database` via a `DigitalObjectsProvider` port, ADR-0003). It is a Layer-0 foundation package consumed by `ai-functions`, `ai-database`, `ai-workflows`, `digital-workers`, `digital-tools`, `services-as-software`, `human-in-the-loop`, `business-as-code`, `autonomous-agents`.

### Committed seam: `digital-objects` EXTENDS `@graphdl/core`

`@graphdl/core` (published, zero-dep, L0) already owns the **schema/vocabulary DSL**: `Graph({...})`, `Noun`, `Verb` (+conjugation: `action/actor/act/activity/result/reverse{by,at,in,for}/inverse`), the `-> ~> <- <~` relationship operators, linguistics (`pluralize/singularize/toPastParticiple/toActor/toGerund/...`), validation, dependency/topological analysis, content-derived IDs, MDXLD `$id`/`$type`. graphdl has **no instances and no runtime facts**.

`digital-objects` **depends on** graphdl, deletes its duplicated linguistics/Noun/Verb-base/validation (imports them), and adds the **SVO runtime layer graphdl lacks**:

- **`Frame` / `FrameRole`** — the SVO complement-role grammar a Verb declares. `FrameRole = subject | object | recipient | source | destination | instrument | topic | cause | manner`. `Frame = { subject: NounRef|'any', object?, recipient?, source?, destination?, instrument?: NounRef|'Tool', topic?, cause?: 'Action', manner?: string[] }`.
- **`Thing<T>`** — entity instance: `{ id, noun, data: T, createdAt, updatedAt }`.
- **`Action<T>`** — unified graph-edge + event + audit fact: `{ id, verb, subject?, object?, roles?: Partial<Record<FrameRole, ThingRef|string>>, data?, status, createdAt, completedAt? }`.
- **`TokenStratum`** — field mutation class (orthogonal to Frame): `frozen | negotiable | expression | composition`. Sugar: `Frozen()/Negotiable()/Expression()/Composition()`.
- **`DigitalObjectsProvider`** — the storage PORT (implemented by ai-database, not here): defineNoun/getNoun/listNouns, defineVerb/getVerb/listVerbs, create/get/list/find/update/delete/search, perform/getAction/listActions, related/edges, createMany/.../performMany, stratumOf/compositionFields/pickComposition, close.
- **rpc-promise pipelining** — Cap'n-Proto-style; chained calls on results batch into one round-trip.

`digital-objects`'s `Verb` **extends graphdl's Verb** with `frame?`, `source?` (`VerbSource = verbs.org.ai | apqc | onet | domain`), `canonical?`. **DECISION:** use graphdl's nested `reverse: { by, at, in, for }` + `actor`/`result` representation (more elegant/extensible) rather than flat `reverseBy/At/In` + `event`.

### The factory (Design 2 = "Ontos", refined onto graphdl)

```ts
import { Ontology } from 'digital-objects'

// Ontology(schema, opts?) = graphdl Graph(schema) + Frame layering + provider binding.
// Pure, storage-agnostic vocabulary (NO I/O).
const crm = Ontology({
  Contact: {
    name: 'string!',
    stage: 'Lead | Qualified | Customer',
    company: '-> Company.contacts',   // graphdl parses the relationship operator
    qualify: 'Qualified',             // digital-objects layers the Verb + Frame
  },
})

// ai-database adds the runtime — no re-declaration:
const { db } = DB(crm, { provider: 'sqlite' })
await db.Contact.qualify(ada)         // emits Action{verb:'qualify'}, enforces strata
```

`DO()` and `Noun()` factories are **retired** in favor of `Ontology()` (this also dissolves the `DO()`/`.do`-brand/Durable-Object naming collision — no `DO` symbol on the surface).

---

## Strategic context (why this matters)

- The driver is `explore.startups.studio` generating toward **1,000,000 startups**. The ontology must make that tractable.
- **The findOrCreate economic gate** (the linchpin of the epic, ai-functions↔ai-database): a 3-way `FIND | CREATE | ESCALATE` decision (link / mint / quarantine) that stops the cascade from regenerating semantically-equivalent work. Match is per-relation by `fan` (functional vs fuzzy); 2 embeddings modes (asymmetric MATCH vs symmetric-centered COLLAPSE) that must never be globally flipped. Frame-typed relations carry `fan`/direction.
- Consumers build CRM/SaaS/marketplace/finance domains; record what agents/humans/code DO (Actions); fire workflow events off verbs; ground domain verbs against future canonical registries (`verbs.org.ai`, `apqc`, `onet`, `schema.org.ai`).
- **Principle:** *embeddings discriminate; LLMs compose.* The FIND half is cheap embedding discrimination; the CREATE half is LLM composition.

---

## The 4 orthogonal lenses

- **Lens A — Frame semantics / NLG / computational linguistics.** Unit = the *sentence & the predicate's frame*. Can the SVO+Frame+conjugation model express the full range of real business facts, and generate natural-language audit/prose from Actions? (valency, ditransitives, voice/reverse forms, instrument/manner/cause roles.)
- **Lens B — Distributed systems / event-sourcing / database engineering.** Unit = the *Action stream & Thing store at scale*. How do consumers use Action as the unified event+edge+audit log; rpc-promise batching; the Provider port under real query/traversal/streaming/multi-tenant patterns.
- **Lens C — Economics / market-design / the findOrCreate gate at 1M-startup scale.** Unit = the *edge decision & entity dedup across the mega-graph*. How Frame-typed relations + Provider findOrCreate + TokenStrata + embeddings-modes serve the FIND|CREATE|ESCALATE economic engine.
- **Lens D — Knowledge representation / semantic-web / canonical-vocabulary governance.** Unit = the *vocabulary as a shared, portable, governed, evolving artifact*. How domain verbs ground against canonical registries (verbs.org.ai/apqc/onet/schema.org.ai), provenance & canonicality, JSON-LD interop/export, versioning/migration, multi-org/multi-domain reuse.

Each lens MUST stay in its discipline and not cover the others' ground.
