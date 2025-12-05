/**
 * Finance Entity Types (Nouns) - Stripe API Inspired
 *
 * Semantic type definitions for financial digital tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * Heavily influenced by Stripe's API structure and nomenclature.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// CORE
// =============================================================================

/**
 * Customer entity
 *
 * Represents a customer - person or business making purchases
 */
export const Customer: Noun = {
  singular: 'customer',
  plural: 'customers',
  description: 'A person or business making purchases',

  properties: {
    // Identity
    customerId: {
      type: 'string',
      description: 'Unique customer identifier',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Customer email address',
    },
    phone: {
      type: 'string',
      optional: true,
      description: 'Customer phone number',
    },

    // Name
    name: {
      type: 'string',
      optional: true,
      description: 'Customer full name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of the customer',
    },

    // Address
    address: {
      type: 'json',
      optional: true,
      description: 'Customer address',
    },
    shippingAddress: {
      type: 'json',
      optional: true,
      description: 'Shipping address',
    },

    // Balance & Credit
    balance: {
      type: 'number',
      optional: true,
      description: 'Current balance in cents (positive = customer owes, negative = credit)',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Tax
    taxExempt: {
      type: 'string',
      optional: true,
      description: 'Tax exemption status: none, exempt, reverse',
      examples: ['none', 'exempt', 'reverse'],
    },
    taxIds: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Tax IDs for the customer',
    },

    // Preferences
    preferredLocales: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Preferred locales',
    },
    invoicePrefix: {
      type: 'string',
      optional: true,
      description: 'Prefix for invoice numbers',
    },

    // Status
    delinquent: {
      type: 'boolean',
      optional: true,
      description: 'Whether customer has overdue invoices',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the customer was created',
    },
  },

  relationships: {
    defaultPaymentMethod: {
      type: 'PaymentMethod',
      required: false,
      description: 'Default payment method',
    },
    paymentMethods: {
      type: 'PaymentMethod[]',
      description: 'Payment methods on file',
    },
    invoices: {
      type: 'Invoice[]',
      backref: 'customer',
      description: 'Customer invoices',
    },
    subscriptions: {
      type: 'Subscription[]',
      backref: 'customer',
      description: 'Customer subscriptions',
    },
    charges: {
      type: 'Charge[]',
      description: 'Charges for this customer',
    },
    balanceTransactions: {
      type: 'BalanceTransaction[]',
      description: 'Balance transactions',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'list',
    'retrieve',
    'search',
    'createBalanceTransaction',
    'listBalanceTransactions',
    'updateBalance',
  ],

  events: [
    'customer.created',
    'customer.updated',
    'customer.deleted',
    'customer.balance.updated',
  ],
}

/**
 * Product entity
 *
 * Represents goods or services for sale
 */
export const Product: Noun = {
  singular: 'product',
  plural: 'products',
  description: 'Goods or services for sale',

  properties: {
    // Identity
    productId: {
      type: 'string',
      description: 'Unique product identifier',
    },
    name: {
      type: 'string',
      description: 'Product name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Product description',
    },

    // Status
    active: {
      type: 'boolean',
      description: 'Whether product is available for purchase',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Product type: service or good',
      examples: ['service', 'good'],
    },
    unitLabel: {
      type: 'string',
      optional: true,
      description: 'Unit label (e.g., "per seat", "per GB")',
    },

    // Display
    images: {
      type: 'url',
      array: true,
      optional: true,
      description: 'Product images',
    },
    url: {
      type: 'url',
      optional: true,
      description: 'Product URL',
    },

    // Features
    features: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Product features',
    },

    // Tax
    taxCode: {
      type: 'string',
      optional: true,
      description: 'Tax code for product',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the product was created',
    },
    updated: {
      type: 'datetime',
      optional: true,
      description: 'Time at which the product was last updated',
    },
  },

  relationships: {
    prices: {
      type: 'Price[]',
      backref: 'product',
      description: 'Prices for this product',
    },
    defaultPrice: {
      type: 'Price',
      required: false,
      description: 'Default price',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'list',
    'retrieve',
    'search',
  ],

  events: [
    'product.created',
    'product.updated',
    'product.deleted',
  ],
}

/**
 * Price entity
 *
 * Represents pricing configuration (one-time or recurring)
 */
export const Price: Noun = {
  singular: 'price',
  plural: 'prices',
  description: 'Pricing configuration for a product',

  properties: {
    // Identity
    priceId: {
      type: 'string',
      description: 'Unique price identifier',
    },
    nickname: {
      type: 'string',
      optional: true,
      description: 'Price nickname',
    },

    // Status
    active: {
      type: 'boolean',
      description: 'Whether price is available for new purchases',
    },

    // Type
    type: {
      type: 'string',
      description: 'Pricing type: one_time or recurring',
      examples: ['one_time', 'recurring'],
    },

    // Amount
    unitAmount: {
      type: 'number',
      optional: true,
      description: 'Unit price in cents',
    },
    unitAmountDecimal: {
      type: 'string',
      optional: true,
      description: 'Unit price as decimal string for precision',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Billing Scheme
    billingScheme: {
      type: 'string',
      optional: true,
      description: 'Billing scheme: per_unit or tiered',
      examples: ['per_unit', 'tiered'],
    },
    tiers: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Pricing tiers (for tiered billing)',
    },
    tiersMode: {
      type: 'string',
      optional: true,
      description: 'Tiers mode: graduated or volume',
      examples: ['graduated', 'volume'],
    },

    // Recurring Details
    recurring: {
      type: 'json',
      optional: true,
      description: 'Recurring pricing details (interval, interval_count, usage_type, aggregate_usage)',
    },

    // Transform Quantity
    transformQuantity: {
      type: 'json',
      optional: true,
      description: 'Transform quantity settings',
    },

    // Tax
    taxBehavior: {
      type: 'string',
      optional: true,
      description: 'Tax behavior: inclusive, exclusive, unspecified',
      examples: ['inclusive', 'exclusive', 'unspecified'],
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the price was created',
    },
  },

  relationships: {
    product: {
      type: 'Product',
      backref: 'prices',
      description: 'Product this price belongs to',
    },
  },

  actions: [
    'create',
    'update',
    'list',
    'retrieve',
    'search',
  ],

  events: [
    'price.created',
    'price.updated',
    'price.deleted',
  ],
}

// =============================================================================
// PAYMENTS
// =============================================================================

/**
 * PaymentMethod entity
 *
 * Represents a payment method (card, bank account, etc.)
 */
export const PaymentMethod: Noun = {
  singular: 'payment method',
  plural: 'payment methods',
  description: 'A payment method such as card or bank account',

  properties: {
    // Identity
    paymentMethodId: {
      type: 'string',
      description: 'Unique payment method identifier',
    },

    // Type
    type: {
      type: 'string',
      description: 'Payment method type: card, us_bank_account, sepa_debit, etc.',
      examples: ['card', 'us_bank_account', 'sepa_debit', 'acss_debit', 'alipay', 'wechat_pay'],
    },

    // Card Details
    card: {
      type: 'json',
      optional: true,
      description: 'Card details (brand, last4, exp_month, exp_year, etc.)',
    },

    // Bank Account Details
    usBankAccount: {
      type: 'json',
      optional: true,
      description: 'US bank account details',
    },
    sepaDebit: {
      type: 'json',
      optional: true,
      description: 'SEPA debit details',
    },

    // Billing Details
    billingDetails: {
      type: 'json',
      optional: true,
      description: 'Billing details (name, email, phone, address)',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the payment method was created',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer this payment method belongs to',
    },
  },

  actions: [
    'create',
    'update',
    'attach',
    'detach',
    'list',
    'retrieve',
  ],

  events: [
    'payment_method.attached',
    'payment_method.detached',
    'payment_method.updated',
    'payment_method.automatically_updated',
  ],
}

