/**
 * Tests for the Cloudflare Workflows DurableExecutionAdapter.
 *
 * The adapter bridges the port (`run`/`step`/`sleep`/`waitForEvent`/`schedule`)
 * to CF's class-based runtime (`WorkflowEntrypoint.run(event, step)` +
 * `step.do`/`step.sleep`/`step.waitForEvent`). These tests do not require a
 * real CF account or Miniflare — they use a structurally-typed fake binding
 * (`WorkflowsBindingLike`) and a fake `WorkflowStepLike` to exercise the
 * bridge logic directly.
 *
 * The structural-fake pattern mirrors `do-sqlite-adapter.test.ts` from
 * `ai-database`: declare the minimal subset of the CF surface as TypeScript
 * interfaces, hand-build a JS object satisfying the interface, and assert
 * against the captured calls.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  createCloudflareWorkflowsDurableExecution,
  createWorkflowEntrypoint,
  DurableStepError,
  WaitForEventTimeoutError,
  type CloudflareWorkflowsDurableExecution,
  type DurableExecutionAdapter,
  type WorkflowEnvelope,
  type WorkflowEventLike,
  type WorkflowInstanceLike,
  type WorkflowsBindingLike,
  type WorkflowStepLike,
  type WorkflowStepConfigLike,
} from '../src/durable-execution.js'

// =============================================================================
// Fakes
// =============================================================================

/**
 * Build a fake `Workflow` binding whose `create()` returns an instance whose
 * `status()` cycles through the supplied statuses (last entry sticks). The
 * instance also captures any `params` it was created with for assertions.
 */
function makeFakeBinding(
  options: {
    statuses?: Array<{
      status: string
      output?: unknown
      error?: { name: string; message: string }
    }>
  } = {}
): {
  binding: WorkflowsBindingLike
  created: Array<{ id: string; params: WorkflowEnvelope | undefined }>
  instances: WorkflowInstanceLike[]
} {
  const created: Array<{ id: string; params: WorkflowEnvelope | undefined }> = []
  const instances: WorkflowInstanceLike[] = []
  let seq = 0
  const baseStatuses = options.statuses ?? [{ status: 'complete', output: 'ok' }]

  const binding: WorkflowsBindingLike = {
    async create(opts) {
      const id = opts?.id ?? `fake-${++seq}`
      created.push({ id, params: opts?.params as WorkflowEnvelope | undefined })
      let i = 0
      const statusCalls: number[] = []
      const inst: WorkflowInstanceLike = {
        id,
        async status() {
          const idx = Math.min(i++, baseStatuses.length - 1)
          statusCalls.push(idx)
          return baseStatuses[idx]! as Awaited<ReturnType<WorkflowInstanceLike['status']>>
        },
      }
      instances.push(inst)
      return inst
    },
    async get(id: string) {
      const found = instances.find((inst) => inst.id === id)
      if (!found) throw new Error(`unknown instance ${id}`)
      return found
    },
  }

  return { binding, created, instances }
}

/**
 * Build a fake CF `WorkflowStep` that records every call. `do` invokes the
 * callback synchronously; `sleep`/`sleepUntil` no-op; `waitForEvent` resolves
 * to a configured value or throws if `throwTimeout` is set.
 */
