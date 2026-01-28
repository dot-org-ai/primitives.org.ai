/**
 * ValueGenerator Module
 *
 * Strategy pattern for value generation during entity creation.
 * Supports both placeholder (deterministic test fixtures) and
 * AI-powered (production) generation.
 *
 * @example
 * ```typescript
 * // Use placeholder generator for testing
 * const generator = createValueGenerator({ type: 'placeholder' })
 * const result = await generator.generate({
 *   fieldName: 'name',
 *   type: 'Person',
 *   fullContext: 'tech entrepreneur startup',
 * })
 *
 * // Configure global generator for AI in production
 * configureValueGenerator({
 *   type: 'ai',
 *   aiFunction: async (prompt) => ({ text: await callAI(prompt) }),
 * })
 * ```
 *
 * @packageDocumentation
 */

// Re-export types
export type {
  GenerationRequest,
  GenerationResult,
  GenerationMetadata,
  ValueGenerator,
  ValueGeneratorConfig,
  AIFunction,
  ArrayContext,
  GenerationContextData,
} from './types.js'

// Re-export implementations
export { PlaceholderValueGenerator } from './placeholder.js'
export { AIValueGenerator } from './ai.js'
export type { AIValueGeneratorConfig } from './ai.js'

import type { ValueGenerator, ValueGeneratorConfig } from './types.js'
import { PlaceholderValueGenerator } from './placeholder.js'
import { AIValueGenerator } from './ai.js'

// =============================================================================
// Global Generator Configuration
// =============================================================================

/** Current global generator instance */
let currentGenerator: ValueGenerator | null = null

/** Current configuration */
let currentConfig: ValueGeneratorConfig = { type: 'placeholder' }

/**
 * Create a ValueGenerator based on configuration
 *
 * @param config - Generator configuration
 * @returns A new ValueGenerator instance
 * @throws Error if AI type is specified without aiFunction
 *
 * @example
 * ```typescript
 * // Create placeholder generator (default)
 * const placeholderGen = createValueGenerator()
 *
 * // Create placeholder generator explicitly
 * const placeholderGen = createValueGenerator({ type: 'placeholder' })
 *
 * // Create AI generator
 * const aiGen = createValueGenerator({
 *   type: 'ai',
 *   aiFunction: async (prompt) => ({ text: 'AI response' }),
 * })
 * ```
 */
export function createValueGenerator(config: ValueGeneratorConfig = {}): ValueGenerator {
  const type = config.type ?? 'placeholder'

  if (type === 'ai') {
    if (!config.aiFunction) {
      throw new Error('aiFunction is required when creating an AI value generator')
    }
    const aiConfig: import('./ai.js').AIValueGeneratorConfig = {
      aiFunction: config.aiFunction,
    }
    if (config.model !== undefined) aiConfig.model = config.model
    if (config.maxTokens !== undefined) aiConfig.maxTokens = config.maxTokens
    if (config.temperature !== undefined) aiConfig.temperature = config.temperature
    if (config.fallbackToPlaceholder !== undefined)
      aiConfig.fallbackToPlaceholder = config.fallbackToPlaceholder
    return new AIValueGenerator(aiConfig)
  }

  return new PlaceholderValueGenerator()
}

/**
 * Configure the global default value generator
 *
 * Call this at application startup to set the default generator
 * that will be used throughout the application.
 *
 * @param config - Generator configuration
 *
 * @example
 * ```typescript
 * // Use placeholder for testing
 * configureValueGenerator({ type: 'placeholder' })
 *
 * // Use AI for production
 * configureValueGenerator({
 *   type: 'ai',
 *   aiFunction: myAIFunction,
 *   model: 'claude-3',
 *   fallbackToPlaceholder: true,
 * })
 * ```
 */
export function configureValueGenerator(config: ValueGeneratorConfig): void {
  currentConfig = { ...config }
  currentGenerator = null // Reset so next getValueGenerator creates a new instance
}

/**
 * Get the current global value generator
 *
 * Returns the configured generator instance, creating one if needed.
 * Use this to get the generator configured via configureValueGenerator.
 *
 * @returns The current ValueGenerator instance
 *
 * @example
 * ```typescript
 * const generator = getValueGenerator()
 * const result = await generator.generate({
 *   fieldName: 'description',
 *   type: 'Product',
 * })
 * ```
 */
export function getValueGenerator(): ValueGenerator {
  if (!currentGenerator) {
    currentGenerator = createValueGenerator(currentConfig)
  }
  return currentGenerator
}

// =============================================================================
// Legacy Compatibility
// =============================================================================

/**
 * Generate a context-aware value for a field
 *
 * This is a convenience function that uses the global generator.
 * Equivalent to calling `getValueGenerator().generate(request)`.
 *
 * @deprecated Use `getValueGenerator().generate()` instead
 *
 * @param fieldName - The name of the field being generated
 * @param type - The entity type name
 * @param fullContext - Combined context string
 * @param hint - Optional hint text for guiding generation
 * @param parentData - Parent entity data for context inheritance
 * @returns A generated string value
 */
export async function generateContextAwareValue(
  fieldName: string,
  type: string,
  fullContext: string,
  hint: string | undefined,
  parentData: Record<string, unknown> = {}
): Promise<string> {
  const generator = getValueGenerator()
  const request: import('./types.js').GenerationRequest = {
    fieldName,
    type,
    fullContext,
    parentData,
  }
  if (hint !== undefined) request.hint = hint
  const result = await generator.generate(request)
  return result.value
}

/**
 * Synchronous wrapper for generateContextAwareValue
 *
 * Uses the PlaceholderValueGenerator directly for synchronous calls.
 * This maintains backward compatibility with existing cascade.ts code.
 *
 * @param fieldName - The name of the field being generated
 * @param type - The entity type name
 * @param fullContext - Combined context string
 * @param hint - Optional hint text for guiding generation
 * @param parentData - Parent entity data for context inheritance
 * @returns A generated string value
 */
export function generateContextAwareValueSync(
  fieldName: string,
  type: string,
  fullContext: string,
  hint: string | undefined,
  parentData: Record<string, unknown> = {}
): string {
  // Use placeholder generator directly for sync calls
  const generator = new PlaceholderValueGenerator()
  // Access the private generateValue method via the generate interface
  // Since we know PlaceholderValueGenerator.generate is sync-compatible
  const request: import('./types.js').GenerationRequest = {
    fieldName,
    type,
    fullContext,
    parentData,
  }
  if (hint !== undefined) request.hint = hint

  // We can safely synchronously return since PlaceholderValueGenerator
  // doesn't actually do any async work in its current implementation
  let result = ''
  void generator.generate(request).then((r) => {
    result = r.value
  })

  // For true sync behavior, we need to inline the logic
  // This duplicates the logic but maintains backward compatibility
  const value = parentData[fieldName]
  if (typeof value === 'string' && value) {
    return value
  }

  if (!fullContext || fullContext.trim() === '') {
    return `Generated ${fieldName} for ${type}`
  }

  const contextLower = fullContext.toLowerCase()
  const hintLower = (hint || '').toLowerCase()

  // Minimal subset of field handlers for common cases
  // Full logic is in PlaceholderValueGenerator
  if (fieldName === 'name') {
    if (hintLower.includes('philosopher') || contextLower.includes('philosopher'))
      return 'Aristotle'
    if (hintLower.includes('tech entrepreneur') || hintLower.includes('startup')) return 'Alex Chen'
    if (hint && hint.trim()) return `${type}: ${hint}`
    return `Generated ${fieldName} for ${type}`
  }

  // For all other fields, use a basic fallback
  return `${fieldName}: ${fullContext}`
}
