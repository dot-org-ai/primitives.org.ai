/**
 * TopologicalExecutor Tests (RED Phase)
 *
 * Tests for TopologicalExecutor - executes workflow steps in topological order
 * with parallel execution for steps at the same dependency level.
 *
 * These tests define the expected behavior for TopologicalExecutor before implementation.
 * All tests SHOULD FAIL because TopologicalExecutor does not exist yet.
 *
 * Uses @cloudflare/vitest-pool-workers - NO MOCKS.
 * Tests run against real Cloudflare Workflows bindings.
 *
 * Bead: aip-erlm
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'

// ============================================================================
// These imports will FAIL because TopologicalExecutor does not exist yet.
// This is the RED phase of TDD.
// ============================================================================
import {
  TopologicalExecutor,
  DurableGraph,
  type ExecutionPlan,
  type ExecutionResult,
  type ExecutionLevel,
  type StepExecutionResult,
} from '../../src/worker/topological-executor.js'

// Import WorkflowBuilder for creating test graphs
import { WorkflowBuilder, type BuiltWorkflow } from '../../src/worker/workflow-builder.js'

// Import DurableStep for step definitions
import { DurableStep, type StepConfig } from '../../src/worker/durable-step.js'

// Import topological sort types for comparison
import {
  type SortableNode,
  type ExecutionLevel as SortLevel,
} from '../../src/graph/topological-sort.js'

// Import the TestWorkflow that should be defined in worker.ts
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
 */
