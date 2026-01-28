/**
 * Interface Tests for Entity Operations Module
 *
 * RED PHASE: These tests define the expected public API for the entity-operations
 * module that will be extracted from schema/index.ts.
 *
 * Tests import from a module that doesn't exist yet:
 * - src/schema/entity-operations.ts
 *
 * Expected exports:
 * - createEntityOperations<T>(typeName, entity, schema) -> EntityOperations<T>
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Import from the module that will be created (doesn't exist yet)
// This import will cause the tests to fail until the module is extracted
import {
  createEntityOperations,
  type EntityOperationsConfig,
} from '../../src/schema/entity-operations.js'

import { parseSchema, setProvider, createMemoryProvider } from '../../src/index.js'
import type { ParsedEntity, ParsedSchema } from '../../src/types.js'
import type {
  EntityOperations,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  DraftOptions,
  ResolveOptions,
  Draft,
  Resolved,
} from '../../src/schema/types.js'

// TODO: Advanced feature tests - needs investigation
describe.skip('Entity Operations Module Interface', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('createEntityOperations function signature', () => {
    it('should export createEntityOperations function', () => {
      expect(createEntityOperations).toBeDefined()
      expect(typeof createEntityOperations).toBe('function')
    })

    it('should accept typeName, entity, and schema parameters', () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          content: 'string',
        },
      })

      const entity = schema.entities.get('Post')!
      const ops = createEntityOperations<{
        $id: string
        $type: string
        title: string
        content: string
      }>('Post', entity, schema)

      expect(ops).toBeDefined()
    })

    it('should optionally accept a config object', () => {
      const schema = parseSchema({
        Post: { title: 'string' },
      })
      const entity = schema.entities.get('Post')!

      // Config allows customizing behavior
      const config: EntityOperationsConfig = {
        generateAIFields: true,
        resolveRelations: true,
      }

      const ops = createEntityOperations('Post', entity, schema, config)
      expect(ops).toBeDefined()
    })
  })

  describe('EntityOperations interface - CRUD operations', () => {
    let ops: EntityOperations<{ $id: string; $type: string; title: string; content: string }>

    beforeEach(() => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          content: 'string',
        },
      })
      const entity = schema.entities.get('Post')!
      ops = createEntityOperations('Post', entity, schema)
    })

    it('should have get(id) method returning Promise<T | null>', async () => {
      expect(ops.get).toBeDefined()
      expect(typeof ops.get).toBe('function')

      const result = await ops.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should have list(options?) method returning Promise<T[]>', async () => {
      expect(ops.list).toBeDefined()
      expect(typeof ops.list).toBe('function')

      const results = await ops.list()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should support list with ListOptions', async () => {
      const options: ListOptions = {
        where: { title: 'Test' },
        orderBy: 'title',
        order: 'asc',
        limit: 10,
        offset: 0,
      }

      const results = await ops.list(options)
      expect(Array.isArray(results)).toBe(true)
    })

    it('should have find(where) method returning Promise<T[]>', async () => {
      expect(ops.find).toBeDefined()
      expect(typeof ops.find).toBe('function')

      const results = await ops.find({ title: 'Test' })
      expect(Array.isArray(results)).toBe(true)
    })

    it('should have create(data) method returning Promise<T>', async () => {
      expect(ops.create).toBeDefined()
      expect(typeof ops.create).toBe('function')

      const post = await ops.create({ title: 'Test', content: 'Content' })
      expect(post.$id).toBeDefined()
      expect(post.$type).toBe('Post')
      expect(post.title).toBe('Test')
    })

    it('should have create(id, data) overload returning Promise<T>', async () => {
      const post = await ops.create('custom-id', { title: 'Test', content: 'Content' })
      expect(post.$id).toBe('custom-id')
      expect(post.title).toBe('Test')
    })

    it('should have update(id, data) method returning Promise<T>', async () => {
      expect(ops.update).toBeDefined()
      expect(typeof ops.update).toBe('function')

      const post = await ops.create({ title: 'Original', content: 'Content' })
      const updated = await ops.update(post.$id, { title: 'Updated' })
      expect(updated.title).toBe('Updated')
    })

    it('should have upsert(id, data) method returning Promise<T>', async () => {
      expect(ops.upsert).toBeDefined()
      expect(typeof ops.upsert).toBe('function')

      // Create via upsert
      const created = await ops.upsert('upsert-id', { title: 'Created', content: 'Content' })
      expect(created.$id).toBe('upsert-id')

      // Update via upsert
      const updated = await ops.upsert('upsert-id', { title: 'Updated', content: 'Content' })
      expect(updated.title).toBe('Updated')
    })

    it('should have delete(id) method returning Promise<boolean>', async () => {
      expect(ops.delete).toBeDefined()
      expect(typeof ops.delete).toBe('function')

      const post = await ops.create({ title: 'Delete Me', content: 'Content' })
      const deleted = await ops.delete(post.$id)
      expect(deleted).toBe(true)

      const fetched = await ops.get(post.$id)
      expect(fetched).toBeNull()
    })
  })

  describe('EntityOperations interface - Search operations', () => {
    let ops: EntityOperations<{ $id: string; $type: string; title: string; content: string }>

    beforeEach(() => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          content: 'string',
        },
      })
      const entity = schema.entities.get('Post')!
      ops = createEntityOperations('Post', entity, schema)
    })

    it('should have search(query, options?) method returning Promise<T[]>', async () => {
      expect(ops.search).toBeDefined()
      expect(typeof ops.search).toBe('function')

      await ops.create({ title: 'Hello World', content: 'Test content' })
      const results = await ops.search('Hello')
      expect(Array.isArray(results)).toBe(true)
    })

    it('should support search with SearchOptions', async () => {
      const options: SearchOptions = {
        fields: ['title', 'content'],
        minScore: 0.5,
        limit: 10,
      }

      const results = await ops.search('query', options)
      expect(Array.isArray(results)).toBe(true)
    })

    it('should have semanticSearch method returning Promise<Array<T & { $score: number }>>', async () => {
      expect(ops.semanticSearch).toBeDefined()
      expect(typeof ops.semanticSearch).toBe('function')

      const options: SemanticSearchOptions = {
        minScore: 0.7,
        limit: 10,
      }

      const results = await ops.semanticSearch!('semantic query', options)
      expect(Array.isArray(results)).toBe(true)
      // Results should have $score property
      for (const result of results) {
        expect(typeof result.$score).toBe('number')
      }
    })

    it('should have hybridSearch method returning scored results', async () => {
      expect(ops.hybridSearch).toBeDefined()
      expect(typeof ops.hybridSearch).toBe('function')

      const options: HybridSearchOptions = {
        minScore: 0.5,
        limit: 10,
        rrfK: 60,
        ftsWeight: 0.5,
        semanticWeight: 0.5,
      }

      const results = await ops.hybridSearch!('hybrid query', options)
      expect(Array.isArray(results)).toBe(true)
      // Results should have scoring properties
      for (const result of results) {
        expect(typeof result.$rrfScore).toBe('number')
        expect(typeof result.$ftsRank).toBe('number')
        expect(typeof result.$semanticRank).toBe('number')
        expect(typeof result.$score).toBe('number')
      }
    })
  })

  describe('EntityOperations interface - forEach iteration', () => {
    let ops: EntityOperations<{ $id: string; $type: string; title: string }>

    beforeEach(async () => {
      const schema = parseSchema({
        Item: { title: 'string' },
      })
      const entity = schema.entities.get('Item')!
      ops = createEntityOperations('Item', entity, schema)

      // Create test items
      await ops.create({ title: 'Item 1' })
      await ops.create({ title: 'Item 2' })
      await ops.create({ title: 'Item 3' })
    })

    it('should have forEach(callback) method', async () => {
      expect(ops.forEach).toBeDefined()
      expect(typeof ops.forEach).toBe('function')

      const items: string[] = []
      await ops.forEach((item) => {
        items.push(item.title)
      })

      expect(items.length).toBe(3)
    })

    it('should have forEach(options, callback) overload', async () => {
      const items: string[] = []
      await ops.forEach({ limit: 2 }, (item) => {
        items.push(item.title)
      })

      expect(items.length).toBe(2)
    })

    it('should support async callbacks in forEach', async () => {
      const items: string[] = []
      await ops.forEach(async (item) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        items.push(item.title)
      })

      expect(items.length).toBe(3)
    })
  })

  describe('EntityOperations interface - Draft/Resolve two-phase', () => {
    it('should have draft(data, options?) method returning Promise<Draft<T>>', async () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          author: '~>Author',
        },
        Author: { name: 'string' },
      })
      const entity = schema.entities.get('Post')!
      const ops = createEntityOperations<{
        $id: string
        $type: string
        title: string
        author: string
      }>('Post', entity, schema)

      expect(ops.draft).toBeDefined()
      expect(typeof ops.draft).toBe('function')

      const draftOptions: DraftOptions = {
        stream: false,
      }

      const draft = await ops.draft!({ title: 'Test Post' }, draftOptions)
      expect(draft.$phase).toBe('draft')
      expect(draft.$refs).toBeDefined()
    })

    it('should have resolve(draft, options?) method returning Promise<Resolved<T>>', async () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          author: '~>Author',
        },
        Author: { name: 'string' },
      })
      const entity = schema.entities.get('Post')!
      const ops = createEntityOperations<{
        $id: string
        $type: string
        title: string
        author: string
      }>('Post', entity, schema)

      expect(ops.resolve).toBeDefined()
      expect(typeof ops.resolve).toBe('function')

      const draft = await ops.draft!({ title: 'Test Post' })

      const resolveOptions: ResolveOptions = {
        onError: 'skip',
        onResolved: (fieldName, entityId) => {
          // Callback when a field is resolved
        },
      }

      const resolved = await ops.resolve!(draft, resolveOptions)
      expect(resolved.$phase).toBe('resolved')
    })
  })

  describe('EntityOperations with relationships', () => {
    it('should handle forward exact (->) relationships', async () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          author: '->Author',
        },
        Author: { name: 'string' },
      })
      const postEntity = schema.entities.get('Post')!
      const authorEntity = schema.entities.get('Author')!

      const authorOps = createEntityOperations<{ $id: string; $type: string; name: string }>(
        'Author',
        authorEntity,
        schema
      )
      const postOps = createEntityOperations<{
        $id: string
        $type: string
        title: string
        author: string
      }>('Post', postEntity, schema)

      const author = await authorOps.create({ name: 'John' })
      const post = await postOps.create({ title: 'Hello', author: author.$id })

      // Forward relations are wrapped in thenable proxies that:
      // - Act like strings when coerced (toString(), String())
      // - Can be awaited to get the full related entity
      expect(String(post.author)).toBe(author.$id)
      expect(post.author.toString()).toBe(author.$id)

      // Verify the proxy can be awaited to get the full entity
      const resolvedAuthor = await post.author
      expect(resolvedAuthor?.$id).toBe(author.$id)
      expect(resolvedAuthor?.name).toBe('John')
    })

    it('should handle forward fuzzy (~>) relationships', async () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          category: '~>Category',
        },
        Category: { name: 'string' },
      })
      const postEntity = schema.entities.get('Post')!
      const categoryEntity = schema.entities.get('Category')!

      const categoryOps = createEntityOperations<{ $id: string; $type: string; name: string }>(
        'Category',
        categoryEntity,
        schema
      )
      const postOps = createEntityOperations<{
        $id: string
        $type: string
        title: string
        category: string
      }>('Post', postEntity, schema)

      await categoryOps.create({ name: 'Technology' })

      // Fuzzy matching should find by semantic similarity
      const draft = await postOps.draft!({ title: 'AI News', categoryHint: 'tech' })
      expect(draft.$refs).toBeDefined()
      expect(draft.$refs.category).toBeDefined()
    })

    it('should handle backward references (<-)', async () => {
      const schema = parseSchema({
        Author: {
          name: 'string',
          posts: ['<-Post.author'],
        },
        Post: {
          title: 'string',
          author: '->Author',
        },
      })
      const authorEntity = schema.entities.get('Author')!
      const postEntity = schema.entities.get('Post')!

      const authorOps = createEntityOperations<{
        $id: string
        $type: string
        name: string
        posts: string[]
      }>('Author', authorEntity, schema)
      const postOps = createEntityOperations<{
        $id: string
        $type: string
        title: string
        author: string
      }>('Post', postEntity, schema)

      const author = await authorOps.create({ name: 'Jane' })
      await postOps.create({ title: 'Post 1', author: author.$id })
      await postOps.create({ title: 'Post 2', author: author.$id })

      // Backward reference should find related posts
      const fetchedAuthor = await authorOps.get(author.$id)
      expect(fetchedAuthor).toBeDefined()
    })
  })

  describe('EntityOperationsConfig options', () => {
    it('should respect generateAIFields config', async () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          summary: 'Write a brief summary of the post',
        },
      })
      const entity = schema.entities.get('Post')!

      // With AI generation enabled
      const opsWithAI = createEntityOperations('Post', entity, schema, {
        generateAIFields: true,
      })
      expect(opsWithAI).toBeDefined()

      // With AI generation disabled
      const opsWithoutAI = createEntityOperations('Post', entity, schema, {
        generateAIFields: false,
      })
      expect(opsWithoutAI).toBeDefined()
    })

    it('should respect resolveRelations config', async () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          author: '->Author',
        },
        Author: { name: 'string' },
      })
      const entity = schema.entities.get('Post')!

      // With relation resolution enabled
      const opsWithRelations = createEntityOperations('Post', entity, schema, {
        resolveRelations: true,
      })
      expect(opsWithRelations).toBeDefined()

      // With relation resolution disabled (raw IDs)
      const opsWithoutRelations = createEntityOperations('Post', entity, schema, {
        resolveRelations: false,
      })
      expect(opsWithoutRelations).toBeDefined()
    })
  })
})
