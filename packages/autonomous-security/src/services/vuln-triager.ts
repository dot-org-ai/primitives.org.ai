/**
 * Vuln Triager Service — CVE / pen-test / bug-bounty disclosure triage Service
 * for the security catalog.
 *
 * Distinguishing shape vs. siblings (`access-review-coordinator`,
 * `phishing-simulation-orchestrator`):
 *   - `triage` archetype — the artefact is a security-lead-approved triage
 *     record + tracking-issues fan-out keyed on the actual blast-radius given
 *     deployment context, not a quarterly access review or a phishing
 *     simulation campaign;
 *   - 5-step cascade: Code fan-in (vuln details + affected deps + reachability
 *     from app code) → Generative (severity classification + actual blast-
 *     radius given deployment context) → Generative (remediation plan with
 *     options + downgrade fallback) → Human (security-lead review and
 *     priority-set) → Code (emit triage record + open tracking issues);
 *   - `Pricing.perInvocation` 3 tiers keyed on CVSS-derived severity — low /
 *     medium / critical ($199 / $999 / $4,999) — the triage is worth more on
 *     a critical CVE than on a low-severity disclosure;
 *   - declarative HITL = mandatory security-lead review Human Function (the
 *     security-lead owns priority-set authority — no tracking issues open
 *     before the lead has set the priority), plus OutcomeContract requires
 *     security-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(reachability-analysis-
 *     soundness + remediation-realism) + HumanSign(security-lead))`.
 *
 * Per design v3 §3 (Catalog HOW security) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation tiered pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `time-to-triage-and-remediation-cycle-time-improvement`
 * — the compound metric every security-ops org optimises against (the triager
 * is worth running iff time-from-disclosure-to-tracking-issue-open AND time-
 * from-tracking-issue-open-to-remediation-merged both beat the pre-Service
 * baseline at parity severity).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a security disclosure firing into intake. Tight: 8 fields cover
 * the disclosure identity, the disclosure source (CVE feed / pen-test /
 * bug-bounty), the upstream reference, the reported CVSS slice (so the per-
 * invocation tier resolves at intake), the affected dependency surface, the
 * deployment context the cascade reachability-fans-in against, the assigned
 * security-lead routing target, and the issue-tracker fan-out target.
 */
export const VulnTriggerInputSchema = z.object({
  disclosureId: z.string(),
  disclosureSource: z.enum(['cve-feed', 'pen-test-report', 'bug-bounty', 'vendor-advisory']),
  upstreamRef: z.object({
    sourceSystem: z.enum(['nvd', 'github-advisory', 'osv', 'hackerone', 'bugcrowd', 'internal']),
    advisoryRef: z.string(),
    receivedAt: z.string(), // ISO-8601
  }),
  reportedCvss: z.object({
    baseScore: z.number().min(0).max(10),
    severityBand: z.enum(['low', 'medium', 'high', 'critical']),
    vector: z.string().optional(),
  }),
  affectedDeps: z
    .array(
      z.object({
        packageName: z.string(),
        ecosystem: z.enum(['npm', 'pypi', 'maven', 'cargo', 'go', 'rubygems', 'nuget', 'docker']),
        affectedVersionRange: z.string(),
      })
    )
    .min(1),
  deploymentContext: z.object({
    environments: z.array(z.enum(['prod', 'staging', 'dev'])).min(1),
    affectedServices: z.array(z.string()).default([]),
    perimeterPosture: z.enum(['internet-facing', 'tenant-facing', 'internal-only']),
  }),
  assignedSecurityLeadRef: z.string(),
  issueTracker: z.enum(['jira', 'linear', 'github', 'gitlab']),
})

/**
 * Output — a security-lead-approved triage record + tracking-issue fan-out:
 * the vuln-detail snapshot, the reachability analysis from app code, the
 * severity-classification + actual-blast-radius given deployment context,
 * the remediation plan with options + downgrade fallback, the security-lead
 * review audit, the emitted triage-record, and the opened tracking issues.
 */
