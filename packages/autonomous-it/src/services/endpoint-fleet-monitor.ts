/**
 * Endpoint Fleet Monitor Service — endpoint compliance + drift detection +
 * remediation Service for the IT-ops catalog.
 *
 * Distinguishing shape vs. siblings (`helpdesk-ticket-resolver`,
 * `identity-lifecycle-orchestrator`):
 *   - `forecast-narrative` archetype — the artefact is an IT-lead-and-
 *     security-lead-signed weekly drift-and-remediation narrative + a
 *     remediation batch keyed on the fleet snapshot, not a per-ticket
 *     resolution and not a joiner/mover/leaver runbook;
 *   - 5-step cascade: Code fan-in (MDM snapshot + EDR status + patch
 *     level + config-baseline diff) → Generative (drift detection: out-of-
 *     policy configs + missing patches + compromised endpoints) → Generative
 *     (draft remediation plan: auto-remediable / user-assisted / quarantine)
 *     → Human (IT-lead + security-lead review on quarantine or mass-actions)
 *     → Code (emit remediation batch + endpoint actions + audit log);
 *   - `Pricing.subscription` — a recurring per-IT-team subscription
 *     ($999/mo) plus metered overage at $199 per `endpoint-quarantine-
 *     recommended` event (quarantines fan out ad-hoc above the regular
 *     weekly cadence and carry the highest blast-radius);
 *   - declarative HITL = mandatory IT-lead + security-lead review on
 *     quarantine OR mass-actions (the IT-lead owns the fleet deployment
 *     envelope; the security-lead owns the compromise-suspected blast-
 *     radius envelope — `regulatory` rationale on both, since SOX / SOC2
 *     evidence trails name a human owner on every endpoint quarantine and
 *     mass-action), plus OutcomeContract requires IT-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(drift-detection-
 *     precision + remediation-actionability + safety-of-mass-actions) +
 *     HumanSign(IT-lead))`.
 *
 * Per design v3 §3 (Catalog HOW it-ops) + §6 (binding triggers, conditional
 * HumanSign with multiple roles) + §7 (subscription pricing factory with
 * metered overage) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `endpoint-compliance-rate-improvement` — the
 * compound metric every IT-ops org optimises against (the monitor is worth
 * running iff the share of in-policy / fully-patched endpoints climbs vs.
 * the pre-Service baseline at parity fleet-size + parity OS-mix).
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
 * Input — a weekly cron firing at fleet-monitor-due (or an out-of-band
 * compliance-policy update). Tight: 8 fields cover the IT-team identity,
 * the trigger kind, the review window, the fleet-inventory snapshot
 * pointer (so the cascade fans-in to the right endpoint slice), the
 * MDM + EDR sources, the compliance-policy reference (so drift detection
 * compares against the right baseline), the assigned IT-lead routing
 * target, and the assigned security-lead routing target (both signatures
 * are required on quarantine or mass-actions).
 */
export const EndpointFleetMonitorInputSchema = z.object({
  itTeamRef: z.string(),
  triggerKind: z.enum(['weekly-cron', 'compliance-policy-update', 'ad-hoc-fleet-audit']),
  reviewWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  fleetInventoryRef: z.string(),
  sources: z.object({
    mdm: z.enum(['jamf', 'intune', 'kandji', 'mosyle', 'workspace-one', 'fleet-osquery']),
    edr: z.enum(['crowdstrike', 'sentinelone', 'defender-for-endpoint', 'sophos', 'huntress']),
    patchSource: z.enum(['mdm-native', 'sccm', 'wsus', 'tanium', 'automox']).default('mdm-native'),
    osPlatformsInScope: z
      .array(z.enum(['macos', 'windows', 'linux', 'chromeos', 'ios', 'android']))
      .min(1),
  }),
  compliancePolicyRef: z.string(),
  assignedItLeadRef: z.string(),
  assignedSecurityLeadRef: z.string(),
})

/**
 * Output — an IT-lead-and-security-lead-signed weekly drift-and-remediation
 * narrative + remediation batch: the fleet-snapshot fan-in indexed by
 * endpoint, the detected drift findings (out-of-policy configs + missing
 * patches + compromised endpoints) + proposed thresholds, the per-finding
 * remediation plan (auto-remediable / user-assisted / quarantine), the
 * joint-review audit, and the emitted remediation batch + endpoint-actions
 * log + audit-log record.
 */
