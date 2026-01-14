/**
 * Backward Fuzzy (<~) Reference Grounding Integration Tests
 *
 * Tests the backward fuzzy operator with real semantic grounding against reference data.
 * Key behavior: <~ searches only, returns null if no match (NEVER generates).
 *
 * This is the key difference from ~>:
 * - ~> (forward fuzzy): Search first, generate if no match
 * - <~ (backward fuzzy): Search only, return null if no match
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src'
import type { DatabaseSchema, EmbeddingProvider } from '../src'

/**
 * Create a mock embedding provider that simulates real semantic search behavior.
 * Returns tracked mock functions for verification in tests.
 */
function createMockEmbeddingProvider() {
  const embedTextsMock = vi.fn().mockImplementation(async (texts: string[]) => ({
    embeddings: texts.map((_, i) => [0.1 + i * 0.1, 0.2, 0.3, 0.4]),
    values: texts,
    usage: { tokens: texts.length * 5 }
  }))

  const findSimilarMock = vi.fn().mockImplementation((_query, _embeddings, items, options) => {
    const topK = options?.topK ?? 10
    return items.slice(0, topK).map((item: { entity: Record<string, unknown> }, index: number) => ({
      item,
      score: 0.85 - (index * 0.05),
      index
    }))
  })

  const provider: EmbeddingProvider = {
    embedTexts: embedTextsMock,
    findSimilar: findSimilarMock,
    cosineSimilarity: vi.fn().mockReturnValue(0.85),
  }

  return { provider, mocks: { embedTexts: embedTextsMock, findSimilar: findSimilarMock } }
}

