/**
 * PostgresProvider adapter tests
 *
 * Adapter-logic tests against a fake `PgExecutor` that interprets the
 * SQL the adapter emits — no real Postgres process involved. The fake
 * captures the parameter shape (positional `$1`/`$2`/...) and the SQL
 * statement family (INSERT into `things`, JOIN on `actions`, etc.) and
 * answers from in-memory tables.
 *
 * These tests cover:
 * - Capability declaration (Tier 3 with caveats, Tier 4 pgvector, sharding)
 * - CRUD round-trip
 * - Tier 2 graph (`relate`/`related`/`unrelate`)
 * - SVO `recordAction`/`queryActions` with role / time / status filters
 * - Verb registry round-trip
 * - `commitBatch` cascade write path (CTE jsonb-bulk shape)
 *
 * Integration tests against PGLite or a real Postgres are out of scope
 * for this adapter-logic suite.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  PostgresProvider,
  createPostgresProvider,
  createNeonHttpExecutor,
  createPgClientExecutor,
  type PgExecutor,
} from '../src/pg-adapter.js'
import {
  getProviderCapabilities,
  hasActionRecording,
  hasVerbRegistry,
  hasVectorSearch,
  hasAnalytics,
} from '../src/db-provider-port.js'

// =============================================================================
// Fake PgExecutor — interprets the SQL family the adapter emits
// =============================================================================

interface ThingRow {
  ns: string
  id: string
  type: string
  data: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

interface ActionRow {
  ns: string
  id: string
  verb: string
  subject: string | null
  object: string | null
  roles: Record<string, string>
  data: Record<string, unknown>
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  created_at: Date
  completed_at: Date | null
}

interface VerbRow {
  name: string
  data: Record<string, unknown>
  created_at: Date
}

class FakeStore {
  things = new Map<string, ThingRow>() // key = `${ns}:${id}`
  actions = new Map<string, ActionRow>()
  verbs = new Map<string, VerbRow>()
  /** SQL statements seen by the executor for assertions. */
  log: Array<{ sql: string; params: ReadonlyArray<unknown> }> = []

  thingKey(ns: string, id: string): string {
    return `${ns}:${id}`
  }

  reset(): void {
    this.things.clear()
    this.actions.clear()
    this.verbs.clear()
    this.log = []
  }
}

/**
 * Build a fake executor backed by an in-memory `FakeStore`. We pattern
 * match the SQL family by leading keyword + table mention; that's enough
 * to drive every method on the adapter.
 */