export const EndpointFleetMonitorOutputSchema = z.object({
  itTeamRef: z.string(),
  reviewWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  fleetSnapshot: z.object({
    endpointCount: z.number().int().nonnegative(),
    osMix: z.array(
      z.object({
        osPlatform: z.enum(['macos', 'windows', 'linux', 'chromeos', 'ios', 'android']),
        endpointCount: z.number().int().nonnegative(),
      })
    ),
    mdmEnrolledCount: z.number().int().nonnegative(),
    edrCoveredCount: z.number().int().nonnegative(),
    patchLevelHistogram: z.array(
      z.object({
        bucket: z.enum(['fully-patched', '1-7-days-behind', '8-30-days-behind', '30+-days-behind']),
        endpointCount: z.number().int().nonnegative(),
      })
    ),
    observedAt: z.string(),
  }),
  driftFindings: z.object({
    outOfPolicyConfigs: z
      .array(
        z.object({
          findingId: z.string(),
          endpointRef: z.string(),
          policyControl: z.string(),
          observedValue: z.string(),
          expectedValue: z.string(),
          severityBand: z.enum(['low', 'medium', 'high', 'critical']),
          rationale: z.string(),
        })
      )
      .default([]),
    missingPatches: z
      .array(
        z.object({
          findingId: z.string(),
          endpointRef: z.string(),
          patchRef: z.string(),
          cveRefs: z.array(z.string()).default([]),
          daysBehind: z.number().int().nonnegative(),
          severityBand: z.enum(['low', 'medium', 'high', 'critical']),
          rationale: z.string(),
        })
      )
      .default([]),
    compromisedEndpoints: z
      .array(
        z.object({
          findingId: z.string(),
          endpointRef: z.string(),
          edrSignal: z.string(),
          confidenceBand: z.enum(['suspected', 'corroborated', 'high-confidence']),
          firstSeenAt: z.string(),
          rationale: z.string(),
        })
      )
      .default([]),
  }),
  remediationPlan: z.object({
    summary: z.string(),
    items: z
      .array(
        z.object({
          remediationItemId: z.string(),
          findingId: z.string(),
          targetEndpointRefs: z.array(z.string()).min(1),
          remediationKind: z.enum([
            'auto-remediable',
            'user-assisted',
            'quarantine',
            'reimage',
            'wipe-and-reissue',
          ]),
          actionPlan: z.array(z.string()).min(1),
          blastRadius: z.enum(['single-endpoint', 'fleet-segment', 'fleet-wide']),
          rollbackPlan: z.string(),
          residualRiskNote: z.string(),
        })
      )
      .min(1),
    massActionFlag: z.boolean(),
    quarantineCount: z.number().int().nonnegative(),
  }),
  jointReview: z.object({
    itLeadReview: z.object({
      reviewerRef: z.string(),
      decision: z.enum([
        'approve-all',
        'approve-with-edits',
        'request-revision',
        'reject',
        'not-required',
      ]),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
    securityLeadReview: z.object({
      reviewerRef: z.string(),
      decision: z.enum([
        'approve-quarantine-and-mass-actions',
        'approve-with-edits',
        'request-revision',
        'reject',
        'not-required',
      ]),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
  }),
  remediationBatch: z.object({
    batchRef: z.string(),
    appliedActions: z.array(
      z.object({
        actionId: z.string(),
        remediationItemId: z.string(),
        endpointRef: z.string(),
        appliedAt: z.string(),
        outcome: z.enum(['succeeded', 'partial', 'failed', 'skipped', 'queued-for-user']),
        outcomeNote: z.string().optional(),
      })
    ),
    auditLogRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type EndpointFleetMonitorInput = z.infer<typeof EndpointFleetMonitorInputSchema>
export type EndpointFleetMonitorOutput = z.infer<typeof EndpointFleetMonitorOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_complianceRate: RewardSignal = {
  keyResultRef: 'kr:endpoint-fleet-monitor:endpoint-compliance-rate-improvement',
}
const kr_fleetCoverage: RewardSignal = {
  keyResultRef: 'kr:endpoint-fleet-monitor:fleet-coverage',
}
const kr_driftDetectionPrecision: RewardSignal = {
  keyResultRef: 'kr:endpoint-fleet-monitor:drift-detection-precision',
}
const kr_remediationActionability: RewardSignal = {
  keyResultRef: 'kr:endpoint-fleet-monitor:remediation-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:endpoint-fleet-monitor:emit-latency',
}

// ============================================================================
// Endpoint Fleet Monitor Service
// ============================================================================

/**
 * Endpoint Fleet Monitor — weekly cron + endpoint-fleet inventory + compliance-
 * policy → IT-lead-and-security-lead-signed drift-and-remediation narrative +
 * remediation batch as a Service.
 *
 * Cascade: fetch-MDM-snapshot-EDR-status-patch-level-and-config-baseline-diff (Code, fan-in)
 *        → detect-drift-out-of-policy-configs-missing-patches-and-compromised-endpoints (Generative)
 *        → draft-remediation-plan-auto-remediable-user-assisted-or-quarantine (Generative)
 *        → IT-lead-and-security-lead-review-on-quarantine-or-mass-actions (Human, regulatory rationale)
 *        → emit-remediation-batch-endpoint-actions-and-audit-log (Code, fan-out).
 */
export const endpointFleetMonitor: ServiceInstance<
  EndpointFleetMonitorInput,
  EndpointFleetMonitorOutput
> = Service.define<EndpointFleetMonitorInput, EndpointFleetMonitorOutput>({
  name: 'Endpoint Fleet Monitor',
  promise:
    'Every week, every managed endpoint gets a drift-detection pass against the compliance-policy baseline (out-of-policy configs + missing patches + compromised-endpoint signals) with a remediation plan that auto-remediates the safe segment, user-assists the user-touch segment, and routes quarantines + mass-actions through joint IT-lead + security-lead review — so endpoint-compliance-rate climbs quarter-over-quarter without surprise mass-action incidents.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: EndpointFleetMonitorInputSchema,
    output: EndpointFleetMonitorOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-MDM-snapshot-EDR-status-patch-level-and-config-baseline-diff',
        reward: kr_fleetCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'detect-drift-out-of-policy-configs-missing-patches-and-compromised-endpoints',
        reward: kr_driftDetectionPrecision,
      }),
      Generative({
        name: 'draft-remediation-plan-auto-remediable-user-assisted-or-quarantine',
        reward: kr_remediationActionability,
      }),
      Human({
        name: 'IT-lead-and-security-lead-review-on-quarantine-or-mass-actions',
        // `regulatory` rationale: SOX / SOC2 / ISO-27001 evidence trails
        // require a named human owner on every endpoint quarantine and
        // every fleet-wide mass-action. The IT-lead owns the fleet
        // deployment envelope; the security-lead owns the compromise-
        // suspected blast-radius envelope. Both gates stay human
        // regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-remediation-batch-endpoint-actions-and-audit-log',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'jamf.read',
      'jamf.actions',
      'intune.read',
      'intune.actions',
      'kandji.read',
      'kandji.actions',
      'crowdstrike.read',
      'crowdstrike.actions',
      'sentinelone.read',
      'defender-for-endpoint.read',
      'osquery.fleet',
      'patch-source.read',
      'patch-source.deploy',
      'audit-log.write',
      'comms.notify',
    ],
    // Weekly cadence: clarification disabled — the cascade synthesises
    // from MDM + EDR + patch + compliance-policy signals; the joint
    // IT-lead + security-lead review step is the only human contact
    // surface, and it only fires conditionally (quarantine or mass-
    // actions present in the plan).
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Compromised-endpoint findings (any confidence band) and any
        // mass-action remediation escalate the synthesis to a senior
        // EDR specialist before the joint review (the IT-lead +
        // security-lead still sign, but a senior backstops detection
        // quality on the highest-stakes tier).
        when: 'driftFindings.compromisedEndpoints.length > 0 || remediationPlan.massActionFlag == true',
        action: 'escalate',
      },
      {
        // Quarantine and mass-action remediation plans route through the
        // joint IT-lead + security-lead review before the remediation
        // batch applies; OutcomeContract enforces the IT-lead signature
        // on the rolled-up plan, the trigger primes the queue.
        when: 'remediationPlan.quarantineCount > 0 || remediationPlan.massActionFlag == true',
        action: 'route-to',
        target: 'IT-lead-and-security-lead-review-on-quarantine-or-mass-actions',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:endpoint-fleet-monitor-review',
    personas: [
      // Drift-detection-precision reviewer — pedantic check that every
      // drift finding cites the specific signal (observed-vs-expected
      // config value, days-behind on patches, EDR signal ref) that
      // supports it; guards against scanner-noise hand-waving.
      Personas.pedantic({
        domain: 'drift-detection-precision',
        rubric: [
          'every-out-of-policy-config-cites-observed-and-expected-values',
          'every-missing-patch-cites-days-behind-and-cves-where-applicable',
          'every-compromised-endpoint-cites-edr-signal-and-confidence-band',
          'severity-bands-track-policy-and-cvss',
          'no-finding-without-cited-signal',
        ],
        name: 'drift-detection-precision-checker',
      }),
      // Remediation-actionability reviewer — adversarially probes
      // whether each remediation item cites concrete target endpoints,
      // realistic action plan, blast-radius classification, rollback
      // plan, and option-specific residual-risk note. Guards against
      // "remediate-when-convenient" hand-waving on the user-assisted
      // tier.
      Personas.skeptic({
        domain: 'remediation-actionability',
        focus: [
          'every-item-cites-target-endpoint-refs',
          'every-item-cites-blast-radius-classification',
          'every-item-cites-rollback-plan',
          'every-item-has-specific-residual-risk-note',
          'auto-remediable-tier-actually-safe-to-auto-apply',
        ],
        name: 'remediation-actionability-reviewer',
      }),
      // Regression-risk reviewer — change-impact + regression-risk
      // review on the remediation plan. Config-drift remediation is a
      // `config` change-type with non-trivial blast-radius (single-
      // endpoint to fleet-wide); blast-radius and rollback-plan must
      // both be present on every item.
      Personas.regressionRisk({
        changeType: 'config',
        blastRadiusRequired: true,
        rollbackPlanRequired: true,
        name: 'regression-risk-reviewer',
      }),
      // Regulatory-compliance reviewer — SOX-tier compliance check on
      // the remediation batch + audit-log (named owner on every
      // quarantine, timestamped applied-action record, joint-review
      // signed-off pack).
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-compliance-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:endpoint-fleet-monitor:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-it-lead',
    seller: 'svc:endpoint-fleet-monitor',
    serviceRef: 'svc:endpoint-fleet-monitor',
    // IT-lead signs every rolled-up remediation pack — the IT-lead owns
    // the fleet deployment envelope and the SOX-evidence-trail
    // accountability. Quarantine + mass-action items additionally route
    // through the security-lead review at the binding-trigger layer.
    predicate: AND(
      SchemaMatch(EndpointFleetMonitorOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['it-lead'] })
    ),
    amount: { amount: 99900n, currency: 'USD' },
    // 7-day SLA — weekly cadence + joint-review depth means the
    // remediation batch ships within a week of the trigger.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'endpoint-fleet-monitor-monthly',
      amount: 99900n,
      currency: 'USD',
      interval: 'month',
    },
    // Metered overage — endpoint-quarantine recommendations above the
    // implicit weekly-cron baseline charge $199 each. The metering
    // runtime resolves `endpoint-quarantine-recommended` to the
    // rolled-up count beyond the included baseline and lines them on
    // the monthly invoice. Quarantines fan out ad-hoc and carry the
    // highest blast-radius — the metered line aligns price to incident
    // severity.
    metered: [
      {
        event: 'endpoint-quarantine-recommended',
        amount: 19900n,
        description: 'Endpoint quarantine recommended beyond the weekly-cron baseline.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 8n },
  reward: kr_complianceRate,

  lineage: {
    cellRef: 'business.org.ai/cells/it-leads/endpoint-fleet-monitor',
    icpContextProblemRef: 'icp:endpoint-fleet-monitor:v1',
    foundingHypothesisRef: 'fh:endpoint-fleet-monitor:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
