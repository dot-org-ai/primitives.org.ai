/**
 * Core Entities
 *
 * Cross-cutting entity types that are used across multiple modules.
 * These represent fundamental business concepts that appear in
 * payments, CRM, e-commerce, and other domains.
 *
 * @module core/entities
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Customer - Universal Customer Entity
// =============================================================================

/**
 * Customer status.
 */
export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'churned'

/**
 * Customer type/segment.
 */
export type CustomerType = 'individual' | 'business' | 'enterprise'

/**
 * Payment method type.
 */
export type PaymentMethodType = 'card' | 'bank_transfer' | 'ach' | 'sepa' | 'paypal' | 'crypto' | 'invoice' | 'other'

/**
 * Payment method attached to a customer.
 */
export interface PaymentMethod {
  /** Unique identifier */
  id: string

  /** Payment method type */
  type: PaymentMethodType

  /** Card brand (visa, mastercard, etc.) */
  brand?: string

  /** Last 4 digits */
  last4?: string

  /** Bank name (for bank transfers) */
  bankName?: string

  /** Expiry month */
  expiryMonth?: number

  /** Expiry year */
  expiryYear?: number

  /** Whether this is the default payment method */
  isDefault?: boolean

  /** Billing address */
  billingAddress?: Address

  /** Creation timestamp */
  createdAt: Date
}

/**
 * Address structure used across entities.
 */
export interface Address {
  /** Recipient name */
  name?: string

  /** Street address line 1 */
  line1?: string

  /** Street address line 2 */
  line2?: string

  /** City */
  city?: string

  /** State/Province/Region */
  state?: string

  /** Postal/ZIP code */
  postalCode?: string

  /** Country code (ISO 3166-1 alpha-2) */
  country?: string

  /** Phone number */
  phone?: string
}

/**
 * Universal customer entity.
 *
 * Customers are the people or organizations that purchase
 * products, subscribe to services, or interact with your business.
 * This type is designed to work across payments, CRM, e-commerce,
 * and other domains.
 *
 * @example
 * ```ts
 * const customer: Customer = {
 *   id: 'cus_123',
 *   email: 'john@example.com',
 *   name: 'John Doe',
 *   status: 'active',
 *   type: 'individual',
 *   billingAddress: {
 *     line1: '123 Main St',
 *     city: 'San Francisco',
 *     state: 'CA',
 *     postalCode: '94102',
 *     country: 'US'
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Customer {
  /** Unique identifier */
  id: string

  /** Email address */
  email: string

  /** Display name */
  name?: string

  /** First name */
  firstName?: string

  /** Last name */
  lastName?: string

  /** Phone number */
  phone?: string

  /** Customer status */
  status: CustomerStatus

  /** Customer type/segment */
  type?: CustomerType

  /** Company/organization name */
  company?: string

  /** Billing address */
  billingAddress?: Address

  /** Shipping address */
  shippingAddress?: Address

  /** Default currency (ISO 4217) */
  currency?: string

  /** Account balance (in smallest currency unit) */
  balance?: number

  /** Tax ID/VAT number */
  taxId?: string

  /** Tax exempt status */
  taxExempt?: boolean

  /** Default payment method ID */
  defaultPaymentMethodId?: string

  /** Locale/language preference */
  locale?: string

  /** Timezone */
  timezone?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    stripe?: string
    hubspot?: string
    salesforce?: string
    shopify?: string
    [key: string]: string | undefined
  }

  /** Related user ID (if linked to auth system) */
  userId?: string

  /** Related business ID */
  businessId?: string

  /** Is delinquent (has past due invoices) */
  delinquent?: boolean

  /** Last order/purchase timestamp */
  lastOrderAt?: Date

  /** Total lifetime value */
  lifetimeValue?: number

  /** Order count */
  orderCount?: number

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CustomerInput = Input<Customer>
export type CustomerOutput = Output<Customer>

// =============================================================================
// Subscription - Universal Subscription Entity
// =============================================================================

/**
 * Subscription status.
 */
export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

/**
 * Billing interval.
 */
export type BillingInterval = 'day' | 'week' | 'month' | 'year'

/**
 * Subscription item (a single line item in a subscription).
 */
export interface SubscriptionItem {
  /** Unique identifier */
  id?: string

  /** Price/plan ID */
  priceId: string

  /** Product ID */
  productId?: string

