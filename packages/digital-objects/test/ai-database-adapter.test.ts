import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDBProviderAdapter, type DBProvider } from '../src/ai-database-adapter.js'
import { MemoryProvider } from '../src/memory-provider.js'

describe('ai-database Adapter', () => {
  let memoryProvider: MemoryProvider
  let adapter: DBProvider

  beforeEach(() => {
    memoryProvider = new MemoryProvider()
    adapter = createDBProviderAdapter(memoryProvider)
  })

  describe('get(type, id)', () => {
    it('should retrieve an entity by type and id', async () => {
      // Setup: create a thing directly in the memory provider
      await memoryProvider.defineNoun({ name: 'User' })
      const thing = await memoryProvider.create(
        'User',
        { name: 'Alice', email: 'alice@example.com' },
        'user-1'
      )

      // Test: get via adapter
      const entity = await adapter.get('User', 'user-1')

      expect(entity).not.toBeNull()
      expect(entity!.$id).toBe('user-1')
      expect(entity!.$type).toBe('User')
      expect(entity!.name).toBe('Alice')
      expect(entity!.email).toBe('alice@example.com')
    })

    it('should return null for non-existent entity', async () => {
      const entity = await adapter.get('User', 'non-existent')
      expect(entity).toBeNull()
    })

    it('should return null if entity exists but type does not match', async () => {
      await memoryProvider.defineNoun({ name: 'User' })
      await memoryProvider.create('User', { name: 'Bob' }, 'user-1')

      // Try to get as a different type
      const entity = await adapter.get('Admin', 'user-1')
      expect(entity).toBeNull()
    })
  })

  describe('list(type, options)', () => {
    beforeEach(async () => {
      await memoryProvider.defineNoun({ name: 'Product' })
      await memoryProvider.create(
        'Product',
        { name: 'Apple', price: 1.5, category: 'fruit' },
        'prod-1'
      )
      await memoryProvider.create(
        'Product',
        { name: 'Banana', price: 0.75, category: 'fruit' },
        'prod-2'
      )
      await memoryProvider.create(
        'Product',
        { name: 'Carrot', price: 0.5, category: 'vegetable' },
        'prod-3'
      )
    })

    it('should list all entities of a type', async () => {
      const entities = await adapter.list('Product')

      expect(entities).toHaveLength(3)
      expect(entities.every((e) => e.$type === 'Product')).toBe(true)
    })

    it('should filter entities with where clause', async () => {
      const entities = await adapter.list('Product', { where: { category: 'fruit' } })

      expect(entities).toHaveLength(2)
      expect(entities.every((e) => e.category === 'fruit')).toBe(true)
    })

    it('should limit results', async () => {
      const entities = await adapter.list('Product', { limit: 2 })
      expect(entities).toHaveLength(2)
    })

    it('should offset results', async () => {
      const entities = await adapter.list('Product', { offset: 1 })
      expect(entities).toHaveLength(2)
    })

    it('should order results ascending', async () => {
      const entities = await adapter.list('Product', { orderBy: 'price', order: 'asc' })

      expect(entities[0].name).toBe('Carrot')
      expect(entities[1].name).toBe('Banana')
      expect(entities[2].name).toBe('Apple')
    })

    it('should order results descending', async () => {
      const entities = await adapter.list('Product', { orderBy: 'price', order: 'desc' })

      expect(entities[0].name).toBe('Apple')
      expect(entities[1].name).toBe('Banana')
      expect(entities[2].name).toBe('Carrot')
    })

    it('should combine limit and offset for pagination', async () => {
      const page1 = await adapter.list('Product', { limit: 2, offset: 0 })
      const page2 = await adapter.list('Product', { limit: 2, offset: 2 })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(1)
    })

    it('should return empty array for unknown type', async () => {
      const entities = await adapter.list('Unknown')
      expect(entities).toEqual([])
    })
  })

  describe('search(type, query, options)', () => {
    beforeEach(async () => {
      await memoryProvider.defineNoun({ name: 'Article' })
      await memoryProvider.defineNoun({ name: 'Comment' })
      await memoryProvider.create(
        'Article',
        { title: 'TypeScript Guide', content: 'Learn TypeScript basics' },
        'art-1'
      )
      await memoryProvider.create(
        'Article',
        { title: 'JavaScript Tips', content: 'Improve your JS skills' },
        'art-2'
      )
      await memoryProvider.create('Comment', { text: 'Great TypeScript article!' }, 'com-1')
    })

    it('should search entities by query', async () => {
      const entities = await adapter.search('Article', 'TypeScript')

      expect(entities).toHaveLength(1)
      expect(entities[0].$id).toBe('art-1')
      expect(entities[0].$type).toBe('Article')
    })

    it('should filter by type (not return other types)', async () => {
      // Search for 'TypeScript' which exists in both Article and Comment
      const articles = await adapter.search('Article', 'TypeScript')
      const comments = await adapter.search('Comment', 'TypeScript')

      expect(articles).toHaveLength(1)
      expect(articles[0].$type).toBe('Article')
      expect(comments).toHaveLength(1)
      expect(comments[0].$type).toBe('Comment')
    })

    it('should be case-insensitive', async () => {
      const entities = await adapter.search('Article', 'typescript')
      expect(entities).toHaveLength(1)
    })

    it('should return empty array for no matches', async () => {
      const entities = await adapter.search('Article', 'Python')
      expect(entities).toEqual([])
    })

    it('should respect limit option', async () => {
      await memoryProvider.create(
        'Article',
        { title: 'More TypeScript', content: 'Advanced TypeScript' },
        'art-3'
      )

      // The search matches all content containing the query
      const entities = await adapter.search('Article', 'TypeScript', { limit: 1 })
      expect(entities).toHaveLength(1)
    })
  })

  describe('create(type, id, data)', () => {
    it('should create an entity with provided id', async () => {
      const entity = await adapter.create('Task', 'task-1', {
        title: 'Complete tests',
        done: false,
      })

      expect(entity.$id).toBe('task-1')
      expect(entity.$type).toBe('Task')
      expect(entity.title).toBe('Complete tests')
      expect(entity.done).toBe(false)
    })

    it('should create an entity with auto-generated id', async () => {
      const entity = await adapter.create('Task', undefined, { title: 'Auto ID task' })

      expect(entity.$id).toBeDefined()
      expect(entity.$id).not.toBe('')
      expect(entity.$type).toBe('Task')
    })

    it('should auto-define noun if not already defined', async () => {
      // Noun does not exist yet
      let noun = await memoryProvider.getNoun('NewType')
      expect(noun).toBeNull()

      // Create via adapter
      await adapter.create('NewType', 'nt-1', { value: 42 })

      // Noun should now exist
      noun = await memoryProvider.getNoun('NewType')
      expect(noun).not.toBeNull()
      expect(noun!.name).toBe('NewType')
    })

    it('should not re-define noun if already exists', async () => {
      // Pre-define noun with description
      await memoryProvider.defineNoun({ name: 'Widget', description: 'A widget thing' })

      // Create via adapter
      await adapter.create('Widget', 'w-1', { size: 'large' })

      // Original noun should still have description
      const noun = await memoryProvider.getNoun('Widget')
      expect(noun!.description).toBe('A widget thing')
    })

    it('should strip $id and $type from data before storing', async () => {
      const entity = await adapter.create('Item', 'item-1', {
        $id: 'should-be-ignored',
        $type: 'ShouldBeIgnored',
        name: 'Real Name',
      })

      // Entity should have correct $id and $type
      expect(entity.$id).toBe('item-1')
      expect(entity.$type).toBe('Item')
      expect(entity.name).toBe('Real Name')

      // Underlying thing should not have $id/$type in data
      const thing = await memoryProvider.get('item-1')
      expect(thing!.data).not.toHaveProperty('$id')
      expect(thing!.data).not.toHaveProperty('$type')
    })
  })

  describe('update(type, id, data)', () => {
    beforeEach(async () => {
      await memoryProvider.defineNoun({ name: 'Note' })
      await memoryProvider.create(
        'Note',
        { title: 'Original', content: 'Initial content' },
        'note-1'
      )
    })

    it('should update an entity', async () => {
      const updated = await adapter.update('Note', 'note-1', { title: 'Updated Title' })

      expect(updated.$id).toBe('note-1')
      expect(updated.$type).toBe('Note')
      expect(updated.title).toBe('Updated Title')
      expect(updated.content).toBe('Initial content') // Preserved
    })

    it('should merge new data with existing data', async () => {
      await adapter.update('Note', 'note-1', { tags: ['important'] })

      const entity = await adapter.get('Note', 'note-1')
      expect(entity!.title).toBe('Original')
      expect(entity!.content).toBe('Initial content')
      expect(entity!.tags).toEqual(['important'])
    })

    it('should throw error for non-existent entity', async () => {
      await expect(adapter.update('Note', 'non-existent', { title: 'Test' })).rejects.toThrow(
        'Thing not found'
      )
    })

    it('should strip $id and $type from update data', async () => {
      const updated = await adapter.update('Note', 'note-1', {
        $id: 'ignored',
        $type: 'Ignored',
        content: 'New content',
      })

      expect(updated.$id).toBe('note-1')
      expect(updated.$type).toBe('Note')
      expect(updated.content).toBe('New content')
    })
  })

  describe('delete(type, id)', () => {
    beforeEach(async () => {
      await memoryProvider.defineNoun({ name: 'Record' })
      await memoryProvider.create('Record', { value: 123 }, 'rec-1')
    })

    it('should delete an existing entity', async () => {
      const result = await adapter.delete('Record', 'rec-1')

      expect(result).toBe(true)
      expect(await adapter.get('Record', 'rec-1')).toBeNull()
    })

    it('should return false for non-existent entity', async () => {
      const result = await adapter.delete('Record', 'non-existent')
      expect(result).toBe(false)
    })

    it('should delete entity regardless of type parameter', async () => {
      // The adapter's delete doesn't check type, just passes id to provider
      const result = await adapter.delete('WrongType', 'rec-1')
      expect(result).toBe(true)
      expect(await memoryProvider.get('rec-1')).toBeNull()
    })
  })

  describe('related(type, id, relation)', () => {
    beforeEach(async () => {
      await memoryProvider.defineNoun({ name: 'Author' })
      await memoryProvider.defineNoun({ name: 'Book' })
      await memoryProvider.defineNoun({ name: 'Publisher' })
      await memoryProvider.defineVerb({ name: 'wrote' })
      await memoryProvider.defineVerb({ name: 'publishedBy' })

      await memoryProvider.create('Author', { name: 'Stephen King' }, 'author-1')
      await memoryProvider.create('Book', { title: 'The Shining' }, 'book-1')
      await memoryProvider.create('Book', { title: 'It' }, 'book-2')
      await memoryProvider.create('Publisher', { name: 'Scribner' }, 'pub-1')

      // Author wrote books
      await memoryProvider.perform('wrote', 'author-1', 'book-1')
      await memoryProvider.perform('wrote', 'author-1', 'book-2')
      // Book published by publisher
      await memoryProvider.perform('publishedBy', 'book-1', 'pub-1')
    })

    it('should get related entities of specified type via relation', async () => {
      const books = await adapter.related('Book', 'author-1', 'wrote')

      expect(books).toHaveLength(2)
      expect(books.every((b) => b.$type === 'Book')).toBe(true)
      expect(books.map((b) => b.title)).toContain('The Shining')
      expect(books.map((b) => b.title)).toContain('It')
    })

    it('should filter results by type', async () => {
      // Even if author has relations to books, asking for Publisher type should return empty
      const publishers = await adapter.related('Publisher', 'author-1', 'wrote')
      expect(publishers).toEqual([])
    })

    it('should handle inbound relations (both direction)', async () => {
      // Get authors related to book-1 via 'wrote'
      const authors = await adapter.related('Author', 'book-1', 'wrote')

      expect(authors).toHaveLength(1)
      expect(authors[0].name).toBe('Stephen King')
    })

    it('should return empty array for entity with no relations', async () => {
      await memoryProvider.create('Author', { name: 'New Author' }, 'author-2')

      const books = await adapter.related('Book', 'author-2', 'wrote')
      expect(books).toEqual([])
    })

    it('should return empty array for unknown relation', async () => {
      const items = await adapter.related('Book', 'author-1', 'unknownRelation')
      expect(items).toEqual([])
    })
  })

  describe('relate(fromType, fromId, relation, toType, toId)', () => {
    beforeEach(async () => {
      await memoryProvider.defineNoun({ name: 'Person' })
      await memoryProvider.defineNoun({ name: 'Project' })
      await memoryProvider.create('Person', { name: 'Alice' }, 'person-1')
      await memoryProvider.create('Project', { name: 'Secret Project' }, 'project-1')
    })

    it('should create a relation between entities', async () => {
      await adapter.relate('Person', 'person-1', 'worksOn', 'Project', 'project-1')

      // Verify via related
      const projects = await adapter.related('Project', 'person-1', 'worksOn')
      expect(projects).toHaveLength(1)
      expect(projects[0].$id).toBe('project-1')
    })

    it('should auto-define verb if not already defined', async () => {
      // Verb does not exist yet
      let verb = await memoryProvider.getVerb('manages')
      expect(verb).toBeNull()

      // Create relation
      await adapter.relate('Person', 'person-1', 'manages', 'Project', 'project-1')

      // Verb should now exist
      verb = await memoryProvider.getVerb('manages')
      expect(verb).not.toBeNull()
      expect(verb!.name).toBe('manages')
    })

    it('should not re-define verb if already exists', async () => {
      // Pre-define verb with inverse
      await memoryProvider.defineVerb({ name: 'owns', inverse: 'ownedBy' })

      // Create relation
      await adapter.relate('Person', 'person-1', 'owns', 'Project', 'project-1')

      // Original verb should still have inverse
      const verb = await memoryProvider.getVerb('owns')
      expect(verb!.inverse).toBe('ownedBy')
    })

    it('should pass metadata to perform', async () => {
      await memoryProvider.defineVerb({ name: 'likes' })

      await adapter.relate('Person', 'person-1', 'likes', 'Project', 'project-1', {
        matchMode: 'fuzzy',
        similarity: 0.85,
        matchedType: 'Project',
      })

      // Verify action was created with metadata
      const actions = await memoryProvider.listActions({ verb: 'likes' })
      expect(actions).toHaveLength(1)
      expect(actions[0].data).toEqual({
        matchMode: 'fuzzy',
        similarity: 0.85,
        matchedType: 'Project',
      })
    })

    it('should allow multiple relations between same entities', async () => {
      await adapter.relate('Person', 'person-1', 'owns', 'Project', 'project-1')
      await adapter.relate('Person', 'person-1', 'manages', 'Project', 'project-1')

      const ownedProjects = await adapter.related('Project', 'person-1', 'owns')
      const managedProjects = await adapter.related('Project', 'person-1', 'manages')

      expect(ownedProjects).toHaveLength(1)
      expect(managedProjects).toHaveLength(1)
    })
  })

  describe('unrelate()', () => {
    it('should delete the action representing the relation', async () => {
      await memoryProvider.defineNoun({ name: 'Person' })
      await memoryProvider.defineNoun({ name: 'Project' })
      await memoryProvider.defineVerb({ name: 'owns' })
      await memoryProvider.create('Person', { name: 'Test' }, 'person-1')
      await memoryProvider.create('Project', { name: 'Proj' }, 'project-1')

      // Create a relation
      await adapter.relate('Person', 'person-1', 'owns', 'Project', 'project-1')

      // Verify relation exists
      const actionsBefore = await memoryProvider.listActions({
        verb: 'owns',
        subject: 'person-1',
        object: 'project-1',
      })
      expect(actionsBefore).toHaveLength(1)

      // Unrelate
      await adapter.unrelate('Person', 'person-1', 'owns', 'Project', 'project-1')

      // Verify relation is deleted
      const actionsAfter = await memoryProvider.listActions({
        verb: 'owns',
        subject: 'person-1',
        object: 'project-1',
      })
      expect(actionsAfter).toHaveLength(0)
    })

    it('should not throw an error when no relation exists', async () => {
      await expect(adapter.unrelate('A', 'a1', 'rel', 'B', 'b1')).resolves.toBeUndefined()
    })

    it('should delete multiple matching actions (GDPR compliance)', async () => {
      await memoryProvider.defineNoun({ name: 'User' })
      await memoryProvider.defineNoun({ name: 'Document' })
      await memoryProvider.defineVerb({ name: 'viewed' })
      await memoryProvider.create('User', { name: 'Test' }, 'user-1')
      await memoryProvider.create('Document', { name: 'Doc' }, 'doc-1')

      // Create multiple view actions (e.g., user viewed same document multiple times)
      await adapter.relate('User', 'user-1', 'viewed', 'Document', 'doc-1')
      await adapter.relate('User', 'user-1', 'viewed', 'Document', 'doc-1')
      await adapter.relate('User', 'user-1', 'viewed', 'Document', 'doc-1')

      // Verify 3 relations exist
      const actionsBefore = await memoryProvider.listActions({
        verb: 'viewed',
        subject: 'user-1',
        object: 'doc-1',
      })
      expect(actionsBefore).toHaveLength(3)

      // Unrelate should delete all
      await adapter.unrelate('User', 'user-1', 'viewed', 'Document', 'doc-1')

      // Verify all relations are deleted
      const actionsAfter = await memoryProvider.listActions({
        verb: 'viewed',
        subject: 'user-1',
        object: 'doc-1',
      })
      expect(actionsAfter).toHaveLength(0)
    })
  })

  describe('Entity format conversion', () => {
    it('should convert Thing to entity format with $id and $type', async () => {
      await memoryProvider.defineNoun({ name: 'Entity' })
      await memoryProvider.create('Entity', { foo: 'bar', count: 42 }, 'e-1')

      const entity = await adapter.get('Entity', 'e-1')

      expect(entity).toEqual({
        $id: 'e-1',
        $type: 'Entity',
        foo: 'bar',
        count: 42,
      })
    })

    it('should preserve all data fields when converting', async () => {
      await memoryProvider.defineNoun({ name: 'Complex' })
      await memoryProvider.create(
        'Complex',
        {
          string: 'text',
          number: 123,
          boolean: true,
          array: [1, 2, 3],
          nested: { a: 1, b: 2 },
          null: null,
        },
        'c-1'
      )

      const entity = await adapter.get('Complex', 'c-1')

      expect(entity!.string).toBe('text')
      expect(entity!.number).toBe(123)
      expect(entity!.boolean).toBe(true)
      expect(entity!.array).toEqual([1, 2, 3])
      expect(entity!.nested).toEqual({ a: 1, b: 2 })
      expect(entity!.null).toBeNull()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle a complete CRUD workflow', async () => {
      // Create
      const created = await adapter.create('Todo', 'todo-1', {
        title: 'Write tests',
        completed: false,
      })
      expect(created.$id).toBe('todo-1')

      // Read
      const read = await adapter.get('Todo', 'todo-1')
      expect(read!.title).toBe('Write tests')

      // Update
      const updated = await adapter.update('Todo', 'todo-1', { completed: true })
      expect(updated.completed).toBe(true)

      // List
      const list = await adapter.list('Todo')
      expect(list).toHaveLength(1)

      // Delete
      const deleted = await adapter.delete('Todo', 'todo-1')
      expect(deleted).toBe(true)

      // Verify deletion
      const afterDelete = await adapter.get('Todo', 'todo-1')
      expect(afterDelete).toBeNull()
    })

    it('should handle a graph workflow with relations', async () => {
      // Create entities
      await adapter.create('Team', 'team-1', { name: 'Engineering' })
      await adapter.create('Member', 'member-1', { name: 'Alice' })
      await adapter.create('Member', 'member-2', { name: 'Bob' })

      // Create relations
      await adapter.relate('Member', 'member-1', 'belongsTo', 'Team', 'team-1')
      await adapter.relate('Member', 'member-2', 'belongsTo', 'Team', 'team-1')
      await adapter.relate('Member', 'member-1', 'manages', 'Member', 'member-2')

      // Query relations
      const teamMembers = await adapter.related('Member', 'team-1', 'belongsTo')
      expect(teamMembers).toHaveLength(2)

      const managed = await adapter.related('Member', 'member-1', 'manages')
      expect(managed).toHaveLength(1)
      expect(managed[0].name).toBe('Bob')
    })
  })
})
