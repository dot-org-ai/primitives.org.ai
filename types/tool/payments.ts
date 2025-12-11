/**
 * Payments Tool Types
 *
 * Types for payment processing integrations:
 * Payment, Invoice, Customer, Subscription.
 *
 * @module tool/payments
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
} from '@/core/rpc'

import type { PaymentMethodType } from '@/core/entities'

// Re-export core types for payments contexts
export type {
  Customer,
  CustomerInput,
  CustomerOutput,
  CustomerStatus,
  CustomerType,
  CustomerActions,
  CustomerEvents,
  CustomerResource,
  Subscription,
  SubscriptionInput,
  SubscriptionOutput,
  SubscriptionStatus,
  SubscriptionItem,
  SubscriptionDiscount,
  SubscriptionPause,
  BillingInterval,
  SubscriptionActions,
  SubscriptionEvents,
  SubscriptionResource,
  PaymentMethod,
  PaymentMethodType,
  Address,
} from '@/core/entities'

// =============================================================================
// Payment
// =============================================================================

/**
 * Payment status.
 */
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'

// PaymentMethodType is re-exported from core/entities

/**
 * One-time charge against a payment method.
 *
 * @example
 * ```ts
 * const payment: Payment = {
 *   id: 'pay_123',
 *   amount: 9999,
 *   currency: 'usd',
 *   status: 'succeeded',
 *   customerId: 'cus_123',
 *   paymentMethod: {
 *     type: 'card',
 *     brand: 'visa',
 *     last4: '4242'
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Payment {
  /** Unique identifier */
  id: string

  /** Amount in smallest currency unit (e.g., cents) */
  amount: number

  /** Currency code (lowercase) */
  currency: string

  /** Payment status */
  status: PaymentStatus

  /** Customer ID */
  customerId?: string

  /** Payment method details */
  paymentMethod?: {
    id?: string
    type: PaymentMethodType
    brand?: string
    last4?: string
    bankName?: string
    expiryMonth?: number
    expiryYear?: number
  }

  /** Payment description */
  description?: string

  /** Statement descriptor */
  statementDescriptor?: string

  /** Related invoice ID */
  invoiceId?: string

  /** Related subscription ID */
  subscriptionId?: string

  /** Receipt URL */
  receiptUrl?: string

  /** Failure reason */
  failureReason?: string

  /** Failure code */
  failureCode?: string

  /** Refund amount (if partially or fully refunded) */
  refundedAmount?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External provider ID */
  externalId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PaymentInput = Input<Payment>
export type PaymentOutput = Output<Payment>

// =============================================================================
// Invoice
// =============================================================================

/**
 * Invoice status.
 */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'

/**
 * Invoice line item.
 */
export interface InvoiceLineItem {
  id?: string
  description: string
  quantity: number
  unitAmount?: number
  amount: number
  productId?: string
  priceId?: string
}

