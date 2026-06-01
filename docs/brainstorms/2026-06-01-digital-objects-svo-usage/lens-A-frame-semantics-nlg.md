# Lens A — Frame Semantics / NLG / Computational Linguistics

## Lens thesis

Every business fact is a sentence with a predicate, and every predicate has a frame: a fixed inventory of who-did-what-to-whom-with-what-for-whom. If the `Frame`/`Verb`/`Action` model captures Fillmore's case roles faithfully — subject, object, recipient, source, destination, instrument, topic, cause, manner — then the *same* declaration that lets a consumer *write* a fact (`db.Contact.qualify(ada, { by: rep, instrument: pipeline })`) also lets a generator *read it back out* as language (`"Rep Alvarez qualified Ada via the enrichment pipeline on Tuesday"`). The Frame is simultaneously a write-time slot contract and a read-time surface-realization template. The conjugation forms (`action/act/activity/event` + `reverse{by,at,in,for}`) are not decoration — they are the morphology that lets one stored `Action` be rendered in active or passive voice, present or past tense, imperative or progressive aspect, and as a derived passive *field* on the object (`order.placedBy`). When a million startups each emit a stream of Actions, the entire history of every company becomes a corpus of grammatically-complete sentences that can be narrated, queried in the passive, translated, and constrained as LLM generation targets — *because the grammar was declared up front.*

---

## The use cases

### 1. Ditransitive `give`/`grant`/`transfer` — all four core roles filled at once

**Scenario.** A finance domain records equity grants. `boardChair.granted(shares, { recipient: employee, source: optionPool, instrument: '409a-valuation' })`. The resulting Action: `{ verb: 'grant', subject: chairId, object: sharesId, roles: { recipient: empId, source: poolId, instrument: 'Tool:409a' } }`. Generated audit line: *"Board chair Diaz granted 4,000 shares to engineer Okonkwo from the 2026 option pool, valued via the 409a appraisal."*

**Linguistic mechanism.** A true ditransitive (S–V–O–recipient) plus an ablative `source` and an `instrument`. Four non-subject roles co-occur. Surface realization orders them by English oblique conventions (object → `to`+recipient → `from`+source → `via`/`valued via`+instrument).

**Demand on the interface.** `Frame` must permit `object` + `recipient` + `source` + `instrument` *simultaneously* on one Verb, and `Action.roles` must hold all of them at once. The renderer needs each `FrameRole` to map to a stable preposition (`recipient`→"to", `source`→"from", `destination`→"to/into", `instrument`→"via/with"). That preposition mapping should live alongside the role taxonomy (a `rolePreposition: Record<FrameRole, string>` constant) so generation isn't reinvented per consumer.

### 2. Passive-voice query: derive `order.placedBy` from `reverse.by`

**Scenario.** A consumer never stored a field called `placedBy`; they stored `customer.placed(order)`. Later code reads `order.placedBy` and gets back the customer Thing. The accessor is *synthesized* from the `place` Verb's `reverse.by = 'placedBy'` plus the inverse traversal of Actions where this order is the `object`.

**Linguistic mechanism.** Active→passive voice transformation. `subject placed object` ⇄ `object was placed by subject`. The `reverse.by` conjugation names the passive accessor; the graph edge supplies the filler.

**Demand on the interface.** The committed `digital-objects` `Verb` currently has *flat* `reverseBy/reverseAt/reverseIn` while graphdl has *nested* `reverse: { by, at, in, for }`. The SEED commits to graphdl's nested form — Lens A strongly seconds that, **and adds: the nested form must include `for`** (graphdl has it; digital-objects' flat form drops it — see use case 4). The renderer/accessor-synthesizer must read `verb.reverse.by` to name the passive field, and resolve it by querying Actions with `object === thisThing && verb === thisVerb`, returning the `subject`. This makes every active Verb automatically yield a passive query surface with zero extra declaration.

### 3. Generated audit trail / activity feed from the raw Action log

**Scenario.** `digital-workers` shows a "what happened" feed. Each `Action` renders as one past-tense sentence: *"Alice qualified Acme Corp on Tuesday via the enrichment pipeline."* The generator walks `listActions({ subject: alice })`, and for each: resolves `verb.event` (past participle "qualified"), the subject's display name, the object's name, `roles.instrument` → "via the enrichment pipeline", and `Action.completedAt` → "on Tuesday".