function makeFakeExecutor(store: FakeStore): PgExecutor {
  return async (sql, params = []) => {
    store.log.push({ sql, params })
    const trimmed = sql.trim()
    const head = trimmed.split(/\s+/)[0]?.toUpperCase()

    // SELECT statements
    if (head === 'SELECT') {
      // commitBatch summary CTE: WITH inserted_things AS (...) SELECT ...
      if (/SELECT\s+\(SELECT COUNT/i.test(trimmed) || /things_inserted/.test(trimmed)) {
        // commit-batch summary path; counts will be answered by the WITH parser.
        return [{ things_inserted: 0, actions_inserted: 0 }]
      }
      // verbs table reads
      if (/FROM\s+\w+\.verbs/i.test(trimmed)) {
        if (/WHERE\s+name\s*=\s*\$1/.test(trimmed)) {
          const name = String(params[0])
          const verb = store.verbs.get(name)
          if (!verb) return []
          return [{ data: verb.data, created_at: verb.created_at }]
        }
        // listVerbs — order by name
        const verbs = [...store.verbs.values()].sort((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        )
        return verbs.map((v) => ({ data: v.data, created_at: v.created_at }))
      }
      // actions JOIN things — related()
      if (/FROM\s+\w+\.actions\s+a\s+JOIN/i.test(trimmed)) {
        const ns = String(params[0])
        const subject = String(params[1])
        const verb = String(params[2])
        const matches: Array<{ id: string; type: string; data: Record<string, unknown> }> = []
        for (const a of store.actions.values()) {
          if (a.ns !== ns) continue
          if (a.subject !== subject) continue
          if (a.verb !== verb) continue
          if (!a.object) continue
          const t = store.things.get(store.thingKey(ns, a.object))
          if (t) matches.push({ id: t.id, type: t.type, data: t.data })
        }
        return matches
      }
      // actions list — queryActions
      if (/FROM\s+\w+\.actions/i.test(trimmed)) {
        return queryActionsFromStore(store, sql, params)
      }
      // things list / get / search
      if (/FROM\s+\w+\.things/i.test(trimmed)) {
        return queryThingsFromStore(store, sql, params)
      }
      return []
    }

    // INSERT statements
    if (head === 'INSERT') {
      if (/INTO\s+\w+\.things/i.test(trimmed)) {
        const [ns, id, type, dataJson] = params as [string, string, string, string]
        const key = store.thingKey(ns, id)
        if (!store.things.has(key)) {
          store.things.set(key, {
            ns,
            id,
            type,
            data: JSON.parse(dataJson),
            created_at: new Date(),
            updated_at: new Date(),
          })
        }
        return []
      }
      if (/INTO\s+\w+\.actions/i.test(trimmed)) {
        const [
          ns,
          id,
          verb,
          subject,
          object,
          rolesJson,
          dataJson,
          status,
          createdAtIso,
          completedAtIso,
        ] = params as [
          string,
          string,
          string,
          string | null,
          string | null,
          string,
          string,
          ActionRow['status'],
          string,
          string | null
        ]
        store.actions.set(id, {
          ns,
          id,
          verb,
          subject: subject ?? null,
          object: object ?? null,
          roles: JSON.parse(rolesJson),
          data: JSON.parse(dataJson),
          status,
          created_at: new Date(createdAtIso),
          completed_at: completedAtIso ? new Date(completedAtIso) : null,
        })
        return []
      }
      if (/INTO\s+\w+\.verbs/i.test(trimmed)) {
        const [name, dataJson] = params as [string, string]
        if (!store.verbs.has(name)) {
          store.verbs.set(name, {
            name,
            data: JSON.parse(dataJson),
            created_at: new Date(),
          })
        }
        return []
      }
    }

    // WITH (... CTE for commitBatch)
    if (head === 'WITH') {
      return commitBatchFromStore(store, sql, params)
    }

    // UPDATE
    if (head === 'UPDATE' && /\.things/i.test(trimmed)) {
      const [dataJson, ns, type, id] = params as [string, string, string, string]
      const key = store.thingKey(ns, id)
      const row = store.things.get(key)
      if (row) {
        row.data = JSON.parse(dataJson)
        row.updated_at = new Date()
        if (row.type !== type) row.type = type
      }
      return []
    }

    // DELETE
    if (head === 'DELETE') {
      if (/FROM\s+\w+\.things/i.test(trimmed)) {
        const [ns, _type, id] = params as [string, string, string]
        store.things.delete(store.thingKey(ns, id))
        return []
      }
      if (/FROM\s+\w+\.actions/i.test(trimmed)) {
        // Either by (subject OR object) cascade, or by (ns, verb, subject, object)
        if (/subject\s*=\s*\$2\s+OR\s+object\s*=\s*\$2/i.test(trimmed)) {
          const [ns, id] = params as [string, string]
          for (const [aid, a] of store.actions) {
            if (a.ns === ns && (a.subject === id || a.object === id)) {
              store.actions.delete(aid)
            }
          }
          return []
        }
        const [ns, verb, subject, object] = params as [string, string, string, string]
        for (const [aid, a] of store.actions) {
          if (a.ns === ns && a.verb === verb && a.subject === subject && a.object === object) {
            store.actions.delete(aid)
          }
        }
        return []
      }
    }

    // CREATE / DDL — accepted as no-op in tests
    if (head === 'CREATE') return []

    return []
  }
}

function queryThingsFromStore(
  store: FakeStore,
  sql: string,
  params: ReadonlyArray<unknown>
): Array<Record<string, unknown>> {
  const ns = String(params[0])
  const type = String(params[1])

  // get(): single LIMIT 1 with id = $3
  if (/AND\s+id\s*=\s*\$3/i.test(sql)) {
    const id = String(params[2])
    const row = store.things.get(store.thingKey(ns, id))
    return row ? [{ data: row.data }] : []
  }

  // search(): ILIKE $3
  if (/data::text\s+ILIKE\s+\$3/i.test(sql)) {
    const pattern = String(params[2])
    const limit = Number(params[3] ?? 100)
    const needle = pattern.replace(/^%|%$/g, '').toLowerCase()
    const matches = [...store.things.values()].filter(
      (t) => t.ns === ns && t.type === type && JSON.stringify(t.data).toLowerCase().includes(needle)
    )
    matches.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return matches.slice(0, limit).map((t) => ({ id: t.id, data: t.data }))
  }

  // list(): LIMIT $3 OFFSET $4
  const limit = Number(params[2] ?? 1000)
  const offset = Number(params[3] ?? 0)
  const matches = [...store.things.values()].filter((t) => t.ns === ns && t.type === type)
  matches.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return matches.slice(offset, offset + limit).map((t) => ({ id: t.id, data: t.data }))
}

function queryActionsFromStore(
  store: FakeStore,
  sql: string,
  params: ReadonlyArray<unknown>
): Array<Record<string, unknown>> {
  // Walk through the conditions in the order they were appended by the
  // adapter. We don't perfectly mirror the SQL generation; we re-parse the
  // conditions list. Simplest robust path: filter in JS by inspecting the
  // params array along with the WHERE clause.
  const ns = String(params[0])
  let acts = [...store.actions.values()].filter((a) => a.ns === ns)

  // The adapter appends: ns, verb?, subject?, object?, roles..., status..., since?, until?, limit, offset
  // We use the SQL string to extract which fields are filtered.
  let n = 1
  if (/\bverb\s*=\s*\$\d+/i.test(sql)) {
    const v = String(params[n++])
    acts = acts.filter((a) => a.verb === v)
  }
  if (/\bsubject\s*=\s*\$\d+(?!.*roles->)/i.test(sql)) {
    // Direct subject filter (not a role->>'subject' since the adapter routes those through subject= as well)
    const cnt = (sql.match(/\bsubject\s*=\s*\$\d+/g) ?? []).length
    if (cnt > 0) {
      const subj = String(params[n++])
      acts = acts.filter((a) => a.subject === subj)
      // additional same-column filters from role.subject if present in role
    }
  }
  if (/\bobject\s*=\s*\$\d+/i.test(sql)) {
    const cnt = (sql.match(/\bobject\s*=\s*\$\d+/g) ?? []).length
    if (cnt > 0) {
      const obj = String(params[n++])
      acts = acts.filter((a) => a.object === obj)
    }
  }
  // roles->>'role' = $N — we evaluate by extracting role names from SQL
  const roleMatches = [...sql.matchAll(/roles->>'([^']+)'\s*=\s*\$\d+/g)]
  for (const rm of roleMatches) {
    const roleName = rm[1]!
    const want = String(params[n++])
    acts = acts.filter((a) => a.roles[roleName] === want)
  }
  if (/\bstatus\s+IN\s*\(/i.test(sql)) {
    // We just need to count the IN-list parameters; the SQL captures `IN ($X, $Y, ...)`
    const inSegment = sql.match(/\bstatus\s+IN\s*\(([^)]*)\)/i)
    const placeholderCount = inSegment ? inSegment[1]?.match(/\$\d+/g)?.length ?? 0 : 0
    const wanted = new Set<string>()
    for (let i = 0; i < placeholderCount; i++) {
      wanted.add(String(params[n++]))
    }
    acts = acts.filter((a) => wanted.has(a.status))
  }
  if (/\bcreated_at\s*>=\s*\$\d+/i.test(sql)) {
    const since = new Date(String(params[n++]))
    acts = acts.filter((a) => a.created_at >= since)
  }
  if (/\bcreated_at\s*<=\s*\$\d+/i.test(sql)) {
    const until = new Date(String(params[n++]))
    acts = acts.filter((a) => a.created_at <= until)
  }

  acts.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())

  const limit = Number(params[n++] ?? 1000)
  const offset = Number(params[n++] ?? 0)

  return acts.slice(offset, offset + limit).map((a) => ({
    id: a.id,
    verb: a.verb,
    subject: a.subject,
    object: a.object,
    roles: a.roles,
    data: a.data,
    status: a.status,
    created_at: a.created_at,
    completed_at: a.completed_at,
  }))
}

function commitBatchFromStore(
  store: FakeStore,
  sql: string,
  params: ReadonlyArray<unknown>
): Array<Record<string, unknown>> {
  // Walk the SQL to identify how many things and actions are in the batch.
  // We rely on the placeholder-shape: things take 4 cols, actions take 10 cols.
  // We scan params in chunks.
  const hasThings = /inserted_things/.test(sql)
  const hasActions = /inserted_actions/.test(sql)
  let i = 0
  let thingsInserted = 0
  let actionsInserted = 0
  if (hasThings) {
    // count placeholders in first VALUES (...) group block
    const thingsMatch = sql.match(
      /INSERT INTO\s+\w+\.things\s+\([^)]+\)\s+VALUES\s+([\s\S]+?)\s+ON CONFLICT/i
    )
    const placeholders = thingsMatch?.[1]?.match(/\$\d+/g) ?? []
    const cnt = placeholders.length / 4
    for (let k = 0; k < cnt; k++) {
      const ns = String(params[i++])
      const id = String(params[i++])
      const type = String(params[i++])
      const data = JSON.parse(String(params[i++]))
      const key = store.thingKey(ns, id)
      if (!store.things.has(key)) {
        store.things.set(key, {
          ns,
          id,
          type,
          data,
          created_at: new Date(),
          updated_at: new Date(),
        })
        thingsInserted++
      }
    }
  }
  if (hasActions) {
    const actionsMatch = sql.match(
      /INSERT INTO\s+\w+\.actions\s+\([^)]+\)\s+VALUES\s+([\s\S]+?)\s+ON CONFLICT/i
    )
    const placeholders = actionsMatch?.[1]?.match(/\$\d+/g) ?? []
    const cnt = placeholders.length / 10
    for (let k = 0; k < cnt; k++) {
      const ns = String(params[i++])
      const id = String(params[i++])
      const verb = String(params[i++])
      const subject = (params[i++] ?? null) as string | null
      const object = (params[i++] ?? null) as string | null
      const roles = JSON.parse(String(params[i++]))
      const data = JSON.parse(String(params[i++]))
      const status = String(params[i++]) as ActionRow['status']
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
        actionsInserted++
      }
    }
  }
  return [{ things_inserted: thingsInserted, actions_inserted: actionsInserted }]
}

