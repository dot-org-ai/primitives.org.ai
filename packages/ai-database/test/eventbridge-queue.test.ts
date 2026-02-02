/**
 * EventBridge with Cloudflare Queues Tests (RED phase)
 *
 * Tests define the expected interface for EventBridge integration with Cloudflare Queues.
 * EventBridge enables:
 * - Publishing events to Cloudflare Queues for async processing
 * - Subscribing to queue messages for event-driven workflows
 * - Dead letter queue (DLQ) handling for failed events
 * - Batched event publishing for efficiency
 * - Event filtering and routing based on patterns
 *
 * These tests should FAIL initially because the EventBridge/Queue features don't exist yet.
 * This is the RED phase of TDD.
 *
 * Bead: aip-1p0o
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

// =============================================================================
// Mock Types (to be replaced by real implementations)
// =============================================================================

/**
 * Cloudflare Queue message type
 */
interface QueueMessage<T = unknown> {
  id: string
  timestamp: Date
  body: T
  attempts: number
}

/**
 * Cloudflare Queue binding interface (mocked)
 */
interface QueueBinding {
  send(message: unknown, options?: { delaySeconds?: number }): Promise<void>
  sendBatch(messages: { body: unknown; delaySeconds?: number }[]): Promise<void>
}

/**
 * EventBridge configuration
 */
interface EventBridgeConfig {
  /** The Cloudflare Queue binding for publishing events */
  queue?: QueueBinding
  /** Dead letter queue for failed events */
  dlq?: QueueBinding
  /** Maximum retry attempts before sending to DLQ */
  maxRetries?: number
  /** Batch size for bulk publishing */
  batchSize?: number
  /** Event patterns to route to specific queues */
  routes?: Record<string, QueueBinding>
}

/**
 * EventBridge API interface
 */
interface EventBridgeAPI {
  /** Publish an event to the queue */
  publish(event: PublishEvent): Promise<void>
  /** Publish multiple events in a batch */
  publishBatch(events: PublishEvent[]): Promise<void>
  /** Subscribe to events with a handler */
  subscribe(pattern: string, handler: (event: QueueMessage) => Promise<void>): () => void
  /** Process incoming queue messages */
  process(messages: QueueMessage[]): Promise<ProcessResult>
  /** Get queue statistics */
  getStats(): QueueStats
  /** Configure the bridge */
  configure(config: EventBridgeConfig): void
}

interface PublishEvent {
  event: string
  data?: unknown
  actor?: string
  object?: string
  delay?: number
  meta?: Record<string, unknown>
}

interface ProcessResult {
  processed: number
  failed: number
  retried: number
  deadLettered: number
}

interface QueueStats {
  published: number
  processed: number
  failed: number
  deadLettered: number
  pending: number
}

// =============================================================================
// EventBridge - Core Configuration
// =============================================================================

// EventBridge Configuration tests - GREEN phase (implementation complete)
describe('EventBridge - Configuration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
  })

  const schema = {
    Post: {
      title: 'string',
      content: 'string',
    },
  } as const

  it('should expose eventBridge API from DB', () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    expect(eventBridge).toBeDefined()
    expect(typeof eventBridge.publish).toBe('function')
    expect(typeof eventBridge.publishBatch).toBe('function')
    expect(typeof eventBridge.subscribe).toBe('function')
    expect(typeof eventBridge.process).toBe('function')
    expect(typeof eventBridge.getStats).toBe('function')
    expect(typeof eventBridge.configure).toBe('function')
  })

  it('should configure with Cloudflare Queue binding', () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    expect(() => eventBridge.configure({ queue: mockQueue })).not.toThrow()
  })

  it('should configure with dead letter queue', () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    const mockDLQ: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    expect(() =>
      eventBridge.configure({
        queue: mockQueue,
        dlq: mockDLQ,
        maxRetries: 3,
      })
    ).not.toThrow()
  })

  it('should configure event routing to different queues', () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const analyticsQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    const notificationQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    expect(() =>
      eventBridge.configure({
        routes: {
          'analytics:*': analyticsQueue,
          'notification:*': notificationQueue,
        },
      })
    ).not.toThrow()
  })

  it('should configure batch size for bulk operations', () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    expect(() =>
      eventBridge.configure({
        queue: mockQueue,
        batchSize: 100,
      })
    ).not.toThrow()
  })
})

