/**
 * Default Natural Language Query Generator
 *
 * Uses generateObject from ai-functions to convert natural language
 * queries into structured query plans that can be executed against the database.
 *
 * @packageDocumentation
 */

import type { NLQueryContext, NLQueryPlan, NLQueryGenerator } from './types.js'
import { getAIGenerationConfig } from './cascade.js'

/**
 * Schema definition for the query plan that LLM generates
 */
const QUERY_PLAN_SCHEMA = {
  types: 'string[] - The entity types to query (e.g., ["Lead", "Order"])',
  filters:
    'object? - Filter conditions to apply. Use MongoDB-style operators like $gt, $lt, $eq, $in. Example: { status: "active", score: { $gt: 70 } }',
  search: 'string? - Optional text search query to apply',
  timeRange:
    'object? - Time range filter with "since" and/or "until" ISO date strings. Example: { since: "2024-01-01T00:00:00Z" }',
  include:
    'string[]? - Related entity fields to include in the results. Example: ["company", "orders"]',
  interpretation: 'string - Human-readable interpretation of what the query means',
  confidence:
    'number - Confidence score from 0 to 1 indicating how confident the interpretation is',
}

/**
 * Build a prompt for the LLM that includes schema context
 *
 * @param query - The natural language query from the user
 * @param context - Schema context including available types and their fields
 * @returns A formatted prompt string for the LLM
 */
function buildQueryPrompt(query: string, context: NLQueryContext): string {
  const schemaDescription = context.types
    .map((type) => {
      const fieldsStr = type.fields.join(', ')
      const relationsStr =
        type.relationships.length > 0
          ? ` | Relations: ${type.relationships
              .map((r) => `${r.name} -> ${r.to} (${r.cardinality})`)
              .join(', ')}`
          : ''
      return `- ${type.name} (${type.singular}/${type.plural}): Fields: [${fieldsStr}]${relationsStr}`
    })
    .join('\n')

  const targetTypeHint = context.targetType
    ? `\nNote: The query is specifically targeting the "${context.targetType}" type.`
    : ''

  return `Convert this natural language query into a structured query plan.

Available entity types and their schemas:
${schemaDescription}
${targetTypeHint}

Query: "${query}"

Guidelines:
- For filter conditions, use MongoDB-style operators: $gt, $lt, $gte, $lte, $eq, $ne, $in, $nin
- For temporal queries like "this week", "this year", "last month", calculate the appropriate date range
- If the query mentions a specific entity type, include it in the types array
- If no specific type is mentioned and targetType is provided, use the targetType
- Set confidence based on how clearly the query maps to the schema (0.9+ for clear queries, 0.7-0.9 for ambiguous)
- The interpretation should clearly explain what the query plan will do`
}

/**
 * Create a default NL query generator that uses generateObject from ai-functions
 *
 * This generator converts natural language queries into structured query plans
 * using the LLM configured via configureAIGeneration().
 *
 * @returns An NLQueryGenerator function
 *
 * @example
 * ```ts
 * import { setNLQueryGenerator } from 'ai-database'
 * import { createDefaultNLQueryGenerator } from 'ai-database/schema/nl-query-generator'
 *
 * // Configure the default generator
 * const generator = createDefaultNLQueryGenerator()
 * setNLQueryGenerator(generator)
 *
 * // Now NL queries will use the LLM
 * const results = await db.Lead`find high scoring leads`
 * ```
 */
export function createDefaultNLQueryGenerator(): NLQueryGenerator {
  return async (query: string, context: NLQueryContext): Promise<NLQueryPlan> => {
    const config = getAIGenerationConfig()

    if (!config.enabled) {
      // If AI is disabled, return a basic plan with low confidence
      return {
        types: context.targetType ? [context.targetType] : context.types.map((t) => t.name),
        search: query,
        interpretation: `Search for "${query}"`,
        confidence: 0.5,
      }
    }

    // Dynamically import generateObject to avoid circular dependencies
    const { generateObject } = await import('ai-functions')

    const prompt = buildQueryPrompt(query, context)

    const result = await generateObject({
      model: config.model,
      schema: QUERY_PLAN_SCHEMA,
      prompt,
    })

    // Raw object has string dates from LLM output
    const rawPlan = result.object as unknown as {
      types?: string[]
      filters?: Record<string, unknown>
      search?: string
      timeRange?: { since?: string; until?: string }
      include?: string[]
      interpretation?: string
      confidence?: number
    }

    // Build a lookup map for type name normalization (case-insensitive)
    const typeNameMap = new Map<string, string>()
    for (const type of context.types) {
      typeNameMap.set(type.name.toLowerCase(), type.name)
      typeNameMap.set(type.singular.toLowerCase(), type.name)
      typeNameMap.set(type.plural.toLowerCase(), type.name)
    }

    // Normalize type names from AI response to match schema type names
    const normalizedTypes: string[] = []
    if (rawPlan.types && rawPlan.types.length > 0) {
      for (const rawType of rawPlan.types) {
        if (typeof rawType === 'string' && rawType.trim()) {
          const normalized = typeNameMap.get(rawType.toLowerCase().trim())
          if (normalized && !normalizedTypes.includes(normalized)) {
            normalizedTypes.push(normalized)
          }
        }
      }
    }

    // Parse confidence as number (AI may return it as string)
    let confidence = 0.5
    if (rawPlan.confidence !== undefined && rawPlan.confidence !== null) {
      const parsed =
        typeof rawPlan.confidence === 'number'
          ? rawPlan.confidence
          : parseFloat(String(rawPlan.confidence))
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        confidence = parsed
      }
    }

    // Convert to NLQueryPlan with proper Date objects
    const plan: NLQueryPlan = {
      types: normalizedTypes,
      interpretation: rawPlan.interpretation ?? `Query: "${query}"`,
      confidence,
    }
    if (rawPlan.filters !== undefined) {
      plan.filters = rawPlan.filters
    }
    if (rawPlan.search !== undefined) {
      plan.search = rawPlan.search
    }
    if (rawPlan.include !== undefined) {
      plan.include = rawPlan.include
    }

    // Convert ISO date strings to Date objects if present
    if (rawPlan.timeRange) {
      const timeRange: { since?: Date; until?: Date } = {}
      if (rawPlan.timeRange.since) {
        timeRange.since = new Date(rawPlan.timeRange.since)
      }
      if (rawPlan.timeRange.until) {
        timeRange.until = new Date(rawPlan.timeRange.until)
      }
      plan.timeRange = timeRange
    }

    // Ensure types array is populated (fallback if AI didn't return valid types)
    if (!plan.types || plan.types.length === 0) {
      plan.types = context.targetType ? [context.targetType] : context.types.map((t) => t.name)
    }

    return plan
  }
}

