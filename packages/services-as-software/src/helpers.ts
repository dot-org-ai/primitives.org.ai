/**
 * Helper functions for common service operations
 */

import { warnDeprecatedOnce, resetDeprecationTelemetry } from 'digital-workers/deprecation'
import type {
  Notification,
  Order,
  Quote,
  Subscription,
  OKRDefinition,
  KPIDefinition,
  EntitlementDefinition,
  SubscriptionPlan,
  ServiceContext,
  JSONSchema,
} from './types.js'

// ============================================================================
// Deprecation telemetry (PRD aip-qozi, consolidated in aip-chuu)
// ============================================================================

// Re-export the shared telemetry surface so existing callers
// (`import { warnDeprecatedOnce } from '../src/helpers.js'`) keep working
// while the canonical home of the helper is `digital-workers/deprecation`.
export { warnDeprecatedOnce } from 'digital-workers/deprecation'

/**
 * Reset the one-time deprecation tracker (test-only).
 *
 * @internal Legacy alias retained so existing tests keep compiling; new
 * tests should import `resetDeprecationTelemetry` directly from
 * `digital-workers/deprecation`.
 */
export function __resetDeprecationNotices(): void {
  resetDeprecationTelemetry()
}

/**
 * Ask a question (helper for creating ask endpoints).
 *
 * @deprecated The Verb action surface lives in `digital-workers`. Endpoint
 * handlers that need to invoke a Worker `ask` should import directly from
 * `digital-workers` (e.g. `import { ask } from 'digital-workers'`) and pass a
 * `Worker` target (an `agentAsWorker(agent)` or `personAsWorker(person)`).
 * This pass-through helper will be removed in the next minor release. PRD:
 * route Layer 5 through digital-workers (aip-qozi).
 *
 * @example
 * ```ts
 * const askEndpoint = Endpoint({
 *   name: 'ask',
 *   handler: ask(async (question, context) => {
 *     // Your Q&A logic here
 *     return `Answer to: ${question}`
 *   }),
 * })
 * ```
 */
export function ask(
  handler: (question: string, context?: unknown, serviceContext?: ServiceContext) => Promise<string>
) {
  warnDeprecatedOnce(
    'services-as-software.ask',
    "[services-as-software] DEPRECATED: the `ask` helper is a pass-through wrapper around an endpoint handler. The Verb action surface lives in 'digital-workers' — import `ask` from there and dispatch through a Worker target (e.g. `agentAsWorker(agent)` or `personAsWorker(person)`). This helper will be removed in the next minor release."
  )
  return async (
    input: { question: string; context?: unknown },
    serviceContext?: ServiceContext
  ): Promise<string> => {
    return handler(input.question, input.context, serviceContext)
  }
}

/**
 * Deliver results (helper for creating deliver endpoints)
 *
 * @example
 * ```ts
 * const deliverEndpoint = Endpoint({
 *   name: 'deliver',
 *   handler: deliver(async (orderId, results) => {
 *     // Delivery logic here
 *     console.log(`Delivering order ${orderId}`)
 *   }),
 * })
 * ```
 */
export function deliver(
  handler: (orderId: string, results: unknown, context?: ServiceContext) => Promise<void>
) {
  return async (
    input: { orderId: string; results: unknown },
    context?: ServiceContext
  ): Promise<void> => {
    return handler(input.orderId, input.results, context)
  }
}

/**
 * Execute a task (helper for creating do endpoints)
 *
 * @example
 * ```ts
 * const doEndpoint = Endpoint({
 *   name: 'do',
 *   handler: do(async (action, input) => {
 *     switch (action) {
 *       case 'process':
 *         return { status: 'processed' }
 *       default:
 *         throw new Error(`Unknown action: ${action}`)
 *     }
 *   }),
 * })
 * ```
 */
export function do_(
  handler: (action: string, input?: unknown, context?: ServiceContext) => Promise<unknown>
) {
  warnDeprecatedOnce(
    'services-as-software.do',
    "[services-as-software] DEPRECATED: the `do` helper is a pass-through wrapper around an endpoint handler. The Verb action surface lives in 'digital-workers' — import `do` from there and dispatch through a Worker target. This helper will be removed in the next minor release."
  )
  return async (
    input: { action: string; input?: unknown },
    context?: ServiceContext
  ): Promise<unknown> => {
    return handler(input.action, input.input, context)
  }
}

/**
 * Generate content (helper for creating generate endpoints)
 *
 * @example
 * ```ts
 * const generateEndpoint = Endpoint({
 *   name: 'generate',
 *   handler: generate(async (prompt, options) => {
 *     // Generation logic here
 *     return { text: `Generated from: ${prompt}` }
 *   }),
 * })
 * ```
 */
export function generate(
  handler: (prompt: string, options?: unknown, context?: ServiceContext) => Promise<unknown>
) {
  warnDeprecatedOnce(
    'services-as-software.generate',
    "[services-as-software] DEPRECATED: the `generate` helper is a pass-through wrapper around an endpoint handler. The Verb action surface lives in 'digital-workers' — import `generate` from there and dispatch through a Worker target. This helper will be removed in the next minor release."
  )
  return async (
    input: { prompt: string; options?: unknown },
    context?: ServiceContext
  ): Promise<unknown> => {
    return handler(input.prompt, input.options, context)
  }
}