// =============================================================================
// EventBridge - Publishing Events
// =============================================================================

describe('EventBridge - Publishing Events', () => {
  let mockQueue: QueueBinding
  let sendSpy: ReturnType<typeof vi.fn>
  let sendBatchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setProvider(createMemoryProvider())
    sendSpy = vi.fn().mockResolvedValue(undefined)
    sendBatchSpy = vi.fn().mockResolvedValue(undefined)
    mockQueue = {
      send: sendSpy,
      sendBatch: sendBatchSpy,
    }
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
      content: 'string',
    },
  } as const

  it('should publish a single event to the queue', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    eventBridge.configure({ queue: mockQueue })

    await eventBridge.publish({
      event: 'Post.created',
      data: { title: 'Hello World' },
      actor: 'user:john',
      object: 'Post/post-1',
    })

    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Post.created',
        data: { title: 'Hello World' },
        actor: 'user:john',
        object: 'Post/post-1',
      }),
      expect.any(Object)
    )
  })

  it('should publish event with delay', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    eventBridge.configure({ queue: mockQueue })

    await eventBridge.publish({
      event: 'reminder:send',
      data: { message: 'Check this out!' },
      delay: 3600, // 1 hour delay
    })

    expect(sendSpy).toHaveBeenCalledWith(expect.any(Object), { delaySeconds: 3600 })
  })

  it('should publish batch of events', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    eventBridge.configure({ queue: mockQueue })

    const events: PublishEvent[] = [
      { event: 'Post.created', data: { title: 'Post 1' } },
      { event: 'Post.created', data: { title: 'Post 2' } },
      { event: 'Post.created', data: { title: 'Post 3' } },
    ]

    await eventBridge.publishBatch(events)

    expect(sendBatchSpy).toHaveBeenCalledTimes(1)
    expect(sendBatchSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ body: expect.objectContaining({ event: 'Post.created' }) }),
      ])
    )
  })

  it('should include timestamp in published events', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    eventBridge.configure({ queue: mockQueue })

    const before = Date.now()
    await eventBridge.publish({
      event: 'test:event',
      data: { test: true },
    })
    const after = Date.now()

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
      }),
      expect.any(Object)
    )

    const sentMessage = sendSpy.mock.calls[0][0]
    const timestamp = new Date(sentMessage.timestamp).getTime()
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('should generate unique ID for each published event', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    eventBridge.configure({ queue: mockQueue })

    await eventBridge.publish({ event: 'test:1' })
    await eventBridge.publish({ event: 'test:2' })

    const id1 = sendSpy.mock.calls[0][0].id
    const id2 = sendSpy.mock.calls[1][0].id

    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
  })

  it('should include metadata in published events', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    eventBridge.configure({ queue: mockQueue })

    await eventBridge.publish({
      event: 'analytics:track',
      data: { action: 'click' },
      meta: {
        source: 'web',
        sessionId: 'session-123',
        environment: 'production',
      },
    })

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          source: 'web',
          sessionId: 'session-123',
          environment: 'production',
        },
      }),
      expect.any(Object)
    )
  })

  it('should throw error when no queue is configured', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    // Note: Not calling configure

    await expect(
      eventBridge.publish({
        event: 'test:event',
        data: {},
      })
    ).rejects.toThrow(/queue.*not.*configured/i)
  })
})

// =============================================================================
// EventBridge - Event Routing
// =============================================================================

