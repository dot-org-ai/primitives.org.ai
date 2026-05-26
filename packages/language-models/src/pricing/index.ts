/**
 * language-models / pricing — canonical LLM model pricing table.
 *
 * Consume via the subpath export:
 *
 *   import { PRICING_TABLE, priceFor, type ModelPricing } from 'language-models/pricing'
 *
 * (Equivalent symbols are also re-exported from the package root —
 * `import { priceFor } from 'language-models'` works too.)
 *
 * Rates are sourced from public Vertex / Bedrock / AI Studio list prices.
 * `priceFor()` throws on unknown slug/tier rather than returning a silent
 * zero (per BYOK_GATEWAY_LIES discipline: loud failure beats silent
 * downgrade).
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

export { PRICING_TABLE } from './table.js'

export { priceFor, listSlugs, hasPricing, rowsForSlug } from './lookup.js'
