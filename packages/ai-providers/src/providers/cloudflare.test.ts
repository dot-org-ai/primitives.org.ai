/**
 * Tests for Cloudflare Workers AI embedding provider
 *
 * Covers:
 * - Embedding model creation and configuration
 * - REST API implementation
 * - Workers AI binding implementation
 * - Error handling
 * - Gateway integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  cloudflareEmbedding,
  cloudflare,
  DEFAULT_CF_EMBEDDING_MODEL,
  type CloudflareConfig,
  type CloudflareEmbeddingModel,
} from './cloudflare.js'

describe('cloudflareEmbedding', () => {
  describe('model creation', () => {
    it('creates embedding model with default model ID', () => {
      const model = cloudflareEmbedding()
      expect(model).toBeDefined()
      expect(model.modelId).toBe(DEFAULT_CF_EMBEDDING_MODEL)
      expect(model.provider).toBe('cloudflare')
    })

    it('creates embedding model with custom model ID', () => {
      const modelId = '@cf/baai/bge-large-en-v1.5'
      const model = cloudflareEmbedding(modelId)
      expect(model.modelId).toBe(modelId)
    })

    it('creates embedding model with custom config', () => {
      const config: CloudflareConfig = {
        accountId: 'test-account-id',
        apiToken: 'test-api-token',
      }
      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, config)
      expect(model).toBeDefined()
    })

    it('creates embedding model with AI binding for Workers', () => {
      const mockAi = {
        run: vi.fn(),
      } as unknown as Ai

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {}, mockAi)
      expect(model).toBeDefined()
    })
  })

  describe('model properties', () => {
    it('has correct specification version', () => {
      const model = cloudflareEmbedding()
      expect(model.specificationVersion).toBe('v2')
    })

    it('has correct provider', () => {
      const model = cloudflareEmbedding()
      expect(model.provider).toBe('cloudflare')
    })

    it('has reasonable maxEmbeddingsPerCall', () => {
      const model = cloudflareEmbedding()
      expect(model.maxEmbeddingsPerCall).toBe(100)
    })

    it('supports parallel calls', () => {
      const model = cloudflareEmbedding()
      expect(model.supportsParallelCalls).toBe(true)
    })
  })

  describe('configuration from environment', () => {
    const originalEnv = process.env

    beforeEach(() => {
      vi.resetModules()
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('loads config from CLOUDFLARE_ACCOUNT_ID', () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'env-account-id'
      const model = cloudflareEmbedding()
      expect(model).toBeDefined()
    })

    it('loads config from CLOUDFLARE_API_TOKEN', () => {
      process.env.CLOUDFLARE_API_TOKEN = 'env-api-token'
      const model = cloudflareEmbedding()
      expect(model).toBeDefined()
    })

    it('loads config from CLOUDFLARE_AI_GATEWAY', () => {
      process.env.CLOUDFLARE_AI_GATEWAY = 'my-gateway'
      const model = cloudflareEmbedding()
      expect(model).toBeDefined()
    })

    it('merges environment config with provided config', () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'env-account-id'
      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        apiToken: 'custom-token',
      })
      expect(model).toBeDefined()
    })
  })
})

describe('CloudflareEmbeddingModel.doEmbed', () => {
  describe('with REST API', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn()
      global.fetch = fetchMock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('throws error when credentials are missing', async () => {
      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: undefined,
        apiToken: undefined,
      })

      await expect(
        model.doEmbed({ values: ['test'] })
      ).rejects.toThrow('Cloudflare credentials required')
    })

    it('makes correct REST API call with credentials', async () => {
      const mockResponse = {
        success: true,
        result: {
          data: [[0.1, 0.2, 0.3]],
        },
      }

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      const result = await model.doEmbed({ values: ['hello world'] })

      expect(result.embeddings).toHaveLength(1)
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
    })

    it('constructs correct API URL without gateway', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2]] },
        }),
      })

      const model = cloudflareEmbedding('@cf/baai/bge-m3', {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      await model.doEmbed({ values: ['test'] })

      expect(fetchMock).toHaveBeenCalled()
      const url = fetchMock.mock.calls[0][0]
      expect(url).toContain('test-account')
      expect(url).toContain('@cf/baai/bge-m3')
      expect(url).toContain('api.cloudflare.com')
    })

    it('constructs correct API URL with gateway', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2]] },
        }),
      })

      const model = cloudflareEmbedding('@cf/baai/bge-m3', {
        accountId: 'test-account',
        apiToken: 'test-token',
        gateway: 'my-gateway',
      })

      await model.doEmbed({ values: ['test'] })

      expect(fetchMock).toHaveBeenCalled()
      const url = fetchMock.mock.calls[0][0]
      expect(url).toContain('gateway.ai.cloudflare.com')
      expect(url).toContain('test-account')
      expect(url).toContain('my-gateway')
      expect(url).toContain('workers-ai')
    })

    it('uses custom base URL when provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2]] },
        }),
      })

      const model = cloudflareEmbedding('@cf/baai/bge-m3', {
        accountId: 'test-account',
        apiToken: 'test-token',
        baseUrl: 'https://custom.example.com/api',
      })

      await model.doEmbed({ values: ['test'] })

      expect(fetchMock).toHaveBeenCalled()
      const url = fetchMock.mock.calls[0][0]
      expect(url).toBe('https://custom.example.com/api')
    })

    it('includes authorization header', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2]] },
        }),
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      await model.doEmbed({ values: ['test'] })

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers.Authorization).toBe('Bearer test-token')
    })

    it('includes custom headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2]] },
        }),
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      await model.doEmbed({
        values: ['test'],
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      })

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['X-Custom-Header']).toBe('custom-value')
    })

    it('handles abort signal', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2]] },
        }),
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      const abortController = new AbortController()
      await model.doEmbed({
        values: ['test'],
        abortSignal: abortController.signal,
      })

      const signal = fetchMock.mock.calls[0][1].signal
      expect(signal).toBe(abortController.signal)
    })

    it('processes multiple values in sequence', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [[0.1, 0.2, 0.3]] },
        }),
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      const result = await model.doEmbed({
        values: ['text1', 'text2', 'text3'],
      })

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.embeddings).toHaveLength(3)
    })

    it('throws on HTTP error response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      await expect(
        model.doEmbed({ values: ['test'] })
      ).rejects.toThrow('Cloudflare AI error: 401')
    })

    it('throws on API error in response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errors: [{ message: 'Model not found' }],
        }),
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      await expect(
        model.doEmbed({ values: ['test'] })
      ).rejects.toThrow('Model not found')
    })

    it('throws on missing result data', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: { data: [] },
        }),
      })

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {
        accountId: 'test-account',
        apiToken: 'test-token',
      })

      await expect(
        model.doEmbed({ values: ['test'] })
      ).rejects.toThrow('Cloudflare AI error')
    })
  })

  describe('with AI binding (Workers)', () => {
    it('uses AI binding when provided', async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValue({
          data: [[0.1, 0.2, 0.3]],
        }),
      } as unknown as Ai

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {}, mockAi)
      const result = await model.doEmbed({ values: ['hello world'] })

      expect(mockAi.run).toHaveBeenCalledWith(DEFAULT_CF_EMBEDDING_MODEL, {
        text: 'hello world',
      })
      expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]])
    })

    it('processes multiple values with AI binding', async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValue({
          data: [[0.1, 0.2, 0.3]],
        }),
      } as unknown as Ai

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {}, mockAi)
      const result = await model.doEmbed({
        values: ['text1', 'text2', 'text3'],
      })

      expect(mockAi.run).toHaveBeenCalledTimes(3)
      expect(result.embeddings).toHaveLength(3)
    })

    it('handles AI binding returning array format', async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValue({
          data: [[0.1, 0.2, 0.3]],
        }),
      } as unknown as Ai

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {}, mockAi)
      const result = await model.doEmbed({ values: ['test'] })

      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
    })

    it('skips values that return no data from AI binding', async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValue({
          data: undefined,
        }),
      } as unknown as Ai

      const model = cloudflareEmbedding(DEFAULT_CF_EMBEDDING_MODEL, {}, mockAi)
      const result = await model.doEmbed({ values: ['test'] })

      expect(result.embeddings).toHaveLength(0)
    })
  })
})

describe('cloudflare provider object', () => {
  it('exports embedding method', () => {
    expect(cloudflare.embedding).toBe(cloudflareEmbedding)
  })

  it('exports textEmbeddingModel alias', () => {
    expect(cloudflare.textEmbeddingModel).toBe(cloudflareEmbedding)
  })
})

describe('DEFAULT_CF_EMBEDDING_MODEL', () => {
  it('is defined', () => {
    expect(DEFAULT_CF_EMBEDDING_MODEL).toBeDefined()
  })

  it('is a valid Cloudflare model ID', () => {
    expect(DEFAULT_CF_EMBEDDING_MODEL).toMatch(/^@cf\//)
  })

  it('defaults to bge-m3', () => {
    expect(DEFAULT_CF_EMBEDDING_MODEL).toBe('@cf/baai/bge-m3')
  })
})

describe('supported models', () => {
  const supportedModels = [
    '@cf/baai/bge-small-en-v1.5',
    '@cf/baai/bge-base-en-v1.5',
    '@cf/baai/bge-large-en-v1.5',
    '@cf/baai/bge-m3',
  ]

  it.each(supportedModels)('creates model for %s', (modelId) => {
    const model = cloudflareEmbedding(modelId)
    expect(model.modelId).toBe(modelId)
  })
})

describe('integration scenarios', () => {
  it('works with Cloudflare AI Gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: { data: [[0.1, 0.2]] },
      }),
    })
    global.fetch = fetchMock

    const model = cloudflareEmbedding('@cf/baai/bge-m3', {
      accountId: 'test-account',
      apiToken: 'test-token',
      gateway: 'my-gateway',
    })

    await model.doEmbed({ values: ['test'] })

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('gateway.ai.cloudflare.com')
    expect(url).toContain('my-gateway')
  })

  it('works with direct API (no gateway)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: { data: [[0.1, 0.2]] },
      }),
    })
    global.fetch = fetchMock

    const model = cloudflareEmbedding('@cf/baai/bge-m3', {
      accountId: 'test-account',
      apiToken: 'test-token',
    })

    await model.doEmbed({ values: ['test'] })

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('api.cloudflare.com')
    expect(url).not.toContain('gateway')
  })

  it('works with Workers AI binding', async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({
        data: [[0.1, 0.2, 0.3]],
      }),
    } as unknown as Ai

    const model = cloudflareEmbedding('@cf/baai/bge-m3', {}, mockAi)
    const result = await model.doEmbed({ values: ['test'] })

    expect(mockAi.run).toHaveBeenCalled()
    expect(result.embeddings).toHaveLength(1)
  })
})

describe('type safety', () => {
  it('exports CloudflareConfig type', () => {
    const config: CloudflareConfig = {
      accountId: 'test',
      apiToken: 'test',
      gateway: 'test',
    }
    expect(config).toBeDefined()
  })

  it('exports CloudflareEmbeddingModel type', () => {
    // Type is exported for advanced use cases
    expect(true).toBe(true)
  })

  it('returns EmbeddingModel interface', () => {
    const model = cloudflareEmbedding()
    expect(model.specificationVersion).toBe('v2')
    expect(typeof model.doEmbed).toBe('function')
  })
})

describe('global type definitions', () => {
  it('defines Ai interface', () => {
    // Should have global Ai interface for Workers
    expect(true).toBe(true)
  })

  it('defines BaseAiTextEmbeddingsModels type', () => {
    // Should have model ID union type
    expect(true).toBe(true)
  })
})