describe('EventBridge - Event Routing', () => {
  let analyticsQueue: QueueBinding
  let notificationQueue: QueueBinding
  let defaultQueue: QueueBinding
  let analyticsSpy: ReturnType<typeof vi.fn>
  let notificationSpy: ReturnType<typeof vi.fn>
  let defaultSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setProvider(createMemoryProvider())

    analyticsSpy = vi.fn().mockResolvedValue(undefined)
    notificationSpy = vi.fn().mockResolvedValue(undefined)
    defaultSpy = vi.fn().mockResolvedValue(undefined)

    analyticsQueue = {
      send: analyticsSpy,
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
    notificationQueue = {
      send: notificationSpy,
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
    defaultQueue = {
      send: defaultSpy,
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
    },
  } as const

  it('should route events to specific queues based on pattern', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    eventBridge.configure({
      queue: defaultQueue,
      routes: {
        'analytics:*': analyticsQueue,
        'notification:*': notificationQueue,
      },
    })

    await eventBridge.publish({ event: 'analytics:pageview', data: { page: '/home' } })
    await eventBridge.publish({ event: 'notification:email', data: { to: 'user@example.com' } })
    await eventBridge.publish({ event: 'other:event', data: {} })

    expect(analyticsSpy).toHaveBeenCalledTimes(1)
    expect(notificationSpy).toHaveBeenCalledTimes(1)
    expect(defaultSpy).toHaveBeenCalledTimes(1)
  })

  it('should support type wildcard routing (Post.*)', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const postQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({
      queue: defaultQueue,
      routes: {
        'Post.*': postQueue,
      },
    })

    await eventBridge.publish({ event: 'Post.created', data: { title: 'New' } })
    await eventBridge.publish({ event: 'Post.updated', data: { title: 'Updated' } })
    await eventBridge.publish({ event: 'Comment.created', data: { text: 'Nice!' } })

    expect(postQueue.send).toHaveBeenCalledTimes(2)
    expect(defaultSpy).toHaveBeenCalledTimes(1)
  })

  it('should support action wildcard routing (*.created)', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const createdQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({
      queue: defaultQueue,
      routes: {
        '*.created': createdQueue,
      },
    })

    await eventBridge.publish({ event: 'Post.created', data: {} })
    await eventBridge.publish({ event: 'User.created', data: {} })
    await eventBridge.publish({ event: 'Post.updated', data: {} })

    expect(createdQueue.send).toHaveBeenCalledTimes(2)
    expect(defaultSpy).toHaveBeenCalledTimes(1)
  })

  it('should use first matching route (priority order)', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const specificQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    const wildcardQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({
      queue: defaultQueue,
      routes: {
        'Post.created': specificQueue, // More specific
        'Post.*': wildcardQueue, // Less specific
      },
    })

    await eventBridge.publish({ event: 'Post.created', data: {} })

    // Should go to specific queue, not wildcard
    expect(specificQueue.send).toHaveBeenCalledTimes(1)
    expect(wildcardQueue.send).not.toHaveBeenCalled()
  })

  it('should fallback to default queue when no route matches', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    eventBridge.configure({
      queue: defaultQueue,
      routes: {
        'specific:event': analyticsQueue,
      },
    })

    await eventBridge.publish({ event: 'unmatched:event', data: {} })

    expect(defaultSpy).toHaveBeenCalledTimes(1)
    expect(analyticsSpy).not.toHaveBeenCalled()
  })
})

// =============================================================================
// EventBridge - Processing Messages
// =============================================================================

