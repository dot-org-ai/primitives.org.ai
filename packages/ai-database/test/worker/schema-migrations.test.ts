/**
 * Schema and Migrations Tests for ai-database DO SQLite (RED phase)
 *
 * Tests schema management and migrations in Durable Object SQLite storage:
 * - _schema table for storing entity type definitions
 * - Schema versioning and change detection
 * - Auto-migrations for schema changes
 * - Explicit migration functions
 * - Data validation against stored schemas
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 * NO MOCKS - tests run against real Durable Objects with SQLite storage.
 *
 * These tests SHOULD FAIL initially because schema management is not implemented yet.
 * This is the RED phase of TDD - we define the expected behavior first.
 *
 * Bead: aip-r7vl
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// ============================================================================
// This import will FAIL because DatabaseDO is not exported from worker.ts yet.
// That is intentional -- this is the RED phase of TDD.
// ============================================================================
import { DatabaseDO } from '../../src/worker.js'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a DurableObject stub for DatabaseDO.
 * Each call with a unique name creates a fresh, isolated DO instance.
 */
function getStub(name?: string): DurableObjectStub {
  const id = env.DATABASE.idFromName(name ?? crypto.randomUUID())
  return env.DATABASE.get(id)
}

/**
 * Send a fetch request to a DO stub and return the Response.
 */
async function doRequest(
  stub: DurableObjectStub,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return stub.fetch(`https://do.test${path}`, options)
}

/**
 * Send a JSON body request to a DO stub.
 */
