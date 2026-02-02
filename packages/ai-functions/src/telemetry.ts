/**
 * OpenTelemetry Integration for ai-functions
 *
 * Provides instrumented wrappers and telemetry utilities for AI function calls.
 *
 * @example
 * ```ts
 * import { withTelemetry, instrumentGenerate } from 'ai-functions/telemetry'
 *
 * // Enable telemetry globally
 * withTelemetry({ provider: createConsoleTelemetryProvider() }, async () => {
 *   const text = await generate('Explain quantum computing')
 * })
 *
 * // Or instrument individual functions
 * const traced = instrumentGenerate(generate)
 * const text = await traced('Explain quantum computing')
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
  createAIMetrics,
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
const PACKAGE_NAME = 'ai-functions'
const PACKAGE_VERSION = '2.1.4'

// ============================================================================
// Package-level Telemetry
// ============================================================================

let packageTracer: Tracer | undefined
let packageMeter: Meter | undefined
let packageLogger: Logger | undefined
let aiMetrics: ReturnType<typeof createAIMetrics> | undefined

/**
 * Get the tracer for ai-functions
 */
export function getFunctionsTracer(): Tracer {
  if (!packageTracer) {
    packageTracer = getTracer(PACKAGE_NAME, PACKAGE_VERSION)
  }
  return packageTracer
}

/**
 * Get the meter for ai-functions
 */
export function getFunctionsMeter(): Meter {
  if (!packageMeter) {
    packageMeter = getMeter(PACKAGE_NAME, PACKAGE_VERSION)
  }
  return packageMeter
}

/**
 * Get the logger for ai-functions
 */
export function getFunctionsLogger(): Logger {
  if (!packageLogger) {
    packageLogger = getLogger(PACKAGE_NAME)
  }
  return packageLogger
}

/**
 * Get AI metrics for the package
 */
export function getAIMetrics() {
  if (!aiMetrics) {
    aiMetrics = createAIMetrics(getFunctionsMeter())
  }
  return aiMetrics
}

/**
 * Reset cached telemetry instances (useful after changing provider)
 */
export function resetTelemetry(): void {
  packageTracer = undefined
  packageMeter = undefined
  packageLogger = undefined
  aiMetrics = undefined
}

// ============================================================================
// Telemetry Context
// ============================================================================

/**
 * Options for withTelemetry
 */
export interface WithTelemetryOptions {
  /** Telemetry provider to use */
  provider?: TelemetryProvider
  /** Service name for telemetry */
  serviceName?: string
  /** Service version */
  serviceVersion?: string
}

/**
 * Execute a function with telemetry enabled
 *
 * @example
 * ```ts
 * import { createConsoleTelemetryProvider } from '@org.ai/types'
 *
 * await withTelemetry({
 *   provider: createConsoleTelemetryProvider()
 * }, async () => {
 *   const text = await generate('Hello')
 * })
 * ```
 */
export async function withTelemetry<T>(
  options: WithTelemetryOptions,
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
// Instrumentation Wrappers
// ============================================================================

/**
 * Record AI request metrics
 */
export function recordAIRequest(params: {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  success: boolean
  costUsd?: number | undefined
}): void {
  const metrics = getAIMetrics()
  const labels = {
    model: params.model,
    provider: params.provider,
    status: params.success ? 'success' : 'error',
  }

  metrics.requestTotal.add(1, labels)
  metrics.requestDuration.record(params.durationMs, labels)
  metrics.tokensUsed.add(params.inputTokens + params.outputTokens, {
    ...labels,
    type: 'total',
  })

  if (!params.success) {
    metrics.requestErrors.add(1, labels)
  }

  if (params.costUsd !== undefined) {
    metrics.costTotal.add(params.costUsd, labels)
  }
}

/**
 * Create a traced version of any async function
 */
export function traced<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    kind?: 'internal' | 'client' | 'server'
    getAttributes?: (...args: TArgs) => SpanAttributes
  } = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const tracer = getFunctionsTracer()
    const logger = getFunctionsLogger()

    const attributes: SpanAttributes = {
      [SemanticAttributes.AI_FUNCTION_NAME]: name,
      ...(options.getAttributes ? options.getAttributes(...args) : {}),
    }

    return tracer.withSpan(name, { kind: options.kind || 'internal', attributes }, async (span) => {
      logger.debug(`Executing ${name}`, { attributes })

      try {
        const result = await fn(...args)
        span.setStatus('ok')
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        span.setStatus('error', message)
        span.setAttribute(SemanticAttributes.EXCEPTION_MESSAGE, message)
        if (error instanceof Error && error.stack) {
          span.setAttribute(SemanticAttributes.EXCEPTION_STACKTRACE, error.stack)
        }
        logger.error(`Error in ${name}`, error instanceof Error ? error : undefined, {
          attributes,
        })
        throw error
      }
    }) as Promise<TResult>
  }
}

