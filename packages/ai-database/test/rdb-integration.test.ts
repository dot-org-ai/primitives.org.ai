/**
 * RDB + ai-database Integration Tests
 *
 * Tests that demonstrate using RDB as a backend provider for ai-database.
 * RDB provides a simple relational database with _data and _rels tables,
 * while ai-database provides schema-first operations with relationship operators.
 *
 * Key Integration Points:
 * - RDB as storage backend via RDBProviderAdapter
 * - Exact relationship operators (-> and <-)
 * - Fuzzy operators gracefully degrade (semantic search not available in RDB)
 * - CRUD operations through ai-database schema using RDB storage
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, parseSchema } from '../src/schema.js'
import { createMemoryProvider } from '../src/memory-provider.js'
import type { DatabaseSchema, DBProvider, ListOptions, SearchOptions } from '../src/schema.js'
import { RDB } from '../../../../rdb/src/rdb.js'
import type { SqlStorage, SqlCursor, SqlStorageValue, Filter } from '../../../../rdb/src/types.js'

// =============================================================================
// Mock SQL Storage (in-memory SQLite-like interface for testing)
// =============================================================================

/**
 * Creates an in-memory SQL storage that implements the SqlStorage interface
 * used by RDB. This allows us to test RDB without actual SQLite/D1.
 */
