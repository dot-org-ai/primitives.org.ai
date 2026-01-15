/**
 * Performance tests for N+1 query patterns
 *
 * These tests verify that related() uses batch queries instead of N+1 patterns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryProvider, MemoryProvider } from '../src/memory-provider.js'
import type { DigitalObjectsProvider, Thing } from '../src/types.js'

describe('N+1 Query Pattern Prevention', () => {
  let provider: MemoryProvider

  beforeEach(async () => {
    provider = createMemoryProvider() as MemoryProvider
    await provider.defineNoun({ name: 'Item' })
    await provider.defineVerb({ name: 'link' })
  })

  describe('related() should use batch query', () => {
    it('should fetch 100 related items with batch query, not 100 individual queries', async () => {
      // Create source item
      const source = await provider.create('Item', { name: 'source' })

      // Create 100 target items and link them
      const targets: Thing<{ name: string }>[] = []
      for (let i = 0; i < 100; i++) {
        const target = await provider.create('Item', { name: `target-${i}` })
        targets.push(target)
        await provider.perform('link', source.id, target.id)
      }

      // Spy on get() to count individual queries
      const getSpy = vi.spyOn(provider, 'get')

      // Fetch related items
      const related = await provider.related(source.id, 'link', 'out')

      // Verify we got all related items
      expect(related).toHaveLength(100)

      // KEY TEST: Should NOT call get() 100 times (N+1 pattern)
      // With batch query, get() should be called 0 times (uses getMany internally)
      expect(getSpy).toHaveBeenCalledTimes(0)
    })

    it('should have getMany() method for batch fetching', async () => {
      // Test that getMany method exists
      expect(typeof (provider as any).getMany).toBe('function')
    })

    it('getMany() should fetch multiple items in single operation', async () => {
      // Create multiple items
      const item1 = await provider.create('Item', { name: 'item-1' })
      const item2 = await provider.create('Item', { name: 'item-2' })
      const item3 = await provider.create('Item', { name: 'item-3' })

      // Fetch all at once
      const items = await (provider as any).getMany([item1.id, item2.id, item3.id])

      expect(items).toHaveLength(3)
      expect(items.map((i: Thing<{ name: string }>) => i.data.name).sort()).toEqual([
        'item-1',
        'item-2',
        'item-3',
      ])
    })

    it('getMany() should return empty array for empty input', async () => {
      const items = await (provider as any).getMany([])
      expect(items).toEqual([])
    })

    it('getMany() should skip non-existent IDs', async () => {
      const item1 = await provider.create('Item', { name: 'item-1' })

      const items = await (provider as any).getMany([
        item1.id,
        'non-existent-id-1',
        'non-existent-id-2',
      ])

      expect(items).toHaveLength(1)
      expect(items[0].id).toBe(item1.id)
    })
  })

  describe('related() performance benchmark', () => {
    it('should be faster with batch query than N+1', async () => {
      // Create source and many targets
      const source = await provider.create('Item', { name: 'source' })
      for (let i = 0; i < 100; i++) {
        const target = await provider.create('Item', { name: `target-${i}` })
        await provider.perform('link', source.id, target.id)
      }

      // Benchmark batch query approach
      const start = performance.now()
      const related = await provider.related(source.id, 'link', 'out')
      const batchTime = performance.now() - start

      expect(related).toHaveLength(100)

      // Log performance for visibility
      console.log(`related() with 100 items: ${batchTime.toFixed(2)}ms`)

      // Should be fast - batch query should complete well under 50ms
      expect(batchTime).toBeLessThan(50)
    })

    it('should handle large edge sets efficiently (500 edges)', async () => {
      const source = await provider.create('Item', { name: 'source' })
      for (let i = 0; i < 500; i++) {
        const target = await provider.create('Item', { name: `target-${i}` })
        await provider.perform('link', source.id, target.id)
      }

      const start = performance.now()
      const related = await provider.related(source.id, 'link', 'out')
      const elapsed = performance.now() - start

      console.log(`related() with 500 items: ${elapsed.toFixed(2)}ms`)

      // With batch query, should still be reasonably fast
      expect(elapsed).toBeLessThan(200)
    })
  })

  describe('related() with direction variations', () => {
    it('should use batch query for inbound relations', async () => {
      const target = await provider.create('Item', { name: 'target' })

      // Create 50 sources pointing to this target
      for (let i = 0; i < 50; i++) {
        const source = await provider.create('Item', { name: `source-${i}` })
        await provider.perform('link', source.id, target.id)
      }

      const getSpy = vi.spyOn(provider, 'get')
      const inbound = await provider.related(target.id, 'link', 'in')

      expect(inbound).toHaveLength(50)
      // Should NOT call get() 50 times
      expect(getSpy).toHaveBeenCalledTimes(0)
    })

    it('should use batch query for bidirectional relations', async () => {
      const node = await provider.create('Item', { name: 'node' })

      // Create edges in both directions
      for (let i = 0; i < 25; i++) {
        const other = await provider.create('Item', { name: `outbound-${i}` })
        await provider.perform('link', node.id, other.id)
      }
      for (let i = 0; i < 25; i++) {
        const other = await provider.create('Item', { name: `inbound-${i}` })
        await provider.perform('link', other.id, node.id)
      }

      const getSpy = vi.spyOn(provider, 'get')
      const both = await provider.related(node.id, 'link', 'both')

      expect(both).toHaveLength(50)
      // Should NOT call get() 50 times
      expect(getSpy).toHaveBeenCalledTimes(0)
    })
  })
})
