# autonomous-marketing

> **Status: shipped (proof-of-life).** `campaign-brief-generator`, `seo-content-pillar-author`, and `paid-ad-creative-iterator` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: marketing Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for marketing work that the agentic economy can deliver as software. Sibling of `autonomous-finance-services`, `autonomous-customer-success`, `autonomous-revenue`, `autonomous-developer-experience`, `autonomous-startups`. Sixth catalog package; advances v3 §15's "catalog Services" leg into the marketing vertical.

## Shipped Services

- **`campaign-brief-generator`** — campaign idea + audience hypothesis → CMO-signed campaign brief doc. Trigger: campaign-kickoff event from CMO/PMM. Cascade: `fetch-brand-voice-audience-profile-and-past-campaign-perf (Code) → synthesize-campaign-narrative (Generative) → propose-channel-mix-and-creative-direction (Generative) → cmo-review-and-sign (Human, approval rationale) → emit-brief-doc (Code)`. EvaluatorPanel of 4 personas (audience-fit-reviewer + brand-voice-checker + budget-realism-checker + marketing-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(CMO))`. Pricing: `Pricing.perInvocation` 3-tier — tactical / strategic / launch ($499 / $1,999 / $4,999). Service-level reward = `campaign-brief-cycle-time-reduction`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/marketing-managers/campaign-brief-generator`.

  ```ts
  import { campaignBriefGenerator } from 'autonomous-marketing/campaign-brief-generator'
  // typed as ServiceInstance<CampaignKickoffInput, CampaignBriefOutput>
  ```

- **`seo-content-pillar-author`** — keyword cluster + content-gap analysis → content-lead-reviewed pillar page + cluster outlines published to CMS. Trigger: keyword cluster + content-gap declaration. Cascade: `fetch-keyword-research-competitor-content-and-style-guide (Code) → research-serp-leaders-and-vet-topical-expertise (Agentic, supervised) → draft-pillar-page-and-cluster-outlines (Generative) → content-lead-review (Human, premium rationale) → publish-to-cms-with-internal-linking (Code)`. EvaluatorPanel of 4 personas (topical-authority-reviewer + e-e-a-t-checker + readability-checker + marketing-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(content-lead))`. Pricing: `Pricing.outcome` 3-tier S/M/L by pillar-cluster size ($799 / $2,999 / $8,999). Service-level reward = `organic-rank-position-1-3-rate-on-target-keywords`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/marketing-managers/seo-content-pillar-author`.

  ```ts
  import { seoContentPillarAuthor } from 'autonomous-marketing/seo-content-pillar-author'
  // typed as ServiceInstance<PillarClusterInput, PillarClusterOutput>
  ```

- **`paid-ad-creative-iterator`** — 7-day perf-threshold webhook → brand-manager-approved variant set deployed to ad platform. Trigger: ad campaign launched + 7-day perf threshold reached. Cascade: `fetch-current-creative-perf-and-audience-engagement-signals (Code) → synthesize-which-creative-axes-to-iterate (Generative) → emit-n-new-variants-per-axis (Generative) → brand-manager-review-for-brand-safety (Human, regulatory rationale) → deploy-to-ad-platform (Code)`. EvaluatorPanel of 4 personas (brand-safety-checker + variant-distinctiveness-reviewer + audience-fit-checker + paid-media-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(brand-manager))`. Pricing: `Pricing.percentOf` — 8% of `ad-spend-attributed-conversions` (rateBasisPoints: 800), capped at $50k per account per month. Service-level reward = `cost-per-acquisition-improvement-vs-baseline`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/marketing-managers/paid-ad-creative-iterator`.

  ```ts
  import { paidAdCreativeIterator } from 'autonomous-marketing/paid-ad-creative-iterator'
  // typed as ServiceInstance<AdPerfTriggerInput, AdVariantSetOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.perInvocation({ tiers })`, `Pricing.outcome({ tiers })`, `Pricing.percentOf({ basis, rateBasisPoints, cap })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (campaign-brief-cycle-time-reduction → Profit / NRR terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
