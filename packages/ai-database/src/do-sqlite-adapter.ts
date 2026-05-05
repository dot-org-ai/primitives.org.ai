/**
 * DO SQLite Adapter — Stack B transactional DBProvider
 *
 * First-class adapter for **Cloudflare Durable Objects with SQLite storage**.
 * Stack B's transactional layer per ADR-0003: per-cascade DO isolation gives
 * parallel write paths each at full single-DO throughput, which is what makes
 * the cascade-heavy moat workload viable.
 *
 * ## Sharding model
 *
 * The adapter accepts a {@link DurableObjectNamespaceLike} binding plus a
 * {@link ShardingStrategy} that selects which DO id receives a given
 * operation. Two canonical strategies ship in this module:
 *
 * - **`'per-cascade'`** (default; the enabling pattern per ADR-0003) —
 *   each cascade gets its own DO; reads back during traversal stay inside
 *   the same DO (no cross-DO hot-path reads). Caller passes the cascade id
 *   via the per-operation `context.cascadeId` (or sets a default cascade
 *   on the adapter via {@link DOSqliteAdapter.withCascade}).
 *
 * - **`'per-tenant'`** — alternative for multi-tenant deployments where one
 *   tenant runs multiple cascades. Caller passes `context.tenantId`.
 *
 * Custom strategies are accepted as a `(ctx) => string` callback for
 * deployments with their own routing logic (e.g., per-day shards, per-type
 * shards, hash-based shards).
 *
 * ## Constraints (from ADR-0003)
 *
 * - **Per-DO 10GB SQLite limit** — declared via
 *   {@link DOSqliteAdapter.maxStorageBytes}. Cascade write strategy
 *   (`aip-g1i9`) consults this when fanning out.
 * - **No native vector support** — Tier 4 is sidecared via Cloudflare
 *   Vectorize. Pass a `vectorize: VectorizeIndexLike` binding to the
 *   constructor and the adapter declares the capability with
 *   `implementation: 'sidecar'`. Without it, the capability is
 *   `undefined` and `vectorSearch()` throws
 *   {@link VectorSearchUnavailableError}.
 * - **Hard to query across DOs** — Tier 3 analytics declared as `false`
 *   for all sub-fields. Cross-cascade analytics is the dual-write path
 *   (DO → Pipelines → Iceberg → ClickHouse), which is `aip-0ypt`'s concern.
 *
 * ## Wire protocol
 *
 * The adapter speaks to {@link DatabaseDO} via its existing fetch routes
 * (`/data`, `/rels`, `/query/*`, `/traverse`). This keeps the DO surface
 * untouched and matches the existing test infrastructure
 * (`@cloudflare/vitest-pool-workers`).
 *
 * @see {@link ../docs/adr/0003-storage-strategy-pg-clickhouse-default.md}
 * @see {@link ../docs/plans/2026-05-05-cascade-storage-execution-implementation.md} Phase 1
 * @packageDocumentation
 */

import type { DBProvider } from './schema/provider.js'
import type { ListOptions, SearchOptions } from './schema/types.js'
import type {
  ProviderTierCapabilities,
  ShardingModel,
  DBProviderSVO,
  SVOAction,
  ActionQuery,
  VerbDefinitionInput,
  VerbRecord,
  FrameRole,
  VectorSearchPort,
  VectorSearchHit,
  VectorSimilarityMetric,
} from './db-provider-port.js'
import { VectorSearchUnavailableError } from './errors.js'

// =============================================================================
// Cloudflare Workers shape (declared structurally so this module compiles in
// Node test environments without depending on @cloudflare/workers-types at
// runtime).
// =============================================================================

/**
 * Minimal `DurableObjectId` shape. Real Cloudflare runtime returns a
 * brand-checked object; we only need to pass it back to `.get()`.
 */
export interface DurableObjectIdLike {
  readonly name?: string
  toString(): string
}

/**
 * Minimal `DurableObjectStub` shape — only the `fetch` method we use.
 *
 * The real Cloudflare `DurableObjectStub` is a richer object; this is the
 * subset {@link DOSqliteAdapter} requires.
 */
export interface DurableObjectStubLike {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>
}

/**
 * Minimal `DurableObjectNamespace` shape — only the methods this adapter uses.
 *
 * Defined structurally so `DOSqliteAdapter` can be unit-tested with a
 * pure-JS mock namespace (no Miniflare required for adapter logic). For
 * end-to-end tests against real DO SQLite, callers wire the real
 * `env.DATABASE` namespace produced by `@cloudflare/vitest-pool-workers`.
 */
export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike
  idFromString?(name: string): DurableObjectIdLike
  newUniqueId?(): DurableObjectIdLike
  get(id: DurableObjectIdLike): DurableObjectStubLike
}

// =============================================================================
// Vectorize sidecar binding (Tier 4)
// =============================================================================
//
// DO SQLite has no native vector index — Tier 4 is sidecared via a
// Cloudflare Vectorize binding. We declare the binding shape structurally
// so this module compiles in plain Node without a hard dependency on
// `@cloudflare/workers-types`. Real bindings produced by `wrangler.toml`
// satisfy this shape at runtime.

