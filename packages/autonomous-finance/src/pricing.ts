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

export type Pricing =
  | {
      kind: 'outcome'
      tiers: OutcomeTier[]
      sla?: SLATarget
    }
  | {
      kind: 'subscription'
      plan: {
        id: string
        amount: bigint
        currency: Currency
        interval: 'day' | 'week' | 'month' | 'quarter' | 'year'
      }
      metered?: { event: string; amount: bigint; description?: string }[]
      sla?: SLATarget
    }
  | {
      kind: 'per-invocation'
      tiers: PerInvocationTier[]
    }
  | {
      kind: 'composite'
      base: { id: string; amount: bigint; description?: string }
      metered: { event: string; amount: bigint; description?: string }[]
    }

export const Pricing = {
  outcome(opts: { tiers: OutcomeTier[]; sla?: SLATarget }): Pricing {
    if (opts.sla !== undefined) {
      return { kind: 'outcome', tiers: opts.tiers, sla: opts.sla }
    }
    return { kind: 'outcome', tiers: opts.tiers }
  },

  subscription(opts: {
    plan: {
      id: string
      amount: bigint
      currency: Currency
      interval: 'day' | 'week' | 'month' | 'quarter' | 'year'
    }
    metered?: { event: string; amount: bigint; description?: string }[]
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

  composite(opts: {
    base: { id: string; amount: bigint; description?: string }
    metered: { event: string; amount: bigint; description?: string }[]
  }): Pricing {
    return { kind: 'composite', base: opts.base, metered: opts.metered }
  },
}

/** Convenience: build a Money value from a bigint + currency. */
export const money = (amount: bigint, currency: Currency = 'USD'): Money => ({
  amount,
  currency,
})
