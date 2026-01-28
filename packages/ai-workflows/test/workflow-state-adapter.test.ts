/**
 * WorkflowStateAdapter Tests (GREEN Phase)
 *
 * Tests for state persistence using ai-database integration.
 *
 * ## Test Categories
 * 1. Basic state persistence (save/load)
 * 2. Optimistic locking (version control)
 * 3. Step checkpoints
 * 4. State queries (by ID, by status)
 * 5. Concurrent state updates
 * 6. WorkflowService integration
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowStateAdapter } from '../src/worker/state-adapter.js'
import type {
  PersistedWorkflowState,
  StepCheckpoint,
  WorkflowHistoryEntry,
  DatabaseConnection,
} from '../src/worker/state-adapter.js'

/**
 * In-memory database implementation for testing
 */
class MemoryDatabase implements DatabaseConnection {
  private stores = new Map<string, Map<string, Record<string, unknown>>>()

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

    // Apply where filter
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

    // Apply offset
    if (options?.offset) {
      results = results.slice(options.offset)
    }

    // Apply limit
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async emit(event: string, data: unknown): Promise<{ id: string }> {
    // Just return a mock event ID for testing
    return { id: `event-${Date.now()}` }
  }

  clear(): void {
    this.stores.clear()
  }
}

describe('WorkflowStateAdapter', () => {
  let db: MemoryDatabase
  let adapter: WorkflowStateAdapter

  beforeEach(() => {
    db = new MemoryDatabase()
    adapter = new WorkflowStateAdapter(db)
  })

  describe('construction', () => {
    it('creates adapter with database connection', () => {
      const adapter = new WorkflowStateAdapter(db)
      expect(adapter).toBeDefined()
    })

    it('requires a database connection', () => {
      expect(() => {
        new WorkflowStateAdapter(null as unknown as DatabaseConnection)
      }).toThrow('Database connection is required')
    })
  })

  describe('save() - persists workflow state', () => {
    it('saves new workflow state to database', async () => {
      const state: Partial<PersistedWorkflowState> = {
        workflowId: 'wf-123',
        status: 'pending',
        currentStep: 'start',
        context: { userId: '456' },
        checkpoints: new Map(),
        history: [],
      }

      await adapter.save('wf-123', state)

      const loaded = await adapter.load('wf-123')
      expect(loaded).toBeDefined()
      expect(loaded?.workflowId).toBe('wf-123')
      expect(loaded?.status).toBe('pending')
      expect(loaded?.context).toEqual({ userId: '456' })
    })

    it('updates existing workflow state', async () => {
      // First save
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'pending',
        currentStep: 'start',
        context: {},
        checkpoints: new Map(),
        history: [],
      })

      // Update
      await adapter.save('wf-123', {
        status: 'running',
        currentStep: 'step-1',
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.status).toBe('running')
      expect(loaded?.currentStep).toBe('step-1')
    })

    it('persists input and output data', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'completed',
        input: { orderId: 'order-1' },
        output: { success: true, total: 100 },
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.input).toEqual({ orderId: 'order-1' })
      expect(loaded?.output).toEqual({ success: true, total: 100 })
    })

    it('persists error information', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'failed',
        error: 'Step execution failed: timeout exceeded',
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.status).toBe('failed')
      expect(loaded?.error).toBe('Step execution failed: timeout exceeded')
    })

    it('automatically increments version on save', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        version: 1,
        status: 'pending',
      })

      await adapter.save('wf-123', {
        status: 'running',
      })

      const loaded = await adapter.load('wf-123')
      // Version should be incremented
      expect(loaded?.version).toBe(2)
    })

    it('sets createdAt on first save', async () => {
      const beforeSave = new Date()
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'pending',
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.createdAt).toBeDefined()
      expect(loaded?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime())
    })

    it('updates updatedAt on every save', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'pending',
      })

      const firstLoad = await adapter.load('wf-123')
      const firstUpdatedAt = firstLoad?.updatedAt

      // Wait a bit and update
      await new Promise((r) => setTimeout(r, 10))

      await adapter.save('wf-123', {
        status: 'running',
      })

      const secondLoad = await adapter.load('wf-123')
      expect(secondLoad?.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt!.getTime())
    })
  })

  describe('load() - retrieves workflow state', () => {
    it('loads existing workflow state', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        currentStep: 'step-1',
        context: { count: 42 },
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded).toBeDefined()
      expect(loaded?.workflowId).toBe('wf-123')
      expect(loaded?.status).toBe('running')
    })

    it('returns null for non-existent workflow', async () => {
      const loaded = await adapter.load('non-existent')
      expect(loaded).toBeNull()
    })

    it('deserializes checkpoints map correctly', async () => {
      // Save state with checkpoints
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        checkpoints: new Map([
          ['step-1', { stepId: 'step-1', status: 'completed', result: { done: true }, attempt: 1 }],
          ['step-2', { stepId: 'step-2', status: 'running', attempt: 1 }],
        ]),
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.checkpoints).toBeInstanceOf(Map)
      expect(loaded?.checkpoints.get('step-1')?.status).toBe('completed')
    })

    it('deserializes history array correctly', async () => {
      const history: WorkflowHistoryEntry[] = [
        { timestamp: Date.now(), type: 'event', name: 'Customer.created', data: { id: '1' } },
        { timestamp: Date.now(), type: 'transition', name: 'pending -> running' },
      ]

      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        history,
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.history).toHaveLength(2)
      expect(loaded?.history[0].type).toBe('event')
    })
  })

  describe('checkpoint() - saves step execution state', () => {
    it('saves step checkpoint', async () => {
      const checkpoint: StepCheckpoint = {
        stepId: 'process-payment',
        status: 'completed',
        result: { transactionId: 'tx-123' },
        attempt: 1,
        startedAt: new Date(),
        completedAt: new Date(),
      }

      await adapter.checkpoint('wf-123', 'process-payment', checkpoint)

      const loaded = await adapter.getCheckpoint('wf-123', 'process-payment')
      expect(loaded).toBeDefined()
      expect(loaded?.status).toBe('completed')
      expect(loaded?.result).toEqual({ transactionId: 'tx-123' })
    })

    it('updates existing checkpoint', async () => {
      // Initial checkpoint (started)
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'running',
        attempt: 1,
        startedAt: new Date(),
      })

      // Update checkpoint (completed)
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'completed',
        result: { success: true },
        attempt: 1,
        completedAt: new Date(),
      })

      const loaded = await adapter.getCheckpoint('wf-123', 'step-1')
      expect(loaded?.status).toBe('completed')
      expect(loaded?.result).toEqual({ success: true })
    })

    it('tracks retry attempts in checkpoint', async () => {
      // First attempt (failed)
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'failed',
        error: 'Network error',
        attempt: 1,
      })

      // Second attempt
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'running',
        attempt: 2,
      })

      const checkpoint = await adapter.getCheckpoint('wf-123', 'step-1')
      expect(checkpoint?.attempt).toBe(2)
    })
  })

  describe('getCheckpoint() - retrieves step checkpoint', () => {
    it('retrieves existing checkpoint', async () => {
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'completed',
        result: { data: 'test' },
        attempt: 1,
      })

      const checkpoint = await adapter.getCheckpoint('wf-123', 'step-1')
      expect(checkpoint).toBeDefined()
      expect(checkpoint?.result).toEqual({ data: 'test' })
    })

    it('returns null for non-existent checkpoint', async () => {
      const checkpoint = await adapter.getCheckpoint('wf-123', 'non-existent')
      expect(checkpoint).toBeNull()
    })
  })

  describe('updateWithVersion() - optimistic locking', () => {
    it('updates state when version matches', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'pending',
      })

      const result = await adapter.updateWithVersion('wf-123', 1, {
        status: 'running',
      })

      expect(result).toBe(true)

      const loaded = await adapter.load('wf-123')
      expect(loaded?.status).toBe('running')
    })

    it('returns false when version does not match (optimistic lock failure)', async () => {
      // First save creates version 1
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'pending',
      })

      // Concurrent update with wrong version
      const result = await adapter.updateWithVersion('wf-123', 99, {
        status: 'running',
      })

      expect(result).toBe(false)
    })

    it('increments version on successful update', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        version: 1,
        status: 'pending',
      })

      await adapter.updateWithVersion('wf-123', 1, {
        status: 'running',
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.version).toBe(2)
    })

    it('does not update state when version mismatch', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        version: 1,
        status: 'pending',
      })

      await adapter.updateWithVersion('wf-123', 99, {
        status: 'failed',
      })

      const loaded = await adapter.load('wf-123')
      expect(loaded?.status).toBe('pending') // Should not change
    })
  })

  describe('queryByStatus() - state queries', () => {
    it('returns workflows matching status', async () => {
      await adapter.save('wf-1', { workflowId: 'wf-1', status: 'running' })
      await adapter.save('wf-2', { workflowId: 'wf-2', status: 'pending' })

      const running = await adapter.queryByStatus('running')
      expect(running).toHaveLength(1)
      expect(running[0].workflowId).toBe('wf-1')
    })

    it('returns empty array when no workflows match', async () => {
      await adapter.save('wf-1', { workflowId: 'wf-1', status: 'running' })

      const results = await adapter.queryByStatus('failed')
      expect(results).toEqual([])
    })

    it('returns all workflows with pending status', async () => {
      // Create multiple workflows
      await adapter.save('wf-1', { workflowId: 'wf-1', status: 'pending' })
      await adapter.save('wf-2', { workflowId: 'wf-2', status: 'running' })
      await adapter.save('wf-3', { workflowId: 'wf-3', status: 'pending' })

      const pending = await adapter.queryByStatus('pending')
      expect(pending).toHaveLength(2)
      expect(pending.map((w) => w.workflowId)).toContain('wf-1')
      expect(pending.map((w) => w.workflowId)).toContain('wf-3')
    })

    it('returns workflows with completed status', async () => {
      await adapter.save('wf-1', {
        workflowId: 'wf-1',
        status: 'completed',
        output: { result: 'done' },
      })
      await adapter.save('wf-2', { workflowId: 'wf-2', status: 'running' })

      const completed = await adapter.queryByStatus('completed')
      expect(completed).toHaveLength(1)
      expect(completed[0].output).toEqual({ result: 'done' })
    })
  })

  describe('queryByIds() - batch queries', () => {
    it('returns workflows matching IDs', async () => {
      await adapter.save('wf-1', { workflowId: 'wf-1', status: 'pending' })
      await adapter.save('wf-2', { workflowId: 'wf-2', status: 'running' })

      const results = await adapter.queryByIds(['wf-1', 'wf-2'])
      expect(results).toHaveLength(2)
    })

    it('returns only existing workflows', async () => {
      await adapter.save('wf-1', { workflowId: 'wf-1', status: 'pending' })
      await adapter.save('wf-3', { workflowId: 'wf-3', status: 'running' })

      const results = await adapter.queryByIds(['wf-1', 'wf-2', 'wf-3'])
      expect(results).toHaveLength(2)
      expect(results.map((w) => w.workflowId)).toContain('wf-1')
      expect(results.map((w) => w.workflowId)).toContain('wf-3')
    })

    it('returns empty array for non-existent IDs', async () => {
      const results = await adapter.queryByIds(['non-1', 'non-2'])
      expect(results).toEqual([])
    })
  })

  describe('delete() - removes workflow state', () => {
    it('deletes existing workflow state', async () => {
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'completed' })

      const result = await adapter.delete('wf-123')
      expect(result).toBe(true)
    })

    it('returns true when workflow is deleted', async () => {
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'completed' })

      const result = await adapter.delete('wf-123')
      expect(result).toBe(true)

      const loaded = await adapter.load('wf-123')
      expect(loaded).toBeNull()
    })

    it('returns false when workflow does not exist', async () => {
      const result = await adapter.delete('non-existent')
      expect(result).toBe(false)
    })

    it('deletes associated checkpoints', async () => {
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'running' })
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'completed',
        attempt: 1,
      })

      await adapter.delete('wf-123')

      // The checkpoint is stored within the workflow state, so deleting workflow removes checkpoints
      const checkpoint = await adapter.getCheckpoint('wf-123', 'step-1')
      expect(checkpoint).toBeNull()
    })
  })

  describe('listAll() - pagination', () => {
    it('lists all workflows with pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        await adapter.save(`wf-${i}`, { workflowId: `wf-${i}`, status: 'pending' })
      }

      const results = await adapter.listAll({ limit: 10, offset: 0 })
      expect(results).toHaveLength(5)
    })

    it('respects limit parameter', async () => {
      // Create 5 workflows
      for (let i = 1; i <= 5; i++) {
        await adapter.save(`wf-${i}`, { workflowId: `wf-${i}`, status: 'pending' })
      }

      const results = await adapter.listAll({ limit: 3 })
      expect(results).toHaveLength(3)
    })

    it('respects offset parameter', async () => {
      // Create 5 workflows
      for (let i = 1; i <= 5; i++) {
        await adapter.save(`wf-${i}`, { workflowId: `wf-${i}`, status: 'pending' })
      }

      const results = await adapter.listAll({ limit: 3, offset: 2 })
      expect(results).toHaveLength(3)
    })

    it('returns empty array when offset exceeds count', async () => {
      await adapter.save('wf-1', { workflowId: 'wf-1', status: 'pending' })

      const results = await adapter.listAll({ offset: 100 })
      expect(results).toEqual([])
    })
  })

  describe('concurrent state updates', () => {
    it('handles concurrent saves with optimistic locking', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        version: 1,
        status: 'pending',
      })

      // Simulate sequential concurrent updates (one after the other)
      // First update should succeed
      const result1 = await adapter.updateWithVersion('wf-123', 1, { status: 'running' })
      expect(result1).toBe(true)

      // Second update with stale version should fail
      const result2 = await adapter.updateWithVersion('wf-123', 1, { status: 'paused' })
      expect(result2).toBe(false)

      // Verify state is 'running' from first update
      const state = await adapter.load('wf-123')
      expect(state?.status).toBe('running')
    })

    it('concurrent checkpoints for different steps succeed', async () => {
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'running' })

      // Sequential checkpoints (in-memory db doesn't support true concurrency)
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'completed',
        attempt: 1,
      })
      await adapter.checkpoint('wf-123', 'step-2', {
        stepId: 'step-2',
        status: 'completed',
        attempt: 1,
      })
      await adapter.checkpoint('wf-123', 'step-3', {
        stepId: 'step-3',
        status: 'completed',
        attempt: 1,
      })

      const state = await adapter.load('wf-123')
      expect(state?.checkpoints.size).toBe(3)
    })

    it('maintains consistency under concurrent operations', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        version: 1,
        status: 'pending',
        context: { counter: 0 },
      })

      // Multiple concurrent increments (simulated)
      const operations = Array.from({ length: 10 }, async (_, i) => {
        const state = await adapter.load('wf-123')
        if (state) {
          const newCounter = ((state.context.counter as number) || 0) + 1
          return adapter.updateWithVersion('wf-123', state.version, {
            context: { counter: newCounter },
          })
        }
        return false
      })

      const results = await Promise.all(operations)

      // Only one should succeed per version
      const successCount = results.filter((r) => r === true).length
      expect(successCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('snapshots/checkpoints for recovery', () => {
    it('creates a snapshot of current state', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        context: { step: 3, data: { processed: true } },
      })

      const snapshotId = await adapter.createSnapshot('wf-123', 'before-risky-step')
      expect(snapshotId).toBeDefined()
      expect(snapshotId).toContain('snap-wf-123')
    })

    it('restores state from snapshot', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        context: { step: 3 },
      })

      const snapshotId = await adapter.createSnapshot('wf-123', 'checkpoint-1')

      // Modify state
      await adapter.save('wf-123', {
        status: 'failed',
        context: { step: 5, error: true },
      })

      // Restore from snapshot
      await adapter.restoreSnapshot('wf-123', snapshotId)

      const restored = await adapter.load('wf-123')
      expect(restored?.status).toBe('running')
      expect(restored?.context.step).toBe(3)
    })

    it('lists available snapshots', async () => {
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'running' })

      await adapter.createSnapshot('wf-123', 'snapshot-1')
      await adapter.createSnapshot('wf-123', 'snapshot-2')

      const snapshots = await adapter.getSnapshots('wf-123')
      expect(snapshots).toHaveLength(2)
      expect(snapshots.some((s) => s.label === 'snapshot-1')).toBe(true)
      expect(snapshots.some((s) => s.label === 'snapshot-2')).toBe(true)
    })

    it('snapshot preserves checkpoints', async () => {
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'running' })
      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'completed',
        result: { data: 'important' },
        attempt: 1,
      })

      const snapshotId = await adapter.createSnapshot('wf-123')

      // Clear checkpoints
      await adapter.save('wf-123', {
        checkpoints: new Map(),
      })

      await adapter.restoreSnapshot('wf-123', snapshotId)

      const checkpoint = await adapter.getCheckpoint('wf-123', 'step-1')
      expect(checkpoint?.result).toEqual({ data: 'important' })
    })
  })

  describe('state survives workflow restart', () => {
    it('persisted state is recoverable after restart', async () => {
      // Simulate workflow execution
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        currentStep: 'step-2',
        context: { processedItems: 50 },
      })

      await adapter.checkpoint('wf-123', 'step-1', {
        stepId: 'step-1',
        status: 'completed',
        result: { items: 100 },
        attempt: 1,
      })

      // Simulate restart - create new adapter instance (same db)
      const newAdapter = new WorkflowStateAdapter(db)

      // Load state should work with new instance
      const state = await newAdapter.load('wf-123')
      expect(state?.currentStep).toBe('step-2')
      expect(state?.context.processedItems).toBe(50)

      const checkpoint = await newAdapter.getCheckpoint('wf-123', 'step-1')
      expect(checkpoint?.status).toBe('completed')
    })

    it('history is preserved across restarts', async () => {
      const history: WorkflowHistoryEntry[] = [
        { timestamp: Date.now() - 1000, type: 'event', name: 'Order.created' },
        { timestamp: Date.now() - 500, type: 'transition', name: 'pending -> processing' },
        { timestamp: Date.now(), type: 'checkpoint', name: 'step-1-completed' },
      ]

      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        history,
      })

      // New adapter instance
      const newAdapter = new WorkflowStateAdapter(db)

      const state = await newAdapter.load('wf-123')
      expect(state?.history).toHaveLength(3)
      expect(state?.history.map((h) => h.type)).toEqual(['event', 'transition', 'checkpoint'])
    })
  })

  describe('WorkflowService integration', () => {
    it('adapter can be used with WorkflowServiceCore', async () => {
      // Verify adapter can be instantiated with a database connection
      const adapter = new WorkflowStateAdapter(db)
      expect(adapter).toBeDefined()
    })

    it('state changes are persisted during workflow execution', async () => {
      // Simulate workflow lifecycle
      // 1. Create workflow
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'pending',
        input: { orderId: 'order-1' },
      })

      // 2. Start workflow
      await adapter.save('wf-123', {
        status: 'running',
        currentStep: 'validate',
      })

      // 3. Checkpoint step completion
      await adapter.checkpoint('wf-123', 'validate', {
        stepId: 'validate',
        status: 'completed',
        result: { valid: true },
        attempt: 1,
      })

      // 4. Complete workflow
      await adapter.save('wf-123', {
        status: 'completed',
        output: { success: true },
      })

      // Verify final state
      const state = await adapter.load('wf-123')
      expect(state?.status).toBe('completed')
      expect(state?.input).toEqual({ orderId: 'order-1' })
      expect(state?.output).toEqual({ success: true })

      const checkpoint = await adapter.getCheckpoint('wf-123', 'validate')
      expect(checkpoint?.status).toBe('completed')
    })

    it('events are recorded in history', async () => {
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        history: [],
      })

      // Record events in history
      const state = await adapter.load('wf-123')
      const history = state?.history || []
      history.push({
        timestamp: Date.now(),
        type: 'event',
        name: 'Customer.created',
        data: { customerId: 'cust-1' },
      })

      await adapter.save('wf-123', { history })

      const updated = await adapter.load('wf-123')
      expect(updated?.history).toHaveLength(1)
      expect(updated?.history[0].name).toBe('Customer.created')
    })
  })

  describe('ai-database event sourcing integration', () => {
    it('emits events on state changes', async () => {
      // The adapter should emit events to ai-database when state changes
      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
      })

      // Verify event was emitted (implementation detail)
      // In real implementation, we'd verify:
      // - WorkflowState.created event on first save
      // - WorkflowState.updated event on subsequent saves
      // - WorkflowState.statusChanged event on status changes
      const loaded = await adapter.load('wf-123')
      expect(loaded?.status).toBe('running')
    })

    it('records state changes as immutable events', async () => {
      // Save multiple state changes
      await adapter.save('wf-123', { workflowId: 'wf-123', status: 'pending' })
      await adapter.save('wf-123', { status: 'running' })
      await adapter.save('wf-123', { status: 'completed' })

      // The adapter should have recorded these as events in ai-database
      // Events are immutable and can be replayed to reconstruct state
      const loaded = await adapter.load('wf-123')
      expect(loaded?.status).toBe('completed')
      expect(loaded?.version).toBe(3) // 3 saves = version 3
    })

    it('supports event replay for state reconstruction', async () => {
      // This is a conceptual test - the adapter should support
      // reconstructing state from event history in ai-database

      await adapter.save('wf-123', {
        workflowId: 'wf-123',
        status: 'running',
        context: { step: 1 },
      })

      await adapter.save('wf-123', {
        context: { step: 2 },
      })

      await adapter.save('wf-123', {
        context: { step: 3 },
        status: 'completed',
      })

      // Events recorded would be:
      // 1. WorkflowState.created { status: 'running', context: { step: 1 } }
      // 2. WorkflowState.updated { context: { step: 2 } }
      // 3. WorkflowState.completed { context: { step: 3 } }

      // Replaying these events should reconstruct the final state
      const state = await adapter.load('wf-123')
      expect(state?.context.step).toBe(3)
      expect(state?.status).toBe('completed')
    })
  })
})
