/**
 * Tests for Duplicate ValidationError Class Definition
 *
 * Issue: ValidationError is defined twice with DIFFERENT signatures:
 * - errors.ts:152-167: ValidationError extends DatabaseError
 *   constructor(message, entityType, field?, value?, cause?)
 * - validation.ts:260-269: ValidationError extends Error
 *   constructor(message, field, value?)
 *
 * This is TDD RED phase - tests expose the bug that should be fixed.
 *
 * The exported ValidationError from index.ts comes from errors.ts,
 * but validation.ts uses its own local definition which:
 * 1. Does NOT extend DatabaseError (loses the error hierarchy)
 * 2. Has different constructor signature (no entityType parameter)
 * 3. Creates two different "ValidationError" classes with same name
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { ValidationError, DatabaseError } from '../src/index.js'

// Import directly from source files to test the duplicate definition
import { ValidationError as ErrorsValidationError } from '../src/errors.js'
import { ValidationError as ValidationTsValidationError } from '../src/validation.js'

describe('ValidationError Duplicate Class Definition', () => {
  describe('Canonical Export from errors.ts', () => {
    it('ValidationError from index.ts should be from errors.ts', () => {
      // The canonical export should be from errors.ts
      expect(ValidationError).toBe(ErrorsValidationError)
    })

    it('ValidationError should be instanceof DatabaseError', () => {
      const error = new ValidationError('test message', 'TestEntity', 'testField')
      expect(error).toBeInstanceOf(DatabaseError)
      expect(error).toBeInstanceOf(Error)
    })

    it('ValidationError should have code property', () => {
      const error = new ValidationError('test message', 'TestEntity')
      expect(error.code).toBe('VALIDATION_ERROR')
    })

    it('ValidationError should have DatabaseError properties', () => {
      const error = new ValidationError('test message', 'TestEntity', 'email', 'bad@')
      expect(error.operation).toBe('validate')
      expect(error.entityType).toBe('TestEntity')
      expect(error.field).toBe('email')
      expect(error.value).toBe('bad@')
    })
  })

  describe('Consolidation Verification (BUG FIXED)', () => {
    /**
     * These tests verify that the duplicate ValidationError has been removed
     * and both modules now use the same class from errors.ts
     */
    it('validation.ts now exports the same ValidationError as errors.ts', () => {
      // After fix: both modules export the same class
      const sameClass = ValidationTsValidationError === ErrorsValidationError
      expect(sameClass).toBe(true)
    })

    it('validation.ts ValidationError extends DatabaseError', () => {
      // After fix: validation.ts re-exports from errors.ts which extends DatabaseError
      const validationTsError = new ValidationTsValidationError('msg', 'Input', 'field')

      const extendsError = validationTsError instanceof Error
      const extendsDatabase = validationTsError instanceof DatabaseError

      expect(extendsError).toBe(true)
      expect(extendsDatabase).toBe(true)
    })

    it('validation.ts ValidationError has code property', () => {
      const validationTsError = new ValidationTsValidationError('msg', 'Input', 'field')

      // After fix: has the 'code' property from errors.ts
      const hasCode = 'code' in validationTsError
      expect(hasCode).toBe(true)
      expect(validationTsError.code).toBe('VALIDATION_ERROR')
    })

    it('validation.ts ValidationError has same constructor signature as errors.ts', () => {
      // Both now use: constructor(message, entityType, field?, value?, cause?)

      // Create using errors.ts signature
      const errorsVersion = new ErrorsValidationError('msg', 'User', 'email', 'bad@')
      expect(errorsVersion.entityType).toBe('User')
      expect(errorsVersion.field).toBe('email')

      // Create using validation.ts - same signature now
      const validationVersion = new ValidationTsValidationError('msg', 'User', 'email', 'bad@')
      expect(validationVersion.entityType).toBe('User')
      expect(validationVersion.field).toBe('email')
    })
  })

  describe('Error Message Format Consistency', () => {
    it('errors.ts ValidationError has rich formatted message', () => {
      const error = new ErrorsValidationError('Invalid email format', 'User', 'email')
      // Format: "Validation failed for User.email: Invalid email format"
      expect(error.message).toContain('Validation failed')
      expect(error.message).toContain('User')
      expect(error.message).toContain('email')
    })

    it('validation.ts ValidationError now has rich formatted message (FIXED)', () => {
      // After fix: validation.ts re-exports from errors.ts which has rich formatting
      const error = new ValidationTsValidationError('Invalid email format', 'User', 'email')
      // Format: "Validation failed for User.email: Invalid email format"
      expect(error.message).toContain('Validation failed')
      expect(error.message).toContain('User')
      expect(error.message).toContain('email')
    })
  })

  describe('Single Export Verification', () => {
    it('should have only ONE ValidationError class in module exports (FIXED)', async () => {
      // Dynamically import and check if both modules export the same class
      const errorsModule = await import('../src/errors.js')
      const validationModule = await import('../src/validation.js')

      // After fix: both modules use the same ValidationError class
      const sameClass = errorsModule.ValidationError === validationModule.ValidationError
      expect(sameClass).toBe(true)
    })

    it('index.ts should re-export ValidationError from errors.ts only', async () => {
      const indexModule = await import('../src/index.js')
      const errorsModule = await import('../src/errors.js')

      // The public export should be from errors.ts
      expect(indexModule.ValidationError).toBe(errorsModule.ValidationError)
    })
  })

  describe('instanceof Behavior Consistency (FIXED)', () => {
    /**
     * After fix: all ValidationError instances properly match instanceof checks
     */
    it('validation.ts errors pass instanceof check with exported class (FIXED)', () => {
      // Error created by validation.ts - now using same class as errors.ts
      const internalError = new ValidationTsValidationError('Internal error', 'Input', 'field')

      // Check using exported ValidationError (from errors.ts)
      const matchesExported = internalError instanceof ValidationError
      expect(matchesExported).toBe(true)

      // After fix: validation functions throw errors that are properly caught
    })

    it('errors.ts ValidationError passes instanceof check correctly', () => {
      const error = new ErrorsValidationError('Error from errors.ts', 'User')
      expect(error instanceof ValidationError).toBe(true)
      expect(error instanceof DatabaseError).toBe(true)
    })
  })

  describe('Practical Impact (FIXED)', () => {
    /**
     * After fix: error handling works consistently
     */
    it('catching ValidationError correctly catches all validation errors (FIXED)', () => {
      // Simulating error handling code that uses the exported ValidationError
      function handleDatabaseError(error: unknown): string {
        if (error instanceof ValidationError) {
          return 'validation-error'
        }
        if (error instanceof DatabaseError) {
          return 'database-error'
        }
        if (error instanceof Error) {
          return 'generic-error'
        }
        return 'unknown'
      }

      // Error from errors.ts - correctly caught
      const errorsError = new ErrorsValidationError('msg', 'Type')
      expect(handleDatabaseError(errorsError)).toBe('validation-error')

      // Error from validation.ts - now correctly caught as ValidationError
      const validationError = new ValidationTsValidationError('msg', 'Input', 'field')
      expect(handleDatabaseError(validationError)).toBe('validation-error')
    })
  })
})