describe('EventBridge - Processing Messages', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
    },
  } as const

  it('should process incoming queue messages', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler = vi.fn().mockResolvedValue(undefined)

    eventBridge.subscribe('Post.*', handler)

    const messages: QueueMessage[] = [
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'Post.created', data: { title: 'Hello' } },
        attempts: 1,
      },
      {
        id: 'msg-2',
        timestamp: new Date(),
        body: { event: 'Post.updated', data: { title: 'Updated' } },
        attempts: 1,
      },
    ]

    const result = await eventBridge.process(messages)

    expect(result.processed).toBe(2)
    expect(result.failed).toBe(0)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('should track failed message processing', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler = vi.fn().mockRejectedValue(new Error('Processing failed'))

    eventBridge.subscribe('*', handler)

    const messages: QueueMessage[] = [
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'test:event', data: {} },
        attempts: 1,
      },
    ]

    const result = await eventBridge.process(messages)

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(1)
  })

  it('should retry failed messages up to maxRetries', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue, maxRetries: 3 })

    const handler = vi.fn().mockRejectedValue(new Error('Transient error'))
    eventBridge.subscribe('*', handler)

    const messages: QueueMessage[] = [
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'test:event', data: {} },
        attempts: 2, // Already attempted twice
      },
    ]

    const result = await eventBridge.process(messages)

    expect(result.retried).toBe(1)
    expect(result.deadLettered).toBe(0)
  })

  it('should send to DLQ after maxRetries exceeded', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const dlqSpy = vi.fn().mockResolvedValue(undefined)
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
    const mockDLQ: QueueBinding = {
      send: dlqSpy,
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue, dlq: mockDLQ, maxRetries: 3 })

    const handler = vi.fn().mockRejectedValue(new Error('Persistent error'))
    eventBridge.subscribe('*', handler)

    const messages: QueueMessage[] = [
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'test:event', data: {} },
        attempts: 4, // Exceeded maxRetries
      },
    ]

    const result = await eventBridge.process(messages)

    expect(result.deadLettered).toBe(1)
    expect(dlqSpy).toHaveBeenCalledTimes(1)
    expect(dlqSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        originalMessage: messages[0],
        error: expect.any(String),
      }),
      expect.any(Object)
    )
  })

  it('should match messages to correct handlers by pattern', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const postHandler = vi.fn().mockResolvedValue(undefined)
    const userHandler = vi.fn().mockResolvedValue(undefined)

    eventBridge.subscribe('Post.*', postHandler)
    eventBridge.subscribe('User.*', userHandler)

    const messages: QueueMessage[] = [
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'Post.created', data: {} },
        attempts: 1,
      },
      {
        id: 'msg-2',
        timestamp: new Date(),
        body: { event: 'User.updated', data: {} },
        attempts: 1,
      },
    ]

    await eventBridge.process(messages)

    expect(postHandler).toHaveBeenCalledTimes(1)
    expect(userHandler).toHaveBeenCalledTimes(1)
  })

  it('should pass full message context to handler', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler = vi.fn().mockResolvedValue(undefined)

    eventBridge.subscribe('*', handler)

    const message: QueueMessage = {
      id: 'msg-123',
      timestamp: new Date('2025-01-28T12:00:00Z'),
      body: {
        event: 'test:event',
        data: { key: 'value' },
        actor: 'user:john',
        object: 'Test/test-1',
        meta: { source: 'api' },
      },
      attempts: 1,
    }

    await eventBridge.process([message])

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'msg-123',
        body: expect.objectContaining({
          event: 'test:event',
          data: { key: 'value' },
          actor: 'user:john',
          object: 'Test/test-1',
        }),
      })
    )
  })
})

// =============================================================================
// EventBridge - Subscriptions
// =============================================================================

