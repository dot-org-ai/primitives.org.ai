# Frame Semantics & Thematic Roles: Computational-Linguistics Prior Art for the `digital-objects` SVO Role Model

**Date:** 2026-06-01
**Status:** Research report (background reading for ADR-0012 — `digital-objects` SVO runtime design)
**Audience:** Authors and reviewers of ADR-0012; maintainers of `digital-objects`, `ai-database`, `@graphdl/core`.

> **Scope and stance.** This is a *research report*, not a specification and not an endorsement. The computational-linguistics resources surveyed here — FrameNet, VerbNet, PropBank — and the web-data standard schema.org/Action **inform** our `Frame`/`FrameRole`/`Verb`/`Action` model and let us *check our work* against decades of prior art. **None of them is a baseline we must conform to, and none is a runtime dependency we take.** Our committed design (the 5W+H frame plus core valency roles, exported to `schema.org.ai/Action`) was arrived at independently; the value of this report is that it shows the design lands at a well-attested altitude and borrows exactly one structural idea (core arguments vs. peripheral adjuncts) that three of these traditions converge on. Where the prior art is a poor fit for our use case, we say so plainly.

---

## 1. Executive summary / thesis

`digital-objects` is a tech-agnostic SVO (Subject–Verb–Object) runtime ontology layer. Every business fact it records is an `Action` — a unified graph edge, event, and audit record — whose role structure is declared up front by a `Verb`'s `Frame`. The design question this report contextualizes is: *at what granularity should the role inventory sit?*

Our committed answer is a two-tier model:

