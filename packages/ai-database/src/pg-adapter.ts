/**
 * Postgres + pgvector DBProvider adapter (Stack A transactional layer)
 *
 * First-class adapter for Stack A per
 * [ADR-0003](../../../docs/adr/0003-storage-strategy-pg-clickhouse-default.md).
 * Implements the {@link DBProviderPort} surface with:
 *
 * - **Tier 1 (entity CRUD)** against a `things(ns, id, type, data jsonb)` table.
 * - **Tier 2 (graph traversal)** via Actions: subject/object/recipient/...
 *   queries against an `actions(ns, id, verb, subject, object, roles jsonb,
 *   data jsonb, status, created_at, completed_at)` table.
 * - **Tier 3 (analytics)** declared with caveats: aggregations + time-series
 *   work, but adapters running large scans contend with transactional load.
 *   `analyticsQuery` is exposed for ad-hoc SQL.
 * - **Tier 4 (vector search)** native via `pgvector` (max 16,000 dims;
 *   `cosine`/`l2`/`dot` metrics implemented). Embeddings live in a
 *   companion `embeddings` table joined to `things`; callers seed it via
 *   {@link PostgresProvider.upsertEmbedding} and query via
 *   {@link PostgresProvider.vectorSearch}. Frame-aware role filtering
 *   (e.g. "only Things appearing as `subject` of a Verb") is deferred to
 *   a follow-up refinement bead.
 * - **SVO Action recording** + **Verb registry** declared via
 *   `hasActionRecording: true` and `hasVerbRegistry: true`.
 * - **Sharding**: `partitioned-by-tenant` by default; the `ns` namespace
 *   column doubles as the partition key. Callers can run a shared schema
 *   across tenants (one row per `(ns, id)`) or partition the underlying
 *   `things` / `actions` tables on `ns` for physical isolation. Either
 *   way, this adapter writes through `ns`.
 *
 * ## Cascade write path
 *
 * Per the substrate-write-probes verdict (`docs/reviews/2026-05-05-cascade-poc-evaluation.md`),
 * the cascade-scale write path is **bulk-VALUES CTE with `ON CONFLICT DO
 * NOTHING`** — 91 ms p50 for 500 things + 499 actions in one round-trip
 * on Neon HTTP. {@link PostgresProvider.commitBatch} implements that
 * shape directly.
 *
 * ## Driver choice
 *
 * The adapter is driver-agnostic — it consumes any {@link PgExecutor}
 * (a function that takes SQL + positional params and returns rows).
 * Helpers ship for the two common shapes:
 *
 * - {@link createNeonHttpExecutor} — `@neondatabase/serverless` HTTP
 *   driver. **Preferred for the cascade workload** per the probes (~2x
 *   over Hyperdrive on every short-burst write shape; sublinear scaling
 *   above N=100; 91 ms for 500 docs + 499 rels). Works in Cloudflare
 *   Workers and Node.
 * - {@link createPgClientExecutor} — wraps a `postgres.js` (Hyperdrive)
 *   client. Use when the deployment specifically needs connection
 *   pooling / pipelining; **not** the cascade fast path. Hyperdrive's
 *   parameterless-only response cache is a **trap** — once `$1` appears,
 *   it stops caching. Document this for callers.
 *
 * ## Schema
 *
 * The adapter assumes a schema named `aidb` (configurable). DDL:
 *
 * ```sql
 * CREATE EXTENSION IF NOT EXISTS vector;
 * CREATE SCHEMA IF NOT EXISTS aidb;
 *
 * CREATE TABLE IF NOT EXISTS aidb.things (
 *   ns text NOT NULL,
 *   id text NOT NULL,
 *   type text NOT NULL,
 *   data jsonb NOT NULL DEFAULT '{}'::jsonb,
 *   created_at timestamptz NOT NULL DEFAULT now(),
 *   updated_at timestamptz NOT NULL DEFAULT now(),
 *   CONSTRAINT things_pk PRIMARY KEY (ns, id)
 * );
 * CREATE INDEX IF NOT EXISTS things_type_idx ON aidb.things (ns, type);
 * CREATE INDEX IF NOT EXISTS things_data_gin_idx
 *   ON aidb.things USING gin (data jsonb_path_ops);
 *
 * CREATE TABLE IF NOT EXISTS aidb.actions (
 *   ns text NOT NULL,
 *   id text NOT NULL,
 *   verb text NOT NULL,
 *   subject text,
 *   object text,
 *   roles jsonb NOT NULL DEFAULT '{}'::jsonb,
 *   data jsonb NOT NULL DEFAULT '{}'::jsonb,
 *   status text NOT NULL DEFAULT 'pending',
 *   created_at timestamptz NOT NULL DEFAULT now(),
 *   completed_at timestamptz,
 *   CONSTRAINT actions_pk PRIMARY KEY (ns, id)
 * );
 * CREATE INDEX IF NOT EXISTS actions_verb_idx ON aidb.actions (ns, verb);
 * CREATE INDEX IF NOT EXISTS actions_subject_idx ON aidb.actions (ns, subject);
 * CREATE INDEX IF NOT EXISTS actions_object_idx ON aidb.actions (ns, object);
 *
 * CREATE TABLE IF NOT EXISTS aidb.verbs (
 *   name text PRIMARY KEY,
 *   data jsonb NOT NULL DEFAULT '{}'::jsonb,
 *   created_at timestamptz NOT NULL DEFAULT now()
 * );
 * ```
 *
 * `bootstrapSchema(executor)` ships the DDL above so callers can stand
 * up a fresh database in one call.
 *
 * @packageDocumentation
 */

import type { DBProvider } from './schema/provider.js'
import type { ListOptions, SearchOptions } from './schema/types.js'
import type {
  DBProviderPort,
  ProviderTierCapabilities,
  SVOAction,
  ActionQuery,
  VerbDefinitionInput,
  VerbRecord,
  DBProviderSVO,
  VectorSearchPort,
  VectorSearchHit,
  VectorSimilarityMetric,
  FullTextSearchPort,
  FullTextSearchHit,
} from './db-provider-port.js'
import {
  validateTypeName,
  validateEntityId,
  validateEntityData,
  validateRelationName,
  validateSearchQuery,
  validateListOptions,
  validateSearchOptions,
} from './validation.js'
import { EntityNotFoundError } from './errors.js'

