/**
 * Tests for the DBProvider port refinement (ADR-0003).
 *
 * Validates that:
 * - The capability declaration shape is well-formed.
 * - The default-capability fallback works for adapters that don't declare.
 * - Type guards (`hasActionRecording`, `hasVerbRegistry`, `hasVectorSearch`,
 *   `hasAnalytics`) correctly route between adapters that do and don't
 *   implement the optional surfaces.
 * - The existing MemoryProvider continues to satisfy the (refined) port
 *   without modification.
 * - An adapter that declares richer capabilities (synthesized in this test
 *   for port-shape validation only) is detected correctly.
 */

import { describe, it, expect } from 'vitest'
import { createMemoryProvider, MemoryProvider } from '../src/memory-provider.js'
import type {
  DBProvider,
  DBProviderPort,
  ProviderTierCapabilities,
  SVOAction,
  ActionQuery,
  VectorSearchHit,
  VerbRecord,
} from '../src/index.js'
import {
  DEFAULT_TIER_CAPABILITIES,
  getProviderCapabilities,
  hasActionRecording,
  hasVerbRegistry,
  hasVectorSearch,
  hasAnalytics,
} from '../src/index.js'

// =============================================================================
// Default capability fallback
// =============================================================================

describe('DBProvider port — default capabilities', () => {
  it('returns default capabilities for an adapter that does not declare any', () => {
    const provider = createMemoryProvider()
    const caps = getProviderCapabilities(provider)

    expect(caps.shardingModel).toBe('unsharded')
    expect(caps.analytics).toBeUndefined()
    expect(caps.vectorSearch).toBeUndefined()
    expect(caps.hasActionRecording).toBe(false)
    expect(caps.hasVerbRegistry).toBe(false)
  })

  it('exposes a constant DEFAULT_TIER_CAPABILITIES with the documented shape', () => {
    expect(DEFAULT_TIER_CAPABILITIES.shardingModel).toBe('unsharded')
    expect(DEFAULT_TIER_CAPABILITIES.adapter).toBe('unknown')
    expect(DEFAULT_TIER_CAPABILITIES.analytics).toBeUndefined()
    expect(DEFAULT_TIER_CAPABILITIES.vectorSearch).toBeUndefined()
  })
})

// =============================================================================
// Backward compatibility — MemoryProvider still satisfies DBProvider
// =============================================================================

describe('DBProvider port — backward compatibility', () => {
  it('MemoryProvider satisfies the DBProvider structural shape unchanged', async () => {
    const provider: DBProvider = createMemoryProvider()

    // Tier 1: entity CRUD
    const created = await provider.create('Customer', 'c1', { name: 'Acme' })
    expect(created.$id).toBe('c1')
    expect(created.$type).toBe('Customer')

    const fetched = await provider.get('Customer', 'c1')
    expect(fetched).not.toBeNull()
    expect((fetched as Record<string, unknown>).name).toBe('Acme')

    const list = await provider.list('Customer')
    expect(list.length).toBe(1)

    const updated = await provider.update('Customer', 'c1', { name: 'Acme Inc.' })
    expect(updated.name).toBe('Acme Inc.')

    // Tier 2: graph traversal
    await provider.create('Order', 'o1', { total: 100 })
    await provider.relate('Order', 'o1', 'placedBy', 'Customer', 'c1')
    const placedBy = await provider.related('Order', 'o1', 'placedBy')
    expect(placedBy.length).toBe(1)

    await provider.unrelate('Order', 'o1', 'placedBy', 'Customer', 'c1')
    const afterUnrelate = await provider.related('Order', 'o1', 'placedBy')
    expect(afterUnrelate.length).toBe(0)

    const deleted = await provider.delete('Customer', 'c1')
    expect(deleted).toBe(true)
  })

  it('MemoryProvider type-guards as not having Tier 3/4 or SVO surfaces', () => {
    const provider = createMemoryProvider()

    expect(hasActionRecording(provider)).toBe(false)
    expect(hasVerbRegistry(provider)).toBe(false)
    expect(hasVectorSearch(provider)).toBe(false)
    expect(hasAnalytics(provider)).toBe(false)
  })
})

// =============================================================================
// Static-capability adapter (declared via property)
// =============================================================================

