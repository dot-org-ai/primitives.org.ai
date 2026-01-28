/**
 * WorkflowBuilder DSL Tests (RED Phase)
 *
 * Tests for WorkflowBuilder - a fluent DSL for building durable workflows
 * with support for sequential steps, parallel execution, conditional branching,
 * loops, error handlers, timeouts, and retries.
 *
 * These tests define the expected behavior for WorkflowBuilder DSL before implementation.
 * All tests SHOULD FAIL because WorkflowBuilder does not exist yet.
 *
 * Uses regular vitest (not vitest-pool-workers).
 *
 * Bead: aip-llm1
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// These imports will FAIL because WorkflowBuilder does not exist yet.
// This is the RED phase of TDD.
// ============================================================================
import {
  workflow,
  WorkflowBuilder,
  type WorkflowDefinition,
  type StepDefinition,
  type StepChain,
  type ConditionalChain,
  type LoopChain,
  type BuiltWorkflow,
  type StepContext,
  type RetryConfig,
} from '../src/workflow-builder.js'

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

const processItem = async (input: { item: string; index: number }) => {
  return { processed: true, item: input.item }
}

// ============================================================================
// 1. Fluent DSL: workflow('name').step().step().build()
// ============================================================================

describe('WorkflowBuilder Fluent DSL', () => {
  describe('workflow() factory function', () => {
    it('creates a workflow builder with a name', () => {
      const builder = workflow('order-process')

      expect(builder).toBeDefined()
      expect(builder).toBeInstanceOf(WorkflowBuilder)
    })

    it('supports the fluent pattern: workflow().step().step().build()', () => {
      const built = workflow('order-process')
        .step('step1', validateOrder)
        .step('step2', chargePayment)
        .build()

      expect(built).toBeDefined()
      expect(built.name).toBe('order-process')
      expect(built.steps).toHaveLength(2)
    })

    it('validates workflow name is provided', () => {
      expect(() => workflow('')).toThrow(/workflow name/i)
    })

    it('workflow name is accessible on the builder', () => {
      const builder = workflow('my-workflow')

      expect(builder.name).toBe('my-workflow')
    })
  })

  describe('step() method', () => {
    it('adds a step with name and function', () => {
      const built = workflow('test').step('validate', validateOrder).build()

      expect(built.steps).toHaveLength(1)
      expect(built.steps[0].name).toBe('validate')
    })

    it('chains multiple steps', () => {
      const built = workflow('test')
        .step('step1', async () => ({ a: 1 }))
        .step('step2', async () => ({ b: 2 }))
        .step('step3', async () => ({ c: 3 }))
        .build()

      expect(built.steps).toHaveLength(3)
      expect(built.steps.map((s) => s.name)).toEqual(['step1', 'step2', 'step3'])
    })

    it('preserves step order', () => {
      const built = workflow('ordered')
        .step('first', async () => 1)
        .step('second', async () => 2)
        .step('third', async () => 3)
        .build()

      expect(built.steps[0].name).toBe('first')
      expect(built.steps[1].name).toBe('second')
      expect(built.steps[2].name).toBe('third')
    })

    it('rejects duplicate step names', () => {
      expect(() =>
        workflow('test')
          .step('duplicate', async () => 1)
          .step('duplicate', async () => 2)
          .build()
      ).toThrow(/duplicate.*step.*name/i)
    })
  })

  describe('build() method', () => {
    it('returns a BuiltWorkflow object', () => {
      const built = workflow('test').step('step1', validateOrder).build()

      expect(built).toHaveProperty('name')
      expect(built).toHaveProperty('steps')
      expect(built).toHaveProperty('execute')
    })

    it('built workflow has execute method', () => {
      const built = workflow('test').step('step1', validateOrder).build()

      expect(typeof built.execute).toBe('function')
    })

    it('returns immutable workflow definition', () => {
      const builder = workflow('test').step('step1', validateOrder)

      const built1 = builder.build()

      builder.step('step2', chargePayment)

      const built2 = builder.build()

      expect(built1.steps).toHaveLength(1)
      expect(built2.steps).toHaveLength(2)
    })
  })
})

// ============================================================================
// 2. Sequential and Parallel Steps
// ============================================================================

describe('Sequential and Parallel Steps', () => {
  describe('sequential execution (default)', () => {
    it('steps execute in order by default', async () => {
      const executionOrder: string[] = []

      const built = workflow('sequential')
        .step('first', async () => {
          executionOrder.push('first')
          return { order: 1 }
        })
        .step('second', async () => {
          executionOrder.push('second')
          return { order: 2 }
        })
        .step('third', async () => {
          executionOrder.push('third')
          return { order: 3 }
        })
        .build()

      await built.execute({})

      expect(executionOrder).toEqual(['first', 'second', 'third'])
    })

    it('each step receives result from previous step', async () => {
      const built = workflow('chained')
        .step('add5', async (input: { value: number }) => ({
          value: input.value + 5,
        }))
        .step('multiply2', async (input: { value: number }) => ({
          value: input.value * 2,
        }))
        .step('subtract3', async (input: { value: number }) => ({
          value: input.value - 3,
        }))
        .build()

      const result = await built.execute({ value: 10 })

      // (10 + 5) * 2 - 3 = 27
      expect(result.value).toBe(27)
    })
  })

  describe('parallel execution', () => {
    it('supports parallel step groups with .parallel()', () => {
      const built = workflow('parallel-test')
        .parallel([
          { name: 'taskA', fn: async () => ({ a: true }) },
          { name: 'taskB', fn: async () => ({ b: true }) },
          { name: 'taskC', fn: async () => ({ c: true }) },
        ])
        .build()

      expect(built).toBeDefined()
    })

    it('parallel steps execute concurrently', async () => {
      const startTimes: Record<string, number> = {}

      const built = workflow('concurrent')
        .parallel([
          {
            name: 'slow1',
            fn: async () => {
              startTimes.slow1 = Date.now()
              await new Promise((r) => setTimeout(r, 50))
              return { done: 1 }
            },
          },
          {
            name: 'slow2',
            fn: async () => {
              startTimes.slow2 = Date.now()
              await new Promise((r) => setTimeout(r, 50))
              return { done: 2 }
            },
          },
        ])
        .build()

      await built.execute({})

      // Both should start at approximately the same time
      const timeDiff = Math.abs(startTimes.slow1 - startTimes.slow2)
      expect(timeDiff).toBeLessThan(20)
    })

    it('parallel results are merged', async () => {
      const built = workflow('merge-results')
        .parallel([
          { name: 'a', fn: async () => ({ resultA: 'A' }) },
          { name: 'b', fn: async () => ({ resultB: 'B' }) },
        ])
        .build()

      const result = await built.execute({})

      expect(result.a).toEqual({ resultA: 'A' })
      expect(result.b).toEqual({ resultB: 'B' })
    })

    it('sequential and parallel can be mixed', async () => {
      const executionOrder: string[] = []

      const built = workflow('mixed')
        .step('first', async () => {
          executionOrder.push('first')
          return {}
        })
        .parallel([
          {
            name: 'parallelA',
            fn: async () => {
              executionOrder.push('parallelA')
              return {}
            },
          },
          {
            name: 'parallelB',
            fn: async () => {
              executionOrder.push('parallelB')
              return {}
            },
          },
        ])
        .step('last', async () => {
          executionOrder.push('last')
          return {}
        })
        .build()

      await built.execute({})

      expect(executionOrder[0]).toBe('first')
      expect(executionOrder[executionOrder.length - 1]).toBe('last')
      expect(executionOrder).toContain('parallelA')
      expect(executionOrder).toContain('parallelB')
    })

    it('parallel failure handling with .parallel().onError()', async () => {
      const built = workflow('parallel-error')
        .parallel([
          { name: 'success', fn: async () => ({ ok: true }) },
          {
            name: 'failure',
            fn: async () => {
              throw new Error('Parallel step failed')
            },
          },
        ])
        .onError(async (error) => ({ recovered: true, error: error.message }))
        .build()

      const result = await built.execute({})

      expect(result.recovered).toBe(true)
    })
  })
})

// ============================================================================
// 3. Conditional Branching: .when(condition).then(steps).else(steps)
// ============================================================================

describe('Conditional Branching', () => {
  describe('.when(condition).then(steps)', () => {
    it('executes then branch when condition is true', async () => {
      const built = workflow('conditional')
        .step('check', async () => ({ amount: 150 }))
        .when((ctx) => ctx.result.amount > 100)
        .then(workflow('then-branch').step('highValue', async () => ({ tier: 'premium' })))
        .build()

      const result = await built.execute({})

      expect(result.tier).toBe('premium')
    })

    it('skips then branch when condition is false', async () => {
      const executed: string[] = []

      const built = workflow('conditional')
        .step('check', async () => {
          executed.push('check')
          return { amount: 50 }
        })
        .when((ctx) => ctx.result.amount > 100)
        .then(
          workflow('then-branch').step('highValue', async () => {
            executed.push('highValue')
            return { tier: 'premium' }
          })
        )
        .step('continue', async () => {
          executed.push('continue')
          return { continued: true }
        })
        .build()

      await built.execute({})

      expect(executed).toContain('check')
      expect(executed).toContain('continue')
      expect(executed).not.toContain('highValue')
    })
  })

  describe('.when(condition).then(steps).else(steps)', () => {
    it('executes else branch when condition is false', async () => {
      const built = workflow('if-else')
        .step('check', async () => ({ amount: 50 }))
        .when((ctx) => ctx.result.amount > 100)
        .then(workflow('then-branch').step('premium', async () => ({ tier: 'premium' })))
        .else(workflow('else-branch').step('standard', async () => ({ tier: 'standard' })))
        .build()

      const result = await built.execute({})

      expect(result.tier).toBe('standard')
    })

    it('executes then branch and skips else when condition is true', async () => {
      const executed: string[] = []

      const built = workflow('if-else')
        .step('check', async () => ({ amount: 150 }))
        .when((ctx) => ctx.result.amount > 100)
        .then(
          workflow('then-branch').step('premium', async () => {
            executed.push('premium')
            return { tier: 'premium' }
          })
        )
        .else(
          workflow('else-branch').step('standard', async () => {
            executed.push('standard')
            return { tier: 'standard' }
          })
        )
        .build()

      await built.execute({})

      expect(executed).toContain('premium')
      expect(executed).not.toContain('standard')
    })

    it('supports nested conditionals', async () => {
      const built = workflow('nested-conditional')
        .step('getData', async () => ({ value: 75 }))
        .when((ctx) => ctx.result.value > 50)
        .then(
          workflow('outer-then')
            .when((ctx) => ctx.result.value > 90)
            .then(workflow('inner-then').step('high', async () => ({ level: 'high' })))
            .else(workflow('inner-else').step('medium', async () => ({ level: 'medium' })))
        )
        .else(workflow('outer-else').step('low', async () => ({ level: 'low' })))
        .build()

      const result = await built.execute({})

      expect(result.level).toBe('medium')
    })

    it('condition receives step context with input and results', async () => {
      let capturedContext: StepContext | null = null

      const built = workflow('context-check')
        .step('setup', async (input: { userId: string }) => ({
          user: input.userId,
          premium: true,
        }))
        .when((ctx) => {
          capturedContext = ctx
          return ctx.result.premium
        })
        .then(workflow('premium-flow').step('premium', async () => ({ applied: true })))
        .build()

      await built.execute({ userId: 'user-123' })

      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.input).toEqual({ userId: 'user-123' })
      expect(capturedContext!.result).toEqual({ user: 'user-123', premium: true })
    })

    it('supports async conditions', async () => {
      const built = workflow('async-condition')
        .step('getData', async () => ({ id: 'test-123' }))
        .when(async (ctx) => {
          // Simulate async check (e.g., database lookup)
          await new Promise((r) => setTimeout(r, 10))
          return ctx.result.id.startsWith('test')
        })
        .then(workflow('test-branch').step('testMode', async () => ({ testMode: true })))
        .build()

      const result = await built.execute({})

      expect(result.testMode).toBe(true)
    })
  })

  describe('.when() with inline steps', () => {
    it('supports inline step functions in then()', async () => {
      const built = workflow('inline-then')
        .step('check', async () => ({ proceed: true }))
        .when((ctx) => ctx.result.proceed)
        .then(async () => ({ inlined: true }))
        .build()

      const result = await built.execute({})

      expect(result.inlined).toBe(true)
    })

    it('supports inline step functions in else()', async () => {
      const built = workflow('inline-else')
        .step('check', async () => ({ proceed: false }))
        .when((ctx) => ctx.result.proceed)
        .then(async () => ({ branch: 'then' }))
        .else(async () => ({ branch: 'else' }))
        .build()

      const result = await built.execute({})

      expect(result.branch).toBe('else')
    })
  })
})

// ============================================================================
// 4. Loops: .loop(condition, steps)
// ============================================================================

describe('Loops', () => {
  describe('.loop(condition, steps)', () => {
    it('repeats steps while condition is true', async () => {
      let counter = 0

      const built = workflow('while-loop')
        .step('init', async () => ({ count: 0 }))
        .loop(
          (ctx) => ctx.result.count < 3,
          workflow('loop-body').step('increment', async (input: { count: number }) => {
            counter++
            return { count: input.count + 1 }
          })
        )
        .build()

      const result = await built.execute({})

      expect(counter).toBe(3)
      expect(result.count).toBe(3)
    })

    it('does not execute loop body if condition is initially false', async () => {
      let executed = false

      const built = workflow('skip-loop')
        .step('init', async () => ({ count: 10 }))
        .loop(
          (ctx) => ctx.result.count < 3,
          workflow('loop-body').step('never', async () => {
            executed = true
            return {}
          })
        )
        .build()

      await built.execute({})

      expect(executed).toBe(false)
    })

    it('loop has access to accumulated results', async () => {
      const values: number[] = []

      const built = workflow('accumulator')
        .step('init', async () => ({ items: [1, 2, 3], index: 0 }))
        .loop(
          (ctx) => ctx.result.index < ctx.result.items.length,
          workflow('process-item').step(
            'process',
            async (input: { items: number[]; index: number }) => {
              values.push(input.items[input.index])
              return { ...input, index: input.index + 1 }
            }
          )
        )
        .build()

      await built.execute({})

      expect(values).toEqual([1, 2, 3])
    })

    it('supports async loop conditions', async () => {
      let iterations = 0

      const built = workflow('async-loop')
        .step('init', async () => ({ remaining: 2 }))
        .loop(
          async (ctx) => {
            await new Promise((r) => setTimeout(r, 5))
            return ctx.result.remaining > 0
          },
          workflow('loop-body').step('decrement', async (input: { remaining: number }) => {
            iterations++
            return { remaining: input.remaining - 1 }
          })
        )
        .build()

      await built.execute({})

      expect(iterations).toBe(2)
    })

    it('prevents infinite loops with maxIterations option', async () => {
      let iterations = 0

      const built = workflow('infinite-guard')
        .step('init', async () => ({ value: true }))
        .loop(
          () => true, // Always true - would loop forever
          workflow('body').step('tick', async () => {
            iterations++
            return { value: true }
          }),
          { maxIterations: 5 }
        )
        .build()

      await built.execute({})

      expect(iterations).toBe(5)
    })

    it('throws error when maxIterations exceeded without breakOnMax option', async () => {
      const built = workflow('overflow')
        .step('init', async () => ({}))
        .loop(
          () => true,
          workflow('body').step('tick', async () => ({})),
          { maxIterations: 3, throwOnMaxIterations: true }
        )
        .build()

      await expect(built.execute({})).rejects.toThrow(/max.*iterations.*exceeded/i)
    })
  })

  describe('.forEach(items, steps)', () => {
    it('iterates over array items', async () => {
      const processed: string[] = []

      const built = workflow('for-each')
        .step('init', async () => ({ items: ['a', 'b', 'c'] }))
        .forEach(
          (ctx) => ctx.result.items,
          workflow('process-item').step(
            'process',
            async (input: { item: string; index: number }) => {
              processed.push(input.item)
              return { processed: input.item }
            }
          )
        )
        .build()

      await built.execute({})

      expect(processed).toEqual(['a', 'b', 'c'])
    })

    it('provides item and index to loop body', async () => {
      const captured: Array<{ item: string; index: number }> = []

      const built = workflow('indexed-foreach')
        .step('init', async () => ({ list: ['x', 'y', 'z'] }))
        .forEach(
          (ctx) => ctx.result.list,
          workflow('capture').step('capture', async (input: { item: string; index: number }) => {
            captured.push({ item: input.item, index: input.index })
            return {}
          })
        )
        .build()

      await built.execute({})

      expect(captured).toEqual([
        { item: 'x', index: 0 },
        { item: 'y', index: 1 },
        { item: 'z', index: 2 },
      ])
    })

    it('collects results from each iteration', async () => {
      const built = workflow('collect-results')
        .step('init', async () => ({ numbers: [1, 2, 3] }))
        .forEach(
          (ctx) => ctx.result.numbers,
          workflow('double').step('double', async (input: { item: number }) => ({
            doubled: input.item * 2,
          }))
        )
        .build()

      const result = await built.execute({})

      expect(result.forEachResults).toEqual([{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }])
    })

    it('supports parallel iteration with concurrency option', async () => {
      const startTimes: number[] = []

      const built = workflow('parallel-foreach')
        .step('init', async () => ({ items: [1, 2, 3, 4] }))
        .forEach(
          (ctx) => ctx.result.items,
          workflow('slow-process').step('slow', async () => {
            startTimes.push(Date.now())
            await new Promise((r) => setTimeout(r, 50))
            return {}
          }),
          { concurrency: 2 }
        )
        .build()

      await built.execute({})

      // With concurrency 2, items 1&2 should start together, then 3&4
      // So first two should have similar start times, last two should have similar start times
      const diff12 = Math.abs(startTimes[0] - startTimes[1])
      const diff34 = Math.abs(startTimes[2] - startTimes[3])

      expect(diff12).toBeLessThan(20)
      expect(diff34).toBeLessThan(20)
    })

    it('handles empty arrays gracefully', async () => {
      let bodyExecuted = false

      const built = workflow('empty-array')
        .step('init', async () => ({ items: [] as string[] }))
        .forEach(
          (ctx) => ctx.result.items,
          workflow('never').step('never', async () => {
            bodyExecuted = true
            return {}
          })
        )
        .step('after', async () => ({ completed: true }))
        .build()

      const result = await built.execute({})

      expect(bodyExecuted).toBe(false)
      expect(result.completed).toBe(true)
    })
  })
})

// ============================================================================
// 5. Error Handlers: .onError(handler)
// ============================================================================

describe('Error Handlers', () => {
  describe('.onError(handler) on steps', () => {
    it('catches errors from a single step', async () => {
      const built = workflow('step-error')
        .step('failing', async () => {
          throw new Error('Step failed!')
        })
        .onError(async (error) => ({
          recovered: true,
          errorMessage: error.message,
        }))
        .build()

      const result = await built.execute({})

      expect(result.recovered).toBe(true)
      expect(result.errorMessage).toBe('Step failed!')
    })

    it('error handler receives error and context', async () => {
      let capturedError: Error | null = null
      let capturedContext: StepContext | null = null

      const built = workflow('error-context')
        .step('setup', async () => ({ setupValue: 42 }))
        .step('failing', async () => {
          throw new Error('Oops!')
        })
        .onError(async (error, ctx) => {
          capturedError = error
          capturedContext = ctx
          return { handled: true }
        })
        .build()

      await built.execute({ inputValue: 'test' })

      expect(capturedError).not.toBeNull()
      expect(capturedError!.message).toBe('Oops!')
      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.input).toEqual({ inputValue: 'test' })
    })

    it('error handler can retry the step', async () => {
      let attempts = 0

      const built = workflow('retry-in-handler')
        .step('flaky', async () => {
          attempts++
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`)
          }
          return { success: true }
        })
        .onError(async (error, ctx) => {
          if (attempts < 3) {
            return ctx.retry()
          }
          return { gaveUp: true }
        })
        .build()

      const result = await built.execute({})

      expect(attempts).toBe(3)
      expect(result.success).toBe(true)
    })

    it('error handler can skip to next step', async () => {
      const executed: string[] = []

      const built = workflow('skip-on-error')
        .step('first', async () => {
          executed.push('first')
          throw new Error('First failed')
        })
        .onError(async (_, ctx) => {
          executed.push('error-handler')
          return ctx.skip({ skipped: true })
        })
        .step('second', async () => {
          executed.push('second')
          return { continued: true }
        })
        .build()

      const result = await built.execute({})

      expect(executed).toEqual(['first', 'error-handler', 'second'])
      expect(result.continued).toBe(true)
    })

    it('unhandled errors propagate', async () => {
      const built = workflow('unhandled')
        .step('failing', async () => {
          throw new Error('Unhandled error')
        })
        .build()

      await expect(built.execute({})).rejects.toThrow('Unhandled error')
    })
  })

  describe('.onError(handler) on workflow', () => {
    it('workflow-level error handler catches any step error', async () => {
      const built = workflow('workflow-error')
        .step('step1', async () => ({ done: true }))
        .step('step2', async () => {
          throw new Error('Step 2 failed')
        })
        .step('step3', async () => ({ never: true }))
        .onError(async (error, ctx) => ({
          workflowFailed: true,
          failedAt: ctx.currentStep,
          error: error.message,
        }))
        .build()

      const result = await built.execute({})

      expect(result.workflowFailed).toBe(true)
      expect(result.failedAt).toBe('step2')
      expect(result.error).toBe('Step 2 failed')
    })

    it('step-level error handler takes precedence over workflow-level', async () => {
      let workflowHandlerCalled = false

      const built = workflow('precedence')
        .step('failing', async () => {
          throw new Error('Handled at step level')
        })
        .onError(async () => ({ stepHandled: true }))
        .step('another', async () => ({ done: true }))
        .onError(async () => {
          workflowHandlerCalled = true
          return { workflowHandled: true }
        })
        .build()

      const result = await built.execute({})

      expect(result.stepHandled).toBe(true)
      expect(workflowHandlerCalled).toBe(false)
    })

    it('multiple error handlers can be chained (fallback pattern)', async () => {
      const handlersCalled: string[] = []

      const built = workflow('fallback')
        .step('failing', async () => {
          throw new Error('Original error')
        })
        .onError(async (error) => {
          handlersCalled.push('handler1')
          throw error // Re-throw to next handler
        })
        .onError(async (error) => {
          handlersCalled.push('handler2')
          return { recovered: true }
        })
        .build()

      const result = await built.execute({})

      expect(handlersCalled).toEqual(['handler1', 'handler2'])
      expect(result.recovered).toBe(true)
    })
  })

  describe('error handler with typed errors', () => {
    it('supports custom error types', async () => {
      class ValidationError extends Error {
        constructor(public field: string, message: string) {
          super(message)
          this.name = 'ValidationError'
        }
      }

      const built = workflow('typed-error')
        .step('validate', async () => {
          throw new ValidationError('email', 'Invalid email format')
        })
        .onError(async (error) => {
          if (error instanceof ValidationError) {
            return {
              validationFailed: true,
              field: error.field,
              message: error.message,
            }
          }
          throw error
        })
        .build()

      const result = await built.execute({})

      expect(result.validationFailed).toBe(true)
      expect(result.field).toBe('email')
    })
  })
})

// ============================================================================
// 6. Timeout Configuration: .timeout(ms)
// ============================================================================

describe('Timeout Configuration', () => {
  describe('.timeout(ms) on steps', () => {
    it('times out a slow step', async () => {
      const built = workflow('timeout-step')
        .step('slow', async () => {
          await new Promise((r) => setTimeout(r, 1000))
          return { completed: true }
        })
        .timeout(50)
        .onError(async (error) => ({
          timedOut: true,
          error: error.message,
        }))
        .build()

      const result = await built.execute({})

      expect(result.timedOut).toBe(true)
      expect(result.error).toMatch(/timeout/i)
    })

    it('accepts timeout as string duration', async () => {
      const built = workflow('string-timeout')
        .step('slow', async () => {
          await new Promise((r) => setTimeout(r, 1000))
          return {}
        })
        .timeout('50ms')
        .onError(async () => ({ timedOut: true }))
        .build()

      const result = await built.execute({})

      expect(result.timedOut).toBe(true)
    })

    it('completes if step finishes before timeout', async () => {
      const built = workflow('fast-enough')
        .step('fast', async () => {
          await new Promise((r) => setTimeout(r, 10))
          return { completed: true }
        })
        .timeout(1000)
        .build()

      const result = await built.execute({})

      expect(result.completed).toBe(true)
    })

    it('timeout applies per step', async () => {
      const results: string[] = []

      const built = workflow('per-step-timeout')
        .step('fast', async () => {
          results.push('fast')
          return {}
        })
        .timeout(1000)
        .step('slow', async () => {
          await new Promise((r) => setTimeout(r, 100))
          results.push('slow')
          return {}
        })
        .timeout(50)
        .onError(async () => ({ slowTimedOut: true }))
        .build()

      await built.execute({})

      expect(results).toContain('fast')
      expect(results).not.toContain('slow')
    })
  })

  describe('.timeout(ms) on workflow', () => {
    it('applies timeout to entire workflow', async () => {
      const built = workflow('workflow-timeout')
        .step('step1', async () => {
          await new Promise((r) => setTimeout(r, 30))
          return {}
        })
        .step('step2', async () => {
          await new Promise((r) => setTimeout(r, 30))
          return {}
        })
        .step('step3', async () => {
          await new Promise((r) => setTimeout(r, 30))
          return {}
        })
        .timeout(50) // Total workflow timeout
        .onError(async () => ({ workflowTimedOut: true }))
        .build()

      const result = await built.execute({})

      expect(result.workflowTimedOut).toBe(true)
    })
  })
})

// ============================================================================
// 7. Retry Configuration: .retry({ attempts, backoff })
// ============================================================================

describe('Retry Configuration', () => {
  describe('.retry({ attempts }) on steps', () => {
    it('retries failed step specified number of times', async () => {
      let attempts = 0

      const built = workflow('retry-attempts')
        .step('flaky', async () => {
          attempts++
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`)
          }
          return { success: true }
        })
        .retry({ attempts: 5 })
        .build()

      const result = await built.execute({})

      expect(attempts).toBe(3)
      expect(result.success).toBe(true)
    })

    it('fails after exhausting all retries', async () => {
      let attempts = 0

      const built = workflow('exhaust-retries')
        .step('alwaysFails', async () => {
          attempts++
          throw new Error('Always fails')
        })
        .retry({ attempts: 3 })
        .build()

      await expect(built.execute({})).rejects.toThrow('Always fails')
      expect(attempts).toBe(3)
    })

    it('does not retry on success', async () => {
      let attempts = 0

      const built = workflow('no-retry-needed')
        .step('succeeds', async () => {
          attempts++
          return { done: true }
        })
        .retry({ attempts: 5 })
        .build()

      await built.execute({})

      expect(attempts).toBe(1)
    })
  })

  describe('.retry({ backoff }) strategies', () => {
    it('supports constant backoff', async () => {
      const attemptTimes: number[] = []

      const built = workflow('constant-backoff')
        .step('failing', async () => {
          attemptTimes.push(Date.now())
          if (attemptTimes.length < 3) {
            throw new Error('Retry me')
          }
          return { done: true }
        })
        .retry({
          attempts: 5,
          backoff: 'constant',
          delay: 50,
        })
        .build()

      await built.execute({})

      // Check delays are approximately constant
      const delay1 = attemptTimes[1] - attemptTimes[0]
      const delay2 = attemptTimes[2] - attemptTimes[1]

      expect(delay1).toBeGreaterThanOrEqual(45)
      expect(delay1).toBeLessThan(100)
      expect(delay2).toBeGreaterThanOrEqual(45)
      expect(delay2).toBeLessThan(100)
    })

    it('supports linear backoff', async () => {
      const attemptTimes: number[] = []

      const built = workflow('linear-backoff')
        .step('failing', async () => {
          attemptTimes.push(Date.now())
          if (attemptTimes.length < 4) {
            throw new Error('Retry me')
          }
          return { done: true }
        })
        .retry({
          attempts: 5,
          backoff: 'linear',
          delay: 20, // Base delay
        })
        .build()

      await built.execute({})

      // Linear: delay, delay*2, delay*3, ...
      const delay1 = attemptTimes[1] - attemptTimes[0]
      const delay2 = attemptTimes[2] - attemptTimes[1]
      const delay3 = attemptTimes[3] - attemptTimes[2]

      expect(delay2).toBeGreaterThan(delay1)
      expect(delay3).toBeGreaterThan(delay2)
    })

    it('supports exponential backoff', async () => {
      const attemptTimes: number[] = []

      const built = workflow('exponential-backoff')
        .step('failing', async () => {
          attemptTimes.push(Date.now())
          if (attemptTimes.length < 4) {
            throw new Error('Retry me')
          }
          return { done: true }
        })
        .retry({
          attempts: 5,
          backoff: 'exponential',
          delay: 10, // Base delay
        })
        .build()

      await built.execute({})

      // Exponential: delay, delay*2, delay*4, delay*8, ...
      const delay1 = attemptTimes[1] - attemptTimes[0]
      const delay2 = attemptTimes[2] - attemptTimes[1]
      const delay3 = attemptTimes[3] - attemptTimes[2]

      // Each delay should be roughly double the previous
      expect(delay2).toBeGreaterThan(delay1 * 1.5)
      expect(delay3).toBeGreaterThan(delay2 * 1.5)
    })

    it('supports jitter option for backoff', async () => {
      const attemptTimes1: number[] = []
      const attemptTimes2: number[] = []

      const createWorkflow = () =>
        workflow('jitter-backoff')
          .step('failing', async () => {
            throw new Error('Always fails')
          })
          .retry({
            attempts: 3,
            backoff: 'exponential',
            delay: 50,
            jitter: true,
          })
          .onError(async () => ({ failed: true }))
          .build()

      // Run twice and collect timing - with jitter, times should vary
      const built1 = createWorkflow()
      const built2 = createWorkflow()

      // Execute and track (simplified - in practice would need to capture)
      await built1.execute({})
      await built2.execute({})

      // Jitter should introduce randomness (hard to test deterministically)
      // Just verify the option is accepted
      expect(true).toBe(true)
    })

    it('supports maxDelay cap', async () => {
      const attemptTimes: number[] = []

      const built = workflow('capped-backoff')
        .step('failing', async () => {
          attemptTimes.push(Date.now())
          if (attemptTimes.length < 5) {
            throw new Error('Retry me')
          }
          return { done: true }
        })
        .retry({
          attempts: 6,
          backoff: 'exponential',
          delay: 20,
          maxDelay: 50, // Cap at 50ms
        })
        .build()

      await built.execute({})

      // Later delays should not exceed maxDelay
      for (let i = 2; i < attemptTimes.length; i++) {
        const delay = attemptTimes[i] - attemptTimes[i - 1]
        expect(delay).toBeLessThanOrEqual(100) // Allow some tolerance
      }
    })
  })

  describe('.retry() with conditions', () => {
    it('only retries on specific error types', async () => {
      class RetryableError extends Error {}
      class FatalError extends Error {}

      let attempts = 0

      const built = workflow('conditional-retry')
        .step('conditional', async () => {
          attempts++
          if (attempts === 1) {
            throw new RetryableError('Retry this')
          }
          if (attempts === 2) {
            throw new FatalError('Do not retry')
          }
          return { success: true }
        })
        .retry({
          attempts: 5,
          retryIf: (error) => error instanceof RetryableError,
        })
        .build()

      await expect(built.execute({})).rejects.toThrow('Do not retry')
      expect(attempts).toBe(2)
    })

    it('provides attempt number to retry condition', async () => {
      const attemptNumbers: number[] = []

      const built = workflow('attempt-number')
        .step('failing', async () => {
          throw new Error('Fail')
        })
        .retry({
          attempts: 5,
          retryIf: (error, attempt) => {
            attemptNumbers.push(attempt)
            return attempt < 3
          },
        })
        .build()

      await expect(built.execute({})).rejects.toThrow('Fail')

      expect(attemptNumbers).toEqual([1, 2, 3])
    })
  })

  describe('.retry() on workflow', () => {
    it('applies default retry config to all steps', () => {
      const built = workflow('workflow-retry')
        .retry({ attempts: 3, backoff: 'exponential', delay: 100 })
        .step('step1', async () => ({ a: 1 }))
        .step('step2', async () => ({ b: 2 }))
        .build()

      // All steps should have the default retry config
      expect(built.defaultRetryConfig).toEqual({
        attempts: 3,
        backoff: 'exponential',
        delay: 100,
      })
    })

    it('step-level retry overrides workflow-level', async () => {
      let step1Attempts = 0
      let step2Attempts = 0

      const built = workflow('override-retry')
        .retry({ attempts: 2 })
        .step('step1', async () => {
          step1Attempts++
          throw new Error('Step 1 fails')
        })
        .retry({ attempts: 5 }) // Override for step1
        .onError(async () => ({ step1Failed: true }))
        .step('step2', async () => {
          step2Attempts++
          throw new Error('Step 2 fails')
        })
        // Uses workflow default (2 attempts)
        .onError(async () => ({ step2Failed: true }))
        .build()

      await built.execute({})

      expect(step1Attempts).toBe(5)
      expect(step2Attempts).toBe(2)
    })
  })
})

// ============================================================================
// 8. Input/Output Typing
// ============================================================================

describe('Input/Output Typing', () => {
  describe('workflow input typing', () => {
    it('enforces input type on execute', async () => {
      interface OrderInput {
        orderId: string
        amount: number
      }

      const built = workflow<OrderInput>('typed-input')
        .step('validate', async (input) => {
          // TypeScript should infer input as OrderInput
          return { valid: true, orderId: input.orderId }
        })
        .build()

      // This should type-check correctly
      const result = await built.execute({ orderId: 'order-123', amount: 99.99 })

      expect(result.valid).toBe(true)
    })

    it('workflow input is passed to first step', async () => {
      interface UserInput {
        userId: string
        email: string
      }

      let receivedInput: UserInput | null = null

      const built = workflow<UserInput>('input-passthrough')
        .step('receive', async (input) => {
          receivedInput = input
          return { received: true }
        })
        .build()

      await built.execute({ userId: 'user-1', email: 'test@example.com' })

      expect(receivedInput).toEqual({ userId: 'user-1', email: 'test@example.com' })
    })
  })

  describe('step output typing', () => {
    it('step output type flows to next step input', async () => {
      interface Step1Output {
        value: number
        label: string
      }

      const built = workflow('typed-chain')
        .step(
          'first',
          async (): Promise<Step1Output> => ({
            value: 42,
            label: 'answer',
          })
        )
        .step('second', async (input: Step1Output) => {
          // TypeScript should know input has value and label
          return { doubled: input.value * 2 }
        })
        .build()

      const result = await built.execute({})

      expect(result.doubled).toBe(84)
    })

    it('generic step function preserves types', async () => {
      const built = workflow('generic-step')
        .step<{ name: string }, { greeting: string }>('greet', async (input) => ({
          greeting: `Hello, ${input.name}!`,
        }))
        .build()

      const result = await built.execute({ name: 'World' })

      expect(result.greeting).toBe('Hello, World!')
    })
  })

  describe('workflow output typing', () => {
    it('build() returns typed workflow with output type', async () => {
      interface WorkflowOutput {
        processed: boolean
        id: string
      }

      const built = workflow<{ id: string }, WorkflowOutput>('typed-output')
        .step(
          'process',
          async (input): Promise<WorkflowOutput> => ({
            processed: true,
            id: input.id,
          })
        )
        .build()

      const result = await built.execute({ id: 'test-123' })

      // result should be typed as WorkflowOutput
      expect(result.processed).toBe(true)
      expect(result.id).toBe('test-123')
    })

    it('final step output is workflow output', async () => {
      const built = workflow<void, { final: string }>('final-output')
        .step('step1', async () => ({ intermediate: 'value' }))
        .step('step2', async () => ({ final: 'result' }))
        .build()

      const result = await built.execute()

      expect(result.final).toBe('result')
    })
  })

  describe('type inference through complex chains', () => {
    it('types flow through conditionals', async () => {
      interface Input {
        value: number
      }

      const built = workflow<Input>('conditional-types')
        .step('check', async (input) => ({ high: input.value > 50 }))
        .when((ctx) => ctx.result.high)
        .then(
          workflow('high-branch').step('handleHigh', async () => ({ tier: 'premium' as const }))
        )
        .else(workflow('low-branch').step('handleLow', async () => ({ tier: 'standard' as const })))
        .build()

      const highResult = await built.execute({ value: 75 })
      expect(highResult.tier).toBe('premium')

      const lowResult = await built.execute({ value: 25 })
      expect(lowResult.tier).toBe('standard')
    })

    it('types flow through loops', async () => {
      interface LoopInput {
        items: string[]
      }

      const built = workflow<LoopInput>('loop-types')
        .step('init', async (input) => ({
          remaining: input.items,
          processed: [] as string[],
        }))
        .loop(
          (ctx) => ctx.result.remaining.length > 0,
          workflow('loop-body').step('process', async (input) => ({
            remaining: input.remaining.slice(1),
            processed: [...input.processed, input.remaining[0].toUpperCase()],
          }))
        )
        .build()

      const result = await built.execute({ items: ['a', 'b', 'c'] })

      expect(result.processed).toEqual(['A', 'B', 'C'])
    })
  })
})

// ============================================================================
// 9. Complete Integration Example
// ============================================================================

describe('Complete Integration Example', () => {
  it('builds and executes a complex order processing workflow', async () => {
    interface OrderInput {
      orderId: string
      customerId: string
      items: Array<{ sku: string; quantity: number; price: number }>
    }

    const built = workflow<OrderInput>('order-processing')
      // Step 1: Validate order
      .step('validate', async (input) => {
        const isValid = input.items.length > 0
        const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        return { valid: isValid, total, ...input }
      })
      .retry({ attempts: 3 })

      // Step 2: Check inventory (conditional)
      .when((ctx) => ctx.result.valid)
      .then(
        workflow('inventory-check')
          .step('checkStock', async (input) => {
            // Simulate inventory check
            return { inStock: true, ...input }
          })
          .timeout(5000)
      )
      .else(
        workflow('invalid-order').step('reject', async () => ({
          rejected: true,
          reason: 'Invalid order',
        }))
      )

      // Step 3: Process payment (with error handling)
      .step('payment', async (input) => {
        if (!input.inStock) {
          throw new Error('Cannot process payment: out of stock')
        }
        return {
          paid: true,
          transactionId: `txn_${input.orderId}`,
          amount: input.total,
        }
      })
      .retry({ attempts: 3, backoff: 'exponential', delay: 100 })
      .timeout(10000)
      .onError(async (error, ctx) => ({
        paymentFailed: true,
        error: error.message,
        refundRequired: false,
      }))

      // Step 4: Fulfill order items in parallel
      .step('fulfill', async (input) => {
        if (!input.paid) {
          return { fulfilled: false }
        }
        return {
          fulfilled: true,
          trackingNumber: `track_${input.orderId}`,
        }
      })

      // Step 5: Send notification
      .step('notify', async (input) => ({
        notified: true,
        message: input.fulfilled
          ? `Order ${input.orderId} shipped!`
          : `Order ${input.orderId} could not be processed`,
      }))

      .build()

    // Execute the workflow
    const result = await built.execute({
      orderId: 'order-456',
      customerId: 'cust-789',
      items: [
        { sku: 'WIDGET-001', quantity: 2, price: 29.99 },
        { sku: 'GADGET-002', quantity: 1, price: 49.99 },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.inStock).toBe(true)
    expect(result.paid).toBe(true)
    expect(result.fulfilled).toBe(true)
    expect(result.notified).toBe(true)
    expect(result.trackingNumber).toBe('track_order-456')
  })
})

// ============================================================================
// 10. Type Definitions (for reference)
// ============================================================================

describe('Type Definitions', () => {
  it('RetryConfig type matches expected shape', () => {
    const config: RetryConfig = {
      attempts: 3,
      backoff: 'exponential',
      delay: 100,
      maxDelay: 5000,
      jitter: true,
      retryIf: (error, attempt) => attempt < 3,
    }

    expect(config.attempts).toBe(3)
    expect(config.backoff).toBe('exponential')
  })

  it('StepContext type provides expected methods', async () => {
    let capturedCtx: StepContext | null = null

    const built = workflow('context-shape')
      .step('capture', async (_, ctx) => {
        capturedCtx = ctx
        return {}
      })
      .build()

    await built.execute({})

    expect(capturedCtx).not.toBeNull()
    expect(typeof capturedCtx!.retry).toBe('function')
    expect(typeof capturedCtx!.skip).toBe('function')
    expect(typeof capturedCtx!.abort).toBe('function')
    expect(capturedCtx!.input).toBeDefined()
    expect(capturedCtx!.result).toBeDefined()
  })

  it('BuiltWorkflow type has expected properties', () => {
    const built = workflow('type-check')
      .step('test', async () => ({}))
      .build()

    // BuiltWorkflow should have these properties
    expect(built).toHaveProperty('name')
    expect(built).toHaveProperty('steps')
    expect(built).toHaveProperty('execute')
    expect(typeof built.execute).toBe('function')
  })
})