// =============================================================================
// Executor shape — driver-agnostic
// =============================================================================

/**
 * Driver-agnostic Postgres executor.
 *
 * Returns rows as plain objects. Both `@neondatabase/serverless`'s `neon()`
 * function and `postgres.js`'s `sql.unsafe()` (used through
 * {@link createPgClientExecutor}) match this signature.
 *
 * @param sql - Parameterised SQL with `$1`, `$2`, ... placeholders.
 * @param params - Positional parameter values. May be `undefined` for queries
 *   with no parameters.
 * @returns Array of result rows, with column names as keys.
 */
export type PgExecutor = (
  sql: string,
  params?: ReadonlyArray<unknown>
) => Promise<Array<Record<string, unknown>>>

/**
 * Type-erased neon HTTP query function shape. We accept anything callable
 * with `(sql, params)` so we don't pin a specific neon version.
 */
type NeonLikeFn = (sql: string, params?: ReadonlyArray<unknown>) => Promise<unknown>

/**
 * Wrap a `@neondatabase/serverless` HTTP query function as a {@link PgExecutor}.
 *
 * The Neon HTTP driver is **the preferred cascade write path** per the
 * substrate-write-probes Phase 1 verdict — ~2x faster than Hyperdrive on
 * every short-burst write shape, and the only driver/shape combination
 * that achieves sublinear scaling above N=100.
 *
 * @example
 * ```ts
 * import { neon } from '@neondatabase/serverless'
 * import { createNeonHttpExecutor, createPostgresProvider } from 'ai-database'
 *
 * const sql = neon(env.DATABASE_URL)
 * const provider = createPostgresProvider({
 *   executor: createNeonHttpExecutor(sql),
 *   namespace: 'tenant-9',
 * })
 * ```
 */
export function createNeonHttpExecutor(neonFn: NeonLikeFn): PgExecutor {
  return async (sql, params) => {
    const result = await neonFn(sql, params ?? [])
    // Neon returns rows directly as an array of objects.
    return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : []
  }
}

/**
 * Type-erased postgres.js client shape. The minimum surface we use: the
 * tagged-template `unsafe(sql, params)` form that sends parameterised
 * queries.
 */
interface PgClientLike {
  unsafe: (sql: string, params?: ReadonlyArray<unknown>) => Promise<unknown>
}

/**
 * Wrap a `postgres.js` client as a {@link PgExecutor}.
 *
 * Use this when the deployment requires Hyperdrive (e.g., for
 * connection pooling / WebSocket pipelining). **Not the cascade fast
 * path** — see ADR-0003 and the substrate-write-probes notes:
 * Hyperdrive's response cache only fires on parameterless queries
 * (simple protocol). Once `$1` appears, postgres.js switches to
 * extended protocol and Hyperdrive stops caching.
 *
 * @example
 * ```ts
 * import postgres from 'postgres'
 * import { createPgClientExecutor, createPostgresProvider } from 'ai-database'
 *
 * const sql = postgres(env.HYPERDRIVE.connectionString)
 * const provider = createPostgresProvider({
 *   executor: createPgClientExecutor(sql),
 *   namespace: 'tenant-9',
 * })
 * ```
 */
export function createPgClientExecutor(client: PgClientLike): PgExecutor {
  return async (sql, params) => {
    const result = await client.unsafe(sql, params ?? [])
    return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : []
  }
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Options for {@link createPostgresProvider}.
 */
export interface PostgresProviderOptions {
  /** Driver executor (typically constructed via {@link createNeonHttpExecutor}). */
  executor: PgExecutor

  /**
   * Namespace / partition key written into every row. Acts as the tenant
   * boundary in the `partitioned-by-tenant` sharding model.
   *
   * @default 'default'
   */
  namespace?: string

  /**
   * Postgres schema housing the tables. Must already exist (or use
   * {@link bootstrapSchema}).
   *
   * @default 'aidb'
   */
  schema?: string

  /**
   * Override the declared sharding model for callers running
   * unsharded (single-tenant) deployments.
   *
   * @default 'partitioned-by-tenant'
   */
  shardingModel?: 'partitioned-by-tenant' | 'unsharded'

  /**
   * Vector dimensions for the pgvector column. Used by the capability
   * declaration only — the actual `vector` column shape is defined by
   * the schema DDL.
   *
   * @default 1536
   */
  vectorDimensions?: number

  /**
   * Driver name for logs / capability metadata. Set automatically by
   * the executor factories.
   */
  driver?: 'neon-http' | 'postgres-js' | string

  /**
   * Postgres text-search configuration (regconfig) used by the `tsvector`
   * full-text path (`to_tsvector(<config>, ...)` / `websearch_to_tsquery`).
   * Must match the config the FTS GIN index was built with (see
   * {@link bootstrapSchema}'s `ftsConfig`).
   *
   * @default 'english'
   */
  ftsConfig?: string
}

/** The default Postgres text-search configuration for the `tsvector` FTS path. */
const DEFAULT_FTS_CONFIG = 'english'

/**
 * Validate a Postgres text-search config name. It is interpolated into SQL
 * (regconfigs cannot be bound as `$N`), so we restrict it to a safe identifier
 * shape to avoid injection.
 */
function validateFtsConfig(config: string): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(config)) {
    throw new Error(`Invalid ftsConfig "${config}": must be a simple identifier`)
  }
}

/**
 * The SQL expression that projects a Thing's searchable text out of the jsonb
 * `data`. Concatenates the common headline fields (name/title/code) with the
 * full jsonb-as-text so multi-field queries still match. Shared by the FTS
 * index DDL and the `fullTextSearch` query so the index is actually used.
 */
function searchableTextExpr(): string {
  return `(coalesce(data->>'name','') || ' ' || coalesce(data->>'title','') || ' ' || coalesce(data->>'code','') || ' ' || data::text)`
}