function makeFakeStep(
  options: {
    eventValues?: Record<string, unknown>
    throwTimeout?: boolean
  } = {}
): {
  step: WorkflowStepLike
  doCalls: Array<{ name: string; config?: WorkflowStepConfigLike }>
  sleepCalls: Array<{ name: string; duration: string | number }>
  sleepUntilCalls: Array<{ name: string; timestamp: Date | number }>
  waitCalls: Array<{ name: string; type: string; timeout?: string | number }>
} {
  const doCalls: Array<{ name: string; config?: WorkflowStepConfigLike }> = []
  const sleepCalls: Array<{ name: string; duration: string | number }> = []
  const sleepUntilCalls: Array<{ name: string; timestamp: Date | number }> = []
  const waitCalls: Array<{ name: string; type: string; timeout?: string | number }> = []

  const step: WorkflowStepLike = {
    do: (async (
      name: string,
      configOrFn: WorkflowStepConfigLike | (() => Promise<unknown>),
      maybeFn?: () => Promise<unknown>
    ) => {
      if (typeof configOrFn === 'function') {
        doCalls.push({ name })
        return configOrFn()
      }
      doCalls.push({ name, config: configOrFn })
      return maybeFn!()
    }) as WorkflowStepLike['do'],
    async sleep(name, duration) {
      sleepCalls.push({ name, duration })
    },
    async sleepUntil(name, timestamp) {
      sleepUntilCalls.push({ name, timestamp })
    },
    async waitForEvent<T = unknown>(
      name: string,
      opts: { type: string; timeout?: string | number }
    ): Promise<T> {
      const entry: { name: string; type: string; timeout?: string | number } = {
        name,
        type: opts.type,
      }
      if (opts.timeout !== undefined) entry.timeout = opts.timeout
      waitCalls.push(entry)
      if (options.throwTimeout) {
        throw new Error(`timed out waiting for ${opts.type}`)
      }
      const value = options.eventValues?.[opts.type]
      // Match CF's envelope shape; the adapter unwraps `payload`.
      return { payload: value, type: opts.type, timestamp: new Date() } as unknown as T
    },
  }

  return { step, doCalls, sleepCalls, sleepUntilCalls, waitCalls }
}

// =============================================================================
// Tests
// =============================================================================