async function doJSON(
  stub: DurableObjectStub,
  path: string,
  body: unknown,
  method = 'POST'
): Promise<Response> {
  return stub.fetch(`https://do.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Shorthand to POST to /data and parse the JSON result.
 */
async function insertData(
  stub: DurableObjectStub,
  record: { id?: string; type: string; data: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/data', record)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Shorthand to POST to /schema and parse the JSON result.
 */
async function setSchema(
  stub: DurableObjectStub,
  schema: Record<string, Record<string, string>>
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/schema', schema)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Shorthand to POST to /schema/migrate with explicit migration.
 */
async function runMigration(
  stub: DurableObjectStub,
  migration: { version: number; up: string; down?: string }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/schema/migrate', migration)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

// ============================================================================
// 1. Schema Storage
// ============================================================================

describe('Schema - storage', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should store schema definition in _schema table', async () => {
    const schema = {
      Post: {
        title: 'string',
        content: 'string',
        published: 'boolean',
      },
    }

    const result = await setSchema(stub, schema)
    expect(result.success).toBe(true)

    // Retrieve the schema
    const res = await doRequest(stub, '/schema')
    expect(res.status).toBe(200)
    const stored = (await res.json()) as Record<string, unknown>
    expect(stored.Post).toBeDefined()
    expect((stored.Post as Record<string, string>).title).toBe('string')
    expect((stored.Post as Record<string, string>).content).toBe('string')
    expect((stored.Post as Record<string, string>).published).toBe('boolean')
  })

  it('should support schema versioning', async () => {
    // Set initial schema
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
    })

    // Get initial version
    const res1 = await doRequest(stub, '/schema/version')
    const v1 = (await res1.json()) as Record<string, unknown>
    expect(v1.version).toBe(1)

    // Update schema
    await setSchema(stub, {
      User: { name: 'string', email: 'string', age: 'number?' },
    })

    // Version should increment
    const res2 = await doRequest(stub, '/schema/version')
    const v2 = (await res2.json()) as Record<string, unknown>
    expect(v2.version).toBe(2)
  })

  it('should detect schema changes', async () => {
    // Set initial schema
    await setSchema(stub, {
      Post: { title: 'string', body: 'string' },
    })

    // Check for changes with identical schema (no changes)
    const res1 = await doJSON(stub, '/schema/diff', {
      Post: { title: 'string', body: 'string' },
    })
    const diff1 = (await res1.json()) as Record<string, unknown>
    expect(diff1.hasChanges).toBe(false)
    expect(diff1.changes).toEqual([])

    // Check for changes with modified schema
    const res2 = await doJSON(stub, '/schema/diff', {
      Post: { title: 'string', body: 'string', author: 'string' },
    })
    const diff2 = (await res2.json()) as Record<string, unknown>
    expect(diff2.hasChanges).toBe(true)
    expect((diff2.changes as Array<Record<string, unknown>>).length).toBeGreaterThan(0)
    expect(
      (diff2.changes as Array<Record<string, unknown>>).some(
        (c) => c.type === 'field_added' && c.field === 'author'
      )
    ).toBe(true)
  })

  it('should validate data against stored schema', async () => {
    // Set schema
    await setSchema(stub, {
      User: {
        name: 'string',
        age: 'number',
        active: 'boolean',
      },
    })

    // Valid data
    const res1 = await doJSON(stub, '/schema/validate', {
      type: 'User',
      data: { name: 'Alice', age: 30, active: true },
    })
    const valid = (await res1.json()) as Record<string, unknown>
    expect(valid.valid).toBe(true)
    expect(valid.errors).toEqual([])

    // Invalid data (wrong type)
    const res2 = await doJSON(stub, '/schema/validate', {
      type: 'User',
      data: { name: 'Bob', age: 'thirty', active: true },
    })
    const invalid = (await res2.json()) as Record<string, unknown>
    expect(invalid.valid).toBe(false)
    expect((invalid.errors as string[]).length).toBeGreaterThan(0)
  })
})

// ============================================================================
// 2. _schema Table Structure
// ============================================================================

describe('Schema - _schema table', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should create _schema table on first access', async () => {
    // Just accessing schema should create the table
    const res = await doRequest(stub, '/schema')
    expect(res.status).toBe(200)
    const schema = (await res.json()) as Record<string, unknown>
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')
  })

  it('should store entity type definitions', async () => {
    // Set multiple entity types
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
      Post: { title: 'string', content: 'string' },
      Comment: { text: 'string', authorId: 'string' },
    })

    // Retrieve and verify
    const res = await doRequest(stub, '/schema')
    const schema = (await res.json()) as Record<string, unknown>

    expect(schema.User).toBeDefined()
    expect(schema.Post).toBeDefined()
    expect(schema.Comment).toBeDefined()

    // Verify structure
    expect((schema.User as Record<string, string>).name).toBe('string')
    expect((schema.Post as Record<string, string>).title).toBe('string')
    expect((schema.Comment as Record<string, string>).text).toBe('string')
  })

  it('should store field types and constraints', async () => {
    await setSchema(stub, {
      Product: {
        name: 'string',
        price: 'number',
        inStock: 'boolean',
        description: 'string?', // optional
        tags: 'string[]', // array
        rating: 'number?', // optional number
      },
    })

    const res = await doRequest(stub, '/schema')
    const schema = (await res.json()) as Record<string, unknown>
    const product = schema.Product as Record<string, string>

    expect(product.name).toBe('string')
    expect(product.price).toBe('number')
    expect(product.inStock).toBe('boolean')
    expect(product.description).toBe('string?')
    expect(product.tags).toBe('string[]')
    expect(product.rating).toBe('number?')
  })

  it('should store relationship definitions', async () => {
    await setSchema(stub, {
      Author: {
        name: 'string',
        posts: 'Post[] -> Post.author', // one-to-many
      },
      Post: {
        title: 'string',
        author: 'Author -> Author.posts', // backref
        tags: 'Tag[] ~> Tag.posts', // many-to-many
      },
      Tag: {
        name: 'string',
        posts: 'Post[] <~ Post.tags', // reverse many-to-many
      },
    })

    const res = await doRequest(stub, '/schema')
    const schema = (await res.json()) as Record<string, unknown>

    // Verify relationships are stored
    expect((schema.Author as Record<string, string>).posts).toBe('Post[] -> Post.author')
    expect((schema.Post as Record<string, string>).author).toBe('Author -> Author.posts')
    expect((schema.Post as Record<string, string>).tags).toBe('Tag[] ~> Tag.posts')
    expect((schema.Tag as Record<string, string>).posts).toBe('Post[] <~ Post.tags')
  })
})

// ============================================================================
// 3. Auto-Migrations
// ============================================================================

describe('Migrations - auto', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Set initial schema
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
    })
    // Insert some data
    await insertData(stub, {
      id: 'user-1',
      type: 'User',
      data: { name: 'Alice', email: 'alice@example.com' },
    })
    await insertData(stub, {
      id: 'user-2',
      type: 'User',
      data: { name: 'Bob', email: 'bob@example.com' },
    })
  })

  it('should auto-add new fields to existing data', async () => {
    // Update schema with new field
    await setSchema(stub, {
      User: { name: 'string', email: 'string', bio: 'string?' },
    })

    // Existing data should still be accessible
    const res = await doRequest(stub, '/data/user-1')
    expect(res.status).toBe(200)
    const user = (await res.json()) as Record<string, unknown>
    expect((user.data as Record<string, unknown>).name).toBe('Alice')
    expect((user.data as Record<string, unknown>).email).toBe('alice@example.com')
    // New field should be accessible (as null/undefined for existing records)
    expect((user.data as Record<string, unknown>).bio).toBeUndefined()
  })

  it('should auto-add new entity types', async () => {
    // Add new entity type to schema
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
      Post: { title: 'string', content: 'string' },
    })

    // Should be able to create Post entities now
    const post = await insertData(stub, {
      id: 'post-1',
      type: 'Post',
      data: { title: 'Hello World', content: 'This is my first post' },
    })

    expect(post.id).toBe('post-1')
    expect(post.type).toBe('Post')
    expect((post.data as Record<string, unknown>).title).toBe('Hello World')

    // Old data should still exist
    const res = await doRequest(stub, '/data/user-1')
    expect(res.status).toBe(200)
  })

  it('should preserve existing data on schema change', async () => {
    // Get original data
    const res1 = await doRequest(stub, '/data/user-1')
    const original = (await res1.json()) as Record<string, unknown>

    // Update schema significantly
    await setSchema(stub, {
      User: {
        name: 'string',
        email: 'string',
        age: 'number?',
        verified: 'boolean?',
        profile: 'string?',
      },
    })

    // Original data should be unchanged
    const res2 = await doRequest(stub, '/data/user-1')
    const updated = (await res2.json()) as Record<string, unknown>

    expect((updated.data as Record<string, unknown>).name).toBe(
      (original.data as Record<string, unknown>).name
    )
    expect((updated.data as Record<string, unknown>).email).toBe(
      (original.data as Record<string, unknown>).email
    )
    expect(updated.created_at).toBe(original.created_at)
  })

  it('should set default values for new required fields', async () => {
    // Update schema with new required field that has a default
    const res = await doJSON(stub, '/schema', {
      User: {
        name: 'string',
        email: 'string',
        status: 'string = "active"', // required with default
      },
    })
    expect(res.status).toBe(200)

    // Existing records should have the default value applied
    const userRes = await doRequest(stub, '/data/user-1')
    const user = (await userRes.json()) as Record<string, unknown>
    expect((user.data as Record<string, unknown>).status).toBe('active')
  })
})

// ============================================================================
// 4. Explicit Migrations
// ============================================================================

describe('Migrations - explicit', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Initialize with basic data
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
    })
    await insertData(stub, {
      id: 'user-1',
      type: 'User',
      data: { name: 'Alice', email: 'alice@example.com' },
    })
  })

  it('should support explicit migration functions', async () => {
    // Run an explicit migration
    const result = await runMigration(stub, {
      version: 2,
      up: `
        UPDATE _data
        SET data = json_set(data, '$.displayName', json_extract(data, '$.name'))
        WHERE type = 'User'
      `,
      down: `
        UPDATE _data
        SET data = json_remove(data, '$.displayName')
        WHERE type = 'User'
      `,
    })

    expect(result.success).toBe(true)
    expect(result.version).toBe(2)

    // Verify migration was applied
    const res = await doRequest(stub, '/data/user-1')
    const user = (await res.json()) as Record<string, unknown>
    expect((user.data as Record<string, unknown>).displayName).toBe('Alice')
  })

  it('should track migration version', async () => {
    // Initial version
    const res1 = await doRequest(stub, '/schema/version')
    const v1 = (await res1.json()) as Record<string, unknown>
    const initialVersion = v1.version as number

    // Run migration
    await runMigration(stub, {
      version: initialVersion + 1,
      up: 'SELECT 1', // no-op migration
    })

    // Version should be updated
    const res2 = await doRequest(stub, '/schema/version')
    const v2 = (await res2.json()) as Record<string, unknown>
    expect(v2.version).toBe(initialVersion + 1)

    // List applied migrations
    const res3 = await doRequest(stub, '/schema/migrations')
    const migrations = (await res3.json()) as Array<Record<string, unknown>>
    expect(migrations.length).toBeGreaterThan(0)
    expect(migrations.some((m) => m.version === initialVersion + 1)).toBe(true)
  })

  it('should run migrations in order', async () => {
    // Run multiple migrations
    await runMigration(stub, {
      version: 2,
      up: "UPDATE _data SET data = json_set(data, '$.step', 2) WHERE type = 'User'",
    })

    await runMigration(stub, {
      version: 3,
      up: "UPDATE _data SET data = json_set(data, '$.step', json_extract(data, '$.step') + 1) WHERE type = 'User'",
    })

    await runMigration(stub, {
      version: 4,
      up: "UPDATE _data SET data = json_set(data, '$.step', json_extract(data, '$.step') + 1) WHERE type = 'User'",
    })

    // Verify migrations ran in order
    const res = await doRequest(stub, '/data/user-1')
    const user = (await res.json()) as Record<string, unknown>
    expect((user.data as Record<string, unknown>).step).toBe(4) // 2 + 1 + 1
  })

  it('should rollback failed migrations', async () => {
    // Get initial state
    const res1 = await doRequest(stub, '/data/user-1')
    const original = (await res1.json()) as Record<string, unknown>

    // Run a migration that will fail
    const result = await doJSON(stub, '/schema/migrate', {
      version: 99,
      up: 'INVALID SQL SYNTAX HERE !!!',
      down: 'SELECT 1',
    })

    // Migration should fail
    expect(result.status).not.toBe(200)

    // Data should be unchanged (rolled back)
    const res2 = await doRequest(stub, '/data/user-1')
    const afterFailed = (await res2.json()) as Record<string, unknown>
    expect((afterFailed.data as Record<string, unknown>).name).toBe(
      (original.data as Record<string, unknown>).name
    )

    // Version should not have changed
    const vRes = await doRequest(stub, '/schema/version')
    const version = (await vRes.json()) as Record<string, unknown>
    expect(version.version).not.toBe(99)
  })
})

// ============================================================================
// 5. Schema Validation
// ============================================================================

describe('Schema - validation', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await setSchema(stub, {
      Article: {
        title: 'string',
        views: 'number',
        published: 'boolean',
        tags: 'string[]?',
        author: 'string?',
      },
    })
  })

  it('should validate create data against schema', async () => {
    // Valid create
    const res1 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Hello', views: 100, published: true },
    })
    expect(res1.status).toBe(200)

    // Invalid create (wrong type for views)
    const res2 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Hello', views: 'many', published: true },
    })
    expect(res2.status).toBe(400)
    const error = (await res2.json()) as Record<string, unknown>
    expect(error.error).toContain('validation')
  })

  it('should validate update data against schema', async () => {
    // Create valid record first
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'Original', views: 0, published: false },
    })

    // Valid update
    const res1 = await doJSON(stub, '/data/article-1', { data: { views: 50 } }, 'PATCH')
    expect(res1.status).toBe(200)

    // Invalid update (wrong type)
    const res2 = await doJSON(stub, '/data/article-1', { data: { published: 'yes' } }, 'PATCH')
    expect(res2.status).toBe(400)
    const error = (await res2.json()) as Record<string, unknown>
    expect(error.error).toContain('validation')
  })

  it('should reject invalid field types', async () => {
    // String where number expected
    const res1 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Test', views: 'not-a-number', published: true },
    })
    expect(res1.status).toBe(400)

    // Number where boolean expected
    const res2 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Test', views: 0, published: 1 },
    })
    expect(res2.status).toBe(400)

    // Number where string expected
    const res3 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 123, views: 0, published: true },
    })
    expect(res3.status).toBe(400)
  })

  it('should enforce required fields', async () => {
    // Missing required field 'title'
    const res1 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { views: 0, published: true },
    })
    expect(res1.status).toBe(400)
    const error1 = (await res1.json()) as Record<string, unknown>
    expect(error1.error).toContain('title')

    // Missing required field 'views'
    const res2 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Test', published: true },
    })
    expect(res2.status).toBe(400)
    const error2 = (await res2.json()) as Record<string, unknown>
    expect(error2.error).toContain('views')

    // Missing required field 'published'
    const res3 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Test', views: 0 },
    })
    expect(res3.status).toBe(400)
    const error3 = (await res3.json()) as Record<string, unknown>
    expect(error3.error).toContain('published')
  })

  it('should support optional fields with ?', async () => {
    // Create without optional fields
    const res1 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Test', views: 0, published: true },
    })
    expect(res1.status).toBe(200)

    // Create with optional fields
    const res2 = await doJSON(stub, '/data', {
      type: 'Article',
      data: {
        title: 'Test 2',
        views: 10,
        published: true,
        tags: ['news', 'tech'],
        author: 'Alice',
      },
    })
    expect(res2.status).toBe(200)

    // Create with null optional field
    const res3 = await doJSON(stub, '/data', {
      type: 'Article',
      data: { title: 'Test 3', views: 5, published: false, tags: null, author: null },
    })
    expect(res3.status).toBe(200)
  })
})

// ============================================================================
// 6. Schema Type Coercion
// ============================================================================

describe('Schema - type coercion', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await setSchema(stub, {
      Record: {
        intValue: 'number',
        floatValue: 'number',
        boolValue: 'boolean',
        stringValue: 'string',
      },
    })
  })

  it('should coerce numeric strings to numbers when appropriate', async () => {
    // This tests strict mode - coercion may or may not be allowed
    const res = await doJSON(stub, '/data', {
      type: 'Record',
      data: {
        intValue: '42', // string that looks like number
        floatValue: 3.14,
        boolValue: true,
        stringValue: 'hello',
      },
    })

    // Strict validation should reject, lenient should coerce
    // The implementation decides - test documents expected behavior
    if (res.status === 200) {
      const record = (await res.json()) as Record<string, unknown>
      expect(typeof (record.data as Record<string, unknown>).intValue).toBe('number')
      expect((record.data as Record<string, unknown>).intValue).toBe(42)
    } else {
      expect(res.status).toBe(400)
    }
  })

  it('should preserve number precision', async () => {
    const res = await doJSON(stub, '/data', {
      type: 'Record',
      data: {
        intValue: 9007199254740991, // MAX_SAFE_INTEGER
        floatValue: 3.141592653589793,
        boolValue: true,
        stringValue: 'test',
      },
    })
    expect(res.status).toBe(200)
    const record = (await res.json()) as Record<string, unknown>
    expect((record.data as Record<string, unknown>).intValue).toBe(9007199254740991)
    expect((record.data as Record<string, unknown>).floatValue).toBe(3.141592653589793)
  })
})

// ============================================================================
// 7. Schema Evolution History
// ============================================================================

describe('Schema - evolution history', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should track schema change history', async () => {
    // Initial schema
    await setSchema(stub, {
      User: { name: 'string' },
    })

    // First evolution
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
    })

    // Second evolution
    await setSchema(stub, {
      User: { name: 'string', email: 'string', bio: 'string?' },
    })

    // Get history
    const res = await doRequest(stub, '/schema/history')
    expect(res.status).toBe(200)
    const history = (await res.json()) as Array<Record<string, unknown>>

    expect(history.length).toBeGreaterThanOrEqual(3)
    expect(history[0]!.version).toBe(1)
    expect(history[1]!.version).toBe(2)
    expect(history[2]!.version).toBe(3)
  })

  it('should allow retrieving schema at specific version', async () => {
    // Set schemas at different versions
    await setSchema(stub, { User: { name: 'string' } })
    await setSchema(stub, { User: { name: 'string', email: 'string' } })
    await setSchema(stub, { User: { name: 'string', email: 'string', age: 'number?' } })

    // Get schema at version 1
    const res1 = await doRequest(stub, '/schema?version=1')
    const v1 = (await res1.json()) as Record<string, unknown>
    expect((v1.User as Record<string, string>).email).toBeUndefined()

    // Get schema at version 2
    const res2 = await doRequest(stub, '/schema?version=2')
    const v2 = (await res2.json()) as Record<string, unknown>
    expect((v2.User as Record<string, string>).email).toBe('string')
    expect((v2.User as Record<string, string>).age).toBeUndefined()

    // Get current schema (version 3)
    const res3 = await doRequest(stub, '/schema')
    const v3 = (await res3.json()) as Record<string, unknown>
    expect((v3.User as Record<string, string>).age).toBe('number?')
  })
})

// ============================================================================
// 8. Schema Constraints
// ============================================================================

describe('Schema - constraints', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
  })

  it('should enforce unique constraints', async () => {
    await setSchema(stub, {
      User: {
        name: 'string',
        email: 'string @unique',
      },
    })

    // First insert
    await insertData(stub, {
      id: 'user-1',
      type: 'User',
      data: { name: 'Alice', email: 'alice@example.com' },
    })

    // Second insert with same email should fail
    const res = await doJSON(stub, '/data', {
      type: 'User',
      data: { name: 'Bob', email: 'alice@example.com' },
    })
    expect(res.status).toBe(409) // Conflict
  })

  it('should enforce min/max constraints on numbers', async () => {
    await setSchema(stub, {
      Product: {
        name: 'string',
        price: 'number @min(0) @max(10000)',
        quantity: 'number @min(0)',
      },
    })

    // Valid values
    const res1 = await doJSON(stub, '/data', {
      type: 'Product',
      data: { name: 'Widget', price: 100, quantity: 50 },
    })
    expect(res1.status).toBe(200)

    // Price too high
    const res2 = await doJSON(stub, '/data', {
      type: 'Product',
      data: { name: 'Expensive', price: 20000, quantity: 1 },
    })
    expect(res2.status).toBe(400)

    // Negative quantity
    const res3 = await doJSON(stub, '/data', {
      type: 'Product',
      data: { name: 'Invalid', price: 50, quantity: -5 },
    })
    expect(res3.status).toBe(400)
  })

  it('should enforce pattern constraints on strings', async () => {
    await setSchema(stub, {
      User: {
        name: 'string',
        email: 'string @pattern("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")',
      },
    })

    // Valid email
    const res1 = await doJSON(stub, '/data', {
      type: 'User',
      data: { name: 'Alice', email: 'alice@example.com' },
    })
    expect(res1.status).toBe(200)

    // Invalid email
    const res2 = await doJSON(stub, '/data', {
      type: 'User',
      data: { name: 'Bob', email: 'not-an-email' },
    })
    expect(res2.status).toBe(400)
  })
})

// ============================================================================
// 9. Schema-less Mode
// ============================================================================

describe('Schema - schema-less mode', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should allow operations when no schema is defined', async () => {
    // Without setting any schema, operations should still work
    const res = await doJSON(stub, '/data', {
      type: 'Anything',
      data: { arbitrary: 'data', count: 42, nested: { deep: true } },
    })
    expect(res.status).toBe(200)

    const record = (await res.json()) as Record<string, unknown>
    expect(record.type).toBe('Anything')
    expect((record.data as Record<string, unknown>).arbitrary).toBe('data')
  })

  it('should allow partial schema (only validate types with defined schemas)', async () => {
    // Define schema only for User
    await setSchema(stub, {
      User: { name: 'string', email: 'string' },
    })

    // User must conform to schema
    const res1 = await doJSON(stub, '/data', {
      type: 'User',
      data: { name: 'Alice', email: 'alice@example.com' },
    })
    expect(res1.status).toBe(200)

    // Post has no schema - anything goes
    const res2 = await doJSON(stub, '/data', {
      type: 'Post',
      data: { anything: 'works', numbers: [1, 2, 3] },
    })
    expect(res2.status).toBe(200)
  })
})

// ============================================================================
// 10. Concurrent Migration Safety
// ============================================================================

describe('Schema - concurrent safety', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await setSchema(stub, { Counter: { value: 'number' } })
    await insertData(stub, { id: 'counter-1', type: 'Counter', data: { value: 0 } })
  })

  it('should handle concurrent schema updates safely', async () => {
    // Attempt concurrent schema updates
    const promises = [
      setSchema(stub, { Counter: { value: 'number', name: 'string?' } }),
      setSchema(stub, { Counter: { value: 'number', label: 'string?' } }),
    ]

    const results = await Promise.allSettled(promises)

    // At least one should succeed
    const successes = results.filter((r) => r.status === 'fulfilled')
    expect(successes.length).toBeGreaterThan(0)

    // Schema should be in a consistent state
    const res = await doRequest(stub, '/schema')
    expect(res.status).toBe(200)
    const schema = (await res.json()) as Record<string, unknown>
    expect(schema.Counter).toBeDefined()
  })

  it('should lock schema during migration', async () => {
    // Start a long-running migration
    const migrationPromise = runMigration(stub, {
      version: 2,
      up: `
        -- Simulate slow migration
        WITH RECURSIVE cnt(x) AS (
          VALUES(1) UNION ALL SELECT x+1 FROM cnt WHERE x<1000
        )
        SELECT x FROM cnt;
        UPDATE _data SET data = json_set(data, '$.migrated', true) WHERE type = 'Counter';
      `,
    })

    // Concurrent writes should either wait or fail with lock error
    const writePromise = doJSON(stub, '/data', {
      type: 'Counter',
      data: { value: 999 },
    })

    const [migrationResult, writeResult] = await Promise.all([migrationPromise, writePromise])

    // Migration should succeed
    expect(migrationResult.success).toBe(true)

    // Write should eventually succeed (after lock release) or be rejected during migration
    expect([200, 409, 503]).toContain(writeResult.status)
  })
})
