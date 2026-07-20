/**
 * Sales Entity Types (Nouns)
 *
 * Sales and revenue: Deal, Pipeline, Stage, Contract, Subscription, Order, Quote.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Deal (Opportunity)
// =============================================================================

/**
 * Deal entity
 *
 * Represents a sales opportunity/deal.
 */
export const Deal: Noun = {
  singular: 'deal',
  plural: 'deals',
  description: 'A sales opportunity or deal',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Deal name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Deal description',
    },

    // Value
    amount: {
      type: 'number',
      optional: true,
      description: 'Deal amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },
    recurringAmount: {
      type: 'number',
      optional: true,
      description: 'Recurring amount (MRR/ARR)',
    },
    oneTimeAmount: {
      type: 'number',
      optional: true,
      description: 'One-time amount',
    },

    // Pipeline
    stage: {
      type: 'string',
      description: 'Current stage',
      examples: ['lead', 'qualified', 'discovery', 'demo', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
    },
    probability: {
      type: 'number',
      optional: true,
      description: 'Win probability (0-100)',
    },
    weightedAmount: {
      type: 'number',
      optional: true,
      description: 'Weighted deal value',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Deal type',
      examples: ['new-business', 'expansion', 'renewal', 'upsell', 'cross-sell'],
    },

    // Timeline
    expectedCloseDate: {
      type: 'date',
      optional: true,
      description: 'Expected close date',
    },
    actualCloseDate: {
      type: 'date',
      optional: true,
      description: 'Actual close date',
    },
    createdAt: {
      type: 'datetime',
      optional: true,
      description: 'Created date',
    },
    lastActivityAt: {
      type: 'datetime',
      optional: true,
      description: 'Last activity date',
    },

    // Source
    source: {
      type: 'string',
      optional: true,
      description: 'Lead source',
      examples: ['inbound', 'outbound', 'referral', 'partner', 'marketing', 'event'],
    },
    campaignId: {
      type: 'string',
      optional: true,
      description: 'Source campaign',
    },

    // Competition
    competitors: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Competitors in deal',
    },

    // Loss reason
    lossReason: {
      type: 'string',
      optional: true,
      description: 'Reason for loss',
      examples: ['price', 'features', 'competitor', 'timing', 'budget', 'no-decision', 'champion-left'],
    },
    lossNotes: {
      type: 'string',
      optional: true,
      description: 'Loss details',
    },

    // Forecast
    forecastCategory: {
      type: 'string',
      optional: true,
      description: 'Forecast category',
      examples: ['pipeline', 'best-case', 'commit', 'closed'],
    },

    // Priority
    priority: {
      type: 'string',
      optional: true,
      description: 'Deal priority',
      examples: ['critical', 'high', 'medium', 'low'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Deal status',
      examples: ['open', 'won', 'lost', 'archived'],
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer',
    },
    account: {
      type: 'Account',
      required: false,
      description: 'Account',
    },
    contacts: {
      type: 'Contact[]',
      description: 'Deal contacts',
    },
    owner: {
      type: 'Worker',
      required: false,
      description: 'Deal owner',
    },
    pipeline: {
      type: 'Pipeline',
      required: false,
      description: 'Pipeline',
    },
    products: {
      type: 'Product[]',
      description: 'Products in deal',
    },
    quotes: {
      type: 'Quote[]',
      description: 'Quotes',
    },
    contract: {
      type: 'Contract',
      required: false,
      description: 'Resulting contract',
    },
    interactions: {
      type: 'Interaction[]',
      description: 'Deal activities',
    },
  },

  actions: [
    'create',
    'update',
    'qualify',
    'advance',
    'setStage',
    'assignOwner',
    'addProduct',
    'removeProduct',
    'createQuote',
    'win',
    'lose',
    'reopen',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'qualified',
    'stageChanged',
    'ownerAssigned',
    'productAdded',
    'productRemoved',
    'quoteCreated',
    'won',
    'lost',
    'reopened',
    'archived',
  ],
}

// =============================================================================
// Pipeline
// =============================================================================

/**
 * Pipeline entity
 *
 * Represents a sales pipeline.
 */
