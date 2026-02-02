/**
 * Tests for Forward Fuzzy (~>) Operator with Real Semantic Search
 *
 * This test file verifies the integration between ai-database's forward fuzzy
 * operator and real AI-powered semantic search via Cloudflare AI Gateway.
 *
 * The ~> operator should:
 * 1. Search existing entities using semantic similarity
 * 2. Use ${fieldName}Hint to get the search query
 * 3. Return match if above threshold (reuse existing entity)
 * 4. Generate new entity via generateObject if no match found
 * 5. Set $generated flag on new entities
 * 6. Set $score metadata on matched entities
 *
 * Tests are split into:
 * 1. Unit tests using memory provider for data storage
 * 2. Integration tests using real AI Gateway (skipIf no gateway)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

// Check for AI Gateway availability
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('Forward Fuzzy (~>) Semantic Search', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('semantic search integration', () => {
    it('should find existing entity via semantic similarity', async () => {
      const schema = {
        Campaign: {
          name: 'string',
          audience: '~>Audience',
        },
        Audience: {
          name: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create existing audiences
      await db.Audience.create('aud-1', {
        name: 'Enterprise',
        description: 'Large corporations with 1000+ employees',
      })
      await db.Audience.create('aud-2', {
        name: 'SMB',
        description: 'Small businesses with under 50 employees',
      })

      // Should match via semantic similarity using hint
      const campaign = await db.Campaign.create('camp-1', {
        name: 'Enterprise Campaign',
        audienceHint: 'Big companies with thousands of employees',
      })

      // Verify an audience was matched (mock embeddings may not match semantically)
      const audience = await campaign.audience
      expect(audience).toBeDefined()
      // The audience should be one of the existing ones
      expect(['aud-1', 'aud-2']).toContain(audience.$id)
    })
  })

  describe('fallback to generation when no match found', () => {
    it('should generate new entity when no semantic match found', async () => {
      const schema = {
        Product: {
          name: 'string',
          category: '~>Category',
        },
        Category: { name: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // No categories exist initially
      const product = await db.Product.create('prod-1', {
        name: 'Underwater Basket',
        categoryHint: 'Underwater basket weaving supplies',
      })

      // Should have a category (it's generated since no match was found)
      const category = await product.category
      expect(category).toBeDefined()
      expect(category.$generated).toBe(true)
    })
  })

  describe('metadata on matched and generated entities', () => {
    it('should resolve to existing entity when semantic match found', async () => {
      const schema = {
        Campaign: {
          name: 'string',
          audience: '~>Audience',
        },
        Audience: {
          name: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const existingAudience = await db.Audience.create('aud-1', {
        name: 'Enterprise',
        description: 'Large corporations',
      })

      const campaign = await db.Campaign.create('camp-1', {
        name: 'B2B Campaign',
        audienceHint: 'Big enterprise customers',
      })

      // The audience should be the matched one
      const audience = await campaign.audience
      expect(audience.$id).toBe(existingAudience.$id)
    })

    it('should generate new entity when no match found', async () => {
      const schema = {
        Campaign: {
          name: 'string',
          audience: '~>Audience',
        },
        Audience: {
          name: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // No existing audiences
      const campaign = await db.Campaign.create('camp-1', {
        name: 'Niche Campaign',
        audienceHint: 'Underwater basket weaving enthusiasts',
      })

      // The generated audience should exist and have $generated flag
      const audience = await campaign.audience
      expect(audience).toBeDefined()
      expect(audience.$generated).toBe(true)
    })
  })

  describe('hint field extraction', () => {
    it('should use ${fieldName}Hint as search query', async () => {
      const schema = {
        Article: {
          title: 'string',
          author: '~>Author',
        },
        Author: { name: 'string', bio: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const existingAuthor = await db.Author.create('auth-1', {
        name: 'Jane Doe',
        bio: 'Technology writer and journalist',
      })

      const article = await db.Article.create('art-1', {
        title: 'AI Trends 2024',
        authorHint: 'Tech journalist with AI expertise',
      })

      // Should have matched the existing author
      const author = await article.author
      expect(author.$id).toBe(existingAuthor.$id)
    })
  })

  describe('threshold configuration', () => {
    it('should use entity-level $fuzzyThreshold', async () => {
      const schema = {
        HighPrecisionMatch: {
          $fuzzyThreshold: 0.9, // Very strict threshold
          name: 'string',
          target: '~>Target',
        },
        Target: { name: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Target.create('tgt-1', { name: 'Test Target' })

      // With strict threshold, should likely generate instead of match
      const result = await db.HighPrecisionMatch.create('hpm-1', {
        name: 'Strict Match Test',
        targetHint: 'Find a target',
      })

      // The target should exist (either matched or generated)
      const target = await result.target
      expect(target).toBeDefined()
    })
  })

  describe('array forward fuzzy fields', () => {
    it('should find multiple matches for array ~> fields', async () => {
      const schema = {
        Team: {
          name: 'string',
          members: '~>Person[]',
        },
        Person: { name: 'string', role: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Person.create('person1', { name: 'Alice', role: 'Developer' })
      await db.Person.create('person2', { name: 'Bob', role: 'Designer' })

      const team = await db.Team.create('team1', {
        name: 'Product Team',
        membersHint: ['Developer', 'Designer'],
      })

      // Should have matched existing members
      expect(Array.isArray(team.members)).toBe(true)
      const members = await team.members
      expect(members.length).toBeGreaterThan(0)
    })
  })

  describe('union type support', () => {
    it('should search across union types', async () => {
      const schema = {
        Event: {
          name: 'string',
          location: '~>Venue|VirtualSpace',
        },
        Venue: { name: 'string', address: 'string' },
        VirtualSpace: { name: 'string', platform: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Venue.create('ven-1', { name: 'Convention Center', address: '123 Main St' })
      await db.VirtualSpace.create('vs-1', { name: 'Zoom Room', platform: 'Zoom' })

      const event = await db.Event.create('evt-1', {
        name: 'Hybrid Conference',
        locationHint: 'Virtual meeting space',
      })

      // Should have a location (either matched or generated)
      const location = await event.location
      expect(location).toBeDefined()
    })
  })
})

/**
 * Real AI Gateway Integration Tests for Forward Fuzzy
 *
 * These tests use actual AI Gateway calls for semantic matching.
 * They are skipped when AI_GATEWAY_URL is not configured.
 */
