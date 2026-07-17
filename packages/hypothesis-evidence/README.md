# hypothesis-evidence

**The evidence spine of a startup bet** — the framework primitive that models a
founding hypothesis, the experiments that test it, the evidence they accrue, and
the stage gates that hypothesis must clear to advance. One module, schema + logic
together. It was moved _down_ out of startup-builder into this primitive so both
the builders and the `autonomous-startups` capstone can share one honest ledger
of what has actually been proven versus merely asserted — the same evidence-not-
aspiration discipline ADR 0001 enforces at every binding party test.

## Status — defensive name-claim stub (0.1.0, pre-1.0)

This is a **type-only placeholder** published under ADR 0001's fixation gate:
everything stays `0.x` until **≥2 real external binders prove the shape**. Nothing
here is entrenched — the four exported nouns are a marker for the eventual surface,
not a committed contract. The package exists so the bare `hypothesis-evidence` name
(verified unclaimed on npm) is held by this monorepo before a squatter takes it,
matching the framework-primitive family (`storybrand`, `lean-canvas`,
`positioning`, `pricing`).

There is **no implementation** yet. Do not depend on the type shapes; they will
change without a major bump while the package is `0.x`.

## Thesis (from the constitution, annex STRAWMAN-v2)

> Framework primitives (each one module, schema + logic together): `storybrand`,
> `lean-canvas`, `positioning`, `pricing`, **`hypothesis-evidence`
> (FoundingHypothesis / Experiment / EvidenceScaffold / StageGate)**, `digital-sites`.

See `org.ai` ADR 0001 — the four-register constitution.
