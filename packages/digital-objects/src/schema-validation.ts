/**
 * Runtime schema validation for Digital Objects
 *
 * Validates Thing data against Noun schemas when validation is enabled.
 * Provides clear, actionable error messages with field paths and suggestions.
 */

import type { FieldDefinition, ExtendedFieldDefinition, ValidationOptions } from './types.js'
import { ValidationError } from './errors.js'

/**
 * Schema validation error with detailed context
 *
 * Provides comprehensive information about validation failures
 * including field paths, type information, and suggestions for fixes.
 */
export interface SchemaValidationError {
  /** Full path to the field (e.g., 'address.city' for nested objects) */
  field: string
  /** Human-readable error message */
  message: string
  /** Expected type or constraint */
  expected: string
  /** Actual value's type or description */
  received: string
  /** Optional suggestion for fixing the error */
  suggestion?: string
  /** Error code for programmatic handling */
  code: ValidationErrorCode
}

/**
 * Error codes for programmatic error handling
 */
export type ValidationErrorCode =
  | 'REQUIRED_FIELD'
  | 'TYPE_MISMATCH'
  | 'INVALID_FORMAT'
  | 'UNKNOWN_FIELD'

/**
 * Result from validateOnly() for pre-flight validation
 */
export interface ValidationResult {
  valid: boolean
  errors: SchemaValidationError[]
}

/**
 * Type guard to check if a field definition is an extended definition (object with type)
 */
function isExtendedFieldDefinition(def: FieldDefinition): def is ExtendedFieldDefinition {
  return typeof def === 'object' && def !== null && 'type' in def
}

/**
 * Get the actual JavaScript type of a value for validation purposes
 */
function getActualType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'
  return typeof value
}

/**
 * Get a suggestion for fixing a type mismatch error
 */
function getSuggestion(expected: string, actual: string, value: unknown): string | undefined {
  // String to number
  if (expected === 'number' && actual === 'string') {
    const num = Number(value)
    if (!isNaN(num)) {
      return `Convert to number: ${num}`
    }
    return 'Provide a valid number'
  }

  // Number to string
  if (expected === 'string' && actual === 'number') {
    return `Convert to string: "${value}"`
  }

  // String to boolean
  if (expected === 'boolean' && actual === 'string') {
    const str = String(value).toLowerCase()
    if (str === 'true' || str === 'false') {
      return `Convert to boolean: ${str === 'true'}`
    }
    return 'Use true or false'
  }

  // Array expected
  if (expected === 'array' && actual !== 'array') {
    return 'Wrap value in an array: [value]'
  }

  // Object expected
  if (expected === 'object' && actual !== 'object') {
    return 'Provide an object: { ... }'
  }

  // Date/datetime (expected string-based type but got wrong type)
  if ((expected === 'date' || expected === 'datetime') && actual !== 'string') {
    return 'Provide a valid ISO 8601 date string'
  }

  // URL (expected string-based type but got wrong type)
  if (expected === 'url' && actual !== 'string') {
    return 'Provide a valid URL starting with http:// or https://'
  }

  // Markdown
  if (expected === 'markdown' && actual !== 'string') {
    return 'Provide a string containing markdown content'
  }

  return undefined
}

/**
 * Create a validation error with consistent formatting
 */
function createError(
  field: string,
  code: ValidationErrorCode,
  expected: string,
  received: string,
  value?: unknown
): SchemaValidationError {
  let message: string

  switch (code) {
    case 'REQUIRED_FIELD':
      message = `Missing required field '${field}'`
      break
    case 'TYPE_MISMATCH':
      message = `Field '${field}' has wrong type: expected ${expected}, got ${received}`
      break
    case 'INVALID_FORMAT':
      message = `Field '${field}' has invalid format: expected ${expected}`
      break
    case 'UNKNOWN_FIELD':
      message = `Unknown field '${field}'`
      break
  }

  const error: SchemaValidationError = {
    field,
    message,
    expected,
    received,
    code,
  }

  // Add suggestion if available
  const suggestion = getSuggestion(expected, received, value)
  if (suggestion) {
    error.suggestion = suggestion
  }

  return error
}

/**
 * Internal validation logic that collects errors
 *
 * @param data - The data to validate
 * @param schema - The schema to validate against
 * @param path - Current field path for nested objects
 * @returns Array of validation errors
 */
