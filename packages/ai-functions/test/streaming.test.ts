/**
 * Tests for streaming integration with AIPromise
 *
 * These tests verify the streaming API for AI functions:
 * - ai().stream() returns AsyncIterable of chunks
 * - Streaming with property access
 * - Streaming with dependencies
 * - Backpressure handling
 * - Stream transformation (map/filter)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPromise, createTextPromise, createObjectPromise, createListPromise } from '../src/ai-promise.js'
import { ai, list, write } from '../src/primitives.js'

// Skip integration tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// ============================================================================
// Unit Tests (Mock-based)
// ============================================================================

describe('AIPromise.stream() - Unit Tests', () => {
  describe('Basic Streaming', () => {
    it('should have a stream() method on AIPromise', () => {
      const promise = new AIPromise<string>('test prompt', { type: 'text' })
      expect(typeof promise.stream).toBe('function')
    })

    it('stream() should return an object with AsyncIterable interface', async () => {
      const promise = new AIPromise<string>('test prompt', { type: 'text' })
      const stream = promise.stream()

      // Should have Symbol.asyncIterator
      expect(typeof stream[Symbol.asyncIterator]).toBe('function')
    })

    it('stream() should return an object with textStream property', async () => {
      const promise = new AIPromise<string>('test prompt', { type: 'text' })
      const stream = promise.stream()

      // Should have textStream for text generation
      expect(stream.textStream).toBeDefined()
    })

    it('stream() should return an object with partialObjectStream property', async () => {
      const promise = new AIPromise<{ name: string }>('test prompt', { type: 'object' })
      const stream = promise.stream()

      // Should have partialObjectStream for object generation
      expect(stream.partialObjectStream).toBeDefined()
    })
  })

  describe('StreamingAIPromise Interface', () => {
    it('should be awaitable to get final result', async () => {
      const promise = new AIPromise<string>('test prompt', { type: 'text' })
      const stream = promise.stream()

      // Should be thenable (Promise-like)
      expect(typeof stream.then).toBe('function')
    })

    it('should have result property for final value', async () => {
      const promise = new AIPromise<string>('test prompt', { type: 'text' })
      const stream = promise.stream()

      // result should be a Promise
      expect(stream.result).toBeDefined()
      expect(typeof stream.result.then).toBe('function')
    })

    it('should support abort controller', async () => {
      const promise = new AIPromise<string>('test prompt', { type: 'text' })
      const controller = new AbortController()
      const stream = promise.stream({ abortSignal: controller.signal })

      expect(stream).toBeDefined()
    })
  })

  describe('Property Access on Streaming Results', () => {
    it('should track property access for schema inference on stream', () => {
      const promise = new AIPromise<{ summary: string; points: string[] }>('test', { type: 'object' })

      // Access properties
      const { summary, points } = promise

      // The stream should include these properties
      const stream = promise.stream()
      expect(stream).toBeDefined()
    })
  })
})

// ============================================================================
// Integration Tests (Real AI calls)
// ============================================================================

describe.skipIf(!hasGateway)('AIPromise.stream() - Integration Tests', () => {
  describe('Text Streaming', () => {
    it('should stream text chunks from ai template', async () => {
      const promise = write`Say hello in 3 words`
      const stream = promise.stream()

      const chunks: string[] = []
      for await (const chunk of stream.textStream) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
      const fullText = chunks.join('')
      expect(fullText.length).toBeGreaterThan(0)
    }, 60000)

    it('should allow awaiting final result after streaming', async () => {
      const promise = write`Say hello`
      const stream = promise.stream()

      // Consume stream
      for await (const _ of stream.textStream) {
        // consume
      }

      // Get final result
      const result = await stream.result
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }, 60000)
  })

  describe('Object Streaming', () => {
    it('should stream partial objects', async () => {
      const promise = ai`Generate a person with name and age`

      // Access properties to set schema
      const { name, age } = promise

      const stream = promise.stream()

      const partials: unknown[] = []
      for await (const partial of stream.partialObjectStream) {
        partials.push(partial)
      }

      expect(partials.length).toBeGreaterThan(0)

      // Last partial should have complete object
      const final = partials[partials.length - 1] as { name?: string; age?: number }
      expect(final.name).toBeDefined()
    })

    it('should support property access on stream result', async () => {
      const promise = ai`Generate recipe: name, ingredients list, steps list`
      const { name, ingredients, steps } = promise

      const stream = promise.stream()
      const result = await stream.result

      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('ingredients')
      expect(result).toHaveProperty('steps')
    }, 120000)
  })

  describe('List Streaming', () => {
    it('should stream list items one by one', async () => {
      const promise = list`3 colors`
      const stream = promise.stream()

      const items: string[] = []
      for await (const item of stream) {
        items.push(item as string)
      }

      expect(items.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Streaming with Dependencies', () => {
    it('should resolve dependencies before streaming', async () => {
      const topic = ai`Pick a random topic: science, art, or music`
      const essay = write`Write a paragraph about ${topic}`

      const stream = essay.stream()

      const chunks: string[] = []
      for await (const chunk of stream.textStream) {
        chunks.push(chunk)
      }

      const fullText = chunks.join('')
      expect(fullText.length).toBeGreaterThan(50)
    })

    it('should handle mixed streaming and non-streaming in pipeline', async () => {
      // First get a topic (non-streaming)
      const topic = await ai`Pick: TypeScript or Python`

      // Then stream based on that result
      const explanation = write`Explain why ${topic} is great`
      const stream = explanation.stream()

      const result = await stream.result
      expect(result.length).toBeGreaterThan(0)
    }, 120000)
  })

  describe('Backpressure Handling', () => {
    it('should handle slow consumers without memory issues', async () => {
      const promise = write`Generate a short story about a dragon in 2 sentences`
      const stream = promise.stream()

      const chunks: string[] = []
      for await (const chunk of stream.textStream) {
        // Simulate slow consumer
        await new Promise(resolve => setTimeout(resolve, 5))
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
    }, 120000)

    it('should support early termination/cancellation', async () => {
      const controller = new AbortController()
      const promise = write`Generate a very long story`
      const stream = promise.stream({ abortSignal: controller.signal })

      const chunks: string[] = []
      let count = 0

      try {
        for await (const chunk of stream.textStream) {
          chunks.push(chunk)
          count++
          if (count >= 5) {
            controller.abort()
            break
          }
        }
      } catch (error) {
        // AbortError is expected
        if (!(error instanceof Error && error.name === 'AbortError')) {
          throw error
        }
      }

      // Should have stopped early
      expect(count).toBeLessThanOrEqual(10)
    })
  })

  describe('Stream Transformation', () => {
    it('should support map on streaming list', async () => {
      const colors = list`3 colors`

      // Map should work on stream results
      const result = await colors.map(color => ({
        color,
        hex: ai`hex code for ${color}`,
      }))

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('should support filter-like operations via streaming', async () => {
      const numbers = list`5 random numbers between 1-100`
      const stream = numbers.stream()

      const allItems: string[] = []
      for await (const item of stream) {
        allItems.push(item as string)
      }

      expect(allItems.length).toBe(5)
    })
  })
})

// ============================================================================
// Stream Batching Tests
// ============================================================================

describe('Stream Batching', () => {
  it('should support streaming mode in batch operations', async () => {
    const promise = new AIPromise<string[]>('test', { type: 'list' })
    const stream = promise.stream()

    // Stream batching should be supported
    expect(stream).toBeDefined()
  })
})

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Streaming Type Safety', () => {
  it('should preserve types through streaming', () => {
    // Text streaming should yield strings
    const textPromise = createTextPromise('test')
    const textStream = textPromise.stream()
    expect(textStream.textStream).toBeDefined()

    // Object streaming should yield partial objects
    const objectPromise = createObjectPromise<{ name: string }>('test')
    const objectStream = objectPromise.stream()
    expect(objectStream.partialObjectStream).toBeDefined()

    // List streaming should yield items
    const listPromise = createListPromise('test')
    const listStream = listPromise.stream()
    expect(listStream).toBeDefined()
  })
})
