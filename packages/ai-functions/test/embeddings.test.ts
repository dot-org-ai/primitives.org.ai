/**
 * Tests for embedding utilities
 *
 * Pure unit tests for utility functions that don't require AI API calls.
 * Gateway-dependent tests are skipped if no gateway is configured.
 */

import { describe, it, expect } from 'vitest'
import {
  cosineSimilarity,
  findSimilar,
  pairwiseSimilarity,
  clusterBySimilarity,
  averageEmbeddings,
  normalizeEmbedding,
} from '../src/index.js'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 0, 0]
    const b = [1, 0, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0]
    const b = [-1, 0, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1)
  })

  it('handles non-normalized vectors', () => {
    const a = [2, 0, 0]
    const b = [5, 0, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)
  })

  it('works with higher dimensional vectors', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [1, 2, 3, 4, 5]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)
  })
})

describe('findSimilar', () => {
  const embeddings = [
    [1, 0, 0],
    [0.9, 0.1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ]
  const items = ['A', 'B', 'C', 'D', 'E']

  it('finds most similar items', () => {
    const query = [1, 0, 0]
    const results = findSimilar(query, embeddings, items, { topK: 3 })

    expect(results).toHaveLength(3)
    expect(results[0].item).toBe('A') // Exact match
    expect(results[0].score).toBeCloseTo(1)
    expect(results[1].item).toBe('B') // Very similar
  })

  it('respects topK parameter', () => {
    const query = [1, 0, 0]
    const results = findSimilar(query, embeddings, items, { topK: 2 })

    expect(results).toHaveLength(2)
  })

  it('filters by minScore', () => {
    const query = [1, 0, 0]
    const results = findSimilar(query, embeddings, items, { minScore: 0.5 })

    // Only A and B should have score >= 0.5
    expect(results.every(r => r.score >= 0.5)).toBe(true)
    expect(results).toHaveLength(2)
  })

  it('returns index in results', () => {
    const query = [0, 1, 0]
    const results = findSimilar(query, embeddings, items, { topK: 1 })

    expect(results[0].item).toBe('C')
    expect(results[0].index).toBe(2)
  })

  it('handles empty embeddings', () => {
    const query = [1, 0, 0]
    const results = findSimilar(query, [], [], { topK: 5 })

    expect(results).toHaveLength(0)
  })
})

describe('pairwiseSimilarity', () => {
  it('creates a symmetric matrix', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]

    const matrix = pairwiseSimilarity(embeddings)

    expect(matrix).toHaveLength(3)
    expect(matrix[0]).toHaveLength(3)

    // Check symmetry
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i])
      }
    }
  })

  it('has 1s on the diagonal', () => {
    const embeddings = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]

    const matrix = pairwiseSimilarity(embeddings)

    for (let i = 0; i < 3; i++) {
      expect(matrix[i][i]).toBeCloseTo(1)
    }
  })

  it('correctly computes similarity for orthogonal vectors', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
    ]

    const matrix = pairwiseSimilarity(embeddings)

    expect(matrix[0][1]).toBeCloseTo(0)
    expect(matrix[1][0]).toBeCloseTo(0)
  })
})

describe('clusterBySimilarity', () => {
  it('groups similar items together', () => {
    const embeddings = [
      [1, 0, 0],
      [0.95, 0.05, 0],
      [0, 1, 0],
      [0.05, 0.95, 0],
    ]
    const items = ['A', 'A-like', 'B', 'B-like']

    const clusters = clusterBySimilarity(embeddings, items, { threshold: 0.9 })

    // Should create 2 clusters
    expect(clusters).toHaveLength(2)

    // Find the cluster with A
    const clusterA = clusters.find(c => c.includes('A'))
    expect(clusterA).toContain('A-like')

    // Find the cluster with B
    const clusterB = clusters.find(c => c.includes('B'))
    expect(clusterB).toContain('B-like')
  })

  it('creates single-item clusters for dissimilar items', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
    const items = ['X', 'Y', 'Z']

    const clusters = clusterBySimilarity(embeddings, items, { threshold: 0.9 })

    // Each item should be in its own cluster
    expect(clusters).toHaveLength(3)
    expect(clusters.every(c => c.length === 1)).toBe(true)
  })

  it('puts all items in one cluster at low threshold', () => {
    const embeddings = [
      [1, 0.1, 0.1],
      [0.9, 0.2, 0.1],
      [0.8, 0.3, 0.1],
    ]
    const items = ['A', 'B', 'C']

    const clusters = clusterBySimilarity(embeddings, items, { threshold: 0.5 })

    // All items similar enough to be in one cluster
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(3)
  })
})

describe('averageEmbeddings', () => {
  it('averages multiple embeddings', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]

    const avg = averageEmbeddings(embeddings)

    expect(avg).toHaveLength(3)
    expect(avg[0]).toBeCloseTo(1 / 3)
    expect(avg[1]).toBeCloseTo(1 / 3)
    expect(avg[2]).toBeCloseTo(1 / 3)
  })

  it('returns empty array for empty input', () => {
    const avg = averageEmbeddings([])
    expect(avg).toEqual([])
  })

  it('returns same vector for single input', () => {
    const embedding = [1, 2, 3]
    const avg = averageEmbeddings([embedding])

    expect(avg).toEqual([1, 2, 3])
  })
})

describe('normalizeEmbedding', () => {
  it('normalizes a vector to unit length', () => {
    const embedding = [3, 4, 0] // length = 5
    const normalized = normalizeEmbedding(embedding)

    expect(normalized[0]).toBeCloseTo(0.6)
    expect(normalized[1]).toBeCloseTo(0.8)
    expect(normalized[2]).toBeCloseTo(0)

    // Check magnitude is 1
    const magnitude = Math.sqrt(
      normalized.reduce((sum, val) => sum + val * val, 0)
    )
    expect(magnitude).toBeCloseTo(1)
  })

  it('handles already normalized vectors', () => {
    const embedding = [1, 0, 0]
    const normalized = normalizeEmbedding(embedding)

    expect(normalized).toEqual([1, 0, 0])
  })

  it('handles zero vector', () => {
    const embedding = [0, 0, 0]
    const normalized = normalizeEmbedding(embedding)

    expect(normalized).toEqual([0, 0, 0])
  })
})

// Skip API-dependent tests if no gateway
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.CF_ACCOUNT_ID

describe.skipIf(!hasGateway)('embedText and embedTexts', () => {
  // These tests would require actual API calls
  // They're here as placeholders for when the gateway is available

  it.skip('embeds a single text', async () => {
    // const { embedText } = await import('../src/index.js')
    // const { embedding } = await embedText('hello world')
    // expect(Array.isArray(embedding)).toBe(true)
    // expect(embedding.length).toBeGreaterThan(0)
  })

  it.skip('embeds multiple texts', async () => {
    // const { embedTexts } = await import('../src/index.js')
    // const { embeddings } = await embedTexts(['doc1', 'doc2', 'doc3'])
    // expect(embeddings).toHaveLength(3)
  })
})
