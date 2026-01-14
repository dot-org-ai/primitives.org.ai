/**
 * Tests for Forward Fuzzy (~>) Operator with Real Semantic Search
 *
 * This test file verifies the integration between ai-database's forward fuzzy
 * operator and the EmbeddingProvider interface for real embedding-based
 * semantic search.
 *
 * The ~> operator should:
 * 1. Search existing entities using semantic similarity via EmbeddingProvider
 * 2. Use ${fieldName}Hint to get the search query
 * 3. Return match if above threshold (reuse existing entity)
 * 4. Generate new entity via generateObject if no match found
 * 5. Set $generated flag on new entities
 * 6. Set $score metadata on matched entities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema, EmbeddingProvider } from '../src/index.js'

/**
 * Create a mock embedding provider that simulates ai-functions behavior.
 * Returns tracked mock functions for verification in tests.
 */
function createMockEmbeddingProvider() {
  const embedTextsMock = vi.fn().mockImplementation(async (texts: string[]) => ({
    embeddings: texts.map((_, i) => [0.1 * i, 0.2, 0.3, 0.4]),
    values: texts,
    usage: { tokens: texts.length * 5 }
  }))

  const findSimilarMock = vi.fn().mockImplementation(<T>(
    _queryEmbedding: number[],
    _embeddings: number[][],
    items: T[],
    options?: { topK?: number; minScore?: number }
  ) => {
    // Return first item as best match with high score
    const topK = options?.topK ?? 1
    return items.slice(0, topK).map((item, index) => ({
      item,
      score: 0.85 - (index * 0.05),
      index
    }))
  })

  const cosineSimilarityMock = vi.fn().mockReturnValue(0.85)

  const provider: EmbeddingProvider = {
    embedTexts: embedTextsMock,
    findSimilar: findSimilarMock,
    cosineSimilarity: cosineSimilarityMock,
  }

  return {
    provider,
    mocks: {
      embedTexts: embedTextsMock,
      findSimilar: findSimilarMock,
      cosineSimilarity: cosineSimilarityMock,
    }
  }
}

