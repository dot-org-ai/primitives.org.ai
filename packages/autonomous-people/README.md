# autonomous-people

> **Status: shipped (proof-of-life).** Six Services — `hiring-loop-coordinator`, `performance-review-narrator`, `org-design-impact-modeler`, `compensation-band-analyst`, `candidate-experience-evaluator`, `talent-pipeline-quality-monitor` — implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: people / HR Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for people / HR work — interview-loop coordination, quarterly performance-review packet authoring, org-design impact analysis, comp-band benchmarking + offer-letter advising, post-loop candidate-experience synthesis, and pipeline-quality / DEI monitoring — that the agentic economy can deliver as software. Sibling of `autonomous-operations`, `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-legal`. Ninth catalog package; advances v3 §15's "catalog Services" leg into the people vertical.

## Shipped Services

- **`hiring-loop-coordinator`** — onsite-loop ATS-stage trigger → hiring-manager-confirmed loop schedule + prep docs. Trigger: candidate moves to onsite-loop stage in ATS. Cascade: `fetch-candidate-profile-role-spec-and-panel-availability (Code) → synthesize-loop-structure-and-role-aligned-question-allocation (Generative) → coordinate-scheduling-across-panel-and-candidate (Agentic, supervised) → hiring-manager-review-and-confirm (Human, approval rationale) → emit-loop-schedule-and-send-prep-docs (Code)`. EvaluatorPanel of 4 personas (panel-coverage-checker + question-alignment-reviewer + scheduling-feasibility-checker + people-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(hiring-manager))`. Pricing: `Pricing.perInvocation` 3-tier — IC / senior / executive ($299 / $999 / $4,999) — keyed on the role band. Service-level reward = `time-to-loop-confirmed-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/human-resources-managers/hiring-loop-coordinator`.

  ```ts
  import { hiringLoopCoordinator } from 'autonomous-people/hiring-loop-coordinator'
  // typed as ServiceInstance<LoopTriggerInput, LoopScheduleOutput>
  ```

- **`performance-review-narrator`** — quarterly review cycle + in-scope employee → manager-signed review packet (strengths-and-growth narrative + OKR progress + next-cycle recommendations). Trigger: quarterly review cycle + employee in scope. Cascade: `fetch-okrs-360-feedback-and-manager-1-1-notes (Code) → synthesize-strengths-growth-narrative-with-evidence (Generative) → draft-okr-progress-and-next-cycle-recommendations (Generative) → manager-personalize-and-sign (Human, trust rationale) → emit-review-packet (Code)`. EvaluatorPanel of 5 personas (`Personas.factualAccuracy({ minCitationsPerClaim: 2 })` evidence-grounding-checker + `Personas.brandSafety({ toneRange: 'formal' })` tone-fairness-checker + actionability-reviewer + okr-realism-checker + people-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(manager))`. Pricing: `Pricing.subscription` $299/mo per people-team + metered overage at $99 per `review-packet-authored` event above the quarterly cadence baseline. Service-level reward = `review-cycle-time-reduction-per-manager`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/human-resources-managers/performance-review-narrator`.

  ```ts
  import { performanceReviewNarrator } from 'autonomous-people/performance-review-narrator'
  // typed as ServiceInstance<ReviewCycleInput, ReviewPacketOutput>
  ```

- **`org-design-impact-modeler`** — VP-or-above org-change proposal → CHRO + sponsor-VP signed impact memo (span-of-control + comp-band collisions + role-clarity risks + mitigations + sequencing plan). Trigger: VP-or-above proposes a re-org / new-function / consolidation. Cascade: `fetch-current-org-graph-headcount-budget-and-affected-roles (Code) → synthesize-impact-narrative-with-span-comp-and-role-clarity-risks (Generative) → draft-mitigations-and-sequencing-plan (Generative) → chro-and-sponsor-vp-sign (Human, approval rationale) → emit-impact-memo-and-change-tracker (Code)`. EvaluatorPanel of 4 personas (span-of-control-checker + comp-band-coverage-checker + sequencing-soundness-reviewer + people-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(CHRO))`. Pricing: `Pricing.outcome` 3-tier — team / function / company-wide ($1,999 / $9,999 / $49,999) keyed on change scope. Service-level reward = `post-reorg-attrition-vs-baseline`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/human-resources-managers/org-design-impact-modeler`.

  ```ts
  import { orgDesignImpactModeler } from 'autonomous-people/org-design-impact-modeler'
  // typed as ServiceInstance<OrgChangeProposalInput, OrgChangeImpactOutput>
  ```

- **`compensation-band-analyst`** — new-offer-assembly OR quarterly-comp-band-review trigger → CHRO-or-comp-committee-signed offer recommendation (position-on-band + parity-checks + flexibility room + rationale + audit trail). Trigger: a new offer is being assembled OR a quarterly comp-band review fires. Cascade: `fetch-role-spec-market-data-internal-comp-band-and-subject-context (Code) → synthesize-position-on-band-and-parity-checks-against-current-team (Generative) → draft-offer-recommendation-with-rationale-and-flexibility-room (Generative) → chro-or-comp-committee-review (Human, approval rationale) → emit-offer-recommendation-and-audit-trail (Code)`. EvaluatorPanel of 5 personas (`Personas.factualAccuracy({ citationRequired: true, sourceTypes: ['industry-standard', 'first-party'] })` market-data-recency-checker + `Personas.regulatoryCompliance({ regulator: 'sox' })` sox-controls-reviewer + parity-coverage-checker + flexibility-rationale-reviewer + people-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(CHRO))`. Pricing: `Pricing.perInvocation` 3-tier — IC / senior-IC / leadership ($299 / $999 / $4,999) — keyed on the role band. Service-level reward = `offer-acceptance-rate-and-comp-equity-score`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/human-resources-managers/compensation-band-analyst`.

  ```ts
  import { compensationBandAnalyst } from 'autonomous-people/compensation-band-analyst'
  // typed as ServiceInstance<CompBandTriggerInput, OfferRecommendationOutput>
  ```

- **`candidate-experience-evaluator`** — post-loop-survey OR weekly-cron trigger → head-of-talent-signed candidate-experience report (themes + friction-points + scored-vs-internal-bar + actionable recommendations queued for the loop process). Trigger: candidate post-loop survey received OR weekly cron over the prior week's loops. Cascade: `fetch-survey-responses-interviewer-debrief-notes-and-outcome-data (Code) → extract-themes-flag-friction-points-and-score-vs-internal-bar (Generative) → draft-actionable-recommendations-for-recruiting-team (Generative) → head-of-talent-review (Human, approval rationale) → emit-feedback-report-and-queue-actions-for-loop-process (Code)`. EvaluatorPanel of 5 personas (`Personas.factualAccuracy({ minCitationsPerClaim: 2 })` theme-coherence-checker + `Personas.brandSafety({ toneRange: 'formal' })` tone-fairness-checker + actionability-reviewer + signal-clarity-checker + people-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(head-of-talent))`. Pricing: `Pricing.subscription` $499/mo per talent-team. Service-level reward = `candidate-NPS-and-offer-accept-rate`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/human-resources-managers/candidate-experience-evaluator`.

  ```ts
  import { candidateExperienceEvaluator } from 'autonomous-people/candidate-experience-evaluator'
  // typed as ServiceInstance<CandidateFeedbackTriggerInput, CandidateFeedbackReportOutput>
  ```

- **`talent-pipeline-quality-monitor`** — weekly-cron + sourcing-rotation trigger → head-of-talent + people-leadership-signed pipeline-health report (anomalies + drop-off patterns + sourcing-mix drift + prioritised recommendations + mitigation options). Trigger: weekly cron + sourcing rotations. Cascade: `fetch-pipeline-funnel-source-mix-dei-signals-and-benchmark-data (Code) → detect-anomalies-drop-off-patterns-and-sourcing-mix-drift (Generative) → synthesize-recommendations-with-priority-and-mitigation-options (Generative) → head-of-talent-and-people-leadership-review (Human, approval rationale) → emit-pipeline-health-report (Code)`. EvaluatorPanel of 5 personas (`Personas.regulatoryCompliance({ regulator: 'sox' })` sox-controls-reviewer + `Personas.dataPrivacy({ framework: 'general' })` data-privacy-reviewer + `Personas.factualAccuracy({ minCitationsPerClaim: 2 })` anomaly-precision-checker + recommendation-actionability-reviewer + people-domain) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(head-of-talent))`. Pricing: `Pricing.subscription` $799/mo per people-team + metered overage at $99 per `pipeline-anomaly-flagged` event above the baseline. Service-level reward = `time-to-fill-and-pipeline-diversity-score`. Archetype: `forecast-narrative`. Lineage: `business.org.ai/cells/human-resources-managers/talent-pipeline-quality-monitor`.

  ```ts
  import { talentPipelineQualityMonitor } from 'autonomous-people/talent-pipeline-quality-monitor'
  // typed as ServiceInstance<PipelineMonitorTriggerInput, PipelineHealthReportOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas` (including `Personas.brandSafety` + `Personas.factualAccuracy`)
- **`autonomous-finance`** `Pricing.perInvocation({ tiers })`, `Pricing.subscription({ plan, metered })`, `Pricing.outcome({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (time-to-loop-confirmed-improvement / review-cycle-time-reduction / post-reorg-attrition-vs-baseline → eNPS / regrettable-attrition terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-operations`, `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-legal`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