async function getWorkflowInstance(name?: string): Promise<WorkflowInstance> {
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
    let current = status
    while (current.status !== 'complete' && current.status !== 'errored') {
      await new Promise((resolve) => setTimeout(resolve, 100))
      current = await instance.status()
    }
    if (current.status === 'errored') {
      const error = current.error as unknown
      let errorMessage: string

      if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>
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
// Test Data - Sample Step Functions
// ============================================================================

const stepA = async (input: { value: number }) => {
  return { a: input.value * 2 }
}

const stepB = async (input: { value: number }) => {
  return { b: input.value + 10 }
}

const stepC = async (input: { value: number }) => {
  return { c: input.value - 5 }
}

const stepD = async (input: { a: number; b?: number; c?: number }) => {
  return { d: input.a + (input.b ?? 0) + (input.c ?? 0) }
}

// ============================================================================
// 1. DurableGraph.fromBuilder() - Creating Execution Graph
// ============================================================================

describe('DurableGraph.fromBuilder()', () => {
  it('should create a DurableGraph from a WorkflowBuilder', () => {
    const builder = WorkflowBuilder.create('test-workflow')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')
      .step('C', stepC)
      .dependsOn('A')
      .step('D', stepD)
      .dependsOn('B', 'C')

    const graph = DurableGraph.fromBuilder(builder)

    expect(graph).toBeDefined()
    expect(graph).toBeInstanceOf(DurableGraph)
  })

  it('should preserve step definitions from builder', () => {
    const builder = WorkflowBuilder.create('test-workflow')
      .step('validate', async (input: { orderId: string }) => ({ valid: true }))
      .step('charge', async (input: { valid: boolean }) => ({ charged: true }))
      .dependsOn('validate')

    const graph = DurableGraph.fromBuilder(builder)

    expect(graph.getStep('validate')).toBeDefined()
    expect(graph.getStep('charge')).toBeDefined()
  })

  it('should preserve dependency relationships', () => {
    const builder = WorkflowBuilder.create('test-workflow')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')
      .step('C', stepC)
      .dependsOn('B')

    const graph = DurableGraph.fromBuilder(builder)

    expect(graph.getDependencies('B')).toContain('A')
    expect(graph.getDependencies('C')).toContain('B')
    expect(graph.getDependencies('A')).toEqual([])
  })

  it('should calculate execution levels', () => {
    const builder = WorkflowBuilder.create('test-workflow')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')
      .step('C', stepC)
      .dependsOn('A')
      .step('D', stepD)
      .dependsOn('B', 'C')

    const graph = DurableGraph.fromBuilder(builder)
    const levels = graph.getExecutionLevels()

    // Level 0: A
    // Level 1: B, C (both depend on A)
    // Level 2: D (depends on B and C)
    expect(levels).toHaveLength(3)
    expect(levels[0].nodes).toContain('A')
    expect(levels[1].nodes).toContain('B')
    expect(levels[1].nodes).toContain('C')
    expect(levels[2].nodes).toContain('D')
  })

  it('should support fromBuilt() for pre-built workflows', () => {
    const workflow = WorkflowBuilder.create('test-workflow')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')
      .build()

    const graph = DurableGraph.fromBuilt(workflow)

    expect(graph).toBeDefined()
    expect(graph.getStep('A')).toBeDefined()
    expect(graph.getStep('B')).toBeDefined()
  })
})

// ============================================================================
// 2. DurableGraph.validate() - No Circular Dependencies
// ============================================================================

describe('DurableGraph.validate()', () => {
  it('should validate a valid DAG without errors', () => {
    const builder = WorkflowBuilder.create('valid-dag')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')
      .step('C', stepC)
      .dependsOn('B')

    const graph = DurableGraph.fromBuilder(builder)

    expect(() => graph.validate()).not.toThrow()
  })

  it('should throw on circular dependencies', () => {
    // Note: This should be caught at build time, but validate() provides an explicit check
    const graph = new DurableGraph()
    graph.addStep('A', stepA, ['B'])
    graph.addStep('B', stepB, ['A'])

    expect(() => graph.validate()).toThrow(/circular/i)
  })

  it('should throw on self-referencing dependencies', () => {
    const graph = new DurableGraph()
    graph.addStep('A', stepA, ['A'])

    expect(() => graph.validate()).toThrow(/circular|self-reference/i)
  })

  it('should throw on indirect circular dependencies', () => {
    const graph = new DurableGraph()
    graph.addStep('A', stepA, ['C'])
    graph.addStep('B', stepB, ['A'])
    graph.addStep('C', stepC, ['B'])

    expect(() => graph.validate()).toThrow(/circular/i)
  })

  it('should report the cycle path in the error', () => {
    const graph = new DurableGraph()
    graph.addStep('A', stepA, ['C'])
    graph.addStep('B', stepB, ['A'])
    graph.addStep('C', stepC, ['B'])

    try {
      graph.validate()
      expect.fail('Should have thrown')
    } catch (error) {
      const err = error as Error & { cyclePath?: string[] }
      expect(err.cyclePath).toBeDefined()
      expect(err.cyclePath?.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('should validate missing dependencies', () => {
    const graph = new DurableGraph()
    graph.addStep('A', stepA, ['MISSING'])

    expect(() => graph.validate({ strict: true })).toThrow(/missing.*MISSING/i)
  })
})

// ============================================================================
// 3. TopologicalExecutor.run() - Execution in Dependency Order
// ============================================================================

describe('TopologicalExecutor.run()', () => {
  it('should create a TopologicalExecutor from a DurableGraph', () => {
    const builder = WorkflowBuilder.create('exec-test')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    expect(executor).toBeDefined()
    expect(executor).toBeInstanceOf(TopologicalExecutor)
  })

  it('should execute steps in dependency order', async () => {
    const executionOrder: string[] = []

    const builder = WorkflowBuilder.create('order-test')
      .step('A', async () => {
        executionOrder.push('A')
        return { a: 1 }
      })
      .step('B', async () => {
        executionOrder.push('B')
        return { b: 2 }
      })
      .dependsOn('A')
      .step('C', async () => {
        executionOrder.push('C')
        return { c: 3 }
      })
      .dependsOn('B')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({ value: 1 })

    expect(executionOrder).toEqual(['A', 'B', 'C'])
  })

  it('should pass initial input to root steps', async () => {
    let receivedInput: unknown = null

    const builder = WorkflowBuilder.create('input-test').step(
      'root',
      async (input: { value: number }) => {
        receivedInput = input
        return { doubled: input.value * 2 }
      }
    )

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({ value: 42 })

    expect(receivedInput).toEqual({ value: 42 })
  })

  it('should provide step outputs to dependent steps', async () => {
    let stepBInput: unknown = null

    const builder = WorkflowBuilder.create('output-test')
      .step('A', async (input: { value: number }) => {
        return { doubled: input.value * 2 }
      })
      .step('B', async (input: unknown, ctx) => {
        stepBInput = ctx.getStepResult('A')
        return { received: true }
      })
      .dependsOn('A')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({ value: 21 })

    expect(stepBInput).toEqual({ doubled: 42 })
  })

  it('should return all step results', async () => {
    const builder = WorkflowBuilder.create('results-test')
      .step('A', async () => ({ a: 1 }))
      .step('B', async () => ({ b: 2 }))
      .step('C', async () => ({ c: 3 }))

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    const results = await executor.run({})

    expect(results.A).toEqual({ a: 1 })
    expect(results.B).toEqual({ b: 2 })
    expect(results.C).toEqual({ c: 3 })
  })

  it('should work with real Cloudflare Workflows binding', async () => {
    const instance = await getWorkflowInstance('topo-exec-test-1')

    const result = await runWorkflow<{
      executionOrder: string[]
      stepResults: Record<string, unknown>
    }>(instance)

    // A runs first, then B and C in parallel, then D
    expect(result.executionOrder[0]).toBe('A')
    expect(result.executionOrder[result.executionOrder.length - 1]).toBe('D')
  })
})

// ============================================================================
// 4. TopologicalExecutor - Steps with No Dependencies Run in Parallel (Level 0)
// ============================================================================

describe('TopologicalExecutor - parallel root execution', () => {
  it('should run steps with no dependencies in parallel', async () => {
    const startTimes: Record<string, number> = {}

    const builder = WorkflowBuilder.create('parallel-roots')
      .step('A', async () => {
        startTimes.A = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        return { a: 1 }
      })
      .step('B', async () => {
        startTimes.B = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        return { b: 2 }
      })
      .step('C', async () => {
        startTimes.C = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        return { c: 3 }
      })

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    // All should start within 20ms of each other (running in parallel)
    const times = Object.values(startTimes)
    const maxDiff = Math.max(...times) - Math.min(...times)
    expect(maxDiff).toBeLessThan(20)
  })

  it('should complete level 0 before starting level 1', async () => {
    const level0End = { time: 0 }
    const level1Start = { time: Infinity }

    const builder = WorkflowBuilder.create('level-order')
      .step('A', async () => {
        await new Promise((r) => setTimeout(r, 50))
        level0End.time = Math.max(level0End.time, Date.now())
        return { a: 1 }
      })
      .step('B', async () => {
        await new Promise((r) => setTimeout(r, 50))
        level0End.time = Math.max(level0End.time, Date.now())
        return { b: 2 }
      })
      .step('C', async () => {
        level1Start.time = Math.min(level1Start.time, Date.now())
        return { c: 3 }
      })
      .dependsOn('A', 'B')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    // Level 1 should start after level 0 completes
    expect(level1Start.time).toBeGreaterThanOrEqual(level0End.time)
  })

  it('should execute all roots even if some are fast', async () => {
    const executed: string[] = []

    const builder = WorkflowBuilder.create('all-roots')
      .step('fast', async () => {
        executed.push('fast')
        return { fast: true }
      })
      .step('slow', async () => {
        await new Promise((r) => setTimeout(r, 100))
        executed.push('slow')
        return { slow: true }
      })
      .step('medium', async () => {
        await new Promise((r) => setTimeout(r, 50))
        executed.push('medium')
        return { medium: true }
      })

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    expect(executed).toContain('fast')
    expect(executed).toContain('slow')
    expect(executed).toContain('medium')
  })
})

// ============================================================================
// 5. TopologicalExecutor - Steps at Same Level Run in Parallel
// ============================================================================

describe('TopologicalExecutor - parallel level execution', () => {
  it('should run steps at the same level in parallel', async () => {
    const startTimes: Record<string, number> = {}

    const builder = WorkflowBuilder.create('parallel-level')
      .step('root', async () => {
        return { root: true }
      })
      .step('A', async () => {
        startTimes.A = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        return { a: 1 }
      })
      .dependsOn('root')
      .step('B', async () => {
        startTimes.B = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        return { b: 2 }
      })
      .dependsOn('root')
      .step('C', async () => {
        startTimes.C = Date.now()
        await new Promise((r) => setTimeout(r, 50))
        return { c: 3 }
      })
      .dependsOn('root')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    // A, B, C should all start at approximately the same time
    const maxDiff =
      Math.max(startTimes.A, startTimes.B, startTimes.C) -
      Math.min(startTimes.A, startTimes.B, startTimes.C)
    expect(maxDiff).toBeLessThan(20)
  })

  it('should handle diamond dependency pattern correctly', async () => {
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    const executionOrder: string[] = []

    const builder = WorkflowBuilder.create('diamond')
      .step('A', async () => {
        executionOrder.push('A')
        return { a: 1 }
      })
      .step('B', async () => {
        executionOrder.push('B')
        return { b: 2 }
      })
      .dependsOn('A')
      .step('C', async () => {
        executionOrder.push('C')
        return { c: 3 }
      })
      .dependsOn('A')
      .step('D', async () => {
        executionOrder.push('D')
        return { d: 4 }
      })
      .dependsOn('B', 'C')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    // A must be first, D must be last
    expect(executionOrder[0]).toBe('A')
    expect(executionOrder[executionOrder.length - 1]).toBe('D')
    // B and C can be in any order (they run in parallel)
    expect(executionOrder).toContain('B')
    expect(executionOrder).toContain('C')
  })

  it('should provide execution metrics per level', async () => {
    const builder = WorkflowBuilder.create('metrics-test')
      .step('A', async () => {
        await new Promise((r) => setTimeout(r, 30))
        return { a: 1 }
      })
      .step('B', async () => {
        await new Promise((r) => setTimeout(r, 50))
        return { b: 2 }
      })
      .dependsOn('A')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    const result = await executor.run({})

    expect(result._meta).toBeDefined()
    expect(result._meta.levels).toHaveLength(2)
    expect(result._meta.levels[0].duration).toBeGreaterThanOrEqual(30)
    expect(result._meta.levels[1].duration).toBeGreaterThanOrEqual(50)
  })
})

// ============================================================================
// 6. TopologicalExecutor - Step Waits for All Dependencies
// ============================================================================

describe('TopologicalExecutor - dependency waiting', () => {
  it('should wait for all dependencies before executing a step', async () => {
    const completions: string[] = []
    let dStartTime = 0
    let bEndTime = 0
    let cEndTime = 0

    const builder = WorkflowBuilder.create('wait-all')
      .step('A', async () => {
        return { a: 1 }
      })
      .step('B', async () => {
        await new Promise((r) => setTimeout(r, 100))
        bEndTime = Date.now()
        completions.push('B')
        return { b: 2 }
      })
      .dependsOn('A')
      .step('C', async () => {
        await new Promise((r) => setTimeout(r, 50))
        cEndTime = Date.now()
        completions.push('C')
        return { c: 3 }
      })
      .dependsOn('A')
      .step('D', async () => {
        dStartTime = Date.now()
        completions.push('D')
        return { d: 4 }
      })
      .dependsOn('B', 'C')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    // D should start after both B and C complete
    expect(dStartTime).toBeGreaterThanOrEqual(Math.max(bEndTime, cEndTime))
    // D should be after B and C in completions
    expect(completions.indexOf('D')).toBeGreaterThan(completions.indexOf('B'))
    expect(completions.indexOf('D')).toBeGreaterThan(completions.indexOf('C'))
  })

  it('should have access to all dependency outputs', async () => {
    let receivedFromB: unknown = null
    let receivedFromC: unknown = null

    const builder = WorkflowBuilder.create('access-outputs')
      .step('B', async () => ({ fromB: 'B-value' }))
      .step('C', async () => ({ fromC: 'C-value' }))
      .step('D', async (input, ctx) => {
        receivedFromB = ctx.getStepResult('B')
        receivedFromC = ctx.getStepResult('C')
        return { d: true }
      })
      .dependsOn('B', 'C')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    expect(receivedFromB).toEqual({ fromB: 'B-value' })
    expect(receivedFromC).toEqual({ fromC: 'C-value' })
  })

  it('should handle partial dependency completion gracefully', async () => {
    const stepStartTimes: Record<string, number> = {}

    const builder = WorkflowBuilder.create('partial-deps')
      .step('fast', async () => {
        stepStartTimes.fast = Date.now()
        return { fast: true }
      })
      .step('slow', async () => {
        stepStartTimes.slow = Date.now()
        await new Promise((r) => setTimeout(r, 100))
        return { slow: true }
      })
      .step('waiter', async () => {
        stepStartTimes.waiter = Date.now()
        return { waiting: true }
      })
      .dependsOn('fast', 'slow')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    // waiter should not start until slow completes (~100ms after start)
    expect(stepStartTimes.waiter - stepStartTimes.fast).toBeGreaterThanOrEqual(90)
  })
})

// ============================================================================
// 7. TopologicalExecutor - Failed Step Blocks Dependent Steps
// ============================================================================

describe('TopologicalExecutor - failure handling', () => {
  it('should not execute dependent steps when a step fails', async () => {
    const executed: string[] = []

    const builder = WorkflowBuilder.create('failure-blocks')
      .step('A', async () => {
        executed.push('A')
        throw new Error('A failed')
      })
      .step('B', async () => {
        executed.push('B')
        return { b: 2 }
      })
      .dependsOn('A')
      .step('C', async () => {
        executed.push('C')
        return { c: 3 }
      })
      .dependsOn('B')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await expect(executor.run({})).rejects.toThrow('A failed')

    expect(executed).toContain('A')
    expect(executed).not.toContain('B')
    expect(executed).not.toContain('C')
  })

  it('should continue executing unrelated branches on failure', async () => {
    const executed: string[] = []

    const builder = WorkflowBuilder.create('independent-branches')
      .step('root', async () => {
        executed.push('root')
        return { root: true }
      })
      .step('fail-branch', async () => {
        executed.push('fail-branch')
        throw new Error('Branch failed')
      })
      .dependsOn('root')
      .step('success-branch', async () => {
        executed.push('success-branch')
        return { success: true }
      })
      .dependsOn('root')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    expect(executed).toContain('root')
    expect(executed).toContain('success-branch')
    expect(result.errors).toBeDefined()
    expect(result.errors['fail-branch']).toBeDefined()
  })

  it('should track which steps were blocked by failures', async () => {
    const builder = WorkflowBuilder.create('blocked-tracking')
      .step('A', async () => {
        throw new Error('A failed')
      })
      .step('B', async () => ({ b: 2 }))
      .dependsOn('A')
      .step('C', async () => ({ c: 3 }))
      .dependsOn('B')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    expect(result.blocked).toBeDefined()
    expect(result.blocked).toContain('B')
    expect(result.blocked).toContain('C')
  })

  it('should provide error details in execution result', async () => {
    const builder = WorkflowBuilder.create('error-details').step('failing', async () => {
      throw new Error('Detailed error message')
    })

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    expect(result.errors.failing).toBeDefined()
    expect(result.errors.failing.message).toBe('Detailed error message')
  })
})

// ============================================================================
// 8. TopologicalExecutor - Parallel Execution Uses Promise.all
// ============================================================================

describe('TopologicalExecutor - Promise.all for concurrent steps', () => {
  it('should execute same-level steps with Promise.all semantics', async () => {
    const timings: { start: number; end: number }[] = []
    const stepDuration = 50

    const builder = WorkflowBuilder.create('promise-all-test')
      .step('A', async () => {
        const start = Date.now()
        await new Promise((r) => setTimeout(r, stepDuration))
        timings.push({ start, end: Date.now() })
        return { a: 1 }
      })
      .step('B', async () => {
        const start = Date.now()
        await new Promise((r) => setTimeout(r, stepDuration))
        timings.push({ start, end: Date.now() })
        return { b: 2 }
      })
      .step('C', async () => {
        const start = Date.now()
        await new Promise((r) => setTimeout(r, stepDuration))
        timings.push({ start, end: Date.now() })
        return { c: 3 }
      })

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    const startTime = Date.now()
    await executor.run({})
    const totalTime = Date.now() - startTime

    // If running sequentially, would take ~150ms
    // With Promise.all, should take ~50ms (plus overhead)
    expect(totalTime).toBeLessThan(100)
  })

  it('should fail fast when any step in Promise.all fails', async () => {
    const executed: string[] = []

    const builder = WorkflowBuilder.create('fail-fast')
      .step('fast-fail', async () => {
        executed.push('fast-fail-start')
        throw new Error('Fast failure')
      })
      .step('slow', async () => {
        executed.push('slow-start')
        await new Promise((r) => setTimeout(r, 1000))
        executed.push('slow-end')
        return { slow: true }
      })

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await expect(executor.run({})).rejects.toThrow('Fast failure')

    // The slow step should have started but may not complete
    expect(executed).toContain('fast-fail-start')
  })

  it('should collect all results from parallel steps', async () => {
    const builder = WorkflowBuilder.create('collect-results')
      .step('A', async () => ({ result: 'A' }))
      .step('B', async () => ({ result: 'B' }))
      .step('C', async () => ({ result: 'C' }))

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    const results = await executor.run({})

    expect(results.A).toEqual({ result: 'A' })
    expect(results.B).toEqual({ result: 'B' })
    expect(results.C).toEqual({ result: 'C' })
  })
})

// ============================================================================
// 9. TopologicalExecutor - Execution State Persists Across Restarts
// ============================================================================

describe('TopologicalExecutor - state persistence', () => {
  it('should persist completed step results', async () => {
    const instance = await getWorkflowInstance('persist-test-1')

    const result = await runWorkflow<{
      checkpointedSteps: string[]
      allCompleted: boolean
    }>(instance)

    expect(result.checkpointedSteps).toContain('A')
    expect(result.checkpointedSteps).toContain('B')
    expect(result.allCompleted).toBe(true)
  })

  it('should resume from last completed step on restart', async () => {
    const instance = await getWorkflowInstance('resume-test-1')

    const result = await runWorkflow<{
      resumedFromStep: string
      stepsSkipped: string[]
      stepsExecuted: string[]
    }>(instance)

    // If workflow was interrupted after A completed, it should resume from B
    expect(result.stepsSkipped.length).toBeGreaterThan(0)
    expect(result.stepsExecuted).not.toContain(result.stepsSkipped[0])
  })

  it('should not re-execute completed steps on restart', async () => {
    const executionCounts: Record<string, number> = {}

    const builder = WorkflowBuilder.create('no-reexec')
      .step('A', async () => {
        executionCounts.A = (executionCounts.A || 0) + 1
        return { a: 1 }
      })
      .step('B', async () => {
        executionCounts.B = (executionCounts.B || 0) + 1
        return { b: 2 }
      })
      .dependsOn('A')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { enableCheckpoints: true })

    // Simulate execution and checkpoint
    await executor.run({})

    // If A was checkpointed and we restart, A should not run again
    // This test verifies the checkpoint behavior
    expect(executionCounts.A).toBe(1)
  })

  it('should provide state snapshot for inspection', async () => {
    const builder = WorkflowBuilder.create('snapshot-test')
      .step('A', async () => ({ a: 1 }))
      .step('B', async () => ({ b: 2 }))
      .dependsOn('A')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    await executor.run({})

    const snapshot = executor.getStateSnapshot()

    expect(snapshot).toBeDefined()
    expect(snapshot.completedSteps).toContain('A')
    expect(snapshot.completedSteps).toContain('B')
    expect(snapshot.results.A).toEqual({ a: 1 })
    expect(snapshot.results.B).toEqual({ b: 2 })
  })
})

// ============================================================================
// 10. TopologicalExecutor - Partial Failures Allow Successful Branches
// ============================================================================

describe('TopologicalExecutor - partial failure handling', () => {
  it('should continue successful branches when continueOnError is enabled', async () => {
    const executed: string[] = []

    const builder = WorkflowBuilder.create('partial-failure')
      .step('root', async () => {
        executed.push('root')
        return { root: true }
      })
      .step('left-fail', async () => {
        executed.push('left-fail')
        throw new Error('Left failed')
      })
      .dependsOn('root')
      .step('left-child', async () => {
        executed.push('left-child')
        return { leftChild: true }
      })
      .dependsOn('left-fail')
      .step('right-success', async () => {
        executed.push('right-success')
        return { right: true }
      })
      .dependsOn('root')
      .step('right-child', async () => {
        executed.push('right-child')
        return { rightChild: true }
      })
      .dependsOn('right-success')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    // Left branch should fail, right branch should succeed
    expect(executed).toContain('root')
    expect(executed).toContain('left-fail')
    expect(executed).not.toContain('left-child')
    expect(executed).toContain('right-success')
    expect(executed).toContain('right-child')

    expect(result.partialResults).toBeDefined()
    expect(result.partialResults.right_success).toBeDefined()
    expect(result.partialResults.right_child).toBeDefined()
  })

  it('should report partial success with failed branches', async () => {
    const builder = WorkflowBuilder.create('mixed-results')
      .step('success1', async () => ({ s1: true }))
      .step('fail1', async () => {
        throw new Error('Fail 1')
      })
      .step('success2', async () => ({ s2: true }))

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    expect(result.status).toBe('partial')
    expect(result.succeeded).toContain('success1')
    expect(result.succeeded).toContain('success2')
    expect(result.failed).toContain('fail1')
  })

  it('should provide partial results even when some branches fail', async () => {
    const builder = WorkflowBuilder.create('partial-results')
      .step('A', async () => ({ a: 'success' }))
      .step('B', async () => {
        throw new Error('B failed')
      })
      .step('C', async () => ({ c: 'success' }))

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    expect(result.A).toEqual({ a: 'success' })
    expect(result.C).toEqual({ c: 'success' })
    expect(result.B).toBeUndefined()
    expect(result.errors.B).toBeDefined()
  })

  it('should track dependency chains affected by failures', async () => {
    const builder = WorkflowBuilder.create('chain-tracking')
      .step('root', async () => ({ root: true }))
      .step('middle', async () => {
        throw new Error('Middle failed')
      })
      .dependsOn('root')
      .step('leaf1', async () => ({ leaf1: true }))
      .dependsOn('middle')
      .step('leaf2', async () => ({ leaf2: true }))
      .dependsOn('middle')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph, { continueOnError: true })

    const result = await executor.run({})

    expect(result.affectedChains).toBeDefined()
    expect(result.affectedChains).toContainEqual(['root', 'middle', 'leaf1'])
    expect(result.affectedChains).toContainEqual(['root', 'middle', 'leaf2'])
  })
})

// ============================================================================
// 11. TopologicalExecutor - Execution Plan and Introspection
// ============================================================================

describe('TopologicalExecutor - execution plan', () => {
  it('should provide execution plan before running', () => {
    const builder = WorkflowBuilder.create('plan-test')
      .step('A', stepA)
      .step('B', stepB)
      .dependsOn('A')
      .step('C', stepC)
      .dependsOn('A')
      .step('D', stepD)
      .dependsOn('B', 'C')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    const plan = executor.getExecutionPlan()

    expect(plan.levels).toHaveLength(3)
    expect(plan.levels[0].steps).toContain('A')
    expect(plan.levels[1].steps).toContain('B')
    expect(plan.levels[1].steps).toContain('C')
    expect(plan.levels[2].steps).toContain('D')
  })

  it('should provide total step count', () => {
    const builder = WorkflowBuilder.create('count-test')
      .step('A', stepA)
      .step('B', stepB)
      .step('C', stepC)

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    expect(executor.getStepCount()).toBe(3)
  })

  it('should provide maximum parallelism level', () => {
    const builder = WorkflowBuilder.create('parallelism-test')
      .step('root', async () => ({ root: true }))
      .step('A', stepA)
      .dependsOn('root')
      .step('B', stepB)
      .dependsOn('root')
      .step('C', stepC)
      .dependsOn('root')
      .step('D', stepD)
      .dependsOn('A', 'B', 'C')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    // Level 1 has 3 parallel steps (A, B, C)
    expect(executor.getMaxParallelism()).toBe(3)
  })

  it('should provide critical path information', () => {
    const builder = WorkflowBuilder.create('critical-path')
      .step('A', stepA) // Level 0
      .step('B', stepB) // Level 0
      .step('C', stepC) // Level 1
      .dependsOn('A')
      .step('D', stepD) // Level 2
      .dependsOn('C')

    const graph = DurableGraph.fromBuilder(builder)
    const executor = new TopologicalExecutor(graph)

    const criticalPath = executor.getCriticalPath()

    // Longest path: A -> C -> D (3 levels)
    expect(criticalPath).toEqual(['A', 'C', 'D'])
  })
})

// ============================================================================
// 12. Integration with Real Cloudflare Workflows
// ============================================================================

describe('TopologicalExecutor with Real Cloudflare Workflows', () => {
  it('should execute graph via real workflow binding', async () => {
    const instance = await getWorkflowInstance('real-workflow-exec-1')

    const result = await runWorkflow<{
      finalResult: unknown
      executionComplete: boolean
    }>(instance)

    expect(result.executionComplete).toBe(true)
    expect(result.finalResult).toBeDefined()
  })

  it('should maintain durability guarantees across restarts', async () => {
    const instance = await getWorkflowInstance('durability-test-1')

    const result = await runWorkflow<{
      checkpoints: number
      recoveredState: boolean
    }>(instance)

    expect(result.checkpoints).toBeGreaterThan(0)
    expect(result.recoveredState).toBe(true)
  })

  it('should integrate with DurableStep for individual step durability', async () => {
    const instance = await getWorkflowInstance('durable-step-integration-1')

    const result = await runWorkflow<{
      stepsDurable: boolean
      allStepsCheckpointed: boolean
    }>(instance)

    expect(result.stepsDurable).toBe(true)
    expect(result.allStepsCheckpointed).toBe(true)
  })
})

// ============================================================================
// 13. Type Definitions (Compile-time)
// ============================================================================

describe('TopologicalExecutor types', () => {
  it('should define ExecutionPlan type', () => {
    const plan: ExecutionPlan = {
      levels: [
        { level: 0, steps: ['A', 'B'] },
        { level: 1, steps: ['C'] },
      ],
      totalSteps: 3,
      maxParallelism: 2,
      criticalPath: ['A', 'C'],
    }

    expect(plan.levels).toHaveLength(2)
  })

  it('should define ExecutionResult type', () => {
    const result: ExecutionResult<{
      A: { a: number }
      B: { b: number }
    }> = {
      A: { a: 1 },
      B: { b: 2 },
      _meta: {
        levels: [{ level: 0, duration: 50, steps: ['A', 'B'] }],
        totalDuration: 50,
        status: 'complete',
      },
    }

    expect(result.A.a).toBe(1)
    expect(result._meta.status).toBe('complete')
  })

  it('should define StepExecutionResult type', () => {
    const stepResult: StepExecutionResult = {
      stepId: 'A',
      status: 'complete',
      result: { value: 42 },
      startTime: Date.now() - 100,
      endTime: Date.now(),
      duration: 100,
    }

    expect(stepResult.status).toBe('complete')
    expect(stepResult.duration).toBe(100)
  })
})
