/**
 * Tests for RDB Provider Adapter
 *
 * Verifies that RDB can be used as a provider for ai-database through an adapter.
 * The key interface mismatch is:
 * - ai-database search() expects: (type: string, query: string, options?: SearchOptions)
 * - RDB search() expects: (type: string, filter: Filter, options?: SearchOptions)
 *
 * This adapter bridges the gap by:
 * 1. Converting string queries to Filter objects (text search across all fields)
 * 2. Maintaining type compatibility with ai-database's DBProvider interface
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RDBProviderAdapter } from '../src/rdb-provider-adapter.js'
import type { DBProvider } from '../src/schema/provider.js'
import type { DBProvider as RDBProvider, Filter, Entity } from '@dotdo/rdb'

// =============================================================================
// Mock RDB Provider for Testing
// =============================================================================

/**
 * Creates a mock RDB provider for testing the adapter
 */
function createMockRDBProvider(): RDBProvider & { _entities: Map<string, Map<string, Entity>> } {
  const entities = new Map<string, Map<string, Entity>>()
  const relations = new Map<string, Set<string>>()

  const getStore = (type: string): Map<string, Entity> => {
    if (!entities.has(type)) {
      entities.set(type, new Map())
    }
    return entities.get(type)!
  }

  const relationKey = (fromType: string, fromId: string, relation: string) =>
    `${fromType}:${fromId}:${relation}`

  return {
    _entities: entities,

    async get(type: string, id: string): Promise<Entity | null> {
      const store = getStore(type)
      const entity = store.get(id)
      return entity ? { ...entity, id, type } : null
    },

    async list(type: string, options?: { limit?: number; offset?: number }): Promise<Entity[]> {
      const store = getStore(type)
      let results = Array.from(store.entries()).map(([id, data]) => ({
        ...data,
        id,
        type,
      }))

      if (options?.offset) {
        results = results.slice(options.offset)
      }
      if (options?.limit) {
        results = results.slice(0, options.limit)
      }

      return results
    },

    async search(type: string, filter: Filter, options?: { limit?: number }): Promise<Entity[]> {
      const store = getStore(type)
      const results: Entity[] = []

      for (const [id, data] of store) {
        let matches = true

        for (const [key, value] of Object.entries(filter)) {
          const fieldValue = data[key]

          // Handle operator objects
          if (value && typeof value === 'object') {
            if ('$eq' in value) {
              matches = fieldValue === value.$eq
            } else if ('$ne' in value) {
              matches = fieldValue !== value.$ne
            } else if ('$regex' in value) {
              const regex = new RegExp(value.$regex as string, 'i')
              matches = regex.test(String(fieldValue ?? ''))
            } else if ('$in' in value) {
              matches = (value.$in as unknown[]).includes(fieldValue)
            }
          } else {
            // Direct value comparison
            matches = fieldValue === value
          }

          if (!matches) break
        }

        if (matches) {
          results.push({ ...data, id, type })
        }
      }

      if (options?.limit) {
        return results.slice(0, options.limit)
      }

      return results
    },

    async create(type: string, data: Record<string, unknown>, id?: string): Promise<Entity> {
      const store = getStore(type)
      const entityId = id ?? crypto.randomUUID()
      const entity = { ...data, id: entityId, type }
      store.set(entityId, entity)
      return entity
    },

    async update(type: string, id: string, data: Record<string, unknown>): Promise<Entity> {
      const store = getStore(type)
      const existing = store.get(id)
      if (!existing) {
        throw new Error(`Entity ${type}/${id} not found`)
      }
      const updated = { ...existing, ...data, id, type }
      store.set(id, updated)
      return updated
    },

    async delete(type: string, id: string): Promise<void> {
      const store = getStore(type)
      store.delete(id)
    },

    async relate(
      fromType: string,
      fromId: string,
      relation: string,
      toType: string,
      toId: string,
      _metadata?: Record<string, unknown>
    ): Promise<void> {
      const key = relationKey(fromType, fromId, relation)
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
    ): Promise<void> {
      const key = relationKey(fromType, fromId, relation)
      const targets = relations.get(key)
      if (targets) {
        targets.delete(`${toType}:${toId}`)
      }
    },

    async related(
      type: string,
      id: string,
      relation: string,
      _options?: { direction?: 'outgoing' | 'incoming' | 'both' }
    ): Promise<Entity[]> {
      const key = relationKey(type, id, relation)
      const targets = relations.get(key)

      if (!targets) return []

      const results: Entity[] = []
      for (const target of targets) {
        const [targetType, targetId] = target.split(':')
        const entity = await this.get(targetType!, targetId!)
        if (entity) {
          results.push(entity)
        }
      }

      return results
    },
  }
}

// =============================================================================
// Interface Compatibility Tests
// =============================================================================

