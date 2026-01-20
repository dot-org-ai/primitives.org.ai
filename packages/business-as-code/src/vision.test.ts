/**
 * Tests for vision.ts - Vision statement definition and tracking
 */

import { describe, it, expect } from 'vitest'
import { Vision, checkIndicator, calculateProgress, validateVision } from './vision.js'
import type { VisionDefinition } from './types.js'

describe('Vision', () => {
  describe('Vision()', () => {
    it('should create a vision with required fields', () => {
      const vision = Vision({
        statement: 'To become the industry leader',
      })

      expect(vision.statement).toBe('To become the industry leader')
      expect(vision.successIndicators).toEqual([])
      expect(vision.metadata).toEqual({})
    })

    it('should create a vision with all fields', () => {
      const vision = Vision({
        statement: 'To become the world\'s most trusted widget platform',
        timeframe: '5 years',
        successIndicators: [
          '10M+ active users',
          'Present in 50+ countries',
          '$1B+ annual revenue',
        ],
        metadata: { category: 'growth' },
      })

      expect(vision.statement).toBe('To become the world\'s most trusted widget platform')
      expect(vision.timeframe).toBe('5 years')
      expect(vision.successIndicators).toHaveLength(3)
      expect(vision.metadata).toEqual({ category: 'growth' })
    })

    it('should throw error if statement is empty', () => {
      expect(() => Vision({ statement: '' })).toThrow('Vision statement is required')
    })

    it('should preserve provided success indicators', () => {
      const indicators = ['Indicator 1', 'Indicator 2']
      const vision = Vision({
        statement: 'Test vision',
        successIndicators: indicators,
      })

      expect(vision.successIndicators).toEqual(indicators)
    })
  })

  describe('checkIndicator()', () => {
    const vision = Vision({
      statement: 'Growth vision',
      successIndicators: [
        '10M+ active users',
        'Present in 50+ countries',
        'Industry-leading NPS score',
      ],
    })

    it('should return true when indicator matches metric', () => {
      const result = checkIndicator(vision, '10M+ active users', {
        users: true,
        activeUsers: 15000000,
      })

      expect(result).toBe(true)
    })

    it('should return false when metric is false', () => {
      const result = checkIndicator(vision, '10M+ active users', {
        users: false,
      })

      expect(result).toBe(false)
    })

    it('should return false when no matching metric', () => {
      const result = checkIndicator(vision, '10M+ active users', {
        revenue: 1000000,
      })

      expect(result).toBe(false)
    })

    it('should match case-insensitively', () => {
      const result = checkIndicator(vision, 'Industry-leading NPS score', {
        NPS: 75,
      })

      expect(result).toBe(true)
    })

    it('should handle numeric values as truthy', () => {
      const result = checkIndicator(vision, 'Present in 50+ countries', {
        countries: 60,
      })

      expect(result).toBe(true)
    })

    it('should handle zero as falsy', () => {
      const result = checkIndicator(vision, 'Present in 50+ countries', {
        countries: 0,
      })

      expect(result).toBe(false)
    })
  })

  describe('calculateProgress()', () => {
    it('should return 0 for vision with no indicators', () => {
      const vision = Vision({ statement: 'Empty vision' })
      const progress = calculateProgress(vision, { metric: true })

      expect(progress).toBe(0)
    })

    it('should return 0 when no indicators are achieved', () => {
      const vision = Vision({
        statement: 'Test vision',
        successIndicators: ['10M users', '50 countries'],
      })

      const progress = calculateProgress(vision, { revenue: 1000000 })
      expect(progress).toBe(0)
    })

    it('should return 100 when all indicators are achieved', () => {
      const vision = Vision({
        statement: 'Test vision',
        successIndicators: ['10M users', '50 countries'],
      })

      const progress = calculateProgress(vision, {
        users: 15000000,
        countries: 60,
      })
      expect(progress).toBe(100)
    })

    it('should return partial progress', () => {
      const vision = Vision({
        statement: 'Test vision',
        successIndicators: ['users achieved', 'revenue target', 'countries expanded'],
      })

      const progress = calculateProgress(vision, {
        users: true,
        revenue: false,
        countries: 0,
      })

      expect(progress).toBeCloseTo(33.33, 0)
    })

    it('should handle 50% progress', () => {
      const vision = Vision({
        statement: 'Test vision',
        successIndicators: ['users target', 'revenue target'],
      })

      const progress = calculateProgress(vision, {
        users: true,
        revenue: 0,
      })

      expect(progress).toBe(50)
    })
  })

  describe('validateVision()', () => {
    it('should validate valid vision', () => {
      const vision: VisionDefinition = {
        statement: 'To become the industry leader in sustainable technology',
      }

      const result = validateVision(vision)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation if statement is missing', () => {
      const vision: VisionDefinition = { statement: '' }
      const result = validateVision(vision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Vision statement is required')
    })

    it('should fail validation if statement is too short', () => {
      const vision: VisionDefinition = { statement: 'Short' }
      const result = validateVision(vision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Vision statement should be at least 10 characters')
    })

    it('should return multiple errors', () => {
      const vision: VisionDefinition = { statement: '' }
      const result = validateVision(vision)

      // Empty string is both missing and too short
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should pass validation for exactly 10 character statement', () => {
      const vision: VisionDefinition = { statement: '1234567890' }
      const result = validateVision(vision)

      expect(result.valid).toBe(true)
    })
  })
})
