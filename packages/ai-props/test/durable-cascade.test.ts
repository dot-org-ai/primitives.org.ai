/**
 * Tests for DurableCascadeExecutor
 */

import { describe, it, expect, vi } from 'vitest'
import {
  DurableCascadeExecutor,
  createDurableCascadeStep,
  createAIGatewayConfig,
  type WorkflowStep,
  type DurableCascadeTierContext,
  type FiveWHEvent,
} from '../src/durable-cascade.js'
import { AllTiersFailedError, CascadeTimeoutError } from '../src/cascade.js'

/**
 * Create a mock workflow step for testing
 */
function createMockWorkflowStep(): WorkflowStep {
  return {
    do: vi.fn(
      async (name: string, configOrCallback: unknown, maybeCallback?: () => Promise<unknown>) => {
        const callback = typeof configOrCallback === 'function' ? configOrCallback : maybeCallback
        return callback?.()
      }
    ),
    sleep: vi.fn(async () => {}),
    sleepUntil: vi.fn(async () => {}),
  }
}

describe('DurableCascadeExecutor', () => {
  describe('basic execution', () => {
    it('should execute code tier successfully', async () => {
      const step = createMockWorkflowStep()
      const executor = new DurableCascadeExecutor<{ value: number }, { result: number }>('test', {
        code: async (input) => ({ result: input.value * 2 }),
      })

      const result = await executor.run(step, { value: 5 })

      expect(result.value).toEqual({ result: 10 })
      expect(result.tier).toBe('code')
      expect(step.do).toHaveBeenCalled()
    })

    it('should escalate to generative tier on code failure', async () => {
      const step = createMockWorkflowStep()
      const executor = new DurableCascadeExecutor<{ value: number }, { result: number }>('test', {
        code: async () => {
          throw new Error('Code failed')
        },
        generative: async (input) => ({ result: input.value * 3 }),
      })

      const result = await executor.run(step, { value: 5 })

      expect(result.value).toEqual({ result: 15 })
      expect(result.tier).toBe('generative')
      expect(result.history).toHaveLength(2)
    })

    it('should throw AllTiersFailedError when all tiers fail', async () => {
      const step = createMockWorkflowStep()
      const executor = new DurableCascadeExecutor('test', {
        code: async () => {
          throw new Error('Code failed')
        },
        generative: async () => {
          throw new Error('Generative failed')
        },
      })

      await expect(executor.run(step, {})).rejects.toThrow(AllTiersFailedError)
    })
  })

  describe('AI binding', () => {
    it('should pass AI binding to generative tier', async () => {
      const step = createMockWorkflowStep()
      const mockAi = {
        run: vi.fn(async () => ({ response: 'AI generated content' })),
      }

      const executor = new DurableCascadeExecutor<{ prompt: string }, { content: string }>('test', {
        generative: async (input, ctx) => {
          const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: input.prompt }],
          })
          return { content: result.response ?? '' }
        },
      })

      const result = await executor.run(step, { prompt: 'Hello' }, { ai: mockAi })

      expect(result.value.content).toBe('AI generated content')
      expect(mockAi.run).toHaveBeenCalled()
    })

    it('should use setAi method', async () => {
      const step = createMockWorkflowStep()
      const mockAi = {
        run: vi.fn(async () => ({ response: 'Configured AI response' })),
      }

      const executor = new DurableCascadeExecutor<{ prompt: string }, { content: string }>('test', {
        generative: async (input, ctx) => {
          const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: input.prompt }],
          })
          return { content: result.response ?? '' }
        },
      }).setAi(mockAi)

      const result = await executor.run(step, { prompt: 'Test' })

      expect(result.value.content).toBe('Configured AI response')
    })
  })

  describe('human review', () => {
    it('should handle human review requests', async () => {
      const step = createMockWorkflowStep()
      const mockHumanReviewHandler = vi.fn(async () => ({
        reviewId: 'review-123',
        status: 'approved',
      }))

      const executor = new DurableCascadeExecutor<{ data: string }, { approved: boolean }>('test', {
        human: async (input, ctx) => {
          const review = await ctx.requestHumanReview({
            type: 'approval',
            data: input.data,
          })
          return { approved: review.status === 'approved' }
        },
      })

      const result = await executor.run(
        step,
        { data: 'test' },
        { humanReviewHandler: mockHumanReviewHandler }
      )

      expect(result.value.approved).toBe(true)
      expect(mockHumanReviewHandler).toHaveBeenCalledWith({
        type: 'approval',
        data: 'test',
      })
    })
  })

  describe('5W+H events', () => {
    it('should emit cascade events', async () => {
      const step = createMockWorkflowStep()
      const events: FiveWHEvent[] = []

      const executor = new DurableCascadeExecutor('test-cascade', {
        code: async () => ({ success: true }),
        actor: 'test-user',
        onEvent: (event) => events.push(event),
      })

      await executor.run(step, {})

      expect(events.length).toBeGreaterThanOrEqual(2)

      const startEvent = events.find((e) => e.what === 'cascade-start')
      expect(startEvent).toBeDefined()
      expect(startEvent!.who).toBe('test-user')

      const completeEvent = events.find((e) => e.what === 'cascade-complete')
      expect(completeEvent).toBeDefined()
    })
  })

  describe('tier configuration', () => {
    it('should apply custom success condition', async () => {
      const step = createMockWorkflowStep()
      const executor = new DurableCascadeExecutor<unknown, { valid: boolean }>('test', {
        code: async () => ({ valid: false }),
        generative: async () => ({ valid: true }),
        tierConfig: {
          code: {
            successCondition: (result) => (result as { valid: boolean }).valid,
          },
        },
      })

      const result = await executor.run(step, {})

      // Code tier returned { valid: false }, which fails successCondition
      // So it should escalate to generative
      expect(result.tier).toBe('generative')
      expect(result.value.valid).toBe(true)
    })

    it('should call onError handler on tier failure', async () => {
      const step = createMockWorkflowStep()
      const onError = vi.fn()

      const executor = new DurableCascadeExecutor('test', {
        code: async () => {
          throw new Error('Test error')
        },
        generative: async () => ({ success: true }),
        tierConfig: {
          code: {
            onError,
          },
        },
      })

      await executor.run(step, {})

      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'code')
    })
  })
})

