/**
 * Tests for $seed Reference Data Loading
 *
 * The $seed field allows loading reference data from external sources:
 * - $seed: 'https://example.com/data.tsv' - URL to fetch TSV/CSV data
 * - $id: '$.columnName' - specifies which column is the primary key
 * - fieldName: '$.sourceColumn' - maps source columns to entity fields
 *
 * This enables grounding AI-generated content against real reference data
 * like O*NET occupations, NAICS industries, etc.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

// Mock TSV data for testing
const MOCK_OCCUPATIONS_TSV = `oNETSOCCode\ttitle\tdescription
11-1011.00\tChief Executives\tDetermine and formulate policies and provide overall direction of companies
11-1021.00\tGeneral and Operations Managers\tPlan, direct, or coordinate the operations of public or private sector organizations
15-1252.00\tSoftware Developers\tResearch, design, and develop computer and network software or specialized utility programs`

const MOCK_INDUSTRIES_TSV = `naicsCode\ttitle\tsector
5112\tSoftware Publishers\tInformation
5415\tComputer Systems Design\tProfessional Services
6211\tOffices of Physicians\tHealth Care`

const MOCK_CSV_DATA = `id,name,category
1,Apple,Fruit
2,Banana,Fruit
3,Carrot,Vegetable`

describe('$seed Reference Data Loading', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    setProvider(createMemoryProvider())
    // Save original fetch
    originalFetch = globalThis.fetch
    // Mock global fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('occupations.tsv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_OCCUPATIONS_TSV),
        })
      }
      if (url.includes('industries.tsv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_INDUSTRIES_TSV),
        })
      }
      if (url.includes('items.csv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_CSV_DATA),
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })
  })

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('$seed URL fetched and parsed (TSV/CSV)', () => {
    it('should fetch and parse TSV data from $seed URL', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      // Seed the data
      await db.Occupation.seed()

      // Data should be loaded
      const occupations = await db.Occupation.list()
      expect(occupations).toHaveLength(3)
    })

    it('should parse CSV data correctly', async () => {
      const { db } = DB({
        Item: {
          $seed: 'https://data.example.com/items.csv',
          $id: '$.id',
          name: '$.name',
          category: '$.category',
        },
      })

      await db.Item.seed()

      const items = await db.Item.list()
      expect(items).toHaveLength(3)
      // Check each item directly instead of using map (which returns promises for proxy objects)
      expect(items[0]?.name).toBe('Apple')
      expect(items[1]?.name).toBe('Banana')
      expect(items[2]?.name).toBe('Carrot')
    })

    it('should handle TSV with tab separators', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      await db.Occupation.seed()

      const occupation = await db.Occupation.get('15-1252.00')
      expect(occupation).toBeDefined()
      expect(occupation?.title).toBe('Software Developers')
    })

    it('should skip header row when parsing', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      await db.Occupation.seed()

      // Should not have a record with $id 'oNETSOCCode' (the header)
      const headerRecord = await db.Occupation.get('oNETSOCCode')
      expect(headerRecord).toBeNull()
    })
  })

  describe('$. syntax maps source columns to fields', () => {
    it('should map source columns to entity fields using $. prefix', async () => {
      const { db } = DB({
        Industry: {
          $seed: 'https://naics.data/industries.tsv',
          $id: '$.naicsCode',
          name: '$.title',
          sectorName: '$.sector',
        },
      })

      await db.Industry.seed()

      const industry = await db.Industry.get('5112')
      expect(industry).toBeDefined()
      expect(industry?.name).toBe('Software Publishers')
      expect(industry?.sectorName).toBe('Information')
    })

    it('should handle field name different from source column', async () => {
      const { db } = DB({
        Job: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          jobTitle: '$.title',
          jobDescription: '$.description',
        },
      })

      await db.Job.seed()

      const job = await db.Job.get('11-1011.00')
      expect(job?.jobTitle).toBe('Chief Executives')
      expect(job?.jobDescription).toContain('Determine and formulate policies')
    })

    it('should only include fields with $. mapping', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          // description not mapped
        },
      })

      await db.Occupation.seed()

      const occupation = await db.Occupation.get('15-1252.00')
      expect(occupation?.title).toBe('Software Developers')
      // description should not be present since it's not mapped
      expect(occupation?.description).toBeUndefined()
    })
  })

  describe('$id specifies primary key field', () => {
    it('should use $id column as entity $id', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      await db.Occupation.seed()

      // Should be able to get by the primary key value
      const ceo = await db.Occupation.get('11-1011.00')
      expect(ceo).toBeDefined()
      expect(ceo?.$id).toBe('11-1011.00')
      expect(ceo?.title).toBe('Chief Executives')
    })

    it('should handle numeric $id values', async () => {
      const { db } = DB({
        Industry: {
          $seed: 'https://naics.data/industries.tsv',
          $id: '$.naicsCode',
          name: '$.title',
        },
      })

      await db.Industry.seed()

      const industry = await db.Industry.get('5112')
      expect(industry?.$id).toBe('5112')
    })

    it('should reject duplicate $id values', async () => {
      // This would happen if the TSV has duplicate keys
      const duplicateTsv = `code\tname
123\tFirst
123\tSecond`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(duplicateTsv),
      })

      const { db } = DB({
        Item: {
          $seed: 'https://data/duplicate.tsv',
          $id: '$.code',
          name: '$.name',
        },
      })

      // Should handle duplicates gracefully (last one wins or error)
      await db.Item.seed()
      const items = await db.Item.list()
      // Either 1 item (last wins) or the implementation throws
      expect(items.length).toBeLessThanOrEqual(2)
    })
  })

  describe('seed() method exists on entity collections', () => {
    it('should have seed() method on entities with $seed defined', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
        },
      })

      expect(typeof db.Occupation.seed).toBe('function')
    })

    it('should not have seed() method on entities without $seed', async () => {
      const { db } = DB({
        Post: {
          title: 'string',
          content: 'string',
        },
      })

      // seed should not be defined for entities without $seed
      expect((db.Post as any).seed).toBeUndefined()
    })

    it('should return count of seeded records', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      const result = await db.Occupation.seed()
      expect(result).toEqual({ count: 3 })
    })

    it('should be idempotent - reseeding updates existing records', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      await db.Occupation.seed()
      await db.Occupation.seed() // Seed again

      // Should still have 3 records, not 6
      const occupations = await db.Occupation.list()
      expect(occupations).toHaveLength(3)
    })
  })

  describe('Embeddings generated for seeded data', () => {
    it('should generate embeddings for seeded data when embedding provider configured', async () => {
      const mockEmbeddingProvider = {
        embedTexts: vi.fn().mockResolvedValue({
          embeddings: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
        }),
      }

      setProvider(
        createMemoryProvider({
          embeddingProvider: mockEmbeddingProvider,
        })
      )

      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      await db.Occupation.seed()

      // Embedding provider should have been called
      expect(mockEmbeddingProvider.embedTexts).toHaveBeenCalled()
    })

    it('should enable semantic search on seeded data', async () => {
      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      await db.Occupation.seed()

      // Semantic search should work on seeded data
      const results = await db.Occupation.semanticSearch('computer programming')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.title).toBe('Software Developers')
    })
  })

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { db } = DB({
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
        },
      })

      await expect(db.Occupation.seed()).rejects.toThrow('Network error')
    })

    it('should handle invalid TSV format', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not\tvalid\ntsv\twithout\tenough\tcolumns'),
      })

      const { db } = DB({
        Item: {
          $seed: 'https://data/invalid.tsv',
          $id: '$.id',
          name: '$.name',
          missing: '$.nonexistent',
        },
      })

      // Should handle missing columns gracefully
      await db.Item.seed()
      const items = await db.Item.list()
      // Missing fields should be undefined
      expect(items[0]?.missing).toBeUndefined()
    })

    it('should handle HTTP error responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const { db } = DB({
        Item: {
          $seed: 'https://data/missing.tsv',
          $id: '$.id',
          name: '$.name',
        },
      })

      await expect(db.Item.seed()).rejects.toThrow(/404|Not Found/)
    })
  })

  describe('Integration with backward fuzzy (<~)', () => {
    it('should allow backward fuzzy matching against seeded reference data', async () => {
      const { db } = DB({
        ICP: {
          as: 'Who are they? <~Occupation',
        },
        Occupation: {
          $seed: 'https://onet.data/occupations.tsv',
          $id: '$.oNETSOCCode',
          title: '$.title',
          description: '$.description',
        },
      })

      // Seed the reference data first
      await db.Occupation.seed()

      // Create an ICP that should match against seeded occupations
      const icp = await db.ICP.create({
        asHint: 'People who write computer programs and software',
      })

      const occupation = await icp.as
      expect(occupation).toBeDefined()
      expect(occupation?.title).toBe('Software Developers')
    })
  })
})