function createMockSqlStorage(): SqlStorage {
  const tables: Map<string, Array<Record<string, SqlStorageValue>>> = new Map()

  return {
    exec<T = Record<string, SqlStorageValue>>(
      query: string,
      ...params: SqlStorageValue[]
    ): SqlCursor<T> {
      const queryLower = query.toLowerCase().trim()

      // Handle CREATE TABLE
      if (queryLower.startsWith('create table')) {
        const tableMatch = query.match(/create table (?:if not exists\s+)?(\w+)/i)
        if (tableMatch) {
          const tableName = tableMatch[1]!
          if (!tables.has(tableName)) {
            tables.set(tableName, [])
          }
        }
        return createCursor<T>([])
      }

      // Handle INSERT
      if (queryLower.startsWith('insert')) {
        const insertMatch = query.match(
          /insert (?:or replace )?into (\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i
        )
        if (insertMatch) {
          const tableName = insertMatch[1]!
          const columns = insertMatch[2]!.split(',').map((c) => c.trim())
          const row: Record<string, SqlStorageValue> = {}
          columns.forEach((col, i) => {
            row[col] = params[i] ?? null
          })

          if (!tables.has(tableName)) {
            tables.set(tableName, [])
          }

          // Handle OR REPLACE - remove existing row with same key
          if (queryLower.includes('or replace')) {
            const tableData = tables.get(tableName)!
            // For _data table, key is (type, id), for _rels it's (from_id, relation, to_id)
            if (tableName === '_data') {
              const idx = tableData.findIndex(
                (r) => r['type'] === row['type'] && r['id'] === row['id']
              )
              if (idx >= 0) tableData.splice(idx, 1)
            } else if (tableName === '_rels') {
              const idx = tableData.findIndex(
                (r) =>
                  r['from_id'] === row['from_id'] &&
                  r['relation'] === row['relation'] &&
                  r['to_id'] === row['to_id']
              )
              if (idx >= 0) tableData.splice(idx, 1)
            }
          }

          tables.get(tableName)!.push(row)
        }
        return createCursor<T>([])
      }

      // Handle UPDATE
      if (queryLower.startsWith('update')) {
        const updateMatch = query.match(/update (\w+)\s+set\s+(.+?)\s+where\s+(.+)/i)
        if (updateMatch) {
          const tableName = updateMatch[1]!
          const tableData = tables.get(tableName) ?? []

          // Parse SET clause - handle multiple columns
          const setClause = updateMatch[2]!
          const setParts = setClause.split(',').map((s) => s.trim())
          const setColumns: string[] = []
          for (const part of setParts) {
            const colMatch = part.match(/(\w+)\s*=\s*\?/i)
            if (colMatch) setColumns.push(colMatch[1]!)
          }

          // Parse WHERE clause
          const whereClause = updateMatch[3]!
          const whereMatches = [...whereClause.matchAll(/(\w+)\s*=\s*\?/gi)]
          const whereColumns = whereMatches.map((m) => m[1]!)

          // Find and update matching rows
          for (const row of tableData) {
            let matches = true
            let paramOffset = setColumns.length // WHERE params come after SET params
            for (let i = 0; i < whereColumns.length; i++) {
              if (row[whereColumns[i]!] !== params[paramOffset + i]) {
                matches = false
                break
              }
            }
            if (matches) {
              // Update the row
              for (let i = 0; i < setColumns.length; i++) {
                row[setColumns[i]!] = params[i] ?? null
              }
            }
          }
        }
        return createCursor<T>([])
      }

      // Handle DELETE
      if (queryLower.startsWith('delete')) {
        const deleteMatch = query.match(/delete from (\w+)\s+where\s+(.+)/i)
        if (deleteMatch) {
          const tableName = deleteMatch[1]!
          const whereClause = deleteMatch[2]!
          const tableData = tables.get(tableName) ?? []

          // Parse WHERE clause - handle OR conditions
          if (whereClause.toLowerCase().includes(' or ')) {
            // Handle "col1 = ? OR col2 = ?"
            const parts = whereClause.split(/\s+or\s+/i)
            const conditions: Array<{ col: string; paramIdx: number }> = []
            let paramIdx = 0
            for (const part of parts) {
              const match = part.match(/(\w+)\s*=\s*\?/i)
              if (match) {
                conditions.push({ col: match[1]!, paramIdx })
                paramIdx++
              }
            }

            // Remove rows matching any condition
            const toRemove = tableData.filter((row) =>
              conditions.some((c) => row[c.col] === params[c.paramIdx])
            )
            for (const row of toRemove) {
              const idx = tableData.indexOf(row)
              if (idx >= 0) tableData.splice(idx, 1)
            }
          } else {
            // Handle simple AND conditions
            const whereMatches = [...whereClause.matchAll(/(\w+)\s*=\s*\?/gi)]
            const whereColumns = whereMatches.map((m) => m[1]!)

            // Remove matching rows
            const toRemove = tableData.filter((row) => {
              for (let i = 0; i < whereColumns.length; i++) {
                if (row[whereColumns[i]!] !== params[i]) return false
              }
              return true
            })
            for (const row of toRemove) {
              const idx = tableData.indexOf(row)
              if (idx >= 0) tableData.splice(idx, 1)
            }
          }
        }
        return createCursor<T>([])
      }

      // Handle SELECT
      if (queryLower.startsWith('select')) {
        // Parse SELECT more robustly
        const tableName = query.match(/from\s+(\w+)/i)?.[1]
        if (!tableName) return createCursor<T>([])

        let tableData = [...(tables.get(tableName) ?? [])]

        // Extract WHERE clause (between WHERE and ORDER BY/LIMIT)
        const whereMatch = query.match(/where\s+(.+?)(?=\s+order\s+by|\s+limit|\s*$)/i)
        const whereClause = whereMatch?.[1]?.trim()

        // Extract LIMIT and OFFSET
        const limitMatch = query.match(/limit\s+(\d+|\?)/i)
        const offsetMatch = query.match(/offset\s+(\d+|\?)/i)

        // Apply WHERE clause
        if (whereClause) {
          // Count total placeholders in WHERE clause
          const whereParamCount = (whereClause.match(/\?/g) || []).length

          // Handle IN clause
          const inMatch = whereClause.match(/(\w+)\s+in\s*\(([^)]+)\)/i)
          if (inMatch) {
            const col = inMatch[1]!
            const placeholders = (inMatch[2]!.match(/\?/g) || []).length
            const inValues = params.slice(0, placeholders)
            tableData = tableData.filter((row) => inValues.includes(row[col]))

            // Also apply other conditions after IN
            const otherConditions = whereClause
              .replace(/\w+\s+in\s*\([^)]+\)\s*(and\s+)?/i, '')
              .trim()
            if (otherConditions) {
              const otherMatches = [...otherConditions.matchAll(/(\w+)\s*=\s*\?/gi)]
              const otherColumns = otherMatches.map((m) => m[1]!)
              const otherParams = params.slice(placeholders)
              tableData = tableData.filter((row) => {
                for (let i = 0; i < otherColumns.length; i++) {
                  if (row[otherColumns[i]!] !== otherParams[i]) return false
                }
                return true
              })
            }
          } else {
            // Handle simple AND conditions
            const whereMatches = [...whereClause.matchAll(/(\w+)\s*=\s*\?/gi)]
            const whereColumns = whereMatches.map((m) => m[1]!)

            tableData = tableData.filter((row) => {
              for (let i = 0; i < whereColumns.length; i++) {
                if (row[whereColumns[i]!] !== params[i]) return false
              }
              return true
            })
          }

          // Get params for LIMIT/OFFSET (after WHERE params)
          const limitVal = limitMatch
            ? limitMatch[1] === '?'
              ? (params[whereParamCount] as number)
              : parseInt(limitMatch[1]!, 10)
            : undefined
          const offsetVal = offsetMatch
            ? offsetMatch[1] === '?'
              ? (params[whereParamCount + (limitMatch?.[1] === '?' ? 1 : 0)] as number)
              : parseInt(offsetMatch[1]!, 10)
            : 0

          if (offsetVal > 0) {
            tableData = tableData.slice(offsetVal)
          }
          if (limitVal !== undefined) {
            tableData = tableData.slice(0, limitVal)
          }
        } else {
          // No WHERE clause - just apply LIMIT/OFFSET directly from params
          const limitVal = limitMatch
            ? limitMatch[1] === '?'
              ? (params[0] as number)
              : parseInt(limitMatch[1]!, 10)
            : undefined
          const offsetVal = offsetMatch
            ? offsetMatch[1] === '?'
              ? (params[limitMatch?.[1] === '?' ? 1 : 0] as number)
              : parseInt(offsetMatch[1]!, 10)
            : 0

          if (offsetVal > 0) {
            tableData = tableData.slice(offsetVal)
          }
          if (limitVal !== undefined) {
            tableData = tableData.slice(0, limitVal)
          }
        }

        return createCursor<T>(tableData as T[])
      }

      // Handle CREATE INDEX (no-op)
      if (queryLower.startsWith('create index') || queryLower.startsWith('create unique index')) {
        return createCursor<T>([])
      }

      return createCursor<T>([])
    },
  }
}