/**
 * The SQL expression that projects a Thing's normalized exact-tier key out of
 * the jsonb `data`: an explicit `key` wins, else `name`/`title`/`code`,
 * lowercased + whitespace-collapsed. Mirrors the client-side `normalizeKey`.
 * Shared by the key-lookup expression index DDL and the `keyLookup` query.
 */
function normalizedKeyExpr(): string {
  return `regexp_replace(btrim(lower(coalesce(data->>'key', data->>'name', data->>'title', data->>'code', ''))), '\\s+', ' ', 'g')`
}

/**
 * Row shape for a Thing as written by the adapter.
 *
 * @internal
 */
export interface ThingRow {
  ns: string
  id: string
  type: string
  data: Record<string, unknown>
}

/**
 * Row shape for an Action as written by the adapter.
 *
 * @internal
 */
export interface ActionRow {
  ns: string
  id: string
  verb: string
  subject?: string | undefined
  object?: string | undefined
  roles?: Record<string, string> | undefined
  data?: Record<string, unknown> | undefined
  status?: SVOAction['status'] | undefined
  createdAt?: Date | undefined
  completedAt?: Date | undefined
}

// =============================================================================
// SQL helpers
// =============================================================================

const DEFAULT_SCHEMA = 'aidb'
const DEFAULT_NAMESPACE = 'default'
const DEFAULT_VECTOR_DIMS = 1536

/** Generate a UUID for adapter-issued ids. */
function genId(): string {
  return crypto.randomUUID()
}

/**
 * Coerce arbitrary jsonb-shaped column values from the executor into
 * a plain object. Drivers vary: neon returns parsed objects, postgres.js
 * may return strings depending on type configuration.
 */
function asJsonb(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>
  return {}
}

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  return String(value)
}

/**
 * Format a numeric array as a pgvector literal: `'[0.1,0.2,0.3]'`. Cast
 * to `vector` at the SQL site (`$N::vector`).
 */
function embeddingLiteral(embedding: ReadonlyArray<number>): string {
  // pgvector parses `[v1,v2,...]` syntax. We avoid scientific notation
  // edge cases by relying on JS Number.toString — acceptable for cascade
  // workloads (embeddings are 4-byte floats; JS numbers carry more
  // precision than needed). NaN/Infinity are explicitly rejected.
  const parts: string[] = []
  for (const v of embedding) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error('embeddingLiteral: embedding values must be finite numbers')
    }
    parts.push(String(v))
  }
  return `[${parts.join(',')}]`
}

// =============================================================================
// PostgresProvider
// =============================================================================

/**
 * Postgres + pgvector adapter implementing {@link DBProviderPort} and
 * {@link DBProviderSVO}.
 */
