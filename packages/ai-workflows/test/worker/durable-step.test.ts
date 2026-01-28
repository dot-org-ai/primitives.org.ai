/**
 * DurableStep Wrapper Tests (RED Phase)
 *
 * Tests for DurableStep - a wrapper around Cloudflare Workflows step semantics
 * that provides durable execution, retries, sleep, and step metadata.
 *
 * These tests define the expected behavior for DurableStep before implementation.
 * All tests SHOULD FAIL because DurableStep integration with real Cloudflare
 * Workflows is not yet implemented.
 *
 * Uses @cloudflare/vitest-pool-workers - NO MOCKS.
 * Tests run against real Cloudflare Workflows bindings.
 *
 * Bead: aip-p3m5
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'

// ============================================================================
// These imports will FAIL because the Cloudflare Workflows integration is not
// yet implemented in DurableStep. This is the RED phase of TDD.
// ============================================================================
import {
  DurableStep,
  StepContext,
  type StepMetadata,
  type StepConfig,
  type WorkflowStep,
} from '../../src/worker/durable-step.js'

// Import the TestWorkflow that should be defined in worker.ts
// This will FAIL because TestWorkflow doesn't exist yet
import { TestWorkflow } from '../../src/worker.js'

// ============================================================================
// Type Definitions for Test Environment
// ============================================================================

interface TestEnv {
  WORKFLOW: Workflow
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a workflow instance from the binding.
 * This creates a new workflow instance for testing.
 *
 * Note: env.WORKFLOW.create() returns a WorkflowInstance directly.
 * The `id` option sets the instance ID for later retrieval via get().
 */
async function getWorkflowInstance(name?: string): Promise<WorkflowInstance> {
  // Create returns the WorkflowInstance directly
  const instance = await env.WORKFLOW.create({
    id: name ?? crypto.randomUUID(),
  })
  return instance
}

/**
 * Run a workflow and wait for it to complete.
 */
async function runWorkflow<T>(instance: WorkflowInstance, params?: unknown): Promise<T> {
  const status = await instance.status()
  if (status.status === 'queued' || status.status === 'running') {
    // Wait for completion
    let current = status
    while (current.status !== 'complete' && current.status !== 'errored') {
      await new Promise((resolve) => setTimeout(resolve, 100))
      current = await instance.status()
    }
    if (current.status === 'errored') {
      // Extract error message from the error object
      // Note: miniflare's workflow status API doesn't expose error details in current.error
      // The actual error message is logged by workerd but not accessible via the status API
      const error = current.error as unknown
      let errorMessage: string

      if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>
        // Try common error property names
        errorMessage = (err.message ??
          err.name ??
          err.error ??
          (err.cause &&
            typeof err.cause === 'object' &&
            (err.cause as Record<string, unknown>).message) ??
          JSON.stringify(error)) as string
      } else {
        errorMessage = String(error ?? 'Unknown error')
      }
      throw new Error(errorMessage)
    }
    return current.output as T
  }
  return status.output as T
}

// ============================================================================
// 1. DurableStep: Core Construction
// ============================================================================

