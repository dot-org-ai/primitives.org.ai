/**
 * Test Utilities for ai-database
 *
 * This module exports test utilities that should NOT be used in production code.
 * These are specifically designed for testing purposes with deterministic behavior.
 *
 * USAGE GUIDELINES:
 *
 * Use mock semantic provider for:
 * - Testing embedding dimension configuration
 * - Testing semantic search algorithm logic
 * - Testing embedding storage mechanics
 * - Unit testing with predictable scores
 *
 * Use real AI Gateway for:
 * - Integration tests requiring real semantic similarity
 * - Testing AI-powered entity matching quality
 * - End-to-end semantic search tests
 *
 * Pattern for real AI tests:
 * ```ts
 * const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY
 * describe.skipIf(!hasGateway)('real semantic tests', () => {
 *   // Real AI calls via gateway
 * })
 * ```
 *
 * @packageDocumentation
 */

export {
  // Mock semantic provider for deterministic testing
  createMockSemanticProvider,
  // Utility functions for embedding tests
  generateMockEmbedding,
  mockCosineSimilarity,
} from './mock-semantic.js'

export type { MockEmbeddingStore, MockSemanticProviderOptions } from './mock-semantic.js'
