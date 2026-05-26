/**
 * RefundContract — typed refund machinery. The 7-pattern catalog (per startup-builder
 * SERVICES.md) defines the contractual templates a Service can bind to.
 *
 * Stripe's Smart Disputes are consumer-chargeback-shaped; this is B2B SLA-shape.
 */

export type RefundContractRef =
  | 'no-charge-if-not-qualified'
  | 'quality-floor-fail'
  | 'sla-credit-on-late-delivery'
  | 'sla-credit-on-late-close'
  | 'partial-credit-on-partial-delivery'
  | 'time-bounded-money-back'
  | 'escalate-to-dispute'
  | (string & { __brand?: 'RefundContractRef' })

/**
 * Catalog of canonical refund contracts. Consumers reference by id; substrate
 * resolves the contract semantics at settlement time.
 */
export const RefundContracts = {
  'no-charge-if-not-qualified': {
    description:
      'No charge unless EvaluatorPass + downstream verification confirms work delivered.',
    triggersAt: 'pre-charge',
  },
  'quality-floor-fail': {
    description: 'Full refund when EvaluatorPanel rejects below quality floor.',
    triggersAt: 'post-quality-review',
  },
  'sla-credit-on-late-delivery': {
    description: 'Credit equal to N% of invoice when delivery exceeds OutcomeContract.expiresAt.',
    triggersAt: 'on-timeout',
  },
  'sla-credit-on-late-close': {
    description: 'Credit on monthly subscription when SLA target (e.g. close-by-day-5) breached.',
    triggersAt: 'sla-breach',
  },
  'partial-credit-on-partial-delivery': {
    description: 'Pro-rata credit when fraction of work-units delivered (e.g. tickets resolved).',
    triggersAt: 'post-delivery',
  },
  'time-bounded-money-back': {
    description: 'Full refund within N days of acceptance, no questions asked.',
    triggersAt: 'on-customer-request',
  },
  'escalate-to-dispute': {
    description: 'Route to ESCALATED_TO_HUMAN_REVIEW state; manual resolution.',
    triggersAt: 'on-customer-dispute',
  },
} as const
