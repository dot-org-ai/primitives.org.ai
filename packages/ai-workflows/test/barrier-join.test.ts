/**
 * Barrier/Join semantics tests for parallel step coordination
 *
 * TDD RED Phase: These tests define the expected behavior for:
 * - waitForAll() - all steps must complete
 * - waitForAny(n) - N of M steps must complete
 * - Fanout/convergence patterns
 * - Concurrent execution limits
 * - Barrier timeout handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  Barrier,
  BarrierTimeoutError,
  createBarrier,
  waitForAll,
  waitForAny,
  withConcurrencyLimit,
  type BarrierOptions,
  type BarrierResult,
} from '../src/barrier.js'

describe('Barrier/Join Semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('waitForAll', () => {
    it('should wait for all promises to complete', async () => {
      const step1 = Promise.resolve('result1')
      const step2 = Promise.resolve('result2')
      const step3 = Promise.resolve('result3')

      const results = await waitForAll([step1, step2, step3])

      expect(results).toEqual(['result1', 'result2', 'result3'])
    })

    it('should preserve order of results', async () => {
      // step2 resolves first but should be in position 1
      const step1 = new Promise<number>(resolve => setTimeout(() => resolve(1), 100))
      const step2 = new Promise<number>(resolve => setTimeout(() => resolve(2), 50))
      const step3 = new Promise<number>(resolve => setTimeout(() => resolve(3), 150))

      const promise = waitForAll([step1, step2, step3])
      await vi.advanceTimersByTimeAsync(200)
      const results = await promise

      expect(results).toEqual([1, 2, 3])
    })

    it('should reject if any step fails', async () => {
      const step1 = Promise.resolve('ok')
      const step2 = Promise.reject(new Error('step2 failed'))
      const step3 = Promise.resolve('ok')

      await expect(waitForAll([step1, step2, step3])).rejects.toThrow('step2 failed')
    })

    it('should support timeout option', async () => {
      const slowStep = new Promise(resolve => setTimeout(() => resolve('slow'), 5000))

      const promise = waitForAll([slowStep], { timeout: 1000 })

      await vi.advanceTimersByTimeAsync(1500)

      await expect(promise).rejects.toBeInstanceOf(BarrierTimeoutError)
    })

    it('should return results within timeout', async () => {
      const step1 = new Promise<string>(resolve => setTimeout(() => resolve('fast'), 100))

      const promise = waitForAll([step1], { timeout: 1000 })
      await vi.advanceTimersByTimeAsync(200)
      const results = await promise

      expect(results).toEqual(['fast'])
    })

    it('should handle empty array', async () => {
      const results = await waitForAll([])
      expect(results).toEqual([])
    })
  })

  describe('waitForAny', () => {
    it('should resolve when N of M steps complete', async () => {
      const step1 = new Promise<string>(resolve => setTimeout(() => resolve('first'), 100))
      const step2 = new Promise<string>(resolve => setTimeout(() => resolve('second'), 200))
      const step3 = new Promise<string>(resolve => setTimeout(() => resolve('third'), 300))

      const promise = waitForAny(2, [step1, step2, step3])
      await vi.advanceTimersByTimeAsync(250)
      const result = await promise

      expect(result.completed).toHaveLength(2)
      expect(result.completed).toContain('first')
      expect(result.completed).toContain('second')
      expect(result.pending).toHaveLength(1)
    })

    it('should resolve immediately when N=0', async () => {
      const step1 = new Promise<string>(resolve => setTimeout(() => resolve('a'), 1000))

      const result = await waitForAny(0, [step1])

      expect(result.completed).toHaveLength(0)
      expect(result.pending).toHaveLength(1)
    })

    it('should reject if not enough steps can complete due to failures', async () => {
      const step1 = Promise.reject(new Error('failed1'))
      const step2 = Promise.reject(new Error('failed2'))
      const step3 = Promise.resolve('ok')

      // Need 3 but only 1 can succeed
      await expect(waitForAny(3, [step1, step2, step3])).rejects.toThrow()
    })

    it('should support timeout', async () => {
      const slowStep1 = new Promise(resolve => setTimeout(() => resolve('a'), 5000))
      const slowStep2 = new Promise(resolve => setTimeout(() => resolve('b'), 5000))

      const promise = waitForAny(2, [slowStep1, slowStep2], { timeout: 1000 })

      await vi.advanceTimersByTimeAsync(1500)

      await expect(promise).rejects.toBeInstanceOf(BarrierTimeoutError)
    })

    it('should return partial results on timeout when configured', async () => {
      const fast = new Promise<string>(resolve => setTimeout(() => resolve('fast'), 100))
      const slow = new Promise<string>(resolve => setTimeout(() => resolve('slow'), 5000))

      const promise = waitForAny(2, [fast, slow], {
        timeout: 1000,
        returnPartialOnTimeout: true,
      })

      await vi.advanceTimersByTimeAsync(1500)
      const result = await promise

      expect(result.completed).toContain('fast')
      expect(result.timedOut).toBe(true)
    })
  })

  describe('Barrier class', () => {
    it('should create a barrier with expected participants', () => {
      const barrier = createBarrier(3)

      expect(barrier.expectedCount).toBe(3)
      expect(barrier.arrivedCount).toBe(0)
      expect(barrier.isComplete).toBe(false)
    })

    it('should track arrivals', async () => {
      const barrier = createBarrier<string>(2)

      barrier.arrive('first')
      expect(barrier.arrivedCount).toBe(1)
      expect(barrier.isComplete).toBe(false)

      barrier.arrive('second')
      expect(barrier.arrivedCount).toBe(2)
      expect(barrier.isComplete).toBe(true)
    })

    it('should resolve wait() when all participants arrive', async () => {
      const barrier = createBarrier<number>(2)

      const waitPromise = barrier.wait()

      barrier.arrive(1)
      barrier.arrive(2)

      const results = await waitPromise
      expect(results).toEqual([1, 2])
    })

    it('should support timeout on wait()', async () => {
      const barrier = createBarrier<string>(3, { timeout: 1000 })

      barrier.arrive('first')

      const promise = barrier.wait()
      await vi.advanceTimersByTimeAsync(1500)

      await expect(promise).rejects.toBeInstanceOf(BarrierTimeoutError)
    })

    it('should support abort signal', async () => {
      const controller = new AbortController()
      const barrier = createBarrier<string>(3, { signal: controller.signal })

      barrier.arrive('first')

      const promise = barrier.wait()
      controller.abort()

      await expect(promise).rejects.toThrow(/aborted/i)
    })

    it('should allow reset for reuse', async () => {
      const barrier = createBarrier<number>(2)

      barrier.arrive(1)
      barrier.arrive(2)
      expect(barrier.isComplete).toBe(true)

      barrier.reset()

      expect(barrier.arrivedCount).toBe(0)
      expect(barrier.isComplete).toBe(false)
    })

    it('should provide progress information', () => {
      const barrier = createBarrier<string>(4)

      barrier.arrive('a')
      barrier.arrive('b')

      const progress = barrier.getProgress()
      expect(progress.arrived).toBe(2)
      expect(progress.expected).toBe(4)
      expect(progress.percentage).toBe(50)
    })
  })

  describe('Fanout/Convergence patterns', () => {
    it('should support fanout pattern (one to many)', async () => {
      const input = { value: 10 }

      // Fanout: process input in parallel different ways
      const results = await waitForAll([
        Promise.resolve(input.value * 2),
        Promise.resolve(input.value + 5),
        Promise.resolve(input.value.toString()),
      ])

      expect(results).toEqual([20, 15, '10'])
    })

    it('should support convergence pattern (many to one)', async () => {
      const barrier = createBarrier<{ source: string; data: number }>(3)

      // Simulate multiple sources converging
      barrier.arrive({ source: 'api1', data: 100 })
      barrier.arrive({ source: 'api2', data: 200 })
      barrier.arrive({ source: 'api3', data: 300 })

      const results = await barrier.wait()

      // Aggregate at convergence point
      const total = results.reduce((sum, r) => sum + r.data, 0)
      expect(total).toBe(600)
    })

    it('should support map-reduce pattern', async () => {
      const inputs = [1, 2, 3, 4, 5]

      // Map phase (fanout)
      const mapped = await waitForAll(inputs.map(x => Promise.resolve(x * 2)))

      // Reduce phase (convergence)
      const reduced = mapped.reduce((sum, x) => sum + x, 0)

      expect(reduced).toBe(30)
    })
  })

  describe('Concurrent execution limits', () => {
    it('should limit concurrent executions', async () => {
      const maxConcurrent = 2
      const tasks = [
        () => new Promise<number>(resolve => setTimeout(() => resolve(1), 100)),
        () => new Promise<number>(resolve => setTimeout(() => resolve(2), 100)),
        () => new Promise<number>(resolve => setTimeout(() => resolve(3), 100)),
        () => new Promise<number>(resolve => setTimeout(() => resolve(4), 100)),
      ]

      let concurrentCount = 0
      let maxObservedConcurrent = 0

      const trackedTasks = tasks.map(task => async () => {
        concurrentCount++
        maxObservedConcurrent = Math.max(maxObservedConcurrent, concurrentCount)
        try {
          return await task()
        } finally {
          concurrentCount--
        }
      })

      const promise = withConcurrencyLimit(trackedTasks, maxConcurrent)
      await vi.advanceTimersByTimeAsync(300)
      const results = await promise

      expect(results).toEqual([1, 2, 3, 4])
      expect(maxObservedConcurrent).toBeLessThanOrEqual(maxConcurrent)
    })

    it('should preserve order even with varying task durations', async () => {
      const tasks = [
        () => new Promise<string>(resolve => setTimeout(() => resolve('a'), 300)),
        () => new Promise<string>(resolve => setTimeout(() => resolve('b'), 100)),
        () => new Promise<string>(resolve => setTimeout(() => resolve('c'), 200)),
      ]

      const promise = withConcurrencyLimit(tasks, 2)
      await vi.advanceTimersByTimeAsync(500)
      const results = await promise

      expect(results).toEqual(['a', 'b', 'c'])
    })

    it('should handle task failures gracefully', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('task failed')),
        () => Promise.resolve(3),
      ]

      await expect(withConcurrencyLimit(tasks, 2)).rejects.toThrow('task failed')
    })

    it('should support collecting all results including errors', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('failed')),
        () => Promise.resolve(3),
      ]

      const results = await withConcurrencyLimit(tasks, 2, { collectErrors: true })

      expect(results[0]).toBe(1)
      expect(results[1]).toBeInstanceOf(Error)
      expect(results[2]).toBe(3)
    })
  })

  describe('BarrierTimeoutError', () => {
    it('should include timeout details', async () => {
      const barrier = createBarrier<string>(3, { timeout: 1000 })

      barrier.arrive('first')

      const promise = barrier.wait()
      await vi.advanceTimersByTimeAsync(1500)

      let caughtError: BarrierTimeoutError | null = null
      try {
        await promise
      } catch (error) {
        caughtError = error as BarrierTimeoutError
      }

      expect(caughtError).not.toBeNull()
      expect(caughtError).toBeInstanceOf(BarrierTimeoutError)
      expect(caughtError!.timeout).toBe(1000)
      expect(caughtError!.arrived).toBe(1)
      // Use Number() to handle any serialization edge cases
      expect(Number(caughtError!.expected)).toBe(3)
    })
  })

  describe('Progress tracking', () => {
    it('should emit progress events', async () => {
      const progressHandler = vi.fn()
      const barrier = createBarrier<string>(3, {
        onProgress: progressHandler,
      })

      barrier.arrive('a')
      expect(progressHandler).toHaveBeenCalledWith({
        arrived: 1,
        expected: 3,
        percentage: 33,
        latest: 'a',
      })

      barrier.arrive('b')
      expect(progressHandler).toHaveBeenCalledWith({
        arrived: 2,
        expected: 3,
        percentage: 67,
        latest: 'b',
      })

      barrier.arrive('c')
      expect(progressHandler).toHaveBeenCalledWith({
        arrived: 3,
        expected: 3,
        percentage: 100,
        latest: 'c',
      })
    })
  })

  describe('Cancellation support', () => {
    it('should cancel pending tasks when barrier is cancelled', async () => {
      const barrier = createBarrier<string>(3)

      barrier.arrive('first')

      const waitPromise = barrier.wait()
      barrier.cancel(new Error('Operation cancelled'))

      await expect(waitPromise).rejects.toThrow('Operation cancelled')
    })

    it('should support AbortController', async () => {
      const controller = new AbortController()

      const slowTasks = [
        new Promise<string>(resolve => setTimeout(() => resolve('a'), 5000)),
        new Promise<string>(resolve => setTimeout(() => resolve('b'), 5000)),
      ]

      const promise = waitForAll(slowTasks, { signal: controller.signal })

      // Advance timers a bit then abort
      await vi.advanceTimersByTimeAsync(100)
      controller.abort()

      await expect(promise).rejects.toThrow(/aborted/i)
    })
  })
})
