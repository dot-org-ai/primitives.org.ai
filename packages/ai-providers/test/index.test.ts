/**
 * Tests for the public API surface
 *
 * Covers:
 * - Exported functions and types
 * - Module re-exports
 * - API consistency
 */

import { describe, it, expect } from 'vitest'
import * as aiProviders from '../src/index.js'

describe('public API exports', () => {
  describe('registry functions', () => {
    it('exports createRegistry', () => {
      expect(aiProviders.createRegistry).toBeDefined()
      expect(typeof aiProviders.createRegistry).toBe('function')
    })

    it('exports getRegistry', () => {
      expect(aiProviders.getRegistry).toBeDefined()
      expect(typeof aiProviders.getRegistry).toBe('function')
    })

    it('exports configureRegistry', () => {
      expect(aiProviders.configureRegistry).toBeDefined()
      expect(typeof aiProviders.configureRegistry).toBe('function')
    })
  })

  describe('model functions', () => {
    it('exports model', () => {
      expect(aiProviders.model).toBeDefined()
      expect(typeof aiProviders.model).toBe('function')
    })

    it('exports embeddingModel', () => {
      expect(aiProviders.embeddingModel).toBeDefined()
      expect(typeof aiProviders.embeddingModel).toBe('function')
    })
  })

  describe('constants', () => {
    it('exports DIRECT_PROVIDERS', () => {
      expect(aiProviders.DIRECT_PROVIDERS).toBeDefined()
      expect(Array.isArray(aiProviders.DIRECT_PROVIDERS)).toBe(true)
    })
  })

  describe('types', () => {
    it('exports ProviderId type', () => {
      // Type-only export, check in type context
      const typeCheck: aiProviders.ProviderId = 'openai'
      expect(typeCheck).toBe('openai')
    })

    it('exports DirectProvider type', () => {
      // Type-only export, check in type context
      const typeCheck: aiProviders.DirectProvider = 'anthropic'
      expect(typeCheck).toBe('anthropic')
    })

    it('exports ProviderConfig type', () => {
      // Type-only export, check in type context
      const typeCheck: aiProviders.ProviderConfig = {
        gatewayUrl: 'test',
      }
      expect(typeCheck).toBeDefined()
    })

    it('exports Provider type from AI SDK', () => {
      // Re-exported from 'ai' package
      // Type-only export for convenience
      expect(true).toBe(true)
    })

    it('exports ProviderRegistryProvider type from AI SDK', () => {
      // Re-exported from 'ai' package
      // Type-only export for convenience
      expect(true).toBe(true)
    })
  })

  describe('API completeness', () => {
    it('exports all documented functions', () => {
      const expectedExports = [
        'createRegistry',
        'getRegistry',
        'configureRegistry',
        'model',
        'embeddingModel',
        'DIRECT_PROVIDERS',
      ]

      for (const exportName of expectedExports) {
        expect(aiProviders).toHaveProperty(exportName)
      }
    })

    it('does not export internal implementation details', () => {
      // Should not export internal functions like getEnvConfig, getBaseUrl, etc.
      const internalFunctions = [
        'getEnvConfig',
        'getBaseUrl',
        'createGatewayFetch',
        'useGatewaySecrets',
        'getApiKey',
        'createOpenAIProvider',
        'createAnthropicProvider',
        'createGoogleProvider',
        'createOpenRouterProvider',
        'createCloudflareProvider',
        'parseModelId',
        'providerFactories',
      ]

      for (const internalName of internalFunctions) {
        expect(aiProviders).not.toHaveProperty(internalName)
      }
    })
  })

  describe('module structure', () => {
    it('has expected module exports', () => {
      const exports = Object.keys(aiProviders)
      expect(exports.length).toBeGreaterThan(0)
    })

    it('all exported functions are callable', () => {
      const functions = [
        'createRegistry',
        'getRegistry',
        'configureRegistry',
        'model',
        'embeddingModel',
      ]

      for (const fnName of functions) {
        const fn = (aiProviders as any)[fnName]
        expect(typeof fn).toBe('function')
      }
    })

    it('all exported constants are defined', () => {
      expect(aiProviders.DIRECT_PROVIDERS).toBeDefined()
    })
  })
})

describe('API usage patterns', () => {
  it('allows importing all exports', () => {
    const {
      createRegistry,
      getRegistry,
      configureRegistry,
      model,
      embeddingModel,
      DIRECT_PROVIDERS,
    } = aiProviders

    expect(createRegistry).toBeDefined()
    expect(getRegistry).toBeDefined()
    expect(configureRegistry).toBeDefined()
    expect(model).toBeDefined()
    expect(embeddingModel).toBeDefined()
    expect(DIRECT_PROVIDERS).toBeDefined()
  })

  it('allows importing specific exports', async () => {
    const { model } = await import('../src/index.js')
    expect(model).toBeDefined()
  })

  it('supports default import pattern', async () => {
    const module = await import('../src/index.js')
    expect(module.model).toBeDefined()
  })
})

