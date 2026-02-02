/**
 * AI() and ai() - Core AI function constructors
 *
 * This module is a re-export layer that delegates to focused modules:
 * - ai-schemas.ts - Schema-based AI function generation
 * - function-registry.ts - Function definition and registry
 * - ai-proxy.ts - Auto-define proxy functionality
 *
 * All exports are maintained for backward compatibility.
 */

// ============================================================================
// Re-export from ai-schemas.ts - Schema-based AI functions
// ============================================================================
export {
  createSchemaFunctions,
  type AISchemaOptions,
  type SchemaFunctions,
  type InferSimpleSchemaResult,
} from './ai-schemas.js'

// ============================================================================
// Re-export from function-registry.ts - Function definition and registry
// ============================================================================
export {
  defineFunction,
  createDefinedFunction,
  createFunctionRegistry,
  functions,
  resetGlobalRegistry,
  convertArgsToJSONSchema,
  fillTemplate,
} from './function-registry.js'

// ============================================================================
// Re-export from ai-proxy.ts - Auto-define proxy functionality
// ============================================================================
export { define, createSmartAI, ai, type AIProxy } from './ai-proxy.js'

// ============================================================================
// Local exports - withTemplate utility
// ============================================================================

/**
 * Helper to create a function that supports both regular calls and tagged template literals
 * @example
 * const fn = withTemplate((prompt) => doSomething(prompt))
 * fn('hello')      // regular call
 * fn`hello ${name}` // tagged template literal
 */
export function withTemplate<TArgs extends unknown[], TReturn>(
  fn: (prompt: string, ...args: TArgs) => TReturn
): ((prompt: string, ...args: TArgs) => TReturn) &
  ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn) {
  return function (promptOrStrings: string | TemplateStringsArray, ...args: unknown[]): TReturn {
    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      // Tagged template literal call - pass empty args for optional params
      const strings = promptOrStrings as TemplateStringsArray
      const values = args
      const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
      // Cast required: When called as a tagged template, additional args aren't provided.
      // TArgs represents optional parameters that default to empty. TypeScript can't express
      // that TArgs can be satisfied by an empty array when all elements are optional.
      return fn(prompt, ...([] as unknown as TArgs))
    }
    // Regular function call
    return fn(promptOrStrings as string, ...(args as TArgs))
  } as ((prompt: string, ...args: TArgs) => TReturn) &
    ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn)
}

// ============================================================================
// AI() - Main entry point (schema-based functions)
// ============================================================================

import type { SimpleSchema } from './schema.js'
import { createSchemaFunctions, type AISchemaOptions, type SchemaFunctions } from './ai-schemas.js'

/**
 * Create AI functions from schemas
 *
 * @example
 * ```ts
 * const ai = AI({
 *   storyBrand: {
 *     hero: 'Who is the customer?',
 *     problem: {
 *       internal: 'What internal problem do they face?',
 *       external: 'What external challenge exists?',
 *       philosophical: 'Why is this wrong?',
 *     },
 *     guide: 'Who helps them? (the brand)',
 *     plan: ['What are the steps to success?'],
 *     callToAction: 'What should they do?',
 *     success: 'What does success look like?',
 *     failure: 'What happens if they fail?',
 *   },
 *   recipe: {
 *     name: 'Recipe name',
 *     type: 'food | drink | dessert',
 *     servings: 'How many servings? (number)',
 *     ingredients: ['List all ingredients'],
 *     steps: ['Cooking steps in order'],
 *   },
 * })
 *
 * // Call the generated functions
 * const brand = await ai.storyBrand('Acme Corp sells widgets')
 * const dinner = await ai.recipe('Italian pasta for 4 people')
 * ```
 */
export function AI<T extends Record<string, SimpleSchema>>(
  schemas: T,
  defaultOptions?: AISchemaOptions
): SchemaFunctions<T> {
  // Schema functions mode - create a function for each schema
  return createSchemaFunctions(schemas, defaultOptions)
}