/**
 * PaymentIntent entity
 *
 * Represents an intent to collect payment
 */
export const PaymentIntent: Noun = {
  singular: 'payment intent',
  plural: 'payment intents',
  description: 'An intent to collect payment from a customer',

  properties: {
    // Identity
    paymentIntentId: {
      type: 'string',
      description: 'Unique payment intent identifier',
    },
    clientSecret: {
      type: 'string',
      optional: true,
      description: 'Client secret for completing payment',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Amount in cents',
    },
    amountCapturable: {
      type: 'number',
      optional: true,
      description: 'Amount capturable in cents',
    },
    amountReceived: {
      type: 'number',
      optional: true,
      description: 'Amount received in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: requires_payment_method, requires_confirmation, requires_action, processing, succeeded, canceled',
      examples: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled'],
    },
    cancellationReason: {
      type: 'string',
      optional: true,
      description: 'Cancellation reason',
    },

    // Capture
    captureMethod: {
      type: 'string',
      optional: true,
      description: 'Capture method: automatic or manual',
      examples: ['automatic', 'manual'],
    },

    // Confirmation
    confirmationMethod: {
      type: 'string',
      optional: true,
      description: 'Confirmation method: automatic or manual',
      examples: ['automatic', 'manual'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Description of payment',
    },
    statementDescriptor: {
      type: 'string',
      optional: true,
      description: 'Statement descriptor',
    },

    // Receipt
    receiptEmail: {
      type: 'string',
      optional: true,
      description: 'Email to send receipt to',
    },

    // Setup Future Usage
    setupFutureUsage: {
      type: 'string',
      optional: true,
      description: 'Setup for future usage: on_session or off_session',
      examples: ['on_session', 'off_session'],
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the payment intent was created',
    },
    canceledAt: {
      type: 'datetime',
      optional: true,
      description: 'Time at which the payment intent was canceled',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer making the payment',
    },
    paymentMethod: {
      type: 'PaymentMethod',
      required: false,
      description: 'Payment method used',
    },
    invoice: {
      type: 'Invoice',
      required: false,
      description: 'Invoice this payment is for',
    },
    charges: {
      type: 'Charge[]',
      description: 'Charges created by this payment intent',
    },
  },

  actions: [
    'create',
    'update',
    'confirm',
    'capture',
    'cancel',
    'list',
    'retrieve',
  ],

  events: [
    'payment_intent.created',
    'payment_intent.succeeded',
    'payment_intent.canceled',
    'payment_intent.processing',
    'payment_intent.payment_failed',
    'payment_intent.amount_capturable_updated',
  ],
}

/**
 * Charge entity
 *
 * Represents a charge attempt
 */
export const Charge: Noun = {
  singular: 'charge',
  plural: 'charges',
  description: 'A charge attempt on a payment source',

  properties: {
    // Identity
    chargeId: {
      type: 'string',
      description: 'Unique charge identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Amount charged in cents',
    },
    amountCaptured: {
      type: 'number',
      optional: true,
      description: 'Amount captured in cents',
    },
    amountRefunded: {
      type: 'number',
      optional: true,
      description: 'Amount refunded in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: succeeded, pending, failed',
      examples: ['succeeded', 'pending', 'failed'],
    },
    paid: {
      type: 'boolean',
      description: 'Whether charge was paid',
    },
    refunded: {
      type: 'boolean',
      optional: true,
      description: 'Whether charge was refunded',
    },
    captured: {
      type: 'boolean',
      optional: true,
      description: 'Whether charge was captured',
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Charge description',
    },
    statementDescriptor: {
      type: 'string',
      optional: true,
      description: 'Statement descriptor',
    },

    // Receipt
    receiptEmail: {
      type: 'string',
      optional: true,
      description: 'Email receipt was sent to',
    },
    receiptNumber: {
      type: 'string',
      optional: true,
      description: 'Receipt number',
    },
    receiptUrl: {
      type: 'url',
      optional: true,
      description: 'Receipt URL',
    },

    // Failure
    failureCode: {
      type: 'string',
      optional: true,
      description: 'Failure code',
    },
    failureMessage: {
      type: 'string',
      optional: true,
      description: 'Failure message',
    },

    // Payment Details
    paymentMethodDetails: {
      type: 'json',
      optional: true,
      description: 'Payment method details',
    },

    // Fraud Detection
    fraudDetails: {
      type: 'json',
      optional: true,
      description: 'Fraud detection details',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the charge was created',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer charged',
    },
    paymentIntent: {
      type: 'PaymentIntent',
      required: false,
      description: 'Payment intent that created this charge',
    },
    paymentMethod: {
      type: 'PaymentMethod',
      required: false,
      description: 'Payment method used',
    },
    invoice: {
      type: 'Invoice',
      required: false,
      description: 'Invoice this charge is for',
    },
    refunds: {
      type: 'Refund[]',
      backref: 'charge',
      description: 'Refunds for this charge',
    },
    balanceTransaction: {
      type: 'BalanceTransaction',
      required: false,
      description: 'Balance transaction',
    },
  },

  actions: [
    'create',
    'update',
    'capture',
    'list',
    'retrieve',
  ],

  events: [
    'charge.succeeded',
    'charge.failed',
    'charge.pending',
    'charge.captured',
    'charge.updated',
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.updated',
    'charge.dispute.closed',
  ],
}

/**
 * Refund entity
 *
 * Represents a refund of a charge
 */
export const Refund: Noun = {
  singular: 'refund',
  plural: 'refunds',
  description: 'A refund of a charge',

  properties: {
    // Identity
    refundId: {
      type: 'string',
      description: 'Unique refund identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Amount refunded in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Status: succeeded, failed, pending, canceled',
      examples: ['succeeded', 'failed', 'pending', 'canceled'],
    },

    // Reason
    reason: {
      type: 'string',
      optional: true,
      description: 'Reason: duplicate, fraudulent, requested_by_customer',
      examples: ['duplicate', 'fraudulent', 'requested_by_customer'],
    },

    // Receipt
    receiptNumber: {
      type: 'string',
      optional: true,
      description: 'Receipt number',
    },

    // Failure
    failureReason: {
      type: 'string',
      optional: true,
      description: 'Failure reason',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the refund was created',
    },
  },

  relationships: {
    charge: {
      type: 'Charge',
      backref: 'refunds',
      description: 'Charge that was refunded',
    },
    paymentIntent: {
      type: 'PaymentIntent',
      required: false,
      description: 'Payment intent that was refunded',
    },
    balanceTransaction: {
      type: 'BalanceTransaction',
      required: false,
      description: 'Balance transaction',
    },
  },

  actions: [
    'create',
    'update',
    'cancel',
    'list',
    'retrieve',
  ],

  events: [
    'charge.refund.updated',
  ],
}

// =============================================================================
// BILLING
// =============================================================================

/**
 * Invoice entity
 *
 * Represents a statement of amounts owed
 */
export const Invoice: Noun = {
  singular: 'invoice',
  plural: 'invoices',
  description: 'A statement of amounts owed by a customer',

  properties: {
    // Identity
    invoiceId: {
      type: 'string',
      description: 'Unique invoice identifier',
    },
    number: {
      type: 'string',
      optional: true,
      description: 'Invoice number',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Status: draft, open, paid, void, uncollectible',
      examples: ['draft', 'open', 'paid', 'void', 'uncollectible'],
    },

    // Amount
    amountDue: {
      type: 'number',
      optional: true,
      description: 'Amount due in cents',
    },
    amountPaid: {
      type: 'number',
      optional: true,
      description: 'Amount paid in cents',
    },
    amountRemaining: {
      type: 'number',
      optional: true,
      description: 'Amount remaining in cents',
    },
    subtotal: {
      type: 'number',
      optional: true,
      description: 'Subtotal before discounts and tax',
    },
    total: {
      type: 'number',
      optional: true,
      description: 'Total amount',
    },
    tax: {
      type: 'number',
      optional: true,
      description: 'Tax amount',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Invoice description',
    },
    footer: {
      type: 'string',
      optional: true,
      description: 'Invoice footer',
    },

    // Collection
    collectionMethod: {
      type: 'string',
      optional: true,
      description: 'Collection method: charge_automatically or send_invoice',
      examples: ['charge_automatically', 'send_invoice'],
    },
    attemptCount: {
      type: 'number',
      optional: true,
      description: 'Number of payment attempts',
    },
    attempted: {
      type: 'boolean',
      optional: true,
      description: 'Whether payment was attempted',
    },

    // Dates
    created: {
      type: 'datetime',
      description: 'Time at which the invoice was created',
    },
    dueDate: {
      type: 'datetime',
      optional: true,
      description: 'Date payment is due',
    },
    periodStart: {
      type: 'datetime',
      optional: true,
      description: 'Start of billing period',
    },
    periodEnd: {
      type: 'datetime',
      optional: true,
      description: 'End of billing period',
    },

    // Payment
    paid: {
      type: 'boolean',
      optional: true,
      description: 'Whether invoice has been paid',
    },
    paidAt: {
      type: 'datetime',
      optional: true,
      description: 'Time at which payment occurred',
    },

    // Invoice PDF
    invoicePdf: {
      type: 'url',
      optional: true,
      description: 'URL to invoice PDF',
    },
    hostedInvoiceUrl: {
      type: 'url',
      optional: true,
      description: 'URL to hosted invoice page',
    },

    // Auto Advance
    autoAdvance: {
      type: 'boolean',
      optional: true,
      description: 'Whether to auto-finalize draft after period end',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      backref: 'invoices',
      description: 'Customer being invoiced',
    },
    subscription: {
      type: 'Subscription',
      required: false,
      description: 'Subscription this invoice is for',
    },
    lines: {
      type: 'InvoiceLineItem[]',
      backref: 'invoice',
      description: 'Line items',
    },
    charge: {
      type: 'Charge',
      required: false,
      description: 'Latest charge for this invoice',
    },
    paymentIntent: {
      type: 'PaymentIntent',
      required: false,
      description: 'Payment intent for this invoice',
    },
    defaultPaymentMethod: {
      type: 'PaymentMethod',
      required: false,
      description: 'Default payment method',
    },
    quote: {
      type: 'Quote',
      required: false,
      description: 'Quote this invoice was created from',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'finalize',
    'pay',
    'send',
    'voidInvoice',
    'markUncollectible',
    'list',
    'retrieve',
    'upcomingInvoice',
  ],

  events: [
    'invoice.created',
    'invoice.updated',
    'invoice.deleted',
    'invoice.finalized',
    'invoice.paid',
    'invoice.payment_failed',
    'invoice.payment_action_required',
    'invoice.sent',
    'invoice.voided',
    'invoice.marked_uncollectible',
  ],
}

/**
 * InvoiceLineItem entity
 *
 * Represents a line item on an invoice
 */
export const InvoiceLineItem: Noun = {
  singular: 'invoice line item',
  plural: 'invoice line items',
  description: 'A line item on an invoice',

  properties: {
    // Identity
    lineItemId: {
      type: 'string',
      description: 'Unique line item identifier',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Type: invoiceitem or subscription',
      examples: ['invoiceitem', 'subscription'],
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Line item description',
    },

    // Quantity
    quantity: {
      type: 'number',
      optional: true,
      description: 'Quantity',
    },

    // Unit Amount
    unitAmount: {
      type: 'number',
      optional: true,
      description: 'Unit amount in cents',
    },
    unitAmountExcludingTax: {
      type: 'number',
      optional: true,
      description: 'Unit amount excluding tax',
    },

    // Period
    period: {
      type: 'json',
      optional: true,
      description: 'Period this line item covers',
    },

    // Proration
    proration: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a proration',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    invoice: {
      type: 'Invoice',
      backref: 'lines',
      description: 'Invoice this line item belongs to',
    },
    price: {
      type: 'Price',
      required: false,
      description: 'Price for this line item',
    },
    subscription: {
      type: 'Subscription',
      required: false,
      description: 'Subscription this line item is for',
    },
    subscriptionItem: {
      type: 'SubscriptionItem',
      required: false,
      description: 'Subscription item',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'list',
    'retrieve',
  ],

  events: [],
}

/**
 * Subscription entity
 *
 * Represents a recurring payment arrangement
 */
export const Subscription: Noun = {
  singular: 'subscription',
  plural: 'subscriptions',
  description: 'A recurring payment arrangement',

  properties: {
    // Identity
    subscriptionId: {
      type: 'string',
      description: 'Unique subscription identifier',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused',
      examples: ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'],
    },

    // Collection
    collectionMethod: {
      type: 'string',
      optional: true,
      description: 'Collection method: charge_automatically or send_invoice',
      examples: ['charge_automatically', 'send_invoice'],
    },

    // Billing
    billingCycleAnchor: {
      type: 'datetime',
      optional: true,
      description: 'Billing cycle anchor',
    },
    currentPeriodStart: {
      type: 'datetime',
      optional: true,
      description: 'Start of current period',
    },
    currentPeriodEnd: {
      type: 'datetime',
      optional: true,
      description: 'End of current period',
    },

    // Cancellation
    cancelAtPeriodEnd: {
      type: 'boolean',
      optional: true,
      description: 'Whether to cancel at period end',
    },
    canceledAt: {
      type: 'datetime',
      optional: true,
      description: 'Time subscription was canceled',
    },
    cancelAt: {
      type: 'datetime',
      optional: true,
      description: 'Time to cancel subscription',
    },

    // Trial
    trialStart: {
      type: 'datetime',
      optional: true,
      description: 'Start of trial period',
    },
    trialEnd: {
      type: 'datetime',
      optional: true,
      description: 'End of trial period',
    },

    // Dates
    created: {
      type: 'datetime',
      description: 'Time at which the subscription was created',
    },
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Subscription start date',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'Time subscription ended',
    },

    // Days Until Due
    daysUntilDue: {
      type: 'number',
      optional: true,
      description: 'Days until payment is due',
    },

    // Discount
    discount: {
      type: 'json',
      optional: true,
      description: 'Discount applied to subscription',
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Subscription description',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      backref: 'subscriptions',
      description: 'Customer subscribed',
    },
    items: {
      type: 'SubscriptionItem[]',
      backref: 'subscription',
      description: 'Subscription items',
    },
    defaultPaymentMethod: {
      type: 'PaymentMethod',
      required: false,
      description: 'Default payment method',
    },
    latestInvoice: {
      type: 'Invoice',
      required: false,
      description: 'Latest invoice',
    },
  },

  actions: [
    'create',
    'update',
    'cancel',
    'resume',
    'pause',
    'list',
    'retrieve',
    'search',
  ],

  events: [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
    'customer.subscription.trial_will_end',
  ],
}

/**
 * SubscriptionItem entity
 *
 * Represents an item in a subscription
 */
export const SubscriptionItem: Noun = {
  singular: 'subscription item',
  plural: 'subscription items',
  description: 'An item in a subscription',

  properties: {
    // Identity
    subscriptionItemId: {
      type: 'string',
      description: 'Unique subscription item identifier',
    },

    // Billing Thresholds
    billingThresholds: {
      type: 'json',
      optional: true,
      description: 'Billing thresholds',
    },

    // Quantity
    quantity: {
      type: 'number',
      optional: true,
      description: 'Quantity',
    },

    // Tax Rates
    taxRates: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Tax rates',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the subscription item was created',
    },
  },

  relationships: {
    subscription: {
      type: 'Subscription',
      backref: 'items',
      description: 'Subscription this item belongs to',
    },
    price: {
      type: 'Price',
      description: 'Price for this item',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'list',
    'retrieve',
  ],

  events: [],
}

/**
 * Quote entity
 *
 * Represents proposed pricing for a customer
 */
export const Quote: Noun = {
  singular: 'quote',
  plural: 'quotes',
  description: 'Proposed pricing for a customer',

  properties: {
    // Identity
    quoteId: {
      type: 'string',
      description: 'Unique quote identifier',
    },
    number: {
      type: 'string',
      optional: true,
      description: 'Quote number',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: draft, open, accepted, canceled',
      examples: ['draft', 'open', 'accepted', 'canceled'],
    },

    // Amount
    amountSubtotal: {
      type: 'number',
      optional: true,
      description: 'Subtotal amount in cents',
    },
    amountTotal: {
      type: 'number',
      optional: true,
      description: 'Total amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Quote description',
    },
    header: {
      type: 'string',
      optional: true,
      description: 'Quote header',
    },
    footer: {
      type: 'string',
      optional: true,
      description: 'Quote footer',
    },

    // Expiration
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'Quote expiration time',
    },

    // Collection
    collectionMethod: {
      type: 'string',
      optional: true,
      description: 'Collection method: charge_automatically or send_invoice',
      examples: ['charge_automatically', 'send_invoice'],
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the quote was created',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      description: 'Customer being quoted',
    },
    invoice: {
      type: 'Invoice',
      required: false,
      description: 'Invoice created from quote',
    },
    subscription: {
      type: 'Subscription',
      required: false,
      description: 'Subscription created from quote',
    },
  },

  actions: [
    'create',
    'update',
    'finalize',
    'accept',
    'cancel',
    'list',
    'retrieve',
    'pdf',
  ],

  events: [
    'quote.created',
    'quote.finalized',
    'quote.accepted',
    'quote.canceled',
  ],
}

