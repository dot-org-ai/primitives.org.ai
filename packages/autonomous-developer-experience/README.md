# autonomous-developer-experience

> **Status: shipped (proof-of-life).** `api-docs-writer` is implemented on the v3 `services-as-software` surface + `autonomous-finance` substrate. Sibling packages: `autonomous-finance-services` (`bookkeeper`), `autonomous-customer-success`, `autonomous-revenue`.

Catalog package: developer-experience Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for developer-facing work that the agentic economy can deliver as software. Sibling of `autonomous-finance/services/*`, `autonomous-customer-success`, `autonomous-revenue`.

## Initial Service

- **`api-docs-writer`** — repo URL → AST extract API surface → describe each symbol → cross-link → publish to GitHub Pages. Pure-autonomous (zero HITL, zero clarification round-trips). Composite pricing (one-time per repo + metered per documented symbol). External predicate verifies GitHub Pages deployment + 200 status. Lineage: `occupations.org.ai/TechnicalWriters` × `processes.org.ai/APIReferenceAuthoring`.

## Future Services (sketched)

- **`changelog-generator`** — git history range → categorized + customer-facing changelog → publish
- **`sdk-generator`** — OpenAPI spec → typed SDK in N languages → published packages
- **`migration-guide-writer`** — version diff → migration guide with code transformations
- **`tutorial-author`** — feature doc → end-to-end tutorial with runnable code
- **`example-suite-builder`** — repo + examples directory → maintained example apps with CI

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped against the v3 surface:

- **`services-as-software` v3** — `Service.define` + `EvaluatorPanel.define` + `Personas` (coverage / accuracy / voice) + `OutcomeContract.predicate` with `External({ verifier: 'github-pages' })`.
- **`autonomous-finance`** — `Pricing.composite({ base, metered })` (one-time per-repo + metered per-symbol), `RefundContracts['quality-floor-fail']`, `AuthorityBoundaries['self-only']`.
- **`digital-tools`** — `Code` / `Generative` / `Agentic` Function sugar (no `Human` — pure-autonomous).

## References

- Beads epic: `aip-viti`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
