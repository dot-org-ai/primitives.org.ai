/**
 * Account — bank/treasury/wallet account abstraction across providers.
 * Stripe Treasury, Mercury, Column, Increase, Privy non-custodial wallet, etc.
 */

import type { Currency, Money } from './types.js'

export interface Account {
  $id: string
  $type: 'Account'
  /** Tenant the account belongs to (ThingRef shape). */
  tenantRef?: string
  purpose: string
  currency: Currency
  providerData: {
    provider: string
    externalId: string
  }
}

export interface AccountSpec {
  tenantRef?: string
  purpose: string
  currency: Currency
}

export interface TransferOpts {
  fromAccountRef: string
  toAccountRef: string
  amount: Money
  /** Idempotency key for at-most-once semantics. */
  idempotencyKey?: string
}

export interface TransferResult {
  $id: string
  $type: 'Transfer'
  fromAccountRef: string
  toAccountRef: string
  amount: Money
  status: 'pending' | 'settled' | 'failed' | 'reversed'
  /** ISO-8601 timestamp. */
  createdAt: string
  providerData: {
    provider: string
    externalId: string
  }
}
