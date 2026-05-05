/**
 * Pipelines → Iceberg analytical fan-out emitter — Phase 2 final, bead `aip-0ypt`.
 *
 * Implements the {@link AnalyticalEmitter} contract surfaced by
 * {@link CascadeWriteStrategy} so cascade writes can dual-write into
 * Iceberg via Cloudflare Pipelines without changing the strategy or
 * orchestrator surface. Per
 * [ADR-0003](../../../docs/adr/0003-storage-strategy-pg-clickhouse-default.md),
 * Stack B's storage shape is:
 *
 * ```text
 *   cascade write
 *      │
 *      ▼
 *   DO SQLite (per-cascade, transactional, source of truth for traversal)
 *      │
 *      └──► CascadeWriteStrategy.analyticalEmitter ──► Cloudflare Pipelines ──► R2 Iceberg
 *                                                            (analytical SOR; ClickHouse reads from here)
 * ```
 *
 * The transactional path through DO SQLite is the source of truth for
 * cascade correctness. The analytical fan-out is **fire-and-forget** on
 * the hot path: emitter failures MUST NOT fail the cascade write. The
 * `CascadeWriteStrategy` already swallows thrown errors from the
 * emitter; this module additionally never throws — even on completely
 * misconfigured bindings — so callers get the same shape regardless of
 * runtime.
 *
 * ## Schema mapping
 *
 * Iceberg tables for `things` and `actions` mirror the SVO surface used
 * by the PG/CH/DO SQLite adapters. Columns are kept in lowercase
 * snake_case (Iceberg is case-insensitive but tooling typically
 * normalises this way):
 *
 * **things table**
 * - `id` STRING (Thing id; content-hashed by the orchestrator)
 * - `type` STRING (Thing `$type`)
 * - `data` STRING (jsonb-style — emitted as a stringified JSON blob;
 *   downstream readers (CH `JSONExtract`, DataFusion `arrow_cast`) parse
 *   on read. Iceberg has STRUCT columns but cascade Things are
 *   open-shape so we keep the column STRING)
 * - `cascade_id` STRING (the cascade this row belongs to; partition key)
 * - `tenant_id` STRING NULL (when sharded by tenant)
 * - `shard_key` STRING (the strategy's routing key, e.g. `cascade:abc`)
 * - `created_at` TIMESTAMP (emit time; stable)
 * - `updated_at` TIMESTAMP (emit time; bumped on re-emit)
 *
 * **actions table** — wire-compatible with `SVOAction`
 * - `id` STRING (Action id; orchestrator-supplied or adapter-generated)
 * - `verb` STRING
 * - `subject` STRING NULL
 * - `object` STRING NULL
 * - `roles` STRING (JSON-stringified Frame role map)
 * - `data` STRING (JSON-stringified payload)
 * - `status` STRING (`pending` | `completed` | `failed` | `cancelled`)
 * - `cascade_id` STRING (partition key)
 * - `tenant_id` STRING NULL
 * - `shard_key` STRING
 * - `timestamp` TIMESTAMP (emit time)
 *
 * Schema bootstrap (creating the Iceberg tables) is a deployment-time
 * concern; this emitter only writes records into an existing table
 * via the Pipelines binding's `send()`.
 *
 * ## Bindings
 *
 * The emitter accepts a structurally-typed
 * {@link PipelinesStreamBindingLike} so the module compiles in plain
 * Node tests without `@cloudflare/workers-types`. Real Pipelines
 * bindings produced by `wrangler.toml` satisfy this shape at runtime.
 * For non-Workers callers (Node / dev / batch jobs) an
 * {@link HttpPipelinesEmitterOptions} HTTP fallback is supported,
 * issuing `POST` requests against the Pipelines stream endpoint.
 *
 * ## Exactly-once / dedup
 *
 * Cloudflare Pipelines is at-least-once by default. Cascade entity
 * ids are content-hashed by the orchestrator (same inputs → same id),
 * so re-emits of the same cascade re-use the same `id` field — Iceberg
 * MERGE-on-read jobs (or the Pipelines binding's optional dedup key)
 * collapse duplicates downstream. Callers wanting strict
 * exactly-once semantics should configure dedup on the Pipelines
 * stream itself; this emitter exposes `dedupKey?: 'id' | null` to
 * indicate which field to use.
 *
 * @see {@link ../../../docs/adr/0003-storage-strategy-pg-clickhouse-default.md}
 * @see {@link ./cascade-write-strategy.ts}
 * @packageDocumentation
 */

