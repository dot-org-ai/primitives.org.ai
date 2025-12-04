/**
 * Tests for Data functionality
 *
 * Covers data definitions and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Data, Index, Relationship, Validate, registry } from '../src/index.js'

describe('Data', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('Data creation', () => {
    it('creates data with basic config', () => {
      const data = Data({
        id: 'users',
        name: 'Users',
        description: 'User data store',
        version: '1.0.0',
        schema: {
          id: 'User ID',
          name: 'User name',
          email: 'User email',
        },
      })

      expect(data.id).toBe('users')
      expect(data.name).toBe('Users')
      expect(data.type).toBe('data')
    })

    it('defaults provider to fs', () => {
      const data = Data({
        id: 'default-provider',
        name: 'Default Provider',
        description: 'Uses default provider',
        version: '1.0.0',
        schema: {},
      })

      expect(data.provider).toBe('fs')
    })

    it('supports custom providers', () => {
      const data = Data({
        id: 'postgres-data',
        name: 'Postgres Data',
        description: 'Postgres storage',
        version: '1.0.0',
        schema: {},
        provider: 'postgres',
      })

      expect(data.provider).toBe('postgres')
    })

    it('creates data with indexes', () => {
      const data = Data({
        id: 'indexed-data',
        name: 'Indexed Data',
        description: 'Data with indexes',
        version: '1.0.0',
        schema: {
          id: 'ID',
          email: 'Email',
          name: 'Name',
        },
        indexes: [
          Index('email_idx', ['email'], { unique: true }),
          Index('name_idx', ['name']),
        ],
      })

      expect(data.indexes).toHaveLength(2)
      expect(data.indexes?.[0]?.name).toBe('email_idx')
      expect(data.indexes?.[0]?.unique).toBe(true)
    })

    it('creates data with relationships', () => {
      const data = Data({
        id: 'related-data',
        name: 'Related Data',
        description: 'Data with relationships',
        version: '1.0.0',
        schema: {},
        relationships: [
          Relationship('one-to-many', 'userId', 'posts', 'author'),
        ],
      })

      expect(data.relationships).toHaveLength(1)
      expect(data.relationships?.[0]?.type).toBe('one-to-many')
    })

    it('creates data with validation', () => {
      const data = Data({
        id: 'validated-data',
        name: 'Validated Data',
        description: 'Data with validation',
        version: '1.0.0',
        schema: {},
        validation: [
          Validate('email', 'email', 'Must be a valid email'),
          Validate('name', 'required', 'Name is required'),
        ],
      })

      expect(data.validation).toHaveLength(2)
      expect(data.validation?.[0]?.field).toBe('email')
    })

    it('registers data automatically', () => {
      Data({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
        schema: {},
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })
  })

  describe('Index helper', () => {
    it('creates a basic index', () => {
      const index = Index('my_idx', ['field1', 'field2'])

      expect(index.name).toBe('my_idx')
      expect(index.fields).toEqual(['field1', 'field2'])
    })

    it('creates a unique index', () => {
      const index = Index('unique_idx', ['email'], { unique: true })

      expect(index.unique).toBe(true)
    })

    it('creates a vector index', () => {
      const index = Index('vector_idx', ['embedding'], { type: 'vector' })

      expect(index.type).toBe('vector')
    })
  })

  describe('Relationship helper', () => {
    it('creates a one-to-many relationship', () => {
      const rel = Relationship('one-to-many', 'userId', 'posts', 'author')

      expect(rel.type).toBe('one-to-many')
      expect(rel.from).toBe('userId')
      expect(rel.to).toBe('posts')
      expect(rel.field).toBe('author')
    })

    it('creates a many-to-many relationship', () => {
      const rel = Relationship('many-to-many', 'postId', 'tags', 'posts')

      expect(rel.type).toBe('many-to-many')
    })

    it('creates a one-to-one relationship', () => {
      const rel = Relationship('one-to-one', 'userId', 'profile', 'user')

      expect(rel.type).toBe('one-to-one')
    })
  })

  describe('Validate helper', () => {
    it('creates a validation rule with message', () => {
      const rule = Validate('email', 'email', 'Must be a valid email')

      expect(rule.field).toBe('email')
      expect(rule.rule).toBe('email')
      expect(rule.message).toBe('Must be a valid email')
    })

    it('creates a validation rule with params', () => {
      const rule = Validate('age', 'min', { value: 18 }, 'Must be 18 or older')

      expect(rule.field).toBe('age')
      expect(rule.rule).toBe('min')
      expect(rule.params).toEqual({ value: 18 })
      expect(rule.message).toBe('Must be 18 or older')
    })

    it('creates a required validation rule', () => {
      const rule = Validate('name', 'required', 'Name is required')

      expect(rule.rule).toBe('required')
    })

    it('creates a unique validation rule', () => {
      const rule = Validate('username', 'unique', 'Username already taken')

      expect(rule.rule).toBe('unique')
    })
  })
})
