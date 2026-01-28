/**
 * Tests for kpis.ts - Key Performance Indicators management
 */

import { describe, it, expect } from 'vitest'
import {
  kpis,
  kpi,
  calculateAchievement,
  meetsTarget,
  updateCurrent,
  updateTarget,
  getKPIsByCategory,
  getKPIsByFrequency,
  getKPIsOnTarget,
  getKPIsOffTarget,
  calculateHealthScore,
  groupByCategory,
  calculateVariance,
  calculateVariancePercentage,
  formatValue,
  comparePerformance,
  validateKPIs,
} from '../src/kpis.js'
import type { KPIDefinition } from '../src/types.js'

describe('KPIs', () => {
  describe('kpis()', () => {
    it('should create multiple KPIs', () => {
      const kpiList = kpis([
        { name: 'Revenue', target: 100000 },
        { name: 'Churn', target: 5 },
      ])

      expect(kpiList).toHaveLength(2)
      expect(kpiList[0]?.name).toBe('Revenue')
      expect(kpiList[1]?.name).toBe('Churn')
    })

    it('should normalize KPI defaults', () => {
      const kpiList = kpis([{ name: 'Test KPI' }])

      expect(kpiList[0]?.category).toBe('operations')
      expect(kpiList[0]?.frequency).toBe('monthly')
      expect(kpiList[0]?.metadata).toEqual({})
    })

    it('should throw error for KPI without name', () => {
      expect(() => kpis([{ name: '' }])).toThrow('KPI name is required')
    })
  })

  describe('kpi()', () => {
    it('should create a single KPI', () => {
      const singleKpi = kpi({
        name: 'Monthly Revenue',
        category: 'financial',
        target: 100000,
      })

      expect(singleKpi.name).toBe('Monthly Revenue')
      expect(singleKpi.category).toBe('financial')
    })
  })

  describe('calculateAchievement()', () => {
    it('should calculate achievement percentage', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 75 }
      expect(calculateAchievement(testKpi)).toBe(75)
    })

    it('should handle over-achievement', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 150 }
      expect(calculateAchievement(testKpi)).toBe(150)
    })

    it('should return 0 if target is undefined', () => {
      const testKpi: KPIDefinition = { name: 'Test', current: 75 }
      expect(calculateAchievement(testKpi)).toBe(0)
    })

    it('should return 0 if current is undefined', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100 }
      expect(calculateAchievement(testKpi)).toBe(0)
    })

    it('should return 100 if target is 0', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 0, current: 50 }
      expect(calculateAchievement(testKpi)).toBe(100)
    })
  })

  describe('meetsTarget()', () => {
    it('should return true when current exceeds target', () => {
      const testKpi: KPIDefinition = { name: 'Revenue', target: 100, current: 120 }
      expect(meetsTarget(testKpi)).toBe(true)
    })

    it('should return true when current equals target', () => {
      const testKpi: KPIDefinition = { name: 'Revenue', target: 100, current: 100 }
      expect(meetsTarget(testKpi)).toBe(true)
    })

    it('should return false when current is below target', () => {
      const testKpi: KPIDefinition = { name: 'Revenue', target: 100, current: 80 }
      expect(meetsTarget(testKpi)).toBe(false)
    })

    it('should handle lower-is-better metrics (churn)', () => {
      const churnKpi: KPIDefinition = { name: 'Customer Churn Rate', target: 5, current: 3 }
      expect(meetsTarget(churnKpi)).toBe(true)
    })

    it('should handle lower-is-better metrics (cost)', () => {
      const costKpi: KPIDefinition = { name: 'Operational Cost', target: 10000, current: 8000 }
      expect(meetsTarget(costKpi)).toBe(true)
    })

    it('should handle lower-is-better metrics (time)', () => {
      const timeKpi: KPIDefinition = { name: 'Response Time', target: 100, current: 150 }
      expect(meetsTarget(timeKpi)).toBe(false)
    })

    it('should handle lower-is-better metrics (error)', () => {
      const errorKpi: KPIDefinition = { name: 'Error Rate', target: 1, current: 0.5 }
      expect(meetsTarget(errorKpi)).toBe(true)
    })

    it('should handle lower-is-better metrics (downtime)', () => {
      const downtimeKpi: KPIDefinition = { name: 'System Downtime', target: 5, current: 10 }
      expect(meetsTarget(downtimeKpi)).toBe(false)
    })

    it('should return false for undefined values', () => {
      expect(meetsTarget({ name: 'Test' })).toBe(false)
      expect(meetsTarget({ name: 'Test', target: 100 })).toBe(false)
      expect(meetsTarget({ name: 'Test', current: 80 })).toBe(false)
    })
  })

  describe('updateCurrent()', () => {
    it('should update current value', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 50 }
      const updated = updateCurrent(testKpi, 75)

      expect(updated.current).toBe(75)
      expect(updated.target).toBe(100)
    })
  })

  describe('updateTarget()', () => {
    it('should update target value', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 50 }
      const updated = updateTarget(testKpi, 150)

      expect(updated.target).toBe(150)
      expect(updated.current).toBe(50)
    })
  })

  describe('getKPIsByCategory()', () => {
    const kpiList = kpis([
      { name: 'Revenue', category: 'financial' },
      { name: 'NPS', category: 'customer' },
      { name: 'MRR', category: 'financial' },
      { name: 'Uptime', category: 'operations' },
    ])

    it('should filter by category', () => {
      const financial = getKPIsByCategory(kpiList, 'financial')

      expect(financial).toHaveLength(2)
      expect(financial[0]?.name).toBe('Revenue')
      expect(financial[1]?.name).toBe('MRR')
    })

    it('should return empty array for non-existent category', () => {
      const growth = getKPIsByCategory(kpiList, 'growth')
      expect(growth).toHaveLength(0)
    })
  })

  describe('getKPIsByFrequency()', () => {
    const kpiList = kpis([
      { name: 'Daily Active Users', frequency: 'daily' },
      { name: 'MRR', frequency: 'monthly' },
      { name: 'Weekly Sales', frequency: 'weekly' },
      { name: 'Monthly Revenue', frequency: 'monthly' },
    ])

    it('should filter by frequency', () => {
      const monthly = getKPIsByFrequency(kpiList, 'monthly')

      expect(monthly).toHaveLength(2)
      expect(monthly[0]?.name).toBe('MRR')
      expect(monthly[1]?.name).toBe('Monthly Revenue')
    })
  })

  describe('getKPIsOnTarget() and getKPIsOffTarget()', () => {
    const kpiList: KPIDefinition[] = [
      { name: 'Revenue', target: 100, current: 120 },
      { name: 'NPS', target: 50, current: 45 },
      { name: 'Churn Rate', target: 5, current: 3 },
      { name: 'Cost', target: 10000, current: 12000 },
    ]

    it('should get KPIs on target', () => {
      const onTarget = getKPIsOnTarget(kpiList)

      expect(onTarget).toHaveLength(2)
      expect(onTarget.map((k) => k.name)).toContain('Revenue')
      expect(onTarget.map((k) => k.name)).toContain('Churn Rate')
    })

    it('should get KPIs off target', () => {
      const offTarget = getKPIsOffTarget(kpiList)

      expect(offTarget).toHaveLength(2)
      expect(offTarget.map((k) => k.name)).toContain('NPS')
      expect(offTarget.map((k) => k.name)).toContain('Cost')
    })
  })

  describe('calculateHealthScore()', () => {
    it('should calculate health score as percentage on target', () => {
      const kpiList: KPIDefinition[] = [
        { name: 'KPI 1', target: 100, current: 120 },
        { name: 'KPI 2', target: 100, current: 80 },
        { name: 'KPI 3', target: 100, current: 150 },
        { name: 'KPI 4', target: 100, current: 90 },
      ]

      expect(calculateHealthScore(kpiList)).toBe(50)
    })

    it('should return 0 for empty KPI list', () => {
      expect(calculateHealthScore([])).toBe(0)
    })

    it('should return 100 when all KPIs on target', () => {
      const kpiList: KPIDefinition[] = [
        { name: 'KPI 1', target: 100, current: 120 },
        { name: 'KPI 2', target: 100, current: 100 },
      ]

      expect(calculateHealthScore(kpiList)).toBe(100)
    })
  })

  describe('groupByCategory()', () => {
    const kpiList = kpis([
      { name: 'Revenue', category: 'financial' },
      { name: 'NPS', category: 'customer' },
      { name: 'MRR', category: 'financial' },
    ])

    it('should group KPIs by category', () => {
      const grouped = groupByCategory(kpiList)

      expect(grouped.get('financial')).toHaveLength(2)
      expect(grouped.get('customer')).toHaveLength(1)
    })

    it('should handle KPIs without category', () => {
      const kpisWithoutCategory: KPIDefinition[] = [{ name: 'Test' }]
      const grouped = groupByCategory(kpisWithoutCategory)

      expect(grouped.get('other')).toHaveLength(1)
    })
  })

  describe('calculateVariance()', () => {
    it('should calculate variance from target', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 120 }
      expect(calculateVariance(testKpi)).toBe(20)
    })

    it('should handle negative variance', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 80 }
      expect(calculateVariance(testKpi)).toBe(-20)
    })

    it('should return 0 for undefined values', () => {
      expect(calculateVariance({ name: 'Test' })).toBe(0)
    })
  })

  describe('calculateVariancePercentage()', () => {
    it('should calculate variance percentage', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 120 }
      expect(calculateVariancePercentage(testKpi)).toBe(20)
    })

    it('should handle negative variance', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 100, current: 80 }
      expect(calculateVariancePercentage(testKpi)).toBe(-20)
    })

    it('should return 0 for zero target', () => {
      const testKpi: KPIDefinition = { name: 'Test', target: 0, current: 100 }
      expect(calculateVariancePercentage(testKpi)).toBe(0)
    })
  })

  describe('formatValue()', () => {
    it('should format with USD unit', () => {
      const testKpi: KPIDefinition = { name: 'Revenue', unit: 'USD', current: 1234.56 }
      expect(formatValue(testKpi)).toMatch(/\$1,234\.56/)
    })

    it('should format with percent unit', () => {
      const testKpi: KPIDefinition = { name: 'Growth', unit: 'percent', current: 25.5 }
      expect(formatValue(testKpi)).toBe('25.5%')
    })

    it('should format with % unit', () => {
      const testKpi: KPIDefinition = { name: 'Growth', unit: '%', current: 25.5 }
      expect(formatValue(testKpi)).toBe('25.5%')
    })

    it('should format with custom unit', () => {
      const testKpi: KPIDefinition = { name: 'Users', unit: 'users', current: 1000 }
      expect(formatValue(testKpi)).toBe('1,000 users')
    })

    it('should format without unit', () => {
      const testKpi: KPIDefinition = { name: 'Count', current: 500 }
      expect(formatValue(testKpi)).toBe('500')
    })

    it('should return N/A for undefined value', () => {
      const testKpi: KPIDefinition = { name: 'Test' }
      expect(formatValue(testKpi)).toBe('N/A')
    })

    it('should format explicit value parameter', () => {
      const testKpi: KPIDefinition = { name: 'Revenue', unit: 'USD', current: 100 }
      expect(formatValue(testKpi, 500)).toMatch(/\$500/)
    })
  })

  describe('comparePerformance()', () => {
    it('should compare performance between periods', () => {
      const current: KPIDefinition = { name: 'Revenue', current: 120 }
      const previous: KPIDefinition = { name: 'Revenue', current: 100 }

      const result = comparePerformance(current, previous)

      expect(result.change).toBe(20)
      expect(result.changePercent).toBe(20)
      expect(result.improved).toBe(true)
    })

    it('should detect regression', () => {
      const current: KPIDefinition = { name: 'Revenue', current: 80 }
      const previous: KPIDefinition = { name: 'Revenue', current: 100 }

      const result = comparePerformance(current, previous)

      expect(result.change).toBe(-20)
      expect(result.changePercent).toBe(-20)
      expect(result.improved).toBe(false)
    })

    it('should handle lower-is-better metrics', () => {
      const current: KPIDefinition = { name: 'Churn Rate', current: 3 }
      const previous: KPIDefinition = { name: 'Churn Rate', current: 5 }

      const result = comparePerformance(current, previous)

      expect(result.change).toBe(-2)
      expect(result.improved).toBe(true)
    })

    it('should handle cost reduction as improvement', () => {
      const current: KPIDefinition = { name: 'Cost', current: 8000 }
      const previous: KPIDefinition = { name: 'Cost', current: 10000 }

      const result = comparePerformance(current, previous)

      expect(result.improved).toBe(true)
    })

    it('should handle undefined values', () => {
      const current: KPIDefinition = { name: 'Test' }
      const previous: KPIDefinition = { name: 'Test' }

      const result = comparePerformance(current, previous)

      expect(result.change).toBe(0)
      expect(result.changePercent).toBe(0)
      expect(result.improved).toBe(false)
    })
  })

  describe('validateKPIs()', () => {
    it('should validate valid KPIs', () => {
      const kpiList: KPIDefinition[] = [
        { name: 'Revenue', target: 100000, current: 80000 },
        { name: 'NPS', target: 50, current: 48 },
      ]

      const result = validateKPIs(kpiList)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for KPI without name', () => {
      const kpiList: KPIDefinition[] = [{ name: '' }]

      const result = validateKPIs(kpiList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('KPI name is required')
    })

    it('should fail for negative target', () => {
      const kpiList: KPIDefinition[] = [{ name: 'Test', target: -100 }]

      const result = validateKPIs(kpiList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('KPI Test target cannot be negative')
    })

    it('should fail for negative current value', () => {
      const kpiList: KPIDefinition[] = [{ name: 'Test', current: -50 }]

      const result = validateKPIs(kpiList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('KPI Test current value cannot be negative')
    })

    it('should allow zero values', () => {
      const kpiList: KPIDefinition[] = [{ name: 'Test', target: 0, current: 0 }]

      const result = validateKPIs(kpiList)
      expect(result.valid).toBe(true)
    })
  })
})
