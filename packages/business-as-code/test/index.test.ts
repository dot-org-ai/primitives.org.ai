/**
 * Tests for business-as-code package
 */

import { describe, it, expect } from 'vitest'
import {
  Business,
  Vision,
  Goals,
  Product,
  Service,
  Process,
  Workflow,
  kpis,
  okrs,
  financials,
  $,
  calculateGrossMargin,
  calculateOverallProgress,
  updateProgress,
  calculateOKRProgress,
  updateKeyResult,
} from '../src/index.js'

describe('Business', () => {
  it('should create a business entity', () => {
    const business = Business({
      name: 'Test Corp',
      mission: 'Test mission',
      values: ['Value 1', 'Value 2'],
    })

    expect(business.name).toBe('Test Corp')
    expect(business.mission).toBe('Test mission')
    expect(business.values).toEqual(['Value 1', 'Value 2'])
  })

  it('should throw error if name is missing', () => {
    expect(() => Business({ name: '' })).toThrow('Business name is required')
  })
})

describe('Vision', () => {
  it('should create a vision statement', () => {
    const vision = Vision({
      statement: 'To be the best',
      timeframe: '5 years',
      successIndicators: ['Indicator 1', 'Indicator 2'],
    })

    expect(vision.statement).toBe('To be the best')
    expect(vision.timeframe).toBe('5 years')
    expect(vision.successIndicators).toHaveLength(2)
  })

  it('should throw error if statement is missing', () => {
    expect(() => Vision({ statement: '' })).toThrow('Vision statement is required')
  })
})

describe('Goals', () => {
  it('should create multiple goals', () => {
    const goals = Goals([
      {
        name: 'Goal 1',
        category: 'strategic',
        status: 'in-progress',
        progress: 50,
      },
      {
        name: 'Goal 2',
        category: 'operational',
        status: 'not-started',
        progress: 0,
      },
    ])

    expect(goals).toHaveLength(2)
    expect(goals[0]!.name).toBe('Goal 1')
    expect(goals[1]!.name).toBe('Goal 2')
  })

  it('should calculate overall progress', () => {
    const goals = Goals([
      { name: 'Goal 1', progress: 50 },
      { name: 'Goal 2', progress: 100 },
    ])

    const progress = calculateOverallProgress(goals)
    expect(progress).toBe(75)
  })

  it('should update goal progress', () => {
    const goal = { name: 'Test', progress: 0, status: 'not-started' as const }
    const updated = updateProgress(goal, 100)

    expect(updated.progress).toBe(100)
    expect(updated.status).toBe('completed')
  })
})

describe('Product', () => {
  it('should create a product', () => {
    const product = Product({
      name: 'Test Product',
      price: 100,
      cogs: 30,
    })

    expect(product.name).toBe('Test Product')
    expect(product.price).toBe(100)
    expect(product.cogs).toBe(30)
  })

  it('should calculate gross margin', () => {
    const product = Product({
      name: 'Test Product',
      price: 100,
      cogs: 30,
    })

    const margin = calculateGrossMargin(product)
    expect(margin).toBe(70)
  })
})

describe('Service', () => {
  it('should create a service', () => {
    const service = Service({
      name: 'Test Service',
      pricingModel: 'hourly',
      price: 100,
    })

    expect(service.name).toBe('Test Service')
    expect(service.pricingModel).toBe('hourly')
    expect(service.price).toBe(100)
  })
})

describe('Process', () => {
  it('should create a process', () => {
    const process = Process({
      name: 'Test Process',
      steps: [
        {
          order: 1,
          name: 'Step 1',
          automationLevel: 'automated',
        },
      ],
    })

    expect(process.name).toBe('Test Process')
    expect(process.steps).toHaveLength(1)
  })
})

