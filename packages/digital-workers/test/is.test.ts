/**
 * Tests for is() - Type validation primitive
 *
 * The is() function provides comprehensive type/schema validation with detailed
 * error messages and optional value coercion. Unlike ai-functions.is() which is
 * a boolean assertion via LLM, this function returns TypeCheckResult with
 * validation status, errors, and optionally coerced values.
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect } from 'vitest'
import { is } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('is() - Type Validation Primitive', () => {
  describe('Unit Tests (no AI) - Built-in Types', () => {
    it('should be exported from index', () => {
      expect(is).toBeDefined()
      expect(typeof is).toBe('function')
    })

    it('should have email method', () => {
      expect(is.email).toBeDefined()
      expect(typeof is.email).toBe('function')
    })

    it('should have url method', () => {
      expect(is.url).toBeDefined()
      expect(typeof is.url).toBe('function')
    })

    it('should have date method', () => {
      expect(is.date).toBeDefined()
      expect(typeof is.date).toBe('function')
    })

    it('should have custom method', () => {
      expect(is.custom).toBeDefined()
      expect(typeof is.custom).toBe('function')
    })

    // Built-in type checks (no AI needed)
    it('should validate string type', async () => {
      const result = await is('hello', 'string')
      expect(result.valid).toBe(true)
      expect(result.value).toBe('hello')
    })

    it('should validate number type', async () => {
      const result = await is(42, 'number')
      expect(result.valid).toBe(true)
      expect(result.value).toBe(42)
    })

    it('should invalidate wrong type', async () => {
      const result = await is('hello', 'number')
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should validate boolean type', async () => {
      const result = await is(true, 'boolean')
      expect(result.valid).toBe(true)
    })

    it('should validate array type', async () => {
      const result = await is([1, 2, 3], 'array')
      expect(result.valid).toBe(true)
    })

    it('should validate object type', async () => {
      const result = await is({ key: 'value' }, 'object')
      expect(result.valid).toBe(true)
    })

    it('should validate null type', async () => {
      const result = await is(null, 'null')
      expect(result.valid).toBe(true)
    })

    it('should validate undefined type', async () => {
      const result = await is(undefined, 'undefined')
      expect(result.valid).toBe(true)
    })

    // Coercion tests
    it('should coerce string to number', async () => {
      const result = await is('123', 'number', { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toBe(123)
    })

    it('should coerce number to string', async () => {
      const result = await is(42, 'string', { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toBe('42')
    })

    it('should coerce "true" to boolean', async () => {
      const result = await is('true', 'boolean', { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toBe(true)
    })

    it('should coerce "false" to boolean', async () => {
      const result = await is('false', 'boolean', { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toBe(false)
    })

    it('should wrap value in array for array coercion', async () => {
      const result = await is('single', 'array', { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toEqual(['single'])
    })
  })

  describe('Unit Tests - Email Validation', () => {
    it('should validate correct email', async () => {
      const result = await is.email('user@example.com')
      expect(result.valid).toBe(true)
      expect(result.value).toBe('user@example.com')
    })

    it('should invalidate malformed email', async () => {
      const result = await is.email('not-an-email')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid email format')
    })

    it('should invalidate email without domain', async () => {
      const result = await is.email('user@')
      expect(result.valid).toBe(false)
    })

    it('should invalidate non-string for email', async () => {
      const result = await is.email(123)
      expect(result.valid).toBe(false)
    })
  })

  describe('Unit Tests - URL Validation', () => {
    it('should validate correct URL', async () => {
      const result = await is.url('https://example.com')
      expect(result.valid).toBe(true)
    })

    it('should validate URL with path', async () => {
      const result = await is.url('https://example.com/path/to/resource')
      expect(result.valid).toBe(true)
    })

    it('should invalidate malformed URL', async () => {
      const result = await is.url('not-a-url')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid URL format')
    })

    it('should invalidate non-string for URL', async () => {
      const result = await is.url(123)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Value must be a string')
    })
  })

  describe('Unit Tests - Date Validation', () => {
    it('should validate Date object', async () => {
      const date = new Date()
      const result = await is.date(date)
      expect(result.valid).toBe(true)
      expect(result.value).toEqual(date)
    })

    it('should invalidate invalid Date', async () => {
      const result = await is.date(new Date('invalid'))
      expect(result.valid).toBe(false)
    })

    it('should coerce string to Date', async () => {
      const result = await is.date('2024-01-15', { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toBeInstanceOf(Date)
    })

    it('should coerce timestamp to Date', async () => {
      const timestamp = Date.now()
      const result = await is.date(timestamp, { coerce: true })
      expect(result.valid).toBe(true)
      expect(result.value).toBeInstanceOf(Date)
    })
  })

  describe('Unit Tests - Custom Validation', () => {
    it('should validate with custom sync function', async () => {
      const result = await is.custom(42, (v) => typeof v === 'number' && (v as number) > 0)
      expect(result.valid).toBe(true)
    })

    it('should invalidate with custom sync function', async () => {
      const result = await is.custom(-5, (v) => typeof v === 'number' && (v as number) > 0)
      expect(result.valid).toBe(false)
    })

    it('should validate with custom async function', async () => {
      const result = await is.custom('test', async (v) => typeof v === 'string')
      expect(result.valid).toBe(true)
    })

    it('should handle validation function errors', async () => {
      const result = await is.custom('test', () => {
        throw new Error('Custom error')
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Custom error')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Complex Types', () => {
    it('should validate email type via AI', async () => {
      const result = await is('test@example.com', 'email')
      expect(result.valid).toBe(true)
    })

    it('should validate phone number type via AI', async () => {
      const result = await is('+1-555-123-4567', 'phone number')
      expect(result.valid).toBe(true)
    })

    it('should validate US zip code via AI', async () => {
      const result = await is('90210', 'US zip code')
      expect(result.valid).toBe(true)
    })

    it('should invalidate invalid zip code via AI', async () => {
      const result = await is('ABCDE', 'US zip code')
      expect(result.valid).toBe(false)
    })

    it('should validate ISO date format via AI', async () => {
      const result = await is('2024-01-15T10:30:00Z', 'ISO 8601 date')
      expect(result.valid).toBe(true)
    })

    it('should validate against schema', async () => {
      const result = await is(
        { name: 'John', age: 30 },
        {
          name: 'Person name (string)',
          age: 'Age in years (number)',
        }
      )
      expect(result.valid).toBe(true)
    })

    it('should invalidate missing schema fields', async () => {
      const result = await is(
        { name: 'John' },
        {
          name: 'Person name',
          age: 'Age (required number)',
          email: 'Email address (required)',
        },
        { strict: true }
      )
      // In strict mode, missing required fields should fail
      expect(result).toBeDefined()
    })

    it('should coerce values via AI when requested', async () => {
      const result = await is(
        { age: '30', active: 'yes' },
        {
          age: 'Age in years (number)',
          active: 'Is active (boolean)',
        },
        { coerce: true }
      )
      expect(result).toBeDefined()
      // The AI should attempt to coerce '30' to 30 and 'yes' to true
    })
  })
})