import type { AnalyticalEmitter, CascadeBatch, ShardRef } from './cascade-write-strategy.js'

// =============================================================================
// Cloudflare Pipelines binding — structural shape
// =============================================================================
//
// Declared structurally so this module compiles in plain Node test
// environments. Real Pipelines bindings produced by `wrangler.toml`
// satisfy this shape at runtime.

/**
 * Minimal Cloudflare Pipelines stream binding shape.
 *
 * The real `Pipeline` binding exposes additional methods the emitter
 * does not need (telemetry, batch flushing, etc.). The shape captured
 * here is the subset we call.
 *
 * @example
 * ```toml
 * # wrangler.toml
 * [[pipelines]]
 * binding = "ANALYTICAL_PIPE"
 * pipeline = "cascade-iceberg"
 * ```
 *
 * @example
 * ```ts
 * import { createPipelinesIcebergEmitter } from 'ai-database'
 *
 * const emitter = createPipelinesIcebergEmitter({
 *   binding: env.ANALYTICAL_PIPE,
 *   thingsTable: 'aidb.things',
 *   actionsTable: 'aidb.actions',
 * })
 * ```
 */
export interface PipelinesStreamBindingLike {
  /**
   * Push an array of records into the pipeline. Records are JSON-
   * serialisable objects; the Pipelines runtime batches and writes them
   * into the configured destination (R2 Iceberg in this deployment).
   *
   * Cloudflare's runtime returns `void` / `Promise<void>` — the call is
   * a fire-and-forget enqueue. Failures (binding misconfigured, quota
   * exceeded, etc.) surface as rejected promises; this emitter
   * swallows them so the cascade hot path remains correct.
   */
  send(records: ReadonlyArray<Record<string, unknown>>): Promise<void> | void
}

// =============================================================================
// Iceberg row shapes — what the emitter writes
// =============================================================================

/**
 * Shape of a row written into the Iceberg `things` table. Values are
 * lowered (data is stringified JSON) so the Iceberg writer doesn't
 * need to know about open-shape jsonb. CH / DataFusion readers parse
 * the `data` column back into structures via `JSONExtract` /
 * `arrow_cast`.
 */
export interface IcebergThingRow {
  id: string
  type: string
  data: string
  cascade_id: string
  tenant_id: string | null
  shard_key: string
  created_at: string
  updated_at: string
}

/**
 * Shape of a row written into the Iceberg `actions` table. Mirrors
 * the SVO Action surface plus cascade-routing columns.
 */
export interface IcebergActionRow {
  id: string
  verb: string
  subject: string | null
  object: string | null
  roles: string
  data: string
  status: string
  cascade_id: string
  tenant_id: string | null
  shard_key: string
  timestamp: string
}

// =============================================================================
// Logger surface (structural)
// =============================================================================

/**
 * Minimal logger shape the emitter calls when fan-out fails. Defaults
 * to a no-op so library callers don't pay for a logger they didn't ask
 * for. Workers callers typically pass `console`; production callers
 * pass their structured logger.
 */
export interface PipelinesEmitterLoggerLike {
  warn?: (message: string, data?: Record<string, unknown>) => void
  error?: (message: string, data?: Record<string, unknown>) => void
}

// =============================================================================
// Options
// =============================================================================

/**
 * Common options shared by binding-mode and HTTP-mode emitters.
 */
interface PipelinesIcebergEmitterCommonOptions {
  /**
   * Iceberg table name for Things rows. Defaults to `'things'`.
   * Callers running multi-tenant deployments typically use
   * `'tenant_<id>.things'` or similar; pass the fully-qualified table
   * name your Pipelines stream is configured to write into.
   */
  thingsTable?: string

  /**
   * Iceberg table name for Actions rows. Defaults to `'actions'`.
   */
  actionsTable?: string

  /**
   * Tenant id stamped onto every row. When omitted the emitter looks
   * for `tenantId` on the {@link ShardRef.context}; if neither is
   * present rows carry `tenant_id = null`.
   */
  tenantId?: string

  /**
   * Hint to downstream MERGE-on-read jobs about which column carries
   * the dedup key. The emitter doesn't use this internally — it's
   * carried into the row payload as `_dedup_key` so the Pipelines
   * stream / Iceberg compaction can act on it. Default: `'id'`.
   */
  dedupKey?: 'id' | null

  /**
   * Override `Date.now()` for deterministic tests. Returns an ISO 8601
   * string used for `created_at` / `updated_at` / `timestamp`.
   */
  now?: () => string

