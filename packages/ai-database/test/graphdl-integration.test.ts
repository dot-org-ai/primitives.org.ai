/**
 * @graphdl/core integration tests
 *
 * Verifies that ai-database can import and use types and functions
 * from the @graphdl/core package.
 */

import { describe, it, expect } from 'vitest'

// Import types from @graphdl/core
import type {
  Verb,
  Noun,
  ParsedField,
  ParsedEntity,
  TypeMeta,
  PrimitiveType,
  RelationshipOperator,
} from '@graphdl/core'

// Import functions from @graphdl/core
import {
  conjugate,
  pluralize,
  singularize,
  parseOperator,
  inferNoun,
  buildDependencyGraph,
  topologicalSort,
  Graph,
} from '@graphdl/core'

describe('@graphdl/core integration', () => {
  describe('type imports', () => {
    it('should be able to use Verb type', () => {
      const verb: Verb = {
        action: 'create',
        actor: 'creator',
        act: 'creates',
        activity: 'creating',
        result: 'creation',
        reverse: {
          at: 'createdAt',
          by: 'createdBy',
        },
      }
      expect(verb.action).toBe('create')
      expect(verb.actor).toBe('creator')
    })

    it('should be able to use Noun type', () => {
      const noun: Noun = {
        singular: 'user',
        plural: 'users',
        description: 'A user in the system',
      }
      expect(noun.singular).toBe('user')
      expect(noun.plural).toBe('users')
    })

    it('should be able to use ParsedField type', () => {
      const field: ParsedField = {
        name: 'email',
        type: 'string',
        isArray: false,
        isOptional: false,
        isRelation: false,
      }
      expect(field.name).toBe('email')
      expect(field.isRelation).toBe(false)
    })

    it('should be able to use ParsedEntity type', () => {
      const entity: ParsedEntity = {
        name: 'User',
        fields: new Map(),
        $type: 'https://schema.org/Person',
      }
      expect(entity.name).toBe('User')
      expect(entity.fields).toBeInstanceOf(Map)
    })

    it('should be able to use TypeMeta type', () => {
      const meta: TypeMeta = {
        name: 'User',
        singular: 'user',
        plural: 'users',
        slug: 'user',
        slugPlural: 'users',
        creator: 'userCreator',
        createdAt: 'userCreatedAt',
        createdBy: 'userCreatedBy',
        updatedAt: 'userUpdatedAt',
        updatedBy: 'userUpdatedBy',
        created: 'User.created',
        updated: 'User.updated',
        deleted: 'User.deleted',
      }
      expect(meta.name).toBe('User')
      expect(meta.singular).toBe('user')
    })

    it('should be able to use PrimitiveType type', () => {
      const primitiveType: PrimitiveType = 'string'
      expect(primitiveType).toBe('string')

      const numberType: PrimitiveType = 'number'
      expect(numberType).toBe('number')

      const booleanType: PrimitiveType = 'boolean'
      expect(booleanType).toBe('boolean')
    })

    it('should be able to use RelationshipOperator type', () => {
      const operator: RelationshipOperator = '->'
      expect(operator).toBe('->')

      const fuzzyOperator: RelationshipOperator = '~>'
      expect(fuzzyOperator).toBe('~>')
    })
  })

  describe('function imports', () => {
    it('should be able to use conjugate function', () => {
      expect(typeof conjugate).toBe('function')
      const result = conjugate('create')
      expect(result).toBeDefined()
      expect(result.action).toBe('create')
      expect(result.actor).toBe('creator')
    })

    it('should be able to use pluralize function', () => {
      expect(typeof pluralize).toBe('function')
      expect(pluralize('user')).toBe('users')
      expect(pluralize('category')).toBe('categories')
      expect(pluralize('person')).toBe('people')
    })

    it('should be able to use singularize function', () => {
      expect(typeof singularize).toBe('function')
      expect(singularize('users')).toBe('user')
      expect(singularize('categories')).toBe('category')
      expect(singularize('people')).toBe('person')
    })

    it('should be able to use parseOperator function', () => {
      expect(typeof parseOperator).toBe('function')
      const result = parseOperator('->Author')
      expect(result).toBeDefined()
      expect(result?.operator).toBe('->')
      expect(result?.targetType).toBe('Author')
      expect(result?.direction).toBe('forward')
      expect(result?.matchMode).toBe('exact')
    })

    it('should be able to use inferNoun function', () => {
      expect(typeof inferNoun).toBe('function')
      const result = inferNoun('User')
      expect(result).toBeDefined()
      expect(result.singular).toBe('user')
      expect(result.plural).toBe('users')
    })

    it('should be able to use buildDependencyGraph function', () => {
      expect(typeof buildDependencyGraph).toBe('function')
      // Build a simple dependency graph using Graph() to create ParsedGraph
      const schema = Graph({
        User: {
          name: 'string',
        },
        Post: {
          title: 'string',
          author: '->User',
        },
      })
      const graph = buildDependencyGraph(schema)
      expect(graph).toBeDefined()
      expect(graph.nodes).toBeDefined()
      expect(graph.nodes['User']).toBeDefined()
      expect(graph.nodes['Post']).toBeDefined()
    })

    it('should be able to use topologicalSort function', () => {
      expect(typeof topologicalSort).toBe('function')
      const schema = Graph({
        User: {
          name: 'string',
        },
        Post: {
          title: 'string',
          author: '->User',
        },
      })
      const graph = buildDependencyGraph(schema)
      // topologicalSort requires a rootType parameter
      const sorted = topologicalSort(graph, 'Post')
      expect(sorted).toBeDefined()
      expect(Array.isArray(sorted)).toBe(true)
      // User should come before Post since Post depends on User
      const userIndex = sorted.indexOf('User')
      const postIndex = sorted.indexOf('Post')
      expect(userIndex).toBeLessThan(postIndex)
    })
  })
})
