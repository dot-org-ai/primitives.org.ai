# Lens 4 — Provenance / Epistemics / Knowledge

**Probe:** Does the committed 11-role `FrameRole` taxonomy under-represent what provenance, epistemics, and AI-generated knowledge need in their Actions?
**Region:** W3C PROV-O, schema.org provenance, citation/evidence vocabularies, data lineage.
**Reduction test (applied to every candidate):** Real in concrete digital-object Actions · Load-bearing beyond untyped `Action.data` · Irreducible (does not collapse into `subject`/`source`/`instrument`/`topic`/`cause`/`how`).

The committed set: core valency `subject·object·recipient·beneficiary·source·destination·instrument·topic·result`; universal adjuncts `how·why·when·where`. `Action` is the unified event+edge+audit fact. Critically, in this codebase **the Action *is* the thing whose provenance we care about** — the cascade GENERATES Actions (edges) and Things; the findOrCreate gate emits a `Verdict` with `confidence` + `mechanism`; collapse "must preserve provenance" (invariant #4). So unlike most taxonomies, provenance here is not metadata *about* a separate record — it is structure *on the fact itself*.

**Decisive codebase evidence (this is not hypothetical):**
- `ai-database/src/docs-rels/schema.ts` — the canonical `rels` table (= the Action/edge) carries a first-class **`evidence_kind`** column with a closed 5-tier vocabulary: `source_exact | mechanical | embed_judge | llm_verified | inherited_llm`. It is *indexed* (`rels_evidence_kind`). This is `basis/evidence` already promoted out of `data` and made queryable on the edge, across icps + svc + sb (three repos agreed on it).
- The `search` table pins **`embedding_model`** and **`recipe_version`** per content row — the embedding-model/version pinning my lens predicted, already real.
- `events` carries **`parent_event_id`** (the causal/communication tree) — PROV `wasInformedBy`.
- `ai-functions/src/find-or-create.ts` — every `Verdict` carries `confidence: number` and `mechanism: string` (`exact`/`auto-link`/`ratify`/`greenfield`/`below-floor`). The gate's whole job is emitting calibrated confidence on a link/mint fact.
- `services-as-software/src/v3/lineage.ts` — `ServiceLineage` = `{ cellRef, icpContextProblemRef, foundingHypothesisRef }` (three `wasDerivedFrom` roots) + `cascadeRunId` (`wasGeneratedBy`) + `versionVector{ ontology, engine, generation, fh }`.

---

## Candidate 1 — `basis` / `derivedFrom` / `evidence` (the grounding of a generated fact)

**Definition.** PROV-O `prov:wasDerivedFrom` — "the construction of a new entity based on a pre-existing entity" — and `prov:used` (the input an activity consumes). schema.org `isBasedOn` is the lay equivalent. This is *what a generated fact is grounded ON*: the source rows, documents, or prior facts an LLM-composed Action stands on.

**Concrete Actions:**
1. Cascade emits `Action(verb: solves, subject: ServiceX, object: ProblemY)`. The fact is grounded on `[IcpInterview-7, FoundingHypothesis-3]`. Those are not the `subject` (ServiceX), not the `object` (ProblemY), not the `topic` — they are the *source material the claim was derived from*.
2. Collapse: `Problem-A` canonicalizes `Problem-B`; per invariant #4 we must "track every source that exposed the canonical." The `sameAs` Action's basis = `[Problem-B, Problem-C]` — the variant rows that grounded the merge.
3. An LLM extracts `Action(verb: reportsRevenueOf, subject: AcmeCorp, object: $5M)` from a 10-K. The basis = `[SEC-Filing-doc#para-42]` — the exact span grounding the claim.

**Reduction test.** *Real?* Yes — `evidence_kind` is literally indexed on the edge, and basis-tracking is invariant #4 of the gate. *Load-bearing beyond `data`?* Yes, decisively. This is the single most queried provenance fact in an LLM knowledge graph: "show me every claim grounded on retracted source X," "re-derive everything whose basis changed." `data` cannot serve a *graph traversal* — basis points at other Things/Actions and must be a dereferenceable edge, not opaque JSON. *Irreducible?* This is the sharp one. Could basis collapse into `source`? **No.** `source` is the *from* of a movement/transfer (PROV would call it the prior location/owner, VerbNet `Source`); `derivedFrom` is the *epistemic input to a generation*. "Transfer $5M **from** AcmeCorp" (source=Acme) vs "Derive the revenue claim **from** the 10-K" (basis=10-K) are different relations on potentially the same Action. Could it collapse into `instrument`? No — `instrument` is the *tool/mechanism* (the LLM, the embedder); basis is the *material consumed* (PROV deliberately splits `used`-the-entity from the activity's tooling; VerbNet splits `Instrument` from `Material`). Could it be `topic`? No — `topic` is what the action is *about* (aboutness ≠ derivation; a claim about the 10-K is not necessarily derived from it).

**Verdict: KEEP — `basis` (alias `derivedFrom`/`evidence`).** Confidence **0.92**. This is the genuine gap. It is the one role that an LLM-generated knowledge graph cannot operate without and that no existing role covers. Name it `basis` (SVO-native, "on the basis of"); map `schemaOrg: isBasedOn` / `prov: wasDerivedFrom`; `fillerKind: thing|action` (basis can be a source Thing OR a prior Action); `dereference: get|getAction`; fan-in (a fact may be grounded on many sources — note `evidence_kind` is per-edge but real basis is multi-valued, so model as a repeatable role).

---

## Candidate 2 — `attribution` (the accountable party, distinct from the actor)

**Definition.** PROV-O `prov:wasAttributedTo` — an Agent's *responsibility* for an entity, distinct from `prov:wasAssociatedWith` (the agent that *ran* the activity). The accountable party vs. the performer.

**Concrete Actions:**
1. A digital-worker drafts a contract clause; the human principal (the role `generalCounsel()`) is *accountable* for it. `subject` = the worker (who performed); attribution = the principal (who answers for it). The audit trail explicitly distinguishes these (CONTEXT.md: "If she approved as Role `ceo()` rather than as priya-the-person, Subject is the Role ref and the audit shows both the role and the current filler").
2. A cascade-generated `Service` is attributed to the studio/tenant that commissioned it (`ServiceLineage` ties it to a studio thesis), not to the cascade engine that emitted the rows.
3. An autonomous agent mints a claim under a *delegated authority*: subject = agent; attributed-to = the principal whose authority it acted under.

**Reduction test.** *Real?* Yes — the role-vs-filler audit split is a stated design intent, and accountable-party is core to governance Actions. *Load-bearing beyond `data`?* Yes for governed/regulated facts — "who is on the hook" is queried and policy-gated. *Irreducible?* **This is where I reject more than the lens brief expected.** In PROV the distinction is real, but in *this* runtime the `subject`-as-Role-ref design **already absorbs it**: when the worker acts *as* `generalCounsel()`, the Subject IS the accountable Role, and the audit records the current human filler underneath. The performer/accountable split is modeled by the **Role indirection on `subject`**, not by a second role. The residual case — performer ≠ accountable-party as *two distinct entities on one Action* (agent acts, principal is liable) — is the genuine PROV `wasAssociatedWith` vs `wasAttributedTo` gap. But that residual is thin, and Lens 3 (agentic-governance) owns `authority`/`approver`, which covers the accountable-party need from the governance side more naturally than a provenance role does.

**Verdict: MAP-TO-EXISTING (`subject` as Role-ref) + defer the residual to Lens-3 `authority`.** Confidence **0.70**. Not a clean provenance KEEP. If a role is wanted for the rare two-distinct-entities case, it belongs in the governance cluster, not here.

---

## Candidate 3 — `confidence` / `certainty`

**Definition.** Calibrated degree of belief in the fact. The gate emits it (`Verdict.confidence`); the edge could carry it.

**Concrete Actions:** every `link`/`mint` Action from the gate (`confidence: top.score` or `ratification.confidence`); every LLM-extracted claim with a model logprob/self-rated certainty.

**Reduction test.** *Real?* Yes. *Load-bearing?* Yes — confidence is threshold-gated and queried ("everything below 0.93 → re-review"). *Irreducible?* **No — it fails irreducibility against `data` AND against `how`.** Confidence is a scalar literal *about* a fact, not a *participant* in it; it dereferences to nothing (`fillerKind: literal`, `dereference: identity`). A FrameRole is "a Thing playing a role in an Action" (`Action.roles` is `Partial<Record<FrameRole, ThingRef | string>>` — entity refs). A bare number is exactly what `data` is for. Note the codebase agrees: the gate returns `confidence` as a field on `Verdict`, NOT as a role; `evidence_kind` (the *categorical* basis tier) earned an indexed column, but raw confidence did not. The categorical part of "how sure" is already covered by `evidence_kind` ⊂ basis; the scalar is `data`.

**Verdict: REJECT (→ `data`, or fold the categorical tier into `basis.evidenceKind`).** Confidence **0.85**. Typed-data masquerading as a role.

---

## Candidate 4 — `method` / `technique` / `how-derived`

**Definition.** The *procedure* that produced the fact — PROV would model this as the Activity's plan (`prov:Plan` / `hadPlan`). E.g. `exact` vs `auto-link` vs `ratify`; `embed_judge` vs `llm_verified`.

**Concrete Actions:** the gate's `Verdict.mechanism`; the `evidence_kind` tiers (`mechanical`/`embed_judge`/`llm_verified` ARE methods).

**Reduction test.** *Real?* Yes. *Load-bearing?* Yes — mechanism is audited. *Irreducible?* **No — collapses two ways.** (a) The categorical "how was this derived" is *exactly* `evidence_kind`, i.e. it is the same axis as `basis` — basis answers "from what," its kind answers "by what method"; they co-vary and belong on one role (`basis` with a `kind` qualifier, mirroring the `rels.evidence_kind` column that sits beside the edge). (b) The *manner* sense ("autonomously / supervised / human-approved") is already the committed universal `how`/`manner` adjunct, which CONTEXT.md value-constrains per verb. There is no residual that beats both `basis` and `how`.

**Verdict: MAP-TO-EXISTING (`basis.kind` for derivation-method; `how`/`manner` for execution-manner).** Confidence **0.82**.

---

## Candidate 5 — `version` / `revision` (of the producing process / model)

**Definition.** PROV-O `prov:Revision` (a derivation subtype) and the version of the generating activity's inputs — the embedding-model / prompt-recipe / engine version pinned at generation time.

**Concrete Actions:** `search.embedding_model` + `search.recipe_version` (real columns); `ServiceLineage.versionVector{ ontology, engine, generation, fh }`; re-derivation when the embedding model changes → "re-embed and re-collapse everything pinned to model gemini-embedding-2."

**Reduction test.** *Real?* Yes — most concretely grounded of all (two live columns + a typed VersionVector). *Load-bearing?* Yes — model-pinning drives re-derivation sweeps. *Irreducible?* **No, as a role — but with a wrinkle.** The version is a property of the **`instrument`** (the embedder/engine/prompt-template is the tool; its version is an attribute of that tool) OR a literal on the fact. It is not a *participant Thing* in the Action. If the instrument is modeled as a Thing (`Tool` literal per the Frame), its version lives on that Thing, reachable by dereferencing `instrument`. The scalar pin that must live *on the fact* (so you can sweep without joining) is `data`/literal — the codebase put it as a column (`embedding_model`), not as an edge endpoint. Version is *instrument-attribute + denormalized literal*, never its own role.

**Verdict: REJECT as a role (→ attribute of `instrument`, denormalized into `data` for sweep queries).** Confidence **0.80**.

---

## Candidate 6 — `wasInformedBy` (one generation informed by a prior)

**Definition.** PROV-O `prov:wasInformedBy` — Activity B used an entity generated by Activity A, where the entity itself is unknown/uninteresting; the *communication* link between two productions.

**Concrete Actions:** cascade step N's generation informed by step N−1 (`events.parent_event_id`); a re-derivation Action informed by the original derivation.

**Reduction test.** *Real?* Yes (`parent_event_id` is a live, indexed column — "causal tree"). *Load-bearing?* Yes for replay/causal-tree traversal. *Irreducible?* **No — this is precisely the committed `why`/`cause` adjunct.** SEED defines `why` as "cause — an Action ref"; `Action.cause` is typed `'Action'` (an Action→Action link). `wasInformedBy` is exactly an Action-informed-by-prior-Action edge = the `cause` adjunct's intended use. PROV distinguishes `wasInformedBy` (activity→activity, entity elided) from `wasDerivedFrom` (entity→entity); in our model the activity-to-activity link is `cause`, and the entity-to-entity link is the new `basis`. So `wasInformedBy` is already covered by `cause`; the only *new* PROV edge we lack is the entity-derivation one (= Candidate 1).

**Verdict: MAP-TO-EXISTING (`cause`/`why`, Action→Action).** Confidence **0.88**.

---

## Candidate 7 (lens-initiated) — `citation` / `sourceDocument`

**Definition.** schema.org `citation` — a reference to another work the fact cites. Considered separately from `basis` because fact-checking vocab (ClaimReview) treats cited evidence as first-class.

**Reduction test.** *Real?* Yes (10-K extraction, RAG citations). *Irreducible?* **No — a citation IS a basis whose filler happens to be a Document Thing.** There is no operation that distinguishes "cited" from "derived-from" at the runtime level: both answer "what grounds this claim," both must be dereferenceable, both feed re-derivation. Folding citation into `basis` (with `evidence_kind` discriminating a quoted source from an inferred one) is strictly simpler and matches how `rels.evidence_kind` already unifies `source_exact` (a citation) with `embed_judge` (an inference) on one column.

**Verdict: MAP-TO-EXISTING (`basis`).** Confidence **0.83**.

---

## (a) Ranked shortlist of genuine additions

| Rank | Role | Verdict | Confidence | One-line justification |
|------|------|---------|-----------|------------------------|
| 1 | **`basis`** (`derivedFrom`/`evidence`/absorbs `citation`+`method.kind`) | **KEEP** | 0.92 | The grounding of a generated fact; already an *indexed edge column* (`evidence_kind`) + gate invariant #4 ("track every source that exposed a canonical"). The one provenance role no existing role covers and an LLM knowledge graph cannot run without. |
| 2 | `attribution` | weak / MAP→`subject`-as-Role + Lens-3 `authority` | 0.70 | Performer-vs-accountable split is real but already absorbed by the Role-ref-on-`subject` design; residual belongs to governance. |
| — | `confidence` | REJECT → `data` | 0.85 | Scalar literal, not a participant; gate already returns it as a field, not a role. |
| — | `method` | MAP → `basis.kind` / `how` | 0.82 | Categorical = `evidence_kind` ⊂ basis; manner = `how`. |
| — | `version` | REJECT → `instrument`-attr + `data` | 0.80 | Attribute of the tool, plus a denormalized literal; never an edge endpoint. |
| — | `wasInformedBy` | MAP → `cause`/`why` | 0.88 | Action→Action link is the committed `cause` adjunct exactly. |
| — | `citation` | MAP → `basis` | 0.83 | A basis whose filler is a Document; no runtime distinction. |

**Net from this lens: exactly one genuine addition — `basis`.** The provenance region is *denser in this codebase than the 11 anticipate* (PROV's whole entity/activity/agent triad shows up), but the reduction test collapses six of seven candidates: the activity-to-activity edge is `cause`, the agent is `subject`-as-Role, the tool is `instrument`, confidence/version are literals/`data`, and method/citation fold into `basis`. The single irreducible survivor is the **entity-to-entity derivation edge** (`wasDerivedFrom`/`used`), which genuinely has no home among the 11. It is worth carrying a `kind` qualifier on `basis` (mirroring `rels.evidence_kind`'s `source_exact|mechanical|embed_judge|llm_verified|inherited_llm`) so method and citation-vs-inference ride on the one role instead of multiplying roles.

## (b) Meta-question recommendation: **(b) closed core + `schema.org.ai` extension path — but promote `basis` into the closed core first.**

Provenance is the strongest argument *for* option (b), not against it. The evidence: `basis` survived as the lone irreducible role, yet the *richness* around it (PROV's `Plan`/`Bundle`/`Revision`/`Collection`, FAIR lineage, ClaimReview's fact-check sub-vocab) is real, domain-specific, and unbounded. A *closed-but-larger* fixed set would force a choice between (i) omitting all of PROV's long tail — re-creating the exact under-representation this probe is testing for — or (ii) swelling the canonical set with provenance terms (`revision`, `plan`, `bundle`…) that most Actions never use and that the realizer/gate/exporter would have to reason over exhaustively for no benefit.

The clean cut: **`basis` is load-bearing for the *generic* runtime** (the gate's collapse-provenance invariant and cascade grounding are core mechanics, not a domain feature) — so it earns a seat in the closed core alongside the 11, taking the count to 12. Everything else PROV offers (`Plan`, `Revision`, `Bundle`, fact-check evidence tiers beyond `evidence_kind`) is domain-specific provenance metadata that belongs on the documented `schema.org.ai`-namespaced extension path, exactly mirroring how the codebase already handles schema.org-aligned roles plus our own extensions. This keeps the core small enough that the exporter can map it 1:1 to `schema.org.ai/Action` (with `basis → prov:wasDerivedFrom`/`schema:isBasedOn`), while giving the genuinely open-ended provenance/epistemics tail a principled home that does not bloat the set the realizer must reason over.

---

**Sources:** [W3C PROV-O](https://www.w3.org/TR/prov-o/) (`wasDerivedFrom`, `used`, `wasGeneratedBy`, `wasAttributedTo`, `wasAssociatedWith`, `wasInformedBy`, `Plan`, `Revision`); [PROV-DM Data Model](https://www.w3.org/TR/prov-dm/); [schema.org/isBasedOn](https://schema.org/isBasedOn); [schema.org/ClaimReview](https://schema.org/ClaimReview); [science-on-schema.org provenance decision (isBasedOn for derived datasets)](https://github.com/ESIPFed/science-on-schema.org/blob/1.2.0/decisions/72-provenance.md). Codebase grounding: `ai-database/src/docs-rels/schema.ts` (`evidence_kind`, `embedding_model`, `recipe_version`, `parent_event_id`), `ai-functions/src/find-or-create.ts` (`Verdict.confidence`/`mechanism`), `services-as-software/src/v3/lineage.ts` (`ServiceLineage`/`VersionVector`).
