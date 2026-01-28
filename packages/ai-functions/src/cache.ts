/**
 * Caching layer for embeddings and generations
 *
 * Provides content-addressable caching for embeddings and parameter-aware
 * caching for text/object generations with TTL support and LRU eviction.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Cache entry with metadata for tracking and eviction
 */
export interface CacheEntry<T> {
  /** The cached value */
  value: T
  /** When the entry was created */
  createdAt: number
  /** When the entry was last accessed */
  lastAccessedAt: number
  /** Number of times this entry has been accessed */
  accessCount: number
  /** When the entry expires (if TTL is set) */
  expiresAt?: number
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds */
  ttl?: number
  /** Whether to bypass cache and force fresh result */
  bypass?: boolean
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Hit rate (0-1) */
  hitRate: number
  /** Current number of entries */
  size: number
}

/**
 * Configuration options for MemoryCache
 */
export interface MemoryCacheOptions {
  /** Default TTL for entries in milliseconds */
  defaultTTL?: number
  /** Maximum number of entries (enables LRU eviction) */
  maxSize?: number
  /** Whether to refresh TTL on access (sliding window) */
  slidingExpiration?: boolean
  /** Interval for cleanup of expired entries in milliseconds */
  cleanupInterval?: number
}

// ============================================================================
// Cache Storage Interface
// ============================================================================

/**
 * Abstract cache storage interface for pluggable backends
 */
export interface CacheStorage<T> {
  /** Get a value by key */
  get(key: string): Promise<T | undefined>
  /** Set a value by key */
  set(key: string, value: T, options?: CacheOptions): Promise<void>
  /** Check if a key exists */
  has(key: string): Promise<boolean>
  /** Delete a key */
  delete(key: string): Promise<void>
  /** Clear all entries */
  clear(): Promise<void>
  /** Get the number of entries */
  size(): Promise<number>
  /** Get all keys */
  keys(): Promise<string[]>
}

// ============================================================================
// Memory Cache Implementation
// ============================================================================

/**
 * In-memory cache implementation with TTL and LRU eviction support
 */
