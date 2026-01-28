/**
 * Tests for image() - Image generation primitive
 *
 * The image() function provides image generation with rich metadata
 * about the generation process. It returns ImageResult with URL,
 * prompt, and metadata (model, size, style, duration).
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL and OPENAI_API_KEY are not configured.
 */

import { describe, it, expect } from 'vitest'
import { image } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.IMAGE_GATEWAY_URL
const hasOpenAI = !!process.env.OPENAI_API_KEY

describe('image() - Image Generation Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(image).toBeDefined()
      expect(typeof image).toBe('function')
    })

    it('should have variations method', () => {
      expect(image.variations).toBeDefined()
      expect(typeof image.variations).toBe('function')
    })

    it('should have edit method', () => {
      expect(image.edit).toBeDefined()
      expect(typeof image.edit).toBe('function')
    })

    it('should have upscale method', () => {
      expect(image.upscale).toBeDefined()
      expect(typeof image.upscale).toBe('function')
    })

    it('should have style method', () => {
      expect(image.style).toBeDefined()
      expect(typeof image.style).toBe('function')
    })

    it('should have batch method', () => {
      expect(image.batch).toBeDefined()
      expect(typeof image.batch).toBe('function')
    })

    it('should have aspectRatio method', () => {
      expect(image.aspectRatio).toBeDefined()
      expect(typeof image.aspectRatio).toBe('function')
    })

    it('style method should return a function', () => {
      const cinematicGenerator = image.style('cinematic')
      expect(typeof cinematicGenerator).toBe('function')
    })

    it('style method should work with all style presets', () => {
      const styles = [
        'realistic',
        'artistic',
        'cartoon',
        'abstract',
        'photographic',
        'digital-art',
        'cinematic',
      ] as const

      styles.forEach((style) => {
        const styledGenerator = image.style(style)
        expect(typeof styledGenerator).toBe('function')
      })
    })
  })

  describe.skipIf(!hasGateway || !hasOpenAI)(
    'Integration Tests (with AI) - Basic Generation',
    () => {
      it('should generate an image from a prompt', async () => {
        const result = await image('A simple red circle on white background', {
          size: '256x256',
        })

        expect(result).toBeDefined()
        expect(result.url).toBeDefined()
        expect(typeof result.url).toBe('string')
        expect(result.url.length).toBeGreaterThan(0)
        expect(result.prompt).toBe('A simple red circle on white background')
        expect(result.metadata).toBeDefined()
        expect(result.metadata.model).toBeDefined()
        expect(result.metadata.size).toBe('256x256')
      }, 60000) // 60 second timeout for image generation

      it('should include duration in metadata', async () => {
        const result = await image('A blue square', {
          size: '256x256',
        })

        expect(result.metadata.duration).toBeDefined()
        expect(typeof result.metadata.duration).toBe('number')
        expect(result.metadata.duration).toBeGreaterThan(0)
      }, 60000)

      it('should support style option', async () => {
        const result = await image('A mountain landscape', {
          style: 'artistic',
          size: '256x256',
        })

        expect(result).toBeDefined()
        expect(result.url).toBeDefined()
        expect(result.metadata.style).toBe('artistic')
      }, 60000)

      it('should support different sizes', async () => {
        const sizes = ['256x256', '512x512', '1024x1024'] as const

        for (const size of sizes) {
          const result = await image('A green triangle', { size })
          expect(result.metadata.size).toBe(size)
        }
      }, 180000) // 3 minutes for multiple generations

      it('should return revised prompt when model modifies it', async () => {
        const result = await image('A sunset', {
          model: 'dall-e-3',
          size: '1024x1024',
        })

        // DALL-E 3 typically revises prompts
        expect(result.revisedPrompt).toBeDefined()
      }, 60000)
    }
  )

  describe.skipIf(!hasGateway || !hasOpenAI)('Integration Tests (with AI) - Style Presets', () => {
    it('should generate realistic style image', async () => {
      const result = await image('A coffee cup on a table', {
        style: 'realistic',
        size: '256x256',
      })

      expect(result.url).toBeDefined()
      expect(result.metadata.style).toBe('realistic')
    }, 60000)

    it('should generate cartoon style image', async () => {
      const result = await image('A happy dog', {
        style: 'cartoon',
        size: '256x256',
      })

      expect(result.url).toBeDefined()
      expect(result.metadata.style).toBe('cartoon')
    }, 60000)

    it('should generate abstract style image', async () => {
      const result = await image('Emotions and feelings', {
        style: 'abstract',
        size: '256x256',
      })

      expect(result.url).toBeDefined()
      expect(result.metadata.style).toBe('abstract')
    }, 60000)

    it('should generate cinematic style image', async () => {
      const result = await image('A hero standing on a cliff', {
        style: 'cinematic',
        size: '256x256',
      })

      expect(result.url).toBeDefined()
      expect(result.metadata.style).toBe('cinematic')
    }, 60000)
  })

  describe.skipIf(!hasGateway || !hasOpenAI)(
    'Integration Tests (with AI) - Styled Generator',
    () => {
      it('should create styled generator with image.style()', async () => {
        const cartoonImage = image.style('cartoon')

        const result = await cartoonImage('A friendly robot', {
          size: '256x256',
        })

        expect(result).toBeDefined()
        expect(result.url).toBeDefined()
        expect(result.metadata.style).toBe('cartoon')
      }, 60000)

      it('should work with multiple styled generators', async () => {
        const realisticGen = image.style('realistic')
        const abstractGen = image.style('abstract')

        const [realistic, abstract] = await Promise.all([
          realisticGen('A flower', { size: '256x256' }),
          abstractGen('A flower', { size: '256x256' }),
        ])

        expect(realistic.metadata.style).toBe('realistic')
        expect(abstract.metadata.style).toBe('abstract')
      }, 120000)
    }
  )

  describe.skipIf(!hasGateway || !hasOpenAI)(
    'Integration Tests (with AI) - Batch Generation',
    () => {
      it('should generate multiple images in batch', async () => {
        const prompts = ['A red apple', 'A blue berry', 'A yellow banana']

        const results = await image.batch(prompts, {
          size: '256x256',
        })

        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBe(3)

        results.forEach((result, index) => {
          expect(result.url).toBeDefined()
          expect(result.prompt).toBe(prompts[index])
        })
      }, 180000)

      it('should apply shared options to all images in batch', async () => {
        const results = await image.batch(['A cat', 'A dog'], {
          style: 'cartoon',
          size: '256x256',
        })

        results.forEach((result) => {
          expect(result.metadata.style).toBe('cartoon')
          expect(result.metadata.size).toBe('256x256')
        })
      }, 120000)
    }
  )

  describe.skipIf(!hasGateway || !hasOpenAI)('Integration Tests (with AI) - Aspect Ratio', () => {
    it('should generate square image', async () => {
      const result = await image.aspectRatio('A landscape scene', 'square')

      expect(result.url).toBeDefined()
      expect(result.metadata.size).toBe('1024x1024')
    }, 60000)

    it('should generate portrait image', async () => {
      const result = await image.aspectRatio('A portrait of a person', 'portrait')

      expect(result.url).toBeDefined()
      expect(result.metadata.size).toBe('1024x1792')
    }, 60000)

    it('should generate landscape image', async () => {
      const result = await image.aspectRatio('A wide mountain range', 'landscape')

      expect(result.url).toBeDefined()
      expect(result.metadata.size).toBe('1792x1024')
    }, 60000)
  })

  describe.skipIf(!hasGateway || !hasOpenAI)('Integration Tests (with AI) - Variations', () => {
    it('should generate variations of an image', async () => {
      // First generate a source image
      const source = await image('A simple geometric shape', {
        size: '256x256',
        model: 'dall-e-2', // Variations work with DALL-E 2
      })

      expect(source.url).toBeDefined()

      // Then generate variations
      const variations = await image.variations(source.url, {
        count: 2,
        size: '256x256',
      })

      expect(variations).toBeDefined()
      expect(Array.isArray(variations)).toBe(true)
      expect(variations.length).toBe(2)

      variations.forEach((variation) => {
        expect(variation.url).toBeDefined()
        expect(variation.metadata.model).toBeDefined()
      })
    }, 180000)
  })

  describe.skipIf(!hasGateway || !hasOpenAI)('Integration Tests (with AI) - Editing', () => {
    it('should edit an image with a prompt', async () => {
      // First generate a source image
      const source = await image('A room with a blank wall', {
        size: '256x256',
        model: 'dall-e-2', // Edits work with DALL-E 2
      })

      expect(source.url).toBeDefined()

      // Edit the image
      const edited = await image.edit(source.url, {
        prompt: 'Add a colorful painting on the wall',
        size: '256x256',
      })

      expect(edited).toBeDefined()
      expect(edited.url).toBeDefined()
      expect(edited.prompt).toBe('Add a colorful painting on the wall')
      expect(edited.metadata.duration).toBeGreaterThan(0)
    }, 180000)
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Upscaling', () => {
    it('should upscale an image', async () => {
      // First generate a small source image
      const source = await image('A detailed flower', {
        size: '256x256',
      })

      expect(source.url).toBeDefined()

      // Upscale it
      const upscaled = await image.upscale(source.url, {
        scale: 2,
      })

      expect(upscaled).toBeDefined()
      expect(upscaled.url).toBeDefined()
      expect(upscaled.scaleFactor).toBe(2)
      expect(upscaled.upscaledSize.width).toBeGreaterThan(upscaled.originalSize.width)
      expect(upscaled.upscaledSize.height).toBeGreaterThan(upscaled.originalSize.height)
    }, 180000)
  })

  describe('Error Handling', () => {
    it('should throw error for invalid image URL format in variations', async () => {
      await expect(image.variations('not-a-valid-url', { count: 2 })).rejects.toThrow(
        'Invalid image URL format'
      )
    })

    it('should throw error for invalid image URL format in edit', async () => {
      await expect(image.edit('not-a-valid-url', { prompt: 'test' })).rejects.toThrow(
        'Invalid image URL format'
      )
    })
  })

  describe('Type Safety', () => {
    it('should accept valid ImageOptions', () => {
      const options: Parameters<typeof image>[1] = {
        style: 'realistic',
        size: '1024x1024',
        model: 'dall-e-3',
        quality: 'hd',
        format: 'url',
      }

      expect(options.style).toBe('realistic')
      expect(options.size).toBe('1024x1024')
    })

    it('should accept valid VariationOptions', () => {
      const options: Parameters<typeof image.variations>[1] = {
        count: 3,
        size: '512x512',
        format: 'url',
      }

      expect(options.count).toBe(3)
    })

    it('should accept valid EditOptions', () => {
      const options: Parameters<typeof image.edit>[1] = {
        prompt: 'Add a rainbow',
        mask: 'https://example.com/mask.png',
        size: '512x512',
      }

      expect(options.prompt).toBe('Add a rainbow')
    })

    it('should accept valid UpscaleOptions', () => {
      const options: Parameters<typeof image.upscale>[1] = {
        scale: 4,
        model: 'real-esrgan',
        denoise: 0.5,
      }

      expect(options.scale).toBe(4)
    })
  })
})
