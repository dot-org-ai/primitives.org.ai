/**
 * EventBridge - Event system with Cloudflare Queues support
 *
 * Provides both sync event handling and Queue-based async event delivery.
 * Supports dead letter queues, event validation, and retry strategies.
 *
 * @example
 * ```typescript
 * // Create an EventBridge with a queue
 * const bridge = new EventBridge(env.MY_QUEUE)
 *
 * // Register event handlers
 * bridge.on('user.created', async (data) => {
 *   console.log('New user:', data.id)
 * })
 *
 * // Emit events (sent to queue for reliable delivery)
 * await bridge.emit('user.created', { id: '123', name: 'John' })
 *
 * // In worker's queue handler:
 * export default {
 *   async queue(batch, env) {
 *     const handler = createQueueHandler(bridge)
 *     await handler.queue(batch, env)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

/**
 * Queued event structure
 */
export interface QueuedEvent<T = unknown> {
  /** Event type identifier */
  type: string
  /** Event payload data */
  data: T
  /** Event creation timestamp */
  timestamp: number
  /** Unique event ID */
  id: string
  /** Optional metadata */
  metadata?: Record<string, unknown> | undefined
  /** Number of retry attempts */
  attempts?: number | undefined
  /** Error message (for DLQ events) */
  error?: string | undefined
}

/**
 * EventBridge configuration options
 */
export interface EventBridgeConfig {
  /** Maximum retry attempts before sending to DLQ */
  maxRetries?: number | undefined
  /** Dead letter queue for failed events */
  deadLetterQueue?: Queue | undefined
  /** Event schema validation function */
  validator?: ((event: QueuedEvent) => boolean | Promise<boolean>) | undefined
  /** Custom serializer for event data */
  serializer?: (<T>(data: T) => unknown) | undefined
  /** Custom deserializer for event data */
  deserializer?: (<T>(data: unknown) => T) | undefined
  /** Enable debug logging */
  debug?: boolean | undefined
}

/**
 * Internal resolved config type
 */
interface ResolvedEventBridgeConfig {
  maxRetries: number
  deadLetterQueue: Queue | undefined
  validator: ((event: QueuedEvent) => boolean | Promise<boolean>) | undefined
  serializer: <T>(data: T) => unknown
  deserializer: <T>(data: unknown) => T
  debug: boolean
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (data: T, event: QueuedEvent<T>) => void | Promise<void>

/**
 * Queue message interface (Cloudflare Queues)
 */
export interface QueueMessage<T = unknown> {
  readonly id: string
  readonly timestamp: Date
  readonly body: T
  ack(): void
  retry(options?: { delaySeconds?: number | undefined }): void
}

/**
 * Message batch interface (Cloudflare Queues)
 */
export interface MessageBatch<T = unknown> {
  readonly queue: string
  readonly messages: readonly QueueMessage<T>[]
  ackAll(): void
  retryAll(options?: { delaySeconds?: number | undefined }): void
}

/**
 * Queue interface (Cloudflare Queues)
 */
export interface Queue<T = unknown> {
  send(
    message: T,
    options?: { contentType?: string | undefined; delaySeconds?: number | undefined }
  ): Promise<void>
  sendBatch(
    messages: Iterable<{
      body: T
      contentType?: string | undefined
      delaySeconds?: number | undefined
    }>
  ): Promise<void>
}

/**
 * Emit options for customizing event delivery
 */
export interface EmitOptions {
  /** Delay before the event is processed (in seconds) */
  delaySeconds?: number | undefined
  /** Additional metadata to attach to the event */
  metadata?: Record<string, unknown> | undefined
}

/**
 * EventBridge - Unified event system with Queue support
 *
 * Provides reliable event delivery via Cloudflare Queues with
 * support for multiple handlers, dead letter queues, and retries.
 */
export class EventBridge {
  private handlers = new Map<string, EventHandler[]>()
  private wildcardHandlers: EventHandler[] = []
  private config: ResolvedEventBridgeConfig

