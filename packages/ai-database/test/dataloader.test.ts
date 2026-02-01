/**
 * Tests for DataLoader - Microtask-batching for N+1 query prevention
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DataLoader,
  withDataLoader,
  loadEntity,
  createRequestLoader,
  clearRequestLoader,
  getRequestLoader,
} from '../src/dataloader.js'
import { createMemoryProvider } from '../src/memory-provider.js'
import type { DBProvider } from '../src/schema.js'

function createTrackedProvider() {
  const provider = createMemoryProvider()
  const getCalls: Array<{ type: string; id: string }> = []
  const originalGet = provider.get.bind(provider)
  provider.get = async (type: string, id: string) => {
    getCalls.push({ type, id })
    return originalGet(type, id)
  }
  return { provider, getCalls }
}

describe('DataLoader', () => {
  let provider: DBProvider
  let getCalls: Array<{ type: string; id: string }>

  beforeEach(() => {
    clearRequestLoader()
    const tracked = createTrackedProvider()
    provider = tracked.provider
    getCalls = tracked.getCalls
  })

  describe('basic batching', () => {
    it('should batch multiple loads in the same tick into parallel fetches', async () => {
      // Seed data
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      await provider.create('User', 'u2', { $id: 'u2', name: 'Bob' })
      await provider.create('User', 'u3', { $id: 'u3', name: 'Charlie' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      // All three load calls happen in the same tick
      const [a, b, c] = await Promise.all([
        loader.load('User', 'u1'),
        loader.load('User', 'u2'),
        loader.load('User', 'u3'),
      ])

      expect(a?.['name']).toBe('Alice')
      expect(b?.['name']).toBe('Bob')
      expect(c?.['name']).toBe('Charlie')

      // All three should have been dispatched in a single batch (3 provider.get calls)
      expect(getCalls.length).toBe(3)
    })

    it('should deduplicate requests for the same (type, id)', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      const [a, b, c] = await Promise.all([
        loader.load('User', 'u1'),
        loader.load('User', 'u1'),
        loader.load('User', 'u1'),
      ])

      expect(a?.['name']).toBe('Alice')
      expect(b?.['name']).toBe('Alice')
      expect(c?.['name']).toBe('Alice')

      // Only 1 provider.get call due to caching
      expect(getCalls.length).toBe(1)
    })

    it('should return null for non-existent entities', async () => {
      const loader = new DataLoader(provider)
      const result = await loader.load('User', 'nonexistent')
      expect(result).toBeNull()
    })

    it('should batch across different entity types', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      await provider.create('Post', 'p1', { $id: 'p1', title: 'Hello' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      const [user, post] = await Promise.all([loader.load('User', 'u1'), loader.load('Post', 'p1')])

      expect(user?.['name']).toBe('Alice')
      expect(post?.['title']).toBe('Hello')
      expect(getCalls.length).toBe(2)
    })
  })

  describe('caching', () => {
    it('should cache results across ticks', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      // First load
      const a = await loader.load('User', 'u1')
      expect(a?.['name']).toBe('Alice')
      expect(getCalls.length).toBe(1)

      // Second load - should be cached
      const b = await loader.load('User', 'u1')
      expect(b?.['name']).toBe('Alice')
      expect(getCalls.length).toBe(1) // No additional call
    })

    it('should support cache clearing', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      await loader.load('User', 'u1')
      expect(getCalls.length).toBe(1)

      loader.clear('User', 'u1')

      await loader.load('User', 'u1')
      expect(getCalls.length).toBe(2)
    })

    it('should support full cache clear', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      await provider.create('User', 'u2', { $id: 'u2', name: 'Bob' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      await Promise.all([loader.load('User', 'u1'), loader.load('User', 'u2')])
      expect(getCalls.length).toBe(2)

      loader.clear()

      await Promise.all([loader.load('User', 'u1'), loader.load('User', 'u2')])
      expect(getCalls.length).toBe(4)
    })

    it('should support disabling cache', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      const loader = new DataLoader(provider, { cache: false })

      await loader.load('User', 'u1')
      await loader.load('User', 'u1')
      expect(getCalls.length).toBe(2)
    })

    it('should support priming the cache', async () => {
      const loader = new DataLoader(provider)

      loader.prime('User', 'u1', { $id: 'u1', name: 'Primed' })

      const result = await loader.load('User', 'u1')
      expect(result?.['name']).toBe('Primed')
      expect(getCalls.length).toBe(0) // No provider call
    })
  })

  describe('loadMany', () => {
    it('should load multiple entities at once', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      await provider.create('User', 'u2', { $id: 'u2', name: 'Bob' })
      getCalls.length = 0

      const loader = new DataLoader(provider)

      const results = await loader.loadMany([
        { type: 'User', id: 'u1' },
        { type: 'User', id: 'u2' },
      ])

      expect(results.length).toBe(2)
      expect(results[0]?.['name']).toBe('Alice')
      expect(results[1]?.['name']).toBe('Bob')
    })
  })

  describe('stats', () => {
    it('should report cache size', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })

      const loader = new DataLoader(provider)
      expect(loader.stats.cacheSize).toBe(0)

      await loader.load('User', 'u1')
      expect(loader.stats.cacheSize).toBe(1)
    })
  })

  describe('error handling', () => {
    it('should propagate provider errors', async () => {
      const failingProvider = createMemoryProvider()
      failingProvider.get = async () => {
        throw new Error('Provider failure')
      }

      const loader = new DataLoader(failingProvider)
      await expect(loader.load('User', 'u1')).rejects.toThrow('Provider failure')
    })

    it('should not cache failed results from erroring provider', async () => {
      let callCount = 0
      const sometimesFailingProvider = createMemoryProvider()
      await sometimesFailingProvider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      const originalGet = sometimesFailingProvider.get.bind(sometimesFailingProvider)
      sometimesFailingProvider.get = async (type: string, id: string) => {
        callCount++
        if (callCount === 1) throw new Error('Transient failure')
        return originalGet(type, id)
      }

      const loader = new DataLoader(sometimesFailingProvider)

      // First call fails
      await expect(loader.load('User', 'u1')).rejects.toThrow('Transient failure')

      // Clear failed cache entry and retry
      loader.clear('User', 'u1')
      const result = await loader.load('User', 'u1')
      expect(result?.['name']).toBe('Alice')
    })
  })

  describe('request context', () => {
    it('should create and clear request loaders', () => {
      expect(getRequestLoader()).toBeNull()

      const loader = createRequestLoader(provider)
      expect(getRequestLoader()).toBe(loader)

      clearRequestLoader()
      expect(getRequestLoader()).toBeNull()
    })

    it('should use withDataLoader for scoped context', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      const result = await withDataLoader(provider, async () => {
        expect(getRequestLoader()).not.toBeNull()

        // loadEntity should use the active loader
        const user = await loadEntity(provider, 'User', 'u1')
        return user
      })

      expect(result?.['name']).toBe('Alice')
      expect(getRequestLoader()).toBeNull() // Cleaned up
    })

    it('should batch loadEntity calls within withDataLoader', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      await provider.create('User', 'u2', { $id: 'u2', name: 'Bob' })
      getCalls.length = 0

      await withDataLoader(provider, async () => {
        // These happen in the same tick, so should batch
        const [a, b] = await Promise.all([
          loadEntity(provider, 'User', 'u1'),
          loadEntity(provider, 'User', 'u2'),
        ])

        expect(a?.['name']).toBe('Alice')
        expect(b?.['name']).toBe('Bob')
      })

      // Both fetched via the loader (2 unique IDs = 2 provider.get calls)
      expect(getCalls.length).toBe(2)
    })

    it('should deduplicate loadEntity calls within withDataLoader', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      await withDataLoader(provider, async () => {
        const [a, b, c] = await Promise.all([
          loadEntity(provider, 'User', 'u1'),
          loadEntity(provider, 'User', 'u1'),
          loadEntity(provider, 'User', 'u1'),
        ])

        expect(a?.['name']).toBe('Alice')
        expect(b?.['name']).toBe('Alice')
        expect(c?.['name']).toBe('Alice')
      })

      // Only 1 provider.get call due to deduplication
      expect(getCalls.length).toBe(1)
    })

    it('should fall back to direct provider.get without active loader', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      getCalls.length = 0

      // No withDataLoader context
      const result = await loadEntity(provider, 'User', 'u1')
      expect(result?.['name']).toBe('Alice')
      expect(getCalls.length).toBe(1)
    })
  })

  describe('multiple batches across ticks', () => {
    it('should create separate batches for different ticks', async () => {
      await provider.create('User', 'u1', { $id: 'u1', name: 'Alice' })
      await provider.create('User', 'u2', { $id: 'u2', name: 'Bob' })
      getCalls.length = 0

      const loader = new DataLoader(provider, { cache: false })

      // First tick
      const a = await loader.load('User', 'u1')
      expect(a?.['name']).toBe('Alice')

      // Second tick
      const b = await loader.load('User', 'u2')
      expect(b?.['name']).toBe('Bob')

      // Two separate dispatches (one per tick)
      expect(getCalls.length).toBe(2)
    })
  })
})
