/**
 * Identity Lifecycle Orchestrator Service — joiner / mover / leaver (JML)
 * identity-automation Service for the IT-ops catalog.
 *
 * Distinguishing shape vs. siblings (`helpdesk-ticket-resolver`,
 * `endpoint-fleet-monitor`):
 *   - `quality-review` archetype — the artefact is an IT-lead-signed
 *     identity-orchestration pack (access-grants + revocations + role-fit
 *     check + segregation-of-duties (SoD) violations + onboarding/
 *     offboarding runbook + comms templates) plus a manager-attestation
 *     audit (where required) and an applied-grants/revocations + audit-
 *     evidence emit, not a per-ticket resolution and not a fleet drift
 *     report;
 *   - 5-step cascade: Code fan-in (employee record + role template +
 *     previous access + system-of-record config) → Generative (synthesise
 *     access grants + revocations + role-fit checks + SoD violations) →
 *     Generative (draft onboarding-or-offboarding runbook + comms
 *     templates) → Human (IT-lead + manager-attestation-where-required)
 *     → Code (apply grants + revocations + emit audit evidence);
 *   - `Pricing.perInvocation` 3 tiers keyed on JML event kind —
 *     joiner / mover / leaver ($299 / $499 / $799) — the orchestrator is
 *     worth more on a mover (most failure modes: orphaned grants from old
 *     role, gaps on new role, SoD violation when the union of old + new
 *     grants overlaps) than on a clean joiner, and worth most on a leaver
 *     where missed revocations create the longest-lived audit findings;
 *   - declarative HITL = mandatory IT-lead review (the IT-lead owns
 *     identity-grant + identity-revocation authority — `regulatory`
 *     rationale, SOX / SOC2 / ISO-27001 evidence trails name a human
 *     owner on every JML event) plus conditional manager-attestation
 *     (`approval` rationale, the manager attests on direct-reports'
 *     access where the role-template / SoD policy requires it). The
 *     OutcomeContract requires IT-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(SoD-violation-
 *     coverage + role-fit-soundness + audit-evidence-completeness) +
 *     HumanSign(IT-lead))`.
 *
 * Per design v3 §3 (Catalog HOW it-ops) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation tiered pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `jml-cycle-time-and-orphaned-grant-rate-reduction`
 * — the compound metric every IT + IAM org optimises against (the
 * orchestrator is worth running iff JML-cycle-time AND orphaned-grant-rate
 * both beat the pre-Service baseline at parity headcount + parity in-scope-
 * system count).
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
 * Input — an HRIS event (joiner / mover / leaver) OR a weekly access-review
 * trigger. Tight: 9 fields cover the IT-team identity, the trigger kind,
 * the JML event kind (so the per-invocation tier resolves at intake), the
 * subject employee identity + role template references (current and prior,
 * for movers), the system-of-record config pointer, the in-scope target
 * systems the cascade fans-out grants and revocations to, the assigned
 * IT-lead routing target, the assigned manager routing target (where
 * attestation is required), and the effective-date the runbook anchors
 * timestamps against.
 */
export const IdentityLifecycleInputSchema = z.object({
  itTeamRef: z.string(),
  triggerKind: z.enum(['hris-event', 'weekly-access-review']),
  jmlEventKind: z.enum(['joiner', 'mover', 'leaver']),
  subjectEmployee: z.object({
    employeeRef: z.string(),
    fullName: z.string(),
    primaryEmail: z.string(),
    departmentRef: z.string(),
    managerRef: z.string(),
    locationRef: z.string().optional(),
    employmentClass: z
      .enum(['full-time', 'part-time', 'contractor', 'intern'])
      .default('full-time'),
  }),
  roleTemplate: z.object({
    currentRoleRef: z.string(),
    priorRoleRef: z.string().optional(), // movers only
    roleFitGuardrails: z.array(z.string()).default([]),
  }),
  systemOfRecordRef: z.string(),
  inScopeTargetSystems: z
    .array(
      z.object({
        systemRef: z.string(),
        systemKind: z.enum([
          'idp',
          'cloud-iam',
          'sso',
          'database',
          'data-warehouse',
          'codebase',
          'finance-system',
          'crm',
          'hris',
          'productivity-suite',
        ]),
        sensitivityTier: z.enum(['restricted', 'confidential', 'internal']),
      })
    )
    .min(1),
  assignedItLeadRef: z.string(),
  assignedManagerRef: z.string(),
  effectiveDate: z.string(), // ISO-8601
})

