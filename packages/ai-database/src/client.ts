/**
 * RPC Client for AI Database
 *
 * Provides a typed RPC client that connects to the deployed
 * ai-database worker using rpc.do for remote procedure calls.
 *
 * This module is designed to work in browsers and edge runtimes
 * without any Node.js-specific dependencies.
 *
 * @example
 * ```ts
 * import { createDatabaseClient } from 'ai-database/client'
 *
 * const client = createDatabaseClient('https://ai-database.workers.dev')
 * const service = client.connect('my-namespace')
 * const post = await service.create('Post', { title: 'Hello World' })
 * const found = await service.get('Post', post.$id)
 * ```
 *
 * @packageDocumentation
 */

import {
  RPC,
  http,
  type RPCProxy,
  type SqlQuery,
  type RemoteStorage,
  type RemoteCollections,
  type DatabaseSchema as RpcDatabaseSchema,
  type RpcSchema,
} from 'rpc.do'

// ==================== RPC Client Features ====================

/**
 * DO Client features available on RPC proxy
 * This mirrors the DOClientFeatures interface from rpc.do which is not exported
 */
interface DOClientFeatures {
  /** Tagged template SQL query */
  sql: <R = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => SqlQuery<R>
  /** Remote storage access */
  storage: RemoteStorage
  /** Remote collection access (MongoDB-style) */
  collection: RemoteCollections
  /** Get database schema */
  dbSchema: () => Promise<RpcDatabaseSchema>
  /** Get full RPC schema */
  schema: () => Promise<RpcSchema>
}

/**
 * Type for the AI Database RPC client
 */
export type DatabaseClient = RPCProxy<DatabaseServiceAPI> & DOClientFeatures

// ==================== Types ====================

// Re-export core types for client usage
export type {
  // Thing types (mdxld-based)
  ThingFlat,
  ThingExpanded,
  // Schema types
  DatabaseSchema,
  EntitySchema,
  FieldDefinition,
  PrimitiveType,
  ParsedSchema,
  ParsedEntity,
  ParsedField,
  // Provider types
  DBProvider,
  ListOptions,
  SearchOptions,
  // DB Result type
  DBResult,
  TypedDB,
  EntityOperations,
  // Event types
  DBEvent,
  ActorData,
  // Action types
  DBAction,
  // Artifact types
  DBArtifact,
  // Natural Language Query types
  NLQueryResult,
  NLQueryContext,
  NLQueryPlan,
  // Graph Database Types (for @mdxdb adapters)
  EntityId,
  Thing,
  Relationship,
  // Query Types
  QueryOptions,
  ThingSearchOptions,
  CreateOptions,
  UpdateOptions,
  RelateOptions,
  // Event/Action/Artifact Option Types
  StoreArtifactOptions,
  EventQueryOptions,
  ActionQueryOptions,
  ActionStatus,
  ArtifactType,
  // Client Interfaces
  DBClient,
  DBClientExtended,
  // Semantic Search types
  SemanticSearchOptions,
  HybridSearchOptions,
} from './schema.js'

// Re-export DB factory for client-side schema definition
export { DB } from './schema.js'

// Re-export type utilities
export { toExpanded, toFlat } from './types.js'

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
 * Deserialized event row
 */
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
 * Action interface
 */
