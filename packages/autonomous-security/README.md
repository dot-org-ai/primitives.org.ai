# autonomous-security

> **Status: shipped (proof-of-life).** Six Services — `vuln-triager`, `access-review-coordinator`, `phishing-simulation-orchestrator`, `incident-response-orchestrator`, `threat-model-author`, `compliance-audit-prepper` — are implemented against `services-as-software/v3` + the `autonomous-finance` substrate.

Catalog package: security-ops Services-as-Software, defined on the primitive substrate. Distinct from `autonomous-operations` (infra-ops / SRE) — this package focuses on the security-team vertical: vulnerability disclosure triage, user-access review, security-awareness phishing simulation, security-incident response coordination, threat modeling for new systems, and pre-audit evidence prep.

## What this is

Concrete `Service.define({...})` calls for in-house security-ops work — CVE / pen-test / bug-bounty triage with reachability analysis, quarterly user-access review (UAR) with per-manager attestation loop, security-awareness phishing simulation with role-targeted templates, SEV2+ incident-response coordination with CISO + GC sign-off, STRIDE/PASTA threat modeling for new systems / features, and pre-audit evidence prep + auditor question-bank — that the agentic economy can deliver as software. Sibling of `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`. Thirteenth catalog package; advances v3 §15's "catalog Services" leg into the security-ops vertical.

## Shipped Services

- **`vuln-triager`** — CVE / pen-test / bug-bounty disclosure triage. Trigger: new CVE published affecting deps OR pen-test report received OR bug-bounty report submitted. Cascade: `fetch-vuln-details-affected-deps-and-reachability-from-app-code (Code) → classify-severity-and-actual-blast-radius-given-deployment-context (Generative) → draft-remediation-plan-with-options-and-downgrade-fallback (Generative) → security-lead-review-and-priority-set (Human, regulatory rationale) → emit-triage-record-and-open-tracking-issues (Code)`. EvaluatorPanel of 4 personas (reachability-analysis-soundness-checker + remediation-realism-reviewer + security-threat (sox-aware) + regulatory-compliance (sox)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(security-lead))`. Pricing: `Pricing.perInvocation` 3-tier — low / medium / critical ($199 / $999 / $4,999) — keyed on CVSS-derived severity. Service-level reward = `time-to-triage-and-remediation-cycle-time-improvement`. Archetype: `triage`. Lineage: `business.org.ai/cells/security-leads/vuln-triager`.

  ```ts
  import { vulnTriager } from 'autonomous-security/vuln-triager'
  // typed as ServiceInstance<VulnTriggerInput, VulnTriageOutput>
  ```

- **`access-review-coordinator`** — quarterly user-access-review (UAR). Trigger: quarterly cron + scope = sensitive-systems users. Cascade: `fetch-access-grants-ldap-snapshot-and-role-membership (Code) → synthesize-anomaly-detection-orphaned-grants-privilege-creep-and-dormant-accounts (Generative) → draft-revocation-recommendations-and-manager-attestation-questions (Generative) → per-manager-attestation-loop (Human, approval rationale) → emit-attestation-evidence-and-revoke-confirmed-grants (Code)`. EvaluatorPanel of 4 personas (anomaly-precision-checker + attestation-coverage-checker + regulatory-compliance (sox) + data-privacy (gdpr)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(security-lead))`. Pricing: `Pricing.subscription` $1,499/mo per security-team subscription with metered overage at $49 per manager-attestation loop completed. Service-level reward = `orphaned-grant-rate-reduction`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/security-leads/access-review-coordinator`.

  ```ts
  import { accessReviewCoordinator } from 'autonomous-security/access-review-coordinator'
  // typed as ServiceInstance<AccessReviewInput, AccessReviewOutput>
  ```

- **`phishing-simulation-orchestrator`** — security-awareness phishing-simulation. Trigger: monthly cron + employee population in scope. Cascade: `fetch-employee-roster-role-context-and-prior-simulation-results (Code) → synthesize-role-targeted-phish-templates-3-to-5-variants-per-role-cluster (Generative) → draft-debrief-content-for-clickers-and-escalation-for-repeat-offenders (Generative) → security-lead-review-and-approve-templates-before-launch (Human, regulatory rationale) → launch-simulation-and-emit-engagement-tracking (Code)`. EvaluatorPanel of 4 personas (template-realism-reviewer + role-targeting-checker + brand-safety (low-risk-tolerance) + security-threat (prompt-injection)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(security-lead))`. Pricing: `Pricing.outcome` 3-tier — small-org / medium-org / enterprise ($999 / $4,999 / $19,999) — keyed on employee-count band. Service-level reward = `phish-click-rate-reduction-quarter-over-quarter`. Archetype: `content-generation`. Lineage: `business.org.ai/cells/security-leads/phishing-simulation-orchestrator`.

  ```ts
  import { phishingSimulationOrchestrator } from 'autonomous-security/phishing-simulation-orchestrator'
  // typed as ServiceInstance<PhishingSimulationInput, PhishingSimulationOutput>
  ```

