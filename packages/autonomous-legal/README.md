# autonomous-legal

> **Status: shipped (proof-of-life).** `contract-reviewer`, `policy-impact-analyzer`, and `ip-disclosure-triage` are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: legal Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for in-house legal work — incoming contract review, policy-change impact analysis, IP disclosure triage — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`. Eighth catalog package; advances v3 §15's "catalog Services" leg into the legal vertical.

## Shipped Services

- **`contract-reviewer`** — vendor MSA / NDA / SOW received → GC-or-deputy-signed redline + risk memo. Trigger: incoming third-party contract uploaded. Cascade: `extract-clauses-and-counterparty-info (Code) → check-against-company-policy-and-flag-deviations (Generative) → draft-redlines-and-risk-memo (Generative) → gc-or-deputy-review-and-sign (Human, regulatory rationale) → emit-redlined-doc-and-comparison-tracker (Code)`. EvaluatorPanel of 4 personas (policy-coverage-checker + risk-flag-completeness-reviewer + GDPR `regulatoryCompliance` + `factualAccuracy` with `citationRequired`) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(GC))`. Pricing: `Pricing.perInvocation` 3-tier — simple-NDA / standard-MSA / complex-SOW ($199 / $799 / $2,499). Service-level reward = `contract-cycle-time-reduction`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/general-counsel/contract-reviewer`.

  ```ts
  import { contractReviewer } from 'autonomous-legal/contract-reviewer'
  // typed as ServiceInstance<ContractIntakeInput, ContractReviewOutput>
  ```

- **`policy-impact-analyzer`** — handbook update / TOS amendment / privacy-policy delta proposed → GC + privacy-officer-signed impact memo with affected systems, applicable regulations, and mitigations. Trigger: policy-change proposal filed. Cascade: `fetch-current-policy-and-affected-systems (Code) → supervised-jurisdictional-research-on-applicable-regulations (Agentic, supervised) → synthesize-impact-narrative-and-mitigations (Generative) → gc-and-privacy-officer-sign-off (Human, regulatory rationale) → emit-impact-memo-and-change-tracker (Code)`. EvaluatorPanel of 4 personas (jurisdictional-coverage-checker + scenario-completeness-reviewer + GDPR `regulatoryCompliance` + `factualAccuracy` with government / peer-reviewed source restriction) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(GC))`. Pricing: `Pricing.outcome` 3-tier — minor / major / cross-border ($999 / $4,999 / $14,999). Service-level reward = `policy-change-incident-rate-reduction`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/general-counsel/policy-impact-analyzer`.

  ```ts
  import { policyImpactAnalyzer } from 'autonomous-legal/policy-impact-analyzer'
  // typed as ServiceInstance<PolicyChangeInput, PolicyImpactOutput>
  ```

- **`ip-disclosure-triage`** — engineer submits invention disclosure form → IP-counsel-signed triage memo with novelty / non-obviousness analysis and a protect-as-patent / hold-as-trade-secret / publish-defensively recommendation. Trigger: invention disclosure form submitted. Cascade: `fetch-disclosure-and-prior-art-search-from-internal-portfolio (Code) → novelty-and-non-obviousness-analysis (Generative) → draft-protection-recommendation (Generative) → ip-counsel-review (Human, premium rationale) → emit-triage-memo-and-queue-action (Code)`. EvaluatorPanel of 3 personas (prior-art-thoroughness-checker + recommendation-rationale-reviewer + IP-domain expert) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(IP-counsel))`. Pricing: `Pricing.subscription` $1,999/mo per IP-team subscription with metered overage at $499 per disclosure reviewed. Service-level reward = `time-to-protection-decision-improvement`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/intellectual-property-counsel/ip-disclosure-triage`.

  ```ts
  import { ipDisclosureTriage } from 'autonomous-legal/ip-disclosure-triage'
  // typed as ServiceInstance<DisclosureIntakeInput, DisclosureTriageOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas` (including `Personas.regulatoryCompliance` + `Personas.factualAccuracy`)
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.subscription({ plan, metered })`, `Pricing.perInvocation({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (contract-cycle-time-reduction → time-to-signature / redline-quality terminal hill) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
