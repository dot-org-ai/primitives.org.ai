/**
 * Service Pricing Module
 *
 * Hourly, project, and subscription pricing models.
 */

export type Currency = 'USD' | 'EUR' | 'GBP' | string

export interface PriceResult {
  amount: number
  currency: Currency
  discount?: number
}

// ============================================================================
// Hourly Pricing
// ============================================================================

export interface HourlyPricingConfig {
  model: 'hourly'
  rate: number
  currency: Currency
  minimumHours?: number
  billingIncrement?: number // minutes
  overtimeRate?: number
  overtimeThreshold?: number // hours
}

export interface HourlyPricingInput {
  rate: number
  currency: Currency
  minimumHours?: number
  billingIncrement?: number
  overtimeRate?: number
  overtimeThreshold?: number
}

export function createHourlyPricing(input: HourlyPricingInput): HourlyPricingConfig {
  return {
    model: 'hourly',
    rate: input.rate,
    currency: input.currency,
    ...(input.minimumHours !== undefined && { minimumHours: input.minimumHours }),
    ...(input.billingIncrement !== undefined && { billingIncrement: input.billingIncrement }),
    ...(input.overtimeRate !== undefined && { overtimeRate: input.overtimeRate }),
    ...(input.overtimeThreshold !== undefined && { overtimeThreshold: input.overtimeThreshold }),
  }
}

// ============================================================================
// Project Pricing
// ============================================================================

export interface Milestone {
  name: string
  percentage: number
}

export interface ProjectPricingConfig {
  model: 'project'
  basePrice: number
  currency: Currency
  scope?: string
  deliverables?: string[]
  milestones?: Milestone[]
  includedRevisions?: number
  revisionPrice?: number
  rushMultiplier?: number
  standardDeliveryDays?: number
}

export interface ProjectPricingInput {
  basePrice: number
  currency: Currency
  scope?: string
  deliverables?: string[]
  milestones?: Milestone[]
  includedRevisions?: number
  revisionPrice?: number
  rushMultiplier?: number
  standardDeliveryDays?: number
}

export function createProjectPricing(input: ProjectPricingInput): ProjectPricingConfig {
  return {
    model: 'project',
    ...input,
  }
}

// ============================================================================
// Subscription Pricing
// ============================================================================

export interface SubscriptionPricingConfig {
  model: 'subscription'
  monthlyPrice: number
  currency: Currency
  billingInterval: 'monthly' | 'quarterly' | 'yearly'
  features?: string[]
  annualDiscount?: number
  limits?: Record<string, number | string>
  overageRates?: Record<string, number>
  trialDays?: number
  trialRequiresCard?: boolean
  calculateAnnualPrice: () => number
}

export interface SubscriptionPricingInput {
  monthlyPrice: number
  currency: Currency
  billingInterval?: 'monthly' | 'quarterly' | 'yearly'
  features?: string[]
  annualDiscount?: number
  limits?: Record<string, number | string>
  overageRates?: Record<string, number>
  trialDays?: number
  trialRequiresCard?: boolean
}

export function createSubscriptionPricing(
  input: SubscriptionPricingInput
): SubscriptionPricingConfig {
  const annualDiscount = input.annualDiscount ?? 0

  return {
    model: 'subscription',
    monthlyPrice: input.monthlyPrice,
    currency: input.currency,
    billingInterval: input.billingInterval ?? 'monthly',
    ...(input.features !== undefined && { features: input.features }),
    annualDiscount,
    ...(input.limits !== undefined && { limits: input.limits }),
    ...(input.overageRates !== undefined && { overageRates: input.overageRates }),
    ...(input.trialDays !== undefined && { trialDays: input.trialDays }),
    ...(input.trialRequiresCard !== undefined && { trialRequiresCard: input.trialRequiresCard }),
    calculateAnnualPrice: () => {
      const yearlyBase = input.monthlyPrice * 12
      return yearlyBase * (1 - annualDiscount / 100)
    },
  }
}

// ============================================================================
// Pricing Tiers
// ============================================================================

export interface PricingTier {
  name: string
  basePrice: number
  currency: Currency
  features?: string[]
  isPopular?: boolean
}

export interface PricingTierInput {
  name: string
  basePrice: number
  currency: Currency
  features?: string[]
  isPopular?: boolean
}

export function createPricingTier(input: PricingTierInput): PricingTier {
  return { ...input }
}

// ============================================================================
// Calculate Price
// ============================================================================

export type PricingConfig =
  | HourlyPricingConfig
  | ProjectPricingConfig
  | SubscriptionPricingConfig
  | TieredPricingConfig

export interface TieredPricingConfig {
  model: 'tiered'
  tiers: Array<{ from: number; to?: number; pricePerUnit: number }>
  currency: Currency
}