describe('createDurableCascadeStep', () => {
  it('should create executor with configured handlers', async () => {
    const step = createMockWorkflowStep()
    const cascade = createDurableCascadeStep({
      name: 'test-cascade',
      code: async (input: { value: number }) => ({ result: input.value }),
    })

    const result = await cascade.run(step, { value: 10 })

    expect(result.value).toEqual({ result: 10 })
    expect(result.tier).toBe('code')
  })

  it('should support all tier types', async () => {
    const step = createMockWorkflowStep()
    const mockAi = {
      run: vi.fn(async () => ({ response: 'agentic' })),
    }

    const cascade = createDurableCascadeStep({
      name: 'full-cascade',
      code: async () => {
        throw new Error('Skip')
      },
      generative: async () => {
        throw new Error('Skip')
      },
      agentic: async (_, ctx) => {
        const result = await ctx.ai.run('model', { messages: [] })
        return { tier: result.response }
      },
    })

    const result = await cascade.run(step, {}, { ai: mockAi })

    expect(result.tier).toBe('agentic')
    expect(result.value).toEqual({ tier: 'agentic' })
  })
})

describe('createAIGatewayConfig', () => {
  it('should create gateway configuration', () => {
    const config = createAIGatewayConfig({
      gatewayId: 'my-gateway',
      accountId: 'account-123',
      cacheTtl: 3600,
    })

    expect(config.config.gatewayId).toBe('my-gateway')
    expect(config.config.accountId).toBe('account-123')
    expect(config.config.cacheTtl).toBe(3600)
  })

  it('should generate request options', () => {
    const config = createAIGatewayConfig({
      gatewayId: 'my-gateway',
      accountId: 'account-123',
      cacheTtl: 3600,
      skipCache: false,
      metadata: { key: 'value' },
    })

    const options = config.toRequestOptions()

    expect(options).toEqual({
      gateway: {
        id: 'my-gateway',
        skipCache: false,
        cacheTtl: 3600,
        metadata: { key: 'value' },
      },
    })
  })

  it('should generate cache key', () => {
    const config = createAIGatewayConfig({
      gatewayId: 'my-gateway',
      accountId: 'account-123',
    })

    const key = config.getCacheKey({ prompt: 'test' })

    expect(key).toContain('my-gateway:')
    expect(key).toContain('prompt')
  })

  it('should use default values', () => {
    const config = createAIGatewayConfig({
      gatewayId: 'gateway',
      accountId: 'account',
    })

    const options = config.toRequestOptions()

    expect((options.gateway as { cacheTtl: number }).cacheTtl).toBe(0)
    expect((options.gateway as { skipCache: boolean }).skipCache).toBe(false)
  })
})
