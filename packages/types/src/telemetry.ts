/**
 * OpenTelemetry Integration for AI Primitives
 *
 * Provides:
 * - Pluggable tracer/meter/logger interfaces (no hard dependency on OTel SDK)
 * - W3C Trace Context compatibility (integrates with cascade-context)
 * - Metrics hooks for handler duration, success/failure rates
 * - Structured logging with context propagation
 *
 * @packageDocumentation
 */

// ============================================================================
// W3C Trace Context Types
// ============================================================================

/**
 * W3C Trace Context headers
 * @see https://www.w3.org/TR/trace-context/
 */
export interface TraceContext {
  /** traceparent header: version-traceId-spanId-flags */
  traceparent: string
  /** tracestate header: vendor-specific trace data */
  tracestate?: string | undefined
}

/**
 * Parsed trace context components
 */
export interface ParsedTraceContext {
  /** Trace context version (always '00' for current spec) */
  version: string
  /** 32-character hex trace ID */
  traceId: string
  /** 16-character hex span ID */
  spanId: string
  /** Trace flags (e.g., '01' for sampled) */
  flags: string
  /** Whether the trace is sampled */
  sampled: boolean
}

/**
 * Parse a W3C traceparent header
 */
export function parseTraceparent(traceparent: string): ParsedTraceContext | null {
  const parts = traceparent.split('-')
  if (parts.length !== 4) return null

  const [version, traceId, spanId, flags] = parts
  if (!version || !traceId || !spanId || !flags) return null
  if (traceId.length !== 32 || spanId.length !== 16) return null

  return {
    version,
    traceId,
    spanId,
    flags,
    sampled: flags === '01',
  }
}

/**
 * Create a W3C traceparent header
 */
export function createTraceparent(
  traceId: string,
  spanId: string,
  sampled: boolean = true
): string {
  const version = '00'
  const flags = sampled ? '01' : '00'
  return `${version}-${traceId}-${spanId}-${flags}`
}

/**
 * Generate a random trace ID (32 hex characters)
 */
export function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16)
  )
}

/**
 * Generate a random span ID (16 hex characters)
 */
export function generateSpanId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return 'xxxxxxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))
}

// ============================================================================
// Span Types
// ============================================================================

/**
 * Span kind following OTel conventions
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer'

/**
 * Span status following OTel conventions
 */
export type SpanStatus = 'unset' | 'ok' | 'error'

/**
 * Attribute value types
 */
export type AttributeValue = string | number | boolean | string[] | number[] | boolean[]

/**
 * Span attributes
 */
export type SpanAttributes = Record<string, AttributeValue>

/**
 * Span event for recording point-in-time occurrences
 */
export interface SpanEvent {
  /** Event name */
  name: string
  /** Timestamp (Unix ms) */
  timestamp: number
  /** Event attributes */
  attributes?: SpanAttributes | undefined
}

/**
 * Span link for connecting related traces
 */
export interface SpanLink {
  /** Trace context of the linked span */
  context: TraceContext
  /** Link attributes */
  attributes?: SpanAttributes | undefined
}

/**
 * Span interface following OTel conventions
 */
export interface Span {
  /** Span name */
  name: string
  /** Span kind */
  kind: SpanKind
  /** Trace ID */
  traceId: string
  /** Span ID */
  spanId: string
  /** Parent span ID */
  parentSpanId?: string | undefined
  /** Start timestamp (Unix ms) */
  startTime: number
  /** End timestamp (Unix ms) */
  endTime?: number | undefined
  /** Duration in milliseconds */
  duration?: number | undefined
  /** Span status */
  status: SpanStatus
  /** Error message if status is 'error' */
  errorMessage?: string | undefined
  /** Span attributes */
  attributes: SpanAttributes
  /** Span events */
  events: SpanEvent[]
  /** Span links */
  links: SpanLink[]

  // Methods
  /** Set a single attribute */
  setAttribute(key: string, value: AttributeValue): void
  /** Set multiple attributes */
  setAttributes(attributes: SpanAttributes): void
  /** Add an event */
  addEvent(name: string, attributes?: SpanAttributes | undefined): void
  /** Set status */
  setStatus(status: SpanStatus, message?: string | undefined): void
  /** End the span */
  end(endTime?: number | undefined): void
  /** Get trace context for propagation */
  getTraceContext(): TraceContext
}

