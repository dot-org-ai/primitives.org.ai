/**
 * Tests for NounProvider pipelining extension
 *
 * Covers:
 * - RpcPromise interface (.pipe(), .then())
 * - PipelineableNounProvider detection
 * - Noun proxy fast-path when pipelineable + no hooks
 * - Noun proxy standard path when hooks are registered
 * - Backward compatibility with regular NounProvider (MemoryNounProvider)
 * - Scoped provider injection via Noun() options
 * - createScopedProvider factory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Noun } from '../src/noun.js'
import { clearRegistry } from '../src/noun-registry.js'
import {
  setProvider,
  getProvider,
  setProviderFactory,
  clearProviderFactory,
  createScopedProvider,
  MemoryNounProvider,
} from '../src/noun-proxy.js'
import type { NounProvider, PipelineableNounProvider, NounInstance, RpcPromise } from '../src/noun-types.js'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a minimal RpcPromise from a value (for testing)
 */
function rpcPromiseOf<T>(value: T): RpcPromise<T> {
  const p = Promise.resolve(value)
  return {
    then: (onfulfilled, onrejected) => p.then(onfulfilled, onrejected),
    pipe: (fn) => rpcPromiseOf(fn(value)),
  }
}

/**
 * Create a deferred RpcPromise for testing async behavior
 */
function deferredRpcPromise<T>(): {
  promise: RpcPromise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const p = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  const promise: RpcPromise<T> = {
    then: (onfulfilled, onrejected) => p.then(onfulfilled, onrejected),
    pipe: <U>(fn: (value: T) => U | PromiseLike<U>) => {
      const next = p.then(fn)
      const rpc: RpcPromise<U> = {
        then: (of, or) => next.then(of, or),
        pipe: (fn2) => {
          const result = next.then(fn2)
          return {
            then: (of2, or2) => result.then(of2, or2),
            pipe: () => {
              throw new Error('nested pipe not needed in tests')
            },
          } as RpcPromise<Awaited<ReturnType<typeof fn2>>>
        },
      }
      return rpc
    },
  }
  return { promise, resolve, reject }
}

/**
 * Mock PipelineableNounProvider that tracks calls and returns RpcPromise
 */
class MockPipelineableProvider implements PipelineableNounProvider {
  readonly pipelineable = true as const
  calls: Array<{ method: string; args: unknown[] }> = []

  private counter = 0

  private makeInstance(type: string, data?: Record<string, unknown>): NounInstance {
    this.counter++
    return {
      $id: `${type.toLowerCase()}_mock${this.counter}`,
      $type: type,
      $context: 'https://headless.ly/~test',
      $version: 1,
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      ...(data ?? {}),
    }
  }

  getRpcProxy(): unknown {
    return {}
  }

  create(type: string, data: Record<string, unknown>): RpcPromise<NounInstance> {
    this.calls.push({ method: 'create', args: [type, data] })
    return rpcPromiseOf(this.makeInstance(type, data))
  }

  get(type: string, id: string): RpcPromise<NounInstance | null> {
    this.calls.push({ method: 'get', args: [type, id] })
    return rpcPromiseOf(this.makeInstance(type, { $id: id }))
  }

  find(type: string, where?: Record<string, unknown>): RpcPromise<NounInstance[]> {
    this.calls.push({ method: 'find', args: [type, where] })
    return rpcPromiseOf([this.makeInstance(type)])
  }

  update(type: string, id: string, data: Record<string, unknown>): RpcPromise<NounInstance> {
    this.calls.push({ method: 'update', args: [type, id, data] })
    return rpcPromiseOf(this.makeInstance(type, { $id: id, ...data, $version: 2 }))
  }

  delete(type: string, id: string): RpcPromise<boolean> {
    this.calls.push({ method: 'delete', args: [type, id] })
    return rpcPromiseOf(true)
  }