  /**
   * Optional logger. Defaults to no-op. Failures are logged at `warn`
   * level (the cascade local commit is the source of truth).
   */
  logger?: PipelinesEmitterLoggerLike

  /**
   * When true, `await` the `send()` call before returning from
   * `emit()`. Default: `false` (fire-and-forget). Kept as an escape
   * hatch for tests that want to assert exact ordering; production
   * callers leave this off so the cascade hot path doesn't pay the
   * round-trip latency.
   *
   * Even when `awaitSend` is true, errors are still swallowed —
   * setting this to `true` does NOT change the failure semantics.
   * If you need synchronous "did the analytical write land?"
   * guarantees, that's a different design (the emitter would have
   * to surface a typed error path; bead reserves that as out-of-scope).
   */
  awaitSend?: boolean
}

/**
 * Options for the Workers-binding-mode emitter (canonical Stack B shape).
 */
export interface PipelinesIcebergEmitterOptions extends PipelinesIcebergEmitterCommonOptions {
  /**
   * The Pipelines stream binding (a single binding fans out into both
   * tables — see {@link thingsTable} / {@link actionsTable}).
   *
   * For separate streams per table, pass {@link thingsBinding} and
   * {@link actionsBinding} instead and leave this field undefined.
   */
  binding?: PipelinesStreamBindingLike

  /** Optional separate binding for Things rows. Overrides {@link binding}. */
  thingsBinding?: PipelinesStreamBindingLike

  /** Optional separate binding for Actions rows. Overrides {@link binding}. */
  actionsBinding?: PipelinesStreamBindingLike
}

/**
 * Options for the HTTP-fallback emitter — used by Node / dev / batch
 * jobs that don't have a Pipelines binding available. Issues a `POST`
 * with `Content-Type: application/json` against the Pipelines stream
 * endpoint URL provided. The body is a JSON array of rows (the same
 * shape `send()` would receive).
 */
export interface HttpPipelinesEmitterOptions extends PipelinesIcebergEmitterCommonOptions {
  /**
   * Pipelines stream endpoint URL. Cloudflare exposes a per-stream
   * HTTPS endpoint; configure the URL out-of-band (e.g. via
   * `PIPELINES_THINGS_URL` / `PIPELINES_ACTIONS_URL` env vars at the
   * call site).
   *
   * If only one URL is configured, both Things and Actions are sent
   * to the same endpoint with a `_table` discriminator.
   */
  url?: string

  /** Optional separate endpoint for Things rows. Overrides {@link url}. */
  thingsUrl?: string

  /** Optional separate endpoint for Actions rows. Overrides {@link url}. */
  actionsUrl?: string

  /**
   * Optional bearer token for authentication. Sent as
   * `Authorization: Bearer <token>` on the `POST`.
   */
  authToken?: string

