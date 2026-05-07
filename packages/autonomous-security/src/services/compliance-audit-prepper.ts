/**
 * Compliance Audit Prepper Service — pre-audit evidence prep + auditor-
 * question-bank Service for the security catalog.
 *
 * Distinguishing shape vs. siblings (`vuln-triager`,
 * `access-review-coordinator`, `phishing-simulation-orchestrator`,
 * `incident-response-orchestrator`, `threat-model-author`):
 *   - `quality-review` archetype — the artefact is a compliance-officer-
 *     approved audit-prep pack + auditor-portal-staging package, not an
 *     incident-response coordination pack or a STRIDE/PASTA threat model;
 *   - 5-step cascade: Code fan-in (control status + evidence trail + prior
 *     audit findings + auditor questionnaire) → Generative (synthesise
 *     evidence-mapping per control + flag gaps + draft control narratives)
 *     → Generative (prepare auditor question-bank + escalation paths +
 *     privileged-info handling) → Human (GC + compliance-officer +
 *     CISO review) → Code (emit audit-prep pack + auditor-portal staging);
 *   - `Pricing.outcome` 3 tiers keyed on audit framework depth: SOC2 Type 1
 *     / SOC2 Type 2 or ISO / multi-framework ($9,999 / $49,999 / $199,999) —
 *     value scales with the number of frameworks + evidence-window depth;
 *   - declarative HITL = mandatory GC + compliance-officer + CISO review
 *     (compliance-officer owns control-coverage + evidence-completeness
 *     authority; GC owns privileged-info-handling + auditor-comms
 *     authority; CISO co-reviews to ensure security-control narratives
 *     are technically accurate). OutcomeContract requires compliance-
 *     officer signature (regulatory rationale);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(control-coverage
 *     + evidence-completeness + gap-remediation-feasibility) +
 *     HumanSign(compliance-officer))`.
 *
 * Per design v3 §3 (Catalog HOW security) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `audit-finding-count-reduction-and-cycle-time-
 * improvement` — the compound metric every compliance-ops org optimises
 * against (the prepper is worth running iff the audit-finding count AND
 * the audit cycle time both beat the pre-Service baseline at parity
 * framework + parity scope).
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
 * Input — an external audit scheduled. Tight: 8 fields cover the audit
 * identity, the framework set the audit covers (so the per-tier outcome
 * pricing resolves at intake), the audit-window dates, the auditor firm
 * + named partner, the in-scope-systems set the cascade fans-in against,
 * the prior-audit-findings lineage so unresolved findings carry forward,
 * the assigned compliance-officer + GC + CISO routing targets for the
 * regulatory-grade approval, and the auditor-portal target for the staging
 * fan-out.
 */
export const ComplianceAuditPrepInputSchema = z.object({
  auditId: z.string(),
  frameworkScope: z.enum(['soc2-type-1', 'soc2-type-2-or-iso', 'multi-framework']),
  frameworks: z
    .array(
      z.enum([
        'soc2-type-1',
        'soc2-type-2',
        'iso-27001',
        'iso-27017',
        'iso-27018',
        'pci-dss',
        'hipaa',
        'fedramp',
        'gdpr',
      ])
    )
    .min(1),
  auditWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
    fieldworkStartAt: z.string(),
    reportDueAt: z.string(),
  }),
  auditor: z.object({
    firmRef: z.string(),
    namedPartnerRef: z.string(),
    portalKind: z.enum(['drata', 'vanta', 'secureframe', 'tugboat-logic', 'auditor-proprietary']),
  }),
  inScopeSystems: z
    .array(
      z.object({
        systemRef: z.string(),
        systemKind: z.enum([
          'cloud-iam',
          'sso',
          'database',
          'data-warehouse',
          'codebase',
          'finance-system',
          'crm',
          'hris',
          'production-network',
        ]),
        sensitivityTier: z.enum(['restricted', 'confidential', 'internal']),
      })
    )
    .min(1),
  priorAuditFindings: z
    .array(
      z.object({
        priorFindingId: z.string(),
        priorAuditId: z.string(),
        status: z.enum(['remediated', 'in-progress', 'unremediated']),
      })
    )
    .default([]),
  assignedComplianceOfficerRef: z.string(),
  assignedGcRef: z.string(),
  assignedCisoRef: z.string(),
})

/**
 * Output — a compliance-officer-approved audit-prep pack + auditor-portal-
 * staging package: the per-control evidence-mapping, the gap flags, the
 * drafted control narratives, the auditor question-bank with escalation
 * paths + privileged-info-handling guidance, the GC + compliance-officer
 * + CISO review audit, the emitted audit-prep pack reference, and the
 * auditor-portal-staging metadata.
 */
