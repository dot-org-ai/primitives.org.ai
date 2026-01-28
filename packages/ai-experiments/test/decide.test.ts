/**
 * Tests for decision-making utilities
 *
 * These tests verify the decision algorithms including:
 * - Basic decide function with scoring
 * - Weighted random selection
 * - Epsilon-greedy exploration/exploitation
 * - Thompson sampling
 * - Upper Confidence Bound (UCB)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  decide,
  decideWeighted,
  decideEpsilonGreedy,
  decideThompsonSampling,
  decideUCB,
  configureTracking,
  createMemoryBackend,
} from '../src/index.js'

// Use memory backend for testing
const testBackend = createMemoryBackend()

describe('decide', () => {
  beforeEach(() => {
    testBackend.clear()
    configureTracking({ backend: testBackend, enabled: true })
  })

  describe('basic decision making', () => {
    it('selects option with highest score', async () => {
      const result = await decide({
        options: ['apple', 'banana', 'cherry'],
        score: (fruit) => {
          const scores: Record<string, number> = { apple: 3, banana: 7, cherry: 5 }
          return scores[fruit]!
        },
      })

      expect(result.selected).toBe('banana')
      expect(result.score).toBe(7)
    })

    it('returns DecisionResult with required fields', async () => {
      const result = await decide({
        options: ['a', 'b'],
        score: () => 1,
      })

      expect(result).toHaveProperty('selected')
      expect(result).toHaveProperty('score')
    })

    it('throws error for empty options', async () => {
      await expect(
        decide({
          options: [],
          score: () => 0,
        })
      ).rejects.toThrow('Cannot decide with empty options')
    })

    it('supports async scoring function', async () => {
      const result = await decide({
        options: [1, 2, 3],
        score: async (n) => {
          await new Promise((r) => setTimeout(r, 10))
          return n * n
        },
      })

      expect(result.selected).toBe(3)
      expect(result.score).toBe(9)
    })

    it('handles object options', async () => {
      const options = [
        { name: 'cheap', price: 10, quality: 3 }, // 0.3
        { name: 'balanced', price: 25, quality: 7 }, // 0.28
        { name: 'premium', price: 50, quality: 9 }, // 0.18
      ]

      const result = await decide({
        options,
        score: (opt) => opt.quality / opt.price, // value for money
      })

      // 'cheap' has highest value for money (3/10 = 0.3)
      expect(result.selected.name).toBe('cheap')
      expect(result.score).toBeCloseTo(0.3)
    })

    it('returns all options when returnAll=true', async () => {
      const result = await decide({
        options: ['a', 'b', 'c'],
        score: (x) => x.charCodeAt(0),
        returnAll: true,
      })

      expect(result.allOptions).toBeDefined()
      expect(result.allOptions).toHaveLength(3)
      // Should be sorted by score descending
      expect(result.allOptions![0].option).toBe('c')
      expect(result.allOptions![2].option).toBe('a')
    })
  })

  describe('tracking integration', () => {
    it('tracks decision events', async () => {
      await decide({
        options: [1, 2, 3],
        score: (n) => n,
        context: 'test-decision',
      })

      const events = testBackend.getEvents()
      const decisionEvent = events.find((e) => e.type === 'decision.made')

      expect(decisionEvent).toBeDefined()
      expect(decisionEvent?.data.context).toBe('test-decision')
      expect(decisionEvent?.data.optionCount).toBe(3)
    })
  })
})

describe('decideWeighted', () => {
  it('returns one of the provided options', () => {
    const result = decideWeighted([
      { value: 'a', weight: 1 },
      { value: 'b', weight: 1 },
      { value: 'c', weight: 1 },
    ])

    expect(['a', 'b', 'c']).toContain(result)
  })

  it('throws error for empty options', () => {
    expect(() => decideWeighted([])).toThrow('Cannot decide with empty options')
  })

  it('throws error for non-positive total weight', () => {
    expect(() =>
      decideWeighted([
        { value: 'a', weight: 0 },
        { value: 'b', weight: 0 },
      ])
    ).toThrow('Total weight must be positive')
  })

  it('respects weights over many trials', () => {
    // This is a statistical test - run many trials
    const counts: Record<string, number> = { a: 0, b: 0 }
    const trials = 1000

    for (let i = 0; i < trials; i++) {
      const result = decideWeighted([
        { value: 'a', weight: 0.8 },
        { value: 'b', weight: 0.2 },
      ])
      counts[result]++
    }

    // With 80/20 weights, 'a' should be selected significantly more
    // Allow some variance but 'a' should be at least 60% of results
    expect(counts.a).toBeGreaterThan(trials * 0.6)
    expect(counts.b).toBeGreaterThan(0) // 'b' should still appear sometimes
  })

  it('handles single option', () => {
    const result = decideWeighted([{ value: 'only', weight: 1 }])
    expect(result).toBe('only')
  })

  it('handles very unequal weights', () => {
    const result = decideWeighted([
      { value: 'rare', weight: 0.001 },
      { value: 'common', weight: 0.999 },
    ])

    // Just ensure it returns valid option
    expect(['rare', 'common']).toContain(result)
  })
})

describe('decideEpsilonGreedy', () => {
  beforeEach(() => {
    testBackend.clear()
    configureTracking({ backend: testBackend, enabled: true })
  })

  it('selects best option when epsilon=0 (pure exploitation)', async () => {
    const results: number[] = []

    // Run multiple times - should always pick best
    for (let i = 0; i < 5; i++) {
      const result = await decideEpsilonGreedy({
        options: [1, 5, 10],
        score: (n) => n,
        epsilon: 0,
      })
      results.push(result.selected)
    }

    // All should be 10 (best option)
    expect(results.every((r) => r === 10)).toBe(true)
  })

  it('always explores when epsilon=1', async () => {
    const results: number[] = []

    // With epsilon=1, should randomly select each time
    for (let i = 0; i < 30; i++) {
      const result = await decideEpsilonGreedy({
        options: [1, 2, 3],
        score: (n) => n,
        epsilon: 1,
      })
      results.push(result.selected)
    }

    // Should have variety (not all the same)
    const unique = new Set(results)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('returns valid DecisionResult', async () => {
    const result = await decideEpsilonGreedy({
      options: ['a', 'b'],
      score: (x) => x.charCodeAt(0),
      epsilon: 0.5,
    })

    expect(result).toHaveProperty('selected')
    expect(result).toHaveProperty('score')
    expect(['a', 'b']).toContain(result.selected)
  })

  it('throws error for invalid epsilon', async () => {
    await expect(
      decideEpsilonGreedy({
        options: [1, 2],
        score: (n) => n,
        epsilon: -0.1,
      })
    ).rejects.toThrow('Epsilon must be between 0 and 1')

    await expect(
      decideEpsilonGreedy({
        options: [1, 2],
        score: (n) => n,
        epsilon: 1.5,
      })
    ).rejects.toThrow('Epsilon must be between 0 and 1')
  })
})

describe('decideThompsonSampling', () => {
  beforeEach(() => {
    testBackend.clear()
    configureTracking({ backend: testBackend, enabled: true })
  })

  it('returns one of the provided options', () => {
    const result = decideThompsonSampling(['a', 'b', 'c'], {
      a: { alpha: 1, beta: 1 },
      b: { alpha: 1, beta: 1 },
      c: { alpha: 1, beta: 1 },
    })

    expect(['a', 'b', 'c']).toContain(result)
  })

  it('throws error for empty options', () => {
    expect(() => decideThompsonSampling([], {})).toThrow('Cannot decide with empty options')
  })

  it('favors option with higher success rate over many trials', () => {
    const counts: Record<string, number> = { high: 0, low: 0 }
    const trials = 100

    for (let i = 0; i < trials; i++) {
      const result = decideThompsonSampling(['high', 'low'], {
        high: { alpha: 90, beta: 10 }, // 90% success rate
        low: { alpha: 10, beta: 90 }, // 10% success rate
      })
      counts[result]++
    }

    // 'high' should be selected significantly more often
    expect(counts.high).toBeGreaterThan(counts.low)
  })

  it('explores uncertain options', () => {
    // With balanced priors, both options should be explored
    const counts: Record<string, number> = { a: 0, b: 0 }
    const trials = 50

    for (let i = 0; i < trials; i++) {
      const result = decideThompsonSampling(['a', 'b'], {
        a: { alpha: 1, beta: 1 }, // Uncertain (uniform prior)
        b: { alpha: 1, beta: 1 }, // Uncertain (uniform prior)
      })
      counts[result]++
    }

    // Both should be explored
    expect(counts.a).toBeGreaterThan(0)
    expect(counts.b).toBeGreaterThan(0)
  })

  it('tracks decision events', () => {
    decideThompsonSampling(['a', 'b'], {
      a: { alpha: 5, beta: 5 },
      b: { alpha: 5, beta: 5 },
    })

    const events = testBackend.getEvents()
    const decisionEvent = events.find((e) => e.type === 'decision.made')

    expect(decisionEvent).toBeDefined()
    expect(decisionEvent?.data.strategy).toBe('thompson-sampling')
  })
})

describe('decideUCB', () => {
  beforeEach(() => {
    testBackend.clear()
    configureTracking({ backend: testBackend, enabled: true })
  })

  it('returns one of the provided options', () => {
    const result = decideUCB(
      ['a', 'b', 'c'],
      {
        a: { mean: 0.5, count: 10 },
        b: { mean: 0.5, count: 10 },
        c: { mean: 0.5, count: 10 },
      },
      { explorationFactor: 1, totalCount: 30 }
    )

    expect(['a', 'b', 'c']).toContain(result)
  })

  it('throws error for empty options', () => {
    expect(() => decideUCB([], {}, { explorationFactor: 1, totalCount: 0 })).toThrow(
      'Cannot decide with empty options'
    )
  })

  it('selects option with highest mean when well-explored', () => {
    // All options have many observations, so exploration bonus is small
    const result = decideUCB(
      ['low', 'medium', 'high'],
      {
        low: { mean: 0.3, count: 1000 },
        medium: { mean: 0.5, count: 1000 },
        high: { mean: 0.8, count: 1000 },
      },
      { explorationFactor: 1, totalCount: 3000 }
    )

    expect(result).toBe('high')
  })

  it('explores under-sampled options', () => {
    // 'new' has very few observations, should get exploration bonus
    const result = decideUCB(
      ['established', 'new'],
      {
        established: { mean: 0.7, count: 1000 },
        new: { mean: 0.6, count: 5 }, // Few observations = high uncertainty
      },
      { explorationFactor: 2, totalCount: 1005 }
    )

    // With high exploration factor and low count, 'new' should be explored
    expect(result).toBe('new')
  })

  it('respects exploration factor', () => {
    // With exploration factor of 0, should pick highest mean
    const result = decideUCB(
      ['a', 'b'],
      {
        a: { mean: 0.8, count: 100 },
        b: { mean: 0.5, count: 5 },
      },
      { explorationFactor: 0, totalCount: 105 }
    )

    expect(result).toBe('a')
  })

  it('tracks decision events with UCB info', () => {
    decideUCB(
      ['a', 'b'],
      {
        a: { mean: 0.5, count: 50 },
        b: { mean: 0.5, count: 50 },
      },
      { explorationFactor: 1.5, totalCount: 100 }
    )

    const events = testBackend.getEvents()
    const decisionEvent = events.find((e) => e.type === 'decision.made')

    expect(decisionEvent).toBeDefined()
    expect(decisionEvent?.data.strategy).toBe('ucb')
    expect(decisionEvent?.data.explorationFactor).toBe(1.5)
  })
})
