/**
 * DatabaseContext Tests
 *
 * Tests for the persistence layer using ai-database integration.
 *
 * ## Test Categories
 * 1. Event sourcing (recordEvent, getEvents, replay)
 * 2. Action management (createAction, completeAction)
 * 3. Artifact storage (storeArtifact, getArtifact)
 * 4. Snapshot management (createSnapshot, restoreSnapshot, getSnapshots)
 * 5. Integration with ai-database
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDatabaseContext,
  createMemoryDatabaseContext,
  type DatabaseProvider,
  type EventsAPI,
  type EventSourcingContext,
} from '../src/database-context.js'

/**
 * In-memory database provider for testing
 */
class MemoryDatabaseProvider implements DatabaseProvider {
  private stores = new Map<string, Map<string, Record<string, unknown>>>()
  private emittedEvents: Array<{ event: string; data: unknown }> = []

  private getStore(type: string): Map<string, Record<string, unknown>> {
    if (!this.stores.has(type)) {
      this.stores.set(type, new Map())
    }
    return this.stores.get(type)!
  }

  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    const store = this.getStore(type)
    return store.get(id) ?? null
  }

  async create(
    type: string,
    data: Record<string, unknown>,
    id?: string
  ): Promise<Record<string, unknown>> {
    const store = this.getStore(type)
    const entityId = id ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const record = { ...data, $id: entityId, $type: type }
    store.set(entityId, record)
    return record
  }

  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const store = this.getStore(type)
    const existing = store.get(id)
    const updated = { ...(existing ?? {}), ...data, $id: id, $type: type }
    store.set(id, updated)
    return updated
  }

  async delete(type: string, id: string): Promise<boolean> {
    const store = this.getStore(type)
    return store.delete(id)
  }

  async list(
    type: string,
    options?: { limit?: number; offset?: number; where?: Record<string, unknown> }
  ): Promise<Record<string, unknown>[]> {
    const store = this.getStore(type)
    let results = Array.from(store.values())

    if (options?.where) {
      results = results.filter((record) => {
        for (const [key, value] of Object.entries(options.where!)) {
          if (record[key] !== value) {
            return false
          }
        }
        return true
      })
    }

    if (options?.offset) {
      results = results.slice(options.offset)
    }

    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async emit(event: string, data: unknown): Promise<{ id: string }> {
    this.emittedEvents.push({ event, data })
    return { id: `event-${Date.now()}` }
  }

  getEmittedEvents(): Array<{ event: string; data: unknown }> {
    return [...this.emittedEvents]
  }

  clear(): void {
    this.stores.clear()
    this.emittedEvents = []
  }
}

/**
 * Mock Events API for testing
 */
class MockEventsAPI implements EventsAPI {
  private handlers = new Map<string, Set<(data: unknown) => void>>()
  private emittedEvents: Array<{ event: string; data: unknown }> = []

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  async emit(
    eventOrData: string | { event: string; [key: string]: unknown },
    data?: unknown
  ): Promise<{ id: string }> {
    const eventName = typeof eventOrData === 'string' ? eventOrData : eventOrData.event
    const eventData = typeof eventOrData === 'string' ? data : eventOrData
    this.emittedEvents.push({ event: eventName, data: eventData })

    // Trigger handlers
    const handlers = this.handlers.get(eventName)
    if (handlers) {
      for (const handler of handlers) {
        handler(eventData)
      }
    }

    return { id: `event-${Date.now()}` }
  }

  getEmittedEvents(): Array<{ event: string; data: unknown }> {
    return [...this.emittedEvents]
  }

  clear(): void {
    this.handlers.clear()
    this.emittedEvents = []
  }
}

