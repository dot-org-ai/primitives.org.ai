/**
 * ClickHouse storage backend for AI experiments.
 *
 * Migrated (per [ADR-0003](../../../docs/adr/0003-storage-strategy-pg-clickhouse-default.md))
 * from the standalone embedded `chdb` adapter to the canonical
 * `ClickHouseProvider` from `ai-database`. Experiment runs are recorded as
 * SVO Actions on the canonical `actions` table:
 *
 * - `verb` — event type (e.g. `variant.complete`)
 * - `subject` — `experimentId`
 * - `object` — `variantId`
 * - `roles` — `{ runId }` (other named roles can be carried here)
 * - `data` — JSON payload (`experimentName`, `variantName`, `dimensions`,
 *    `runId`, `success`, `durationMs`, `result`, `metricName`,
 *    `metricValue`, `errorMessage`, `errorStack`, `metadata`)
 * - `status` — `'completed'` for successful runs, `'failed'` otherwise
 *
 * Writes go through {@link ClickHouseProvider.recordAction} (and
 * {@link ClickHouseProvider.commitBatch} when bulk-storing). Aggregations
 * use {@link ClickHouseProvider.analyticsQuery} against the `actions` table
 * with `JSONExtract*` against the `data` column. This is the **option (c)
 * hybrid** approach from the migration plan: SVO surface for writes, raw
 * analytical SQL for the experiment-specific aggregations the SVO surface
 * doesn't expose directly (cartesian grids, time-series rollups,
 * best-variant selection by metric).
 *
 * Deployment shift: the previous `chdb` adapter used embedded ClickHouse
 * (file-system path). This adapter is HTTP-based — callers wire up a
 * ClickHouse server (self-hosted or ClickHouse Cloud) via
 * {@link createClickHouseHttpFetcher}. Tests use a fake fetcher.
 *
 * @packageDocumentation
 */

import {
  type ClickHouseHttpFetcher,
  type ClickHouseProvider,
  createClickHouseProvider,
  bootstrapClickHouseSchema,
} from 'ai-database'
import type { TrackingBackend, TrackingEvent, ExperimentResult } from './types.js'

/** Options for {@link ClickHouseExperimentStorage}. */
export interface ClickHouseExperimentStorageOptions {
  /** HTTP fetcher (typically constructed via `createClickHouseHttpFetcher`). */
  fetcher: ClickHouseHttpFetcher
  /**
   * ClickHouse database. Must already exist (or call
   * {@link bootstrapExperimentsSchema}).
   *
   * @default 'aidb'
   */
  database?: string
  /**
   * Namespace partition for experiment events.
   *
   * @default 'experiments'
   */
  namespace?: string
  /**
   * Whether to bootstrap the canonical schema (`things`/`actions`/`verbs`)
   * before the first write.
   *
   * @default false
   */
  autoBootstrap?: boolean
}

/**
 * Backwards-compat alias for the prior `ChdbStorageOptions`. The
 * `dataPath` and `autoInit` fields are retained as no-ops to ease the
 * upgrade — they are ignored in favor of HTTP fetcher options.
 */
export interface ChdbStorageOptions extends Partial<ClickHouseExperimentStorageOptions> {
  /** @deprecated Embedded chdb is no longer used; supply `fetcher`. */
  dataPath?: string
  /** @deprecated Replaced by `autoBootstrap`. */
  autoInit?: boolean
}

const DEFAULT_NAMESPACE = 'experiments'

/**
 * Generate a stable event id. Timestamp + monotonic counter inside the
 * process — ClickHouse de-dupes on `actions.id` only via explicit DELETE,
 * so collisions across processes are tolerated (each becomes a separate
 * row).
 */
function makeEventIdFactory(): () => string {
  let counter = 0
  return () => `evt-${Date.now()}-${++counter}`
}

