/**
 * ClickHouseProvider adapter tests
 *
 * Adapter-logic tests against a fake `ClickHouseHttpFetcher` that
 * interprets the SQL the adapter emits — no real ClickHouse process
 * involved. The fake recognises the SQL family by leading keyword + table
 * mention and answers from in-memory tables, returning ClickHouse-shaped
 * `FORMAT JSON` responses for SELECTs.
 *
 * These tests cover:
 * - Capability declaration (Tier 3 first-class, Tier 4 native vectors,
 *   sharding model)
 * - CRUD round-trip
 * - Tier 2 graph (`relate`/`related`/`unrelate`)
 * - SVO `recordAction`/`queryActions`
 * - Verb registry round-trip
 * - `commitBatch` cascade write path (JSONEachRow shape)
 * - `analyticsQuery` pass-through with FORMAT-JSON appending
 *
 * Integration tests against a real ClickHouse instance are out of scope.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ClickHouseProvider,
  createClickHouseProvider,
  createClickHouseHttpFetcher,
  type ClickHouseHttpFetcher,
} from '../src/ch-adapter.js'
import {
  getProviderCapabilities,
  hasActionRecording,
  hasVerbRegistry,
  hasVectorSearch,
  hasAnalytics,
} from '../src/db-provider-port.js'

// =============================================================================
// Fake ClickHouseHttpFetcher backed by in-memory tables
// =============================================================================

interface ThingRow {
  ns: string
  id: string
  type: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
  version: number
}

interface ActionRow {
  ns: string
  id: string
  verb: string
  subject: string
  object: string
  roles: Record<string, string>
  data: Record<string, unknown>
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  completed_at: string | null
}

interface VerbRow {
  name: string
  data: Record<string, unknown>
  created_at: string
  version: number
}

class FakeChStore {
  things = new Map<string, ThingRow>() // key = ns:type:id (matching ORDER BY)
  actions = new Map<string, ActionRow>()
  verbs = new Map<string, VerbRow>()
  log: Array<{ sql: string; body?: string }> = []

  thingKey(ns: string, type: string, id: string): string {
    return `${ns}:${type}:${id}`
  }

  reset(): void {
    this.things.clear()
    this.actions.clear()
    this.verbs.clear()
    this.log = []
  }
}

function makeFakeFetcher(store: FakeChStore): ClickHouseHttpFetcher {
  return async (sql: string, body?: string): Promise<string> => {
    store.log.push(body !== undefined ? { sql, body } : { sql })
    const trimmed = sql.trim()
    const head = trimmed.split(/\s+/)[0]?.toUpperCase()

    // INSERT INTO ... FORMAT JSONEachRow (body carries one or more JSON rows)
    if (head === 'INSERT' && body) {
      const lines = body.split('\n').filter((l) => l.trim().length > 0)
      if (/INTO\s+\w+\.things/i.test(trimmed)) {
        for (const line of lines) {
          const r = JSON.parse(line) as ThingRow & { data: string }
          const data: Record<string, unknown> =
            typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as Record<string, unknown>)
          const key = store.thingKey(r.ns, r.type, r.id)
          const existing = store.things.get(key)
          // ReplacingMergeTree by version: higher version wins
          if (!existing || existing.version <= r.version) {
            store.things.set(key, {
              ns: r.ns,
              id: r.id,
              type: r.type,
              data,
              created_at: r.created_at,
              updated_at: r.updated_at,
              version: r.version,
            })
          }
        }
        return ''
      }
      if (/INTO\s+\w+\.actions/i.test(trimmed)) {
        for (const line of lines) {
          const r = JSON.parse(line) as ActionRow & {
            data: string
            roles: string
          }
          const data: Record<string, unknown> =
            typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as Record<string, unknown>)
          const roles: Record<string, string> =
            typeof r.roles === 'string' ? JSON.parse(r.roles) : (r.roles as Record<string, string>)
          store.actions.set(r.id, {
            ns: r.ns,
            id: r.id,
            verb: r.verb,
            subject: r.subject,
            object: r.object,
            roles,
            data,
            status: r.status,
            created_at: r.created_at,
            completed_at: r.completed_at,
          })
        }
        return ''
      }
      if (/INTO\s+\w+\.verbs/i.test(trimmed)) {
        for (const line of lines) {
          const r = JSON.parse(line) as VerbRow & { data: string }
          const data: Record<string, unknown> =
            typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as Record<string, unknown>)
          const existing = store.verbs.get(r.name)
          if (!existing || existing.version <= r.version) {
            store.verbs.set(r.name, {
              name: r.name,
              data,
              created_at: r.created_at,
              version: r.version,
            })
          }
        }
        return ''
      }
    }

    // SELECT statements ending in FORMAT JSON
    if (head === 'SELECT') {
      // verbs reads
      if (/FROM\s+\w+\.verbs/i.test(trimmed)) {
        if (/WHERE\s+name\s*=\s*'([^']+)'/i.test(trimmed)) {
          const m = trimmed.match(/WHERE\s+name\s*=\s*'([^']+)'/i)
          const name = m?.[1]
          if (!name) return jsonResp([])
          const v = store.verbs.get(name)
          if (!v) return jsonResp([])
          return jsonResp([{ data: JSON.stringify(v.data), created_at: v.created_at }])
        }
        // listVerbs
        const verbs = [...store.verbs.values()].sort((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        )
        return jsonResp(
          verbs.map((v) => ({ data: JSON.stringify(v.data), created_at: v.created_at }))
        )
      }
      // related(): JOIN actions a + things t
      if (/FROM\s+\w+\.actions\s+a/i.test(trimmed) && /INNER JOIN/i.test(trimmed)) {
        const ns = matchEq(trimmed, 'a.ns') ?? ''
        const subject = matchEq(trimmed, 'a.subject') ?? ''
        const verb = matchEq(trimmed, 'a.verb') ?? ''
        const matches: Array<{ id: string; type: string; data: string }> = []
        for (const a of store.actions.values()) {
          if (a.ns !== ns) continue
          if (a.subject !== subject) continue
          if (a.verb !== verb) continue
          if (!a.object) continue
          // Find any thing with id == a.object in this ns
          for (const t of store.things.values()) {
            if (t.ns === ns && t.id === a.object) {
              matches.push({ id: t.id, type: t.type, data: JSON.stringify(t.data) })
            }
          }
        }
        return jsonResp(matches)
      }
      // queryActions
      if (/FROM\s+\w+\.actions/i.test(trimmed)) {
        return jsonResp(queryActionsFromStore(store, trimmed))
      }
      // things reads
      if (/FROM\s+\w+\.things/i.test(trimmed)) {
        return jsonResp(queryThingsFromStore(store, trimmed))
      }
      // analyticsQuery pass-through
      return jsonResp([])
    }

    // DELETE FROM ... (lightweight delete)
    if (head === 'DELETE') {
      if (/FROM\s+\w+\.things/i.test(trimmed)) {
        const ns = matchEq(trimmed, 'ns') ?? ''
        const type = matchEq(trimmed, 'type') ?? ''
        const id = matchEq(trimmed, 'id') ?? ''
        store.things.delete(store.thingKey(ns, type, id))
        return ''
      }
      if (/FROM\s+\w+\.actions/i.test(trimmed)) {
        // Two shapes: cascade-from-thing (subject = X OR object = X) and unrelate
        const ns = matchEq(trimmed, 'ns') ?? ''
        const verb = matchEq(trimmed, 'verb')
        if (verb) {
          // unrelate
          const subject = matchEq(trimmed, 'subject') ?? ''
          const object = matchEq(trimmed, 'object') ?? ''
          for (const [aid, a] of store.actions) {
            if (a.ns === ns && a.verb === verb && a.subject === subject && a.object === object) {
              store.actions.delete(aid)
            }
          }
          return ''
        }
        // cascade
        const idMatch = trimmed.match(/subject\s*=\s*'([^']+)'\s+OR\s+object\s*=\s*'\1'/)
        const id = idMatch?.[1] ?? ''
        for (const [aid, a] of store.actions) {
          if (a.ns === ns && (a.subject === id || a.object === id)) {
            store.actions.delete(aid)
          }
        }
        return ''
      }
    }

    // CREATE / DDL — accepted as no-op
    return ''
  }
}

function matchEq(sql: string, column: string): string | undefined {
  // Match `column = 'value'` for the first occurrence
  const escaped = column.replace(/[.]/g, '\\.')
  const re = new RegExp(`${escaped}\\s*=\\s*'([^']*)'`)
  const m = sql.match(re)
  return m?.[1]
}

function jsonResp<T>(rows: T[]): string {
  return JSON.stringify({ data: rows, rows: rows.length })
}

function queryThingsFromStore(store: FakeChStore, sql: string): Array<Record<string, unknown>> {
  const ns = matchEq(sql, 'ns') ?? ''
  const type = matchEq(sql, 'type') ?? ''

  // get(): id = '...' LIMIT 1
  if (/AND\s+id\s*=\s*'/i.test(sql)) {
    const id = matchEq(sql, 'id') ?? ''
    const row = store.things.get(store.thingKey(ns, type, id))
    if (!row) return []
    return [{ data: JSON.stringify(row.data) }]
  }

  // search(): data ILIKE '%query%'
  if (/data\s+ILIKE\s+'/i.test(sql)) {
    const pm = sql.match(/data\s+ILIKE\s+'%([^']*)%'/i)
    const needle = (pm?.[1] ?? '').toLowerCase()
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
    const limit = limitMatch ? Number(limitMatch[1]) : 100
    const matches = [...store.things.values()].filter(
      (t) => t.ns === ns && t.type === type && JSON.stringify(t.data).toLowerCase().includes(needle)
    )
    matches.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return matches.slice(0, limit).map((t) => ({ id: t.id, data: JSON.stringify(t.data) }))
  }

  // list(): LIMIT N OFFSET M
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i)
  const limit = limitMatch ? Number(limitMatch[1]) : 1000
  const offset = offsetMatch ? Number(offsetMatch[1]) : 0
  const matches = [...store.things.values()].filter((t) => t.ns === ns && t.type === type)
  matches.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return matches.slice(offset, offset + limit).map((t) => ({
    id: t.id,
    data: JSON.stringify(t.data),
  }))
}

function queryActionsFromStore(store: FakeChStore, sql: string): Array<Record<string, unknown>> {
  const ns = matchEq(sql, 'ns') ?? ''
  let acts = [...store.actions.values()].filter((a) => a.ns === ns)

  const verb = matchEq(sql, 'verb')
  if (verb !== undefined) acts = acts.filter((a) => a.verb === verb)

  const subjectM = sql.match(/(?<![a-zA-Z_])subject\s*=\s*'([^']*)'/)
  if (subjectM) {
    const subject = subjectM[1]!
    acts = acts.filter((a) => a.subject === subject)
  }
  const objectM = sql.match(/(?<![a-zA-Z_])object\s*=\s*'([^']*)'/)
  if (objectM) {
    const object = objectM[1]!
    acts = acts.filter((a) => a.object === object)
  }

  // role filters via JSONExtractString(roles, 'role') = 'value'
  const roleMatches = [...sql.matchAll(/JSONExtractString\(roles,\s*'([^']+)'\)\s*=\s*'([^']*)'/g)]
  for (const rm of roleMatches) {
    const role = rm[1]!
    const value = rm[2]!
    acts = acts.filter((a) => a.roles[role] === value)
  }

  // status IN ('a', 'b', ...)
  const statusInMatch = sql.match(/status\s+IN\s*\(([^)]+)\)/i)
  if (statusInMatch) {
    const list = statusInMatch[1]!
    const wanted = new Set([...list.matchAll(/'([^']*)'/g)].map((m) => m[1]!))
    acts = acts.filter((a) => wanted.has(a.status))
  }

  // since / until
  const sinceMatch = sql.match(/created_at\s*>=\s*'([^']+)'/)
  if (sinceMatch) {
    const since = new Date(sinceMatch[1]!)
    acts = acts.filter((a) => new Date(a.created_at) >= since)
  }
  const untilMatch = sql.match(/created_at\s*<=\s*'([^']+)'/)
  if (untilMatch) {
    const until = new Date(untilMatch[1]!)
    acts = acts.filter((a) => new Date(a.created_at) <= until)
  }

  acts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i)
  const limit = limitMatch ? Number(limitMatch[1]) : 1000
  const offset = offsetMatch ? Number(offsetMatch[1]) : 0

  return acts.slice(offset, offset + limit).map((a) => ({
    id: a.id,
    verb: a.verb,
    subject: a.subject,
    object: a.object,
    roles: JSON.stringify(a.roles),
    data: JSON.stringify(a.data),
    status: a.status,
    created_at: a.created_at,
    completed_at: a.completed_at,
  }))
}

// =============================================================================
// Tests — capabilities
// =============================================================================

describe('ClickHouseProvider — capability declaration', () => {
  let store: FakeChStore
  let adapter: ClickHouseProvider

  beforeEach(() => {
    store = new FakeChStore()
    adapter = new ClickHouseProvider({ fetcher: makeFakeFetcher(store) })
  })

  it('declares unsharded sharding by default', () => {
    expect(adapter.capabilities.adapter).toBe('clickhouse')
    expect(adapter.capabilities.shardingModel).toBe('unsharded')
  })

  it('allows overriding sharding to partitioned-by-tenant', () => {
    const a = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
      shardingModel: 'partitioned-by-tenant',
    })
    expect(a.capabilities.shardingModel).toBe('partitioned-by-tenant')
  })

  it('declares Tier 3 analytics as first-class (all sub-flags true)', () => {
    const caps = adapter.capabilities
    expect(caps.analytics?.hasAggregations).toBe(true)
    expect(caps.analytics?.hasTimeSeries).toBe(true)
    expect(caps.analytics?.hasLargeScans).toBe(true)
  })

  it('declares Tier 4 vector search via native CH functions (cosine, l2, dot)', () => {
    const caps = adapter.capabilities
    expect(caps.vectorSearch?.implementation).toBe('native')
    expect(caps.vectorSearch?.metrics).toEqual(['cosine', 'l2', 'dot'])
    expect(caps.vectorSearch?.maxDimensions).toBe(1536)
  })

  it('caps the declared vector dimensions at 64,000', () => {
    const a = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
      vectorDimensions: 100_000,
    })
    expect(a.capabilities.vectorSearch?.maxDimensions).toBe(64_000)
  })

  it('declares hasActionRecording: true and hasVerbRegistry: true', () => {
    expect(adapter.capabilities.hasActionRecording).toBe(true)
    expect(adapter.capabilities.hasVerbRegistry).toBe(true)
  })

  it('participates in capability discovery via getProviderCapabilities()', () => {
    const caps = getProviderCapabilities(adapter)
    expect(caps.adapter).toBe('clickhouse')
  })

  it('passes hasActionRecording / hasVerbRegistry / hasAnalytics type guards', () => {
    expect(hasActionRecording(adapter)).toBe(true)
    expect(hasVerbRegistry(adapter)).toBe(true)
    expect(hasAnalytics(adapter)).toBe(true)
  })

  it('does NOT yet pass hasVectorSearch (vectorSearch method lands in aip-kh9l)', () => {
    // CH declares the capability but the runtime method is deferred to a
    // later bead. The type guard requires both — so it returns false until
    // aip-kh9l ships.
    expect(hasVectorSearch(adapter)).toBe(false)
  })
})

// =============================================================================
// Tests — Tier 1 CRUD
// =============================================================================

describe('ClickHouseProvider — Tier 1 CRUD', () => {
  let store: FakeChStore
  let adapter: ClickHouseProvider

  beforeEach(() => {
    store = new FakeChStore()
    adapter = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
      namespace: 'tenant-1',
    })
  })

  it('create() inserts a row and returns the entity with $id/$type', async () => {
    const entity = await adapter.create('User', 'u1', { name: 'Alice' })
    expect(entity['$id']).toBe('u1')
    expect(entity['$type']).toBe('User')
    expect(entity['name']).toBe('Alice')
    expect(store.things.size).toBe(1)
  })

  it('create() generates an id when none provided', async () => {
    const entity = await adapter.create('User', undefined, { name: 'Bob' })
    expect(typeof entity['$id']).toBe('string')
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
  })

  it('list() returns rows for the namespace+type', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('User', 'u2', { name: 'Bob' })
    await adapter.create('Order', 'o1', { total: 10 })
    const users = await adapter.list('User')
    expect(users.length).toBe(2)
  })

  it('list() supports limit/offset', async () => {
    for (let i = 0; i < 4; i++) {
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

  it('search() returns rows matching the query', async () => {
    await adapter.create('User', 'u1', { name: 'Alice', team: 'engineering' })
    await adapter.create('User', 'u2', { name: 'Bob', team: 'sales' })
    const results = await adapter.search('User', 'engineering')
    expect(results.length).toBe(1)
    expect(results[0]?.['$id']).toBe('u1')
  })

  it('update() merges fields via ReplacingMergeTree (higher version wins)', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    // Bump time so the version differs
    await new Promise((r) => setTimeout(r, 5))
    const updated = await adapter.update('User', 'u1', { team: 'eng' })
    expect(updated['name']).toBe('Alice')
    expect(updated['team']).toBe('eng')
  })

  it('update() throws EntityNotFoundError for missing rows', async () => {
    await expect(adapter.update('User', 'missing', { x: 1 })).rejects.toThrow()
  })

  it('delete() removes the row and returns true', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    const result = await adapter.delete('User', 'u1')
    expect(result).toBe(true)
    expect(store.things.size).toBe(0)
  })

  it('delete() returns false for missing rows', async () => {
    expect(await adapter.delete('User', 'missing')).toBe(false)
  })

  it('namespace isolation', async () => {
    const a1 = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
      namespace: 'tenant-A',
    })
    const a2 = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
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

describe('ClickHouseProvider — Tier 2 graph traversal via Actions', () => {
  let store: FakeChStore
  let adapter: ClickHouseProvider

  beforeEach(() => {
    store = new FakeChStore()
    adapter = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
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

describe('ClickHouseProvider — SVO recordAction / queryActions', () => {
  let store: FakeChStore
  let adapter: ClickHouseProvider

  beforeEach(() => {
    store = new FakeChStore()
    adapter = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
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
  })

  it('recordAction() defaults status to pending and omits completedAt', async () => {
    const action = await adapter.recordAction({
      verb: 'create',
      subject: 'priya',
    })
    expect(action.status).toBe('pending')
    expect(action.completedAt).toBeUndefined()
  })

  it('queryActions() returns all actions in the namespace', async () => {
    await adapter.recordAction({ verb: 'create', subject: 'priya', status: 'completed' })
    await adapter.recordAction({ verb: 'approve', subject: 'priya', status: 'completed' })
    const all = await adapter.queryActions()
    expect(all.length).toBe(2)
  })

  it('queryActions() filters by verb', async () => {
    await adapter.recordAction({ verb: 'create', status: 'completed' })
    await adapter.recordAction({ verb: 'approve', status: 'completed' })
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
    await adapter.recordAction({ verb: 'a', status: 'completed' })
    await adapter.recordAction({ verb: 'b', status: 'pending' })
    const completed = await adapter.queryActions({ status: 'completed' })
    expect(completed.length).toBe(1)
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

describe('ClickHouseProvider — Verb registry', () => {
  let store: FakeChStore
  let adapter: ClickHouseProvider

  beforeEach(() => {
    store = new FakeChStore()
    adapter = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
      namespace: 'tenant-1',
    })
  })

  it('defineVerb() persists a verb with derived conjugations', async () => {
    const verb = await adapter.defineVerb({ name: 'approve' })
    expect(verb.name).toBe('approve')
    expect(verb.action).toBe('approve')
    expect(verb.act).toBe('approves')
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

describe('ClickHouseProvider — commitBatch (JSONEachRow write path)', () => {
  let store: FakeChStore
  let adapter: ClickHouseProvider

  beforeEach(() => {
    store = new FakeChStore()
    adapter = new ClickHouseProvider({
      fetcher: makeFakeFetcher(store),
      namespace: 'tenant-1',
    })
  })

  it('commits things and actions', async () => {
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

  it('emits one HTTP request per non-empty table (cascade-write shape)', async () => {
    store.log = []
    await adapter.commitBatch({
      things: [
        { type: 'Customer', id: 'c1', data: { name: 'Acme' } },
        { type: 'Customer', id: 'c2', data: { name: 'Beta' } },
      ],
      actions: [{ id: 'a1', verb: 'noted', subject: 's1', status: 'completed' }],
    })
    const inserts = store.log.filter((e) => e.sql.trim().toUpperCase().startsWith('INSERT'))
    // One insert for things, one for actions
    expect(inserts.length).toBe(2)
  })
})

// =============================================================================
// Tests — analyticsQuery + describe()
// =============================================================================

describe('ClickHouseProvider — analyticsQuery + describe', () => {
  it('describe() returns adapter / driver / namespace / database', () => {
    const adapter = new ClickHouseProvider({
      fetcher: makeFakeFetcher(new FakeChStore()),
      namespace: 'tenant-7',
      database: 'custom',
    })
    const meta = adapter.describe()
    expect(meta.adapter).toBe('clickhouse')
    expect(meta.driver).toBe('clickhouse-http')
    expect(meta.namespace).toBe('tenant-7')
    expect(meta.database).toBe('custom')
  })

  it('analyticsQuery() appends FORMAT JSON when not provided', async () => {
    const store = new FakeChStore()
    const adapter = new ClickHouseProvider({ fetcher: makeFakeFetcher(store) })
    await adapter.analyticsQuery('SELECT 1')
    const last = store.log[store.log.length - 1]
    expect(last?.sql).toContain('FORMAT JSON')
  })

  it('analyticsQuery() respects an existing FORMAT clause', async () => {
    const store = new FakeChStore()
    const adapter = new ClickHouseProvider({ fetcher: makeFakeFetcher(store) })
    await adapter.analyticsQuery('SELECT 1 FORMAT TabSeparated')
    const last = store.log[store.log.length - 1]
    // Should not append another FORMAT
    expect((last?.sql.match(/FORMAT/g) ?? []).length).toBe(1)
    expect(last?.sql).toContain('TabSeparated')
  })
})

// =============================================================================
// Tests — Fetcher factory
// =============================================================================

describe('ClickHouseProvider — fetcher factory', () => {
  it('createClickHouseHttpFetcher sends queries via POST with auth header', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ data: [{ value: 1 }] }), { status: 200 })
    }) as typeof fetch

    const fetcher = createClickHouseHttpFetcher({
      url: 'https://ch.test:8443',
      username: 'user',
      password: 'pass',
      database: 'aidb',
      fetchImpl: fakeFetch,
    })
    await fetcher('SELECT 1 FORMAT JSON')
    expect(calls.length).toBe(1)
    expect(calls[0]?.url).toContain('database=aidb')
    expect((calls[0]?.init.headers as Record<string, string>)?.['Authorization']).toMatch(/^Basic /)
    expect(calls[0]?.init.body).toBe('SELECT 1 FORMAT JSON')
  })

  it('createClickHouseHttpFetcher routes inserts via query= param + body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response('', { status: 200 })
    }) as typeof fetch

    const fetcher = createClickHouseHttpFetcher({
      url: 'https://ch.test:8443',
      database: 'aidb',
      fetchImpl: fakeFetch,
    })
    await fetcher('INSERT INTO aidb.things FORMAT JSONEachRow', '{"id":"1"}\n')
    expect(calls.length).toBe(1)
    expect(calls[0]?.url).toMatch(/query=INSERT/)
    expect(calls[0]?.init.body).toBe('{"id":"1"}\n')
  })

  it('createClickHouseHttpFetcher throws on non-2xx responses', async () => {
    const fakeFetch = (async () => new Response('Bad query', { status: 500 })) as typeof fetch
    const fetcher = createClickHouseHttpFetcher({
      url: 'https://ch.test:8443',
      fetchImpl: fakeFetch,
    })
    await expect(fetcher('SELECT borked')).rejects.toThrow(/ClickHouse HTTP 500/)
  })

  it('createClickHouseProvider factory returns a usable ClickHouseProvider', () => {
    const provider = createClickHouseProvider({
      fetcher: makeFakeFetcher(new FakeChStore()),
    })
    expect(provider).toBeInstanceOf(ClickHouseProvider)
  })
})
