import { describe, it, expect } from 'vitest'
import {
  validateData,
  validateOnly,
  type SchemaValidationError,
  type ValidationResult,
  type ValidationErrorCode,
} from '../src/schema-validation.js'
import type { FieldDefinition } from '../src/types.js'
import { createMemoryProvider } from '../src/memory-provider.js'
import { ValidationError } from '../src/errors.js'

describe('Schema Validation', () => {
  describe('validateOnly', () => {
    it('should return valid:true for data matching schema', () => {
      const schema: Record<string, FieldDefinition> = {
        name: 'string',
        age: 'number',
      }

      const result = validateOnly({ name: 'Alice', age: 25 }, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return valid:true when no schema is provided', () => {
      const result = validateOnly({ anything: 'goes' }, undefined)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return errors for type mismatches', () => {
      const schema: Record<string, FieldDefinition> = {
        name: 'string',
        age: 'number',
      }

      const result = validateOnly({ name: 'Alice', age: '25' }, schema)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('age')
      expect(result.errors[0].code).toBe('TYPE_MISMATCH')
    })

    it('should return errors for missing required fields', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      const result = validateOnly({}, schema)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('email')
      expect(result.errors[0].code).toBe('REQUIRED_FIELD')
    })

    it('should allow missing optional fields', () => {
      const schema: Record<string, FieldDefinition> = {
        name: 'string',
        bio: 'string?', // Optional
      }

      const result = validateOnly({ name: 'Alice' }, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should skip validation for relation types', () => {
      const schema: Record<string, FieldDefinition> = {
        authorId: 'Author.id',
        tags: '[Tag.posts]',
      }

      const result = validateOnly({ authorId: 'abc', tags: ['t1', 't2'] }, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateData', () => {
    it('should not throw when validation is disabled', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      // No options = validation disabled
      expect(() => validateData({}, schema)).not.toThrow()

      // validate: false = validation disabled
      expect(() => validateData({}, schema, { validate: false })).not.toThrow()
    })

    it('should throw on validation failure when enabled', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      expect(() => validateData({}, schema, { validate: true })).toThrow(/Validation failed/)
    })

    it('should include error count in message', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
        name: { type: 'string', required: true },
      }

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toMatch(/2 errors/)
      }
    })

    it('should use singular error count for single error', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toMatch(/1 error/)
      }
    })
  })

  describe('Error Messages', () => {
    it('should include field path in error message', () => {
      const schema: Record<string, FieldDefinition> = {
        age: 'number',
      }

      const result = validateOnly({ age: 'twenty-five' }, schema)

      expect(result.errors[0].message).toContain("'age'")
    })

    it('should include expected and received types', () => {
      const schema: Record<string, FieldDefinition> = {
        count: 'number',
      }

      const result = validateOnly({ count: 'five' }, schema)

      expect(result.errors[0].expected).toBe('number')
      expect(result.errors[0].received).toBe('string')
    })

    it('should have clear missing field message', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      const result = validateOnly({}, schema)

      expect(result.errors[0].message).toBe("Missing required field 'email'")
    })

    it('should have clear type mismatch message', () => {
      const schema: Record<string, FieldDefinition> = {
        age: 'number',
      }

      const result = validateOnly({ age: 'not-a-number' }, schema)

      expect(result.errors[0].message).toBe(
        "Field 'age' has wrong type: expected number, got string"
      )
    })
  })

  describe('Suggestions', () => {
    it('should suggest conversion for string to number', () => {
      const schema: Record<string, FieldDefinition> = {
        age: 'number',
      }

      const result = validateOnly({ age: '25' }, schema)

      expect(result.errors[0].suggestion).toBe('Convert to number: 25')
    })

    it('should suggest valid number for non-numeric string', () => {
      const schema: Record<string, FieldDefinition> = {
        age: 'number',
      }

      const result = validateOnly({ age: 'twenty-five' }, schema)

      expect(result.errors[0].suggestion).toBe('Provide a valid number')
    })

    it('should suggest conversion for number to string', () => {
      const schema: Record<string, FieldDefinition> = {
        name: 'string',
      }

      const result = validateOnly({ name: 42 }, schema)

      expect(result.errors[0].suggestion).toBe('Convert to string: "42"')
    })

    it('should suggest conversion for string boolean', () => {
      const schema: Record<string, FieldDefinition> = {
        active: 'boolean',
      }

      const result = validateOnly({ active: 'true' }, schema)

      expect(result.errors[0].suggestion).toBe('Convert to boolean: true')
    })

    it('should suggest wrapping value in array', () => {
      const schema: Record<string, FieldDefinition> = {
        items: { type: 'array', required: true },
      }

      const result = validateOnly({ items: 'single-item' }, schema)

      expect(result.errors[0].suggestion).toBe('Wrap value in an array: [value]')
    })

    it('should suggest object format', () => {
      const schema: Record<string, FieldDefinition> = {
        metadata: { type: 'object', required: true },
      }

      const result = validateOnly({ metadata: 'not-an-object' }, schema)

      expect(result.errors[0].suggestion).toBe('Provide an object: { ... }')
    })
  })

  describe('Special Types', () => {
    it('should validate date/datetime as string', () => {
      const schema: Record<string, FieldDefinition> = {
        createdAt: 'datetime',
        publishDate: 'date',
      }

      // Valid - strings are accepted
      const validResult = validateOnly(
        {
          createdAt: '2024-01-15T10:00:00Z',
          publishDate: '2024-01-15',
        },
        schema
      )
      expect(validResult.valid).toBe(true)

      // Invalid - numbers are not accepted
      const invalidResult = validateOnly({ createdAt: 1705312800000 }, schema)
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors[0].suggestion).toBe('Provide a valid ISO 8601 date string')
    })

    it('should validate url as string', () => {
      const schema: Record<string, FieldDefinition> = {
        website: 'url',
      }

      const validResult = validateOnly({ website: 'https://example.com' }, schema)
      expect(validResult.valid).toBe(true)

      const invalidResult = validateOnly({ website: 123 }, schema)
      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors[0].suggestion).toBe(
        'Provide a valid URL starting with http:// or https://'
      )
    })

    it('should validate markdown as string', () => {
      const schema: Record<string, FieldDefinition> = {
        content: 'markdown',
      }

      const validResult = validateOnly({ content: '# Hello\n\nWorld' }, schema)
      expect(validResult.valid).toBe(true)

      const invalidResult = validateOnly({ content: { text: 'hello' } }, schema)
      expect(invalidResult.valid).toBe(false)
    })

    it('should validate json as string', () => {
      const schema: Record<string, FieldDefinition> = {
        config: 'json',
      }

      const validResult = validateOnly({ config: '{"key": "value"}' }, schema)
      expect(validResult.valid).toBe(true)
    })
  })

  describe('Extended Field Definitions', () => {
    it('should validate required fields', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
        name: { type: 'string', required: false },
        bio: { type: 'string' }, // required defaults to false
      }

      // Missing required field
      const result1 = validateOnly({ name: 'Alice', bio: 'Hello' }, schema)
      expect(result1.valid).toBe(false)
      expect(result1.errors).toHaveLength(1)
      expect(result1.errors[0].field).toBe('email')

      // With required field
      const result2 = validateOnly({ email: 'alice@example.com' }, schema)
      expect(result2.valid).toBe(true)
    })

    it('should handle null as missing for required fields', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      const result = validateOnly({ email: null }, schema)
      expect(result.valid).toBe(false)
      expect(result.errors[0].received).toBe('null')
    })
  })

  describe('Integration with MemoryProvider', () => {
    it('should validate on create when enabled', async () => {
      const provider = createMemoryProvider()

      await provider.defineNoun({
        name: 'User',
        schema: {
          email: { type: 'string', required: true },
          age: 'number',
        },
      })

      // Without validation - should succeed
      const user1 = await provider.create('User', { name: 'Anonymous' })
      expect(user1.id).toBeDefined()

      // With validation - should fail
      await expect(
        provider.create('User', { name: 'Anonymous' }, undefined, { validate: true })
      ).rejects.toThrow(/Validation failed/)
    })

    it('should include field errors in ValidationError', async () => {
      const provider = createMemoryProvider()

      await provider.defineNoun({
        name: 'Product',
        schema: {
          price: 'number',
        },
      })

      try {
        await provider.create('Product', { price: '19.99' }, undefined, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        expect(validationError.errors).toHaveLength(1)
        expect(validationError.errors[0].field).toBe('price')
        expect(validationError.errors[0].message).toMatch(/number/i)
      }
    })
  })

  describe('Error Codes', () => {
    it('should use REQUIRED_FIELD code for missing required fields', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      const result = validateOnly({}, schema)
      expect(result.errors[0].code).toBe('REQUIRED_FIELD')
    })

    it('should use TYPE_MISMATCH code for wrong types', () => {
      const schema: Record<string, FieldDefinition> = {
        count: 'number',
      }

      const result = validateOnly({ count: 'five' }, schema)
      expect(result.errors[0].code).toBe('TYPE_MISMATCH')
    })
  })

  describe('Multiple Errors', () => {
    it('should collect all validation errors', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
        age: 'number',
        active: 'boolean',
      }

      const result = validateOnly({ age: 'not-a-number', active: 'yes' }, schema)

      expect(result.errors).toHaveLength(3)

      const codes = result.errors.map((e) => e.code)
      expect(codes).toContain('REQUIRED_FIELD')
      expect(codes.filter((c) => c === 'TYPE_MISMATCH')).toHaveLength(2)
    })

    it('should include multiple errors in ValidationError errors array', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
        age: 'number',
      }

      try {
        validateData({ age: 'twenty' }, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        expect(validationError.errors).toHaveLength(2)

        const fields = validationError.errors.map((e) => e.field)
        expect(fields).toContain('email')
        expect(fields).toContain('age')

        const emailError = validationError.errors.find((e) => e.field === 'email')
        expect(emailError?.message).toMatch(/required/i)

        const ageError = validationError.errors.find((e) => e.field === 'age')
        expect(ageError?.message).toMatch(/wrong type/i)
      }
    })
  })
})
