/**
 * Tests for helper functions
 */

import { describe, it, expect } from 'vitest'
import {
  ask,
  deliver,
  do_ as doHelper,
  generate,
  is,
  notify,
  on,
  order,
  queue,
  quote,
  subscribe,
  every,
  entitlements,
  kpis,
  okrs,
  Plan,
  KPI,
  OKR,
  Entitlement,
} from '../src/helpers.js'
import type { ServiceContext } from '../src/types.js'

describe('ask helper', () => {
  it('should create handler that receives question and context', async () => {
    let capturedQuestion: string = ''
    let capturedContext: unknown

    const handler = ask(async (question, context) => {
      capturedQuestion = question
      capturedContext = context
      return `Answer to: ${question}`
    })

    const result = await handler(
      { question: 'What is TypeScript?', context: { topic: 'programming' } },
      undefined
    )

    expect(capturedQuestion).toBe('What is TypeScript?')
    expect(capturedContext).toEqual({ topic: 'programming' })
    expect(result).toBe('Answer to: What is TypeScript?')
  })

  it('should pass service context to handler', async () => {
    let capturedServiceContext: ServiceContext | undefined

    const handler = ask(async (_question, _context, serviceContext) => {
      capturedServiceContext = serviceContext
      return 'answer'
    })

    const serviceCtx: ServiceContext = {
      requestId: 'req-123',
      entitlements: ['premium'],
    }

    await handler({ question: 'test' }, serviceCtx)

    expect(capturedServiceContext?.requestId).toBe('req-123')
  })
})

describe('deliver helper', () => {
  it('should create handler that receives orderId and results', async () => {
    let capturedOrderId: string = ''
    let capturedResults: unknown

    const handler = deliver(async (orderId, results) => {
      capturedOrderId = orderId
      capturedResults = results
    })

    await handler({ orderId: 'order-123', results: { files: ['file1.pdf'] } })

    expect(capturedOrderId).toBe('order-123')
    expect(capturedResults).toEqual({ files: ['file1.pdf'] })
  })

  it('should pass context to handler', async () => {
    let capturedContext: ServiceContext | undefined

    const handler = deliver(async (_orderId, _results, context) => {
      capturedContext = context
    })

    const ctx: ServiceContext = { requestId: 'req-1', entitlements: [] }
    await handler({ orderId: 'o1', results: {} }, ctx)

    expect(capturedContext).toEqual(ctx)
  })
})

describe('do helper', () => {
  it('should create handler that receives action and input', async () => {
    let capturedAction: string = ''
    let capturedInput: unknown

    const handler = doHelper(async (action, input) => {
      capturedAction = action
      capturedInput = input
      return { status: 'completed' }
    })

    const result = await handler({ action: 'process', input: { data: 'test' } })

    expect(capturedAction).toBe('process')
    expect(capturedInput).toEqual({ data: 'test' })
    expect(result).toEqual({ status: 'completed' })
  })

  it('should handle action without input', async () => {
    const handler = doHelper(async (action) => {
      return { action, completed: true }
    })

    const result = await handler({ action: 'ping' })
    expect(result).toEqual({ action: 'ping', completed: true })
  })
})

describe('generate helper', () => {
  it('should create handler that receives prompt and options', async () => {
    let capturedPrompt: string = ''
    let capturedOptions: unknown

    const handler = generate(async (prompt, options) => {
      capturedPrompt = prompt
      capturedOptions = options
      return { text: `Generated from: ${prompt}` }
    })

    const result = await handler({
      prompt: 'Write a haiku',
      options: { temperature: 0.7 },
    })

    expect(capturedPrompt).toBe('Write a haiku')
    expect(capturedOptions).toEqual({ temperature: 0.7 })
    expect(result).toEqual({ text: 'Generated from: Write a haiku' })
  })
})

describe('is helper', () => {
  it('should create handler that validates value against type', async () => {
    const handler = is(async (value, type) => {
      if (type === 'email') {
        return typeof value === 'string' && value.includes('@')
      }
      return false
    })

    const validResult = await handler({ value: 'test@example.com', type: 'email' })
    const invalidResult = await handler({ value: 'not-an-email', type: 'email' })

    expect(validResult).toBe(true)
    expect(invalidResult).toBe(false)
  })

  it('should handle JSON schema type', async () => {
    const handler = is(async (value, type) => {
      if (typeof type === 'object' && type.type === 'object') {
        return typeof value === 'object' && value !== null
      }
      return false
    })

    const result = await handler({
      value: { name: 'John' },
      type: { type: 'object', properties: { name: { type: 'string' } } },
    })

    expect(result).toBe(true)
  })
})

