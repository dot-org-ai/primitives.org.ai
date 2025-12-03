/**
 * Props caching for ai-props
 *
 * Provides in-memory caching for generated props to avoid
 * redundant AI calls with the same context.
 *
 * @packageDocumentation
 */

import type { PropsCache, PropsCacheEntry } from './types.js'

/**
 * Default cache TTL (5 minutes)
 */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000

/**
 * Create a cache key from schema and context
 */
export function createCacheKey(
  schema: unknown,
  context?: Record<string, unknown>
): string {
  const schemaStr = typeof schema === 'string' ? schema : JSON.stringify(schema)
  const contextStr = context ? JSON.stringify(sortObject(context)) : ''
  return `${hashString(schemaStr)}:${hashString(contextStr)}`
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Sort object keys for consistent hashing
 */
function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key]
    sorted[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? sortObject(value as Record<string, unknown>)
      : value
  }
  return sorted
}

/**
 * In-memory props cache implementation
 */
export class MemoryPropsCache implements PropsCache {
  private cache = new Map<string, PropsCacheEntry>()
  private ttl: number

  constructor(ttl: number = DEFAULT_CACHE_TTL) {
    this.ttl = ttl
  }

  get<T>(key: string): PropsCacheEntry<T> | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    return entry as PropsCacheEntry<T>
  }

  set<T>(key: string, props: T): void {
    this.cache.set(key, {
      props,
      timestamp: Date.now(),
      key
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }

  /**
   * Get all entries (for debugging)
   */
  entries(): IterableIterator<[string, PropsCacheEntry]> {
    return this.cache.entries()
  }
}

/**
 * Global default cache instance
 */
let defaultCache: MemoryPropsCache | null = null

/**
 * Get or create the default cache
 */
export function getDefaultCache(): MemoryPropsCache {
  if (!defaultCache) {
    defaultCache = new MemoryPropsCache()
  }
  return defaultCache
}

/**
 * Configure the default cache
 */
export function configureCache(ttl: number): void {
  defaultCache = new MemoryPropsCache(ttl)
}

/**
 * Clear the default cache
 */
export function clearCache(): void {
  if (defaultCache) {
    defaultCache.clear()
  }
}

/**
 * LRU (Least Recently Used) cache implementation
 * For scenarios where memory usage needs to be bounded
 */
export class LRUPropsCache implements PropsCache {
  private cache = new Map<string, PropsCacheEntry>()
  private maxSize: number
  private ttl: number

  constructor(maxSize: number = 100, ttl: number = DEFAULT_CACHE_TTL) {
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get<T>(key: string): PropsCacheEntry<T> | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry as PropsCacheEntry<T>
  }

  set<T>(key: string, props: T): void {
    // Remove oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest) {
        this.cache.delete(oldest)
      } else {
        break
      }
    }

    this.cache.set(key, {
      props,
      timestamp: Date.now(),
      key
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}