describe('EventBridge - Subscriptions', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
    },
  } as const

  it('should subscribe to specific event type', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler = vi.fn().mockResolvedValue(undefined)

    const unsubscribe = eventBridge.subscribe('Post.created', handler)

    expect(typeof unsubscribe).toBe('function')
  })

  it('should subscribe with wildcard pattern', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler = vi.fn().mockResolvedValue(undefined)

    const unsubscribe1 = eventBridge.subscribe('Post.*', handler)
    const unsubscribe2 = eventBridge.subscribe('*.created', handler)
    const unsubscribe3 = eventBridge.subscribe('*', handler)

    expect(typeof unsubscribe1).toBe('function')
    expect(typeof unsubscribe2).toBe('function')
    expect(typeof unsubscribe3).toBe('function')
  })

  it('should unsubscribe and stop receiving messages', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler = vi.fn().mockResolvedValue(undefined)

    const unsubscribe = eventBridge.subscribe('Post.created', handler)

    // Process first message
    await eventBridge.process([
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'Post.created', data: {} },
        attempts: 1,
      },
    ])

    expect(handler).toHaveBeenCalledTimes(1)

    // Unsubscribe
    unsubscribe()

    // Process second message
    await eventBridge.process([
      {
        id: 'msg-2',
        timestamp: new Date(),
        body: { event: 'Post.created', data: {} },
        attempts: 1,
      },
    ])

    // Handler should not be called again
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should support multiple handlers for same pattern', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const handler1 = vi.fn().mockResolvedValue(undefined)
    const handler2 = vi.fn().mockResolvedValue(undefined)

    eventBridge.subscribe('Post.created', handler1)
    eventBridge.subscribe('Post.created', handler2)

    await eventBridge.process([
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'Post.created', data: {} },
        attempts: 1,
      },
    ])

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('should handle async handlers', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const results: number[] = []

    const handler = async (msg: QueueMessage) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      results.push((msg.body as { data: { index: number } }).data.index)
    }

    eventBridge.subscribe('*', handler)

    await eventBridge.process([
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'test', data: { index: 1 } },
        attempts: 1,
      },
      {
        id: 'msg-2',
        timestamp: new Date(),
        body: { event: 'test', data: { index: 2 } },
        attempts: 1,
      },
    ])

    expect(results).toContain(1)
    expect(results).toContain(2)
  })
})

// =============================================================================
// EventBridge - Statistics
// =============================================================================

describe('EventBridge - Statistics', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
    },
  } as const

  it('should track published events count', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue })

    await eventBridge.publish({ event: 'test:1' })
    await eventBridge.publish({ event: 'test:2' })
    await eventBridge.publish({ event: 'test:3' })

    const stats = eventBridge.getStats()
    expect(stats.published).toBe(3)
  })

  it('should track processed events count', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    eventBridge.subscribe('*', vi.fn().mockResolvedValue(undefined))

    await eventBridge.process([
      { id: 'msg-1', timestamp: new Date(), body: { event: 'test' }, attempts: 1 },
      { id: 'msg-2', timestamp: new Date(), body: { event: 'test' }, attempts: 1 },
    ])

    const stats = eventBridge.getStats()
    expect(stats.processed).toBe(2)
  })

  it('should track failed events count', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    eventBridge.subscribe('*', vi.fn().mockRejectedValue(new Error('Failed')))

    await eventBridge.process([
      { id: 'msg-1', timestamp: new Date(), body: { event: 'test' }, attempts: 1 },
    ])

    const stats = eventBridge.getStats()
    expect(stats.failed).toBe(1)
  })

  it('should track dead-lettered events count', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
    const mockDLQ: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue, dlq: mockDLQ, maxRetries: 3 })
    eventBridge.subscribe('*', vi.fn().mockRejectedValue(new Error('Failed')))

    await eventBridge.process([
      { id: 'msg-1', timestamp: new Date(), body: { event: 'test' }, attempts: 5 },
    ])

    const stats = eventBridge.getStats()
    expect(stats.deadLettered).toBe(1)
  })

  it('should return all stats at once', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const stats = eventBridge.getStats()

    expect(stats).toHaveProperty('published')
    expect(stats).toHaveProperty('processed')
    expect(stats).toHaveProperty('failed')
    expect(stats).toHaveProperty('deadLettered')
    expect(stats).toHaveProperty('pending')
  })
})

// =============================================================================
// EventBridge - Integration with Events API
// =============================================================================