// =============================================================================
// Tests — capabilities
// =============================================================================

describe('PostgresProvider — capability declaration', () => {
  let store: FakeStore
  let adapter: PostgresProvider

  beforeEach(() => {
    store = new FakeStore()
    adapter = new PostgresProvider({ executor: makeFakeExecutor(store) })
  })

  it('declares partitioned-by-tenant sharding by default', () => {
    expect(adapter.capabilities.adapter).toBe('pg+pgvector')
    expect(adapter.capabilities.shardingModel).toBe('partitioned-by-tenant')
  })

  it('allows overriding the sharding model to unsharded', () => {
    const a = new PostgresProvider({
      executor: makeFakeExecutor(store),
      shardingModel: 'unsharded',
    })
    expect(a.capabilities.shardingModel).toBe('unsharded')
  })

  it('declares Tier 3 analytics with hasLargeScans=false (per ADR-0003 caveats)', () => {
    const caps = adapter.capabilities
    expect(caps.analytics?.hasAggregations).toBe(true)
    expect(caps.analytics?.hasTimeSeries).toBe(true)
    expect(caps.analytics?.hasLargeScans).toBe(false)
  })

  it('declares Tier 4 vector search via pgvector (cosine, l2, dot)', () => {
    const caps = adapter.capabilities
    expect(caps.vectorSearch?.implementation).toBe('native')
    expect(caps.vectorSearch?.metrics).toEqual(['cosine', 'l2', 'dot'])
    expect(caps.vectorSearch?.maxDimensions).toBe(1536)
  })

  it('honours custom vectorDimensions', () => {
    const a = new PostgresProvider({
      executor: makeFakeExecutor(store),
      vectorDimensions: 3072,
    })
    expect(a.capabilities.vectorSearch?.maxDimensions).toBe(3072)
  })

  it('declares hasActionRecording: true and hasVerbRegistry: true', () => {
    expect(adapter.capabilities.hasActionRecording).toBe(true)
    expect(adapter.capabilities.hasVerbRegistry).toBe(true)
  })

  it('participates in capability discovery via getProviderCapabilities()', () => {
    const caps = getProviderCapabilities(adapter)
    expect(caps.adapter).toBe('pg+pgvector')
  })

  it('passes hasActionRecording / hasVerbRegistry / hasAnalytics type guards', () => {
    expect(hasActionRecording(adapter)).toBe(true)
    expect(hasVerbRegistry(adapter)).toBe(true)
    expect(hasAnalytics(adapter)).toBe(true)
  })

  it('does NOT yet pass hasVectorSearch (vectorSearch method lands in aip-kh9l)', () => {
    // The capability is declared, but the runtime method is deferred to a
    // later bead. The type guard requires both — so it returns false until
    // aip-kh9l ships.
    expect(hasVectorSearch(adapter)).toBe(false)
  })
})

