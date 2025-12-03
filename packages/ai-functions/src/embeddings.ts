/**
 * Embedding utilities from AI SDK
 *
 * Re-exports embed, embedMany, and cosineSimilarity from the Vercel AI SDK
 * with additional convenience wrappers.
 *
 * Default model: Cloudflare Workers AI @cf/baai/bge-m3
 *
 * @packageDocumentation
 */

// Re-export core embedding functions from AI SDK
export { embed, embedMany, cosineSimilarity } from 'ai'

// Re-export types
export type {
  EmbeddingModel,
  Embedding
} from 'ai'

// Re-export Cloudflare provider from ai-providers
export { cloudflare, cloudflareEmbedding, DEFAULT_CF_EMBEDDING_MODEL } from 'ai-providers/cloudflare'

import { embed as aiEmbed, embedMany as aiEmbedMany } from 'ai'
import { cloudflareEmbedding, DEFAULT_CF_EMBEDDING_MODEL } from 'ai-providers/cloudflare'

/**
 * Get the default embedding model (Cloudflare @cf/baai/bge-m3)
 */
export function getDefaultEmbeddingModel() {
  return cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL)
}

/**
 * Embed a single value using the default Cloudflare model
 *
 * @example
 * ```ts
 * import { embedText } from 'ai-functions'
 *
 * const { embedding } = await embedText('hello world')
 * ```
 */
export async function embedText(value: string) {
  return aiEmbed({
    model: getDefaultEmbeddingModel(),
    value
  })
}

/**
 * Embed multiple values using the default Cloudflare model
 *
 * @example
 * ```ts
 * import { embedTexts } from 'ai-functions'
 *
 * const { embeddings } = await embedTexts(['doc1', 'doc2', 'doc3'])
 * ```
 */
export async function embedTexts(values: string[]) {
  return aiEmbedMany({
    model: getDefaultEmbeddingModel(),
    values
  })
}

/**
 * Result of an embed operation
 */
export interface EmbedResult<T = string> {
  /** The original input value */
  value: T
  /** The generated embedding vector */
  embedding: number[]
  /** Token usage */
  usage: {
    tokens: number
  }
}

/**
 * Result of an embedMany operation
 */
export interface EmbedManyResult<T = string> {
  /** The original input values */
  values: T[]
  /** The generated embedding vectors */
  embeddings: number[][]
  /** Token usage */
  usage: {
    tokens: number
  }
}

/**
 * Find the most similar items to a query embedding
 *
 * @example
 * ```ts
 * import { embed, embedMany, findSimilar } from 'ai-functions'
 *
 * const documents = ['doc1', 'doc2', 'doc3']
 * const { embeddings } = await embedMany({ model, values: documents })
 * const { embedding: queryEmbedding } = await embed({ model, value: 'search query' })
 *
 * const results = findSimilar(queryEmbedding, embeddings, documents, { topK: 2 })
 * // [{ item: 'doc1', score: 0.95, index: 0 }, { item: 'doc2', score: 0.82, index: 1 }]
 * ```
 */
export function findSimilar<T>(
  queryEmbedding: number[],
  embeddings: number[][],
  items: T[],
  options: {
    /** Number of results to return (default: 10) */
    topK?: number
    /** Minimum similarity score (default: 0) */
    minScore?: number
  } = {}
): Array<{ item: T; score: number; index: number }> {
  const { topK = 10, minScore = 0 } = options

  // Import cosineSimilarity dynamically to avoid issues if ai isn't installed
  const { cosineSimilarity } = require('ai')

  const scored = embeddings
    .map((embedding, index) => ({
      item: items[index]!,
      score: cosineSimilarity(queryEmbedding, embedding) as number,
      index
    }))
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored
}

/**
 * Calculate pairwise similarities between all embeddings
 *
 * @example
 * ```ts
 * const matrix = pairwiseSimilarity(embeddings)
 * // matrix[i][j] = similarity between embeddings[i] and embeddings[j]
 * ```
 */
export function pairwiseSimilarity(embeddings: number[][]): number[][] {
  const { cosineSimilarity } = require('ai')

  const n = embeddings.length
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    matrix[i]![i] = 1 // Self-similarity is always 1
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j])
      matrix[i]![j] = sim
      matrix[j]![i] = sim
    }
  }

  return matrix
}

/**
 * Cluster embeddings by similarity using a simple threshold-based approach
 *
 * @example
 * ```ts
 * const clusters = clusterBySimilarity(embeddings, items, { threshold: 0.8 })
 * // [[item1, item2], [item3], [item4, item5, item6]]
 * ```
 */
export function clusterBySimilarity<T>(
  embeddings: number[][],
  items: T[],
  options: {
    /** Similarity threshold for clustering (default: 0.8) */
    threshold?: number
  } = {}
): T[][] {
  const { threshold = 0.8 } = options
  const { cosineSimilarity } = require('ai')

  const n = embeddings.length
  const assigned = new Set<number>()
  const clusters: T[][] = []

  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue

    const cluster: T[] = [items[i]!]
    assigned.add(i)

    for (let j = i + 1; j < n; j++) {
      if (assigned.has(j)) continue

      const sim = cosineSimilarity(embeddings[i], embeddings[j])
      if (sim >= threshold) {
        cluster.push(items[j]!)
        assigned.add(j)
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

/**
 * Average multiple embeddings into a single embedding
 * Useful for creating document embeddings from chunk embeddings
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return []

  const dim = embeddings[0]!.length
  const result = new Array(dim).fill(0)

  for (const embedding of embeddings) {
    for (let i = 0; i < dim; i++) {
      result[i] += embedding[i]
    }
  }

  const n = embeddings.length
  for (let i = 0; i < dim; i++) {
    result[i] /= n
  }

  return result
}

/**
 * Normalize an embedding to unit length
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude === 0) return embedding
  return embedding.map(val => val / magnitude)
}