describe('DurableStep', () => {
  describe('construction', () => {
    it('creates a DurableStep with a name and function', () => {
      const step = new DurableStep('fetch-data', async (input: { url: string }) => {
        return { status: 200 }
      })

      expect(step).toBeInstanceOf(DurableStep)
      expect(step.name).toBe('fetch-data')
    })

    it('creates a DurableStep with a name, config, and function', () => {
      const step = new DurableStep(
        'process-payment',
        {
          retries: { limit: 3, delay: '1 second', backoff: 'exponential' },
          timeout: '30 seconds',
        },
        async (input: { amount: number }) => {
          return { success: true }
        }
      )

      expect(step).toBeInstanceOf(DurableStep)
      expect(step.name).toBe('process-payment')
      expect(step.config).toBeDefined()
      expect(step.config?.retries?.limit).toBe(3)
      expect(step.config?.timeout).toBe('30 seconds')
    })

    it('preserves the function reference', () => {
      const fn = async (input: { id: string }) => ({ found: true })
      const step = new DurableStep('lookup', fn)

      expect(step.fn).toBe(fn)
    })
  })

  // ============================================================================
  // 2. DurableStep.run() with Real Workflows Binding
  // ============================================================================

  describe('run() with real Workflows binding', () => {
    it('executes the wrapped function with input via real workflow step', async () => {
      // This test requires the TestWorkflow to be properly configured
      // and the DurableStep to integrate with real Workflows step.do()
      const instance = await getWorkflowInstance('exec-test-1')

      // The workflow should execute a DurableStep internally
      const result = await runWorkflow<{ value: number }>(instance)

      expect(result).toBeDefined()
      expect(result.value).toBe(42)
    })

    it('wraps execution in step.do() for durability', async () => {
      // This test verifies that step.do() is called with the step name
      const instance = await getWorkflowInstance('durability-test-1')

      const result = await runWorkflow<{ stepName: string }>(instance)

      expect(result.stepName).toBe('durable-action')
    })

    it('passes config to step.do() when provided', async () => {
      // Verify that retry config is passed through to the Workflows runtime
      const instance = await getWorkflowInstance('config-test-1')

      const result = await runWorkflow<{ configApplied: boolean }>(instance)

      expect(result.configApplied).toBe(true)
    })

    it('returns the result from the wrapped function', async () => {
      const instance = await getWorkflowInstance('result-test-1')

      const result = await runWorkflow<{ sum: number; product: number }>(instance)

      expect(result).toEqual({ sum: 10, product: 21 })
    })

    it('propagates errors from the wrapped function', async () => {
      const instance = await getWorkflowInstance('error-test-1')

      // Note: miniflare's workflow status API doesn't expose error details,
      // so we check that an error is thrown (the actual error message "Step execution failed"
      // is visible in workerd logs but not in the status object)
      await expect(runWorkflow(instance)).rejects.toThrow()
    })

    it('supports generic input and output types', async () => {
      interface OrderInput {
        orderId: string
        items: string[]
      }

      interface OrderResult {
        confirmed: boolean
        total: number
      }

      const instance = await getWorkflowInstance('typed-test-1')

      const result = await runWorkflow<OrderResult>(instance)

      expect(result.confirmed).toBe(true)
      expect(result.total).toBe(20)
    })

    it('supports void input', async () => {
      const instance = await getWorkflowInstance('void-input-test-1')

      const result = await runWorkflow<string>(instance)

      expect(result).toBe('hello')
    })
  })

  // ============================================================================
  // 3. DurableStep with StepContext
  // ============================================================================

  describe('run() with StepContext', () => {
    it('provides a StepContext to the function when requested', async () => {
      const instance = await getWorkflowInstance('ctx-test-1')

      const result = await runWorkflow<{ hasContext: boolean }>(instance)

      expect(result.hasContext).toBe(true)
    })

    it('StepContext provides step metadata', async () => {
      const instance = await getWorkflowInstance('metadata-test-1')

      const result = await runWorkflow<StepMetadata>(instance)

      expect(result).toBeDefined()
      expect(result.id).toBe('meta-step')
      expect(typeof result.attempt).toBe('number')
    })
  })
})

// ============================================================================
// 4. StepContext: step.do() for side effects
// ============================================================================