  /**
   * Create a new EventBridge
   *
   * @param queue - Cloudflare Queue for event delivery
   * @param config - Optional configuration
   */
  constructor(private queue?: Queue, config: EventBridgeConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      deadLetterQueue: config.deadLetterQueue,
      validator: config.validator,
      serializer: config.serializer ?? ((data) => data),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deserializer: config.deserializer ?? ((data) => data as any),
      debug: config.debug ?? false,
    }
  }

  /**
   * Emit an event
   *
   * If a queue is configured, the event will be sent to the queue for
   * reliable delivery. Otherwise, handlers are invoked synchronously.
   *
   * @param event - Event type identifier
   * @param data - Event payload data
   * @param options - Optional emit options
   */
  async emit<T = unknown>(event: string, data: T, options?: EmitOptions): Promise<void> {
    const queuedEvent: QueuedEvent<T> = {
      type: event,
      data: this.config.serializer(data) as T,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      metadata: options?.metadata,
      attempts: 0,
    }

    if (this.config.debug) {
      console.log(`[EventBridge] Emitting event: ${event}`, queuedEvent.id)
    }

    // Validate event if validator is configured
    if (this.config.validator) {
      const isValid = await this.config.validator(queuedEvent)
      if (!isValid) {
        throw new Error(`Event validation failed for type: ${event}`)
      }
    }

    if (this.queue) {
      // Send to queue for reliable delivery
      const sendOptions: { contentType?: string | undefined; delaySeconds?: number | undefined } =
        {}
      if (options?.delaySeconds !== undefined) {
        sendOptions.delaySeconds = options.delaySeconds
      }
      await this.queue.send(queuedEvent, sendOptions)
    } else {
      // No queue - invoke handlers synchronously
      await this.invokeHandlers(queuedEvent)
    }
  }

  /**
   * Emit multiple events in a batch
   *
   * @param events - Array of events to emit
   */
  async emitBatch<T = unknown>(
    events: Array<{ type: string; data: T; options?: EmitOptions }>
  ): Promise<void> {
    if (!this.queue) {
      // No queue - invoke handlers for each event synchronously
      for (const { type, data, options } of events) {
        await this.emit(type, data, options)
      }
      return
    }

    const messages = events.map(({ type, data, options }) => {
      const msg: {
        body: QueuedEvent<T>
        contentType?: string | undefined
        delaySeconds?: number | undefined
      } = {
        body: {
          type,
          data: this.config.serializer(data) as T,
          timestamp: Date.now(),
          id: crypto.randomUUID(),
          metadata: options?.metadata,
          attempts: 0,
        },
      }
      if (options?.delaySeconds !== undefined) {
        msg.delaySeconds = options.delaySeconds
      }
      return msg
    })

    await this.queue.sendBatch(messages)
  }

  /**
   * Register an event handler
   *
   * @param event - Event type to handle (use '*' for all events)
   * @param handler - Handler function
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (event === '*') {
      this.wildcardHandlers.push(handler as EventHandler)
      return
    }

    const handlers = this.handlers.get(event) ?? []
    handlers.push(handler as EventHandler)
    this.handlers.set(event, handlers)
  }

  /**
   * Remove an event handler
   *
   * @param event - Event type
   * @param handler - Handler to remove
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (event === '*') {
      const index = this.wildcardHandlers.indexOf(handler as EventHandler)
      if (index !== -1) {
        this.wildcardHandlers.splice(index, 1)
      }
      return
    }

    const handlers = this.handlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler as EventHandler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Register a one-time event handler
   *
   * @param event - Event type to handle
   * @param handler - Handler function (called once then removed)
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = async (data, queuedEvent) => {
      this.off(event, wrapper)
      await handler(data, queuedEvent)
    }
    this.on(event, wrapper)
  }

  /**
   * Handle a message from the queue
   *
   * This method should be called from your worker's queue handler.
   *
   * @param message - Queue message to process
   */
  async handleMessage<T = unknown>(message: QueueMessage<QueuedEvent<T>>): Promise<void> {
    const event = message.body
    const attempts = (event.attempts ?? 0) + 1
    const deserializedEvent: QueuedEvent<T> = {
      ...event,
      data: this.config.deserializer(event.data),
      attempts,
    }

    if (this.config.debug) {
      console.log(`[EventBridge] Processing event: ${event.type}`, event.id, `attempt: ${attempts}`)
    }

    try {
      await this.invokeHandlers(deserializedEvent)
      message.ack()
    } catch (error) {
      if (this.config.debug) {
        console.error(`[EventBridge] Error processing event: ${event.type}`, error)
      }

      // Check if we should send to DLQ
      if (attempts >= this.config.maxRetries) {
        if (this.config.deadLetterQueue) {
          await this.config.deadLetterQueue.send({
            ...deserializedEvent,
            error: error instanceof Error ? error.message : String(error),
          })
          message.ack() // Ack after sending to DLQ
        } else {
          // No DLQ - let it fail (will be dropped after max retries)
          message.ack()
        }
      } else {
        // Retry with exponential backoff
        const delaySeconds = Math.min(60, Math.pow(2, attempts))
        message.retry({ delaySeconds })
      }
    }
  }