  perform(type: string, verb: string, id: string, data?: Record<string, unknown>): RpcPromise<NounInstance> {
    this.calls.push({ method: 'perform', args: [type, verb, id, data] })
    return rpcPromiseOf(this.makeInstance(type, { $id: id, ...data }))
  }
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  clearRegistry()
  clearProviderFactory()
  setProvider(new MemoryNounProvider())
})

describe('RpcPromise', () => {
  it('should be awaitable via .then()', async () => {
    const rpc = rpcPromiseOf(42)
    const value = await rpc
    expect(value).toBe(42)
  })

  it('should support .pipe() for chaining transforms', async () => {
    const rpc = rpcPromiseOf(10)
    const doubled = rpc.pipe((v) => v * 2)
    const value = await doubled
    expect(value).toBe(20)
  })

  it('should support .pipe() → .pipe() chaining', async () => {
    const rpc = rpcPromiseOf('hello')
    const result = rpc.pipe((v) => v.toUpperCase()).pipe((v) => v + '!')
    const value = await result
    expect(value).toBe('HELLO!')
  })

  it('should work with Promise.all()', async () => {
    const a = rpcPromiseOf(1)
    const b = rpcPromiseOf(2)
    const c = rpcPromiseOf(3)

    const results = await Promise.all([a, b, c])
    expect(results).toEqual([1, 2, 3])
  })

  it('should handle deferred resolution', async () => {
    const { promise, resolve } = deferredRpcPromise<string>()

    const resultPromise = promise.then((v) => v.toUpperCase())
    resolve('test')

    const value = await resultPromise
    expect(value).toBe('TEST')
  })
})

describe('PipelineableNounProvider detection', () => {
  it('MemoryNounProvider should NOT be pipelineable', () => {
    const provider = new MemoryNounProvider()
    expect('pipelineable' in provider).toBe(false)
  })

  it('MockPipelineableProvider should be pipelineable', () => {
    const provider = new MockPipelineableProvider()
    expect(provider.pipelineable).toBe(true)
  })
})

