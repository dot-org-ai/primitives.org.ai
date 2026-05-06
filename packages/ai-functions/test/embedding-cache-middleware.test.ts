/**
 * Tests for embeddingCacheMiddleware — embedding-side analogue of
 * cacheMiddleware for `wrapEmbeddingModel`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { wrapEmbeddingModel } from 'ai'
import { MockEmbeddingModelV3 } from 'ai/test'
import { embeddingCacheMiddleware } from '../src/index.js'

describe('embeddingCacheMiddleware', () => {
  const originalGate = process.env['V3_EVAL_CACHE']

  beforeEach(() => {
    process.env['V3_EVAL_CACHE'] = '1'
  })

  afterEach(() => {
    if (originalGate === undefined) {
      delete process.env['V3_EVAL_CACHE']
    } else {
      process.env['V3_EVAL_CACHE'] = originalGate
    }
  })

  it('returns cached embeddings on second call with same values', async () => {
    let callCount = 0
    const upstream = new MockEmbeddingModelV3({
      modelId: 'test-embed',
      doEmbed: async () => {
        callCount++
        return {
          embeddings: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
          ],
        }
      },
    })

    const wrapped = wrapEmbeddingModel({
      model: upstream,
      middleware: embeddingCacheMiddleware({ enabled: true }),
    })

    const r1 = await wrapped.doEmbed({ values: ['a', 'b'] })
    expect(r1.embeddings).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ])
    expect(callCount).toBe(1)

    const r2 = await wrapped.doEmbed({ values: ['a', 'b'] })
    expect(r2.embeddings).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ])
    expect(callCount).toBe(1) // cache hit — no second upstream call
  })

  it('treats different value batches as separate keys', async () => {
    let callCount = 0
    const upstream = new MockEmbeddingModelV3({
      modelId: 'test-embed',
      doEmbed: async ({ values }) => {
        callCount++
        return {
          embeddings: values.map((_, i) => [i, i + 1]),
        }
      },
    })
    const wrapped = wrapEmbeddingModel({
      model: upstream,
      middleware: embeddingCacheMiddleware({ enabled: true }),
    })

    await wrapped.doEmbed({ values: ['a'] })
    await wrapped.doEmbed({ values: ['b'] })
    expect(callCount).toBe(2)
  })

  it('falls through to upstream when env gate is unset', async () => {
    delete process.env['V3_EVAL_CACHE']
    let callCount = 0
    const upstream = new MockEmbeddingModelV3({
      modelId: 'test-embed',
      doEmbed: async () => {
        callCount++
        return { embeddings: [[1, 2, 3]] }
      },
    })
    const wrapped = wrapEmbeddingModel({
      model: upstream,
      middleware: embeddingCacheMiddleware(),
    })

    await wrapped.doEmbed({ values: ['x'] })
    await wrapped.doEmbed({ values: ['x'] })
    expect(callCount).toBe(2) // no caching when gate is off
  })

  it('respects explicit enabled: false override', async () => {
    let callCount = 0
    const upstream = new MockEmbeddingModelV3({
      modelId: 'test-embed',
      doEmbed: async () => {
        callCount++
        return { embeddings: [[1, 2, 3]] }
      },
    })
    const wrapped = wrapEmbeddingModel({
      model: upstream,
      middleware: embeddingCacheMiddleware({ enabled: false }),
    })

    await wrapped.doEmbed({ values: ['x'] })
    await wrapped.doEmbed({ values: ['x'] })
    expect(callCount).toBe(2)
  })

  it('evicts entries past TTL and re-fetches', async () => {
    let callCount = 0
    const upstream = new MockEmbeddingModelV3({
      modelId: 'test-embed',
      doEmbed: async () => {
        callCount++
        return { embeddings: [[callCount]] }
      },
    })
    const wrapped = wrapEmbeddingModel({
      model: upstream,
      middleware: embeddingCacheMiddleware({ enabled: true, ttlMs: -1 }),
      // TTL = -1 → every entry is "older than -1 ms" → always evicted on access
    })

    await wrapped.doEmbed({ values: ['x'] })
    await wrapped.doEmbed({ values: ['x'] })
    expect(callCount).toBe(2) // TTL expired, re-fetch
  })
})
