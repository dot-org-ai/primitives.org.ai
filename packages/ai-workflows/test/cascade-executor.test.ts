/**
 * TDD Tests for CascadeExecutor
 *
 * Follows the code -> generative -> agentic -> human escalation pattern.
 * Tests written first (RED phase) to define expected behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CascadeExecutor,
  type TierHandler,
  type CascadeConfig,
  type CascadeResult,
  type TierResult,
  CascadeTimeoutError,
  TierSkippedError,
} from '../src/cascade-executor.js'
import type { FiveWHEvent } from '../src/cascade-context.js'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock tier handler that succeeds
 */
function createSuccessHandler<T>(result: T, delay = 0): TierHandler<T> {
  return {
    name: 'test-handler',
    execute: vi.fn(async () => {
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay))
      }
      return result
    }),
  }
}

/**
 * Create a mock tier handler that fails
 */
function createFailureHandler(error: Error | string, delay = 0): TierHandler<never> {
  const err = typeof error === 'string' ? new Error(error) : error
  return {
    name: 'test-handler',
    execute: vi.fn(async () => {
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay))
      }
      throw err
    }),
  }
}

/**
 * Create a mock tier handler that tracks calls
 */
function createTrackingHandler<T>(
  result: T,
  tracker: { calls: number[] }
): TierHandler<T> {
  const startTime = Date.now()
  return {
    name: 'tracking-handler',
    execute: vi.fn(async () => {
      tracker.calls.push(Date.now() - startTime)
      return result
    }),
  }
}

// ============================================================================
// Tier Escalation Tests
// ============================================================================

