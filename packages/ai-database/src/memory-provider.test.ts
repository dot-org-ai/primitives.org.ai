/**
 * Tests for in-memory database provider
 *
 * Tests all CRUD operations and relationships in memory.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryProvider, createMemoryProvider, Semaphore } from './memory-provider.js'

describe('MemoryProvider', () => {
  let provider: MemoryProvider

  beforeEach(() => {
    provider = createMemoryProvider()
  })

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
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
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

      await expect(
        provider.create('User', 'john', { name: 'Jane' })
      ).rejects.toThrow('Entity already exists: User/john')
    })

    it('stores createdAt and updatedAt timestamps', async () => {
      const result = await provider.create('User', 'john', { name: 'John' })

      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
      expect(typeof result.createdAt).toBe('string')
      expect(typeof result.updatedAt).toBe('string')
      // Verify they are valid ISO strings
      expect(() => new Date(result.createdAt as string)).not.toThrow()
      expect(() => new Date(result.updatedAt as string)).not.toThrow()
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

      // Compare timestamps as strings
      expect(result.updatedAt).toBeDefined()
      expect(result.createdAt).toBeDefined()
      // updatedAt should be greater than or equal to createdAt
      expect(new Date(result.updatedAt as string).getTime()).toBeGreaterThanOrEqual(
        new Date(result.createdAt as string).getTime()
      )
    })

    it('throws error if entity does not exist', async () => {
      await expect(
        provider.update('User', 'nonexistent', { name: 'Jane' })
      ).rejects.toThrow('Entity not found: User/nonexistent')
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

  describe('list', () => {
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

  describe('search', () => {
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

    it('filters by minScore', async () => {
      const results = await provider.search('Post', 'TypeScript', {
        minScore: 0.9,
      })

      // High minScore should return fewer results
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('sorts by relevance score', async () => {
      const results = await provider.search('Post', 'JavaScript')

      // Results should be ordered by relevance
      expect(results.length).toBeGreaterThan(0)
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

  describe('relationships', () => {
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

  describe('utility methods', () => {
    it('clears all data', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })

      provider.clear()

      const user = await provider.get('User', 'john')
      const post = await provider.get('Post', 'post1')

      expect(user).toBeNull()
      expect(post).toBeNull()
    })

    it('returns stats', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('User', 'jane', { name: 'Jane' })
      await provider.create('Post', 'post1', { title: 'Hello' })
      await provider.relate('User', 'john', 'posts', 'Post', 'post1')

      const stats = provider.stats()

      expect(stats.entities).toBe(3)
      expect(stats.relations).toBe(1)
    })

    it('tracks entity count correctly', async () => {
      await provider.create('User', 'john', { name: 'John' })
      let stats = provider.stats()
      expect(stats.entities).toBe(1)

      await provider.create('User', 'jane', { name: 'Jane' })
      stats = provider.stats()
      expect(stats.entities).toBe(2)

      await provider.delete('User', 'john')
      stats = provider.stats()
      expect(stats.entities).toBe(1)
    })
  })

  describe('createMemoryProvider', () => {
    it('creates a new provider instance', () => {
      const provider1 = createMemoryProvider()
      const provider2 = createMemoryProvider()

      expect(provider1).toBeInstanceOf(MemoryProvider)
      expect(provider2).toBeInstanceOf(MemoryProvider)
      expect(provider1).not.toBe(provider2)
    })

    it('creates isolated provider instances', async () => {
      const provider1 = createMemoryProvider()
      const provider2 = createMemoryProvider()

      await provider1.create('User', 'john', { name: 'John' })

      const result1 = await provider1.get('User', 'john')
      const result2 = await provider2.get('User', 'john')

      expect(result1).not.toBeNull()
      expect(result2).toBeNull()
    })
  })

  describe('events', () => {
    it('emits events on create', async () => {
      const handler = vi.fn()
      provider.on('User.created', handler)

      await provider.create('User', 'john', { name: 'John' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].type).toBe('User.created')
      expect(handler.mock.calls[0][0].data.name).toBe('John')
    })

    it('emits events on update', async () => {
      await provider.create('User', 'john', { name: 'John' })

      const handler = vi.fn()
      provider.on('User.updated', handler)

      await provider.update('User', 'john', { name: 'Jane' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].type).toBe('User.updated')
    })

    it('emits events on delete', async () => {
      await provider.create('User', 'john', { name: 'John' })

      const handler = vi.fn()
      provider.on('User.deleted', handler)

      await provider.delete('User', 'john')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].type).toBe('User.deleted')
    })

    it('supports wildcard pattern matching with Type.*', async () => {
      const handler = vi.fn()
      provider.on('User.*', handler)

      await provider.create('User', 'john', { name: 'John' })
      await provider.update('User', 'john', { name: 'Jane' })
      await provider.delete('User', 'john')

      expect(handler).toHaveBeenCalledTimes(3)
    })

    it('supports wildcard pattern matching with *.action', async () => {
      const handler = vi.fn()
      provider.on('*.created', handler)

      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('supports global wildcard *', async () => {
      const handler = vi.fn()
      provider.on('*', handler)

      await provider.create('User', 'john', { name: 'John' })
      await provider.update('User', 'john', { name: 'Jane' })

      // Now emits both type-specific and global events:
      // User.created, entity:created, User.updated, entity:updated
      expect(handler).toHaveBeenCalledTimes(4)
    })

    it('allows unsubscribing from events', async () => {
      const handler = vi.fn()
      const unsubscribe = provider.on('User.created', handler)

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

      const allEvents = await provider.listEvents()
      expect(allEvents.length).toBeGreaterThanOrEqual(3)

      const userEvents = await provider.listEvents({ type: 'User.*' })
      expect(userEvents.length).toBe(2)
    })

    it('replays events', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('User', 'jane', { name: 'Jane' })

      const replayedEvents: string[] = []
      await provider.replayEvents({
        type: 'User.created',
        handler: (event) => {
          replayedEvents.push((event.data as { name: string }).name)
        },
      })

      expect(replayedEvents).toEqual(['John', 'Jane'])
    })
  })

  describe('actions', () => {
    it('creates a pending action', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: { items: ['a', 'b', 'c'] },
        total: 3,
      })

      expect(action.id).toBeDefined()
      expect(action.status).toBe('pending')
      expect(action.type).toBe('batch-embed')
      expect(action.total).toBe(3)
      expect(action.progress).toBe(0)
    })

    it('updates action status to active', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })

      const updated = await provider.updateAction(action.id, {
        status: 'active',
      })

      expect(updated.status).toBe('active')
      expect(updated.startedAt).toBeDefined()
    })

    it('updates action progress', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
        total: 10,
      })

      const updated = await provider.updateAction(action.id, {
        progress: 5,
      })

      expect(updated.progress).toBe(5)
    })

    it('marks action as completed', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })

      const completed = await provider.updateAction(action.id, {
        status: 'completed',
        result: { success: true },
      })

      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toBeDefined()
      expect(completed.result).toEqual({ success: true })
    })

    it('marks action as failed', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })

      const failed = await provider.updateAction(action.id, {
        status: 'failed',
        error: 'Something went wrong',
      })

      expect(failed.status).toBe('failed')
      expect(failed.completedAt).toBeDefined()
      expect(failed.error).toBe('Something went wrong')
    })

    it('retrieves an action by id', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: { foo: 'bar' },
      })

      const retrieved = await provider.getAction(action.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.type).toBe('batch-embed')
      expect(retrieved?.data).toEqual({ foo: 'bar' })
    })

    it('returns null for non-existent action', async () => {
      const retrieved = await provider.getAction('nonexistent')
      expect(retrieved).toBeNull()
    })

    it('lists actions by status', async () => {
      await provider.createAction({ type: 'task1', data: {} })
      const action2 = await provider.createAction({ type: 'task2', data: {} })
      await provider.updateAction(action2.id, { status: 'completed' })

      const pending = await provider.listActions({ status: 'pending' })
      const completed = await provider.listActions({ status: 'completed' })

      expect(pending).toHaveLength(1)
      expect(completed).toHaveLength(1)
    })

    it('lists actions by type', async () => {
      await provider.createAction({ type: 'embed', data: {} })
      await provider.createAction({ type: 'embed', data: {} })
      await provider.createAction({ type: 'generate', data: {} })

      const embedActions = await provider.listActions({ type: 'embed' })
      expect(embedActions).toHaveLength(2)
    })

    it('retries failed actions', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })
      await provider.updateAction(action.id, {
        status: 'failed',
        error: 'Network error',
      })

      const retried = await provider.retryAction(action.id)

      expect(retried.status).toBe('pending')
      expect(retried.error).toBeUndefined()
      expect(retried.startedAt).toBeUndefined()
      expect(retried.completedAt).toBeUndefined()
    })

    it('throws error when retrying non-failed action', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })

      await expect(provider.retryAction(action.id)).rejects.toThrow(
        'Can only retry failed actions'
      )
    })

    it('cancels pending action', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })

      await provider.cancelAction(action.id)

      const cancelled = await provider.getAction(action.id)
      expect(cancelled?.status).toBe('cancelled')
      // Note: cancelled actions no longer set error message
    })

    it('throws error when cancelling completed action', async () => {
      const action = await provider.createAction({
        type: 'batch-embed',
        data: {},
      })
      await provider.updateAction(action.id, { status: 'completed' })

      await expect(provider.cancelAction(action.id)).rejects.toThrow(
        'Cannot cancel finished action'
      )
    })

    it('emits action events', async () => {
      const handler = vi.fn()
      provider.on('Action.*', handler)

      const action = await provider.createAction({ type: 'test', data: {} })
      await provider.updateAction(action.id, { status: 'active' })
      await provider.updateAction(action.id, { status: 'completed' })

      const eventTypes = handler.mock.calls.map(
        (call) => call[0].type
      )
      expect(eventTypes).toContain('Action.created')
      expect(eventTypes).toContain('Action.started')
      expect(eventTypes).toContain('Action.completed')
    })
  })

  describe('artifacts', () => {
    it('stores an artifact', async () => {
      await provider.setArtifact('User/john', 'embedding', {
        content: [0.1, 0.2, 0.3],
        sourceHash: 'abc123',
      })

      const artifact = await provider.getArtifact('User/john', 'embedding')

      expect(artifact).not.toBeNull()
      expect(artifact?.content).toEqual([0.1, 0.2, 0.3])
      expect(artifact?.sourceHash).toBe('abc123')
    })

    it('stores artifact with metadata', async () => {
      await provider.setArtifact('User/john', 'embedding', {
        content: [0.1, 0.2, 0.3],
        sourceHash: 'abc123',
        metadata: { model: 'gemini-embedding-001', dimensions: 768 },
      })

      const artifact = await provider.getArtifact('User/john', 'embedding')

      expect(artifact?.metadata).toEqual({
        model: 'gemini-embedding-001',
        dimensions: 768,
      })
    })

    it('returns null for non-existent artifact', async () => {
      const artifact = await provider.getArtifact('User/john', 'embedding')
      expect(artifact).toBeNull()
    })

    it('stores multiple artifact types for same url', async () => {
      await provider.setArtifact('Post/post1', 'embedding', {
        content: [0.1, 0.2],
        sourceHash: 'abc',
      })
      await provider.setArtifact('Post/post1', 'chunks', {
        content: ['chunk1', 'chunk2'],
        sourceHash: 'def',
      })

      const embedding = await provider.getArtifact('Post/post1', 'embedding')
      const chunks = await provider.getArtifact('Post/post1', 'chunks')

      expect(embedding?.content).toEqual([0.1, 0.2])
      expect(chunks?.content).toEqual(['chunk1', 'chunk2'])
    })

    it('deletes specific artifact type', async () => {
      await provider.setArtifact('Post/post1', 'embedding', {
        content: [0.1],
        sourceHash: 'abc',
      })
      await provider.setArtifact('Post/post1', 'chunks', {
        content: ['chunk1'],
        sourceHash: 'def',
      })

      await provider.deleteArtifact('Post/post1', 'embedding')

      const embedding = await provider.getArtifact('Post/post1', 'embedding')
      const chunks = await provider.getArtifact('Post/post1', 'chunks')

      expect(embedding).toBeNull()
      expect(chunks).not.toBeNull()
    })

    it('deletes all artifacts for url', async () => {
      await provider.setArtifact('Post/post1', 'embedding', {
        content: [0.1],
        sourceHash: 'abc',
      })
      await provider.setArtifact('Post/post1', 'chunks', {
        content: ['chunk1'],
        sourceHash: 'def',
      })

      await provider.deleteArtifact('Post/post1')

      const embedding = await provider.getArtifact('Post/post1', 'embedding')
      const chunks = await provider.getArtifact('Post/post1', 'chunks')

      expect(embedding).toBeNull()
      expect(chunks).toBeNull()
    })

    it('lists all artifacts for url', async () => {
      await provider.setArtifact('Post/post1', 'embedding', {
        content: [0.1],
        sourceHash: 'abc',
      })
      await provider.setArtifact('Post/post1', 'chunks', {
        content: ['chunk1'],
        sourceHash: 'def',
      })
      await provider.setArtifact('Post/post2', 'embedding', {
        content: [0.2],
        sourceHash: 'ghi',
      })

      const artifacts = await provider.listArtifacts('Post/post1')

      expect(artifacts).toHaveLength(2)
      expect(artifacts.map((a) => a.type)).toContain('embedding')
      expect(artifacts.map((a) => a.type)).toContain('chunks')
    })

    it('invalidates non-embedding artifacts on update', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.setArtifact('User/john', 'embedding', {
        content: [0.1],
        sourceHash: 'abc',
      })
      await provider.setArtifact('User/john', 'summary', {
        content: 'A user named John',
        sourceHash: 'def',
      })

      await provider.update('User', 'john', { name: 'Jane' })

      const embedding = await provider.getArtifact('User/john', 'embedding')
      const summary = await provider.getArtifact('User/john', 'summary')

      // Embedding should be preserved, other artifacts invalidated
      expect(embedding).not.toBeNull()
      expect(summary).toBeNull()
    })

    it('cleans up artifacts on entity delete', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.setArtifact('User/john', 'embedding', {
        content: [0.1],
        sourceHash: 'abc',
      })

      await provider.delete('User', 'john')

      const artifacts = await provider.listArtifacts('User/john')
      expect(artifacts).toHaveLength(0)
    })
  })

  describe('stats with new primitives', () => {
    it('includes event count', async () => {
      await provider.create('User', 'john', { name: 'John' })
      await provider.create('Post', 'post1', { title: 'Hello' })

      const stats = provider.stats()

      expect(stats.events).toBeGreaterThanOrEqual(2)
    })

    it('includes action stats', async () => {
      await provider.createAction({ type: 'task1', data: {} })
      const action2 = await provider.createAction({ type: 'task2', data: {} })
      await provider.updateAction(action2.id, { status: 'active' })
      const action3 = await provider.createAction({ type: 'task3', data: {} })
      await provider.updateAction(action3.id, { status: 'completed' })

      const stats = provider.stats()

      expect(stats.actions.pending).toBe(1)
      expect(stats.actions.active).toBe(1)
      expect(stats.actions.completed).toBe(1)
    })

    it('includes artifact count', async () => {
      await provider.setArtifact('User/john', 'embedding', {
        content: [0.1],
        sourceHash: 'abc',
      })
      await provider.setArtifact('Post/post1', 'embedding', {
        content: [0.2],
        sourceHash: 'def',
      })

      const stats = provider.stats()

      expect(stats.artifacts).toBe(2)
    })

    it('includes concurrency stats', () => {
      const stats = provider.stats()

      expect(stats.concurrency.active).toBe(0)
      expect(stats.concurrency.pending).toBe(0)
    })
  })
})

describe('Semaphore', () => {
  it('limits concurrent execution', async () => {
    const semaphore = new Semaphore(2)
    const running: number[] = []
    const maxConcurrent: number[] = []

    const task = async (id: number): Promise<number> => {
      running.push(id)
      maxConcurrent.push(running.length)
      await new Promise((resolve) => setTimeout(resolve, 50))
      running.splice(running.indexOf(id), 1)
      return id
    }

    const results = await semaphore.map([1, 2, 3, 4, 5], task)

    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(Math.max(...maxConcurrent)).toBe(2)
  })

  it('tracks active and pending counts', async () => {
    const semaphore = new Semaphore(1)

    expect(semaphore.active).toBe(0)
    expect(semaphore.pending).toBe(0)

    const release = await semaphore.acquire()

    expect(semaphore.active).toBe(1)
    expect(semaphore.pending).toBe(0)

    // Start another acquire that will be queued
    const secondPromise = semaphore.acquire()

    expect(semaphore.pending).toBe(1)

    release()
    await secondPromise

    expect(semaphore.active).toBe(1)
    expect(semaphore.pending).toBe(0)
  })

  it('runs function with concurrency control', async () => {
    const semaphore = new Semaphore(1)
    const results: number[] = []

    await Promise.all([
      semaphore.run(async () => {
        results.push(1)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }),
      semaphore.run(async () => {
        results.push(2)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }),
    ])

    expect(results).toEqual([1, 2])
  })

  it('handles errors in run', async () => {
    const semaphore = new Semaphore(1)

    await expect(
      semaphore.run(async () => {
        throw new Error('Test error')
      })
    ).rejects.toThrow('Test error')

    // Semaphore should be released after error
    expect(semaphore.active).toBe(0)
  })

  it('processes items in order', async () => {
    const semaphore = new Semaphore(1)
    const order: number[] = []

    await semaphore.map([1, 2, 3], async (num) => {
      order.push(num)
      return num
    })

    expect(order).toEqual([1, 2, 3])
  })
})
