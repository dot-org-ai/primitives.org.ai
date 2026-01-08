/**
 * RED Tests for Natural Language Query Execution
 *
 * These tests verify the expected API for natural language queries as documented
 * in the README. The tests should FAIL initially (RED phase of TDD).
 *
 * Features to implement:
 * 1. Tagged template literal syntax: db.Lead`who closed deals this month?`
 * 2. db.ask() method for natural language queries
 * 3. Streaming support for NL results
 * 4. Integration with AI functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DB, setProvider, createMemoryProvider, setNLQueryGenerator } from '../index.js'
import type { NLQueryResult, NLQueryGenerator, NLQueryContext, NLQueryPlan } from '../index.js'

describe('Natural Language Query Execution', () => {
  beforeEach(() => {
    // Use in-memory provider for testing
    setProvider(createMemoryProvider())
  })

  const schema = {
    Lead: {
      name: 'string',
      company: 'string',
      status: 'string',
      closedAt: 'datetime?',
      value: 'number',
    },
    Order: {
      status: 'string',
      total: 'number',
      customer: 'string',
    },
  } as const

  describe('Tagged Template Literal Syntax', () => {
    /**
     * README example:
     * ```ts
     * const results = await db.Lead`who closed deals this month?`
     * ```
     *
     * This should work as a callable template literal on entity types.
     */
    it('supports db.Lead`query` tagged template literal syntax', async () => {
      const { db } = DB(schema)

      // Seed some data
      await db.Lead.create('lead1', {
        name: 'John Doe',
        company: 'Acme Corp',
        status: 'closed',
        closedAt: new Date(),
        value: 50000,
      })

      await db.Lead.create('lead2', {
        name: 'Jane Smith',
        company: 'TechCo',
        status: 'open',
        value: 30000,
      })

      // The tagged template literal should execute a natural language query
      const result = await db.Lead`who closed deals this month?`

      expect(result).toBeDefined()
      expect(result.results).toBeDefined()
      expect(Array.isArray(result.results)).toBe(true)
      expect(result.interpretation).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('supports string interpolation in template literals', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'John Doe',
        company: 'Acme Corp',
        status: 'closed',
        value: 50000,
      })

      const company = 'Acme Corp'
      const result = await db.Lead`find leads from ${company}`

      expect(result).toBeDefined()
      expect(result.results).toBeDefined()
      // Should find leads matching the interpolated company
      expect(result.interpretation).toContain('Acme Corp')
    })

    it('supports template literals on Order type', async () => {
      const { db } = DB(schema)

      await db.Order.create('order1', {
        status: 'processing',
        total: 150,
        customer: 'Customer A',
      })

      // README example: db.Order`what's stuck in processing?`
      const result = await db.Order`what's stuck in processing?`

      expect(result).toBeDefined()
      expect(result.results).toBeDefined()
    })

    it('returns NLQueryResult with expected structure', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Test Lead',
        company: 'Test Co',
        status: 'active',
        value: 10000,
      })

      const result: NLQueryResult = await db.Lead`show all active leads`

      // Verify the result structure matches NLQueryResult interface
      expect(result).toMatchObject({
        interpretation: expect.any(String),
        confidence: expect.any(Number),
        results: expect.any(Array),
      })

      // Optional fields
      if (result.query) {
        expect(typeof result.query).toBe('string')
      }
      if (result.explanation) {
        expect(typeof result.explanation).toBe('string')
      }
    })
  })

  describe('db.ask() Method', () => {
    /**
     * The db.ask() method should accept a natural language string
     * and return results across all entity types.
     */
    it('exists on the db object', () => {
      const { db } = DB(schema)

      expect(db.ask).toBeDefined()
      expect(typeof db.ask).toBe('function')
    })

    it('executes natural language queries with ask() method', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Alice',
        company: 'StartupXYZ',
        status: 'active',
        value: 25000,
      })

      await db.Order.create('order1', {
        status: 'pending',
        total: 500,
        customer: 'Alice',
      })

      // Using the ask method as a tagged template
      const result = await db.ask`find all active leads`

      expect(result).toBeDefined()
      expect(result.results).toBeDefined()
      expect(result.interpretation).toBeDefined()
    })

    it('searches across all entity types', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Bob',
        company: 'Company A',
        status: 'active',
        value: 15000,
      })

      await db.Order.create('order1', {
        status: 'completed',
        total: 200,
        customer: 'Bob',
      })

      const result = await db.ask`what do we know about Bob?`

      expect(result.results).toBeDefined()
      // Should potentially return results from both Lead and Order
      expect(result.interpretation).toBeDefined()
    })
  })

  describe('Streaming Support for NL Results', () => {
    /**
     * Natural language queries should support streaming results,
     * especially useful for long-running queries or real-time updates.
     */
    it('supports streaming option in NL queries', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Test Lead',
        company: 'Test Co',
        status: 'active',
        value: 10000,
      })

      const chunks: string[] = []

      // Streaming NL query with onChunk callback
      const result = await db.Lead`find all leads`

      // The result should include stream metadata or have a stream method
      expect(result).toBeDefined()
    })

    it('provides async iterator for streaming results', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Lead 1',
        company: 'Co 1',
        status: 'active',
        value: 5000,
      })

      await db.Lead.create('lead2', {
        name: 'Lead 2',
        company: 'Co 2',
        status: 'active',
        value: 7500,
      })

      // Stream should be available for processing results one at a time
      const result = await db.Lead`show all leads`

      // If streaming is implemented, result should have stream method or be async iterable
      expect(result.results).toBeDefined()
      expect(result.results.length).toBeGreaterThan(0)
    })

    it('streams interpretation explanation progressively', async () => {
      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'High Value Lead',
        company: 'Enterprise Corp',
        status: 'closed',
        value: 100000,
      })

      // With AI integration, the explanation should be streamable
      const result = await db.Lead`summarize our top deals`

      expect(result.interpretation).toBeDefined()
      // When streaming is implemented, explanation could be progressively built
    })
  })

  describe('AI Function Integration', () => {
    /**
     * NL queries should integrate with ai-functions for:
     * - Query understanding and planning
     * - Result interpretation
     * - Semantic search
     */
    it('uses setNLQueryGenerator for custom AI integration', async () => {
      const mockGenerator: NLQueryGenerator = vi.fn(
        async (prompt: string, context: NLQueryContext): Promise<NLQueryPlan> => ({
          types: ['Lead'],
          filters: { status: 'active' },
          interpretation: `AI understood: ${prompt}`,
          confidence: 0.95,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Active Lead',
        company: 'Test',
        status: 'active',
        value: 10000,
      })

      const result = await db.Lead`find active leads`

      expect(mockGenerator).toHaveBeenCalled()
      expect(result.interpretation).toContain('AI understood')
      expect(result.confidence).toBe(0.95)
    })

    it('provides schema context to AI generator', async () => {
      let capturedContext: NLQueryContext | null = null

      const mockGenerator: NLQueryGenerator = vi.fn(
        async (prompt: string, context: NLQueryContext): Promise<NLQueryPlan> => {
          capturedContext = context
          return {
            types: ['Lead'],
            interpretation: prompt,
            confidence: 0.9,
          }
        }
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead`show leads`

      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.types).toBeDefined()
      expect(capturedContext!.types.length).toBeGreaterThan(0)

      // Should include schema information for Lead type
      const leadType = capturedContext!.types.find((t) => t.name === 'Lead')
      expect(leadType).toBeDefined()
      expect(leadType!.fields).toContain('name')
      expect(leadType!.fields).toContain('status')
    })

    it('includes target type in context when using entity template', async () => {
      let capturedContext: NLQueryContext | null = null

      const mockGenerator: NLQueryGenerator = vi.fn(
        async (prompt: string, context: NLQueryContext): Promise<NLQueryPlan> => {
          capturedContext = context
          return {
            types: [context.targetType || 'Lead'],
            interpretation: prompt,
            confidence: 0.9,
          }
        }
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead`find leads`

      expect(capturedContext!.targetType).toBe('Lead')
    })

    it('falls back to keyword search when no AI generator is set', async () => {
      // Clear any previous generator
      setNLQueryGenerator(null as any)

      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Enterprise Lead',
        company: 'Big Corp',
        status: 'active',
        value: 50000,
      })

      const result = await db.Lead`enterprise`

      // Should still return results using keyword search
      expect(result.results).toBeDefined()
      expect(result.confidence).toBe(0.5) // Low confidence for fallback
      expect(result.explanation).toContain('Fallback')
    })
  })

  describe('Error Handling', () => {
    it('handles empty query gracefully', async () => {
      const { db } = DB(schema)

      const result = await db.Lead``

      expect(result).toBeDefined()
      expect(result.results).toBeDefined()
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('handles queries with no matching results', async () => {
      const { db } = DB(schema)

      // No data seeded
      const result = await db.Lead`find all unicorn companies`

      expect(result).toBeDefined()
      expect(result.results).toEqual([])
    })

    it('handles AI generator errors gracefully', async () => {
      const failingGenerator: NLQueryGenerator = vi.fn(async () => {
        throw new Error('AI service unavailable')
      })

      setNLQueryGenerator(failingGenerator)

      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Test',
        company: 'Test',
        status: 'active',
        value: 1000,
      })

      // Should either throw with clear error or fallback gracefully
      await expect(db.Lead`find leads`).rejects.toThrow('AI service unavailable')
    })

    it('validates query plan from AI generator', async () => {
      const invalidGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> =>
          ({
            // Missing required fields
            types: [],
          }) as NLQueryPlan
      )

      setNLQueryGenerator(invalidGenerator)

      const { db } = DB(schema)

      // Should handle invalid plans gracefully
      const result = await db.Lead`find leads`

      expect(result).toBeDefined()
      // Either returns empty results or falls back
    })
  })

  describe('Query Plan Execution', () => {
    it('executes filter operations from query plan', async () => {
      const mockGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> => ({
          types: ['Lead'],
          filters: { status: 'active' },
          interpretation: 'Find active leads',
          confidence: 0.9,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead.create('active1', {
        name: 'Active Lead',
        company: 'Test',
        status: 'active',
        value: 5000,
      })

      await db.Lead.create('closed1', {
        name: 'Closed Lead',
        company: 'Test',
        status: 'closed',
        value: 10000,
      })

      const result = await db.Lead`show active leads`

      expect(result.results).toHaveLength(1)
      expect(result.results[0]).toMatchObject({ status: 'active' })
    })

    it('executes search operations from query plan', async () => {
      const mockGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> => ({
          types: ['Lead'],
          search: 'enterprise',
          interpretation: 'Search for enterprise leads',
          confidence: 0.85,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Enterprise Client',
        company: 'Enterprise Corp',
        status: 'active',
        value: 100000,
      })

      await db.Lead.create('lead2', {
        name: 'Small Biz',
        company: 'Mom Pop Shop',
        status: 'active',
        value: 1000,
      })

      const result = await db.Lead`find enterprise clients`

      expect(result.results.length).toBeGreaterThan(0)
    })

    it('executes time range operations from query plan', async () => {
      const now = new Date()
      const lastMonth = new Date(now)
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      const mockGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> => ({
          types: ['Lead'],
          timeRange: { since: lastMonth, until: now },
          interpretation: 'Find leads closed this month',
          confidence: 0.9,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead.create('recent', {
        name: 'Recent Lead',
        company: 'Test',
        status: 'closed',
        closedAt: new Date(),
        value: 25000,
      })

      const result = await db.Lead`who closed deals this month?`

      expect(result).toBeDefined()
      expect(result.interpretation).toContain('this month')
    })

    it('includes related entities from query plan', async () => {
      const extendedSchema = {
        Lead: {
          name: 'string',
          company: 'Company.leads',
          status: 'string',
        },
        Company: {
          name: 'string',
        },
      } as const

      const mockGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> => ({
          types: ['Lead'],
          include: ['company'],
          interpretation: 'Find leads with company details',
          confidence: 0.9,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(extendedSchema)

      await db.Company.create('company1', { name: 'Acme Corp' })
      await db.Lead.create('lead1', {
        name: 'John',
        company: 'company1',
        status: 'active',
      })

      const result = await db.Lead`show leads with their companies`

      expect(result).toBeDefined()
      // When include is implemented, related entities should be loaded
    })
  })

  describe('Cross-Type Queries', () => {
    it('queries across multiple types', async () => {
      const mockGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> => ({
          types: ['Lead', 'Order'],
          search: 'pending',
          interpretation: 'Find pending items across all types',
          confidence: 0.8,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Pending Lead',
        company: 'Test',
        status: 'pending',
        value: 5000,
      })

      await db.Order.create('order1', {
        status: 'pending',
        total: 100,
        customer: 'Test Customer',
      })

      const result = await db.ask`what's pending?`

      expect(result.results.length).toBe(2)
    })

    it('aggregates results from multiple types with type info', async () => {
      const mockGenerator: NLQueryGenerator = vi.fn(
        async (): Promise<NLQueryPlan> => ({
          types: ['Lead', 'Order'],
          interpretation: 'Show all records',
          confidence: 0.7,
        })
      )

      setNLQueryGenerator(mockGenerator)

      const { db } = DB(schema)

      await db.Lead.create('lead1', {
        name: 'Test Lead',
        company: 'Test',
        status: 'active',
        value: 1000,
      })

      await db.Order.create('order1', {
        status: 'completed',
        total: 500,
        customer: 'Test',
      })

      const result = await db.ask`show everything`

      // Results should include type information
      for (const item of result.results) {
        expect((item as Record<string, unknown>).$type).toBeDefined()
      }
    })
  })
})
