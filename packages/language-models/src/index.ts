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
