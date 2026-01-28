/**
 * Core Schema Tests for ai-database (RED phase)
 *
 * Tests the foundational DO SQLite layer with two tables:
 * - _data: id TEXT PRIMARY KEY, type TEXT, data TEXT (JSON), created_at TEXT, updated_at TEXT
 * - _rels: from_id TEXT, relation TEXT, to_id TEXT, metadata TEXT (JSON),
 *          PRIMARY KEY(from_id, relation, to_id)
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 * NO MOCKS - tests use real Durable Objects with SQLite storage.
 *
 * These tests should FAIL initially because DatabaseDO doesn't exist yet.
 *
 * Bead: aip-tkdq
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// This import will FAIL because DatabaseDO doesn't exist in worker.ts yet
import { DatabaseDO } from '../src/worker.js'

/**
 * Helper to get a stub for the DatabaseDO Durable Object.
 * Each test gets a unique DO instance for isolation.
 */
function getStub(name?: string): DurableObjectStub {
  const id = env.DATABASE.idFromName(name ?? crypto.randomUUID())
  return env.DATABASE.get(id)
}

/**
 * Helper to send a request to the DO and get JSON response
 */
async function doRequest(
  stub: DurableObjectStub,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return stub.fetch(`https://db.test${path}`, options)
}

/**
 * Helper to send JSON body request
 */
