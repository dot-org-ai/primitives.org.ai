/**
 * Audit Prep Service — annual audit binder assembled (schedules, journals,
 * supporting docs) and ready for the auditor on day 1.
 *
 * Distinguishing shape vs. controller / payroll:
 *   - longest cascade in the finance catalog (7 steps) culminating in a
 *     terminal Human (`controller-review`) with a tax-/audit-tier
 *     earned-autonomy expirationPolicy (0.99 accuracy / 36 samples — looser
 *     than payroll because audit-prep runs annually, not biweekly);
 *   - `document-extraction` archetype (matches controller; binders are
 *     fundamentally a document-assembly surface);
 *   - 3-persona panel: gaap-tie-out skeptic, 100% document-completeness
 *     coverage floor, and an Accountants domain expert;
 *   - outcome-tier pricing (small-business / mid-market / enterprise —
 *     $1999 / $9999 / $49999 per binder) — the audit-prep market price
 *     varies by an order of magnitude across tenant sizes;
 *   - 21-day SLA — audit-prep is a multi-week effort, longest in the
 *     catalog;
 *   - `cpa-attest` authority boundary (controller-review is a regulated
 *     surface — the human signer is a CPA-credentialed controller).
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers + earned
 * autonomy) + §7 (outcome-tier pricing factory) + §8 (AND-composed
 * predicates with HumanSign).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Supporting-doc category surfaced in the audit binder. Tight 4-enum:
 * `bank-statement` for cash + reconciliations, `vendor-invoice` for AP
 * substantiation, `customer-invoice` for AR substantiation, `journal-entry`
 * for any manual-adjusting entries the auditor will sample-test.
 */
export const SupportingDocTypeSchema = z.enum([
  'bank-statement',
  'vendor-invoice',
  'customer-invoice',
  'journal-entry',
])
export type SupportingDocType = z.infer<typeof SupportingDocTypeSchema>

/**
 * Input — the audit period + the accounts in scope + the schedules the
 * auditor has requested. `accountsRef` is a reference-array the upstream
 * connector resolves to live chart-of-accounts records. `requestedSchedules`
 * is opaque-string-typed (e.g. `'fixed-assets-rollforward'`,
 * `'debt-rollforward'`) — the produce-schedules step understands the
 * canonical names.
 */
export const AuditPeriodInputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ fiscalYear: z.string() }),
  accountsRef: z.array(z.string()),
  requestedSchedules: z.array(z.string()),
})

/**
 * Output — the assembled audit binder: per-period summary, the produced
 * schedules (each labelled + URL-pointed), the supporting docs (each
 * categorised + URL-pointed), the controller sign-off pointer, the binder
 * URL the auditor opens on day 1, and the publish timestamp.
 */
export const AuditBinderOutputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ fiscalYear: z.string() }),
  schedules: z.array(
    z.object({
      label: z.string(),
      url: z.string(),
    })
  ),
  supportingDocs: z.array(
    z.object({
      ref: z.string(),
      type: SupportingDocTypeSchema,
    })
  ),
  controllerSignOffRef: z.string(),
  binderUrl: z.string(),
  publishedAt: z.string(), // ISO-8601
})

export type AuditPeriodInput = z.infer<typeof AuditPeriodInputSchema>
export type AuditBinderOutput = z.infer<typeof AuditBinderOutputSchema>

// ============================================================================
// RewardSignal placeholder — Service-level reward (audit cycle time → days
// from period close to binder ready). TODO: replace with real $.Reward
// references when business-as-code KR primitive lands.
// ============================================================================

const kr_auditCycleTime: RewardSignal = {
  keyResultRef: 'kr:audit-prep:audit-cycle-time',
}

// ============================================================================
// Audit Prep Service
// ============================================================================

/**
 * Audit Prep — annual audit binder assembled, schedules + supporting docs
 * pulled, controller-attested, ready for the auditor on day 1.
 *
 * Cascade: pull-period-data (Code, quickbooks period extract) →
 *        reconcile-account-balances (Agentic, supervised — reconciliation
 *          breaks are judgment calls; large breaks additionally route to
 *          controller-review via the binding trigger) →
 *        assemble-supporting-docs (Code, doc-storage gather) →
 *        produce-schedules (Generative — per requested schedule) →
 *        cross-reference (Agentic, supervised — ties schedules ↔ docs ↔
 *          GL balances) →
 *        controller-review (Human, regulatory; expirationPolicy looser than
 *          payroll's because audit-prep runs annually, not biweekly:
 *          0.99 accuracy / 36 samples) →
 *        publish-binder (Code, doc-storage upload + gmail.send notify).
 *
 * One declarative trigger: any reconciliation break >$50k (5_000_000 cents)
 * routes to `controller-review` regardless of normal autonomy thresholds —
 * material breaks always get a human signer.
 */
