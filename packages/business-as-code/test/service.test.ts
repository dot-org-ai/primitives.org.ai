/**
 * Tests for service.ts - Service definition and management
 */

import { describe, it, expect } from 'vitest'
import {
  Service,
  calculateHourlyPrice,
  calculateMonthlyRetainer,
  checkSLAUptime,
  parseDeliveryTimeToDays,
  estimateCompletionDate,
  calculateValueBasedPrice,
  validateService,
} from '../src/service.js'
import type { ServiceDefinition } from '../src/types.js'

describe('Service', () => {
  describe('Service()', () => {
    it('should create a service with required fields', () => {
      const service = Service({ name: 'Test Service' })

      expect(service.name).toBe('Test Service')
      expect(service.pricingModel).toBe('hourly')
      expect(service.currency).toBe('USD')
      expect(service.metadata).toEqual({})
    })

    it('should create a service with all fields', () => {
      const service = Service({
        name: 'Consulting Service',
        description: 'Expert consulting',
        category: 'Professional Services',
        targetSegment: 'Enterprise',
        valueProposition: 'Maximize ROI',
        pricingModel: 'fixed',
        price: 5000,
        currency: 'EUR',
        deliveryTime: '2 weeks',
        sla: {
          uptime: 99.9,
          responseTime: '< 24 hours',
          supportHours: '9-5 EST',
          penalties: '10% refund per day',
        },
        metadata: { type: 'premium' },
      })

      expect(service.name).toBe('Consulting Service')
      expect(service.description).toBe('Expert consulting')
      expect(service.pricingModel).toBe('fixed')
      expect(service.price).toBe(5000)
      expect(service.currency).toBe('EUR')
      expect(service.deliveryTime).toBe('2 weeks')
      expect(service.sla?.uptime).toBe(99.9)
      expect(service.metadata).toEqual({ type: 'premium' })
    })

    it('should throw error if name is missing', () => {
      expect(() => Service({ name: '' })).toThrow('Service name is required')
    })

    it('should preserve provided values', () => {
      const service = Service({
        name: 'Test',
        pricingModel: 'retainer',
        currency: 'GBP',
      })

      expect(service.pricingModel).toBe('retainer')
      expect(service.currency).toBe('GBP')
    })
  })

  describe('calculateHourlyPrice()', () => {
    it('should calculate price for hours', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'hourly',
        price: 150,
      })

      expect(calculateHourlyPrice(service, 10)).toBe(1500)
    })

    it('should throw error for non-hourly pricing', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'fixed',
        price: 5000,
      })

      expect(() => calculateHourlyPrice(service, 10)).toThrow(
        'Service must use hourly pricing model'
      )
    })

    it('should throw error if price is missing', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'hourly',
      })

      expect(() => calculateHourlyPrice(service, 10)).toThrow(
        'Service must use hourly pricing model'
      )
    })

    it('should handle zero hours', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'hourly',
        price: 150,
      })

      expect(calculateHourlyPrice(service, 0)).toBe(0)
    })

    it('should handle fractional hours', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'hourly',
        price: 100,
      })

      expect(calculateHourlyPrice(service, 1.5)).toBe(150)
    })
  })

  describe('calculateMonthlyRetainer()', () => {
    it('should calculate monthly retainer', () => {
      const service = Service({
        name: 'Support',
        pricingModel: 'hourly',
        price: 100,
      })

      expect(calculateMonthlyRetainer(service, 40)).toBe(4000)
    })

    it('should throw error for non-hourly pricing', () => {
      const service = Service({
        name: 'Support',
        pricingModel: 'fixed',
        price: 5000,
      })

      expect(() => calculateMonthlyRetainer(service, 40)).toThrow(
        'Service must use hourly pricing model'
      )
    })

    it('should handle zero hours', () => {
      const service = Service({
        name: 'Support',
        pricingModel: 'hourly',
        price: 100,
      })

      expect(calculateMonthlyRetainer(service, 0)).toBe(0)
    })
  })

  describe('checkSLAUptime()', () => {
    it('should return true when uptime meets SLA', () => {
      const service = Service({
        name: 'API',
        sla: { uptime: 99.9 },
      })

      expect(checkSLAUptime(service, 99.95)).toBe(true)
    })

    it('should return true when uptime equals SLA', () => {
      const service = Service({
        name: 'API',
        sla: { uptime: 99.9 },
      })

      expect(checkSLAUptime(service, 99.9)).toBe(true)
    })

    it('should return false when uptime below SLA', () => {
      const service = Service({
        name: 'API',
        sla: { uptime: 99.9 },
      })

      expect(checkSLAUptime(service, 99.5)).toBe(false)
    })

    it('should return true when no SLA uptime defined', () => {
      const service = Service({ name: 'API' })
      expect(checkSLAUptime(service, 99.5)).toBe(true)
    })

    it('should return true when no SLA defined', () => {
      const service = Service({
        name: 'API',
        sla: { responseTime: '< 24 hours' },
      })

      expect(checkSLAUptime(service, 99.5)).toBe(true)
    })
  })

  describe('parseDeliveryTimeToDays()', () => {
    it('should parse days', () => {
      expect(parseDeliveryTimeToDays('5 days')).toBe(5)
      expect(parseDeliveryTimeToDays('1 day')).toBe(1)
    })

    it('should parse weeks', () => {
      expect(parseDeliveryTimeToDays('2 weeks')).toBe(14)
      expect(parseDeliveryTimeToDays('1 week')).toBe(7)
    })

    it('should parse months', () => {
      expect(parseDeliveryTimeToDays('1 month')).toBe(30)
      expect(parseDeliveryTimeToDays('3 months')).toBe(90)
    })

    it('should parse hours', () => {
      expect(parseDeliveryTimeToDays('24 hours')).toBe(1)
      expect(parseDeliveryTimeToDays('48 hours')).toBe(2)
    })

    it('should return 0 for undefined', () => {
      expect(parseDeliveryTimeToDays(undefined)).toBe(0)
    })

    it('should return 0 for invalid format', () => {
      expect(parseDeliveryTimeToDays('invalid')).toBe(0)
      expect(parseDeliveryTimeToDays('soon')).toBe(0)
    })

    it('should handle case insensitivity', () => {
      expect(parseDeliveryTimeToDays('2 WEEKS')).toBe(14)
      expect(parseDeliveryTimeToDays('1 Day')).toBe(1)
    })
  })

  describe('estimateCompletionDate()', () => {
    it('should estimate completion date', () => {
      const service = Service({
        name: 'Project',
        deliveryTime: '2 weeks',
      })

      const startDate = new Date('2024-01-01')
      const completion = estimateCompletionDate(service, startDate)

      expect(completion.getTime()).toBe(new Date('2024-01-15').getTime())
    })

    it('should use current date if no start date provided', () => {
      const service = Service({
        name: 'Project',
        deliveryTime: '1 day',
      })

      const now = new Date()
      const completion = estimateCompletionDate(service)

      // Allow for small timing differences
      const expectedDate = new Date(now)
      expectedDate.setDate(now.getDate() + 1)
      expect(completion.getDate()).toBe(expectedDate.getDate())
    })

    it('should handle no delivery time', () => {
      const service = Service({ name: 'Project' })

      const startDate = new Date('2024-01-01')
      const completion = estimateCompletionDate(service, startDate)

      expect(completion.getTime()).toBe(startDate.getTime())
    })
  })

  describe('calculateValueBasedPrice()', () => {
    it('should calculate value-based price', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'value-based',
      })

      expect(calculateValueBasedPrice(service, 100000, 20)).toBe(20000)
    })

    it('should throw error for non-value-based pricing', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'hourly',
        price: 150,
      })

      expect(() => calculateValueBasedPrice(service, 100000, 20)).toThrow(
        'Service must use value-based pricing model'
      )
    })

    it('should throw error for invalid percentage (below 0)', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'value-based',
      })

      expect(() => calculateValueBasedPrice(service, 100000, -10)).toThrow(
        'Value share percentage must be between 0 and 100'
      )
    })

    it('should throw error for invalid percentage (above 100)', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'value-based',
      })

      expect(() => calculateValueBasedPrice(service, 100000, 150)).toThrow(
        'Value share percentage must be between 0 and 100'
      )
    })

    it('should handle zero value', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'value-based',
      })

      expect(calculateValueBasedPrice(service, 0, 20)).toBe(0)
    })

    it('should handle zero percentage', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'value-based',
      })

      expect(calculateValueBasedPrice(service, 100000, 0)).toBe(0)
    })

    it('should handle 100% percentage', () => {
      const service = Service({
        name: 'Consulting',
        pricingModel: 'value-based',
      })

      expect(calculateValueBasedPrice(service, 100000, 100)).toBe(100000)
    })
  })

  describe('validateService()', () => {
    it('should validate valid service', () => {
      const service: ServiceDefinition = {
        name: 'Valid Service',
        pricingModel: 'hourly',
        price: 100,
      }

      const result = validateService(service)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail if name is missing', () => {
      const service: ServiceDefinition = { name: '' }

      const result = validateService(service)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Service name is required')
    })

    it('should fail if price is negative', () => {
      const service: ServiceDefinition = { name: 'Test', price: -100 }

      const result = validateService(service)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Service price cannot be negative')
    })

    it('should fail if SLA uptime is below 0', () => {
      const service: ServiceDefinition = {
        name: 'Test',
        sla: { uptime: -1 },
      }

      const result = validateService(service)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('SLA uptime must be between 0 and 100')
    })

    it('should fail if SLA uptime is above 100', () => {
      const service: ServiceDefinition = {
        name: 'Test',
        sla: { uptime: 101 },
      }

      const result = validateService(service)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('SLA uptime must be between 0 and 100')
    })

    it('should fail for invalid pricing model', () => {
      const service: ServiceDefinition = {
        name: 'Test',
        pricingModel: 'invalid' as ServiceDefinition['pricingModel'],
      }

      const result = validateService(service)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid pricing model')
    })

    it('should allow all valid pricing models', () => {
      const pricingModels: ServiceDefinition['pricingModel'][] = [
        'hourly',
        'fixed',
        'retainer',
        'value-based',
      ]

      for (const model of pricingModels) {
        const service: ServiceDefinition = { name: 'Test', pricingModel: model }
        const result = validateService(service)
        expect(result.valid).toBe(true)
      }
    })

    it('should allow zero price', () => {
      const service: ServiceDefinition = { name: 'Free Service', price: 0 }

      const result = validateService(service)
      expect(result.valid).toBe(true)
    })

    it('should return multiple errors', () => {
      const service: ServiceDefinition = {
        name: '',
        price: -100,
        sla: { uptime: 150 },
        pricingModel: 'invalid' as ServiceDefinition['pricingModel'],
      }

      const result = validateService(service)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})