/**
 * Options for creating a span
 */
export interface SpanOptions {
  /** Span kind */
  kind?: SpanKind | undefined
  /** Initial attributes */
  attributes?: SpanAttributes | undefined
  /** Links to other spans */
  links?: SpanLink[] | undefined
  /** Start time (Unix ms), defaults to now */
  startTime?: number | undefined
  /** Parent trace context */
  parent?: TraceContext | undefined
}

// ============================================================================
// Tracer Interface
// ============================================================================

/**
 * Tracer interface for creating spans
 * Follows OTel Tracer API design without requiring OTel SDK
 */
export interface Tracer {
  /** Tracer name (usually package name) */
  name: string

  /**
   * Start a new span
   */
  startSpan(name: string, options?: SpanOptions): Span

  /**
   * Execute a callback with a new span
   */
  withSpan<T>(
    name: string,
    options: SpanOptions | undefined,
    fn: (span: Span) => T | Promise<T>
  ): T | Promise<T>

  /**
   * Get the active span (if any)
   */
  getActiveSpan(): Span | undefined

  /**
   * Extract trace context from carrier (e.g., headers)
   */
  extract(carrier: Record<string, string>): TraceContext | undefined

  /**
   * Inject trace context into carrier
   */
  inject(span: Span, carrier: Record<string, string>): void
}

// ============================================================================
// Meter Interface (Metrics)
// ============================================================================

/**
 * Metric label values
 */
export type MetricLabels = Record<string, string>

/**
 * Counter for monotonically increasing values
 */
export interface Counter {
  /** Add to counter */
  add(value: number, labels?: MetricLabels): void
}

/**
 * Histogram for distribution of values
 */
export interface Histogram {
  /** Record a value */
  record(value: number, labels?: MetricLabels): void
}

/**
 * Gauge for values that can go up or down
 */
export interface Gauge {
  /** Set the gauge value */
  set(value: number, labels?: MetricLabels): void
}

/**
 * Meter interface for creating metrics
 */
export interface Meter {
  /** Meter name (usually package name) */
  name: string

  /**
   * Create a counter
   * @param name - Metric name
   * @param description - Human-readable description
   * @param unit - Unit of measurement (e.g., 'ms', 'bytes', '1')
   */
  createCounter(name: string, description?: string, unit?: string): Counter

  /**
   * Create a histogram
   */
  createHistogram(name: string, description?: string, unit?: string): Histogram

  /**
   * Create a gauge
   */
  createGauge(name: string, description?: string, unit?: string): Gauge
}

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Log severity levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Log record
 */
export interface LogRecord {
  /** Log level */
  level: LogLevel
  /** Log message */
  message: string
  /** Timestamp (Unix ms) */
  timestamp: number
  /** Trace ID for correlation */
  traceId?: string | undefined
  /** Span ID for correlation */
  spanId?: string | undefined
  /** Additional attributes */
  attributes?: Record<string, unknown> | undefined
  /** Error object if logging an error */
  error?: Error | undefined
}

/**
 * Logger interface with trace context propagation
 */
export interface Logger {
  /** Logger name (usually package/module name) */
  name: string

  /** Log at trace level */
  trace(message: string, attributes?: Record<string, unknown>): void

  /** Log at debug level */
  debug(message: string, attributes?: Record<string, unknown>): void

  /** Log at info level */
  info(message: string, attributes?: Record<string, unknown>): void

  /** Log at warn level */
  warn(message: string, attributes?: Record<string, unknown>): void

  /** Log at error level */
  error(message: string, error?: Error, attributes?: Record<string, unknown>): void

  /** Log at fatal level */
  fatal(message: string, error?: Error, attributes?: Record<string, unknown>): void

  /** Create a child logger with additional context */
  child(attributes: Record<string, unknown>): Logger

  /** Set trace context for log correlation */
  setTraceContext(context: TraceContext): void
}

// ============================================================================
// Telemetry Provider Interface
// ============================================================================

/**
 * Unified telemetry provider interface
 * Allows plugging in OpenTelemetry or custom implementations
 */
export interface TelemetryProvider {
  /**
   * Get or create a tracer
   */
  getTracer(name: string, version?: string): Tracer

  /**
   * Get or create a meter
   */
  getMeter(name: string, version?: string): Meter

  /**
   * Get or create a logger
   */
  getLogger(name: string): Logger

