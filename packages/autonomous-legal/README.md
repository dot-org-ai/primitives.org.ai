# autonomous-legal

> **Status: shipped (proof-of-life).** Six Services — `contract-reviewer`, `policy-impact-analyzer`, `ip-disclosure-triage`, `litigation-discovery-prep`, `compliance-attestation-author`, `regulatory-filing-drafter` — are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: legal Services-as-Software, defined on the primitive substrate.

## What this is

Concrete `Service.define({...})` calls for in-house legal work — incoming contract review, policy-change impact analysis, IP disclosure triage, litigation discovery prep, periodic compliance attestation, and regulatory filings — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`. Eighth catalog package; advances v3 §15's "catalog Services" leg into the legal vertical.

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

- **`litigation-discovery-prep`** — discovery request received against an active matter (or pre-trial deadline approaching) → litigation-counsel-attested production set + privilege log + redaction package + audit trail. Trigger: discovery request received OR pre-trial deadline approaching. Cascade: `fetch-document-corpus-and-custodian-list-and-matter-context-and-privilege-policy (Code) → per-document-classification (Generative) → draft-privilege-log-entries-and-redaction-rationale (Generative) → litigation-counsel-review-and-attest (Human, regulatory rationale) → emit-production-set-and-privilege-log-and-audit-trail (Code)`. EvaluatorPanel of 4 personas (privilege-classification-accuracy-checker + redaction-completeness-reviewer + GDPR `regulatoryCompliance` + `dataPrivacy` over name / email / phone / health / financial) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(litigation-counsel))`. Pricing: `Pricing.outcome` 3-tier — small-corpus / medium-corpus / large-corpus ($1,999 / $9,999 / $49,999). Service-level reward = `per-doc-review-cost-reduction-and-privilege-log-defensibility`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/litigation-counsel/litigation-discovery-prep`.

  ```ts
  import { litigationDiscoveryPrep } from 'autonomous-legal/litigation-discovery-prep'
  // typed as ServiceInstance<DiscoveryRequestInput, DiscoveryProductionOutput>
  ```

- **`compliance-attestation-author`** — quarterly attestation cycle (or auditor evidence request) → GC + compliance-officer-signed attestation packet (SOC2 / ISO27001 / HIPAA / PCI-DSS / CMMC) with control inventory + evidence citations + deviation flags + remediation plan. Trigger: quarterly attestation cycle OR auditor evidence request. Cascade: `fetch-control-status-and-evidence-trail-and-prior-attestations (Code) → synthesize-control-narrative-with-evidence-citations-and-flag-gaps (Generative) → draft-attestation-statement-and-control-deviations-and-remediation-plan (Generative) → gc-and-compliance-officer-review-and-sign (Human, regulatory rationale) → emit-attestation-packet-and-audit-trail (Code)`. EvaluatorPanel of 5 personas (evidence-completeness-checker + control-coverage-reviewer + attestation-defensibility-reviewer + SOX `regulatoryCompliance` + `factualAccuracy` over first-party / industry-standard) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(compliance-officer))`. Pricing: `Pricing.subscription` $1,999/mo per company with metered overage at $999 per attestation-cycle-completed. Service-level reward = `audit-cycle-time-and-finding-remediation-rate`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/compliance-officer/compliance-attestation-author`.

  ```ts
  import { complianceAttestationAuthor } from 'autonomous-legal/compliance-attestation-author'
  // typed as ServiceInstance<AttestationCycleInput, AttestationPacketOutput>
  ```

- **`regulatory-filing-drafter`** — filing deadline approaching (or new filing requirement triggered) → GC + CFO co-signed regulatory-filing draft (Form D / 10-Q section / 10-K / S-1 / 8-K / FINRA / Form ADV) with per-section citations, internal consistency + materiality QA, and a submission-readiness checklist. Trigger: filing deadline approaching OR new filing requirement triggered. Cascade: `fetch-financial-data-and-corporate-structure-and-prior-filings-and-regulatory-template (Code) → draft-filing-sections-with-citations-to-source-data (Generative) → internal-consistency-check-and-completeness-check-and-materiality-disclosure-pass (Generative) → gc-and-cfo-review-and-sign (Human, regulatory rationale) → emit-filing-package-and-submission-readiness-checklist (Code)`. EvaluatorPanel of 5 personas (citation-density-checker + materiality-coverage-reviewer + style-guide-conformance-checker + SEC `regulatoryCompliance` + `factualAccuracy` over first-party / government) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(GC) + HumanSign(CFO))` — dual-signer requirement reflects Section 10(b) + Section 18 personal-liability exposure. Pricing: `Pricing.outcome` 3-tier — form-d / 10-q-section / 10-k-or-s-1 ($999 / $4,999 / $19,999). Service-level reward = `filing-on-time-rate-and-amendment-rate-reduction`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/general-counsel/regulatory-filing-drafter`.

  ```ts
  import { regulatoryFilingDrafter } from 'autonomous-legal/regulatory-filing-drafter'
  // typed as ServiceInstance<FilingDraftInput, FilingDraftOutput>
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
