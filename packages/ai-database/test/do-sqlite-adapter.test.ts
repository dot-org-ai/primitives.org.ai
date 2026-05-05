/**
 * DO SQLite Adapter tests
 *
 * Adapter-logic tests against an in-memory mock of the
 * {@link DurableObjectNamespaceLike} surface that mirrors the existing
 * {@link DatabaseDO}'s fetch protocol (`/data`, `/rels`, `/query/list`,
 * `/query/search`, `/traverse`).
 *
 * These tests cover:
 * - Sharding strategy resolution (per-cascade, per-tenant, per-type, custom)
 * - CRUD round-trip via the adapter
 * - Tier 2 graph (`relate`/`related`/`unrelate`)
 * - SVO `recordAction`/`queryActions`
 * - Verb registry (`defineVerb`/`getVerb`/`listVerbs`)
 * - Capability declaration (Tier 3 false, no Tier 4, sharding model)
 * - Per-DO 10GB limit declaration
 *
 * End-to-end against real Cloudflare DO SQLite via Miniflare lives in
 * `test/worker/` (separate vitest config); this suite avoids that
 * dependency so the adapter remains testable in plain Node.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  DOSqliteAdapter,
  createDOSqliteAdapter,
  ShardingStrategies,
  type DurableObjectNamespaceLike,
  type DurableObjectIdLike,
  type DurableObjectStubLike,
  type VectorizeIndexLike,
  type VectorizeQueryResultLike,
} from '../src/do-sqlite-adapter.js'
import {
  getProviderCapabilities,
  hasActionRecording,
  hasVerbRegistry,
  hasVectorSearch,
  hasAnalytics,
} from '../src/db-provider-port.js'
import { VectorSearchUnavailableError } from '../src/errors.js'

// =============================================================================
// In-memory mock of the DatabaseDO fetch protocol
// =============================================================================

interface MockEntity {
  id: string
  type: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface MockRel {
  from_id: string
  relation: string
  to_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

class MockDO {
  readonly entities = new Map<string, MockEntity>()
  readonly rels: MockRel[] = []
  readonly id: string

  constructor(id: string) {
    this.id = id
  }

  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    const req = typeof input === 'string' ? new Request(input, init) : input
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    try {
      // /data — POST insert
      if (path === '/data' && method === 'POST') {
        const body = (await req.json()) as {
          id?: string
          type: string
          data?: Record<string, unknown>
        }
        const id = body.id ?? crypto.randomUUID()
        if (this.entities.has(id)) {
          return jsonResponse({ error: 'Record with this id already exists' }, 409)
        }
        const now = new Date().toISOString()
        const entity: MockEntity = {
          id,
          type: body.type,
          data: body.data ?? {},
          created_at: now,
          updated_at: now,
        }
        this.entities.set(id, entity)
        return jsonResponse(entity)
      }

      // /data/:id
      const dataMatch = path.match(/^\/data\/(.+)$/)
      if (dataMatch) {
        const id = decodeURIComponent(dataMatch[1]!)
        const entity = this.entities.get(id)
        if (method === 'GET') {
          if (!entity) return jsonResponse({ error: 'Not found' }, 404)
          return jsonResponse(entity)
        }
        if (method === 'PATCH') {
          if (!entity) return jsonResponse({ error: 'Not found' }, 404)
          const body = (await req.json()) as { data?: Record<string, unknown> }
          const merged = { ...entity.data, ...(body.data ?? {}) }
          const now = new Date().toISOString()
          const updated: MockEntity = { ...entity, data: merged, updated_at: now }
          this.entities.set(id, updated)
          return jsonResponse(updated)
        }
        if (method === 'DELETE') {
          if (!entity) return jsonResponse({ deleted: false })
          this.entities.delete(id)
          return jsonResponse({ deleted: true })
        }
      }

      // /query/list
      if (path === '/query/list' && method === 'POST') {
        const body = (await req.json()) as {
          type: string
          where?: Record<string, unknown>
          orderBy?: string
          order?: 'asc' | 'desc'
          limit?: number
          offset?: number
        }
        let results = [...this.entities.values()].filter((e) => e.type === body.type)
        if (body.where) {
          for (const [key, value] of Object.entries(body.where)) {
            results = results.filter((e) => {
              if (key === 'id' || key === 'type' || key === 'created_at' || key === 'updated_at') {
                return (e as unknown as Record<string, unknown>)[key] === value
              }
              return e.data[key] === value
            })
          }
        }
        if (body.orderBy) {
          const dir = body.order === 'desc' ? -1 : 1
          const field = body.orderBy
          results.sort((a, b) => {
            const av = (a.data[field] ?? a.created_at) as string | number
            const bv = (b.data[field] ?? b.created_at) as string | number
            return av < bv ? -dir : av > bv ? dir : 0
          })
        }
        if (body.offset) results = results.slice(body.offset)
        if (body.limit !== undefined) results = results.slice(0, body.limit)
        return jsonResponse(results)
      }

      // /query/search
      if (path === '/query/search' && method === 'POST') {
        const body = (await req.json()) as {
          type: string
          query: string
          fields?: string[]
          limit?: number
          minScore?: number
        }
        const q = body.query.toLowerCase()
        const results: MockEntity[] = []
        for (const entity of this.entities.values()) {
          if (entity.type !== body.type) continue
          const fields =
            body.fields && body.fields.length > 0
              ? body.fields
              : Object.keys(entity.data).filter(
                  (k) => typeof entity.data[k] === 'string' || typeof entity.data[k] === 'number'
                )
          let matched = false
          for (const f of fields) {
            const v = entity.data[f]
            if (v === undefined || v === null) continue
            if (String(v).toLowerCase().includes(q)) {
              matched = true
              break
            }
          }
          if (matched) results.push(entity)
        }
        if (body.limit !== undefined) return jsonResponse(results.slice(0, body.limit))
        return jsonResponse(results)
      }

      // /rels — POST create
      if (path === '/rels' && method === 'POST') {
        const body = (await req.json()) as {
          from_id: string
          relation: string
          to_id: string
          metadata?: Record<string, unknown>
        }
        if (!this.entities.has(body.from_id)) {
          return jsonResponse({ error: `Source entity '${body.from_id}' does not exist` }, 400)
        }
        if (!this.entities.has(body.to_id)) {
          return jsonResponse({ error: `Target entity '${body.to_id}' does not exist` }, 400)
        }
        const now = new Date().toISOString()
        const existingIdx = this.rels.findIndex(
          (r) =>
            r.from_id === body.from_id && r.relation === body.relation && r.to_id === body.to_id
        )
        if (existingIdx !== -1) {
          this.rels[existingIdx]!.metadata = body.metadata ?? null
          return jsonResponse(this.rels[existingIdx])
        }
        const rel: MockRel = {
          from_id: body.from_id,
          relation: body.relation,
          to_id: body.to_id,
          metadata: body.metadata ?? null,
          created_at: now,
        }
        this.rels.push(rel)
        return jsonResponse(rel)
      }

      // /rels/delete
      if (path === '/rels/delete' && method === 'DELETE') {
        const body = (await req.json()) as {
          from_id: string
          relation: string
          to_id: string
        }
        const idx = this.rels.findIndex(
          (r) =>
            r.from_id === body.from_id && r.relation === body.relation && r.to_id === body.to_id
        )
        if (idx === -1) return jsonResponse({ deleted: false })
        this.rels.splice(idx, 1)
        return jsonResponse({ deleted: true })
      }

      // /traverse?from_id=&relation=
      if (path === '/traverse' && method === 'GET') {
        const fromId = url.searchParams.get('from_id')
        const relation = url.searchParams.get('relation')
        if (!fromId) return jsonResponse([])
        const matches = this.rels.filter(
          (r) => r.from_id === fromId && (!relation || r.relation === relation)
        )
        const results = matches
          .map((r) => this.entities.get(r.to_id))
          .filter((e): e is MockEntity => e !== undefined)
        return jsonResponse(results)
      }

      return jsonResponse({ error: `Unhandled mock route: ${method} ${path}` }, 404)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error'
      return jsonResponse({ error: msg }, 500)
    }
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

class MockNamespace implements DurableObjectNamespaceLike {
  readonly stubs = new Map<string, MockDO>()

  idFromName(name: string): DurableObjectIdLike {
    return { name, toString: () => name }
  }

  get(id: DurableObjectIdLike): DurableObjectStubLike {
    const key = id.name ?? id.toString()
    let stub = this.stubs.get(key)
    if (!stub) {
      stub = new MockDO(key)
      this.stubs.set(key, stub)
    }
    return stub
  }

  /** Test helper: get the underlying mock DO for assertions. */
  inspect(name: string): MockDO | undefined {
    return this.stubs.get(name)
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('DOSqliteAdapter — capability declaration', () => {
  it('declares per-cascade sharding by default', () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      defaultCascadeId: 'c-1',
    })
    const caps = adapter.capabilities
    expect(caps.adapter).toBe('do-sqlite')
    expect(caps.shardingModel).toBe('per-cascade')
  })

  it('declares partitioned-by-tenant when sharding=per-tenant', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      sharding: 'per-tenant',
      defaultTenantId: 't-1',
    })
    expect(adapter.capabilities.shardingModel).toBe('partitioned-by-tenant')
  })

  it('declares Tier 3 analytics as false across all sub-fields', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    const caps = adapter.capabilities
    expect(caps.analytics).toBeDefined()
    expect(caps.analytics?.hasAggregations).toBe(false)
    expect(caps.analytics?.hasTimeSeries).toBe(false)
    expect(caps.analytics?.hasLargeScans).toBe(false)
  })

  it('does NOT declare Tier 4 vector search (Vectorize sidecar deferred to aip-kh9l)', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    expect(adapter.capabilities.vectorSearch).toBeUndefined()
  })

  it('declares hasActionRecording: true and hasVerbRegistry: true', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    expect(adapter.capabilities.hasActionRecording).toBe(true)
    expect(adapter.capabilities.hasVerbRegistry).toBe(true)
  })

  it('exposes the per-DO 10GB SQLite limit via maxStorageBytes', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    expect(adapter.maxStorageBytes).toBe(10 * 1024 * 1024 * 1024)
  })

  it('participates in capability discovery via getProviderCapabilities()', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    const caps = getProviderCapabilities(adapter)
    expect(caps.adapter).toBe('do-sqlite')
    expect(caps.shardingModel).toBe('per-cascade')
  })

  it('passes hasActionRecording and hasVerbRegistry type guards', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    expect(hasActionRecording(adapter)).toBe(true)
    expect(hasVerbRegistry(adapter)).toBe(true)
  })

  it('fails hasVectorSearch and hasAnalytics type guards', () => {
    const adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      defaultCascadeId: 'c-1',
    })
    expect(hasVectorSearch(adapter)).toBe(false)
    expect(hasAnalytics(adapter)).toBe(false)
  })
})

