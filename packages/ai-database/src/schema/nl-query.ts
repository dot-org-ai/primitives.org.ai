/**
 * Natural Language Query Implementation
 *
 * Contains the NL query execution system that allows users to query the database
 * using natural language. This module provides:
 * - buildNLQueryContext() - Build context for AI query generation
 * - executeNLQuery() - Execute an NL query against the database
 * - createNLQueryFn() - Create a tagged template literal query function
 * - setNLQueryGenerator/getNLQueryGenerator - Configure the AI generator
 *
 * @packageDocumentation
 */

import type { ParsedSchema } from '../types.js'

import type {
  NLQueryResult,
  NLQueryFn,
  NLQueryContext,
  NLQueryPlan,
  NLQueryGenerator,
} from './types.js'

import { getTypeMeta } from '../linguistic.js'
import { resolveProvider } from './provider.js'

// =============================================================================
// NL Query Generator State
// =============================================================================

let nlQueryGenerator: NLQueryGenerator | null = null

/**
 * Set the AI generator for natural language queries
 *
 * The generator is a function that takes a natural language question and
 * schema context, then returns a structured query plan that can be executed
 * against the database.
 *
 * @param generator - The NL query generator function
 */
export function setNLQueryGenerator(generator: NLQueryGenerator): void {
  nlQueryGenerator = generator
}

/**
 * Get the currently configured NL query generator
 *
 * @returns The current generator or null if not configured
 */
export function getNLQueryGenerator(): NLQueryGenerator | null {
  return nlQueryGenerator
}

// =============================================================================
// NL Query Context Builder
// =============================================================================

/**
 * Build context for AI query generation
 *
 * This creates a structured representation of the database schema that can be
 * provided to an AI model to help it generate accurate query plans.
 *
 * @param schema - The parsed database schema
 * @param targetType - Optional specific type being queried
 * @returns NLQueryContext with type information for the AI
 */
export function buildNLQueryContext(schema: ParsedSchema, targetType?: string): NLQueryContext {
  const types: NLQueryContext['types'] = []

  for (const [name, entity] of schema.entities) {
    const fields: string[] = []
    const relationships: NLQueryContext['types'][0]['relationships'] = []

    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType) {
        relationships.push({
          name: fieldName,
          to: field.relatedType,
          cardinality: field.isArray ? 'many' : 'one',
        })
      } else {
        fields.push(fieldName)
      }
    }

    const meta = getTypeMeta(name)
    types.push({
      name,
      singular: meta.singular,
      plural: meta.plural,
      fields,
      relationships,
    })
  }

  const result: NLQueryContext = { types }
  if (targetType !== undefined) {
    result.targetType = targetType
  }
  return result
}

// =============================================================================
// NL Query Execution
// =============================================================================

/**
 * Execute a natural language query against the database
 *
 * This function takes a natural language question and converts it to database
 * operations. If an AI generator is configured, it will use that to create a
 * structured query plan. Otherwise, it falls back to keyword search.
 *
 * @param question - The natural language question
 * @param schema - The parsed database schema
 * @param targetType - Optional specific type to query
 * @returns NLQueryResult with interpretation and results
 */
export async function executeNLQuery<T>(
  question: string,
  schema: ParsedSchema,
  targetType?: string
): Promise<NLQueryResult<T>> {
  // Import applyFilters for MongoDB-style filter support
  const { applyFilters } = await import('./nl-query-generator.js')

  if (!nlQueryGenerator) {
    const provider = await resolveProvider()
    const results: T[] = []

    // Simple heuristic for common "list all" patterns in fallback mode
    const lowerQuestion = question.toLowerCase().trim()
    const isListAllQuery =
      /^(show|list|get|find|display)\s+(all|every|the)?\s*/i.test(lowerQuestion) ||
      lowerQuestion === '' ||
      /\ball\b/i.test(lowerQuestion)

    if (targetType) {
      if (isListAllQuery) {
        // For "show all X" queries, just list everything
        const listResults = await provider.list(targetType)
        results.push(...(listResults as T[]))
      } else {
        const searchResults = await provider.search(targetType, question)
        results.push(...(searchResults as T[]))
      }
    } else {
      for (const [typeName] of schema.entities) {
        if (isListAllQuery) {
          const listResults = await provider.list(typeName)
          results.push(...(listResults as T[]))
        } else {
          const searchResults = await provider.search(typeName, question)
          results.push(...(searchResults as T[]))
        }
      }
    }

    return {
      interpretation: `Search for "${question}"`,
      confidence: 0.5,
      results,
      explanation: 'Fallback to keyword search (no AI generator configured)',
    }
  }

  const context = buildNLQueryContext(schema, targetType)
  const plan = await nlQueryGenerator(question, context)

  const provider = await resolveProvider()
  let results: T[] = []

  for (const typeName of plan.types) {
    let typeResults: Record<string, unknown>[]

    if (plan.search) {
      // Use provider's search, then apply filters in memory for MongoDB-style operators
      typeResults = await provider.search(typeName, plan.search)
    } else {
      // List all and filter in memory
      typeResults = await provider.list(typeName)
    }

    // Apply MongoDB-style filters in memory
    if (plan.filters && Object.keys(plan.filters).length > 0) {
      typeResults = applyFilters(typeResults, plan.filters)
    }

    results.push(...(typeResults as T[]))
  }

  return {
    interpretation: plan.interpretation,
    confidence: plan.confidence,
    results,
    query: JSON.stringify({ types: plan.types, filters: plan.filters, search: plan.search }),
  }
}

// =============================================================================
// NL Query Function Factory
// =============================================================================

/**
 * Create a tagged template literal function for natural language queries
 *
 * This enables the intuitive syntax: db.Post`show recent posts about AI`
 *
 * @param schema - The parsed database schema
 * @param typeName - Optional specific type to constrain queries to
 * @returns A tagged template function that executes NL queries
 */
export function createNLQueryFn<T>(schema: ParsedSchema, typeName?: string): NLQueryFn<T> {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const question = strings.reduce((acc, str, i) => {
      return acc + str + (values[i] !== undefined ? String(values[i]) : '')
    }, '')

    return executeNLQuery<T>(question, schema, typeName)
  }
}
