/**
 * aip-jo1o.3 — the live pg+ch `FindOrCreateBackend` (unit-tested against a fake
 * adapter, no live DB).
 *
 * The generic backend (`createDBFindBackend`, aip-jo1o.1/.2) rode the provider's
 * `semanticSearch` plus an O(n) `list()` exact scan. This suite drives out the
 * OPTIMIZED backend over the real pg/ch adapter capability surface:
 *
 *  - `exactLookup`  — server-side narrowing via `adapter.search` (ILIKE pushed to
 *    the DB), then an exact normalized-key verify client-side — NOT a full `list()`
 *    table scan.
 *  - `lexicalSearch` — the adapter's keyword `search` (ILIKE substring) scored by
 *    token overlap. (True tsvector FTS is not yet exposed by the adapters — see the
 *    note in find-or-create.ts.)
 *  - `embed`        — the injected ai-functions embeddings socket (`embedText`),
 *    mode-aware (asymmetric-match vs symmetric-collapse).
 *  - `vectorSearch` — pgvector / CH ANN via `adapter.vectorSearch` (cosine).
 *  - `create`       — `provider.create` + embed-on-write via `upsertEmbedding`.
 *  - `get` / `addProvenance` — via the provider.
 *
 * The fake adapter below structurally satisfies the minimal `LiveFindAdapter` port
 * (the subset of the pg/ch surface the live backend depends on). Genuine end-to-end
 * pg/ch integration is `describe.skip`-gated (needs live infra).
 */
import { describe, it, expect, vi } from 'vitest'
import { createFindPorts, findOrCreate } from '../src/find-or-create.js'
import {
  createLiveDBFindBackend,
  isLiveVectorAdapter,
  type LiveFindAdapter,
} from '../src/find-or-create.js'
import type { GateMode } from 'ai-functions/find-or-create'

// ---------------------------------------------------------------------------
// A fake adapter that mirrors the pg/ch capability surface the live backend
// rides: vectorSearch (cosine, higher-is-better), search (ILIKE substring),
// list, get, create, upsertEmbedding, + a capabilities declaration.
// ---------------------------------------------------------------------------

interface Stored {
  id: string
  type: string
  data: Record<string, unknown>
  embedding?: number[]
}

function cosine(a: readonly number[], b: readonly number[]): number {
  const n = Math.max(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

class FakeVectorAdapter implements LiveFindAdapter {
  rows: Stored[] = []
  private seq = 0
  searchCalls: Array<{ type: string; query: string }> = []
  listCalls = 0
  vectorCalls = 0

  get capabilities() {
    return {
      adapter: 'fake+pgvector',
      shardingModel: 'unsharded' as const,
      vectorSearch: { maxDimensions: 8, metrics: ['cosine' as const], implementation: 'native' as const },
      hasActionRecording: false,
      hasVerbRegistry: false,
    }
  }

  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    const row = this.rows.find((r) => r.type === type && r.id === id)
    return row ? { ...row.data, $id: row.id, $type: row.type } : null
  }

  async list(type: string): Promise<Record<string, unknown>[]> {
    this.listCalls += 1
    return this.rows
      .filter((r) => r.type === type)
      .map((r) => ({ ...r.data, $id: r.id, $type: r.type }))
  }

  async search(type: string, query: string): Promise<Record<string, unknown>[]> {
    this.searchCalls.push({ type, query })
    // Mimic pg/ch ILIKE substring over the jsonb-as-text representation.
    const needle = query.toLowerCase()
    return this.rows
      .filter((r) => r.type === type && JSON.stringify(r.data).toLowerCase().includes(needle))
      .map((r) => ({ ...r.data, $id: r.id, $type: r.type }))
  }

  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const entityId = id ?? `${type.toLowerCase()}-${++this.seq}`
    this.rows.push({ id: entityId, type, data: { ...data } })
    return { ...data, $id: entityId, $type: type }
  }

  async upsertEmbedding(type: string, id: string, embedding: readonly number[]): Promise<void> {
    const row = this.rows.find((r) => r.type === type && r.id === id)
    if (row) row.embedding = [...embedding]
  }

  async vectorSearch(
    type: string,
    queryEmbedding: number[],
    options?: { metric?: string; limit?: number; minScore?: number }
  ): Promise<Array<{ entity: Record<string, unknown> & { $id: string; $type: string }; score: number }>> {
    this.vectorCalls += 1
    const limit = options?.limit ?? 10
    const hits = this.rows
      .filter((r) => r.type === type && r.embedding)
      .map((r) => ({
        entity: { ...r.data, $id: r.id, $type: r.type },
        score: cosine(queryEmbedding, r.embedding!),
      }))
      .sort((p, q) => q.score - p.score)
    return hits.slice(0, limit)
  }
}

