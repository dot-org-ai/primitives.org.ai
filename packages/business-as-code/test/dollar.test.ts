/**
 * Tests for dollar.ts - $ helper for business operations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  $,
  createBusinessOperations,
  updateContext,
  getContext,
  resetContext,
} from '../src/dollar.js'

describe('Dollar ($) Helper', () => {
  beforeEach(() => {
    resetContext()
  })

  describe('createBusinessOperations()', () => {
    it('should create operations with default context', () => {
      const ops = createBusinessOperations()

      expect(ops.context).toEqual({})
      expect(typeof ops.format).toBe('function')
      expect(typeof ops.percent).toBe('function')
      expect(typeof ops.growth).toBe('function')
      expect(typeof ops.margin).toBe('function')
      expect(typeof ops.roi).toBe('function')
      expect(typeof ops.ltv).toBe('function')
      expect(typeof ops.cac).toBe('function')
      expect(typeof ops.burnRate).toBe('function')
      expect(typeof ops.runway).toBe('function')
      expect(typeof ops.log).toBe('function')
    })

    it('should create operations with initial context', () => {
      const ops = createBusinessOperations({
        business: { name: 'Test Corp' },
        financials: { revenue: 100000 },
      })

      expect(ops.context.business?.name).toBe('Test Corp')
      expect(ops.context.financials?.revenue).toBe(100000)
    })
  })

  describe('$.format()', () => {
    it('should format currency with default USD', () => {
      const formatted = $.format(1234.56)
      expect(formatted).toContain('1,234.56')
      expect(formatted).toContain('$')
    })

    it('should format currency with specified currency', () => {
      const formatted = $.format(1000, 'EUR')
      expect(formatted).toContain('1,000')
    })

    it('should format negative amounts', () => {
      const formatted = $.format(-500)
      expect(formatted).toContain('-')
      expect(formatted).toContain('500')
    })

    it('should handle zero amount', () => {
      const formatted = $.format(0)
      expect(formatted).toContain('0')
    })

    it('should handle large numbers', () => {
      const formatted = $.format(1000000000)
      expect(formatted).toContain('1,000,000,000')
    })
  })

  describe('$.percent()', () => {
    it('should calculate percentage', () => {
      expect($.percent(25, 100)).toBe(25)
    })

    it('should handle zero total', () => {
      expect($.percent(25, 0)).toBe(0)
    })

    it('should handle over 100%', () => {
      expect($.percent(150, 100)).toBe(150)
    })

    it('should handle decimal values', () => {
      expect($.percent(33, 100)).toBe(33)
    })

    it('should handle zero value', () => {
      expect($.percent(0, 100)).toBe(0)
    })
  })

  describe('$.growth()', () => {
    it('should calculate growth rate', () => {
      expect($.growth(120, 100)).toBe(20)
    })

    it('should calculate negative growth', () => {
      expect($.growth(80, 100)).toBe(-20)
    })

    it('should handle zero previous value', () => {
      expect($.growth(100, 0)).toBe(0)
    })

    it('should handle same values (no growth)', () => {
      expect($.growth(100, 100)).toBe(0)
    })

    it('should handle doubling', () => {
      expect($.growth(200, 100)).toBe(100)
    })
  })

  describe('$.margin()', () => {
    it('should calculate margin', () => {
      expect($.margin(100, 60)).toBe(40)
    })

    it('should handle zero revenue', () => {
      expect($.margin(0, 0)).toBe(0)
    })

    it('should handle 100% margin', () => {
      expect($.margin(100, 0)).toBe(100)
    })

    it('should handle negative margin', () => {
      expect($.margin(100, 150)).toBe(-50)
    })
  })

  describe('$.roi()', () => {
    it('should calculate ROI', () => {
      expect($.roi(150, 100)).toBe(50)
    })

    it('should calculate negative ROI', () => {
      expect($.roi(80, 100)).toBe(-20)
    })

    it('should handle zero cost', () => {
      expect($.roi(150, 0)).toBe(0)
    })

    it('should handle 100% ROI', () => {
      expect($.roi(200, 100)).toBe(100)
    })
  })

  describe('$.ltv()', () => {
    it('should calculate lifetime value', () => {
      expect($.ltv(100, 12, 2)).toBe(2400)
    })

    it('should handle monthly subscription', () => {
      // $50/month, 12 months/year, 3 year lifetime
      expect($.ltv(50, 12, 3)).toBe(1800)
    })

    it('should handle zero values', () => {
      expect($.ltv(0, 12, 2)).toBe(0)
      expect($.ltv(100, 0, 2)).toBe(0)
      expect($.ltv(100, 12, 0)).toBe(0)
    })
  })

  describe('$.cac()', () => {
    it('should calculate customer acquisition cost', () => {
      expect($.cac(10000, 100)).toBe(100)
    })

    it('should handle zero customers', () => {
      expect($.cac(10000, 0)).toBe(0)
    })

    it('should handle zero spend', () => {
      expect($.cac(0, 100)).toBe(0)
    })
  })

  describe('$.burnRate()', () => {
    it('should calculate monthly burn rate', () => {
      expect($.burnRate(100000, 70000, 3)).toBe(10000)
    })

    it('should handle zero months', () => {
      expect($.burnRate(100000, 70000, 0)).toBe(0)
    })

    it('should handle positive cash flow', () => {
      // If ending > starting, burn is negative (accumulating cash)
      expect($.burnRate(100000, 130000, 3)).toBe(-10000)
    })
  })

  describe('$.runway()', () => {
    it('should calculate runway in months', () => {
      expect($.runway(100000, 10000)).toBe(10)
    })

    it('should handle zero burn rate', () => {
      expect($.runway(100000, 0)).toBe(Infinity)
    })

    it('should handle negative burn rate (profitable)', () => {
      expect($.runway(100000, -10000)).toBe(Infinity)
    })

    it('should handle large runway', () => {
      expect($.runway(1000000, 1000)).toBe(1000)
    })
  })

  describe('Context Management', () => {
    it('should update context', () => {
      updateContext({ business: { name: 'Updated Corp' } })
      const ctx = getContext()
      expect(ctx.business?.name).toBe('Updated Corp')
    })

    it('should merge context updates', () => {
      updateContext({ business: { name: 'Test Corp' } })
      updateContext({ financials: { revenue: 100000 } })

      const ctx = getContext()
      expect(ctx.business?.name).toBe('Test Corp')
      expect(ctx.financials?.revenue).toBe(100000)
    })

    it('should reset context', () => {
      updateContext({ business: { name: 'Test Corp' } })
      resetContext()

      const ctx = getContext()
      expect(ctx).toEqual({})
    })

    it('should get current context', () => {
      updateContext({ customField: 'custom value' })
      const ctx = getContext()
      expect(ctx.customField).toBe('custom value')
    })
  })

  describe('Default $ instance', () => {
    it('should have all operations available', () => {
      expect(typeof $.format).toBe('function')
      expect(typeof $.percent).toBe('function')
      expect(typeof $.growth).toBe('function')
      expect(typeof $.margin).toBe('function')
      expect(typeof $.roi).toBe('function')
      expect(typeof $.ltv).toBe('function')
      expect(typeof $.cac).toBe('function')
      expect(typeof $.burnRate).toBe('function')
      expect(typeof $.runway).toBe('function')
      expect(typeof $.log).toBe('function')
    })

    it('should have context object', () => {
      expect($.context).toBeDefined()
      expect(typeof $.context).toBe('object')
    })
  })
})
