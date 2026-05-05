/**
 * Tests for the in-process production DurableExecutionAdapter
 * (`createInProcessDurableExecution`). Covers two modes:
 *
 *   1. Standalone — no runtime supplied. Behaves like the in-memory stub for
 *      callers that want the port without WorkflowRuntime integration.
 *
 *   2. Wrapped — a {@link WorkflowRuntime} supplied at construction time.
 *      Each run/step is reflected in the runtime's history, cascade context,
 *      and (when wired) database.
 *
 * The existing `durable-execution.test.ts` exercises the in-memory stub's port
 * semantics in detail; these tests focus on the integration surface unique to
 * the in-process adapter.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  createInProcessDurableExecution,
  DurableStepError,
  WaitForEventTimeoutError,
  type DurableExecutionAdapter,
  type InProcessWorkflowContext,
} from '../src/durable-execution.js'
import { createWorkflowRuntime } from '../src/runtime.js'
import type { ActionData, DatabaseContext } from '../src/types.js'

describe('createInProcessDurableExecution — standalone (no runtime)', () => {
  it('exposes the in-process kind discriminant', () => {
    const dx = createInProcessDurableExecution()
    expect(dx.kind).toBe('in-process')
  })

  it('satisfies the DurableExecutionAdapter port', () => {
    const adapter: DurableExecutionAdapter = createInProcessDurableExecution()
    expect(adapter.kind).toBe('in-process')
  })

  it('runs a workflow body and returns the result', async () => {
    const dx = createInProcessDurableExecution()
    const result = await dx.run<number, { x: number; y: number }>(
      'sum',
      async (ctx) => ctx.input.x + ctx.input.y,
      { x: 7, y: 8 }
    )
    expect(result).toBe(15)
  })

  it('runtime field is undefined when no runtime is supplied', () => {
    const dx = createInProcessDurableExecution()
    expect(dx.runtime).toBeUndefined()
  })

  it('ctx.runtime is undefined inside a body when no runtime is supplied', async () => {
    const dx = createInProcessDurableExecution()
    let captured: InProcessWorkflowContext<undefined> | null = null
    await dx.run(
      'capture',
      async (ctx) => {
        captured = ctx
      },
      undefined
    )
    expect(captured).not.toBeNull()
    expect(captured!.runtime).toBeUndefined()
  })

  it('memoizes step results within a run (delegates to inner mechanics)', async () => {
    const dx = createInProcessDurableExecution()
    const fn = vi.fn(async () => Math.random())
    const result = await dx.run(
      'memo',
      async (ctx) => {
        const a = await ctx.step('once', fn)
        const b = await ctx.step('once', fn)
        return [a, b]
      },
      undefined
    )
    expect(fn).toHaveBeenCalledTimes(1)
    expect(result[0]).toBe(result[1])
  })

  it('retries failing steps and throws DurableStepError when exhausted', async () => {
    const dx = createInProcessDurableExecution({ delay: async () => {} })
    await expect(
      dx.run(
        'exhaust',
        async (ctx) =>
          ctx.step('boom', { retries: { limit: 2 } }, async () => {
            throw new Error('persistent')
          }),
        undefined
      )
    ).rejects.toBeInstanceOf(DurableStepError)
  })

  it('sleep, sleepUntil, waitForEvent, emit are forwarded from the inner adapter', async () => {
    const sleeps: number[] = []
    const dx = createInProcessDurableExecution({
      delay: async (ms) => {
        sleeps.push(ms)
      },
    })
    await dx.sleep('100ms')
    await dx.sleepUntil(new Date(Date.now() + 50))
    expect(sleeps[0]).toBe(100)
    expect(sleeps.length).toBeGreaterThanOrEqual(1)

    const promise = dx.waitForEvent<string>('go')
    expect(dx.emit('go', 'value')).toBe(true)
    await expect(promise).resolves.toBe('value')

    await expect(dx.waitForEvent('never', 5)).rejects.toBeInstanceOf(WaitForEventTimeoutError)
  })
})

describe('createInProcessDurableExecution — wrapped (runtime integration)', () => {
  it('exposes the runtime through the adapter', () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime })
    expect(dx.runtime).toBe(runtime)
  })

  it('exposes the runtime on the workflow context inside a run', async () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime })
    let captured: InProcessWorkflowContext<undefined> | null = null
    await dx.run(
      'capture',
      async (ctx) => {
        captured = ctx
      },
      undefined
    )
    expect(captured!.runtime).toBe(runtime)
  })

  it('records run start/finish in runtime history', async () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime })
    await dx.run('hello', async () => 'ok', undefined)
    const names = runtime.state.history.map((entry) => entry.name)
    expect(names).toContain('durable-run:start:hello')
    expect(names).toContain('durable-run:finish:hello')
  })

  it('records run errors in runtime history when the body throws', async () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime })
    await expect(
      dx.run(
        'fail',
        async () => {
          throw new Error('nope')
        },
        undefined
      )
    ).rejects.toThrow('nope')
    const names = runtime.state.history.map((entry) => entry.name)
    expect(names).toContain('durable-run:start:fail')
    expect(names).toContain('durable-run:error:fail')
  })

  it('records cascade steps for each durable step', async () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime })
    await dx.run(
      'cascade',
      async (ctx) => {
        await ctx.step('step-a', async () => 'a')
        await ctx.step('step-b', async () => 'b')
      },
      undefined
    )
    const stepNames = runtime.cascade.steps.map((s) => s.name)
    expect(stepNames).toEqual(['step-a', 'step-b'])
    expect(runtime.cascade.steps.every((s) => s.status === 'completed')).toBe(true)
  })

  it('marks cascade step as failed when step throws', async () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime, delay: async () => {} })
    await expect(
      dx.run(
        'fail-step',
        async (ctx) =>
          ctx.step('boom', async () => {
            throw new Error('kaboom')
          }),
        undefined
      )
    ).rejects.toBeInstanceOf(DurableStepError)
    expect(runtime.cascade.steps).toHaveLength(1)
    expect(runtime.cascade.steps[0]!.status).toBe('failed')
    expect(runtime.cascade.steps[0]!.error).toBeInstanceOf(Error)
  })

  it('records step actions through runtime.$.db when configured', async () => {
    const created: ActionData[] = []
    const completed: Array<{ id: string; result: unknown }> = []
    const db: DatabaseContext = {
      recordEvent: async () => {},
      createAction: async (action) => {
        created.push(action)
      },
      completeAction: async (id, result) => {
        completed.push({ id, result })
      },
      storeArtifact: async () => {},
      getArtifact: async () => null,
    }
    const runtime = createWorkflowRuntime({ db })
    const dx = createInProcessDurableExecution({ runtime })

    await dx.run(
      'with-db',
      async (ctx) => {
        await ctx.step('write', async () => 'ok')
      },
      undefined
    )

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      actor: 'workflow',
      object: 'write',
      action: 'step',
      status: 'active',
    })
    expect(completed).toEqual([{ id: 'write', result: 'ok' }])
  })

  it('does not fail the step when db.createAction itself throws', async () => {
    const db: DatabaseContext = {
      recordEvent: async () => {},
      createAction: async () => {
        throw new Error('db down')
      },
      completeAction: async () => {},
      storeArtifact: async () => {},
      getArtifact: async () => null,
    }
    const runtime = createWorkflowRuntime({ db })
    const dx = createInProcessDurableExecution({ runtime })

    const result = await dx.run(
      'tolerant',
      async (ctx) => ctx.step('write', async () => 'still-ok'),
      undefined
    )
    expect(result).toBe('still-ok')
  })

  it('integrates with $.send: durable workflow can dispatch to runtime handlers', async () => {
    const runtime = createWorkflowRuntime()
    const handler = vi.fn()
    runtime.register('Plan', 'generated', handler)
    const dx = createInProcessDurableExecution({ runtime })

    await dx.run(
      'cascade',
      async (ctx) => {
        const plan = await ctx.step('plan', async () => ({ id: 'p-1' }))
        ctx.runtime!.$.send('Plan.generated', plan)
      },
      undefined
    )

    // Wait a tick for the async send to deliver.
    await Promise.resolve()
    await Promise.resolve()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' }), runtime.$)
  })

  it('top-level step (outside a run) also records a cascade step', async () => {
    const runtime = createWorkflowRuntime()
    const dx = createInProcessDurableExecution({ runtime })
    await dx.step('one-off', async () => 'done')
    expect(runtime.cascade.steps).toHaveLength(1)
    expect(runtime.cascade.steps[0]!.name).toBe('one-off')
    expect(runtime.cascade.steps[0]!.status).toBe('completed')
  })
})