function collectErrors(
  data: Record<string, unknown>,
  schema: Record<string, FieldDefinition>,
  path: string = ''
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = []

  for (const [field, def] of Object.entries(schema)) {
    const fieldPath = path ? `${path}.${field}` : field
    const value = data[field]

    // Handle extended field definitions (object with type and required)
    if (isExtendedFieldDefinition(def)) {
      // Check required fields
      if (def.required && (value === undefined || value === null)) {
        errors.push(
          createError(
            fieldPath,
            'REQUIRED_FIELD',
            def.type,
            value === null ? 'null' : 'undefined',
            value
          )
        )
        continue
      }

      // Skip validation if field is not present and not required
      if (value === undefined) continue

      // Type validation
      const actualType = getActualType(value)

      // Special handling for string-based types that should validate as strings
      const stringBasedTypes = ['date', 'datetime', 'url', 'markdown', 'json']
      const normalizedExpected = stringBasedTypes.includes(def.type) ? 'string' : def.type

      if (normalizedExpected !== actualType) {
        errors.push(createError(fieldPath, 'TYPE_MISMATCH', def.type, actualType, value))
      }
    } else {
      // Simple field type (string like 'string', 'number', etc.)
      // These are not required by default and just validate type if present
      if (value === undefined) continue

      const actualType = getActualType(value)
      const expectedType = def.replace('?', '') // Remove optional marker

      // Skip relation types (contain '.')
      if (expectedType.includes('.')) continue

      // Skip bracket-wrapped relation types
      if (expectedType.startsWith('[') && expectedType.endsWith(']')) continue

      // Special handling for string-based types that should validate as strings
      const stringBasedTypes = ['date', 'datetime', 'url', 'markdown', 'json']
      const normalizedExpected = stringBasedTypes.includes(expectedType) ? 'string' : expectedType

      if (normalizedExpected !== actualType) {
        errors.push(createError(fieldPath, 'TYPE_MISMATCH', expectedType, actualType, value))
      }
    }
  }

  return errors
}

/**
 * Format validation errors for display in error messages
 */
function formatErrors(errors: SchemaValidationError[]): string {
  if (errors.length === 0) return ''

  const lines = errors.map((e) => {
    let line = `  - ${e.message}`
    if (e.suggestion) {
      line += ` (${e.suggestion})`
    }
    return line
  })

  return lines.join('\n')
}

/**
 * Validates data against a schema definition without throwing
 *
 * Use this for pre-flight validation to check if data is valid
 * before attempting create/update operations.
 *
 * @param data - The data to validate
 * @param schema - The schema to validate against (from Noun.schema)
 * @returns ValidationResult with valid boolean and errors array
 *
 * @example
 * ```typescript
 * const result = validateOnly(userData, userSchema)
 * if (!result.valid) {
 *   console.log('Validation errors:', result.errors)
 *   // Handle errors gracefully
 * }
 * ```
 */
export function validateOnly(
  data: Record<string, unknown>,
  schema: Record<string, FieldDefinition> | undefined
): ValidationResult {
  if (!schema) {
    return { valid: true, errors: [] }
  }

  const errors = collectErrors(data, schema)
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validates data against a schema definition
 *
 * @param data - The data to validate
 * @param schema - The schema to validate against (from Noun.schema)
 * @param options - Validation options (validate: true to enable)
 * @throws Error if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * // Enable validation with options
 * await provider.create('User', userData, undefined, { validate: true })
 *
 * // Error message example:
 * // Validation failed (2 errors):
 * //   - Missing required field 'email'
 * //   - Field 'age' has wrong type: expected number, got string (Convert to number: 25)
 * ```
 */
export function validateData(
  data: Record<string, unknown>,
  schema: Record<string, FieldDefinition> | undefined,
  options?: ValidationOptions
): void {
  // Skip validation if not enabled or no schema
  if (!options?.validate || !schema) return

  const errors = collectErrors(data, schema)

  if (errors.length > 0) {
    const errorCount = errors.length === 1 ? '1 error' : `${errors.length} errors`
    throw new ValidationError(
      `Validation failed (${errorCount})`,
      errors.map((e) => ({ field: e.field, message: e.message }))
    )
  }
}

// Re-export ValidationOptions for convenience
export type { ValidationOptions }
