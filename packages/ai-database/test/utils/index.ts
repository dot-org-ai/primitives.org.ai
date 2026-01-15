/**
 * Test Utilities for ai-database
 *
 * This module exports test utilities that should NOT be used in production code.
 * These are specifically designed for testing purposes with deterministic behavior.
 *
 * @packageDocumentation
 */

export {
  // Mock semantic provider for testing
  createMockSemanticProvider,
  // Utility functions for embedding tests
  generateMockEmbedding,
  mockCosineSimilarity,
} from './mock-semantic.js'

export type { MockEmbeddingStore, MockSemanticProviderOptions } from './mock-semantic.js'