- **`incident-response-orchestrator`** — security-incident response coordination. Trigger: security-incident SEV2+ declared. Cascade: `fetch-current-detection-asset-context-and-breach-history (Code) → synthesize-initial-impact-assessment-likely-blast-radius-and-IOC-correlation (Generative) → supervised-coordinate-evidence-collection-containment-recommendations-and-comms-strategy (Agentic, supervised) → CISO-and-GC-review-and-approve-actions (Human, regulatory rationale) → emit-incident-timeline-post-update-and-regulatory-notification-prep (Code)`. EvaluatorPanel of 6 personas (impact-assessment-soundness-checker + containment-actionability-reviewer + comms-clarity-checker + regulatory-compliance (gdpr) + data-privacy (full PII surface) + brand-safety (low-risk-tolerance)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(CISO) + HumanSign(GC))`. Pricing: `Pricing.outcome` 3-tier — SEV2 / SEV1 / breach-with-disclosure ($4,999 / $19,999 / $99,999) — keyed on declared incident severity. Service-level reward = `time-to-containment-and-time-to-disclosure-readiness`. Archetype: `multi-step-research`. Lineage: `business.org.ai/cells/security-leads/incident-response-orchestrator`.

  ```ts
  import { incidentResponseOrchestrator } from 'autonomous-security/incident-response-orchestrator'
  // typed as ServiceInstance<IncidentResponseInput, IncidentResponseOutput>
  ```

- **`threat-model-author`** — threat modeling for new systems / features. Trigger: new service / feature pre-launch + threat-model required. Cascade: `fetch-system-design-dataflow-dependency-graph-auth-model-and-prior-threat-models (Code) → STRIDE-or-PASTA-analysis-enumerate-threats-by-component-and-likelihood-and-impact-scoring (Generative) → draft-mitigations-risk-acceptance-recommendations-and-monitoring-watchpoints (Generative) → security-architect-and-service-owner-review (Human, premium rationale) → emit-threat-model-doc-and-linked-mitigation-tickets (Code)`. EvaluatorPanel of 5 personas (threat-enumeration-completeness-checker + scoring-soundness-checker + mitigation-actionability-reviewer + security-threat (5-surface) + edge-case-coverage (≥5 cases per scenario)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(security-architect))`. Pricing: `Pricing.perInvocation` 3-tier — small-feature / service / cross-system-platform ($499 / $1,999 / $7,999) — keyed on modeling scope. Service-level reward = `post-launch-incident-rate-on-modeled-systems`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/security-leads/threat-model-author`.

  ```ts
  import { threatModelAuthor } from 'autonomous-security/threat-model-author'
  // typed as ServiceInstance<ThreatModelInput, ThreatModelOutput>
  ```

- **`compliance-audit-prepper`** — pre-audit evidence prep + auditor question-bank. Trigger: external audit scheduled (SOC2 / ISO / PCI / HIPAA). Cascade: `fetch-control-status-evidence-trail-prior-audit-findings-and-auditor-questionnaire (Code) → synthesize-evidence-mapping-per-control-flag-gaps-and-draft-control-narratives (Generative) → prepare-auditor-question-bank-escalation-paths-and-privileged-info-handling (Generative) → GC-compliance-officer-and-CISO-review (Human, regulatory rationale) → emit-audit-prep-pack-and-auditor-portal-staging (Code)`. EvaluatorPanel of 5 personas (control-coverage-checker + evidence-completeness-checker + gap-remediation-feasibility-reviewer + regulatory-compliance (sox) + factual-accuracy (citation-required, first-party + industry-standard sources)) under `all-approve`. OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(compliance-officer))`. Pricing: `Pricing.outcome` 3-tier — SOC2 Type 1 / SOC2 Type 2 or ISO / multi-framework ($9,999 / $49,999 / $199,999) — keyed on audit framework depth. Service-level reward = `audit-finding-count-reduction-and-cycle-time-improvement`. Archetype: `quality-review`. Lineage: `business.org.ai/cells/security-leads/compliance-audit-prepper`.

  ```ts
  import { complianceAuditPrepper } from 'autonomous-security/compliance-audit-prepper'
  // typed as ServiceInstance<ComplianceAuditPrepInput, ComplianceAuditPrepOutput>
  ```

## Why a separate package

See `autonomous-customer-success/README.md` — same rationale: one functional area per package, independent release cadence, depends only on primitive substrate. Distinct from `autonomous-operations` (which covers SRE / infra-ops / on-call / capacity) — security-ops is a peer vertical with its own buyer (CISO / security-lead) and its own regulatory + compliance posture.

## Status

Shipped:

- **`services-as-software/v3`** `Service.define` + `OutcomeContract` + `EvaluatorPanel` + `Personas`
- **`autonomous-finance`** `Pricing.outcome({ tiers })`, `Pricing.subscription({ plan, metered })`, `Pricing.perInvocation({ tiers })`, `AND` / `SchemaMatch` / `EvaluatorPass` / `HumanSign` predicates
- **`digital-tools`** `Code` / `Generative` / `Agentic` / `Human` Function sugar with per-Function `RewardSignal` + `HumanRationale` (`approval` / `physical` / `regulatory` / `trust` / `premium`)

Deferred / placeholder until:

- **`business-as-code`** `$.Reward` + `$.KeyResult` ladder (time-to-triage-and-remediation → MTTR-on-vulns / orphaned-grant-rate / phish-click-rate / time-to-containment-and-disclosure-readiness / post-launch-incident-rate / audit-finding-count-and-cycle-time terminal hills) — current `kr:*` references are placeholder strings
- **`Service.invoke`** real cascade execution — today the cascade compiles but invocation handles return stub events

## References

- Companion catalogs: `autonomous-marketing`, `autonomous-revenue`, `autonomous-customer-success`, `autonomous-finance-services`, `autonomous-developer-experience`, `autonomous-startups`, `autonomous-operations`, `autonomous-people`, `autonomous-legal`, `autonomous-data`, `autonomous-product`, `autonomous-supplychain`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v2.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
