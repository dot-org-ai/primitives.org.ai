/**
 * DBProvider Adapter for Worker Services
 *
 * Bridges ai-database DBProvider/DBProviderExtended interface with the
 * DatabaseServiceCore WorkerEntrypoint RPC methods.
 *
 * This allows using a remote ai-database worker service as a local DBProvider,
 * enabling seamless integration with ai-workflows and other packages.
 *
 * @example
 * ```typescript
 * // In a Cloudflare Worker with service binding
 * import { createWorkerProvider } from 'ai-database/worker'
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const provider = createWorkerProvider(env.AI_DATABASE.connect('my-ns'))
 *     const posts = await provider.list('Post')
 *     return Response.json(posts)
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Use with DB() factory for type-safe schema access
 * import { DB } from 'ai-database'
 * import { createWorkerProvider } from 'ai-database/worker'
 *
 * const provider = createWorkerProvider(env.AI_DATABASE.connect('my-ns'))
 * const { Post } = DB(schema, { provider })
 *
 * const posts = await Post.list()
 * ```
 *
 * @packageDocumentation
 */

import type {
  DBProvider,
  DBProviderExtended,
  SemanticSearchResult,
  HybridSearchResult,
} from '../schema/provider.js'
import type {
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  DBEvent,
  DBAction,
  DBArtifact,
  CreateEventOptions,
  CreateActionOptions,
  EmbeddingsConfig,
} from '../schema/types.js'

/**
 * Interface for the DatabaseServiceCore methods exposed via RPC.
 *
 * This matches the methods available on DatabaseServiceCore from ../worker.ts.
 * When using Cloudflare Workers service bindings, the worker.connect() method
 * returns an object with these RPC methods.
 */
export interface DatabaseWorkerService {
  // Configuration
  setEmbeddingsConfig(config: EmbeddingsConfig): void