describe('Noun proxy with PipelineableNounProvider', () => {
  let provider: MockPipelineableProvider

  beforeEach(() => {
    provider = new MockPipelineableProvider()
    setProvider(provider)
  })

  it('create should return RpcPromise without hooks (fast path)', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const result = create({ name: 'Alice', stage: 'Lead' })

    // Should be thenable (RpcPromise)
    expect(typeof result.then).toBe('function')

    // Should also support .pipe() since provider is pipelineable and no hooks
    // The result is the RpcPromise from the provider
    const instance = await result
    expect(instance.$type).toBe('Contact')
    expect(instance.name).toBe('Alice')

    // Provider should have been called once
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('create')
  })

  it('get should return provider result directly', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const get = Contact['get'] as (id: string) => RpcPromise<NounInstance | null>
    const result = await get('contact_abc')

    expect(result).not.toBeNull()
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('get')
  })

  it('find should return provider result directly', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const find = Contact['find'] as (where?: Record<string, unknown>) => RpcPromise<NounInstance[]>
    const result = await find({ stage: 'Lead' })

    expect(Array.isArray(result)).toBe(true)
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('find')
  })

  it('update should return RpcPromise without hooks (fast path)', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const update = Contact['update'] as (id: string, data: Record<string, unknown>) => RpcPromise<NounInstance>
    const result = await update('contact_abc', { name: 'Bob' })

    expect(result.name).toBe('Bob')
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('update')
  })

  it('delete should return RpcPromise without hooks (fast path)', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const del = Contact['delete'] as (id: string) => RpcPromise<boolean>
    const result = await del('contact_abc')

    expect(result).toBe(true)
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('delete')
  })

  it('custom verb should use fast path when no hooks', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
      qualify: 'Qualified',
    })

    const qualify = Contact['qualify'] as (id: string, data?: Record<string, unknown>) => RpcPromise<NounInstance>
    const result = await qualify('contact_abc')

    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('perform')
    expect(provider.calls[0].args[1]).toBe('qualify')
    expect(result.$type).toBe('Contact')
  })

  it('create should fall back to standard path when hooks are registered', async () => {
    const calls: string[] = []

    const Contact = Noun('Contact', { name: 'string!' })

    // Register a hook → should trigger the standard (non-pipelined) path
    const creating = Contact['creating'] as (handler: (data: Record<string, unknown>) => void) => () => void
    creating(() => {
      calls.push('before-create')
    })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    const result = await create({ name: 'Alice' })

    expect(calls).toEqual(['before-create'])
    expect(result.name).toBe('Alice')
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].method).toBe('create')
  })

  it('hooks should still fire with pipelineable provider when registered', async () => {
    const hookCalls: string[] = []

    const Contact = Noun('Contact', {
      name: 'string!',
      qualify: 'Qualified',
    })

    const qualifying = Contact['qualifying'] as (handler: (data: Record<string, unknown>) => void) => () => void
    const qualified = Contact['qualified'] as (handler: (instance: NounInstance) => void) => () => void

    qualifying(() => hookCalls.push('before-qualify'))
    qualified(() => hookCalls.push('after-qualify'))

    // First create (no create hooks) — should use fast path
    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const contact = await create({ name: 'Alice', stage: 'Lead' })

    // Qualify (has hooks) — should use standard path
    const qualify = Contact['qualify'] as (id: string) => Promise<NounInstance>
    await qualify(contact.$id)

    expect(hookCalls).toEqual(['before-qualify', 'after-qualify'])
    // create + get (for entity state in standard path) + perform
    expect(provider.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('multiple concurrent operations should not force sequential resolution', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>

    // Fire multiple creates without awaiting — these should all dispatch immediately
    const p1 = create({ name: 'Alice' })
    const p2 = create({ name: 'Bob' })
    const p3 = create({ name: 'Carol' })

    // All 3 calls should have been dispatched already
    expect(provider.calls).toHaveLength(3)

    // Now resolve them all
    const [r1, r2, r3] = await Promise.all([p1, p2, p3])
    expect(r1.name).toBe('Alice')
    expect(r2.name).toBe('Bob')
    expect(r3.name).toBe('Carol')
  })
})

describe('backward compatibility with regular NounProvider', () => {
  it('MemoryNounProvider should still work with all CRUD ops', async () => {
    setProvider(new MemoryNounProvider())

    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    const get = Contact['get'] as (id: string) => Promise<NounInstance | null>
    const find = Contact['find'] as (where?: Record<string, unknown>) => Promise<NounInstance[]>
    const update = Contact['update'] as (id: string, data: Record<string, unknown>) => Promise<NounInstance>
    const del = Contact['delete'] as (id: string) => Promise<boolean>

    const alice = await create({ name: 'Alice', stage: 'Lead' })
    expect(alice.$id).toMatch(/^contact_/)
    expect(alice.name).toBe('Alice')

    const fetched = await get(alice.$id)
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('Alice')

    const leads = await find({ stage: 'Lead' })
    expect(leads.length).toBe(1)

    const updated = await update(alice.$id, { stage: 'Qualified' })
    expect(updated.stage).toBe('Qualified')
    expect(updated.$version).toBe(2)

    const deleted = await del(alice.$id)
    expect(deleted).toBe(true)

    const gone = await get(alice.$id)
    expect(gone).toBeNull()
  })

  it('hooks should work with regular NounProvider', async () => {
    setProvider(new MemoryNounProvider())
    const calls: string[] = []

    const Contact = Noun('Contact', { name: 'string!' })
    const creating = Contact['creating'] as (handler: (data: Record<string, unknown>) => void) => () => void
    const created = Contact['created'] as (handler: (instance: NounInstance) => void) => () => void

    creating(() => calls.push('before'))
    created(() => calls.push('after'))

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<NounInstance>
    await create({ name: 'Alice' })

    expect(calls).toEqual(['before', 'after'])
  })
})