describe('StepContext', () => {
  describe('do()', () => {
    it('executes a named side effect durably via real Workflows', async () => {
      const instance = await getWorkflowInstance('side-effect-test-1')

      const result = await runWorkflow<{ sent: boolean }>(instance)

      expect(result).toEqual({ sent: true })
    })

    it('executes do() with config for retries', async () => {
      const instance = await getWorkflowInstance('retry-config-test-1')

      const result = await runWorkflow<{ data: string }>(instance)

      expect(result).toEqual({ data: 'response' })
    })

    it('propagates errors from do() side effects', async () => {
      const instance = await getWorkflowInstance('side-effect-error-test-1')

      // Note: miniflare's workflow status API doesn't expose error details,
      // so we check that an error is thrown (the actual error message "Side effect failed"
      // is visible in workerd logs but not in the status object)
      await expect(runWorkflow(instance)).rejects.toThrow()
    })

    it('supports multiple sequential do() calls', async () => {
      const instance = await getWorkflowInstance('sequential-test-1')

      const result = await runWorkflow<string[]>(instance)

      expect(result).toEqual(['step-1', 'step-2', 'step-3'])
    })
  })

  // ============================================================================
  // 5. StepContext: sleep() and sleepUntil()
  // ============================================================================

  describe('sleep()', () => {
    it('sleeps for a specified duration string via real Workflows', async () => {
      const instance = await getWorkflowInstance('sleep-test-1')

      // Note: In real tests, this would actually wait. For testing purposes,
      // we verify the workflow completes successfully after the sleep.
      const startTime = Date.now()
      const result = await runWorkflow<{ waited: boolean }>(instance)
      const elapsed = Date.now() - startTime

      expect(result).toEqual({ waited: true })
      // Sleep should have occurred (at least partially in miniflare)
      // The actual duration may be simulated in test environment
    })

    it('sleeps for a duration with various units', async () => {
      const instance = await getWorkflowInstance('multi-sleep-test-1')

      const result = await runWorkflow<{ sleepCount: number }>(instance)

      expect(result.sleepCount).toBe(3)
    })
  })

  describe('sleepUntil()', () => {
    it('sleeps until a specified Date via real Workflows', async () => {
      const instance = await getWorkflowInstance('sleep-until-test-1')

      const result = await runWorkflow<{ resumed: boolean }>(instance)

      expect(result).toEqual({ resumed: true })
    })

    it('sleeps until a specified unix timestamp (number)', async () => {
      const instance = await getWorkflowInstance('timestamp-sleep-test-1')

      const result = await runWorkflow<{ completed: boolean }>(instance)

      expect(result.completed).toBe(true)
    })
  })

  // ============================================================================
  // 6. StepContext: Metadata
  // ============================================================================

  describe('metadata', () => {
    it('exposes the step id', async () => {
      const instance = await getWorkflowInstance('step-id-test-1')

      const result = await runWorkflow<{ stepId: string }>(instance)

      expect(result.stepId).toBe('named-step')
    })

    it('exposes the current attempt number', async () => {
      const instance = await getWorkflowInstance('attempt-test-1')

      const result = await runWorkflow<{ attempt: number }>(instance)

      expect(result.attempt).toBeDefined()
      expect(typeof result.attempt).toBe('number')
      expect(result.attempt).toBeGreaterThanOrEqual(1)
    })

    it('exposes the configured retries limit', async () => {
      const instance = await getWorkflowInstance('retries-limit-test-1')

      const result = await runWorkflow<{ retriesLimit: number }>(instance)

      expect(result.retriesLimit).toBe(5)
    })

    it('exposes retries as 0 when no retry config provided', async () => {
      const instance = await getWorkflowInstance('no-retries-test-1')

      const result = await runWorkflow<{ retriesLimit: number }>(instance)

      expect(result.retriesLimit).toBe(0)
    })
  })

  // ============================================================================
  // 7. Error Handling and Retries
  // ============================================================================

  describe('error handling', () => {
    it('retries on failure when retries are configured (real Workflows)', async () => {
      // This test verifies that the Workflows runtime handles retries
      const instance = await getWorkflowInstance('retry-behavior-test-1')

      const result = await runWorkflow<{ attempts: number; success: boolean }>(instance)

      // The workflow should retry and eventually succeed
      expect(result.attempts).toBeGreaterThan(1)
      expect(result.success).toBe(true)
    })

    it('respects timeout configuration', async () => {
      const instance = await getWorkflowInstance('timeout-test-1')

      // A step that exceeds its timeout should error
      await expect(runWorkflow(instance)).rejects.toThrow()
    })

    it('supports exponential backoff configuration', async () => {
      const instance = await getWorkflowInstance('exp-backoff-test-1')

      const result = await runWorkflow<{ backoffApplied: boolean }>(instance)

      expect(result.backoffApplied).toBe(true)
    })

    it('supports linear backoff configuration', async () => {
      const instance = await getWorkflowInstance('linear-backoff-test-1')

      const result = await runWorkflow<{ backoffType: string }>(instance)

      expect(result.backoffType).toBe('linear')
    })

    it('supports constant backoff configuration', async () => {
      const instance = await getWorkflowInstance('constant-backoff-test-1')

      const result = await runWorkflow<{ backoffType: string }>(instance)

      expect(result.backoffType).toBe('constant')
    })

    it('throws immediately without retries when no config', async () => {
      const instance = await getWorkflowInstance('no-retry-error-test-1')

      // Note: miniflare's workflow status API doesn't expose error details,
      // so we check that an error is thrown (the actual error message "Immediate failure"
      // is visible in workerd logs but not in the status object)
      await expect(runWorkflow(instance)).rejects.toThrow()
    })
  })

  // ============================================================================
  // 8. Composability: DurableStep chains
  // ============================================================================

  describe('composability', () => {
    it('multiple DurableSteps can be run sequentially in a workflow', async () => {
      const instance = await getWorkflowInstance('sequential-steps-test-1')

      const result = await runWorkflow<{
        fetchData: string
        processed: boolean
      }>(instance)

      expect(result.fetchData).toBe('response from https://api.example.com')
      expect(result.processed).toBe(true)
    })

    it('DurableStep can be used as a factory function', async () => {
      const instance = await getWorkflowInstance('factory-test-1')

      const result = await runWorkflow<{
        usersEndpoint: string
        ordersEndpoint: string
      }>(instance)

      expect(result.usersEndpoint).toBe('api-users')
      expect(result.ordersEndpoint).toBe('api-orders')
    })

    it('supports parallel DurableStep execution', async () => {
      const instance = await getWorkflowInstance('parallel-test-1')

      const result = await runWorkflow<{
        results: string[]
        executedInParallel: boolean
      }>(instance)

      expect(result.results).toHaveLength(3)
      expect(result.executedInParallel).toBe(true)
    })
  })
})