class StaticCapabilityAdapter implements DBProviderPort {
  readonly capabilities: ProviderTierCapabilities = {
    adapter: 'test-static',
    shardingModel: 'partitioned-by-tenant',
    analytics: { hasAggregations: true, hasTimeSeries: false, hasLargeScans: true },
    vectorSearch: {
      maxDimensions: 1536,
      metrics: ['cosine', 'l2'],
      implementation: 'native',
    },
    hasActionRecording: false,
    hasVerbRegistry: false,
  }

  async get() {
    return null
  }
  async list() {
    return []
  }
  async search() {
    return []
  }
  async create(type: string, id: string | undefined, data: Record<string, unknown>) {
    return { $id: id ?? 'gen', $type: type, ...data }
  }
  async update(type: string, id: string, data: Record<string, unknown>) {
    return { $id: id, $type: type, ...data }
  }
  async delete() {
    return true
  }
  async related() {
    return []
  }
  async relate() {
    /* noop */
  }
  async unrelate() {
    /* noop */
  }
}

describe('DBProvider port — static capability declaration', () => {
  it('reads declared capabilities from a property', () => {
    const adapter = new StaticCapabilityAdapter()
    const caps = getProviderCapabilities(adapter)

    expect(caps.adapter).toBe('test-static')
    expect(caps.shardingModel).toBe('partitioned-by-tenant')
    expect(caps.analytics?.hasAggregations).toBe(true)
    expect(caps.analytics?.hasTimeSeries).toBe(false)
    expect(caps.vectorSearch?.maxDimensions).toBe(1536)
    expect(caps.vectorSearch?.metrics).toContain('cosine')
    expect(caps.vectorSearch?.implementation).toBe('native')
  })
})

// =============================================================================
// Getter-style capability declaration
// =============================================================================

describe('DBProvider port — getter capability declaration', () => {
  it('reads declared capabilities from a function', () => {
    const adapter: DBProviderPort = {
      ...new StaticCapabilityAdapter(),
      capabilities: () => ({
        adapter: 'test-getter',
        shardingModel: 'per-cascade',
        hasActionRecording: true,
      }),
    }

    const caps = getProviderCapabilities(adapter)
    expect(caps.adapter).toBe('test-getter')
    expect(caps.shardingModel).toBe('per-cascade')
    expect(caps.hasActionRecording).toBe(true)
  })
})

// =============================================================================
// SVO Action recording — type-guard routes correctly
// =============================================================================

class ActionRecordingAdapter implements DBProviderPort {
  readonly capabilities: ProviderTierCapabilities = {
    adapter: 'test-svo',
    shardingModel: 'unsharded',
    hasActionRecording: true,
    hasVerbRegistry: true,
  }

  private actions = new Map<string, SVOAction>()
  private verbs = new Map<string, VerbRecord>()
  private idCounter = 0

  async get() {
    return null
  }
  async list() {
    return []
  }
  async search() {
    return []
  }
  async create(type: string, id: string | undefined, data: Record<string, unknown>) {
    return { $id: id ?? 'gen', $type: type, ...data }
  }
  async update(type: string, id: string, data: Record<string, unknown>) {
    return { $id: id, $type: type, ...data }
  }
  async delete() {
    return true
  }
  async related() {
    return []
  }
  async relate() {
    /* noop */
  }
  async unrelate() {
    /* noop */
  }