  /**
   * Optional fetch implementation. Default: global `fetch`. Tests pass
   * a structural fake.
   */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create an {@link AnalyticalEmitter} that fans out cascade writes
 * into Iceberg via Cloudflare Pipelines.
 *
 * The returned emitter satisfies the
 * {@link CascadeWriteStrategy.analyticalEmitter} contract — pass it
 * directly to {@link CascadeWriteStrategy} or
 * {@link generateCascade} via the `analyticalEmitter` option.
 *
 * @example Workers binding mode
 * ```ts
 * import { createPipelinesIcebergEmitter, generateCascade } from 'ai-database'
 *
 * const emitter = createPipelinesIcebergEmitter({
 *   binding: env.ANALYTICAL_PIPE,
 *   thingsTable: 'aidb.things',
 *   actionsTable: 'aidb.actions',
 *   tenantId: 'acme',
 * })
 *
 * await generateCascade({
 *   adapter,
 *   rootNoun: 'Customer',
 *   analyticalEmitter: emitter,
 *   // ...
 * })
 * ```
 *
 * @example Node HTTP fallback (dev / batch)
 * ```ts
 * import { createHttpPipelinesIcebergEmitter } from 'ai-database'
 *
 * const emitter = createHttpPipelinesIcebergEmitter({
 *   url: process.env.PIPELINES_URL,
 *   authToken: process.env.PIPELINES_TOKEN,
 * })
 * ```
 */
export function createPipelinesIcebergEmitter(
  options: PipelinesIcebergEmitterOptions
): AnalyticalEmitter {
  const thingsBinding = options.thingsBinding ?? options.binding
  const actionsBinding = options.actionsBinding ?? options.binding

  if (!thingsBinding && !actionsBinding) {
    throw new Error(
      'createPipelinesIcebergEmitter: at least one of `binding`, ' +
        '`thingsBinding`, or `actionsBinding` must be provided. For ' +
        'non-Workers callers, use createHttpPipelinesIcebergEmitter() ' +
        'with an HTTPS endpoint URL instead.'
    )
  }

  return makeEmitter({
    options,
    sendThings: thingsBinding ? (rows) => Promise.resolve(thingsBinding.send(rows)) : null,
    sendActions: actionsBinding ? (rows) => Promise.resolve(actionsBinding.send(rows)) : null,
  })
}

/**
 * Create an {@link AnalyticalEmitter} that fans out cascade writes
 * into Iceberg via the Pipelines HTTPS stream endpoint.
 *
 * Used by non-Workers callers (Node / dev / batch jobs). Workers
 * deployments should prefer {@link createPipelinesIcebergEmitter}
 * for lower latency.
 */
export function createHttpPipelinesIcebergEmitter(
  options: HttpPipelinesEmitterOptions
): AnalyticalEmitter {
  const thingsUrl = options.thingsUrl ?? options.url
  const actionsUrl = options.actionsUrl ?? options.url

  if (!thingsUrl && !actionsUrl) {
    throw new Error(
      'createHttpPipelinesIcebergEmitter: at least one of `url`, ' +
        '`thingsUrl`, or `actionsUrl` must be provided.'
    )
  }

  const fetchImpl: NonNullable<HttpPipelinesEmitterOptions['fetch']> =
    options.fetch ??
    ((input, init) => {
      // Defer to the runtime's global fetch. Pulled inline so tests can
      // pass a structural fake without monkey-patching globals.
      const g = globalThis as { fetch?: typeof fetch }
      if (typeof g.fetch !== 'function') {
        return Promise.reject(
          new Error(
            'createHttpPipelinesIcebergEmitter: no global `fetch` available. ' +
              'Pass `fetch` in options for non-Worker / non-Node-18+ environments.'
          )
        )
      }
      return g.fetch(input, init)
    })

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.authToken) headers['Authorization'] = `Bearer ${options.authToken}`

  const send = async (url: string, rows: ReadonlyArray<Record<string, unknown>>): Promise<void> => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows),
    })
    if (!res.ok) {
      throw new Error(`Pipelines HTTP send failed: ${res.status} ${res.statusText}`)
    }
  }

  return makeEmitter({
    options,
    sendThings: thingsUrl ? (rows) => send(thingsUrl, rows) : null,
    sendActions: actionsUrl
      ? (rows) => send(actionsUrl, thingsUrl === actionsUrl ? rows : rows /* same payload shape */)
      : null,
  })
}

// =============================================================================
// Internals — shared emitter assembly
// =============================================================================

interface MakeEmitterArgs {
  options: PipelinesIcebergEmitterCommonOptions
  sendThings: ((rows: ReadonlyArray<Record<string, unknown>>) => Promise<void>) | null
  sendActions: ((rows: ReadonlyArray<Record<string, unknown>>) => Promise<void>) | null
}

function makeEmitter(args: MakeEmitterArgs): AnalyticalEmitter {
  const thingsTable = args.options.thingsTable ?? 'things'
  const actionsTable = args.options.actionsTable ?? 'actions'
  const dedupKey = args.options.dedupKey === undefined ? 'id' : args.options.dedupKey
  const nowFn = args.options.now ?? (() => new Date().toISOString())
  const logger = args.options.logger
  const awaitSend = args.options.awaitSend ?? false
  const optionTenantId = args.options.tenantId

  return async (input) => {
    // Resolve cascade-routing columns from the shard ref. The strategy
    // guarantees `shard.context` carries `cascadeId` / `tenantId` when
    // the active strategy needed them.
    const shard = input.shard
    const cascadeId = resolveCascadeId(shard)
    const tenantId = optionTenantId ?? resolveTenantId(shard)
    const shardKey = shard.key
    const timestamp = nowFn()

    const thingsRows = buildThingsRows(input.batch, {
      thingsTable,
      cascadeId,
      tenantId,
      shardKey,
      timestamp,
      dedupKey,
    })
    const actionsRows = buildActionsRows(input.batch, {
      actionsTable,
      cascadeId,
      tenantId,
      shardKey,
      timestamp,
      dedupKey,
    })

    const tasks: Array<Promise<void>> = []

    if (thingsRows.length > 0 && args.sendThings) {
      const task = Promise.resolve()
        .then(() => args.sendThings!(thingsRows))
        .catch((err: unknown) => {
          logger?.warn?.('pipelines-iceberg-emitter:things:send-failed', {
            error: errorMessage(err),
            rows: thingsRows.length,
            shardKey,
          })
        })
      tasks.push(task)
    }
    if (actionsRows.length > 0 && args.sendActions) {
      const task = Promise.resolve()
        .then(() => args.sendActions!(actionsRows))
        .catch((err: unknown) => {
          logger?.warn?.('pipelines-iceberg-emitter:actions:send-failed', {
            error: errorMessage(err),
            rows: actionsRows.length,
            shardKey,
          })
        })
      tasks.push(task)
    }

    if (awaitSend && tasks.length > 0) {
      await Promise.all(tasks)
    }
  }
}