/**
 * Convert a value to a number for comparison
 * Handles Date objects, numbers, and numeric strings
 *
 * @param value - The value to convert
 * @returns The numeric value, or NaN if conversion fails
 */
function toComparableNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  if (typeof value === 'string') {
    // Try to parse as date first
    const dateValue = Date.parse(value)
    if (!isNaN(dateValue)) {
      return dateValue
    }
    // Try to parse as number
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      return numValue
    }
  }
  return NaN
}

/**
 * Check if a value matches a MongoDB-style filter condition
 *
 * Supports the following operators:
 * - `$eq` - Equal to
 * - `$ne` - Not equal to
 * - `$gt` - Greater than (works with numbers and dates)
 * - `$gte` - Greater than or equal to
 * - `$lt` - Less than
 * - `$lte` - Less than or equal to
 * - `$in` - Value is in array
 * - `$nin` - Value is not in array
 * - `$exists` - Field exists (or doesn't exist if false)
 * - `$regex` - Regular expression match (string values only)
 *
 * @param value - The value to check
 * @param condition - The filter condition (can be a value or operator object)
 * @returns Whether the value matches the condition
 *
 * @example
 * ```ts
 * matchesFilter(75, { $gt: 70 }) // true
 * matchesFilter('active', 'active') // true
 * matchesFilter(new Date('2024-01-15'), { $gt: new Date('2024-01-01') }) // true
 * matchesFilter('enterprise', { $regex: 'enter' }) // true
 * ```
 */
export function matchesFilter(value: unknown, condition: unknown): boolean {
  if (condition === null || condition === undefined) {
    return value === condition
  }

  // Simple equality check
  if (typeof condition !== 'object') {
    return value === condition
  }

  // MongoDB-style operators
  const operators = condition as Record<string, unknown>

  for (const [op, target] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        if (value !== target) return false
        break
      case '$ne':
        if (value === target) return false
        break
      case '$gt': {
        const numValue = toComparableNumber(value)
        const numTarget = toComparableNumber(target)
        if (isNaN(numValue) || isNaN(numTarget)) return false
        if (numValue <= numTarget) return false
        break
      }
      case '$gte': {
        const numValue = toComparableNumber(value)
        const numTarget = toComparableNumber(target)
        if (isNaN(numValue) || isNaN(numTarget)) return false
        if (numValue < numTarget) return false
        break
      }
      case '$lt': {
        const numValue = toComparableNumber(value)
        const numTarget = toComparableNumber(target)
        if (isNaN(numValue) || isNaN(numTarget)) return false
        if (numValue >= numTarget) return false
        break
      }
      case '$lte': {
        const numValue = toComparableNumber(value)
        const numTarget = toComparableNumber(target)
        if (isNaN(numValue) || isNaN(numTarget)) return false
        if (numValue > numTarget) return false
        break
      }
      case '$in':
        if (!Array.isArray(target)) return false
        if (!target.includes(value)) return false
        break
      case '$nin':
        if (!Array.isArray(target)) return false
        if (target.includes(value)) return false
        break
      case '$exists':
        if (target === true && value === undefined) return false
        if (target === false && value !== undefined) return false
        break
      case '$regex': {
        if (typeof value !== 'string' || typeof target !== 'string') return false
        try {
          const regex = new RegExp(target, 'i')
          if (!regex.test(value)) return false
        } catch {
          return false
        }
        break
      }
      default:
        // Unknown operator - treat as nested filter
        if (typeof value === 'object' && value !== null) {
          const nestedValue = (value as Record<string, unknown>)[op]
          if (!matchesFilter(nestedValue, target)) return false
        } else {
          return false
        }
    }
  }

  return true
}

/**
 * Apply filters to a list of entities
 *
 * @param entities - The entities to filter
 * @param filters - The filter conditions to apply
 * @returns The filtered entities
 */
export function applyFilters<T extends Record<string, unknown>>(
  entities: T[],
  filters: Record<string, unknown> | undefined
): T[] {
  if (!filters || Object.keys(filters).length === 0) {
    return entities
  }

  return entities.filter((entity) => {
    for (const [field, condition] of Object.entries(filters)) {
      const value = entity[field]
      if (!matchesFilter(value, condition)) {
        return false
      }
    }
    return true
  })
}