// =============================================================================
// Tests — Tier 1 CRUD
// =============================================================================

describe('PostgresProvider — Tier 1 CRUD', () => {
  let store: FakeStore
  let adapter: PostgresProvider

  beforeEach(() => {
    store = new FakeStore()
    adapter = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-1',
    })
  })

  it('create() inserts a row and returns the entity with $id/$type', async () => {
    const entity = await adapter.create('User', 'u1', { name: 'Alice' })
    expect(entity['$id']).toBe('u1')
    expect(entity['$type']).toBe('User')
    expect(entity['name']).toBe('Alice')
    expect(store.things.has('tenant-1:u1')).toBe(true)
  })

  it('create() generates an id when none provided', async () => {
    const entity = await adapter.create('User', undefined, { name: 'Bob' })
    expect(typeof entity['$id']).toBe('string')
    expect((entity['$id'] as string).length).toBeGreaterThan(0)
  })

  it('get() returns null for missing rows', async () => {
    const entity = await adapter.get('User', 'missing')
    expect(entity).toBeNull()
  })

  it('get() returns a row created via create()', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    const fetched = await adapter.get('User', 'u1')
    expect(fetched).not.toBeNull()
    expect(fetched?.['name']).toBe('Alice')
    expect(fetched?.['$id']).toBe('u1')
  })

  it('list() returns rows for the (ns, type)', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('User', 'u2', { name: 'Bob' })
    await adapter.create('Order', 'o1', { total: 10 })
    const users = await adapter.list('User')
    expect(users.length).toBe(2)
    const names = users.map((u) => u['name'])
    expect(names).toContain('Alice')
    expect(names).toContain('Bob')
  })

  it('list() supports limit/offset', async () => {
    for (let i = 0; i < 5; i++) {
      await adapter.create('Item', `i${i}`, { idx: i })
    }
    const page = await adapter.list('Item', { limit: 2, offset: 1 })
    expect(page.length).toBe(2)
  })

  it('list() applies where filter client-side', async () => {
    await adapter.create('User', 'u1', { team: 'eng' })
    await adapter.create('User', 'u2', { team: 'sales' })
    const eng = await adapter.list('User', { where: { team: 'eng' } })
    expect(eng.length).toBe(1)
    expect(eng[0]?.['$id']).toBe('u1')
  })

  it('search() returns rows matching the query string', async () => {
    await adapter.create('User', 'u1', { name: 'Alice', team: 'engineering' })
    await adapter.create('User', 'u2', { name: 'Bob', team: 'sales' })
    const results = await adapter.search('User', 'engineering')
    expect(results.length).toBe(1)
    expect(results[0]?.['$id']).toBe('u1')
  })

  it('update() merges fields and bumps updatedAt', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    const updated = await adapter.update('User', 'u1', { team: 'eng' })
    expect(updated['name']).toBe('Alice')
    expect(updated['team']).toBe('eng')
    expect(updated['$id']).toBe('u1')
  })

  it('update() throws EntityNotFoundError for missing rows', async () => {
    await expect(adapter.update('User', 'missing', { x: 1 })).rejects.toThrow()
  })

  it('delete() removes the row and returns true', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    const result = await adapter.delete('User', 'u1')
    expect(result).toBe(true)
    expect(store.things.has('tenant-1:u1')).toBe(false)
  })

  it('delete() returns false for missing rows', async () => {
    const result = await adapter.delete('User', 'missing')
    expect(result).toBe(false)
  })

  it('namespace isolation: rows in one namespace are invisible to another', async () => {
    const a1 = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-A',
    })
    const a2 = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-B',
    })
    await a1.create('User', 'u1', { name: 'Alice' })
    expect(await a2.get('User', 'u1')).toBeNull()
    expect(await a1.get('User', 'u1')).not.toBeNull()
  })
})

