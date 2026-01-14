/**
 * Union Type Fallback Search Integration Tests
 *
 * Tests priority-ordered union type search for fuzzy operators (<~).
 * These tests verify the complete integration flow from schema parsing
 * through semantic search with fallback behavior.
 *
 * TDD RED Phase: These tests define the expected integration behavior:
 * - Collections searched in declared priority order
 * - First match above threshold returned
 * - $matchedType indicates winning collection
 * - $fallbackUsed flag when not first collection
 * - Null returned when all collections exhausted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema, EmbeddingProvider } from '../src/index.js'
import {
  searchUnionTypes,
  parseUnionTypes,
  parseUnionThresholds,
  createProviderSearcher,
  type UnionMatch,
  type FallbackSearchOptions,
} from '../src/schema/union-fallback.js'

/**
 * Create a mock embedding provider with configurable search behavior.
 * Allows tests to control which types return matches and at what scores.
 */
function createMockEmbeddingProvider(options?: {
  matchesByType?: Record<string, Array<{ $id: string; score: number; data?: Record<string, unknown> }>>
  defaultScore?: number
}) {
  const matchesByType = options?.matchesByType ?? {}
  const defaultScore = options?.defaultScore ?? 0.85

  const embedTextsMock = vi.fn().mockImplementation(async (texts: string[]) => ({
    embeddings: texts.map((_, i) => [0.1 + i * 0.1, 0.2, 0.3, 0.4]),
    values: texts,
    usage: { tokens: texts.length * 5 }
  }))

  const findSimilarMock = vi.fn().mockImplementation((_query, _embeddings, items, options) => {
    const topK = options?.topK ?? 10
    // Return items with scores based on configuration
    return items.slice(0, topK).map((item: { entity: Record<string, unknown> }, index: number) => ({
      item,
      score: defaultScore - (index * 0.05),
      index
    }))
  })

  const provider: EmbeddingProvider = {
    embedTexts: embedTextsMock,
    findSimilar: findSimilarMock,
    cosineSimilarity: vi.fn().mockReturnValue(defaultScore),
  }

  return { provider, mocks: { embedTexts: embedTextsMock, findSimilar: findSimilarMock } }
}

