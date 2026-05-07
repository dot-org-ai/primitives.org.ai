/**
 * @primitives/llm-pricing — canonical pricing table tests
 *
 * RED+GREEN per DERISK.md §1: this file lands first as RED (lookup,
 * pricing, types modules don't exist yet); GREEN follows by adding the
 * src/ implementation.
 *
 * Regression anchors come from real production runs in startup-builder:
 *
 * 1. **BMC corpus** (sb-srnl 2026-05-07): 5602 records via vertex-batch on
 *    `vertex/gemini-3.1-pro` flex/batch tier; ~4500 input tokens avg,
 *    ~1140 output tokens avg → total ~$63.53 (≈ $0.01134/record). At
 *    flex/batch ≤200K rates ($1/M in, $6/M out): input cost = 5602 ×
 *    4500 × 1e-6 = $25.21; output cost = 5602 × 1140 × 6e-6 = $38.32;
 *    total = $63.53.
 *
 * 2. **Synthetic anchors** for known token counts on each tier — exercise
 *    the linear-rate math directly to catch off-by-1000 errors.
 */

import { describe, it, expect } from 'vitest'
import { priceFor, PRICING_TABLE, listSlugs, hasPricing } from '../src/index.js'

describe('@primitives/llm-pricing — table integrity', () => {
  it('exports a non-empty PRICING_TABLE', () => {
    expect(PRICING_TABLE.length).toBeGreaterThan(10)
  })

  it('every row has provider, slug, tier, inputPer1M, outputPer1M', () => {
    for (const row of PRICING_TABLE) {
      expect(row.provider).toMatch(/^(vertex|bedrock|openai|anthropic|google-ai-studio)$/)
      expect(typeof row.slug).toBe('string')
      expect(row.slug.length).toBeGreaterThan(0)
      expect(row.tier).toMatch(/^(standard|batch|flex|provisioned)$/)
      expect(typeof row.inputPer1M).toBe('number')
      expect(typeof row.outputPer1M).toBe('number')
      expect(row.inputPer1M).toBeGreaterThanOrEqual(0)
      expect(row.outputPer1M).toBeGreaterThanOrEqual(0)
    }
  })

  it('slug+tier is unique across the table', () => {
    const seen = new Set<string>()
    for (const row of PRICING_TABLE) {
      const k = `${row.slug}|${row.tier}`
      expect(seen.has(k), `duplicate row for ${k}`).toBe(false)
      seen.add(k)
    }
  })

  it('listSlugs() returns the unique set of slugs', () => {
    const slugs = listSlugs()
    expect(slugs).toContain('vertex/gemini-3.1-pro')
    expect(slugs).toContain('bedrock/claude-opus-4-7')
    expect(slugs).toContain('aistudio/gemini-embedding-2')
    // No duplicates.
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('hasPricing() returns true for known slug+tier and false for unknown', () => {
    expect(hasPricing({ slug: 'vertex/gemini-3.1-pro', tier: 'batch' })).toBe(true)
    expect(hasPricing({ slug: 'bedrock/claude-opus-4-7', tier: 'standard' })).toBe(true)
    expect(hasPricing({ slug: 'vertex/gemini-3.1-pro', tier: 'provisioned' })).toBe(false)
    expect(hasPricing({ slug: 'made-up/model', tier: 'standard' })).toBe(false)
  })
})

describe('@primitives/llm-pricing — required slugs present', () => {
  // Every slug below must have at least one row. These are the canonical
  // slugs used across startup-builder + icps + services-builder today.
  const REQUIRED_SLUGS = [
    // Vertex Gemini family
    'vertex/gemini-3.1-pro',
    'vertex/gemini-3.1-flash-lite',
    'vertex/gemini-2.5-pro',
    'vertex/gemini-2.5-flash',
    // Bedrock Anthropic family
    'bedrock/claude-opus-4-7',
    'bedrock/claude-opus-4-6',
    'bedrock/claude-sonnet-4-7',
    'bedrock/claude-sonnet-4-6',
    'bedrock/claude-haiku-4-5',
    // Google AI Studio embedding (the embedding exception — not on Bedrock)
    'aistudio/gemini-embedding-2',
  ]

  for (const slug of REQUIRED_SLUGS) {
    it(`has at least one row for ${slug}`, () => {
      const matches = PRICING_TABLE.filter((row) => row.slug === slug)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  }

  it('vertex/gemini-3.1-pro has both standard and batch tiers', () => {
    const slug = 'vertex/gemini-3.1-pro'
    const tiers = PRICING_TABLE.filter((row) => row.slug === slug).map((r) => r.tier)
    expect(tiers).toContain('standard')
    expect(tiers).toContain('batch')
  })
})

describe('@primitives/llm-pricing — synthetic rate anchors', () => {
  it('vertex/gemini-3.1-pro batch ≤200K: 1.5M in + 0.8M out = $1.50 + $4.80 = $6.30', () => {
    const result = priceFor({
      slug: 'vertex/gemini-3.1-pro',
      tier: 'batch',
      inputTokens: 1_500_000,
      outputTokens: 800_000,
    })
    expect(result.inputUsd).toBeCloseTo(1.5, 6)
    expect(result.outputUsd).toBeCloseTo(4.8, 6)
    expect(result.totalUsd).toBeCloseTo(6.3, 6)
  })

  it('vertex/gemini-3.1-pro standard ≤200K: 1M in + 1M out = $2 + $12 = $14', () => {
    const result = priceFor({
      slug: 'vertex/gemini-3.1-pro',
      tier: 'standard',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(result.inputUsd).toBeCloseTo(2, 6)
    expect(result.outputUsd).toBeCloseTo(12, 6)
    expect(result.totalUsd).toBeCloseTo(14, 6)
  })

  it('vertex/gemini-3.1-pro standard above 200K applies the high-context rate', () => {
    // 250K input tokens crosses the 200K breakpoint → apply contextTierAbove
    // ($4/M in, $18/M out) instead of base ($2/M in, $12/M out).
    const result = priceFor({
      slug: 'vertex/gemini-3.1-pro',
      tier: 'standard',
      inputTokens: 250_000,
      outputTokens: 50_000,
    })
    // 250K × $4/M = $1.00 ; 50K × $18/M = $0.90 ; total = $1.90
    expect(result.inputUsd).toBeCloseTo(1.0, 6)
    expect(result.outputUsd).toBeCloseTo(0.9, 6)
    expect(result.totalUsd).toBeCloseTo(1.9, 6)
  })

  it('bedrock/claude-opus-4-7 standard: 1M in + 1M out = $15 + $75 = $90 (flat — no breakpoint)', () => {
    const result = priceFor({
      slug: 'bedrock/claude-opus-4-7',
      tier: 'standard',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(result.inputUsd).toBeCloseTo(15, 6)
    expect(result.outputUsd).toBeCloseTo(75, 6)
    expect(result.totalUsd).toBeCloseTo(90, 6)
  })

  it('bedrock/claude-haiku-4-5 standard: 1M in + 1M out = $1 + $5 = $6', () => {
    const result = priceFor({
      slug: 'bedrock/claude-haiku-4-5',
      tier: 'standard',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(result.totalUsd).toBeCloseTo(6, 6)
  })

  it('aistudio/gemini-embedding-2 standard: 1M in + 0 out = $0.15', () => {
    const result = priceFor({
      slug: 'aistudio/gemini-embedding-2',
      tier: 'standard',
      inputTokens: 1_000_000,
      outputTokens: 0,
    })
    expect(result.inputUsd).toBeCloseTo(0.15, 6)
    expect(result.outputUsd).toBeCloseTo(0, 6)
    expect(result.totalUsd).toBeCloseTo(0.15, 6)
  })
})

describe('@primitives/llm-pricing — production regression anchor (BMC corpus)', () => {
  // sb-srnl 2026-05-07: 5602 records via vertex-batch on
  // vertex/gemini-3.1-pro flex/batch tier (≤200K context):
  //   - input avg 4500 tok × 5602 records = 25,209,000 input tokens
  //   - output avg 1140 tok × 5602 records = 6,386,280 output tokens
  // At $1/M in + $6/M out:
  //   input cost  = 25.209  M × $1    = $25.209
  //   output cost = 6.38628 M × $6    = $38.3177
  //   total                            = $63.5267
  it('5602 records × ~4500 in × ~1140 out @ batch ≈ $63.53', () => {
    const records = 5602
    const inputAvg = 4500
    const outputAvg = 1140
    const result = priceFor({
      slug: 'vertex/gemini-3.1-pro',
      tier: 'batch',
      inputTokens: records * inputAvg,
      outputTokens: records * outputAvg,
    })
    expect(result.totalUsd).toBeGreaterThan(63)
    expect(result.totalUsd).toBeLessThan(64)
    expect(result.totalUsd).toBeCloseTo(63.527, 2)
  })
})

describe('@primitives/llm-pricing — error paths', () => {
  it('throws on unknown slug (not silent zero)', () => {
    expect(() =>
      priceFor({
        slug: 'made-up/nonexistent-model',
        tier: 'standard',
        inputTokens: 1000,
        outputTokens: 1000,
      })
    ).toThrow(/Unknown model slug/)
  })

  it('throws on unknown tier (not silent zero)', () => {
    expect(() =>
      priceFor({
        slug: 'vertex/gemini-3.1-pro',
        tier: 'provisioned',
        inputTokens: 1000,
        outputTokens: 1000,
      })
    ).toThrow(/No .* pricing/i)
  })

  it('rejects negative token counts', () => {
    expect(() =>
      priceFor({
        slug: 'bedrock/claude-opus-4-7',
        tier: 'standard',
        inputTokens: -1,
        outputTokens: 0,
      })
    ).toThrow(/non-negative/i)
  })
})
