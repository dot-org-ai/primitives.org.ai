/**
 * Tests for ID generation utilities used across transports
 *
 * This tests the generateRequestId function that creates unique IDs
 * for tracking requests across Slack, Email, and other transports.
 */

import { describe, it, expect } from 'vitest'
import { generateRequestId } from '../../src/utils/id.js'

describe('generateRequestId', () => {
  describe('format', () => {
    it('should generate ID with default "req" prefix', () => {
      const id = generateRequestId()
      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/)
    })

    it('should generate ID with custom prefix', () => {
      const id = generateRequestId('apr')
      expect(id).toMatch(/^apr_\d+_[a-z0-9]+$/)
    })

    it('should include timestamp in the middle segment', () => {
      const before = Date.now()
      const id = generateRequestId()
      const after = Date.now()

      const parts = id.split('_')
      const timestamp = parseInt(parts[1], 10)

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should have random portion of exactly 9 characters', () => {
      const id = generateRequestId()
      const parts = id.split('_')
      const randomPart = parts[2]

      expect(randomPart).toHaveLength(9)
    })

    it('should use base36 encoding for random portion', () => {
      const id = generateRequestId()
      const parts = id.split('_')
      const randomPart = parts[2]

      // Base36 only contains lowercase letters and digits
      expect(randomPart).toMatch(/^[a-z0-9]+$/)
    })
  })

  describe('uniqueness', () => {
    it('should generate unique IDs across multiple calls', () => {
      const ids = new Set<string>()
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        ids.add(generateRequestId())
      }

      expect(ids.size).toBe(iterations)
    })

    it('should generate unique IDs even when called rapidly', () => {
      const ids = Array.from({ length: 100 }, () => generateRequestId())
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(100)
    })
  })

  describe('string length', () => {
    it('should have consistent structure (prefix + timestamp + random)', () => {
      const id = generateRequestId()
      const parts = id.split('_')

      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe('req') // prefix
      expect(parts[1]).toMatch(/^\d+$/) // timestamp
      expect(parts[2]).toHaveLength(9) // random (base36)
    })

    it('should produce IDs of reasonable length for storage', () => {
      const id = generateRequestId()
      // req (3) + _ (1) + timestamp (~13) + _ (1) + random (9) = ~27 chars
      expect(id.length).toBeGreaterThanOrEqual(20)
      expect(id.length).toBeLessThanOrEqual(35)
    })
  })
})
