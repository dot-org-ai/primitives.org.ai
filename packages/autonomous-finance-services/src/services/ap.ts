/**
 * Accounts Payable Service — invoice intake, PO matching, approval, and
 * scheduled payment.
 *
 * Distinguishing shape vs. bookkeeper:
 *   - transactional-workflow archetype (continuous stream of invoices, not
 *     a periodic close);
 *   - 6-step cascade with TWO supervised agentic gates (PO match, approve-
 *     or-escalate) and NO Human step on the happy path — autonomy by
 *     default with declarative escalation triggers;
 *   - composite pricing (flat monthly base + metered per invoice paid);
 *   - dollar-threshold trigger ($10k+) routes to manual approval; low PO
 *     match-confidence escalates per oversight policy.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers) +
 * §7 (composite pricing factory) + §11 (clarification policy with controller
 * escalation).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Input — a freshly-arrived vendor invoice from any of the supported
 * connectors. Tight: 7 fields cover the invoice header, the source, and
 * the optional PO reference for matching.
 */
export const InvoiceIntakeSchema = z.object({
  tenantId: z.string(),
  invoiceId: z.string(),
  vendorRef: z.string(),
  amountCents: z.bigint(),
  currency: z.string(),
  sourceConnector: z.enum(['quickbooks', 'email-ingest', 'edi']),
  receivedAt: z.string(),
  poRef: z.string().optional(),
})

/**
 * Output — a paid (or scheduled-for-payment) invoice with the match record,
 * approval trail, and payment scheduling receipt.
 */
export const PaidInvoiceOutputSchema = z.object({
  tenantId: z.string(),
  invoiceId: z.string(),
  matchedPoRef: z.string().optional(),
  matchConfidence: z.number(),
  approval: z.object({
    decision: z.enum(['auto-approved', 'escalated-approved', 'rejected']),
    approverRef: z.string().optional(),
    rationale: z.string(),
  }),
  paymentScheduledFor: z.string(),
  transferRef: z.string().optional(),
})

export type InvoiceIntake = z.infer<typeof InvoiceIntakeSchema>
export type PaidInvoiceOutput = z.infer<typeof PaidInvoiceOutputSchema>

// ============================================================================
// RewardSignal placeholder — DPO (days payable outstanding) optimum.
// ============================================================================

const kr_dpoOptimal: RewardSignal = { keyResultRef: 'kr:ap:dpo-optimal' }

// ============================================================================
// Accounts Payable Service
// ============================================================================

/**
 * Accounts Payable — invoice processing as a Service.
 *
 * Cascade: ingest → extract-line-items → match-po (supervised) → validate-totals
 *        → approve-or-escalate (supervised) → schedule-payment.
 *
 * Two declarative triggers gate the flow:
 *   - any invoice over $10,000 routes to `approve-or-escalate` (no auto-pay);
 *   - PO match confidence below 0.8 escalates per oversight policy.
 */
export const ap: ServiceInstance<InvoiceIntake, PaidInvoiceOutput> = Service.define<
  InvoiceIntake,
  PaidInvoiceOutput
>({
  name: 'Accounts Payable',
  promise: 'Invoices ingested, matched, approved, scheduled — autonomously when safe',
  audience: 'business',
  archetype: 'transactional-workflow',
  schema: { input: InvoiceIntakeSchema, output: PaidInvoiceOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'ingest', reward: kr_dpoOptimal, handler: () => undefined }),
      Generative({ name: 'extract-line-items', reward: kr_dpoOptimal }),
      Agentic({
        name: 'match-po',
        reward: kr_dpoOptimal,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Code({ name: 'validate-totals', reward: kr_dpoOptimal, handler: () => undefined }),
      Agentic({
        name: 'approve-or-escalate',
        reward: kr_dpoOptimal,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Code({ name: 'schedule-payment', reward: kr_dpoOptimal, handler: () => undefined }),
    ],
    toolPermissions: ['quickbooks.invoices', 'quickbooks.purchase-orders', 'stripe.transfers'],
    clarificationPolicy: {
      enabled: true,
      maxRoundTrips: 2,
      escalateTo: 'controller',
    },
    triggers: [
      {
        when: 'invoice.amount > 1000000n',
        action: 'route-to',
        target: 'approve-or-escalate',
      },
      {
        when: 'po.match.confidence < 0.8',
        action: 'escalate',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:ap-review',
    personas: [
      Personas.skeptic({ domain: 'duplicate-detection', name: 'dupe-checker' }),
      Personas.skeptic({ domain: 'fraud-signal', name: 'fraud-checker' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:ap:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-controller',
    seller: 'svc:ap',
    serviceRef: 'svc:ap',
    predicate: AND(
      SchemaMatch(PaidInvoiceOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    amount: { amount: 4900n, currency: 'USD' },
    // 3-day default settlement window.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.composite({
    base: { id: 'monthly-base', amount: 4900n },
    metered: [{ event: 'invoice-paid', amount: 25n }],
  }),

  refundContract: 'partial-credit-on-partial-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 100n },
  reward: kr_dpoOptimal,

  lineage: {
    cellRef: 'business.org.ai/cells/accounts-payable-clerks/invoice-processing',
    icpContextProblemRef: 'icp:ap:v1',
    foundingHypothesisRef: 'fh:ap:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
