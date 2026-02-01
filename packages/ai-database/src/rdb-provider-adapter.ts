/**
 * RDB Provider Adapter
 *
 * Adapts RDB's DBProvider interface to ai-database's DBProvider interface.
 *
 * The key interface mismatch addressed:
 * - ai-database search(): (type: string, query: string, options?: SearchOptions) => Promise<Record[]>
 * - RDB search(): (type: string, filter: Filter, options?: SearchOptions) => Promise<Entity[]>
 *
 * This adapter:
 * 1. Converts ai-database's string query to RDB's Filter object (using $regex for text search)
 * 2. Normalizes RDB entities (id/type) to ai-database format ($id/$type)
 * 3. Maintains full compatibility with ai-database's DBProvider interface
 *
 * @example
 * ```ts
 * import { RDB } from '@dotdo/rdb'
 * import { RDBProviderAdapter } from 'ai-database'
 * import { DB, setProvider } from 'ai-database'
 *
 * // Create RDB instance (Cloudflare D1/DO SQLite)
 * const rdb = new RDB(sqlStorage)
 *
 * // Wrap with adapter for ai-database compatibility
 * const adapter = new RDBProviderAdapter(rdb)
 * setProvider(adapter)
 *
 * // Now use ai-database's schema-first API
 * const { db } = DB({
 *   User: { name: 'string', email: 'string' },
 *   Post: { title: 'string', author: '->User' }
 * })
 *
 * // search() works with string queries (adapter converts to Filter)
 * const results = await db.Post.search('TypeScript')
 * ```
 *
 * @packageDocumentation
 */

import type { DBProvider } from './schema/provider.js'
import type { ListOptions, SearchOptions } from './schema/types.js'

/**
 * RDB Entity interface (from @dotdo/rdb)
 *
 * This is a simplified version of the interface for adapter use.
 * The actual RDB Entity uses id/type at the top level.
 */
interface RDBEntity {
  id: string
  type: string
  [key: string]: unknown
}

/**
 * RDB Filter type (from @dotdo/rdb)
 *
 * MongoDB-style filter operators for search operations.
 */
type FilterOperator =
  | { $eq: unknown }
  | { $ne: unknown }
  | { $gt: number | string }
  | { $gte: number | string }
  | { $lt: number | string }
  | { $lte: number | string }
  | { $in: unknown[] }
  | { $nin: unknown[] }
  | { $regex: string }
  | { $exists: boolean }

type FilterValue = unknown | FilterOperator
type Filter = Record<string, FilterValue>

/**
 * RDB DBProvider interface (from @dotdo/rdb)
 *
 * Simplified interface for adapter compatibility.
 */
interface RDBProvider {
  get(type: string, id: string): Promise<RDBEntity | null>
  list(
    type: string,
    options?: { limit?: number; offset?: number; orderBy?: string; order?: 'asc' | 'desc' }
  ): Promise<RDBEntity[]>
  search(
    type: string,
    filter: Filter,
    options?: { limit?: number; offset?: number }
  ): Promise<RDBEntity[]>
  create(type: string, data: Record<string, unknown>, id?: string): Promise<RDBEntity>
  update(type: string, id: string, data: Record<string, unknown>): Promise<RDBEntity>
  delete(type: string, id: string): Promise<void>
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: Record<string, unknown>
  ): Promise<void>
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
  related(
    type: string,
    id: string,
    relation: string,
    options?: { direction?: 'outgoing' | 'incoming' | 'both'; limit?: number; offset?: number }
  ): Promise<RDBEntity[]>
}

/**
 * Normalizes an RDB entity to ai-database format
 *
 * RDB uses: { id: 'xxx', type: 'User', name: 'John' }
 * ai-database uses: { $id: 'xxx', $type: 'User', name: 'John' }
 */
function normalizeEntity(entity: RDBEntity): Record<string, unknown> {
  const { id, type, ...rest } = entity
  return {
    $id: id,
    $type: type,
    ...rest,
  }
}

/**
 * Default fields to search when no specific fields are provided.
 * These are common text fields found in most entity types.
 */
const DEFAULT_SEARCH_FIELDS = ['title', 'name', 'content', 'description', 'body', 'text']

/**
 * Converts a string search query to an RDB Filter object
 *
 * By default, creates a $regex filter that searches across all string fields.
 * If fields option is provided, restricts search to those fields.
 *
 * @param query - The search string
 * @param field - The specific field to search
 * @returns Filter object for RDB search()
 */
function stringQueryToFilter(query: string, field: string): Filter {
  // Escape regex special characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return {
    [field]: { $regex: escapedQuery },
  }
}

/**
 * Get the list of fields to search
 *
 * @param options - Search options that may include specific fields
 * @returns Array of field names to search
 */
function getSearchFields(options?: SearchOptions): string[] {
  if (options?.fields && options.fields.length > 0) {
    return options.fields
  }
  return DEFAULT_SEARCH_FIELDS
}

/**
 * RDB Provider Adapter
 *
 * Wraps an RDB DBProvider to make it compatible with ai-database's DBProvider interface.
 * The primary adaptation is converting string search queries to RDB Filter objects.
 */
export class RDBProviderAdapter implements DBProvider {
  private rdb: RDBProvider

