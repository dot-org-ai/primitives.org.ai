/**
 * Tests for ValidationError consistency in schema-validation.ts
 *
 * These tests verify that validateData() throws ValidationError (not generic Error)
 * for consistency with the error handling patterns in digital-objects.
 */
import { describe, it, expect } from 'vitest'
import { validateData } from '../src/schema-validation.js'
import { ValidationError, DigitalObjectsError } from '../src/errors.js'
import type { FieldDefinition } from '../src/types.js'

describe('ValidationError Consistency', () => {
  describe('validateData() error type', () => {
    it('should throw ValidationError, not generic Error', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      // This should be ValidationError, not generic Error
      expect(thrownError).toBeInstanceOf(ValidationError)
    })

    it('should NOT throw just a generic Error', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      // Verify constructor name is ValidationError, not just Error
      expect((thrownError as Error).constructor.name).toBe('ValidationError')
    })
  })

  describe('ValidationError inheritance chain', () => {
    it('should inherit from DigitalObjectsError', () => {
      const schema: Record<string, FieldDefinition> = {
        name: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      expect(thrownError).toBeInstanceOf(DigitalObjectsError)
    })

    it('should also be an instance of Error', () => {
      const schema: Record<string, FieldDefinition> = {
        name: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      expect(thrownError).toBeInstanceOf(Error)
    })
  })

  describe('ValidationError properties', () => {
    it('should have proper fieldErrors array', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
        age: 'number',
      }

      let thrownError: unknown

      try {
        validateData({ age: 'not-a-number' }, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      expect(thrownError).toBeInstanceOf(ValidationError)

      const validationError = thrownError as ValidationError
      expect(validationError.errors).toBeDefined()
      expect(Array.isArray(validationError.errors)).toBe(true)
      expect(validationError.errors.length).toBeGreaterThan(0)
    })

    it('should have field and message in each error', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      const validationError = thrownError as ValidationError

      for (const fieldError of validationError.errors) {
        expect(fieldError).toHaveProperty('field')
        expect(fieldError).toHaveProperty('message')
        expect(typeof fieldError.field).toBe('string')
        expect(typeof fieldError.message).toBe('string')
      }
    })

    it('should have correct field names in errors', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
        name: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      const validationError = thrownError as ValidationError
      const fieldNames = validationError.errors.map((e) => e.field)

      expect(fieldNames).toContain('email')
      expect(fieldNames).toContain('name')
    })

    it('should have VALIDATION_ERROR code', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      const validationError = thrownError as ValidationError
      expect(validationError.code).toBe('VALIDATION_ERROR')
    })

    it('should have 400 status code', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      const validationError = thrownError as ValidationError
      expect(validationError.statusCode).toBe(400)
    })
  })

  describe('ValidationError message', () => {
    it('should contain error count in message', () => {
      const schema: Record<string, FieldDefinition> = {
        email: { type: 'string', required: true },
      }

      let thrownError: unknown

      try {
        validateData({}, schema, { validate: true })
        expect.fail('Should have thrown')
      } catch (error) {
        thrownError = error
      }

      const validationError = thrownError as ValidationError
      expect(validationError.message).toMatch(/Validation failed/)
    })
  })
})
