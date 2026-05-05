/**
 * Integration tests: retry/CB/fallback machinery reads policy data from
 * `language-models`. Validates that the per-model `ModelPolicy` flows through
 * the resilience classes correctly.
 */

import { describe, it, expect, vi } from 'vitest'
import { RetryPolicy, CircuitBreaker, FallbackChain } from '../src/retry.js'
import { tiersForModel, modelSupportsTier, modelPolicyFor } from '../src/index.js'

describe('RetryPolicy.forModel', () => {
  it('uses frontier-provider settings for sonnet', async () => {
    const policy = RetryPolicy.forModel('sonnet')
    let attempts = 0
    const op = vi.fn(async () => {
      attempts++
      if (attempts < 2) {
        const err = new Error('rate limit')
        ;(err as Error & { status?: number }).status = 429
        throw err
      }
      return 'ok'
    })
    const result = await policy.execute(() => op())
    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('forModel respects per-call overrides', async () => {
    const policy = RetryPolicy.forModel('sonnet', { maxRetries: 0 })
    let attempts = 0
    const op = async () => {
      attempts++
      const err = new Error('rate limit')
      ;(err as Error & { status?: number }).status = 429
      throw err
    }
    await expect(policy.execute(() => op())).rejects.toThrow()
    expect(attempts).toBe(1) // No retries
  })
})

describe('CircuitBreaker.forModel', () => {
  it('uses frontier-provider failure threshold for sonnet', async () => {
    const breaker = CircuitBreaker.forModel('sonnet')
    // Frontier threshold is 8 — eight failures should still report state
    // before opening on the 8th.
    for (let i = 0; i < 7; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // expected
      }
    }
    // Still closed (threshold is 8)
    expect(breaker.state).toBe('closed')
  })

  it('forModel respects per-call overrides', async () => {
    const breaker = CircuitBreaker.forModel('sonnet', { failureThreshold: 1 })
    try {
      await breaker.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      // expected
    }
    expect(breaker.state).toBe('open')
  })
})

describe('FallbackChain.forModel', () => {
  it('builds a chain from policy.fallbackChain plus the primary model id', async () => {
    const seen: string[] = []
    const chain = FallbackChain.forModel<string, void>('sonnet', async (modelId) => {
      seen.push(modelId)
      throw new Error('fail')
    })
    await expect(chain.execute()).rejects.toThrow('All fallback models failed')
    // First call is the primary alias, rest are fallbacks
    expect(seen[0]).toBe('anthropic/claude-sonnet-4.5')
    expect(seen.length).toBeGreaterThan(1)
  })

  it('returns first successful model result', async () => {
    let calls = 0
    const chain = FallbackChain.forModel<string, void>('sonnet', async (modelId) => {
      calls++
      if (calls === 1) throw new Error('first fails')
      return modelId
    })
    const result = await chain.execute()
    expect(calls).toBe(2)
    expect(result).toBeTruthy()
  })
})

describe('tier helpers', () => {
  it('tiersForModel returns expected tiers', () => {
    expect(tiersForModel('sonnet')).toContain('immediate')
    expect(tiersForModel('sonnet')).toContain('batch')
    expect(tiersForModel('gpt-4o')).toContain('flex')
  })

  it('modelSupportsTier checks eligibility', () => {
    expect(modelSupportsTier('gpt-4o', 'flex')).toBe(true)
    expect(modelSupportsTier('sonnet', 'flex')).toBe(false)
    expect(modelSupportsTier('sonnet', 'immediate')).toBe(true)
  })

  it('modelPolicyFor is re-exported', () => {
    const p = modelPolicyFor('sonnet')
    expect(p.$type).toBe('ModelPolicy')
  })
})
