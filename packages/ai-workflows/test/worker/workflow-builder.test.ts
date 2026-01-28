/**
 * WorkflowBuilder DSL Tests (RED Phase)
 *
 * Tests for WorkflowBuilder - a declarative DSL for building durable workflows
 * using a fluent builder pattern with step dependencies, event triggers,
 * and scheduled execution.
 *
 * These tests define the expected behavior for WorkflowBuilder DSL before implementation.
 * All tests SHOULD FAIL because WorkflowBuilder does not exist yet.
 *
 * Uses @cloudflare/vitest-pool-workers - NO MOCKS.
 * Tests run against real Cloudflare Workflows bindings.
 *
 * Bead: aip-llm1
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'

// ============================================================================
// These imports will FAIL because WorkflowBuilder does not exist yet.
// This is the RED phase of TDD.
// ============================================================================
import {
  WorkflowBuilder,
  type WorkflowBuilderConfig,
  type StepDefinition,
  type StepChain,
  type TriggerConfig,
  type ScheduleConfig,
  type BuiltWorkflow,
} from '../../src/worker/workflow-builder.js'

// Import DurableStep for use in step definitions
import { DurableStep, type StepConfig } from '../../src/worker/durable-step.js'

// Import WorkflowService for integration tests
import { WorkflowServiceCore } from '../../src/worker.js'

// ============================================================================
// Type Definitions for Test Environment
// ============================================================================

interface TestEnv {
  WORKFLOW: Workflow
}

// ============================================================================
// Test Data - Sample Step Functions
// ============================================================================

const validateOrder = async (input: { orderId: string }) => {
  return { valid: true, orderId: input.orderId }
}

const chargePayment = async (input: { orderId: string; amount: number }) => {
  return { charged: true, transactionId: `txn_${input.orderId}` }
}

const fulfillOrder = async (input: { orderId: string; transactionId: string }) => {
  return { fulfilled: true, trackingNumber: `track_${input.orderId}` }
}

const sendNotification = async (input: { to: string; message: string }) => {
  return { sent: true }
}

const cleanupData = async () => {
  return { cleaned: true }
}

// ============================================================================
// 1. WorkflowBuilder.create() - Creating Workflow Definitions
// ============================================================================

describe('WorkflowBuilder.create()', () => {
  it('creates a new workflow builder with a name', () => {
    const builder = WorkflowBuilder.create('order-process')

    expect(builder).toBeDefined()
    expect(builder.name).toBe('order-process')
  })

  it('creates a new workflow builder with name and config', () => {
    const builder = WorkflowBuilder.create('payment-flow', {
      description: 'Handles payment processing',
      version: '1.0.0',
    })

    expect(builder).toBeDefined()
    expect(builder.name).toBe('payment-flow')
    expect(builder.config?.description).toBe('Handles payment processing')
    expect(builder.config?.version).toBe('1.0.0')
  })

  it('returns a WorkflowBuilder instance', () => {
    const builder = WorkflowBuilder.create('test-workflow')

    // Should be an instance of WorkflowBuilder
    expect(builder).toBeInstanceOf(WorkflowBuilder)
  })

  it('allows method chaining', () => {
    // The builder pattern should support fluent method chaining
    const builder = WorkflowBuilder.create('chainable-workflow')

    // step() should return something chainable
    expect(typeof builder.step).toBe('function')
  })

  it('validates workflow name is provided', () => {
    // Empty name should throw
    expect(() => WorkflowBuilder.create('')).toThrow()
  })

  it('accepts optional timeout configuration', () => {
    const builder = WorkflowBuilder.create('timed-workflow', {
      timeout: '5 minutes',
    })

    expect(builder.config?.timeout).toBe('5 minutes')
  })

  it('accepts optional retry configuration', () => {
    const builder = WorkflowBuilder.create('retry-workflow', {
      retries: {
        limit: 3,
        delay: '1 second',
        backoff: 'exponential',
      },
    })

    expect(builder.config?.retries?.limit).toBe(3)
  })
})

// ============================================================================
// 2. WorkflowBuilder.step() - Adding Durable Steps
// ============================================================================

describe('WorkflowBuilder.step()', () => {
  let builder: ReturnType<typeof WorkflowBuilder.create>

  beforeEach(() => {
    builder = WorkflowBuilder.create('test-workflow')
  })

  it('adds a step with name and function', () => {
    const result = builder.step('validate', validateOrder)

    expect(result).toBeDefined()
    // Should return something with dependsOn for chaining
    expect(typeof result.dependsOn).toBe('function')
  })

  it('adds a step with name, config, and function', () => {
    const result = builder.step(
      'charge',
      {
        retries: { limit: 3, delay: '1 second' },
        timeout: '30 seconds',
      },
      chargePayment
    )

    expect(result).toBeDefined()
  })

  it('adds a step from a DurableStep instance', () => {
    const durableStep = new DurableStep('fulfill', fulfillOrder)

    const result = builder.step(durableStep)

    expect(result).toBeDefined()
  })

  it('allows multiple steps to be added', () => {
    builder.step('step1', validateOrder)
    builder.step('step2', chargePayment)
    const result = builder.step('step3', fulfillOrder)

    expect(result).toBeDefined()
    // After build, should have all 3 steps
  })

  it('preserves step order', () => {
    builder.step('first', validateOrder)
    builder.step('second', chargePayment)
    builder.step('third', fulfillOrder)

    const workflow = builder.build()

    expect(workflow.steps).toHaveLength(3)
    expect(workflow.steps[0]?.name).toBe('first')
    expect(workflow.steps[1]?.name).toBe('second')
    expect(workflow.steps[2]?.name).toBe('third')
  })

  it('rejects duplicate step names', () => {
    builder.step('unique', validateOrder)

    expect(() => builder.step('unique', chargePayment)).toThrow()
  })

  it('returns a StepChain for further configuration', () => {
    const stepChain = builder.step('configurable', validateOrder)

    // StepChain should have dependsOn, timeout, retries methods
    expect(typeof stepChain.dependsOn).toBe('function')
    expect(typeof stepChain.timeout).toBe('function')
    expect(typeof stepChain.retries).toBe('function')
  })

  it('step chain allows setting timeout', () => {
    const stepChain = builder.step('timed-step', validateOrder).timeout('30 seconds')

    expect(stepChain).toBeDefined()
  })

  it('step chain allows setting retries', () => {
    const stepChain = builder
      .step('retry-step', validateOrder)
      .retries({ limit: 3, delay: '1 second', backoff: 'exponential' })

    expect(stepChain).toBeDefined()
  })
})

// ============================================================================
// 3. WorkflowBuilder.step().dependsOn() - Declaring Dependencies
// ============================================================================

describe('WorkflowBuilder.step().dependsOn()', () => {
  let builder: ReturnType<typeof WorkflowBuilder.create>

  beforeEach(() => {
    builder = WorkflowBuilder.create('dependency-workflow')
  })

  it('declares a single dependency', () => {
    builder.step('validate', validateOrder)
    const result = builder.step('charge', chargePayment).dependsOn('validate')

    expect(result).toBeDefined()
  })

  it('declares multiple dependencies', () => {
    builder.step('validate', validateOrder)
    builder.step('check-inventory', async () => ({ available: true }))
    const result = builder.step('charge', chargePayment).dependsOn('validate', 'check-inventory')

    expect(result).toBeDefined()
  })

  it('declares dependencies with array syntax', () => {
    builder.step('validate', validateOrder)
    builder.step('check-inventory', async () => ({ available: true }))
    const result = builder.step('charge', chargePayment).dependsOn(['validate', 'check-inventory'])

    expect(result).toBeDefined()
  })

  it('chains multiple dependsOn calls', () => {
    builder.step('step1', validateOrder)
    builder.step('step2', async () => ({ done: true }))
    const result = builder.step('step3', chargePayment).dependsOn('step1').dependsOn('step2')

    expect(result).toBeDefined()
  })

  it('validates that dependencies exist', () => {
    // Referencing non-existent step should throw on build
    builder.step('charge', chargePayment).dependsOn('non-existent')

    expect(() => builder.build()).toThrow(/dependency.*non-existent.*not found/i)
  })

  it('detects circular dependencies on build', () => {
    // This creates a cycle: A -> B -> A
    builder.step('stepA', validateOrder).dependsOn('stepB')
    builder.step('stepB', chargePayment).dependsOn('stepA')

    expect(() => builder.build()).toThrow(/circular dependency/i)
  })

  it('allows soft dependencies (can proceed on failure)', () => {
    builder.step('validate', validateOrder)
    const result = builder.step('charge', chargePayment).dependsOn('validate', { type: 'soft' })

    expect(result).toBeDefined()
  })

  it('dependency options include wait timeout', () => {
    builder.step('validate', validateOrder)
    const result = builder
      .step('charge', chargePayment)
      .dependsOn('validate', { timeout: '5 minutes' })

    expect(result).toBeDefined()
  })

  it('supports step chain continuation after dependsOn', () => {
    builder.step('validate', validateOrder)

    // dependsOn should return builder for continuation
    const result = builder
      .step('charge', chargePayment)
      .dependsOn('validate')
      .step('fulfill', fulfillOrder)
      .dependsOn('charge')

    expect(result).toBeDefined()
  })
})

// ============================================================================
// 4. WorkflowBuilder.on() - Event-Triggered Steps
// ============================================================================

describe('WorkflowBuilder.on()', () => {
  let builder: ReturnType<typeof WorkflowBuilder.create>

  beforeEach(() => {
    builder = WorkflowBuilder.create('event-workflow')
  })

  it('registers an event trigger with .do()', () => {
    builder.step('validate', validateOrder)
    const result = builder.on('Order.placed').do('validate')

    expect(result).toBeDefined()
  })

  it('registers event trigger for step with inline function', () => {
    const result = builder.on('Order.placed').do(async (event: { orderId: string }) => {
      return { processed: true, orderId: event.orderId }
    })

    expect(result).toBeDefined()
  })

  it('event names follow Noun.event format', () => {
    builder.step('handle', validateOrder)
    const result = builder.on('Customer.created').do('handle')

    expect(result).toBeDefined()
  })

  it('validates event name format', () => {
    builder.step('handle', validateOrder)

    // Invalid event name should throw
    expect(() => builder.on('invalid-event-name').do('handle')).toThrow()
  })

  it('multiple events can trigger the same step', () => {
    builder.step('notify', sendNotification)
    builder.on('Order.placed').do('notify')
    const result = builder.on('Order.shipped').do('notify')

    expect(result).toBeDefined()
  })

  it('same event can trigger multiple steps', () => {
    builder.step('validate', validateOrder)
    builder.step('notify', sendNotification)
    builder.on('Order.placed').do('validate')
    const result = builder.on('Order.placed').do('notify')

    expect(result).toBeDefined()
  })

  it('returns trigger chain for configuration', () => {
    builder.step('validate', validateOrder)
    const chain = builder.on('Order.placed')

    expect(typeof chain.do).toBe('function')
    expect(typeof chain.filter).toBe('function')
  })

  it('supports event filtering', () => {
    builder.step('validate', validateOrder)
    const result = builder
      .on('Order.placed')
      .filter((event) => event.amount > 100)
      .do('validate')

    expect(result).toBeDefined()
  })

  it('validates that step exists when using string reference', () => {
    // Reference to non-existent step should throw on build
    builder.on('Order.placed').do('non-existent-step')

    expect(() => builder.build()).toThrow(/step.*non-existent-step.*not found/i)
  })

  it('on() creates implicit step when given inline function', () => {
    builder.on('Order.placed').do(async (event: { orderId: string }) => {
      return { processed: true }
    })

    const workflow = builder.build()

    // Should have created an implicit step
    expect(workflow.steps.length).toBeGreaterThanOrEqual(1)
  })

  it('supports typed event payloads', () => {
    interface OrderPlacedEvent {
      orderId: string
      amount: number
      customerId: string
    }

    const result = builder.on<OrderPlacedEvent>('Order.placed').do(async (event) => {
      // TypeScript should know event has orderId, amount, customerId
      return { processed: true, orderId: event.orderId }
    })

    expect(result).toBeDefined()
  })
})

// ============================================================================
// 5. WorkflowBuilder.every() - Scheduled Steps
// ============================================================================

describe('WorkflowBuilder.every()', () => {
  let builder: ReturnType<typeof WorkflowBuilder.create>

  beforeEach(() => {
    builder = WorkflowBuilder.create('scheduled-workflow')
  })

  it('registers a scheduled trigger with .do()', () => {
    builder.step('cleanup', cleanupData)
    const result = builder.every('hour').do('cleanup')

    expect(result).toBeDefined()
  })

  it('supports common schedule intervals', () => {
    builder.step('task', cleanupData)

    // All these should work
    expect(() => builder.every('minute').do('task')).not.toThrow()
    expect(() => builder.every('hour').do('task')).not.toThrow()
    expect(() => builder.every('day').do('task')).not.toThrow()
    expect(() => builder.every('week').do('task')).not.toThrow()
  })

  it('supports day-of-week schedules', () => {
    builder.step('report', cleanupData)
    const result = builder.every('Monday').do('report')

    expect(result).toBeDefined()
  })

  it('supports day-of-week with time', () => {
    builder.step('report', cleanupData)
    const result = builder.every('Monday').at('9am').do('report')

    expect(result).toBeDefined()
  })

  it('supports interval with value', () => {
    builder.step('check', cleanupData)
    const result = builder.every(5).minutes().do('check')

    expect(result).toBeDefined()
  })

  it('supports natural language schedules', () => {
    builder.step('report', cleanupData)
    const result = builder.every('first Monday of the month').do('report')

    expect(result).toBeDefined()
  })

  it('supports cron expressions', () => {
    builder.step('task', cleanupData)
    const result = builder.every('0 9 * * 1').do('task') // Every Monday at 9am

    expect(result).toBeDefined()
  })

  it('supports inline functions', () => {
    const result = builder.every('hour').do(async () => {
      return { completed: true }
    })

    expect(result).toBeDefined()
  })

  it('validates that step exists when using string reference', () => {
    builder.every('hour').do('non-existent-step')

    expect(() => builder.build()).toThrow(/step.*non-existent-step.*not found/i)
  })

  it('returns schedule chain for configuration', () => {
    builder.step('task', cleanupData)
    const chain = builder.every('hour')

    expect(typeof chain.do).toBe('function')
    expect(typeof chain.at).toBe('function')
  })

  it('supports timezone configuration', () => {
    builder.step('report', cleanupData)
    const result = builder.every('day').at('9am').timezone('America/New_York').do('report')

    expect(result).toBeDefined()
  })
})

// ============================================================================
// 6. WorkflowBuilder.build() - Building the Workflow
// ============================================================================

describe('WorkflowBuilder.build()', () => {
  let builder: ReturnType<typeof WorkflowBuilder.create>

  beforeEach(() => {
    builder = WorkflowBuilder.create('buildable-workflow')
  })

  it('returns a BuiltWorkflow object', () => {
    builder.step('validate', validateOrder)
    const workflow = builder.build()

    expect(workflow).toBeDefined()
    expect(workflow.name).toBe('buildable-workflow')
  })

  it('built workflow contains all registered steps', () => {
    builder.step('step1', validateOrder)
    builder.step('step2', chargePayment)
    builder.step('step3', fulfillOrder)

    const workflow = builder.build()

    expect(workflow.steps).toHaveLength(3)
  })

  it('built workflow contains event triggers', () => {
    builder.step('validate', validateOrder)
    builder.on('Order.placed').do('validate')

    const workflow = builder.build()

    expect(workflow.triggers).toBeDefined()
    expect(workflow.triggers.events).toHaveLength(1)
    expect(workflow.triggers.events[0]?.event).toBe('Order.placed')
  })

  it('built workflow contains schedule triggers', () => {
    builder.step('cleanup', cleanupData)
    builder.every('hour').do('cleanup')

    const workflow = builder.build()

    expect(workflow.triggers).toBeDefined()
    expect(workflow.triggers.schedules).toHaveLength(1)
  })

  it('built workflow includes dependency graph', () => {
    builder.step('validate', validateOrder)
    builder.step('charge', chargePayment).dependsOn('validate')
    builder.step('fulfill', fulfillOrder).dependsOn('charge')

    const workflow = builder.build()

    expect(workflow.dependencyGraph).toBeDefined()
    expect(workflow.dependencyGraph.get('charge')).toContain('validate')
    expect(workflow.dependencyGraph.get('fulfill')).toContain('charge')
  })

  it('built workflow provides execution order', () => {
    builder.step('validate', validateOrder)
    builder.step('charge', chargePayment).dependsOn('validate')
    builder.step('fulfill', fulfillOrder).dependsOn('charge')

    const workflow = builder.build()

    // Should provide topologically sorted execution order
    expect(workflow.executionOrder).toEqual(['validate', 'charge', 'fulfill'])
  })

  it('built workflow is executable', () => {
    builder.step('validate', validateOrder)
    const workflow = builder.build()

    // Should have an execute method
    expect(typeof workflow.execute).toBe('function')
  })

  it('build validates the workflow definition', () => {
    // Empty workflow with no steps should be valid (entry point can be event)
    builder.on('Order.placed').do(async () => ({ done: true }))

    expect(() => builder.build()).not.toThrow()
  })

  it('build throws on invalid workflow', () => {
    // Referencing non-existent step in dependency
    builder.step('validate', validateOrder).dependsOn('missing')

    expect(() => builder.build()).toThrow()
  })

  it('returns immutable workflow definition', () => {
    builder.step('validate', validateOrder)
    const workflow = builder.build()

    // Modifying the builder after build should not affect built workflow
    builder.step('extra', chargePayment)
    const newWorkflow = builder.build()

    expect(workflow.steps).toHaveLength(1)
    expect(newWorkflow.steps).toHaveLength(2)
  })

  it('build includes workflow metadata', () => {
    const builder = WorkflowBuilder.create('metadata-workflow', {
      description: 'Test workflow',
      version: '1.0.0',
    })
    builder.step('task', validateOrder)

    const workflow = builder.build()

    expect(workflow.metadata?.description).toBe('Test workflow')
    expect(workflow.metadata?.version).toBe('1.0.0')
  })
})

// ============================================================================
// 7. BuiltWorkflow.execute() - Executing the Workflow
// ============================================================================

describe('BuiltWorkflow.execute()', () => {
  it('executes a simple workflow', async () => {
    const workflow = WorkflowBuilder.create('simple-workflow')
      .step('validate', validateOrder)
      .build()

    const result = await workflow.execute({ orderId: 'order-123' })

    expect(result).toBeDefined()
    expect(result.validate.valid).toBe(true)
  })

  it('executes steps in dependency order', async () => {
    const executionLog: string[] = []

    const workflow = WorkflowBuilder.create('ordered-workflow')
      .step('first', async () => {
        executionLog.push('first')
        return { done: true }
      })
      .step('second', async () => {
        executionLog.push('second')
        return { done: true }
      })
      .dependsOn('first')
      .step('third', async () => {
        executionLog.push('third')
        return { done: true }
      })
      .dependsOn('second')
      .build()

    await workflow.execute()

    expect(executionLog).toEqual(['first', 'second', 'third'])
  })

  it('passes step output to dependent steps', async () => {
    const workflow = WorkflowBuilder.create('data-flow')
      .step('validate', async (input: { orderId: string }) => {
        return { valid: true, orderId: input.orderId }
      })
      .step('charge', async (input: { orderId: string }, ctx) => {
        // Should be able to access validate's output
        const validateResult = ctx.getStepResult('validate')
        return { charged: true, wasValid: validateResult.valid }
      })
      .dependsOn('validate')
      .build()

    const result = await workflow.execute({ orderId: 'order-123' })

    expect(result.charge.wasValid).toBe(true)
  })

  it('executes parallel steps concurrently', async () => {
    const startTimes: Record<string, number> = {}

    const workflow = WorkflowBuilder.create('parallel-workflow')
      .step('stepA', async () => {
        startTimes.stepA = Date.now()
        await new Promise((r) => setTimeout(r, 100))
        return { a: true }
      })
      .step('stepB', async () => {
        startTimes.stepB = Date.now()
        await new Promise((r) => setTimeout(r, 100))
        return { b: true }
      })
      .step('stepC', async () => {
        startTimes.stepC = Date.now()
        return { c: true }
      })
      .dependsOn('stepA', 'stepB')
      .build()

    await workflow.execute()

    // stepA and stepB should start at approximately the same time
    const timeDiff = Math.abs(startTimes.stepA - startTimes.stepB)
    expect(timeDiff).toBeLessThan(50) // Within 50ms of each other
  })

  it('returns results from all steps', async () => {
    const workflow = WorkflowBuilder.create('result-workflow')
      .step('validate', async () => ({ valid: true }))
      .step('charge', async () => ({ charged: true }))
      .step('fulfill', async () => ({ fulfilled: true }))
      .build()

    const result = await workflow.execute()

    expect(result.validate.valid).toBe(true)
    expect(result.charge.charged).toBe(true)
    expect(result.fulfill.fulfilled).toBe(true)
  })

  it('throws on step failure', async () => {
    const workflow = WorkflowBuilder.create('failing-workflow')
      .step('fail', async () => {
        throw new Error('Step failed')
      })
      .build()

    await expect(workflow.execute()).rejects.toThrow('Step failed')
  })

  it('supports step error handlers', async () => {
    const workflow = WorkflowBuilder.create('error-handling-workflow')
      .step('risky', async () => {
        throw new Error('Oops')
      })
      .onError((error, ctx) => {
        return { recovered: true, error: error.message }
      })
      .build()

    const result = await workflow.execute()

    expect(result.risky.recovered).toBe(true)
  })
})

// ============================================================================
// 8. WorkflowService Integration
// ============================================================================

describe('WorkflowBuilder with WorkflowService', () => {
  it('built workflow can be registered with WorkflowService', () => {
    const workflow = WorkflowBuilder.create('registered-workflow')
      .step('validate', validateOrder)
      .on('Order.placed')
      .do('validate')
      .build()

    const service = new WorkflowServiceCore()

    // Should be able to register the built workflow
    const result = service.registerWorkflow(workflow)

    expect(result).toBeDefined()
  })

  it('registered workflow receives events', async () => {
    let receivedEvent: unknown = null

    const workflow = WorkflowBuilder.create('event-receiver')
      .step('handle', async (event: { orderId: string }) => {
        receivedEvent = event
        return { handled: true }
      })
      .on('Order.placed')
      .do('handle')
      .build()

    const service = new WorkflowServiceCore()
    const registration = service.registerWorkflow(workflow)

    // Emit an event
    await service.emit(registration.id, 'Order.placed', { orderId: 'order-123' })

    // Wait for processing
    await new Promise((r) => setTimeout(r, 100))

    expect(receivedEvent).toEqual({ orderId: 'order-123' })
  })

  it('registered workflow executes on schedule', async () => {
    let executionCount = 0

    const workflow = WorkflowBuilder.create('scheduled-runner')
      .step('run', async () => {
        executionCount++
        return { count: executionCount }
      })
      .every('100ms')
      .do('run') // Very short interval for testing
      .build()

    const service = new WorkflowServiceCore()
    const registration = service.registerWorkflow(workflow)

    await service.start(registration.id)

    // Wait for a few executions
    await new Promise((r) => setTimeout(r, 350))

    await service.stop(registration.id)

    expect(executionCount).toBeGreaterThanOrEqual(2)
  })

  it('multiple workflows can be registered', () => {
    const workflow1 = WorkflowBuilder.create('workflow-1').step('step1', validateOrder).build()

    const workflow2 = WorkflowBuilder.create('workflow-2').step('step2', chargePayment).build()

    const service = new WorkflowServiceCore()

    const reg1 = service.registerWorkflow(workflow1)
    const reg2 = service.registerWorkflow(workflow2)

    expect(reg1.id).not.toBe(reg2.id)
    expect(service.list()).toContain(reg1.id)
    expect(service.list()).toContain(reg2.id)
  })
})

// ============================================================================
// 9. Complete DSL Example (from Issue)
// ============================================================================

describe('WorkflowBuilder DSL Complete Example', () => {
  it('builds the order-process workflow from the issue example', () => {
    const workflow = WorkflowBuilder.create('order-process')
      .step('validate', validateOrder)
      .step('charge', chargePayment)
      .dependsOn('validate')
      .step('fulfill', fulfillOrder)
      .dependsOn('charge')
      .on('Order.placed')
      .do('validate')
      .build()

    expect(workflow).toBeDefined()
    expect(workflow.name).toBe('order-process')
    expect(workflow.steps).toHaveLength(3)
    expect(workflow.triggers.events).toHaveLength(1)
    expect(workflow.executionOrder).toEqual(['validate', 'charge', 'fulfill'])
  })

  it('executes the order-process workflow end-to-end', async () => {
    const workflow = WorkflowBuilder.create('order-process')
      .step('validate', async (input: { orderId: string }) => {
        return { valid: true, orderId: input.orderId }
      })
      .step('charge', async (input: { orderId: string; amount: number }, ctx) => {
        const validation = ctx.getStepResult('validate')
        if (!validation.valid) throw new Error('Invalid order')
        return { charged: true, transactionId: `txn_${input.orderId}` }
      })
      .dependsOn('validate')
      .step('fulfill', async (input, ctx) => {
        const charge = ctx.getStepResult('charge')
        return { fulfilled: true, transactionId: charge.transactionId }
      })
      .dependsOn('charge')
      .build()

    const result = await workflow.execute({ orderId: 'order-456', amount: 99.99 })

    expect(result.validate.valid).toBe(true)
    expect(result.charge.charged).toBe(true)
    expect(result.fulfill.fulfilled).toBe(true)
    expect(result.fulfill.transactionId).toBe('txn_order-456')
  })
})

// ============================================================================
// 10. Edge Cases and Error Handling
// ============================================================================

describe('WorkflowBuilder Edge Cases', () => {
  it('handles empty workflow (no steps, only event triggers)', () => {
    const workflow = WorkflowBuilder.create('event-only')
      .on('Order.placed')
      .do(async () => ({ done: true }))
      .build()

    expect(workflow).toBeDefined()
    expect(workflow.steps.length).toBeGreaterThanOrEqual(1) // Implicit step from inline fn
  })

  it('handles workflow with only scheduled triggers', () => {
    const workflow = WorkflowBuilder.create('schedule-only')
      .every('hour')
      .do(async () => ({ done: true }))
      .build()

    expect(workflow).toBeDefined()
  })

  it('handles complex dependency graph', () => {
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    const workflow = WorkflowBuilder.create('diamond')
      .step('A', async () => ({ a: true }))
      .step('B', async () => ({ b: true }))
      .dependsOn('A')
      .step('C', async () => ({ c: true }))
      .dependsOn('A')
      .step('D', async () => ({ d: true }))
      .dependsOn('B', 'C')
      .build()

    expect(workflow).toBeDefined()
    expect(workflow.dependencyGraph.get('D')).toContain('B')
    expect(workflow.dependencyGraph.get('D')).toContain('C')
  })

  it('handles self-referential step (should throw)', () => {
    const builder = WorkflowBuilder.create('self-ref')
      .step('loop', async () => ({ done: true }))
      .dependsOn('loop')

    expect(() => builder.build()).toThrow(/circular|self-referential/i)
  })

  it('handles very long step chains', () => {
    const builder = WorkflowBuilder.create('long-chain')

    // Create a chain of 100 steps
    for (let i = 0; i < 100; i++) {
      builder.step(`step${i}`, async () => ({ step: i }))
      if (i > 0) {
        builder.dependsOn(`step${i - 1}`)
      }
    }

    const workflow = builder.build()

    expect(workflow.steps).toHaveLength(100)
  })

  it('builder is reusable (can build multiple times)', () => {
    const builder = WorkflowBuilder.create('reusable').step('step1', validateOrder)

    const workflow1 = builder.build()

    builder.step('step2', chargePayment)

    const workflow2 = builder.build()

    expect(workflow1.steps).toHaveLength(1)
    expect(workflow2.steps).toHaveLength(2)
  })
})

// ============================================================================
// 11. Type Safety Tests
// ============================================================================

describe('WorkflowBuilder Type Safety', () => {
  it('preserves input/output types through step chain', () => {
    interface OrderInput {
      orderId: string
      amount: number
    }

    interface ValidationResult {
      valid: boolean
      orderId: string
    }

    const workflow = WorkflowBuilder.create('typed-workflow')
      .step<OrderInput, ValidationResult>('validate', async (input) => {
        // TypeScript should know input has orderId and amount
        return { valid: true, orderId: input.orderId }
      })
      .build()

    expect(workflow).toBeDefined()
  })

  it('step context provides typed access to previous results', async () => {
    interface Step1Result {
      value: number
    }

    interface Step2Result {
      doubled: number
    }

    const workflow = WorkflowBuilder.create('typed-context')
      .step<void, Step1Result>('step1', async () => ({ value: 21 }))
      .step<void, Step2Result>('step2', async (_, ctx) => {
        const step1Result = ctx.getStepResult<Step1Result>('step1')
        return { doubled: step1Result.value * 2 }
      })
      .dependsOn('step1')
      .build()

    const result = await workflow.execute()

    expect(result.step2.doubled).toBe(42)
  })
})

// ============================================================================
// 12. Real Cloudflare Workflows Integration
// ============================================================================

describe('WorkflowBuilder with Real Cloudflare Workflows', () => {
  it('built workflow integrates with Cloudflare Workflows runtime', async () => {
    // This test requires the TestWorkflow to be configured in wrangler.jsonc
    // and the workflow to use real step.do() calls

    const workflow = WorkflowBuilder.create('cf-integrated')
      .step('durable-step', async (input: { value: number }) => {
        // This should be wrapped in step.do() for durability
        return { result: input.value * 2 }
      })
      .build()

    // The built workflow should be compatible with Cloudflare Workflows
    expect(workflow.isCloudflareCompatible).toBe(true)
  })

  it('steps are wrapped with DurableStep for durability', () => {
    const workflow = WorkflowBuilder.create('durable-wrapped')
      .step('my-step', validateOrder, {
        retries: { limit: 3 },
      })
      .build()

    // Each step in the built workflow should be a DurableStep
    const step = workflow.steps.find((s) => s.name === 'my-step')
    expect(step?.durableStep).toBeInstanceOf(DurableStep)
  })
})