  // CRUD Operations
  get(type: string, id: string): Promise<Record<string, unknown> | null>
  list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]>
  create(type: string, data: Record<string, unknown>, id?: string): Promise<Record<string, unknown>>
  update(type: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
  delete(type: string, id: string): Promise<boolean>

  // Search Operations
  search(type: string, query: string, options?: SearchOptions): Promise<Record<string, unknown>[]>
  semanticSearch(
    type: string,
    query: string,
    options?: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]>
  hybridSearch(
    type: string,
    query: string,
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]>

  // Relationship Operations
  related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]>
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
  on(pattern: string, handler: (event: unknown) => void): string
  unsubscribe(handlerId: string): void
  emit(
    eventOrOptions: string | { event: string; actor: string; object?: string; data?: unknown },
    data?: unknown
  ): Promise<unknown>
  listEvents(options?: {
    event?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<unknown[]>

  // Actions API
  createAction(options: {
    action: string
    actor: string
    object?: string
    data?: unknown
    total?: number
  }): Promise<unknown>
  getAction(id: string): Promise<unknown>
  updateAction(
    id: string,
    updates: { status?: string; progress?: number; result?: unknown; error?: string }
  ): Promise<unknown>
  listActions(options?: {
    status?: string
    action?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<unknown[]>

  // Artifacts API
  getArtifact(url: string, type: string): Promise<unknown>
  setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void>
  deleteArtifact(url: string, type?: string): Promise<void>
  listArtifacts(url: string): Promise<unknown[]>

  // Utility
  clear(): void
}

/**
 * Options for creating a worker provider
 */
export interface WorkerProviderOptions {
  /**
   * Namespace for scoping database operations.
   * When provided, operations are scoped to this namespace.
   */
  namespace?: string
}

/**
 * Create a DBProviderExtended from a DatabaseServiceCore worker binding.
 *
 * This adapter bridges the gap between the Cloudflare Worker RPC interface
 * and the DBProvider interface used by ai-database's DB() factory.
 *
 * @param worker - The worker service binding (from env.AI_DATABASE.connect())
 * @param options - Optional configuration
 * @returns A DBProviderExtended that delegates to the worker service
 *
 * @example
 * ```typescript
 * // In your Cloudflare Worker
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     // Connect to the ai-database worker service
 *     const service = env.AI_DATABASE.connect('my-namespace')
 *
 *     // Create a provider from the service
 *     const provider = createWorkerProvider(service)
 *
 *     // Use the provider directly
 *     const users = await provider.list('User', { limit: 10 })
 *
 *     // Or use with DB() for type-safe access
 *     const { User, Post } = DB(schema, { provider })
 *     const posts = await Post.list({ where: { published: true } })
 *
 *     return Response.json({ users, posts })
 *   }
 * }
 * ```
 */
export function createWorkerProvider(
  worker: DatabaseWorkerService,
  options: WorkerProviderOptions = {}
): DBProviderExtended {
  const { namespace } = options

  // Track event subscriptions for cleanup
  const subscriptionHandlers = new Map<() => void, string>()

  return {
    // ===========================================================================
    // Configuration
    // ===========================================================================

    setEmbeddingsConfig(config: EmbeddingsConfig): void {
      worker.setEmbeddingsConfig(config)
    },

    // ===========================================================================
    // Core CRUD Operations (DBProvider interface)
    // ===========================================================================

    async get(type: string, id: string): Promise<Record<string, unknown> | null> {
      const result = await worker.get(type, id)
      if (!result) return null
      // Worker returns EntityResult with $id/$type, extract data
      const { $id, $type, ...data } = result as { $id?: string; $type?: string }
      return { $id: $id ?? id, ...data }
    },

    async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
      const results = await worker.list(type, options)
      return results
    },

    async search(
      type: string,
      query: string,
      options?: SearchOptions
    ): Promise<Record<string, unknown>[]> {
      return worker.search(type, query, options)
    },

    async create(
      type: string,
      id: string | undefined,
      data: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
      // Worker's create signature is (type, data, id?)
      return worker.create(type, data, id)
    },

    async update(
      type: string,
      id: string,
      data: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
      return worker.update(type, id, data)
    },

    async delete(type: string, id: string): Promise<boolean> {
      return worker.delete(type, id)
    },

    async related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]> {
      return worker.related(type, id, relation)
    },

    async relate(
      fromType: string,
      fromId: string,
      relation: string,
      toType: string,
      toId: string,
      metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
    ): Promise<void> {
      return worker.relate(fromType, fromId, relation, toType, toId, metadata)
    },

    async unrelate(
      fromType: string,
      fromId: string,
      relation: string,
      toType: string,
      toId: string
    ): Promise<void> {
      return worker.unrelate(fromType, fromId, relation, toType, toId)
    },

    // ===========================================================================
    // Semantic Search (DBProviderExtended interface)
    // ===========================================================================

    async semanticSearch(
      type: string,
      query: string,
      options?: SemanticSearchOptions
    ): Promise<SemanticSearchResult[]> {
      return worker.semanticSearch(type, query, options)
    },

    async hybridSearch(
      type: string,
      query: string,
      options?: HybridSearchOptions
    ): Promise<HybridSearchResult[]> {
      return worker.hybridSearch(type, query, options)
    },

    // ===========================================================================
    // Events API (DBProviderExtended interface)
    // ===========================================================================

    on(pattern: string, handler: (event: DBEvent) => void | Promise<void>): () => void {
      // Worker returns a handler ID, we need to wrap the handler and store the ID
      // for later unsubscription
      const handlerId = worker.on(pattern, (event: unknown) => {
        handler(event as DBEvent)
      })

      // Create unsubscribe function
      const unsubscribe = () => {
        worker.unsubscribe(handlerId)
        subscriptionHandlers.delete(unsubscribe)
      }

      subscriptionHandlers.set(unsubscribe, handlerId)
      return unsubscribe
    },

    emit: (async (optionsOrType: CreateEventOptions | string, data?: unknown): Promise<DBEvent> => {
      if (typeof optionsOrType === 'string') {
        const result = await worker.emit(optionsOrType, data)
        return result as DBEvent
      }
      const emitOptions: { event: string; actor: string; object?: string; data?: unknown } = {
        event: optionsOrType.event,
        actor: optionsOrType.actor,
      }
      if (optionsOrType.object !== undefined) {
        emitOptions.object = optionsOrType.object
      }
      if (optionsOrType.objectData !== undefined) {
        emitOptions.data = optionsOrType.objectData
      }
      const result = await worker.emit(emitOptions)
      return result as DBEvent
    }) as DBProviderExtended['emit'],

    async listEvents(options?: {
      event?: string
      actor?: string
      object?: string
      since?: Date
      until?: Date
      limit?: number
    }): Promise<DBEvent[]> {
      const results = await worker.listEvents(options)
      return results as DBEvent[]
    },

    async replayEvents(options: {
      event?: string
      actor?: string
      since?: Date
      handler: (event: DBEvent) => void | Promise<void>
    }): Promise<void> {
      // Get events and replay them through the handler
      // Build the options object, only including defined properties
      const listOptions: {
        event?: string
        actor?: string
        object?: string
        since?: Date
        until?: Date
        limit?: number
      } = {}
      if (options.event !== undefined) listOptions.event = options.event
      if (options.actor !== undefined) listOptions.actor = options.actor
      if (options.since !== undefined) listOptions.since = options.since

      const events = await worker.listEvents(listOptions)

      for (const event of events) {
        await options.handler(event as DBEvent)
      }
    },

    // ===========================================================================
    // Actions API (DBProviderExtended interface)
    // ===========================================================================

    async createAction(
      options: CreateActionOptions | { type: string; data: unknown; total?: number }
    ): Promise<DBAction> {
      // Handle legacy format
      if ('type' in options && !('action' in options)) {
        const legacyOpts: {
          action: string
          actor: string
          object?: string
          data?: unknown
          total?: number
        } = {
          action: options.type,
          actor: 'system',
        }
        if (options.data !== undefined) legacyOpts.data = options.data
        if (options.total !== undefined) legacyOpts.total = options.total
        const result = await worker.createAction(legacyOpts)
        return result as DBAction
      }

      const createOptions = options as CreateActionOptions
      const actionOpts: {
        action: string
        actor: string
        object?: string
        data?: unknown
        total?: number
      } = {
        action: createOptions.action,
        actor: createOptions.actor,
      }
      if (createOptions.object !== undefined) actionOpts.object = createOptions.object
      if (createOptions.objectData !== undefined) actionOpts.data = createOptions.objectData
      if (createOptions.total !== undefined) actionOpts.total = createOptions.total
      const result = await worker.createAction(actionOpts)
      return result as DBAction
    },

    async getAction(id: string): Promise<DBAction | null> {
      const result = await worker.getAction(id)
      return result as DBAction | null
    },

    async updateAction(
      id: string,
      updates: Partial<Pick<DBAction, 'status' | 'progress' | 'result' | 'error'>>
    ): Promise<DBAction> {
      const result = await worker.updateAction(
        id,
        updates as {
          status?: string
          progress?: number
          result?: unknown
          error?: string
        }
      )
      return result as DBAction
    },

    async listActions(options?: {
      status?: DBAction['status']
      action?: string
      actor?: string
      object?: string
      since?: Date
      until?: Date
      limit?: number
    }): Promise<DBAction[]> {
      const results = await worker.listActions(
        options as {
          status?: string
          action?: string
          actor?: string
          object?: string
          since?: Date
          until?: Date
          limit?: number
        }
      )
      return results as DBAction[]
    },

    async retryAction(id: string): Promise<DBAction> {
      // Retry by updating status back to pending
      const result = await worker.updateAction(id, { status: 'pending' })
      return result as DBAction
    },

    async cancelAction(id: string): Promise<void> {
      await worker.updateAction(id, { status: 'cancelled' as string })
    },

    // ===========================================================================
    // Artifacts API (DBProviderExtended interface)
    // ===========================================================================

    async getArtifact(url: string, type: string): Promise<DBArtifact | null> {
      const result = await worker.getArtifact(url, type)
      return result as DBArtifact | null
    },

    async setArtifact(
      url: string,
      type: string,
      data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
    ): Promise<void> {
      return worker.setArtifact(url, type, data)
    },

    async deleteArtifact(url: string, type?: string): Promise<void> {
      return worker.deleteArtifact(url, type)
    },

    async listArtifacts(url: string): Promise<DBArtifact[]> {
      const results = await worker.listArtifacts(url)
      return results as DBArtifact[]
    },
  }
}

/**
 * Create a basic DBProvider (without extended features) from a worker service.
 *
 * Use this when you only need the core CRUD operations and don't need
 * semantic search, events, actions, or artifacts.
 *
 * @param worker - The worker service binding
 * @param options - Optional configuration
 * @returns A basic DBProvider
 */
export function createBasicWorkerProvider(
  worker: DatabaseWorkerService,
  options: WorkerProviderOptions = {}
): DBProvider {
  const full = createWorkerProvider(worker, options)

  // Return only the basic DBProvider interface
  return {
    get: full.get,
    list: full.list,
    search: full.search,
    create: full.create,
    update: full.update,
    delete: full.delete,
    related: full.related,
    relate: full.relate,
    unrelate: full.unrelate,
  }
}
