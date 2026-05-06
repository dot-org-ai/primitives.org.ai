/**
 * OutcomeContract — definition-of-done + escrow + release condition.
 * Distinct from OutputContract (technical schema; lives in services-as-software).
 *
 * The predicate is evaluated against the runtime state of a Service invocation;
 * when it passes, escrow releases funds to the seller.
 */

import type { OutcomeTier } from './pricing.js'
import type { Money } from './types.js'
import type { ProofPredicate } from './proof-predicate.js'

/**
 * Fields shared by all {@link OutcomeContract} variants.
 *
 * Split from the timeout + amount fields so the discriminated union below can
 * express "exactly one of `expiresAt` / `timeoutDays`" AND "exactly one of
 * `amount` / `tiers`" at the type level.
 */
export interface OutcomeContractBase {
  $id: string
  $type: 'OutcomeContract'
  /** Worker (Person/Agent/Role) that bought the outcome. */
  buyer: string
  /** Worker (Person/Agent/Role) that sold/delivers the outcome. */
  seller: string
  /** Service this contract is bound to. */
  serviceRef: string
  predicate: ProofPredicate
  /** Account holding escrowed funds until predicate passes. */
  escrowAccountRef?: string
  onTimeout?: 'auto-cancel' | 'auto-refund' | 'escalate'
}

/**
 * Variant carrying an absolute ISO-8601 *timestamp* (e.g.
 * `'2026-05-12T00:00:00Z'`). The runtime treats this as the wall-clock
 * deadline. Carries a single {@link Money} `amount`.
 */
export interface OutcomeContractWithExpiresAt extends OutcomeContractBase {
  /**
   * Absolute ISO-8601 timestamp — the contract expires (and `onTimeout` fires)
   * exactly at this instant. For relative durations from contract creation,
   * use {@link OutcomeContractWithTimeoutDays.timeoutDays} instead.
   */
  expiresAt: string
  timeoutDays?: never
  amount: Money
  tiers?: never
  selectedTierId?: never
}

/**
 * Variant carrying a relative-duration deadline measured in whole days from
 * contract creation. The runtime computes
 * `expiresAt = createdAt + timeoutDays * 24h`. Carries a single {@link Money}
 * `amount`.
 */
export interface OutcomeContractWithTimeoutDays extends OutcomeContractBase {
  /**
   * Whole days from contract creation until expiry. Mutually exclusive with
   * {@link OutcomeContractWithExpiresAt.expiresAt}.
   */
  timeoutDays: number
  expiresAt?: never
  amount: Money
  tiers?: never
  selectedTierId?: never
}

/**
 * Variant carrying a multi-tier `OutcomeTier[]` mirror of
 * `Pricing.outcome.tiers`. Used when the Service quotes a tiered price (e.g.
 * S/M/L by feature complexity) and the headline contract figure should be
 * computed lazily from the chosen tier rather than baked at declaration time.
 *
 * At runtime, `Service.invoke` selects a tier based on input characteristics
 * and sets `selectedTierId`; the headline {@link Money} amount is then
 * computed by `tiers.find(t => t.id === selectedTierId)?.amount`.
 *
 * Carries `timeoutDays` (the tiered variant currently couples with relative-
 * duration deadlines; absolute-deadline + tiers can be added later if a
 * catalog Service needs both).
 */
export interface OutcomeContractWithTiers extends OutcomeContractBase {
  /**
   * Whole days from contract creation until expiry. Mutually exclusive with
   * {@link OutcomeContractWithExpiresAt.expiresAt}.
   */
  timeoutDays: number
  expiresAt?: never
  /**
   * Mirror of `Pricing.outcome.tiers` — one entry per quoted complexity tier
   * (e.g. S / M / L). The runtime resolves the headline amount from the
   * selected tier at invocation time.
   */
  tiers: OutcomeTier[]
  /**
   * Tier id selected by the runtime at invocation time (e.g. `'S'`). Omitted
   * at declaration time — `Service.invoke` sets it based on input
   * characteristics, then a lazy getter computes the headline {@link Money}
   * amount as `tiers.find(t => t.id === selectedTierId)?.amount`.
   */
  selectedTierId?: string
  /**
   * The runtime computes the headline amount from the selected tier — never
   * declared inline on this variant.
   */
  amount?: never
}

/**
 * Discriminated union — exactly one of `expiresAt` / `timeoutDays` is required,
 * and exactly one of `amount` / `tiers` is required.
 *
 * Use {@link OutcomeContractWithExpiresAt} for absolute deadlines + a single
 * {@link Money} amount; use {@link OutcomeContractWithTimeoutDays} for
 * relative durations from contract creation + a single {@link Money} amount;
 * use {@link OutcomeContractWithTiers} when the Service quotes a tiered price
 * (S/M/L) and the runtime selects a tier per-invocation.
 */
export type OutcomeContract =
  | OutcomeContractWithExpiresAt
  | OutcomeContractWithTimeoutDays
  | OutcomeContractWithTiers

/**
 * Resolve the headline {@link Money} amount on an {@link OutcomeContract},
 * lazily computing from `tiers[selectedTierId]` for the
 * {@link OutcomeContractWithTiers} variant.
 *
 * Returns `undefined` for the tiers variant when no tier has been selected
 * yet (e.g. pre-invocation, at declaration / publish time).
 */
export function resolveOutcomeAmount(contract: OutcomeContract): Money | undefined {
  if (contract.tiers !== undefined) {
    if (contract.selectedTierId === undefined) return undefined
    const tier = contract.tiers.find((t) => t.id === contract.selectedTierId)
    if (!tier) return undefined
    return { amount: tier.amount, currency: tier.currency ?? 'USD' }
  }
  return contract.amount
}

export interface ProofOfResult {
  $id: string
  $type: 'ProofOfResult'
  contractRef: string
  /** Worker (Person/Agent/Role) that signed the proof. */
  signedBy: string
  /** ISO-8601 timestamp. */
  signedAt: string
  /** Action that produced the verifiable output. */
  outputRef?: string
  /** Cryptographic signature where applicable. */
  signature?: string
}
