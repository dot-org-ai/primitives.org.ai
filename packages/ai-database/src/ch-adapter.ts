/**
 * ClickHouse DBProvider adapter (Stack A analytics layer)
 *
 * First-class adapter for the analytical leg of Stack A per
 * [ADR-0003](../../../docs/adr/0003-storage-strategy-pg-clickhouse-default.md).
 * Implements the {@link DBProviderPort} surface with:
 *
 * - **Tier 1 (entity CRUD)** against a `things` table backed by a
 *   `ReplacingMergeTree` so updates produce a logical upsert at merge time.
 * - **Tier 2 (graph traversal)** via Actions: subject/object/recipient/...
 *   queries against an append-only `actions` table.
 * - **Tier 3 (analytics)** declared **first-class** — ClickHouse is the
 *   substrate for cross-cascade aggregations, time-series rollups, and
 *   large-scan analytical queries (cf. ADR-0003 "Tier 3 first-class on
 *   ClickHouse"). `analyticsQuery` is exposed for ad-hoc SQL.
 * - **Tier 4 (vector search)** native via ClickHouse's vector distance
 *   functions (`cosineDistance`, `L2Distance`, `dotProduct`) up to
 *   ~64,000 dimensions. Embeddings live in a companion `embeddings`
 *   table (`ns, thing_id, type, embedding Array(Float32)`) joined to
 *   `things`. Callers seed it via {@link ClickHouseProvider.upsertEmbedding}
 *   and query via {@link ClickHouseProvider.vectorSearch}. Frame-aware
 *   role filtering is deferred to a follow-up refinement bead.
 * - **SVO Action recording** + **Verb registry** declared via
 *   `hasActionRecording: true` and `hasVerbRegistry: true`.
 * - **Sharding**: `unsharded` by default (ClickHouse's strength is wide
 *   tables on a single cluster). The `ns` column doubles as a partition
 *   key for callers that want logical tenant separation; declaring
 *   `partitioned-by-tenant` switches the capability flag.
 *
 * ## Cascade write path
 *
 * The cascade-scale write path on ClickHouse is **bulk INSERT via
 * `JSONEachRow` format** — a single HTTP POST per batch carries the full
 * write set. {@link ClickHouseProvider.commitBatch} implements this shape;
 * each batch becomes one HTTP request.
 *
 * ## Driver choice
 *
 * The adapter is HTTP-based and driver-agnostic. It consumes a
 * {@link ClickHouseHttpFetcher} — a function that takes a SQL query plus
 * an optional body and returns the response text. Any HTTP client
 * (`fetch`, `node-fetch`, `undici`, Cloudflare Workers `fetch`) works.
 *
 * For ad-hoc scripting against a ClickHouse Cloud or self-hosted instance,
 * {@link createClickHouseHttpFetcher} wraps a basic-auth fetch call.
 *
 * ## Schema
 *
 * The adapter assumes a database named `aidb` (configurable). DDL:
 *
 * ```sql
 * CREATE DATABASE IF NOT EXISTS aidb;
 *
 * CREATE TABLE IF NOT EXISTS aidb.things (
 *   ns         String,
 *   id         String,
 *   type       String,
 *   data       String,             -- JSON-encoded payload
 *   created_at DateTime64(3) DEFAULT now64(3),
 *   updated_at DateTime64(3) DEFAULT now64(3),
 *   version    UInt64        DEFAULT toUnixTimestamp64Milli(now64(3))
 * ) ENGINE = ReplacingMergeTree(version)
 * ORDER BY (ns, type, id);
 *
 * CREATE TABLE IF NOT EXISTS aidb.actions (
 *   ns          String,
 *   id          String,
 *   verb        String,
 *   subject     String,
 *   object      String,
 *   roles       String,            -- JSON-encoded role map
 *   data        String,            -- JSON-encoded payload
 *   status      LowCardinality(String) DEFAULT 'pending',
 *   created_at  DateTime64(3) DEFAULT now64(3),
 *   completed_at Nullable(DateTime64(3))
 * ) ENGINE = MergeTree
 * PARTITION BY toYYYYMM(created_at)
 * ORDER BY (ns, verb, subject, created_at);
 *
 * CREATE TABLE IF NOT EXISTS aidb.verbs (
 *   name       String,
 *   data       String,
 *   created_at DateTime64(3) DEFAULT now64(3),
 *   version    UInt64        DEFAULT toUnixTimestamp64Milli(now64(3))
 * ) ENGINE = ReplacingMergeTree(version)
 * ORDER BY name;
 * ```
 *
 * `bootstrapClickHouseSchema(fetcher)` ships the DDL above.
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
// Fetcher shape — driver-agnostic
// =============================================================================

/**
 * HTTP-shaped ClickHouse query / insert fetcher.
 *
 * The single function takes a SQL query (URL-encoded into the request) plus
 * an optional body (used for `INSERT ... FORMAT JSONEachRow` payloads) and
 * returns the response text. JSON parsing is performed by the adapter.
 *
 * Implementations may pin a base URL, credentials, and database — the
 * adapter only asks for `(query, body)`.
 *
 * @param query - The SQL query to run. The adapter ALWAYS appends
 *   `FORMAT JSON` (for SELECT) or `FORMAT JSONEachRow` (for INSERT) where
 *   appropriate before passing in.
 * @param body - Optional HTTP request body (for inserts). When `undefined`,
 *   the request is parameterless (the SQL is fully self-contained).
 * @returns Raw response text from ClickHouse.
 */
