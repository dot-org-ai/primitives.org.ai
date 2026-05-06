/**
 * autonomous-finance — financial nervous system for the agentic economy.
 *
 * Substrate types only at this scaffold stage. Provider adapters (Stripe,
 * Tempo, x402, Privy, Lightspark) and catalog Services (bookkeeper,
 * controller, AP, AR, tax, treasury, payroll) ship in subsequent passes.
 *
 * @packageDocumentation
 */

// Money + Cost + Budget + spend-control
export type {
  FiatCurrency,
  StablecoinCurrency,
  CryptoCurrency,
  Currency,
  Money,
  Cost,
  Budget,
  BudgetScope,
  SpendControl,
  CostModel,
} from './types.js'

// Account + transfer
export type { Account, AccountSpec, TransferOpts, TransferResult } from './account.js'

// Card (Issuing)
export type { Card, CardSpec } from './card.js'

// Ledger
export type { LedgerEntry, LedgerLine } from './ledger.js'

// Identity (cross-provider)
export type { AgentIdentity, AgentMerchant } from './identity.js'

// ProofPredicate union + factories
export type { ProofPredicate } from './proof-predicate.js'
export {
  SchemaMatch,
  EvaluatorPass,
  HumanSign,
  External,
  LoadBearingPass,
  OverallFloor,
  UnmetRequirementsPass,
  AND,
  OR,
} from './proof-predicate.js'

// Outcome contract + proof of result
export type {
  OutcomeContract,
  OutcomeContractBase,
  OutcomeContractWithExpiresAt,
  OutcomeContractWithTimeoutDays,
  OutcomeContractWithTiers,
  ProofOfResult,
} from './outcome-contract.js'
export { resolveOutcomeAmount } from './outcome-contract.js'

// SLA policy
export type { SLAPolicy, SLATarget } from './sla.js'

// Refund contract + catalog
export type { RefundContractRef } from './refund.js'
export { RefundContracts } from './refund.js'

// Authority boundary + catalog
export type { AuthorityBoundaryRef } from './authority.js'
export { AuthorityBoundaries } from './authority.js'

// Pricing factories — type + value merged on the same name (Pricing.outcome(...), etc.)
export type {
  OutcomeTier,
  PerInvocationTier,
  MeteredEntry,
  CompositeBase,
  SubscriptionPlan,
  PercentOfBasis,
} from './pricing.js'
export { Pricing, money } from './pricing.js'
export type { Pricing as PricingValue } from './pricing.js'

// Provider port + capabilities
export type {
  FinanceProvider,
  ProviderCapabilities,
  ProviderRail,
  ChargeOpts,
  ChargeResult,
  RefundResult,
  EscrowHandle,
  ReleaseResult,
  SubscribeOpts,
  Subscription,
  MeterEvent,
} from './port.js'
