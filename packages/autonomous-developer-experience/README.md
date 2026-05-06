# autonomous-developer-experience

> **Status: shipped (proof-of-life).** `api-docs-writer` is implemented on the v3 `services-as-software` surface + `autonomous-finance` substrate. Sibling packages: `autonomous-finance-services` (`bookkeeper`), `autonomous-customer-success`, `autonomous-revenue`.

Catalog package: developer-experience Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for developer-facing work that the agentic economy can deliver as software. Sibling of `autonomous-finance/services/*`, `autonomous-customer-success`, `autonomous-revenue`.

## Shipped Services

- **`api-docs-writer`** — repo URL → AST extract API surface → describe each symbol → cross-link → publish to GitHub Pages. Pure-autonomous (zero HITL, zero clarification round-trips). Composite pricing (one-time per repo + metered per documented symbol). External predicate verifies GitHub Pages deployment + 200 status. Lineage: `occupations.org.ai/TechnicalWriters` × `processes.org.ai/APIReferenceAuthoring`.
- **`changelog-generator`** — git history range → categorized + customer-facing changelog → publish.
- **`sdk-generator`** — OpenAPI spec → typed SDK in N languages → published packages.
- **`migration-guide-writer`** — version diff → migration guide with code transformations.
- **`tutorial-author`** — feature doc → end-to-end tutorial with runnable code.
- **`example-suite-builder`** — repo + examples directory → maintained example apps with CI.
- **`release-readiness-checklist`** — pre-release gate Service triggered when a PR is labelled `release-candidate`. Cascade: `fetch-pr-diff-issues-tests (Code) → check-release-notes-completeness (Generative) → check-breaking-changes-documented (Generative) → maintainer-sign-off-on-release-blockers (Human) → emit-readiness-report-and-set-pr-status-check (Code)`. EvaluatorPanel of 3 personas (check-coverage + breaking-changes-flagged + maintainer-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch, EvaluatorPass, HumanSign(maintainer))`. Pricing: `Pricing.perInvocation` 3-tier by changed-LOC (small-PR / medium-PR / large-PR). Service-level reward = `post-release-incident-rate-improvement`. Archetype: `quality-gate`. Lineage: `business.org.ai/cells/software-developers/release-readiness-gate`.
- **`incident-postmortem-author`** — post-incident retrospective authoring. Trigger: incident resolved + postmortem-due. Cascade: `fetch-incident-timeline-slack-and-monitoring (Code) → synthesize-narrative-with-rca-candidates (Generative) → draft-action-items-with-owners (Generative) → ic-and-engineering-leader-review (Human) → publish-postmortem-and-create-action-item-issues (Code)`. EvaluatorPanel of 3 personas (rca-quality-reviewer + action-actionability-checker + ic-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch, EvaluatorPass, HumanSign(ic))`. Pricing: `Pricing.outcome` across SEV3 / SEV2 / SEV1+ tiers ($199 / $799 / $2,499). Service-level reward = `time-to-postmortem-published-improvement`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/software-developers/incident-postmortem-author`.

  ```ts
  import { incidentPostmortemAuthor } from 'autonomous-developer-experience/incident-postmortem-author'
  // typed as ServiceInstance<IncidentResolvedInput, PostmortemOutput>
  ```

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