export const ComplianceAuditPrepOutputSchema = z.object({
  auditId: z.string(),
  frameworkScope: z.enum(['soc2-type-1', 'soc2-type-2-or-iso', 'multi-framework']),
  controlStatusSnapshot: z.object({
    totalControlCount: z.number().int().nonnegative(),
    perFramework: z.array(
      z.object({
        framework: z.enum([
          'soc2-type-1',
          'soc2-type-2',
          'iso-27001',
          'iso-27017',
          'iso-27018',
          'pci-dss',
          'hipaa',
          'fedramp',
          'gdpr',
        ]),
        controlCount: z.number().int().nonnegative(),
        passingControlCount: z.number().int().nonnegative(),
        gapControlCount: z.number().int().nonnegative(),
      })
    ),
  }),
  evidenceMapping: z.array(
    z.object({
      controlRef: z.string(),
      framework: z.enum([
        'soc2-type-1',
        'soc2-type-2',
        'iso-27001',
        'iso-27017',
        'iso-27018',
        'pci-dss',
        'hipaa',
        'fedramp',
        'gdpr',
      ]),
      evidenceItems: z
        .array(
          z.object({
            evidenceId: z.string(),
            evidenceKind: z.enum([
              'policy-doc',
              'system-log',
              'config-export',
              'screenshot',
              'attestation-record',
              'training-log',
              'change-record',
            ]),
            sourceSystemRef: z.string(),
            citationRef: z.string(),
            collectedAt: z.string(),
          })
        )
        .min(1),
      coverageBand: z.enum(['fully-covered', 'partially-covered', 'gap']),
    })
  ),
  controlNarratives: z.array(
    z.object({
      controlRef: z.string(),
      framework: z.enum([
        'soc2-type-1',
        'soc2-type-2',
        'iso-27001',
        'iso-27017',
        'iso-27018',
        'pci-dss',
        'hipaa',
        'fedramp',
        'gdpr',
      ]),
      narrativeMarkdown: z.string(),
      citedEvidenceIds: z.array(z.string()).min(1),
      reviewerRef: z.string(),
    })
  ),
  gapFlags: z
    .array(
      z.object({
        gapId: z.string(),
        controlRef: z.string(),
        framework: z.enum([
          'soc2-type-1',
          'soc2-type-2',
          'iso-27001',
          'iso-27017',
          'iso-27018',
          'pci-dss',
          'hipaa',
          'fedramp',
          'gdpr',
        ]),
        gapKind: z.enum([
          'missing-evidence',
          'stale-evidence',
          'control-not-implemented',
          'control-partially-implemented',
          'inherited-from-prior-audit',
        ]),
        remediationFeasibilityBand: z.enum([
          'feasible-before-fieldwork',
          'feasible-during-fieldwork',
          'requires-management-response',
        ]),
        recommendedRemediation: z.string(),
        ownerTeamRef: z.string(),
      })
    )
    .default([]),
  auditorQuestionBank: z.object({
    anticipatedQuestions: z
      .array(
        z.object({
          questionId: z.string(),
          framework: z.enum([
            'soc2-type-1',
            'soc2-type-2',
            'iso-27001',
            'iso-27017',
            'iso-27018',
            'pci-dss',
            'hipaa',
            'fedramp',
            'gdpr',
          ]),
          controlRef: z.string(),
          questionText: z.string(),
          draftedResponseMarkdown: z.string(),
          citedEvidenceIds: z.array(z.string()).min(1),
        })
      )
      .min(1),
    escalationPaths: z.array(
      z.object({
        pathId: z.string(),
        triggerCondition: z.string(),
        ownerRoleRef: z.string(),
        responseChannel: z.enum(['portal-message', 'email', 'live-meeting', 'written-memo']),
      })
    ),
    privilegedInfoHandlingGuidance: z.object({
      attorneyClientPrivilegedTopics: z.array(z.string()).default([]),
      offLimitsTopics: z.array(z.string()).default([]),
      gcReviewBeforeResponseTopics: z.array(z.string()).default([]),
    }),
  }),
  complianceOfficerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  gcReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    privilegedInfoHandlingNotes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  cisoReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    technicalAccuracyNotes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  auditPrepPack: z.object({
    packRef: z.string(),
    packUrl: z.string(),
    emittedAt: z.string(),
  }),
  auditorPortalStaging: z.object({
    portalKind: z.enum(['drata', 'vanta', 'secureframe', 'tugboat-logic', 'auditor-proprietary']),
    stagingRef: z.string(),
    stagedAt: z.string(),
    stagedItemCount: z.number().int().nonnegative(),
  }),
  generatedAt: z.string(),
})