export const VulnTriageOutputSchema = z.object({
  disclosureId: z.string(),
  vulnDetail: z.object({
    advisoryRef: z.string(),
    title: z.string(),
    summary: z.string(),
    upstreamPublishedAt: z.string(),
    upstreamPatchedVersions: z.array(z.string()).default([]),
  }),
  reachabilityAnalysis: z.object({
    reachableFromAppCode: z.boolean(),
    reachableCallSites: z
      .array(
        z.object({
          serviceRef: z.string(),
          filePath: z.string(),
          symbol: z.string(),
          callDepth: z.number().int().nonnegative(),
        })
      )
      .default([]),
    notReachableRationale: z.string().optional(),
  }),
  severityClassification: z.object({
    derivedSeverityBand: z.enum(['low', 'medium', 'high', 'critical']),
    actualBlastRadius: z.enum(['contained', 'service-wide', 'tenant-wide', 'global']),
    rationale: z.string(),
    deviationFromReportedCvss: z.string().optional(),
  }),
  remediationPlan: z.object({
    summary: z.string(),
    options: z
      .array(
        z.object({
          optionId: z.string(),
          approach: z.enum([
            'upgrade',
            'patch-in-place',
            'mitigate-with-config',
            'remove-dep',
            'accept-risk',
          ]),
          targetVersion: z.string().optional(),
          effortEstimate: z.enum(['hours', 'days', 'weeks']),
          residualRiskNote: z.string(),
        })
      )
      .min(1),
    downgradeFallback: z.object({
      available: z.boolean(),
      targetVersion: z.string().optional(),
      rationale: z.string(),
    }),
    recommendedOptionId: z.string(),
  }),
  securityLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-priority-edit', 'request-revision', 'reject']),
    setPriority: z.enum(['P0', 'P1', 'P2', 'P3']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  triageRecord: z.object({
    triageRecordRef: z.string(),
    emittedAt: z.string(),
  }),
  trackingIssues: z.array(
    z.object({
      tracker: z.enum(['jira', 'linear', 'github', 'gitlab']),
      issueRef: z.string(),
      ownerRef: z.string(),
      createdAt: z.string(),
    })
  ),
  generatedAt: z.string(),
})

export type VulnTriggerInput = z.infer<typeof VulnTriggerInputSchema>
export type VulnTriageOutput = z.infer<typeof VulnTriageOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_triageCycleTime: RewardSignal = {
  keyResultRef: 'kr:vuln-triager:time-to-triage-and-remediation-cycle-time-improvement',
}
const kr_reachabilityCoverage: RewardSignal = {
  keyResultRef: 'kr:vuln-triager:reachability-coverage',
}
const kr_severityCalibration: RewardSignal = {
  keyResultRef: 'kr:vuln-triager:severity-calibration',
}
const kr_remediationRealism: RewardSignal = {
  keyResultRef: 'kr:vuln-triager:remediation-realism',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:vuln-triager:emit-latency',
}

// ============================================================================
// Vuln Triager Service
// ============================================================================

/**
 * Vuln Triager — new CVE published affecting deps OR pen-test report
 * received OR bug-bounty report submitted → security-lead-approved triage
 * record + tracking-issue fan-out keyed on the actual blast-radius given
 * deployment context as a Service.
 *
 * Cascade: fetch-vuln-details-affected-deps-and-reachability-from-app-code (Code, fan-in)
 *        → classify-severity-and-actual-blast-radius-given-deployment-context (Generative)
 *        → draft-remediation-plan-with-options-and-downgrade-fallback (Generative)
 *        → security-lead-review-and-priority-set (Human, regulatory rationale)
 *        → emit-triage-record-and-open-tracking-issues (Code, fan-out).
 */
export const vulnTriager: ServiceInstance<VulnTriggerInput, VulnTriageOutput> = Service.define<
  VulnTriggerInput,
  VulnTriageOutput
>({
  name: 'Vuln Triager',
  promise:
    'Every CVE / pen-test / bug-bounty disclosure lands as a security-lead-approved triage record + opened tracking issues, with reachability-from-app-code computed and remediation options (including downgrade fallback) drafted, so disclosures move from inbox to assigned-and-prioritised in hours instead of weeks.',
  audience: 'business',
  archetype: 'triage',
  schema: { input: VulnTriggerInputSchema, output: VulnTriageOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-vuln-details-affected-deps-and-reachability-from-app-code',
        reward: kr_reachabilityCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'classify-severity-and-actual-blast-radius-given-deployment-context',
        reward: kr_severityCalibration,
      }),
      Generative({
        name: 'draft-remediation-plan-with-options-and-downgrade-fallback',
        reward: kr_remediationRealism,
      }),
      Human({
        name: 'security-lead-review-and-priority-set',
        // `regulatory` rationale: vuln-triage priority is compliance-tied
        // accountability — SOX / SOC2 / ISO-27001 evidence trails require
        // a named human owner on the triage decision. The gate stays human
        // regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-triage-record-and-open-tracking-issues',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'nvd.advisories',
      'github.advisories',
      'osv.advisories',
      'hackerone.reports',
      'bugcrowd.reports',
      'sbom.read',
      'codeql.queries',
      'service-graph.read',
      'deploy-history.read',
      'jira.issues',
      'linear.issues',
      'github.issues',
    ],
    // Vuln intake: clarification disabled — the cascade synthesises from
    // the disclosure + SBOM + reachability; the security-lead review step
    // is the single human contact point during triage.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Critical-severity disclosures (CVSS-derived `critical` or
        // reachable-from-internet-facing-perimeter) escalate the triage to
        // a senior application-security supervisor before the security-
        // lead review (the lead still signs, but a senior backstops
        // synthesis quality on the highest-stakes tier).
        when: 'reportedCvss.severityBand == "critical" || deploymentContext.perimeterPosture == "internet-facing"',
        action: 'escalate',
      },
      {
        // Every disclosure routes through security-lead review before
        // tracking issues open; OutcomeContract enforces the signature,
        // the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'security-lead-review-and-priority-set',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:vuln-triager-review',
    personas: [
      // Reachability-analysis-soundness reviewer — pedantic check that
      // the reachability claim is grounded (`reachableFromAppCode = true`
      // requires at least one cited call-site with file + symbol + call-
      // depth; `reachableFromAppCode = false` requires a non-empty
      // `notReachableRationale`). Guards against "we ran the scanner and
      // assume not reachable" hand-waving.
      Personas.pedantic({
        domain: 'reachability-analysis-soundness',
        rubric: [
          'reachable-true-cites-at-least-one-call-site',
          'reachable-true-cites-file-symbol-and-call-depth',
          'reachable-false-cites-non-empty-rationale',
          'no-reachability-claim-without-evidence',
          'derived-severity-band-tracks-reachability',
        ],
        name: 'reachability-analysis-soundness-checker',
      }),
      // Remediation-realism reviewer — adversarially probes whether each
      // remediation option is concretely actionable (cites target version
      // or config knob, not "patch when convenient") and whether the
      // recommended option carries a residual-risk note that's specific
      // to the option's approach.
      Personas.skeptic({
        domain: 'remediation-realism',
        focus: [
          'every-option-cites-target-version-or-config-knob',
          'every-option-has-realistic-effort-estimate',
          'every-option-has-specific-residual-risk-note',
          'recommended-option-justified',
          'downgrade-fallback-is-realistic',
        ],
        name: 'remediation-realism-reviewer',
      }),
      // Security-threat reviewer — adversarial security review across the
      // four threat surfaces most relevant to a vuln-triage decision
      // (injection, data-exfiltration, privilege-escalation, denial-of-
      // service). Probes whether the triage decision adequately accounts
      // for each surface.
      Personas.securityThreat({
        surfaces: ['injection', 'data-exfiltration', 'privilege-escalation', 'denial-of-service'],
        name: 'security-threat-reviewer',
      }),
      // Regulatory-compliance reviewer — SOX-tier compliance check on the
      // triage record (accountability trail, named owner on each tracking
      // issue, evidence-grade emit timestamps).
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-compliance-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:vuln-triager:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-security-lead',
    seller: 'svc:vuln-triager',
    serviceRef: 'svc:vuln-triager',
    // Security-lead signs every triage record before tracking issues
    // open — vuln-triage priority-set authority cannot be delegated
    // (compliance-tied accountability).
    predicate: AND(
      SchemaMatch(VulnTriageOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['security-lead'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 99900n, currency: 'USD' },
    // Sub-day SLA — vuln triage needs a record posted within hours,
    // not days, especially on the critical tier.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'low',
        amount: 19900n,
        includedPerMonth: 30,
        overage: 19900n,
      },
      {
        id: 'medium',
        amount: 99900n,
        includedPerMonth: 10,
        overage: 99900n,
      },
      {
        id: 'critical',
        amount: 499900n,
        includedPerMonth: 3,
        overage: 499900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 5500n, perApiCall: 14n },
  reward: kr_triageCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/security-leads/vuln-triager',
    icpContextProblemRef: 'icp:vuln-triager:v1',
    foundingHypothesisRef: 'fh:vuln-triager:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
