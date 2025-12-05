/**
 * Integration tests for ai-database
 *
 * Tests the full DB API with in-memory provider.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from './index.js'
import type { InferEntity } from './index.js'

describe('DB integration tests', () => {
  beforeEach(() => {
    // Use in-memory provider for testing
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    // Clean up
    setProvider(createMemoryProvider())
  })

  describe('basic CRUD operations', () => {
    const schema = {
      User: {
        name: 'string',
        email: 'string',
        age: 'number?',
      },
    } as const

    it('creates an entity without explicit ID', async () => {
      const { db } = DB(schema)

      const user = await db.User.create({
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(user.$id).toBeDefined()
      expect(user.$type).toBe('User')
      expect(user.name).toBe('John Doe')
      expect(user.email).toBe('john@example.com')
    })

    it('creates an entity with explicit ID', async () => {
      const { db } = DB(schema)

      const user = await db.User.create('john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(user.$id).toBe('john')
      expect(user.name).toBe('John Doe')
    })

    it('retrieves an entity by ID', async () => {
      const { db } = DB(schema)

      await db.User.create('john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      const user = await db.User.get('john')

      expect(user).not.toBeNull()
      expect(user?.$id).toBe('john')
      expect(user?.name).toBe('John Doe')
    })

    it('returns null for non-existent entity', async () => {
      const { db } = DB(schema)
      const user = await db.User.get('nonexistent')
      expect(user).toBeNull()
    })

    it('updates an entity', async () => {
      const { db } = DB(schema)

      await db.User.create('john', {
        name: 'John',
        email: 'john@example.com',
      })

      const updated = await db.User.update('john', {
        name: 'John Doe',
        age: 30,
      })

      expect(updated.name).toBe('John Doe')
      expect(updated.email).toBe('john@example.com')
      expect(updated.age).toBe(30)
    })

    it('upserts - creates if not exists', async () => {
      const { db } = DB(schema)

      const user = await db.User.upsert('john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(user.$id).toBe('john')
      expect(user.name).toBe('John Doe')
    })

    it('upserts - updates if exists', async () => {
      const { db } = DB(schema)

      await db.User.create('john', {
        name: 'John',
        email: 'john@example.com',
      })

      const updated = await db.User.upsert('john', {
        name: 'John Doe',
        email: 'john.doe@example.com',
      })

      expect(updated.name).toBe('John Doe')
      expect(updated.email).toBe('john.doe@example.com')
    })

    it('deletes an entity', async () => {
      const { db } = DB(schema)

      await db.User.create('john', {
        name: 'John',
        email: 'john@example.com',
      })

      const deleted = await db.User.delete('john')
      expect(deleted).toBe(true)

      const retrieved = await db.User.get('john')
      expect(retrieved).toBeNull()
    })

    it('returns false when deleting non-existent entity', async () => {
      const { db } = DB(schema)
      const deleted = await db.User.delete('nonexistent')
      expect(deleted).toBe(false)
    })
  })

  describe('list and query operations', () => {
    const schema = {
      User: {
        name: 'string',
        email: 'string',
        age: 'number',
        role: 'string',
      },
    } as const

    it('lists all entities', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John', email: 'john@example.com', age: 30, role: 'user' })
      await db.User.create('jane', { name: 'Jane', email: 'jane@example.com', age: 25, role: 'admin' })

      const users = await db.User.list()

      expect(users).toHaveLength(2)
      expect(users.map((u) => u.$id)).toContain('john')
      expect(users.map((u) => u.$id)).toContain('jane')
    })

    it('lists with where filter', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John', email: 'john@example.com', age: 30, role: 'admin' })
      await db.User.create('jane', { name: 'Jane', email: 'jane@example.com', age: 25, role: 'user' })

      const admins = await db.User.list({ where: { role: 'admin' } })

      expect(admins).toHaveLength(1)
      expect(admins[0]?.name).toBe('John')
    })

    it('lists with ordering', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John', email: 'john@example.com', age: 30, role: 'user' })
      await db.User.create('jane', { name: 'Jane', email: 'jane@example.com', age: 25, role: 'user' })
      await db.User.create('bob', { name: 'Bob', email: 'bob@example.com', age: 35, role: 'user' })

      const users = await db.User.list({ orderBy: 'age', order: 'asc' })

      expect(users[0]?.name).toBe('Jane')
      expect(users[1]?.name).toBe('John')
      expect(users[2]?.name).toBe('Bob')
    })

    it('lists with pagination', async () => {
      const { db } = DB(schema)

      await db.User.create('user1', { name: 'User 1', email: '1@example.com', age: 20, role: 'user' })
      await db.User.create('user2', { name: 'User 2', email: '2@example.com', age: 21, role: 'user' })
      await db.User.create('user3', { name: 'User 3', email: '3@example.com', age: 22, role: 'user' })

      const page1 = await db.User.list({ limit: 2, offset: 0 })
      const page2 = await db.User.list({ limit: 2, offset: 2 })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(1)
    })

    it('finds entities with criteria', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John', email: 'john@example.com', age: 30, role: 'admin' })
      await db.User.create('jane', { name: 'Jane', email: 'jane@example.com', age: 25, role: 'admin' })
      await db.User.create('bob', { name: 'Bob', email: 'bob@example.com', age: 35, role: 'user' })

      const admins = await db.User.find({ role: 'admin' })

      expect(admins).toHaveLength(2)
      expect(admins.map((u) => u.name)).toContain('John')
      expect(admins.map((u) => u.name)).toContain('Jane')
    })

    it('iterates over entities with forEach', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John', email: 'john@example.com', age: 30, role: 'user' })
      await db.User.create('jane', { name: 'Jane', email: 'jane@example.com', age: 25, role: 'user' })

      const names: string[] = []
      await db.User.forEach((user) => {
        names.push(user.name)
      })

      expect(names).toHaveLength(2)
      expect(names).toContain('John')
      expect(names).toContain('Jane')
    })

    it('iterates with options', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John', email: 'john@example.com', age: 30, role: 'admin' })
      await db.User.create('jane', { name: 'Jane', email: 'jane@example.com', age: 25, role: 'user' })

      const names: string[] = []
      await db.User.forEach({ where: { role: 'admin' } }, (user) => {
        names.push(user.name)
      })

      expect(names).toEqual(['John'])
    })
  })

  describe('search operations', () => {
    const schema = {
      Post: {
        title: 'string',
        content: 'markdown',
        category: 'string',
      },
    } as const

    it('searches entities', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'Introduction to TypeScript',
        content: 'Learn TypeScript basics',
        category: 'tutorial',
      })
      await db.Post.create('post2', {
        title: 'Advanced JavaScript',
        content: 'Deep dive into JavaScript',
        category: 'tutorial',
      })

      const results = await db.Post.search('TypeScript')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.title).toContain('TypeScript')
    })

    it('searches with options', async () => {
      const { db } = DB(schema)

      await db.Post.create('post1', {
        title: 'TypeScript Tutorial',
        content: 'Content about JavaScript',
        category: 'tutorial',
      })
      await db.Post.create('post2', {
        title: 'JavaScript Guide',
        content: 'Content about TypeScript',
        category: 'guide',
      })

      const results = await db.Post.search('TypeScript', {
        fields: ['title'],
      })

      expect(results).toHaveLength(1)
      expect(results[0]?.title).toBe('TypeScript Tutorial')
    })

    it('searches globally across all types', async () => {
      const schema = {
        Post: { title: 'string' },
        User: { name: 'string' },
      } as const

      const { db } = DB(schema)

      await db.Post.create('post1', { title: 'TypeScript Guide' })
      await db.User.create('user1', { name: 'TypeScript Expert' })

      const results = await db.search('TypeScript')

      expect(results.length).toBe(2)
    })
  })

  describe('relationships', () => {
    const schema = {
      Post: {
        title: 'string',
        content: 'markdown',
        author: 'Author.posts',
        tags: ['Tag.posts'],
      },
      Author: {
        name: 'string',
        email: 'string',
      },
      Tag: {
        name: 'string',
      },
    } as const

    it('creates entities with relations', async () => {
      const { db } = DB(schema)

      const author = await db.Author.create('john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      const post = await db.Post.create('post1', {
        title: 'Hello World',
        content: 'My first post',
        author: author.$id,
        tags: [],
      })

      // Verify the post was created with correct basic fields
      expect(post.$id).toBe('post1')
      expect(post.title).toBe('Hello World')
      expect(post.content).toBe('My first post')
    })

    it('queries related entities through provider', async () => {
      const { db } = DB(schema)
      const provider = createMemoryProvider()
      setProvider(provider)

      await db.Author.create('john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      await db.Post.create('post1', {
        title: 'Post 1',
        content: 'Content',
        author: 'john',
        tags: [],
      })

      await db.Post.create('post2', {
        title: 'Post 2',
        content: 'Content',
        author: 'john',
        tags: [],
      })

      // Create relationships
      await provider.relate('Author', 'john', 'posts', 'Post', 'post1')
      await provider.relate('Author', 'john', 'posts', 'Post', 'post2')

      const posts = await provider.related('Author', 'john', 'posts')
      expect(posts).toHaveLength(2)
    })

    it('handles many-to-many relationships', async () => {
      const { db } = DB(schema)
      const provider = createMemoryProvider()
      setProvider(provider)

      await db.Post.create('post1', {
        title: 'Post 1',
        content: 'Content',
        author: 'john',
        tags: [],
      })

      await db.Tag.create('ts', { name: 'TypeScript' })
      await db.Tag.create('js', { name: 'JavaScript' })

      await provider.relate('Post', 'post1', 'tags', 'Tag', 'ts')
      await provider.relate('Post', 'post1', 'tags', 'Tag', 'js')

      const tags = await provider.related('Post', 'post1', 'tags')
      expect(tags).toHaveLength(2)

      // Reverse relation
      await provider.relate('Tag', 'ts', 'posts', 'Post', 'post1')
      const posts = await provider.related('Tag', 'ts', 'posts')
      expect(posts).toHaveLength(1)
    })
  })

  describe('global methods', () => {
    const schema = {
      User: { name: 'string' },
      Post: { title: 'string' },
    } as const

    it('gets entity by URL', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      const user = await db.get('https://example.com/User/john')

      expect(user).toBeDefined()
    })

    it('gets entity by type/id path', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John' })

      const user = await db.get('User/john')

      expect(user).toBeDefined()
    })

    it('searches across all entity types', async () => {
      const { db } = DB(schema)

      await db.User.create('john', { name: 'John TypeScript' })
      await db.Post.create('post1', { title: 'TypeScript Guide' })

      const results = await db.search('TypeScript')

      expect(results.length).toBe(2)
    })
  })

  describe('type safety', () => {
    it('provides typed entity operations', () => {
      const schema = {
        User: {
          name: 'string',
          age: 'number',
        },
      } as const

      const { db } = DB(schema)

      // TypeScript should enforce these types at compile time
      expect(db.User).toBeDefined()
      expect(typeof db.User.get).toBe('function')
      expect(typeof db.User.list).toBe('function')
      expect(typeof db.User.create).toBe('function')
    })

    it('infers entity types correctly', () => {
      const schema = {
        Post: {
          title: 'string',
          views: 'number',
          author: 'Author.posts',
        },
        Author: {
          name: 'string',
        },
      } as const

      type Post = InferEntity<typeof schema, 'Post'>
      type Author = InferEntity<typeof schema, 'Author'>

      // Type assertions to verify inference
      const post: Post = {
        $id: '1',
        $type: 'Post',
        title: 'Hello',
        views: 100,
        author: {} as Author,
      }

      expect(post.$id).toBe('1')
    })
  })

  describe('complex scenarios', () => {
    const schema = {
      User: {
        name: 'string',
        email: 'string',
        profile: 'Profile.user?',
      },
      Profile: {
        bio: 'string',
        avatar: 'url?',
      },
      Post: {
        title: 'string',
        content: 'markdown',
        published: 'boolean',
        author: 'User.posts',
        tags: ['Tag.posts'],
      },
      Tag: {
        name: 'string',
        slug: 'string',
      },
    } as const

    it('handles complex multi-entity operations', async () => {
      const { db } = DB(schema)

      // Create user
      const user = await db.User.create('john', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      // Create profile
      const profile = await db.Profile.create('john-profile', {
        bio: 'Software developer',
      })

      // Create tags
      const tsTag = await db.Tag.create('typescript', {
        name: 'TypeScript',
        slug: 'typescript',
      })

      // Create post
      const post = await db.Post.create('post1', {
        title: 'Getting Started',
        content: '# Introduction',
        published: true,
        author: user.$id,
        tags: [],
      })

      expect(user.$id).toBe('john')
      expect(profile.$id).toBe('john-profile')
      expect(post.$id).toBe('post1')
      expect(tsTag.$id).toBe('typescript')
    })

    it('handles self-referential relations', async () => {
      const schema = {
        User: {
          name: 'string',
          manager: 'User.reports?',
        },
      } as const

      const { db } = DB(schema)
      const provider = createMemoryProvider()
      setProvider(provider)

      await db.User.create('alice', {
        name: 'Alice',
      })

      await db.User.create('bob', {
        name: 'Bob',
        manager: 'alice',
      })

      // Set up relation
      await provider.relate('User', 'alice', 'reports', 'User', 'bob')

      const reports = await provider.related('User', 'alice', 'reports')
      expect(reports).toHaveLength(1)
      expect(reports[0]?.name).toBe('Bob')
    })
  })

  describe('events API', () => {
    const schema = {
      User: { name: 'string' },
    } as const

    it('returns events API from DB', () => {
      const { db, events } = DB(schema)

      expect(events).toBeDefined()
      expect(typeof events.on).toBe('function')
      expect(typeof events.emit).toBe('function')
      expect(typeof events.list).toBe('function')
      expect(typeof events.replay).toBe('function')
    })
  })

  describe('actions API', () => {
    const schema = {
      User: { name: 'string' },
    } as const

    it('returns actions API from DB', () => {
      const { db, actions } = DB(schema)

      expect(actions).toBeDefined()
      expect(typeof actions.create).toBe('function')
      expect(typeof actions.get).toBe('function')
      expect(typeof actions.update).toBe('function')
      expect(typeof actions.list).toBe('function')
      expect(typeof actions.retry).toBe('function')
      expect(typeof actions.cancel).toBe('function')
    })

    it('creates and tracks actions', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        type: 'generate',
        data: { count: 10 },
        total: 10,
      })

      expect(action.id).toBeDefined()
      expect(action.type).toBe('generate')
      expect(action.status).toBe('pending')
      expect(action.total).toBe(10)

      const retrieved = await actions.get(action.id)
      expect(retrieved?.id).toBe(action.id)
    })

    it('updates action progress', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        type: 'generate',
        data: {},
        total: 10,
      })

      const updated = await actions.update(action.id, {
        status: 'active',
        progress: 5,
      })

      expect(updated.status).toBe('active')
      expect(updated.progress).toBe(5)
    })
  })

  describe('artifacts API', () => {
    const schema = {
      User: { name: 'string' },
    } as const

    it('returns artifacts API from DB', () => {
      const { db, artifacts } = DB(schema)

      expect(artifacts).toBeDefined()
      expect(typeof artifacts.get).toBe('function')
      expect(typeof artifacts.set).toBe('function')
      expect(typeof artifacts.delete).toBe('function')
      expect(typeof artifacts.list).toBe('function')
    })
  })

  describe('nouns API', () => {
    const schema = {
      BlogPost: { title: 'string' },
      Author: { name: 'string' },
    } as const

    it('returns nouns API from DB', () => {
      const { nouns } = DB(schema)

      expect(nouns).toBeDefined()
      expect(typeof nouns.get).toBe('function')
      expect(typeof nouns.list).toBe('function')
      expect(typeof nouns.define).toBe('function')
    })

    it('lists inferred nouns from schema', async () => {
      const { nouns } = DB(schema)

      const allNouns = await nouns.list()
      expect(allNouns.length).toBe(2)
    })

    it('gets noun definition by name', async () => {
      const { nouns } = DB(schema)

      const blogPost = await nouns.get('BlogPost')
      expect(blogPost).toBeDefined()
      expect(blogPost?.singular).toBe('blog post')
      expect(blogPost?.plural).toBe('blog posts')
    })
  })

  describe('verbs API', () => {
    const schema = {
      User: { name: 'string' },
    } as const

    it('returns verbs API from DB', () => {
      const { verbs } = DB(schema)

      expect(verbs).toBeDefined()
      expect(typeof verbs.get).toBe('function')
      expect(typeof verbs.list).toBe('function')
      expect(typeof verbs.define).toBe('function')
      expect(typeof verbs.conjugate).toBe('function')
    })

    it('gets standard verb definitions', () => {
      const { verbs } = DB(schema)

      const create = verbs.get('create')
      expect(create).toBeDefined()
      expect(create?.action).toBe('create')
      expect(create?.actor).toBe('creator')
    })

    it('conjugates custom verbs', () => {
      const { verbs } = DB(schema)

      const publish = verbs.conjugate('publish')
      expect(publish.action).toBe('publish')
      expect(publish.actor).toBe('publisher')
      expect(publish.activity).toBe('publishing')
    })
  })
})

describe('dual API syntax', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  const schema = {
    User: { name: 'string', email: 'string' },
    Post: { title: 'string', author: 'User.posts' },
  } as const

  it('supports direct usage - db.Entity.method()', async () => {
    // Direct usage: const db = DB(schema)
    const db = DB(schema)

    // Entity operations work directly
    const user = await db.User.create('john', { name: 'John', email: 'john@example.com' })
    expect(user.name).toBe('John')

    // Get also works
    const retrieved = await db.User.get('john')
    expect(retrieved?.name).toBe('John')
  })

  it('supports direct access to events/actions on db object', () => {
    // Direct usage: const db = DB(schema)
    const db = DB(schema)

    // APIs are available directly on db
    expect(db.events).toBeDefined()
    expect(typeof db.events.on).toBe('function')
    expect(typeof db.events.emit).toBe('function')

    expect(db.actions).toBeDefined()
    expect(typeof db.actions.create).toBe('function')

    expect(db.artifacts).toBeDefined()
    expect(db.nouns).toBeDefined()
    expect(db.verbs).toBeDefined()
  })

  it('supports destructured usage - const { db, events } = DB()', async () => {
    // Destructured usage
    const { db, events, actions, artifacts, nouns, verbs } = DB(schema)

    // Entity operations work on db
    const user = await db.User.create('jane', { name: 'Jane', email: 'jane@example.com' })
    expect(user.name).toBe('Jane')

    // Separate API objects work
    expect(typeof events.on).toBe('function')
    expect(typeof actions.create).toBe('function')
    expect(typeof artifacts.get).toBe('function')
    expect(typeof nouns.get).toBe('function')
    expect(typeof verbs.get).toBe('function')
  })

  it('both syntaxes work with same schema', async () => {
    // Can use both syntaxes interchangeably
    const result = DB(schema)

    // Direct usage
    await result.User.create('user1', { name: 'User 1', email: 'u1@example.com' })

    // Destructured usage from same result
    const { db, events, actions } = result
    await db.User.create('user2', { name: 'User 2', email: 'u2@example.com' })

    // Both users exist
    const users = await result.User.list()
    expect(users).toHaveLength(2)

    // Can also use db.list()
    const users2 = await db.User.list()
    expect(users2).toHaveLength(2)
  })

  it('db self-reference allows clean destructuring', () => {
    const result = DB(schema)

    // result.db is same entity operations as result itself
    expect(result.db.User).toBeDefined()
    expect(result.db.$schema).toBe(result.$schema)

    // But result.db doesn't have events/actions (clean entity ops)
    // Actually it does since db is a self-reference, but semantically
    // when you destructure { db } you get clean entity ops
  })
})

describe('provider resolution', () => {
  it('uses memory provider when set explicitly', async () => {
    const provider = createMemoryProvider()
    setProvider(provider)

    const schema = {
      User: { name: 'string' },
    } as const

    const { db } = DB(schema)

    await db.User.create('test', { name: 'Test User' })

    const stats = provider.stats()
    expect(stats.entities).toBe(1)
  })

  it('isolates data between provider instances', async () => {
    const provider1 = createMemoryProvider()
    const provider2 = createMemoryProvider()

    setProvider(provider1)
    const schema = { User: { name: 'string' } } as const
    const { db: db1 } = DB(schema)
    await db1.User.create('john', { name: 'John' })

    setProvider(provider2)
    const { db: db2 } = DB(schema)
    const user = await db2.User.get('john')

    expect(user).toBeNull()
  })
})