export interface CalculatePriceInput {
  hours?: number
  revisions?: number
  deliveryDays?: number
  quantity?: number
  usage?: Record<string, number>
}

export function calculatePrice(pricing: PricingConfig, input: CalculatePriceInput): PriceResult {
  switch (pricing.model) {
    case 'hourly':
      return calculateHourlyPrice(pricing, input)
    case 'project':
      return calculateProjectPrice(pricing, input)
    case 'subscription':
      return calculateSubscriptionPrice(pricing, input)
    case 'tiered':
      return calculateTieredPrice(pricing, input)
    default:
      throw new Error(`Unknown pricing model`)
  }
}

function calculateHourlyPrice(
  pricing: HourlyPricingConfig,
  input: CalculatePriceInput
): PriceResult {
  let hours = input.hours ?? 0

  // Apply minimum hours
  if (pricing.minimumHours && hours < pricing.minimumHours) {
    hours = pricing.minimumHours
  }

  // Round up to billing increment
  if (pricing.billingIncrement) {
    const incrementInHours = pricing.billingIncrement / 60
    hours = Math.ceil(hours / incrementInHours) * incrementInHours
  }

  let amount: number

  // Calculate with overtime
  if (pricing.overtimeRate && pricing.overtimeThreshold && hours > pricing.overtimeThreshold) {
    const regularHours = pricing.overtimeThreshold
    const overtimeHours = hours - pricing.overtimeThreshold
    amount = regularHours * pricing.rate + overtimeHours * pricing.overtimeRate
  } else {
    amount = hours * pricing.rate
  }

  return { amount, currency: pricing.currency }
}

function calculateProjectPrice(
  pricing: ProjectPricingConfig,
  input: CalculatePriceInput
): PriceResult {
  let amount = pricing.basePrice

  // Add revision charges
  if (input.revisions && pricing.includedRevisions !== undefined && pricing.revisionPrice) {
    const extraRevisions = Math.max(0, input.revisions - pricing.includedRevisions)
    amount += extraRevisions * pricing.revisionPrice
  }

  // Apply rush multiplier
  if (input.deliveryDays && pricing.standardDeliveryDays && pricing.rushMultiplier) {
    if (input.deliveryDays < pricing.standardDeliveryDays) {
      amount *= pricing.rushMultiplier
    }
  }

  return { amount, currency: pricing.currency }
}

function calculateSubscriptionPrice(
  pricing: SubscriptionPricingConfig,
  input: CalculatePriceInput
): PriceResult {
  let amount = pricing.monthlyPrice

  // Calculate overage
  if (input.usage && pricing.limits && pricing.overageRates) {
    for (const [key, used] of Object.entries(input.usage)) {
      const limit = pricing.limits[key]
      const rate = pricing.overageRates[key]

      if (typeof limit === 'number' && rate && used > limit) {
        const overage = used - limit
        amount += overage * rate
      }
    }
  }

  return { amount, currency: pricing.currency }
}

function calculateTieredPrice(
  pricing: TieredPricingConfig,
  input: CalculatePriceInput
): PriceResult {
  const quantity = input.quantity ?? 0
  let amount = 0
  let remaining = quantity

  for (const tier of pricing.tiers) {
    if (remaining <= 0) break

    const tierSize = tier.to !== undefined ? tier.to - tier.from : Infinity
    const unitsInTier = Math.min(remaining, tierSize)

    amount += unitsInTier * tier.pricePerUnit
    remaining -= unitsInTier
  }

  return { amount, currency: pricing.currency }
}

// ============================================================================
// Discounts
// ============================================================================

export interface Discount {
  type: 'percentage' | 'fixed'
  value: number
}

export function applyDiscount(price: PriceResult, discount: Discount): PriceResult {
  let discountAmount: number

  if (discount.type === 'percentage') {
    discountAmount = price.amount * (discount.value / 100)
  } else {
    discountAmount = discount.value
  }

  const newAmount = Math.max(0, price.amount - discountAmount)

  return {
    amount: newAmount,
    currency: price.currency,
    discount: Math.min(discountAmount, price.amount),
  }
}

// ============================================================================
// Validation
// ============================================================================

export function validatePricing(pricing: unknown): boolean {
  if (!pricing || typeof pricing !== 'object') {
    throw new Error('Invalid pricing configuration')
  }

  const config = pricing as PricingConfig

  if (config.model === 'hourly') {
    if (config.rate < 0) {
      throw new Error('Hourly rate cannot be negative')
    }
  }

  if (config.model === 'project') {
    if (config.basePrice < 0) {
      throw new Error('Base price cannot be negative')
    }
  }

  if (config.model === 'subscription') {
    if (config.monthlyPrice < 0) {
      throw new Error('Monthly price cannot be negative')
    }
  }

  return true
}
