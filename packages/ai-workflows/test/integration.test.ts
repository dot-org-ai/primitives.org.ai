/**
 * Integration tests for ai-workflows package
 *
 * Tests the workflow, event handling, scheduling, and coordination primitives.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  Workflow,
  createTestContext,
  parseEvent,
  on,
  every,
  send,
  getEventBus,
  registerEventHandler,
  getEventHandlers,
  clearEventHandlers,
  registerScheduleHandler,
  getScheduleHandlers,
  clearScheduleHandlers,
  createWorkflowContext,
  createIsolatedContext,
  createCascadeContext,
  recordStep,
  DependencyGraph,
  CircularDependencyError,
  MissingDependencyError,
  topologicalSort,
  getExecutionLevels,
  Barrier,
  createBarrier,
  waitForAll,
  waitForAny,
  withConcurrencyLimit,
  CascadeExecutor,
  workflow,
  WorkflowBuilder,
  WorkflowStateAdapter,
  type WorkflowInstance,
  type CascadeContext,
} from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('ai-workflows exports', () => {
  it('should export Workflow', () => {
    expect(Workflow).toBeDefined()
    expect(typeof Workflow).toBe('function')
  })

  it('should export event handling functions', () => {
    expect(on).toBeDefined()
    expect(registerEventHandler).toBeDefined()
    expect(getEventHandlers).toBeDefined()
    expect(clearEventHandlers).toBeDefined()
  })

  it('should export scheduling functions', () => {
    expect(every).toBeDefined()
    expect(registerScheduleHandler).toBeDefined()
    expect(getScheduleHandlers).toBeDefined()
    expect(clearScheduleHandlers).toBeDefined()
  })

  it('should export event emission', () => {
    expect(send).toBeDefined()
    expect(getEventBus).toBeDefined()
  })

  it('should export context utilities', () => {
    expect(createWorkflowContext).toBeDefined()
    expect(createIsolatedContext).toBeDefined()
    expect(createTestContext).toBeDefined()
  })

  it('should export cascade context', () => {
    expect(createCascadeContext).toBeDefined()
    expect(recordStep).toBeDefined()
  })

  it('should export dependency graph', () => {
    expect(DependencyGraph).toBeDefined()
    expect(CircularDependencyError).toBeDefined()
    expect(MissingDependencyError).toBeDefined()
  })

  it('should export topological sort', () => {
    expect(topologicalSort).toBeDefined()
    expect(getExecutionLevels).toBeDefined()
  })

  it('should export barrier utilities', () => {
    expect(Barrier).toBeDefined()
    expect(createBarrier).toBeDefined()
    expect(waitForAll).toBeDefined()
    expect(waitForAny).toBeDefined()
    expect(withConcurrencyLimit).toBeDefined()
  })

  it('should export cascade executor', () => {
    expect(CascadeExecutor).toBeDefined()
  })

  it('should export workflow builder', () => {
    expect(workflow).toBeDefined()
    expect(WorkflowBuilder).toBeDefined()
  })

  it('should export state adapter', () => {
    expect(WorkflowStateAdapter).toBeDefined()
  })
})

describe('Workflow creation', () => {
  let workflowInstance: WorkflowInstance

  afterEach(async () => {
    if (workflowInstance) {
      await workflowInstance.destroy()
    }
  })

  it('should create a basic workflow', () => {
    workflowInstance = Workflow(($) => {
      // Empty workflow
    })

    expect(workflowInstance).toBeDefined()
    expect(workflowInstance.definition).toBeDefined()
    expect(workflowInstance.state).toBeDefined()
    expect(workflowInstance.$).toBeDefined()
  })

  it('should register event handlers', () => {
    workflowInstance = Workflow(($) => {
      $.on.Customer.created(async (data, $) => {
        // handler
      })

      $.on.Order.completed(async (data, $) => {
        // handler
      })
    })

    expect(workflowInstance.definition.events.length).toBe(2)
  })
})

describe('Event parsing', () => {
  it('should parse valid event strings', () => {
    const result = parseEvent('Customer.created')
    expect(result).toEqual({ noun: 'Customer', event: 'created' })
  })

  it('should parse different event names', () => {
    expect(parseEvent('Order.completed')).toEqual({ noun: 'Order', event: 'completed' })
    expect(parseEvent('User.updated')).toEqual({ noun: 'User', event: 'updated' })
    expect(parseEvent('Payment.failed')).toEqual({ noun: 'Payment', event: 'failed' })
  })

  it('should return null for invalid event strings', () => {
    expect(parseEvent('invalid')).toBeNull()
    expect(parseEvent('')).toBeNull()
    expect(parseEvent('too.many.parts')).toBeNull()
  })
})

describe('DependencyGraph', () => {
  it('should add nodes', () => {
    const graph = new DependencyGraph()

    graph.addNode('a')
    graph.addNode('b')
    graph.addNode('c')

    expect(graph.hasNode('a')).toBe(true)
    expect(graph.hasNode('b')).toBe(true)
    expect(graph.hasNode('c')).toBe(true)
    expect(graph.hasNode('d')).toBe(false)
  })

  it('should add edges (dependencies)', () => {
    const graph = new DependencyGraph()

    graph.addNode('a')
    graph.addNode('b')
    graph.addEdge('a', 'b') // b depends on a

    expect(graph.getDependencies('b')).toContain('a')
    expect(graph.getDependents('a')).toContain('b')
  })

  it('should detect circular dependencies', () => {
    const graph = new DependencyGraph()

    graph.addNode('a')
    graph.addNode('b')
    graph.addNode('c')

    graph.addEdge('a', 'b')
    graph.addEdge('b', 'c')

    expect(() => graph.addEdge('c', 'a')).toThrow(CircularDependencyError)
  })

  it('should get parallel execution groups', () => {
    const graph = new DependencyGraph()

    graph.addNode('a')
    graph.addNode('b')
    graph.addNode('c')
    graph.addNode('d')

    graph.addEdge('a', 'c')
    graph.addEdge('b', 'c')
    graph.addEdge('c', 'd')

    const groups = graph.getParallelGroups()

    // First group (level 0): a, b (no dependencies)
    expect(groups.length).toBeGreaterThanOrEqual(2)
    expect(groups[0].nodes).toContain('a')
    expect(groups[0].nodes).toContain('b')
    expect(groups[0].level).toBe(0)
  })
})

describe('Topological Sort', () => {
  it('should sort nodes in dependency order', () => {
    const nodes = [
      { id: 'a', dependencies: [] },
      { id: 'b', dependencies: [] },
      { id: 'c', dependencies: ['a', 'b'] },
      { id: 'd', dependencies: ['c'] },
    ]

    const result = topologicalSort(nodes)
    const sorted = result.order

    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('c'))
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'))
    expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('d'))
    expect(result.hasCycle).toBe(false)
  })

  it('should get execution levels', () => {
    const nodes = [
      { id: 'a', dependencies: [] },
      { id: 'b', dependencies: [] },
      { id: 'c', dependencies: ['a', 'b'] },
      { id: 'd', dependencies: ['c'] },
    ]

    const levels = getExecutionLevels(nodes)

    // Level 0: a, b
    // Level 1: c
    // Level 2: d
    expect(levels.length).toBe(3)
    expect(levels[0].nodes).toContain('a')
    expect(levels[0].nodes).toContain('b')
    expect(levels[1].nodes).toContain('c')
    expect(levels[2].nodes).toContain('d')
  })
})

describe('Barrier', () => {
  it('should wait for all promises', async () => {
    const results = await waitForAll([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)])

    expect(results).toEqual([1, 2, 3])
  })

  it('should limit concurrency', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 50))
      concurrent--
      return i
    })

    const results = await withConcurrencyLimit(tasks, 3)

    expect(results.length).toBe(10)
    expect(maxConcurrent).toBeLessThanOrEqual(3)
  })
})

describe('Cascade Context', () => {
  it('should create cascade context with correlation ID', () => {
    const ctx = createCascadeContext({
      correlationId: 'corr-123',
    })

    expect(ctx).toBeDefined()
    expect(ctx.correlationId).toBe('corr-123')
  })

  it('should record steps in cascade context', () => {
    const ctx = createCascadeContext({
      correlationId: 'corr-456',
    })

    // recordStep takes (ctx, name, metadata?) and returns a step
    const step1 = recordStep(ctx, 'step1')
    step1.complete()

    const step2 = recordStep(ctx, 'step2')
    step2.complete()

    expect(ctx.steps.length).toBe(2)
    expect(ctx.steps[0].name).toBe('step1')
    expect(ctx.steps[1].name).toBe('step2')
    expect(ctx.steps[0].status).toBe('completed')
  })
})

describe('CascadeExecutor', () => {
  it('should execute code tier first', async () => {
    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => 'code result',
        },
      },
    })

    const result = await executor.execute('test input')

    // Result doesn't have 'success' - it returns value on success or throws
    expect(result.tier).toBe('code')
    expect(result.value).toBe('code result')
    expect(result.history).toBeDefined()
  })

  it('should cascade to next tier on failure', async () => {
    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => {
            throw new Error('Code failed')
          },
        },
        generative: {
          name: 'generative-handler',
          execute: async () => 'generative result',
        },
      },
      timeouts: {
        code: 100,
        generative: 5000,
      },
    })

    const result = await executor.execute('test input')

    expect(result.tier).toBe('generative')
    expect(result.value).toBe('generative result')
  })

  it('should track execution history', async () => {
    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => {
            throw new Error('Code failed')
          },
        },
        generative: {
          name: 'generative-handler',
          execute: async () => 'ok',
        },
      },
    })

    const result = await executor.execute('test')

    expect(result.history.length).toBeGreaterThan(0)
    expect(result.tier).toBe('generative')
  })
})

describe('WorkflowBuilder DSL', () => {
  it('should create workflow with builder', () => {
    const wf = workflow('test-workflow')
      .step('step1', async () => ({ value: 1 }))
      .step('step2', async () => ({ value: 2 }))
      .build()

    expect(wf).toBeDefined()
    expect(wf.name).toBe('test-workflow')
    expect(wf.steps.length).toBe(2)
  })

  it('should support conditional steps', () => {
    const wf = workflow('conditional-workflow')
      .step('check', async () => ({ shouldContinue: true }))
      .when((ctx) => ctx.result?.check?.shouldContinue === true)
      .then(workflow('continue-flow').step('continue', async () => ({ continued: true })))
      .build()

    expect(wf).toBeDefined()
    expect(wf.steps.length).toBe(2)
    expect(wf.steps[1].type).toBe('conditional')
  })

  it('should support timeout configuration', () => {
    const wf = workflow('timeout-workflow')
      .step('slow', async () => ({ done: true }))
      .timeout(5000)
      .build()

    expect(wf).toBeDefined()
  })
})

describe('WorkflowStateAdapter exports', () => {
  it('should export WorkflowStateAdapter class', () => {
    // WorkflowStateAdapter requires a database connection
    expect(WorkflowStateAdapter).toBeDefined()
    expect(typeof WorkflowStateAdapter).toBe('function')
  })
})

describe('Error handling', () => {
  it('should handle missing dependencies gracefully', () => {
    const graph = new DependencyGraph()

    graph.addNode('a')

    expect(() => graph.addEdge('a', 'nonexistent')).toThrow(MissingDependencyError)
  })
})
