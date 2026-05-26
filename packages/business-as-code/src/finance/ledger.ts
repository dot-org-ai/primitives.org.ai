/**
 * LedgerEntry — double-entry record. Every entry IS an Action under the SVO substrate.
 *
 * Invariant: per-currency, sum(debits.amount) === sum(credits.amount).
 * The ledger is append-only; reversals are new entries with opposite sign.
 */

import type { Money } from './types.js'

export interface LedgerEntry {
  $id: string
  $type: 'LedgerEntry'
  /** Reference to the underlying Action (digital-objects ActionRef shape). */
  actionRef: string
  debits: LedgerLine[]
  credits: LedgerLine[]
  /** Optional human-readable memo. */
  memo?: string
  /** ISO-8601 timestamp. */
  postedAt: string
}

export interface LedgerLine {
  accountRef: string
  amount: Money
}
