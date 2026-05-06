/**
 * OutcomeContract — definition-of-done + escrow + release condition.
 * Distinct from OutputContract (technical schema; lives in services-as-software).
 *
 * The predicate is evaluated against the runtime state of a Service invocation;
 * when it passes, escrow releases funds to the seller.
 */

import type { Money } from './types.js'
import type { ProofPredicate } from './proof-predicate.js'

/**
 * Fields shared by all {@link OutcomeContract} variants.
 *
 * Split from the timeout fields so the discriminated union below can express
 * "exactly one of `expiresAt` / `timeoutDays`" at the type level.
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
  amount: Money
  /** Account holding escrowed funds until predicate passes. */
  escrowAccountRef?: string
  onTimeout?: 'auto-cancel' | 'auto-refund' | 'escalate'
}

/**
 * Variant carrying an absolute ISO-8601 *timestamp* (e.g.
 * `'2026-05-12T00:00:00Z'`). The runtime treats this as the wall-clock
 * deadline.
 */
export interface OutcomeContractWithExpiresAt extends OutcomeContractBase {
  /**
   * Absolute ISO-8601 timestamp — the contract expires (and `onTimeout` fires)
   * exactly at this instant. For relative durations from contract creation,
   * use {@link OutcomeContractWithTimeoutDays.timeoutDays} instead.
   */
  expiresAt: string
  timeoutDays?: never
}

/**
 * Variant carrying a relative-duration deadline measured in whole days from
 * contract creation. The runtime computes
 * `expiresAt = createdAt + timeoutDays * 24h`.
 */
export interface OutcomeContractWithTimeoutDays extends OutcomeContractBase {
  /**
   * Whole days from contract creation until expiry. Mutually exclusive with
   * {@link OutcomeContractWithExpiresAt.expiresAt}.
   */
  timeoutDays: number
  expiresAt?: never
}

/**
 * Discriminated union — exactly one of `expiresAt` / `timeoutDays` is required.
 *
 * Use {@link OutcomeContractWithExpiresAt} for absolute deadlines; use
 * {@link OutcomeContractWithTimeoutDays} for relative durations from
 * contract creation.
 */
export type OutcomeContract = OutcomeContractWithExpiresAt | OutcomeContractWithTimeoutDays

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
