/**
 * DBProvider Port — SVO-shaped storage contract
 *
 * This module is the canonical reference for the `DBProvider` port shape and its
 * declared capability tiers. It refines the structural interface in
 * `./schema/provider.ts` (kept for backward compatibility) with:
 *
 * - **Tier model from ADR-0003**: Tier 1+2 are universal (every adapter
 *   supports them); Tier 3 (analytics) and Tier 4 (vector search) are
 *   declared per-adapter via `ProviderTierCapabilities`.
 * - **SVO-aligned Action recording** that carries Frame roles
 *   (`subject`, `object`, `recipient`, `source`, `destination`,
 *   `instrument`, `topic`, `cause`, `manner`) per `digital-objects` and
 *   CONTEXT.md.
 * - **Sharding model declaration** so the cascade write strategy can pick
 *   the right adapter for a workload (per-cascade DO SQLite vs.
 *   partitioned Postgres vs. unsharded).
 *
 * The shape is **additive**: every existing `DBProvider` implementation in
 * this package (MemoryProvider, RDBProviderAdapter, DigitalObjectsProvider)
 * remains valid without changes. Capability declarations are optional —
 * absence implies "Tier 1+2 only, sharding `unsharded`, no analytics, no
 * vector search". Adapters declare richer capabilities by attaching a
 * `capabilities: ProviderTierCapabilities` getter.
 *
 * @see {@link ../docs/adr/0003-storage-strategy-pg-clickhouse-default.md}
 * @see {@link ./schema/provider.ts} for the live structural interface
 * @packageDocumentation
 */

import type { DBProvider, Transaction } from './schema/provider.js'
import type {
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
} from './schema/types.js'

// =============================================================================
// Frame Roles — SVO complement-role taxonomy
// =============================================================================

/**
 * Frame role taxonomy — the closed set of complement roles a Verb may take.
 *
 * Mirrors `digital-objects` `FrameRole` exactly. Re-declared here so callers
 * of `ai-database` can express role-bearing queries against the port without
 * a hard dependency on `digital-objects` types.
 *
 * `subject`/`object` are the primary SVO axes; the rest are filled
 * optionally per a Verb's declared Frame. The literal `when`/`where`
 * (timestamp/location) are carried directly on Action and are not Frame
 * roles.
 *
 * @see CONTEXT.md "Frame roles (closed taxonomy)"
 */
export type FrameRole =
  | 'subject'
  | 'object'
  | 'recipient'
  | 'source'
  | 'destination'
  | 'instrument'
  | 'topic'
  | 'cause'
  | 'manner'

// =============================================================================
// Sharding model
// =============================================================================

/**
 * Sharding strategy a DBProvider adapter exposes to callers.
 *
 * Cascade generation (the `ai-database` moat) writes thousands of entities
 * + relations per cascade. Knowing the adapter's sharding shape lets the
 * cascade write strategy pick the correct fan-out:
 *
 * - `'per-cascade'` — Each cascade gets its own database/shard. Native to
 *   Cloudflare Durable Objects: one DO per cascade gives full single-DO
 *   throughput in parallel across many active cascades. Read-back during
 *   traversal stays inside the same shard (no cross-shard hot-path reads).
 *
 * - `'partitioned-by-tenant'` — Adapter partitions on a tenant/namespace
 *   key. Native shape for multi-tenant Postgres (schema-per-tenant or
 *   partitioned table). Cascades within one tenant share a partition;
 *   different tenants are isolated.
 *
 * - `'unsharded'` — One global store. Default for in-memory / dev / single
 *   small Postgres deployments. Cascade-throughput hits the adapter's
 *   single-writer ceiling.
 *
 * Adapters MAY declare a custom string for future strategies (e.g.,
 * `'per-tenant-do'`). The union is open via `string` for forward
 * compatibility.
 *
 * @see ADR-0003 "Cascade generation is the moat — and dictates the storage shape"
 */
export type ShardingModel = 'per-cascade' | 'partitioned-by-tenant' | 'unsharded' | (string & {})

// =============================================================================
// Tier 4 — Vector search capability declaration
// =============================================================================

/**
 * Similarity metric supported by a vector-search-capable adapter.
 *
 * Adapters that support vector search declare which metrics their backend
 * can compute. Callers that need a specific metric must verify support
 * before issuing the query.
 *
 * - `'cosine'` — Cosine similarity (most common; pgvector, CH, Vectorize).
 * - `'l2'` — Euclidean / L2 distance.
 * - `'dot'` — Dot product (inner product); pgvector and CH support this.
 * - `'hamming'` — For binary embeddings (rare; declare only if implemented).
 */
