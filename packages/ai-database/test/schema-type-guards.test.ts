/**
 * Tests for type guard functions used in schema.ts
 *
 * These tests verify that type guards correctly identify and validate
 * various object types, reducing the need for dangerous type assertions.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, expectTypeOf } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import {
  isDraft,
  isResolved,
  extractRefs,
  hasFactoryFunction,
  isPlainObject,
  getSchemaMetadata,
} from '../src/type-guards.js'

describe('Schema Type Guards', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('isDraft', () => {
    it('should return true for valid draft objects', () => {
      const draft = {
        $phase: 'draft' as const,
        name: 'Test',
        $refs: {},
      }
      expect(isDraft(draft)).toBe(true)
    })

    it('should return false for resolved objects', () => {
      const resolved = {
        $phase: 'resolved' as const,
        name: 'Test',
      }
      expect(isDraft(resolved)).toBe(false)
    })

    it('should return false for objects without $phase', () => {
      const obj = { name: 'Test' }
      expect(isDraft(obj)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isDraft(null)).toBe(false)
    })

    it('should return false for arrays', () => {
      const arr = [{ $phase: 'draft' }]
      expect(isDraft(arr)).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isDraft('draft')).toBe(false)
      expect(isDraft(123)).toBe(false)
      expect(isDraft(true)).toBe(false)
    })
  })

  describe('isResolved', () => {
    it('should return true for valid resolved objects', () => {
      const resolved = {
        $phase: 'resolved' as const,
        name: 'Test',
      }
      expect(isResolved(resolved)).toBe(true)
    })

    it('should return false for draft objects', () => {
      const draft = {
        $phase: 'draft' as const,
        name: 'Test',
      }
      expect(isResolved(draft)).toBe(false)
    })

    it('should return false for objects without $phase', () => {
      const obj = { name: 'Test' }
      expect(isResolved(obj)).toBe(false)
    })
  })

  describe('extractRefs', () => {
    it('should extract $refs from draft object', () => {
      const draft = {
        $phase: 'draft' as const,
        name: 'Test',
        $refs: {
          author: { field: 'author', type: 'Author' },
        },
      }
      const refs = extractRefs(draft)
      expect(refs).toBeDefined()
      expect(refs?.['author']).toBeDefined()
    })

    it('should return undefined for non-draft objects', () => {
      const obj = { name: 'Test' }
      expect(extractRefs(obj)).toBeUndefined()
    })

    it('should return undefined for drafts without $refs', () => {
      const draft = {
        $phase: 'draft' as const,
        name: 'Test',
      }
      expect(extractRefs(draft)).toBeUndefined()
    })

    it('should return undefined for null', () => {
      expect(extractRefs(null)).toBeUndefined()
    })
  })

  describe('hasFactoryFunction', () => {
    it('should return true for modules with the specified factory function', () => {
      const module = {
        createProvider: (opts: unknown) => ({ get: () => null }),
      }
      expect(hasFactoryFunction(module, 'createProvider')).toBe(true)
    })

    it('should return false for modules without the specified function', () => {
      const module = {
        otherFunction: () => {},
      }
      expect(hasFactoryFunction(module, 'createProvider')).toBe(false)
    })

    it('should return false if the property is not a function', () => {
      const module = {
        createProvider: 'not a function',
      }
      expect(hasFactoryFunction(module, 'createProvider')).toBe(false)
    })

    it('should return false for null modules', () => {
      expect(hasFactoryFunction(null, 'createProvider')).toBe(false)
    })

    it('should return false for non-object modules', () => {
      expect(hasFactoryFunction('string', 'createProvider')).toBe(false)
      expect(hasFactoryFunction(123, 'createProvider')).toBe(false)
    })
  })

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true)
      expect(isPlainObject({ name: 'Test' })).toBe(true)
    })

    it('should return false for null', () => {
      expect(isPlainObject(null)).toBe(false)
    })

    it('should return false for arrays', () => {
      expect(isPlainObject([])).toBe(false)
      expect(isPlainObject([1, 2, 3])).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isPlainObject('string')).toBe(false)
      expect(isPlainObject(123)).toBe(false)
      expect(isPlainObject(true)).toBe(false)
      expect(isPlainObject(undefined)).toBe(false)
    })
  })

  describe('getSchemaMetadata', () => {
    it('should extract metadata fields from schema', () => {
      const schema = {
        $instructions: 'Generate a blog post',
        $context: 'For a technology blog',
        title: 'string',
        content: 'markdown',
      }
      expect(getSchemaMetadata<string>(schema, '$instructions')).toBe('Generate a blog post')
      expect(getSchemaMetadata<string>(schema, '$context')).toBe('For a technology blog')
    })

    it('should return undefined for missing fields', () => {
      const schema = {
        title: 'string',
      }
      expect(getSchemaMetadata<string>(schema, '$instructions')).toBeUndefined()
    })

    it('should return undefined for null/undefined schema', () => {
      expect(
        getSchemaMetadata<string>(null as unknown as Record<string, unknown>, '$instructions')
      ).toBeUndefined()
      expect(
        getSchemaMetadata<string>(undefined as unknown as Record<string, unknown>, '$instructions')
      ).toBeUndefined()
    })

    it('should handle non-object schemas gracefully', () => {
      expect(
        getSchemaMetadata<string>('string' as unknown as Record<string, unknown>, '$instructions')
      ).toBeUndefined()
    })
  })

  describe('Integration with DB', () => {
    it('should create drafts that pass isDraft check', async () => {
      const { db } = DB({
        Author: { name: 'string' },
        Post: { title: 'string', author: '~>Author' },
      })

      // Create an author first for fuzzy matching
      await db.Author.create({ name: 'John Doe' })

      // Create a draft
      const draft = await db.Post.draft({ title: 'My Post' })

      // The draft should have $phase: 'draft'
      expect(draft.$phase).toBe('draft')
      expect(isDraft(draft)).toBe(true)
      expect(isResolved(draft)).toBe(false)
    })

    it('should create resolved entities that pass isResolved check', async () => {
      const { db } = DB({
        Author: { name: 'string' },
        Post: { title: 'string', author: '~>Author' },
      })

      // Create an author first for fuzzy matching
      await db.Author.create({ name: 'John Doe' })

      // Create a draft and resolve it
      const draft = await db.Post.draft({ title: 'My Post' })
      const resolved = await db.Post.resolve(draft)

      // The resolved should have $phase: 'resolved'
      expect(resolved.$phase).toBe('resolved')
      expect(isResolved(resolved)).toBe(true)
      expect(isDraft(resolved)).toBe(false)
    })

    it('should allow extracting refs from drafts', async () => {
      const { db } = DB({
        Author: { name: 'string' },
        Post: { title: 'string', author: '~>Author' },
      })

      // Create a draft
      const draft = await db.Post.draft({ title: 'My Post' })

      // Extract refs
      const refs = extractRefs(draft)
      expect(refs).toBeDefined()
      // The author field should have a ref spec
      expect(refs?.['author']).toBeDefined()
    })
  })
})
