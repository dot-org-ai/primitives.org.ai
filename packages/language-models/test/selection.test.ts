/**
 * Tests for the pure multi-provider selection + quota-fallback policy.
 *
 * `selection.ts` is the L0 declarative layer: it turns a model spec into an
 * ordered list of provider candidates (the quota-fallback chain), classifies
 * quota / rate-limit errors, and steps the chain on quota exhaustion. It is
 * pure — no network, no SDK — so it is fully deterministic and replayable.
 *
 * Source pattern: startup-builder `_dual-google-router.ts` (isQuotaError +
 * cool-down + downgrade) generalized over `policyFor().fallbackChain`.
 */

import { describe, it, expect } from 'vitest'
import {
  isQuotaError,
  selectionFor,
  nextCandidate,
  type ProviderCandidate,
} from '../src/selection.js'

describe('isQuotaError', () => {
  it('treats HTTP 429 as a quota error', () => {
    expect(isQuotaError({ status: 429 })).toBe(true)
    expect(isQuotaError({ statusCode: 429 })).toBe(true)
  })

  it('treats provider quota codes as quota errors', () => {
    expect(isQuotaError({ code: 'RESOURCE_EXHAUSTED' })).toBe(true)
    expect(isQuotaError({ code: 'QUOTA_EXCEEDED' })).toBe(true)
    expect(isQuotaError({ code: 'ThrottlingException' })).toBe(true)
    expect(isQuotaError({ code: 'insufficient_quota' })).toBe(true)
  })

  it('matches quota signals in the error message', () => {
    expect(isQuotaError(new Error('429 Too Many Requests'))).toBe(true)
    expect(isQuotaError(new Error('rate limit exceeded'))).toBe(true)
    expect(isQuotaError(new Error('RESOURCE_EXHAUSTED: quota'))).toBe(true)
    expect(isQuotaError(new Error('You exceeded your current quota'))).toBe(true)
  })

  it('does not treat ordinary errors / non-objects as quota errors', () => {
    expect(isQuotaError(new Error('bad request'))).toBe(false)
    expect(isQuotaError({ status: 400 })).toBe(false)
    expect(isQuotaError({ status: 500 })).toBe(false)
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError('429')).toBe(false)
    expect(isQuotaError(undefined)).toBe(false)
  })
})

describe('selectionFor', () => {
  it('returns the resolved primary as the first candidate', () => {
    const plan = selectionFor('opus')
    expect(plan.length).toBeGreaterThan(0)
    const head = plan[0]!
    expect(head.modelId).toBe('anthropic/claude-opus-4.5')
    expect(head.provider).toBe('anthropic')
  })

  it('appends the policy fallback chain after the primary', () => {
    const plan = selectionFor('opus')
    const ids = plan.map((c) => c.modelId)
    // primary first, then its derived fallbackChain — no duplicate of primary
    expect(ids[0]).toBe('anthropic/claude-opus-4.5')
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(2)
  })

  it('carries native provider model id + direct-routing flag per candidate', () => {
    const head = selectionFor('opus')[0]!
    expect(head.supportsDirectRouting).toBe(true)
    // opus resolves to a catalog entry with a native provider model id
    expect(typeof head.providerModelId === 'string' || head.providerModelId === undefined).toBe(
      true
    )
  })

  it('declares the batch tiers each candidate is eligible for', () => {
    const head = selectionFor('opus')[0]!
    expect(head.batchTier).toContain('immediate')
    // anthropic supports the batch API tier
    expect(head.batchTier).toContain('batch')
  })

  it('honors an explicit fallback override (e.g. opus -> sonnet downgrade)', () => {
    const plan = selectionFor('opus', { fallback: ['sonnet'] })
    const ids = plan.map((c) => c.modelId)
    expect(ids[0]).toBe('anthropic/claude-opus-4.5')
    expect(ids[1]).toBe('anthropic/claude-sonnet-4.5')
    expect(ids.length).toBe(2)
  })

  it('produces a single candidate when fallback is explicitly disabled', () => {
    const plan = selectionFor('opus', { fallback: [] })
    expect(plan.length).toBe(1)
    expect(plan[0]!.modelId).toBe('anthropic/claude-opus-4.5')
  })
})

describe('nextCandidate', () => {
  const plan: ProviderCandidate[] = selectionFor('opus')

  it('advances to the next candidate after a quota error', () => {
    const next = nextCandidate(plan, 0, { status: 429 })
    expect(next).toBe(1)
  })

  it('returns null when the chain is exhausted on a quota error', () => {
    const next = nextCandidate(plan, plan.length - 1, { status: 429 })
    expect(next).toBeNull()
  })

  it('returns null (do not fall back) on a non-quota error', () => {
    const next = nextCandidate(plan, 0, new Error('invalid schema'))
    expect(next).toBeNull()
  })
})