// =============================================================================
// BALANCE
// =============================================================================

/**
 * Balance entity
 *
 * Represents the Stripe account balance
 */
export const Balance: Noun = {
  singular: 'balance',
  plural: 'balances',
  description: 'The balance of a Stripe account',

  properties: {
    // Available
    available: {
      type: 'json',
      array: true,
      description: 'Available balance by currency',
    },

    // Pending
    pending: {
      type: 'json',
      array: true,
      description: 'Pending balance by currency',
    },

    // Livemode
    livemode: {
      type: 'boolean',
      description: 'Whether in live mode',
    },
  },

  relationships: {},

  actions: [
    'retrieve',
  ],

  events: [],
}

/**
 * BalanceTransaction entity
 *
 * Represents a transaction affecting the account balance
 */
export const BalanceTransaction: Noun = {
  singular: 'balance transaction',
  plural: 'balance transactions',
  description: 'A transaction affecting the account balance',

  properties: {
    // Identity
    balanceTransactionId: {
      type: 'string',
      description: 'Unique balance transaction identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Gross amount in cents',
    },
    net: {
      type: 'number',
      description: 'Net amount in cents',
    },
    fee: {
      type: 'number',
      optional: true,
      description: 'Fee amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Type
    type: {
      type: 'string',
      description: 'Transaction type: charge, refund, adjustment, application_fee, etc.',
      examples: ['charge', 'refund', 'adjustment', 'application_fee', 'application_fee_refund', 'transfer', 'payment', 'payout'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Transaction description',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: available or pending',
      examples: ['available', 'pending'],
    },

    // Reporting Category
    reportingCategory: {
      type: 'string',
      optional: true,
      description: 'Reporting category',
    },

    // Fee Details
    feeDetails: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Breakdown of fees',
    },

    // Dates
    created: {
      type: 'datetime',
      description: 'Time at which the transaction was created',
    },
    availableOn: {
      type: 'datetime',
      optional: true,
      description: 'Time funds become available',
    },
  },

  relationships: {
    source: {
      type: 'json',
      required: false,
      description: 'Source object (Charge, Refund, Transfer, etc.)',
    },
  },

  actions: [
    'list',
    'retrieve',
  ],

  events: [],
}

// =============================================================================
// CONNECT (for platforms)
// =============================================================================

/**
 * Account entity (Stripe Connect)
 *
 * Represents a connected Stripe account
 */
export const Account: Noun = {
  singular: 'account',
  plural: 'accounts',
  description: 'A connected Stripe account',

  properties: {
    // Identity
    accountId: {
      type: 'string',
      description: 'Unique account identifier',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Account email',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Account type: standard, express, custom',
      examples: ['standard', 'express', 'custom'],
    },

    // Business
    businessType: {
      type: 'string',
      optional: true,
      description: 'Business type: individual, company, non_profit, government_entity',
      examples: ['individual', 'company', 'non_profit', 'government_entity'],
    },
    businessProfile: {
      type: 'json',
      optional: true,
      description: 'Business profile information',
    },
    company: {
      type: 'json',
      optional: true,
      description: 'Company information',
    },
    individual: {
      type: 'json',
      optional: true,
      description: 'Individual information',
    },

    // Capabilities
    capabilities: {
      type: 'json',
      optional: true,
      description: 'Account capabilities',
    },

    // Requirements
    requirements: {
      type: 'json',
      optional: true,
      description: 'Account requirements',
    },

    // Settings
    settings: {
      type: 'json',
      optional: true,
      description: 'Account settings',
    },

    // Charges
    chargesEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether charges are enabled',
    },
    payoutsEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether payouts are enabled',
    },
    detailsSubmitted: {
      type: 'boolean',
      optional: true,
      description: 'Whether account details have been submitted',
    },

    // Country
    country: {
      type: 'string',
      optional: true,
      description: 'Country code',
    },
    defaultCurrency: {
      type: 'string',
      optional: true,
      description: 'Default currency',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the account was created',
    },
  },

  relationships: {
    externalAccounts: {
      type: 'BankAccount[]',
      description: 'External accounts (bank accounts, cards)',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'reject',
    'list',
    'retrieve',
  ],

  events: [
    'account.updated',
    'account.application.authorized',
    'account.application.deauthorized',
    'account.external_account.created',
    'account.external_account.deleted',
    'account.external_account.updated',
  ],
}

