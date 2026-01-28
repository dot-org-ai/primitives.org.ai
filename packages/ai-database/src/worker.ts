/**
 * Worker Export - WorkerEntrypoint for RPC access to AI Database
 *
 * Exposes database operations via Cloudflare RPC.
 * Works both in Cloudflare Workers and standalone (with MemoryProvider).
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "AI_DATABASE", "service": "ai-database" }
 *   ]
 * }
 *
 * // worker.ts - consuming service
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const db = env.AI_DATABASE.connect('my-namespace')
 *     const post = await db.create('Post', { title: 'Hello' })
 *     return Response.json(post)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Mock classes for non-Cloudflare environments
class MockRpcTarget {}
class MockWorkerEntrypoint<T = unknown> {
  protected env!: T
  protected ctx!: unknown
}
class MockDurableObject {
  protected ctx!: any
  protected env!: any
  constructor(_state: any, _env: any) {}
}

// Try to import from cloudflare:workers, fall back to mocks
let WorkerEntrypoint: typeof MockWorkerEntrypoint
let RpcTarget: typeof MockRpcTarget
let DurableObjectBase: typeof MockDurableObject

try {
  // @ts-expect-error - cloudflare:workers is only available in Cloudflare Workers runtime
  const cfWorkers = await import('cloudflare:workers')
  WorkerEntrypoint = cfWorkers.WorkerEntrypoint
  RpcTarget = cfWorkers.RpcTarget
  DurableObjectBase = cfWorkers.DurableObject
} catch {
  WorkerEntrypoint = MockWorkerEntrypoint
  RpcTarget = MockRpcTarget
  DurableObjectBase = MockDurableObject
}
import { MemoryProvider } from './memory-provider.js'
import type { MemoryProviderOptions, EmbeddingProvider } from './memory-provider.js'
import type {
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  EmbeddingsConfig,
} from './schema.js'

/**
 * Environment bindings for the worker
 */
export interface Env {
  // Add any required bindings here
}

/**
 * Global namespace registry for in-memory providers (used when no DO binding is available)
 * This enables namespace isolation and persistence across connect() calls in tests
 */
const namespaceProviders = new Map<string, MemoryProvider>()

/**
 * Get or create a MemoryProvider for a namespace
 */
function getOrCreateProvider(namespace: string, options?: MemoryProviderOptions): MemoryProvider {
  let provider = namespaceProviders.get(namespace)
  if (!provider) {
    provider = new MemoryProvider(options)
    namespaceProviders.set(namespace, provider)
  }
  return provider
}

/**
 * Entity result type with standard fields
 */
export interface EntityResult {
  $id: string
  $type: string
  [key: string]: unknown
}

/**
 * Search result with score
 */
export interface SearchResult extends EntityResult {
  $score?: number
}

/**
 * Semantic search result with scores
 */
export interface SemanticSearchResult extends EntityResult {
  $score: number
}

/**
 * Hybrid search result with RRF and component scores
 */
export interface HybridSearchResult extends SemanticSearchResult {
  $rrfScore: number
  $ftsRank: number
  $semanticRank: number
}

/**
 * DatabaseServiceCore - RpcTarget wrapper around MemoryProvider
 *
 * Exposes all required methods as RPC-callable methods.
 * This is the core service class that can be instantiated directly.
 */
export class DatabaseServiceCore extends RpcTarget {
  private provider: MemoryProvider

