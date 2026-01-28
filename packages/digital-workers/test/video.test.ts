/**
 * Tests for video() - Video generation primitive
 *
 * The video() function provides AI-powered video generation with rich metadata
 * about the generation process. It supports multiple models (Runway, Pika, etc.)
 * and includes helper methods for image-to-video, extension, editing, and styling.
 *
 * These tests verify the structure and exports. Integration tests with actual
 * video generation require provider API access and are skipped when unavailable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Import directly from video.ts for tests to work independently of build status
import { video } from '../src/video.js'
import type {
  VideoOptions,
  VideoResult,
  VideoResolution,
  VideoAspectRatio,
  VideoModel,
  VideoStyle,
  VideoMetadata,
} from '../src/video.js'

// Mock fetch for unit tests
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('video() - Video Generation Primitive', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Unit Tests - Exports and Structure', () => {
    it('should be exported from index', () => {
      expect(video).toBeDefined()
      expect(typeof video).toBe('function')
    })

    it('should have fromImage method', () => {
      expect(video.fromImage).toBeDefined()
      expect(typeof video.fromImage).toBe('function')
    })

    it('should have extend method', () => {
      expect(video.extend).toBeDefined()
      expect(typeof video.extend).toBe('function')
    })

    it('should have edit method', () => {
      expect(video.edit).toBeDefined()
      expect(typeof video.edit).toBe('function')
    })

    it('should have style method', () => {
      expect(video.style).toBeDefined()
      expect(typeof video.style).toBe('function')
    })

    it('should have variations method', () => {
      expect(video.variations).toBeDefined()
      expect(typeof video.variations).toBe('function')
    })

    it('should have withMotion method', () => {
      expect(video.withMotion).toBeDefined()
      expect(typeof video.withMotion).toBe('function')
    })

    it('should have loop method', () => {
      expect(video.loop).toBeDefined()
      expect(typeof video.loop).toBe('function')
    })
  })

  describe('Unit Tests - video() function', () => {
    it('should call video worker with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://example.com/video.mp4',
          thumbnail: 'https://example.com/thumb.jpg',
        }),
      })

      const result = await video('A sunset over the ocean')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('video.workers.do'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.prompt).toBe('A sunset over the ocean')
      expect(body.duration).toBe(4)
      expect(body.fps).toBe(24)
      expect(body.resolution).toBe('1080p')
    })

    it('should return VideoResult with correct structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://example.com/video.mp4',
          thumbnail: 'https://example.com/thumb.jpg',
          fileSize: 1024000,
          format: 'mp4',
          seed: 12345,
        }),
      })

      const result = await video('Test prompt')

      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('prompt')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('status')

      expect(result.url).toBe('https://example.com/video.mp4')
      expect(result.prompt).toBe('Test prompt')
      expect(result.status).toBe('completed')

      expect(result.metadata).toHaveProperty('model')
      expect(result.metadata).toHaveProperty('duration')
      expect(result.metadata).toHaveProperty('resolution')
      expect(result.metadata).toHaveProperty('fps')
      expect(result.metadata).toHaveProperty('aspectRatio')
      expect(result.metadata).toHaveProperty('generationTime')
    })

    it('should accept all VideoOptions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      await video('A cinematic scene', {
        duration: 8,
        fps: 30,
        resolution: '4k',
        aspectRatio: '21:9',
        style: 'cinematic',
        model: 'runway-gen3',
        negativePrompt: 'blurry, distorted',
        guidance: 12,
        seed: 42,
        motion: 'dolly',
        motionIntensity: 0.7,
        loop: true,
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.duration).toBe(8)
      expect(body.fps).toBe(30)
      expect(body.resolution).toBe('4k')
      expect(body.aspectRatio).toBe('21:9')
      expect(body.style).toBe('cinematic')
      expect(body.model).toBe('runway-gen3')
      expect(body.negativePrompt).toBe('blurry, distorted')
      expect(body.guidance).toBe(12)
      expect(body.seed).toBe(42)
      expect(body.motion).toBe('dolly')
      expect(body.motionIntensity).toBe(0.7)
      expect(body.loop).toBe(true)
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })

      const result = await video('Test prompt')

      expect(result.status).toBe('failed')
      expect(result.error).toContain('500')
      expect(result.url).toBe('')
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await video('Test prompt')

      expect(result.status).toBe('failed')
      expect(result.error).toBe('Network error')
      expect(result.url).toBe('')
    })
  })

  describe('Unit Tests - video.fromImage()', () => {
    it('should send image-to-video request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/animated.mp4' }),
      })

      const result = await video.fromImage(
        'https://example.com/image.jpg',
        'Animate the clouds moving'
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.mode).toBe('image-to-video')
      expect(body.imageUrl).toBe('https://example.com/image.jpg')
      expect(body.prompt).toBe('Animate the clouds moving')
    })

    it('should support imageFidelity option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/animated.mp4' }),
      })

      await video.fromImage('https://example.com/image.jpg', 'Animate', { imageFidelity: 0.9 })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.imageFidelity).toBe(0.9)
    })
  })

  describe('Unit Tests - video.extend()', () => {
    it('should send extension request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://example.com/extended.mp4',
          totalDuration: 10,
        }),
      })

      const result = await video.extend('https://example.com/original.mp4', 4)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.mode).toBe('extend')
      expect(body.videoUrl).toBe('https://example.com/original.mp4')
      expect(body.duration).toBe(4)
    })

    it('should support direction option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/extended.mp4' }),
      })

      await video.extend('https://example.com/original.mp4', 4, {
        direction: 'backward',
        prompt: 'Show what happened before',
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.direction).toBe('backward')
      expect(body.prompt).toBe('Show what happened before')
    })
  })

  describe('Unit Tests - video.edit()', () => {
    it('should send edit request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/edited.mp4' }),
      })

      const result = await video.edit(
        'https://example.com/original.mp4',
        'Make it look like vintage film'
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.mode).toBe('edit')
      expect(body.videoUrl).toBe('https://example.com/original.mp4')
      expect(body.prompt).toBe('Make it look like vintage film')
    })

    it('should support mask and region options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/edited.mp4' }),
      })

      await video.edit('https://example.com/original.mp4', 'Replace the background', {
        maskUrl: 'https://example.com/mask.png',
        region: { x: 0, y: 0, width: 100, height: 100 },
        strength: 0.9,
        preserveAudio: false,
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.maskUrl).toBe('https://example.com/mask.png')
      expect(body.region).toEqual({ x: 0, y: 0, width: 100, height: 100 })
      expect(body.strength).toBe(0.9)
      expect(body.preserveAudio).toBe(false)
    })
  })

  describe('Unit Tests - video.style()', () => {
    it('should return a styled video generator', () => {
      const cinematicVideo = video.style('cinematic')
      expect(typeof cinematicVideo).toBe('function')
    })

    it('should apply style to generated videos', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      const animeVideo = video.style('anime')
      await animeVideo('A magical transformation sequence')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.style).toBe('anime')
    })

    it('should allow additional options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      const noirVideo = video.style('noir')
      await noirVideo('A detective in a dark alley', { duration: 10, resolution: '4k' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.style).toBe('noir')
      expect(body.duration).toBe(10)
      expect(body.resolution).toBe('4k')
    })
  })

  describe('Unit Tests - video.variations()', () => {
    it('should generate multiple variations', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://example.com/video1.mp4' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://example.com/video2.mp4' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://example.com/video3.mp4' }),
        })

      const results = await video.variations('A cat playing', 3)

      expect(results).toHaveLength(3)
      expect(mockFetch).toHaveBeenCalledTimes(3)

      // Each call should have a different seed
      const seeds = mockFetch.mock.calls.map((call) => JSON.parse(call[1].body).seed)
      expect(new Set(seeds).size).toBe(3) // All unique seeds
    })

    it('should respect provided seed and increment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      await video.variations('Test', 3, { seed: 100 })

      const seeds = mockFetch.mock.calls.map((call) => JSON.parse(call[1].body).seed)
      expect(seeds).toEqual([100, 101, 102])
    })
  })

  describe('Unit Tests - video.withMotion()', () => {
    it('should apply motion type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      await video.withMotion('A beautiful landscape', 'pan')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.motion).toBe('pan')
    })

    it('should accept motion intensity option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      await video.withMotion('A city skyline', 'orbit', { motionIntensity: 0.3 })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.motion).toBe('orbit')
      expect(body.motionIntensity).toBe(0.3)
    })
  })

  describe('Unit Tests - video.loop()', () => {
    it('should set loop to true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      await video.loop('Swaying grass')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.loop).toBe(true)
    })
  })

  describe('Type Safety Tests', () => {
    it('should accept valid resolution types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      const resolutions: VideoResolution[] = ['480p', '720p', '1080p', '4k']
      for (const resolution of resolutions) {
        await video('Test', { resolution })
      }
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('should accept valid aspect ratios', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      const ratios: VideoAspectRatio[] = ['16:9', '9:16', '1:1', '4:3', '21:9']
      for (const aspectRatio of ratios) {
        await video('Test', { aspectRatio })
      }
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('should accept valid model types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      const models: VideoModel[] = [
        'runway-gen3',
        'runway-gen2',
        'pika-1.0',
        'pika-1.5',
        'stable-video',
        'minimax',
        'kling',
        'luma',
      ]
      for (const model of models) {
        await video('Test', { model })
      }
      expect(mockFetch).toHaveBeenCalledTimes(8)
    })

    it('should accept valid style presets', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/video.mp4' }),
      })

      const styles: VideoStyle[] = [
        'cinematic',
        'anime',
        'realistic',
        'cartoon',
        'documentary',
        'vintage',
        'noir',
        'fantasy',
        'sci-fi',
      ]
      for (const style of styles) {
        await video('Test', { style })
      }
      expect(mockFetch).toHaveBeenCalledTimes(9)
    })
  })

  describe('Metadata Tests', () => {
    it('should include all expected metadata fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://example.com/video.mp4',
          fileSize: 2048000,
          format: 'webm',
          seed: 54321,
          cost: 0.05,
        }),
      })

      const result = await video('Test prompt', {
        style: 'cinematic',
        duration: 6,
        fps: 30,
        resolution: '4k',
        aspectRatio: '21:9',
        model: 'runway-gen3',
      })

      const { metadata } = result
      expect(metadata.model).toBe('runway-gen3')
      expect(metadata.duration).toBe(6)
      expect(metadata.resolution).toBe('4k')
      expect(metadata.fps).toBe(30)
      expect(metadata.aspectRatio).toBe('21:9')
      expect(metadata.style).toBe('cinematic')
      expect(metadata.fileSize).toBe(2048000)
      expect(metadata.format).toBe('webm')
      expect(metadata.seed).toBe(54321)
      expect(metadata.cost).toBe(0.05)
      expect(typeof metadata.generationTime).toBe('number')
      expect(metadata.generationTime).toBeGreaterThanOrEqual(0)
    })
  })
})