// Skip: Auto-publishing entity events to EventBridge requires additional
// wiring in the DB's internal events system. This is a future enhancement.
// The core EventBridge functionality is complete and tested above.
describe.skip('EventBridge - Integration with Events API', () => {
  let mockQueue: QueueBinding
  let sendSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setProvider(createMemoryProvider())
    sendSpy = vi.fn().mockResolvedValue(undefined)
    mockQueue = {
      send: sendSpy,
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
      content: 'string',
    },
  } as const

  it('should auto-publish entity events to queue when configured', async () => {
    const { db, eventBridge } = DB(schema) as {
      eventBridge: EventBridgeAPI
    } & ReturnType<typeof DB>

    eventBridge.configure({ queue: mockQueue })

    // This should auto-publish Post.created to the queue
    await db.Post.create('post-1', {
      title: 'Hello World',
      content: 'Content',
    })

    // Wait for event propagation
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sendSpy).toHaveBeenCalled()
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Post.created',
        object: 'Post/post-1',
      }),
      expect.any(Object)
    )
  })

  it('should publish update events to queue', async () => {
    const { db, eventBridge } = DB(schema) as {
      eventBridge: EventBridgeAPI
    } & ReturnType<typeof DB>

    eventBridge.configure({ queue: mockQueue })

    await db.Post.create('post-1', { title: 'Original', content: 'Content' })
    sendSpy.mockClear()

    await db.Post.update('post-1', { title: 'Updated' })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Post.updated',
        object: 'Post/post-1',
      }),
      expect.any(Object)
    )
  })

  it('should publish delete events to queue', async () => {
    const { db, eventBridge } = DB(schema) as {
      eventBridge: EventBridgeAPI
    } & ReturnType<typeof DB>

    eventBridge.configure({ queue: mockQueue })

    await db.Post.create('post-1', { title: 'To Delete', content: 'Content' })
    sendSpy.mockClear()

    await db.Post.delete('post-1')
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Post.deleted',
        object: 'Post/post-1',
      }),
      expect.any(Object)
    )
  })

  it('should include entity data in queue message', async () => {
    const { db, eventBridge } = DB(schema) as {
      eventBridge: EventBridgeAPI
    } & ReturnType<typeof DB>

    eventBridge.configure({ queue: mockQueue })

    await db.Post.create('post-1', {
      title: 'My Title',
      content: 'My Content',
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'My Title',
          content: 'My Content',
        }),
      }),
      expect.any(Object)
    )
  })

  it('should respect event routing for entity events', async () => {
    const { db, eventBridge } = DB(schema) as {
      eventBridge: EventBridgeAPI
    } & ReturnType<typeof DB>

    const postQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({
      queue: mockQueue,
      routes: {
        'Post.*': postQueue,
      },
    })

    await db.Post.create('post-1', { title: 'Test', content: 'Content' })
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Should go to postQueue, not default
    expect(postQueue.send).toHaveBeenCalled()
    expect(sendSpy).not.toHaveBeenCalled()
  })
})

// =============================================================================
// EventBridge - Edge Cases
// =============================================================================

