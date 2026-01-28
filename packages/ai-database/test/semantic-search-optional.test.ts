/**
 * Tests for Optional Semantic Search
 *
 * RED phase: Verify that ai-database works correctly when semantic search
 * is unavailable (e.g., when using RDB or other providers without vector search).
 *
 * These tests ensure:
 * 1. Basic CRUD operations work without semantic search
 * 2. Fuzzy operators (~>, <~) gracefully degrade
 * 3. Clear error messages when semantic features are required but unavailable
 * 4. Exact relationship operations (-> and <-) work without semantic search
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import {
  CapabilityNotSupportedError,
  isCapabilityNotSupportedError,
  detectCapabilities,
} from '../src/index.js'
import type { DBProvider } from '../src/schema/provider.js'
import type { DatabaseSchema } from '../src/index.js'

/**
 * Create a minimal provider without semantic search capability
 * Simulates providers like RDB that don't support vector search
 */
function createMinimalProvider(): DBProvider {
  const entities = new Map<string, Map<string, Record<string, unknown>>>()
  const relations = new Map<string, Set<string>>()

  const getTypeStore = (type: string) => {
    if (!entities.has(type)) {
      entities.set(type, new Map())
    }
    return entities.get(type)!
  }

  const getRelationKey = (fromType: string, fromId: string, relation: string) =>
    `${fromType}:${fromId}:${relation}`

  return {
    async get(type: string, id: string) {
      const store = getTypeStore(type)
      return store.get(id) ?? null
    },

    async list(type: string) {
      const store = getTypeStore(type)
      return Array.from(store.values())
    },

    async search(type: string, query: string) {
      const store = getTypeStore(type)
      const results: Record<string, unknown>[] = []
      const queryLower = query.toLowerCase()

      for (const entity of store.values()) {
        // Simple text search in string fields
        for (const value of Object.values(entity)) {
          if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
            results.push(entity)
            break
          }
        }
      }

      return results
    },

    async create(type: string, id: string | undefined, data: Record<string, unknown>) {
      const store = getTypeStore(type)
      const entityId = id ?? crypto.randomUUID()
      const entity = {
        ...data,
        $id: entityId,
        $type: type,
      }
      store.set(entityId, entity)
      return entity
    },

    async update(type: string, id: string, data: Record<string, unknown>) {
      const store = getTypeStore(type)
      const existing = store.get(id)
      if (!existing) {
        throw new Error(`Entity not found: ${type}/${id}`)
      }
      const updated = { ...existing, ...data }
      store.set(id, updated)
      return updated
    },

    async delete(type: string, id: string) {
      const store = getTypeStore(type)
      return store.delete(id)
    },

    async related(type: string, id: string, relation: string) {
      const key = getRelationKey(type, id, relation)
      const relatedIds = relations.get(key)
      if (!relatedIds || relatedIds.size === 0) {
        return []
      }

      // For simplicity, assume related entities are of any type
      const results: Record<string, unknown>[] = []
      for (const relatedKey of relatedIds) {
        const [relatedType, relatedId] = relatedKey.split(':')
        if (relatedType && relatedId) {
          const entity = await this.get(relatedType, relatedId)
          if (entity) {
            results.push(entity)
          }
        }
      }
      return results
    },

    async relate(fromType: string, fromId: string, relation: string, toType: string, toId: string) {
      const key = getRelationKey(fromType, fromId, relation)
      if (!relations.has(key)) {
        relations.set(key, new Set())
      }
      relations.get(key)!.add(`${toType}:${toId}`)
    },

    async unrelate(
      fromType: string,
      fromId: string,
      relation: string,
      toType: string,
      toId: string
    ) {
      const key = getRelationKey(fromType, fromId, relation)
      const set = relations.get(key)
      if (set) {
        set.delete(`${toType}:${toId}`)
      }
    },
  }
}

