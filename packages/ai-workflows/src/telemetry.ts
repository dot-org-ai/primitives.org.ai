/**
 * OpenTelemetry Integration for ai-workflows
 *
 * Provides instrumented wrappers and telemetry utilities for workflow execution.
 * Integrates with cascade-context for distributed tracing support.
 *
 * @example
 * ```ts
 * import { Workflow } from 'ai-workflows'
 * import { withWorkflowTelemetry, instrumentWorkflow } from 'ai-workflows/telemetry'
 *
 * // Enable telemetry globally
 * withWorkflowTelemetry({ provider: createConsoleTelemetryProvider() }, async () => {
 *   const workflow = Workflow($ => {
 *     $.on.Customer.created(async (customer) => {
 *       // Traced automatically
 *     })
 *   })
 *   await workflow.start()
 * })
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
  createTraceparent,
  parseTraceparent,
  generateTraceId,
  generateSpanId,
  type Tracer,
  type Meter,
  type Logger,
  type Span,
  type SpanAttributes,
  type TelemetryProvider,
  type TraceContext,
  type Counter,
  type Histogram,
} from '@org.ai/types'

import type { CascadeContext, CascadeStep } from './cascade-context.js'

// Package info
const PACKAGE_NAME = 'ai-workflows'
const PACKAGE_VERSION = '2.1.4'

// ============================================================================
// Package-level Telemetry
// ============================================================================

let packageTracer: Tracer | undefined
let packageMeter: Meter | undefined
let packageLogger: Logger | undefined
let workflowMetrics: ReturnType<typeof createWorkflowMetrics> | undefined

/**
 * Get the tracer for ai-workflows
 */
export function getWorkflowTracer(): Tracer {
  if (!packageTracer) {
    packageTracer = getTracer(PACKAGE_NAME, PACKAGE_VERSION)
  }
  return packageTracer
}

/**
 * Get the meter for ai-workflows
 */
export function getWorkflowMeter(): Meter {
  if (!packageMeter) {
    packageMeter = getMeter(PACKAGE_NAME, PACKAGE_VERSION)
  }
  return packageMeter
}

/**
 * Get the logger for ai-workflows
 */
export function getWorkflowLogger(): Logger {
  if (!packageLogger) {
    packageLogger = getLogger(PACKAGE_NAME)
  }
  return packageLogger
}

/**
 * Create workflow-specific metrics
 */
export function createWorkflowMetrics(meter: Meter) {
  return {
    stepDuration: meter.createHistogram(
      MetricNames.WORKFLOW_STEP_DURATION,
      'Duration of workflow steps',
      'ms'
    ),
    stepTotal: meter.createCounter(
      MetricNames.WORKFLOW_STEP_TOTAL,
      'Total number of workflow steps executed'
    ),
    stepErrors: meter.createCounter(
      MetricNames.WORKFLOW_STEP_ERRORS,
      'Number of failed workflow steps'
    ),
    eventHandlers: meter.createCounter('workflow.event.handlers', 'Event handler invocations'),
    scheduleHandlers: meter.createCounter(
      'workflow.schedule.handlers',
      'Schedule handler invocations'
    ),
    cascadeDepth: meter.createHistogram('workflow.cascade.depth', 'Cascade context depth'),
    cascadeDuration: meter.createHistogram(
      'workflow.cascade.duration',
      'Total cascade execution duration',
      'ms'
    ),
  }
}

/**
 * Get workflow metrics for the package
 */
export function getWorkflowMetrics() {
  if (!workflowMetrics) {
    workflowMetrics = createWorkflowMetrics(getWorkflowMeter())
  }
  return workflowMetrics
}

/**
 * Reset cached telemetry instances
 */
export function resetTelemetry(): void {
  packageTracer = undefined
  packageMeter = undefined
  packageLogger = undefined
  workflowMetrics = undefined
}

// ============================================================================
// Telemetry Context
// ============================================================================

/**
 * Options for withWorkflowTelemetry
 */
export interface WithWorkflowTelemetryOptions {
  /** Telemetry provider to use */
  provider?: TelemetryProvider
  /** Workflow name for labeling */
  workflowName?: string
}

/**
 * Execute a function with workflow telemetry enabled
 */
