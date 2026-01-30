import { describe, it, expect } from 'vitest'
import { Graph } from '../src/index.js'

describe('Generic Type Parsing', () => {
  describe('map<K, V>', () => {
    it('parses map<string, int>', () => {
      const schema = Graph({
        Config: { settings: 'map<string, int>' },
      })
      const field = schema.entities.get('Config')?.fields.get('settings')
      expect(field?.type).toBe('map')
      expect(field?.keyType).toBe('string')
      expect(field?.valueType).toBe('int')
      expect(field?.isRelation).toBe(false)
    })

    it('parses map<string, boolean>', () => {
      const schema = Graph({
        Config: { flags: 'map<string, boolean>' },
      })
      const field = schema.entities.get('Config')?.fields.get('flags')
      expect(field?.type).toBe('map')
      expect(field?.keyType).toBe('string')
      expect(field?.valueType).toBe('boolean')
    })
  })

  describe('struct<Name>', () => {
    it('parses struct<Address>', () => {
      const schema = Graph({
        User: { address: 'struct<Address>' },
      })
      const field = schema.entities.get('User')?.fields.get('address')
      expect(field?.type).toBe('struct')
      expect(field?.structName).toBe('Address')
      expect(field?.isRelation).toBe(false)
    })
  })

  describe('enum<Name>', () => {
    it('parses enum<Status>', () => {
      const schema = Graph({
        Order: { status: 'enum<Status>' },
      })
      const field = schema.entities.get('Order')?.fields.get('status')
      expect(field?.type).toBe('enum')
      expect(field?.enumName).toBe('Status')
      expect(field?.isRelation).toBe(false)
    })
  })

  describe('ref<Target>', () => {
    it('parses ref<Post>', () => {
      const schema = Graph({
        Comment: { target: 'ref<Post>' },
      })
      const field = schema.entities.get('Comment')?.fields.get('target')
      expect(field?.type).toBe('ref')
      expect(field?.refTarget).toBe('Post')
      expect(field?.isRelation).toBe(false)
    })
  })

  describe('list<T>', () => {
    it('parses list<string>', () => {
      const schema = Graph({
        Post: { tags: 'list<string>' },
      })
      const field = schema.entities.get('Post')?.fields.get('tags')
      expect(field?.type).toBe('list')
      expect(field?.elementType).toBe('string')
      expect(field?.isRelation).toBe(false)
    })

    it('parses list<int>', () => {
      const schema = Graph({
        DataSet: { values: 'list<int>' },
      })
      const field = schema.entities.get('DataSet')?.fields.get('values')
      expect(field?.type).toBe('list')
      expect(field?.elementType).toBe('int')
    })
  })

  describe('nested generics', () => {
    it('parses map<string, list<int>>', () => {
      const schema = Graph({
        Analytics: { metrics: 'map<string, list<int>>' },
      })
      const field = schema.entities.get('Analytics')?.fields.get('metrics')
      expect(field?.type).toBe('map')
      expect(field?.keyType).toBe('string')
      expect(field?.valueType).toBe('list<int>')
    })
  })

  describe('generic types with modifiers', () => {
    it('parses map<string, int> with optional modifier', () => {
      const schema = Graph({
        Config: { settings: 'map<string, int>?' },
      })
      const field = schema.entities.get('Config')?.fields.get('settings')
      expect(field?.type).toBe('map')
      expect(field?.keyType).toBe('string')
      expect(field?.valueType).toBe('int')
      expect(field?.isOptional).toBe(true)
    })

    it('parses list<string> with array modifier', () => {
      const schema = Graph({
        Post: { tagSets: 'list<string>[]' },
      })
      const field = schema.entities.get('Post')?.fields.get('tagSets')
      expect(field?.type).toBe('list')
      expect(field?.elementType).toBe('string')
      expect(field?.isArray).toBe(true)
    })

    it('parses enum<Status> with required modifier', () => {
      const schema = Graph({
        Order: { status: 'enum<Status>!' },
      })
      const field = schema.entities.get('Order')?.fields.get('status')
      expect(field?.type).toBe('enum')
      expect(field?.enumName).toBe('Status')
      expect(field?.isRequired).toBe(true)
    })

    it('parses struct<Address> with indexed modifier', () => {
      const schema = Graph({
        User: { address: 'struct<Address>#' },
      })
      const field = schema.entities.get('User')?.fields.get('address')
      expect(field?.type).toBe('struct')
      expect(field?.structName).toBe('Address')
      expect(field?.isIndexed).toBe(true)
    })
  })

  describe('backwards compatibility', () => {
    it('existing types still parse correctly', () => {
      const schema = Graph({
        User: {
          name: 'string',
          age: 'int',
          posts: '->Post[]',
        },
        Post: {
          title: 'string',
        },
      })
      const user = schema.entities.get('User')
      expect(user?.fields.get('name')?.type).toBe('string')
      expect(user?.fields.get('age')?.type).toBe('int')
      expect(user?.fields.get('posts')?.isRelation).toBe(true)
    })
  })
})