export const Pipeline: Noun = {
  singular: 'pipeline',
  plural: 'pipelines',
  description: 'A sales pipeline',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Pipeline name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Pipeline description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Pipeline type',
      examples: ['sales', 'renewal', 'expansion', 'partnership'],
    },

    // Default
    isDefault: {
      type: 'boolean',
      optional: true,
      description: 'Is default pipeline',
    },

    // Metrics
    dealCount: {
      type: 'number',
      optional: true,
      description: 'Number of deals',
    },
    totalValue: {
      type: 'number',
      optional: true,
      description: 'Total pipeline value',
    },
    weightedValue: {
      type: 'number',
      optional: true,
      description: 'Weighted pipeline value',
    },
    avgDealSize: {
      type: 'number',
      optional: true,
      description: 'Average deal size',
    },
    avgCycleTime: {
      type: 'number',
      optional: true,
      description: 'Average cycle time (days)',
    },
    winRate: {
      type: 'number',
      optional: true,
      description: 'Win rate percentage',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Status
    status: {
      type: 'string',
      description: 'Pipeline status',
      examples: ['active', 'inactive', 'archived'],
    },
  },

  relationships: {
    stages: {
      type: 'Stage[]',
      description: 'Pipeline stages',
    },
    deals: {
      type: 'Deal[]',
      description: 'Deals in pipeline',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Sales team',
    },
  },

  actions: [
    'create',
    'update',
    'addStage',
    'removeStage',
    'reorderStages',
    'setDefault',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'stageAdded',
    'stageRemoved',
    'stagesReordered',
    'defaultSet',
    'archived',
  ],
}

// =============================================================================
// Stage
// =============================================================================

/**
 * Stage entity
 *
 * Represents a stage in a sales pipeline.
 */
export const Stage: Noun = {
  singular: 'stage',
  plural: 'stages',
  description: 'A stage in a sales pipeline',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Stage name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Stage description',
    },

    // Order
    order: {
      type: 'number',
      description: 'Stage order',
    },

    // Probability
    probability: {
      type: 'number',
      optional: true,
      description: 'Win probability at this stage',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Stage type',
      examples: ['open', 'won', 'lost'],
    },

    // Requirements
    requirements: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Requirements to enter stage',
    },
    exitCriteria: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Criteria to exit stage',
    },

    // Metrics
    dealCount: {
      type: 'number',
      optional: true,
      description: 'Deals in this stage',
    },
    avgTimeInStage: {
      type: 'number',
      optional: true,
      description: 'Average days in stage',
    },
    conversionRate: {
      type: 'number',
      optional: true,
      description: 'Conversion to next stage',
    },

    // Automation
    rottenAfterDays: {
      type: 'number',
      optional: true,
      description: 'Days until deal is considered stale',
    },
  },

  relationships: {
    pipeline: {
      type: 'Pipeline',
      description: 'Parent pipeline',
    },
    deals: {
      type: 'Deal[]',
      description: 'Deals in this stage',
    },
  },

  actions: [
    'create',
    'update',
    'move',
    'delete',
  ],

  events: [
    'created',
    'updated',
    'moved',
    'deleted',
  ],
}

// =============================================================================
// Contract
// =============================================================================

/**
 * Contract entity
 *
 * Represents a sales/service contract.
 */
