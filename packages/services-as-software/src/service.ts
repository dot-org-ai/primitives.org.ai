/**
 * Service implementation
 */

import type {
  ServiceDefinition,
  Service,
  ServiceContext,
  EndpointDefinition,
  EventHandler,
  ScheduledTask,
  Order,
  Quote,
  Subscription,
  Notification,
  OKRDefinition,
  JSONSchema,
} from './types.js'

/**
 * Create a service from a definition
 *
 * @example
 * ```ts
 * const service = Service({
 *   name: 'translation-service',
 *   version: '1.0.0',
 *   description: 'AI-powered translation service',
 *   pricing: {
 *     model: 'per-use',
 *     pricePerUnit: 0.01,
 *     currency: 'USD',
 *   },
 *   endpoints: [
 *     Endpoint({
 *       name: 'translate',
 *       method: 'POST',
 *       path: '/translate',
 *       input: {
 *         type: 'object',
 *         properties: {
 *           text: { type: 'string' },
 *           from: { type: 'string' },
 *           to: { type: 'string' },
 *         },
 *         required: ['text', 'to'],
 *       },
 *       handler: async (input) => {
 *         // Translation logic here
 *         return { translatedText: input.text }
 *       },
 *     }),
 *   ],
 * })
 * ```
 */
export function Service(definition: ServiceDefinition): Service {
  // Store endpoints by name for quick lookup
  const endpointMap = new Map<string, EndpointDefinition>()
  for (const endpoint of definition.endpoints) {
    endpointMap.set(endpoint.name, endpoint)
  }

  // Store event handlers
  const eventHandlers = new Map<string, EventHandler[]>()
  if (definition.events) {
    for (const [event, handler] of Object.entries(definition.events)) {
      eventHandlers.set(event, [handler])
    }
  }

  // Store scheduled tasks
  const scheduledTasks = new Map<string, ScheduledTask>()
  if (definition.scheduled) {
    for (const task of definition.scheduled) {
      scheduledTasks.set(task.name, task)
    }
  }

  // Create the service instance
  const service: Service = {
    definition,

    // Call an endpoint
    async call<TInput, TOutput>(
      endpoint: string,
      input: TInput,
      context?: ServiceContext
    ): Promise<TOutput> {
      const ep = endpointMap.get(endpoint)
      if (!ep) {
        throw new Error(`Endpoint not found: ${endpoint}`)
      }

      // Create context if not provided
      const ctx: ServiceContext = context || {
        requestId: generateRequestId(),
        entitlements: [],
      }

      // Track usage if tracker is available
      if (ctx.usage && ctx.customerId) {
        await ctx.usage.track({
          customerId: ctx.customerId,
          resource: endpoint,
          quantity: 1,
          timestamp: new Date(),
        })
      }

      // Call the handler
      return ep.handler(input, ctx) as Promise<TOutput>
    },

    // Ask a question
    async ask(question: string, context?: unknown): Promise<string> {
      return service.call('ask', { question, context })
    },

    // Deliver results
    async deliver(orderId: string, results: unknown): Promise<void> {
      return service.call('deliver', { orderId, results })
    },

    // Execute a task
    async do(action: string, input?: unknown): Promise<unknown> {
      return service.call('do', { action, input })
    },

    // Generate content
    async generate(prompt: string, options?: unknown): Promise<unknown> {
      return service.call('generate', { prompt, options })
    },

    // Type checking/validation
    async is(value: unknown, type: string | JSONSchema): Promise<boolean> {
      return service.call('is', { value, type })
    },

    // Send notification
    async notify(notification: Notification): Promise<void> {
      return service.call('notify', notification)
    },

    // Place an order
    async order<TProduct>(product: TProduct, quantity: number): Promise<Order<TProduct>> {
      return service.call('order', { product, quantity })
    },

    // Request a quote
    async quote<TProduct>(product: TProduct, quantity: number): Promise<Quote<TProduct>> {
      return service.call('quote', { product, quantity })
    },

    // Subscribe to a plan
    async subscribe(planId: string): Promise<Subscription> {
      return service.call('subscribe', { planId })
    },

    // Get entitlements
    async entitlements(): Promise<string[]> {
      return service.call('entitlements', {})
    },

    // Get KPIs
    async kpis(): Promise<Record<string, number | string>> {
      const result: Record<string, number | string> = {}
      if (definition.kpis) {
        for (const kpi of definition.kpis) {
          result[kpi.id] = await kpi.calculate()
        }
      }
      return result
    },

    // Get OKRs
    async okrs(): Promise<OKRDefinition[]> {
      if (!definition.okrs) {
        return []
      }

      // Calculate current values for key results
      const okrs = await Promise.all(
        definition.okrs.map(async (okr) => {
          const keyResults = await Promise.all(
            okr.keyResults.map(async (kr) => ({
              ...kr,
              current: await kr.measure(),
            }))
          )
          return { ...okr, keyResults }
        })
      )

      return okrs
    },

    // Register event handler
    on<TPayload>(
      event: string,
      handler: (payload: TPayload, context?: ServiceContext) => void | Promise<void>
    ): void {
      const handlers = eventHandlers.get(event) || []
      handlers.push({
        event,
        handler: handler as (payload: unknown, context?: ServiceContext) => void | Promise<void>,
      })
      eventHandlers.set(event, handlers)
    },

    // Schedule recurring task
    every(
      schedule: string,
      handler: (context?: ServiceContext) => void | Promise<void>
    ): void {
      const taskName = `task-${scheduledTasks.size + 1}`
      scheduledTasks.set(taskName, {
        name: taskName,
        schedule,
        handler: (_input?: unknown, context?: ServiceContext) => handler(context),
        enabled: true,
      })
    },

    // Add queue processor
    queue<TJob>(
      name: string,
      handler: (job: TJob, context?: ServiceContext) => void | Promise<void>
    ): void {
      // Queue processing would typically integrate with a queue system
      // For now, we add it as an event handler
      service.on(`queue:${name}`, handler)
    },

    // Get service as RPC target
    asRPC(): unknown {
      // This would integrate with the RPC system from ai-functions
      // For now, return a placeholder
      return {
        _type: 'rpc-target',
        service: definition.name,
        version: definition.version,
      }
    },

    // Get service as API routes
    asAPI(): unknown {
      // This would generate HTTP/REST API routes
      // For now, return a placeholder with route definitions
      return definition.endpoints.map((ep) => ({
        method: ep.method || 'POST',
        path: ep.path || `/${ep.name}`,
        handler: ep.handler,
      }))
    },
  }

  return service
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}
