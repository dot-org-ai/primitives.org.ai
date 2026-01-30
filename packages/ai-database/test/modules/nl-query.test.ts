/**
 * Interface Tests for NL Query Module
 *
 * RED PHASE: These tests define the expected public API for the nl-query
 * module that will be extracted from schema/index.ts.
 *
 * Tests import from a module that doesn't exist yet:
 * - src/schema/nl-query.ts
 *
 * Expected exports:
 * - buildNLQueryContext(schema, targetType?) -> NLQueryContext
 * - executeNLQuery<T>(question, schema, targetType?) -> Promise<NLQueryResult<T>>
 * - createNLQueryFn<T>(schema, typeName?) -> NLQueryFn<T>
 * - setNLQueryGenerator(generator) -> void
 * - getNLQueryGenerator() -> NLQueryGenerator | null
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Import from the module that will be created (doesn't exist yet)
// This import will cause the tests to fail until the module is extracted
import {
  buildNLQueryContext,
  executeNLQuery,
  createNLQueryFn,
  setNLQueryGenerator,
  getNLQueryGenerator,
} from '../../src/schema/nl-query.js'

import { parseSchema, setProvider, createMemoryProvider } from '../../src/index.js'
import type {
  NLQueryContext,
  NLQueryResult,
  NLQueryFn,
  NLQueryPlan,
  NLQueryGenerator,
} from '../../src/schema/types.js'

// NL Query Module Interface tests - implementation complete
describe('NL Query Module Interface', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    // Reset generator after each test
    setNLQueryGenerator(null as unknown as NLQueryGenerator)
  })

  describe('buildNLQueryContext function', () => {
    it('should export buildNLQueryContext function', () => {
      expect(buildNLQueryContext).toBeDefined()
      expect(typeof buildNLQueryContext).toBe('function')
    })

    it('should build context from schema', () => {
      const schema = parseSchema({
        Lead: {
          name: 'string',
          email: 'string',
          score: 'number',
          company: '->Company',
        },
        Company: {
          name: 'string',
          industry: 'string',
        },
      })

      const context = buildNLQueryContext(schema)

      expect(context).toBeDefined()
      expect(context.types).toBeDefined()
      expect(Array.isArray(context.types)).toBe(true)
      expect(context.types.length).toBe(2)
    })

    it('should include type metadata in context', () => {
      const schema = parseSchema({
        Product: {
          name: 'string',
          price: 'number',
          description: 'string',
        },
      })

      const context = buildNLQueryContext(schema)
      const productType = context.types.find((t) => t.name === 'Product')

      expect(productType).toBeDefined()
      expect(productType!.name).toBe('Product')
      expect(productType!.singular).toBeDefined()
      expect(productType!.plural).toBeDefined()
      expect(productType!.fields).toContain('name')
      expect(productType!.fields).toContain('price')
      expect(productType!.fields).toContain('description')
    })

    it('should include relationship metadata in context', () => {
      const schema = parseSchema({
        Order: {
          total: 'number',
          customer: '->Customer',
          items: ['->Product'],
        },
        Customer: { name: 'string' },
        Product: { name: 'string' },
      })

      const context = buildNLQueryContext(schema)
      const orderType = context.types.find((t) => t.name === 'Order')

      expect(orderType).toBeDefined()
      expect(orderType!.relationships).toBeDefined()
      expect(orderType!.relationships.length).toBeGreaterThan(0)

      const customerRel = orderType!.relationships.find((r) => r.name === 'customer')
      expect(customerRel).toBeDefined()
      expect(customerRel!.to).toBe('Customer')
      expect(customerRel!.cardinality).toBe('one')

      const itemsRel = orderType!.relationships.find((r) => r.name === 'items')
      expect(itemsRel).toBeDefined()
      expect(itemsRel!.to).toBe('Product')
      expect(itemsRel!.cardinality).toBe('many')
    })

    it('should accept optional targetType parameter', () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
        Company: { name: 'string' },
      })

      const context = buildNLQueryContext(schema, 'Lead')

      expect(context.targetType).toBe('Lead')
    })

    it('should omit targetType when not provided', () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
      })

      const context = buildNLQueryContext(schema)

      expect(context.targetType).toBeUndefined()
    })
  })

  describe('executeNLQuery function', () => {
    it('should export executeNLQuery function', () => {
      expect(executeNLQuery).toBeDefined()
      expect(typeof executeNLQuery).toBe('function')
    })

    it('should return NLQueryResult with interpretation and confidence', async () => {
      const schema = parseSchema({
        Lead: {
          name: 'string',
          email: 'string',
          score: 'number',
        },
      })

      const result = await executeNLQuery<{ $id: string; name: string }>('show all leads', schema)

      expect(result).toBeDefined()
      expect(result.interpretation).toBeDefined()
      expect(typeof result.interpretation).toBe('string')
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should return results array', async () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Lead', 'lead-1', { name: 'John' })
      await provider.create('Lead', 'lead-2', { name: 'Jane' })

      const result = await executeNLQuery<{ $id: string; name: string }>(
        'list all leads',
        schema,
        'Lead'
      )

      expect(result.results).toBeDefined()
      expect(Array.isArray(result.results)).toBe(true)
      expect(result.results.length).toBe(2)
    })

    it('should use targetType when provided', async () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
        Company: { name: 'string' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Lead', 'lead-1', { name: 'John' })
      await provider.create('Company', 'company-1', { name: 'Acme' })

      const result = await executeNLQuery<{ $id: string; name: string }>('show all', schema, 'Lead')

      // Should only return Leads, not Companies
      expect(result.results.every((r) => r.$id.startsWith('lead'))).toBe(true)
    })

    it('should include query string for debugging', async () => {
      const schema = parseSchema({
        Lead: { name: 'string', score: 'number' },
      })

      const result = await executeNLQuery('find leads with score above 80', schema)

      // Query may be included for debugging purposes
      if (result.query) {
        expect(typeof result.query).toBe('string')
      }
    })

    it('should include explanation when available', async () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
      })

      const result = await executeNLQuery('show all leads', schema)

      // Explanation may be included
      if (result.explanation) {
        expect(typeof result.explanation).toBe('string')
      }
    })
  })

  describe('createNLQueryFn function', () => {
    it('should export createNLQueryFn function', () => {
      expect(createNLQueryFn).toBeDefined()
      expect(typeof createNLQueryFn).toBe('function')
    })

    it('should return a tagged template function', () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
      })

      const queryFn = createNLQueryFn(schema)

      expect(queryFn).toBeDefined()
      expect(typeof queryFn).toBe('function')
    })

    it('should work as tagged template literal', async () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
      })

      const queryFn = createNLQueryFn<{ $id: string; name: string }>(schema)
      const result = await queryFn`show all leads`

      expect(result).toBeDefined()
      expect(result.interpretation).toBeDefined()
      expect(result.results).toBeDefined()
    })

    it('should support interpolated values', async () => {
      const schema = parseSchema({
        Lead: { name: 'string', score: 'number' },
      })

      const queryFn = createNLQueryFn(schema)
      const minScore = 70

      const result = await queryFn`find leads with score above ${minScore}`

      expect(result).toBeDefined()
      expect(result.interpretation).toContain('70')
    })

    it('should accept optional typeName for type-scoped queries', () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
        Company: { name: 'string' },
      })

      // Global query function (searches all types)
      const globalQueryFn = createNLQueryFn(schema)
      expect(globalQueryFn).toBeDefined()

      // Type-scoped query function (searches only Lead)
      const leadQueryFn = createNLQueryFn(schema, 'Lead')
      expect(leadQueryFn).toBeDefined()
    })

    it('should scope results to typeName when provided', async () => {
      const schema = parseSchema({
        Lead: { name: 'string' },
        Company: { name: 'string' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Lead', 'lead-1', { name: 'John' })
      await provider.create('Company', 'company-1', { name: 'Acme' })

      const leadQueryFn = createNLQueryFn<{ $id: string; $type: string }>(schema, 'Lead')
      const result = await leadQueryFn`show all`

      // Should only return Leads
      expect(result.results.every((r) => r.$type === 'Lead')).toBe(true)
    })
  })

  describe('setNLQueryGenerator function', () => {
    it('should export setNLQueryGenerator function', () => {
      expect(setNLQueryGenerator).toBeDefined()
      expect(typeof setNLQueryGenerator).toBe('function')
    })

    it('should accept an NLQueryGenerator function', () => {
      const mockGenerator: NLQueryGenerator = async (query, context) => {
        return {
          types: context.targetType ? [context.targetType] : context.types.map((t) => t.name),
          interpretation: `Mock interpretation for: ${query}`,
          confidence: 0.9,
        }
      }

      // Should not throw
      expect(() => setNLQueryGenerator(mockGenerator)).not.toThrow()
    })

    it('should use the configured generator for queries', async () => {
      const schema = parseSchema({
        Lead: { name: 'string', status: 'string' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Lead', 'lead-1', { name: 'Active Lead', status: 'active' })
      await provider.create('Lead', 'lead-2', { name: 'Inactive Lead', status: 'inactive' })

      // Configure a custom generator that filters by status
      const customGenerator: NLQueryGenerator = async (query, context) => {
        return {
          types: ['Lead'],
          filters: { status: 'active' },
          interpretation: 'Finding active leads',
          confidence: 0.95,
        }
      }

      setNLQueryGenerator(customGenerator)

      const result = await executeNLQuery('show active leads', schema)

      expect(result.confidence).toBe(0.95)
      expect(result.interpretation).toBe('Finding active leads')
      // Should filter to only active leads
      expect(result.results.length).toBe(1)
    })
  })

  describe('getNLQueryGenerator function', () => {
    it('should export getNLQueryGenerator function', () => {
      expect(getNLQueryGenerator).toBeDefined()
      expect(typeof getNLQueryGenerator).toBe('function')
    })

    it('should return null when no generator is set', () => {
      const generator = getNLQueryGenerator()
      expect(generator).toBeNull()
    })

    it('should return the configured generator', () => {
      const mockGenerator: NLQueryGenerator = async () => ({
        types: [],
        interpretation: 'test',
        confidence: 1,
      })

      setNLQueryGenerator(mockGenerator)

      const generator = getNLQueryGenerator()
      expect(generator).toBe(mockGenerator)
    })
  })

  describe('NLQueryContext interface validation', () => {
    it('should produce valid NLQueryContext structure', () => {
      const schema = parseSchema({
        Article: {
          title: 'string',
          content: 'string',
          author: '->Author',
          tags: ['->Tag'],
        },
        Author: {
          name: 'string',
          bio: 'string',
        },
        Tag: {
          name: 'string',
        },
      })

      const context: NLQueryContext = buildNLQueryContext(schema)

      // Validate structure matches NLQueryContext interface
      expect(context.types).toBeDefined()
      expect(Array.isArray(context.types)).toBe(true)

      for (const type of context.types) {
        expect(typeof type.name).toBe('string')
        expect(typeof type.singular).toBe('string')
        expect(typeof type.plural).toBe('string')
        expect(Array.isArray(type.fields)).toBe(true)
        expect(Array.isArray(type.relationships)).toBe(true)

        for (const rel of type.relationships) {
          expect(typeof rel.name).toBe('string')
          expect(typeof rel.to).toBe('string')
          expect(typeof rel.cardinality).toBe('string')
        }
      }
    })
  })

  describe('NLQueryResult interface validation', () => {
    it('should produce valid NLQueryResult structure', async () => {
      const schema = parseSchema({
        Product: {
          name: 'string',
          price: 'number',
        },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Product', 'prod-1', { name: 'Widget', price: 99 })

      const result: NLQueryResult<{ $id: string; name: string; price: number }> =
        await executeNLQuery('find products', schema)

      // Required fields
      expect(typeof result.interpretation).toBe('string')
      expect(typeof result.confidence).toBe('number')
      expect(Array.isArray(result.results)).toBe(true)

      // Optional fields
      if (result.query !== undefined) {
        expect(typeof result.query).toBe('string')
      }
      if (result.explanation !== undefined) {
        expect(typeof result.explanation).toBe('string')
      }
    })
  })

  describe('NLQueryPlan usage with generators', () => {
    it('should allow generators to return filter conditions', async () => {
      const schema = parseSchema({
        Lead: { name: 'string', score: 'number' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Lead', 'lead-1', { name: 'High', score: 90 })
      await provider.create('Lead', 'lead-2', { name: 'Low', score: 40 })

      const filteringGenerator: NLQueryGenerator = async () => ({
        types: ['Lead'],
        filters: { score: { $gt: 70 } },
        interpretation: 'Finding high-scoring leads',
        confidence: 0.9,
      })

      setNLQueryGenerator(filteringGenerator)

      const result = await executeNLQuery('high scoring leads', schema)
      expect(result.results.length).toBe(1)
    })

    it('should allow generators to return search terms', async () => {
      const schema = parseSchema({
        Article: { title: 'string', content: 'string' },
      })

      const searchGenerator: NLQueryGenerator = async () => ({
        types: ['Article'],
        search: 'machine learning',
        interpretation: 'Searching for machine learning articles',
        confidence: 0.85,
      })

      setNLQueryGenerator(searchGenerator)

      const result = await executeNLQuery('articles about ML', schema)
      expect(result.interpretation).toContain('machine learning')
    })

    it('should allow generators to return time ranges', async () => {
      const schema = parseSchema({
        Event: { name: 'string', date: 'datetime' },
      })

      const timeRangeGenerator: NLQueryGenerator = async () => ({
        types: ['Event'],
        timeRange: {
          since: new Date('2024-01-01'),
          until: new Date('2024-12-31'),
        },
        interpretation: 'Finding events in 2024',
        confidence: 0.95,
      })

      setNLQueryGenerator(timeRangeGenerator)

      const result = await executeNLQuery('events this year', schema)
      expect(result.interpretation).toContain('2024')
    })

    it('should allow generators to include related entities', async () => {
      const schema = parseSchema({
        Order: {
          total: 'number',
          customer: '->Customer',
        },
        Customer: { name: 'string' },
      })

      const includeGenerator: NLQueryGenerator = async () => ({
        types: ['Order'],
        include: ['customer'],
        interpretation: 'Finding orders with customer details',
        confidence: 0.88,
      })

      setNLQueryGenerator(includeGenerator)

      const result = await executeNLQuery('orders with customer info', schema)
      expect(result.interpretation).toContain('customer')
    })
  })

  describe('Fallback behavior without generator', () => {
    it('should use keyword search as fallback', async () => {
      const schema = parseSchema({
        Lead: { name: 'string', email: 'string' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Lead', 'lead-1', { name: 'John Doe', email: 'john@example.com' })

      // No generator set - should fall back to keyword search
      const result = await executeNLQuery('john', schema, 'Lead')

      expect(result.confidence).toBeLessThan(1) // Fallback has lower confidence
      expect(result.explanation).toContain('Fallback')
    })

    it('should handle list all queries in fallback mode', async () => {
      const schema = parseSchema({
        Product: { name: 'string' },
      })

      const provider = createMemoryProvider()
      setProvider(provider)
      await provider.create('Product', 'prod-1', { name: 'Widget' })
      await provider.create('Product', 'prod-2', { name: 'Gadget' })

      const result = await executeNLQuery('show all products', schema, 'Product')

      expect(result.results.length).toBe(2)
    })
  })
})