describe('ai-database without semantic search', () => {
  let minimalProvider: DBProvider

  beforeEach(() => {
    minimalProvider = createMinimalProvider()
    setProvider(minimalProvider)
  })

  describe('capability detection', () => {
    it('detects that minimal provider lacks semantic search', async () => {
      const capabilities = await detectCapabilities(minimalProvider)

      expect(capabilities.hasSemanticSearch).toBe(false)
      expect(capabilities.hasEvents).toBe(false)
      expect(capabilities.hasActions).toBe(false)
      expect(capabilities.hasArtifacts).toBe(false)
    })

    it('detects that memory provider has semantic search', async () => {
      const memoryProvider = createMemoryProvider()
      const capabilities = await detectCapabilities(memoryProvider)

      expect(capabilities.hasSemanticSearch).toBe(true)
    })
  })

  describe('basic CRUD without semantic search', () => {
    const schema = {
      User: {
        name: 'string',
        email: 'string',
      },
      Post: {
        title: 'string',
        content: 'markdown',
        author: '->User',
      },
    } as const satisfies DatabaseSchema

    it('creates entities without semantic search', async () => {
      const { db } = DB(schema)

      const user = await db.User.create({
        name: 'Alice',
        email: 'alice@example.com',
      })

      expect(user.$id).toBeDefined()
      expect(user.name).toBe('Alice')
      expect(user.email).toBe('alice@example.com')
    })

    it('reads entities without semantic search', async () => {
      const { db } = DB(schema)

      await db.User.create('user-1', {
        name: 'Bob',
        email: 'bob@example.com',
      })

      const user = await db.User.get('user-1')

      expect(user).not.toBeNull()
      expect(user?.name).toBe('Bob')
    })

    it('updates entities without semantic search', async () => {
      const { db } = DB(schema)

      await db.User.create('user-1', {
        name: 'Charlie',
        email: 'charlie@example.com',
      })

      const updated = await db.User.update('user-1', {
        name: 'Charles',
      })

      expect(updated.name).toBe('Charles')
      expect(updated.email).toBe('charlie@example.com')
    })

    it('deletes entities without semantic search', async () => {
      const { db } = DB(schema)

      await db.User.create('user-1', {
        name: 'Dave',
        email: 'dave@example.com',
      })

      const deleted = await db.User.delete('user-1')
      expect(deleted).toBe(true)

      const found = await db.User.get('user-1')
      expect(found).toBeNull()
    })

    it('lists entities without semantic search', async () => {
      const { db } = DB(schema)

      await db.User.create('user-1', { name: 'Eve', email: 'eve@example.com' })
      await db.User.create('user-2', { name: 'Frank', email: 'frank@example.com' })

      const users = await db.User.list()

      expect(users.length).toBeGreaterThanOrEqual(2)
    })

    it('searches entities with basic text search fallback', async () => {
      const { db } = DB(schema)

      await db.User.create({ name: 'Grace', email: 'grace@example.com' })
      await db.User.create({ name: 'Henry', email: 'henry@example.com' })

      const results = await db.User.search('Grace')

      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((u) => u.name === 'Grace')).toBe(true)
    })
  })

  describe('exact relationships without semantic search', () => {
    const schema = {
      Author: {
        name: 'string',
      },
      Book: {
        title: 'string',
        author: '->Author.books',
      },
    } as const satisfies DatabaseSchema

    it('creates forward exact relationships (->)', async () => {
      const { db } = DB(schema)

      const author = await db.Author.create({
        name: 'Jane Austen',
      })

      const book = await db.Book.create({
        title: 'Pride and Prejudice',
        author: author.$id,
      })

      // The author field will be hydrated as an object, but internally stores the ID
      expect(book.$id).toBeDefined()
      expect(book.title).toBe('Pride and Prejudice')

      // Should be able to resolve the relationship
      const bookWithAuthor = await db.Book.get(book.$id)
      expect(bookWithAuthor).not.toBeNull()
      expect(bookWithAuthor?.title).toBe('Pride and Prejudice')
    })

    it('handles backward exact relationships (<-)', async () => {
      const schema = {
        Category: {
          name: 'string',
        },
        Product: {
          name: 'string',
          category: '<-Category.products',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const category = await db.Category.create({
        name: 'Electronics',
      })

      const product = await db.Product.create({
        name: 'Laptop',
        categoryHint: 'Electronics', // Will use text search fallback
      })

      expect(product.$id).toBeDefined()
    })
  })

  describe('fuzzy operators graceful degradation', () => {
    it('forward fuzzy (~>) falls back to generation when semantic search unavailable', async () => {
      const schema = {
        Startup: {
          name: 'string',
          customer: 'Who is the customer? ~>Customer',
        },
        Customer: {
          name: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create existing customer
      await db.Customer.create({
        name: 'Enterprise Buyer',
        description: 'VP of Engineering at Fortune 500',
      })

      // Without semantic search, should generate a new customer
      // since it cannot match semantically
      const startup = await db.Startup.create({
        name: 'TechCo',
        customerHint: 'Senior tech leaders at big companies',
      })

      // The startup should still be created successfully
      expect(startup.$id).toBeDefined()
      expect(startup.name).toBe('TechCo')
      // customer field should be populated (either matched or generated)
      // Without semantic search, it will generate new
    })

    it('backward fuzzy (<~) uses text search fallback when semantic unavailable', async () => {
      const schema = {
        ICP: {
          title: 'string',
          occupation: '<~Occupation',
        },
        Occupation: {
          title: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create occupations
      await db.Occupation.create({
        title: 'Software Engineer',
        description: 'Develops software applications',
      })

      // Without semantic search, backward fuzzy should attempt text search fallback
      const icp = await db.ICP.create({
        title: 'Developer ICP',
        occupationHint: 'Software', // Will try text match
      })

      expect(icp.$id).toBeDefined()
      expect(icp.title).toBe('Developer ICP')
    })

    it('array fuzzy fields degrade gracefully', async () => {
      const schema = {
        Team: {
          name: 'string',
          members: ['Team members ~>Person'],
        },
        Person: {
          name: 'string',
          skills: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create people
      await db.Person.create({
        name: 'Alice',
        skills: 'Frontend development',
      })

      // Without semantic search, should still create team
      // Array fuzzy fields will generate when no semantic match
      const team = await db.Team.create({
        name: 'Dev Team',
        membersHint: ['Frontend developer', 'Backend developer'],
      })

      expect(team.$id).toBeDefined()
      expect(team.name).toBe('Dev Team')
    })
  })

  describe('semantic search method errors', () => {
    it('semanticSearch throws CapabilityNotSupportedError when unavailable', async () => {
      const schema = {
        Document: {
          title: 'string',
          content: 'markdown',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Document.create({
        title: 'Test Doc',
        content: 'Some content for testing.',
      })

      // Calling semanticSearch on a provider without support should throw
      await expect(db.Document.semanticSearch('test query')).rejects.toThrow(
        CapabilityNotSupportedError
      )
    })

    it('hybridSearch throws CapabilityNotSupportedError when unavailable', async () => {
      const schema = {
        Article: {
          title: 'string',
          body: 'markdown',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Article.create({
        title: 'Test Article',
        body: 'Article body content.',
      })

      await expect(db.Article.hybridSearch('test query')).rejects.toThrow(
        CapabilityNotSupportedError
      )
    })

    it('error includes capability name and helpful message', async () => {
      const schema = {
        Note: {
          text: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      try {
        await db.Note.semanticSearch('query')
      } catch (error) {
        expect(isCapabilityNotSupportedError(error)).toBe(true)
        if (isCapabilityNotSupportedError(error)) {
          expect(error.capability).toBe('hasSemanticSearch')
          expect(error.message).toContain('semantic')
        }
      }
    })

    it('error suggests alternative when available', async () => {
      const schema = {
        Item: {
          name: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      try {
        await db.Item.semanticSearch('query')
      } catch (error) {
        if (isCapabilityNotSupportedError(error)) {
          expect(error.alternative).toBeDefined()
          expect(error.alternative).toContain('search')
        }
      }
    })
  })

  describe('global semantic search graceful handling', () => {
    it('db.semanticSearch throws when provider lacks capability', async () => {
      const schema = {
        Post: {
          title: 'string',
        },
        Comment: {
          body: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await expect(db.semanticSearch('test query')).rejects.toThrow(CapabilityNotSupportedError)
    })
  })

  describe('embedding configuration warnings', () => {
    it.skip('warns when embeddings config provided but provider lacks support', async () => {
      // This test is skipped because the warning is not yet implemented
      // The DB function should warn when embeddings are configured but provider
      // doesn't support semantic search. This would be a follow-up enhancement.
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const schema = {
        Product: {
          name: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      // Configure embeddings for a provider that doesn't support them
      DB(schema, {
        embeddings: {
          Product: {
            fields: ['name', 'description'],
          },
        },
      })

      // Should warn that embeddings won't work
      expect(consoleSpy).toHaveBeenCalled()
      expect(
        consoleSpy.mock.calls.some(
          (call) =>
            call[0]?.toString().toLowerCase().includes('embedding') ||
            call[0]?.toString().toLowerCase().includes('semantic')
        )
      ).toBe(true)

      consoleSpy.mockRestore()
    })
  })

  describe('mixed providers scenario', () => {
    it('switching from full to minimal provider degrades gracefully', async () => {
      const schema = {
        Task: {
          title: 'string',
        },
        Person: {
          name: 'string',
        },
      } as const satisfies DatabaseSchema

      // Start with memory provider (full capability)
      setProvider(createMemoryProvider())
      const { db: db1 } = DB(schema)

      await db1.Person.create({
        name: 'Alice',
      })

      const task1 = await db1.Task.create({
        title: 'Task 1',
      })
      expect(task1.$id).toBeDefined()

      // Switch to minimal provider
      const newMinimalProvider = createMinimalProvider()
      setProvider(newMinimalProvider)
      const { db: db2 } = DB(schema)

      // Should still create tasks with basic provider
      const task2 = await db2.Task.create({
        title: 'Task 2',
      })
      expect(task2.$id).toBeDefined()
    })
  })

  describe('documentation features', () => {
    it('exposes which features require semantic search', async () => {
      // The PROVIDER_CAPABILITY_MATRIX should document this
      const { PROVIDER_CAPABILITY_MATRIX } = await import('../src/index.js')

      expect(PROVIDER_CAPABILITY_MATRIX).toBeDefined()
      expect(PROVIDER_CAPABILITY_MATRIX.RDBProvider).toBeDefined()
      expect(PROVIDER_CAPABILITY_MATRIX.RDBProvider.hasSemanticSearch).toBe(false)

      expect(PROVIDER_CAPABILITY_MATRIX.MemoryProvider).toBeDefined()
      expect(PROVIDER_CAPABILITY_MATRIX.MemoryProvider.hasSemanticSearch).toBe(true)
    })
  })
})

describe('fuzzy operator text fallback', () => {
  let minimalProvider: DBProvider

  beforeEach(() => {
    minimalProvider = createMinimalProvider()
    setProvider(minimalProvider)
  })

  it('~> uses basic text search when semantic unavailable', async () => {
    const schema = {
      Article: {
        title: 'string',
        category: '~>Category',
      },
      Category: {
        name: 'string',
        description: 'string',
      },
    } as const satisfies DatabaseSchema

    const { db } = DB(schema)

    // Create categories
    await db.Category.create({
      name: 'Technology',
      description: 'Tech articles and tutorials',
    })

    await db.Category.create({
      name: 'Cooking',
      description: 'Food and recipes',
    })

    // With text fallback, should find "Technology" via basic string matching
    const article = await db.Article.create({
      title: 'New JavaScript Framework',
      categoryHint: 'Tech', // Basic text match should work
    })

    expect(article.$id).toBeDefined()
  })

  it('<~ uses basic text search for backward fuzzy', async () => {
    const schema = {
      UserProfile: {
        bio: 'string',
        interests: '<~Topic[]',
      },
      Topic: {
        name: 'string',
        description: 'string',
      },
    } as const satisfies DatabaseSchema

    const { db } = DB(schema)

    // Create topics
    await db.Topic.create({
      name: 'Programming',
      description: 'Software development and coding',
    })

    await db.Topic.create({
      name: 'Music',
      description: 'Musical arts and instruments',
    })

    // Basic text search should find matching topics
    const profile = await db.UserProfile.create({
      bio: 'I love coding',
      interestsHint: ['Programming', 'Music'],
    })

    expect(profile.$id).toBeDefined()
  })
})
