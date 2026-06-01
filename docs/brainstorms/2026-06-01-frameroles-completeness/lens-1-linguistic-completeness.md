# Lens 1 — Linguistic Prior-Art Completeness

**Probe:** Is the `digital-objects` FrameRole taxonomy (committed 11) complete, or does established role-inventory prior art (VerbNet, PropBank `ArgM`, Fillmore case grammar, thematic-relations theory, schema.org/Action) carry legit roles we lack for a *general-purpose* runtime?

**Region:** linguistic prior art only. I do not poach business/finance (Lens 2), agentic-governance (Lens 3), or provenance/epistemics (Lens 4); where a candidate is *primarily* one of those, I flag it and hand it off rather than ruling.

**Reduction test (applied ruthlessly):** a role earns inclusion only if it is (1) **Real** in concrete digital-object actions, (2) **Load-bearing** in a way `Action.data` cannot serve (queried/rendered/gate-relevant/governed — not just stored), and (3) **Irreducible** (does not collapse into an existing role). `Action.data` is the fallback for *everything*; a candidate must BEAT data, not merely have a name in a corpus.

A grounding note on the baseline: the SEED's "11" includes `beneficiary` and `result` and treats `when/where/how/why` as universal adjuncts; the live `types.ts` enum currently lists 9 (`subject, object, recipient, source, destination, instrument, topic, cause, manner`) and carries `when/where` on `Action` directly. I test against the SEED's intended 11-role target (core: subject, object, recipient, beneficiary, source, destination, instrument, topic, result; adjuncts: how, why — with when/where Action-native). Anything I KEEP is therefore an addition *beyond* that intended 11.

---

## Candidate 1 — `purpose` (PropBank `ArgM-PNC`/`ArgM-PRP`; schema.org `purpose`)

