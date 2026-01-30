import { describe, it, expect } from 'vitest'
import { Graph, parseOperator } from '../src/index.js'
import type { ParsedField } from '../src/index.js'

describe('Field Modifiers', () => {
  describe('! (required/unique) modifier', () => {
    describe('ParsedField type', () => {
      it('has isRequired property', () => {
        const field: ParsedField = {
          name: 'id',
          type: 'string',
          isArray: false,
          isOptional: false,
          isRelation: false,
          isRequired: true,
        }
        expect(field.isRequired).toBe(true)
      })

      it('has isUnique property', () => {
        const field: ParsedField = {
          name: 'email',
          type: 'string',
          isArray: false,
          isOptional: false,
          isRelation: false,
          isUnique: true,
        }
        expect(field.isUnique).toBe(true)
      })
    })

    describe('Graph parsing', () => {
      it('parses ! modifier on field types', () => {
        const schema = Graph({
          User: {
            id: 'uuid!',
            email: 'string!',
          },
        })

        const user = schema.entities.get('User')
        expect(user?.fields.get('id')?.isRequired).toBe(true)
        expect(user?.fields.get('id')?.isUnique).toBe(true)
        expect(user?.fields.get('email')?.isRequired).toBe(true)
        expect(user?.fields.get('email')?.isUnique).toBe(true)
      })

      it('strips ! from the type name', () => {
        const schema = Graph({
          User: {
            id: 'uuid!',
          },
        })

        const user = schema.entities.get('User')
        expect(user?.fields.get('id')?.type).toBe('uuid')
      })

      it('combines ! with ? correctly (! takes precedence for uniqueness)', () => {
        const schema = Graph({
          User: {
            alternateEmail: 'string?!',
          },
        })

        const user = schema.entities.get('User')
        const field = user?.fields.get('alternateEmail')
        expect(field?.isOptional).toBe(true)
        expect(field?.isUnique).toBe(true)
        expect(field?.type).toBe('string')
      })

      it('combines ! with []', () => {
        const schema = Graph({
          User: {
            identifiers: 'string[]!',
          },
        })

        const user = schema.entities.get('User')
        const field = user?.fields.get('identifiers')
        expect(field?.isArray).toBe(true)
        expect(field?.isRequired).toBe(true)
        expect(field?.isUnique).toBe(true)
        expect(field?.type).toBe('string')
      })
    })

    describe('relationship parsing', () => {
      it('parses ! modifier on relationships', () => {
        const result = parseOperator('->User!')
        expect(result?.targetType).toBe('User')
        expect(result?.isRequired).toBe(true)
        expect(result?.isUnique).toBe(true)
      })
    })
  })

  describe('# (indexed) modifier', () => {
    describe('ParsedField type', () => {
      it('has isIndexed property', () => {
        const field: ParsedField = {
          name: 'email',
          type: 'string',
          isArray: false,
          isOptional: false,
          isRelation: false,
          isIndexed: true,
        }
        expect(field.isIndexed).toBe(true)
      })
    })

    describe('Graph parsing', () => {
      it('parses # modifier on field types', () => {
        const schema = Graph({
          User: {
            email: 'string#',
            createdAt: 'datetime#',
          },
        })

        const user = schema.entities.get('User')
        expect(user?.fields.get('email')?.isIndexed).toBe(true)
        expect(user?.fields.get('createdAt')?.isIndexed).toBe(true)
      })

      it('strips # from the type name', () => {
        const schema = Graph({
          User: {
            email: 'string#',
          },
        })

        const user = schema.entities.get('User')
        expect(user?.fields.get('email')?.type).toBe('string')
      })

      it('combines # with ?', () => {
        const schema = Graph({
          User: {
            nickname: 'string?#',
          },
        })

        const user = schema.entities.get('User')
        const field = user?.fields.get('nickname')
        expect(field?.isOptional).toBe(true)
        expect(field?.isIndexed).toBe(true)
        expect(field?.type).toBe('string')
      })

      it('combines # with !', () => {
        const schema = Graph({
          User: {
            email: 'string!#',
          },
        })

        const user = schema.entities.get('User')
        const field = user?.fields.get('email')
        expect(field?.isRequired).toBe(true)
        expect(field?.isUnique).toBe(true)
        expect(field?.isIndexed).toBe(true)
        expect(field?.type).toBe('string')
      })

      it('combines # with []', () => {
        const schema = Graph({
          User: {
            tags: 'string[]#',
          },
        })

        const user = schema.entities.get('User')
        const field = user?.fields.get('tags')
        expect(field?.isArray).toBe(true)
        expect(field?.isIndexed).toBe(true)
        expect(field?.type).toBe('string')
      })

      it('combines all modifiers: []?!#', () => {
        const schema = Graph({
          Entity: {
            values: 'string[]?!#',
          },
        })

        const entity = schema.entities.get('Entity')
        const field = entity?.fields.get('values')
        expect(field?.isArray).toBe(true)
        expect(field?.isOptional).toBe(true)
        expect(field?.isUnique).toBe(true)
        expect(field?.isIndexed).toBe(true)
        expect(field?.type).toBe('string')
      })
    })

    describe('relationship parsing', () => {
      it('parses # modifier on relationships', () => {
        const result = parseOperator('->User#')
        expect(result?.targetType).toBe('User')
        expect(result?.isIndexed).toBe(true)
      })
    })
  })

  describe('backwards compatibility', () => {
    it('fields without modifiers have false for new properties', () => {
      const schema = Graph({
        User: {
          name: 'string',
        },
      })

      const user = schema.entities.get('User')
      const field = user?.fields.get('name')
      expect(field?.isRequired).toBeFalsy()
      expect(field?.isUnique).toBeFalsy()
      expect(field?.isIndexed).toBeFalsy()
    })

    it('? modifier still works as before', () => {
      const schema = Graph({
        User: {
          bio: 'string?',
        },
      })

      const user = schema.entities.get('User')
      expect(user?.fields.get('bio')?.isOptional).toBe(true)
    })

    it('[] modifier still works as before', () => {
      const schema = Graph({
        User: {
          tags: 'string[]',
        },
      })

      const user = schema.entities.get('User')
      expect(user?.fields.get('tags')?.isArray).toBe(true)
    })
  })
})
