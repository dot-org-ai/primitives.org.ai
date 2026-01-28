/**
 * @org.ai/types - Field Type Tests
 *
 * Tests for field type definitions:
 * - FieldType: Union of supported field types
 * - Field: Field definition with name, type, required, default
 * - FieldValue: Discriminated union based on FieldType
 * - FieldValueFor: Type helper to extract value type
 * - isFieldValue: Type guard function
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  FieldType,
  Field,
  FieldValue,
  FieldValueFor,
  FieldConstraints,
  FieldDefinition,
} from '../src/index.js'
import { isFieldValue } from '../src/index.js'

describe('FieldType union', () => {
  it('should include all expected types', () => {
    // Type-level test: all these should be valid FieldType values
    const types: FieldType[] = [
      'string',
      'number',
      'boolean',
      'date',
      'datetime',
      'markdown',
      'json',
      'url',
      'email',
      'blob',
    ]
    expect(types).toHaveLength(10)
  })

  it('should reject invalid types at compile time', () => {
    // This is a compile-time test - if this compiles, the type is correct
    // @ts-expect-error - 'invalid' is not a valid FieldType
    const invalid: FieldType = 'invalid'
    expect(invalid).toBe('invalid') // runtime doesn't matter, type error is the test
  })
})

describe('Field interface', () => {
  it('should require name and type', () => {
    const field: Field = {
      name: 'email',
      type: 'email',
    }
    expect(field.name).toBe('email')
    expect(field.type).toBe('email')
  })

  it('should allow optional required property', () => {
    const requiredField: Field = {
      name: 'id',
      type: 'string',
      required: true,
    }
    expect(requiredField.required).toBe(true)

    const optionalField: Field = {
      name: 'nickname',
      type: 'string',
      required: false,
    }
    expect(optionalField.required).toBe(false)
  })

  it('should allow optional default value', () => {
    const fieldWithDefault: Field = {
      name: 'status',
      type: 'string',
      default: 'pending',
    }
    expect(fieldWithDefault.default).toBe('pending')
  })

  it('should allow optional description', () => {
    const field: Field = {
      name: 'bio',
      type: 'markdown',
      description: 'User biography in markdown format',
    }
    expect(field.description).toBe('User biography in markdown format')
  })

  it('should allow optional array flag', () => {
    const arrayField: Field = {
      name: 'tags',
      type: 'string',
      array: true,
    }
    expect(arrayField.array).toBe(true)
  })

  it('should work with all field types', () => {
    const fields: Field[] = [
      { name: 'title', type: 'string' },
      { name: 'count', type: 'number' },
      { name: 'active', type: 'boolean' },
      { name: 'birthday', type: 'date' },
      { name: 'createdAt', type: 'datetime' },
      { name: 'content', type: 'markdown' },
      { name: 'metadata', type: 'json' },
      { name: 'website', type: 'url' },
      { name: 'contact', type: 'email' },
      { name: 'avatar', type: 'blob' },
    ]
    expect(fields).toHaveLength(10)
  })
})

describe('FieldValue discriminated union', () => {
  it('should discriminate on type property', () => {
    const stringValue: FieldValue = { type: 'string', value: 'hello' }
    const numberValue: FieldValue = { type: 'number', value: 42 }
    const booleanValue: FieldValue = { type: 'boolean', value: true }

    // Type narrowing should work
    if (stringValue.type === 'string') {
      expectTypeOf(stringValue.value).toBeString()
    }
    if (numberValue.type === 'number') {
      expectTypeOf(numberValue.value).toBeNumber()
    }
    if (booleanValue.type === 'boolean') {
      expectTypeOf(booleanValue.value).toBeBoolean()
    }
  })

  it('should support all field types', () => {
    const values: FieldValue[] = [
      { type: 'string', value: 'text' },
      { type: 'number', value: 123 },
      { type: 'boolean', value: false },
      { type: 'date', value: new Date() },
      { type: 'datetime', value: new Date() },
      { type: 'markdown', value: '# Heading' },
      { type: 'json', value: { key: 'value' } },
      { type: 'url', value: 'https://example.com' },
      { type: 'email', value: 'test@example.com' },
      { type: 'blob', value: new ArrayBuffer(8) },
    ]
    expect(values).toHaveLength(10)
  })

  it('should enforce correct value types', () => {
    // These should all compile
    const valid: FieldValue = { type: 'number', value: 42 }
    expect(valid.value).toBe(42)

    // @ts-expect-error - string value for number type should fail
    const invalid: FieldValue = { type: 'number', value: 'not a number' }
    expect(invalid.value).toBe('not a number')
  })

  it('should narrow types correctly in switch statements', () => {
    function processFieldValue(fv: FieldValue): string {
      switch (fv.type) {
        case 'string':
          return fv.value.toUpperCase()
        case 'number':
          return fv.value.toFixed(2)
        case 'boolean':
          return fv.value ? 'yes' : 'no'
        case 'date':
        case 'datetime':
          return fv.value.toISOString()
        case 'markdown':
          return `md:${fv.value}`
        case 'json':
          return JSON.stringify(fv.value)
        case 'url':
        case 'email':
          return fv.value
        case 'blob':
          return '[blob]'
      }
    }

    expect(processFieldValue({ type: 'string', value: 'hello' })).toBe('HELLO')
    expect(processFieldValue({ type: 'number', value: 3.14159 })).toBe('3.14')
    expect(processFieldValue({ type: 'boolean', value: true })).toBe('yes')
  })
})

describe('FieldValueFor type helper', () => {
  it('should extract correct value type for string', () => {
    type StringValue = FieldValueFor<'string'>
    expectTypeOf<StringValue>().toEqualTypeOf<string>()
  })

  it('should extract correct value type for number', () => {
    type NumberValue = FieldValueFor<'number'>
    expectTypeOf<NumberValue>().toEqualTypeOf<number>()
  })

  it('should extract correct value type for boolean', () => {
    type BoolValue = FieldValueFor<'boolean'>
    expectTypeOf<BoolValue>().toEqualTypeOf<boolean>()
  })

  it('should extract correct value type for date', () => {
    type DateValue = FieldValueFor<'date'>
    expectTypeOf<DateValue>().toEqualTypeOf<Date>()
  })

  it('should extract correct value type for json', () => {
    type JsonValue = FieldValueFor<'json'>
    expectTypeOf<JsonValue>().toEqualTypeOf<unknown>()
  })
})

describe('isFieldValue type guard', () => {
  it('should return true for valid FieldValue objects', () => {
    expect(isFieldValue({ type: 'string', value: 'hello' })).toBe(true)
    expect(isFieldValue({ type: 'number', value: 42 })).toBe(true)
    expect(isFieldValue({ type: 'boolean', value: true })).toBe(true)
    expect(isFieldValue({ type: 'date', value: new Date() })).toBe(true)
    expect(isFieldValue({ type: 'markdown', value: '# Title' })).toBe(true)
    expect(isFieldValue({ type: 'json', value: { a: 1 } })).toBe(true)
    expect(isFieldValue({ type: 'url', value: 'https://test.com' })).toBe(true)
    expect(isFieldValue({ type: 'email', value: 'a@b.com' })).toBe(true)
  })

  it('should return false for invalid objects', () => {
    expect(isFieldValue(null)).toBe(false)
    expect(isFieldValue(undefined)).toBe(false)
    expect(isFieldValue('string')).toBe(false)
    expect(isFieldValue(42)).toBe(false)
    expect(isFieldValue({})).toBe(false)
    expect(isFieldValue({ type: 'invalid', value: 'x' })).toBe(false)
    expect(isFieldValue({ type: 'string' })).toBe(false) // missing value
  })

  it('should narrow types when used as guard', () => {
    const maybeFieldValue: unknown = { type: 'string', value: 'test' }

    if (isFieldValue(maybeFieldValue)) {
      // Type should be narrowed to FieldValue
      expectTypeOf(maybeFieldValue).toEqualTypeOf<FieldValue>()
      expect(maybeFieldValue.type).toBe('string')
    }
  })
})

describe('FieldConstraints interface', () => {
  it('should have all constraint properties', () => {
    const constraints: FieldConstraints = {
      required: true,
      optional: false,
      array: true,
      unique: true,
      indexed: true,
      default: 'default_value',
      min: 0,
      max: 100,
      pattern: '^[a-z]+$',
    }

    expect(constraints.required).toBe(true)
    expect(constraints.array).toBe(true)
    expect(constraints.unique).toBe(true)
    expect(constraints.indexed).toBe(true)
    expect(constraints.min).toBe(0)
    expect(constraints.max).toBe(100)
    expect(constraints.pattern).toBe('^[a-z]+$')
  })

  it('should allow partial constraints', () => {
    const minimalConstraints: FieldConstraints = {}
    expect(minimalConstraints).toBeDefined()

    const partialConstraints: FieldConstraints = {
      required: true,
    }
    expect(partialConstraints.required).toBe(true)
  })
})

describe('FieldDefinition interface', () => {
  it('should extend FieldConstraints', () => {
    const definition: FieldDefinition = {
      type: 'string',
      required: true,
      min: 1,
      max: 255,
      description: 'A string field',
    }

    expect(definition.type).toBe('string')
    expect(definition.required).toBe(true)
    expect(definition.min).toBe(1)
    expect(definition.max).toBe(255)
    expect(definition.description).toBe('A string field')
  })

  it('should support relationship fields', () => {
    const relationField: FieldDefinition = {
      type: 'string',
      operator: '->',
      relatedType: 'User',
    }

    expect(relationField.operator).toBe('->')
    expect(relationField.relatedType).toBe('User')
  })

  it('should support fuzzy relationships with threshold', () => {
    const fuzzyField: FieldDefinition = {
      type: 'string',
      operator: '~>',
      relatedType: 'Document',
      threshold: 0.8,
    }

    expect(fuzzyField.operator).toBe('~>')
    expect(fuzzyField.threshold).toBe(0.8)
  })
})
