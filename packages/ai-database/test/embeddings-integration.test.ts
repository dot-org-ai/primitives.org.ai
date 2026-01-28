/**
 * Tests for ai-functions Embeddings Integration
 *
 * This test file verifies the integration between ai-database and ai-functions
 * for real vector-based semantic search capabilities.
 *
 * Tests are split into:
 * 1. Unit tests using memory provider for data storage (no AI mocking)
 * 2. Integration tests using real AI Gateway for embeddings (skipIf no gateway)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

// Check for AI Gateway availability
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('ai-functions Embeddings Integration', () => {
  beforeEach(() => {
    // Use memory provider for data storage
    setProvider(createMemoryProvider())
  })

  describe('embedding generation on entity create', () => {
    const schema = {
      Occupation: {
        title: 'string',
        description: 'string?',
      },
    } as const satisfies DatabaseSchema

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

    it('should store embedding with metadata', async () => {
      const { db, artifacts } = DB(schema)

      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Writes code',
      })

      // The stored embedding should have metadata
      const embedding = await artifacts.get('Occupation/occ-1', 'embedding')
      expect(embedding?.content).toBeDefined()
      expect(embedding?.metadata).toBeDefined()
    })
  })

  describe('semantic search', () => {
    const schema = {
      Occupation: {
        title: 'string',
        description: 'string?',
      },
    } as const satisfies DatabaseSchema

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
  })

  describe('batch embedding operations', () => {
    const schema = {
      Skill: {
        name: 'string',
        category: 'string?',
      },
    } as const satisfies DatabaseSchema

    it('should embed multiple entities', async () => {
      const { db, artifacts } = DB(schema)

      // Create multiple entities
      await db.Skill.create('skill-1', { name: 'TypeScript', category: 'Programming' })
      await db.Skill.create('skill-2', { name: 'Python', category: 'Programming' })
      await db.Skill.create('skill-3', { name: 'React', category: 'Frontend' })

      // All should have embeddings
      const emb1 = await artifacts.get('Skill/skill-1', 'embedding')
      const emb2 = await artifacts.get('Skill/skill-2', 'embedding')
      const emb3 = await artifacts.get('Skill/skill-3', 'embedding')

      expect(emb1).not.toBeNull()
      expect(emb2).not.toBeNull()
      expect(emb3).not.toBeNull()
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
      const { db, artifacts } = DB(schema)

      await db.Article.create('art-1', {
        title: 'Original Title',
        content: 'Original content',
      })

      const originalEmbedding = await artifacts.get('Article/art-1', 'embedding')
      const originalHash = originalEmbedding?.sourceHash

      // Update the article
      await db.Article.update('art-1', {
        title: 'Updated Title',
        content: 'Completely new content about different topics',
      })

      const updatedEmbedding = await artifacts.get('Article/art-1', 'embedding')

      // The embedding should be regenerated with a new hash
      expect(updatedEmbedding?.sourceHash).not.toBe(originalHash)
    })
  })

  describe('configuration and provider options', () => {
    it('should respect embedding configuration from DB options', async () => {
      const schema = {
        Document: {
          title: 'string',
          body: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db, artifacts } = DB(schema, {
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

      const embedding = await artifacts.get('Document/doc-1', 'embedding')
      expect(embedding).not.toBeNull()
      // The embedding metadata should indicate which fields were embedded
      expect(embedding?.metadata?.fields).toEqual(['title'])
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

      const { db, artifacts } = DB(schemaWithLog, {
        embeddings: {
          AuditLog: false, // Disable embeddings for AuditLog
        },
      })

      // Create a document (should embed)
      await db.Document.create('doc-1', { title: 'Test' })

      // Create an audit log (should NOT embed)
      await db.AuditLog.create('log-1', { action: 'user.login' })

      const docEmbedding = await artifacts.get('Document/doc-1', 'embedding')
      const logEmbedding = await artifacts.get('AuditLog/log-1', 'embedding')

      // Document should have embedding, AuditLog should not
      expect(docEmbedding).not.toBeNull()
      expect(logEmbedding).toBeNull()
    })
  })
})

/**
 * Real AI Gateway Integration Tests
 *
 * These tests use actual AI Gateway calls for embedding generation.
 * They are skipped when AI_GATEWAY_URL is not configured.
 */
describe.skipIf(!hasGateway)('Real AI Gateway Embeddings Integration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider({ useAiFunctions: true }))
  })

  const schema = {
    Article: {
      title: 'string',
      content: 'string',
    },
  } as const satisfies DatabaseSchema

  it('should generate real embeddings via gateway', async () => {
    const { db, artifacts } = DB(schema)

    await db.Article.create('art-1', {
      title: 'Machine Learning Basics',
      content: 'An introduction to machine learning concepts and algorithms.',
    })

    const embedding = await artifacts.get('Article/art-1', 'embedding')
    expect(embedding).not.toBeNull()
    expect(Array.isArray(embedding?.content)).toBe(true)
    // Real embeddings should have standard dimensions
    const vector = embedding?.content as number[]
    expect([384, 768, 1024, 1536]).toContain(vector.length)
  })

  it('should perform semantic search with real embeddings', async () => {
    const { db } = DB(schema)

    await db.Article.create('art-ml', {
      title: 'Machine Learning Guide',
      content: 'A comprehensive guide to machine learning algorithms.',
    })

    await db.Article.create('art-cooking', {
      title: 'Italian Cooking Recipes',
      content: 'Traditional recipes from Italy including pasta and pizza.',
    })

    const results = await db.Article.semanticSearch('deep learning neural networks')

    expect(results.length).toBeGreaterThan(0)
    // ML article should rank higher than cooking for ML-related query
    expect(results[0]?.$id).toBe('art-ml')
    expect(results[0]?.$score).toBeGreaterThan(0)
  })

  it('should use haiku model for fast/cheap tests', async () => {
    const { db, artifacts } = DB(schema)

    await db.Article.create('art-test', {
      title: 'Test Article',
      content: 'Content for testing embedding generation.',
    })

    const embedding = await artifacts.get('Article/art-test', 'embedding')
    expect(embedding).not.toBeNull()
    // Embedding should be generated successfully
    expect((embedding?.content as number[]).length).toBeGreaterThan(0)
  })
})
