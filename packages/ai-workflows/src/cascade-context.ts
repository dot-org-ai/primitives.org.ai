/**
 * Cascade Context - Correlation IDs and step metadata for workflow execution
 *
 * Provides distributed tracing support with:
 * - Unique correlation IDs per cascade
 * - Step timing metadata (started_at, completed_at, duration)
 * - Cascade path recording
 * - Context inheritance for nested operations
 * - Serialization for distributed systems
 * - W3C Trace Context compatibility
 */

/**
 * Step status in the cascade
 */
export type StepStatus = 'running' | 'completed' | 'failed'

/**
 * 5W+H Event structure
 */
export interface FiveWHEvent {
  who: string
  what: string
  when: number
  where: string
  why?: string
  how: {
    duration?: number
    status: StepStatus
    metadata?: Record<string, unknown>
  }
}

/**
 * Cascade step with timing and metadata
 */
export interface CascadeStep {
  /** Step name */
  name: string
  /** When the step started (unix timestamp ms) */
  startedAt: number
  /** When the step completed (unix timestamp ms) */
  completedAt?: number
  /** Duration in milliseconds */
  duration?: number
  /** Current status */
  status: StepStatus
  /** Error if failed */
  error?: Error
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Mark step as completed */
  complete: () => void
  /** Mark step as failed */
  fail: (error: Error) => void
  /** Add metadata to the step */
  addMetadata: (data: Record<string, unknown>) => void
  /** Convert step to 5W+H event format */
  to5WHEvent: () => FiveWHEvent
}

/**
 * Serialized cascade step (for transmission/storage)
 */
export interface SerializedCascadeStep {
  name: string
  startedAt: number
  completedAt?: number
  duration?: number
  status: StepStatus
  metadata?: Record<string, unknown>
}

/**
 * W3C Trace Context
 */
export interface TraceContext {
  traceparent: string
  tracestate?: string
}

/**
 * Serialized cascade context
 */
export interface SerializedCascadeContext {
  correlationId: string
  spanId: string
  parentId?: string
  name?: string
  depth: number
  steps: SerializedCascadeStep[]
  path: string[]
  createdAt: number
}

/**
 * Cascade context for tracking workflow execution
 */
export interface CascadeContext {
  /** Unique correlation ID for this cascade (propagates to children) */
  correlationId: string
  /** Unique span ID for this context */
  spanId: string
  /** Parent span ID (if this is a child context) */
  parentId?: string
  /** Name of this cascade/context */
  name?: string
  /** Depth in the context hierarchy (0 = root) */
  depth: number
  /** Steps recorded in this context */
  steps: CascadeStep[]
  /** Path of step names in this context */
  path: string[]
  /** Full path including parent context steps */
  fullPath: string[]
  /** When the context was created */
  createdAt: number
  /** Parent context reference */
  parent?: CascadeContext
  /** Serialize context for transmission */
  serialize: () => SerializedCascadeContext
  /** Format context as readable string */
  format: () => string
  /** Format as tree including parent contexts */
  formatTree: () => string
  /** Convert to W3C Trace Context format */
  toTraceContext: () => TraceContext
}

/**
 * Options for creating a cascade context
 */
export interface CascadeContextOptions {
  /** Custom correlation ID (auto-generated if not provided) */
  correlationId?: string
  /** Parent context (for nested operations) */
  parent?: CascadeContext
  /** Name for this cascade */
  name?: string
  /** Restore from serialized format */
  fromSerialized?: SerializedCascadeContext
  /** Restore from W3C trace context */
  fromTraceContext?: TraceContext
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Generate a span ID (16 hex characters)
 */
function generateSpanId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return 'xxxxxxxxxxxxxxxx'.replace(/x/g, () => {
    return ((Math.random() * 16) | 0).toString(16)
  })
}

/**
 * Parse W3C traceparent header
 */
function parseTraceparent(traceparent: string): { traceId: string; parentId: string } | null {
  const parts = traceparent.split('-')
  if (parts.length !== 4) return null
  return {
    traceId: parts[1]!, // 32 hex chars
    parentId: parts[2]!, // 16 hex chars
  }
}

/**
 * Convert correlation ID to trace ID format (32 hex chars)
 */
function correlationIdToTraceId(correlationId: string): string {
  // Remove dashes and pad/truncate to 32 chars
  const hex = correlationId.replace(/-/g, '')
  return hex.slice(0, 32).padEnd(32, '0')
}

/**
 * Convert trace ID to correlation ID format (UUID)
 */
