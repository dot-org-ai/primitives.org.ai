/**
 * TDD: Tests for timeout/retry strategies with exponential backoff
 *
 * RED PHASE: These tests are written first and should initially fail
 * until the implementation is complete.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ExponentialBackoff,
  HumanRetryPolicy,
  HumanCircuitBreaker,
  SLATracker,
  withRetry,
  RetryError,
  CircuitOpenError,
  SLAViolationError,
  type BackoffConfig,
  type RetryConfig,
  type CircuitBreakerConfig,
  type SLAConfig,
} from '../src/timeout-retry.js'

describe('Timeout/Retry Strategies', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ExponentialBackoff', () => {
    describe('basic backoff calculation', () => {
      it('should calculate exponential backoff with default multiplier of 2', () => {
        const backoff = new ExponentialBackoff({ baseDelayMs: 1000 })

        expect(backoff.getDelay(0)).toBe(1000) // 1000 * 2^0 = 1000
        expect(backoff.getDelay(1)).toBe(2000) // 1000 * 2^1 = 2000
        expect(backoff.getDelay(2)).toBe(4000) // 1000 * 2^2 = 4000
        expect(backoff.getDelay(3)).toBe(8000) // 1000 * 2^3 = 8000
      })

      it('should respect custom multiplier', () => {
        const backoff = new ExponentialBackoff({
          baseDelayMs: 1000,
          multiplier: 3,
        })

        expect(backoff.getDelay(0)).toBe(1000) // 1000 * 3^0 = 1000
        expect(backoff.getDelay(1)).toBe(3000) // 1000 * 3^1 = 3000
        expect(backoff.getDelay(2)).toBe(9000) // 1000 * 3^2 = 9000
      })

      it('should cap delay at maxDelayMs', () => {
        const backoff = new ExponentialBackoff({
          baseDelayMs: 1000,
          maxDelayMs: 5000,
        })

        expect(backoff.getDelay(0)).toBe(1000)
        expect(backoff.getDelay(1)).toBe(2000)
        expect(backoff.getDelay(2)).toBe(4000)
        expect(backoff.getDelay(3)).toBe(5000) // capped at 5000
        expect(backoff.getDelay(10)).toBe(5000) // still capped
      })
    })

    describe('jitter', () => {
      it('should add random jitter within configured range', () => {
        const backoff = new ExponentialBackoff({
          baseDelayMs: 1000,
          jitterFactor: 0.2, // +/- 20%
        })

        // Run multiple times to verify jitter is applied
        const delays: number[] = []
        for (let i = 0; i < 100; i++) {
          delays.push(backoff.getDelayWithJitter(0))
        }

        // All delays should be between 800 and 1200 (1000 +/- 20%)
        expect(delays.every((d) => d >= 800 && d <= 1200)).toBe(true)

        // Should have some variation (not all the same)
        const uniqueDelays = new Set(delays)
        expect(uniqueDelays.size).toBeGreaterThan(1)
      })

      it('should disable jitter when jitterFactor is 0', () => {
        const backoff = new ExponentialBackoff({
          baseDelayMs: 1000,
          jitterFactor: 0,
        })

        // All delays should be exactly the same
        const delays: number[] = []
        for (let i = 0; i < 10; i++) {
          delays.push(backoff.getDelayWithJitter(0))
        }

        expect(delays.every((d) => d === 1000)).toBe(true)
      })
    })

    describe('human-tier defaults (longer than AI tier)', () => {
      it('should use human-appropriate defaults', () => {
        const backoff = ExponentialBackoff.forHumans()

        // Human defaults should be longer - minutes not seconds
        expect(backoff.getDelay(0)).toBeGreaterThanOrEqual(60000) // At least 1 minute
        expect(backoff.config.maxDelayMs).toBeGreaterThanOrEqual(3600000) // At least 1 hour max
      })

      it('should be configurable via forHumans options', () => {
        const backoff = ExponentialBackoff.forHumans({
          baseDelayMs: 120000, // 2 minutes
          maxDelayMs: 7200000, // 2 hours
        })

        expect(backoff.getDelay(0)).toBe(120000)
        expect(backoff.config.maxDelayMs).toBe(7200000)
      })
    })
  })

  describe('HumanRetryPolicy', () => {
    describe('retry limits', () => {
      it('should enforce maxRetries limit', () => {
        const policy = new HumanRetryPolicy({ maxRetries: 3 })

        expect(policy.shouldRetry(0)).toBe(true)
        expect(policy.shouldRetry(1)).toBe(true)
        expect(policy.shouldRetry(2)).toBe(true)
        expect(policy.shouldRetry(3)).toBe(false) // Reached limit
        expect(policy.shouldRetry(4)).toBe(false)
      })

      it('should consider error type when deciding to retry', () => {
        const policy = new HumanRetryPolicy({
          maxRetries: 3,
          retryableErrors: ['TIMEOUT', 'UNAVAILABLE'],
        })

        expect(policy.shouldRetry(0, new Error('TIMEOUT'))).toBe(true)
        expect(policy.shouldRetry(0, new Error('UNAVAILABLE'))).toBe(true)
        expect(policy.shouldRetry(0, new Error('REJECTED'))).toBe(false) // Not retryable
      })

      it('should respect per-request retry override', () => {
        const policy = new HumanRetryPolicy({ maxRetries: 3 })

        expect(policy.shouldRetry(5, undefined, { maxRetries: 10 })).toBe(true)
        expect(policy.shouldRetry(10, undefined, { maxRetries: 10 })).toBe(false)
      })
    })

    describe('retry exhaustion handling', () => {
      it('should track retry exhaustion', () => {
        const policy = new HumanRetryPolicy({ maxRetries: 2 })

        policy.recordAttempt('req-1')
        expect(policy.isExhausted('req-1')).toBe(false)

        policy.recordAttempt('req-1')
        expect(policy.isExhausted('req-1')).toBe(false)

        policy.recordAttempt('req-1')
        expect(policy.isExhausted('req-1')).toBe(true)
      })

      it('should provide exhaustion callback', async () => {
        const onExhausted = vi.fn()
        const policy = new HumanRetryPolicy({
          maxRetries: 1,
          onExhausted,
        })

        await policy.recordAttemptAsync('req-1')
        expect(onExhausted).not.toHaveBeenCalled()

        await policy.recordAttemptAsync('req-1')
        expect(onExhausted).toHaveBeenCalledWith('req-1', expect.any(Object))
      })
    })

    describe('human-tier specific behavior', () => {
      it('should have longer retry windows than AI tier', () => {
        const humanPolicy = HumanRetryPolicy.forHumans()
        const aiPolicy = new HumanRetryPolicy({ maxRetries: 3 }) // Default for comparison

        // Humans get more time and retries
        expect(humanPolicy.config.maxRetries).toBeGreaterThanOrEqual(5)
      })

      it('should include BUSY as retryable for humans', () => {
        const policy = HumanRetryPolicy.forHumans()

        expect(policy.shouldRetry(0, new Error('BUSY'))).toBe(true)
        expect(policy.shouldRetry(0, new Error('UNAVAILABLE'))).toBe(true)
        expect(policy.shouldRetry(0, new Error('TIMEOUT'))).toBe(true)
      })
    })
  })

  describe('HumanCircuitBreaker', () => {
    describe('state transitions', () => {
      it('should start in CLOSED state', () => {
        const breaker = new HumanCircuitBreaker({ failureThreshold: 3 })
        expect(breaker.state).toBe('closed')
      })

      it('should transition to OPEN after failure threshold', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 3,
          resetTimeoutMs: 10000,
        })

        breaker.recordFailure()
        expect(breaker.state).toBe('closed')

        breaker.recordFailure()
        expect(breaker.state).toBe('closed')

        breaker.recordFailure()
        expect(breaker.state).toBe('open')
      })

      it('should transition to HALF_OPEN after reset timeout', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: 5000,
        })

        breaker.recordFailure()
        breaker.recordFailure()
        expect(breaker.state).toBe('open')

        // Advance time past reset timeout
        vi.advanceTimersByTime(5001)

        expect(breaker.state).toBe('half_open')
      })

      it('should transition from HALF_OPEN to CLOSED on success', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: 5000,
          halfOpenMaxAttempts: 1,
        })

        // Open the circuit
        breaker.recordFailure()
        breaker.recordFailure()
        expect(breaker.state).toBe('open')

        // Advance to half-open
        vi.advanceTimersByTime(5001)
        expect(breaker.state).toBe('half_open')

        // Record success
        breaker.recordSuccess()
        expect(breaker.state).toBe('closed')
      })

      it('should transition from HALF_OPEN back to OPEN on failure', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: 5000,
        })

        // Open the circuit
        breaker.recordFailure()
        breaker.recordFailure()

        // Advance to half-open
        vi.advanceTimersByTime(5001)
        expect(breaker.state).toBe('half_open')

        // Record failure in half-open state
        breaker.recordFailure()
        expect(breaker.state).toBe('open')
      })
    })

    describe('request blocking', () => {
      it('should block requests when circuit is OPEN', () => {
        const breaker = new HumanCircuitBreaker({ failureThreshold: 2 })

        breaker.recordFailure()
        breaker.recordFailure()

        expect(breaker.isOpen()).toBe(true)
        expect(() => breaker.throwIfOpen()).toThrow(CircuitOpenError)
      })

      it('should allow requests when circuit is CLOSED', () => {
        const breaker = new HumanCircuitBreaker({ failureThreshold: 3 })

        expect(breaker.isOpen()).toBe(false)
        expect(() => breaker.throwIfOpen()).not.toThrow()
      })

      it('should allow limited requests in HALF_OPEN state', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: 5000,
          halfOpenMaxAttempts: 2,
        })

        breaker.recordFailure()
        breaker.recordFailure()

        vi.advanceTimersByTime(5001)
        expect(breaker.state).toBe('half_open')

        expect(breaker.canAttempt()).toBe(true)
        breaker.recordAttempt()
        expect(breaker.canAttempt()).toBe(true)
        breaker.recordAttempt()
        expect(breaker.canAttempt()).toBe(false)
      })
    })

    describe('human availability detection', () => {
      it('should detect when humans are overwhelmed', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 5,
          windowMs: 60000, // 1 minute window
        })

        // Simulate overwhelming the human tier
        for (let i = 0; i < 5; i++) {
          breaker.recordFailure()
        }

        expect(breaker.isOverwhelmed()).toBe(true)
      })

      it('should track failure rate', () => {
        const breaker = new HumanCircuitBreaker({
          failureThreshold: 10,
          windowMs: 60000,
        })

        // Record 7 failures and 3 successes
        for (let i = 0; i < 7; i++) {
          breaker.recordFailure()
        }
        for (let i = 0; i < 3; i++) {
          breaker.recordSuccess()
        }

        expect(breaker.getFailureRate()).toBeCloseTo(0.7, 1)
      })
    })

    describe('circuit breaker metrics', () => {
      it('should expose current metrics', () => {
        const breaker = new HumanCircuitBreaker({ failureThreshold: 5 })

        breaker.recordFailure()
        breaker.recordFailure()
        breaker.recordSuccess()

        const metrics = breaker.getMetrics()
        expect(metrics.failures).toBe(2)
        expect(metrics.successes).toBe(1)
        expect(metrics.state).toBe('closed')
        expect(metrics.failureRate).toBeCloseTo(0.67, 1)
      })
    })
  })

  describe('SLATracker', () => {
    describe('deadline monitoring', () => {
      it('should track SLA deadline', () => {
        const tracker = new SLATracker({
          deadlineMs: 300000, // 5 minutes
        })

        const request = tracker.track('req-1')

        expect(request.deadline).toBeDefined()
        expect(request.remainingMs).toBeCloseTo(300000, -3)
      })

      it('should calculate remaining time', () => {
        const tracker = new SLATracker({ deadlineMs: 300000 })

        tracker.track('req-1')

        vi.advanceTimersByTime(60000) // 1 minute

        const remaining = tracker.getRemainingTime('req-1')
        expect(remaining).toBeCloseTo(240000, -3)
      })

      it('should detect SLA violations', () => {
        const tracker = new SLATracker({ deadlineMs: 60000 })

        tracker.track('req-1')

        expect(tracker.isViolated('req-1')).toBe(false)

        vi.advanceTimersByTime(61000)

        expect(tracker.isViolated('req-1')).toBe(true)
      })
    })

    describe('SLA warnings', () => {
      it('should emit warning before deadline', () => {
        const onWarning = vi.fn()
        const tracker = new SLATracker({
          deadlineMs: 300000, // 5 minutes
          warningThresholdMs: 60000, // Warn at 1 minute remaining
          onWarning,
        })

        tracker.track('req-1')

        // 4 minutes passed, 1 minute remaining
        vi.advanceTimersByTime(240000)

        expect(onWarning).toHaveBeenCalledWith(
          'req-1',
          expect.objectContaining({
            remainingMs: expect.any(Number),
          })
        )
      })

      it('should emit violation event on SLA breach', () => {
        const onViolation = vi.fn()
        const tracker = new SLATracker({
          deadlineMs: 60000,
          onViolation,
        })

        tracker.track('req-1')

        vi.advanceTimersByTime(61000)

        expect(onViolation).toHaveBeenCalledWith(
          'req-1',
          expect.objectContaining({
            violatedAt: expect.any(Date),
          })
        )
      })
    })

    describe('SLA tiers', () => {
      it('should support different SLA tiers based on priority', () => {
        const tracker = new SLATracker({
          tiers: {
            critical: { deadlineMs: 60000 }, // 1 minute
            high: { deadlineMs: 300000 }, // 5 minutes
            normal: { deadlineMs: 900000 }, // 15 minutes
            low: { deadlineMs: 3600000 }, // 1 hour
          },
        })

        tracker.track('critical-req', { priority: 'critical' })
        tracker.track('normal-req', { priority: 'normal' })

        expect(tracker.getRemainingTime('critical-req')).toBeCloseTo(60000, -3)
        expect(tracker.getRemainingTime('normal-req')).toBeCloseTo(900000, -3)
      })
    })

    describe('SLA metrics', () => {
      it('should track SLA compliance rate', () => {
        const tracker = new SLATracker({ deadlineMs: 60000 })

        // Complete 2 within SLA
        tracker.track('req-1')
        tracker.track('req-2')
        tracker.complete('req-1')
        tracker.complete('req-2')

        // Violate 1 SLA
        tracker.track('req-3')
        vi.advanceTimersByTime(61000)
        tracker.complete('req-3')

        const metrics = tracker.getMetrics()
        expect(metrics.completed).toBe(3)
        expect(metrics.violated).toBe(1)
        expect(metrics.complianceRate).toBeCloseTo(0.67, 1)
      })
    })
  })

  describe('withRetry wrapper', () => {
    // Use real timers for withRetry tests since they involve async operations
    beforeEach(() => {
      vi.useRealTimers()
    })

    afterEach(() => {
      vi.useFakeTimers()
    })

    describe('basic retry behavior', () => {
      it('should retry on failure', async () => {
        let attempts = 0
        const operation = vi.fn().mockImplementation(() => {
          attempts++
          if (attempts < 3) {
            throw new Error('TIMEOUT')
          }
          return 'success'
        })

        const result = await withRetry(operation, {
          maxRetries: 3,
          backoff: { baseDelayMs: 10, jitterFactor: 0 }, // Small delays for fast tests
        })

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(3)
      })

      it('should respect backoff delays', async () => {
        const start = Date.now()
        const operation = vi
          .fn()
          .mockRejectedValueOnce(new Error('TIMEOUT'))
          .mockResolvedValueOnce('success')

        const result = await withRetry(operation, {
          maxRetries: 3,
          backoff: { baseDelayMs: 50, jitterFactor: 0 },
        })

        const elapsed = Date.now() - start

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(2)
        // Should have waited at least 50ms before second attempt
        expect(elapsed).toBeGreaterThanOrEqual(40) // Allow some timing variance
      })

      it('should throw RetryError when retries exhausted', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('TIMEOUT'))

        await expect(
          withRetry(operation, {
            maxRetries: 2,
            backoff: { baseDelayMs: 5, jitterFactor: 0 },
          })
        ).rejects.toThrow(RetryError)

        expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
      })
    })

    describe('escalation after retry exhaustion', () => {
      it('should trigger escalation callback when retries exhausted', async () => {
        const onEscalate = vi.fn()
        const operation = vi.fn().mockRejectedValue(new Error('TIMEOUT'))

        await expect(
          withRetry(operation, {
            maxRetries: 1,
            backoff: { baseDelayMs: 5, jitterFactor: 0 },
            onEscalate,
          })
        ).rejects.toThrow()

        expect(onEscalate).toHaveBeenCalledWith(
          expect.objectContaining({
            attempts: 2,
            lastError: expect.any(Error),
          })
        )
      })

      it('should allow escalation to resolve the request', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('TIMEOUT'))
        const onEscalate = vi.fn().mockResolvedValue('escalated-result')

        const result = await withRetry(operation, {
          maxRetries: 1,
          backoff: { baseDelayMs: 5, jitterFactor: 0 },
          onEscalate,
          useEscalationResult: true,
        })

        expect(result).toBe('escalated-result')
      })
    })

    describe('circuit breaker integration', () => {
      it('should respect circuit breaker state', async () => {
        const breaker = new HumanCircuitBreaker({ failureThreshold: 1 })
        breaker.recordFailure()

        const operation = vi.fn().mockResolvedValue('success')

        await expect(
          withRetry(operation, {
            maxRetries: 3,
            circuitBreaker: breaker,
          })
        ).rejects.toThrow(CircuitOpenError)

        expect(operation).not.toHaveBeenCalled()
      })

      it('should record failures to circuit breaker', async () => {
        const breaker = new HumanCircuitBreaker({ failureThreshold: 3 })
        const operation = vi.fn().mockRejectedValue(new Error('TIMEOUT'))

        await expect(
          withRetry(operation, {
            maxRetries: 2,
            backoff: { baseDelayMs: 5, jitterFactor: 0 },
            circuitBreaker: breaker,
          })
        ).rejects.toThrow()

        expect(breaker.state).toBe('open')
      })
    })

    describe('SLA integration', () => {
      it('should abort retry when SLA is violated', async () => {
        // Use a longer SLA that we can manually violate
        const tracker = new SLATracker({ deadlineMs: 100 })
        const requestId = 'req-1'
        tracker.track(requestId)

        let attempts = 0
        const operation = vi.fn().mockImplementation(async () => {
          attempts++
          // Simulate slow operation that exceeds SLA
          await new Promise((r) => setTimeout(r, 60))
          throw new Error('TIMEOUT')
        })

        await expect(
          withRetry(operation, {
            maxRetries: 5,
            backoff: { baseDelayMs: 5, jitterFactor: 0 },
            slaTracker: tracker,
            requestId,
          })
        ).rejects.toThrow(SLAViolationError)

        // Should have stopped early due to SLA violation
        expect(attempts).toBeLessThanOrEqual(2)

        tracker.destroy()
      })
    })
  })

  describe('Integration with HumanManager', () => {
    // These tests verify the integration works with the actual HumanManager
    // They use the real HumanManager with retry/timeout options

    it('should configure retry policy via HumanOptions', async () => {
      // This test verifies the integration point exists
      // Full integration testing is done in human.test.ts
      const { Human } = await import('../src/human.js')

      const human = Human({
        retry: {
          maxRetries: 3,
          backoff: { baseDelayMs: 60000 },
        },
      })

      expect(human).toBeDefined()
    })
  })
})
