/**
 * Tests for ai-functions Embeddings Integration
 *
 * This test file verifies the integration between ai-database and ai-functions
 * for real vector-based semantic search capabilities.
 *
 * Uses the EmbeddingProvider interface to inject mock implementations that
 * simulate ai-functions behavior for testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema, EmbeddingProvider } from '../src/index.js'

/**
 * Create a mock embedding provider that simulates ai-functions behavior.
 * Returns tracked mock functions for verification in tests.
 */
function createMockEmbeddingProvider() {
  const embedTextsMock = vi.fn().mockImplementation(async (texts: string[]) => ({
    embeddings: texts.map(() => [0.1, 0.2, 0.3, 0.4]),
    values: texts,
    usage: { tokens: texts.length * 5 }
  }))

  const findSimilarMock = vi.fn().mockImplementation(<T>(
    _queryEmbedding: number[],
    _embeddings: number[][],
    items: T[],
    options?: { topK?: number; minScore?: number }
  ) => {
    const topK = options?.topK ?? 10
    return items.slice(0, topK).map((item, index) => ({
      item,
      score: 0.95 - (index * 0.05),
      index
    }))
  })

  const cosineSimilarityMock = vi.fn().mockReturnValue(0.95)

  const provider: EmbeddingProvider = {
    embedTexts: embedTextsMock,
    findSimilar: findSimilarMock,
    cosineSimilarity: cosineSimilarityMock,
  }

  return {
    provider,
    mocks: {
      embedTexts: embedTextsMock,
      findSimilar: findSimilarMock,
      cosineSimilarity: cosineSimilarityMock,
    }
  }
}

