/**
 * Core Schema Tests for ai-database DO SQLite Storage Layer
 *
 * Tests the foundational Durable Object SQLite layer with two tables:
 * - _data: id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT (JSON),
 *          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
 * - _rels: from_id TEXT NOT NULL, relation TEXT NOT NULL, to_id TEXT NOT NULL,
 *          metadata TEXT (JSON), created_at TEXT NOT NULL,
 *          PRIMARY KEY(from_id, relation, to_id)
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 *
 * Bead: aip-tkdq
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseDO } from '../../src/worker.js'
import { getStub, doRequest, doJSON, insertData, insertRel } from './test-helpers.js'

// ============================================================================
// 1. Table Initialization
// ============================================================================

describe('Core Schema: Table Initialization', () => {
  it('should create _data table on first access', async () => {
    const stub = getStub()
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

  it('should initialize both tables idempotently (CREATE TABLE IF NOT EXISTS)', async () => {
    const stub = getStub()
    // First request triggers init
    const res1 = await doRequest(stub, '/data')
    expect(res1.status).toBe(200)
    // Second request must not fail
    const res2 = await doRequest(stub, '/data')
    expect(res2.status).toBe(200)
  })

  it('should persist _data schema: id, type, data, created_at, updated_at', async () => {
    const stub = getStub()
    const record = await insertData(stub, {
      id: 'schema-check',
      type: 'Test',
      data: { foo: 'bar' },
    })
    expect(record.id).toBe('schema-check')
    expect(record.type).toBe('Test')
    expect(record.data).toEqual({ foo: 'bar' })
    expect(record.created_at).toBeDefined()
    expect(record.updated_at).toBeDefined()
  })

  it('should persist _rels schema: from_id, relation, to_id, metadata, created_at', async () => {
    const stub = getStub()
    await insertData(stub, { id: 'n1', type: 'Node', data: {} })
    await insertData(stub, { id: 'n2', type: 'Node', data: {} })

    const rel = await insertRel(stub, {
      from_id: 'n1',
      relation: 'links_to',
      to_id: 'n2',
      metadata: { weight: 1 },
    })
    expect(rel.from_id).toBe('n1')
    expect(rel.relation).toBe('links_to')
    expect(rel.to_id).toBe('n2')
    expect(rel.metadata).toEqual({ weight: 1 })
    expect(rel.created_at).toBeDefined()
  })
})

// ============================================================================
// 2. _data CRUD - INSERT
// ============================================================================

describe('Core Schema: _data INSERT', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should insert a record with all required fields', async () => {
    const record = await insertData(stub, {
      id: 'post-1',
      type: 'Post',
      data: { title: 'Hello World', body: 'Content here' },
    })
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

  it('should set created_at and updated_at as ISO 8601 timestamps', async () => {
    const before = new Date().toISOString()
    const record = await insertData(stub, {
      id: 'ts-1',
      type: 'Post',
      data: { title: 'Timestamps' },
    })
    const after = new Date().toISOString()

    expect(typeof record.created_at).toBe('string')
    expect(typeof record.updated_at).toBe('string')
    // Both should be equal on first insert
    expect(record.created_at).toBe(record.updated_at)
    // Should be valid ISO dates between before and after
    expect(new Date(record.created_at as string).toISOString()).toBe(record.created_at)
  })

  it('should store complex nested JSON data', async () => {
    const complexData = {
      nested: { deeply: { value: 42 } },
      array: [1, 2, 3],
      boolean: true,
      nullable: null,
      string: 'hello',
    }
    const record = await insertData(stub, {
      id: 'complex-1',
      type: 'Complex',
      data: complexData,
    })
    expect(record.data).toEqual(complexData)
  })

  it('should store empty object as data', async () => {
    const record = await insertData(stub, {
      id: 'empty-data',
      type: 'Item',
      data: {},
    })
    expect(record.data).toEqual({})
  })

  it('should store arrays in JSON data', async () => {
    const data = { tags: ['red', 'green', 'blue'], scores: [100, 200, 300] }
    const record = await insertData(stub, { id: 'arr-1', type: 'Item', data })
    expect(record.data).toEqual(data)
  })

  it('should store null values in JSON data', async () => {
    const data = { value: null, other: 'present' }
    const record = await insertData(stub, { id: 'null-1', type: 'Item', data })
    expect(record.data).toEqual(data)
  })

  it('should store numeric values accurately', async () => {
    const data = { integer: 42, float: 3.14159, negative: -100, zero: 0 }
    const record = await insertData(stub, { id: 'num-1', type: 'Item', data })
    expect(record.data).toEqual(data)
  })

  it('should store boolean values', async () => {
    const data = { active: true, deleted: false }
    const record = await insertData(stub, { id: 'bool-1', type: 'Item', data })
    expect(record.data).toEqual(data)
  })

  it('should store strings with special characters', async () => {
    const data = {
      text: 'Hello "world" with \'quotes\' and\nnewlines\tand\ttabs',
      unicode: '\u00e9\u00e0\u00fc\u00f1',
    }
    const record = await insertData(stub, { id: 'special-1', type: 'Item', data })
    expect(record.data).toEqual(data)
  })

  it('should require the type field on insert', async () => {
    const res = await doJSON(stub, '/data', {
      id: 'no-type',
      data: { title: 'Missing type' },
    })
    expect(res.status).toBe(400)
  })

  it('should reject duplicate id insertion (409 Conflict)', async () => {
    await insertData(stub, { id: 'dup-1', type: 'Post', data: { title: 'First' } })
    const res = await doJSON(stub, '/data', {
      id: 'dup-1',
      type: 'Post',
      data: { title: 'Second' },
    })
    expect(res.status).toBe(409)
  })
})

// ============================================================================
// 3. _data CRUD - GET
// ============================================================================

describe('Core Schema: _data GET', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should retrieve a record by id', async () => {
    await insertData(stub, {
      id: 'get-1',
      type: 'Post',
      data: { title: 'Retrievable' },
    })
    const res = await doRequest(stub, '/data/get-1')
    expect(res.status).toBe(200)
    const record = (await res.json()) as Record<string, unknown>
    expect(record.id).toBe('get-1')
    expect(record.type).toBe('Post')
    expect((record.data as Record<string, unknown>).title).toBe('Retrievable')
  })

  it('should return 404 for non-existent id', async () => {
    const res = await doRequest(stub, '/data/nonexistent')
    expect(res.status).toBe(404)
  })

  it('should retrieve the full JSON data intact', async () => {
    const data = { tags: ['a', 'b'], count: 99, active: true }
    await insertData(stub, { id: 'json-intact', type: 'Item', data })

    const res = await doRequest(stub, '/data/json-intact')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.data).toEqual(data)
  })

  it('should include created_at and updated_at in GET response', async () => {
    await insertData(stub, { id: 'ts-get', type: 'Post', data: { title: 'Timestamps' } })

    const res = await doRequest(stub, '/data/ts-get')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.created_at).toBeDefined()
    expect(record.updated_at).toBeDefined()
  })
})

// ============================================================================
// 4. _data CRUD - UPDATE
// ============================================================================

describe('Core Schema: _data UPDATE', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should update an existing record data', async () => {
    await insertData(stub, {
      id: 'upd-1',
      type: 'Post',
      data: { title: 'Original', status: 'draft' },
    })

    const res = await doJSON(
      stub,
      '/data/upd-1',
      { data: { title: 'Updated', status: 'published' } },
      'PATCH'
    )
    expect(res.status).toBe(200)
    const record = (await res.json()) as Record<string, unknown>
    expect((record.data as Record<string, unknown>).title).toBe('Updated')
    expect((record.data as Record<string, unknown>).status).toBe('published')
  })

  it('should update updated_at but preserve created_at', async () => {
    await insertData(stub, { id: 'ts-upd', type: 'Post', data: { title: 'Original' } })

    const getRes1 = await doRequest(stub, '/data/ts-upd')
    const original = (await getRes1.json()) as Record<string, unknown>
    const originalCreatedAt = original.created_at

    // Small delay to ensure timestamps differ
    await new Promise((resolve) => setTimeout(resolve, 10))

    await doJSON(stub, '/data/ts-upd', { data: { title: 'Updated' } }, 'PATCH')

    const getRes2 = await doRequest(stub, '/data/ts-upd')
    const updated = (await getRes2.json()) as Record<string, unknown>

    expect(updated.created_at).toBe(originalCreatedAt)
    expect(updated.updated_at).not.toBe(originalCreatedAt)
  })

  it('should merge data fields on PATCH (shallow merge)', async () => {
    await insertData(stub, {
      id: 'merge-1',
      type: 'Post',
      data: { title: 'Hello', body: 'World', status: 'draft' },
    })

    await doJSON(stub, '/data/merge-1', { data: { status: 'published' } }, 'PATCH')

    const res = await doRequest(stub, '/data/merge-1')
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
      { data: { title: 'No such record' } },
      'PATCH'
    )
    expect(res.status).toBe(404)
  })

  it('should not allow changing the type field via update', async () => {
    await insertData(stub, {
      id: 'type-lock',
      type: 'Post',
      data: { title: 'Original Type' },
    })

    // Attempt to change type
    await doJSON(
      stub,
      '/data/type-lock',
      { type: 'DifferentType', data: { title: 'Changed' } },
      'PATCH'
    )

    // Verify type is unchanged
    const res = await doRequest(stub, '/data/type-lock')
    const record = (await res.json()) as Record<string, unknown>
    expect(record.type).toBe('Post')
  })
})

// ============================================================================
// 5. _data CRUD - DELETE
// ============================================================================

describe('Core Schema: _data DELETE', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should delete an existing record', async () => {
    await insertData(stub, { id: 'del-1', type: 'Post', data: { title: 'Temp' } })

    const res = await doRequest(stub, '/data/del-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.deleted).toBe(true)

    // Verify it is gone
    const getRes = await doRequest(stub, '/data/del-1')
    expect(getRes.status).toBe(404)
  })

  it('should return deleted:false for non-existent record', async () => {
    const res = await doRequest(stub, '/data/ghost', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.deleted).toBe(false)
  })

  it('should cascade-delete relationships when a data record is deleted', async () => {
    await insertData(stub, { id: 'a', type: 'Node', data: { name: 'A' } })
    await insertData(stub, { id: 'b', type: 'Node', data: { name: 'B' } })
    await insertData(stub, { id: 'c', type: 'Node', data: { name: 'C' } })

    await insertRel(stub, { from_id: 'a', relation: 'links', to_id: 'b' })
    await insertRel(stub, { from_id: 'b', relation: 'links', to_id: 'c' })
    await insertRel(stub, { from_id: 'c', relation: 'links', to_id: 'a' })

    // Delete node b
    await doRequest(stub, '/data/b', { method: 'DELETE' })

    // All rels involving b should be gone
    const fromB = await doRequest(stub, '/rels?from_id=b')
    const toB = await doRequest(stub, '/rels?to_id=b')
    expect(await fromB.json()).toHaveLength(0)
    expect(await toB.json()).toHaveLength(0)
  })

  it('should not remove unrelated relationships during cascade delete', async () => {
    await insertData(stub, { id: 'x', type: 'Node', data: {} })
    await insertData(stub, { id: 'y', type: 'Node', data: {} })
    await insertData(stub, { id: 'z', type: 'Node', data: {} })

    await insertRel(stub, { from_id: 'x', relation: 'links', to_id: 'y' })
    await insertRel(stub, { from_id: 'y', relation: 'links', to_id: 'z' })

    // Delete x
    await doRequest(stub, '/data/x', { method: 'DELETE' })

    // y->z relationship should remain
    const res = await doRequest(stub, '/rels?from_id=y&relation=links')
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect(rels[0].to_id).toBe('z')
  })
})

// ============================================================================
// 6. Type-Based Queries on _data
// ============================================================================

describe('Core Schema: _data Type-Based Queries', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'First Post' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'Second Post' } })
    await insertData(stub, { id: 'post-3', type: 'Post', data: { title: 'Third Post' } })
    await insertData(stub, { id: 'user-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'user-2', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'comment-1', type: 'Comment', data: { text: 'Nice!' } })
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

  it('should list all records when no type filter is given', async () => {
    const res = await doRequest(stub, '/data')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(6)
  })

  it('should support limit parameter', async () => {
    const res = await doRequest(stub, '/data?type=Post&limit=2')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<unknown>
    expect(posts).toHaveLength(2)
  })

  it('should support offset parameter', async () => {
    const res = await doRequest(stub, '/data?type=Post&limit=1&offset=1')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<Record<string, unknown>>
    expect(posts).toHaveLength(1)
    expect(posts[0].id).toBe('post-2')
  })

  it('should order results by created_at ascending by default', async () => {
    const res = await doRequest(stub, '/data?type=Post')
    const posts = (await res.json()) as Array<Record<string, unknown>>
    const ids = posts.map((p) => p.id)
    expect(ids).toEqual(['post-1', 'post-2', 'post-3'])
  })
})

// ============================================================================
// 7. _rels CREATE
// ============================================================================

describe('Core Schema: _rels CREATE', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await insertData(stub, { id: 'author-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'author-2', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'World' } })
    await insertData(stub, { id: 'tag-1', type: 'Tag', data: { name: 'tech' } })
  })

  it('should create a relationship between two records', async () => {
    const rel = await insertRel(stub, {
      from_id: 'author-1',
      relation: 'wrote',
      to_id: 'post-1',
    })
    expect(rel.from_id).toBe('author-1')
    expect(rel.relation).toBe('wrote')
    expect(rel.to_id).toBe('post-1')
  })

  it('should create a relationship with metadata', async () => {
    const rel = await insertRel(stub, {
      from_id: 'author-1',
      relation: 'wrote',
      to_id: 'post-1',
      metadata: { role: 'primary', order: 1 },
    })
    expect(rel.metadata).toEqual({ role: 'primary', order: 1 })
  })

  it('should create a relationship without metadata (null)', async () => {
    const rel = await insertRel(stub, {
      from_id: 'author-1',
      relation: 'wrote',
      to_id: 'post-1',
    })
    expect(rel.metadata == null || rel.metadata === undefined).toBe(true)
  })

  it('should set created_at timestamp on relationships', async () => {
    const rel = await insertRel(stub, {
      from_id: 'author-1',
      relation: 'wrote',
      to_id: 'post-1',
    })
    expect(rel.created_at).toBeDefined()
    expect(typeof rel.created_at).toBe('string')
  })

  it('should allow multiple relations from the same source to different targets', async () => {
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'post-2' })

    const res = await doRequest(stub, '/rels?from_id=author-1&relation=wrote')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<unknown>
    expect(rels).toHaveLength(2)
  })

  it('should allow different relation types from the same source', async () => {
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })
    await insertRel(stub, { from_id: 'author-1', relation: 'liked', to_id: 'post-1' })

    const res = await doRequest(stub, '/rels?from_id=author-1')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(2)
    const relations = rels.map((r) => r.relation)
    expect(relations).toContain('wrote')
    expect(relations).toContain('liked')
  })

  it('should enforce unique composite key (from_id, relation, to_id)', async () => {
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })

    const res = await doJSON(stub, '/rels', {
      from_id: 'author-1',
      relation: 'wrote',
      to_id: 'post-1',
    })
    // Should conflict or upsert -- either 409 or 200 is acceptable
    expect([200, 409]).toContain(res.status)
  })
})

// ============================================================================
// 8. _rels QUERY
// ============================================================================

describe('Core Schema: _rels QUERY', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await insertData(stub, { id: 'author-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'author-2', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'World' } })
    await insertData(stub, { id: 'tag-1', type: 'Tag', data: { name: 'tech' } })

    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'post-1' })
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'post-2' })
    await insertRel(stub, { from_id: 'author-2', relation: 'wrote', to_id: 'post-2' })
    await insertRel(stub, { from_id: 'post-1', relation: 'tagged', to_id: 'tag-1' })
  })

  it('should query outgoing relationships by from_id', async () => {
    const res = await doRequest(stub, '/rels?from_id=author-1')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(2)
    expect(rels.every((r) => r.from_id === 'author-1')).toBe(true)
  })

  it('should query incoming relationships by to_id', async () => {
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

  it('should query relationships by from_id AND relation', async () => {
    const res = await doRequest(stub, '/rels?from_id=author-1&relation=wrote')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<unknown>
    expect(rels).toHaveLength(2)
  })

  it('should query relationships by from_id, relation, AND to_id (exact match)', async () => {
    const res = await doRequest(stub, '/rels?from_id=author-1&relation=wrote&to_id=post-1')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect(rels[0].from_id).toBe('author-1')
    expect(rels[0].relation).toBe('wrote')
    expect(rels[0].to_id).toBe('post-1')
  })

  it('should return empty array when no relationships match', async () => {
    const res = await doRequest(stub, '/rels?from_id=nonexistent')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<unknown>
    expect(rels).toHaveLength(0)
  })

  it('should return all relationships when no filter is specified', async () => {
    const res = await doRequest(stub, '/rels')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<unknown>
    expect(rels).toHaveLength(4)
  })
})

// ============================================================================
// 9. _rels DELETE
// ============================================================================

describe('Core Schema: _rels DELETE', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await insertData(stub, { id: 'a', type: 'Node', data: {} })
    await insertData(stub, { id: 'b', type: 'Node', data: {} })
    await insertData(stub, { id: 'c', type: 'Node', data: {} })
  })

  it('should delete a specific relationship', async () => {
    await insertRel(stub, { from_id: 'a', relation: 'links', to_id: 'b' })

    const res = await doJSON(
      stub,
      '/rels/delete',
      { from_id: 'a', relation: 'links', to_id: 'b' },
      'DELETE'
    )
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.deleted).toBe(true)

    // Verify it is gone
    const qRes = await doRequest(stub, '/rels?from_id=a&relation=links&to_id=b')
    const rels = (await qRes.json()) as Array<unknown>
    expect(rels).toHaveLength(0)
  })

  it('should return deleted:false for non-existent relationship', async () => {
    const res = await doJSON(
      stub,
      '/rels/delete',
      { from_id: 'a', relation: 'nonexistent', to_id: 'b' },
      'DELETE'
    )
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result.deleted).toBe(false)
  })

  it('should only delete the targeted relationship, leaving others intact', async () => {
    await insertRel(stub, { from_id: 'a', relation: 'links', to_id: 'b' })
    await insertRel(stub, { from_id: 'a', relation: 'links', to_id: 'c' })

    await doJSON(stub, '/rels/delete', { from_id: 'a', relation: 'links', to_id: 'b' }, 'DELETE')

    const res = await doRequest(stub, '/rels?from_id=a&relation=links')
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect(rels[0].to_id).toBe('c')
  })
})

// ============================================================================
// 10. Graph Traversal
// ============================================================================

describe('Core Schema: Graph Traversal', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()

    // Build graph:
    // Alice --wrote--> Post1 --tagged--> Tech
    // Alice --wrote--> Post2 --tagged--> Tech
    // Bob   --wrote--> Post2 --tagged--> Design
    // Alice --follows--> Bob
    await insertData(stub, { id: 'alice', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'bob', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Post 1' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'Post 2' } })
    await insertData(stub, { id: 'tech', type: 'Tag', data: { name: 'tech' } })
    await insertData(stub, { id: 'design', type: 'Tag', data: { name: 'design' } })

    await insertRel(stub, { from_id: 'alice', relation: 'wrote', to_id: 'post-1' })
    await insertRel(stub, { from_id: 'alice', relation: 'wrote', to_id: 'post-2' })
    await insertRel(stub, { from_id: 'bob', relation: 'wrote', to_id: 'post-2' })
    await insertRel(stub, { from_id: 'post-1', relation: 'tagged', to_id: 'tech' })
    await insertRel(stub, { from_id: 'post-2', relation: 'tagged', to_id: 'tech' })
    await insertRel(stub, { from_id: 'post-2', relation: 'tagged', to_id: 'design' })
    await insertRel(stub, { from_id: 'alice', relation: 'follows', to_id: 'bob' })
  })

  it('should traverse outgoing edges and return joined data records', async () => {
    // What did Alice write?
    const res = await doRequest(stub, '/traverse?from_id=alice&relation=wrote')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<Record<string, unknown>>
    expect(posts).toHaveLength(2)
    const ids = posts.map((p) => p.id)
    expect(ids).toContain('post-1')
    expect(ids).toContain('post-2')
  })

  it('should traverse incoming edges and return joined data records', async () => {
    // Who wrote Post 2?
    const res = await doRequest(stub, '/traverse?to_id=post-2&relation=wrote')
    expect(res.status).toBe(200)
    const authors = (await res.json()) as Array<Record<string, unknown>>
    expect(authors).toHaveLength(2)
    const ids = authors.map((a) => a.id)
    expect(ids).toContain('alice')
    expect(ids).toContain('bob')
  })

  it('should traverse multiple hops (comma-separated relations)', async () => {
    // Alice -> posts -> tags  (wrote, then tagged)
    const res = await doRequest(stub, '/traverse?from_id=alice&relation=wrote,tagged')
    expect(res.status).toBe(200)
    const tags = (await res.json()) as Array<Record<string, unknown>>
    const tagIds = tags.map((t) => t.id)
    expect(tagIds).toContain('tech')
    expect(tagIds).toContain('design')
  })

  it('should filter traversal results by type', async () => {
    // Get only User-type records connected to alice
    const res = await doRequest(stub, '/traverse?from_id=alice&type=User')
    expect(res.status).toBe(200)
    const users = (await res.json()) as Array<Record<string, unknown>>
    expect(users.every((u) => u.type === 'User')).toBe(true)
  })

  it('should return empty array when traversing from a record with no rels', async () => {
    await insertData(stub, { id: 'lonely', type: 'User', data: { name: 'Lonely' } })

    const res = await doRequest(stub, '/traverse?from_id=lonely&relation=wrote')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<unknown>
    expect(results).toHaveLength(0)
  })
})

// ============================================================================
// 11. SQLite Indexes
// ============================================================================

describe('Core Schema: SQLite Indexes', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should create index on _data(type) for fast type-based queries', async () => {
    // Trigger table creation
    await doRequest(stub, '/data')

    // Query the index metadata
    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('type') || n.includes('_data_type'))).toBe(true)
  })

  it('should create index on _data(created_at) for temporal queries', async () => {
    await doRequest(stub, '/data')

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('created_at') || n.includes('_data_created'))).toBe(
      true
    )
  })

  it('should create index on _rels(from_id, relation) for outgoing edge queries', async () => {
    await doRequest(stub, '/rels')

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('from') || n.includes('_rels_from'))).toBe(true)
  })

  it('should create index on _rels(to_id, relation) for incoming edge queries', async () => {
    await doRequest(stub, '/rels')

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('to') || n.includes('_rels_to'))).toBe(true)
  })
})

// ============================================================================
// 12. Schema Migrations
// ============================================================================

describe('Core Schema: Migrations', () => {
  it('should report schema version via /meta/version', async () => {
    const stub = getStub()
    // Trigger initialization
    await doRequest(stub, '/data')

    const res = await doRequest(stub, '/meta/version')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.version).toBeDefined()
    expect(typeof body.version).toBe('number')
    expect(body.version).toBeGreaterThanOrEqual(1)
  })

  it('should set initial schema version to 1', async () => {
    const stub = getStub()
    await doRequest(stub, '/data')

    const res = await doRequest(stub, '/meta/version')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.version).toBe(1)
  })

  it('should track schema version in the _meta table or pragma', async () => {
    const stub = getStub()
    await doRequest(stub, '/data')

    // After initialization, the version should be queryable
    const res = await doRequest(stub, '/meta/version')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.version).toBe(1)
  })
})

// ============================================================================
// 13. Persistence Across Requests
// ============================================================================

describe('Core Schema: Persistence', () => {
  it('should persist data records across multiple fetch calls to the same DO', async () => {
    const stub = getStub('persist-data')

    await insertData(stub, { id: 'p1', type: 'Post', data: { title: 'Persistent' } })

    // Read back in a separate fetch call
    const res = await doRequest(stub, '/data/p1')
    expect(res.status).toBe(200)
    const record = (await res.json()) as Record<string, unknown>
    expect((record.data as Record<string, unknown>).title).toBe('Persistent')
  })

  it('should persist relationships across multiple fetch calls', async () => {
    const stub = getStub('persist-rels')

    await insertData(stub, { id: 'r1', type: 'Node', data: {} })
    await insertData(stub, { id: 'r2', type: 'Node', data: {} })
    await insertRel(stub, { from_id: 'r1', relation: 'connected', to_id: 'r2' })

    const res = await doRequest(stub, '/rels?from_id=r1&relation=connected')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect(rels[0].to_id).toBe('r2')
  })

  it('should persist updates across fetch calls', async () => {
    const stub = getStub('persist-update')

    await insertData(stub, { id: 'pu1', type: 'Post', data: { title: 'Original' } })
    await doJSON(stub, '/data/pu1', { data: { title: 'Updated' } }, 'PATCH')

    const res = await doRequest(stub, '/data/pu1')
    const record = (await res.json()) as Record<string, unknown>
    expect((record.data as Record<string, unknown>).title).toBe('Updated')
  })

  it('should persist deletes across fetch calls', async () => {
    const stub = getStub('persist-delete')

    await insertData(stub, { id: 'pd1', type: 'Post', data: { title: 'Gone' } })
    await doRequest(stub, '/data/pd1', { method: 'DELETE' })

    const res = await doRequest(stub, '/data/pd1')
    expect(res.status).toBe(404)
  })
})

// ============================================================================
// 14. Isolation Between DO Instances
// ============================================================================

describe('Core Schema: DO Instance Isolation', () => {
  it('should isolate data between different DO instances', async () => {
    const stub1 = getStub('ns-1')
    const stub2 = getStub('ns-2')

    await insertData(stub1, { id: 'shared-id', type: 'Post', data: { source: 'ns1' } })
    await insertData(stub2, { id: 'shared-id', type: 'Post', data: { source: 'ns2' } })

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

    await insertData(stub1, { id: 'a', type: 'Node', data: {} })
    await insertData(stub1, { id: 'b', type: 'Node', data: {} })
    await insertRel(stub1, { from_id: 'a', relation: 'links', to_id: 'b' })

    await insertData(stub2, { id: 'a', type: 'Node', data: {} })
    await insertData(stub2, { id: 'b', type: 'Node', data: {} })
    // No rels in stub2

    const res = await doRequest(stub2, '/rels?from_id=a')
    const rels = (await res.json()) as Array<unknown>
    expect(rels).toHaveLength(0)
  })
})

// ============================================================================
// 15. Large Data Handling
// ============================================================================

describe('Core Schema: Large Data', () => {
  it('should handle large JSON data fields', async () => {
    const stub = getStub()
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({
      index: i,
      value: `item-${i}`,
      nested: { data: true },
    }))

    const record = await insertData(stub, {
      id: 'large-1',
      type: 'BigData',
      data: { items: largeArray },
    })
    expect(record.id).toBe('large-1')

    const res = await doRequest(stub, '/data/large-1')
    const fetched = (await res.json()) as Record<string, unknown>
    const data = fetched.data as Record<string, unknown>
    expect(data.items as Array<unknown>).toHaveLength(1000)
  })

  it('should handle many relationships for a single record', async () => {
    const stub = getStub()
    await insertData(stub, { id: 'hub', type: 'Node', data: { name: 'hub' } })

    // Create 50 target nodes and link them
    for (let i = 0; i < 50; i++) {
      const targetId = `spoke-${i}`
      await insertData(stub, { id: targetId, type: 'Node', data: { index: i } })
      await insertRel(stub, { from_id: 'hub', relation: 'links', to_id: targetId })
    }

    const res = await doRequest(stub, '/rels?from_id=hub&relation=links')
    const rels = (await res.json()) as Array<unknown>
    expect(rels).toHaveLength(50)
  })
})

// ============================================================================
// 16. Edge Cases and Error Handling
// ============================================================================

describe('Core Schema: Error Handling', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should return 404 for unknown routes', async () => {
    const res = await doRequest(stub, '/unknown-route')
    expect(res.status).toBe(404)
  })

  it('should return 400 for malformed JSON body', async () => {
    const res = await stub.fetch('https://do.test/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    expect(res.status).toBe(400)
  })

  it('should handle relationship creation with non-existent from_id', async () => {
    await insertData(stub, { id: 'exists', type: 'Node', data: {} })

    const res = await doJSON(stub, '/rels', {
      from_id: 'ghost',
      relation: 'links',
      to_id: 'exists',
    })
    // Implementation can either allow (graph-style) or reject
    expect([200, 400, 404]).toContain(res.status)
  })

  it('should handle relationship creation with non-existent to_id', async () => {
    await insertData(stub, { id: 'exists', type: 'Node', data: {} })

    const res = await doJSON(stub, '/rels', {
      from_id: 'exists',
      relation: 'links',
      to_id: 'ghost',
    })
    expect([200, 400, 404]).toContain(res.status)
  })

  it('should require from_id, relation, to_id when creating a relationship', async () => {
    // Missing relation
    const res1 = await doJSON(stub, '/rels', { from_id: 'a', to_id: 'b' })
    expect(res1.status).toBe(400)

    // Missing from_id
    const res2 = await doJSON(stub, '/rels', { relation: 'links', to_id: 'b' })
    expect(res2.status).toBe(400)

    // Missing to_id
    const res3 = await doJSON(stub, '/rels', { from_id: 'a', relation: 'links' })
    expect(res3.status).toBe(400)
  })
})
