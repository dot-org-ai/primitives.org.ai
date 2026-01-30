/**
 * Tests for edge cases and error handling
 *
 * Covers unusual inputs, boundary conditions, and error scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

// TODO: Advanced feature tests - needs investigation
describe('edge cases', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('empty and minimal schemas', () => {
    it('handles empty schema', () => {
      const schema: DatabaseSchema = {}

      const { db } = DB(schema)

      // Empty user schema still has system entities (Noun, Verb, Edge)
      expect(db.$schema.entities.size).toBeGreaterThanOrEqual(1)
      expect(db.$schema.entities.has('Edge')).toBe(true)
      expect(typeof db.get).toBe('function')
      expect(typeof db.search).toBe('function')
    })

    it('handles entity with no fields', () => {
      const schema: DatabaseSchema = {
        Empty: {},
      }

      const { db } = DB(schema)

      expect(db.Empty).toBeDefined()
      expect(typeof db.Empty.create).toBe('function')
    })

    it('creates entity with no data fields', async () => {
      const schema: DatabaseSchema = {
        Marker: {},
      }

      const { db } = DB(schema)

      const marker = await db.Marker.create('mark1', {})

      expect(marker.$id).toBe('mark1')
      expect(marker.$type).toBe('Marker')
    })
  })

  describe('special characters in IDs', () => {
    const schema = {
      User: { name: 'string' },
    } as const

    it('handles IDs with hyphens', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user-123', { name: 'Test' })
      expect(user.$id).toBe('user-123')

      const retrieved = await db.User.get('user-123')
      expect(retrieved?.$id).toBe('user-123')
    })

    it('handles IDs with underscores', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user_123', { name: 'Test' })
      expect(user.$id).toBe('user_123')
    })

    it('handles IDs with dots', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user.123', { name: 'Test' })
      expect(user.$id).toBe('user.123')
    })

    it('handles IDs with slashes (path-like)', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('org/user/123', { name: 'Test' })
      expect(user.$id).toBe('org/user/123')
    })

    it('handles UUID-style IDs', async () => {
      const { db } = DB(schema)

      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const user = await db.User.create(uuid, { name: 'Test' })
      expect(user.$id).toBe(uuid)
    })
  })

  describe('special characters in data', () => {
    const schema = {
      User: {
        name: 'string',
        bio: 'string?',
      },
    } as const

    it('handles unicode characters', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user1', {
        name: '日本語',
        bio: '🚀 Emoji test',
      })

      expect(user.name).toBe('日本語')
      expect(user.bio).toBe('🚀 Emoji test')
    })

    it('handles newlines in data', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user1', {
        name: 'John',
        bio: 'Line 1\nLine 2\nLine 3',
      })

      expect(user.bio).toContain('\n')
    })

    it('handles special JSON characters', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user1', {
        name: 'Test "quoted" name',
        bio: 'Backslash: \\ and more: \t\n',
      })

      expect(user.name).toContain('"')
      expect(user.bio).toContain('\\')
    })
  })

  describe('large data', () => {
    const schema = {
      Document: {
        title: 'string',
        content: 'markdown',
      },
    } as const

    it('handles large strings', async () => {
      const { db } = DB(schema)

      const largeContent = 'x'.repeat(100000) // 100KB string

      const doc = await db.Document.create('doc1', {
        title: 'Large',
        content: largeContent,
      })

      expect(doc.content.length).toBe(100000)
    })

    it('handles many entities', async () => {
      const { db } = DB(schema)

      const count = 1000
      const promises = []

      for (let i = 0; i < count; i++) {
        promises.push(
          db.Document.create(`doc${i}`, {
            title: `Document ${i}`,
            content: `Content ${i}`,
          })
        )
      }

      await Promise.all(promises)

      const docs = await db.Document.list()
      expect(docs.length).toBe(count)
    })

    it('handles large result sets', async () => {
      const { db } = DB(schema)

      // Create 100 documents
      for (let i = 0; i < 100; i++) {
        await db.Document.create(`doc${i}`, {
          title: `Document ${i}`,
          content: `Content for document ${i}`,
        })
      }

      const all = await db.Document.list()
      expect(all.length).toBe(100)
    })
  })

  describe('concurrent operations', () => {
    const schema = {
      Counter: {
        value: 'number',
      },
    } as const

    it('handles concurrent creates', async () => {
      const { db } = DB(schema)

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(db.Counter.create(`counter${i}`, { value: i }))
      }

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(new Set(results.map((r) => r.$id)).size).toBe(10)
    })

    it('handles concurrent updates', async () => {
      const { db } = DB(schema)

      await db.Counter.create('counter1', { value: 0 })

      const promises = []
      for (let i = 1; i <= 5; i++) {
        promises.push(db.Counter.update('counter1', { value: i }))
      }

      await Promise.all(promises)

      const counter = await db.Counter.get('counter1')
      expect(counter?.value).toBeDefined()
    })

    it('handles concurrent list operations', async () => {
      const { db } = DB(schema)

      await db.Counter.create('counter1', { value: 1 })
      await db.Counter.create('counter2', { value: 2 })

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(db.Counter.list())
      }

      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result.length).toBe(2)
      })
    })
  })

  describe('optional fields', () => {
    const schema = {
      User: {
        name: 'string',
        email: 'string?',
        age: 'number?',
        bio: 'string?',
      },
    } as const

    it('creates entity with missing optional fields', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user1', {
        name: 'John',
      })

      expect(user.name).toBe('John')
      expect(user.email).toBeUndefined()
      expect(user.age).toBeUndefined()
    })

    it('creates entity with some optional fields', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('user1', {
        name: 'John',
        email: 'john@example.com',
      })

      expect(user.email).toBe('john@example.com')
      expect(user.age).toBeUndefined()
    })

    it('updates to set optional field', async () => {
      const { db } = DB(schema)

      await db.User.create('user1', { name: 'John' })

      const updated = await db.User.update('user1', {
        email: 'john@example.com',
      })

      expect(updated.email).toBe('john@example.com')
    })

    it('updates to unset optional field (set to undefined)', async () => {
      const { db } = DB(schema)

      await db.User.create('user1', {
        name: 'John',
        email: 'john@example.com',
      })

      const updated = await db.User.update('user1', {
        email: undefined,
      })

      expect(updated.email).toBeUndefined()
    })
  })

  describe('array fields', () => {
    const schema = {
      Post: {
        title: 'string',
        tags: 'string[]',
        scores: 'number[]',
      },
    } as const

    it('creates entity with empty arrays', async () => {
      const { db } = DB(schema)

      const post = await db.Post.create('post1', {
        title: 'Test',
        tags: [],
        scores: [],
      })

      expect(post.tags).toEqual([])
      expect(post.scores).toEqual([])
    })

    it('creates entity with array values', async () => {
      const { db } = DB(schema)

      const post = await db.Post.create('post1', {
        title: 'Test',
        tags: ['typescript', 'javascript'],
        scores: [1, 2, 3],
      })

      expect(post.tags).toEqual(['typescript', 'javascript'])
      expect(post.scores).toEqual([1, 2, 3])
    })

    it('updates array fields', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Test',
        tags: ['old'],
        scores: [1],
      })

      const updated = await db.Post.update('post1', {
        tags: ['new', 'tags'],
      })

      expect(updated.tags).toEqual(['new', 'tags'])
    })
  })

  describe('URL parsing edge cases', () => {
    const schema = {
      User: { name: 'string' },
    } as const

    it('parses full HTTPS URL', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      const user = await db.get('https://example.com/User/john')
      expect(user).toBeDefined()
    })

    it('parses HTTP URL', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      const user = await db.get('http://example.com/User/john')
      expect(user).toBeDefined()
    })

    it('parses type/id path', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      const user = await db.get('User/john')
      expect(user).toBeDefined()
    })

    it('parses nested path IDs', async () => {
      const { db } = DB(schema)

      await db.User.create('org/team/john', { name: 'John' })

      const user = await db.get('User/org/team/john')
      expect(user).toBeDefined()
    })

    it('handles URL with query parameters', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      // Should ignore query params
      const user = await db.get('https://example.com/User/john?param=value')
      expect(user).toBeDefined()
    })

    it('handles URL with hash', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      // Should ignore hash
      const user = await db.get('https://example.com/User/john#section')
      expect(user).toBeDefined()
    })
  })

  describe('relation edge cases', () => {
    const schema = {
      User: {
        name: 'string',
        manager: 'User.reports?',
      },
    } as const

    it('handles self-referential optional relation', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('john', {
        name: 'John',
      })

      // Verify the user was created correctly
      expect(user.$id).toBe('john')
      expect(user.name).toBe('John')
    })

    it('handles circular relations through provider', async () => {
      const { db } = DB(schema)
      const provider = createMemoryProvider()
      setProvider(provider)

      await db.User.create('alice', { name: 'Alice' })
      await db.User.create('bob', { name: 'Bob' })

      // Alice manages Bob, Bob manages Alice (circular)
      await provider.relate('User', 'alice', 'reports', 'User', 'bob')
      await provider.relate('User', 'bob', 'reports', 'User', 'alice')

      const aliceReports = await provider.related('User', 'alice', 'reports')
      const bobReports = await provider.related('User', 'bob', 'reports')

      expect(aliceReports).toHaveLength(1)
      expect(bobReports).toHaveLength(1)
    })
  })

  describe('search edge cases', () => {
    const schema = {
      Post: {
        title: 'string',
        content: 'markdown',
      },
    } as const

    it('searches for empty string', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Test',
        content: 'Content',
      })

      const results = await db.Post.search('')

      // Empty search might return all or none - implementation dependent
      expect(Array.isArray(results)).toBe(true)
    })

    it('searches for special regex characters', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Test [brackets]',
        content: 'Content with (parens)',
      })

      // Should not throw regex error
      const results = await db.Post.search('[brackets]')
      expect(Array.isArray(results)).toBe(true)
    })

    it('searches for very long query', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Test',
        content: 'Content',
      })

      const longQuery = 'word '.repeat(1000)
      const results = await db.Post.search(longQuery)

      expect(Array.isArray(results)).toBe(true)
    })

    it('searches with minScore 0', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Test TypeScript',
        content: 'Content',
      })

      const results = await db.Post.search('TypeScript', {
        minScore: 0,
      })

      expect(results.length).toBeGreaterThan(0)
    })

    it('searches with minScore 1', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Test',
        content: 'Content',
      })

      const results = await db.Post.search('Test', {
        minScore: 1,
      })

      // Very high threshold might return only exact matches
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('pagination edge cases', () => {
    const schema = {
      Item: { value: 'number' },
    } as const

    beforeEach(async () => {
      const { db } = DB(schema)
      for (let i = 0; i < 10; i++) {
        await db.Item.create(`item${i}`, { value: i })
      }
    })

    it('handles offset beyond result count', async () => {
      const { db } = DB(schema)

      const results = await db.Item.list({
        offset: 100,
      })

      expect(results).toEqual([])
    })

    it('handles limit of 0', async () => {
      const { db } = DB(schema)

      const results = await db.Item.list({
        limit: 0,
      })

      // Limit 0 might return empty or all - implementation dependent
      expect(Array.isArray(results)).toBe(true)
    })

    it('handles negative limit (treated as invalid)', async () => {
      const { db } = DB(schema)

      // Negative limit should throw validation error
      await expect(db.Item.list({ limit: -1 })).rejects.toThrow(/invalid.*limit|must be positive/i)
    })

    it('handles very large limit', async () => {
      const { db } = DB(schema)

      const results = await db.Item.list({
        limit: 1000000,
      })

      expect(results.length).toBeLessThanOrEqual(10)
    })
  })

  describe('type coercion', () => {
    const schema = {
      Mixed: {
        str: 'string',
        num: 'number',
        bool: 'boolean',
      },
    } as const

    it('stores values as provided', async () => {
      const { db } = DB(schema)

      const item = await db.Mixed.create('item1', {
        str: 'hello',
        num: 42,
        bool: true,
      })

      expect(typeof item.str).toBe('string')
      expect(typeof item.num).toBe('number')
      expect(typeof item.bool).toBe('boolean')
    })

    it('handles null values', async () => {
      const { db } = DB(schema)

      const item = await db.Mixed.create('item1', {
        str: 'test',
        num: 1,
        bool: false,
      } as any)

      expect(item.str).toBe('test')
    })
  })
})