  /**
   * Shutdown the telemetry provider
   */
  shutdown(): Promise<void>
}

// ============================================================================
// No-op Implementations
// ============================================================================

/**
 * Create a no-op span that does nothing
 */
function createNoopSpan(name: string, options: SpanOptions = {}): Span {
  const traceId = options.parent
    ? parseTraceparent(options.parent.traceparent)?.traceId || generateTraceId()
    : generateTraceId()
  const spanId = generateSpanId()
  const parentSpanId = options.parent
    ? parseTraceparent(options.parent.traceparent)?.spanId
    : undefined

  const span: Span = {
    name,
    kind: options.kind || 'internal',
    traceId,
    spanId,
    parentSpanId,
    startTime: options.startTime || Date.now(),
    status: 'unset',
    attributes: options.attributes || {},
    events: [],
    links: options.links || [],
    setAttribute: () => {},
    setAttributes: () => {},
    addEvent: () => {},
    setStatus: () => {},
    end: () => {},
    getTraceContext: () => ({
      traceparent: createTraceparent(traceId, spanId),
    }),
  }

  return span
}

/**
 * No-op tracer that creates minimal spans without exporting
 */
export const noopTracer: Tracer = {
  name: 'noop',
  startSpan: createNoopSpan,
  withSpan: async <T>(
    name: string,
    options: SpanOptions | undefined,
    fn: (span: Span) => T | Promise<T>
  ): Promise<T> => {
    const span = createNoopSpan(name, options)
    try {
      return await fn(span)
    } finally {
      span.end()
    }
  },
  getActiveSpan: () => undefined,
  extract: () => undefined,
  inject: () => {},
}

/**
 * No-op counter
 */
const noopCounter: Counter = {
  add: () => {},
}

/**
 * No-op histogram
 */
const noopHistogram: Histogram = {
  record: () => {},
}

/**
 * No-op gauge
 */
const noopGauge: Gauge = {
  set: () => {},
}

/**
 * No-op meter
 */
export const noopMeter: Meter = {
  name: 'noop',
  createCounter: () => noopCounter,
  createHistogram: () => noopHistogram,
  createGauge: () => noopGauge,
}

/**
 * No-op logger
 */
export const noopLogger: Logger = {
  name: 'noop',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
  setTraceContext: () => {},
}

/**
 * No-op telemetry provider
 */
export const noopTelemetryProvider: TelemetryProvider = {
  getTracer: () => noopTracer,
  getMeter: () => noopMeter,
  getLogger: () => noopLogger,
  shutdown: async () => {},
}

// ============================================================================
// Console-based Implementation
// ============================================================================

/**
 * Create a console-based span for debugging
 */
function createConsoleSpan(
  name: string,
  options: SpanOptions = {},
  logFn: (message: string, ...args: unknown[]) => void = console.log
): Span {
  const traceId = options.parent
    ? parseTraceparent(options.parent.traceparent)?.traceId || generateTraceId()
    : generateTraceId()
  const spanId = generateSpanId()
  const parentSpanId = options.parent
    ? parseTraceparent(options.parent.traceparent)?.spanId
    : undefined
  const startTime = options.startTime || Date.now()

  logFn(`[SPAN START] ${name}`, {
    traceId: traceId.slice(0, 8),
    spanId,
    parentSpanId,
    kind: options.kind || 'internal',
  })

  const attributes: SpanAttributes = { ...options.attributes }
  const events: SpanEvent[] = []
  let status: SpanStatus = 'unset'
  let errorMessage: string | undefined
  let endTime: number | undefined
  let duration: number | undefined

  const span: Span = {
    name,
    kind: options.kind || 'internal',
    traceId,
    spanId,
    parentSpanId,
    startTime,
    get endTime() {
      return endTime
    },
    get duration() {
      return duration
    },
    get status() {
      return status
    },
    get errorMessage() {
      return errorMessage
    },
    attributes,
    events,
    links: options.links || [],
    setAttribute: (key: string, value: AttributeValue) => {
      attributes[key] = value
    },
    setAttributes: (attrs: SpanAttributes) => {
      Object.assign(attributes, attrs)
    },
    addEvent: (eventName: string, eventAttrs?: SpanAttributes) => {
      const event: SpanEvent = {
        name: eventName,
        timestamp: Date.now(),
        attributes: eventAttrs,
      }
      events.push(event)
      logFn(`[SPAN EVENT] ${name}::${eventName}`, eventAttrs)
    },
    setStatus: (s: SpanStatus, message?: string) => {
      status = s
      errorMessage = message
    },
    end: (time?: number) => {
      endTime = time || Date.now()
      duration = endTime - startTime
      const statusEmoji = status === 'error' ? '[ERROR]' : status === 'ok' ? '[OK]' : ''
      logFn(`[SPAN END] ${name} ${statusEmoji}`, {
        duration: `${duration}ms`,
        status,
        ...(errorMessage && { error: errorMessage }),
        ...(Object.keys(attributes).length > 0 && { attributes }),
      })
    },
    getTraceContext: () => ({
      traceparent: createTraceparent(traceId, spanId),
    }),
  }

  return span
}

