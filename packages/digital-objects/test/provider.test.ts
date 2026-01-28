import { describe, it, expect, beforeEach } from 'vitest'
import type { DigitalObjectsProvider, Noun, Verb, Thing, Action } from '../src/types'
import { DEFAULT_LIMIT, MAX_LIMIT, validateDirection } from '../src/types'
import { createMemoryProvider } from '../src/memory-provider'

const createProvider = createMemoryProvider

describe('validateDirection', () => {
  it('should return valid direction values unchanged', () => {
    expect(validateDirection('in')).toBe('in')
    expect(validateDirection('out')).toBe('out')
    expect(validateDirection('both')).toBe('both')
  })

  it('should throw error for invalid direction values', () => {
    expect(() => validateDirection('invalid')).toThrow(
      'Invalid direction: "invalid". Must be "in", "out", or "both".'
    )
    expect(() => validateDirection('')).toThrow(
      'Invalid direction: "". Must be "in", "out", or "both".'
    )
    expect(() => validateDirection('up')).toThrow(
      'Invalid direction: "up". Must be "in", "out", or "both".'
    )
    expect(() => validateDirection('IN')).toThrow(
      'Invalid direction: "IN". Must be "in", "out", or "both".'
    )
  })
})

describe('DigitalObjectsProvider Contract', () => {
  let provider: DigitalObjectsProvider

  beforeEach(() => {
    provider = createProvider()
  })

  describe('Nouns', () => {
    it('should define a noun with auto-derived forms', async () => {
      const noun = await provider.defineNoun({ name: 'Post' })

      expect(noun.name).toBe('Post')
      expect(noun.singular).toBe('post')
      expect(noun.plural).toBe('posts')
      expect(noun.slug).toBe('post')
      expect(noun.createdAt).toBeInstanceOf(Date)
    })

    it('should define a noun with explicit forms', async () => {
      const noun = await provider.defineNoun({
        name: 'Person',
        singular: 'person',
        plural: 'people',
        description: 'A human being',
      })

      expect(noun.plural).toBe('people')
      expect(noun.description).toBe('A human being')
    })

    it('should get a noun by name', async () => {
      await provider.defineNoun({ name: 'Author' })
      const noun = await provider.getNoun('Author')

      expect(noun).not.toBeNull()
      expect(noun!.name).toBe('Author')
    })

    it('should return null for unknown noun', async () => {
      const noun = await provider.getNoun('Unknown')
      expect(noun).toBeNull()
    })

    it('should list all nouns', async () => {
      await provider.defineNoun({ name: 'Post' })
      await provider.defineNoun({ name: 'Author' })

      const nouns = await provider.listNouns()
      expect(nouns).toHaveLength(2)
    })
  })

  describe('Verbs', () => {
    it('should define a verb with auto-derived conjugations', async () => {
      const verb = await provider.defineVerb({ name: 'create' })

      expect(verb.name).toBe('create')
      expect(verb.action).toBe('create')
      expect(verb.act).toBe('creates')
      expect(verb.activity).toBe('creating')
      expect(verb.event).toBe('created')
      expect(verb.reverseBy).toBe('createdBy')
      expect(verb.reverseAt).toBe('createdAt')
    })

    it('should define a verb with inverse', async () => {
      const verb = await provider.defineVerb({
        name: 'publish',
        inverse: 'unpublish',
      })

      expect(verb.inverse).toBe('unpublish')
    })

    it('should handle irregular verbs', async () => {
      const verb = await provider.defineVerb({
        name: 'write',
        event: 'written', // Irregular past participle
      })

      expect(verb.event).toBe('written')
    })
  })

  describe('Things', () => {
    beforeEach(async () => {
      await provider.defineNoun({ name: 'Post' })
    })

    it('should create a thing', async () => {
      const thing = await provider.create('Post', { title: 'Hello World' })

      expect(thing.id).toBeDefined()
      expect(thing.noun).toBe('Post')
      expect(thing.data.title).toBe('Hello World')
      expect(thing.createdAt).toBeInstanceOf(Date)
    })

    it('should create a thing with custom ID', async () => {
      const thing = await provider.create('Post', { title: 'Custom' }, 'custom-id')
      expect(thing.id).toBe('custom-id')
    })

    it('should get a thing by ID', async () => {
      const created = await provider.create('Post', { title: 'Test' })
      const thing = await provider.get(created.id)

      expect(thing).not.toBeNull()
      expect(thing!.data.title).toBe('Test')
    })

    it('should list things by noun', async () => {
      await provider.create('Post', { title: 'First' })
      await provider.create('Post', { title: 'Second' })

      const posts = await provider.list('Post')
      expect(posts).toHaveLength(2)
    })

    it('should update a thing', async () => {
      const created = await provider.create('Post', { title: 'Original' })
      const updated = await provider.update(created.id, { title: 'Updated' })

      expect(updated.data.title).toBe('Updated')
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime())
    })

    it('should delete a thing', async () => {
      const created = await provider.create('Post', { title: 'ToDelete' })
      const deleted = await provider.delete(created.id)

      expect(deleted).toBe(true)
      expect(await provider.get(created.id)).toBeNull()
    })

    it('should find things by criteria', async () => {
      await provider.create('Post', { title: 'Draft', status: 'draft' })
      await provider.create('Post', { title: 'Published', status: 'published' })

      const drafts = await provider.find('Post', { status: 'draft' })
      expect(drafts).toHaveLength(1)
      expect(drafts[0].data.title).toBe('Draft')
    })
  })

  describe('Actions (Events + Edges)', () => {
    beforeEach(async () => {
      await provider.defineNoun({ name: 'Author' })
      await provider.defineNoun({ name: 'Post' })
      await provider.defineVerb({ name: 'write' })
      await provider.defineVerb({ name: 'publish' })
    })

    it('should perform an action (create edge)', async () => {
      const author = await provider.create('Author', { name: 'Alice' })
      const post = await provider.create('Post', { title: 'My Post' })

      const action = await provider.perform('write', author.id, post.id)

      expect(action.id).toBeDefined()
      expect(action.verb).toBe('write')
      expect(action.subject).toBe(author.id)
      expect(action.object).toBe(post.id)
      expect(action.status).toBe('completed')
    })

    it('should perform an action with data', async () => {
      const post = await provider.create('Post', { title: 'Draft' })

      const action = await provider.perform('publish', undefined, post.id, {
        publishedAt: new Date(),
        publishedBy: 'admin',
      })

      expect(action.data?.publishedBy).toBe('admin')
    })

    it('should traverse graph via related()', async () => {
      const author = await provider.create('Author', { name: 'Bob' })
      const post1 = await provider.create('Post', { title: 'Post 1' })
      const post2 = await provider.create('Post', { title: 'Post 2' })

      await provider.perform('write', author.id, post1.id)
      await provider.perform('write', author.id, post2.id)

      // Outbound: what did author write?
      const written = await provider.related(author.id, 'write', 'out')
      expect(written).toHaveLength(2)

      // Inbound: who wrote this post?
      const authors = await provider.related(post1.id, 'write', 'in')
      expect(authors).toHaveLength(1)
      expect(authors[0].data.name).toBe('Bob')
    })

    it('should list actions with filters', async () => {
      const author = await provider.create('Author', { name: 'Carol' })
      const post = await provider.create('Post', { title: 'Test' })

      await provider.perform('write', author.id, post.id)
      await provider.perform('publish', undefined, post.id)

      const writeActions = await provider.listActions({ verb: 'write' })
      expect(writeActions).toHaveLength(1)
    })

    it('should get edges for a thing', async () => {
      const author = await provider.create('Author', { name: 'Dan' })
      const post = await provider.create('Post', { title: 'Test' })

      await provider.perform('write', author.id, post.id)

      const outEdges = await provider.edges(author.id, undefined, 'out')
      expect(outEdges).toHaveLength(1)
      expect(outEdges[0].verb).toBe('write')
    })

    it('should delete an action (GDPR compliance)', async () => {
      const author = await provider.create('Author', { name: 'Eve' })
      const post = await provider.create('Post', { title: 'Test' })

      const action = await provider.perform('write', author.id, post.id)

      // Verify action exists
      expect(await provider.getAction(action.id)).not.toBeNull()

      // Delete the action
      const deleted = await provider.deleteAction(action.id)
      expect(deleted).toBe(true)

      // Verify action is gone
      expect(await provider.getAction(action.id)).toBeNull()
    })

    it('should return false when deleting non-existent action', async () => {
      const deleted = await provider.deleteAction('non-existent-id')
      expect(deleted).toBe(false)
    })

    it('should remove edge from graph after deleteAction', async () => {
      const author = await provider.create('Author', { name: 'Frank' })
      const post = await provider.create('Post', { title: 'Test' })

      const action = await provider.perform('write', author.id, post.id)

      // Verify edge exists
      const edgesBefore = await provider.edges(author.id, 'write', 'out')
      expect(edgesBefore).toHaveLength(1)

      // Delete the action
      await provider.deleteAction(action.id)

      // Verify edge is gone
      const edgesAfter = await provider.edges(author.id, 'write', 'out')
      expect(edgesAfter).toHaveLength(0)
    })

    it('should remove relation after deleteAction', async () => {
      const author = await provider.create('Author', { name: 'Grace' })
      const post = await provider.create('Post', { title: 'Test' })

      const action = await provider.perform('write', author.id, post.id)

      // Verify relation exists
      const relatedBefore = await provider.related(author.id, 'write', 'out')
      expect(relatedBefore).toHaveLength(1)

      // Delete the action
      await provider.deleteAction(action.id)

      // Verify relation is gone
      const relatedAfter = await provider.related(author.id, 'write', 'out')
      expect(relatedAfter).toHaveLength(0)
    })

    it('should throw error for invalid direction in related()', async () => {
      const author = await provider.create('Author', { name: 'Henry' })

      await expect(
        provider.related(author.id, 'write', 'invalid' as 'out' | 'in' | 'both')
      ).rejects.toThrow('Invalid direction: "invalid". Must be "in", "out", or "both".')
    })

    it('should throw error for invalid direction in edges()', async () => {
      const author = await provider.create('Author', { name: 'Ivy' })

      await expect(
        provider.edges(author.id, 'write', 'sideways' as 'out' | 'in' | 'both')
      ).rejects.toThrow('Invalid direction: "sideways". Must be "in", "out", or "both".')
    })

    it('should accept valid direction values', async () => {
      const author = await provider.create('Author', { name: 'Jack' })
      const post = await provider.create('Post', { title: 'Test' })
      await provider.perform('write', author.id, post.id)

      // All valid directions should work without throwing
      await expect(provider.related(author.id, 'write', 'out')).resolves.toHaveLength(1)
      await expect(provider.related(post.id, 'write', 'in')).resolves.toHaveLength(1)
      await expect(provider.related(author.id, 'write', 'both')).resolves.toHaveLength(1)

      await expect(provider.edges(author.id, 'write', 'out')).resolves.toHaveLength(1)
      await expect(provider.edges(post.id, 'write', 'in')).resolves.toHaveLength(1)
      await expect(provider.edges(author.id, 'write', 'both')).resolves.toHaveLength(1)
    })
  })

  describe('Query Limits', () => {
    beforeEach(async () => {
      await provider.defineNoun({ name: 'Item' })
      await provider.defineVerb({ name: 'connect' })
    })

    it('should apply DEFAULT_LIMIT when no limit specified for list()', async () => {
      // Create more items than DEFAULT_LIMIT
      const itemCount = DEFAULT_LIMIT + 50
      for (let i = 0; i < itemCount; i++) {
        await provider.create('Item', { index: i })
      }

      const items = await provider.list('Item')
      expect(items).toHaveLength(DEFAULT_LIMIT)
    })

    it('should enforce MAX_LIMIT for list() even when higher limit requested', async () => {
      // Create more items than MAX_LIMIT
      const itemCount = MAX_LIMIT + 50
      for (let i = 0; i < itemCount; i++) {
        await provider.create('Item', { index: i })
      }

      const items = await provider.list('Item', { limit: MAX_LIMIT + 500 })
      expect(items).toHaveLength(MAX_LIMIT)
    })

    it('should respect user limit when below MAX_LIMIT for list()', async () => {
      for (let i = 0; i < 50; i++) {
        await provider.create('Item', { index: i })
      }

      const items = await provider.list('Item', { limit: 10 })
      expect(items).toHaveLength(10)
    })

    it('should apply DEFAULT_LIMIT when no limit specified for search()', async () => {
      const itemCount = DEFAULT_LIMIT + 50
      for (let i = 0; i < itemCount; i++) {
        await provider.create('Item', { name: `searchable-${i}` })
      }

      const results = await provider.search('searchable')
      expect(results).toHaveLength(DEFAULT_LIMIT)
    })

    it('should enforce MAX_LIMIT for search() even when higher limit requested', async () => {
      const itemCount = MAX_LIMIT + 50
      for (let i = 0; i < itemCount; i++) {
        await provider.create('Item', { name: `searchable-${i}` })
      }

      const results = await provider.search('searchable', { limit: MAX_LIMIT + 500 })
      expect(results).toHaveLength(MAX_LIMIT)
    })

    it('should apply DEFAULT_LIMIT when no limit specified for listActions()', async () => {
      const item = await provider.create('Item', { name: 'target' })
      const actionCount = DEFAULT_LIMIT + 50
      for (let i = 0; i < actionCount; i++) {
        await provider.perform('connect', undefined, item.id, { index: i })
      }

      const actions = await provider.listActions()
      expect(actions).toHaveLength(DEFAULT_LIMIT)
    })

    it('should enforce MAX_LIMIT for listActions() even when higher limit requested', async () => {
      const item = await provider.create('Item', { name: 'target' })
      const actionCount = MAX_LIMIT + 50
      for (let i = 0; i < actionCount; i++) {
        await provider.perform('connect', undefined, item.id, { index: i })
      }

      const actions = await provider.listActions({ limit: MAX_LIMIT + 500 })
      expect(actions).toHaveLength(MAX_LIMIT)
    })

    it('should apply DEFAULT_LIMIT when no limit specified for edges()', async () => {
      const source = await provider.create('Item', { name: 'source' })
      const edgeCount = DEFAULT_LIMIT + 50
      for (let i = 0; i < edgeCount; i++) {
        const target = await provider.create('Item', { name: `target-${i}` })
        await provider.perform('connect', source.id, target.id)
      }

      const edges = await provider.edges(source.id, 'connect', 'out')
      expect(edges).toHaveLength(DEFAULT_LIMIT)
    })

    it('should apply DEFAULT_LIMIT when no limit specified for related()', async () => {
      const source = await provider.create('Item', { name: 'source' })
      const relatedCount = DEFAULT_LIMIT + 50
      for (let i = 0; i < relatedCount; i++) {
        const target = await provider.create('Item', { name: `target-${i}` })
        await provider.perform('connect', source.id, target.id)
      }

      const related = await provider.related(source.id, 'connect', 'out')
      expect(related).toHaveLength(DEFAULT_LIMIT)
    })

    it('should export DEFAULT_LIMIT and MAX_LIMIT constants', () => {
      expect(DEFAULT_LIMIT).toBe(100)
      expect(MAX_LIMIT).toBe(1000)
    })
  })

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await provider.defineNoun({ name: 'Product' })
      await provider.defineVerb({ name: 'tag' })
    })

    describe('createMany', () => {
      it('should create multiple things at once', async () => {
        const items = [
          { name: 'Product A', price: 10 },
          { name: 'Product B', price: 20 },
          { name: 'Product C', price: 30 },
        ]

        const created = await provider.createMany('Product', items)

        expect(created).toHaveLength(3)
        expect(created[0].data.name).toBe('Product A')
        expect(created[1].data.name).toBe('Product B')
        expect(created[2].data.name).toBe('Product C')
        expect(created[0].noun).toBe('Product')
        expect(created[0].id).toBeDefined()
      })

      it('should return empty array for empty input', async () => {
        const created = await provider.createMany('Product', [])
        expect(created).toHaveLength(0)
      })

      it('should persist all created things', async () => {
        const items = [
          { name: 'P1', price: 100 },
          { name: 'P2', price: 200 },
        ]

        const created = await provider.createMany('Product', items)

        // Verify all are persisted
        for (const thing of created) {
          const fetched = await provider.get(thing.id)
          expect(fetched).not.toBeNull()
          expect(fetched!.data).toEqual(thing.data)
        }
      })
    })

    describe('updateMany', () => {
      it('should update multiple things at once', async () => {
        const p1 = await provider.create('Product', { name: 'P1', price: 10 })
        const p2 = await provider.create('Product', { name: 'P2', price: 20 })
        const p3 = await provider.create('Product', { name: 'P3', price: 30 })

        const updated = await provider.updateMany([
          { id: p1.id, data: { price: 15 } },
          { id: p2.id, data: { price: 25 } },
          { id: p3.id, data: { price: 35, discount: true } },
        ])

        expect(updated).toHaveLength(3)
        expect(updated[0].data.price).toBe(15)
        expect(updated[0].data.name).toBe('P1') // Original data preserved
        expect(updated[1].data.price).toBe(25)
        expect(updated[2].data.price).toBe(35)
        expect(updated[2].data.discount).toBe(true)
      })

      it('should return empty array for empty input', async () => {
        const updated = await provider.updateMany([])
        expect(updated).toHaveLength(0)
      })

      it('should throw error if any ID not found', async () => {
        const p1 = await provider.create('Product', { name: 'P1', price: 10 })

        await expect(
          provider.updateMany([
            { id: p1.id, data: { price: 15 } },
            { id: 'non-existent-id', data: { price: 25 } },
          ])
        ).rejects.toThrow()
      })

      it('should persist all updates', async () => {
        const p1 = await provider.create('Product', { name: 'P1', price: 10 })
        const p2 = await provider.create('Product', { name: 'P2', price: 20 })

        await provider.updateMany([
          { id: p1.id, data: { price: 100 } },
          { id: p2.id, data: { price: 200 } },
        ])

        const fetched1 = await provider.get(p1.id)
        const fetched2 = await provider.get(p2.id)

        expect(fetched1!.data.price).toBe(100)
        expect(fetched2!.data.price).toBe(200)
      })
    })

    describe('deleteMany', () => {
      it('should delete multiple things at once', async () => {
        const p1 = await provider.create('Product', { name: 'P1' })
        const p2 = await provider.create('Product', { name: 'P2' })
        const p3 = await provider.create('Product', { name: 'P3' })

        const results = await provider.deleteMany([p1.id, p2.id, p3.id])

        expect(results).toHaveLength(3)
        expect(results).toEqual([true, true, true])

        // Verify all are deleted
        expect(await provider.get(p1.id)).toBeNull()
        expect(await provider.get(p2.id)).toBeNull()
        expect(await provider.get(p3.id)).toBeNull()
      })

      it('should return empty array for empty input', async () => {
        const results = await provider.deleteMany([])
        expect(results).toHaveLength(0)
      })

      it('should return false for non-existent IDs', async () => {
        const p1 = await provider.create('Product', { name: 'P1' })

        const results = await provider.deleteMany([p1.id, 'non-existent-1', 'non-existent-2'])

        expect(results).toHaveLength(3)
        expect(results[0]).toBe(true) // Existing was deleted
        expect(results[1]).toBe(false) // Non-existent
        expect(results[2]).toBe(false) // Non-existent
      })

      it('should only delete specified items', async () => {
        const p1 = await provider.create('Product', { name: 'P1' })
        const p2 = await provider.create('Product', { name: 'P2' })
        const p3 = await provider.create('Product', { name: 'P3' })

        await provider.deleteMany([p1.id, p3.id])

        expect(await provider.get(p1.id)).toBeNull()
        expect(await provider.get(p2.id)).not.toBeNull() // P2 should remain
        expect(await provider.get(p3.id)).toBeNull()
      })
    })

    describe('performMany', () => {
      it('should perform multiple actions at once', async () => {
        const p1 = await provider.create('Product', { name: 'P1' })
        const p2 = await provider.create('Product', { name: 'P2' })
        const p3 = await provider.create('Product', { name: 'P3' })

        const actions = await provider.performMany([
          { verb: 'tag', subject: undefined, object: p1.id, data: { tag: 'electronics' } },
          { verb: 'tag', subject: undefined, object: p2.id, data: { tag: 'clothing' } },
          { verb: 'tag', subject: undefined, object: p3.id, data: { tag: 'books' } },
        ])

        expect(actions).toHaveLength(3)
        expect(actions[0].verb).toBe('tag')
        expect(actions[0].object).toBe(p1.id)
        expect(actions[0].data?.tag).toBe('electronics')
        expect(actions[1].data?.tag).toBe('clothing')
        expect(actions[2].data?.tag).toBe('books')
        expect(actions[0].status).toBe('completed')
      })

      it('should return empty array for empty input', async () => {
        const actions = await provider.performMany([])
        expect(actions).toHaveLength(0)
      })

      it('should persist all performed actions', async () => {
        const p1 = await provider.create('Product', { name: 'P1' })
        const p2 = await provider.create('Product', { name: 'P2' })

        const performed = await provider.performMany([
          { verb: 'tag', object: p1.id, data: { tag: 'sale' } },
          { verb: 'tag', object: p2.id, data: { tag: 'new' } },
        ])

        // Verify all actions are persisted
        for (const action of performed) {
          const fetched = await provider.getAction(action.id)
          expect(fetched).not.toBeNull()
          expect(fetched!.verb).toBe('tag')
        }
      })

      it('should support actions with subject and object', async () => {
        await provider.defineNoun({ name: 'User' })
        const user = await provider.create('User', { name: 'Admin' })
        const product = await provider.create('Product', { name: 'Item' })

        const actions = await provider.performMany([
          { verb: 'tag', subject: user.id, object: product.id, data: { action: 'categorized' } },
        ])

        expect(actions[0].subject).toBe(user.id)
        expect(actions[0].object).toBe(product.id)
      })

      it('should support actions without data', async () => {
        const p1 = await provider.create('Product', { name: 'P1' })

        const actions = await provider.performMany([{ verb: 'tag', object: p1.id }])

        expect(actions).toHaveLength(1)
        expect(actions[0].data).toBeUndefined()
      })
    })

    describe('batch performance benefit', () => {
      it('should handle large batches efficiently', async () => {
        const items = Array.from({ length: 100 }, (_, i) => ({
          name: `Product ${i}`,
          price: i * 10,
        }))

        const start = Date.now()
        const created = await provider.createMany('Product', items)
        const duration = Date.now() - start

        expect(created).toHaveLength(100)
        // Just verify it completes - performance varies by implementation
        expect(duration).toBeLessThan(5000) // Should be much faster, but give buffer
      })
    })
  })
})
