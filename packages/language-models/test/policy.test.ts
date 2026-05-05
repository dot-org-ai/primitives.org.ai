/**
 * Tests for ModelPolicy derivation layer
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  policyFor,
  derivePolicy,
  defaultPolicy,
  resetPolicyCache,
  DEFAULT_RETRY,
  DEFAULT_CIRCUIT_BREAKER,
  type ModelInfo,
  type ModelPolicy,
} from '../src/index.js'

beforeEach(() => {
  resetPolicyCache()
})

describe('ModelPolicy MDXLD shape', () => {
  it('has $type ModelPolicy', () => {
    const p = policyFor('sonnet')
    expect(p.$type).toBe('ModelPolicy')
  })

  it('uses resolved model id as $id', () => {
    const p = policyFor('sonnet')
    expect(p.$id).toBe('anthropic/claude-sonnet-4.5')
  })
})

describe('defaultPolicy', () => {
  it('produces a usable default for unknown models', () => {
    const p = defaultPolicy('foo/bar')
    expect(p.$type).toBe('ModelPolicy')
    expect(p.$id).toBe('foo/bar')
    expect(p.provider).toBe('foo')
    expect(p.retry).toEqual(DEFAULT_RETRY)
    expect(p.circuitBreaker).toEqual(DEFAULT_CIRCUIT_BREAKER)
    expect(p.batchTier).toEqual(['immediate'])
    expect(p.fallbackChain).toEqual([])
  })

  it('handles ids without a provider prefix', () => {
    const p = defaultPolicy('orphan-model')
    expect(p.provider).toBe('unknown')
  })
})

describe('derivePolicy heuristics', () => {
  const sonnet: ModelInfo = {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    context_length: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    provider: 'anthropic',
  }

  it('frontier providers get extra retries and jitter', () => {
    const p = derivePolicy(sonnet, [sonnet])
    expect(p.retry.maxRetries).toBe(4)
    expect(p.retry.jitter).toBeGreaterThan(0)
  })

  it('non-frontier providers get default retries', () => {
    const longTail: ModelInfo = {
      id: 'mistralai/mistral-large-2411',
      name: 'Mistral Large',
      context_length: 128000,
      pricing: { prompt: '0.000002', completion: '0.000006' },
      provider: 'mistralai',
    }
    const p = derivePolicy(longTail, [longTail])
    expect(p.retry).toEqual(DEFAULT_RETRY)
  })

  it('OpenAI gets immediate, flex, and batch tiers', () => {
    const gpt4o: ModelInfo = {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      context_length: 128000,
      pricing: { prompt: '0.0000025', completion: '0.00001' },
      provider: 'openai',
    }
    const p = derivePolicy(gpt4o, [gpt4o])
    expect(p.batchTier).toContain('immediate')
    expect(p.batchTier).toContain('flex')
    expect(p.batchTier).toContain('batch')
  })

  it('Anthropic gets immediate and batch (no flex)', () => {
    const p = derivePolicy(sonnet, [sonnet])
    expect(p.batchTier).toContain('immediate')
    expect(p.batchTier).toContain('batch')
    expect(p.batchTier).not.toContain('flex')
  })

  it('frontier circuit breaker has higher threshold', () => {
    const p = derivePolicy(sonnet, [sonnet])
    expect(p.circuitBreaker.failureThreshold).toBeGreaterThan(
      DEFAULT_CIRCUIT_BREAKER.failureThreshold
    )
  })

  it('retryable categories include network, rate_limit, server', () => {
    const p = derivePolicy(sonnet, [sonnet])
    expect(p.retry.retryableCategories).toContain('network')
    expect(p.retry.retryableCategories).toContain('rate_limit')
    expect(p.retry.retryableCategories).toContain('server')
  })
})

describe('fallback chain derivation', () => {
  const sonnet: ModelInfo = {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    context_length: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    provider: 'anthropic',
  }
  const opus: ModelInfo = {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    context_length: 200000,
    pricing: { prompt: '0.000015', completion: '0.000075' },
    provider: 'anthropic',
  }
  const haiku: ModelInfo = {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    context_length: 200000,
    pricing: { prompt: '0.000001', completion: '0.000005' },
    provider: 'anthropic',
  }

  it('prefers same-family siblings before frontier seeds', () => {
    const all = [sonnet, opus, haiku]
    const p = derivePolicy(sonnet, all)
    // First entry should be a Claude sibling
    expect(p.fallbackChain[0]?.startsWith('anthropic/claude-')).toBe(true)
  })

  it('does not include the model itself', () => {
    const all = [sonnet, opus, haiku]
    const p = derivePolicy(sonnet, all)
    expect(p.fallbackChain).not.toContain(sonnet.id)
  })

  it('caps fallback chain length', () => {
    const p = policyFor('sonnet')
    expect(p.fallbackChain.length).toBeLessThanOrEqual(4)
  })
})

describe('policyFor caching', () => {
  it('returns the same policy instance for the same alias', () => {
    const a = policyFor('sonnet')
    const b = policyFor('sonnet')
    expect(a).toBe(b)
  })

  it('resolves aliases to canonical ids', () => {
    const a = policyFor('sonnet')
    const b = policyFor('anthropic/claude-sonnet-4.5')
    // Cache hit means same instance
    expect(a).toBe(b)
  })

  it('resetPolicyCache invalidates cache', () => {
    const a = policyFor('sonnet')
    resetPolicyCache()
    const b = policyFor('sonnet')
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

describe('policyFor for unknown models', () => {
  it('returns defaultPolicy when alias is unresolvable', () => {
    const p = policyFor('definitely-not-a-real-alias-xyz')
    expect(p.$type).toBe('ModelPolicy')
    // Falls back to defaultPolicy when model is not in the catalog
    expect(p.fallbackChain).toEqual([])
    expect(p.batchTier).toEqual(['immediate'])
  })
})

describe('integration with full catalog', () => {
  it('derives a complete policy for sonnet', () => {
    const p: ModelPolicy = policyFor('sonnet')
    expect(p.provider).toBe('anthropic')
    expect(p.retry.maxRetries).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(p.fallbackChain)).toBe(true)
    expect(p.batchTier.length).toBeGreaterThan(0)
  })

  it('derives a complete policy for gpt-4o', () => {
    const p = policyFor('gpt-4o')
    expect(p.provider).toBe('openai')
    expect(p.batchTier).toContain('flex')
  })
})
