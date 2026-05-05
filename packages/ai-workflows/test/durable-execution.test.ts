/**
 * Tests for the DurableExecutionAdapter port and its in-memory stub.
 *
 * The in-memory stub is the only adapter shipped in this bead (Phase 0). The
 * goal of these tests is twofold: (1) prove the port shape compiles and is
 * exercisable end-to-end without leaning on a real backend; (2) document the
 * port semantics callers can rely on across all adapters (run, step memo,
 * retries, sleep, waitForEvent timeouts, schedule subscription).
 */

import { describe, expect, it, vi } from 'vitest'

import {
  createInMemoryDurableExecution,
  DurableStepError,
  WaitForEventTimeoutError,
  type DurableExecutionAdapter,
  type WorkflowContext,
} from '../src/durable-execution.js'

describe('DurableExecutionAdapter port', () => {
  it('exposes the documented kind discriminant', () => {
    const dx = createInMemoryDurableExecution()
    expect(dx.kind).toBe('in-process')
  })

  it('runs a workflow body with the supplied input', async () => {
    const dx = createInMemoryDurableExecution()
    const result = await dx.run<number, { x: number; y: number }>(
      'sum',
      async (ctx) => ctx.input.x + ctx.input.y,
      { x: 2, y: 3 }
    )
    expect(result).toBe(5)
  })

  it('passes a context with stable instanceId and name', async () => {
    const dx = createInMemoryDurableExecution()
    let captured: WorkflowContext<undefined> | null = null
    await dx.run(
      'named',
      async (ctx) => {
        captured = ctx
      },
      undefined
    )
    expect(captured).not.toBeNull()
    expect(captured!.name).toBe('named')
    expect(typeof captured!.instanceId).toBe('string')
    expect(captured!.instanceId.length).toBeGreaterThan(0)
  })

  it('memoizes step results within a run', async () => {
    const dx = createInMemoryDurableExecution()
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

  it('retries failing steps according to config', async () => {
    const dx = createInMemoryDurableExecution({ delay: async () => {} })
    let attempts = 0
    const result = await dx.run(
      'retry',
      async (ctx) => {
        return ctx.step('flaky', { retries: { limit: 3, delay: 10 } }, async () => {
          attempts++
          if (attempts < 3) throw new Error('transient')
          return 'ok'
        })
      },
      undefined
    )
    expect(attempts).toBe(3)
    expect(result).toBe('ok')
  })

  it('throws DurableStepError when retries are exhausted', async () => {
    const dx = createInMemoryDurableExecution({ delay: async () => {} })
    const cause = new Error('persistent')
    await expect(
      dx.run(
        'exhaust',
        async (ctx) => {
          return ctx.step('always-fails', { retries: { limit: 2 } }, async () => {
            throw cause
          })
        },
        undefined
      )
    ).rejects.toMatchObject({
      name: 'DurableStepError',
      stepName: 'always-fails',
      attempts: 2,
      retryable: true,
      cause,
    })
  })

  it('exposes DurableStepError as an Error instance with cause', async () => {
    const dx = createInMemoryDurableExecution({ delay: async () => {} })
    let caught: unknown
    try {
      await dx.run(
        'exhaust2',
        async (ctx) =>
          ctx.step('boom', async () => {
            throw new Error('nope')
          }),
        undefined
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).toBeInstanceOf(DurableStepError)
  })

  it('sleeps for the requested duration (string form)', async () => {
    const sleeps: number[] = []
    const dx = createInMemoryDurableExecution({
      delay: async (ms) => {
        sleeps.push(ms)
      },
    })
    await dx.run(
      'sleeper',
      async (ctx) => {
        await ctx.sleep('500ms')
        await ctx.sleep(250)
        await ctx.sleep('1 second')
      },
      undefined
    )
    expect(sleeps).toEqual([500, 250, 1000])
  })

  it('sleeps until a future date', async () => {
    let nowVal = 1_000_000
    const sleeps: number[] = []
    const dx = createInMemoryDurableExecution({
      now: () => nowVal,
      delay: async (ms) => {
        sleeps.push(ms)
        nowVal += ms
      },
    })
    await dx.run(
      'until',
      async (ctx) => {
        await ctx.sleepUntil(new Date(nowVal + 750))
      },
      undefined
    )
    expect(sleeps).toEqual([750])
  })

  it('does not sleep when sleepUntil is in the past', async () => {
    const sleeps: number[] = []
    const dx = createInMemoryDurableExecution({
      now: () => 5_000,
      delay: async (ms) => {
        sleeps.push(ms)
      },
    })
    await dx.run(
      'past',
      async (ctx) => {
        await ctx.sleepUntil(new Date(0))
      },
      undefined
    )
    expect(sleeps).toEqual([])
  })

  it('rejects unrecognised duration strings', async () => {
    const dx = createInMemoryDurableExecution({ delay: async () => {} })
    await expect(
      dx.run('bad', async (ctx) => ctx.sleep('two fortnights'), undefined)
    ).rejects.toThrow(/Unrecognised duration/)
  })

  it('waitForEvent resolves when emit is called with matching name', async () => {
    const dx = createInMemoryDurableExecution()
    const promise = dx.waitForEvent<number>('Order.placed')
    expect(dx.emit('Order.placed', 42)).toBe(true)
    await expect(promise).resolves.toBe(42)
  })

  it('waitForEvent times out with WaitForEventTimeoutError', async () => {
    const dx = createInMemoryDurableExecution()
    await expect(dx.waitForEvent('never', 10)).rejects.toBeInstanceOf(WaitForEventTimeoutError)
  })

  it('emit returns false when no waiter is pending', () => {
    const dx = createInMemoryDurableExecution()
    expect(dx.emit('nothing', null)).toBe(false)
  })

  it('waitForEvent inside a workflow run resolves via emit', async () => {
    const dx = createInMemoryDurableExecution()
    const completion = dx.run<string, undefined>(
      'await-event',
      async (ctx) => ctx.waitForEvent<string>('approved'),
      undefined
    )
    // Allow the run to register its waiter before we emit.
    await Promise.resolve()
    await Promise.resolve()
    expect(dx.emit('approved', 'go')).toBe(true)
    await expect(completion).resolves.toBe('go')
  })

  it('schedule returns a subscription with a stable id and unsubscribe', () => {
    const dx = createInMemoryDurableExecution()
    const sub = dx.schedule('midnight', '0 0 * * *', async () => undefined)
    expect(typeof sub.id).toBe('string')
    expect(sub.id.length).toBeGreaterThan(0)
    sub.unsubscribe()
    // Calling unsubscribe twice is a no-op, not an error.
    sub.unsubscribe()
  })

  it('top-level step() executes outside a run', async () => {
    const dx = createInMemoryDurableExecution()
    const fn = vi.fn(async () => 'value')
    const result = await dx.step('once', fn)
    expect(result).toBe('value')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('satisfies the DurableExecutionAdapter port type', () => {
    // Compile-time check: assigning the stub to the port type proves
    // structural compatibility.
    const adapter: DurableExecutionAdapter = createInMemoryDurableExecution()
    expect(adapter.kind).toBe('in-process')
  })
})