**Linguistic mechanism.** Past-tense surface realization from `verb.event` (the past-participle conjugation). Temporal adjunct from `completedAt` (the `when`, carried on Action, not in the role taxonomy). Instrument adjunct from `roles.instrument`.

**Demand on the interface.** `Action` must reliably carry `completedAt` *and* `createdAt` (it does) so the renderer can choose the right temporal anchor per aspect (started-at vs finished-at). `verb.event` must always be populated (auto-derived via graphdl's `toPastParticiple` when not given) — a renderer cannot fall back to the bare verb name for past tense ("qualify Acme" is ungrammatical as a log line). So: **`event` must be guaranteed non-empty after `defineVerb`,** even for irregular verbs (graphdl's linguistics owns the irregular table).

### 4. Beneficiary / purpose role: `reverse.for` → "on behalf of" / "for"

**Scenario.** A services-as-software agent files a document *for* a client. `agent.filed(taxReturn, { recipient: irs, for: clientCo })`. Generated: *"Agent Lin filed the 2025 return with the IRS on behalf of Northwind Co."* Querying the passive surface: `taxReturn.filedFor` → Northwind.

**Linguistic mechanism.** The benefactive case (Fillmore's *beneficiary*). Distinct from `recipient` (who *receives* the object) — the beneficiary is who the action is *performed for*. English realizes it as "for" / "on behalf of".

**Demand on the interface.** Two-part. (a) The nested `reverse.for` must survive into `digital-objects`' Verb (the flat `reverseBy/At/In` form has no `for` slot — this is a concrete reason the SEED's "use graphdl's nested reverse" decision is correct). (b) The benefactive needs a home in the *write*-side `FrameRole` taxonomy. Today the closed taxonomy is `subject|object|recipient|source|destination|instrument|topic|cause|manner` — there is **no beneficiary role.** Either add `beneficiary` to `FrameRole`/`Frame`, or rule that `recipient` doubles as beneficiary and document the prepositional split at render time. Lens A's position: add `beneficiary`; conflating "to whom" and "for whom" makes a large class of agency/representation sentences (every services-as-software act done *on behalf of* a client) unrenderable distinctly.

### 5. Manner adverb as a *literal enum*, not a Thing

**Scenario.** A loan is approved with a qualifier: `underwriter.approved(loan, { manner: 'conditionally' })`. Generated: *"Underwriter Park conditionally approved the loan."* The verb `approve` declares `frame.manner: ['conditionally', 'provisionally', 'unanimously', 'reluctantly']`.

**Linguistic mechanism.** Manner adverbial. Unlike every other role, the filler is *not* an entity — it's an adverb drawn from a closed vocabulary the Verb itself defines. Surface realization places it pre-verbally ("conditionally approved") or post-verbally per the adverb.

**Demand on the interface.** This is already designed correctly and Lens A wants it *protected*: `Frame.manner: string[]` (an enum list, not a `NounRef`), and `Action.roles.manner` holding a `string` (not a `ThingRef`). The renderer must branch on role type: `manner` realizes as an adverb literal; all others resolve a Thing and realize as a noun phrase. **Demand: `Action.roles` value type must remain the union `ThingRef | string`, and the consuming renderer must know — from the Frame — which roles are entity-shaped vs literal-shaped.** That means `Frame` is the authority that tells the renderer "manner is a literal, instrument may be a Tool literal or a Thing, the rest are Things."

### 6. Causal chaining: `reason → because of` across Actions

**Scenario.** A refund cites its cause: `system.refunded(payment, { cause: disputeActionId })` where `disputeActionId` points at the earlier `customer.disputed(charge)` Action. Generated, with cause expansion: *"The system refunded the $40 payment because the customer disputed the charge on May 3rd."*

**Linguistic mechanism.** Causal subordination. The `cause` role links one Action to a *prior Action* (not a Thing), and the renderer can recursively realize the cause clause as a subordinate "because …" sentence — turning a flat event log into a causally-linked narrative paragraph.

