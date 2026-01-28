/**
 * Digital Objects E2E Test Suite
 *
 * Tests CRUD operations on digital objects (Things), verbs/actions,
 * and relationships. This suite is environment-agnostic -- the same
 * tests run in browser, node, and vitest-pool-workers.
 *
 * @packageDocumentation
 */

import type { TestSuite, ClientFactory, DigitalObjectsClient } from '../types.js'
import {
  testId,
  assertDefined,
  assertEqual,
  assertTrue,
  assertFalse,
  assertLength,
  assertNotEmpty,
  assertGreaterThan,
  assertContains,
} from '../helpers.js'

/**
 * Create the Digital Objects test suite
 */
export function createDigitalObjectsTests(getClient: ClientFactory): TestSuite {
  let objects: DigitalObjectsClient

  return {
    name: 'Digital Objects',

    beforeEach: async () => {
      objects = getClient().objects
    },

    tests: [
      // =====================================================================
      // Thing CRUD
      // =====================================================================
      {
        name: 'should create a thing with auto-generated ID',
        fn: async () => {
          const thing = await objects.create('Post', {
            title: `Test Post ${testId()}`,
            body: 'Hello World',
          })

          assertDefined(thing, 'Created thing should be defined')
          assertDefined(thing.id, 'Thing should have an ID')
          assertEqual(thing.noun, 'Post')
          assertEqual((thing.data as { title: string }).title.startsWith('Test Post'), true)
        },
      },

      {
        name: 'should create a thing with explicit ID',
        fn: async () => {
          const id = testId('post')
          const thing = await objects.create(
            'Post',
            { title: 'Explicit ID Post', body: 'Content' },
            id
          )

          assertDefined(thing)
          assertEqual(thing.id, id)
          assertEqual(thing.noun, 'Post')
        },
      },

      {
        name: 'should get a thing by ID',
        fn: async () => {
          const id = testId('get-thing')
          await objects.create('Article', { title: 'Retrievable Article', author: 'Test' }, id)

          const retrieved = await objects.get(id)

          assertDefined(retrieved, 'Retrieved thing should exist')
          assertEqual(retrieved.id, id)
          assertEqual(retrieved.noun, 'Article')
          assertEqual((retrieved.data as { title: string }).title, 'Retrievable Article')
        },
      },

      {
        name: 'should return null for non-existent thing',
        fn: async () => {
          const result = await objects.get('non-existent-thing-id-xyz')
          assertEqual(result, null)
        },
      },

      {
        name: 'should update a thing',
        fn: async () => {
          const id = testId('update-thing')
          await objects.create('Post', { title: 'Original Title', views: 0 }, id)

          const updated = await objects.update(id, {
            title: 'Updated Title',
            views: 42,
          })

          assertDefined(updated)
          assertEqual((updated.data as { title: string }).title, 'Updated Title')
          assertEqual((updated.data as { views: number }).views, 42)
        },
      },

      {
        name: 'should delete a thing',
        fn: async () => {
          const id = testId('delete-thing')
          await objects.create('Post', { title: 'To Delete' }, id)

          const deleted = await objects.delete(id)
          assertTrue(deleted, 'Delete should return true')

          const result = await objects.get(id)
          assertEqual(result, null)
        },
      },

      {
        name: 'should list things by noun',
        fn: async () => {
          const noun = `ListTest_${testId()}`
          await objects.create(noun, { name: 'item-1' })
          await objects.create(noun, { name: 'item-2' })
          await objects.create(noun, { name: 'item-3' })

          const results = await objects.list(noun)

          assertDefined(results)
          assertGreaterThan(results.length, 0, 'Should list created things')
        },
      },

      {
        name: 'should list things with pagination',
        fn: async () => {
          const noun = `PaginationTest_${testId()}`
          for (let i = 0; i < 5; i++) {
            await objects.create(noun, { name: `item-${i}`, index: i })
          }

          const page1 = await objects.list(noun, { limit: 2 })

          assertDefined(page1)
          assertTrue(page1.length <= 2, 'Should respect limit')
        },
      },

      // =====================================================================
      // Relationships
      // =====================================================================
      {
        name: 'should create a relationship between things',
        fn: async () => {
          const authorId = testId('author')
          const postId = testId('post')

          await objects.create('Person', { name: 'Alice' }, authorId)
          await objects.create('BlogPost', { title: 'Hello' }, postId)

          const action = await objects.relate(authorId, 'authored', postId)

          assertDefined(action, 'Relationship action should be defined')
          assertDefined(action.id, 'Action should have an ID')
          assertEqual(action.verb, 'authored')
        },
      },

      {
        name: 'should get related things',
        fn: async () => {
          const userId = testId('user')
          const docId1 = testId('doc1')
          const docId2 = testId('doc2')

          await objects.create('User', { name: 'Bob' }, userId)
          await objects.create('Document', { title: 'Doc 1' }, docId1)
          await objects.create('Document', { title: 'Doc 2' }, docId2)

          await objects.relate(userId, 'owns', docId1)
          await objects.relate(userId, 'owns', docId2)

          const related = await objects.related(userId, 'owns', 'out')

          assertDefined(related)
          assertGreaterThan(related.length, 0, 'Should find related things')
        },
      },

      {
        name: 'should remove a relationship',
        fn: async () => {
          const catId = testId('cat')
          const tagId = testId('tag')

          await objects.create('Category', { name: 'Tech' }, catId)
          await objects.create('Tag', { label: 'javascript' }, tagId)

          await objects.relate(catId, 'includes', tagId)
          const removed = await objects.unrelate(catId, 'includes', tagId)
          assertTrue(removed, 'Unrelate should return true')
        },
      },

      // =====================================================================
      // Search
      // =====================================================================
      {
        name: 'should search things by query',
        fn: async () => {
          const marker = testId('search')
          await objects.create('SearchableItem', {
            title: `${marker} findable thing`,
            description: 'This should be searchable',
          })

          const results = await objects.search(marker)

          assertDefined(results)
          assertGreaterThan(results.length, 0, 'Search should return results')
        },
      },

      // =====================================================================
      // Complex Data
      // =====================================================================
      {
        name: 'should handle nested data structures',
        fn: async () => {
          const id = testId('nested')
          await objects.create(
            'ComplexItem',
            {
              profile: {
                name: 'Test User',
                address: {
                  street: '123 Main St',
                  city: 'Testville',
                  state: 'TS',
                },
                tags: ['a', 'b', 'c'],
              },
              metadata: { version: 1 },
            },
            id
          )

          const retrieved = await objects.get(id)

          assertDefined(retrieved)
          const data = retrieved.data as {
            profile: {
              name: string
              address: { city: string }
              tags: string[]
            }
          }
          assertEqual(data.profile.name, 'Test User')
          assertEqual(data.profile.address.city, 'Testville')
          assertEqual(data.profile.tags.length, 3)
        },
      },

      {
        name: 'should handle numeric and boolean data types',
        fn: async () => {
          const id = testId('types')
          await objects.create(
            'TypedItem',
            {
              count: 42,
              ratio: 3.14,
              active: true,
              archived: false,
              score: 0,
            },
            id
          )

          const retrieved = await objects.get(id)

          assertDefined(retrieved)
          const data = retrieved.data as {
            count: number
            ratio: number
            active: boolean
            archived: boolean
            score: number
          }
          assertEqual(data.count, 42)
          assertEqual(data.ratio, 3.14)
          assertEqual(data.active, true)
          assertEqual(data.archived, false)
          assertEqual(data.score, 0)
        },
      },
    ],
  }
}
