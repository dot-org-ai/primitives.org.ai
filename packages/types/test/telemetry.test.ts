/**
 * Tests for OpenTelemetry integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parseTraceparent,
  createTraceparent,
  generateTraceId,
  generateSpanId,
  noopTracer,
  noopMeter,
  noopLogger,
  noopTelemetryProvider,
  createConsoleTracer,
  createConsoleMeter,
  createConsoleLogger,
  createConsoleTelemetryProvider,
  setTelemetryProvider,
  getTelemetryProvider,
  getTracer,
  getMeter,
  getLogger,
  SemanticAttributes,
  MetricNames,
  createAIMetrics,
  createHandlerMetrics,
  instrument,
} from '../src/telemetry.js'

describe('W3C Trace Context', () => {
  describe('parseTraceparent', () => {
    it('should parse a valid traceparent', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
      const result = parseTraceparent(traceparent)

      expect(result).not.toBeNull()
      expect(result?.version).toBe('00')
      expect(result?.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
      expect(result?.spanId).toBe('b7ad6b7169203331')
      expect(result?.flags).toBe('01')
      expect(result?.sampled).toBe(true)
    })

    it('should return null for invalid traceparent', () => {
      expect(parseTraceparent('invalid')).toBeNull()
      expect(parseTraceparent('00-short-span-01')).toBeNull()
      expect(parseTraceparent('')).toBeNull()
    })

    it('should detect unsampled traces', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00'
      const result = parseTraceparent(traceparent)

      expect(result?.sampled).toBe(false)
    })
  })

  describe('createTraceparent', () => {
    it('should create a valid traceparent', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'

      const traceparent = createTraceparent(traceId, spanId)
      expect(traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
    })

    it('should handle unsampled flag', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c'
      const spanId = 'b7ad6b7169203331'

      const traceparent = createTraceparent(traceId, spanId, false)
      expect(traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00')
    })
  })

  describe('generateTraceId', () => {
    it('should generate a 32-character hex string', () => {
      const traceId = generateTraceId()
      expect(traceId).toMatch(/^[0-9a-f]{32}$/)
    })

    it('should generate unique IDs', () => {
      const id1 = generateTraceId()
      const id2 = generateTraceId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateSpanId', () => {
    it('should generate a 16-character hex string', () => {
      const spanId = generateSpanId()
      expect(spanId).toMatch(/^[0-9a-f]{16}$/)
    })
  })
})

describe('No-op Implementations', () => {
  describe('noopTracer', () => {
    it('should create spans that do nothing', () => {
      const span = noopTracer.startSpan('test')
      expect(span.name).toBe('test')
      expect(span.kind).toBe('internal')

      // These should not throw
      span.setAttribute('key', 'value')
      span.setAttributes({ foo: 'bar' })
      span.addEvent('event')
      span.setStatus('ok')
      span.end()
    })

    it('should handle withSpan', async () => {
      const result = await noopTracer.withSpan('test', undefined, async (span) => {
        expect(span).toBeDefined()
        return 'success'
      })
      expect(result).toBe('success')
    })

    it('should return trace context from spans', () => {
      const span = noopTracer.startSpan('test')
      const ctx = span.getTraceContext()

      expect(ctx.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    })
  })

  describe('noopMeter', () => {
    it('should create counters that do nothing', () => {
      const counter = noopMeter.createCounter('test')
      // Should not throw
      counter.add(1)
      counter.add(5, { label: 'value' })
    })

    it('should create histograms that do nothing', () => {
      const histogram = noopMeter.createHistogram('test')
      histogram.record(100)
      histogram.record(200, { label: 'value' })
    })

    it('should create gauges that do nothing', () => {
      const gauge = noopMeter.createGauge('test')
      gauge.set(42)
      gauge.set(100, { label: 'value' })
    })
  })

  describe('noopLogger', () => {
    it('should have all log methods that do nothing', () => {
      // Should not throw
      noopLogger.trace('message')
      noopLogger.debug('message')
      noopLogger.info('message')
      noopLogger.warn('message')
      noopLogger.error('message', new Error('test'))
      noopLogger.fatal('message', new Error('test'))
    })

    it('should return itself for child logger', () => {
      const child = noopLogger.child({ key: 'value' })
      expect(child).toBe(noopLogger)
    })
  })

  describe('noopTelemetryProvider', () => {
    it('should return noop implementations', () => {
      expect(noopTelemetryProvider.getTracer('test')).toBe(noopTracer)
      expect(noopTelemetryProvider.getMeter('test')).toBe(noopMeter)
      expect(noopTelemetryProvider.getLogger('test')).toBe(noopLogger)
    })

    it('should shutdown without error', async () => {
      await expect(noopTelemetryProvider.shutdown()).resolves.toBeUndefined()
    })
  })
})

describe('Console Implementations', () => {
  describe('createConsoleTracer', () => {
    it('should create spans with console output', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      const tracer = createConsoleTracer('test-tracer')
      const result = await tracer.withSpan('test-span', undefined, async (span) => {
        span.setAttribute('key', 'value')
        span.addEvent('test-event')
        return 'success'
      })

      expect(result).toBe('success')
      expect(consoleLog).toHaveBeenCalled()

      consoleLog.mockRestore()
    })

    it('should propagate parent context', () => {
      const tracer = createConsoleTracer('test')
      const parentSpan = tracer.startSpan('parent')
      const childSpan = tracer.startSpan('child', {
        parent: parentSpan.getTraceContext(),
      })

      expect(childSpan.traceId).toBe(parentSpan.traceId)
      expect(childSpan.parentSpanId).toBe(parentSpan.spanId)
    })
  })

  describe('createConsoleMeter', () => {
    it('should log metric operations', () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      const meter = createConsoleMeter('test-meter')
      const counter = meter.createCounter('test.counter', 'A test counter')
      counter.add(5, { service: 'test' })

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[COUNTER]'),
        expect.objectContaining({ value: 5 })
      )

      consoleLog.mockRestore()
    })
  })

  describe('createConsoleLogger', () => {
    it('should log with appropriate levels', () => {
      const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const logger = createConsoleLogger('test-logger')
      logger.info('info message', { key: 'value' })
      logger.error('error message', new Error('test'))

      expect(consoleInfo).toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()

      consoleInfo.mockRestore()
      consoleError.mockRestore()
    })

    it('should create child loggers with inherited context', () => {
      const logger = createConsoleLogger('parent')
      const child = logger.child({ requestId: '123' })

      expect(child).not.toBe(logger)
      expect(child.name).toBe('parent')
    })
  })

  describe('createConsoleTelemetryProvider', () => {
    it('should provide console-based implementations', () => {
      const provider = createConsoleTelemetryProvider()

      const tracer = provider.getTracer('test')
      const meter = provider.getMeter('test')
      const logger = provider.getLogger('test')

      expect(tracer.name).toBe('test')
      expect(meter.name).toBe('test')
      expect(logger.name).toBe('test')
    })

    it('should cache instances', () => {
      const provider = createConsoleTelemetryProvider()

      const tracer1 = provider.getTracer('test')
      const tracer2 = provider.getTracer('test')

      expect(tracer1).toBe(tracer2)
    })
  })
})

describe('Global Telemetry Configuration', () => {
  beforeEach(() => {
    setTelemetryProvider(noopTelemetryProvider)
  })

  it('should use noop provider by default', () => {
    const provider = getTelemetryProvider()
    expect(provider).toBe(noopTelemetryProvider)
  })

  it('should allow setting a custom provider', () => {
    const customProvider = createConsoleTelemetryProvider()
    setTelemetryProvider(customProvider)

    expect(getTelemetryProvider()).toBe(customProvider)
  })

  it('should get tracer from global provider', () => {
    const tracer = getTracer('test')
    expect(tracer).toBe(noopTracer)
  })

  it('should get meter from global provider', () => {
    const meter = getMeter('test')
    expect(meter).toBe(noopMeter)
  })

  it('should get logger from global provider', () => {
    const logger = getLogger('test')
    expect(logger).toBe(noopLogger)
  })
})

describe('Semantic Attributes', () => {
  it('should have AI-specific attributes', () => {
    expect(SemanticAttributes.AI_MODEL).toBe('ai.model')
    expect(SemanticAttributes.AI_PROVIDER).toBe('ai.provider')
    expect(SemanticAttributes.AI_INPUT_TOKENS).toBe('ai.input_tokens')
    expect(SemanticAttributes.AI_OUTPUT_TOKENS).toBe('ai.output_tokens')
    expect(SemanticAttributes.AI_COST_USD).toBe('ai.cost_usd')
  })

  it('should have database attributes', () => {
    expect(SemanticAttributes.DB_SYSTEM).toBe('db.system')
    expect(SemanticAttributes.DB_OPERATION).toBe('db.operation')
  })

  it('should have workflow attributes', () => {
    expect(SemanticAttributes.WORKFLOW_NAME).toBe('workflow.name')
    expect(SemanticAttributes.WORKFLOW_STEP).toBe('workflow.step')
  })
})

describe('Metric Names', () => {
  it('should have AI metric names', () => {
    expect(MetricNames.AI_REQUEST_DURATION).toBe('ai.request.duration')
    expect(MetricNames.AI_REQUEST_TOTAL).toBe('ai.request.total')
    expect(MetricNames.AI_TOKENS_USED).toBe('ai.tokens.used')
  })

  it('should have handler metric names', () => {
    expect(MetricNames.HANDLER_DURATION).toBe('handler.duration')
    expect(MetricNames.HANDLER_TOTAL).toBe('handler.total')
    expect(MetricNames.HANDLER_ERRORS).toBe('handler.errors')
  })
})

describe('createAIMetrics', () => {
  it('should create all AI metrics', () => {
    const metrics = createAIMetrics(noopMeter)

    expect(metrics.requestDuration).toBeDefined()
    expect(metrics.requestTotal).toBeDefined()
    expect(metrics.requestErrors).toBeDefined()
    expect(metrics.tokensUsed).toBeDefined()
    expect(metrics.costTotal).toBeDefined()
  })
})

describe('createHandlerMetrics', () => {
  it('should create handler metrics', () => {
    const metrics = createHandlerMetrics(noopMeter)

    expect(metrics.duration).toBeDefined()
    expect(metrics.total).toBeDefined()
    expect(metrics.errors).toBeDefined()
  })
})

describe('instrument', () => {
  it('should wrap a function with tracing', async () => {
    const fn = vi.fn().mockResolvedValue('result')
    const instrumented = instrument('test.fn', fn)

    const result = await instrumented('arg1', 'arg2')

    expect(result).toBe('result')
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should propagate errors', async () => {
    const error = new Error('test error')
    const fn = vi.fn().mockRejectedValue(error)
    const instrumented = instrument('test.fn', fn)

    await expect(instrumented()).rejects.toThrow('test error')
  })
})