describe('DOSqliteAdapter — sharding strategies', () => {
  it('per-cascade: routes by cascadeId to distinct DOs', async () => {
    const ns = new MockNamespace()
    const adapterA = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
      defaultCascadeId: 'cascade-A',
    })
    const adapterB = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
      defaultCascadeId: 'cascade-B',
    })

    await adapterA.create('User', 'u1', { name: 'Alice' })
    await adapterB.create('User', 'u2', { name: 'Bob' })

    expect(ns.inspect('cascade:cascade-A')?.entities.has('u1')).toBe(true)
    expect(ns.inspect('cascade:cascade-A')?.entities.has('u2')).toBe(false)
    expect(ns.inspect('cascade:cascade-B')?.entities.has('u2')).toBe(true)
    expect(ns.inspect('cascade:cascade-B')?.entities.has('u1')).toBe(false)
  })

  it('per-tenant: routes by tenantId to distinct DOs', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-tenant',
      defaultTenantId: 'acme',
    })
    await adapter.create('User', 'u1', { name: 'Alice' })
    expect(ns.inspect('tenant:acme')?.entities.has('u1')).toBe(true)

    const adapter2 = adapter.withTenant('beta-corp')
    await adapter2.create('User', 'u2', { name: 'Bob' })
    expect(ns.inspect('tenant:beta-corp')?.entities.has('u2')).toBe(true)
  })

  it('per-type: routes by entity type to distinct DOs', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-type',
    })
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('Post', 'p1', { title: 'Hello' })
    expect(ns.inspect('type:User')?.entities.has('u1')).toBe(true)
    expect(ns.inspect('type:Post')?.entities.has('p1')).toBe(true)
    expect(ns.inspect('type:User')?.entities.has('p1')).toBe(false)
  })

  it('unsharded: routes everything to the shared DO', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'unsharded',
    })
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('Post', 'p1', { title: 'Hello' })
    expect(ns.inspect('__shared__')?.entities.size).toBe(2)
  })

  it('custom: accepts a callback strategy', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: (ctx) => `custom:${ctx.tenantId ?? 'none'}:${ctx.cascadeId ?? 'none'}`,
      defaultContext: { tenantId: 't1', cascadeId: 'c1' },
    })
    await adapter.create('User', 'u1', { name: 'Alice' })
    expect(ns.inspect('custom:t1:c1')?.entities.has('u1')).toBe(true)
  })

  it('per-cascade: throws when no cascadeId is provided', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
    })
    await expect(adapter.create('User', 'u1', { name: 'Alice' })).rejects.toThrow(
      /no cascadeId in context/
    )
  })

  it('per-tenant: throws when no tenantId is provided', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-tenant',
    })
    await expect(adapter.create('User', 'u1', { name: 'Alice' })).rejects.toThrow(
      /no tenantId in context/
    )
  })

  it('withCascade returns a bound view without mutating the original', async () => {
    const ns = new MockNamespace()
    const adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
      defaultCascadeId: 'c-base',
    })
    const bound = adapter.withCascade('c-bound')

    await adapter.create('User', 'u1', { name: 'Alice' })
    await bound.create('User', 'u2', { name: 'Bob' })

    expect(ns.inspect('cascade:c-base')?.entities.has('u1')).toBe(true)
    expect(ns.inspect('cascade:c-bound')?.entities.has('u2')).toBe(true)
  })

  it('exports ShardingStrategies factories that match the named strategies', () => {
    const strat = ShardingStrategies.perCascade('c1')
    expect(strat({})).toBe('cascade:c1')
    expect(strat({ cascadeId: 'override' })).toBe('cascade:override')
  })
})

