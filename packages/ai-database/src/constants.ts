/**
 * Shared Constants for AI Database
 *
 * Central location for constants used across the package.
 *
 * @packageDocumentation
 */

/**
 * Default embedding dimensions (using 384 which is common for sentence transformers)
 *
 * This value is used by:
 * - MemoryProvider for generating and storing embeddings
 * - SemanticProvider for embedding generation and search
 *
 * Common dimension sizes by provider:
 * - sentence-transformers: 384
 * - OpenAI ada-002: 1536
 * - OpenAI text-embedding-3-small: 1536
 * - OpenAI text-embedding-3-large: 3072
 * - Cohere embed-english-v3.0: 1024
 * - Cohere embed-multilingual-v3.0: 1024
 * - Voyage AI: 1024-4096
 *
 * @default 384
 */
export const DEFAULT_EMBEDDING_DIMENSIONS = 384

/**
 * @deprecated Use DEFAULT_EMBEDDING_DIMENSIONS instead
 */
export const EMBEDDING_DIMENSIONS = DEFAULT_EMBEDDING_DIMENSIONS

/**
 * Relation operators for schema field definitions
 *
 * Replaces magic strings with type-safe constants for relationship operators.
 *
 * | Operator | Direction | Match Mode | Description |
 * |----------|-----------|------------|-------------|
 * | `->`     | forward   | exact      | Strict foreign key reference |
 * | `~>`     | forward   | fuzzy      | AI-matched semantic reference |
 * | `<-`     | backward  | exact      | Strict backlink reference |
 * | `<~`     | backward  | fuzzy      | AI-matched backlink reference |
 *
 * @example
 * ```ts
 * // Using in schema definitions
 * const schema = {
 *   Post: { author: `${RelationOperator.FORWARD_EXACT}Author` }
 * }
 *
 * // Type guard
 * if (field.operator === RelationOperator.FORWARD_FUZZY) {
 *   // Handle fuzzy matching
 * }
 * ```
 */
export const RelationOperator = {
  /** Forward exact reference (->) - Strict foreign key reference */
  FORWARD_EXACT: '->',
  /** Forward fuzzy reference (~>) - AI-matched semantic reference */
  FORWARD_FUZZY: '~>',
  /** Backward exact reference (<-) - Strict backlink reference */
  BACKWARD_EXACT: '<-',
  /** Backward fuzzy reference (<~) - AI-matched backlink reference */
  BACKWARD_FUZZY: '<~',
} as const

/**
 * Type representing any valid relation operator string
 *
 * Use this for function parameters that accept any operator.
 *
 * @example
 * ```ts
 * function isForwardOperator(op: RelationOperatorType): boolean {
 *   return op === RelationOperator.FORWARD_EXACT || op === RelationOperator.FORWARD_FUZZY
 * }
 * ```
 */
export type RelationOperatorType = (typeof RelationOperator)[keyof typeof RelationOperator]
