/**
 * Accounts Receivable Service — invoice composition, dispatch, follow-up,
 * and reconciliation.
 *
 * Distinguishing shape vs. bookkeeper:
 *   - tightest cascade in the catalog (4 steps) with the only fully-
 *     autonomous Agentic step (`followup-loop`) — no per-invocation
 *     supervision, escalation is event-driven via triggers;
 *   - clarification disabled (uses the v3 round 6 `{ enabled: false }`
 *     form) — AR follow-up runs on its own without nagging the operator;
 *   - pricing is `Pricing.percentOf({ basis: 'collected-amount',
 *     rateBasisPoints: 200 })` — 2% of realised collections — and the
 *     OutcomeContract requires Stripe payment confirmation via the
 *     External proof-predicate before the buyer is charged.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (event triggers + autonomous
 * Agentic) + §7 (percent-of pricing) + §8 (External proof-predicate).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Input — an outbound invoice the AR Service should compose, send, and chase
 * through to collection.
 */
export const ARInvoiceSchema = z.object({
  tenantId: z.string(),
  invoiceId: z.string(),
  customerRef: z.string(),
  amountCents: z.bigint(),
  currency: z.string(),
  dueAt: z.string(),
  toneHint: z.enum(['warm', 'neutral', 'firm']).optional(),
  customerEmail: z.string(),
})

/**
 * Output — final settlement record: collected total, days-to-collect,
 * follow-up trail, and the Stripe charge ref the External predicate will
 * verify.
 */
export const CollectedARSchema = z.object({
  tenantId: z.string(),
  invoiceId: z.string(),
  collectedCents: z.bigint(),
  currency: z.string(),
  daysToCollect: z.number(),
  followupCount: z.number(),
  collectedAt: z.string(),
  stripeChargeRef: z.string(),
  finalState: z.enum(['paid', 'partial', 'escalated-to-collections']),
})

export type ARInvoice = z.infer<typeof ARInvoiceSchema>
export type CollectedAR = z.infer<typeof CollectedARSchema>

// ============================================================================
// RewardSignal placeholder — DSO (days sales outstanding) optimum.
// ============================================================================

const kr_dsoOptimal: RewardSignal = { keyResultRef: 'kr:ar:dso-optimal' }

// ============================================================================
// Accounts Receivable Service
// ============================================================================

/**
 * Accounts Receivable — invoice send + follow-up + collection as a Service.
 *
 * Cascade: compose → send → followup-loop (autonomous) → reconcile.
 *
 * Two declarative event triggers gate the flow:
 *   - >60 days overdue escalates per oversight policy;
 *   - >90 days overdue routes to `collections-handoff` — note this target is
 *     OUT-OF-CASCADE (resolved by the runtime as a sibling Service), so the
 *     trigger compiler will warn / no-op until the runtime supports cross-
 *     cascade dispatch.
 */
export const ar: ServiceInstance<ARInvoice, CollectedAR> = Service.define<ARInvoice, CollectedAR>({
  name: 'Accounts Receivable',
  promise: 'Invoices sent, followed up, collected — with grace and persistence',
  audience: 'business',
  archetype: 'transactional-workflow',
  schema: { input: ARInvoiceSchema, output: CollectedARSchema },

  binding: {
    cascade: [
      Generative({ name: 'compose', reward: kr_dsoOptimal }),
      Code({ name: 'send', reward: kr_dsoOptimal, handler: () => undefined }),
      Agentic({
        name: 'followup-loop',
        reward: kr_dsoOptimal,
        mode: 'autonomous',
        oversight: { mode: 'autonomous' },
      }),
      Code({ name: 'reconcile', reward: kr_dsoOptimal, handler: () => undefined }),
    ],
    toolPermissions: ['quickbooks.invoices', 'gmail.send', 'stripe.charges'],
    clarificationPolicy: { enabled: false },
    triggers: [
      { when: 'overdue_days > 60', action: 'escalate' },
      // collections-handoff is out-of-cascade — runtime resolves to a
      // sibling Service. Warn-or-noop until cross-cascade dispatch lands.
      { when: 'overdue_days > 90', action: 'route-to', target: 'collections-handoff' },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:ar-review',
    personas: [
      Personas.voice({ brandVoiceRef: 'brand:ar-followup', name: 'tone-reviewer' }),
      Personas.accuracy({ domain: 'invoice-amounts', name: 'amounts-checker' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:ar:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-controller',
    seller: 'svc:ar',
    serviceRef: 'svc:ar',
    predicate: AND(
      SchemaMatch(CollectedARSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({ verifier: 'stripe', spec: { paid: true } })
    ),
    amount: { amount: 200n, currency: 'USD' },
    // 90-day collection horizon — past this the trigger routes to
    // collections-handoff; the OC itself times out and escalates.
    timeoutDays: 90,
    onTimeout: 'escalate',
  },

  // Percent-of-collected pricing: 2.0% of realised collections (200 bps).
  // The metering runtime resolves the `collected-amount` basis to the
  // settled charge total at settlement time and computes the charge as
  // `(collected_amount * 200) / 10000`.
  pricing: Pricing.percentOf({
    basis: 'collected-amount',
    rateBasisPoints: 200,
  }),

  refundContract: 'no-charge-if-not-qualified',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 50n },
  reward: kr_dsoOptimal,

  lineage: {
    cellRef: 'business.org.ai/cells/accounts-receivable-clerks/invoice-collection',
    icpContextProblemRef: 'icp:ar:v1',
    foundingHypothesisRef: 'fh:ar:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
