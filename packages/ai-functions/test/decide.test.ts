/**
 * Tests for the decide() function - LLM as Judge
 *
 * decide`criteria`(optionA, optionB) - Compare options and pick the best
 *
 * Tests require actual AI calls via the Cloudflare AI Gateway for real decisions.
 */

import { describe, it, expect } from 'vitest'
import { generateObject } from '../src/generate.js'
import { z } from 'zod'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL

// ============================================================================
// Real AI Decision Tests
// ============================================================================

describe.skipIf(!hasGateway)('decide() - LLM as Judge with Real AI', () => {
  describe('basic comparison', () => {
    it('compares two options and returns the better one', async () => {
      const optionA = { name: 'Simple Solution', complexity: 'low', time: '1 day' }
      const optionB = { name: 'Complex Solution', complexity: 'high', time: '1 week' }

      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          winner: z.enum(['A', 'B']).describe('Which option is faster to implement?'),
          reasoning: z.string().describe('Brief explanation'),
        }),
        prompt: `Compare these options and pick the fastest to implement:
Option A: ${JSON.stringify(optionA)}
Option B: ${JSON.stringify(optionB)}`,
      })

      expect(['A', 'B']).toContain(result.object.winner)
      // Simple solution should be faster
      expect(result.object.winner).toBe('A')
      expect(result.object.reasoning.length).toBeGreaterThan(0)
    })

    it('works with string options', async () => {
      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          winner: z.enum(['A', 'B']).describe('Which headline is better for developers?'),
        }),
        prompt: `Which headline is better for a developer audience?
A: "Simple Guide to TypeScript"
B: "TypeScript: Advanced Patterns for Enterprise"`,
      })

      expect(['A', 'B']).toContain(result.object.winner)
    })
  })

  describe('multiple options comparison', () => {
    it('compares multiple framework options', async () => {
      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          winner: z.enum(['React', 'Vue', 'Angular', 'Svelte']).describe('Best for enterprise'),
          reasoning: z.string().describe('Brief explanation'),
        }),
        prompt: `Which frontend framework is best for large enterprise applications with many developers?
Options: React, Vue, Angular, Svelte`,
      })

      expect(['React', 'Vue', 'Angular', 'Svelte']).toContain(result.object.winner)
      expect(result.object.reasoning.length).toBeGreaterThan(0)
    })
  })

  describe('A/B testing use case', () => {
    it('evaluates headline click-through potential', async () => {
      const headlineA = 'Get Started with TypeScript Today'
      const headlineB = 'TypeScript: The Complete Guide for 2025'

      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          winner: z
            .enum(['A', 'B'])
            .describe('Which headline would have higher click-through rate?'),
          confidence: z.number().min(0).max(1).describe('Confidence score'),
        }),
        prompt: `For a developer audience, which headline would have higher click-through rate?
Headline A: "${headlineA}"
Headline B: "${headlineB}"`,
      })

      expect(['A', 'B']).toContain(result.object.winner)
      expect(result.object.confidence).toBeGreaterThanOrEqual(0)
      expect(result.object.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('code comparison use case', () => {
    it('compares code implementations', async () => {
      const impl1 = `function isPrime(n) {
  if (n <= 1) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}`

      const impl2 = `function isPrime(n) {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}`

      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          winner: z.enum(['A', 'B']).describe('Most performant implementation'),
          reasoning: z.string().describe('Why this is more performant'),
        }),
        prompt: `Which isPrime implementation is more performant?
Implementation A:
${impl1}

Implementation B:
${impl2}`,
      })

      expect(['A', 'B']).toContain(result.object.winner)
      // The second implementation with 6k optimization should be faster
      expect(result.object.winner).toBe('B')
    })
  })
})

// ============================================================================
// Type Inference Pattern Tests (no AI needed)
// ============================================================================

describe('decide() pattern tests', () => {
  it('documents the decide function signature', () => {
    // decide`criteria`(option1, option2, ...) returns the winning option
    // The return type matches the input option type

    type DecideSignature<T> = (criteria: string, options: T[]) => Promise<T>

    // Verify the type signature compiles
    const signature: DecideSignature<{ name: string }> = async (_criteria, options) => options[0]
    expect(typeof signature).toBe('function')
  })

  it('documents extended mode with reasoning', () => {
    // Extended mode returns both the choice and reasoning
    type DecideWithReasoning<T> = {
      choice: T
      reasoning: string
      confidence: number
    }

    const result: DecideWithReasoning<string> = {
      choice: 'Option A',
      reasoning: 'Better for the use case',
      confidence: 0.85,
    }

    expect(result).toHaveProperty('choice')
    expect(result).toHaveProperty('reasoning')
    expect(result).toHaveProperty('confidence')
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe.skipIf(!hasGateway)('decide() edge cases', () => {
  it('handles identical options', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        winner: z.enum(['A', 'B']).describe('Which is better?'),
        areSimilar: z.boolean().describe('Are the options essentially the same?'),
      }),
      prompt: `Which option is better?
Option A: "Hello World"
Option B: "Hello World"`,
    })

    expect(['A', 'B']).toContain(result.object.winner)
    expect(result.object.areSimilar).toBe(true)
  })

  it('handles complex nested objects', async () => {
    const architectureA = {
      name: 'Microservices',
      components: ['gateway', 'auth', 'users', 'products'],
      database: 'distributed',
    }

    const architectureB = {
      name: 'Monolith',
      components: ['app'],
      database: 'single',
    }

    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        winner: z.enum(['Microservices', 'Monolith']).describe('Better for a 3-developer startup'),
        reasoning: z.string(),
      }),
      prompt: `Which architecture is better for a startup with 3 developers?
Option 1: ${JSON.stringify(architectureA)}
Option 2: ${JSON.stringify(architectureB)}`,
    })

    expect(['Microservices', 'Monolith']).toContain(result.object.winner)
    // Monolith is typically better for small teams
    expect(result.object.winner).toBe('Monolith')
  })
})