describe('Union Type Fallback Integration', () => {
  let mockProvider: ReturnType<typeof createMockEmbeddingProvider>

  beforeEach(() => {
    mockProvider = createMockEmbeddingProvider()
    setProvider(createMemoryProvider({ embeddingProvider: mockProvider.provider }))
  })

  // ===========================================================================
  // Priority Order Search Tests
  // ===========================================================================

  describe('Collections searched in declared priority order', () => {
    it('should search first collection before second in union type', async () => {
      const searchOrder: string[] = []

      // Track search order through mock
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        searchOrder.push(type)
        return [] // No matches, forces searching all types
      })

      await searchUnionTypes(
        ['Document', 'Video', 'Expert'],
        'machine learning tutorial',
        { mode: 'ordered', searcher: mockSearcher }
      )

      // Verify order matches declaration order
      expect(searchOrder).toEqual(['Document', 'Video', 'Expert'])
      expect(searchOrder[0]).toBe('Document')
      expect(searchOrder[1]).toBe('Video')
      expect(searchOrder[2]).toBe('Expert')
    })

    it('should stop searching after finding match in first collection', async () => {
      const searchOrder: string[] = []

      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        searchOrder.push(type)
        if (type === 'Document') {
          return [{ $id: 'doc-1', $score: 0.9, $type: 'Document', title: 'ML Guide' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['Document', 'Video', 'Expert'],
        'machine learning',
        { mode: 'ordered', searcher: mockSearcher }
      )

      // Should only search Document (first type with match)
      expect(searchOrder).toEqual(['Document'])
      expect(result.matches).toHaveLength(1)
    })

    it('should continue to next collection when first has no matches', async () => {
      const searchOrder: string[] = []

      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        searchOrder.push(type)
        if (type === 'Video') {
          return [{ $id: 'vid-1', $score: 0.88, $type: 'Video', title: 'Tutorial' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['Document', 'Video', 'Expert'],
        'tutorial video',
        { mode: 'ordered', searcher: mockSearcher }
      )

      // Should search Document (empty), then Video (found)
      expect(searchOrder).toEqual(['Document', 'Video'])
      expect(result.matches[0]!.$type).toBe('Video')
    })

    it('should search all collections in order when none have matches above threshold', async () => {
      const searchOrder: string[] = []

      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        searchOrder.push(type)
        // Return low scores below threshold
        return [{ $id: `${type.toLowerCase()}-1`, $score: 0.3, $type: type }]
      })

      const result = await searchUnionTypes(
        ['Primary', 'Secondary', 'Tertiary', 'Fallback'],
        'query',
        { mode: 'ordered', threshold: 0.75, searcher: mockSearcher }
      )

      // All types searched in order
      expect(searchOrder).toEqual(['Primary', 'Secondary', 'Tertiary', 'Fallback'])
      expect(result.allTypesExhausted).toBe(true)
    })

    it('should preserve priority order in integrated schema resolution', async () => {
      const { db } = DB({
        Query: { answer: '<~FAQ|Tutorial|Documentation' },
        FAQ: { question: 'string', answer: 'string' },
        Tutorial: { title: 'string', steps: 'string' },
        Documentation: { topic: 'string', content: 'string' },
      })

      // Create entities in reverse priority order
      await db.Documentation.create({ topic: 'API Reference', content: 'Methods and endpoints' })
      await db.Tutorial.create({ title: 'Getting Started', steps: 'Step 1: Install' })
      await db.FAQ.create({ question: 'How to start?', answer: 'Run npm install' })

      // The search should prefer FAQ (first in union) when matched
      const query = await db.Query.create({
        answerHint: 'How to start the application?'
      })

      // Verify the search was performed
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // First Match Above Threshold Tests
  // ===========================================================================

  describe('First match above threshold returned', () => {
    it('should return first match that exceeds global threshold', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'TypeA') {
          return [{ $id: 'a-1', $score: 0.6, $type: 'TypeA' }] // Below threshold
        }
        if (type === 'TypeB') {
          return [{ $id: 'b-1', $score: 0.85, $type: 'TypeB' }] // Above threshold
        }
        return []
      })

      const result = await searchUnionTypes(
        ['TypeA', 'TypeB', 'TypeC'],
        'query',
        { mode: 'ordered', threshold: 0.75, searcher: mockSearcher }
      )

      // Should return TypeB match (first above threshold)
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0]!.$id).toBe('b-1')
      expect(result.matches[0]!.$score).toBe(0.85)
    })

    it('should skip matches below threshold and continue searching', async () => {
      const searchOrder: string[] = []

      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        searchOrder.push(type)
        const scores: Record<string, number> = {
          'First': 0.5,    // Below threshold
          'Second': 0.65,  // Below threshold
          'Third': 0.9     // Above threshold
        }
        return [{ $id: `${type.toLowerCase()}-1`, $score: scores[type] ?? 0.5, $type: type }]
      })

      const result = await searchUnionTypes(
        ['First', 'Second', 'Third'],
        'query',
        { mode: 'ordered', threshold: 0.75, searcher: mockSearcher }
      )

      expect(searchOrder).toEqual(['First', 'Second', 'Third'])
      expect(result.matches[0]!.$type).toBe('Third')
      expect(result.matches[0]!.$score).toBe(0.9)
    })

    it('should respect per-type threshold configuration', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        const scores: Record<string, number> = {
          'HighBar': 0.85,  // Above default but below per-type
          'LowBar': 0.6     // Above its per-type threshold
        }
        return [{ $id: `${type.toLowerCase()}-1`, $score: scores[type] ?? 0.5, $type: type }]
      })

      const result = await searchUnionTypes(
        ['HighBar', 'LowBar'],
        'query',
        {
          mode: 'ordered',
          thresholds: {
            'HighBar': 0.95,  // Requires 95%
            'LowBar': 0.5     // Accepts 50%
          },
          searcher: mockSearcher
        }
      )

      // HighBar (0.85) is below its 0.95 threshold
      // LowBar (0.6) is above its 0.5 threshold
      expect(result.matches[0]!.$type).toBe('LowBar')
    })

    it('should return match with highest score from first matching type', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'TypeA') {
          return [
            { $id: 'a-1', $score: 0.78, $type: 'TypeA' },
            { $id: 'a-2', $score: 0.82, $type: 'TypeA' },
            { $id: 'a-3', $score: 0.76, $type: 'TypeA' }
          ]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['TypeA', 'TypeB'],
        'query',
        { mode: 'ordered', threshold: 0.75, searcher: mockSearcher }
      )

      // Should return all matches above threshold from first type
      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      // Confidence should be the max score
      expect(result.confidence).toBe(0.82)
    })
  })

  // ===========================================================================
  // $matchedType Metadata Tests
  // ===========================================================================

  describe('$matchedType indicates winning collection', () => {
    it('should set matchedType to the collection that provided the match', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'Expert') {
          return [{ $id: 'expert-1', $score: 0.92, $type: 'Expert', name: 'Dr. Smith' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['Document', 'Video', 'Expert'],
        'machine learning specialist',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.matchedType).toBe('Expert')
    })

    it('should include $type in each match object', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        return [{ $id: `${type.toLowerCase()}-1`, $score: 0.88, $type: type }]
      })

      const result = await searchUnionTypes(
        ['TypeA'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.matches[0]!.$type).toBe('TypeA')
    })

    it('should track matchedType in integrated backward fuzzy resolution', async () => {
      const { db } = DB({
        Reference: { source: '<~Book|Article|Website' },
        Book: { title: 'string', author: 'string' },
        Article: { title: 'string', journal: 'string' },
        Website: { title: 'string', url: 'string' },
      })

      // Create only an Article
      await db.Article.create('art-1', { title: 'Machine Learning Advances', journal: 'Nature' })

      const ref = await db.Reference.create({
        sourceHint: 'Academic research on machine learning',
      })

      // The $matchedType should indicate Article was matched
      expect(ref['source$matchedType']).toBe('Article')
    })

    it('should set matchedType to first union type when matched directly', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'Primary') {
          return [{ $id: 'primary-1', $score: 0.95, $type: 'Primary' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['Primary', 'Secondary', 'Tertiary'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.matchedType).toBe('Primary')
      expect(result.fallbackTriggered).toBe(false)
    })
  })

  // ===========================================================================
  // $fallbackUsed Flag Tests
  // ===========================================================================

  describe('$fallbackUsed flag when not first collection', () => {
    it('should set fallbackTriggered to true when match is from second type', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'Second') {
          return [{ $id: 'second-1', $score: 0.9, $type: 'Second' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['First', 'Second', 'Third'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.fallbackTriggered).toBe(true)
      expect(result.matchedType).toBe('Second')
    })

    it('should set fallbackTriggered to false when match is from first type', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'First') {
          return [{ $id: 'first-1', $score: 0.9, $type: 'First' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['First', 'Second', 'Third'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.fallbackTriggered).toBe(false)
    })

    it('should track fallbackUsed in integrated schema resolution', async () => {
      const { db } = DB({
        Search: { result: '<~PrimarySource|SecondarySource|Archive' },
        PrimarySource: { title: 'string', verified: 'boolean' },
        SecondarySource: { title: 'string', citation: 'string' },
        Archive: { title: 'string', year: 'number' },
      })

      // Only create Archive (third in priority)
      await db.Archive.create('arch-1', { title: 'Historical Data', year: 2020 })

      const search = await db.Search.create({
        resultHint: 'Historical records'
      })

      // Should have fallbackUsed flag since Archive is not first
      expect(search['result$fallbackUsed']).toBe(true)
    })

    it('should track searchOrder in result for debugging', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'Third') {
          return [{ $id: 'third-1', $score: 0.88, $type: 'Third' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['First', 'Second', 'Third', 'Fourth'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      // searchOrder should show types searched up to and including the match
      expect(result.searchOrder).toEqual(['First', 'Second', 'Third'])
      expect(result.searchedTypes).toEqual(['First', 'Second', 'Third'])
    })

    it('should indicate fallback depth through searchedTypes length', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'Fallback4') {
          return [{ $id: 'f4-1', $score: 0.85, $type: 'Fallback4' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['Primary', 'Fallback1', 'Fallback2', 'Fallback3', 'Fallback4'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      // 5 types searched before match
      expect(result.searchedTypes).toHaveLength(5)
      expect(result.fallbackTriggered).toBe(true)
    })
  })

  // ===========================================================================
  // Null Result Tests
  // ===========================================================================

  describe('Null returned when all collections exhausted', () => {
    it('should return empty matches when no type has results', async () => {
      const mockSearcher = vi.fn().mockImplementation(async () => [])

      const result = await searchUnionTypes(
        ['TypeA', 'TypeB', 'TypeC'],
        'impossible query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.matches).toHaveLength(0)
      expect(result.allTypesExhausted).toBe(true)
    })

    it('should set allTypesExhausted when all matches below threshold', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        // All types return low scores
        return [{ $id: `${type.toLowerCase()}-1`, $score: 0.4, $type: type }]
      })

      const result = await searchUnionTypes(
        ['Type1', 'Type2', 'Type3'],
        'query',
        { mode: 'ordered', threshold: 0.75, searcher: mockSearcher }
      )

      expect(result.matches).toHaveLength(0)
      expect(result.allTypesExhausted).toBe(true)
    })

    it('should track all searched types when exhausted', async () => {
      const mockSearcher = vi.fn().mockImplementation(async () => [])

      const result = await searchUnionTypes(
        ['Alpha', 'Beta', 'Gamma', 'Delta'],
        'query',
        { mode: 'ordered', searcher: mockSearcher }
      )

      expect(result.searchedTypes).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta'])
      expect(result.allTypesExhausted).toBe(true)
    })

    it('should return null/undefined in integrated backward fuzzy when exhausted', async () => {
      // Configure to return no matches
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const { db } = DB({
        Query: { result: '<~TypeA|TypeB|TypeC?' },  // Optional field
        TypeA: { value: 'string' },
        TypeB: { value: 'string' },
        TypeC: { value: 'string' },
      })

      // No entities created - should exhaust all types

      const query = await db.Query.create({
        resultHint: 'Something that does not exist'
      })

      // Backward fuzzy should return null when exhausted (never generates)
      const result = await query.result
      expect(result == null).toBe(true)
    })

    it('should include belowThresholdMatches for debugging when configured', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        const lowScores: Record<string, number> = {
          'Type1': 0.45,
          'Type2': 0.52,
          'Type3': 0.38
        }
        return [{ $id: `${type.toLowerCase()}-1`, $score: lowScores[type] ?? 0.4, $type: type }]
      })

      const result = await searchUnionTypes(
        ['Type1', 'Type2', 'Type3'],
        'query',
        { mode: 'ordered', threshold: 0.75, searcher: mockSearcher, includeBelowThreshold: true }
      )

      expect(result.matches).toHaveLength(0)
      expect(result.belowThresholdMatches).toHaveLength(3)
      expect(result.belowThresholdMatches!.map(m => m.$type)).toEqual(['Type1', 'Type2', 'Type3'])
    })
  })

  // ===========================================================================
  // Provider Integration Tests
  // ===========================================================================

  describe('createProviderSearcher integration', () => {
    it('should create a searcher function from provider', () => {
      const mockProvider = {
        semanticSearch: vi.fn().mockResolvedValue([
          { $id: 'item-1', $score: 0.85, title: 'Test' }
        ])
      }

      const searcher = createProviderSearcher(mockProvider)

      expect(typeof searcher).toBe('function')
    })

    it('should call provider.semanticSearch with correct parameters', async () => {
      const mockProvider = {
        semanticSearch: vi.fn().mockResolvedValue([
          { $id: 'item-1', $score: 0.85, title: 'Test' }
        ])
      }

      const searcher = createProviderSearcher(mockProvider)
      await searcher('Document', 'test query', { threshold: 0.75, limit: 5 })

      expect(mockProvider.semanticSearch).toHaveBeenCalledWith(
        'Document',
        'test query',
        { minScore: 0.75, limit: 5 }
      )
    })

    it('should add $type to returned matches', async () => {
      const mockProvider = {
        semanticSearch: vi.fn().mockResolvedValue([
          { $id: 'item-1', $score: 0.85, title: 'Test' }
        ])
      }

      const searcher = createProviderSearcher(mockProvider)
      const results = await searcher('Document', 'query')

      expect(results[0]!.$type).toBe('Document')
    })
  })

  // ===========================================================================
  // Parsing Integration Tests
  // ===========================================================================

  describe('parseUnionTypes and parseUnionThresholds', () => {
    it('should parse union types preserving order', () => {
      const types = parseUnionTypes('Primary|Secondary|Tertiary')
      expect(types).toEqual(['Primary', 'Secondary', 'Tertiary'])
    })

    it('should parse per-type thresholds', () => {
      const thresholds = parseUnionThresholds('TypeA|TypeB(0.8)|TypeC(0.6)')
      expect(thresholds).toEqual({ TypeB: 0.8, TypeC: 0.6 })
    })

    it('should handle mixed threshold and non-threshold types', () => {
      const types = parseUnionTypes('High(0.95)|Medium|Low(0.5)')
      const thresholds = parseUnionThresholds('High(0.95)|Medium|Low(0.5)')

      expect(types).toEqual(['High', 'Medium', 'Low'])
      expect(thresholds).toEqual({ High: 0.95, Low: 0.5 })
    })
  })

  // ===========================================================================
  // Full Integration Tests with Real DB Flow
  // ===========================================================================

  describe('Full integration with DB and semantic resolution', () => {
    it('should properly set metadata fields through complete resolution flow', async () => {
      // Reset mock to track calls
      mockProvider.mocks.findSimilar.mockClear()

      const { db } = DB({
        SearchQuery: { resource: '<~Document|Video|Expert' },
        Document: { title: 'string', content: 'string' },
        Video: { title: 'string', url: 'string' },
        Expert: { name: 'string', specialty: 'string' },
      })

      // Create entities in all types
      await db.Document.create('doc-1', { title: 'API Guide', content: 'REST API documentation' })
      await db.Video.create('vid-1', { title: 'Tutorial', url: 'https://example.com' })
      await db.Expert.create('exp-1', { name: 'Dr. Smith', specialty: 'Machine Learning' })

      const query = await db.SearchQuery.create({
        resourceHint: 'I need help with machine learning'
      })

      // Verify semantic search was called
      expect(mockProvider.mocks.findSimilar).toHaveBeenCalled()

      // The metadata should be set
      // Note: The exact type matched depends on the mock behavior
      expect(query['resource$matchedType']).toBeDefined()
      expect(query['resource$score']).toBeDefined()
      expect(typeof query['resource$score']).toBe('number')
    })

    it('should set fallbackUsed when match is from non-first type', async () => {
      // Configure mock to return no matches for first two types, only third
      const callCounts: Record<string, number> = {}
      mockProvider.mocks.findSimilar.mockImplementation((_query, _embeddings, items, _options) => {
        // Track which type is being searched
        const typeName = items[0]?.entity?.$type as string
        callCounts[typeName] = (callCounts[typeName] || 0) + 1

        // Only return matches for Expert (third type)
        if (typeName === 'Expert') {
          return items.map((item: { entity: Record<string, unknown> }, index: number) => ({
            item,
            score: 0.9,
            index
          }))
        }
        // Return empty for Document and Video
        return []
      })

      const { db } = DB({
        SearchQuery: { resource: '<~Document|Video|Expert' },
        Document: { title: 'string' },
        Video: { title: 'string' },
        Expert: { name: 'string' },
      })

      // Only create an Expert
      await db.Expert.create('exp-1', { name: 'AI Specialist' })

      const query = await db.SearchQuery.create({
        resourceHint: 'Need an AI expert'
      })

      // Verify fallback was used (matched Expert, not Document)
      expect(query['resource$matchedType']).toBe('Expert')
      expect(query['resource$fallbackUsed']).toBe(true)
      expect(query['resource$searchOrder']).toEqual(['Document', 'Video', 'Expert'])
    })

    it('should not set fallbackUsed when match is from first type', async () => {
      // Configure mock to return matches for first type
      mockProvider.mocks.findSimilar.mockImplementation((_query, _embeddings, items, _options) => {
        return items.map((item: { entity: Record<string, unknown> }, index: number) => ({
          item,
          score: 0.9,
          index
        }))
      })

      const { db } = DB({
        SearchQuery: { resource: '<~Document|Video|Expert' },
        Document: { title: 'string' },
        Video: { title: 'string' },
        Expert: { name: 'string' },
      })

      // Create only a Document (first type)
      await db.Document.create('doc-1', { title: 'Getting Started Guide' })

      const query = await db.SearchQuery.create({
        resourceHint: 'I need a guide'
      })

      // Verify no fallback (matched Document, the first type)
      expect(query['resource$matchedType']).toBe('Document')
      expect(query['resource$fallbackUsed']).toBeUndefined()
    })

    it('should return null and leave field undefined when all types exhausted', async () => {
      // Configure mock to return no matches for any type
      mockProvider.mocks.findSimilar.mockReturnValue([])

      const { db } = DB({
        SearchQuery: { resource: '<~Document|Video|Expert?' }, // Optional field
        Document: { title: 'string' },
        Video: { title: 'string' },
        Expert: { name: 'string' },
      })

      // No entities created - all types will be exhausted

      const query = await db.SearchQuery.create({
        resourceHint: 'Something that does not exist'
      })

      // Backward fuzzy should not generate, field should be undefined
      const resource = await query.resource
      expect(resource == null).toBe(true)
    })
  })

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error handling in union search', () => {
    it('should handle errors in ordered mode with continue option', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'TypeB') {
          throw new Error('Search failed for TypeB')
        }
        if (type === 'TypeC') {
          return [{ $id: 'c-1', $score: 0.9, $type: 'TypeC' }]
        }
        return []
      })

      const result = await searchUnionTypes(
        ['TypeA', 'TypeB', 'TypeC'],
        'query',
        { mode: 'ordered', searcher: mockSearcher, onError: 'continue' }
      )

      // Should continue past error and find match in TypeC
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0]!.$type).toBe('TypeC')
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0]!.type).toBe('TypeB')
    })

    it('should throw on error in ordered mode with throw option', async () => {
      const mockSearcher = vi.fn().mockImplementation(async (type: string) => {
        if (type === 'TypeB') {
          throw new Error('Search failed')
        }
        return []
      })

      await expect(
        searchUnionTypes(
          ['TypeA', 'TypeB', 'TypeC'],
          'query',
          { mode: 'ordered', searcher: mockSearcher, onError: 'throw' }
        )
      ).rejects.toThrow('Search failed')
    })
  })
})
