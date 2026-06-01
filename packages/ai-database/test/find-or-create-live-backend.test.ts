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
  hasLiveFullTextSearch,
  normalizeKey,
  type LiveFindAdapter,
  type LiveFullTextHit,
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
      vectorSearch: {
        maxDimensions: 8,
        metrics: ['cosine' as const],
        implementation: 'native' as const,
      },
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
  ): Promise<
    Array<{ entity: Record<string, unknown> & { $id: string; $type: string }; score: number }>
  > {
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

// ---------------------------------------------------------------------------
// A fake adapter that ALSO advertises ranked tsvector FTS + the normalized-key
// index (aip-j10o). It records fullTextSearch / keyLookup vs the substring
// search/list paths so we can assert the live backend routes the optimized
// lexical/exact tiers when the capability is present.
// ---------------------------------------------------------------------------
class FakeFtsAdapter extends FakeVectorAdapter {
  ftsCalls: Array<{ type: string; query: string }> = []
  keyLookupCalls: Array<{ type: string; key: string }> = []

  override get capabilities() {
    return {
      ...super.capabilities,
      adapter: 'fake+pgvector+fts',
      fullTextSearch: {
        implementation: 'tsvector' as const,
        rankedScores: true,
        hasKeyLookup: true,
      },
    }
  }

  async fullTextSearch(
    type: string,
    query: string,
    options?: { limit?: number; minScore?: number }
  ): Promise<LiveFullTextHit[]> {
    this.ftsCalls.push({ type, query })
    // Mimic websearch_to_tsquery: term-aware overlap, ts_rank normalized to [0,1].
    const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(Boolean))
    const limit = options?.limit ?? 100
    return this.rows
      .filter((r) => r.type === type)
      .map((r) => {
        const docTerms = new Set(
          JSON.stringify(r.data)
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean)
        )
        let overlap = 0
        for (const t of queryTerms) if (docTerms.has(t)) overlap += 1
        return {
          entity: { ...r.data, $id: r.id, $type: r.type },
          score: overlap === 0 ? 0 : overlap / (overlap + 1),
        }
      })
      .filter((h) => h.score > 0)
      .sort((p, q) => q.score - p.score)
      .slice(0, limit)
  }

  async keyLookup(type: string, normalizedKey: string): Promise<string | null> {
    this.keyLookupCalls.push({ type, key: normalizedKey })
    const row = this.rows.find((r) => {
      const explicit = r.data['key']
      const k =
        typeof explicit === 'string'
          ? normalizeKey(explicit)
          : normalizeKey(String(r.data['name'] ?? r.data['title'] ?? r.data['code'] ?? ''))
      return r.type === type && k === normalizedKey
    })
    return row ? row.id : null
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
      capabilities: {
        adapter: 'x',
        shardingModel: 'unsharded' as const,
        hasActionRecording: false,
        hasVerbRegistry: false,
      },
    }
    expect(isLiveVectorAdapter(noCaps as never)).toBe(false)
  })
})