// ============================================================================
// 9. State Persistence Across Workflow Restarts
// ============================================================================

describe('DurableStep: State Persistence', () => {
  it('persists step state before execution', async () => {
    const instance = await getWorkflowInstance('persist-before-test-1')

    const result = await runWorkflow<{ statePersistedBefore: boolean }>(instance)

    expect(result.statePersistedBefore).toBe(true)
  })

  it('persists step state after execution', async () => {
    const instance = await getWorkflowInstance('persist-after-test-1')

    const result = await runWorkflow<{ statePersistedAfter: boolean }>(instance)

    expect(result.statePersistedAfter).toBe(true)
  })

  it('resumes from last successful step on workflow restart', async () => {
    // This tests the durability guarantee - if a workflow restarts,
    // it should not re-execute already completed steps
    const instance = await getWorkflowInstance('resume-test-1')

    const result = await runWorkflow<{
      step1ExecutedOnce: boolean
      step2Completed: boolean
    }>(instance)

    expect(result.step1ExecutedOnce).toBe(true)
    expect(result.step2Completed).toBe(true)
  })

  it('tracks execution history', async () => {
    const instance = await getWorkflowInstance('history-test-1')

    const result = await runWorkflow<{
      history: Array<{ step: string; timestamp: string }>
    }>(instance)

    expect(result.history).toBeDefined()
    expect(Array.isArray(result.history)).toBe(true)
    expect(result.history.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// 10. Timeout Handling
// ============================================================================

describe('DurableStep: Timeout Handling', () => {
  it('handles step timeout gracefully', async () => {
    const instance = await getWorkflowInstance('graceful-timeout-test-1')

    // The workflow should handle the timeout and return a timeout error
    const result = await runWorkflow<{ timedOut: boolean; error: string }>(instance)

    expect(result.timedOut).toBe(true)
    expect(result.error).toContain('timeout')
  })

  it('allows subsequent steps after timeout handling', async () => {
    const instance = await getWorkflowInstance('after-timeout-test-1')

    const result = await runWorkflow<{
      step1TimedOut: boolean
      step2Completed: boolean
    }>(instance)

    expect(result.step1TimedOut).toBe(true)
    expect(result.step2Completed).toBe(true)
  })

  it('respects per-step timeout configuration', async () => {
    const instance = await getWorkflowInstance('per-step-timeout-test-1')

    const result = await runWorkflow<{
      fastStepCompleted: boolean
      slowStepTimedOut: boolean
    }>(instance)

    expect(result.fastStepCompleted).toBe(true)
    expect(result.slowStepTimedOut).toBe(true)
  })
})

// ============================================================================
// 11. Integration with WorkflowService
// ============================================================================

describe('DurableStep: WorkflowService Integration', () => {
  it('DurableStep works within WorkflowService context', async () => {
    // This verifies that DurableStep integrates properly with WorkflowService
    const instance = await getWorkflowInstance('service-integration-test-1')

    const result = await runWorkflow<{ serviceIntegrated: boolean }>(instance)

    expect(result.serviceIntegrated).toBe(true)
  })

  it('DurableStep can access workflow context', async () => {
    const instance = await getWorkflowInstance('context-access-test-1')

    const result = await runWorkflow<{ contextAvailable: boolean }>(instance)

    expect(result.contextAvailable).toBe(true)
  })

  it('DurableStep supports workflow-level state sharing', async () => {
    const instance = await getWorkflowInstance('state-sharing-test-1')

    const result = await runWorkflow<{
      step1SetValue: string
      step2ReadValue: string
    }>(instance)

    expect(result.step1SetValue).toBe('shared-data')
    expect(result.step2ReadValue).toBe('shared-data')
  })
})

// ============================================================================
// 12. StepMetadata Type Tests
// ============================================================================

describe('StepMetadata', () => {
  it('has required fields: id, attempt, retries', () => {
    // This is a type-level test - if the import works and the type has the
    // required fields, the DurableStep constructor and metadata access should work.
    const metadata: StepMetadata = {
      id: 'test-step',
      attempt: 1,
      retries: 3,
    }

    expect(metadata.id).toBe('test-step')
    expect(metadata.attempt).toBe(1)
    expect(metadata.retries).toBe(3)
  })
})

// ============================================================================
// 13. StepConfig Type Tests
// ============================================================================

describe('StepConfig', () => {
  it('matches Cloudflare WorkflowStepConfig shape', () => {
    const config: StepConfig = {
      retries: {
        limit: 5,
        delay: '1 second',
        backoff: 'exponential',
      },
      timeout: '30 seconds',
    }

    expect(config.retries?.limit).toBe(5)
    expect(config.retries?.delay).toBe('1 second')
    expect(config.retries?.backoff).toBe('exponential')
    expect(config.timeout).toBe('30 seconds')
  })

  it('supports numeric delay values', () => {
    const config: StepConfig = {
      retries: {
        limit: 3,
        delay: 1000,
      },
    }

    expect(config.retries?.delay).toBe(1000)
  })

  it('supports numeric timeout values', () => {
    const config: StepConfig = {
      timeout: 30000,
    }

    expect(config.timeout).toBe(30000)
  })

  it('allows omitting optional fields', () => {
    const minimalConfig: StepConfig = {}

    expect(minimalConfig.retries).toBeUndefined()
    expect(minimalConfig.timeout).toBeUndefined()
  })
})

// ============================================================================
// 14. Edge Cases
// ============================================================================

describe('DurableStep: Edge Cases', () => {
  it('handles empty input', async () => {
    const instance = await getWorkflowInstance('empty-input-test-1')

    const result = await runWorkflow<{ processed: boolean }>(instance)

    expect(result.processed).toBe(true)
  })

  it('handles large input data', async () => {
    const instance = await getWorkflowInstance('large-input-test-1')

    const result = await runWorkflow<{ dataSize: number }>(instance)

    expect(result.dataSize).toBeGreaterThan(1000)
  })

  it('handles large output data', async () => {
    const instance = await getWorkflowInstance('large-output-test-1')

    const result = await runWorkflow<{ items: unknown[] }>(instance)

    expect(result.items.length).toBeGreaterThan(1000)
  })

  it('handles nested step.do() calls', async () => {
    const instance = await getWorkflowInstance('nested-do-test-1')

    const result = await runWorkflow<{ nestedResult: string }>(instance)

    expect(result.nestedResult).toBe('nested-success')
  })

  it('handles concurrent workflow instances', async () => {
    // Create multiple workflow instances concurrently
    const instances = await Promise.all([
      getWorkflowInstance('concurrent-test-1'),
      getWorkflowInstance('concurrent-test-2'),
      getWorkflowInstance('concurrent-test-3'),
    ])

    const results = await Promise.all(
      instances.map((instance) => runWorkflow<{ instanceId: string }>(instance))
    )

    // Each instance should have completed with its own ID
    const ids = results.map((r) => r.instanceId)
    expect(new Set(ids).size).toBe(3) // All unique
  })
})
