import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCascadeContext,
  recordStep,
  withCascadeContext,
  type CascadeContext,
  type CascadeStep,
} from '../src/cascade-context.js'

describe('cascade-context', () => {
  describe('correlation ID generation and propagation', () => {
    it('should generate unique correlation ID on creation', () => {
      const ctx1 = createCascadeContext()
      const ctx2 = createCascadeContext()

      expect(ctx1.correlationId).toBeDefined()
      expect(ctx2.correlationId).toBeDefined()
      expect(ctx1.correlationId).not.toBe(ctx2.correlationId)
    })

    it('should accept a custom correlation ID', () => {
      const customId = 'custom-correlation-123'
      const ctx = createCascadeContext({ correlationId: customId })

      expect(ctx.correlationId).toBe(customId)
    })

    it('should generate UUID v4 format correlation IDs', () => {
      const ctx = createCascadeContext()
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      expect(ctx.correlationId).toMatch(uuidV4Regex)
    })

    it('should propagate correlation ID to child contexts', () => {
      const parent = createCascadeContext()
      const child = createCascadeContext({ parent })

      expect(child.correlationId).toBe(parent.correlationId)
      expect(child.parentId).toBe(parent.spanId)
    })

    it('should have unique span IDs for each context', () => {
      const parent = createCascadeContext()
      const child1 = createCascadeContext({ parent })
      const child2 = createCascadeContext({ parent })

      expect(parent.spanId).toBeDefined()
      expect(child1.spanId).toBeDefined()
      expect(child2.spanId).toBeDefined()
      expect(child1.spanId).not.toBe(parent.spanId)
      expect(child1.spanId).not.toBe(child2.spanId)
    })
  })

  describe('step timing metadata', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should record step start time', () => {
      const ctx = createCascadeContext()
      const now = Date.now()
      vi.setSystemTime(now)

      const step = recordStep(ctx, 'process-data')

      expect(step.startedAt).toBe(now)
      expect(step.name).toBe('process-data')
    })

    it('should record step completion time and duration', () => {
      const ctx = createCascadeContext()
      const startTime = Date.now()
      vi.setSystemTime(startTime)

      const step = recordStep(ctx, 'process-data')

      vi.advanceTimersByTime(150)
      step.complete()

      expect(step.completedAt).toBe(startTime + 150)
      expect(step.duration).toBe(150)
    })

    it('should record step failure with error', () => {
      const ctx = createCascadeContext()
      const step = recordStep(ctx, 'failing-step')
      const error = new Error('Step failed')

      step.fail(error)

      expect(step.status).toBe('failed')
      expect(step.error).toBe(error)
    })

    it('should track step status transitions', () => {
      const ctx = createCascadeContext()
      const step = recordStep(ctx, 'status-step')

      expect(step.status).toBe('running')

      step.complete()
      expect(step.status).toBe('completed')
    })

    it('should support step metadata', () => {
      const ctx = createCascadeContext()
      const step = recordStep(ctx, 'metadata-step', {
        tier: 'code',
        input: { query: 'test' },
      })

      expect(step.metadata).toEqual({
        tier: 'code',
        input: { query: 'test' },
      })
    })

    it('should allow adding metadata after creation', () => {
      const ctx = createCascadeContext()
      const step = recordStep(ctx, 'metadata-step')

      step.addMetadata({ result: 'success', tokens: 100 })

      expect(step.metadata).toEqual({
        result: 'success',
        tokens: 100,
      })
    })
  })

  describe('cascade path recording', () => {
    it('should record execution path', () => {
      const ctx = createCascadeContext()

      recordStep(ctx, 'step-1').complete()
      recordStep(ctx, 'step-2').complete()
      recordStep(ctx, 'step-3').complete()

      expect(ctx.path).toEqual(['step-1', 'step-2', 'step-3'])
    })

    it('should include all steps in context', () => {
      const ctx = createCascadeContext()

      const step1 = recordStep(ctx, 'code-tier')
      step1.complete()
      const step2 = recordStep(ctx, 'generative-tier')
      step2.complete()

      expect(ctx.steps).toHaveLength(2)
      expect(ctx.steps[0]?.name).toBe('code-tier')
      expect(ctx.steps[1]?.name).toBe('generative-tier')
    })

    it('should track nested paths in child contexts', () => {
      const parent = createCascadeContext()
      recordStep(parent, 'parent-step-1').complete()

      const child = createCascadeContext({ parent })
      recordStep(child, 'child-step-1').complete()
      recordStep(child, 'child-step-2').complete()

      expect(child.fullPath).toEqual([
        'parent-step-1',
        'child-step-1',
        'child-step-2',
      ])
    })

    it('should provide depth information', () => {
      const root = createCascadeContext()
      const child = createCascadeContext({ parent: root })
      const grandchild = createCascadeContext({ parent: child })

      expect(root.depth).toBe(0)
      expect(child.depth).toBe(1)
      expect(grandchild.depth).toBe(2)
    })
  })

  describe('context inheritance in nested operations', () => {
    it('should inherit correlation ID in nested withCascadeContext', async () => {
      let innerCorrelationId: string | undefined
      let outerCorrelationId: string | undefined

      await withCascadeContext(async (outer) => {
        outerCorrelationId = outer.correlationId

        await withCascadeContext(async (inner) => {
          innerCorrelationId = inner.correlationId
        }, { parent: outer })
      })

      expect(innerCorrelationId).toBe(outerCorrelationId)
    })

    it('should record steps from callback execution', async () => {
      const ctx = await withCascadeContext(async (ctx) => {
        recordStep(ctx, 'async-step-1').complete()
        recordStep(ctx, 'async-step-2').complete()
        return ctx
      })

      expect(ctx.steps).toHaveLength(2)
    })

    it('should handle errors and record failed steps', async () => {
      let caughtError: Error | undefined

      try {
        await withCascadeContext(async (ctx) => {
          const step = recordStep(ctx, 'failing-step')
          throw new Error('Intentional failure')
        })
      } catch (error) {
        caughtError = error as Error
      }

      expect(caughtError?.message).toBe('Intentional failure')
    })

    it('should support options for context creation', async () => {
      const ctx = await withCascadeContext(async (ctx) => ctx, {
        correlationId: 'custom-id',
        name: 'test-cascade',
      })

      expect(ctx.correlationId).toBe('custom-id')
      expect(ctx.name).toBe('test-cascade')
    })
  })

  describe('context serialization for distributed systems', () => {
    it('should serialize to JSON-compatible format', () => {
      const ctx = createCascadeContext({ name: 'test-cascade' })
      recordStep(ctx, 'step-1').complete()

      const serialized = ctx.serialize()

      expect(typeof serialized).toBe('object')
      expect(serialized.correlationId).toBe(ctx.correlationId)
      expect(serialized.spanId).toBe(ctx.spanId)
      expect(serialized.name).toBe('test-cascade')
      expect(serialized.steps).toHaveLength(1)
    })

    it('should serialize timing information', () => {
      vi.useFakeTimers()
      const startTime = Date.now()
      vi.setSystemTime(startTime)

      const ctx = createCascadeContext()
      const step = recordStep(ctx, 'timed-step')
      vi.advanceTimersByTime(100)
      step.complete()

      const serialized = ctx.serialize()

      expect(serialized.steps[0]?.startedAt).toBe(startTime)
      expect(serialized.steps[0]?.completedAt).toBe(startTime + 100)
      expect(serialized.steps[0]?.duration).toBe(100)

      vi.useRealTimers()
    })

    it('should deserialize from serialized format', () => {
      const original = createCascadeContext({ name: 'original' })
      recordStep(original, 'step-1').complete()

      const serialized = original.serialize()
      const restored = createCascadeContext({ fromSerialized: serialized })

      expect(restored.correlationId).toBe(original.correlationId)
      expect(restored.spanId).toBe(original.spanId)
      expect(restored.name).toBe('original')
      expect(restored.steps).toHaveLength(1)
    })

    it('should include parent reference in serialization', () => {
      const parent = createCascadeContext()
      const child = createCascadeContext({ parent })

      const serialized = child.serialize()

      expect(serialized.parentId).toBe(parent.spanId)
      expect(serialized.correlationId).toBe(parent.correlationId)
    })

    it('should support W3C trace context format for distributed tracing', () => {
      const ctx = createCascadeContext()

      const traceContext = ctx.toTraceContext()

      // W3C trace context format: version-traceid-parentid-flags
      expect(traceContext.traceparent).toMatch(
        /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/
      )
    })

    it('should create context from W3C trace context', () => {
      const original = createCascadeContext()
      const traceContext = original.toTraceContext()

      const restored = createCascadeContext({ fromTraceContext: traceContext })

      // Should have same trace ID but different span ID
      expect(restored.correlationId).toBe(original.correlationId)
      expect(restored.parentId).toBe(original.spanId)
    })
  })

  describe('5W+H event generation helpers', () => {
    it('should generate 5W+H event from step', () => {
      const ctx = createCascadeContext({ name: 'cascade-test' })
      const step = recordStep(ctx, 'process-request', {
        tier: 'code',
        actor: 'system',
        object: 'request',
        action: 'process',
        reason: 'User requested data processing',
      })
      step.complete()

      const event = step.to5WHEvent()

      expect(event.who).toBe('system')
      expect(event.what).toBe('process')
      expect(event.when).toBeDefined()
      expect(event.where).toBe('cascade-test')
      expect(event.why).toBe('User requested data processing')
      expect(event.how).toBeDefined()
    })

    it('should include timing in 5W+H event', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      const ctx = createCascadeContext()
      const step = recordStep(ctx, 'timed-step')
      vi.advanceTimersByTime(50)
      step.complete()

      const event = step.to5WHEvent()

      expect(event.when).toBe(now)
      expect(event.how).toMatchObject({
        duration: 50,
        status: 'completed',
      })

      vi.useRealTimers()
    })
  })

  describe('context visualization', () => {
    it('should format context as readable string', () => {
      const ctx = createCascadeContext({ name: 'test-workflow' })
      recordStep(ctx, 'step-1').complete()
      recordStep(ctx, 'step-2').complete()

      const formatted = ctx.format()

      expect(formatted).toContain('test-workflow')
      expect(formatted).toContain('step-1')
      expect(formatted).toContain('step-2')
    })

    it('should format as tree for nested contexts', () => {
      const parent = createCascadeContext({ name: 'parent' })
      recordStep(parent, 'parent-step').complete()

      const child = createCascadeContext({ parent, name: 'child' })
      recordStep(child, 'child-step').complete()

      const tree = child.formatTree()

      expect(tree).toContain('parent')
      expect(tree).toContain('child')
      expect(tree).toContain('parent-step')
      expect(tree).toContain('child-step')
    })
  })
})
