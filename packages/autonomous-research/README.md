# autonomous-research

> **Status: shipped (proof-of-life).** `literature-review-synthesizer`, `experiment-protocol-author`, and `manuscript-pre-submission-reviewer` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: R&D / scientific-research Services-as-Software, defined on the primitive substrate. Distinct from `autonomous-data` (data-engineering / analytics) — this package focuses on the research-team vertical: literature review synthesis, experiment protocol drafting, and manuscript pre-submission review.

## What this is

Concrete `Service.define({...})` calls for in-house R&D / scientific-research work — multi-source literature review with citation graph + recommended-reading priorities, hypothesis-grade experiment-protocol authoring with power analysis + IRB readiness, and pre-submission manuscript review with novelty + statistical-rigor + clarity passes — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`, `autonomous-security`. Fourteenth catalog package; advances v3 §15's "catalog Services" leg into the R&D / scientific-research vertical.

## Shipped Services

- **`literature-review-synthesizer`** — multi-source literature review for research initiatives. Trigger: research question + scope defined. Cascade: `fetch-existing-internal-research-and-bibliography-from-collab-tools (Code) → supervised-search-of-pubmed-arxiv-scholar-and-retrieve-full-texts-where-allowed (Agentic, supervised) → synthesize-themes-and-identify-gaps-and-contradictions (Generative) → draft-citation-graph-and-recommended-reading-priorities (Generative) → principal-investigator-review (Human, premium rationale) → emit-lit-review-doc-and-bibliographic-export (Code)`. EvaluatorPanel of 4 personas (citation-density-and-source-quality + scope-clarity (project-brief) + theme-coherence-checker + gap-identification-reviewer) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(principal-investigator))`. Pricing: `Pricing.outcome` 3-tier — narrow / medium / comprehensive ($499 / $1,999 / $5,999) — keyed on source-count band. Service-level reward = `lit-review-cycle-time-reduction-and-citation-coverage-score`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/research-leads/literature-review-synthesizer`.

  ```ts
  import { literatureReviewSynthesizer } from 'autonomous-research/literature-review-synthesizer'
  // typed as ServiceInstance<LiteratureReviewInput, LiteratureReviewOutput>
  ```

- **`experiment-protocol-author`** — research-experiment protocol drafting. Trigger: hypothesis + experimental approach proposed. Cascade: `fetch-prior-protocols-irb-policy-and-lab-equipment-inventory (Code) → draft-protocol-with-controls-sample-size-justification-and-power-analysis (Generative) → draft-irb-readiness-checklist-and-ethical-considerations (Generative) → pi-and-irb-coordinator-review (Human, regulatory rationale) → emit-protocol-doc-and-irb-submission-package (Code)`. EvaluatorPanel of 4 personas (power-analysis-soundness-checker + regulatory-compliance (hipaa) + edge-case-coverage (min 5) + ethical-coverage-reviewer) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(principal-investigator))`. Pricing: `Pricing.perInvocation` 3-tier — simple-observational / interventional-low-risk / interventional-high-risk ($299 / $1,499 / $4,999) — keyed on study-risk band. Service-level reward = `IRB-first-submission-acceptance-rate`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/research-leads/experiment-protocol-author`.

  ```ts
  import { experimentProtocolAuthor } from 'autonomous-research/experiment-protocol-author'
  // typed as ServiceInstance<ExperimentProtocolInput, ExperimentProtocolOutput>
  ```

- **`manuscript-pre-submission-reviewer`** — pre-submission manuscript review. Trigger: research manuscript draft + target journal selected. Cascade: `fetch-manuscript-target-journal-style-guide-and-co-author-list (Code) → scope-and-novelty-check-against-current-literature (Generative) → figure-and-table-quality-pass-statistical-rigor-pass-and-writing-clarity-pass (Generative) → draft-revision-recommendations-with-priority (Generative) → senior-author-review (Human, premium rationale) → emit-review-memo-and-revision-tracker (Code)`. EvaluatorPanel of 4 personas (novelty-assessment-and-factual-grounding (peer-reviewed only) + statistical-rigor-checker + clarity-and-style-fit-checker + regression-risk (process)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(senior-author))`. Pricing: `Pricing.outcome` 3-tier — short-letter / standard-article / review-or-major ($199 / $799 / $1,999) — keyed on manuscript-length band. Service-level reward = `first-revision-acceptance-rate-improvement`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/research-leads/manuscript-pre-submission-reviewer`.

  ```ts
  import { manuscriptPreSubmissionReviewer } from 'autonomous-research/manuscript-pre-submission-reviewer'
  // typed as ServiceInstance<ManuscriptReviewInput, ManuscriptReviewOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate. Distinct from `autonomous-data` (which covers data-engineering / analytics / dbt / metrics) — R&D / scientific-research is a peer vertical with its own buyer (research-lead / PI / senior-author) and its own regulatory + ethical posture (IRB, peer-review norms, ORI / GLP).

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.perInvocation({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (lit-review-cycle-time-and-citation-coverage → IRB-first-submission-acceptance → first-revision-acceptance-rate terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`, `autonomous-security`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
