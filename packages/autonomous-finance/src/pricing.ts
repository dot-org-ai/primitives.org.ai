/**
 * Pricing — discriminated union with five factory variants.
 *
 *   outcome       — pay on delivery; tiers by complexity (S/M/L)
 *   subscription  — recurring plan + optional metered overage
 *   perInvocation — flat per-call with included-tier ladder
 *   composite     — one-time base + metered events
 *   percent-of    — proportional charge against a realised basis
 *                   (invoice amount, collected amount, transaction volume)
 *                   with optional cap / floor
 *
 * Each factory returns a typed Pricing value with discriminator on .kind.
 */

import type { Currency, Money } from './types.js'
import type { SLATarget } from './sla.js'

export interface OutcomeTier {
  id: string
  amount: bigint
  currency?: Currency
  description?: string
}

export interface PerInvocationTier {
  id: string
  amount: bigint
  /** Number of invocations included before per-tier billing applies. */
  includedPerMonth?: number
  /** Per-invocation overage cost above included. */
  overage?: bigint
}

/**
 * A single metered-billing line item. `description` is genuinely optional —
 * callers may omit it from inline literals AND from the {@link Pricing}
 * factory calls (`Pricing.subscription` / `Pricing.composite`).
 */
export interface MeteredEntry {
  event: string
  amount: bigint
  description?: string
}

/**
 * Optional one-time base charge on a {@link Pricing.composite} plan. `description`
 * is optional under `exactOptionalPropertyTypes`.
 */
export interface CompositeBase {
  id: string
  amount: bigint
  description?: string
}

/**
 * Recurring plan portion of a {@link Pricing.subscription}. Shared between the
 * `Pricing` discriminated union and the {@link Pricing.subscription} factory
 * so the two shapes never drift.
 */
export interface SubscriptionPlan {
  id: string
  amount: bigint
  currency: Currency
  interval: 'day' | 'week' | 'month' | 'quarter' | 'year'
}

/**
 * Standard bases the {@link Pricing.percentOf} runtime knows how to resolve
 * at settlement time. Adapters MAY accept arbitrary basis strings for
 * domain-specific metering, but the canonical four cover the common cases:
 *
 *   invoice-amount       — face value of an outbound invoice
 *   collected-amount     — funds actually received (post-settlement)
 *   transaction-volume   — gross payment volume processed
 *   <custom string>      — provider-defined; must be resolvable in the
 *                          metering runtime
 */
export type PercentOfBasis =
  | 'invoice-amount'
  | 'collected-amount'
  | 'transaction-volume'
  | (string & {})

export type Pricing =
  | {
      kind: 'outcome'
      tiers: OutcomeTier[]
      sla?: SLATarget
    }
  | {
      kind: 'subscription'
      plan: SubscriptionPlan
      metered?: MeteredEntry[]
      sla?: SLATarget
    }
  | {
      kind: 'per-invocation'
      tiers: PerInvocationTier[]
    }
  | {
      kind: 'composite'
      base: CompositeBase
      metered: MeteredEntry[]
    }
  | {
      kind: 'percent-of'
      basis: PercentOfBasis
      /**
       * Rate in basis points (1/100ths of a percent). Examples: `200` = 2%,
       * `75` = 0.75%, `1000` = 10%.
       *
       * The metering runtime computes the charge as
       * `(realised_basis * rateBasisPoints) / 10000`, then clamps the
       * result by the optional `cap` / `floor` (when present).
       */
      rateBasisPoints: number
      /** Optional upper bound on the per-event charge. */
      cap?: Money
      /** Optional lower bound on the per-event charge. */
      floor?: Money
    }

export const Pricing = {
  outcome(opts: { tiers: OutcomeTier[]; sla?: SLATarget }): Pricing {
    if (opts.sla !== undefined) {
      return { kind: 'outcome', tiers: opts.tiers, sla: opts.sla }
    }
    return { kind: 'outcome', tiers: opts.tiers }
  },

  subscription(opts: {
    plan: SubscriptionPlan
    metered?: MeteredEntry[]
    sla?: SLATarget
  }): Pricing {
    const result: Extract<Pricing, { kind: 'subscription' }> = {
      kind: 'subscription',
      plan: opts.plan,
    }
    if (opts.metered !== undefined) result.metered = opts.metered
    if (opts.sla !== undefined) result.sla = opts.sla
    return result
  },

  perInvocation(opts: { tiers: PerInvocationTier[] }): Pricing {
    return { kind: 'per-invocation', tiers: opts.tiers }
  },

  composite(opts: { base: CompositeBase; metered: MeteredEntry[] }): Pricing {
    return { kind: 'composite', base: opts.base, metered: opts.metered }
  },

  /**
   * Percent-of-basis pricing — proportional charge against a realised
   * basis (e.g. invoice amount, collected amount, transaction volume).
   *
   * The metering runtime resolves `basis` to a concrete bigint at
   * settlement time, then computes the charge as
   * `(realised_basis * rateBasisPoints) / 10000`, optionally clamped by
   * `cap` / `floor`.
   *
   * @example AR Service: 2% of collected funds
   * ```ts
   * Pricing.percentOf({ basis: 'collected-amount', rateBasisPoints: 200 })
   * ```
   *
   * @example Capped: 0.75% of transaction volume, max $50/event
   * ```ts
   * Pricing.percentOf({
   *   basis: 'transaction-volume',
   *   rateBasisPoints: 75,
   *   cap: { amount: 5000n, currency: 'USD' },
   * })
   * ```
   */
  percentOf(opts: {
    basis: PercentOfBasis
    rateBasisPoints: number
    cap?: Money
    floor?: Money
  }): Pricing {
    const result: Extract<Pricing, { kind: 'percent-of' }> = {
      kind: 'percent-of',
      basis: opts.basis,
      rateBasisPoints: opts.rateBasisPoints,
    }
    if (opts.cap !== undefined) result.cap = opts.cap
    if (opts.floor !== undefined) result.floor = opts.floor
    return result
  },
}

/** Convenience: build a Money value from a bigint + currency. */
export const money = (amount: bigint, currency: Currency = 'USD'): Money => ({
  amount,
  currency,
})