  constructor(namespace: string = 'default', options?: MemoryProviderOptions) {
    super()
    this.provider = getOrCreateProvider(namespace, options)
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set embeddings configuration for auto-generation
   */
  setEmbeddingsConfig(config: EmbeddingsConfig): void {
    this.provider.setEmbeddingsConfig(config)
  }

  /**
   * Enable or disable ai-functions for embeddings
   */
  setUseAiFunctions(enabled: boolean): void {
    this.provider.setUseAiFunctions(enabled)
  }

  /**
   * Set a custom embedding provider
   */
  setEmbeddingProvider(provider: EmbeddingProvider | undefined): void {
    this.provider.setEmbeddingProvider(provider)
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Get an entity by type and ID
   */
  async get(type: string, id: string): Promise<EntityResult | null> {
    const result = await this.provider.get(type, id)
    if (!result) return null
    return { $id: id, $type: type, ...result } as EntityResult
  }

  /**
   * List entities by type
   */
  async list(type: string, options?: ListOptions): Promise<EntityResult[]> {
    const results = await this.provider.list(type, options)
    return results.map((r) => ({ $type: type, ...r })) as EntityResult[]
  }

  /**
   * Create an entity
   */
  async create(type: string, data: Record<string, unknown>, id?: string): Promise<EntityResult> {
    const result = await this.provider.create(type, id, data)
    return { $type: type, ...result } as EntityResult
  }

  /**
   * Update an entity
   */
  async update(type: string, id: string, data: Record<string, unknown>): Promise<EntityResult> {
    const result = await this.provider.update(type, id, data)
    return { $id: id, $type: type, ...result } as EntityResult
  }

  /**
   * Delete an entity
   */
  async delete(type: string, id: string): Promise<boolean> {
    return this.provider.delete(type, id)
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Full-text search
   */
  async search(type: string, query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const results = await this.provider.search(type, query, options)
    return results.map((r) => ({ $type: type, ...r })) as SearchResult[]
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    type: string,
    query: string,
    options?: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]> {
    type ProviderWithSemantic = MemoryProvider & {
      semanticSearch?: (
        type: string,
        query: string,
        options?: SearchOptions
      ) => Promise<Record<string, unknown>[]>
    }
    const provider = this.provider as ProviderWithSemantic
    // Check if provider supports semantic search
    if (provider.semanticSearch) {
      const results = await provider.semanticSearch(type, query, options)
      return results as SemanticSearchResult[]
    }
    // Fallback to regular search
    const results = await provider.search(type, query, options)
    return results.map((r: Record<string, unknown>, i: number) => ({
      $type: type,
      $score: 1 - i * 0.1, // Decreasing score based on position
      ...r,
    })) as SemanticSearchResult[]
  }

  /**
   * Hybrid search combining FTS and semantic
   */
  async hybridSearch(
    type: string,
    query: string,
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    type ProviderWithHybrid = MemoryProvider & {
      hybridSearch?: (
        type: string,
        query: string,
        options?: SearchOptions
      ) => Promise<Record<string, unknown>[]>
    }
    const provider = this.provider as ProviderWithHybrid
    // Check if provider supports hybrid search
    if (provider.hybridSearch) {
      const results = await provider.hybridSearch(type, query, options)
      return results as HybridSearchResult[]
    }
    // Fallback to semantic search
    const results = await this.semanticSearch(type, query, options)
    return results.map((r: SemanticSearchResult, i: number) => ({
      ...r,
      $rrfScore: r.$score,
      $ftsRank: i + 1,
      $semanticRank: i + 1,
    })) as HybridSearchResult[]
  }

  // ===========================================================================
  // Relationship Operations
  // ===========================================================================

  /**
   * Get related entities
   */
  async related(type: string, id: string, relation: string): Promise<EntityResult[]> {
    const results = await this.provider.related(type, id, relation)
    return results.map((r) => r as EntityResult)
  }

  /**
   * Create a relationship between two entities
   */
  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void> {
    return this.provider.relate(fromType, fromId, relation, toType, toId, metadata)
  }

  /**
   * Remove a relationship between two entities
   */
  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    return this.provider.unrelate(fromType, fromId, relation, toType, toId)
  }

  // ===========================================================================
  // Events API
  // ===========================================================================

  /**
   * Subscribe to events matching a pattern
   * @returns Unsubscribe function ID (use unsubscribe() to remove)
   */
  on(pattern: string, handler: (event: any) => void | Promise<void>): string {
    // Store handler and return ID for later unsubscription
    if ('on' in this.provider) {
      const unsubscribe = (this.provider as any).on(pattern, handler)
      // Store unsubscribe function with unique ID
      const handlerId = crypto.randomUUID()
      this._eventHandlers.set(handlerId, unsubscribe)
      return handlerId
    }
    return ''
  }

  private _eventHandlers = new Map<string, () => void>()

  /**
   * Unsubscribe from events
   */
  unsubscribe(handlerId: string): void {
    const unsubscribe = this._eventHandlers.get(handlerId)
    if (unsubscribe) {
      unsubscribe()
      this._eventHandlers.delete(handlerId)
    }
  }

  /**
   * Emit an event
   */
  async emit(
    eventOrOptions: string | { event: string; actor: string; object?: string; data?: unknown },
    data?: unknown
  ): Promise<any> {
    if ('emit' in this.provider) {
      if (typeof eventOrOptions === 'string') {
        return (this.provider as any).emit(eventOrOptions, data)
      }
      return (this.provider as any).emit(eventOrOptions)
    }
    return null
  }

  /**
   * List events
   */
  async listEvents(options?: {
    event?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<any[]> {
    if ('listEvents' in this.provider) {
      return (this.provider as any).listEvents(options)
    }
    return []
  }

  // ===========================================================================
  // Actions API
  // ===========================================================================

  /**
   * Create a new action
   */
  async createAction(options: {
    action: string
    actor: string
    object?: string
    data?: unknown
    total?: number
  }): Promise<any> {
    if ('createAction' in this.provider) {
      return (this.provider as any).createAction(options)
    }
    return null
  }

  /**
   * Get an action by ID
   */
  async getAction(id: string): Promise<any | null> {
    if ('getAction' in this.provider) {
      return (this.provider as any).getAction(id)
    }
    return null
  }

  /**
   * Update an action
   */
  async updateAction(
    id: string,
    updates: { status?: string; progress?: number; result?: unknown; error?: string }
  ): Promise<any> {
    if ('updateAction' in this.provider) {
      return (this.provider as any).updateAction(id, updates)
    }
    return null
  }

  /**
   * List actions
   */
  async listActions(options?: {
    status?: string
    action?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<any[]> {
    if ('listActions' in this.provider) {
      return (this.provider as any).listActions(options)
    }
    return []
  }

  // ===========================================================================
  // Artifacts API
  // ===========================================================================

  /**
   * Get an artifact
   */
  async getArtifact(url: string, type: string): Promise<any | null> {
    if ('getArtifact' in this.provider) {
      return (this.provider as any).getArtifact(url, type)
    }
    return null
  }

  /**
   * Set an artifact
   */
  async setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    if ('setArtifact' in this.provider) {
      return (this.provider as any).setArtifact(url, type, data)
    }
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(url: string, type?: string): Promise<void> {
    if ('deleteArtifact' in this.provider) {
      return (this.provider as any).deleteArtifact(url, type)
    }
  }

  /**
   * List artifacts for a URL
   */
  async listArtifacts(url: string): Promise<any[]> {
    if ('listArtifacts' in this.provider) {
      return (this.provider as any).listArtifacts(url)
    }
    return []
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Clear all data in the provider (useful for testing)
   */
  clear(): void {
    if ('clear' in this.provider) {
      ;(this.provider as any).clear()
    }
  }
}

// =============================================================================
// DatabaseDO - Durable Object with SQLite storage for core _data and _rels tables
// =============================================================================

/**
 * DatabaseDO - Durable Object using SQLite for the core schema layer.
 *
 * Provides two tables:
 * - `_data`: id TEXT PRIMARY KEY, type TEXT, data TEXT (JSON), created_at TEXT, updated_at TEXT
 * - `_rels`: from_id TEXT, relation TEXT, to_id TEXT, metadata TEXT (JSON),
 *            PRIMARY KEY(from_id, relation, to_id)
 *
 * Handles HTTP requests for CRUD operations on data records and relationships,
 * plus graph traversal queries.
 */
export class DatabaseDO extends DurableObjectBase {
  private sql!: SqlStorage
  private initialized = false

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env)
    this.sql = (state as any).storage.sql
  }

  private ensureSchema(): void {
    if (this.initialized) return

    // Create _data table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _data (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Create _rels table with created_at
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _rels (
        from_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        to_id TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY(from_id, relation, to_id)
      )
    `)

    // Create _meta table for schema versioning
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Set initial schema version
    this.sql.exec(`
      INSERT OR IGNORE INTO _meta (key, value) VALUES ('version', '1')
    `)

    // Create indexes for performance
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_data_type ON _data(type)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_data_created_at ON _data(created_at)`)
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_rels_from_id_relation ON _rels(from_id, relation)`
    )
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_rels_to_id_relation ON _rels(to_id, relation)`)

    this.initialized = true
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureSchema()

    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // Route: /data (list or insert)
      if (path === '/data' && method === 'GET') {
        return this.handleListData(url)
      }
      if (path === '/data' && method === 'POST') {
        return this.handleInsertData(request)
      }

      // Route: /data/:id (get, update, delete)
      const dataMatch = path.match(/^\/data\/(.+)$/)
      if (dataMatch) {
        const id = decodeURIComponent(dataMatch[1])
        if (method === 'GET') return this.handleGetData(id)
        if (method === 'PATCH') return this.handleUpdateData(id, request)
        if (method === 'DELETE') return this.handleDeleteData(id)
      }

      // Route: /rels (list or create)
      if (path === '/rels' && method === 'GET') {
        return this.handleQueryRels(url)
      }
      if (path === '/rels' && method === 'POST') {
        return this.handleCreateRel(request)
      }

      // Route: /rels/delete (delete relationship)
      if (path === '/rels/delete' && method === 'DELETE') {
        return this.handleDeleteRel(request)
      }

      // Route: /traverse (graph traversal)
      if (path === '/traverse' && method === 'GET') {
        return this.handleTraverse(url)
      }

      // Route: /meta/indexes (list indexes)
      if (path === '/meta/indexes' && method === 'GET') {
        return this.handleGetIndexes()
      }

      // Route: /meta/version (schema version)
      if (path === '/meta/version' && method === 'GET') {
        return this.handleGetVersion()
      }

      // Route: /query/list (GET for simple, POST for complex)
      if (path === '/query/list' && method === 'GET') {
        return this.handleQueryList(url)
      }
      if (path === '/query/list' && method === 'POST') {
        return this.handleQueryListPost(request)
      }

      // Route: /query/find (POST)
      if (path === '/query/find' && method === 'POST') {
        return this.handleQueryFind(request)
      }

      // Route: /query/search (POST)
      if (path === '/query/search' && method === 'POST') {
        return this.handleQuerySearch(request)
      }

      return Response.json({ error: 'Not found' }, { status: 404 })
    } catch (err: any) {
      return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
  }

  // ===========================================================================
  // _data handlers
  // ===========================================================================

  private handleListData(url: URL): Response {
    const type = url.searchParams.get('type')
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')

    let query = 'SELECT * FROM _data'
    const params: any[] = []

    if (type) {
      query += ' WHERE type = ?'
      params.push(type)
    }

    query += ' ORDER BY rowid ASC'

    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit, 10))
    }
    if (offset) {
      query += ' OFFSET ?'
      params.push(parseInt(offset, 10))
    }

    const rows = this.sql.exec(query, ...params).toArray()
    const results = rows.map((row: any) => this.deserializeDataRow(row))
    return Response.json(results)
  }

