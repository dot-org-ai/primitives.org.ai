/**
 * Tests for ai-props validation utilities
 */

import { describe, it, expect } from 'vitest'
import {
  validateProps,
  hasRequiredProps,
  getMissingProps,
  isComplete,
  getMissingFromSchema,
  sanitizeProps,
  mergeWithDefaults,
  createValidator,
  assertValidProps,
} from '../src/validate.js'

describe('validateProps', () => {
  it('validates simple string props', () => {
    const result = validateProps(
      { name: 'John', email: 'john@example.com' },
      { name: 'User name', email: 'Email address' }
    )

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('validates props with type hints', () => {
    const result = validateProps(
      { name: 'John', age: 25 },
      { name: 'User name', age: 'Age (number)' }
    )

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects type mismatches', () => {
    const result = validateProps(
      { name: 'John', age: 'twenty-five' },
      { name: 'User name', age: 'Age (number)' }
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.path).toBe('age')
    expect(result.errors[0]?.expected).toBe('number')
  })

  it('validates boolean props', () => {
    const validResult = validateProps(
      { active: true },
      { active: 'Is active (boolean)' }
    )
    expect(validResult.valid).toBe(true)

    const invalidResult = validateProps(
      { active: 'yes' },
      { active: 'Is active (boolean)' }
    )
    expect(invalidResult.valid).toBe(false)
  })

  it('validates array props', () => {
    const result = validateProps(
      { tags: ['a', 'b', 'c'] },
      { tags: ['Tag names'] }
    )

    expect(result.valid).toBe(true)
  })

  it('detects array type mismatch', () => {
    const result = validateProps(
      { tags: 'not-an-array' },
      { tags: ['Tag names'] }
    )

    expect(result.valid).toBe(false)
    expect(result.errors[0]?.expected).toBe('array')
  })

  it('validates nested objects', () => {
    const result = validateProps(
      { user: { name: 'John', age: 25 } },
      { user: { name: 'User name', age: 'Age (number)' } }
    )

    expect(result.valid).toBe(true)
  })

  it('detects nested object errors', () => {
    const result = validateProps(
      { user: { name: 'John', age: 'invalid' } },
      { user: { name: 'User name', age: 'Age (number)' } }
    )

    expect(result.valid).toBe(false)
    expect(result.errors[0]?.path).toBe('user.age')
  })

  it('handles missing optional props', () => {
    const result = validateProps(
      { name: 'John' },
      { name: 'User name', bio: 'Biography' }
    )

    // Missing props without value are considered optional
    expect(result.valid).toBe(true)
  })

  it('validates string schemas', () => {
    const validResult = validateProps(
      { value: 'test' },
      'A test value'
    )
    expect(validResult.valid).toBe(true)

    const invalidResult = validateProps(
      {},
      'A test value'
    )
    expect(invalidResult.valid).toBe(false)
  })
})

describe('hasRequiredProps', () => {
  it('returns true when all required props present', () => {
    expect(hasRequiredProps(
      { name: 'John', email: 'john@example.com' },
      ['name', 'email']
    )).toBe(true)
  })

  it('returns false when required prop missing', () => {
    expect(hasRequiredProps(
      { name: 'John' },
      ['name', 'email']
    )).toBe(false)
  })

  it('returns true for empty required array', () => {
    expect(hasRequiredProps({ name: 'John' }, [])).toBe(true)
  })

  it('handles undefined values', () => {
    expect(hasRequiredProps(
      { name: 'John', email: undefined },
      ['name', 'email']
    )).toBe(false)
  })
})

describe('getMissingProps', () => {
  it('returns empty array when all present', () => {
    expect(getMissingProps(
      { name: 'John', email: 'john@example.com' },
      ['name', 'email']
    )).toEqual([])
  })

  it('returns missing prop keys', () => {
    expect(getMissingProps(
      { name: 'John' },
      ['name', 'email', 'phone']
    )).toEqual(['email', 'phone'])
  })
})

describe('isComplete', () => {
  it('returns true when all schema keys present', () => {
    expect(isComplete(
      { name: 'John', age: 25 },
      { name: 'Name', age: 'Age (number)' }
    )).toBe(true)
  })

  it('returns false when keys missing', () => {
    expect(isComplete(
      { name: 'John' },
      { name: 'Name', age: 'Age (number)' }
    )).toBe(false)
  })

  it('handles string schemas', () => {
    expect(isComplete({ value: 'test' }, 'A value')).toBe(true)
    expect(isComplete({}, 'A value')).toBe(false)
  })
})

describe('getMissingFromSchema', () => {
  it('returns empty array when complete', () => {
    expect(getMissingFromSchema(
      { name: 'John', age: 25 },
      { name: 'Name', age: 'Age' }
    )).toEqual([])
  })

  it('returns missing schema keys', () => {
    expect(getMissingFromSchema(
      { name: 'John' },
      { name: 'Name', age: 'Age', email: 'Email' }
    )).toEqual(['age', 'email'])
  })

  it('handles string schemas', () => {
    expect(getMissingFromSchema({}, 'A value')).toEqual(['value'])
    expect(getMissingFromSchema({ value: 'x' }, 'A value')).toEqual([])
  })
})

describe('sanitizeProps', () => {
  it('removes extra keys not in schema', () => {
    const result = sanitizeProps(
      { name: 'John', extra: 'value', another: 123 },
      { name: 'User name' }
    )

    expect(result).toEqual({ name: 'John' })
  })

  it('keeps all schema keys present in props', () => {
    const result = sanitizeProps(
      { name: 'John', age: 25 },
      { name: 'Name', age: 'Age', email: 'Email' }
    )

    expect(result).toEqual({ name: 'John', age: 25 })
  })

  it('handles string schemas', () => {
    const result = sanitizeProps(
      { value: 'test', extra: 'ignored' },
      'A value'
    )

    expect(result).toEqual({ value: 'test' })
  })
})

describe('mergeWithDefaults', () => {
  it('merges defaults with provided props', () => {
    const result = mergeWithDefaults(
      { name: 'John' },
      { name: 'Default', age: 0 },
      { name: 'Name', age: 'Age (number)' }
    )

    expect(result).toEqual({ name: 'John', age: 0 })
  })

  it('props override defaults', () => {
    const result = mergeWithDefaults(
      { name: 'John', age: 25 },
      { name: 'Default', age: 0 },
      { name: 'Name', age: 'Age' }
    )

    expect(result).toEqual({ name: 'John', age: 25 })
  })

  it('coerces types according to schema', () => {
    const result = mergeWithDefaults(
      { count: '42' },
      { count: 0 },
      { count: 'Count (number)' }
    )

    expect(result.count).toBe(42)
    expect(typeof result.count).toBe('number')
  })

  it('handles integer type hint', () => {
    const result = mergeWithDefaults(
      { count: 42.7 },
      {},
      { count: 'Count (integer)' }
    )

    expect(result.count).toBe(42)
  })
})

describe('createValidator', () => {
  it('creates reusable validator function', () => {
    const validate = createValidator({ name: 'Name', age: 'Age (number)' })

    const valid = validate({ name: 'John', age: 25 })
    expect(valid.valid).toBe(true)

    const invalid = validate({ name: 'John', age: 'invalid' })
    expect(invalid.valid).toBe(false)
  })
})

describe('assertValidProps', () => {
  it('does not throw for valid props', () => {
    expect(() => {
      assertValidProps(
        { name: 'John', age: 25 },
        { name: 'Name', age: 'Age (number)' }
      )
    }).not.toThrow()
  })

  it('throws for invalid props', () => {
    expect(() => {
      assertValidProps(
        { name: 'John', age: 'invalid' },
        { name: 'Name', age: 'Age (number)' }
      )
    }).toThrow('Invalid props')
  })

  it('includes error details in message', () => {
    expect(() => {
      assertValidProps(
        { age: 'invalid' },
        { age: 'Age (number)' }
      )
    }).toThrow('age')
  })
})
