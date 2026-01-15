/**
 * Mock Semantic Provider for Testing
 *
 * Provides deterministic embeddings based on text content to enable
 * meaningful semantic search in tests without real AI providers.
 *
 * @packageDocumentation
 */

import { DEFAULT_EMBEDDING_DIMENSIONS } from '../../src/constants.js'
import type {
  SemanticProvider,
  SemanticSearchOptions,
  SemanticSearchResult,
} from '../../src/semantic.js'

// =============================================================================
// Deterministic Mock Embedding Generation
// =============================================================================

/**
 * Word vectors for deterministic semantic similarity
 *
 * Words in similar semantic domains have similar vectors.
 * This enables meaningful similarity calculations in tests.
 */
const SEMANTIC_VECTORS: Record<string, number[]> = {
  // AI/ML domain
  machine: [0.9, 0.1, 0.05, 0.02],
  learning: [0.85, 0.15, 0.08, 0.03],
  artificial: [0.88, 0.12, 0.06, 0.04],
  intelligence: [0.87, 0.13, 0.07, 0.05],
  neural: [0.82, 0.18, 0.09, 0.06],
  network: [0.75, 0.2, 0.15, 0.1],
  deep: [0.8, 0.17, 0.1, 0.08],
  ai: [0.92, 0.08, 0.04, 0.02],
  ml: [0.88, 0.12, 0.06, 0.03],

  // Programming domain
  programming: [0.15, 0.85, 0.1, 0.05],
  code: [0.12, 0.88, 0.12, 0.06],
  software: [0.18, 0.82, 0.15, 0.08],
  development: [0.2, 0.8, 0.18, 0.1],
  typescript: [0.1, 0.9, 0.08, 0.04],
  javascript: [0.12, 0.88, 0.1, 0.05],
  python: [0.25, 0.75, 0.12, 0.06],
  react: [0.08, 0.85, 0.2, 0.1],
  vue: [0.06, 0.84, 0.18, 0.08],
  frontend: [0.05, 0.8, 0.25, 0.12],

  // Database domain
  database: [0.1, 0.7, 0.08, 0.6],
  query: [0.12, 0.65, 0.1, 0.7],
  sql: [0.08, 0.6, 0.05, 0.75],
  index: [0.1, 0.58, 0.08, 0.72],
  optimization: [0.15, 0.55, 0.12, 0.68],
  performance: [0.18, 0.5, 0.15, 0.65],

  // DevOps domain
  kubernetes: [0.05, 0.6, 0.8, 0.15],
  docker: [0.08, 0.55, 0.82, 0.12],
  container: [0.06, 0.5, 0.85, 0.1],
  deployment: [0.1, 0.45, 0.78, 0.18],
  devops: [0.12, 0.48, 0.75, 0.2],

  // Food domain (very different from tech)
  cooking: [0.02, 0.05, 0.03, 0.02],
  recipe: [0.03, 0.04, 0.02, 0.03],
  food: [0.02, 0.03, 0.02, 0.02],
  pasta: [0.01, 0.02, 0.01, 0.01],
  pizza: [0.01, 0.03, 0.02, 0.01],
  italian: [0.02, 0.04, 0.02, 0.02],
  garden: [0.03, 0.02, 0.01, 0.02],
  flowers: [0.02, 0.01, 0.01, 0.01],

  // GraphQL/API
  graphql: [0.1, 0.75, 0.15, 0.55],
  api: [0.15, 0.7, 0.2, 0.5],
  rest: [0.12, 0.68, 0.18, 0.48],
  queries: [0.14, 0.65, 0.12, 0.6],

  // Testing
  testing: [0.1, 0.78, 0.08, 0.15],
  test: [0.08, 0.8, 0.06, 0.12],
  unit: [0.06, 0.82, 0.05, 0.1],
  integration: [0.12, 0.75, 0.1, 0.18],

  // State management
  state: [0.08, 0.82, 0.2, 0.08],
  management: [0.15, 0.75, 0.25, 0.12],
  hooks: [0.06, 0.88, 0.15, 0.05],
  useState: [0.05, 0.9, 0.12, 0.04],
  useEffect: [0.04, 0.88, 0.1, 0.03],

  // Related/Concept domain (for semantic similarity tests)
  related: [0.5, 0.5, 0.5, 0.5],
  concept: [0.55, 0.45, 0.55, 0.45],
  similar: [0.52, 0.48, 0.52, 0.48],
  different: [0.48, 0.52, 0.48, 0.52],
  words: [0.45, 0.55, 0.45, 0.55],
  semantically: [0.6, 0.4, 0.6, 0.4],

  // Exact match domain (distinctly different vectors)
  exact: [0.1, 0.1, 0.1, 0.9],
  match: [0.15, 0.15, 0.1, 0.85],
  title: [0.1, 0.2, 0.1, 0.8],
  contains: [0.12, 0.18, 0.12, 0.78],
  search: [0.08, 0.22, 0.08, 0.82],
  terms: [0.05, 0.25, 0.05, 0.85],
}

/**
 * Default vector for unknown words
 */
const DEFAULT_VECTOR = [0.1, 0.1, 0.1, 0.1]

/**
 * Simple hash function for deterministic randomness
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate a deterministic pseudo-random number from seed
 */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000
  return x - Math.floor(x)
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

