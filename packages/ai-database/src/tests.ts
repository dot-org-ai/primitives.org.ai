/**
 * Unified Compliance Test Suite for Database Adapters
 *
 * Provides reusable test factories that any DBClient/DBClientExtended
 * implementation can use to verify compliance with the interface.
 *
 * @example
 * ```ts
 * import { createTests } from 'ai-database/tests'
 * import { createClickHouseDatabase } from '@mdxdb/clickhouse'
 *
 * createTests('ClickHouse', () => createClickHouseDatabase({ url: '...' }))
 * ```
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type {
  DBClient,
  DBClientExtended,
  Thing,
  Relationship,
  QueryOptions,
  CreateOptions,
  Event,
  Action,
  Artifact,
} from './types.js'

// =============================================================================
// Test Fixtures
// =============================================================================

export const fixtures = {
  /** Sample namespace for tests */
  ns: 'test.example.com',

  /** Sample users */
  users: [
    { id: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
    { id: 'user-2', name: 'Bob', email: 'bob@example.com', role: 'user' },
    { id: 'user-3', name: 'Charlie', email: 'charlie@example.com', role: 'user' },
  ],

  /** Sample posts */
  posts: [
    { id: 'post-1', title: 'Hello World', content: 'First post', authorId: 'user-1' },
    { id: 'post-2', title: 'Second Post', content: 'More content', authorId: 'user-1' },
    { id: 'post-3', title: 'Bobs Post', content: 'From Bob', authorId: 'user-2' },
  ],

  /** Sample tags */
  tags: [
    { id: 'tag-1', name: 'typescript' },
    { id: 'tag-2', name: 'database' },
    { id: 'tag-3', name: 'testing' },
  ],
}

// =============================================================================
// Test Options
// =============================================================================

export interface CreateTestsOptions<T extends DBClient = DBClient> {
  /** Factory function to create the client */
  factory: () => T | Promise<T>
  /** Optional cleanup function called after all tests */
  cleanup?: () => void | Promise<void>
  /** Skip certain test groups */
  skip?: {
    relationships?: boolean
    search?: boolean
    events?: boolean
    actions?: boolean
    artifacts?: boolean
  }
  /** Custom namespace (defaults to fixtures.ns) */
  ns?: string
}

// =============================================================================
// Main Test Factory
// =============================================================================

/**
 * Create a comprehensive test suite for a DBClient implementation
 *
 * @example Basic usage
 * ```ts
 * import { createTests } from 'ai-database/tests'
 *
 * createTests('Memory', {
 *   factory: () => new MemoryDBClient()
 * })
 * ```
 *
 * @example With cleanup
 * ```ts
 * createTests('SQLite', {
 *   factory: async () => {
 *     const db = await createSQLiteClient({ path: ':memory:' })
 *     return db
 *   },
 *   cleanup: async () => {
 *     // cleanup temp files
 *   }
 * })
 * ```
 *
 * @example Skip certain tests
 * ```ts
 * createTests('Filesystem', {
 *   factory: () => createFsClient({ root: tempDir }),
 *   skip: { events: true, actions: true, artifacts: true }
 * })
 * ```
 */
