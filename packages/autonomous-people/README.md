# autonomous-people

> **Status: shipped (proof-of-life).** `hiring-loop-coordinator`, `performance-review-narrator`, and `org-design-impact-modeler` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: people / HR Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for people / HR work — interview-loop coordination, quarterly performance-review packet authoring, org-design impact analysis — that the agentic economy can deliver as software. Sibling of `autonomous-operations`, `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-legal`. Ninth catalog package; advances v3 §15's "catalog Services" leg into the people vertical.

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
