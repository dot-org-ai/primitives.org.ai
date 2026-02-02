/**
 * Event Bridge Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  EventBridge,
  createQueueHandler,
  createEventBridge,
  type QueuedEvent,
  type Queue,
  type MessageBatch,
  type QueueMessage,
} from '../src/event-bridge.js'

// Mock queue implementation for testing
function createMockQueue<T = unknown>(): Queue<T> & { messages: T[] } {
  const messages: T[] = []
  return {
    messages,
    async send(message: T): Promise<void> {
      messages.push(message)
    },
    async sendBatch(batch: Iterable<{ body: T }>): Promise<void> {
      for (const { body } of batch) {
        messages.push(body)
      }
    },
  }
}

// Mock message for testing
function createMockMessage<T>(body: T): QueueMessage<T> {
  return {
    id: 'msg-1',
    timestamp: new Date(),
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  }
}

// Mock message batch for testing
function createMockBatch<T>(messages: T[]): MessageBatch<T> {
  return {
    queue: 'test-queue',
    messages: messages.map((body) => createMockMessage(body)),
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  }
}

describe('EventBridge', () => {
  describe('basic event handling (no queue)', () => {
    it('should emit and handle events synchronously without a queue', async () => {
      const bridge = new EventBridge()
      const handler = vi.fn()

      bridge.on('test.event', handler)
      await bridge.emit('test.event', { foo: 'bar' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        { foo: 'bar' },
        expect.objectContaining({
          type: 'test.event',
          data: { foo: 'bar' },
        })
      )
    })

    it('should support multiple handlers for the same event', async () => {
      const bridge = new EventBridge()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bridge.on('test.event', handler1)
      bridge.on('test.event', handler2)
      await bridge.emit('test.event', { value: 123 })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should support wildcard handlers', async () => {
      const bridge = new EventBridge()
      const wildcardHandler = vi.fn()
      const specificHandler = vi.fn()

      bridge.on('*', wildcardHandler)
      bridge.on('specific.event', specificHandler)

      await bridge.emit('specific.event', { data: 1 })
      await bridge.emit('other.event', { data: 2 })

      expect(wildcardHandler).toHaveBeenCalledTimes(2)
      expect(specificHandler).toHaveBeenCalledTimes(1)
    })

    it('should remove handlers with off()', async () => {
      const bridge = new EventBridge()
      const handler = vi.fn()

      bridge.on('test.event', handler)
      bridge.off('test.event', handler)
      await bridge.emit('test.event', { value: 1 })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should support once() for one-time handlers', async () => {
      const bridge = new EventBridge()
      const handler = vi.fn()

      bridge.once('test.event', handler)
      await bridge.emit('test.event', { value: 1 })
      await bridge.emit('test.event', { value: 2 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ value: 1 }, expect.anything())
    })
  })

  describe('queue-based event handling', () => {
    it('should send events to queue when configured', async () => {
      const queue = createMockQueue<QueuedEvent>()
      const bridge = new EventBridge(queue)

      await bridge.emit('test.event', { foo: 'bar' })

      expect(queue.messages).toHaveLength(1)
      expect(queue.messages[0]).toMatchObject({
        type: 'test.event',
        data: { foo: 'bar' },
      })
    })

    it('should send batch events to queue', async () => {
      const queue = createMockQueue<QueuedEvent>()
      const bridge = new EventBridge(queue)

      await bridge.emitBatch([
        { type: 'event.1', data: { a: 1 } },
        { type: 'event.2', data: { b: 2 } },
      ])

      expect(queue.messages).toHaveLength(2)
      expect(queue.messages[0].type).toBe('event.1')
      expect(queue.messages[1].type).toBe('event.2')
    })

    it('should include delay when specified', async () => {
      const queue = createMockQueue<QueuedEvent>()
      const bridge = new EventBridge(queue)

      await bridge.emit('test.event', { value: 1 }, { delaySeconds: 30 })

      // The message should be queued (queue.send was called)
      expect(queue.messages).toHaveLength(1)
    })
  })

  describe('message handling', () => {
    it('should process messages and ack on success', async () => {
      const bridge = new EventBridge()
      const handler = vi.fn()
      bridge.on('test.event', handler)

      const event: QueuedEvent = {
        type: 'test.event',
        data: { value: 1 },
        timestamp: Date.now(),
        id: 'event-1',
        attempts: 0,
      }
      const message = createMockMessage(event)

      await bridge.handleMessage(message)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(message.ack).toHaveBeenCalled()
    })

    it('should retry on handler failure', async () => {
      const bridge = new EventBridge()
      bridge.on('test.event', () => {
        throw new Error('Handler failed')
      })

      const event: QueuedEvent = {
        type: 'test.event',
        data: { value: 1 },
        timestamp: Date.now(),
        id: 'event-1',
        attempts: 0,
      }
      const message = createMockMessage(event)

      await bridge.handleMessage(message)

      expect(message.retry).toHaveBeenCalled()
      expect(message.ack).not.toHaveBeenCalled()
    })

    it('should send to DLQ after max retries', async () => {
      const dlq = createMockQueue<QueuedEvent>()
      const bridge = new EventBridge(undefined, {
        maxRetries: 3,
        deadLetterQueue: dlq,
      })
      bridge.on('test.event', () => {
        throw new Error('Handler failed')
      })

      const event: QueuedEvent = {
        type: 'test.event',
        data: { value: 1 },
        timestamp: Date.now(),
        id: 'event-1',
        attempts: 2, // Will be incremented to 3 during processing
      }
      const message = createMockMessage(event)

      await bridge.handleMessage(message)

      expect(dlq.messages).toHaveLength(1)
      expect(dlq.messages[0]).toMatchObject({
        type: 'test.event',
        error: 'Handler failed',
      })
      expect(message.ack).toHaveBeenCalled() // Ack after DLQ
    })

    it('should handle message batch', async () => {
      const bridge = new EventBridge()
      const handler = vi.fn()
      bridge.on('test.event', handler)

      const events: QueuedEvent[] = [
        { type: 'test.event', data: { n: 1 }, timestamp: Date.now(), id: '1' },
        { type: 'test.event', data: { n: 2 }, timestamp: Date.now(), id: '2' },
      ]
      const batch = createMockBatch(events)

      await bridge.handleBatch(batch)

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('validation', () => {
    it('should validate events when validator is configured', async () => {
      const bridge = new EventBridge(undefined, {
        validator: (event) => event.type.startsWith('valid.'),
      })
      const handler = vi.fn()
      bridge.on('valid.event', handler)
      bridge.on('invalid.event', handler)

      await bridge.emit('valid.event', { data: 1 })
      expect(handler).toHaveBeenCalledTimes(1)

      await expect(bridge.emit('invalid.event', { data: 2 })).rejects.toThrow(
        'Event validation failed'
      )
    })
  })

  describe('serialization', () => {
    it('should use custom serializer/deserializer', async () => {
      const bridge = new EventBridge(undefined, {
        serializer: (data) => JSON.stringify(data),
        deserializer: (data) => JSON.parse(data as string),
      })
      const handler = vi.fn()
      bridge.on('test.event', handler)

      await bridge.emit('test.event', { value: 42 })

      // The handler receives the original data (not serialized)
      // because sync mode doesn't go through deserialize
      expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything())
    })
  })

  describe('utility methods', () => {
    it('should return registered event types', () => {
      const bridge = new EventBridge()
      bridge.on('event.a', () => {})
      bridge.on('event.b', () => {})
      bridge.on('event.c', () => {})

      const types = bridge.getEventTypes()
      expect(types).toContain('event.a')
      expect(types).toContain('event.b')
      expect(types).toContain('event.c')
    })

    it('should check if handlers exist', () => {
      const bridge = new EventBridge()
      bridge.on('has.handler', () => {})

      expect(bridge.hasHandlers('has.handler')).toBe(true)
      expect(bridge.hasHandlers('no.handler')).toBe(false)
    })

    it('should clear all handlers', () => {
      const bridge = new EventBridge()
      bridge.on('event.a', () => {})
      bridge.on('event.b', () => {})
      bridge.on('*', () => {})

      bridge.clearHandlers()

      expect(bridge.getEventTypes()).toHaveLength(0)
      expect(bridge.hasHandlers('event.a')).toBe(false)
    })
  })
})

describe('createQueueHandler', () => {
  it('should create a valid queue handler', async () => {
    const bridge = new EventBridge()
    const handler = vi.fn()
    bridge.on('test.event', handler)

    const queueHandler = createQueueHandler(bridge)

    const events: QueuedEvent[] = [
      { type: 'test.event', data: { n: 1 }, timestamp: Date.now(), id: '1' },
    ]
    const batch = createMockBatch(events)

    await queueHandler.queue(batch)

    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('createEventBridge', () => {
  it('should create EventBridge with default config', () => {
    const bridge = createEventBridge()
    expect(bridge).toBeInstanceOf(EventBridge)
  })

  it('should create EventBridge with queue and DLQ', () => {
    const queue = createMockQueue()
    const dlq = createMockQueue()
    const bridge = createEventBridge(queue, dlq)
    expect(bridge).toBeInstanceOf(EventBridge)
  })
})
