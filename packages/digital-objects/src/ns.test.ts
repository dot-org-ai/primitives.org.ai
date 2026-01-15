/**
 * NS Durable Object Tests
 *
 * Since we can't easily test actual Durable Objects in vitest,
 * we mock the SqlStorage interface and test the NS class methods directly.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { NS, type Env } from './ns'

// Mock data storage for our fake SQLite
type Row = Record<string, unknown>

interface MockSqlStorage {
  exec: Mock<(...args: unknown[]) => { rowsWritten: number } & Iterable<Row>>
  _tables: Map<string, Row[]>
  _lastQuery: string
  _lastParams: unknown[]
}

// Create a mock SqlStorage that simulates SQLite behavior
const createMockSqlStorage = (): MockSqlStorage => {
  const tables = new Map<string, Row[]>()
  let lastQuery = ''
  let lastParams: unknown[] = []

  // Initialize tables
  tables.set('nouns', [])
  tables.set('verbs', [])
  tables.set('things', [])
  tables.set('actions', [])

  const exec = vi.fn((...args: unknown[]) => {
    const sql = args[0] as string
    const params = args.slice(1)
    lastQuery = sql
    lastParams = params

    // Handle CREATE TABLE / CREATE INDEX (schema initialization)
    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
      return { rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle INSERT OR REPLACE INTO nouns
    if (sql.includes('INSERT OR REPLACE INTO nouns')) {
      const row: Row = {
        name: params[0],
        singular: params[1],
        plural: params[2],
        slug: params[3],
        description: params[4],
        schema: params[5],
        created_at: params[6],
      }
      const nouns = tables.get('nouns')!
      const existingIndex = nouns.findIndex((n) => n.name === params[0])
      if (existingIndex >= 0) {
        nouns[existingIndex] = row
      } else {
        nouns.push(row)
      }
      return { rowsWritten: 1, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle INSERT OR REPLACE INTO verbs
    if (sql.includes('INSERT OR REPLACE INTO verbs')) {
      const row: Row = {
        name: params[0],
        action: params[1],
        act: params[2],
        activity: params[3],
        event: params[4],
        reverse_by: params[5],
        reverse_at: params[6],
        inverse: params[7],
        description: params[8],
        created_at: params[9],
      }
      const verbs = tables.get('verbs')!
      const existingIndex = verbs.findIndex((v) => v.name === params[0])
      if (existingIndex >= 0) {
        verbs[existingIndex] = row
      } else {
        verbs.push(row)
      }
      return { rowsWritten: 1, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle INSERT INTO things
    if (sql.includes('INSERT INTO things')) {
      const row: Row = {
        id: params[0],
        noun: params[1],
        data: params[2],
        created_at: params[3],
        updated_at: params[4],
      }
      tables.get('things')!.push(row)
      return { rowsWritten: 1, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle INSERT INTO actions
    if (sql.includes('INSERT INTO actions')) {
      const row: Row = {
        id: params[0],
        verb: params[1],
        subject: params[2],
        object: params[3],
        data: params[4],
        status: params[5],
        created_at: params[6],
        completed_at: params[7],
      }
      tables.get('actions')!.push(row)
      return { rowsWritten: 1, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle SELECT * FROM nouns WHERE name = ?
    if (sql.includes('SELECT * FROM nouns WHERE name = ?')) {
      const results = tables.get('nouns')!.filter((n) => n.name === params[0])
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM nouns (list all)
    if (sql === 'SELECT * FROM nouns') {
      const results = tables.get('nouns')!
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM verbs WHERE name = ?
    if (sql.includes('SELECT * FROM verbs WHERE name = ?')) {
      const results = tables.get('verbs')!.filter((v) => v.name === params[0])
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM verbs (list all)
    if (sql === 'SELECT * FROM verbs') {
      const results = tables.get('verbs')!
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM things WHERE id = ?
    if (sql.includes('SELECT * FROM things WHERE id = ?')) {
      const results = tables.get('things')!.filter((t) => t.id === params[0])
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM things WHERE id IN (?, ?, ...) - batch query for getMany()
    if (sql.includes('SELECT * FROM things WHERE id IN (')) {
      const ids = params as string[]
      const results = tables.get('things')!.filter((t) => ids.includes(t.id as string))
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM things WHERE noun = ? (with potential json_extract, ORDER BY, LIMIT, OFFSET)
    if (sql.includes('SELECT * FROM things WHERE noun = ?')) {
      let results = tables.get('things')!.filter((t) => t.noun === params[0])
      let paramIndex = 1

      // Handle json_extract WHERE clauses for filtering
      const jsonExtractMatches = sql.match(/json_extract\(data, '\$\.(\w+)'\) = \?/g)
      if (jsonExtractMatches) {
        for (const match of jsonExtractMatches) {
          const fieldMatch = match.match(/json_extract\(data, '\$\.(\w+)'\)/)
          if (fieldMatch) {
            const field = fieldMatch[1]
            const value = params[paramIndex++]
            results = results.filter((t) => {
              const data = typeof t.data === 'string' ? JSON.parse(t.data as string) : t.data
              return data[field] === value
            })
          }
        }
      }

      // Handle LIMIT
      const limitMatch = sql.match(/LIMIT \?/)
      if (limitMatch) {
        const limit = params[paramIndex++] as number
        results = results.slice(0, limit)
      }

      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle UPDATE things
    if (sql.includes('UPDATE things SET data = ?')) {
      const things = tables.get('things')!
      const idx = things.findIndex((t) => t.id === params[2])
      if (idx >= 0) {
        things[idx].data = params[0]
        things[idx].updated_at = params[1]
      }
      return { rowsWritten: idx >= 0 ? 1 : 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle DELETE FROM things
    if (sql.includes('DELETE FROM things WHERE id = ?')) {
      const things = tables.get('things')!
      const idx = things.findIndex((t) => t.id === params[0])
      if (idx >= 0) {
        things.splice(idx, 1)
        return { rowsWritten: 1, [Symbol.iterator]: () => [][Symbol.iterator]() }
      }
      return { rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    // Handle search query
    if (sql.includes('WHERE LOWER(data) LIKE ?')) {
      const query = (params[0] as string).replace(/%/g, '').toLowerCase()
      let results = tables.get('things')!.filter((t) => {
        const data = (t.data as string).toLowerCase()
        return data.includes(query)
      })

      // Handle LIMIT for search
      if (params.length > 1) {
        results = results.slice(0, params[1] as number)
      }

      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM actions WHERE id = ?
    if (sql.includes('SELECT * FROM actions WHERE id = ?')) {
      const results = tables.get('actions')!.filter((a) => a.id === params[0])
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM actions WHERE 1=1 (with filters)
    if (sql.includes('SELECT * FROM actions WHERE 1=1')) {
      let results = [...tables.get('actions')!]

      // Parse and apply filters
      let paramIndex = 0
      if (sql.includes('AND verb = ?')) {
        results = results.filter((a) => a.verb === params[paramIndex++])
      }
      if (sql.includes('AND subject = ?')) {
        results = results.filter((a) => a.subject === params[paramIndex++])
      }
      if (sql.includes('AND object = ?')) {
        results = results.filter((a) => a.object === params[paramIndex++])
      }
      if (sql.includes('AND status IN')) {
        const statusCount = (sql.match(/\?/g) || []).length - paramIndex
        const statuses = params.slice(paramIndex, paramIndex + statusCount)
        paramIndex += statusCount
        results = results.filter((a) => statuses.includes(a.status))
      }
      if (sql.includes('LIMIT ?')) {
        const limit = params[paramIndex] as number
        results = results.slice(0, limit)
      }

      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM actions WHERE subject = ? (edges out)
    if (sql.includes('SELECT * FROM actions WHERE subject = ?') && !sql.includes('OR object')) {
      let results = tables.get('actions')!.filter((a) => a.subject === params[0])
      if (sql.includes('AND verb = ?') && params.length > 1) {
        results = results.filter((a) => a.verb === params[1])
      }
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM actions WHERE object = ? (edges in)
    if (sql.includes('SELECT * FROM actions WHERE object = ?') && !sql.includes('OR')) {
      let results = tables.get('actions')!.filter((a) => a.object === params[0])
      if (sql.includes('AND verb = ?') && params.length > 1) {
        results = results.filter((a) => a.verb === params[1])
      }
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Handle SELECT * FROM actions WHERE subject = ? OR object = ? (edges both)
    if (sql.includes('SELECT * FROM actions WHERE subject = ? OR object = ?')) {
      let results = tables
        .get('actions')!
        .filter((a) => a.subject === params[0] || a.object === params[1])
      if (sql.includes('AND verb = ?') && params.length > 2) {
        results = results.filter((a) => a.verb === params[2])
      }
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    // Default: return empty
    return { rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
  })

  return {
    exec,
    _tables: tables,
    _lastQuery: lastQuery,
    _lastParams: lastParams,
  }
}

// Create mock DurableObjectState
const createMockState = (mockSql: MockSqlStorage) => ({
  storage: {
    sql: mockSql,
  },
})

// Create mock Env
const createMockEnv = (): Env => ({
  NS: {
    idFromName: vi.fn(),
    get: vi.fn(),
  } as unknown as DurableObjectNamespace,
})

describe('NS Durable Object', () => {
  let ns: NS
  let mockSql: MockSqlStorage
  let mockEnv: Env

  beforeEach(() => {
    mockSql = createMockSqlStorage()
    const mockState = createMockState(mockSql)
    mockEnv = createMockEnv()
    ns = new NS(mockState as unknown as DurableObjectState, mockEnv)
  })

  describe('Schema Initialization', () => {
    it('should create all required tables on first operation', async () => {
      // Trigger initialization by calling any method
      await ns.listNouns()

      // Check that CREATE TABLE statements were executed
      const calls = mockSql.exec.mock.calls
      const createTableCall = calls.find((call) => {
        const sql = call[0] as string
        return sql.includes('CREATE TABLE')
      })

      expect(createTableCall).toBeDefined()
      const sql = createTableCall![0] as string

      // Verify all tables are created
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS nouns')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS verbs')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS things')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS actions')
    })

    it('should create indexes on things and actions tables', async () => {
      await ns.listNouns()

      const calls = mockSql.exec.mock.calls
      const createTableCall = calls.find((call) => {
        const sql = call[0] as string
        return sql.includes('CREATE INDEX')
      })

      expect(createTableCall).toBeDefined()
      const sql = createTableCall![0] as string

      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_things_noun')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_actions_verb')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_actions_subject')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_actions_object')
    })

    it('should only initialize once (memoization)', async () => {
      await ns.listNouns()
      await ns.listNouns()
      await ns.listNouns()

      // Count CREATE TABLE calls
      const createCalls = mockSql.exec.mock.calls.filter((call) => {
        const sql = call[0] as string
        return sql.includes('CREATE TABLE IF NOT EXISTS nouns')
      })

      expect(createCalls.length).toBe(1)
    })
  })

  describe('Noun Operations', () => {
    it('should define a noun with auto-derived forms', async () => {
      const noun = await ns.defineNoun({ name: 'Post' })

      expect(noun.name).toBe('Post')
      expect(noun.singular).toBe('post')
      expect(noun.plural).toBe('posts')
      expect(noun.slug).toBe('post')
      expect(noun.createdAt).toBeInstanceOf(Date)
    })

    it('should define a noun with explicit forms', async () => {
      const noun = await ns.defineNoun({
        name: 'Person',
        singular: 'person',
        plural: 'people',
        description: 'A human being',
      })

      expect(noun.singular).toBe('person')
      expect(noun.plural).toBe('people')
      expect(noun.description).toBe('A human being')
    })

    it('should define a noun with schema', async () => {
      const schema = { title: 'string', body: 'markdown' as const }
      const noun = await ns.defineNoun({
        name: 'Article',
        schema,
      })

      expect(noun.schema).toEqual(schema)
    })

    it('should get a noun by name', async () => {
      await ns.defineNoun({ name: 'Author' })
      const noun = await ns.getNoun('Author')

      expect(noun).not.toBeNull()
      expect(noun!.name).toBe('Author')
      expect(noun!.singular).toBe('author')
    })

    it('should return null for unknown noun', async () => {
      const noun = await ns.getNoun('NonExistent')
      expect(noun).toBeNull()
    })

    it('should list all nouns', async () => {
      await ns.defineNoun({ name: 'Post' })
      await ns.defineNoun({ name: 'Author' })

      const nouns = await ns.listNouns()
      expect(nouns).toHaveLength(2)
      expect(nouns.map((n) => n.name)).toContain('Post')
      expect(nouns.map((n) => n.name)).toContain('Author')
    })

    it('should handle upsert (INSERT OR REPLACE)', async () => {
      await ns.defineNoun({ name: 'Post', description: 'Original' })
      await ns.defineNoun({ name: 'Post', description: 'Updated' })

      const noun = await ns.getNoun('Post')
      expect(noun!.description).toBe('Updated')

      const nouns = await ns.listNouns()
      expect(nouns).toHaveLength(1)
    })
  })

  describe('Verb Operations', () => {
    it('should define a verb with auto-derived conjugations', async () => {
      const verb = await ns.defineVerb({ name: 'create' })

      expect(verb.name).toBe('create')
      expect(verb.action).toBe('create')
      expect(verb.act).toBe('creates')
      expect(verb.activity).toBe('creating')
      expect(verb.event).toBe('created')
      expect(verb.reverseBy).toBe('createdBy')
      expect(verb.reverseAt).toBe('createdAt')
    })

    it('should define a verb with explicit conjugations', async () => {
      const verb = await ns.defineVerb({
        name: 'write',
        action: 'write',
        act: 'writes',
        activity: 'writing',
        event: 'written',
      })

      expect(verb.event).toBe('written')
    })

    it('should define a verb with inverse', async () => {
      const verb = await ns.defineVerb({
        name: 'publish',
        inverse: 'unpublish',
        description: 'Make content public',
      })

      expect(verb.inverse).toBe('unpublish')
      expect(verb.description).toBe('Make content public')
    })

    it('should get a verb by name', async () => {
      await ns.defineVerb({ name: 'like' })
      const verb = await ns.getVerb('like')

      expect(verb).not.toBeNull()
      expect(verb!.name).toBe('like')
      expect(verb!.activity).toBe('liking')
    })

    it('should return null for unknown verb', async () => {
      const verb = await ns.getVerb('nonexistent')
      expect(verb).toBeNull()
    })

    it('should list all verbs', async () => {
      await ns.defineVerb({ name: 'create' })
      await ns.defineVerb({ name: 'update' })
      await ns.defineVerb({ name: 'delete' })

      const verbs = await ns.listVerbs()
      expect(verbs).toHaveLength(3)
    })
  })

  describe('Thing Operations', () => {
    it('should create a thing with auto-generated ID', async () => {
      const thing = await ns.create('Post', { title: 'Hello World' })

      expect(thing.id).toBeDefined()
      expect(thing.id.length).toBeGreaterThan(0)
      expect(thing.noun).toBe('Post')
      expect(thing.data).toEqual({ title: 'Hello World' })
      expect(thing.createdAt).toBeInstanceOf(Date)
      expect(thing.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a thing with custom ID', async () => {
      const thing = await ns.create('Post', { title: 'Custom' }, 'my-custom-id')
      expect(thing.id).toBe('my-custom-id')
    })

    it('should get a thing by ID', async () => {
      const created = await ns.create('Post', { title: 'Test', body: 'Content' })
      const retrieved = await ns.get(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.data).toEqual({ title: 'Test', body: 'Content' })
    })

    it('should return null for unknown thing', async () => {
      const thing = await ns.get('nonexistent-id')
      expect(thing).toBeNull()
    })

    it('should list things by noun', async () => {
      await ns.create('Post', { title: 'First' })
      await ns.create('Post', { title: 'Second' })
      await ns.create('Author', { name: 'Alice' })

      const posts = await ns.list('Post')
      expect(posts).toHaveLength(2)
      expect(posts.every((p) => p.noun === 'Post')).toBe(true)
    })

    it('should list things with limit option', async () => {
      await ns.create('Post', { title: 'First' })
      await ns.create('Post', { title: 'Second' })
      await ns.create('Post', { title: 'Third' })

      const posts = await ns.list('Post', { limit: 2 })
      expect(posts).toHaveLength(2)
    })

    it('should update a thing', async () => {
      const created = await ns.create('Post', { title: 'Original', status: 'draft' })
      const updated = await ns.update(created.id, { title: 'Updated' })

      expect(updated.data).toEqual({ title: 'Updated', status: 'draft' })
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime())
    })

    it('should throw error when updating non-existent thing', async () => {
      await expect(ns.update('nonexistent', { title: 'Test' })).rejects.toThrow(
        'Thing not found: nonexistent'
      )
    })

    it('should delete a thing', async () => {
      const created = await ns.create('Post', { title: 'ToDelete' })
      const deleted = await ns.delete(created.id)

      expect(deleted).toBe(true)
    })

    it('should return false when deleting non-existent thing', async () => {
      const deleted = await ns.delete('nonexistent-id')
      expect(deleted).toBe(false)
    })

    it('should find things by criteria', async () => {
      await ns.create('Post', { title: 'Draft 1', status: 'draft' })
      await ns.create('Post', { title: 'Published', status: 'published' })
      await ns.create('Post', { title: 'Draft 2', status: 'draft' })

      const drafts = await ns.find<{ title: string; status: string }>('Post', { status: 'draft' })
      expect(drafts).toHaveLength(2)
      expect(drafts.every((p) => p.data.status === 'draft')).toBe(true)
    })

    it('should search things by query', async () => {
      await ns.create('Post', { title: 'Hello World', body: 'This is a test' })
      await ns.create('Post', { title: 'Goodbye World', body: 'Another post' })

      const results = await ns.search('hello')
      expect(results).toHaveLength(1)
      expect(results[0].data.title).toBe('Hello World')
    })

    it('should search with limit', async () => {
      await ns.create('Post', { title: 'Test 1', body: 'testing' })
      await ns.create('Post', { title: 'Test 2', body: 'testing again' })
      await ns.create('Post', { title: 'Test 3', body: 'testing more' })

      const results = await ns.search('test', { limit: 2 })
      expect(results).toHaveLength(2)
    })
  })

  describe('Action Operations', () => {
    it('should perform an action with subject and object', async () => {
      const author = await ns.create('Author', { name: 'Alice' })
      const post = await ns.create('Post', { title: 'My Post' })

      const action = await ns.perform('write', author.id, post.id)

      expect(action.id).toBeDefined()
      expect(action.verb).toBe('write')
      expect(action.subject).toBe(author.id)
      expect(action.object).toBe(post.id)
      expect(action.status).toBe('completed')
      expect(action.createdAt).toBeInstanceOf(Date)
      expect(action.completedAt).toBeInstanceOf(Date)
    })

    it('should perform an action with data payload', async () => {
      const post = await ns.create('Post', { title: 'Draft' })

      const action = await ns.perform('publish', undefined, post.id, {
        publishedBy: 'admin',
        publishedAt: '2024-01-15',
      })

      expect(action.data).toEqual({
        publishedBy: 'admin',
        publishedAt: '2024-01-15',
      })
    })

    it('should perform an action with only subject', async () => {
      const user = await ns.create('User', { name: 'Bob' })

      const action = await ns.perform('login', user.id)

      expect(action.subject).toBe(user.id)
      expect(action.object).toBeUndefined()
    })

    it('should perform an action with only object', async () => {
      const resource = await ns.create('Resource', { name: 'Document' })

      const action = await ns.perform('view', undefined, resource.id)

      expect(action.subject).toBeUndefined()
      expect(action.object).toBe(resource.id)
    })

    it('should get an action by ID', async () => {
      const created = await ns.perform('test', 'subject-1', 'object-1', { key: 'value' })
      const retrieved = await ns.getAction(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.verb).toBe('test')
      expect(retrieved!.data).toEqual({ key: 'value' })
    })

    it('should return null for unknown action', async () => {
      const action = await ns.getAction('nonexistent')
      expect(action).toBeNull()
    })

    it('should list actions with verb filter', async () => {
      await ns.perform('write', 'a1', 'p1')
      await ns.perform('write', 'a2', 'p2')
      await ns.perform('publish', undefined, 'p1')

      const writeActions = await ns.listActions({ verb: 'write' })
      expect(writeActions.length).toBeGreaterThanOrEqual(1)
      expect(writeActions.every((a) => a.verb === 'write')).toBe(true)
    })

    it('should list actions with subject filter', async () => {
      await ns.perform('write', 'author-1', 'post-1')
      await ns.perform('write', 'author-1', 'post-2')
      await ns.perform('write', 'author-2', 'post-3')

      const authorActions = await ns.listActions({ subject: 'author-1' })
      expect(authorActions.length).toBeGreaterThanOrEqual(1)
      expect(authorActions.every((a) => a.subject === 'author-1')).toBe(true)
    })

    it('should list actions with object filter', async () => {
      await ns.perform('like', 'user-1', 'post-1')
      await ns.perform('like', 'user-2', 'post-1')
      await ns.perform('like', 'user-3', 'post-2')

      const postActions = await ns.listActions({ object: 'post-1' })
      expect(postActions.length).toBeGreaterThanOrEqual(1)
      expect(postActions.every((a) => a.object === 'post-1')).toBe(true)
    })

    it('should list actions with limit', async () => {
      await ns.perform('action', 's1', 'o1')
      await ns.perform('action', 's2', 'o2')
      await ns.perform('action', 's3', 'o3')

      const actions = await ns.listActions({ limit: 2 })
      expect(actions).toHaveLength(2)
    })
  })

  describe('Graph Traversal', () => {
    beforeEach(async () => {
      // Set up a small graph
      await ns.create('Author', { name: 'Alice' }, 'alice')
      await ns.create('Author', { name: 'Bob' }, 'bob')
      await ns.create('Post', { title: 'Post 1' }, 'post-1')
      await ns.create('Post', { title: 'Post 2' }, 'post-2')
      await ns.create('Post', { title: 'Post 3' }, 'post-3')

      // Alice writes post-1 and post-2
      await ns.perform('write', 'alice', 'post-1')
      await ns.perform('write', 'alice', 'post-2')

      // Bob writes post-3
      await ns.perform('write', 'bob', 'post-3')

      // Bob likes post-1
      await ns.perform('like', 'bob', 'post-1')
    })

    describe('edges()', () => {
      it('should get outbound edges for a thing', async () => {
        const edges = await ns.edges('alice', undefined, 'out')

        expect(edges).toHaveLength(2)
        expect(edges.every((e) => e.subject === 'alice')).toBe(true)
      })

      it('should get inbound edges for a thing', async () => {
        const edges = await ns.edges('post-1', undefined, 'in')

        expect(edges).toHaveLength(2) // written by alice, liked by bob
        expect(edges.every((e) => e.object === 'post-1')).toBe(true)
      })

      it('should get both directions edges', async () => {
        const edges = await ns.edges('bob', undefined, 'both')

        // Bob has: write (out), like (out)
        expect(edges.length).toBeGreaterThanOrEqual(2)
      })

      it('should filter edges by verb', async () => {
        const edges = await ns.edges('bob', 'like', 'out')

        expect(edges).toHaveLength(1)
        expect(edges[0].verb).toBe('like')
        expect(edges[0].object).toBe('post-1')
      })
    })

    describe('related()', () => {
      it('should get related things via outbound edges', async () => {
        const posts = await ns.related('alice', 'write', 'out')

        expect(posts).toHaveLength(2)
        expect(posts.map((p) => p.id)).toContain('post-1')
        expect(posts.map((p) => p.id)).toContain('post-2')
      })

      it('should get related things via inbound edges', async () => {
        const authors = await ns.related('post-1', 'write', 'in')

        expect(authors).toHaveLength(1)
        expect(authors[0].id).toBe('alice')
      })

      it('should get related things in both directions', async () => {
        const related = await ns.related('bob', undefined, 'both')

        // Bob -> post-3 (write), Bob -> post-1 (like)
        expect(related.length).toBeGreaterThanOrEqual(2)
      })

      it('should return empty array when no relations', async () => {
        const related = await ns.related('post-3', 'like', 'in')
        expect(related).toHaveLength(0)
      })
    })
  })

  describe('HTTP Request Handling', () => {
    // Helper to create mock requests
    const createRequest = (
      method: string,
      path: string,
      body?: unknown,
      searchParams?: Record<string, string>
    ) => {
      let url = `https://example.com${path}`
      if (searchParams) {
        const params = new URLSearchParams(searchParams)
        url += `?${params.toString()}`
      }
      return new Request(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    describe('Noun Routes', () => {
      it('POST /nouns should define a noun', async () => {
        const request = createRequest('POST', '/nouns', { name: 'Post' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const noun = await response.json()
        expect(noun.name).toBe('Post')
      })

      it('GET /nouns should list all nouns', async () => {
        await ns.defineNoun({ name: 'Post' })
        await ns.defineNoun({ name: 'Author' })

        const request = createRequest('GET', '/nouns')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const nouns = await response.json()
        expect(nouns).toHaveLength(2)
      })

      it('GET /nouns/:name should get a specific noun', async () => {
        await ns.defineNoun({ name: 'Post' })

        const request = createRequest('GET', '/nouns/Post')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const noun = await response.json()
        expect(noun.name).toBe('Post')
      })

      it('GET /nouns/:name should return 404 for unknown noun', async () => {
        const request = createRequest('GET', '/nouns/Unknown')
        const response = await ns.fetch(request)

        expect(response.status).toBe(404)
      })

      it('GET /nouns/:name should handle URL-encoded names', async () => {
        await ns.defineNoun({ name: 'Blog Post' })

        const request = createRequest('GET', '/nouns/Blog%20Post')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const noun = await response.json()
        expect(noun.name).toBe('Blog Post')
      })
    })

    describe('Verb Routes', () => {
      it('POST /verbs should define a verb', async () => {
        const request = createRequest('POST', '/verbs', { name: 'create' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const verb = await response.json()
        expect(verb.name).toBe('create')
        expect(verb.event).toBe('created')
      })

      it('GET /verbs should list all verbs', async () => {
        await ns.defineVerb({ name: 'create' })
        await ns.defineVerb({ name: 'update' })

        const request = createRequest('GET', '/verbs')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const verbs = await response.json()
        expect(verbs).toHaveLength(2)
      })

      it('GET /verbs/:name should get a specific verb', async () => {
        await ns.defineVerb({ name: 'publish' })

        const request = createRequest('GET', '/verbs/publish')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const verb = await response.json()
        expect(verb.name).toBe('publish')
      })

      it('GET /verbs/:name should return 404 for unknown verb', async () => {
        const request = createRequest('GET', '/verbs/unknown')
        const response = await ns.fetch(request)

        expect(response.status).toBe(404)
      })
    })

    describe('Thing Routes', () => {
      it('POST /things should create a thing', async () => {
        const request = createRequest('POST', '/things', {
          noun: 'Post',
          data: { title: 'Hello' },
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const thing = await response.json()
        expect(thing.noun).toBe('Post')
        expect(thing.data.title).toBe('Hello')
      })

      it('POST /things should support custom ID', async () => {
        const request = createRequest('POST', '/things', {
          noun: 'Post',
          data: { title: 'Custom' },
          id: 'my-id',
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const thing = await response.json()
        expect(thing.id).toBe('my-id')
      })

      it('GET /things/:id should get a thing', async () => {
        const created = await ns.create('Post', { title: 'Test' })

        const request = createRequest('GET', `/things/${created.id}`)
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const thing = await response.json()
        expect(thing.id).toBe(created.id)
      })

      it('GET /things/:id should return 404 for unknown thing', async () => {
        const request = createRequest('GET', '/things/nonexistent')
        const response = await ns.fetch(request)

        expect(response.status).toBe(404)
      })

      it('GET /things should list things by noun', async () => {
        await ns.create('Post', { title: 'First' })
        await ns.create('Post', { title: 'Second' })

        const request = createRequest('GET', '/things', undefined, { noun: 'Post' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const things = await response.json()
        expect(things).toHaveLength(2)
      })

      it('GET /things without noun should return 400', async () => {
        const request = createRequest('GET', '/things')
        const response = await ns.fetch(request)

        expect(response.status).toBe(400)
        expect(await response.text()).toBe('noun parameter required')
      })

      it('GET /things should support pagination params', async () => {
        await ns.create('Post', { title: '1' })
        await ns.create('Post', { title: '2' })
        await ns.create('Post', { title: '3' })

        const request = createRequest('GET', '/things', undefined, {
          noun: 'Post',
          limit: '2',
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const things = await response.json()
        expect(things).toHaveLength(2)
      })

      it('PATCH /things/:id should update a thing', async () => {
        const created = await ns.create('Post', { title: 'Original' })

        const request = createRequest('PATCH', `/things/${created.id}`, {
          data: { title: 'Updated' },
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const thing = await response.json()
        expect(thing.data.title).toBe('Updated')
      })

      it('DELETE /things/:id should delete a thing', async () => {
        const created = await ns.create('Post', { title: 'ToDelete' })

        const request = createRequest('DELETE', `/things/${created.id}`)
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const result = await response.json()
        expect(result.deleted).toBe(true)
      })
    })

    describe('Search Route', () => {
      it('GET /search should search things', async () => {
        await ns.create('Post', { title: 'Hello World' })
        await ns.create('Post', { title: 'Goodbye' })

        const request = createRequest('GET', '/search', undefined, { q: 'hello' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const results = await response.json()
        expect(results).toHaveLength(1)
      })

      it('GET /search should support limit', async () => {
        await ns.create('Post', { title: 'Test 1' })
        await ns.create('Post', { title: 'Test 2' })
        await ns.create('Post', { title: 'Test 3' })

        const request = createRequest('GET', '/search', undefined, { q: 'test', limit: '2' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const results = await response.json()
        expect(results).toHaveLength(2)
      })
    })

    describe('Action Routes', () => {
      it('POST /actions should perform an action', async () => {
        const request = createRequest('POST', '/actions', {
          verb: 'like',
          subject: 'user-1',
          object: 'post-1',
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const action = await response.json()
        expect(action.verb).toBe('like')
        expect(action.status).toBe('completed')
      })

      it('POST /actions should support data payload', async () => {
        const request = createRequest('POST', '/actions', {
          verb: 'rate',
          subject: 'user-1',
          object: 'product-1',
          data: { stars: 5, comment: 'Great!' },
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const action = await response.json()
        expect(action.data.stars).toBe(5)
      })

      it('GET /actions/:id should get an action', async () => {
        const created = await ns.perform('test', 'a', 'b')

        const request = createRequest('GET', `/actions/${created.id}`)
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const action = await response.json()
        expect(action.id).toBe(created.id)
      })

      it('GET /actions/:id should return 404 for unknown action', async () => {
        const request = createRequest('GET', '/actions/nonexistent')
        const response = await ns.fetch(request)

        expect(response.status).toBe(404)
      })

      it('GET /actions should list actions with filters', async () => {
        await ns.perform('write', 'a1', 'p1')
        await ns.perform('like', 'u1', 'p1')

        const request = createRequest('GET', '/actions', undefined, { verb: 'write' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const actions = await response.json()
        expect(actions).toHaveLength(1)
        expect(actions[0].verb).toBe('write')
      })
    })

    describe('Graph Routes', () => {
      beforeEach(async () => {
        await ns.create('Author', { name: 'Alice' }, 'alice')
        await ns.create('Post', { title: 'Post 1' }, 'post-1')
        await ns.perform('write', 'alice', 'post-1')
      })

      it('GET /edges/:id should get edges', async () => {
        const request = createRequest('GET', '/edges/alice')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const edges = await response.json()
        expect(edges).toHaveLength(1)
      })

      it('GET /edges/:id should support verb filter', async () => {
        await ns.perform('like', 'alice', 'post-1')

        const request = createRequest('GET', '/edges/alice', undefined, { verb: 'write' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const edges = await response.json()
        expect(edges).toHaveLength(1)
        expect(edges[0].verb).toBe('write')
      })

      it('GET /edges/:id should support direction param', async () => {
        const request = createRequest('GET', '/edges/post-1', undefined, { direction: 'in' })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const edges = await response.json()
        expect(edges).toHaveLength(1)
        expect(edges[0].object).toBe('post-1')
      })

      it('GET /related/:id should get related things', async () => {
        const request = createRequest('GET', '/related/alice')
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const related = await response.json()
        expect(related).toHaveLength(1)
        expect(related[0].id).toBe('post-1')
      })

      it('GET /related/:id should support verb and direction params', async () => {
        const request = createRequest('GET', '/related/post-1', undefined, {
          verb: 'write',
          direction: 'in',
        })
        const response = await ns.fetch(request)

        expect(response.status).toBe(200)
        const related = await response.json()
        expect(related).toHaveLength(1)
        expect(related[0].id).toBe('alice')
      })
    })

    describe('Error Handling', () => {
      it('should return 404 for unknown routes', async () => {
        const request = createRequest('GET', '/unknown/route')
        const response = await ns.fetch(request)

        expect(response.status).toBe(404)
      })

      it('should return 404 for not found errors with proper error response', async () => {
        // Create a request that will cause a NotFoundError (update non-existent thing)
        const request = createRequest('PATCH', '/things/nonexistent', { data: { title: 'Test' } })
        const response = await ns.fetch(request)

        expect(response.status).toBe(404)
        const body = await response.json()
        expect(body.error).toBe('NOT_FOUND')
        expect(body.message).toContain('Thing not found')
      })

      it('should handle malformed JSON gracefully', async () => {
        const request = new Request('https://example.com/things', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not valid json',
        })

        const response = await ns.fetch(request)
        expect(response.status).toBe(500)
      })
    })
  })

  describe('SQL Query Generation', () => {
    it('should use parameterized queries for nouns', async () => {
      await ns.defineNoun({ name: "Test'; DROP TABLE nouns;--" })

      // The SQL should use parameterized queries, not string interpolation
      const insertCall = mockSql.exec.mock.calls.find((call) => {
        const sql = call[0] as string
        return sql.includes('INSERT OR REPLACE INTO nouns')
      })

      expect(insertCall).toBeDefined()
      // Parameters should be passed separately, not interpolated into the SQL
      expect(insertCall![1]).toBe("Test'; DROP TABLE nouns;--")
    })

    it('should use parameterized queries for things', async () => {
      await ns.create('Post', { title: "Test'; DROP TABLE things;--" })

      const insertCall = mockSql.exec.mock.calls.find((call) => {
        const sql = call[0] as string
        return sql.includes('INSERT INTO things')
      })

      expect(insertCall).toBeDefined()
      // Data is JSON stringified and passed as parameter at index 3 (id, noun, data, ...)
      const dataParam = insertCall![3] as string
      expect(dataParam).toContain("Test'; DROP TABLE things;--")
    })

    it('should use parameterized queries for actions', async () => {
      await ns.perform('test', "subject'; DROP TABLE actions;--", 'object')

      const insertCall = mockSql.exec.mock.calls.find((call) => {
        const sql = call[0] as string
        return sql.includes('INSERT INTO actions')
      })

      expect(insertCall).toBeDefined()
      // Subject is at index 3 (id, verb, subject, object, ...)
      expect(insertCall![3]).toBe("subject'; DROP TABLE actions;--")
    })

    it('should use parameterized queries for search', async () => {
      await ns.search("'; DROP TABLE things;--")

      const searchCall = mockSql.exec.mock.calls.find((call) => {
        const sql = call[0] as string
        return sql.includes('LIKE ?')
      })

      expect(searchCall).toBeDefined()
      // The query should be passed as a parameter (wrapped with % for LIKE)
      const queryParam = searchCall![1] as string
      expect(queryParam.toLowerCase()).toContain("'; drop table things;--")
    })
  })

  describe('Data Serialization', () => {
    it('should properly serialize and deserialize JSON data in things', async () => {
      const complexData = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        boolean: true,
        nullValue: null,
      }

      const created = await ns.create('Test', complexData)
      const retrieved = await ns.get(created.id)

      expect(retrieved!.data).toEqual(complexData)
    })

    it('should properly serialize and deserialize schema in nouns', async () => {
      const schema = {
        title: 'string' as const,
        body: 'markdown' as const,
        published: 'boolean' as const,
      }

      await ns.defineNoun({ name: 'Article', schema })
      const noun = await ns.getNoun('Article')

      expect(noun!.schema).toEqual(schema)
    })

    it('should properly serialize and deserialize action data', async () => {
      const actionData = {
        metadata: { source: 'api', version: '1.0' },
        timestamp: 1234567890,
      }

      const action = await ns.perform('test', 'subject', 'object', actionData)
      const retrieved = await ns.getAction(action.id)

      expect(retrieved!.data).toEqual(actionData)
    })

    it('should handle undefined schema gracefully', async () => {
      await ns.defineNoun({ name: 'Simple' })
      const noun = await ns.getNoun('Simple')

      expect(noun!.schema).toBeUndefined()
    })

    it('should handle undefined action data gracefully', async () => {
      const action = await ns.perform('test', 'subject', 'object')
      const retrieved = await ns.getAction(action.id)

      expect(retrieved!.data).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string IDs', async () => {
      const thing = await ns.create('Post', { title: 'Test' }, '')
      expect(thing.id).toBe('')

      const retrieved = await ns.get('')
      expect(retrieved!.data.title).toBe('Test')
    })

    it('should handle special characters in noun names', async () => {
      const noun = await ns.defineNoun({ name: 'Blog Post Category' })
      expect(noun.slug).toBe('blog-post-category')

      const retrieved = await ns.getNoun('Blog Post Category')
      expect(retrieved!.name).toBe('Blog Post Category')
    })

    it('should handle empty data objects', async () => {
      const thing = await ns.create('Empty', {})
      expect(thing.data).toEqual({})

      const retrieved = await ns.get(thing.id)
      expect(retrieved!.data).toEqual({})
    })

    it('should handle very long strings in data', async () => {
      const longString = 'a'.repeat(10000)
      const thing = await ns.create('Post', { content: longString })

      const retrieved = await ns.get(thing.id)
      expect(retrieved!.data.content).toBe(longString)
    })

    it('should handle unicode characters', async () => {
      const unicodeData = {
        emoji: '\u{1F600}\u{1F389}',
        japanese: '\u3053\u3093\u306B\u3061\u306F',
        arabic: '\u0645\u0631\u062D\u0628\u0627',
      }

      const thing = await ns.create('Unicode', unicodeData)
      const retrieved = await ns.get(thing.id)

      expect(retrieved!.data).toEqual(unicodeData)
    })

    it('should handle concurrent operations', async () => {
      // Create multiple things concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        ns.create('Post', { title: `Post ${i}` })
      )

      const results = await Promise.all(promises)
      expect(results).toHaveLength(10)

      // All should have unique IDs
      const ids = new Set(results.map((r) => r.id))
      expect(ids.size).toBe(10)
    })
  })

  describe('close() method', () => {
    it('should be a no-op and resolve successfully', async () => {
      await expect(ns.close()).resolves.toBeUndefined()
    })
  })
})