// =============================================================================
// Tests — Tier 2 graph
// =============================================================================

describe('PostgresProvider — Tier 2 graph traversal via Actions', () => {
  let store: FakeStore
  let adapter: PostgresProvider

  beforeEach(() => {
    store = new FakeStore()
    adapter = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-1',
    })
  })

  it('relate() records a completed Action and related() reads it back', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('Order', 'o1', { total: 100 })
    await adapter.relate('User', 'u1', 'placed', 'Order', 'o1')
    const orders = await adapter.related('User', 'u1', 'placed')
    expect(orders.length).toBe(1)
    expect(orders[0]?.['$id']).toBe('o1')
    expect(orders[0]?.['$type']).toBe('Order')
  })

  it('unrelate() removes the Action', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('Order', 'o1', { total: 100 })
    await adapter.relate('User', 'u1', 'placed', 'Order', 'o1')
    await adapter.unrelate('User', 'u1', 'placed', 'Order', 'o1')
    const orders = await adapter.related('User', 'u1', 'placed')
    expect(orders.length).toBe(0)
  })

  it('delete() cascades to actions where the entity is subject or object', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('Order', 'o1', { total: 100 })
    await adapter.relate('User', 'u1', 'placed', 'Order', 'o1')
    await adapter.delete('User', 'u1')
    expect(store.actions.size).toBe(0)
  })
})

