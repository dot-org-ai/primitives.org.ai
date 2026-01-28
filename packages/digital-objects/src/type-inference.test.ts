import { describe, it, expect } from 'vitest'
import { parseFieldType, parseField, parseEnumValues, isGenerativeString } from './do'

describe('parseFieldType', () => {
  it('detects number from suffix', () => {
    expect(parseFieldType('Score (number)')).toBe('number')
    expect(parseFieldType('Revenue (NUMBER)')).toBe('number') // case insensitive
  })

  it('detects date from suffix', () => {
    expect(parseFieldType('Created (date)')).toBe('date')
  })

  it('detects boolean from suffix', () => {
    expect(parseFieldType('Active (boolean)')).toBe('boolean')
  })

  it('detects enum from pipe syntax', () => {
    expect(parseFieldType('Seed | SeriesA | SeriesB')).toBe('enum')
    expect(parseFieldType('A | B')).toBe('enum')
  })

  it('defaults to string', () => {
    expect(parseFieldType('Plain description')).toBe('string')
    expect(parseFieldType('Name')).toBe('string')
  })
})

describe('parseEnumValues', () => {
  it('extracts enum values', () => {
    expect(parseEnumValues('A | B | C')).toEqual(['A', 'B', 'C'])
    expect(parseEnumValues('Seed | SeriesA | SeriesB')).toEqual(['Seed', 'SeriesA', 'SeriesB'])
  })

  it('trims whitespace', () => {
    expect(parseEnumValues('A  |  B  |  C')).toEqual(['A', 'B', 'C'])
  })

  it('returns undefined for non-enum', () => {
    expect(parseEnumValues('Plain description')).toBeUndefined()
  })
})

describe('parseField', () => {
  it('parses string field', () => {
    const field = parseField('name', 'Company name')
    expect(field.name).toBe('name')
    expect(field.type).toBe('string')
    expect(field.description).toBe('Company name')
  })

  it('parses number field', () => {
    const field = parseField('mrr', 'Monthly revenue (number)')
    expect(field.type).toBe('number')
    expect(field.description).toBe('Monthly revenue')
  })

  it('parses enum field', () => {
    const field = parseField('stage', 'Seed | SeriesA | SeriesB')
    expect(field.type).toBe('enum')
    expect(field.enumValues).toEqual(['Seed', 'SeriesA', 'SeriesB'])
  })

  it('parses array field', () => {
    const field = parseField('tags', ['Tag name'])
    expect(field.type).toBe('array')
    expect(field.arrayItem?.type).toBe('string')
  })

  it('parses nested object field', () => {
    const field = parseField('meta', { foo: 'Foo value', bar: 'Bar (number)' })
    expect(field.type).toBe('object')
    expect(field.nested).toHaveProperty('foo')
    expect(field.nested).toHaveProperty('bar')
    expect(field.nested?.bar.type).toBe('number')
  })
})

describe('isGenerativeString', () => {
  it('detects template variables', () => {
    expect(isGenerativeString('Generate pitch for {name}')).toBe(true)
    expect(isGenerativeString('Summarize {text} in {style} style')).toBe(true)
  })

  it('returns false for plain strings', () => {
    expect(isGenerativeString('Company name')).toBe(false)
    expect(isGenerativeString('Plain description')).toBe(false)
  })

  it('returns false for empty braces', () => {
    expect(isGenerativeString('Empty {} braces')).toBe(false)
  })
})