export const Contract: Noun = {
  singular: 'contract',
  plural: 'contracts',
  description: 'A sales or service contract',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Contract name',
    },
    number: {
      type: 'string',
      optional: true,
      description: 'Contract number',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Contract description',
    },

    // Type
    type: {
      type: 'string',
      description: 'Contract type',
      examples: ['subscription', 'service', 'license', 'maintenance', 'support', 'msa', 'sow'],
    },

    // Value
    totalValue: {
      type: 'number',
      optional: true,
      description: 'Total contract value',
    },
    recurringValue: {
      type: 'number',
      optional: true,
      description: 'Recurring value (ARR)',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Term
    startDate: {
      type: 'date',
      description: 'Start date',
    },
    endDate: {
      type: 'date',
      optional: true,
      description: 'End date',
    },
    term: {
      type: 'number',
      optional: true,
      description: 'Term in months',
    },
    autoRenew: {
      type: 'boolean',
      optional: true,
      description: 'Auto-renew enabled',
    },
    renewalNoticeDays: {
      type: 'number',
      optional: true,
      description: 'Days notice for renewal',
    },

    // Billing
    billingFrequency: {
      type: 'string',
      optional: true,
      description: 'Billing frequency',
      examples: ['monthly', 'quarterly', 'annually', 'one-time'],
    },
    paymentTerms: {
      type: 'string',
      optional: true,
      description: 'Payment terms',
      examples: ['net-15', 'net-30', 'net-45', 'net-60', 'due-on-receipt'],
    },

    // Documents
    documentUrl: {
      type: 'url',
      optional: true,
      description: 'Contract document URL',
    },
    signedDate: {
      type: 'date',
      optional: true,
      description: 'Date signed',
    },

    // Status
    status: {
      type: 'string',
      description: 'Contract status',
      examples: ['draft', 'pending-signature', 'active', 'expiring', 'expired', 'renewed', 'terminated', 'cancelled'],
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer',
    },
    account: {
      type: 'Account',
      required: false,
      description: 'Account',
    },
    deal: {
      type: 'Deal',
      required: false,
      description: 'Source deal',
    },
    owner: {
      type: 'Worker',
      required: false,
      description: 'Contract owner',
    },
    subscriptions: {
      type: 'Subscription[]',
      description: 'Contract subscriptions',
    },
    lineItems: {
      type: 'ContractLineItem[]',
      description: 'Contract line items',
    },
    renewedFrom: {
      type: 'Contract',
      required: false,
      description: 'Previous contract (if renewal)',
    },
    renewedTo: {
      type: 'Contract',
      required: false,
      description: 'Renewal contract',
    },
  },

  actions: [
    'create',
    'update',
    'send',
    'sign',
    'activate',
    'amend',
    'renew',
    'terminate',
    'cancel',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'sent',
    'signed',
    'activated',
    'amended',
    'renewed',
    'expiring',
    'expired',
    'terminated',
    'cancelled',
    'archived',
  ],
}

// =============================================================================
// Subscription
// =============================================================================

/**
 * Subscription entity
 *
 * Represents a customer subscription.
 *
 * Canonical: services-as-software `ServiceSubscription` (+ its billing
 * entity set: Quote/Order/Subscription/Usage/Invoice/Payment) — SG-4; this
 * shape is a business-layer projection (MRR/ARR view), not the runtime
 * billing record.
 */