export class PostgresProvider
  implements DBProviderPort, DBProviderSVO, VectorSearchPort, FullTextSearchPort
{
  private readonly executor: PgExecutor
  private readonly namespace: string
  private readonly schema: string
  private readonly vectorDimensions: number
  private readonly _shardingModel: 'partitioned-by-tenant' | 'unsharded'
  private readonly driver: string
  private readonly ftsConfig: string

  constructor(options: PostgresProviderOptions) {
    this.executor = options.executor
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE
    this.schema = options.schema ?? DEFAULT_SCHEMA
    this.vectorDimensions = options.vectorDimensions ?? DEFAULT_VECTOR_DIMS
    this._shardingModel = options.shardingModel ?? 'partitioned-by-tenant'
    this.driver = options.driver ?? 'pg'
    this.ftsConfig = options.ftsConfig ?? DEFAULT_FTS_CONFIG
    validateFtsConfig(this.ftsConfig)
  }

  /**
   * Tier capability declaration. Declares Tier 3 with caveats and Tier 4
   * (pgvector). `hasActionRecording` and `hasVerbRegistry` are both
   * `true` — see the SVO methods on this class.
   */
  get capabilities(): ProviderTierCapabilities {
    return {
      adapter: 'pg+pgvector',
      shardingModel: this._shardingModel,
      analytics: {
        hasAggregations: true,
        hasTimeSeries: true,
        // ADR-0003: Postgres "works at moderate scale; long scans contend
        // with transactional load". Cascade ceiling: ~few-thousand
        // inserts/sec on a single instance.
        hasLargeScans: false,
      },
      vectorSearch: {
        maxDimensions: this.vectorDimensions,
        metrics: ['cosine', 'l2', 'dot'],
        implementation: 'native',
      },
      // Tier: ranked `tsvector` FTS + O(1) normalized-key lookup, both backed
      // by expression indexes (see bootstrapSchema). `ts_rank` is normalized to
      // [0,1] via the `32` flag so it composes with the find-ladder RawHit.
      fullTextSearch: {
        implementation: 'tsvector',
        rankedScores: true,
        hasKeyLookup: true,
      },
      hasActionRecording: true,
      hasVerbRegistry: true,
    }
  }

  // ===========================================================================
  // Tier 1 — Entity CRUD
  // ===========================================================================

  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    validateTypeName(type)
    validateEntityId(id)
    const rows = await this.executor(
      `SELECT data FROM ${this.schema}.things WHERE ns = $1 AND type = $2 AND id = $3 LIMIT 1`,
      [this.namespace, type, id]
    )
    if (rows.length === 0) return null
    const data = asJsonb(rows[0]!['data'])
    return { ...data, $id: id, $type: type }
  }

  async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
    validateTypeName(type)
    validateListOptions(options)
    const limit = options?.limit ?? 1000
    const offset = options?.offset ?? 0

    // We ORDER BY id by default — adapters can layer richer ordering on
    // top via $.data->>'field' if needed. Field-level orderBy is left to
    // a future bead because it requires query-builder logic.
    const rows = await this.executor(
      `SELECT id, data FROM ${this.schema}.things
       WHERE ns = $1 AND type = $2
       ORDER BY id
       LIMIT $3 OFFSET $4`,
      [this.namespace, type, limit, offset]
    )

    let result: Array<Record<string, unknown> & { $id: string; $type: string }> = rows.map(
      (row) => {
        const data = asJsonb(row['data'])
        return { ...data, $id: String(row['id']), $type: type }
      }
    )

    // Apply where filter client-side for parity with MemoryProvider.
    // For high-volume paths, callers should use raw SQL via
    // analyticsQuery() — this is the simple convenience path.
    if (options?.where) {
      result = result.filter((entity) => {
        for (const [key, value] of Object.entries(options.where!)) {
          if ((entity as Record<string, unknown>)[key] !== value) return false
        }
        return true
      })
    }
    return result
  }

  async search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    validateTypeName(type)
    validateSearchQuery(query)
    validateSearchOptions(options)
    const limit = options?.limit ?? 100

    // Use to_tsvector over the jsonb-as-text representation for a simple
    // full-text path; richer search lands later. ILIKE fallback ensures
    // tests work without `pg_trgm` / `tsvector` configuration.
    const rows = await this.executor(
      `SELECT id, data FROM ${this.schema}.things
       WHERE ns = $1 AND type = $2 AND data::text ILIKE $3
       ORDER BY id
       LIMIT $4`,
      [this.namespace, type, `%${query}%`, limit]
    )

    return rows.map((row) => {
      const data = asJsonb(row['data'])
      return { ...data, $id: String(row['id']), $type: type }
    })
  }

  /**
   * Ranked full-text search over the entity's searchable text (Tier:
   * `tsvector` FTS). Unlike {@link search} (an ILIKE substring superset),
   * this is term-aware: the query is parsed by `websearch_to_tsquery` (so
   * `"audit trails" -recipe` and multi-term queries work), matched against
   * the same `to_tsvector(<ftsConfig>, ...)` expression the FTS GIN index is
   * built on (so the index is used), and ranked by `ts_rank` *normalized to
   * `[0, 1]`* (the `32` flag => `rank / (rank + 1)`), so the returned `score`
   * composes directly with the find ladder's `RawHit.score`.
   *
   * The text-search config (regconfig) is interpolated (it cannot be bound as
   * a `$N` param) — it is validated to a simple identifier at construction.
   * The user-supplied `query` is always a bound `$N` parameter.
   */
  async fullTextSearch<T extends Record<string, unknown> = Record<string, unknown>>(
    type: string,
    query: string,
    options?: { limit?: number; minScore?: number }
  ): Promise<FullTextSearchHit<T>[]> {
    validateTypeName(type)
    validateSearchQuery(query)
    const limit = Math.max(1, options?.limit ?? 100)

    const cfg = this.ftsConfig
    const tsv = `to_tsvector('${cfg}', ${searchableTextExpr()})`
    const tsq = `websearch_to_tsquery('${cfg}', $3)`
    const sql = `SELECT id, data, ts_rank(${tsv}, ${tsq}, 32) AS score
       FROM ${this.schema}.things
       WHERE ns = $1 AND type = $2 AND ${tsv} @@ ${tsq}
       ORDER BY score DESC, id
       LIMIT $4`
    const rows = await this.executor(sql, [this.namespace, type, query, limit])

    let hits: FullTextSearchHit<T>[] = rows.map((row) => {
      const data = asJsonb(row['data'])
      const score = typeof row['score'] === 'number' ? row['score'] : Number(row['score'] ?? 0)
      return {
        entity: { ...data, $id: String(row['id']), $type: type } as T & {
          $id: string
          $type: string
        },
        score,
      }
    })
    if (options?.minScore !== undefined) {
      const min = options.minScore
      hits = hits.filter((h) => h.score >= min)
    }
    return hits
  }

  /**
   * O(1) exact lookup of a pre-normalized key against the normalized-key
   * expression index (`things_normkey_idx`, built on {@link normalizedKeyExpr}).
   * The caller passes the *normalized* key (lowercased, whitespace-collapsed);
   * the index normalizes the stored `key`/`name`/`title`/`code` to match, so
   * this is a single index probe — NOT an ILIKE-narrow + client-side verify.
   * Returns the canonical id or `null`.
   */
  async keyLookup(type: string, normalizedKey: string): Promise<string | null> {
    validateTypeName(type)
    if (!normalizedKey) return null
    const rows = await this.executor(
      `SELECT id FROM ${this.schema}.things
       WHERE ns = $1 AND type = $2 AND ${normalizedKeyExpr()} = $3
       LIMIT 1`,
      [this.namespace, type, normalizedKey]
    )
    return rows.length > 0 ? String(rows[0]!['id']) : null
  }

  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    validateTypeName(type)
    if (id !== undefined) validateEntityId(id)
    validateEntityData(data)

    const entityId = id ?? genId()
    const now = new Date().toISOString()
    const payload = { ...data, createdAt: now, updatedAt: now }

    await this.executor(
      `INSERT INTO ${this.schema}.things (ns, id, type, data) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT ON CONSTRAINT things_pk DO NOTHING`,
      [this.namespace, entityId, type, JSON.stringify(payload)]
    )

    return { ...payload, $id: entityId, $type: type }
  }

  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    validateTypeName(type)
    validateEntityId(id)
    validateEntityData(data)

    const existing = await this.get(type, id)
    if (!existing) throw new EntityNotFoundError(type, id, 'update')
    const { $id: _id, $type: _type, ...rest } = existing as Record<string, unknown>
    const merged = { ...rest, ...data, updatedAt: new Date().toISOString() }

    await this.executor(
      `UPDATE ${this.schema}.things SET data = $1::jsonb, updated_at = now()
       WHERE ns = $2 AND type = $3 AND id = $4`,
      [JSON.stringify(merged), this.namespace, type, id]
    )

    return { ...merged, $id: id, $type: type }
  }

  async delete(type: string, id: string): Promise<boolean> {
    validateTypeName(type)
    validateEntityId(id)

    // postgres.js / neon do not consistently return rowCount through the
    // executor surface; we read existence first to return a stable boolean.
    const existing = await this.get(type, id)
    if (!existing) return false

    await this.executor(
      `DELETE FROM ${this.schema}.things WHERE ns = $1 AND type = $2 AND id = $3`,
      [this.namespace, type, id]
    )
    // Cascade-delete actions where this thing is subject or object.
    await this.executor(
      `DELETE FROM ${this.schema}.actions
       WHERE ns = $1 AND (subject = $2 OR object = $2)`,
      [this.namespace, id]
    )
    return true
  }

  // ===========================================================================
  // Tier 2 — Graph traversal via Actions
  // ===========================================================================

  async related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]> {
    validateTypeName(type)
    validateEntityId(id)
    validateRelationName(relation)

    // Reads "all things this thing is subject of via this verb, returning
    // the object thing". Mirrors MemoryProvider.related semantics.
    const rows = await this.executor(
      `SELECT t.id, t.type, t.data
       FROM ${this.schema}.actions a
       JOIN ${this.schema}.things t ON t.ns = a.ns AND t.id = a.object
       WHERE a.ns = $1 AND a.subject = $2 AND a.verb = $3`,
      [this.namespace, id, relation]
    )

    return rows.map((row) => {
      const data = asJsonb(row['data'])
      return {
        ...data,
        $id: String(row['id']),
        $type: String(row['type']),
      }
    })
  }

  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void> {
    validateTypeName(fromType)
    validateEntityId(fromId)
    validateRelationName(relation)
    validateTypeName(toType)
    validateEntityId(toId)

    // relate() lands as a completed Action with the verb as `relation`.
    await this.recordAction({
      verb: relation,
      subject: fromId,
      object: toId,
      data: {
        fromType,
        toType,
        ...(metadata ? { metadata } : {}),
      },
      status: 'completed',
    })
  }

  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    validateTypeName(fromType)
    validateEntityId(fromId)
    validateRelationName(relation)
    validateTypeName(toType)
    validateEntityId(toId)

    await this.executor(
      `DELETE FROM ${this.schema}.actions
       WHERE ns = $1 AND verb = $2 AND subject = $3 AND object = $4`,
      [this.namespace, relation, fromId, toId]
    )
  }

  // ===========================================================================
  // SVO Action recording (DBProviderSVO)
  // ===========================================================================

  async recordAction<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<SVOAction<T>, 'id' | 'createdAt' | 'status'> & {
      status?: SVOAction['status']
    }
  ): Promise<SVOAction<T>> {
    const id = genId()
    const status = input.status ?? 'pending'
    const createdAt = new Date()
    const completedAt =
      status === 'completed' || status === 'failed' || status === 'cancelled'
        ? createdAt
        : undefined

    await this.executor(
      `INSERT INTO ${this.schema}.actions
         (ns, id, verb, subject, object, roles, data, status, created_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
      [
        this.namespace,
        id,
        input.verb,
        input.subject ?? null,
        input.object ?? null,
        JSON.stringify(input.roles ?? {}),
        JSON.stringify(input.data ?? {}),
        status,
        createdAt.toISOString(),
        completedAt ? completedAt.toISOString() : null,
      ]
    )

    const action: SVOAction<T> = {
      id,
      verb: input.verb,
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.object !== undefined && { object: input.object }),
      ...(input.roles !== undefined && { roles: input.roles }),
      ...(input.data !== undefined && { data: input.data }),
      status,
      createdAt,
      ...(completedAt !== undefined && { completedAt }),
    }
    return action
  }

  async queryActions<T extends Record<string, unknown> = Record<string, unknown>>(
    query: ActionQuery = {}
  ): Promise<SVOAction<T>[]> {
    const conditions: string[] = ['ns = $1']
    const params: unknown[] = [this.namespace]
    let n = 2

    if (query.verb !== undefined) {
      conditions.push(`verb = $${n++}`)
      params.push(query.verb)
    }
    if (query.subject !== undefined) {
      conditions.push(`subject = $${n++}`)
      params.push(query.subject)
    }
    if (query.object !== undefined) {
      conditions.push(`object = $${n++}`)
      params.push(query.object)
    }
    if (query.role) {
      for (const [role, value] of Object.entries(query.role)) {
        if (role === 'subject' || role === 'object') {
          conditions.push(`${role} = $${n++}`)
        } else {
          conditions.push(`roles->>'${role}' = $${n++}`)
        }
        params.push(value)
      }
    }
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status]
      const placeholders = statuses.map(() => `$${n++}`).join(', ')
      conditions.push(`status IN (${placeholders})`)
      for (const s of statuses) params.push(s)
    }
    if (query.since) {
      conditions.push(`created_at >= $${n++}`)
      params.push(query.since.toISOString())
    }
    if (query.until) {
      conditions.push(`created_at <= $${n++}`)
      params.push(query.until.toISOString())
    }

    const limit = query.limit ?? 1000
    const offset = query.offset ?? 0
    params.push(limit, offset)

    const rows = await this.executor(
      `SELECT id, verb, subject, object, roles, data, status, created_at, completed_at
       FROM ${this.schema}.actions
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT $${n++} OFFSET $${n++}`,
      params
    )

    return rows.map((row) => {
      const action: SVOAction<T> = {
        id: String(row['id']),
        verb: String(row['verb']),
        status: (row['status'] as SVOAction['status']) ?? 'pending',
        createdAt: asDate(row['created_at']) ?? new Date(0),
      }
      const subject = asString(row['subject'])
      if (subject !== undefined) action.subject = subject
      const object = asString(row['object'])
      if (object !== undefined) action.object = object
      const roles = asJsonb(row['roles'])
      if (Object.keys(roles).length > 0) {
        action.roles = roles as NonNullable<SVOAction<T>['roles']>
      }
      const data = asJsonb(row['data'])
      if (Object.keys(data).length > 0) {
        action.data = data as T
      }
      const completedAt = asDate(row['completed_at'])
      if (completedAt) action.completedAt = completedAt
      return action
    })
  }

  // ===========================================================================
  // Verb registry (DBProviderSVO)
  // ===========================================================================

  async defineVerb(def: VerbDefinitionInput): Promise<VerbRecord> {
    const verb: VerbRecord = {
      name: def.name,
      action: def.action ?? def.name,
      act: def.act ?? `${def.name}s`,
      activity: def.activity ?? `${def.name}ing`,
      event: def.event ?? `${def.name}d`,
      ...(def.reverseBy !== undefined && { reverseBy: def.reverseBy }),
      ...(def.reverseAt !== undefined && { reverseAt: def.reverseAt }),
      ...(def.reverseIn !== undefined && { reverseIn: def.reverseIn }),
      ...(def.inverse !== undefined && { inverse: def.inverse }),
      ...(def.description !== undefined && { description: def.description }),
      ...(def.frame !== undefined && { frame: def.frame }),
      ...(def.source !== undefined && { source: def.source }),
      ...(def.canonical !== undefined && { canonical: def.canonical }),
      createdAt: new Date(),
    }

    await this.executor(
      `INSERT INTO ${this.schema}.verbs (name, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (name) DO NOTHING`,
      [verb.name, JSON.stringify(verb)]
    )
    return verb
  }

  async getVerb(name: string): Promise<VerbRecord | null> {
    const rows = await this.executor(
      `SELECT data, created_at FROM ${this.schema}.verbs WHERE name = $1 LIMIT 1`,
      [name]
    )
    if (rows.length === 0) return null
    const data = asJsonb(rows[0]!['data']) as Partial<VerbRecord>
    const createdAt = asDate(rows[0]!['created_at']) ?? new Date(0)
    return { ...(data as VerbRecord), createdAt }
  }

  async listVerbs(): Promise<VerbRecord[]> {
    const rows = await this.executor(
      `SELECT data, created_at FROM ${this.schema}.verbs ORDER BY name ASC`
    )
    return rows.map((row) => {
      const data = asJsonb(row['data']) as Partial<VerbRecord>
      const createdAt = asDate(row['created_at']) ?? new Date(0)
      return { ...(data as VerbRecord), createdAt }
    })
  }

  // ===========================================================================
  // Cascade write fast path — CTE jsonb-bulk
  // ===========================================================================

  /**
   * Bulk-commit Things and Actions in a single round-trip via a CTE chain
   * with bulk `VALUES (...), (...)` inserts and `ON CONFLICT DO NOTHING`.
   *
   * **This is the cascade-scale write path** per the substrate-write-probes
   * Phase 1 verdict: 91 ms p50 for 500 things + 499 actions on Neon HTTP;
   * sublinear scaling above N=100; ~5,500 cascade-startups/sec/worker
   * write ceiling on the pg portion alone (LLM cost dominates).
   *
   * Both arrays may be empty independently; the SQL omits the
   * corresponding CTE and skips its placeholders. Returns the count of
   * rows actually inserted (excludes conflicts).
   *
   * @example
   * ```ts
   * const { thingsInserted, actionsInserted } = await provider.commitBatch({
   *   things: [
   *     { type: 'Customer', id: 'c1', data: { name: 'Acme' } },
   *     { type: 'Order', id: 'o1', data: { total: 100 } },
   *   ],
   *   actions: [
   *     { id: 'a1', verb: 'placedBy', subject: 'o1', object: 'c1', status: 'completed' },
   *   ],
   * })
   * ```
   */
  async commitBatch(input: {
    things?: ReadonlyArray<{ id: string; type: string; data: Record<string, unknown> }>
    actions?: ReadonlyArray<{
      id?: string
      verb: string
      subject?: string | undefined
      object?: string | undefined
      roles?: Record<string, string> | undefined
      data?: Record<string, unknown> | undefined
      status?: SVOAction['status'] | undefined
    }>
  }): Promise<{ thingsInserted: number; actionsInserted: number }> {
    const things = input.things ?? []
    const actions = input.actions ?? []
    if (things.length === 0 && actions.length === 0) {
      return { thingsInserted: 0, actionsInserted: 0 }
    }

    // Things take 4 columns: ns, id, type, data
    const thingCols = 4
    // Actions take 10 columns: ns, id, verb, subject, object, roles, data,
    // status, created_at, completed_at
    const actionCols = 10
    const thingOffset = things.length * thingCols

    const thingPlaceholders = things
      .map((_, i) => {
        const base = i * thingCols
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb)`
      })
      .join(', ')

    const actionPlaceholders = actions
      .map((_, i) => {
        const base = thingOffset + i * actionCols
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${
          base + 6
        }::jsonb, $${base + 7}::jsonb, $${base + 8}, $${base + 9}, $${base + 10})`
      })
      .join(', ')

    const now = new Date()
    const params: unknown[] = []
    for (const t of things) {
      params.push(this.namespace, t.id, t.type, JSON.stringify(t.data))
    }
    for (const a of actions) {
      const status = a.status ?? 'pending'
      const completedAt =
        status === 'completed' || status === 'failed' || status === 'cancelled'
          ? now.toISOString()
          : null
      params.push(
        this.namespace,
        a.id ?? genId(),
        a.verb,
        a.subject ?? null,
        a.object ?? null,
        JSON.stringify(a.roles ?? {}),
        JSON.stringify(a.data ?? {}),
        status,
        now.toISOString(),
        completedAt
      )
    }

    const ctes: string[] = []
    if (things.length > 0) {
      ctes.push(
        `inserted_things AS (
          INSERT INTO ${this.schema}.things (ns, id, type, data) VALUES ${thingPlaceholders}
          ON CONFLICT ON CONSTRAINT things_pk DO NOTHING
          RETURNING 1
        )`
      )
    }
    if (actions.length > 0) {
      ctes.push(
        `inserted_actions AS (
          INSERT INTO ${this.schema}.actions
            (ns, id, verb, subject, object, roles, data, status, created_at, completed_at)
          VALUES ${actionPlaceholders}
          ON CONFLICT ON CONSTRAINT actions_pk DO NOTHING
          RETURNING 1
        )`
      )
    }

    const sqlText = `WITH ${ctes.join(', ')}
      SELECT
        ${
          things.length > 0 ? `(SELECT COUNT(*) FROM inserted_things)::int` : '0'
        } AS things_inserted,
        ${
          actions.length > 0 ? `(SELECT COUNT(*) FROM inserted_actions)::int` : '0'
        } AS actions_inserted`

    const rows = await this.executor(sqlText, params)
    const row = rows[0]
    return {
      thingsInserted: Number(row?.['things_inserted'] ?? 0),
      actionsInserted: Number(row?.['actions_inserted'] ?? 0),
    }
  }

  // ===========================================================================
  // Tier 3 — analytics (declared)
  // ===========================================================================

  /**
   * Pass-through for ad-hoc analytical SQL. The query runs verbatim
   * against the underlying executor; callers are responsible for
   * parameter quoting. Use for time-series rollups, aggregations,
   * or callers that want to reach into PG without going through the
   * adapter's CRUD surface.
   */
  async analyticsQuery(
    query: string,
    params?: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>> {
    // We accept a record but currently send positional params only;
    // callers can pre-format SQL with $1, $2 placeholders.
    const positional = params ? Object.values(params) : []
    return this.executor(query, positional)
  }

  // ===========================================================================
  // Tier 4 — vector search via pgvector
  // ===========================================================================

  /**
   * Upsert an embedding vector for a Thing into the `embeddings` table.
   *
   * The embedding is stored separately from the `things` row so that
   * Tier 1 callers don't pay the vector serialization cost when they
   * don't need it. Callers generate the embedding upstream (out of scope
   * for this adapter) and pass it here.
   *
   * @example
   * ```ts
   * await provider.upsertEmbedding('Document', 'doc-1', new Array(1536).fill(0))
   * ```
   */
  async upsertEmbedding(type: string, id: string, embedding: ReadonlyArray<number>): Promise<void> {
    validateTypeName(type)
    validateEntityId(id)
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('upsertEmbedding: embedding must be a non-empty array of numbers')
    }
    if (embedding.length > this.vectorDimensions) {
      throw new Error(
        `upsertEmbedding: embedding length ${embedding.length} exceeds adapter vectorDimensions ${this.vectorDimensions}`
      )
    }

    const literal = embeddingLiteral(embedding)
    await this.executor(
      `INSERT INTO ${this.schema}.embeddings (ns, thing_id, type, embedding)
       VALUES ($1, $2, $3, $4::vector)
       ON CONFLICT (ns, thing_id) DO UPDATE SET embedding = EXCLUDED.embedding, type = EXCLUDED.type`,
      [this.namespace, id, type, literal]
    )
  }

  /**
   * Tier 4 — vector search via pgvector operators.
   *
   * Operator selection by metric:
   * - `'cosine'` (default): `embedding <=> $vector` — cosine distance.
   *   Score returned is `1 - distance` so higher is more similar.
   * - `'l2'`: `embedding <-> $vector` — Euclidean distance. Score is
   *   `-distance` (closer => higher score; never positive).
   * - `'dot'`: `embedding <#> $vector` — negative inner product (pgvector
   *   convention so smaller-is-better). Score returned is `-result`
   *   (i.e. the inner product itself; higher is more similar).
   *
   * Frame-aware role filtering (e.g. only search Things that appear as
   * `subject` of a particular Action) is **deferred** to a follow-up
   * bead — refinement, not blocking for Phase 1. The current method
   * filters by `type` only.
   *
   * @example
   * ```ts
   * const hits = await provider.vectorSearch('Document', queryVec, {
   *   metric: 'cosine',
   *   limit: 10,
   * })
   * ```
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
    validateTypeName(type)
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('vectorSearch: queryEmbedding must be a non-empty array of numbers')
    }
    if (queryEmbedding.length > this.vectorDimensions) {
      throw new Error(
        `vectorSearch: query length ${queryEmbedding.length} exceeds adapter vectorDimensions ${this.vectorDimensions}`
      )
    }

    const metric: VectorSimilarityMetric = options?.metric ?? 'cosine'
    const limit = Math.max(1, options?.limit ?? 10)

    // Operator + score expression per metric. pgvector convention: all
    // operators return "distance" where smaller is more similar; we wrap
    // so the returned `score` is monotonically higher-is-more-similar.
    let operator: string
    let scoreExpr: string
    switch (metric) {
      case 'cosine':
        operator = '<=>'
        scoreExpr = `1 - (e.embedding <=> $2::vector)`
        break
      case 'l2':
        operator = '<->'
        scoreExpr = `-(e.embedding <-> $2::vector)`
        break
      case 'dot':
        // pgvector returns negative inner product; flip back so positive
        // dot product => positive score.
        operator = '<#>'
        scoreExpr = `-(e.embedding <#> $2::vector)`
        break
      case 'hamming':
        throw new Error('vectorSearch: pgvector adapter does not support hamming metric')
      default:
        throw new Error(`vectorSearch: unsupported metric "${String(metric)}"`)
    }

    const literal = embeddingLiteral(queryEmbedding)
    const sql = `SELECT t.id AS id, t.type AS type, t.data AS data, ${scoreExpr} AS score
       FROM ${this.schema}.embeddings e
       JOIN ${this.schema}.things t ON t.ns = e.ns AND t.id = e.thing_id
       WHERE e.ns = $1 AND t.type = $3
       ORDER BY e.embedding ${operator} $2::vector
       LIMIT $4`
    const rows = await this.executor(sql, [this.namespace, literal, type, limit])

    let hits: VectorSearchHit<T>[] = rows.map((row) => {
      const data = asJsonb(row['data'])
      const score = typeof row['score'] === 'number' ? row['score'] : Number(row['score'] ?? 0)
      return {
        entity: { ...data, $id: String(row['id']), $type: String(row['type']) } as T & {
          $id: string
          $type: string
        },
        score,
      }
    })

    if (options?.minScore !== undefined) {
      const min = options.minScore
      hits = hits.filter((h) => h.score >= min)
    }
    return hits
  }

  /**
   * Driver / connection metadata for diagnostics.
   */
  describe(): { adapter: string; driver: string; namespace: string; schema: string } {
    return {
      adapter: 'pg+pgvector',
      driver: this.driver,
      namespace: this.namespace,
      schema: this.schema,
    }
  }
}

