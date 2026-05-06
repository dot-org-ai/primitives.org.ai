/**
 * Churn Rescue Service — round-6 catalog Service for the multi-step
 * cancellation-signal diagnostic loop in the customer-success domain.
 *
 * Demonstrates: outcome-tier pricing (2 tiers — saved / graceful-exit, both
 * billable so a graceful exit still pays), `multi-step-research` archetype,
 * partly-supervised cascade (diagnose + choose-strategy run under HITL
 * supervision), declarative HITL routing via `binding.triggers` (high-ARR
 * accounts route to the supervised choose-strategy step; 3+ detractor
 * signals escalate), EvaluatorPanel of 3 personas (cause-skeptic +
 * offer-economics + csm-reviewer) under `all-approve`, AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + External
 * stripe-decision-logged), `no-charge-if-not-qualified` refund,
 * `tenant-only` authority, 7-day `timeoutDays`, clarification enabled
 * with maxRoundTrips 2 escalating to a CSM.
 *
 * Per design v1 §3.D (Catalog HOW agent's Customer Success Churn-rescue
 * spec) + v3 §6 (binding triggers) + v3 §7 (outcome-tier pricing factory)
 * + v3 §8 (ProofPredicate AND composition) + round-6 cleanups
 * (Pricing factory call) + round-8 (`evaluator-signoff` verdict 'advisory'
 * available; not used here — both reviewer personas remain `must-approve`).
 *
 * Layer note: this Service lives in `autonomous-customer-success` (L5) and
 * depends on `services-as-software` (L5), `autonomous-finance` (L3), and
 * `digital-tools` (L4). No `Human` Functions in the cascade — HITL gates
 * are declarative triggers + per-Function `mode: 'supervised'` oversight.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a single inbound churn signal of one of four kinds: cancel-clicked
 * (in-product), complaint (support / NPS detractor), usage-drop (telemetry
 * threshold), payment-failure (Stripe webhook). Tight: 3 fields capture
 * identity, signal kind, and timestamp.
 */
export const ChurnSignalInputSchema = z.object({
  customerRef: z.string(),
  signalKind: z.enum(['cancel-clicked', 'complaint', 'usage-drop', 'payment-failure']),
  ts: z.string(),
})

/**
 * Output — a churn decision: the diagnosed cause string, the chosen strategy
 * (save-offer / graceful-exit / immediate-refund), whether the strategy was
 * executed, and the optionally-retained ARR (in cents) when a save-offer
 * landed. `executed=false` means the strategy was chosen but stalled at a
 * downstream gate (Stripe API failure, tenant policy block, etc).
 */
export const ChurnDecisionOutputSchema = z.object({
  customerRef: z.string(),
  cause: z.string(),
  strategy: z.enum(['save-offer', 'graceful-exit', 'immediate-refund']),
  executed: z.boolean(),
  retainedArr: z.bigint().optional(),
})

export type ChurnSignalInput = z.infer<typeof ChurnSignalInputSchema>
export type ChurnDecisionOutput = z.infer<typeof ChurnDecisionOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

const kr_grossRetention: RewardSignal = { keyResultRef: 'kr:churn-rescue:gross-retention' }
const kr_signalCoverage: RewardSignal = { keyResultRef: 'kr:churn-rescue:signal-coverage' }
const kr_diagnoseAccuracy: RewardSignal = {
  keyResultRef: 'kr:churn-rescue:diagnose-accuracy',
}
const kr_offerQuality: RewardSignal = { keyResultRef: 'kr:churn-rescue:offer-quality' }
const kr_strategyAccuracy: RewardSignal = {
  keyResultRef: 'kr:churn-rescue:strategy-accuracy',
}
const kr_executionFidelity: RewardSignal = {
  keyResultRef: 'kr:churn-rescue:execution-fidelity',
}

// ============================================================================
// Churn Rescue Service
// ============================================================================