export const Subscription: Noun = {
  singular: 'subscription',
  plural: 'subscriptions',
  description: 'A customer subscription',

  properties: {
    // Value
    mrr: {
      type: 'number',
      optional: true,
      description: 'Monthly recurring revenue',
    },
    arr: {
      type: 'number',
      optional: true,
      description: 'Annual recurring revenue',
    },
    quantity: {
      type: 'number',
      optional: true,
      description: 'Quantity/seats',
    },
    unitPrice: {
      type: 'number',
      optional: true,
      description: 'Price per unit',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Plan
    planId: {
      type: 'string',
      optional: true,
      description: 'Plan ID',
    },
    planName: {
      type: 'string',
      optional: true,
      description: 'Plan name',
    },

    // Billing
    billingPeriod: {
      type: 'string',
      optional: true,
      description: 'Billing period',
      examples: ['monthly', 'quarterly', 'annually'],
    },
    billingAnchor: {
      type: 'number',
      optional: true,
      description: 'Billing anchor day',
    },
    currentPeriodStart: {
      type: 'date',
      optional: true,
      description: 'Current period start',
    },
    currentPeriodEnd: {
      type: 'date',
      optional: true,
      description: 'Current period end',
    },

    // Dates
    startDate: {
      type: 'date',
      description: 'Start date',
    },
    endDate: {
      type: 'date',
      optional: true,
      description: 'End date',
    },
    cancelledAt: {
      type: 'datetime',
      optional: true,
      description: 'Cancellation date',
    },
    cancelAtPeriodEnd: {
      type: 'boolean',
      optional: true,
      description: 'Cancel at period end',
    },

    // Trial
    trialStart: {
      type: 'date',
      optional: true,
      description: 'Trial start date',
    },
    trialEnd: {
      type: 'date',
      optional: true,
      description: 'Trial end date',
    },

    // Discount
    discountPercent: {
      type: 'number',
      optional: true,
      description: 'Discount percentage',
    },
    discountAmount: {
      type: 'number',
      optional: true,
      description: 'Discount amount',
    },

    // External
    stripeSubscriptionId: {
      type: 'string',
      optional: true,
      description: 'Stripe subscription ID',
    },

    // Status
    status: {
      type: 'string',
      description: 'Subscription status',
      examples: ['trialing', 'active', 'past-due', 'paused', 'cancelled', 'expired'],
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      description: 'Customer',
    },
    product: {
      type: 'Product',
      required: false,
      description: 'Product',
    },
    pricingPlan: {
      type: 'PricingPlan',
      required: false,
      description: 'Pricing plan',
    },
    contract: {
      type: 'Contract',
      required: false,
      description: 'Associated contract',
    },
    invoices: {
      type: 'Invoice[]',
      description: 'Invoices',
    },
  },

  actions: [
    'create',
    'update',
    'activate',
    'upgrade',
    'downgrade',
    'addQuantity',
    'removeQuantity',
    'pause',
    'resume',
    'cancel',
    'reactivate',
  ],

  events: [
    'created',
    'updated',
    'activated',
    'upgraded',
    'downgraded',
    'quantityChanged',
    'paused',
    'resumed',
    'cancelled',
    'reactivated',
    'renewed',
    'expired',
  ],
}

// =============================================================================
// Quote
// =============================================================================

/**
 * Quote entity
 *
 * Represents a sales quote/proposal.
 */
export const Quote: Noun = {
  singular: 'quote',
  plural: 'quotes',
  description: 'A sales quote or proposal',

  properties: {
    // Identity
    number: {
      type: 'string',
      description: 'Quote number',
    },
    name: {
      type: 'string',
      optional: true,
      description: 'Quote name',
    },

    // Value
    subtotal: {
      type: 'number',
      optional: true,
      description: 'Subtotal',
    },
    discount: {
      type: 'number',
      optional: true,
      description: 'Discount amount',
    },
    discountPercent: {
      type: 'number',
      optional: true,
      description: 'Discount percentage',
    },
    tax: {
      type: 'number',
      optional: true,
      description: 'Tax amount',
    },
    total: {
      type: 'number',
      description: 'Total amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Recurring
    mrr: {
      type: 'number',
      optional: true,
      description: 'Monthly recurring',
    },
    arr: {
      type: 'number',
      optional: true,
      description: 'Annual recurring',
    },

    // Validity
    validFrom: {
      type: 'date',
      optional: true,
      description: 'Valid from date',
    },
    validUntil: {
      type: 'date',
      optional: true,
      description: 'Valid until date',
    },

    // Terms
    terms: {
      type: 'string',
      optional: true,
      description: 'Terms and conditions',
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Notes',
    },

    // Documents
    documentUrl: {
      type: 'url',
      optional: true,
      description: 'Quote document URL',
    },

    // Status
    status: {
      type: 'string',
      description: 'Quote status',
      examples: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'superseded'],
    },
  },

  relationships: {
    deal: {
      type: 'Deal',
      required: false,
      description: 'Associated deal',
    },
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer',
    },
    account: {
      type: 'Account',
      required: false,
      description: 'Account',
    },
    contact: {
      type: 'Contact',
      required: false,
      description: 'Primary contact',
    },
    createdBy: {
      type: 'Worker',
      required: false,
      description: 'Created by',
    },
    lineItems: {
      type: 'QuoteLineItem[]',
      description: 'Quote line items',
    },
  },

  actions: [
    'create',
    'update',
    'send',
    'accept',
    'reject',
    'expire',
    'duplicate',
    'convertToOrder',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'expired',
    'duplicated',
    'converted',
    'archived',
  ],
}

// =============================================================================
// Order
// =============================================================================

/**
 * Order entity
 *
 * Represents a sales order.
 */