  async recordAction<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<SVOAction<T>, 'id' | 'createdAt' | 'status'> & { status?: SVOAction['status'] }
  ): Promise<SVOAction<T>> {
    const id = `a-${++this.idCounter}`
    const action: SVOAction<T> = {
      id,
      verb: input.verb,
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.object !== undefined && { object: input.object }),
      ...(input.roles !== undefined && { roles: input.roles }),
      ...(input.data !== undefined && { data: input.data }),
      status: input.status ?? 'pending',
      createdAt: new Date(),
    }
    this.actions.set(id, action as SVOAction)
    return action
  }

  async queryActions<T extends Record<string, unknown> = Record<string, unknown>>(
    query: ActionQuery = {}
  ): Promise<SVOAction<T>[]> {
    let results = [...this.actions.values()] as SVOAction<T>[]
    if (query.verb !== undefined) results = results.filter((a) => a.verb === query.verb)
    if (query.subject !== undefined) results = results.filter((a) => a.subject === query.subject)
    if (query.object !== undefined) results = results.filter((a) => a.object === query.object)
    if (query.role) {
      for (const [role, value] of Object.entries(query.role)) {
        results = results.filter((a) => a.roles?.[role as keyof typeof a.roles] === value)
      }
    }
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status]
      results = results.filter((a) => statuses.includes(a.status))
    }
    // Sort by createdAt ascending per documented invariant
    results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    if (query.offset) results = results.slice(query.offset)
    if (query.limit !== undefined) results = results.slice(0, query.limit)
    return results
  }

  async defineVerb(def: { name: string; description?: string }): Promise<VerbRecord> {
    const verb: VerbRecord = {
      name: def.name,
      action: def.name,
      act: `${def.name}s`,
      activity: `${def.name}ing`,
      event: `${def.name}d`,
      ...(def.description !== undefined && { description: def.description }),
      createdAt: new Date(),
    }
    this.verbs.set(def.name, verb)
    return verb
  }

  async getVerb(name: string): Promise<VerbRecord | null> {
    return this.verbs.get(name) ?? null
  }

  async listVerbs(): Promise<VerbRecord[]> {
    return [...this.verbs.values()]
  }
}

describe('DBProvider port — SVO Action recording surface', () => {
  it('hasActionRecording type-guard returns true for an adapter implementing it', () => {
    const adapter = new ActionRecordingAdapter()
    expect(hasActionRecording(adapter)).toBe(true)
  })

  it('records and queries Actions with Frame roles', async () => {
    const adapter = new ActionRecordingAdapter()

    const a1 = await adapter.recordAction({
      verb: 'approve',
      subject: 'priya',
      object: 'refund-123',
      roles: { recipient: 'customer-9', manner: 'courteously' },
      data: { amount: 100 },
    })

    expect(a1.id).toBeDefined()
    expect(a1.verb).toBe('approve')
    expect(a1.subject).toBe('priya')
    expect(a1.object).toBe('refund-123')
    expect(a1.roles?.recipient).toBe('customer-9')
    expect(a1.roles?.manner).toBe('courteously')
    expect(a1.status).toBe('pending')
    expect(a1.createdAt).toBeInstanceOf(Date)

    // Slight delay so Action 2 has a strictly later createdAt
    await new Promise((resolve) => setTimeout(resolve, 2))

    await adapter.recordAction({
      verb: 'approve',
      subject: 'priya',
      object: 'refund-456',
    })

    const byVerb = await adapter.queryActions({ verb: 'approve' })
    expect(byVerb.length).toBe(2)

    const byObject = await adapter.queryActions({ object: 'refund-123' })
    expect(byObject.length).toBe(1)
    expect(byObject[0]?.id).toBe(a1.id)

    const byRole = await adapter.queryActions({ role: { recipient: 'customer-9' } })
    expect(byRole.length).toBe(1)
    expect(byRole[0]?.id).toBe(a1.id)

    const limited = await adapter.queryActions({ limit: 1 })
    expect(limited.length).toBe(1)
  })

  it('hasVerbRegistry type-guard returns true and registry round-trips', async () => {
    const adapter = new ActionRecordingAdapter()
    expect(hasVerbRegistry(adapter)).toBe(true)

    await adapter.defineVerb({ name: 'approve', description: 'approve a refund' })
    const v = await adapter.getVerb('approve')
    expect(v?.name).toBe('approve')
    expect(v?.act).toBe('approves')
    expect(v?.activity).toBe('approveing')

    const all = await adapter.listVerbs()
    expect(all.length).toBe(1)

    const missing = await adapter.getVerb('nonexistent')
    expect(missing).toBeNull()
  })
})

// =============================================================================
// Tier 4 vector search type guard
// =============================================================================

class VectorSearchAdapter implements DBProviderPort {
  readonly capabilities: ProviderTierCapabilities = {
    adapter: 'test-vector',
    shardingModel: 'unsharded',
    vectorSearch: {
      maxDimensions: 768,
      metrics: ['cosine'],
      implementation: 'native',
    },
  }

