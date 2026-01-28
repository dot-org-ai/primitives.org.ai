/**
 * AI Database E2E Test Suite
 *
 * Tests database CRUD operations, search, relationships, and events
 * against deployed workers. This suite is environment-agnostic --
 * the same tests run in browser, node, and vitest-pool-workers.
 *
 * @packageDocumentation
 */

import type { TestSuite, ClientFactory, DatabaseClient } from '../types.js'
import {
  testId,
  assertDefined,
  assertEqual,
  assertTrue,
  assertFalse,
  assertLength,
  assertNotEmpty,
  assertContains,
  assertThrows,
  assertGreaterThan,
} from '../helpers.js'

/**
 * Create the AI Database test suite
 */
export function createDatabaseTests(getClient: ClientFactory): TestSuite {
  let db: DatabaseClient

  return {
    name: 'AI Database',

    beforeEach: async () => {
      db = getClient().database
    },

    tests: [
      // =====================================================================
      // CRUD Operations
      // =====================================================================
      {
        name: 'should create an entity with auto-generated ID',
        fn: async () => {
          const entity = await db.create('TestItem', {
            name: `test-${testId()}`,
            value: 42,
          })

          assertDefined(entity, 'Created entity should be defined')
          assertDefined(entity.$id, 'Entity should have an ID')
          assertEqual(entity.$type, 'TestItem')
        },
      },

      {
        name: 'should create an entity with explicit ID',
        fn: async () => {
          const id = testId('item')
          const entity = await db.create('TestItem', { name: 'explicit-id-test', value: 100 }, id)

          assertDefined(entity)
          assertEqual(entity.$id, id)
          assertEqual(entity.$type, 'TestItem')
        },
      },

      {
        name: 'should get an entity by type and ID',
        fn: async () => {
          const id = testId('get')
          await db.create('TestItem', { name: 'get-test', value: 200 }, id)

          const retrieved = await db.get('TestItem', id)

          assertDefined(retrieved, 'Retrieved entity should be defined')
          assertEqual(retrieved.$id, id)
          assertEqual(retrieved.$type, 'TestItem')
          assertEqual(retrieved.name as string, 'get-test')
          assertEqual(retrieved.value as number, 200)
        },
      },

      {
        name: 'should return null for non-existent entity',
        fn: async () => {
          const result = await db.get('TestItem', 'non-existent-id-xyz')
          assertEqual(result, null)
        },
      },

      {
        name: 'should update an existing entity',
        fn: async () => {
          const id = testId('update')
          await db.create('TestItem', { name: 'before-update', value: 1 }, id)

          const updated = await db.update('TestItem', id, {
            name: 'after-update',
            value: 2,
          })

          assertDefined(updated)
          assertEqual(updated.name as string, 'after-update')
          assertEqual(updated.value as number, 2)

          // Verify persistence
          const retrieved = await db.get('TestItem', id)
          assertDefined(retrieved)
          assertEqual(retrieved.name as string, 'after-update')
        },
      },

      {
        name: 'should delete an entity',
        fn: async () => {
          const id = testId('delete')
          await db.create('TestItem', { name: 'to-delete', value: 0 }, id)

          const deleted = await db.delete('TestItem', id)
          assertTrue(deleted, 'Delete should return true')

          const result = await db.get('TestItem', id)
          assertEqual(result, null)
        },
      },

      {
        name: 'should list entities by type',
        fn: async () => {
          const prefix = testId('list')
          await db.create('ListTestType', { name: `${prefix}-a`, order: 1 })
          await db.create('ListTestType', { name: `${prefix}-b`, order: 2 })
          await db.create('ListTestType', { name: `${prefix}-c`, order: 3 })

          const results = await db.list('ListTestType')

          assertDefined(results)
          assertGreaterThan(results.length, 0, 'Should return at least one result')
        },
      },

      {
        name: 'should list entities with limit option',
        fn: async () => {
          const prefix = testId('limit')
          await db.create('LimitTestType', { name: `${prefix}-1` })
          await db.create('LimitTestType', { name: `${prefix}-2` })
          await db.create('LimitTestType', { name: `${prefix}-3` })

          const results = await db.list('LimitTestType', { limit: 2 })

          assertDefined(results)
          assertTrue(results.length <= 2, 'Should respect limit')
        },
      },

      // =====================================================================
      // Search Operations
      // =====================================================================
      {
        name: 'should search entities by query',
        fn: async () => {
          const marker = testId('search')
          await db.create('SearchTestType', {
            title: `${marker} findable item`,
            body: 'This is a searchable item',
          })

          const results = await db.search('SearchTestType', marker)

          assertDefined(results)
          assertGreaterThan(results.length, 0, 'Search should return results')
        },
      },

      // =====================================================================
      // Relationship Operations
      // =====================================================================
      {
        name: 'should create a relationship between entities',
        fn: async () => {
          const authorId = testId('author')
          const postId = testId('post')

          await db.create('Author', { name: 'Jane' }, authorId)
          await db.create('Post', { title: 'My Post' }, postId)

          await db.relate('Author', authorId, 'wrote', 'Post', postId)

          const related = await db.related('Author', authorId, 'wrote')
          assertDefined(related)
          assertGreaterThan(related.length, 0, 'Should have related entities')
        },
      },

      {
        name: 'should remove a relationship between entities',
        fn: async () => {
          const userId = testId('user')
          const docId = testId('doc')

          await db.create('User', { name: 'Bob' }, userId)
          await db.create('Document', { title: 'Doc 1' }, docId)

          await db.relate('User', userId, 'owns', 'Document', docId)
          await db.unrelate('User', userId, 'owns', 'Document', docId)

          const related = await db.related('User', userId, 'owns')
          assertLength(related, 0)
        },
      },

      // =====================================================================
      // Edge Cases
      // =====================================================================
      {
        name: 'should handle special characters in entity data',
        fn: async () => {
          const id = testId('special')
          const entity = await db.create(
            'TestItem',
            {
              name: 'test <script>alert("xss")</script>',
              description: "O'Reilly & Associates",
              unicode: 'Hello \u00e9\u00e8\u00ea \u2603',
            },
            id
          )

          assertDefined(entity)

          const retrieved = await db.get('TestItem', id)
          assertDefined(retrieved)
          assertEqual(retrieved.name as string, 'test <script>alert("xss")</script>')
        },
      },

      {
        name: 'should handle empty objects',
        fn: async () => {
          const id = testId('empty')
          const entity = await db.create('TestItem', {}, id)

          assertDefined(entity)
          assertEqual(entity.$id, id)
        },
      },

      {
        name: 'should handle large payloads',
        fn: async () => {
          const id = testId('large')
          const largeData: Record<string, unknown> = {}
          for (let i = 0; i < 100; i++) {
            largeData[`field_${i}`] = `value_${i}_${'x'.repeat(100)}`
          }

          const entity = await db.create('TestItem', largeData, id)
          assertDefined(entity)

          const retrieved = await db.get('TestItem', id)
          assertDefined(retrieved)
          assertEqual(retrieved.field_0 as string, largeData.field_0 as string)
          assertEqual(retrieved.field_99 as string, largeData.field_99 as string)
        },
        timeout: 10000,
      },
    ],
  }
}
