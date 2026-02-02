/**
 * DBProvider Integration Adapter Tests (RED Phase)
 *
 * Tests for integrating ai-database's DBProvider with ai-workflows.
 * These tests verify the adapter that bridges ai-database's DBProvider
 * interface with ai-workflows' DatabaseContext.
 *
 * ## Test Categories
 * 1. Adapter creation and configuration
 * 2. CRUD operations via DBProvider
 * 3. Event operations (emit, subscribe, replay)
 * 4. Action operations (create, complete, list)
 * 5. Artifact operations (store, retrieve)
 * 6. Transaction support
 * 7. Workflow integration
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
// These imports will fail until the adapter is implemented
// import { createDBProviderAdapter, DBProviderAdapter } from '../src/db-provider-adapter.js'
// import type { DBProvider, DBProviderExtended } from 'ai-database'
import type { DatabaseContext, ActionData, ArtifactData } from '../src/types.js'

/**
 * Mock DBProvider interface matching ai-database
 */
interface MockDBProvider {
  get(type: string, id: string): Promise<Record<string, unknown> | null>
  list(
    type: string,
    options?: { limit?: number; offset?: number; where?: Record<string, unknown> }
  ): Promise<Record<string, unknown>[]>
  search(
    type: string,
    query: string,
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>[]>
  create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>
  update(type: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
  delete(type: string, id: string): Promise<boolean>
  related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]>
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: Record<string, unknown>
  ): Promise<void>
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
}

/**
 * Extended Mock DBProvider with events, actions, artifacts
 */
interface MockDBProviderExtended extends MockDBProvider {
  // Events API
  on(pattern: string, handler: (event: unknown) => void): () => void
  emit(type: string, data: unknown): Promise<{ id: string }>
  listEvents(options?: Record<string, unknown>): Promise<unknown[]>
  replayEvents(options: { handler: (event: unknown) => void }): Promise<void>

  // Actions API
  createAction(options: {
    type: string
    actor: string
    object: string
    data?: unknown
  }): Promise<{ id: string; status: string }>
  getAction(id: string): Promise<{ id: string; status: string } | null>
  updateAction(
    id: string,
    updates: Record<string, unknown>
  ): Promise<{ id: string; status: string }>
  listActions(options?: Record<string, unknown>): Promise<unknown[]>

  // Artifacts API
  getArtifact(url: string, type: string): Promise<{ content: unknown } | null>
  setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string }
  ): Promise<void>
  deleteArtifact(url: string, type?: string): Promise<void>
  listArtifacts(url: string): Promise<unknown[]>
}

/**
 * Create a mock DBProvider for testing
 */
function createMockDBProvider(): MockDBProvider {
  const stores = new Map<string, Map<string, Record<string, unknown>>>()

  const getStore = (type: string) => {
    if (!stores.has(type)) {
      stores.set(type, new Map())
    }
    return stores.get(type)!
  }

  return {
    async get(type, id) {
      return getStore(type).get(id) ?? null
    },
    async list(type, options) {
      let results = Array.from(getStore(type).values())
      if (options?.where) {
        results = results.filter((r) => {
          for (const [k, v] of Object.entries(options.where!)) {
            if (r[k] !== v) return false
          }
          return true
        })
      }
      if (options?.offset) results = results.slice(options.offset)
      if (options?.limit) results = results.slice(0, options.limit)
      return results
    },
    async search(type, query) {
      return Array.from(getStore(type).values()).filter((r) =>
        JSON.stringify(r).toLowerCase().includes(query.toLowerCase())
      )
    },
    async create(type, id, data) {
      const entityId = id ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const record = { ...data, $id: entityId, $type: type }
      getStore(type).set(entityId, record)
      return record
    },
    async update(type, id, data) {
      const existing = getStore(type).get(id)
      const updated = { ...(existing ?? {}), ...data, $id: id, $type: type }
      getStore(type).set(id, updated)
      return updated
    },
    async delete(type, id) {
      return getStore(type).delete(id)
    },
    async related(type, id, relation) {
      // Simplified: return empty array
      return []
    },
    async relate() {
      // No-op for mock
    },
    async unrelate() {
      // No-op for mock
    },
  }
}

/**
 * Create a mock extended DBProvider with events, actions, artifacts
 */
