/**
 * Tests for schema conversion
 *
 * These are pure unit tests - no AI calls needed.
 * Uses type-safe instanceof checks instead of accessing internal _def property.
 */

import { describe, it, expect } from 'vitest'
import { schema } from '../src/index.js'
import { z } from 'zod'

describe('schema', () => {
  describe('string types', () => {
    it('converts simple string description to z.string()', () => {
      const result = schema('User name')
      expect(result instanceof z.ZodString).toBe(true)
      expect(result.description).toBe('User name')
    })

    it('converts (number) hint to z.number()', () => {
      const result = schema('User age (number)')
      expect(result instanceof z.ZodNumber).toBe(true)
      expect(result.description).toBe('User age')
    })

    it('converts (boolean) hint to z.boolean()', () => {
      const result = schema('Is active (boolean)')
      expect(result instanceof z.ZodBoolean).toBe(true)
      expect(result.description).toBe('Is active')
    })

    it('converts (integer) hint to z.number().int()', () => {
      const result = schema('Item count (integer)')
      expect(result instanceof z.ZodNumber).toBe(true)
      // Verify it's an integer by testing validation behavior
      expect(result.safeParse(5).success).toBe(true)
      expect(result.safeParse(5.5).success).toBe(false)
    })

    it('converts (date) hint to z.string().datetime()', () => {
      const result = schema('Created at (date)')
      expect(result instanceof z.ZodString).toBe(true)
      // Verify it validates datetime format
      expect(result.safeParse('2024-01-15T10:30:00Z').success).toBe(true)
      expect(result.safeParse('not-a-date').success).toBe(false)
    })
  })

  describe('enum types', () => {
    it('converts pipe-separated values to z.enum()', () => {
      const result = schema('pending | done | cancelled')
      expect(result instanceof z.ZodEnum).toBe(true)
      // Verify enum values through validation
      expect(result.safeParse('pending').success).toBe(true)
      expect(result.safeParse('done').success).toBe(true)
      expect(result.safeParse('cancelled').success).toBe(true)
      expect(result.safeParse('invalid').success).toBe(false)
    })

    it('handles spaces around pipe', () => {
      const result = schema('yes | no | maybe')
      expect(result instanceof z.ZodEnum).toBe(true)
      expect(result.safeParse('yes').success).toBe(true)
      expect(result.safeParse('no').success).toBe(true)
      expect(result.safeParse('maybe').success).toBe(true)
    })
  })

  describe('array types', () => {
    it('converts [string] to z.array(z.string())', () => {
      const result = schema(['List of items'])
      expect(result instanceof z.ZodArray).toBe(true)
      expect(result.description).toBe('List of items')
      // Verify array of strings validation
      expect(result.safeParse(['a', 'b', 'c']).success).toBe(true)
      expect(result.safeParse([1, 2, 3]).success).toBe(false)
    })
  })

  describe('object types', () => {
    it('converts object to z.object()', () => {
      const result = schema({
        name: 'User name',
        age: 'Age (number)',
      })
      expect(result instanceof z.ZodObject).toBe(true)
      // Verify object validation
      expect(result.safeParse({ name: 'John', age: 30 }).success).toBe(true)
      expect(result.safeParse({ name: 'John', age: 'thirty' }).success).toBe(false)
    })

    it('handles nested objects', () => {
      const result = schema({
        user: {
          name: 'Name',
          profile: {
            bio: 'Bio',
          },
        },
      })
      expect(result instanceof z.ZodObject).toBe(true)
      // Verify nested object validation
      expect(
        result.safeParse({
          user: {
            name: 'John',
            profile: { bio: 'A developer' },
          },
        }).success
      ).toBe(true)
    })

    it('handles mixed types in object', () => {
      const result = schema({
        name: 'Name',
        count: 'Count (number)',
        active: 'Active (boolean)',
        status: 'pending | done',
        tags: ['Tags'],
      })
      expect(result instanceof z.ZodObject).toBe(true)
      // Verify mixed type validation
      expect(
        result.safeParse({
          name: 'Test',
          count: 5,
          active: true,
          status: 'pending',
          tags: ['tag1', 'tag2'],
        }).success
      ).toBe(true)
    })
  })

  describe('zod passthrough', () => {
    it('passes through existing zod schemas', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      })
      const result = schema(zodSchema)
      expect(result).toBe(zodSchema)
    })
  })
})