export const Order: Noun = {
  singular: 'order',
  plural: 'orders',
  description: 'A sales order',

  properties: {
    // Identity
    number: {
      type: 'string',
      description: 'Order number',
    },

    // Value
    subtotal: {
      type: 'number',
      optional: true,
      description: 'Subtotal',
    },
    discount: {
      type: 'number',
      optional: true,
      description: 'Discount amount',
    },
    tax: {
      type: 'number',
      optional: true,
      description: 'Tax amount',
    },
    shipping: {
      type: 'number',
      optional: true,
      description: 'Shipping amount',
    },
    total: {
      type: 'number',
      description: 'Total amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Dates
    orderedAt: {
      type: 'datetime',
      description: 'Order date',
    },
    fulfilledAt: {
      type: 'datetime',
      optional: true,
      description: 'Fulfillment date',
    },

    // Billing
    billingAddress: {
      type: 'json',
      optional: true,
      description: 'Billing address',
    },
    shippingAddress: {
      type: 'json',
      optional: true,
      description: 'Shipping address',
    },

    // Payment
    paymentStatus: {
      type: 'string',
      optional: true,
      description: 'Payment status',
      examples: ['pending', 'paid', 'partial', 'refunded', 'failed'],
    },
    paymentMethod: {
      type: 'string',
      optional: true,
      description: 'Payment method',
    },

    // Fulfillment
    fulfillmentStatus: {
      type: 'string',
      optional: true,
      description: 'Fulfillment status',
      examples: ['unfulfilled', 'partial', 'fulfilled', 'shipped', 'delivered'],
    },

    // Notes
    notes: {
      type: 'string',
      optional: true,
      description: 'Order notes',
    },

    // Status
    status: {
      type: 'string',
      description: 'Order status',
      examples: ['pending', 'confirmed', 'processing', 'completed', 'cancelled', 'refunded'],
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      description: 'Customer',
    },
    quote: {
      type: 'Quote',
      required: false,
      description: 'Source quote',
    },
    lineItems: {
      type: 'OrderLineItem[]',
      description: 'Order line items',
    },
    invoices: {
      type: 'Invoice[]',
      description: 'Invoices',
    },
  },

  actions: [
    'create',
    'update',
    'confirm',
    'fulfill',
    'ship',
    'deliver',
    'cancel',
    'refund',
  ],

  events: [
    'created',
    'updated',
    'confirmed',
    'fulfilled',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ],
}

// =============================================================================
// Invoice
// =============================================================================

/**
 * Invoice entity
 *
 * Represents an invoice.
 *
 * Canonical: services-as-software `Invoice` — SG-4; this shape is a
 * business-layer projection.
 */
export const Invoice: Noun = {
  singular: 'invoice',
  plural: 'invoices',
  description: 'An invoice',

  properties: {
    // Identity
    number: {
      type: 'string',
      description: 'Invoice number',
    },

    // Value
    subtotal: {
      type: 'number',
      optional: true,
      description: 'Subtotal',
    },
    discount: {
      type: 'number',
      optional: true,
      description: 'Discount amount',
    },
    tax: {
      type: 'number',
      optional: true,
      description: 'Tax amount',
    },
    total: {
      type: 'number',
      description: 'Total amount',
    },
    amountDue: {
      type: 'number',
      optional: true,
      description: 'Amount due',
    },
    amountPaid: {
      type: 'number',
      optional: true,
      description: 'Amount paid',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Dates
    issueDate: {
      type: 'date',
      description: 'Issue date',
    },
    dueDate: {
      type: 'date',
      optional: true,
      description: 'Due date',
    },
    paidAt: {
      type: 'datetime',
      optional: true,
      description: 'Payment date',
    },

    // Payment
    paymentTerms: {
      type: 'string',
      optional: true,
      description: 'Payment terms',
    },
    paymentMethod: {
      type: 'string',
      optional: true,
      description: 'Payment method',
    },

    // Documents
    documentUrl: {
      type: 'url',
      optional: true,
      description: 'Invoice document URL',
    },

    // External
    stripeInvoiceId: {
      type: 'string',
      optional: true,
      description: 'Stripe invoice ID',
    },

    // Status
    status: {
      type: 'string',
      description: 'Invoice status',
      examples: ['draft', 'sent', 'paid', 'partial', 'overdue', 'void', 'uncollectible'],
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      description: 'Customer',
    },
    subscription: {
      type: 'Subscription',
      required: false,
      description: 'Subscription',
    },
    order: {
      type: 'Order',
      required: false,
      description: 'Order',
    },
    contract: {
      type: 'Contract',
      required: false,
      description: 'Contract',
    },
    lineItems: {
      type: 'InvoiceLineItem[]',
      description: 'Invoice line items',
    },
    payments: {
      type: 'Payment[]',
      description: 'Payments',
    },
  },

  actions: [
    'create',
    'update',
    'send',
    'recordPayment',
    'markPaid',
    'void',
    'writeOff',
  ],

  events: [
    'created',
    'updated',
    'sent',
    'viewed',
    'paid',
    'partialPayment',
    'overdue',
    'voided',
    'writtenOff',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const SalesEntities = {
  Deal,
  Pipeline,
  Stage,
  Contract,
  Subscription,
  Quote,
  Order,
  Invoice,
}

export const SalesCategories = {
  pipeline: ['Deal', 'Pipeline', 'Stage'],
  agreements: ['Contract', 'Subscription'],
  transactions: ['Quote', 'Order', 'Invoice'],
} as const