/**
 * Get semantic vector for a word
 */
function getWordVector(word: string): number[] {
  const lower = word.toLowerCase()
  if (SEMANTIC_VECTORS[lower]) {
    return SEMANTIC_VECTORS[lower]
  }

  // Generate deterministic vector based on word hash
  const hash = simpleHash(lower)
  return DEFAULT_VECTOR.map((v, i) => v + seededRandom(hash, i) * 0.1)
}

/**
 * Generate deterministic embedding from text
 *
 * Uses semantic word vectors to create meaningful embeddings
 * where similar concepts have higher cosine similarity.
 *
 * @param text - The text to generate an embedding for
 * @param dimensions - The number of dimensions for the embedding (default: DEFAULT_EMBEDDING_DIMENSIONS)
 */
export function generateMockEmbedding(
  text: string,
  dimensions: number = DEFAULT_EMBEDDING_DIMENSIONS
): number[] {
  const words = tokenize(text)

  if (words.length === 0) {
    // Empty text - return zero vector with small noise
    return Array.from({ length: dimensions }, (_, i) => seededRandom(0, i) * 0.01)
  }

  // Aggregate word vectors
  const aggregated: number[] = [0, 0, 0, 0]
  for (const word of words) {
    const vec = getWordVector(word)
    for (let i = 0; i < 4; i++) {
      aggregated[i]! += vec[i]!
    }
  }

  // Normalize aggregated vector
  const norm = Math.sqrt(aggregated.reduce((sum, v) => sum + v * v, 0))
  const normalized = aggregated.map((v) => v / (norm || 1))

  // Expand to full embedding dimensions using deterministic expansion
  const textHash = simpleHash(text)
  const embedding = new Array(dimensions)

  for (let i = 0; i < dimensions; i++) {
    // Combine semantic vector with hash-based expansion
    const baseIndex = i % 4
    const base = normalized[baseIndex]!
    const noise = seededRandom(textHash, i) * 0.1 - 0.05
    embedding[i] = base + noise
  }

  // Final normalization
  const finalNorm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0))
  return embedding.map((v: number) => v / (finalNorm || 1))
}

/**
 * Calculate cosine similarity between two vectors
 */
export function mockCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  // Clamp to [0, 1] for normalized vectors
  return Math.max(0, Math.min(1, (dotProduct / magnitude + 1) / 2))
}

// =============================================================================
// Mock Semantic Provider Implementation
// =============================================================================

/**
 * In-memory storage interface for embeddings
 */
export interface MockEmbeddingStore {
  getEmbedding(type: string, id: string): Promise<number[] | null>
  setEmbedding(
    type: string,
    id: string,
    embedding: number[],
    metadata: Record<string, unknown>
  ): Promise<void>
  getAllEmbeddings(type: string): Promise<Array<{ id: string; embedding: number[] }>>
}

/**
 * Options for creating a mock semantic provider
 */
export interface MockSemanticProviderOptions {
  /**
   * The number of dimensions for embeddings.
   *
   * Common values:
   * - 384: sentence-transformers (default)
   * - 1536: OpenAI ada-002, text-embedding-3-small
   * - 3072: OpenAI text-embedding-3-large
   * - 1024: Cohere embed-english-v3.0
   * - 4096: Voyage AI large models
   *
   * @default 384
   */
  embeddingDimensions?: number
}

/**
 * Create a mock semantic provider for testing
 *
 * Uses deterministic embeddings based on text content to enable
 * meaningful semantic search in tests without requiring real AI providers.
 *
 * @param store - The embedding store for persistence
 * @param options - Configuration options including embeddingDimensions
 *
 * @example
 * ```ts
 * import { createMockSemanticProvider } from '../test/utils/mock-semantic.js'
 *
 * const store = {
 *   getEmbedding: async () => null,
 *   setEmbedding: async () => {},
 *   getAllEmbeddings: async () => [],
 * }
 *
 * const provider = createMockSemanticProvider(store, { embeddingDimensions: 1536 })
 * const embedding = await provider.embed('machine learning')
 * ```
 */
export function createMockSemanticProvider(
  store: MockEmbeddingStore,
  options?: MockSemanticProviderOptions
): SemanticProvider {
  const dimensions = options?.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMENSIONS

  return {
    dimensions,

    async embed(text: string): Promise<number[]> {
      return generateMockEmbedding(text, dimensions)
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      return texts.map((text) => generateMockEmbedding(text, dimensions))
    },

    async search(
      type: string,
      query: string | number[],
      options?: SemanticSearchOptions
    ): Promise<SemanticSearchResult[]> {
      const threshold = options?.threshold ?? 0
      const limit = options?.limit ?? 10

      // Get query embedding
      const queryEmbedding =
        typeof query === 'string' ? generateMockEmbedding(query, dimensions) : query

      // Get all embeddings for this type
      const embeddings = await store.getAllEmbeddings(type)

      // Calculate similarities and rank
      const results: SemanticSearchResult[] = []

      for (const { id, embedding } of embeddings) {
        const score = mockCosineSimilarity(queryEmbedding, embedding)

        if (score >= threshold) {
          results.push({ id, score, type })
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score)

      // Apply limit
      return results.slice(0, limit)
    },
  }
}