/**
 * Create instrumented generate function
 *
 * @example
 * ```ts
 * import { generate } from 'ai-functions'
 * import { instrumentGenerate } from 'ai-functions/telemetry'
 *
 * const tracedGenerate = instrumentGenerate(generate)
 * const result = await tracedGenerate('text', 'Hello world')
 * ```
 */
export function instrumentGenerate<T extends (...args: any[]) => Promise<any>>(generateFn: T): T {
  return traced('ai.generate', generateFn as any, {
    kind: 'client',
    getAttributes: (type?: string) => ({
      [SemanticAttributes.AI_FUNCTION_TYPE]: type || 'text',
    }),
  }) as T
}

/**
 * Create instrumented AI function with full metrics
 */
export function instrumentAIFunction<TInput, TOutput>(
  name: string,
  fn: (input: TInput) => Promise<TOutput>,
  options: {
    model?: string
    provider?: string
    getTokens?: (input: TInput, output: TOutput) => { input: number; output: number }
    getCost?: (input: TInput, output: TOutput) => number
  } = {}
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const tracer = getFunctionsTracer()
    const logger = getFunctionsLogger()
    const startTime = Date.now()

    const attributes: SpanAttributes = {
      [SemanticAttributes.AI_FUNCTION_NAME]: name,
      ...(options.model && { [SemanticAttributes.AI_MODEL]: options.model }),
      ...(options.provider && { [SemanticAttributes.AI_PROVIDER]: options.provider }),
    }

    return tracer.withSpan(`ai.function.${name}`, { kind: 'client', attributes }, async (span) => {
      logger.info(`AI function ${name} started`, { model: options.model })

      try {
        const output = await fn(input)
        const durationMs = Date.now() - startTime

        // Record metrics
        const tokens = options.getTokens?.(input, output)
        const cost = options.getCost?.(input, output)

        if (tokens) {
          span.setAttribute(SemanticAttributes.AI_INPUT_TOKENS, tokens.input)
          span.setAttribute(SemanticAttributes.AI_OUTPUT_TOKENS, tokens.output)
          span.setAttribute(SemanticAttributes.AI_TOTAL_TOKENS, tokens.input + tokens.output)
        }

        if (cost !== undefined) {
          span.setAttribute(SemanticAttributes.AI_COST_USD, cost)
        }

        recordAIRequest({
          model: options.model || 'unknown',
          provider: options.provider || 'unknown',
          inputTokens: tokens?.input || 0,
          outputTokens: tokens?.output || 0,
          durationMs,
          success: true,
          costUsd: cost,
        })

        span.setStatus('ok')
        logger.info(`AI function ${name} completed`, {
          durationMs,
          tokens: tokens?.input !== undefined ? tokens.input + (tokens.output || 0) : undefined,
        })

        return output
      } catch (error) {
        const durationMs = Date.now() - startTime
        const message = error instanceof Error ? error.message : String(error)

        recordAIRequest({
          model: options.model || 'unknown',
          provider: options.provider || 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          durationMs,
          success: false,
        })

        span.setStatus('error', message)
        logger.error(`AI function ${name} failed`, error instanceof Error ? error : undefined, {
          durationMs,
        })

        throw error
      }
    }) as Promise<TOutput>
  }
}

// ============================================================================
// Span Helpers
// ============================================================================

/**
 * Start a span for an AI operation
 */
export function startAISpan(name: string, attributes?: SpanAttributes): Span {
  const tracer = getFunctionsTracer()
  return tracer.startSpan(name, {
    kind: 'client',
    attributes: {
      [SemanticAttributes.SERVICE_NAME]: PACKAGE_NAME,
      ...attributes,
    },
  })
}

/**
 * Execute code within a span
 */
export async function withAISpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: SpanAttributes
): Promise<T> {
  const tracer = getFunctionsTracer()
  return tracer.withSpan(name, { kind: 'client', attributes }, fn) as Promise<T>
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
  createAIMetrics,
} from '@org.ai/types'