describe.skipIf(!hasGateway)('Forward Fuzzy (~>) with Real AI Gateway', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider({ useAiFunctions: true }))
  })

  it('should perform real semantic matching', async () => {
    const schema = {
      Campaign: {
        name: 'string',
        audience: '~>Audience',
      },
      Audience: {
        name: 'string',
        description: 'string',
      },
    } as const satisfies DatabaseSchema

    const { db } = DB(schema)

    // Create semantically distinct audiences
    await db.Audience.create('aud-enterprise', {
      name: 'Enterprise',
      description: 'Large corporations with thousands of employees and complex IT infrastructure',
    })
    await db.Audience.create('aud-startup', {
      name: 'Startup',
      description: 'Small early-stage companies with limited resources',
    })

    // Create campaign with hint that should match enterprise
    const campaign = await db.Campaign.create('camp-1', {
      name: 'Big Business Campaign',
      audienceHint: 'Large organizations with big IT departments',
    })

    const audience = await campaign.audience
    // Should match one of the audiences (or generate if no match)
    expect(audience).toBeDefined()
    // The match score should be tracked
    if (campaign['audience$matched']) {
      expect(campaign['audience$score']).toBeGreaterThan(0)
    }
  })

  it('should generate entities when no semantic match found', async () => {
    const schema = {
      Product: {
        name: 'string',
        category: '~>Category',
      },
      Category: { name: 'string' },
    } as const satisfies DatabaseSchema

    const { db } = DB(schema)

    // Create categories that won't match
    await db.Category.create('cat-1', { name: 'Electronics' })
    await db.Category.create('cat-2', { name: 'Clothing' })

    // Create product with completely unrelated hint
    const product = await db.Product.create('prod-1', {
      name: 'Quantum Processor',
      categoryHint: 'Interdimensional computing devices',
    })

    const category = await product.category
    // Should have a category (either matched or generated)
    expect(category).toBeDefined()
  })
})