// =============================================================================
// Tests — SVO Action recording
// =============================================================================

describe('PostgresProvider — SVO recordAction / queryActions', () => {
  let store: FakeStore
  let adapter: PostgresProvider

  beforeEach(() => {
    store = new FakeStore()
    adapter = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-1',
    })
  })

  it('recordAction() persists a row and returns the Action', async () => {
    const action = await adapter.recordAction({
      verb: 'approve',
      subject: 'priya',
      object: 'refund-1',
      status: 'completed',
    })
    expect(action.verb).toBe('approve')
    expect(action.subject).toBe('priya')
    expect(action.object).toBe('refund-1')
    expect(action.status).toBe('completed')
    expect(action.completedAt).toBeDefined()
    expect(action.id).toBeDefined()
  })

  it('recordAction() defaults status to pending and omits completedAt', async () => {
    const action = await adapter.recordAction({
      verb: 'create',
      subject: 'priya',
    })
    expect(action.status).toBe('pending')
    expect(action.completedAt).toBeUndefined()
  })

  it('queryActions() with no filter returns all actions in the namespace', async () => {
    await adapter.recordAction({ verb: 'create', subject: 'priya', status: 'completed' })
    await adapter.recordAction({ verb: 'approve', subject: 'priya', status: 'completed' })
    const all = await adapter.queryActions()
    expect(all.length).toBe(2)
  })

  it('queryActions() filters by verb', async () => {
    await adapter.recordAction({ verb: 'create', subject: 'priya', status: 'completed' })
    await adapter.recordAction({ verb: 'approve', subject: 'priya', status: 'completed' })
    const approves = await adapter.queryActions({ verb: 'approve' })
    expect(approves.length).toBe(1)
    expect(approves[0]?.verb).toBe('approve')
  })

  it('queryActions() filters by subject and object', async () => {
    await adapter.recordAction({
      verb: 'approve',
      subject: 'priya',
      object: 'r1',
      status: 'completed',
    })
    await adapter.recordAction({
      verb: 'approve',
      subject: 'priya',
      object: 'r2',
      status: 'completed',
    })
    const filtered = await adapter.queryActions({ subject: 'priya', object: 'r1' })
    expect(filtered.length).toBe(1)
    expect(filtered[0]?.object).toBe('r1')
  })

  it('queryActions() filters by status', async () => {
    await adapter.recordAction({ verb: 'create', status: 'completed' })
    await adapter.recordAction({ verb: 'create', status: 'pending' })
    const completed = await adapter.queryActions({ status: 'completed' })
    expect(completed.length).toBe(1)
    expect(completed[0]?.status).toBe('completed')
  })

  it('queryActions() supports an array of statuses', async () => {
    await adapter.recordAction({ verb: 'a', status: 'completed' })
    await adapter.recordAction({ verb: 'b', status: 'failed' })
    await adapter.recordAction({ verb: 'c', status: 'pending' })
    const terminal = await adapter.queryActions({ status: ['completed', 'failed'] })
    expect(terminal.length).toBe(2)
  })

  it('queryActions() filters by Frame role (recipient)', async () => {
    await adapter.recordAction({
      verb: 'send',
      subject: 'alice',
      object: 'msg-1',
      roles: { recipient: 'bob' },
      status: 'completed',
    })
    await adapter.recordAction({
      verb: 'send',
      subject: 'alice',
      object: 'msg-2',
      roles: { recipient: 'carol' },
      status: 'completed',
    })
    const toBob = await adapter.queryActions({ role: { recipient: 'bob' } })
    expect(toBob.length).toBe(1)
    expect(toBob[0]?.roles?.recipient).toBe('bob')
  })

  it('queryActions() supports limit/offset and orders by createdAt ASC', async () => {
    for (let i = 0; i < 3; i++) {
      await adapter.recordAction({
        verb: 'create',
        subject: `s${i}`,
        status: 'completed',
      })
      // tick the wall clock so created_at differs
      await new Promise((r) => setTimeout(r, 5))
    }
    const first = await adapter.queryActions({ limit: 1, offset: 0 })
    const second = await adapter.queryActions({ limit: 1, offset: 1 })
    expect(first[0]?.subject).toBe('s0')
    expect(second[0]?.subject).toBe('s1')
  })
})

