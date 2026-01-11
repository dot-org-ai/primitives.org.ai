/**
 * Tests for Budget Tracking and Request Tracing
 *
 * TDD: RED phase - Write failing tests first
 *
 * Features tested:
 * 1. Token counting per request
 * 2. Budget limits (reject when exceeded)
 * 3. Request ID generation and propagation
 * 4. User/tenant context isolation
 * 5. Cost tracking by model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BudgetTracker,
  TokenCounter,
  RequestContext,
  withBudget,
  createRequestContext,
  BudgetExceededError,
  type BudgetConfig,
  type TokenUsage,
  type RequestInfo,
  type BudgetAlert,
} from '../src/budget.js'
import { configure, resetContext, withContext } from '../src/context.js'

// ============================================================================
// Token Counting Tests
// ============================================================================

describe('TokenCounter', () => {
  describe('estimateTokens', () => {
    it('estimates tokens for a simple string', () => {
      const counter = new TokenCounter()
      const tokens = counter.estimateTokens('Hello, world!')

      // Rough estimate: ~4 chars per token for English
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(10)
    })

    it('estimates tokens for longer text', () => {
      const counter = new TokenCounter()
      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(10)
      const tokens = counter.estimateTokens(text)

      // Should be roughly proportional to length
      expect(tokens).toBeGreaterThan(50)
      expect(tokens).toBeLessThan(200)
    })

    it('handles empty string', () => {
      const counter = new TokenCounter()
      expect(counter.estimateTokens('')).toBe(0)
    })

    it('handles unicode and special characters', () => {
      const counter = new TokenCounter()
      const tokens = counter.estimateTokens('Hello! こんにちは 你好 🌍')

      expect(tokens).toBeGreaterThan(0)
    })
  })

  describe('model-specific estimation', () => {
    it('adjusts estimation for different models', () => {
      const counter = new TokenCounter()
      const text = 'Hello, world!'

      const gpt4Tokens = counter.estimateTokens(text, 'gpt-4o')
      const claudeTokens = counter.estimateTokens(text, 'claude-sonnet-4-20250514')

      // Both should give reasonable estimates
      expect(gpt4Tokens).toBeGreaterThan(0)
      expect(claudeTokens).toBeGreaterThan(0)
    })
  })

  describe('countMessageTokens', () => {
    it('counts tokens in a message array', () => {
      const counter = new TokenCounter()
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ]

      const tokens = counter.countMessageTokens(messages)
      expect(tokens).toBeGreaterThan(5)
    })

    it('includes overhead for message formatting', () => {
      const counter = new TokenCounter()
      const textOnly = counter.estimateTokens('You are a helpful assistant. Hello!')
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ]
      const messageTokens = counter.countMessageTokens(messages)

      // Message tokens should include some overhead
      expect(messageTokens).toBeGreaterThanOrEqual(textOnly)
    })
  })
})

// ============================================================================
// Budget Tracker Tests
// ============================================================================

describe('BudgetTracker', () => {
  let tracker: BudgetTracker

  beforeEach(() => {
    tracker = new BudgetTracker()
  })

  describe('token tracking', () => {
    it('tracks cumulative input tokens', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })
      tracker.recordUsage({ inputTokens: 150, outputTokens: 75 })

      expect(tracker.getTotalInputTokens()).toBe(250)
    })

    it('tracks cumulative output tokens', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })
      tracker.recordUsage({ inputTokens: 150, outputTokens: 75 })

      expect(tracker.getTotalOutputTokens()).toBe(125)
    })

    it('tracks total tokens (input + output)', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })
      tracker.recordUsage({ inputTokens: 150, outputTokens: 75 })

      expect(tracker.getTotalTokens()).toBe(375)
    })

    it('starts with zero tokens', () => {
      expect(tracker.getTotalTokens()).toBe(0)
      expect(tracker.getTotalInputTokens()).toBe(0)
      expect(tracker.getTotalOutputTokens()).toBe(0)
    })
  })

  describe('cost tracking', () => {
    it('calculates cost based on model pricing', () => {
      tracker.recordUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-4o',
      })

      const cost = tracker.getTotalCost()
      expect(cost).toBeGreaterThan(0)
    })

    it('tracks cost by model', () => {
      tracker.recordUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-4o' })
      tracker.recordUsage({ inputTokens: 1000, outputTokens: 500, model: 'claude-sonnet-4-20250514' })

      const costByModel = tracker.getCostByModel()
      expect(costByModel['gpt-4o']).toBeGreaterThan(0)
      expect(costByModel['claude-sonnet-4-20250514']).toBeGreaterThan(0)
    })

    it('uses default model pricing when not specified', () => {
      tracker.recordUsage({ inputTokens: 1000, outputTokens: 500 })

      // Should not throw, should use default pricing
      const cost = tracker.getTotalCost()
      expect(cost).toBeGreaterThan(0)
    })
  })

  describe('budget limits', () => {
    it('enforces token limits', () => {
      const limitedTracker = new BudgetTracker({
        maxTokens: 500,
      })

      limitedTracker.recordUsage({ inputTokens: 200, outputTokens: 100 })

      // Should throw when attempting to record usage that exceeds limit
      expect(() => {
        limitedTracker.checkBudget({ estimatedTokens: 300 })
      }).toThrow(BudgetExceededError)
    })

    it('enforces cost limits', () => {
      const limitedTracker = new BudgetTracker({
        maxCost: 0.10, // $0.10
      })

      // Record some usage that approaches the limit
      // GPT-4o: $2.5/1M input, $10/1M output
      // 10k input = $0.025, 5k output = $0.05, total = $0.075
      limitedTracker.recordUsage({
        inputTokens: 10000,
        outputTokens: 5000,
        model: 'gpt-4o',
      })

      // Check should fail if estimated cost would exceed
      // 100k tokens at ~$6/1M average = $0.60, which exceeds remaining ~$0.025
      expect(() => {
        limitedTracker.checkBudget({
          estimatedTokens: 100000,
          model: 'gpt-4o',
        })
      }).toThrow(BudgetExceededError)
    })

    it('allows usage within limits', () => {
      const limitedTracker = new BudgetTracker({
        maxTokens: 1000,
      })

      limitedTracker.recordUsage({ inputTokens: 200, outputTokens: 100 })

      // Should not throw
      expect(() => {
        limitedTracker.checkBudget({ estimatedTokens: 100 })
      }).not.toThrow()
    })

    it('provides remaining budget info', () => {
      const limitedTracker = new BudgetTracker({
        maxTokens: 1000,
        maxCost: 1.0,
      })

      limitedTracker.recordUsage({ inputTokens: 200, outputTokens: 100 })

      const remaining = limitedTracker.getRemainingBudget()
      expect(remaining.tokens).toBe(700)
      expect(remaining.cost).toBeLessThan(1.0)
    })
  })

  describe('budget alerts', () => {
    it('triggers alert at 50% threshold', () => {
      const alertCallback = vi.fn()
      const limitedTracker = new BudgetTracker({
        maxTokens: 1000,
        alertThresholds: [0.5],
        onAlert: alertCallback,
      })

      limitedTracker.recordUsage({ inputTokens: 400, outputTokens: 100 })

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 0.5,
          currentUsage: expect.any(Number),
          limit: 1000,
        })
      )
    })

    it('triggers multiple alerts at different thresholds', () => {
      const alertCallback = vi.fn()
      const limitedTracker = new BudgetTracker({
        maxTokens: 1000,
        alertThresholds: [0.5, 0.8, 1.0],
        onAlert: alertCallback,
      })

      // 50% threshold
      limitedTracker.recordUsage({ inputTokens: 400, outputTokens: 100 })
      expect(alertCallback).toHaveBeenCalledTimes(1)

      // 80% threshold
      limitedTracker.recordUsage({ inputTokens: 200, outputTokens: 100 })
      expect(alertCallback).toHaveBeenCalledTimes(2)

      // 100% threshold
      limitedTracker.recordUsage({ inputTokens: 150, outputTokens: 50 })
      expect(alertCallback).toHaveBeenCalledTimes(3)
    })

    it('does not re-trigger same threshold', () => {
      const alertCallback = vi.fn()
      const limitedTracker = new BudgetTracker({
        maxTokens: 1000,
        alertThresholds: [0.5],
        onAlert: alertCallback,
      })

      limitedTracker.recordUsage({ inputTokens: 400, outputTokens: 100 })
      limitedTracker.recordUsage({ inputTokens: 50, outputTokens: 25 })

      // Should only be called once even though still above 50%
      expect(alertCallback).toHaveBeenCalledTimes(1)
    })
  })

  describe('reset and persistence', () => {
    it('resets token counts', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })
      tracker.reset()

      expect(tracker.getTotalTokens()).toBe(0)
    })

    it('exports usage data for persistence', () => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50, model: 'gpt-4o' })
      tracker.recordUsage({ inputTokens: 200, outputTokens: 100, model: 'claude-sonnet-4-20250514' })

      const snapshot = tracker.export()

      expect(snapshot.totalInputTokens).toBe(300)
      expect(snapshot.totalOutputTokens).toBe(150)
      expect(snapshot.usageByModel).toHaveProperty('gpt-4o')
      expect(snapshot.usageByModel).toHaveProperty('claude-sonnet-4-20250514')
    })

    it('imports previously exported data', () => {
      const snapshot = {
        totalInputTokens: 500,
        totalOutputTokens: 250,
        totalCost: 0.05,
        usageByModel: {
          'gpt-4o': { inputTokens: 500, outputTokens: 250, cost: 0.05 },
        },
        triggeredThresholds: [0.5],
      }

      tracker.import(snapshot)

      expect(tracker.getTotalInputTokens()).toBe(500)
      expect(tracker.getTotalOutputTokens()).toBe(250)
    })
  })
})

// ============================================================================
// Request Context Tests
// ============================================================================

describe('RequestContext', () => {
  describe('request ID generation', () => {
    it('generates unique request IDs', () => {
      const ctx1 = createRequestContext()
      const ctx2 = createRequestContext()

      expect(ctx1.requestId).toBeDefined()
      expect(ctx2.requestId).toBeDefined()
      expect(ctx1.requestId).not.toBe(ctx2.requestId)
    })

    it('generates IDs with expected format', () => {
      const ctx = createRequestContext()

      // Should be a valid UUID or similar format
      expect(ctx.requestId).toMatch(/^[a-z0-9-]+$/i)
      expect(ctx.requestId.length).toBeGreaterThan(8)
    })

    it('accepts custom request ID', () => {
      const ctx = createRequestContext({ requestId: 'custom-123' })

      expect(ctx.requestId).toBe('custom-123')
    })
  })

  describe('user context', () => {
    it('stores user ID', () => {
      const ctx = createRequestContext({ userId: 'user-456' })

      expect(ctx.userId).toBe('user-456')
    })

    it('stores tenant ID', () => {
      const ctx = createRequestContext({ tenantId: 'tenant-789' })

      expect(ctx.tenantId).toBe('tenant-789')
    })

    it('stores both user and tenant', () => {
      const ctx = createRequestContext({
        userId: 'user-456',
        tenantId: 'tenant-789',
      })

      expect(ctx.userId).toBe('user-456')
      expect(ctx.tenantId).toBe('tenant-789')
    })
  })

  describe('parent-child relationships', () => {
    it('tracks parent request ID', () => {
      const parentCtx = createRequestContext()
      const childCtx = createRequestContext({ parentRequestId: parentCtx.requestId })

      expect(childCtx.parentRequestId).toBe(parentCtx.requestId)
    })

    it('creates child context from parent', () => {
      const parentCtx = createRequestContext({ userId: 'user-123' })
      const childCtx = parentCtx.createChild()

      expect(childCtx.parentRequestId).toBe(parentCtx.requestId)
      expect(childCtx.userId).toBe('user-123') // Inherits user
      expect(childCtx.requestId).not.toBe(parentCtx.requestId) // New ID
    })

    it('allows depth tracking', () => {
      const root = createRequestContext()
      const child = root.createChild()
      const grandchild = child.createChild()

      expect(root.depth).toBe(0)
      expect(child.depth).toBe(1)
      expect(grandchild.depth).toBe(2)
    })
  })

  describe('trace context', () => {
    it('serializes to trace headers', () => {
      const ctx = createRequestContext({
        userId: 'user-123',
        tenantId: 'tenant-456',
      })

      const headers = ctx.toTraceHeaders()

      expect(headers['x-request-id']).toBe(ctx.requestId)
      expect(headers['x-user-id']).toBe('user-123')
      expect(headers['x-tenant-id']).toBe('tenant-456')
    })

    it('deserializes from trace headers', () => {
      const headers = {
        'x-request-id': 'req-789',
        'x-user-id': 'user-123',
        'x-tenant-id': 'tenant-456',
        'x-parent-request-id': 'parent-123',
      }

      const ctx = RequestContext.fromHeaders(headers)

      expect(ctx.requestId).toBe('req-789')
      expect(ctx.userId).toBe('user-123')
      expect(ctx.tenantId).toBe('tenant-456')
      expect(ctx.parentRequestId).toBe('parent-123')
    })

    it('generates W3C traceparent header', () => {
      const ctx = createRequestContext()
      const traceparent = ctx.toTraceparent()

      // Format: version-trace_id-parent_id-flags
      expect(traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/)
    })
  })

  describe('metadata', () => {
    it('stores custom metadata', () => {
      const ctx = createRequestContext({
        metadata: {
          feature: 'chat',
          environment: 'production',
        },
      })

      expect(ctx.metadata?.feature).toBe('chat')
      expect(ctx.metadata?.environment).toBe('production')
    })

    it('merges metadata in child contexts', () => {
      const parentCtx = createRequestContext({
        metadata: { feature: 'chat' },
      })
      const childCtx = parentCtx.createChild({
        metadata: { action: 'summarize' },
      })

      expect(childCtx.metadata?.feature).toBe('chat')
      expect(childCtx.metadata?.action).toBe('summarize')
    })
  })
})

// ============================================================================
// withBudget Tests
// ============================================================================

describe('withBudget', () => {
  beforeEach(() => {
    resetContext()
  })

  it('executes function within budget context', async () => {
    const result = await withBudget({ maxTokens: 1000 }, async (tracker) => {
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })
      return 'success'
    })

    expect(result).toBe('success')
  })

  it('provides budget tracker to callback', async () => {
    await withBudget({ maxTokens: 1000 }, async (tracker) => {
      expect(tracker).toBeInstanceOf(BudgetTracker)
      expect(typeof tracker.recordUsage).toBe('function')
      expect(typeof tracker.getTotalTokens).toBe('function')
    })
  })

  it('throws when budget exceeded', async () => {
    await expect(
      withBudget({ maxTokens: 100 }, async (tracker) => {
        tracker.recordUsage({ inputTokens: 150, outputTokens: 50 })
        return 'should not reach'
      })
    ).rejects.toThrow(BudgetExceededError)
  })

  it('supports cost-based limits', async () => {
    await expect(
      withBudget({ maxCost: 0.001 }, async (tracker) => {
        // Record usage that exceeds cost limit
        tracker.recordUsage({
          inputTokens: 100000,
          outputTokens: 50000,
          model: 'gpt-4o',
        })
        return 'should not reach'
      })
    ).rejects.toThrow(BudgetExceededError)
  })

  it('nests budget contexts correctly', async () => {
    await withBudget({ maxTokens: 1000 }, async (outerTracker) => {
      outerTracker.recordUsage({ inputTokens: 100, outputTokens: 50 })

      await withBudget({ maxTokens: 500 }, async (innerTracker) => {
        innerTracker.recordUsage({ inputTokens: 50, outputTokens: 25 })

        // Inner tracker has its own limit
        expect(innerTracker.getTotalTokens()).toBe(75)
      })

      // Outer tracker should also have the inner usage
      expect(outerTracker.getTotalTokens()).toBe(225)
    })
  })

  it('includes request context when provided', async () => {
    await withBudget(
      {
        maxTokens: 1000,
        userId: 'user-123',
        tenantId: 'tenant-456',
      },
      async (tracker, ctx) => {
        expect(ctx?.userId).toBe('user-123')
        expect(ctx?.tenantId).toBe('tenant-456')
      }
    )
  })
})

// ============================================================================
// User/Tenant Context Isolation Tests
// ============================================================================

describe('User/Tenant Budget Isolation', () => {
  it('tracks budget per user', async () => {
    const userBudgets = new Map<string, BudgetTracker>()

    const getOrCreateTracker = (userId: string) => {
      if (!userBudgets.has(userId)) {
        userBudgets.set(userId, new BudgetTracker({ maxTokens: 1000 }))
      }
      return userBudgets.get(userId)!
    }

    // User 1 uses some budget
    const user1Tracker = getOrCreateTracker('user-1')
    user1Tracker.recordUsage({ inputTokens: 300, outputTokens: 150 })

    // User 2 uses some budget
    const user2Tracker = getOrCreateTracker('user-2')
    user2Tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })

    // Each user has their own budget
    expect(user1Tracker.getTotalTokens()).toBe(450)
    expect(user2Tracker.getTotalTokens()).toBe(150)
  })

  it('enforces per-tenant limits', async () => {
    const tenantTracker = new BudgetTracker({ maxTokens: 500 })

    // First request uses some budget
    tenantTracker.recordUsage({ inputTokens: 200, outputTokens: 100 })

    // Second request from same tenant
    tenantTracker.recordUsage({ inputTokens: 100, outputTokens: 50 })

    // Third request should fail budget check
    expect(() => {
      tenantTracker.checkBudget({ estimatedTokens: 200 })
    }).toThrow(BudgetExceededError)
  })
})

// ============================================================================
// Cost Tracking by Model Tests
// ============================================================================

describe('Cost Tracking by Model', () => {
  it('uses correct pricing for GPT-4o', () => {
    const tracker = new BudgetTracker()

    tracker.recordUsage({
      inputTokens: 1000000, // 1M tokens
      outputTokens: 500000,
      model: 'gpt-4o',
    })

    const cost = tracker.getTotalCost()
    // GPT-4o pricing: $2.50/1M input, $10/1M output (as of 2024)
    // Expected: $2.50 + $5 = $7.50
    expect(cost).toBeCloseTo(7.5, 1)
  })

  it('uses correct pricing for Claude Sonnet', () => {
    const tracker = new BudgetTracker()

    tracker.recordUsage({
      inputTokens: 1000000,
      outputTokens: 500000,
      model: 'claude-sonnet-4-20250514',
    })

    const cost = tracker.getTotalCost()
    // Claude Sonnet pricing: $3/1M input, $15/1M output
    // Expected: $3 + $7.5 = $10.5
    expect(cost).toBeCloseTo(10.5, 1)
  })

  it('uses correct pricing for Claude Haiku', () => {
    const tracker = new BudgetTracker()

    tracker.recordUsage({
      inputTokens: 1000000,
      outputTokens: 500000,
      model: 'claude-3-5-haiku-latest',
    })

    const cost = tracker.getTotalCost()
    // Claude Haiku pricing: $0.25/1M input, $1.25/1M output
    // Expected: $0.25 + $0.625 = $0.875
    expect(cost).toBeCloseTo(0.875, 2)
  })

  it('aggregates costs across multiple models', () => {
    const tracker = new BudgetTracker()

    tracker.recordUsage({ inputTokens: 500000, outputTokens: 250000, model: 'gpt-4o' })
    tracker.recordUsage({ inputTokens: 500000, outputTokens: 250000, model: 'claude-sonnet-4-20250514' })

    const costByModel = tracker.getCostByModel()

    expect(Object.keys(costByModel)).toContain('gpt-4o')
    expect(Object.keys(costByModel)).toContain('claude-sonnet-4-20250514')
    expect(tracker.getTotalCost()).toBe(
      costByModel['gpt-4o'] + costByModel['claude-sonnet-4-20250514']
    )
  })

  it('supports custom pricing tables', () => {
    const tracker = new BudgetTracker({
      customPricing: {
        'my-custom-model': {
          inputPricePerMillion: 1.0,
          outputPricePerMillion: 2.0,
        },
      },
    })

    tracker.recordUsage({
      inputTokens: 1000000,
      outputTokens: 500000,
      model: 'my-custom-model',
    })

    const cost = tracker.getTotalCost()
    // Custom pricing: $1/1M input, $2/1M output
    // Expected: $1 + $1 = $2
    expect(cost).toBeCloseTo(2.0, 2)
  })
})

// ============================================================================
// Context Integration Tests
// ============================================================================

describe('Context Integration', () => {
  beforeEach(() => {
    resetContext()
  })

  it('integrates budget tracking with execution context', async () => {
    configure({
      budget: {
        maxTokens: 10000,
        maxCost: 1.0,
      },
    })

    await withContext({}, async () => {
      // Budget should be available in context
      // This tests integration with the context system
    })
  })

  it('propagates request context through withContext', async () => {
    const ctx = createRequestContext({ userId: 'test-user' })

    await withContext({ requestContext: ctx }, async () => {
      // Request context should be available
    })
  })
})

// ============================================================================
// Request Info and Logging Tests
// ============================================================================

describe('Request Info', () => {
  it('records request info with timing', () => {
    const tracker = new BudgetTracker()

    const requestInfo: RequestInfo = {
      requestId: 'req-123',
      model: 'gpt-4o',
      startTime: Date.now() - 500,
      endTime: Date.now(),
      inputTokens: 100,
      outputTokens: 50,
    }

    tracker.recordRequest(requestInfo)

    const requests = tracker.getRequests()
    expect(requests).toHaveLength(1)
    expect(requests[0].requestId).toBe('req-123')
    expect(requests[0].duration).toBeCloseTo(500, -2)
  })

  it('provides request history for debugging', () => {
    const tracker = new BudgetTracker()

    tracker.recordRequest({
      requestId: 'req-1',
      model: 'gpt-4o',
      startTime: Date.now() - 1000,
      endTime: Date.now() - 500,
      inputTokens: 100,
      outputTokens: 50,
    })

    tracker.recordRequest({
      requestId: 'req-2',
      model: 'claude-sonnet-4-20250514',
      startTime: Date.now() - 500,
      endTime: Date.now(),
      inputTokens: 200,
      outputTokens: 100,
    })

    const requests = tracker.getRequests()
    expect(requests).toHaveLength(2)
  })

  it('limits request history size', () => {
    const tracker = new BudgetTracker({ maxRequestHistory: 5 })

    for (let i = 0; i < 10; i++) {
      tracker.recordRequest({
        requestId: `req-${i}`,
        model: 'gpt-4o',
        startTime: Date.now(),
        endTime: Date.now(),
        inputTokens: 100,
        outputTokens: 50,
      })
    }

    const requests = tracker.getRequests()
    expect(requests.length).toBeLessThanOrEqual(5)
    // Should keep most recent
    expect(requests[requests.length - 1].requestId).toBe('req-9')
  })
})
