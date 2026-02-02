/**
 * Tests for batch auto-submit error scenarios
 *
 * RED PHASE: These tests expose error handling gaps in BatchQueue's auto-submit feature.
 *
 * The problem: When auto-submit triggers on maxItems threshold, errors from submit()
 * are caught and only logged (line 250: `this.submit().catch(console.error)`).
 * This means callers have no way to know the batch submission failed.
 *
 * Test scenarios:
 * - Network failure during batch submit
 * - Rate limit errors from API
 * - Partial batch success/failure
 * - Timeout during submission
 *
 * @see primitives.org.ai-7au
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createBatch,
  BatchQueue,
  registerBatchAdapter,
  type BatchAdapter,
  type BatchItem,
  type BatchQueueOptions,
  type BatchResult,
  type BatchJob,
  type BatchSubmitResult,
} from '../src/batch-queue.js'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock adapter that fails on submit
 */
function createFailingAdapter(error: Error): BatchAdapter {
  return {
    async submit(): Promise<BatchSubmitResult> {
      throw error
    },
    async getStatus(batchId: string): Promise<BatchJob> {
      return {
        id: batchId,
        provider: 'openai',
        status: 'failed',
        totalItems: 0,
        completedItems: 0,
        failedItems: 0,
        createdAt: new Date(),
      }
    },
    async cancel(): Promise<void> {},
    async getResults(): Promise<BatchResult[]> {
      return []
    },
    async waitForCompletion(): Promise<BatchResult[]> {
      return []
    },
  }
}

/**
 * Create a mock adapter that succeeds
 */
function createSuccessAdapter(): BatchAdapter {
  let batchCounter = 0
  return {
    async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
      const batchId = `batch_test_${++batchCounter}`
      const results: BatchResult[] = items.map((item) => ({
        id: item.id,
        customId: item.id,
        status: 'completed' as const,
        result: `Result for ${item.prompt}`,
      }))
      return {
        job: {
          id: batchId,
          provider: options.provider || 'openai',
          status: 'completed',
          totalItems: items.length,
          completedItems: items.length,
          failedItems: 0,
          createdAt: new Date(),
          completedAt: new Date(),
        },
        completion: Promise.resolve(results),
      }
    },
    async getStatus(batchId: string): Promise<BatchJob> {
      return {
        id: batchId,
        provider: 'openai',
        status: 'completed',
        totalItems: 0,
        completedItems: 0,
        failedItems: 0,
        createdAt: new Date(),
      }
    },
    async cancel(): Promise<void> {},
    async getResults(): Promise<BatchResult[]> {
      return []
    },
    async waitForCompletion(): Promise<BatchResult[]> {
      return []
    },
  }
}

/**
 * Create an adapter that times out
 */
function createTimeoutAdapter(timeoutMs: number): BatchAdapter {
  return {
    async submit(): Promise<BatchSubmitResult> {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      )
      throw new Error('Request timeout')
    },
    async getStatus(batchId: string): Promise<BatchJob> {
      return {
        id: batchId,
        provider: 'openai',
        status: 'failed',
        totalItems: 0,
        completedItems: 0,
        failedItems: 0,
        createdAt: new Date(),
      }
    },
    async cancel(): Promise<void> {},
    async getResults(): Promise<BatchResult[]> {
      return []
    },
    async waitForCompletion(): Promise<BatchResult[]> {
      return []
    },
  }
}

/**
 * Create an adapter that returns rate limit error
 */
function createRateLimitAdapter(): BatchAdapter {
  return createFailingAdapter(
    Object.assign(new Error('Rate limit exceeded'), {
      status: 429,
      headers: { 'retry-after': '60' },
    })
  )
}

// ============================================================================
// Tests
// ============================================================================

