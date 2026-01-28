/**
 * AIValueGenerator Implementation
 *
 * Generates values using AI/LLM integration for production use.
 * Supports context-aware generation with parent chain and array context.
 *
 * @packageDocumentation
 */

import type { ValueGenerator, GenerationRequest, GenerationResult, AIFunction } from './types.js'
import { PlaceholderValueGenerator } from './placeholder.js'

/**
 * Configuration for AIValueGenerator
 */
export interface AIValueGeneratorConfig {
  /** AI function for generating values */
  aiFunction: AIFunction
  /** Model to use for generation */
  model?: string
  /** Maximum tokens for generation */
  maxTokens?: number
  /** Temperature for generation */
  temperature?: number
  /** Whether to fall back to placeholder on AI errors */
  fallbackToPlaceholder?: boolean
}

/**
 * AIValueGenerator
 *
 * Generates values using an AI function for production use.
 * Builds rich context from parent chain, previous generations, and array context.
 */
export class AIValueGenerator implements ValueGenerator {
  private aiFunction: AIFunction
  private model?: string
  private maxTokens?: number
  private temperature?: number
  private fallbackToPlaceholder: boolean
  private placeholderGenerator: PlaceholderValueGenerator

  constructor(config: AIValueGeneratorConfig) {
    this.aiFunction = config.aiFunction
    if (config.model !== undefined) this.model = config.model
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens
    if (config.temperature !== undefined) this.temperature = config.temperature
    this.fallbackToPlaceholder = config.fallbackToPlaceholder ?? false
    this.placeholderGenerator = new PlaceholderValueGenerator()
  }

  /**
   * Generate a value using AI
   *
   * @param request - The generation request
   * @returns Promise resolving to the generated value with metadata
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const prompt = this.buildPrompt(request)
      const response = await this.aiFunction(prompt)

      const metadata: { source: 'ai'; model?: string; tokens?: number } = {
        source: 'ai',
      }
      if (this.model !== undefined) metadata.model = this.model
      if (response.usage?.tokens !== undefined) metadata.tokens = response.usage.tokens
      return {
        value: response.text,
        metadata,
      }
    } catch (error) {
      if (this.fallbackToPlaceholder) {
        const placeholderResult = await this.placeholderGenerator.generate(request)
        return {
          value: placeholderResult.value,
          metadata: {
            source: 'placeholder',
            fallback: true,
          },
        }
      }
      throw error
    }
  }

  /**
   * Build a prompt from the generation request
   *
   * Combines field info, context, hints, and generation context
   * into a comprehensive prompt for the AI.
   */
  private buildPrompt(request: GenerationRequest): string {
    const parts: string[] = []

    // Add field and type context
    parts.push(`Generate a value for field "${request.fieldName}" on type "${request.type}".`)

    // Add full context if available
    if (request.fullContext) {
      parts.push(`Context: ${request.fullContext}`)
    }

    // Add hint if available
    if (request.hint) {
      parts.push(`Hint: ${request.hint}`)
    }

    // Add parent data context
    if (request.parentData && Object.keys(request.parentData).length > 0) {
      const parentEntries = Object.entries(request.parentData)
        .filter(
          ([key, value]) =>
            !key.startsWith('$') && !key.startsWith('_') && typeof value === 'string'
        )
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      if (parentEntries) {
        parts.push(`Parent data: ${parentEntries}`)
      }
    }

    // Add generation context if available
    const genCtx = request.generationContext
    if (genCtx) {
      // Add parent chain context
      if (genCtx.parentChain && genCtx.parentChain.length > 0) {
        const chainInfo = genCtx.parentChain
          .map((entity) => {
            const name = entity['name'] || entity['title'] || entity.$id
            return `${entity.$type}: ${name}`
          })
          .join(' > ')
        parts.push(`Parent chain: ${chainInfo}`)
      }

      // Add previously generated entities
      if (genCtx.previouslyGenerated && genCtx.previouslyGenerated.length > 0) {
        const prevInfo = genCtx.previouslyGenerated
          .map((entity) => {
            const name = entity['name'] || entity['title'] || entity.$id
            return `${entity.$type}: ${name}`
          })
          .join(', ')
        parts.push(`Previously generated: ${prevInfo}`)
      }

      // Add array context
      if (genCtx.arrayContext) {
        const { fieldName, previousItems, index } = genCtx.arrayContext
        parts.push(`Array field: ${fieldName}, generating item ${index + 1}`)
        if (previousItems.length > 0) {
          const prevItemsInfo = previousItems
            .map((item) => item['name'] || item['title'] || item.$id)
            .join(', ')
          parts.push(`Previous items: ${prevItemsInfo}`)
        }
      }
    }

    return parts.join('\n')
  }
}