  /** Product/plan name */
  name?: string

  /** Quantity (seats, units, etc.) */
  quantity: number

  /** Unit amount in smallest currency unit */
  unitAmount?: number

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Subscription discount/coupon.
 */
export interface SubscriptionDiscount {
  /** Coupon ID */
  couponId?: string

  /** Discount name */
  name?: string

  /** Percent off (0-100) */
  percentOff?: number

  /** Amount off in smallest currency unit */
  amountOff?: number

  /** Currency for amount off */
  currency?: string

  /** Duration type */
  duration?: 'once' | 'repeating' | 'forever'

  /** Number of months for repeating duration */
  durationInMonths?: number

  /** Redemption end date */
  endsAt?: Date
}

/**
 * Subscription pause configuration.
 */
export interface SubscriptionPause {
  /** Behavior for invoices during pause */
  behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void'

  /** When subscription will resume */
  resumesAt?: Date
}

/**
 * Universal subscription entity.
 *
 * Subscriptions represent recurring billing agreements
 * between customers and your business. This type works
 * across payment providers and SaaS platforms.
 *
 * @example
 * ```ts
 * const subscription: Subscription = {
 *   id: 'sub_123',
 *   customerId: 'cus_123',
 *   status: 'active',
 *   items: [
 *     { priceId: 'price_pro_monthly', quantity: 5 }
 *   ],
 *   currency: 'usd',
 *   currentPeriodStart: new Date('2024-01-01'),
 *   currentPeriodEnd: new Date('2024-02-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Subscription {
  /** Unique identifier */
  id: string

  /** Customer ID */
  customerId: string

  /** Subscription status */
  status: SubscriptionStatus

  /** Subscription items (plans/products) */
  items: SubscriptionItem[]

  /** Currency (ISO 4217) */
  currency: string

  /** Current billing period start */
  currentPeriodStart: Date

  /** Current billing period end */
  currentPeriodEnd: Date

  /** Billing interval */
  interval?: BillingInterval

  /** Interval count (e.g., 2 for bi-monthly) */
  intervalCount?: number

  /** Trial start date */
  trialStart?: Date

  /** Trial end date */
  trialEnd?: Date

  /** Cancellation date */
  canceledAt?: Date

  /** Cancel at period end (grace period) */
  cancelAtPeriodEnd?: boolean

  /** Ended at date (fully terminated) */
  endedAt?: Date

  /** Billing cycle anchor date */
  billingCycleAnchor?: Date

  /** Collection method */
  collectionMethod?: 'charge_automatically' | 'send_invoice'

  /** Days until due (for send_invoice) */
  daysUntilDue?: number

  /** Default payment method ID */
  defaultPaymentMethodId?: string

  /** Active discount */
  discount?: SubscriptionDiscount

  /** Latest invoice ID */
  latestInvoiceId?: string

  /** Pause configuration */
  pauseCollection?: SubscriptionPause

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    stripe?: string
    chargebee?: string
    paddle?: string
    [key: string]: string | undefined
  }

  /** Related product ID */
  productId?: string

  /** Related SaaS ID */
  saasId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SubscriptionInput = Input<Subscription>
export type SubscriptionOutput = Output<Subscription>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface CustomerActions extends CRUDResource<Customer, CustomerInput> {
  /** Get by email */
  getByEmail: Action<{ email: string }, Customer | null>

  /** Search customers */
  search: Action<{ query: string } & ListParams, PaginatedResult<Customer>>

  /** Add payment method */
  addPaymentMethod: Action<{ id: string; paymentMethod: Omit<PaymentMethod, 'id' | 'createdAt'> }, Customer>

  /** Remove payment method */
  removePaymentMethod: Action<{ id: string; paymentMethodId: string }, Customer>

  /** Set default payment method */
  setDefaultPaymentMethod: Action<{ id: string; paymentMethodId: string }, Customer>

  /** Get payment methods */
  getPaymentMethods: Action<{ id: string }, PaymentMethod[]>

  /** Get subscriptions */
  getSubscriptions: Action<{ id: string } & ListParams, PaginatedResult<Subscription>>

  /** Apply balance adjustment */
  adjustBalance: Action<{ id: string; amount: number; currency: string; description?: string }, Customer>

  /** Merge customers */
  merge: Action<{ sourceId: string; targetId: string }, Customer>

  /** Create portal session (for self-service) */
  createPortalSession: Action<{ id: string; returnUrl: string }, { url: string }>
}

