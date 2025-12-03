/**
 * Event handler registration using on.Noun.event syntax
 *
 * Usage:
 *   on.Customer.created(customer => { ... })
 *   on.Order.completed(order => { ... })
 *   on.Payment.failed(payment => { ... })
 */

import type { EventHandler, EventRegistration } from './types.js'

/**
 * Registry of event handlers
 */
const eventRegistry: EventRegistration[] = []

/**
 * Get all registered event handlers
 */
export function getEventHandlers(): EventRegistration[] {
  return [...eventRegistry]
}

/**
 * Clear all registered event handlers
 */
export function clearEventHandlers(): void {
  eventRegistry.length = 0
}

/**
 * Register an event handler directly
 */
export function registerEventHandler(
  noun: string,
  event: string,
  handler: EventHandler
): void {
  eventRegistry.push({
    noun,
    event,
    handler,
    source: handler.toString(),
  })
}

/**
 * Event proxy type for on.Noun.event pattern
 */
type EventProxy = {
  [noun: string]: {
    [event: string]: (handler: EventHandler) => void
  }
}

/**
 * Create the `on` proxy
 *
 * This creates a proxy that allows:
 *   on.Customer.created(handler)
 *   on.Order.shipped(handler)
 *
 * The first property access captures the noun (Customer, Order)
 * The second property access captures the event (created, shipped)
 * The function call registers the handler
 */
function createOnProxy(): EventProxy {
  return new Proxy({} as EventProxy, {
    get(_target, noun: string) {
      // Return a proxy for the event level
      return new Proxy({}, {
        get(_eventTarget, event: string) {
          // Return a function that registers the handler
          return (handler: EventHandler) => {
            registerEventHandler(noun, event, handler)
          }
        }
      })
    }
  })
}

/**
 * The `on` object for registering event handlers
 *
 * @example
 * ```ts
 * import { on } from 'ai-workflows'
 *
 * on.Customer.created(async (customer, $) => {
 *   $.log('Customer created:', customer.name)
 *   await $.send('Email.welcome', { to: customer.email })
 * })
 *
 * on.Order.completed(async (order, $) => {
 *   $.log('Order completed:', order.id)
 * })
 * ```
 */
export const on = createOnProxy()
