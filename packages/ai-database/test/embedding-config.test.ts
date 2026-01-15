/**
 * Tests for Configurable Embedding Dimensions
 *
 * RED phase: These tests verify that embedding dimensions can be configured
 * instead of being hardcoded to 384.
 *
 * @see aip-kdfx - RED: Write tests for configurable embedding dimensions
 * @see aip-0gf4 - GREEN: Make embedding dimensions configurable
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import { DEFAULT_EMBEDDING_DIMENSIONS } from '../src/constants.js'
import { createMockSemanticProvider } from './utils/mock-semantic.js'
import type { DatabaseSchema } from '../src/index.js'

describe('configurable embedding dimensions', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('DEFAULT_EMBEDDING_DIMENSIONS constant', () => {
    it('should export DEFAULT_EMBEDDING_DIMENSIONS as 384', () => {
      // The default should be 384 for sentence-transformers compatibility
      expect(DEFAULT_EMBEDDING_DIMENSIONS).toBe(384)
    })
  })

  describe('semantic provider embeddingDimensions option', () => {
    it('should accept embeddingDimensions option', () => {
      // Create a mock embedding store
      const store = {
        getEmbedding: async () => null,
        setEmbedding: async () => {},
        getAllEmbeddings: async () => [],
      }

      // Should accept embeddingDimensions option without error
      const provider = createMockSemanticProvider(store, { embeddingDimensions: 1536 })

      // Provider should report configured dimensions
      expect(provider.dimensions).toBe(1536)
    })

    it('should default to DEFAULT_EMBEDDING_DIMENSIONS when not specified', () => {
      const store = {
        getEmbedding: async () => null,
        setEmbedding: async () => {},
        getAllEmbeddings: async () => [],
      }

      const provider = createMockSemanticProvider(store)

      // Should default to 384
      expect(provider.dimensions).toBe(384)
    })

    it('should support OpenAI ada-002 dimensions (1536)', async () => {
      const store = {
        getEmbedding: async () => null,
        setEmbedding: async () => {},
        getAllEmbeddings: async () => [],
      }

      const provider = createMockSemanticProvider(store, { embeddingDimensions: 1536 })

      // Generate an embedding
      const embedding = await provider.embed('test text')

      // Should have OpenAI dimensions
      expect(embedding.length).toBe(1536)
      expect(provider.dimensions).toBe(1536)
    })

    it('should support Cohere dimensions (4096)', async () => {
      const store = {
        getEmbedding: async () => null,
        setEmbedding: async () => {},
        getAllEmbeddings: async () => [],
      }

      const provider = createMockSemanticProvider(store, { embeddingDimensions: 4096 })

      // Generate an embedding
      const embedding = await provider.embed('test text')

      // Should have Cohere dimensions
      expect(embedding.length).toBe(4096)
      expect(provider.dimensions).toBe(4096)
    })
  })

  describe('memory provider with configurable dimensions', () => {
    const schema = {
      Article: {
        title: 'string',
        content: 'markdown',
      },
    } as const satisfies DatabaseSchema

    it('should use configured dimensions in memory provider', async () => {
      // Create memory provider with custom dimensions
      setProvider(createMemoryProvider({ embeddingDimensions: 1536 }))

      const { db, artifacts } = DB(schema)

      await db.Article.create('article-1', {
        title: 'Test Article',
        content: 'This is test content for embedding.',
      })

      const embedding = await artifacts.get('Article/article-1', 'embedding')

      expect(embedding).not.toBeNull()
      expect(embedding?.metadata?.dimensions).toBe(1536)
      expect((embedding?.content as number[]).length).toBe(1536)
    })

    it('should default to 384 dimensions in memory provider', async () => {
      // Create memory provider without specifying dimensions
      setProvider(createMemoryProvider())

      const { db, artifacts } = DB(schema)

      await db.Article.create('article-2', {
        title: 'Default Dimensions Article',
        content: 'Content for default dimension testing.',
      })

      const embedding = await artifacts.get('Article/article-2', 'embedding')

      expect(embedding).not.toBeNull()
      expect(embedding?.metadata?.dimensions).toBe(384)
      expect((embedding?.content as number[]).length).toBe(384)
    })

    it('should use dimensions from custom embedding provider', async () => {
      // Create a mock embedding provider that returns 768-dimensional embeddings
      const customProvider = {
        embedTexts: async (texts: string[]) => ({
          embeddings: texts.map(() => new Array(768).fill(0.1)),
        }),
      }

      setProvider(createMemoryProvider({ embeddingProvider: customProvider }))

      const { db, artifacts } = DB(schema)

      await db.Article.create('article-3', {
        title: 'Custom Provider Article',
        content: 'Content with custom provider.',
      })

      const embedding = await artifacts.get('Article/article-3', 'embedding')

      expect(embedding).not.toBeNull()
      // The dimensions should match what the custom provider returns
      expect(embedding?.metadata?.dimensions).toBe(768)
      expect((embedding?.content as number[]).length).toBe(768)
    })
  })

  describe('batch embedding with configurable dimensions', () => {
    it('should use configured dimensions for batch operations', async () => {
      const store = {
        getEmbedding: async () => null,
        setEmbedding: async () => {},
        getAllEmbeddings: async () => [],
      }

      const provider = createMockSemanticProvider(store, { embeddingDimensions: 2048 })

      const embeddings = await provider.embedBatch(['text 1', 'text 2', 'text 3'])

      expect(embeddings.length).toBe(3)
      embeddings.forEach((embedding) => {
        expect(embedding.length).toBe(2048)
      })
    })
  })
})
