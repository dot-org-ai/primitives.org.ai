/**
 * Tests for financials.ts - Financial metrics and calculations
 */

import { describe, it, expect } from 'vitest'
import {
  financials,
  calculateGrossMargin,
  calculateOperatingMargin,
  calculateNetMargin,
  calculateEBITDAMargin,
  calculateBurnRate,
  calculateRunway,
  calculateCAC,
  calculateLTV,
  calculateLTVtoCAC,
  calculatePaybackPeriod,
  calculateARR,
  calculateMRR,
  calculateGrowthRate,
  calculateCAGR,
  calculateROI,
  calculateROE,
  calculateROA,
  calculateQuickRatio,
  calculateCurrentRatio,
  calculateDebtToEquity,
  formatCurrency,
  createStatement,
  getLineItem,
  compareMetrics,
  validateFinancials,
} from './financials.js'
import type { FinancialMetrics, FinancialStatement } from './types.js'

describe('Financials', () => {
  describe('financials()', () => {
    it('should calculate financial metrics from basic inputs', () => {
      const metrics = financials({
        revenue: 1000000,
        cogs: 300000,
        operatingExpenses: 500000,
      })

      expect(metrics.revenue).toBe(1000000)
      expect(metrics.cogs).toBe(300000)
      expect(metrics.grossProfit).toBe(700000)
      expect(metrics.grossMargin).toBe(70)
      expect(metrics.operatingIncome).toBe(200000)
      expect(metrics.operatingMargin).toBe(20)
      expect(metrics.netIncome).toBe(200000)
      expect(metrics.netMargin).toBe(20)
    })

    it('should use defaults for missing inputs', () => {
      const metrics = financials({})

      expect(metrics.revenue).toBe(0)
      expect(metrics.cogs).toBe(0)
      expect(metrics.operatingExpenses).toBe(0)
      expect(metrics.currency).toBe('USD')
      expect(metrics.period).toBe('monthly')
    })

    it('should preserve provided values', () => {
      const metrics = financials({
        revenue: 1000000,
        cogs: 300000,
        operatingExpenses: 500000,
        netIncome: 150000,
        ebitda: 250000,
        currency: 'EUR',
        period: 'quarterly',
      })

      expect(metrics.netIncome).toBe(150000)
      expect(metrics.ebitda).toBe(250000)
      expect(metrics.currency).toBe('EUR')
      expect(metrics.period).toBe('quarterly')
    })

    it('should handle zero revenue', () => {
      const metrics = financials({
        revenue: 0,
        cogs: 0,
        operatingExpenses: 0,
      })

      expect(metrics.grossMargin).toBe(0)
      expect(metrics.operatingMargin).toBe(0)
      expect(metrics.netMargin).toBe(0)
    })
  })

  describe('calculateGrossMargin()', () => {
    it('should calculate gross margin percentage', () => {
      expect(calculateGrossMargin(100, 30)).toBe(70)
    })

    it('should return 0 for zero revenue', () => {
      expect(calculateGrossMargin(0, 0)).toBe(0)
    })

    it('should handle 100% margin', () => {
      expect(calculateGrossMargin(100, 0)).toBe(100)
    })

    it('should handle negative margin', () => {
      expect(calculateGrossMargin(100, 150)).toBe(-50)
    })
  })

  describe('calculateOperatingMargin()', () => {
    it('should calculate operating margin', () => {
      expect(calculateOperatingMargin(100, 30, 20)).toBe(50)
    })

    it('should return 0 for zero revenue', () => {
      expect(calculateOperatingMargin(0, 0, 0)).toBe(0)
    })

    it('should handle negative operating income', () => {
      expect(calculateOperatingMargin(100, 50, 70)).toBe(-20)
    })
  })

  describe('calculateNetMargin()', () => {
    it('should calculate net margin', () => {
      expect(calculateNetMargin(100, 25)).toBe(25)
    })

    it('should return 0 for zero revenue', () => {
      expect(calculateNetMargin(0, 0)).toBe(0)
    })

    it('should handle negative net income', () => {
      expect(calculateNetMargin(100, -10)).toBe(-10)
    })
  })

  describe('calculateEBITDAMargin()', () => {
    it('should calculate EBITDA margin', () => {
      expect(calculateEBITDAMargin(100, 30)).toBe(30)
    })

    it('should return 0 for zero revenue', () => {
      expect(calculateEBITDAMargin(0, 0)).toBe(0)
    })
  })

  describe('calculateBurnRate()', () => {
    it('should calculate monthly burn rate', () => {
      expect(calculateBurnRate(100000, 70000, 3)).toBe(10000)
    })

    it('should return 0 for zero months', () => {
      expect(calculateBurnRate(100000, 70000, 0)).toBe(0)
    })

    it('should handle positive cash flow (negative burn)', () => {
      expect(calculateBurnRate(100000, 130000, 3)).toBe(-10000)
    })
  })

  describe('calculateRunway()', () => {
    it('should calculate runway in months', () => {
      expect(calculateRunway(100000, 10000)).toBe(10)
    })

    it('should return Infinity for zero burn rate', () => {
      expect(calculateRunway(100000, 0)).toBe(Infinity)
    })

    it('should return Infinity for negative burn rate (profitable)', () => {
      expect(calculateRunway(100000, -10000)).toBe(Infinity)
    })
  })

  describe('calculateCAC()', () => {
    it('should calculate customer acquisition cost', () => {
      expect(calculateCAC(10000, 100)).toBe(100)
    })

    it('should return 0 for zero customers', () => {
      expect(calculateCAC(10000, 0)).toBe(0)
    })

    it('should handle zero spend', () => {
      expect(calculateCAC(0, 100)).toBe(0)
    })
  })

  describe('calculateLTV()', () => {
    it('should calculate lifetime value', () => {
      // LTV = ARPU * Lifetime * (Gross Margin / 100)
      // 100 * 24 * 0.7 = 1680
      expect(calculateLTV(100, 24, 70)).toBe(1680)
    })

    it('should handle zero values', () => {
      expect(calculateLTV(0, 24, 70)).toBe(0)
      expect(calculateLTV(100, 0, 70)).toBe(0)
      expect(calculateLTV(100, 24, 0)).toBe(0)
    })
  })

  describe('calculateLTVtoCAC()', () => {
    it('should calculate LTV:CAC ratio', () => {
      expect(calculateLTVtoCAC(300, 100)).toBe(3)
    })

    it('should return 0 for zero CAC', () => {
      expect(calculateLTVtoCAC(300, 0)).toBe(0)
    })
  })

  describe('calculatePaybackPeriod()', () => {
    it('should calculate payback period in months', () => {
      expect(calculatePaybackPeriod(1200, 100)).toBe(12)
    })

    it('should return 0 for zero monthly revenue', () => {
      expect(calculatePaybackPeriod(1200, 0)).toBe(0)
    })
  })

  describe('calculateARR()', () => {
    it('should calculate ARR from MRR', () => {
      expect(calculateARR(10000)).toBe(120000)
    })

    it('should handle zero MRR', () => {
      expect(calculateARR(0)).toBe(0)
    })
  })

  describe('calculateMRR()', () => {
    it('should calculate MRR from ARR', () => {
      expect(calculateMRR(120000)).toBe(10000)
    })

    it('should handle zero ARR', () => {
      expect(calculateMRR(0)).toBe(0)
    })
  })

  describe('calculateGrowthRate()', () => {
    it('should calculate growth rate', () => {
      expect(calculateGrowthRate(120, 100)).toBe(20)
    })

    it('should calculate negative growth', () => {
      expect(calculateGrowthRate(80, 100)).toBe(-20)
    })

    it('should return 0 for zero previous revenue', () => {
      expect(calculateGrowthRate(100, 0)).toBe(0)
    })

    it('should handle same values (no growth)', () => {
      expect(calculateGrowthRate(100, 100)).toBe(0)
    })

    it('should handle doubling', () => {
      expect(calculateGrowthRate(200, 100)).toBe(100)
    })
  })

  describe('calculateCAGR()', () => {
    it('should calculate compound annual growth rate', () => {
      // $100 to $200 over 5 years
      const cagr = calculateCAGR(100, 200, 5)
      expect(cagr).toBeCloseTo(14.87, 1)
    })

    it('should return 0 for zero beginning value', () => {
      expect(calculateCAGR(0, 200, 5)).toBe(0)
    })

    it('should return 0 for zero years', () => {
      expect(calculateCAGR(100, 200, 0)).toBe(0)
    })

    it('should handle negative growth', () => {
      const cagr = calculateCAGR(200, 100, 5)
      expect(cagr).toBeLessThan(0)
    })
  })

  describe('calculateROI()', () => {
    it('should calculate ROI', () => {
      expect(calculateROI(150, 100)).toBe(50)
    })

    it('should calculate negative ROI', () => {
      expect(calculateROI(80, 100)).toBe(-20)
    })

    it('should return 0 for zero cost', () => {
      expect(calculateROI(150, 0)).toBe(0)
    })

    it('should handle 100% ROI', () => {
      expect(calculateROI(200, 100)).toBe(100)
    })
  })

  describe('calculateROE()', () => {
    it('should calculate return on equity', () => {
      expect(calculateROE(50000, 250000)).toBe(20)
    })

    it('should return 0 for zero equity', () => {
      expect(calculateROE(50000, 0)).toBe(0)
    })
  })

  describe('calculateROA()', () => {
    it('should calculate return on assets', () => {
      expect(calculateROA(50000, 500000)).toBe(10)
    })

    it('should return 0 for zero assets', () => {
      expect(calculateROA(50000, 0)).toBe(0)
    })
  })

  describe('calculateQuickRatio()', () => {
    it('should calculate quick ratio', () => {
      // (100000 - 20000) / 40000 = 2
      expect(calculateQuickRatio(100000, 20000, 40000)).toBe(2)
    })

    it('should return 0 for zero liabilities', () => {
      expect(calculateQuickRatio(100000, 20000, 0)).toBe(0)
    })
  })

  describe('calculateCurrentRatio()', () => {
    it('should calculate current ratio', () => {
      expect(calculateCurrentRatio(100000, 50000)).toBe(2)
    })

    it('should return 0 for zero liabilities', () => {
      expect(calculateCurrentRatio(100000, 0)).toBe(0)
    })
  })

  describe('calculateDebtToEquity()', () => {
    it('should calculate debt-to-equity ratio', () => {
      expect(calculateDebtToEquity(100000, 200000)).toBe(0.5)
    })

    it('should return 0 for zero equity', () => {
      expect(calculateDebtToEquity(100000, 0)).toBe(0)
    })
  })

  describe('formatCurrency()', () => {
    it('should format USD currency', () => {
      const formatted = formatCurrency(1234.56)
      expect(formatted).toContain('$')
      expect(formatted).toContain('1,234.56')
    })

    it('should format EUR currency', () => {
      const formatted = formatCurrency(1234.56, 'EUR')
      expect(formatted).toContain('1,234.56')
    })

    it('should format GBP currency', () => {
      const formatted = formatCurrency(1234.56, 'GBP')
      expect(formatted).toContain('1,234.56')
    })

    it('should handle negative amounts', () => {
      const formatted = formatCurrency(-1234.56)
      expect(formatted).toContain('-')
    })

    it('should handle zero amount', () => {
      const formatted = formatCurrency(0)
      expect(formatted).toContain('$')
      expect(formatted).toContain('0')
    })

    it('should handle large numbers', () => {
      const formatted = formatCurrency(1000000000)
      expect(formatted).toContain('1,000,000,000')
    })
  })

  describe('createStatement()', () => {
    it('should create a financial statement', () => {
      const statement = createStatement('income', 'Q4 2024', {
        revenue: 1000000,
        cogs: 300000,
        operatingExpenses: 500000,
      })

      expect(statement.type).toBe('income')
      expect(statement.period).toBe('Q4 2024')
      expect(statement.lineItems.revenue).toBe(1000000)
      expect(statement.currency).toBe('USD')
    })

    it('should use specified currency', () => {
      const statement = createStatement('balance', 'Q4 2024', {}, 'EUR')
      expect(statement.currency).toBe('EUR')
    })
  })

  describe('getLineItem()', () => {
    const statement: FinancialStatement = {
      type: 'income',
      period: 'Q4 2024',
      lineItems: {
        revenue: 1000000,
        cogs: 300000,
      },
      currency: 'USD',
    }

    it('should get existing line item', () => {
      expect(getLineItem(statement, 'revenue')).toBe(1000000)
    })

    it('should return 0 for non-existent line item', () => {
      expect(getLineItem(statement, 'expenses')).toBe(0)
    })
  })

  describe('compareMetrics()', () => {
    it('should compare financial metrics between periods', () => {
      const current = financials({
        revenue: 1200000,
        cogs: 360000,
        operatingExpenses: 600000,
      })

      const previous = financials({
        revenue: 1000000,
        cogs: 300000,
        operatingExpenses: 500000,
      })

      const comparison = compareMetrics(current, previous)

      expect(comparison.revenue?.change).toBe(200000)
      expect(comparison.revenue?.changePercent).toBe(20)
    })

    it('should handle zero previous values', () => {
      const current = financials({ revenue: 100000 })
      const previous = financials({ revenue: 0 })

      const comparison = compareMetrics(current, previous)
      expect(comparison.revenue?.changePercent).toBe(0)
    })
  })

  describe('validateFinancials()', () => {
    it('should validate valid financials', () => {
      const metrics = financials({
        revenue: 1000000,
        cogs: 300000,
        operatingExpenses: 500000,
      })

      const result = validateFinancials(metrics)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for negative revenue', () => {
      const metrics: FinancialMetrics = {
        revenue: -100000,
        currency: 'USD',
        period: 'monthly',
      }

      const result = validateFinancials(metrics)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Revenue cannot be negative')
    })

    it('should fail for negative COGS', () => {
      const metrics: FinancialMetrics = {
        revenue: 100000,
        cogs: -30000,
        currency: 'USD',
        period: 'monthly',
      }

      const result = validateFinancials(metrics)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('COGS cannot be negative')
    })

    it('should fail for negative operating expenses', () => {
      const metrics: FinancialMetrics = {
        revenue: 100000,
        operatingExpenses: -50000,
        currency: 'USD',
        period: 'monthly',
      }

      const result = validateFinancials(metrics)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Operating expenses cannot be negative')
    })

    it('should fail if COGS exceeds revenue', () => {
      const metrics: FinancialMetrics = {
        revenue: 100000,
        cogs: 150000,
        currency: 'USD',
        period: 'monthly',
      }

      const result = validateFinancials(metrics)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('COGS cannot exceed revenue')
    })

    it('should allow zero values', () => {
      const metrics: FinancialMetrics = {
        revenue: 0,
        cogs: 0,
        operatingExpenses: 0,
        currency: 'USD',
        period: 'monthly',
      }

      const result = validateFinancials(metrics)
      expect(result.valid).toBe(true)
    })
  })
})
