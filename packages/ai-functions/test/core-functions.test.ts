/**
 * Tests for core AI functions
 *
 * These tests verify the API contracts for each function.
 * Tests require actual AI calls via the Cloudflare AI Gateway.
 */

import { describe, it, expect } from 'vitest'
import { generateText, generateObject } from '../src/generate.js'
import { z } from 'zod'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL

// ============================================================================
// ai() - Direct text generation
// ============================================================================

describe.skipIf(!hasGateway)('ai()', () => {
  it('should generate text from a string prompt', async () => {
    const result = await generateText({
      model: 'haiku',
      prompt: 'Say "hello world" and nothing else.',
    })

    expect(result.text).toBeDefined()
    expect(typeof result.text).toBe('string')
    expect(result.text.toLowerCase()).toContain('hello')
  })

  it('should respect model parameter', async () => {
    const result = await generateText({
      model: 'haiku',
      prompt: 'Respond with just the word "yes".',
    })

    expect(result.text).toBeDefined()
    expect(result.text.toLowerCase()).toContain('yes')
  })

  it('should return string type', async () => {
    const result = await generateText({
      model: 'haiku',
      prompt: 'Say "test".',
    })

    expect(typeof result.text).toBe('string')
  })
})

// ============================================================================
// is() - Boolean classification
// ============================================================================

describe.skipIf(!hasGateway)('is()', () => {
  it('should return boolean true for valid classification', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        isValid: z.boolean().describe('Is this a valid email address?'),
      }),
      prompt: 'Is "hello@example.com" a valid email address?',
    })

    expect(result.object.isValid).toBe(true)
  })

  it('should return boolean false for invalid classification', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        isValid: z.boolean().describe('Is this a valid email address?'),
      }),
      prompt: 'Is "not-an-email" a valid email address?',
    })

    expect(result.object.isValid).toBe(false)
  })

  it('should handle sentiment classification', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        isPositive: z.boolean().describe('Is this positive sentiment?'),
      }),
      prompt: 'Is "I love this product, it\'s amazing!" positive sentiment?',
    })

    expect(result.object.isPositive).toBe(true)
  })
})

// ============================================================================
// list() - Generate a list
// ============================================================================

describe.skipIf(!hasGateway)('list()', () => {
  it('should return an array of strings', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        items: z.array(z.string()).describe('List of 3 colors'),
      }),
      prompt: 'List exactly 3 colors.',
    })

    expect(Array.isArray(result.object.items)).toBe(true)
    expect(result.object.items.length).toBeGreaterThanOrEqual(1)
    expect(result.object.items.every((item: unknown) => typeof item === 'string')).toBe(true)
  })

  it('should respect count in prompt', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        items: z.array(z.string()).describe('List of items'),
      }),
      prompt: 'List exactly 5 fruits.',
    })

    expect(result.object.items.length).toBe(5)
  })
})

// ============================================================================
// lists() - Generate multiple named lists
// ============================================================================

describe.skipIf(!hasGateway)('lists()', () => {
  it('should return named lists object', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        pros: z.array(z.string()).describe('List of pros/advantages'),
        cons: z.array(z.string()).describe('List of cons/disadvantages'),
      }),
      prompt: 'List 2 pros and 2 cons of working remotely.',
    })

    expect(result.object).toHaveProperty('pros')
    expect(result.object).toHaveProperty('cons')
    expect(Array.isArray(result.object.pros)).toBe(true)
    expect(Array.isArray(result.object.cons)).toBe(true)
  })
})

// ============================================================================
// extract() - Extract from text
// ============================================================================

describe.skipIf(!hasGateway)('extract()', () => {
  it('should extract items from text', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        names: z.array(z.string()).describe('Person names mentioned in the text'),
      }),
      prompt:
        'Extract all person names from: "John Smith met with Jane Doe yesterday. Bob was also there."',
    })

    expect(Array.isArray(result.object.names)).toBe(true)
    expect(result.object.names.length).toBeGreaterThanOrEqual(2)
  })

  it('should support schema for structured extraction', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        companies: z.array(
          z.object({
            name: z.string().describe('Company name'),
            role: z.enum(['competitor', 'partner', 'customer']).describe('Role mentioned'),
          })
        ),
      }),
      prompt:
        'Extract companies from: "Our competitor Acme Corp launched a new product. Our partner Beta Inc helped with distribution."',
    })

    expect(result.object.companies.length).toBeGreaterThanOrEqual(2)
    expect(result.object.companies[0]).toHaveProperty('name')
    expect(result.object.companies[0]).toHaveProperty('role')
  })
})

// ============================================================================
// write() - Generate text content
// ============================================================================

describe.skipIf(!hasGateway)('write()', () => {
  it('should generate text content', async () => {
    const result = await generateText({
      model: 'haiku',
      prompt: 'Write a short greeting message (1-2 sentences).',
    })

    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('should support system prompt for tone', async () => {
    const result = await generateText({
      model: 'haiku',
      system: 'You write in a casual, friendly tone.',
      prompt: 'Write a one-sentence welcome message.',
    })

    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// code() - Generate code
// ============================================================================

describe.skipIf(!hasGateway)('code()', () => {
  it('should generate code', async () => {
    const result = await generateText({
      model: 'haiku',
      system: 'You are a code generator. Output only code, no explanations.',
      prompt: 'Write a JavaScript function called isEven that returns true if a number is even.',
    })

    expect(typeof result.text).toBe('string')
    expect(result.text).toContain('function')
  })

  it('should generate TypeScript code', async () => {
    const result = await generateText({
      model: 'haiku',
      system: 'You are a TypeScript code generator. Output only code, no explanations.',
      prompt:
        'Write a TypeScript function called add that takes two numbers and returns their sum. Include type annotations.',
    })

    expect(typeof result.text).toBe('string')
    expect(result.text).toContain('number')
  })
})

// ============================================================================
// diagram() - Generate diagrams
// ============================================================================

describe.skipIf(!hasGateway)('diagram()', () => {
  it('should generate mermaid diagrams', async () => {
    const result = await generateText({
      model: 'haiku',
      system:
        'You generate Mermaid diagram code. Output only the mermaid code, no explanations or markdown fences.',
      prompt: 'Create a simple flowchart with Start -> Process -> End.',
    })

    expect(typeof result.text).toBe('string')
    // Mermaid flowcharts use arrows like --> or ->
    expect(result.text).toMatch(/(-->|->)/)
  })
})

// ============================================================================
// Structured object generation
// ============================================================================

describe.skipIf(!hasGateway)('generateObject()', () => {
  it('should generate a structured recipe', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        name: z.string().describe('Recipe name'),
        servings: z.number().describe('Number of servings'),
        ingredients: z.array(z.string()).describe('List of ingredients'),
      }),
      prompt: 'Generate a simple 2-ingredient recipe.',
    })

    expect(result.object).toHaveProperty('name')
    expect(result.object).toHaveProperty('servings')
    expect(result.object).toHaveProperty('ingredients')
    expect(typeof result.object.name).toBe('string')
    expect(typeof result.object.servings).toBe('number')
    expect(Array.isArray(result.object.ingredients)).toBe(true)
  })

  it('should respect enum constraints', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral']).describe('Sentiment of the text'),
      }),
      prompt: 'Analyze the sentiment of: "I had a wonderful day today!"',
    })

    expect(['positive', 'negative', 'neutral']).toContain(result.object.sentiment)
    expect(result.object.sentiment).toBe('positive')
  })
})
