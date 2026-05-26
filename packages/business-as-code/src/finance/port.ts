/**
 * FinanceProvider — port for adapter implementations (Stripe, Tempo, x402,
 * Privy, Lightspark). Every method is optional and gated by ProviderCapabilities;
 * adapters declare which capabilities they support.
 *
 * Adapter implementations are forthcoming and ship outside the substrate —
 * none are bundled here.
 */

import type { Currency, Money, Cost } from './types.js'
import type { Account, AccountSpec, TransferOpts, TransferResult } from './account.js'
import type { Card, CardSpec } from './card.js'
import type { OutcomeContract, ProofOfResult } from './outcome-contract.js'
import type { StablecoinCurrency } from './types.js'
import type { MerchantCapable } from './merchant.js'

export type ProviderRail =
  | 'mpp'
  | 'spt'
  | 'x402'
  | 'streaming'
  | 'card'
  | 'wire'
  | 'ach'
  | 'lightning'
  | 'on-chain'

export interface ProviderCapabilities {
  payments: boolean
  refunds: boolean
  issuing: boolean
  treasury: boolean
  escrow: boolean
  subscriptions: boolean
  metering: boolean
  /** Platform/Connect product-line provisioning + hosted checkout (see MerchantCapable). */
  merchant: boolean
  multiCurrency: boolean
  currencies: Currency[]
  stablecoins: StablecoinCurrency[]
  rails: ProviderRail[]
}

export interface ChargeOpts {
  /** Counterparty Worker paying the charge (ThingRef shape). */
  buyer: string
  amount: Money
  /** Service or invocation reference for attribution. */
  ref?: string
  /** Idempotency key for at-most-once semantics. */
  idempotencyKey?: string
  /** Provider-specific opts; pass-through. */
  providerOpts?: Record<string, unknown>
}

export interface ChargeResult {
  $id: string
  $type: 'Charge'
  amount: Money
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'
  /** ISO-8601 timestamp. */
  createdAt: string
  providerData: { provider: string; externalId: string }
}

export interface RefundResult {
  $id: string
  $type: 'Refund'
  chargeId: string
  amount: Money
  /** ISO-8601 timestamp. */
  createdAt: string
}

export interface EscrowHandle {
  $id: string
  contractRef: string
  state: 'held' | 'released' | 'expired' | 'cancelled'
  providerData: { provider: string; externalId: string }
}

export interface ReleaseResult {
  $id: string
  escrowHandle: string
  releasedAt: string
  /** ISO-8601 timestamp. */
  amount: Money
}

export interface SubscribeOpts {
  buyer: string
  planRef: string
  /** Provider-specific opts; pass-through. */
  providerOpts?: Record<string, unknown>
}

export interface Subscription {
  $id: string
  $type: 'Subscription'
  buyer: string
  planRef: string
  state: 'active' | 'paused' | 'cancelled' | 'past-due'
  /** ISO-8601 timestamp. */
  startedAt: string
  providerData: { provider: string; externalId: string }
}

export interface MeterEvent {
  /** Subscription or customer this event meters against. */
  subscriptionRef: string
  event: string
  quantity: bigint
  /** ISO-8601 timestamp. */
  occurredAt: string
}

export interface FinanceProvider extends Partial<MerchantCapable> {
  readonly name: string
  readonly capabilities: ProviderCapabilities

  // Charge / refund
  charge(opts: ChargeOpts): Promise<ChargeResult>
  refund(chargeId: string, amount?: Money): Promise<RefundResult>

  // Cards (optional)
  issueCard?(spec: CardSpec): Promise<Card>
  lockCard?(cardId: string): Promise<void>

  // Treasury (optional)
  openAccount?(spec: AccountSpec): Promise<Account>
  balance?(accountId: string): Promise<Money>
  transfer?(opts: TransferOpts): Promise<TransferResult>

  // Outcome / escrow (optional; built on MPP Sessions / x402 escrow / native)
  escrow?(contract: OutcomeContract): Promise<EscrowHandle>
  release?(escrowHandle: string, proof: ProofOfResult): Promise<ReleaseResult>

  // Subscriptions / metering (optional)
  subscribe?(opts: SubscribeOpts): Promise<Subscription>
  meter?(event: MeterEvent): Promise<void>

  // Cost capture — provider-side cost reporting (e.g. LLM provider per-token)
  captureCost?(cost: Omit<Cost, '$id' | '$type'>): Promise<Cost>
}
