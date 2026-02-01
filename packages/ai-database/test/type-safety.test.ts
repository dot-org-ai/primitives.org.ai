/**
 * Type Safety Tests for ai-promise-db.ts
 *
 * These tests verify that the proxy implementation maintains proper type safety
 * and reduces the need for `as any` casts.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, expectTypeOf } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DBPromise } from '../src/ai-promise-db.js'
import type { InferEntity } from '../src/schema/index.js'
import {
  hasEntityMarker,
  isValueOfable,
  isEntityArray,
  extractEntityId,
  extractMarkerType,
  type EntityMarker,
  type ValueOfable,
} from '../src/type-guards.js'

// Test entity types
interface User {
  $id: string
  $type: string
  name: string
  email: string
}

interface Post {
  $id: string
  $type: string
  title: string
  author: string // User ID
}

interface Team {
  $id: string
  $type: string
  name: string
  members: string[] // User IDs
}

// Schema for InferEntity type-level tests
const inferTestSchema = {
  User: {
    name: 'string' as const,
    age: 'number' as const,
    active: 'boolean' as const,
    tags: ['string'] as const,
    role: 'admin | editor | viewer' as const,
  },
  Post: {
    title: 'string' as const,
    author: '->User' as const,
    categories: ['~>Category'] as const,
  },
  Category: {
    name: 'string' as const,
    posts: ['<-Post'] as const,
  },
  Comment: {
    text: 'string' as const,
    post: '<-Post' as const,
    reviewer: '~>User' as const,
    editor: '<~User' as const,
  },
} as const

type TestSchema = typeof inferTestSchema

describe('InferEntity type inference', () => {
  it('infers primitive fields', () => {
    type U = InferEntity<TestSchema, 'User'>
    expectTypeOf<U['name']>().toEqualTypeOf<string>()
    expectTypeOf<U['age']>().toEqualTypeOf<number>()
    expectTypeOf<U['active']>().toEqualTypeOf<boolean>()
    expectTypeOf<U['$id']>().toEqualTypeOf<string>()
  })

  it('infers tuple types as arrays', () => {
    type U = InferEntity<TestSchema, 'User'>
    expectTypeOf<U['tags']>().toEqualTypeOf<string[]>()
  })

  it('infers forward exact refs (->Entity)', () => {
    type P = InferEntity<TestSchema, 'Post'>
    type U = InferEntity<TestSchema, 'User'>
    expectTypeOf<P['author']>().toEqualTypeOf<U>()
  })

  it('infers backward refs (<-Entity)', () => {
    type C = InferEntity<TestSchema, 'Comment'>
    type P = InferEntity<TestSchema, 'Post'>
    expectTypeOf<C['post']>().toEqualTypeOf<P>()
  })

  it('infers forward fuzzy refs (~>Entity)', () => {
    type C = InferEntity<TestSchema, 'Comment'>
    type U = InferEntity<TestSchema, 'User'>
    expectTypeOf<C['reviewer']>().toEqualTypeOf<U>()
  })

  it('infers backward fuzzy refs (<~Entity)', () => {
    type C = InferEntity<TestSchema, 'Comment'>
    type U = InferEntity<TestSchema, 'User'>
    expectTypeOf<C['editor']>().toEqualTypeOf<U>()
  })

  it('infers tuple ref types as arrays', () => {
    type P = InferEntity<TestSchema, 'Post'>
    type Cat = InferEntity<TestSchema, 'Category'>
    expectTypeOf<P['categories']>().toEqualTypeOf<Cat[]>()
  })

  it('infers backward ref tuples as arrays', () => {
    type Cat = InferEntity<TestSchema, 'Category'>
    type P = InferEntity<TestSchema, 'Post'>
    expectTypeOf<Cat['posts']>().toEqualTypeOf<P[]>()
  })

  it('infers union string types', () => {
    type U = InferEntity<TestSchema, 'User'>
    expectTypeOf<U['role']>().toEqualTypeOf<'admin' | 'editor' | 'viewer'>()
  })
})

// TODO: Advanced feature tests - needs investigation
describe('Type Safety Tests', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Type Guard Functions', () => {
    describe('hasEntityMarker', () => {
      it('should return true for objects with $type marker', () => {
        const entity = { $type: 'User', $id: '123', name: 'John' }
        expect(hasEntityMarker(entity)).toBe(true)
        if (hasEntityMarker(entity)) {
          expectTypeOf(entity).toMatchTypeOf<EntityMarker>()
        }
      })

      it('should return true for objects with $id marker', () => {
        const entity = { $id: '123', name: 'John' }
        expect(hasEntityMarker(entity)).toBe(true)
      })

      it('should return true for objects with $isArrayRelation marker', () => {
        const arr = { $isArrayRelation: true, length: 0 }
        expect(hasEntityMarker(arr)).toBe(true)
      })

      it('should return false for null', () => {
        expect(hasEntityMarker(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(hasEntityMarker(undefined)).toBe(false)
      })

      it('should return false for primitives', () => {
        expect(hasEntityMarker('string')).toBe(false)
        expect(hasEntityMarker(123)).toBe(false)
        expect(hasEntityMarker(true)).toBe(false)
      })

      it('should return false for plain objects without markers', () => {
        expect(hasEntityMarker({ name: 'John' })).toBe(false)
      })
    })

    describe('isValueOfable', () => {
      it('should return true for objects with valueOf returning string', () => {
        const proxy = {
          valueOf: () => '123',
        }
        expect(isValueOfable(proxy)).toBe(true)
        if (isValueOfable(proxy)) {
          expectTypeOf(proxy).toMatchTypeOf<ValueOfable>()
        }
      })

      it('should return false for null', () => {
        expect(isValueOfable(null)).toBe(false)
      })

      it('should return false for objects with valueOf returning non-string', () => {
        const obj = { name: 'test' }
        // Object.prototype.valueOf returns the object itself, not a string
        expect(isValueOfable(obj)).toBe(false)
      })

      it('should return false for primitives', () => {
        expect(isValueOfable('string')).toBe(false)
        expect(isValueOfable(123)).toBe(false)
      })
    })

    describe('isEntityArray', () => {
      it('should return true for arrays with $type marker', () => {
        const arr = ['id1', 'id2'] as unknown as { $type?: string }
        ;(arr as { $type?: string }).$type = 'User'
        expect(isEntityArray(arr)).toBe(true)
      })

      it('should return true for arrays with $isArrayRelation marker', () => {
        const arr = ['id1', 'id2'] as unknown as { $isArrayRelation?: boolean }
        ;(arr as { $isArrayRelation?: boolean }).$isArrayRelation = true
        expect(isEntityArray(arr)).toBe(true)
      })

      it('should return false for regular arrays', () => {
        const arr = ['id1', 'id2']
        expect(isEntityArray(arr)).toBe(false)
      })

      it('should return false for non-arrays', () => {
        expect(isEntityArray({ $type: 'User' })).toBe(false)
        expect(isEntityArray(null)).toBe(false)
      })
    })

    describe('extractEntityId', () => {
      it('should extract ID from string', () => {
        expect(extractEntityId('user-123')).toBe('user-123')
      })

      it('should extract ID from object with valueOf', () => {
        const proxy = { valueOf: () => 'user-456' }
        expect(extractEntityId(proxy)).toBe('user-456')
      })

      it('should extract ID from object with $id', () => {
        const entity = { $id: 'user-789', name: 'John' }
        expect(extractEntityId(entity)).toBe('user-789')
      })

      it('should prefer valueOf over $id', () => {
        const entity = {
          $id: 'direct-id',
          valueOf: () => 'valueof-id',
        }
        expect(extractEntityId(entity)).toBe('valueof-id')
      })

      it('should return undefined for objects without id', () => {
        expect(extractEntityId({ name: 'test' })).toBeUndefined()
      })

      it('should return undefined for null', () => {
        expect(extractEntityId(null)).toBeUndefined()
      })

      it('should return undefined for undefined', () => {
        expect(extractEntityId(undefined)).toBeUndefined()
      })
    })

    describe('extractMarkerType', () => {
      it('should extract $type from entity marker', () => {
        const entity = { $type: 'User', $id: '123' }
        expect(extractMarkerType(entity)).toBe('User')
      })

      it('should return undefined for objects without $type', () => {
        const entity = { $id: '123', name: 'John' }
        expect(extractMarkerType(entity)).toBeUndefined()
      })

      it('should return undefined for non-objects', () => {
        expect(extractMarkerType(null)).toBeUndefined()
        expect(extractMarkerType('string')).toBeUndefined()
        expect(extractMarkerType(123)).toBeUndefined()
      })
    })
  })

  describe('DBPromise Type Safety', () => {
    describe('forEach callback type preservation', () => {
      it('should preserve item type through forEach', async () => {
        const { db } = DB({
          User: { name: 'string', email: 'string' },
        })

        await db.User.create({ name: 'John', email: 'john@example.com' })
        await db.User.create({ name: 'Jane', email: 'jane@example.com' })

        const users = db.User.list()

        // The callback should know the item is a User type
        const result = await users.forEach((user, index) => {
          // Type should be inferred - user should have name and email
          expect(typeof user.name).toBe('string')
          expect(typeof user.email).toBe('string')
          expect(typeof index).toBe('number')
        })

        expect(result.total).toBe(2)
        expect(result.completed).toBe(2)
      })
    })

    describe('proxy valueOf type inference', () => {
      it('should infer correct type from proxy valueOf', async () => {
        const { db } = DB({
          Author: { name: 'string' },
          Post: { title: 'string', author: '->Author' },
        })

        const author = await db.Author.create({ name: 'John' })
        await db.Post.create({ title: 'Test Post', author: author.$id })

        const posts = await db.Post.list()
        const post = posts[0]

        // The author field should be accessible without as any
        // Even though it's stored as a string ID internally
        const authorId = extractEntityId(post.author)
        expect(typeof authorId).toBe('string')
      })
    })

    describe('relation proxy types', () => {
      it('should type relation proxies correctly', async () => {
        const { db } = DB({
          Author: { name: 'string' },
          Post: { title: 'string', author: '->Author' },
        })

        const author = await db.Author.create({ name: 'Jane' })
        await db.Post.create({ title: 'My Post', author: author.$id })

        const posts = await db.Post.list()
        const enriched = await posts.map((post) => ({
          title: post.title,
          // post.author should be usable - either as string ID or hydrated object
          authorRef: post.author,
        }))

        expect(enriched[0].title).toBe('My Post')
        // After batch loading, author should be hydrated
        expect(enriched[0].authorRef).toBeDefined()
      })
    })

    describe('marker type extraction', () => {
      it('should handle $type marker without as any', async () => {
        const entity = { $type: 'User', $id: '123', name: 'John' }

        // Using type guard instead of as any
        if (hasEntityMarker(entity)) {
          const type = extractMarkerType(entity)
          expect(type).toBe('User')
          expectTypeOf(type).toEqualTypeOf<string | undefined>()
        }
      })
    })

    describe('recording proxy type preservation', () => {
      it('should type proxy handler correctly', async () => {
        const { db } = DB({
          Customer: { name: 'string', score: 'number' },
        })

        await db.Customer.create({ name: 'Alice', score: 95 })
        await db.Customer.create({ name: 'Bob', score: 87 })

        const customers = db.Customer.list()

        // Map should preserve generic type through proxy
        const mapped = await customers.map((customer) => ({
          label: customer.name,
          value: customer.score,
        }))

        expect(mapped.length).toBe(2)
        expect(mapped[0]).toHaveProperty('label')
        expect(mapped[0]).toHaveProperty('value')
      })
    })
  })

  describe('Array Relation Type Safety', () => {
    it('should handle array relations with type safety', async () => {
      const { db } = DB({
        User: { name: 'string' },
        Team: { name: 'string', members: ['->User'] },
      })

      const user1 = await db.User.create({ name: 'Alice' })
      const user2 = await db.User.create({ name: 'Bob' })
      await db.Team.create({
        name: 'Dev Team',
        members: [user1.$id, user2.$id],
      })

      const teams = await db.Team.list()
      const team = teams[0]

      // members should be typed as array
      expect(Array.isArray(team.members)).toBe(true)

      // Each member ID should be extractable without as any
      for (const member of team.members) {
        const memberId = extractEntityId(member)
        expect(typeof memberId).toBe('string')
      }
    })
  })

  describe('Compile-time Schema Type Inference', () => {
    it('infers primitive field types from schema strings', () => {
      const schema = {
        User: { name: 'string', email: 'string', age: 'number', active: 'boolean' },
      } as const
      const { db } = DB(schema)
      type UserEntity = Awaited<ReturnType<typeof db.User.list>>[number]

      const _nameCheck: string = '' as UserEntity['name']
      const _ageCheck: number = 0 as UserEntity['age']
      const _activeCheck: boolean = false as UserEntity['active']
      const _idCheck: string = '' as UserEntity['$id']

      expect(true).toBe(true)
    })

    it('infers ->Entity relation fields as entity types', () => {
      const schema = {
        User: { name: 'string' },
        Post: { title: 'string', author: '->User' },
      } as const
      const { db } = DB(schema)
      type PostEntity = Awaited<ReturnType<typeof db.Post.list>>[number]
      type AuthorType = PostEntity['author']
      const _authorHasId: string = '' as AuthorType['$id']
      const _authorHasName: string = '' as AuthorType['name']

      expect(true).toBe(true)
    })

    it('infers union string fields as literal union types', () => {
      const schema = {
        Task: { title: 'string', status: 'todo | doing | done' },
      } as const
      const { db } = DB(schema)
      type TaskEntity = Awaited<ReturnType<typeof db.Task.list>>[number]
      type StatusType = TaskEntity['status']

      const _a: StatusType = 'todo'
      const _b: StatusType = 'doing'
      const _c: StatusType = 'done'

      expect(true).toBe(true)
    })

    it('infers array tuple fields as typed arrays', () => {
      const schema = {
        User: { name: 'string' },
        Team: { name: 'string', members: ['->User'] as [string] },
      } as const
      const { db } = DB(schema)
      type TeamEntity = Awaited<ReturnType<typeof db.Team.list>>[number]
      type MembersType = TeamEntity['members']
      const _arr: MembersType = [] as MembersType

      expect(true).toBe(true)
    })

    it('infers optional fields with undefined', () => {
      const schema = {
        Item: { name: 'string', notes: 'string?' },
      } as const
      const { db } = DB(schema)
      type ItemEntity = Awaited<ReturnType<typeof db.Item.list>>[number]
      const _notes: ItemEntity['notes'] = undefined

      expect(true).toBe(true)
    })

    it('create method accepts correct field types from schema', async () => {
      const schema = {
        User: { name: 'string', email: 'string', age: 'number' },
      } as const
      const { db } = DB(schema)

      const user = await db.User.create({
        name: 'Alice',
        email: 'alice@test.com',
        age: 30,
      })

      expect(user.$id).toBeDefined()
      expect(user.name).toBe('Alice')
      expect(user.email).toBe('alice@test.com')
      expect(user.age).toBe(30)
    })

    it('InferEntity type utility works standalone', () => {
      type Schema = {
        readonly User: { readonly name: 'string'; readonly email: 'string'; readonly age: 'number' }
        readonly Post: { readonly title: 'string'; readonly author: '->User' }
      }

      type User = import('../src/index.js').InferEntity<Schema, 'User'>
      type Post = import('../src/index.js').InferEntity<Schema, 'Post'>

      const _userName: string = '' as User['name']
      const _userAge: number = 0 as User['age']
      const _postTitle: string = '' as Post['title']
      const _postAuthorName: string = '' as Post['author']['name']

      expect(true).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null relation values safely', async () => {
      const { db } = DB({
        User: { name: 'string' },
        Task: { title: 'string', assignee: '->User?' },
      })

      await db.Task.create({ title: 'Unassigned Task' })

      const tasks = await db.Task.list()
      const task = tasks[0]

      // Should handle null/undefined without throwing
      const assigneeId = extractEntityId(task.assignee)
      expect(assigneeId).toBeUndefined()
    })

    it('should handle nested property access type safely', async () => {
      const { db } = DB({
        Address: { city: 'string' },
        Customer: { name: 'string', address: '->Address' },
        Order: { number: 'string', customer: '->Customer' },
      })

      const address = await db.Address.create({ city: 'NYC' })
      const customer = await db.Customer.create({
        name: 'Corp',
        address: address.$id,
      })
      await db.Order.create({ number: 'ORD-1', customer: customer.$id })

      const orders = await db.Order.list()
      const enriched = await orders.map((order) => ({
        number: order.number,
        // Nested relation access
        customerName: (order.customer as { name: string }).name,
      }))

      expect(enriched[0].number).toBe('ORD-1')
    })
  })
})