describe('RDBProviderAdapter', () => {
  describe('interface compatibility', () => {
    it('implements ai-database DBProvider interface', () => {
      const mockRDB = createMockRDBProvider()
      const adapter = new RDBProviderAdapter(mockRDB)

      // Type check: adapter should satisfy DBProvider interface
      const provider: DBProvider = adapter

      // Verify all required methods exist
      expect(typeof provider.get).toBe('function')
      expect(typeof provider.list).toBe('function')
      expect(typeof provider.search).toBe('function')
      expect(typeof provider.create).toBe('function')
      expect(typeof provider.update).toBe('function')
      expect(typeof provider.delete).toBe('function')
      expect(typeof provider.relate).toBe('function')
      expect(typeof provider.unrelate).toBe('function')
      expect(typeof provider.related).toBe('function')
    })

    it('search() accepts string query (ai-database style)', async () => {
      const mockRDB = createMockRDBProvider()
      const adapter = new RDBProviderAdapter(mockRDB)

      // Create test data
      await adapter.create('Post', 'post1', {
        title: 'Introduction to TypeScript',
        content: 'TypeScript is a typed superset of JavaScript',
      })

      // ai-database style search with string query
      const results = await adapter.search('Post', 'TypeScript')

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('Introduction to TypeScript')
    })
  })

  describe('CRUD operations', () => {
    let adapter: RDBProviderAdapter
    let mockRDB: ReturnType<typeof createMockRDBProvider>

    beforeEach(() => {
      mockRDB = createMockRDBProvider()
      adapter = new RDBProviderAdapter(mockRDB)
    })

    describe('create', () => {
      it('creates entity with generated ID', async () => {
        const result = await adapter.create('User', undefined, {
          name: 'John Doe',
          email: 'john@example.com',
        })

        expect(result.$id).toBeDefined()
        expect(result.$type).toBe('User')
        expect(result.name).toBe('John Doe')
      })

      it('creates entity with provided ID', async () => {
        const result = await adapter.create('User', 'john', { name: 'John' })

        expect(result.$id).toBe('john')
        expect(result.$type).toBe('User')
      })
    })

    describe('get', () => {
      it('retrieves existing entity', async () => {
        await adapter.create('User', 'john', { name: 'John' })

        const result = await adapter.get('User', 'john')

        expect(result).not.toBeNull()
        expect(result?.$id).toBe('john')
        expect(result?.name).toBe('John')
      })

      it('returns null for non-existent entity', async () => {
        const result = await adapter.get('User', 'nonexistent')
        expect(result).toBeNull()
      })
    })

    describe('update', () => {
      it('updates existing entity', async () => {
        await adapter.create('User', 'john', { name: 'John', age: 30 })

        const result = await adapter.update('User', 'john', { age: 31 })

        expect(result.age).toBe(31)
        expect(result.name).toBe('John') // Preserved
      })
    })

    describe('delete', () => {
      it('deletes existing entity', async () => {
        await adapter.create('User', 'john', { name: 'John' })

        const result = await adapter.delete('User', 'john')

        expect(result).toBe(true)
        expect(await adapter.get('User', 'john')).toBeNull()
      })

      it('returns false for non-existent entity', async () => {
        const result = await adapter.delete('User', 'nonexistent')
        // Adapter should gracefully handle non-existent entities
        expect(result).toBe(false)
      })
    })

    describe('list', () => {
      beforeEach(async () => {
        await adapter.create('User', 'john', { name: 'John', age: 30 })
        await adapter.create('User', 'jane', { name: 'Jane', age: 25 })
        await adapter.create('User', 'bob', { name: 'Bob', age: 35 })
      })

      it('lists all entities of a type', async () => {
        const results = await adapter.list('User')

        expect(results).toHaveLength(3)
        expect(results.map((r) => r.$id)).toContain('john')
        expect(results.map((r) => r.$id)).toContain('jane')
        expect(results.map((r) => r.$id)).toContain('bob')
      })

      it('supports limit option', async () => {
        const results = await adapter.list('User', { limit: 2 })
        expect(results).toHaveLength(2)
      })

      it('supports offset option', async () => {
        const results = await adapter.list('User', { offset: 1 })
        expect(results).toHaveLength(2)
      })
    })
  })

  describe('search() - string to Filter conversion', () => {
    let adapter: RDBProviderAdapter

    beforeEach(async () => {
      const mockRDB = createMockRDBProvider()
      adapter = new RDBProviderAdapter(mockRDB)

      // Create test data
      await adapter.create('Post', 'post1', {
        title: 'Introduction to TypeScript',
        content: 'TypeScript is a typed superset of JavaScript',
        tags: ['typescript', 'javascript'],
      })
      await adapter.create('Post', 'post2', {
        title: 'Advanced JavaScript Patterns',
        content: 'Learn advanced patterns in JavaScript',
        tags: ['javascript', 'patterns'],
      })
      await adapter.create('Post', 'post3', {
        title: 'Python for Beginners',
        content: 'Getting started with Python programming',
        tags: ['python', 'beginner'],
      })
    })

    it('converts string query to regex Filter for text search', async () => {
      const results = await adapter.search('Post', 'TypeScript')

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('Introduction to TypeScript')
    })

    it('searches case-insensitively', async () => {
      const results = await adapter.search('Post', 'javascript')

      expect(results.length).toBeGreaterThan(0)
      expect(results.map((r) => r.title)).toContain('Advanced JavaScript Patterns')
    })

    it('searches across multiple text fields', async () => {
      // Should find posts where query appears in title OR content
      const results = await adapter.search('Post', 'superset')

      expect(results).toHaveLength(1)
      expect(results[0]?.$id).toBe('post1')
    })

    it('respects search options like limit', async () => {
      const results = await adapter.search('Post', 'JavaScript', { limit: 1 })

      expect(results).toHaveLength(1)
    })

    it('supports fields option to restrict search scope', async () => {
      const results = await adapter.search('Post', 'JavaScript', {
        fields: ['title'],
      })

      // Should only find "Advanced JavaScript Patterns" (title contains JavaScript)
      // Not "Introduction to TypeScript" (only content mentions JavaScript)
      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('Advanced JavaScript Patterns')
    })

    it('returns empty array for no matches', async () => {
      const results = await adapter.search('Post', 'nonexistent')
      expect(results).toEqual([])
    })
  })

  describe('relationships', () => {
    let adapter: RDBProviderAdapter

    beforeEach(async () => {
      const mockRDB = createMockRDBProvider()
      adapter = new RDBProviderAdapter(mockRDB)

      await adapter.create('User', 'john', { name: 'John' })
      await adapter.create('Post', 'post1', { title: 'Hello' })
      await adapter.create('Post', 'post2', { title: 'World' })
    })

    it('creates relationships', async () => {
      await adapter.relate('User', 'john', 'posts', 'Post', 'post1')

      const related = await adapter.related('User', 'john', 'posts')
      expect(related).toHaveLength(1)
      expect(related[0]?.$id).toBe('post1')
    })

    it('creates multiple relationships', async () => {
      await adapter.relate('User', 'john', 'posts', 'Post', 'post1')
      await adapter.relate('User', 'john', 'posts', 'Post', 'post2')

      const related = await adapter.related('User', 'john', 'posts')
      expect(related).toHaveLength(2)
    })

    it('removes relationships', async () => {
      await adapter.relate('User', 'john', 'posts', 'Post', 'post1')
      await adapter.relate('User', 'john', 'posts', 'Post', 'post2')

      await adapter.unrelate('User', 'john', 'posts', 'Post', 'post1')

      const related = await adapter.related('User', 'john', 'posts')
      expect(related).toHaveLength(1)
      expect(related[0]?.$id).toBe('post2')
    })

    it('passes metadata to RDB relate()', async () => {
      // ai-database passes matchMode and similarity metadata
      await adapter.relate('User', 'john', 'posts', 'Post', 'post1', {
        matchMode: 'fuzzy',
        similarity: 0.85,
      })

      // Relationship should still be created
      const related = await adapter.related('User', 'john', 'posts')
      expect(related).toHaveLength(1)
    })
  })

  describe('entity ID/type normalization', () => {
    let adapter: RDBProviderAdapter

    beforeEach(() => {
      const mockRDB = createMockRDBProvider()
      adapter = new RDBProviderAdapter(mockRDB)
    })

    it('normalizes RDB id/type to ai-database $id/$type', async () => {
      const result = await adapter.create('User', 'john', { name: 'John' })

      // ai-database expects $id and $type prefixes
      expect(result.$id).toBe('john')
      expect(result.$type).toBe('User')

      // Should not have unprefixed id/type at top level
      // (they may exist but $id/$type should be canonical)
    })

    it('normalizes entities from list()', async () => {
      await adapter.create('User', 'john', { name: 'John' })

      const results = await adapter.list('User')

      expect(results[0]?.$id).toBe('john')
      expect(results[0]?.$type).toBe('User')
    })

    it('normalizes entities from search()', async () => {
      await adapter.create('User', 'john', { name: 'John' })

      const results = await adapter.search('User', 'John')

      expect(results[0]?.$id).toBe('john')
      expect(results[0]?.$type).toBe('User')
    })

    it('normalizes entities from related()', async () => {
      await adapter.create('User', 'john', { name: 'John' })
      await adapter.create('Post', 'post1', { title: 'Hello' })
      await adapter.relate('User', 'john', 'posts', 'Post', 'post1')

      const results = await adapter.related('User', 'john', 'posts')

      expect(results[0]?.$id).toBe('post1')
      expect(results[0]?.$type).toBe('Post')
    })
  })
})

// =============================================================================
// Type-level Interface Compatibility Tests
// =============================================================================

describe('Type-level interface compatibility', () => {
  it('RDBProviderAdapter satisfies DBProvider at compile time', () => {
    // This test verifies compile-time type compatibility
    // If it compiles, the types are compatible

    const mockRDB = createMockRDBProvider()
    const adapter = new RDBProviderAdapter(mockRDB)

    // Explicit type annotation - this line would fail to compile
    // if RDBProviderAdapter doesn't satisfy DBProvider
    const _provider: DBProvider = adapter

    // Verify we can use it where DBProvider is expected
    function acceptsDBProvider(_p: DBProvider): void {
      // noop
    }
    acceptsDBProvider(adapter)

    expect(true).toBe(true) // Test passes if we get here
  })
})
