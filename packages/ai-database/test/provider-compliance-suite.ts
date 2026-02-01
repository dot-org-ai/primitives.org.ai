/**
 * Provider Compliance Test Suite
 *
 * A shared test suite that can run against any DBProvider implementation
 * to verify compliance with the DBProvider interface.
 *
 * @example
 * ```ts
 * import { createProviderComplianceSuite } from './provider-compliance-suite.js'
 * import { createMemoryProvider } from '../src/memory-provider.js'
 *
 * createProviderComplianceSuite('MemoryProvider', {
 *   factory: () => createMemoryProvider(),
 *   capabilities: {
 *     extended: true,
 *     transactions: true,
 *     semanticSearch: true,
 *     events: true,
 *     actions: true,
 *     artifacts: true,
 *   },
 * })
 * ```
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DBProvider, DBProviderExtended, Transaction } from '../src/schema/provider.js'

/**
 * Capabilities for the provider being tested
 */
export interface ProviderCapabilities {
  /** Provider implements DBProviderExtended interface */
  extended?: boolean
  /** Provider supports transactions via beginTransaction() */
  transactions?: boolean
  /** Provider supports semantic (vector) search */
  semanticSearch?: boolean
  /** Provider supports events API (on, emit, listEvents, replayEvents) */
  events?: boolean
  /** Provider supports actions API (createAction, getAction, etc.) */
  actions?: boolean
  /** Provider supports artifacts API (getArtifact, setArtifact, etc.) */
  artifacts?: boolean
}

/**
 * Options for creating a provider compliance suite
 */
export interface ProviderComplianceSuiteOptions {
  /** Factory function to create a new provider instance */
  factory: () => DBProvider | Promise<DBProvider>
  /** Optional cleanup function called after each test */
  cleanup?: () => void | Promise<void>
  /** Provider capabilities (controls which test suites run) */
  capabilities?: ProviderCapabilities
}

/**
 * Create a compliance test suite for a DBProvider implementation
 *
 * @param name - Name of the provider being tested
 * @param options - Suite options including factory and capabilities
 */
