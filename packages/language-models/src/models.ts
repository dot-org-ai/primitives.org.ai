/**
 * Model listing and resolution
 */

import { createRequire } from 'module'
import { ALIASES } from './aliases.js'

const require = createRequire(import.meta.url)

/**
 * Provider endpoint information for direct API access
 */
export interface ProviderEndpoint {
  /** Provider's API base URL (e.g., https://api.anthropic.com/v1) */
  baseUrl: string
  /** Provider's model ID (e.g., claude-opus-4-5-20251101) */
  modelId: string
}

export interface ModelInfo {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  architecture?: {
    modality: string
    input_modalities: string[]
    output_modalities: string[]
  }
  /** Provider slug (e.g., 'anthropic', 'openai', 'google') */
  provider?: string
  /** Provider's native model ID for direct API calls */
  provider_model_id?: string
  /** Provider endpoint info for direct routing */
  endpoint?: ProviderEndpoint
}

// Load models from JSON
let modelsCache: ModelInfo[] | null = null

function loadModels(): ModelInfo[] {
  if (modelsCache) return modelsCache
  try {
    modelsCache = require('../data/models.json')
    return modelsCache!
  } catch {
    return []
  }
}

/**
 * List all available models
 */
export function list(): ModelInfo[] {
  return loadModels()
}

/**
 * Get a model by exact ID
 */
export function get(id: string): ModelInfo | undefined {
  return loadModels().find((m) => m.id === id)
}

/**
 * Search models by query string
 * Searches in id and name fields
 */
export function search(query: string): ModelInfo[] {
  const q = query.toLowerCase()
  return loadModels().filter(
    (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  )
}

/**
 * Resolve a model alias or partial name to a full model ID
 *
 * Resolution order:
 * 1. Check aliases (e.g., 'opus' -> 'anthropic/claude-opus-4.5')
 * 2. Check if it's already a full ID (contains '/')
 * 3. Search for first matching model
 *
 * @example
 * resolve('opus')           // 'anthropic/claude-opus-4.5'
 * resolve('gpt-4o')         // 'openai/gpt-4o'
 * resolve('claude-sonnet')  // 'anthropic/claude-sonnet-4.5'
 * resolve('llama-70b')      // 'meta-llama/llama-3.3-70b-instruct'
 */
export function resolve(input: string): string {
  const normalized = input.toLowerCase().trim()

  // Check aliases first
  if (ALIASES[normalized]) {
    return ALIASES[normalized]
  }

  // Already a full ID with provider prefix
  if (input.includes('/')) {
    // Verify it exists or return as-is
    const model = get(input)
    return model?.id || input
  }

  // Search for matching model
  const matches = search(normalized)
  const firstMatch = matches[0]
  if (firstMatch) {
    return firstMatch.id
  }

  // Return as-is if nothing found
  return input
}

/**
 * Providers that support direct SDK access (not via OpenRouter)
 * These providers have special capabilities like MCP, extended thinking, etc.
 */
export const DIRECT_PROVIDERS = ['openai', 'anthropic', 'google'] as const
export type DirectProvider = (typeof DIRECT_PROVIDERS)[number]

/**
 * Result of resolving a model with provider routing info
 */
export interface ResolvedModel {
  /** OpenRouter-style model ID (e.g., 'anthropic/claude-opus-4.5') */
  id: string
  /** Provider slug (e.g., 'anthropic', 'openai', 'google') */
  provider: string
  /** Provider's native model ID (e.g., 'claude-opus-4-5-20251101') */
  providerModelId?: string
  /** Whether this provider supports direct SDK routing */
  supportsDirectRouting: boolean
  /** Full model info if available */
  model?: ModelInfo
}

/**
 * Resolve a model alias and get full routing information
 *
 * @example
 * const info = resolveWithProvider('opus')
 * // {
 * //   id: 'anthropic/claude-opus-4.5',
 * //   provider: 'anthropic',
 * //   providerModelId: 'claude-opus-4-5-20251101',
 * //   supportsDirectRouting: true,
 * //   model: { ... }
 * // }
 */
export function resolveWithProvider(input: string): ResolvedModel {
  const id = resolve(input)
  const model = get(id)

  // Extract provider from ID (e.g., 'anthropic' from 'anthropic/claude-opus-4.5')
  const slashIndex = id.indexOf('/')
  const provider = slashIndex > 0 ? id.substring(0, slashIndex) : 'unknown'

  const supportsDirectRouting = (DIRECT_PROVIDERS as readonly string[]).includes(provider)

  const result: ResolvedModel = { id, provider, supportsDirectRouting }
  if (model) result.model = model
  if (model?.provider_model_id) result.providerModelId = model.provider_model_id
  return result
}
