/**
 * Core value types — Money, Cost, Budget, SpendControl, CostModel.
 *
 * Money uses bigint in smallest currency unit (cents/satoshis/wei) for precision.
 * Refs use plain string with brand comment; cross-package nominal types deferred.
 */

export type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | string
export type StablecoinCurrency = 'USDC' | 'PYUSD' | 'USDT' | 'USDG' | 'USDSui' | 'CASH' | string
export type CryptoCurrency = 'BTC' | 'ETH' | 'SOL'
export type Currency = FiatCurrency | StablecoinCurrency | CryptoCurrency

export interface Money {
  amount: bigint
  currency: Currency
}

/** Cost incurred by an Action — every cascade Function call captures one. */
export interface Cost {
  $id: string
  $type: 'Cost'
  /** Reference to the underlying Action (digital-objects ActionRef shape). */
  actionRef: string
  amount: Money
  /** Provider that incurred the cost: 'openai' | 'anthropic' | 'stripe' | ... */
  provider: string
  category: 'inference' | 'compute' | 'storage' | 'api' | 'human' | 'rail-fee' | 'other'
  /** ISO-8601 timestamp. */
  capturedAt: string
}

/** Where a Budget applies. */
export type BudgetScope =
  | { kind: 'worker'; ref: string }
  | { kind: 'function'; ref: string }
  | { kind: 'goal'; ref: string }
  | { kind: 'experiment'; ref: string }
  | { kind: 'tenant'; ref: string }

export interface Budget {
  $id: string
  $type: 'Budget'
  scope: BudgetScope
  cap: Money
  period: 'daily' | 'weekly' | 'monthly' | 'one-time'
  /** ISO-8601 timestamp; absent for one-time budgets. */
  resetAt?: string
}

export interface SpendControl {
  budgetRef: string
  /** 0-1 fraction of cap — warn when soft threshold crossed. */
  soft?: number
  /** 0-1 fraction of cap — block/escalate when hard threshold crossed. */
  hard: number
  onBreach: 'block' | 'escalate' | 'warn'
  /** Worker to escalate to (Person/Agent/Role); ThingRef shape. */
  escalateTo?: string
}

/** Declared cost model on a Function or Service. */
export interface CostModel {
  /** Per-invocation flat cost (cents in smallest unit). */
  perInvocation?: bigint
  /** Per-transaction cost (e.g. per-token, per-row). */
  perTx?: bigint
  /** Per round of agent execution (e.g. per-dev-agent-round). */
  perAgentRound?: bigint
  /** Per external API call. */
  perApiCall?: bigint
  /** Per-symbol or per-unit-of-output. */
  perUnit?: bigint
  /** Hourly rate for human work. */
  perHour?: bigint
}
