/**
 * AI Primitives Eval Suite
 *
 * Tests the core AI functions (code, ai, list, is, etc.) with real AI calls
 * across multiple models to ensure consistent behavior and quality.
 *
 * Run with: pnpm test -- test/evals/primitives.eval.test.ts
 * Run specific model: MODEL=sonnet pnpm test -- test/evals/primitives.eval.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ai, code, list, is, summarize, extract, write, lists } from '../../src/primitives.js'
import { EVAL_MODELS, type EvalModel, type ModelTier } from '../../src/eval/models.js'

// Configuration
const EVAL_TIERS: ModelTier[] = (process.env.EVAL_TIERS?.split(',') as ModelTier[]) || ['fast']
const SINGLE_MODEL = process.env.MODEL

// Get models to test
function getTestModels(): EvalModel[] {
  if (SINGLE_MODEL) {
    const model = EVAL_MODELS.find(m => m.id === SINGLE_MODEL || m.name.toLowerCase().includes(SINGLE_MODEL.toLowerCase()))
    return model ? [model] : EVAL_MODELS.filter(m => m.tier === 'fast').slice(0, 1)
  }
  return EVAL_MODELS.filter(m => EVAL_TIERS.includes(m.tier))
}

// Skip if no API access
const hasAPI = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY

// Test timeout for AI calls
const AI_TIMEOUT = 30000

describe.skipIf(!hasAPI)('AI Primitives Evals', () => {
  const models = getTestModels()

  beforeAll(() => {
    console.log(`\nRunning evals on ${models.length} models: ${models.map(m => m.name).join(', ')}\n`)
  })

  // ==========================================================================
  // code() - Code Generation
  // ==========================================================================
  describe('code()', () => {
    const testCases = [
      {
        name: 'generates email validation function',
        prompt: 'email validation function in TypeScript',
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(20)
          // Should contain function-like syntax
          expect(result).toMatch(/function|const|=>|def|public/)
        },
      },
      {
        name: 'generates a sorting algorithm',
        prompt: 'quicksort function in JavaScript',
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result.toLowerCase()).toMatch(/sort|pivot|partition|array/)
        },
      },
      {
        name: 'generates API endpoint',
        prompt: 'REST API endpoint for user authentication in Express.js',
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result).toMatch(/router|app\.|req|res|post|get/i)
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await code(tc.prompt, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // ai() - General AI with Dynamic Schema
  // ==========================================================================
  describe('ai()', () => {
    const testCases = [
      {
        name: 'generates text response',
        prompt: 'explain what TypeScript is in one sentence',
        validate: (result: unknown) => {
          expect(result).toBeDefined()
          // ai() returns object by default with dynamic schema
          expect(typeof result === 'string' || typeof result === 'object').toBe(true)
        },
      },
      {
        name: 'handles complex prompts',
        prompt: 'analyze the pros and cons of microservices architecture',
        validate: (result: unknown) => {
          expect(result).toBeDefined()
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await ai(tc.prompt, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // list() - List Generation
  // ==========================================================================
  describe('list()', () => {
    const testCases = [
      {
        name: 'generates list of programming languages',
        prompt: '5 popular programming languages',
        validate: (result: string[]) => {
          expect(Array.isArray(result)).toBe(true)
          expect(result.length).toBeGreaterThanOrEqual(3)
          expect(result.every(item => typeof item === 'string')).toBe(true)
        },
      },
      {
        name: 'generates list of startup ideas',
        prompt: '3 AI startup ideas',
        validate: (result: string[]) => {
          expect(Array.isArray(result)).toBe(true)
          expect(result.length).toBeGreaterThanOrEqual(2)
        },
      },
      {
        name: 'generates list with specific count',
        prompt: '7 colors of the rainbow',
        validate: (result: string[]) => {
          expect(Array.isArray(result)).toBe(true)
          // Should be close to 7
          expect(result.length).toBeGreaterThanOrEqual(5)
          expect(result.length).toBeLessThanOrEqual(10)
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await list(tc.prompt, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // is() - Boolean Classification
  // ==========================================================================
  describe('is()', () => {
    const testCases = [
      {
        name: 'correctly identifies valid email',
        prompt: 'hello@example.com a valid email address',
        expected: true,
      },
      {
        name: 'correctly identifies invalid email',
        prompt: 'not-an-email a valid email address',
        expected: false,
      },
      {
        name: 'correctly identifies positive sentiment',
        prompt: '"I love this product, it is amazing!" positive sentiment',
        expected: true,
      },
      {
        name: 'correctly identifies negative sentiment',
        prompt: '"This is terrible, worst purchase ever" positive sentiment',
        expected: false,
      },
      {
        name: 'correctly identifies programming language',
        prompt: 'Python a programming language',
        expected: true,
      },
      {
        name: 'correctly identifies non-programming language',
        prompt: 'Banana a programming language',
        expected: false,
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await is(tc.prompt, { model: model.id })
            expect(typeof result).toBe('boolean')
            expect(result).toBe(tc.expected)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // summarize() - Text Summarization
  // ==========================================================================
  describe('summarize()', () => {
    const longText = `
      Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans.
      AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.
      The term "artificial intelligence" had previously been used to describe machines that mimic and display "human" cognitive skills that are associated with the human mind, such as "learning" and "problem-solving".
      This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.
      AI applications include advanced web search engines, recommendation systems, understanding human speech, self-driving cars, automated decision-making and competing at the highest level in strategic game systems.
    `

    const testCases = [
      {
        name: 'summarizes long text',
        input: longText,
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(20)
          expect(result.length).toBeLessThan(longText.length)
          // Should mention AI or artificial intelligence
          expect(result.toLowerCase()).toMatch(/ai|artificial intelligence|machine|intelligence/)
        },
      },
      {
        name: 'summarizes technical content',
        input: 'REST (Representational State Transfer) is an architectural style for distributed hypermedia systems. It was introduced by Roy Fielding in 2000. REST APIs use HTTP methods (GET, POST, PUT, DELETE) to perform CRUD operations on resources identified by URIs.',
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(10)
          expect(result.toLowerCase()).toMatch(/rest|api|http/)
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await summarize(tc.input, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // extract() - Data Extraction
  // ==========================================================================
  describe('extract()', () => {
    const testCases = [
      {
        name: 'extracts email addresses',
        prompt: 'email addresses from "Contact us at support@example.com or sales@company.org for assistance"',
        validate: (result: unknown[]) => {
          expect(Array.isArray(result)).toBe(true)
          expect(result.length).toBeGreaterThanOrEqual(1)
          // Should contain email-like strings
          const resultStr = JSON.stringify(result).toLowerCase()
          expect(resultStr).toMatch(/@/)
        },
      },
      {
        name: 'extracts names',
        prompt: 'person names from "The meeting was attended by John Smith, Jane Doe, and Bob Johnson"',
        validate: (result: unknown[]) => {
          expect(Array.isArray(result)).toBe(true)
          expect(result.length).toBeGreaterThanOrEqual(2)
        },
      },
      {
        name: 'extracts numbers',
        prompt: 'numbers from "The product costs $49.99 and we sold 150 units in Q3 with 23% growth"',
        validate: (result: unknown[]) => {
          expect(Array.isArray(result)).toBe(true)
          expect(result.length).toBeGreaterThanOrEqual(2)
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await extract(tc.prompt, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // write() - Text Generation
  // ==========================================================================
  describe('write()', () => {
    const testCases = [
      {
        name: 'writes professional email',
        prompt: 'a professional email to schedule a meeting',
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(50)
          expect(result.toLowerCase()).toMatch(/meeting|schedule|time|available/)
        },
      },
      {
        name: 'writes product description',
        prompt: 'a short product description for a wireless bluetooth headphone',
        validate: (result: string) => {
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(30)
          expect(result.toLowerCase()).toMatch(/wireless|bluetooth|headphone|audio|sound/)
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await write(tc.prompt, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })

  // ==========================================================================
  // lists() - Multiple Named Lists
  // ==========================================================================
  describe('lists()', () => {
    const testCases = [
      {
        name: 'generates pros and cons',
        prompt: 'pros and cons of remote work',
        validate: (result: Record<string, string[]>) => {
          expect(typeof result).toBe('object')
          // Should have categorized lists
          const keys = Object.keys(result)
          expect(keys.length).toBeGreaterThanOrEqual(1)
        },
      },
      {
        name: 'generates SWOT analysis',
        prompt: 'strengths weaknesses opportunities and threats for a startup',
        validate: (result: Record<string, string[]>) => {
          expect(typeof result).toBe('object')
          const keys = Object.keys(result)
          expect(keys.length).toBeGreaterThanOrEqual(1)
        },
      },
    ]

    for (const model of models) {
      describe(`[${model.name}]`, () => {
        for (const tc of testCases) {
          it(tc.name, async () => {
            const result = await lists(tc.prompt, { model: model.id })
            tc.validate(result)
          }, AI_TIMEOUT)
        }
      })
    }
  })
})