describe('Workflow', () => {
  it('should create a workflow', () => {
    const workflow = Workflow({
      name: 'Test Workflow',
      trigger: { type: 'event', event: 'test.event' },
      actions: [
        {
          order: 1,
          type: 'send',
          description: 'Send notification',
        },
      ],
    })

    expect(workflow.name).toBe('Test Workflow')
    expect(workflow.trigger.type).toBe('event')
    expect(workflow.actions).toHaveLength(1)
  })

  it('should throw error if trigger is missing', () => {
    expect(() =>
      Workflow({
        name: 'Test',
        trigger: undefined as any,
      })
    ).toThrow('Workflow trigger is required')
  })
})

describe('KPIs', () => {
  it('should create KPIs', () => {
    const kpiList = kpis([
      {
        name: 'Revenue',
        target: 100000,
        current: 85000,
      },
      {
        name: 'Churn',
        target: 5,
        current: 3.2,
      },
    ])

    expect(kpiList).toHaveLength(2)
    expect(kpiList[0]!.name).toBe('Revenue')
  })
})

describe('OKRs', () => {
  it('should create OKRs', () => {
    const okrList = okrs([
      {
        objective: 'Test Objective',
        keyResults: [
          {
            description: 'KR 1',
            metric: 'test_metric',
            startValue: 0,
            targetValue: 100,
            currentValue: 50,
          },
        ],
      },
    ])

    expect(okrList).toHaveLength(1)
    expect(okrList[0]!.objective).toBe('Test Objective')
    expect(okrList[0]!.keyResults).toHaveLength(1)
  })

  it('should calculate OKR progress', () => {
    const okr = {
      objective: 'Test',
      keyResults: [
        {
          description: 'KR 1',
          metric: 'metric',
          startValue: 0,
          targetValue: 100,
          currentValue: 50,
        },
        {
          description: 'KR 2',
          metric: 'metric',
          startValue: 0,
          targetValue: 100,
          currentValue: 100,
        },
      ],
    }

    const progress = calculateOKRProgress(okr)
    expect(progress).toBe(75)
  })

  it('should update key result', () => {
    const okr = {
      objective: 'Test',
      keyResults: [
        {
          description: 'KR 1',
          metric: 'metric',
          startValue: 0,
          targetValue: 100,
          currentValue: 50,
        },
      ],
    }

    const updated = updateKeyResult(okr, 'KR 1', 75)
    expect(updated.keyResults![0]!.currentValue).toBe(75)
    expect(updated.keyResults![0]!.progress).toBe(75)
  })
})

describe('Financials', () => {
  it('should calculate financial metrics', () => {
    const metrics = financials({
      revenue: 1000000,
      cogs: 300000,
      operatingExpenses: 500000,
    })

    expect(metrics.revenue).toBe(1000000)
    expect(metrics.grossProfit).toBe(700000)
    expect(metrics.grossMargin).toBe(70)
    expect(metrics.operatingIncome).toBe(200000)
    expect(metrics.operatingMargin).toBe(20)
  })
})

describe('$ Helper', () => {
  it('should format currency', () => {
    const formatted = $.format(1234.56)
    expect(formatted).toMatch(/1,234\.56/)
  })

  it('should calculate percentage', () => {
    const percent = $.percent(25, 100)
    expect(percent).toBe(25)
  })

  it('should calculate growth', () => {
    const growth = $.growth(120, 100)
    expect(growth).toBe(20)
  })

  it('should calculate margin', () => {
    const margin = $.margin(100, 60)
    expect(margin).toBe(40)
  })

  it('should calculate ROI', () => {
    const roi = $.roi(150, 100)
    expect(roi).toBe(50)
  })

  it('should calculate LTV', () => {
    const ltv = $.ltv(100, 12, 2)
    expect(ltv).toBe(2400)
  })

  it('should calculate CAC', () => {
    const cac = $.cac(10000, 100)
    expect(cac).toBe(100)
  })

  it('should calculate burn rate', () => {
    const burnRate = $.burnRate(100000, 70000, 3)
    expect(burnRate).toBe(10000)
  })

  it('should calculate runway', () => {
    const runway = $.runway(100000, 10000)
    expect(runway).toBe(10)
  })
})
