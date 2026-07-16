---
'autonomous-startups': minor
---

autonomous-startups: initial MVP of the capstone conceptual primitive.

The abstract self-running startup — a pure-domain definition kit that composes exactly
five primitives (business-as-code, services-as-software, digital-products, digital-tools,
digital-workers) and walks a construct through its construction lifecycle
(idea → named → sited → sellable → running), with every mutating transition gated by
`@org.ai/authority` at the type level. Surface: `defineStartup()` → `AutonomousStartup`,
the authority-gated `advance()`, `validateStartup()` (typed issues, never throws), and the
lifecycle machine. Consumes the `@org.ai/types` `Startup` schema noun rather than
redefining it — the runtime construct is distinct from the data shape. No HTTP, no db, no
platform coupling; the only runtime edge is to `@org.ai/types`. This is the G3 abstraction
in the G1–G5 ladder: startups.org.ai is its canon, startups.studio its venue.