**Demand on the interface.** `Frame.cause: 'Action'` and `Action.roles.cause` holding an `ActionRef` — i.e., the `cause` slot's filler is an *Action id*, not a Thing id. The current types say `Action.roles?: Partial<Record<FrameRole, ThingRef | string>>` — `ActionRef` is structurally a string so it *fits*, **but the renderer needs to know `cause` resolves via `getAction` not `get`.** Demand: the Frame's typing of `cause` as `'Action'` must be the signal that this role is dereferenced as an Action and recursively narrated. (This is the linguistic counterpart to event-sourcing's causation-id; Lens A only claims the *narrative* use — a readable "because" clause.)

### 7. Progressive aspect for in-flight work: "is qualifying" vs "qualified"

**Scenario.** A live ops dashboard shows agents mid-task. An Action with `status: 'active'` and no `completedAt` renders in the progressive: *"Alice is qualifying Acme Corp."* When `status: 'completed'`, the same Action flips to *"Alice qualified Acme Corp."* `status: 'pending'` → future/prospective: *"Alice will qualify Acme Corp"* / *"Acme Corp is queued for qualification."*

**Linguistic mechanism.** Aspect/tense selection driven by lifecycle status. `active` → progressive (uses `verb.activity`, the gerund "qualifying"). `completed` → simple past (`verb.event`). `pending` → prospective (`verb.action` under "will"). This is a clean status→aspect mapping.

**Demand on the interface.** A renderer needs *all three* conjugation forms reliably present on every Verb: `activity` (gerund, for `active`), `event` (past participle, for `completed`), `action` (base, for `pending`). The `ActionStatusType` set (`pending|active|completed|failed|cancelled`) must be the documented switch. **Demand: define a canonical `status → aspect → conjugation-field` mapping as part of the package** (e.g. `active→activity`, `completed→event`, `pending→"will "+action`, `failed→"failed to "+action`, `cancelled→"cancelled "+activity`) so every consumer narrates lifecycle identically. `failed`/`cancelled` especially need a stance ("failed to qualify", "cancelled the qualification of") or feeds across the 1M startups will read inconsistently.

### 8. The Frame as an LLM generation *contract* (slot-filling, not free text)

**Scenario.** The cascade asks an LLM to *compose* an Action: "Acme just signed; record what happened." Instead of free-form JSON, the LLM is handed the `sign` Verb's Frame as a slot schema and must emit exactly `{ subject: Company, object: Contract, recipient?: Org, instrument?: Tool }`. The Frame becomes the JSON-schema-like constraint: the LLM may fill `recipient` and `instrument` but cannot invent a `topic` because `sign`'s Frame has no `topic` slot.

**Linguistic mechanism.** Valency as a generation constraint. A Verb's Frame *is* its valence frame; an LLM composing an Action is doing FrameNet-style frame-element filling. Roles absent from the Frame are illegal fillers.

**Demand on the interface.** The `Frame` must be mechanically convertible to a generation schema: each declared role → an optional/required slot whose value-type is `NounRef`-constrained (the filler must be a Thing of that Noun, or for `instrument`, a Tool, or for `manner`, one of the enum strings). Demand: **`Frame` needs a derivable "required vs optional" distinction per role.** Right now only `subject` is required (non-optional in the type); everything else is optional. Some verbs *require* their object (`assign` with no object is meaningless). Lens A asks for a way to mark a role required within a Frame — minimally, a convention that a role typed as `NounRef` (vs `NounRef | undefined`) is required, or an explicit `requiredRoles` set — so the LLM contract can reject incomplete Actions at compose time.

### 9. Madlib query templates derived from a Frame

**Scenario.** A no-code query builder reads the `ship` Verb's Frame and auto-generates a fill-in-the-blanks UI: *"Show me every time ⟦Warehouse⟧ shipped ⟦Product⟧ to ⟦Customer⟧ via ⟦Carrier⟧."* Each blank is a typed dropdown populated from the Noun the Frame names for that role. Selecting fillers builds an `ActionOptions` query.

**Linguistic mechanism.** Frame → sentence template with typed gaps. The Verb's conjugation (`act` = "ships", or `event` = "shipped" for historical queries) sets the predicate; each `FrameRole` becomes a labeled gap typed by its `NounRef`.

**Demand on the interface.** Each role in a `Frame` must carry enough to label and type its gap: the `NounRef` (for the dropdown's entity type and the human label "Customer") and an ordering. **Demand: a stable, documented role *ordering* for surface realization** (subject, [aux], verb, object, recipient, destination, source, instrument, topic, manner) so both the madlib template and the audit renderer (use case 3) produce identically-ordered, grammatical sentences. Without a canonical role order, every consumer guesses word order.

### 10. Cross-language rendering of one Action graph (NEW — no prior system does this from a business-runtime log)

**Scenario.** A startup operating in the EU emits its Action stream once. The compliance export renders the *same* Actions as German and French audit trails: *"Vertreterin Alvarez hat Ada am Dienstag qualifiziert."* / *"La représentante Alvarez a qualifié Ada mardi."* The graph stores no language — it stores `verb`, roles, and timestamps. Each locale supplies a conjugation/realization table; the role→preposition map and word order swap per locale.

**Linguistic mechanism.** Surface realization is locale-pluggable because the stored fact is *interlingual* (roles + verb identity + entities), not a string. German pushes the participle to the clause end; Romance languages put the auxiliary before the participle; the `recipient` preposition differs ("to" / "à" / no preposition + dative case).

**Demand on the interface.** This is the payoff of separating Frame (language-neutral role structure) from conjugation (language-specific morphology). Demand: **the `Verb`'s conjugation forms (`action/act/activity/event/reverse`) and the role→preposition/word-order rules must be cleanly separable from the `Action`/`Frame` data** so a non-English realizer can be swapped in without touching stored Actions. Concretely, conjugation should be resolvable through a pluggable linguistics provider (graphdl already owns English linguistics — the seam to localize is *there*, and `digital-objects` must not bake English word order into `Action` storage). The interface is already close: no English string is stored on `Action`. Protect that.

### 11. Whole-company narrative reconstruction — "the autobiography of a startup" (NEW)

**Scenario.** `explore.startups.studio` generates a startup; six months of agent/human/code activity accrue as Actions. A founder clicks "tell the story so far" and gets a chaptered prose narrative: *"In March, the founding agent incorporated Northwind. It hired three digital workers. In April, worker Lin qualified 1,200 leads, of which 40 converted because the pricing agent discounted the enterprise tier…"* The narrator groups Actions by `createdAt` period, clusters by subject, and chains causes (use case 6) into paragraphs.

**Linguistic mechanism.** Discourse-level NLG: aggregation (collapsing 1,200 `qualify` Actions into "qualified 1,200 leads"), referring-expression generation ("It" for the recently-mentioned company), and temporal discourse markers ("In March", "then", "because"). All sourced from `verb` + `roles` + timestamps + `cause` links.

**Demand on the interface.** Aggregation needs the renderer to *count and group* Actions by `(verb, subject)` and realize a cardinality ("qualified 1,200 leads") rather than 1,200 sentences — so `listActions` must support grouping/counting efficiently (Lens B owns the storage; Lens A's demand is only that the *count of objects per (subject,verb)* be a first-class queryable, since "qualified 1,200 leads" is a fundamentally different sentence from "qualified Acme"). And referring-expression generation needs each Thing to expose a stable display name + Noun (for "the company" vs "it") — so `Thing` should be renderable to a canonical label without a bespoke lookup per consumer.

### 12. Inverse-verb narration: undo/reversal reads naturally (NEW use of `verb.inverse`)

**Scenario.** A subscription is cancelled, then reinstated. `subscribe` declares `inverse: 'unsubscribe'`. When the system reverses an Action, instead of logging a cryptic "delete edge", it narrates the *inverse* verb: *"Customer Reyes unsubscribed from Pro on May 1st, then re-subscribed on May 8th."* A "what was undone" view filters Actions whose verb is the `inverse` of an earlier one against the same object.

**Linguistic mechanism.** Antonymic/converse predicate selection via `verb.inverse`. Reversal is not negation ("did not subscribe") — it's the converse predicate ("unsubscribe"), which reads as an affirmative sentence. Pairs an Action with its undo as a single narrative beat.

**Demand on the interface.** `verb.inverse` must be a first-class, populated field the renderer can resolve to *another Verb* (to pull *its* conjugations: "unsubscribed"). Demand: `inverse` should reference a Verb that itself has full conjugations defined (or be auto-conjugable), so the narrator can render the inverse in any tense/aspect. The renderer also needs to *pair* an Action with the Action it reverses — which reuses the `cause`/`ActionRef` linkage from use case 6 (the reinstatement's `cause` = the cancellation Action).

---

## Highest-leverage use case + the single sharpest demand

**Highest-leverage: #11 — the autobiography of a startup (whole-company narrative reconstruction), with #3 (audit trail) and #8 (Frame-as-LLM-contract) as its load-bearing substructure.**

I hold this position firmly. At 1,000,000 startups, the differentiating asset is not that the system *stored* what happened — every database does that. It is that the entire operational history of every generated company is, by construction, a corpus of grammatically-complete, voice-and-tense-renderable, causally-linked sentences that can be narrated to a human, queried in the passive, constrained as an LLM target, and re-rendered in any language — *with no per-startup NLG engineering*, because the grammar was declared once on the Verbs. The same `Frame` that constrains the LLM writing a fact (#8) realizes the sentence reading it back (#3), and accumulates into the company's story (#11). That round-trip — *write a fact through a frame, read the fact back as a sentence through the same frame* — is the 1000× moment: language in equals language out, losslessly, at population scale.

**The single sharpest demand on the interface:** the `Frame` must be a *complete bidirectional realization contract* — every `FrameRole` it declares must carry (a) its filler *type discipline* (entity-shaped `NounRef`, the `Tool` literal for instrument, the `Action` ref for cause, or the literal-enum for manner), (b) its *required-vs-optional* status, and (c) a *stable surface position + preposition* — so that a single, package-owned realizer can turn any `Action` into a grammatical sentence in active *or* passive voice and any lifecycle aspect, and conversely validate any LLM-composed `Action` against the frame. Concretely, the model needs a package-level constant binding each `FrameRole` to `{ preposition, surfaceOrder, fillerKind: 'thing'|'action'|'tool'|'literal', dereference: get|getAction|identity }`, and a way for a `Frame` to mark roles required. Without that constant, every consumer reinvents word order and preposition choice, and the round-trip is lossy.

---

## Requirements this lens imposes on the committed interface (synthesis-ready)

- **Adopt graphdl's nested `reverse: { by, at, in, for }`** on `digital-objects`' `Verb` (the SEED's stated decision) — and ensure `for` survives; the flat `reverseBy/At/In` form has no benefactive slot (use cases 2, 4).
- **Add a `beneficiary` `FrameRole`** (or formally rule that `recipient` doubles as beneficiary with a documented prepositional split). "On behalf of / for whom" is distinct from "to whom" and pervades agency/representation acts (use case 4).
- **Guarantee all conjugation forms are non-empty after `defineVerb`** — `action`, `act` (3rd-person), `activity` (gerund), `event` (past participle), including irregulars — since renderers select among them by tense/aspect (use cases 3, 7).
- **Define a canonical `status → aspect → conjugation` mapping in the package** (`active→activity`, `completed→event`, `pending→will+action`, `failed→failed to+action`, `cancelled→cancelled+activity`) so all consumers narrate lifecycle identically (use case 7).
- **Provide a package-owned `FrameRole → { preposition, surfaceOrder, fillerKind, dereference }` constant** so audit rendering and madlib templates produce identically-ordered grammatical output and resolve each role correctly (use cases 1, 6, 9 — the sharpest demand).
- **Preserve `Action.roles` value type as `ThingRef | string`,** and make the *Frame* the authority on which roles are entity-shaped (resolve via `get`), Action-shaped (`cause` → `getAction`), Tool-literal (`instrument`), or pure literal (`manner`) (use cases 5, 6).
- **Add a required-vs-optional marker per role within a `Frame`** (convention: `NounRef` = required, `NounRef | undefined` = optional; or an explicit `requiredRoles`) so a Frame can serve as an LLM generation contract that rejects incomplete Actions (use case 8).
- **Keep `Action` storage strictly language-neutral** (no English strings on `Action`); resolve all conjugation/word-order through a pluggable linguistics layer (graphdl) so non-English realizers swap in without touching stored facts (use case 10).
- **Expose a canonical display label + Noun per `Thing`** so referring-expression generation ("the company" / "it") and madlib dropdowns work without per-consumer lookup logic (use cases 9, 11).
- **Support grouping/counting `listActions` by `(verb, subject)`** so narrative aggregation ("qualified 1,200 leads") is expressible rather than 1,200 separate sentences (use case 11; storage mechanics belong to Lens B).
- **Keep `verb.inverse` first-class and resolvable to a fully-conjugable Verb,** and reuse the `cause`/`ActionRef` link to pair an Action with the Action it reverses, so undo/reinstatement narrates as affirmative converse predicates (use case 12).
