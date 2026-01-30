import { describe, it, expect } from 'vitest'
import { Graph, PRIMITIVE_TYPES } from '../src/index.js'
import type { PrimitiveType } from '../src/index.js'

describe('Numeric Precision Types', () => {
  describe('PRIMITIVE_TYPES set', () => {
    it('includes int as a primitive type', () => {
      expect(PRIMITIVE_TYPES.has('int')).toBe(true)
    })

    it('includes float as a primitive type', () => {
      expect(PRIMITIVE_TYPES.has('float')).toBe(true)
    })

    it('includes double as a primitive type', () => {
      expect(PRIMITIVE_TYPES.has('double')).toBe(true)
    })

    it('includes decimal as a primitive type', () => {
      expect(PRIMITIVE_TYPES.has('decimal')).toBe(true)
    })
  })

  describe('Graph parsing', () => {
    it('parses int field type', () => {
      const schema = Graph({
        Product: {
          quantity: 'int',
        },
      })

      const product = schema.entities.get('Product')
      const quantity = product?.fields.get('quantity')
      expect(quantity?.type).toBe('int')
      expect(quantity?.isRelation).toBe(false)
    })

    it('parses float field type', () => {
      const schema = Graph({
        Measurement: {
          temperature: 'float',
        },
      })

      const measurement = schema.entities.get('Measurement')
      const temperature = measurement?.fields.get('temperature')
      expect(temperature?.type).toBe('float')
      expect(temperature?.isRelation).toBe(false)
    })

    it('parses double field type', () => {
      const schema = Graph({
        Calculation: {
          result: 'double',
        },
      })

      const calculation = schema.entities.get('Calculation')
      const result = calculation?.fields.get('result')
      expect(result?.type).toBe('double')
      expect(result?.isRelation).toBe(false)
    })

    it('parses decimal field type', () => {
      const schema = Graph({
        Transaction: {
          amount: 'decimal',
        },
      })

      const transaction = schema.entities.get('Transaction')
      const amount = transaction?.fields.get('amount')
      expect(amount?.type).toBe('decimal')
      expect(amount?.isRelation).toBe(false)
    })

    it('parses numeric types with optional modifier', () => {
      const schema = Graph({
        Product: {
          price: 'decimal?',
          stock: 'int?',
        },
      })

      const product = schema.entities.get('Product')
      expect(product?.fields.get('price')?.isOptional).toBe(true)
      expect(product?.fields.get('price')?.type).toBe('decimal')
      expect(product?.fields.get('stock')?.isOptional).toBe(true)
      expect(product?.fields.get('stock')?.type).toBe('int')
    })

    it('parses numeric types with array modifier', () => {
      const schema = Graph({
        DataSet: {
          values: 'float[]',
          counts: 'int[]',
        },
      })

      const dataSet = schema.entities.get('DataSet')
      expect(dataSet?.fields.get('values')?.isArray).toBe(true)
      expect(dataSet?.fields.get('values')?.type).toBe('float')
      expect(dataSet?.fields.get('counts')?.isArray).toBe(true)
      expect(dataSet?.fields.get('counts')?.type).toBe('int')
    })

    it('does not treat numeric types as relations', () => {
      const schema = Graph({
        Account: {
          balance: 'decimal',
          transactions: 'int',
        },
      })

      const account = schema.entities.get('Account')
      expect(account?.fields.get('balance')?.isRelation).toBe(false)
      expect(account?.fields.get('transactions')?.isRelation).toBe(false)
    })
  })

  describe('PrimitiveType type', () => {
    it('accepts int as a valid PrimitiveType', () => {
      const t: PrimitiveType = 'int'
      expect(t).toBe('int')
    })

    it('accepts float as a valid PrimitiveType', () => {
      const t: PrimitiveType = 'float'
      expect(t).toBe('float')
    })

    it('accepts double as a valid PrimitiveType', () => {
      const t: PrimitiveType = 'double'
      expect(t).toBe('double')
    })

    it('accepts decimal as a valid PrimitiveType', () => {
      const t: PrimitiveType = 'decimal'
      expect(t).toBe('decimal')
    })
  })

  describe('backwards compatibility', () => {
    it('still supports number type', () => {
      const schema = Graph({
        Legacy: {
          value: 'number',
        },
      })

      const legacy = schema.entities.get('Legacy')
      expect(legacy?.fields.get('value')?.type).toBe('number')
      expect(legacy?.fields.get('value')?.isRelation).toBe(false)
    })

    it('keeps number in PRIMITIVE_TYPES', () => {
      expect(PRIMITIVE_TYPES.has('number')).toBe(true)
    })
  })
})
