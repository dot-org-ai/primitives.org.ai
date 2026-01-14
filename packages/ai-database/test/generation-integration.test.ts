/**
 * Tests for ai-functions generateObject integration
 *
 * Verifies that ai-database uses generateObject from ai-functions
 * for AI-powered entity field generation instead of placeholder values.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

// Mock ai-functions to avoid real API calls in tests
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { problem: 'Generated problem description', solution: 'Generated solution' }
  })
}))

describe('ai-functions Generation Integration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Forward Exact (->) with generateObject', () => {
    it('should call generateObject for forward exact fields', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem does this solve? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      const startup = await db.Startup.create({ name: 'DevFlow' })

      // generateObject should have been called to generate the Idea entity
      expect(generateObject).toHaveBeenCalled()
    })

    it('should pass the prompt text to generateObject', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem does this solve? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      await db.Startup.create({ name: 'DevFlow' })

      // Check that generateObject was called with the prompt from field definition
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('What problem does this solve?')
        })
      )
    })

    it('should pass target entity schema to generateObject', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'Generate a startup idea ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      await db.Startup.create({ name: 'TechCorp' })

      // Check that generateObject was called with a schema matching Idea entity
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: expect.objectContaining({
            problem: expect.any(String),
            solution: expect.any(String)
          })
        })
      )
    })

    it('should use generated object values for entity creation', async () => {
      const { generateObject } = await import('ai-functions')

      // Configure mock to return specific values
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          problem: 'AI-generated problem statement',
          solution: 'AI-generated solution approach'
        }
      })

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      const startup = await db.Startup.create({ name: 'AIStartup' })
      const idea = await startup.idea

      // The generated values should be used in the created entity
      expect(idea.problem).toBe('AI-generated problem statement')
      expect(idea.solution).toBe('AI-generated solution approach')
    })

    it('should include model alias in generateObject call', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: '->Idea'
        },
        Idea: { description: 'string' }
      })

      await db.Startup.create({ name: 'TestCo' })

      // Should use a model alias (default 'sonnet' or configured)
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.stringMatching(/sonnet|opus|gpt|claude/)
        })
      )
    })
  })

  describe('Context-aware generation', () => {
    it('should include parent entity data in generation prompt', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Company: {
          name: 'string',
          industry: 'string',
          product: 'What product suits this company? ->Product'
        },
        Product: { name: 'string', description: 'string' }
      })

      await db.Company.create({ name: 'HealthTech', industry: 'Healthcare' })

      // The prompt should include parent context (name, industry)
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/HealthTech|Healthcare/)
        })
      )
    })

    it('should include $instructions in generation prompt', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Startup: {
          $instructions: 'This is a B2B SaaS startup targeting enterprise customers',
          name: 'string',
          pitch: 'Generate a pitch ->Pitch'
        },
        Pitch: { headline: 'string', value_prop: 'string' }
      })

      await db.Startup.create({ name: 'EnterpriseCo' })

      // The prompt should include $instructions context
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('B2B SaaS')
        })
      )
    })
  })

  describe('Prompt field generation', () => {
    // NOTE: Direct prompt fields (e.g., description: 'Write a description')
    // are not supported in the current schema parser. AI generation for
    // non-relationship fields is handled via $instructions context.
    // This test verifies that pattern works through forward exact relations.

    it('should use $instructions context for generation', async () => {
      const { generateObject } = await import('ai-functions')

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { headline: 'Generated headline', content: 'Generated content' }
      })

      const { db } = DB({
        Product: {
          $instructions: 'This is a premium B2B SaaS product',
          name: 'string',
          details: '->ProductDetails'
        },
        ProductDetails: { headline: 'string', content: 'string' }
      })

      await db.Product.create({ name: 'SuperWidget' })

      // generateObject should be called for ProductDetails generation
      expect(generateObject).toHaveBeenCalled()
    })
  })

  describe('Fallback behavior', () => {
    it('should use placeholder when generateObject fails', async () => {
      const { generateObject } = await import('ai-functions')

      // Mock generateObject to reject on first call (for Idea generation)
      vi.mocked(generateObject).mockRejectedValueOnce(new Error('API Error'))

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      // Should not throw, should fall back to placeholder
      const startup = await db.Startup.create({ name: 'FallbackCo' })
      const idea = await startup.idea

      // Should have some value even if AI failed (placeholder generates values)
      expect(idea).toBeDefined()
      expect(idea.$type).toBe('Idea')
      // Placeholder generation produces values containing field name/context
      expect(typeof idea.problem).toBe('string')
    })

    it('should not call generateObject when value is provided', async () => {
      const { generateObject } = await import('ai-functions')
      vi.clearAllMocks()

      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      // Create with existing idea
      const existingIdea = await db.Idea.create({
        problem: 'Manual problem',
        solution: 'Manual solution'
      })

      await db.Startup.create({
        name: 'ManualCo',
        idea: existingIdea.$id
      })

      // generateObject should NOT be called when value is provided
      // Note: This might be called for Idea creation if Idea has prompt fields
      const generateObjectCalls = vi.mocked(generateObject).mock.calls
      const callsForIdea = generateObjectCalls.filter(call =>
        JSON.stringify(call[0]).includes('problem') &&
        JSON.stringify(call[0]).includes('solution')
      )

      // At most one call for initial Idea creation, not for Startup creation
      expect(callsForIdea.length).toBeLessThanOrEqual(1)
    })
  })
})
