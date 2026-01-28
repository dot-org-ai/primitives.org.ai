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

// Try to import from cloudflare:workers, fall back to mocks
let WorkerEntrypoint: typeof MockWorkerEntrypoint
let RpcTarget: typeof MockRpcTarget

try {
  // @ts-expect-error - cloudflare:workers is only available in Cloudflare Workers runtime
  const cfWorkers = await import('cloudflare:workers')
  WorkerEntrypoint = cfWorkers.WorkerEntrypoint
  RpcTarget = cfWorkers.RpcTarget
} catch {
  WorkerEntrypoint = MockWorkerEntrypoint
  RpcTarget = MockRpcTarget
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

/**
 * Default export for Cloudflare Workers
 */
export default {
  fetch: () => new Response('ai-database worker - use RPC via service binding'),
}

// Export aliases
export { DatabaseService as DatabaseWorker }
