/**
 * Model listing and resolution
 */

import { createRequire } from 'module'
import { ALIASES } from './aliases.js'

const require = createRequire(import.meta.url)

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
  return loadModels().find(m => m.id === id)
}

/**
 * Search models by query string
 * Searches in id and name fields
 */
export function search(query: string): ModelInfo[] {
  const q = query.toLowerCase()
  return loadModels().filter(m =>
    m.id.toLowerCase().includes(q) ||
    m.name.toLowerCase().includes(q)
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
  if (matches.length > 0) {
    return matches[0].id
  }

  // Return as-is if nothing found
  return input
}
