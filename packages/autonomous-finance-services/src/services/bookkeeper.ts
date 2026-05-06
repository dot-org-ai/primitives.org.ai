/**
 * Bookkeeper Service — proof-of-life for the v3 Service primitives.
 *
 * Demonstrates: subscription pricing + metered overage, document-extraction
 * archetype, multi-Function cascade with one Human (controller) + earned-
 * autonomy expirationPolicy, EvaluatorPanel of 3 personas, AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + conditional
 * HumanSign).
 *
 * Per design v3 §3 (Claude Code worked example as analog) + §6 (binding
 * triggers) + §7 (subscription pricing factory) + §8 (ProofPredicate AND).
 *
 * Layer note: this Service lives in `autonomous-finance` (L3) but logically
 * belongs to L5 (catalogs). The dep on `services-as-software` (L5) is OK
 * because the catalog is the consumer, not the substrate (v3 §12 packaging
 * tradeoff: subpath import discipline preserves layer rules).
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
 * Input — a batch of raw transactions ingested from upstream connectors
 * (Plaid / QuickBooks / Stripe / Brex). Tight: 5 fields capture period,
 * tenant, and the unprocessed transaction list.
 */
export const TxIngestSchema = z.object({
  tenantId: z.string(),
  periodStart: z.string(), // ISO-8601
  periodEnd: z.string(), // ISO-8601
  sourceConnectors: z.array(z.enum(['plaid', 'quickbooks', 'stripe', 'brex'])),
  transactions: z.array(
    z.object({
      id: z.string(),
      amountCents: z.bigint(),
      currency: z.string(),
      occurredAt: z.string(),
      memo: z.string().optional(),
      account: z.string(),
    })
  ),
})

/**
 * Output — closed monthly books, GAAP-compliant + audit-ready. 7 fields
 * cover the journal, statements, reconciliation receipt, and the controller
 * sign-off when one was required.
 */
export const ClosedBooksSchema = z.object({
  tenantId: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  journalEntries: z.array(
    z.object({
      id: z.string(),
      account: z.string(),
      debitCents: z.bigint(),
      creditCents: z.bigint(),
      category: z.string(),
    })
  ),
  reconciliation: z.object({
    matched: z.number(),
    breaks: z.array(
      z.object({
        id: z.string(),
        amountCents: z.bigint(),
        rationale: z.string(),
      })
    ),
  }),
  statements: z.object({
    incomeStatementUrl: z.string(),
    balanceSheetUrl: z.string(),
    cashFlowUrl: z.string(),
  }),
  closedAt: z.string(),
  controllerSignOffRef: z.string().optional(),
})

export type TxIngest = z.infer<typeof TxIngestSchema>
export type ClosedBooks = z.infer<typeof ClosedBooksSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

const kr_grossMargin: RewardSignal = { keyResultRef: 'kr:bookkeeper:gross-margin' }
const kr_closeOnTime: RewardSignal = { keyResultRef: 'kr:bookkeeper:close-on-time' }
const kr_breakRate: RewardSignal = { keyResultRef: 'kr:bookkeeper:break-rate' }
const kr_categoryAccuracy: RewardSignal = {
  keyResultRef: 'kr:bookkeeper:category-accuracy',
}

// ============================================================================
// Bookkeeper Service
// ============================================================================

/**
 * Bookkeeper — month-end close as a Service.
 *
 * Cascade: ingest → categorize → reconcile → controller-sign-breaks (HITL)
 *        → close → statements → publish.
 *
 * The controller HITL step has an earned-autonomy `expirationPolicy` so the
 * cascade can migrate the human off once cascade-without-human accuracy
 * exceeds 0.98 over 240 samples (per v3 §14 open decision: accuracy is the
 * cascade-without-the-human's, not the human's).
 */
export const bookkeeper: ServiceInstance<TxIngest, ClosedBooks> = Service.define<
  TxIngest,
  ClosedBooks
>({
  name: 'Bookkeeper',
  promise: 'Monthly books closed by day 5, GAAP-compliant, audit-ready.',
  audience: 'business',
  archetype: 'document-extraction',
  schema: { input: TxIngestSchema, output: ClosedBooksSchema },

  binding: {
    cascade: [
      Code({ name: 'ingest', reward: kr_closeOnTime, handler: () => undefined }),
      Agentic({
        name: 'categorize',
        reward: kr_categoryAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Agentic({
        name: 'reconcile',
        reward: kr_breakRate,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Human({
        name: 'controller-sign-breaks',
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 0.98, whenSamplesExceed: 240 },
      }),
      Agentic({
        name: 'close',
        reward: kr_closeOnTime,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({ name: 'statements', reward: kr_closeOnTime }),
      Code({ name: 'publish', handler: () => undefined }),
    ],
    toolPermissions: [
      'plaid.accounts',
      'quickbooks.entries',
      'stripe.charges',
      'brex.transactions',
    ],
    clarificationPolicy: {
      enabled: true,
      maxRoundTrips: 2,
      escalateTo: 'controller',
    },
    triggers: [
      {
        when: 'reconciliation_break.amount > 10000n',
        action: 'route-to',
        target: 'controller-sign-breaks',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:bookkeeper-review',
    personas: [
      Personas.pedantic({ domain: 'schema-conformance' }),
      Personas.skeptic({ domain: 'gaap' }),
      Personas.domain({ expertRef: 'occupations.org.ai/SeniorAccountant' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:bookkeeper:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-controller',
    seller: 'svc:bookkeeper',
    serviceRef: 'svc:bookkeeper',
    predicate: AND(
      SchemaMatch(ClosedBooksSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['controller'], when: 'breaks-exceed-threshold' })
    ),
    amount: { amount: 49900n, currency: 'USD' },
    // 5-day SLA — onTimeout escalates per refundContract.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: { id: 'monthly', amount: 49900n, currency: 'USD', interval: 'month' },
    metered: [{ event: 'transaction-categorized', amount: 1n }],
    sla: { metric: 'on-time', threshold: 'day-5' },
  }),

  refundContract: 'sla-credit-on-late-close',
  authorityBoundary: 'cpa-attest',
  costModel: { perTx: 1n, perInvocation: 50n },
  reward: kr_grossMargin,

  lineage: {
    cellRef: 'business.org.ai/cells/accountants-and-auditors/financial-statement-review',
    icpContextProblemRef: 'icp:bookkeeper:v1',
    foundingHypothesisRef: 'fh:bookkeeper:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
