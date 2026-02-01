/**
 * DataLoader - Microtask-batching for N+1 query prevention
 *
 * Batches individual entity lookups that occur within the same microtask tick
 * into a single bulk fetch, deduplicating by (entityType, id) pairs.
 *
 * Inspired by the Facebook DataLoader pattern but tailored for ai-database's
 * provider.get() interface.
 *
 * @packageDocumentation
 */

import type { DBProvider } from './schema.js'

/** Key for cache entries: "type:id" */
type CacheKey = string

function makeCacheKey(type: string, id: string): CacheKey {
  return `${type}:${id}`
}

/** A queued request waiting to be batched */
interface QueuedRequest {
  type: string
  id: string
  resolve: (value: Record<string, unknown> | null) => void
  reject: (error: unknown) => void
}

/**
 * Generic DataLoader that batches provider.get() calls within a microtask tick.
 *
 * Usage:
 * ```ts
 * const loader = new DataLoader(provider)
 * // These all batch into a single tick:
 * const [a, b, c] = await Promise.all([
 *   loader.load('User', 'id1'),
 *   loader.load('User', 'id2'),
 *   loader.load('User', 'id1'), // deduped, returns cached
 * ])
 * loader.clear() // reset for next request
 * ```
 */
export class DataLoader {
  private _provider: DBProvider
  private _cache: Map<CacheKey, Promise<Record<string, unknown> | null>>
  private _queue: QueuedRequest[]
  private _scheduled: boolean
  private _cacheEnabled: boolean

  constructor(provider: DBProvider, options?: { cache?: boolean }) {
    this._provider = provider
    this._cache = new Map()
    this._queue = []
    this._scheduled = false
    this._cacheEnabled = options?.cache !== false
  }

  /**
   * Load a single entity by type and id.
   * Batches with other load() calls in the same microtask tick.
   * Results are cached for the lifetime of this DataLoader instance.
   */
  load(type: string, id: string): Promise<Record<string, unknown> | null> {
    const key = makeCacheKey(type, id)

    // Return cached result if available
    if (this._cacheEnabled) {
      const cached = this._cache.get(key)
      if (cached !== undefined) {
        return cached
      }
    }

    // Create a new promise and queue the request
    const promise = new Promise<Record<string, unknown> | null>((resolve, reject) => {
      this._queue.push({ type, id, resolve, reject })
    })

    if (this._cacheEnabled) {
      this._cache.set(key, promise)
    }

    // Schedule batch dispatch on next microtask if not already scheduled
    if (!this._scheduled) {
      this._scheduled = true
      Promise.resolve().then(() => this._dispatch())
    }

    return promise
  }

  /**
   * Load multiple entities at once. Returns results in same order as input keys.
   */
  async loadMany(
    keys: Array<{ type: string; id: string }>
  ): Promise<Array<Record<string, unknown> | null>> {
    return Promise.all(keys.map(({ type, id }) => this.load(type, id)))
  }

  /**
   * Prime the cache with a known value (e.g., from a create or list result).
   */
  prime(type: string, id: string, value: Record<string, unknown> | null): void {
    if (!this._cacheEnabled) return
    const key = makeCacheKey(type, id)
    if (!this._cache.has(key)) {
      this._cache.set(key, Promise.resolve(value))
    }
  }

  /**
   * Clear the entire cache, or a single entry.
   */
  clear(type?: string, id?: string): void {
    if (type && id) {
      this._cache.delete(makeCacheKey(type, id))
    } else {
      this._cache.clear()
    }
  }

  /**
   * Get cache statistics for debugging.
   */
  get stats(): { cacheSize: number; pendingQueue: number } {
    return {
      cacheSize: this._cache.size,
      pendingQueue: this._queue.length,
    }
  }

  /**
   * Dispatch all queued requests in a single batch.
   * Groups by entity type, deduplicates IDs, then resolves all waiting promises.
   */
  private async _dispatch(): Promise<void> {
    // Grab current queue and reset
    const queue = this._queue
    this._queue = []
    this._scheduled = false

    if (queue.length === 0) return

    // Group requests by type
    const byType = new Map<string, Map<string, QueuedRequest[]>>()
    for (const req of queue) {
      let typeMap = byType.get(req.type)
      if (!typeMap) {
        typeMap = new Map()
        byType.set(req.type, typeMap)
      }
      let idRequests = typeMap.get(req.id)
      if (!idRequests) {
        idRequests = []
        typeMap.set(req.id, idRequests)
      }
      idRequests.push(req)
    }

    // Fetch all unique (type, id) pairs in parallel
    const fetches: Array<{
      type: string
      id: string
      requests: QueuedRequest[]
      promise: Promise<Record<string, unknown> | null>
    }> = []

    for (const [type, idMap] of byType) {
      for (const [id, requests] of idMap) {
        fetches.push({
          type,
          id,
          requests,
          promise: this._provider
            .get(type, id)
            .then((result) => (result as Record<string, unknown> | null) ?? null),
        })
      }
    }

    // Resolve all fetches and distribute results
    const results = await Promise.allSettled(fetches.map((f) => f.promise))

    for (let i = 0; i < fetches.length; i++) {
      const fetch = fetches[i]!
      const result = results[i]!

      if (result.status === 'fulfilled') {
        for (const req of fetch.requests) {
          req.resolve(result.value)
        }
      } else {
        for (const req of fetch.requests) {
          req.reject((result as PromiseRejectedResult).reason)
        }
      }
    }
  }
}

// =============================================================================
// Request-scoped DataLoader context
// =============================================================================

/** Active DataLoader for the current request context */
let activeLoader: DataLoader | null = null

/**
 * Create a new request-scoped DataLoader.
 * Call this at the start of each request to enable batching.
 */
export function createRequestLoader(provider: DBProvider): DataLoader {
  const loader = new DataLoader(provider)
  activeLoader = loader
  return loader
}

/**
 * Get the active request-scoped DataLoader, if any.
 */
export function getRequestLoader(): DataLoader | null {
  return activeLoader
}

/**
 * Clear the active request-scoped DataLoader.
 * Call this at the end of each request.
 */
export function clearRequestLoader(): void {
  if (activeLoader) {
    activeLoader.clear()
    activeLoader = null
  }
}

/**
 * Run a function within a DataLoader context.
 * All provider.get() calls via loadEntity() within the callback
 * will be batched within each microtask tick.
 */
export async function withDataLoader<T>(provider: DBProvider, fn: () => Promise<T>): Promise<T> {
  const loader = createRequestLoader(provider)
  try {
    return await fn()
  } finally {
    clearRequestLoader()
  }
}

/**
 * Load an entity using the active DataLoader if available,
 * otherwise fall back to direct provider.get().
 *
 * This is the function that should replace direct provider.get() calls
 * in entity resolution (hydrateEntity).
 */
export async function loadEntity(
  provider: DBProvider,
  type: string,
  id: string
): Promise<Record<string, unknown> | null> {
  if (activeLoader) {
    return activeLoader.load(type, id)
  }
  // Fallback: direct provider call (no batching)
  const result = await provider.get(type, id)
  return (result as Record<string, unknown> | null) ?? null
}
