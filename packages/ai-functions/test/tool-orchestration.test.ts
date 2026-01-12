/**
 * Tests for agentic tool orchestration
 *
 * These tests cover multi-turn model→tools→model loops for complex AI workflows.
 * Tests are written first (TDD RED phase) - implementation follows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// Import types and classes we'll implement
import {
  AgenticLoop,
  ToolRouter,
  ToolValidator,
  type Tool,
  type ToolResult,
  type LoopOptions,
  type LoopResult,
  type ValidationResult,
} from '../src/tool-orchestration.js'

// Mock model for testing
const createMockModel = () => ({
  generate: vi.fn(),
})

// Sample tools for testing
const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Performs basic math operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return a + b
      case 'subtract': return a - b
      case 'multiply': return a * b
      case 'divide': return b !== 0 ? a / b : 'Division by zero'
    }
  },
}

const fetchTool: Tool = {
  name: 'fetch',
  description: 'Fetches data from a URL',
  parameters: z.object({
    url: z.string().url(),
  }),
  execute: async ({ url }) => {
    return { data: `Content from ${url}`, status: 200 }
  },
}

const slowTool: Tool = {
  name: 'slow',
  description: 'A tool that takes time to execute',
  parameters: z.object({
    delay: z.number(),
  }),
  execute: async ({ delay }) => {
    await new Promise(resolve => setTimeout(resolve, delay))
    return 'completed'
  },
}

const failingTool: Tool = {
  name: 'failing',
  description: 'A tool that always fails',
  parameters: z.object({
    message: z.string(),
  }),
  execute: async ({ message }) => {
    throw new Error(`Tool failed: ${message}`)
  },
}

// ============================================================================
// AgenticLoop Tests - Multi-turn model→tools→model loops
// ============================================================================

describe('AgenticLoop', () => {
  describe('basic loop execution', () => {
    it('should execute a single tool call and return result', async () => {
      const loop = new AgenticLoop({
        tools: [calculatorTool],
        maxSteps: 5,
      })

      // Mock model response that calls calculator then finishes
      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 5, b: 3 } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'The result of 5 + 3 is 8',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'What is 5 + 3?',
      })

      expect(result.text).toContain('8')
      expect(result.steps).toBe(2)
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].name).toBe('calculator')
      expect(result.toolCalls[0].result).toBe(8)
    })

    it('should handle multiple sequential tool calls', async () => {
      const loop = new AgenticLoop({
        tools: [calculatorTool],
        maxSteps: 10,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 5, b: 3 } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'calculator', arguments: { operation: 'multiply', a: 8, b: 2 } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: '5 + 3 = 8, then 8 * 2 = 16',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Add 5 and 3, then multiply by 2',
      })

      expect(result.steps).toBe(3)
      expect(result.toolCalls).toHaveLength(2)
    })

    it('should preserve conversation state across turns', async () => {
      const loop = new AgenticLoop({
        tools: [calculatorTool],
        maxSteps: 5,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 10, b: 5 } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Done',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Calculate 10 + 5',
      })

      // Verify the second call received the tool result in messages
      const secondCall = mockGenerate.mock.calls[1][0]
      expect(secondCall.messages).toBeDefined()
      expect(secondCall.messages.some((m: any) =>
        m.role === 'tool' && m.content.includes('15')
      )).toBe(true)
    })
  })

  describe('maxSteps limit enforcement', () => {
    it('should stop at maxSteps limit', async () => {
      const loop = new AgenticLoop({
        tools: [calculatorTool],
        maxSteps: 3,
      })

      // Model keeps calling tools indefinitely
      const mockGenerate = vi.fn().mockResolvedValue({
        toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 1, b: 1 } }],
        finishReason: 'tool_call',
      })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Keep adding',
      })

      expect(result.steps).toBe(3)
      expect(result.stopReason).toBe('max_steps')
    })

    it('should throw error when maxSteps is exceeded in strict mode', async () => {
      const loop = new AgenticLoop({
        tools: [calculatorTool],
        maxSteps: 2,
        strictMaxSteps: true,
      })

      const mockGenerate = vi.fn().mockResolvedValue({
        toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 1, b: 1 } }],
        finishReason: 'tool_call',
      })

      await expect(loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Keep adding',
      })).rejects.toThrow('Max steps exceeded')
    })
  })

  describe('parallel tool execution', () => {
    it('should execute multiple tool calls in parallel', async () => {
      const timingTool: Tool = {
        name: 'timing',
        description: 'Returns execution order',
        parameters: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          await new Promise(r => setTimeout(r, 10))
          return { id, time: Date.now() }
        },
      }

      const loop = new AgenticLoop({
        tools: [timingTool],
        maxSteps: 5,
        parallelExecution: true,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [
            { name: 'timing', arguments: { id: 'a' } },
            { name: 'timing', arguments: { id: 'b' } },
            { name: 'timing', arguments: { id: 'c' } },
          ],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'All done',
          finishReason: 'stop',
        })

      const startTime = Date.now()
      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Run all',
      })
      const elapsed = Date.now() - startTime

      expect(result.toolCalls).toHaveLength(3)
      // Parallel execution should be faster than sequential (3 * 10ms)
      expect(elapsed).toBeLessThan(40)
    })

    it('should respect parallel execution limit', async () => {
      const executionOrder: string[] = []
      const trackingTool: Tool = {
        name: 'track',
        description: 'Tracks execution',
        parameters: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          executionOrder.push(`start:${id}`)
          await new Promise(r => setTimeout(r, 20))
          executionOrder.push(`end:${id}`)
          return id
        },
      }

      const loop = new AgenticLoop({
        tools: [trackingTool],
        maxSteps: 5,
        parallelExecution: true,
        maxParallelCalls: 2,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [
            { name: 'track', arguments: { id: '1' } },
            { name: 'track', arguments: { id: '2' } },
            { name: 'track', arguments: { id: '3' } },
            { name: 'track', arguments: { id: '4' } },
          ],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Done',
          finishReason: 'stop',
        })

      await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Track all',
      })

      // With maxParallelCalls: 2, at most 2 should start before any ends
      let concurrentStarts = 0
      let maxConcurrent = 0
      for (const event of executionOrder) {
        if (event.startsWith('start:')) concurrentStarts++
        else concurrentStarts--
        maxConcurrent = Math.max(maxConcurrent, concurrentStarts)
      }
      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })
  })

  describe('abort signal support', () => {
    it('should abort execution when signal is triggered', async () => {
      const loop = new AgenticLoop({
        tools: [slowTool],
        maxSteps: 10,
      })

      const controller = new AbortController()
      const mockGenerate = vi.fn().mockResolvedValue({
        toolCalls: [{ name: 'slow', arguments: { delay: 1000 } }],
        finishReason: 'tool_call',
      })

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50)

      await expect(loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Run slow tool',
        abortSignal: controller.signal,
      })).rejects.toThrow('Aborted')
    })
  })

  describe('onStep callback', () => {
    it('should call onStep for each loop iteration', async () => {
      const steps: any[] = []
      const loop = new AgenticLoop({
        tools: [calculatorTool],
        maxSteps: 5,
        onStep: (step) => { steps.push(step) },
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 1, b: 2 } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Result is 3',
          finishReason: 'stop',
        })

      await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Add',
      })

      expect(steps).toHaveLength(2)
      expect(steps[0].stepNumber).toBe(1)
      expect(steps[0].toolCalls).toHaveLength(1)
      expect(steps[1].stepNumber).toBe(2)
    })
  })
})

// ============================================================================
// ToolRouter Tests - Routing tool calls to handlers
// ============================================================================

describe('ToolRouter', () => {
  describe('tool registration and routing', () => {
    it('should register and route to correct tool', async () => {
      const router = new ToolRouter()
      router.register(calculatorTool)
      router.register(fetchTool)

      const result = await router.route({
        name: 'calculator',
        arguments: { operation: 'multiply', a: 6, b: 7 },
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe(42)
    })

    it('should return error for unknown tool', async () => {
      const router = new ToolRouter()
      router.register(calculatorTool)

      const result = await router.route({
        name: 'unknown_tool',
        arguments: {},
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should route multiple calls in order', async () => {
      const router = new ToolRouter()
      router.register(calculatorTool)

      const calls = [
        { name: 'calculator', arguments: { operation: 'add', a: 1, b: 2 } },
        { name: 'calculator', arguments: { operation: 'multiply', a: 3, b: 4 } },
      ]

      const results = await router.routeAll(calls)

      expect(results).toHaveLength(2)
      expect(results[0].result).toBe(3)
      expect(results[1].result).toBe(12)
    })
  })

  describe('tool result formatting', () => {
    it('should format tool results for model consumption', async () => {
      const router = new ToolRouter()
      router.register(calculatorTool)

      const result = await router.route({
        name: 'calculator',
        arguments: { operation: 'add', a: 10, b: 20 },
      })

      const formatted = router.formatResult(result)
      expect(formatted.role).toBe('tool')
      expect(formatted.content).toContain('30')
    })

    it('should format error results appropriately', async () => {
      const router = new ToolRouter()
      router.register(failingTool)

      const result = await router.route({
        name: 'failing',
        arguments: { message: 'test error' },
      })

      const formatted = router.formatResult(result)
      expect(formatted.role).toBe('tool')
      expect(formatted.content).toContain('error')
      expect(formatted.isError).toBe(true)
    })
  })

  describe('parallel routing', () => {
    it('should route multiple calls in parallel', async () => {
      const router = new ToolRouter()
      const executionTimes: number[] = []

      const timingTool: Tool = {
        name: 'time',
        description: 'Records time',
        parameters: z.object({ id: z.number() }),
        execute: async ({ id }) => {
          await new Promise(r => setTimeout(r, 20))
          executionTimes.push(Date.now())
          return id
        },
      }

      router.register(timingTool)

      const startTime = Date.now()
      await router.routeAllParallel([
        { name: 'time', arguments: { id: 1 } },
        { name: 'time', arguments: { id: 2 } },
        { name: 'time', arguments: { id: 3 } },
      ])
      const elapsed = Date.now() - startTime

      // Should complete in ~20ms, not 60ms
      expect(elapsed).toBeLessThan(50)
    })
  })
})

// ============================================================================
// ToolValidator Tests - Pre-execution validation
// ============================================================================

describe('ToolValidator', () => {
  describe('argument validation', () => {
    it('should validate arguments against tool schema', () => {
      const validator = new ToolValidator()
      validator.register(calculatorTool)

      const result = validator.validate('calculator', {
        operation: 'add',
        a: 5,
        b: 10,
      })

      expect(result.valid).toBe(true)
    })

    it('should reject invalid arguments', () => {
      const validator = new ToolValidator()
      validator.register(calculatorTool)

      const result = validator.validate('calculator', {
        operation: 'invalid_op',
        a: 'not a number',
        b: 10,
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it('should reject missing required arguments', () => {
      const validator = new ToolValidator()
      validator.register(calculatorTool)

      const result = validator.validate('calculator', {
        operation: 'add',
        a: 5,
        // missing 'b'
      })

      expect(result.valid).toBe(false)
    })

    it('should return error for unknown tool', () => {
      const validator = new ToolValidator()

      const result = validator.validate('unknown', { foo: 'bar' })

      expect(result.valid).toBe(false)
      expect(result.errors![0]).toContain('not registered')
    })
  })

  describe('batch validation', () => {
    it('should validate multiple tool calls at once', () => {
      const validator = new ToolValidator()
      validator.register(calculatorTool)
      validator.register(fetchTool)

      const results = validator.validateAll([
        { name: 'calculator', arguments: { operation: 'add', a: 1, b: 2 } },
        { name: 'fetch', arguments: { url: 'https://example.com' } },
        { name: 'calculator', arguments: { operation: 'bad', a: 1, b: 2 } },
      ])

      expect(results).toHaveLength(3)
      expect(results[0].valid).toBe(true)
      expect(results[1].valid).toBe(true)
      expect(results[2].valid).toBe(false)
    })
  })
})

// ============================================================================
// Tool Error Recovery Tests
// ============================================================================

describe('Tool Error Recovery', () => {
  describe('error handling', () => {
    it('should catch and report tool execution errors', async () => {
      const loop = new AgenticLoop({
        tools: [failingTool, calculatorTool],
        maxSteps: 5,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'failing', arguments: { message: 'test' } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Tool failed, moving on',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Try the failing tool',
      })

      expect(result.toolCalls[0].error).toBeDefined()
      expect(result.toolCalls[0].error).toContain('Tool failed')
    })

    it('should retry failed tool calls when retry is enabled', async () => {
      let attempts = 0
      const flakeyTool: Tool = {
        name: 'flakey',
        description: 'Fails first attempt',
        parameters: z.object({}),
        execute: async () => {
          attempts++
          if (attempts < 2) throw new Error('First attempt fails')
          return 'success'
        },
      }

      const loop = new AgenticLoop({
        tools: [flakeyTool],
        maxSteps: 5,
        retryFailedTools: true,
        maxToolRetries: 3,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'flakey', arguments: {} }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Got success',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Use flakey tool',
      })

      expect(result.toolCalls[0].result).toBe('success')
      expect(result.toolCalls[0].retryCount).toBe(1)
    })
  })

  describe('graceful degradation', () => {
    it('should continue with partial results when tools fail', async () => {
      const loop = new AgenticLoop({
        tools: [calculatorTool, failingTool],
        maxSteps: 5,
        continueOnError: true,
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [
            { name: 'calculator', arguments: { operation: 'add', a: 1, b: 2 } },
            { name: 'failing', arguments: { message: 'error' } },
          ],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Calculator worked, other failed',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Use both tools',
      })

      expect(result.toolCalls).toHaveLength(2)
      expect(result.toolCalls[0].result).toBe(3)
      expect(result.toolCalls[1].error).toBeDefined()
    })
  })

  describe('timeout handling', () => {
    it('should timeout long-running tools', async () => {
      const loop = new AgenticLoop({
        tools: [slowTool],
        maxSteps: 5,
        toolTimeout: 50, // 50ms timeout
      })

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          toolCalls: [{ name: 'slow', arguments: { delay: 1000 } }],
          finishReason: 'tool_call',
        })
        .mockResolvedValueOnce({
          text: 'Tool timed out',
          finishReason: 'stop',
        })

      const result = await loop.run({
        model: { generate: mockGenerate } as any,
        prompt: 'Run slow tool',
      })

      expect(result.toolCalls[0].error).toContain('timeout')
    })
  })
})

// ============================================================================
// Integration with generateText Tests
// ============================================================================

describe('Integration with generateText', () => {
  it('should work with AI SDK tool format', async () => {
    const loop = new AgenticLoop({
      tools: [calculatorTool],
      maxSteps: 5,
    })

    // Verify tool conversion to AI SDK format
    const sdkTools = loop.getToolsForSDK()
    expect(sdkTools.calculator).toBeDefined()
    expect(sdkTools.calculator.description).toBe('Performs basic math operations')
    expect(sdkTools.calculator.parameters).toBeDefined()
  })

  it('should expose tool results through experimental_toolResultContent', async () => {
    const loop = new AgenticLoop({
      tools: [calculatorTool],
      maxSteps: 5,
    })

    const mockGenerate = vi.fn()
      .mockResolvedValueOnce({
        toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 2, b: 3 } }],
        finishReason: 'tool_call',
      })
      .mockResolvedValueOnce({
        text: '5',
        finishReason: 'stop',
      })

    const result = await loop.run({
      model: { generate: mockGenerate } as any,
      prompt: 'Add 2 + 3',
    })

    // Verify tool results are exposed in a format compatible with AI SDK
    expect(result.toolResults).toBeDefined()
    expect(result.toolResults[0].toolName).toBe('calculator')
    expect(result.toolResults[0].result).toBe(5)
  })
})

// ============================================================================
// Token Usage Tracking Tests
// ============================================================================

describe('Token Usage Tracking', () => {
  it('should track token usage across multi-turn conversations', async () => {
    const loop = new AgenticLoop({
      tools: [calculatorTool],
      maxSteps: 5,
      trackUsage: true,
    })

    const mockGenerate = vi.fn()
      .mockResolvedValueOnce({
        toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 1, b: 2 } }],
        finishReason: 'tool_call',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      })
      .mockResolvedValueOnce({
        text: 'Result is 3',
        finishReason: 'stop',
        usage: { promptTokens: 80, completionTokens: 10, totalTokens: 90 },
      })

    const result = await loop.run({
      model: { generate: mockGenerate } as any,
      prompt: 'Add 1 + 2',
    })

    expect(result.usage).toBeDefined()
    expect(result.usage!.promptTokens).toBe(130)
    expect(result.usage!.completionTokens).toBe(30)
    expect(result.usage!.totalTokens).toBe(160)
  })
})

// ============================================================================
// cachedTool Tests - Tool result caching with cleanup
// ============================================================================

import { cachedTool, type CachedTool } from '../src/tool-orchestration.js'

describe('cachedTool', () => {
  describe('basic caching behavior', () => {
    it('should cache tool results', async () => {
      let executionCount = 0
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => {
          executionCount++
          return { key, count: executionCount }
        },
      }

      const cached = cachedTool(countingTool, { ttl: 1000 })

      // First call executes the tool
      const result1 = await cached.execute({ key: 'test' })
      expect(result1).toEqual({ key: 'test', count: 1 })

      // Second call with same key returns cached result
      const result2 = await cached.execute({ key: 'test' })
      expect(result2).toEqual({ key: 'test', count: 1 })
      expect(executionCount).toBe(1) // Only executed once

      // Different key executes again
      const result3 = await cached.execute({ key: 'other' })
      expect(result3).toEqual({ key: 'other', count: 2 })
    })

    it('should expire cached entries after TTL', async () => {
      vi.useFakeTimers()
      let executionCount = 0
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => {
          executionCount++
          return { key, count: executionCount }
        },
      }

      const cached = cachedTool(countingTool, { ttl: 100 })

      // First call
      await cached.execute({ key: 'test' })
      expect(executionCount).toBe(1)

      // After TTL expires
      vi.advanceTimersByTime(150)

      // Should execute again since cache expired
      await cached.execute({ key: 'test' })
      expect(executionCount).toBe(2)

      vi.useRealTimers()
    })
  })

  describe('cache cleanup', () => {
    it('should periodically clean up expired entries', async () => {
      vi.useFakeTimers()
      let executionCount = 0
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => {
          executionCount++
          return { key, count: executionCount }
        },
      }

      const cached = cachedTool(countingTool, {
        ttl: 100,
        cleanupIntervalMs: 50,
      }) as CachedTool

      // Execute to populate cache
      await cached.execute({ key: 'entry1' })
      await cached.execute({ key: 'entry2' })

      expect(cached.cacheSize()).toBe(2)

      // Wait for TTL to expire and cleanup to run
      vi.advanceTimersByTime(150)

      // Entries should be cleaned up automatically
      expect(cached.cacheSize()).toBe(0)

      // Cleanup timer
      cached.destroy()
      vi.useRealTimers()
    })

    it('should stop cleanup timer and clear cache when destroyed', async () => {
      vi.useFakeTimers()
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => ({ key }),
      }

      const cached = cachedTool(countingTool, {
        ttl: 100,
        cleanupIntervalMs: 50,
      }) as CachedTool

      await cached.execute({ key: 'entry1' })
      expect(cached.cacheSize()).toBe(1)

      // Destroy stops cleanup timer and clears cache to prevent memory leaks
      cached.destroy()

      // Cache should be cleared immediately on destroy
      expect(cached.cacheSize()).toBe(0)

      // Advancing time should have no effect (timer is stopped)
      vi.advanceTimersByTime(150)
      expect(cached.cacheSize()).toBe(0)

      vi.useRealTimers()
    })

    it('should clear all cache entries on clearCache()', async () => {
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => ({ key }),
      }

      const cached = cachedTool(countingTool, { ttl: 60000 }) as CachedTool

      await cached.execute({ key: 'entry1' })
      await cached.execute({ key: 'entry2' })
      await cached.execute({ key: 'entry3' })

      expect(cached.cacheSize()).toBe(3)

      cached.clearCache()
      expect(cached.cacheSize()).toBe(0)

      cached.destroy()
    })
  })

  describe('max cache size (LRU eviction)', () => {
    it('should evict oldest entries when maxSize is reached', async () => {
      vi.useFakeTimers()
      let executionCount = 0
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => {
          executionCount++
          return { key, count: executionCount }
        },
      }

      const cached = cachedTool(countingTool, {
        ttl: 60000,
        maxSize: 3,
      }) as CachedTool

      // Fill cache to max
      await cached.execute({ key: 'a' })
      vi.advanceTimersByTime(10)
      await cached.execute({ key: 'b' })
      vi.advanceTimersByTime(10)
      await cached.execute({ key: 'c' })
      vi.advanceTimersByTime(10)

      expect(cached.cacheSize()).toBe(3)
      expect(executionCount).toBe(3)

      // Adding 4th entry should evict oldest ('a')
      await cached.execute({ key: 'd' })
      expect(cached.cacheSize()).toBe(3)

      // Accessing 'a' should re-execute since it was evicted
      await cached.execute({ key: 'a' })
      expect(executionCount).toBe(5) // New execution

      cached.destroy()
      vi.useRealTimers()
    })

    it('should update LRU order on cache hit', async () => {
      vi.useFakeTimers()
      let executionCount = 0
      const countingTool: Tool = {
        name: 'counting',
        description: 'Counts executions',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => {
          executionCount++
          return { key, count: executionCount }
        },
      }

      const cached = cachedTool(countingTool, {
        ttl: 60000,
        maxSize: 3,
      }) as CachedTool

      // Fill cache: a, b, c (oldest to newest)
      await cached.execute({ key: 'a' })
      vi.advanceTimersByTime(10)
      await cached.execute({ key: 'b' })
      vi.advanceTimersByTime(10)
      await cached.execute({ key: 'c' })
      vi.advanceTimersByTime(10)

      // Access 'a' to make it recently used
      await cached.execute({ key: 'a' }) // Cache hit
      vi.advanceTimersByTime(10)
      expect(executionCount).toBe(3) // No new execution

      // Add 'd' - should evict 'b' (now oldest) not 'a'
      await cached.execute({ key: 'd' })

      // 'b' was evicted, 'a' and 'c' remain
      await cached.execute({ key: 'b' }) // Should re-execute
      expect(executionCount).toBe(5)

      await cached.execute({ key: 'a' }) // Still cached
      expect(executionCount).toBe(5)

      cached.destroy()
      vi.useRealTimers()
    })
  })

  describe('resource cleanup on tool destruction', () => {
    it('should clean up timers and memory when destroy is called', async () => {
      const tool: Tool = {
        name: 'test',
        description: 'Test tool',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }) => ({ key }),
      }

      const cached = cachedTool(tool, {
        ttl: 1000,
        cleanupIntervalMs: 100,
      }) as CachedTool

      await cached.execute({ key: 'test' })
      expect(cached.cacheSize()).toBe(1)

      cached.destroy()
      expect(cached.cacheSize()).toBe(0)

      // Should still work after destroy but without caching
      await cached.execute({ key: 'test2' })
      expect(cached.cacheSize()).toBe(0)
    })
  })
})
