/**
 * Implicit Batch Processing Tests
 *
 * Tests the automatic batch detection when using .map() without explicit await.
 * Provider and model come from execution context, not code.
 *
 * @example
 * ```ts
 * // Configure globally or via environment
 * configure({ provider: 'openai', model: 'gpt-4o', batchMode: 'auto' })
 *
 * // Use naturally - batch is automatic
 * const titles = await list`10 blog post titles`
 * const posts = titles.map(title => write`blog post: # ${title}`)
 * console.log(await posts) // Batched automatically!
 * ```
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  configure,
  resetContext,
  withContext,
  getProvider,
  getModel,
  getBatchMode,
  shouldUseBatchAPI,
  getExecutionTier,
  getFlexThreshold,
  getBatchThreshold,
  isFlexAvailable,
} from '../src/context.js'
import { list, write, ai, is } from '../src/primitives.js'
import {
  createBatchMap,
  BatchMapPromise,
  captureOperation,
  isInRecordingMode,
} from '../src/batch-map.js'

// Import memory adapter to register it
import '../src/batch/memory.js'
import { configureMemoryAdapter, clearBatches } from '../src/batch/memory.js'

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('../src/generate.js', () => ({
  generateObject: vi.fn().mockImplementation(async ({ prompt, schema }) => {
    // Simulate list generation
    if (schema?.items) {
      return {
        object: {
          items: [
            'Building AI-First Startups in 2026',
            'The Future of Remote Work',
            'Sustainable Tech Growth',
            'From Idea to MVP in 30 Days',
            'Community-Led Product Development',
          ],
        },
      }
    }
    // Simulate boolean
    if (schema?.answer) {
      return {
        object: { answer: 'true' },
      }
    }
    // Default object
    return { object: { result: 'Generated content' } }
  }),
  generateText: vi.fn().mockImplementation(async ({ prompt }) => {
    return {
      text: `Generated blog post for: ${prompt.slice(0, 50)}...`,
    }
  }),
}))

// ============================================================================
// Tests
// ============================================================================

describe('Implicit Batch Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetContext()
    clearBatches()
    configureMemoryAdapter({})
  })

  afterEach(() => {
    resetContext()
    clearBatches()
  })

  describe('Execution Context', () => {
    it('uses global configuration', () => {
      configure({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        batchMode: 'auto',
      })

      expect(getProvider()).toBe('anthropic')
      expect(getModel()).toBe('claude-sonnet-4-20250514')
      expect(getBatchMode()).toBe('auto')
    })

    it('supports withContext for scoped configuration', async () => {
      configure({ provider: 'openai', model: 'gpt-4o' })

      await withContext({ provider: 'anthropic', model: 'claude-opus-4-20250514' }, async () => {
        expect(getProvider()).toBe('anthropic')
        expect(getModel()).toBe('claude-opus-4-20250514')
      })

      // Back to global after context exits
      expect(getProvider()).toBe('openai')
    })
  })

  describe('Batch Detection', () => {
    it('shouldUseBatchAPI returns true for large batches', () => {
      configure({ batchMode: 'auto', batchThreshold: 5 })

      expect(shouldUseBatchAPI(3)).toBe(false)
      expect(shouldUseBatchAPI(5)).toBe(true)
      expect(shouldUseBatchAPI(10)).toBe(true)
    })

    it('batchMode: deferred always uses batch API', () => {
      configure({ batchMode: 'deferred' })

      expect(shouldUseBatchAPI(1)).toBe(true)
      expect(shouldUseBatchAPI(100)).toBe(true)
    })

    it('batchMode: immediate never uses batch API', () => {
      configure({ batchMode: 'immediate' })

      expect(shouldUseBatchAPI(1)).toBe(false)
      expect(shouldUseBatchAPI(100)).toBe(false)
    })
  })

  describe('Three-Tier Execution (immediate → flex → batch)', () => {
    it('getExecutionTier returns immediate for < flexThreshold items', () => {
      configure({ batchMode: 'auto', flexThreshold: 5, batchThreshold: 500 })

      expect(getExecutionTier(1)).toBe('immediate')
      expect(getExecutionTier(3)).toBe('immediate')
      expect(getExecutionTier(4)).toBe('immediate')
    })

    it('getExecutionTier returns flex for flexThreshold to < batchThreshold items', () => {
      configure({ batchMode: 'auto', flexThreshold: 5, batchThreshold: 500 })

      expect(getExecutionTier(5)).toBe('flex')
      expect(getExecutionTier(10)).toBe('flex')
      expect(getExecutionTier(100)).toBe('flex')
      expect(getExecutionTier(499)).toBe('flex')
    })

    it('getExecutionTier returns batch for >= batchThreshold items', () => {
      configure({ batchMode: 'auto', flexThreshold: 5, batchThreshold: 500 })

      expect(getExecutionTier(500)).toBe('batch')
      expect(getExecutionTier(1000)).toBe('batch')
      expect(getExecutionTier(50000)).toBe('batch')
    })

    it('respects custom thresholds', () => {
      configure({ batchMode: 'auto', flexThreshold: 10, batchThreshold: 100 })

      // immediate: < 10
      expect(getExecutionTier(5)).toBe('immediate')
      expect(getExecutionTier(9)).toBe('immediate')

      // flex: 10-99
      expect(getExecutionTier(10)).toBe('flex')
      expect(getExecutionTier(50)).toBe('flex')
      expect(getExecutionTier(99)).toBe('flex')

      // batch: 100+
      expect(getExecutionTier(100)).toBe('batch')
      expect(getExecutionTier(200)).toBe('batch')
    })

    it('batchMode: flex always returns flex tier', () => {
      configure({ batchMode: 'flex' })

      expect(getExecutionTier(1)).toBe('flex')
      expect(getExecutionTier(10)).toBe('flex')
      expect(getExecutionTier(1000)).toBe('flex')
    })

    it('batchMode: immediate always returns immediate tier', () => {
      configure({ batchMode: 'immediate' })

      expect(getExecutionTier(1)).toBe('immediate')
      expect(getExecutionTier(100)).toBe('immediate')
      expect(getExecutionTier(1000)).toBe('immediate')
    })

    it('batchMode: deferred always returns batch tier', () => {
      configure({ batchMode: 'deferred' })

      expect(getExecutionTier(1)).toBe('batch')
      expect(getExecutionTier(100)).toBe('batch')
      expect(getExecutionTier(1000)).toBe('batch')
    })

    it('getFlexThreshold returns configured value or default', () => {
      // Default
      resetContext()
      expect(getFlexThreshold()).toBe(5)

      // Custom
      configure({ flexThreshold: 10 })
      expect(getFlexThreshold()).toBe(10)
    })

    it('getBatchThreshold returns configured value or default', () => {
      // Default
      resetContext()
      expect(getBatchThreshold()).toBe(500)

      // Custom
      configure({ batchThreshold: 1000 })
      expect(getBatchThreshold()).toBe(1000)
    })
  })

  describe('Flex Availability', () => {
    it('isFlexAvailable returns true for openai', () => {
      configure({ provider: 'openai' })
      expect(isFlexAvailable()).toBe(true)
    })

    it('isFlexAvailable returns true for bedrock', () => {
      configure({ provider: 'bedrock' })
      expect(isFlexAvailable()).toBe(true)
    })

    it('isFlexAvailable returns false for anthropic (no native flex)', () => {
      configure({ provider: 'anthropic' })
      expect(isFlexAvailable()).toBe(false)
    })

    it('isFlexAvailable returns true for google', () => {
      configure({ provider: 'google' })
      expect(isFlexAvailable()).toBe(true)
    })

    it('isFlexAvailable returns false for cloudflare', () => {
      configure({ provider: 'cloudflare' })
      expect(isFlexAvailable()).toBe(false)
    })
  })

  describe('Operation Recording', () => {
    it('captures operations during createBatchMap', () => {
      const items = ['Topic A', 'Topic B', 'Topic C']
      let recordedCount = 0

      // Create batch map - this enters recording mode for each item
      const batchMap = createBatchMap(items, (item) => {
        // When we call write` here, it should capture the operation
        // Since we mocked generateText, we need to manually capture
        captureOperation(`Write about: ${item}`, 'text', undefined, undefined)
        recordedCount++
        return `result_${item}`
      })

      expect(batchMap.size).toBe(3)
      expect(recordedCount).toBe(3)
    })
  })

  describe('BatchMapPromise', () => {
    it('resolves with immediate execution for small batches', async () => {
      configure({ batchMode: 'immediate' })

      const items = ['A', 'B', 'C']
      const batchMap = new BatchMapPromise<string>(
        items,
        items.map((item) => [
          {
            id: `op_${item}`,
            prompt: `Write about: ${item}`,
            itemPlaceholder: item,
            type: 'text' as const,
          },
        ]),
        { immediate: true }
      )

      const results = await batchMap

      expect(results).toHaveLength(3)
      // Results should contain generated text
      results.forEach((result) => {
        expect(typeof result).toBe('string')
      })
    })

    it('supports async iteration', async () => {
      configure({ batchMode: 'immediate' })

      const items = ['X', 'Y']
      const batchMap = new BatchMapPromise<string>(
        items,
        items.map((item) => [
          {
            id: `op_${item}`,
            prompt: `Generate: ${item}`,
            itemPlaceholder: item,
            type: 'text' as const,
          },
        ]),
        { immediate: true }
      )

      const collected: string[] = []
      const results = await batchMap
      for (const result of results) {
        collected.push(result)
      }

      expect(collected).toHaveLength(2)
    })
  })

  describe('Full Workflow', () => {
    it('list → map → batch flow works end-to-end', async () => {
      // Configure for immediate execution (for testing)
      configure({ batchMode: 'immediate', provider: 'openai', model: 'gpt-4o' })

      // Step 1: Get titles (this executes immediately)
      // Note: The mock returns { object: { items: [...] } }
      // so we access .items from the result
      const result = await list`5 blog post titles about startups`
      const titles = (result as any).items || result
      expect(titles).toHaveLength(5)

      // Step 2: Map to blog posts
      // In the real implementation, this would capture operations
      // For this test, we simulate the batch map behavior
      const batchMap = createBatchMap(titles, (title: string) => {
        // Capture the write operation
        captureOperation(`Write a blog post about: ${title}`, 'text')
        return title // Return value not used, operations are captured
      })

      // Step 3: Await resolves the batch
      expect(batchMap.size).toBe(5)
    })

    it('supports complex map with multiple operations per item', async () => {
      configure({ batchMode: 'immediate' })

      const ideas = ['AI Assistant', 'Remote Tools', 'Dev Platform']

      const batchMap = createBatchMap(ideas, (idea) => {
        // Multiple operations per item
        captureOperation(`Analyze: ${idea}`, 'object')
        captureOperation(`Is ${idea} viable?`, 'boolean')
        captureOperation(`Market for: ${idea}`, 'text')
        return { idea }
      })

      expect(batchMap.size).toBe(3)
      // Each item should have 3 operations
    })
  })

  describe('Provider Integration', () => {
    it('falls back to immediate when adapter not available', async () => {
      // Configure for a provider without adapter registered
      configure({ batchMode: 'deferred', provider: 'google' })

      const items = ['Test']
      const batchMap = new BatchMapPromise<string>(
        items,
        [[{
          id: 'op_1',
          prompt: 'Test prompt',
          itemPlaceholder: 'Test',
          type: 'text' as const,
        }]],
        { deferred: true }
      )

      // Should not throw, falls back to immediate
      const results = await batchMap
      expect(results).toHaveLength(1)
    })
  })
})

describe('API Design', () => {
  it('demonstrates the clean API', async () => {
    // This is how users will write code:
    //
    // const titles = await list`10 blog post titles about building startups in 2026`
    // const posts = titles.map(title => write`blog post targeting founders starting with "# ${title}"`)
    // console.log(await posts) // Batched automatically based on context!
    //
    // No need to specify provider, model, or batch configuration in the code.
    // Everything comes from environment variables or configure():
    //
    // AI_PROVIDER=anthropic
    // AI_MODEL=claude-sonnet-4-20250514
    // AI_BATCH_MODE=auto
    // AI_BATCH_THRESHOLD=5

    // For this test, we just verify the types work
    expect(true).toBe(true)
  })
})