export function createProviderComplianceSuite(
  name: string,
  options: ProviderComplianceSuiteOptions
): void {
  const { factory, cleanup, capabilities = {} } = options

  describe(`${name} Compliance Suite`, () => {
    let provider: DBProvider

    beforeEach(async () => {
      provider = await factory()
    })

    afterEach(async () => {
      if (cleanup) {
        await cleanup()
      }
      // Clear provider if it has a clear method (like MemoryProvider)
      if ('clear' in provider && typeof (provider as any).clear === 'function') {
        ;(provider as any).clear()
      }
    })

    // =========================================================================
    // Core CRUD Tests (required for all providers)
    // =========================================================================

    describe('Core CRUD Operations', () => {
      describe('create', () => {
        it('creates an entity with generated ID', async () => {
          const result = await provider.create('User', undefined, {
            name: 'John Doe',
            email: 'john@example.com',
          })

          expect(result.$id).toBeDefined()
          expect(result.$type).toBe('User')
          expect(result.name).toBe('John Doe')
          expect(result.email).toBe('john@example.com')
        })

        it('creates an entity with provided ID', async () => {
          const result = await provider.create('User', 'john', {
            name: 'John Doe',
          })

          expect(result.$id).toBe('john')
          expect(result.$type).toBe('User')
          expect(result.name).toBe('John Doe')
        })

        it('throws error if entity already exists', async () => {
          await provider.create('User', 'john', { name: 'John' })

          await expect(provider.create('User', 'john', { name: 'Jane' })).rejects.toThrow()
        })

        it('stores createdAt and updatedAt timestamps', async () => {
          const result = await provider.create('User', 'john', { name: 'John' })

          expect(result.createdAt).toBeDefined()
          expect(result.updatedAt).toBeDefined()
        })
      })

      describe('get', () => {
        it('retrieves an existing entity', async () => {
          await provider.create('User', 'john', {
            name: 'John Doe',
            email: 'john@example.com',
          })

          const result = await provider.get('User', 'john')

          expect(result).toBeDefined()
          expect(result?.$id).toBe('john')
          expect(result?.$type).toBe('User')
          expect(result?.name).toBe('John Doe')
        })

        it('returns null for non-existent entity', async () => {
          const result = await provider.get('User', 'nonexistent')
          expect(result).toBeNull()
        })

        it('returns null for wrong type', async () => {
          await provider.create('User', 'john', { name: 'John' })
          const result = await provider.get('Post', 'john')
          expect(result).toBeNull()
        })
      })

      describe('update', () => {
        it('updates an existing entity', async () => {
          await provider.create('User', 'john', {
            name: 'John',
            email: 'john@example.com',
          })

          const result = await provider.update('User', 'john', {
            name: 'John Doe',
            role: 'admin',
          })

          expect(result.name).toBe('John Doe')
          expect(result.email).toBe('john@example.com')
          expect(result.role).toBe('admin')
        })

        it('updates updatedAt timestamp', async () => {
          await provider.create('User', 'john', { name: 'John' })

          // Small delay to ensure timestamp difference
          await new Promise((resolve) => setTimeout(resolve, 10))

          const result = await provider.update('User', 'john', { name: 'Jane' })

          expect(result.updatedAt).toBeDefined()
          expect(result.createdAt).toBeDefined()
          expect(new Date(result.updatedAt as string).getTime()).toBeGreaterThanOrEqual(
            new Date(result.createdAt as string).getTime()
          )
        })

        it('throws error if entity does not exist', async () => {
          await expect(provider.update('User', 'nonexistent', { name: 'Jane' })).rejects.toThrow()
        })

        it('merges with existing data', async () => {
          await provider.create('User', 'john', {
            name: 'John',
            email: 'john@example.com',
            age: 30,
          })

          const result = await provider.update('User', 'john', {
            age: 31,
          })

          expect(result.name).toBe('John')
          expect(result.email).toBe('john@example.com')
          expect(result.age).toBe(31)
        })
      })

      describe('delete', () => {
        it('deletes an existing entity', async () => {
          await provider.create('User', 'john', { name: 'John' })

          const result = await provider.delete('User', 'john')
          expect(result).toBe(true)

          const retrieved = await provider.get('User', 'john')
          expect(retrieved).toBeNull()
        })

        it('returns false for non-existent entity', async () => {
          const result = await provider.delete('User', 'nonexistent')
          expect(result).toBe(false)
        })

        it('cleans up relations when deleting entity', async () => {
          await provider.create('User', 'john', { name: 'John' })
          await provider.create('Post', 'post1', { title: 'Hello' })
          await provider.relate('User', 'john', 'posts', 'Post', 'post1')

          await provider.delete('User', 'john')

          const related = await provider.related('Post', 'post1', 'author')
          expect(related).toEqual([])
        })
      })
    })

    // =========================================================================
    // List Tests
    // =========================================================================

    describe('List Operations', () => {
      beforeEach(async () => {
        await provider.create('User', 'john', { name: 'John', age: 30 })
        await provider.create('User', 'jane', { name: 'Jane', age: 25 })
        await provider.create('User', 'bob', { name: 'Bob', age: 35 })
      })

      it('lists all entities of a type', async () => {
        const results = await provider.list('User')

        expect(results).toHaveLength(3)
        expect(results.map((r) => r.$id)).toContain('john')
        expect(results.map((r) => r.$id)).toContain('jane')
        expect(results.map((r) => r.$id)).toContain('bob')
      })

      it('filters by where clause', async () => {
        const results = await provider.list('User', {
          where: { age: 30 },
        })

        expect(results).toHaveLength(1)
        expect(results[0]?.name).toBe('John')
      })

      it('filters by multiple where conditions', async () => {
        await provider.create('User', 'alice', { name: 'Alice', age: 30, active: true })
        await provider.create('User', 'charlie', { name: 'Charlie', age: 30, active: false })

        const results = await provider.list('User', {
          where: { age: 30, active: true },
        })

        expect(results).toHaveLength(1)
        expect(results[0]?.name).toBe('Alice')
      })

      it('sorts by field ascending', async () => {
        const results = await provider.list('User', {
          orderBy: 'age',
          order: 'asc',
        })

        expect(results.map((r) => r.age)).toEqual([25, 30, 35])
      })

      it('sorts by field descending', async () => {
        const results = await provider.list('User', {
          orderBy: 'age',
          order: 'desc',
        })

        expect(results.map((r) => r.age)).toEqual([35, 30, 25])
      })

      it('limits results', async () => {
        const results = await provider.list('User', {
          limit: 2,
        })

        expect(results).toHaveLength(2)
      })

      it('offsets results', async () => {
        const results = await provider.list('User', {
          orderBy: 'name',
          order: 'asc',
          offset: 1,
        })

        expect(results).toHaveLength(2)
        expect(results[0]?.name).not.toBe('Bob')
      })

      it('combines limit and offset', async () => {
        const results = await provider.list('User', {
          orderBy: 'name',
          order: 'asc',
          limit: 1,
          offset: 1,
        })

        expect(results).toHaveLength(1)
      })

      it('returns empty array for non-existent type', async () => {
        const results = await provider.list('NonExistent')
        expect(results).toEqual([])
      })
    })

    // =========================================================================
    // Search Tests
    // =========================================================================

    describe('Search Operations', () => {
      beforeEach(async () => {
        await provider.create('Post', 'post1', {
          title: 'Introduction to TypeScript',
          content: 'TypeScript is a typed superset of JavaScript',
        })
        await provider.create('Post', 'post2', {
          title: 'Advanced JavaScript',
          content: 'Deep dive into JavaScript patterns',
        })
        await provider.create('Post', 'post3', {
          title: 'Python Guide',
          content: 'Getting started with Python programming',
        })
      })

      it('searches across all fields by default', async () => {
        const results = await provider.search('Post', 'TypeScript')

        expect(results).toHaveLength(1)
        expect(results[0]?.title).toBe('Introduction to TypeScript')
      })

      it('searches case-insensitively', async () => {
        const results = await provider.search('Post', 'javascript')

        expect(results.length).toBeGreaterThan(0)
        expect(results.map((r) => r.title)).toContain('Advanced JavaScript')
      })

      it('searches specific fields', async () => {
        const results = await provider.search('Post', 'JavaScript', {
          fields: ['title'],
        })

        expect(results).toHaveLength(1)
        expect(results[0]?.title).toBe('Advanced JavaScript')
      })

      it('combines search with where clause', async () => {
        await provider.create('Post', 'post4', {
          title: 'TypeScript Tips',
          category: 'tutorial',
        })
        await provider.create('Post', 'post5', {
          title: 'TypeScript News',
          category: 'news',
        })

        const results = await provider.search('Post', 'TypeScript', {
          where: { category: 'tutorial' },
        })

        expect(results).toHaveLength(1)
        expect(results[0]?.title).toBe('TypeScript Tips')
      })

      it('returns empty array for no matches', async () => {
        const results = await provider.search('Post', 'nonexistent')
        expect(results).toEqual([])
      })
    })

    // =========================================================================
    // Relationship Tests
    // =========================================================================

    describe('Relationship Operations', () => {
      beforeEach(async () => {
        await provider.create('User', 'john', { name: 'John' })
        await provider.create('Post', 'post1', { title: 'Hello' })
        await provider.create('Post', 'post2', { title: 'World' })
      })

      it('creates a relationship', async () => {
        await provider.relate('User', 'john', 'posts', 'Post', 'post1')

        const related = await provider.related('User', 'john', 'posts')
        expect(related).toHaveLength(1)
        expect(related[0]?.$id).toBe('post1')
      })

      it('creates multiple relationships', async () => {
        await provider.relate('User', 'john', 'posts', 'Post', 'post1')
        await provider.relate('User', 'john', 'posts', 'Post', 'post2')

        const related = await provider.related('User', 'john', 'posts')
        expect(related).toHaveLength(2)
        expect(related.map((r) => r.$id)).toContain('post1')
        expect(related.map((r) => r.$id)).toContain('post2')
      })

      it('removes a relationship', async () => {
        await provider.relate('User', 'john', 'posts', 'Post', 'post1')
        await provider.relate('User', 'john', 'posts', 'Post', 'post2')

        await provider.unrelate('User', 'john', 'posts', 'Post', 'post1')

        const related = await provider.related('User', 'john', 'posts')
        expect(related).toHaveLength(1)
        expect(related[0]?.$id).toBe('post2')
      })

      it('returns empty array for no relationships', async () => {
        const related = await provider.related('User', 'john', 'posts')
        expect(related).toEqual([])
      })

      it('handles different relation types', async () => {
        await provider.create('Tag', 'tag1', { name: 'typescript' })

        await provider.relate('Post', 'post1', 'tags', 'Tag', 'tag1')
        await provider.relate('Post', 'post1', 'author', 'User', 'john')

        const tags = await provider.related('Post', 'post1', 'tags')
        const author = await provider.related('Post', 'post1', 'author')

        expect(tags).toHaveLength(1)
        expect(author).toHaveLength(1)
      })
    })

    // =========================================================================
    // Transaction Tests (optional)
    // =========================================================================

    describe.skipIf(!capabilities.transactions)('Transaction Operations', () => {
      it('creates entities within a transaction', async () => {
        const txn = await (
          provider as DBProvider & { beginTransaction: () => Promise<Transaction> }
        ).beginTransaction()

        await txn.create('User', 'john', { name: 'John' })
        await txn.create('User', 'jane', { name: 'Jane' })

        // Before commit, entities should not be visible to the main provider
        const beforeCommit = await provider.get('User', 'john')
        expect(beforeCommit).toBeNull()

        await txn.commit()

        // After commit, entities should be visible
        const afterCommit = await provider.get('User', 'john')
        expect(afterCommit).not.toBeNull()
        expect(afterCommit?.name).toBe('John')
      })

      it('rolls back transaction on rollback', async () => {
        await provider.create('User', 'existing', { name: 'Existing' })

        const txn = await (
          provider as DBProvider & { beginTransaction: () => Promise<Transaction> }
        ).beginTransaction()

        await txn.create('User', 'john', { name: 'John' })
        await txn.update('User', 'existing', { name: 'Updated' })

        await txn.rollback()

        // Transaction changes should not persist
        const john = await provider.get('User', 'john')
        expect(john).toBeNull()

        const existing = await provider.get('User', 'existing')
        expect(existing?.name).toBe('Existing')
      })

      it('sees buffered writes within transaction', async () => {
        const txn = await (
          provider as DBProvider & { beginTransaction: () => Promise<Transaction> }
        ).beginTransaction()

        await txn.create('User', 'john', { name: 'John' })

        // Within transaction, should see the entity
        const inTxn = await txn.get('User', 'john')
        expect(inTxn).not.toBeNull()
        expect(inTxn?.name).toBe('John')
      })

      it('creates relationships within transaction', async () => {
        const txn = await (
          provider as DBProvider & { beginTransaction: () => Promise<Transaction> }
        ).beginTransaction()

        await txn.create('User', 'john', { name: 'John' })
        await txn.create('Post', 'post1', { title: 'Hello' })
        await txn.relate('User', 'john', 'posts', 'Post', 'post1')

        await txn.commit()

        const related = await provider.related('User', 'john', 'posts')
        expect(related).toHaveLength(1)
      })
    })

    // =========================================================================
    // Semantic Search Tests (optional - requires extended provider)
    // =========================================================================

    describe.skipIf(!capabilities.semanticSearch)('Semantic Search Operations', () => {
      const extProvider = () => provider as DBProviderExtended

      beforeEach(async () => {
        // Set up embeddings config
        if ('setEmbeddingsConfig' in provider) {
          ;(provider as DBProviderExtended).setEmbeddingsConfig({
            Post: { fields: ['title', 'content'] },
          })
        }

        await provider.create('Post', 'post1', {
          title: 'Introduction to Machine Learning',
          content: 'Machine learning is a subset of artificial intelligence',
        })
        await provider.create('Post', 'post2', {
          title: 'Deep Learning Fundamentals',
          content: 'Neural networks and deep learning concepts',
        })
        await provider.create('Post', 'post3', {
          title: 'Italian Cooking Recipes',
          content: 'How to make authentic Italian pasta',
        })
      })

      it('finds semantically similar entities', async () => {
        const results = await extProvider().semanticSearch('Post', 'AI and neural networks')

        expect(results.length).toBeGreaterThan(0)
        // ML/AI posts should rank higher than cooking post
        const mlPost = results.find((r) => r.$id === 'post1' || r.$id === 'post2')
        expect(mlPost).toBeDefined()
      })

      it('includes similarity scores', async () => {
        const results = await extProvider().semanticSearch('Post', 'machine learning')

        expect(results.length).toBeGreaterThan(0)
        expect(results[0]?.$score).toBeDefined()
        expect(typeof results[0]?.$score).toBe('number')
      })

      it('respects limit option', async () => {
        const results = await extProvider().semanticSearch('Post', 'programming', {
          limit: 1,
        })

        expect(results.length).toBeLessThanOrEqual(1)
      })

      it('respects minScore option', async () => {
        const results = await extProvider().semanticSearch('Post', 'machine learning', {
          minScore: 0.9,
        })

        // All results should have score >= minScore
        for (const result of results) {
          expect(result.$score).toBeGreaterThanOrEqual(0.9)
        }
      })
    })

    // =========================================================================
    // Events Tests (optional - requires extended provider)
    // =========================================================================

    describe.skipIf(!capabilities.events)('Events Operations', () => {
      const extProvider = () => provider as DBProviderExtended

      it('emits events on create', async () => {
        const handler = vi.fn()
        extProvider().on('User.created', handler)

        await provider.create('User', 'john', { name: 'John' })

        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0][0].event || handler.mock.calls[0][0].type).toBe('User.created')
      })

      it('emits events on update', async () => {
        await provider.create('User', 'john', { name: 'John' })

        const handler = vi.fn()
        extProvider().on('User.updated', handler)

        await provider.update('User', 'john', { name: 'Jane' })

        expect(handler).toHaveBeenCalledTimes(1)
      })

      it('emits events on delete', async () => {
        await provider.create('User', 'john', { name: 'John' })

        const handler = vi.fn()
        extProvider().on('User.deleted', handler)

        await provider.delete('User', 'john')

        expect(handler).toHaveBeenCalledTimes(1)
      })

      it('supports wildcard pattern matching with Type.*', async () => {
        const handler = vi.fn()
        extProvider().on('User.*', handler)

        await provider.create('User', 'john', { name: 'John' })
        await provider.update('User', 'john', { name: 'Jane' })
        await provider.delete('User', 'john')

        expect(handler).toHaveBeenCalledTimes(3)
      })

      it('supports wildcard pattern matching with *.action', async () => {
        const handler = vi.fn()
        extProvider().on('*.created', handler)

        await provider.create('User', 'john', { name: 'John' })
        await provider.create('Post', 'post1', { title: 'Hello' })

        expect(handler).toHaveBeenCalledTimes(2)
      })

      it('allows unsubscribing from events', async () => {
        const handler = vi.fn()
        const unsubscribe = extProvider().on('User.created', handler)

        await provider.create('User', 'john', { name: 'John' })
        expect(handler).toHaveBeenCalledTimes(1)

        unsubscribe()

        await provider.create('User', 'jane', { name: 'Jane' })
        expect(handler).toHaveBeenCalledTimes(1)
      })

      it('lists events with filters', async () => {
        await provider.create('User', 'john', { name: 'John' })
        await provider.create('Post', 'post1', { title: 'Hello' })
        await provider.update('User', 'john', { name: 'Jane' })

        const allEvents = await extProvider().listEvents()
        expect(allEvents.length).toBeGreaterThanOrEqual(3)

        const userEvents = await extProvider().listEvents({ event: 'User.*' })
        expect(userEvents.length).toBe(2)
      })

      it('replays events', async () => {
        await provider.create('User', 'john', { name: 'John' })
        await provider.create('User', 'jane', { name: 'Jane' })

        const replayedEvents: string[] = []
        await extProvider().replayEvents({
          event: 'User.created',
          handler: (event) => {
            replayedEvents.push(
              ((event.objectData as { name: string }) || (event.data as { name: string }))?.name
            )
          },
        })

        expect(replayedEvents).toEqual(['John', 'Jane'])
      })
    })

    // =========================================================================
    // Actions Tests (optional - requires extended provider)
    // =========================================================================

    describe.skipIf(!capabilities.actions)('Actions Operations', () => {
      const extProvider = () => provider as DBProviderExtended

      it('creates a pending action', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: { items: ['a', 'b', 'c'] },
          total: 3,
        })

        expect(action.id).toBeDefined()
        expect(action.status).toBe('pending')
        expect(action.total).toBe(3)
        expect(action.progress).toBe(0)
      })

      it('updates action status to active', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })

        const updated = await extProvider().updateAction(action.id, {
          status: 'active',
        })

        expect(updated.status).toBe('active')
        expect(updated.startedAt).toBeDefined()
      })

      it('updates action progress', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
          total: 10,
        })

        const updated = await extProvider().updateAction(action.id, {
          progress: 5,
        })

        expect(updated.progress).toBe(5)
      })

      it('marks action as completed', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })

        const completed = await extProvider().updateAction(action.id, {
          status: 'completed',
          result: { success: true },
        })

        expect(completed.status).toBe('completed')
        expect(completed.completedAt).toBeDefined()
        expect(completed.result).toEqual({ success: true })
      })

      it('marks action as failed', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })

        const failed = await extProvider().updateAction(action.id, {
          status: 'failed',
          error: 'Something went wrong',
        })

        expect(failed.status).toBe('failed')
        expect(failed.completedAt).toBeDefined()
        expect(failed.error).toBe('Something went wrong')
      })

      it('retrieves an action by id', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: { foo: 'bar' },
        })

        const retrieved = await extProvider().getAction(action.id)

        expect(retrieved).not.toBeNull()
        expect(retrieved?.data).toEqual({ foo: 'bar' })
      })

      it('returns null for non-existent action', async () => {
        const retrieved = await extProvider().getAction('nonexistent')
        expect(retrieved).toBeNull()
      })

      it('lists actions by status', async () => {
        await extProvider().createAction({ type: 'task1', data: {} })
        const action2 = await extProvider().createAction({ type: 'task2', data: {} })
        await extProvider().updateAction(action2.id, { status: 'completed' })

        const pending = await extProvider().listActions({ status: 'pending' })
        const completed = await extProvider().listActions({ status: 'completed' })

        expect(pending).toHaveLength(1)
        expect(completed).toHaveLength(1)
      })

      it('retries failed actions', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })
        await extProvider().updateAction(action.id, {
          status: 'failed',
          error: 'Network error',
        })

        const retried = await extProvider().retryAction(action.id)

        expect(retried.status).toBe('pending')
        expect(retried.error).toBeUndefined()
      })

      it('throws error when retrying non-failed action', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })

        await expect(extProvider().retryAction(action.id)).rejects.toThrow()
      })

      it('cancels pending action', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })

        await extProvider().cancelAction(action.id)

        const cancelled = await extProvider().getAction(action.id)
        expect(cancelled?.status).toBe('cancelled')
      })

      it('throws error when cancelling completed action', async () => {
        const action = await extProvider().createAction({
          type: 'batch-embed',
          data: {},
        })
        await extProvider().updateAction(action.id, { status: 'completed' })

        await expect(extProvider().cancelAction(action.id)).rejects.toThrow()
      })
    })

    // =========================================================================
    // Artifacts Tests (optional - requires extended provider)
    // =========================================================================

    describe.skipIf(!capabilities.artifacts)('Artifacts Operations', () => {
      const extProvider = () => provider as DBProviderExtended

      it('stores an artifact', async () => {
        await extProvider().setArtifact('User/john', 'embedding', {
          content: [0.1, 0.2, 0.3],
          sourceHash: 'abc123',
        })

        const artifact = await extProvider().getArtifact('User/john', 'embedding')

        expect(artifact).not.toBeNull()
        expect(artifact?.content).toEqual([0.1, 0.2, 0.3])
        expect(artifact?.sourceHash).toBe('abc123')
      })

      it('stores artifact with metadata', async () => {
        await extProvider().setArtifact('User/john', 'embedding', {
          content: [0.1, 0.2, 0.3],
          sourceHash: 'abc123',
          metadata: { model: 'gemini-embedding-001', dimensions: 768 },
        })

        const artifact = await extProvider().getArtifact('User/john', 'embedding')

        expect(artifact?.metadata).toEqual({
          model: 'gemini-embedding-001',
          dimensions: 768,
        })
      })

      it('returns null for non-existent artifact', async () => {
        const artifact = await extProvider().getArtifact('User/john', 'embedding')
        expect(artifact).toBeNull()
      })

      it('stores multiple artifact types for same url', async () => {
        await extProvider().setArtifact('Post/post1', 'embedding', {
          content: [0.1, 0.2],
          sourceHash: 'abc',
        })
        await extProvider().setArtifact('Post/post1', 'chunks', {
          content: ['chunk1', 'chunk2'],
          sourceHash: 'def',
        })

        const embedding = await extProvider().getArtifact('Post/post1', 'embedding')
        const chunks = await extProvider().getArtifact('Post/post1', 'chunks')

        expect(embedding?.content).toEqual([0.1, 0.2])
        expect(chunks?.content).toEqual(['chunk1', 'chunk2'])
      })

      it('deletes specific artifact type', async () => {
        await extProvider().setArtifact('Post/post1', 'embedding', {
          content: [0.1],
          sourceHash: 'abc',
        })
        await extProvider().setArtifact('Post/post1', 'chunks', {
          content: ['chunk1'],
          sourceHash: 'def',
        })

        await extProvider().deleteArtifact('Post/post1', 'embedding')

        const embedding = await extProvider().getArtifact('Post/post1', 'embedding')
        const chunks = await extProvider().getArtifact('Post/post1', 'chunks')

        expect(embedding).toBeNull()
        expect(chunks).not.toBeNull()
      })

      it('deletes all artifacts for url', async () => {
        await extProvider().setArtifact('Post/post1', 'embedding', {
          content: [0.1],
          sourceHash: 'abc',
        })
        await extProvider().setArtifact('Post/post1', 'chunks', {
          content: ['chunk1'],
          sourceHash: 'def',
        })

        await extProvider().deleteArtifact('Post/post1')

        const embedding = await extProvider().getArtifact('Post/post1', 'embedding')
        const chunks = await extProvider().getArtifact('Post/post1', 'chunks')

        expect(embedding).toBeNull()
        expect(chunks).toBeNull()
      })

      it('lists all artifacts for url', async () => {
        await extProvider().setArtifact('Post/post1', 'embedding', {
          content: [0.1],
          sourceHash: 'abc',
        })
        await extProvider().setArtifact('Post/post1', 'chunks', {
          content: ['chunk1'],
          sourceHash: 'def',
        })
        await extProvider().setArtifact('Post/post2', 'embedding', {
          content: [0.2],
          sourceHash: 'ghi',
        })

        const artifacts = await extProvider().listArtifacts('Post/post1')

        expect(artifacts).toHaveLength(2)
        expect(artifacts.map((a) => a.type)).toContain('embedding')
        expect(artifacts.map((a) => a.type)).toContain('chunks')
      })

      it('cleans up artifacts on entity delete', async () => {
        await provider.create('User', 'john', { name: 'John' })
        await extProvider().setArtifact('User/john', 'embedding', {
          content: [0.1],
          sourceHash: 'abc',
        })

        await provider.delete('User', 'john')

        const artifacts = await extProvider().listArtifacts('User/john')
        expect(artifacts).toHaveLength(0)
      })
    })
  })
}