/**
 * Shape of a single Vectorize match returned by
 * {@link VectorizeIndexLike.query}. Matches the Cloudflare runtime shape:
 * `id` is the vector id (we map this to a Thing id), `score` is the
 * similarity in the metric the index was created with, and `metadata`
 * carries arbitrary fields the caller stored at insert time.
 */
export interface VectorizeMatchLike {
  id: string
  score: number
  metadata?: Record<string, unknown>
  values?: number[]
}

/**
 * Result envelope for a Vectorize `query()` call. Cloudflare wraps
 * matches in `{ matches: [...] }` — kept here for fidelity.
 */
export interface VectorizeQueryResultLike {
  matches: VectorizeMatchLike[]
  count?: number
}

/**
 * Minimal `VectorizeIndex` shape — the subset {@link DOSqliteAdapter}
 * uses. Real Cloudflare bindings have more methods (insert, upsert,
 * deleteByIds, getByIds, describe); the adapter only needs `query()`
 * for vector search. Callers seed the index out-of-band (typically via
 * an `insert()` call at write time, wired upstream of this adapter).
 */
export interface VectorizeIndexLike {
  query(
    vector: number[],
    options?: {
      topK?: number
      returnMetadata?: boolean | 'all' | 'indexed'
      returnValues?: boolean
      filter?: Record<string, unknown>
      namespace?: string
    }
  ): Promise<VectorizeQueryResultLike>
}

// =============================================================================
// Sharding strategy
// =============================================================================

/**
 * Per-operation context the sharding strategy can consult to pick a DO id.
 *
 * The adapter populates `type` for every op (it always knows the entity
 * type). Callers populate `cascadeId`/`tenantId`/etc. via
 * {@link DOSqliteAdapter.withCascade}, {@link DOSqliteAdapter.withTenant},
 * or {@link DOSqliteAdapter.withContext} before issuing operations.
 */
export interface ShardContext {
  /** Entity type name (always present — adapter fills this). */
  type?: string
  /** Cascade id for the per-cascade strategy. */
  cascadeId?: string
  /** Tenant id for the per-tenant strategy. */
  tenantId?: string
  /** Caller-defined free-form context for custom strategies. */
  [key: string]: unknown
}

/**
 * A sharding strategy maps a {@link ShardContext} to a DO id name.
 *
 * Strategies MUST be deterministic — the same context MUST yield the
 * same id name across calls — so reads observe the writes from the same
 * shard.
 */
export type ShardingStrategy = (ctx: ShardContext) => string

/**
 * Built-in sharding strategies. Callers can also pass any
 * `(ctx) => string` callback.
 *
 * - {@link perCascade} — `ctx.cascadeId`, falling back to a default if
 *   provided to the adapter constructor. Throws if neither is set.
 * - {@link perTenant} — `ctx.tenantId`, falling back to default. Throws if
 *   neither is set.
 * - {@link perType} — `ctx.type` (every type gets its own DO). Useful for
 *   small/dev workloads where cascade isolation isn't yet wired.
 * - {@link unsharded} — always `'__shared__'`. Single DO for everything.
 *   Defeats the per-cascade isolation pattern; intended for tests and
 *   tiny workloads only.
 */
export const ShardingStrategies = {
  perCascade: (defaultCascadeId?: string): ShardingStrategy => {
    return (ctx) => {
      const id = ctx.cascadeId ?? defaultCascadeId
      if (!id) {
        throw new Error(
          'DOSqliteAdapter (per-cascade strategy): no cascadeId in context. ' +
            'Set a default via the adapter constructor, or call ' +
            'adapter.withCascade(cascadeId) before issuing operations.'
        )
      }
      return `cascade:${id}`
    }
  },

  perTenant: (defaultTenantId?: string): ShardingStrategy => {
    return (ctx) => {
      const id = ctx.tenantId ?? defaultTenantId
      if (!id) {
        throw new Error(
          'DOSqliteAdapter (per-tenant strategy): no tenantId in context. ' +
            'Set a default via the adapter constructor, or call ' +
            'adapter.withTenant(tenantId) before issuing operations.'
        )
      }
      return `tenant:${id}`
    }
  },

  perType: (): ShardingStrategy => {
    return (ctx) => {
      if (!ctx.type) {
        throw new Error('DOSqliteAdapter (per-type strategy): no type in context.')
      }
      return `type:${ctx.type}`
    }
  },

  unsharded: (): ShardingStrategy => {
    return () => '__shared__'
  },
} as const

// =============================================================================
// Adapter options
// =============================================================================

/**
 * Constructor options for {@link DOSqliteAdapter}.
 */
export interface DOSqliteAdapterOptions {
  /** The DO namespace binding from a Workers environment. */
  namespace: DurableObjectNamespaceLike

