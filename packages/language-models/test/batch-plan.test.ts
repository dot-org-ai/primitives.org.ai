/**
 * Tests for the batch-plan policy — the reconciliation seam with
 * `ai-functions`' batch layer.
 *
 * `ai-functions` owns batch *job execution* (the `BatchAdapter` port +
 * provider adapters in `src/batch/*` + the `BatchQueue`). This module does NOT
 * duplicate any of that. It only answers the *policy* question that belongs
 * next to the model catalog: "given this model and a desired tier, which
 * `BatchProvider` should the job be dispatched to, and is the model eligible
 * for that tier at all?" — returning a plain, serializable plan an executor or
 * `ai-functions` can act on.
 */

import { describe, it, expect } from 'vitest'
import { batchPlanFor, batchProviderFor, type BatchPlan } from '../src/selection.js'

describe('batchProviderFor', () => {
  it('maps a model spec to the ai-functions BatchProvider slug', () => {
    expect(batchProviderFor('opus')).toBe('anthropic')
    expect(batchProviderFor('gpt-4o')).toBe('openai')
  })

  it('returns null for a provider with no batch adapter in ai-functions', () => {
    // openrouter is not in ai-functions' BatchProvider union
    expect(batchProviderFor('openrouter/some-model')).toBeNull()
  })
})

describe('batchPlanFor', () => {
  it('plans a batch dispatch for a batch-eligible model', () => {
    const plan = batchPlanFor('opus', 'batch')
    expect(plan.eligible).toBe(true)
    expect(plan.tier).toBe('batch')
    expect(plan.provider).toBe('anthropic')
    expect(plan.modelId).toBe('anthropic/claude-opus-4.5')
  })

  it('marks a model ineligible when it does not support the requested tier', () => {
    // anthropic does not support the flex tier (OpenAI / Bedrock only)
    const plan = batchPlanFor('opus', 'flex')
    expect(plan.eligible).toBe(false)
    expect(plan.tier).toBe('flex')
  })

  it('falls back to immediate when no tier is requested', () => {
    const plan: BatchPlan = batchPlanFor('opus')
    expect(plan.tier).toBe('immediate')
    expect(plan.eligible).toBe(true)
  })

  it('marks ineligible (no provider) for a model with no ai-functions batch adapter', () => {
    const plan = batchPlanFor('openrouter/some-model', 'batch')
    expect(plan.provider).toBeNull()
    expect(plan.eligible).toBe(false)
  })
})