export type ComplianceAuditPrepInput = z.infer<typeof ComplianceAuditPrepInputSchema>
export type ComplianceAuditPrepOutput = z.infer<typeof ComplianceAuditPrepOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_findingReductionAndCycleTime: RewardSignal = {
  keyResultRef:
    'kr:compliance-audit-prepper:audit-finding-count-reduction-and-cycle-time-improvement',
}
const kr_controlStatusFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:compliance-audit-prepper:control-status-fan-in-coverage',
}
const kr_evidenceMappingCompleteness: RewardSignal = {
  keyResultRef: 'kr:compliance-audit-prepper:evidence-mapping-completeness',
}
const kr_questionBankActionability: RewardSignal = {
  keyResultRef: 'kr:compliance-audit-prepper:question-bank-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:compliance-audit-prepper:emit-latency',
}

// ============================================================================
// Compliance Audit Prepper Service
// ============================================================================

/**
 * Compliance Audit Prepper — external audit scheduled (SOC2 / ISO / PCI /
 * HIPAA / multi-framework) → compliance-officer-approved audit-prep pack +
 * auditor-portal-staging package as a Service.
 *
 * Cascade: fetch-control-status-evidence-trail-prior-audit-findings-and-auditor-questionnaire (Code, fan-in)
 *        → synthesize-evidence-mapping-per-control-flag-gaps-and-draft-control-narratives (Generative)
 *        → prepare-auditor-question-bank-escalation-paths-and-privileged-info-handling (Generative)
 *        → GC-compliance-officer-and-CISO-review (Human, regulatory rationale)
 *        → emit-audit-prep-pack-and-auditor-portal-staging (Code, fan-out).
 */
export const complianceAuditPrepper: ServiceInstance<
  ComplianceAuditPrepInput,
  ComplianceAuditPrepOutput