export type VectorSimilarityMetric = 'cosine' | 'l2' | 'dot' | 'hamming'

/**
 * Tier 4 — vector search capability declaration.
 *
 * Adapters declare:
 * - The maximum embedding dimension they accept on a single index.
 * - The similarity metrics they support natively.
 * - Whether the implementation is native to the transactional store
 *   (e.g., `pgvector`) or runs as a sidecar (e.g., DO SQLite + Vectorize
 *   sidecar binding). Sidecar adapters add operational cost (per-deployment
 *   binding) but the cascade workload still benefits.
 *
 * Per ADR-0003: pgvector is native; CH has vector functions; DO SQLite
 * requires Vectorize sidecar; libSQL/Turso has native vectors; R2 vector
 * search is explicitly out of scope.
 */
export interface VectorSearchCapability {
  /**
   * Maximum embedding dimension the adapter can index in a single vector
   * column / index. Common values: 1536 (OpenAI ada-002), 3072
   * (text-embedding-3-large), 384 (sentence-transformers).
   */
  maxDimensions: number

  /**
   * Similarity metrics supported by the adapter. Order is informational
   * (first metric is typically the recommended/cheapest).
   */
  metrics: ReadonlyArray<VectorSimilarityMetric>

  /**
   * Whether the vector index lives in the transactional store (`'native'`)
   * or in a separate service/binding (`'sidecar'`).
   *
   * Sidecar implementations require additional configuration at deployment
   * time and may have different consistency / latency characteristics from
   * the primary store. Stack B (DO SQLite + Vectorize) is `'sidecar'`.
   */
  implementation: 'native' | 'sidecar'
}

// =============================================================================
// Tier 3 — Analytics capability declaration
// =============================================================================

/**
 * Tier 3 — analytics capability declaration.
 *
 * Adapters that can serve aggregations, time-series rollups, and
 * large-scan analytical queries efficiently declare this. Examples:
 *
 * - **ClickHouse** — full Tier 3 (aggregations, windows, time-series).
 * - **Postgres** — declares Tier 3 with caveats (works at moderate scale;
 *   long scans contend with transactional load).
 * - **DO SQLite** — should NOT declare Tier 3 (per-DO limit; cross-DB
 *   queries hard).
 * - **MemoryProvider** — does not declare Tier 3.
 *
 * The shape is intentionally minimal in this bead. Future beads may add
 * fine-grained sub-flags (`hasWindowFunctions`, `hasJoins`,
 * `hasTimeSeries`) — they fit additively under this object.
 */
export interface AnalyticsCapability {
  /** True when the adapter can run aggregations efficiently. */
  hasAggregations: boolean

  /**
   * True when the adapter supports time-series functions (window
   * aggregates over time, sessionization). ClickHouse yes; raw Postgres
   * yes with caveats; DO SQLite no; R2 SQL not yet (per ADR-0003).
   */
  hasTimeSeries: boolean

  /**
   * True when large scans (millions of rows) are part of the supported
   * workload. ClickHouse yes; Postgres conditional; DO SQLite no.
   */
  hasLargeScans: boolean
}

// =============================================================================
// Provider tier capabilities (the declaration object on DBProvider)
// =============================================================================

/**
 * Tier-model capability declaration attached to a DBProvider implementation.
 *
 * Per ADR-0003, every adapter satisfies Tier 1 (entity CRUD) and Tier 2
 * (graph traversal across Action subject/object/recipient roles) — these
 * are not declared, they are expected. This object declares the
 * **opt-in** tiers.
 *
 * Adapters expose this via a `capabilities` property on their DBProvider
 * implementation. Callers introspect via {@link getProviderCapabilities}
 * which falls back to the `'unsharded'` / no-Tier-3 / no-Tier-4 default
 * for adapters that haven't declared.
 */
export interface ProviderTierCapabilities {
  /** Stable adapter identifier (`'memory'`, `'pg+pgvector'`, `'clickhouse'`, `'do-sqlite'`, etc.). */
  adapter: string

  /** Sharding strategy the adapter implements. See {@link ShardingModel}. */
  shardingModel: ShardingModel

  /**
   * Tier 3 — analytics. Absent => not supported (callers should fall back
   * or refuse). Present => the adapter promises the declared sub-flags.
   */
  analytics?: AnalyticsCapability

  /**
   * Tier 4 — vector search. Absent => not supported. Present => the
   * adapter promises the declared dimension cap, metrics, and
   * implementation shape.
   */
  vectorSearch?: VectorSearchCapability