/**
 * Output — an IT-lead-signed identity-orchestration pack: the employee +
 * role-template + previous-access fan-in snapshot, the synthesised access-
 * grants + revocations + role-fit-checks + SoD-violations, the drafted
 * onboarding-or-offboarding runbook + comms templates, the IT-lead review
 * + manager-attestation audit (where required), the applied grants +
 * revocations log, and the emitted audit-evidence dossier.
 */
export const IdentityLifecycleOutputSchema = z.object({
  itTeamRef: z.string(),
  jmlEventKind: z.enum(['joiner', 'mover', 'leaver']),
  subjectEmployeeRef: z.string(),
  effectiveDate: z.string(),
  fanInSnapshot: z.object({
    employeeRecord: z.object({
      employeeRef: z.string(),
      tenureBand: z.enum(['under-90-days', 'tenured', 'long-tenured']).optional(),
      employmentClass: z.enum(['full-time', 'part-time', 'contractor', 'intern']),
    }),
    currentRoleTemplate: z.object({
      roleRef: z.string(),
      grantedRoleSet: z.array(z.string()),
      sodConstraintRefs: z.array(z.string()).default([]),
    }),
    priorRoleTemplate: z
      .object({
        roleRef: z.string(),
        grantedRoleSet: z.array(z.string()),
      })
      .optional(),
    previousAccess: z.array(
      z.object({
        systemRef: z.string(),
        grantedRoles: z.array(z.string()),
        grantedAt: z.string(),
        lastUsedAt: z.string().optional(),
      })
    ),
  }),
  identityChangeSet: z.object({
    grantsToApply: z
      .array(
        z.object({
          changeId: z.string(),
          systemRef: z.string(),
          targetRoles: z.array(z.string()).min(1),
          rationale: z.string(),
          requiresManagerAttestation: z.boolean(),
        })
      )
      .default([]),
    revocationsToApply: z
      .array(
        z.object({
          changeId: z.string(),
          systemRef: z.string(),
          targetRoles: z.array(z.string()).min(1),
          rationale: z.string(),
          requiresManagerAttestation: z.boolean(),
        })
      )
      .default([]),
    roleFitChecks: z.array(
      z.object({
        checkId: z.string(),
        guardrail: z.string(),
        status: z.enum(['pass', 'warning', 'fail']),
        rationale: z.string(),
      })
    ),
    sodViolations: z
      .array(
        z.object({
          violationId: z.string(),
          sodConstraintRef: z.string(),
          conflictingRoleRefs: z.array(z.string()).min(2),
          severityBand: z.enum(['low', 'medium', 'high', 'critical']),
          recommendedResolution: z.enum([
            'remove-conflicting-role',
            'split-duty-with-peer',
            'apply-time-bound-exception',
            'escalate',
          ]),
          rationale: z.string(),
        })
      )
      .default([]),
  }),
  runbook: z.object({
    runbookKind: z.enum(['onboarding', 'movement', 'offboarding']),
    summary: z.string(),
    steps: z
      .array(
        z.object({
          stepId: z.string(),
          ownerRoleRef: z.enum(['it-tech', 'it-lead', 'manager', 'subject', 'security-lead']),
          description: z.string(),
          targetCompletionAt: z.string(),
        })
      )
      .min(1),
    commsTemplates: z.array(
      z.object({
        templateId: z.string(),
        audience: z.enum(['subject', 'manager', 'team', 'external-counterparties']),
        channel: z.enum(['email', 'slack', 'teams', 'sms']),
        subject: z.string().optional(),
        bodyMarkdown: z.string(),
      })
    ),
  }),
  itLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  managerAttestations: z
    .array(
      z.object({
        managerRef: z.string(),
        attestedChangeIds: z.array(z.string()),
        decisions: z.array(
          z.object({
            changeId: z.string(),
            decision: z.enum(['confirm', 'deny', 'escalate']),
            notes: z.string().optional(),
            decidedAt: z.string(),
          })
        ),
        attestationCompletedAt: z.string(),
      })
    )
    .default([]),
  appliedActions: z.object({
    appliedGrants: z.array(
      z.object({
        changeId: z.string(),
        systemRef: z.string(),
        appliedRoles: z.array(z.string()),
        appliedAt: z.string(),
        outcome: z.enum(['succeeded', 'partial', 'failed', 'skipped']),
      })
    ),
    appliedRevocations: z.array(
      z.object({
        changeId: z.string(),
        systemRef: z.string(),
        revokedRoles: z.array(z.string()),
        revokedAt: z.string(),
        outcome: z.enum(['succeeded', 'partial', 'failed', 'skipped']),
      })
    ),
  }),
  auditEvidence: z.object({
    evidenceDossierRef: z.string(),
    evidenceDossierUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type IdentityLifecycleInput = z.infer<typeof IdentityLifecycleInputSchema>
export type IdentityLifecycleOutput = z.infer<typeof IdentityLifecycleOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_jmlCycleAndOrphanedGrant: RewardSignal = {
  keyResultRef:
    'kr:identity-lifecycle-orchestrator:jml-cycle-time-and-orphaned-grant-rate-reduction',
}
const kr_fanInCoverage: RewardSignal = {
  keyResultRef: 'kr:identity-lifecycle-orchestrator:fan-in-coverage',
}
const kr_sodAndRoleFitSoundness: RewardSignal = {
  keyResultRef: 'kr:identity-lifecycle-orchestrator:sod-and-role-fit-soundness',
}
const kr_runbookActionability: RewardSignal = {
  keyResultRef: 'kr:identity-lifecycle-orchestrator:runbook-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:identity-lifecycle-orchestrator:emit-latency',
}

// ============================================================================
// Identity Lifecycle Orchestrator Service
// ============================================================================

/**
 * Identity Lifecycle Orchestrator — HRIS event (joiner / mover / leaver) OR
 * weekly access-review trigger → IT-lead-signed identity-orchestration pack
 * + applied grants and revocations + audit-evidence dossier as a Service.
 *
 * Cascade: fetch-employee-record-role-template-previous-access-and-system-of-record-config (Code, fan-in)
 *        → synthesize-access-grants-and-revocations-role-fit-checks-and-segregation-of-duties-violations (Generative)
 *        → draft-onboarding-or-offboarding-runbook-and-comms-templates (Generative)
 *        → IT-lead-and-manager-attestation-where-required (Human, regulatory rationale)
 *        → apply-grants-revocations-and-emit-audit-evidence (Code, fan-out).
 */
export const identityLifecycleOrchestrator: ServiceInstance<
  IdentityLifecycleInput,
  IdentityLifecycleOutput
> = Service.define<IdentityLifecycleInput, IdentityLifecycleOutput>({
  name: 'Identity Lifecycle Orchestrator',
  promise:
    'Every joiner, mover, and leaver lands as an IT-lead-signed identity-orchestration pack — role-template-aligned grants and revocations, SoD-violation coverage, role-fit guardrail checks, an onboarding/movement/offboarding runbook with audience-keyed comms templates, and a manager-attestation audit where required — so JML cycle-time drops AND orphaned-grant rate trends down quarter-over-quarter.',
  audience: 'business',
  archetype: 'quality-review',
  schema: {
    input: IdentityLifecycleInputSchema,
    output: IdentityLifecycleOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-employee-record-role-template-previous-access-and-system-of-record-config',
        reward: kr_fanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-access-grants-and-revocations-role-fit-checks-and-segregation-of-duties-violations',
        reward: kr_sodAndRoleFitSoundness,
      }),
      Generative({
        name: 'draft-onboarding-or-offboarding-runbook-and-comms-templates',
        reward: kr_runbookActionability,
      }),
      Human({
        name: 'IT-lead-and-manager-attestation-where-required',
        // `regulatory` rationale: SOX / SOC2 / ISO-27001 evidence trails
        // require a named human owner on every JML grant + revocation
        // batch — the IT-lead is the compliance-tied accountability
        // owner. Manager attestation fires conditionally on grants /
        // revocations whose change-record carries
        // `requiresManagerAttestation = true` (the manager attests on
        // direct-reports' access where the role-template / SoD policy
        // requires it; that loop is approval-rationale, but the
        // dominant gate at this Function is regulatory).
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'apply-grants-revocations-and-emit-audit-evidence',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'workday.read',
      'rippling.read',
      'bamboohr.read',
      'okta.users',
      'okta.groups',
      'azure-ad.users',
      'google-workspace.users',
      'aws-iam.read',
      'aws-iam.write',
      'gcp-iam.read',
      'gcp-iam.write',
      'snowflake.grants',
      'github.org-members',
      'salesforce.users',
      'productivity-suite.write',
      'audit-log.write',
      'comms.notify',
    ],
    // JML intake: clarification disabled — the cascade synthesises from
    // the HRIS + role-template + previous-access + system-of-record
    // signals; the IT-lead review + per-required-manager attestation
    // loop is the only multi-human contact surface, and the runbook
    // comms templates are the contact surface with the subject + team.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Leavers and any restricted-tier system in scope escalate the
        // synthesis to a senior IAM specialist before the IT-lead +
        // manager-attestation review (the IT-lead still signs, but a
        // senior backstops grant-revocation completeness on the highest-
        // risk tier — leavers carry the longest-lived audit findings
        // when revocations are missed).
        when: 'jmlEventKind == "leaver" || inScopeTargetSystems.some(s => s.sensitivityTier == "restricted")',
        action: 'escalate',
      },
      {
        // Every JML event routes through the IT-lead +
        // manager-attestation-where-required review step before grants
        // and revocations apply; OutcomeContract enforces the IT-lead
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'IT-lead-and-manager-attestation-where-required',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:identity-lifecycle-orchestrator-review',
    personas: [
      // SoD-violation-coverage reviewer — pedantic check that every
      // SoD-constraint defined in the role-template is evaluated, that
      // every flagged violation cites the conflicting roles + the
      // sod-constraint-ref, and that no grant set is applied that would
      // create a new SoD violation without a recommended-resolution
      // attached.
      Personas.pedantic({
        domain: 'sod-violation-coverage',
        rubric: [
          'every-sod-constraint-in-role-template-is-evaluated',
          'every-violation-cites-conflicting-roles-and-constraint-ref',
          'every-violation-has-a-recommended-resolution',
          'no-grant-applied-that-creates-a-new-sod-violation-silently',
          'severity-bands-track-policy-tier',
        ],
        name: 'sod-violation-coverage-checker',
      }),
      // Role-fit-soundness reviewer — adversarial check that the
      // synthesised grant + revocation set actually matches the role-
      // template's `grantedRoleSet`, that movers' prior-role grants are
      // either retained-by-overlap or revoked-by-delta, and that role-
      // fit guardrail checks are exhaustive.
      Personas.skeptic({
        domain: 'role-fit-soundness',
        focus: [
          'grant-set-matches-current-role-template',
          'mover-prior-role-grants-resolved-by-overlap-or-delta',
          'every-guardrail-from-input-evaluated',
          'no-silent-omission-of-required-role',
          'no-extra-role-granted-beyond-template',
        ],
        name: 'role-fit-soundness-reviewer',
      }),
      // Audit-evidence-completeness reviewer — pedantic check that the
      // emitted audit-evidence dossier carries a named-owner timestamp
      // on every grant + revocation, IT-lead signature, manager-
      // attestation records (where required), and a runbook-step audit
      // trail.
      Personas.pedantic({
        domain: 'audit-evidence-completeness',
        rubric: [
          'every-applied-grant-has-named-owner-and-timestamp',
          'every-applied-revocation-has-named-owner-and-timestamp',
          'it-lead-signature-present-and-timestamped',
          'manager-attestation-present-where-required-flag-true',
          'runbook-step-audit-trail-cites-owners-and-completion-times',
        ],
        name: 'audit-evidence-completeness-checker',
      }),
      // Regulatory-compliance reviewer — SOX-tier compliance check on
      // the audit-evidence dossier (named human owner per JML event,
      // timestamped grants + revocations, signed-off IT-lead review,
      // manager-attestation audit-grade).
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-compliance-reviewer',
      }),
      // Data-privacy reviewer — privacy-impact review on the comms
      // templates + audit-evidence dossier. JML payloads carry name +
      // email + phone PII; the persona enforces minimization on
      // comms-templates and rejects unnecessary PII in the audit
      // dossier.
      Personas.dataPrivacy({
        piiCategories: ['name', 'email', 'phone'],
        name: 'data-privacy-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:identity-lifecycle-orchestrator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-it-lead',
    seller: 'svc:identity-lifecycle-orchestrator',
    serviceRef: 'svc:identity-lifecycle-orchestrator',
    // IT-lead signs every identity-orchestration pack — JML grant +
    // revocation authority cannot be delegated (compliance-tied
    // accountability). Manager attestation is conditional and audited
    // in the schema rather than gated at the OutcomeContract.
    predicate: AND(
      SchemaMatch(IdentityLifecycleOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['it-lead'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 49900n, currency: 'USD' },
    // Sub-3-day SLA — JML cycle-time is the headline metric; the
    // orchestration pack ships within 72h of the trigger (joiners
    // typically need day-one access).
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'joiner',
        amount: 29900n,
        includedPerMonth: 20,
        overage: 29900n,
      },
      {
        id: 'mover',
        amount: 49900n,
        includedPerMonth: 10,
        overage: 49900n,
      },
      {
        id: 'leaver',
        amount: 79900n,
        includedPerMonth: 10,
        overage: 79900n,
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8000n, perApiCall: 8n },
  reward: kr_jmlCycleAndOrphanedGrant,

  lineage: {
    cellRef: 'business.org.ai/cells/it-leads/identity-lifecycle-orchestrator',
    icpContextProblemRef: 'icp:identity-lifecycle-orchestrator:v1',
    foundingHypothesisRef: 'fh:identity-lifecycle-orchestrator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