describe('Batch auto-submit error handling', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Capture console.error to verify errors are logged
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('Network failure during auto-submit', () => {
    it('should emit an error event when auto-submit fails due to network error', async () => {
      // Register failing adapter
      const networkError = new Error('Network connection failed')
      registerBatchAdapter('openai', createFailingAdapter(networkError))

      const errorHandler = vi.fn()
      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 3,
      })

      // Subscribe to error events (this is what we expect to exist)
      // This will fail because BatchQueue doesn't emit events
      if ('on' in batch) {
        ;(batch as BatchQueue & { on: (event: string, handler: (e: Error) => void) => void }).on(
          'error',
          errorHandler
        )
      }

      // Add items to trigger auto-submit
      batch.add('prompt 1')
      batch.add('prompt 2')
      batch.add('prompt 3') // This should trigger auto-submit

      // Wait for async auto-submit to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // FAILING: Currently errors are swallowed, errorHandler never called
      // The error should be propagated to the error handler
      expect(errorHandler).toHaveBeenCalledWith(networkError)
    })

    it('should reject pending item promises when auto-submit fails', async () => {
      const networkError = new Error('Network connection failed')
      registerBatchAdapter('openai', createFailingAdapter(networkError))

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 3,
      })

      // Get item references before auto-submit triggers
      const item1 = batch.add('prompt 1')
      const item2 = batch.add('prompt 2')
      const item3 = batch.add('prompt 3') // Triggers auto-submit

      // Wait for async auto-submit to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // FAILING: Items should have error status after failed auto-submit
      // Currently they remain in 'pending' status with no indication of failure
      expect(item1.status).toBe('failed')
      expect(item1.error).toBe('Network connection failed')
      expect(item2.status).toBe('failed')
      expect(item3.status).toBe('failed')
    })

    it('should provide a way to await auto-submit completion or failure', async () => {
      const networkError = new Error('Network connection failed')
      registerBatchAdapter('openai', createFailingAdapter(networkError))

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 3,
      })

      batch.add('prompt 1')
      batch.add('prompt 2')
      batch.add('prompt 3') // Triggers auto-submit

      // FAILING: There should be a way to await the auto-submit result
      // Currently the submission is fire-and-forget with no way to await it
      // Expected: batch.awaitAutoSubmit() or batch.getSubmissionPromise()

      // This property should exist to allow awaiting auto-submit
      expect('autoSubmitPromise' in batch).toBe(true)

      // The promise should be available for awaiting
      const autoSubmitPromise = (batch as BatchQueue & { autoSubmitPromise?: Promise<void> })
        .autoSubmitPromise
      expect(autoSubmitPromise).toBeDefined()

      // Awaiting it should surface the error
      await expect(autoSubmitPromise).rejects.toThrow('Network connection failed')
    })
  })

  describe('Rate limit errors during auto-submit', () => {
    it('should expose rate limit errors to callers', async () => {
      registerBatchAdapter('openai', createRateLimitAdapter())

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 2,
      })

      batch.add('prompt 1')
      batch.add('prompt 2') // Triggers auto-submit

      await new Promise((resolve) => setTimeout(resolve, 100))

      // FAILING: Rate limit error should be exposed to caller
      // Currently it's only logged to console.error
      expect(consoleErrorSpy).toHaveBeenCalled()

      // There should be a way to check for submission errors
      // This property doesn't exist - that's the gap
      const submissionError = (batch as BatchQueue & { submissionError?: Error }).submissionError
      expect(submissionError).toBeDefined()
      expect(submissionError?.message).toContain('Rate limit')
    })

    it('should include retry-after information in rate limit errors', async () => {
      registerBatchAdapter('openai', createRateLimitAdapter())

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 2,
      })

      batch.add('prompt 1')
      batch.add('prompt 2')

      await new Promise((resolve) => setTimeout(resolve, 100))

      // FAILING: Rate limit metadata should be accessible
      const job = batch.getJob()
      // Job should contain rate limit retry info
      expect(job).toBeDefined()
      expect((job as BatchJob & { retryAfter?: number })?.retryAfter).toBeDefined()
    })
  })

  describe('Timeout during auto-submit', () => {
    it('should handle submission timeouts gracefully', async () => {
      registerBatchAdapter('openai', createTimeoutAdapter(50))

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 2,
      })

      batch.add('prompt 1')
      batch.add('prompt 2')

      // Wait for timeout to occur
      await new Promise((resolve) => setTimeout(resolve, 200))

      // FAILING: Timeout error should be captured and accessible
      // Logger calls with format: 'Batch auto-submit failed:', error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Batch auto-submit failed:', expect.any(Error))

      // Items should reflect the failure
      const items = batch.getItems()
      expect(items[0].status).toBe('failed')
      expect(items[0].error).toContain('timeout')
    })
  })

  describe('Error recovery scenarios', () => {
    it('should allow retry after auto-submit failure', async () => {
      const failingAdapter = createFailingAdapter(new Error('Temporary failure'))
      registerBatchAdapter('openai', failingAdapter)

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 2,
      })

      batch.add('prompt 1')
      batch.add('prompt 2') // Triggers auto-submit (fails)

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Replace with working adapter
      registerBatchAdapter('openai', createSuccessAdapter())

      // FAILING: There should be a way to retry failed auto-submit
      // Currently once auto-submit fires and fails, the batch is stuck
      const retry = () => {
        if ('retry' in batch) {
          return (batch as BatchQueue & { retry: () => Promise<void> }).retry()
        }
        return Promise.reject(new Error('No retry method available'))
      }

      // Should be able to retry the submission
      await expect(retry()).resolves.not.toThrow()
    })

    it('should reset submission state on failure to allow manual submit', async () => {
      registerBatchAdapter('openai', createFailingAdapter(new Error('Submit failed')))

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 2,
      })

      batch.add('prompt 1')
      batch.add('prompt 2') // Triggers auto-submit (fails)

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Replace with working adapter
      registerBatchAdapter('openai', createSuccessAdapter())

      // FAILING: After auto-submit failure, manual submit should be possible
      // Currently isSubmitted is set to true before the async submit completes
      // so we can't retry with manual submit()
      expect(batch.isSubmitted).toBe(false) // Should be false after failed auto-submit

      // Manual submit should work after failed auto-submit
      await expect(batch.submit()).resolves.toBeDefined()
    })
  })

  describe('Partial batch failure during auto-submit', () => {
    it('should emit error event when some items fail during auto-submit', async () => {
      // Create adapter that fails some items
      const partialAdapter: BatchAdapter = {
        async submit(items: BatchItem[]): Promise<BatchSubmitResult> {
          const results: BatchResult[] = items.map((item, i) => ({
            id: item.id,
            customId: item.id,
            status: i % 2 === 0 ? 'completed' : 'failed',
            result: i % 2 === 0 ? `Result for ${item.prompt}` : undefined,
            error: i % 2 === 1 ? 'Processing failed' : undefined,
          }))
          return {
            job: {
              id: 'batch_partial',
              provider: 'openai',
              status: 'completed',
              totalItems: items.length,
              completedItems: results.filter((r) => r.status === 'completed').length,
              failedItems: results.filter((r) => r.status === 'failed').length,
              createdAt: new Date(),
            },
            completion: Promise.resolve(results),
          }
        },
        async getStatus(batchId: string): Promise<BatchJob> {
          return {
            id: batchId,
            provider: 'openai',
            status: 'completed',
            totalItems: 4,
            completedItems: 2,
            failedItems: 2,
            createdAt: new Date(),
          }
        },
        async cancel(): Promise<void> {},
        async getResults(): Promise<BatchResult[]> {
          return []
        },
        async waitForCompletion(): Promise<BatchResult[]> {
          return []
        },
      }

      registerBatchAdapter('openai', partialAdapter)

      const partialFailureHandler = vi.fn()
      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 4,
      })

      // FAILING: There should be a way to subscribe to partial failure events
      // This tests that callers can be notified when some items fail
      if ('on' in batch) {
        ;(
          batch as BatchQueue & {
            on: (event: string, handler: (results: BatchResult[]) => void) => void
          }
        ).on('partial-failure', partialFailureHandler)
      }

      batch.add('prompt 1')
      batch.add('prompt 2')
      batch.add('prompt 3')
      batch.add('prompt 4') // Triggers auto-submit

      // Wait for auto-submit to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // FAILING: Partial failure handler should be called with failed items
      expect(partialFailureHandler).toHaveBeenCalled()
      expect(partialFailureHandler).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ status: 'failed', error: 'Processing failed' }),
        ])
      )
    })

    it('should provide aggregated error info after partial auto-submit failure', async () => {
      const partialAdapter: BatchAdapter = {
        async submit(items: BatchItem[]): Promise<BatchSubmitResult> {
          const results: BatchResult[] = items.map((item, i) => ({
            id: item.id,
            customId: item.id,
            status: i % 2 === 0 ? 'completed' : 'failed',
            result: i % 2 === 0 ? `Result for ${item.prompt}` : undefined,
            error: i % 2 === 1 ? 'Processing failed' : undefined,
          }))
          return {
            job: {
              id: 'batch_partial',
              provider: 'openai',
              status: 'completed',
              totalItems: items.length,
              completedItems: results.filter((r) => r.status === 'completed').length,
              failedItems: results.filter((r) => r.status === 'failed').length,
              createdAt: new Date(),
            },
            completion: Promise.resolve(results),
          }
        },
        async getStatus(batchId: string): Promise<BatchJob> {
          return {
            id: batchId,
            provider: 'openai',
            status: 'completed',
            totalItems: 4,
            completedItems: 2,
            failedItems: 2,
            createdAt: new Date(),
          }
        },
        async cancel(): Promise<void> {},
        async getResults(): Promise<BatchResult[]> {
          return []
        },
        async waitForCompletion(): Promise<BatchResult[]> {
          return []
        },
      }

      registerBatchAdapter('openai', partialAdapter)

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 4,
      })

      batch.add('prompt 1')
      batch.add('prompt 2')
      batch.add('prompt 3')
      batch.add('prompt 4') // Triggers auto-submit

      await new Promise((resolve) => setTimeout(resolve, 100))

      // FAILING: There should be a way to get failure summary
      const failedItems = (
        batch as BatchQueue & { getFailedItems?: () => BatchItem[] }
      ).getFailedItems?.()
      expect(failedItems).toBeDefined()
      expect(failedItems?.length).toBe(2)
    })
  })

  describe('Console.error verification (current behavior)', () => {
    it('verifies errors are currently only logged, not propagated', async () => {
      const testError = new Error('Test submission error')
      registerBatchAdapter('openai', createFailingAdapter(testError))

      const batch = createBatch({
        provider: 'openai',
        autoSubmit: true,
        maxItems: 2,
      })

      batch.add('prompt 1')
      batch.add('prompt 2') // Triggers auto-submit

      await new Promise((resolve) => setTimeout(resolve, 100))

      // This passes - errors ARE logged
      // Logger calls with format: 'Batch auto-submit failed:', error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Batch auto-submit failed:', testError)

      // But there's no other way to access the error
      // - No error event emitted
      // - No error property on batch
      // - No way to await the auto-submit
      // - Items remain in 'pending' state

      const items = batch.getItems()
      // FAILING: Items should not remain pending after failed submission
      expect(items[0].status).not.toBe('pending')
    })
  })
})

describe('Suggested API improvements', () => {
  it('documents expected error handling API', () => {
    // This test documents what the error handling API SHOULD look like
    // All these assertions will fail, showing the gaps

    const batch = createBatch({
      provider: 'openai',
      autoSubmit: true,
      maxItems: 5,
    })

    // 1. Event-based error handling
    expect('on' in batch).toBe(true)
    expect(typeof (batch as unknown as { on?: unknown }).on).toBe('function')

    // 2. Promise-based error handling
    expect('awaitAutoSubmit' in batch).toBe(true)
    expect(typeof (batch as unknown as { awaitAutoSubmit?: unknown }).awaitAutoSubmit).toBe(
      'function'
    )

    // 3. Error state inspection
    expect('submissionError' in batch).toBe(true)
    expect('hasSubmissionError' in batch).toBe(true)

    // 4. Retry capability
    expect('retry' in batch).toBe(true)
    expect(typeof (batch as unknown as { retry?: unknown }).retry).toBe('function')
  })
})
