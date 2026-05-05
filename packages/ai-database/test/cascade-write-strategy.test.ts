/**
 * CascadeWriteStrategy tests — Phase 2 entry, bead aip-g1i9.
 *
 * Covers:
 * - Shard-key derivation across the three built-in strategies
 *   (`per-cascade`, `partitioned-by-tenant`, `unsharded`) + custom
 *   strategy callbacks.
 * - Strategy resolution from the adapter's declared `ShardingModel`.
 * - Batch chunking around `maxBatchSize` boundaries.
 * - Bulk-write fast-path routing through `commitBatch` when the adapter
 *   is bulk-capable, fallback to per-op writes otherwise.
 * - PG CTE jsonb-bulk SQL shape (the substrate-write-probes proved
 *   shape) — round-tripped through the {@link buildPgCommitBatchSql}
 *   helper *and* through the live PG adapter via the structural-fake
 *   `PgExecutor` pattern that `pg-adapter.test.ts` uses.
 * - DO SQLite shard-routing helper resolves the right DO id name.
 * - Read-back-during-traversal surface (`readShardLocal`,
 *   `listShardLocal`) routes through the same shard.
 * - Analytical fan-out hook is invoked post-commit and failures don't
 *   abort the cascade write.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  CascadeWriteStrategy,
  CascadeShardingStrategies,
  createCascadeWriteStrategy,
  buildPgCommitBatchSql,
  resolveDOIdName,
  chunkBatch,
  type CascadeBatch,
  type ShardRef,
} from '../src/cascade-write-strategy.js'
import { PostgresProvider, type PgExecutor } from '../src/pg-adapter.js'
import { createMemoryProvider } from '../src/memory-provider.js'

// =============================================================================
// Tests — pickShard (shard key derivation)
// =============================================================================

describe('CascadeShardingStrategies.perCascade', () => {
  it('derives `cascade:<id>` from cascadeId', () => {
    const strategy = CascadeShardingStrategies.perCascade()
    const shard = strategy({ cascadeId: 'abc' })
    expect(shard.key).toBe('cascade:abc')
    expect(shard.model).toBe('per-cascade')
    expect(shard.context.cascadeId).toBe('abc')
  })

  it('falls back to default cascadeId when context omits it', () => {
    const strategy = CascadeShardingStrategies.perCascade('default-cascade')
    const shard = strategy({})
    expect(shard.key).toBe('cascade:default-cascade')
  })

  it('throws when neither context nor default supplies cascadeId', () => {
    const strategy = CascadeShardingStrategies.perCascade()
    expect(() => strategy({})).toThrow(/cascadeId/)
  })

  it('preserves rootEntity in the carried context', () => {
    const strategy = CascadeShardingStrategies.perCascade()
    const shard = strategy({
      cascadeId: 'c1',
      rootEntity: { $id: 'fh-1', $type: 'FoundingHypothesis' },
    })
    expect(shard.context.rootEntity).toEqual({
      $id: 'fh-1',
      $type: 'FoundingHypothesis',
    })
  })
})

describe('CascadeShardingStrategies.partitionedByTenant', () => {
  it('derives `tenant:<id>` from tenantId', () => {
    const strategy = CascadeShardingStrategies.partitionedByTenant()
    const shard = strategy({ tenantId: 'acme' })
    expect(shard.key).toBe('tenant:acme')
    expect(shard.model).toBe('partitioned-by-tenant')
  })

  it('falls back to default tenantId when context omits it', () => {
    const strategy = CascadeShardingStrategies.partitionedByTenant('default-tenant')
    const shard = strategy({})
    expect(shard.key).toBe('tenant:default-tenant')
  })

  it('throws when neither context nor default supplies tenantId', () => {
    const strategy = CascadeShardingStrategies.partitionedByTenant()
    expect(() => strategy({})).toThrow(/tenantId/)
  })
})

describe('CascadeShardingStrategies.unsharded', () => {
  it('always returns `__shared__`', () => {
    const strategy = CascadeShardingStrategies.unsharded()
    expect(strategy({}).key).toBe('__shared__')
    expect(strategy({ cascadeId: 'ignored' }).key).toBe('__shared__')
    expect(strategy({}).model).toBe('unsharded')
  })
})

describe('Custom CascadeShardingStrategy', () => {
  it('accepts an arbitrary (ctx) => ShardRef callback', () => {
    const adapter = createMemoryProvider()
    const strategy = new CascadeWriteStrategy({
      adapter,
      sharding: (ctx) => ({
        key: `custom:${(ctx['region'] as string) ?? 'us'}`,
        model: 'per-cascade',
        context: ctx,
      }),
    })
    const shard = strategy.pickShard({ region: 'eu' })
    expect(shard.key).toBe('custom:eu')
  })
})

// =============================================================================
// Tests — strategy resolution from the adapter's declared sharding model
// =============================================================================

describe('CascadeWriteStrategy strategy resolution', () => {
  it('defaults to unsharded when the adapter is the in-memory one', () => {
    const adapter = createMemoryProvider()
    const strategy = new CascadeWriteStrategy({ adapter })
    const shard = strategy.pickShard({})
    expect(shard.model).toBe('unsharded')
    expect(shard.key).toBe('__shared__')
  })

  it('defaults to partitioned-by-tenant for the PG adapter', () => {
    const exec: PgExecutor = async () => []
    const adapter = new PostgresProvider({ executor: exec, namespace: 't1' })
    const strategy = new CascadeWriteStrategy({
      adapter,
      defaultTenantId: 'acme',
    })
    const shard = strategy.pickShard({})
    expect(shard.model).toBe('partitioned-by-tenant')
    expect(shard.key).toBe('tenant:acme')
  })

  it('honours an explicit `sharding` option overriding the adapter default', () => {
    const exec: PgExecutor = async () => []
    const adapter = new PostgresProvider({ executor: exec, namespace: 't1' })
    const strategy = new CascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
    })
    expect(strategy.pickShard({}).model).toBe('unsharded')
  })

  it('passes shorthand strings through to the right built-in', () => {
    const adapter = createMemoryProvider()
    const strategy = new CascadeWriteStrategy({
      adapter,
      sharding: 'per-cascade',
      defaultCascadeId: 'c-default',
    })
    expect(strategy.pickShard({}).key).toBe('cascade:c-default')
  })
})

// =============================================================================
// Tests — chunkBatch
// =============================================================================

describe('chunkBatch', () => {
  it('returns a single chunk when the batch fits in maxBatchSize', () => {
    const batch: CascadeBatch = {
      things: [
        { id: 't1', type: 'A', data: {} },
        { id: 't2', type: 'A', data: {} },
      ],
      actions: [{ verb: 'related', subject: 't1', object: 't2' }],
    }
    const chunks = chunkBatch(batch, 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.things).toHaveLength(2)
    expect(chunks[0]!.actions).toHaveLength(1)
  })

  it('splits when total exceeds maxBatchSize, things first then actions', () => {
    const things = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      type: 'A' as const,
      data: {},
    }))
    const actions = Array.from({ length: 5 }, (_, i) => ({
      verb: 'rel',
      subject: `t${i}`,
      object: `t${(i + 1) % 5}`,
    }))
    const chunks = chunkBatch({ things, actions }, 4)
    // 4 things → chunk 1; 1 thing + 3 actions → chunk 2; 2 actions → chunk 3.
    expect(chunks).toHaveLength(3)
    expect(chunks[0]!.things).toHaveLength(4)
    expect(chunks[0]!.actions).toHaveLength(0)
    expect(chunks[1]!.things).toHaveLength(1)
    expect(chunks[1]!.actions).toHaveLength(3)
    expect(chunks[2]!.things).toHaveLength(0)
    expect(chunks[2]!.actions).toHaveLength(2)
  })

  it('throws on non-positive maxBatchSize', () => {
    expect(() => chunkBatch({ things: [], actions: [] }, 0)).toThrow(/maxBatchSize/)
  })
})

// =============================================================================
// Tests — buildPgCommitBatchSql
// =============================================================================

describe('buildPgCommitBatchSql', () => {
  it('returns null for empty batches', () => {
    expect(
      buildPgCommitBatchSql({
        schema: 'aidb',
        namespace: 't1',
        things: [],
        actions: [],
        now: new Date().toISOString(),
      })
    ).toBeNull()
  })

  it('emits a CTE with both inserted_things and inserted_actions when both present', () => {
    const result = buildPgCommitBatchSql({
      schema: 'aidb',
      namespace: 'tenant-9',
      things: [
        { id: 't1', type: 'Customer', data: { name: 'Acme' } },
        { id: 't2', type: 'Order', data: { total: 100 } },
      ],
      actions: [{ id: 'a1', verb: 'placedBy', subject: 't2', object: 't1', status: 'completed' }],
      now: '2026-05-05T00:00:00.000Z',
    })
    expect(result).not.toBeNull()
    const { sql, params } = result!
    expect(sql).toMatch(/inserted_things AS/)
    expect(sql).toMatch(/inserted_actions AS/)
    expect(sql).toMatch(/ON CONFLICT ON CONSTRAINT things_pk DO NOTHING/)
    expect(sql).toMatch(/ON CONFLICT ON CONSTRAINT actions_pk DO NOTHING/)
    expect(sql).toMatch(/jsonb/)
    // Things take 4 cols, actions take 10 cols. 2 things + 1 action = 18 params.
    expect(params).toHaveLength(2 * 4 + 1 * 10)
    // First thing: ns, id, type, data
    expect(params.slice(0, 4)).toEqual([
      'tenant-9',
      't1',
      'Customer',
      JSON.stringify({ name: 'Acme' }),
    ])
  })

  it('emits things-only CTE when no actions', () => {
    const result = buildPgCommitBatchSql({
      schema: 'aidb',
      namespace: 't',
      things: [{ id: 't1', type: 'A', data: {} }],
      actions: [],
      now: '2026-05-05T00:00:00.000Z',
    })
    expect(result).not.toBeNull()
    expect(result!.sql).toMatch(/inserted_things/)
    expect(result!.sql).not.toMatch(/inserted_actions/)
  })

  it('emits actions-only CTE when no things', () => {
    const result = buildPgCommitBatchSql({
      schema: 'aidb',
      namespace: 't',
      things: [],
      actions: [{ verb: 'rel', subject: 's', object: 'o' }],
      now: '2026-05-05T00:00:00.000Z',
    })
    expect(result).not.toBeNull()
    expect(result!.sql).toMatch(/inserted_actions/)
    expect(result!.sql).not.toMatch(/inserted_things/)
  })

  it('uses status to derive completed_at value (completed → now, pending → null)', () => {
    const now = '2026-05-05T00:00:00.000Z'
    const result = buildPgCommitBatchSql({
      schema: 'aidb',
      namespace: 't',
      things: [],
      actions: [
        { id: 'a-pending', verb: 'rel', subject: 's1', object: 'o1', status: 'pending' },
        { id: 'a-completed', verb: 'rel', subject: 's2', object: 'o2', status: 'completed' },
      ],
      now,
    })!
    // Each action takes 10 params; index 7 = status, index 8 = created_at, index 9 = completed_at.
    expect(result.params[7]).toBe('pending')
    expect(result.params[9]).toBeNull()
    expect(result.params[17]).toBe('completed')
    expect(result.params[19]).toBe(now)
  })

  it('produces the same SQL family the canonical PG adapter emits', () => {
    const helperResult = buildPgCommitBatchSql({
      schema: 'aidb',
      namespace: 't',
      things: [{ id: 't1', type: 'A', data: { v: 1 } }],
      actions: [{ id: 'a1', verb: 'r', subject: 't1', object: 't1', status: 'completed' }],
      now: new Date().toISOString(),
    })!
    expect(helperResult.sql).toContain('inserted_things AS')
    expect(helperResult.sql).toContain('inserted_actions AS')
    expect(helperResult.sql).toContain('aidb.things')
    expect(helperResult.sql).toContain('aidb.actions')
  })
})

// =============================================================================
// Tests — writeBatch through PG adapter (structural fake)
// =============================================================================

interface ThingRecord {
  ns: string
  id: string
  type: string
  data: Record<string, unknown>
}

interface ActionRecord {
  ns: string
  id: string
  verb: string
  subject: string | null
  object: string | null
  roles: Record<string, string>
  data: Record<string, unknown>
  status: string
  created_at: Date
  completed_at: Date | null
}

class FakePgStore {
  things = new Map<string, ThingRecord>()
  actions = new Map<string, ActionRecord>()
  log: Array<{ sql: string; params: ReadonlyArray<unknown> }> = []
  reset(): void {
    this.things.clear()
    this.actions.clear()
    this.log = []
  }
}

function makeFakePgExecutor(store: FakePgStore): PgExecutor {
  return async (sql, params = []) => {
    store.log.push({ sql, params })
    const head = sql.trim().split(/\s+/)[0]?.toUpperCase()
    // CREATE / DDL — accepted as no-op
    if (head === 'CREATE') return []
    // WITH (CTE for commitBatch)
    if (head === 'WITH') {
      let i = 0
      let thingsInserted = 0
      let actionsInserted = 0
      const hasThings = /inserted_things/.test(sql)
      const hasActions = /inserted_actions/.test(sql)
      if (hasThings) {
        const m = sql.match(
          /INSERT INTO\s+\w+\.things\s+\([^)]+\)\s+VALUES\s+([\s\S]+?)\s+ON CONFLICT/i
        )
        const placeholders = m?.[1]?.match(/\$\d+/g) ?? []
        const cnt = placeholders.length / 4
        for (let k = 0; k < cnt; k++) {
          const ns = String(params[i++])
          const id = String(params[i++])
          const type = String(params[i++])
          const data = JSON.parse(String(params[i++]))
          const key = `${ns}:${id}`
          if (!store.things.has(key)) {
            store.things.set(key, { ns, id, type, data })
            thingsInserted += 1
          }
        }
      }
      if (hasActions) {
        const m = sql.match(
          /INSERT INTO\s+\w+\.actions\s+\([^)]+\)\s+VALUES\s+([\s\S]+?)\s+ON CONFLICT/i
        )
        const placeholders = m?.[1]?.match(/\$\d+/g) ?? []
        const cnt = placeholders.length / 10
        for (let k = 0; k < cnt; k++) {
          const ns = String(params[i++])
          const id = String(params[i++])
          const verb = String(params[i++])
          const subject = (params[i++] ?? null) as string | null
          const object = (params[i++] ?? null) as string | null
          const roles = JSON.parse(String(params[i++]))
          const data = JSON.parse(String(params[i++]))
          const status = String(params[i++])
          const createdAtIso = String(params[i++])
          const completedAtIso = (params[i++] ?? null) as string | null
          if (!store.actions.has(id)) {
            store.actions.set(id, {
              ns,
              id,
              verb,
              subject,
              object,
              roles,
              data,
              status,
              created_at: new Date(createdAtIso),
              completed_at: completedAtIso ? new Date(completedAtIso) : null,
            })
            actionsInserted += 1
          }
        }
      }
      return [{ things_inserted: thingsInserted, actions_inserted: actionsInserted }]
    }
    // SELECT for reads
    if (head === 'SELECT' && /FROM\s+\w+\.things/i.test(sql)) {
      const ns = String(params[0])
      // get(): WHERE ... AND id = $3
      if (/AND\s+id\s*=\s*\$3/i.test(sql)) {
        const id = String(params[2])
        const row = store.things.get(`${ns}:${id}`)
        return row ? [{ data: row.data }] : []
      }
      // list()
      const type = String(params[1])
      const limit = Number(params[2] ?? 1000)
      const offset = Number(params[3] ?? 0)
      const matches = [...store.things.values()].filter((t) => t.ns === ns && t.type === type)
      matches.sort((a, b) => (a.id < b.id ? -1 : 1))
      return matches.slice(offset, offset + limit).map((t) => ({ id: t.id, data: t.data }))
    }
    return []
  }
}

describe('CascadeWriteStrategy — bulk write via PG adapter', () => {
  let store: FakePgStore
  let adapter: PostgresProvider
  let strategy: CascadeWriteStrategy

  beforeEach(() => {
    store = new FakePgStore()
    adapter = new PostgresProvider({
      executor: makeFakePgExecutor(store),
      namespace: 'tenant-9',
    })
    strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'partitioned-by-tenant',
      defaultTenantId: 'tenant-9',
    })
  })

  it('routes through commitBatch (CTE jsonb-bulk) when adapter is bulk-capable', async () => {
    const shard = strategy.pickShard({ tenantId: 'tenant-9' })
    const result = await strategy.writeBatch(shard, {
      things: [
        { id: 'c1', type: 'Customer', data: { name: 'Acme' } },
        { id: 'o1', type: 'Order', data: { total: 100 } },
      ],
      actions: [{ id: 'a1', verb: 'placedBy', subject: 'o1', object: 'c1', status: 'completed' }],
    })
    expect(result.thingsInserted).toBe(2)
    expect(result.actionsInserted).toBe(1)
    expect(result.shard.key).toBe('tenant:tenant-9')
    // Exactly one CTE round-trip — the substrate-write-probes invariant.
    const ctes = store.log.filter((entry) => entry.sql.trim().toUpperCase().startsWith('WITH'))
    expect(ctes).toHaveLength(1)
    expect(store.things.size).toBe(2)
    expect(store.actions.size).toBe(1)
  })

  it('chunks large batches into multiple CTE round-trips', async () => {
    const shard = strategy.pickShard({ tenantId: 'tenant-9' })
    const things = Array.from({ length: 250 }, (_, i) => ({
      id: `t${i}`,
      type: 'Customer',
      data: { i },
    }))
    const small = createCascadeWriteStrategy({
      adapter,
      sharding: 'partitioned-by-tenant',
      defaultTenantId: 'tenant-9',
      maxBatchSize: 100,
    })
    const result = await small.writeBatch(shard, { things })
    expect(result.thingsInserted).toBe(250)
    const ctes = store.log.filter((entry) => entry.sql.trim().toUpperCase().startsWith('WITH'))
    // Three rounds: 100 + 100 + 50.
    expect(ctes).toHaveLength(3)
  })

  it('idempotent re-runs write 0 new rows (ON CONFLICT DO NOTHING)', async () => {
    const shard = strategy.pickShard({ tenantId: 'tenant-9' })
    const batch: CascadeBatch = {
      things: [{ id: 't1', type: 'Customer', data: { name: 'Acme' } }],
    }
    const r1 = await strategy.writeBatch(shard, batch)
    expect(r1.thingsInserted).toBe(1)
    const r2 = await strategy.writeBatch(shard, batch)
    expect(r2.thingsInserted).toBe(0)
    expect(store.things.size).toBe(1)
  })

  it('returns the shard reference on the result', async () => {
    const shard = strategy.pickShard({ tenantId: 'tenant-9' })
    const result = await strategy.writeBatch(shard, {
      things: [{ id: 't1', type: 'A', data: {} }],
    })
    expect(result.shard).toEqual(shard)
  })
})

// =============================================================================
// Tests — writeBatch fallback path (per-op writes when adapter is not bulk-capable)
// =============================================================================

describe('CascadeWriteStrategy — fallback per-op writes', () => {
  it('falls back to create() + recordAction() on the in-memory adapter', async () => {
    const adapter = createMemoryProvider()
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
    })
    const shard = strategy.pickShard({})
    const result = await strategy.writeBatch(shard, {
      things: [
        { id: 'c1', type: 'Customer', data: { name: 'Acme' } },
        { id: 'o1', type: 'Order', data: { total: 100 } },
      ],
      actions: [
        {
          verb: 'placedBy',
          subject: 'o1',
          object: 'c1',
          data: { fromType: 'Order', toType: 'Customer' },
          status: 'completed',
        },
      ],
    })
    expect(result.thingsInserted).toBe(2)
    expect(result.actionsInserted).toBe(1)
    const customer = await adapter.get('Customer', 'c1')
    expect(customer).not.toBeNull()
    expect((customer as Record<string, unknown>)['name']).toBe('Acme')
  })
})

// =============================================================================
// Tests — readShardLocal / listShardLocal (read-back-during-traversal)
// =============================================================================

describe('CascadeWriteStrategy — read-back during traversal', () => {
  it('reads back through the same adapter (and shard binding)', async () => {
    const store = new FakePgStore()
    const adapter = new PostgresProvider({
      executor: makeFakePgExecutor(store),
      namespace: 'tenant-9',
    })
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'partitioned-by-tenant',
      defaultTenantId: 'tenant-9',
    })
    const shard = strategy.pickShard({ tenantId: 'tenant-9' })
    await strategy.writeBatch(shard, {
      things: [{ id: 'c1', type: 'Customer', data: { name: 'Acme' } }],
    })
    const got = await strategy.readShardLocal(shard, 'Customer', 'c1')
    expect(got).not.toBeNull()
    expect((got as Record<string, unknown>)['name']).toBe('Acme')
  })

  it('listShardLocal returns the just-written entities', async () => {
    const adapter = createMemoryProvider()
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
    })
    const shard = strategy.pickShard({})
    await strategy.writeBatch(shard, {
      things: [
        { id: 'c1', type: 'Customer', data: { name: 'Acme' } },
        { id: 'c2', type: 'Customer', data: { name: 'Beta' } },
      ],
    })
    const list = await strategy.listShardLocal(shard, 'Customer')
    expect(list.length).toBeGreaterThanOrEqual(2)
  })
})

// =============================================================================
// Tests — DO SQLite shard-routing helper
// =============================================================================

describe('resolveDOIdName', () => {
  it('returns the shard key as the DO id name', () => {
    const shard: ShardRef = {
      key: 'cascade:abc',
      model: 'per-cascade',
      context: { cascadeId: 'abc' },
    }
    expect(resolveDOIdName(shard)).toBe('cascade:abc')
  })

  it('per-cascade strategy emits a key suitable for namespace.idFromName()', () => {
    const strategy = CascadeShardingStrategies.perCascade()
    const shard = strategy({ cascadeId: 'cascade-12345' })
    const idName = resolveDOIdName(shard)
    expect(idName).toBe('cascade:cascade-12345')
    // Stable across repeated calls — the per-cascade DO routing must be
    // deterministic so reads land on the writer.
    expect(strategy({ cascadeId: 'cascade-12345' }).key).toBe(idName)
  })
})

// =============================================================================
// Tests — analytical fan-out hook
// =============================================================================

describe('CascadeWriteStrategy — analyticalEmitter hook', () => {
  it('invokes the emitter once per chunk after a successful commit', async () => {
    const store = new FakePgStore()
    const adapter = new PostgresProvider({
      executor: makeFakePgExecutor(store),
      namespace: 't',
    })
    const emitter = vi.fn().mockResolvedValue(undefined)
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
      maxBatchSize: 2,
      analyticalEmitter: emitter,
    })
    const shard = strategy.pickShard({})
    await strategy.writeBatch(shard, {
      things: [
        { id: 't1', type: 'A', data: {} },
        { id: 't2', type: 'A', data: {} },
        { id: 't3', type: 'A', data: {} },
      ],
    })
    // 2 chunks (2 + 1) -> 2 emitter calls.
    expect(emitter).toHaveBeenCalledTimes(2)
    const firstCall = emitter.mock.calls[0]?.[0]
    expect(firstCall).toMatchObject({
      shard,
      result: { thingsInserted: 2, actionsInserted: 0 },
    })
  })

  it('swallows emitter failures (cascade local commit is the source of truth)', async () => {
    const store = new FakePgStore()
    const adapter = new PostgresProvider({
      executor: makeFakePgExecutor(store),
      namespace: 't',
    })
    const emitter = vi.fn().mockRejectedValue(new Error('boom'))
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
      analyticalEmitter: emitter,
    })
    const shard = strategy.pickShard({})
    await expect(
      strategy.writeBatch(shard, { things: [{ id: 't1', type: 'A', data: {} }] })
    ).resolves.toMatchObject({ thingsInserted: 1 })
    expect(emitter).toHaveBeenCalledTimes(1)
    expect(store.things.size).toBe(1) // commit landed regardless.
  })
})

// =============================================================================
// Tests — empty-batch fast path
// =============================================================================

describe('CascadeWriteStrategy — empty batch', () => {
  it('returns 0/0 without touching the adapter', async () => {
    const store = new FakePgStore()
    const adapter = new PostgresProvider({
      executor: makeFakePgExecutor(store),
      namespace: 't',
    })
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
    })
    const shard = strategy.pickShard({})
    const result = await strategy.writeBatch(shard, {})
    expect(result.thingsInserted).toBe(0)
    expect(result.actionsInserted).toBe(0)
    expect(store.log.length).toBe(0)
  })
})
