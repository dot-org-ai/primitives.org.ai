/**
 * Tests for pricing module
 */

import { describe, it, expect } from 'vitest'
import {
  createHourlyPricing,
  createProjectPricing,
  createSubscriptionPricing,
  createPricingTier,
  calculatePrice,
  applyDiscount,
  validatePricing,
} from '../src/pricing/index.js'

describe('createHourlyPricing', () => {
  it('should create hourly pricing with required fields', () => {
    const pricing = createHourlyPricing({
      rate: 150,
      currency: 'USD',
    })

    expect(pricing.model).toBe('hourly')
    expect(pricing.rate).toBe(150)
    expect(pricing.currency).toBe('USD')
  })

  it('should create hourly pricing with minimum hours', () => {
    const pricing = createHourlyPricing({
      rate: 100,
      currency: 'USD',
      minimumHours: 2,
    })

    expect(pricing.minimumHours).toBe(2)
  })

  it('should create hourly pricing with billing increment', () => {
    const pricing = createHourlyPricing({
      rate: 100,
      currency: 'USD',
      billingIncrement: 15, // 15-minute increments
    })

    expect(pricing.billingIncrement).toBe(15)
  })

  it('should create hourly pricing with overtime', () => {
    const pricing = createHourlyPricing({
      rate: 100,
      currency: 'USD',
      overtimeRate: 150,
      overtimeThreshold: 8,
    })

    expect(pricing.overtimeRate).toBe(150)
    expect(pricing.overtimeThreshold).toBe(8)
  })
})

describe('createProjectPricing', () => {
  it('should create project pricing with required fields', () => {
    const pricing = createProjectPricing({
      basePrice: 5000,
      currency: 'USD',
    })

    expect(pricing.model).toBe('project')
    expect(pricing.basePrice).toBe(5000)
    expect(pricing.currency).toBe('USD')
  })

  it('should create project pricing with scope and deliverables', () => {
    const pricing = createProjectPricing({
      basePrice: 10000,
      currency: 'USD',
      scope: 'Website redesign',
      deliverables: ['Design mockups', 'HTML/CSS', 'CMS integration'],
    })

    expect(pricing.scope).toBe('Website redesign')
    expect(pricing.deliverables).toHaveLength(3)
  })

  it('should create project pricing with milestones', () => {
    const pricing = createProjectPricing({
      basePrice: 20000,
      currency: 'USD',
      milestones: [
        { name: 'Discovery', percentage: 25 },
        { name: 'Design', percentage: 25 },
        { name: 'Development', percentage: 40 },
        { name: 'Launch', percentage: 10 },
      ],
    })

    expect(pricing.milestones).toHaveLength(4)
    expect(pricing.milestones?.[0]?.percentage).toBe(25)
  })

  it('should create project pricing with revision policy', () => {
    const pricing = createProjectPricing({
      basePrice: 5000,
      currency: 'USD',
      includedRevisions: 3,
      revisionPrice: 500,
    })

    expect(pricing.includedRevisions).toBe(3)
    expect(pricing.revisionPrice).toBe(500)
  })

  it('should create project pricing with rush delivery', () => {
    const pricing = createProjectPricing({
      basePrice: 5000,
      currency: 'USD',
      rushMultiplier: 1.5,
      standardDeliveryDays: 14,
    })

    expect(pricing.rushMultiplier).toBe(1.5)
    expect(pricing.standardDeliveryDays).toBe(14)
  })
})

describe('createSubscriptionPricing', () => {
  it('should create subscription pricing with required fields', () => {
    const pricing = createSubscriptionPricing({
      monthlyPrice: 99,
      currency: 'USD',
    })

    expect(pricing.model).toBe('subscription')
    expect(pricing.monthlyPrice).toBe(99)
    expect(pricing.currency).toBe('USD')
    expect(pricing.billingInterval).toBe('monthly')
  })

  it('should create subscription pricing with features', () => {
    const pricing = createSubscriptionPricing({
      monthlyPrice: 49,
      currency: 'USD',
      features: ['Unlimited API calls', 'Priority support', 'Custom integrations'],
    })

    expect(pricing.features).toHaveLength(3)
    expect(pricing.features).toContain('Priority support')
  })

  it('should create subscription pricing with annual discount', () => {
    const pricing = createSubscriptionPricing({
      monthlyPrice: 100,
      currency: 'USD',
      annualDiscount: 20,
    })

    expect(pricing.annualDiscount).toBe(20)
    expect(pricing.calculateAnnualPrice()).toBe(960) // 100 * 12 * 0.8
  })

  it('should create subscription pricing with limits and overages', () => {
    const pricing = createSubscriptionPricing({
      monthlyPrice: 49,
      currency: 'USD',
      limits: {
        'api-calls': 10000,
        storage: '5GB',
      },
      overageRates: {
        'api-calls': 0.001,
      },
    })

    expect(pricing.limits?.['api-calls']).toBe(10000)
    expect(pricing.overageRates?.['api-calls']).toBe(0.001)
  })

  it('should create subscription pricing with trial', () => {
    const pricing = createSubscriptionPricing({
      monthlyPrice: 99,
      currency: 'USD',
      trialDays: 14,
      trialRequiresCard: false,
    })

    expect(pricing.trialDays).toBe(14)
    expect(pricing.trialRequiresCard).toBe(false)
  })

  it('should calculate annual price with different discount values', () => {
    const pricing1 = createSubscriptionPricing({
      monthlyPrice: 100,
      currency: 'USD',
      annualDiscount: 0,
    })

    const pricing2 = createSubscriptionPricing({
      monthlyPrice: 100,
      currency: 'USD',
      annualDiscount: 50,
    })

    expect(pricing1.calculateAnnualPrice()).toBe(1200)
    expect(pricing2.calculateAnnualPrice()).toBe(600)
  })
})

