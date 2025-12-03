/**
 * Tests for schema conversion
 *
 * These are pure unit tests - no AI calls needed.
 */

import { describe, it, expect } from 'vitest'
import { schema } from '../src/index.js'
import { z } from 'zod'

describe('schema', () => {
  describe('string types', () => {
    it('converts simple string description to z.string()', () => {
      const result = schema('User name')
      expect(result._def.typeName).toBe('ZodString')
      expect(result._def.description).toBe('User name')
    })

    it('converts (number) hint to z.number()', () => {
      const result = schema('User age (number)')
      expect(result._def.typeName).toBe('ZodNumber')
      expect(result._def.description).toBe('User age')
    })

    it('converts (boolean) hint to z.boolean()', () => {
      const result = schema('Is active (boolean)')
      expect(result._def.typeName).toBe('ZodBoolean')
      expect(result._def.description).toBe('Is active')
    })

    it('converts (integer) hint to z.number().int()', () => {
      const result = schema('Item count (integer)')
      expect(result._def.typeName).toBe('ZodNumber')
      expect(result._def.checks?.some((c: { kind: string }) => c.kind === 'int')).toBe(true)
    })

    it('converts (date) hint to z.string().datetime()', () => {
      const result = schema('Created at (date)')
      expect(result._def.typeName).toBe('ZodString')
      expect(result._def.checks?.some((c: { kind: string }) => c.kind === 'datetime')).toBe(true)
    })
  })

  describe('enum types', () => {
    it('converts pipe-separated values to z.enum()', () => {
      const result = schema('pending | done | cancelled')
      expect(result._def.typeName).toBe('ZodEnum')
      expect(result._def.values).toEqual(['pending', 'done', 'cancelled'])
    })

    it('handles spaces around pipe', () => {
      const result = schema('yes | no | maybe')
      expect(result._def.values).toEqual(['yes', 'no', 'maybe'])
    })
  })

  describe('array types', () => {
    it('converts [string] to z.array(z.string())', () => {
      const result = schema(['List of items'])
      expect(result._def.typeName).toBe('ZodArray')
      expect(result._def.type._def.typeName).toBe('ZodString')
      expect(result._def.description).toBe('List of items')
    })
  })

  describe('object types', () => {
    it('converts object to z.object()', () => {
      const result = schema({
        name: 'User name',
        age: 'Age (number)',
      })
      expect(result._def.typeName).toBe('ZodObject')
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
      expect(result._def.typeName).toBe('ZodObject')
    })

    it('handles mixed types in object', () => {
      const result = schema({
        name: 'Name',
        count: 'Count (number)',
        active: 'Active (boolean)',
        status: 'pending | done',
        tags: ['Tags'],
      })
      expect(result._def.typeName).toBe('ZodObject')
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
