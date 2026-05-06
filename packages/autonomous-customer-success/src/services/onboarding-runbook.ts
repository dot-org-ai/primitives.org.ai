/**
 * Onboarding Runbook Service — round-11 catalog Service for the new-customer
 * onboarding loop in the customer-success domain.
 *
 * Demonstrates: outcome-tier pricing (3 tiers — self-serve / mid-market /
 * enterprise, all billable so a graduated customer always pays), `transactional-
 * workflow` archetype, partly-supervised cascade with a `Human` step (`confirm-
 * with-customer` carries the `trust` rationale + accuracy/sample expiration
 * policy so the trust gate may be migrated to an Agentic Function once
 * track-record allows), declarative HITL routing via `binding.triggers`
 * (enterprise customers always route through the human confirmation step),
 * EvaluatorPanel of 2 personas (icp-checker + plan-completeness) under
 * `all-approve`, AND-composed OutcomeContract predicate (SchemaMatch +
 * EvaluatorPass + External product-analytics activation), `no-charge-if-not-
 * qualified` refund, `tenant-only` authority, 30-day `timeoutDays`
 * (onboarding can take a month), clarification enabled with `maxRoundTrips: 3`
 * escalating to a CSM (onboarding plans need clarification).
 *
 * Per design v1 §3.D (Catalog HOW agent's Customer Success Onboarding-runbook
 * spec) + v3 §6 (binding triggers) + v3 §7 (outcome-tier pricing factory)
 * + v3 §8 (ProofPredicate AND composition) + round-6 cleanups (Pricing factory
 * call) + round-9 (`{ enabled: true }` clarification form, `timeoutDays`).
 *
 * Layer note: this Service lives in `autonomous-customer-success` (L5) and
 * depends on `services-as-software` (L5), `autonomous-finance` (L3), and
 * `digital-tools` (L4). One `Human` Function in the cascade — the `confirm-
 * with-customer` trust gate — with a declarative expirationPolicy so the gate
 * may be migrated once track-record allows.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a newly-signed customer ready for onboarding. Tight: 3 fields capture
 * identity, the contracted tier (drives pricing + the enterprise routing
 * trigger), and the ICP descriptor (drives the analyze-tier-and-icp step).
 */
export const NewCustomerInputSchema = z.object({
  customerRef: z.string(),
  tier: z.enum(['free', 'starter', 'growth', 'enterprise']),
  icp: z.string(),
})

/**
 * Output — an activated customer: the executed onboarding plan (per-step
 * detail), execution + activation timestamps, and an optional sign-off
 * pointer when the human confirmation step recorded a customer ack.
 */
export const ActivatedCustomerOutputSchema = z.object({
  customerRef: z.string(),
  plan: z.object({
    steps: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(['self-serve', 'guided', 'concierge']),
        completedAt: z.string().optional(), // ISO-8601
      })
    ),
  }),
  executedAt: z.string(), // ISO-8601
  activatedAt: z.string(), // ISO-8601
  signOffRef: z.string().optional(),
})

export type NewCustomerInput = z.infer<typeof NewCustomerInputSchema>
export type ActivatedCustomerOutput = z.infer<typeof ActivatedCustomerOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

const kr_activationRate: RewardSignal = { keyResultRef: 'kr:onboarding-runbook:activation-rate' }
const kr_icpFitAccuracy: RewardSignal = {
  keyResultRef: 'kr:onboarding-runbook:icp-fit-accuracy',
}
const kr_planCompleteness: RewardSignal = {
  keyResultRef: 'kr:onboarding-runbook:plan-completeness',
}
const kr_customerConfirmation: RewardSignal = {
  keyResultRef: 'kr:onboarding-runbook:customer-confirmation',
}
const kr_step1Fidelity: RewardSignal = { keyResultRef: 'kr:onboarding-runbook:step1-fidelity' }
const kr_step2Fidelity: RewardSignal = { keyResultRef: 'kr:onboarding-runbook:step2-fidelity' }
const kr_checkpointAccuracy: RewardSignal = {
  keyResultRef: 'kr:onboarding-runbook:checkpoint-accuracy',
}
const kr_graduationFidelity: RewardSignal = {
  keyResultRef: 'kr:onboarding-runbook:graduation-fidelity',
}

// ============================================================================
// Onboarding Runbook Service
// ============================================================================

