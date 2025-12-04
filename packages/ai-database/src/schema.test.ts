/**
 * Tests for schema parsing and bi-directional relationships
 *
 * These are pure unit tests - no database calls needed.
 */

import { describe, it, expect } from 'vitest'
import {
  parseSchema,
  DB,
  defineNoun,
  defineVerb,
  nounToSchema,
  getVerbFields,
  Verbs,
  conjugate,
  pluralize,
  singularize,
  inferNoun,
  Type,
  getTypeMeta,
  createTypeMeta,
  SystemSchema,
  ThingSchema,
  NounSchema,
  VerbSchema,
  EdgeSchema,
  createNounRecord,
  createEdgeRecords,
  setNLQueryGenerator,
} from './schema.js'
import type { DatabaseSchema, ParsedField, Noun, Verb, TypeMeta, NLQueryPlan } from './schema.js'

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

describe('Noun & Verb', () => {
  describe('defineVerb', () => {
    it('creates a verb with all conjugations', () => {
      const publish = defineVerb({
        action: 'publish',
        actor: 'publisher',
        act: 'publishes',
        activity: 'publishing',
        result: 'publication',
        reverse: { at: 'publishedAt', by: 'publishedBy' },
        inverse: 'unpublish',
      })

      expect(publish.action).toBe('publish')
      expect(publish.actor).toBe('publisher')
      expect(publish.act).toBe('publishes')
      expect(publish.activity).toBe('publishing')
      expect(publish.result).toBe('publication')
      expect(publish.reverse?.at).toBe('publishedAt')
      expect(publish.reverse?.by).toBe('publishedBy')
      expect(publish.inverse).toBe('unpublish')
    })

    it('provides standard CRUD verbs', () => {
      expect(Verbs.create.action).toBe('create')
      expect(Verbs.create.actor).toBe('creator')
      expect(Verbs.create.activity).toBe('creating')
      expect(Verbs.create.reverse?.at).toBe('createdAt')
      expect(Verbs.create.reverse?.by).toBe('createdBy')
      expect(Verbs.create.inverse).toBe('delete')

      expect(Verbs.update.action).toBe('update')
      expect(Verbs.delete.action).toBe('delete')
      expect(Verbs.publish.action).toBe('publish')
      expect(Verbs.archive.action).toBe('archive')
    })
  })

  describe('defineNoun', () => {
    it('creates a noun with properties and relationships', () => {
      const Post = defineNoun({
        singular: 'post',
        plural: 'posts',
        description: 'A blog post or article',
        properties: {
          title: { type: 'string', description: 'The post title' },
          content: { type: 'markdown', description: 'The post body' },
          status: { type: 'string', optional: true },
        },
        relationships: {
          author: { type: 'Author', backref: 'posts', description: 'Who wrote this' },
          tags: { type: 'Tag[]', backref: 'posts' },
        },
        actions: ['create', 'update', 'delete', 'publish'],
        events: ['created', 'updated', 'deleted', 'published'],
      })

      expect(Post.singular).toBe('post')
      expect(Post.plural).toBe('posts')
      expect(Post.properties?.title.type).toBe('string')
      expect(Post.properties?.title.description).toBe('The post title')
      expect(Post.properties?.status?.optional).toBe(true)
      expect(Post.relationships?.author.type).toBe('Author')
      expect(Post.relationships?.author.backref).toBe('posts')
      expect(Post.relationships?.tags.type).toBe('Tag[]')
      expect(Post.actions).toContain('publish')
      expect(Post.events).toContain('published')
    })
  })

  describe('nounToSchema', () => {
    it('converts noun to entity schema', () => {
      const Post = defineNoun({
        singular: 'post',
        plural: 'posts',
        properties: {
          title: { type: 'string' },
          content: { type: 'markdown' },
          draft: { type: 'boolean', optional: true },
          tags: { type: 'string', array: true },
        },
        relationships: {
          author: { type: 'Author', backref: 'posts' },
        },
      })

      const schema = nounToSchema(Post)

      expect(schema.title).toBe('string')
      expect(schema.content).toBe('markdown')
      expect(schema.draft).toBe('boolean?')
      expect(schema.tags).toBe('string[]')
      expect(schema.author).toBe('Author.posts')
    })

    it('handles many-to-many relationships', () => {
      const Post = defineNoun({
        singular: 'post',
        plural: 'posts',
        relationships: {
          tags: { type: 'Tag[]', backref: 'posts' },
        },
      })

      const schema = nounToSchema(Post)

      expect(schema.tags).toEqual(['Tag.posts'])
    })

    it('handles relationships without backref', () => {
      const Post = defineNoun({
        singular: 'post',
        plural: 'posts',
        relationships: {
          category: { type: 'Category' },
        },
      })

      const schema = nounToSchema(Post)

      expect(schema.category).toBe('Category')
    })
  })

  describe('getVerbFields', () => {
    it('returns reverse fields for standard verbs', () => {
      const createFields = getVerbFields('create')
      expect(createFields.at).toBe('createdAt')
      expect(createFields.by).toBe('createdBy')
      expect(createFields.in).toBe('createdIn')
      expect(createFields.for).toBe('createdFor')

      const updateFields = getVerbFields('update')
      expect(updateFields.at).toBe('updatedAt')
      expect(updateFields.by).toBe('updatedBy')

      const publishFields = getVerbFields('publish')
      expect(publishFields.at).toBe('publishedAt')
      expect(publishFields.by).toBe('publishedBy')
    })
  })

  describe('integration with DB', () => {
    it('uses noun-derived schema with DB()', () => {
      const Post = defineNoun({
        singular: 'post',
        plural: 'posts',
        properties: {
          title: { type: 'string' },
          content: { type: 'markdown' },
        },
        relationships: {
          author: { type: 'Author', backref: 'posts' },
        },
      })

      const Author = defineNoun({
        singular: 'author',
        plural: 'authors',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      })

      const db = DB({
        Post: nounToSchema(Post),
        Author: nounToSchema(Author),
      })

      expect(db.Post).toBeDefined()
      expect(db.Author).toBeDefined()
      expect(db.$schema.entities.get('Author')?.fields.has('posts')).toBe(true)
    })
  })
})

