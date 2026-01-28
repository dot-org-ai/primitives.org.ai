/**
 * Type validation and checking functionality for digital workers
 *
 * IMPORTANT: Schema Validation vs Boolean Assertion
 * --------------------------------------------------
 * This module provides comprehensive type/schema validation,
 * NOT simple boolean assertions.
 *
 * - `digital-workers.is()` - Validates values against types or schemas,
 *   returns detailed validation results with errors and optional coercion.
 *
 * - `ai-functions.is()` - Boolean assertion via LLM (e.g., `is\`${x} is valid\``)
 *   returns true/false based on natural language checking.
 *
 * Use digital-workers when you need:
 * - Type validation with error messages
 * - Schema validation with field-level errors
 * - Value coercion (string to number, etc.)
 * - Structured validation results
 *
 * Use ai-functions when you need:
 * - Natural language boolean checks
 * - LLM-based semantic validation
 * - Template literal assertions
 *
 * @module
 */

import { generateObject } from 'ai-functions'
import { schema as convertSchema, type SimpleSchema } from 'ai-functions'
import type { TypeCheckResult, IsOptions } from './types.js'

/**
 * Validate a value against a type or schema with detailed results.
 *
 * **Key Difference from ai-functions.is():**
 * Unlike `ai-functions.is()` which is a boolean assertion using natural
 * language (e.g., `is\`${email} is valid\`` returns true/false), this
 * function performs structured type/schema validation and returns a
 * `TypeCheckResult` with:
 * - Validation status
 * - Error messages for invalid fields
 * - Optionally coerced values
 *
 * This is a **validation primitive**, not a boolean assertion primitive.
 *
 * @param value - The value to check
 * @param type - Type name ('email', 'url', 'number') or schema to validate against
 * @param options - Validation options (coerce, strict)
 * @returns Promise resolving to TypeCheckResult with valid, value, and errors
 *
 * @example
 * ```ts
 * // Simple type checking with result object
 * const result = await is('hello@example.com', 'email')
 * console.log(result.valid) // true
 * console.log(result.errors) // undefined when valid
 * ```
 *
 * @example
 * ```ts
 * // Schema validation with detailed errors
 * const result = await is(
 *   { name: 'John', age: 30 },
 *   {
 *     name: 'Full name',
 *     age: 'Age in years (number)',
 *     email: 'Email address',
 *   }
 * )
 * console.log(result.valid) // false - missing email
 * console.log(result.errors) // ['Missing required field: email']
 * ```
 *
 * @example
 * ```ts
 * // With coercion - transforms value to target type
 * const result = await is('123', 'number', { coerce: true })
 * console.log(result.valid) // true
 * console.log(result.value) // 123 (as number, not string)
 * ```
 *
 * @see {@link ai-functions#is} for natural language boolean assertions
 */
export async function is(
  value: unknown,
  type: string | SimpleSchema,
  options: IsOptions = {}
): Promise<TypeCheckResult> {
  const { coerce = false, strict = false } = options

  // Handle simple type strings
  if (typeof type === 'string') {
    return validateSimpleType(value, type, { coerce, strict })
  }

  // Handle schema validation
  return validateSchema(value, type, { coerce, strict })
}

/**
 * Validate against a simple type name
 */
async function validateSimpleType(
  value: unknown,
  type: string,
  options: IsOptions
): Promise<TypeCheckResult> {
  const { coerce, strict } = options

  // Built-in JavaScript types
  const builtInTypes: Record<string, (v: unknown) => boolean> = {
    string: (v) => typeof v === 'string',
    number: (v) => typeof v === 'number' && !isNaN(v),
    boolean: (v) => typeof v === 'boolean',
    object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
    array: (v) => Array.isArray(v),
    null: (v) => v === null,
    undefined: (v) => v === undefined,
    function: (v) => typeof v === 'function',
  }

  // Check built-in types first
  if (type in builtInTypes) {
    const isValid = builtInTypes[type]!(value)

    if (!isValid && coerce) {
      // Try to coerce the value
      const coerced = coerceValue(value, type)
      if (coerced.success) {
        return {
          valid: true,
          value: coerced.value,
        }
      }
    }

    return {
      valid: isValid,
      ...(isValid ? { value } : { errors: [`Value is not a valid ${type}`] }),
    }
  }

  // Use AI for complex type validation
  const result = await generateObject({
    model: 'sonnet',
    schema: {
      valid: 'Whether the value matches the expected type (boolean)',
      errors: ['List of validation errors if invalid'],
      coercedValue: coerce ? 'The value coerced to the expected type' : undefined,
    },
    system: `You are a type validation expert. Determine if a value matches an expected type.

${coerce ? 'If the value can be coerced to the expected type, provide the coerced value.' : ''}
${
  strict
    ? 'Be strict in your validation - require exact type matches.'
    : 'Be flexible - allow reasonable type conversions.'
}`,
    prompt: `Validate if this value matches the expected type:

Value: ${JSON.stringify(value)}
Type: ${type}

Determine if the value is valid for this type.`,
  })

  const validation = result.object as unknown as {
    valid: boolean
    errors: string[]
    coercedValue?: unknown
  }

  return {
    valid: validation.valid,
    value: coerce && validation.coercedValue !== undefined ? validation.coercedValue : value,
    ...(!validation.valid && { errors: validation.errors }),
  }
}