/**
 * Type checking/validation (helper for creating is endpoints)
 *
 * @example
 * ```ts
 * const isEndpoint = Endpoint({
 *   name: 'is',
 *   handler: is(async (value, type) => {
 *     // Validation logic here
 *     return typeof value === type
 *   }),
 * })
 * ```
 */
export function is(
  handler: (value: unknown, type: string | JSONSchema, context?: ServiceContext) => Promise<boolean>
) {
  warnDeprecatedOnce(
    'services-as-software.is',
    "[services-as-software] DEPRECATED: the `is` helper is a pass-through wrapper around an endpoint handler. The Verb action surface lives in 'digital-workers' — import `is` from there and dispatch through a Worker target. This helper will be removed in the next minor release."
  )
  return async (
    input: { value: unknown; type: string | JSONSchema },
    context?: ServiceContext
  ): Promise<boolean> => {
    return handler(input.value, input.type, context)
  }
}

/**
 * Send notification (helper for creating notify endpoints)
 *
 * @example
 * ```ts
 * const notifyEndpoint = Endpoint({
 *   name: 'notify',
 *   handler: notify(async (notification) => {
 *     // Send notification via email, Slack, etc.
 *     console.log(`Sending notification: ${notification.subject}`)
 *   }),
 * })
 * ```
 */
export function notify(
  handler: (notification: Notification, context?: ServiceContext) => Promise<void>
) {
  warnDeprecatedOnce(
    'services-as-software.notify',
    "[services-as-software] DEPRECATED: the `notify` helper is a pass-through wrapper around an endpoint handler. The Verb action surface lives in 'digital-workers' — import `notify` from there and dispatch through a Worker target. This helper will be removed in the next minor release."
  )
  return async (input: Notification, context?: ServiceContext): Promise<void> => {
    return handler(input, context)
  }
}

/**
 * Event handler (helper for creating event handlers)
 *
 * @example
 * ```ts
 * service.on('order.created', on(async (order) => {
 *   console.log(`New order: ${order.id}`)
 * }))
 * ```
 */
export function on<TPayload>(
  handler: (payload: TPayload, context?: ServiceContext) => void | Promise<void>
) {
  return handler
}

/**
 * Place an order (helper for creating order endpoints)
 *
 * @example
 * ```ts
 * const orderEndpoint = Endpoint({
 *   name: 'order',
 *   handler: order(async (product, quantity, context) => {
 *     const orderId = generateOrderId()
 *     return {
 *       id: orderId,
 *       customerId: context?.customerId || 'unknown',
 *       product,
 *       quantity,
 *       total: calculateTotal(product, quantity),
 *       currency: 'USD',
 *       status: 'pending',
 *       createdAt: new Date(),
 *       updatedAt: new Date(),
 *     }
 *   }),
 * })
 * ```
 */
export function order<TProduct>(
  handler: (
    product: TProduct,
    quantity: number,
    context?: ServiceContext
  ) => Promise<Order<TProduct>>
) {
  return async (
    input: { product: TProduct; quantity: number },
    context?: ServiceContext
  ): Promise<Order<TProduct>> => {
    return handler(input.product, input.quantity, context)
  }
}

/**
 * Queue processor (helper for queue handlers)
 *
 * @example
 * ```ts
 * service.queue('process-orders', queue(async (job) => {
 *   console.log(`Processing job: ${job.id}`)
 * }))
 * ```
 */
export function queue<TJob>(
  handler: (job: TJob, context?: ServiceContext) => void | Promise<void>
) {
  return handler
}

/**
 * Request a quote (helper for creating quote endpoints)
 *
 * @example
 * ```ts
 * const quoteEndpoint = Endpoint({
 *   name: 'quote',
 *   handler: quote(async (product, quantity, context) => {
 *     const price = calculatePrice(product, quantity)
 *     return {
 *       id: generateQuoteId(),
 *       customerId: context?.customerId || 'unknown',
 *       product,
 *       quantity,
 *       price,
 *       currency: 'USD',
 *       expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
 *     }
 *   }),
 * })
 * ```
 */
export function quote<TProduct>(
  handler: (
    product: TProduct,
    quantity: number,
    context?: ServiceContext
  ) => Promise<Quote<TProduct>>
) {
  return async (
    input: { product: TProduct; quantity: number },
    context?: ServiceContext
  ): Promise<Quote<TProduct>> => {
    return handler(input.product, input.quantity, context)
  }
}

/**
 * Subscribe to a plan (helper for creating subscribe endpoints)
 *
 * @example
 * ```ts
 * const subscribeEndpoint = Endpoint({
 *   name: 'subscribe',
 *   handler: subscribe(async (planId, context) => {
 *     const plan = findPlan(planId)
 *     return {
 *       id: generateSubscriptionId(),
 *       customerId: context?.customerId || 'unknown',
 *       planId,
 *       status: 'active',
 *       currentPeriodStart: new Date(),
 *       currentPeriodEnd: getNextBillingDate(plan.pricing.interval),
 *     }
 *   }),
 * })
 * ```
 */