describe('createCloudflareWorkflowsDurableExecution', () => {
  it('exposes the cloudflare kind discriminant', () => {
    const { binding } = makeFakeBinding()
    const dx = createCloudflareWorkflowsDurableExecution({ binding })
    expect(dx.kind).toBe('cloudflare')
  })

  it('declares the documented limits (25K steps, 50K concurrent, 365 days, 1 MiB)', () => {
    const { binding } = makeFakeBinding()
    const dx = createCloudflareWorkflowsDurableExecution({ binding })
    expect(dx.limits).toEqual({
      maxSteps: 25_000,
      maxConcurrentInstances: 50_000,
      maxSleepDays: 365,
      maxPayloadBytes: 1_048_576,
    })
  })

  it('satisfies the DurableExecutionAdapter port', () => {
    const { binding } = makeFakeBinding()
    const adapter: DurableExecutionAdapter = createCloudflareWorkflowsDurableExecution({ binding })
    expect(adapter.kind).toBe('cloudflare')
  })

  it('accepts a thunk for the binding so per-request env access works', async () => {
    const { binding, created } = makeFakeBinding()
    const thunk = vi.fn(() => binding)
    const dx = createCloudflareWorkflowsDurableExecution({ binding: thunk })
    dx.register('echo', async (ctx) => ctx.input)
    await dx.run('echo', async (ctx) => ctx.input, { hello: 'world' })
    expect(thunk).toHaveBeenCalled()
    expect(created).toHaveLength(1)
  })

  describe('run() — triggering through the binding', () => {
    it('creates an instance via binding.create with the wf-name/input envelope', async () => {
      const { binding, created } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      await dx.run('cascade', async (ctx) => ctx.input, { customerId: 'c-1' })
      expect(created).toHaveLength(1)
      expect(created[0]!.params).toEqual({
        __wfName: 'cascade',
        __wfInput: { customerId: 'c-1' },
      })
    })

    it('returns the workflow output when status reaches complete', async () => {
      const { binding } = makeFakeBinding({
        statuses: [{ status: 'complete', output: 42 }],
      })
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        delay: async () => {},
      })
      const result = await dx.run('compute', async () => 42, undefined)
      expect(result).toBe(42)
    })

    it('polls until the instance terminates', async () => {
      const { binding } = makeFakeBinding({
        statuses: [
          { status: 'queued' },
          { status: 'running' },
          { status: 'waiting' },
          { status: 'complete', output: 'done' },
        ],
      })
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        pollIntervalMs: 1,
        delay: async () => {},
      })
      const result = await dx.run('slow', async () => 'done', undefined)
      expect(result).toBe('done')
    })

    it('throws DurableStepError with retryable=false when status is errored', async () => {
      const { binding } = makeFakeBinding({
        statuses: [{ status: 'errored', error: { name: 'BoomError', message: 'kaboom' } }],
      })
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        delay: async () => {},
      })
      await expect(dx.run('bad', async () => 'unused', undefined)).rejects.toMatchObject({
        name: 'DurableStepError',
        retryable: false,
      })
    })

    it('throws DurableStepError when polling exceeds pollTimeoutMs', async () => {
      const { binding } = makeFakeBinding({
        statuses: [{ status: 'running' }],
      })
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        pollIntervalMs: 1,
        pollTimeoutMs: 0, // immediate timeout after first poll
        delay: async () => {},
      })
      await expect(dx.run('hang', async () => 'unused', undefined)).rejects.toBeInstanceOf(
        DurableStepError
      )
    })

    it('returns the instance handle when waitForCompletion is false', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        waitForCompletion: false,
      })
      const result = (await dx.run('fire', async () => 'unused', undefined)) as unknown
      expect(result).toBeDefined()
      expect(typeof (result as WorkflowInstanceLike).id).toBe('string')
    })

    it('implicitly registers the workflow body the first time run is called', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        delay: async () => {},
      })
      const fn = vi.fn(async () => 'ok')
      await dx.run('implicit', fn, undefined)
      // The body is then dispatchable through the entrypoint handler:
      const { step } = makeFakeStep()
      const event: WorkflowEventLike<WorkflowEnvelope> = {
        payload: { __wfName: 'implicit', __wfInput: undefined },
        instanceId: 'inst-1',
      }
      await dx.entrypointHandler(event, step)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('entrypointHandler — bridge from CF run(event, step) to the body', () => {
    it('throws when the event payload is missing the __wfName envelope', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const { step } = makeFakeStep()
      await expect(
        dx.entrypointHandler({ payload: { not: 'an envelope' } } as WorkflowEventLike, step)
      ).rejects.toThrow(/missing __wfName/)
    })

    it('throws when the workflow name is not registered', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const { step } = makeFakeStep()
      await expect(
        dx.entrypointHandler(
          { payload: { __wfName: 'unknown', __wfInput: null } } as WorkflowEventLike,
          step
        )
      ).rejects.toThrow(/no workflow registered for name "unknown"/)
    })

    it('passes input through to ctx.input', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const fn = vi.fn(async (ctx: { input: { x: number } }) => ctx.input.x * 2)
      dx.register('double', fn as unknown as Parameters<typeof dx.register>[1])
      const { step } = makeFakeStep()
      const result = await dx.entrypointHandler(
        {
          payload: { __wfName: 'double', __wfInput: { x: 21 } },
          instanceId: 'inst-double',
        } as WorkflowEventLike,
        step
      )
      expect(result).toBe(42)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('supplies ctx.instanceId from the event', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      let captured: string | undefined
      dx.register('capture', async (ctx) => {
        captured = ctx.instanceId
      })
      const { step } = makeFakeStep()
      await dx.entrypointHandler(
        {
          payload: { __wfName: 'capture', __wfInput: null },
          instanceId: 'inst-xyz',
        } as WorkflowEventLike,
        step
      )
      expect(captured).toBe('inst-xyz')
    })
  })

  describe('ctx.step — translates to step.do', () => {
    it('forwards step name and callback to step.do', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const fn = vi.fn(async () => 'value')
      dx.register('uses-step', async (ctx) => ctx.step('compute', fn))
      const { step, doCalls } = makeFakeStep()
      const result = await dx.entrypointHandler(
        { payload: { __wfName: 'uses-step', __wfInput: null } } as WorkflowEventLike,
        step
      )
      expect(result).toBe('value')
      expect(doCalls).toEqual([{ name: 'compute' }])
      expect(fn).toHaveBeenCalledOnce()
    })

    it('forwards step config to step.do(name, config, fn)', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      dx.register('cfg-step', async (ctx) =>
        ctx.step(
          'flaky',
          { retries: { limit: 3, delay: '1 second', backoff: 'exponential' } },
          async () => 'ok'
        )
      )
      const { step, doCalls } = makeFakeStep()
      await dx.entrypointHandler(
        { payload: { __wfName: 'cfg-step', __wfInput: null } } as WorkflowEventLike,
        step
      )
      expect(doCalls).toHaveLength(1)
      expect(doCalls[0]!.name).toBe('flaky')
      expect(doCalls[0]!.config).toEqual({
        retries: { limit: 3, delay: '1 second', backoff: 'exponential' },
      })
    })
  })

  describe('ctx.sleep / ctx.sleepUntil — translate to step.sleep/sleepUntil', () => {
    it('synthesises stable, deterministic step names for sleeps', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      dx.register('sleeper', async (ctx) => {
        await ctx.sleep('1 second')
        await ctx.sleep(500)
        await ctx.sleep('1 minute')
      })
      const { step, sleepCalls } = makeFakeStep()
      await dx.entrypointHandler(
        { payload: { __wfName: 'sleeper', __wfInput: null } } as WorkflowEventLike,
        step
      )
      expect(sleepCalls).toEqual([
        { name: '__sleep__1', duration: '1 second' },
        { name: '__sleep__2', duration: 500 },
        { name: '__sleep__3', duration: '1 minute' },
      ])
    })

    it('forwards sleepUntil with auto-named steps', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const date = new Date('2030-01-01T00:00:00.000Z')
      dx.register('until', async (ctx) => {
        await ctx.sleepUntil(date)
      })
      const { step, sleepUntilCalls } = makeFakeStep()
      await dx.entrypointHandler(
        { payload: { __wfName: 'until', __wfInput: null } } as WorkflowEventLike,
        step
      )
      expect(sleepUntilCalls).toEqual([{ name: '__sleepUntil__1', timestamp: date }])
    })
  })

  describe('ctx.waitForEvent — translates to step.waitForEvent', () => {
    it('forwards type and timeout to step.waitForEvent', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      dx.register('waiter', async (ctx) => {
        const value = await ctx.waitForEvent<string>('Order.placed', '5 minutes')
        return value
      })
      const { step, waitCalls } = makeFakeStep({
        eventValues: { 'Order.placed': 'order-1' },
      })
      const result = await dx.entrypointHandler(
        { payload: { __wfName: 'waiter', __wfInput: null } } as WorkflowEventLike,
        step
      )
      expect(result).toBe('order-1')
      expect(waitCalls).toEqual([
        { name: '__waitForEvent__Order.placed__1', type: 'Order.placed', timeout: '5 minutes' },
      ])
    })

    it('omits timeout when the caller did not pass one', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      dx.register('forever', async (ctx) => ctx.waitForEvent('whenever'))
      const { step, waitCalls } = makeFakeStep({
        eventValues: { whenever: 'eventually' },
      })
      await dx.entrypointHandler(
        { payload: { __wfName: 'forever', __wfInput: null } } as WorkflowEventLike,
        step
      )
      expect(waitCalls).toEqual([{ name: '__waitForEvent__whenever__1', type: 'whenever' }])
    })

    it('translates CF timeout errors to WaitForEventTimeoutError when timeout was set', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      dx.register('times-out', async (ctx) => ctx.waitForEvent('never', '1 second'))
      const { step } = makeFakeStep({ throwTimeout: true })
      await expect(
        dx.entrypointHandler(
          { payload: { __wfName: 'times-out', __wfInput: null } } as WorkflowEventLike,
          step
        )
      ).rejects.toBeInstanceOf(WaitForEventTimeoutError)
    })
  })

  describe('schedule / defineSchedule / runSchedule', () => {
    it('returns a subscription whose id equals the workflow name', () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const sub = dx.defineSchedule('nightly', '0 0 * * *', async () => undefined)
      expect(sub.id).toBe('nightly')
    })

    it('runSchedule triggers the registered body via binding.create', async () => {
      const { binding, created } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        delay: async () => {},
      })
      const fn = vi.fn(async () => 'scheduled-result')
      dx.defineSchedule('nightly', '0 0 * * *', fn)
      const result = await dx.runSchedule('nightly')
      expect(created).toHaveLength(1)
      expect(created[0]!.params).toEqual({
        __wfName: 'nightly',
        __wfInput: undefined,
      })
      // Default polling completes from the default fake binding.
      expect(result).toBe('ok')
    })

    it('runSchedule throws when the schedule is not registered', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      await expect(dx.runSchedule('missing')).rejects.toThrow(/no schedule registered/)
    })

    it('unsubscribe removes the schedule registration', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const sub = dx.defineSchedule('weekly', '0 0 * * 0', async () => undefined)
      sub.unsubscribe()
      await expect(dx.runSchedule('weekly')).rejects.toThrow(/no schedule registered/)
    })
  })

  describe('top-level surface (outside a body)', () => {
    it('top-level step() invokes the function once (no memoization, no CF involvement)', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      const fn = vi.fn(async () => 'value')
      const result = await dx.step('once', fn)
      expect(result).toBe('value')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('top-level sleep delegates to the configured delay', async () => {
      const { binding } = makeFakeBinding()
      const sleeps: number[] = []
      const dx = createCloudflareWorkflowsDurableExecution({
        binding,
        delay: async (ms) => {
          sleeps.push(ms)
        },
      })
      await dx.sleep('500ms')
      await dx.sleep(250)
      await dx.sleep('1 second')
      expect(sleeps).toEqual([500, 250, 1000])
    })

    it('top-level waitForEvent rejects with a helpful message', async () => {
      const { binding } = makeFakeBinding()
      const dx = createCloudflareWorkflowsDurableExecution({ binding })
      await expect(dx.waitForEvent('Order.placed')).rejects.toThrow(
        /only supported inside a workflow body/
      )
    })
  })
})