describe('createPricingTier', () => {
  it('should create a pricing tier', () => {
    const tier = createPricingTier({
      name: 'Pro',
      basePrice: 99,
      currency: 'USD',
      features: ['Feature 1', 'Feature 2'],
      isPopular: true,
    })

    expect(tier.name).toBe('Pro')
    expect(tier.basePrice).toBe(99)
    expect(tier.isPopular).toBe(true)
  })

  it('should work with minimal fields', () => {
    const tier = createPricingTier({
      name: 'Basic',
      basePrice: 0,
      currency: 'USD',
    })

    expect(tier.name).toBe('Basic')
    expect(tier.isPopular).toBeUndefined()
  })
})

describe('calculatePrice', () => {
  describe('hourly pricing', () => {
    it('should calculate simple hourly rate', () => {
      const pricing = createHourlyPricing({
        rate: 100,
        currency: 'USD',
      })

      const result = calculatePrice(pricing, { hours: 5 })

      expect(result.amount).toBe(500)
      expect(result.currency).toBe('USD')
    })

    it('should apply minimum hours', () => {
      const pricing = createHourlyPricing({
        rate: 100,
        currency: 'USD',
        minimumHours: 4,
      })

      const result = calculatePrice(pricing, { hours: 2 })

      expect(result.amount).toBe(400)
    })

    it('should round up to billing increment', () => {
      const pricing = createHourlyPricing({
        rate: 60,
        currency: 'USD',
        billingIncrement: 30, // 30-minute increments
      })

      const result = calculatePrice(pricing, { hours: 1.25 }) // 1 hour 15 minutes

      // Should round to 1.5 hours
      expect(result.amount).toBe(90)
    })

    it('should apply overtime rate', () => {
      const pricing = createHourlyPricing({
        rate: 100,
        currency: 'USD',
        overtimeRate: 150,
        overtimeThreshold: 8,
      })

      const result = calculatePrice(pricing, { hours: 10 })

      // 8 hours * $100 + 2 hours * $150 = $800 + $300 = $1100
      expect(result.amount).toBe(1100)
    })

    it('should handle zero hours', () => {
      const pricing = createHourlyPricing({
        rate: 100,
        currency: 'USD',
      })

      const result = calculatePrice(pricing, { hours: 0 })

      expect(result.amount).toBe(0)
    })
  })

  describe('project pricing', () => {
    it('should return base price for simple project', () => {
      const pricing = createProjectPricing({
        basePrice: 5000,
        currency: 'USD',
      })

      const result = calculatePrice(pricing, {})

      expect(result.amount).toBe(5000)
    })

    it('should add revision charges', () => {
      const pricing = createProjectPricing({
        basePrice: 5000,
        currency: 'USD',
        includedRevisions: 3,
        revisionPrice: 500,
      })

      const result = calculatePrice(pricing, { revisions: 5 })

      // Base $5000 + 2 extra revisions * $500 = $6000
      expect(result.amount).toBe(6000)
    })

    it('should not charge for revisions within limit', () => {
      const pricing = createProjectPricing({
        basePrice: 5000,
        currency: 'USD',
        includedRevisions: 3,
        revisionPrice: 500,
      })

      const result = calculatePrice(pricing, { revisions: 2 })

      expect(result.amount).toBe(5000)
    })

    it('should apply rush multiplier', () => {
      const pricing = createProjectPricing({
        basePrice: 5000,
        currency: 'USD',
        rushMultiplier: 1.5,
        standardDeliveryDays: 14,
      })

      const result = calculatePrice(pricing, { deliveryDays: 7 })

      expect(result.amount).toBe(7500)
    })

    it('should not apply rush for standard delivery', () => {
      const pricing = createProjectPricing({
        basePrice: 5000,
        currency: 'USD',
        rushMultiplier: 1.5,
        standardDeliveryDays: 14,
      })

      const result = calculatePrice(pricing, { deliveryDays: 14 })

      expect(result.amount).toBe(5000)
    })
  })

  describe('subscription pricing', () => {
    it('should return monthly price', () => {
      const pricing = createSubscriptionPricing({
        monthlyPrice: 99,
        currency: 'USD',
      })

      const result = calculatePrice(pricing, {})

      expect(result.amount).toBe(99)
    })

    it('should add overage charges', () => {
      const pricing = createSubscriptionPricing({
        monthlyPrice: 49,
        currency: 'USD',
        limits: {
          'api-calls': 10000,
        },
        overageRates: {
          'api-calls': 0.01,
        },
      })

      const result = calculatePrice(pricing, {
        usage: { 'api-calls': 15000 },
      })

      // $49 + 5000 overage * $0.01 = $49 + $50 = $99
      expect(result.amount).toBe(99)
    })

    it('should not charge overage within limits', () => {
      const pricing = createSubscriptionPricing({
        monthlyPrice: 49,
        currency: 'USD',
        limits: {
          'api-calls': 10000,
        },
        overageRates: {
          'api-calls': 0.01,
        },
      })

      const result = calculatePrice(pricing, {
        usage: { 'api-calls': 8000 },
      })

      expect(result.amount).toBe(49)
    })
  })

  describe('tiered pricing', () => {
    it('should calculate tiered pricing', () => {
      const pricing = {
        model: 'tiered' as const,
        tiers: [
          { from: 0, to: 100, pricePerUnit: 1.0 },
          { from: 100, to: 500, pricePerUnit: 0.8 },
          { from: 500, pricePerUnit: 0.5 },
        ],
        currency: 'USD' as const,
      }

      // 100 * $1.0 + 400 * $0.8 + 200 * $0.5 = $100 + $320 + $100 = $520
      const result = calculatePrice(pricing, { quantity: 700 })

      expect(result.amount).toBe(520)
    })

    it('should handle single tier', () => {
      const pricing = {
        model: 'tiered' as const,
        tiers: [{ from: 0, to: 100, pricePerUnit: 1.0 }],
        currency: 'USD' as const,
      }

      const result = calculatePrice(pricing, { quantity: 50 })

      expect(result.amount).toBe(50)
    })

    it('should handle zero quantity', () => {
      const pricing = {
        model: 'tiered' as const,
        tiers: [{ from: 0, pricePerUnit: 1.0 }],
        currency: 'USD' as const,
      }

      const result = calculatePrice(pricing, { quantity: 0 })

      expect(result.amount).toBe(0)
    })
  })
})