// =============================================================================
// Tests — Verb registry
// =============================================================================

describe('PostgresProvider — Verb registry', () => {
  let store: FakeStore
  let adapter: PostgresProvider

  beforeEach(() => {
    store = new FakeStore()
    adapter = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-1',
    })
  })

  it('defineVerb() persists a verb with derived conjugations', async () => {
    const verb = await adapter.defineVerb({ name: 'approve' })
    expect(verb.name).toBe('approve')
    expect(verb.action).toBe('approve')
    expect(verb.act).toBe('approves')
    expect(verb.activity).toBe('approveing')
    expect(verb.event).toBe('approved')
  })

  it('getVerb() returns null for missing verbs', async () => {
    const v = await adapter.getVerb('missing')
    expect(v).toBeNull()
  })

  it('getVerb() returns a defined verb', async () => {
    await adapter.defineVerb({ name: 'approve', description: 'Approve a thing' })
    const v = await adapter.getVerb('approve')
    expect(v?.name).toBe('approve')
    expect(v?.description).toBe('Approve a thing')
  })

  it('listVerbs() returns all verbs ordered by name', async () => {
    await adapter.defineVerb({ name: 'create' })
    await adapter.defineVerb({ name: 'approve' })
    const verbs = await adapter.listVerbs()
    expect(verbs.map((v) => v.name)).toEqual(['approve', 'create'])
  })
})

// =============================================================================
// Tests — Cascade write fast path
// =============================================================================