/**
 * Create a console-based tracer for debugging
 */
export function createConsoleTracer(name: string): Tracer {
  let activeSpan: Span | undefined

  return {
    name,
    startSpan: (spanName: string, options?: SpanOptions) => {
      const span = createConsoleSpan(spanName, options)
      activeSpan = span
      return span
    },
    withSpan: async <T>(
      spanName: string,
      options: SpanOptions | undefined,
      fn: (span: Span) => T | Promise<T>
    ): Promise<T> => {
      const span = createConsoleSpan(spanName, options)
      const previousSpan = activeSpan
      activeSpan = span
      try {
        const result = await fn(span)
        span.setStatus('ok')
        return result
      } catch (error) {
        span.setStatus('error', error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        span.end()
        activeSpan = previousSpan
      }
    },
    getActiveSpan: () => activeSpan,
    extract: (carrier: Record<string, string>) => {
      const traceparent = carrier['traceparent']
      if (!traceparent) return undefined
      return { traceparent, tracestate: carrier['tracestate'] }
    },
    inject: (span: Span, carrier: Record<string, string>) => {
      const ctx = span.getTraceContext()
      carrier['traceparent'] = ctx.traceparent
      if (ctx.tracestate) {
        carrier['tracestate'] = ctx.tracestate
      }
    },
  }
}

/**
 * Create a console-based meter for debugging
 */
export function createConsoleMeter(name: string): Meter {
  return {
    name,
    createCounter: (metricName: string, description?: string, unit?: string) => ({
      add: (value: number, labels?: MetricLabels) => {
        console.log(`[COUNTER] ${metricName}`, { value, labels, unit, description })
      },
    }),
    createHistogram: (metricName: string, description?: string, unit?: string) => ({
      record: (value: number, labels?: MetricLabels) => {
        console.log(`[HISTOGRAM] ${metricName}`, { value, labels, unit, description })
      },
    }),
    createGauge: (metricName: string, description?: string, unit?: string) => ({
      set: (value: number, labels?: MetricLabels) => {
        console.log(`[GAUGE] ${metricName}`, { value, labels, unit, description })
      },
    }),
  }
}

/**
 * Create a console-based logger for debugging
 */
export function createConsoleLogger(name: string): Logger {
  let traceContext: TraceContext | undefined
  let contextAttributes: Record<string, unknown> = {}

  const formatLog = (
    level: LogLevel,
    message: string,
    attributes?: Record<string, unknown>,
    error?: Error
  ) => {
    const record: LogRecord = {
      level,
      message,
      timestamp: Date.now(),
      traceId: traceContext ? parseTraceparent(traceContext.traceparent)?.traceId : undefined,
      spanId: traceContext ? parseTraceparent(traceContext.traceparent)?.spanId : undefined,
      attributes: { ...contextAttributes, ...attributes },
      error,
    }
    return record
  }

  const logger: Logger = {
    name,
    trace: (message, attributes) => {
      const record = formatLog('trace', message, attributes)
      console.debug(`[TRACE] [${name}] ${message}`, record.attributes)
    },
    debug: (message, attributes) => {
      const record = formatLog('debug', message, attributes)
      console.debug(`[DEBUG] [${name}] ${message}`, record.attributes)
    },
    info: (message, attributes) => {
      const record = formatLog('info', message, attributes)
      console.info(`[INFO] [${name}] ${message}`, record.attributes)
    },
    warn: (message, attributes) => {
      const record = formatLog('warn', message, attributes)
      console.warn(`[WARN] [${name}] ${message}`, record.attributes)
    },
    error: (message, error, attributes) => {
      const record = formatLog('error', message, attributes, error)
      console.error(`[ERROR] [${name}] ${message}`, error, record.attributes)
    },
    fatal: (message, error, attributes) => {
      const record = formatLog('fatal', message, attributes, error)
      console.error(`[FATAL] [${name}] ${message}`, error, record.attributes)
    },
    child: (attributes) => {
      const childLogger = createConsoleLogger(`${name}`)
      ;(
        childLogger as unknown as { contextAttributes: Record<string, unknown> }
      ).contextAttributes = { ...contextAttributes, ...attributes }
      if (traceContext) {
        childLogger.setTraceContext(traceContext)
      }
      return childLogger
    },
    setTraceContext: (context) => {
      traceContext = context
    },
  }

  return logger
}

/**
 * Create a console-based telemetry provider for debugging
 */
export function createConsoleTelemetryProvider(): TelemetryProvider {
  const tracers = new Map<string, Tracer>()
  const meters = new Map<string, Meter>()
  const loggers = new Map<string, Logger>()

  return {
    getTracer: (name: string) => {
      let tracer = tracers.get(name)
      if (!tracer) {
        tracer = createConsoleTracer(name)
        tracers.set(name, tracer)
      }
      return tracer
    },
    getMeter: (name: string) => {
      let meter = meters.get(name)
      if (!meter) {
        meter = createConsoleMeter(name)
        meters.set(name, meter)
      }
      return meter
    },
    getLogger: (name: string) => {
      let logger = loggers.get(name)
      if (!logger) {
        logger = createConsoleLogger(name)
        loggers.set(name, logger)
      }
      return logger
    },
    shutdown: async () => {
      tracers.clear()
      meters.clear()
      loggers.clear()
    },
  }
}

// ============================================================================
// Global Telemetry Configuration
// ============================================================================

let globalTelemetryProvider: TelemetryProvider = noopTelemetryProvider

/**
 * Set the global telemetry provider
 *
 * @example
 * ```ts
 * // Use console telemetry for debugging
 * setTelemetryProvider(createConsoleTelemetryProvider())
 *
 * // Or use OpenTelemetry SDK (via adapter)
 * setTelemetryProvider(createOtelAdapter(sdk))
 * ```
 */
export function setTelemetryProvider(provider: TelemetryProvider): void {
  globalTelemetryProvider = provider
}

/**
 * Get the current telemetry provider
 */
export function getTelemetryProvider(): TelemetryProvider {
  return globalTelemetryProvider
}

/**
 * Get a tracer from the global provider
 */
export function getTracer(name: string, version?: string): Tracer {
  return globalTelemetryProvider.getTracer(name, version)
}

/**
 * Get a meter from the global provider
 */
export function getMeter(name: string, version?: string): Meter {
  return globalTelemetryProvider.getMeter(name, version)
}

/**
 * Get a logger from the global provider
 */
export function getLogger(name: string): Logger {
  return globalTelemetryProvider.getLogger(name)
}

// ============================================================================
// Instrumentation Helpers
// ============================================================================

/**
 * Standard semantic attribute keys following OTel conventions
 */
export const SemanticAttributes = {
  // Service
  SERVICE_NAME: 'service.name',
  SERVICE_VERSION: 'service.version',

  // AI-specific
  AI_MODEL: 'ai.model',
  AI_PROVIDER: 'ai.provider',
  AI_INPUT_TOKENS: 'ai.input_tokens',
  AI_OUTPUT_TOKENS: 'ai.output_tokens',
  AI_TOTAL_TOKENS: 'ai.total_tokens',
  AI_COST_USD: 'ai.cost_usd',
  AI_TEMPERATURE: 'ai.temperature',
  AI_MAX_TOKENS: 'ai.max_tokens',
  AI_FUNCTION_NAME: 'ai.function.name',
  AI_FUNCTION_TYPE: 'ai.function.type',
  AI_TIER: 'ai.tier',

  // Database
  DB_SYSTEM: 'db.system',
  DB_OPERATION: 'db.operation',
  DB_NAME: 'db.name',
  DB_STATEMENT: 'db.statement',

  // Workflow
  WORKFLOW_NAME: 'workflow.name',
  WORKFLOW_STEP: 'workflow.step',
  WORKFLOW_STATUS: 'workflow.status',

  // HTTP
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',

  // Error
  EXCEPTION_TYPE: 'exception.type',
  EXCEPTION_MESSAGE: 'exception.message',
  EXCEPTION_STACKTRACE: 'exception.stacktrace',
} as const

/**
 * Standard metric names
 */
export const MetricNames = {
  // AI metrics
  AI_REQUEST_DURATION: 'ai.request.duration',
  AI_REQUEST_TOTAL: 'ai.request.total',
  AI_REQUEST_ERRORS: 'ai.request.errors',
  AI_TOKENS_USED: 'ai.tokens.used',
  AI_COST_TOTAL: 'ai.cost.total',

  // Handler metrics
  HANDLER_DURATION: 'handler.duration',
  HANDLER_TOTAL: 'handler.total',
  HANDLER_ERRORS: 'handler.errors',
  HANDLER_SUCCESS_RATE: 'handler.success_rate',

  // Database metrics
  DB_QUERY_DURATION: 'db.query.duration',
  DB_QUERY_TOTAL: 'db.query.total',
  DB_QUERY_ERRORS: 'db.query.errors',

  // Workflow metrics
  WORKFLOW_STEP_DURATION: 'workflow.step.duration',
  WORKFLOW_STEP_TOTAL: 'workflow.step.total',
  WORKFLOW_STEP_ERRORS: 'workflow.step.errors',
} as const

/**
 * Create standard AI metrics for a package
 */
export function createAIMetrics(meter: Meter) {
  return {
    requestDuration: meter.createHistogram(
      MetricNames.AI_REQUEST_DURATION,
      'Duration of AI requests',
      'ms'
    ),
    requestTotal: meter.createCounter(MetricNames.AI_REQUEST_TOTAL, 'Total number of AI requests'),
    requestErrors: meter.createCounter(
      MetricNames.AI_REQUEST_ERRORS,
      'Number of failed AI requests'
    ),
    tokensUsed: meter.createCounter(MetricNames.AI_TOKENS_USED, 'Total tokens used', 'tokens'),
    costTotal: meter.createCounter(MetricNames.AI_COST_TOTAL, 'Total cost in USD', 'usd'),
  }
}

/**
 * Create standard handler metrics
 */
export function createHandlerMetrics(meter: Meter) {
  return {
    duration: meter.createHistogram(
      MetricNames.HANDLER_DURATION,
      'Handler execution duration',
      'ms'
    ),
    total: meter.createCounter(MetricNames.HANDLER_TOTAL, 'Total handler invocations'),
    errors: meter.createCounter(MetricNames.HANDLER_ERRORS, 'Number of handler errors'),
  }
}

/**
 * Instrument a function with tracing and metrics
 *
 * @example
 * ```ts
 * const instrumentedFn = instrument(
 *   'ai.generate',
 *   myGenerateFunction,
 *   { kind: 'client' }
 * )
 * ```
 */
export function instrument<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    tracer?: Tracer
    meter?: Meter
    kind?: SpanKind
    attributes?: SpanAttributes
  } = {}
): (...args: TArgs) => Promise<TResult> {
  const tracer = options.tracer || getTracer('ai-primitives')
  const meter = options.meter || getMeter('ai-primitives')

  const metrics = createHandlerMetrics(meter)

  return async (...args: TArgs): Promise<TResult> => {
    const startTime = Date.now()

    return tracer.withSpan(
      name,
      { kind: options.kind || 'internal', attributes: options.attributes },
      async (span) => {
        metrics.total.add(1, { name })

        try {
          const result = await fn(...args)
          span.setStatus('ok')

          const duration = Date.now() - startTime
          metrics.duration.record(duration, { name, status: 'success' })

          return result
        } catch (error) {
          span.setStatus('error', error instanceof Error ? error.message : String(error))
          metrics.errors.add(1, { name })

          const duration = Date.now() - startTime
          metrics.duration.record(duration, { name, status: 'error' })

          throw error
        }
      }
    ) as Promise<TResult>
  }
}

// ============================================================================
// Runtime Symbols for Type Exports
// ============================================================================

export const TelemetrySymbol = Symbol('Telemetry')
export const TracerSymbol = Symbol('Tracer')
export const MeterSymbol = Symbol('Meter')
export const LoggerSymbol = Symbol('Logger')
export const SpanSymbol = Symbol('Span')
