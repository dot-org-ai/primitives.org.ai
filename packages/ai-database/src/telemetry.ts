/**
 * OpenTelemetry Integration for ai-database
 *
 * Provides instrumented wrappers and telemetry utilities for database operations.
 *
 * @example
 * ```ts
 * import { DB } from 'ai-database'
 * import { withDatabaseTelemetry, instrumentDB } from 'ai-database/telemetry'
 *
 * // Enable telemetry globally
 * withDatabaseTelemetry({ provider: createConsoleTelemetryProvider() }, async () => {
 *   const { db } = DB({ Lead: { name: 'string' } })
 *   const leads = await db.Lead.list()
 * })
 *
 * // Or instrument a DB instance
 * const { db } = DB({ Lead: { name: 'string' } })
 * const tracedDb = instrumentDB(db)
 * ```
 *
 * @packageDocumentation
 */

import {
  getTracer,
  getMeter,
  getLogger,
  setTelemetryProvider,
  getTelemetryProvider,
  createHandlerMetrics,
  SemanticAttributes,
  MetricNames,
  type Tracer,
  type Meter,
  type Logger,
  type Span,
  type SpanAttributes,
  type TelemetryProvider,
  type Counter,
  type Histogram,
} from '@org.ai/types'

// Package info
const PACKAGE_NAME = 'ai-database'
const PACKAGE_VERSION = '2.1.4'

// ============================================================================
// Package-level Telemetry
// ============================================================================

let packageTracer: Tracer | undefined
let packageMeter: Meter | undefined
let packageLogger: Logger | undefined
let dbMetrics: ReturnType<typeof createDatabaseMetrics> | undefined

/**
 * Get the tracer for ai-database
 */
export function getDatabaseTracer(): Tracer {
  if (!packageTracer) {
    packageTracer = getTracer(PACKAGE_NAME, PACKAGE_VERSION)
  }
  return packageTracer
}

/**
 * Get the meter for ai-database
 */
export function getDatabaseMeter(): Meter {
  if (!packageMeter) {
    packageMeter = getMeter(PACKAGE_NAME, PACKAGE_VERSION)
  }
  return packageMeter
}

/**
 * Get the logger for ai-database
 */
export function getDatabaseLogger(): Logger {
  if (!packageLogger) {
    packageLogger = getLogger(PACKAGE_NAME)
  }
  return packageLogger
}

/**
 * Create database-specific metrics
 */
export function createDatabaseMetrics(meter: Meter) {
  return {
    queryDuration: meter.createHistogram(
      MetricNames.DB_QUERY_DURATION,
      'Duration of database queries',
      'ms'
    ),
    queryTotal: meter.createCounter(MetricNames.DB_QUERY_TOTAL, 'Total number of database queries'),
    queryErrors: meter.createCounter(
      MetricNames.DB_QUERY_ERRORS,
      'Number of failed database queries'
    ),
    entityOps: meter.createCounter('db.entity.operations', 'Entity operations by type'),
    cacheHits: meter.createCounter('db.cache.hits', 'Number of cache hits'),
    cacheMisses: meter.createCounter('db.cache.misses', 'Number of cache misses'),
  }
}

/**
 * Get database metrics for the package
 */
export function getDatabaseMetrics() {
  if (!dbMetrics) {
    dbMetrics = createDatabaseMetrics(getDatabaseMeter())
  }
  return dbMetrics
}

/**
 * Reset cached telemetry instances
 */
export function resetTelemetry(): void {
  packageTracer = undefined
  packageMeter = undefined
  packageLogger = undefined
  dbMetrics = undefined
}

// ============================================================================
// Telemetry Context
// ============================================================================

/**
 * Options for withDatabaseTelemetry
 */
export interface WithDatabaseTelemetryOptions {
  /** Telemetry provider to use */
  provider?: TelemetryProvider
  /** Database system name */
  dbSystem?: string
  /** Database name */
  dbName?: string
}

/**
 * Execute a function with database telemetry enabled
 */
export async function withDatabaseTelemetry<T>(
  options: WithDatabaseTelemetryOptions,
  fn: () => Promise<T>
): Promise<T> {
  const previousProvider = getTelemetryProvider()

  if (options.provider) {
    setTelemetryProvider(options.provider)
    resetTelemetry()
  }

  try {
    return await fn()
  } finally {
    if (options.provider) {
      setTelemetryProvider(previousProvider)
      resetTelemetry()
    }
  }
}

// ============================================================================
// Query Instrumentation
// ============================================================================

/**
 * Database operation types
 */
export type DBOperation =
  | 'get'
  | 'list'
  | 'create'
  | 'update'
  | 'delete'
  | 'search'
  | 'query'
  | 'batch'

/**
 * Record a database query
 */
export function recordDBQuery(params: {
  operation: DBOperation
  entity?: string
  durationMs: number
  success: boolean
  rowCount?: number
}): void {
  const metrics = getDatabaseMetrics()
  const labels = {
    operation: params.operation,
    entity: params.entity || 'unknown',
    status: params.success ? 'success' : 'error',
  }

  metrics.queryTotal.add(1, labels)
  metrics.queryDuration.record(params.durationMs, labels)

  if (!params.success) {
    metrics.queryErrors.add(1, labels)
  }

  if (params.entity) {
    metrics.entityOps.add(1, { entity: params.entity, operation: params.operation })
  }
}

/**
 * Record a cache hit/miss
 */
export function recordCacheAccess(hit: boolean, entity?: string): void {
  const metrics = getDatabaseMetrics()
  const labels = { entity: entity || 'unknown' }

  if (hit) {
    metrics.cacheHits.add(1, labels)
  } else {
    metrics.cacheMisses.add(1, labels)
  }
}

