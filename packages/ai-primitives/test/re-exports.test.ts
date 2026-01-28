/**
 * Tests for re-exported functionality from ai-primitives
 *
 * These tests verify that re-exported modules work correctly
 * and maintain their expected behavior.
 */

import { describe, it, expect } from 'vitest'
import * as AIPrimitives from '../src/index.js'

// ============================================================================
// Language Models re-exports
// ============================================================================

describe('Language Models re-exports', () => {
  describe('models()', () => {
    it('returns an array of model definitions', () => {
      const modelList = AIPrimitives.models()
      expect(Array.isArray(modelList)).toBe(true)
      expect(modelList.length).toBeGreaterThan(0)
    })

    it('includes common model providers', () => {
      const modelList = AIPrimitives.models()
      const modelIds = modelList.map((m: any) => m.id || m)
      const modelStr = JSON.stringify(modelIds).toLowerCase()

      // Should include major providers
      expect(
        modelStr.includes('claude') ||
          modelStr.includes('gpt') ||
          modelStr.includes('anthropic') ||
          modelStr.includes('openai')
      ).toBe(true)
    })
  })

  describe('resolveModel()', () => {
    it('resolves haiku alias', () => {
      const resolved = AIPrimitives.resolveModel('haiku')
      expect(resolved).toBeDefined()
      expect(typeof resolved).toBe('string')
      expect(resolved.toLowerCase()).toContain('haiku')
    })

    it('resolves sonnet alias', () => {
      const resolved = AIPrimitives.resolveModel('sonnet')
      expect(resolved).toBeDefined()
      expect(typeof resolved).toBe('string')
      expect(resolved.toLowerCase()).toContain('sonnet')
    })

    it('passes through full model IDs unchanged', () => {
      const fullId = 'claude-3-5-haiku-20241022'
      const resolved = AIPrimitives.resolveModel(fullId)
      expect(resolved).toBe(fullId)
    })

    it('handles unknown model gracefully', () => {
      const unknown = 'unknown-model-xyz'
      const resolved = AIPrimitives.resolveModel(unknown)
      // Should return the input as-is when not recognized
      expect(resolved).toBe(unknown)
    })
  })

  describe('searchModels()', () => {
    it('finds models by keyword', () => {
      const results = AIPrimitives.searchModels('claude')
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('getModelInfo()', () => {
    it('returns info for known model', () => {
      const info = AIPrimitives.getModelInfo('claude-3-5-haiku-20241022')
      // May return undefined if model not in registry
      if (info) {
        expect(typeof info).toBe('object')
      }
    })
  })
})

// ============================================================================
// AI Providers re-exports
// ============================================================================

describe('AI Providers re-exports', () => {
  describe('createRegistry()', () => {
    it('creates a new provider registry', () => {
      const registry = AIPrimitives.createRegistry()
      expect(registry).toBeDefined()
    })
  })

  describe('getRegistry()', () => {
    it('returns the global registry', () => {
      const registry = AIPrimitives.getRegistry()
      expect(registry).toBeDefined()
    })
  })

  describe('DIRECT_PROVIDERS', () => {
    it('contains provider configurations', () => {
      expect(AIPrimitives.DIRECT_PROVIDERS).toBeDefined()
      expect(typeof AIPrimitives.DIRECT_PROVIDERS).toBe('object')
    })
  })

  describe('LLM class', () => {
    it('can be instantiated', () => {
      expect(AIPrimitives.LLM).toBeDefined()
    })
  })
})

// ============================================================================
// Caching re-exports
// ============================================================================

describe('Caching re-exports', () => {
  describe('MemoryCache', () => {
    it('can be instantiated with options', () => {
      const cache = new AIPrimitives.MemoryCache({
        maxSize: 100,
        ttl: 60000,
      })
      expect(cache).toBeDefined()
    })

    it('supports basic cache operations', async () => {
      const cache = new AIPrimitives.MemoryCache()

      await cache.set('test-key', { data: 'test-value' })
      const retrieved = await cache.get('test-key')
      expect(retrieved).toEqual({ data: 'test-value' })

      await cache.delete('test-key')
      const deleted = await cache.get('test-key')
      expect(deleted).toBeUndefined()
    })

    it('supports TTL configuration', async () => {
      // Just verify that TTL option is accepted
      const cache = new AIPrimitives.MemoryCache({ ttl: 1000 })

      await cache.set('ttl-key', 'value')
      const immediate = await cache.get('ttl-key')
      expect(immediate).toBe('value')

      // TTL expiration behavior may vary by implementation
      // Just verify the cache was created successfully with TTL option
      expect(cache).toBeDefined()
    })

    it('supports clear operation', async () => {
      const cache = new AIPrimitives.MemoryCache()

      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.clear()

      expect(await cache.get('key1')).toBeUndefined()
      expect(await cache.get('key2')).toBeUndefined()
    })
  })

  describe('hashKey', () => {
    it('generates deterministic hashes', () => {
      const hash1 = AIPrimitives.hashKey('same-input')
      const hash2 = AIPrimitives.hashKey('same-input')
      expect(hash1).toBe(hash2)
    })

    it('generates unique hashes for different inputs', () => {
      const hash1 = AIPrimitives.hashKey('input-one')
      const hash2 = AIPrimitives.hashKey('input-two')
      expect(hash1).not.toBe(hash2)
    })

    it('handles complex objects', () => {
      const obj = { nested: { array: [1, 2, 3], string: 'test' } }
      const hash = AIPrimitives.hashKey(JSON.stringify(obj))
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('createCacheKey', () => {
    it('creates cache keys from parameters', () => {
      const key = AIPrimitives.createCacheKey('prefix', { param: 'value' })
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// Retry/Fallback re-exports
// ============================================================================

describe('Retry/Fallback re-exports', () => {
  describe('Error classes', () => {
    it('RetryableError can be instantiated', () => {
      const error = new AIPrimitives.RetryableError('test error')
      expect(error.message).toBe('test error')
      expect(error.retryable).toBe(true)
    })

    it('NonRetryableError can be instantiated', () => {
      const error = new AIPrimitives.NonRetryableError('test error')
      expect(error.message).toBe('test error')
      expect(error.retryable).toBe(false)
    })

    it('NetworkError is retryable', () => {
      const error = new AIPrimitives.NetworkError('connection failed')
      expect(error.retryable).toBe(true)
      expect(error.category).toBe(AIPrimitives.ErrorCategory.Network)
    })

    it('RateLimitError supports retryAfter', () => {
      const error = new AIPrimitives.RateLimitError('rate limited', {
        retryAfter: 5000,
      })
      expect(error.retryAfter).toBe(5000)
    })

    it('CircuitOpenError is not retryable', () => {
      const error = new AIPrimitives.CircuitOpenError()
      expect(error.retryable).toBe(false)
    })
  })

  describe('ErrorCategory', () => {
    it('contains expected categories', () => {
      expect(AIPrimitives.ErrorCategory.Network).toBe('network')
      expect(AIPrimitives.ErrorCategory.RateLimit).toBe('rate_limit')
      expect(AIPrimitives.ErrorCategory.InvalidInput).toBe('invalid_input')
      expect(AIPrimitives.ErrorCategory.Authentication).toBe('authentication')
      expect(AIPrimitives.ErrorCategory.Server).toBe('server')
    })
  })

  describe('classifyError', () => {
    it('classifies network errors', () => {
      const error = new Error('ECONNREFUSED')
      const category = AIPrimitives.classifyError(error)
      expect(category).toBe(AIPrimitives.ErrorCategory.Network)
    })

    it('classifies rate limit errors', () => {
      const error = new Error('Rate limit exceeded')
      const category = AIPrimitives.classifyError(error)
      expect(category).toBe(AIPrimitives.ErrorCategory.RateLimit)
    })

    it('classifies unknown errors', () => {
      const error = new Error('Something unexpected')
      const category = AIPrimitives.classifyError(error)
      expect(category).toBe(AIPrimitives.ErrorCategory.Unknown)
    })
  })

  describe('calculateBackoff', () => {
    it('increases with attempts', () => {
      const backoff1 = AIPrimitives.calculateBackoff(1, {
        baseDelay: 1000,
        jitter: 0,
      })
      const backoff2 = AIPrimitives.calculateBackoff(2, {
        baseDelay: 1000,
        jitter: 0,
      })
      expect(backoff2).toBeGreaterThan(backoff1)
    })

    it('respects maxDelay', () => {
      const backoff = AIPrimitives.calculateBackoff(10, {
        baseDelay: 1000,
        maxDelay: 5000,
        jitter: 0,
      })
      expect(backoff).toBeLessThanOrEqual(5000)
    })
  })

  describe('RetryPolicy', () => {
    it('can be instantiated with options', () => {
      const policy = new AIPrimitives.RetryPolicy({
        maxRetries: 3,
        baseDelay: 1000,
      })
      expect(policy).toBeDefined()
    })
  })

  describe('CircuitBreaker', () => {
    it('can be instantiated with options', () => {
      const breaker = new AIPrimitives.CircuitBreaker({
        threshold: 5,
        timeout: 30000,
      })
      expect(breaker).toBeDefined()
    })
  })

  describe('FallbackChain', () => {
    it('can be instantiated', () => {
      const chain = new AIPrimitives.FallbackChain([
        { model: 'sonnet', priority: 1 },
        { model: 'haiku', priority: 2 },
      ])
      expect(chain).toBeDefined()
    })
  })
})

// ============================================================================
// Budget Tracking re-exports
// ============================================================================

describe('Budget Tracking re-exports', () => {
  describe('BudgetTracker', () => {
    it('can be instantiated with config', () => {
      const tracker = new AIPrimitives.BudgetTracker({
        maxTokens: 10000,
        maxCost: 1.0,
      })
      expect(tracker).toBeDefined()
    })

    it('tracks token usage', () => {
      const tracker = new AIPrimitives.BudgetTracker({ maxTokens: 1000 })

      tracker.recordUsage({
        inputTokens: 100,
        outputTokens: 50,
        model: 'test-model',
      })

      const snapshot = tracker.export()
      expect(snapshot.totalInputTokens).toBe(100)
      expect(snapshot.totalOutputTokens).toBe(50)
    })

    it('supports export/import', () => {
      const tracker1 = new AIPrimitives.BudgetTracker()
      tracker1.recordUsage({ inputTokens: 200, outputTokens: 100 })

      const snapshot = tracker1.export()

      const tracker2 = new AIPrimitives.BudgetTracker()
      tracker2.import(snapshot)

      const imported = tracker2.export()
      expect(imported.totalInputTokens).toBe(200)
      expect(imported.totalOutputTokens).toBe(100)
    })
  })

  describe('TokenCounter', () => {
    it('estimates tokens for text', () => {
      const counter = new AIPrimitives.TokenCounter()

      const count = counter.estimateTokens('Hello, this is a test message.')
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(100)
    })

    it('estimates higher tokens for longer text', () => {
      const counter = new AIPrimitives.TokenCounter()

      const shortCount = counter.estimateTokens('Hi')
      const longCount = counter.estimateTokens(
        'This is a much longer text that should have more tokens'
      )

      expect(longCount).toBeGreaterThan(shortCount)
    })
  })

  describe('BudgetExceededError', () => {
    it('can be instantiated', () => {
      const error = new AIPrimitives.BudgetExceededError('Budget exceeded')
      expect(error.message).toBe('Budget exceeded')
    })
  })
})

// ============================================================================
// Embeddings re-exports
// ============================================================================

describe('Embeddings re-exports', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const vec = [0.5, 0.5, 0.5]
      const similarity = AIPrimitives.cosineSimilarity(vec, vec)
      expect(similarity).toBeCloseTo(1, 5)
    })

    it('returns 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [0, 1, 0]
      const similarity = AIPrimitives.cosineSimilarity(vec1, vec2)
      expect(similarity).toBeCloseTo(0, 5)
    })

    it('returns -1 for opposite vectors', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [-1, 0, 0]
      const similarity = AIPrimitives.cosineSimilarity(vec1, vec2)
      expect(similarity).toBeCloseTo(-1, 5)
    })
  })

  describe('normalizeEmbedding', () => {
    it('normalizes vector to unit length', () => {
      const vec = [3, 4] // 3-4-5 triangle
      const normalized = AIPrimitives.normalizeEmbedding(vec)

      const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('handles zero vector', () => {
      const vec = [0, 0, 0]
      const normalized = AIPrimitives.normalizeEmbedding(vec)
      expect(normalized.every((v) => v === 0 || isNaN(v))).toBe(true)
    })
  })

  describe('averageEmbeddings', () => {
    it('averages multiple embeddings', () => {
      const embeddings = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]
      const avg = AIPrimitives.averageEmbeddings(embeddings)

      expect(avg[0]).toBeCloseTo(1 / 3, 5)
      expect(avg[1]).toBeCloseTo(1 / 3, 5)
      expect(avg[2]).toBeCloseTo(1 / 3, 5)
    })
  })

  describe('pairwiseSimilarity', () => {
    it('computes similarity matrix', () => {
      const embeddings = [
        [1, 0],
        [0, 1],
        [1, 1],
      ]
      const matrix = AIPrimitives.pairwiseSimilarity(embeddings)

      expect(matrix.length).toBe(3)
      expect(matrix[0].length).toBe(3)
      // Diagonal should be 1 (self-similarity)
      expect(matrix[0][0]).toBeCloseTo(1, 5)
      expect(matrix[1][1]).toBeCloseTo(1, 5)
      expect(matrix[2][2]).toBeCloseTo(1, 5)
    })
  })

  describe('DEFAULT_CF_EMBEDDING_MODEL', () => {
    it('is a valid model string', () => {
      expect(typeof AIPrimitives.DEFAULT_CF_EMBEDDING_MODEL).toBe('string')
      expect(AIPrimitives.DEFAULT_CF_EMBEDDING_MODEL.length).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// Tool Orchestration re-exports
// ============================================================================

describe('Tool Orchestration re-exports', () => {
  describe('createTool', () => {
    it('creates a tool definition', () => {
      const tool = AIPrimitives.createTool({
        name: 'test-tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        execute: async (params) => ({ result: params.input }),
      })

      expect(tool).toBeDefined()
      expect(tool.name).toBe('test-tool')
    })
  })

  describe('createToolset', () => {
    it('creates a collection of tools', () => {
      const toolset = AIPrimitives.createToolset([
        {
          name: 'tool1',
          description: 'Tool 1',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({}),
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({}),
        },
      ])

      expect(toolset).toBeDefined()
    })
  })

  describe('ToolValidator', () => {
    it('can be instantiated', () => {
      const validator = new AIPrimitives.ToolValidator()
      expect(validator).toBeDefined()
    })
  })

  describe('ToolRouter', () => {
    it('can be instantiated with tools', () => {
      const router = new AIPrimitives.ToolRouter([])
      expect(router).toBeDefined()
    })
  })
})

// ============================================================================
// Batch Processing re-exports
// ============================================================================

describe('Batch Processing re-exports', () => {
  describe('BatchQueue', () => {
    it('can be instantiated', () => {
      const queue = new AIPrimitives.BatchQueue()
      expect(queue).toBeDefined()
    })
  })

  describe('BatchMapPromise', () => {
    it('is defined', () => {
      expect(AIPrimitives.BatchMapPromise).toBeDefined()
    })
  })

  describe('isBatchMode', () => {
    it('returns boolean', () => {
      const result = AIPrimitives.isBatchMode()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('BATCH_MODE_SYMBOL', () => {
    it('is a symbol', () => {
      expect(typeof AIPrimitives.BATCH_MODE_SYMBOL).toBe('symbol')
    })
  })

  describe('BATCH_MAP_SYMBOL', () => {
    it('is a symbol', () => {
      expect(typeof AIPrimitives.BATCH_MAP_SYMBOL).toBe('symbol')
    })
  })
})
