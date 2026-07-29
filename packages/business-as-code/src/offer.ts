/**
 * Offer — the canonical schema.org `Offer` value/type module.
 *
 * An `Offer` is how a capability is *sold*: it binds an `itemOffered`
 * (a `Service` or `Product`) to a price and a value-capture basis. Pricing is
 * exposed on the Offer (and the Listing derived from it) — **never** inline on
 * the bare `Product`/`Service` noun. (Those inline pricing fields remain for
 * backward compatibility but are `@deprecated` in favour of this module.)
 *
 * Two structures live here:
 *
 *  - {@link PricingBasis} — the **value-capture ladder**, a closed 5-rung union
 *    (`access | effort | usage | output | outcome`). It is the *semantic index*
 *    over the `business-as-code/finance` `Pricing` factories — it names *what a
 *    payment is conditioned on*, it does not re-implement the settlement math.
 *  - {@link PriceSpecification} — a discriminated union of concrete price shapes
 *    that **compose** the finance `Pricing` building blocks (`SubscriptionPlan`,
 *    `MeteredEntry`, `PerInvocationTier`, `OutcomeTier`, `PercentOfBasis`,
 *    `Money`) rather than duplicating them.
 *
 * The {@link Offer} factory follows the plain-object validate-and-normalize idiom
 * of `Business()` / `Product()` / `Goals()` in this package.
 *
 * @packageDocumentation
 */

import type { Money, PercentOfBasis, MeteredEntry, Pricing } from './finance/index.js'

// =============================================================================
// PricingBasis — the value-capture ladder (VALUE spine)
// =============================================================================

/**
 * The value-capture ladder, low → high. CLOSED, complete by construction.
 *
 *  - `access`  — pay to gain access (subscription / license)
 *  - `effort`  — pay per unit of work (hour / day / FTE)
 *  - `usage`   — pay per unit consumed (metered)
 *  - `output`  — pay per unit produced (per invocation / per deliverable)
 *  - `outcome` — pay on a verified result (success fee / gainshare)
 *
 * Climbing the ladder requires a stronger contract; the top rung (`outcome`)
 * may only be reached when the acceptance Metric is verifiable. (That
 * assurance→basis ceiling is enforced by the consuming `services-as-software`
 * package, not here.)
 */
export type PricingBasis = 'access' | 'effort' | 'usage' | 'output' | 'outcome'

/** The ladder as an ordered const array (low → high). */
export const PRICING_BASES = ['access', 'effort', 'usage', 'output', 'outcome'] as const

/** Narrowing guard: is `x` a legal {@link PricingBasis}? */
export function isPricingBasis(x: unknown): x is PricingBasis {
  return typeof x === 'string' && (PRICING_BASES as readonly string[]).includes(x)
}

/**
 * Map a {@link PricingBasis} rung to the canonical `finance` `Pricing.kind` that
 * settles it. This is the *alignment* between the semantic ladder and the
 * settlement firmware — `PricingBasis` indexes OVER the finance factories, it
 * does not duplicate the math.
 *
 *  - `access`  → `subscription`   (`SubscriptionPlan`)
 *  - `effort`  → `composite`      (one-time base + metered effort lines)
 *  - `usage`   → `composite`      (`MeteredEntry`)
 *  - `output`  → `per-invocation` (`PerInvocationTier`)
 *  - `outcome` → `outcome`        (`OutcomeTier` / `PercentOfBasis`)
 */
export function basisToPricingKind(basis: PricingBasis): Pricing['kind'] {
  switch (basis) {
    case 'access':
      return 'subscription'
    case 'effort':
      return 'composite'
    case 'usage':
      return 'composite'
    case 'output':
      return 'per-invocation'
    case 'outcome':
      return 'outcome'
  }
}

// =============================================================================
// PriceSpecification — concrete price shapes (compose finance Pricing blocks)
// =============================================================================

/** A reference to an acceptance/settlement Metric the price is conditioned on. */
export type MetricRef = string

/**
 * The concrete price, discriminated on `structure`. Each variant composes a
 * `business-as-code/finance` building block so the settlement math is never
 * duplicated:
 *
 *  - `SinglePrice` → a `Money` amount (subscription plan / one-time fee)
 *  - `Tiered`      → named tiers, each a `Money` (à la `SubscriptionPlan` ladder)
 *  - `UsageMeter`  → a finance `MeteredEntry` + a display `unit`
 *  - `SuccessFee`  → a percentage of a realised `PercentOfBasis`/`MetricRef`
 *  - `Gainshare`   → a share of the delta over a baseline `MetricRef`
 *  - `CustomQuote` → deferred to an RFQ (no machine price)
 */
export type PriceSpecification =
  | { structure: 'SinglePrice'; price: Money }
  | { structure: 'Tiered'; tiers: ReadonlyArray<{ name: string; price: Money }> }
  | { structure: 'UsageMeter'; meter: MeteredEntry; unit: string }
  | { structure: 'SuccessFee'; percent: number; of: PercentOfBasis | MetricRef }
  | { structure: 'Gainshare'; sharePercent: number; baseline: MetricRef }
  | { structure: 'CustomQuote'; rfqUrl?: string }

