import { describe, it, expect, beforeEach } from 'vitest'
import {
  inferNoun,
  defineNoun,
  createTypeMeta,
  getTypeMeta,
  Type,
  clearTypeMetaCache,
} from '../src/noun.js'

beforeEach(() => {
  clearTypeMetaCache()
})

describe('inferNoun', () => {
  it('infers singular and plural from PascalCase', () => {
    const noun = inferNoun('BlogPost')
    expect(noun.singular).toBe('blog post')
    expect(noun.plural).toBe('blog posts')
  })

  it('handles single word types', () => {
    const noun = inferNoun('Category')
    expect(noun.singular).toBe('category')
    expect(noun.plural).toBe('categories')
  })

  it('handles multi-word types', () => {
    const noun = inferNoun('UserProfileSetting')
    expect(noun.singular).toBe('user profile setting')
    expect(noun.plural).toBe('user profile settings')
  })

  it('includes default actions', () => {
    const noun = inferNoun('Post')
    expect(noun.actions).toEqual(['create', 'update', 'delete'])
  })

  it('includes default events', () => {
    const noun = inferNoun('Post')
    expect(noun.events).toEqual(['created', 'updated', 'deleted'])
  })

  it('handles irregular plurals', () => {
    const noun = inferNoun('Person')
    expect(noun.singular).toBe('person')
    expect(noun.plural).toBe('people')
  })
})

describe('defineNoun', () => {
  it('creates a noun with provided values', () => {
    const noun = defineNoun({
      singular: 'person',
      plural: 'people',
      description: 'A human individual',
    })
    expect(noun.singular).toBe('person')
    expect(noun.plural).toBe('people')
    expect(noun.description).toBe('A human individual')
  })

  it('auto-generates plural if not provided', () => {
    const noun = defineNoun({
      singular: 'category',
    })
    expect(noun.plural).toBe('categories')
  })

  it('includes default actions if not provided', () => {
    const noun = defineNoun({
      singular: 'post',
    })
    expect(noun.actions).toEqual(['create', 'update', 'delete'])
  })

  it('uses provided actions', () => {
    const noun = defineNoun({
      singular: 'post',
      actions: ['create', 'update', 'delete', 'publish', 'archive'],
    })
    expect(noun.actions).toEqual(['create', 'update', 'delete', 'publish', 'archive'])
  })

  it('includes properties and relationships', () => {
    const noun = defineNoun({
      singular: 'post',
      properties: {
        title: { type: 'string', description: 'Post title' },
        content: { type: 'markdown', description: 'Post content' },
      },
      relationships: {
        author: { type: 'User', backref: 'posts' },
      },
    })
    expect(noun.properties?.title.type).toBe('string')
    expect(noun.relationships?.author.type).toBe('User')
  })
})

describe('createTypeMeta', () => {
  it('creates type metadata from type name', () => {
    const meta = createTypeMeta('BlogPost')
    expect(meta.name).toBe('BlogPost')
    expect(meta.singular).toBe('blog post')
    expect(meta.plural).toBe('blog posts')
    expect(meta.slug).toBe('blog-post')
    expect(meta.slugPlural).toBe('blog-posts')
  })

  it('includes verb-derived accessors', () => {
    const meta = createTypeMeta('Post')
    expect(meta.creator).toBe('creator')
    expect(meta.createdAt).toBe('createdAt')
    expect(meta.createdBy).toBe('createdBy')
    expect(meta.updatedAt).toBe('updatedAt')
    expect(meta.updatedBy).toBe('updatedBy')
  })

  it('includes event types', () => {
    const meta = createTypeMeta('Post')
    expect(meta.created).toBe('Post.created')
    expect(meta.updated).toBe('Post.updated')
    expect(meta.deleted).toBe('Post.deleted')
  })
})

describe('getTypeMeta', () => {
  it('returns cached type metadata', () => {
    const meta1 = getTypeMeta('Post')
    const meta2 = getTypeMeta('Post')
    expect(meta1).toBe(meta2) // Same object reference
  })

  it('creates new metadata for different types', () => {
    const meta1 = getTypeMeta('Post')
    const meta2 = getTypeMeta('User')
    expect(meta1).not.toBe(meta2)
    expect(meta1.name).toBe('Post')
    expect(meta2.name).toBe('User')
  })
})

describe('Type', () => {
  it('provides dynamic access to type metadata', () => {
    const Post = Type('Post')
    expect(Post.singular).toBe('post')
    expect(Post.plural).toBe('posts')
    expect(Post.created).toBe('Post.created')
  })

  it('works with multi-word types', () => {
    const BlogPost = Type('BlogPost')
    expect(BlogPost.singular).toBe('blog post')
    expect(BlogPost.plural).toBe('blog posts')
    expect(BlogPost.slug).toBe('blog-post')
  })
})

describe('clearTypeMetaCache', () => {
  it('clears the cache', () => {
    const meta1 = getTypeMeta('Post')
    clearTypeMetaCache()
    const meta2 = getTypeMeta('Post')
    expect(meta1).not.toBe(meta2) // Different object after cache clear
    expect(meta1.name).toBe(meta2.name) // But same content
  })
})
