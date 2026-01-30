import { describe, it, expect } from 'vitest'
import {
  Graph,
  getEntityNames,
  getTypeUris,
  getEntity,
  hasEntity,
  getRelationshipFields,
  getReferencingEntities,
} from '../src/graph.js'

describe('Graph', () => {
  describe('simple type mapping', () => {
    it('parses simple type URI mappings', () => {
      const schema = Graph({
        User: 'https://schema.org.ai/Person',
        Org: 'https://schema.org.ai/Organization',
      })

      expect(schema.entities.size).toBe(2)
      expect(schema.typeUris.get('User')).toBe('https://schema.org.ai/Person')
      expect(schema.typeUris.get('Org')).toBe('https://schema.org.ai/Organization')
    })

    it('creates entities with no fields for simple mappings', () => {
      const schema = Graph({
        User: 'https://schema.org.ai/Person',
      })

      const user = schema.entities.get('User')
      expect(user?.name).toBe('User')
      expect(user?.fields.size).toBe(0)
    })
  })

  describe('with properties', () => {
    it('parses primitive type fields', () => {
      const schema = Graph({
        Post: {
          $type: 'https://schema.org.ai/BlogPosting',
          title: 'string',
          views: 'number',
          published: 'boolean',
        },
      })

      const post = schema.entities.get('Post')
      expect(post?.fields.get('title')?.type).toBe('string')
      expect(post?.fields.get('views')?.type).toBe('number')
      expect(post?.fields.get('published')?.type).toBe('boolean')
    })

    it('parses optional fields', () => {
      const schema = Graph({
        Post: {
          title: 'string',
          subtitle: 'string?',
        },
      })

      const post = schema.entities.get('Post')
      expect(post?.fields.get('title')?.isOptional).toBe(false)
      expect(post?.fields.get('subtitle')?.isOptional).toBe(true)
    })

    it('parses array fields', () => {
      const schema = Graph({
        Post: {
          tags: 'string[]',
        },
      })

      const post = schema.entities.get('Post')
      expect(post?.fields.get('tags')?.isArray).toBe(true)
      expect(post?.fields.get('tags')?.type).toBe('string')
    })
  })

  describe('with relationships', () => {
    it('parses forward exact relationships', () => {
      const schema = Graph({
        Post: {
          author: '->User',
        },
        User: {
          name: 'string',
        },
      })

      const post = schema.entities.get('Post')
      const author = post?.fields.get('author')
      expect(author?.isRelation).toBe(true)
      expect(author?.relatedType).toBe('User')
      expect(author?.operator).toBe('->')
      expect(author?.direction).toBe('forward')
      expect(author?.matchMode).toBe('exact')
    })

    it('parses forward fuzzy relationships', () => {
      const schema = Graph({
        Post: {
          category: '~>Category',
        },
        Category: {
          name: 'string',
        },
      })

      const post = schema.entities.get('Post')
      const category = post?.fields.get('category')
      expect(category?.matchMode).toBe('fuzzy')
    })

    it('parses relationships with backref', () => {
      const schema = Graph({
        Post: {
          author: '->User.posts',
        },
        User: {
          name: 'string',
        },
      })

      const post = schema.entities.get('Post')
      const author = post?.fields.get('author')
      expect(author?.backref).toBe('posts')

      // Should auto-create backref on User
      const user = schema.entities.get('User')
      const posts = user?.fields.get('posts')
      expect(posts?.isRelation).toBe(true)
      expect(posts?.relatedType).toBe('Post')
      expect(posts?.isArray).toBe(true)
    })

    it('parses array relationships', () => {
      const schema = Graph({
        Post: {
          categories: ['~>Category'],
        },
        Category: {
          name: 'string',
        },
      })

      const post = schema.entities.get('Post')
      const categories = post?.fields.get('categories')
      expect(categories?.isArray).toBe(true)
      expect(categories?.matchMode).toBe('fuzzy')
    })
  })

  describe('bi-directional relationships', () => {
    it('auto-creates inverse relationships', () => {
      const schema = Graph({
        Comment: {
          post: '->Post.comments',
          author: '->User.comments',
        },
        Post: {
          title: 'string',
        },
        User: {
          name: 'string',
        },
      })

      // Post should have comments backref
      const post = schema.entities.get('Post')
      expect(post?.fields.has('comments')).toBe(true)
      expect(post?.fields.get('comments')?.relatedType).toBe('Comment')
      expect(post?.fields.get('comments')?.isArray).toBe(true)

      // User should have comments backref
      const user = schema.entities.get('User')
      expect(user?.fields.has('comments')).toBe(true)
    })

    it('does not overwrite existing fields', () => {
      const schema = Graph({
        Post: {
          author: '->User.posts',
        },
        User: {
          name: 'string',
          posts: 'string[]', // Already defined
        },
      })

      // User.posts should remain as string[], not be overwritten
      const user = schema.entities.get('User')
      expect(user?.fields.get('posts')?.type).toBe('string')
      expect(user?.fields.get('posts')?.isRelation).toBe(false)
    })
  })

  describe('complex example', () => {
    it('parses a full blog schema', () => {
      const schema = Graph({
        User: 'https://schema.org.ai/Person',
        Post: {
          $type: 'https://schema.org.ai/BlogPosting',
          title: 'string',
          content: 'markdown',
          author: '->User.posts',
          categories: ['~>Category'],
        },
        Category: {
          $type: 'https://schema.org.ai/Category',
          name: 'string',
        },
      })

      expect(schema.entities.size).toBe(3)
      expect(schema.typeUris.get('Post')).toBe('https://schema.org.ai/BlogPosting')
      expect(schema.typeUris.get('Category')).toBe('https://schema.org.ai/Category')
      expect(schema.typeUris.get('User')).toBe('https://schema.org.ai/Person')

      // User should have auto-created posts backref
      const user = schema.entities.get('User')
      expect(user?.fields.has('posts')).toBe(true)
    })
  })
})

