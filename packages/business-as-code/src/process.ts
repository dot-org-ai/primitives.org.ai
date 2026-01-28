/**
 * Business process definition and management
 */

import type { ProcessDefinition, ProcessStep, ProcessMetric } from './types.js'

/**
 * Define a business process with steps, inputs, outputs, and metrics
 *
 * @example
 * ```ts
 * const process = Process({
 *   name: 'Customer Onboarding',
 *   description: 'Process for onboarding new customers',
 *   category: 'core',
 *   owner: 'Customer Success Team',
 *   steps: [
 *     {
 *       order: 1,
 *       name: 'Welcome Email',
 *       description: 'Send personalized welcome email',
 *       responsible: 'CS Manager',
 *       duration: '5 minutes',
 *       automationLevel: 'automated',
 *     },
 *     {
 *       order: 2,
 *       name: 'Initial Setup Call',
 *       description: 'Schedule and conduct setup call',
 *       responsible: 'CS Rep',
 *       duration: '30 minutes',
 *       automationLevel: 'manual',
 *     },
 *     {
 *       order: 3,
 *       name: 'Account Configuration',
 *       description: 'Configure customer account settings',
 *       responsible: 'CS Rep',
 *       duration: '15 minutes',
 *       automationLevel: 'semi-automated',
 *     },
 *   ],
 *   inputs: ['Customer Information', 'Subscription Plan'],
 *   outputs: ['Configured Account', 'Training Materials'],
 *   metrics: [
 *     {
 *       name: 'Time to First Value',
 *       description: 'Time from signup to first successful use',
 *       target: 24,
 *       unit: 'hours',
 *     },
 *     {
 *       name: 'Onboarding Completion Rate',
 *       description: 'Percentage of customers completing onboarding',
 *       target: 90,
 *       unit: 'percent',
 *     },
 *   ],
 * })
 * ```
 */
export function Process(definition: ProcessDefinition): ProcessDefinition {
  if (!definition.name) {
    throw new Error('Process name is required')
  }

  return {
    ...definition,
    category: definition.category || 'support',
    steps: definition.steps || [],
    inputs: definition.inputs || [],
    outputs: definition.outputs || [],
    metrics: definition.metrics || [],
    metadata: definition.metadata || {},
  }
}

/**
 * Get process steps in order
 */
export function getStepsInOrder(process: ProcessDefinition): ProcessStep[] {
  return [...(process.steps || [])].sort((a, b) => a.order - b.order)
}

/**
 * Get steps by automation level
 */
export function getStepsByAutomationLevel(
  process: ProcessDefinition,
  level: ProcessStep['automationLevel']
): ProcessStep[] {
  return process.steps?.filter((step) => step.automationLevel === level) || []
}

/**
 * Calculate total process duration in minutes
 */
export function calculateTotalDuration(process: ProcessDefinition): number {
  return (
    process.steps?.reduce((total, step) => {
      return total + parseDurationToMinutes(step.duration)
    }, 0) || 0
  )
}

/**
 * Parse duration string to minutes
 */
function parseDurationToMinutes(duration?: string): number {
  if (!duration) return 0

  const lower = duration.toLowerCase()
  const match = lower.match(/(\d+)\s*(minute|minutes|min|hour|hours|hr|day|days|week|weeks)/)
  if (!match) return 0

  const value = parseInt(match[1] || '0', 10)
  const unit = match[2]

  switch (unit) {
    case 'minute':
    case 'minutes':
    case 'min':
      return value
    case 'hour':
    case 'hours':
    case 'hr':
      return value * 60
    case 'day':
    case 'days':
      return value * 60 * 24
    case 'week':
    case 'weeks':
      return value * 60 * 24 * 7
    default:
      return 0
  }
}

/**
 * Format minutes to human-readable duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`
  } else if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} hours ${mins} minutes` : `${hours} hours`
  } else {
    const days = Math.floor(minutes / (60 * 24))
    const hours = Math.floor((minutes % (60 * 24)) / 60)
    return hours > 0 ? `${days} days ${hours} hours` : `${days} days`
  }
}

/**
 * Calculate automation percentage
 */
export function calculateAutomationPercentage(process: ProcessDefinition): number {
  if (!process.steps || process.steps.length === 0) return 0

  const automatedSteps = process.steps.filter(
    (step) => step.automationLevel === 'automated' || step.automationLevel === 'semi-automated'
  ).length

  return (automatedSteps / process.steps.length) * 100
}

/**
 * Get metric by name
 */
export function getMetric(process: ProcessDefinition, name: string): ProcessMetric | undefined {
  return process.metrics?.find((m) => m.name === name)
}

/**
 * Check if metric meets target
 */
export function meetsTarget(metric: ProcessMetric): boolean {
  if (metric.target === undefined || metric.current === undefined) return false
  return metric.current >= metric.target
}

/**
 * Calculate metric achievement percentage
 */
export function calculateMetricAchievement(metric: ProcessMetric): number {
  if (metric.target === undefined || metric.current === undefined) return 0
  if (metric.target === 0) return 100
  return (metric.current / metric.target) * 100
}

/**
 * Update metric current value
 */
export function updateMetric(
  process: ProcessDefinition,
  metricName: string,
  currentValue: number
): ProcessDefinition {
  const metrics = process.metrics?.map((m) =>
    m.name === metricName ? { ...m, current: currentValue } : m
  )

  const result: ProcessDefinition = { ...process }
  if (metrics !== undefined) result.metrics = metrics
  return result
}

/**
 * Add step to process
 */
export function addStep(process: ProcessDefinition, step: ProcessStep): ProcessDefinition {
  return {
    ...process,
    steps: [...(process.steps || []), step],
  }
}

/**
 * Remove step from process
 */
export function removeStep(process: ProcessDefinition, stepOrder: number): ProcessDefinition {
  const steps = process.steps?.filter((s) => s.order !== stepOrder)
  const result: ProcessDefinition = { ...process }
  if (steps !== undefined) result.steps = steps
  return result
}

/**
 * Validate process definition
 */
export function validateProcess(process: ProcessDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!process.name) {
    errors.push('Process name is required')
  }

  if (process.steps) {
    const orders = new Set<number>()
    for (const step of process.steps) {
      if (!step.name) {
        errors.push(`Step at order ${step.order} must have a name`)
      }
      if (orders.has(step.order)) {
        errors.push(`Duplicate step order: ${step.order}`)
      }
      orders.add(step.order)
    }
  }

  if (process.metrics) {
    for (const metric of process.metrics) {
      if (!metric.name) {
        errors.push('Metric must have a name')
      }
      if (metric.target !== undefined && metric.target < 0) {
        errors.push(`Metric ${metric.name} target cannot be negative`)
      }
      if (metric.current !== undefined && metric.current < 0) {
        errors.push(`Metric ${metric.name} current value cannot be negative`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