/**
 * Map a {@link TrackingEvent} to the SVO Action shape.
 *
 * `verb` carries the event type (`variant.complete`, etc.).
 * `subject` = `experimentId`, `object` = `variantId`. Everything else
 * lands in `data` so analytical queries can `JSONExtract*` whatever they
 * need without changing the schema.
 */
function eventToActionInput(
  event: TrackingEvent,
  eventId: string
): {
  id: string
  verb: string
  subject: string
  object: string
  roles: Record<string, string>
  data: Record<string, unknown>
  status: 'completed' | 'failed' | 'pending'
} {
  const data = event.data
  const experimentId = String(data['experimentId'] ?? '')
  const variantId = String(data['variantId'] ?? '')
  const runId = String(data['runId'] ?? '')
  const success = data['success'] !== false
  const status: 'completed' | 'failed' | 'pending' =
    event.type === 'variant.error' || !success ? 'failed' : 'completed'

  // Capture every payload field — aggregation SQL uses JSONExtract* against
  // the `data` JSON blob.
  const errorMessage =
    data['error'] instanceof Error
      ? data['error'].message
      : data['errorMessage'] !== undefined
      ? String(data['errorMessage'])
      : ''
  const errorStack = data['error'] instanceof Error ? data['error'].stack ?? '' : ''
  const durationMs = Number(data['duration'] ?? data['durationMs'] ?? 0)

  const payload: Record<string, unknown> = {
    eventId,
    eventType: event.type,
    timestamp: event.timestamp.toISOString(),
    experimentId,
    experimentName: String(data['experimentName'] ?? ''),
    variantId,
    variantName: String(data['variantName'] ?? ''),
    runId,
    success: success ? 1 : 0,
    durationMs,
    dimensions: data['dimensions'] ?? data['config'] ?? {},
    result: data['result'] ?? {},
    metricName: String(data['metricName'] ?? ''),
    metricValue: Number(data['metricValue'] ?? 0),
    errorMessage,
    errorStack,
    metadata: data['metadata'] ?? {},
  }

  return {
    id: eventId,
    verb: event.type,
    subject: experimentId,
    object: variantId,
    roles: runId ? { runId } : {},
    data: payload,
    status,
  }
}

/**
 * ClickHouse-backed experiment storage built on the canonical
 * {@link ClickHouseProvider} adapter. Implements
 * {@link TrackingBackend}.
 *
 * @example
 * ```ts
 * import { configureTracking } from 'ai-experiments'
 * import { createClickHouseExperimentStorage } from 'ai-experiments/storage'
 * import { createClickHouseHttpFetcher } from 'ai-database'
 *
 * const fetcher = createClickHouseHttpFetcher({
 *   url: process.env.CLICKHOUSE_URL!,
 *   username: process.env.CLICKHOUSE_USER,
 *   password: process.env.CLICKHOUSE_PASSWORD,
 *   database: 'aidb',
 * })
 * const storage = createClickHouseExperimentStorage({ fetcher })
 *
 * configureTracking({ backend: storage })
 *
 * // Later: analyse results
 * const best = await storage.getBestVariant('my-experiment')
 * ```
 */
export class ClickHouseExperimentStorage implements TrackingBackend {
  private readonly provider: ClickHouseProvider
  private readonly fetcher: ClickHouseHttpFetcher
  private readonly database: string
  private readonly namespace: string
  private readonly autoBootstrap: boolean
  private bootstrapped = false
  private readonly nextEventId = makeEventIdFactory()

  constructor(options: ClickHouseExperimentStorageOptions) {
    this.fetcher = options.fetcher
    this.database = options.database ?? 'aidb'
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE
    this.autoBootstrap = options.autoBootstrap ?? false
    this.provider = createClickHouseProvider({
      fetcher: options.fetcher,
      database: this.database,
      namespace: this.namespace,
    })
  }

  /** Underlying canonical CH provider (escape hatch for advanced callers). */
  getProvider(): ClickHouseProvider {
    return this.provider
  }

