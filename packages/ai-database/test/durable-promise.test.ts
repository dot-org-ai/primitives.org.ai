/**
 * DurablePromise tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DurablePromise,
  isDurablePromise,
  durable,
  DURABLE_PROMISE_SYMBOL,
  getCurrentContext,
  withContext,
  setDefaultContext,
  getBatchScheduler,
  setBatchScheduler,
} from '../src/durable-promise.js'

describe('DurablePromise', () => {
  afterEach(() => {
    setBatchScheduler(null)
  })

  describe('basic resolution', () => {
    it('resolves with executor result', async () => {
      const p = new DurablePromise({
        method: 'test.hello',
        executor: async () => 42,
      })
      expect(await p).toBe(42)
    })

    it('rejects when executor throws', async () => {
      const p = new DurablePromise({
        method: 'test.fail',
        executor: async () => {
          throw new Error('boom')
        },
      })
      await expect(p.then()).rejects.toThrow('boom')
    })

    it('supports .catch()', async () => {
      const p = new DurablePromise({
        method: 'test.fail',
        executor: async () => {
          throw new Error('caught')
        },
      })
      const result = await p.catch((e: unknown) => (e as Error).message)
      expect(result).toBe('caught')
    })

    it('supports .finally()', async () => {
      let finalized = false
      const p = new DurablePromise({
        method: 'test.finally',
        executor: async () => 'done',
      })
      const result = await p.finally(() => {
        finalized = true
      })
      expect(result).toBe('done')
      expect(finalized).toBe(true)
    })
  })

  describe('properties', () => {
    it('has a method property', () => {
      const p = new DurablePromise({
        method: 'ai.generate',
        executor: async () => null,
      })
      expect(p.method).toBe('ai.generate')
    })

    it('has an actionId (UUID)', () => {
      const p = new DurablePromise({
        method: 'test.id',
        executor: async () => null,
      })
      expect(p.actionId).toBeTruthy()
      expect(typeof p.actionId).toBe('string')
    })

    it('defaults priority to standard', () => {
      const p = new DurablePromise({
        method: 'test.priority',
        executor: async () => null,
      })
      expect(p.priority).toBe('standard')
    })

    it('accepts custom priority', () => {
      const p = new DurablePromise({
        method: 'test.priority',
        executor: async () => null,
        priority: 'batch',
      })
      expect(p.priority).toBe('batch')
    })

    it('has the DURABLE_PROMISE_SYMBOL', () => {
      const p = new DurablePromise({
        method: 'test.symbol',
        executor: async () => null,
      })
      expect((p as any)[DURABLE_PROMISE_SYMBOL]).toBe(true)
    })
  })

  describe('status', () => {
    it('reports completed after resolution', async () => {
      const p = new DurablePromise({
        method: 'test.status',
        executor: async () => 'ok',
      })
      await p
      expect(p.status).toBe('completed')
    })

    it('reports failed after rejection', async () => {
      const p = new DurablePromise({
        method: 'test.status',
        executor: async () => {
          throw new Error('fail')
        },
      })
      await p.catch(() => {})
      expect(p.status).toBe('failed')
    })
  })

  describe('cancel', () => {
    it('rejects with cancelled error when no provider', async () => {
      let resolve: (v: string) => void
      const p = new DurablePromise({
        method: 'test.cancel',
        executor: () =>
          new Promise<string>((r) => {
            resolve = r
          }),
      })
      await p.cancel()
      await expect(p.then()).rejects.toThrow('cancelled')
    })

    it('throws if already resolved', async () => {
      const p = new DurablePromise({
        method: 'test.cancel',
        executor: async () => 'done',
      })
      await p
      await expect(p.cancel()).rejects.toThrow('Cannot cancel a resolved or rejected promise')
    })
  })

  describe('getResult', () => {
    it('returns value and duration', async () => {
      const p = new DurablePromise({
        method: 'test.result',
        executor: async () => 'hello',
      })
      const result = await p.getResult()
      expect(result.value).toBe('hello')
      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('isDurablePromise', () => {
  it('returns true for DurablePromise instances', () => {
    const p = new DurablePromise({
      method: 'test.check',
      executor: async () => null,
    })
    expect(isDurablePromise(p)).toBe(true)
  })

  it('returns false for regular promises', () => {
    expect(isDurablePromise(Promise.resolve(42))).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isDurablePromise(null)).toBe(false)
    expect(isDurablePromise(undefined)).toBe(false)
    expect(isDurablePromise(42)).toBe(false)
    expect(isDurablePromise('string')).toBe(false)
  })
})

describe('durable() factory', () => {
  it('creates a DurablePromise', async () => {
    const p = durable('test.factory', async () => 99)
    expect(isDurablePromise(p)).toBe(true)
    expect(await p).toBe(99)
  })

  it('passes options through', () => {
    const p = durable('test.factory', async () => null, { priority: 'flex' })
    expect(p.priority).toBe('flex')
  })
})

describe('Context', () => {
  it('getCurrentContext returns undefined with no context', () => {
    expect(getCurrentContext()).toBeUndefined()
  })

  it('withContext sets and restores context', async () => {
    expect(getCurrentContext()).toBeUndefined()
    await withContext({ priority: 'batch' }, async () => {
      expect(getCurrentContext()?.priority).toBe('batch')
    })
    expect(getCurrentContext()).toBeUndefined()
  })

  it('nested contexts inherit from parent', async () => {
    await withContext({ priority: 'flex', actor: 'user1' }, async () => {
      expect(getCurrentContext()?.priority).toBe('flex')
      expect(getCurrentContext()?.actor).toBe('user1')

      await withContext({ priority: 'batch' }, async () => {
        expect(getCurrentContext()?.priority).toBe('batch')
        // actor inherited
        expect(getCurrentContext()?.actor).toBe('user1')
      })

      expect(getCurrentContext()?.priority).toBe('flex')
    })
  })

  it('DurablePromise inherits priority from context', async () => {
    await withContext({ priority: 'flex' }, async () => {
      const p = new DurablePromise({
        method: 'test.ctx',
        executor: async () => null,
      })
      expect(p.priority).toBe('flex')
    })
  })
})

describe('BatchScheduler singleton', () => {
  afterEach(() => {
    setBatchScheduler(null)
  })

  it('defaults to null', () => {
    expect(getBatchScheduler()).toBeNull()
  })

  it('can be set and retrieved', () => {
    const mock = { enqueue: () => {}, flush: async () => {}, pending: 0 }
    setBatchScheduler(mock)
    expect(getBatchScheduler()).toBe(mock)
  })

  it('can be cleared', () => {
    const mock = { enqueue: () => {}, flush: async () => {}, pending: 0 }
    setBatchScheduler(mock)
    setBatchScheduler(null)
    expect(getBatchScheduler()).toBeNull()
  })
})
