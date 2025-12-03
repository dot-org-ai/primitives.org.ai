/**
 * Tests for ai-props cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MemoryPropsCache,
  LRUPropsCache,
  createCacheKey,
  getDefaultCache,
  configureCache,
  clearCache,
  DEFAULT_CACHE_TTL,
} from '../src/cache.js'

describe('createCacheKey', () => {
  it('creates consistent keys for same inputs', () => {
    const key1 = createCacheKey({ name: 'string' }, { id: 1 })
    const key2 = createCacheKey({ name: 'string' }, { id: 1 })
    expect(key1).toBe(key2)
  })

  it('creates different keys for different schemas', () => {
    const key1 = createCacheKey({ name: 'string' })
    const key2 = createCacheKey({ name: 'string', age: 'number' })
    expect(key1).not.toBe(key2)
  })

  it('creates different keys for different contexts', () => {
    const key1 = createCacheKey({ name: 'string' }, { id: 1 })
    const key2 = createCacheKey({ name: 'string' }, { id: 2 })
    expect(key1).not.toBe(key2)
  })

  it('handles undefined context', () => {
    const key1 = createCacheKey({ name: 'string' })
    const key2 = createCacheKey({ name: 'string' }, undefined)
    expect(key1).toBe(key2)
  })

  it('handles string schemas', () => {
    const key = createCacheKey('user name')
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('creates same key regardless of object key order', () => {
    const key1 = createCacheKey({ a: '1' }, { x: 1, y: 2 })
    const key2 = createCacheKey({ a: '1' }, { y: 2, x: 1 })
    expect(key1).toBe(key2)
  })
})

describe('MemoryPropsCache', () => {
  let cache: MemoryPropsCache

  beforeEach(() => {
    cache = new MemoryPropsCache()
  })

  it('stores and retrieves values', () => {
    cache.set('key1', { name: 'test' })
    const entry = cache.get<{ name: string }>('key1')

    expect(entry).toBeDefined()
    expect(entry?.props.name).toBe('test')
  })

  it('returns undefined for missing keys', () => {
    const entry = cache.get('nonexistent')
    expect(entry).toBeUndefined()
  })

  it('deletes entries', () => {
    cache.set('key1', { value: 1 })
    expect(cache.delete('key1')).toBe(true)
    expect(cache.get('key1')).toBeUndefined()
  })

  it('clears all entries', () => {
    cache.set('key1', { value: 1 })
    cache.set('key2', { value: 2 })
    cache.clear()

    expect(cache.size).toBe(0)
    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBeUndefined()
  })

  it('tracks size correctly', () => {
    expect(cache.size).toBe(0)

    cache.set('key1', { value: 1 })
    expect(cache.size).toBe(1)

    cache.set('key2', { value: 2 })
    expect(cache.size).toBe(2)

    cache.delete('key1')
    expect(cache.size).toBe(1)
  })

  it('respects TTL', async () => {
    const shortCache = new MemoryPropsCache(50) // 50ms TTL
    shortCache.set('key1', { value: 1 })

    expect(shortCache.get('key1')).toBeDefined()

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 60))

    expect(shortCache.get('key1')).toBeUndefined()
  })

  it('cleans up expired entries', async () => {
    const shortCache = new MemoryPropsCache(50)
    shortCache.set('key1', { value: 1 })
    shortCache.set('key2', { value: 2 })

    await new Promise(resolve => setTimeout(resolve, 60))

    const removed = shortCache.cleanup()
    expect(removed).toBe(2)
    expect(shortCache.size).toBe(0)
  })

  it('stores entry metadata', () => {
    cache.set('key1', { value: 1 })
    const entry = cache.get('key1')

    expect(entry).toBeDefined()
    expect(entry?.key).toBe('key1')
    expect(entry?.timestamp).toBeDefined()
    expect(typeof entry?.timestamp).toBe('number')
  })
})

describe('LRUPropsCache', () => {
  let cache: LRUPropsCache

  beforeEach(() => {
    cache = new LRUPropsCache(3) // Max 3 entries
  })

  it('stores and retrieves values', () => {
    cache.set('key1', { value: 1 })
    const entry = cache.get<{ value: number }>('key1')

    expect(entry?.props.value).toBe(1)
  })

  it('evicts oldest entries when at capacity', () => {
    cache.set('key1', { value: 1 })
    cache.set('key2', { value: 2 })
    cache.set('key3', { value: 3 })
    cache.set('key4', { value: 4 }) // Should evict key1

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBeDefined()
    expect(cache.get('key3')).toBeDefined()
    expect(cache.get('key4')).toBeDefined()
  })

  it('updates LRU order on access', () => {
    cache.set('key1', { value: 1 })
    cache.set('key2', { value: 2 })
    cache.set('key3', { value: 3 })

    // Access key1, making it most recently used
    cache.get('key1')

    // Add key4, should evict key2 (oldest now)
    cache.set('key4', { value: 4 })

    expect(cache.get('key1')).toBeDefined() // Still there
    expect(cache.get('key2')).toBeUndefined() // Evicted
    expect(cache.get('key3')).toBeDefined()
    expect(cache.get('key4')).toBeDefined()
  })

  it('respects TTL in addition to capacity', async () => {
    const shortCache = new LRUPropsCache(10, 50) // 50ms TTL
    shortCache.set('key1', { value: 1 })

    await new Promise(resolve => setTimeout(resolve, 60))

    expect(shortCache.get('key1')).toBeUndefined()
  })

  it('maintains correct size', () => {
    cache.set('key1', { value: 1 })
    cache.set('key2', { value: 2 })
    cache.set('key3', { value: 3 })

    expect(cache.size).toBe(3)

    cache.set('key4', { value: 4 })
    expect(cache.size).toBe(3) // Still 3 after eviction
  })
})

describe('Default cache management', () => {
  beforeEach(() => {
    clearCache()
  })

  it('getDefaultCache returns singleton', () => {
    const cache1 = getDefaultCache()
    const cache2 = getDefaultCache()
    expect(cache1).toBe(cache2)
  })

  it('configureCache creates new instance with TTL', () => {
    const oldCache = getDefaultCache()
    configureCache(1000)
    const newCache = getDefaultCache()

    // Should be a different instance
    expect(newCache).not.toBe(oldCache)
  })

  it('clearCache empties the cache', () => {
    const cache = getDefaultCache()
    cache.set('key1', { value: 1 })

    clearCache()

    expect(cache.size).toBe(0)
  })
})

describe('DEFAULT_CACHE_TTL', () => {
  it('is 5 minutes in milliseconds', () => {
    expect(DEFAULT_CACHE_TTL).toBe(5 * 60 * 1000)
  })
})