describe('scoped provider via Noun options', () => {
  it('should use the scoped provider instead of global', async () => {
    const globalProvider = new MemoryNounProvider()
    const scopedProvider = new MockPipelineableProvider()

    setProvider(globalProvider)

    const Contact = Noun('Contact', { name: 'string!' }, { provider: scopedProvider })

    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    await create({ name: 'Alice' })

    // Scoped provider should have been called
    expect(scopedProvider.calls).toHaveLength(1)
    expect(scopedProvider.calls[0].method).toBe('create')
  })

  it('different Nouns can use different providers', async () => {
    const providerA = new MockPipelineableProvider()
    const providerB = new MockPipelineableProvider()

    const Contact = Noun('Contact', { name: 'string!' }, { provider: providerA })
    const Deal = Noun('Deal', { title: 'string!', value: 'number' }, { provider: providerB })

    const createContact = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    const createDeal = Deal['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>

    await createContact({ name: 'Alice' })
    await createDeal({ title: 'Big Deal', value: 100000 })

    expect(providerA.calls).toHaveLength(1)
    expect(providerA.calls[0].args[0]).toBe('Contact')
    expect(providerB.calls).toHaveLength(1)
    expect(providerB.calls[0].args[0]).toBe('Deal')
  })
})

describe('createScopedProvider', () => {
  it('should create providers scoped by tenant URL', () => {
    const providers = new Map<string, MemoryNounProvider>()

    const factory = createScopedProvider((url) => {
      const provider = new MemoryNounProvider()
      providers.set(url, provider)
      return provider
    })

    const p1 = factory('https://headless.ly/~acme')
    const p2 = factory('https://headless.ly/~beta')
    const p3 = factory('https://headless.ly/~acme') // should reuse cached

    expect(providers.size).toBe(2) // only 2 unique URLs
    expect(p1).toBe(p3) // same instance for same URL
    expect(p1).not.toBe(p2)
  })

  it('should work with setProviderFactory for global scoping', async () => {
    const factoryProvider = new MockPipelineableProvider()

    setProviderFactory(() => factoryProvider)

    const Contact = Noun('Contact', { name: 'string!' })
    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    await create({ name: 'Alice' })

    expect(factoryProvider.calls).toHaveLength(1)
    expect(factoryProvider.calls[0].method).toBe('create')

    clearProviderFactory()
  })

  it('scoped provider should take priority over provider factory', async () => {
    const factoryProvider = new MockPipelineableProvider()
    const scopedProvider = new MockPipelineableProvider()

    setProviderFactory(() => factoryProvider)

    const Contact = Noun('Contact', { name: 'string!' }, { provider: scopedProvider })
    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>
    await create({ name: 'Alice' })

    // Scoped provider wins
    expect(scopedProvider.calls).toHaveLength(1)
    expect(factoryProvider.calls).toHaveLength(0)

    clearProviderFactory()
  })
})

describe('RpcPromise .pipe() with Noun proxy', () => {
  it('should support .pipe() on pipelineable create result', async () => {
    const provider = new MockPipelineableProvider()
    setProvider(provider)

    const Contact = Noun('Contact', { name: 'string!' })
    const create = Contact['create'] as (data: Record<string, unknown>) => RpcPromise<NounInstance>

    // Use .pipe() to transform the result without forcing await
    const idPromise = create({ name: 'Alice' }).pipe((instance) => instance.$id)
    const id = await idPromise

    expect(typeof id).toBe('string')
    expect(id).toMatch(/^contact_/)
  })

  it('should support .pipe() on pipelineable find result', async () => {
    const provider = new MockPipelineableProvider()
    setProvider(provider)

    const Contact = Noun('Contact', { name: 'string!' })
    const find = Contact['find'] as (where?: Record<string, unknown>) => RpcPromise<NounInstance[]>

    const countPromise = find().pipe((results) => results.length)
    const count = await countPromise

    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
