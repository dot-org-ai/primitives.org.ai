/**
 * Tests for model aliases
 *
 * These tests verify the alias mapping and ensure all documented
 * aliases are present and correctly mapped.
 */

import { describe, it, expect } from 'vitest'
import { ALIASES } from '../src/aliases.js'

describe('ALIASES', () => {
  it('is an object', () => {
    expect(typeof ALIASES).toBe('object')
    expect(ALIASES).not.toBeNull()
  })

  it('has string keys and values', () => {
    for (const [key, value] of Object.entries(ALIASES)) {
      expect(typeof key).toBe('string')
      expect(typeof value).toBe('string')
    }
  })

  it('has no empty keys or values', () => {
    for (const [key, value] of Object.entries(ALIASES)) {
      expect(key.length).toBeGreaterThan(0)
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('all values are valid model IDs with provider prefix', () => {
    for (const [key, value] of Object.entries(ALIASES)) {
      expect(value).toContain('/')
      const [provider, modelName] = value.split('/')
      expect(provider.length).toBeGreaterThan(0)
      expect(modelName.length).toBeGreaterThan(0)
    }
  })

  describe('Claude (Anthropic) aliases', () => {
    it('has opus alias', () => {
      expect(ALIASES['opus']).toBe('anthropic/claude-opus-4.5')
    })

    it('has sonnet alias', () => {
      expect(ALIASES['sonnet']).toBe('anthropic/claude-sonnet-4.5')
    })

    it('has haiku alias', () => {
      expect(ALIASES['haiku']).toBe('anthropic/claude-haiku-4.5')
    })

    it('has claude default alias', () => {
      expect(ALIASES['claude']).toBe('anthropic/claude-sonnet-4.5')
    })

    it('claude aliases point to anthropic provider', () => {
      expect(ALIASES['opus']).toContain('anthropic/')
      expect(ALIASES['sonnet']).toContain('anthropic/')
      expect(ALIASES['haiku']).toContain('anthropic/')
      expect(ALIASES['claude']).toContain('anthropic/')
    })
  })

  describe('GPT (OpenAI) aliases', () => {
    it('has gpt alias', () => {
      expect(ALIASES['gpt']).toBe('openai/gpt-4o')
    })

    it('has gpt-4o alias', () => {
      expect(ALIASES['gpt-4o']).toBe('openai/gpt-4o')
    })

    it('has gpt-4o-mini alias', () => {
      expect(ALIASES['gpt-4o-mini']).toBe('openai/gpt-4o-mini')
    })

    it('has 4o shorthand', () => {
      expect(ALIASES['4o']).toBe('openai/gpt-4o')
    })

    it('has o1 alias', () => {
      expect(ALIASES['o1']).toBe('openai/o1')
    })

    it('has o3 alias', () => {
      expect(ALIASES['o3']).toBe('openai/o3')
    })

    it('has o3-mini alias', () => {
      expect(ALIASES['o3-mini']).toBe('openai/o3-mini')
    })

    it('has o4-mini alias', () => {
      expect(ALIASES['o4-mini']).toBe('openai/o4-mini')
    })

    it('openai aliases point to openai provider', () => {
      expect(ALIASES['gpt']).toContain('openai/')
      expect(ALIASES['gpt-4o']).toContain('openai/')
      expect(ALIASES['4o']).toContain('openai/')
      expect(ALIASES['o1']).toContain('openai/')
      expect(ALIASES['o3']).toContain('openai/')
    })
  })

  describe('Gemini (Google) aliases', () => {
    it('has gemini alias', () => {
      expect(ALIASES['gemini']).toBe('google/gemini-2.5-flash')
    })

    it('has flash alias', () => {
      expect(ALIASES['flash']).toBe('google/gemini-2.5-flash')
    })

    it('has gemini-flash alias', () => {
      expect(ALIASES['gemini-flash']).toBe('google/gemini-2.5-flash')
    })

    it('has gemini-pro alias', () => {
      expect(ALIASES['gemini-pro']).toBe('google/gemini-2.5-pro')
    })

    it('google aliases point to google provider', () => {
      expect(ALIASES['gemini']).toContain('google/')
      expect(ALIASES['flash']).toContain('google/')
      expect(ALIASES['gemini-flash']).toContain('google/')
      expect(ALIASES['gemini-pro']).toContain('google/')
    })
  })

  describe('Llama (Meta) aliases', () => {
    it('has llama alias', () => {
      expect(ALIASES['llama']).toBe('meta-llama/llama-4-maverick')
    })

    it('has llama-4 alias', () => {
      expect(ALIASES['llama-4']).toBe('meta-llama/llama-4-maverick')
    })

    it('has llama-70b alias', () => {
      expect(ALIASES['llama-70b']).toBe('meta-llama/llama-3.3-70b-instruct')
    })

    it('llama aliases point to meta-llama provider', () => {
      expect(ALIASES['llama']).toContain('meta-llama/')
      expect(ALIASES['llama-4']).toContain('meta-llama/')
      expect(ALIASES['llama-70b']).toContain('meta-llama/')
    })
  })

  describe('DeepSeek aliases', () => {
    it('has deepseek alias', () => {
      expect(ALIASES['deepseek']).toBe('deepseek/deepseek-chat')
    })

    it('has r1 alias', () => {
      expect(ALIASES['r1']).toBe('deepseek/deepseek-r1')
    })

    it('deepseek aliases point to deepseek provider', () => {
      expect(ALIASES['deepseek']).toContain('deepseek/')
      expect(ALIASES['r1']).toContain('deepseek/')
    })
  })

  describe('Mistral aliases', () => {
    it('has mistral alias', () => {
      expect(ALIASES['mistral']).toBe('mistralai/mistral-large-2411')
    })

    it('has codestral alias', () => {
      expect(ALIASES['codestral']).toBe('mistralai/codestral-2501')
    })

    it('mistral aliases point to mistralai provider', () => {
      expect(ALIASES['mistral']).toContain('mistralai/')
      expect(ALIASES['codestral']).toContain('mistralai/')
    })
  })

  describe('Qwen aliases', () => {
    it('has qwen alias', () => {
      expect(ALIASES['qwen']).toBe('qwen/qwen3-235b-a22b')
    })

    it('qwen alias points to qwen provider', () => {
      expect(ALIASES['qwen']).toContain('qwen/')
    })
  })

  describe('Grok (X.AI) aliases', () => {
    it('has grok alias', () => {
      expect(ALIASES['grok']).toBe('x-ai/grok-3')
    })

    it('grok alias points to x-ai provider', () => {
      expect(ALIASES['grok']).toContain('x-ai/')
    })
  })

  describe('Perplexity aliases', () => {
    it('has sonar alias', () => {
      expect(ALIASES['sonar']).toBe('perplexity/sonar-pro')
    })

    it('sonar alias points to perplexity provider', () => {
      expect(ALIASES['sonar']).toContain('perplexity/')
    })
  })

  describe('alias uniqueness', () => {
    it('has no duplicate keys', () => {
      const keys = Object.keys(ALIASES)
      const uniqueKeys = new Set(keys)
      expect(keys.length).toBe(uniqueKeys.size)
    })

    it('has unique lowercase keys', () => {
      const lowerKeys = Object.keys(ALIASES).map((k) => k.toLowerCase())
      const uniqueLowerKeys = new Set(lowerKeys)
      expect(lowerKeys.length).toBe(uniqueLowerKeys.size)
    })
  })

  describe('alias conventions', () => {
    it('uses lowercase keys', () => {
      for (const key of Object.keys(ALIASES)) {
        expect(key).toBe(key.toLowerCase())
      }
    })

    it('uses lowercase provider names in values', () => {
      for (const value of Object.values(ALIASES)) {
        const provider = value.split('/')[0]
        expect(provider).toBe(provider.toLowerCase())
      }
    })

    it('uses kebab-case or lowercase for model names', () => {
      for (const value of Object.values(ALIASES)) {
        const modelName = value.split('/')[1]
        // Model names should not have uppercase letters or spaces
        expect(modelName).not.toMatch(/[A-Z]/)
        expect(modelName).not.toContain(' ')
      }
    })
  })

  describe('provider coverage', () => {
    it('covers major AI providers', () => {
      const providers = new Set(Object.values(ALIASES).map((v) => v.split('/')[0]))

      expect(providers.has('anthropic')).toBe(true)
      expect(providers.has('openai')).toBe(true)
      expect(providers.has('google')).toBe(true)
      expect(providers.has('meta-llama')).toBe(true)
    })

    it('has multiple aliases per major provider', () => {
      const providerCounts: Record<string, number> = {}

      for (const value of Object.values(ALIASES)) {
        const provider = value.split('/')[0]
        providerCounts[provider] = (providerCounts[provider] || 0) + 1
      }

      // Major providers should have multiple aliases
      expect(providerCounts['anthropic']).toBeGreaterThanOrEqual(3)
      expect(providerCounts['openai']).toBeGreaterThanOrEqual(5)
      expect(providerCounts['google']).toBeGreaterThanOrEqual(3)
    })
  })

  describe('README documentation alignment', () => {
    it('matches all aliases documented in README', () => {
      // These are the aliases listed in the README.md table
      const documentedAliases = {
        opus: 'anthropic/claude-opus-4.5',
        sonnet: 'anthropic/claude-sonnet-4.5',
        haiku: 'anthropic/claude-haiku-4.5',
        claude: 'anthropic/claude-sonnet-4.5',
        gpt: 'openai/gpt-4o',
        'gpt-4o': 'openai/gpt-4o',
        '4o': 'openai/gpt-4o',
        o1: 'openai/o1',
        o3: 'openai/o3',
        'o3-mini': 'openai/o3-mini',
        gemini: 'google/gemini-2.5-flash',
        flash: 'google/gemini-2.5-flash',
        'gemini-pro': 'google/gemini-2.5-pro',
        llama: 'meta-llama/llama-4-maverick',
        'llama-4': 'meta-llama/llama-4-maverick',
        'llama-70b': 'meta-llama/llama-3.3-70b-instruct',
        mistral: 'mistralai/mistral-large-2411',
        codestral: 'mistralai/codestral-2501',
        deepseek: 'deepseek/deepseek-chat',
        r1: 'deepseek/deepseek-r1',
        qwen: 'qwen/qwen3-235b-a22b',
        grok: 'x-ai/grok-3',
        sonar: 'perplexity/sonar-pro',
      }

      for (const [alias, expectedId] of Object.entries(documentedAliases)) {
        expect(ALIASES[alias]).toBe(expectedId)
      }
    })
  })

  describe('alias count', () => {
    it('has reasonable number of aliases', () => {
      const count = Object.keys(ALIASES).length
      expect(count).toBeGreaterThanOrEqual(20)
      expect(count).toBeLessThanOrEqual(100)
    })
  })
})