export class MemoryCache<T> implements CacheStorage<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private accessOrder: string[] = []
  private options: MemoryCacheOptions
  private cleanupTimer?: ReturnType<typeof setInterval>

  constructor(options: MemoryCacheOptions = {}) {
    this.options = options

    // Start cleanup timer if interval is specified
    if (options.cleanupInterval && options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup()
      }, options.cleanupInterval)
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return undefined
    }

    // Update access tracking
    entry.lastAccessedAt = Date.now()
    entry.accessCount++

    // Update access order for LRU
    this.updateAccessOrder(key)

    // Sliding expiration - refresh TTL on access
    if (this.options.slidingExpiration && this.options.defaultTTL) {
      entry.expiresAt = Date.now() + this.options.defaultTTL
    }

    return entry.value
  }

  /**
   * Set a value by key
   */
  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const now = Date.now()
    const ttl = options?.ttl ?? this.options.defaultTTL

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      ...(ttl ? { expiresAt: now + ttl } : {}),
    }

    // Check if we need to evict (LRU)
    if (this.options.maxSize && this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    this.cache.set(key, entry)
    this.updateAccessOrder(key)
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return false
    }

    return true
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key)
    this.removeFromAccessOrder(key)
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear()
    this.accessOrder = []
  }

  /**
   * Get the number of entries (excluding expired)
   */
  async size(): Promise<number> {
    await this.cleanup()
    return this.cache.size
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    await this.cleanup()
    return Array.from(this.cache.keys())
  }

  /**
   * Get full entry with metadata
   */
  async getEntry(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return undefined
    }

    return entry
  }

  /**
   * Dispose cleanup timer
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      delete this.cleanupTimer
    }
  }

  /**
   * Clean up expired entries
   */
  private async cleanup(): Promise<void> {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return

    const lruKey = this.accessOrder[0]
    if (lruKey) {
      this.cache.delete(lruKey)
      this.accessOrder.shift()
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  /**
   * Remove a key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }
}

// ============================================================================
// Hash / Key Generation
// ============================================================================

/**
 * Generate a hash for cache keys
 * Uses a fast, non-cryptographic hash suitable for cache keys
 */
export function hashKey(input: unknown): string {
  const str = typeof input === 'string' ? input : stableStringify(input)

  // Simple djb2 hash
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  return (hash >>> 0).toString(36)
}

/**
 * Stringify an object with sorted keys for stable hashing
 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']'
  }

  const keys = Object.keys(obj).sort()
  const pairs = keys.map((key) => {
    return JSON.stringify(key) + ':' + stableStringify((obj as Record<string, unknown>)[key])
  })

  return '{' + pairs.join(',') + '}'
}

/**
 * Cache key type
 */
export type CacheKeyType = 'embedding' | 'generation'

/**
 * Create a cache key for a specific type and parameters
 */
export function createCacheKey(type: CacheKeyType, params: Record<string, unknown>): string {
  const hash = hashKey(params)
  return `${type}:${hash}`
}

// ============================================================================
// Embedding Cache
// ============================================================================

/**
 * Options for embedding cache operations
 */
export interface EmbeddingCacheOptions {
  /** The embedding model used */
  model: string
}

/**
 * Result from batch embedding cache lookup
 */
export interface BatchEmbeddingResult {
  /** Map of text to cached embedding */
  hits: Record<string, number[]>
  /** Texts that were not in cache */
  misses: string[]
}

/**
 * Specialized cache for embedding vectors
 */
export class EmbeddingCache {
  private storage: MemoryCache<number[]>
  private stats = { hits: 0, misses: 0 }

  constructor(options?: MemoryCacheOptions) {
    this.storage = new MemoryCache<number[]>(options)
  }

  /**
   * Get a cached embedding
   */
  async get(content: string, options: EmbeddingCacheOptions): Promise<number[] | undefined> {
    const key = createCacheKey('embedding', { content, model: options.model })
    const result = await this.storage.get(key)

    if (result) {
      this.stats.hits++
    } else {
      this.stats.misses++
    }

    return result
  }

  /**
   * Set a cached embedding
   */
  async set(content: string, embedding: number[], options: EmbeddingCacheOptions): Promise<void> {
    const key = createCacheKey('embedding', { content, model: options.model })
    await this.storage.set(key, embedding)
  }

  /**
   * Set multiple embeddings at once
   */
  async setMany(
    texts: string[],
    embeddings: number[][],
    options: EmbeddingCacheOptions
  ): Promise<void> {
    for (let i = 0; i < texts.length; i++) {
      await this.set(texts[i]!, embeddings[i]!, options)
    }
  }

  /**
   * Get multiple embeddings, returning hits and misses
   */
  async getMany(texts: string[], options: EmbeddingCacheOptions): Promise<BatchEmbeddingResult> {
    const hits: Record<string, number[]> = {}
    const misses: string[] = []

    for (const text of texts) {
      const embedding = await this.get(text, options)
      if (embedding) {
        hits[text] = embedding
        // Note: hits counter already incremented in get()
        this.stats.hits-- // Avoid double counting
      } else {
        misses.push(text)
        this.stats.misses-- // Avoid double counting
      }
    }

    // Add back correct counts
    this.stats.hits += Object.keys(hits).length
    this.stats.misses += misses.length

    return { hits, misses }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.storage['cache'].size,
    }
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    await this.storage.clear()
    this.stats = { hits: 0, misses: 0 }
  }
}

// ============================================================================
// Generation Cache
// ============================================================================

/**
 * Parameters for generation cache key
 */
export interface GenerationParams {
  /** The prompt text */
  prompt: string
  /** The model to use */
  model: string
  /** System prompt */
  system?: string
  /** Temperature setting */
  temperature?: number
  /** Schema version for structured outputs */
  schemaVersion?: string
}

/**
 * Options for generation cache retrieval
 */
export interface GenerationCacheGetOptions {
  /** Bypass cache and return undefined */
  bypass?: boolean
}

/**
 * Specialized cache for generation results
 */
export class GenerationCache {
  private storage: MemoryCache<unknown>
  private stats = { hits: 0, misses: 0 }

  constructor(options?: MemoryCacheOptions) {
    this.storage = new MemoryCache<unknown>(options)
  }

  /**
   * Get a cached generation result
   */
  async get<T = unknown>(
    params: GenerationParams,
    options?: GenerationCacheGetOptions
  ): Promise<T | undefined> {
    if (options?.bypass) {
      return undefined
    }

    const key = this.createKey(params)
    const result = await this.storage.get(key)

    if (result) {
      this.stats.hits++
    } else {
      this.stats.misses++
    }

    return result as T | undefined
  }

  /**
   * Set a cached generation result
   */
  async set<T = unknown>(params: GenerationParams, result: T): Promise<void> {
    const key = this.createKey(params)
    await this.storage.set(key, result)
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.storage['cache'].size,
    }
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    await this.storage.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * Create a cache key from generation parameters
   */
  private createKey(params: GenerationParams): string {
    const keyParams: Record<string, unknown> = {
      prompt: params.prompt,
      model: params.model,
    }

    if (params.system !== undefined) {
      keyParams['system'] = params.system
    }

    if (params.temperature !== undefined) {
      keyParams['temperature'] = params.temperature
    }

    if (params.schemaVersion !== undefined) {
      keyParams['schemaVersion'] = params.schemaVersion
    }

    return createCacheKey('generation', keyParams)
  }
}

// ============================================================================
// withCache Wrapper
// ============================================================================

/**
 * Options for withCache wrapper
 */
export interface WithCacheOptions<TArgs extends unknown[]> {
  /** Function to generate cache key from arguments */
  keyFn: (...args: TArgs) => string
  /** TTL for cached entries */
  ttl?: number
}

/**
 * Cached function type with bypass support
 */
export interface CachedFunction<TArgs extends unknown[], TResult> {
  (...args: TArgs): Promise<TResult>
  /** Call with cache bypass (force fresh result) */
  bypass: (...args: TArgs) => Promise<TResult>
}

/**
 * Wrap an async function with caching
 */
export function withCache<TArgs extends unknown[], TResult>(
  cache: CacheStorage<TResult>,
  fn: (...args: TArgs) => Promise<TResult>,
  options: WithCacheOptions<TArgs>
): CachedFunction<TArgs, TResult> {
  const { keyFn, ttl } = options

  const cachedFn = async (...args: TArgs): Promise<TResult> => {
    const key = keyFn(...args)

    // Check cache
    const cached = await cache.get(key)
    if (cached !== undefined) {
      return cached
    }

    // Execute function
    const result = await fn(...args)

    // Cache result (don't cache errors - they throw before reaching here)
    await cache.set(key, result, ttl !== undefined ? { ttl } : undefined)

    return result
  }

  // Add bypass method
  cachedFn.bypass = async (...args: TArgs): Promise<TResult> => {
    const key = keyFn(...args)

    // Execute function without checking cache
    const result = await fn(...args)

    // Update cache with new result
    await cache.set(key, result, ttl !== undefined ? { ttl } : undefined)

    return result
  }

  return cachedFn as CachedFunction<TArgs, TResult>
}
