/**
 * OutcomeContract — definition-of-done + escrow + release condition.
 * Distinct from OutputContract (technical schema; lives in services-as-software).
 *
 * The predicate is evaluated against the runtime state of a Service invocation;
 * when it passes, escrow releases funds to the seller.
 */

import type { Money } from './types.js'
import type { ProofPredicate } from './proof-predicate.js'

export interface OutcomeContract {
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
  /** ISO-8601 timestamp; contract expires + onTimeout fires after this. */
  expiresAt: string
  onTimeout?: 'auto-cancel' | 'auto-refund' | 'escalate'
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