/**
 * AccountLink entity
 *
 * Represents an onboarding link for a connected account
 */
export const AccountLink: Noun = {
  singular: 'account link',
  plural: 'account links',
  description: 'An onboarding link for a connected account',

  properties: {
    // URL
    url: {
      type: 'url',
      description: 'URL for account onboarding',
    },

    // Expiration
    expiresAt: {
      type: 'datetime',
      description: 'Time at which the link expires',
    },

    // Created
    created: {
      type: 'datetime',
      description: 'Time at which the link was created',
    },
  },

  relationships: {
    account: {
      type: 'Account',
      description: 'Account this link is for',
    },
  },

  actions: [
    'create',
  ],

  events: [],
}

/**
 * Transfer entity
 *
 * Represents a transfer to a connected account
 */
export const Transfer: Noun = {
  singular: 'transfer',
  plural: 'transfers',
  description: 'A transfer to a connected Stripe account',

  properties: {
    // Identity
    transferId: {
      type: 'string',
      description: 'Unique transfer identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Amount transferred in cents',
    },
    amountReversed: {
      type: 'number',
      optional: true,
      description: 'Amount reversed in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Transfer description',
    },

    // Status
    reversed: {
      type: 'boolean',
      optional: true,
      description: 'Whether transfer has been reversed',
    },

    // Source Transaction
    sourceType: {
      type: 'string',
      optional: true,
      description: 'Source type: card, bank_account, etc.',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the transfer was created',
    },
  },

  relationships: {
    destination: {
      type: 'Account',
      description: 'Destination account',
    },
    sourceTransaction: {
      type: 'Charge',
      required: false,
      description: 'Source transaction',
    },
    balanceTransaction: {
      type: 'BalanceTransaction',
      required: false,
      description: 'Balance transaction',
    },
    reversals: {
      type: 'json[]',
      description: 'Transfer reversals',
    },
  },

  actions: [
    'create',
    'update',
    'list',
    'retrieve',
    'reverse',
  ],

  events: [
    'transfer.created',
    'transfer.updated',
    'transfer.reversed',
  ],
}

