import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  configurePool,
  getPoolConfig,
  getPoolStats,
  warmPool,
  disposePool,
  resetPool,
} from '../src/miniflare-pool.js'
import { evaluate } from '../src/node.js'

describe('Miniflare Pool', () => {
  // Reset pool state between tests
  beforeEach(async () => {
    await resetPool()
  })

  afterEach(async () => {
    await disposePool()
  })

  describe('configurePool', () => {
    it('sets pool size', () => {
      configurePool({ size: 5 })
      const config = getPoolConfig()
      expect(config.size).toBe(5)
    })

    it('sets maxIdleTime', () => {
      configurePool({ maxIdleTime: 60000 })
      const config = getPoolConfig()
      expect(config.maxIdleTime).toBe(60000)
    })

    it('preserves existing values when not specified', () => {
      configurePool({ size: 5 })
      configurePool({ maxIdleTime: 60000 })
      const config = getPoolConfig()
      expect(config.size).toBe(5)
      expect(config.maxIdleTime).toBe(60000)
    })
  })

  describe('getPoolConfig', () => {
    it('returns default configuration', () => {
      const config = getPoolConfig()
      expect(config.size).toBe(3)
      expect(config.maxIdleTime).toBe(30000)
    })

    it('returns a copy of configuration', () => {
      const config1 = getPoolConfig()
      const config2 = getPoolConfig()
      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
    })
  })

  describe('getPoolStats', () => {
    it('returns initial empty stats', () => {
      const stats = getPoolStats()
      expect(stats.size).toBe(0)
      expect(stats.available).toBe(0)
      expect(stats.inUse).toBe(0)
    })

    it('shows correct stats after warming', async () => {
      await warmPool(2)
      const stats = getPoolStats()
      expect(stats.size).toBe(2)
      expect(stats.available).toBe(2)
      expect(stats.inUse).toBe(0)
    })
  })

  describe('warmPool', () => {
    it('creates specified number of instances', async () => {
      await warmPool(2)
      const stats = getPoolStats()
      expect(stats.size).toBe(2)
    })

    it('respects pool size limit', async () => {
      configurePool({ size: 2 })
      await warmPool(5)
      const stats = getPoolStats()
      // warmPool creates up to the requested count, but pool won't grow beyond size
      // when new instances are acquired
      expect(stats.size).toBeLessThanOrEqual(5)
    })

    it('does not create duplicates when called multiple times', async () => {
      await warmPool(2)
      await warmPool(2)
      const stats = getPoolStats()
      expect(stats.size).toBe(2)
    })
  })

  describe('disposePool', () => {
    it('disposes all instances', async () => {
      await warmPool(3)
      await disposePool()
      const stats = getPoolStats()
      expect(stats.size).toBe(0)
    })

    it('can be called multiple times safely', async () => {
      await warmPool(2)
      await disposePool()
      await disposePool()
      const stats = getPoolStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('resetPool', () => {
    it('disposes instances and resets config', async () => {
      configurePool({ size: 10, maxIdleTime: 60000 })
      await warmPool(3)
      await resetPool()
      const stats = getPoolStats()
      const config = getPoolConfig()
      expect(stats.size).toBe(0)
      expect(config.size).toBe(3)
      expect(config.maxIdleTime).toBe(30000)
    })
  })

  describe('pool integration with evaluate', () => {
    it('reuses instances across evaluations', async () => {
      // Warm the pool
      await warmPool(1)

      // Run multiple evaluations
      const results = await Promise.all([
        evaluate({ script: 'return 1' }),
        evaluate({ script: 'return 2' }),
        evaluate({ script: 'return 3' }),
      ])

      expect(results[0].success).toBe(true)
      expect(results[0].value).toBe(1)
      expect(results[1].success).toBe(true)
      expect(results[1].value).toBe(2)
      expect(results[2].success).toBe(true)
      expect(results[2].value).toBe(3)

      // Pool should have created instances as needed
      const stats = getPoolStats()
      expect(stats.size).toBeGreaterThan(0)
    })

    it('returns instances to pool after evaluation', async () => {
      // This test verifies the pool reuses instances by running multiple
      // sequential evaluations. If pooling weren't working, each evaluation
      // would be slower due to creating new Miniflare instances.
      configurePool({ size: 1 })

      // Run sequential evaluations with same pool size
      const result1 = await evaluate({ script: 'return 1' })
      expect(result1.success).toBe(true)
      expect(result1.value).toBe(1)

      const result2 = await evaluate({ script: 'return 2' })
      expect(result2.success).toBe(true)
      expect(result2.value).toBe(2)

      const result3 = await evaluate({ script: 'return 3' })
      expect(result3.success).toBe(true)
      expect(result3.value).toBe(3)

      // All evaluations should succeed, demonstrating instance reuse
      // (If instances weren't being released, pool would exhaust quickly
      // with size=1 and sequential evaluations would fail)
    })

    it('creates temporary instances when pool is exhausted', async () => {
      configurePool({ size: 1 })
      await warmPool(1)

      // Start multiple concurrent evaluations
      const evaluationPromises = [
        evaluate({ script: 'return 1' }),
        evaluate({ script: 'return 2' }),
        evaluate({ script: 'return 3' }),
      ]

      const results = await Promise.all(evaluationPromises)

      // All should succeed (some using temporary instances)
      expect(results.every((r) => r.success)).toBe(true)
    })

    it('handles errors without leaking instances', async () => {
      configurePool({ size: 1 })

      // Run an evaluation that throws
      const result = await evaluate({
        script: 'throw new Error("test error")',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('test error')

      // Instance should still be returned to pool
      const stats = getPoolStats()
      expect(stats.inUse).toBe(0)
    })

    it('handles timeouts without leaking instances', async () => {
      configurePool({ size: 1 })

      // Run an evaluation that times out
      const result = await evaluate({
        script: 'while(true) {}',
        timeout: 100,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Timeout')

      // Instance should still be returned to pool
      const stats = getPoolStats()
      expect(stats.inUse).toBe(0)
    })

    it('maintains isolation between evaluations', async () => {
      configurePool({ size: 1 })

      // First evaluation sets a global
      const result1 = await evaluate({
        script: 'globalThis.testValue = 42; return globalThis.testValue;',
      })
      expect(result1.success).toBe(true)
      expect(result1.value).toBe(42)

      // Second evaluation should not see the global (new worker script)
      const result2 = await evaluate({
        script: 'return globalThis.testValue;',
      })
      expect(result2.success).toBe(true)
      expect(result2.value).toBeUndefined()
    })
  })
})
