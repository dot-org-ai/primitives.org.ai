/**
 * AI Schemas - Schema-based AI function generation
 *
 * This module provides functionality for creating AI functions from
 * simple schema definitions using the SimpleSchema format.
 */

import { generateObject } from './generate.js'
import type { SimpleSchema } from './schema.js'
import type { LanguageModel } from 'ai'

/**
 * Options for AI schema functions (subset of generateObject options)
 */
export interface AISchemaOptions {
  /** Model to use (string alias or LanguageModel) */
  model?: string | LanguageModel
  /** System prompt */
  system?: string
  /** Generation mode */
  mode?: 'auto' | 'json' | 'tool'
  /** Temperature (0-2) */
  temperature?: number
  /** Top P sampling */
  topP?: number
  /** Top K sampling */
  topK?: number
  /** Presence penalty */
  presencePenalty?: number
  /** Frequency penalty */
  frequencyPenalty?: number
  /** Max tokens to generate */
  maxTokens?: number
  /** Max retries on failure */
  maxRetries?: number
  /** Abort signal */
  abortSignal?: AbortSignal
  /** Custom headers */
  headers?: Record<string, string>
}

/**
 * Schema-based functions type
 */
export type SchemaFunctions<T extends Record<string, SimpleSchema>> = {
  [K in keyof T]: (
    prompt?: string,
    options?: AISchemaOptions
  ) => Promise<InferSimpleSchemaResult<T[K]>>
}

/**
 * Infer result type from simple schema
 */
export type InferSimpleSchemaResult<T> = T extends string
  ? string
  : T extends [string]
  ? string[]
  : T extends { [K: string]: SimpleSchema }
  ? { [K in keyof T]: InferSimpleSchemaResult<T[K]> }
  : unknown

/**
 * Build a prompt by extracting descriptions from the schema
 */
function buildPromptFromSchema(schema: SimpleSchema, path = ''): string {
  if (typeof schema === 'string') {
    return schema
  }

  if (Array.isArray(schema)) {
    return (schema[0] as string) || 'Generate items'
  }

  if (typeof schema === 'object' && schema !== null) {
    const descriptions: string[] = []
    for (const [key, value] of Object.entries(schema)) {
      const subPrompt = buildPromptFromSchema(value as SimpleSchema, path ? `${path}.${key}` : key)
      if (subPrompt) {
        descriptions.push(`${key}: ${subPrompt}`)
      }
    }
    return descriptions.length > 0 ? `Generate the following:\n${descriptions.join('\n')}` : ''
  }

  return ''
}

/**
 * Create schema-based functions from a map of schemas
 */
export function createSchemaFunctions<T extends Record<string, SimpleSchema>>(
  schemas: T,
  defaultOptions: AISchemaOptions = {}
): SchemaFunctions<T> {
  const functions: Record<
    string,
    (prompt?: string, options?: AISchemaOptions) => Promise<unknown>
  > = {}

  for (const [name, schema] of Object.entries(schemas)) {
    functions[name] = async (prompt?: string, options?: AISchemaOptions) => {
      const mergedOptions = { ...defaultOptions, ...options }
      const { model = 'sonnet', system, ...rest } = mergedOptions

      // Build prompt from schema descriptions if none provided
      const schemaPrompt = prompt || buildPromptFromSchema(schema)

      const result = await generateObject({
        model,
        schema,
        prompt: schemaPrompt,
        ...(system !== undefined && { system }),
        ...rest,
      })

      return result.object
    }
  }

  return functions as SchemaFunctions<T>
}
