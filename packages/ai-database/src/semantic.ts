/**
 * Semantic Search Infrastructure
 *
 * Provides embedding generation and semantic/hybrid search capabilities.
 * Uses a deterministic mock embedding provider for testing.
 *
 * @packageDocumentation
 */

import { EMBEDDING_DIMENSIONS } from './constants.js'

// =============================================================================
// SemanticProvider Interface
// =============================================================================

/**
 * Provider interface for embedding generation and semantic search
 */
export interface SemanticProvider {
  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>

  /**
   * Generate embeddings for multiple texts (batch operation)
   */
  embedBatch(texts: string[]): Promise<number[][]>

  /**
   * Search for similar entities by text query or embedding vector
   */
  search(
    type: string,
    query: string | number[],
    options?: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]>

  /**
   * Get embedding dimensions
   */
  readonly dimensions: number
}

/**
 * Options for semantic search
 */
export interface SemanticSearchOptions {
  /** Minimum similarity score (0-1), defaults to 0 */
  threshold?: number
  /** Maximum number of results, defaults to 10 */
  limit?: number
  /** Fields to consider for embedding (used for metadata) */
  fields?: string[]
}

/**
 * Result from semantic search
 */
export interface SemanticSearchResult {
  /** Entity ID */
  id: string
  /** Similarity score (0-1) */
  score: number
  /** Entity type */
  type?: string
}

/**
 * Options for hybrid search (FTS + semantic)
 */
export interface HybridSearchOptions {
  /** Minimum similarity score for semantic results */
  minScore?: number
  /** Maximum number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** RRF k parameter (default: 60) */
  rrfK?: number
  /** Weight for FTS results (default: 0.5) */
  ftsWeight?: number
  /** Weight for semantic results (default: 0.5) */
  semanticWeight?: number
}

/**
 * Result from hybrid search with RRF scoring
 */
export interface HybridSearchResult<T = unknown> {
  /** The entity data */
  entity: T
  /** Combined RRF score */
  rrfScore: number
  /** Rank in FTS results (Infinity if not in FTS) */
  ftsRank: number
  /** Rank in semantic results (Infinity if not in semantic) */
  semanticRank: number
  /** Semantic similarity score (0-1) */
  semanticScore: number
}

/**
 * Embedding configuration for a specific entity type
 */
export interface EmbeddingConfig {
  /** Fields to embed (defaults to text/markdown fields) */
  fields?: string[]
  /** Whether embeddings are enabled (defaults to true) */
  enabled?: boolean
}

/**
 * Global embedding configuration
 */
export interface EmbeddingsConfig {
  [typeName: string]: EmbeddingConfig | false
}

// =============================================================================
// Deterministic Mock Embedding Provider
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
    hash = ((hash << 5) - hash) + char
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
    .filter(w => w.length > 0)
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
 */
