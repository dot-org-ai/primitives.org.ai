/**
 * ModelPolicy - per-model resilience and tier policy data
 *
 * `language-models` owns model identity (alias resolution, capability lookup).
 * Resilience policy (retry, circuit breaker, fallback chain, batch tier) is
 * a per-model concern that belongs alongside the catalog data — but the
 * runtime *machinery* that applies the policy lives in `ai-functions`.
 *
 * This module provides:
 * - `ModelPolicy` MDXLD type (`$type: 'ModelPolicy'`)
 * - `policyFor(alias)` - resolve an alias and return its derived policy
 * - `derivePolicy(model, alias?)` - inference layer that turns OpenRouter raw
 *   data into a policy by applying heuristics (newest frontier model is best,
 *   price within a family is inversely correlated with capability, etc.)
 *
 * Source of truth: OpenRouter raw catalog (data/models.json) + heuristics.
 * Strategy: runtime derivation, cached. A static snapshot generator could be
 * added later (see `derivePolicy` — it's pure, so you can pre-compute it).
 *
 * @packageDocumentation
 */

import { resolve, get, list, type ModelInfo } from './models.js'
import { ALIASES } from './aliases.js'

// ============================================================================
// MDXLD types
// ============================================================================

/**
 * Error category taxonomy. Mirrors `ai-functions`'s `ErrorCategory` enum by
 * string value — we don't import it (circular), but the strings line up.
 */
export type ErrorCategoryName =
  | 'network'
  | 'rate_limit'
  | 'invalid_input'
  | 'authentication'
  | 'server'
  | 'context_length'
  | 'unknown'

/**
 * Retry classification: which error categories are retryable for this model,
 * plus backoff parameters.
 */
export interface RetryPolicyData {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  multiplier: number
  jitter: number
  /** Categories that should trigger a retry */
  retryableCategories: ErrorCategoryName[]
}

/**
 * Circuit-breaker policy data (per-model state keys come from the alias).
 */
export interface CircuitBreakerPolicyData {
  failureThreshold: number
  resetTimeout: number
  successThreshold: number
}

/**
 * Tiers a model is eligible for.
 *
 * - `immediate`: synchronous online inference (always available)
 * - `flex`: faster-than-batch processing (~minutes, ~50% discount)
 *   — only OpenAI/Bedrock currently
 * - `batch`: batch API processing (~hours, ~50% discount)
 *   — OpenAI/Anthropic/Google/Bedrock/Cloudflare
 */
export type BatchTier = 'immediate' | 'flex' | 'batch'

/**
 * Provider-specific HTTP status code → ErrorCategory mapping.
 * Empty here by default — `ai-functions/retry.ts#classifyError` handles the
 * common cases. Override per-model if a provider has unusual error codes.
 */
export type ErrorMapping = Record<number, ErrorCategoryName>

/**
 * MDXLD-shaped per-model resilience and tier policy.
 *
 * `$type: 'ModelPolicy'`, `$id` is the resolved model id (e.g.
 * `'anthropic/claude-opus-4.5'`).
 */
export interface ModelPolicy {
  $type: 'ModelPolicy'
  $id: string
  /** Provider slug (e.g. 'anthropic') */
  provider: string
  retry: RetryPolicyData
  circuitBreaker: CircuitBreakerPolicyData
  /** Ordered list of model ids to try after this one fails */
  fallbackChain: string[]
  /** Tiers this model is eligible for */
  batchTier: BatchTier[]
  /** Provider-specific HTTP code → category overrides */
  errorMapping: ErrorMapping
}

// ============================================================================
// Defaults & heuristics
// ============================================================================

/** Frontier labs — newer releases tend to be more capable. */
const FRONTIER_PROVIDERS = new Set(['anthropic', 'openai', 'google'])

/** Providers with batch APIs supported by ai-functions. */
const BATCH_PROVIDERS = new Set(['anthropic', 'openai', 'google', 'amazon-bedrock', 'cloudflare'])

/** Providers with flex (faster-than-batch) APIs. */
const FLEX_PROVIDERS = new Set(['openai', 'amazon-bedrock'])

/** Curated fallback seeds — picked one per frontier family. */
const FRONTIER_FALLBACK: readonly string[] = [
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-opus-4.5',
  'openai/gpt-4o',
  'google/gemini-2.5-pro',
]

/** Default retry policy — matches `ai-functions` `RetryPolicy` defaults. */
export const DEFAULT_RETRY: RetryPolicyData = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: 0,
  retryableCategories: ['network', 'rate_limit', 'server', 'unknown'],
}

/** Default circuit breaker — matches `ai-functions` defaults. */
export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerPolicyData = {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 1,
}

/**
 * Default policy for an unknown model. Used when no catalog entry is found.
 */
export function defaultPolicy(modelId: string): ModelPolicy {
  const provider = modelId.includes('/') ? modelId.split('/')[0]! : 'unknown'
  return {
    $type: 'ModelPolicy',
    $id: modelId,
    provider,
    retry: { ...DEFAULT_RETRY },
    circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER },
    fallbackChain: [],
    batchTier: ['immediate'],
    errorMapping: {},
  }
}

// ============================================================================
// Derivation layer
// ============================================================================

/**
 * Parse a price-per-token string to a number. Returns 0 on parse failure.
 * Pricing comes through OpenRouter as a string (e.g. "0.000003").
 */
function parsePrice(p?: string): number {
  if (!p) return 0
  const n = Number(p)
  return Number.isFinite(n) ? n : 0
}

/**
 * Extract a "family" key from a model id for fallback grouping.
 * 'anthropic/claude-opus-4.5' → 'anthropic/claude'
 * 'openai/gpt-4o-mini' → 'openai/gpt'
 */
