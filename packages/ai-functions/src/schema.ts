/**
 * Simplified schema syntax for AI generation
 *
 * Converts human-readable schema definitions to Zod schemas:
 * - 'description' → z.string().describe('description')
 * - 'description (number)' → z.number().describe('description')
 * - 'description (boolean)' → z.boolean().describe('description')
 * - 'description (integer)' → z.number().int().describe('description')
 * - 'description (date)' → z.string().datetime().describe('description')
 * - 'opt1 | opt2 | opt3' → z.enum(['opt1', 'opt2', 'opt3'])
 * - ['description'] → z.array(z.string()).describe('description')
 * - { nested } → z.object() recursively
 *
 * @packageDocumentation
 */

import { z, type ZodTypeAny } from 'zod'
import { isZodSchema } from '@org.ai/core'

/**
 * Simplified schema types
 */
export type SimpleSchema =
  | string                           // z.string().describe(value)
  | [string]                         // z.array(z.string()).describe(value)
  | [number]                         // z.array(z.number()).describe(value)
  | [SimpleSchema]                   // z.array(converted).describe(value)
  | { [key: string]: SimpleSchema }  // z.object() recursively
  | ZodTypeAny                       // Pass-through for actual Zod schemas

/**
 * Convert a simplified schema to a Zod schema
 *
 * @example
 * ```ts
 * import { schema } from 'ai-functions'
 * import { z } from 'zod'
 *
 * // These are equivalent:
 * const simple = schema({
 *   name: 'What is the recipe name?',
 *   ingredients: ['List all ingredients'],
 *   steps: ['List all cooking steps'],
 * })
 *
 * const zod = z.object({
 *   name: z.string().describe('What is the recipe name?'),
 *   ingredients: z.array(z.string()).describe('List all ingredients'),
 *   steps: z.array(z.string()).describe('List all cooking steps'),
 * })
 * ```
 */
export function schema<T extends SimpleSchema>(input: T): ZodTypeAny {
  return convertToZod(input)
}

function convertToZod(input: SimpleSchema): ZodTypeAny {
  // Already a Zod schema - pass through
  if (isZodSchema(input)) {
    return input
  }

  // String handling
  if (typeof input === 'string') {
    // Enum syntax: 'option1 | option2 | option3'
    if (input.includes(' | ')) {
      const options = input.split(' | ').map(s => s.trim())
      return z.enum(options as [string, ...string[]])
    }

    // Type hint syntax: 'description (type)'
    const typeMatch = input.match(/^(.+?)\s*\((number|boolean|integer|date)\)$/i)
    if (typeMatch) {
      const [, description, type] = typeMatch
      const desc = description!.trim()
      switch (type!.toLowerCase()) {
        case 'number':
          return z.number().describe(desc)
        case 'integer':
          return z.number().int().describe(desc)
        case 'boolean':
          return z.boolean().describe(desc)
        case 'date':
          return z.string().datetime().describe(desc)
        default:
          return z.string().describe(desc)
      }
    }

    // Regular string description → z.string().describe()
    return z.string().describe(input)
  }

  // Array with single element → z.array().describe()
  if (Array.isArray(input) && input.length === 1) {
    const [desc] = input

    // [string] → z.array(z.string()).describe(string)
    if (typeof desc === 'string') {
      return z.array(z.string()).describe(desc)
    }

    // [number] → z.array(z.number()) - number as type indicator
    if (typeof desc === 'number') {
      return z.array(z.number())
    }

    // [SimpleSchema] → z.array(converted)
    return z.array(convertToZod(desc as SimpleSchema))
  }

  // Object → z.object() with recursive conversion
  if (typeof input === 'object' && input !== null) {
    const shape: Record<string, ZodTypeAny> = {}

    for (const [key, value] of Object.entries(input)) {
      shape[key] = convertToZod(value as SimpleSchema)
    }

    return z.object(shape)
  }

  // Fallback - shouldn't reach here
  return z.unknown()
}

/**
 * Type helper to infer the output type from a simple schema
 */
export type InferSimpleSchema<T> = T extends string
  ? string
  : T extends [string]
  ? string[]
  : T extends [number]
  ? number[]
  : T extends { [K in keyof T]: SimpleSchema }
  ? { [K in keyof T]: InferSimpleSchema<T[K]> }
  : unknown