describe('createLiveDBFindBackend — exact tier (server-side narrowed, not full scan)', () => {
  it('finds an exact normalized-name match via adapter.search, not list()', async () => {
    const adapter = new FakeVectorAdapter()
    const created = await adapter.create('Problem', undefined, {
      name: 'Keep audit trails accurate',
    })
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
// aip-j10o — lexical/exact tiers route through FTS + key-index when advertised.
// ===========================================================================

describe('hasLiveFullTextSearch — capability detection', () => {
  it('detects an adapter that advertises fullTextSearch capability + methods', () => {
    expect(hasLiveFullTextSearch(new FakeFtsAdapter())).toBe(true)
  })

  it('rejects a vector-only adapter (no fullTextSearch capability/methods)', () => {
    expect(hasLiveFullTextSearch(new FakeVectorAdapter())).toBe(false)
  })

  it('rejects an adapter with the methods but no capability declaration', () => {
    const base = new FakeVectorAdapter()
    const noCap: LiveFindAdapter = {
      ...base,
      // vector-only capability (no fullTextSearch), but FTS methods present.
      capabilities: () => base.capabilities,
      fullTextSearch: async () => [],
      keyLookup: async () => null,
      get: base.get.bind(base),
      list: base.list.bind(base),
      search: base.search.bind(base),
      create: base.create.bind(base),
      vectorSearch: base.vectorSearch.bind(base),
    }
    expect(hasLiveFullTextSearch(noCap)).toBe(false)
  })
})

describe('createLiveDBFindBackend — lexical tier routes through tsvector FTS (aip-j10o)', () => {
  it('calls adapter.fullTextSearch (NOT the ILIKE search path) when FTS is advertised', async () => {
    const adapter = new FakeFtsAdapter()
    await adapter.create('Doc', undefined, { name: 'neural network training' })
    await adapter.create('Doc', undefined, { name: 'neural pasta recipe' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })

    const hits = await backend.lexicalSearch('Doc', 'neural network', 10)
    expect(adapter.ftsCalls.length).toBe(1)
    expect(adapter.ftsCalls[0]!.query).toBe('neural network')
    // The substring search() path was NOT used for the lexical tier.
    expect(adapter.searchCalls.length).toBe(0)
    // Ranked FTS hands back normalized scores, best-first.
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0]!.score).toBeGreaterThan(0)
    expect(hits[0]!.score).toBeLessThanOrEqual(1)
    const top = await adapter.get('Doc', hits[0]!.id)
    expect(top!['name']).toBe('neural network training')
  })

  it('passes the multi-term query through verbatim (no anchor-token reduction)', async () => {
    const adapter = new FakeFtsAdapter()
    await adapter.create('Doc', undefined, { name: 'keep audit trails accurate' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    await backend.lexicalSearch('Doc', 'audit trails accurate', 10)
    expect(adapter.ftsCalls[0]!.query).toBe('audit trails accurate')
  })

  it('returns [] for empty query text without calling the adapter', async () => {
    const adapter = new FakeFtsAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    expect(await backend.lexicalSearch('Doc', '   ', 10)).toEqual([])
    expect(adapter.ftsCalls.length).toBe(0)
  })
})

describe('createLiveDBFindBackend — exact tier routes through the key index (aip-j10o)', () => {
  it('calls adapter.keyLookup (single probe, NOT ILIKE-narrow) when FTS is advertised', async () => {
    const adapter = new FakeFtsAdapter()
    const created = await adapter.create('Problem', undefined, {
      name: 'Keep audit trails accurate',
    })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })

    const id = await backend.exactLookup('Problem', 'keep audit trails accurate')
    expect(id).toBe(created['$id'])
    expect(adapter.keyLookupCalls.length).toBe(1)
    expect(adapter.keyLookupCalls[0]!.key).toBe('keep audit trails accurate')
    // The exact tier did NOT ILIKE-narrow or list-scan.
    expect(adapter.searchCalls.length).toBe(0)
    expect(adapter.listCalls).toBe(0)
  })

  it('returns null (and still uses the index) for a non-exact normalized key', async () => {
    const adapter = new FakeFtsAdapter()
    await adapter.create('Problem', undefined, { name: 'Keep audit trails accurate' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    expect(await backend.exactLookup('Problem', 'keep audit trail')).toBeNull()
    expect(adapter.keyLookupCalls.length).toBe(1)
  })

  it('short-circuits an empty key without calling keyLookup', async () => {
    const adapter = new FakeFtsAdapter()
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    expect(await backend.exactLookup('Problem', '')).toBeNull()
    expect(adapter.keyLookupCalls.length).toBe(0)
  })
})

describe('createLiveDBFindBackend — fallback when FTS is NOT advertised (CH/FTS-less pg)', () => {
  it('lexical tier falls back to substring search + Jaccard when no FTS capability', async () => {
    const adapter = new FakeVectorAdapter() // no fullTextSearch capability
    await adapter.create('Doc', undefined, { name: 'neural network training' })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const hits = await backend.lexicalSearch('Doc', 'neural network', 10)
    // The ILIKE search() path was used (the fallback), not FTS.
    expect(adapter.searchCalls.length).toBeGreaterThan(0)
    expect(hits.length).toBeGreaterThanOrEqual(1)
  })

  it('exact tier falls back to ILIKE-narrow + client verify when no FTS capability', async () => {
    const adapter = new FakeVectorAdapter()
    const created = await adapter.create('Problem', undefined, {
      name: 'Keep audit trails accurate',
    })
    const backend = createLiveDBFindBackend({ adapter, embed: makeEmbed() })
    const id = await backend.exactLookup('Problem', 'keep audit trails accurate')
    expect(id).toBe(created['$id'])
    expect(adapter.searchCalls.length).toBeGreaterThan(0)
  })
})

describe('createLiveDBFindBackend — end-to-end gate over an FTS adapter (aip-j10o)', () => {
  it('mints greenfield then links the exact duplicate via the key index', async () => {
    const adapter = new FakeFtsAdapter()
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
    expect(adapter.keyLookupCalls.length).toBeGreaterThan(0)
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
