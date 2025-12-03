/**
 * Integration tests for the language-models package
 *
 * These tests verify the public API exports and end-to-end functionality.
 */

import { describe, it, expect } from 'vitest'
import {
  resolve,
  resolveWithProvider,
  list,
  get,
  search,
  DIRECT_PROVIDERS,
  ALIASES,
  type ModelInfo,
  type ProviderEndpoint,
  type ResolvedModel,
  type DirectProvider,
} from './index.js'

describe('package exports', () => {
  it('exports resolve function', () => {
    expect(typeof resolve).toBe('function')
  })

  it('exports resolveWithProvider function', () => {
    expect(typeof resolveWithProvider).toBe('function')
  })

  it('exports list function', () => {
    expect(typeof list).toBe('function')
  })

  it('exports get function', () => {
    expect(typeof get).toBe('function')
  })

  it('exports search function', () => {
    expect(typeof search).toBe('function')
  })

  it('exports DIRECT_PROVIDERS constant', () => {
    expect(DIRECT_PROVIDERS).toBeDefined()
    expect(Array.isArray(DIRECT_PROVIDERS)).toBe(true)
  })

  it('exports ALIASES constant', () => {
    expect(ALIASES).toBeDefined()
    expect(typeof ALIASES).toBe('object')
  })
})

describe('type exports', () => {
  it('ModelInfo type is available', () => {
    // Type check - if this compiles, the type is exported correctly
    const model: ModelInfo = {
      id: 'test/model',
      name: 'Test Model',
      context_length: 8192,
      pricing: {
        prompt: '0',
        completion: '0',
      },
    }
    expect(model).toBeDefined()
  })

  it('ProviderEndpoint type is available', () => {
    const endpoint: ProviderEndpoint = {
      baseUrl: 'https://api.example.com',
      modelId: 'test-model-id',
    }
    expect(endpoint).toBeDefined()
  })

  it('ResolvedModel type is available', () => {
    const resolved: ResolvedModel = {
      id: 'test/model',
      provider: 'test',
      supportsDirectRouting: false,
    }
    expect(resolved).toBeDefined()
  })

  it('DirectProvider type is available', () => {
    const provider: DirectProvider = 'anthropic'
    expect(provider).toBeDefined()
  })
})

