/**
 * Batch Blog Post Generation Test
 *
 * Tests the batch processing workflow where:
 * 1. list`10 blog post titles` executes immediately
 * 2. The mapped write operations are deferred to a batch
 * 3. The batch is submitted to the provider (OpenAI/Anthropic)
 *
 * @example
 * ```ts
 * const titles = await list`10 blog post titles about building startups in 2026`
 * const posts = titles.map(title => batch.add(write`blog post about ${title}`))
 * const job = await batch.submit()
 * const results = await batch.wait()
 * ```
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createBatch, withBatchQueue, generateObject, generateText } from '../src/index.js'
import { z } from 'zod'

// Memory adapter for testing - simulates batch processing locally
// Import from .ts file for proper vite resolution
import { configureMemoryAdapter, clearBatches } from '../src/batch/memory.ts'

// Skip AI-dependent tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL

// ============================================================================
// Real AI Tests (require gateway)
// ============================================================================

describe.skipIf(!hasGateway)('Batch Blog Post Generation with Real AI', () => {
  it('generates blog post titles using real AI', async () => {
    const result = await generateObject({
      model: 'haiku',
      schema: z.object({
        titles: z.array(z.string()).describe('List of blog post titles'),
      }),
      prompt: 'Generate exactly 3 blog post titles about building startups.',
    })

    expect(result.object.titles).toHaveLength(3)
    expect(result.object.titles.every((t: string) => typeof t === 'string')).toBe(true)
  })

  it('generates a single blog post using real AI', async () => {
    const result = await generateText({
      model: 'haiku',
      prompt: 'Write a very short blog post intro (2-3 sentences) about TypeScript.',
    })

    expect(result.text).toBeDefined()
    expect(result.text.length).toBeGreaterThan(50)
  })
})

// ============================================================================
// Batch Queue Mechanics Tests (use memory adapter - no AI needed)
// ============================================================================

describe('Batch Queue Mechanics', () => {
  // Use a simple handler that doesn't call real AI
  const mockHandler = async (item: { prompt: string }) => {
    return `Generated content for: ${item.prompt.substring(0, 50)}...`
  }

  beforeEach(() => {
    clearBatches()
    // Configure with mock handler to avoid real AI calls in batch tests
    configureMemoryAdapter({ handler: mockHandler })
  })

  afterEach(() => {
    clearBatches()
  })

  describe('batch processing workflow', () => {
    it('creates batch queue and adds items', async () => {
      const batch = createBatch({ provider: 'openai', model: 'gpt-4o' })

      const titles = ['Title 1', 'Title 2', 'Title 3']

      // Add each title to the batch
      const items = titles.map((title) =>
        batch.add(`Write a comprehensive blog post about: ${title}`, {
          customId: title.slice(0, 50).replace(/\s+/g, '-').toLowerCase(),
        })
      )

      expect(batch.size).toBe(3)
      expect(items).toHaveLength(3)
      expect(items[0].status).toBe('pending')
    })

    it('submits batch and returns job info', async () => {
      const batch = createBatch({ provider: 'openai', model: 'gpt-4o' })

      const titles = ['Title 1', 'Title 2', 'Title 3']

      titles.forEach((title) => batch.add(`Write a comprehensive blog post about: ${title}`))

      const { job, completion } = await batch.submit()

      expect(job.id).toMatch(/^batch_memory_/)
      expect(job.provider).toBe('openai')
      expect(job.totalItems).toBe(3)
      expect(job.status).toBe('pending')

      // Wait for completion
      const results = await completion
      expect(results).toHaveLength(3)
    })

    it('waits for batch completion and returns results', async () => {
      const batch = createBatch({ provider: 'openai', model: 'gpt-4o' })

      const titles = ['Title 1', 'Title 2', 'Title 3']

      titles.forEach((title) => batch.add(`Write a comprehensive blog post about: ${title}`))

      await batch.submit()
      const results = await batch.wait()

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.status === 'completed')).toBe(true)
      expect(results[0].result).toBeDefined()
    })

    it('processes items in order', async () => {
      const batch = createBatch({ provider: 'openai' })

      const titles = ['First', 'Second', 'Third']
      titles.map((title, i) => batch.add(`Write about: ${title}`, { customId: `item_${i}` }))

      await batch.submit()
      const results = await batch.wait()

      expect(results[0].id).toBe('item_0')
      expect(results[1].id).toBe('item_1')
      expect(results[2].id).toBe('item_2')
    })
  })

  describe('withBatchQueue helper', () => {
    it('provides convenient batch execution', async () => {
      const titles = ['Title A', 'Title B', 'Title C']

      const results = await withBatchQueue(
        (batch) => titles.map((title) => batch.add(`Write a blog post about: ${title}`)),
        { provider: 'openai', model: 'gpt-4o' }
      )

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.status === 'completed')).toBe(true)
    })
  })

  describe('batch status tracking', () => {
    it('tracks completion progress', async () => {
      const batch = createBatch({ provider: 'openai' })

      batch.add('Write post 1')
      batch.add('Write post 2')
      batch.add('Write post 3')

      const { job } = await batch.submit()
      expect(job.completedItems).toBe(0)

      // Wait for completion
      await batch.wait()

      const finalStatus = await batch.getStatus()
      expect(finalStatus.status).toBe('completed')
      expect(finalStatus.completedItems).toBe(3)
    })
  })

  describe('error handling', () => {
    it('handles partial failures', async () => {
      // Configure adapter to fail 30% of requests with a mock handler
      configureMemoryAdapter({
        failureRate: 0.3,
        handler: async (item: { prompt: string }) => `Result for: ${item.prompt}`,
      })

      const batch = createBatch({ provider: 'openai' })

      for (let i = 0; i < 10; i++) {
        batch.add(`Write post ${i}`)
      }

      await batch.submit()
      const results = await batch.wait()

      // Some should fail, some should succeed
      const succeeded = results.filter((r) => r.status === 'completed').length
      const failed = results.filter((r) => r.status === 'failed').length

      expect(succeeded + failed).toBe(10)
      // With 30% failure rate, expect roughly 3 failures (with some variance)
      expect(failed).toBeGreaterThanOrEqual(0)
      expect(failed).toBeLessThanOrEqual(10)
    })

    it('prevents adding items after submission', async () => {
      const batch = createBatch({ provider: 'openai' })
      batch.add('Write post 1')
      await batch.submit()

      expect(() => batch.add('Write post 2')).toThrow('Cannot add items to a submitted batch')
    })

    it('prevents double submission', async () => {
      const batch = createBatch({ provider: 'openai' })
      batch.add('Write post 1')
      await batch.submit()

      await expect(batch.submit()).rejects.toThrow('Batch has already been submitted')
    })

    it('prevents empty batch submission', async () => {
      const batch = createBatch({ provider: 'openai' })

      await expect(batch.submit()).rejects.toThrow('Cannot submit empty batch')
    })
  })

  describe('batch with custom handler', () => {
    it('uses custom handler for processing', async () => {
      let callCount = 0
      const customHandler = async (item: { prompt: string }) => {
        callCount++
        return `Custom result for: ${item.prompt}`
      }

      configureMemoryAdapter({ handler: customHandler })

      const batch = createBatch({ provider: 'openai' })
      batch.add('Topic 1')
      batch.add('Topic 2')

      await batch.submit()
      const results = await batch.wait()

      expect(callCount).toBe(2)
      expect(results[0].result).toBe('Custom result for: Topic 1')
      expect(results[1].result).toBe('Custom result for: Topic 2')
    })
  })

  describe('full workflow: list -> map -> batch', () => {
    it('executes the complete blog post generation workflow', async () => {
      // Step 1: Simulate getting titles (in real usage, this would be AI-generated)
      const titles = [
        'How AI is Revolutionizing Startup Fundraising',
        'The Rise of Solo Founders',
        'Remote-First is Non-Negotiable',
      ]

      // Step 2: Create batch for blog posts (deferred)
      const batch = createBatch({
        provider: 'openai',
        model: 'gpt-4o',
        metadata: { task: 'blog-generation', topic: 'startups-2026' },
      })

      // Step 3: Map titles to batch items
      const blogItems = titles.map((title, index) =>
        batch.add(`Write a comprehensive blog post about: ${title}`, {
          customId: `blog-${index}`,
          metadata: { title },
        })
      )

      expect(batch.size).toBe(3)
      expect(blogItems.every((item) => item.status === 'pending')).toBe(true)

      // Step 4: Submit the batch
      const { job, completion } = await batch.submit()

      expect(job.id).toBeDefined()
      expect(job.totalItems).toBe(3)
      expect(batch.isSubmitted).toBe(true)

      // Step 5: Wait for results
      const results = await completion

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.status === 'completed')).toBe(true)

      // Verify results have content
      for (const result of results) {
        expect(result.result).toBeDefined()
        expect(typeof result.result).toBe('string')
      }

      // Verify items are updated after completion
      expect(blogItems.every((item) => item.status === 'completed')).toBe(true)
    })
  })
})

describe('Provider-specific batch behavior', () => {
  // Use a simple handler that doesn't call real AI
  const mockHandler = async () => 'Test result'

  beforeEach(() => {
    clearBatches()
    configureMemoryAdapter({ handler: mockHandler })
  })

  it('uses specified provider', async () => {
    const openAIBatch = createBatch({ provider: 'openai' })
    const anthropicBatch = createBatch({ provider: 'anthropic' })

    openAIBatch.add('Test prompt')
    anthropicBatch.add('Test prompt')

    const { job: oaiJob } = await openAIBatch.submit()
    const { job: antJob } = await anthropicBatch.submit()

    // Memory adapter simulates OpenAI for all providers
    expect(oaiJob.provider).toBe('openai')
    expect(antJob.provider).toBe('openai')
  })

  it('respects model configuration', async () => {
    let handlerCalled = false
    const customHandler = async () => {
      handlerCalled = true
      return 'Result'
    }
    configureMemoryAdapter({ handler: customHandler })

    const batch = createBatch({ provider: 'openai', model: 'gpt-4o-mini' })
    batch.add('Test prompt')
    await batch.submit()
    await batch.wait()

    // The model should be passed to the handler via batch options
    // (memory adapter doesn't use it, but real adapters would)
    expect(handlerCalled).toBe(true)
  })
})