describe('PostgresProvider — commitBatch (CTE jsonb-bulk write path)', () => {
  let store: FakeStore
  let adapter: PostgresProvider

  beforeEach(() => {
    store = new FakeStore()
    adapter = new PostgresProvider({
      executor: makeFakeExecutor(store),
      namespace: 'tenant-1',
    })
  })

  it('commits things and actions in one round-trip', async () => {
    const result = await adapter.commitBatch({
      things: [
        { type: 'Customer', id: 'c1', data: { name: 'Acme' } },
        { type: 'Order', id: 'o1', data: { total: 100 } },
      ],
      actions: [{ id: 'a1', verb: 'placedBy', subject: 'o1', object: 'c1', status: 'completed' }],
    })
    expect(result.thingsInserted).toBe(2)
    expect(result.actionsInserted).toBe(1)
    expect(store.things.size).toBe(2)
    expect(store.actions.size).toBe(1)
  })

  it('handles empty batches', async () => {
    const result = await adapter.commitBatch({})
    expect(result.thingsInserted).toBe(0)
    expect(result.actionsInserted).toBe(0)
  })

  it('handles things-only batches', async () => {
    const result = await adapter.commitBatch({
      things: [{ type: 'Customer', id: 'c1', data: { name: 'Acme' } }],
    })
    expect(result.thingsInserted).toBe(1)
    expect(result.actionsInserted).toBe(0)
  })

  it('handles actions-only batches', async () => {
    const result = await adapter.commitBatch({
      actions: [{ verb: 'noted', subject: 's1', status: 'completed' }],
    })
    expect(result.thingsInserted).toBe(0)
    expect(result.actionsInserted).toBe(1)
  })

  it('skips on conflict (DO NOTHING) for duplicate ids', async () => {
    await adapter.commitBatch({
      things: [{ type: 'Customer', id: 'c1', data: { name: 'Acme' } }],
    })
    const second = await adapter.commitBatch({
      things: [{ type: 'Customer', id: 'c1', data: { name: 'Acme v2' } }],
    })
    expect(second.thingsInserted).toBe(0)
    // First version remains
    const fetched = await adapter.get('Customer', 'c1')
    expect(fetched?.['name']).toBe('Acme')
  })

  it('emits a single SQL statement for the entire batch (cascade-write shape)', async () => {
    store.log = []
    await adapter.commitBatch({
      things: [
        { type: 'Customer', id: 'c1', data: { name: 'Acme' } },
        { type: 'Customer', id: 'c2', data: { name: 'Beta' } },
      ],
      actions: [{ id: 'a1', verb: 'noted', subject: 's1', status: 'completed' }],
    })
    // The CTE wraps both inserts in one statement.
    const cteEntries = store.log.filter((e) => e.sql.trim().toUpperCase().startsWith('WITH'))
    expect(cteEntries.length).toBe(1)
  })
})

// =============================================================================
// Tests — analyticsQuery + describe()
// =============================================================================

describe('PostgresProvider — analyticsQuery + describe', () => {
  it('describe() returns adapter / driver / namespace / schema', () => {
    const adapter = new PostgresProvider({
      executor: makeFakeExecutor(new FakeStore()),
      namespace: 'tenant-7',
      schema: 'custom',
      driver: 'neon-http',
    })
    const meta = adapter.describe()
    expect(meta.adapter).toBe('pg+pgvector')
    expect(meta.driver).toBe('neon-http')
    expect(meta.namespace).toBe('tenant-7')
    expect(meta.schema).toBe('custom')
  })

  it('analyticsQuery() forwards SQL to the executor', async () => {
    const store = new FakeStore()
    const adapter = new PostgresProvider({ executor: makeFakeExecutor(store) })
    await adapter.analyticsQuery('SELECT 1', {})
    expect(store.log.length).toBeGreaterThan(0)
    expect(store.log[store.log.length - 1]?.sql).toContain('SELECT 1')
  })
})

// =============================================================================
// Tests — Executor wrappers
// =============================================================================

describe('PostgresProvider — executor factories', () => {
  it('createNeonHttpExecutor wraps a neon function', async () => {
    const calls: Array<{ sql: string; params: ReadonlyArray<unknown> }> = []
    const fakeNeon = async (sql: string, params?: ReadonlyArray<unknown>) => {
      calls.push({ sql, params: params ?? [] })
      return [{ value: 1 }]
    }
    const exec = createNeonHttpExecutor(fakeNeon)
    const rows = await exec('SELECT 1', [42])
    expect(rows).toEqual([{ value: 1 }])
    expect(calls[0]?.sql).toBe('SELECT 1')
    expect(calls[0]?.params).toEqual([42])
  })

  it('createPgClientExecutor wraps postgres.js unsafe()', async () => {
    const calls: Array<{ sql: string; params: ReadonlyArray<unknown> }> = []
    const client = {
      unsafe: async (sql: string, params?: ReadonlyArray<unknown>) => {
        calls.push({ sql, params: params ?? [] })
        return [{ value: 2 }]
      },
    }
    const exec = createPgClientExecutor(client)
    const rows = await exec('SELECT 2', [99])
    expect(rows).toEqual([{ value: 2 }])
    expect(calls[0]?.sql).toBe('SELECT 2')
  })

  it('createPostgresProvider factory returns a usable PostgresProvider', () => {
    const provider = createPostgresProvider({
      executor: makeFakeExecutor(new FakeStore()),
    })
    expect(provider).toBeInstanceOf(PostgresProvider)
  })
})
