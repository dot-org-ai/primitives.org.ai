/**
 * Provider Capability Detection and Management
 *
 * This module provides runtime detection of provider capabilities,
 * enabling graceful degradation when advanced features are unavailable.
 *
 * @packageDocumentation
 */

import type { DBProvider } from './schema.js'
import { logWarn } from './logger.js'

// =============================================================================
// Provider Capabilities Interface
// =============================================================================

/**
 * Capability flags indicating which features a provider supports
 *
 * @example
 * ```ts
 * const capabilities: ProviderCapabilities = {
 *   hasSemanticSearch: true,
 *   hasEvents: true,
 *   hasActions: true,
 *   hasArtifacts: true,
 *   hasBatchOperations: true,
 * }
 * ```
 */
export interface ProviderCapabilities {
  /** Whether the provider supports semantic/vector search */
  hasSemanticSearch: boolean
  /** Whether the provider supports event emission and subscription */
  hasEvents: boolean
  /** Whether the provider supports durable actions (pending/active/completed) */
  hasActions: boolean
  /** Whether the provider supports artifact storage (embeddings, caches) */
  hasArtifacts: boolean
  /** Whether the provider supports batch operations with concurrency control */
  hasBatchOperations: boolean
}

// =============================================================================
// Capability Detection
// =============================================================================

/**
 * Cache for detected capabilities to avoid repeated introspection
 */
const capabilityCache = new WeakMap<object, ProviderCapabilities>()

/**
 * Detect which capabilities a provider supports by examining its methods
 *
 * Probes the provider for the presence of advanced methods to determine
 * which features are available. Results are cached per-provider.
 *
 * @param provider - The database provider to inspect
 * @returns Detected capabilities
 *
 * @example
 * ```ts
 * const provider = createMemoryProvider()
 * const capabilities = await detectCapabilities(provider)
 *
 * if (capabilities.hasSemanticSearch) {
 *   const results = await provider.semanticSearch('Post', 'machine learning')
 * } else {
 *   const results = await provider.search('Post', 'machine learning')
 * }
 * ```
 */
export async function detectCapabilities(provider: DBProvider): Promise<ProviderCapabilities> {
  // Check cache first
  const cached = capabilityCache.get(provider)
  if (cached) {
    return cached
  }

  // Cast to unknown first, then to Record for method inspection
  const p = provider as unknown as Record<string, unknown>

  const capabilities: ProviderCapabilities = {
    // Semantic search: requires semanticSearch and setEmbeddingsConfig methods
    hasSemanticSearch:
      typeof p['semanticSearch'] === 'function' && typeof p['setEmbeddingsConfig'] === 'function',

    // Events: requires on, emit, and listEvents methods
    hasEvents:
      typeof p['on'] === 'function' &&
      typeof p['emit'] === 'function' &&
      typeof p['listEvents'] === 'function',

    // Actions: requires createAction, getAction, and updateAction methods
    hasActions:
      typeof p['createAction'] === 'function' &&
      typeof p['getAction'] === 'function' &&
      typeof p['updateAction'] === 'function',

    // Artifacts: requires getArtifact and setArtifact methods
    hasArtifacts: typeof p['getArtifact'] === 'function' && typeof p['setArtifact'] === 'function',

    // Batch operations: requires withConcurrency or mapWithConcurrency methods
    hasBatchOperations:
      typeof p['withConcurrency'] === 'function' || typeof p['mapWithConcurrency'] === 'function',
  }

  // Cache the result
  capabilityCache.set(provider, capabilities)

  return capabilities
}

/**
 * Clear the capability cache for a specific provider
 *
 * Useful when a provider's capabilities change dynamically.
 *
 * @param provider - The provider to clear from cache
 */
export function clearCapabilityCache(provider: DBProvider): void {
  capabilityCache.delete(provider)
}

// =============================================================================
// CapabilityNotSupportedError
// =============================================================================

