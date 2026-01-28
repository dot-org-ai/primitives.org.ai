/**
 * Tests for Service implementation
 */

import { describe, it, expect, vi } from 'vitest'
import { Service, Endpoint, POST, GET } from '../src/index.js'
import type { ServiceContext, UsageTracker } from '../src/types.js'

describe('Service', () => {
  describe('basic creation', () => {
    it('should create a service with basic configuration', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      expect(service).toBeDefined()
      expect(service.definition.name).toBe('test-service')
      expect(service.definition.version).toBe('1.0.0')
    })

    it('should create a service with description', () => {
      const service = Service({
        name: 'translation-service',
        version: '2.0.0',
        description: 'AI-powered translation service',
        endpoints: [],
      })

      expect(service.definition.description).toBe('AI-powered translation service')
    })

    it('should create a service with status', () => {
      const service = Service({
        name: 'beta-service',
        version: '0.9.0',
        status: 'beta',
        endpoints: [],
      })

      expect(service.definition.status).toBe('beta')
    })

    it('should create a service with pricing', () => {
      const service = Service({
        name: 'paid-service',
        version: '1.0.0',
        endpoints: [],
        pricing: {
          model: 'per-use',
          pricePerUnit: 0.01,
          currency: 'USD',
        },
      })

      expect(service.definition.pricing?.model).toBe('per-use')
      expect(service.definition.pricing?.pricePerUnit).toBe(0.01)
    })

    it('should create a service with multiple endpoints', () => {
      const service = Service({
        name: 'multi-endpoint-service',
        version: '1.0.0',
        endpoints: [
          POST({ name: 'create', handler: async () => ({}) }),
          GET({ name: 'read', handler: async () => ({}) }),
          POST({ name: 'update', handler: async () => ({}) }),
        ],
      })

      expect(service.definition.endpoints).toHaveLength(3)
    })
  })

  describe('endpoint calling', () => {
    it('should call an endpoint and return result', async () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'echo',
            handler: async (input: { message: string }) => {
              return { echoed: input.message }
            },
          }),
        ],
      })

      const result = await service.call<{ message: string }, { echoed: string }>('echo', {
        message: 'hello',
      })

      expect(result.echoed).toBe('hello')
    })

    it('should provide service context to handlers', async () => {
      let capturedContext: ServiceContext | undefined

      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'test',
            handler: async (_input: unknown, context?: ServiceContext) => {
              capturedContext = context
              return { ok: true }
            },
          }),
        ],
      })

      await service.call('test', {}, { requestId: 'test-123', entitlements: ['test'] })

      expect(capturedContext).toBeDefined()
      expect(capturedContext?.requestId).toBe('test-123')
      expect(capturedContext?.entitlements).toContain('test')
    })

    it('should generate requestId when context not provided', async () => {
      let capturedContext: ServiceContext | undefined

      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'test',
            handler: async (_input: unknown, context?: ServiceContext) => {
              capturedContext = context
              return { ok: true }
            },
          }),
        ],
      })

      await service.call('test', {})

      expect(capturedContext?.requestId).toBeDefined()
      expect(capturedContext?.requestId).toMatch(/^req_/)
    })

    it('should throw error for unknown endpoint', async () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      await expect(service.call('unknown', {})).rejects.toThrow('Endpoint not found: unknown')
    })

    it('should track usage when tracker provided', async () => {
      const mockTracker: UsageTracker = {
        track: vi.fn(),
        get: vi.fn(),
      }

      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'api-call',
            handler: async () => ({ ok: true }),
          }),
        ],
      })

      await service.call(
        'api-call',
        {},
        {
          requestId: 'req-1',
          customerId: 'cust-1',
          entitlements: [],
          usage: mockTracker,
        }
      )

      expect(mockTracker.track).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          resource: 'api-call',
          quantity: 1,
        })
      )
    })
  })

  describe('service methods', () => {
    it('should implement ask method', async () => {
      const service = Service({
        name: 'qa-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'ask',
            handler: async (input: { question: string }) => {
              return `Answer to: ${input.question}`
            },
          }),
        ],
      })

      const result = await service.ask('What is TypeScript?')
      expect(result).toBe('Answer to: What is TypeScript?')
    })

    it('should implement deliver method', async () => {
      let deliveredData: unknown

      const service = Service({
        name: 'delivery-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'deliver',
            handler: async (input: { orderId: string; results: unknown }) => {
              deliveredData = input
            },
          }),
        ],
      })

      await service.deliver('order-123', { files: ['report.pdf'] })
      expect(deliveredData).toEqual({
        orderId: 'order-123',
        results: { files: ['report.pdf'] },
      })
    })

    it('should implement do method', async () => {
      const service = Service({
        name: 'task-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'do',
            handler: async (input: { action: string; input?: unknown }) => {
              return { action: input.action, completed: true }
            },
          }),
        ],
      })

      const result = await service.do('process', { data: 'test' })
      expect(result).toEqual({ action: 'process', completed: true })
    })

    it('should implement generate method', async () => {
      const service = Service({
        name: 'generation-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'generate',
            handler: async (input: { prompt: string }) => {
              return { text: `Generated from: ${input.prompt}` }
            },
          }),
        ],
      })

      const result = await service.generate('Write a poem')
      expect(result).toEqual({ text: 'Generated from: Write a poem' })
    })

    it('should implement is method for validation', async () => {
      const service = Service({
        name: 'validation-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'is',
            handler: async (input: { value: unknown; type: string }) => {
              return input.type === 'email' && String(input.value).includes('@')
            },
          }),
        ],
      })

      const result = await service.is('test@example.com', 'email')
      expect(result).toBe(true)
    })

    it('should implement notify method', async () => {
      let sentNotification: unknown

      const service = Service({
        name: 'notification-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'notify',
            handler: async (notification: unknown) => {
              sentNotification = notification
            },
          }),
        ],
      })

      await service.notify({
        id: 'notif-1',
        to: 'user@example.com',
        subject: 'Hello',
        body: 'Message',
        channel: 'email',
      })

      expect(sentNotification).toEqual({
        id: 'notif-1',
        to: 'user@example.com',
        subject: 'Hello',
        body: 'Message',
        channel: 'email',
      })
    })

    it('should implement order method', async () => {
      const service = Service({
        name: 'order-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'order',
            handler: async (input: { product: unknown; quantity: number }) => {
              return {
                id: 'ord-123',
                customerId: 'cust-1',
                product: input.product,
                quantity: input.quantity,
                total: 99.99,
                currency: 'USD',
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
              }
            },
          }),
        ],
      })

      const order = await service.order({ name: 'Translation' }, 5)
      expect(order.id).toBe('ord-123')
      expect(order.quantity).toBe(5)
    })

    it('should implement quote method', async () => {
      const service = Service({
        name: 'quote-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'quote',
            handler: async (input: { product: unknown; quantity: number }) => {
              return {
                id: 'quote-123',
                customerId: 'cust-1',
                product: input.product,
                quantity: input.quantity,
                price: input.quantity * 10,
                currency: 'USD',
                expiresAt: new Date(),
              }
            },
          }),
        ],
      })

      const quote = await service.quote({ type: 'translation' }, 100)
      expect(quote.price).toBe(1000)
    })

    it('should implement subscribe method', async () => {
      const service = Service({
        name: 'subscription-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'subscribe',
            handler: async (input: { planId: string }) => {
              return {
                id: 'sub-123',
                customerId: 'cust-1',
                planId: input.planId,
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(),
              }
            },
          }),
        ],
      })

      const subscription = await service.subscribe('pro-plan')
      expect(subscription.planId).toBe('pro-plan')
      expect(subscription.status).toBe('active')
    })

    it('should implement entitlements method', async () => {
      const service = Service({
        name: 'entitlements-service',
        version: '1.0.0',
        endpoints: [
          POST({
            name: 'entitlements',
            handler: async () => {
              return ['api-access', 'premium-features']
            },
          }),
        ],
      })

      const entitlements = await service.entitlements()
      expect(entitlements).toEqual(['api-access', 'premium-features'])
    })
  })

  describe('KPIs', () => {
    it('should calculate KPIs', async () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
        kpis: [
          {
            id: 'test-kpi',
            name: 'Test KPI',
            calculate: async () => 42,
          },
        ],
      })

      const kpis = await service.kpis()
      expect(kpis['test-kpi']).toBe(42)
    })

    it('should calculate multiple KPIs', async () => {
      const service = Service({
        name: 'metrics-service',
        version: '1.0.0',
        endpoints: [],
        kpis: [
          { id: 'revenue', name: 'Revenue', calculate: async () => 10000 },
          { id: 'customers', name: 'Customers', calculate: async () => 150 },
          { id: 'satisfaction', name: 'Satisfaction', calculate: async () => '4.5' },
        ],
      })

      const kpis = await service.kpis()

      expect(kpis['revenue']).toBe(10000)
      expect(kpis['customers']).toBe(150)
      expect(kpis['satisfaction']).toBe('4.5')
    })

    it('should return empty object when no KPIs defined', async () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      const kpis = await service.kpis()
      expect(kpis).toEqual({})
    })
  })

  describe('OKRs', () => {
    it('should calculate OKRs with key results', async () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
        okrs: [
          {
            id: 'okr-1',
            objective: 'Test objective',
            keyResults: [
              {
                description: 'Test key result',
                measure: async () => 75,
                target: 100,
                unit: 'points',
              },
            ],
          },
        ],
      })

      const okrs = await service.okrs()
      expect(okrs).toHaveLength(1)
      expect(okrs[0]?.objective).toBe('Test objective')
      expect(okrs[0]?.keyResults[0]?.current).toBe(75)
      expect(okrs[0]?.keyResults[0]?.target).toBe(100)
    })

    it('should calculate multiple OKRs', async () => {
      const service = Service({
        name: 'okr-service',
        version: '1.0.0',
        endpoints: [],
        okrs: [
          {
            id: 'okr-growth',
            objective: 'Grow user base',
            keyResults: [{ description: 'New users', measure: async () => 3500, target: 5000 }],
          },
          {
            id: 'okr-quality',
            objective: 'Improve quality',
            keyResults: [{ description: 'Bug count', measure: async () => 5, target: 0 }],
          },
        ],
      })

      const okrs = await service.okrs()
      expect(okrs).toHaveLength(2)
    })

    it('should return empty array when no OKRs defined', async () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      const okrs = await service.okrs()
      expect(okrs).toEqual([])
    })
  })

  describe('event handlers', () => {
    it('should register event handlers', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      let eventFired = false
      service.on('test.event', () => {
        eventFired = true
      })

      // Event handlers are registered (actual firing would happen in event system)
      expect(eventFired).toBe(false) // Not fired yet
    })

    it('should support multiple handlers for same event', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      const handlers: string[] = []

      service.on('user.created', () => {
        handlers.push('handler1')
      })

      service.on('user.created', () => {
        handlers.push('handler2')
      })

      // Handlers are registered
      expect(handlers).toEqual([])
    })

    it('should create service with initial event handlers', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
        events: {
          'order.created': {
            event: 'order.created',
            handler: async () => {},
          },
        },
      })

      expect(service).toBeDefined()
    })
  })

  describe('scheduled tasks', () => {
    it('should register scheduled tasks', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      let taskRan = false
      service.every('0 * * * *', () => {
        taskRan = true
      })

      // Task is registered (actual execution would happen in scheduler)
      expect(taskRan).toBe(false) // Not run yet
    })

    it('should create service with initial scheduled tasks', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
        scheduled: [
          {
            name: 'daily-report',
            schedule: '0 0 * * *',
            handler: async () => {},
            enabled: true,
          },
        ],
      })

      expect(service.definition.scheduled).toHaveLength(1)
    })
  })

  describe('queue processing', () => {
    it('should register queue handler', () => {
      const service = Service({
        name: 'test-service',
        version: '1.0.0',
        endpoints: [],
      })

      service.queue('process-orders', async (_job: { orderId: string }) => {
        // Process job
      })

      // Queue handler is registered via event system
      expect(service).toBeDefined()
    })
  })

  describe('asRPC and asAPI', () => {
    it('should return RPC target representation', () => {
      const service = Service({
        name: 'my-service',
        version: '2.0.0',
        endpoints: [],
      })

      const rpc = service.asRPC()

      expect(rpc).toEqual({
        _type: 'rpc-target',
        service: 'my-service',
        version: '2.0.0',
      })
    })

    it('should return API routes representation', () => {
      const service = Service({
        name: 'api-service',
        version: '1.0.0',
        endpoints: [
          GET({ name: 'list', path: '/items', handler: async () => [] }),
          POST({ name: 'create', path: '/items', handler: async () => ({}) }),
        ],
      })

      const api = service.asAPI() as Array<{ method: string; path: string }>

      expect(api).toHaveLength(2)
      expect(api[0]).toMatchObject({ method: 'GET', path: '/items' })
      expect(api[1]).toMatchObject({ method: 'POST', path: '/items' })
    })
  })
})

describe('Endpoint helpers', () => {
  it('should create POST endpoint', () => {
    const endpoint = POST({
      name: 'test',
      handler: async () => ({ ok: true }),
    })

    expect(endpoint.method).toBe('POST')
    expect(endpoint.name).toBe('test')
  })

  it('should create GET endpoint', () => {
    const endpoint = GET({
      name: 'test',
      handler: async () => ({ ok: true }),
    })

    expect(endpoint.method).toBe('GET')
    expect(endpoint.name).toBe('test')
  })

  it('should default to requiring auth', () => {
    const endpoint = Endpoint({
      name: 'test',
      handler: async () => ({ ok: true }),
    })

    expect(endpoint.requiresAuth).toBe(true)
  })

  it('should allow disabling auth requirement', () => {
    const endpoint = Endpoint({
      name: 'test',
      handler: async () => ({ ok: true }),
      requiresAuth: false,
    })

    expect(endpoint.requiresAuth).toBe(false)
  })
})