function createMockDBProviderExtended(): MockDBProviderExtended {
  const baseProvider = createMockDBProvider()
  const eventHandlers = new Map<string, Set<(event: unknown) => void>>()
  const events: Array<{ id: string; type: string; data: unknown }> = []
  const actions = new Map<
    string,
    { id: string; status: string; actor: string; object: string; data?: unknown }
  >()
  const artifacts = new Map<string, { content: unknown; sourceHash: string }>()

  return {
    ...baseProvider,

    on(pattern, handler) {
      if (!eventHandlers.has(pattern)) {
        eventHandlers.set(pattern, new Set())
      }
      eventHandlers.get(pattern)!.add(handler)
      return () => eventHandlers.get(pattern)?.delete(handler)
    },

    async emit(type, data) {
      const id = `event-${Date.now()}`
      events.push({ id, type, data })
      eventHandlers.get(type)?.forEach((h) => h({ id, type, data }))
      return { id }
    },

    async listEvents() {
      return events
    },

    async replayEvents(options) {
      for (const event of events) {
        await options.handler(event)
      }
    },

    async createAction(options) {
      const id = `action-${Date.now()}`
      const action = {
        id,
        status: 'pending',
        actor: options.actor,
        object: options.object,
        data: options.data,
      }
      actions.set(id, action)
      return action
    },

    async getAction(id) {
      return actions.get(id) ?? null
    },

    async updateAction(id, updates) {
      const existing = actions.get(id)
      if (!existing) throw new Error('Action not found')
      const updated = { ...existing, ...updates }
      actions.set(id, updated)
      return updated
    },

    async listActions() {
      return Array.from(actions.values())
    },

    async getArtifact(url, type) {
      return artifacts.get(`${url}:${type}`) ?? null
    },

    async setArtifact(url, type, data) {
      artifacts.set(`${url}:${type}`, data)
    },

    async deleteArtifact(url, type) {
      if (type) {
        artifacts.delete(`${url}:${type}`)
      } else {
        // Delete all artifacts for URL
        for (const key of artifacts.keys()) {
          if (key.startsWith(`${url}:`)) {
            artifacts.delete(key)
          }
        }
      }
    },

    async listArtifacts(url) {
      const results: Array<{ content: unknown; sourceHash: string; type: string }> = []
      for (const [key, value] of artifacts.entries()) {
        if (key.startsWith(`${url}:`)) {
          const type = key.split(':')[1]
          results.push({ ...value, type })
        }
      }
      return results
    },
  }
}