- An intuitive **5W+H** surface (who / what / when / where / why / how) for humans and for LLM slot-filling, sitting on top of
- **Core valency roles**, declared per-`Verb` in its `Frame`: `who=subject`, `what=object`, `to-whom=recipient`, `for-whom=beneficiary`, `from=source`, `to=destination`, `with=instrument`, `about=topic`, `into=result`; plus
- **Universal/peripheral adjuncts** that attach to *any* `Action` rather than being declared per-verb: `when`, `where`, `how`, `why`. (`when`/`where` are already carried on `Action` as timestamp/location; `how`/`why` join them. A verb *may* optionally constrain `how`'s values via an enum — e.g. agent-oversight modes `autonomous | supervised | human-approved | escalated`.)

The thesis of this report is that **this is precisely the *generic thematic-role altitude*** — the level occupied by VerbNet's cross-verb thematic roles and PropBank's numbered-argument-plus-`ArgM`-modifier scheme — and **deliberately *not* FrameNet's frame-specific frame elements.** That choice is validated three ways:

1. **VerbNet** gives our core valency roles their names and altitude: Agent, Patient/Theme, Recipient, Beneficiary, Source, Destination/Goal, Instrument, Topic are exactly VerbNet's reusable, cross-verb thematic roles.
2. **PropBank**'s `ArgM` adjunct modifiers — `ArgM-MNR` (manner = **how**), `ArgM-TMP` (time = **when**), `ArgM-LOC` (location = **where**), `ArgM-CAU` (cause = **why**), `ArgM-DIR`/`ArgM-GOL` (direction/goal) — are essentially **our 5W+H universal adjuncts.** This is the strongest single validation: an independent corpus-annotation tradition factored out the *same* small set of always-available modifiers we did.
3. **Journalism's Five Ws (5W+H)** is the same small universal set arrived at from a third direction entirely — the newsroom — which is why our human-facing surface and the linguists' peripheral roles agree.

`schema.org/Action` is treated separately: it is not prior art that informs the altitude, it is our **production interoperability target.** Our JSON-LD export aligns to `schema.org.ai/Action`, a superset we own that matches `schema.org/Action` where terms overlap (`agent`, `object`, `recipient`, `instrument`, `result`) and adds first-class extensions (`beneficiary`, `how`, `why`, …) under our namespace.

The one structural idea we genuinely borrow — articulated in §5 — is the **core-argument vs. peripheral-adjunct distinction** that FrameNet (core vs. non-core FEs) and PropBank (numbered args vs. `ArgM`) both encode. That distinction is the linguistic justification for our split between per-verb core valency roles and universal adjuncts.

---

## 2. What each resource is

### 2.1 FrameNet

FrameNet is a lexical database for English grounded in **Frame Semantics**, the theory developed by Charles J. Fillmore — rooted in his 1968 paper "The Case for Case" and his subsequent work on semantic frames — and built as a project at the International Computer Science Institute (ICSI) in Berkeley, first released in 1998 ([FrameNet, Wikipedia](https://en.wikipedia.org/wiki/FrameNet); [What is FrameNet?, ICSI](https://framenet.icsi.berkeley.edu/WhatIsFrameNet)). Its central claim is that word meanings are best understood relative to a **semantic frame** — a schematic representation of a type of event, relation, or situation, together with the participants and props involved.

FrameNet's three core units:

- **Frames** — schematic situations (e.g. *Commerce_buy*, *Apply_heat*, *Revenge*).
- **Frame Elements (FEs)** — the roles *specific to that frame*. *Commerce_buy* has `Buyer`, `Seller`, `Goods`, `Money`; *Apply_heat* has `Cook`, `Food`, `Heating_instrument`.
- **Lexical Units (LUs)** — pairings of a word with a frame it evokes (the verb *buy*, *purchase*, the noun *purchaser* all evoke *Commerce_buy*).

The latest data releases contain roughly **1,200 frames, ~10,000 frame-specific frame elements, ~13,000 lexical units, and over 200,000 manually annotated sentences**, plus nearly 1,800 frame-to-frame relations forming a hierarchy ([FrameNet, Wikipedia](https://en.wikipedia.org/wiki/FrameNet); [FrameNet II: Extended Theory and Practice](https://my.eng.utah.edu/~cs6961/papers/FrameNet_book.pdf)). FrameNet's 25-year retrospective — Boas, Baker, et al., "FrameNet at 25," *International Journal of Lexicography* (2024) — revisits its origins, architecture, and applications ([FrameNet at 25, Oxford Academic](https://academic.oup.com/ijl/article/37/3/263/7708430)).

The defining property for our purposes: **FrameNet's frame elements are frame-specific and granular.** `Buyer` and `Seller` exist only inside *Commerce_buy*; they do not generalize to *Apply_heat*. This is a feature for fine-grained lexical semantics and a deliberate non-fit for a generic reusable runtime (see §3).

### 2.2 VerbNet

VerbNet is the largest online verb lexicon for English, developed primarily by Martha Palmer and colleagues at the University of Colorado Boulder. It organizes verbs into classes that **extend and refine Beth Levin's (1993) verb classes**, grouping verbs that share both syntactic alternation behavior and semantic structure ([VerbNet, Univ. of Colorado](https://verbs.colorado.edu/verbnet/index.html); [Palmer, VerbNet project](https://verbs.colorado.edu/~mpalmer/projects/verbnet.html)). In its extended form it covers on the order of **274 first-level classes, ~3,769 verb lemmas, and ~5,257 senses** ([VerbNet, Univ. of Colorado](https://verbs.colorado.edu/verbnet/index.html)).

Crucially for us, VerbNet assigns each argument a **generic thematic role drawn from a small, reusable, cross-verb inventory** — about 23 roles, including **Agent, Patient, Theme, Instrument, Beneficiary, Recipient, Location, Destination, Source, Experiencer, Cause, Topic, Actor, Asset, Attribute, Material, Product, Time** ([VerbNet, Univ. of Colorado](https://verbs.colorado.edu/verbnet/index.html); [VerbNet Annotation Guidelines](https://verbs.colorado.edu/verb-index/VerbNet_Guidelines.pdf)). The Agent is the volitional initiator; the Patient undergoes a change of state; a Topic is a Theme specialized to communication verbs ([VerbNet thematic roles overview, search summary](https://www.sfu.ca/~hedberg/Thematic_Roles.pdf)).

**This is the altitude our core valency roles sit at.** Unlike FrameNet's `Buyer`/`Seller`, VerbNet's `Agent`/`Recipient`/`Instrument` are the *same roles across thousands of verbs* — which is exactly what a generic runtime needs.

### 2.3 PropBank

PropBank (the Proposition Bank), Palmer, Gildea & Kingsbury, *Computational Linguistics* (2005), is a corpus annotated with predicate–argument structure ([The Proposition Bank, ACL Anthology](https://aclanthology.org/J05-1004.pdf)). It uses two kinds of labels:

- **Numbered arguments `Arg0`–`Arg5`**, assigned per-verb-sense. Only `Arg0` and `Arg1` are stable across verbs — `Arg0` is the agent/causer, `Arg1` the patient/theme; higher-numbered arguments are defined per-roleset and do not generalize ([propbank.pdf, Univ. of Washington](http://faculty.washington.edu/fxia/lsa2011/slides/propbank.pdf)).
- **`ArgM` modifiers** — adjunct labels that generalize over the *entire corpus* rather than a single verb. These include **`ArgM-MNR` (manner), `ArgM-TMP` (temporal), `ArgM-LOC` (location), `ArgM-CAU` (cause), `ArgM-DIR` (direction), `ArgM-GOL` (goal), `ArgM-PRP`/`ArgM-PNC` (purpose), `ArgM-EXT` (extent), `ArgM-ADV` (adverbial), `ArgM-DIS` (discourse)** ([PropBank Annotation Guidelines, Babko-Malaya](https://verbs.colorado.edu/~mpalmer/projects/ace/PBguidelines.pdf); [English PropBank Annotation Guidelines, Bonial](https://verbs.colorado.edu/propbank/EPB-Annotation-Guidelines.pdf)).

The `ArgM` set is the single most direct precedent for our universal adjuncts. As the PropBank documentation frames it, the modifiers "give additional information about *when, where, or how* the event occurred" — the journalist's Ws stated in a linguist's vocabulary. The correspondence is laid out in §4.

### 2.4 schema.org/Action

`schema.org/Action` is the action vocabulary of schema.org, the shared structured-data vocabulary for the web (Google/Bing/Yahoo/Yandex). An `Action` is "performed by a direct `agent` and indirect `participant`s upon a direct `object`, optionally happens at a `location` with the help of an inanimate `instrument`, and the execution of the action may produce a `result`" ([Action, schema.org](https://schema.org/Action); [Actions in schema.org](https://schema.org/docs/actions.html)). Properties defined directly on `Action` include **`agent`, `object`, `instrument`, `participant`, `result`, `target`, `location`, `startTime`, `endTime`, `error`** ([Action, schema.org](https://schema.org/Action)).

Two facts shape how we treat it. First, **`recipient` is not on the base `Action`** — it appears on specific subtypes (e.g. *GiveAction*, *SendAction*, *CommunicateAction*) — and there is **no `beneficiary` property at all** ([Action, schema.org](https://schema.org/Action)). Second, schema.org is published under **Creative Commons Attribution-ShareAlike 3.0** ([schema.org Terms of Service](https://schema.org/docs/terms.html)). These two facts are why we align to but do not simply re-use schema.org's vocabulary: we need first-class `recipient`, `beneficiary`, `how`, and `why` at the top level, under a namespace we own (`schema.org.ai`), free of the ShareAlike constraint on our own extension terms.

---

## 3. The altitude argument

The decisive design question is granularity, and the three lexical resources stake out two different altitudes:

- **Frame-specific (FrameNet):** roles named per frame — `Buyer`/`Seller`/`Goods`/`Money` for *Commerce_buy*. Maximally precise, maximally non-reusable. ~10,000 FEs.
- **Generic thematic (VerbNet / PropBank `ArgM`):** roles named once and reused across all predicates — `Agent`/`Recipient`/`Instrument`; `manner`/`time`/`location`/`cause`. A few dozen labels total.

**FrameNet's altitude is the wrong one for a reusable runtime, for structural reasons, not quality reasons.** A `digital-objects` consumer building a CRM declares a `qualify` verb; one building a logistics domain declares `ship`; one building finance declares `grant`. If each verb had to draw its roles from a frame-specific inventory, then (a) there would be no shared `recipient` across `grant`, `send`, and `assign` — the economic dedup gate and the JSON-LD exporter would each face a different role name per verb; (b) the ~10,000-FE inventory could never cover the open-ended verb space a million generated startups invent; and (c) an LLM composing an `Action` would have to learn a bespoke slot schema per verb rather than a single reusable role grammar. Frame-specific FEs optimize for *lexicographic precision over a fixed lexicon*; a runtime optimizes for *a small, stable, reusable role contract over an unbounded, user-defined verb space.* Those are different jobs.

The generic thematic altitude is the right one precisely because the roles are **verb-independent**. `recipient` means the same thing whether the verb is `grant`, `send`, or `assign`; the economic gate reads `direction`/`fan` off a `recipient` role without caring which verb declared it; the realizer maps `recipient` → "to" once; the exporter maps `recipient` → `schema:recipient` once. Our `Frame` lets a verb *select which* generic roles it takes (its valency) and *which Noun* fills each — but the role *vocabulary* is fixed and small. That is VerbNet's altitude for the core roles and PropBank's `ArgM` altitude for the adjuncts.

A useful nuance: empirically, even within these resources the *generic* labels are the stable ones. PropBank found that only `Arg0`/`Arg1` generalize across verbs while `Arg2`–`Arg5` are per-roleset — and that the `ArgM` adjuncts generalize over the *whole corpus* ([propbank.pdf, Univ. of Washington](http://faculty.washington.edu/fxia/lsa2011/slides/propbank.pdf)). In other words, the parts of these schemes that *are* verb-independent are exactly the parts we adopt the shape of; the verb-specific machinery (numbered args, frame-specific FEs) is what we leave behind.

---

## 4. Mapping table

Our roles mapped to each tradition. **Read this as "our model lands at the VerbNet/PropBank-`ArgM` altitude and exports to schema.org" — not as a conformance claim.** FrameNet entries are necessarily *per-frame* (FrameNet has no global role vocabulary), so the FrameNet column gives an *example* FE from one representative frame, marked accordingly.

### Core valency roles (declared per-`Verb` in its `Frame`)

| Our role (5W+H) | VerbNet thematic role | PropBank | schema.org/Action | FrameNet (frame-specific example) |
|---|---|---|---|---|
| `subject` (who) | Agent / Actor | `Arg0` (agent/causer) | `agent` | e.g. `Buyer` in *Commerce_buy* |
| `object` (what) | Patient / Theme | `Arg1` (patient/theme) | `object` | e.g. `Goods` in *Commerce_buy* |
| `recipient` (to whom) | Recipient | `Arg2` (per-roleset) | `recipient` (on subtypes) | e.g. `Recipient` in *Giving* |
| `beneficiary` (for whom) | Beneficiary | `Arg2`/`Arg3` (benefactive) | *(none — our extension)* | e.g. `Beneficiary` in *Giving* |
| `source` (from) | Source | `Arg2`/`ArgM-DIR` | `fromLocation` (subtypes) | e.g. `Donor`/`Source` in *Giving* |
| `destination` (to) | Destination / Goal | `Arg4`/`ArgM-GOL` | `toLocation` (subtypes) | e.g. `Goal` in *Motion* |
| `instrument` (with) | Instrument | `Arg2` (instrument) | `instrument` | e.g. `Instrument` in *Cause_harm* |
| `topic` (about) | Topic | `Arg1`/`Arg2` | `about` | e.g. `Topic` in *Statement* |
| `result` (into) | Product / Result | `Arg2` (result) | `result` | e.g. `Created_entity` in *Creating* |

### Universal/peripheral adjuncts (attach to any `Action`) — the 5W+H ↔ `ArgM` correspondence

| Our adjunct | Journalist's W | PropBank `ArgM` | VerbNet | schema.org/Action |
|---|---|---|---|---|
| `when` (carried on `Action` as timestamp) | When | **`ArgM-TMP`** (temporal) | Time | `startTime` / `endTime` |
| `where` (carried on `Action` as location) | Where | **`ArgM-LOC`** (location) | Location | `location` |
| `how` (universal adjunct; verb *may* enum-constrain) | How | **`ArgM-MNR`** (manner) | Manner (adverbial) | *(our extension)* |
| `why` (universal adjunct) | Why | **`ArgM-CAU`** / `ArgM-PRP`/`ArgM-PNC` (cause/purpose) | Cause | *(our extension; cf. result/causation)* |

The bottom table is the report's load-bearing observation: **our four universal adjuncts (`when`/`where`/`how`/`why`) line up one-to-one with PropBank's most common `ArgM` modifiers (`ArgM-TMP`/`ArgM-LOC`/`ArgM-MNR`/`ArgM-CAU`), and with four of journalism's Five Ws.** Three independent traditions — corpus linguistics, lexical semantics, and the newsroom — factored out the *same* small set of always-available, verb-independent modifiers. That convergence is why we are confident the adjunct tier is at the right altitude.

(Note on `manner`/`how`: the current `digital-objects` `FrameRole` type still carries `manner` as a per-verb enum on the `Frame`. The committed model promotes `how` to a universal adjunct that *may* be enum-constrained per verb — e.g. agent-oversight modes — reconciling the per-verb-enum impulse with the universal-adjunct altitude. ADR-0012 records the migration.)

---

## 5. The one idea we borrow: core vs. peripheral

If this report endorses adopting *one* structural idea from the prior art, it is the **core-argument vs. peripheral-adjunct distinction**, which both FrameNet and PropBank encode independently:

- **FrameNet** marks frame elements as **core** vs. **non-core (peripheral/extra-thematic)**. Core FEs are conceptually necessary to the frame (you cannot have a *Commerce_buy* without a `Buyer` and `Goods`); peripheral FEs (Time, Place, Manner, Purpose) are general adjuncts that apply across many frames ([FrameNet II: Extended Theory and Practice](https://my.eng.utah.edu/~cs6961/papers/FrameNet_book.pdf)).
- **PropBank** draws the same line as **numbered arguments (`Arg0`–`Arg5`, the core valency of the predicate)** vs. **`ArgM` modifiers (adjuncts that generalize across the corpus)** ([The Proposition Bank, ACL Anthology](https://aclanthology.org/J05-1004.pdf)).

This is exactly our split:

- **Core valency roles** are declared **per-`Verb`** in its `Frame` — they are part of what the verb *means* (a `grant` without a `recipient` is incomplete; an `assign` without an `object` is meaningless). This mirrors FrameNet's core FEs and PropBank's numbered args: which core roles exist is a property of the predicate.
- **Universal adjuncts** (`when`/`where`/`how`/`why`) attach to **any `Action`** without per-verb declaration, because they are verb-independent circumstances. This mirrors FrameNet's peripheral FEs and PropBank's `ArgM`: the same modifiers apply to every predicate.

The distinction is not cosmetic — it tells the runtime *where* each piece of information lives. Core roles are validated against the `Frame` (an LLM cannot fill a `topic` on a verb whose frame has no `topic`); adjuncts are always accepted on any `Action`. That the two most-used SRL resources both draw this exact line, from different methodologies, is strong validation that our two-tier model carves the joint correctly.

---

## 6. Why we do NOT take a dependency

Adopting the *altitude* and the *core/peripheral idea* is not the same as taking a dependency on these resources. We do not, for several converging reasons:

1. **English-centric.** FrameNet, VerbNet, and PropBank are English lexicons (with separate, partial sister projects for other languages). Our `Action` storage is deliberately **language-neutral** — it stores role structure and entity references, never surface strings — so that a startup operating in the EU can re-render the same Action stream as German or French audit trails. Baking an English lexicon into the runtime would defeat that. (See the frame-semantics lens, use case 10.)

2. **Research-grade, not runtime-grade.** These are annotation resources and research corpora, optimized for linguistic coverage and inter-annotator agreement, not for low-latency lookups in a hot path at population scale. The canonical integration work — Giuglea & Moschitti, "Semantic Role Labeling via FrameNet, VerbNet and PropBank," COLING-ACL 2006 ([ACL Anthology P06-1117](https://aclanthology.org/P06-1117/)) — is illustrative: it builds a *research SRL pipeline* that interconnects all three, using a VerbNet-class-derived "Interlingual Class" (ILC) feature as a bridge so that FrameNet role classifiers generalize to predicates *outside* FrameNet's coverage. The reported gain is real and instructive — on PropBank sentences annotated with FrameNet role classifiers outside FrameNet's scope, accuracy was **81% with the ILC feature versus 62% without** (35 vs. 72 incorrect of 189 arguments) ([Giuglea & Moschitti 2006, §results](https://aclanthology.org/P06-1117.pdf)). But that number describes a *parsing pipeline that maps text to roles*; it is not a runtime our consumers call. We are not parsing free text into roles — our consumers *declare* roles up front in a `Frame`. The 81/62 result validates the *idea* that a generic-thematic bridge (VerbNet-class altitude) generalizes better than frame-specific labels; it does not motivate importing the pipeline.

3. **Licensing and maintenance.** Each resource carries its own license and release cadence (and schema.org is CC BY-SA 3.0, whose ShareAlike clause we want to avoid inheriting on our own extension vocabulary — [schema.org Terms](https://schema.org/docs/terms.html)). Pinning a Layer-0 foundation package to externally-versioned linguistic corpora would couple our release train to theirs for no runtime benefit.

4. **Largely obviated by LLMs for the parsing job.** The historical reason to depend on these resources was to *parse* natural language into predicate-argument structure (the SRL task). In our architecture that job is done differently: an LLM composes an `Action` by filling a `Frame`'s slots (frame-element filling, but with a frame *we* declared), and embeddings discriminate near-duplicate facts. The 2006-era pipeline's reason to exist is the part LLMs now do well; what remains valuable from the resources is their *role taxonomy and the core/adjunct distinction*, which are design knowledge, not code.

5. **schema.org is the production interoperability standard.** For the one place we *do* need a shared, external vocabulary — JSON-LD export for linked-data interop — the right target is schema.org, the actual web standard with ecosystem support, not a research lexicon. We export to `schema.org.ai/Action`, a superset we own that aligns with `schema.org/Action` on overlapping terms (`agent`/`object`/`recipient`/`instrument`/`result`) and adds our first-class extensions (`beneficiary`/`how`/`why`) under our namespace. No `do:` prefix; the export is the only translation layer we build now.

In short: these resources are **design references and validators**, consulted at design time and cited by ADR-0012. They are not imports, not data we ship, and not services we call.

---

## 7. Optional future translation layer (deferred)

There is a plausible, niche future in which a *translation layer* between our role vocabulary and the linguistic resources would have value — and it is worth naming so it is a conscious deferral, not an oversight:

- **SRL ingest.** If we ever want to *ingest* existing free-text records and auto-populate `Action`s, a small adapter mapping a third-party SRL tagger's output (`Arg0`/`Arg1`/`ArgM-*`, or FrameNet FEs) onto our `FrameRole`s would let us bootstrap a domain from a text corpus. The mapping is mostly the inverse of §4's table.
- **Linguistic-tooling export.** Conversely, exporting our `Action` stream into PropBank-`ArgM` or VerbNet-role form could let linguistic tools consume our data — relevant only if a research or compliance consumer demands it.

Both are **explicitly out of scope now.** They are low-demand, English-biased, and depend on the very resources §6 argues against coupling to. **The only translation layer we build now is the `schema.org.ai` JSON-LD export** (per the KR/semantic-web lens and the SYNTHESIS Phase-0 commitment to a lossless `@context`/`@graph` serializer). Any SRL-bridge layer would be a separate, opt-in module built only if a concrete consumer needs it — and even then, an LLM-based mapper would likely beat a hand-built one.

---

## 8. Sources

- [FrameNet — Wikipedia](https://en.wikipedia.org/wiki/FrameNet) — frames/FEs/LUs definitions and corpus statistics (~1,200 frames, ~10,000 FEs, ~13,000 LUs, 200,000+ annotated sentences).
- [What is FrameNet? — ICSI Berkeley](https://framenet.icsi.berkeley.edu/WhatIsFrameNet) — official project description; Frame Semantics origin (Fillmore).
- [FrameNet II: Extended Theory and Practice — Ruppenhofer, Ellsworth, et al.](https://my.eng.utah.edu/~cs6961/papers/FrameNet_book.pdf) — core vs. peripheral frame elements; frame-element specificity.
- [FrameNet at 25 — Boas, Baker, et al., *International Journal of Lexicography* (2024)](https://academic.oup.com/ijl/article/37/3/263/7708430) — 25-year retrospective; intellectual roots in "The Case for Case."
- [VerbNet — University of Colorado Boulder](https://verbs.colorado.edu/verbnet/index.html) — verb classes, ~23 thematic roles, scale figures; "largest online verb lexicon for English."
- [Martha Palmer — VerbNet project page](https://verbs.colorado.edu/~mpalmer/projects/verbnet.html) — VerbNet extends Levin (1993) classes.
- [VerbNet Annotation Guidelines](https://verbs.colorado.edu/verb-index/VerbNet_Guidelines.pdf) — thematic-role definitions (Agent, Patient, Topic-as-Theme).
- [Thematic Roles handout — Saeed, ch. 6 (SFU)](https://www.sfu.ca/~hedberg/Thematic_Roles.pdf) — standard thematic-role inventory and definitions.
- [The Proposition Bank — Palmer, Gildea & Kingsbury, *Computational Linguistics* (2005)](https://aclanthology.org/J05-1004.pdf) — numbered args `Arg0`–`Arg5`; `ArgM` modifiers; only `Arg0`/`Arg1` generalize across verbs.
- [PropBank Annotation Guidelines — Babko-Malaya](https://verbs.colorado.edu/~mpalmer/projects/ace/PBguidelines.pdf) — `ArgM` function-tag definitions.
- [English PropBank Annotation Guidelines — Bonial](https://verbs.colorado.edu/propbank/EPB-Annotation-Guidelines.pdf) — full `ArgM` tag inventory (`ArgM-MNR/TMP/LOC/CAU/DIR/GOL/PRP/PNC/…`).
- [PropBank lecture slides — University of Washington](http://faculty.washington.edu/fxia/lsa2011/slides/propbank.pdf) — `ArgM`s give "when, where, or how"; corpus-wide generalization.
- [Semantic Role Labeling via FrameNet, VerbNet and PropBank — Giuglea & Moschitti, COLING-ACL 2006 (P06-1117)](https://aclanthology.org/P06-1117/) — research pipeline interconnecting the three resources; [full PDF](https://aclanthology.org/P06-1117.pdf) reports 81% accuracy with the VerbNet-class-derived ILC feature vs. 62% without, on FrameNet role labeling outside FrameNet's coverage.
- [Action — schema.org](https://schema.org/Action) — `agent`/`object`/`instrument`/`participant`/`result`/`target`/`location`/`startTime`/`endTime`; no `beneficiary`; `recipient` on subtypes only.
- [Actions in schema.org (developer docs)](https://schema.org/docs/actions.html) — action model overview.
- [schema.org Terms of Service](https://schema.org/docs/terms.html) — Creative Commons Attribution-ShareAlike 3.0 license.
- [Five Ws — Wikipedia](https://en.wikipedia.org/wiki/Five_Ws) — journalism's who/what/when/where/why/how; Kipling's "six honest serving-men" (*Just So Stories*, 1902); taught in journalism by 1917.