describe('notify helper', () => {
  it('should create handler that receives notification', async () => {
    let capturedNotification: unknown

    const handler = notify(async (notification) => {
      capturedNotification = notification
    })

    await handler({
      id: 'notif-1',
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Message',
      channel: 'email',
    })

    expect(capturedNotification).toEqual({
      id: 'notif-1',
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Message',
      channel: 'email',
    })
  })
})

describe('on helper', () => {
  it('should return the handler function unchanged', () => {
    const myHandler = async (payload: { id: string }) => {
      console.log(payload.id)
    }

    const result = on(myHandler)
    expect(result).toBe(myHandler)
  })

  it('should work with sync handlers', () => {
    const syncHandler = (payload: unknown) => {
      return payload
    }

    const result = on(syncHandler)
    expect(result).toBe(syncHandler)
  })
})

describe('order helper', () => {
  it('should create handler that receives product and quantity', async () => {
    let capturedProduct: unknown
    let capturedQuantity: number = 0

    const handler = order(async (product, quantity) => {
      capturedProduct = product
      capturedQuantity = quantity
      return {
        id: 'ord-123',
        customerId: 'cust-1',
        product,
        quantity,
        total: 99.99,
        currency: 'USD' as const,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    const result = await handler({
      product: { name: 'Translation Service' },
      quantity: 5,
    })

    expect(capturedProduct).toEqual({ name: 'Translation Service' })
    expect(capturedQuantity).toBe(5)
    expect(result.id).toBe('ord-123')
    expect(result.status).toBe('pending')
  })
})

describe('queue helper', () => {
  it('should return the handler function unchanged', () => {
    const queueHandler = async (job: { taskId: string }) => {
      return job.taskId
    }

    const result = queue(queueHandler)
    expect(result).toBe(queueHandler)
  })
})

describe('quote helper', () => {
  it('should create handler that receives product and quantity', async () => {
    const handler = quote(async (product, quantity) => {
      const unitPrice = 10
      return {
        id: 'quote-123',
        customerId: 'cust-1',
        product,
        quantity,
        price: quantity * unitPrice,
        currency: 'USD' as const,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    })

    const result = await handler({
      product: { type: 'translation', words: 1000 },
      quantity: 100,
    })

    expect(result.id).toBe('quote-123')
    expect(result.price).toBe(1000)
    expect(result.quantity).toBe(100)
  })
})

describe('subscribe helper', () => {
  it('should create handler that receives planId', async () => {
    let capturedPlanId: string = ''

    const handler = subscribe(async (planId) => {
      capturedPlanId = planId
      return {
        id: 'sub-123',
        customerId: 'cust-1',
        planId,
        status: 'active' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    })

    const result = await handler({ planId: 'pro-plan' })

    expect(capturedPlanId).toBe('pro-plan')
    expect(result.planId).toBe('pro-plan')
    expect(result.status).toBe('active')
  })
})

describe('every helper', () => {
  it('should return the handler function unchanged', () => {
    const scheduleHandler = async () => {
      console.log('Running scheduled task')
    }

    const result = every(scheduleHandler)
    expect(result).toBe(scheduleHandler)
  })
})

describe('entitlements helper', () => {
  it('should create handler that returns entitlements array', async () => {
    const handler = entitlements(async (context) => {
      return context?.entitlements || ['basic']
    })

    const result = await handler({}, { requestId: 'r1', entitlements: ['premium', 'api-access'] })

    expect(result).toEqual(['premium', 'api-access'])
  })

  it('should return default entitlements when no context', async () => {
    const handler = entitlements(async () => {
      return ['free-tier']
    })

    const result = await handler({})
    expect(result).toEqual(['free-tier'])
  })
})

describe('kpis helper', () => {
  it('should create handler that returns KPI values', async () => {
    const handler = kpis(async () => {
      return {
        revenue: 10000,
        customers: 150,
        satisfaction: '4.5',
      }
    })

    const result = await handler({})

    expect(result.revenue).toBe(10000)
    expect(result.customers).toBe(150)
    expect(result.satisfaction).toBe('4.5')
  })
})

describe('okrs helper', () => {
  it('should create handler that returns OKR definitions', async () => {
    const handler = okrs(async () => {
      return [
        {
          id: 'okr-1',
          objective: 'Improve customer satisfaction',
          keyResults: [
            {
              description: 'Increase NPS score',
              measure: async () => 8.5,
              target: 9.0,
              unit: 'score',
            },
          ],
        },
      ]
    })

    const result = await handler({})

    expect(result).toHaveLength(1)
    expect(result[0]?.objective).toBe('Improve customer satisfaction')
    expect(result[0]?.keyResults).toHaveLength(1)
  })
})

describe('Plan factory', () => {
  it('should create a subscription plan', () => {
    const plan = Plan({
      id: 'pro',
      name: 'Pro Plan',
      description: 'For professional users',
      pricing: {
        model: 'subscription',
        basePrice: 49.99,
        currency: 'USD',
        interval: 'monthly',
      },
      entitlements: ['api-access', 'advanced-features'],
      features: ['Unlimited API calls', '24/7 support'],
      limits: {
        'api-calls': 100000,
      },
    })

    expect(plan.id).toBe('pro')
    expect(plan.name).toBe('Pro Plan')
    expect(plan.pricing.model).toBe('subscription')
    expect(plan.entitlements).toContain('api-access')
    expect(plan.features).toContain('24/7 support')
  })

  it('should support trial days', () => {
    const plan = Plan({
      id: 'trial',
      name: 'Trial Plan',
      pricing: {
        model: 'subscription',
        basePrice: 0,
        currency: 'USD',
      },
      entitlements: ['basic'],
      features: ['Limited access'],
      trialDays: 14,
    })

    expect(plan.trialDays).toBe(14)
  })
})

describe('KPI factory', () => {
  it('should create a KPI definition', () => {
    const kpi = KPI({
      id: 'monthly-revenue',
      name: 'Monthly Revenue',
      description: 'Total revenue for the current month',
      calculate: async () => 50000,
      target: 100000,
      unit: 'USD',
    })

    expect(kpi.id).toBe('monthly-revenue')
    expect(kpi.name).toBe('Monthly Revenue')
    expect(kpi.target).toBe(100000)
    expect(kpi.unit).toBe('USD')
  })

  it('should have callable calculate function', async () => {
    const kpi = KPI({
      id: 'customer-count',
      name: 'Customer Count',
      calculate: async () => 150,
    })

    const result = await kpi.calculate()
    expect(result).toBe(150)
  })
})

describe('OKR factory', () => {
  it('should create an OKR definition', () => {
    const okr = OKR({
      id: 'q1-2024',
      objective: 'Grow user base by 50%',
      keyResults: [
        {
          description: 'Acquire 5000 new users',
          measure: async () => 3500,
          target: 5000,
          unit: 'users',
        },
        {
          description: 'Reduce churn to 5%',
          measure: async () => 6,
          target: 5,
          unit: 'percent',
        },
      ],
      period: 'Q1 2024',
      owner: 'Growth Team',
    })

    expect(okr.id).toBe('q1-2024')
    expect(okr.objective).toBe('Grow user base by 50%')
    expect(okr.keyResults).toHaveLength(2)
    expect(okr.period).toBe('Q1 2024')
    expect(okr.owner).toBe('Growth Team')
  })

  it('should have callable measure functions', async () => {
    const okr = OKR({
      id: 'test',
      objective: 'Test objective',
      keyResults: [
        {
          description: 'Test KR',
          measure: async () => 75,
          target: 100,
        },
      ],
    })

    const value = await okr.keyResults[0]?.measure()
    expect(value).toBe(75)
  })
})

describe('Entitlement factory', () => {
  it('should create an entitlement definition', () => {
    const entitlement = Entitlement({
      id: 'api-access',
      name: 'API Access',
      description: 'Access to the service API',
      resource: 'api',
      actions: ['read', 'write'],
    })

    expect(entitlement.id).toBe('api-access')
    expect(entitlement.name).toBe('API Access')
    expect(entitlement.resource).toBe('api')
    expect(entitlement.actions).toEqual(['read', 'write'])
  })

  it('should work with minimal fields', () => {
    const entitlement = Entitlement({
      id: 'basic',
      name: 'Basic Access',
    })

    expect(entitlement.id).toBe('basic')
    expect(entitlement.name).toBe('Basic Access')
    expect(entitlement.resource).toBeUndefined()
    expect(entitlement.actions).toBeUndefined()
  })
})
