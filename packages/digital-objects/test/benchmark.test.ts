import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryProvider } from '../src/memory-provider.js'
import type { DigitalObjectsProvider } from '../src/types.js'

describe('Performance Benchmarks', () => {
  let provider: DigitalObjectsProvider

  beforeEach(async () => {
    provider = createMemoryProvider()
    await provider.defineNoun({ name: 'Item' })
    await provider.defineVerb({ name: 'link' })
  })

  describe('create() performance', () => {
    it('should create 1000 things in under 100ms', async () => {
      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        await provider.create('Item', { index: i, name: `Item ${i}` })
      }

      const elapsed = performance.now() - start
      console.log(
        `create() 1000 items: ${elapsed.toFixed(2)}ms (${((1000 / elapsed) * 1000).toFixed(
          0
        )} ops/sec)`
      )
      expect(elapsed).toBeLessThan(100)
    })
  })

  describe('list() performance', () => {
    beforeEach(async () => {
      // Create 10k items
      for (let i = 0; i < 10000; i++) {
        await provider.create('Item', { index: i })
      }
    })

    it('should list 100 items from 10k in under 10ms', async () => {
      const start = performance.now()

      const items = await provider.list('Item', { limit: 100 })

      const elapsed = performance.now() - start
      console.log(`list() 100 from 10k: ${elapsed.toFixed(2)}ms`)
      expect(items.length).toBe(100)
      expect(elapsed).toBeLessThan(10)
    })

    it('should list with where filter in under 50ms', async () => {
      const start = performance.now()

      const items = await provider.list('Item', { where: { index: 5000 } })

      const elapsed = performance.now() - start
      console.log(`list() with where: ${elapsed.toFixed(2)}ms`)
      expect(elapsed).toBeLessThan(50)
    })
  })

  describe('related() performance', () => {
    beforeEach(async () => {
      // Create graph: 100 items with 10 relations each
      const items = []
      for (let i = 0; i < 100; i++) {
        items.push(await provider.create('Item', { index: i }))
      }
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 10; j++) {
          const target = (i + j + 1) % 100
          await provider.perform('link', items[i].id, items[target].id)
        }
      }
    })

    it('should traverse relations in under 20ms', async () => {
      const items = await provider.list('Item', { limit: 1 })
      const start = performance.now()

      const related = await provider.related(items[0].id, 'link', 'out')

      const elapsed = performance.now() - start
      console.log(`related() traversal: ${elapsed.toFixed(2)}ms, found ${related.length} items`)
      expect(elapsed).toBeLessThan(20)
    })
  })

  describe('search() performance', () => {
    beforeEach(async () => {
      for (let i = 0; i < 1000; i++) {
        await provider.create('Item', {
          name: `Item ${i}`,
          description: `This is a searchable description for item number ${i}`,
        })
      }
    })

    it('should search 1000 items in under 50ms', async () => {
      const start = performance.now()

      const results = await provider.search('searchable', { limit: 100 })

      const elapsed = performance.now() - start
      console.log(`search() 1000 items: ${elapsed.toFixed(2)}ms, found ${results.length} results`)
      expect(elapsed).toBeLessThan(50)
    })
  })
})