  /**
   * Sharding strategy. One of the built-in strategies on
   * {@link ShardingStrategies}, a custom `(ctx) => string`, or one of the
   * shorthand strings:
   *
   * - `'per-cascade'` — equivalent to `ShardingStrategies.perCascade()`.
   * - `'per-tenant'` — equivalent to `ShardingStrategies.perTenant()`.
   * - `'per-type'` — equivalent to `ShardingStrategies.perType()`.
   * - `'unsharded'` — equivalent to `ShardingStrategies.unsharded()`.
   *
   * Default: `'per-cascade'` (the canonical Stack B pattern).
   */
  sharding?: ShardingStrategy | 'per-cascade' | 'per-tenant' | 'per-type' | 'unsharded'

  /**
   * A default `cascadeId` used when a strategy needs one but the
   * per-operation context doesn't supply one. Convenience for callers
   * that have already established a cascade scope.
   */
  defaultCascadeId?: string

  /**
   * A default `tenantId` used when the per-tenant strategy needs one but
   * the per-operation context doesn't supply one.
   */
  defaultTenantId?: string

  /**
   * Default per-operation context merged into every op. Can be overridden
   * per-op via {@link DOSqliteAdapter.withContext}. Useful for setting a
   * stable `tenantId` while letting `cascadeId` rotate.
   */
  defaultContext?: ShardContext

  /**
   * Optional Cloudflare Vectorize binding for Tier 4 (vector search)
   * sidecar.
   *
   * - **Present** — the adapter declares Tier 4 with
   *   `implementation: 'sidecar'` and routes `vectorSearch()` to the
   *   binding's `query()`. Vector ids returned by the index are looked
   *   up as Thing ids inside the resolved DO shard.
   * - **Absent** — Tier 4 is `undefined` in capabilities, and calling
   *   `vectorSearch()` throws {@link VectorSearchUnavailableError}.
   *
   * Per ADR-0003, Vectorize is a per-deployment binding (cost concern;
   * declared in `wrangler.toml`); this adapter remains structurally
   * portable to non-Cloudflare runtimes simply by leaving the binding
   * unconfigured.
   */
  vectorize?: VectorizeIndexLike

  /**
   * Vector dimensions advertised on the capability declaration when a
   * Vectorize binding is wired. Vectorize indexes are created with a
   * fixed dimension at provisioning time; this value is informational for
   * the capability surface (the binding itself enforces dimension at
   * `query()` time). Common values: 1536 (OpenAI ada-002), 768
   * (sentence-transformers), 384 (small models).
   *
   * @default 1536
   */
  vectorizeDimensions?: number

  /**
   * Optional Vectorize namespace, prepended on every `query()` call when
   * present. Use to scope a single index across multiple tenants/cascades
   * by including a stable identifier (`tenantId`, `cascadeId`, ...).
   * Mirrors the Cloudflare Vectorize `namespace` option.
   */
  vectorizeNamespace?: string
}

// =============================================================================
// Wire types
// =============================================================================