describe('CascadeExecutor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('tier escalation', () => {
    it('should execute code tier first', async () => {
      const codeHandler = createSuccessHandler('code-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(codeHandler.execute).toHaveBeenCalledTimes(1)
      expect(result.value).toBe('code-result')
      expect(result.tier).toBe('code')
    })

    it('should escalate to generative tier when code tier fails', async () => {
      const codeHandler = createFailureHandler('Code tier failed')
      const generativeHandler = createSuccessHandler('generative-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(codeHandler.execute).toHaveBeenCalledTimes(1)
      expect(generativeHandler.execute).toHaveBeenCalledTimes(1)
      expect(result.value).toBe('generative-result')
      expect(result.tier).toBe('generative')
    })

    it('should escalate to agentic tier when generative tier fails', async () => {
      const codeHandler = createFailureHandler('Code tier failed')
      const generativeHandler = createFailureHandler('Generative tier failed')
      const agenticHandler = createSuccessHandler('agentic-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
          agentic: agenticHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(codeHandler.execute).toHaveBeenCalledTimes(1)
      expect(generativeHandler.execute).toHaveBeenCalledTimes(1)
      expect(agenticHandler.execute).toHaveBeenCalledTimes(1)
      expect(result.value).toBe('agentic-result')
      expect(result.tier).toBe('agentic')
    })

    it('should escalate to human tier as last resort', async () => {
      const codeHandler = createFailureHandler('Code tier failed')
      const generativeHandler = createFailureHandler('Generative tier failed')
      const agenticHandler = createFailureHandler('Agentic tier failed')
      const humanHandler = createSuccessHandler('human-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
          agentic: agenticHandler,
          human: humanHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(codeHandler.execute).toHaveBeenCalledTimes(1)
      expect(generativeHandler.execute).toHaveBeenCalledTimes(1)
      expect(agenticHandler.execute).toHaveBeenCalledTimes(1)
      expect(humanHandler.execute).toHaveBeenCalledTimes(1)
      expect(result.value).toBe('human-result')
      expect(result.tier).toBe('human')
    })

    it('should short-circuit on successful tier (not execute remaining tiers)', async () => {
      const codeHandler = createSuccessHandler('code-result')
      const generativeHandler = createSuccessHandler('generative-result')
      const agenticHandler = createSuccessHandler('agentic-result')
      const humanHandler = createSuccessHandler('human-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
          agentic: agenticHandler,
          human: humanHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(codeHandler.execute).toHaveBeenCalledTimes(1)
      expect(generativeHandler.execute).not.toHaveBeenCalled()
      expect(agenticHandler.execute).not.toHaveBeenCalled()
      expect(humanHandler.execute).not.toHaveBeenCalled()
      expect(result.value).toBe('code-result')
      expect(result.tier).toBe('code')
    })

    it('should throw when all tiers fail', async () => {
      const codeHandler = createFailureHandler('Code failed')
      const generativeHandler = createFailureHandler('Generative failed')
      const agenticHandler = createFailureHandler('Agentic failed')
      const humanHandler = createFailureHandler('Human failed')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
          agentic: agenticHandler,
          human: humanHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()

      await expect(resultPromise).rejects.toThrow('All cascade tiers failed')
    })

    it('should execute tiers in correct order: code -> generative -> agentic -> human', async () => {
      const executionOrder: string[] = []

      const createOrderTrackingHandler = (tier: string): TierHandler<never> => ({
        name: tier,
        execute: vi.fn(async () => {
          executionOrder.push(tier)
          throw new Error(`${tier} failed`)
        }),
      })

      const humanHandler: TierHandler<string> = {
        name: 'human',
        execute: vi.fn(async () => {
          executionOrder.push('human')
          return 'human-result'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: createOrderTrackingHandler('code'),
          generative: createOrderTrackingHandler('generative'),
          agentic: createOrderTrackingHandler('agentic'),
          human: humanHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      expect(executionOrder).toEqual(['code', 'generative', 'agentic', 'human'])
    })

    it('should skip unconfigured tiers gracefully', async () => {
      // Only configure code and human tiers
      const codeHandler = createFailureHandler('Code failed')
      const humanHandler = createSuccessHandler('human-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          human: humanHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.value).toBe('human-result')
      expect(result.tier).toBe('human')
      expect(result.skippedTiers).toContain('generative')
      expect(result.skippedTiers).toContain('agentic')
    })

    it('should record tier results in cascade history', async () => {
      const codeHandler = createFailureHandler('Code failed')
      const generativeHandler = createSuccessHandler('generative-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.history).toHaveLength(2)
      expect(result.history[0]).toMatchObject({
        tier: 'code',
        success: false,
      })
      expect(result.history[1]).toMatchObject({
        tier: 'generative',
        success: true,
      })
    })
  })

  // ============================================================================
  // Timeout Handling Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should support per-tier timeout configuration', async () => {
      const slowCodeHandler: TierHandler<string> = {
        name: 'slow-code',
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 10000)) // 10s
          return 'code-result'
        }),
      }
      const generativeHandler = createSuccessHandler('generative-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: slowCodeHandler,
          generative: generativeHandler,
        },
        timeouts: {
          code: 5000, // 5s timeout for code tier
        },
      })

      const resultPromise = executor.execute({ input: 'test' })

      // Advance past code tier timeout
      await vi.advanceTimersByTimeAsync(5001)

      const result = await resultPromise

      expect(result.tier).toBe('generative')
      expect(result.value).toBe('generative-result')
      expect(result.history[0]).toMatchObject({
        tier: 'code',
        success: false,
        timedOut: true,
      })
    })

    it('should trigger escalation when tier times out', async () => {
      const slowHandler: TierHandler<string> = {
        name: 'slow',
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 30000)) // 30s
          return 'slow-result'
        }),
      }
      const fastHandler = createSuccessHandler('fast-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: slowHandler,
          generative: fastHandler,
        },
        timeouts: {
          code: 1000,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.advanceTimersByTimeAsync(1001)
      const result = await resultPromise

      expect(result.tier).toBe('generative')
      expect(result.value).toBe('fast-result')
    })

    it('should support total cascade timeout', async () => {
      const slowHandler: TierHandler<string> = {
        name: 'slow',
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 5000))
          return 'result'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: slowHandler,
          generative: slowHandler,
          agentic: slowHandler,
          human: slowHandler,
        },
        totalTimeout: 3000, // Total cascade must complete in 3s
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.advanceTimersByTimeAsync(3001)

      await expect(resultPromise).rejects.toThrow(CascadeTimeoutError)
    })

    it('should handle timeout gracefully without data loss', async () => {
      const partialResults: string[] = []

      const codeHandler: TierHandler<string> = {
        name: 'code',
        execute: vi.fn(async () => {
          partialResults.push('code-started')
          await new Promise((r) => setTimeout(r, 2000))
          partialResults.push('code-completed')
          return 'code-result'
        }),
      }

      const generativeHandler: TierHandler<string> = {
        name: 'generative',
        execute: vi.fn(async () => {
          partialResults.push('generative-started')
          return 'generative-result'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
        },
        timeouts: {
          code: 1000,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })

      // Let code tier start
      await vi.advanceTimersByTimeAsync(100)
      expect(partialResults).toContain('code-started')

      // Timeout code tier
      await vi.advanceTimersByTimeAsync(1000)

      const result = await resultPromise

      // Generative should have completed
      expect(result.value).toBe('generative-result')
      expect(partialResults).toContain('generative-started')
    })

    it('should use default tier timeouts from capability-tiers', async () => {
      const slowCodeHandler: TierHandler<string> = {
        name: 'slow-code',
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 10000)) // 10s (code default is 5s)
          return 'code-result'
        }),
      }
      const generativeHandler = createSuccessHandler('generative-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: slowCodeHandler,
          generative: generativeHandler,
        },
        useDefaultTimeouts: true, // Use timeouts from capability-tiers
      })

      const resultPromise = executor.execute({ input: 'test' })

      // Code tier default timeout is 5000ms
      await vi.advanceTimersByTimeAsync(5001)

      const result = await resultPromise
      expect(result.tier).toBe('generative')
    })

    it('should include timeout duration in error details', async () => {
      const slowHandler: TierHandler<string> = {
        name: 'slow',
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 60000))
          return 'result'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: slowHandler,
        },
        totalTimeout: 5000,
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.advanceTimersByTimeAsync(5001)

      try {
        await resultPromise
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeTimeoutError)
        const timeoutError = error as CascadeTimeoutError
        expect(timeoutError.timeout).toBe(5000)
        expect(timeoutError.elapsed).toBeGreaterThanOrEqual(5000)
      }
    })
  })

  // ============================================================================
  // 5W+H Events Tests
  // ============================================================================

  describe('5W+H events', () => {
    it('should record Who (actor identification) in events', async () => {
      const codeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        actor: 'test-system',
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      expect(events.length).toBeGreaterThan(0)
      expect(events.every((e) => e.who === 'test-system')).toBe(true)
    })

    it('should record What (action description) in events', async () => {
      const codeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      const tierEvent = events.find((e) => e.what.includes('code'))
      expect(tierEvent).toBeDefined()
      expect(tierEvent?.what).toContain('execute')
    })

    it('should record When (timestamp) in events', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const codeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      expect(events.length).toBeGreaterThan(0)
      expect(events.every((e) => typeof e.when === 'number')).toBe(true)
      expect(events[0]?.when).toBe(now)
    })

    it('should record Where (context/location) in events', async () => {
      const codeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        cascadeName: 'test-cascade',
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      expect(events.length).toBeGreaterThan(0)
      expect(events.every((e) => e.where === 'test-cascade')).toBe(true)
    })

    it('should record Why (reason/justification) in events', async () => {
      const codeHandler = createFailureHandler('Validation failed')
      const generativeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
        },
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      // Find escalation event
      const escalationEvent = events.find((e) => e.what.includes('escalat'))
      expect(escalationEvent).toBeDefined()
      expect(escalationEvent?.why).toContain('Validation failed')
    })

    it('should record How (method/approach) in events', async () => {
      const codeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      const completionEvent = events.find((e) => e.how.status === 'completed')
      expect(completionEvent).toBeDefined()
      expect(completionEvent?.how).toMatchObject({
        status: 'completed',
      })
      expect(completionEvent?.how.duration).toBeGreaterThanOrEqual(0)
    })

    it('should emit start and complete events for each tier', async () => {
      const codeHandler = createFailureHandler('Failed')
      const generativeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
        },
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      // Should have start and end events for both tiers
      const codeStart = events.find(
        (e) => e.what.includes('code') && e.how.status === 'running'
      )
      const codeEnd = events.find(
        (e) => e.what.includes('code') && e.how.status === 'failed'
      )
      const genStart = events.find(
        (e) => e.what.includes('generative') && e.how.status === 'running'
      )
      const genEnd = events.find(
        (e) => e.what.includes('generative') && e.how.status === 'completed'
      )

      expect(codeStart).toBeDefined()
      expect(codeEnd).toBeDefined()
      expect(genStart).toBeDefined()
      expect(genEnd).toBeDefined()
    })

    it('should emit cascade-level start and complete events', async () => {
      const codeHandler = createSuccessHandler('result')
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        cascadeName: 'test-cascade',
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      const cascadeStart = events.find(
        (e) => e.what === 'cascade-start'
      )
      const cascadeComplete = events.find(
        (e) => e.what === 'cascade-complete'
      )

      expect(cascadeStart).toBeDefined()
      expect(cascadeComplete).toBeDefined()
    })

    it('should include input/output metadata in How', async () => {
      const codeHandler = createSuccessHandler({ processed: true })
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
        onEvent: (event) => events.push(event),
      })

      const resultPromise = executor.execute({ input: 'test-data' })
      await vi.runAllTimersAsync()
      await resultPromise

      const completionEvent = events.find((e) => e.how.status === 'completed')
      expect(completionEvent?.how.metadata).toBeDefined()
    })
  })

  // ============================================================================
  // Additional Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should integrate with CascadeContext for tracing', async () => {
      const codeHandler = createSuccessHandler('result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.context).toBeDefined()
      expect(result.context.correlationId).toBeDefined()
      expect(result.context.steps.length).toBeGreaterThan(0)
    })

    it('should pass context to tier handlers', async () => {
      let receivedContext: any

      const codeHandler: TierHandler<string> = {
        name: 'context-checker',
        execute: vi.fn(async (input, context) => {
          receivedContext = context
          return 'result'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.runAllTimersAsync()
      await resultPromise

      expect(receivedContext).toBeDefined()
      expect(receivedContext.correlationId).toBeDefined()
      expect(receivedContext.tier).toBe('code')
    })

    it('should support custom tier skip conditions', async () => {
      const codeHandler = createSuccessHandler('code-result')
      const generativeHandler = createSuccessHandler('generative-result')

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
          generative: generativeHandler,
        },
        skipConditions: {
          code: (input) => input.skipCode === true,
        },
      })

      const resultPromise = executor.execute({ input: 'test', skipCode: true })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(codeHandler.execute).not.toHaveBeenCalled()
      expect(result.tier).toBe('generative')
      expect(result.skippedTiers).toContain('code')
    })

    it('should support retry per tier using RetryPolicy', async () => {
      let attempts = 0
      const flakeyHandler: TierHandler<string> = {
        name: 'flakey',
        execute: vi.fn(async () => {
          attempts++
          if (attempts < 3) {
            throw new Error('Temporary failure')
          }
          return 'success'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: flakeyHandler,
        },
        retryConfig: {
          code: {
            maxRetries: 3,
            baseDelay: 100,
          },
        },
      })

      const resultPromise = executor.execute({ input: 'test' })

      // Process retries
      await vi.advanceTimersByTimeAsync(100) // First retry delay
      await vi.advanceTimersByTimeAsync(200) // Second retry delay (exponential)
      await vi.runAllTimersAsync()

      const result = await resultPromise

      expect(attempts).toBe(3)
      expect(result.value).toBe('success')
    })

    it('should provide execution metrics', async () => {
      const codeHandler: TierHandler<string> = {
        name: 'code',
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 100))
          return 'result'
        }),
      }

      const executor = new CascadeExecutor({
        tiers: {
          code: codeHandler,
        },
      })

      const resultPromise = executor.execute({ input: 'test' })
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.metrics).toBeDefined()
      expect(result.metrics.totalDuration).toBeGreaterThanOrEqual(100)
      expect(result.metrics.tierDurations.code).toBeGreaterThanOrEqual(100)
    })
  })
})
