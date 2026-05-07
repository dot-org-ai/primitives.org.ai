# autonomous-startups

> **Status: shipping.** First Service (`claude-code-feature-build`) is live — the v3 worked example, ported to a real `Service.define({...})` call. Sibling of `autonomous-finance-services`, `autonomous-customer-success`, `autonomous-revenue`, `autonomous-developer-experience`.

The catalog package for startup-shaped Services-as-Software, plus the future home of the meta-primitive for autonomous startups across every business model — not just Services-as-Software.

## Shipped Services

- **`claude-code-feature-build`** — ship a feature to your repo, reviewed by 4 specialists. Cascade: `brainstorm (Generative) → plan (Agentic) → scope (Agentic) → dispatch (Code) → dev × N (Agentic, fan-out)`. EvaluatorPanel of 4 personas (`qa-reviewer / arch-reviewer / security-reviewer / product-reviewer`). OutcomeContract = `AND(EvaluatorPass(panel:self, all-approved), External(github, { ci: 'passing', merged: true }))`. Pricing: outcome tiers — S=$200, M=$800, L=$2400 by feature complexity. Reward laddering to customer CSAT. Lineage to `business.org.ai/cells/software-developers/feature-implementation`.

- **`wedge-hypothesis-generator`** — Stage-3 wedge-hypothesis authoring: every (cell, thesis) reaches Stage 9 with a founder-signed Founding Hypothesis. Cascade: `fetch-cell-thesis-and-occupations-job-archetype (Code) → synthesize-3-wedge-candidates (Generative) → score-on-9-rubric-dims-and-select-strongest (Generative) → founder-review-and-pick (Human, approval) → emit-fh-and-trigger-downstream-cascade (Code, fan-out)`. EvaluatorPanel: rubric-coverage + wedge-distinctiveness + cell-coherence + factualAccuracy(min-2-citations) + budgetRealism(all axes) + startup-strategy domain. OutcomeContract = `AND(SchemaMatch, EvaluatorPass(all-approved), HumanSign(founder))`. Pricing: outcome tiers — `rough` $99 / `investment-grade` $999. Reward = `stage-9-pass-rate-of-emitted-FHs`. Lineage to `business.org.ai/cells/founders/wedge-hypothesis-authoring`.

- **`competitor-uncopyability-prober`** — Stage-5/6 cluster-5 uncopyability verification: every FH with named substitutes reaches Stage 6 with a senior-founder-signed uncopyability memo. Cascade: `fetch-substitutes-positioning-and-roadmap-news (Code) → research-each-substitute-supervised (Agentic, fan-out) → synthesize-uncopyability-rationale-per-substitute (Generative) → red-team-counter-arguments (Generative) → senior-founder-review (Human, premium) → emit-uncopyability-memo-and-cascade-feedback (Code, fan-out)`. EvaluatorPanel: c5-uncopyable skeptic + counter-argument-completeness + factualAccuracy(government + industry-standard sources) + brandSafety(high risk tolerance) + corporate-strategy domain. OutcomeContract = `AND(SchemaMatch, EvaluatorPass(all-approved), HumanSign(senior-founder))`. Pricing: subscription $199/mo + metered $49/uncopyability-memo-emitted. Reward = `c5-rubric-pass-rate`. Lineage to `business.org.ai/cells/founders/competitor-uncopyability-proving`.

- **`runtime-unit-emitter`** — Stage-25/27/28 runtime-unit minting: every Stage-9-approved FH reaches Stage 28 with a founder-published RuntimeUnit + MarketplaceListing registered with cluster-1-4 flag-gates. Cascade: `fetch-fh-brand-thesis-lens (Code) → synthesize-service-define-shape (Generative) → validate-against-v3-service-define-types (Code) → emit-marketplace-listing-with-promise-denormalization (Generative) → founder-review-and-publish (Human, approval) → emit-runtime-unit-and-register-cluster-flag-gates (Code, fan-out)`. EvaluatorPanel: service-shape-validity + listing-coherence + lineage-soundness + platform-architecture domain. OutcomeContract = `AND(SchemaMatch, EvaluatorPass(all-approved), HumanSign(founder))`. Pricing: outcome tiers — `wedge` $999 / `platform` $4,999. Reward = `stage-33-37-publish-success-rate`. Lineage to `business.org.ai/cells/founders/runtime-unit-emitting`.

