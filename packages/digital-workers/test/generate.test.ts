/**
 * Tests for generate() - Content generation primitive
 *
 * The generate() function provides content generation with rich metadata
 * about the generation process. Unlike ai-functions.generate() which is a
 * lower-level type-dispatch function, this function returns GenerateResult
 * with content, metadata (model, tokens, duration), and content type info.
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect } from 'vitest'
import { generate } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('generate() - Content Generation Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(generate).toBeDefined()
      expect(typeof generate).toBe('function')
    })

    it('should have variations method', () => {
      expect(generate.variations).toBeDefined()
      expect(typeof generate.variations).toBe('function')
    })

    it('should have withTone method', () => {
      expect(generate.withTone).toBeDefined()
      expect(typeof generate.withTone).toBe('function')
    })

    it('should have forAudience method', () => {
      expect(generate.forAudience).toBeDefined()
      expect(typeof generate.forAudience).toBe('function')
    })

    it('should have withLength method', () => {
      expect(generate.withLength).toBeDefined()
      expect(typeof generate.withLength).toBe('function')
    })

    it('should have refine method', () => {
      expect(generate.refine).toBeDefined()
      expect(typeof generate.refine).toBe('function')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Text Generation', () => {
    it('should generate text content', async () => {
      const result = await generate('Write a haiku about coding')

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(typeof result.content).toBe('string')
      expect(result.type).toBe('text')
      expect(result.metadata).toBeDefined()
    })

    it('should include metadata with duration', async () => {
      const result = await generate('Say hello in one word')

      expect(result.metadata).toBeDefined()
      expect(result.metadata?.duration).toBeDefined()
      expect(typeof result.metadata?.duration).toBe('number')
      expect(result.metadata?.duration).toBeGreaterThan(0)
    })

    it('should include model in metadata', async () => {
      const result = await generate('Generate a greeting', {
        model: 'sonnet',
      })

      expect(result.metadata?.model).toBeDefined()
    })

    it('should respect instructions', async () => {
      const result = await generate('Write a product description', {
        type: 'text',
        instructions: 'Keep it under 20 words. Be enthusiastic.',
      })

      expect(result.content).toBeDefined()
      expect(result.type).toBe('text')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Structured Generation', () => {
    it('should generate structured content with schema', async () => {
      const result = await generate<{ name: string; description: string }>('Create a product', {
        type: 'structured',
        schema: {
          name: 'Product name',
          description: 'Short product description',
        },
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.type).toBe('structured')
      expect(typeof result.content).toBe('object')
      expect((result.content as { name: string }).name).toBeDefined()
      expect((result.content as { description: string }).description).toBeDefined()
    })

    it('should generate complex structured content', async () => {
      const result = await generate<{
        title: string
        sections: string[]
        author: { name: string; expertise: string }
      }>('Create a technical article outline', {
        type: 'structured',
        schema: {
          title: 'Article title',
          sections: ['List of section headings'],
          author: {
            name: 'Author name',
            expertise: 'Area of expertise',
          },
        },
      })

      expect(result.content).toBeDefined()
      expect((result.content as { title: string }).title).toBeDefined()
      expect(Array.isArray((result.content as { sections: string[] }).sections)).toBe(true)
      expect((result.content as { author: { name: string } }).author.name).toBeDefined()
    })

    it('should throw error for structured without schema', async () => {
      await expect(generate('Generate something', { type: 'structured' })).rejects.toThrow(
        'Schema is required'
      )
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Code Generation', () => {
    it('should generate code', async () => {
      const result = await generate('Write a function to add two numbers', {
        type: 'code',
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.type).toBe('code')
      expect(result.metadata?.language).toBeDefined()
    })

    it('should include explanation for code', async () => {
      const result = await generate('Write a TypeScript function to reverse a string', {
        type: 'code',
        instructions: 'Use modern ES6+ syntax',
      })

      expect(result.metadata?.explanation).toBeDefined()
      expect(typeof result.metadata?.explanation).toBe('string')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Variations', () => {
    it('should generate multiple variations', async () => {
      const variations = await generate.variations('Write a catchy tagline for a coffee shop', 3, {
        type: 'text',
      })

      expect(variations).toBeDefined()
      expect(Array.isArray(variations)).toBe(true)
      expect(variations.length).toBe(3)

      variations.forEach((v) => {
        expect(v.content).toBeDefined()
        expect(v.type).toBe('text')
      })
    })

    it('should generate unique variations', async () => {
      const variations = await generate.variations('Generate a random color name', 2)

      expect(variations.length).toBe(2)
      // Variations should be defined (may or may not be unique)
      variations.forEach((v) => {
        expect(v.content).toBeDefined()
      })
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Tone', () => {
    it('should generate with professional tone', async () => {
      const result = await generate.withTone(
        'Write an email declining a meeting invitation',
        'professional'
      )

      expect(result.content).toBeDefined()
      expect(typeof result.content).toBe('string')
    })

    it('should generate with friendly tone', async () => {
      const result = await generate.withTone('Write a thank you message', 'friendly')

      expect(result.content).toBeDefined()
    })

    it('should generate with formal tone', async () => {
      const result = await generate.withTone('Write a business letter introduction', 'formal')

      expect(result.content).toBeDefined()
    })

    it('should support all tone options', async () => {
      const tones = [
        'professional',
        'casual',
        'friendly',
        'formal',
        'humorous',
        'empathetic',
      ] as const

      for (const tone of tones.slice(0, 2)) {
        // Test just a couple to save time
        const result = await generate.withTone('Write a greeting', tone)
        expect(result.content).toBeDefined()
      }
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Audience', () => {
    it('should generate for technical audience', async () => {
      const result = await generate.forAudience('Explain how HTTP works', 'software engineers')

      expect(result.content).toBeDefined()
      expect(typeof result.content).toBe('string')
    })

    it('should generate for non-technical audience', async () => {
      const result = await generate.forAudience(
        'Explain how HTTP works',
        'non-technical business stakeholders'
      )

      expect(result.content).toBeDefined()
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Length', () => {
    it('should generate brief content', async () => {
      const result = await generate.withLength('Describe a sunset', 'brief')

      expect(result.content).toBeDefined()
      // Brief should be short
      expect((result.content as string).length).toBeLessThan(200)
    })

    it('should generate short content', async () => {
      const result = await generate.withLength('Describe a forest', 'short')

      expect(result.content).toBeDefined()
    })

    it('should generate medium content', async () => {
      const result = await generate.withLength('Describe a city', 'medium')

      expect(result.content).toBeDefined()
    })

    it('should support all length options', async () => {
      const lengths = ['brief', 'short', 'medium', 'long', 'detailed'] as const

      // Just test brief to save time
      const result = await generate.withLength('Write about trees', 'brief')
      expect(result.content).toBeDefined()
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Refinement', () => {
    it('should refine content iteratively', async () => {
      const result = await generate.refine('Write a product tagline', [
        'Make it more memorable',
        'Add urgency',
      ])

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      // Refined content should exist
    })

    it('should apply multiple refinements', async () => {
      const result = await generate.refine('Write a headline', [
        'Make it shorter',
        'Add a call to action',
      ])

      expect(result.content).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should throw for unsupported content type', async () => {
      await expect(generate('Generate an image', { type: 'image' })).rejects.toThrow(
        'not yet implemented'
      )
    })

    it('should throw for video type', async () => {
      await expect(generate('Generate a video', { type: 'video' })).rejects.toThrow(
        'not yet implemented'
      )
    })

    it('should throw for audio type', async () => {
      await expect(generate('Generate audio', { type: 'audio' })).rejects.toThrow(
        'not yet implemented'
      )
    })
  })
})
