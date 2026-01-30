import { describe, it, expect } from 'vitest'
import { Graph, PRIMITIVE_TYPES } from '../src/index.js'
import type { PrimitiveType } from '../src/index.js'

describe('Extended Primitive Types', () => {
  const newPrimitiveTypes = [
    'text',
    'long',
    'bigint',
    'uuid',
    'timestamp',
    'timestamptz',
    'time',
    'binary',
  ] as const

  describe('PRIMITIVE_TYPES set', () => {
    it.each(newPrimitiveTypes)('includes %s as a primitive type', (type) => {
      expect(PRIMITIVE_TYPES.has(type)).toBe(true)
    })
  })

  describe('PrimitiveType union', () => {
    it.each(newPrimitiveTypes)('accepts %s as a valid PrimitiveType', (type) => {
      const t: PrimitiveType = type
      expect(t).toBe(type)
    })
  })

  describe('Graph parsing', () => {
    it('parses text field type', () => {
      const schema = Graph({
        Article: { body: 'text' },
      })
      const field = schema.entities.get('Article')?.fields.get('body')
      expect(field?.type).toBe('text')
      expect(field?.isRelation).toBe(false)
    })

    it('parses long field type', () => {
      const schema = Graph({
        Counter: { value: 'long' },
      })
      const field = schema.entities.get('Counter')?.fields.get('value')
      expect(field?.type).toBe('long')
      expect(field?.isRelation).toBe(false)
    })

    it('parses bigint field type', () => {
      const schema = Graph({
        Ledger: { balance: 'bigint' },
      })
      const field = schema.entities.get('Ledger')?.fields.get('balance')
      expect(field?.type).toBe('bigint')
      expect(field?.isRelation).toBe(false)
    })

    it('parses uuid field type', () => {
      const schema = Graph({
        Entity: { id: 'uuid' },
      })
      const field = schema.entities.get('Entity')?.fields.get('id')
      expect(field?.type).toBe('uuid')
      expect(field?.isRelation).toBe(false)
    })

    it('parses timestamp field type', () => {
      const schema = Graph({
        Event: { occurredAt: 'timestamp' },
      })
      const field = schema.entities.get('Event')?.fields.get('occurredAt')
      expect(field?.type).toBe('timestamp')
      expect(field?.isRelation).toBe(false)
    })

    it('parses timestamptz field type', () => {
      const schema = Graph({
        Event: { occurredAt: 'timestamptz' },
      })
      const field = schema.entities.get('Event')?.fields.get('occurredAt')
      expect(field?.type).toBe('timestamptz')
      expect(field?.isRelation).toBe(false)
    })

    it('parses time field type', () => {
      const schema = Graph({
        Schedule: { startTime: 'time' },
      })
      const field = schema.entities.get('Schedule')?.fields.get('startTime')
      expect(field?.type).toBe('time')
      expect(field?.isRelation).toBe(false)
    })

    it('parses binary field type', () => {
      const schema = Graph({
        File: { data: 'binary' },
      })
      const field = schema.entities.get('File')?.fields.get('data')
      expect(field?.type).toBe('binary')
      expect(field?.isRelation).toBe(false)
    })

    it('parses new types with optional modifier', () => {
      const schema = Graph({
        Record: {
          id: 'uuid?',
          ts: 'timestamp?',
          data: 'binary?',
        },
      })
      const record = schema.entities.get('Record')
      expect(record?.fields.get('id')?.isOptional).toBe(true)
      expect(record?.fields.get('id')?.type).toBe('uuid')
      expect(record?.fields.get('ts')?.isOptional).toBe(true)
      expect(record?.fields.get('ts')?.type).toBe('timestamp')
      expect(record?.fields.get('data')?.isOptional).toBe(true)
      expect(record?.fields.get('data')?.type).toBe('binary')
    })

    it('parses new types with array modifier', () => {
      const schema = Graph({
        Record: {
          ids: 'uuid[]',
          timestamps: 'timestamp[]',
          chunks: 'binary[]',
        },
      })
      const record = schema.entities.get('Record')
      expect(record?.fields.get('ids')?.isArray).toBe(true)
      expect(record?.fields.get('ids')?.type).toBe('uuid')
      expect(record?.fields.get('timestamps')?.isArray).toBe(true)
      expect(record?.fields.get('timestamps')?.type).toBe('timestamp')
      expect(record?.fields.get('chunks')?.isArray).toBe(true)
      expect(record?.fields.get('chunks')?.type).toBe('binary')
    })

    it('parses new types with required modifier', () => {
      const schema = Graph({
        Entity: {
          id: 'uuid!',
          createdAt: 'timestamp!',
        },
      })
      const entity = schema.entities.get('Entity')
      expect(entity?.fields.get('id')?.isRequired).toBe(true)
      expect(entity?.fields.get('id')?.type).toBe('uuid')
      expect(entity?.fields.get('createdAt')?.isRequired).toBe(true)
      expect(entity?.fields.get('createdAt')?.type).toBe('timestamp')
    })

    it('parses new types with indexed modifier', () => {
      const schema = Graph({
        Entity: {
          id: 'uuid#',
          createdAt: 'timestamp#',
        },
      })
      const entity = schema.entities.get('Entity')
      expect(entity?.fields.get('id')?.isIndexed).toBe(true)
      expect(entity?.fields.get('id')?.type).toBe('uuid')
      expect(entity?.fields.get('createdAt')?.isIndexed).toBe(true)
      expect(entity?.fields.get('createdAt')?.type).toBe('timestamp')
    })

    it('parses new types with combined modifiers', () => {
      const schema = Graph({
        Entity: {
          id: 'uuid!#',
          names: 'text[]?',
        },
      })
      const entity = schema.entities.get('Entity')
      expect(entity?.fields.get('id')?.isRequired).toBe(true)
      expect(entity?.fields.get('id')?.isIndexed).toBe(true)
      expect(entity?.fields.get('id')?.type).toBe('uuid')
      expect(entity?.fields.get('names')?.isArray).toBe(true)
      expect(entity?.fields.get('names')?.isOptional).toBe(true)
      expect(entity?.fields.get('names')?.type).toBe('text')
    })
  })
})