describe('createWorkflowEntrypoint', () => {
  it('returns a constructor whose run() forwards to adapter.entrypointHandler', async () => {
    const { binding } = makeFakeBinding()
    const dx: CloudflareWorkflowsDurableExecution = createCloudflareWorkflowsDurableExecution({
      binding,
    })
    const fn = vi.fn(async (ctx: { input: number }) => ctx.input + 1)
    dx.register('inc', fn as unknown as Parameters<typeof dx.register>[1])

    const Entry = createWorkflowEntrypoint(dx)
    // CF instantiates with (ctx, env); we pass dummies.
    const instance = new Entry({}, {}) as unknown as {
      run(event: WorkflowEventLike, step: WorkflowStepLike): Promise<unknown>
    }
    const { step } = makeFakeStep()
    const result = await instance.run(
      {
        payload: { __wfName: 'inc', __wfInput: 41 },
        instanceId: 'cf-1',
      } as WorkflowEventLike,
      step
    )
    expect(result).toBe(42)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('extends a supplied Base class so users can pass cloudflare:workers WorkflowEntrypoint', async () => {
    const { binding } = makeFakeBinding()
    const dx = createCloudflareWorkflowsDurableExecution({ binding })
    dx.register('echo', async (ctx) => ctx.input)

    // Stand-in for `WorkflowEntrypoint` from `cloudflare:workers`. We capture
    // the constructor args to verify the subclass forwards them.
    const baseConstructorCalls: Array<{ ctx: unknown; env: unknown }> = []
    class FakeBase {
      constructor(ctx: unknown, env: unknown) {
        baseConstructorCalls.push({ ctx, env })
      }
      async run(): Promise<unknown> {
        // The generated subclass overrides this; if our subclass doesn't
        // override, we'd return this sentinel.
        return '<base>'
      }
    }

    const Entry = createWorkflowEntrypoint(dx, FakeBase as never)
    const inst = new Entry({ ctxMarker: 1 }, { envMarker: 2 }) as unknown as {
      run(event: WorkflowEventLike, step: WorkflowStepLike): Promise<unknown>
    }
    expect(baseConstructorCalls).toEqual([{ ctx: { ctxMarker: 1 }, env: { envMarker: 2 } }])
    const { step } = makeFakeStep()
    const result = await inst.run(
      { payload: { __wfName: 'echo', __wfInput: 'hi' } } as WorkflowEventLike,
      step
    )
    expect(result).toBe('hi')
  })
})