  private async ensureBootstrap(): Promise<void> {
    if (this.bootstrapped) return
    if (this.autoBootstrap) {
      await bootstrapClickHouseSchema(this.fetcher, { database: this.database })
    }
    this.bootstrapped = true
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TrackingBackend implementation
  // ───────────────────────────────────────────────────────────────────────────

  async track(event: TrackingEvent): Promise<void> {
    await this.ensureBootstrap()
    const eventId = this.nextEventId()
    const action = eventToActionInput(event, eventId)
    await this.provider.recordAction({
      verb: action.verb,
      subject: action.subject,
      object: action.object,
      roles: action.roles,
      data: action.data,
      status: action.status,
    })
  }

  async flush(): Promise<void> {
    // Writes go straight through HTTP — nothing to flush.
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Direct experiment-result API
  // ───────────────────────────────────────────────────────────────────────────

  async storeResult(result: ExperimentResult): Promise<void> {
    await this.track({
      type: 'variant.complete',
      timestamp: result.completedAt,
      data: {
        experimentId: result.experimentId,
        variantId: result.variantId,
        variantName: result.variantName,
        runId: result.runId,
        success: result.success,
        duration: result.duration,
        result: result.result,
        metricValue: result.metricValue,
        error: result.error,
        metadata: result.metadata,
      },
    })
  }

  /**
   * Bulk-store results via {@link ClickHouseProvider.commitBatch}. One
   * HTTP POST per call carries the entire batch as `JSONEachRow`.
   */
  async storeResults(results: ExperimentResult[]): Promise<void> {
    if (results.length === 0) return
    await this.ensureBootstrap()
    const actions = results.map((r) => {
      const action = eventToActionInput(
        {
          type: 'variant.complete',
          timestamp: r.completedAt,
          data: {
            experimentId: r.experimentId,
            variantId: r.variantId,
            variantName: r.variantName,
            runId: r.runId,
            success: r.success,
            duration: r.duration,
            result: r.result,
            metricValue: r.metricValue,
            error: r.error,
            metadata: r.metadata,
          },
        },
        this.nextEventId()
      )
      return action
    })
    await this.provider.commitBatch({ actions })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Analytics queries (raw SQL via canonical adapter's analyticsQuery)
  // ───────────────────────────────────────────────────────────────────────────

  /** Quote a SQL string literal — same shape as the canonical adapter. */
  private quote(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }

  /**
   * Get all experiments seen in the actions table (variant.complete events).
   */
  async getExperiments(): Promise<
    Array<{
      experimentId: string
      experimentName: string
      variantCount: number
      runCount: number
      firstRun: string
      lastRun: string
    }>
  > {
    await this.ensureBootstrap()
    const ns = this.quote(this.namespace)
    const sql = `
      SELECT
        subject AS experimentId,
        any(JSONExtractString(data, 'experimentName')) AS experimentName,
        uniq(object) AS variantCount,
        count() AS runCount,
        toString(min(created_at)) AS firstRun,
        toString(max(created_at)) AS lastRun
      FROM ${this.database}.actions
      WHERE ns = ${ns} AND verb = 'variant.complete' AND subject != ''
      GROUP BY subject
      ORDER BY lastRun DESC
    `
    const rows = await this.provider.analyticsQuery(sql)
    return rows.map((row) => ({
      experimentId: String(row['experimentId'] ?? ''),
      experimentName: String(row['experimentName'] ?? ''),
      variantCount: Number(row['variantCount'] ?? 0),
      runCount: Number(row['runCount'] ?? 0),
      firstRun: String(row['firstRun'] ?? ''),
      lastRun: String(row['lastRun'] ?? ''),
    }))
  }

  async getVariantStats(experimentId: string): Promise<
    Array<{
      variantId: string
      variantName: string
      runCount: number
      successCount: number
      successRate: number
      avgDuration: number
      avgMetric: number
      minMetric: number
      maxMetric: number
    }>
  > {
    await this.ensureBootstrap()
    const ns = this.quote(this.namespace)
    const exp = this.quote(experimentId)
    const sql = `
      SELECT
        object AS variantId,
        any(JSONExtractString(data, 'variantName')) AS variantName,
        count() AS runCount,
        countIf(JSONExtractInt(data, 'success') = 1) AS successCount,
        countIf(JSONExtractInt(data, 'success') = 1) / count() AS successRate,
        avg(JSONExtractFloat(data, 'durationMs')) AS avgDuration,
        avg(JSONExtractFloat(data, 'metricValue')) AS avgMetric,
        min(JSONExtractFloat(data, 'metricValue')) AS minMetric,
        max(JSONExtractFloat(data, 'metricValue')) AS maxMetric
      FROM ${this.database}.actions
      WHERE ns = ${ns} AND verb = 'variant.complete' AND subject = ${exp}
      GROUP BY object
      ORDER BY avgMetric DESC
    `
    const rows = await this.provider.analyticsQuery(sql)
    return rows.map((row) => ({
      variantId: String(row['variantId'] ?? ''),
      variantName: String(row['variantName'] ?? ''),
      runCount: Number(row['runCount'] ?? 0),
      successCount: Number(row['successCount'] ?? 0),
      successRate: Number(row['successRate'] ?? 0),
      avgDuration: Number(row['avgDuration'] ?? 0),
      avgMetric: Number(row['avgMetric'] ?? 0),
      minMetric: Number(row['minMetric'] ?? 0),
      maxMetric: Number(row['maxMetric'] ?? 0),
    }))
  }

  async getBestVariant(
    experimentId: string,
    options: {
      metric?: 'avgMetric' | 'successRate' | 'avgDuration'
      minimumRuns?: number
    } = {}
  ): Promise<{
    variantId: string
    variantName: string
    metricValue: number
    runCount: number
  } | null> {
    await this.ensureBootstrap()
    const { metric = 'avgMetric', minimumRuns = 1 } = options
    const ns = this.quote(this.namespace)
    const exp = this.quote(experimentId)
    const orderBy = metric === 'avgDuration' ? 'ASC' : 'DESC'
    const metricExpr =
      metric === 'successRate'
        ? "countIf(JSONExtractInt(data, 'success') = 1) / count()"
        : metric === 'avgDuration'
        ? "avg(JSONExtractFloat(data, 'durationMs'))"
        : "avg(JSONExtractFloat(data, 'metricValue'))"

    const sql = `
      SELECT
        object AS variantId,
        any(JSONExtractString(data, 'variantName')) AS variantName,
        ${metricExpr} AS metricValue,
        count() AS runCount
      FROM ${this.database}.actions
      WHERE ns = ${ns} AND verb = 'variant.complete' AND subject = ${exp}
      GROUP BY object
      HAVING runCount >= ${Number(minimumRuns)}
      ORDER BY metricValue ${orderBy}
      LIMIT 1
    `
    const rows = await this.provider.analyticsQuery(sql)
    if (rows.length === 0) return null
    const row = rows[0]!
    return {
      variantId: String(row['variantId'] ?? ''),
      variantName: String(row['variantName'] ?? ''),
      metricValue: Number(row['metricValue'] ?? 0),
      runCount: Number(row['runCount'] ?? 0),
    }
  }

  async getCartesianAnalysis(
    experimentId: string,
    dimension: string
  ): Promise<
    Array<{
      dimensionValue: string
      runCount: number
      avgMetric: number
      successRate: number
    }>
  > {
    await this.ensureBootstrap()
    const ns = this.quote(this.namespace)
    const exp = this.quote(experimentId)
    const dimQuoted = this.quote(dimension)
    const sql = `
      SELECT
        JSONExtractString(JSONExtractRaw(data, 'dimensions'), ${dimQuoted}) AS dimensionValue,
        count() AS runCount,
        avg(JSONExtractFloat(data, 'metricValue')) AS avgMetric,
        countIf(JSONExtractInt(data, 'success') = 1) / count() AS successRate
      FROM ${this.database}.actions
      WHERE ns = ${ns} AND verb = 'variant.complete' AND subject = ${exp}
      GROUP BY dimensionValue
      HAVING dimensionValue != ''
      ORDER BY avgMetric DESC
    `
    const rows = await this.provider.analyticsQuery(sql)
    return rows.map((row) => ({
      dimensionValue: String(row['dimensionValue'] ?? ''),
      runCount: Number(row['runCount'] ?? 0),
      avgMetric: Number(row['avgMetric'] ?? 0),
      successRate: Number(row['successRate'] ?? 0),
    }))
  }

  async getCartesianGrid(
    experimentId: string,
    dimensions: string[]
  ): Promise<
    Array<{
      dimensions: Record<string, string>
      runCount: number
      avgMetric: number
      successRate: number
    }>
  > {
    await this.ensureBootstrap()
    const ns = this.quote(this.namespace)
    const exp = this.quote(experimentId)
    const dimExtracts = dimensions
      .map(
        (d) => `JSONExtractString(JSONExtractRaw(data, 'dimensions'), ${this.quote(d)}) AS dim_${d}`
      )
      .join(', ')
    const dimGroupBy = dimensions.map((d) => `dim_${d}`).join(', ')

    const sql = `
      SELECT
        ${dimExtracts},
        count() AS runCount,
        avg(JSONExtractFloat(data, 'metricValue')) AS avgMetric,
        countIf(JSONExtractInt(data, 'success') = 1) / count() AS successRate
      FROM ${this.database}.actions
      WHERE ns = ${ns} AND verb = 'variant.complete' AND subject = ${exp}
      GROUP BY ${dimGroupBy}
      ORDER BY avgMetric DESC
    `
    const rows = await this.provider.analyticsQuery(sql)
    return rows.map((row) => {
      const dims: Record<string, string> = {}
      for (const d of dimensions) {
        dims[d] = String(row[`dim_${d}`] ?? '')
      }
      return {
        dimensions: dims,
        runCount: Number(row['runCount'] ?? 0),
        avgMetric: Number(row['avgMetric'] ?? 0),
        successRate: Number(row['successRate'] ?? 0),
      }
    })
  }

  async getTimeSeries(
    experimentId: string,
    options: {
      interval?: 'hour' | 'day' | 'week'
      variantId?: string
    } = {}
  ): Promise<
    Array<{
      period: string
      runCount: number
      avgMetric: number
      successRate: number
    }>
  > {
    await this.ensureBootstrap()
    const { interval = 'day', variantId } = options
    const ns = this.quote(this.namespace)
    const exp = this.quote(experimentId)
    const dateFunc =
      interval === 'hour'
        ? 'toStartOfHour(created_at)'
        : interval === 'week'
        ? 'toStartOfWeek(created_at)'
        : 'toStartOfDay(created_at)'
    const variantFilter = variantId ? `AND object = ${this.quote(variantId)}` : ''

    const sql = `
      SELECT
        toString(${dateFunc}) AS period,
        count() AS runCount,
        avg(JSONExtractFloat(data, 'metricValue')) AS avgMetric,
        countIf(JSONExtractInt(data, 'success') = 1) / count() AS successRate
      FROM ${this.database}.actions
      WHERE ns = ${ns} AND verb = 'variant.complete' AND subject = ${exp}
        ${variantFilter}
      GROUP BY period
      ORDER BY period ASC
    `
    const rows = await this.provider.analyticsQuery(sql)
    return rows.map((row) => ({
      period: String(row['period'] ?? ''),
      runCount: Number(row['runCount'] ?? 0),
      avgMetric: Number(row['avgMetric'] ?? 0),
      successRate: Number(row['successRate'] ?? 0),
    }))
  }

  async getEvents(
    experimentId: string,
    options: {
      eventType?: string
      variantId?: string
      limit?: number
    } = {}
  ): Promise<TrackingEvent[]> {
    await this.ensureBootstrap()
    const { eventType, variantId, limit = 100 } = options
    const ns = this.quote(this.namespace)
    const exp = this.quote(experimentId)
    const filters = [`ns = ${ns}`, `subject = ${exp}`]
    if (eventType) filters.push(`verb = ${this.quote(eventType)}`)
    if (variantId) filters.push(`object = ${this.quote(variantId)}`)

    const sql = `
      SELECT
        verb AS eventType,
        toString(created_at) AS createdAt,
        data
      FROM ${this.database}.actions
      WHERE ${filters.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${Number(limit)}
    `
    const rows = await this.provider.analyticsQuery(sql)
    return rows.map((row) => {
      const dataStr = row['data']
      let payload: Record<string, unknown> = {}
      if (typeof dataStr === 'string' && dataStr.length > 0) {
        try {
          payload = JSON.parse(dataStr) as Record<string, unknown>
        } catch {
          payload = {}
        }
      } else if (dataStr && typeof dataStr === 'object') {
        payload = dataStr as Record<string, unknown>
      }
      const createdAt = String(row['createdAt'] ?? '')
      const ts = createdAt ? new Date(createdAt) : new Date()
      return {
        type: String(row['eventType'] ?? '') as TrackingEvent['type'],
        timestamp: Number.isNaN(ts.getTime()) ? new Date() : ts,
        data: payload,
      }
    })
  }

  /**
   * Raw analytical SQL pass-through. Routes to
   * {@link ClickHouseProvider.analyticsQuery}.
   */
  async query(sql: string): Promise<Array<Record<string, unknown>>> {
    return this.provider.analyticsQuery(sql)
  }

  /** No-op (kept for backwards compat with the chdb-era API). */
  close(): void {
    // HTTP fetcher has nothing to release.
  }
}

/**
 * Bootstrap the canonical CH schema (`things`, `actions`, `verbs`).
 * Convenience wrapper around the canonical
 * {@link bootstrapClickHouseSchema}.
 */
export async function bootstrapExperimentsSchema(
  fetcher: ClickHouseHttpFetcher,
  options: { database?: string } = {}
): Promise<void> {
  await bootstrapClickHouseSchema(
    fetcher,
    options.database !== undefined ? { database: options.database } : {}
  )
}

/**
 * Create a ClickHouse-backed experiment storage backend.
 *
 * @example
 * ```ts
 * import { configureTracking } from 'ai-experiments'
 * import { createClickHouseExperimentStorage } from 'ai-experiments/storage'
 * import { createClickHouseHttpFetcher } from 'ai-database'
 *
 * const fetcher = createClickHouseHttpFetcher({
 *   url: process.env.CLICKHOUSE_URL!,
 *   username: process.env.CLICKHOUSE_USER,
 *   password: process.env.CLICKHOUSE_PASSWORD,
 *   database: 'aidb',
 * })
 * const storage = createClickHouseExperimentStorage({ fetcher })
 *
 * configureTracking({ backend: storage })
 *
 * const best = await storage.getBestVariant('my-experiment')
 * ```
 */
export function createClickHouseExperimentStorage(
  options: ClickHouseExperimentStorageOptions
): ClickHouseExperimentStorage {
  return new ClickHouseExperimentStorage(options)
}

// =============================================================================
// Backwards-compat aliases (chdb-era names)
// =============================================================================

/**
 * @deprecated Renamed to {@link ClickHouseExperimentStorage}. The class
 * now wraps the canonical `ClickHouseProvider` from `ai-database` instead
 * of embedded chdb. The old `dataPath` constructor option is ignored —
 * supply a `fetcher` instead.
 */
export const ChdbStorage = ClickHouseExperimentStorage
export type ChdbStorage = ClickHouseExperimentStorage

/**
 * @deprecated Renamed to {@link createClickHouseExperimentStorage}.
 */
export function createChdbBackend(
  options: ClickHouseExperimentStorageOptions
): ClickHouseExperimentStorage {
  return createClickHouseExperimentStorage(options)
}
