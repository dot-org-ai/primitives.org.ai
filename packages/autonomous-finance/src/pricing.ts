/**
 * Pricing — discriminated union with four factory variants.
 *
 *   outcome       — pay on delivery; tiers by complexity (S/M/L)
 *   subscription  — recurring plan + optional metered overage
 *   perInvocation — flat per-call with included-tier ladder
 *   composite     — one-time base + metered events
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
}

/** Convenience: build a Money value from a bigint + currency. */
export const money = (amount: bigint, currency: Currency = 'USD'): Money => ({
  amount,
  currency,
})