export async function withWorkflowTelemetry<T>(
  options: WithWorkflowTelemetryOptions,
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
// Cascade Context Integration
// ============================================================================

/**
 * Create a span from a CascadeContext
 *
 * This bridges the cascade-context W3C Trace Context support with OpenTelemetry.
 */
export function spanFromCascadeContext(ctx: CascadeContext, name?: string): Span {
  const tracer = getWorkflowTracer()
  const traceContext = ctx.toTraceContext()

  return tracer.startSpan(name || ctx.name || 'cascade', {
    kind: 'internal',
    parent: traceContext,
    attributes: {
      [SemanticAttributes.WORKFLOW_NAME]: ctx.name || 'cascade',
      'cascade.correlationId': ctx.correlationId,
      'cascade.spanId': ctx.spanId,
      'cascade.depth': ctx.depth,
      ...(ctx.parentId && { 'cascade.parentId': ctx.parentId }),
    },
  })
}

/**
 * Create a TraceContext from a span
 *
 * Allows propagating span context to cascade-context.
 */
export function traceContextFromSpan(span: Span): TraceContext {
  return span.getTraceContext()
}

/**
 * Record a CascadeStep as a span event
 */
export function recordStepAsSpanEvent(span: Span, step: CascadeStep): void {
  const attrs: SpanAttributes = {
    'step.status': step.status,
    ...(step.duration !== undefined && { 'step.duration': step.duration }),
    ...(step.metadata &&
      Object.keys(step.metadata).length > 0 && { 'step.metadata': JSON.stringify(step.metadata) }),
  }

  span.addEvent(step.name, attrs)
}

/**
 * Convert CascadeContext steps to span events
 */
export function cascadeStepsToSpanEvents(span: Span, ctx: CascadeContext): void {
  for (const step of ctx.steps) {
    recordStepAsSpanEvent(span, step)
  }
}

// ============================================================================
// Event Handler Instrumentation
// ============================================================================

/**
 * Record an event handler invocation
 */
export function recordEventHandler(params: {
  event: string
  durationMs: number
  success: boolean
}): void {
  const metrics = getWorkflowMetrics()
  const labels = {
    event: params.event,
    status: params.success ? 'success' : 'error',
  }

  metrics.eventHandlers.add(1, labels)
  metrics.stepDuration.record(params.durationMs, { ...labels, type: 'event' })
  metrics.stepTotal.add(1, { ...labels, type: 'event' })

  if (!params.success) {
    metrics.stepErrors.add(1, { ...labels, type: 'event' })
  }
}

/**
 * Record a schedule handler invocation
 */
export function recordScheduleHandler(params: {
  schedule: string
  durationMs: number
  success: boolean
}): void {
  const metrics = getWorkflowMetrics()
  const labels = {
    schedule: params.schedule,
    status: params.success ? 'success' : 'error',
  }

  metrics.scheduleHandlers.add(1, labels)
  metrics.stepDuration.record(params.durationMs, { ...labels, type: 'schedule' })
  metrics.stepTotal.add(1, { ...labels, type: 'schedule' })

  if (!params.success) {
    metrics.stepErrors.add(1, { ...labels, type: 'schedule' })
  }
}

/**
 * Create a traced event handler
 */
export function tracedEventHandler<TData, TResult>(
  event: string,
  handler: (data: TData, ctx: any) => Promise<TResult>
): (data: TData, ctx: any) => Promise<TResult> {
  return async (data: TData, ctx: any): Promise<TResult> => {
    const tracer = getWorkflowTracer()
    const logger = getWorkflowLogger()
    const startTime = Date.now()

    return tracer.withSpan(
      `workflow.event.${event}`,
      {
        kind: 'consumer',
        attributes: {
          [SemanticAttributes.WORKFLOW_NAME]: event,
          'workflow.event': event,
        },
      },
      async (span) => {
        logger.info(`Event handler ${event} started`)

        try {
          const result = await handler(data, ctx)
          const durationMs = Date.now() - startTime

          recordEventHandler({
            event,
            durationMs,
            success: true,
          })

          span.setStatus('ok')
          logger.info(`Event handler ${event} completed`, { durationMs })

          return result
        } catch (error) {
          const durationMs = Date.now() - startTime
          const message = error instanceof Error ? error.message : String(error)

          recordEventHandler({
            event,
            durationMs,
            success: false,
          })

          span.setStatus('error', message)
          logger.error(
            `Event handler ${event} failed`,
            error instanceof Error ? error : undefined,
            { durationMs }
          )

          throw error
        }
      }
    ) as Promise<TResult>
  }
}

/**
 * Create a traced schedule handler
 */
export function tracedScheduleHandler<TResult>(
  schedule: string,
  handler: (ctx: any) => Promise<TResult>
): (ctx: any) => Promise<TResult> {
  return async (ctx: any): Promise<TResult> => {
    const tracer = getWorkflowTracer()
    const logger = getWorkflowLogger()
    const startTime = Date.now()

    return tracer.withSpan(
      `workflow.schedule.${schedule}`,
      {
        kind: 'internal',
        attributes: {
          [SemanticAttributes.WORKFLOW_NAME]: schedule,
          'workflow.schedule': schedule,
        },
      },
      async (span) => {
        logger.info(`Schedule handler ${schedule} started`)

        try {
          const result = await handler(ctx)
          const durationMs = Date.now() - startTime

          recordScheduleHandler({
            schedule,
            durationMs,
            success: true,
          })

          span.setStatus('ok')
          logger.info(`Schedule handler ${schedule} completed`, { durationMs })

          return result
        } catch (error) {
          const durationMs = Date.now() - startTime
          const message = error instanceof Error ? error.message : String(error)

          recordScheduleHandler({
            schedule,
            durationMs,
            success: false,
          })

          span.setStatus('error', message)
          logger.error(
            `Schedule handler ${schedule} failed`,
            error instanceof Error ? error : undefined,
            { durationMs }
          )

          throw error
        }
      }
    ) as Promise<TResult>
  }
}

// ============================================================================
// Workflow Step Instrumentation
// ============================================================================

/**
 * Record a workflow step
 */
export function recordWorkflowStep(params: {
  step: string
  workflow?: string | undefined
  durationMs: number
  success: boolean
  tier?: string | undefined
}): void {
  const metrics = getWorkflowMetrics()
  const labels = {
    step: params.step,
    workflow: params.workflow || 'default',
    status: params.success ? 'success' : 'error',
    ...(params.tier && { tier: params.tier }),
  }

  metrics.stepTotal.add(1, labels)
  metrics.stepDuration.record(params.durationMs, labels)

  if (!params.success) {
    metrics.stepErrors.add(1, labels)
  }
}

/**
 * Create a traced workflow step
 */
export function tracedStep<TArgs extends unknown[], TResult>(
  stepName: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    workflowName?: string
    tier?: string
  } = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const tracer = getWorkflowTracer()
    const logger = getWorkflowLogger()
    const startTime = Date.now()

    const attributes: SpanAttributes = {
      [SemanticAttributes.WORKFLOW_STEP]: stepName,
      ...(options.workflowName && { [SemanticAttributes.WORKFLOW_NAME]: options.workflowName }),
      ...(options.tier && { [SemanticAttributes.AI_TIER]: options.tier }),
    }

    return tracer.withSpan(
      `workflow.step.${stepName}`,
      { kind: 'internal', attributes },
      async (span) => {
        logger.debug(`Step ${stepName} started`, {
          workflow: options.workflowName,
          tier: options.tier,
        })

        try {
          const result = await fn(...args)
          const durationMs = Date.now() - startTime

          recordWorkflowStep({
            step: stepName,
            workflow: options.workflowName,
            durationMs,
            success: true,
            tier: options.tier,
          })

          span.setStatus('ok')
          return result
        } catch (error) {
          const durationMs = Date.now() - startTime
          const message = error instanceof Error ? error.message : String(error)

          recordWorkflowStep({
            step: stepName,
            workflow: options.workflowName,
            durationMs,
            success: false,
            tier: options.tier,
          })

          span.setStatus('error', message)
          throw error
        }
      }
    ) as Promise<TResult>
  }
}

// ============================================================================
// Span Helpers
// ============================================================================

/**
 * Start a span for a workflow operation
 */
export function startWorkflowSpan(name: string, attributes?: SpanAttributes): Span {
  const tracer = getWorkflowTracer()
  return tracer.startSpan(name, {
    kind: 'internal',
    attributes: {
      [SemanticAttributes.SERVICE_NAME]: PACKAGE_NAME,
      ...attributes,
    },
  })
}

/**
 * Execute code within a workflow span
 */
export async function withWorkflowSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: SpanAttributes
): Promise<T> {
  const tracer = getWorkflowTracer()
  return tracer.withSpan(name, { kind: 'internal', attributes }, fn) as Promise<T>
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
  type TraceContext,
  type Counter,
  type Histogram,

  // Global functions
  getTracer,
  getMeter,
  getLogger,
  setTelemetryProvider,
  getTelemetryProvider,

  // W3C Trace Context
  createTraceparent,
  parseTraceparent,
  generateTraceId,
  generateSpanId,

  // Constants
  SemanticAttributes,
  MetricNames,

  // Utilities
  createHandlerMetrics,
} from '@org.ai/types'