export function createTests<T extends DBClient>(
  name: string,
  options: CreateTestsOptions<T>
): void {
  const { factory, cleanup, skip = {}, ns = fixtures.ns } = options

  describe(`${name} Compliance Tests`, () => {
    let client: T

    beforeAll(async () => {
      client = await factory()
    })

    afterAll(async () => {
      await client.close?.()
      await cleanup?.()
    })

    // =========================================================================
    // Thing CRUD Operations
    // =========================================================================

    describe('Things - CRUD', () => {
      const testThing = {
        ns,
        type: 'TestEntity',
        id: 'crud-test-1',
        data: { name: 'Test', value: 42 },
      }

      afterAll(async () => {
        // Cleanup test data
        try {
          await client.delete(`https://${ns}/TestEntity/crud-test-1`)
          await client.delete(`https://${ns}/TestEntity/crud-test-2`)
        } catch {
          // Ignore cleanup errors
        }
      })

      it('creates a thing', async () => {
        const thing = await client.create(testThing)

        expect(thing).toBeDefined()
        expect(thing.ns).toBe(ns)
        expect(thing.type).toBe('TestEntity')
        expect(thing.id).toBe('crud-test-1')
        expect(thing.data['name']).toBe('Test')
        expect(thing.data['value']).toBe(42)
        expect(thing.createdAt).toBeInstanceOf(Date)
        expect(thing.updatedAt).toBeInstanceOf(Date)
      })

      it('gets a thing by URL', async () => {
        const thing = await client.get(`https://${ns}/TestEntity/crud-test-1`)

        expect(thing).not.toBeNull()
        expect(thing?.data['name']).toBe('Test')
      })

      it('gets a thing by ID components', async () => {
        const thing = await client.getById(ns, 'TestEntity', 'crud-test-1')

        expect(thing).not.toBeNull()
        expect(thing?.data['name']).toBe('Test')
      })

      it('returns null for non-existent thing', async () => {
        const thing = await client.get(`https://${ns}/TestEntity/does-not-exist`)

        expect(thing).toBeNull()
      })

      it('updates a thing', async () => {
        const updated = await client.update(`https://${ns}/TestEntity/crud-test-1`, {
          data: { name: 'Updated', value: 100 },
        })

        expect(updated.data['name']).toBe('Updated')
        expect(updated.data['value']).toBe(100)
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(updated.createdAt.getTime())
      })

      it('upserts a new thing', async () => {
        const thing = await client.upsert({
          ns,
          type: 'TestEntity',
          id: 'crud-test-2',
          data: { name: 'Upserted', value: 200 },
        })

        expect(thing.id).toBe('crud-test-2')
        expect(thing.data['name']).toBe('Upserted')
      })

      it('upserts an existing thing', async () => {
        const thing = await client.upsert({
          ns,
          type: 'TestEntity',
          id: 'crud-test-2',
          data: { name: 'Upserted Again', value: 300 },
        })

        expect(thing.data['name']).toBe('Upserted Again')
        expect(thing.data['value']).toBe(300)
      })

      it('deletes a thing', async () => {
        // Create then delete
        await client.create({
          ns,
          type: 'TestEntity',
          id: 'to-delete',
          data: { temp: true },
        })

        const deleted = await client.delete(`https://${ns}/TestEntity/to-delete`)
        expect(deleted).toBe(true)

        const thing = await client.get(`https://${ns}/TestEntity/to-delete`)
        expect(thing).toBeNull()
      })

      it('returns false when deleting non-existent thing', async () => {
        const deleted = await client.delete(`https://${ns}/TestEntity/never-existed`)
        expect(deleted).toBe(false)
      })
    })

    // =========================================================================
    // Query Operations
    // =========================================================================

    describe('Things - Queries', () => {
      beforeAll(async () => {
        // Seed test data
        for (const user of fixtures.users) {
          await client.upsert({
            ns,
            type: 'User',
            id: user.id,
            data: user,
          })
        }
        for (const post of fixtures.posts) {
          await client.upsert({
            ns,
            type: 'Post',
            id: post.id,
            data: post,
          })
        }
      })

      afterAll(async () => {
        // Cleanup
        for (const user of fixtures.users) {
          try {
            await client.delete(`https://${ns}/User/${user.id}`)
          } catch {
            /* ignore */
          }
        }
        for (const post of fixtures.posts) {
          try {
            await client.delete(`https://${ns}/Post/${post.id}`)
          } catch {
            /* ignore */
          }
        }
      })

      it('lists all things', async () => {
        const things = await client.list({ ns })

        expect(things.length).toBeGreaterThanOrEqual(fixtures.users.length + fixtures.posts.length)
      })

      it('lists things by type', async () => {
        const users = await client.list({ ns, type: 'User' })

        expect(users.length).toBe(fixtures.users.length)
        expect(users.every((u) => u.type === 'User')).toBe(true)
      })

      it('finds things with where clause', async () => {
        const admins = await client.find({
          ns,
          type: 'User',
          where: { role: 'admin' },
        })

        expect(admins.length).toBe(1)
        expect(admins[0]?.data['name']).toBe('Alice')
      })

      it('lists with limit', async () => {
        const things = await client.list({ ns, type: 'User', limit: 2 })

        expect(things.length).toBe(2)
      })

      it('lists with offset', async () => {
        const all = await client.list({ ns, type: 'User', orderBy: 'id' })
        const offset = await client.list({ ns, type: 'User', orderBy: 'id', offset: 1, limit: 2 })

        expect(offset.length).toBe(2)
        expect(offset[0]?.id).toBe(all[1]?.id)
      })

      it('lists with ordering', async () => {
        const asc = await client.list({ ns, type: 'User', orderBy: 'id', order: 'asc' })
        const desc = await client.list({ ns, type: 'User', orderBy: 'id', order: 'desc' })

        expect(asc[0]?.id).toBe('user-1')
        expect(desc[0]?.id).toBe('user-3')
      })

      it('iterates with forEach', async () => {
        const ids: string[] = []

        await client.forEach({ ns, type: 'User' }, (thing) => {
          ids.push(thing.id)
        })

        expect(ids.length).toBe(fixtures.users.length)
      })
    })

    // =========================================================================
    // Search Operations
    // =========================================================================

    if (!skip.search) {
      describe('Things - Search', () => {
        beforeAll(async () => {
          // Ensure test data exists
          for (const post of fixtures.posts) {
            await client.upsert({
              ns,
              type: 'Post',
              id: post.id,
              data: post,
            })
          }
        })

        it('searches by query string', async () => {
          const results = await client.search({
            ns,
            type: 'Post',
            query: 'Hello',
          })

          expect(results.length).toBeGreaterThanOrEqual(1)
          expect(results.some((r) => r.data['title'] === 'Hello World')).toBe(true)
        })

        it('searches across fields', async () => {
          const results = await client.search({
            ns,
            type: 'Post',
            query: 'Bob',
          })

          expect(results.some((r) => r.data['title'] === 'Bobs Post')).toBe(true)
        })
      })
    }

    // =========================================================================
    // Relationship Operations
    // =========================================================================

    if (!skip.relationships) {
      describe('Relationships', () => {
        const authorUrl = `https://${ns}/User/user-1`
        const postUrl = `https://${ns}/Post/post-1`

        beforeAll(async () => {
          // Ensure entities exist
          await client.upsert({ ns, type: 'User', id: 'user-1', data: fixtures.users[0]! })
          await client.upsert({ ns, type: 'Post', id: 'post-1', data: fixtures.posts[0]! })
        })

        afterAll(async () => {
          try {
            await client.unrelate(postUrl, 'author', authorUrl)
          } catch {
            /* ignore */
          }
        })

        it('creates a relationship', async () => {
          const rel = await client.relate({
            type: 'author',
            from: postUrl,
            to: authorUrl,
          })

          expect(rel).toBeDefined()
          expect(rel.type).toBe('author')
          expect(rel.from).toBe(postUrl)
          expect(rel.to).toBe(authorUrl)
        })

        it('queries outbound related things', async () => {
          const authors = await client.related(postUrl, 'author', 'to')

          expect(authors.length).toBe(1)
          expect(authors[0]?.id).toBe('user-1')
        })

        it('queries inbound references', async () => {
          const posts = await client.references(authorUrl, 'author')

          expect(posts.length).toBeGreaterThanOrEqual(1)
          expect(posts.some((p) => p.id === 'post-1')).toBe(true)
        })

        it('lists relationships', async () => {
          const rels = await client.relationships(postUrl, 'author')

          expect(rels.length).toBeGreaterThanOrEqual(1)
          expect(rels[0]?.type).toBe('author')
        })

        it('removes a relationship', async () => {
          const removed = await client.unrelate(postUrl, 'author', authorUrl)
          expect(removed).toBe(true)

          const rels = await client.relationships(postUrl, 'author')
          expect(rels.length).toBe(0)
        })
      })
    }
  })
}