- **`pricing-architect`** — startup pricing-architecture authoring: every new product or repricing event reaches a founder-and-finance-lead-signed pricing architecture in under a week. Cascade: `fetch-product-shape-icp-competitors-and-cost-structure (Code) → synthesize-3-pricing-model-options-with-tradeoffs (Generative) → draft-pricing-page-copy-and-objection-handling (Generative) → founder-and-finance-lead-review (Human, approval) → emit-pricing-architecture-doc-and-stripe-config (Code, fan-out)`. EvaluatorPanel: model-fit-with-icp + objection-handling-coverage + unit-economics-soundness + budgetRealism(cost) + brandSafety(medium) + pricing-strategy domain. OutcomeContract = `AND(SchemaMatch, EvaluatorPass(all-approved), HumanSign(founder))`. Pricing: outcome tiers — `simple` $499 / `usage-based` $1,999 / `enterprise` $5,999. Reward = `pricing-page-conversion-rate-and-asp-improvement`. Lineage to `business.org.ai/cells/founders/pricing-architecture`.

- **`pitch-deck-builder`** — investor / partner pitch-deck authoring: every fundraise round or partnership pitch reaches a founder-and-advisor-signed deck in under a week. Cascade: `fetch-company-data-traction-market-and-comparable-rounds (Code) → synthesize-narrative-arc (Generative) → emit-per-slide-content-design-direction-and-appendix (Generative) → founder-and-advisor-review (Human, approval) → emit-deck-source-and-speaker-notes (Code, fan-out)`. EvaluatorPanel: narrative-coherence + traction-verifiability + market-realism + ask-precision + factualAccuracy(first-party + industry-standard) + fundraise-strategy domain. OutcomeContract = `AND(SchemaMatch, EvaluatorPass(all-approved), HumanSign(founder))`. Pricing: outcome tiers — `pre-seed` $999 / `seed-or-series-a` $2,999 / `late-stage` $9,999. Reward = `meeting-conversion-rate-and-term-sheet-rate`. Lineage to `business.org.ai/cells/founders/pitch-deck-authoring`.

- **`gtm-experiment-runner`** — go-to-market experiment design + run + readout: every founder-picked GTM hypothesis reaches a founder-signed experiment record + decision log (persist / pivot / kill). Cascade: `fetch-current-funnel-spend-data-and-audience-segments (Code) → design-experiment-hypothesis-variants-success-criteria-duration (Generative) → supervised-run-experiment-and-collect-results-from-channels (Agentic, fan-out) → synthesize-readout-and-decision-recommendation (Generative) → founder-decision-review (Human, approval) → emit-experiment-record-and-decision-log (Code, fan-out)`. EvaluatorPanel: experiment-design-soundness + decision-rationale + persistence-or-kill-readiness + edgeCaseCoverage(min-4-per-scenario) + timelineRealism(dependency-aware) + gtm-strategy domain. OutcomeContract = `AND(SchemaMatch, EvaluatorPass(all-approved), HumanSign(founder))`. Pricing: percent-of `experiment-spend`, 15% (1500 bps), capped at $30k/experiment. Reward = `pivot-or-persist-decision-quality`. Lineage to `business.org.ai/cells/founders/gtm-experiment-running`.

```ts
import { claudeCodeFeatureBuild } from 'autonomous-startups/claude-code-feature-build'

const handle = claudeCodeFeatureBuild.invoke({
  repoRef: 'github.com/acme/widgets',
  featureBrief: 'Add a Stripe webhook handler for subscription.deleted events that rolls users back to the free plan.',
  acceptanceCriteria: ['rollback within 60s', 'idempotent on replay', 'covered by an integration test'],
})
```

Type inference flows: `claudeCodeFeatureBuild: ServiceInstance<FeatureBuildInput, FeatureBuildOutput>`. `handle.result` resolves to `FeatureBuildOutput`.

## Future scope: meta-primitive for every business model

This package will eventually grow to host the meta-primitive for *the autonomous business itself* — sitting above `business-as-code` (deterministic rails: Goals/OKRs/Oversight/Process) and `services-as-software` (one specific business-model primitive). It will provide one typed primitive per business-model archetype, higher-order generators producing N businesses across a strategic-token grid (the "1M businesses from every (ICP × Problem)" thesis, generalized beyond Services-as-Software), and shared substrate over `business-as-code` rails + `autonomous-finance` economics.

### Business models in scope (planned)

| Primitive | Maps to business model |
|---|---|
| `Service` | Services-as-Software (cascade-delivered outcome) — lives in `services-as-software` |
| `SaaSProduct` | Headless SaaS — multi-tenant feature-gated software product |
| `APIProduct` | API-as-a-Service — programmable interface as the deliverable |
| `DataProduct` | DaaS — curated dataset as the deliverable |
| `InfraProduct` | IaaS — provisioned infrastructure as the deliverable |
| `PlatformProduct` | PaaS — managed platform as the deliverable |
| `MarketplaceProduct` | Marketplace — multi-sided platform connecting buyers and sellers |
| `DirectoryProduct` | Directory — curated discovery layer |

Each primitive shares structure (a typed mint contract, a durable invocation/usage FSM, pricing, oversight, lineage) but differs in delivery mechanics, customer experience, and economic model.

## References

- Beads epic: `aip-n1b8`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v3.md` (§3 has the Claude Code worked example)
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