describe('DOSqliteAdapter — Tier 1 CRUD', () => {
  let ns: MockNamespace
  let adapter: DOSqliteAdapter

  beforeEach(() => {
    ns = new MockNamespace()
    adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
      defaultCascadeId: 'c-test',
    })
  })

  it('create returns an entity with $id and $type', async () => {
    const result = await adapter.create('User', 'u1', { name: 'Alice', age: 30 })
    expect(result.$id).toBe('u1')
    expect(result.$type).toBe('User')
    expect(result.name).toBe('Alice')
    expect(result.age).toBe(30)
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })

  it('create generates an id when none is provided', async () => {
    const result = await adapter.create('User', undefined, { name: 'Anon' })
    expect(typeof result.$id).toBe('string')
    expect((result.$id as string).length).toBeGreaterThan(0)
  })

  it('get round-trips a created entity', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    const fetched = await adapter.get('User', 'u1')
    expect(fetched).not.toBeNull()
    expect(fetched!.$id).toBe('u1')
    expect(fetched!.name).toBe('Alice')
  })

  it('get returns null for missing entities', async () => {
    expect(await adapter.get('User', 'nonexistent')).toBeNull()
  })

  it('update merges fields and updates updatedAt', async () => {
    await adapter.create('User', 'u1', { name: 'Alice', age: 30 })
    const updated = await adapter.update('User', 'u1', { age: 31 })
    expect(updated.name).toBe('Alice')
    expect(updated.age).toBe(31)
  })

  it('delete returns true on success and false when missing', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    expect(await adapter.delete('User', 'u1')).toBe(true)
    expect(await adapter.delete('User', 'u1')).toBe(false)
    expect(await adapter.get('User', 'u1')).toBeNull()
  })

  it('list returns all entities of a type with $id/$type normalized', async () => {
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('User', 'u2', { name: 'Bob' })
    await adapter.create('Post', 'p1', { title: 'Hello' })
    const users = await adapter.list('User')
    expect(users).toHaveLength(2)
    expect(users.map((u) => u.$id).sort()).toEqual(['u1', 'u2'])
    expect(users.every((u) => u.$type === 'User')).toBe(true)
  })

  it('list applies where, limit, offset', async () => {
    await adapter.create('User', 'u1', { name: 'Alice', role: 'admin' })
    await adapter.create('User', 'u2', { name: 'Bob', role: 'admin' })
    await adapter.create('User', 'u3', { name: 'Carol', role: 'user' })
    const admins = await adapter.list('User', { where: { role: 'admin' } })
    expect(admins).toHaveLength(2)

    const limited = await adapter.list('User', { limit: 1 })
    expect(limited).toHaveLength(1)
  })

  it('search matches by query substring on default fields', async () => {
    await adapter.create('Post', 'p1', { title: 'TypeScript is great' })
    await adapter.create('Post', 'p2', { title: 'Rust is also great' })
    await adapter.create('Post', 'p3', { title: 'Python is fine' })
    const results = await adapter.search('Post', 'TypeScript')
    expect(results).toHaveLength(1)
    expect(results[0]!.$id).toBe('p1')
  })
})