// =============================================================================
// Extended Test Factory (Events, Actions, Artifacts)
// =============================================================================

/**
 * Create extended tests for DBClientExtended implementations
 *
 * Includes all DBClient tests plus Events, Actions, and Artifacts
 *
 * @example
 * ```ts
 * import { createExtendedTests } from 'ai-database/tests'
 *
 * createExtendedTests('ClickHouse', {
 *   factory: () => createClickHouseDatabase({ url: '...' })
 * })
 * ```
 */
export function createExtendedTests<T extends DBClientExtended>(
  name: string,
  options: CreateTestsOptions<T>
): void {
  const { factory, cleanup, skip = {}, ns = fixtures.ns } = options

  // Run base DBClient tests
  createTests(name, options as CreateTestsOptions<DBClient>)

  describe(`${name} Extended Compliance Tests`, () => {
    let client: T

    beforeAll(async () => {
      client = await factory()
    })

    afterAll(async () => {
      await client.close?.()
      await cleanup?.()
    })

    // =========================================================================
    // Event Operations
    // =========================================================================

    if (!skip.events) {
      describe('Events', () => {
        let eventId: string

        it('tracks an event', async () => {
          const event = await client.track({
            type: 'User.created',
            source: 'test-suite',
            data: { userId: 'user-1', action: 'signup' },
          })

          eventId = event.id

          expect(event).toBeDefined()
          expect(event.id).toBeDefined()
          expect(event.type).toBe('User.created')
          expect(event.source).toBe('test-suite')
          expect(event.timestamp).toBeInstanceOf(Date)
        })

        it('gets an event by ID', async () => {
          const event = await client.getEvent(eventId)

          expect(event).not.toBeNull()
          expect(event?.type).toBe('User.created')
        })

        it('queries events by type', async () => {
          const events = await client.queryEvents({ type: 'User.created' })

          expect(events.length).toBeGreaterThanOrEqual(1)
          expect(events.every((e) => e.type === 'User.created')).toBe(true)
        })

        it('queries events by source', async () => {
          const events = await client.queryEvents({ source: 'test-suite' })

          expect(events.length).toBeGreaterThanOrEqual(1)
        })

        it('tracks event with correlation ID', async () => {
          const event = await client.track({
            type: 'Order.placed',
            source: 'test-suite',
            data: { orderId: 'order-1' },
            correlationId: 'session-123',
          })

          expect(event.correlationId).toBe('session-123')

          const related = await client.queryEvents({ correlationId: 'session-123' })
          expect(related.some((e) => e.id === event.id)).toBe(true)
        })
      })
    }

    // =========================================================================
    // Action Operations
    // =========================================================================

    if (!skip.actions) {
      describe('Actions', () => {
        let actionId: string

        it('sends an action (pending)', async () => {
          const action = await client.send({
            actor: 'user:test-user',
            object: `https://${ns}/Order/order-1`,
            action: 'approve',
          })

          actionId = action.id

          expect(action).toBeDefined()
          expect(action.status).toBe('pending')
          expect(action.actor).toBe('user:test-user')
          expect(action.action).toBe('approve')
        })

        it('does an action (active)', async () => {
          const action = await client.do({
            actor: 'user:test-user',
            object: `https://${ns}/Order/order-2`,
            action: 'process',
          })

          expect(action.status).toBe('active')
          expect(action.startedAt).toBeInstanceOf(Date)
        })

        it('gets an action by ID', async () => {
          const action = await client.getAction(actionId)

          expect(action).not.toBeNull()
          expect(action?.action).toBe('approve')
        })

        it('starts a pending action', async () => {
          const started = await client.startAction(actionId)

          expect(started.status).toBe('active')
          expect(started.startedAt).toBeInstanceOf(Date)
        })

        it('completes an action', async () => {
          const completed = await client.completeAction(actionId, { approved: true })

          expect(completed.status).toBe('completed')
          expect(completed.completedAt).toBeInstanceOf(Date)
          expect(completed.result).toEqual({ approved: true })
        })

        it('fails an action', async () => {
          const action = await client.do({
            actor: 'system',
            object: `https://${ns}/Task/task-1`,
            action: 'process',
          })

          const failed = await client.failAction(action.id, 'Connection timeout')

          expect(failed.status).toBe('failed')
          expect(failed.error).toBe('Connection timeout')
        })

        it('cancels an action', async () => {
          const action = await client.send({
            actor: 'user:test-user',
            object: `https://${ns}/Report/report-1`,
            action: 'generate',
          })

          const cancelled = await client.cancelAction(action.id)

          expect(cancelled.status).toBe('cancelled')
        })

        it('queries actions by status', async () => {
          const completed = await client.queryActions({ status: 'completed' })

          expect(completed.every((a) => a.status === 'completed')).toBe(true)
        })

        it('queries actions by actor', async () => {
          const actions = await client.queryActions({ actor: 'user:test-user' })

          expect(actions.every((a) => a.actor === 'user:test-user')).toBe(true)
        })
      })
    }

    // =========================================================================
    // Artifact Operations
    // =========================================================================

    if (!skip.artifacts) {
      describe('Artifacts', () => {
        const artifactKey = 'test-artifact-1'

        afterAll(async () => {
          try {
            await client.deleteArtifact(artifactKey)
          } catch {
            /* ignore */
          }
        })

        it('stores an artifact', async () => {
          const artifact = await client.storeArtifact({
            key: artifactKey,
            type: 'esm',
            source: `https://${ns}/Module/module-1`,
            sourceHash: 'abc123',
            content: 'export const foo = 42',
          })

          expect(artifact).toBeDefined()
          expect(artifact.key).toBe(artifactKey)
          expect(artifact.type).toBe('esm')
          expect(artifact.content).toBe('export const foo = 42')
        })

        it('gets an artifact by key', async () => {
          const artifact = await client.getArtifact(artifactKey)

          expect(artifact).not.toBeNull()
          expect(artifact?.content).toBe('export const foo = 42')
        })

        it('gets artifact by source', async () => {
          const artifact = await client.getArtifactBySource(`https://${ns}/Module/module-1`, 'esm')

          expect(artifact).not.toBeNull()
          expect(artifact?.key).toBe(artifactKey)
        })

        it('deletes an artifact', async () => {
          await client.storeArtifact({
            key: 'to-delete',
            type: 'ast',
            source: `https://${ns}/File/file-1`,
            sourceHash: 'xyz789',
            content: { type: 'Program', body: [] },
          })

          const deleted = await client.deleteArtifact('to-delete')
          expect(deleted).toBe(true)

          const artifact = await client.getArtifact('to-delete')
          expect(artifact).toBeNull()
        })

        it('stores artifact with TTL', async () => {
          const artifact = await client.storeArtifact({
            key: 'ttl-artifact',
            type: 'html',
            source: `https://${ns}/Page/page-1`,
            sourceHash: 'def456',
            content: '<html></html>',
            ttl: 60000, // 1 minute
          })

          expect(artifact.expiresAt).toBeInstanceOf(Date)
          expect(artifact.expiresAt!.getTime()).toBeGreaterThan(Date.now())

          // Cleanup
          await client.deleteArtifact('ttl-artifact')
        })
      })
    }
  })
}

// =============================================================================
// Re-export for convenience
// =============================================================================

export { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