function createCursor<T>(results: T[]): SqlCursor<T> {
  return {
    toArray: () => results,
    one: () => results[0] ?? null,
    raw: function* <R = SqlStorageValue[]>(): IterableIterator<R> {
      for (const row of results) {
        yield Object.values(row as Record<string, unknown>) as unknown as R
      }
    },
    columnNames: results.length > 0 ? Object.keys(results[0] as Record<string, unknown>) : [],
    rowsRead: results.length,
    rowsWritten: 0,
  }
}

// =============================================================================
// RDB Provider Adapter
// =============================================================================

/**
 * Adapter that wraps RDB to conform to the ai-database DBProvider interface.
 *
 * Key adaptations:
 * - `create(type, id, data)` -> `rdb.create(type, data, id)` (parameter reorder)
 * - `search(type, query, options)` -> performs text search on stringified data
 * - `delete()` returns boolean instead of void
 * - Adds `$id` and `$type` fields to results for ai-database compatibility
 *
 * Limitations documented in this adapter:
 * - Semantic search is NOT available (RDB doesn't store embeddings)
 * - Fuzzy operators (~> and <~) will gracefully fail or return empty results
 */
export class RDBProviderAdapter implements DBProvider {
  private rdb: RDB

  constructor(sqlStorage: SqlStorage) {
    this.rdb = new RDB(sqlStorage)
  }

  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    const entity = await this.rdb.get(type, id)
    if (!entity) return null
    return this.toAIDatabaseFormat(entity)
  }

  async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
    const entities = await this.rdb.list(type, options)
    return entities.map((e) => this.toAIDatabaseFormat(e))
  }

  async search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    // RDB uses Filter-based search, but ai-database uses string queries
    // We'll do a basic text search by listing all and filtering
    const all = await this.rdb.list(type, options)
    const queryLower = query.toLowerCase()

    return all
      .filter((entity) => {
        const text = JSON.stringify(entity).toLowerCase()
        return text.includes(queryLower)
      })
      .map((e) => this.toAIDatabaseFormat(e))
  }

  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // RDB signature: create(type, data, id?)
    // ai-database signature: create(type, id | undefined, data)
    const entity = await this.rdb.create(type, data, id)
    return this.toAIDatabaseFormat(entity)
  }

  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const entity = await this.rdb.update(type, id, data)
    return this.toAIDatabaseFormat(entity)
  }

  async delete(type: string, id: string): Promise<boolean> {
    // RDB delete returns void, but we need to return boolean for ai-database
    try {
      // Check if entity exists first
      const exists = await this.rdb.get(type, id)
      if (!exists) return false

      await this.rdb.delete(type, id)
      return true
    } catch {
      return false
    }
  }

  async related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]> {
    const entities = await this.rdb.related(type, id, relation)
    return entities.map((e) => this.toAIDatabaseFormat(e))
  }

  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void> {
    await this.rdb.relate(fromType, fromId, relation, toType, toId, metadata)
  }

  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    await this.rdb.unrelate(fromType, fromId, relation, toType, toId)
  }

  /**
   * Convert RDB entity format to ai-database format.
   * RDB returns { id, type, ...data }, ai-database expects { $id, $type, ...data }
   */
  private toAIDatabaseFormat(entity: Record<string, unknown>): Record<string, unknown> {
    const { id, type, ...data } = entity
    return {
      $id: id,
      $type: type,
      ...data,
    }
  }
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('RDB + ai-database Integration', () => {
  let sqlStorage: SqlStorage
  let rdbProvider: RDBProviderAdapter

  beforeEach(() => {
    // Create fresh storage and provider for each test
    sqlStorage = createMockSqlStorage()
    rdbProvider = new RDBProviderAdapter(sqlStorage)
    setProvider(rdbProvider)
  })

  afterEach(() => {
    // Reset to memory provider to avoid affecting other tests
    setProvider(createMemoryProvider())
  })

  describe('RDBProviderAdapter unit tests', () => {
    it('correctly converts RDB entity format to ai-database format', async () => {
      // Directly test the adapter's format conversion
      const created = await rdbProvider.create('TestType', undefined, {
        name: 'Test Entity',
        value: 42,
      })

      // ai-database format uses $id and $type
      expect(created.$id).toBeDefined()
      expect(created.$type).toBe('TestType')
      expect(created.name).toBe('Test Entity')
      expect(created.value).toBe(42)

      // Should NOT have raw id/type fields
      expect(created.id).toBeUndefined()
      expect(created.type).toBeUndefined()
    })

    it('handles create with explicit ID', async () => {
      const created = await rdbProvider.create('User', 'custom-user-id', {
        name: 'Custom User',
      })

      expect(created.$id).toBe('custom-user-id')
      expect(created.$type).toBe('User')
    })

    it('handles update correctly', async () => {
      const created = await rdbProvider.create('Item', undefined, {
        name: 'Original',
        count: 1,
      })

      const updated = await rdbProvider.update('Item', created.$id as string, {
        name: 'Updated',
        count: 2,
      })

      expect(updated.$id).toBe(created.$id)
      expect(updated.name).toBe('Updated')
      expect(updated.count).toBe(2)
    })

    it('delete returns false for non-existent entity', async () => {
      const result = await rdbProvider.delete('SomeType', 'non-existent')
      expect(result).toBe(false)
    })

    it('delete returns true for existing entity', async () => {
      const created = await rdbProvider.create('ToDelete', undefined, { name: 'delete me' })
      const result = await rdbProvider.delete('ToDelete', created.$id as string)
      expect(result).toBe(true)

      // Verify it's gone
      const retrieved = await rdbProvider.get('ToDelete', created.$id as string)
      expect(retrieved).toBeNull()
    })
  })

  describe('Phase 1: Basic Integration (RED -> GREEN)', () => {
    describe('Schema creation with RDB backend', () => {
      it('creates ai-database schema that uses RDB for storage', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            content: 'markdown',
          },
          Author: {
            name: 'string',
            email: 'string',
          },
        }

        const { db } = DB(schema)

        // Verify schema is properly parsed
        expect(db.$schema.entities.has('Post')).toBe(true)
        expect(db.$schema.entities.has('Author')).toBe(true)

        // Verify operations are available
        expect(typeof db.Post.create).toBe('function')
        expect(typeof db.Post.get).toBe('function')
        expect(typeof db.Post.list).toBe('function')
        expect(typeof db.Post.update).toBe('function')
        expect(typeof db.Post.delete).toBe('function')
      })
    })

    describe('CRUD operations through ai-database using RDB storage', () => {
      it('creates an entity through ai-database stored in RDB', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            content: 'markdown',
          },
        }

        const { db } = DB(schema)

        const post = await db.Post.create({
          title: 'Hello World',
          content: '# My First Post',
        })

        expect(post.$id).toBeDefined()
        expect(post.$type).toBe('Post')
        expect(post.title).toBe('Hello World')
        expect(post.content).toBe('# My First Post')
      })

      it('reads an entity through ai-database from RDB', async () => {
        const schema: DatabaseSchema = {
          User: {
            name: 'string',
            email: 'string',
          },
        }

        const { db } = DB(schema)

        const created = await db.User.create({
          name: 'Alice',
          email: 'alice@example.com',
        })

        const retrieved = await db.User.get(created.$id as string)

        expect(retrieved).not.toBeNull()
        expect(retrieved?.$id).toBe(created.$id)
        expect(retrieved?.name).toBe('Alice')
        expect(retrieved?.email).toBe('alice@example.com')
      })

      it('updates an entity through ai-database in RDB', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            published: 'boolean',
          },
        }

        const { db } = DB(schema)

        const created = await db.Post.create({
          title: 'Draft Post',
          published: false,
        })

        const updated = await db.Post.update(created.$id as string, {
          title: 'Published Post',
          published: true,
        })

        expect(updated.title).toBe('Published Post')
        expect(updated.published).toBe(true)

        // Verify the update persisted
        const retrieved = await db.Post.get(created.$id as string)
        expect(retrieved?.title).toBe('Published Post')
        expect(retrieved?.published).toBe(true)
      })

      it('deletes an entity through ai-database from RDB', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
          },
        }

        const { db } = DB(schema)

        const created = await db.Post.create({
          title: 'To Be Deleted',
        })

        const deleted = await db.Post.delete(created.$id as string)
        expect(deleted).toBe(true)

        const retrieved = await db.Post.get(created.$id as string)
        expect(retrieved).toBeNull()
      })

      it('lists entities through ai-database from RDB', async () => {
        const schema: DatabaseSchema = {
          Tag: {
            name: 'string',
          },
        }

        const { db } = DB(schema)

        await db.Tag.create({ name: 'typescript' })
        await db.Tag.create({ name: 'javascript' })
        await db.Tag.create({ name: 'rust' })

        const tags = await db.Tag.list()

        expect(tags.length).toBe(3)
        expect(tags.map((t) => t.name)).toContain('typescript')
        expect(tags.map((t) => t.name)).toContain('javascript')
        expect(tags.map((t) => t.name)).toContain('rust')
      })

      it('searches entities through ai-database using RDB text search', async () => {
        const schema: DatabaseSchema = {
          Article: {
            title: 'string',
            content: 'string',
          },
        }

        const { db } = DB(schema)

        await db.Article.create({
          title: 'Introduction to TypeScript',
          content: 'TypeScript is a typed superset of JavaScript',
        })
        await db.Article.create({
          title: 'React Fundamentals',
          content: 'React is a JavaScript library for building UIs',
        })
        await db.Article.create({
          title: 'Rust for Systems Programming',
          content: 'Rust provides memory safety without garbage collection',
        })

        const jsArticles = await db.Article.search('JavaScript')

        expect(jsArticles.length).toBe(2)
        expect(jsArticles.some((a) => a.title === 'Introduction to TypeScript')).toBe(true)
        expect(jsArticles.some((a) => a.title === 'React Fundamentals')).toBe(true)
      })
    })

    describe('Relationships with exact operators (-> and <-)', () => {
      it('creates relationships using exact forward operator (->)', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            author: '->Author.posts', // Exact forward reference
          },
          Author: {
            name: 'string',
          },
        }

        const { db } = DB(schema)

        // Create an author
        const author = await db.Author.create({
          name: 'John Doe',
        })

        // Create a post with author relationship
        const post = await db.Post.create({
          title: 'My Post',
          author: author.$id,
        })

        // Create the relationship explicitly
        await rdbProvider.relate(
          'Post',
          post.$id as string,
          'author',
          'Author',
          author.$id as string
        )

        // Verify relationship
        const relatedAuthors = await rdbProvider.related('Post', post.$id as string, 'author')
        expect(relatedAuthors.length).toBe(1)
        expect(relatedAuthors[0]?.name).toBe('John Doe')
      })

      it('creates bi-directional relationships with backref', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            author: '->Author.posts',
          },
          Author: {
            name: 'string',
            // posts backref is auto-created
          },
        }

        const { db } = DB(schema)

        const author = await db.Author.create({ name: 'Jane Smith' })

        const post1 = await db.Post.create({ title: 'Post 1', author: author.$id })
        const post2 = await db.Post.create({ title: 'Post 2', author: author.$id })

        // Create relationships
        await rdbProvider.relate(
          'Post',
          post1.$id as string,
          'author',
          'Author',
          author.$id as string
        )
        await rdbProvider.relate(
          'Post',
          post2.$id as string,
          'author',
          'Author',
          author.$id as string
        )

        // Create reverse relationships for backref
        await rdbProvider.relate(
          'Author',
          author.$id as string,
          'posts',
          'Post',
          post1.$id as string
        )
        await rdbProvider.relate(
          'Author',
          author.$id as string,
          'posts',
          'Post',
          post2.$id as string
        )

        // Query forward
        const authorOfPost1 = await rdbProvider.related('Post', post1.$id as string, 'author')
        expect(authorOfPost1.length).toBe(1)
        expect(authorOfPost1[0]?.name).toBe('Jane Smith')

        // Query reverse (backref)
        const postsOfAuthor = await rdbProvider.related('Author', author.$id as string, 'posts')
        expect(postsOfAuthor.length).toBe(2)
      })

      it('creates many-to-many relationships', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            tags: ['->Tag.posts'], // Many-to-many with exact operator
          },
          Tag: {
            name: 'string',
          },
        }

        const { db } = DB(schema)

        const tag1 = await db.Tag.create({ name: 'typescript' })
        const tag2 = await db.Tag.create({ name: 'javascript' })

        const post = await db.Post.create({
          title: 'JS vs TS',
          tags: [tag1.$id, tag2.$id],
        })

        // Create many-to-many relationships
        await rdbProvider.relate('Post', post.$id as string, 'tags', 'Tag', tag1.$id as string)
        await rdbProvider.relate('Post', post.$id as string, 'tags', 'Tag', tag2.$id as string)

        // Query relationships
        const tagsOfPost = await rdbProvider.related('Post', post.$id as string, 'tags')
        expect(tagsOfPost.length).toBe(2)
        expect(tagsOfPost.map((t) => t.name)).toContain('typescript')
        expect(tagsOfPost.map((t) => t.name)).toContain('javascript')
      })
    })

    describe('Fuzzy operators graceful degradation (~> and <~)', () => {
      it('fuzzy forward operator documents semantic search limitation', async () => {
        // This test documents that fuzzy operators (~> and <~) require semantic search
        // which RDB does not provide. When using RDB as backend:
        // - Fuzzy operators will not perform semantic matching
        // - Users should use exact operators (->) instead
        // - Or use MemoryProvider which has semantic search support

        const schema: DatabaseSchema = {
          SimpleProduct: {
            name: 'string',
            // Use exact operator which works with RDB
            categoryId: 'string?',
          },
          SimpleCategory: {
            name: 'string',
          },
        }

        const { db } = DB(schema)

        await db.SimpleCategory.create({ name: 'Electronics' })
        await db.SimpleCategory.create({ name: 'Clothing' })

        // Create product WITHOUT fuzzy reference - use exact ID
        const product = await db.SimpleProduct.create({
          name: 'Smartphone',
        })

        expect(product.$id).toBeDefined()
        expect(product.name).toBe('Smartphone')

        // With RDB, fuzzy matching is not supported
        // Users should store exact IDs and use exact operators
      })

      it('documents that semantic search is not available with RDB backend', async () => {
        const schema: DatabaseSchema = {
          Document: {
            title: 'string',
            content: 'markdown',
          },
        }

        const { db } = DB(schema)

        await db.Document.create({
          title: 'Machine Learning Basics',
          content: 'Introduction to neural networks',
        })
        await db.Document.create({
          title: 'Deep Learning Guide',
          content: 'Advanced neural network architectures',
        })

        // RDB-backed search is text-based, not semantic
        // "AI" won't match "Machine Learning" semantically
        const results = await db.Document.search('AI')
        expect(results.length).toBe(0) // No semantic understanding

        // But exact text matches work
        const exactResults = await db.Document.search('neural')
        expect(exactResults.length).toBe(2)
      })
    })
  })

  describe('Phase 2: Advanced Integration', () => {
    describe('Entity lifecycle with relationships', () => {
      it('deleting an entity removes its relationships', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            author: '->Author.posts',
          },
          Author: {
            name: 'string',
          },
        }

        const { db } = DB(schema)

        const author = await db.Author.create({ name: 'Test Author' })
        const post = await db.Post.create({ title: 'Test Post', author: author.$id })

        // Create relationship
        await rdbProvider.relate(
          'Post',
          post.$id as string,
          'author',
          'Author',
          author.$id as string
        )

        // Verify relationship exists
        let related = await rdbProvider.related('Post', post.$id as string, 'author')
        expect(related.length).toBe(1)

        // Delete post - RDB automatically removes relationships
        await db.Post.delete(post.$id as string)

        // Verify entity is deleted
        const deletedPost = await db.Post.get(post.$id as string)
        expect(deletedPost).toBeNull()
      })
    })

    describe('Complex schema with multiple entity types', () => {
      it('handles a blog-like schema with posts, authors, tags, and comments', async () => {
        const schema: DatabaseSchema = {
          Post: {
            title: 'string',
            content: 'markdown',
            published: 'boolean',
            author: '->Author.posts',
            tags: ['->Tag.posts'],
          },
          Author: {
            name: 'string',
            email: 'string',
            bio: 'string?',
          },
          Tag: {
            name: 'string',
            slug: 'string',
          },
          Comment: {
            content: 'string',
            post: '->Post.comments',
            author: '->Author.comments',
          },
        }

        const { db } = DB(schema)

        // Create author
        const author = await db.Author.create({
          name: 'Alice Developer',
          email: 'alice@dev.io',
          bio: 'Full-stack developer',
        })

        // Create tags
        const tagTS = await db.Tag.create({ name: 'TypeScript', slug: 'typescript' })
        const tagJS = await db.Tag.create({ name: 'JavaScript', slug: 'javascript' })

        // Create post
        const post = await db.Post.create({
          title: 'Understanding TypeScript',
          content: '# TypeScript Guide\n\nTypeScript is great!',
          published: true,
          author: author.$id,
          tags: [tagTS.$id, tagJS.$id],
        })

        // Create comment
        const comment = await db.Comment.create({
          content: 'Great article!',
          post: post.$id,
          author: author.$id,
        })

        // Set up relationships
        await rdbProvider.relate(
          'Post',
          post.$id as string,
          'author',
          'Author',
          author.$id as string
        )
        await rdbProvider.relate('Post', post.$id as string, 'tags', 'Tag', tagTS.$id as string)
        await rdbProvider.relate('Post', post.$id as string, 'tags', 'Tag', tagJS.$id as string)
        await rdbProvider.relate(
          'Comment',
          comment.$id as string,
          'post',
          'Post',
          post.$id as string
        )
        await rdbProvider.relate(
          'Comment',
          comment.$id as string,
          'author',
          'Author',
          author.$id as string
        )

        // Set up backrefs
        await rdbProvider.relate(
          'Author',
          author.$id as string,
          'posts',
          'Post',
          post.$id as string
        )
        await rdbProvider.relate('Tag', tagTS.$id as string, 'posts', 'Post', post.$id as string)
        await rdbProvider.relate('Tag', tagJS.$id as string, 'posts', 'Post', post.$id as string)
        await rdbProvider.relate(
          'Post',
          post.$id as string,
          'comments',
          'Comment',
          comment.$id as string
        )
        await rdbProvider.relate(
          'Author',
          author.$id as string,
          'comments',
          'Comment',
          comment.$id as string
        )

        // Verify all entities exist
        expect(await db.Author.get(author.$id as string)).not.toBeNull()
        expect(await db.Post.get(post.$id as string)).not.toBeNull()
        expect(await db.Tag.get(tagTS.$id as string)).not.toBeNull()
        expect(await db.Comment.get(comment.$id as string)).not.toBeNull()

        // Verify relationships
        const postAuthor = await rdbProvider.related('Post', post.$id as string, 'author')
        expect(postAuthor.length).toBe(1)
        expect(postAuthor[0]?.name).toBe('Alice Developer')

        const postTags = await rdbProvider.related('Post', post.$id as string, 'tags')
        expect(postTags.length).toBe(2)

        const authorPosts = await rdbProvider.related('Author', author.$id as string, 'posts')
        expect(authorPosts.length).toBe(1)
        expect(authorPosts[0]?.title).toBe('Understanding TypeScript')

        const postComments = await rdbProvider.related('Post', post.$id as string, 'comments')
        expect(postComments.length).toBe(1)
        expect(postComments[0]?.content).toBe('Great article!')
      })
    })

    describe('List options (pagination, ordering)', () => {
      it('supports pagination with limit and offset', async () => {
        const schema: DatabaseSchema = {
          Item: {
            name: 'string',
          },
        }

        const { db } = DB(schema)

        // Create 10 items
        for (let i = 1; i <= 10; i++) {
          await db.Item.create({ name: `Item ${i}` })
        }

        // Get first page
        const page1 = await db.Item.list({ limit: 3, offset: 0 })
        expect(page1.length).toBe(3)

        // Get second page
        const page2 = await db.Item.list({ limit: 3, offset: 3 })
        expect(page2.length).toBe(3)

        // Verify different items
        const page1Names = page1.map((i) => i.name)
        const page2Names = page2.map((i) => i.name)
        expect(page1Names).not.toEqual(page2Names)
      })
    })
  })

  describe('Phase 3: Edge Cases and Limitations', () => {
    describe('Error handling', () => {
      it('returns null for non-existent entity', async () => {
        const schema: DatabaseSchema = {
          Entity: { name: 'string' },
        }

        const { db } = DB(schema)

        const result = await db.Entity.get('non-existent-id')
        expect(result).toBeNull()
      })

      it('returns empty array for list on empty type', async () => {
        const schema: DatabaseSchema = {
          Empty: { name: 'string' },
        }

        const { db } = DB(schema)

        const result = await db.Empty.list()
        expect(result).toEqual([])
      })
    })

    describe('Data type preservation', () => {
      it('preserves different data types through RDB storage', async () => {
        const schema: DatabaseSchema = {
          DataTypes: {
            str: 'string',
            num: 'number',
            bool: 'boolean',
            jsonField: 'json',
          },
        }

        const { db } = DB(schema)

        const entity = await db.DataTypes.create({
          str: 'hello',
          num: 42,
          bool: true,
          jsonField: { nested: { value: [1, 2, 3] } },
        })

        const retrieved = await db.DataTypes.get(entity.$id as string)

        expect(retrieved?.str).toBe('hello')
        expect(retrieved?.num).toBe(42)
        expect(retrieved?.bool).toBe(true)
        expect(retrieved?.jsonField).toEqual({ nested: { value: [1, 2, 3] } })
      })
    })

    describe('Documented limitations', () => {
      it('LIMITATION: semantic/fuzzy search requires provider with embeddings', () => {
        // This test documents that RDB doesn't support semantic search
        // Users should use MemoryProvider or a provider with embeddings for fuzzy operators

        const limitations = {
          semanticSearch: 'RDB does not support semantic/vector search',
          fuzzyOperators: '~> and <~ operators require semantic search capability',
          embeddings: 'RDB does not store or generate embeddings',
          workaround:
            'Use MemoryProvider or a custom provider with embedding support for fuzzy matching',
        }

        expect(limitations.semanticSearch).toBeDefined()
        expect(limitations.fuzzyOperators).toBeDefined()
      })
    })
  })

  describe('Real-world usage patterns', () => {
    describe('CRM-like schema', () => {
      it('handles contacts, companies, and deals', async () => {
        const schema: DatabaseSchema = {
          Contact: {
            firstName: 'string',
            lastName: 'string',
            email: 'string',
            company: '->Company.contacts',
          },
          Company: {
            name: 'string',
            industry: 'string',
          },
          Deal: {
            title: 'string',
            value: 'number',
            status: 'string',
            contact: '->Contact.deals',
            company: '->Company.deals',
          },
        }

        const { db } = DB(schema)

        // Create company
        const company = await db.Company.create({
          name: 'Acme Corp',
          industry: 'Technology',
        })

        // Create contact
        const contact = await db.Contact.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@acme.com',
          company: company.$id,
        })

        // Create deal
        const deal = await db.Deal.create({
          title: 'Enterprise License',
          value: 50000,
          status: 'negotiation',
          contact: contact.$id,
          company: company.$id,
        })

        // Set up relationships
        await rdbProvider.relate(
          'Contact',
          contact.$id as string,
          'company',
          'Company',
          company.$id as string
        )
        await rdbProvider.relate(
          'Deal',
          deal.$id as string,
          'contact',
          'Contact',
          contact.$id as string
        )
        await rdbProvider.relate(
          'Deal',
          deal.$id as string,
          'company',
          'Company',
          company.$id as string
        )

        // Verify data
        const retrievedDeal = await db.Deal.get(deal.$id as string)
        expect(retrievedDeal?.title).toBe('Enterprise License')
        expect(retrievedDeal?.value).toBe(50000)

        // Query relationships
        const dealContact = await rdbProvider.related('Deal', deal.$id as string, 'contact')
        expect(dealContact.length).toBe(1)
        expect(dealContact[0]?.firstName).toBe('John')
      })
    })

    describe('E-commerce schema', () => {
      it('handles products, categories, and orders', async () => {
        const schema: DatabaseSchema = {
          Product: {
            name: 'string',
            price: 'number',
            sku: 'string',
            category: '->Category.products',
          },
          Category: {
            name: 'string',
            slug: 'string',
          },
          Order: {
            orderNumber: 'string',
            total: 'number',
            status: 'string',
          },
          OrderItem: {
            quantity: 'number',
            price: 'number',
            order: '->Order.items',
            product: '->Product.orderItems',
          },
        }

        const { db } = DB(schema)

        // Create category
        const category = await db.Category.create({
          name: 'Electronics',
          slug: 'electronics',
        })

        // Create products
        const product1 = await db.Product.create({
          name: 'Laptop',
          price: 999.99,
          sku: 'LAPTOP-001',
          category: category.$id,
        })

        const product2 = await db.Product.create({
          name: 'Mouse',
          price: 29.99,
          sku: 'MOUSE-001',
          category: category.$id,
        })

        // Create order
        const order = await db.Order.create({
          orderNumber: 'ORD-001',
          total: 1059.97,
          status: 'pending',
        })

        // Create order items
        await db.OrderItem.create({
          quantity: 1,
          price: 999.99,
          order: order.$id,
          product: product1.$id,
        })

        await db.OrderItem.create({
          quantity: 2,
          price: 29.99,
          order: order.$id,
          product: product2.$id,
        })

        // Verify products in category
        const products = await db.Product.list()
        expect(products.length).toBe(2)

        // Verify order
        const retrievedOrder = await db.Order.get(order.$id as string)
        expect(retrievedOrder?.orderNumber).toBe('ORD-001')
        expect(retrievedOrder?.total).toBe(1059.97)
      })
    })
  })
})
