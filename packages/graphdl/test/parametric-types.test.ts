import { describe, it, expect } from 'vitest'
import { Graph } from '../src/index.js'

describe('Parametric Type Parsing', () => {
  describe('decimal(precision, scale)', () => {
    it('parses decimal(10,2) with precision and scale', () => {
      const schema = Graph({
        Product: { price: 'decimal(10,2)' },
      })
      const field = schema.entities.get('Product')?.fields.get('price')
      expect(field?.type).toBe('decimal')
      expect(field?.precision).toBe(10)
      expect(field?.scale).toBe(2)
      expect(field?.isRelation).toBe(false)
    })

    it('parses decimal(18,6)', () => {
      const schema = Graph({
        Financial: { amount: 'decimal(18,6)' },
      })
      const field = schema.entities.get('Financial')?.fields.get('amount')
      expect(field?.type).toBe('decimal')
      expect(field?.precision).toBe(18)
      expect(field?.scale).toBe(6)
    })

    it('parses decimal(5,0) with zero scale', () => {
      const schema = Graph({
        Counter: { value: 'decimal(5,0)' },
      })
      const field = schema.entities.get('Counter')?.fields.get('value')
      expect(field?.type).toBe('decimal')
      expect(field?.precision).toBe(5)
      expect(field?.scale).toBe(0)
    })
  })

  describe('varchar(length)', () => {
    it('parses varchar(255)', () => {
      const schema = Graph({
        User: { name: 'varchar(255)' },
      })
      const field = schema.entities.get('User')?.fields.get('name')
      expect(field?.type).toBe('varchar')
      expect(field?.length).toBe(255)
      expect(field?.isRelation).toBe(false)
    })

    it('parses varchar(50)', () => {
      const schema = Graph({
        Country: { code: 'varchar(50)' },
      })
      const field = schema.entities.get('Country')?.fields.get('code')
      expect(field?.type).toBe('varchar')
      expect(field?.length).toBe(50)
    })
  })

  describe('char(length)', () => {
    it('parses char(10)', () => {
      const schema = Graph({
        Record: { code: 'char(10)' },
      })
      const field = schema.entities.get('Record')?.fields.get('code')
      expect(field?.type).toBe('char')
      expect(field?.length).toBe(10)
      expect(field?.isRelation).toBe(false)
    })

    it('parses char(2)', () => {
      const schema = Graph({
        Country: { isoCode: 'char(2)' },
      })
      const field = schema.entities.get('Country')?.fields.get('isoCode')
      expect(field?.type).toBe('char')
      expect(field?.length).toBe(2)
    })
  })

  describe('fixed(length)', () => {
    it('parses fixed(256)', () => {
      const schema = Graph({
        Hash: { value: 'fixed(256)' },
      })
      const field = schema.entities.get('Hash')?.fields.get('value')
      expect(field?.type).toBe('fixed')
      expect(field?.length).toBe(256)
      expect(field?.isRelation).toBe(false)
    })

    it('parses fixed(16)', () => {
      const schema = Graph({
        Identifier: { bytes: 'fixed(16)' },
      })
      const field = schema.entities.get('Identifier')?.fields.get('bytes')
      expect(field?.type).toBe('fixed')
      expect(field?.length).toBe(16)
    })
  })

  describe('parametric types with modifiers', () => {
    it('parses decimal(10,2) with optional modifier', () => {
      const schema = Graph({
        Product: { price: 'decimal(10,2)?' },
      })
      const field = schema.entities.get('Product')?.fields.get('price')
      expect(field?.type).toBe('decimal')
      expect(field?.precision).toBe(10)
      expect(field?.scale).toBe(2)
      expect(field?.isOptional).toBe(true)
    })

    it('parses varchar(255) with required modifier', () => {
      const schema = Graph({
        User: { email: 'varchar(255)!' },
      })
      const field = schema.entities.get('User')?.fields.get('email')
      expect(field?.type).toBe('varchar')
      expect(field?.length).toBe(255)
      expect(field?.isRequired).toBe(true)
      expect(field?.isUnique).toBe(true)
    })

    it('parses char(10) with indexed modifier', () => {
      const schema = Graph({
        Record: { code: 'char(10)#' },
      })
      const field = schema.entities.get('Record')?.fields.get('code')
      expect(field?.type).toBe('char')
      expect(field?.length).toBe(10)
      expect(field?.isIndexed).toBe(true)
    })

    it('parses fixed(256) with array modifier', () => {
      const schema = Graph({
        Hash: { values: 'fixed(256)[]' },
      })
      const field = schema.entities.get('Hash')?.fields.get('values')
      expect(field?.type).toBe('fixed')
      expect(field?.length).toBe(256)
      expect(field?.isArray).toBe(true)
    })

    it('parses decimal(10,2) with combined modifiers', () => {
      const schema = Graph({
        Product: { prices: 'decimal(10,2)[]?' },
      })
      const field = schema.entities.get('Product')?.fields.get('prices')
      expect(field?.type).toBe('decimal')
      expect(field?.precision).toBe(10)
      expect(field?.scale).toBe(2)
      expect(field?.isArray).toBe(true)
      expect(field?.isOptional).toBe(true)
    })
  })

  describe('plain types without parameters', () => {
    it('decimal without params still works', () => {
      const schema = Graph({
        Product: { price: 'decimal' },
      })
      const field = schema.entities.get('Product')?.fields.get('price')
      expect(field?.type).toBe('decimal')
      expect(field?.precision).toBeUndefined()
      expect(field?.scale).toBeUndefined()
    })
  })

  describe('backwards compatibility', () => {
    it('existing types still parse correctly', () => {
      const schema = Graph({
        User: {
          name: 'string',
          age: 'int',
          active: 'boolean',
        },
      })
      const user = schema.entities.get('User')
      expect(user?.fields.get('name')?.type).toBe('string')
      expect(user?.fields.get('age')?.type).toBe('int')
      expect(user?.fields.get('active')?.type).toBe('boolean')
    })
  })
})
