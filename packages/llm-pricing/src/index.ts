/**
 * @primitives/llm-pricing — public entry point.
 *
 * Three subpath exports for consumers that want to import surgically:
 *
 *   import { PRICING_TABLE } from '@primitives/llm-pricing/pricing'
 *   import { priceFor }      from '@primitives/llm-pricing/lookup'
 *   import type { ModelPricing } from '@primitives/llm-pricing/types'
 *
 * Or just the everything bundle from the root:
 *
 *   import { priceFor, PRICING_TABLE, type ModelPricing } from '@primitives/llm-pricing'
 */

export type {
  HasPricingArgs,
  ModelPricing,
  PriceForArgs,
  PriceForResult,
  PricingTier,
  Provider,
  RateBlock,
} from './types.js'

export { PRICING_TABLE } from './pricing.js'

export { priceFor, listSlugs, hasPricing, rowsForSlug } from './lookup.js'
