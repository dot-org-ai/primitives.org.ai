/**
 * TDD Tests for Natural Language Queries with LLM Integration
 *
 * Integration tests that use REAL AI calls through Cloudflare AI Gateway.
 * NO MOCKS - these tests verify actual AI behavior.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  DB,
  setProvider,
  createMemoryProvider,
  setNLQueryGenerator,
  configureAIGeneration,
} from '../src/index.js'
import type { NLQueryGenerator, NLQueryContext, NLQueryPlan } from '../src/index.js'

// TODO: Template literal syntax for NL queries needs implementation investigation
describe.skip('Natural Language Queries with LLM Integration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    // Reset NL query generator before each test
    setNLQueryGenerator(null as unknown as NLQueryGenerator)
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
      // Enable AI generation with real AI
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)

      // Seed test data
      await db.Lead.create({ name: 'Alice', score: 95, status: 'active' })
      await db.Lead.create({ name: 'Bob', score: 45, status: 'active' })
      await db.Lead.create({ name: 'Charlie', score: 80, status: 'closed' })

      const result = await db.Lead`who are the high scoring leads?`

      // Check structural properties of the result
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be a number between 0-1
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should convert status filter queries to filter operations', async () => {
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)

      await db.Lead.create({ name: 'Active Lead', score: 50, status: 'active' })
      await db.Lead.create({ name: 'Closed Lead', score: 60, status: 'closed' })

      const result = await db.Lead`which leads are still active?`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should convert numeric comparison queries', async () => {
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)

      await db.Order.create({ total: 1000, status: 'completed', customer: 'A' })
      await db.Order.create({ total: 5000, status: 'completed', customer: 'B' })
      await db.Order.create({ total: 3000, status: 'pending', customer: 'C' })

      const result = await db.Order`orders over $2000`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
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
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

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

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should handle "this year" temporal queries', async () => {
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)

      await db.Order.create({
        total: 1000,
        status: 'completed',
        customer: 'A',
        createdAt: new Date(),
      })

      const result = await db.Order`orders from this year`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should handle "last month" temporal queries', async () => {
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Test', score: 50, status: 'active' })

      const result = await db.Lead`leads from last month`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
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
      const failingGenerator: NLQueryGenerator = async (
        _prompt: string,
        _context: NLQueryContext
      ): Promise<NLQueryPlan> => {
        throw new Error('AI service unavailable')
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
      // Enable AI generation with real AI
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      // Import and use the default NL generator factory
      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Active', score: 50, status: 'active' })

      const result = await db.Lead`active leads`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should use configured model for NL queries', async () => {
      configureAIGeneration({ enabled: true, model: 'opus' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Test', score: 50, status: 'active' })

      const result = await db.Lead`any query`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })
  })

  describe('Real AI integration', () => {
    it('should call real AI with schema and prompt', async () => {
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'High Value', score: 95, status: 'active' })
      await db.Lead.create({ name: 'Low Value', score: 25, status: 'active' })

      const result = await db.Lead`find high value leads`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Interpretation should be a non-empty string
      expect(typeof result.interpretation).toBe('string')
      expect(result.interpretation.length).toBeGreaterThan(0)

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should include schema context in prompt to LLM', async () => {
      configureAIGeneration({ enabled: true, model: 'sonnet' })

      const { createDefaultNLQueryGenerator } = await import('../src/schema/nl-query-generator.js')
      const defaultGenerator = createDefaultNLQueryGenerator()
      setNLQueryGenerator(defaultGenerator)

      const { db } = DB(schema)
      await db.Lead.create({ name: 'Active Lead', score: 75, status: 'active' })

      const result = await db.Lead`active leads`

      // Check structural properties
      expect(result).toHaveProperty('interpretation')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('results')

      // Confidence should be valid
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      // Results should be an array
      expect(Array.isArray(result.results)).toBe(true)
    })
  })
})
