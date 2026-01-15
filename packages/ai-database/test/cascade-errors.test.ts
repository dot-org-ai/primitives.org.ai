/**
 * Tests for Cascade Error Handling Consistency
 *
 * These tests verify that cascade.ts properly throws errors instead of
 * silently returning null/undefined when AI generation fails.
 *
 * RED Phase Tests (aip-zxw4):
 * - Tests should FAIL initially, proving inconsistent error handling
 *
 * Current Problematic Patterns in cascade.ts:
 * - Line 202-206: generateEntityDataWithAI catches errors and returns null
 * - Line 435-441: generateAIFields catches errors and continues silently
 *
 * Expected Behavior:
 * - AI generation failures should throw AIGenerationError
 * - Errors should propagate through the cascade chain
 * - Partial generation errors should be reported
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import { configureAIGeneration } from '../src/schema/cascade.js'
import { AIGenerationError } from '../src/errors.js'

// Hoist the mock to module level - this is required for vi.mock to work
vi.mock('ai-functions', () => {
  return {
    generateObject: vi.fn(),
  }
})

describe('Cascade Error Handling Consistency', () => {
  let mockGenerateObject: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    setProvider(createMemoryProvider())
    // Enable AI generation for tests
    configureAIGeneration({ enabled: true })

    // Get reference to the mocked function
    const aiFunctions = await import('ai-functions')
    mockGenerateObject = aiFunctions.generateObject as ReturnType<typeof vi.fn>
    // Reset mock state before each test
    mockGenerateObject.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Reset AI generation to default
    configureAIGeneration({ enabled: true })
  })

  describe('generateEntityDataWithAI Error Handling', () => {
    /**
     * BUG: generateEntityDataWithAI catches errors and returns null
     *
     * Location: cascade.ts:202-206
     * Current:
     *   } catch (error) {
     *     console.warn(`AI generation failed for ${type}, falling back...`, error)
     *     return null
     *   }
     *
     * Expected: Should throw AIGenerationError, not return null
     */
    it('should throw AIGenerationError when AI generation fails (not return null)', async () => {
      // Configure mock to throw an error
      mockGenerateObject.mockRejectedValue(new Error('API rate limit exceeded'))

      const { db } = DB({
        Product: {
          name: 'string',
          description: 'Describe this product in detail',
        },
      })

      // Currently this silently falls back to placeholder generation
      // It SHOULD throw an AIGenerationError
      let threwError = false
      let errorInstance: unknown = null

      try {
        await db.Product.create({ name: 'Widget' })
      } catch (error) {
        threwError = true
        errorInstance = error
      }

      // EXPECTED: Error should be thrown when AI fails
      expect(threwError).toBe(true)
      expect(errorInstance).toBeInstanceOf(AIGenerationError)
    })

    /**
     * BUG: AI API network errors are silently swallowed
     *
     * When the AI service is unavailable (network error, timeout, etc.),
     * the error should propagate so the caller can handle it appropriately.
     */
    it('should propagate network errors from AI service', async () => {
      mockGenerateObject.mockRejectedValue(new Error('ECONNREFUSED: Connection refused'))

      const { db } = DB({
        Article: {
          title: 'string',
          content: 'Write an article about this topic',
        },
      })

      // Currently: Network error is caught, returns null, uses placeholder
      // Expected: Network error should propagate to caller
      await expect(db.Article.create({ title: 'Tech News' })).rejects.toThrow()
    })

    /**
     * BUG: AI model errors (invalid model, quota exceeded) are swallowed
     */
    it('should throw on AI model errors', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Model quota exceeded'))

      const { db } = DB({
        Comment: {
          text: 'Generate a thoughtful comment',
        },
      })

      await expect(db.Comment.create({})).rejects.toThrow(AIGenerationError)
    })
  })

  describe('generateAIFields Error Handling', () => {
    /**
     * BUG: generateAIFields catches errors and continues silently
     *
     * Location: cascade.ts:435-441
     * Current:
     *   } catch (error) {
     *     console.warn(`AI field generation failed for ${typeName}...`, error)
     *   }
     *
     * Expected: Should throw AIGenerationError or call onError callback
     */
    it('should throw AIGenerationError when field generation fails', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Invalid schema for generation'))

      const { db } = DB({
        Review: {
          $instructions: 'Generate product reviews',
          rating: 'number',
          summary: 'Summarize the review sentiment',
        },
      })

      // Currently: Error is caught, logged, uses placeholder values
      // Expected: Should throw AIGenerationError
      await expect(db.Review.create({ rating: 5 })).rejects.toThrow(AIGenerationError)
    })

    /**
     * Test that errors during single generateObject call are reported
     *
     * All prompt fields are generated in a single call to generateObject,
     * so if that call fails, all field generation fails.
     */
    it('should throw when generateObject call fails', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Generation batch failed'))

      const { db } = DB({
        MultiField: {
          field1: 'Generate field 1',
          field2: 'Generate field 2',
        },
      })

      // Expected: Error should be thrown, not silently ignored
      await expect(db.MultiField.create({})).rejects.toThrow(AIGenerationError)
    })
  })

  describe('Error Propagation Through Cascade Chain', () => {
    /**
     * When multiple entities are created in sequence and AI fails on any,
     * the error should propagate to the caller.
     */
    it('should propagate AI errors through entity creation chain', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Cascade level error'))

      const { db } = DB({
        Report: {
          title: 'string',
          // These are prompt fields that trigger AI generation
          summary: 'Summarize the key findings',
          recommendations: 'What are your recommendations?',
        },
      })

      // Creating report with prompt fields should throw when AI fails
      await expect(db.Report.create({ title: 'Q4 Report' })).rejects.toThrow(AIGenerationError)
    })

    /**
     * Error should include context about which entity failed.
     */
    it('should include entity context in propagated error', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Generation service unavailable'))

      const { db } = DB({
        Analysis: {
          name: 'string',
          insights: 'What insights can you derive from the data?',
        },
      })

      try {
        await db.Analysis.create({ name: 'Market Analysis' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AIGenerationError)
        if (error instanceof AIGenerationError) {
          expect(error.entityType).toBe('Analysis')
        }
      }
    })
  })

  describe('Error Type Specificity', () => {
    /**
     * Errors should be AIGenerationError with proper context,
     * not generic Error objects.
     */
    it('should throw AIGenerationError with entity type context', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Generation failed'))

      const { db } = DB({
        Widget: {
          name: 'string',
          specs: 'Generate technical specifications',
        },
      })

      try {
        await db.Widget.create({ name: 'Gizmo' })
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(AIGenerationError)
        if (error instanceof AIGenerationError) {
          expect(error.entityType).toBe('Widget')
          expect(error.code).toBe('AI_GENERATION_ERROR')
        }
      }
    })

    /**
     * Error should include the field name when a specific field fails
     */
    it('should include field name in AIGenerationError when available', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Field generation failed'))

      const { db } = DB({
        Post: {
          title: 'string',
          content: 'Write engaging content for this post',
        },
      })

      try {
        await db.Post.create({ title: 'Hello World' })
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(AIGenerationError)
        // The error should indicate which field(s) failed
        if (error instanceof AIGenerationError) {
          expect(error.message).toContain('Post')
        }
      }
    })
  })

  describe('Fallback Behavior Configuration', () => {
    /**
     * When AI generation is disabled, no errors should be thrown
     * (placeholder generation should work silently).
     */
    it('should use placeholder without error when AI is disabled', async () => {
      configureAIGeneration({ enabled: false })

      const { db } = DB({
        Item: {
          name: 'string',
          description: 'Generate a description',
        },
      })

      // Should succeed with placeholder values, no error
      const item = await db.Item.create({ name: 'Test' })
      expect(item).toBeDefined()
      expect(item.description).toBeDefined()
    })

    /**
     * When AI is enabled but fails, errors should propagate
     * (not fall back to placeholder silently).
     */
    it('should throw error when AI is enabled and fails', async () => {
      configureAIGeneration({ enabled: true })
      mockGenerateObject.mockRejectedValue(new Error('AI service unavailable'))

      const { db } = DB({
        Item: {
          name: 'string',
          description: 'Generate a description',
        },
      })

      // Should throw, not silently fall back to placeholder
      await expect(db.Item.create({ name: 'Test' })).rejects.toThrow()
    })
  })
})