describe('DOSqliteAdapter — Tier 2 graph', () => {
  let ns: MockNamespace
  let adapter: DOSqliteAdapter

  beforeEach(async () => {
    ns = new MockNamespace()
    adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
      defaultCascadeId: 'c-test',
    })
    await adapter.create('User', 'u1', { name: 'Alice' })
    await adapter.create('Post', 'p1', { title: 'Hello' })
    await adapter.create('Post', 'p2', { title: 'World' })
  })

  it('relate + related round-trip', async () => {
    await adapter.relate('User', 'u1', 'authored', 'Post', 'p1')
    await adapter.relate('User', 'u1', 'authored', 'Post', 'p2')
    const posts = await adapter.related('User', 'u1', 'authored')
    expect(posts).toHaveLength(2)
    expect(posts.map((p) => p.$id).sort()).toEqual(['p1', 'p2'])
  })

  it('unrelate removes the relationship', async () => {
    await adapter.relate('User', 'u1', 'authored', 'Post', 'p1')
    await adapter.unrelate('User', 'u1', 'authored', 'Post', 'p1')
    const posts = await adapter.related('User', 'u1', 'authored')
    expect(posts).toHaveLength(0)
  })
})

describe('DOSqliteAdapter — SVO Action recording', () => {
  let ns: MockNamespace
  let adapter: DOSqliteAdapter

  beforeEach(async () => {
    ns = new MockNamespace()
    adapter = new DOSqliteAdapter({
      namespace: ns,
      sharding: 'per-cascade',
      defaultCascadeId: 'c-svo',
    })
  })

  it('recordAction returns a persisted SVO Action with id, createdAt, status', async () => {
    const action = await adapter.recordAction({
      verb: 'create',
      subject: 'priya',
      object: 'refund-123',
    })
    expect(action.id).toBeDefined()
    expect(action.verb).toBe('create')
    expect(action.subject).toBe('priya')
    expect(action.object).toBe('refund-123')
    expect(action.status).toBe('completed')
    expect(action.createdAt).toBeInstanceOf(Date)
  })

  it('queryActions returns recorded actions ordered by createdAt asc', async () => {
    await adapter.recordAction({ verb: 'approve', subject: 'priya', object: 'r1' })
    await adapter.recordAction({ verb: 'approve', subject: 'priya', object: 'r2' })
    const actions = await adapter.queryActions({ subject: 'priya' })
    expect(actions).toHaveLength(2)
    expect(actions[0]!.createdAt.getTime() <= actions[1]!.createdAt.getTime()).toBe(true)
  })

  it('queryActions filters by verb', async () => {
    await adapter.recordAction({ verb: 'approve', subject: 'priya', object: 'r1' })
    await adapter.recordAction({ verb: 'reject', subject: 'priya', object: 'r2' })
    const approves = await adapter.queryActions({ verb: 'approve' })
    expect(approves).toHaveLength(1)
    expect(approves[0]!.verb).toBe('approve')
  })

  it('queryActions filters by Frame role values', async () => {
    await adapter.recordAction({
      verb: 'send',
      subject: 'priya',
      object: 'msg-1',
      roles: { recipient: 'jamal', source: 'priya@x.com' },
    })
    await adapter.recordAction({
      verb: 'send',
      subject: 'priya',
      object: 'msg-2',
      roles: { recipient: 'kim', source: 'priya@x.com' },
    })
    const toJamal = await adapter.queryActions({ role: { recipient: 'jamal' } })
    expect(toJamal).toHaveLength(1)
    expect(toJamal[0]!.object).toBe('msg-1')
  })

  it('queryActions filters by status', async () => {
    await adapter.recordAction({ verb: 'process', status: 'pending', subject: 'sys' })
    await adapter.recordAction({ verb: 'process', status: 'completed', subject: 'sys' })
    const completed = await adapter.queryActions({ status: 'completed' })
    expect(completed).toHaveLength(1)
    expect(completed[0]!.status).toBe('completed')
  })

  it('queryActions paginates with limit/offset', async () => {
    for (let i = 0; i < 5; i++) {
      await adapter.recordAction({ verb: 'tick', subject: 'sys', data: { n: i } })
    }
    const page = await adapter.queryActions({ limit: 2, offset: 1 })
    expect(page).toHaveLength(2)
  })
})

