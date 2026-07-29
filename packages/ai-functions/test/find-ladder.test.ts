/**
 * Tests for the embeddings socket — the pure, API-free half of aip-cnks.3.
 *
 * EmbeddingMode (asymmetric MATCH vs symmetric-centered COLLAPSE, never globally
 * flipped), `cosine(a,b,{center})`, `computeRRF` reciprocal-rank fusion for the
 * FTS+vector hybrid ladder, and the direction-gated madlib `buildMatchQuery`.
 * These feed the vector tier of `find-or-create.ts`'s collector, so the mode
 * vocabulary matches its `GateMode` ('asymmetric-match' | 'symmetric-collapse').
 *
 * See docs/plans/2026-06-01-strategic-primitives-hardening.md — "embeddings socket".
 */

import { describe, it, expect } from 'vitest'
import {
  MATCH_MODE,
  COLLAPSE_MODE,
  applyStrategyPrefix,
  cosine,
  computeRRF,
  buildMatchQuery,
  type EmbeddingMode,
  type PredicateSpec,
} from '../src/find-ladder.js'

describe('EmbeddingMode constants — the never-globally-flipped invariant', () => {
  it('MATCH is asymmetric and does NOT center (retrieval / matching)', () => {
    expect(MATCH_MODE.strategy).toBe('asymmetric-query')
    // asymmetric MATCH never mean-centers — centering compressed cosine to ~0.07
    expect(MATCH_MODE.postProcess).toBeUndefined()
  })

  it('COLLAPSE is symmetric and is the entity-dedup mode', () => {
    expect(COLLAPSE_MODE.strategy).toBe('symmetric')
  })

  it('maps onto find-or-create GateMode vocabulary', () => {
    // The vector tier of the gate runs in exactly one of these two spaces.
    expect(MATCH_MODE.gateMode).toBe('asymmetric-match')
    expect(COLLAPSE_MODE.gateMode).toBe('symmetric-collapse')
  })
})

describe('applyStrategyPrefix — strategy-driven query/doc prefixing', () => {
  it('symmetric leaves the text bare (no prefix)', () => {
    expect(applyStrategyPrefix('hello', { strategy: 'symmetric' })).toBe('hello')
  })

  it('asymmetric-query prefixes a query marker', () => {
    const out = applyStrategyPrefix('soybeans', { strategy: 'asymmetric-query' })
    expect(out).toMatch(/soybeans$/)
    expect(out).not.toBe('soybeans')
  })

  it('asymmetric-doc leaves the document bare (query-prefix + bare-doc)', () => {
    expect(applyStrategyPrefix('a long passage', { strategy: 'asymmetric-doc' })).toBe(
      'a long passage'
    )
  })

  it('honors an explicit prefixKind override', () => {
    const out = applyStrategyPrefix('x', { strategy: 'asymmetric-query', prefixKind: 'search_query' })
    expect(out).toBe('search_query: x')
  })
})

describe('cosine — cosine similarity with optional mean-centering', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0, 0], [0, 1, 0])).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosine([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1)
  })

  it('subtracts a centroid before measuring when center is given', () => {
    // Without centering these are similar (both point mostly +x); centered on the
    // shared mean, the residuals separate them.
    const a = [2, 1]
    const b = [2, -1]
    const center = [2, 0]
    expect(cosine(a, b, { center })).toBeCloseTo(-1)
    expect(cosine(a, b)).toBeGreaterThan(0.5)
  })

  it('returns 0 when a centered vector collapses to zero (no NaN)', () => {
    expect(cosine([1, 1], [2, 2], { center: [1, 1] })).toBe(0)
  })
})

describe('computeRRF — reciprocal-rank fusion for the hybrid ladder', () => {
  it('fuses two ranked lists, rewarding items ranked high in both', () => {
    const fts = ['a', 'b', 'c']
    const vector = ['b', 'a', 'd']
    const fused = computeRRF([fts, vector])
    // 'a' (ranks 1,2) and 'b' (ranks 2,1) both beat single-list items
    expect(fused.slice(0, 2).map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect(fused.map((r) => r.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ranks an item present in both lists above one present in only one', () => {
    const fused = computeRRF([['x', 'y'], ['x', 'z']])
    expect(fused[0].id).toBe('x')
  })

  it('returns scores descending', () => {
    const fused = computeRRF([['a', 'b', 'c']])
    const scores = fused.map((r) => r.score)
    expect(scores).toEqual([...scores].sort((p, q) => q - p))
  })

  it('honors the k constant (larger k flattens rank contribution)', () => {
    const flat = computeRRF([['a', 'b']], 1000)
    expect(flat[0].score - flat[1].score).toBeLessThan(
      computeRRF([['a', 'b']], 1)[0].score - computeRRF([['a', 'b']], 1)[1].score
    )
  })

  it('breaks ties deterministically by id', () => {
    const fused = computeRRF([['a'], ['b']])
    // both at rank 1 in their own list → equal score → id order
    expect(fused.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('buildMatchQuery — direction-gated madlib', () => {
  const directionBearing: PredicateSpec = {
    rel: 'producedBy',
    dstType: 'Industry',
    fan: 'functional',
    direction: 'direction-bearing',
    madlibQuestion: 'What type of company manufactures {name}?',
  }

  const similarityAligned: PredicateSpec = {
    rel: 'composedOf',
    dstType: 'Part',
    fan: 'fuzzy',
    direction: 'similarity-aligned',
    madlibQuestion: 'What is {name} composed of?',
  }

  it('fills the madlib template for a direction-bearing predicate', () => {
    expect(buildMatchQuery({ spec: directionBearing, value: 'soybeans' })).toBe(
      'What type of company manufactures soybeans?'
    )
  })

  it('uses bare text for a similarity-aligned predicate even if a madlib is supplied', () => {
    // madlib HURTS meronymic/similarity-aligned predicates — gate it off.
    expect(buildMatchQuery({ spec: similarityAligned, value: 'an engine' })).toBe('an engine')
  })

  it('falls back to bare text when a direction-bearing predicate has no madlibQuestion', () => {
    const noTemplate: PredicateSpec = {
      rel: 'r',
      dstType: 'T',
      fan: 'functional',
      direction: 'direction-bearing',
    }
    expect(buildMatchQuery({ spec: noTemplate, value: 'thing' })).toBe('thing')
  })
})

describe('mode wiring sanity', () => {
  it('exposes the two modes as typed EmbeddingMode values', () => {
    const modes: EmbeddingMode[] = [MATCH_MODE, COLLAPSE_MODE]
    expect(modes).toHaveLength(2)
  })
})
