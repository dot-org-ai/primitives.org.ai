/**
 * Access Review Coordinator Service — quarterly user-access-review (UAR)
 * Service for the security catalog.
 *
 * Distinguishing shape vs. siblings (`vuln-triager`,
 * `phishing-simulation-orchestrator`):
 *   - `quality-review` archetype — the artefact is a security-lead-approved
 *     attestation evidence pack + revoked-grants fan-out from a per-manager
 *     attestation loop, not an ad-hoc vuln triage record or a phishing
 *     campaign;
 *   - 5-step cascade: Code fan-in (access grants + LDAP snapshot + role
 *     membership) → Generative (anomaly detection: orphaned grants +
 *     privilege creep + dormant accounts) → Generative (revocation
 *     recommendations + manager-attestation questions) → Human (per-manager
 *     attestation loop) → Code (emit attestation evidence + revoke confirmed
 *     grants);
 *   - `Pricing.subscription` — a recurring security-team subscription
 *     ($1,499/mo) plus metered overage at $49 per manager-attestation loop
 *     completed (the loop count varies with org headcount + number of
 *     systems in-scope);
 *   - declarative HITL = mandatory per-manager attestation Human Function
 *     (each grant-owning manager owns the attestation decision on their
 *     reports' grants), plus OutcomeContract requires security-lead
 *     signature on the rolled-up evidence pack;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(anomaly-precision +
 *     attestation-coverage) + HumanSign(security-lead))`.
 *
 * Per design v3 §3 (Catalog HOW security) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory with metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `orphaned-grant-rate-reduction` — the compound
 * metric every security-ops org optimises against (the coordinator is worth
 * running iff the orphaned-grant rate at quarter-end drops vs. the pre-
 * Service baseline at parity headcount + parity in-scope-system count).
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
 * Input — a quarterly cron firing at UAR-due. Tight: 7 fields cover the
 * security-team identity, the review window, the in-scope sensitive-systems
 * (so the cascade fans-in to the right grant slice), the connected identity
 * provider + access-grant sources, the reviewing-managers cohort the
 * attestation loop fans-out to, the assigned security-lead routing target,
 * and the quarter identifier the evidence-pack indexes against.
 */
export const AccessReviewInputSchema = z.object({
  securityTeamRef: z.string(),
  reviewWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  inScopeSensitiveSystems: z
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
        ]),
        sensitivityTier: z.enum(['restricted', 'confidential', 'internal']),
      })
    )
    .min(1),
  sources: z.object({
    identityProvider: z.enum(['okta', 'azure-ad', 'google-workspace', 'auth0', 'onelogin']),
    accessGrantSources: z
      .array(z.enum(['aws-iam', 'gcp-iam', 'snowflake', 'databricks', 'github', 'salesforce']))
      .min(1),
    hrisSource: z.enum(['workday', 'bamboohr', 'rippling', 'gusto', 'sap-successfactors']),
  }),
  reviewingManagersCohort: z.array(z.string()).min(1),
  assignedSecurityLeadRef: z.string(),
  quarterId: z.string(),
})

/**
 * Output — a security-lead-approved attestation evidence pack + revoked-
 * grants fan-out: the access-grant snapshot indexed by user + system, the
 * anomaly-detection findings (orphaned grants + privilege creep + dormant
 * accounts), the revocation-recommendations list, the per-manager
 * attestation roster + outcomes, the security-lead review audit, the
 * emitted attestation-evidence pack, and the revoked-grants log.
 */