/**
 * Payout entity
 *
 * Represents a payout to an external account
 */
export const Payout: Noun = {
  singular: 'payout',
  plural: 'payouts',
  description: 'A payout to an external bank account or debit card',

  properties: {
    // Identity
    payoutId: {
      type: 'string',
      description: 'Unique payout identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Amount paid out in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: pending, paid, failed, canceled',
      examples: ['pending', 'paid', 'failed', 'canceled'],
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Payout type: bank_account or card',
      examples: ['bank_account', 'card'],
    },
    method: {
      type: 'string',
      optional: true,
      description: 'Payout method: standard or instant',
      examples: ['standard', 'instant'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Payout description',
    },
    statementDescriptor: {
      type: 'string',
      optional: true,
      description: 'Statement descriptor',
    },

    // Failure
    failureCode: {
      type: 'string',
      optional: true,
      description: 'Failure code',
    },
    failureMessage: {
      type: 'string',
      optional: true,
      description: 'Failure message',
    },

    // Dates
    created: {
      type: 'datetime',
      description: 'Time at which the payout was created',
    },
    arrivalDate: {
      type: 'datetime',
      optional: true,
      description: 'Expected arrival date',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    destination: {
      type: 'BankAccount',
      required: false,
      description: 'Destination bank account',
    },
    balanceTransaction: {
      type: 'BalanceTransaction',
      required: false,
      description: 'Balance transaction',
    },
  },

  actions: [
    'create',
    'update',
    'cancel',
    'reverse',
    'list',
    'retrieve',
  ],

  events: [
    'payout.created',
    'payout.updated',
    'payout.canceled',
    'payout.failed',
    'payout.paid',
  ],
}

/**
 * ApplicationFee entity
 *
 * Represents a platform fee on a charge
 */
export const ApplicationFee: Noun = {
  singular: 'application fee',
  plural: 'application fees',
  description: 'A platform fee collected on a charge',

  properties: {
    // Identity
    applicationFeeId: {
      type: 'string',
      description: 'Unique application fee identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Fee amount in cents',
    },
    amountRefunded: {
      type: 'number',
      optional: true,
      description: 'Amount refunded in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    refunded: {
      type: 'boolean',
      optional: true,
      description: 'Whether fee has been refunded',
    },

    // Livemode
    livemode: {
      type: 'boolean',
      description: 'Whether in live mode',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the fee was created',
    },
  },

  relationships: {
    charge: {
      type: 'Charge',
      description: 'Charge this fee was collected on',
    },
    account: {
      type: 'Account',
      description: 'Connected account',
    },
    balanceTransaction: {
      type: 'BalanceTransaction',
      required: false,
      description: 'Balance transaction',
    },
  },

  actions: [
    'list',
    'retrieve',
    'refund',
  ],

  events: [
    'application_fee.created',
    'application_fee.refunded',
  ],
}

// =============================================================================
// TREASURY (embedded banking)
// =============================================================================

/**
 * FinancialAccount entity (Treasury)
 *
 * Represents a Treasury financial account
 */
export const FinancialAccount: Noun = {
  singular: 'financial account',
  plural: 'financial accounts',
  description: 'A Treasury financial account for embedded banking',

  properties: {
    // Identity
    financialAccountId: {
      type: 'string',
      description: 'Unique financial account identifier',
    },

    // Balance
    balance: {
      type: 'json',
      description: 'Account balance',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: open or closed',
      examples: ['open', 'closed'],
    },

    // Supported Currencies
    supportedCurrencies: {
      type: 'string',
      array: true,
      description: 'Supported currencies',
    },

    // Features
    features: {
      type: 'json',
      optional: true,
      description: 'Enabled features',
    },

    // Financial Addresses
    financialAddresses: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Financial addresses (e.g., ACH routing info)',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the account was created',
    },
  },

  relationships: {},

  actions: [
    'create',
    'update',
    'retrieve',
    'list',
  ],

  events: [
    'treasury.financial_account.created',
    'treasury.financial_account.closed',
    'treasury.financial_account.features_status_updated',
  ],
}

/**
 * TreasuryTransaction entity
 *
 * Represents a transaction in a Treasury financial account
 */
export const TreasuryTransaction: Noun = {
  singular: 'treasury transaction',
  plural: 'treasury transactions',
  description: 'A transaction in a Treasury financial account',

  properties: {
    // Identity
    treasuryTransactionId: {
      type: 'string',
      description: 'Unique transaction identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Transaction amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Transaction description',
    },

    // Flow
    flowType: {
      type: 'string',
      description: 'Flow type: inbound_transfer, outbound_transfer, outbound_payment, received_credit, received_debit',
      examples: ['inbound_transfer', 'outbound_transfer', 'outbound_payment', 'received_credit', 'received_debit'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: open, posted, void',
      examples: ['open', 'posted', 'void'],
    },

    // Balance Impact
    balanceImpact: {
      type: 'json',
      optional: true,
      description: 'Impact on balance',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the transaction was created',
    },
  },

  relationships: {
    financialAccount: {
      type: 'FinancialAccount',
      description: 'Financial account',
    },
    flowDetails: {
      type: 'json',
      required: false,
      description: 'Details about the flow',
    },
  },

  actions: [
    'list',
    'retrieve',
  ],

  events: [
    'treasury.transaction_entry.created',
  ],
}

/**
 * InboundTransfer entity (Treasury)
 *
 * Represents a transfer into a Treasury financial account
 */
export const InboundTransfer: Noun = {
  singular: 'inbound transfer',
  plural: 'inbound transfers',
  description: 'A transfer into a Treasury financial account',

  properties: {
    // Identity
    inboundTransferId: {
      type: 'string',
      description: 'Unique inbound transfer identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Transfer amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Transfer description',
    },

    // Origin
    originPaymentMethod: {
      type: 'string',
      optional: true,
      description: 'Origin payment method',
    },
    originPaymentMethodDetails: {
      type: 'json',
      optional: true,
      description: 'Origin payment method details',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: processing, succeeded, failed, canceled',
      examples: ['processing', 'succeeded', 'failed', 'canceled'],
    },

    // Failure
    failureDetails: {
      type: 'json',
      optional: true,
      description: 'Failure details',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the transfer was created',
    },
  },

  relationships: {
    financialAccount: {
      type: 'FinancialAccount',
      description: 'Destination financial account',
    },
  },

  actions: [
    'create',
    'cancel',
    'list',
    'retrieve',
  ],

  events: [
    'treasury.inbound_transfer.created',
    'treasury.inbound_transfer.succeeded',
    'treasury.inbound_transfer.failed',
    'treasury.inbound_transfer.canceled',
  ],
}

/**
 * OutboundTransfer entity (Treasury)
 *
 * Represents a transfer out of a Treasury financial account
 */
export const OutboundTransfer: Noun = {
  singular: 'outbound transfer',
  plural: 'outbound transfers',
  description: 'A transfer out of a Treasury financial account',

  properties: {
    // Identity
    outboundTransferId: {
      type: 'string',
      description: 'Unique outbound transfer identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Transfer amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Transfer description',
    },
    statementDescriptor: {
      type: 'string',
      optional: true,
      description: 'Statement descriptor',
    },

    // Destination
    destinationPaymentMethod: {
      type: 'string',
      optional: true,
      description: 'Destination payment method',
    },
    destinationPaymentMethodDetails: {
      type: 'json',
      optional: true,
      description: 'Destination payment method details',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: processing, posted, failed, canceled, returned',
      examples: ['processing', 'posted', 'failed', 'canceled', 'returned'],
    },

    // Expected Arrival
    expectedArrivalDate: {
      type: 'datetime',
      optional: true,
      description: 'Expected arrival date',
    },

    // Return Details
    returnedDetails: {
      type: 'json',
      optional: true,
      description: 'Return details if returned',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the transfer was created',
    },
  },

  relationships: {
    financialAccount: {
      type: 'FinancialAccount',
      description: 'Source financial account',
    },
  },

  actions: [
    'create',
    'cancel',
    'list',
    'retrieve',
  ],

  events: [
    'treasury.outbound_transfer.created',
    'treasury.outbound_transfer.posted',
    'treasury.outbound_transfer.failed',
    'treasury.outbound_transfer.canceled',
    'treasury.outbound_transfer.returned',
  ],
}

/**
 * OutboundPayment entity (Treasury)
 *
 * Represents a payment from a Treasury financial account
 */
export const OutboundPayment: Noun = {
  singular: 'outbound payment',
  plural: 'outbound payments',
  description: 'A payment from a Treasury financial account',

  properties: {
    // Identity
    outboundPaymentId: {
      type: 'string',
      description: 'Unique outbound payment identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Payment amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Payment description',
    },
    statementDescriptor: {
      type: 'string',
      optional: true,
      description: 'Statement descriptor',
    },

    // Destination
    destinationPaymentMethod: {
      type: 'string',
      optional: true,
      description: 'Destination payment method',
    },
    destinationPaymentMethodDetails: {
      type: 'json',
      optional: true,
      description: 'Destination payment method details',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: processing, posted, failed, canceled, returned',
      examples: ['processing', 'posted', 'failed', 'canceled', 'returned'],
    },

    // End User Details
    endUserDetails: {
      type: 'json',
      optional: true,
      description: 'End user details',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the payment was created',
    },
  },

  relationships: {
    financialAccount: {
      type: 'FinancialAccount',
      description: 'Source financial account',
    },
  },

  actions: [
    'create',
    'cancel',
    'list',
    'retrieve',
  ],

  events: [
    'treasury.outbound_payment.created',
    'treasury.outbound_payment.posted',
    'treasury.outbound_payment.failed',
    'treasury.outbound_payment.canceled',
    'treasury.outbound_payment.returned',
  ],
}

/**
 * ReceivedCredit entity (Treasury)
 *
 * Represents a credit received into a Treasury financial account
 */
export const ReceivedCredit: Noun = {
  singular: 'received credit',
  plural: 'received credits',
  description: 'A credit received into a Treasury financial account',

  properties: {
    // Identity
    receivedCreditId: {
      type: 'string',
      description: 'Unique received credit identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Credit amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Credit description',
    },

    // Network
    network: {
      type: 'string',
      description: 'Network: ach, us_domestic_wire',
      examples: ['ach', 'us_domestic_wire'],
    },

    // Initiating Payment Method Details
    initiatingPaymentMethodDetails: {
      type: 'json',
      optional: true,
      description: 'Initiating payment method details',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: succeeded or failed',
      examples: ['succeeded', 'failed'],
    },

    // Failure Code
    failureCode: {
      type: 'string',
      optional: true,
      description: 'Failure code',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the credit was received',
    },
  },

  relationships: {
    financialAccount: {
      type: 'FinancialAccount',
      description: 'Financial account',
    },
  },

  actions: [
    'list',
    'retrieve',
  ],

  events: [
    'treasury.received_credit.created',
    'treasury.received_credit.succeeded',
    'treasury.received_credit.failed',
  ],
}

/**
 * ReceivedDebit entity (Treasury)
 *
 * Represents a debit received from a Treasury financial account
 */
export const ReceivedDebit: Noun = {
  singular: 'received debit',
  plural: 'received debits',
  description: 'A debit received from a Treasury financial account',

  properties: {
    // Identity
    receivedDebitId: {
      type: 'string',
      description: 'Unique received debit identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Debit amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Debit description',
    },

    // Network
    network: {
      type: 'string',
      description: 'Network: ach',
      examples: ['ach'],
    },

    // Initiating Payment Method Details
    initiatingPaymentMethodDetails: {
      type: 'json',
      optional: true,
      description: 'Initiating payment method details',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: succeeded or failed',
      examples: ['succeeded', 'failed'],
    },

    // Failure Code
    failureCode: {
      type: 'string',
      optional: true,
      description: 'Failure code',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the debit was received',
    },
  },

  relationships: {
    financialAccount: {
      type: 'FinancialAccount',
      description: 'Financial account',
    },
  },

  actions: [
    'list',
    'retrieve',
  ],

  events: [
    'treasury.received_debit.created',
  ],
}

// =============================================================================
// ISSUING (cards)
// =============================================================================

/**
 * IssuingCard entity
 *
 * Represents an issued payment card
 */
export const IssuingCard: Noun = {
  singular: 'issuing card',
  plural: 'issuing cards',
  description: 'An issued physical or virtual payment card',

  properties: {
    // Identity
    issuingCardId: {
      type: 'string',
      description: 'Unique card identifier',
    },
    last4: {
      type: 'string',
      optional: true,
      description: 'Last 4 digits of card number',
    },

    // Brand
    brand: {
      type: 'string',
      description: 'Card brand: visa or mastercard',
      examples: ['visa', 'mastercard'],
    },

    // Type
    type: {
      type: 'string',
      description: 'Card type: physical or virtual',
      examples: ['physical', 'virtual'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: active, inactive, canceled',
      examples: ['active', 'inactive', 'canceled'],
    },

    // Cancellation
    cancellationReason: {
      type: 'string',
      optional: true,
      description: 'Cancellation reason',
    },

    // Spending Controls
    spendingControls: {
      type: 'json',
      optional: true,
      description: 'Spending controls and limits',
    },

    // Shipping
    shipping: {
      type: 'json',
      optional: true,
      description: 'Shipping information (for physical cards)',
    },

    // Expiration
    expMonth: {
      type: 'number',
      optional: true,
      description: 'Expiration month',
    },
    expYear: {
      type: 'number',
      optional: true,
      description: 'Expiration year',
    },

    // Currency
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the card was created',
    },
  },

  relationships: {
    cardholder: {
      type: 'IssuingCardholder',
      description: 'Cardholder',
    },
    replacementFor: {
      type: 'IssuingCard',
      required: false,
      description: 'Card being replaced',
    },
    replacedBy: {
      type: 'IssuingCard',
      required: false,
      description: 'Replacement card',
    },
  },

  actions: [
    'create',
    'update',
    'cancel',
    'list',
    'retrieve',
  ],

  events: [
    'issuing_card.created',
    'issuing_card.updated',
  ],
}

/**
 * IssuingCardholder entity
 *
 * Represents a cardholder
 */
export const IssuingCardholder: Noun = {
  singular: 'issuing cardholder',
  plural: 'issuing cardholders',
  description: 'A cardholder for issued cards',

  properties: {
    // Identity
    issuingCardholderId: {
      type: 'string',
      description: 'Unique cardholder identifier',
    },
    name: {
      type: 'string',
      description: 'Cardholder name',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Cardholder email',
    },
    phoneNumber: {
      type: 'string',
      optional: true,
      description: 'Cardholder phone number',
    },

    // Type
    type: {
      type: 'string',
      description: 'Cardholder type: individual or company',
      examples: ['individual', 'company'],
    },

    // Billing
    billing: {
      type: 'json',
      description: 'Billing information',
    },

    // Company
    company: {
      type: 'json',
      optional: true,
      description: 'Company information (for company type)',
    },

    // Individual
    individual: {
      type: 'json',
      optional: true,
      description: 'Individual information (for individual type)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: active, inactive, blocked',
      examples: ['active', 'inactive', 'blocked'],
    },

    // Spending Controls
    spendingControls: {
      type: 'json',
      optional: true,
      description: 'Default spending controls',
    },

    // Requirements
    requirements: {
      type: 'json',
      optional: true,
      description: 'Verification requirements',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the cardholder was created',
    },
  },

  relationships: {
    cards: {
      type: 'IssuingCard[]',
      backref: 'cardholder',
      description: 'Cards issued to this cardholder',
    },
  },

  actions: [
    'create',
    'update',
    'list',
    'retrieve',
  ],

  events: [
    'issuing_cardholder.created',
    'issuing_cardholder.updated',
  ],
}

/**
 * IssuingAuthorization entity
 *
 * Represents a card authorization attempt
 */
export const IssuingAuthorization: Noun = {
  singular: 'issuing authorization',
  plural: 'issuing authorizations',
  description: 'A card authorization attempt',

  properties: {
    // Identity
    issuingAuthorizationId: {
      type: 'string',
      description: 'Unique authorization identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Authorization amount in cents',
    },
    amountDetails: {
      type: 'json',
      optional: true,
      description: 'Amount details (atm_fee, cashback, etc.)',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: pending, reversed, closed',
      examples: ['pending', 'reversed', 'closed'],
    },
    approved: {
      type: 'boolean',
      description: 'Whether authorization was approved',
    },

    // Merchant
    merchantAmount: {
      type: 'number',
      optional: true,
      description: 'Merchant amount in merchant currency',
    },
    merchantCurrency: {
      type: 'string',
      optional: true,
      description: 'Merchant currency',
    },
    merchantData: {
      type: 'json',
      optional: true,
      description: 'Merchant data',
    },

    // Verification Data
    verificationData: {
      type: 'json',
      optional: true,
      description: 'Verification data',
    },

    // Request History
    requestHistory: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Request history',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the authorization was created',
    },
  },

  relationships: {
    card: {
      type: 'IssuingCard',
      description: 'Card used',
    },
    cardholder: {
      type: 'IssuingCardholder',
      required: false,
      description: 'Cardholder',
    },
    transactions: {
      type: 'IssuingTransaction[]',
      description: 'Transactions created from this authorization',
    },
  },

  actions: [
    'approve',
    'decline',
    'list',
    'retrieve',
    'update',
  ],

  events: [
    'issuing_authorization.created',
    'issuing_authorization.updated',
    'issuing_authorization.request',
  ],
}

/**
 * IssuingTransaction entity
 *
 * Represents a completed card transaction
 */
export const IssuingTransaction: Noun = {
  singular: 'issuing transaction',
  plural: 'issuing transactions',
  description: 'A completed card transaction',

  properties: {
    // Identity
    issuingTransactionId: {
      type: 'string',
      description: 'Unique transaction identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Transaction amount in cents',
    },
    amountDetails: {
      type: 'json',
      optional: true,
      description: 'Amount details',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Type
    type: {
      type: 'string',
      description: 'Transaction type: capture or refund',
      examples: ['capture', 'refund'],
    },

    // Merchant
    merchantAmount: {
      type: 'number',
      optional: true,
      description: 'Merchant amount',
    },
    merchantCurrency: {
      type: 'string',
      optional: true,
      description: 'Merchant currency',
    },
    merchantData: {
      type: 'json',
      optional: true,
      description: 'Merchant data',
    },

    // Purchase Details
    purchaseDetails: {
      type: 'json',
      optional: true,
      description: 'Purchase details',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the transaction was created',
    },
  },

  relationships: {
    card: {
      type: 'IssuingCard',
      description: 'Card used',
    },
    cardholder: {
      type: 'IssuingCardholder',
      required: false,
      description: 'Cardholder',
    },
    authorization: {
      type: 'IssuingAuthorization',
      required: false,
      description: 'Authorization',
    },
    dispute: {
      type: 'IssuingDispute',
      required: false,
      description: 'Dispute if disputed',
    },
  },

  actions: [
    'list',
    'retrieve',
    'update',
  ],

  events: [
    'issuing_transaction.created',
    'issuing_transaction.updated',
  ],
}

/**
 * IssuingDispute entity
 *
 * Represents a dispute on a card transaction
 */
export const IssuingDispute: Noun = {
  singular: 'issuing dispute',
  plural: 'issuing disputes',
  description: 'A dispute on a card transaction',

  properties: {
    // Identity
    issuingDisputeId: {
      type: 'string',
      description: 'Unique dispute identifier',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Disputed amount in cents',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: unsubmitted, submitted, won, lost, expired',
      examples: ['unsubmitted', 'submitted', 'won', 'lost', 'expired'],
    },

    // Evidence
    evidence: {
      type: 'json',
      optional: true,
      description: 'Evidence for dispute',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the dispute was created',
    },
  },

  relationships: {
    transaction: {
      type: 'IssuingTransaction',
      description: 'Transaction being disputed',
    },
  },

  actions: [
    'create',
    'submit',
    'list',
    'retrieve',
    'update',
  ],

  events: [
    'issuing_dispute.created',
    'issuing_dispute.updated',
    'issuing_dispute.closed',
    'issuing_dispute.funds_reinstated',
  ],
}

// =============================================================================
// BANK
// =============================================================================

/**
 * BankAccount entity
 *
 * Represents an external bank account
 */
export const BankAccount: Noun = {
  singular: 'bank account',
  plural: 'bank accounts',
  description: 'An external bank account',

  properties: {
    // Identity
    bankAccountId: {
      type: 'string',
      description: 'Unique bank account identifier',
    },
    accountHolderName: {
      type: 'string',
      optional: true,
      description: 'Account holder name',
    },
    accountHolderType: {
      type: 'string',
      optional: true,
      description: 'Account holder type: individual or company',
      examples: ['individual', 'company'],
    },

    // Bank Details
    bankName: {
      type: 'string',
      optional: true,
      description: 'Bank name',
    },
    country: {
      type: 'string',
      description: 'Country code',
    },
    currency: {
      type: 'string',
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'JPY'],
    },

    // Account Number
    last4: {
      type: 'string',
      optional: true,
      description: 'Last 4 digits of account number',
    },
    routingNumber: {
      type: 'string',
      optional: true,
      description: 'Routing number',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Status: new, validated, verified, verification_failed, errored',
      examples: ['new', 'validated', 'verified', 'verification_failed', 'errored'],
    },

    // Fingerprint
    fingerprint: {
      type: 'string',
      optional: true,
      description: 'Unique fingerprint',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer this bank account belongs to',
    },
    account: {
      type: 'Account',
      required: false,
      description: 'Connected account this bank account belongs to',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'verify',
    'list',
    'retrieve',
  ],

  events: [],
}

// =============================================================================
// WEBHOOKS
// =============================================================================

/**
 * WebhookEndpoint entity
 *
 * Represents a webhook endpoint configuration
 */
export const WebhookEndpoint: Noun = {
  singular: 'webhook endpoint',
  plural: 'webhook endpoints',
  description: 'A webhook endpoint for receiving events',

  properties: {
    // Identity
    webhookEndpointId: {
      type: 'string',
      description: 'Unique webhook endpoint identifier',
    },

    // URL
    url: {
      type: 'url',
      description: 'Webhook URL',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Status: enabled or disabled',
      examples: ['enabled', 'disabled'],
    },

    // Events
    enabledEvents: {
      type: 'string',
      array: true,
      description: 'Events to send to this endpoint',
    },

    // API Version
    apiVersion: {
      type: 'string',
      optional: true,
      description: 'API version',
    },

    // Description
    description: {
      type: 'string',
      optional: true,
      description: 'Endpoint description',
    },

    // Secret
    secret: {
      type: 'string',
      optional: true,
      description: 'Webhook signing secret',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the endpoint was created',
    },
  },

  relationships: {},

  actions: [
    'create',
    'update',
    'delete',
    'list',
    'retrieve',
  ],

  events: [],
}

/**
 * Event entity
 *
 * Represents a Stripe event
 */
export const Event: Noun = {
  singular: 'event',
  plural: 'events',
  description: 'A Stripe API event',

  properties: {
    // Identity
    eventId: {
      type: 'string',
      description: 'Unique event identifier',
    },

    // Type
    type: {
      type: 'string',
      description: 'Event type (e.g., customer.created, charge.succeeded)',
    },

    // Data
    data: {
      type: 'json',
      description: 'Event data',
    },

    // API Version
    apiVersion: {
      type: 'string',
      optional: true,
      description: 'API version',
    },

    // Request
    request: {
      type: 'json',
      optional: true,
      description: 'Request information',
    },

    // Pending Webhooks
    pendingWebhooks: {
      type: 'number',
      optional: true,
      description: 'Number of pending webhooks',
    },

    // Livemode
    livemode: {
      type: 'boolean',
      description: 'Whether in live mode',
    },

    // Timestamps
    created: {
      type: 'datetime',
      description: 'Time at which the event was created',
    },
  },

  relationships: {},

  actions: [
    'list',
    'retrieve',
  ],

  events: [],
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * All finance entity types
 */
export const FinanceEntities = {
  // Core
  Customer,
  Product,
  Price,

  // Payments
  PaymentMethod,
  PaymentIntent,
  Charge,
  Refund,

  // Billing
  Invoice,
  InvoiceLineItem,
  Subscription,
  SubscriptionItem,
  Quote,

  // Balance
  Balance,
  BalanceTransaction,

  // Connect
  Account,
  AccountLink,
  Transfer,
  Payout,
  ApplicationFee,

  // Treasury
  FinancialAccount,
  TreasuryTransaction,
  InboundTransfer,
  OutboundTransfer,
  OutboundPayment,
  ReceivedCredit,
  ReceivedDebit,

  // Issuing
  IssuingCard,
  IssuingCardholder,
  IssuingAuthorization,
  IssuingTransaction,
  IssuingDispute,

  // Bank
  BankAccount,

  // Webhooks
  WebhookEndpoint,
  Event,
}

/**
 * Entity categories for organization
 */
export const FinanceCategories = {
  core: ['Customer', 'Product', 'Price'],
  payments: ['PaymentMethod', 'PaymentIntent', 'Charge', 'Refund'],
  billing: ['Invoice', 'InvoiceLineItem', 'Subscription', 'SubscriptionItem', 'Quote'],
  balance: ['Balance', 'BalanceTransaction'],
  connect: ['Account', 'AccountLink', 'Transfer', 'Payout', 'ApplicationFee'],
  treasury: [
    'FinancialAccount',
    'TreasuryTransaction',
    'InboundTransfer',
    'OutboundTransfer',
    'OutboundPayment',
    'ReceivedCredit',
    'ReceivedDebit',
  ],
  issuing: [
    'IssuingCard',
    'IssuingCardholder',
    'IssuingAuthorization',
    'IssuingTransaction',
    'IssuingDispute',
  ],
  bank: ['BankAccount'],
  webhooks: ['WebhookEndpoint', 'Event'],
} as const
