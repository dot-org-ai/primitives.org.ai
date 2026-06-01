---
"services-as-software": minor
---

Add the v4 consumable surface (aip-cnks.7.2–.7.5): the four-layer Deliverable
envelope (`contract`/`implementation`/`dependencies`/`commercial`), the
assurance→gatingBasis ceiling (author-time type narrowing), the `Service()`
authoring front door, the 11-state invocation FSM + handle, and the graph
discovery surface (`match` Demand→Offer + `derive`/`project` lenses + the locked
`ResponseEnvelope`). Exposed via the additive `./v4` subpath export. Runtime
cascade/gate/settle wiring is injected (default no-op stubs) pending the
follow-on integration epic.
