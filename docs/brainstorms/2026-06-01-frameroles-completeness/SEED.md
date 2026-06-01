# SEED — Is the digital-objects FrameRole taxonomy complete, or under-represented?

**Date:** 2026-06-01 · **Mode:** completeness probe (creative discovery + rigorous reduction test)

We are about to lock the `FrameRole` taxonomy for `digital-objects` (the SVO runtime layer). The committed set is **11 roles**. The user's gut: this may under-represent what *any* digital-object's actions need in the future. Before declaring it canonical & exhaustive, we want creative agents to actively try to find **legit additional roles** — or build confidence the set is complete enough.

## The committed taxonomy (what you are stress-testing)

Roles answer **5W+H**. Two tiers:

**Core valency roles** (declared per-Verb in its `Frame`):
- `subject` (who) · `object` (what) · `recipient` (to-whom) · `beneficiary` (for-whom) · `source` (from) · `destination` (to-where) · `instrument` (with/via) · `topic` (about) · `result` (into/produces)

**Universal adjuncts** (attach to ANY Action, not per-verb):
- `how` (manner; may be value-constrained per verb, e.g. agent oversight: autonomous/supervised/human-approved/escalated) · `why` (cause — an Action ref) · `when` (Action-native: createdAt/completedAt) · `where` (Action-native: location)

Names are SVO/English-native; export target is `schema.org.ai/Action` (a superset we OWN, aligning with schema.org where terms overlap, first-class extensions otherwise).

Shape: a package-level `ROLE_META` constant holds each role's `{ word, preposition, surfaceOrder, fillerKind: thing|action|tool|literal, dereference: get|getAction|identity, schemaOrg }`; the per-Verb `Frame` declares only valency (`role: NounRef` shorthand, or `{ noun, required, direction, fanRegime, enum }`).

## Prior art (your starting ground — our 11 is a known subset)

- **VerbNet** thematic roles (~30): Agent, Patient, Theme, Experiencer, Stimulus, Instrument, Recipient, Beneficiary, Source, Goal/Destination, Location, Time, Manner, Cause, **Asset, Value, Extent, Material, Product, Co-Agent, Co-Patient, Attribute, Predicate, Pivot, Trajectory, Initial_Location, Duration, Frequency, Reflexive**…
- **PropBank** `ArgM` modifiers (~15): MNR (how), TMP (when), LOC (where), CAU (why/cause), **DIR** (direction), **GOL** (goal), **PNC/PRP** (purpose ≠ cause), **EXT** (extent), **COM** (comitative=with-whom), **PRD** (secondary predication), **MOD** (modality), **NEG** (negation), **DIS** (discourse), **ADV**.
- **schema.org/Action**: agent, object, instrument, participant, result, target, error, location, startTime, endTime, **provider**, **purpose** (on some types).
- **W3C PROV-O**: wasDerivedFrom, wasGeneratedBy, wasAttributedTo, used, wasInformedBy.

So established systems carry roles we lack — e.g. **purpose** ("in order to", distinct from `why`/cause "because of"), **co-agent/comitative** ("with the union"), **value/amount/extent** ("$5M", "40%"), **duration/frequency** ("for 12 months", "monthly"), **material/product** (transformation), **condition/contingency**, **authority/provider**, **evidence/basis**, **confidence**.

## The reduction test (apply to EVERY proposed role)

A proposed role earns inclusion ONLY if all three hold:
1. **Real** — it appears in concrete digital-object actions across the codebase's domains (business-as-code, services-as-software, autonomous-agents, digital-workers, digital-tasks, human-in-the-loop, ai-database).
2. **Load-bearing** — it is queried, rendered, gate-relevant, or governed in a way that **`Action.data` (untyped) cannot serve** (data is the fallback for everything; a role must beat it).
3. **Irreducible** — it does NOT collapse into an existing role (e.g. "amount" might just be `data`; "co-agent" might be a second `subject`; "purpose" might be `why`).

If a candidate fails any test → it stays `data` or maps to an existing role. Rank survivors by confidence.

## The meta-question to also answer

Should the taxonomy be **(a) closed but possibly larger** (a fixed canonical set the realizer/gate/exporter reason over exhaustively), or **(b) a closed core + a documented `schema.org.ai`-namespaced extension path** for domain-specific roles (mirroring how we already handle schema.org-aligned roles + our extensions)? Make a recommendation.

## The 4 lenses
- **Lens 1 — Linguistic prior-art completeness:** comb VerbNet / PropBank / Fillmore case grammar / thematic-relations theory for roles we lack; which are legit for a general runtime?
- **Lens 2 — Business / finance / contracts / transactions** (business-as-code, finance): money, value, consideration, counterparty, term, frequency, condition.
- **Lens 3 — Agentic execution / process / governance** (autonomous-agents, digital-workers, human-in-the-loop, digital-tasks): purpose/goal, authority, approver, precondition, deadline/SLA, priority, dependency.
- **Lens 4 — Provenance / epistemics / knowledge** (KR, W3C PROV-O, scientific claims, data lineage): derivedFrom, evidence/basis, confidence, method, attribution, version.

Each lens stays in its region and applies the reduction test.