export const auditPrep: ServiceInstance<AuditPeriodInput, AuditBinderOutput> = Service.define<
  AuditPeriodInput,
  AuditBinderOutput
>({
  name: 'Audit Prep',
  promise:
    'Annual audit binder assembled — schedules, journals, supporting docs — ready for the auditor on day 1',
  audience: 'business',
  archetype: 'document-extraction',
  schema: { input: AuditPeriodInputSchema, output: AuditBinderOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'pull-period-data', reward: kr_auditCycleTime, handler: () => undefined }),
      Agentic({
        name: 'reconcile-account-balances',
        reward: kr_auditCycleTime,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Code({
        name: 'assemble-supporting-docs',
        reward: kr_auditCycleTime,
        handler: () => undefined,
      }),
      Generative({ name: 'produce-schedules', reward: kr_auditCycleTime }),
      Agentic({
        name: 'cross-reference',
        reward: kr_auditCycleTime,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Human({
        name: 'controller-review',
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 36 },
      }),
      Code({ name: 'publish-binder', reward: kr_auditCycleTime, handler: () => undefined }),
    ],
    toolPermissions: [
      'quickbooks.entries',
      'quickbooks.statements',
      'doc-storage.uploads',
      'gmail.send',
    ],
    clarificationPolicy: {
      enabled: true,
      maxRoundTrips: 3,
      escalateTo: 'controller',
    },
    triggers: [
      {
        // Material reconciliation breaks (>$50k) always route to the
        // controller-review human signer regardless of normal autonomy.
        when: 'reconciliation_break.amount > 5000000n',
        action: 'route-to',
        target: 'controller-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:audit-prep-review',
    personas: [
      // Tie-out skeptic — adversarially probes the GAAP tie-out across
      // schedules ↔ supporting docs ↔ GL balances; assumes the tie-out is
      // off until proven otherwise (auditors will find it if the panel
      // doesn't).
      Personas.skeptic({ domain: 'gaap-tie-out', name: 'tie-out-skeptic' }),
      // Document-completeness pedant — every requested schedule and every
      // referenced supporting doc must be present in the binder (100% —
      // a missing doc is a guaranteed auditor follow-up).
      Personas.coverage({ minPercent: 1.0, name: 'document-completeness' }),
      // Accountant domain expert — fact-grounds the binder against
      // standard accountant practice; rejects schedules / docs that
      // wouldn't survive an actual audit walkthrough.
      Personas.domain({
        expertRef: 'occupations.org.ai/Accountants',
        name: 'accountant-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:audit-prep:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cfo',
    seller: 'svc:audit-prep',
    serviceRef: 'svc:audit-prep',
    // AND(schema, panel, human): output validates, panel approves, AND the
    // controller signs off. No External verifier — the binder is consumed
    // by the auditor (out-of-band), not by an API; the controller sign-off
    // is the authoritative attestation.
    predicate: AND(
      SchemaMatch(AuditBinderOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['controller'] })
    ),
    amount: { amount: 999900n, currency: 'USD' },
    // 21-day SLA — audit prep is a multi-week effort (longest in the
    // catalog) covering pull + reconcile + schedule production +
    // controller review.
    timeoutDays: 21,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'small-business',
        amount: 199900n,
        currency: 'USD',
        description: 'Small-business binder ($1,999).',
      },
      {
        id: 'mid-market',
        amount: 999900n,
        currency: 'USD',
        description: 'Mid-market binder ($9,999).',
      },
      {
        id: 'enterprise',
        amount: 4999900n,
        currency: 'USD',
        description: 'Enterprise binder ($49,999).',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'cpa-attest',
  costModel: { perInvocation: 1000n },
  reward: kr_auditCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/auditors/annual-audit-preparation',
    icpContextProblemRef: 'icp:audit-prep:v1',
    foundingHypothesisRef: 'fh:audit-prep:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
