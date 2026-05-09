# autonomous-marketing

> **Status: shipped (proof-of-life).** Nine Services — `campaign-brief-generator`, `seo-content-pillar-author`, `paid-ad-creative-iterator`, `brand-voice-monitor`, `content-localization-orchestrator`, `campaign-attribution-auditor`, `email-nurture-sequencer`, `competitor-positioning-monitor`, and `webinar-funnel-orchestrator` — are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

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

- **`brand-voice-monitor`** — weekly cron OR ad-hoc audit request → brand-manager-signed cross-channel brand-voice audit report. Trigger: weekly cron OR ad-hoc audit request. Cascade: `fetch-published-content-across-channels (Code) → extract-tone-and-voice-signals-and-score-against-style-guide (Generative) → flag-deviations-and-suggest-edits (Generative) → brand-manager-review-and-sign (Human, approval rationale) → emit-audit-report-and-per-asset-recommendations (Code)`. EvaluatorPanel of 4 personas (brand-safety-reviewer with `riskTolerance: 'low'` + voice-and-style-reviewer + deviation-precision-checker + brand-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(brand-manager))`. Pricing: `Pricing.subscription` — $799/mo per brand. Service-level reward = `brand-voice-consistency-score-improvement`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/marketing-managers/brand-voice-monitor`.

  ```ts
  import { brandVoiceMonitor } from 'autonomous-marketing/brand-voice-monitor'
  // typed as ServiceInstance<BrandAuditTriggerInput, BrandAuditReportOutput>
  ```

- **`content-localization-orchestrator`** — content-piece-tagged-for-localisation webhook → per-locale-reviewer-attested localised bundle published to per-locale targets. Trigger: content piece tagged for localisation. Cascade: `fetch-source-content-and-per-locale-style-guides (Code) → per-locale-adaptation-copy-numerals-cultural-references-rtl (Generative) → market-fit-review-and-sensitivity-flags (Generative) → per-locale-reviewer-attestation (Human, trust rationale — cultural-context expertise lives in-region) → emit-localized-bundle-and-publish-targets (Code)`. EvaluatorPanel of 4 personas (localization-readiness-reviewer + brand-safety-reviewer with `toneRange: 'formal'` + factual-accuracy-reviewer with `minCitationsPerClaim: 1` + localization-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(per-locale-reviewer))`. Pricing: `Pricing.outcome` 3-tier short-copy / medium-asset / long-form ($99 / $499 / $1,999 per locale). Service-level reward = `localized-content-engagement-vs-source-baseline`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/marketing-managers/content-localization-orchestrator`.

  ```ts
  import { contentLocalizationOrchestrator } from 'autonomous-marketing/content-localization-orchestrator'
  // typed as ServiceInstance<LocalizationRequestInput, LocalizedBundleOutput>
  ```

- **`campaign-attribution-auditor`** — monthly cron + campaign-reporting-cycle trigger → growth-lead-signed multi-touch-attribution + ROI audit reconciled against platform self-reports. Trigger: monthly cron + campaign reporting cycle. Cascade: `fetch-campaign-touchpoints-conversion-events-spend-and-click-stream (Code) → model-multi-touch-attribution-and-reconcile-with-platform-self-reports (Generative) → synthesize-roi-narrative-and-flag-attribution-anomalies (Generative) → growth-lead-review-and-sign (Human, approval rationale) → emit-attribution-report-and-finance-export (Code)`. EvaluatorPanel of 4 personas (attribution-factual-accuracy-reviewer with `minCitationsPerClaim: 2` + budget-realism-reviewer with `budgetType: 'cost'` + attribution-model-soundness-checker + growth-analytics-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(growth-lead))`. Pricing: `Pricing.percentOf` — 0.75% of `campaign-spend-audited` (rateBasisPoints: 75), capped at $25k per audit. Service-level reward = `attribution-confidence-score-and-platform-self-report-reconciliation-rate`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/marketing-managers/campaign-attribution-auditor`.

  ```ts
  import { campaignAttributionAuditor } from 'autonomous-marketing/campaign-attribution-auditor'
  // typed as ServiceInstance<AttributionAuditTriggerInput, AttributionAuditReportOutput>
  ```