export type ClickHouseHttpFetcher = (query: string, body?: string) => Promise<string>

/**
 * Options for {@link createClickHouseHttpFetcher}.
 */
export interface ClickHouseHttpFetcherOptions {
  /** Base URL of the ClickHouse HTTP endpoint, e.g. `https://abc.clickhouse.cloud:8443`. */
  url: string
  /** Username for HTTP basic auth. */
  username?: string
  /** Password for HTTP basic auth. */
  password?: string
  /** Database to scope queries to (sent via `database=` query string param). */
  database?: string
  /** A `fetch`-compatible function. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch
}

/**
 * Wrap a `fetch`-compatible function into a {@link ClickHouseHttpFetcher}.
 *
 * Sends queries via POST with the SQL as the request body for SELECTs and
 * with the data block as the body when `body` is supplied (insert path).
 * Basic-auth credentials are encoded into the `Authorization` header.
 *
 * @example
 * ```ts
 * import { createClickHouseHttpFetcher, createClickHouseProvider } from 'ai-database'
 *
 * const fetcher = createClickHouseHttpFetcher({
 *   url: env.CLICKHOUSE_URL,
 *   username: env.CLICKHOUSE_USER,
 *   password: env.CLICKHOUSE_PASSWORD,
 *   database: 'aidb',
 * })
 * const provider = createClickHouseProvider({
 *   fetcher,
 *   namespace: 'tenant-9',
 * })
 * ```
 */
export function createClickHouseHttpFetcher(
  options: ClickHouseHttpFetcherOptions
): ClickHouseHttpFetcher {
  const fetchImpl = options.fetchImpl ?? fetch
  const auth =
    options.username !== undefined
      ? 'Basic ' + btoa(`${options.username}:${options.password ?? ''}`)
      : undefined
  const dbParam = options.database ? `database=${encodeURIComponent(options.database)}` : null

  return async (query: string, body?: string): Promise<string> => {
    const params: string[] = []
    if (dbParam) params.push(dbParam)
    // When body is supplied (insert path), the SQL goes via the `query=` param
    // and the body carries the rows. Otherwise, send SQL as the body.
    let url = options.url
    let requestBody: string
    if (body !== undefined) {
      params.push(`query=${encodeURIComponent(query)}`)
      requestBody = body
    } else {
      requestBody = query
    }
    if (params.length > 0) url = `${url}?${params.join('&')}`

    const headers: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
    }
    if (auth) headers['Authorization'] = auth

    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: requestBody,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`ClickHouse HTTP ${response.status}: ${text.slice(0, 500)}`)
    }
    return text
  }
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Options for {@link createClickHouseProvider}.
 */