export interface SubscriptionActions extends CRUDResource<Subscription, SubscriptionInput> {
  /** Start a trial */
  startTrial: Action<{ customerId: string; items: SubscriptionItem[]; trialDays?: number }, Subscription>

  /** Convert trial to paid */
  convertTrial: Action<{ id: string }, Subscription>

  /** Change plan/items */
  changeItems: Action<{ id: string; items: SubscriptionItem[]; prorate?: boolean }, Subscription>

  /** Cancel subscription */
  cancel: Action<{ id: string; atPeriodEnd?: boolean; reason?: string; feedback?: string }, Subscription>

  /** Pause subscription */
  pause: Action<{ id: string; resumesAt?: Date; behavior?: SubscriptionPause['behavior'] }, Subscription>

  /** Resume subscription */
  resume: Action<{ id: string }, Subscription>

  /** Update quantity */
  updateQuantity: Action<{ id: string; itemId: string; quantity: number }, Subscription>

  /** Apply coupon/discount */
  applyDiscount: Action<{ id: string; couponId: string }, Subscription>

  /** Remove discount */
  removeDiscount: Action<{ id: string }, Subscription>

  /** Preview upcoming invoice */
  previewInvoice: Action<{ id: string }, unknown>

  /** Preview changes (proration) */
  previewChanges: Action<{ id: string; newItems: SubscriptionItem[] }, { amount: number; prorationDate: Date }>
}

// =============================================================================
// Events
// =============================================================================

export interface CustomerEvents {
  created: BaseEvent<'customer.created', Customer>
  updated: BaseEvent<'customer.updated', Customer>
  deleted: BaseEvent<'customer.deleted', { id: string }>
  payment_method_added: BaseEvent<'customer.payment_method_added', { customerId: string; paymentMethod: PaymentMethod }>
  payment_method_removed: BaseEvent<'customer.payment_method_removed', { customerId: string; paymentMethodId: string }>
  default_payment_method_changed: BaseEvent<'customer.default_payment_method_changed', { customerId: string; paymentMethodId: string }>
  balance_adjusted: BaseEvent<'customer.balance_adjusted', { customerId: string; amount: number; newBalance: number }>
  merged: BaseEvent<'customer.merged', { sourceId: string; targetId: string; result: Customer }>
}

export interface SubscriptionEvents {
  created: BaseEvent<'subscription.created', Subscription>
  updated: BaseEvent<'subscription.updated', Subscription>
  deleted: BaseEvent<'subscription.deleted', { id: string }>
  trial_started: BaseEvent<'subscription.trial_started', Subscription>
  trial_will_end: BaseEvent<'subscription.trial_will_end', { subscriptionId: string; trialEnd: Date }>
  trial_ended: BaseEvent<'subscription.trial_ended', { subscriptionId: string; converted: boolean }>
  activated: BaseEvent<'subscription.activated', Subscription>
  items_changed: BaseEvent<'subscription.items_changed', { subscriptionId: string; oldItems: SubscriptionItem[]; newItems: SubscriptionItem[] }>
  canceled: BaseEvent<'subscription.canceled', { subscriptionId: string; atPeriodEnd: boolean; reason?: string }>
  paused: BaseEvent<'subscription.paused', { subscriptionId: string; resumesAt?: Date }>
  resumed: BaseEvent<'subscription.resumed', Subscription>
  renewed: BaseEvent<'subscription.renewed', Subscription>
  past_due: BaseEvent<'subscription.past_due', { subscriptionId: string }>
  unpaid: BaseEvent<'subscription.unpaid', { subscriptionId: string }>
  discount_applied: BaseEvent<'subscription.discount_applied', { subscriptionId: string; discount: SubscriptionDiscount }>
  discount_removed: BaseEvent<'subscription.discount_removed', { subscriptionId: string }>
}

// =============================================================================
// Resources
// =============================================================================

export interface CustomerResource extends CustomerActions {
  on: <K extends keyof CustomerEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CustomerEvents[K], TProxy>
  ) => () => void
}

export interface SubscriptionResource extends SubscriptionActions {
  on: <K extends keyof SubscriptionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SubscriptionEvents[K], TProxy>
  ) => () => void
}