> = Service.define<ComplianceAuditPrepInput, ComplianceAuditPrepOutput>({
  name: 'Compliance Audit Prepper',
  promise:
    'Every external audit (SOC2 / ISO / PCI / HIPAA / multi-framework) lands as a compliance-officer-approved prep pack — per-control evidence mapping, drafted control narratives, gap flags with feasible remediation, an auditor question-bank with escalation paths + privileged-info-handling guidance, and an auditor-portal-staging package — so the audit-finding count AND the audit cycle time both trend down vs. unprepped baselines.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: ComplianceAuditPrepInputSchema, output: ComplianceAuditPrepOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-control-status-evidence-trail-prior-audit-findings-and-auditor-questionnaire',
        reward: kr_controlStatusFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-evidence-mapping-per-control-flag-gaps-and-draft-control-narratives',
        reward: kr_evidenceMappingCompleteness,
      }),
      Generative({
        name: 'prepare-auditor-question-bank-escalation-paths-and-privileged-info-handling',
        reward: kr_questionBankActionability,
      }),
      Human({
        name: 'GC-compliance-officer-and-CISO-review',
        // `regulatory` rationale: audit prep carries SOX / SOC2 / ISO /
        // HIPAA accountability — the compliance-officer signs the pack
        // (control-coverage + evidence-completeness authority), the GC
        // signs privileged-info-handling, and the CISO signs technical
        // accuracy of security-control narratives. The gate stays human
        // regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-audit-prep-pack-and-auditor-portal-staging',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'control-registry.read',
      'evidence-store.read',
      'prior-audits.read',
      'auditor-questionnaire.read',
      'okta.users',
      'aws-iam.read',
      'github.org-members',
      'training-platform.read',
      'docs.write',
      'evidence-store.write',
      'drata.api',
      'vanta.api',
      'secureframe.api',
    ],
    // Pre-audit cadence: clarification disabled — the cascade synthesises
    // from the control-registry + evidence-trail + prior-audit + auditor-
    // questionnaire signals; the GC + compliance-officer + CISO review is
    // the single human contact point during prep.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Multi-framework audits (SOC2 + ISO + PCI / HIPAA combinations)
        // escalate the evidence-mapping step to a senior compliance-
        // architect supervisor before the compliance-officer review (the
        // officer still signs, but a senior backstops control-coverage
        // and evidence-completeness on the highest-stakes tier).
        when: 'frameworkScope == "multi-framework"',
        action: 'escalate',
      },
      {
        // Every audit-prep routes through the GC + compliance-officer +
        // CISO review before the prep pack + portal staging emit;
        // OutcomeContract enforces the compliance-officer signature, the
        // trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'GC-compliance-officer-and-CISO-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:compliance-audit-prepper-review',
    personas: [
      // Control-coverage reviewer — pedantic check that every in-scope
      // control across every framework in the input has an evidence-
      // mapping entry, that the per-framework totals reconcile, and that
      // gap flags are explicit (no silent omissions).
      Personas.pedantic({
        domain: 'control-coverage',
        rubric: [
          'every-in-scope-control-has-evidence-mapping-entry',
          'per-framework-totals-reconcile',
          'gap-flags-explicit-no-silent-omissions',
          'inherited-findings-from-prior-explicitly-carried-forward',
          'no-control-narrative-without-cited-evidence',
        ],
        name: 'control-coverage-checker',
      }),
      // Evidence-completeness reviewer — pedantic check that every
      // evidence item carries a citation reference, a collection
      // timestamp, and a source-system pointer, and that stale evidence
      // (older than the audit-window threshold) is flagged.
      Personas.pedantic({
        domain: 'evidence-completeness',
        rubric: [
          'every-evidence-item-has-citation-reference',
          'every-evidence-item-has-collection-timestamp',
          'every-evidence-item-has-source-system-pointer',
          'stale-evidence-flagged-against-audit-window',
          'no-control-fully-covered-claim-without-evidence-set',
        ],
        name: 'evidence-completeness-checker',
      }),
      // Gap-remediation-feasibility reviewer — adversarially probes
      // whether every gap flag carries a feasible remediation
      // (feasible-before-fieldwork / feasible-during-fieldwork /
      // requires-management-response), a concrete recommended
      // remediation, and a named owner team.
      Personas.skeptic({
        domain: 'gap-remediation-feasibility',
        focus: [
          'every-gap-cites-feasibility-band',
          'every-gap-has-concrete-recommended-remediation',
          'every-gap-has-named-owner-team',
          'requires-management-response-gaps-justified',
          'no-feasible-claim-without-effort-rationale',
        ],
        name: 'gap-remediation-feasibility-reviewer',
      }),
      // Regulatory-compliance reviewer — SOX-tier compliance check on
      // the audit-prep pack (named compliance-officer attester per
      // control narrative, signed-off review surface, evidence-grade
      // emit timestamps, attorney-client privilege boundary).
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-compliance-reviewer',
      }),
      // Factual-accuracy reviewer — citation-required fact check on the
      // control narratives + question-bank drafted responses (every load-
      // bearing claim cites first-party or industry-standard sources;
      // no unsupported claims slip through).
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['first-party', 'industry-standard'],
        name: 'factual-accuracy-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:compliance-audit-prepper:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-compliance-officer',
    seller: 'svc:compliance-audit-prepper',
    serviceRef: 'svc:compliance-audit-prepper',
    // Compliance-officer signs every audit-prep pack before the auditor-
    // portal-staging emit — control-coverage + evidence-completeness
    // sign-off authority cannot be delegated (regulatory accountability).
    predicate: AND(
      SchemaMatch(ComplianceAuditPrepOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['compliance-officer'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 4999900n, currency: 'USD' },
    // 30-day SLA — pre-audit cadence + per-control evidence-mapping
    // depth + tri-reviewer (GC + compliance-officer + CISO) review depth
    // means the prep pack ships within a month of the trigger.
    timeoutDays: 30,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'soc2-type-1',
        amount: 999900n,
        currency: 'USD',
        description:
          'SOC2 Type 1 framework. Single-framework, point-in-time evidence. Prep pack delivered before fieldwork. $9,999.',
      },
      {
        id: 'soc2-type-2-or-iso',
        amount: 4999900n,
        currency: 'USD',
        description:
          'SOC2 Type 2 or ISO-27001/27017/27018 framework. Single-framework, observation-window evidence. Prep pack delivered before fieldwork. $49,999.',
      },
      {
        id: 'multi-framework',
        amount: 19999900n,
        currency: 'USD',
        description:
          'Multi-framework audit (SOC2 + ISO + PCI / HIPAA combinations). Cross-framework evidence reconciliation. Prep pack + portal staging delivered before fieldwork. $199,999.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 35000n, perApiCall: 9n },
  reward: kr_findingReductionAndCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/security-leads/compliance-audit-prepper',
    icpContextProblemRef: 'icp:compliance-audit-prepper:v1',
    foundingHypothesisRef: 'fh:compliance-audit-prepper:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