export function subscribe(
  handler: (planId: string, context?: ServiceContext) => Promise<Subscription>
) {
  return async (input: { planId: string }, context?: ServiceContext): Promise<Subscription> => {
    return handler(input.planId, context)
  }
}

/**
 * Scheduled task (helper for every/scheduled tasks)
 *
 * @example
 * ```ts
 * service.every('0 0 * * *', every(async () => {
 *   console.log('Running daily task')
 * }))
 * ```
 */
export function every(handler: (context?: ServiceContext) => void | Promise<void>) {
  return handler
}

/**
 * Get entitlements (helper for creating entitlements endpoints)
 *
 * @example
 * ```ts
 * const entitlementsEndpoint = Endpoint({
 *   name: 'entitlements',
 *   handler: entitlements(async (context) => {
 *     return context?.entitlements || []
 *   }),
 * })
 * ```
 */
export function entitlements(handler: (context?: ServiceContext) => Promise<string[]>) {
  return async (_input: unknown, context?: ServiceContext): Promise<string[]> => {
    return handler(context)
  }
}

/**
 * Get KPIs (helper for creating KPI endpoints)
 *
 * @example
 * ```ts
 * const kpisEndpoint = Endpoint({
 *   name: 'kpis',
 *   handler: kpis(async () => {
 *     return {
 *       'revenue': 10000,
 *       'customers': 150,
 *       'satisfaction': 4.5,
 *     }
 *   }),
 * })
 * ```
 */
export function kpis(
  handler: (context?: ServiceContext) => Promise<Record<string, number | string>>
) {
  return async (
    _input: unknown,
    context?: ServiceContext
  ): Promise<Record<string, number | string>> => {
    return handler(context)
  }
}

/**
 * Get OKRs (helper for creating OKR endpoints)
 *
 * @example
 * ```ts
 * const okrsEndpoint = Endpoint({
 *   name: 'okrs',
 *   handler: okrs(async () => {
 *     return [{
 *       id: 'okr-1',
 *       objective: 'Improve customer satisfaction',
 *       keyResults: [
 *         {
 *           description: 'Increase NPS score',
 *           measure: async () => 8.5,
 *           target: 9.0,
 *           unit: 'score',
 *         },
 *       ],
 *     }]
 *   }),
 * })
 * ```
 */
export function okrs(handler: (context?: ServiceContext) => Promise<OKRDefinition[]>) {
  return async (_input: unknown, context?: ServiceContext): Promise<OKRDefinition[]> => {
    return handler(context)
  }
}

/**
 * Create a subscription plan
 *
 * @example
 * ```ts
 * const plan = Plan({
 *   id: 'pro',
 *   name: 'Pro Plan',
 *   description: 'For professional users',
 *   pricing: {
 *     model: 'subscription',
 *     basePrice: 49.99,
 *     currency: 'USD',
 *     interval: 'monthly',
 *   },
 *   entitlements: ['api-access', 'advanced-features'],
 *   features: ['Unlimited API calls', '24/7 support', 'Custom integrations'],
 *   limits: {
 *     'api-calls': 100000,
 *     'storage': 1000000000, // 1GB in bytes
 *   },
 * })
 * ```
 */
export function Plan(plan: SubscriptionPlan): SubscriptionPlan {
  return plan
}

/**
 * Create a KPI definition
 *
 * @example
 * ```ts
 * const kpi = KPI({
 *   id: 'monthly-revenue',
 *   name: 'Monthly Revenue',
 *   description: 'Total revenue for the current month',
 *   calculate: async () => {
 *     return await getMonthlyRevenue()
 *   },
 *   target: 100000,
 *   unit: 'USD',
 * })
 * ```
 */
export function KPI(kpi: KPIDefinition): KPIDefinition {
  return kpi
}

/**
 * Create an OKR definition
 *
 * @example
 * ```ts
 * const okr = OKR({
 *   id: 'q1-2024',
 *   objective: 'Grow user base by 50%',
 *   keyResults: [
 *     {
 *       description: 'Acquire 5000 new users',
 *       measure: async () => await getNewUserCount(),
 *       target: 5000,
 *       unit: 'users',
 *     },
 *   ],
 *   period: 'Q1 2024',
 *   owner: 'Growth Team',
 * })
 * ```
 */
export function OKR(okr: OKRDefinition): OKRDefinition {
  return okr
}

/**
 * Create an entitlement definition
 *
 * @example
 * ```ts
 * const entitlement = Entitlement({
 *   id: 'api-access',
 *   name: 'API Access',
 *   description: 'Access to the service API',
 *   resource: 'api',
 *   actions: ['read', 'write'],
 * })
 * ```
 */
export function Entitlement(entitlement: EntitlementDefinition): EntitlementDefinition {
  return entitlement
}
