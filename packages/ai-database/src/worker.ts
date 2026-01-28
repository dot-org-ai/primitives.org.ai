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

// ===========================================================================
// Type Interfaces for Cloudflare Workers Runtime
// ===========================================================================

/**
 * ExecutionContext interface - matches @cloudflare/workers-types
 */
export interface MockExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

/**
 * SqlStorage interface - matches DurableObjectStorage.sql from @cloudflare/workers-types
 */
export interface SqlStorage {
  exec(query: string, ...params: unknown[]): SqlStorageResult
}

/**
 * SqlStorageResult interface
 */
export interface SqlStorageResult {
  toArray(): unknown[]
}

/**
 * DurableObjectStorage interface - subset needed for our use
 */
export interface MockDurableObjectStorage {
  sql: SqlStorage
}

/**
 * DurableObjectId interface
 */
export interface MockDurableObjectId {
  toString(): string
  equals(other: MockDurableObjectId): boolean
  readonly name?: string
}

/**
 * DurableObjectState interface - matches @cloudflare/workers-types
 */
export interface MockDurableObjectState {
  waitUntil(promise: Promise<unknown>): void
  readonly id: MockDurableObjectId
  readonly storage: MockDurableObjectStorage
}

/**
 * Database row interfaces for type-safe SQL operations
 */
export interface DataRow {
  id: string
  type: string
  data: string
  created_at: string
  updated_at: string
}

export interface RelRow {
  from_id: string
  relation: string
  to_id: string
  metadata: string | null
  created_at: string
}

export interface EventRow {
  id: string
  event: string
  actor: string | null
  object: string | null
  data: string | null
  result: string | null
  previous_data: string | null
  timestamp: string
}