describe('AI Auto-Generation', () => {
  describe('conjugate', () => {
    it('returns known verbs from Verbs constant', () => {
      const create = conjugate('create')
      expect(create.action).toBe('create')
      expect(create.actor).toBe('creator')
      expect(create.act).toBe('creates')
      expect(create.activity).toBe('creating')
      expect(create.result).toBe('creation')
      expect(create.inverse).toBe('delete')
    })

    it('auto-generates conjugations for unknown verbs', () => {
      const approve = conjugate('approve')
      expect(approve.action).toBe('approve')
      expect(approve.actor).toBe('approver')
      expect(approve.act).toBe('approves')
      expect(approve.activity).toBe('approving')
      expect(approve.reverse?.at).toBe('approvedAt')
      expect(approve.reverse?.by).toBe('approvedBy')
    })

    it('handles verbs ending in consonant', () => {
      const submit = conjugate('submit')
      expect(submit.actor).toBe('submitter')
      expect(submit.activity).toBe('submitting')
      expect(submit.reverse?.at).toBe('submittedAt')
    })

    it('handles verbs ending in y', () => {
      const apply = conjugate('apply')
      expect(apply.actor).toBe('applier')
      expect(apply.act).toBe('applies')
      expect(apply.activity).toBe('applying')
      expect(apply.reverse?.at).toBe('appliedAt')
    })

    it('handles -ify verbs', () => {
      const verify = conjugate('verify')
      expect(verify.result).toBe('verification')
    })

    it('handles -ize verbs', () => {
      const authorize = conjugate('authorize')
      expect(authorize.result).toBe('authorization')
    })
  })

  describe('pluralize', () => {
    it('handles regular plurals', () => {
      expect(pluralize('post')).toBe('posts')
      expect(pluralize('user')).toBe('users')
      expect(pluralize('tag')).toBe('tags')
    })

    it('handles -y endings', () => {
      expect(pluralize('category')).toBe('categories')
      expect(pluralize('company')).toBe('companies')
      expect(pluralize('story')).toBe('stories')
    })

    it('handles -y with vowel before', () => {
      expect(pluralize('day')).toBe('days')
      expect(pluralize('key')).toBe('keys')
      expect(pluralize('toy')).toBe('toys')
    })

    it('handles -s, -x, -z, -ch, -sh endings', () => {
      expect(pluralize('class')).toBe('classes')
      expect(pluralize('box')).toBe('boxes')
      expect(pluralize('quiz')).toBe('quizzes')
      expect(pluralize('match')).toBe('matches')
      expect(pluralize('wish')).toBe('wishes')
    })

    it('handles -f and -fe endings', () => {
      expect(pluralize('leaf')).toBe('leaves')
      expect(pluralize('knife')).toBe('knives')
      expect(pluralize('life')).toBe('lives')
    })

    it('handles irregular plurals', () => {
      expect(pluralize('person')).toBe('people')
      expect(pluralize('child')).toBe('children')
      expect(pluralize('man')).toBe('men')
      expect(pluralize('woman')).toBe('women')
      expect(pluralize('mouse')).toBe('mice')
      expect(pluralize('datum')).toBe('data')
      expect(pluralize('criterion')).toBe('criteria')
    })

    it('preserves case', () => {
      expect(pluralize('Person')).toBe('People')
      expect(pluralize('Category')).toBe('Categories')
    })
  })

  describe('singularize', () => {
    it('handles regular singulars', () => {
      expect(singularize('posts')).toBe('post')
      expect(singularize('users')).toBe('user')
      expect(singularize('tags')).toBe('tag')
    })

    it('handles -ies endings', () => {
      expect(singularize('categories')).toBe('category')
      expect(singularize('companies')).toBe('company')
      expect(singularize('stories')).toBe('story')
    })

    it('handles -es endings', () => {
      expect(singularize('classes')).toBe('class')
      expect(singularize('boxes')).toBe('box')
      expect(singularize('matches')).toBe('match')
      expect(singularize('wishes')).toBe('wish')
    })

    it('handles -ves endings', () => {
      expect(singularize('leaves')).toBe('leaf')
      expect(singularize('knives')).toBe('knife') // via irregular list
      expect(singularize('lives')).toBe('life')
      expect(singularize('wolves')).toBe('wolf') // via regular rule
    })

    it('handles irregular singulars', () => {
      expect(singularize('people')).toBe('person')
      expect(singularize('children')).toBe('child')
      expect(singularize('men')).toBe('man')
      expect(singularize('women')).toBe('woman')
      expect(singularize('mice')).toBe('mouse')
      expect(singularize('data')).toBe('datum')
      expect(singularize('criteria')).toBe('criterion')
    })
  })

  describe('inferNoun', () => {
    it('infers noun from PascalCase type name', () => {
      const post = inferNoun('Post')
      expect(post.singular).toBe('post')
      expect(post.plural).toBe('posts')
    })

    it('handles multi-word type names', () => {
      const blogPost = inferNoun('BlogPost')
      expect(blogPost.singular).toBe('blog post')
      expect(blogPost.plural).toBe('blog posts')
    })

    it('handles complex type names', () => {
      const userProfile = inferNoun('UserProfile')
      expect(userProfile.singular).toBe('user profile')
      expect(userProfile.plural).toBe('user profiles')
    })

    it('includes default actions and events', () => {
      const post = inferNoun('Post')
      expect(post.actions).toContain('create')
      expect(post.actions).toContain('update')
      expect(post.actions).toContain('delete')
      expect(post.events).toContain('created')
      expect(post.events).toContain('updated')
      expect(post.events).toContain('deleted')
    })

    it('handles irregular pluralization', () => {
      const person = inferNoun('Person')
      expect(person.singular).toBe('person')
      expect(person.plural).toBe('people')
    })
  })

  describe('Type and TypeMeta', () => {
    it('creates TypeMeta from type name', () => {
      const meta = Type('Post')

      expect(meta.name).toBe('Post')
      expect(meta.singular).toBe('post')
      expect(meta.plural).toBe('posts')
      expect(meta.slug).toBe('post')
      expect(meta.slugPlural).toBe('posts')
    })

    it('handles multi-word type names', () => {
      const meta = Type('BlogPost')

      expect(meta.singular).toBe('blog post')
      expect(meta.plural).toBe('blog posts')
      expect(meta.slug).toBe('blog-post')
      expect(meta.slugPlural).toBe('blog-posts')
    })

    it('provides verb-derived fields', () => {
      const meta = Type('Post')

      expect(meta.creator).toBe('creator')
      expect(meta.createdAt).toBe('createdAt')
      expect(meta.createdBy).toBe('createdBy')
      expect(meta.updatedAt).toBe('updatedAt')
      expect(meta.updatedBy).toBe('updatedBy')
    })

    it('provides event type names', () => {
      const meta = Type('Post')

      expect(meta.created).toBe('Post.created')
      expect(meta.updated).toBe('Post.updated')
      expect(meta.deleted).toBe('Post.deleted')
    })

    it('caches TypeMeta instances', () => {
      const meta1 = getTypeMeta('Post')
      const meta2 = getTypeMeta('Post')

      expect(meta1).toBe(meta2) // Same instance
    })

    it('creates different instances for different types', () => {
      const post = Type('Post')
      const author = Type('Author')

      expect(post).not.toBe(author)
      expect(post.name).toBe('Post')
      expect(author.name).toBe('Author')
    })
  })

  describe('System Schema', () => {
    it('defines ThingSchema with type relationship', () => {
      expect(ThingSchema).toBeDefined()
      expect(ThingSchema.type).toBe('Noun.things')
    })

    it('defines NounSchema with all required fields', () => {
      expect(NounSchema).toBeDefined()
      expect(NounSchema.name).toBe('string')
      expect(NounSchema.singular).toBe('string')
      expect(NounSchema.plural).toBe('string')
      expect(NounSchema.slug).toBe('string')
      expect(NounSchema.description).toBe('string?')
      expect(NounSchema.properties).toBe('json?')
      expect(NounSchema.relationships).toBe('json?')
      expect(NounSchema.actions).toBe('json?')
      expect(NounSchema.events).toBe('json?')
    })

    it('defines VerbSchema with conjugation fields', () => {
      expect(VerbSchema).toBeDefined()
      expect(VerbSchema.action).toBe('string')
      expect(VerbSchema.actor).toBe('string?')
      expect(VerbSchema.act).toBe('string?')
      expect(VerbSchema.activity).toBe('string?')
      expect(VerbSchema.result).toBe('string?')
      expect(VerbSchema.reverse).toBe('json?')
      expect(VerbSchema.inverse).toBe('string?')
    })

    it('defines EdgeSchema for relationship graph', () => {
      expect(EdgeSchema).toBeDefined()
      expect(EdgeSchema.from).toBe('string')
      expect(EdgeSchema.name).toBe('string')
      expect(EdgeSchema.to).toBe('string')
      expect(EdgeSchema.backref).toBe('string?')
      expect(EdgeSchema.cardinality).toBe('string')
    })

    it('combines all system types in SystemSchema', () => {
      expect(SystemSchema).toBeDefined()
      expect(SystemSchema.Thing).toBe(ThingSchema)
      expect(SystemSchema.Noun).toBe(NounSchema)
      expect(SystemSchema.Verb).toBe(VerbSchema)
      expect(SystemSchema.Edge).toBe(EdgeSchema)
    })
  })

  describe('createNounRecord', () => {
    it('creates noun record from type name', () => {
      const record = createNounRecord('Post')

      expect(record.name).toBe('Post')
      expect(record.singular).toBe('post')
      expect(record.plural).toBe('posts')
      expect(record.slug).toBe('post')
      expect(record.slugPlural).toBe('posts')
      expect(record.actions).toContain('create')
      expect(record.events).toContain('created')
    })

    it('creates noun record from multi-word type name', () => {
      const record = createNounRecord('BlogPost')

      expect(record.name).toBe('BlogPost')
      expect(record.singular).toBe('blog post')
      expect(record.plural).toBe('blog posts')
      expect(record.slug).toBe('blog-post')
    })

    it('includes properties from schema', () => {
      const schema = {
        title: 'string',
        content: 'markdown',
        published: 'boolean?',
      }
      const record = createNounRecord('Post', schema)

      expect(record.properties).toBeDefined()
      expect((record.properties as Record<string, unknown>).title).toEqual({
        type: 'string',
        optional: false,
        array: false,
      })
      expect((record.properties as Record<string, unknown>).published).toEqual({
        type: 'boolean',
        optional: true,
        array: false,
      })
    })

    it('overrides with custom noun definition', () => {
      const nounDef = {
        singular: 'article',
        plural: 'articles',
        description: 'A news article',
      }
      const record = createNounRecord('Post', undefined, nounDef)

      expect(record.singular).toBe('article')
      expect(record.plural).toBe('articles')
      expect(record.description).toBe('A news article')
    })
  })

  describe('createEdgeRecords', () => {
    it('creates edge records from relationships', () => {
      const schema: DatabaseSchema = {
        Post: {
          title: 'string',
          author: 'Author.posts',
        },
        Author: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const postEntity = parsed.entities.get('Post')!
      const edges = createEdgeRecords('Post', schema.Post, postEntity)

      expect(edges).toHaveLength(1)
      expect(edges[0]).toEqual({
        from: 'Post',
        name: 'author',
        to: 'Author',
        backref: 'posts',
        cardinality: 'many-to-one',
      })
    })

    it('creates many-to-many edges for array relationships', () => {
      const schema: DatabaseSchema = {
        Post: {
          tags: ['Tag.posts'],
        },
        Tag: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const postEntity = parsed.entities.get('Post')!
      const edges = createEdgeRecords('Post', schema.Post, postEntity)

      expect(edges).toHaveLength(1)
      expect(edges[0]?.cardinality).toBe('many-to-many')
    })

    it('creates edges without backref', () => {
      const schema: DatabaseSchema = {
        Post: {
          category: 'Category',
        },
        Category: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const postEntity = parsed.entities.get('Post')!
      const edges = createEdgeRecords('Post', schema.Post, postEntity)

      expect(edges).toHaveLength(1)
      expect(edges[0]?.backref).toBeUndefined()
      expect(edges[0]?.cardinality).toBe('one-to-one')
    })

    it('returns empty array for schemas without relationships', () => {
      const schema: DatabaseSchema = {
        User: {
          name: 'string',
          email: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const userEntity = parsed.entities.get('User')!
      const edges = createEdgeRecords('User', schema.User, userEntity)

      expect(edges).toHaveLength(0)
    })
  })

  describe('NL Query Infrastructure', () => {
    it('allows setting custom NL query generator', () => {
      const mockGenerator = async (prompt: string, context: unknown): Promise<NLQueryPlan> => ({
        types: ['Post'],
        interpretation: `Search for: ${prompt}`,
        confidence: 0.9,
      })

      // Should not throw
      expect(() => setNLQueryGenerator(mockGenerator)).not.toThrow()
    })
  })
})