describe('applyDiscount', () => {
  it('should apply percentage discount', () => {
    const price = { amount: 100, currency: 'USD' as const }
    const result = applyDiscount(price, { type: 'percentage', value: 20 })

    expect(result.amount).toBe(80)
    expect(result.discount).toBe(20)
  })

  it('should apply fixed discount', () => {
    const price = { amount: 100, currency: 'USD' as const }
    const result = applyDiscount(price, { type: 'fixed', value: 30 })

    expect(result.amount).toBe(70)
    expect(result.discount).toBe(30)
  })

  it('should not go below zero', () => {
    const price = { amount: 50, currency: 'USD' as const }
    const result = applyDiscount(price, { type: 'fixed', value: 100 })

    expect(result.amount).toBe(0)
    expect(result.discount).toBe(50)
  })

  it('should preserve currency', () => {
    const price = { amount: 100, currency: 'EUR' as const }
    const result = applyDiscount(price, { type: 'percentage', value: 10 })

    expect(result.currency).toBe('EUR')
  })
})

describe('validatePricing', () => {
  it('should validate hourly pricing', () => {
    const pricing = createHourlyPricing({
      rate: 100,
      currency: 'USD',
    })

    expect(validatePricing(pricing)).toBe(true)
  })

  it('should reject negative hourly rate', () => {
    const pricing = {
      model: 'hourly' as const,
      rate: -50,
      currency: 'USD',
    }

    expect(() => validatePricing(pricing)).toThrow('Hourly rate cannot be negative')
  })

  it('should validate project pricing', () => {
    const pricing = createProjectPricing({
      basePrice: 5000,
      currency: 'USD',
    })

    expect(validatePricing(pricing)).toBe(true)
  })

  it('should reject negative project base price', () => {
    const pricing = {
      model: 'project' as const,
      basePrice: -1000,
      currency: 'USD',
    }

    expect(() => validatePricing(pricing)).toThrow('Base price cannot be negative')
  })

  it('should validate subscription pricing', () => {
    const pricing = createSubscriptionPricing({
      monthlyPrice: 99,
      currency: 'USD',
    })

    expect(validatePricing(pricing)).toBe(true)
  })

  it('should reject negative subscription price', () => {
    const pricing = {
      model: 'subscription' as const,
      monthlyPrice: -10,
      currency: 'USD',
      billingInterval: 'monthly' as const,
      calculateAnnualPrice: () => -120,
    }

    expect(() => validatePricing(pricing)).toThrow('Monthly price cannot be negative')
  })

  it('should reject null pricing', () => {
    expect(() => validatePricing(null)).toThrow('Invalid pricing configuration')
  })

  it('should reject undefined pricing', () => {
    expect(() => validatePricing(undefined)).toThrow('Invalid pricing configuration')
  })

  it('should reject non-object pricing', () => {
    expect(() => validatePricing('invalid')).toThrow('Invalid pricing configuration')
  })
})
