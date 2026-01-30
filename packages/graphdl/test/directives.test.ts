import { describe, it, expect } from 'vitest'
import { Graph } from '../src/index.js'
import type { ParsedEntity } from '../src/index.js'

describe('Passthrough Directives', () => {
  describe('ParsedEntity type', () => {
    it('has directives property', () => {
      const entity: ParsedEntity = {
        name: 'User',
        fields: new Map(),
        directives: {
          $partitionBy: ['tenantId'],
        },
      }
      expect(entity.directives).toBeDefined()
      expect(entity.directives?.$partitionBy).toEqual(['tenantId'])
    })
  })

  describe('Graph parsing', () => {
    it('stores $partitionBy directive', () => {
      const schema = Graph({
        User: {
          $type: 'https://schema.org.ai/Person',
          $partitionBy: ['tenantId'],
          id: 'uuid!',
          email: 'string#',
        },
      })

      const user = schema.entities.get('User')
      expect(user?.directives?.$partitionBy).toEqual(['tenantId'])
    })

    it('stores $index directive', () => {
      const schema = Graph({
        User: {
          $index: [['email'], ['createdAt']],
          email: 'string',
          createdAt: 'datetime',
        },
      })

      const user = schema.entities.get('User')
      expect(user?.directives?.$index).toEqual([['email'], ['createdAt']])
    })

    it('stores $fts directive for full-text search', () => {
      const schema = Graph({
        Post: {
          $fts: ['title', 'content'],
          title: 'string',
          content: 'markdown',
        },
      })

      const post = schema.entities.get('Post')
      expect(post?.directives?.$fts).toEqual(['title', 'content'])
    })

    it('stores $vector directive for vector/embedding fields', () => {
      const schema = Graph({
        Document: {
          $vector: { field: 'embedding', dimensions: 1536 },
          content: 'string',
          embedding: 'float[]',
        },
      })

      const doc = schema.entities.get('Document')
      expect(doc?.directives?.$vector).toEqual({ field: 'embedding', dimensions: 1536 })
    })

    it('stores multiple directives together', () => {
      const schema = Graph({
        User: {
          $type: 'https://schema.org.ai/Person',
          $partitionBy: ['tenantId'],
          $index: [['email']],
          $fts: ['bio'],
          tenantId: 'string',
          email: 'string',
          bio: 'string',
        },
      })

      const user = schema.entities.get('User')
      expect(user?.$type).toBe('https://schema.org.ai/Person')
      expect(user?.directives?.$partitionBy).toEqual(['tenantId'])
      expect(user?.directives?.$index).toEqual([['email']])
      expect(user?.directives?.$fts).toEqual(['bio'])
    })

    it('stores arbitrary custom directives', () => {
      const schema = Graph({
        Analytics: {
          $retention: '90d',
          $compression: 'zstd',
          $customOption: { foo: 'bar', nested: { value: 123 } },
          timestamp: 'datetime',
          event: 'string',
        },
      })

      const analytics = schema.entities.get('Analytics')
      expect(analytics?.directives?.$retention).toBe('90d')
      expect(analytics?.directives?.$compression).toBe('zstd')
      expect(analytics?.directives?.$customOption).toEqual({ foo: 'bar', nested: { value: 123 } })
    })

    it('does not include directives in fields', () => {
      const schema = Graph({
        User: {
          $partitionBy: ['tenantId'],
          $index: [['email']],
          name: 'string',
          email: 'string',
        },
      })

      const user = schema.entities.get('User')
      // Directives should not be treated as fields
      expect(user?.fields.has('$partitionBy')).toBe(false)
      expect(user?.fields.has('$index')).toBe(false)
      // Regular fields should still be parsed
      expect(user?.fields.has('name')).toBe(true)
      expect(user?.fields.has('email')).toBe(true)
    })

    it('preserves $type while storing other directives', () => {
      const schema = Graph({
        User: {
          $type: 'https://schema.org.ai/Person',
          $partitionBy: ['tenantId'],
          name: 'string',
        },
      })

      const user = schema.entities.get('User')
      // $type should remain a top-level property
      expect(user?.$type).toBe('https://schema.org.ai/Person')
      // $partitionBy should be in directives
      expect(user?.directives?.$partitionBy).toEqual(['tenantId'])
    })
  })

  describe('backwards compatibility', () => {
    it('entities without directives work normally', () => {
      const schema = Graph({
        User: {
          $type: 'https://schema.org.ai/Person',
          name: 'string',
        },
      })

      const user = schema.entities.get('User')
      expect(user?.name).toBe('User')
      expect(user?.$type).toBe('https://schema.org.ai/Person')
      expect(user?.fields.has('name')).toBe(true)
      // directives should be undefined or empty
      expect(user?.directives === undefined || Object.keys(user.directives).length === 0).toBe(true)
    })

    it('simple type URI mappings still work', () => {
      const schema = Graph({
        User: 'https://schema.org.ai/Person',
      })

      expect(schema.entities.get('User')?.name).toBe('User')
      expect(schema.typeUris.get('User')).toBe('https://schema.org.ai/Person')
    })
  })
})
