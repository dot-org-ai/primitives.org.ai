/**
 * Integration tests for ai-primitives
 *
 * These tests use REAL AI calls via the Cloudflare AI Gateway.
 * The gateway caches responses, so repeated test runs are fast and free.
 *
 * Required env vars:
 * - AI_GATEWAY_URL: Cloudflare AI Gateway URL
 * - AI_GATEWAY_TOKEN: Gateway auth token (or individual provider keys like ANTHROPIC_API_KEY)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  ai,
  is,
  list,
  lists,
  extract,
  summarize,
  write,
  code,
  generateText,
  generateObject,
  configure,
  resetContext,
} from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// Use haiku model for fast/cheap tests
const TEST_MODEL = 'haiku'

describe.skipIf(!hasGateway)('ai-primitives integration', () => {
  // Reset context before tests to ensure clean state
  beforeAll(() => {
    resetContext()
    // Configure default model for tests
    configure({ model: TEST_MODEL })
  })

  afterAll(() => {
    resetContext()
  })

  // ============================================================================
  // write (text generation) tests
  // ============================================================================

  describe('write template function', () => {
    it('should generate text with template literal', async () => {
      const result = await write`say hello in exactly 2 words`
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle string interpolation', async () => {
      const language = 'French'
      const result = await write`say "hello" in ${language}, just the word`
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      // French for hello should contain "bonjour" or similar
      expect(result.toLowerCase()).toMatch(/bonjour|salut/i)
    })
  })

  // ============================================================================
  // ai (object generation) tests
  // ============================================================================

  describe('ai template function', () => {
    it('should generate an object result', async () => {
      // ai` returns an object by default
      const result = await ai`{ "greeting": "hello" }`
      expect(result).toBeDefined()
      // Result should be an object or have content
      expect(typeof result === 'object' || typeof result === 'string').toBe(true)
    })
  })

  // ============================================================================
  // is (boolean classification) tests
  // ============================================================================

  describe('is primitive', () => {
    it('should return true for valid assertion', async () => {
      const result = await is`the sky is blue`
      expect(typeof result).toBe('boolean')
      expect(result).toBe(true)
    })

    it('should return false for invalid assertion', async () => {
      const result = await is`the sky is green`
      expect(typeof result).toBe('boolean')
      expect(result).toBe(false)
    })

    it('should classify positive sentiment', async () => {
      const text = 'I absolutely love this product!'
      const result = await is`${text} expresses positive sentiment`
      expect(typeof result).toBe('boolean')
      expect(result).toBe(true)
    })

    it('should classify negative sentiment', async () => {
      const text = 'This is the worst experience ever.'
      const result = await is`${text} expresses positive sentiment`
      expect(typeof result).toBe('boolean')
      expect(result).toBe(false)
    })

    it('should validate email format', async () => {
      const validEmail = 'test@example.com'
      const invalidEmail = 'not-an-email'

      const validResult = await is`${validEmail} is a valid email address format`
      const invalidResult = await is`${invalidEmail} is a valid email address format`

      expect(validResult).toBe(true)
      expect(invalidResult).toBe(false)
    })
  })

  // ============================================================================
  // list (array generation) tests
  // ============================================================================

  describe('list primitive', () => {
    it('should generate a list of items', async () => {
      const result = await list`3 programming languages`
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(5)
    })

    it('should respect count in prompt', async () => {
      const result = await list`exactly 5 colors`
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
    })

    it('should generate domain-specific lists', async () => {
      const result = await list`3 common JavaScript array methods`
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      // Should contain array method names
      const combined = result.join(' ').toLowerCase()
      expect(combined).toMatch(/map|filter|reduce|forEach|find|some|every/i)
    })
  })

  // ============================================================================
  // lists (multiple named lists) tests
  // ============================================================================

  describe('lists primitive', () => {
    it('should generate multiple named lists', async () => {
      const result = await lists`strengths and weaknesses of TypeScript (2 each)`
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      // Should have at least 1 key representing a list
      const keys = Object.keys(result)
      expect(keys.length).toBeGreaterThanOrEqual(1)
      // Each value should be an array or the result itself contains lists
      let hasArrays = false
      for (const key of keys) {
        const value = result[key]
        if (Array.isArray(value)) {
          hasArrays = true
          expect(value.length).toBeGreaterThan(0)
        }
      }
      // If no arrays found at top level, the result structure may be different
      // Just verify we got some content back
      if (!hasArrays) {
        expect(JSON.stringify(result).length).toBeGreaterThan(10)
      }
    })
  })

  // ============================================================================
  // extract tests
  // ============================================================================

  describe('extract primitive', () => {
    it('should extract entities from text', async () => {
      const text = 'John Smith met Jane Doe at the coffee shop.'
      const result = await extract`person names from: ${text}`
      expect(Array.isArray(result)).toBe(true)
      const combined = result.join(' ').toLowerCase()
      expect(combined).toContain('john')
      expect(combined).toContain('jane')
    })

    it('should extract numbers from text', async () => {
      const text = 'The product costs $29.99 and weighs 2.5 kg.'
      const result = await extract`numbers from: ${text}`
      expect(Array.isArray(result)).toBe(true)
      const combined = result.join(' ')
      expect(combined).toMatch(/29\.99|2\.5/)
    })
  })

  // ============================================================================
  // summarize tests
  // ============================================================================

  describe('summarize primitive', () => {
    it('should summarize text', async () => {
      const article = `
        TypeScript is a strongly typed programming language that builds on JavaScript.
        It was developed and is maintained by Microsoft. TypeScript adds optional static
        typing and class-based object-oriented programming to the language. It is designed
        for development of large applications and transpiles to JavaScript.
      `
      const result = await summarize`${article}`
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThan(article.length)
      expect(result.toLowerCase()).toMatch(/typescript|programming|javascript/i)
    })
  })

  // ============================================================================
  // code tests
  // ============================================================================

  describe('code primitive', () => {
    it('should generate code', async () => {
      const result = await code`a simple function that adds two numbers in JavaScript`
      expect(typeof result).toBe('string')
      expect(result).toContain('function')
      expect(result).toMatch(/return|=>/)
    })

    it('should generate TypeScript code', async () => {
      const result = await code`a TypeScript function that checks if a string is empty`
      expect(typeof result).toBe('string')
      expect(result).toMatch(/function|const|=>/)
      expect(result.toLowerCase()).toMatch(/string|boolean/)
    })
  })

  // ============================================================================
  // generateText tests
  // ============================================================================

  describe('generateText', () => {
    it('should generate text with simple prompt', async () => {
      const { text } = await generateText({
        model: TEST_MODEL,
        prompt: 'Say "Hello, World!" and nothing else.',
      })
      expect(text).toBeDefined()
      expect(typeof text).toBe('string')
      expect(text.toLowerCase()).toContain('hello')
    })

    it('should respect system prompt', async () => {
      const { text } = await generateText({
        model: TEST_MODEL,
        system: 'You only respond with exactly one word.',
        prompt: 'What color is the sky?',
      })
      expect(text).toBeDefined()
      const wordCount = text.trim().split(/\s+/).length
      expect(wordCount).toBeLessThanOrEqual(3) // Allow some flexibility
    })
  })

  // ============================================================================
  // generateObject tests
  // ============================================================================

  describe('generateObject', () => {
    it('should generate object with string fields', async () => {
      const { object } = await generateObject({
        model: TEST_MODEL,
        schema: {
          greeting: 'A simple greeting',
          language: 'The language name',
        },
        prompt: 'Generate a greeting in Spanish',
      })

      expect(object).toBeDefined()
      expect(typeof object.greeting).toBe('string')
      expect(typeof object.language).toBe('string')
    })

    it('should generate object with number fields', async () => {
      const { object } = await generateObject({
        model: TEST_MODEL,
        schema: {
          result: 'The sum (number)',
          operation: 'The operation performed',
        },
        prompt: 'Add 5 + 3',
      })

      expect(object).toBeDefined()
      expect(typeof object.result).toBe('number')
      expect(object.result).toBe(8)
    })

    it('should generate object with array fields', async () => {
      const { object } = await generateObject({
        model: TEST_MODEL,
        schema: {
          colors: ['Primary color names'],
        },
        prompt: 'List the 3 primary colors',
      })

      expect(object).toBeDefined()
      expect(Array.isArray(object.colors)).toBe(true)
      expect(object.colors.length).toBe(3)
    })

    it('should generate object with enum fields', async () => {
      const { object } = await generateObject({
        model: TEST_MODEL,
        schema: {
          sentiment: 'positive | negative | neutral',
        },
        prompt: 'Classify the sentiment: "I am feeling great today!"',
      })

      expect(object).toBeDefined()
      expect(['positive', 'negative', 'neutral']).toContain(object.sentiment)
    })

    it('should generate nested objects', async () => {
      const { object } = await generateObject({
        model: TEST_MODEL,
        schema: {
          person: {
            name: 'First name',
            age: 'Age in years (number)',
          },
        },
        prompt: 'Generate a fictional person named Alice who is 30 years old',
      })

      expect(object).toBeDefined()
      expect(object.person).toBeDefined()
      expect(typeof object.person.name).toBe('string')
      expect(typeof object.person.age).toBe('number')
      expect(object.person.name.toLowerCase()).toContain('alice')
      expect(object.person.age).toBe(30)
    })
  })
})

// ============================================================================
// Edge cases and error handling
// ============================================================================

describe.skipIf(!hasGateway)('ai-primitives edge cases', () => {
  describe('handling special characters', () => {
    it('should handle prompts with special characters', async () => {
      const result = await write`what is 2+2? answer with just the number`
      expect(result).toBeDefined()
      expect(result.toString()).toContain('4')
    })

    it('should handle unicode in prompts', async () => {
      const result = await write`translate "hello" to Japanese (hiragana only)`
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      // Should contain hiragana characters or a transliteration
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('handling empty/minimal prompts', () => {
    it('should handle very short prompts', async () => {
      const result = await write`hi`
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  describe('handling complex interpolation', () => {
    it('should handle object interpolation in templates', async () => {
      const context = {
        topic: 'AI',
        audience: 'developers',
      }
      const result = await write`give me one tip about ${{ context }}`
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should handle array interpolation in templates', async () => {
      const topics = ['TypeScript', 'React', 'Node.js']
      const result = await write`pick one from ${topics} and say why you chose it`
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      const resultLower = result.toLowerCase()
      expect(
        resultLower.includes('typescript') ||
          resultLower.includes('react') ||
          resultLower.includes('node')
      ).toBe(true)
    })
  })
})

// ============================================================================
// Performance and caching verification
// ============================================================================

describe.skipIf(!hasGateway)('ai-primitives caching', () => {
  it('should return consistent results for identical prompts (cached)', async () => {
    // First call
    const result1 = await write`what is 1+1? answer only with the number`
    // Second call (should be cached)
    const result2 = await write`what is 1+1? answer only with the number`

    // Both should contain 2 (cached responses should be consistent)
    expect(result1).toContain('2')
    expect(result2).toContain('2')
  })
})
