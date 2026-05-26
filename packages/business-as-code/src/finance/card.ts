/**
 * Card — virtual card issued by a finance provider (Stripe Issuing, Brex, Lithic, etc.).
 * Per-Worker / per-Function / per-Task lifecycle.
 */

import type { Money } from './types.js'

export interface Card {
  $id: string
  $type: 'Card'
  scope: 'single-use' | 'recurring'
  /** Worker the card is issued to (Person/Agent/Role); ThingRef shape. */
  workerRef?: string
  caps: {
    perTransaction?: Money
    daily?: Money
    total?: Money
  }
  /** Allowed Merchant Category Codes. */
  mccAllowed?: string[]
  /** Velocity controls. */
  velocity?: {
    maxTxPerDay?: number
  }
  state: 'issued' | 'active' | 'locked' | 'disposed'
  providerData: {
    provider: string
    externalId: string
  }
}

export interface CardSpec {
  scope: 'single-use' | 'recurring'
  workerRef?: string
  caps: Card['caps']
  mccAllowed?: string[]
  velocity?: Card['velocity']
}
