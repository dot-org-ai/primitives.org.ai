/**
 * Blog Post Generation Live Tests
 *
 * These tests run LIVE against real AI providers by default.
 * They verify the complete blog generation workflow:
 *
 * ```ts
 * const titles = await list`10 blog post titles about ${topic}`
 * const posts = titles.map(title => write`a blog post starting with "# ${title}"`)
 * ```
 *
 * Tests cover:
 * - Real API calls to OpenAI, Anthropic, etc.
 * - Action/event storage in the database
 * - Both realtime and batch execution modes
 * - Multiple providers
 *
 * Run with:
 * ```bash
 * pnpm test blog-generation.live
 * ```
 *
 * Skip live tests (CI without API keys):
 * ```bash
 * SKIP_LIVE_TESTS=true pnpm test blog-generation.live
 * ```
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import {
  configure,
  resetContext,
  withContext,
  getProvider,
  getModel,
  getBatchMode,
} from '../src/context.js'
import { createBatch, withBatch, type BatchProvider } from '../src/batch-queue.js'
import { generateObject, generateText } from '../src/generate.js'

// Database provider for action/event storage
import { createMemoryProvider, type MemoryProvider, type Action, type Event } from '../../ai-database/src/memory-provider.js'

// Batch storage
import '../src/batch/memory.js'
import { configureMemoryAdapter, clearBatches, getBatches } from '../src/batch/memory.js'

// ============================================================================
// Configuration
// ============================================================================

const SKIP_LIVE = process.env.SKIP_LIVE_TESTS === 'true'
const describeLive = SKIP_LIVE ? describe.skip : describe

// Detect available providers
const hasOpenAI = !!process.env.OPENAI_API_KEY
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

// Provider configs
const PROVIDERS: Record<string, { model: string; available: boolean }> = {
  openai: { model: 'gpt-4o-mini', available: hasOpenAI },
  anthropic: { model: 'claude-sonnet-4-20250514', available: hasAnthropic },
}

// Get first available provider
const defaultProvider = Object.entries(PROVIDERS).find(([, cfg]) => cfg.available)?.[0] || 'openai'
const defaultModel = PROVIDERS[defaultProvider]?.model || 'gpt-4o-mini'

// ============================================================================
// Database Setup
// ============================================================================

let db: MemoryProvider
let capturedEvents: Event[] = []

// ============================================================================
// Test Helpers
// ============================================================================

async function createAction(data: {
  action: string
  object: string
  objectData?: Record<string, unknown>
  total?: number
}): Promise<Action> {
  return db.createAction({
    actor: 'test:live',
    action: data.action,
    object: data.object,
    objectData: data.objectData,
    total: data.total,
  })
}

async function generateTitles(topic: string, count: number): Promise<{ titles: string[]; action: Action }> {
  const action = await createAction({
    action: 'generate',
    object: 'BlogTitles',
    objectData: { topic, count },
    total: 1,
  })

  await db.updateAction(action.id, { status: 'active' })

  const result = await generateObject({
    model: getModel(),
    schema: { titles: [`${count} blog post titles about ${topic}`] },
    prompt: `Generate exactly ${count} creative blog post titles about "${topic}".`,
  })

  const titles = (result.object as { titles: string[] }).titles

  await db.updateAction(action.id, {
    status: 'completed',
    progress: 1,
    result: { titles },
  })

  return { titles, action }
}

async function generatePost(title: string): Promise<string> {
  const result = await generateText({
    model: getModel(),
    prompt: `Write a blog post starting with "# ${title}"\n\nInclude an introduction, 2-3 sections, and conclusion. Be concise.`,
    maxTokens: 800,
  })
  return result.text
}

async function generatePosts(
  titles: string[],
  mode: 'realtime' | 'batch' = 'realtime'
): Promise<{ posts: string[]; action: Action }> {
  const action = await createAction({
    action: 'generate',
    object: 'BlogPosts',
    objectData: { titles, mode },
    total: titles.length,
  })

  await db.updateAction(action.id, { status: 'active' })

  const posts: string[] = []

  if (mode === 'batch') {
    const batch = createBatch({
      provider: getProvider(),
      model: getModel(),
      metadata: { actionId: action.id },
    })

    titles.forEach((title, i) => {
      batch.add(
        `Write a blog post starting with "# ${title}"\n\nBe concise.`,
        { customId: `post-${i}`, metadata: { title } }
      )
    })

    const { completion } = await batch.submit()
    const results = await completion

    for (const result of results) {
      posts.push(result.status === 'completed' ? (result.result as string) : `[Failed]`)
      await db.updateAction(action.id, { progress: posts.length })
    }
  } else {
    for (let i = 0; i < titles.length; i++) {
      const post = await generatePost(titles[i])
      posts.push(post)
      await db.updateAction(action.id, { progress: i + 1 })
    }
  }

  await db.updateAction(action.id, { status: 'completed', result: { count: posts.length } })

  return { posts, action }
}

// ============================================================================
// Tests
// ============================================================================

describeLive('Blog Generation (Live)', () => {
  beforeAll(() => {
    console.log('\n🔴 LIVE TEST MODE')
    console.log(`   Default provider: ${defaultProvider}`)
    console.log(`   OpenAI available: ${hasOpenAI}`)
    console.log(`   Anthropic available: ${hasAnthropic}\n`)
  })

  beforeEach(() => {
    resetContext()
    db = createMemoryProvider()
    capturedEvents = []
    db.on('*', (e) => capturedEvents.push(e))
    configure({ provider: defaultProvider as BatchProvider, model: defaultModel, batchMode: 'immediate' })
    clearBatches()
    configureMemoryAdapter({})
  })

  afterEach(() => {
    resetContext()
    clearBatches()
    db.clear()
  })

  // ==========================================================================
  // Core Pattern Tests
  // ==========================================================================

  describe('Core Pattern: list → write', () => {
    it('generates titles from a topic', async () => {
      const { titles, action } = await generateTitles('building AI products', 3)

      expect(titles).toHaveLength(3)
      titles.forEach((t) => expect(typeof t).toBe('string'))

      // Verify action tracking
      expect(action.status).toBe('completed')
      expect(action.result).toEqual({ titles })
    }, 30000)

    it('generates a blog post from a title', async () => {
      const title = 'The Future of AI Development'
      const post = await generatePost(title)

      expect(post).toContain(`# ${title}`)
      expect(post.length).toBeGreaterThan(200)
    }, 30000)

    it('generates multiple posts from titles', async () => {
      const { titles } = await generateTitles('startup growth', 2)
      const { posts, action } = await generatePosts(titles)

      expect(posts).toHaveLength(2)
      posts.forEach((post, i) => {
        expect(post).toContain(`# ${titles[i]}`)
      })

      expect(action.progress).toBe(2)
      expect(action.total).toBe(2)
    }, 60000)
  })

  // ==========================================================================
  // Action & Event Storage
  // ==========================================================================

  describe('Action & Event Storage', () => {
    it('creates actions with verb conjugation', async () => {
      const { action } = await generateTitles('test topic', 2)

      expect(action.action).toBe('generate')
      expect(action.act).toBe('generates')
      expect(action.activity).toBe('generating')
      expect(action.actor).toBe('test:live')
    }, 30000)

    it('tracks action lifecycle timestamps', async () => {
      const { action } = await generateTitles('test', 2)

      const final = await db.getAction(action.id)
      expect(final?.createdAt).toBeInstanceOf(Date)
      expect(final?.startedAt).toBeInstanceOf(Date)
      expect(final?.completedAt).toBeInstanceOf(Date)
      expect(final?.startedAt!.getTime()).toBeGreaterThanOrEqual(final?.createdAt!.getTime()!)
      expect(final?.completedAt!.getTime()).toBeGreaterThanOrEqual(final?.startedAt!.getTime()!)
    }, 30000)

    it('emits events for state transitions', async () => {
      await generateTitles('test', 2)

      const actionEvents = capturedEvents.filter((e) => e.event.startsWith('Action.'))
      const eventTypes = actionEvents.map((e) => e.event)

      expect(eventTypes).toContain('Action.created')
      expect(eventTypes).toContain('Action.started')
      expect(eventTypes).toContain('Action.completed')
    }, 30000)

    it('stores action result data', async () => {
      const { titles, action } = await generateTitles('AI development', 3)

      const stored = await db.getAction(action.id)
      expect(stored?.result).toEqual({ titles })
      expect(stored?.objectData).toEqual({ topic: 'AI development', count: 3 })
    }, 30000)

    it('queries actions by status', async () => {
      await generateTitles('topic 1', 2)
      await generateTitles('topic 2', 2)

      const completed = await db.listActions({ status: 'completed' })
      expect(completed.length).toBe(2)
    }, 60000)

    it('queries events by type pattern', async () => {
      await generateTitles('test', 2)

      const created = await db.listEvents({ event: 'Action.created' })
      const allAction = await db.listEvents({ event: 'Action.*' })

      expect(created.length).toBeGreaterThanOrEqual(1)
      expect(allAction.length).toBeGreaterThanOrEqual(3) // created, started, completed
    }, 30000)
  })

  // ==========================================================================
  // Realtime Execution
  // ==========================================================================

  describe('Realtime Execution', () => {
    beforeEach(() => {
      configure({ batchMode: 'immediate' })
    })

    it('executes requests immediately', async () => {
      const start = Date.now()
      const { titles } = await generateTitles('quick test', 2)
      const elapsed = Date.now() - start

      expect(titles).toHaveLength(2)
      // Should complete in reasonable time (not batched/delayed)
      expect(elapsed).toBeLessThan(30000)
    }, 30000)

    it('tracks progress during sequential generation', async () => {
      const titles = ['Post One', 'Post Two']
      const { posts, action } = await generatePosts(titles, 'realtime')

      expect(posts).toHaveLength(2)

      const final = await db.getAction(action.id)
      expect(final?.progress).toBe(2)
      expect(final?.total).toBe(2)
    }, 60000)
  })

  // ==========================================================================
  // Batch Execution
  // ==========================================================================

  describe('Batch Execution', () => {
    beforeEach(() => {
      configure({ batchMode: 'deferred' })
    })

    it('creates and submits batch jobs', async () => {
      const titles = ['Batch Post 1', 'Batch Post 2']
      const { posts, action } = await generatePosts(titles, 'batch')

      expect(posts).toHaveLength(2)

      // Verify batch was stored
      const batches = getBatches()
      expect(batches.size).toBe(1)

      const [, batch] = [...batches.entries()][0]
      expect(batch.items).toHaveLength(2)
      expect(batch.status).toBe('completed')
    }, 90000)

    it('stores batch metadata', async () => {
      const batch = createBatch({
        provider: getProvider(),
        model: getModel(),
        metadata: { task: 'test-batch', timestamp: Date.now() },
      })

      batch.add('Write a test post', { customId: 'test-1' })
      const { job } = await batch.submit()
      await batch.wait()

      const stored = getBatches().get(job.id)
      expect(stored?.options.metadata?.task).toBe('test-batch')
    }, 30000)
  })

  // ==========================================================================
  // Multi-Provider Tests
  // ==========================================================================

  describe('Multi-Provider', () => {
    it.skipIf(!hasOpenAI)('generates with OpenAI', async () => {
      configure({ provider: 'openai', model: 'gpt-4o-mini' })

      const { titles } = await generateTitles('OpenAI test', 2)
      expect(titles).toHaveLength(2)
      expect(getProvider()).toBe('openai')
    }, 30000)

    it.skipIf(!hasAnthropic)('generates with Anthropic', async () => {
      configure({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' })

      const { titles } = await generateTitles('Anthropic test', 2)
      expect(titles).toHaveLength(2)
      expect(getProvider()).toBe('anthropic')
    }, 30000)

    it.skipIf(!hasOpenAI || !hasAnthropic)('switches providers mid-workflow', async () => {
      // Generate titles with OpenAI
      configure({ provider: 'openai', model: 'gpt-4o-mini' })
      const { titles } = await generateTitles('cross-provider test', 2)

      // Generate posts with Anthropic
      const posts = await withContext(
        { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        async () => {
          expect(getProvider()).toBe('anthropic')
          return Promise.all(titles.slice(0, 1).map(generatePost))
        }
      )

      expect(posts).toHaveLength(1)
      expect(getProvider()).toBe('openai') // restored
    }, 60000)

    it.skipIf(!hasOpenAI || !hasAnthropic)('runs providers in parallel', async () => {
      const [openaiResult, anthropicResult] = await Promise.all([
        withContext({ provider: 'openai', model: 'gpt-4o-mini' }, () =>
          generateTitles('OpenAI parallel', 2)
        ),
        withContext({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, () =>
          generateTitles('Anthropic parallel', 2)
        ),
      ])

      expect(openaiResult.titles).toHaveLength(2)
      expect(anthropicResult.titles).toHaveLength(2)
    }, 60000)
  })

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('tracks failed actions', async () => {
      const action = await createAction({
        action: 'generate',
        object: 'FailTest',
        total: 1,
      })

      await db.updateAction(action.id, { status: 'active' })

      // Simulate failure
      await db.updateAction(action.id, {
        status: 'failed',
        error: 'Simulated failure',
      })

      const failed = await db.listActions({ status: 'failed' })
      expect(failed).toHaveLength(1)
      expect(failed[0].error).toBe('Simulated failure')

      // Verify failure event
      const failEvents = capturedEvents.filter((e) => e.event === 'Action.failed')
      expect(failEvents.length).toBe(1)
    })

    it('handles invalid model gracefully', async () => {
      configure({ model: 'invalid-model-xyz' })

      const action = await createAction({
        action: 'generate',
        object: 'InvalidModelTest',
        total: 1,
      })

      await db.updateAction(action.id, { status: 'active' })

      try {
        await generateObject({
          model: 'invalid-model-xyz',
          schema: { test: 'test' },
          prompt: 'test',
        })
      } catch (e) {
        await db.updateAction(action.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Unknown error',
        })
      }

      const final = await db.getAction(action.id)
      expect(final?.status).toBe('failed')
      expect(final?.error).toBeDefined()
    }, 30000)
  })

  // ==========================================================================
  // Database Statistics
  // ==========================================================================

  describe('Database Statistics', () => {
    it('tracks aggregate stats', async () => {
      await generateTitles('stats test 1', 2)
      await generateTitles('stats test 2', 2)

      const stats = db.stats()

      expect(stats.actions.completed).toBe(2)
      expect(stats.events).toBeGreaterThan(0)
    }, 60000)
  })
})