/**
 * Error thrown when attempting to use a feature that the provider doesn't support
 *
 * @example
 * ```ts
 * try {
 *   await provider.semanticSearch('Post', 'query')
 * } catch (e) {
 *   if (isCapabilityNotSupportedError(e)) {
 *     console.log(`${e.capability} is not supported, using fallback...`)
 *   }
 *   throw e
 * }
 * ```
 */
export class CapabilityNotSupportedError extends Error {
  public readonly code = 'CAPABILITY_NOT_SUPPORTED'
  public override readonly name = 'CapabilityNotSupportedError'

  constructor(
    /** The capability that was requested but not supported */
    public readonly capability: string,
    /** Optional custom error message */
    message?: string,
    /** Optional suggested alternative */
    public readonly alternative?: string
  ) {
    const defaultMessage = `Capability '${capability}' is not supported by this provider`
    super(message ?? defaultMessage)
  }
}

/**
 * Type guard to check if an error is a CapabilityNotSupportedError
 *
 * @param error - The error to check
 * @returns True if the error is a CapabilityNotSupportedError
 */
export function isCapabilityNotSupportedError(
  error: unknown
): error is CapabilityNotSupportedError {
  return (
    error instanceof CapabilityNotSupportedError ||
    (error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'CAPABILITY_NOT_SUPPORTED')
  )
}

// =============================================================================
// Capability Enforcement
// =============================================================================

/**
 * Require a capability to be available, throwing if not
 *
 * Use this before calling methods that require specific capabilities.
 *
 * @param capabilities - The detected capabilities
 * @param capability - The capability key to require
 * @param message - Optional custom error message
 * @throws CapabilityNotSupportedError if the capability is not available
 *
 * @example
 * ```ts
 * const capabilities = await detectCapabilities(provider)
 * requireCapability(capabilities, 'hasSemanticSearch')
 * // Safe to call semanticSearch now
 * ```
 */
export function requireCapability(
  capabilities: ProviderCapabilities,
  capability: keyof ProviderCapabilities,
  message?: string
): void {
  if (!capabilities[capability]) {
    throw new CapabilityNotSupportedError(capability, message)
  }
}

// =============================================================================
// Runtime Warnings
// =============================================================================

/**
 * Track which warnings have already been shown to avoid spam
 */
const shownWarnings = new Set<string>()

/**
 * Log a warning if a capability is unavailable (only once per capability)
 *
 * @param capabilities - The detected capabilities
 * @param capability - The capability key to check
 * @param featureName - Human-readable name for the warning message
 *
 * @example
 * ```ts
 * warnIfUnavailable(capabilities, 'hasSemanticSearch', 'semanticSearch')
 * // Logs: "Warning: semanticSearch is not available with this provider"
 * ```
 */
export function warnIfUnavailable(
  capabilities: ProviderCapabilities,
  capability: keyof ProviderCapabilities,
  featureName: string
): void {
  if (!capabilities[capability] && !shownWarnings.has(featureName)) {
    logWarn(`${featureName} is not available with this provider`)
    shownWarnings.add(featureName)
  }
}

/**
 * Clear warning suppression (useful for testing)
 */
export function clearWarningHistory(): void {
  shownWarnings.clear()
}

// =============================================================================
// Capability Matrix (Documentation)
// =============================================================================

/**
 * Standard capability matrix for known providers
 *
 * This is a reference for documentation purposes. Actual capabilities
 * are detected at runtime using detectCapabilities().
 */
export const PROVIDER_CAPABILITY_MATRIX: Record<string, ProviderCapabilities> = {
  MemoryProvider: {
    hasSemanticSearch: true,
    hasEvents: true,
    hasActions: true,
    hasArtifacts: true,
    hasBatchOperations: true,
  },
  RDBProvider: {
    hasSemanticSearch: false,
    hasEvents: false,
    hasActions: false,
    hasArtifacts: false,
    hasBatchOperations: false,
  },
  DigitalObjectsProvider: {
    hasSemanticSearch: false,
    hasEvents: false,
    hasActions: false,
    hasArtifacts: false,
    hasBatchOperations: false,
  },
}