  /**
   * True if the adapter supports the SVO Action-recording surface
   * ({@link DBProviderSVO.recordAction} and friends). Defaults to false
   * for backward compatibility — existing adapters expose Actions through
   * `relate()` / `DBProviderExtended.createAction()` instead.
   */
  hasActionRecording?: boolean

  /**
   * True if the adapter exposes a Verb registry
   * ({@link DBProviderSVO.defineVerb} and friends). Like
   * `hasActionRecording`, defaults to false; the Verb registry today
   * lives in `digital-objects` and adapters wrapping it surface it
   * upstream.
   */
  hasVerbRegistry?: boolean
}

// =============================================================================
// SVO-aligned port surface (additive)
// =============================================================================

/**
 * SVO-aligned Action record carrying Frame roles.
 *
 * Wire-shape compatible with `digital-objects` `Action`: same `id`,
 * `verb`, `subject`, `object`, `roles`, `data`, `status`, `createdAt`,
 * `completedAt`. Re-declared here to avoid an upward dependency on
 * `digital-objects`.
 *
 * Adapters that declare `hasActionRecording: true` produce records of
 * this shape and accept queries against role slots.
 */
export interface SVOAction<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique action id. */
  id: string

  /**
   * Verb name (references a Verb in the registry). Examples: `'create'`,
   * `'approve'`, `'send'`. The Verb's Frame describes which roles are
   * meaningful for this Verb.
   */
  verb: string

  /** Thing id of the subject (actor / who-acts). Required for transitive Actions. */
  subject?: string

  /** Thing id of the direct object (what-is-acted-on). */
  object?: string

  /**
   * Remaining Frame slots. Values are Thing ids (`ThingRef`) for
   * entity-shaped roles, or strings for `manner` enum values. Unused
   * slots are absent rather than null.
   */
  roles?: Partial<Record<Exclude<FrameRole, 'subject' | 'object'>, string>>

  /** Optional payload / metadata for the Action (Verb-specific). */
  data?: T

  /** Action lifecycle status. */
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'

  /** When the Action record was created. */
  createdAt: Date

  /** When the Action transitioned to a terminal status (completed/failed/cancelled). */
  completedAt?: Date
}

/**
 * Filter for querying Actions by Frame role.
 *
 * Every field is optional; the adapter ANDs them. To find every Action
 * Priya took as `subject` regardless of Verb: `{ subject: 'priya' }`.
 * To find every `approve` Action Priya took on a refund:
 * `{ verb: 'approve', subject: 'priya', object: 'refund-123' }`.
 */
export interface ActionQuery {
  /** Filter by Verb name. */
  verb?: string

  /** Filter by `subject` Thing id. */
  subject?: string

  /** Filter by `object` Thing id. */
  object?: string

  /**
   * Filter by any Frame role. Keys are role names (`'recipient'`,
   * `'source'`, ...); values are Thing ids (or `manner` strings).
   * Adapters MUST evaluate exact equality on the role slot.
   */
  role?: Partial<Record<FrameRole, string>>

  /** Filter by status. */
  status?: SVOAction['status'] | SVOAction['status'][]

  /** Created-at lower bound (inclusive). */
  since?: Date

  /** Created-at upper bound (inclusive). */
  until?: Date

  /** Pagination. */
  limit?: number

  /** Pagination. */
  offset?: number
}

/**
 * Verb definition input for the optional Verb registry.
 *
 * Mirrors `digital-objects` `VerbDefinition` — adapters that wrap
 * `digital-objects` (e.g., `DigitalObjectsProvider`) forward this
 * directly. The Frame is opaque to `ai-database` here (string
 * key/value); strict typing comes from the upstream `digital-objects`
 * type when callers import it.
 */
export interface VerbDefinitionInput {
  name: string
  action?: string
  act?: string
  activity?: string
  event?: string
  reverseBy?: string
  reverseAt?: string
  reverseIn?: string
  inverse?: string
  description?: string
  frame?: Record<string, unknown>
  source?: string
  canonical?: boolean
}

/**
 * Verb record returned by the registry.
 */
export interface VerbRecord {
  name: string
  action: string
  act: string
  activity: string
  event: string
  reverseBy?: string
  reverseAt?: string
  reverseIn?: string
  inverse?: string
  description?: string
  frame?: Record<string, unknown>
  source?: string
  canonical?: boolean
  createdAt: Date
}

