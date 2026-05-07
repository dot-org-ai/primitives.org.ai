# autonomous-product

> **Status: shipped (proof-of-life).** `prd-author`, `customer-feedback-synthesizer`, and `roadmap-tradeoff-evaluator` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: product-management Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for product-management work — Product Requirements Document drafting, multi-source customer-feedback synthesis, quarterly-roadmap tradeoff modeling — that the agentic economy can deliver as software. Sibling of `autonomous-operations`, `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-legal`, `autonomous-people`. Eleventh catalog package (paired with `autonomous-data` shipping in parallel); advances v3 §15's "catalog Services" leg into the product-management vertical.

## Shipped Services

- **`prd-author`** — feature / initiative / product-launch ready-for-PRD trigger → PM-and-tech-lead-reviewed PRD doc + linked Jira epic. Trigger: feature / initiative reaches the ready-for-PRD stage. Cascade: `fetch-feature-context-customer-research-and-competitor-analysis (Code) → synthesize-problem-statement-user-stories-and-acceptance-criteria (Generative) → draft-success-metrics-risks-and-dependencies (Generative) → product-manager-and-tech-lead-review (Human, approval rationale) → emit-prd-doc-and-linked-jira-epic (Code)`. EvaluatorPanel of 6 personas (problem-clarity-checker + acceptance-criteria-coverage-checker + metric-actionability-reviewer + `Personas.budgetRealism({ budgetType: 'all' })` + `Personas.timelineRealism({ dependencyAware: true })` + product-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(product-manager))`. Pricing: `Pricing.outcome` 3-tier — feature / initiative / product-launch ($799 / $2,999 / $9,999) keyed on PRD scope. Service-level reward = `prd-acceptance-rate-on-first-review`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/product-managers/prd-author`.

  ```ts
  import { prdAuthor } from 'autonomous-product/prd-author'
  // typed as ServiceInstance<PrdTriggerInput, PrdDocumentOutput>
  ```

- **`customer-feedback-synthesizer`** — weekly product-team cadence trigger → citation-dense themes doc clustering customer signal across 5 source systems (support / sales / surveys / community / churn). Trigger: weekly cron + product-team review cadence. Cascade: `fetch-support-tickets-sales-calls-surveys-community-and-churn-notes (Code) → cluster-feedback-by-theme-and-severity (Agentic, supervised) → synthesize-themes-with-citation-density-and-opportunity-rankings (Generative) → emit-themes-doc-and-linked-source-artifacts (Code)`. EvaluatorPanel of 4 personas (theme-coherence-checker + `Personas.factualAccuracy({ minCitationsPerClaim: 3 })` citation-density-checker + signal-noise-discrimination-reviewer + product-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass)` — no HumanSign because the artefact is a research synthesis the product-team reads, not an externally-shipped doc. Pricing: `Pricing.subscription` $1,499/mo per product-team. Service-level reward = `feedback-cycle-time-reduction-and-feature-conversion-rate`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/product-managers/customer-feedback-synthesizer`.

  ```ts
  import { customerFeedbackSynthesizer } from 'autonomous-product/customer-feedback-synthesizer'
  // typed as ServiceInstance<FeedbackCycleInput, FeedbackThemesOutput>
  ```

- **`roadmap-tradeoff-evaluator`** — quarterly-planning + ≥5 candidate features → VP-Product + VP-Eng + CFO signed roadmap decision memo (scenarios + primary recommendation + second-best alternatives). Trigger: quarterly planning + roadmap candidates ≥ 5 features submitted. Cascade: `fetch-feature-candidates-revenue-eng-cost-and-strategic-priorities (Code) → model-tradeoffs-and-scenarios (Generative) → draft-recommendation-with-rationale-and-second-best-alternatives (Generative) → vp-product-and-vp-eng-and-cfo-review (Human, approval rationale) → emit-roadmap-decision-memo (Code)`. EvaluatorPanel of 6 personas (scenario-completeness-checker + tradeoff-realism-reviewer + recommendation-rationale-checker + `Personas.budgetRealism({ budgetType: 'all' })` + `Personas.timelineRealism({ criticalPathRequired: true })` + product-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(vp-product))`. Pricing: `Pricing.outcome` 3-tier — team / function / company-wide ($4,999 / $19,999 / $49,999) keyed on planning scope. Service-level reward = `roadmap-decision-cycle-time-and-q-target-hit-rate`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/product-managers/roadmap-tradeoff-evaluator`.

  ```ts
  import { roadmapTradeoffEvaluator } from 'autonomous-product/roadmap-tradeoff-evaluator'
  // typed as ServiceInstance<RoadmapPlanningInput, RoadmapDecisionOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas` (including `Personas.budgetRealism` + `Personas.timelineRealism` + `Personas.factualAccuracy`)
- **`autonomous-finance`** `Pricing.perInvocation({ tiers })`, `Pricing.subscription({ plan, metered })`, `Pricing.outcome({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (prd-acceptance-rate / feedback-cycle-time-reduction / roadmap-decision-cycle-time → quarter-target-hit-rate / NPS terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-operations`, `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-legal`, `autonomous-people`, `autonomous-data`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
