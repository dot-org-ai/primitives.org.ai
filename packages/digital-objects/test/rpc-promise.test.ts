/**
 * Tests for RpcPromise pipelining
 *
 * Covers:
 * - createRpcPromise wraps a plain Promise
 * - .then() interop with await
 * - .pipe() chaining without forcing resolution
 * - Property access pipelining (Cap'n Proto pattern)
 * - isRpcPromise type guard
 * - wrapRpcPromise with transform
 * - BatchCollector batching behavior
 * - Noun proxy integration with PipelineableNounProvider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRpcPromise, isRpcPromise, wrapRpcPromise, BatchCollector } from '../src/rpc-promise.js'
import type { RpcPromise, NounInstance, PipelineableNounProvider } from '../src/noun-types.js'
import { Noun } from '../src/noun.js'
import { clearRegistry } from '../src/noun-registry.js'
import { setProvider, MemoryNounProvider } from '../src/noun-proxy.js'

// =============================================================================
// createRpcPromise
// =============================================================================

describe('createRpcPromise', () => {
  it('should be thenable (works with await)', async () => {
    const rpc = createRpcPromise(Promise.resolve(42))
    const result = await rpc
    expect(result).toBe(42)
  })

  it('should support .then() chaining', async () => {
    const rpc = createRpcPromise(Promise.resolve(10))
    const result = await rpc.then((v) => v * 2)
    expect(result).toBe(20)
  })

  it('should support .then() with rejection handler', async () => {
    const rpc = createRpcPromise(Promise.reject(new Error('fail')))
    const result = await rpc.then(
      () => 'ok',
      (err) => (err as Error).message,
    )
    expect(result).toBe('fail')
  })

  it('should support .pipe() for chaining transforms', async () => {
    const rpc = createRpcPromise(Promise.resolve({ name: 'Alice', age: 30 }))
    const piped = rpc.pipe((v) => v.name.toUpperCase())
    expect(typeof piped.pipe).toBe('function')
    expect(typeof piped.then).toBe('function')
    const result = await piped
    expect(result).toBe('ALICE')
  })

  it('should support chained .pipe() calls', async () => {
    const rpc = createRpcPromise(Promise.resolve(5))
    const result = await rpc
      .pipe((v) => v * 2)
      .pipe((v) => v + 1)
      .pipe((v) => `result: ${v}`)
    expect(result).toBe('result: 11')
  })

  it('.pipe() should return an RpcPromise', () => {
    const rpc = createRpcPromise(Promise.resolve(1))
    const piped = rpc.pipe((v) => v + 1)
    expect(isRpcPromise(piped)).toBe(true)
  })

  it('.pipe() should support async transforms', async () => {
    const rpc = createRpcPromise(Promise.resolve('hello'))
    const result = await rpc.pipe(async (v) => {
      return v.toUpperCase()
    })
    expect(result).toBe('HELLO')
  })
})

// =============================================================================
// Property Access Pipelining
// =============================================================================

describe('property access pipelining', () => {
  it('should return an RpcPromise for property access', () => {
    const rpc = createRpcPromise(Promise.resolve({ name: 'Alice', $id: 'contact_1' }))
    const namePromise = (rpc as unknown as Record<string, unknown>).name
    expect(isRpcPromise(namePromise)).toBe(true)
  })

  it('should resolve property access to the correct value', async () => {
    const rpc = createRpcPromise(Promise.resolve({ name: 'Alice', $id: 'contact_1' }))
    const name = await (rpc as unknown as Record<string, RpcPromise<string>>).name
    expect(name).toBe('Alice')
  })

  it('should resolve $id property on NounInstance-like objects', async () => {
    const instance: NounInstance = {
      $id: 'contact_abc',
      $type: 'Contact',
      $context: 'https://headless.ly/~test',
      $version: 1,
      $createdAt: '2025-01-01T00:00:00.000Z',
      $updatedAt: '2025-01-01T00:00:00.000Z',
      name: 'Alice',
    }

    const rpc = createRpcPromise(Promise.resolve(instance))
    const id = await (rpc as unknown as Record<string, RpcPromise<string>>).$id
    expect(id).toBe('contact_abc')
  })

  it('should return undefined for non-existent properties', async () => {
    const rpc = createRpcPromise(Promise.resolve({ name: 'Alice' }))
    const missing = await (rpc as unknown as Record<string, RpcPromise<unknown>>).nonexistent
    expect(missing).toBeUndefined()
  })

  it('should handle null resolved values gracefully', async () => {
    const rpc = createRpcPromise(Promise.resolve(null))
    const prop = await (rpc as unknown as Record<string, RpcPromise<unknown>>).name
    expect(prop).toBeUndefined()
  })

  it('should support chaining property access with .pipe()', async () => {
    const rpc = createRpcPromise(
      Promise.resolve({
        user: { name: 'Alice' },
        $id: 'obj_1',
      }),
    )
    const result = await rpc.pipe((v) => (v as Record<string, unknown>).user).pipe((u) => (u as Record<string, string>).name)
    expect(result).toBe('Alice')
  })
})

// =============================================================================
// isRpcPromise
// =============================================================================

describe('isRpcPromise', () => {
  it('should return true for createRpcPromise result', () => {
    const rpc = createRpcPromise(Promise.resolve(1))
    expect(isRpcPromise(rpc)).toBe(true)
  })

  it('should return false for plain Promise', () => {
    expect(isRpcPromise(Promise.resolve(1))).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isRpcPromise(null)).toBe(false)
    expect(isRpcPromise(undefined)).toBe(false)
  })

  it('should return false for plain objects', () => {
    expect(isRpcPromise({ then: () => {} })).toBe(false)
    expect(isRpcPromise({ pipe: () => {} })).toBe(false)
  })

  it('should return true for objects with both then and pipe functions', () => {
    const fake = {
      then: () => {},
      pipe: () => {},
    }
    expect(isRpcPromise(fake)).toBe(true)
  })
})

// =============================================================================
// wrapRpcPromise
// =============================================================================

describe('wrapRpcPromise', () => {
  it('should apply transform before resolving', async () => {
    const rpc = wrapRpcPromise(Promise.resolve({ raw: 'data' }), (raw) => {
      const obj = raw as Record<string, string>
      return obj.raw.toUpperCase()
    })
    const result = await rpc
    expect(result).toBe('DATA')
  })

  it('should support .pipe() after transform', async () => {
    const rpc = wrapRpcPromise(Promise.resolve(10), (raw) => (raw as number) * 2)
    const result = await rpc.pipe((v) => v + 5)
    expect(result).toBe(25)
  })

  it('should support property access after transform', async () => {
    const rpc = wrapRpcPromise(
      Promise.resolve({ n: 'Bob' }),
      (raw) => ({ name: (raw as Record<string, string>).n }),
    )
    const name = await (rpc as unknown as Record<string, RpcPromise<string>>).name
    expect(name).toBe('Bob')
  })
})

// =============================================================================
// BatchCollector
// =============================================================================

describe('BatchCollector', () => {
  it('should collect operations and flush them together', async () => {
    const executeBatch = vi.fn(async (ops: { method: string }[]) => {
      return ops.map((op) => ({ result: op.method }))
    })

    const batch = new BatchCollector(executeBatch)

    const p1 = batch.enqueue('create', 'Contact', [{ name: 'Alice' }])
    const p2 = batch.enqueue('create', 'Deal', [{ title: 'Acme' }])

    expect(batch.pending).toBe(2)
    await batch.flush()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toEqual({ result: 'create' })
    expect(r2).toEqual({ result: 'create' })
    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch.mock.calls[0][0]).toHaveLength(2)
  })

  it('should auto-flush on microtask boundary', async () => {
    const executeBatch = vi.fn(async (ops: { method: string }[]) => {
      return ops.map((_, i) => `result-${i}`)
    })

    const batch = new BatchCollector(executeBatch)

    const p1 = batch.enqueue('create', 'Contact', [{ name: 'Alice' }])
    const p2 = batch.enqueue('get', 'Contact', ['contact_1'])

    // Wait for microtask to flush
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('result-0')
    expect(r2).toBe('result-1')
    expect(executeBatch).toHaveBeenCalledTimes(1)
  })

  it('should handle batch execution errors', async () => {
    const executeBatch = vi.fn(async () => {
      throw new Error('batch failed')
    })

    const batch = new BatchCollector(executeBatch)

    const p1 = batch.enqueue('create', 'Contact', [{ name: 'Alice' }])
    const p2 = batch.enqueue('create', 'Deal', [{ title: 'Acme' }])

    await batch.flush()

    await expect(p1).rejects.toThrow('batch failed')
    await expect(p2).rejects.toThrow('batch failed')
  })

  it('should report pending count correctly', () => {
    const batch = new BatchCollector(async () => [])

    expect(batch.pending).toBe(0)
    batch.enqueue('create', 'Contact', [{}])
    expect(batch.pending).toBe(1)
    batch.enqueue('get', 'Contact', ['id'])
    expect(batch.pending).toBe(2)
  })

  it('flush on empty queue should be a no-op', async () => {
    const executeBatch = vi.fn(async () => [])
    const batch = new BatchCollector(executeBatch)

    await batch.flush()
    expect(executeBatch).not.toHaveBeenCalled()
  })

  it('should support multiple sequential flushes', async () => {
    let callCount = 0
    const executeBatch = vi.fn(async (ops: unknown[]) => {
      callCount++
      return ops.map(() => `batch-${callCount}`)
    })

    const batch = new BatchCollector(executeBatch)

    // First batch
    const p1 = batch.enqueue('create', 'Contact', [{}])
    await batch.flush()
    expect(await p1).toBe('batch-1')

    // Second batch
    const p2 = batch.enqueue('create', 'Deal', [{}])
    await batch.flush()
    expect(await p2).toBe('batch-2')

    expect(executeBatch).toHaveBeenCalledTimes(2)
  })
})

// =============================================================================
// Noun Proxy Integration — PipelineableNounProvider
// =============================================================================

describe('Noun proxy with PipelineableNounProvider', () => {
  /**
   * A mock PipelineableNounProvider that returns RpcPromises.
   * Used to test that the Noun proxy correctly passes through pipelineable results.
   */
  class MockPipelineableProvider implements PipelineableNounProvider {
    readonly pipelineable = true as const
    private store = new Map<string, NounInstance>()
    private counter = 0

    getRpcProxy(): unknown {
      return {}
    }

    create(type: string, data: Record<string, unknown>): RpcPromise<NounInstance> {
      const instance: NounInstance = {
        $id: `${type.toLowerCase()}_${++this.counter}`,
        $type: type,
        $context: 'https://headless.ly/~test',
        $version: 1,
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        ...data,
      }
      this.store.set(instance.$id, instance)
      return createRpcPromise(Promise.resolve(instance))
    }

    get(type: string, id: string): RpcPromise<NounInstance | null> {
      const instance = this.store.get(id)
      if (!instance || instance.$type !== type) {
        return createRpcPromise(Promise.resolve(null))
      }
      return createRpcPromise(Promise.resolve(instance))
    }

    find(type: string, where?: Record<string, unknown>): RpcPromise<NounInstance[]> {
      const results: NounInstance[] = []
      for (const instance of this.store.values()) {
        if (instance.$type !== type) continue
        if (where) {
          let match = true
          for (const [key, value] of Object.entries(where)) {
            if (instance[key] !== value) {
              match = false
              break
            }
          }
          if (!match) continue
        }
        results.push(instance)
      }
      return createRpcPromise(Promise.resolve(results))
    }

    update(type: string, id: string, data: Record<string, unknown>): RpcPromise<NounInstance> {
      const existing = this.store.get(id)
      if (!existing || existing.$type !== type) {
        return createRpcPromise(Promise.reject(new Error(`${type} not found: ${id}`)))
      }
      const updated: NounInstance = {
        ...existing,
        ...data,
        $id: existing.$id,
        $type: existing.$type,
        $context: existing.$context,
        $version: existing.$version + 1,
        $createdAt: existing.$createdAt,
        $updatedAt: new Date().toISOString(),
      }
      this.store.set(id, updated)
      return createRpcPromise(Promise.resolve(updated))
    }

    delete(type: string, id: string): RpcPromise<boolean> {
      const existing = this.store.get(id)
      if (!existing || existing.$type !== type) {
        return createRpcPromise(Promise.resolve(false))
      }
      this.store.delete(id)
      return createRpcPromise(Promise.resolve(true))
    }

    perform(type: string, _verb: string, id: string, data?: Record<string, unknown>): RpcPromise<NounInstance> {
      if (data) {
        return this.update(type, id, data)
      }
      const existing = this.store.get(id)
      if (!existing || existing.$type !== type) {
        return createRpcPromise(Promise.reject(new Error(`${type} not found: ${id}`)))
      }
      return createRpcPromise(Promise.resolve(existing))
    }
  }

  let pipelineProvider: MockPipelineableProvider

  beforeEach(() => {
    clearRegistry()
    pipelineProvider = new MockPipelineableProvider()
    setProvider(pipelineProvider)
  })

  it('create should return a pipelineable result', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const result = createFn({ name: 'Alice', stage: 'Lead' })

    // The result should be pipelineable (has .pipe)
    expect(typeof result.pipe).toBe('function')
    expect(typeof result.then).toBe('function')

    // It should resolve correctly
    const instance = await result
    expect(instance.$type).toBe('Contact')
    expect(instance.name).toBe('Alice')
  })

  it('should support .pipe() from create result', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
    })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const id = await createFn({ name: 'Alice' }).pipe((c) => c.$id)

    expect(typeof id).toBe('string')
    expect(id).toMatch(/^contact_/)
  })

  it('should support property access pipelining from create result', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
    })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const result = createFn({ name: 'Alice' })

    // Property access on the RpcPromise should return a new RpcPromise
    const idPromise = (result as unknown as Record<string, RpcPromise<string>>).$id
    const id = await idPromise
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^contact_/)
  })

  it('should support chained .pipe() for dependent operations', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
    })

    // Reset registry to create a second Noun type
    const Deal = Noun('Deal', {
      title: 'string!',
      contactId: 'string',
    })

    const createContact = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const createDeal = Deal['create'] as (data: Record<string, unknown>) => Promise<NounInstance>

    // Pipeline: create contact, then use its $id to create a deal
    const deal = await createContact({ name: 'Alice' }).pipe(async (contact) => {
      return createDeal({ title: 'Acme', contactId: contact.$id })
    })

    expect(deal.$type).toBe('Deal')
    expect(deal.title).toBe('Acme')
    expect(typeof deal.contactId).toBe('string')
    expect((deal.contactId as string)).toMatch(/^contact_/)
  })

  it('get should return pipelineable result (fast path)', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    const created = await createFn({ name: 'Bob' })

    const getFn = Contact['get'] as (id: string) => RpcPromise<NounInstance | null>
    const result = getFn(created.$id)

    // Should be pipelineable
    expect(typeof result.pipe).toBe('function')

    const instance = await result
    expect(instance).not.toBeNull()
    expect(instance!.name).toBe('Bob')
  })

  it('find should return pipelineable result', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    await createFn({ name: 'Alice', stage: 'Lead' })
    await createFn({ name: 'Bob', stage: 'Qualified' })

    const findFn = Contact['find'] as (where?: Record<string, unknown>) => RpcPromise<NounInstance[]>
    const result = findFn({ stage: 'Lead' })

    expect(typeof result.pipe).toBe('function')

    const leads = await result
    expect(leads.length).toBe(1)
    expect(leads[0].name).toBe('Alice')
  })

  it('hooks should still work with pipelineable provider', async () => {
    const calls: string[] = []

    const Contact = Noun('Contact', { name: 'string!' })
    const creating = Contact['creating'] as (handler: (data: Record<string, unknown>) => void) => void
    const created = Contact['created'] as (handler: (instance: NounInstance) => void) => void

    creating(() => calls.push('before'))
    created((instance) => calls.push(`after:${instance.name}`))

    // With hooks registered, the proxy falls back to the sequential path
    const createFn = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    await createFn({ name: 'Alice' })

    expect(calls).toEqual(['before', 'after:Alice'])
  })

  it('custom verb should work with pipelineable provider (no hooks)', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
      qualify: 'Qualified',
    })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    const contact = await createFn({ name: 'Alice', stage: 'Lead' })

    const qualifyFn = Contact['qualify'] as (id: string) => RpcPromise<NounInstance>
    const result = qualifyFn(contact.$id)

    // With no hooks and pipelineable provider, should return RpcPromise
    expect(typeof result.pipe).toBe('function')

    const qualified = await result
    expect(qualified.stage).toBe('Qualified')
  })

  it('backward compat: MemoryNounProvider still works as before', async () => {
    // Switch back to a standard MemoryNounProvider
    setProvider(new MemoryNounProvider())

    const Contact = Noun('PlainContact', { name: 'string!' })

    const createFn = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    const result = await createFn({ name: 'Alice' })

    expect(result.$type).toBe('PlainContact')
    expect(result.name).toBe('Alice')

    // Regular Promise (not RpcPromise)
    const promise = createFn({ name: 'Bob' })
    expect(typeof (promise as unknown as Record<string, unknown>).pipe).toBe('undefined')
  })
})