/**
 * SVO-aligned port surface — the **declared** Tier-2-Verbs portion of the port.
 *
 * Adapters may implement none, some, or all of these methods. Callers
 * MUST check `capabilities.hasActionRecording` and
 * `capabilities.hasVerbRegistry` (or use the type guards in this module)
 * before invoking.
 *
 * **Invariants**:
 * - {@link recordAction} returns the persisted Action; callers may use
 *   the returned `id` for traversal queries.
 * - {@link queryActions} ordering: by `createdAt` ascending unless the
 *   adapter documents otherwise. (`limit`/`offset` apply post-ordering.)
 * - All role values reference Thing ids that the adapter MAY validate
 *   (foreign-key-style) — adapters MUST NOT silently rewrite ids.
 *
 * **Error modes**:
 * - Unknown Verb when calling {@link recordAction}: adapters SHOULD
 *   reject with a typed error (e.g., `EntityNotFoundError` for the
 *   Verb). They MAY auto-define unknown Verbs if `hasVerbRegistry`;
 *   callers should not depend on either behavior.
 * - Pagination out of range returns an empty array, never throws.
 */
export interface DBProviderSVO {
  /**
   * Record an Action against the SVO ontology. Returns the persisted
   * record. The `id` is adapter-generated unless the caller provides one
   * via `data.id` (uncommon).
   *
   * Required when `capabilities.hasActionRecording` is `true`.
   */
  recordAction<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<SVOAction<T>, 'id' | 'createdAt' | 'status'> & {
      status?: SVOAction['status']
    }
  ): Promise<SVOAction<T>>

  /**
   * Query Actions by Verb / role / status / time window. See
   * {@link ActionQuery} for filter semantics.
   *
   * Required when `capabilities.hasActionRecording` is `true`.
   */
  queryActions<T extends Record<string, unknown> = Record<string, unknown>>(
    query?: ActionQuery
  ): Promise<SVOAction<T>[]>

  /**
   * Define (register) a Verb. No-op if a Verb with the same `name`
   * already exists with identical conjugations; rejects if conjugations
   * conflict.
   *
   * Required when `capabilities.hasVerbRegistry` is `true`.
   */
  defineVerb(def: VerbDefinitionInput): Promise<VerbRecord>

  /**
   * Get a Verb by name. Returns `null` if not registered.
   *
   * Required when `capabilities.hasVerbRegistry` is `true`.
   */
  getVerb(name: string): Promise<VerbRecord | null>

  /**
   * List all registered Verbs. Order is adapter-defined unless documented.
   *
   * Required when `capabilities.hasVerbRegistry` is `true`.
   */
  listVerbs(): Promise<VerbRecord[]>
}

// =============================================================================
// Vector / analytics method shapes (Tier 3/4 declared surface)
// =============================================================================

/**
 * A single vector search hit. Returned by adapters that declare
 * `capabilities.vectorSearch`.
 */
export interface VectorSearchHit<T extends Record<string, unknown> = Record<string, unknown>> {
  /** The matching Thing record (with `$id` / `$type` injected by the adapter). */
  entity: T & { $id: string; $type: string }

  /** Similarity score in the metric the query used (higher is more similar). */
  score: number
}

/**
 * Tier-4 vector search method shape. Adapters that declare
 * `capabilities.vectorSearch` MUST implement this.
 */
export interface VectorSearchPort {
  /**
   * Search for the nearest entities to a query embedding.
   *
   * The query embedding's length MUST be `<=` the adapter's
   * `capabilities.vectorSearch.maxDimensions`. The metric MUST be one of
   * `capabilities.vectorSearch.metrics`.
   */
  vectorSearch<T extends Record<string, unknown> = Record<string, unknown>>(
    type: string,
    queryEmbedding: number[],
    options?: {
      metric?: VectorSimilarityMetric
      limit?: number
      minScore?: number
    }
  ): Promise<VectorSearchHit<T>[]>
}

/**
 * Tier-3 analytics surface. Concrete shape is intentionally narrow at
 * port level — full schema lives with the analytics adapter
 * (ClickHouse). This declaration exists so callers can detect and
 * route Tier-3 queries to a capable adapter.
 */