// =============================================================================
// Internals — row builders
// =============================================================================

interface ThingsRowBuilderContext {
  thingsTable: string
  cascadeId: string
  tenantId: string | null
  shardKey: string
  timestamp: string
  dedupKey: 'id' | null
}

function buildThingsRows(
  batch: CascadeBatch,
  ctx: ThingsRowBuilderContext
): Array<Record<string, unknown>> {
  const things = batch.things ?? []
  if (things.length === 0) return []
  const rows: Array<Record<string, unknown>> = []
  for (const t of things) {
    const row: IcebergThingRow & Record<string, unknown> = {
      id: t.id,
      type: t.type,
      data: stableJsonStringify(t.data),
      cascade_id: ctx.cascadeId,
      tenant_id: ctx.tenantId,
      shard_key: ctx.shardKey,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
      _table: ctx.thingsTable,
    }
    if (ctx.dedupKey) row['_dedup_key'] = row[ctx.dedupKey]
    rows.push(row)
  }
  return rows
}

interface ActionsRowBuilderContext {
  actionsTable: string
  cascadeId: string
  tenantId: string | null
  shardKey: string
  timestamp: string
  dedupKey: 'id' | null
}

function buildActionsRows(
  batch: CascadeBatch,
  ctx: ActionsRowBuilderContext
): Array<Record<string, unknown>> {
  const actions = batch.actions ?? []
  if (actions.length === 0) return []
  const rows: Array<Record<string, unknown>> = []
  for (const a of actions) {
    const row: IcebergActionRow & Record<string, unknown> = {
      id: a.id ?? generateActionId(ctx.cascadeId, ctx.timestamp, rows.length),
      verb: a.verb,
      subject: a.subject ?? null,
      object: a.object ?? null,
      roles: stableJsonStringify(a.roles ?? {}),
      data: stableJsonStringify(a.data ?? {}),
      status: a.status ?? 'completed',
      cascade_id: ctx.cascadeId,
      tenant_id: ctx.tenantId,
      shard_key: ctx.shardKey,
      timestamp: ctx.timestamp,
      _table: ctx.actionsTable,
    }
    if (ctx.dedupKey) row['_dedup_key'] = row[ctx.dedupKey]
    rows.push(row)
  }
  return rows
}

// =============================================================================
// Internals — utilities
// =============================================================================

function resolveCascadeId(shard: ShardRef): string {
  const ctxId = shard.context.cascadeId
  if (typeof ctxId === 'string' && ctxId.length > 0) return ctxId
  // Fall back to the shard key — for `partitioned-by-tenant` and
  // `unsharded` strategies there is no per-cascade id, so the routing
  // key is the best we can do. Iceberg readers can group on it.
  return shard.key
}

function resolveTenantId(shard: ShardRef): string | null {
  const t = shard.context.tenantId
  return typeof t === 'string' && t.length > 0 ? t : null
}

/**
 * Stable JSON stringify — keys sorted recursively. Iceberg dedup at
 * compaction time depends on identical row bytes for the same logical
 * row; un-sorted key ordering would defeat that.
 */
function stableJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) return val
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort()
    const result: Record<string, unknown> = {}
    for (const k of sortedKeys) {
      result[k] = (val as Record<string, unknown>)[k]
    }
    return result
  })
}

/**
 * Generate a deterministic-enough Action id when the orchestrator
 * didn't supply one. Production callers always supply Action ids via
 * the orchestrator's content-hash; this is a safety net for ad-hoc
 * `writeBatch` callers.
 */
function generateActionId(cascadeId: string, timestamp: string, index: number): string {
  return `act-${cascadeId.slice(0, 16)}-${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}-${index}`
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