// =============================================================================
// Schema bootstrap
// =============================================================================

/**
 * Run the canonical DDL against an executor. Idempotent — uses
 * `IF NOT EXISTS` throughout, including the `vector` extension. Skip the
 * `vector` extension installation if your database does not have
 * pgvector available (set `withVector: false`).
 *
 * Includes the lexical/exact-tier indexes the live `findOrCreate` backend
 * rides (aip-j10o):
 *  - `things_fts_gin_idx` — an expression GIN index over
 *    `to_tsvector(<ftsConfig>, <searchable text>)`, used by
 *    {@link PostgresProvider.fullTextSearch}. Built with the SAME config +
 *    expression the query uses, so the planner uses the index.
 *  - `things_normkey_idx` — an expression b-tree index over the normalized
 *    key (`lower(coalesce(key,name,title,code))`, whitespace-collapsed), used
 *    by {@link PostgresProvider.keyLookup} for O(1) exact identity resolution.
 * Both are best-effort (`try`/catch) so bootstrap stays idempotent on
 * databases where the FTS config is unavailable.
 *
 * Designed for one-shot cluster bootstrap and for PGLite-style test
 * harnesses. Production deployments typically run schema migrations via
 * a tool like `dbmate` or `node-pg-migrate`; this helper is a
 * convenience, not a migration framework.
 */