describe('Forward Fuzzy (~>) with Real Semantic Search', () => {
  let mockProvider: ReturnType<typeof createMockEmbeddingProvider>

  beforeEach(() => {
    mockProvider = createMockEmbeddingProvider()
    setProvider(createMemoryProvider({ embeddingProvider: mockProvider.provider }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('semantic search integration', () => {
    it('should find existing entity via semantic similarity', async () => {
      const schema = {
        Campaign: {
          name: 'string',
          audience: '~>Audience'
        },
        Audience: {
          name: 'string',
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create existing audiences
      const existingAudience = await db.Audience.create('aud-1', {
        name: 'Enterprise',
        description: 'Large corporations with 1000+ employees'
      })
      await db.Audience.create('aud-2', {
        name: 'SMB',
        description: 'Small businesses with under 50 employees'
      })

      // Should match via semantic similarity using hint
      const campaign = await db.Campaign.create('camp-1', {
        name: 'Enterprise Campaign',
        audienceHint: 'Big companies with thousands of employees'
      })

      // Verify semantic search was called (findSimilar or semanticSearch)
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()

      // Verify the audience was matched (await to get the hydrated entity)
      const audience = await campaign.audience
      expect(audience.$id).toBe(existingAudience.$id)
    })

    it('should use embedTexts to embed the hint query', async () => {
      const schema = {
        Product: {
          name: 'string',
          category: '~>Category'
        },
        Category: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create an existing category
      await db.Category.create('cat-1', { name: 'Electronics' })

      // Clear mock to track only the search call
      mockProvider.mocks.embedTexts.mockClear()

      // Create product with hint
      await db.Product.create('prod-1', {
        name: 'Smart TV',
        categoryHint: 'Electronic devices and gadgets'
      })

      // embedTexts should have been called for the query embedding
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalled()
    })
  })

  describe('fallback to generation when no match found', () => {
    it('should generate new entity when findSimilar returns no results', async () => {
      // Configure findSimilar to return no results
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const schema = {
        Product: {
          name: 'string',
          category: '~>Category'
        },
        Category: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const product = await db.Product.create('prod-1', {
        name: 'Underwater Basket',
        categoryHint: 'Underwater basket weaving supplies'
      })

      // Should have a category even though no match was found (it's generated)
      const category = await product.category
      expect(category).toBeDefined()
      expect(category.$generated).toBe(true)
    })

    it('should generate new entity when similarity is below threshold', async () => {
      // Return low similarity score
      mockProvider.mocks.findSimilar.mockImplementation(<T>(
        _queryEmbedding: number[],
        _embeddings: number[][],
        items: T[]
      ) => {
        return items.slice(0, 1).map((item, index) => ({
          item,
          score: 0.5, // Below default 0.75 threshold
          index
        }))
      })

      const schema = {
        Event: {
          name: 'string',
          venue: '~>Venue'
        },
        Venue: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Venue.create('ven-1', { name: 'Conference Center A' })

      const event = await db.Event.create('evt-1', {
        name: 'Tech Summit',
        venueHint: 'Some random place that does not match'
      })

      // Should have a venue (generated, not matched because score is below threshold)
      const venue = await event.venue
      expect(venue).toBeDefined()
      expect(venue.$generated).toBe(true)
    })
  })

  describe('metadata on matched and generated entities', () => {
    it('should set $score metadata on parent when entity is matched', async () => {
      const schema = {
        Campaign: {
          name: 'string',
          audience: '~>Audience'
        },
        Audience: {
          name: 'string',
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const existingAudience = await db.Audience.create('aud-1', {
        name: 'Enterprise',
        description: 'Large corporations'
      })

      const campaign = await db.Campaign.create('camp-1', {
        name: 'B2B Campaign',
        audienceHint: 'Big enterprise customers'
      })

      // When a match is found, the campaign should have score metadata
      expect(campaign['audience$matched']).toBe(true)
      expect(campaign['audience$score']).toBe(0.85)
      expect(campaign['audience$matchedType']).toBe('Audience')

      // The audience should be the matched one
      const audience = await campaign.audience
      expect(audience.$id).toBe(existingAudience.$id)
    })

    it('should set $generated flag when entity is generated', async () => {
      // No matches available
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const schema = {
        Campaign: {
          name: 'string',
          audience: '~>Audience'
        },
        Audience: {
          name: 'string',
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const campaign = await db.Campaign.create('camp-1', {
        name: 'Niche Campaign',
        audienceHint: 'Underwater basket weaving enthusiasts'
      })

      // The generated audience should have $generated flag
      const audience = await campaign.audience
      expect(audience.$generated).toBe(true)
      expect(audience.$generatedBy).toBe(campaign.$id)
      expect(audience.$sourceField).toBe('audience')
    })
  })

  describe('hint field extraction', () => {
    it('should use ${fieldName}Hint as search query', async () => {
      const schema = {
        Article: {
          title: 'string',
          author: '~>Author'
        },
        Author: { name: 'string', bio: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const existingAuthor = await db.Author.create('auth-1', {
        name: 'Jane Doe',
        bio: 'Technology writer and journalist'
      })

      mockProvider.mocks.embedTexts.mockClear()

      const article = await db.Article.create('art-1', {
        title: 'AI Trends 2024',
        authorHint: 'Tech journalist with AI expertise'
      })

      // The hint should be used as the search query
      expect(mockProvider.mocks.embedTexts).toHaveBeenCalled()

      // Should have matched the existing author
      const author = await article.author
      expect(author.$id).toBe(existingAuthor.$id)
    })

    it('should fallback to field prompt when no hint provided', async () => {
      const schema = {
        Story: {
          title: 'string',
          protagonist: 'Main character ~>Character'
        },
        Character: { name: 'string', role: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Character.create('char-1', {
        name: 'Hero One',
        role: 'protagonist'
      })

      // Create without hint - should use field prompt "Main character"
      await db.Story.create('story-1', {
        title: 'Adventure Tale'
      })

      // Search should still be attempted using the field prompt
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()
    })
  })

  describe('threshold configuration', () => {
    it('should respect threshold from field definition', async () => {
      // This test verifies that a score above default threshold results in a match
      mockProvider.mocks.findSimilar.mockImplementation(<T>(
        _queryEmbedding: number[],
        _embeddings: number[][],
        items: T[]
      ) => {
        return items.slice(0, 1).map((item, index) => ({
          item,
          score: 0.80, // Above default 0.75 threshold
          index
        }))
      })

      const schema = {
        // Using default threshold (0.75) - score of 0.80 should match
        Product: {
          name: 'string',
          category: '~>Category'
        },
        Category: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const existingCategory = await db.Category.create('cat-1', { name: 'Electronics' })

      const product = await db.Product.create('prod-1', {
        name: 'Smart Watch',
        categoryHint: 'Electronic wearables'
      })

      // Should match because 0.80 > 0.75 (default threshold)
      const category = await product.category
      expect(category.$id).toBe(existingCategory.$id)
    })

    it('should use entity-level $fuzzyThreshold', async () => {
      // Return a score that would pass default but fail custom threshold
      mockProvider.mocks.findSimilar.mockImplementation(<T>(
        _queryEmbedding: number[],
        _embeddings: number[][],
        items: T[]
      ) => {
        return items.slice(0, 1).map((item, index) => ({
          item,
          score: 0.80, // Above 0.75 but below 0.90
          index
        }))
      })

      const schema = {
        HighPrecisionMatch: {
          $fuzzyThreshold: 0.90, // Very strict threshold
          name: 'string',
          target: '~>Target'
        },
        Target: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Target.create('tgt-1', { name: 'Test Target' })

      // With 0.80 score and 0.90 threshold, should NOT match - generate instead
      const result = await db.HighPrecisionMatch.create('hpm-1', {
        name: 'Strict Match Test',
        targetHint: 'Find a target'
      })

      // Should have generated a new target, not matched existing one
      const target = await result.target
      expect(target.$id).not.toBe('tgt-1')
      expect(target.$generated).toBe(true)
    })
  })

  describe('array forward fuzzy fields', () => {
    it('should find multiple matches for array ~> fields', async () => {
      const schema = {
        Team: {
          name: 'string',
          members: '~>Person[]'
        },
        Person: { name: 'string', role: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Person.create('person-1', { name: 'Alice', role: 'Developer' })
      await db.Person.create('person-2', { name: 'Bob', role: 'Designer' })

      const team = await db.Team.create('team-1', {
        name: 'Product Team',
        membersHint: ['Developer', 'Designer']
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
          location: '~>Venue|VirtualSpace'
        },
        Venue: { name: 'string', address: 'string' },
        VirtualSpace: { name: 'string', platform: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Venue.create('ven-1', { name: 'Convention Center', address: '123 Main St' })
      await db.VirtualSpace.create('vs-1', { name: 'Zoom Room', platform: 'Zoom' })

      const event = await db.Event.create('evt-1', {
        name: 'Hybrid Conference',
        locationHint: 'Virtual meeting space'
      })

      // Should search across both types
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()
    })
  })
})
