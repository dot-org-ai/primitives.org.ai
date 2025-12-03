/**
 * Tests for schema parsing and bi-directional relationships
 *
 * These are pure unit tests - no database calls needed.
 */

import { describe, it, expect } from 'vitest'
import { parseSchema, DB } from './schema.js'
import type { DatabaseSchema, ParsedField } from './schema.js'

describe('parseSchema', () => {
  describe('primitive fields', () => {
    it('parses basic primitive types', () => {
      const schema: DatabaseSchema = {
        User: {
          name: 'string',
          age: 'number',
          active: 'boolean',
          created: 'date',
        },
      }

      const parsed = parseSchema(schema)
      const user = parsed.entities.get('User')

      expect(user).toBeDefined()
      expect(user!.fields.size).toBe(4)

      const name = user!.fields.get('name')
      expect(name?.type).toBe('string')
      expect(name?.isRelation).toBe(false)
      expect(name?.isArray).toBe(false)
      expect(name?.isOptional).toBe(false)
    })

    it('parses optional fields with ? modifier', () => {
      const schema: DatabaseSchema = {
        User: {
          bio: 'string?',
          age: 'number?',
        },
      }

      const parsed = parseSchema(schema)
      const user = parsed.entities.get('User')

      const bio = user!.fields.get('bio')
      expect(bio?.isOptional).toBe(true)
      expect(bio?.type).toBe('string')
    })

    it('parses array fields with [] modifier', () => {
      const schema: DatabaseSchema = {
        User: {
          tags: 'string[]',
          scores: 'number[]',
        },
      }

      const parsed = parseSchema(schema)
      const user = parsed.entities.get('User')

      const tags = user!.fields.get('tags')
      expect(tags?.isArray).toBe(true)
      expect(tags?.type).toBe('string')
      expect(tags?.isRelation).toBe(false)
    })

    it('parses array fields with literal syntax', () => {
      const schema: DatabaseSchema = {
        User: {
          tags: ['string'],
          scores: ['number'],
        },
      }

      const parsed = parseSchema(schema)
      const user = parsed.entities.get('User')

      const tags = user!.fields.get('tags')
      expect(tags?.isArray).toBe(true)
      expect(tags?.type).toBe('string')
    })

    it('parses all primitive types', () => {
      const schema: DatabaseSchema = {
        Entity: {
          str: 'string',
          num: 'number',
          bool: 'boolean',
          dt: 'date',
          dtt: 'datetime',
          json: 'json',
          md: 'markdown',
          url: 'url',
        },
      }

      const parsed = parseSchema(schema)
      const entity = parsed.entities.get('Entity')

      expect(entity!.fields.size).toBe(8)
      expect(entity!.fields.get('str')?.type).toBe('string')
      expect(entity!.fields.get('num')?.type).toBe('number')
      expect(entity!.fields.get('bool')?.type).toBe('boolean')
      expect(entity!.fields.get('dt')?.type).toBe('date')
      expect(entity!.fields.get('dtt')?.type).toBe('datetime')
      expect(entity!.fields.get('json')?.type).toBe('json')
      expect(entity!.fields.get('md')?.type).toBe('markdown')
      expect(entity!.fields.get('url')?.type).toBe('url')
    })
  })

  describe('simple relations', () => {
    it('parses relation without backref', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: 'Author',
        },
        Author: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')

      const author = post!.fields.get('author')
      expect(author?.isRelation).toBe(true)
      expect(author?.relatedType).toBe('Author')
      expect(author?.backref).toBeUndefined()
    })

    it('parses relation with explicit backref', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: 'Author.posts',
        },
        Author: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const author = parsed.entities.get('Author')

      const authorField = post!.fields.get('author')
      expect(authorField?.isRelation).toBe(true)
      expect(authorField?.relatedType).toBe('Author')
      expect(authorField?.backref).toBe('posts')

      // Check backref was auto-created
      const postsField = author!.fields.get('posts')
      expect(postsField).toBeDefined()
      expect(postsField?.isRelation).toBe(true)
      expect(postsField?.isArray).toBe(true)
      expect(postsField?.relatedType).toBe('Post')
      expect(postsField?.backref).toBe('author')
    })
  })

  describe('bi-directional relationships', () => {
    it('creates automatic backref for one-to-many', () => {
      const schema: DatabaseSchema = {
        Post: {
          title: 'string',
          author: 'Author.posts',
        },
        Author: {
          name: 'string',
          // posts: Post[] should be auto-created
        },
      }

      const parsed = parseSchema(schema)
      const author = parsed.entities.get('Author')
      const post = parsed.entities.get('Post')

      // Check Post.author
      const authorField = post!.fields.get('author')
      expect(authorField?.isRelation).toBe(true)
      expect(authorField?.isArray).toBe(false)
      expect(authorField?.relatedType).toBe('Author')
      expect(authorField?.backref).toBe('posts')

      // Check auto-created Author.posts
      const postsField = author!.fields.get('posts')
      expect(postsField).toBeDefined()
      expect(postsField?.isRelation).toBe(true)
      expect(postsField?.isArray).toBe(true)
      expect(postsField?.relatedType).toBe('Post')
      expect(postsField?.backref).toBe('author')
    })

    it('creates automatic backref for many-to-many', () => {
      const schema: DatabaseSchema = {
        Post: {
          tags: ['Tag.posts'],
        },
        Tag: {
          name: 'string',
          // posts: Post[] should be auto-created
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const tag = parsed.entities.get('Tag')

      // Check Post.tags
      const tagsField = post!.fields.get('tags')
      expect(tagsField?.isRelation).toBe(true)
      expect(tagsField?.isArray).toBe(true)
      expect(tagsField?.relatedType).toBe('Tag')
      expect(tagsField?.backref).toBe('posts')

      // Check auto-created Tag.posts
      const postsField = tag!.fields.get('posts')
      expect(postsField).toBeDefined()
      expect(postsField?.isRelation).toBe(true)
      expect(postsField?.isArray).toBe(true)
      expect(postsField?.relatedType).toBe('Post')
      expect(postsField?.backref).toBe('tags')
    })

    it('does not duplicate existing backref', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: 'Author.posts',
        },
        Author: {
          posts: ['Post.author'],
        },
      }

      const parsed = parseSchema(schema)
      const author = parsed.entities.get('Author')

      // Should only have the explicitly defined posts field
      expect(author!.fields.size).toBe(1)
      const postsField = author!.fields.get('posts')
      expect(postsField?.isArray).toBe(true)
      expect(postsField?.relatedType).toBe('Post')
    })
  })

  describe('complex schemas', () => {
    it('parses multi-entity schema with various field types', () => {
      const schema: DatabaseSchema = {
        Post: {
          title: 'string',
          content: 'markdown',
          published: 'boolean',
          author: 'Author.posts',
          tags: ['Tag.posts'],
        },
        Author: {
          name: 'string',
          email: 'string',
          bio: 'string?',
        },
        Tag: {
          name: 'string',
          slug: 'string',
        },
      }

      const parsed = parseSchema(schema)

      expect(parsed.entities.size).toBe(3)
      expect(parsed.entities.has('Post')).toBe(true)
      expect(parsed.entities.has('Author')).toBe(true)
      expect(parsed.entities.has('Tag')).toBe(true)

      // Check Post fields
      const post = parsed.entities.get('Post')
      expect(post!.fields.size).toBe(5)

      // Check Author backref
      const author = parsed.entities.get('Author')
      expect(author!.fields.has('posts')).toBe(true)

      // Check Tag backref
      const tag = parsed.entities.get('Tag')
      expect(tag!.fields.has('posts')).toBe(true)
    })

    it('handles optional relations', () => {
      const schema: DatabaseSchema = {
        User: {
          profile: 'Profile.user?',
        },
        Profile: {
          bio: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const user = parsed.entities.get('User')

      const profile = user!.fields.get('profile')
      expect(profile?.isOptional).toBe(true)
      expect(profile?.isRelation).toBe(true)
    })

    it('handles self-referential relations', () => {
      const schema: DatabaseSchema = {
        User: {
          name: 'string',
          manager: 'User.reports?',
        },
      }

      const parsed = parseSchema(schema)
      const user = parsed.entities.get('User')

      expect(user!.fields.has('manager')).toBe(true)
      expect(user!.fields.has('reports')).toBe(true)

      const manager = user!.fields.get('manager')
      expect(manager?.relatedType).toBe('User')
      expect(manager?.backref).toBe('reports')

      const reports = user!.fields.get('reports')
      expect(reports?.isArray).toBe(true)
      expect(reports?.relatedType).toBe('User')
    })
  })

  describe('edge cases', () => {
    it('handles empty schema', () => {
      const schema: DatabaseSchema = {}
      const parsed = parseSchema(schema)
      expect(parsed.entities.size).toBe(0)
    })

    it('handles entity with no fields', () => {
      const schema: DatabaseSchema = {
        Empty: {},
      }
      const parsed = parseSchema(schema)
      const empty = parsed.entities.get('Empty')
      expect(empty).toBeDefined()
      expect(empty!.fields.size).toBe(0)
    })

    it('handles relation to non-existent entity', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: 'Author.posts',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const author = post!.fields.get('author')

      expect(author?.isRelation).toBe(true)
      expect(author?.relatedType).toBe('Author')
      // Backref won't be created since Author doesn't exist
      expect(parsed.entities.has('Author')).toBe(false)
    })
  })
})

