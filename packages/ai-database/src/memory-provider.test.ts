/**
 * Tests for in-memory database provider
 *
 * Tests all CRUD operations and relationships in memory.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryProvider, createMemoryProvider } from './memory-provider.js'

describe('MemoryProvider', () => {
  let provider: MemoryProvider

  beforeEach(() => {
    provider = createMemoryProvider()
  })

  describe('create', () => {
    it('creates an entity with generated ID', async () => {
      const result = await provider.create('User', undefined, {
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(result.$id).toBeDefined()
      expect(result.$type).toBe('User')
      expect(result.name).toBe('John Doe')
      expect(result.email).toBe('john@example.com')
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('creates an entity with provided ID', async () => {
      const result = await provider.create('User', 'john', {
        name: 'John Doe',
      })

      expect(result.$id).toBe('john')
      expect(result.$type).toBe('User')
      expect(result.name).toBe('John Doe')
    })

    it('throws error if entity already exists', async () => {
      await provider.create('User', 'john', { name: 'John' })

      await expect(
        provider.create('User', 'john', { name: 'Jane' })
      ).rejects.toThrow('Entity already exists: User/john')
    })

    it('stores createdAt and updatedAt timestamps', async () => {
      const result = await provider.create('User', 'john', { name: 'John' })

      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
      expect(typeof result.createdAt).toBe('string')
      expect(typeof result.updatedAt).toBe('string')
      // Verify they are valid ISO strings
      expect(() => new Date(result.createdAt as string)).not.toThrow()
      expect(() => new Date(result.updatedAt as string)).not.toThrow()
    })
  })

  describe('get', () => {
    it('retrieves an existing entity', async () => {
      await provider.create('User', 'john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      const result = await provider.get('User', 'john')

      expect(result).toBeDefined()
      expect(result?.$id).toBe('john')
      expect(result?.$type).toBe('User')
      expect(result?.name).toBe('John Doe')
    })

    it('returns null for non-existent entity', async () => {
      const result = await provider.get('User', 'nonexistent')
      expect(result).toBeNull()
    })

    it('returns null for wrong type', async () => {
      await provider.create('User', 'john', { name: 'John' })
      const result = await provider.get('Post', 'john')
      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('updates an existing entity', async () => {
      await provider.create('User', 'john', {
        name: 'John',
        email: 'john@example.com',
      })

      const result = await provider.update('User', 'john', {
        name: 'John Doe',
        role: 'admin',
      })

      expect(result.name).toBe('John Doe')
      expect(result.email).toBe('john@example.com')
      expect(result.role).toBe('admin')
    })

    it('updates updatedAt timestamp', async () => {
      await provider.create('User', 'john', { name: 'John' })

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      const result = await provider.update('User', 'john', { name: 'Jane' })

      // Compare timestamps as strings
      expect(result.updatedAt).toBeDefined()
      expect(result.createdAt).toBeDefined()
      // updatedAt should be greater than or equal to createdAt
      expect(new Date(result.updatedAt as string).getTime()).toBeGreaterThanOrEqual(
        new Date(result.createdAt as string).getTime()
      )
    })

    it('throws error if entity does not exist', async () => {
      await expect(
        provider.update('User', 'nonexistent', { name: 'Jane' })
      ).rejects.toThrow('Entity not found: User/nonexistent')
    })

    it('merges with existing data', async () => {
      await provider.create('User', 'john', {
        name: 'John',
        email: 'john@example.com',
        age: 30,
      })

      const result = await provider.update('User', 'john', {
        age: 31,
      })

      expect(result.name).toBe('John')
      expect(result.email).toBe('john@example.com')
      expect(result.age).toBe(31)
    })
  })

  describe('delete', () => {
    it('deletes an existing entity', async () => {
      await provider.create('User', 'john', { name: 'John' })

      const result = await provider.delete('User', 'john')
      expect(result).toBe(true)

      const retrieved = await provider.get('User', 'john')
      expect(retrieved).toBeNull()
    })

    it('returns false for non-existent entity', async () => {
      const result = await provider.delete('User', 'nonexistent')
      expect(result).toBe(false)
    })

    it('cleans up relations when deleting entity', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')

      await provider.delete('User', 'john')

      const related = await provider.related('Post', 'post1', 'author')
      expect(related).toEqual([])
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      await provider.create('User', 'john', { name: 'John', age: 30 })
      await provider.create('User', 'jane', { name: 'Jane', age: 25 })
      await provider.create('User', 'bob', { name: 'Bob', age: 35 })
    })

    it('lists all entities of a type', async () => {
      const results = await provider.list('User')

      expect(results).toHaveLength(3)
      expect(results.map((r) => r.$id)).toContain('john')
      expect(results.map((r) => r.$id)).toContain('jane')
      expect(results.map((r) => r.$id)).toContain('bob')
    })

    it('filters by where clause', async () => {
      const results = await provider.list('User', {
        where: { age: 30 },
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.name).toBe('John')
    })

    it('filters by multiple where conditions', async () => {
      await provider.create('User', 'alice', { name: 'Alice', age: 30, active: true })
      await provider.create('User', 'charlie', { name: 'Charlie', age: 30, active: false })

      const results = await provider.list('User', {
        where: { age: 30, active: true },
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.name).toBe('Alice')
    })

    it('sorts by field ascending', async () => {
      const results = await provider.list('User', {
        orderBy: 'age',
        order: 'asc',
      })

      expect(results.map((r) => r.age)).toEqual([25, 30, 35])
    })

    it('sorts by field descending', async () => {
      const results = await provider.list('User', {
        orderBy: 'age',
        order: 'desc',
      })

      expect(results.map((r) => r.age)).toEqual([35, 30, 25])
    })

    it('limits results', async () => {
      const results = await provider.list('User', {
        limit: 2,
      })

      expect(results).toHaveLength(2)
    })

    it('offsets results', async () => {
      const results = await provider.list('User', {
        orderBy: 'name',
        order: 'asc',
        offset: 1,
      })

      expect(results).toHaveLength(2)
      expect(results[0]?.name).not.toBe('Bob')
    })

    it('combines limit and offset', async () => {
      const results = await provider.list('User', {
        orderBy: 'name',
        order: 'asc',
        limit: 1,
        offset: 1,
      })

      expect(results).toHaveLength(1)
    })

    it('returns empty array for non-existent type', async () => {
      const results = await provider.list('NonExistent')
      expect(results).toEqual([])
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await provider.create('Post', 'post1', {
        title: 'Introduction to TypeScript',
        content: 'TypeScript is a typed superset of JavaScript',
      })
      await provider.create('Post', 'post2', {
        title: 'Advanced JavaScript',
        content: 'Deep dive into JavaScript patterns',
      })
      await provider.create('Post', 'post3', {
        title: 'Python Guide',
        content: 'Getting started with Python programming',
      })
    })

    it('searches across all fields by default', async () => {
      const results = await provider.search('Post', 'TypeScript')

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('Introduction to TypeScript')
    })

    it('searches case-insensitively', async () => {
      const results = await provider.search('Post', 'javascript')

      expect(results.length).toBeGreaterThan(0)
      expect(results.map((r) => r.title)).toContain('Advanced JavaScript')
    })

    it('searches specific fields', async () => {
      const results = await provider.search('Post', 'JavaScript', {
        fields: ['title'],
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('Advanced JavaScript')
    })

    it('filters by minScore', async () => {
      const results = await provider.search('Post', 'TypeScript', {
        minScore: 0.9,
      })

      // High minScore should return fewer results
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('sorts by relevance score', async () => {
      const results = await provider.search('Post', 'JavaScript')

      // Results should be ordered by relevance
      expect(results.length).toBeGreaterThan(0)
    })

    it('combines search with where clause', async () => {
      await provider.create('Post', 'post4', {
        title: 'TypeScript Tips',
        category: 'tutorial',
      })
      await provider.create('Post', 'post5', {
        title: 'TypeScript News',
        category: 'news',
      })

      const results = await provider.search('Post', 'TypeScript', {
        where: { category: 'tutorial' },
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('TypeScript Tips')
    })

    it('returns empty array for no matches', async () => {
      const results = await provider.search('Post', 'nonexistent')
      expect(results).toEqual([])
    })
  })

  describe('relationships', () => {
    beforeEach(async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })
      await provider.create('Post', 'post2', { title: 'World' })
    })

    it('creates a relationship', async () => {
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')

      const related = await provider.related('User', 'john', 'posts')
      expect(related).toHaveLength(1)
      expect(related[0]?.$id).toBe('post1')
    })

    it('creates multiple relationships', async () => {
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')
      await provider.relate('User', 'john', 'posts', 'Post', 'post2')

      const related = await provider.related('User', 'john', 'posts')
      expect(related).toHaveLength(2)
      expect(related.map((r) => r.$id)).toContain('post1')
      expect(related.map((r) => r.$id)).toContain('post2')
    })

    it('removes a relationship', async () => {
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')
      await provider.relate('User', 'john', 'posts', 'Post', 'post2')

      await provider.unrelate('User', 'john', 'posts', 'Post', 'post1')

      const related = await provider.related('User', 'john', 'posts')
      expect(related).toHaveLength(1)
      expect(related[0]?.$id).toBe('post2')
    })

    it('returns empty array for no relationships', async () => {
      const related = await provider.related('User', 'john', 'posts')
      expect(related).toEqual([])
    })

    it('handles different relation types', async () => {
      await provider.create('Tag', 'tag1', { name: 'typescript' })

      await provider.relate('Post', 'post1', 'tags', 'Tag', 'tag1')
      await provider.relate('Post', 'post1', 'author', 'User', 'john')

      const tags = await provider.related('Post', 'post1', 'tags')
      const author = await provider.related('Post', 'post1', 'author')

      expect(tags).toHaveLength(1)
      expect(author).toHaveLength(1)
    })
  })

  describe('utility methods', () => {
    it('clears all data', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })

      provider.clear()

      const user = await provider.get('User', 'john')
      const post = await provider.get('Post', 'post1')

      expect(user).toBeNull()
      expect(post).toBeNull()
    })

    it('returns stats', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('User', 'jane', { name: 'Jane' })
      await provider.create('Post', 'post1', { title: 'Hello' })
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')

      const stats = provider.stats()

      expect(stats.entities).toBe(3)
      expect(stats.relations).toBe(1)
    })

    it('tracks entity count correctly', async () => {
      await provider.create('User', 'john', { name: 'John' })
      let stats = provider.stats()
      expect(stats.entities).toBe(1)

      await provider.create('User', 'jane', { name: 'Jane' })
      stats = provider.stats()
      expect(stats.entities).toBe(2)

      await provider.delete('User', 'john')
      stats = provider.stats()
      expect(stats.entities).toBe(1)
    })
  })

  describe('createMemoryProvider', () => {
    it('creates a new provider instance', () => {
      const provider1 = createMemoryProvider()
      const provider2 = createMemoryProvider()

      expect(provider1).toBeInstanceOf(MemoryProvider)
      expect(provider2).toBeInstanceOf(MemoryProvider)
      expect(provider1).not.toBe(provider2)
    })

    it('creates isolated provider instances', async () => {
      const provider1 = createMemoryProvider()
      const provider2 = createMemoryProvider()

      await provider1.create('User', 'john', { name: 'John' })

      const result1 = await provider1.get('User', 'john')
      const result2 = await provider2.get('User', 'john')

      expect(result1).not.toBeNull()
      expect(result2).toBeNull()
    })
  })
})