function traceIdToCorrelationId(traceId: string): string {
  // Convert 32 hex chars to UUID format
  return `${traceId.slice(0, 8)}-${traceId.slice(8, 12)}-${traceId.slice(12, 16)}-${traceId.slice(
    16,
    20
  )}-${traceId.slice(20, 32)}`
}

/**
 * Create a cascade context for tracking workflow execution
 */
export function createCascadeContext(options: CascadeContextOptions = {}): CascadeContext {
  const { parent, name, fromSerialized, fromTraceContext } = options

  // Handle restoration from serialized format
  if (fromSerialized) {
    const restoredSteps: CascadeStep[] = fromSerialized.steps.map((s) =>
      createRestoredStep(s, name)
    )

    const ctx: CascadeContext = {
      correlationId: fromSerialized.correlationId,
      spanId: fromSerialized.spanId,
      ...(fromSerialized.parentId !== undefined && { parentId: fromSerialized.parentId }),
      ...(fromSerialized.name !== undefined && { name: fromSerialized.name }),
      depth: fromSerialized.depth,
      steps: restoredSteps,
      path: fromSerialized.path,
      createdAt: fromSerialized.createdAt,
      get fullPath() {
        return this.path
      },
      serialize: () => serializeContext(ctx),
      format: () => formatContext(ctx),
      formatTree: () => formatContextTree(ctx),
      toTraceContext: () => toTraceContext(ctx),
    }
    return ctx
  }

  // Handle restoration from W3C trace context
  if (fromTraceContext) {
    const parsed = parseTraceparent(fromTraceContext.traceparent)
    if (parsed) {
      const correlationId = traceIdToCorrelationId(parsed.traceId)
      const newSpanId = generateSpanId()

      const ctx: CascadeContext = {
        correlationId,
        spanId: newSpanId,
        parentId: parsed.parentId,
        ...(name !== undefined && { name }),
        depth: 0,
        steps: [],
        path: [],
        createdAt: Date.now(),
        get fullPath() {
          return this.path
        },
        serialize: () => serializeContext(ctx),
        format: () => formatContext(ctx),
        formatTree: () => formatContextTree(ctx),
        toTraceContext: () => toTraceContext(ctx),
      }
      return ctx
    }
  }

  // Determine correlation ID
  let correlationId: string
  if (parent) {
    correlationId = parent.correlationId
  } else if (options.correlationId) {
    correlationId = options.correlationId
  } else {
    correlationId = generateUUID()
  }

  const spanId = generateSpanId()
  const parentId = parent?.spanId
  const depth = parent ? parent.depth + 1 : 0
  const createdAt = Date.now()

  const steps: CascadeStep[] = []
  const path: string[] = []

  const ctx: CascadeContext = {
    correlationId,
    spanId,
    ...(parentId !== undefined && { parentId }),
    ...(name !== undefined && { name }),
    depth,
    steps,
    path,
    createdAt,
    ...(parent !== undefined && { parent }),
    get fullPath() {
      if (this.parent) {
        return [...this.parent.fullPath, ...this.path]
      }
      return this.path
    },
    serialize: () => serializeContext(ctx),
    format: () => formatContext(ctx),
    formatTree: () => formatContextTree(ctx),
    toTraceContext: () => toTraceContext(ctx),
  }

  return ctx
}

/**
 * Create a restored step from serialized data
 */
function createRestoredStep(serialized: SerializedCascadeStep, contextName?: string): CascadeStep {
  const step: CascadeStep = {
    name: serialized.name,
    startedAt: serialized.startedAt,
    ...(serialized.completedAt !== undefined && { completedAt: serialized.completedAt }),
    ...(serialized.duration !== undefined && { duration: serialized.duration }),
    status: serialized.status,
    ...(serialized.metadata !== undefined && { metadata: { ...serialized.metadata } }),
    complete: () => {
      step.status = 'completed'
      step.completedAt = Date.now()
      step.duration = step.completedAt - step.startedAt
    },
    fail: (error: Error) => {
      step.status = 'failed'
      step.error = error
      step.completedAt = Date.now()
      step.duration = step.completedAt - step.startedAt
    },
    addMetadata: (data: Record<string, unknown>) => {
      step.metadata = { ...step.metadata, ...data }
    },
    to5WHEvent: () => ({
      who: (step.metadata?.['actor'] as string) || 'system',
      what: (step.metadata?.['action'] as string) || step.name,
      when: step.startedAt,
      where: contextName || 'unknown',
      ...(step.metadata?.['reason'] !== undefined && { why: step.metadata['reason'] as string }),
      how: {
        ...(step.duration !== undefined && { duration: step.duration }),
        status: step.status,
        ...(step.metadata !== undefined && { metadata: step.metadata }),
      },
    }),
  }
  return step
}