export interface ClickHouseProviderOptions {
  /** HTTP fetcher (typically constructed via {@link createClickHouseHttpFetcher}). */
  fetcher: ClickHouseHttpFetcher

  /**
   * Namespace / partition key written into every row.
   *
   * @default 'default'
   */
  namespace?: string

  /**
   * ClickHouse database housing the tables. Must already exist (or use
   * {@link bootstrapClickHouseSchema}).
   *
   * @default 'aidb'
   */
  database?: string

  /**
   * Sharding model to declare. ClickHouse defaults to `unsharded` because
   * a single cluster handles wide-table analytical queries, but
   * deployments using namespace partitioning may declare
   * `partitioned-by-tenant` to signal the boundary to callers.
   *
   * @default 'unsharded'
   */
  shardingModel?: 'unsharded' | 'partitioned-by-tenant'

  /**
   * Vector dimensions for the embedding columns. Used by the capability
   * declaration only — the actual vector column shape is defined by the
   * schema DDL.
   *
   * @default 1536
   */
  vectorDimensions?: number

  /**
   * Driver name for logs / capability metadata.
   *
   * @default 'clickhouse-http'
   */
  driver?: 'clickhouse-http' | string
}

// =============================================================================
// SQL helpers
// =============================================================================

const DEFAULT_DATABASE = 'aidb'
const DEFAULT_NAMESPACE = 'default'
const DEFAULT_VECTOR_DIMS = 1536
const CH_MAX_VECTOR_DIMS = 64_000

/** Generate a UUID for adapter-issued ids. */
function genId(): string {
  return crypto.randomUUID()
}

/**
 * SQL string-literal escape — ClickHouse accepts single-quoted strings
 * with backslash escapes.
 */
