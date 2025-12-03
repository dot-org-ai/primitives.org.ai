/**
 * Vision statement definition
 */

import type { VisionDefinition } from './types.js'

/**
 * Define a business vision statement with timeframe and success indicators
 *
 * @example
 * ```ts
 * const vision = Vision({
 *   statement: 'To become the world\'s most trusted widget platform',
 *   timeframe: '5 years',
 *   successIndicators: [
 *     '10M+ active users',
 *     'Present in 50+ countries',
 *     'Industry-leading NPS score',
 *     '$1B+ annual revenue',
 *   ],
 * })
 * ```
 */
export function Vision(definition: VisionDefinition): VisionDefinition {
  // Validate required fields
  if (!definition.statement) {
    throw new Error('Vision statement is required')
  }

  // Return validated vision definition
  return {
    ...definition,
    successIndicators: definition.successIndicators || [],
    metadata: definition.metadata || {},
  }
}

/**
 * Check if a success indicator has been achieved
 */
export function checkIndicator(
  vision: VisionDefinition,
  indicator: string,
  currentMetrics: Record<string, number | boolean>
): boolean {
  // Simple check - would need more sophisticated parsing in production
  return Object.entries(currentMetrics).some(([key, value]) => {
    return indicator.toLowerCase().includes(key.toLowerCase()) && Boolean(value)
  })
}

/**
 * Calculate vision progress based on achieved indicators
 */
export function calculateProgress(
  vision: VisionDefinition,
  currentMetrics: Record<string, number | boolean>
): number {
  if (!vision.successIndicators || vision.successIndicators.length === 0) {
    return 0
  }

  const achieved = vision.successIndicators.filter(indicator =>
    checkIndicator(vision, indicator, currentMetrics)
  ).length

  return (achieved / vision.successIndicators.length) * 100
}

/**
 * Validate vision definition
 */
export function validateVision(vision: VisionDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!vision.statement) {
    errors.push('Vision statement is required')
  }

  if (vision.statement && vision.statement.length < 10) {
    errors.push('Vision statement should be at least 10 characters')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