/**
 * Record a step in the cascade context
 */
export function recordStep(
  ctx: CascadeContext,
  name: string,
  metadata?: Record<string, unknown>
): CascadeStep {
  const startedAt = Date.now()

  const step: CascadeStep = {
    name,
    startedAt,
    status: 'running',
    ...(metadata !== undefined && { metadata: { ...metadata } }),
    complete: () => {
      step.status = 'completed'
      step.completedAt = Date.now()
      step.duration = step.completedAt - step.startedAt
      ctx.path.push(name)
    },
    fail: (error: Error) => {
      step.status = 'failed'
      step.error = error
      step.completedAt = Date.now()
      step.duration = step.completedAt - step.startedAt
    },
    addMetadata: (data: Record<string, unknown>) => {
      step.metadata = { ...step.metadata, ...data }
    },
    to5WHEvent: () => ({
      who: (step.metadata?.['actor'] as string) || 'system',
      what: (step.metadata?.['action'] as string) || name,
      when: startedAt,
      where: ctx.name || 'cascade',
      ...(step.metadata?.['reason'] !== undefined && { why: step.metadata['reason'] as string }),
      how: {
        ...(step.duration !== undefined && { duration: step.duration }),
        status: step.status,
        ...(step.metadata !== undefined && { metadata: step.metadata }),
      },
    }),
  }

  ctx.steps.push(step)
  return step
}

/**
 * Execute a callback with cascade context
 */
export async function withCascadeContext<T>(
  callback: (ctx: CascadeContext) => Promise<T>,
  options: CascadeContextOptions = {}
): Promise<T> {
  const ctx = createCascadeContext(options)
  return callback(ctx)
}

/**
 * Serialize context for transmission/storage
 */
function serializeContext(ctx: CascadeContext): SerializedCascadeContext {
  return {
    correlationId: ctx.correlationId,
    spanId: ctx.spanId,
    ...(ctx.parentId !== undefined && { parentId: ctx.parentId }),
    ...(ctx.name !== undefined && { name: ctx.name }),
    depth: ctx.depth,
    steps: ctx.steps.map((step) => ({
      name: step.name,
      startedAt: step.startedAt,
      ...(step.completedAt !== undefined && { completedAt: step.completedAt }),
      ...(step.duration !== undefined && { duration: step.duration }),
      status: step.status,
      ...(step.metadata !== undefined && { metadata: step.metadata }),
    })),
    path: ctx.path,
    createdAt: ctx.createdAt,
  }
}

/**
 * Format context as readable string
 */
function formatContext(ctx: CascadeContext): string {
  const lines: string[] = []
  lines.push(`Cascade: ${ctx.name || 'unnamed'}`)
  lines.push(`  Correlation ID: ${ctx.correlationId}`)
  lines.push(`  Span ID: ${ctx.spanId}`)
  if (ctx.parentId) {
    lines.push(`  Parent ID: ${ctx.parentId}`)
  }
  lines.push(`  Depth: ${ctx.depth}`)
  lines.push(`  Steps:`)
  for (const step of ctx.steps) {
    const status =
      step.status === 'completed' ? '[OK]' : step.status === 'failed' ? '[FAIL]' : '[...]'
    const duration = step.duration ? ` (${step.duration}ms)` : ''
    lines.push(`    ${status} ${step.name}${duration}`)
  }
  return lines.join('\n')
}

/**
 * Format context as tree including parent contexts
 */
function formatContextTree(ctx: CascadeContext): string {
  const lines: string[] = []

  // Build tree from root
  const contexts: CascadeContext[] = []
  let current: CascadeContext | undefined = ctx
  while (current) {
    contexts.unshift(current)
    current = current.parent
  }

  for (let i = 0; i < contexts.length; i++) {
    const context = contexts[i]!
    const indent = '  '.repeat(i)
    lines.push(`${indent}${context.name || 'cascade'} (depth: ${context.depth})`)
    for (const step of context.steps) {
      const status =
        step.status === 'completed' ? '[OK]' : step.status === 'failed' ? '[FAIL]' : '[...]'
      const duration = step.duration ? ` (${step.duration}ms)` : ''
      lines.push(`${indent}  ${status} ${step.name}${duration}`)
    }
  }

  return lines.join('\n')
}

/**
 * Convert to W3C Trace Context format
 */
function toTraceContext(ctx: CascadeContext): TraceContext {
  const version = '00'
  const traceId = correlationIdToTraceId(ctx.correlationId)
  const spanId = ctx.spanId.padEnd(16, '0').slice(0, 16)
  const flags = '01' // sampled

  return {
    traceparent: `${version}-${traceId}-${spanId}-${flags}`,
  }
}