describe('end-to-end workflows', () => {
  describe('simple alias resolution', () => {
    it('resolves opus and gets model info', () => {
      const modelId = resolve('opus')
      expect(modelId).toBe('anthropic/claude-opus-4.5')

      const model = get(modelId)
      if (model) {
        expect(model.id).toBe(modelId)
        expect(model.name).toContain('Claude')
      }
    })

    it('resolves gpt and gets model info', () => {
      const modelId = resolve('gpt')
      expect(modelId).toBe('openai/gpt-4o')

      const model = get(modelId)
      if (model) {
        expect(model.id).toBe(modelId)
        expect(model.name).toContain('GPT')
      }
    })
  })

  describe('advanced resolution with provider info', () => {
    it('resolves opus with full provider details', () => {
      const resolved = resolveWithProvider('opus')

      expect(resolved.id).toBe('anthropic/claude-opus-4.5')
      expect(resolved.provider).toBe('anthropic')
      expect(resolved.supportsDirectRouting).toBe(true)

      if (resolved.model) {
        expect(resolved.model.name).toBeTruthy()
        expect(resolved.model.context_length).toBeGreaterThan(0)
      }
    })

    it('resolves with provider model ID if available', () => {
      const resolved = resolveWithProvider('opus')
      if (resolved.model?.provider_model_id) {
        expect(resolved.providerModelId).toBe(resolved.model.provider_model_id)
      }
    })
  })

  describe('search and select workflow', () => {
    it('searches for claude models and selects one', () => {
      const matches = search('claude')
      expect(matches.length).toBeGreaterThan(0)

      const first = matches[0]
      expect(first.id).toContain('/')
      expect(first.name).toBeTruthy()

      const retrieved = get(first.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(first.id)
    })

    it('searches for openai models', () => {
      const matches = search('openai')
      expect(matches.length).toBeGreaterThan(0)

      for (const model of matches) {
        expect(model.id).toContain('openai/')
      }
    })
  })

  describe('listing and filtering', () => {
    it('lists all models and filters by provider', () => {
      const allModels = list()
      expect(allModels.length).toBeGreaterThanOrEqual(0)

      if (allModels.length > 0) {
        const anthropicModels = allModels.filter(m => m.id.startsWith('anthropic/'))
        const openaiModels = allModels.filter(m => m.id.startsWith('openai/'))

        if (anthropicModels.length > 0) {
          expect(anthropicModels[0].id).toContain('anthropic/')
        }
        if (openaiModels.length > 0) {
          expect(openaiModels[0].id).toContain('openai/')
        }
      }
    })

    it('lists models and checks for direct routing', () => {
      const allModels = list()

      if (allModels.length > 0) {
        const directModels = allModels.filter(m => {
          const provider = m.id.split('/')[0]
          return (DIRECT_PROVIDERS as readonly string[]).includes(provider)
        })

        for (const model of directModels) {
          const resolved = resolveWithProvider(model.id)
          expect(resolved.supportsDirectRouting).toBe(true)
        }
      }
    })
  })

  describe('case insensitivity', () => {
    it('resolves aliases case-insensitively', () => {
      const lower = resolve('opus')
      const upper = resolve('OPUS')
      const mixed = resolve('OpUs')

      expect(lower).toBe(upper)
      expect(lower).toBe(mixed)
    })

    it('searches case-insensitively', () => {
      const lower = search('claude')
      const upper = search('CLAUDE')

      expect(lower).toEqual(upper)
    })
  })

  describe('unknown inputs', () => {
    it('handles unknown alias gracefully', () => {
      const result = resolve('unknown-alias-xyz')
      expect(result).toBe('unknown-alias-xyz')
    })

    it('handles unknown model ID gracefully', () => {
      const model = get('unknown/model-id')
      expect(model).toBeUndefined()
    })

    it('handles unknown search gracefully', () => {
      const results = search('this-should-not-exist-xyz123')
      expect(results).toEqual([])
    })

    it('resolves unknown with provider info', () => {
      const resolved = resolveWithProvider('unknown/model')
      expect(resolved.id).toBe('unknown/model')
      expect(resolved.provider).toBe('unknown')
      expect(resolved.model).toBeUndefined()
    })
  })

  describe('README examples', () => {
    it('works with README quick start examples', () => {
      // Examples from README.md Quick Start section
      const opus = resolve('opus')
      expect(opus).toBe('anthropic/claude-opus-4.5')

      const gpt4o = resolve('gpt-4o')
      expect(gpt4o).toBe('openai/gpt-4o')

      const llama70b = resolve('llama-70b')
      expect(llama70b).toBe('meta-llama/llama-3.3-70b-instruct')

      const mistral = resolve('mistral')
      expect(mistral).toBe('mistralai/mistral-large-2411')
    })

    it('works with README API examples', () => {
      // Examples from README.md API section
      const opus = resolve('opus')
      expect(opus).toBe('anthropic/claude-opus-4.5')

      const sonnet = resolve('sonnet')
      expect(sonnet).toBe('anthropic/claude-sonnet-4.5')

      const gpt = resolve('gpt')
      expect(gpt).toBe('openai/gpt-4o')

      const llama = resolve('llama')
      expect(llama).toBe('meta-llama/llama-4-maverick')

      // Pass-through example
      const fullId = resolve('anthropic/claude-opus-4.5')
      expect(fullId).toBe('anthropic/claude-opus-4.5')
    })

    it('list returns array as shown in README', () => {
      const models = list()
      expect(Array.isArray(models)).toBe(true)
    })

    it('search returns matching models as shown in README', () => {
      const claudeModels = search('claude')
      expect(Array.isArray(claudeModels)).toBe(true)
      if (claudeModels.length > 0) {
        expect(
          claudeModels.some(m =>
            m.id.includes('claude') || m.name.toLowerCase().includes('claude')
          )
        ).toBe(true)
      }
    })
  })

  describe('data directory integration', () => {
    it('loads models from data/models.json', () => {
      const models = list()
      // Should load from data directory, even if empty
      expect(Array.isArray(models)).toBe(true)
    })

    it('handles missing data file gracefully', () => {
      // Even without data/models.json, functions should not throw
      expect(() => list()).not.toThrow()
      expect(() => get('test/model')).not.toThrow()
      expect(() => search('test')).not.toThrow()
    })
  })

  describe('model metadata completeness', () => {
    it('models have pricing information', () => {
      const models = list()
      if (models.length > 0) {
        const model = models[0]
        expect(model.pricing).toBeDefined()
        expect(model.pricing.prompt).toBeDefined()
        expect(model.pricing.completion).toBeDefined()
      }
    })

    it('models have context length', () => {
      const models = list()
      if (models.length > 0) {
        for (const model of models.slice(0, 5)) {
          expect(typeof model.context_length).toBe('number')
          expect(model.context_length).toBeGreaterThan(0)
        }
      }
    })

    it('models may have architecture info', () => {
      const models = list()
      if (models.length > 0) {
        const modelWithArch = models.find(m => m.architecture)
        if (modelWithArch?.architecture) {
          expect(modelWithArch.architecture.modality).toBeDefined()
          expect(Array.isArray(modelWithArch.architecture.input_modalities)).toBe(true)
          expect(Array.isArray(modelWithArch.architecture.output_modalities)).toBe(true)
        }
      }
    })
  })

  describe('provider routing', () => {
    it('correctly identifies direct routing providers', () => {
      const directProviders = ['anthropic', 'openai', 'google']

      for (const provider of directProviders) {
        const models = list().filter(m => m.id.startsWith(`${provider}/`))
        if (models.length > 0) {
          const resolved = resolveWithProvider(models[0].id)
          expect(resolved.supportsDirectRouting).toBe(true)
          expect(resolved.provider).toBe(provider)
        }
      }
    })

    it('identifies non-direct routing providers', () => {
      const models = list()
      const nonDirectModel = models.find(m => {
        const provider = m.id.split('/')[0]
        return !(DIRECT_PROVIDERS as readonly string[]).includes(provider)
      })

      if (nonDirectModel) {
        const resolved = resolveWithProvider(nonDirectModel.id)
        expect(resolved.supportsDirectRouting).toBe(false)
      }
    })
  })
})

describe('consistency checks', () => {
  it('all aliases resolve to valid format', () => {
    for (const [alias, modelId] of Object.entries(ALIASES)) {
      expect(modelId).toContain('/')
      const [provider, model] = modelId.split('/')
      expect(provider.length).toBeGreaterThan(0)
      expect(model.length).toBeGreaterThan(0)
    }
  })

  it('resolve and resolveWithProvider are consistent', () => {
    const testCases = ['opus', 'gpt', 'gemini', 'llama']

    for (const alias of testCases) {
      const simpleResolve = resolve(alias)
      const fullResolve = resolveWithProvider(alias)

      expect(fullResolve.id).toBe(simpleResolve)
    }
  })

  it('search results are all valid models', () => {
    const results = search('claude')
    for (const model of results) {
      const retrieved = get(model.id)
      // All search results should be retrievable
      expect(retrieved?.id).toBe(model.id)
    }
  })
})