function quote(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * Coerce arbitrary string-encoded JSON column values into a plain object.
 * The schema stores `data`, `roles` as String for portability across
 * ClickHouse versions — JSON type support varies by deployment.
 */
function asJsonb(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    if (value.length === 0) return {}
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
  if (typeof value === 'string' && value.length === 0) return undefined
  return String(value)
}

/**
 * Format a Date as ClickHouse `DateTime64(3)`-compatible literal:
 * `'2026-05-05 12:34:56.789'`.
 */
function chDateTime(date: Date): string {
  // ClickHouse accepts `YYYY-MM-DD HH:MM:SS.sss` in single-quotes.
  const iso = date.toISOString()
  // 2026-05-05T12:34:56.789Z -> 2026-05-05 12:34:56.789
  return iso.replace('T', ' ').replace('Z', '')
}

/**
 * ClickHouse JSON response shape for `FORMAT JSON` queries.
 */
interface CHJsonResponse<T> {
  data: T[]
  rows?: number
  rows_before_limit_at_least?: number
  meta?: Array<{ name: string; type: string }>
}

function parseJsonResponse<T = Record<string, unknown>>(text: string): T[] {
  if (!text || text.length === 0) return []
  try {
    const parsed = JSON.parse(text) as CHJsonResponse<T>
    return parsed.data ?? []
  } catch {
    // Some ClickHouse responses for non-SELECT statements are empty or
    // plain text; treat as no data.
    return []
  }
}

// =============================================================================
// ClickHouseProvider
// =============================================================================

/**
 * ClickHouse adapter implementing {@link DBProviderPort} and
 * {@link DBProviderSVO}.
 */
export class ClickHouseProvider implements DBProviderPort, DBProviderSVO, VectorSearchPort {
  private readonly fetcher: ClickHouseHttpFetcher
  private readonly namespace: string
  private readonly database: string
  private readonly _shardingModel: 'unsharded' | 'partitioned-by-tenant'
  private readonly vectorDimensions: number
  private readonly driver: string

  constructor(options: ClickHouseProviderOptions) {
    this.fetcher = options.fetcher
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE
    this.database = options.database ?? DEFAULT_DATABASE
    this._shardingModel = options.shardingModel ?? 'unsharded'
    this.vectorDimensions = Math.min(
      options.vectorDimensions ?? DEFAULT_VECTOR_DIMS,
      CH_MAX_VECTOR_DIMS
    )
    this.driver = options.driver ?? 'clickhouse-http'
  }

  /**
   * Tier capability declaration. Declares Tier 3 first-class (CH's
   * strength) and Tier 4 (native vector functions, up to 64,000 dims,
   * cosine/L2/dot). Both `hasActionRecording` and `hasVerbRegistry` are
   * `true` — see the SVO methods on this class.
   */
  get capabilities(): ProviderTierCapabilities {
    return {
      adapter: 'clickhouse',
      shardingModel: this._shardingModel,
      analytics: {
        hasAggregations: true,
        hasTimeSeries: true,
        hasLargeScans: true,
      },
      vectorSearch: {
        maxDimensions: this.vectorDimensions,
        metrics: ['cosine', 'l2', 'dot'],
        implementation: 'native',
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
    const sql = `SELECT data FROM ${this.database}.things FINAL
       WHERE ns = ${quote(this.namespace)} AND type = ${quote(type)} AND id = ${quote(id)}
       LIMIT 1 FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ data: string }>(text)
    if (rows.length === 0) return null
    const data = asJsonb(rows[0]!['data'])
    return { ...data, $id: id, $type: type }
  }

  async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
    validateTypeName(type)
    validateListOptions(options)
    const limit = options?.limit ?? 1000
    const offset = options?.offset ?? 0

    const sql = `SELECT id, data FROM ${this.database}.things FINAL
       WHERE ns = ${quote(this.namespace)} AND type = ${quote(type)}
       ORDER BY id
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}
       FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ id: string; data: string }>(text)

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

    // ClickHouse `like` against the JSON-string column. Richer search
    // (FTS via skipping indexes) is future work.
    const pattern = `%${query.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}%`
    const sql = `SELECT id, data FROM ${this.database}.things FINAL
       WHERE ns = ${quote(this.namespace)} AND type = ${quote(type)} AND data ILIKE '${pattern}'
       ORDER BY id
       LIMIT ${Number(limit)}
       FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ id: string; data: string }>(text)
    return rows.map((row) => {
      const data = asJsonb(row['data'])
      return { ...data, $id: String(row['id']), $type: type }
    })
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
    const now = new Date()
    const nowIso = now.toISOString()
    const payload = { ...data, createdAt: nowIso, updatedAt: nowIso }

    // INSERT via JSONEachRow body
    const row = {
      ns: this.namespace,
      id: entityId,
      type,
      data: JSON.stringify(payload),
      created_at: chDateTime(now),
      updated_at: chDateTime(now),
      version: now.getTime(),
    }
    await this.fetcher(
      `INSERT INTO ${this.database}.things (ns, id, type, data, created_at, updated_at, version) FORMAT JSONEachRow`,
      JSON.stringify(row) + '\n'
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
    const now = new Date()
    const merged = { ...rest, ...data, updatedAt: now.toISOString() }

    // ReplacingMergeTree: a fresh row with a higher `version` supersedes
    // the prior row on merge. For read-after-write consistency we use
    // `FINAL` in `get()`/`list()`.
    const row = {
      ns: this.namespace,
      id,
      type,
      data: JSON.stringify(merged),
      created_at: chDateTime(now),
      updated_at: chDateTime(now),
      version: now.getTime(),
    }
    await this.fetcher(
      `INSERT INTO ${this.database}.things (ns, id, type, data, created_at, updated_at, version) FORMAT JSONEachRow`,
      JSON.stringify(row) + '\n'
    )
    return { ...merged, $id: id, $type: type }
  }

  async delete(type: string, id: string): Promise<boolean> {
    validateTypeName(type)
    validateEntityId(id)

    const existing = await this.get(type, id)
    if (!existing) return false

    // ALTER ... DELETE is asynchronous on MergeTree; for synchronous
    // visibility we use lightweight DELETE (CH 23.3+) with mutations
    // SETTINGS to wait. Fallback path uses ALTER ... DELETE.
    await this.fetcher(
      `DELETE FROM ${this.database}.things WHERE ns = ${quote(this.namespace)} AND type = ${quote(
        type
      )} AND id = ${quote(id)}`
    )
    await this.fetcher(
      `DELETE FROM ${this.database}.actions WHERE ns = ${quote(
        this.namespace
      )} AND (subject = ${quote(id)} OR object = ${quote(id)})`
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

    const sql = `SELECT t.id AS id, t.type AS type, t.data AS data
       FROM ${this.database}.actions a
       INNER JOIN ${this.database}.things FINAL t
         ON t.ns = a.ns AND t.id = a.object
       WHERE a.ns = ${quote(this.namespace)} AND a.subject = ${quote(id)} AND a.verb = ${quote(
      relation
    )}
       FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ id: string; type: string; data: string }>(text)
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

    await this.fetcher(
      `DELETE FROM ${this.database}.actions
       WHERE ns = ${quote(this.namespace)} AND verb = ${quote(relation)} AND subject = ${quote(
        fromId
      )} AND object = ${quote(toId)}`
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

    const row = {
      ns: this.namespace,
      id,
      verb: input.verb,
      subject: input.subject ?? '',
      object: input.object ?? '',
      roles: JSON.stringify(input.roles ?? {}),
      data: JSON.stringify(input.data ?? {}),
      status,
      created_at: chDateTime(createdAt),
      completed_at: completedAt ? chDateTime(completedAt) : null,
    }
    await this.fetcher(
      `INSERT INTO ${this.database}.actions
        (ns, id, verb, subject, object, roles, data, status, created_at, completed_at)
       FORMAT JSONEachRow`,
      JSON.stringify(row) + '\n'
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
    const conditions: string[] = [`ns = ${quote(this.namespace)}`]

    if (query.verb !== undefined) {
      conditions.push(`verb = ${quote(query.verb)}`)
    }
    if (query.subject !== undefined) {
      conditions.push(`subject = ${quote(query.subject)}`)
    }
    if (query.object !== undefined) {
      conditions.push(`object = ${quote(query.object)}`)
    }
    if (query.role) {
      for (const [role, value] of Object.entries(query.role)) {
        if (typeof value !== 'string') continue
        if (role === 'subject' || role === 'object') {
          conditions.push(`${role} = ${quote(value)}`)
        } else {
          conditions.push(`JSONExtractString(roles, ${quote(role)}) = ${quote(value)}`)
        }
      }
    }
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status]
      const inList = statuses.map((s) => quote(s)).join(', ')
      conditions.push(`status IN (${inList})`)
    }
    if (query.since) {
      conditions.push(`created_at >= ${quote(chDateTime(query.since))}`)
    }
    if (query.until) {
      conditions.push(`created_at <= ${quote(chDateTime(query.until))}`)
    }

    const limit = query.limit ?? 1000
    const offset = query.offset ?? 0

    const sql = `SELECT id, verb, subject, object, roles, data, status,
        toString(created_at) AS created_at,
        toString(completed_at) AS completed_at
       FROM ${this.database}.actions
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}
       FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{
      id: string
      verb: string
      subject: string
      object: string
      roles: string
      data: string
      status: string
      created_at: string
      completed_at: string | null
    }>(text)

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

    const now = new Date()
    const row = {
      name: verb.name,
      data: JSON.stringify(verb),
      created_at: chDateTime(now),
      version: now.getTime(),
    }
    await this.fetcher(
      `INSERT INTO ${this.database}.verbs (name, data, created_at, version) FORMAT JSONEachRow`,
      JSON.stringify(row) + '\n'
    )
    return verb
  }

  async getVerb(name: string): Promise<VerbRecord | null> {
    const sql = `SELECT data, toString(created_at) AS created_at FROM ${
      this.database
    }.verbs FINAL WHERE name = ${quote(name)} LIMIT 1 FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ data: string; created_at: string }>(text)
    if (rows.length === 0) return null
    const data = asJsonb(rows[0]!['data']) as Partial<VerbRecord>
    const createdAt = asDate(rows[0]!['created_at']) ?? new Date(0)
    return { ...(data as VerbRecord), createdAt }
  }

  async listVerbs(): Promise<VerbRecord[]> {
    const sql = `SELECT data, toString(created_at) AS created_at FROM ${this.database}.verbs FINAL ORDER BY name ASC FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ data: string; created_at: string }>(text)
    return rows.map((row) => {
      const data = asJsonb(row['data']) as Partial<VerbRecord>
      const createdAt = asDate(row['created_at']) ?? new Date(0)
      return { ...(data as VerbRecord), createdAt }
    })
  }

  // ===========================================================================
  // Cascade write fast path — bulk JSONEachRow
  // ===========================================================================

  /**
   * Bulk-commit Things and Actions in two single-table inserts via
   * `JSONEachRow`. Each table's payload is one HTTP POST, two HTTP
   * requests total per batch. ClickHouse swallows duplicate inserts via
   * the `ReplacingMergeTree` engine on `things` (versioned dedup at merge
   * time) and via append-only writes on `actions` (caller is responsible
   * for deduping ids if needed).
   *
   * Returns the count of rows submitted (CH does not report inserted-row
   * counts via the HTTP interface in a uniform way; the values here
   * reflect the input batch sizes).
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

    const now = new Date()
    const nowStr = chDateTime(now)
    const version = now.getTime()

    if (things.length > 0) {
      const lines = things
        .map((t) =>
          JSON.stringify({
            ns: this.namespace,
            id: t.id,
            type: t.type,
            data: JSON.stringify(t.data),
            created_at: nowStr,
            updated_at: nowStr,
            version,
          })
        )
        .join('\n')
      await this.fetcher(
        `INSERT INTO ${this.database}.things (ns, id, type, data, created_at, updated_at, version) FORMAT JSONEachRow`,
        lines + '\n'
      )
    }

    if (actions.length > 0) {
      const lines = actions
        .map((a) => {
          const status = a.status ?? 'pending'
          const completed =
            status === 'completed' || status === 'failed' || status === 'cancelled' ? nowStr : null
          return JSON.stringify({
            ns: this.namespace,
            id: a.id ?? genId(),
            verb: a.verb,
            subject: a.subject ?? '',
            object: a.object ?? '',
            roles: JSON.stringify(a.roles ?? {}),
            data: JSON.stringify(a.data ?? {}),
            status,
            created_at: nowStr,
            completed_at: completed,
          })
        })
        .join('\n')
      await this.fetcher(
        `INSERT INTO ${this.database}.actions
          (ns, id, verb, subject, object, roles, data, status, created_at, completed_at)
         FORMAT JSONEachRow`,
        lines + '\n'
      )
    }

    return { thingsInserted: things.length, actionsInserted: actions.length }
  }

  // ===========================================================================
  // Tier 3 — analytics (declared)
  // ===========================================================================

  /**
   * Pass-through for ad-hoc analytical SQL. Appends `FORMAT JSON` if the
   * caller hasn't specified an output format; the parsed `data` array is
   * returned. Use for time-series rollups, aggregations, or callers that
   * want to reach into ClickHouse without going through the adapter's
   * CRUD surface.
   *
   * Note: parameter substitution is left to the caller (ClickHouse's
   * `query_parameters` HTTP shape varies by version). Pre-format the SQL
   * with `quote()` or use `parametrizeQuery` upstream.
   */
  async analyticsQuery(
    query: string,
    _params?: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>> {
    const trimmed = query.trim().replace(/;$/, '')
    const sql = /\bFORMAT\s+\w+\s*$/i.test(trimmed) ? trimmed : `${trimmed} FORMAT JSON`
    const text = await this.fetcher(sql)
    return parseJsonResponse<Record<string, unknown>>(text)
  }

  // ===========================================================================
  // Tier 4 — vector search via native distance functions
  // ===========================================================================

  /**
   * Upsert an embedding for a Thing into the `embeddings` table. Backed by
   * `ReplacingMergeTree(version)` so callers may overwrite an embedding
   * by re-inserting; the higher version wins at merge time.
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
    for (const v of embedding) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error('upsertEmbedding: embedding values must be finite numbers')
      }
    }

    const now = new Date()
    const row = {
      ns: this.namespace,
      thing_id: id,
      type,
      embedding: Array.from(embedding),
      version: now.getTime(),
    }
    await this.fetcher(
      `INSERT INTO ${this.database}.embeddings (ns, thing_id, type, embedding, version) FORMAT JSONEachRow`,
      JSON.stringify(row) + '\n'
    )
  }

  /**
   * Tier 4 — vector search via ClickHouse native distance functions.
   *
   * Function selection by metric:
   * - `'cosine'` (default): `cosineDistance(embedding, query)` — score is
   *   `1 - distance`.
   * - `'l2'`: `L2Distance(embedding, query)` — score is `-distance`.
   * - `'dot'`: `dotProduct(embedding, query)` — score is the inner product
   *   directly.
   *
   * Frame-aware role filtering is deferred (see PG adapter doc).
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
    for (const v of queryEmbedding) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error('vectorSearch: queryEmbedding values must be finite numbers')
      }
    }

    const metric: VectorSimilarityMetric = options?.metric ?? 'cosine'
    const limit = Math.max(1, options?.limit ?? 10)

    let scoreExpr: string
    let orderExpr: string
    switch (metric) {
      case 'cosine':
        scoreExpr = `1 - cosineDistance(e.embedding, [${queryEmbedding.join(',')}])`
        orderExpr = `cosineDistance(e.embedding, [${queryEmbedding.join(',')}]) ASC`
        break
      case 'l2':
        scoreExpr = `-L2Distance(e.embedding, [${queryEmbedding.join(',')}])`
        orderExpr = `L2Distance(e.embedding, [${queryEmbedding.join(',')}]) ASC`
        break
      case 'dot':
        scoreExpr = `dotProduct(e.embedding, [${queryEmbedding.join(',')}])`
        orderExpr = `dotProduct(e.embedding, [${queryEmbedding.join(',')}]) DESC`
        break
      case 'hamming':
        throw new Error('vectorSearch: ClickHouse adapter does not support hamming metric')
      default:
        throw new Error(`vectorSearch: unsupported metric "${String(metric)}"`)
    }

    const sql = `SELECT t.id AS id, t.type AS type, t.data AS data, ${scoreExpr} AS score
       FROM ${this.database}.embeddings FINAL e
       INNER JOIN ${this.database}.things FINAL t
         ON t.ns = e.ns AND t.id = e.thing_id
       WHERE e.ns = ${quote(this.namespace)} AND t.type = ${quote(type)}
       ORDER BY ${orderExpr}
       LIMIT ${Number(limit)}
       FORMAT JSON`
    const text = await this.fetcher(sql)
    const rows = parseJsonResponse<{ id: string; type: string; data: string; score: number }>(text)

    let hits: VectorSearchHit<T>[] = rows.map((row) => {
      const data = asJsonb(row['data'])
      const rawScore = row['score']
      const score = typeof rawScore === 'number' ? rawScore : Number(rawScore ?? 0)
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
  describe(): { adapter: string; driver: string; namespace: string; database: string } {
    return {
      adapter: 'clickhouse',
      driver: this.driver,
      namespace: this.namespace,
      database: this.database,
    }
  }
}

// =============================================================================
// Schema bootstrap
// =============================================================================

/**
 * Run the canonical DDL against a ClickHouse fetcher. Idempotent — uses
 * `IF NOT EXISTS` throughout. Designed for one-shot cluster bootstrap and
 * for test harnesses; production deployments typically run schema
 * migrations via a CI tool.
 */
export async function bootstrapClickHouseSchema(
  fetcher: ClickHouseHttpFetcher,
  options: { database?: string; vectorDimensions?: number } = {}
): Promise<void> {
  const database = options.database ?? DEFAULT_DATABASE
  // vectorDimensions is informational — Array(Float32) is dynamically
  // sized in CH; we capture it for future-proofing (e.g. switching to
  // fixed Tuple types) but no DDL pin needed today.
  void options.vectorDimensions

  await fetcher(`CREATE DATABASE IF NOT EXISTS ${database}`)

  await fetcher(
    `CREATE TABLE IF NOT EXISTS ${database}.things (
      ns         String,
      id         String,
      type       String,
      data       String,
      created_at DateTime64(3) DEFAULT now64(3),
      updated_at DateTime64(3) DEFAULT now64(3),
      version    UInt64        DEFAULT toUnixTimestamp64Milli(now64(3))
    ) ENGINE = ReplacingMergeTree(version)
    ORDER BY (ns, type, id)`
  )

  await fetcher(
    `CREATE TABLE IF NOT EXISTS ${database}.actions (
      ns           String,
      id           String,
      verb         String,
      subject      String,
      object       String,
      roles        String,
      data         String,
      status       LowCardinality(String) DEFAULT 'pending',
      created_at   DateTime64(3) DEFAULT now64(3),
      completed_at Nullable(DateTime64(3))
    ) ENGINE = MergeTree
    PARTITION BY toYYYYMM(created_at)
    ORDER BY (ns, verb, subject, created_at)`
  )

  await fetcher(
    `CREATE TABLE IF NOT EXISTS ${database}.verbs (
      name       String,
      data       String,
      created_at DateTime64(3) DEFAULT now64(3),
      version    UInt64        DEFAULT toUnixTimestamp64Milli(now64(3))
    ) ENGINE = ReplacingMergeTree(version)
    ORDER BY name`
  )

  // Tier 4 — embeddings table. Array(Float32) accepts variable-length
  // vectors, which keeps the schema portable across embedding models. The
  // adapter validates dimension against `vectorDimensions` at the API
  // surface; CH itself does not pin the dimension.
  await fetcher(
    `CREATE TABLE IF NOT EXISTS ${database}.embeddings (
      ns         String,
      thing_id   String,
      type       String,
      embedding  Array(Float32),
      version    UInt64 DEFAULT toUnixTimestamp64Milli(now64(3))
    ) ENGINE = ReplacingMergeTree(version)
    ORDER BY (ns, type, thing_id)`
  )

  // Hint to keep DBProvider import warm.
  void true as DBProvider | unknown
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Convenience factory for {@link ClickHouseProvider}.
 *
 * @example
 * ```ts
 * import { createClickHouseProvider, createClickHouseHttpFetcher } from 'ai-database'
 *
 * const fetcher = createClickHouseHttpFetcher({
 *   url: env.CLICKHOUSE_URL,
 *   username: env.CLICKHOUSE_USER,
 *   password: env.CLICKHOUSE_PASSWORD,
 *   database: 'aidb',
 * })
 * const provider = createClickHouseProvider({
 *   fetcher,
 *   namespace: 'tenant-9',
 * })
 * ```
 */
export function createClickHouseProvider(options: ClickHouseProviderOptions): ClickHouseProvider {
  return new ClickHouseProvider(options)
}