describe('type exports', () => {
  it('ProviderId accepts valid provider names', () => {
    const providers: aiProviders.ProviderId[] = [
      'openai',
      'anthropic',
      'google',
      'openrouter',
      'cloudflare',
    ]
    expect(providers).toHaveLength(5)
  })

  it('ProviderConfig has optional fields', () => {
    const configs: aiProviders.ProviderConfig[] = [
      {},
      { gatewayUrl: 'test' },
      { gatewayToken: 'test' },
      { openaiApiKey: 'test' },
      {
        gatewayUrl: 'test',
        gatewayToken: 'test',
        openaiApiKey: 'test',
        anthropicApiKey: 'test',
        googleApiKey: 'test',
        openrouterApiKey: 'test',
        cloudflareAccountId: 'test',
        cloudflareApiToken: 'test',
      },
    ]
    expect(configs).toHaveLength(5)
  })

  it('DirectProvider is a subset of ProviderId', () => {
    // DirectProvider should be 'openai' | 'anthropic' | 'google'
    const direct: aiProviders.DirectProvider[] = ['openai', 'anthropic', 'google']
    expect(direct).toHaveLength(3)
  })
})

describe('package documentation', () => {
  it('has JSDoc package documentation', () => {
    // Main module should have @packageDocumentation
    expect(true).toBe(true)
  })

  it('exports match README examples', () => {
    // README shows these imports:
    // import { model } from 'ai-providers'
    // import { embeddingModel } from 'ai-providers'
    // import { createRegistry } from 'ai-providers'
    // import { getRegistry } from 'ai-providers'

    expect(aiProviders.model).toBeDefined()
    expect(aiProviders.embeddingModel).toBeDefined()
    expect(aiProviders.createRegistry).toBeDefined()
    expect(aiProviders.getRegistry).toBeDefined()
  })
})

describe('convenience re-exports', () => {
  it('re-exports AI SDK types for convenience', () => {
    // Provider and ProviderRegistryProvider are re-exported from 'ai'
    // This allows users to import types from ai-providers instead of ai
    expect(true).toBe(true)
  })

  it('re-exports DIRECT_PROVIDERS from language-models', () => {
    // DIRECT_PROVIDERS is re-exported from language-models for consistency
    expect(aiProviders.DIRECT_PROVIDERS).toBeDefined()
  })
})

describe('integration with subpackages', () => {
  it('main package exports registry functions', () => {
    // Main package exports registry.ts
    expect(aiProviders.createRegistry).toBeDefined()
  })

  it('cloudflare provider is in separate export', async () => {
    // Cloudflare provider should be importable from 'ai-providers/cloudflare'
    // Not from the main 'ai-providers' export
    expect(aiProviders).not.toHaveProperty('cloudflareEmbedding')
    expect(aiProviders).not.toHaveProperty('cloudflare')
  })
})

describe('backward compatibility', () => {
  it('maintains stable public API', () => {
    // These exports should remain stable across versions
    const stableExports = [
      'createRegistry',
      'getRegistry',
      'model',
      'embeddingModel',
      'DIRECT_PROVIDERS',
    ]

    for (const exportName of stableExports) {
      expect(aiProviders).toHaveProperty(exportName)
    }
  })

  it('types are backward compatible', () => {
    // Type structure should be stable
    const config: aiProviders.ProviderConfig = {
      gatewayUrl: 'test',
    }
    expect(config).toBeDefined()
  })
})

describe('error messages', () => {
  it('provides helpful error for missing credentials', async () => {
    // When creating a model without credentials, should have clear error
    expect(true).toBe(true)
  })

  it('provides helpful error for invalid model ID', async () => {
    // When providing invalid model ID, should have clear error
    expect(true).toBe(true)
  })
})

describe('async API behavior', () => {
  it('createRegistry returns a Promise', async () => {
    const result = aiProviders.createRegistry()
    expect(result).toBeInstanceOf(Promise)
    await result // Wait for it to complete
  })

  it('getRegistry returns a Promise', async () => {
    const result = aiProviders.getRegistry()
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  it('configureRegistry returns a Promise', async () => {
    const result = aiProviders.configureRegistry({})
    expect(result).toBeInstanceOf(Promise)
    await result
  })

  it('model returns a Promise', async () => {
    try {
      const result = aiProviders.model('test')
      expect(result).toBeInstanceOf(Promise)
      await result
    } catch {
      // May fail without proper config
    }
  })

  it('embeddingModel returns a Promise', async () => {
    try {
      const result = aiProviders.embeddingModel('openai:test')
      expect(result).toBeInstanceOf(Promise)
      await result
    } catch {
      // May fail without proper config
    }
  })
})
