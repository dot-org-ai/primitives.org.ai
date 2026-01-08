/**
 * Shared Constants for AI Database
 *
 * Central location for constants used across the package.
 *
 * @packageDocumentation
 */

/**
 * Embedding dimensions (using 384 which is common for sentence transformers)
 *
 * This value is used by:
 * - MemoryProvider for generating and storing embeddings
 * - SemanticProvider for embedding generation and search
 */
export const EMBEDDING_DIMENSIONS = 384
