/**
 * Validation utilities for ai-props
 *
 * Provides prop validation against schemas.
 *
 * @packageDocumentation
 */

import type { SimpleSchema } from 'ai-functions'
import type { PropSchema, ValidationResult, ValidationError } from './types.js'

/**
 * Validate props against a schema
 *
 * @example
 * ```ts
 * const result = validateProps(
 *   { name: 'John', age: '25' },  // props
 *   { name: 'Name', age: 'Age (number)' }  // schema
 * )
 *
 * if (!result.valid) {
 *   console.log(result.errors)
 *   // [{ path: 'age', message: 'Expected number, got string' }]
 * }
 * ```
 */
export function validateProps(
  props: Record<string, unknown>,
  schema: PropSchema
): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof schema === 'string') {
    // Simple string schema - just check if value exists
    if (!props['value']) {
      errors.push({
        path: 'value',
        message: 'Value is required',
        expected: 'string',
        received: props['value'],
      })
    }
    return { valid: errors.length === 0, errors }
  }

  // Object schema - validate each key
  for (const [key, schemaDef] of Object.entries(schema)) {
    const value = props[key]
    const keyErrors = validateValue(key, value, schemaDef as string | SimpleSchema)
    errors.push(...keyErrors)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a single value against a schema definition
 */
function validateValue(
  path: string,
  value: unknown,
  schema: string | SimpleSchema
): ValidationError[] {
  const errors: ValidationError[] = []

  // String schema with type hint
  if (typeof schema === 'string') {
    const expectedType = extractTypeFromSchema(schema)

    if (value === undefined || value === null) {
      // Optional unless marked required
      return errors
    }

    if (expectedType && !checkType(value, expectedType)) {
      errors.push({
        path,
        message: `Expected ${expectedType}, got ${typeof value}`,
        expected: expectedType,
        received: value,
      })
    }

    return errors
  }

  // Array schema
  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) {
      if (value !== undefined && value !== null) {
        errors.push({
          path,
          message: `Expected array, got ${typeof value}`,
          expected: 'array',
          received: value,
        })
      }
      return errors
    }

    // Validate array items if schema has item definition
    if (schema.length > 0) {
      const itemSchema = schema[0]
      for (let i = 0; i < value.length; i++) {
        const itemErrors = validateValue(
          `${path}[${i}]`,
          value[i],
          itemSchema as string | SimpleSchema
        )
        errors.push(...itemErrors)
      }
    }

    return errors
  }

  // Object schema
  if (typeof schema === 'object' && schema !== null) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      if (value !== undefined && value !== null) {
        errors.push({
          path,
          message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
          expected: 'object',
          received: value,
        })
      }
      return errors
    }

    // Recursively validate nested object
    for (const [key, nestedSchema] of Object.entries(schema)) {
      const nestedValue = (value as Record<string, unknown>)[key]
      const nestedErrors = validateValue(
        `${path}.${key}`,
        nestedValue,
        nestedSchema as string | SimpleSchema
      )
      errors.push(...nestedErrors)
    }
  }

  return errors
}

/**
 * Extract type hint from schema string
 * e.g., "Age (number)" -> "number"
 */
function extractTypeFromSchema(schema: string): string | null {
  const match = schema.match(/\((\w+)\)\s*$/)
  if (match) {
    return match[1]!.toLowerCase()
  }

  // Check for enum syntax
  if (schema.includes(' | ')) {
    return 'enum'
  }

  return null
}

/**
 * Check if a value matches an expected type
 */
function checkType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string'
    case 'number':
    case 'integer':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'date':
      return typeof value === 'string' || value instanceof Date
    case 'enum':
      return typeof value === 'string'
    default:
      return true
  }
}

/**
 * Check if all required props are present
 */
export function hasRequiredProps<P extends Record<string, unknown>>(
  props: Partial<P>,
  required: (keyof P)[]
): boolean {
  return required.every((key) => props[key] !== undefined)
}

/**
 * Get list of missing required props
 */
export function getMissingProps<P extends Record<string, unknown>>(
  props: Partial<P>,
  required: (keyof P)[]
): (keyof P)[] {
  return required.filter((key) => props[key] === undefined)
}

/**
 * Check if props are complete according to schema
 */
export function isComplete(props: Record<string, unknown>, schema: PropSchema): boolean {
  if (typeof schema === 'string') {
    return props['value'] !== undefined
  }

  return Object.keys(schema).every((key) => props[key] !== undefined)
}

/**
 * Get list of missing props according to schema
 */
export function getMissingFromSchema(props: Record<string, unknown>, schema: PropSchema): string[] {
  if (typeof schema === 'string') {
    return props['value'] === undefined ? ['value'] : []
  }

  return Object.keys(schema).filter((key) => props[key] === undefined)
}

/**
 * Sanitize props by removing extra keys not in schema
 */
export function sanitizeProps<P extends Record<string, unknown>>(
  props: P,
  schema: PropSchema
): Partial<P> {
  if (typeof schema === 'string') {
    return { value: (props as Record<string, unknown>)['value'] } as unknown as Partial<P>
  }

  const schemaKeys = new Set(Object.keys(schema))
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if (schemaKeys.has(key)) {
      sanitized[key] = value
    }
  }

  return sanitized as Partial<P>
}

/**
 * Merge props with defaults, respecting schema types
 */
export function mergeWithDefaults<P extends Record<string, unknown>>(
  props: Partial<P>,
  defaults: Partial<P>,
  schema: PropSchema
): Partial<P> {
  const result = { ...defaults, ...props }

  // Ensure types match schema
  if (typeof schema !== 'string') {
    for (const [key, schemaDef] of Object.entries(schema)) {
      if (result[key as keyof P] === undefined) continue

      const expectedType = typeof schemaDef === 'string' ? extractTypeFromSchema(schemaDef) : null

      if (expectedType) {
        result[key as keyof P] = coerceType(result[key as keyof P], expectedType) as P[keyof P]
      }
    }
  }

  return result
}

/**
 * Attempt to coerce a value to an expected type
 */
function coerceType(value: unknown, expectedType: string): unknown {
  if (value === undefined || value === null) return value

  switch (expectedType) {
    case 'string':
      return String(value)
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'integer':
      return typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10)
    case 'boolean':
      return Boolean(value)
    default:
      return value
  }
}

/**
 * Create a props validator function
 */
export function createValidator<P extends Record<string, unknown>>(
  schema: PropSchema
): (props: Partial<P>) => ValidationResult {
  return (props: Partial<P>) => validateProps(props as Record<string, unknown>, schema)
}

/**
 * Assert props are valid, throwing on error
 */
export function assertValidProps(props: Record<string, unknown>, schema: PropSchema): void {
  const result = validateProps(props, schema)
  if (!result.valid) {
    const messages = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ')
    throw new Error(`Invalid props: ${messages}`)
  }
}
