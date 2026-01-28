/**
 * Worker tests for ai-providers - RED phase
 *
 * Tests the /worker export which provides ProviderService as a WorkerEntrypoint.
 * Uses @cloudflare/vitest-pool-workers for real Workers environment testing.
 *
 * NO MOCKS - tests use real AI Gateway binding for cached responses.
 *
 * These tests will FAIL until src/worker.ts is implemented (GREEN phase).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { env } from 'cloudflare:test'

// These imports will fail until worker.ts is implemented
// Note: Using .ts extension for source imports in test files
import { ProviderService, ProviderServiceCore } from '../src/worker'

describe('ProviderServiceCore (RpcTarget)', () => {
  let core: ProviderServiceCore

  beforeAll(() => {
    core = new ProviderServiceCore(env)
  })

  describe('constructor', () => {
    it('creates a new ProviderServiceCore instance', () => {
      expect(core).toBeInstanceOf(ProviderServiceCore)
    })

    it('accepts env with AI binding', () => {
      const serviceWithEnv = new ProviderServiceCore(env)
      expect(serviceWithEnv).toBeDefined()
    })
  })

  describe('model()', () => {
    it('returns a LanguageModel from the registry', async () => {
      const m = await core.model('anthropic:claude-sonnet-4-20250514')
      expect(m).toBeDefined()
      expect(m.modelId).toBe('claude-sonnet-4-20250514')
      expect(m.provider).toContain('anthropic')
    })

    it('resolves model aliases', async () => {
      const m = await core.model('sonnet')
      expect(m).toBeDefined()
    })

    it('routes to direct providers correctly', async () => {
      const openai = await core.model('openai:gpt-4o')
      expect(openai).toBeDefined()
      expect(openai.provider).toContain('openai')
    })

    it('routes to openrouter for other providers', async () => {
      const meta = await core.model('meta-llama/llama-3.3-70b-instruct')
      expect(meta).toBeDefined()
    })
  })

  describe('embeddingModel()', () => {
    it('returns an EmbeddingModel from the registry', async () => {
      const em = await core.embeddingModel('openai:text-embedding-3-small')
      expect(em).toBeDefined()
      expect(em.modelId).toBe('text-embedding-3-small')
      expect(em.provider).toContain('openai')
    })

    it('supports Cloudflare embedding models via AI binding', async () => {
      const cfEmbed = await core.embeddingModel('cloudflare:@cf/baai/bge-m3')
      expect(cfEmbed).toBeDefined()
      expect(cfEmbed.provider).toBe('cloudflare')
    })
  })

  describe('listProviders()', () => {
    it('returns array of available provider IDs', async () => {
      const providers = await core.listProviders()
      expect(Array.isArray(providers)).toBe(true)
      expect(providers).toContain('openai')
      expect(providers).toContain('anthropic')
      expect(providers).toContain('google')
      expect(providers).toContain('openrouter')
      expect(providers).toContain('cloudflare')
    })

    it('returns at least 5 providers', async () => {
      const providers = await core.listProviders()
      expect(providers.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('getRegistry()', () => {
    it('returns the provider registry', async () => {
      const registry = await core.getRegistry()
      expect(registry).toBeDefined()
      expect(typeof registry.languageModel).toBe('function')
      expect(typeof registry.textEmbeddingModel).toBe('function')
    })

    it('returns same registry instance on multiple calls', async () => {
      const registry1 = await core.getRegistry()
      const registry2 = await core.getRegistry()
      expect(registry1).toBe(registry2)
    })
  })
})

describe('ProviderService (WorkerEntrypoint)', () => {
  it('exports ProviderService class', () => {
    expect(ProviderService).toBeDefined()
    expect(typeof ProviderService).toBe('function')
  })

  it('ProviderService has connect method in prototype', () => {
    expect(typeof ProviderService.prototype.connect).toBe('function')
  })

  describe('connect()', () => {
    it('returns a ProviderServiceCore instance', () => {
      // Create a mock context to instantiate ProviderService
      const service = new ProviderService({ env } as any, {} as any)
      const core = service.connect()
      expect(core).toBeInstanceOf(ProviderServiceCore)
    })

    it('returns RpcTarget that can be used over RPC', () => {
      const service = new ProviderService({ env } as any, {} as any)
      const core = service.connect()
      // RpcTarget instances should have these characteristics
      expect(core).toBeDefined()
      expect(typeof core.model).toBe('function')
      expect(typeof core.embeddingModel).toBe('function')
      expect(typeof core.listProviders).toBe('function')
      expect(typeof core.getRegistry).toBe('function')
    })
  })
})

describe('Default export', () => {
  it('exports ProviderService as default', async () => {
    const { default: DefaultExport } = await import('../src/worker')
    expect(DefaultExport).toBe(ProviderService)
  })
})

describe('Real AI Gateway integration', () => {
  let core: ProviderServiceCore

  beforeAll(() => {
    core = new ProviderServiceCore(env)
  })

  it('can access AI Gateway through env binding', () => {
    // env.AI should be available in workers environment
    expect(env).toBeDefined()
  })

  it('model() works with real gateway (cached response)', async () => {
    // This test uses a real AI Gateway call
    // The gateway should cache responses for repeated calls
    const m = await core.model('anthropic:claude-sonnet-4-20250514')
    expect(m).toBeDefined()
    expect(m.specificationVersion).toBe('v2')
  })

  it('embeddingModel() works with AI binding', async () => {
    // Uses Cloudflare AI binding for embeddings
    const em = await core.embeddingModel('cloudflare:@cf/baai/bge-m3')
    expect(em).toBeDefined()
    expect(em.maxEmbeddingsPerCall).toBeGreaterThan(0)
  })
})