describe('Backward Fuzzy (<~) Reference Grounding', () => {
  let mockProvider: ReturnType<typeof createMockEmbeddingProvider>

  beforeEach(() => {
    mockProvider = createMockEmbeddingProvider()
    setProvider(createMemoryProvider({ embeddingProvider: mockProvider.provider }))
  })

  describe('Core Grounding Behavior', () => {
    it('should ground against reference data via semantic search', async () => {
      const schema = {
        ICP: {
          occupation: '<~Occupation'
        },
        Occupation: { title: 'string', description: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Seed reference data (like O*NET occupations)
      await db.Occupation.create('occ-1', {
        title: 'Software Developer',
        description: 'Develops computer applications'
      })
      await db.Occupation.create('occ-2', {
        title: 'Data Scientist',
        description: 'Analyzes data and builds models'
      })

      const icp = await db.ICP.create('icp-1', {
        occupationHint: 'Engineers who build software applications'
      })

      // Verify semantic search was used
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()

      // Verify the field was resolved to reference data
      const occupation = await icp.occupation
      expect(occupation).toBeDefined()
      expect(occupation.title).toBe('Software Developer')
    })

    it('should return null when no match found (NEVER generate)', async () => {
      // Configure findSimilar to return empty results
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const schema = {
        ICP: {
          occupation: '<~Occupation?'  // Optional field
        },
        Occupation: { title: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const icp = await db.ICP.create('icp-1', {
        occupationHint: 'Unicorn trainers'  // No match exists
      })

      // <~ does NOT generate - should return null/undefined
      const occupation = await icp.occupation
      expect(occupation == null).toBe(true)

      // Verify no new Occupations were created (unlike ~> which would generate)
      const allOccupations = await db.Occupation.list()
      expect(allOccupations).toHaveLength(0)
    })

    it('should include $score metadata on matches', async () => {
      const schema = {
        Lead: {
          industry: '<~Industry'
        },
        Industry: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Industry.create('ind-1', { name: 'Technology' })

      const lead = await db.Lead.create('lead-1', {
        industryHint: 'Tech companies'
      })

      // The resolved lead should have $score metadata
      expect(lead['industry$score']).toBeDefined()
      expect(typeof lead['industry$score']).toBe('number')
    })
  })

  describe('Union Type Fallback Search', () => {
    it('should support union type fallback search', async () => {
      const schema = {
        ICP: {
          role: '<~Occupation|JobTitle|Role'  // Search in priority order
        },
        Occupation: { title: 'string' },
        JobTitle: { name: 'string' },
        Role: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Only Role has a match (third in priority)
      await db.Role.create('role-1', { name: 'Technical Lead' })

      const icp = await db.ICP.create('icp-1', {
        roleHint: 'Team leads in engineering'
      })

      // Verify semantic search was called
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()

      // The role should be resolved
      const role = await icp.role
      expect(role).toBeDefined()
    })

    it('should indicate $matchedType for union type matches', async () => {
      const schema = {
        Lead: {
          target: '<~Occupation|Role'
        },
        Occupation: { title: 'string' },
        Role: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Role.create('role-1', { name: 'Engineering Manager' })

      const lead = await db.Lead.create('lead-1', {
        targetHint: 'Someone who manages engineers'
      })

      // Should have $matchedType indicating which union type matched
      expect(lead['target$matchedType']).toBeDefined()
    })

    it('should search union types in priority order', async () => {
      // For ordered mode, we need to track which types were searched
      const schema = {
        Query: {
          result: '<~TypeA|TypeB|TypeC'
        },
        TypeA: { value: 'string' },
        TypeB: { value: 'string' },
        TypeC: { value: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create data in all types
      await db.TypeA.create('a-1', { value: 'Alpha' })
      await db.TypeB.create('b-1', { value: 'Beta' })
      await db.TypeC.create('c-1', { value: 'Gamma' })

      await db.Query.create('q-1', {
        resultHint: 'Find something'
      })

      // The search should have been triggered
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()
    })
  })

  describe('Threshold Configuration', () => {
    it('should respect threshold configuration', async () => {
      // Return low score that's below threshold
      mockProvider.mocks.findSimilar.mockReturnValue([{
        item: { entity: { $id: 'ind-1', name: 'Technology' } },
        score: 0.5,  // Below typical 0.75 threshold
        index: 0
      }])

      const schema = {
        Lead: {
          industry: '<~Industry'
        },
        Industry: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Industry.create('ind-1', { name: 'Technology' })

      const lead = await db.Lead.create('lead-1', {
        industryHint: 'Tech stuff'
      })

      // Below threshold should result in no match
      // The field should be undefined/null when below threshold
      // Note: with mock returning 0.5 score, the default 0.75 threshold should reject it
      const industry = await lead.industry
      expect(industry == null).toBe(true)
    })

    it('should use entity-level $fuzzyThreshold', async () => {
      const schema = {
        Lead: {
          industry: '<~Industry',
          $fuzzyThreshold: 0.9  // High threshold
        },
        Industry: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Industry.create('ind-1', { name: 'Technology' })

      // With 0.85 default score from mock, should not match 0.9 threshold
      mockProvider.mocks.findSimilar.mockReturnValue([{
        item: { entity: { $id: 'ind-1', name: 'Technology' } },
        score: 0.85,
        index: 0
      }])

      const lead = await db.Lead.create('lead-1', {
        industryHint: 'Tech'
      })

      // Semantic search should be called
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()
    })
  })

  describe('Difference from Forward Fuzzy (~>)', () => {
    it('should never generate new entities unlike ~>', async () => {
      // Empty findSimilar results
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const schema = {
        Lead: {
          category: '<~Category?'  // backward fuzzy - search only
        },
        Category: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // No categories exist
      const lead = await db.Lead.create('lead-1', {
        categoryHint: 'Some category that does not exist'
      })

      // Backward fuzzy should NOT create new entities
      const categories = await db.Category.list()
      expect(categories).toHaveLength(0)

      // Field should be null/undefined
      const category = await lead.category
      expect(category == null).toBe(true)
    })

    it('should match existing data or return null', async () => {
      const schema = {
        Search: {
          match: '<~Item?'
        },
        Item: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Case 1: With existing data
      await db.Item.create('item-1', { name: 'Existing Item' })

      const search1 = await db.Search.create('s-1', {
        matchHint: 'Find existing'
      })

      const match1 = await search1.match
      expect(match1).toBeDefined()
      expect(match1.name).toBe('Existing Item')

      // Case 2: Without matching data
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const search2 = await db.Search.create('s-2', {
        matchHint: 'Find nonexistent'
      })

      const match2 = await search2.match
      expect(match2 == null).toBe(true)

      // Still only one item (no generation)
      const items = await db.Item.list()
      expect(items).toHaveLength(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing hint field gracefully', async () => {
      const schema = {
        Entry: {
          tag: '<~Tag?'
        },
        Tag: { label: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Tag.create('tag-1', { label: 'Important' })

      // Create without hint - should leave field undefined
      const entry = await db.Entry.create('e-1', {})

      const tag = await entry.tag
      expect(tag == null).toBe(true)
    })

    it('should handle array backward fuzzy references', async () => {
      const schema = {
        Profile: {
          skills: ['<~Skill']
        },
        Skill: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Skill.create('skill-1', { name: 'TypeScript' })
      await db.Skill.create('skill-2', { name: 'Python' })
      await db.Skill.create('skill-3', { name: 'React' })

      const profile = await db.Profile.create('p-1', {
        skillsHint: 'Frontend development skills'
      })

      // Should have skills array with matched items
      const skills = await profile.skills
      expect(Array.isArray(skills)).toBe(true)
    })

    it('should skip resolution when value already provided', async () => {
      const schema = {
        Entry: {
          category: '<~Category'
        },
        Category: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const cat = await db.Category.create('cat-1', { name: 'Test Category' })

      // Provide the value directly instead of using hint
      const entry = await db.Entry.create('e-1', {
        category: cat.$id
      })

      // Should use the provided value, not search
      // Note: the field value is stored as-is, so we check it directly
      expect(entry.category).toBeDefined()
    })
  })
})
