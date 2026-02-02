/**
 * EventBridge with Cloudflare Queues
 *
 * Enables publishing database events to Cloudflare Queues for async processing.
 * Supports:
 * - Publishing events to queues with optional delays
 * - Batch publishing for efficiency
 * - Event routing based on patterns
 * - Dead letter queue (DLQ) handling for failed events
 * - Message processing with retry logic
 * - Statistics tracking
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Cloudflare Queue message type
 */
export interface QueueMessage<T = unknown> {
  id: string
  timestamp: Date
  body: T
  attempts: number
}

/**
 * Cloudflare Queue binding interface
 */
export interface QueueBinding {
  send(message: unknown, options?: { delaySeconds?: number }): Promise<void>
  sendBatch(messages: Array<{ body: unknown; delaySeconds?: number }>): Promise<void>
}

/**
 * EventBridge configuration
 */
export interface EventBridgeConfig {
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
 * Event to publish
 */
export interface PublishEvent {
  event: string
  data?: unknown
  actor?: string
  object?: string
  delay?: number
  meta?: Record<string, unknown>
}

/**
 * Published event with generated fields
 */
export interface PublishedEvent extends PublishEvent {
  id: string
  timestamp: string
}

/**
 * Result of processing messages
 */
export interface ProcessResult {
  processed: number
  failed: number
  retried: number
  deadLettered: number
}

/**
 * Queue statistics
 */
export interface EventBridgeStats {
  published: number
  processed: number
  failed: number
  deadLettered: number
  pending: number
}

/**
 * Subscription handler
 */
export type SubscriptionHandler = (message: QueueMessage) => Promise<void>

/**
 * Subscription entry
 */
interface Subscription {
  pattern: string
  handler: SubscriptionHandler
}

/**
 * EventBridge API interface
 */
export interface EventBridgeAPI {
  /** Publish an event to the queue */
  publish(event: PublishEvent): Promise<void>
  /** Publish multiple events in a batch */
  publishBatch(events: PublishEvent[]): Promise<void>
  /** Subscribe to events with a handler */
  subscribe(pattern: string, handler: SubscriptionHandler): () => void
  /** Process incoming queue messages */
  process(messages: QueueMessage[]): Promise<ProcessResult>
  /** Get queue statistics */
  getStats(): EventBridgeStats
  /** Configure the bridge */
  configure(config: EventBridgeConfig): void
}

// =============================================================================
// Pattern Matching
// =============================================================================

/**
 * Check if an event name matches a pattern
 * Supports wildcards: 'Post.*', '*.created', '*'
 */
function matchesPattern(eventName: string, pattern: string): boolean {
  if (pattern === '*') return true

  const eventParts = eventName.split('.')
  const patternParts = pattern.split('.')

  // For colon-separated patterns (e.g., 'analytics:*')
  if (pattern.includes(':')) {
    const [patternPrefix, patternSuffix] = pattern.split(':')
    const [eventPrefix] = eventName.split(':')
    if (patternSuffix === '*') {
      return eventPrefix === patternPrefix
    }
    return eventName === pattern
  }

  // For dot-separated patterns (e.g., 'Post.*', '*.created')
  if (eventParts.length !== patternParts.length && !pattern.includes('*')) {
    return false
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const eventPart = eventParts[i]

    if (patternPart === '*') continue
    if (patternPart !== eventPart) return false
  }

  return true
}

/**
 * Find the matching queue for an event based on configured routes
 * Returns the first matching route (priority order)
 */
function findMatchingQueue(
  eventName: string,
  routes: Record<string, QueueBinding>,
  defaultQueue?: QueueBinding
): QueueBinding | undefined {
  // Check routes in order (Object.entries preserves insertion order)
  for (const [pattern, queue] of Object.entries(routes)) {
    if (matchesPattern(eventName, pattern)) {
      return queue
    }
  }
  return defaultQueue
}

// =============================================================================
// EventBridge Implementation
// =============================================================================

/**
 * Create an EventBridge instance
 */
export function createEventBridge(): EventBridgeAPI {
  let config: EventBridgeConfig = {}
  const subscriptions: Subscription[] = []

  // Statistics
  const stats: EventBridgeStats = {
    published: 0,
    processed: 0,
    failed: 0,
    deadLettered: 0,
    pending: 0,
  }

  /**
   * Get the queue to use for an event
   */
  function getQueueForEvent(eventName: string): QueueBinding | undefined {
    if (config.routes) {
      return findMatchingQueue(eventName, config.routes, config.queue)
    }
    return config.queue
  }

  /**
   * Create a published event with generated fields
   */
  function createPublishedEvent(event: PublishEvent): PublishedEvent {
    return {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
  }

  const api: EventBridgeAPI = {
    configure(newConfig: EventBridgeConfig): void {
      config = { ...config, ...newConfig }
    },

    async publish(event: PublishEvent): Promise<void> {
      const queue = getQueueForEvent(event.event)
      if (!queue) {
        throw new Error('Queue not configured for publishing events')
      }

      const publishedEvent = createPublishedEvent(event)
      const options = event.delay ? { delaySeconds: event.delay } : {}

      await queue.send(publishedEvent, options)
      stats.published++
    },

    async publishBatch(events: PublishEvent[]): Promise<void> {
      if (events.length === 0) return

      const queue = config.queue
      if (!queue) {
        throw new Error('Queue not configured for publishing events')
      }

      const batchSize = config.batchSize ?? 100

      // Group events into batches
      const batches: Array<Array<{ body: unknown; delaySeconds?: number }>> = []
      let currentBatch: Array<{ body: unknown; delaySeconds?: number }> = []

      for (const event of events) {
        const publishedEvent = createPublishedEvent(event)
        const batchItem: { body: unknown; delaySeconds?: number } = { body: publishedEvent }
        if (event.delay) {
          batchItem.delaySeconds = event.delay
        }
        currentBatch.push(batchItem)

        if (currentBatch.length >= batchSize) {
          batches.push(currentBatch)
          currentBatch = []
        }
      }

      // Don't forget the last partial batch
      if (currentBatch.length > 0) {
        batches.push(currentBatch)
      }

      // Send all batches
      for (const batch of batches) {
        await queue.sendBatch(batch)
        stats.published += batch.length
      }
    },

    subscribe(pattern: string, handler: SubscriptionHandler): () => void {
      const subscription: Subscription = { pattern, handler }
      subscriptions.push(subscription)

      // Return unsubscribe function
      return () => {
        const index = subscriptions.indexOf(subscription)
        if (index !== -1) {
          subscriptions.splice(index, 1)
        }
      }
    },

    async process(messages: QueueMessage[]): Promise<ProcessResult> {
      const result: ProcessResult = {
        processed: 0,
        failed: 0,
        retried: 0,
        deadLettered: 0,
      }

      for (const message of messages) {
        const body = message.body as { event?: string }
        const eventName = body?.event ?? ''

        // Find matching handlers
        const matchingHandlers = subscriptions.filter((sub) =>
          matchesPattern(eventName, sub.pattern)
        )

        // If no handlers match, count as processed (no-op)
        if (matchingHandlers.length === 0) {
          result.processed++
          stats.processed++
          continue
        }

        // Execute all matching handlers
        let handlerFailed = false
        let lastError: Error | undefined

        for (const { handler } of matchingHandlers) {
          try {
            await handler(message)
          } catch (error) {
            handlerFailed = true
            lastError = error instanceof Error ? error : new Error(String(error))
          }
        }

        if (handlerFailed) {
          const maxRetries = config.maxRetries ?? 3

          // Check if we should send to DLQ
          if (message.attempts > maxRetries) {
            // Send to DLQ if configured
            if (config.dlq) {
              try {
                await config.dlq.send(
                  {
                    originalMessage: message,
                    error: lastError?.message ?? 'Unknown error',
                  },
                  {}
                )
                result.deadLettered++
                stats.deadLettered++
              } catch {
                // DLQ send failed - count as failed
                result.failed++
                stats.failed++
              }
            } else {
              result.failed++
              stats.failed++
            }
          } else {
            // Can retry
            result.retried++
            result.failed++
            stats.failed++
          }
        } else {
          result.processed++
          stats.processed++
        }
      }

      return result
    },

    getStats(): EventBridgeStats {
      return { ...stats }
    },
  }

  return api
}

/**
 * Create the EventBridge API factory for DB integration
 */
export function createEventBridgeAPI(): EventBridgeAPI {
  return createEventBridge()
}
