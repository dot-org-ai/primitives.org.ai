import { describe, it, expect } from 'vitest'
import { Graph } from '../src/index.js'

describe('Default Value Parsing', () => {
  describe('string defaults', () => {
    it('parses string = "active"', () => {
      const schema = Graph({
        User: { status: 'string = "active"' },
      })
      const field = schema.entities.get('User')?.fields.get('status')
      expect(field?.type).toBe('string')
      expect(field?.default).toBe('active')
    })

    it('parses string with single quotes', () => {
      const schema = Graph({
        User: { role: "string = 'admin'" },
      })
      const field = schema.entities.get('User')?.fields.get('role')
      expect(field?.type).toBe('string')
      expect(field?.default).toBe('admin')
    })
  })

  describe('numeric defaults', () => {
    it('parses int = 42', () => {
      const schema = Graph({
        Config: { retries: 'int = 42' },
      })
      const field = schema.entities.get('Config')?.fields.get('retries')
      expect(field?.type).toBe('int')
      expect(field?.default).toBe(42)
    })

    it('parses float = 3.14', () => {
      const schema = Graph({
        Config: { rate: 'float = 3.14' },
      })
      const field = schema.entities.get('Config')?.fields.get('rate')
      expect(field?.type).toBe('float')
      expect(field?.default).toBe(3.14)
    })

    it('parses negative number', () => {
      const schema = Graph({
        Config: { offset: 'int = -1' },
      })
      const field = schema.entities.get('Config')?.fields.get('offset')
      expect(field?.type).toBe('int')
      expect(field?.default).toBe(-1)
    })
  })

  describe('boolean defaults', () => {
    it('parses bool = true', () => {
      const schema = Graph({
        Settings: { enabled: 'bool = true' },
      })
      const field = schema.entities.get('Settings')?.fields.get('enabled')
      expect(field?.type).toBe('boolean')
      expect(field?.default).toBe(true)
    })

    it('parses boolean = false', () => {
      const schema = Graph({
        Settings: { debug: 'boolean = false' },
      })
      const field = schema.entities.get('Settings')?.fields.get('debug')
      expect(field?.type).toBe('boolean')
      expect(field?.default).toBe(false)
    })
  })

  describe('function call defaults', () => {
    it('parses timestamp = now()', () => {
      const schema = Graph({
        Event: { createdAt: 'timestamp = now()' },
      })
      const field = schema.entities.get('Event')?.fields.get('createdAt')
      expect(field?.type).toBe('timestamp')
      expect(field?.default).toEqual({ function: 'now' })
    })

    it('parses uuid = gen_random_uuid()', () => {
      const schema = Graph({
        Entity: { id: 'uuid = gen_random_uuid()' },
      })
      const field = schema.entities.get('Entity')?.fields.get('id')
      expect(field?.type).toBe('uuid')
      expect(field?.default).toEqual({ function: 'gen_random_uuid' })
    })
  })

  describe('special defaults', () => {
    it('parses json = {}', () => {
      const schema = Graph({
        Config: { metadata: 'json = {}' },
      })
      const field = schema.entities.get('Config')?.fields.get('metadata')
      expect(field?.type).toBe('json')
      expect(field?.default).toEqual({})
    })

    it('parses string[] = []', () => {
      const schema = Graph({
        Post: { tags: 'string[] = []' },
      })
      const field = schema.entities.get('Post')?.fields.get('tags')
      expect(field?.type).toBe('string')
      expect(field?.isArray).toBe(true)
      expect(field?.default).toEqual([])
    })

    it('parses string? = null', () => {
      const schema = Graph({
        User: { nickname: 'string? = null' },
      })
      const field = schema.entities.get('User')?.fields.get('nickname')
      expect(field?.type).toBe('string')
      expect(field?.isOptional).toBe(true)
      expect(field?.default).toBe(null)
    })
  })

  describe('defaults with modifiers', () => {
    it('parses string! = "active"', () => {
      const schema = Graph({
        User: { status: 'string! = "active"' },
      })
      const field = schema.entities.get('User')?.fields.get('status')
      expect(field?.type).toBe('string')
      expect(field?.isRequired).toBe(true)
      expect(field?.default).toBe('active')
    })
  })

  describe('backwards compatibility', () => {
    it('fields without defaults still work', () => {
      const schema = Graph({
        User: {
          name: 'string',
          age: 'int?',
          tags: 'string[]',
        },
      })
      const user = schema.entities.get('User')
      expect(user?.fields.get('name')?.default).toBeUndefined()
      expect(user?.fields.get('age')?.default).toBeUndefined()
      expect(user?.fields.get('tags')?.default).toBeUndefined()
    })

    it('relationships still work', () => {
      const schema = Graph({
        Post: {
          author: '->User',
        },
        User: {
          name: 'string',
        },
      })
      const post = schema.entities.get('Post')
      expect(post?.fields.get('author')?.isRelation).toBe(true)
    })
  })
})
