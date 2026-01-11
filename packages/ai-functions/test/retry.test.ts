/**
 * Tests for retry/fallback patterns with exponential backoff
 *
 * TDD Approach: RED Phase - Write failing tests first
 *
 * Tests cover:
 * 1. Exponential backoff (delays: 1s, 2s, 4s, 8s...)
 * 2. Jitter (+-20% randomization)
 * 3. Circuit breaker (fail fast after N consecutive failures)
 * 4. Fallback models (sonnet fails -> try opus -> try gpt-4o)
 * 5. Partial retry for batch items
 * 6. Error classification (network vs rate-limit vs invalid-input)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RetryPolicy,
  CircuitBreaker,
  FallbackChain,
  withRetry,
  calculateBackoff,
  classifyError,
  RetryableError,
  NonRetryableError,
  RateLimitError,
  NetworkError,
  CircuitOpenError,
  ErrorCategory,
  type RetryOptions,
  type CircuitBreakerOptions,
  type FallbackOptions,
} from '../src/retry.js'

// ============================================================================
// 1. EXPONENTIAL BACKOFF TESTS
// ============================================================================

describe('Exponential Backoff', () => {
  describe('calculateBackoff', () => {
    it('calculates correct delays: 1s, 2s, 4s, 8s...', () => {
      const baseDelay = 1000 // 1 second

      expect(calculateBackoff(0, { baseDelay })).toBe(1000)
      expect(calculateBackoff(1, { baseDelay })).toBe(2000)
      expect(calculateBackoff(2, { baseDelay })).toBe(4000)
      expect(calculateBackoff(3, { baseDelay })).toBe(8000)
      expect(calculateBackoff(4, { baseDelay })).toBe(16000)
    })

    it('respects maxDelay cap', () => {
      const options = { baseDelay: 1000, maxDelay: 5000 }

      expect(calculateBackoff(0, options)).toBe(1000)
      expect(calculateBackoff(1, options)).toBe(2000)
      expect(calculateBackoff(2, options)).toBe(4000)
      expect(calculateBackoff(3, options)).toBe(5000) // Capped
      expect(calculateBackoff(10, options)).toBe(5000) // Still capped
    })

    it('supports custom multiplier', () => {
      const options = { baseDelay: 1000, multiplier: 3 }

      expect(calculateBackoff(0, options)).toBe(1000)
      expect(calculateBackoff(1, options)).toBe(3000)
      expect(calculateBackoff(2, options)).toBe(9000)
    })
  })

  describe('RetryPolicy', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retries on failure with exponential delays', async () => {
      const attempts: number[] = []
      let attemptCount = 0

      const policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 1000,
      })

      const operation = vi.fn(async () => {
        attempts.push(Date.now())
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const promise = policy.execute(operation)

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0)

      // Wait for first retry delay (1s)
      await vi.advanceTimersByTimeAsync(1000)

      // Wait for second retry delay (2s)
      await vi.advanceTimersByTimeAsync(2000)

      const result = await promise
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('respects maxRetries limit', async () => {
      // Use real timers with very short delays for this test
      vi.useRealTimers()

      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 10, // Very short delays for fast test
      })

      const operation = vi.fn(async () => {
        throw new Error('Always fails')
      })

      await expect(policy.execute(operation)).rejects.toThrow('Always fails')
      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries

      // Restore fake timers for subsequent tests
      vi.useFakeTimers()
    })

    it('stops retrying on success', async () => {
      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelay: 100,
      })

      let attemptCount = 0
      const operation = vi.fn(async () => {
        attemptCount++
        if (attemptCount === 1) {
          throw new Error('First attempt fails')
        }
        return 'success'
      })

      const promise = policy.execute(operation)

      // Advance to first retry
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('provides attempt info to operation', async () => {
      const policy = new RetryPolicy({
        maxRetries: 2,
        baseDelay: 100,
      })

      const attemptInfos: { attempt: number; maxRetries: number }[] = []
      const operation = vi.fn(async (info: { attempt: number; maxRetries: number }) => {
        attemptInfos.push(info)
        if (info.attempt < 2) {
          throw new Error('Retry needed')
        }
        return 'success'
      })

      const promise = policy.execute(operation)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)
      await promise

      expect(attemptInfos).toEqual([
        { attempt: 0, maxRetries: 2 },
        { attempt: 1, maxRetries: 2 },
        { attempt: 2, maxRetries: 2 },
      ])
    })
  })
})

// ============================================================================
// 2. JITTER TESTS
// ============================================================================

describe('Jitter', () => {
  it('adds randomness within +-20% bounds', () => {
    const baseDelay = 1000
    const jitterFactor = 0.2 // +-20%

    // Generate 100 samples
    const samples: number[] = []
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoff(0, {
        baseDelay,
        jitter: jitterFactor,
      })
      samples.push(delay)
    }

    // All samples should be within bounds
    const minExpected = baseDelay * (1 - jitterFactor) // 800
    const maxExpected = baseDelay * (1 + jitterFactor) // 1200

    samples.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(minExpected)
      expect(delay).toBeLessThanOrEqual(maxExpected)
    })

    // Should have variance (not all same value)
    const uniqueValues = new Set(samples)
    expect(uniqueValues.size).toBeGreaterThan(1)
  })

  it('applies jitter consistently across retry attempts', () => {
    const options = {
      baseDelay: 1000,
      jitter: 0.2,
    }

    // Each attempt level should have jittered values
    for (let attempt = 0; attempt < 5; attempt++) {
      const samples: number[] = []
      for (let i = 0; i < 20; i++) {
        samples.push(calculateBackoff(attempt, options))
      }

      const expectedBase = 1000 * Math.pow(2, attempt)
      const minExpected = expectedBase * 0.8
      const maxExpected = expectedBase * 1.2

      samples.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(minExpected)
        expect(delay).toBeLessThanOrEqual(maxExpected)
      })
    }
  })

  it('supports full jitter strategy', () => {
    const baseDelay = 1000

    const samples: number[] = []
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoff(0, {
        baseDelay,
        jitterStrategy: 'full',
      })
      samples.push(delay)
    }

    // Full jitter: random value between 0 and calculated delay
    samples.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(baseDelay)
    })
  })

  it('supports decorrelated jitter strategy', () => {
    const options = {
      baseDelay: 1000,
      jitterStrategy: 'decorrelated' as const,
    }

    // Decorrelated jitter uses previous delay to calculate next
    // delay = random(baseDelay, previousDelay * 3)
    let prevDelay = options.baseDelay
    for (let attempt = 0; attempt < 5; attempt++) {
      const delay = calculateBackoff(attempt, { ...options, previousDelay: prevDelay })
      expect(delay).toBeGreaterThanOrEqual(options.baseDelay)
      expect(delay).toBeLessThanOrEqual(prevDelay * 3)
      prevDelay = delay
    }
  })
})

// ============================================================================
// 3. CIRCUIT BREAKER TESTS
// ============================================================================

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens after N consecutive failures', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 10000,
    })

    const failingOperation = vi.fn(async () => {
      throw new Error('Service unavailable')
    })

    // First 3 failures should go through
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    await expect(breaker.execute(failingOperation)).rejects.toThrow()

    expect(breaker.state).toBe('open')

    // Fourth call should fail fast without calling operation
    await expect(breaker.execute(failingOperation)).rejects.toThrow(CircuitOpenError)
    expect(failingOperation).toHaveBeenCalledTimes(3) // Not 4
  })

  it('stays open for configured duration', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 5000,
    })

    const failingOperation = vi.fn(async () => {
      throw new Error('Fail')
    })

    // Open the circuit
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    await expect(breaker.execute(failingOperation)).rejects.toThrow()

    expect(breaker.state).toBe('open')

    // Still open after 4 seconds
    await vi.advanceTimersByTimeAsync(4000)
    expect(breaker.state).toBe('open')

    // Transitions to half-open after 5 seconds
    await vi.advanceTimersByTimeAsync(1000)
    expect(breaker.state).toBe('half-open')
  })

  it('allows single test request in half-open state', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000,
    })

    const failingOperation = vi.fn(async () => {
      throw new Error('Fail')
    })

    // Open the circuit
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    await expect(breaker.execute(failingOperation)).rejects.toThrow()

    // Transition to half-open
    await vi.advanceTimersByTimeAsync(1000)
    expect(breaker.state).toBe('half-open')

    // Should allow one test request
    const successOperation = vi.fn(async () => 'success')
    const result = await breaker.execute(successOperation)

    expect(result).toBe('success')
    expect(successOperation).toHaveBeenCalledTimes(1)
  })

  it('closes after successful request in half-open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000,
    })

    const failingOperation = vi.fn(async () => {
      throw new Error('Fail')
    })

    // Open the circuit
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    await expect(breaker.execute(failingOperation)).rejects.toThrow()

    // Transition to half-open
    await vi.advanceTimersByTimeAsync(1000)

    // Successful request closes the circuit
    const successOperation = vi.fn(async () => 'success')
    await breaker.execute(successOperation)

    expect(breaker.state).toBe('closed')

    // Should now allow normal operations
    await breaker.execute(successOperation)
    await breaker.execute(successOperation)
    expect(successOperation).toHaveBeenCalledTimes(3)
  })

  it('reopens if half-open request fails', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000,
    })

    const failingOperation = vi.fn(async () => {
      throw new Error('Fail')
    })

    // Open the circuit
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    await expect(breaker.execute(failingOperation)).rejects.toThrow()

    // Transition to half-open
    await vi.advanceTimersByTimeAsync(1000)
    expect(breaker.state).toBe('half-open')

    // Failed test request reopens circuit
    await expect(breaker.execute(failingOperation)).rejects.toThrow()
    expect(breaker.state).toBe('open')
  })

  it('resets failure count on success', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
    })

    let shouldFail = true
    const operation = vi.fn(async () => {
      if (shouldFail) throw new Error('Fail')
      return 'success'
    })

    // 2 failures
    await expect(breaker.execute(operation)).rejects.toThrow()
    await expect(breaker.execute(operation)).rejects.toThrow()
    expect(breaker.failureCount).toBe(2)

    // Success resets count
    shouldFail = false
    await breaker.execute(operation)
    expect(breaker.failureCount).toBe(0)

    // Now need 3 more failures to open
    shouldFail = true
    await expect(breaker.execute(operation)).rejects.toThrow()
    expect(breaker.state).toBe('closed')
    expect(breaker.failureCount).toBe(1)
  })

  it('provides circuit breaker metrics', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
    })

    const metrics = breaker.getMetrics()

    expect(metrics).toMatchObject({
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailure: null,
      lastSuccess: null,
    })
  })
})

// ============================================================================
// 4. FALLBACK MODELS TESTS
// ============================================================================

describe('FallbackChain', () => {
  it('tries secondary model when primary fails', async () => {
    const primaryModel = vi.fn(async () => {
      throw new Error('Primary model unavailable')
    })
    const secondaryModel = vi.fn(async () => 'fallback result')

    const chain = new FallbackChain([
      { name: 'primary', execute: primaryModel },
      { name: 'secondary', execute: secondaryModel },
    ])

    const result = await chain.execute()

    expect(result).toBe('fallback result')
    expect(primaryModel).toHaveBeenCalledTimes(1)
    expect(secondaryModel).toHaveBeenCalledTimes(1)
  })

  it('supports fallback chain with multiple models', async () => {
    const model1 = vi.fn(async () => {
      throw new Error('Model 1 failed')
    })
    const model2 = vi.fn(async () => {
      throw new Error('Model 2 failed')
    })
    const model3 = vi.fn(async () => 'model 3 success')
    const model4 = vi.fn(async () => 'model 4 unused')

    const chain = new FallbackChain([
      { name: 'sonnet', execute: model1 },
      { name: 'opus', execute: model2 },
      { name: 'gpt-4o', execute: model3 },
      { name: 'gemini', execute: model4 },
    ])

    const result = await chain.execute()

    expect(result).toBe('model 3 success')
    expect(model1).toHaveBeenCalledTimes(1)
    expect(model2).toHaveBeenCalledTimes(1)
    expect(model3).toHaveBeenCalledTimes(1)
    expect(model4).not.toHaveBeenCalled()
  })

  it('preserves original request parameters', async () => {
    const capturedParams: unknown[] = []

    const model1 = vi.fn(async (params: unknown) => {
      capturedParams.push(params)
      throw new Error('Failed')
    })
    const model2 = vi.fn(async (params: unknown) => {
      capturedParams.push(params)
      return 'success'
    })

    const chain = new FallbackChain([
      { name: 'primary', execute: model1 },
      { name: 'secondary', execute: model2 },
    ])

    const requestParams = {
      prompt: 'Test prompt',
      temperature: 0.7,
      maxTokens: 1000,
    }

    await chain.execute(requestParams)

    expect(capturedParams).toEqual([requestParams, requestParams])
  })

  it('tracks fallback metrics', async () => {
    const model1 = vi.fn(async () => {
      throw new Error('Failed')
    })
    const model2 = vi.fn(async () => 'success')

    const chain = new FallbackChain([
      { name: 'primary', execute: model1 },
      { name: 'secondary', execute: model2 },
    ])

    await chain.execute()

    const metrics = chain.getMetrics()

    expect(metrics.attempts).toBe(2)
    expect(metrics.successfulModel).toBe('secondary')
    expect(metrics.failedModels).toEqual(['primary'])
    expect(metrics.totalDuration).toBeGreaterThanOrEqual(0)
  })

  it('throws when all models fail', async () => {
    const model1 = vi.fn(async () => {
      throw new Error('Model 1 failed')
    })
    const model2 = vi.fn(async () => {
      throw new Error('Model 2 failed')
    })

    const chain = new FallbackChain([
      { name: 'model1', execute: model1 },
      { name: 'model2', execute: model2 },
    ])

    await expect(chain.execute()).rejects.toThrow('All fallback models failed')
  })

  it('supports conditional fallback based on error type', async () => {
    const model1 = vi.fn(async () => {
      throw new RateLimitError('Rate limited')
    })
    const model2 = vi.fn(async () => 'success')

    const chain = new FallbackChain(
      [
        { name: 'model1', execute: model1 },
        { name: 'model2', execute: model2 },
      ],
      {
        shouldFallback: (error) => error instanceof RateLimitError,
      }
    )

    const result = await chain.execute()
    expect(result).toBe('success')

    // Non-retryable errors should not trigger fallback
    const model3 = vi.fn(async () => {
      throw new NonRetryableError('Invalid input')
    })
    const model4 = vi.fn(async () => 'unused')

    const chain2 = new FallbackChain(
      [
        { name: 'model3', execute: model3 },
        { name: 'model4', execute: model4 },
      ],
      {
        shouldFallback: (error) => !(error instanceof NonRetryableError),
      }
    )

    await expect(chain2.execute()).rejects.toThrow(NonRetryableError)
    expect(model4).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 5. PARTIAL RETRY FOR BATCH ITEMS TESTS
// ============================================================================

describe('Partial Retry for Batch Items', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries only failed items in a batch', async () => {
    const batchProcessor = vi.fn(async (items: string[]) => {
      return items.map((item) => {
        if (item === 'fail') {
          return { success: false, error: new Error('Item failed'), item }
        }
        return { success: true, result: `processed-${item}`, item }
      })
    })

    const policy = new RetryPolicy({
      maxRetries: 2,
      baseDelay: 100,
    })

    const items = ['a', 'fail', 'c', 'fail', 'e']

    const promise = policy.executeBatch(items, batchProcessor)

    // First batch processes all items
    // Then retry processes only failed items
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)

    const results = await promise

    // Should have all results
    expect(results.length).toBe(5)

    // Successful items processed once
    expect(results.filter((r) => r.success).length).toBeGreaterThanOrEqual(3)
  })

  it('respects per-item retry limits', async () => {
    const attemptCounts = new Map<string, number>()

    const batchProcessor = vi.fn(async (items: string[]) => {
      return items.map((item) => {
        const count = (attemptCounts.get(item) || 0) + 1
        attemptCounts.set(item, count)

        if (item === 'always-fail') {
          return { success: false, error: new Error('Permanent failure'), item }
        }
        return { success: true, result: `done-${item}`, item }
      })
    })

    const policy = new RetryPolicy({
      maxRetries: 3,
      baseDelay: 100,
    })

    const items = ['ok', 'always-fail']

    const promise = policy.executeBatch(items, batchProcessor)
    await vi.runAllTimersAsync()

    const results = await promise

    // 'always-fail' should have been attempted maxRetries + 1 times
    expect(attemptCounts.get('always-fail')).toBe(4)
    // 'ok' should have been attempted only once
    expect(attemptCounts.get('ok')).toBe(1)
  })

  it('combines results from multiple retry rounds', async () => {
    let callCount = 0

    const batchProcessor = vi.fn(async (items: string[]) => {
      callCount++
      return items.map((item) => {
        // 'flaky' succeeds on second attempt
        if (item === 'flaky' && callCount === 1) {
          return { success: false, error: new Error('Transient'), item }
        }
        return { success: true, result: `result-${item}`, item }
      })
    })

    const policy = new RetryPolicy({
      maxRetries: 2,
      baseDelay: 100,
    })

    const items = ['stable', 'flaky']

    const promise = policy.executeBatch(items, batchProcessor)
    await vi.runAllTimersAsync()

    const results = await promise

    expect(results.every((r) => r.success)).toBe(true)
    expect(results.find((r) => r.item === 'stable')?.result).toBe('result-stable')
    expect(results.find((r) => r.item === 'flaky')?.result).toBe('result-flaky')
  })
})

// ============================================================================
// 6. ERROR CLASSIFICATION TESTS
// ============================================================================

describe('Error Classification', () => {
  describe('classifyError', () => {
    it('classifies network errors', () => {
      const errors = [
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('ENOTFOUND'),
        new Error('socket hang up'),
        new Error('Network request failed'),
        new TypeError('fetch failed'),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.Network)
      })
    })

    it('classifies rate limit errors', () => {
      const errors = [
        new Error('Rate limit exceeded'),
        new Error('429 Too Many Requests'),
        new Error('quota exceeded'),
        Object.assign(new Error('Rate limited'), { status: 429 }),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.RateLimit)
      })
    })

    it('classifies invalid input errors', () => {
      const errors = [
        new Error('Invalid JSON'),
        new Error('400 Bad Request'),
        new Error('Validation failed'),
        Object.assign(new Error('Invalid'), { status: 400 }),
        Object.assign(new Error('Unprocessable'), { status: 422 }),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.InvalidInput)
      })
    })

    it('classifies authentication errors', () => {
      const errors = [
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('Invalid API key'),
        Object.assign(new Error('Auth failed'), { status: 401 }),
        Object.assign(new Error('Not allowed'), { status: 403 }),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.Authentication)
      })
    })

    it('classifies server errors', () => {
      const errors = [
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('504 Gateway Timeout'),
        Object.assign(new Error('Server error'), { status: 500 }),
        Object.assign(new Error('Unavailable'), { status: 503 }),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.Server)
      })
    })

    it('classifies context length errors', () => {
      const errors = [
        new Error('context length exceeded'),
        new Error('maximum context length'),
        new Error('token limit exceeded'),
        new Error("This model's maximum context length is 128000 tokens"),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.ContextLength)
      })
    })

    it('classifies unknown errors', () => {
      const errors = [
        new Error('Something went wrong'),
        new Error('Unexpected error'),
        new TypeError('Cannot read property'),
      ]

      errors.forEach((error) => {
        const category = classifyError(error)
        expect(category).toBe(ErrorCategory.Unknown)
      })
    })
  })

  describe('Error retryability', () => {
    it('marks network errors as retryable', () => {
      const error = new NetworkError('Connection failed')
      expect(error.retryable).toBe(true)
    })

    it('marks rate limit errors as retryable with delay', () => {
      const error = new RateLimitError('Too many requests', { retryAfter: 5000 })
      expect(error.retryable).toBe(true)
      expect(error.retryAfter).toBe(5000)
    })

    it('marks invalid input errors as non-retryable', () => {
      const error = new NonRetryableError('Invalid parameters')
      expect(error.retryable).toBe(false)
    })

    it('extracts retry-after from headers', () => {
      const error = RateLimitError.fromResponse({
        status: 429,
        headers: {
          'retry-after': '30',
        },
      })

      expect(error.retryAfter).toBe(30000) // Converted to ms
    })
  })

  describe('Retry behavior based on error type', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retries network errors', async () => {
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new NetworkError('Connection reset')
        }
        return 'success'
      })

      const policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
      })

      const promise = policy.execute(operation)
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise
      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })

    it('respects rate limit retry-after', async () => {
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts === 1) {
          throw new RateLimitError('Rate limited', { retryAfter: 5000 })
        }
        return 'success'
      })

      const policy = new RetryPolicy({
        maxRetries: 3,
        baseDelay: 100,
        respectRetryAfter: true,
      })

      const promise = policy.execute(operation)

      // Should wait for retry-after duration (5s) instead of baseDelay (100ms)
      await vi.advanceTimersByTimeAsync(100)
      expect(attempts).toBe(1) // Still waiting

      await vi.advanceTimersByTimeAsync(4900)
      expect(attempts).toBe(2) // Now retried

      const result = await promise
      expect(result).toBe('success')
    })

    it('does not retry non-retryable errors', async () => {
      const operation = vi.fn(async () => {
        throw new NonRetryableError('Invalid input - will never work')
      })

      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelay: 100,
      })

      await expect(policy.execute(operation)).rejects.toThrow(NonRetryableError)
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })
})

// ============================================================================
// 7. INTEGRATION: withRetry HELPER TESTS
// ============================================================================

describe('withRetry helper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('wraps an async function with retry logic', async () => {
    let attempts = 0
    const unreliableFunction = async (x: number) => {
      attempts++
      if (attempts < 3) {
        throw new Error('Not yet')
      }
      return x * 2
    }

    const reliableFunction = withRetry(unreliableFunction, {
      maxRetries: 3,
      baseDelay: 100,
    })

    const promise = reliableFunction(5)
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)

    const result = await promise
    expect(result).toBe(10)
  })

  it('preserves function signature', async () => {
    const original = async (a: string, b: number): Promise<string> => {
      return `${a}-${b}`
    }

    const wrapped = withRetry(original, { maxRetries: 2, baseDelay: 100 })

    const result = await wrapped('hello', 42)
    expect(result).toBe('hello-42')
  })

  it('works with generator options', async () => {
    let attempts = 0

    const wrapped = withRetry(
      async () => {
        attempts++
        if (attempts < 2) throw new Error('Retry')
        return 'done'
      },
      {
        maxRetries: 5,
        baseDelay: 50,
        maxDelay: 1000,
        jitter: 0.1,
      }
    )

    const promise = wrapped()
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise
    expect(result).toBe('done')
  })
})