/** Closed set of `PriceSpecification` discriminants. */
export const PRICE_STRUCTURES = [
  'SinglePrice',
  'Tiered',
  'UsageMeter',
  'SuccessFee',
  'Gainshare',
  'CustomQuote',
] as const

// =============================================================================
// FundingSource — who pays
// =============================================================================

/** Where the money for an Offer ultimately comes from. */
export type FundingSource =
  | { source: 'direct' }
  | { source: 'ad-supported'; network: string }
  | { source: 'equity'; instrument: string }
  | { source: 'barter'; counterparty: string }
  | { source: 'subsidized'; sponsor: string }

// =============================================================================
// Offer — the canonical schema.org Offer value
// =============================================================================

/** A typed reference to the thing being offered (the G1 abstract category). */
export interface ItemOfferedRef {
  /** schema.org `itemOffered` is a `Service` or `Product`. */
  $type: 'Service' | 'Product'
  $id: string
}

/**
 * The canonical schema.org `Offer` value. `itemOffered` points at a `Service`
 * or `Product`; `gatingBasis` is the value-capture rung the price is conditioned
 * on; `priceSpecification` is the concrete machine price; `fundingSource` is who
 * ultimately pays.
 */
export interface Offer {
  $type: 'Offer'
  $id: string
  name: string
  description?: string
  itemOffered: ItemOfferedRef
  seller?: string
  /** The promise the seller makes (the deliverable in plain language). */
  promise?: string
  /** Primary value-capture rung (the basis the price is gated on). */
  gatingBasis: PricingBasis
  /** Optional secondary rung (e.g. an access floor under an outcome fee). */
  secondaryBasis?: PricingBasis
  priceSpecification: PriceSpecification
  fundingSource: FundingSource
}

/**
 * Author-facing spec for {@link Offer}. `gatingBasis` and `fundingSource` default
 * (`access` / `{ source: 'direct' }`); `$id` derives from `itemOffered` when
 * omitted.
 */
export interface OfferSpec {
  $id?: string
  name: string
  description?: string
  itemOffered: ItemOfferedRef
  seller?: string
  promise?: string
  gatingBasis?: PricingBasis
  secondaryBasis?: PricingBasis
  priceSpecification: PriceSpecification
  fundingSource?: FundingSource
}

/**
 * Define a canonical schema.org `Offer` (validate-and-normalize, plain object).
 *
 * @example
 * ```ts
 * import { Offer } from 'business-as-code'
 *
 * const offer = Offer({
 *   name: 'Bookkeeping — monthly',
 *   itemOffered: { $type: 'Service', $id: 'service:bookkeeping' },
 *   gatingBasis: 'access',
 *   priceSpecification: {
 *     structure: 'SinglePrice',
 *     price: { amount: 49900n, currency: 'USD' },
 *   },
 * })
 * ```
 */
export function Offer(spec: OfferSpec): Offer {
  if (!spec.name) {
    throw new Error('Offer name is required')
  }
  if (!spec.itemOffered) {
    throw new Error('Offer itemOffered is required (a Service or Product ref)')
  }
  if (spec.itemOffered.$type !== 'Service' && spec.itemOffered.$type !== 'Product') {
    throw new Error(
      `Offer itemOffered.$type must be 'Service' or 'Product', got '${spec.itemOffered.$type}'`
    )
  }
  if (!spec.itemOffered.$id) {
    throw new Error('Offer itemOffered.$id is required')
  }
  if (!spec.priceSpecification) {
    throw new Error('Offer priceSpecification is required')
  }
  if (spec.gatingBasis !== undefined && !isPricingBasis(spec.gatingBasis)) {
    throw new Error(
      `Offer gatingBasis '${String(
        spec.gatingBasis
      )}' is not on the value-capture ladder (${PRICING_BASES.join(' | ')})`
    )
  }
  if (spec.secondaryBasis !== undefined && !isPricingBasis(spec.secondaryBasis)) {
    throw new Error(
      `Offer secondaryBasis '${String(spec.secondaryBasis)}' is not on the value-capture ladder`
    )
  }

  const offer: Offer = {
    $type: 'Offer',
    $id: spec.$id ?? `offer:${spec.itemOffered.$id}`,
    name: spec.name,
    itemOffered: spec.itemOffered,
    gatingBasis: spec.gatingBasis ?? 'access',
    priceSpecification: spec.priceSpecification,
    fundingSource: spec.fundingSource ?? { source: 'direct' },
  }
  if (spec.description !== undefined) offer.description = spec.description
  if (spec.seller !== undefined) offer.seller = spec.seller
  if (spec.promise !== undefined) offer.promise = spec.promise
  if (spec.secondaryBasis !== undefined) offer.secondaryBasis = spec.secondaryBasis
  return offer
}