describe('DOSqliteAdapter — Verb registry', () => {
  let adapter: DOSqliteAdapter

  beforeEach(() => {
    adapter = new DOSqliteAdapter({
      namespace: new MockNamespace(),
      sharding: 'per-cascade',
      defaultCascadeId: 'c-verbs',
    })
  })

  it('defineVerb persists a verb with conjugations', async () => {
    const v = await adapter.defineVerb({ name: 'approve' })
    expect(v.name).toBe('approve')
    expect(v.action).toBe('approve')
    expect(v.act).toBe('approves')
    expect(v.activity).toBe('approveing')
    expect(v.event).toBe('approve')
  })

  it('defineVerb honors explicit conjugations', async () => {
    const v = await adapter.defineVerb({
      name: 'create',
      action: 'create',
      act: 'creates',
      activity: 'creating',
      event: 'create',
    })
    expect(v.act).toBe('creates')
    expect(v.activity).toBe('creating')
  })

  it('defineVerb is idempotent on identical conjugations', async () => {
    await adapter.defineVerb({ name: 'create', act: 'creates', activity: 'creating' })
    const again = await adapter.defineVerb({
      name: 'create',
      act: 'creates',
      activity: 'creating',
    })
    expect(again.name).toBe('create')
  })

  it('defineVerb rejects on conflicting conjugations', async () => {
    await adapter.defineVerb({ name: 'create', act: 'creates', activity: 'creating' })
    await expect(
      adapter.defineVerb({ name: 'create', act: 'creates', activity: 'making' })
    ).rejects.toThrow(/conflicting conjugations/)
  })

  it('getVerb returns null for an unregistered verb', async () => {
    expect(await adapter.getVerb('unknown')).toBeNull()
  })

  it('listVerbs returns every registered verb', async () => {
    await adapter.defineVerb({ name: 'create' })
    await adapter.defineVerb({ name: 'update' })
    await adapter.defineVerb({ name: 'delete' })
    const verbs = await adapter.listVerbs()
    expect(verbs.map((v) => v.name).sort()).toEqual(['create', 'delete', 'update'])
  })
})