interface DOEntityRow {
  id: string
  type: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface DORelRow {
  from_id: string
  relation: string
  to_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface DOErrorBody {
  error: string
}

const ACTION_TYPE = '__svo_action'
const VERB_TYPE = '__svo_verb'

// =============================================================================
// Adapter
// =============================================================================

/**
 * DO SQLite first-class adapter.
 *
 * Implements {@link DBProvider} (Tier 1+2), {@link DBProviderSVO} (SVO
 * Action recording + Verb registry), and exposes
 * {@link ProviderTierCapabilities} via the `capabilities` getter.
 *
 * @example Basic per-cascade usage
 * ```ts
 * import { DOSqliteAdapter } from 'ai-database'
 *
 * const adapter = new DOSqliteAdapter({
 *   namespace: env.DATABASE,
 *   sharding: 'per-cascade',
 *   defaultCascadeId: cascade.id,
 * })
 *
 * // Per-op context overrides
 * const customer = await adapter
 *   .withCascade(cascade.id)
 *   .create('Customer', undefined, { name: 'Acme' })
 * ```
 *
 * @example Per-tenant strategy
 * ```ts
 * const adapter = new DOSqliteAdapter({
 *   namespace: env.DATABASE,
 *   sharding: 'per-tenant',
 *   defaultTenantId: 'acme',
 * })
 * ```
 *
 * @example Custom strategy
 * ```ts
 * const adapter = new DOSqliteAdapter({
 *   namespace: env.DATABASE,
 *   sharding: (ctx) => `${ctx.tenantId}:${ctx.cascadeId}`,
 * })
 * ```
 */
export class DOSqliteAdapter implements DBProvider, DBProviderSVO, VectorSearchPort {
  private readonly namespace: DurableObjectNamespaceLike
  private readonly strategy: ShardingStrategy
  private readonly shardingModel: ShardingModel
  private readonly baseContext: ShardContext
  private readonly vectorize: VectorizeIndexLike | undefined
  private readonly vectorizeDimensions: number
  private readonly vectorizeNamespace: string | undefined

  /**
   * The per-DO SQLite hard cap from Cloudflare. Declared as `getter` so
   * future Cloudflare changes to the cap can be reflected in one place.
   * Cascade write strategy (`aip-g1i9`) consults this when sizing fan-out.
   */
  public readonly maxStorageBytes = 10 * 1024 * 1024 * 1024 // 10 GB

  constructor(options: DOSqliteAdapterOptions) {
    if (!options.namespace) {
      throw new Error(
        'DOSqliteAdapter: `namespace` (a DurableObjectNamespace binding) is required.'
      )
    }
    this.namespace = options.namespace

    // Resolve sharding strategy
    const sharding = options.sharding ?? 'per-cascade'
    if (typeof sharding === 'function') {
      this.strategy = sharding
      this.shardingModel = 'per-cascade' // unknown; default declaration
    } else {
      switch (sharding) {
        case 'per-cascade':
          this.strategy = ShardingStrategies.perCascade(options.defaultCascadeId)
          this.shardingModel = 'per-cascade'
          break
        case 'per-tenant':
          this.strategy = ShardingStrategies.perTenant(options.defaultTenantId)
          this.shardingModel = 'partitioned-by-tenant'
          break
        case 'per-type':
          this.strategy = ShardingStrategies.perType()
          this.shardingModel = 'per-type' as ShardingModel
          break
        case 'unsharded':
          this.strategy = ShardingStrategies.unsharded()
          this.shardingModel = 'unsharded'
          break
        default:
          throw new Error(`DOSqliteAdapter: unknown sharding strategy "${String(sharding)}"`)
      }
    }

    this.baseContext = { ...(options.defaultContext ?? {}) }
    if (options.defaultCascadeId !== undefined) {
      this.baseContext.cascadeId = options.defaultCascadeId
    }
    if (options.defaultTenantId !== undefined) {
      this.baseContext.tenantId = options.defaultTenantId
    }

    this.vectorize = options.vectorize
    this.vectorizeDimensions = options.vectorizeDimensions ?? 1536
    this.vectorizeNamespace = options.vectorizeNamespace
  }

  // ===========================================================================
  // Capability declaration (Tier model from ADR-0003)
  // ===========================================================================

  /**
   * Tier capability declaration for this adapter.
   *
   * Per ADR-0003:
   * - **Sharding**: `per-cascade` (default; the enabling pattern). Switches
   *   to `partitioned-by-tenant` when constructed with `'per-tenant'` or
   *   `unsharded` when constructed with `'unsharded'`.
   * - **Tier 3 analytics**: declared `false` across the board. Cross-DO
   *   queries are hard; aggregations are the dual-write/Iceberg path.
   * - **Tier 4 vector search**: `undefined`. DO SQLite has no native
   *   vectors; callers wire a Vectorize sidecar (per `aip-kh9l`).
   * - **SVO Action recording / Verb registry**: both `true`. Stored as
   *   reserved entity types (`__svo_action`, `__svo_verb`) inside each DO,
   *   matching the per-cascade isolation pattern (Action records live in
   *   the same DO as the entities they reference).
   */
  get capabilities(): ProviderTierCapabilities {
    const caps: ProviderTierCapabilities = {
      adapter: 'do-sqlite',
      shardingModel: this.shardingModel,
      analytics: {
        hasAggregations: false,
        hasTimeSeries: false,
        hasLargeScans: false,
      },
      hasActionRecording: true,
      hasVerbRegistry: true,
    }
    // Tier 4 is opt-in via a Vectorize sidecar binding. When present we
    // declare the capability with `implementation: 'sidecar'` so callers
    // can distinguish from native (PG/CH).
    if (this.vectorize) {
      caps.vectorSearch = {
        maxDimensions: this.vectorizeDimensions,
        metrics: ['cosine'],
        implementation: 'sidecar',
      }
    }
    return caps
  }

  // ===========================================================================
  // Context derivation — `withCascade`/`withTenant`/`withContext` produce a
  // bound view of the adapter that fills in shard context per op. They
  // return DBProvider+SVO without re-instantiating the underlying namespace.
  // ===========================================================================

  /**
   * Return an adapter bound to `cascadeId` for subsequent operations.
   * Useful when the surrounding code has a stable cascade scope but the
   * adapter was constructed without one.
   *
   * Returns a new bound adapter; the original is unchanged.
   */
  withCascade(cascadeId: string): DOSqliteAdapter {
    return this.cloneWithContext({ cascadeId })
  }

  /**
   * Return an adapter bound to `tenantId` for subsequent operations.
   */
  withTenant(tenantId: string): DOSqliteAdapter {
    return this.cloneWithContext({ tenantId })
  }

  /**
   * Return an adapter bound to a free-form context. Lets callers route to
   * a custom shard strategy without modifying the strategy itself.
   */
  withContext(context: ShardContext): DOSqliteAdapter {
    return this.cloneWithContext(context)
  }

  private cloneWithContext(extra: ShardContext): DOSqliteAdapter {
    const clone = Object.create(DOSqliteAdapter.prototype) as DOSqliteAdapter
    Object.assign(clone, {
      namespace: this.namespace,
      strategy: this.strategy,
      shardingModel: this.shardingModel,
      baseContext: { ...this.baseContext, ...extra },
      maxStorageBytes: this.maxStorageBytes,
      vectorize: this.vectorize,
      vectorizeDimensions: this.vectorizeDimensions,
      vectorizeNamespace: this.vectorizeNamespace,
    })
    return clone
  }

  // ===========================================================================
  // Internal: shard resolution + fetch
  // ===========================================================================

  private resolveStub(ctx: ShardContext): DurableObjectStubLike {
    const merged = { ...this.baseContext, ...ctx }
    const idName = this.strategy(merged)
    const id = this.namespace.idFromName(idName)
    return this.namespace.get(id)
  }

  private async doFetch<T>(ctx: ShardContext, path: string, init?: RequestInit): Promise<T> {
    const stub = this.resolveStub(ctx)
    const url = `https://do.test${path}`
    const response = await stub.fetch(url, init)
    return this.parseResponse<T>(response, path)
  }

  private async parseResponse<T>(response: Response, path: string): Promise<T> {
    const text = await response.text()
    let parsed: unknown
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null
    } catch {
      throw new Error(
        `DOSqliteAdapter: ${path} returned non-JSON (status ${response.status}): ${text.slice(
          0,
          200
        )}`
      )
    }
    if (!response.ok) {
      const err = (parsed as DOErrorBody | null)?.error ?? `status ${response.status}`
      throw new Error(`DOSqliteAdapter: ${path} failed: ${err}`)
    }
    return parsed as T
  }

  private static normalizeEntity(row: DOEntityRow): Record<string, unknown> {
    const data = row.data ?? {}
    return {
      ...data,
      $id: row.id,
      $type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private static jsonInit(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  }

  // ===========================================================================
  // Tier 1 — entity CRUD
  // ===========================================================================

  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    const stub = this.resolveStub({ type })
    const response = await stub.fetch(`https://do.test/data/${encodeURIComponent(id)}`)
    if (response.status === 404) return null
    const row = await this.parseResponse<DOEntityRow>(response, `/data/${id}`)
    if (row.type !== type) return null
    return DOSqliteAdapter.normalizeEntity(row)
  }

  async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
    const body: Record<string, unknown> = { type }
    if (options?.where !== undefined) body['where'] = options.where
    if (options?.orderBy !== undefined) body['orderBy'] = options.orderBy
    if (options?.order !== undefined) body['order'] = options.order
    if (options?.limit !== undefined) body['limit'] = options.limit
    if (options?.offset !== undefined) body['offset'] = options.offset

    const rows = await this.doFetch<DOEntityRow[]>(
      { type },
      '/query/list',
      DOSqliteAdapter.jsonInit('POST', body)
    )
    return rows.map(DOSqliteAdapter.normalizeEntity)
  }

  async search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    const body: Record<string, unknown> = { type, query }
    if (options?.fields !== undefined) body['fields'] = options.fields
    if (options?.limit !== undefined) body['limit'] = options.limit
    if (options?.minScore !== undefined) body['minScore'] = options.minScore

    const rows = await this.doFetch<Array<DOEntityRow & { score?: number }>>(
      { type },
      '/query/search',
      DOSqliteAdapter.jsonInit('POST', body)
    )
    let results = rows.map(DOSqliteAdapter.normalizeEntity)

    // Apply where filter client-side (DO /query/search doesn't support where).
    if (options?.where && Object.keys(options.where).length > 0) {
      const where = options.where
      results = results.filter((entity) => {
        for (const [key, value] of Object.entries(where)) {
          if (entity[key] !== value) return false
        }
        return true
      })
    }

    if (options?.offset) results = results.slice(options.offset)
    if (options?.limit !== undefined) results = results.slice(0, options.limit)
    return results
  }

  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { type, data }
    if (id !== undefined) body['id'] = id