function generateEmbedding(text: string): number[] {
  const words = tokenize(text)

  if (words.length === 0) {
    // Empty text - return zero vector with small noise
    return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
      seededRandom(0, i) * 0.01
    )
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
  const normalized = aggregated.map(v => v / (norm || 1))

  // Expand to full embedding dimensions using deterministic expansion
  const textHash = simpleHash(text)
  const embedding = new Array(EMBEDDING_DIMENSIONS)

  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
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
export function cosineSimilarity(a: number[], b: number[]): number {
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

/**
 * Compute RRF (Reciprocal Rank Fusion) score
 *
 * RRF combines rankings from multiple sources using the formula:
 * score = sum(1 / (k + rank))
 *
 * @param ftsRank - Rank in FTS results (1-indexed, Infinity if not found)
 * @param semanticRank - Rank in semantic results (1-indexed, Infinity if not found)
 * @param k - Constant to prevent extreme scores (default: 60)
 * @param ftsWeight - Weight for FTS component (default: 0.5)
 * @param semanticWeight - Weight for semantic component (default: 0.5)
 */
export function computeRRF(
  ftsRank: number,
  semanticRank: number,
  k: number = 60,
  ftsWeight: number = 0.5,
  semanticWeight: number = 0.5
): number {
  const ftsScore = ftsRank < Infinity ? ftsWeight / (k + ftsRank) : 0
  const semanticScore = semanticRank < Infinity ? semanticWeight / (k + semanticRank) : 0
  return ftsScore + semanticScore
}

// =============================================================================
// Mock Semantic Provider Implementation
// =============================================================================

/**
 * In-memory storage for embeddings (shared with MemoryProvider via artifacts)
 */
interface EmbeddingStore {
  getEmbedding(type: string, id: string): Promise<number[] | null>
  setEmbedding(type: string, id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void>
  getAllEmbeddings(type: string): Promise<Array<{ id: string; embedding: number[] }>>
}

/**
 * Create a mock semantic provider for testing
 *
 * Uses deterministic embeddings based on text content to enable
 * meaningful semantic search in tests.
 */
export function createMockSemanticProvider(store: EmbeddingStore): SemanticProvider {
  return {
    dimensions: EMBEDDING_DIMENSIONS,

    async embed(text: string): Promise<number[]> {
      return generateEmbedding(text)
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      return texts.map(text => generateEmbedding(text))
    },

    async search(
      type: string,
      query: string | number[],
      options?: SemanticSearchOptions
    ): Promise<SemanticSearchResult[]> {
      const threshold = options?.threshold ?? 0
      const limit = options?.limit ?? 10

      // Get query embedding
      const queryEmbedding = typeof query === 'string'
        ? generateEmbedding(query)
        : query

      // Get all embeddings for this type
      const embeddings = await store.getAllEmbeddings(type)

      // Calculate similarities and rank
      const results: SemanticSearchResult[] = []

      for (const { id, embedding } of embeddings) {
        const score = cosineSimilarity(queryEmbedding, embedding)

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

// =============================================================================
// Embedding Text Extraction
// =============================================================================

/**
 * Extract embeddable text from entity data
 *
 * @param data - Entity data object
 * @param fields - Fields to embed (undefined = auto-detect text fields)
 */
export function extractEmbeddableText(
  data: Record<string, unknown>,
  fields?: string[]
): { text: string; fields: string[] } {
  const embeddedFields: string[] = []
  const textParts: string[] = []

  // If specific fields requested, use those
  if (fields && fields.length > 0) {
    for (const field of fields) {
      const value = data[field]
      if (typeof value === 'string' && value.trim()) {
        textParts.push(value)
        embeddedFields.push(field)
      }
    }
  } else {
    // Auto-detect text fields
    for (const [key, value] of Object.entries(data)) {
      // Skip internal fields
      if (key.startsWith('$') || key.startsWith('_')) continue
      // Skip timestamps
      if (key.endsWith('At') || key.endsWith('_at')) continue

      if (typeof value === 'string' && value.trim()) {
        textParts.push(value)
        embeddedFields.push(key)
      } else if (Array.isArray(value)) {
        // Handle string arrays (like tags)
        const stringValues = value.filter(v => typeof v === 'string')
        if (stringValues.length > 0) {
          textParts.push(stringValues.join(' '))
          embeddedFields.push(key)
        }
      }
    }
  }

  return {
    text: textParts.join('\n\n'),
    fields: embeddedFields,
  }
}

/**
 * Generate content hash for cache invalidation
 */
export function generateContentHash(text: string): string {
  const hash = simpleHash(text)
  return hash.toString(16).padStart(8, '0')
}

// =============================================================================
// Default Embeddable Fields by Type
// =============================================================================

/**
 * Get fields to embed for an entity type
 *
 * Returns configured fields or auto-detects text fields.
 */
export function getEmbeddableFields(
  typeName: string,
  schema: Record<string, string>,
  config?: EmbeddingsConfig
): string[] | null {
  // Check if embeddings are disabled for this type
  const typeConfig = config?.[typeName]
  if (typeConfig === false) {
    return null
  }

  // Use configured fields if specified
  if (typeConfig && typeConfig.fields) {
    return typeConfig.fields
  }

  // Auto-detect text fields from schema
  const textFields: string[] = []
  for (const [fieldName, fieldType] of Object.entries(schema)) {
    const baseType = fieldType.replace(/[\?\[\]]/g, '').split('.')[0]
    if (baseType === 'string' || baseType === 'markdown') {
      textFields.push(fieldName)
    }
  }

  return textFields.length > 0 ? textFields : null
}

// =============================================================================
// Type-safe Result Types
// =============================================================================

/**
 * Entity with semantic search score
 */
export type WithSemanticScore<T> = T & {
  /** Semantic similarity score (0-1) */
  $score: number
}

/**
 * Entity with hybrid search scores
 */
export type WithHybridScore<T> = T & {
  /** Combined RRF score */
  $rrfScore: number
  /** Rank in FTS results (Infinity if not in FTS) */
  $ftsRank: number
  /** Rank in semantic results (Infinity if not in semantic) */
  $semanticRank: number
  /** Semantic similarity score */
  $score: number
}