// Deterministic 8-dim bag-of-words embed, mode aware (collapse mean-centers).
function makeEmbed() {
  const vocab = new Map<string, number>()
  return vi.fn(async (text: string, mode: GateMode): Promise<number[]> => {
    const tokens = text.toLowerCase().trim().split(/\s+/).filter(Boolean)
    for (const t of tokens) if (!vocab.has(t)) vocab.set(t, vocab.size % 8)
    const vec = new Array(8).fill(0)
    for (const t of tokens) vec[vocab.get(t)!] += 1
    if (mode === 'symmetric-collapse') {
      const mean = vec.reduce((a, b) => a + b, 0) / vec.length
      return vec.map((v) => v - mean)
    }
    return vec
  })
}

const band = { autoLink: 0.9, judgeFloor: 0.75 }

describe('isLiveVectorAdapter — capability detection', () => {
  it('detects an adapter that advertises vectorSearch capability + method', () => {
    expect(isLiveVectorAdapter(new FakeVectorAdapter())).toBe(true)
  })

  it('rejects a provider with no vectorSearch method', () => {
    const plain = {
      async get() {
        return null
      },
      async list() {
        return []
      },
      async search() {
        return []
      },
      async create() {
        return {}
      },
      async update() {
        return {}
      },
      async delete() {
        return false
      },
      async related() {
        return []
      },
      async relate() {},
      async unrelate() {},
    }
    expect(isLiveVectorAdapter(plain as never)).toBe(false)
  })

  it('rejects an adapter with a vectorSearch method but no capability declaration', () => {
    const noCaps = {
      ...new FakeVectorAdapter(),
      capabilities: { adapter: 'x', shardingModel: 'unsharded' as const, hasActionRecording: false, hasVerbRegistry: false },
    }
    expect(isLiveVectorAdapter(noCaps as never)).toBe(false)
  })
})

