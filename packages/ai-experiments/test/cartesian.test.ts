/**
 * Tests for cartesian product utilities
 *
 * These tests verify the parameter exploration functionality including:
 * - Basic cartesian product generation
 * - Filtering combinations
 * - Sampling from large spaces
 * - Counting combinations
 */

import { describe, it, expect } from 'vitest'
import {
  cartesian,
  cartesianFilter,
  cartesianSample,
  cartesianCount,
  cartesianWithLabels,
} from '../src/index.js'

describe('cartesian', () => {
  describe('basic functionality', () => {
    it('generates all combinations for single parameter', () => {
      const result = cartesian({
        color: ['red', 'blue', 'green'],
      })

      expect(result).toHaveLength(3)
      expect(result).toContainEqual({ color: 'red' })
      expect(result).toContainEqual({ color: 'blue' })
      expect(result).toContainEqual({ color: 'green' })
    })

    it('generates cartesian product for two parameters', () => {
      const result = cartesian({
        size: ['small', 'large'],
        color: ['red', 'blue'],
      })

      expect(result).toHaveLength(4)
      expect(result).toContainEqual({ size: 'small', color: 'red' })
      expect(result).toContainEqual({ size: 'small', color: 'blue' })
      expect(result).toContainEqual({ size: 'large', color: 'red' })
      expect(result).toContainEqual({ size: 'large', color: 'blue' })
    })

    it('generates cartesian product for three parameters', () => {
      const result = cartesian({
        model: ['a', 'b'],
        temperature: [0.3, 0.7],
        maxTokens: [100, 500],
      })

      // 2 * 2 * 2 = 8
      expect(result).toHaveLength(8)
      expect(result).toContainEqual({ model: 'a', temperature: 0.3, maxTokens: 100 })
      expect(result).toContainEqual({ model: 'b', temperature: 0.7, maxTokens: 500 })
    })

    it('returns empty array for empty input', () => {
      const result = cartesian({})
      expect(result).toEqual([])
    })

    it('handles mixed types', () => {
      const result = cartesian({
        count: [1, 2],
        enabled: [true, false],
        name: ['test'],
      })

      expect(result).toHaveLength(4)
      expect(result).toContainEqual({ count: 1, enabled: true, name: 'test' })
      expect(result).toContainEqual({ count: 2, enabled: false, name: 'test' })
    })

    it('preserves object values', () => {
      const objA = { complex: true }
      const objB = { complex: false }

      const result = cartesian({
        config: [objA, objB],
      })

      expect(result).toHaveLength(2)
      expect(result[0].config).toBe(objA)
      expect(result[1].config).toBe(objB)
    })
  })
})

describe('cartesianFilter', () => {
  it('filters out unwanted combinations', () => {
    const result = cartesianFilter(
      {
        model: ['sonnet', 'opus'],
        temperature: [0.3, 0.7, 1.0],
      },
      // Filter out opus with high temperature
      (combo) => !(combo.model === 'opus' && combo.temperature > 0.7)
    )

    // 6 total - 1 (opus with 1.0) = 5
    expect(result).toHaveLength(5)
    expect(result).not.toContainEqual({ model: 'opus', temperature: 1.0 })
  })

  it('returns empty array when all filtered', () => {
    const result = cartesianFilter({ x: [1, 2, 3] }, () => false)

    expect(result).toEqual([])
  })

  it('returns all when nothing filtered', () => {
    const result = cartesianFilter({ x: [1, 2] }, () => true)

    expect(result).toHaveLength(2)
  })

  it('works with complex filter conditions', () => {
    const result = cartesianFilter(
      {
        a: [1, 2, 3],
        b: [10, 20, 30],
      },
      // Only keep combinations where a * b < 50
      (combo) => combo.a * combo.b < 50
    )

    // Valid: (1,10), (1,20), (1,30), (2,10), (2,20), (3,10)
    expect(result).toHaveLength(6)
    expect(result).not.toContainEqual({ a: 2, b: 30 })
    expect(result).not.toContainEqual({ a: 3, b: 20 })
    expect(result).not.toContainEqual({ a: 3, b: 30 })
  })
})