  /**
   * Create a new RDBProviderAdapter
   *
   * @param rdb - An RDB DBProvider instance (from RDB class or D1Provider/DOProvider)
   */
  constructor(rdb: RDBProvider) {
    this.rdb = rdb
  }

  /**
   * Get an entity by type and ID
   */
  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    const entity = await this.rdb.get(type, id)
    return entity ? normalizeEntity(entity) : null
  }

  /**
   * List entities of a type
   *
   * If a `where` filter is provided, we apply it client-side after fetching
   * since RDB's list() method doesn't support where filters natively.
   */
  async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
    const listOptions: {
      limit?: number
      offset?: number
      orderBy?: string
      order?: 'asc' | 'desc'
    } = {}

    // If we have where filters, we need to fetch all and filter client-side
    // We apply pagination after filtering
    const hasWhereFilter = options?.where && Object.keys(options.where).length > 0

    if (!hasWhereFilter) {
      if (options?.limit !== undefined) {
        listOptions.limit = options.limit
      }
      if (options?.offset !== undefined) {
        listOptions.offset = options.offset
      }
    }

    if (options?.orderBy !== undefined) {
      listOptions.orderBy = options.orderBy
    }
    if (options?.order !== undefined) {
      listOptions.order = options.order
    }

    let entities = await this.rdb.list(type, listOptions)

    // Apply where filter client-side
    if (hasWhereFilter && options?.where) {
      const whereFilter = options.where
      entities = entities.filter((entity) => {
        for (const [key, value] of Object.entries(whereFilter)) {
          if (entity[key] !== value) {
            return false
          }
        }
        return true
      })
    }

    let results = entities.map(normalizeEntity)

    // Apply pagination after client-side filtering
    if (hasWhereFilter) {
      if (options?.offset) {
        results = results.slice(options.offset)
      }
      if (options?.limit) {
        results = results.slice(0, options.limit)
      }
    }

    return results
  }

  /**
   * Search entities using a string query
   *
   * This is the key adaptation point:
   * - ai-database expects: search(type, query: string)
   * - RDB expects: search(type, filter: Filter)
   *
   * The adapter converts the string query to $regex Filters for text search.
   * Since RDB doesn't support $or at the top level, we search each field
   * separately and deduplicate results.
   */
  async search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    const fields = getSearchFields(options)
    const seenIds = new Set<string>()
    const results: Record<string, unknown>[] = []

    // Search each field and collect unique results
    // This is necessary because RDB doesn't support $or at the top level
    for (const field of fields) {
      const filter = stringQueryToFilter(query, field)

      try {
        const entities = await this.rdb.search(type, filter, {
          // Don't apply limit/offset per-field, we'll apply after deduplication
        })

        for (const entity of entities) {
          if (!seenIds.has(entity.id)) {
            seenIds.add(entity.id)
            results.push(normalizeEntity(entity))
          }
        }
      } catch {
        // Field might not exist on this entity type, continue to next field
      }
    }

    // Apply where filter client-side
    let finalResults = results
    if (options?.where && Object.keys(options.where).length > 0) {
      const whereFilter = options.where
      finalResults = finalResults.filter((entity) => {
        for (const [key, value] of Object.entries(whereFilter)) {
          if (entity[key] !== value) {
            return false
          }
        }
        return true
      })
    }

    // Apply limit and offset after collecting and filtering all results
    if (options?.offset) {
      finalResults = finalResults.slice(options.offset)
    }
    if (options?.limit) {
      finalResults = finalResults.slice(0, options.limit)
    }

    return finalResults
  }

  /**
   * Create a new entity
   */
  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const entity = await this.rdb.create(type, data, id)
    return normalizeEntity(entity)
  }

  /**
   * Update an existing entity
   */
  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const entity = await this.rdb.update(type, id, data)
    return normalizeEntity(entity)
  }

  /**
   * Delete an entity
   *
   * @returns true if deleted, false if entity didn't exist
   */
  async delete(type: string, id: string): Promise<boolean> {
    try {
      // Check if entity exists first
      const existing = await this.rdb.get(type, id)
      if (!existing) {
        return false
      }

      await this.rdb.delete(type, id)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get related entities
   */
  async related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]> {
    const entities = await this.rdb.related(type, id, relation, {
      direction: 'outgoing',
    })
    return entities.map(normalizeEntity)
  }

  /**
   * Create a relationship between entities
   */
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

  /**
   * Remove a relationship between entities
   */
  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    await this.rdb.unrelate(fromType, fromId, relation, toType, toId)
  }
}

/**
 * Create an RDBProviderAdapter from an RDB instance
 *
 * @param rdb - An RDB DBProvider instance
 * @returns Adapted provider compatible with ai-database
 *
 * @example
 * ```ts
 * import { RDB } from '@dotdo/rdb'
 * import { createRDBAdapter, setProvider } from 'ai-database'
 *
 * const rdb = new RDB(sqlStorage)
 * const adapter = createRDBAdapter(rdb)
 * setProvider(adapter)
 * ```
 */
export function createRDBAdapter(rdb: RDBProvider): DBProvider {
  return new RDBProviderAdapter(rdb)
}
