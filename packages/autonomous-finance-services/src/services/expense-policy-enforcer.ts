/**
 * Expense Policy Enforcer Service — corporate-card / expense-management as a
 * Service.
 *
 * Distinguishing shape vs. siblings in the finance catalog:
 *   - `triage` archetype (incoming-claim → policy-judgement → out-of-policy
 *     escalation), not document-extraction or transactional-workflow;
 *   - 4-step cascade with one Generative policy-classifier and a conditional
 *     Human escalation gated on out-of-policy verdicts (HITL only when the
 *     generative classifier flags a violation — happy-path is fully
 *     autonomous);
 *   - per-invocation pricing across three included tiers (starter / growth /
 *     scale) — high-volume per-claim economics, not subscription;
 *   - declarative trigger routes any out-of-policy claim to the Human
 *     escalation step, and a second trigger routes high-dollar claims
 *     (> $5,000) to escalation regardless of policy classifier verdict;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(when:
 *     out-of-policy))` — the human signature is only load-bearing when the
 *     classifier flagged a violation.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers, conditional
 * HumanSign) + §7 (perInvocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `rejected-claim-rate-aligned-with-policy` — measures
 * how well the cascade's reject decisions match the corporate expense policy
 * (precision + recall over a labeled audit set).
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
 * Input — an expense claim submitted by an employee against a corporate card
 * or out-of-pocket reimbursement, with one or more receipts attached. Tight:
 * 7 fields cover identity, claimant, the cash side of the claim, and the
 * receipts the cascade will OCR + line-item-extract.
 */
export const ExpenseClaimSchema = z.object({
  tenantId: z.string(),
  claimId: z.string(),
  claimantRef: z.string(),
  amountCents: z.bigint(),
  currency: z.string(),
  category: z.enum(['travel', 'meals', 'software', 'office', 'equipment', 'other']).optional(),
  submittedAt: z.string(),
  receipts: z.array(
    z.object({
      receiptId: z.string(),
      uri: z.string(),
      mediaType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    })
  ),
})

/**
 * Output — an adjudicated expense claim: the extracted line items, the
 * policy verdict, and the audit trail (which policy clause was cited, which
 * reviewer signed an out-of-policy escalation, and the final
 * approve/reject decision).
 */
export const PolicyDecisionSchema = z.object({
  tenantId: z.string(),
  claimId: z.string(),
  lineItems: z.array(
    z.object({
      receiptId: z.string(),
      description: z.string(),
      amountCents: z.bigint(),
      categoryGuess: z.string(),
    })
  ),
  policyVerdict: z.object({
    inPolicy: z.boolean(),
    citedPolicyClause: z.string().optional(),
    rationale: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  escalation: z
    .object({
      reviewerRef: z.string(),
      decision: z.enum(['override-approve', 'uphold-reject']),
      reviewedAt: z.string(),
    })
    .optional(),
  decision: z.enum(['approved', 'rejected']),
  decidedAt: z.string(),
})

export type ExpenseClaim = z.infer<typeof ExpenseClaimSchema>
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_policyAlignment: RewardSignal = {
  keyResultRef: 'kr:expense-policy-enforcer:rejected-claim-rate-aligned-with-policy',
}
const kr_extractionAccuracy: RewardSignal = {
  keyResultRef: 'kr:expense-policy-enforcer:extraction-accuracy',
}
const kr_classifyAccuracy: RewardSignal = {
  keyResultRef: 'kr:expense-policy-enforcer:classify-accuracy',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:expense-policy-enforcer:emit-latency',
}

// ============================================================================
// Expense Policy Enforcer Service
// ============================================================================

/**
 * Expense Policy Enforcer — corporate expense claim → policy adjudication
 * → approve or reject as a Service.
 *
 * Cascade: extract-line-items (Code, OCR + parse)
 *        → classify-against-policy (Generative, policy-aware classifier)
 *        → out-of-policy-escalation (Human, conditional via trigger)
 *        → emit-approval-or-reject (Code, write decision to expense system).
 */
export const expensePolicyEnforcer: ServiceInstance<ExpenseClaim, PolicyDecision> = Service.define<
  ExpenseClaim,
  PolicyDecision
>({
  name: 'Expense Policy Enforcer',
  promise:
    'Every expense claim adjudicated against policy in seconds; out-of-policy items escalate to a finance reviewer, in-policy items auto-approve.',
  audience: 'business',
  archetype: 'triage',
  schema: { input: ExpenseClaimSchema, output: PolicyDecisionSchema },

  binding: {
    cascade: [
      Code({
        name: 'extract-line-items',
        reward: kr_extractionAccuracy,
        handler: () => undefined,
      }),
      Generative({
        name: 'classify-against-policy',
        reward: kr_classifyAccuracy,
      }),
      Human({
        name: 'out-of-policy-escalation',
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 0.97, whenSamplesExceed: 500 },
      }),
      Code({
        name: 'emit-approval-or-reject',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'expensify.claims',
      'expensify.receipts',
      'brex.transactions',
      'quickbooks.entries',
    ],
    // High-volume triage: don't pause a claim to clarify with the claimant.
    // Out-of-policy items go to the reviewer queue, not back to the user.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Any classifier verdict of out-of-policy routes to human review.
        when: 'classify.verdict.in_policy == false',
        action: 'route-to',
        target: 'out-of-policy-escalation',
      },
      {
        // Independently, any claim over $5,000 routes to human review
        // regardless of classifier verdict (corporate-card policy floor).
        when: 'claim.amount > 500000n',
        action: 'route-to',
        target: 'out-of-policy-escalation',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:expense-policy-enforcer-review',
    personas: [
      Personas.pedantic({
        domain: 'policy-clause-citation',
        name: 'policy-clause-checker',
      }),
      Personas.skeptic({
        domain: 'fraud-signal',
        focus: ['duplicate-receipt', 'split-claim', 'altered-amount'],
        name: 'fraud-checker',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:expense-policy-enforcer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-controller',
    seller: 'svc:expense-policy-enforcer',
    serviceRef: 'svc:expense-policy-enforcer',
    // Human signature is conditional — only load-bearing when classifier
    // flagged out-of-policy. Happy-path (in-policy) settles on
    // SchemaMatch + EvaluatorPass alone.
    predicate: AND(
      SchemaMatch(PolicyDecisionSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({
        signerRoles: ['finance-reviewer', 'controller'],
        when: 'classify.verdict.in_policy == false',
      })
    ),
    amount: { amount: 200n, currency: 'USD' },
    // Per-claim SLA — 1 day from submission to decision.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'starter',
        amount: 200n,
        includedPerMonth: 500,
        overage: 200n,
      },
      {
        id: 'growth',
        amount: 150n,
        includedPerMonth: 5000,
        overage: 150n,
      },
      {
        id: 'scale',
        amount: 100n,
        includedPerMonth: 50000,
        overage: 100n,
      },
    ],
  }),

  refundContract: 'no-charge-if-decision-overturned-on-appeal',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 75n, perApiCall: 5n },
  reward: kr_policyAlignment,

  lineage: {
    cellRef: 'business.org.ai/cells/accountants-and-auditors/expense-claim-adjudication',
    icpContextProblemRef: 'icp:expense-policy-enforcer:v1',
    foundingHypothesisRef: 'fh:expense-policy-enforcer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