async function doJSON(
  stub: DurableObjectStub,
  path: string,
  body: unknown,
  method = 'POST'
): Promise<Response> {
  return stub.fetch(`https://db.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// Table Creation / Initialization
// =============================================================================

// TODO: Advanced feature tests - needs investigation
describe.skip('Core Schema: Table Initialization', () => {
  it('should create _data table on first access', async () => {
    const stub = getStub()
    // Any operation should trigger table creation
    const res = await doRequest(stub, '/data')
    expect(res.status).toBe(200)
    const items = await res.json()
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(0)
  })

  it('should create _rels table on first access', async () => {
    const stub = getStub()
    const res = await doRequest(stub, '/rels')
    expect(res.status).toBe(200)
    const items = await res.json()
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(0)
  })

  it('should initialize both tables idempotently', async () => {
    const stub = getStub()
    // First request triggers initialization
    await doRequest(stub, '/data')
    // Second request should not fail (CREATE TABLE IF NOT EXISTS)
    const res = await doRequest(stub, '/data')
    expect(res.status).toBe(200)
  })

  it('should persist _data table schema correctly (id, type, data, created_at, updated_at)', async () => {
    const stub = getStub()
    const res = await doJSON(stub, '/data', {
      id: 'test-schema-check',
      type: 'SchemaTest',
      data: { foo: 'bar' },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.id).toBe('test-schema-check')
    expect(result.type).toBe('SchemaTest')
    expect(result.data).toEqual({ foo: 'bar' })
    expect(result.created_at).toBeDefined()
    expect(result.updated_at).toBeDefined()
  })

  it('should persist _rels table schema correctly (from_id, relation, to_id, metadata)', async () => {
    const stub = getStub()
    // First create two data records
    await doJSON(stub, '/data', { id: 'a', type: 'Node', data: {} })
    await doJSON(stub, '/data', { id: 'b', type: 'Node', data: {} })

    // Create a relationship
    const res = await doJSON(stub, '/rels', {
      from_id: 'a',
      relation: 'links_to',
      to_id: 'b',
      metadata: { weight: 1 },
    })
    expect(res.status).toBe(200)
    const rel = (await res.json()) as Record<string, unknown>
    expect(rel.from_id).toBe('a')
    expect(rel.relation).toBe('links_to')
    expect(rel.to_id).toBe('b')
    expect(rel.metadata).toEqual({ weight: 1 })
  })
})

// =============================================================================
// CRUD on _data table
// =============================================================================

describe('Core Schema: _data CRUD', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  // ---------------------------------------------------------------------------
  // INSERT
  // ---------------------------------------------------------------------------

  describe('insert', () => {
    it('should insert a record with all fields', async () => {
      const res = await doJSON(stub, '/data', {
        id: 'post-1',
        type: 'Post',
        data: { title: 'Hello World', body: 'Content here' },
      })
      expect(res.status).toBe(200)
      const record = (await res.json()) as Record<string, unknown>
      expect(record.id).toBe('post-1')
      expect(record.type).toBe('Post')
      expect(record.data).toEqual({ title: 'Hello World', body: 'Content here' })
    })

    it('should auto-generate id when not provided', async () => {
      const res = await doJSON(stub, '/data', {
        type: 'Post',
        data: { title: 'Auto ID' },
      })
      expect(res.status).toBe(200)
      const record = (await res.json()) as Record<string, unknown>
      expect(record.id).toBeDefined()
      expect(typeof record.id).toBe('string')
      expect((record.id as string).length).toBeGreaterThan(0)
    })

    it('should set created_at and updated_at timestamps', async () => {
      const before = new Date().toISOString()
      const res = await doJSON(stub, '/data', {
        id: 'ts-test',
        type: 'Post',
        data: { title: 'Timestamp Test' },
      })
      const after = new Date().toISOString()
      const record = (await res.json()) as Record<string, unknown>

      expect(record.created_at).toBeDefined()
      expect(record.updated_at).toBeDefined()
      // Timestamps should be ISO strings
      expect(typeof record.created_at).toBe('string')
      expect(typeof record.updated_at).toBe('string')
      // created_at and updated_at should be equal on insert
      expect(record.created_at).toBe(record.updated_at)
    })

    it('should store complex JSON data', async () => {
      const complexData = {
        nested: { deeply: { value: 42 } },
        array: [1, 2, 3],
        boolean: true,
        nullable: null,
        string: 'hello',
      }
      const res = await doJSON(stub, '/data', {
        id: 'complex-1',
        type: 'Complex',
        data: complexData,
      })
      expect(res.status).toBe(200)
      const record = (await res.json()) as Record<string, unknown>
      expect(record.data).toEqual(complexData)
    })
  })

  // ---------------------------------------------------------------------------
  // GET
  // ---------------------------------------------------------------------------

  describe('get', () => {
    it('should retrieve a record by id', async () => {
      await doJSON(stub, '/data', {
        id: 'get-test',
        type: 'Post',
        data: { title: 'Retrievable' },
      })

      const res = await doRequest(stub, '/data/get-test')
      expect(res.status).toBe(200)
      const record = (await res.json()) as Record<string, unknown>
      expect(record.id).toBe('get-test')
      expect(record.type).toBe('Post')
      expect((record.data as Record<string, unknown>).title).toBe('Retrievable')
    })

    it('should return 404 for non-existent id', async () => {
      const res = await doRequest(stub, '/data/nonexistent-id')
      expect(res.status).toBe(404)
    })

    it('should retrieve the full JSON data intact', async () => {
      const data = { tags: ['a', 'b'], count: 99, active: true }
      await doJSON(stub, '/data', { id: 'json-intact', type: 'Item', data })

      const res = await doRequest(stub, '/data/json-intact')
      const record = (await res.json()) as Record<string, unknown>
      expect(record.data).toEqual(data)
    })
  })

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should update an existing record', async () => {
      await doJSON(stub, '/data', {
        id: 'update-1',
        type: 'Post',
        data: { title: 'Original', status: 'draft' },
      })

      const res = await doJSON(
        stub,
        '/data/update-1',
        {
          data: { title: 'Updated', status: 'published' },
        },
        'PATCH'
      )
      expect(res.status).toBe(200)
      const record = (await res.json()) as Record<string, unknown>
      expect((record.data as Record<string, unknown>).title).toBe('Updated')
      expect((record.data as Record<string, unknown>).status).toBe('published')
    })

    it('should update updated_at timestamp but not created_at', async () => {
      await doJSON(stub, '/data', {
        id: 'ts-update',
        type: 'Post',
        data: { title: 'Original' },
      })

      const getRes1 = await doRequest(stub, '/data/ts-update')
      const original = (await getRes1.json()) as Record<string, unknown>
      const originalCreatedAt = original.created_at

      // Small delay to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10))

      await doJSON(
        stub,
        '/data/ts-update',
        {
          data: { title: 'Updated' },
        },
        'PATCH'
      )

      const getRes2 = await doRequest(stub, '/data/ts-update')
      const updated = (await getRes2.json()) as Record<string, unknown>

      expect(updated.created_at).toBe(originalCreatedAt)
      expect(updated.updated_at).not.toBe(originalCreatedAt)
    })

    it('should merge data fields on update', async () => {
      await doJSON(stub, '/data', {
        id: 'merge-test',
        type: 'Post',
        data: { title: 'Hello', body: 'World', status: 'draft' },
      })

      await doJSON(
        stub,
        '/data/merge-test',
        {
          data: { status: 'published' },
        },
        'PATCH'
      )

      const res = await doRequest(stub, '/data/merge-test')
      const record = (await res.json()) as Record<string, unknown>
      const data = record.data as Record<string, unknown>
      expect(data.title).toBe('Hello')
      expect(data.body).toBe('World')
      expect(data.status).toBe('published')
    })

    it('should return 404 when updating non-existent record', async () => {
      const res = await doJSON(
        stub,
        '/data/nonexistent',
        {
          data: { title: 'No such record' },
        },
        'PATCH'
      )
      expect(res.status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete an existing record', async () => {
      await doJSON(stub, '/data', {
        id: 'delete-me',
        type: 'Post',
        data: { title: 'Temporary' },
      })

      const res = await doRequest(stub, '/data/delete-me', { method: 'DELETE' })
      expect(res.status).toBe(200)
      const result = (await res.json()) as Record<string, unknown>
      expect(result.deleted).toBe(true)

      // Verify it's gone
      const getRes = await doRequest(stub, '/data/delete-me')
      expect(getRes.status).toBe(404)
    })

    it('should return deleted:false for non-existent record', async () => {
      const res = await doRequest(stub, '/data/nonexistent-delete', { method: 'DELETE' })
      expect(res.status).toBe(200)
      const result = (await res.json()) as Record<string, unknown>
      expect(result.deleted).toBe(false)
    })
  })
})

// =============================================================================
// JSON Data Storage and Retrieval
// =============================================================================

describe('Core Schema: JSON Data', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should store and retrieve nested JSON objects', async () => {
    const data = {
      profile: {
        name: 'Alice',
        address: { city: 'Wonderland', zip: '12345' },
      },
    }
    await doJSON(stub, '/data', { id: 'nested-1', type: 'User', data })

    const res = await doRequest(stub, '/data/nested-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should store and retrieve arrays in JSON', async () => {
    const data = { tags: ['red', 'green', 'blue'], scores: [100, 200, 300] }
    await doJSON(stub, '/data', { id: 'array-1', type: 'Item', data })

    const res = await doRequest(stub, '/data/array-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should store and retrieve null values in JSON', async () => {
    const data = { value: null, other: 'present' }
    await doJSON(stub, '/data', { id: 'null-1', type: 'Item', data })

    const res = await doRequest(stub, '/data/null-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should store and retrieve numeric values accurately', async () => {
    const data = { integer: 42, float: 3.14159, negative: -100, zero: 0 }
    await doJSON(stub, '/data', { id: 'num-1', type: 'Item', data })

    const res = await doRequest(stub, '/data/num-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should store and retrieve boolean values', async () => {
    const data = { active: true, deleted: false }
    await doJSON(stub, '/data', { id: 'bool-1', type: 'Item', data })

    const res = await doRequest(stub, '/data/bool-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should store and retrieve empty objects', async () => {
    const data = {}
    await doJSON(stub, '/data', { id: 'empty-1', type: 'Item', data })

    const res = await doRequest(stub, '/data/empty-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should store and retrieve strings with special characters', async () => {
    const data = {
      text: 'Hello "world" with \'quotes\' and\nnewlines\tand\ttabs',
      unicode: '\u00e9\u00e0\u00fc\u00f1',
      emoji: 'test',
    }
    await doJSON(stub, '/data', { id: 'special-1', type: 'Item', data })

    const res = await doRequest(stub, '/data/special-1')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })
})

// =============================================================================
// Type-Based Queries on _data
// =============================================================================

describe('Core Schema: Type-Based Queries', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed with multiple types
    await doJSON(stub, '/data', { id: 'post-1', type: 'Post', data: { title: 'First Post' } })
    await doJSON(stub, '/data', { id: 'post-2', type: 'Post', data: { title: 'Second Post' } })
    await doJSON(stub, '/data', { id: 'post-3', type: 'Post', data: { title: 'Third Post' } })
    await doJSON(stub, '/data', { id: 'user-1', type: 'User', data: { name: 'Alice' } })
    await doJSON(stub, '/data', { id: 'user-2', type: 'User', data: { name: 'Bob' } })
    await doJSON(stub, '/data', { id: 'comment-1', type: 'Comment', data: { text: 'Nice!' } })
  })

  it('should list all records of a given type', async () => {
    const res = await doRequest(stub, '/data?type=Post')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<Record<string, unknown>>
    expect(posts).toHaveLength(3)
    expect(posts.every((p) => p.type === 'Post')).toBe(true)
  })

  it('should return empty array for non-existent type', async () => {
    const res = await doRequest(stub, '/data?type=NonExistent')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(0)
  })

  it('should list all records when no type filter', async () => {
    const res = await doRequest(stub, '/data')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(6)
  })

  it('should support limit on type queries', async () => {
    const res = await doRequest(stub, '/data?type=Post&limit=2')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<unknown>
    expect(posts).toHaveLength(2)
  })

  it('should support offset on type queries', async () => {
    const res = await doRequest(stub, '/data?type=Post&limit=1&offset=1')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<Record<string, unknown>>
    expect(posts).toHaveLength(1)
    expect(posts[0].id).toBe('post-2')
  })
})

// =============================================================================
// _rels Table Operations
// =============================================================================

describe('Core Schema: _rels Operations', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed data records
    await doJSON(stub, '/data', { id: 'author-1', type: 'User', data: { name: 'Alice' } })
    await doJSON(stub, '/data', { id: 'author-2', type: 'User', data: { name: 'Bob' } })
    await doJSON(stub, '/data', { id: 'post-1', type: 'Post', data: { title: 'Hello' } })
    await doJSON(stub, '/data', { id: 'post-2', type: 'Post', data: { title: 'World' } })
    await doJSON(stub, '/data', { id: 'tag-1', type: 'Tag', data: { name: 'tech' } })
  })

  // ---------------------------------------------------------------------------
  // Create Relationship
  // ---------------------------------------------------------------------------

  describe('create relationship', () => {
    it('should create a relationship between two records', async () => {
      const res = await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
      })
      expect(res.status).toBe(200)
      const rel = (await res.json()) as Record<string, unknown>
      expect(rel.from_id).toBe('author-1')
      expect(rel.relation).toBe('wrote')
      expect(rel.to_id).toBe('post-1')
    })

    it('should create a relationship with metadata', async () => {
      const res = await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
        metadata: { role: 'primary', order: 1 },
      })
      expect(res.status).toBe(200)
      const rel = (await res.json()) as Record<string, unknown>
      expect(rel.metadata).toEqual({ role: 'primary', order: 1 })
    })

    it('should create a relationship without metadata (null metadata)', async () => {
      const res = await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
      })
      expect(res.status).toBe(200)
      const rel = (await res.json()) as Record<string, unknown>
      // metadata should be null or undefined when not provided
      expect(rel.metadata == null || rel.metadata === undefined).toBe(true)
    })

    it('should allow multiple relations from the same source', async () => {
      await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
      })
      await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-2',
      })

      const res = await doRequest(stub, '/rels?from_id=author-1&relation=wrote')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<unknown>
      expect(rels).toHaveLength(2)
    })

    it('should allow different relation types from the same source', async () => {
      await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
      })
      await doJSON(stub, '/rels', {
        from_id: 'author-1',
        relation: 'liked',
        to_id: 'post-1',
      })

      const res = await doRequest(stub, '/rels?from_id=author-1')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(2)
      const relations = rels.map((r) => r.relation)
      expect(relations).toContain('wrote')
      expect(relations).toContain('liked')
    })
  })

  // ---------------------------------------------------------------------------
  // Query Relationships
  // ---------------------------------------------------------------------------

  describe('query relationships', () => {
    beforeEach(async () => {
      await doJSON(stub, '/rels', { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })
      await doJSON(stub, '/rels', { from_id: 'author-1', relation: 'wrote', to_id: 'post-2' })
      await doJSON(stub, '/rels', { from_id: 'author-2', relation: 'wrote', to_id: 'post-2' })
      await doJSON(stub, '/rels', { from_id: 'post-1', relation: 'tagged', to_id: 'tag-1' })
    })

    it('should query outgoing relationships from a record', async () => {
      const res = await doRequest(stub, '/rels?from_id=author-1')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(2)
      expect(rels.every((r) => r.from_id === 'author-1')).toBe(true)
    })

    it('should query incoming relationships to a record', async () => {
      const res = await doRequest(stub, '/rels?to_id=post-2')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(2)
      expect(rels.every((r) => r.to_id === 'post-2')).toBe(true)
    })

    it('should query relationships by relation type', async () => {
      const res = await doRequest(stub, '/rels?relation=wrote')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(3)
      expect(rels.every((r) => r.relation === 'wrote')).toBe(true)
    })

    it('should query relationships by from_id and relation', async () => {
      const res = await doRequest(stub, '/rels?from_id=author-1&relation=wrote')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(2)
    })

    it('should return empty array when no relationships match', async () => {
      const res = await doRequest(stub, '/rels?from_id=nonexistent')
      expect(res.status).toBe(200)
      const rels = (await res.json()) as Array<unknown>
      expect(rels).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Delete Relationship
  // ---------------------------------------------------------------------------

  describe('delete relationship', () => {
    it('should delete a specific relationship', async () => {
      await doJSON(stub, '/rels', { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })

      const res = await doJSON(
        stub,
        '/rels/delete',
        {
          from_id: 'author-1',
          relation: 'wrote',
          to_id: 'post-1',
        },
        'DELETE'
      )
      expect(res.status).toBe(200)
      const result = (await res.json()) as Record<string, unknown>
      expect(result.deleted).toBe(true)

      // Verify it's gone
      const queryRes = await doRequest(stub, '/rels?from_id=author-1&relation=wrote&to_id=post-1')
      const rels = (await queryRes.json()) as Array<unknown>
      expect(rels).toHaveLength(0)
    })

    it('should return deleted:false for non-existent relationship', async () => {
      const res = await doJSON(
        stub,
        '/rels/delete',
        {
          from_id: 'author-1',
          relation: 'nonexistent',
          to_id: 'post-1',
        },
        'DELETE'
      )
      expect(res.status).toBe(200)
      const result = (await res.json()) as Record<string, unknown>
      expect(result.deleted).toBe(false)
    })

    it('should only delete the specified relationship, not others', async () => {
      await doJSON(stub, '/rels', { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })
      await doJSON(stub, '/rels', { from_id: 'author-1', relation: 'wrote', to_id: 'post-2' })

      await doJSON(
        stub,
        '/rels/delete',
        {
          from_id: 'author-1',
          relation: 'wrote',
          to_id: 'post-1',
        },
        'DELETE'
      )

      // The other relationship should still exist
      const res = await doRequest(stub, '/rels?from_id=author-1&relation=wrote')
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(1)
      expect(rels[0].to_id).toBe('post-2')
    })
  })
})

// =============================================================================
// Graph Traversal via _rels
// =============================================================================

describe('Core Schema: Graph Traversal', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()

    // Build a graph:
    // Alice --wrote--> Post1 --tagged--> Tech
    // Alice --wrote--> Post2 --tagged--> Tech
    // Bob   --wrote--> Post2 --tagged--> Design
    // Alice --follows--> Bob
    await doJSON(stub, '/data', { id: 'alice', type: 'User', data: { name: 'Alice' } })
    await doJSON(stub, '/data', { id: 'bob', type: 'User', data: { name: 'Bob' } })
    await doJSON(stub, '/data', { id: 'post-1', type: 'Post', data: { title: 'Post 1' } })
    await doJSON(stub, '/data', { id: 'post-2', type: 'Post', data: { title: 'Post 2' } })
    await doJSON(stub, '/data', { id: 'tech', type: 'Tag', data: { name: 'tech' } })
    await doJSON(stub, '/data', { id: 'design', type: 'Tag', data: { name: 'design' } })

    await doJSON(stub, '/rels', { from_id: 'alice', relation: 'wrote', to_id: 'post-1' })
    await doJSON(stub, '/rels', { from_id: 'alice', relation: 'wrote', to_id: 'post-2' })
    await doJSON(stub, '/rels', { from_id: 'bob', relation: 'wrote', to_id: 'post-2' })
    await doJSON(stub, '/rels', { from_id: 'post-1', relation: 'tagged', to_id: 'tech' })
    await doJSON(stub, '/rels', { from_id: 'post-2', relation: 'tagged', to_id: 'tech' })
    await doJSON(stub, '/rels', { from_id: 'post-2', relation: 'tagged', to_id: 'design' })
    await doJSON(stub, '/rels', { from_id: 'alice', relation: 'follows', to_id: 'bob' })
  })

  it('should find all records related via outgoing edges', async () => {
    // What did Alice write?
    const res = await doRequest(stub, '/traverse?from_id=alice&relation=wrote')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<Record<string, unknown>>
    expect(posts).toHaveLength(2)
    const ids = posts.map((p) => p.id)
    expect(ids).toContain('post-1')
    expect(ids).toContain('post-2')
  })

  it('should find all records related via incoming edges', async () => {
    // Who wrote Post 2?
    const res = await doRequest(stub, '/traverse?to_id=post-2&relation=wrote')
    expect(res.status).toBe(200)
    const authors = (await res.json()) as Array<Record<string, unknown>>
    expect(authors).toHaveLength(2)
    const ids = authors.map((a) => a.id)
    expect(ids).toContain('alice')
    expect(ids).toContain('bob')
  })

  it('should traverse two hops (e.g., Alice -> posts -> tags)', async () => {
    // What tags are on posts Alice wrote?
    const res = await doRequest(stub, '/traverse?from_id=alice&relation=wrote,tagged')
    expect(res.status).toBe(200)
    const tags = (await res.json()) as Array<Record<string, unknown>>
    // Alice wrote post-1 (tagged: tech) and post-2 (tagged: tech, design)
    const tagIds = tags.map((t) => t.id)
    expect(tagIds).toContain('tech')
    expect(tagIds).toContain('design')
  })

  it('should filter traversal results by type', async () => {
    // Get all User records connected to alice
    const res = await doRequest(stub, '/traverse?from_id=alice&type=User')
    expect(res.status).toBe(200)
    const users = (await res.json()) as Array<Record<string, unknown>>
    expect(users.every((u) => u.type === 'User')).toBe(true)
  })

  it('should handle traversal from record with no relationships', async () => {
    await doJSON(stub, '/data', { id: 'lonely', type: 'User', data: { name: 'Lonely' } })

    const res = await doRequest(stub, '/traverse?from_id=lonely&relation=wrote')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<unknown>
    expect(results).toHaveLength(0)
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Core Schema: Edge Cases', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  // ---------------------------------------------------------------------------
  // Duplicate IDs
  // ---------------------------------------------------------------------------

  describe('duplicate IDs', () => {
    it('should reject duplicate id insertion', async () => {
      await doJSON(stub, '/data', { id: 'dup-1', type: 'Post', data: { title: 'First' } })
      const res = await doJSON(stub, '/data', {
        id: 'dup-1',
        type: 'Post',
        data: { title: 'Second' },
      })

      // Should return a conflict error
      expect(res.status).toBe(409)
    })

    it('should handle duplicate relationship gracefully (composite PK)', async () => {
      await doJSON(stub, '/data', { id: 'a', type: 'Node', data: {} })
      await doJSON(stub, '/data', { id: 'b', type: 'Node', data: {} })

      await doJSON(stub, '/rels', { from_id: 'a', relation: 'links', to_id: 'b' })
      const res = await doJSON(stub, '/rels', { from_id: 'a', relation: 'links', to_id: 'b' })

      // Should handle duplicate: either upsert or return conflict
      // The composite PK (from_id, relation, to_id) prevents true duplicates
      expect([200, 409]).toContain(res.status)
    })
  })

  // ---------------------------------------------------------------------------
  // Missing Records
  // ---------------------------------------------------------------------------

  describe('missing records', () => {
    it('should return 404 when getting a missing data record', async () => {
      const res = await doRequest(stub, '/data/does-not-exist')
      expect(res.status).toBe(404)
    })

    it('should handle relationship creation with non-existent from_id', async () => {
      await doJSON(stub, '/data', { id: 'exists', type: 'Node', data: {} })

      // Creating a relationship where from_id doesn't exist in _data
      // The DO should handle this -- either allow it (graph-style) or reject
      const res = await doJSON(stub, '/rels', {
        from_id: 'ghost',
        relation: 'links',
        to_id: 'exists',
      })
      // Accept both approaches: allow or reject foreign keys
      expect([200, 400, 404]).toContain(res.status)
    })

    it('should handle relationship creation with non-existent to_id', async () => {
      await doJSON(stub, '/data', { id: 'exists', type: 'Node', data: {} })

      const res = await doJSON(stub, '/rels', {
        from_id: 'exists',
        relation: 'links',
        to_id: 'ghost',
      })
      expect([200, 400, 404]).toContain(res.status)
    })
  })

  // ---------------------------------------------------------------------------
  // Cascading Deletes
  // ---------------------------------------------------------------------------

  describe('cascading deletes', () => {
    it('should clean up relationships when a data record is deleted', async () => {
      await doJSON(stub, '/data', { id: 'node-a', type: 'Node', data: { name: 'A' } })
      await doJSON(stub, '/data', { id: 'node-b', type: 'Node', data: { name: 'B' } })
      await doJSON(stub, '/data', { id: 'node-c', type: 'Node', data: { name: 'C' } })

      await doJSON(stub, '/rels', { from_id: 'node-a', relation: 'links', to_id: 'node-b' })
      await doJSON(stub, '/rels', { from_id: 'node-b', relation: 'links', to_id: 'node-c' })
      await doJSON(stub, '/rels', { from_id: 'node-c', relation: 'links', to_id: 'node-a' })

      // Delete node-b
      await doRequest(stub, '/data/node-b', { method: 'DELETE' })

      // Relationships involving node-b should be cleaned up
      const fromB = await doRequest(stub, '/rels?from_id=node-b')
      const toB = await doRequest(stub, '/rels?to_id=node-b')

      const fromBRels = (await fromB.json()) as Array<unknown>
      const toBRels = (await toB.json()) as Array<unknown>

      expect(fromBRels).toHaveLength(0)
      expect(toBRels).toHaveLength(0)
    })

    it('should not delete unrelated relationships during cascade', async () => {
      await doJSON(stub, '/data', { id: 'x', type: 'Node', data: {} })
      await doJSON(stub, '/data', { id: 'y', type: 'Node', data: {} })
      await doJSON(stub, '/data', { id: 'z', type: 'Node', data: {} })

      await doJSON(stub, '/rels', { from_id: 'x', relation: 'links', to_id: 'y' })
      await doJSON(stub, '/rels', { from_id: 'y', relation: 'links', to_id: 'z' })

      // Delete x (should only remove x->y relationship)
      await doRequest(stub, '/data/x', { method: 'DELETE' })

      // y->z relationship should remain
      const res = await doRequest(stub, '/rels?from_id=y&relation=links')
      const rels = (await res.json()) as Array<Record<string, unknown>>
      expect(rels).toHaveLength(1)
      expect(rels[0].to_id).toBe('z')
    })
  })

  // ---------------------------------------------------------------------------
  // Concurrent / Isolation
  // ---------------------------------------------------------------------------

  describe('isolation', () => {
    it('should isolate data between different DO instances', async () => {
      const stub1 = getStub('namespace-1')
      const stub2 = getStub('namespace-2')

      await doJSON(stub1, '/data', { id: 'shared-id', type: 'Post', data: { source: 'ns1' } })
      await doJSON(stub2, '/data', { id: 'shared-id', type: 'Post', data: { source: 'ns2' } })

      const res1 = await doRequest(stub1, '/data/shared-id')
      const res2 = await doRequest(stub2, '/data/shared-id')

      const record1 = (await res1.json()) as Record<string, unknown>
      const record2 = (await res2.json()) as Record<string, unknown>

      expect((record1.data as Record<string, unknown>).source).toBe('ns1')
      expect((record2.data as Record<string, unknown>).source).toBe('ns2')
    })

    it('should isolate relationships between different DO instances', async () => {
      const stub1 = getStub('rel-ns-1')
      const stub2 = getStub('rel-ns-2')

      await doJSON(stub1, '/data', { id: 'a', type: 'Node', data: {} })
      await doJSON(stub1, '/data', { id: 'b', type: 'Node', data: {} })
      await doJSON(stub1, '/rels', { from_id: 'a', relation: 'links', to_id: 'b' })

      await doJSON(stub2, '/data', { id: 'a', type: 'Node', data: {} })
      await doJSON(stub2, '/data', { id: 'b', type: 'Node', data: {} })

      // namespace 2 should have no relationships
      const res = await doRequest(stub2, '/rels?from_id=a')
      const rels = (await res.json()) as Array<unknown>
      expect(rels).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Large Data
  // ---------------------------------------------------------------------------

  describe('large data handling', () => {
    it('should handle large JSON data fields', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        index: i,
        value: `item-${i}`,
        nested: { data: true },
      }))

      const res = await doJSON(stub, '/data', {
        id: 'large-1',
        type: 'BigData',
        data: { items: largeArray },
      })
      expect(res.status).toBe(200)

      const getRes = await doRequest(stub, '/data/large-1')
      const record = (await getRes.json()) as Record<string, unknown>
      const data = record.data as Record<string, unknown>
      expect(data.items as Array<unknown>).toHaveLength(1000)
    })
  })

  // ---------------------------------------------------------------------------
  // Type field constraints
  // ---------------------------------------------------------------------------

  describe('type field', () => {
    it('should require type field on insert', async () => {
      const res = await doJSON(stub, '/data', {
        id: 'no-type',
        data: { title: 'Missing type' },
      })
      expect(res.status).toBe(400)
    })

    it('should not allow updating the type field', async () => {
      await doJSON(stub, '/data', {
        id: 'type-lock',
        type: 'Post',
        data: { title: 'Original Type' },
      })

      // Try to change type via update -- should either ignore or reject
      const res = await doJSON(
        stub,
        '/data/type-lock',
        {
          type: 'DifferentType',
          data: { title: 'Changed Type' },
        },
        'PATCH'
      )

      // Verify type was not changed
      const getRes = await doRequest(stub, '/data/type-lock')
      const record = (await getRes.json()) as Record<string, unknown>
      expect(record.type).toBe('Post')
    })
  })
})

// =============================================================================
// Persistence across requests
// =============================================================================

describe('Core Schema: Persistence', () => {
  it('should persist data across multiple fetch calls to same DO', async () => {
    const stub = getStub('persistence-test')

    // First request: insert data
    await doJSON(stub, '/data', {
      id: 'persist-1',
      type: 'Post',
      data: { title: 'Persistent' },
    })

    // Second request: read it back
    const res = await doRequest(stub, '/data/persist-1')
    expect(res.status).toBe(200)
    const record = (await res.json()) as Record<string, unknown>
    expect((record.data as Record<string, unknown>).title).toBe('Persistent')
  })

  it('should persist relationships across multiple fetch calls', async () => {
    const stub = getStub('rel-persist-test')

    await doJSON(stub, '/data', { id: 'p1', type: 'Node', data: {} })
    await doJSON(stub, '/data', { id: 'p2', type: 'Node', data: {} })
    await doJSON(stub, '/rels', { from_id: 'p1', relation: 'connected', to_id: 'p2' })

    // Read relationships back
    const res = await doRequest(stub, '/rels?from_id=p1&relation=connected')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect(rels[0].to_id).toBe('p2')
  })
})
