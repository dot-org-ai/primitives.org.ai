/**
 * Tests for process.ts - Business process definition and management
 */

import { describe, it, expect } from 'vitest'
import {
  Process,
  getStepsInOrder,
  getStepsByAutomationLevel,
  calculateTotalDuration,
  formatDuration,
  calculateAutomationPercentage,
  getMetric,
  meetsTarget,
  calculateMetricAchievement,
  updateMetric,
  addStep,
  removeStep,
  validateProcess,
} from '../src/process.js'
import type { ProcessDefinition, ProcessStep, ProcessMetric } from '../src/types.js'

describe('Process', () => {
  describe('Process()', () => {
    it('should create a process with required fields', () => {
      const process = Process({ name: 'Test Process' })

      expect(process.name).toBe('Test Process')
      expect(process.category).toBe('support')
      expect(process.steps).toEqual([])
      expect(process.inputs).toEqual([])
      expect(process.outputs).toEqual([])
      expect(process.metrics).toEqual([])
      expect(process.metadata).toEqual({})
    })

    it('should create a process with all fields', () => {
      const process = Process({
        name: 'Customer Onboarding',
        description: 'Onboard new customers',
        category: 'core',
        owner: 'Customer Success',
        steps: [
          { order: 1, name: 'Welcome Email', automationLevel: 'automated' },
          { order: 2, name: 'Setup Call', automationLevel: 'manual' },
        ],
        inputs: ['Customer Info', 'Subscription Plan'],
        outputs: ['Configured Account'],
        metrics: [{ name: 'Time to Value', target: 24, unit: 'hours' }],
        metadata: { version: 1 },
      })

      expect(process.name).toBe('Customer Onboarding')
      expect(process.category).toBe('core')
      expect(process.steps).toHaveLength(2)
      expect(process.inputs).toHaveLength(2)
      expect(process.outputs).toHaveLength(1)
      expect(process.metrics).toHaveLength(1)
    })

    it('should throw error if name is missing', () => {
      expect(() => Process({ name: '' })).toThrow('Process name is required')
    })
  })

  describe('getStepsInOrder()', () => {
    const process = Process({
      name: 'Test',
      steps: [
        { order: 3, name: 'Third' },
        { order: 1, name: 'First' },
        { order: 2, name: 'Second' },
      ],
    })

    it('should return steps sorted by order', () => {
      const sorted = getStepsInOrder(process)

      expect(sorted[0]?.name).toBe('First')
      expect(sorted[1]?.name).toBe('Second')
      expect(sorted[2]?.name).toBe('Third')
    })

    it('should handle empty steps', () => {
      const emptyProcess = Process({ name: 'Empty' })
      const sorted = getStepsInOrder(emptyProcess)

      expect(sorted).toEqual([])
    })
  })

  describe('getStepsByAutomationLevel()', () => {
    const process = Process({
      name: 'Test',
      steps: [
        { order: 1, name: 'Step 1', automationLevel: 'automated' },
        { order: 2, name: 'Step 2', automationLevel: 'manual' },
        { order: 3, name: 'Step 3', automationLevel: 'automated' },
        { order: 4, name: 'Step 4', automationLevel: 'semi-automated' },
      ],
    })

    it('should filter by automated level', () => {
      const automated = getStepsByAutomationLevel(process, 'automated')

      expect(automated).toHaveLength(2)
      expect(automated[0]?.name).toBe('Step 1')
      expect(automated[1]?.name).toBe('Step 3')
    })

    it('should filter by manual level', () => {
      const manual = getStepsByAutomationLevel(process, 'manual')

      expect(manual).toHaveLength(1)
      expect(manual[0]?.name).toBe('Step 2')
    })

    it('should return empty for non-existent level', () => {
      const emptyProcess = Process({ name: 'Empty' })
      const result = getStepsByAutomationLevel(emptyProcess, 'automated')

      expect(result).toEqual([])
    })
  })

  describe('calculateTotalDuration()', () => {
    it('should calculate total duration in minutes', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1', duration: '5 minutes' },
          { order: 2, name: 'Step 2', duration: '30 minutes' },
          { order: 3, name: 'Step 3', duration: '1 hour' },
        ],
      })

      expect(calculateTotalDuration(process)).toBe(95)
    })

    it('should handle hours', () => {
      const process = Process({
        name: 'Test',
        steps: [{ order: 1, name: 'Step 1', duration: '2 hours' }],
      })

      expect(calculateTotalDuration(process)).toBe(120)
    })

    it('should handle days', () => {
      const process = Process({
        name: 'Test',
        steps: [{ order: 1, name: 'Step 1', duration: '1 day' }],
      })

      expect(calculateTotalDuration(process)).toBe(1440)
    })

    it('should handle weeks', () => {
      const process = Process({
        name: 'Test',
        steps: [{ order: 1, name: 'Step 1', duration: '1 week' }],
      })

      expect(calculateTotalDuration(process)).toBe(10080)
    })

    it('should handle missing duration', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1' },
          { order: 2, name: 'Step 2', duration: '10 minutes' },
        ],
      })

      expect(calculateTotalDuration(process)).toBe(10)
    })

    it('should return 0 for empty steps', () => {
      const process = Process({ name: 'Test' })
      expect(calculateTotalDuration(process)).toBe(0)
    })

    it('should handle singular/plural units', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1', duration: '1 minute' },
          { order: 2, name: 'Step 2', duration: '1 hour' },
          { order: 3, name: 'Step 3', duration: '1 day' },
        ],
      })

      expect(calculateTotalDuration(process)).toBe(1 + 60 + 1440)
    })

    it('should handle abbreviations', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1', duration: '5 min' },
          { order: 2, name: 'Step 2', duration: '1 hr' },
        ],
      })

      expect(calculateTotalDuration(process)).toBe(65)
    })
  })

  describe('formatDuration()', () => {
    it('should format minutes', () => {
      expect(formatDuration(45)).toBe('45 minutes')
    })

    it('should format hours', () => {
      expect(formatDuration(120)).toBe('2 hours')
    })

    it('should format hours and minutes', () => {
      expect(formatDuration(150)).toBe('2 hours 30 minutes')
    })

    it('should format days', () => {
      expect(formatDuration(2880)).toBe('2 days')
    })

    it('should format days and hours', () => {
      expect(formatDuration(1560)).toBe('1 days 2 hours')
    })
  })

  describe('calculateAutomationPercentage()', () => {
    it('should calculate percentage of automated steps', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1', automationLevel: 'automated' },
          { order: 2, name: 'Step 2', automationLevel: 'automated' },
          { order: 3, name: 'Step 3', automationLevel: 'manual' },
          { order: 4, name: 'Step 4', automationLevel: 'semi-automated' },
        ],
      })

      expect(calculateAutomationPercentage(process)).toBe(75)
    })

    it('should return 0 for empty steps', () => {
      const process = Process({ name: 'Test' })
      expect(calculateAutomationPercentage(process)).toBe(0)
    })

    it('should return 100 for fully automated process', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1', automationLevel: 'automated' },
          { order: 2, name: 'Step 2', automationLevel: 'semi-automated' },
        ],
      })

      expect(calculateAutomationPercentage(process)).toBe(100)
    })

    it('should return 0 for fully manual process', () => {
      const process = Process({
        name: 'Test',
        steps: [
          { order: 1, name: 'Step 1', automationLevel: 'manual' },
          { order: 2, name: 'Step 2', automationLevel: 'manual' },
        ],
      })

      expect(calculateAutomationPercentage(process)).toBe(0)
    })
  })

  describe('getMetric()', () => {
    const process = Process({
      name: 'Test',
      metrics: [
        { name: 'Time to Value', target: 24 },
        { name: 'Completion Rate', target: 90 },
      ],
    })

    it('should find metric by name', () => {
      const metric = getMetric(process, 'Time to Value')

      expect(metric?.name).toBe('Time to Value')
      expect(metric?.target).toBe(24)
    })

    it('should return undefined for non-existent metric', () => {
      const metric = getMetric(process, 'NonExistent')
      expect(metric).toBeUndefined()
    })
  })

  describe('meetsTarget()', () => {
    it('should return true when current meets target', () => {
      const metric: ProcessMetric = { name: 'Test', target: 90, current: 95 }
      expect(meetsTarget(metric)).toBe(true)
    })

    it('should return true when current equals target', () => {
      const metric: ProcessMetric = { name: 'Test', target: 90, current: 90 }
      expect(meetsTarget(metric)).toBe(true)
    })

    it('should return false when current is below target', () => {
      const metric: ProcessMetric = { name: 'Test', target: 90, current: 85 }
      expect(meetsTarget(metric)).toBe(false)
    })

    it('should return false when target is undefined', () => {
      const metric: ProcessMetric = { name: 'Test', current: 90 }
      expect(meetsTarget(metric)).toBe(false)
    })

    it('should return false when current is undefined', () => {
      const metric: ProcessMetric = { name: 'Test', target: 90 }
      expect(meetsTarget(metric)).toBe(false)
    })
  })

  describe('calculateMetricAchievement()', () => {
    it('should calculate achievement percentage', () => {
      const metric: ProcessMetric = { name: 'Test', target: 100, current: 75 }
      expect(calculateMetricAchievement(metric)).toBe(75)
    })

    it('should handle over-achievement', () => {
      const metric: ProcessMetric = { name: 'Test', target: 100, current: 150 }
      expect(calculateMetricAchievement(metric)).toBe(150)
    })

    it('should return 100 when target is 0', () => {
      const metric: ProcessMetric = { name: 'Test', target: 0, current: 50 }
      expect(calculateMetricAchievement(metric)).toBe(100)
    })

    it('should return 0 when values are undefined', () => {
      const metric: ProcessMetric = { name: 'Test' }
      expect(calculateMetricAchievement(metric)).toBe(0)
    })
  })

  describe('updateMetric()', () => {
    const process = Process({
      name: 'Test',
      metrics: [
        { name: 'Metric 1', target: 100, current: 50 },
        { name: 'Metric 2', target: 200, current: 100 },
      ],
    })

    it('should update metric current value', () => {
      const updated = updateMetric(process, 'Metric 1', 75)
      const metric = updated.metrics?.find((m) => m.name === 'Metric 1')

      expect(metric?.current).toBe(75)
    })

    it('should not affect other metrics', () => {
      const updated = updateMetric(process, 'Metric 1', 75)
      const metric2 = updated.metrics?.find((m) => m.name === 'Metric 2')

      expect(metric2?.current).toBe(100)
    })

    it('should handle non-existent metric', () => {
      const updated = updateMetric(process, 'NonExistent', 75)
      expect(updated.metrics).toHaveLength(2)
    })
  })

  describe('addStep()', () => {
    it('should add step to process', () => {
      const process = Process({
        name: 'Test',
        steps: [{ order: 1, name: 'First' }],
      })

      const updated = addStep(process, { order: 2, name: 'Second' })

      expect(updated.steps).toHaveLength(2)
      expect(updated.steps?.[1]?.name).toBe('Second')
    })

    it('should add step to empty process', () => {
      const process = Process({ name: 'Test' })
      const updated = addStep(process, { order: 1, name: 'First' })

      expect(updated.steps).toHaveLength(1)
    })
  })

  describe('removeStep()', () => {
    const process = Process({
      name: 'Test',
      steps: [
        { order: 1, name: 'First' },
        { order: 2, name: 'Second' },
        { order: 3, name: 'Third' },
      ],
    })

    it('should remove step by order', () => {
      const updated = removeStep(process, 2)

      expect(updated.steps).toHaveLength(2)
      expect(updated.steps?.find((s) => s.order === 2)).toBeUndefined()
    })

    it('should handle removing non-existent step', () => {
      const updated = removeStep(process, 99)
      expect(updated.steps).toHaveLength(3)
    })
  })

  describe('validateProcess()', () => {
    it('should validate valid process', () => {
      const process: ProcessDefinition = {
        name: 'Valid Process',
        steps: [
          { order: 1, name: 'Step 1' },
          { order: 2, name: 'Step 2' },
        ],
        metrics: [{ name: 'Metric 1', target: 100, current: 50 }],
      }

      const result = validateProcess(process)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail if name is missing', () => {
      const process: ProcessDefinition = { name: '' }

      const result = validateProcess(process)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Process name is required')
    })

    it('should fail if step has no name', () => {
      const process: ProcessDefinition = {
        name: 'Test',
        steps: [{ order: 1, name: '' }],
      }

      const result = validateProcess(process)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Step at order 1 must have a name')
    })

    it('should fail for duplicate step orders', () => {
      const process: ProcessDefinition = {
        name: 'Test',
        steps: [
          { order: 1, name: 'First' },
          { order: 1, name: 'Duplicate' },
        ],
      }

      const result = validateProcess(process)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate step order: 1')
    })

    it('should fail if metric has no name', () => {
      const process: ProcessDefinition = {
        name: 'Test',
        metrics: [{ name: '', target: 100 }],
      }

      const result = validateProcess(process)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Metric must have a name')
    })

    it('should fail if metric target is negative', () => {
      const process: ProcessDefinition = {
        name: 'Test',
        metrics: [{ name: 'Test Metric', target: -10 }],
      }

      const result = validateProcess(process)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Metric Test Metric target cannot be negative')
    })

    it('should fail if metric current is negative', () => {
      const process: ProcessDefinition = {
        name: 'Test',
        metrics: [{ name: 'Test Metric', target: 100, current: -5 }],
      }

      const result = validateProcess(process)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Metric Test Metric current value cannot be negative')
    })
  })
})