describe('DBProviderAdapter', () => {
  describe('createDBProviderAdapter', () => {
    it('should create an adapter from a DBProvider', () => {
      // RED: This test will fail until the adapter is implemented
      const mockProvider = createMockDBProvider()

      // The adapter should be creatable from a DBProvider
      // This will fail as createDBProviderAdapter doesn't exist yet
      expect(() => {
        // @ts-expect-error - createDBProviderAdapter not implemented yet
        const adapter = createDBProviderAdapter(mockProvider)
        expect(adapter).toBeDefined()
      }).not.toThrow()
    })

    it('should require a valid DBProvider', () => {
      // RED: Should throw if no provider is passed
      expect(() => {
        // @ts-expect-error - createDBProviderAdapter not implemented yet
        createDBProviderAdapter(null)
      }).toThrow('DBProvider is required')
    })

    it('should accept options for configuration', () => {
      const mockProvider = createMockDBProvider()

      // RED: Should accept configuration options
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider, {
        workflowId: 'test-workflow',
        source: 'test-source',
      })

      expect(adapter).toBeDefined()
    })
  })

  describe('DatabaseContext interface', () => {
    it('should implement DatabaseContext interface', () => {
      const mockProvider = createMockDBProvider()

      // RED: Adapter should implement DatabaseContext
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      expect(typeof adapter.recordEvent).toBe('function')
      expect(typeof adapter.createAction).toBe('function')
      expect(typeof adapter.completeAction).toBe('function')
      expect(typeof adapter.storeArtifact).toBe('function')
      expect(typeof adapter.getArtifact).toBe('function')
    })
  })

  describe('recordEvent()', () => {
    it('should record events to the DBProvider', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      // RED: Should store event in DBProvider
      await adapter.recordEvent('Customer.created', { id: '123', name: 'John' })

      // Verify event was stored
      const events = await mockProvider.list('WorkflowEvent')
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        eventType: 'Customer.created',
      })
    })

    it('should store event data as JSON', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      const eventData = { orderId: 'order-1', total: 99.99 }
      await adapter.recordEvent('Order.completed', eventData)

      const events = await mockProvider.list('WorkflowEvent')
      const storedData = JSON.parse(events[0]?.data as string)
      expect(storedData).toEqual(eventData)
    })

    it('should include timestamp on events', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      const before = Date.now()
      await adapter.recordEvent('Test.event', {})
      const after = Date.now()

      const events = await mockProvider.list('WorkflowEvent')
      const timestamp = events[0]?.timestamp as number
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should include workflow ID when configured', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider, {
        workflowId: 'wf-123',
      }) as DatabaseContext

      await adapter.recordEvent('Test.event', {})

      const events = await mockProvider.list('WorkflowEvent')
      expect(events[0]?.workflowId).toBe('wf-123')
    })

    it('should emit to extended provider events API if available', async () => {
      const mockProvider = createMockDBProviderExtended()
      const emitSpy = vi.spyOn(mockProvider, 'emit')

      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.recordEvent('Customer.created', { id: '1' })

      // Should emit event through provider's events API
      expect(emitSpy).toHaveBeenCalled()
    })
  })

  describe('createAction()', () => {
    it('should create an action in the DBProvider', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.createAction({
        actor: 'user:john',
        object: 'Order/order-123',
        action: 'approve',
      })

      const actions = await mockProvider.list('WorkflowAction')
      expect(actions).toHaveLength(1)
      expect(actions[0]).toMatchObject({
        actor: 'user:john',
        object: 'Order/order-123',
        action: 'approve',
        status: 'pending',
      })
    })

    it('should respect initial status', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.createAction({
        actor: 'system',
        object: 'Task/task-1',
        action: 'process',
        status: 'active',
      })

      const actions = await mockProvider.list('WorkflowAction')
      expect(actions[0]?.status).toBe('active')
    })

    it('should store action metadata', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.createAction({
        actor: 'system',
        object: 'Report/report-1',
        action: 'generate',
        metadata: { format: 'pdf', pages: 10 },
      })

      const actions = await mockProvider.list('WorkflowAction')
      const metadata = JSON.parse(actions[0]?.metadata as string)
      expect(metadata).toEqual({ format: 'pdf', pages: 10 })
    })

    it('should use extended provider actions API if available', async () => {
      const mockProvider = createMockDBProviderExtended()
      const createActionSpy = vi.spyOn(mockProvider, 'createAction')

      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.createAction({
        actor: 'user:alice',
        object: 'Document/doc-1',
        action: 'review',
      })

      // Should use provider's native createAction if available
      expect(createActionSpy).toHaveBeenCalled()
    })
  })

  describe('completeAction()', () => {
    it('should mark action as completed', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      // Create action first
      await adapter.createAction({
        actor: 'user:john',
        object: 'Order/order-123',
        action: 'approve',
      })

      const actions = await mockProvider.list('WorkflowAction')
      const actionId = actions[0]?.$id as string

      // Complete it
      await adapter.completeAction(actionId, { approved: true })

      const updated = await mockProvider.get('WorkflowAction', actionId)
      expect(updated?.status).toBe('completed')
    })

    it('should store action result', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.createAction({
        actor: 'system',
        object: 'Task/task-1',
        action: 'process',
      })

      const actions = await mockProvider.list('WorkflowAction')
      const actionId = actions[0]?.$id as string

      await adapter.completeAction(actionId, { output: 'processed', items: 42 })

      const updated = await mockProvider.get('WorkflowAction', actionId)
      const result = JSON.parse(updated?.result as string)
      expect(result).toEqual({ output: 'processed', items: 42 })
    })

    it('should throw for non-existent action', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await expect(adapter.completeAction('non-existent', {})).rejects.toThrow('Action not found')
    })

    it('should record completedAt timestamp', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.createAction({
        actor: 'user:bob',
        object: 'Request/req-1',
        action: 'approve',
      })

      const actions = await mockProvider.list('WorkflowAction')
      const actionId = actions[0]?.$id as string

      const before = Date.now()
      await adapter.completeAction(actionId, { approved: true })
      const after = Date.now()

      const updated = await mockProvider.get('WorkflowAction', actionId)
      const completedAt = updated?.completedAt as number
      expect(completedAt).toBeGreaterThanOrEqual(before)
      expect(completedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('storeArtifact()', () => {
    it('should store an artifact', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.storeArtifact({
        key: 'compiled/workflow-1/code.esm',
        type: 'esm',
        sourceHash: 'abc123',
        content: 'export function handler() {}',
      })

      const artifacts = await mockProvider.list('WorkflowArtifact')
      expect(artifacts).toHaveLength(1)
      expect(artifacts[0]).toMatchObject({
        key: 'compiled/workflow-1/code.esm',
        artifactType: 'esm',
        sourceHash: 'abc123',
      })
    })

    it('should store complex artifact content', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      const ast = {
        type: 'Program',
        body: [{ type: 'ExportDeclaration' }],
      }

      await adapter.storeArtifact({
        key: 'parsed/module.ast',
        type: 'ast',
        sourceHash: 'def456',
        content: ast,
      })

      const stored = await adapter.getArtifact('parsed/module.ast')
      expect(stored).toEqual(ast)
    })

    it('should store artifact metadata', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.storeArtifact({
        key: 'bundle/app.js',
        type: 'bundle',
        sourceHash: 'ghi789',
        content: 'bundled code',
        metadata: { size: 1024, modules: 5 },
      })

      const artifacts = await mockProvider.list('WorkflowArtifact')
      const metadata = JSON.parse(artifacts[0]?.metadata as string)
      expect(metadata).toEqual({ size: 1024, modules: 5 })
    })

    it('should use extended provider artifacts API if available', async () => {
      const mockProvider = createMockDBProviderExtended()
      const setArtifactSpy = vi.spyOn(mockProvider, 'setArtifact')

      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.storeArtifact({
        key: 'test/artifact',
        type: 'bundle',
        sourceHash: 'hash123',
        content: 'test content',
      })

      // Should use provider's native setArtifact if available
      expect(setArtifactSpy).toHaveBeenCalled()
    })
  })

  describe('getArtifact()', () => {
    it('should retrieve an artifact', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await adapter.storeArtifact({
        key: 'test-key',
        type: 'esm',
        sourceHash: 'hash123',
        content: 'export default {}',
      })

      const content = await adapter.getArtifact('test-key')
      expect(content).toBe('export default {}')
    })

    it('should return null for non-existent artifact', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      const content = await adapter.getArtifact('non-existent')
      expect(content).toBeNull()
    })

    it('should deserialize complex content', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      const original = { nested: { data: [1, 2, 3] } }
      await adapter.storeArtifact({
        key: 'complex-key',
        type: 'ast',
        sourceHash: 'hash456',
        content: original,
      })

      const content = await adapter.getArtifact('complex-key')
      expect(content).toEqual(original)
    })
  })

  describe('Extended features with DBProviderExtended', () => {
    describe('Event subscription', () => {
      it('should forward event subscriptions to provider', async () => {
        const mockProvider = createMockDBProviderExtended()
        // @ts-expect-error - createDBProviderAdapter not implemented yet
        const adapter = createDBProviderAdapter(mockProvider)

        const handler = vi.fn()
        // RED: Adapter should expose subscribe method for extended providers
        adapter.subscribe('Customer.created', handler)

        await mockProvider.emit('Customer.created', { id: '1' })

        expect(handler).toHaveBeenCalled()
      })
    })

    describe('Event replay', () => {
      it('should support event replay through provider', async () => {
        const mockProvider = createMockDBProviderExtended()
        // @ts-expect-error - createDBProviderAdapter not implemented yet
        const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

        // Record some events
        await adapter.recordEvent('Step1.completed', { result: 'a' })
        await adapter.recordEvent('Step2.completed', { result: 'b' })

        const replayed: Array<{ event: string; data: unknown }> = []

        // RED: Adapter should expose replay method
        // @ts-expect-error - replay not implemented yet
        await adapter.replay(async (event: string, data: unknown) => {
          replayed.push({ event, data })
        })

        expect(replayed).toHaveLength(2)
      })
    })
  })

  describe('Transaction support', () => {
    it('should pass through transaction support from provider', async () => {
      const mockProvider = createMockDBProvider() as MockDBProvider & {
        beginTransaction: () => Promise<{
          commit: () => Promise<void>
          rollback: () => Promise<void>
        }>
      }

      // Add transaction support to mock
      mockProvider.beginTransaction = vi.fn().mockResolvedValue({
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      })

      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider)

      // RED: Adapter should expose transaction support
      // @ts-expect-error - beginTransaction not exposed yet
      const txn = await adapter.beginTransaction()
      expect(txn).toBeDefined()
      expect(typeof txn.commit).toBe('function')
      expect(typeof txn.rollback).toBe('function')
    })
  })

  describe('Workflow integration', () => {
    it('should be usable as WorkflowOptions.db', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      // RED: Adapter should be assignable to WorkflowOptions.db
      // This verifies the type compatibility
      const workflowOptions = {
        db: adapter,
        context: { userId: '123' },
      }

      expect(workflowOptions.db).toBeDefined()
      expect(typeof workflowOptions.db.recordEvent).toBe('function')
      expect(typeof workflowOptions.db.createAction).toBe('function')
      expect(typeof workflowOptions.db.completeAction).toBe('function')
      expect(typeof workflowOptions.db.storeArtifact).toBe('function')
      expect(typeof workflowOptions.db.getArtifact).toBe('function')
    })

    it('should maintain workflow context across operations', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider, {
        workflowId: 'wf-integration-test',
        source: 'integration-test',
      }) as DatabaseContext

      // Simulate workflow execution
      await adapter.recordEvent('Workflow.started', { input: { orderId: 'order-1' } })
      await adapter.createAction({
        actor: 'system',
        object: 'Order/order-1',
        action: 'validate',
      })
      await adapter.storeArtifact({
        key: 'wf-integration-test/compiled',
        type: 'esm',
        sourceHash: 'hash123',
        content: 'compiled workflow',
      })

      // Verify all operations used the workflow context
      const events = await mockProvider.list('WorkflowEvent')
      expect(events.every((e) => e.workflowId === 'wf-integration-test')).toBe(true)
      expect(events.every((e) => e.source === 'integration-test')).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should propagate provider errors', async () => {
      const mockProvider = createMockDBProvider()
      mockProvider.create = vi.fn().mockRejectedValue(new Error('Provider error'))

      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      await expect(adapter.recordEvent('Test.event', {})).rejects.toThrow('Provider error')
    })

    it('should handle null/undefined data gracefully', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      // Should not throw for null/undefined data
      await expect(adapter.recordEvent('Test.event', null)).resolves.not.toThrow()
      await expect(adapter.recordEvent('Test.event', undefined)).resolves.not.toThrow()
    })
  })

  describe('Type safety', () => {
    it('should preserve type information through the adapter', async () => {
      const mockProvider = createMockDBProvider()
      // @ts-expect-error - createDBProviderAdapter not implemented yet
      const adapter = createDBProviderAdapter(mockProvider) as DatabaseContext

      // Store typed artifact
      interface MyArtifact {
        version: number
        data: string[]
      }

      const artifact: MyArtifact = { version: 1, data: ['a', 'b', 'c'] }

      await adapter.storeArtifact({
        key: 'typed-artifact',
        type: 'bundle',
        sourceHash: 'hash789',
        content: artifact,
      })

      // RED: getArtifact should preserve type
      const retrieved = (await adapter.getArtifact('typed-artifact')) as MyArtifact
      expect(retrieved.version).toBe(1)
      expect(retrieved.data).toEqual(['a', 'b', 'c'])
    })
  })
})

describe('DBProviderAdapter class', () => {
  it('should be exportable as a class', () => {
    // RED: The adapter should also be available as a class
    // @ts-expect-error - DBProviderAdapter not implemented yet
    expect(DBProviderAdapter).toBeDefined()
    // @ts-expect-error - DBProviderAdapter not implemented yet
    expect(typeof DBProviderAdapter).toBe('function')
  })

  it('should be instantiable with new', () => {
    const mockProvider = createMockDBProvider()

    // RED: Should be instantiable
    // @ts-expect-error - DBProviderAdapter not implemented yet
    const adapter = new DBProviderAdapter(mockProvider)
    expect(adapter).toBeDefined()
  })

  it('should expose the underlying provider', () => {
    const mockProvider = createMockDBProvider()

    // @ts-expect-error - DBProviderAdapter not implemented yet
    const adapter = new DBProviderAdapter(mockProvider)

    // RED: Should expose the provider for advanced use cases
    expect(adapter.provider).toBe(mockProvider)
  })
})
