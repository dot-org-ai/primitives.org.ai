/**
 * Merchant provisioning — the platform/Connect half of the FinanceProvider
 * port: turn a priced Offer into a sellable product-line under a holdco, and
 * mint a checkout for it.
 *
 * Motivation (added by explore.startups.studio B4, issue #222): the substrate
 * `FinanceProvider` port modeled CHARGING (`charge`/`refund`/`subscribe`) but
 * not the upstream provisioning a hosted-checkout flow needs:
 *   1. provision a Product + Price under a platform account (Stripe Connect:
 *      one platform / holdco, many product-lines), keyed to a caller-supplied
 *      durable id (NOT a name — names are mutable),
 *   2. open a hosted Checkout session that returns a redirectable URL,
 *   3. report a payout against the platform balance.
 *
 * Stripe ships all three; the gap was only that the port did not EXPRESS them,
 * so a consumer had to reach past the port into raw Stripe. These types close
 * that gap so the consumer wires through the port (Stripe / Tempo / x402 are
 * interchangeable behind it).
 */

import type { Money } from './types.js'
import type { Pricing } from './pricing.js'

/** How a provisioned Price recurs — mirrors Stripe `price.recurring.interval`. */
export type PriceInterval = 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * Provision a per-product-line Product + Price under the platform/holdco
 * account. `merchantRef` is the caller's DURABLE key for the product-line
 * (e.g. a Startup Id) — adapters MUST round-trip it as provider metadata so a
 * re-provision is idempotent on it, NOT on the (mutable) display name.
 */
export interface ProvisionProductOpts {
  /** Caller's durable product-line key (e.g. Startup Id). The idempotency anchor. */
  merchantRef: string
  /** Display name for the product (mutable; never used as the key). */
  name: string
  /** Optional product description. */
  description?: string
  /** The unit price of the representative tier. */
  price: Money
  /** Recurring interval; omit for a one-time price. */
  interval?: PriceInterval
  /** The full authored Pricing architecture (carried as provider metadata for audit). */
  pricing?: Pricing
  /** Idempotency key for at-most-once provisioning. */
  idempotencyKey?: string
  /** Provider-specific opts; pass-through. */
  providerOpts?: Record<string, unknown>
}

export interface ProvisionedProduct {
  $id: string
  $type: 'Product'
  /** Echoed durable product-line key. */
  merchantRef: string
  /** Provider product + price ids. */
  providerData: { provider: string; productId: string; priceId: string }
}

/** Open a hosted-checkout session for a provisioned Price. */
export interface CheckoutOpts {
  /** The provider price id (from {@link ProvisionedProduct}). */
  priceId: string
  /** Caller's durable product-line key — round-tripped onto the resulting payment. */
  merchantRef: string
  /** Quantity of the price to purchase (default 1). */
  quantity?: number
  /** Where the provider redirects on success (may carry a `{CHECKOUT_SESSION_ID}` template). */
  successUrl: string
  /** Where the provider redirects on cancel. */
  cancelUrl: string
  /** Mode of the session: one-time payment vs. recurring subscription. */
  mode?: 'payment' | 'subscription'
  /** Arbitrary metadata to attach to the session + resulting payment (e.g. correlation ids). */
  metadata?: Record<string, string>
  /** Idempotency key for at-most-once session creation. */
  idempotencyKey?: string
  /** Provider-specific opts; pass-through. */
  providerOpts?: Record<string, unknown>
}

export interface CheckoutSession {
  $id: string
  $type: 'CheckoutSession'
  /** The redirectable hosted-checkout URL the buyer is sent to. */
  url: string
  /** Caller's durable product-line key. */
  merchantRef: string
  status: 'open' | 'complete' | 'expired'
  providerData: { provider: string; externalId: string }
}

export interface PayoutOpts {
  /** Amount to pay out from the platform balance. */
  amount: Money
  /** The connected/destination account ref receiving the payout. */
  destinationRef: string
  /** Idempotency key for at-most-once payout. */
  idempotencyKey?: string
  providerOpts?: Record<string, unknown>
}

export interface PayoutResult {
  $id: string
  $type: 'Payout'
  amount: Money
  destinationRef: string
  status: 'pending' | 'paid' | 'failed'
  /** ISO-8601 timestamp. */
  createdAt: string
  providerData: { provider: string; externalId: string }
}

/**
 * The merchant/platform-provisioning capability set. A FinanceProvider MAY
 * implement these (gated by {@link ProviderCapabilities.merchant}); a
 * charge-only adapter omits them.
 */
export interface MerchantCapable {
  /** Provision (idempotently, on `merchantRef`) a Product + Price under the platform/holdco. */
  provisionProduct(opts: ProvisionProductOpts): Promise<ProvisionedProduct>
  /** Open a hosted-checkout session for a provisioned price; returns a redirectable URL. */
  createCheckoutSession(opts: CheckoutOpts): Promise<CheckoutSession>
  /** Report a payout against the platform balance to a destination account. */
  payout?(opts: PayoutOpts): Promise<PayoutResult>
}
