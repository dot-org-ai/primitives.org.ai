# autonomous-data

> **Status: shipped (proof-of-life).** `dbt-model-author`, `data-quality-incident-triager`, and `metrics-catalog-curator` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: data-engineering / analytics Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for in-house data-engineering and analytics work — dbt-model authoring with lineage-aware refactor, data-quality incident triage + RCA, and metrics-layer drift detection + curation — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`. Tenth catalog package; advances v3 §15's "catalog Services" leg into the data / analytics vertical.

## Shipped Services

- **`dbt-model-author`** — analytics-engineering dbt-model authoring + lineage-aware refactor. Trigger: source-table schema change OR new analytics request from finance / marketing. Cascade: `fetch-current-schema-and-downstream-graph-and-recent-PR-context (Code) → synthesize-staging-and-intermediate-and-mart-models-with-lineage (Generative) → write-dbt-tests-for-quality-and-freshness-checks (Generative) → analytics-engineer-review (Human, approval rationale) → emit-PR-with-yml-config-and-dbt-docs-update (Code)`. EvaluatorPanel of 3 personas (test-coverage-checker + lineage-completeness-reviewer + naming-convention-adherence) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(analytics-engineer))`. Pricing: `Pricing.outcome` 3-tier — small / medium / large ($499 / $1,999 / $5,999) — keyed on lineage-graph size. Service-level reward = `ci-pass-rate-on-first-PR`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/analytics-engineering/dbt-model-author`.

  ```ts
  import { dbtModelAuthor } from 'autonomous-data/dbt-model-author'
  // typed as ServiceInstance<DbtModelRequestInput, DbtModelAuthorOutput>
  ```

- **`data-quality-incident-triager`** — data-quality alert triage + RCA. Trigger: dbt-test failure OR Monte-Carlo / Soda alert OR Great Expectations validation failure. Cascade: `fetch-affected-models-and-recent-source-changes-and-downstream-consumers (Code) → classify-failure-mode-and-blast-radius (Generative) → supervised-investigate-source-system-and-recent-deploys (Agentic, supervised) → draft-RCA-with-mitigation-plan (Generative) → data-platform-lead-review (Human, approval rationale) → emit-incident-doc-and-status-update (Code)`. EvaluatorPanel of 3 personas (rca-quality-reviewer + mitigation-actionability-checker + data-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(data-platform-lead))`. Pricing: `Pricing.perInvocation` 3-tier — P3 / P2 / P1 ($99 / $499 / $1,999) — keyed on declared blast-radius. Service-level reward = `data-incident-mean-time-to-resolution-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/data-platform/data-quality-incident-triager`.

  ```ts
  import { dataQualityIncidentTriager } from 'autonomous-data/data-quality-incident-triager'
  // typed as ServiceInstance<DataQualityAlertInput, DataQualityRcaOutput>
  ```

- **`metrics-catalog-curator`** — metrics-layer drift detection + curator. Trigger: weekly cron OR new metric-definition PR OR semantic-layer drift alert. Cascade: `fetch-current-metrics-catalog-and-recent-usage-and-business-context (Code) → detect-drift-name-collisions-definition-divergence-and-ownership-gaps (Generative) → draft-curation-recommendations-and-deprecation-plan (Generative) → analytics-lead-and-data-PM-review (Human, approval rationale) → emit-curation-PR-and-announcement (Code)`. EvaluatorPanel of 3 personas (drift-detection-precision-checker + curation-rationale-clarity-reviewer + analytics-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(analytics-lead))`. Pricing: `Pricing.subscription` $899/mo per data-team subscription with metered overage at $199 per curation PR emitted. Service-level reward = `metrics-catalog-coherence-score-improvement`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/analytics-leads/metrics-catalog-curator`.

  ```ts
  import { metricsCatalogCurator } from 'autonomous-data/metrics-catalog-curator'
  // typed as ServiceInstance<MetricsCatalogReviewInput, MetricsCatalogCurationOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.subscription({ plan, metered })`, `Pricing.perInvocation({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (ci-pass-rate-on-first-PR → analytics-velocity / data-trust terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
