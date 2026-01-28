/**
 * Event handler registration using on.Noun.event syntax
 *
 * Usage:
 *   on.Customer.created(customer => { ... })
 *   on.Order.completed(order => { ... })
 *   on.Payment.failed(payment => { ... })
 *
 * With dependencies:
 *   on.Step2.complete(handler, { dependsOn: 'Step1.complete' })
 *   on.Step3.complete(handler, { dependsOn: ['Step1.complete', 'Step2.complete'] })
 */

import type {
  EventHandler,
  EventRegistration,
  DependencyConfig,
  OnProxy,
  NounEventProxy,
  OnProxyHandler,
  NounEventProxyHandler,
} from './types.js'

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
  handler: EventHandler,
  dependencies?: DependencyConfig
): void {
  eventRegistry.push({
    noun,
    event,
    handler,
    source: handler.toString(),
    ...(dependencies !== undefined && { dependencies }),
  })
}

/**
 * Handler registration callback type
 * Used by createTypedOnProxy to customize handler registration
 */
export type OnProxyRegistrationCallback = (
  noun: string,
  event: string,
  handler: EventHandler,
  dependencies?: DependencyConfig
) => void

/**
 * Create a typed OnProxy with proper TypeScript generics
 *
 * This factory function creates a two-level proxy that allows:
 *   proxy.Customer.created(handler)
 *   proxy.Order.shipped(handler)
 *
 * The first property access captures the noun (Customer, Order)
 * The second property access captures the event (created, shipped)
 * The function call invokes the registration callback
 *
 * @param registerCallback - Function called when a handler is registered
 * @returns A properly typed OnProxy
 *
 * @example
 * ```ts
 * // Create proxy with custom registration
 * const myOn = createTypedOnProxy((noun, event, handler, deps) => {
 *   myRegistry.push({ noun, event, handler, deps })
 * })
 *
 * myOn.Customer.created(handler) // Properly typed!
 * ```
 */
export function createTypedOnProxy(registerCallback: OnProxyRegistrationCallback): OnProxy {
  // Create typed handler for the noun level (event accessors)
  const createNounHandler = (noun: string): NounEventProxyHandler => ({
    get(
      _target: Record<string, (handler: EventHandler, dependencies?: DependencyConfig) => void>,
      event: string,
      _receiver: unknown
    ): (handler: EventHandler, dependencies?: DependencyConfig) => void {
      // Return a function that registers the handler with optional dependencies
      return (handler: EventHandler, dependencies?: DependencyConfig) => {
        registerCallback(noun, event, handler, dependencies)
      }
    },
  })

  // Create typed handler for the top-level proxy (noun accessors)
  const onHandler: OnProxyHandler = {
    get(_target: Record<string, NounEventProxy>, noun: string, _receiver: unknown): NounEventProxy {
      // Return a proxy for the event level with typed handler
      const eventTarget: Record<
        string,
        (handler: EventHandler, dependencies?: DependencyConfig) => void
      > = {}
      return new Proxy(eventTarget, createNounHandler(noun)) as NounEventProxy
    },
  }

  // Create and return the typed OnProxy
  const target: Record<string, NounEventProxy> = {}
  return new Proxy(target, onHandler) as OnProxy
}

/**
 * Create the `on` proxy using the global event registry
 *
 * This is the default implementation that uses registerEventHandler
 * for backward compatibility with the standalone `on` export.
 */
function createOnProxy(): OnProxy {
  return createTypedOnProxy(registerEventHandler)
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