  async get() {
    return null
  }
  async list() {
    return []
  }
  async search() {
    return []
  }
  async create(type: string, id: string | undefined, data: Record<string, unknown>) {
    return { $id: id ?? 'gen', $type: type, ...data }
  }
  async update(type: string, id: string, data: Record<string, unknown>) {
    return { $id: id, $type: type, ...data }
  }
  async delete() {
    return true
  }
  async related() {
    return []
  }
  async relate() {
    /* noop */
  }
  async unrelate() {
    /* noop */
  }

  async vectorSearch<T extends Record<string, unknown> = Record<string, unknown>>(
    type: string,
    queryEmbedding: number[]
  ): Promise<VectorSearchHit<T>[]> {
    expect(queryEmbedding.length).toBeLessThanOrEqual(this.capabilities.vectorSearch!.maxDimensions)
    return [
      {
        entity: { $id: 'p-1', $type: type } as T & { $id: string; $type: string },
        score: 0.9,
      },
    ]
  }
}

describe('DBProvider port — Tier 4 vector search', () => {
  it('hasVectorSearch type-guard requires both runtime method and capability declaration', () => {
    const adapter = new VectorSearchAdapter()
    expect(hasVectorSearch(adapter)).toBe(true)

    const caps = getProviderCapabilities(adapter)
    expect(caps.vectorSearch?.maxDimensions).toBe(768)
    expect(caps.vectorSearch?.metrics).toEqual(['cosine'])
    expect(caps.vectorSearch?.implementation).toBe('native')
  })

  it('routes a vector search through the typed surface', async () => {
    const adapter = new VectorSearchAdapter()
    if (!hasVectorSearch(adapter)) throw new Error('expected vector-search-capable adapter')

    const hits = await adapter.vectorSearch('Post', new Array(768).fill(0))
    expect(hits.length).toBe(1)
    expect(hits[0]?.entity.$id).toBe('p-1')
    expect(hits[0]?.score).toBeCloseTo(0.9)
  })

  it('rejects vector search if the adapter has the method but no capability declaration', () => {
    // Method-only without capability declaration should fail the guard.
    const stub: DBProviderPort & { vectorSearch?: () => Promise<unknown> } = {
      ...new StaticCapabilityAdapter(),
      capabilities: { adapter: 'no-decl', shardingModel: 'unsharded' },
      vectorSearch: async () => [],
    }
    expect(hasVectorSearch(stub)).toBe(false)
  })
})

// =============================================================================
// Sharding model declarations
// =============================================================================

describe('DBProvider port — sharding model', () => {
  it('declares per-cascade for a DO-style adapter', () => {
    const doStyle: DBProviderPort = {
      ...new StaticCapabilityAdapter(),
      capabilities: { adapter: 'do-sqlite', shardingModel: 'per-cascade' },
    }
    expect(getProviderCapabilities(doStyle).shardingModel).toBe('per-cascade')
  })

  it('declares partitioned-by-tenant for a multi-tenant PG adapter', () => {
    const pg: DBProviderPort = {
      ...new StaticCapabilityAdapter(),
      capabilities: { adapter: 'pg+pgvector', shardingModel: 'partitioned-by-tenant' },
    }
    expect(getProviderCapabilities(pg).shardingModel).toBe('partitioned-by-tenant')
  })

  it('accepts a custom sharding string for forward compatibility', () => {
    const custom: DBProviderPort = {
      ...new StaticCapabilityAdapter(),
      capabilities: { adapter: 'experimental', shardingModel: 'per-tenant-do' },
    }
    expect(getProviderCapabilities(custom).shardingModel).toBe('per-tenant-do')
  })
})

// =============================================================================
// MemoryProvider remains assignable to the structural DBProvider interface
// =============================================================================

describe('DBProvider port — MemoryProvider satisfies the refined port', () => {
  it('MemoryProvider is assignable to DBProviderPort', () => {
    const provider: DBProviderPort = createMemoryProvider()
    expect(provider).toBeInstanceOf(MemoryProvider)
    // capabilities is optional; absent on MemoryProvider today (acceptable).
    expect(getProviderCapabilities(provider).shardingModel).toBe('unsharded')
  })
})
