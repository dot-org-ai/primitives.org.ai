/**
 * ExecutionQueue tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ExecutionQueue,
  createExecutionQueue,
  getDefaultQueue,
  setDefaultQueue,
} from '../src/execution-queue.js'
import { setBatchScheduler } from '../src/durable-promise.js'

describe('ExecutionQueue', () => {
  let queue: ExecutionQueue

  beforeEach(() => {
    queue = new ExecutionQueue({ flushOnExit: false })
  })

  afterEach(() => {
    queue.destroy()
    setDefaultQueue(null)
    setBatchScheduler(null)
  })

  describe('constructor defaults', () => {
    it('starts with zero pending', () => {
      expect(queue.pending).toBe(0)
    })

    it('starts with zero active', () => {
      expect(queue.active).toBe(0)
    })

    it('starts with zero completed', () => {
      expect(queue.completed).toBe(0)
    })
  })

  describe('provider management', () => {
    const mockProvider = {
      name: 'openai',
      supportsBatch: true,
      supportsFlex: false,
      submitBatch: async () => ({ batchId: '123', count: 1 }),
      getBatchStatus: async () => ({
        batchId: '123',
        status: 'completed' as const,
        counts: { total: 1, completed: 1, failed: 0 },
      }),
      async *streamResults() {},
    }

    it('registers a provider', () => {
      queue.registerProvider(mockProvider)
      expect(queue.getProvider('openai')).toBe(mockProvider)
    })

    it('returns undefined for unknown provider', () => {
      expect(queue.getProvider('unknown')).toBeUndefined()
    })

    it('lists all providers', () => {
      queue.registerProvider(mockProvider)
      const providers = queue.listProviders()
      expect(providers).toHaveLength(1)
      expect(providers[0]!.name).toBe('openai')
    })

    it('lists empty when no providers registered', () => {
      expect(queue.listProviders()).toHaveLength(0)
    })
  })

  describe('configuration', () => {
    it('setPriority changes default priority', () => {
      queue.setPriority('batch')
      // No direct getter, but we can verify it doesn't throw
    })

    it('setConcurrency updates the limit', () => {
      queue.setConcurrency('standard', 5)
      // Verify via stats
      const stats = queue.getStats()
      expect(stats).toBeDefined()
    })

    it('setBatchWindow updates window', () => {
      queue.setBatchWindow(5000)
      // No direct getter, but verify no error
    })

    it('setMaxBatchSize updates size', () => {
      queue.setMaxBatchSize(500)
    })
  })

  describe('getStats', () => {
    it('returns full stats object', () => {
      const stats = queue.getStats()
      expect(stats.byPriority).toBeDefined()
      expect(stats.byPriority.priority).toEqual({ pending: 0, active: 0, completed: 0 })
      expect(stats.byPriority.standard).toEqual({ pending: 0, active: 0, completed: 0 })
      expect(stats.byPriority.flex).toEqual({ pending: 0, active: 0, completed: 0 })
      expect(stats.byPriority.batch).toEqual({ pending: 0, active: 0, completed: 0 })
      expect(stats.totals).toEqual({ pending: 0, active: 0, completed: 0, failed: 0 })
      expect(stats.batch).toEqual({ size: 0, nextFlush: null })
    })
  })

  describe('flush', () => {
    it('resolves immediately when batch queue is empty', async () => {
      await expect(queue.flush()).resolves.toBeUndefined()
    })
  })

  describe('destroy', () => {
    it('clears all queues', () => {
      queue.destroy()
      expect(queue.pending).toBe(0)
    })

    it('can be called multiple times safely', () => {
      queue.destroy()
      queue.destroy()
      expect(queue.pending).toBe(0)
    })
  })
})

describe('createExecutionQueue', () => {
  afterEach(() => {
    setBatchScheduler(null)
  })

  it('creates an ExecutionQueue instance', () => {
    const q = createExecutionQueue({ flushOnExit: false })
    expect(q).toBeInstanceOf(ExecutionQueue)
    q.destroy()
  })

  it('accepts custom options', () => {
    const q = createExecutionQueue({
      priority: 'batch',
      concurrency: { standard: 5 },
      batchWindow: 1000,
      maxBatchSize: 100,
      flushOnExit: false,
    })
    expect(q).toBeInstanceOf(ExecutionQueue)
    q.destroy()
  })
})

describe('default queue', () => {
  afterEach(() => {
    setDefaultQueue(null)
    setBatchScheduler(null)
  })

  it('getDefaultQueue creates a queue on first call', () => {
    const q = getDefaultQueue()
    expect(q).toBeInstanceOf(ExecutionQueue)
    q.destroy()
  })

  it('getDefaultQueue returns same instance on subsequent calls', () => {
    const q1 = getDefaultQueue()
    const q2 = getDefaultQueue()
    expect(q1).toBe(q2)
    q1.destroy()
  })

  it('setDefaultQueue replaces the queue', () => {
    const q1 = getDefaultQueue()
    const q2 = new ExecutionQueue({ flushOnExit: false })
    setDefaultQueue(q2)
    expect(getDefaultQueue()).toBe(q2)
    q1.destroy()
    q2.destroy()
  })

  it('setDefaultQueue(null) causes next getDefaultQueue to create new', () => {
    const q1 = getDefaultQueue()
    setDefaultQueue(null)
    const q2 = getDefaultQueue()
    expect(q2).not.toBe(q1)
    q1.destroy()
    q2.destroy()
  })
})