- **`email-nurture-sequencer`** — lead segment + nurture goal declaration → content-marketer-approved 5–12-touch email sequence staged into the ESP. Trigger: lead segment + nurture goal defined (e.g. trial-to-paid, dormant-reactivation). Cascade: `fetch-segment-product-context-prior-touchpoints-and-brand-voice (Code) → synthesize-nurture-arc-with-cadence-and-per-touch-objective (Generative) → draft-each-email-subject-preview-body-cta-and-ab-alternates (Generative) → content-marketer-review-and-approve (Human, approval rationale) → emit-sequence-config-and-esp-staging (Code)`. EvaluatorPanel of 4 personas (empathy-and-tone-reviewer with `audienceType: 'customer'` + `sentimentTarget: 'reassuring'` + brand-safety-reviewer with `riskTolerance: 'medium'` + handoff-readiness-reviewer with `contextDensity: 'standard'` + lifecycle-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(content-marketer))`. Pricing: `Pricing.outcome` 3-tier short-sequence / standard / multi-segment-or-localized ($499 / $1,999 / $5,999). Service-level reward = `nurture-conversion-rate-vs-baseline`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/marketing-managers/email-nurture-sequencer`.

  ```ts
  import { emailNurtureSequencer } from 'autonomous-marketing/email-nurture-sequencer'
  // typed as ServiceInstance<NurtureBriefInput, NurtureSequenceOutput>
  ```

- **`competitor-positioning-monitor`** — weekly cron + competitor-set defined → PMM-lead-signed weekly competitive-positioning brief + tracker update. Trigger: weekly cron + competitor-set defined. Cascade: `fetch-competitor-product-pages-recent-positioning-changes-and-funding-news (Code) → supervised-extract-messaging-frames-pricing-changes-persona-shifts-and-new-features (Agentic, supervised) → synthesize-positioning-deltas-threat-vectors-and-recommendations (Generative) → pmm-lead-review (Human, approval rationale) → emit-positioning-brief-and-tracker-update (Code)`. EvaluatorPanel of 4 personas (factual-accuracy-reviewer with `citationRequired: true` + `sourceTypes: ['first-party', 'industry-standard']` + commercial-fit-reviewer with `audienceForPitch: 'internal-stakeholder'` + threat-prioritisation-checker + pmm-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(PMM-lead))`. Pricing: `Pricing.subscription` — $899/mo per PMM-team + metered overage `[{ event: 'major-positioning-change-detected', amount: $99 }]`. Service-level reward = `competitive-win-rate-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/marketing-managers/competitor-positioning-monitor`.

  ```ts
  import { competitorPositioningMonitor } from 'autonomous-marketing/competitor-positioning-monitor'
  // typed as ServiceInstance<CompetitorMonitorTriggerInput, CompetitorPositioningBriefOutput>
  ```

- **`webinar-funnel-orchestrator`** — webinar planned + audience hypothesis defined → growth-marketer-launched webinar funnel asset bundle + tracking config. Trigger: webinar planned + audience hypothesis defined. Cascade: `fetch-audience-segments-topic-fit-speaker-pool-and-prior-webinar-perf (Code) → draft-webinar-thesis-abstract-speaker-bios-and-landing-copy (Generative) → synthesize-promo-sequence-pre-event-emails-ads-and-organic-social (Generative) → growth-marketer-review-and-launch (Human, approval rationale) → emit-asset-bundle-and-tracking-config (Code)`. EvaluatorPanel of 4 personas (brand-safety-reviewer with `riskTolerance: 'medium'` + scope-clarity-reviewer with `artifactType: 'project-brief'` + funnel-realism-checker + demand-gen-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(growth-marketer))`. Pricing: `Pricing.outcome` 3-tier micro / standard / flagship ($999 / $2,999 / $9,999). Service-level reward = `webinar-attended-rate-and-MQL-yield`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/marketing-managers/webinar-funnel-orchestrator`.

  ```ts
  import { webinarFunnelOrchestrator } from 'autonomous-marketing/webinar-funnel-orchestrator'
  // typed as ServiceInstance<WebinarPlanInput, WebinarFunnelOutput>
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