export interface AnalyticsPort {
  /**
   * Run a Tier-3 aggregation query. The query string is adapter-specific
   * (SQL-shaped for CH/PG; declarative DSL for future R2 SQL). Callers
   * that want portability use the upstream cascade-analytics helpers
   * rather than calling this directly.
   *
   * The shape is intentionally minimal in this bead. Future beads
   * (`aip-j3il`, `aip-peb5`) refine it.
   */
  analyticsQuery(
    query: string,
    params?: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>>
}

// =============================================================================
// The composed port — every adapter implements DBProvider + (optionally) the rest
// =============================================================================

/**
 * The full port surface a fully-loaded adapter (e.g., Stack A PG +
 * pgvector + analytics, Stack B DO SQLite + Vectorize) can satisfy.
 *
 * Most adapters satisfy a subset. The structural `DBProvider` from
 * `./schema/provider.ts` remains the *required* baseline; everything
 * else is declared.
 *
 * The optional `capabilities` getter is the canonical way to expose
 * tier capability declarations.
 */
export interface DBProviderPort extends DBProvider {
  /**
   * Tier capability declaration (sharding, analytics, vectorSearch,
   * SVO-recording flags). Optional for backward compatibility — absence
   * is interpreted by {@link getProviderCapabilities} as Tier 1+2 only,
   * `unsharded`.
   */
  capabilities?: ProviderTierCapabilities | (() => ProviderTierCapabilities)
}

// =============================================================================
// Capability discovery helpers
// =============================================================================

/**
 * Default capability declaration for adapters that don't expose one.
 * `'unsharded'`, no Tier 3, no Tier 4, no SVO action recording, no Verb
 * registry. Backward-compatible with every adapter shipped before this
 * port refinement.
 */
export const DEFAULT_TIER_CAPABILITIES: ProviderTierCapabilities = {
  adapter: 'unknown',
  shardingModel: 'unsharded',
  hasActionRecording: false,
  hasVerbRegistry: false,
}

/**
 * Read the capability declaration from a provider, falling back to
 * {@link DEFAULT_TIER_CAPABILITIES} when none is attached.
 *
 * Handles both forms — `capabilities` as a static object or as a getter
 * function — without forcing adapters to choose one shape.
 *
 * @example
 * ```ts
 * const caps = getProviderCapabilities(provider)
 * if (caps.vectorSearch && caps.vectorSearch.metrics.includes('cosine')) {
 *   // safe to issue cosine vector search
 * }
 * ```
 */
export function getProviderCapabilities(provider: DBProvider): ProviderTierCapabilities {
  const port = provider as DBProviderPort
  const raw = port.capabilities
  if (typeof raw === 'function') return raw()
  if (raw) return raw
  return DEFAULT_TIER_CAPABILITIES
}

/**
 * Type guard: does this provider satisfy the SVO Action-recording
 * surface ({@link DBProviderSVO.recordAction}, {@link DBProviderSVO.queryActions})?
 *
 * Checks both the runtime methods and the `capabilities.hasActionRecording`
 * flag — adapters should keep them in sync.
 */
export function hasActionRecording(
  provider: DBProvider
): provider is DBProvider & Pick<DBProviderSVO, 'recordAction' | 'queryActions'> {
  const p = provider as Partial<DBProviderSVO>
  return typeof p.recordAction === 'function' && typeof p.queryActions === 'function'
}

/**
 * Type guard: does this provider satisfy the Verb registry surface?
 */
export function hasVerbRegistry(
  provider: DBProvider
): provider is DBProvider & Pick<DBProviderSVO, 'defineVerb' | 'getVerb' | 'listVerbs'> {
  const p = provider as Partial<DBProviderSVO>
  return (
    typeof p.defineVerb === 'function' &&
    typeof p.getVerb === 'function' &&
    typeof p.listVerbs === 'function'
  )
}

/**
 * Type guard: does this provider implement Tier-4 vector search?
 *
 * Checks the runtime method *and* requires the capability declaration
 * to advertise `vectorSearch` — both must agree before callers can
 * route queries.
 */
export function hasVectorSearch(provider: DBProvider): provider is DBProvider & VectorSearchPort {
  const p = provider as Partial<VectorSearchPort>
  if (typeof p.vectorSearch !== 'function') return false
  const caps = getProviderCapabilities(provider)
  return caps.vectorSearch !== undefined
}

/**
 * Type guard: does this provider implement Tier-3 analytics?
 */
export function hasAnalytics(provider: DBProvider): provider is DBProvider & AnalyticsPort {
  const p = provider as Partial<AnalyticsPort>
  if (typeof p.analyticsQuery !== 'function') return false
  const caps = getProviderCapabilities(provider)
  return caps.analytics !== undefined
}

// =============================================================================
// Re-exports — keep the existing structural interface as the live shape
// =============================================================================

/**
 * Re-export the structural `DBProvider` and `Transaction` interfaces from
 * `./schema/provider.ts`. Importing them through this module signals
 * "I'm using the SVO-shaped port surface", but they're the same types
 * adapters have always implemented.
 */
export type {
  DBProvider,
  Transaction,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
}