describe('ai-functions Embeddings Integration', () => {
  let mockProvider: ReturnType<typeof createMockEmbeddingProvider>

  beforeEach(() => {
    mockProvider = createMockEmbeddingProvider()
    // Create provider with custom embedding provider
    setProvider(createMemoryProvider({
      embeddingProvider: mockProvider.provider
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('embedding generation on entity create', () => {
    const schema = {
      Occupation: {
        title: 'string',
        description: 'string?',
      },
    } as const satisfies DatabaseSchema

    it('should call embedTexts when creating entities', async () => {
      const { db } = DB(schema)

      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Writes code and builds software applications',
      })

      // The embedTexts function should have been called with the entity's text content
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalled()
    })

    it('should store embedding artifact after creation', async () => {
      const { db, artifacts } = DB(schema)

      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Writes code and builds software applications',
      })

      // Embedding should be stored as an artifact
      const embedding = await artifacts.get('Occupation/occ-1', 'embedding')
      expect(embedding).not.toBeNull()
      expect(Array.isArray(embedding?.content)).toBe(true)
    })

    it('should use embedding provider instead of mock embeddings', async () => {
      const { db, artifacts } = DB(schema)

      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Writes code',
      })

      // Verify the embedding provider was called
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalled()

      // The stored embedding should come from the mock provider
      const embedding = await artifacts.get('Occupation/occ-1', 'embedding')
      expect(embedding?.content).toBeDefined()
      expect(embedding?.metadata?.source).toBe('custom-provider')
    })
  })

  describe('semantic search using findSimilar', () => {
    const schema = {
      Occupation: {
        title: 'string',
        description: 'string?',
      },
    } as const satisfies DatabaseSchema

    it('should use findSimilar for semantic search', async () => {
      const { db } = DB(schema)

      // Create some occupations
      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Writes code',
      })

      await db.Occupation.create('occ-2', {
        title: 'Data Scientist',
        description: 'Analyzes data',
      })

      // Perform semantic search
      await db.Occupation.semanticSearch('Engineers who code')

      // findSimilar should have been called
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()
    })

    it('should return semantically similar results with scores', async () => {
      const { db } = DB(schema)

      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Writes code and builds applications',
      })

      await db.Occupation.create('occ-2', {
        title: 'Chef',
        description: 'Prepares food in restaurants',
      })

      const results = await db.Occupation.semanticSearch('Engineers who write code')

      // Results should have $score field
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.$score).toBeDefined()
      expect(typeof results[0]?.$score).toBe('number')
    })

    it('should use cosineSimilarity from embedding provider', async () => {
      // Create provider with only cosineSimilarity (no findSimilar)
      const limitedProvider: EmbeddingProvider = {
        embedTexts: mockProvider.mocks.embedTexts,
        cosineSimilarity: mockProvider.mocks.cosineSimilarity,
      }
      setProvider(createMemoryProvider({ embeddingProvider: limitedProvider }))

      const { db } = DB(schema)

      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
      })

      await db.Occupation.semanticSearch('coder')

      // cosineSimilarity should be used for scoring (since no findSimilar)
      expect(mockProvider.mocks.cosineSimilarity).toHaveBeenCalled()
    })
  })

  describe('batch embedding operations', () => {
    const schema = {
      Skill: {
        name: 'string',
        category: 'string?',
      },
    } as const satisfies DatabaseSchema

    it('should embed multiple entities', async () => {
      const { db } = DB(schema)

      // Create multiple entities
      await db.Skill.create('skill-1', { name: 'TypeScript', category: 'Programming' })
      await db.Skill.create('skill-2', { name: 'Python', category: 'Programming' })
      await db.Skill.create('skill-3', { name: 'React', category: 'Frontend' })

      // embedTexts should have been called multiple times
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalledTimes(3)
    })
  })

  describe('embedding on update', () => {
    const schema = {
      Article: {
        title: 'string',
        content: 'string',
      },
    } as const satisfies DatabaseSchema

    it('should regenerate embeddings when entity is updated', async () => {
      const { db } = DB(schema)

      await db.Article.create('art-1', {
        title: 'Original Title',
        content: 'Original content',
      })

      // Clear mock to track new calls
      mockProvider.mocks.embedTexts.mockClear()

      // Update the article
      await db.Article.update('art-1', {
        title: 'Updated Title',
        content: 'Completely new content about different topics',
      })

      // embedTexts should be called again for the update
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalled()
    })
  })

  describe('configuration and provider options', () => {
    const schema = {
      Document: {
        title: 'string',
        body: 'string',
      },
    } as const satisfies DatabaseSchema

    it('should respect embedding configuration from DB options', async () => {
      // Clear mock to track only these calls
      mockProvider.mocks.embedTexts.mockClear()

      const { db } = DB(schema, {
        embeddings: {
          Document: {
            fields: ['title'], // Only embed title, not body
          },
        },
      })

      await db.Document.create('doc-1', {
        title: 'Test Document',
        body: 'This body should not be embedded based on config',
      })

      // embedTexts should only receive the title field content
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalled()
      const callArgs = mockProvider.mocks.embedTexts.mock.calls[0]
      if (callArgs) {
        const textArray = callArgs[0] as string[]
        // The embedded text should only contain the title
        expect(textArray.some(t => t.includes('Test Document'))).toBe(true)
        expect(textArray.some(t => t.includes('body should not'))).toBe(false)
      }
    })

    it('should skip embedding for disabled types', async () => {
      const schemaWithLog = {
        Document: {
          title: 'string',
        },
        AuditLog: {
          action: 'string',
        },
      } as const satisfies DatabaseSchema

      // Clear mock to track only these calls
      mockProvider.mocks.embedTexts.mockClear()

      const { db } = DB(schemaWithLog, {
        embeddings: {
          AuditLog: false, // Disable embeddings for AuditLog
        },
      })

      // Create a document (should embed)
      await db.Document.create('doc-1', { title: 'Test' })
      const docCalls = mockProvider.mocks.embedTexts.mock.calls.length

      mockProvider.mocks.embedTexts.mockClear()

      // Create an audit log (should NOT embed)
      await db.AuditLog.create('log-1', { action: 'user.login' })
      const logCalls = mockProvider.mocks.embedTexts.mock.calls.length

      // AuditLog should not trigger embedTexts
      expect(docCalls).toBe(1)
      expect(logCalls).toBe(0)
    })
  })

  describe('fallback behavior', () => {
    it('should fallback to mock embeddings when provider fails', async () => {
      // Create a failing provider
      const failingProvider: EmbeddingProvider = {
        embedTexts: vi.fn().mockRejectedValue(new Error('Provider failed')),
      }
      setProvider(createMemoryProvider({ embeddingProvider: failingProvider }))

      const schema = {
        Item: { name: 'string' },
      } as const satisfies DatabaseSchema

      const { db, artifacts } = DB(schema)

      // Should not throw, should fallback to mock embedding
      await db.Item.create('item-1', { name: 'Test Item' })

      // Embedding should still be stored (using fallback mock)
      const embedding = await artifacts.get('Item/item-1', 'embedding')
      expect(embedding).not.toBeNull()
      expect(Array.isArray(embedding?.content)).toBe(true)
    })
  })
})

/**
 * Tests for direct ai-functions module integration (when useAiFunctions: true)
 *
 * These tests verify that when useAiFunctions is enabled, the MemoryProvider
 * attempts to dynamically import and use ai-functions.
 *
 * Note: These tests will only pass in environments where ai-functions is available.
 * In test environments without ai-functions, they will fallback to mock embeddings.
 */
describe('ai-functions direct integration (useAiFunctions flag)', () => {
  beforeEach(() => {
    // Use default mock provider (no custom embedding provider)
    setProvider(createMemoryProvider({ useAiFunctions: true }))
  })

  it('should attempt to use ai-functions when flag is enabled', async () => {
    const schema = {
      TestEntity: { name: 'string' },
    } as const satisfies DatabaseSchema

    const { db, artifacts } = DB(schema)

    // Create entity - this will try to use ai-functions
    // In test env without ai-functions, it will fallback to mock
    await db.TestEntity.create('test-1', { name: 'Test' })

    // Embedding should still be generated (either via ai-functions or fallback)
    const embedding = await artifacts.get('TestEntity/test-1', 'embedding')
    expect(embedding).not.toBeNull()
  })
})
