/**
 * Type Guards for AI Functions
 *
 * Shared type guard utilities used across AI packages.
 *
 * @packageDocumentation
 */

import type { ZodTypeAny } from 'zod'

/**
 * Check if value is a Zod schema
 *
 * Uses duck-typing to detect Zod schemas by checking for the
 * `_def` property (internal Zod schema definition) and `parse` method.
 *
 * @example
 * ```ts
 * import { isZodSchema } from 'ai-functions'
 * import { z } from 'zod'
 *
 * const schema = z.object({ name: z.string() })
 * if (isZodSchema(schema)) {
 *   // TypeScript knows schema is ZodTypeAny
 *   schema.parse({ name: 'test' })
 * }
 * ```
 */
export function isZodSchema(value: unknown): value is ZodTypeAny {
  return value !== null && typeof value === 'object' && '_def' in value && 'parse' in value
}