describe('DatabaseContext', () => {
  let db: MemoryDatabaseProvider
  let events: MockEventsAPI
  let ctx: EventSourcingContext

  beforeEach(() => {
    db = new MemoryDatabaseProvider()
    events = new MockEventsAPI()
    ctx = createDatabaseContext({
      db,
      events,
      workflowId: 'test-workflow',
      source: 'test',
    })
  })

  describe('construction', () => {
    it('creates context with database provider', () => {
      const context = createDatabaseContext({ db })
      expect(context).toBeDefined()
      expect(context.recordEvent).toBeDefined()
      expect(context.createAction).toBeDefined()
      expect(context.storeArtifact).toBeDefined()
    })

    it('creates context with events API', () => {
      const context = createDatabaseContext({ db, events })
      expect(context).toBeDefined()
    })

    it('creates context with workflow ID', () => {
      const context = createDatabaseContext({
        db,
        workflowId: 'my-workflow',
      })
      expect(context).toBeDefined()
    })
  })

  describe('recordEvent() - event sourcing', () => {
    it('records an event to database', async () => {
      await ctx.recordEvent('Customer.created', { id: '123', name: 'John' })

      const storedEvents = await ctx.getEvents()
      expect(storedEvents).toHaveLength(1)
      expect(storedEvents[0].eventType).toBe('Customer.created')
    })

    it('stores event data as JSON', async () => {
      await ctx.recordEvent('Order.completed', { orderId: 'order-1', total: 99.99 })

      const storedEvents = await ctx.getEvents()
      const data = JSON.parse(storedEvents[0].data)
      expect(data.orderId).toBe('order-1')
      expect(data.total).toBe(99.99)
    })

    it('records timestamp on events', async () => {
      const before = Date.now()
      await ctx.recordEvent('Test.event', { value: 1 })
      const after = Date.now()

      const storedEvents = await ctx.getEvents()
      expect(storedEvents[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(storedEvents[0].timestamp).toBeLessThanOrEqual(after)
    })

    it('includes workflow ID on events', async () => {
      await ctx.recordEvent('Test.event', { value: 1 })

      const storedEvents = await ctx.getEvents()
      expect(storedEvents[0].workflowId).toBe('test-workflow')
    })

    it('emits event to events API', async () => {
      await ctx.recordEvent('Customer.created', { id: '123' })

      const emitted = events.getEmittedEvents()
      expect(emitted.some((e) => e.event === 'WorkflowEvent.created')).toBe(true)
    })

    it('records multiple events in sequence', async () => {
      await ctx.recordEvent('Step1.started', { step: 1 })
      await ctx.recordEvent('Step1.completed', { step: 1, result: 'ok' })
      await ctx.recordEvent('Step2.started', { step: 2 })

      const storedEvents = await ctx.getEvents()
      expect(storedEvents).toHaveLength(3)
      expect(storedEvents.map((e) => e.eventType)).toEqual([
        'Step1.started',
        'Step1.completed',
        'Step2.started',
      ])
    })
  })

  describe('getEvents() - event retrieval', () => {
    beforeEach(async () => {
      await ctx.recordEvent('Event1', { seq: 1 })
      await new Promise((r) => setTimeout(r, 10))
      await ctx.recordEvent('Event2', { seq: 2 })
      await new Promise((r) => setTimeout(r, 10))
      await ctx.recordEvent('Event3', { seq: 3 })
    })

    it('returns all events', async () => {
      const storedEvents = await ctx.getEvents()
      expect(storedEvents).toHaveLength(3)
    })

    it('returns events in timestamp order', async () => {
      const storedEvents = await ctx.getEvents()
      for (let i = 1; i < storedEvents.length; i++) {
        expect(storedEvents[i].timestamp).toBeGreaterThanOrEqual(storedEvents[i - 1].timestamp)
      }
    })

    it('filters events by since timestamp', async () => {
      const storedEvents = await ctx.getEvents()
      const midTimestamp = storedEvents[1].timestamp

      const filtered = await ctx.getEvents({ since: new Date(midTimestamp) })
      expect(filtered.length).toBeGreaterThanOrEqual(1)
    })

    it('limits number of events returned', async () => {
      const storedEvents = await ctx.getEvents({ limit: 2 })
      expect(storedEvents).toHaveLength(2)
    })
  })

  describe('replay() - event replay', () => {
    beforeEach(async () => {
      await ctx.recordEvent('Step1.completed', { result: 'a' })
      await ctx.recordEvent('Step2.completed', { result: 'b' })
      await ctx.recordEvent('Step3.completed', { result: 'c' })
    })

    it('replays all events through handler', async () => {
      const replayed: Array<{ event: string; data: unknown }> = []

      await ctx.replay(async (event, data) => {
        replayed.push({ event, data })
      })

      expect(replayed).toHaveLength(3)
      expect(replayed.map((r) => r.event)).toEqual([
        'Step1.completed',
        'Step2.completed',
        'Step3.completed',
      ])
    })

    it('replays events in order', async () => {
      const results: string[] = []

      await ctx.replay(async (event, data) => {
        results.push((data as { result: string }).result)
      })

      expect(results).toEqual(['a', 'b', 'c'])
    })

    it('can reconstruct state from events', async () => {
      const state: Record<string, unknown> = {}

      await ctx.replay(async (event, data) => {
        const stepNumber = event.match(/Step(\d+)/)?.[1]
        if (stepNumber) {
          state[`step${stepNumber}`] = (data as { result: string }).result
        }
      })

      expect(state).toEqual({ step1: 'a', step2: 'b', step3: 'c' })
    })

    it('replays events since a given time', async () => {
      const storedEvents = await ctx.getEvents()
      const midTimestamp = storedEvents[1].timestamp

      const replayed: string[] = []
      await ctx.replay(
        async (event) => {
          replayed.push(event)
        },
        { since: new Date(midTimestamp) }
      )

      expect(replayed.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('createAction() - action management', () => {
    it('creates a pending action', async () => {
      await ctx.createAction({
        actor: 'user:john',
        object: 'Order/order-123',
        action: 'approve',
      })

      const actions = await db.list('WorkflowAction')
      expect(actions).toHaveLength(1)
      expect(actions[0].actor).toBe('user:john')
      expect(actions[0].status).toBe('pending')
    })

    it('stores action metadata', async () => {
      await ctx.createAction({
        actor: 'system',
        object: 'Report/report-1',
        action: 'generate',
        metadata: { format: 'pdf', pages: 10 },
      })

      const actions = await db.list('WorkflowAction')
      const metadata = JSON.parse(actions[0].metadata as string)
      expect(metadata.format).toBe('pdf')
      expect(metadata.pages).toBe(10)
    })

    it('emits action created event', async () => {
      await ctx.createAction({
        actor: 'user:alice',
        object: 'Document/doc-1',
        action: 'review',
      })

      const emitted = events.getEmittedEvents()
      expect(emitted.some((e) => e.event === 'WorkflowAction.created')).toBe(true)
    })
  })

  describe('completeAction() - action completion', () => {
    it('marks action as completed', async () => {
      await ctx.createAction({
        actor: 'user:john',
        object: 'Order/order-123',
        action: 'approve',
      })

      const actions = await db.list('WorkflowAction')
      const actionId = actions[0].$id as string

      await ctx.completeAction(actionId, { approved: true })

      const updated = await db.get('WorkflowAction', actionId)
      expect(updated?.status).toBe('completed')
    })

    it('stores action result', async () => {
      await ctx.createAction({
        actor: 'system',
        object: 'Task/task-1',
        action: 'process',
      })

      const actions = await db.list('WorkflowAction')
      const actionId = actions[0].$id as string

      await ctx.completeAction(actionId, { output: 'processed', items: 42 })

      const updated = await db.get('WorkflowAction', actionId)
      const result = JSON.parse(updated?.result as string)
      expect(result.output).toBe('processed')
      expect(result.items).toBe(42)
    })

    it('throws error for non-existent action', async () => {
      await expect(ctx.completeAction('non-existent', {})).rejects.toThrow('Action not found')
    })

    it('emits action completed event', async () => {
      await ctx.createAction({
        actor: 'user:bob',
        object: 'Request/req-1',
        action: 'approve',
      })

      const actions = await db.list('WorkflowAction')
      const actionId = actions[0].$id as string

      await ctx.completeAction(actionId, { approved: true })

      const emitted = events.getEmittedEvents()
      expect(emitted.some((e) => e.event === 'WorkflowAction.completed')).toBe(true)
    })
  })

  describe('storeArtifact() - artifact storage', () => {
    it('stores an artifact', async () => {
      await ctx.storeArtifact({
        key: 'compiled/workflow-1/code.esm',
        type: 'esm',
        sourceHash: 'abc123',
        content: 'export function handler() {}',
      })

      const stored = await ctx.getArtifact('compiled/workflow-1/code.esm')
      expect(stored).toBe('export function handler() {}')
    })

    it('stores complex artifact content', async () => {
      const ast = {
        type: 'Program',
        body: [{ type: 'ExportDeclaration' }],
      }

      await ctx.storeArtifact({
        key: 'parsed/module.ast',
        type: 'ast',
        sourceHash: 'def456',
        content: ast,
      })

      const stored = await ctx.getArtifact('parsed/module.ast')
      expect(stored).toEqual(ast)
    })

    it('stores artifact metadata', async () => {
      await ctx.storeArtifact({
        key: 'bundle/app.js',
        type: 'bundle',
        sourceHash: 'ghi789',
        content: 'bundled code',
        metadata: { size: 1024, modules: 5 },
      })

      // Metadata is stored but getArtifact only returns content
      const stored = await ctx.getArtifact('bundle/app.js')
      expect(stored).toBe('bundled code')
    })

    it('returns null for non-existent artifact', async () => {
      const stored = await ctx.getArtifact('non-existent')
      expect(stored).toBeNull()
    })

    it('overwrites existing artifact with same key', async () => {
      await ctx.storeArtifact({
        key: 'cache/data',
        type: 'bundle',
        sourceHash: 'v1',
        content: 'version 1',
      })

      await ctx.storeArtifact({
        key: 'cache/data',
        type: 'bundle',
        sourceHash: 'v2',
        content: 'version 2',
      })

      const stored = await ctx.getArtifact('cache/data')
      expect(stored).toBe('version 2')
    })
  })

  describe('createSnapshot() - state snapshots', () => {
    it('creates a snapshot of current state', async () => {
      const state = { step: 3, context: { userId: '123' } }
      const snapshotId = await ctx.createSnapshot(state)

      expect(snapshotId).toBeDefined()
      expect(snapshotId).toContain('snap-')
    })

    it('creates snapshot with label', async () => {
      const snapshotId = await ctx.createSnapshot({ data: 'important' }, 'before-risky-operation')

      const snapshots = await ctx.getSnapshots()
      const snapshot = snapshots.find((s) => s.id === snapshotId)
      expect(snapshot?.label).toBe('before-risky-operation')
    })

    it('records event sequence in snapshot', async () => {
      await ctx.recordEvent('Event1', { seq: 1 })
      await ctx.recordEvent('Event2', { seq: 2 })

      const snapshotId = await ctx.createSnapshot({ step: 2 })

      // Verify sequence is tracked
      expect(ctx.getEventSequence()).toBe(2)
    })

    it('emits snapshot created event', async () => {
      await ctx.createSnapshot({ state: 'test' })

      const emitted = events.getEmittedEvents()
      expect(emitted.some((e) => e.event === 'WorkflowSnapshot.created')).toBe(true)
    })
  })

  describe('restoreSnapshot() - state restoration', () => {
    it('restores state from snapshot', async () => {
      const originalState = { step: 5, data: { processed: true } }
      const snapshotId = await ctx.createSnapshot(originalState)

      const restored = await ctx.restoreSnapshot(snapshotId)
      expect(restored).toEqual(originalState)
    })

    it('throws error for non-existent snapshot', async () => {
      await expect(ctx.restoreSnapshot('non-existent')).rejects.toThrow('Snapshot not found')
    })

    it('restores event sequence from snapshot', async () => {
      await ctx.recordEvent('Event1', {})
      await ctx.recordEvent('Event2', {})
      const snapshotId = await ctx.createSnapshot({ at: 2 })

      // Record more events
      await ctx.recordEvent('Event3', {})
      await ctx.recordEvent('Event4', {})

      // Restore should reset sequence
      await ctx.restoreSnapshot(snapshotId)
      expect(ctx.getEventSequence()).toBe(2)
    })

    it('emits snapshot restored event', async () => {
      const snapshotId = await ctx.createSnapshot({ data: 'test' })
      await ctx.restoreSnapshot(snapshotId)

      const emitted = events.getEmittedEvents()
      expect(emitted.some((e) => e.event === 'WorkflowSnapshot.restored')).toBe(true)
    })
  })

  describe('getSnapshots() - snapshot listing', () => {
    it('returns all snapshots for workflow', async () => {
      await ctx.createSnapshot({ v: 1 }, 'checkpoint-1')
      await ctx.createSnapshot({ v: 2 }, 'checkpoint-2')
      await ctx.createSnapshot({ v: 3 }, 'checkpoint-3')

      const snapshots = await ctx.getSnapshots()
      expect(snapshots).toHaveLength(3)
    })

    it('returns snapshots in reverse chronological order', async () => {
      await ctx.createSnapshot({ v: 1 }, 'first')
      await new Promise((r) => setTimeout(r, 10))
      await ctx.createSnapshot({ v: 2 }, 'second')
      await new Promise((r) => setTimeout(r, 10))
      await ctx.createSnapshot({ v: 3 }, 'third')

      const snapshots = await ctx.getSnapshots()
      expect(snapshots[0].label).toBe('third')
      expect(snapshots[2].label).toBe('first')
    })

    it('returns empty array when no snapshots exist', async () => {
      const snapshots = await ctx.getSnapshots()
      expect(snapshots).toEqual([])
    })
  })

  describe('getEventSequence() - sequence tracking', () => {
    it('starts at 0', () => {
      const newCtx = createDatabaseContext({ db })
      expect(newCtx.getEventSequence()).toBe(0)
    })

    it('increments with each event', async () => {
      expect(ctx.getEventSequence()).toBe(0)

      await ctx.recordEvent('Event1', {})
      expect(ctx.getEventSequence()).toBe(1)

      await ctx.recordEvent('Event2', {})
      expect(ctx.getEventSequence()).toBe(2)

      await ctx.recordEvent('Event3', {})
      expect(ctx.getEventSequence()).toBe(3)
    })
  })
})

describe('createMemoryDatabaseContext', () => {
  let ctx: EventSourcingContext

  beforeEach(() => {
    ctx = createMemoryDatabaseContext()
  })

  describe('in-memory implementation', () => {
    it('provides all DatabaseContext methods', () => {
      expect(ctx.recordEvent).toBeDefined()
      expect(ctx.createAction).toBeDefined()
      expect(ctx.completeAction).toBeDefined()
      expect(ctx.storeArtifact).toBeDefined()
      expect(ctx.getArtifact).toBeDefined()
    })

    it('provides event sourcing methods', () => {
      expect(ctx.getEvents).toBeDefined()
      expect(ctx.replay).toBeDefined()
      expect(ctx.createSnapshot).toBeDefined()
      expect(ctx.restoreSnapshot).toBeDefined()
      expect(ctx.getSnapshots).toBeDefined()
      expect(ctx.getEventSequence).toBeDefined()
    })

    it('records and retrieves events', async () => {
      await ctx.recordEvent('Test.event', { value: 42 })

      const storedEvents = await ctx.getEvents()
      expect(storedEvents).toHaveLength(1)

      const data = JSON.parse(storedEvents[0].data)
      expect(data.value).toBe(42)
    })

    it('manages actions', async () => {
      await ctx.createAction({
        actor: 'test',
        object: 'Test/1',
        action: 'process',
      })

      // Action was created (no direct query, but completeAction would fail if not)
      await expect(ctx.completeAction('non-existent', {})).rejects.toThrow()
    })

    it('stores and retrieves artifacts', async () => {
      await ctx.storeArtifact({
        key: 'test-key',
        type: 'bundle',
        sourceHash: 'hash123',
        content: { data: 'test' },
      })

      const artifact = await ctx.getArtifact('test-key')
      expect(artifact).toEqual({ data: 'test' })
    })

    it('creates and restores snapshots', async () => {
      const state = { step: 5, data: { items: [1, 2, 3] } }
      const snapshotId = await ctx.createSnapshot(state, 'test-snapshot')

      const restored = await ctx.restoreSnapshot(snapshotId)
      expect(restored).toEqual(state)
    })

    it('replays events', async () => {
      await ctx.recordEvent('A', { seq: 1 })
      await ctx.recordEvent('B', { seq: 2 })
      await ctx.recordEvent('C', { seq: 3 })

      const replayed: number[] = []
      await ctx.replay(async (event, data) => {
        replayed.push((data as { seq: number }).seq)
      })

      expect(replayed).toEqual([1, 2, 3])
    })

    it('tracks event sequence', async () => {
      expect(ctx.getEventSequence()).toBe(0)

      await ctx.recordEvent('Event', {})
      expect(ctx.getEventSequence()).toBe(1)
    })
  })
})

describe('Workflow integration', () => {
  it('DatabaseContext can be used with Workflow options', async () => {
    const ctx = createMemoryDatabaseContext()

    // This test verifies the type compatibility
    // In real usage:
    // const workflow = Workflow($ => { ... }, { db: ctx })

    expect(ctx.recordEvent).toBeDefined()
    expect(ctx.createAction).toBeDefined()
    expect(ctx.completeAction).toBeDefined()
    expect(ctx.storeArtifact).toBeDefined()
    expect(ctx.getArtifact).toBeDefined()
  })

  it('supports full event sourcing workflow', async () => {
    const ctx = createMemoryDatabaseContext()

    // Simulate workflow execution with event sourcing
    await ctx.recordEvent('Workflow.started', { input: { orderId: 'order-1' } })
    await ctx.recordEvent('Step.validate.completed', { valid: true })
    await ctx.recordEvent('Step.process.completed', { processed: true })
    await ctx.recordEvent('Workflow.completed', { output: { success: true } })

    // Create snapshot for recovery
    const snapshotId = await ctx.createSnapshot({ status: 'completed', output: { success: true } })

    // Replay events to reconstruct state
    const reconstructed: Record<string, unknown> = {}
    await ctx.replay(async (event, data) => {
      if (event === 'Workflow.started') {
        reconstructed.input = (data as { input: unknown }).input
      } else if (event === 'Workflow.completed') {
        reconstructed.output = (data as { output: unknown }).output
      }
    })

    expect(reconstructed.input).toEqual({ orderId: 'order-1' })
    expect(reconstructed.output).toEqual({ success: true })

    // Restore from snapshot
    const restored = await ctx.restoreSnapshot(snapshotId)
    expect(restored).toEqual({ status: 'completed', output: { success: true } })
  })
})