describe('Bool Alias', () => {
  describe('TYPE_ALIASES', () => {
    it('resolves bool to boolean in Graph parsing', () => {
      const schema = Graph({
        Settings: { enabled: 'bool' },
      })
      const field = schema.entities.get('Settings')?.fields.get('enabled')
      expect(field?.type).toBe('boolean')
      expect(field?.isRelation).toBe(false)
    })

    it('resolves bool with optional modifier', () => {
      const schema = Graph({
        Settings: { enabled: 'bool?' },
      })
      const field = schema.entities.get('Settings')?.fields.get('enabled')
      expect(field?.type).toBe('boolean')
      expect(field?.isOptional).toBe(true)
    })

    it('resolves bool with array modifier', () => {
      const schema = Graph({
        Settings: { flags: 'bool[]' },
      })
      const field = schema.entities.get('Settings')?.fields.get('flags')
      expect(field?.type).toBe('boolean')
      expect(field?.isArray).toBe(true)
    })

    it('resolves bool with required modifier', () => {
      const schema = Graph({
        Settings: { active: 'bool!' },
      })
      const field = schema.entities.get('Settings')?.fields.get('active')
      expect(field?.type).toBe('boolean')
      expect(field?.isRequired).toBe(true)
    })

    it('resolves bool with indexed modifier', () => {
      const schema = Graph({
        Settings: { active: 'bool#' },
      })
      const field = schema.entities.get('Settings')?.fields.get('active')
      expect(field?.type).toBe('boolean')
      expect(field?.isIndexed).toBe(true)
    })

    it('resolves bool with combined modifiers', () => {
      const schema = Graph({
        Settings: { active: 'bool!#' },
      })
      const field = schema.entities.get('Settings')?.fields.get('active')
      expect(field?.type).toBe('boolean')
      expect(field?.isRequired).toBe(true)
      expect(field?.isIndexed).toBe(true)
    })
  })
})
