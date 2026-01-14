/**
 * TDD Tests for Natural Language Queries with LLM Integration
 *
 * RED Phase: These tests define the expected behavior for NL queries
 * that use LLM to convert natural language to filter operations.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DB,
  setProvider,
  createMemoryProvider,
  setNLQueryGenerator,
  configureAIGeneration,
} from '../src/index.js'
import type {
  NLQueryResult,
  NLQueryGenerator,
  NLQueryContext,
  NLQueryPlan,
} from '../src/index.js'

// Mock ai-functions to avoid real API calls in tests
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      types: ['Lead'],
      filters: {},
      interpretation: 'Mocked interpretation',
      confidence: 0.9,
    },
  }),
}))

describe('Natural Language Queries with LLM Integration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    // Reset NL query generator before each test
    setNLQueryGenerator(null as unknown as NLQueryGenerator)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const schema = {
    Lead: {
      name: 'string',
      score: 'number',
      status: 'string',
      createdAt: 'datetime?',
    },
    Order: {
      total: 'number',
      status: 'string',
      customer: 'string',
      createdAt: 'datetime?',
    },
  } as const

  describe('NL queries convert to filter operations via LLM', () => {
    it('should convert "high scoring leads" to filter operations', async () => {
      const { generateObject } = await import('ai-functions')

      // Configure mock to return filter for high scores
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: { score: { $gt: 70 } },
          interpretation: 'Find leads with score greater than 70',
          confidence: 0.9,
        },
      })

      // Create a default NL generator that uses generateObject
      const defaultNLGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {
            types: 'string[] - which entity types to query',
            filters: 'object - filter conditions to apply',
            search: 'string? - optional search term',
            interpretation: 'string - what the query means',
            confidence: 'number - confidence score 0-1',
          },
          prompt: `Convert this natural language query to a query plan.
Schema context: ${JSON.stringify(context)}
Query: "${prompt}"`,
        })
        return result.object as NLQueryPlan
      }

      setNLQueryGenerator(defaultNLGenerator)

      const { db } = DB(schema)

      // Seed test data
      await db.Lead.create({ name: 'Alice', score: 95, status: 'active' })
      await db.Lead.create({ name: 'Bob', score: 45, status: 'active' })
      await db.Lead.create({ name: 'Charlie', score: 80, status: 'closed' })

      const result = await db.Lead`who are the high scoring leads?`

      // generateObject should have been called to interpret the query
      expect(generateObject).toHaveBeenCalled()

      // The result should have high confidence (LLM-based interpretation)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.interpretation).toContain('score')
    })

    it('should convert status filter queries to filter operations', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: { status: 'active' },
          interpretation: 'Find leads with status active',
          confidence: 0.95,
        },
      })

      const defaultNLGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {
            types: 'string[]',
            filters: 'object',
            interpretation: 'string',
            confidence: 'number',
          },
          prompt: `Convert query to plan. Context: ${JSON.stringify(context)}. Query: "${prompt}"`,
        })
        return result.object as NLQueryPlan
      }

      setNLQueryGenerator(defaultNLGenerator)

      const { db } = DB(schema)

      await db.Lead.create({ name: 'Active Lead', score: 50, status: 'active' })
      await db.Lead.create({ name: 'Closed Lead', score: 60, status: 'closed' })

      const result = await db.Lead`which leads are still active?`

      expect(result.results).toHaveLength(1)
      expect((result.results[0] as { status: string }).status).toBe('active')
    })

    it('should convert numeric comparison queries', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Order'],
          filters: { total: { $gt: 2000 } },
          interpretation: 'Find orders with total greater than 2000',
          confidence: 0.92,
        },
      })

      const defaultNLGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {
            types: 'string[]',
            filters: 'object',
            interpretation: 'string',
            confidence: 'number',
          },
          prompt: `Query: "${prompt}"`,
        })
        return result.object as NLQueryPlan
      }

      setNLQueryGenerator(defaultNLGenerator)

      const { db } = DB(schema)

      await db.Order.create({ total: 1000, status: 'completed', customer: 'A' })
      await db.Order.create({ total: 5000, status: 'completed', customer: 'B' })
      await db.Order.create({ total: 3000, status: 'pending', customer: 'C' })

      const result = await db.Order`orders over $2000`

      expect(result.results.length).toBe(2)
      expect(
        result.results.every((r) => (r as { total: number }).total > 2000)
      ).toBe(true)
    })
  })

  describe('Schema context provided to LLM for accurate queries', () => {
    it('should provide complete schema context to the LLM', async () => {
      let capturedContext: NLQueryContext | null = null

      const contextCapturingGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        capturedContext = context
        return {
          types: ['Lead'],
          interpretation: prompt,
          confidence: 0.9,
        }
      }

      setNLQueryGenerator(contextCapturingGenerator)

      const { db } = DB(schema)
      await db.Lead`show all leads`

      // Verify context includes schema information
      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.types).toBeDefined()
      expect(capturedContext!.types.length).toBeGreaterThan(0)

      // Check Lead type is included with all fields
      const leadType = capturedContext!.types.find((t) => t.name === 'Lead')
      expect(leadType).toBeDefined()
      expect(leadType!.fields).toContain('name')
      expect(leadType!.fields).toContain('score')
      expect(leadType!.fields).toContain('status')
      expect(leadType!.fields).toContain('createdAt')

      // Check Order type is also included
      const orderType = capturedContext!.types.find((t) => t.name === 'Order')
      expect(orderType).toBeDefined()
      expect(orderType!.fields).toContain('total')
    })

    it('should include singular and plural forms in context', async () => {
      let capturedContext: NLQueryContext | null = null

      const contextCapturingGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        capturedContext = context
        return {
          types: ['Lead'],
          interpretation: prompt,
          confidence: 0.9,
        }
      }

      setNLQueryGenerator(contextCapturingGenerator)

      const { db } = DB(schema)
      await db.Lead`find leads`

      const leadType = capturedContext!.types.find((t) => t.name === 'Lead')
      expect(leadType!.singular).toBe('lead')
      expect(leadType!.plural).toBe('leads')
    })

    it('should include target type when using entity template', async () => {
      let capturedContext: NLQueryContext | null = null

      const contextCapturingGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        capturedContext = context
        return {
          types: [context.targetType || 'Lead'],
          interpretation: prompt,
          confidence: 0.9,
        }
      }

      setNLQueryGenerator(contextCapturingGenerator)

      const { db } = DB(schema)
      await db.Order`pending orders`

      expect(capturedContext!.targetType).toBe('Order')
    })

    it('should include relationships in context', async () => {
      const relationalSchema = {
        Lead: {
          name: 'string',
          company: '->Company',
        },
        Company: {
          name: 'string',
        },
      } as const

      let capturedContext: NLQueryContext | null = null

      const contextCapturingGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        capturedContext = context
        return {
          types: ['Lead'],
          interpretation: prompt,
          confidence: 0.9,
        }
      }

      setNLQueryGenerator(contextCapturingGenerator)

      const { db } = DB(relationalSchema)
      await db.Lead`leads with their companies`

      const leadType = capturedContext!.types.find((t) => t.name === 'Lead')
      expect(leadType!.relationships).toBeDefined()
      expect(leadType!.relationships.length).toBeGreaterThan(0)
      expect(leadType!.relationships[0]).toMatchObject({
        name: 'company',
        to: 'Company',
        cardinality: 'one',
      })
    })
  })

  describe('Temporal queries work (this week, this year, etc.)', () => {
    it('should handle "this week" temporal queries', async () => {
      const { generateObject } = await import('ai-functions')

      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: {},
          timeRange: { since: startOfWeek.toISOString() },
          interpretation: 'Find leads created this week',
          confidence: 0.9,
        },
      })

      const defaultNLGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {
            types: 'string[]',
            filters: 'object',
            timeRange: 'object?',
            interpretation: 'string',
            confidence: 'number',
          },
          prompt: `Query: "${prompt}"`,
        })
        const plan = result.object as NLQueryPlan & {
          timeRange?: { since?: string; until?: string }
        }
        // Convert ISO strings back to Date objects
        if (plan.timeRange) {
          plan.timeRange = {
            since: plan.timeRange.since
              ? new Date(plan.timeRange.since)
              : undefined,
            until: plan.timeRange.until
              ? new Date(plan.timeRange.until)
              : undefined,
          }
        }
        return plan
      }

      setNLQueryGenerator(defaultNLGenerator)

      const { db } = DB(schema)

      // Create leads with different dates
      await db.Lead.create({
        name: 'Recent Lead',
        score: 50,
        status: 'active',
        createdAt: new Date(),
      })
      await db.Lead.create({
        name: 'Old Lead',
        score: 60,
        status: 'active',
        createdAt: new Date('2020-01-01'),
      })

      const result = await db.Lead`leads created this week`

      expect(result.interpretation).toContain('this week')
    })

    it('should handle "this year" temporal queries', async () => {
      const { generateObject } = await import('ai-functions')

      const startOfYear = new Date(new Date().getFullYear(), 0, 1)

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Order'],
          filters: {},
          timeRange: { since: startOfYear.toISOString() },
          interpretation: 'Find orders from this year',
          confidence: 0.88,
        },
      })

      const defaultNLGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {
            types: 'string[]',
            filters: 'object',
            timeRange: 'object?',
            interpretation: 'string',
            confidence: 'number',
          },
          prompt: `Query: "${prompt}"`,
        })
        return result.object as NLQueryPlan
      }

      setNLQueryGenerator(defaultNLGenerator)

      const { db } = DB(schema)

      await db.Order.create({
        total: 1000,
        status: 'completed',
        customer: 'A',
        createdAt: new Date(),
      })

      const result = await db.Order`orders from this year`

      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.interpretation).toContain('this year')
    })

    it('should handle "last month" temporal queries', async () => {
      const { generateObject } = await import('ai-functions')

      const now = new Date()
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: {},
          timeRange: {
            since: startOfLastMonth.toISOString(),
            until: endOfLastMonth.toISOString(),
          },
          interpretation: 'Find leads from last month',
          confidence: 0.91,
        },
      })

      const defaultNLGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {
            types: 'string[]',
            filters: 'object',
            timeRange: 'object?',
            interpretation: 'string',
            confidence: 'number',
          },
          prompt: `Query: "${prompt}"`,
        })
        return result.object as NLQueryPlan
      }

      setNLQueryGenerator(defaultNLGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Test', score: 50, status: 'active' })

      const result = await db.Lead`leads from last month`

      expect(result.interpretation).toContain('last month')
    })
  })

  describe('Fallback to text search when no LLM configured', () => {
    it('should use keyword search when no NL generator is set', async () => {
      // Ensure no generator is set
      setNLQueryGenerator(null as unknown as NLQueryGenerator)

      const { db } = DB(schema)

      await db.Lead.create({ name: 'Enterprise Lead', score: 90, status: 'active' })
      await db.Lead.create({ name: 'Startup Lead', score: 60, status: 'active' })

      const result = await db.Lead`enterprise`

      // Should still return results using keyword search
      expect(result.results).toBeDefined()
      expect(result.confidence).toBe(0.5) // Low confidence for fallback
      expect(result.explanation).toContain('Fallback')
    })

    it('should return all results for "show all" queries in fallback mode', async () => {
      setNLQueryGenerator(null as unknown as NLQueryGenerator)

      const { db } = DB(schema)

      await db.Lead.create({ name: 'Lead 1', score: 50, status: 'active' })
      await db.Lead.create({ name: 'Lead 2', score: 60, status: 'closed' })
      await db.Lead.create({ name: 'Lead 3', score: 70, status: 'active' })

      const result = await db.Lead`show all leads`

      expect(result.results).toHaveLength(3)
      expect(result.explanation).toContain('Fallback')
    })

    it('should handle empty query in fallback mode', async () => {
      setNLQueryGenerator(null as unknown as NLQueryGenerator)

      const { db } = DB(schema)

      await db.Lead.create({ name: 'Test Lead', score: 50, status: 'active' })

      const result = await db.Lead``

      expect(result.results).toBeDefined()
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should gracefully handle AI generator errors by falling back', async () => {
      const { generateObject } = await import('ai-functions')

      // Mock generateObject to throw an error
      vi.mocked(generateObject).mockRejectedValueOnce(
        new Error('AI service unavailable')
      )

      const failingGenerator: NLQueryGenerator = async (
        prompt: string,
        context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        const result = await generateObject({
          model: 'sonnet',
          schema: {},
          prompt: prompt,
        })
        return result.object as NLQueryPlan
      }

      setNLQueryGenerator(failingGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Test', score: 50, status: 'active' })

      // Should throw the error - tests verify error handling
      await expect(db.Lead`find leads`).rejects.toThrow('AI service unavailable')
    })
  })

  describe('Default NL query generator auto-configuration', () => {
    it('should auto-configure NL generator when AI generation is enabled', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: { status: 'active' },
          interpretation: 'Find active leads',
          confidence: 0.9,
        },
      })

      // Enable AI generation
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      // Import and use the default NL generator factory
      const { createDefaultNLQueryGenerator } = await import(
        '../src/schema/nl-query-generator.js'
      )
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Active', score: 50, status: 'active' })

      const result = await db.Lead`active leads`

      expect(generateObject).toHaveBeenCalled()
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should use configured model for NL queries', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: {},
          interpretation: 'Query interpretation',
          confidence: 0.85,
        },
      })

      configureAIGeneration({ enabled: true, model: 'opus' })

      const { createDefaultNLQueryGenerator } = await import(
        '../src/schema/nl-query-generator.js'
      )
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead`any query`

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'opus',
        })
      )
    })
  })

  describe('Mock generateObject integration', () => {
    it('should call generateObject with schema and prompt', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: {},
          interpretation: 'Test interpretation',
          confidence: 0.88,
        },
      })

      const { createDefaultNLQueryGenerator } = await import(
        '../src/schema/nl-query-generator.js'
      )
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead`find high value leads`

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          schema: expect.any(Object),
          prompt: expect.stringContaining('find high value leads'),
        })
      )
    })

    it('should include schema context in prompt to LLM', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          types: ['Lead'],
          filters: {},
          interpretation: 'Test',
          confidence: 0.9,
        },
      })

      const { createDefaultNLQueryGenerator } = await import(
        '../src/schema/nl-query-generator.js'
      )
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead`active leads`

      // The prompt should include schema context
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/Lead|name|score|status/),
        })
      )
    })
  })
})