/**
 * Onboarding Runbook — new customer → tailored onboarding plan → execution +
 * checkpoints → graduated to active as a Service.
 *
 * Cascade: analyze-tier-and-icp (Agentic, supervised)
 *        → draft-plan (Generative)
 *        → confirm-with-customer (Human, trust rationale, expirationPolicy)
 *        → execute-step-1 (Code)
 *        → execute-step-2 (Code)
 *        → checkpoint-week-2 (Agentic, supervised)
 *        → graduate (Code, crm + product-analytics activation flip).
 *
 * One declarative trigger wires HITL behaviour:
 *   - `customer.tier === "enterprise"` always routes through the human
 *     `confirm-with-customer` step so enterprise customers get a CSM check-in
 *     on the plan before any execution begins.
 *
 * Pricing is outcome-based with three tiers ($99 / $499 / $1999 per onboarding
 * completed) — all tiers are billable because a graduated customer is itself
 * the activation outcome the Service sells.
 */
export const onboardingRunbook: ServiceInstance<NewCustomerInput, ActivatedCustomerOutput> =
  Service.define<NewCustomerInput, ActivatedCustomerOutput>({
    name: 'Onboarding Runbook',
    promise:
      'New customer → tailored onboarding plan → execution + checkpoints → graduated to active',
    audience: 'business',
    archetype: 'transactional-workflow',
    schema: { input: NewCustomerInputSchema, output: ActivatedCustomerOutputSchema },

    binding: {
      cascade: [
        Agentic({
          name: 'analyze-tier-and-icp',
          reward: kr_icpFitAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({ name: 'draft-plan', reward: kr_planCompleteness }),
        Human({
          name: 'confirm-with-customer',
          reward: kr_customerConfirmation,
          // `trust` rationale: the customer pays specifically for the human
          // touch on the plan confirmation — the gate may migrate to Agentic
          // once track-record clears the accuracy + samples thresholds.
          rationale: 'trust',
          expirationPolicy: { whenAccuracyExceeds: 0.95, whenSamplesExceed: 80 },
        }),
        Code({ name: 'execute-step-1', reward: kr_step1Fidelity, handler: () => undefined }),
        Code({ name: 'execute-step-2', reward: kr_step2Fidelity, handler: () => undefined }),
        Agentic({
          name: 'checkpoint-week-2',
          reward: kr_checkpointAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Code({ name: 'graduate', reward: kr_graduationFidelity, handler: () => undefined }),
      ],
      toolPermissions: [
        'crm.contacts',
        'crm.opportunities',
        'product-analytics.events',
        'gmail.send',
        'slack.dm',
      ],
      // Onboarding-plan design: clarification enabled with a tight cap so a
      // CSM is brought in after at most three round-trips of ambiguity.
      clarificationPolicy: { enabled: true, maxRoundTrips: 3, escalateTo: 'csm' },
      triggers: [
        {
          // Enterprise customers always route through the human confirmation
          // step — the plan needs CSM eyes before any execution begins.
          when: 'customer.tier === "enterprise"',
          action: 'route-to',
          target: 'confirm-with-customer',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:onboarding-runbook-review',
      personas: [
        // ICP fit checker — fact-grounds the analyze-tier-and-icp step's
        // output against the contracted ICP descriptor.
        Personas.accuracy({ domain: 'icp-fit', name: 'icp-checker' }),
        // Plan completeness floor — ensures the drafted plan covers ≥ 95% of
        // the canonical onboarding rubric items.
        Personas.coverage({ minPercent: 0.95, name: 'plan-completeness' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:onboarding-runbook:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cs-lead',
      seller: 'svc:onboarding-runbook',
      serviceRef: 'svc:onboarding-runbook',
      // AND(schema, panel, external): output validates, panel approves, AND
      // product-analytics confirms the activation flag flipped. The external
      // check pins the outcome to a verifiable side-effect rather than just
      // an LLM verdict.
      predicate: AND(
        SchemaMatch(ActivatedCustomerOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        External({ verifier: 'product-analytics', spec: { activated: true } })
      ),
      amount: { amount: 49900n, currency: 'USD' },
      // 30-day SLA — onboarding can take a month from kickoff to graduate.
      timeoutDays: 30,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'self-serve',
          amount: 9900n,
          currency: 'USD',
          description: 'Self-serve onboarding ($99).',
        },
        {
          id: 'mid-market',
          amount: 49900n,
          currency: 'USD',
          description: 'Mid-market onboarding ($499).',
        },
        {
          id: 'enterprise',
          amount: 199900n,
          currency: 'USD',
          description: 'Enterprise onboarding ($1999).',
        },
      ],
    }),

    refundContract: 'no-charge-if-not-qualified',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 500n },
    reward: kr_activationRate,

    lineage: {
      cellRef: 'business.org.ai/cells/customer-success-managers/customer-onboarding',
      icpContextProblemRef: 'icp:onboarding-runbook:v1',
      foundingHypothesisRef: 'fh:onboarding-runbook:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