describe('DOSqliteAdapter — factory', () => {
  it('createDOSqliteAdapter constructs an adapter equivalent to the class', () => {
    const ns = new MockNamespace()
    const adapter = createDOSqliteAdapter({
      namespace: ns,
      defaultCascadeId: 'c1',
    })
    expect(adapter).toBeInstanceOf(DOSqliteAdapter)
    expect(adapter.capabilities.adapter).toBe('do-sqlite')
  })

  it('throws when constructed without a namespace', () => {
    expect(() => new DOSqliteAdapter({ namespace: undefined as never })).toThrow(/namespace/)
  })

  it('throws on an unknown sharding string', () => {
    expect(
      () =>
        new DOSqliteAdapter({
          namespace: new MockNamespace(),
          sharding: 'unknown' as never,
        })
    ).toThrow(/unknown sharding strategy/)
  })
})

// =============================================================================
// Tests — Tier 4 vector search via Vectorize sidecar
// =============================================================================

interface VectorizeCall {
  vector: number[]
  options?: {
    topK?: number
    returnMetadata?: boolean | 'all' | 'indexed'
    namespace?: string
    filter?: Record<string, unknown>
  }
}

class FakeVectorize implements VectorizeIndexLike {
  readonly calls: VectorizeCall[] = []
  result: VectorizeQueryResultLike = { matches: [] }