describe('DB factory', () => {
  it('creates a typed database from schema', () => {
    const schema: DatabaseSchema = {
      User: {
        name: 'string',
        email: 'string',
      },
    }

    const db = DB(schema)

    expect(db).toBeDefined()
    expect(db.$schema).toBeDefined()
    expect(db.User).toBeDefined()
    expect(typeof db.User.get).toBe('function')
    expect(typeof db.User.list).toBe('function')
    expect(typeof db.User.create).toBe('function')
    expect(typeof db.User.update).toBe('function')
    expect(typeof db.User.delete).toBe('function')
  })

  it('creates operations for all entity types', () => {
    const schema: DatabaseSchema = {
      Post: { title: 'string' },
      Author: { name: 'string' },
      Tag: { name: 'string' },
    }

    const db = DB(schema)

    expect(db.Post).toBeDefined()
    expect(db.Author).toBeDefined()
    expect(db.Tag).toBeDefined()
  })

  it('includes global search and get methods', () => {
    const schema: DatabaseSchema = {
      User: { name: 'string' },
    }

    const db = DB(schema)

    expect(typeof db.get).toBe('function')
    expect(typeof db.search).toBe('function')
  })

  it('preserves parsed schema in $schema', () => {
    const schema: DatabaseSchema = {
      User: {
        name: 'string',
        posts: ['Post.author'],
      },
      Post: {
        title: 'string',
      },
    }

    const db = DB(schema)

    expect(db.$schema.entities.size).toBe(2)
    const user = db.$schema.entities.get('User')
    expect(user!.fields.size).toBe(2)
  })
})

describe('type inference', () => {
  it('infers entity types from schema', () => {
    const schema = {
      User: {
        name: 'string',
        age: 'number',
        active: 'boolean',
      },
    } as const

    const db = DB(schema)

    // TypeScript should infer these types
    // Runtime check that the structure is correct
    expect(db.User).toBeDefined()
    expect(typeof db.User.get).toBe('function')
  })

  it('infers relation types', () => {
    const schema = {
      Post: {
        title: 'string',
        author: 'Author.posts',
      },
      Author: {
        name: 'string',
      },
    } as const

    const db = DB(schema)

    expect(db.Post).toBeDefined()
    expect(db.Author).toBeDefined()
  })
})
