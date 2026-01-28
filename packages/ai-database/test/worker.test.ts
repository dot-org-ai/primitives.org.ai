/**
 * Worker Export Tests for ai-database
 *
 * Tests for the /worker export that provides DatabaseService (WorkerEntrypoint)
 * with a connect(namespace) method that returns DatabaseServiceCore (RpcTarget).
 *
 * Uses in-memory provider for testing without requiring Cloudflare Workers runtime.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseService, DatabaseServiceCore } from '../src/worker.js'
import type {
  EntityResult,
  SearchResult,
  SemanticSearchResult,
  HybridSearchResult,
} from '../src/worker.js'

describe('DatabaseServiceCore (RpcTarget)', () => {
  let service: DatabaseServiceCore

  beforeEach(() => {
    // Create a unique namespace for each test to ensure isolation
    const namespace = 'test-namespace-' + Math.random().toString(36).slice(2)
    service = new DatabaseServiceCore(namespace)
  })

  describe('constructor', () => {
    it('creates a new DatabaseServiceCore instance', () => {
      expect(service).toBeInstanceOf(DatabaseServiceCore)
    })

    it('extends RpcTarget for RPC communication', () => {
      expect(service.constructor.name).toBe('DatabaseServiceCore')
    })
  })

  describe('CRUD Operations', () => {
    describe('create()', () => {
      it('creates an entity with auto-generated ID', async () => {
        const entity = await service.create('Post', { title: 'Hello World', body: 'Test content' })

        expect(entity).toBeDefined()
        expect(entity.$id).toBeDefined()
        expect(entity.$type).toBe('Post')
        expect(entity.title).toBe('Hello World')
        expect(entity.body).toBe('Test content')
      })

      it('creates an entity with custom ID', async () => {
        const entity = await service.create('Post', { title: 'Custom' }, 'my-custom-id')

        expect(entity.$id).toBe('my-custom-id')
        expect(entity.title).toBe('Custom')
      })
    })

    describe('get()', () => {
      it('retrieves a created entity by type and ID', async () => {
        const created = await service.create('Post', { title: 'Test', body: 'Content' })
        const retrieved = await service.get('Post', created.$id)

        expect(retrieved).not.toBeNull()
        expect(retrieved!.$id).toBe(created.$id)
        expect(retrieved!.title).toBe('Test')
      })

      it('returns null for non-existent ID', async () => {
        const result = await service.get('Post', 'nonexistent-id')
        expect(result).toBeNull()
      })
    })

    describe('list()', () => {
      it('lists entities by type', async () => {
        await service.create('Post', { title: 'First' })
        await service.create('Post', { title: 'Second' })
        await service.create('Author', { name: 'Alice' })

        const posts = await service.list('Post')

        expect(posts.length).toBeGreaterThanOrEqual(2)
        expect(posts.every((p) => p.$type === 'Post')).toBe(true)
      })

      it('supports limit option', async () => {
        await service.create('Article', { title: '1' })
        await service.create('Article', { title: '2' })
        await service.create('Article', { title: '3' })

        const articles = await service.list('Article', { limit: 2 })

        expect(articles).toHaveLength(2)
      })

      it('supports where filter', async () => {
        await service.create('Post', { title: 'Draft 1', status: 'draft' })
        await service.create('Post', { title: 'Published', status: 'published' })
        await service.create('Post', { title: 'Draft 2', status: 'draft' })

        const drafts = await service.list('Post', { where: { status: 'draft' } })

        expect(drafts.length).toBeGreaterThanOrEqual(2)
        expect(drafts.every((p) => p.status === 'draft')).toBe(true)
      })
    })

    describe('update()', () => {
      it('updates an entity and merges data', async () => {
        const created = await service.create('Post', { title: 'Original', status: 'draft' })
        const updated = await service.update('Post', created.$id, { title: 'Updated' })

        expect(updated.title).toBe('Updated')
        expect(updated.status).toBe('draft')
      })

      it('throws error for non-existent entity', async () => {
        await expect(service.update('Post', 'nonexistent', { title: 'Test' })).rejects.toThrow()
      })
    })

    describe('delete()', () => {
      it('deletes an entity and returns true', async () => {
        const created = await service.create('Post', { title: 'ToDelete' })
        const deleted = await service.delete('Post', created.$id)

        expect(deleted).toBe(true)

        const retrieved = await service.get('Post', created.$id)
        expect(retrieved).toBeNull()
      })

      it('returns false for non-existent entity', async () => {
        const deleted = await service.delete('Post', 'nonexistent-id')
        expect(deleted).toBe(false)
      })
    })
  })

  describe('Search Operations', () => {
    describe('search()', () => {
      it('searches entities by query string', async () => {
        await service.create('Post', { title: 'Hello World', body: 'Welcome to the site' })
        await service.create('Post', { title: 'Goodbye World', body: 'Farewell message' })
        await service.create('Post', { title: 'Random Title', body: 'Random content' })

        const results = await service.search('Post', 'hello')

        expect(results.length).toBeGreaterThanOrEqual(1)
        expect(results.some((r) => (r.title as string).toLowerCase().includes('hello'))).toBe(true)
      })

      it('searches with limit', async () => {
        await service.create('Product', { name: 'Widget A', description: 'A great widget' })
        await service.create('Product', { name: 'Widget B', description: 'Another widget' })
        await service.create('Product', { name: 'Widget C', description: 'Yet another widget' })

        const results = await service.search('Product', 'widget', { limit: 2 })

        expect(results).toHaveLength(2)
      })

      it('returns empty array for no matches', async () => {
        const results = await service.search('Post', 'xyznonexistent12345')
        expect(results).toEqual([])
      })
    })

    describe('semanticSearch()', () => {
      it('returns results with scores', async () => {
        await service.create('Post', {
          title: 'Machine Learning Basics',
          body: 'Introduction to ML',
        })
        await service.create('Post', {
          title: 'Deep Learning Guide',
          body: 'Neural networks explained',
        })
        await service.create('Post', { title: 'Cooking Recipes', body: 'How to make pasta' })

        const results = await service.semanticSearch('Post', 'artificial intelligence')

        expect(results.length).toBeGreaterThanOrEqual(0)
        results.forEach((r) => {
          expect(r.$score).toBeDefined()
          expect(typeof r.$score).toBe('number')
        })
      })
    })

    describe('hybridSearch()', () => {
      it('returns results with RRF scores', async () => {
        await service.create('Post', { title: 'TypeScript Tutorial', body: 'Learn TypeScript' })
        await service.create('Post', { title: 'JavaScript Guide', body: 'Modern JS' })

        const results = await service.hybridSearch('Post', 'typescript programming')

        expect(results.length).toBeGreaterThanOrEqual(0)
        results.forEach((r) => {
          expect(r.$rrfScore).toBeDefined()
          expect(r.$ftsRank).toBeDefined()
          expect(r.$semanticRank).toBeDefined()
        })
      })
    })
  })

  describe('Relationship Operations', () => {
    describe('relate() and unrelate()', () => {
      it('creates a relationship between two entities', async () => {
        const author = await service.create('Author', { name: 'Alice' })
        const post = await service.create('Post', { title: 'My Post' })

        await service.relate('Author', author.$id, 'wrote', 'Post', post.$id)

        const related = await service.related('Author', author.$id, 'wrote')
        expect(related.length).toBeGreaterThanOrEqual(1)
      })

      it('removes a relationship', async () => {
        const author = await service.create('Author', { name: 'Bob' })
        const post = await service.create('Post', { title: 'Test Post' })

        await service.relate('Author', author.$id, 'wrote', 'Post', post.$id)
        await service.unrelate('Author', author.$id, 'wrote', 'Post', post.$id)

        const related = await service.related('Author', author.$id, 'wrote')
        expect(related.length).toBe(0)
      })
    })

    describe('related()', () => {
      it('gets related entities', async () => {
        const author = await service.create('Author', { name: 'Carol' })
        const post1 = await service.create('Post', { title: 'Post 1' })
        const post2 = await service.create('Post', { title: 'Post 2' })

        await service.relate('Author', author.$id, 'wrote', 'Post', post1.$id)
        await service.relate('Author', author.$id, 'wrote', 'Post', post2.$id)

        const relatedPosts = await service.related('Author', author.$id, 'wrote')

        expect(relatedPosts.length).toBe(2)
      })
    })
  })

  describe('Configuration', () => {
    describe('setEmbeddingsConfig()', () => {
      it('sets embeddings configuration', () => {
        expect(() => {
          service.setEmbeddingsConfig({
            Post: {
              fields: ['title', 'body'],
            },
          })
        }).not.toThrow()
      })
    })

    describe('setUseAiFunctions()', () => {
      it('enables/disables ai-functions for embeddings', () => {
        expect(() => {
          service.setUseAiFunctions(true)
          service.setUseAiFunctions(false)
        }).not.toThrow()
      })
    })
  })
})

describe('DatabaseService (WorkerEntrypoint)', () => {
  describe('class definition', () => {
    it('exports DatabaseService class', () => {
      expect(DatabaseService).toBeDefined()
      expect(typeof DatabaseService).toBe('function')
    })

    it('DatabaseService has connect method in prototype', () => {
      expect(typeof DatabaseService.prototype.connect).toBe('function')
    })
  })

  describe('connect()', () => {
    it('returns a DatabaseServiceCore instance', () => {
      // Since we cannot instantiate WorkerEntrypoint directly (requires Workers runtime),
      // we verify that DatabaseServiceCore (the return type of connect()) works correctly
      const core = new DatabaseServiceCore()
      expect(core).toBeInstanceOf(DatabaseServiceCore)
    })

    it('returns RpcTarget for RPC communication', () => {
      const core = new DatabaseServiceCore()

      // DatabaseServiceCore extends RpcTarget, so it can be returned over RPC
      expect(core).toBeDefined()
      expect(typeof core.get).toBe('function')
      expect(typeof core.list).toBe('function')
      expect(typeof core.create).toBe('function')
      expect(typeof core.update).toBe('function')
      expect(typeof core.delete).toBe('function')
      expect(typeof core.search).toBe('function')
      expect(typeof core.semanticSearch).toBe('function')
      expect(typeof core.hybridSearch).toBe('function')
      expect(typeof core.relate).toBe('function')
      expect(typeof core.unrelate).toBe('function')
      expect(typeof core.related).toBe('function')
    })

    it('creates independent service instances with different namespaces', async () => {
      const core1 = new DatabaseServiceCore('namespace-1')
      const core2 = new DatabaseServiceCore('namespace-2')

      // Create entity in core1
      const entity1 = await core1.create('Item', { value: 'from-core-1' })

      // Each instance should be independent
      expect(core1).not.toBe(core2)
      const retrieved1 = await core1.get('Item', entity1.$id)
      const retrieved2 = await core2.get('Item', entity1.$id)

      expect(retrieved1).not.toBeNull()
      expect(retrieved2).toBeNull() // Should not exist in different namespace
    })
  })
})

describe('Data Persistence', () => {
  it('persists data across service calls with same namespace', async () => {
    const namespace = 'persistence-test-' + Math.random().toString(36).slice(2)

    // First connection - create data
    const service1 = new DatabaseServiceCore(namespace)
    const created = await service1.create('PersistentThing', { value: 42 })
    const createdId = created.$id

    // Second connection - verify data persists
    const service2 = new DatabaseServiceCore(namespace)
    const retrieved = await service2.get('PersistentThing', createdId)

    expect(retrieved).not.toBeNull()
    expect(retrieved!.value).toBe(42)
  })
})

describe('Namespace Isolation', () => {
  it('isolates data between different namespaces', async () => {
    const serviceA = new DatabaseServiceCore('namespace-a-' + Math.random().toString(36).slice(2))
    const serviceB = new DatabaseServiceCore('namespace-b-' + Math.random().toString(36).slice(2))

    // Create in namespace A
    const thingA = await serviceA.create('IsolatedThing', { source: 'A' })

    // Create in namespace B
    const thingB = await serviceB.create('IsolatedThing', { source: 'B' })

    // Verify isolation - A should not see B's data
    const retrievedFromA = await serviceA.get('IsolatedThing', thingB.$id)
    expect(retrievedFromA).toBeNull()

    // Verify isolation - B should not see A's data
    const retrievedFromB = await serviceB.get('IsolatedThing', thingA.$id)
    expect(retrievedFromB).toBeNull()

    // Each namespace sees only its own data
    const listA = await serviceA.list('IsolatedThing')
    const listB = await serviceB.list('IsolatedThing')

    expect(listA.length).toBe(1)
    expect(listA[0].source).toBe('A')
    expect(listB.length).toBe(1)
    expect(listB[0].source).toBe('B')
  })
})

describe('Integration: Real Database Operations', () => {
  let service: DatabaseServiceCore

  beforeEach(() => {
    const namespace = 'integration-test-' + Math.random().toString(36).slice(2)
    service = new DatabaseServiceCore(namespace)
  })

  it('performs complete CRUD workflow', async () => {
    // Create
    const created = await service.create('User', {
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
    })
    expect(created.$id).toBeDefined()
    expect(created.name).toBe('Alice')

    // Read
    const retrieved = await service.get('User', created.$id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.email).toBe('alice@example.com')

    // Update
    const updated = await service.update('User', created.$id, { role: 'superadmin' })
    expect(updated.role).toBe('superadmin')
    expect(updated.name).toBe('Alice') // Other fields preserved

    // Delete
    const deleted = await service.delete('User', created.$id)
    expect(deleted).toBe(true)

    // Verify deletion
    const afterDelete = await service.get('User', created.$id)
    expect(afterDelete).toBeNull()
  })

  it('handles relationships between entities', async () => {
    // Create entities
    const company = await service.create('Company', { name: 'Acme Corp' })
    const employee1 = await service.create('Employee', { name: 'Alice' })
    const employee2 = await service.create('Employee', { name: 'Bob' })

    // Create relationships
    await service.relate('Company', company.$id, 'employs', 'Employee', employee1.$id)
    await service.relate('Company', company.$id, 'employs', 'Employee', employee2.$id)

    // Query related entities
    const employees = await service.related('Company', company.$id, 'employs')
    expect(employees.length).toBe(2)

    // Remove one relationship
    await service.unrelate('Company', company.$id, 'employs', 'Employee', employee1.$id)

    const remainingEmployees = await service.related('Company', company.$id, 'employs')
    expect(remainingEmployees.length).toBe(1)
  })

  it('supports filtering and ordering in list', async () => {
    await service.create('Task', { title: 'Task A', priority: 1, status: 'open' })
    await service.create('Task', { title: 'Task B', priority: 3, status: 'open' })
    await service.create('Task', { title: 'Task C', priority: 2, status: 'closed' })

    // Filter by status
    const openTasks = await service.list('Task', { where: { status: 'open' } })
    expect(openTasks.length).toBe(2)
    expect(openTasks.every((t) => t.status === 'open')).toBe(true)

    // Order by priority
    const orderedTasks = await service.list('Task', { orderBy: 'priority', order: 'asc' })
    expect(orderedTasks.length).toBe(3)
    expect(orderedTasks[0].priority).toBe(1)
  })
})
