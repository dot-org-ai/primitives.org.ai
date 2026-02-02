/**
 * Tests for Cascade Executor
 */

import { describe, it, expect, vi } from 'vitest'
import {
  CascadeExecutor,
  createCascadeStep,
  TIER_ORDER,
  DEFAULT_TIER_TIMEOUTS,
  AllTiersFailedError,
  CascadeTimeoutError,
  type CascadeConfig,
  type TierContext,
  type FiveWHEvent,
} from '../src/cascade.js'

describe('CascadeExecutor', () => {
  describe('basic execution', () => {
    it('should execute code tier successfully', async () => {
      const executor = new CascadeExecutor<{ value: number }, { result: number }>({
        tiers: {
          code: {
            name: 'test-code',
            execute: async (input) => ({ result: input.value * 2 }),
          },
        },
      })

      const result = await executor.execute({ value: 5 })

      expect(result.value).toEqual({ result: 10 })
      expect(result.tier).toBe('code')
      expect(result.history).toHaveLength(1)
      expect(result.history[0]!.success).toBe(true)
    })

    it('should escalate to next tier on failure', async () => {
      const executor = new CascadeExecutor<{ value: number }, { result: number }>({
        tiers: {
          code: {
            name: 'test-code',
            execute: async () => {
              throw new Error('Code tier failed')
            },
          },
          generative: {
            name: 'test-generative',
            execute: async (input) => ({ result: input.value * 3 }),
          },
        },
      })

      const result = await executor.execute({ value: 5 })

      expect(result.value).toEqual({ result: 15 })
      expect(result.tier).toBe('generative')
      expect(result.history).toHaveLength(2)
      expect(result.history[0]!.success).toBe(false)
      expect(result.history[1]!.success).toBe(true)
    })

    it('should throw AllTiersFailedError when all tiers fail', async () => {
      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'test-code',
            execute: async () => {
              throw new Error('Code failed')
            },
          },
          generative: {
            name: 'test-generative',
            execute: async () => {
              throw new Error('Generative failed')
            },
          },
        },
      })

      await expect(executor.execute({ value: 5 })).rejects.toThrow(AllTiersFailedError)
    })

    it('should skip unconfigured tiers', async () => {
      const executor = new CascadeExecutor<{ value: number }, { result: number }>({
        tiers: {
          generative: {
            name: 'test-generative',
            execute: async (input) => ({ result: input.value }),
          },
        },
      })

      const result = await executor.execute({ value: 10 })

      expect(result.tier).toBe('generative')
      expect(result.skippedTiers).toContain('code')
    })
  })

  describe('timeouts', () => {
    it('should use default timeouts when configured', async () => {
      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'test-code',
            execute: async () => ({ success: true }),
          },
        },
        useDefaultTimeouts: true,
      })

      // Default code timeout is 5000ms
      expect(DEFAULT_TIER_TIMEOUTS.code).toBe(5000)

      const result = await executor.execute({})
      expect(result.tier).toBe('code')
    })

    it('should throw CascadeTimeoutError on total timeout', async () => {
      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'slow-code',
            execute: async () => {
              await new Promise((resolve) => setTimeout(resolve, 100))
              return { success: true }
            },
          },
        },
        totalTimeout: 10,
      })

      await expect(executor.execute({})).rejects.toThrow(CascadeTimeoutError)
    })
  })

  describe('5W+H events', () => {
    it('should emit start and complete events', async () => {
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'test-code',
            execute: async () => ({ success: true }),
          },
        },
        cascadeName: 'test-cascade',
        actor: 'test-user',
        onEvent: (event) => events.push(event),
      })

      await executor.execute({})

      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events[0]!.what).toBe('cascade-start')
      expect(events[0]!.who).toBe('test-user')
      expect(events[0]!.where).toBe('test-cascade')

      const completeEvent = events.find((e) => e.what === 'cascade-complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent!.how?.status).toBe('completed')
    })

    it('should emit escalation events on tier failure', async () => {
      const events: FiveWHEvent[] = []

      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'test-code',
            execute: async () => {
              throw new Error('Code failed')
            },
          },
          generative: {
            name: 'test-generative',
            execute: async () => ({ success: true }),
          },
        },
        onEvent: (event) => events.push(event),
      })

      await executor.execute({})

      const escalationEvent = events.find((e) => e.what === 'escalate-to-generative')
      expect(escalationEvent).toBeDefined()
      expect(escalationEvent!.why).toBe('Code failed')
    })
  })

  describe('retry configuration', () => {
    it('should retry tier on failure', async () => {
      let attempts = 0

      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'retry-code',
            execute: async () => {
              attempts++
              if (attempts < 3) {
                throw new Error('Not yet')
              }
              return { success: true }
            },
          },
        },
        retryConfig: {
          code: {
            maxRetries: 3,
            baseDelay: 10,
          },
        },
      })

      const result = await executor.execute({})

      expect(result.tier).toBe('code')
      expect(result.history[0]!.attempts).toBe(3)
      expect(attempts).toBe(3)
    })
  })

  describe('skip conditions', () => {
    it('should skip tier when condition returns true', async () => {
      const executor = new CascadeExecutor<{ skipCode?: boolean }, { result: string }>({
        tiers: {
          code: {
            name: 'skippable-code',
            execute: async () => ({ result: 'code' }),
          },
          generative: {
            name: 'test-generative',
            execute: async () => ({ result: 'generative' }),
          },
        },
        skipConditions: {
          code: (input) => !!input.skipCode,
        },
      })

      const result = await executor.execute({ skipCode: true })

      expect(result.tier).toBe('generative')
      expect(result.skippedTiers).toContain('code')
    })
  })

  describe('context propagation', () => {
    it('should pass previous errors to tier context', async () => {
      let receivedPreviousErrors: Array<{ tier: string; error: string }> | undefined

      const executor = new CascadeExecutor({
        tiers: {
          code: {
            name: 'failing-code',
            execute: async () => {
              throw new Error('Code error')
            },
          },
          generative: {
            name: 'test-generative',
            execute: async (_, ctx) => {
              receivedPreviousErrors = ctx.previousErrors
              return { success: true }
            },
          },
        },
      })

      await executor.execute({})

      expect(receivedPreviousErrors).toBeDefined()
      expect(receivedPreviousErrors).toHaveLength(1)
      expect(receivedPreviousErrors![0]!.tier).toBe('code')
      expect(receivedPreviousErrors![0]!.error).toBe('Code error')
    })
  })
})