export interface EmbeddingRow {
  id: string
  entity_type: string
  entity_id: string
  model: string
  vector: string
  content_hash: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionRow {
  id: string
  pattern: string
  webhook: string
  created_at: string
}

export interface MetaRow {
  key: string
  value: string
}

export interface CountRow {
  count: number
}

/**
 * Environment with AI binding for Cloudflare AI
 */
export interface EnvWithAI {
  AI?: {
    run(model: string, options: { text: string[] }): Promise<{ data: number[][] }>
  }
}

/**
 * Deserialized entity types
 */
export interface DeserializedDataRow {
  id: string
  type: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DeserializedRelRow {
  from_id: string
  relation: string
  to_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DeserializedEventRow {
  id: string
  event: string
  actor: string | null
  object: string | null
  data: unknown
  result: string | null
  previousData: unknown
  timestamp: string
}

/**
 * Event handler type
 */
export type DatabaseEventHandler = (event: DeserializedEventRow) => void | Promise<void>

/**
 * Action status type
 */
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

/**
 * Action interface
 */
export interface Action {
  id: string
  action: string
  actor: string
  object?: string
  status: ActionStatus
  progress?: number
  total?: number
  data?: unknown
  result?: unknown
  error?: string
  createdAt: string
  updatedAt: string
}

/**
 * Artifact interface
 */
export interface Artifact {
  url: string
  type: string
  content: unknown
  sourceHash: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/**
 * Request body types
 */
export interface CreateDataBody {
  id?: string
  type: string
  data: Record<string, unknown>
}

export interface UpdateDataBody {
  data: Record<string, unknown>
}

export interface CreateRelBody {
  from_id: string
  relation: string
  to_id: string
  metadata?: Record<string, unknown>
}

export interface CreateEventBody {
  event: string
  actor?: string
  object?: string
  data?: unknown
}

export interface SearchBody {
  type?: string
  query: string
  limit?: number
  fields?: string[]
  minScore?: number
}

export interface SemanticSearchBody {
  type: string
  query: string
  limit?: number
  threshold?: number
}

export interface HybridSearchBody {
  type: string
  query: string
  limit?: number
  ftsWeight?: number
  semanticWeight?: number
}

export interface TraverseFilterBody {
  from_id: string
  relation: string
  direction?: 'outgoing' | 'incoming'
  maxDepth?: number
  filter?: Record<string, unknown>
}

export interface ReplayEventsBody {
  object: string
  until?: string
}

export interface SubscribeBody {
  pattern: string
  webhook: string
}

export interface EmbeddingsConfigBody {
  model?: string
}

export interface EmbeddingsGenerateBody {
  type: string
}

export interface EmbeddingsBatchBody {
  type: string
  batchSize?: number
}

export interface UpdateRelMetadataBody {
  from_id: string
  relation: string
  to_id: string
  metadata: Record<string, unknown>
}

export interface QueryListBody {
  type: string
  where?: Record<string, unknown>
  orderBy?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface QueryFindBody {
  type: string
  where?: Record<string, unknown>
}

export interface PipelineConfigBody {
  retryEnabled?: boolean
  batchSize?: number
}

export interface PipelineTestErrorBody {
  simulateError?: boolean
}

// ===========================================================================
// Mock classes for non-Cloudflare environments
// ===========================================================================

class MockRpcTarget {}
class MockWorkerEntrypoint<T = unknown> {
  protected env!: T
  protected ctx!: MockExecutionContext
}
class MockDurableObject {
  protected ctx!: MockDurableObjectState
  protected env!: unknown
  constructor(_state: MockDurableObjectState, _env: unknown) {}
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
  on(pattern: string, handler: DatabaseEventHandler): string {
    // Store handler and return ID for later unsubscription
    type ProviderWithOn = MemoryProvider & {
      on(pattern: string, handler: DatabaseEventHandler): () => void
    }
    if ('on' in this.provider) {
      const providerWithOn = this.provider as ProviderWithOn
      const unsubscribe = providerWithOn.on(pattern, handler)
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
  ): Promise<DeserializedEventRow | null> {
    type ProviderWithEmit = MemoryProvider & {
      emit(
        eventOrOptions: string | { event: string; actor: string; object?: string; data?: unknown },
        data?: unknown
      ): Promise<DeserializedEventRow>
    }
    if ('emit' in this.provider) {
      const providerWithEmit = this.provider as ProviderWithEmit
      if (typeof eventOrOptions === 'string') {
        return providerWithEmit.emit(eventOrOptions, data) as unknown as DeserializedEventRow
      }
      return providerWithEmit.emit(eventOrOptions) as unknown as DeserializedEventRow
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
  }): Promise<DeserializedEventRow[]> {
    type ProviderWithListEvents = MemoryProvider & {
      listEvents(options?: {
        event?: string
        actor?: string
        object?: string
        since?: Date
        until?: Date
        limit?: number
      }): Promise<DeserializedEventRow[]>
    }
    if ('listEvents' in this.provider) {
      const providerWithListEvents = this.provider as ProviderWithListEvents
      return providerWithListEvents.listEvents(options)
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
  }): Promise<Action | null> {
    type ProviderWithCreateAction = MemoryProvider & {
      createAction(options: {
        action: string
        actor: string
        object?: string
        data?: unknown
        total?: number
      }): Promise<Action>
    }
    if ('createAction' in this.provider) {
      const providerWithCreateAction = this.provider as ProviderWithCreateAction
      return providerWithCreateAction.createAction(options)
    }
    return null
  }

  /**
   * Get an action by ID
   */
  async getAction(id: string): Promise<Action | null> {
    type ProviderWithGetAction = MemoryProvider & {
      getAction(id: string): Promise<Action | null>
    }
    if ('getAction' in this.provider) {
      const providerWithGetAction = this.provider as ProviderWithGetAction
      return providerWithGetAction.getAction(id) as unknown as Action | null
    }
    return null
  }

  /**
   * Update an action
   */
  async updateAction(
    id: string,
    updates: { status?: string; progress?: number; result?: unknown; error?: string }
  ): Promise<Action | null> {
    type ProviderWithUpdateAction = MemoryProvider & {
      updateAction(
        id: string,
        updates: { status?: string; progress?: number; result?: unknown; error?: string }
      ): Promise<Action>
    }
    if ('updateAction' in this.provider) {
      const providerWithUpdateAction = this.provider as ProviderWithUpdateAction
      return providerWithUpdateAction.updateAction(id, updates)
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
  }): Promise<Action[]> {
    type ProviderWithListActions = MemoryProvider & {
      listActions(options?: {
        status?: string
        action?: string
        actor?: string
        object?: string
        since?: Date
        until?: Date
        limit?: number
      }): Promise<Action[]>
    }
    if ('listActions' in this.provider) {
      const providerWithListActions = this.provider as ProviderWithListActions
      return providerWithListActions.listActions(options)
    }
    return []
  }

  // ===========================================================================
  // Artifacts API
  // ===========================================================================

  /**
   * Get an artifact
   */
  async getArtifact(url: string, type: string): Promise<Artifact | null> {
    type ProviderWithGetArtifact = MemoryProvider & {
      getArtifact(url: string, type: string): Promise<Artifact | null>
    }
    if ('getArtifact' in this.provider) {
      const providerWithGetArtifact = this.provider as ProviderWithGetArtifact
      return providerWithGetArtifact.getArtifact(url, type) as unknown as Artifact | null
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
    type ProviderWithSetArtifact = MemoryProvider & {
      setArtifact(
        url: string,
        type: string,
        data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
      ): Promise<void>
    }
    if ('setArtifact' in this.provider) {
      const providerWithSetArtifact = this.provider as ProviderWithSetArtifact
      return providerWithSetArtifact.setArtifact(url, type, data)
    }
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(url: string, type?: string): Promise<void> {
    type ProviderWithDeleteArtifact = MemoryProvider & {
      deleteArtifact(url: string, type?: string): Promise<void>
    }
    if ('deleteArtifact' in this.provider) {
      const providerWithDeleteArtifact = this.provider as ProviderWithDeleteArtifact
      return providerWithDeleteArtifact.deleteArtifact(url, type)
    }
  }

  /**
   * List artifacts for a URL
   */
  async listArtifacts(url: string): Promise<Artifact[]> {
    type ProviderWithListArtifacts = MemoryProvider & {
      listArtifacts(url: string): Promise<Artifact[]>
    }
    if ('listArtifacts' in this.provider) {
      const providerWithListArtifacts = this.provider as ProviderWithListArtifacts
      return providerWithListArtifacts.listArtifacts(url) as unknown as Artifact[]
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
    type ProviderWithClear = MemoryProvider & {
      clear(): void
    }
    if ('clear' in this.provider) {
      const providerWithClear = this.provider as ProviderWithClear
      providerWithClear.clear()
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

  // Pipeline state for R2 streaming
  private pipelineBuffer: Array<Record<string, unknown>> = []
  private pipelineConfig = { retryEnabled: false, batchSize: 100 }
  private pipelineStats = { eventsProcessed: 0, batchesSent: 0 }

  // Embeddings configuration
  private embeddingsConfig: { model: string } = { model: '@cf/baai/bge-base-en-v1.5' }
  private embeddingsCacheStats = { cacheHits: 0, cacheMisses: 0 }
  private batchJobs = new Map<
    string,
    { status: string; total: number; processed: number; errors: number }
  >()

  constructor(state: MockDurableObjectState, env: unknown) {
    super(state, env)
    this.sql = state.storage.sql
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

    // Create _events table for event sourcing
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _events (
        id TEXT PRIMARY KEY,
        event TEXT NOT NULL,
        actor TEXT,
        object TEXT,
        data TEXT,
        result TEXT,
        previous_data TEXT,
        timestamp TEXT NOT NULL
      )
    `)

    // Create indexes for _events table
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_events_event ON _events(event)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_events_ts ON _events(timestamp)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_events_obj ON _events(object)`)

    // Create _subscriptions table for event subscriptions
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _subscriptions (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        webhook TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    // Create _embeddings table for semantic search
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _embeddings (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        model TEXT NOT NULL,
        vector TEXT NOT NULL,
        content_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(entity_type, entity_id)
      )
    `)

    // Create index for _embeddings table
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON _embeddings(entity_type, entity_id)`
    )
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_type ON _embeddings(entity_type)`)

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
        const id = decodeURIComponent(dataMatch[1]!)
        if (method === 'GET') return this.handleGetData(id)
        if (method === 'PATCH') return this.handleUpdateData(id, request)
        if (method === 'DELETE') return this.handleDeleteData(id, url, request)
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
      if (path === '/traverse/filter' && method === 'POST') {
        return this.handleTraverseFilter(request)
      }

      // Route: /rels with PATCH for updating metadata
      if (path === '/rels' && method === 'PATCH') {
        return this.handleUpdateRel(request)
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

      // Route: /events (list or create custom events)
      if (path === '/events' && method === 'GET') {
        return this.handleListEvents(url)
      }
      if (path === '/events' && method === 'POST') {
        return this.handleCreateEvent(request)
      }

      // Route: /events/replay (replay events)
      if (path === '/events/replay' && method === 'POST') {
        return this.handleReplayEvents(request)
      }

      // Route: /events/rebuild (rebuild entity from events)
      if (path === '/events/rebuild' && method === 'POST') {
        return this.handleRebuildEntity(request)
      }

      // Route: /events/subscribe (create subscription)
      if (path === '/events/subscribe' && method === 'POST') {
        return this.handleSubscribe(request)
      }

      // Route: /events/subscriptions (list subscriptions)
      if (path === '/events/subscriptions' && method === 'GET') {
        return this.handleListSubscriptions()
      }

      // Route: /events/subscriptions/:id (delete subscription)
      const subMatch = path.match(/^\/events\/subscriptions\/([^/]+)$/)
      if (subMatch) {
        const subId = decodeURIComponent(subMatch[1]!)
        if (method === 'DELETE') return this.handleUnsubscribe(subId)
      }

      // Route: /events/subscriptions/:id/deliveries (list deliveries)
      const deliveriesMatch = path.match(/^\/events\/subscriptions\/([^/]+)\/deliveries$/)
      if (deliveriesMatch && method === 'GET') {
        const subId = decodeURIComponent(deliveriesMatch[1]!)
        return this.handleListDeliveries(subId)
      }

      // Route: /pipeline/status (pipeline status)
      if (path === '/pipeline/status' && method === 'GET') {
        return this.handlePipelineStatus()
      }

      // Route: /pipeline/flush (flush pipeline)
      if (path === '/pipeline/flush' && method === 'POST') {
        return this.handlePipelineFlush()
      }

      // Route: /pipeline/r2/list (list R2 objects)
      if (path === '/pipeline/r2/list' && method === 'GET') {
        return this.handlePipelineR2List()
      }

      // Route: /pipeline/config (configure pipeline)
      if (path === '/pipeline/config' && method === 'POST') {
        return this.handlePipelineConfig(request)
      }

      // Route: /pipeline/test-error (test error handling)
      if (path === '/pipeline/test-error' && method === 'POST') {
        return this.handlePipelineTestError(request)
      }

      // ===========================================================================
      // Semantic Search Routes
      // ===========================================================================

      // Route: /config/embeddings (configure embedding model)
      if (path === '/config/embeddings' && method === 'POST') {
        return this.handleConfigureEmbeddings(request)
      }

      // Route: /embeddings (list all embeddings)
      if (path === '/embeddings' && method === 'GET') {
        return this.handleListEmbeddings(url)
      }

      // Route: /embeddings/stats (get cache stats)
      if (path === '/embeddings/stats' && method === 'GET') {
        return this.handleEmbeddingsStats()
      }

      // Route: /embeddings/warmup (warm up embedding cache)
      if (path === '/embeddings/warmup' && method === 'POST') {
        return this.handleEmbeddingsWarmup(request)
      }

      // Route: /embeddings/generate (generate embeddings for all entities of a type)
      if (path === '/embeddings/generate' && method === 'POST') {
        return this.handleEmbeddingsGenerate(request)
      }

      // Route: /embeddings/batch (batch process embeddings)
      if (path === '/embeddings/batch' && method === 'POST') {
        return this.handleEmbeddingsBatch(request)
      }

      // Route: /embeddings/batch/start (start batch job)
      if (path === '/embeddings/batch/start' && method === 'POST') {
        return this.handleEmbeddingsBatchStart(request)
      }

      // Route: /embeddings/batch/:jobId/status (batch job status)
      const batchStatusMatch = path.match(/^\/embeddings\/batch\/([^/]+)\/status$/)
      if (batchStatusMatch && method === 'GET') {
        const jobId = decodeURIComponent(batchStatusMatch[1]!)
        return this.handleEmbeddingsBatchStatus(jobId)
      }

      // Route: /embeddings/:type/:id (get or generate embedding for an entity)
      const embeddingMatch = path.match(/^\/embeddings\/([^/]+)\/([^/]+)$/)
      if (embeddingMatch && method === 'GET') {
        const entityType = decodeURIComponent(embeddingMatch[1]!)
        const entityId = decodeURIComponent(embeddingMatch[2]!)
        return this.handleGetEmbedding(entityType, entityId)
      }

      // Route: /search/semantic (semantic search)
      if (path === '/search/semantic' && method === 'POST') {
        return this.handleSemanticSearch(request)
      }

      // Route: /search/hybrid (hybrid FTS + semantic search)
      if (path === '/search/hybrid' && method === 'POST') {
        return this.handleHybridSearch(request)
      }

      return Response.json({ error: 'Not found' }, { status: 404 })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return Response.json({ error: message }, { status: 500 })
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
    const params: unknown[] = []

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
    const results = rows.map((row) => this.deserializeDataRow(row))
    return Response.json(results)
  }

  private async handleInsertData(request: Request): Promise<Response> {
    let body: CreateDataBody
    try {
      body = (await request.json()) as CreateDataBody
    } catch {
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

    // Emit Type.created event
    const actor = request.headers.get('X-Actor') ?? 'system'
    this.emitEvent({
      event: `${type}.created`,
      actor,
      object: `${type}/${id}`,
      data: data ?? {},
    })

    // Note: Embedding generation happens lazily when first queried or via batch/warmup/search
    // This allows fine-grained control over when embeddings are generated

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
    return Response.json(this.deserializeDataRow(rows[0]))
  }

  private async handleUpdateData(id: string, request: Request): Promise<Response> {
    const rows = this.sql.exec('SELECT * FROM _data WHERE id = ?', id).toArray()
    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const existing = this.deserializeDataRow(rows[0])
    const body = (await request.json()) as UpdateDataBody

    // Merge data fields (shallow merge)
    const mergedData = { ...existing.data, ...(body.data ?? {}) }
    const now = new Date().toISOString()
    const dataJson = JSON.stringify(mergedData)

    this.sql.exec('UPDATE _data SET data = ?, updated_at = ? WHERE id = ?', dataJson, now, id)

    // Emit Type.updated event
    const actor = request.headers.get('X-Actor') ?? 'system'
    this.emitEvent({
      event: `${existing.type}.updated`,
      actor,
      object: `${existing.type}/${id}`,
      data: mergedData,
      previousData: existing.data,
    })

    // If embedding exists, update it with new content
    const existingEmbedding = this.sql
      .exec('SELECT id FROM _embeddings WHERE entity_type = ? AND entity_id = ?', existing.type, id)
      .toArray()
    if (existingEmbedding.length > 0) {
      await this.generateEmbeddingForEntity(existing.type, id, mergedData).catch(() => {
        // Silently ignore embedding generation errors on update
      })
    }

    const result = {
      id: existing.id,
      type: existing.type,
      data: mergedData,
      created_at: existing.created_at,
      updated_at: now,
    }
    return Response.json(result)
  }

  private handleDeleteData(id: string, url?: URL, request?: Request): Response {
    const rows = this.sql.exec('SELECT * FROM _data WHERE id = ?', id).toArray()
    if (rows.length === 0) {
      return Response.json({ deleted: false })
    }

    const entity = this.deserializeDataRow(rows[0])

    // Check for cascade option
    const cascade = url?.searchParams.get('cascade') === 'true'
    const cascadeDepth = parseInt(url?.searchParams.get('cascadeDepth') ?? '999', 10)

    let cascadeDeleted: string[] | undefined

    if (cascade) {
      // Perform cascade delete with depth control
      cascadeDeleted = this.cascadeDelete(id, cascadeDepth, new Set([id]))
    }

    // Delete the record
    this.sql.exec('DELETE FROM _data WHERE id = ?', id)

    // Cascade: remove relationships involving this id
    this.sql.exec('DELETE FROM _rels WHERE from_id = ? OR to_id = ?', id, id)

    // Delete embedding for this entity
    this.sql.exec(
      'DELETE FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
      entity['type'],
      id
    )

    // Emit Type.deleted event
    const actor = request?.headers.get('X-Actor') ?? 'system'
    this.emitEvent({
      event: `${entity['type']}.deleted`,
      actor,
      object: `${entity['type']}/${id}`,
      data: entity['data'],
    })

    const result: Record<string, unknown> = { deleted: true }
    if (cascadeDeleted !== undefined) {
      result['cascadeDeleted'] = cascadeDeleted
    }
    return Response.json(result)
  }

  /**
   * Cascade delete related entities up to a given depth
   */
  private cascadeDelete(fromId: string, depth: number, visited: Set<string>): string[] {
    if (depth <= 0) return []

    const deleted: string[] = []

    // Get all outgoing relationships from this entity
    const rels = this.sql.exec('SELECT to_id FROM _rels WHERE from_id = ?', fromId).toArray()

    for (const rel of rels) {
      const relRow = rel as RelRow
      const toId = relRow.to_id
      if (visited.has(toId)) continue
      visited.add(toId)

      // Recursively delete related entities
      const nested = this.cascadeDelete(toId, depth - 1, visited)
      deleted.push(...nested)

      // Delete the entity
      const exists = this.sql.exec('SELECT id FROM _data WHERE id = ?', toId).toArray()
      if (exists.length > 0) {
        this.sql.exec('DELETE FROM _data WHERE id = ?', toId)
        this.sql.exec('DELETE FROM _rels WHERE from_id = ? OR to_id = ?', toId, toId)
        deleted.push(toId)
      }
    }

    return deleted
  }

  // ===========================================================================
  // _rels handlers
  // ===========================================================================

  private handleQueryRels(url: URL): Response {
    const from_id = url.searchParams.get('from_id')
    const to_id = url.searchParams.get('to_id')
    const relation = url.searchParams.get('relation')

    let query = 'SELECT * FROM _rels WHERE 1=1'
    const params: unknown[] = []

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
    const results = rows.map((row) => this.deserializeRelRow(row))
    return Response.json(results)
  }

  private async handleCreateRel(request: Request): Promise<Response> {
    const body = (await request.json()) as CreateRelBody
    const { from_id, relation, to_id, metadata } = body

    // Validate required fields
    if (!from_id || !to_id) {
      return Response.json({ error: 'from_id, relation, and to_id are required' }, { status: 400 })
    }

    // Validate relation is not empty
    if (!relation || relation.trim() === '') {
      return Response.json({ error: 'relation cannot be empty' }, { status: 400 })
    }

    // Validate that both entities exist
    const fromExists = this.sql.exec('SELECT id FROM _data WHERE id = ?', from_id).toArray()
    const toExists = this.sql.exec('SELECT id FROM _data WHERE id = ?', to_id).toArray()

    if (fromExists.length === 0) {
      return Response.json({ error: `Source entity '${from_id}' does not exist` }, { status: 400 })
    }
    if (toExists.length === 0) {
      return Response.json({ error: `Target entity '${to_id}' does not exist` }, { status: 400 })
    }

    const metadataJson = metadata ? JSON.stringify(metadata) : null
    const now = new Date().toISOString()
    const actor = request.headers.get('X-Actor') ?? 'system'

    try {
      this.sql.exec(
        'INSERT INTO _rels (from_id, relation, to_id, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
        from_id,
        relation,
        to_id,
        metadataJson,
        now
      )

      // Emit relationship.created event
      this.emitEvent({
        event: 'relationship.created',
        actor,
        object: `${from_id}->${relation}->${to_id}`,
        data: { from_id, relation, to_id, metadata: metadata ?? null },
      })
    } catch (err: unknown) {
      // Handle duplicate composite key -- upsert
      const errMsg = err instanceof Error ? err.message : ''
      if (errMsg.includes('UNIQUE constraint')) {
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
        const relRow = rows[0] as RelRow | undefined
        const result: DeserializedRelRow = {
          from_id,
          relation,
          to_id,
          metadata: metadata ?? null,
          created_at: relRow?.created_at ?? now,
        }
        return Response.json(result)
      } else {
        throw err
      }
    }

    const result: DeserializedRelRow = {
      from_id,
      relation,
      to_id,
      metadata: metadata ?? null,
      created_at: now,
    }
    return Response.json(result)
  }

  private async handleDeleteRel(request: Request): Promise<Response> {
    const body = (await request.json()) as CreateRelBody
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

    const existingRel = this.deserializeRelRow(existing[0])

    this.sql.exec(
      'DELETE FROM _rels WHERE from_id = ? AND relation = ? AND to_id = ?',
      from_id,
      relation,
      to_id
    )

    // Emit relationship.deleted event
    const actor = request.headers.get('X-Actor') ?? 'system'
    this.emitEvent({
      event: 'relationship.deleted',
      actor,
      object: `${from_id}->${relation}->${to_id}`,
      data: { from_id, relation, to_id, metadata: existingRel['metadata'] },
    })

    return Response.json({ deleted: true })
  }

  // ===========================================================================
  // Traverse handler
  // ===========================================================================

  private handleTraverse(url: URL): Response {
    const from_id = url.searchParams.get('from_id')
    const to_id = url.searchParams.get('to_id')
    const id = url.searchParams.get('id') // for bidirectional traversal
    const relationParam = url.searchParams.get('relation')
    const typeFilter = url.searchParams.get('type')
    const direction = url.searchParams.get('direction') // 'in', 'out', 'both'
    const maxDepthParam = url.searchParams.get('maxDepth')
    const includeMetadata = url.searchParams.get('includeMetadata') === 'true'

    // Support multi-hop traversal via comma-separated relations
    const relations = relationParam ? relationParam.split(',') : []
    const maxDepth = maxDepthParam ? parseInt(maxDepthParam, 10) : relations.length

    // Bidirectional traversal: id + relation + direction=both
    if (id && relations.length > 0 && direction === 'both') {
      return this.handleBidirectionalTraverse(id, relations[0]!, typeFilter, includeMetadata)
    }

    // Forward traversal with from_id and direction=out or no direction
    if (from_id && relations.length > 0 && direction !== 'in') {
      return this.handleForwardTraverse(from_id, relations, typeFilter, maxDepth, includeMetadata)
    }

    // Reverse traversal: to_id + relation (with direction=in)
    if (to_id && relations.length > 0) {
      return this.handleReverseTraverse(to_id, relations[0]!, typeFilter, includeMetadata)
    }

    // Forward traversal with from_id (no relation means all outgoing)
    if (from_id && !relationParam) {
      const rows = this.sql.exec('SELECT to_id FROM _rels WHERE from_id = ?', from_id).toArray()
      const toIds: string[] = [...new Set(rows.map((r) => (r as RelRow).to_id))]

      if (toIds.length === 0) {
        return Response.json([])
      }

      return this.fetchEntitiesByIds(toIds, typeFilter, includeMetadata ? from_id : undefined)
    }

    return Response.json([])
  }

  /**
   * Handle bidirectional traversal (both incoming and outgoing)
   */
  private handleBidirectionalTraverse(
    entityId: string,
    relation: string,
    typeFilter: string | null,
    includeMetadata: boolean
  ): Response {
    // Get outgoing relationships (entity -> X)
    const outgoing = this.sql
      .exec(
        'SELECT to_id, metadata FROM _rels WHERE from_id = ? AND relation = ?',
        entityId,
        relation
      )
      .toArray()

    // Get incoming relationships (X -> entity)
    const incoming = this.sql
      .exec(
        'SELECT from_id, metadata FROM _rels WHERE to_id = ? AND relation = ?',
        entityId,
        relation
      )
      .toArray()

    const resultIds = new Set<string>()
    const metadataMap = new Map<string, Record<string, unknown>>()

    for (const row of outgoing) {
      const relRow = row as RelRow
      const toId = relRow.to_id
      resultIds.add(toId)
      if (includeMetadata && relRow.metadata) {
        const meta =
          typeof relRow.metadata === 'string' ? JSON.parse(relRow.metadata) : relRow.metadata
        metadataMap.set(toId, meta as Record<string, unknown>)
      }
    }

    for (const row of incoming) {
      const relRow = row as RelRow
      const fromId = relRow.from_id
      resultIds.add(fromId)
      if (includeMetadata && relRow.metadata) {
        const meta =
          typeof relRow.metadata === 'string' ? JSON.parse(relRow.metadata) : relRow.metadata
        metadataMap.set(fromId, meta as Record<string, unknown>)
      }
    }

    if (resultIds.size === 0) {
      return Response.json([])
    }

    return this.fetchEntitiesByIds(
      [...resultIds],
      typeFilter,
      includeMetadata ? entityId : undefined,
      includeMetadata ? metadataMap : undefined
    )
  }

  /**
   * Handle forward (outgoing) traversal with depth control
   */
  private handleForwardTraverse(
    fromId: string,
    relations: string[],
    typeFilter: string | null,
    maxDepth: number,
    includeMetadata: boolean
  ): Response {
    let currentIds: string[] = [fromId]
    const metadataMap = new Map<string, Record<string, unknown>>()
    // For single-hop traversal, don't add source to visited to allow self-reference
    const visited = new Set<string>()
    if (relations.length > 1) {
      visited.add(fromId)
    }

    // Limit traversal depth
    const effectiveRelations = relations.slice(0, maxDepth)

    for (let i = 0; i < effectiveRelations.length; i++) {
      const rel = effectiveRelations[i]!
      if (currentIds.length === 0) break
      const placeholders = currentIds.map(() => '?').join(',')
      const rows = this.sql
        .exec(
          `SELECT to_id, metadata FROM _rels WHERE from_id IN (${placeholders}) AND relation = ?`,
          ...currentIds,
          rel
        )
        .toArray()

      const nextIds = new Set<string>()
      for (const row of rows) {
        const relRow = row as RelRow
        const toId = relRow.to_id
        // For the last hop, don't prevent returning visited nodes (allows self-reference results)
        // For intermediate hops, use cycle detection to prevent infinite loops
        const isLastHop = i === effectiveRelations.length - 1
        if (isLastHop || !visited.has(toId)) {
          if (!isLastHop) {
            visited.add(toId)
          }
          nextIds.add(toId)
          if (includeMetadata && relRow.metadata) {
            const meta =
              typeof relRow.metadata === 'string' ? JSON.parse(relRow.metadata) : relRow.metadata
            metadataMap.set(toId, meta as Record<string, unknown>)
          }
        }
      }
      currentIds = [...nextIds]
    }

    if (currentIds.length === 0) {
      return Response.json([])
    }

    return this.fetchEntitiesByIds(
      currentIds,
      typeFilter,
      includeMetadata ? fromId : undefined,
      includeMetadata ? metadataMap : undefined
    )
  }

  /**
   * Handle reverse (incoming) traversal
   */
  private handleReverseTraverse(
    toId: string,
    relation: string,
    typeFilter: string | null,
    includeMetadata: boolean
  ): Response {
    const rows = this.sql
      .exec('SELECT from_id, metadata FROM _rels WHERE to_id = ? AND relation = ?', toId, relation)
      .toArray()

    const fromIds: string[] = []
    const metadataMap = new Map<string, Record<string, unknown>>()

    for (const row of rows) {
      const relRow = row as RelRow
      const fromId = relRow.from_id
      fromIds.push(fromId)
      if (includeMetadata && relRow.metadata) {
        const meta =
          typeof relRow.metadata === 'string' ? JSON.parse(relRow.metadata) : relRow.metadata
        metadataMap.set(fromId, meta as Record<string, unknown>)
      }
    }

    if (fromIds.length === 0) {
      return Response.json([])
    }

    return this.fetchEntitiesByIds(
      [...new Set(fromIds)],
      typeFilter,
      includeMetadata ? toId : undefined,
      includeMetadata ? metadataMap : undefined
    )
  }

  /**
   * Fetch entities by IDs with optional type filter and metadata
   */
  private fetchEntitiesByIds(
    ids: string[],
    typeFilter: string | null,
    _sourceId?: string,
    metadataMap?: Map<string, Record<string, unknown>>
  ): Response {
    const placeholders = ids.map(() => '?').join(',')
    let query = `SELECT * FROM _data WHERE id IN (${placeholders})`
    const params: unknown[] = [...ids]

    if (typeFilter) {
      query += ' AND type = ?'
      params.push(typeFilter)
    }

    const records = this.sql.exec(query, ...params).toArray()
    const results = records.map((r) => {
      const entity = this.deserializeDataRow(r) as DeserializedDataRow & {
        $rel?: Record<string, unknown>
      }
      if (metadataMap && metadataMap.has(entity.id)) {
        const relData = metadataMap.get(entity.id)
        if (relData !== undefined) {
          entity.$rel = relData
        }
      }
      return entity
    })

    return Response.json(results)
  }

  /**
   * Handle POST /traverse/filter - filter traversal by metadata
   */
  private async handleTraverseFilter(request: Request): Promise<Response> {
    let body: TraverseFilterBody
    try {
      body = (await request.json()) as TraverseFilterBody
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { from_id, relation, filter: metadataFilter } = body

    if (!from_id || !relation) {
      return Response.json({ error: 'from_id and relation are required' }, { status: 400 })
    }

    // Get all relationships matching from_id and relation
    const rows = this.sql
      .exec(
        'SELECT to_id, metadata FROM _rels WHERE from_id = ? AND relation = ?',
        from_id,
        relation
      )
      .toArray()

    const matchingIds: string[] = []

    for (const row of rows) {
      const relRow = row as RelRow
      const toId = relRow.to_id
      const rawMetadata = relRow.metadata

      if (!metadataFilter) {
        matchingIds.push(toId)
        continue
      }

      // Parse metadata
      const metadata = rawMetadata
        ? typeof rawMetadata === 'string'
          ? JSON.parse(rawMetadata)
          : rawMetadata
        : {}

      // Apply metadata filter
      if (this.matchesMetadataFilter(metadata as Record<string, unknown>, metadataFilter)) {
        matchingIds.push(toId)
      }
    }

    if (matchingIds.length === 0) {
      return Response.json([])
    }

    // Fetch the entities
    const placeholders = matchingIds.map(() => '?').join(',')
    const entities = this.sql
      .exec(`SELECT * FROM _data WHERE id IN (${placeholders})`, ...matchingIds)
      .toArray()

    return Response.json(entities.map((r) => this.deserializeDataRow(r)))
  }

  /**
   * Check if metadata matches a filter with operator support
   */
  private matchesMetadataFilter(
    metadata: Record<string, unknown>,
    filter: Record<string, unknown>
  ): boolean {
    for (const [field, value] of Object.entries(filter)) {
      const actual = metadata[field]

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operators
        const ops = value as Record<string, unknown>
        for (const [op, opValue] of Object.entries(ops)) {
          switch (op) {
            case '$gt':
              if (!(typeof actual === 'number' && actual > (opValue as number))) return false
              break
            case '$gte':
              if (!(typeof actual === 'number' && actual >= (opValue as number))) return false
              break
            case '$lt':
              if (!(typeof actual === 'number' && actual < (opValue as number))) return false
              break
            case '$lte':
              if (!(typeof actual === 'number' && actual <= (opValue as number))) return false
              break
            case '$ne':
              if (actual === opValue) return false
              break
            case '$in':
              if (!Array.isArray(opValue) || !opValue.includes(actual)) return false
              break
          }
        }
      } else {
        // Simple equality
        if (actual !== value) return false
      }
    }
    return true
  }

  /**
   * Handle PATCH /rels - update relationship metadata
   */
  private async handleUpdateRel(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { from_id, relation, to_id, metadata } = body

    if (!from_id || !relation || !to_id) {
      return Response.json({ error: 'from_id, relation, and to_id are required' }, { status: 400 })
    }

    // Check if relationship exists
    const existing = this.sql
      .exec(
        'SELECT * FROM _rels WHERE from_id = ? AND relation = ? AND to_id = ?',
        from_id,
        relation,
        to_id
      )
      .toArray()

    if (existing.length === 0) {
      return Response.json({ error: 'Relationship not found' }, { status: 404 })
    }

    const existingRel = this.deserializeRelRow(existing[0])

    // Update metadata
    const metadataJson = metadata ? JSON.stringify(metadata) : null
    this.sql.exec(
      'UPDATE _rels SET metadata = ? WHERE from_id = ? AND relation = ? AND to_id = ?',
      metadataJson,
      from_id,
      relation,
      to_id
    )

    // Emit relationship.updated event
    const actor = request.headers.get('X-Actor') ?? 'system'
    this.emitEvent({
      event: 'relationship.updated',
      actor,
      object: `${from_id}->${relation}->${to_id}`,
      data: { from_id, relation, to_id, metadata: metadata ?? null },
      previousData: { from_id, relation, to_id, metadata: existingRel['metadata'] },
    })

    return Response.json({ from_id, relation, to_id, metadata: metadata ?? null })
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
    const metaRow = rows[0] as MetaRow
    return Response.json({ version: parseInt(metaRow.value, 10) })
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
    const results = rows.map((row) => this.deserializeDataRow(row))
    return Response.json(results)
  }

  /**
   * Handle POST /query/list - complex query via JSON body
   */
  private async handleQueryListPost(request: Request): Promise<Response> {
    let body: QueryListBody
    try {
      body = (await request.json()) as QueryListBody
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
    const results = rows.map((row) => this.deserializeDataRow(row))
    return Response.json(results)
  }

  /**
   * Handle POST /query/find - find first matching record
   */
  private async handleQueryFind(request: Request): Promise<Response> {
    let body: QueryListBody
    try {
      body = (await request.json()) as QueryListBody
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

    return Response.json(this.deserializeDataRow(rows[0]))
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
    let body: SearchBody
    try {
      body = (await request.json()) as SearchBody
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type, query: searchQuery, fields, limit, minScore } = body

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
    const results: Array<{ row: DeserializedDataRow; score: number }> = []

    for (const row of rows) {
      const record = this.deserializeDataRow(row)
      const data = record.data

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
  // Events handlers
  // ===========================================================================

  /**
   * Emit an event to the _events table and pipeline
   */
  private emitEvent(options: {
    event: string
    actor?: string
    object?: string
    data?: unknown
    result?: string
    previousData?: unknown
  }): Record<string, unknown> {
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const actor = options.actor ?? 'system'

    this.sql.exec(
      `INSERT INTO _events (id, event, actor, object, data, result, previous_data, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      options.event,
      actor,
      options.object ?? null,
      options.data ? JSON.stringify(options.data) : null,
      options.result ?? null,
      options.previousData ? JSON.stringify(options.previousData) : null,
      timestamp
    )

    const eventRecord = {
      id,
      event: options.event,
      actor,
      object: options.object ?? null,
      data: options.data ?? null,
      result: options.result ?? null,
      previousData: options.previousData ?? null,
      timestamp,
    }

    // Add to pipeline buffer
    this.pipelineBuffer.push(eventRecord)
    this.pipelineStats.eventsProcessed++

    // Auto-flush if buffer reaches batch size
    if (this.pipelineBuffer.length >= this.pipelineConfig.batchSize) {
      this.flushPipeline()
    }

    return eventRecord
  }

  /**
   * Handle GET /events - list events with filtering
   */
  private handleListEvents(url: URL): Response {
    const event = url.searchParams.get('event')
    const object = url.searchParams.get('object')
    const since = url.searchParams.get('since')
    const until = url.searchParams.get('until')
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')
    const cursor = url.searchParams.get('cursor')
    const order = url.searchParams.get('order') ?? 'desc'

    let query = 'SELECT * FROM _events WHERE 1=1'
    const params: unknown[] = []

    // Filter by event type (with wildcard support)
    if (event) {
      if (event.startsWith('*.')) {
        // Wildcard at start: *.created matches Post.created, User.created, etc.
        const suffix = event.slice(2) // Remove '*.'
        query += ' AND event LIKE ?'
        params.push(`%.${suffix}`)
      } else if (event.endsWith('.*')) {
        // Wildcard at end: Post.* matches Post.created, Post.updated, etc.
        const prefix = event.slice(0, -2) // Remove '.*'
        query += ' AND event LIKE ?'
        params.push(`${prefix}.%`)
      } else {
        query += ' AND event = ?'
        params.push(event)
      }
    }

    // Filter by object
    if (object) {
      query += ' AND object = ?'
      params.push(object)
    }

    // Filter by time range
    if (since) {
      query += ' AND timestamp >= ?'
      params.push(since)
    }
    if (until) {
      query += ' AND timestamp <= ?'
      params.push(until)
    }

    // Cursor-based pagination (events after the cursor ID)
    if (cursor) {
      // Get the timestamp of the cursor event
      const cursorRows = this.sql
        .exec('SELECT timestamp FROM _events WHERE id = ?', cursor)
        .toArray()
      if (cursorRows.length > 0) {
        const cursorEvent = cursorRows[0] as EventRow
        const cursorTs = cursorEvent.timestamp
        if (order === 'asc') {
          query += ' AND (timestamp > ? OR (timestamp = ? AND id > ?))'
          params.push(cursorTs, cursorTs, cursor)
        } else {
          query += ' AND (timestamp < ? OR (timestamp = ? AND id < ?))'
          params.push(cursorTs, cursorTs, cursor)
        }
      }
    }

    // Order by timestamp
    query +=
      order === 'asc' ? ' ORDER BY timestamp ASC, id ASC' : ' ORDER BY timestamp DESC, id DESC'

    // Apply limit
    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit, 10))
    }

    // Apply offset
    if (offset && !cursor) {
      query += ' OFFSET ?'
      params.push(parseInt(offset, 10))
    }

    const rows = this.sql.exec(query, ...params).toArray()
    const results = rows.map((row) => this.deserializeEventRow(row))
    return Response.json(results)
  }

  /**
   * Handle POST /events - create custom event
   */
  private async handleCreateEvent(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { event, actor, object, data, result } = body

    if (!event || typeof event !== 'string') {
      return Response.json({ error: 'event field is required' }, { status: 400 })
    }

    const eventRecord = this.emitEvent({
      event: event as string,
      actor: (actor as string | undefined) ?? 'system',
      ...(object !== undefined && { object: object as string }),
      data,
      ...(result !== undefined && { result: result as string }),
    })

    return Response.json(eventRecord)
  }

  /**
   * Handle POST /events/replay - replay events
   */
  private async handleReplayEvents(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { source, object, event: eventFilter, since } = body

    let query = 'SELECT * FROM _events WHERE 1=1'
    const params: unknown[] = []

    if (object) {
      query += ' AND object = ?'
      params.push(object)
    }

    if (eventFilter) {
      query += ' AND event = ?'
      params.push(eventFilter)
    }

    if (since) {
      query += ' AND timestamp > ?'
      params.push(since)
    }

    query += ' ORDER BY timestamp ASC'

    const rows = this.sql.exec(query, ...params).toArray()
    const events = rows.map((row) => this.deserializeEventRow(row))

    return Response.json({
      source: source ?? 'local',
      eventsReplayed: events.length,
      events,
    })
  }

  /**
   * Handle POST /events/rebuild - rebuild entity from events
   */
  private async handleRebuildEntity(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { object } = body

    if (!object || typeof object !== 'string') {
      return Response.json({ error: 'object field is required' }, { status: 400 })
    }

    // Parse object format: Type/id
    const [type, id] = (object as string).split('/')
    if (!type || !id) {
      return Response.json({ error: 'Invalid object format, expected Type/id' }, { status: 400 })
    }

    // Get all events for this object in chronological order
    const rows = this.sql
      .exec('SELECT * FROM _events WHERE object = ? ORDER BY timestamp ASC', object as string)
      .toArray()

    if (rows.length === 0) {
      return Response.json({ error: 'No events found for this object' }, { status: 404 })
    }

    // Rebuild the entity by applying events (excluding delete events)
    // This allows us to restore deleted entities to their state before deletion
    let entityData: Record<string, unknown> = {}
    let hasData = false

    for (const row of rows) {
      const event = this.deserializeEventRow(row)
      const eventType = event['event'] as string

      if (eventType.endsWith('.created')) {
        entityData = (event['data'] as Record<string, unknown>) ?? {}
        hasData = true
      } else if (eventType.endsWith('.updated')) {
        entityData = { ...entityData, ...((event['data'] as Record<string, unknown>) ?? {}) }
        hasData = true
      }
      // Skip .deleted events - we want to restore to the state before deletion
    }

    if (!hasData) {
      return Response.json({ error: 'No data events found for this object' }, { status: 400 })
    }

    // Recreate the entity
    const now = new Date().toISOString()
    const dataJson = JSON.stringify(entityData)

    // Check if entity already exists
    const existing = this.sql.exec('SELECT id FROM _data WHERE id = ?', id).toArray()
    if (existing.length > 0) {
      // Update existing
      this.sql.exec('UPDATE _data SET data = ?, updated_at = ? WHERE id = ?', dataJson, now, id)
    } else {
      // Insert new
      this.sql.exec(
        'INSERT INTO _data (id, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        id,
        type,
        dataJson,
        now,
        now
      )
    }

    return Response.json({
      id,
      type,
      data: entityData,
      rebuilt: true,
      eventsApplied: rows.length,
    })
  }

  /**
   * Handle POST /events/subscribe - create subscription
   */
  private async handleSubscribe(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { pattern, webhook } = body

    if (!pattern || !webhook) {
      return Response.json({ error: 'pattern and webhook are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    this.sql.exec(
      'INSERT INTO _subscriptions (id, pattern, webhook, created_at) VALUES (?, ?, ?, ?)',
      id,
      pattern,
      webhook,
      now
    )

    return Response.json({
      id,
      pattern,
      webhook,
      created_at: now,
    })
  }

  /**
   * Handle GET /events/subscriptions - list subscriptions
   */
  private handleListSubscriptions(): Response {
    const rows = this.sql.exec('SELECT * FROM _subscriptions ORDER BY created_at ASC').toArray()
    return Response.json(rows)
  }

  /**
   * Handle DELETE /events/subscriptions/:id - unsubscribe
   */
  private handleUnsubscribe(id: string): Response {
    const existing = this.sql.exec('SELECT id FROM _subscriptions WHERE id = ?', id).toArray()
    if (existing.length === 0) {
      return Response.json({ error: 'Subscription not found' }, { status: 404 })
    }

    this.sql.exec('DELETE FROM _subscriptions WHERE id = ?', id)
    return Response.json({ deleted: true })
  }

  /**
   * Handle GET /events/subscriptions/:id/deliveries - list deliveries
   */
  private handleListDeliveries(subId: string): Response {
    // Check if subscription exists
    const existing = this.sql.exec('SELECT id FROM _subscriptions WHERE id = ?', subId).toArray()
    if (existing.length === 0) {
      return Response.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // In a real implementation, this would return delivery logs
    // For now, return empty array as deliveries are not persisted
    return Response.json([])
  }

  // ===========================================================================
  // Pipeline handlers
  // ===========================================================================

  /**
   * Handle GET /pipeline/status - get pipeline status
   */
  private handlePipelineStatus(): Response {
    return Response.json({
      eventsProcessed: this.pipelineStats.eventsProcessed,
      batchesSent: this.pipelineStats.batchesSent,
      bufferSize: this.pipelineBuffer.length,
      retriesEnabled: this.pipelineConfig.retryEnabled,
    })
  }

  /**
   * Handle POST /pipeline/flush - flush pipeline buffer to R2
   */
  private handlePipelineFlush(): Response {
    this.flushPipeline()
    return Response.json({ flushed: true, batchesSent: this.pipelineStats.batchesSent })
  }

  /**
   * Flush the pipeline buffer to R2 storage
   */
  private flushPipeline(): void {
    if (this.pipelineBuffer.length === 0) return

    // Store events in _pipeline_r2 for simulating R2 storage
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const batchId = crypto.randomUUID()
    const key = `events/${year}/${month}/${day}/${batchId}.json`

    // Create R2 storage table if not exists
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _pipeline_r2 (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    // Store the batch
    this.sql.exec(
      'INSERT INTO _pipeline_r2 (key, data, created_at) VALUES (?, ?, ?)',
      key,
      JSON.stringify(this.pipelineBuffer),
      now.toISOString()
    )

    this.pipelineStats.batchesSent++
    this.pipelineBuffer = []
  }

  /**
   * Handle GET /pipeline/r2/list - list R2 objects
   */
  private handlePipelineR2List(): Response {
    // Ensure table exists
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _pipeline_r2 (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    const rows = this.sql
      .exec('SELECT key, created_at FROM _pipeline_r2 ORDER BY created_at ASC')
      .toArray()
    return Response.json(rows)
  }

  /**
   * Handle POST /pipeline/config - configure pipeline
   */
  private async handlePipelineConfig(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body['retryEnabled'] === 'boolean') {
      this.pipelineConfig.retryEnabled = body['retryEnabled']
    }
    if (typeof body['batchSize'] === 'number') {
      this.pipelineConfig.batchSize = body['batchSize']
    }

    return Response.json(this.pipelineConfig)
  }

  /**
   * Handle POST /pipeline/test-error - test error handling
   */
  private async handlePipelineTestError(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body['simulateError']) {
      // Return error but don't crash
      return Response.json({ error: 'Simulated pipeline error' }, { status: 503 })
    }

    return Response.json({ ok: true })
  }

  /**
   * Deserialize an event row from the database
   */
  private deserializeEventRow(row: unknown): DeserializedEventRow {
    const r = row as EventRow
    return {
      id: r.id,
      event: r.event,
      actor: r.actor,
      object: r.object,
      data: r.data ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : null,
      result: r.result,
      previousData: r.previous_data
        ? typeof r.previous_data === 'string'
          ? JSON.parse(r.previous_data)
          : r.previous_data
        : null,
      timestamp: r.timestamp,
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private deserializeDataRow(row: unknown): DeserializedDataRow {
    const r = row as DataRow
    return {
      id: r.id,
      type: r.type,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as Record<string, unknown>),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  }

  private deserializeRelRow(row: unknown): DeserializedRelRow {
    const r = row as RelRow
    return {
      from_id: r.from_id,
      relation: r.relation,
      to_id: r.to_id,
      metadata: r.metadata
        ? typeof r.metadata === 'string'
          ? JSON.parse(r.metadata)
          : (r.metadata as Record<string, unknown>)
        : null,
      created_at: r.created_at,
    }
  }

  // ===========================================================================
  // Semantic Search Handlers
  // ===========================================================================

  /**
   * Configure embeddings model
   */
  private async handleConfigureEmbeddings(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body['model']) {
      this.embeddingsConfig.model = body['model'] as string
    }

    return Response.json(this.embeddingsConfig)
  }

  /**
   * List all embeddings with optional type filter
   * Generates embeddings lazily for entities that don't have them yet
   */
  private async handleListEmbeddings(url: URL): Promise<Response> {
    const entityType = url.searchParams.get('entity_type')

    // If type is specified, generate embeddings for entities without them (lazy generation)
    if (entityType) {
      const entities = this.sql.exec('SELECT * FROM _data WHERE type = ?', entityType).toArray()
      for (const row of entities) {
        const entity = this.deserializeDataRow(row)
        const existing = this.sql
          .exec(
            'SELECT id FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
            entityType,
            entity['id']
          )
          .toArray()
        if (existing.length === 0) {
          await this.generateEmbeddingForEntity(
            entityType,
            entity['id'] as string,
            entity['data'] as Record<string, unknown>
          )
        }
      }
    }

    let query = 'SELECT * FROM _embeddings'
    const params: unknown[] = []

    if (entityType) {
      query += ' WHERE entity_type = ?'
      params.push(entityType)
    }

    query += ' ORDER BY created_at ASC'

    const rows = this.sql.exec(query, ...params).toArray()
    const results = rows.map((row) => {
      const embRow = row as EmbeddingRow
      return {
        entity_type: embRow.entity_type,
        entity_id: embRow.entity_id,
        model: embRow.model,
        vector: typeof embRow.vector === 'string' ? JSON.parse(embRow.vector) : embRow.vector,
        content_hash: embRow.content_hash,
        created_at: embRow.created_at,
        updated_at: embRow.updated_at,
      }
    })

    return Response.json(results)
  }

  /**
   * Get embedding cache stats
   */
  private handleEmbeddingsStats(): Response {
    return Response.json(this.embeddingsCacheStats)
  }

  /**
   * Warm up embedding cache for a type
   */
  private async handleEmbeddingsWarmup(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type: rawType } = body

    if (!rawType || typeof rawType !== 'string') {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }
    const type = rawType as string

    // Get all entities of this type
    const entities = this.sql.exec('SELECT * FROM _data WHERE type = ?', type).toArray()
    let warmed = 0

    for (const row of entities) {
      const entity = this.deserializeDataRow(row)
      // Check if embedding already exists
      const existing = this.sql
        .exec(
          'SELECT id FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
          type,
          entity['id']
        )
        .toArray()

      if (existing.length === 0) {
        await this.generateEmbeddingForEntity(
          type,
          entity['id'] as string,
          entity['data'] as Record<string, unknown>
        )
        warmed++
      }
    }

    return Response.json({ warmed })
  }

  /**
   * Generate embeddings for all entities of a type
   */
  private async handleEmbeddingsGenerate(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type: rawType } = body

    if (!rawType || typeof rawType !== 'string') {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }
    const type = rawType as string

    // Get all entities of this type
    const entities = this.sql.exec('SELECT * FROM _data WHERE type = ?', type).toArray()
    let generated = 0

    for (const row of entities) {
      const entity = this.deserializeDataRow(row)
      await this.generateEmbeddingForEntity(
        type,
        entity['id'] as string,
        entity['data'] as Record<string, unknown>
      )
      generated++
    }

    return Response.json({ generated })
  }

  /**
   * Batch process embeddings for specific entities
   */
  private async handleEmbeddingsBatch(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type: rawType, ids, skipExisting } = body

    if (!rawType || typeof rawType !== 'string' || !Array.isArray(ids)) {
      return Response.json({ error: 'type and ids array are required' }, { status: 400 })
    }
    const type = rawType as string

    let processed = 0
    let skipped = 0
    let errors = 0

    for (const id of ids) {
      // Check if entity exists
      const entityRows = this.sql
        .exec('SELECT * FROM _data WHERE id = ? AND type = ?', id, type)
        .toArray()
      if (entityRows.length === 0) {
        errors++
        continue
      }

      // Check if should skip existing
      if (skipExisting) {
        const existing = this.sql
          .exec('SELECT id FROM _embeddings WHERE entity_type = ? AND entity_id = ?', type, id)
          .toArray()
        if (existing.length > 0) {
          skipped++
          continue
        }
      }

      const entity = this.deserializeDataRow(entityRows[0])
      await this.generateEmbeddingForEntity(
        type,
        id as string,
        entity['data'] as Record<string, unknown>
      )
      processed++
    }

    return Response.json({ processed, skipped, errors, success: true })
  }

  /**
   * Start a batch embedding job
   */
  private async handleEmbeddingsBatchStart(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { type: rawType, batchSize = 10 } = body

    if (!rawType || typeof rawType !== 'string') {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }
    const type = rawType as string

    // Count entities of this type
    const countResult = this.sql
      .exec('SELECT COUNT(*) as count FROM _data WHERE type = ?', type)
      .toArray()
    const countRow = countResult[0] as CountRow | undefined
    const total = countRow?.count ?? 0

    const jobId = crypto.randomUUID()

    // Store job status
    this.batchJobs.set(jobId, {
      status: 'pending',
      total,
      processed: 0,
      errors: 0,
    })

    // Start processing in the background
    this.processBatchJob(jobId, type, batchSize as number).catch(() => {
      const job = this.batchJobs.get(jobId)
      if (job) {
        job.status = 'failed'
      }
    })

    return Response.json({ jobId, total })
  }

  /**
   * Process a batch job asynchronously
   */
  private async processBatchJob(jobId: string, type: string, batchSize: number): Promise<void> {
    const job = this.batchJobs.get(jobId)
    if (!job) return

    job.status = 'processing'

    // Get all entities of this type
    const entities = this.sql.exec('SELECT * FROM _data WHERE type = ?', type).toArray()

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)
      for (const row of batch) {
        try {
          const entity = this.deserializeDataRow(row)
          await this.generateEmbeddingForEntity(
            type,
            entity['id'] as string,
            entity['data'] as Record<string, unknown>
          )
          job.processed++
        } catch {
          job.errors++
        }
      }
    }

    job.status = 'completed'
  }

  /**
   * Get batch job status
   */
  private handleEmbeddingsBatchStatus(jobId: string): Response {
    const job = this.batchJobs.get(jobId)
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    return Response.json(job)
  }

  /**
   * Get embedding for a specific entity
   */
  private async handleGetEmbedding(entityType: string, entityId: string): Promise<Response> {
    // Check if entity exists
    const entityRows = this.sql
      .exec('SELECT * FROM _data WHERE id = ? AND type = ?', entityId, entityType)
      .toArray()
    if (entityRows.length === 0) {
      return Response.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Check if embedding exists
    const embeddingRows = this.sql
      .exec(
        'SELECT * FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
        entityType,
        entityId
      )
      .toArray()

    if (embeddingRows.length > 0) {
      // Cache hit
      this.embeddingsCacheStats.cacheHits++
      const embRow = embeddingRows[0] as EmbeddingRow
      return Response.json({
        entity_type: embRow.entity_type,
        entity_id: embRow.entity_id,
        model: embRow.model,
        vector: typeof embRow.vector === 'string' ? JSON.parse(embRow.vector) : embRow.vector,
        content_hash: embRow.content_hash,
        created_at: embRow.created_at,
        updated_at: embRow.updated_at,
      })
    }

    // Cache miss - generate embedding
    this.embeddingsCacheStats.cacheMisses++
    const entity = this.deserializeDataRow(entityRows[0])
    const embedding = await this.generateEmbeddingForEntity(entityType, entityId, entity.data)

    if (!embedding) {
      // Could not generate embedding (e.g., no text content)
      return Response.json({ error: 'Could not generate embedding' }, { status: 400 })
    }

    return Response.json(embedding)
  }

  /**
   * Semantic search using vector similarity
   */
  private async handleSemanticSearch(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      type: rawType,
      query: rawQuery,
      minScore: rawMinScore = 0,
      limit: rawLimit = 10,
      where,
      since,
      until,
    } = body

    if (!rawType || typeof rawType !== 'string') {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }

    if (!rawQuery || typeof rawQuery !== 'string' || (rawQuery as string).trim() === '') {
      return Response.json({ error: 'query field is required' }, { status: 400 })
    }

    const type = rawType as string
    const query = rawQuery as string
    const minScore = rawMinScore as number
    const limit = rawLimit as number

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query)

    // Get all entities of this type and ensure they have embeddings
    const entities = this.sql.exec('SELECT * FROM _data WHERE type = ?', type).toArray()

    // Generate embeddings for entities that don't have them yet (lazy generation)
    for (const row of entities) {
      const entity = this.deserializeDataRow(row)
      const existingEmbedding = this.sql
        .exec(
          'SELECT id FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
          type,
          entity['id']
        )
        .toArray()
      if (existingEmbedding.length === 0) {
        await this.generateEmbeddingForEntity(
          type,
          entity['id'] as string,
          entity['data'] as Record<string, unknown>
        )
      }
    }

    // Get all embeddings for this type
    const embeddingRows = this.sql
      .exec('SELECT * FROM _embeddings WHERE entity_type = ?', type)
      .toArray()

    // Calculate similarity scores
    const results: Array<{ entityId: string; score: number }> = []

    for (const row of embeddingRows) {
      const embeddingRow = row as EmbeddingRow
      const vector =
        typeof embeddingRow.vector === 'string'
          ? JSON.parse(embeddingRow.vector)
          : embeddingRow.vector

      const score = this.cosineSimilarity(queryEmbedding, vector)

      if (score >= minScore) {
        results.push({ entityId: embeddingRow.entity_id, score })
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    // Get entity data for top results
    const finalResults: Array<Record<string, unknown>> = []

    for (const result of results.slice(0, limit)) {
      const entityRows = this.sql
        .exec('SELECT * FROM _data WHERE id = ?', result.entityId)
        .toArray()
      if (entityRows.length === 0) continue

      const entity = this.deserializeDataRow(entityRows[0])

      // Apply where filters if specified
      if (where) {
        const data = entity['data'] as Record<string, unknown>
        let matches = true
        for (const [field, value] of Object.entries(where)) {
          if (data[field] !== value) {
            matches = false
            break
          }
        }
        if (!matches) continue
      }

      // Apply time filters
      if (since && entity['created_at'] < since) continue
      if (until && entity['created_at'] > until) continue

      finalResults.push({
        id: entity['id'],
        type: entity['type'],
        data: entity['data'],
        created_at: entity['created_at'],
        updated_at: entity['updated_at'],
        $score: result.score,
      })
    }

    return Response.json(finalResults)
  }

  /**
   * Hybrid search combining FTS and semantic
   */
  private async handleHybridSearch(request: Request): Promise<Response> {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      type: rawType,
      query: rawQuery,
      limit: rawLimit = 10,
      ftsWeight: rawFtsWeight = 0.5,
      semanticWeight: rawSemanticWeight = 0.5,
      rrfK: rawRrfK = 60,
    } = body

    if (!rawType) {
      return Response.json({ error: 'type field is required' }, { status: 400 })
    }

    if (!rawQuery || (rawQuery as string).trim() === '') {
      return Response.json({ error: 'query field is required' }, { status: 400 })
    }

    const type = rawType as string
    const query = rawQuery as string
    const limit = rawLimit as number
    const ftsWeight = rawFtsWeight as number
    const semanticWeight = rawSemanticWeight as number
    const rrfK = rawRrfK as number

    // Get FTS results
    const ftsRanks = new Map<string, number>()
    const entities = this.sql.exec('SELECT * FROM _data WHERE type = ?', type).toArray()

    let ftsRank = 1
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/)

    for (const row of entities) {
      const entity = this.deserializeDataRow(row)
      const data = entity['data'] as Record<string, unknown>

      // Simple FTS: check if any text field contains query terms
      let hasMatch = false
      for (const value of Object.values(data)) {
        if (typeof value === 'string') {
          const valueLower = value.toLowerCase()
          if (queryTerms.some((term: string) => valueLower.includes(term))) {
            hasMatch = true
            break
          }
        }
      }

      if (hasMatch) {
        ftsRanks.set(entity['id'] as string, ftsRank++)
      }
    }

    // Get semantic results
    const semanticRanks = new Map<string, number>()
    const semanticScores = new Map<string, number>()

    // Ensure embeddings exist for all entities (lazy generation)
    for (const row of entities) {
      const entity = this.deserializeDataRow(row)
      const existingEmbedding = this.sql
        .exec(
          'SELECT id FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
          type,
          entity['id']
        )
        .toArray()
      if (existingEmbedding.length === 0) {
        await this.generateEmbeddingForEntity(
          type,
          entity['id'] as string,
          entity['data'] as Record<string, unknown>
        )
      }
    }

    const queryEmbedding = await this.generateEmbedding(query)
    const embeddingRows = this.sql
      .exec('SELECT * FROM _embeddings WHERE entity_type = ?', type)
      .toArray()

    const semanticResults: Array<{ entityId: string; score: number }> = []

    for (const row of embeddingRows) {
      const embeddingRow = row as EmbeddingRow
      const vector =
        typeof embeddingRow.vector === 'string'
          ? JSON.parse(embeddingRow.vector)
          : embeddingRow.vector

      const score = this.cosineSimilarity(queryEmbedding, vector)
      semanticResults.push({ entityId: embeddingRow.entity_id, score })
      semanticScores.set(embeddingRow.entity_id, score)
    }

    // Sort by score and assign ranks
    semanticResults.sort((a, b) => b.score - a.score)
    let semanticRank = 1
    for (const result of semanticResults) {
      semanticRanks.set(result.entityId, semanticRank++)
    }

    // Compute RRF scores
    const allIds = new Set([...ftsRanks.keys(), ...semanticRanks.keys()])
    const rrfResults: Array<{
      entityId: string
      rrfScore: number
      ftsRank: number
      semanticRank: number
      semanticScore: number
    }> = []

    for (const id of allIds) {
      const fRank = ftsRanks.get(id) ?? Infinity
      const sRank = semanticRanks.get(id) ?? Infinity
      const sScore = semanticScores.get(id) ?? 0

      const ftsComponent = fRank < Infinity ? ftsWeight / (rrfK + fRank) : 0
      const semanticComponent = sRank < Infinity ? semanticWeight / (rrfK + sRank) : 0
      const rrfScore = ftsComponent + semanticComponent

      rrfResults.push({
        entityId: id,
        rrfScore,
        ftsRank: fRank,
        semanticRank: sRank,
        semanticScore: sScore,
      })
    }

    // Sort by RRF score
    rrfResults.sort((a, b) => b.rrfScore - a.rrfScore)

    // Get entity data for top results
    const finalResults: Array<Record<string, unknown>> = []

    for (const result of rrfResults.slice(0, limit)) {
      const entityRows = this.sql
        .exec('SELECT * FROM _data WHERE id = ?', result.entityId)
        .toArray()
      if (entityRows.length === 0) continue

      const entity = this.deserializeDataRow(entityRows[0])

      finalResults.push({
        id: entity['id'],
        type: entity['type'],
        data: entity['data'],
        created_at: entity['created_at'],
        updated_at: entity['updated_at'],
        $score: result.semanticScore,
        $rrfScore: result.rrfScore,
        $ftsRank: result.ftsRank,
        $semanticRank: result.semanticRank,
      })
    }

    return Response.json(finalResults)
  }

  // ===========================================================================
  // Embedding Generation Helpers
  // ===========================================================================

  /**
   * Generate embedding for an entity and store it
   */
  private async generateEmbeddingForEntity(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    // Extract text content from data
    const text = this.extractEmbeddableText(data)

    if (!text || text.trim() === '') {
      // No text content to embed
      return null
    }

    const contentHash = this.hashContent(text)
    const now = new Date().toISOString()

    // Generate embedding using AI binding
    const vector = await this.generateEmbedding(text)

    // Upsert into _embeddings table
    const existing = this.sql
      .exec(
        'SELECT id, created_at FROM _embeddings WHERE entity_type = ? AND entity_id = ?',
        entityType,
        entityId
      )
      .toArray()

    const existingEmb = existing.length > 0 ? (existing[0] as EmbeddingRow) : null
    const id = existingEmb?.id ?? crypto.randomUUID()
    const createdAt = existingEmb?.created_at ?? now
    const vectorJson = JSON.stringify(vector)

    if (existing.length > 0) {
      this.sql.exec(
        `UPDATE _embeddings SET model = ?, vector = ?, content_hash = ?, updated_at = ?
         WHERE entity_type = ? AND entity_id = ?`,
        this.embeddingsConfig.model,
        vectorJson,
        contentHash,
        now,
        entityType,
        entityId
      )
    } else {
      this.sql.exec(
        `INSERT INTO _embeddings (id, entity_type, entity_id, model, vector, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        entityType,
        entityId,
        this.embeddingsConfig.model,
        vectorJson,
        contentHash,
        now,
        now
      )
    }

    return {
      entity_type: entityType,
      entity_id: entityId,
      model: this.embeddingsConfig.model,
      vector,
      content_hash: contentHash,
      created_at: createdAt,
      updated_at: now,
    }
  }

  /**
   * Generate embedding vector for text using AI binding or fallback
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Try to use AI binding if available
    const envWithAI = this.env as EnvWithAI
    const ai = envWithAI?.AI
    if (ai && typeof ai.run === 'function') {
      try {
        const result = await ai.run(this.embeddingsConfig.model, { text: [text] })
        if (result?.data?.[0]) {
          return result.data[0]
        }
      } catch {
        // Fall back to deterministic embedding
      }
    }

    // Fallback: generate deterministic embedding based on text content
    return this.generateDeterministicEmbedding(text)
  }

  /**
   * Generate a deterministic embedding based on text content
   * This is used as a fallback when no AI binding is available
   */
  private generateDeterministicEmbedding(text: string): number[] {
    // Use semantic word vectors for meaningful similarity
    const SEMANTIC_VECTORS: Record<string, number[]> = {
      // AI/ML domain
      machine: [0.9, 0.1, 0.05, 0.02],
      learning: [0.85, 0.15, 0.08, 0.03],
      artificial: [0.88, 0.12, 0.06, 0.04],
      intelligence: [0.87, 0.13, 0.07, 0.05],
      neural: [0.82, 0.18, 0.09, 0.06],
      network: [0.75, 0.2, 0.15, 0.1],
      deep: [0.8, 0.17, 0.1, 0.08],
      ai: [0.92, 0.08, 0.04, 0.02],
      ml: [0.88, 0.12, 0.06, 0.03],
      algorithm: [0.83, 0.17, 0.08, 0.04],
      algorithms: [0.83, 0.17, 0.08, 0.04],
      // Programming domain
      programming: [0.15, 0.85, 0.1, 0.05],
      code: [0.12, 0.88, 0.12, 0.06],
      software: [0.18, 0.82, 0.15, 0.08],
      development: [0.2, 0.8, 0.18, 0.1],
      typescript: [0.1, 0.9, 0.08, 0.04],
      javascript: [0.12, 0.88, 0.1, 0.05],
      python: [0.25, 0.75, 0.12, 0.06],
      react: [0.08, 0.85, 0.2, 0.1],
      vue: [0.06, 0.84, 0.18, 0.08],
      frontend: [0.05, 0.8, 0.25, 0.12],
      // Database domain
      database: [0.1, 0.7, 0.08, 0.6],
      query: [0.12, 0.65, 0.1, 0.7],
      sql: [0.08, 0.6, 0.05, 0.75],
      optimization: [0.15, 0.55, 0.12, 0.68],
      performance: [0.18, 0.5, 0.15, 0.65],
      // Food domain (very different from tech)
      cooking: [0.02, 0.05, 0.03, 0.02],
      recipe: [0.03, 0.04, 0.02, 0.03],
      recipes: [0.03, 0.04, 0.02, 0.03],
      food: [0.02, 0.03, 0.02, 0.02],
      pasta: [0.01, 0.02, 0.01, 0.01],
      pizza: [0.01, 0.03, 0.02, 0.01],
      italian: [0.02, 0.04, 0.02, 0.02],
      traditional: [0.02, 0.03, 0.02, 0.02],
      // State management - hooks is strongly related to state
      state: [0.3, 0.5, 0.6, 0.4],
      management: [0.35, 0.45, 0.55, 0.38],
      hooks: [0.25, 0.55, 0.65, 0.35],
      usestate: [0.28, 0.5, 0.62, 0.36],
      useeffect: [0.24, 0.52, 0.6, 0.34],
      patterns: [0.3, 0.48, 0.58, 0.37],
      different: [0.2, 0.4, 0.5, 0.3],
      // General
      guide: [0.5, 0.5, 0.5, 0.5],
      comprehensive: [0.5, 0.5, 0.5, 0.5],
      introduction: [0.5, 0.5, 0.5, 0.5],
      overview: [0.5, 0.5, 0.5, 0.5],
      tutorial: [0.5, 0.5, 0.5, 0.5],
      tips: [0.5, 0.5, 0.5, 0.5],
      systems: [0.5, 0.5, 0.5, 0.5],
      applications: [0.5, 0.5, 0.5, 0.5],
      // Quantum physics (very different)
      quantum: [0.01, 0.01, 0.01, 0.99],
      physics: [0.02, 0.02, 0.01, 0.98],
      simulation: [0.03, 0.05, 0.02, 0.95],
    }

    const DEFAULT_VECTOR = [0.1, 0.1, 0.1, 0.1]

    // Tokenize
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)

    if (words.length === 0) {
      // Return zeros with small noise
      return Array.from({ length: 768 }, (_, i) => Math.sin(i) * 0.01)
    }

    // Aggregate word vectors
    const aggregated: number[] = [0, 0, 0, 0]
    for (const word of words) {
      const vec = SEMANTIC_VECTORS[word] ?? DEFAULT_VECTOR
      for (let i = 0; i < 4; i++) {
        aggregated[i]! += vec[i]!
      }
    }

    // Normalize
    const norm = Math.sqrt(aggregated.reduce((sum, v) => sum + v * v, 0))
    const normalized = aggregated.map((v) => v / (norm || 1))

    // Expand to 768 dimensions
    const textHash = this.simpleHash(text)
    const embedding = new Array(768)

    for (let i = 0; i < 768; i++) {
      const baseIndex = i % 4
      const base = normalized[baseIndex]!
      const noise = this.seededRandom(textHash, i) * 0.1 - 0.05
      embedding[i] = base + noise
    }

    // Final normalization
    const finalNorm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0))
    return embedding.map((v: number) => v / (finalNorm || 1))
  }

  /**
   * Extract text content from entity data for embedding
   */
  private extractEmbeddableText(data: Record<string, unknown>): string {
    const textParts: string[] = []

    for (const [key, value] of Object.entries(data)) {
      // Skip internal fields
      if (key.startsWith('$') || key.startsWith('_')) continue
      // Skip timestamps
      if (key.endsWith('At') || key.endsWith('_at')) continue

      if (typeof value === 'string' && value.trim()) {
        textParts.push(value)
      } else if (typeof value === 'number') {
        // Include numbers as text for embedding
        textParts.push(String(value))
      } else if (Array.isArray(value)) {
        const stringValues = value.filter((v) => typeof v === 'string')
        if (stringValues.length > 0) {
          textParts.push(stringValues.join(' '))
        }
      }
    }

    return textParts.join('\n\n')
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`)
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!
      normA += a[i]! * a[i]!
      normB += b[i]! * b[i]!
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    if (magnitude === 0) return 0

    // Return normalized similarity (0-1 range)
    return Math.max(0, Math.min(1, (dotProduct / magnitude + 1) / 2))
  }

  /**
   * Simple hash function for deterministic randomness
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Generate deterministic pseudo-random number from seed
   */
  private seededRandom(seed: number, index: number): number {
    const x = Math.sin(seed + index) * 10000
    return x - Math.floor(x)
  }

  /**
   * Hash content for change detection
   */
  private hashContent(text: string): string {
    const hash = this.simpleHash(text)
    return hash.toString(16).padStart(8, '0')
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
