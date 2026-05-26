/**
 * language-models - Model listing and resolution
 *
 * Lists all available models and resolves aliases to full model IDs.
 *
 * @packageDocumentation
 */

export {
  resolve,
  resolveWithProvider,
  list,
  get,
  search,
  DIRECT_PROVIDERS,
  type ModelInfo,
  type ProviderEndpoint,
  type ResolvedModel,
  type DirectProvider,
} from './models.js'
export { ALIASES } from './aliases.js'

// Per-model resilience and tier policy data.
// The runtime *machinery* (RetryPolicy, CircuitBreaker, FallbackChain) lives
// in `ai-functions`; the *data* (which categories are retryable, which models
// to fall back to, which batch tiers are eligible) lives here alongside the
// catalog because it's a per-model concern.
export {
  policyFor,
  derivePolicy,
  defaultPolicy,
  resetPolicyCache,
  listAliases,
  DEFAULT_RETRY,
  DEFAULT_CIRCUIT_BREAKER,
  type ModelPolicy,
  type RetryPolicyData,
  type CircuitBreakerPolicyData,
  type BatchTier,
  type ErrorCategoryName,
  type ErrorMapping,
} from './policy.js'

// =============================================================================
// Pricing (consolidated from former @primitives/llm-pricing — see
// `./pricing/` for the source. Also re-exported under the subpath
// `language-models/pricing` for surgical imports.)
// =============================================================================
export {
  PRICING_TABLE,
  priceFor,
  listSlugs,
  hasPricing,
  rowsForSlug,
  type ModelPricing,
  type PricingTier,
  type Provider,
  type RateBlock,
  type PriceForArgs,
  type PriceForResult,
  type HasPricingArgs,
} from './pricing/index.js'
