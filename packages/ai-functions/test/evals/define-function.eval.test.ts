/**
 * defineFunction Eval Suite
 *
 * Tests the defineFunction API with real AI calls across multiple models.
 * Ensures that defined functions work correctly with generative, agentic, and code types.
 *
 * Run with: pnpm test -- test/evals/define-function.eval.test.ts
 * Run specific model: MODEL=sonnet pnpm test -- test/evals/define-function.eval.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { define, defineFunction, functions } from '../../src/index.js'
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

describe.skipIf(!hasAPI)('defineFunction Evals', () => {
  const models = getTestModels()

  beforeEach(() => {
    functions.clear()
  })

  // ==========================================================================
  // Generative Functions
  // ==========================================================================
  describe('define.generative()', () => {
    describe('string output functions', () => {
      for (const model of models) {
        describe(`[${model.name}]`, () => {
          it('executes greeting function', async () => {
            const greet = define.generative({
              name: 'greet',
              args: { name: 'Name to greet' },
              output: 'string',
              promptTemplate: 'Say hello to {{name}} in a friendly way',
              model: model.id,
            })

            const result = await greet.call({ name: 'World' })
            expect(typeof result).toBe('string')
            expect((result as string).toLowerCase()).toMatch(/hello|hi|hey|greet/)
          }, AI_TIMEOUT)

          it('executes translation function', async () => {
            const translate = define.generative({
              name: 'translate',
              args: {
                text: 'Text to translate',
                targetLang: 'Target language',
              },
              output: 'string',
              promptTemplate: 'Translate "{{text}}" to {{targetLang}}',
              model: model.id,
            })

            const result = await translate.call({ text: 'Hello', targetLang: 'Spanish' })
            expect(typeof result).toBe('string')
            expect((result as string).toLowerCase()).toMatch(/hola|buenos/)
          }, AI_TIMEOUT)

          it('executes summarization function', async () => {
            const summarizeText = define.generative({
              name: 'summarizeText',
              args: { text: 'Text to summarize' },
              output: 'string',
              promptTemplate: 'Summarize the following in one sentence: {{text}}',
              model: model.id,
            })

            const longText = 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale. TypeScript adds additional syntax to JavaScript to support a tighter integration with your editor. Catch errors early in your editor.'

            const result = await summarizeText.call({ text: longText })
            expect(typeof result).toBe('string')
            expect((result as string).length).toBeGreaterThan(10)
            expect((result as string).length).toBeLessThan(longText.length)
          }, AI_TIMEOUT)
        })
      }
    })

    describe('object output functions', () => {
      for (const model of models) {
        describe(`[${model.name}]`, () => {
          it('executes sentiment analysis function', async () => {
            const analyzeSentiment = define.generative({
              name: 'analyzeSentiment',
              args: { text: 'Text to analyze' },
              output: 'object',
              returnType: {
                sentiment: 'positive | negative | neutral',
                confidence: 'Confidence score 0-1 (number)',
                reasoning: 'Brief explanation',
              },
              promptTemplate: 'Analyze the sentiment of: {{text}}',
              model: model.id,
            })

            const result = await analyzeSentiment.call({ text: 'I absolutely love this product!' }) as {
              sentiment: string
              confidence: number
              reasoning: string
            }

            expect(result).toBeDefined()
            expect(['positive', 'negative', 'neutral']).toContain(result.sentiment)
            expect(typeof result.confidence).toBe('number')
            expect(result.confidence).toBeGreaterThanOrEqual(0)
            expect(result.confidence).toBeLessThanOrEqual(1)
          }, AI_TIMEOUT)

          it('executes entity extraction function', async () => {
            const extractEntities = define.generative({
              name: 'extractEntities',
              args: { text: 'Text to extract entities from' },
              output: 'object',
              returnType: {
                people: ['Names of people mentioned'],
                organizations: ['Names of organizations mentioned'],
                locations: ['Location names mentioned'],
              },
              promptTemplate: 'Extract named entities from: {{text}}',
              model: model.id,
            })

            const result = await extractEntities.call({
              text: 'John Smith from Google met with Jane Doe at the New York office to discuss the project.',
            }) as {
              people: string[]
              organizations: string[]
              locations: string[]
            }

            expect(result).toBeDefined()
            expect(Array.isArray(result.people)).toBe(true)
            expect(Array.isArray(result.organizations)).toBe(true)
            expect(Array.isArray(result.locations)).toBe(true)

            // Should find at least some entities
            const totalEntities = result.people.length + result.organizations.length + result.locations.length
            expect(totalEntities).toBeGreaterThanOrEqual(2)
          }, AI_TIMEOUT)

          it('executes classification function', async () => {
            const classifyTicket = define.generative({
              name: 'classifyTicket',
              args: { ticket: 'Support ticket text' },
              output: 'object',
              returnType: {
                category: 'billing | technical | account | shipping',
                priority: 'low | medium | high',
                suggestedAction: 'Brief suggested action',
              },
              promptTemplate: 'Classify this support ticket: {{ticket}}',
              model: model.id,
            })

            const result = await classifyTicket.call({
              ticket: 'My credit card was charged twice for the same order and I need a refund immediately!',
            }) as {
              category: string
              priority: string
              suggestedAction: string
            }

            expect(result).toBeDefined()
            expect(['billing', 'technical', 'account', 'shipping']).toContain(result.category)
            expect(['low', 'medium', 'high']).toContain(result.priority)
            expect(typeof result.suggestedAction).toBe('string')
          }, AI_TIMEOUT)
        })
      }
    })
  })

  // ==========================================================================
  // Code Generation Functions
  // ==========================================================================
  describe('define.code()', () => {
    for (const model of models) {
      describe(`[${model.name}]`, () => {
        it('generates TypeScript function', async () => {
          const generateTs = define.code({
            name: 'generateTypeScript',
            args: { spec: 'Function specification' },
            language: 'typescript',
            model: model.id,
          })

          const result = await generateTs.call({
            spec: 'A function that checks if a string is a valid URL',
          })

          expect(typeof result).toBe('string')
          expect((result as string).length).toBeGreaterThan(20)
          // Should contain TypeScript/JavaScript-like syntax
          expect(result as string).toMatch(/function|const|=>|return/)
        }, AI_TIMEOUT)

        it('generates Python function', async () => {
          const generatePy = define.code({
            name: 'generatePython',
            args: { spec: 'Function specification' },
            language: 'python',
            model: model.id,
          })

          const result = await generatePy.call({
            spec: 'A function that calculates the factorial of a number',
          })

          expect(typeof result).toBe('string')
          expect((result as string).length).toBeGreaterThan(20)
          // Should contain Python-like syntax
          expect(result as string).toMatch(/def|return|if|else/)
        }, AI_TIMEOUT)

        it('generates SQL query', async () => {
          const generateSql = define.code({
            name: 'generateSql',
            args: { spec: 'Query specification' },
            language: 'sql',
            model: model.id,
          })

          const result = await generateSql.call({
            spec: 'Select all users who signed up in the last 30 days',
          })

          expect(typeof result).toBe('string')
          expect((result as string).toUpperCase()).toMatch(/SELECT|FROM|WHERE/)
        }, AI_TIMEOUT)
      })
    }
  })

  // ==========================================================================
  // Function Registration and Tool Generation
  // ==========================================================================
  describe('function registry and tools', () => {
    it('registers functions in the registry', () => {
      const fn = define.generative({
        name: 'testRegistration',
        args: { input: 'Test input' },
        output: 'string',
      })

      expect(functions.has('testRegistration')).toBe(true)
      expect(functions.get('testRegistration')).toBeDefined()
      expect(functions.list()).toContain('testRegistration')
    })

    it('generates valid tool schema', () => {
      const fn = define.generative({
        name: 'processData',
        description: 'Process input data and return results',
        args: {
          data: 'The data to process',
          format: 'Output format (json | csv | xml)',
        },
        output: 'string',
      })

      const tool = fn.asTool()

      expect(tool.name).toBe('processData')
      expect(tool.description).toBe('Process input data and return results')
      expect(tool.parameters.type).toBe('object')
      expect(tool.parameters.properties).toHaveProperty('data')
      expect(tool.parameters.properties).toHaveProperty('format')
      expect(tool.parameters.required).toContain('data')
      expect(tool.parameters.required).toContain('format')
    })

    it('clears all registered functions', () => {
      define.generative({ name: 'fn1', args: {}, output: 'string' })
      define.generative({ name: 'fn2', args: {}, output: 'string' })
      define.generative({ name: 'fn3', args: {}, output: 'string' })

      expect(functions.list().length).toBeGreaterThanOrEqual(3)

      functions.clear()

      expect(functions.list()).toEqual([])
    })
  })

  // ==========================================================================
  // Complex Multi-Step Functions
  // ==========================================================================
  describe('complex functions', () => {
    for (const model of models) {
      describe(`[${model.name}]`, () => {
        it('executes multi-output analysis function', async () => {
          const analyzeArticle = define.generative({
            name: 'analyzeArticle',
            args: { article: 'Article text to analyze' },
            output: 'object',
            returnType: {
              title: 'Generated title for the article',
              summary: 'Brief summary (2-3 sentences)',
              keyPoints: ['Main points from the article'],
              readingTime: 'Estimated reading time in minutes (number)',
            },
            promptTemplate: 'Analyze this article and provide structured output: {{article}}',
            model: model.id,
          })

          const article = `
            Machine learning has revolutionized the tech industry. Companies are using AI to automate tasks,
            improve customer service, and make better predictions. From healthcare to finance, the applications
            are endless. However, there are concerns about job displacement and ethical use of AI.
          `

          const result = await analyzeArticle.call({ article }) as {
            title: string
            summary: string
            keyPoints: string[]
            readingTime: number
          }

          expect(result).toBeDefined()
          expect(typeof result.title).toBe('string')
          expect(result.title.length).toBeGreaterThan(5)
          expect(typeof result.summary).toBe('string')
          expect(result.summary.length).toBeGreaterThan(20)
          expect(Array.isArray(result.keyPoints)).toBe(true)
          expect(result.keyPoints.length).toBeGreaterThanOrEqual(1)
          expect(typeof result.readingTime).toBe('number')
        }, AI_TIMEOUT)

        it('executes math problem solver', async () => {
          const solveMath = define.generative({
            name: 'solveMath',
            args: { problem: 'Math problem to solve' },
            output: 'object',
            returnType: {
              answer: 'The numeric answer (number)',
              steps: ['Step by step solution'],
              formula: 'Mathematical formula used (if applicable)',
            },
            promptTemplate: 'Solve this math problem step by step: {{problem}}',
            model: model.id,
          })

          const result = await solveMath.call({
            problem: 'What is 15% of 200?',
          }) as {
            answer: number
            steps: string[]
            formula: string
          }

          expect(result).toBeDefined()
          expect(typeof result.answer).toBe('number')
          expect(Math.abs(result.answer - 30)).toBeLessThan(1) // Allow small floating point difference
          expect(Array.isArray(result.steps)).toBe(true)
        }, AI_TIMEOUT)
      })
    }
  })
})