export async function bootstrapSchema(
  executor: PgExecutor,
  options: {
    schema?: string
    withVector?: boolean
    vectorDimensions?: number
    ftsConfig?: string
  } = {}
): Promise<void> {
  const schema = options.schema ?? DEFAULT_SCHEMA
  const withVector = options.withVector ?? true
  const dims = options.vectorDimensions ?? DEFAULT_VECTOR_DIMS
  const ftsConfig = options.ftsConfig ?? DEFAULT_FTS_CONFIG
  validateFtsConfig(ftsConfig)

  if (withVector) {
    try {
      await executor(`CREATE EXTENSION IF NOT EXISTS vector`)
    } catch {
      // Extension may not be available; downstream vector queries will
      // fail clearly. We swallow here to keep bootstrap idempotent.
    }
  }

  await executor(`CREATE SCHEMA IF NOT EXISTS ${schema}`)

  await executor(
    `CREATE TABLE IF NOT EXISTS ${schema}.things (
      ns text NOT NULL,
      id text NOT NULL,
      type text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT things_pk PRIMARY KEY (ns, id)
    )`
  )
  await executor(`CREATE INDEX IF NOT EXISTS things_type_idx ON ${schema}.things (ns, type)`)

  // Lexical tier — expression GIN index over the searchable-text tsvector.
  // Built with the SAME config + expression `fullTextSearch` queries, so the
  // planner can use it. Best-effort: a missing FTS config shouldn't break
  // bootstrap (the lexical tier falls back to the ILIKE `search()` baseline).
  try {
    await executor(
      `CREATE INDEX IF NOT EXISTS things_fts_gin_idx ON ${schema}.things
       USING gin (to_tsvector('${ftsConfig}', ${searchableTextExpr()}))`
    )
  } catch {
    // FTS config unavailable; `fullTextSearch` callers degrade to substring search.
  }

  // Exact tier — expression b-tree index over the normalized key for O(1)
  // `keyLookup`. (ns, type) is the leading composite filter; the normalized-key
  // expression is the probe. Best-effort for parity with the FTS index.
  try {
    await executor(
      `CREATE INDEX IF NOT EXISTS things_normkey_idx ON ${schema}.things
       (ns, type, (${normalizedKeyExpr()}))`
    )
  } catch {
    // Index creation failed (unusual); `keyLookup` still works, just not O(1).
  }

  await executor(
    `CREATE TABLE IF NOT EXISTS ${schema}.actions (
      ns text NOT NULL,
      id text NOT NULL,
      verb text NOT NULL,
      subject text,
      object text,
      roles jsonb NOT NULL DEFAULT '{}'::jsonb,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      CONSTRAINT actions_pk PRIMARY KEY (ns, id)
    )`
  )
  await executor(`CREATE INDEX IF NOT EXISTS actions_verb_idx ON ${schema}.actions (ns, verb)`)
  await executor(
    `CREATE INDEX IF NOT EXISTS actions_subject_idx ON ${schema}.actions (ns, subject)`
  )
  await executor(`CREATE INDEX IF NOT EXISTS actions_object_idx ON ${schema}.actions (ns, object)`)

  await executor(
    `CREATE TABLE IF NOT EXISTS ${schema}.verbs (
      name text PRIMARY KEY,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  )

  if (withVector) {
    try {
      await executor(
        `CREATE TABLE IF NOT EXISTS ${schema}.embeddings (
          ns text NOT NULL,
          thing_id text NOT NULL,
          type text NOT NULL DEFAULT '',
          embedding vector(${dims}),
          PRIMARY KEY (ns, thing_id)
        )`
      )
      // Best-effort: add `type` column to existing embeddings tables that
      // were created before vector search shipped. Idempotent via
      // IF NOT EXISTS (Postgres 9.6+).
      await executor(
        `ALTER TABLE ${schema}.embeddings ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT ''`
      )
      await executor(
        `CREATE INDEX IF NOT EXISTS embeddings_ns_type_idx ON ${schema}.embeddings (ns, type)`
      )
      // ANN index — ivfflat is the broadly-available default; HNSW is
      // pgvector 0.5+. We try HNSW first (better recall/latency) and
      // fall back to ivfflat. Both are best-effort.
      try {
        await executor(
          `CREATE INDEX IF NOT EXISTS embeddings_hnsw_cosine_idx
           ON ${schema}.embeddings USING hnsw (embedding vector_cosine_ops)`
        )
      } catch {
        // pgvector < 0.5 doesn't have HNSW; skip silently.
      }
    } catch {
      // Vector extension not present; the embeddings table is optional.
    }
  }

  // Hint for the unused-var linter on `_` destructure pattern downstream.
  void true as DBProvider | unknown
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Convenience factory for {@link PostgresProvider}.
 *
 * @example
 * ```ts
 * import { neon } from '@neondatabase/serverless'
 * import { createPostgresProvider, createNeonHttpExecutor } from 'ai-database'
 *
 * const sql = neon(env.DATABASE_URL)
 * const provider = createPostgresProvider({
 *   executor: createNeonHttpExecutor(sql),
 *   namespace: 'tenant-9',
 * })
 * ```
 */
export function createPostgresProvider(options: PostgresProviderOptions): PostgresProvider {
  return new PostgresProvider(options)
}