  /**
   * Handle a batch of messages from the queue
   *
   * @param batch - Message batch to process
   */
  async handleBatch<T = unknown>(batch: MessageBatch<QueuedEvent<T>>): Promise<void> {
    // Process messages in parallel
    await Promise.all(batch.messages.map((message) => this.handleMessage(message)))
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Check if there are handlers for an event type
   */
  hasHandlers(event: string): boolean {
    const handlers = this.handlers.get(event)
    return (handlers && handlers.length > 0) || this.wildcardHandlers.length > 0
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear()
    this.wildcardHandlers = []
  }

  /**
   * Invoke handlers for an event
   */
  private async invokeHandlers<T>(event: QueuedEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? []
    const allHandlers = [...handlers, ...this.wildcardHandlers]

    if (allHandlers.length === 0) {
      if (this.config.debug) {
        console.log(`[EventBridge] No handlers for event: ${event.type}`)
      }
      return
    }

    // Fan-out to all handlers
    await Promise.all(allHandlers.map((handler) => handler(event.data, event)))
  }
}

/**
 * Create a queue handler for use in a Cloudflare Worker
 *
 * @param bridge - EventBridge instance to handle events
 * @returns Queue handler object with queue method
 *
 * @example
 * ```typescript
 * const bridge = new EventBridge(env.MY_QUEUE)
 * const handler = createQueueHandler(bridge)
 *
 * export default {
 *   async queue(batch, env, ctx) {
 *     await handler.queue(batch, env, ctx)
 *   }
 * }
 * ```
 */
export function createQueueHandler(bridge: EventBridge): {
  queue: <T>(batch: MessageBatch<QueuedEvent<T>>, env?: unknown, ctx?: unknown) => Promise<void>
} {
  return {
    async queue<T>(
      batch: MessageBatch<QueuedEvent<T>>,
      _env?: unknown,
      _ctx?: unknown
    ): Promise<void> {
      await bridge.handleBatch(batch)
    },
  }
}

/**
 * Create an EventBridge with standard configuration
 *
 * @param queue - Optional queue for async delivery
 * @param dlq - Optional dead letter queue
 * @returns Configured EventBridge instance
 */
export function createEventBridge(queue?: Queue, dlq?: Queue): EventBridge {
  const config: EventBridgeConfig = {
    maxRetries: 3,
    debug: false,
  }
  if (dlq) {
    config.deadLetterQueue = dlq
  }
  return new EventBridge(queue, config)
}

/**
 * Type helper for strongly-typed event maps
 *
 * @example
 * ```typescript
 * type MyEvents = {
 *   'user.created': { id: string; name: string }
 *   'user.deleted': { id: string }
 * }
 *
 * const bridge = new EventBridge(queue) as TypedEventBridge<MyEvents>
 * bridge.emit('user.created', { id: '1', name: 'John' }) // type-safe!
 * ```
 */
export interface TypedEventBridge<TEvents extends Record<string, unknown>> {
  emit<K extends keyof TEvents & string>(
    event: K,
    data: TEvents[K],
    options?: EmitOptions
  ): Promise<void>
  on<K extends keyof TEvents & string>(event: K, handler: EventHandler<TEvents[K]>): void
  off<K extends keyof TEvents & string>(event: K, handler: EventHandler<TEvents[K]>): void
  once<K extends keyof TEvents & string>(event: K, handler: EventHandler<TEvents[K]>): void
}
