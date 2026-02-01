/**
 * Tests for schema versioning functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryProvider } from '../src/memory-provider.js'
import {
  computeSchemaHash,
  getSchemaVersion,
  setSchemaVersion,
  hasSchemaChanged,
} from '../src/schema/version.js'
import type { DatabaseSchema } from '../src/types.js'

describe('Schema Version', () => {
  describe('computeSchemaHash', () => {
    it('computes a hash for a simple schema', () => {
      const schema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
      }

      const hash = computeSchemaHash(schema)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('produces consistent hash for same schema', () => {
      const schema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
        Post: { title: 'string', author: 'User.posts' },
      }

      const hash1 = computeSchemaHash(schema)
      const hash2 = computeSchemaHash(schema)

      expect(hash1).toBe(hash2)
    })

    it('produces same hash regardless of property order', () => {
      const schema1: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
        Post: { title: 'string' },
      }

      const schema2: DatabaseSchema = {
        Post: { title: 'string' },
        User: { email: 'string', name: 'string' },
      }

      const hash1 = computeSchemaHash(schema1)
      const hash2 = computeSchemaHash(schema2)

      expect(hash1).toBe(hash2)
    })

    it('produces different hash for different schemas', () => {
      const schema1: DatabaseSchema = {
        User: { name: 'string' },
      }

      const schema2: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
      }

      const hash1 = computeSchemaHash(schema1)
      const hash2 = computeSchemaHash(schema2)

      expect(hash1).not.toBe(hash2)
    })

    it('handles array field definitions', () => {
      const schema: DatabaseSchema = {
        Post: { title: 'string', tags: ['Tag.posts'] },
      }

      const hash = computeSchemaHash(schema)
      expect(hash).toBeDefined()
    })

    it('handles optional fields', () => {
      const schema: DatabaseSchema = {
        User: { name: 'string', bio: 'string?' },
      }

      const hash = computeSchemaHash(schema)
      expect(hash).toBeDefined()
    })

    it('handles relationship operators', () => {
      const schema: DatabaseSchema = {
        Post: {
          title: 'string',
          author: '->User',
          category: '~>Category',
        },
      }

      const hash = computeSchemaHash(schema)
      expect(hash).toBeDefined()
    })
  })

  describe('getSchemaVersion / setSchemaVersion', () => {
    let provider: ReturnType<typeof createMemoryProvider>

    beforeEach(() => {
      provider = createMemoryProvider()
    })

    it('returns null when no version is set', async () => {
      const version = await getSchemaVersion(provider)
      expect(version).toBeNull()
    })

    it('stores and retrieves version', async () => {
      await setSchemaVersion(provider, 1, 'abc123')

      const version = await getSchemaVersion(provider)

      expect(version).not.toBeNull()
      expect(version?.version).toBe(1)
      expect(version?.schemaHash).toBe('abc123')
    })

    it('stores version with description', async () => {
      await setSchemaVersion(provider, 1, 'abc123', 'Initial schema')

      const version = await getSchemaVersion(provider)

      expect(version?.description).toBe('Initial schema')
    })

    it('stores appliedAt timestamp', async () => {
      const before = new Date()
      await setSchemaVersion(provider, 1, 'abc123')
      const after = new Date()

      const version = await getSchemaVersion(provider)

      expect(version?.appliedAt).toBeDefined()
      const appliedAt = new Date(version!.appliedAt!)
      expect(appliedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(appliedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('updates existing version', async () => {
      await setSchemaVersion(provider, 1, 'abc123', 'v1')
      await setSchemaVersion(provider, 2, 'def456', 'v2')

      const version = await getSchemaVersion(provider)

      expect(version?.version).toBe(2)
      expect(version?.schemaHash).toBe('def456')
      expect(version?.description).toBe('v2')
    })
  })

  describe('hasSchemaChanged', () => {
    let provider: ReturnType<typeof createMemoryProvider>

    beforeEach(() => {
      provider = createMemoryProvider()
    })

    it('returns changed=true when no previous version exists', async () => {
      const schema: DatabaseSchema = {
        User: { name: 'string' },
      }

      const result = await hasSchemaChanged(provider, schema)

      expect(result.changed).toBe(true)
      expect(result.storedHash).toBeNull()
      expect(result.storedVersion).toBeNull()
      expect(result.currentHash).toBeDefined()
    })

    it('returns changed=false when schema matches', async () => {
      const schema: DatabaseSchema = {
        User: { name: 'string' },
      }

      const hash = computeSchemaHash(schema)
      await setSchemaVersion(provider, 1, hash)

      const result = await hasSchemaChanged(provider, schema)

      expect(result.changed).toBe(false)
      expect(result.storedHash).toBe(hash)
      expect(result.currentHash).toBe(hash)
      expect(result.storedVersion).toBe(1)
    })

    it('returns changed=true when schema differs', async () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
      }

      const oldHash = computeSchemaHash(oldSchema)
      await setSchemaVersion(provider, 1, oldHash)

      const result = await hasSchemaChanged(provider, newSchema)

      expect(result.changed).toBe(true)
      expect(result.storedHash).toBe(oldHash)
      expect(result.currentHash).not.toBe(oldHash)
    })
  })
})
