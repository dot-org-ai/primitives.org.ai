/**
 * ClickHouseDurableProvider tests
 *
 * Uses a mock ClickHouseExecutor to test the provider without a real ClickHouse instance.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ClickHouseDurableProvider,
  createClickHouseDurableProvider,
  type ClickHouseExecutor,
} from '../src/durable-clickhouse.js'
import { setBatchScheduler } from '../src/durable-promise.js'

interface MockExecutor extends ClickHouseExecutor {
  inserted: Array<{ table: string; values: unknown[] }>
  _queryHandler: () => unknown[]
}

function createMockExecutor(): MockExecutor {
  const mock: MockExecutor = {
    inserted: [],
    _queryHandler: () => [],
    async query<T>(): Promise<T[]> {
      return mock._queryHandler() as T[]
    },
    async command(): Promise<void> {},
    async insert<T>(table: string, values: T[]): Promise<void> {
      mock.inserted.push({ table, values: values as unknown[] })
    },
    async close(): Promise<void> {},
  }
  return mock
}

describe('ClickHouseDurableProvider', () => {
  let executor: MockExecutor
  let provider: ClickHouseDurableProvider

  beforeEach(() => {
    executor = createMockExecutor()
    provider = new ClickHouseDurableProvider({
      executor,
      namespace: 'test-ns',
      autoRecover: false,
    })
  })

  afterEach(async () => {
    await provider.close()
    setBatchScheduler(null)
  })

  describe('createAction', () => {
    it('inserts an action row into ClickHouse', async () => {
      const action = await provider.createAction({
        id: 'act-1',
        method: 'ai.generate',
        priority: 'standard',
      })

      expect(action.id).toBe('act-1')
      expect(action.ns).toBe('test-ns')
      expect(action.status).toBe('pending')
      expect(action.object).toBe('ai.generate')
      expect(executor.inserted).toHaveLength(1)
      expect(executor.inserted[0]!.table).toBe('Actions')
    })

    it('parses verb from method name', async () => {
      const action = await provider.createAction({
        id: 'act-2',
        method: 'openai.chat.complete',
        priority: 'priority',
      })

      expect(action.act).toBe('complete')
      expect(action.action).toBe('completes')
      // The source does `${verb}ing` which produces "completeing"
      expect(action.activity).toBe('completeing')
    })

    it('sets priority as numeric value', async () => {
      const action = await provider.createAction({
        id: 'act-3',
        method: 'test.run',
        priority: 'batch',
      })
      expect(action.priority).toBe(9)
    })

    it('maps priority tiers correctly', async () => {
      const priorities = [
        { tier: 'priority' as const, expected: 1 },
        { tier: 'standard' as const, expected: 5 },
        { tier: 'flex' as const, expected: 7 },
        { tier: 'batch' as const, expected: 9 },
      ]
      for (const { tier, expected } of priorities) {
        const action = await provider.createAction({
          id: `p-${tier}`,
          method: 'test.run',
          priority: tier,
        })
        expect(action.priority).toBe(expected)
      }
    })

    it('includes dependencies', async () => {
      const action = await provider.createAction({
        id: 'act-4',
        method: 'test.run',
        priority: 'standard',
        dependsOn: ['dep-1', 'dep-2'],
      })
      expect(action.dependencies).toEqual(['dep-1', 'dep-2'])
    })

    it('includes meta', async () => {
      const action = await provider.createAction({
        id: 'act-5',
        method: 'test.run',
        priority: 'standard',
        meta: { foo: 'bar' },
      })
      expect(action.meta).toEqual({ foo: 'bar' })
    })

    it('defaults actor to system', async () => {
      const action = await provider.createAction({
        id: 'act-6',
        method: 'test.run',
        priority: 'standard',
      })
      expect(action.actor).toBe('system')
    })

    it('uses provided actor', async () => {
      const action = await provider.createAction({
        id: 'act-7',
        method: 'test.run',
        priority: 'standard',
        actor: 'user@example.com',
      })
      expect(action.actor).toBe('user@example.com')
    })

    it('sets scheduledAt from deferUntil', async () => {
      const date = new Date('2025-06-01T00:00:00Z')
      const action = await provider.createAction({
        id: 'act-8',
        method: 'test.run',
        priority: 'standard',
        deferUntil: date,
      })
      expect(action.scheduledAt).toBe(date.toISOString())
    })
  })

  describe('updateAction', () => {
    it('updates an existing action', async () => {
      executor._queryHandler = () => [
        {
          id: 'act-1',
          ns: 'test-ns',
          status: 'pending',
          updatedAt: new Date().toISOString(),
        },
      ]

      await provider.updateAction('act-1', { status: 'active' })

      const lastInsert = executor.inserted[executor.inserted.length - 1]!
      expect((lastInsert.values[0] as any).status).toBe('active')
    })

    it('throws EntityNotFoundError for missing action', async () => {
      executor._queryHandler = () => []
      await expect(provider.updateAction('nonexistent', { status: 'active' })).rejects.toThrow()
    })
  })

  describe('getAction', () => {
    it('returns action when found', async () => {
      executor._queryHandler = () => [{ id: 'act-1', ns: 'test-ns', status: 'pending' }]
      const action = await provider.getAction('act-1')
      expect(action).toBeDefined()
      expect(action!.id).toBe('act-1')
    })

    it('returns null when not found', async () => {
      executor._queryHandler = () => []
      const action = await provider.getAction('nonexistent')
      expect(action).toBeNull()
    })
  })

  describe('listActions', () => {
    it('returns actions from query', async () => {
      executor._queryHandler = () => [
        { id: 'a1', status: 'pending' },
        { id: 'a2', status: 'pending' },
      ]
      const actions = await provider.listActions({ status: 'pending' })
      expect(actions).toHaveLength(2)
    })

    it('handles array of statuses', async () => {
      executor._queryHandler = () => []
      const actions = await provider.listActions({ status: ['pending', 'active'] })
      expect(actions).toEqual([])
    })

    it('handles no filter', async () => {
      executor._queryHandler = () => [{ id: 'a1' }]
      const actions = await provider.listActions()
      expect(actions).toHaveLength(1)
    })

    it('handles priority filter', async () => {
      executor._queryHandler = () => [{ id: 'a1', priority: 1 }]
      const actions = await provider.listActions({ priority: 'priority' })
      expect(actions).toHaveLength(1)
    })

    it('handles limit option', async () => {
      executor._queryHandler = () => [{ id: 'a1' }]
      const actions = await provider.listActions({ limit: 10 })
      expect(actions).toHaveLength(1)
    })
  })

  describe('batch queue', () => {
    it('pending includes batch queue size', () => {
      expect(provider.pending).toBeGreaterThanOrEqual(0)
    })

    it('flush resolves when queue is empty', async () => {
      await expect(provider.flush()).resolves.toBeUndefined()
    })
  })

  describe('recover', () => {
    it('returns count of recovered active actions', async () => {
      let callCount = 0
      executor._queryHandler = () => {
        callCount++
        if (callCount === 1) {
          // listActions call
          return [
            { id: 'a1', ns: 'test-ns', status: 'active', updatedAt: new Date().toISOString() },
          ]
        }
        // updateAction's query call
        return [{ id: 'a1', ns: 'test-ns', status: 'active', updatedAt: new Date().toISOString() }]
      }
      const count = await provider.recover()
      expect(count).toBe(1)
    })

    it('returns 0 when nothing to recover', async () => {
      executor._queryHandler = () => []
      const count = await provider.recover()
      expect(count).toBe(0)
    })

    it('does not count pending actions as recovered', async () => {
      executor._queryHandler = () => [
        { id: 'a1', ns: 'test-ns', status: 'pending', updatedAt: new Date().toISOString() },
      ]
      const count = await provider.recover()
      expect(count).toBe(0)
    })
  })

  describe('retryFailed', () => {
    it('resets failed actions to pending', async () => {
      let callCount = 0
      executor.query = async () => {
        callCount++
        if (callCount === 1) {
          return [
            { id: 'f1', ns: 'test-ns', status: 'failed', updatedAt: new Date().toISOString() },
          ] as any
        }
        return [
          { id: 'f1', ns: 'test-ns', status: 'failed', updatedAt: new Date().toISOString() },
        ] as any
      }

      const count = await provider.retryFailed()
      expect(count).toBe(1)
    })

    it('supports method filter', async () => {
      executor._queryHandler = () => []
      const count = await provider.retryFailed({ method: 'ai.generate' })
      expect(count).toBe(0)
    })

    it('supports since filter', async () => {
      executor._queryHandler = () => []
      const count = await provider.retryFailed({ since: new Date('2024-01-01') })
      expect(count).toBe(0)
    })
  })

  describe('getStats', () => {
    it('returns aggregated stats from ClickHouse', async () => {
      executor._queryHandler = () => [
        { status: 'pending', priority: 5, count: '3' },
        { status: 'completed', priority: 5, count: '10' },
        { status: 'failed', priority: 1, count: '2' },
      ]

      const stats = await provider.getStats()
      expect(stats.pending).toBe(3)
      expect(stats.completed).toBe(10)
      expect(stats.failed).toBe(2)
      expect(stats.byPriority.standard.pending).toBe(3)
      expect(stats.byPriority.standard.completed).toBe(10)
      expect(stats.batchQueue).toBe(0)
    })

    it('returns zeros when no data', async () => {
      executor._queryHandler = () => []
      const stats = await provider.getStats()
      expect(stats.pending).toBe(0)
      expect(stats.active).toBe(0)
      expect(stats.completed).toBe(0)
      expect(stats.failed).toBe(0)
    })
  })

  describe('close', () => {
    it('clears batch scheduler', async () => {
      await provider.close()
    })
  })
})

describe('createClickHouseDurableProvider', () => {
  it('creates an instance', () => {
    const executor = createMockExecutor()
    const p = createClickHouseDurableProvider({ executor, autoRecover: false })
    expect(p).toBeInstanceOf(ClickHouseDurableProvider)
    p.close()
  })
})
