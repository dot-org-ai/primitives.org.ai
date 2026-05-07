/**
 * Vendor Onboarding Runbook Service — net-new vendor due-diligence + onboarding
 * for the procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`purchase-order-router`,
 * `inventory-reorder-planner`):
 *   - `quality-review` archetype — the artefact is a procurement-lead-and-
 *     security-reviewer-signed onboarding packet (financial-stability +
 *     security-posture + reference-check + compliance-fit) plus a created
 *     vendor record, not a routing decision or a reorder plan;
 *   - 5-step cascade with one supervised Agentic vendor-questionnaire +
 *     reference-outreach step (the only Agentic step in the supply-chain
 *     catalog), bookended by Code fan-in (vendor profile + spend projection +
 *     integration needs), Generative due-diligence checklist synthesis, a
 *     procurement-lead + security-reviewer Human sign-off gate, and Code
 *     fan-out (onboarding packet + vendor record);
 *   - `Pricing.outcome` 3 tiers keyed on declared vendor risk — low-risk /
 *     medium-risk / high-risk ($499 / $1,999 / $5,999) — a low-risk SaaS
 *     vendor onboarding is worth less than a high-risk vendor with PII /
 *     financial-data exposure;
 *   - declarative HITL = mandatory procurement-lead + security-reviewer sign-
 *     off (both use `regulatory` rationale because SOX vendor-management
 *     controls + security-review attestation are statutorily mandated to
 *     carry a human signer), plus OutcomeContract requires procurement-lead
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(due-diligence-
 *     completeness + risk-flag-coverage + sox-regulatoryCompliance +
 *     securityThreat) + HumanSign(procurement-lead))`;
 *   - EvaluatorPanel includes `Personas.regulatoryCompliance({ regulator:
 *     'sox' })` and `Personas.securityThreat({ surfaces:
 *     ['data-exfiltration', 'pii-leakage'] })` because vendor onboarding is
 *     the load-bearing SOX vendor-management control and the security
 *     surface where third-party data exposure originates.
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate
 * AND).
 *
 * Service-level reward = `vendor-onboarding-cycle-time-reduction` — the
 * compound metric every procurement org optimises against (the runbook is
 * worth running iff time-from-vendor-add-request to onboarded-vendor drops
 * vs. the pre-Service baseline, holding due-diligence quality flat or
 * improving).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a vendor-add request from any team. Tight: 8 fields cover the
 * request identity, the requesting team, the declared risk band (so the
 * outcome-tier pricing is resolvable at intake), the vendor profile slice,
 * the spend projection, the integration footprint, the assigned procurement
 * lead + security reviewer, and the trigger stage gating intake.
 */
export const VendorOnboardingRequestInputSchema = z.object({
  requestId: z.string(),
  requestingTeam: z.enum([
    'engineering',
    'finance',
    'marketing',
    'product',
    'sales',
    'operations',
    'people',
    'legal',
    'executive',
  ]),
  declaredRiskBand: z.enum(['low-risk', 'medium-risk', 'high-risk']),
  vendorProfile: z.object({
    legalName: z.string(),
    dba: z.string().optional(),
    domain: z.string(),
    countryOfIncorporation: z.string(),
    vendorCategory: z.enum([
      'saas',
      'professional-services',
      'hardware',
      'logistics',
      'manufacturing',
      'data-provider',
      'marketing-agency',
      'staffing',
      'other',
    ]),
    websiteRef: z.string().optional(),
  }),
  spendProjection: z.object({
    estimatedAnnualSpendUsd: z.number().nonnegative(),
    contractTermMonths: z.number().int().positive(),
    autoRenewing: z.boolean(),
  }),
  integrationNeeds: z.object({
    handlesPii: z.boolean(),
    handlesPaymentData: z.boolean(),
    handlesProductionData: z.boolean(),
    requiresNetworkAccess: z.boolean(),
    requiresProductionWriteAccess: z.boolean(),
    integrationSurfaces: z.array(
      z.enum(['api', 'sso', 'webhook', 'sftp', 'database', 'physical', 'none'])
    ),
  }),
  reviewers: z.object({
    procurementLeadRef: z.string(),
    securityReviewerRef: z.string(),
  }),
  triggerStage: z.literal('vendor-add-requested'),
})

/**
 * Output — a procurement-lead-and-security-reviewer-signed onboarding packet
 * + created vendor record: the fetched vendor profile snapshot + spend
 * projection + integration needs, the due-diligence checklist (financial
 * stability + security posture + reference check + compliance fit), the
 * questionnaire + reference-outreach findings, the procurement-lead +
 * security-reviewer sign-off audit, and pointers to the emitted onboarding
 * packet + vendor record.
 */