export interface Action {
  id: string
  action: string
  actor: string
  object?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
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

// ==================== API Type ====================

/**
 * DatabaseServiceCoreAPI - Type-safe interface matching DatabaseServiceCore RPC methods
 *
 * This interface mirrors all public methods on DatabaseServiceCore so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface DatabaseServiceCoreAPI {
  // CRUD Operations
  get(type: string, id: string): Promise<EntityResult | null>
  list(type: string, options?: { limit?: number; offset?: number }): Promise<EntityResult[]>
  create(type: string, data: Record<string, unknown>, id?: string): Promise<EntityResult>
  update(type: string, id: string, data: Record<string, unknown>): Promise<EntityResult>
  delete(type: string, id: string): Promise<boolean>

  // Search Operations
  search(
    type: string,
    query: string,
    options?: { limit?: number; fields?: string[] }
  ): Promise<SearchResult[]>
  semanticSearch(
    type: string,
    query: string,
    options?: { limit?: number; threshold?: number }
  ): Promise<SemanticSearchResult[]>
  hybridSearch(
    type: string,
    query: string,
    options?: { limit?: number; ftsWeight?: number; semanticWeight?: number }
  ): Promise<HybridSearchResult[]>

  // Relationship Operations
  related(type: string, id: string, relation: string): Promise<EntityResult[]>
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void>
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>

  // Events API
  on(pattern: string, handler: (event: DeserializedEventRow) => void | Promise<void>): string
  unsubscribe(handlerId: string): void
  emit(
    eventOrOptions: string | { event: string; actor: string; object?: string; data?: unknown },
    data?: unknown
  ): Promise<DeserializedEventRow | null>
  listEvents(options?: {
    event?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<DeserializedEventRow[]>

  // Actions API
  createAction(options: {
    action: string
    actor: string
    object?: string
    data?: unknown
    total?: number
  }): Promise<Action | null>
  getAction(id: string): Promise<Action | null>
  updateAction(
    id: string,
    updates: { status?: string; progress?: number; result?: unknown; error?: string }
  ): Promise<Action | null>
  listActions(options?: {
    status?: string
    action?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<Action[]>

  // Artifacts API
  getArtifact(url: string, type: string): Promise<Artifact | null>
  setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void>
  deleteArtifact(url: string, type?: string): Promise<void>
  listArtifacts(url: string): Promise<Artifact[]>

  // Utility Methods
  clear(): void
}

/**
 * DatabaseServiceAPI - Type-safe interface matching DatabaseService RPC methods
 */
export interface DatabaseServiceAPI {
  connect(namespace?: string): DatabaseServiceCoreAPI
}

// ==================== Client Options ====================

/**
 * Options for creating an AI Database RPC client
 */
export interface DatabaseClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client Factory ====================

/** Default URL for the ai-database worker */
const DEFAULT_URL = 'https://ai-database.workers.dev'

/**
 * Create a typed RPC client for the ai-database worker
 *
 * @param url - The URL of the deployed ai-database worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all DatabaseService methods
 *
 * @example
 * ```ts
 * import { createDatabaseClient } from 'ai-database/client'
 *
 * // Connect to production
 * const client = createDatabaseClient('https://ai-database.workers.dev')
 *
 * // Connect to a namespace
 * const service = client.connect('my-namespace')
 *
 * // CRUD operations
 * const post = await service.create('Post', { title: 'Hello', content: 'World' })
 * const posts = await service.list('Post', { limit: 10 })
 * const found = await service.get('Post', post.$id)
 *
 * // Search
 * const results = await service.search('Post', 'hello')
 * const semantic = await service.semanticSearch('Post', 'greeting posts')
 *
 * // Relationships
 * await service.relate('Post', post.$id, 'author', 'User', userId)
 * const authors = await service.related('Post', post.$id, 'author')
 *
 * // Events
 * await service.emit({ event: 'Post.published', actor: userId, object: post.$id })
 * const events = await service.listEvents({ event: 'Post.published' })
 * ```
 */
export function createDatabaseClient(
  url: string = DEFAULT_URL,
  options?: DatabaseClientOptions
): DatabaseClient {
  return RPC<DatabaseServiceAPI>(http(url, options?.token))
}

/**
 * Default client instance connected to the production ai-database worker
 *
 * @example
 * ```ts
 * import client from 'ai-database/client'
 *
 * const service = client.connect('my-namespace')
 * const post = await service.create('Post', { title: 'Hello' })
 * ```
 */
const client: DatabaseClient = createDatabaseClient()

export default client