describe('utility functions', () => {
  const schema = Graph({
    User: 'https://schema.org.ai/Person',
    Post: {
      title: 'string',
      author: '->User.posts',
    },
    Comment: {
      content: 'string',
      post: '->Post.comments',
    },
  })

  describe('getEntityNames', () => {
    it('returns all entity names', () => {
      const names = getEntityNames(schema)
      expect(names).toContain('User')
      expect(names).toContain('Post')
      expect(names).toContain('Comment')
      expect(names.length).toBe(3)
    })
  })

  describe('getTypeUris', () => {
    it('returns type URI map', () => {
      const uris = getTypeUris(schema)
      expect(uris.get('User')).toBe('https://schema.org.ai/Person')
    })
  })

  describe('getEntity', () => {
    it('returns entity by name', () => {
      const post = getEntity(schema, 'Post')
      expect(post?.name).toBe('Post')
      expect(post?.fields.has('title')).toBe(true)
    })

    it('returns undefined for non-existent entity', () => {
      expect(getEntity(schema, 'NotExists')).toBeUndefined()
    })
  })

  describe('hasEntity', () => {
    it('returns true for existing entities', () => {
      expect(hasEntity(schema, 'User')).toBe(true)
      expect(hasEntity(schema, 'Post')).toBe(true)
    })

    it('returns false for non-existent entities', () => {
      expect(hasEntity(schema, 'NotExists')).toBe(false)
    })
  })

  describe('getRelationshipFields', () => {
    it('returns only relationship fields', () => {
      const fields = getRelationshipFields(schema, 'Post')
      // Post has author (explicit) and comments (auto-created backref from Comment.post)
      expect(fields.length).toBe(2)
      expect(fields.map((f) => f.name)).toContain('author')
      expect(fields.map((f) => f.name)).toContain('comments')
    })

    it('returns empty array for non-existent entity', () => {
      expect(getRelationshipFields(schema, 'NotExists')).toEqual([])
    })
  })

  describe('getReferencingEntities', () => {
    it('returns entities that reference a given entity', () => {
      const refs = getReferencingEntities(schema, 'Post')
      expect(refs).toContainEqual({ entity: 'Comment', field: 'post' })
      // User.posts also references Post (backref)
      expect(refs).toContainEqual({ entity: 'User', field: 'posts' })
    })

    it('returns references to Comment (from Post.comments auto-created backref)', () => {
      const refs = getReferencingEntities(schema, 'Comment')
      // Post has auto-created comments backref that references Comment
      expect(refs).toContainEqual({ entity: 'Post', field: 'comments' })
    })
  })
})
