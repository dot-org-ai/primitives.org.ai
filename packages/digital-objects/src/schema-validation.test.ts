import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryProvider } from './memory-provider.js'
import type { DigitalObjectsProvider, FieldDefinition } from './types.js'
import { ValidationError } from './errors.js'

describe('Schema Validation', () => {
  let provider: DigitalObjectsProvider

  beforeEach(async () => {
    provider = createMemoryProvider()
  })

  describe('Thing validation against Noun schema', () => {
    beforeEach(async () => {
      await provider.defineNoun({
        name: 'User',
        schema: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
          age: { type: 'number' },
        },
      })
    })

    it('should accept valid data matching schema', async () => {
      const thing = await provider.create(
        'User',
        {
          name: 'Alice',
          email: 'alice@example.com',
          age: 30,
        },
        undefined,
        { validate: true }
      )
      expect(thing.data.name).toBe('Alice')
    })

    it('should reject data missing required fields', async () => {
      try {
        await provider.create('User', { name: 'Alice' }, undefined, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        const fields = validationError.errors.map((e) => e.field)
        expect(fields).toContain('email')
      }
    })

    it('should reject data with wrong types', async () => {
      try {
        await provider.create(
          'User',
          { name: 'Alice', email: 'a@b.com', age: 'thirty' },
          undefined,
          {
            validate: true,
          }
        )
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        const ageError = validationError.errors.find((e) => e.field === 'age')
        expect(ageError).toBeDefined()
        expect(ageError?.message).toMatch(/number/i)
      }
    })

    it('should allow extra fields not in schema', async () => {
      const thing = await provider.create(
        'User',
        {
          name: 'Alice',
          email: 'alice@example.com',
          nickname: 'Ali',
        },
        undefined,
        { validate: true }
      )
      expect(thing.data.nickname).toBe('Ali')
    })
  })

  describe('Validation opt-in behavior', () => {
    it('should skip validation when validate option is false', async () => {
      await provider.defineNoun({
        name: 'Strict',
        schema: { required: { type: 'string', required: true } },
      })
      // Should NOT throw without validate: true
      const thing = await provider.create('Strict', {})
      expect(thing).toBeDefined()
    })

    it('should skip validation when no schema defined', async () => {
      await provider.defineNoun({ name: 'Flexible' })
      const thing = await provider.create('Flexible', { anything: 'goes' }, undefined, {
        validate: true,
      })
      expect(thing.data.anything).toBe('goes')
    })
  })

  describe('Nested object schemas', () => {
    it('should validate nested objects', async () => {
      await provider.defineNoun({
        name: 'Profile',
        schema: {
          user: { type: 'object', required: true },
        },
      })
      try {
        await provider.create('Profile', { user: 'not-an-object' }, undefined, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        const userError = validationError.errors.find((e) => e.field === 'user')
        expect(userError).toBeDefined()
        expect(userError?.message).toMatch(/object/i)
      }
    })
  })

  describe('Array field validation', () => {
    it('should validate array fields', async () => {
      await provider.defineNoun({
        name: 'Post',
        schema: {
          tags: { type: 'array' },
        },
      })
      try {
        await provider.create('Post', { tags: 'not-array' }, undefined, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        const tagsError = validationError.errors.find((e) => e.field === 'tags')
        expect(tagsError).toBeDefined()
        expect(tagsError?.message).toMatch(/array/i)
      }
    })
  })

  describe('Update validation', () => {
    it('should validate updates when validate option is true', async () => {
      await provider.defineNoun({
        name: 'Item',
        schema: { count: { type: 'number' } },
      })
      const item = await provider.create('Item', { count: 1 })
      try {
        await provider.update(item.id, { count: 'two' }, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        const countError = validationError.errors.find((e) => e.field === 'count')
        expect(countError).toBeDefined()
        expect(countError?.message).toMatch(/number/i)
      }
    })
  })
})