/**
 * Create a traced database operation
 */
export function tracedDBOperation<TArgs extends unknown[], TResult>(
  operation: DBOperation,
  entity: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    getStatement?: (...args: TArgs) => string
  } = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const tracer = getDatabaseTracer()
    const logger = getDatabaseLogger()
    const startTime = Date.now()

    const attributes: SpanAttributes = {
      [SemanticAttributes.DB_SYSTEM]: 'ai-database',
      [SemanticAttributes.DB_OPERATION]: operation,
      'db.entity': entity,
    }

    if (options.getStatement) {
      attributes[SemanticAttributes.DB_STATEMENT] = options.getStatement(...args)
    }

    return tracer.withSpan(`db.${operation}`, { kind: 'client', attributes }, async (span) => {
      logger.debug(`DB ${operation} on ${entity}`, { operation, entity })

      try {
        const result = await fn(...args)
        const durationMs = Date.now() - startTime

        recordDBQuery({
          operation,
          entity,
          durationMs,
          success: true,
          ...(Array.isArray(result) ? { rowCount: result.length } : {}),
        })

        span.setStatus('ok')
        logger.debug(`DB ${operation} on ${entity} completed`, {
          durationMs,
          rowCount: Array.isArray(result) ? result.length : undefined,
        })

        return result
      } catch (error) {
        const durationMs = Date.now() - startTime
        const message = error instanceof Error ? error.message : String(error)

        recordDBQuery({
          operation,
          entity,
          durationMs,
          success: false,
        })

        span.setStatus('error', message)
        logger.error(
          `DB ${operation} on ${entity} failed`,
          error instanceof Error ? error : undefined,
          { durationMs }
        )

        throw error
      }
    }) as Promise<TResult>
  }
}

// ============================================================================
// Entity Operations Instrumentation
// ============================================================================

/**
 * Wrap entity operations with telemetry
 */
export function instrumentEntityOperations<T extends Record<string, (...args: any[]) => any>>(
  entityName: string,
  operations: T
): T {
  const instrumented: Record<string, (...args: any[]) => any> = {}

  for (const [opName, opFn] of Object.entries(operations)) {
    if (typeof opFn === 'function') {
      const operation = mapOperationName(opName)
      instrumented[opName] = tracedDBOperation(
        operation,
        entityName,
        opFn as (...args: unknown[]) => Promise<unknown>
      )
    }
  }

  return instrumented as T
}

/**
 * Map method names to operation types
 */
function mapOperationName(methodName: string): DBOperation {
  const mapping: Record<string, DBOperation> = {
    get: 'get',
    find: 'get',
    list: 'list',
    all: 'list',
    create: 'create',
    insert: 'create',
    update: 'update',
    patch: 'update',
    delete: 'delete',
    remove: 'delete',
    search: 'search',
    query: 'query',
    batch: 'batch',
    batchCreate: 'batch',
    batchUpdate: 'batch',
    batchDelete: 'batch',
  }

  return mapping[methodName] || 'query'
}

// ============================================================================
// DB Wrapper Instrumentation
// ============================================================================

/**
 * Instrument a DB instance with telemetry
 *
 * @example
 * ```ts
 * const { db } = DB({ Lead: { name: 'string' } })
 * const tracedDb = instrumentDB(db)
 *
 * // All operations are now traced
 * const leads = await tracedDb.Lead.list()
 * ```
 */
export function instrumentDB<T extends Record<string, any>>(db: T): T {
  const instrumented: Record<string, any> = {}

  for (const [entityName, entityOps] of Object.entries(db)) {
    if (typeof entityOps === 'object' && entityOps !== null) {
      instrumented[entityName] = instrumentEntityOperations(entityName, entityOps)
    } else {
      instrumented[entityName] = entityOps
    }
  }

  return instrumented as T
}

// ============================================================================
// Span Helpers
// ============================================================================

/**
 * Start a span for a database operation
 */
export function startDBSpan(
  operation: DBOperation,
  entity: string,
  attributes?: SpanAttributes
): Span {
  const tracer = getDatabaseTracer()
  return tracer.startSpan(`db.${operation}`, {
    kind: 'client',
    attributes: {
      [SemanticAttributes.DB_SYSTEM]: 'ai-database',
      [SemanticAttributes.DB_OPERATION]: operation,
      'db.entity': entity,
      ...attributes,
    },
  })
}

/**
 * Execute code within a database span
 */
export async function withDBSpan<T>(
  operation: DBOperation,
  entity: string,
  fn: (span: Span) => Promise<T>,
  attributes?: SpanAttributes
): Promise<T> {
  const tracer = getDatabaseTracer()
  return tracer.withSpan(
    `db.${operation}`,
    {
      kind: 'client',
      attributes: {
        [SemanticAttributes.DB_SYSTEM]: 'ai-database',
        [SemanticAttributes.DB_OPERATION]: operation,
        'db.entity': entity,
        ...attributes,
      },
    },
    fn
  ) as Promise<T>
}

// ============================================================================
// Re-exports from @org.ai/types
// ============================================================================

export {
  // Core types
  type Tracer,
  type Meter,
  type Logger,
  type Span,
  type SpanAttributes,
  type TelemetryProvider,
  type Counter,
  type Histogram,

  // Global functions
  getTracer,
  getMeter,
  getLogger,
  setTelemetryProvider,
  getTelemetryProvider,

  // Constants
  SemanticAttributes,
  MetricNames,

  // Utilities
  createHandlerMetrics,
} from '@org.ai/types'
