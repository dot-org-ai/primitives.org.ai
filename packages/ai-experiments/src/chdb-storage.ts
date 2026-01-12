/**
 * ClickHouse storage backend for AI experiments using chdb (embedded ClickHouse)
 *
 * Design: Single flat table where experiment events are the atomic unit.
 * Cartesian product results, variant comparisons, and winner analysis
 * are all derived via aggregation queries.
 *
 * This maximizes compression and enables fast analytical queries across
 * thousands of experiment runs.
 */

import { Session } from 'chdb'
import type { TrackingBackend, TrackingEvent, ExperimentResult } from './types.js'

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS experiments (
    -- Event identity
    eventId String,
    eventType LowCardinality(String),
    timestamp DateTime64(3),

    -- Experiment context
    experimentId String,
    experimentName String DEFAULT '',

    -- Variant context
    variantId String DEFAULT '',
    variantName String DEFAULT '',

    -- Cartesian product dimensions (stored as JSON for flexibility)
    dimensions String DEFAULT '{}',

    -- Execution data
    runId String DEFAULT '',
    success UInt8 DEFAULT 1,
    durationMs UInt32 DEFAULT 0,

    -- Result data
    result String DEFAULT '{}',
    metricName LowCardinality(String) DEFAULT '',
    metricValue Float64 DEFAULT 0,

    -- Error tracking
    errorMessage String DEFAULT '',
    errorStack String DEFAULT '',

    -- Metadata
    metadata String DEFAULT '{}'
)
ENGINE = MergeTree()
ORDER BY (experimentId, variantId, timestamp, eventId)
SETTINGS index_granularity = 8192
`

export interface ChdbStorageOptions {
  /** Path to store the chdb database (default: ./.experiments-chdb) */
  dataPath?: string
  /** Whether to create tables on init (default: true) */
  autoInit?: boolean
}

export class ChdbStorage implements TrackingBackend {
  private session: Session
  private initialized = false
  private eventCounter = 0

  constructor(private options: ChdbStorageOptions = {}) {
    this.session = new Session(options.dataPath ?? './.experiments-chdb')
  }

  private async init(): Promise<void> {
    if (this.initialized) return
    if (this.options.autoInit !== false) {
      this.session.query(CREATE_TABLE_SQL)
    }
    this.initialized = true
  }

  private escapeString(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  }

  private toJson(value: unknown): string {
    return JSON.stringify(value ?? {})
  }

  private parseJson<T>(value: string): T {
    try {
      return JSON.parse(value || '{}')
    } catch {
      return {} as T
    }
  }

  private nextEventId(): string {
    return `evt-${Date.now()}-${++this.eventCounter}`
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TrackingBackend Implementation
  // ─────────────────────────────────────────────────────────────────────────────

  async track(event: TrackingEvent): Promise<void> {
    await this.init()

    const eventId = this.nextEventId()
    const timestamp = event.timestamp.toISOString()
    const data = event.data

    // Extract standard fields from event data
    const experimentId = String(data.experimentId ?? '')
    const experimentName = String(data.experimentName ?? '')
    const variantId = String(data.variantId ?? '')
    const variantName = String(data.variantName ?? '')
    const runId = String(data.runId ?? '')
    const success = data.success !== false ? 1 : 0
    const durationMs = Number(data.duration ?? data.durationMs ?? 0)
    const metricName = String(data.metricName ?? '')
    const metricValue = Number(data.metricValue ?? 0)
    const errorMessage = data.error instanceof Error ? data.error.message : String(data.errorMessage ?? '')
    const errorStack = data.error instanceof Error ? (data.error.stack ?? '') : ''

    // Extract dimensions (for cartesian product tracking)
    const dimensions = data.dimensions ?? data.config ?? {}
    const result = data.result ?? {}
    const metadata = data.metadata ?? {}

    this.session.query(`
      INSERT INTO experiments (
        eventId, eventType, timestamp,
        experimentId, experimentName,
        variantId, variantName,
        dimensions, runId, success, durationMs,
        result, metricName, metricValue,
        errorMessage, errorStack, metadata
      ) VALUES (
        '${eventId}', '${event.type}', '${timestamp}',
        '${this.escapeString(experimentId)}', '${this.escapeString(experimentName)}',
        '${this.escapeString(variantId)}', '${this.escapeString(variantName)}',
        '${this.escapeString(this.toJson(dimensions))}',
        '${this.escapeString(runId)}', ${success}, ${durationMs},
        '${this.escapeString(this.toJson(result))}',
        '${this.escapeString(metricName)}', ${metricValue},
        '${this.escapeString(errorMessage)}', '${this.escapeString(errorStack)}',
        '${this.escapeString(this.toJson(metadata))}'
      )
    `)
  }

  async flush(): Promise<void> {
    // chdb writes are synchronous, nothing to flush
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Experiment Result Storage (direct API)
  // ─────────────────────────────────────────────────────────────────────────────

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

  async storeResults(results: ExperimentResult[]): Promise<void> {
    for (const result of results) {
      await this.storeResult(result)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Analytics Queries
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all experiments
   */
  async getExperiments(): Promise<Array<{
    experimentId: string
    experimentName: string
    variantCount: number
    runCount: number
    firstRun: string
    lastRun: string
  }>> {
    await this.init()

    const result = this.session.query(`
      SELECT
        experimentId,
        any(experimentName) AS experimentName,
        uniq(variantId) AS variantCount,
        count() AS runCount,
        min(timestamp) AS firstRun,
        max(timestamp) AS lastRun
      FROM experiments
      WHERE experimentId != '' AND eventType = 'variant.complete'
      GROUP BY experimentId
      ORDER BY lastRun DESC
    `, 'JSONEachRow')

    if (!result.trim()) return []

    return result.trim().split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))
  }

  /**
   * Get variant performance for an experiment
   */
  async getVariantStats(experimentId: string): Promise<Array<{
    variantId: string
    variantName: string
    runCount: number
    successCount: number
    successRate: number
    avgDuration: number
    avgMetric: number
    minMetric: number
    maxMetric: number
  }>> {
    await this.init()

    const result = this.session.query(`
      SELECT
        variantId,
        any(variantName) AS variantName,
        count() AS runCount,
        countIf(success = 1) AS successCount,
        countIf(success = 1) / count() AS successRate,
        avg(durationMs) AS avgDuration,
        avg(metricValue) AS avgMetric,
        min(metricValue) AS minMetric,
        max(metricValue) AS maxMetric
      FROM experiments
      WHERE experimentId = '${this.escapeString(experimentId)}'
        AND eventType = 'variant.complete'
      GROUP BY variantId
      ORDER BY avgMetric DESC
    `, 'JSONEachRow')

    if (!result.trim()) return []

    return result.trim().split('\n')
      .filter(Boolean)
      .map(line => {
        const row = JSON.parse(line)
        return {
          ...row,
          runCount: Number(row.runCount),
          successCount: Number(row.successCount),
          successRate: Number(row.successRate),
          avgDuration: Number(row.avgDuration),
          avgMetric: Number(row.avgMetric),
          minMetric: Number(row.minMetric),
          maxMetric: Number(row.maxMetric),
        }
      })
  }

  /**
   * Get the best performing variant for an experiment
   */
  async getBestVariant(experimentId: string, options: {
    metric?: 'avgMetric' | 'successRate' | 'avgDuration'
    minimumRuns?: number
  } = {}): Promise<{
    variantId: string
    variantName: string
    metricValue: number
    runCount: number
  } | null> {
    const { metric = 'avgMetric', minimumRuns = 1 } = options
    await this.init()

    const orderBy = metric === 'avgDuration' ? 'ASC' : 'DESC'
    const metricExpr = metric === 'successRate'
      ? 'countIf(success = 1) / count()'
      : metric === 'avgDuration'
        ? 'avg(durationMs)'
        : 'avg(metricValue)'

    const result = this.session.query(`
      SELECT
        variantId,
        any(variantName) AS variantName,
        ${metricExpr} AS metricValue,
        count() AS runCount
      FROM experiments
      WHERE experimentId = '${this.escapeString(experimentId)}'
        AND eventType = 'variant.complete'
      GROUP BY variantId
      HAVING runCount >= ${minimumRuns}
      ORDER BY metricValue ${orderBy}
      LIMIT 1
    `, 'JSONEachRow')

    if (!result.trim()) return null

    const firstLine = result.trim().split('\n')[0]
    if (!firstLine) return null
    const row = JSON.parse(firstLine)
    return {
      variantId: row.variantId,
      variantName: row.variantName,
      metricValue: Number(row.metricValue),
      runCount: Number(row.runCount),
    }
  }

  /**
   * Get cartesian product analysis - performance by dimension values
   */
  async getCartesianAnalysis(experimentId: string, dimension: string): Promise<Array<{
    dimensionValue: string
    runCount: number
    avgMetric: number
    successRate: number
  }>> {
    await this.init()

    const result = this.session.query(`
      SELECT
        JSONExtractString(dimensions, '${this.escapeString(dimension)}') AS dimensionValue,
        count() AS runCount,
        avg(metricValue) AS avgMetric,
        countIf(success = 1) / count() AS successRate
      FROM experiments
      WHERE experimentId = '${this.escapeString(experimentId)}'
        AND eventType = 'variant.complete'
        AND dimensionValue != ''
      GROUP BY dimensionValue
      ORDER BY avgMetric DESC
    `, 'JSONEachRow')

    if (!result.trim()) return []

    return result.trim().split('\n')
      .filter(Boolean)
      .map(line => {
        const row = JSON.parse(line)
        return {
          dimensionValue: row.dimensionValue,
          runCount: Number(row.runCount),
          avgMetric: Number(row.avgMetric),
          successRate: Number(row.successRate),
        }
      })
  }

  /**
   * Get multi-dimensional cartesian analysis
   */
  async getCartesianGrid(experimentId: string, dimensions: string[]): Promise<Array<{
    dimensions: Record<string, string>
    runCount: number
    avgMetric: number
    successRate: number
  }>> {
    await this.init()

    const dimExtracts = dimensions.map(d =>
      `JSONExtractString(dimensions, '${this.escapeString(d)}') AS dim_${d}`
    ).join(', ')

    const dimGroupBy = dimensions.map(d => `dim_${d}`).join(', ')

    const result = this.session.query(`
      SELECT
        ${dimExtracts},
        count() AS runCount,
        avg(metricValue) AS avgMetric,
        countIf(success = 1) / count() AS successRate
      FROM experiments
      WHERE experimentId = '${this.escapeString(experimentId)}'
        AND eventType = 'variant.complete'
      GROUP BY ${dimGroupBy}
      ORDER BY avgMetric DESC
    `, 'JSONEachRow')

    if (!result.trim()) return []

    return result.trim().split('\n')
      .filter(Boolean)
      .map(line => {
        const row = JSON.parse(line)
        const dims: Record<string, string> = {}
        for (const d of dimensions) {
          dims[d] = row[`dim_${d}`]
        }
        return {
          dimensions: dims,
          runCount: Number(row.runCount),
          avgMetric: Number(row.avgMetric),
          successRate: Number(row.successRate),
        }
      })
  }

  /**
   * Get time series of experiment metrics
   */
  async getTimeSeries(experimentId: string, options: {
    interval?: 'hour' | 'day' | 'week'
    variantId?: string
  } = {}): Promise<Array<{
    period: string
    runCount: number
    avgMetric: number
    successRate: number
  }>> {
    const { interval = 'day', variantId } = options
    await this.init()

    const dateFunc = interval === 'hour'
      ? 'toStartOfHour(timestamp)'
      : interval === 'week'
        ? 'toStartOfWeek(timestamp)'
        : 'toStartOfDay(timestamp)'

    const variantFilter = variantId
      ? `AND variantId = '${this.escapeString(variantId)}'`
      : ''

    const result = this.session.query(`
      SELECT
        ${dateFunc} AS period,
        count() AS runCount,
        avg(metricValue) AS avgMetric,
        countIf(success = 1) / count() AS successRate
      FROM experiments
      WHERE experimentId = '${this.escapeString(experimentId)}'
        AND eventType = 'variant.complete'
        ${variantFilter}
      GROUP BY period
      ORDER BY period ASC
    `, 'JSONEachRow')

    if (!result.trim()) return []

    return result.trim().split('\n')
      .filter(Boolean)
      .map(line => {
        const row = JSON.parse(line)
        return {
          period: row.period,
          runCount: Number(row.runCount),
          avgMetric: Number(row.avgMetric),
          successRate: Number(row.successRate),
        }
      })
  }

  /**
   * Get raw events for an experiment
   */
  async getEvents(experimentId: string, options: {
    eventType?: string
    variantId?: string
    limit?: number
  } = {}): Promise<TrackingEvent[]> {
    const { eventType, variantId, limit = 100 } = options
    await this.init()

    const filters = [`experimentId = '${this.escapeString(experimentId)}'`]
    if (eventType) filters.push(`eventType = '${this.escapeString(eventType)}'`)
    if (variantId) filters.push(`variantId = '${this.escapeString(variantId)}'`)

    const result = this.session.query(`
      SELECT
        eventType,
        timestamp,
        experimentId,
        experimentName,
        variantId,
        variantName,
        dimensions,
        runId,
        success,
        durationMs,
        result,
        metricName,
        metricValue,
        errorMessage,
        metadata
      FROM experiments
      WHERE ${filters.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `, 'JSONEachRow')

    if (!result.trim()) return []

    return result.trim().split('\n')
      .filter(Boolean)
      .map(line => {
        const row = JSON.parse(line)
        return {
          type: row.eventType,
          timestamp: new Date(row.timestamp),
          data: {
            experimentId: row.experimentId,
            experimentName: row.experimentName,
            variantId: row.variantId,
            variantName: row.variantName,
            dimensions: this.parseJson(row.dimensions),
            runId: row.runId,
            success: row.success === 1,
            duration: row.durationMs,
            result: this.parseJson(row.result),
            metricName: row.metricName,
            metricValue: row.metricValue,
            errorMessage: row.errorMessage,
            metadata: this.parseJson(row.metadata),
          },
        }
      })
  }

  /**
   * Raw SQL query access for custom analytics
   */
  query(sql: string, format: string = 'JSONEachRow'): string {
    return this.session.query(sql, format)
  }

  /**
   * Close the storage (cleanup)
   */
  close(): void {
    // Session cleanup handled by chdb
  }
}

/**
 * Create a chdb storage backend for experiments
 *
 * @example
 * ```ts
 * import { configureTracking } from 'ai-experiments'
 * import { createChdbBackend } from 'ai-experiments/storage'
 *
 * const storage = createChdbBackend({ dataPath: './.my-experiments' })
 *
 * configureTracking({ backend: storage })
 *
 * // Later: analyze results
 * const best = await storage.getBestVariant('my-experiment')
 * console.log(`Best variant: ${best.variantName} (${best.metricValue})`)
 * ```
 */
export function createChdbBackend(options?: ChdbStorageOptions): ChdbStorage {
  return new ChdbStorage(options)
}