  private async handleInsertData(request: Request): Promise<Response> {
    let body: Record<string, any>
    try {
      body = (await request.json()) as Record<string, any>
    } catch (err) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type, data } = body
    let { id } = body

    if (!type) {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }

    if (!id) {
      id = crypto.randomUUID()
    }

    // Check for duplicate ID
    const existing = this.sql.exec('SELECT id FROM _data WHERE id = ?', id).toArray()
    if (existing.length > 0) {
      return Response.json({ error: 'Record with this id already exists' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const dataJson = JSON.stringify(data ?? {})

    this.sql.exec(
      'INSERT INTO _data (id, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      id,
      type,
      dataJson,
      now,
      now
    )

    const result = {
      id,
      type,
      data: data ?? {},
      created_at: now,
      updated_at: now,
    }
    return Response.json(result)
  }

  private handleGetData(id: string): Response {
    const rows = this.sql.exec('SELECT * FROM _data WHERE id = ?', id).toArray()
    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    return Response.json(this.deserializeDataRow(rows[0] as any))
  }

  private async handleUpdateData(id: string, request: Request): Promise<Response> {
    const rows = this.sql.exec('SELECT * FROM _data WHERE id = ?', id).toArray()
    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const existing = this.deserializeDataRow(rows[0] as any)
    const body = (await request.json()) as Record<string, any>

    // Merge data fields (shallow merge)
    const mergedData = { ...existing.data, ...(body.data ?? {}) }
    const now = new Date().toISOString()
    const dataJson = JSON.stringify(mergedData)

    this.sql.exec('UPDATE _data SET data = ?, updated_at = ? WHERE id = ?', dataJson, now, id)

    const result = {
      id: existing.id,
      type: existing.type,
      data: mergedData,
      created_at: existing.created_at,
      updated_at: now,
    }
    return Response.json(result)
  }

  private handleDeleteData(id: string): Response {
    const rows = this.sql.exec('SELECT id FROM _data WHERE id = ?', id).toArray()
    if (rows.length === 0) {
      return Response.json({ deleted: false })
    }

    // Delete the record
    this.sql.exec('DELETE FROM _data WHERE id = ?', id)

    // Cascade: remove relationships involving this id
    this.sql.exec('DELETE FROM _rels WHERE from_id = ? OR to_id = ?', id, id)

    return Response.json({ deleted: true })
  }

  // ===========================================================================
  // _rels handlers
  // ===========================================================================

  private handleQueryRels(url: URL): Response {
    const from_id = url.searchParams.get('from_id')
    const to_id = url.searchParams.get('to_id')
    const relation = url.searchParams.get('relation')

    let query = 'SELECT * FROM _rels WHERE 1=1'
    const params: any[] = []

    if (from_id) {
      query += ' AND from_id = ?'
      params.push(from_id)
    }
    if (to_id) {
      query += ' AND to_id = ?'
      params.push(to_id)
    }
    if (relation) {
      query += ' AND relation = ?'
      params.push(relation)
    }

    const rows = this.sql.exec(query, ...params).toArray()
    const results = rows.map((row: any) => this.deserializeRelRow(row))
    return Response.json(results)
  }

  private async handleCreateRel(request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, any>
    const { from_id, relation, to_id, metadata } = body

    // Validate required fields
    if (!from_id || !relation || !to_id) {
      return Response.json({ error: 'from_id, relation, and to_id are required' }, { status: 400 })
    }

    const metadataJson = metadata ? JSON.stringify(metadata) : null
    const now = new Date().toISOString()

    try {
      this.sql.exec(
        'INSERT INTO _rels (from_id, relation, to_id, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
        from_id,
        relation,
        to_id,
        metadataJson,
        now
      )
    } catch (err: any) {
      // Handle duplicate composite key -- upsert
      if (err.message && err.message.includes('UNIQUE constraint')) {
        this.sql.exec(
          'UPDATE _rels SET metadata = ? WHERE from_id = ? AND relation = ? AND to_id = ?',
          metadataJson,
          from_id,
          relation,
          to_id
        )
        // Re-fetch to get the original created_at
        const rows = this.sql
          .exec(
            'SELECT created_at FROM _rels WHERE from_id = ? AND relation = ? AND to_id = ?',
            from_id,
            relation,
            to_id
          )
          .toArray()
        const result: Record<string, any> = { from_id, relation, to_id }
        result.metadata = metadata ?? null
        result.created_at = (rows[0] as any)?.created_at
        return Response.json(result)
      } else {
        throw err
      }
    }

    const result: Record<string, any> = { from_id, relation, to_id }
    result.metadata = metadata ?? null
    result.created_at = now
    return Response.json(result)
  }

  private async handleDeleteRel(request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, any>
    const { from_id, relation, to_id } = body

    const existing = this.sql
      .exec(
        'SELECT * FROM _rels WHERE from_id = ? AND relation = ? AND to_id = ?',
        from_id,
        relation,
        to_id
      )
      .toArray()

    if (existing.length === 0) {
      return Response.json({ deleted: false })
    }

    this.sql.exec(
      'DELETE FROM _rels WHERE from_id = ? AND relation = ? AND to_id = ?',
      from_id,
      relation,
      to_id
    )
    return Response.json({ deleted: true })
  }

  // ===========================================================================
  // Traverse handler
  // ===========================================================================

  private handleTraverse(url: URL): Response {
    const from_id = url.searchParams.get('from_id')
    const to_id = url.searchParams.get('to_id')
    const relationParam = url.searchParams.get('relation')
    const typeFilter = url.searchParams.get('type')

    // Support multi-hop traversal via comma-separated relations
    const relations = relationParam ? relationParam.split(',') : []

    if (from_id && relations.length > 0) {
      // Forward traversal: from_id through one or more relation hops
      let currentIds: string[] = [from_id]

      for (const rel of relations) {
        if (currentIds.length === 0) break
        const placeholders = currentIds.map(() => '?').join(',')
        const rows = this.sql
          .exec(
            `SELECT to_id FROM _rels WHERE from_id IN (${placeholders}) AND relation = ?`,
            ...currentIds,
            rel
          )
          .toArray()
        currentIds = [...new Set(rows.map((r: any) => r.to_id as string))]
      }

      if (currentIds.length === 0) {
        return Response.json([])
      }

      // Fetch the actual data records
      const placeholders = currentIds.map(() => '?').join(',')
      let query = `SELECT * FROM _data WHERE id IN (${placeholders})`
      const params: any[] = [...currentIds]

      if (typeFilter) {
        query += ' AND type = ?'
        params.push(typeFilter)
      }

      const records = this.sql.exec(query, ...params).toArray()
      return Response.json(records.map((r: any) => this.deserializeDataRow(r)))
    }

    if (to_id && relations.length > 0) {
      // Reverse traversal: find who points to to_id via relation
      const rel = relations[0]
      const rows = this.sql
        .exec('SELECT from_id FROM _rels WHERE to_id = ? AND relation = ?', to_id, rel)
        .toArray()
      const fromIds = [...new Set(rows.map((r: any) => r.from_id as string))]

      if (fromIds.length === 0) {
        return Response.json([])
      }

      const placeholders = fromIds.map(() => '?').join(',')
      let query = `SELECT * FROM _data WHERE id IN (${placeholders})`
      const params: any[] = [...fromIds]

      if (typeFilter) {
        query += ' AND type = ?'
        params.push(typeFilter)
      }

      const records = this.sql.exec(query, ...params).toArray()
      return Response.json(records.map((r: any) => this.deserializeDataRow(r)))
    }

    if (from_id && !relationParam) {
      // Traverse all outgoing relations from from_id, optionally filter by type
      const rows = this.sql.exec('SELECT to_id FROM _rels WHERE from_id = ?', from_id).toArray()
      const toIds = [...new Set(rows.map((r: any) => r.to_id as string))]

      if (toIds.length === 0) {
        return Response.json([])
      }

      const placeholders = toIds.map(() => '?').join(',')
      let query = `SELECT * FROM _data WHERE id IN (${placeholders})`
      const params: any[] = [...toIds]

      if (typeFilter) {
        query += ' AND type = ?'
        params.push(typeFilter)
      }

      const records = this.sql.exec(query, ...params).toArray()
      return Response.json(records.map((r: any) => this.deserializeDataRow(r)))
    }

    return Response.json([])
  }

  // ===========================================================================
  // Meta handlers
  // ===========================================================================

  private handleGetIndexes(): Response {
    const rows = this.sql
      .exec(
        `
      SELECT name, tbl_name as table_name, sql
      FROM sqlite_master
      WHERE type = 'index' AND sql IS NOT NULL
    `
      )
      .toArray()
    return Response.json(rows)
  }

  private handleGetVersion(): Response {
    const rows = this.sql.exec(`SELECT value FROM _meta WHERE key = 'version'`).toArray()
    if (rows.length === 0) {
      return Response.json({ version: 1 })
    }
    return Response.json({ version: parseInt((rows[0] as any).value, 10) })
  }

  // ===========================================================================
  // Query handlers
  // ===========================================================================

  /**
   * Validate a field name to prevent SQL injection.
   * Only allows alphanumeric characters, underscores, and dots for nested fields.
   */
  private isValidFieldName(fieldName: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(fieldName)
  }

  /**
   * Build SQL WHERE clause from a where object.
   * Returns [clause, params] tuple where clause includes the WHERE keyword.
   */
  /**
   * Convert a value for SQLite JSON comparison.
   * Booleans need to be converted to 1/0 because SQLite stores JSON booleans as integers.
   */
  private toSqliteValue(value: unknown): unknown {
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    return value
  }

  private buildWhereClause(
    type: string,
    where?: Record<string, unknown>
  ): { clause: string; params: unknown[] } {
    const conditions: string[] = ['type = ?']
    const params: unknown[] = [type]

    if (where) {
      for (const [field, value] of Object.entries(where)) {
        // Validate field name to prevent injection
        if (!this.isValidFieldName(field)) {
          continue // Skip invalid field names silently
        }

        // Handle nested field paths like "profile.location"
        const jsonPath = field.includes('.') ? `$.${field}` : `$.${field}`

        if (value === null) {
          conditions.push(`json_extract(data, ?) IS NULL`)
          params.push(jsonPath)
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Handle operators: $gt, $lt, $gte, $lte, $in, $ne
          const ops = value as Record<string, unknown>
          for (const [op, opValue] of Object.entries(ops)) {
            const sqliteValue = this.toSqliteValue(opValue)
            switch (op) {
              case '$gt':
                conditions.push(`json_extract(data, ?) > ?`)
                params.push(jsonPath, sqliteValue)
                break
              case '$lt':
                conditions.push(`json_extract(data, ?) < ?`)
                params.push(jsonPath, sqliteValue)
                break
              case '$gte':
                conditions.push(`json_extract(data, ?) >= ?`)
                params.push(jsonPath, sqliteValue)
                break
              case '$lte':
                conditions.push(`json_extract(data, ?) <= ?`)
                params.push(jsonPath, sqliteValue)
                break
              case '$ne':
                conditions.push(`json_extract(data, ?) != ?`)
                params.push(jsonPath, sqliteValue)
                break
              case '$in':
                if (Array.isArray(opValue) && opValue.length > 0) {
                  const placeholders = opValue.map(() => '?').join(',')
                  conditions.push(`json_extract(data, ?) IN (${placeholders})`)
                  params.push(jsonPath, ...opValue.map((v) => this.toSqliteValue(v)))
                }
                break
            }
          }
        } else {
          // Simple equality - convert booleans to 1/0 for SQLite JSON comparison
          conditions.push(`json_extract(data, ?) = ?`)
          params.push(jsonPath, this.toSqliteValue(value))
        }
      }
    }

    return {
      clause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
      params,
    }
  }

  /**
   * Build ORDER BY clause from orderBy and order parameters.
   */
  private buildOrderByClause(orderBy?: string | null, order?: string | null): string {
    if (!orderBy || !this.isValidFieldName(orderBy)) {
      return ' ORDER BY rowid ASC'
    }

    const direction = order?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const jsonPath = `$.${orderBy}`
    return ` ORDER BY json_extract(data, '${jsonPath}') ${direction}`
  }

  /**
   * Handle GET /query/list - simple query via URL params
   */
  private handleQueryList(url: URL): Response {
    const type = url.searchParams.get('type')

    if (!type) {
      return Response.json({ error: 'type parameter is required' }, { status: 400 })
    }

    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')
    const orderBy = url.searchParams.get('orderBy')
    const order = url.searchParams.get('order')

    const { clause, params } = this.buildWhereClause(type)
    let query = `SELECT * FROM _data${clause}`
    query += this.buildOrderByClause(orderBy, order)

    const limitNum = limit ? parseInt(limit, 10) : null
    const offsetNum = offset ? parseInt(offset, 10) : null

    // OFFSET requires LIMIT in SQLite, so add a very large default LIMIT if offset is specified without limit
    if (offsetNum !== null && offsetNum >= 0) {
      if (limitNum !== null && limitNum >= 0) {
        query += ' LIMIT ?'
        params.push(limitNum)
      } else {
        // Use a very large limit when only offset is specified
        query += ' LIMIT -1'
      }
      query += ' OFFSET ?'
      params.push(offsetNum)
    } else if (limitNum !== null && limitNum >= 0) {
      query += ' LIMIT ?'
      params.push(limitNum)
    }

    const rows = this.sql.exec(query, ...params).toArray()
    const results = rows.map((row: any) => this.deserializeDataRow(row))
    return Response.json(results)
  }

  /**
   * Handle POST /query/list - complex query via JSON body
   */
  private async handleQueryListPost(request: Request): Promise<Response> {
    let body: Record<string, any>
    try {
      body = (await request.json()) as Record<string, any>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type, where, orderBy, order, limit, offset } = body

    if (!type) {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }

    const { clause, params } = this.buildWhereClause(type, where)
    let query = `SELECT * FROM _data${clause}`
    query += this.buildOrderByClause(orderBy, order)

    // OFFSET requires LIMIT in SQLite, so add a very large default LIMIT if offset is specified without limit
    if (typeof offset === 'number' && offset >= 0) {
      if (typeof limit === 'number' && limit >= 0) {
        query += ' LIMIT ?'
        params.push(limit)
      } else {
        // Use a very large limit when only offset is specified
        query += ' LIMIT -1'
      }
      query += ' OFFSET ?'
      params.push(offset)
    } else if (typeof limit === 'number' && limit >= 0) {
      query += ' LIMIT ?'
      params.push(limit)
    }

    const rows = this.sql.exec(query, ...params).toArray()
    const results = rows.map((row: any) => this.deserializeDataRow(row))
    return Response.json(results)
  }

  /**
   * Handle POST /query/find - find first matching record
   */
  private async handleQueryFind(request: Request): Promise<Response> {
    let body: Record<string, any>
    try {
      body = (await request.json()) as Record<string, any>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type, where, orderBy, order } = body

    if (!type) {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }

    const { clause, params } = this.buildWhereClause(type, where)
    let query = `SELECT * FROM _data${clause}`
    query += this.buildOrderByClause(orderBy, order)
    query += ' LIMIT 1'

    const rows = this.sql.exec(query, ...params).toArray()

    if (rows.length === 0) {
      return Response.json(null)
    }

    return Response.json(this.deserializeDataRow(rows[0] as any))
  }

  /**
   * Escape special characters in LIKE patterns
   */
  private escapeLikePattern(pattern: string): string {
    // Escape %, _, and \ for LIKE
    return pattern.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  }

  /**
   * Calculate a simple relevance score based on term matches
   */
  private calculateRelevanceScore(text: string, query: string): number {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const terms = lowerQuery.split(/\s+/).filter((t) => t.length > 0)

    if (terms.length === 0) return 0

    let matchCount = 0
    let exactMatch = lowerText.includes(lowerQuery)

    for (const term of terms) {
      if (lowerText.includes(term)) {
        matchCount++
      }
    }

    // Score: exact match gets bonus, then percentage of terms matched
    const baseScore = matchCount / terms.length
    return exactMatch ? Math.min(1, baseScore + 0.3) : baseScore
  }

  /**
   * Handle POST /query/search - full-text search
   */
  private async handleQuerySearch(request: Request): Promise<Response> {
    let body: Record<string, any>
    try {
      body = (await request.json()) as Record<string, any>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type, query: searchQuery, fields, minScore, limit } = body

    if (!type) {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }

    if (!searchQuery || typeof searchQuery !== 'string') {
      return Response.json({ error: 'query field is required' }, { status: 400 })
    }

    // Escape the search query for LIKE
    const escapedQuery = this.escapeLikePattern(searchQuery)
    const likePattern = `%${escapedQuery}%`

    // Get all records of this type
    const rows = this.sql.exec('SELECT * FROM _data WHERE type = ?', type).toArray()

    // Filter and score results
    const results: Array<{ row: any; score: number }> = []

    for (const row of rows) {
      const record = this.deserializeDataRow(row as any)
      const data = record.data as Record<string, unknown>

      // Determine which fields to search
      const searchFields =
        Array.isArray(fields) && fields.length > 0
          ? fields
          : Object.keys(data).filter(
              (k) => typeof data[k] === 'string' || typeof data[k] === 'number'
            )

      // Search across fields
      let maxScore = 0
      let hasMatch = false

      for (const field of searchFields) {
        const value = data[field]
        if (value === undefined || value === null) continue

        const stringValue = String(value)
        // Case-insensitive comparison
        if (stringValue.toLowerCase().includes(searchQuery.toLowerCase())) {
          hasMatch = true
          const fieldScore = this.calculateRelevanceScore(stringValue, searchQuery)
          maxScore = Math.max(maxScore, fieldScore)
        }
      }

      if (hasMatch) {
        // Apply minScore filter
        if (typeof minScore === 'number' && maxScore < minScore) {
          continue
        }
        results.push({ row: record, score: maxScore })
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    // Apply limit
    const limitNum = typeof limit === 'number' && limit > 0 ? limit : results.length
    const limited = results.slice(0, limitNum)

    // Add score to results
    const finalResults = limited.map(({ row, score }) => ({
      ...row,
      $score: score,
    }))

    return Response.json(finalResults)
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private deserializeDataRow(row: Record<string, any>): Record<string, any> {
    return {
      id: row.id,
      type: row.type,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }

  private deserializeRelRow(row: Record<string, any>): Record<string, any> {
    return {
      from_id: row.from_id,
      relation: row.relation,
      to_id: row.to_id,
      metadata: row.metadata
        ? typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata
        : null,
      created_at: row.created_at,
    }
  }
}

/**
 * DatabaseService - WorkerEntrypoint for RPC access
 *
 * Provides `connect(namespace)` method that returns an RpcTarget service
 * with all database operations.
 *
 * When used standalone (in tests), uses an in-memory provider with namespace isolation.
 */
export class DatabaseService extends WorkerEntrypoint<Env> {
  /**
   * Connect to a namespace and get an RPC-enabled service
   *
   * @param namespace - The namespace to connect to (defaults to 'default')
   * @param options - Optional provider configuration
   * @returns DatabaseServiceCore instance for RPC calls
   */
  connect(namespace?: string, options?: MemoryProviderOptions): DatabaseServiceCore {
    return new DatabaseServiceCore(namespace ?? 'default', options)
  }
}

// WorkerEntrypoint IS the default export
export default DatabaseService

// Export aliases
export { DatabaseService as DatabaseWorker }