function familyKey(id: string): string {
  const slash = id.indexOf('/')
  if (slash < 0) return id
  const provider = id.substring(0, slash)
  const rest = id.substring(slash + 1).toLowerCase()
  // Strip trailing version tags / size qualifiers
  const family = rest
    .replace(/[-_]?\d.*$/, '') // drop -4.5, -2.0, etc
    .replace(/(opus|sonnet|haiku|mini|pro|flash|lite|maverick|instruct).*$/, '$1')
    .replace(/-?(opus|sonnet|haiku|mini|pro|flash|lite|maverick|instruct)$/, '')
  return `${provider}/${family || rest.split('-')[0]}`
}

/**
 * Derive the fallback chain for a model.
 *
 * Heuristics:
 * 1. Prefer same-family siblings (e.g. sonnet → opus → haiku within Claude)
 *    ordered by `created` (newer first), then by price descending (more
 *    expensive within a family is usually more capable).
 * 2. Then fall back to frontier-lab seeds, skipping the model itself and
 *    anything from the same family already included.
 * 3. Cap at 4 entries to keep latency bounded.
 */
function deriveFallbackChain(model: ModelInfo, allModels: ModelInfo[]): string[] {
  const chain: string[] = []
  const seen = new Set<string>([model.id])
  const fam = familyKey(model.id)

  // Step 1: same-family siblings, sorted newest-first then by price desc.
  const siblings = allModels
    .filter((m) => m.id !== model.id && familyKey(m.id) === fam)
    .map((m) => ({
      m,
      created: (m as ModelInfo & { created?: number }).created ?? 0,
      price: parsePrice(m.pricing?.completion),
    }))
    .sort((a, b) => {
      if (b.created !== a.created) return b.created - a.created
      return b.price - a.price
    })

  for (const { m } of siblings.slice(0, 2)) {
    if (!seen.has(m.id)) {
      chain.push(m.id)
      seen.add(m.id)
    }
  }

  // Step 2: frontier seeds.
  for (const seed of FRONTIER_FALLBACK) {
    if (chain.length >= 4) break
    if (seen.has(seed)) continue
    if (familyKey(seed) === fam) continue
    chain.push(seed)
    seen.add(seed)
  }

  return chain
}

/**
 * Derive batch-tier eligibility from provider capability.
 */
function deriveBatchTiers(provider: string): BatchTier[] {
  const tiers: BatchTier[] = ['immediate']
  if (FLEX_PROVIDERS.has(provider)) tiers.push('flex')
  if (BATCH_PROVIDERS.has(provider)) tiers.push('batch')
  return tiers
}

/**
 * Derive the retry policy. Frontier providers get one extra attempt because
 * their rate limits are typically more transient than long-tail providers.
 */
function deriveRetry(provider: string): RetryPolicyData {
  if (FRONTIER_PROVIDERS.has(provider)) {
    return { ...DEFAULT_RETRY, maxRetries: 4, jitter: 0.2 }
  }
  return { ...DEFAULT_RETRY }
}

/**
 * Derive the circuit-breaker policy. Frontier providers get a higher
 * failure threshold (more capacity) and a shorter reset timeout.
 */
function deriveCircuitBreaker(provider: string): CircuitBreakerPolicyData {
  if (FRONTIER_PROVIDERS.has(provider)) {
    return { failureThreshold: 8, resetTimeout: 20000, successThreshold: 1 }
  }
  return { ...DEFAULT_CIRCUIT_BREAKER }
}

/**
 * Derivation layer — turn a `ModelInfo` (from OpenRouter raw data) into a
 * `ModelPolicy` by applying heuristics.
 *
 * Pure function; safe to call at build time to pre-compute a static snapshot.
 *
 * @param model - The catalog entry for the model.
 * @param allModels - The full catalog, used for sibling lookup. Optional;
 *   defaults to `list()`.
 */
export function derivePolicy(model: ModelInfo, allModels?: ModelInfo[]): ModelPolicy {
  const all = allModels ?? list()
  const slash = model.id.indexOf('/')
  const provider = slash > 0 ? model.id.substring(0, slash) : model.provider ?? 'unknown'

  return {
    $type: 'ModelPolicy',
    $id: model.id,
    provider,
    retry: deriveRetry(provider),
    circuitBreaker: deriveCircuitBreaker(provider),
    fallbackChain: deriveFallbackChain(model, all),
    batchTier: deriveBatchTiers(provider),
    errorMapping: {},
  }
}

// ============================================================================
// Public API
// ============================================================================

/** Per-process cache of derived policies, keyed by resolved model id. */
const policyCache = new Map<string, ModelPolicy>()

/**
 * Resolve an alias (or full model id) and return its policy.
 *
 * Falls back to `defaultPolicy(id)` if the model is not in the catalog —
 * callers always get a usable policy.
 *
 * @example
 * ```ts
 * const p = policyFor('sonnet')
 * // p.fallbackChain → ['anthropic/claude-opus-4.5', 'openai/gpt-4o', ...]
 * // p.batchTier     → ['immediate', 'batch']
 * ```
 */
export function policyFor(input: string): ModelPolicy {
  const id = resolve(input)
  const cached = policyCache.get(id)
  if (cached) return cached

  const model = get(id)
  const policy = model ? derivePolicy(model) : defaultPolicy(id)
  policyCache.set(id, policy)
  return policy
}

/**
 * Reset the policy cache. Useful for tests, or after the catalog is reloaded.
 */
export function resetPolicyCache(): void {
  policyCache.clear()
}

/**
 * List all known aliases. Convenience for tooling that wants to enumerate
 * derived policies (e.g. a static snapshot generator).
 */
export function listAliases(): string[] {
  return Object.keys(ALIASES)
}