  async query(
    vector: number[],
    options?: {
      topK?: number
      returnMetadata?: boolean | 'all' | 'indexed'
      namespace?: string
      filter?: Record<string, unknown>
    }
  ): Promise<VectorizeQueryResultLike> {
    this.calls.push({ vector, ...(options !== undefined && { options }) })
    return this.result
  }
}

describe('DOSqliteAdapter — Tier 4 vector search (Vectorize sidecar)', () => {
  describe('without binding', () => {
    it('does not declare vectorSearch capability', () => {
      const adapter = new DOSqliteAdapter({
        namespace: new MockNamespace(),
        defaultCascadeId: 'c1',
      })
      expect(adapter.capabilities.vectorSearch).toBeUndefined()
    })

    it('does not pass hasVectorSearch type guard', () => {
      const adapter = new DOSqliteAdapter({
        namespace: new MockNamespace(),
        defaultCascadeId: 'c1',
      })
      expect(hasVectorSearch(adapter)).toBe(false)
    })

    it('throws VectorSearchUnavailableError when calling vectorSearch', async () => {
      const adapter = new DOSqliteAdapter({
        namespace: new MockNamespace(),
        defaultCascadeId: 'c1',
      })
      await expect(adapter.vectorSearch('Document', [1, 0])).rejects.toThrow(
        VectorSearchUnavailableError
      )
      await expect(adapter.vectorSearch('Document', [1, 0])).rejects.toThrow(/Vectorize binding/)
    })
  })

  describe('with binding', () => {
    let ns: MockNamespace
    let vectorize: FakeVectorize
    let adapter: DOSqliteAdapter

    beforeEach(() => {
      ns = new MockNamespace()
      vectorize = new FakeVectorize()
      adapter = new DOSqliteAdapter({
        namespace: ns,
        defaultCascadeId: 'c1',
        vectorize,
      })
    })

    it('declares vectorSearch capability with sidecar implementation', () => {
      const caps = adapter.capabilities
      expect(caps.vectorSearch).toBeDefined()
      expect(caps.vectorSearch?.implementation).toBe('sidecar')
      expect(caps.vectorSearch?.metrics).toContain('cosine')
      expect(caps.vectorSearch?.maxDimensions).toBe(1536)
    })

    it('respects custom vectorizeDimensions', () => {
      const a = new DOSqliteAdapter({
        namespace: new MockNamespace(),
        defaultCascadeId: 'c1',
        vectorize: new FakeVectorize(),
        vectorizeDimensions: 768,
      })
      expect(a.capabilities.vectorSearch?.maxDimensions).toBe(768)
    })

    it('passes hasVectorSearch type guard', () => {
      expect(hasVectorSearch(adapter)).toBe(true)
    })

    it('delegates vectorSearch to the binding query() with topK and metadata flag', async () => {
      vectorize.result = {
        matches: [
          {
            id: 'd1',
            score: 0.95,
            metadata: { type: 'Document', data: { title: 'Alpha' } },
          },
        ],
      }
      const hits = await adapter.vectorSearch('Document', [1, 0, 0], { limit: 5 })
      expect(vectorize.calls).toHaveLength(1)
      expect(vectorize.calls[0]?.vector).toEqual([1, 0, 0])
      expect(vectorize.calls[0]?.options?.topK).toBe(5)
      expect(vectorize.calls[0]?.options?.returnMetadata).toBe(true)
      expect(hits).toHaveLength(1)
      expect(hits[0]?.entity['$id']).toBe('d1')
      expect(hits[0]?.entity['$type']).toBe('Document')
      expect(hits[0]?.entity['title']).toBe('Alpha')
      expect(hits[0]?.score).toBe(0.95)
    })

    it('forwards vectorizeNamespace through to the binding', async () => {
      const a = new DOSqliteAdapter({
        namespace: new MockNamespace(),
        defaultCascadeId: 'c1',
        vectorize,
        vectorizeNamespace: 'tenant-9',
      })
      vectorize.result = { matches: [] }
      await a.vectorSearch('Document', [1, 0])
      expect(vectorize.calls[0]?.options?.namespace).toBe('tenant-9')
    })

    it('skips matches whose metadata type does not match the requested type', async () => {
      vectorize.result = {
        matches: [
          {
            id: 'a1',
            score: 0.9,
            metadata: { type: 'Article', data: { headline: 'Other' } },
          },
          {
            id: 'd1',
            score: 0.85,
            metadata: { type: 'Document', data: { title: 'Hit' } },
          },
        ],
      }
      const hits = await adapter.vectorSearch('Document', [1, 0])
      expect(hits).toHaveLength(1)
      expect(hits[0]?.entity['$id']).toBe('d1')
    })

    it('falls back to DO get() when match metadata is missing', async () => {
      // Seed a Document in the resolved DO shard.
      await adapter.create('Document', 'd1', { title: 'Seeded' })
      vectorize.result = {
        matches: [{ id: 'd1', score: 0.7 }], // no metadata
      }
      const hits = await adapter.vectorSearch('Document', [1, 0])
      expect(hits).toHaveLength(1)
      expect(hits[0]?.entity['$id']).toBe('d1')
      expect(hits[0]?.entity['title']).toBe('Seeded')
      expect(hits[0]?.score).toBe(0.7)
    })

    it('filters by minScore', async () => {
      vectorize.result = {
        matches: [
          { id: 'd1', score: 0.9, metadata: { type: 'Document', data: { title: 'A' } } },
          { id: 'd2', score: 0.4, metadata: { type: 'Document', data: { title: 'B' } } },
        ],
      }
      const hits = await adapter.vectorSearch('Document', [1, 0], { minScore: 0.5 })
      expect(hits).toHaveLength(1)
      expect(hits[0]?.entity['$id']).toBe('d1')
    })

    it('rejects empty embeddings', async () => {
      await expect(adapter.vectorSearch('Document', [])).rejects.toThrow(/non-empty/)
    })

    it('rejects NaN/Infinity values', async () => {
      await expect(adapter.vectorSearch('Document', [1, NaN])).rejects.toThrow(/finite/)
    })

    it('default topK is 10 when limit is omitted', async () => {
      vectorize.result = { matches: [] }
      await adapter.vectorSearch('Document', [1, 0])
      expect(vectorize.calls[0]?.options?.topK).toBe(10)
    })

    it('preserves vectorize binding across withCascade()', () => {
      const bound = adapter.withCascade('c2')
      expect(bound.capabilities.vectorSearch).toBeDefined()
    })
  })
})