export const VendorOnboardingPacketOutputSchema = z.object({
  requestId: z.string(),
  vendorContextSnapshot: z.object({
    profile: z.object({
      legalName: z.string(),
      dba: z.string().optional(),
      domain: z.string(),
      countryOfIncorporation: z.string(),
      vendorCategory: z.string(),
    }),
    spendProjection: z.object({
      estimatedAnnualSpendUsd: z.number().nonnegative(),
      contractTermMonths: z.number().int().positive(),
      autoRenewing: z.boolean(),
    }),
    integrationFootprint: z.object({
      handlesPii: z.boolean(),
      handlesPaymentData: z.boolean(),
      handlesProductionData: z.boolean(),
      requiresNetworkAccess: z.boolean(),
      requiresProductionWriteAccess: z.boolean(),
      integrationSurfaces: z.array(z.string()),
    }),
  }),
  dueDiligenceChecklist: z.object({
    financialStability: z.object({
      summaryMarkdown: z.string(),
      sourcesCited: z.array(z.string()).min(1),
      flags: z.array(
        z.object({
          flagId: z.string(),
          severity: z.enum(['info', 'warning', 'critical']),
          observation: z.string(),
        })
      ),
    }),
    securityPosture: z.object({
      summaryMarkdown: z.string(),
      attestationsObserved: z.array(
        z.enum(['soc2-type-1', 'soc2-type-2', 'iso-27001', 'pci-dss', 'hitrust', 'fedramp', 'none'])
      ),
      flags: z.array(
        z.object({
          flagId: z.string(),
          severity: z.enum(['info', 'warning', 'critical']),
          observation: z.string(),
        })
      ),
    }),
    referenceCheck: z.object({
      summaryMarkdown: z.string(),
      referencesContacted: z.number().int().nonnegative(),
      referencesResponded: z.number().int().nonnegative(),
      flags: z.array(
        z.object({
          flagId: z.string(),
          severity: z.enum(['info', 'warning', 'critical']),
          observation: z.string(),
        })
      ),
    }),
    complianceFit: z.object({
      summaryMarkdown: z.string(),
      frameworksEvaluated: z.array(
        z.enum(['sox', 'gdpr', 'ccpa', 'hipaa', 'pci-dss', 'iso-27001', 'export-controls'])
      ),
      flags: z.array(
        z.object({
          flagId: z.string(),
          severity: z.enum(['info', 'warning', 'critical']),
          observation: z.string(),
        })
      ),
    }),
  }),
  vendorQuestionnaireFindings: z.object({
    questionnaireRef: z.string(),
    questionsSent: z.number().int().nonnegative(),
    answersReceived: z.number().int().nonnegative(),
    answerSummaryMarkdown: z.string(),
    outstandingItems: z.array(z.string()),
  }),
  signOffs: z.object({
    procurementLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
    securityReviewer: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    onboardingPacketUrl: z.string(),
    vendorRecordRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type VendorOnboardingRequestInput = z.infer<typeof VendorOnboardingRequestInputSchema>
export type VendorOnboardingPacketOutput = z.infer<typeof VendorOnboardingPacketOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_onboardingCycleTime: RewardSignal = {
  keyResultRef: 'kr:vendor-onboarding-runbook:vendor-onboarding-cycle-time-reduction',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:vendor-onboarding-runbook:intake-coverage',
}
const kr_dueDiligenceCompleteness: RewardSignal = {
  keyResultRef: 'kr:vendor-onboarding-runbook:due-diligence-completeness',
}
const kr_questionnaireCoverage: RewardSignal = {
  keyResultRef: 'kr:vendor-onboarding-runbook:questionnaire-coverage',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:vendor-onboarding-runbook:emit-latency',
}

// ============================================================================
// Vendor Onboarding Runbook Service
// ============================================================================

/**
 * Vendor Onboarding Runbook — vendor-add request → procurement-lead-and-
 * security-reviewer-signed onboarding packet + created vendor record as a
 * Service.
 *
 * Cascade: fetch-vendor-profile-and-spend-projection-and-integration-needs (Code, fan-in)
 *        → due-diligence-checklist-financial-stability-security-posture-reference-check-and-compliance-fit (Generative)
 *        → supervised-vendor-questionnaire-and-reference-outreach (Agentic, supervised)
 *        → procurement-lead-and-security-reviewer-sign-off (Human, regulatory rationale)
 *        → emit-onboarding-packet-and-create-vendor-record (Code, fan-out).
 */
export const vendorOnboardingRunbook: ServiceInstance<
  VendorOnboardingRequestInput,
  VendorOnboardingPacketOutput
> = Service.define<VendorOnboardingRequestInput, VendorOnboardingPacketOutput>({
  name: 'Vendor Onboarding Runbook',
  promise:
    'Every vendor-add request lands a procurement-lead-and-security-reviewer-signed onboarding packet + created vendor record within days — financial-stability, security-posture, reference-check, and compliance-fit due diligence — so the procurement queue is bounded by sign-off, not by hand-running a runbook.',
  audience: 'business',
  archetype: 'quality-review',
  schema: {
    input: VendorOnboardingRequestInputSchema,
    output: VendorOnboardingPacketOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-vendor-profile-and-spend-projection-and-integration-needs',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'due-diligence-checklist-financial-stability-security-posture-reference-check-and-compliance-fit',
        reward: kr_dueDiligenceCompleteness,
      }),
      Agentic({
        name: 'supervised-vendor-questionnaire-and-reference-outreach',
        reward: kr_questionnaireCoverage,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Human({
        name: 'procurement-lead-and-security-reviewer-sign-off',
        // `regulatory` rationale: SOX vendor-management controls and the
        // company security-review attestation are statutorily mandated to
        // carry a human signer. The procurement-lead owns the financial /
        // contractual envelope; the security-reviewer owns the integration-
        // surface envelope. Neither delegates.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-onboarding-packet-and-create-vendor-record',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'vendor-directory.read',
      'vendor-directory.write',
      'spend-system.read',
      'integration-registry.read',
      'security-registry.read',
      'attestation-registry.read',
      'reference-channel.write',
      'questionnaire-system.write',
      'docs.write',
    ],
    // Vendor onboarding: clarification disabled — the cascade synthesises
    // from the vendor profile + spend projection + integration footprint;
    // the procurement-lead + security-reviewer sign-off step is the single
    // human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-risk vendor onboarding escalates the due-diligence step to a
        // senior procurement supervisor before the routine procurement-lead
        // + security-reviewer sign-off (the lead + reviewer still sign, but
        // the supervisor backstops the synthesis on the highest-stakes
        // tier — vendors handling PII / payment data / production data).
        when: 'declaredRiskBand == "high-risk"',
        action: 'escalate',
      },
      {
        // Every request routes through procurement-lead + security-
        // reviewer sign-off before the onboarding packet emits and the
        // vendor record is created; OutcomeContract enforces the
        // procurement-lead signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'procurement-lead-and-security-reviewer-sign-off',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:vendor-onboarding-runbook-review',
    personas: [
      // Due-diligence-completeness reviewer — pedantic check that every
      // checklist axis (financial-stability, security-posture, reference-
      // check, compliance-fit) carries a summary, cited sources, and a
      // flags array (even if empty). The risk this guards against is
      // "shipped without one of the four axes evaluated".
      Personas.pedantic({
        domain: 'due-diligence-completeness',
        rubric: [
          'financial-stability-summary-present',
          'security-posture-attestations-listed',
          'reference-check-counts-present',
          'compliance-fit-frameworks-listed',
          'every-axis-has-flags-array',
          'every-summary-cites-sources',
        ],
        name: 'due-diligence-completeness-checker',
      }),
      // Risk-flag-coverage reviewer — adversarially probes whether the
      // flags arrays cover the load-bearing risk surfaces given the vendor
      // profile (e.g. high-spend long-term contracts must flag financial
      // stability; PII-handling vendors must flag security posture; auto-
      // renewing contracts must flag exit-clause exposure) vs. silent
      // omissions.
      Personas.skeptic({
        domain: 'risk-flag-coverage',
        focus: [
          'high-spend-flags-financial-stability',
          'pii-handling-flags-security-posture',
          'auto-renew-flags-exit-clause',
          'production-data-access-flags-blast-radius',
          'cross-border-flags-jurisdictional-risk',
          'no-hand-waves',
        ],
        name: 'risk-flag-coverage-reviewer',
      }),
      // SOX regulatory-compliance reviewer — vendor-management is a
      // load-bearing SOX control. Every vendor onboarding packet must
      // survive a SOX-rule audit before the procurement-lead signs.
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-regulatoryCompliance-reviewer',
      }),
      // Security-threat reviewer — third-party vendor onboarding is the
      // origination point for data-exfiltration and pii-leakage risk.
      // Adversarial security review is mandatory before the security-
      // reviewer signs.
      Personas.securityThreat({
        surfaces: ['data-exfiltration', 'pii-leakage'],
        name: 'securityThreat-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:vendor-onboarding-runbook:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-procurement-lead',
    seller: 'svc:vendor-onboarding-runbook',
    serviceRef: 'svc:vendor-onboarding-runbook',
    // Procurement-lead signs every vendor onboarding packet before the
    // vendor record is created — SOX vendor-management authority cannot be
    // delegated.
    predicate: AND(
      SchemaMatch(VendorOnboardingPacketOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['procurement-lead'] })
    ),
    // Mid-tier amount; the per-tier outcome amounts are in `pricing.tiers`.
    amount: { amount: 199900n, currency: 'USD' },
    // 5-day SLA — vendor onboarding lands inside one procurement workweek
    // so the requesting team isn't blocked on net-new tooling.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'low-risk',
        amount: 49900n,
        currency: 'USD',
        description:
          'Low-risk vendor — no PII / payment / production-data exposure, ≤ $50k/yr spend, single integration surface. $499.',
      },
      {
        id: 'medium-risk',
        amount: 199900n,
        currency: 'USD',
        description:
          'Medium-risk vendor — bounded data exposure, $50k–$500k/yr spend, multi-surface integration. $1,999.',
      },
      {
        id: 'high-risk',
        amount: 599900n,
        currency: 'USD',
        description:
          'High-risk vendor — PII / payment / production-data exposure, $500k+/yr spend, network or production-write access, cross-border. $5,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8000n, perApiCall: 16n },
  reward: kr_onboardingCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/procurement/vendor-onboarding-runbook',
    icpContextProblemRef: 'icp:vendor-onboarding-runbook:v1',
    foundingHypothesisRef: 'fh:vendor-onboarding-runbook:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
