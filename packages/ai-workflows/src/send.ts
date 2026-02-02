/**
 * Event emission using send('Noun.event', data)
 *
 * Usage:
 *   send('Customer.created', customer)
 *   send('Order.completed', order)
 */

import { getEventHandlers } from './on.js'
import { createWorkflowContext } from './context.js'
import { parseEvent } from './workflow.js'
import { getLogger } from './logger.js'

/**
 * Event bus for managing event delivery
 */
class EventBus {
  private pending: Array<{ event: string; data: unknown }> = []
  private processing = false

  /**
   * Emit an event
   */
  async emit(event: string, data: unknown): Promise<void> {
    this.pending.push({ event, data })

    if (!this.processing) {
      await this.process()
    }
  }

  /**
   * Process pending events
   */
  private async process(): Promise<void> {
    this.processing = true

    while (this.pending.length > 0) {
      const item = this.pending.shift()!
      await this.deliver(item.event, item.data)
    }

    this.processing = false
  }

  /**
   * Deliver an event to matching handlers
   */
  private async deliver(event: string, data: unknown): Promise<void> {
    const parsed = parseEvent(event)
    if (!parsed) {
      getLogger().warn(`Invalid event format: ${event}. Expected Noun.event`)
      return
    }

    const handlers = getEventHandlers()
    const matching = handlers.filter((h) => h.noun === parsed.noun && h.event === parsed.event)

    if (matching.length === 0) {
      // No handlers registered - that's okay, event is just not handled
      return
    }

    // Create workflow context for handlers
    const ctx = createWorkflowContext(this)

    // Execute all matching handlers
    await Promise.all(
      matching.map(async ({ handler }) => {
        try {
          await handler(data, ctx)
        } catch (error) {
          getLogger().error(`Error in handler for ${event}:`, error)
        }
      })
    )
  }
}

/**
 * Global event bus instance
 */
const globalEventBus = new EventBus()

/**
 * Send an event
 *
 * @example
 * ```ts
 * import { send } from 'ai-workflows'
 *
 * // Emit a customer created event
 * await send('Customer.created', {
 *   id: '123',
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * })
 *
 * // Emit an order completed event
 * await send('Order.completed', {
 *   id: 'order-456',
 *   total: 99.99
 * })
 * ```
 */
export async function send<T = unknown>(event: string, data: T): Promise<void> {
  await globalEventBus.emit(event, data)
}

/**
 * Get the global event bus (for testing/internal use)
 */
export function getEventBus(): EventBus {
  return globalEventBus
}