describe('createCascadeStep', () => {
  it('should create executor with configured tiers', async () => {
    const cascade = createCascadeStep({
      name: 'test-cascade',
      code: async (input: { value: number }) => ({ result: input.value }),
      generative: async (input: { value: number }) => ({ result: input.value * 2 }),
    })

    const result = await cascade.execute({ value: 5 })

    expect(result.value).toEqual({ result: 5 })
    expect(result.tier).toBe('code')
  })

  it('should use default timeouts', async () => {
    const cascade = createCascadeStep({
      name: 'test-cascade',
      code: async () => ({ success: true }),
    })

    // The cascade should have default timeouts enabled
    const result = await cascade.execute({})
    expect(result.tier).toBe('code')
  })

  it('should accept custom timeouts', async () => {
    const cascade = createCascadeStep({
      name: 'test-cascade',
      code: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { success: true }
      },
      timeouts: {
        code: 10,
      },
    })

    // Should timeout since execution takes longer than 10ms
    await expect(cascade.execute({})).rejects.toThrow()
  })
})

describe('Constants', () => {
  it('should have correct tier order', () => {
    expect(TIER_ORDER).toEqual(['code', 'generative', 'agentic', 'human'])
  })

  it('should have correct default timeouts', () => {
    expect(DEFAULT_TIER_TIMEOUTS).toEqual({
      code: 5000,
      generative: 30000,
      agentic: 300000,
      human: 86400000,
    })
  })
})