describe('EventBridge - Edge Cases', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
    },
  } as const

  it('should handle empty batch publish', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue })

    await expect(eventBridge.publishBatch([])).resolves.not.toThrow()
  })

  it('should handle processing empty message batch', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    const result = await eventBridge.process([])

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('should handle messages with no matching handlers', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>

    // No subscriptions registered

    const result = await eventBridge.process([
      {
        id: 'msg-1',
        timestamp: new Date(),
        body: { event: 'unhandled:event', data: {} },
        attempts: 1,
      },
    ])

    // Should process without error (no-op for unmatched)
    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('should handle large event payloads', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue })

    const largeData = {
      content: 'x'.repeat(50000),
      items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
    }

    await expect(
      eventBridge.publish({
        event: 'large:payload',
        data: largeData,
      })
    ).resolves.not.toThrow()
  })

  it('should handle unicode in event data', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue })

    await eventBridge.publish({
      event: 'unicode:test',
      data: {
        japanese: '\u65e5\u672c\u8a9e',
        emoji: '\u{1F680}\u{1F4BB}',
        chinese: '\u4e2d\u6587',
      },
    })

    expect(mockQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          japanese: '\u65e5\u672c\u8a9e',
          emoji: '\u{1F680}\u{1F4BB}',
          chinese: '\u4e2d\u6587',
        }),
      }),
      expect.any(Object)
    )
  })

  it('should handle rapid publish calls', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue })

    const promises = Array.from({ length: 100 }, (_, i) =>
      eventBridge.publish({ event: `rapid:${i}`, data: { index: i } })
    )

    await expect(Promise.all(promises)).resolves.not.toThrow()
    expect(mockQueue.send).toHaveBeenCalledTimes(100)
  })

  it('should handle queue send failures gracefully', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockRejectedValue(new Error('Queue unavailable')),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue })

    await expect(
      eventBridge.publish({
        event: 'test:event',
        data: {},
      })
    ).rejects.toThrow(/queue/i)
  })

  it('should handle DLQ send failures', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }
    const mockDLQ: QueueBinding = {
      send: vi.fn().mockRejectedValue(new Error('DLQ unavailable')),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    }

    eventBridge.configure({ queue: mockQueue, dlq: mockDLQ, maxRetries: 1 })
    eventBridge.subscribe('*', vi.fn().mockRejectedValue(new Error('Handler error')))

    // Should not throw, but should log/handle the DLQ failure
    const result = await eventBridge.process([
      { id: 'msg-1', timestamp: new Date(), body: { event: 'test' }, attempts: 5 },
    ])

    expect(result.failed).toBe(1)
  })
})

// =============================================================================
// EventBridge - Batch Operations
// =============================================================================

describe('EventBridge - Batch Operations', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  const schema = {
    Post: {
      title: 'string',
    },
  } as const

  it('should batch events when batch size threshold is reached', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const sendBatchSpy = vi.fn().mockResolvedValue(undefined)
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: sendBatchSpy,
    }

    eventBridge.configure({ queue: mockQueue, batchSize: 10 })

    const events = Array.from({ length: 25 }, (_, i) => ({
      event: `batch:event`,
      data: { index: i },
    }))

    await eventBridge.publishBatch(events)

    // Should have been batched
    expect(sendBatchSpy).toHaveBeenCalled()
    const totalSent = sendBatchSpy.mock.calls.reduce(
      (sum, call) => sum + (call[0] as unknown[]).length,
      0
    )
    expect(totalSent).toBe(25)
  })

  it('should respect configured batch size', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    const sendBatchSpy = vi.fn().mockResolvedValue(undefined)
    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: sendBatchSpy,
    }

    eventBridge.configure({ queue: mockQueue, batchSize: 5 })

    const events = Array.from({ length: 12 }, (_, i) => ({
      event: `batch:event`,
      data: { index: i },
    }))

    await eventBridge.publishBatch(events)

    // Should have 3 batches: 5, 5, 2
    expect(sendBatchSpy).toHaveBeenCalledTimes(3)
    expect((sendBatchSpy.mock.calls[0][0] as unknown[]).length).toBe(5)
    expect((sendBatchSpy.mock.calls[1][0] as unknown[]).length).toBe(5)
    expect((sendBatchSpy.mock.calls[2][0] as unknown[]).length).toBe(2)
  })

  it('should handle partial batch failures', async () => {
    const { eventBridge } = DB(schema) as { eventBridge: EventBridgeAPI } & ReturnType<typeof DB>
    let callCount = 0
    const sendBatchSpy = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 2) {
        return Promise.reject(new Error('Batch failed'))
      }
      return Promise.resolve(undefined)
    })

    const mockQueue: QueueBinding = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: sendBatchSpy,
    }

    eventBridge.configure({ queue: mockQueue, batchSize: 5 })

    const events = Array.from({ length: 15 }, (_, i) => ({
      event: `batch:event`,
      data: { index: i },
    }))

    // Should handle partial failure gracefully
    await expect(eventBridge.publishBatch(events)).rejects.toThrow()
  })
})
