/**
 * Tests for the multi-provider execution driver — the L1 runtime half of the
 * multi-provider abstraction.
 *
 * `language-models` (L0) produces the pure selection plan + quota classifier.
 * `ai-providers` (L1) executes it: `runWithFallback` walks the candidate chain,
 * calling the caller-supplied `invoke` against each candidate and stepping to
 * the next on a quota error. This is the seam a `model.run(PreparedGeneration)`
 * adapter in `ai-functions` wraps around its AI-SDK call — `invoke` does the
 * actual generateObject / generateText, this driver owns the failover loop.
 *
 * The driver is plan-agnostic, so these tests build `ProviderCandidate[]`
 * plans inline rather than via `selectionFor` (which reads the model catalog).
 * That keeps the driver test pure (no network, no catalog) — the
 * selectionFor → runWithFallback integration is covered by language-models'
 * own selection tests plus `run.integration.test.ts`.
 */

import { describe, it, expect } from 'vitest'
import { runWithFallback, type FallbackResult } from '../src/run.js'
import type { ProviderCandidate } from 'language-models'

const QUOTA = { status: 429 }

/** Build a minimal two-candidate plan (primary → fallback) for driver tests. */
function plan(primary: string, fallback: string): ProviderCandidate[] {
  return [
    { modelId: primary, provider: 'anthropic', supportsDirectRouting: true, batchTier: ['immediate'] },
    { modelId: fallback, provider: 'anthropic', supportsDirectRouting: true, batchTier: ['immediate'] },
  ]
}

describe('runWithFallback', () => {
  it('returns the first candidate result when it succeeds', async () => {
    const p = plan('a/primary', 'a/fallback')
    const seen: string[] = []
    const result = await runWithFallback(p, async (c) => {
      seen.push(c.modelId)
      return `ok:${c.modelId}`
    })
    expect(result.value).toBe('ok:a/primary')
    expect(result.candidate.modelId).toBe('a/primary')
    expect(result.attempts).toBe(1)
    expect(seen).toEqual(['a/primary'])
  })

  it('falls back to the next candidate on a quota error', async () => {
    const p = plan('a/primary', 'a/fallback')
    const seen: string[] = []
    const result = await runWithFallback(p, async (c) => {
      seen.push(c.modelId)
      if (c.modelId === 'a/primary') throw QUOTA
      return `ok:${c.modelId}`
    })
    expect(result.value).toBe('ok:a/fallback')
    expect(result.candidate.modelId).toBe('a/fallback')
    expect(result.attempts).toBe(2)
    expect(seen).toEqual(['a/primary', 'a/fallback'])
  })

  it('does NOT fall back on a non-quota error — surfaces it immediately', async () => {
    const p = plan('a/primary', 'a/fallback')
    const seen: string[] = []
    await expect(
      runWithFallback(p, async (c) => {
        seen.push(c.modelId)
        throw new Error('invalid schema')
      })
    ).rejects.toThrow('invalid schema')
    expect(seen).toEqual(['a/primary'])
  })

  it('throws the last quota error when the whole chain is exhausted', async () => {
    const p = plan('a/primary', 'a/fallback')
    const err = { status: 429, message: 'final quota wall' }
    await expect(
      runWithFallback(p, async () => {
        throw err
      })
    ).rejects.toBe(err)
  })

  it('throws when given an empty plan', async () => {
    await expect(runWithFallback([], async () => 'unused')).rejects.toThrow(/empty/i)
  })

  it('reports the candidate + attempt count in the result envelope', async () => {
    const p = plan('a/primary', 'a/fallback')
    const result: FallbackResult<number> = await runWithFallback(p, async (_c, i) => {
      if (i === 0) throw QUOTA
      return 42
    })
    expect(result.value).toBe(42)
    expect(result.attempts).toBe(2)
    expect(result.candidate.modelId).toBe('a/fallback')
  })

  it('walks a 3+ candidate chain, stepping past each quota wall', async () => {
    const p: ProviderCandidate[] = [
      { modelId: 'a/m1', provider: 'anthropic', supportsDirectRouting: true, batchTier: ['immediate'] },
      { modelId: 'a/m2', provider: 'anthropic', supportsDirectRouting: true, batchTier: ['immediate'] },
      { modelId: 'a/m3', provider: 'anthropic', supportsDirectRouting: true, batchTier: ['immediate'] },
    ]
    const result = await runWithFallback(p, async (c) => {
      if (c.modelId !== 'a/m3') throw QUOTA
      return c.modelId
    })
    expect(result.value).toBe('a/m3')
    expect(result.attempts).toBe(3)
  })
})