export const AccessReviewOutputSchema = z.object({
  securityTeamRef: z.string(),
  reviewWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  quarterId: z.string(),
  accessGrantSnapshot: z.array(
    z.object({
      userRef: z.string(),
      managerRef: z.string(),
      systemRef: z.string(),
      grantedRoles: z.array(z.string()).min(1),
      grantedAt: z.string(),
      lastUsedAt: z.string().optional(),
    })
  ),
  anomalyFindings: z.object({
    orphanedGrants: z
      .array(
        z.object({
          findingId: z.string(),
          userRef: z.string(),
          systemRef: z.string(),
          orphanedReason: z.enum([
            'user-departed',
            'role-changed',
            'manager-departed',
            'system-decommissioned',
          ]),
          rationale: z.string(),
        })
      )
      .default([]),
    privilegeCreep: z
      .array(
        z.object({
          findingId: z.string(),
          userRef: z.string(),
          systemRef: z.string(),
          accumulatedRoleCount: z.number().int().nonnegative(),
          rationale: z.string(),
        })
      )
      .default([]),
    dormantAccounts: z
      .array(
        z.object({
          findingId: z.string(),
          userRef: z.string(),
          systemRef: z.string(),
          daysSinceLastUse: z.number().int().nonnegative(),
          rationale: z.string(),
        })
      )
      .default([]),
  }),
  revocationRecommendations: z
    .array(
      z.object({
        recommendationId: z.string(),
        findingId: z.string(),
        userRef: z.string(),
        systemRef: z.string(),
        recommendedAction: z.enum(['revoke', 'downgrade', 'rotate-credentials', 'review-only']),
        targetRoles: z.array(z.string()).default([]),
        rationale: z.string(),
      })
    )
    .default([]),
  managerAttestations: z.array(
    z.object({
      managerRef: z.string(),
      attestedUserCount: z.number().int().nonnegative(),
      decisions: z.array(
        z.object({
          recommendationId: z.string(),
          decision: z.enum(['confirm-revoke', 'keep-as-is', 'escalate']),
          notes: z.string().optional(),
          decidedAt: z.string(),
        })
      ),
      attestationCompletedAt: z.string(),
    })
  ),
  securityLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  attestationEvidence: z.object({
    evidencePackRef: z.string(),
    evidencePackUrl: z.string(),
    emittedAt: z.string(),
  }),
  revokedGrantsLog: z.array(
    z.object({
      recommendationId: z.string(),
      userRef: z.string(),
      systemRef: z.string(),
      revokedRoles: z.array(z.string()),
      revokedAt: z.string(),
    })
  ),
  generatedAt: z.string(),
})

export type AccessReviewInput = z.infer<typeof AccessReviewInputSchema>
export type AccessReviewOutput = z.infer<typeof AccessReviewOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_orphanedGrantRate: RewardSignal = {
  keyResultRef: 'kr:access-review-coordinator:orphaned-grant-rate-reduction',
}
const kr_grantCoverage: RewardSignal = {
  keyResultRef: 'kr:access-review-coordinator:grant-coverage',
}
const kr_anomalyPrecision: RewardSignal = {
  keyResultRef: 'kr:access-review-coordinator:anomaly-precision',
}
const kr_recommendationActionability: RewardSignal = {
  keyResultRef: 'kr:access-review-coordinator:recommendation-actionability',
}
const kr_revocationLatency: RewardSignal = {
  keyResultRef: 'kr:access-review-coordinator:revocation-latency',
}

// ============================================================================
// Access Review Coordinator Service
// ============================================================================

/**
 * Access Review Coordinator — quarterly cron + scope = sensitive-systems
 * users → security-lead-approved attestation evidence pack + revoked-grants
 * fan-out from a per-manager attestation loop as a Service.
 *
 * Cascade: fetch-access-grants-ldap-snapshot-and-role-membership (Code, fan-in)
 *        → synthesize-anomaly-detection-orphaned-grants-privilege-creep-and-dormant-accounts (Generative)
 *        → draft-revocation-recommendations-and-manager-attestation-questions (Generative)
 *        → per-manager-attestation-loop (Human, approval rationale)
 *        → emit-attestation-evidence-and-revoke-confirmed-grants (Code, fan-out).
 */
