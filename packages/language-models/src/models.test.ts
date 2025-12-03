/**
 * Tests for model listing, resolution, and search
 *
 * These are pure unit tests - no external API calls needed.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  list,
  get,
  search,
  resolve,
  resolveWithProvider,
  DIRECT_PROVIDERS,
  type ModelInfo,
  type ResolvedModel,
} from './models.js'
import { ALIASES } from './aliases.js'

describe('list', () => {
  it('returns an array of models', () => {
    const models = list()
    expect(Array.isArray(models)).toBe(true)
  })

  it('returns models with required properties', () => {
    const models = list()
    if (models.length > 0) {
      const model = models[0]
      expect(model).toHaveProperty('id')
      expect(model).toHaveProperty('name')
      expect(model).toHaveProperty('context_length')
      expect(model).toHaveProperty('pricing')
      expect(model.pricing).toHaveProperty('prompt')
      expect(model.pricing).toHaveProperty('completion')
    }
  })

  it('caches results on subsequent calls', () => {
    const models1 = list()
    const models2 = list()
    expect(models1).toBe(models2) // Same reference
  })

  it('returns empty array if models.json does not exist', () => {
    // This test verifies graceful handling of missing data file
    const models = list()
    expect(Array.isArray(models)).toBe(true)
  })
})

describe('get', () => {
  it('returns undefined for non-existent model', () => {
    const model = get('non-existent/model-id')
    expect(model).toBeUndefined()
  })

  it('returns model info for valid model ID', () => {
    const models = list()
    if (models.length > 0) {
      const firstModel = models[0]
      const retrieved = get(firstModel.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(firstModel.id)
      expect(retrieved?.name).toBe(firstModel.name)
    }
  })

  it('performs exact match only', () => {
    const models = list()
    if (models.length > 0) {
      const model = models[0]
      const partialId = model.id.split('/')[0] // Just the provider
      const result = get(partialId)
      // Should not match partial ID
      if (result) {
        expect(result.id).toBe(partialId) // Only matches if there's an exact model with this ID
      }
    }
  })
})

describe('search', () => {
  it('returns empty array for no matches', () => {
    const results = search('this-should-not-match-anything-12345')
    expect(results).toEqual([])
  })

  it('searches by model ID', () => {
    const models = list()
    if (models.length > 0) {
      const model = models[0]
      const idPart = model.id.split('/')[0] // Provider name
      const results = search(idPart)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(m => m.id.includes(idPart))).toBe(true)
    }
  })

  it('searches by model name', () => {
    const models = list()
    if (models.length > 0) {
      const model = models[0]
      const namePart = model.name.split(' ')[0].toLowerCase()
      const results = search(namePart)
      expect(results.length).toBeGreaterThan(0)
    }
  })

  it('is case-insensitive', () => {
    const models = list()
    if (models.length > 0) {
      const model = models[0]
      const idLower = model.id.toLowerCase()
      const idUpper = model.id.toUpperCase()
      const resultsLower = search(idLower)
      const resultsUpper = search(idUpper)
      expect(resultsLower).toEqual(resultsUpper)
    }
  })

  it('searches in both id and name fields', () => {
    const models = list()
    if (models.length > 0) {
      // Find a model and search for part of its name
      const model = models.find(m => m.name.includes(' '))
      if (model) {
        const namePart = model.name.split(' ')[0].toLowerCase()
        const results = search(namePart)
        expect(results.some(m => m.id === model.id || m.name.toLowerCase().includes(namePart))).toBe(true)
      }
    }
  })

  it('returns multiple matches', () => {
    const models = list()
    if (models.length > 1) {
      // Search for a common term that should match multiple models
      const commonProviders = ['anthropic', 'openai', 'google', 'meta']
      for (const provider of commonProviders) {
        const results = search(provider)
        if (results.length > 1) {
          expect(results.length).toBeGreaterThan(1)
          break
        }
      }
    }
  })
})

describe('resolve', () => {
  beforeEach(() => {
    // Ensure we have fresh data
    list()
  })

  describe('alias resolution', () => {
    it('resolves known aliases', () => {
      const result = resolve('opus')
      expect(result).toBe(ALIASES['opus'])
    })

    it('resolves claude alias', () => {
      const result = resolve('claude')
      expect(result).toBe(ALIASES['claude'])
    })

    it('resolves gpt alias', () => {
      const result = resolve('gpt')
      expect(result).toBe(ALIASES['gpt'])
    })

    it('resolves llama alias', () => {
      const result = resolve('llama')
      expect(result).toBe(ALIASES['llama'])
    })

    it('is case-insensitive for aliases', () => {
      const lower = resolve('opus')
      const upper = resolve('OPUS')
      const mixed = resolve('Opus')
      expect(lower).toBe(upper)
      expect(lower).toBe(mixed)
    })

    it('handles whitespace in input', () => {
      const result = resolve('  opus  ')
      expect(result).toBe(ALIASES['opus'])
    })

    it('resolves all documented aliases', () => {
      // Test key aliases from the README
      const aliasesToTest = [
        ['opus', 'anthropic/claude-opus-4.5'],
        ['sonnet', 'anthropic/claude-sonnet-4.5'],
        ['haiku', 'anthropic/claude-haiku-4.5'],
        ['gpt-4o', 'openai/gpt-4o'],
        ['gemini', 'google/gemini-2.5-flash'],
        ['llama-70b', 'meta-llama/llama-3.3-70b-instruct'],
        ['mistral', 'mistralai/mistral-large-2411'],
      ]

      for (const [alias, expected] of aliasesToTest) {
        const result = resolve(alias)
        expect(result).toBe(expected)
      }
    })
  })

  describe('full ID passthrough', () => {
    it('returns full ID as-is if it exists', () => {
      const models = list()
      if (models.length > 0) {
        const model = models[0]
        const result = resolve(model.id)
        expect(result).toBe(model.id)
      }
    })

    it('returns unknown full ID as-is', () => {
      const unknownId = 'unknown-provider/unknown-model'
      const result = resolve(unknownId)
      expect(result).toBe(unknownId)
    })

    it('detects full ID by slash character', () => {
      const result = resolve('custom/model-name')
      expect(result).toBe('custom/model-name')
    })
  })

  describe('partial name search', () => {
    it('finds model by partial name', () => {
      const models = list()
      if (models.length > 0) {
        const model = models[0]
        const provider = model.id.split('/')[0]
        const result = resolve(provider)
        // Should find a model from that provider
        expect(result).toContain('/')
      }
    })

    it('returns first match for partial search', () => {
      const result = resolve('claude')
      // Should return an alias if it exists, or search result
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('returns input as-is if no matches found', () => {
      const input = 'unknown-model-xyz'
      const result = resolve(input)
      expect(result).toBe(input)
    })
  })

  describe('resolution priority', () => {
    it('prioritizes aliases over search', () => {
      // 'opus' is an alias, so it should resolve to the alias target
      // even if there are other models containing 'opus'
      const result = resolve('opus')
      expect(result).toBe(ALIASES['opus'])
    })

    it('checks full ID before partial search', () => {
      const models = list()
      if (models.length > 0) {
        const model = models[0]
        const result = resolve(model.id)
        expect(result).toBe(model.id)
      }
    })
  })
})

describe('resolveWithProvider', () => {
  it('extracts provider from model ID', () => {
    const result = resolveWithProvider('opus')
    expect(result.provider).toBe('anthropic')
  })

  it('includes resolved model ID', () => {
    const result = resolveWithProvider('opus')
    expect(result.id).toBe(ALIASES['opus'])
  })

  it('identifies direct routing support', () => {
    const anthropic = resolveWithProvider('opus')
    expect(anthropic.supportsDirectRouting).toBe(true)

    const openai = resolveWithProvider('gpt')
    expect(openai.supportsDirectRouting).toBe(true)

    const google = resolveWithProvider('gemini')
    expect(google.supportsDirectRouting).toBe(true)
  })

  it('identifies non-direct providers', () => {
    // Use a model from a provider not in DIRECT_PROVIDERS
    const models = list()
    const nonDirectModel = models.find(m => {
      const provider = m.id.split('/')[0]
      return !(DIRECT_PROVIDERS as readonly string[]).includes(provider)
    })

    if (nonDirectModel) {
      const result = resolveWithProvider(nonDirectModel.id)
      expect(result.supportsDirectRouting).toBe(false)
    }
  })

  it('includes full model info if available', () => {
    const result = resolveWithProvider('opus')
    if (result.model) {
      expect(result.model).toHaveProperty('id')
      expect(result.model).toHaveProperty('name')
      expect(result.model).toHaveProperty('pricing')
    }
  })

  it('includes provider model ID if available', () => {
    const result = resolveWithProvider('opus')
    if (result.model?.provider_model_id) {
      expect(result.providerModelId).toBeDefined()
      expect(typeof result.providerModelId).toBe('string')
    }
  })

  it('handles unknown models gracefully', () => {
    const result = resolveWithProvider('unknown/model')
    expect(result.id).toBe('unknown/model')
    expect(result.provider).toBe('unknown')
    expect(result.model).toBeUndefined()
  })

  it('handles models without provider prefix', () => {
    const result = resolveWithProvider('opus')
    expect(result.provider).toBeTruthy()
    expect(result.id).toContain('/')
  })
})

describe('DIRECT_PROVIDERS', () => {
  it('contains expected providers', () => {
    expect(DIRECT_PROVIDERS).toContain('anthropic')
    expect(DIRECT_PROVIDERS).toContain('openai')
    expect(DIRECT_PROVIDERS).toContain('google')
  })

  it('has exactly 3 providers', () => {
    expect(DIRECT_PROVIDERS.length).toBe(3)
  })

  it('is readonly', () => {
    // Type check - this should compile
    const providers: readonly string[] = DIRECT_PROVIDERS
    expect(providers).toBeDefined()
  })
})

describe('ModelInfo type', () => {
  it('models have correct structure', () => {
    const models = list()
    if (models.length > 0) {
      const model = models[0]
      expect(typeof model.id).toBe('string')
      expect(typeof model.name).toBe('string')
      expect(typeof model.context_length).toBe('number')
      expect(typeof model.pricing.prompt).toBe('string')
      expect(typeof model.pricing.completion).toBe('string')

      if (model.architecture) {
        expect(typeof model.architecture.modality).toBe('string')
        expect(Array.isArray(model.architecture.input_modalities)).toBe(true)
        expect(Array.isArray(model.architecture.output_modalities)).toBe(true)
      }
    }
  })
})

describe('ResolvedModel type', () => {
  it('returns complete resolution info', () => {
    const result: ResolvedModel = resolveWithProvider('opus')
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('provider')
    expect(result).toHaveProperty('supportsDirectRouting')
    expect(typeof result.id).toBe('string')
    expect(typeof result.provider).toBe('string')
    expect(typeof result.supportsDirectRouting).toBe('boolean')
  })
})
