# autonomous-events

> **Status: shipped (proof-of-life).** Three Services — `event-program-curator`, `partnership-deal-orchestrator`, `event-attendee-engagement-monitor` — are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: events-vertical Services-as-Software, defined on the primitive substrate. Distinct from `autonomous-marketing` (campaign / SEO / paid-ads / brand-voice / localization / attribution-audit) — this package focuses on the events-team vertical: conference + webinar program curation, partnership-deal orchestration, and real-time attendee-engagement monitoring during live events.

## What this is

Concrete `Service.define({...})` calls for in-house events-team work — conference / webinar program curation with theme + diversity + flow narrative coverage, inbound + outbound partnership-opportunity orchestration through to signed deal, and live-event attendee-engagement monitoring with real-time interventions — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`, `autonomous-research`, `autonomous-security`. Fifteenth catalog package; advances v3 §15's "catalog Services" leg into the events-team vertical.

## Shipped Services

- **`event-program-curator`** — conference / webinar program design. Trigger: event scoped + speaker pool / topic candidates available. Cascade: `fetch-audience-shape-and-topic-pool-and-speaker-pool-and-prior-event-perf (Code) → synthesize-program-arc-themes-session-types-diversity-coverage-and-flow-narrative (Generative) → draft-speaker-invitations-and-session-briefs (Generative) → program-chair-and-content-lead-review (Human, approval rationale) → emit-program-doc-and-speaker-outreach-batch (Code)`. EvaluatorPanel of 4 personas (theme-coherence-checker + diversity-coverage-checker + flow-soundness-checker + brand-safety (low-risk-tolerance) + factual-accuracy (≥1 citation)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(program-chair))`. Pricing: `Pricing.outcome` 3-tier — webinar / half-day / multi-day-conference ($999 / $4,999 / $19,999) — keyed on event scope. Service-level reward = `attendee-NPS-and-session-attendance-rate`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/event-leads/event-program-curator`.

  ```ts
  import { eventProgramCurator } from 'autonomous-events/event-program-curator'
  // typed as ServiceInstance<EventProgramCuratorInput, EventProgramCuratorOutput>
  ```

- **`partnership-deal-orchestrator`** — partnership opportunity → signed-deal coordination. Trigger: inbound partnership inquiry OR strategic-partnership target identified. Cascade: `fetch-partner-profile-and-strategic-fit-criteria-and-prior-partnerships (Code) → synthesize-partnership-thesis-and-value-exchange-options-and-structure-recommendations (Generative) → supervised-research-of-partner-org-and-key-stakeholders-and-recent-product-news (Agentic, supervised) → draft-partnership-deck-and-term-sheet-options-and-comms-plan (Generative) → BD-lead-and-GC-and-CFO-review (Human, approval + regulatory rationale) → emit-partnership-package-and-tracker (Code)`. EvaluatorPanel of 4 personas (strategic-fit-soundness-checker + value-exchange-clarity-checker + risk-coverage-checker + factual-accuracy (citation-required, first-party + industry-standard) + commercial-fit (audience: partner)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(BD-lead))`. Pricing: `Pricing.outcome` 3-tier — tactical / strategic / platform-or-OEM ($1,999 / $9,999 / $49,999) — keyed on partnership depth. Service-level reward = `signed-partnership-rate-and-cycle-time-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/bd-leads/partnership-deal-orchestrator`.

  ```ts
  import { partnershipDealOrchestrator } from 'autonomous-events/partnership-deal-orchestrator'
  // typed as ServiceInstance<PartnershipDealInput, PartnershipDealOutput>
  ```

- **`event-attendee-engagement-monitor`** — real-time event-engagement tracking + interventions. Trigger: event in-progress + telemetry-stream. Cascade: `fetch-attendee-engagement-stream-session-attendance-Q&A-volume-and-drop-off-signals (Code) → detect-engagement-anomalies-flag-low-rated-sessions-and-identify-VIP-touchpoint-gaps (Generative) → draft-real-time-interventions-session-pivots-speaker-prompts-and-VIP-outreach (Generative) → event-producer-review-and-deploy-on-priority-issues (Human, approval rationale) → emit-engagement-dashboard-and-intervention-log (Code)`. EvaluatorPanel of 4 personas (anomaly-precision-checker + intervention-effectiveness-checker + VIP-coverage-checker + empathy (audience: public, sentiment: celebratory) + brand-safety (low-risk-tolerance)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(event-producer))`. Pricing: `Pricing.subscription` $799/mo per events-team subscription with metered overage at $999 per live-event-day-monitored. Service-level reward = `post-event-NPS-and-session-attendance-recovery`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/event-leads/event-attendee-engagement-monitor`.

  ```ts
  import { eventAttendeeEngagementMonitor } from 'autonomous-events/event-attendee-engagement-monitor'
  // typed as ServiceInstance<EngagementMonitorInput, EngagementMonitorOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate. Distinct from `autonomous-marketing` (campaigns + brand voice + paid-ads + content) — events is a peer vertical with its own buyer (head-of-events / event-producer / BD-lead) and its own program-curation + partnership + live-event-engagement posture.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.subscription({ plan, metered })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (attendee-NPS-and-session-attendance-rate / signed-partnership-rate-and-cycle-time-improvement / post-event-NPS-and-session-attendance-recovery terminal hills) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`, `autonomous-research`, `autonomous-security`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
