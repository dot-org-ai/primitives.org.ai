/**
 * Tests for `embedText(value, mode?)` — the mode-aware embedding entry point.
 *
 * Verifies the strategy prefix is applied to the text BEFORE embedding and that
 * the mode's `postProcess` hook transforms the resulting vector — without a real
 * API call (an injected MockEmbeddingModelV3 captures the value it receives).
 * The legacy `embedText(value)` signature is preserved.
 */

import { describe, it, expect } from 'vitest'
import { MockEmbeddingModelV3 } from 'ai/test'
import { embedText, MATCH_MODE, COLLAPSE_MODE, type EmbeddingMode } from '../src/index.js'

function capturingModel(embedding: number[]) {
  const seen: string[] = []
  const model = new MockEmbeddingModelV3({
    modelId: 'mock-embed',
    doEmbed: async ({ values }: { values: string[] }) => {
      seen.push(...values)
      return { embeddings: values.map(() => embedding), warnings: [] }
    },
  })
  return { model, seen }
}

describe('embedText(value, mode?)', () => {
  it('applies the asymmetric-query prefix before embedding (MATCH)', async () => {
    const { model, seen } = capturingModel([1, 2, 3])
    await embedText('soybeans', MATCH_MODE, { model })
    expect(seen).toEqual(['query: soybeans'])
  })

  it('embeds bare text for the symmetric mode (COLLAPSE)', async () => {
    const { model, seen } = capturingModel([1, 2, 3])
    await embedText('Acme Inc', COLLAPSE_MODE, { model })
    expect(seen).toEqual(['Acme Inc'])
  })

  it('applies the mode postProcess hook to the resulting embedding', async () => {
    const { model } = capturingModel([1, 2, 3])
    const mode: EmbeddingMode = {
      strategy: 'symmetric',
      gateMode: 'symmetric-collapse',
      postProcess: (v) => v.map((x) => x * 10),
    }
    const { embedding } = await embedText('x', mode, { model })
    expect(embedding).toEqual([10, 20, 30])
  })

  it('returns the raw embedding when the mode has no postProcess', async () => {
    const { model } = capturingModel([0.5, 0.5])
    const { embedding } = await embedText('x', MATCH_MODE, { model })
    expect(embedding).toEqual([0.5, 0.5])
  })

  it('honors an explicit prefixKind override', async () => {
    const { model, seen } = capturingModel([1])
    const mode: EmbeddingMode = {
      strategy: 'asymmetric-query',
      gateMode: 'asymmetric-match',
      prefixKind: 'search_query',
    }
    await embedText('q', mode, { model })
    expect(seen).toEqual(['search_query: q'])
  })
})