describe('createLiveDBFindBackend — exact tier (server-side narrowed, not full scan)', () => {
  it('finds an exact normalized-name match via adapter.search, not list()', async () => {
    const adapter = new FakeVectorAdapter()
    const created = await adapter.create('Problem', undefined, { name: 'Keep audit trails accurate' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })

    const id = await backend.exactLookup('Problem', 'keep audit trails accurate')
    expect(id).toBe(created['$id'])
    // Pushed the filter to the DB; never pulled the whole table.
    expect(adapter.searchCalls.length).toBeGreaterThan(0)
    expect(adapter.listCalls).toBe(0)
  })

  it('matches on an explicit normalized key field', async () => {
    const adapter = new FakeVectorAdapter()
    const sku = await adapter.create('SKU', undefined, { code: 'ABC-123', key: 'abc-123' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const id = await backend.exactLookup('SKU', 'abc-123')
    expect(id).toBe(sku['$id'])
  })

  it('returns null when no row matches the normalized key exactly (ILIKE superset rejected)', async () => {
    const adapter = new FakeVectorAdapter()
    // 'audit trail' is an ILIKE substring of 'audit trails' but NOT an exact key.
    await adapter.create('Problem', undefined, { name: 'Keep audit trails accurate' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const id = await backend.exactLookup('Problem', 'keep audit trail')
    expect(id).toBeNull()
  })
})

describe('createLiveDBFindBackend — lexical tier (adapter keyword search)', () => {
  it('scores keyword hits by token overlap, best-first', async () => {
    const adapter = new FakeVectorAdapter()
    await adapter.create('Doc', undefined, { name: 'neural network training' })
    await adapter.create('Doc', undefined, { name: 'neural pasta recipe' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const hits = await backend.lexicalSearch('Doc', 'neural network', 10)
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0]!.score).toBeGreaterThan(0)
    // The 'neural network training' row should rank first (2-token overlap).
    const top = await adapter.get('Doc', hits[0]!.id)
    expect(top!['name']).toBe('neural network training')
  })

  it('returns [] for empty query text', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    expect(await backend.lexicalSearch('Doc', '   ', 10)).toEqual([])
  })
})

describe('createLiveDBFindBackend — embed tier (mode-aware ai-functions socket)', () => {
  it('routes symmetric-collapse to the collapse mode (mean-centered)', async () => {
    const adapter = new FakeVectorAdapter()
    const embed = makeEmbed()
    const backend = createLiveDBFindBackend({ adapter, embed })
    await backend.embed('hello world', 'symmetric-collapse')
    expect(embed).toHaveBeenCalledWith('hello world', 'symmetric-collapse')
  })

  it('routes asymmetric-match to the match mode', async () => {
    const adapter = new FakeVectorAdapter()
    const embed = makeEmbed()
    const backend = createLiveDBFindBackend({ adapter, embed })
    await backend.embed('hello', 'asymmetric-match')
    expect(embed).toHaveBeenCalledWith('hello', 'asymmetric-match')
  })
})

describe('createLiveDBFindBackend — vector tier (pgvector/CH ANN via adapter)', () => {
  it('rides adapter.vectorSearch (cosine) and maps hits to RawHit, best-first', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    // embed-on-write so the vector tier can match
    await backend.create('Doc', { name: 'machine learning models' })
    await backend.create('Doc', { name: 'italian pasta recipe' })

    const q = await backend.embed('machine learning models', 'symmetric-collapse')
    const hits = await backend.vectorSearch('Doc', q, 'symmetric-collapse', 10)
    expect(adapter.vectorCalls).toBe(1)
    expect(hits.length).toBeGreaterThanOrEqual(1)
    const top = await adapter.get('Doc', hits[0]!.id)
    expect(top!['name']).toBe('machine learning models')
  })

  it('returns [] for an empty query embedding (never calls the adapter)', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const hits = await backend.vectorSearch('Doc', [], 'symmetric-collapse', 10)
    expect(hits).toEqual([])
    expect(adapter.vectorCalls).toBe(0)
  })
})

describe('createLiveDBFindBackend — create (embed-on-write) / get / addProvenance', () => {
  it('persists via provider.create AND writes the embedding (upsertEmbedding)', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const thing = await backend.create('Doc', { name: 'deep learning' })
    expect(thing.$id).toBeDefined()
    const row = adapter.rows.find((r) => r.id === thing.$id)
    expect(row!.embedding).toBeDefined() // embed-on-write happened
  })

  it('get loads by id; missing → null', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const thing = await backend.create('Doc', { name: 'x' })
    expect((await backend.get('Doc', thing.$id))!.$id).toBe(thing.$id)
    expect(await backend.get('Doc', 'nope')).toBeNull()
  })

  it('addProvenance is a no-op-safe call (provenance optional on the adapter)', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const thing = await backend.create('Doc', { name: 'x' })
    await expect(backend.addProvenance!('Doc', thing.$id, 'import:csv')).resolves.toBeUndefined()
  })
})

describe('createLiveDBFindBackend — end-to-end gate (mint then link)', () => {
  it('mints greenfield, then links the semantic duplicate via the vector tier', async () => {
    const adapter = new FakeVectorAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const ports = createFindPorts(backend, { thresholds: () => band })

    const first = await findOrCreate(
      {
        noun: 'Problem',
        mode: 'symmetric-collapse',
        text: 'Keep audit trails accurate',
        data: { name: 'Keep audit trails accurate' },
      },
      { ports, backend }
    )
    expect(first.decision).toBe('minted')

    // Exact normalized-name duplicate → exact tier links it.
    const dup = await findOrCreate(
      {
        noun: 'Problem',
        mode: 'symmetric-collapse',
        text: 'keep audit trails accurate',
        data: { name: 'keep audit trails accurate' },
      },
      { ports, backend }
    )
    expect(dup.decision).toBe('linked')
    expect(dup.thing!.$id).toBe(first.thing!.$id)
  })
})

// ===========================================================================
// Genuine end-to-end pg/ch integration — infra-gated (needs a live DB).
// ===========================================================================
describe.skip('createLiveDBFindBackend — live pg/ch integration (needs DATABASE_URL + pgvector/CH)', () => {
  it('exactLookup / lexicalSearch / vectorSearch against a real adapter', async () => {
    // Requires a running Postgres (pgvector) or ClickHouse instance and the
    // bootstrapped schema (things + embeddings). Run with the cluster harness;
    // not part of the hermetic unit suite. Left as a placeholder so the seam
    // is documented and easy to wire into the infra-gated cluster test pass.
    expect(true).toBe(true)
  })
})