/**
 * Validate against a schema
 */
async function validateSchema(
  value: unknown,
  schema: SimpleSchema,
  options: IsOptions
): Promise<TypeCheckResult> {
  const { coerce, strict } = options

  try {
    // Convert SimpleSchema to Zod schema
    const zodSchema = convertSchema(schema)

    // Parse the value
    const parsed = zodSchema.parse(value)

    return {
      valid: true,
      value: parsed,
    }
  } catch (error) {
    if (strict) {
      return {
        valid: false,
        errors: [(error as Error).message],
      }
    }

    // Use AI for more flexible validation
    const result = await generateObject({
      model: 'sonnet',
      schema: {
        valid: 'Whether the value matches the schema (boolean)',
        errors: ['List of validation errors'],
        coercedValue: coerce ? 'The value with corrections/coercions applied' : undefined,
      },
      system: `You are a schema validation expert. Validate a value against a schema.

${coerce ? 'Try to coerce the value to match the schema where reasonable.' : ''}
Be helpful - provide clear error messages.`,
      prompt: `Validate this value against the schema:

Value:
${JSON.stringify(value, null, 2)}

Schema:
${JSON.stringify(schema, null, 2)}

Check if the value matches the schema structure and types.`,
    })

    const validation = result.object as unknown as {
      valid: boolean
      errors: string[]
      coercedValue?: unknown
    }

    return {
      valid: validation.valid,
      value: coerce && validation.coercedValue !== undefined ? validation.coercedValue : value,
      ...(!validation.valid && { errors: validation.errors }),
    }
  }
}

/**
 * Try to coerce a value to a specific type
 */
function coerceValue(value: unknown, type: string): { success: boolean; value?: unknown } {
  try {
    switch (type) {
      case 'string':
        return { success: true, value: String(value) }

      case 'number':
        const num = Number(value)
        return { success: !isNaN(num), value: num }

      case 'boolean':
        if (typeof value === 'string') {
          const lower = value.toLowerCase()
          if (lower === 'true' || lower === '1') {
            return { success: true, value: true }
          }
          if (lower === 'false' || lower === '0') {
            return { success: true, value: false }
          }
        }
        return { success: true, value: Boolean(value) }

      case 'array':
        if (Array.isArray(value)) {
          return { success: true, value }
        }
        return { success: true, value: [value] }

      default:
        return { success: false }
    }
  } catch {
    return { success: false }
  }
}

/**
 * Check if a value is valid email
 *
 * @param value - Value to check
 * @returns Promise resolving to validation result
 *
 * @example
 * ```ts
 * const result = await is.email('test@example.com')
 * console.log(result.valid) // true
 * ```
 */
is.email = async (value: unknown): Promise<TypeCheckResult> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = typeof value === 'string' && emailRegex.test(value)

  return {
    valid,
    ...(valid ? { value } : { errors: ['Invalid email format'] }),
  }
}

/**
 * Check if a value is a valid URL
 *
 * @param value - Value to check
 * @returns Promise resolving to validation result
 */
is.url = async (value: unknown): Promise<TypeCheckResult> => {
  try {
    if (typeof value !== 'string') {
      return {
        valid: false,
        errors: ['Value must be a string'],
      }
    }

    new URL(value)
    return {
      valid: true,
      value,
    }
  } catch {
    return {
      valid: false,
      errors: ['Invalid URL format'],
    }
  }
}

/**
 * Check if a value is a valid date
 *
 * @param value - Value to check
 * @param options - Validation options
 * @returns Promise resolving to validation result
 */
is.date = async (value: unknown, options: IsOptions = {}): Promise<TypeCheckResult> => {
  const { coerce } = options

  if (value instanceof Date) {
    const isValid = !isNaN(value.getTime())
    return {
      valid: isValid,
      value,
      ...(!isValid && { errors: ['Invalid date'] }),
    }
  }

  if (coerce) {
    try {
      const date = new Date(value as string | number)
      if (!isNaN(date.getTime())) {
        return {
          valid: true,
          value: date,
        }
      }
    } catch {
      // Fall through to invalid
    }
  }

  return {
    valid: false,
    errors: ['Invalid date'],
  }
}

/**
 * Check if a value matches a custom validation function
 *
 * @param value - Value to check
 * @param validator - Validation function
 * @returns Promise resolving to validation result
 *
 * @example
 * ```ts
 * const result = await is.custom(
 *   42,
 *   (v) => typeof v === 'number' && v > 0 && v < 100
 * )
 * ```
 */
is.custom = async (
  value: unknown,
  validator: (v: unknown) => boolean | Promise<boolean>
): Promise<TypeCheckResult> => {
  try {
    const valid = await validator(value)
    return {
      valid,
      ...(valid ? { value } : { errors: ['Custom validation failed'] }),
    }
  } catch (error) {
    return {
      valid: false,
      errors: [(error as Error).message],
    }
  }
}