export const accessReviewCoordinator: ServiceInstance<AccessReviewInput, AccessReviewOutput> =
  Service.define<AccessReviewInput, AccessReviewOutput>({
    name: 'Access Review Coordinator',
    promise:
      'Every quarter, every sensitive-system grant gets a manager-attested decision (keep / revoke / downgrade) backed by anomaly-detection on orphaned grants, privilege creep, and dormant accounts — so the security team ships a clean SOX / SOC2 / ISO-27001 evidence pack and the orphaned-grant rate trends down quarter-over-quarter.',
    audience: 'business',
    archetype: 'quality-review',
    schema: { input: AccessReviewInputSchema, output: AccessReviewOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-access-grants-ldap-snapshot-and-role-membership',
          reward: kr_grantCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-anomaly-detection-orphaned-grants-privilege-creep-and-dormant-accounts',
          reward: kr_anomalyPrecision,
        }),
        Generative({
          name: 'draft-revocation-recommendations-and-manager-attestation-questions',
          reward: kr_recommendationActionability,
        }),
        Human({
          name: 'per-manager-attestation-loop',
          // `approval` rationale: each grant-owning manager owns the
          // attestation decision on their reports' grants — keep, revoke, or
          // escalate. The loop fans out to the manager cohort and rolls back
          // up before the security-lead signs the evidence pack.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-attestation-evidence-and-revoke-confirmed-grants',
          reward: kr_revocationLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'okta.users',
        'okta.groups',
        'azure-ad.users',
        'google-workspace.users',
        'aws-iam.read',
        'gcp-iam.read',
        'snowflake.grants',
        'databricks.grants',
        'github.org-members',
        'salesforce.users',
        'workday.read',
        'docs.write',
        'evidence-store.write',
      ],
      // Quarterly cadence: clarification disabled — the cascade synthesises
      // from the IdP + access-grant + HRIS signals; the per-manager
      // attestation loop is the only multi-human contact surface, and the
      // security-lead review step finalises.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Restricted-tier systems (cloud-iam, finance, hris) escalate the
          // anomaly-detection step to a senior IAM supervisor before the
          // security-lead review (the lead still signs, but a senior
          // backstops anomaly precision on the highest-sensitivity tier).
          when: 'inScopeSensitiveSystems.some(s => s.sensitivityTier == "restricted")',
          action: 'escalate',
        },
        {
          // Every review routes through the per-manager attestation loop
          // before revocations apply; OutcomeContract enforces the
          // signature on the rolled-up pack, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'per-manager-attestation-loop',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:access-review-coordinator-review',
      personas: [
        // Anomaly-precision reviewer — pedantic check that every anomaly
        // finding carries a non-trivial rationale (cites the specific grant
        // + the specific signal — last-used timestamp, accumulated-role
        // count, departed-user flag — that supports the finding) and that
        // false-positive risk is minimised on the privilege-creep surface
        // (which is the noisiest of the three).
        Personas.pedantic({
          domain: 'anomaly-precision',
          rubric: [
            'every-orphaned-grant-cites-departed-user-or-role-change-evidence',
            'every-privilege-creep-cites-accumulated-role-count',
            'every-dormant-account-cites-days-since-last-use',
            'no-anomaly-finding-without-cited-signal',
            'no-recommendation-without-finding',
          ],
          name: 'anomaly-precision-checker',
        }),
        // Attestation-coverage reviewer — pedantic check that every in-
        // scope user with grants on an in-scope system rolls up to exactly
        // one attesting manager, that no in-scope grant is dropped from
        // the attestation roster, and that the rolled-up pack matches the
        // input snapshot user-for-user.
        Personas.pedantic({
          domain: 'attestation-coverage',
          rubric: [
            'every-in-scope-grant-routed-to-an-attesting-manager',
            'no-in-scope-user-silently-omitted',
            'attestation-roster-matches-snapshot-user-for-user',
            'every-recommendation-has-an-attestation-decision',
            'rolled-up-pack-tracks-per-manager-decisions',
          ],
          name: 'attestation-coverage-checker',
        }),
        // Regulatory-compliance reviewer — SOX-tier compliance check on the
        // attestation evidence pack (named manager attester per grant,
        // timestamped decision, signed-off security-lead review,
        // revocation-applied-at audit trail).
        Personas.regulatoryCompliance({
          regulator: 'sox',
          name: 'sox-compliance-reviewer',
        }),
        // Data-privacy reviewer — GDPR-tier privacy check on the evidence
        // pack (no surplus PII included in the per-manager attestation
        // questions, data-minimization on the rolled-up pack).
        Personas.dataPrivacy({
          framework: 'gdpr',
          name: 'gdpr-privacy-reviewer',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:access-review-coordinator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-security-lead',
      seller: 'svc:access-review-coordinator',
      serviceRef: 'svc:access-review-coordinator',
      // Security-lead signs the rolled-up evidence pack before revocations
      // apply — UAR sign-off authority cannot be delegated (compliance-
      // tied accountability).
      predicate: AND(
        SchemaMatch(AccessReviewOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['security-lead'] })
      ),
      amount: { amount: 149900n, currency: 'USD' },
      // 21-day SLA — quarterly cadence + per-manager attestation loop
      // depth means the evidence pack ships within three weeks of the
      // review trigger.
      timeoutDays: 21,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'access-review-coordinator-monthly',
        amount: 149900n,
        currency: 'USD',
        interval: 'month',
      },
      // Metered overage — manager-attestation loops above the implicit
      // per-quarter baseline charge $49 each. The metering runtime
      // resolves `manager-attestation-loop-completed` to the rolled-up
      // count beyond the included baseline and lines them on the monthly
      // invoice.
      metered: [
        {
          event: 'manager-attestation-loop-completed',
          amount: 4900n,
          description: 'Per-manager attestation loop completed beyond the per-quarter baseline.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 12000n, perApiCall: 8n },
    reward: kr_orphanedGrantRate,

    lineage: {
      cellRef: 'business.org.ai/cells/security-leads/access-review-coordinator',
      icpContextProblemRef: 'icp:access-review-coordinator:v1',
      foundingHypothesisRef: 'fh:access-review-coordinator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
