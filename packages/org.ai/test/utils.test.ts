/**
 * Tests for utility functions in org.ai
 *
 * Tests the progress calculation utilities: calculateProgress,
 * calculateProgressPercent, isOnTrack, and calculateGap.
 */

import { describe, it, expect } from 'vitest'

import {
  calculateProgress,
  calculateProgressPercent,
  isOnTrack,
  calculateGap,
  type ProgressInput,
} from '../src/index.js'

describe('Progress Utilities', () => {
  // ==========================================================================
  // calculateProgress Tests
  // ==========================================================================
  describe('calculateProgress', () => {
    it('calculates progress for standard case', () => {
      const result = calculateProgress({ current: 50, target: 100 })
      expect(result).toBe(0.5)
    })

    it('calculates progress for 0%', () => {
      const result = calculateProgress({ current: 0, target: 100 })
      expect(result).toBe(0)
    })

    it('calculates progress for 100%', () => {
      const result = calculateProgress({ current: 100, target: 100 })
      expect(result).toBe(1)
    })

    it('clamps progress to 1 when exceeding target', () => {
      const result = calculateProgress({ current: 150, target: 100 })
      expect(result).toBe(1)
    })

    it('clamps progress to 0 for negative current', () => {
      const result = calculateProgress({ current: -50, target: 100 })
      expect(result).toBe(0)
    })

    it('returns 0 when target is 0 (avoids division by zero)', () => {
      const result = calculateProgress({ current: 50, target: 0 })
      expect(result).toBe(0)
    })

    it('handles small decimal values', () => {
      const result = calculateProgress({ current: 0.1, target: 1 })
      expect(result).toBeCloseTo(0.1)
    })

    it('handles large numbers', () => {
      const result = calculateProgress({ current: 5000000, target: 10000000 })
      expect(result).toBe(0.5)
    })

    it('calculates 75% progress correctly', () => {
      const result = calculateProgress({ current: 75, target: 100 })
      expect(result).toBe(0.75)
    })

    it('calculates 25% progress correctly', () => {
      const result = calculateProgress({ current: 25, target: 100 })
      expect(result).toBe(0.25)
    })

    it('handles fractional current values', () => {
      const result = calculateProgress({ current: 33.33, target: 100 })
      expect(result).toBeCloseTo(0.3333)
    })

    it('handles fractional target values', () => {
      const result = calculateProgress({ current: 50, target: 200.5 })
      expect(result).toBeCloseTo(0.2494, 3)
    })
  })

  // ==========================================================================
  // calculateProgressPercent Tests
  // ==========================================================================
  describe('calculateProgressPercent', () => {
    it('returns progress as percentage', () => {
      const result = calculateProgressPercent({ current: 50, target: 100 })
      expect(result).toBe(50)
    })

    it('returns 0% for no progress', () => {
      const result = calculateProgressPercent({ current: 0, target: 100 })
      expect(result).toBe(0)
    })

    it('returns 100% for completed target', () => {
      const result = calculateProgressPercent({ current: 100, target: 100 })
      expect(result).toBe(100)
    })

    it('clamps to 100% when exceeding target', () => {
      const result = calculateProgressPercent({ current: 150, target: 100 })
      expect(result).toBe(100)
    })

    it('returns 0% when target is 0', () => {
      const result = calculateProgressPercent({ current: 50, target: 0 })
      expect(result).toBe(0)
    })

    it('handles 75%', () => {
      const result = calculateProgressPercent({ current: 75, target: 100 })
      expect(result).toBe(75)
    })

    it('handles fractional percentages', () => {
      const result = calculateProgressPercent({ current: 33, target: 100 })
      expect(result).toBe(33)
    })

    it('handles non-100 targets', () => {
      const result = calculateProgressPercent({ current: 50, target: 200 })
      expect(result).toBe(25)
    })

    it('handles revenue-style numbers', () => {
      const result = calculateProgressPercent({ current: 75000, target: 100000 })
      expect(result).toBe(75)
    })
  })

  // ==========================================================================
  // isOnTrack Tests
  // ==========================================================================
  describe('isOnTrack', () => {
    it('returns true when progress meets default threshold (80%)', () => {
      const result = isOnTrack({ current: 80, target: 100 })
      expect(result).toBe(true)
    })

    it('returns true when progress exceeds default threshold', () => {
      const result = isOnTrack({ current: 90, target: 100 })
      expect(result).toBe(true)
    })

    it('returns false when progress below default threshold', () => {
      const result = isOnTrack({ current: 70, target: 100 })
      expect(result).toBe(false)
    })

    it('returns true at exactly 80%', () => {
      const result = isOnTrack({ current: 80, target: 100 })
      expect(result).toBe(true)
    })

    it('returns false at 79%', () => {
      const result = isOnTrack({ current: 79, target: 100 })
      expect(result).toBe(false)
    })

    it('accepts custom threshold of 70%', () => {
      const onTrack = isOnTrack({ current: 70, target: 100 }, 0.7)
      const atRisk = isOnTrack({ current: 69, target: 100 }, 0.7)

      expect(onTrack).toBe(true)
      expect(atRisk).toBe(false)
    })

    it('accepts custom threshold of 50%', () => {
      const result = isOnTrack({ current: 50, target: 100 }, 0.5)
      expect(result).toBe(true)
    })

    it('accepts custom threshold of 90%', () => {
      const onTrack = isOnTrack({ current: 90, target: 100 }, 0.9)
      const atRisk = isOnTrack({ current: 89, target: 100 }, 0.9)

      expect(onTrack).toBe(true)
      expect(atRisk).toBe(false)
    })

    it('returns true when exceeding target', () => {
      const result = isOnTrack({ current: 150, target: 100 })
      expect(result).toBe(true)
    })

    it('handles 0% threshold', () => {
      const result = isOnTrack({ current: 0, target: 100 }, 0)
      expect(result).toBe(true)
    })

    it('handles 100% threshold', () => {
      const onTrack = isOnTrack({ current: 100, target: 100 }, 1)
      const atRisk = isOnTrack({ current: 99, target: 100 }, 1)

      expect(onTrack).toBe(true)
      expect(atRisk).toBe(false)
    })

    it('returns false when target is 0', () => {
      const result = isOnTrack({ current: 50, target: 0 })
      expect(result).toBe(false)
    })
  })

  // ==========================================================================
  // calculateGap Tests
  // ==========================================================================
  describe('calculateGap', () => {
    it('calculates positive gap when below target', () => {
      const result = calculateGap({ current: 75, target: 100 })
      expect(result).toBe(25)
    })

    it('calculates zero gap when at target', () => {
      const result = calculateGap({ current: 100, target: 100 })
      expect(result).toBe(0)
    })

    it('calculates negative gap when exceeding target', () => {
      const result = calculateGap({ current: 120, target: 100 })
      expect(result).toBe(-20)
    })

    it('calculates gap with large numbers', () => {
      const result = calculateGap({ current: 500000, target: 1000000 })
      expect(result).toBe(500000)
    })

    it('calculates gap with decimal values', () => {
      const result = calculateGap({ current: 33.33, target: 100 })
      expect(result).toBeCloseTo(66.67)
    })

    it('handles zero current', () => {
      const result = calculateGap({ current: 0, target: 100 })
      expect(result).toBe(100)
    })

    it('handles zero target', () => {
      const result = calculateGap({ current: 50, target: 0 })
      expect(result).toBe(-50)
    })

    it('handles negative current', () => {
      const result = calculateGap({ current: -10, target: 100 })
      expect(result).toBe(110)
    })

    it('calculates revenue gap correctly', () => {
      const result = calculateGap({ current: 85000, target: 100000 })
      expect(result).toBe(15000)
    })
  })

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Integration Tests', () => {
    it('progress functions work together for KPI tracking', () => {
      const kpi: ProgressInput = { current: 75000, target: 100000 }

      const progress = calculateProgress(kpi)
      const progressPercent = calculateProgressPercent(kpi)
      const onTrack = isOnTrack(kpi)
      const gap = calculateGap(kpi)

      expect(progress).toBe(0.75)
      expect(progressPercent).toBe(75)
      expect(onTrack).toBe(false) // Below 80%
      expect(gap).toBe(25000)
    })

    it('progress functions work together for OKR tracking', () => {
      const okrKeyResult: ProgressInput = { current: 85, target: 100 }

      const progress = calculateProgress(okrKeyResult)
      const progressPercent = calculateProgressPercent(okrKeyResult)
      const onTrack = isOnTrack(okrKeyResult)
      const gap = calculateGap(okrKeyResult)

      expect(progress).toBe(0.85)
      expect(progressPercent).toBe(85)
      expect(onTrack).toBe(true) // Above 80%
      expect(gap).toBe(15)
    })

    it('progress functions work together for goal tracking', () => {
      const goal: ProgressInput = { current: 50, target: 100 }

      const progress = calculateProgress(goal)
      const progressPercent = calculateProgressPercent(goal)
      const onTrackStrict = isOnTrack(goal, 0.8)
      const onTrackLenient = isOnTrack(goal, 0.5)
      const gap = calculateGap(goal)

      expect(progress).toBe(0.5)
      expect(progressPercent).toBe(50)
      expect(onTrackStrict).toBe(false)
      expect(onTrackLenient).toBe(true)
      expect(gap).toBe(50)
    })

    it('handles completed goals', () => {
      const completedGoal: ProgressInput = { current: 100, target: 100 }

      expect(calculateProgress(completedGoal)).toBe(1)
      expect(calculateProgressPercent(completedGoal)).toBe(100)
      expect(isOnTrack(completedGoal)).toBe(true)
      expect(calculateGap(completedGoal)).toBe(0)
    })

    it('handles over-achieved goals', () => {
      const overAchieved: ProgressInput = { current: 150, target: 100 }

      expect(calculateProgress(overAchieved)).toBe(1) // Clamped
      expect(calculateProgressPercent(overAchieved)).toBe(100) // Clamped
      expect(isOnTrack(overAchieved)).toBe(true)
      expect(calculateGap(overAchieved)).toBe(-50) // Negative gap = exceeded
    })

    it('handles not-started goals', () => {
      const notStarted: ProgressInput = { current: 0, target: 100 }

      expect(calculateProgress(notStarted)).toBe(0)
      expect(calculateProgressPercent(notStarted)).toBe(0)
      expect(isOnTrack(notStarted)).toBe(false)
      expect(calculateGap(notStarted)).toBe(100)
    })
  })
})