    const row = await this.doFetch<DOEntityRow>(
      { type },
      '/data',
      DOSqliteAdapter.jsonInit('POST', body)
    )
    return DOSqliteAdapter.normalizeEntity(row)
  }

  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const row = await this.doFetch<DOEntityRow>(
      { type },
      `/data/${encodeURIComponent(id)}`,
      DOSqliteAdapter.jsonInit('PATCH', { data })
    )
    return DOSqliteAdapter.normalizeEntity(row)
  }

  async delete(type: string, id: string): Promise<boolean> {
    const result = await this.doFetch<{ deleted: boolean }>(
      { type },
      `/data/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )
    return result.deleted === true
  }

  // ===========================================================================
  // Tier 2 — relationships / graph traversal
  // ===========================================================================

  async related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams({ from_id: id, relation })
    const rows = await this.doFetch<DOEntityRow[]>({ type }, `/traverse?${params.toString()}`)
    return rows.map(DOSqliteAdapter.normalizeEntity)
  }

  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void> {
    const body: Record<string, unknown> = { from_id: fromId, relation, to_id: toId }
    if (metadata !== undefined) body['metadata'] = { ...metadata, fromType, toType }
    await this.doFetch<DORelRow>(
      { type: fromType },
      '/rels',
      DOSqliteAdapter.jsonInit('POST', body)
    )
  }

  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    _toType: string,
    toId: string
  ): Promise<void> {
    await this.doFetch<{ deleted: boolean }>(
      { type: fromType },
      '/rels/delete',
      DOSqliteAdapter.jsonInit('DELETE', { from_id: fromId, relation, to_id: toId })
    )
  }

  // ===========================================================================
  // SVO surface — Action recording
  // ===========================================================================
  //
  // Actions are stored as reserved-type entities (`__svo_action`) inside the
  // shard the action's subject lives in. This honours per-cascade isolation:
  // an Action recorded as part of a cascade lives in that cascade's DO,
  // alongside the entities it references.
  //
  // Verbs are stored similarly under `__svo_verb`. Because each shard has
  // its own SQLite DB, the Verb registry is **per-shard** — different shards
  // can hold independent Verb sets. For most cascade workloads that's the
  // correct shape (cascades are short-lived). Long-lived workloads that
  // need a global Verb registry should layer it via `digital-objects`
  // upstream of the adapter.

  private actionRouteContext(input: { subject?: string; object?: string }): ShardContext {
    // Route Actions to the shard of the subject if available, else object,
    // else the default context. We don't carry a `type` here — the Action
    // type itself is reserved.
    return { type: ACTION_TYPE, subjectId: input.subject, objectId: input.object }
  }

  async recordAction<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<SVOAction<T>, 'id' | 'createdAt' | 'status'> & {
      status?: SVOAction['status']
    }
  ): Promise<SVOAction<T>> {
    const id = crypto.randomUUID()
    const createdAt = new Date()
    const status: SVOAction['status'] = input.status ?? 'completed'

    const data: Record<string, unknown> = {
      verb: input.verb,
      status,
    }
    if (input.subject !== undefined) data['subject'] = input.subject
    if (input.object !== undefined) data['object'] = input.object
    if (input.roles !== undefined) data['roles'] = input.roles
    if (input.data !== undefined) data['data'] = input.data
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      data['completedAt'] = createdAt.toISOString()
    }

    const ctx = this.actionRouteContext({
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.object !== undefined && { object: input.object }),
    })
    const row = await this.doFetch<DOEntityRow>(
      ctx,
      '/data',
      DOSqliteAdapter.jsonInit('POST', { id, type: ACTION_TYPE, data })
    )

    const persistedData = (row.data ?? {}) as Record<string, unknown>
    const action: SVOAction<T> = {
      id: row.id,
      verb: persistedData['verb'] as string,
      status: (persistedData['status'] as SVOAction['status']) ?? 'completed',
      createdAt: new Date(row.created_at),
      ...(persistedData['subject'] !== undefined && {
        subject: persistedData['subject'] as string,
      }),
      ...(persistedData['object'] !== undefined && {
        object: persistedData['object'] as string,
      }),
      ...(persistedData['roles'] !== undefined && {
        roles: persistedData['roles'] as Partial<
          Record<Exclude<FrameRole, 'subject' | 'object'>, string>
        >,
      }),
      ...(persistedData['data'] !== undefined && { data: persistedData['data'] as T }),
      ...(persistedData['completedAt'] !== undefined && {
        completedAt: new Date(persistedData['completedAt'] as string),
      }),
    }
    return action
  }

  async queryActions<T extends Record<string, unknown> = Record<string, unknown>>(
    query?: ActionQuery
  ): Promise<SVOAction<T>[]> {
    // List all action records on the resolved shard. Filtering is applied
    // client-side for simplicity (per-DO SVO records remain small relative
    // to entity volume).
    const where: Record<string, unknown> = {}
    if (query?.verb !== undefined) where['data.verb'] = query.verb

    const ctx = this.actionRouteContext({
      ...(query?.subject !== undefined && { subject: query.subject }),
      ...(query?.object !== undefined && { object: query.object }),
    })
    const rows = await this.doFetch<DOEntityRow[]>(
      ctx,
      '/query/list',
      DOSqliteAdapter.jsonInit('POST', { type: ACTION_TYPE })
    )

    let actions = rows.map((row) => {
      const data = (row.data ?? {}) as Record<string, unknown>
      const action: SVOAction<T> = {
        id: row.id,
        verb: data['verb'] as string,
        status: (data['status'] as SVOAction['status']) ?? 'completed',
        createdAt: new Date(row.created_at),
        ...(data['subject'] !== undefined && { subject: data['subject'] as string }),
        ...(data['object'] !== undefined && { object: data['object'] as string }),
        ...(data['roles'] !== undefined && {
          roles: data['roles'] as Partial<Record<Exclude<FrameRole, 'subject' | 'object'>, string>>,
        }),
        ...(data['data'] !== undefined && { data: data['data'] as T }),
        ...(data['completedAt'] !== undefined && {
          completedAt: new Date(data['completedAt'] as string),
        }),
      }
      return action
    })

    if (query?.verb !== undefined) {
      actions = actions.filter((a) => a.verb === query.verb)
    }
    if (query?.subject !== undefined) {
      actions = actions.filter((a) => a.subject === query.subject)
    }
    if (query?.object !== undefined) {
      actions = actions.filter((a) => a.object === query.object)
    }
    if (query?.role) {
      const role = query.role
      actions = actions.filter((a) => {
        for (const [key, value] of Object.entries(role)) {
          if (key === 'subject') {
            if (a.subject !== value) return false
          } else if (key === 'object') {
            if (a.object !== value) return false
          } else {
            const slot = (a.roles ?? {}) as Record<string, string>
            if (slot[key] !== value) return false
          }
        }
        return true
      })
    }
    if (query?.status !== undefined) {
      const want = Array.isArray(query.status) ? new Set(query.status) : new Set([query.status])
      actions = actions.filter((a) => want.has(a.status))
    }
    if (query?.since !== undefined) {
      actions = actions.filter((a) => a.createdAt >= query.since!)
    }
    if (query?.until !== undefined) {
      actions = actions.filter((a) => a.createdAt <= query.until!)
    }

    actions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    if (query?.offset !== undefined) actions = actions.slice(query.offset)
    if (query?.limit !== undefined) actions = actions.slice(0, query.limit)
    return actions
  }

  // ===========================================================================
  // SVO surface — Verb registry
  // ===========================================================================

  async defineVerb(def: VerbDefinitionInput): Promise<VerbRecord> {
    const existing = await this.getVerb(def.name)
    if (existing) {
      // Idempotent re-registration is allowed when conjugations match;
      // reject when they conflict.
      const conflict =
        (def.action !== undefined && def.action !== existing.action) ||
        (def.act !== undefined && def.act !== existing.act) ||
        (def.activity !== undefined && def.activity !== existing.activity)
      if (conflict) {
        throw new Error(
          `DOSqliteAdapter.defineVerb: verb "${def.name}" already registered with conflicting conjugations`
        )
      }
      return existing
    }

    const action = def.action ?? def.name
    const act = def.act ?? `${action}s`
    const activity = def.activity ?? `${action}ing`
    const event = def.event ?? action

    const data: Record<string, unknown> = {
      name: def.name,
      action,
      act,
      activity,
      event,
      ...(def.reverseBy !== undefined && { reverseBy: def.reverseBy }),
      ...(def.reverseAt !== undefined && { reverseAt: def.reverseAt }),
      ...(def.reverseIn !== undefined && { reverseIn: def.reverseIn }),
      ...(def.inverse !== undefined && { inverse: def.inverse }),
      ...(def.description !== undefined && { description: def.description }),
      ...(def.frame !== undefined && { frame: def.frame }),
      ...(def.source !== undefined && { source: def.source }),
      ...(def.canonical !== undefined && { canonical: def.canonical }),
    }

    const ctx: ShardContext = { type: VERB_TYPE }
    const row = await this.doFetch<DOEntityRow>(
      ctx,
      '/data',
      DOSqliteAdapter.jsonInit('POST', { id: def.name, type: VERB_TYPE, data })
    )
    return DOSqliteAdapter.toVerbRecord(row)
  }

  async getVerb(name: string): Promise<VerbRecord | null> {
    const ctx: ShardContext = { type: VERB_TYPE }
    const stub = this.resolveStub(ctx)
    const response = await stub.fetch(`https://do.test/data/${encodeURIComponent(name)}`)
    if (response.status === 404) return null
    const row = await this.parseResponse<DOEntityRow>(response, `/data/${name}`)
    if (row.type !== VERB_TYPE) return null
    return DOSqliteAdapter.toVerbRecord(row)
  }

  async listVerbs(): Promise<VerbRecord[]> {
    const ctx: ShardContext = { type: VERB_TYPE }
    const rows = await this.doFetch<DOEntityRow[]>(
      ctx,
      '/query/list',
      DOSqliteAdapter.jsonInit('POST', { type: VERB_TYPE })
    )
    return rows.map(DOSqliteAdapter.toVerbRecord)
  }

  // ===========================================================================
  // Tier 4 — vector search (Vectorize sidecar)
  // ===========================================================================

  /**
   * Vector search via the Cloudflare Vectorize sidecar binding.
   *
   * - When the adapter was constructed **without** a `vectorize` binding,
   *   this throws {@link VectorSearchUnavailableError}.
   * - When **with** a binding, the binding's `query()` is invoked with
   *   `topK = options.limit ?? 10` and `returnMetadata: true` so each hit
   *   carries enough context to reconstruct an entity. The vector id
   *   returned by Vectorize is treated as the Thing id; if the index
   *   stores the Thing's `data` in `metadata`, the result entity is
   *   composed from that — otherwise a fallback `get()` against the
   *   resolved DO shard fills in the data. Dimensions and metrics are
   *   determined by how the index was provisioned upstream; we pass the
   *   caller's `metric` through unchanged for documentation purposes
   *   (Vectorize doesn't accept a per-query metric).
   *
   * Frame-aware role filtering is **deferred** to a refinement bead;
   * Vectorize's `filter` parameter could carry role-shaped metadata
   * filters, but the wire shape needs design with how callers seed the
   * index, which is out of scope here.
   */
  async vectorSearch<T extends Record<string, unknown> = Record<string, unknown>>(
    type: string,
    queryEmbedding: number[],
    options?: {
      metric?: VectorSimilarityMetric
      limit?: number
      minScore?: number
    }
  ): Promise<VectorSearchHit<T>[]> {
    if (!this.vectorize) {
      throw new VectorSearchUnavailableError(
        'do-sqlite',
        'no Vectorize binding configured (pass `vectorize` to DOSqliteAdapter constructor)'
      )
    }
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('vectorSearch: queryEmbedding must be a non-empty array of numbers')
    }
    for (const v of queryEmbedding) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error('vectorSearch: queryEmbedding values must be finite numbers')
      }
    }

    // The metric option is a hint only — Vectorize indexes pin a metric at
    // creation time. We accept it for API parity with PG/CH but don't
    // forward it to the binding.
    void options?.metric

    const limit = Math.max(1, options?.limit ?? 10)
    const queryOptions: {
      topK: number
      returnMetadata: boolean
      namespace?: string
    } = { topK: limit, returnMetadata: true }
    if (this.vectorizeNamespace !== undefined) {
      queryOptions.namespace = this.vectorizeNamespace
    }

    const result = await this.vectorize.query(queryEmbedding, queryOptions)
    const matches = result?.matches ?? []

    let hits: VectorSearchHit<T>[] = []
    for (const m of matches) {
      const meta = (m.metadata ?? {}) as Record<string, unknown>
      // Prefer entity payload from index metadata when callers stored it;
      // otherwise fall back to fetching the row from the resolved shard.
      let entity: (T & { $id: string; $type: string }) | null = null
      const metaType = typeof meta['type'] === 'string' ? (meta['type'] as string) : undefined
      const metaData =
        typeof meta['data'] === 'object' && meta['data'] !== null
          ? (meta['data'] as Record<string, unknown>)
          : undefined
      if (metaType === type && metaData) {
        entity = { ...metaData, $id: m.id, $type: type } as T & { $id: string; $type: string }
      } else if (metaType === undefined && metaData === undefined) {
        // Index didn't store metadata — read-back from the DO shard.
        const fetched = (await this.get(type, m.id)) as Record<string, unknown> | null
        if (fetched) {
          entity = fetched as T & { $id: string; $type: string }
        }
      }
      // Skip matches that aren't of the requested type.
      if (!entity) continue
      hits.push({ entity, score: m.score })
    }

    if (options?.minScore !== undefined) {
      const min = options.minScore
      hits = hits.filter((h) => h.score >= min)
    }
    return hits
  }

  private static toVerbRecord(row: DOEntityRow): VerbRecord {
    const data = (row.data ?? {}) as Record<string, unknown>
    return {
      name: (data['name'] as string) ?? row.id,
      action: data['action'] as string,
      act: data['act'] as string,
      activity: data['activity'] as string,
      event: data['event'] as string,
      ...(data['reverseBy'] !== undefined && { reverseBy: data['reverseBy'] as string }),
      ...(data['reverseAt'] !== undefined && { reverseAt: data['reverseAt'] as string }),
      ...(data['reverseIn'] !== undefined && { reverseIn: data['reverseIn'] as string }),
      ...(data['inverse'] !== undefined && { inverse: data['inverse'] as string }),
      ...(data['description'] !== undefined && {
        description: data['description'] as string,
      }),
      ...(data['frame'] !== undefined && {
        frame: data['frame'] as Record<string, unknown>,
      }),
      ...(data['source'] !== undefined && { source: data['source'] as string }),
      ...(data['canonical'] !== undefined && { canonical: data['canonical'] as boolean }),
      createdAt: new Date(row.created_at),
    }
  }
}

/**
 * Convenience factory: create a {@link DOSqliteAdapter}.
 *
 * @example
 * ```ts
 * import { createDOSqliteAdapter } from 'ai-database'
 *
 * const adapter = createDOSqliteAdapter({
 *   namespace: env.DATABASE,
 *   sharding: 'per-cascade',
 *   defaultCascadeId: cascade.id,
 * })
 * ```
 */
export function createDOSqliteAdapter(options: DOSqliteAdapterOptions): DOSqliteAdapter {
  return new DOSqliteAdapter(options)
}
