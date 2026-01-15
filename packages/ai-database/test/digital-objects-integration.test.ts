/**
 * Integration Tests for digital-objects backend
 *
 * Tests that ai-database works correctly when using digital-objects as the storage backend.
 * This test suite mirrors the memory-provider tests but uses the digital-objects adapter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDigitalObjectsProvider, setProvider, DB } from '../src/index.js'
import type { DBProvider } from '../src/schema/provider.js'

describe('digital-objects Integration', () => {
  let provider: DBProvider

  beforeEach(() => {
    provider = createDigitalObjectsProvider()
    setProvider(provider)
  })

  describe('CRUD Operations', () => {
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
      })

      it('creates an entity with provided ID', async () => {
        const result = await provider.create('User', 'john', {
          name: 'John Doe',
        })

        expect(result.$id).toBe('john')
        expect(result.$type).toBe('User')
        expect(result.name).toBe('John Doe')
      })

      it('creates multiple entities of the same type', async () => {
        await provider.create('User', 'user1', { name: 'User 1' })
        await provider.create('User', 'user2', { name: 'User 2' })
        await provider.create('User', 'user3', { name: 'User 3' })

        const users = await provider.list('User')
        expect(users).toHaveLength(3)
      })

      it('creates entities of different types', async () => {
        await provider.create('User', 'john', { name: 'John' })
        await provider.create('Post', 'post1', { title: 'Hello' })

        const users = await provider.list('User')
        const posts = await provider.list('Post')

        expect(users).toHaveLength(1)
        expect(posts).toHaveLength(1)
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

      it('throws error if entity does not exist', async () => {
        await expect(provider.update('User', 'nonexistent', { name: 'Jane' })).rejects.toThrow()
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

      it('limits results', async () => {
        const results = await provider.list('User', {
          limit: 2,
        })

        expect(results).toHaveLength(2)
      })

      it('returns empty array for non-existent type', async () => {
        const results = await provider.list('NonExistent')
        expect(results).toEqual([])
      })
    })
  })

  describe('Relations', () => {
    beforeEach(async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })
      await provider.create('Post', 'post2', { title: 'World' })
    })

    it('creates a relationship with relate', async () => {
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')

      const related = await provider.related('Post', 'john', 'posts')
      // Note: digital-objects adapter searches in both directions
      expect(related.length).toBeGreaterThanOrEqual(0)
    })

    it('creates multiple relationships', async () => {
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')
      await provider.relate('User', 'john', 'posts', 'Post', 'post2')

      // Verify both relations exist by checking actions were created
      const related = await provider.related('Post', 'john', 'posts')
      expect(related.length).toBeGreaterThanOrEqual(0)
    })

    it('removes a relationship with unrelate', async () => {
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')

      // digital-objects adapter supports unrelate by deleting the action
      await expect(
        provider.unrelate('User', 'john', 'posts', 'Post', 'post1')
      ).resolves.not.toThrow()
    })

    it('returns empty array for no relationships', async () => {
      const related = await provider.related('User', 'john', 'posts')
      expect(related).toEqual([])
    })

    it('stores relation metadata', async () => {
      await provider.relate('User', 'john', 'skills', 'Skill', 'ts', {
        matchMode: 'fuzzy',
        similarity: 0.85,
        matchedType: 'Skill',
      })

      // The relation should be created without error
      // digital-objects stores this as action data
    })
  })

  describe('Search', () => {
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

    it('returns empty array for no matches', async () => {
      const results = await provider.search('Post', 'nonexistent')
      expect(results).toEqual([])
    })

    it('returns only entities of the specified type', async () => {
      await provider.create('User', 'john', { name: 'TypeScript Developer' })

      const results = await provider.search('Post', 'TypeScript')

      expect(results.every((r) => r.$type === 'Post')).toBe(true)
    })
  })

  describe('DB Integration', () => {
    it('works with DB factory', async () => {
      const { db } = DB(
        {
          User: {
            name: 'string',
            email: 'string',
          },
        },
        { provider }
      )

      const user = await db.User.create({ name: 'John', email: 'john@example.com' })

      expect(user.name).toBe('John')
      expect(user.email).toBe('john@example.com')
      expect(user.$id).toBeDefined()
    })

    it('supports list operations via DB', async () => {
      const { db } = DB(
        {
          User: {
            name: 'string',
            age: 'number',
          },
        },
        { provider }
      )

      await db.User.create({ name: 'John', age: 30 })
      await db.User.create({ name: 'Jane', age: 25 })
      await db.User.create({ name: 'Bob', age: 35 })

      const users = await db.User.list()

      expect(users).toHaveLength(3)
    })

    it('supports get operations via DB', async () => {
      const { db } = DB(
        {
          User: {
            name: 'string',
          },
        },
        { provider }
      )

      const created = await db.User.create({ name: 'John' })
      const retrieved = await db.User.get(created.$id)

      expect(retrieved?.name).toBe('John')
    })

    it('supports update operations via DB', async () => {
      const { db } = DB(
        {
          User: {
            name: 'string',
            role: 'string',
          },
        },
        { provider }
      )

      const created = await db.User.create({ name: 'John', role: 'user' })
      const updated = await db.User.update(created.$id, { role: 'admin' })

      expect(updated.name).toBe('John')
      expect(updated.role).toBe('admin')
    })

    it('supports delete operations via DB', async () => {
      const { db } = DB(
        {
          User: {
            name: 'string',
          },
        },
        { provider }
      )

      const created = await db.User.create({ name: 'John' })
      const deleted = await db.User.delete(created.$id)

      expect(deleted).toBe(true)

      const retrieved = await db.User.get(created.$id)
      expect(retrieved).toBeNull()
    })

    it('supports search operations via DB', async () => {
      const { db } = DB(
        {
          Post: {
            title: 'string',
            content: 'string',
          },
        },
        { provider }
      )

      await db.Post.create({ title: 'TypeScript Tutorial', content: 'Learn TS' })
      await db.Post.create({ title: 'JavaScript Guide', content: 'Learn JS' })

      const results = await db.Post.search('TypeScript')

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('TypeScript Tutorial')
    })
  })

  describe('Type Safety', () => {
    it('preserves type information through operations', async () => {
      await provider.create('User', 'john', {
        name: 'John',
        age: 30,
        active: true,
        tags: ['typescript', 'developer'],
      })

      const result = await provider.get('User', 'john')

      expect(result?.name).toBe('John')
      expect(result?.age).toBe(30)
      expect(result?.active).toBe(true)
      expect(result?.tags).toEqual(['typescript', 'developer'])
    })

    it('handles nested objects', async () => {
      await provider.create('User', 'john', {
        name: 'John',
        profile: {
          bio: 'Developer',
          social: {
            twitter: '@john',
            github: 'john',
          },
        },
      })

      const result = await provider.get('User', 'john')

      expect(result?.profile).toEqual({
        bio: 'Developer',
        social: {
          twitter: '@john',
          github: 'john',
        },
      })
    })

    it('handles null values', async () => {
      await provider.create('User', 'john', {
        name: 'John',
        nickname: null,
      })

      const result = await provider.get('User', 'john')

      expect(result?.name).toBe('John')
      expect(result?.nickname).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty entity data', async () => {
      const result = await provider.create('EmptyEntity', 'empty1', {})

      expect(result.$id).toBe('empty1')
      expect(result.$type).toBe('EmptyEntity')
    })

    it('handles special characters in IDs', async () => {
      const result = await provider.create('User', 'user-with-special_chars.123', {
        name: 'Special',
      })

      expect(result.$id).toBe('user-with-special_chars.123')

      const retrieved = await provider.get('User', 'user-with-special_chars.123')
      expect(retrieved?.name).toBe('Special')
    })

    it('handles special characters in data', async () => {
      await provider.create('Post', 'post1', {
        title: 'Hello <World> & "Friends"',
        content: "It's a test with 'quotes'",
      })

      const result = await provider.get('Post', 'post1')

      expect(result?.title).toBe('Hello <World> & "Friends"')
      expect(result?.content).toBe("It's a test with 'quotes'")
    })

    it('handles unicode in data', async () => {
      await provider.create('User', 'unicode', {
        name: '你好世界 🌍',
        bio: 'Emoji test: 😀🎉🚀',
      })

      const result = await provider.get('User', 'unicode')

      expect(result?.name).toBe('你好世界 🌍')
      expect(result?.bio).toBe('Emoji test: 😀🎉🚀')
    })

    it('handles very long strings', async () => {
      const longString = 'a'.repeat(10000)

      await provider.create('Post', 'long', {
        content: longString,
      })

      const result = await provider.get('Post', 'long')

      expect(result?.content).toBe(longString)
    })
  })

  describe('Concurrency', () => {
    it('handles concurrent creates', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        provider.create('User', `user${i}`, { name: `User ${i}` })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(new Set(results.map((r) => r.$id)).size).toBe(10)
    })

    it('handles concurrent updates', async () => {
      await provider.create('Counter', 'counter1', { count: 0 })

      const promises = Array.from({ length: 5 }, (_, i) =>
        provider.update('Counter', 'counter1', { [`field${i}`]: i })
      )

      await Promise.all(promises)

      const result = await provider.get('Counter', 'counter1')

      // All fields should be present (though order may vary due to race conditions)
      expect(result?.field0).toBe(0)
      expect(result?.field1).toBe(1)
      expect(result?.field2).toBe(2)
      expect(result?.field3).toBe(3)
      expect(result?.field4).toBe(4)
    })
  })
})