/**
 * Churn Rescue — multi-step cancellation-signal diagnostic + decision as a
 * Service.
 *
 * Cascade: signal-pull (Code, stripe + crm + support pull)
 *        → diagnose (Agentic, supervised)
 *        → simulate-offers (Generative)
 *        → choose-strategy (Agentic, supervised)
 *        → execute (Code, stripe write + crm log + gmail send).
 *
 * Two declarative triggers wire HITL behaviour:
 *   - `customer.arr > 5_000_000_00n` (i.e. ARR > $50k) routes to the
 *     supervised `choose-strategy` step so a CSM signs off on the strategy
 *     for high-ARR accounts;
 *   - `detractor_signals.count > 3` escalates to the configured oversight
 *     channel (3+ signals in flight means automated handling is no longer
 *     appropriate).
 *
 * Pricing is outcome-based with two tiers (`saved` and `graceful-exit`) —
 * both outcomes are billable because a clean graceful exit (no chargeback,
 * no NPS hit) is a real customer-success win.
 */
export const churnRescue: ServiceInstance<ChurnSignalInput, ChurnDecisionOutput> = Service.define<
  ChurnSignalInput,
  ChurnDecisionOutput
>({
  name: 'Churn Rescue',
  promise:
    'Cancellation signals diagnosed and addressed — save offer or graceful exit, decided by data',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: ChurnSignalInputSchema, output: ChurnDecisionOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'signal-pull', reward: kr_signalCoverage, handler: () => undefined }),
      Agentic({
        name: 'diagnose',
        reward: kr_diagnoseAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({ name: 'simulate-offers', reward: kr_offerQuality }),
      Agentic({
        name: 'choose-strategy',
        reward: kr_strategyAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Code({ name: 'execute', reward: kr_executionFidelity, handler: () => undefined }),
    ],
    toolPermissions: [
      'stripe.subscriptions',
      'crm.contacts',
      'crm.opportunities',
      'support.tickets',
      'gmail.send',
    ],
    // Multi-step research design: clarification enabled with a tight cap so
    // a CSM is brought in after at most two round-trips of ambiguity.
    clarificationPolicy: { enabled: true, maxRoundTrips: 2, escalateTo: 'csm' },
    triggers: [
      {
        // High-ARR accounts ($50k+) route directly to the supervised
        // choose-strategy step so a CSM signs off on the rescue strategy.
        when: 'customer.arr > 5000000n',
        action: 'route-to',
        target: 'choose-strategy',
      },
      {
        // 3+ detractor signals in flight means automated handling is no
        // longer appropriate — escalate per the oversight policy.
        when: 'detractor_signals.count > 3',
        action: 'escalate',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:churn-rescue-review',
    personas: [
      // Cause skeptic — adversarially probes the diagnose step's cause
      // attribution; assumes the diagnosis is wrong until proven otherwise.
      Personas.skeptic({ domain: 'churn-cause-attribution', name: 'cause-skeptic' }),
      // Offer-economics skeptic — checks the simulate-offers / choose-
      // strategy economics; rejects offers that lose more than they save.
      Personas.skeptic({ domain: 'offer-economics', name: 'offer-economics' }),
      // CSM domain reviewer — pulls the CustomerSuccessManagers expert
      // from business.org.ai for senior CSM judgment on the overall plan.
      Personas.domain({
        expertRef: 'occupations.org.ai/CustomerSuccessManagers',
        name: 'csm-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    // Multi-step research design: 3 rounds before escalation (one extra
    // round vs. high-volume archetypes since the artefacts are richer).
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:churn-rescue:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cs-lead',
    seller: 'svc:churn-rescue',
    serviceRef: 'svc:churn-rescue',
    // AND(schema, panel, external): output validates, panel approves, AND
    // Stripe confirms the decision was logged. The external check pins the
    // outcome to a verifiable side-effect rather than just an LLM verdict.
    predicate: AND(
      SchemaMatch(ChurnDecisionOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({ verifier: 'stripe', spec: { decision_logged: true } })
    ),
    amount: { amount: 5000n, currency: 'USD' },
    // 7-day SLA per multi-step archetype default — diagnose + offer
    // simulation + CSM sign-off needs more than a day of wall clock.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      // $50 per saved subscription.
      { id: 'saved', amount: 5000n },
      // $10 per graceful exit — a clean cancellation with no chargeback
      // and no NPS hit is itself a customer-success outcome worth billing.
      { id: 'graceful-exit', amount: 1000n },
    ],
  }),

  refundContract: 'no-charge-if-not-qualified',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 80n },
  reward: kr_grossRetention,

  lineage: {
    cellRef: 'business.org.ai/cells/customer-success-managers/churn-prevention',
    icpContextProblemRef: 'icp:churn-rescue:v1',
    foundingHypothesisRef: 'fh:churn-rescue:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
