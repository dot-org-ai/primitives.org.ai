/**
 * End-to-End Test Suite for ai-workflows
 *
 * Tests complete workflow scenarios that exercise the full system:
 * 1. Customer signup -> email workflow -> notification
 * 2. Order processing with multiple steps and dependencies
 * 3. Scheduled task execution over time with state persistence
 * 4. Multi-tier cascade with timeout and retry
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  Workflow,
  createTestContext,
  clearEventHandlers,
  clearScheduleHandlers,
  createCascadeContext,
  recordStep,
  DependencyGraph,
  topologicalSort,
  getExecutionLevels,
  waitForAll,
  waitForAny,
  withConcurrencyLimit,
  createBarrier,
  CascadeExecutor,
  AllTiersFailedError,
  CascadeTimeoutError,
  workflow,
  type WorkflowInstance,
  type CascadeContext,
} from '../../src/index.js'

describe('E2E: Customer Signup Workflow', () => {
  let workflowInstance: WorkflowInstance

  beforeEach(() => {
    clearEventHandlers()
    clearScheduleHandlers()
  })

  afterEach(async () => {
    if (workflowInstance) {
      await workflowInstance.destroy()
    }
  })

  it('should process customer signup with email and notification chain', async () => {
    const executionLog: string[] = []
    const sentEmails: Array<{ to: string; template: string }> = []
    const sentNotifications: Array<{ channel: string; message: string }> = []

    workflowInstance = Workflow(($) => {
      // Step 1: Customer signup triggers welcome email
      $.on.Customer.created(async (customer: { name: string; email: string }, $) => {
        executionLog.push(`Customer created: ${customer.name}`)
        $.set('customerId', customer.email)
        $.set('customerName', customer.name)

        // Send welcome email
        $.send('Email.welcome', {
          to: customer.email,
          template: 'welcome',
          data: { name: customer.name },
        })
      })

      // Step 2: Welcome email triggers confirmation tracking
      $.on.Email.welcome(
        async (email: { to: string; template: string; data: { name: string } }) => {
          executionLog.push(`Sending welcome email to: ${email.to}`)
          sentEmails.push({ to: email.to, template: email.template })

          // After email sent, trigger notification
          $.send('Notification.send', {
            channel: 'slack',
            message: `New customer signup: ${email.data.name}`,
          })
        }
      )

      // Step 3: Send notification to team
      $.on.Notification.send(async (notification: { channel: string; message: string }) => {
        executionLog.push(`Sending ${notification.channel} notification`)
        sentNotifications.push(notification)

        // Track in workflow state
        $.set('notificationSent', true)
      })
    })

    await workflowInstance.start()

    // Trigger the workflow
    await workflowInstance.send('Customer.created', {
      name: 'John Doe',
      email: 'john@example.com',
    })

    // Allow async event chain to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify execution chain
    expect(executionLog).toContain('Customer created: John Doe')
    expect(executionLog).toContain('Sending welcome email to: john@example.com')
    expect(executionLog).toContain('Sending slack notification')

    // Verify emails sent
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0]).toEqual({
      to: 'john@example.com',
      template: 'welcome',
    })

    // Verify notifications sent
    expect(sentNotifications).toHaveLength(1)
    expect(sentNotifications[0]).toMatchObject({
      channel: 'slack',
      message: 'New customer signup: John Doe',
    })

    // Verify workflow state
    expect(workflowInstance.$.get('customerId')).toBe('john@example.com')
    expect(workflowInstance.$.get('customerName')).toBe('John Doe')
    expect(workflowInstance.$.get('notificationSent')).toBe(true)

    // Verify history captured
    const state = workflowInstance.$.getState()
    expect(state.history.length).toBeGreaterThan(0)
  })

  it('should handle multiple customer signups concurrently', async () => {
    const signups: string[] = []

    workflowInstance = Workflow(($) => {
      $.on.Customer.created(async (customer: { id: string; name: string }) => {
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        signups.push(customer.id)
      })
    })

    await workflowInstance.start()

    // Send multiple events concurrently
    await Promise.all([
      workflowInstance.send('Customer.created', { id: '1', name: 'Customer 1' }),
      workflowInstance.send('Customer.created', { id: '2', name: 'Customer 2' }),
      workflowInstance.send('Customer.created', { id: '3', name: 'Customer 3' }),
    ])

    // Wait for all handlers to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(signups).toHaveLength(3)
    expect(signups).toContain('1')
    expect(signups).toContain('2')
    expect(signups).toContain('3')
  })

  it('should maintain state isolation between workflow instances', async () => {
    const workflow1 = Workflow(($) => {
      $.on.Test.event(async (data: { value: number }) => {
        $.set('value', data.value)
      })
    })

    const workflow2 = Workflow(($) => {
      $.on.Test.event(async (data: { value: number }) => {
        $.set('value', data.value * 2)
      })
    })

    await workflow1.send('Test.event', { value: 10 })
    await workflow2.send('Test.event', { value: 10 })

    // Wait for handlers
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(workflow1.$.get('value')).toBe(10)
    expect(workflow2.$.get('value')).toBe(20)

    await workflow1.destroy()
    await workflow2.destroy()
  })
})

describe('E2E: Order Processing Workflow', () => {
  let workflowInstance: WorkflowInstance

  beforeEach(() => {
    clearEventHandlers()
    clearScheduleHandlers()
  })

  afterEach(async () => {
    if (workflowInstance) {
      await workflowInstance.destroy()
    }
  })

  it('should process order through validation, payment, and fulfillment steps', async () => {
    const stepResults: Record<string, unknown> = {}

    workflowInstance = Workflow(($) => {
      // Step 1: Order received - validate inventory
      $.on.Order.created(async (order: { id: string; items: string[]; total: number }) => {
        stepResults['orderReceived'] = order.id
        $.set('orderId', order.id)
        $.set('orderTotal', order.total)

        // Check inventory (simulated)
        const inventoryAvailable = order.items.length > 0
        stepResults['inventoryChecked'] = inventoryAvailable

        if (inventoryAvailable) {
          $.send('Order.validated', { orderId: order.id, status: 'validated' })
        } else {
          $.send('Order.failed', { orderId: order.id, reason: 'out_of_stock' })
        }
      })

      // Step 2: Order validated - process payment
      $.on.Order.validated(async (data: { orderId: string }) => {
        const total = $.get<number>('orderTotal') || 0
        stepResults['paymentProcessing'] = true

        // Simulate payment processing
        const paymentSuccess = total > 0
        stepResults['paymentResult'] = paymentSuccess

        if (paymentSuccess) {
          $.send('Payment.completed', {
            orderId: data.orderId,
            amount: total,
            transactionId: `txn-${Date.now()}`,
          })
        } else {
          $.send('Payment.failed', { orderId: data.orderId, reason: 'invalid_amount' })
        }
      })

      // Step 3: Payment completed - start fulfillment
      $.on.Payment.completed(async (data: { orderId: string; transactionId: string }) => {
        stepResults['paymentCompleted'] = data.transactionId
        $.set('transactionId', data.transactionId)

        $.send('Fulfillment.started', {
          orderId: data.orderId,
          status: 'processing',
        })
      })

      // Step 4: Fulfillment processing
      $.on.Fulfillment.started(async (data: { orderId: string }) => {
        stepResults['fulfillmentStarted'] = true

        // Simulate fulfillment work
        $.send('Fulfillment.completed', {
          orderId: data.orderId,
          trackingNumber: `TRACK-${Date.now()}`,
        })
      })

      // Step 5: Order complete
      $.on.Fulfillment.completed(async (data: { orderId: string; trackingNumber: string }) => {
        stepResults['orderCompleted'] = true
        stepResults['trackingNumber'] = data.trackingNumber
        $.set('orderStatus', 'completed')
        $.set('trackingNumber', data.trackingNumber)
      })

      // Error handling
      $.on.Order.failed(async (data: { orderId: string; reason: string }) => {
        stepResults['orderFailed'] = data.reason
        $.set('orderStatus', 'failed')
      })

      $.on.Payment.failed(async (data: { orderId: string; reason: string }) => {
        stepResults['paymentFailed'] = data.reason
        $.set('orderStatus', 'payment_failed')
      })
    })

    await workflowInstance.start()

    // Trigger order processing
    await workflowInstance.send('Order.created', {
      id: 'order-123',
      items: ['item-1', 'item-2'],
      total: 99.99,
    })

    // Wait for full chain to complete
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Verify all steps executed
    expect(stepResults['orderReceived']).toBe('order-123')
    expect(stepResults['inventoryChecked']).toBe(true)
    expect(stepResults['paymentProcessing']).toBe(true)
    expect(stepResults['paymentResult']).toBe(true)
    expect(stepResults['paymentCompleted']).toBeDefined()
    expect(stepResults['fulfillmentStarted']).toBe(true)
    expect(stepResults['orderCompleted']).toBe(true)
    expect(stepResults['trackingNumber']).toBeDefined()

    // Verify final state
    expect(workflowInstance.$.get('orderStatus')).toBe('completed')
    expect(workflowInstance.$.get('trackingNumber')).toBeDefined()
  })

  it('should handle order failure at payment step', async () => {
    const stepResults: Record<string, unknown> = {}

    workflowInstance = Workflow(($) => {
      $.on.Order.created(async (order: { id: string; total: number }) => {
        stepResults['orderReceived'] = true
        $.set('orderId', order.id)
        $.set('orderTotal', order.total)
        $.send('Order.validated', { orderId: order.id })
      })

      $.on.Order.validated(async (data: { orderId: string }) => {
        const total = $.get<number>('orderTotal') || 0
        // Simulate payment failure for zero or negative amounts
        if (total <= 0) {
          $.send('Payment.failed', { orderId: data.orderId, reason: 'invalid_amount' })
        } else {
          $.send('Payment.completed', { orderId: data.orderId, amount: total })
        }
      })

      $.on.Payment.failed(async (data: { reason: string }) => {
        stepResults['paymentFailed'] = data.reason
        $.set('orderStatus', 'payment_failed')
      })

      $.on.Payment.completed(async () => {
        stepResults['paymentCompleted'] = true
      })
    })

    await workflowInstance.start()

    // Send order with invalid amount
    await workflowInstance.send('Order.created', {
      id: 'order-456',
      total: 0,
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(stepResults['orderReceived']).toBe(true)
    expect(stepResults['paymentFailed']).toBe('invalid_amount')
    expect(stepResults['paymentCompleted']).toBeUndefined()
    expect(workflowInstance.$.get('orderStatus')).toBe('payment_failed')
  })

  it('should execute steps with dependencies using dependency graph', async () => {
    // Create a dependency graph for order processing steps
    const graph = new DependencyGraph()

    // Define steps
    graph.addNode('validate')
    graph.addNode('checkInventory')
    graph.addNode('processPayment')
    graph.addNode('reserveInventory')
    graph.addNode('shipOrder')
    graph.addNode('sendConfirmation')

    // Define dependencies
    graph.addEdge('validate', 'checkInventory')
    graph.addEdge('validate', 'processPayment')
    graph.addEdge('checkInventory', 'reserveInventory')
    graph.addEdge('processPayment', 'shipOrder')
    graph.addEdge('reserveInventory', 'shipOrder')
    graph.addEdge('shipOrder', 'sendConfirmation')

    // Get execution groups (steps that can run in parallel)
    const groups = graph.getParallelGroups()

    expect(groups.length).toBeGreaterThanOrEqual(3)

    // Level 0: validate (no dependencies)
    expect(groups[0].nodes).toContain('validate')
    expect(groups[0].level).toBe(0)

    // Level 1: checkInventory, processPayment (depend on validate)
    expect(groups[1].nodes).toContain('checkInventory')
    expect(groups[1].nodes).toContain('processPayment')

    // Verify topological order
    const nodes = [
      { id: 'validate', dependencies: [] },
      { id: 'checkInventory', dependencies: ['validate'] },
      { id: 'processPayment', dependencies: ['validate'] },
      { id: 'reserveInventory', dependencies: ['checkInventory'] },
      { id: 'shipOrder', dependencies: ['processPayment', 'reserveInventory'] },
      { id: 'sendConfirmation', dependencies: ['shipOrder'] },
    ]

    const result = topologicalSort(nodes)
    expect(result.hasCycle).toBe(false)

    // Validate ordering
    const order = result.order
    expect(order.indexOf('validate')).toBeLessThan(order.indexOf('checkInventory'))
    expect(order.indexOf('validate')).toBeLessThan(order.indexOf('processPayment'))
    expect(order.indexOf('checkInventory')).toBeLessThan(order.indexOf('reserveInventory'))
    expect(order.indexOf('reserveInventory')).toBeLessThan(order.indexOf('shipOrder'))
    expect(order.indexOf('processPayment')).toBeLessThan(order.indexOf('shipOrder'))
    expect(order.indexOf('shipOrder')).toBeLessThan(order.indexOf('sendConfirmation'))
  })
})

describe('E2E: Scheduled Task Execution', () => {
  beforeEach(() => {
    clearEventHandlers()
    clearScheduleHandlers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should execute scheduled tasks and persist state across executions', async () => {
    const executionTimes: number[] = []
    let executionCount = 0

    const workflowInstance = Workflow(($) => {
      // Initialize counter
      $.set('taskExecutions', 0)

      // Schedule task every second
      $.every.seconds(1)(async ($) => {
        executionCount++
        const current = $.get<number>('taskExecutions') || 0
        $.set('taskExecutions', current + 1)
        executionTimes.push(Date.now())
      })
    })

    await workflowInstance.start()

    // Advance time and verify executions
    await vi.advanceTimersByTimeAsync(1000)
    expect(executionCount).toBe(1)
    expect(workflowInstance.$.get('taskExecutions')).toBe(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(executionCount).toBe(2)
    expect(workflowInstance.$.get('taskExecutions')).toBe(2)

    await vi.advanceTimersByTimeAsync(3000)
    expect(executionCount).toBe(5)
    expect(workflowInstance.$.get('taskExecutions')).toBe(5)

    // Stop the workflow
    await workflowInstance.stop()

    // Verify no more executions after stop
    await vi.advanceTimersByTimeAsync(5000)
    expect(executionCount).toBe(5)

    await workflowInstance.destroy()
  })

  it('should execute multiple schedules with different intervals', async () => {
    const fastTaskCount = { value: 0 }
    const slowTaskCount = { value: 0 }

    const workflowInstance = Workflow(($) => {
      $.every.seconds(1)(async () => {
        fastTaskCount.value++
      })

      $.every.seconds(5)(async () => {
        slowTaskCount.value++
      })
    })

    await workflowInstance.start()

    // Advance 5 seconds
    await vi.advanceTimersByTimeAsync(5000)

    // Fast task should run 5 times, slow task 1 time
    expect(fastTaskCount.value).toBe(5)
    expect(slowTaskCount.value).toBe(1)

    // Advance another 5 seconds
    await vi.advanceTimersByTimeAsync(5000)

    expect(fastTaskCount.value).toBe(10)
    expect(slowTaskCount.value).toBe(2)

    await workflowInstance.destroy()
  })

  it('should track execution history in state', async () => {
    const workflowInstance = Workflow(($) => {
      $.every.seconds(1)(async ($) => {
        $.log('Scheduled task executed')
      })
    })

    await workflowInstance.start()

    // Execute a few times
    await vi.advanceTimersByTimeAsync(3000)

    // Check history
    const state = workflowInstance.$.getState()
    const scheduleEntries = state.history.filter((h) => h.type === 'schedule')
    expect(scheduleEntries.length).toBe(3)

    await workflowInstance.destroy()
  })
})

describe('E2E: Multi-Tier Cascade with Timeout and Retry', () => {
  it('should cascade through tiers on failure', async () => {
    const executionLog: string[] = []

    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async (input) => {
            executionLog.push('code-tier-attempt')
            throw new Error('Code tier failed')
          },
        },
        generative: {
          name: 'generative-handler',
          execute: async (input) => {
            executionLog.push('generative-tier-attempt')
            return `Generated result for: ${input}`
          },
        },
      },
      timeouts: {
        code: 100,
        generative: 5000,
      },
    })

    const result = await executor.execute('test-input')

    expect(result.tier).toBe('generative')
    expect(result.value).toBe('Generated result for: test-input')
    expect(executionLog).toContain('code-tier-attempt')
    expect(executionLog).toContain('generative-tier-attempt')
    expect(result.history).toHaveLength(2)
    expect(result.history[0].tier).toBe('code')
    expect(result.history[0].success).toBe(false)
    expect(result.history[1].tier).toBe('generative')
    expect(result.history[1].success).toBe(true)
  })

  it('should cascade through all four tiers when needed', async () => {
    const tierAttempts: string[] = []

    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => {
            tierAttempts.push('code')
            throw new Error('Code failed')
          },
        },
        generative: {
          name: 'generative-handler',
          execute: async () => {
            tierAttempts.push('generative')
            throw new Error('Generative failed')
          },
        },
        agentic: {
          name: 'agentic-handler',
          execute: async () => {
            tierAttempts.push('agentic')
            throw new Error('Agentic failed')
          },
        },
        human: {
          name: 'human-handler',
          execute: async (input) => {
            tierAttempts.push('human')
            return `Human resolved: ${input}`
          },
        },
      },
      timeouts: {
        code: 100,
        generative: 100,
        agentic: 100,
        human: 1000,
      },
    })

    const result = await executor.execute('complex-input')

    expect(tierAttempts).toEqual(['code', 'generative', 'agentic', 'human'])
    expect(result.tier).toBe('human')
    expect(result.value).toBe('Human resolved: complex-input')
    expect(result.history).toHaveLength(4)
  })

  it('should throw AllTiersFailedError when all tiers fail', async () => {
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
          execute: async () => {
            throw new Error('Generative failed')
          },
        },
      },
      timeouts: {
        code: 100,
        generative: 100,
      },
    })

    await expect(executor.execute('failing-input')).rejects.toThrow(AllTiersFailedError)
  })

  it('should respect tier timeouts', async () => {
    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => {
            // Simulate slow operation
            await new Promise((resolve) => setTimeout(resolve, 500))
            return 'slow-result'
          },
        },
        generative: {
          name: 'generative-handler',
          execute: async () => {
            return 'fast-fallback'
          },
        },
      },
      timeouts: {
        code: 100, // Will timeout
        generative: 5000,
      },
    })

    const result = await executor.execute('test')

    // Code tier should timeout and cascade to generative
    expect(result.tier).toBe('generative')
    expect(result.value).toBe('fast-fallback')
    expect(result.history[0].timedOut).toBe(true)
  })

  it('should respect total cascade timeout', async () => {
    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, 200))
            throw new Error('Code failed')
          },
        },
        generative: {
          name: 'generative-handler',
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, 200))
            return 'result'
          },
        },
      },
      totalTimeout: 150, // Total timeout less than combined tier execution
    })

    await expect(executor.execute('test')).rejects.toThrow(CascadeTimeoutError)
  })

  it('should track cascade context and steps', async () => {
    const ctx = createCascadeContext({ name: 'order-processing' })

    // Simulate cascade steps
    const step1 = recordStep(ctx, 'validate-order', { actor: 'system' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    step1.complete()

    const step2 = recordStep(ctx, 'process-payment', { actor: 'payment-service' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    step2.complete()

    const step3 = recordStep(ctx, 'send-confirmation', { actor: 'notification-service' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    step3.complete()

    expect(ctx.steps).toHaveLength(3)
    expect(ctx.steps.every((s) => s.status === 'completed')).toBe(true)
    expect(ctx.path).toEqual(['validate-order', 'process-payment', 'send-confirmation'])

    // Verify serialization
    const serialized = ctx.serialize()
    expect(serialized.correlationId).toBe(ctx.correlationId)
    expect(serialized.steps).toHaveLength(3)

    // Verify formatting
    const formatted = ctx.format()
    expect(formatted).toContain('order-processing')
    expect(formatted).toContain('[OK] validate-order')
    expect(formatted).toContain('[OK] process-payment')
    expect(formatted).toContain('[OK] send-confirmation')
  })

  it('should retry failed tiers based on retry config', async () => {
    let codeAttempts = 0

    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => {
            codeAttempts++
            if (codeAttempts < 3) {
              throw new Error(`Attempt ${codeAttempts} failed`)
            }
            return 'success-after-retries'
          },
        },
      },
      retryConfig: {
        code: {
          maxRetries: 3,
          baseDelay: 10,
          multiplier: 1,
        },
      },
    })

    const result = await executor.execute('retry-test')

    expect(codeAttempts).toBe(3)
    expect(result.tier).toBe('code')
    expect(result.value).toBe('success-after-retries')
  })

  it('should emit 5W+H events during cascade execution', async () => {
    const events: Array<{ who: string; what: string; where: string }> = []

    const executor = new CascadeExecutor({
      tiers: {
        code: {
          name: 'code-handler',
          execute: async () => 'code-result',
        },
      },
      actor: 'test-system',
      cascadeName: 'test-cascade',
      onEvent: (event) => {
        events.push({
          who: event.who,
          what: event.what,
          where: event.where,
        })
      },
    })

    await executor.execute('input')

    expect(events.some((e) => e.what === 'cascade-start')).toBe(true)
    expect(events.some((e) => e.what === 'tier-code-execute')).toBe(true)
    expect(events.some((e) => e.what === 'cascade-complete')).toBe(true)
    expect(events.every((e) => e.who === 'test-system')).toBe(true)
    expect(events.every((e) => e.where === 'test-cascade')).toBe(true)
  })
})

describe('E2E: Barrier and Coordination Patterns', () => {
  it('should coordinate parallel steps using barrier', async () => {
    const barrier = createBarrier<string>(3)
    const completionOrder: string[] = []

    // Simulate three parallel tasks completing at different times
    const task1 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      barrier.arrive('task1')
      completionOrder.push('task1')
    }

    const task2 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      barrier.arrive('task2')
      completionOrder.push('task2')
    }

    const task3 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      barrier.arrive('task3')
      completionOrder.push('task3')
    }

    // Start all tasks
    const taskPromises = [task1(), task2(), task3()]

    // Wait for barrier
    const results = await barrier.wait()

    expect(results).toHaveLength(3)
    expect(results).toContain('task1')
    expect(results).toContain('task2')
    expect(results).toContain('task3')

    // Tasks complete in order of their delays
    expect(completionOrder).toEqual(['task3', 'task2', 'task1'])

    await Promise.all(taskPromises)
    barrier.dispose()
  })

  it('should wait for all promises with timeout support', async () => {
    const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 100))
    const fastPromise = new Promise<string>((resolve) => setTimeout(() => resolve('fast'), 10))

    const results = await waitForAll([slowPromise, fastPromise])

    expect(results).toEqual(['slow', 'fast'])
  })

  it('should wait for N of M promises to complete', async () => {
    const promises = [
      new Promise<number>((resolve) => setTimeout(() => resolve(1), 10)),
      new Promise<number>((resolve) => setTimeout(() => resolve(2), 50)),
      new Promise<number>((resolve) => setTimeout(() => resolve(3), 100)),
    ]

    // Wait for first 2 to complete
    const result = await waitForAny(2, promises)

    expect(result.completed).toHaveLength(2)
    expect(result.completed).toContain(1)
    expect(result.completed).toContain(2)
    expect(result.pending).toHaveLength(1)
  })

  it('should limit concurrent task execution', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const completionOrder: number[] = []

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 20))
      concurrent--
      completionOrder.push(i)
      return i
    })

    const results = await withConcurrencyLimit(tasks, 3)

    // All tasks completed
    expect(results).toHaveLength(10)

    // Max concurrent never exceeded 3
    expect(maxConcurrent).toBeLessThanOrEqual(3)

    // All tasks returned their index
    results.forEach((result, i) => {
      expect(result).toBe(i)
    })
  })

  it('should handle failures with concurrency limit and collectErrors', async () => {
    const tasks = [
      async () => 'success-1',
      async () => {
        throw new Error('task-2-failed')
      },
      async () => 'success-3',
      async () => {
        throw new Error('task-4-failed')
      },
      async () => 'success-5',
    ]

    const results = await withConcurrencyLimit(tasks, 2, { collectErrors: true })

    expect(results).toHaveLength(5)
    expect(results[0]).toBe('success-1')
    expect(results[1]).toBeInstanceOf(Error)
    expect((results[1] as Error).message).toBe('task-2-failed')
    expect(results[2]).toBe('success-3')
    expect(results[3]).toBeInstanceOf(Error)
    expect(results[4]).toBe('success-5')
  })
})

describe('E2E: Workflow Builder DSL', () => {
  it('should build and execute a multi-step workflow', () => {
    const executionLog: string[] = []

    const orderWorkflow = workflow('order-processing')
      .step('validate', async (ctx) => {
        executionLog.push('validate')
        return { validated: true, orderId: 'ord-123' }
      })
      .step('payment', async (ctx) => {
        executionLog.push('payment')
        return { paid: true, transactionId: 'txn-456' }
      })
      .step('fulfillment', async (ctx) => {
        executionLog.push('fulfillment')
        return { shipped: true, trackingNumber: 'TRK-789' }
      })
      .build()

    expect(orderWorkflow.name).toBe('order-processing')
    expect(orderWorkflow.steps).toHaveLength(3)
    expect(orderWorkflow.steps[0].name).toBe('validate')
    expect(orderWorkflow.steps[1].name).toBe('payment')
    expect(orderWorkflow.steps[2].name).toBe('fulfillment')
  })

  it('should support conditional branching in workflow', () => {
    const highValueFlow = workflow('high-value')
      .step('manualReview', async () => ({ reviewed: true }))
      .build()

    const standardFlow = workflow('standard')
      .step('autoApprove', async () => ({ approved: true }))
      .build()

    const orderWorkflow = workflow('order-routing')
      .step('evaluate', async () => ({ orderValue: 1000 }))
      .when((ctx) => (ctx.result?.evaluate?.orderValue ?? 0) > 500)
      .then(highValueFlow)
      .else(standardFlow)
      .build()

    expect(orderWorkflow.steps).toHaveLength(2)
    expect(orderWorkflow.steps[0].name).toBe('evaluate')
    expect(orderWorkflow.steps[1].type).toBe('conditional')
  })

  it('should support workflow composition', () => {
    const emailWorkflow = workflow('send-email')
      .step('template', async () => ({ html: '<html>...</html>' }))
      .step('send', async () => ({ sent: true }))
      .build()

    const notifyWorkflow = workflow('notifications')
      .step('email', async () => ({ emailQueued: true }))
      .step('sms', async () => ({ smsQueued: true }))
      .build()

    const fullWorkflow = workflow('complete-process')
      .step('process', async () => ({ processId: 'proc-1' }))
      .step('emailStep', async () => ({ email: 'done' }))
      .step('notifyStep', async () => ({ notify: 'done' }))
      .build()

    expect(fullWorkflow.steps).toHaveLength(3)
  })
})

describe('E2E: Test Context Utilities', () => {
  it('should track events in test context', () => {
    const $ = createTestContext()

    $.send('Customer.created', { id: '1', name: 'Test' })
    $.send('Order.placed', { orderId: 'ord-1' })
    $.send('Email.sent', { to: 'test@example.com' })

    expect($.emittedEvents).toHaveLength(3)
    expect($.emittedEvents[0].event).toBe('Customer.created')
    expect($.emittedEvents[1].event).toBe('Order.placed')
    expect($.emittedEvents[2].event).toBe('Email.sent')
  })

  it('should manage state in test context', () => {
    const $ = createTestContext()

    $.set('userId', '123')
    $.set('sessionActive', true)
    $.set('preferences', { theme: 'dark' })

    expect($.get('userId')).toBe('123')
    expect($.get('sessionActive')).toBe(true)
    expect($.get<{ theme: string }>('preferences')).toEqual({ theme: 'dark' })

    const state = $.getState()
    expect(state.context['userId']).toBe('123')
  })

  it('should support handler testing patterns', async () => {
    // Simulate testing a handler in isolation
    const $ = createTestContext()

    // Mock handler function
    const handleCustomerCreated = async (
      customer: { name: string; email: string },
      $: ReturnType<typeof createTestContext>
    ) => {
      $.set('lastCustomer', customer.name)
      $.send('Email.welcome', { to: customer.email })
      $.send('Analytics.track', { event: 'signup', user: customer.name })
    }

    // Test the handler
    await handleCustomerCreated({ name: 'Test User', email: 'test@example.com' }, $)

    // Verify state changes
    expect($.get('lastCustomer')).toBe('Test User')

    // Verify events sent
    expect($.emittedEvents).toHaveLength(2)
    expect($.emittedEvents[0]).toMatchObject({
      event: 'Email.welcome',
      data: expect.objectContaining({ to: 'test@example.com' }),
    })
    expect($.emittedEvents[1]).toMatchObject({
      event: 'Analytics.track',
      data: expect.objectContaining({ event: 'signup' }),
    })
  })
})
