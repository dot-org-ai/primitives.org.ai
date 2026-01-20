/**
 * Tests for okrs.ts - Objectives and Key Results management
 */

import { describe, it, expect } from 'vitest'
import {
  okrs,
  okr,
  calculateKeyResultProgress,
  calculateOKRProgress,
  calculateConfidence,
  updateKeyResult,
  isKeyResultOnTrack,
  isOKROnTrack,
  getKeyResultsOnTrack,
  getKeyResultsAtRisk,
  getOKRsByOwner,
  getOKRsByPeriod,
  getOKRsByStatus,
  calculateSuccessRate,
  formatKeyResult,
  compareOKRPerformance,
  validateOKRs,
} from './okrs.js'
import type { OKRDefinition, KeyResult } from './types.js'

describe('OKRs', () => {
  describe('okrs()', () => {
    it('should create multiple OKRs', () => {
      const okrList = okrs([
        {
          objective: 'Achieve Product-Market Fit',
          keyResults: [
            { description: 'Increase NPS', metric: 'NPS', startValue: 40, targetValue: 60 },
          ],
        },
        {
          objective: 'Grow Revenue 50% Quarter over Quarter',
          keyResults: [
            { description: 'Increase MRR', metric: 'MRR', startValue: 100000, targetValue: 150000 },
          ],
        },
      ])

      expect(okrList).toHaveLength(2)
      expect(okrList[0]?.objective).toBe('Achieve Product-Market Fit')
      expect(okrList[1]?.objective).toBe('Grow Revenue 50% Quarter over Quarter')
    })

    it('should normalize OKR defaults', () => {
      const okrList = okrs([
        {
          objective: 'Achieve Product-Market Fit',
          keyResults: [
            { description: 'Increase NPS', metric: 'NPS', startValue: 40, targetValue: 60, currentValue: 50 },
          ],
        },
      ])

      expect(okrList[0]?.status).toBe('not-started')
      expect(okrList[0]?.metadata).toEqual({})
      expect(okrList[0]?.keyResults?.[0]?.progress).toBe(50)
    })

    it('should throw error for OKR without objective', () => {
      expect(() => okrs([{ objective: '' }])).toThrow('OKR objective is required')
    })
  })

  describe('okr()', () => {
    it('should create a single OKR', () => {
      const singleOKR = okr({
        objective: 'Launch MVP by end of quarter',
        owner: 'Product Team',
        period: 'Q2 2024',
        keyResults: [
          { description: 'Complete core features', metric: 'Features', startValue: 0, targetValue: 5 },
        ],
      })

      expect(singleOKR.objective).toBe('Launch MVP by end of quarter')
      expect(singleOKR.owner).toBe('Product Team')
      expect(singleOKR.period).toBe('Q2 2024')
    })
  })

  describe('calculateKeyResultProgress()', () => {
    it('should calculate progress percentage', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', startValue: 0, targetValue: 100, currentValue: 50 }
      expect(calculateKeyResultProgress(kr)).toBe(50)
    })

    it('should handle starting value greater than zero', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', startValue: 40, targetValue: 60, currentValue: 50 }
      expect(calculateKeyResultProgress(kr)).toBe(50)
    })

    it('should return 0 for missing currentValue', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', startValue: 0, targetValue: 100 }
      expect(calculateKeyResultProgress(kr)).toBe(0)
    })

    it('should return 0 for missing startValue', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', targetValue: 100, currentValue: 50 }
      expect(calculateKeyResultProgress(kr)).toBe(0)
    })

    it('should return 100 when target equals start', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', startValue: 50, targetValue: 50, currentValue: 50 }
      expect(calculateKeyResultProgress(kr)).toBe(100)
    })

    it('should cap progress at 100', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', startValue: 0, targetValue: 100, currentValue: 150 }
      expect(calculateKeyResultProgress(kr)).toBe(100)
    })

    it('should cap progress at 0', () => {
      const kr: KeyResult = { description: 'Test', metric: 'NPS', startValue: 50, targetValue: 100, currentValue: 30 }
      expect(calculateKeyResultProgress(kr)).toBe(0)
    })

    it('should handle decreasing metrics (e.g., churn)', () => {
      // For metrics where lower is better (churn: 8% -> 4%), we should still
      // express them as start/target going down
      const kr: KeyResult = { description: 'Reduce churn', metric: 'Churn', startValue: 8, targetValue: 4, currentValue: 6 }
      expect(calculateKeyResultProgress(kr)).toBe(50)
    })
  })

  describe('calculateOKRProgress()', () => {
    it('should calculate average progress across key results', () => {
      const testOKR: OKRDefinition = {
        objective: 'Test Objective for Progress',
        keyResults: [
          { description: 'KR 1', metric: 'M1', startValue: 0, targetValue: 100, currentValue: 50, progress: 50 },
          { description: 'KR 2', metric: 'M2', startValue: 0, targetValue: 100, currentValue: 80, progress: 80 },
        ],
      }

      expect(calculateOKRProgress(testOKR)).toBe(65)
    })

    it('should return 0 for OKR without key results', () => {
      const testOKR: OKRDefinition = { objective: 'Test Objective for Progress' }
      expect(calculateOKRProgress(testOKR)).toBe(0)
    })

    it('should return 0 for empty key results', () => {
      const testOKR: OKRDefinition = { objective: 'Test Objective for Progress', keyResults: [] }
      expect(calculateOKRProgress(testOKR)).toBe(0)
    })

    it('should calculate progress from values when progress not set', () => {
      const testOKR: OKRDefinition = {
        objective: 'Test Objective for Progress',
        keyResults: [
          { description: 'KR 1', metric: 'M1', startValue: 0, targetValue: 100, currentValue: 50 },
          { description: 'KR 2', metric: 'M2', startValue: 0, targetValue: 100, currentValue: 100 },
        ],
      }

      expect(calculateOKRProgress(testOKR)).toBe(75)
    })
  })

  describe('calculateConfidence()', () => {
    it('should calculate confidence from key results', () => {
      const keyResults: KeyResult[] = [
        { description: 'KR 1', metric: 'M1', startValue: 0, targetValue: 100, currentValue: 70, progress: 70 },
        { description: 'KR 2', metric: 'M2', startValue: 0, targetValue: 100, currentValue: 80, progress: 80 },
      ]

      // Average progress = 75, confidence = 75 - 10 = 65
      expect(calculateConfidence(keyResults)).toBe(65)
    })

    it('should return 0 for empty key results', () => {
      expect(calculateConfidence([])).toBe(0)
    })

    it('should cap confidence at 0', () => {
      const keyResults: KeyResult[] = [
        { description: 'KR 1', metric: 'M1', progress: 5 },
      ]

      expect(calculateConfidence(keyResults)).toBe(0)
    })

    it('should cap confidence at 100', () => {
      const keyResults: KeyResult[] = [
        { description: 'KR 1', metric: 'M1', progress: 100 },
        { description: 'KR 2', metric: 'M2', progress: 100 },
      ]

      expect(calculateConfidence(keyResults)).toBe(90)
    })
  })

  describe('updateKeyResult()', () => {
    const testOKR: OKRDefinition = {
      objective: 'Test Objective for Update',
      keyResults: [
        { description: 'KR 1', metric: 'M1', startValue: 0, targetValue: 100, currentValue: 50, progress: 50 },
        { description: 'KR 2', metric: 'M2', startValue: 0, targetValue: 100, currentValue: 60, progress: 60 },
      ],
    }

    it('should update key result current value', () => {
      const updated = updateKeyResult(testOKR, 'KR 1', 75)
      const kr = updated.keyResults?.find(k => k.description === 'KR 1')

      expect(kr?.currentValue).toBe(75)
      expect(kr?.progress).toBe(75)
    })

    it('should not affect other key results', () => {
      const updated = updateKeyResult(testOKR, 'KR 1', 75)
      const kr2 = updated.keyResults?.find(k => k.description === 'KR 2')

      expect(kr2?.currentValue).toBe(60)
      expect(kr2?.progress).toBe(60)
    })

    it('should recalculate OKR confidence', () => {
      const updated = updateKeyResult(testOKR, 'KR 1', 100)

      // Progress for KR1 = 100, KR2 = 60, avg = 80
      // Confidence = 80 - 10 = 70
      expect(updated.confidence).toBe(70)
    })

    it('should handle non-existent key result', () => {
      const updated = updateKeyResult(testOKR, 'NonExistent', 75)
      expect(updated.keyResults).toHaveLength(2)
    })
  })

  describe('isKeyResultOnTrack()', () => {
    it('should return true for progress >= 70', () => {
      const kr: KeyResult = { description: 'Test', metric: 'M1', progress: 70 }
      expect(isKeyResultOnTrack(kr)).toBe(true)
    })

    it('should return true for progress > 70', () => {
      const kr: KeyResult = { description: 'Test', metric: 'M1', progress: 85 }
      expect(isKeyResultOnTrack(kr)).toBe(true)
    })

    it('should return false for progress < 70', () => {
      const kr: KeyResult = { description: 'Test', metric: 'M1', progress: 50 }
      expect(isKeyResultOnTrack(kr)).toBe(false)
    })

    it('should calculate progress if not set', () => {
      const kr: KeyResult = { description: 'Test', metric: 'M1', startValue: 0, targetValue: 100, currentValue: 80 }
      expect(isKeyResultOnTrack(kr)).toBe(true)
    })
  })

  describe('isOKROnTrack()', () => {
    it('should return true for high progress and confidence', () => {
      const testOKR: OKRDefinition = {
        objective: 'Test Objective On Track',
        keyResults: [
          { description: 'KR 1', metric: 'M1', progress: 80 },
          { description: 'KR 2', metric: 'M2', progress: 75 },
        ],
        confidence: 70,
      }

      expect(isOKROnTrack(testOKR)).toBe(true)
    })

    it('should return false for low progress', () => {
      const testOKR: OKRDefinition = {
        objective: 'Test Objective Low Progress',
        keyResults: [
          { description: 'KR 1', metric: 'M1', progress: 50 },
          { description: 'KR 2', metric: 'M2', progress: 40 },
        ],
        confidence: 70,
      }

      expect(isOKROnTrack(testOKR)).toBe(false)
    })

    it('should return false for low confidence', () => {
      const testOKR: OKRDefinition = {
        objective: 'Test Objective Low Confidence',
        keyResults: [
          { description: 'KR 1', metric: 'M1', progress: 80 },
          { description: 'KR 2', metric: 'M2', progress: 75 },
        ],
        confidence: 50,
      }

      expect(isOKROnTrack(testOKR)).toBe(false)
    })
  })

  describe('getKeyResultsOnTrack()', () => {
    const testOKR: OKRDefinition = {
      objective: 'Test Objective with Mixed KRs',
      keyResults: [
        { description: 'High progress KR', metric: 'M1', progress: 80 },
        { description: 'Low progress KR', metric: 'M2', progress: 50 },
        { description: 'On track KR', metric: 'M3', progress: 70 },
      ],
    }

    it('should return key results with progress >= 70', () => {
      const onTrack = getKeyResultsOnTrack(testOKR)

      expect(onTrack).toHaveLength(2)
      expect(onTrack[0]?.description).toBe('High progress KR')
      expect(onTrack[1]?.description).toBe('On track KR')
    })

    it('should return empty array for OKR without key results', () => {
      const emptyOKR: OKRDefinition = { objective: 'Empty OKR for Filter' }
      expect(getKeyResultsOnTrack(emptyOKR)).toEqual([])
    })
  })

  describe('getKeyResultsAtRisk()', () => {
    const testOKR: OKRDefinition = {
      objective: 'Test Objective with At-Risk KRs',
      keyResults: [
        { description: 'High progress KR', metric: 'M1', progress: 80 },
        { description: 'Low progress KR', metric: 'M2', progress: 50 },
        { description: 'At risk KR', metric: 'M3', progress: 30 },
      ],
    }

    it('should return key results with progress < 70', () => {
      const atRisk = getKeyResultsAtRisk(testOKR)

      expect(atRisk).toHaveLength(2)
      expect(atRisk[0]?.description).toBe('Low progress KR')
      expect(atRisk[1]?.description).toBe('At risk KR')
    })

    it('should return empty array for OKR without key results', () => {
      const emptyOKR: OKRDefinition = { objective: 'Empty OKR for At-Risk' }
      expect(getKeyResultsAtRisk(emptyOKR)).toEqual([])
    })
  })

  describe('getOKRsByOwner()', () => {
    const okrList: OKRDefinition[] = [
      { objective: 'Engineering Objective One', owner: 'Engineering' },
      { objective: 'Sales Objective One Item', owner: 'Sales' },
      { objective: 'Engineering Objective Two', owner: 'Engineering' },
    ]

    it('should filter OKRs by owner', () => {
      const engineering = getOKRsByOwner(okrList, 'Engineering')

      expect(engineering).toHaveLength(2)
      expect(engineering[0]?.objective).toBe('Engineering Objective One')
      expect(engineering[1]?.objective).toBe('Engineering Objective Two')
    })

    it('should return empty array for non-existent owner', () => {
      const marketing = getOKRsByOwner(okrList, 'Marketing')
      expect(marketing).toHaveLength(0)
    })
  })

  describe('getOKRsByPeriod()', () => {
    const okrList: OKRDefinition[] = [
      { objective: 'Q1 Objective Example', period: 'Q1 2024' },
      { objective: 'Q2 Objective Example', period: 'Q2 2024' },
      { objective: 'Q1 Objective Second', period: 'Q1 2024' },
    ]

    it('should filter OKRs by period', () => {
      const q1 = getOKRsByPeriod(okrList, 'Q1 2024')

      expect(q1).toHaveLength(2)
      expect(q1[0]?.objective).toBe('Q1 Objective Example')
      expect(q1[1]?.objective).toBe('Q1 Objective Second')
    })

    it('should return empty array for non-existent period', () => {
      const q4 = getOKRsByPeriod(okrList, 'Q4 2024')
      expect(q4).toHaveLength(0)
    })
  })

  describe('getOKRsByStatus()', () => {
    const okrList: OKRDefinition[] = [
      { objective: 'On Track Objective Example', status: 'on-track' },
      { objective: 'At Risk Objective Example', status: 'at-risk' },
      { objective: 'On Track Objective Second', status: 'on-track' },
      { objective: 'Completed Objective Done', status: 'completed' },
    ]

    it('should filter OKRs by status', () => {
      const onTrack = getOKRsByStatus(okrList, 'on-track')

      expect(onTrack).toHaveLength(2)
      expect(onTrack[0]?.objective).toBe('On Track Objective Example')
      expect(onTrack[1]?.objective).toBe('On Track Objective Second')
    })

    it('should return empty array for non-existent status', () => {
      const notStarted = getOKRsByStatus(okrList, 'not-started')
      expect(notStarted).toHaveLength(0)
    })
  })

  describe('calculateSuccessRate()', () => {
    it('should calculate average progress across OKRs', () => {
      const okrList: OKRDefinition[] = [
        {
          objective: 'OKR 1 for Success Rate',
          keyResults: [
            { description: 'KR 1', metric: 'M1', progress: 80 },
          ],
        },
        {
          objective: 'OKR 2 for Success Rate',
          keyResults: [
            { description: 'KR 1', metric: 'M1', progress: 60 },
          ],
        },
      ]

      expect(calculateSuccessRate(okrList)).toBe(70)
    })

    it('should return 0 for empty OKR list', () => {
      expect(calculateSuccessRate([])).toBe(0)
    })
  })

  describe('formatKeyResult()', () => {
    it('should format key result for display', () => {
      const kr: KeyResult = {
        description: 'Increase NPS',
        metric: 'NPS',
        startValue: 40,
        targetValue: 60,
        currentValue: 50,
        unit: 'score',
        progress: 50,
      }

      const formatted = formatKeyResult(kr)
      expect(formatted).toBe('Increase NPS: 50/60 score (50%)')
    })

    it('should handle missing progress', () => {
      const kr: KeyResult = {
        description: 'Increase NPS',
        metric: 'NPS',
        startValue: 40,
        targetValue: 60,
        currentValue: 50,
        unit: 'score',
      }

      const formatted = formatKeyResult(kr)
      expect(formatted).toBe('Increase NPS: 50/60 score (50%)')
    })

    it('should handle missing unit', () => {
      const kr: KeyResult = {
        description: 'Increase NPS',
        metric: 'NPS',
        startValue: 40,
        targetValue: 60,
        currentValue: 50,
        progress: 50,
      }

      const formatted = formatKeyResult(kr)
      expect(formatted).toBe('Increase NPS: 50/60  (50%)')
    })
  })

  describe('compareOKRPerformance()', () => {
    it('should compare OKR performance between periods', () => {
      const current: OKRDefinition = {
        objective: 'Current Period Objective',
        keyResults: [{ description: 'KR 1', metric: 'M1', progress: 80 }],
        confidence: 70,
      }

      const previous: OKRDefinition = {
        objective: 'Previous Period Objective',
        keyResults: [{ description: 'KR 1', metric: 'M1', progress: 60 }],
        confidence: 60,
      }

      const comparison = compareOKRPerformance(current, previous)

      expect(comparison.progressDelta).toBe(20)
      expect(comparison.confidenceDelta).toBe(10)
      expect(comparison.improved).toBe(true)
    })

    it('should detect regression', () => {
      const current: OKRDefinition = {
        objective: 'Current Period Regression',
        keyResults: [{ description: 'KR 1', metric: 'M1', progress: 50 }],
        confidence: 40,
      }

      const previous: OKRDefinition = {
        objective: 'Previous Period Regression',
        keyResults: [{ description: 'KR 1', metric: 'M1', progress: 70 }],
        confidence: 60,
      }

      const comparison = compareOKRPerformance(current, previous)

      expect(comparison.progressDelta).toBe(-20)
      expect(comparison.confidenceDelta).toBe(-20)
      expect(comparison.improved).toBe(false)
    })
  })

  describe('validateOKRs()', () => {
    it('should validate valid OKRs', () => {
      const okrList: OKRDefinition[] = [
        {
          objective: 'Valid Objective with Proper Length',
          keyResults: [
            { description: 'KR 1', metric: 'M1', progress: 50 },
            { description: 'KR 2', metric: 'M2', progress: 60 },
          ],
          confidence: 50,
        },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail if objective is missing', () => {
      const okrList: OKRDefinition[] = [{ objective: '' }]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('OKR objective is required')
    })

    it('should fail if objective is too short', () => {
      const okrList: OKRDefinition[] = [{ objective: 'Short' }]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('OKR objective "Short" should be at least 10 characters')
    })

    it('should fail if confidence is out of range', () => {
      const okrList: OKRDefinition[] = [
        { objective: 'Valid Objective for Confidence Test', confidence: 150 },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('OKR "Valid Objective for Confidence Test" confidence must be between 0 and 100')
    })

    it('should fail if key results array is empty', () => {
      const okrList: OKRDefinition[] = [
        { objective: 'Objective with Empty Key Results', keyResults: [] },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('OKR "Objective with Empty Key Results" must have at least one key result')
    })

    it('should fail if too many key results', () => {
      const okrList: OKRDefinition[] = [
        {
          objective: 'Objective with Too Many Key Results',
          keyResults: [
            { description: 'KR 1', metric: 'M1' },
            { description: 'KR 2', metric: 'M2' },
            { description: 'KR 3', metric: 'M3' },
            { description: 'KR 4', metric: 'M4' },
            { description: 'KR 5', metric: 'M5' },
            { description: 'KR 6', metric: 'M6' },
          ],
        },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('OKR "Objective with Too Many Key Results" should have no more than 5 key results')
    })

    it('should fail if key result description is missing', () => {
      const okrList: OKRDefinition[] = [
        {
          objective: 'Objective with Invalid Key Result',
          keyResults: [{ description: '', metric: 'M1' }],
        },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Key result in OKR "Objective with Invalid Key Result" must have a description')
    })

    it('should fail if key result metric is missing', () => {
      const okrList: OKRDefinition[] = [
        {
          objective: 'Objective with Missing Metric',
          keyResults: [{ description: 'KR 1', metric: '' }],
        },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Key result "KR 1" must have a metric')
    })

    it('should fail if key result progress is out of range', () => {
      const okrList: OKRDefinition[] = [
        {
          objective: 'Objective with Invalid Progress',
          keyResults: [{ description: 'KR 1', metric: 'M1', progress: 150 }],
        },
      ]

      const result = validateOKRs(okrList)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Key result "KR 1" progress must be between 0 and 100')
    })
  })
})
