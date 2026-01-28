/**
 * Tests for Experiment class - A/B testing primitives
 *
 * These tests verify the core experiment functionality including:
 * - Experiment creation and execution
 * - Variant comparison
 * - Metric calculation
 * - Best variant selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Experiment,
  createVariantsFromGrid,
  configureTracking,
  createMemoryBackend,
} from '../src/index.js'

// Use memory backend for testing to avoid console output
const testBackend = createMemoryBackend()

describe('Experiment', () => {
  beforeEach(() => {
    testBackend.clear()
    configureTracking({ backend: testBackend, enabled: true })
  })

  describe('basic experiment creation', () => {
    it('executes variants and returns results', async () => {
      const results = await Experiment({
        id: 'test-experiment',
        name: 'Test Experiment',
        variants: [
          {
            id: 'variant-a',
            name: 'Variant A',
            config: { value: 1 },
          },
          {
            id: 'variant-b',
            name: 'Variant B',
            config: { value: 2 },
          },
        ],
        execute: async (config) => {
          return { computed: config.value * 10 }
        },
      })

      expect(results.experimentId).toBe('test-experiment')
      expect(results.experimentName).toBe('Test Experiment')
      expect(results.results).toHaveLength(2)
      expect(results.successCount).toBe(2)
      expect(results.failureCount).toBe(0)
    })

    it('returns ExperimentSummary with all required fields', async () => {
      const results = await Experiment({
        id: 'summary-test',
        name: 'Summary Test',
        variants: [{ id: 'v1', name: 'V1', config: {} }],
        execute: async () => 'done',
      })

      expect(results).toHaveProperty('experimentId')
      expect(results).toHaveProperty('experimentName')
      expect(results).toHaveProperty('results')
      expect(results).toHaveProperty('totalDuration')
      expect(results).toHaveProperty('successCount')
      expect(results).toHaveProperty('failureCount')
      expect(results).toHaveProperty('startedAt')
      expect(results).toHaveProperty('completedAt')
      expect(results.startedAt).toBeInstanceOf(Date)
      expect(results.completedAt).toBeInstanceOf(Date)
    })

    it('handles single variant', async () => {
      const results = await Experiment({
        id: 'single-variant',
        name: 'Single Variant Test',
        variants: [{ id: 'only', name: 'Only Variant', config: { x: 42 } }],
        execute: async (config) => config.x,
      })

      expect(results.results).toHaveLength(1)
      expect(results.results[0].result).toBe(42)
    })

    it('provides context to execute function', async () => {
      let capturedContext: unknown = null

      await Experiment({
        id: 'context-test',
        name: 'Context Test',
        variants: [{ id: 'v1', name: 'V1', config: {} }],
        execute: async (config, context) => {
          capturedContext = context
          return 'done'
        },
      })

      expect(capturedContext).not.toBeNull()
      expect(capturedContext).toHaveProperty('experimentId', 'context-test')
      expect(capturedContext).toHaveProperty('variantId', 'v1')
      expect(capturedContext).toHaveProperty('runId')
      expect(capturedContext).toHaveProperty('startedAt')
    })
  })

  describe('metric calculation', () => {
    it('computes metric for each variant', async () => {
      const results = await Experiment({
        id: 'metric-test',
        name: 'Metric Test',
        variants: [
          { id: 'low', name: 'Low Score', config: { score: 30 } },
          { id: 'high', name: 'High Score', config: { score: 90 } },
        ],
        execute: async (config) => config.score,
        metric: (result) => result,
      })

      expect(results.results[0].metricValue).toBe(30)
      expect(results.results[1].metricValue).toBe(90)
    })

    it('identifies best variant by metric', async () => {
      const results = await Experiment({
        id: 'best-variant-test',
        name: 'Best Variant Test',
        variants: [
          { id: 'poor', name: 'Poor', config: { quality: 0.3 } },
          { id: 'good', name: 'Good', config: { quality: 0.7 } },
          { id: 'excellent', name: 'Excellent', config: { quality: 0.95 } },
        ],
        execute: async (config) => ({ quality: config.quality }),
        metric: (result) => result.quality,
      })

      expect(results.bestVariant).toBeDefined()
      expect(results.bestVariant?.variantId).toBe('excellent')
      expect(results.bestVariant?.variantName).toBe('Excellent')
      expect(results.bestVariant?.metricValue).toBe(0.95)
    })

    it('supports async metric function', async () => {
      const results = await Experiment({
        id: 'async-metric',
        name: 'Async Metric Test',
        variants: [{ id: 'v1', name: 'V1', config: { value: 42 } }],
        execute: async (config) => config.value,
        metric: async (result) => {
          await new Promise((r) => setTimeout(r, 10))
          return result * 2
        },
      })

      expect(results.results[0].metricValue).toBe(84)
    })
  })

  describe('execution options', () => {
    it('runs variants in parallel by default', async () => {
      const executionOrder: string[] = []

      await Experiment({
        id: 'parallel-test',
        name: 'Parallel Test',
        variants: [
          { id: 'v1', name: 'V1', config: { delay: 50, id: 'v1' } },
          { id: 'v2', name: 'V2', config: { delay: 10, id: 'v2' } },
        ],
        execute: async (config) => {
          await new Promise((r) => setTimeout(r, config.delay))
          executionOrder.push(config.id)
          return config.id
        },
      })

      // In parallel mode, v2 should finish before v1 due to shorter delay
      expect(executionOrder).toEqual(['v2', 'v1'])
    })

    it('runs variants sequentially when parallel=false', async () => {
      const executionOrder: string[] = []

      await Experiment(
        {
          id: 'sequential-test',
          name: 'Sequential Test',
          variants: [
            { id: 'v1', name: 'V1', config: { delay: 20, id: 'v1' } },
            { id: 'v2', name: 'V2', config: { delay: 10, id: 'v2' } },
          ],
          execute: async (config) => {
            await new Promise((r) => setTimeout(r, config.delay))
            executionOrder.push(config.id)
            return config.id
          },
        },
        { parallel: false }
      )

      // In sequential mode, v1 should finish before v2 starts
      expect(executionOrder).toEqual(['v1', 'v2'])
    })

    it('respects maxConcurrency option', async () => {
      let concurrent = 0
      let maxConcurrent = 0

      await Experiment(
        {
          id: 'concurrency-test',
          name: 'Concurrency Test',
          variants: Array.from({ length: 4 }, (_, i) => ({
            id: `v${i}`,
            name: `Variant ${i}`,
            config: { index: i },
          })),
          execute: async () => {
            concurrent++
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await new Promise((r) => setTimeout(r, 50))
            concurrent--
            return 'done'
          },
        },
        { maxConcurrency: 2 }
      )

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('calls onVariantStart callback', async () => {
      const startedVariants: string[] = []

      await Experiment(
        {
          id: 'callback-start-test',
          name: 'Callback Start Test',
          variants: [
            { id: 'v1', name: 'V1', config: {} },
            { id: 'v2', name: 'V2', config: {} },
          ],
          execute: async () => 'done',
        },
        {
          parallel: false,
          onVariantStart: (variantId) => {
            startedVariants.push(variantId)
          },
        }
      )

      expect(startedVariants).toEqual(['v1', 'v2'])
    })

    it('calls onVariantComplete callback', async () => {
      const completedResults: number[] = []

      await Experiment(
        {
          id: 'callback-complete-test',
          name: 'Callback Complete Test',
          variants: [
            { id: 'v1', name: 'V1', config: { val: 10 } },
            { id: 'v2', name: 'V2', config: { val: 20 } },
          ],
          execute: async (config) => config.val,
          metric: (result) => result,
        },
        {
          parallel: false,
          onVariantComplete: (result) => {
            completedResults.push(result.metricValue!)
          },
        }
      )

      expect(completedResults).toEqual([10, 20])
    })
  })

  describe('error handling', () => {
    it('captures variant errors without stopping experiment', async () => {
      const results = await Experiment({
        id: 'error-test',
        name: 'Error Test',
        variants: [
          { id: 'success', name: 'Success', config: { fail: false } },
          { id: 'failure', name: 'Failure', config: { fail: true } },
          { id: 'success2', name: 'Success 2', config: { fail: false } },
        ],
        execute: async (config) => {
          if (config.fail) {
            throw new Error('Intentional failure')
          }
          return 'ok'
        },
      })

      expect(results.successCount).toBe(2)
      expect(results.failureCount).toBe(1)

      const failedResult = results.results.find((r) => r.variantId === 'failure')
      expect(failedResult?.success).toBe(false)
      expect(failedResult?.error).toBeInstanceOf(Error)
      expect(failedResult?.error?.message).toBe('Intentional failure')
    })

    it('stops on first error when stopOnError=true', async () => {
      const executedVariants: string[] = []

      const results = await Experiment(
        {
          id: 'stop-on-error-test',
          name: 'Stop on Error Test',
          variants: [
            { id: 'v1', name: 'V1', config: { fail: false } },
            { id: 'v2', name: 'V2', config: { fail: true } },
            { id: 'v3', name: 'V3', config: { fail: false } },
          ],
          execute: async (config) => {
            executedVariants.push(config.fail ? 'fail' : 'success')
            if (config.fail) {
              throw new Error('Stop here')
            }
            return 'ok'
          },
        },
        { parallel: false, stopOnError: true }
      )

      // Should have stopped after v2's error
      expect(results.results.length).toBeLessThanOrEqual(2)
      expect(executedVariants).toContain('fail')
    })

    it('calls onVariantError callback', async () => {
      const errors: { variantId: string; message: string }[] = []

      await Experiment(
        {
          id: 'error-callback-test',
          name: 'Error Callback Test',
          variants: [
            { id: 'ok', name: 'OK', config: { fail: false } },
            { id: 'bad', name: 'Bad', config: { fail: true } },
          ],
          execute: async (config) => {
            if (config.fail) {
              throw new Error('Expected error')
            }
            return 'ok'
          },
        },
        {
          onVariantError: (variantId, error) => {
            errors.push({ variantId, message: error.message })
          },
        }
      )

      expect(errors).toHaveLength(1)
      expect(errors[0].variantId).toBe('bad')
      expect(errors[0].message).toBe('Expected error')
    })
  })

  describe('tracking integration', () => {
    it('tracks experiment start and complete events', async () => {
      await Experiment({
        id: 'tracking-test',
        name: 'Tracking Test',
        variants: [{ id: 'v1', name: 'V1', config: {} }],
        execute: async () => 'done',
      })

      const events = testBackend.getEvents()
      const eventTypes = events.map((e) => e.type)

      expect(eventTypes).toContain('experiment.start')
      expect(eventTypes).toContain('experiment.complete')
      expect(eventTypes).toContain('variant.start')
      expect(eventTypes).toContain('variant.complete')
    })

    it('tracks metric computation', async () => {
      await Experiment({
        id: 'metric-tracking-test',
        name: 'Metric Tracking Test',
        variants: [{ id: 'v1', name: 'V1', config: {} }],
        execute: async () => 42,
        metric: (result) => result,
      })

      const events = testBackend.getEvents()
      const metricEvent = events.find((e) => e.type === 'metric.computed')

      expect(metricEvent).toBeDefined()
      expect(metricEvent?.data.metricValue).toBe(42)
    })
  })
})

describe('createVariantsFromGrid', () => {
  it('creates variants from single parameter', () => {
    const variants = createVariantsFromGrid({
      temperature: [0.3, 0.7, 1.0],
    })

    expect(variants).toHaveLength(3)
    expect(variants[0].config).toEqual({ temperature: 0.3 })
    expect(variants[1].config).toEqual({ temperature: 0.7 })
    expect(variants[2].config).toEqual({ temperature: 1.0 })
  })

  it('creates cartesian product of multiple parameters', () => {
    const variants = createVariantsFromGrid({
      model: ['a', 'b'],
      temperature: [0.3, 0.7],
    })

    // 2 * 2 = 4 combinations
    expect(variants).toHaveLength(4)

    const configs = variants.map((v) => v.config)
    expect(configs).toContainEqual({ model: 'a', temperature: 0.3 })
    expect(configs).toContainEqual({ model: 'a', temperature: 0.7 })
    expect(configs).toContainEqual({ model: 'b', temperature: 0.3 })
    expect(configs).toContainEqual({ model: 'b', temperature: 0.7 })
  })

  it('assigns unique IDs to each variant', () => {
    const variants = createVariantsFromGrid({
      x: [1, 2, 3],
    })

    const ids = variants.map((v) => v.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })

  it('generates descriptive names from config values', () => {
    const variants = createVariantsFromGrid({
      model: ['sonnet'],
      temp: [0.5],
    })

    expect(variants[0].name).toContain('model=sonnet')
    expect(variants[0].name).toContain('temp=0.5')
  })

  it('handles three or more parameters', () => {
    const variants = createVariantsFromGrid({
      a: [1, 2],
      b: ['x', 'y'],
      c: [true, false],
    })

    // 2 * 2 * 2 = 8 combinations
    expect(variants).toHaveLength(8)
  })

  it('handles empty grid by returning single variant with empty config', () => {
    const variants = createVariantsFromGrid({})
    // The implementation returns a single variant with empty config for empty grid
    expect(variants).toHaveLength(1)
    expect(variants[0].config).toEqual({})
  })
})