/**
 * Bill sent to customer for payment.
 *
 * @example
 * ```ts
 * const invoice: Invoice = {
 *   id: 'inv_123',
 *   number: 'INV-2024-001',
 *   customerId: 'cus_123',
 *   status: 'open',
 *   total: 9999,
 *   currency: 'usd',
 *   dueDate: new Date('2024-02-15'),
 *   lineItems: [
 *     { description: 'Pro Plan - Monthly', quantity: 1, amount: 9999 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Invoice {
  /** Unique identifier */
  id: string

  /** Invoice number */
  number?: string

  /** Customer ID */
  customerId: string

  /** Invoice status */
  status: InvoiceStatus

  /** Subtotal before tax/discounts */
  subtotal: number

  /** Tax amount */
  tax?: number

  /** Discount amount */
  discount?: number

  /** Total amount */
  total: number

  /** Amount paid */
  amountPaid?: number

  /** Amount due */
  amountDue?: number

  /** Currency code */
  currency: string

  /** Line items */
  lineItems: InvoiceLineItem[]

  /** Due date */
  dueDate?: Date

  /** Period start */
  periodStart?: Date

  /** Period end */
  periodEnd?: Date

  /** Related subscription ID */
  subscriptionId?: string

  /** Payment intent/ID */
  paymentId?: string

  /** Invoice PDF URL */
  pdfUrl?: string

  /** Hosted invoice URL */
  hostedUrl?: string

  /** Collection method */
  collectionMethod?: 'charge_automatically' | 'send_invoice'

  /** Memo/notes */
  memo?: string

  /** Footer text */
  footer?: string

  /** Billing address */
  billingAddress?: {
    name?: string
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External provider ID */
  externalId?: string

  /** Paid timestamp */
  paidAt?: Date

  /** Voided timestamp */
  voidedAt?: Date

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InvoiceInput = Input<Invoice>
export type InvoiceOutput = Output<Invoice>

// =============================================================================
// Customer - Re-exported from core/entities
// =============================================================================
// See ../core/entities.js for the universal Customer type
// Customer, CustomerInput, CustomerOutput, CustomerActions, CustomerEvents,
// CustomerResource are all re-exported from core/entities above

// =============================================================================
// Subscription - Re-exported from core/entities
// =============================================================================
// See ../core/entities.js for the universal Subscription type
// Subscription, SubscriptionInput, SubscriptionOutput, SubscriptionStatus,
// SubscriptionItem, SubscriptionDiscount, SubscriptionPause, BillingInterval,
// SubscriptionActions, SubscriptionEvents, SubscriptionResource are all
// re-exported from core/entities above

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface PaymentActions extends CRUDResource<Payment, PaymentInput> {
  /** Create a payment intent */
  createIntent: Action<{ amount: number; currency: string; customerId?: string; metadata?: Record<string, unknown> }, Payment>

  /** Confirm a payment */
  confirm: Action<{ id: string; paymentMethodId?: string }, Payment>

  /** Cancel a payment */
  cancel: Action<{ id: string; reason?: string }, Payment>

  /** Capture a payment (for auth-only payments) */
  capture: Action<{ id: string; amount?: number }, Payment>

  /** Refund a payment */
  refund: Action<{ id: string; amount?: number; reason?: string }, Refund>

  /** Get payment by external ID */
  getByExternalId: Action<{ externalId: string }, Payment>
}

export interface InvoiceActions extends CRUDResource<Invoice, InvoiceInput> {
  /** Finalize a draft invoice */
  finalize: Action<{ id: string }, Invoice>

  /** Send invoice to customer */
  send: Action<{ id: string }, Invoice>

  /** Pay invoice */
  pay: Action<{ id: string; paymentMethodId?: string }, Invoice>

  /** Void invoice */
  void: Action<{ id: string }, Invoice>

  /** Mark as uncollectible */
  markUncollectible: Action<{ id: string }, Invoice>

  /** Add line item */
  addLineItem: Action<{ id: string; lineItem: InvoiceLineItem }, Invoice>

  /** Remove line item */
  removeLineItem: Action<{ id: string; lineItemId: string }, Invoice>

  /** Get PDF */
  getPdf: Action<{ id: string }, { url: string }>

  /** Get upcoming invoice preview */
  getUpcoming: Action<{ customerId: string; subscriptionId?: string }, Invoice>
}

// CustomerActions is re-exported from core/entities

// SubscriptionActions is re-exported from core/entities

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Refund record.
 */
export interface Refund {
  id: string
  paymentId: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other'
  failureReason?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

// =============================================================================
// Events
// =============================================================================

export interface PaymentEvents {
  created: BaseEvent<'payment.created', Payment>
  updated: BaseEvent<'payment.updated', Payment>
  succeeded: BaseEvent<'payment.succeeded', Payment>
  failed: BaseEvent<'payment.failed', { paymentId: string; reason: string; code?: string }>
  cancelled: BaseEvent<'payment.cancelled', { paymentId: string; reason?: string }>
  refunded: BaseEvent<'payment.refunded', { paymentId: string; refund: Refund }>
  captured: BaseEvent<'payment.captured', Payment>
}

export interface InvoiceEvents {
  created: BaseEvent<'invoice.created', Invoice>
  updated: BaseEvent<'invoice.updated', Invoice>
  finalized: BaseEvent<'invoice.finalized', Invoice>
  sent: BaseEvent<'invoice.sent', Invoice>
  paid: BaseEvent<'invoice.paid', Invoice>
  voided: BaseEvent<'invoice.voided', { invoiceId: string }>
  marked_uncollectible: BaseEvent<'invoice.marked_uncollectible', { invoiceId: string }>
  payment_failed: BaseEvent<'invoice.payment_failed', { invoiceId: string; error: string }>
}

// CustomerEvents is re-exported from core/entities

// SubscriptionEvents is re-exported from core/entities

// =============================================================================
// Resources
// =============================================================================

export interface PaymentResource extends PaymentActions {
  on: <K extends keyof PaymentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PaymentEvents[K], TProxy>
  ) => () => void
}

export interface InvoiceResource extends InvoiceActions {
  on: <K extends keyof InvoiceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InvoiceEvents[K], TProxy>
  ) => () => void
}

// CustomerResource is re-exported from core/entities

// SubscriptionResource is re-exported from core/entities

// =============================================================================
// Payments Proxy (unified interface)
// =============================================================================

/**
 * Complete Payments interface combining all resources.
 *
 * @example
 * ```ts
 * const handler: EventHandler<PaymentSucceededEvent, PaymentsProxy> = async (event, ctx) => {
 *   const customer = await ctx.$.customers.get({ id: event.data.customerId })
 *   console.log(`Payment received from ${customer.email}`)
 * }
 * ```
 */
export interface PaymentsProxy {
  /** Payment resources */
  payments: PaymentResource
  /** Invoice resources */
  invoices: InvoiceResource
  /** Customer resources (from core) */
  customers: import('@/core/entities').CustomerResource
  /** Subscription resources (from core) */
  subscriptions: import('@/core/entities').SubscriptionResource
}

// =============================================================================
// Provider Types
// =============================================================================

export type PaymentsProvider = 'stripe' | 'paddle' | 'chargebee' | 'recurly' | 'braintree' | 'square'

export interface PaymentsProviderConfig {
  provider: PaymentsProvider
  secretKey?: string
  publishableKey?: string
  webhookSecret?: string
  apiVersion?: string
}