describe('cartesianSample', () => {
  it('returns subset of specified size', () => {
    const result = cartesianSample(
      {
        a: [1, 2, 3, 4, 5],
        b: [1, 2, 3, 4, 5],
      },
      5
    )

    expect(result).toHaveLength(5)
  })

  it('returns all combinations when sample size exceeds total', () => {
    const result = cartesianSample({ x: [1, 2] }, 100)

    expect(result).toHaveLength(2)
  })

  it('returns unique combinations by default', () => {
    const result = cartesianSample({ a: [1, 2, 3], b: [1, 2, 3] }, 5)

    const serialized = result.map((r) => JSON.stringify(r))
    const unique = new Set(serialized)

    expect(unique.size).toBe(serialized.length)
  })

  it('returns valid combinations', () => {
    const result = cartesianSample({ color: ['red', 'blue'], size: ['small', 'large'] }, 3)

    const validColors = ['red', 'blue']
    const validSizes = ['small', 'large']

    for (const combo of result) {
      expect(validColors).toContain(combo.color)
      expect(validSizes).toContain(combo.size)
    }
  })

  it('handles sample size of 0', () => {
    const result = cartesianSample({ x: [1, 2, 3] }, 0)

    expect(result).toHaveLength(0)
  })

  it('handles empty parameters', () => {
    const result = cartesianSample({}, 10)
    expect(result).toEqual([])
  })
})

describe('cartesianCount', () => {
  it('counts single parameter correctly', () => {
    const count = cartesianCount({
      x: [1, 2, 3, 4, 5],
    })

    expect(count).toBe(5)
  })

  it('counts product of multiple parameters', () => {
    const count = cartesianCount({
      a: [1, 2, 3],
      b: ['x', 'y'],
      c: [true, false],
    })

    // 3 * 2 * 2 = 12
    expect(count).toBe(12)
  })

  it('returns 0 for empty parameters', () => {
    const count = cartesianCount({})
    expect(count).toBe(0)
  })

  it('returns 0 if any parameter has empty array', () => {
    const count = cartesianCount({
      a: [1, 2, 3],
      b: [],
    })

    expect(count).toBe(0)
  })

  it('handles large parameter spaces efficiently', () => {
    // This would be 10^6 = 1,000,000 combinations
    // Count should be fast even though generating would be slow
    const count = cartesianCount({
      a: Array.from({ length: 100 }, (_, i) => i),
      b: Array.from({ length: 100 }, (_, i) => i),
      c: Array.from({ length: 100 }, (_, i) => i),
    })

    expect(count).toBe(1000000)
  })
})

describe('cartesianWithLabels', () => {
  it('returns values with index labels', () => {
    const result = cartesianWithLabels({
      model: ['sonnet', 'opus'],
      temperature: [0.3, 0.7],
    })

    expect(result).toHaveLength(4)

    // Check first combination
    const first = result.find((r) => r.values.model === 'sonnet' && r.values.temperature === 0.3)
    expect(first).toBeDefined()
    expect(first?.labels.model).toBe(0)
    expect(first?.labels.temperature).toBe(0)

    // Check last combination
    const last = result.find((r) => r.values.model === 'opus' && r.values.temperature === 0.7)
    expect(last).toBeDefined()
    expect(last?.labels.model).toBe(1)
    expect(last?.labels.temperature).toBe(1)
  })

  it('labels correspond to array positions', () => {
    const options = ['a', 'b', 'c']
    const result = cartesianWithLabels({
      option: options,
    })

    for (let i = 0; i < options.length; i++) {
      const item = result.find((r) => r.values.option === options[i])
      expect(item?.labels.option).toBe(i)
    }
  })

  it('returns empty array for empty input', () => {
    const result = cartesianWithLabels({})
    expect(result).toEqual([])
  })

  it('provides both values and labels in each result', () => {
    const result = cartesianWithLabels({
      x: [10, 20],
    })

    for (const item of result) {
      expect(item).toHaveProperty('values')
      expect(item).toHaveProperty('labels')
      expect(typeof item.values.x).toBe('number')
      expect(typeof item.labels.x).toBe('number')
    }
  })
})