**Definition.** The *goal an action is undertaken to achieve* — "in order to", "so that", "for the purpose of". PropBank deliberately separates this from cause: the tag is literally annotated **PNC = "purpose, not cause"**, and cause clauses ("because", "as a result of") get `ArgM-CAU` instead ([PropBank Guidelines, Babko-Malaya §3.8–3.9](https://verbs.colorado.edu/~mpalmer/projects/ace/PBguidelines.pdf)). schema.org has a `purpose` property — "a goal towards which an action is taken; can be concrete or abstract" — but only in the **health-lifesci extension**, not core `Action` ([health-lifesci.schema.org/purpose](https://health-lifesci.schema.org/purpose)).

**Digital-object examples.** `Agent --acquire--> Dataset` *purpose:* `TrainModel` action. `Worker --escalate--> Ticket` *purpose:* "obtain refund authorization". `Pipeline --snapshot--> State` *purpose:* `RollbackPlan`.

**Reduction test.** *Real:* yes — forward-looking intent is everywhere in agentic plans. *Load-bearing beyond data:* yes, but **only if the filler is an Action/goal reference** the runtime can dereference (an intended *future* Action), which is queryable ("show all actions taken in service of goal X") in a way an untyped data string is not. *Irreducible:* this is the sharp one. `why`/`cause` in our model is explicitly **backward-looking** ("because of" — a *parent* Action ref). Purpose is **forward-looking** ("in order to" — a *target* goal/Action). They point opposite directions in time and the graph; PropBank, Fillmore, and schema.org all keep them separate. Purpose does NOT collapse into `why` (wrong temporal direction) nor into `destination` (which is a spatial/recipient endpoint, not an aim). It is genuinely the missing twin of `cause`.

**Verdict: KEEP — high confidence.** The single strongest linguistic gap. But note the heavy overlap with Lens 3's "goal" — purpose and goal are the same role seen from linguistics vs. governance. I claim it linguistically; the cross-lens synthesis should de-dup to one role. *Filler kind:* action-ref (dereference `getAction`), mirroring `cause`.

---

## Candidate 2 — `co-agent` / comitative (PropBank `ArgM-COM`; VerbNet `Co-Agent`; schema.org `participant`)

**Definition.** A *second volitional participant acting jointly* with the subject — "negotiated **with** the union", "co-authored **with** Steve". VerbNet has a first-class `Co-Agent` role for verbs of joint action (e.g. *meet*, *negotiate*, *marry*). schema.org draws the line crisply: `agent` is "the direct performer" ("John wrote a book"); `participant` is "other co-agents that participated in the action indirectly" ("John wrote a book **with** Steve") ([schema.org/participant](https://schema.org/participant), [schema.org/agent](https://schema.org/agent)).

**Digital-object examples.** `AgentA --negotiate(co-agent: AgentB)--> Contract`. `Worker --pair-review(co-agent: Reviewer)--> PR`. `Org --merge(co-agent: OtherOrg)--> NewEntity`.

**Reduction test.** *Real:* yes — multi-party joint actions occur (co-signing, pair work, joint ventures, multi-agent negotiation). *Load-bearing beyond data:* yes — a co-agent is a **graph-edge endpoint** (a second `subject`-like Thing the action attributes to), so it must be a dereferenceable ThingRef, and "who else did this" is a real graph query. Data-as-string can't be a graph node. *Irreducible:* the tempting reduction is "it's just a second `subject`". But our model has exactly one `subject` slot (the edge's tail), and a comitative is *not* a co-tail — it is asymmetric (the subject leads; the co-agent joins), and schema.org/VerbNet both keep `agent`/`participant` distinct precisely because collapsing them loses the asymmetry and breaks single-subject edge semantics. It also does not reduce to `recipient` (the union is not a recipient of the negotiation) or `beneficiary`.

**Verdict: KEEP — medium-high confidence.** Real, irreducible, graph-shaped. The risk is frequency: joint actions are a minority of edges. But when they occur, `data` genuinely cannot carry a graph endpoint. Recommend KEEP under schema.org's own name **`participant`** (interop-aligned, and it generalizes slightly beyond strict co-agency). *Filler kind:* thing-ref.

---

## Candidate 3 — `extent` / `value` / `amount` (PropBank `ArgM-EXT`; VerbNet `Extent`, `Value`, `Asset`)

**Definition.** The *degree/measure by which* something changes or the *amount* quantified — "rose **by 40%**", "worth **$5M**", "delayed **by 3 days**". VerbNet `Extent` = "amount or distance"; `Asset`/`Value` cover monetary/valued amounts ([VerbNet roles](https://verbs.colorado.edu/verbnet/index.html)).

**Digital-object examples.** `Stock --increase(extent: "40%")--> Price`. `Invoice --discount(extent: "$500")--> Amount`. `Job --retry(extent: 3)--> Task`.

**Reduction test.** *Real:* yes, pervasive. *Load-bearing beyond data:* **this is the test it fails.** An extent/amount is a **literal scalar** — a number, a percentage, a Money value. It is not a graph endpoint, not dereferenced, not validated against a Noun. Everything the runtime does with it (render "+40%", compare, sum) is exactly what typed `data` does. There is no role-grammar operation (no realizer preposition reuse, no exporter mapping, no gate over *the role qua role*) that needs it lifted out of `data`. *Irreducible:* it is reducible — to typed `data`, or, where the amount carries economic semantics (Money/consideration/price), to **Lens 2's** finance substrate, which already models `Money` as a typed value, not a frame role.

**Verdict: REJECT — high confidence.** Pure typed data. This is the textbook case of a corpus role that is *not* runtime-load-bearing: it has a VerbNet name but no graph or grammar work to do. If a domain needs structured amounts, that is `data` with a schema (or Lens 2's `Money`), not a FrameRole.

---

## Candidate 4 — `material` vs `product` (transformation in/out) (VerbNet `Material`, `Product`)

**Definition.** For transformation verbs (*build, bake, compile, mint*): `Material` = the input consumed/transformed; `Product`/`Result` = the output created ([VerbNet roles](https://verbs.colorado.edu/verbnet/index.html)).

**Digital-object examples.** `Compiler --build(material: SourceTree)--> Binary`. `Mint --issue(material: Reserve)--> Token`. `Renderer --compile(material: MDX)--> Page`.

**Reduction test.** *Real:* yes — transformation is common. *Load-bearing beyond data:* the *output* side is — but that is already our **`result`** role (VerbNet `Product`/`Result`; schema.org `result`), which the intended-11 set includes. The *input* side (`Material`) splits: a consumed input is a dereferenceable Thing, but it is already adequately served by **`source`** (the from-endpoint, the thing the output derives from) or **`object`** (the thing acted upon). *Irreducible:* `product` reduces cleanly to existing `result`. `material` reduces to `source`/`object` for the runtime's purposes; the one nuance it adds — "this input was *consumed/destroyed* by the transformation" — is a lifecycle fact, not a role distinction, and where lineage matters it is **Lens 4's** `derivedFrom`/provenance territory.

**Verdict: MAP-TO-EXISTING — high confidence.** `product` → `result`; `material` → `source` (or `object`), with consumption-lineage deferred to Lens 4. No new role.

---

## Candidate 5 — `attribute` + `value` pair (VerbNet `Attribute` + `Value`)

**Definition.** For change-of-state verbs (*rate, rename, set, color*): `Attribute` = the property changed; `Value` = the new setting — "rated **quality: 5★**", "set **status to active**" ([VerbNet roles](https://verbs.colorado.edu/verbnet/index.html)).

**Digital-object examples.** `Reviewer --rate(attribute: "quality", value: "5★")--> Submission`. `Admin --set(attribute: "status", value: "active")--> Account`.

**Reduction test.** *Real:* yes. *Load-bearing beyond data:* no. An attribute+value pair is the canonical shape of a **field mutation**, which `digital-objects` already models *structurally* outside the Frame: a change-of-state action's payload is exactly `{field, newValue}` in `data`, and field semantics are governed by the orthogonal **`TokenStratum`** machinery (`frozen/negotiable/expression/composition`) on the Noun schema — not by FrameRole at all. *Irreducible:* no — it collapses into `data` (the value) plus the existing stratum system (the field's mutation rule). Lifting attribute/value into the role grammar would duplicate the stratum layer and confuse "role a Thing plays in an action" with "field of a Thing being mutated", which `types.ts` explicitly keeps orthogonal.

**Verdict: REJECT (MAP-TO-EXISTING `data` + `TokenStratum`) — high confidence.** The runtime already has a better, purpose-built home for this.

---

## Candidate 6 — `direction` / `trajectory` / `path` (PropBank `ArgM-DIR`; VerbNet `Trajectory`, `Initial_Location`)

**Definition.** The *path or directed manner of motion*, distinct from the source and destination *endpoints* — "routed **via** the EU region", "escalated **up** the chain". PropBank `ArgM-DIR` is the directional/path adjunct ([PropBank Guidelines](https://verbs.colorado.edu/~mpalmer/projects/ace/PBguidelines.pdf)).

**Digital-object examples.** `Packet --route(source: A, destination: B, path: [R1,R2])`. `Request --forward(direction: "upstream")`.

**Reduction test.** *Real:* marginal for digital objects — most digital actions have endpoints (`source`/`destination`) but no meaningful *trajectory between* them; the "path" is usually either an instrument-set or a sequence of separate hop-Actions. *Load-bearing beyond data:* no — where a path matters (routing), it is either a list of intermediate Things (better modeled as multiple hop-Actions, each its own edge) or metadata (`data`). *Irreducible:* no — it splits between endpoints already covered by `source`/`destination` and a hop-sequence that is better expressed as multiple Actions than one role.

**Verdict: REJECT — medium-high confidence.** Endpoints we have; the between-path is either `data` or a sequence of Actions. No general-runtime pull.

---

## Candidate 7 — `experiencer` / `stimulus` (VerbNet `Experiencer`, `Stimulus`)

**Definition.** For perception/emotion verbs (*see, fear, like, notice*): `Experiencer` = the sentient entity having the mental state; `Stimulus` = what triggers it ([VerbNet roles](https://verbs.colorado.edu/verbnet/index.html)).

**Digital-object examples.** `User --view(stimulus: Page)`. `Monitor --detect(stimulus: Anomaly)`. `Agent --observe(stimulus: Metric)`.

**Reduction test.** *Real:* yes (views, detections, observations are common audit events). *Load-bearing beyond data:* no — the experiencer is just the **`subject`** of a perception verb (the one doing the perceiving = the edge tail), and the stimulus is just the **`object`** (the thing perceived = the edge head). Linguistics distinguishes them because perception verbs have non-canonical *case marking* (the experiencer may be grammatical object: "X pleases me"), but our model stores *roles*, not surface case — so the syntactic motivation evaporates. *Irreducible:* no — clean collapse to `subject`/`object`.

**Verdict: MAP-TO-EXISTING — high confidence.** `experiencer` → `subject`, `stimulus` → `object`. The distinction is a surface-syntax artifact our role-not-case storage erases.

---

## Candidate 8 — secondary predication / `predicate` (PropBank `ArgM-PRD`; VerbNet `Predicate`/`Attribute`)

**Definition.** A *predicate attributed to the object as a result of the action* — "elected him **president**", "marked the task **done**", "promoted her **to lead**". This is the resultative/depictive secondary predicate.

**Digital-object examples.** `Board --elect(object: Person, predicate: "CEO")`. `System --mark(object: Task, predicate: "complete")`. `Manager --promote(object: Worker, predicate: "Lead")`.

**Reduction test.** *Real:* yes — role/status assignment is common. *Load-bearing beyond data:* mostly no. Two sub-cases: (a) the predicate is a **state** ("done", "active") — that is a field mutation, → `data` + `TokenStratum` (see Candidate 5), or the action's own completion semantics; (b) the predicate is a **new role/type** ("president", "Lead") — that is genuinely *assigning a Noun-typed relationship*, which is better modeled as a `result` (the new role-binding Thing) or as a separate `assign`/`hasRole` Action edge than as a frame slot on the original verb. *Irreducible:* no — splits between `data`/stratum (state) and `result`/a follow-on Action (role assignment). schema.org models this as a dedicated `AssignAction` type rather than a role, confirming the "separate edge, not a slot" instinct.

**Verdict: REJECT (MAP-TO-EXISTING) — medium confidence.** Real phenomenon, but it decomposes into existing machinery (`data`/stratum, or `result`/a second Action). The lower confidence reflects that "elect X president" *feels* atomic; I still judge the second-Action decomposition cleaner than a new role.

---

## Candidate 9 — `negation` / `modality` / `polarity` (PropBank `ArgM-NEG`, `ArgM-MOD`)

**Definition.** `ArgM-NEG` marks negation ("did **not** ship"); `ArgM-MOD` marks modal/deontic flavor ("**must** approve", "**may** access").

**Digital-object examples.** `Worker --[did not]--approve--> Request`. `Policy --[must]--review--> Filing`.

**Reduction test.** *Real:* yes. *Load-bearing beyond data:* **but these are not roles — they are Action-level operators.** Negation is a property of the *proposition* (this action did/didn't happen), best carried by `Action.status` (`failed`/`cancelled` already encode "didn't successfully happen") or an explicit boolean, not a complement slot filled by a Thing. Modality (must/may/should) is a **deontic operator** — it belongs to Lens 3's authority/obligation governance and to policy objects, not to the per-action role grammar; modeling "this is a *required* action" is a property of a rule, not a slot on the act. *Irreducible:* they are categorically *not* thematic roles (they take no participant), so they cannot be FrameRoles at all — they are Action-level/clause-level operators.

**Verdict: REJECT as FrameRoles — high confidence.** Negation → `Action.status`/boolean. Modality → Lens 3 (authority/obligation/policy). Neither is a role; both are operators over the proposition. Hand modality to Lens 3.

---

## Candidate 10 (sweep) — duration / frequency, condition, discourse (`ArgM-TMP` subtypes, `ArgM-DIS`)

Quick disposal of remaining `ArgM`s for completeness:

- **`duration` / `frequency`** ("for 12 months", "monthly"): typed temporal `data` (or Lens 2's contract `term`/billing cadence). Not graph-shaped, not dereferenced. **REJECT** (typed data / Lens 2). high.
- **`condition` / contingency** ("if approved"): a *precondition* is a governance gate, not a role — **Lens 3** territory (precondition/contingency). **REJECT here** (hand to Lens 3). high.
- **`ArgM-DIS` (discourse) / `ArgM-ADV`**: pragmatic connectives with no runtime meaning. **REJECT** trivially. high.

---

## Shortlist of genuine additions (ranked)

1. **`purpose`** (forward-looking aim; `ArgM-PNC` "purpose, not cause") — KEEP, high. The one unambiguous *linguistic* gap: the missing forward-twin of backward-looking `cause`/`why`. Caveat: identical to Lens 3's "goal" — synthesis must merge to one role, named `purpose`, action-ref filler.
2. **`participant`** (co-agent / comitative; schema.org `participant`, VerbNet `Co-Agent`) — KEEP, medium-high. Real, graph-shaped, irreducible (single-`subject` edge can't carry an asymmetric joint actor), interop-aligned. Lower-frequency than purpose.

Everything else: REJECT or MAP-TO-EXISTING. The 11 already absorb the high-frequency thematic core; the rejects are either typed scalars masquerading as roles (`extent`/`value`/`amount`, `duration`/`frequency`), surface-syntax artifacts our role-not-case storage erases (`experiencer`/`stimulus`), structural duplicates of existing slots (`product`→`result`, `material`→`source`, `attribute/value`→`data`+`stratum`), proposition-level operators that aren't roles at all (`negation`, `modality`), or other-lens concerns (`condition`→L3, amounts→L2, `material`-lineage→L4).

**Net linguistic verdict:** the committed set is *substantially* complete. From the entire VerbNet/PropBank/Fillmore/schema.org inventory, only **two** roles survive a ruthless reduction test, and one of them (`purpose`) is co-claimed by Lens 3. The taxonomy is not badly under-represented — it is short by at most one or two, and both survivors are *named, attested* roles in the prior art, not exotic inventions.

---

## Meta-question recommendation: closed-core + `schema.org.ai` extension path (option b)

I recommend **(b): a closed core + a documented `schema.org.ai`-namespaced extension path** — and the linguistic evidence is what tips it.

The decisive data point: even `purpose`, the strongest survivor, lives in schema.org **as an extension** (`health-lifesci.schema.org/purpose`), *not* on core `Action`. schema.org — the most-deployed action vocabulary on earth — itself runs a tiny core (`agent`/`object`/`instrument`/`participant`/`result`/`target`/`location`/`startTime`/`endTime`) plus per-subtype/extension additions (`recipient` only on subtypes; `fromLocation`/`toLocation` on motion subtypes; `purpose` in an extension). That is precisely the closed-core + extension shape, and it is the convergent design of the one prior-art system that is actually a *runtime interop target* rather than a research corpus.

The reduction test reinforces this structurally: the survivors are scarce (1–2), and the *next* tier down (extent, attribute/value, duration, secondary predication) are all real-but-not-load-bearing — exactly the population that should live in `data` or in a *documented* extension namespace rather than bloating the canonical set the realizer/gate/exporter must reason over exhaustively. A fixed-but-larger set (option a) would force every consumer of the role enum to handle low-frequency roles that 99% of verbs never declare, and would have no principled stopping point once you admit `extent` you must litigate `duration`, `frequency`, `path`...

**Concrete recommendation:**
- **Promote `purpose` into the closed core now** (it is forward-looking-cause, attested, governance-critical via Lens 3's goal). This makes the core 12.
- **Keep `participant` as the first first-class `schema.org.ai` extension role** — attested (schema.org names it), graph-shaped, but low-frequency. Ship it via the documented extension path rather than the must-reason-exhaustively core, exercising the extension mechanism with a real, safe, interop-aligned role.
- **Document the extension path** the same way schema.org does: a stable closed core that the realizer/gate/exporter reason over exhaustively, plus a `schema.org.ai`-namespaced slot for domain/low-frequency roles (each with the same `ROLE_META` shape: `word`, `preposition`, `surfaceOrder`, `fillerKind`, `dereference`, `schemaOrg`). This mirrors exactly how the design already handles schema.org-aligned core + owned extensions for `beneficiary`/`how`/`why`.

This gives the runtime the small, exhaustively-reasoned core it needs for the hot path, while making `digital-objects` honest about the long tail: most candidate roles are typed `data`, a couple are other-lens concerns, and the rare legit additions get a *named, governed* home instead of either permanent omission or unbounded core growth.

---

## Sources

- [PropBank Annotation Guidelines — Babko-Malaya](https://verbs.colorado.edu/~mpalmer/projects/ace/PBguidelines.pdf) — `ArgM-PNC` "purpose, not cause" vs `ArgM-CAU`; `ArgM-DIR`, `ArgM-EXT`, `ArgM-NEG`, `ArgM-MOD`, `ArgM-DIS` definitions.
- [VerbNet — University of Colorado Boulder](https://verbs.colorado.edu/verbnet/index.html) — ~21–23 thematic roles incl. Co-Agent, Asset, Extent, Value, Material, Product, Attribute, Predicate, Experiencer, Stimulus, Trajectory, Initial_Location.
- [VerbNet Annotation Guidelines](https://verbs.colorado.edu/verb-index/VerbNet_Guidelines.pdf) — role hierarchy and co-occurrence constraints.
- [schema.org/participant](https://schema.org/participant) — "other co-agents that participated in the action indirectly" ("John wrote a book with Steve").
- [schema.org/agent](https://schema.org/agent) — "the direct performer or driver of the action".
- [schema.org/Action](https://schema.org/Action) — core action vocabulary; `recipient` on subtypes only; no `beneficiary`.
- [schema.org/AssignAction](https://schema.org/AssignAction) — role/status assignment modeled as a dedicated Action type, not a slot.
- [health-lifesci.schema.org/purpose](https://health-lifesci.schema.org/purpose) — `purpose` as an *extension* property, "a goal towards which an action is taken; can be concrete or abstract".
