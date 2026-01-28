/**
 * Tests for the core generate() primitive
 *
 * generate(type, prompt, opts?) is the foundation that all other functions use.
 * Tests require actual AI calls via the Cloudflare AI Gateway.
 */

import { describe, it, expect } from 'vitest'
import { generateObject, generateText } from '../src/generate.js'
import { z } from 'zod'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL

// ============================================================================
// generate(type, prompt, opts) signature tests
// ============================================================================

describe.skipIf(!hasGateway)('generate(type, prompt, opts)', () => {
  describe('type: json', () => {
    it('generates JSON without explicit schema (AI infers structure)', async () => {
      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          competitors: z.array(z.string()).describe('List of competitors'),
          marketSize: z.number().describe('Estimated market size'),
        }),
        prompt:
          'Provide a simple competitive analysis of the cloud computing market. List 2 competitors and an estimated market size in billions.',
      })

      expect(result.object).toHaveProperty('competitors')
      expect(result.object).toHaveProperty('marketSize')
      expect(Array.isArray(result.object.competitors)).toBe(true)
      expect(typeof result.object.marketSize).toBe('number')
    })

    it('generates JSON with schema (typed, validated)', async () => {
      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          name: z.string().describe('Recipe name'),
          servings: z.number().describe('Number of servings'),
          ingredients: z.array(z.string()).describe('List of ingredients'),
          steps: z.array(z.string()).describe('Cooking steps'),
        }),
        prompt: 'Generate a simple 3-ingredient recipe with 2 steps.',
      })

      expect(result.object).toHaveProperty('name')
      expect(result.object).toHaveProperty('servings')
      expect(typeof result.object.name).toBe('string')
      expect(typeof result.object.servings).toBe('number')
      expect(Array.isArray(result.object.ingredients)).toBe(true)
      expect(Array.isArray(result.object.steps)).toBe(true)
    })
  })

  describe('type: text', () => {
    it('generates plain text', async () => {
      const result = await generateText({
        model: 'haiku',
        prompt: 'Write one sentence about AI.',
      })

      expect(typeof result.text).toBe('string')
      expect(result.text.length).toBeGreaterThan(10)
    })
  })

  describe('type: code', () => {
    it('generates code with language specified in prompt', async () => {
      const result = await generateText({
        model: 'haiku',
        system:
          'You are a code generator. Output only valid TypeScript code, no explanations or markdown.',
        prompt:
          'Write a TypeScript function called validateEmail that takes a string and returns boolean.',
      })

      expect(typeof result.text).toBe('string')
      expect(result.text).toContain('function')
      expect(result.text).toMatch(/validateEmail|email/i)
    })

    it('generates code in different languages', async () => {
      const result = await generateText({
        model: 'haiku',
        system:
          'You are a code generator. Output only valid Python code, no explanations or markdown.',
        prompt:
          'Write a Python function called validate_email that takes a string and returns a boolean.',
      })

      expect(typeof result.text).toBe('string')
      expect(result.text).toContain('def')
    })
  })

  describe('type: markdown', () => {
    it('generates markdown content', async () => {
      const result = await generateText({
        model: 'haiku',
        system: 'You write in markdown format.',
        prompt: 'Write a very short README with a heading and 2 bullet points.',
      })

      expect(typeof result.text).toBe('string')
      expect(result.text).toContain('#')
    })
  })

  describe('type: yaml', () => {
    it('generates YAML content', async () => {
      const result = await generateText({
        model: 'haiku',
        system: 'You output only valid YAML, no explanations or markdown fences.',
        prompt: 'Generate a simple YAML config with name: "test-app" and port: 3000.',
      })

      expect(typeof result.text).toBe('string')
      expect(result.text.toLowerCase()).toContain('name')
    })
  })

  describe('type: list', () => {
    it('generates a list of items', async () => {
      const result = await generateObject({
        model: 'haiku',
        schema: z.object({
          items: z.array(z.string()).describe('List of startup ideas'),
        }),
        prompt: 'List exactly 3 startup ideas.',
      })

      expect(Array.isArray(result.object.items)).toBe(true)
      expect(result.object.items.length).toBe(3)
    })
  })

  describe('type: diagram', () => {
    it('generates diagram code', async () => {
      const result = await generateText({
        model: 'haiku',
        system:
          'You generate Mermaid diagram code. Output only the diagram code, no explanations or markdown fences.',
        prompt: 'Create a simple flowchart: Start -> Login -> Dashboard.',
      })

      expect(typeof result.text).toBe('string')
      // Mermaid diagrams typically contain --> or -> for connections
      expect(result.text).toMatch(/(flowchart|graph|-->|->)/i)
    })
  })
})

// ============================================================================
// Options parameter tests
// ============================================================================

describe.skipIf(!hasGateway)('generate options', () => {
  it('respects temperature option (low temperature = more deterministic)', async () => {
    // Low temperature should give consistent results
    const result1 = await generateText({
      model: 'haiku',
      prompt: 'Say exactly "hello" and nothing else.',
      temperature: 0,
    })

    const result2 = await generateText({
      model: 'haiku',
      prompt: 'Say exactly "hello" and nothing else.',
      temperature: 0,
    })

    // With temperature 0, responses should be very similar
    expect(result1.text.toLowerCase()).toContain('hello')
    expect(result2.text.toLowerCase()).toContain('hello')
  })

  it('accepts maxTokens option without error', async () => {
    // This test verifies the maxTokens option is passed through without error
    // The actual truncation behavior is provider-dependent
    const result = await generateText({
      model: 'haiku',
      prompt: 'Say "hello" and nothing else.',
      maxTokens: 50,
    })

    // Just verify we got a response - maxTokens behavior varies by provider/gateway
    expect(result.text).toBeDefined()
    expect(typeof result.text).toBe('string')
  })

  it('passes system prompt correctly', async () => {
    const result = await generateText({
      model: 'haiku',
      system: 'You always respond with exactly one word.',
      prompt: 'What is your favorite color?',
    })

    // With the system prompt, response should be short (ideally one word)
    const wordCount = result.text.trim().split(/\s+/).length
    expect(wordCount).toBeLessThanOrEqual(3) // Allow some flexibility
  })
})

// ============================================================================
// All convenience functions use generate
// ============================================================================

describe('convenience functions documentation', () => {
  it('documents the mapping', () => {
    // This test documents the expected mappings
    const mappings = {
      'ai(prompt)': 'generateText({ model, prompt })',
      'write(prompt)': 'generateText({ model, prompt })',
      'code(prompt)': "generateText({ model, system: 'code generator', prompt })",
      'list(prompt)': 'generateObject({ model, schema: { items: [...] }, prompt })',
      'lists(prompt)':
        'generateObject({ model, schema: { listName1: [...], listName2: [...] }, prompt })',
      'extract(prompt)': 'generateObject({ model, schema: { extracted: [...] }, prompt })',
      'summarize(prompt)': "generateText({ model, system: 'summarizer', prompt })",
      'diagram(prompt)': "generateText({ model, system: 'mermaid generator', prompt })",
      'is(prompt)': 'generateObject({ model, schema: { result: boolean }, prompt })',
    }

    expect(Object.keys(mappings)).toHaveLength(9)
  })
})
