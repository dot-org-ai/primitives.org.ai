/**
 * Objectives and Key Results (OKRs) management
 *
 * Uses org.ai OKR types for standardized OKR definitions across the ecosystem.
 */

import type { OKRDefinition, KeyResult } from './types.js'
import type { OKR as OrgOKR, KeyResult as OrgKeyResult, OKRStatus, KeyResultStatus } from 'org.ai'

// Re-export org.ai OKR types for convenience
export type { OrgOKR, OrgKeyResult, OKRStatus, KeyResultStatus }

/**
 * Convert a business-as-code KeyResult to an org.ai KeyResult
 *
 * @param kr - Business key result
 * @param id - Optional identifier
 * @returns org.ai KeyResult object
 */
export function toOrgKeyResult(kr: KeyResult, id?: string): OrgKeyResult {
  const result: OrgKeyResult = {
    description: kr.description,
  }
  if (id !== undefined) result.id = id
  if (kr.description) result.name = kr.description
  if (kr.metric !== undefined) result.metric = kr.metric
  if (kr.startValue !== undefined) result.startValue = kr.startValue
  if (kr.targetValue !== undefined) {
    result.targetValue = kr.targetValue
    result.target = kr.targetValue
  }
  if (kr.currentValue !== undefined) {
    result.currentValue = kr.currentValue
    result.current = kr.currentValue
  }
  if (kr.unit !== undefined) result.unit = kr.unit
  if (kr.progress !== undefined) result.progress = kr.progress
  return result
}

/**
 * Convert an org.ai KeyResult to a business-as-code KeyResult
 *
 * @param kr - org.ai KeyResult object
 * @returns Business key result
 */
export function fromOrgKeyResult(kr: OrgKeyResult): KeyResult {
  const result: KeyResult = {
    description: kr.description || kr.name || '',
    metric: kr.metric || '',
    targetValue: kr.targetValue ?? kr.target ?? 0,
  }
  if (kr.startValue !== undefined) result.startValue = kr.startValue
  if (kr.currentValue !== undefined) result.currentValue = kr.currentValue
  else if (kr.current !== undefined) result.currentValue = kr.current
  if (kr.unit !== undefined) result.unit = kr.unit
  if (kr.progress !== undefined) result.progress = kr.progress
  return result
}

/**
 * Convert a business-as-code OKRDefinition to an org.ai OKR
 *
 * @param definition - Business OKR definition
 * @param id - Optional unique identifier
 * @returns org.ai OKR object
 */
export function toOrgOKR(definition: OKRDefinition, id?: string): OrgOKR {
  const result: OrgOKR = {
    objective: definition.objective,
    keyResults: definition.keyResults?.map((kr, i) => toOrgKeyResult(kr, `${id}_kr_${i}`)) || [],
  }
  if (id !== undefined) result.id = id
  if (definition.description !== undefined) result.description = definition.description
  if (definition.owner !== undefined) result.owner = definition.owner
  if (definition.period !== undefined) result.period = definition.period
  if (definition.status !== undefined) result.status = definition.status as OKRStatus
  result.progress = calculateOKRProgress(definition)
  if (definition.confidence !== undefined) result.confidence = definition.confidence
  if (definition.metadata !== undefined) result.metadata = definition.metadata
  return result
}

/**
 * Convert an org.ai OKR to a business-as-code OKRDefinition
 *
 * @param okr - org.ai OKR object
 * @returns Business OKR definition
 */
export function fromOrgOKR(okr: OrgOKR): OKRDefinition {
  const result: OKRDefinition = {
    objective: okr.objective,
    keyResults: okr.keyResults.map(fromOrgKeyResult),
  }
  if (okr.description !== undefined) result.description = okr.description
  if (okr.owner !== undefined) result.owner = okr.owner
  if (okr.period !== undefined) result.period = okr.period
  const st = okr.status
  if (st !== undefined) result.status = st as NonNullable<OKRDefinition['status']>
  if (okr.confidence !== undefined) result.confidence = okr.confidence
  if (okr.metadata !== undefined) result.metadata = okr.metadata
  return result
}

/**
 * Define Objectives and Key Results for goal tracking
 *
 * @example
 * ```ts
 * const quarterlyOKRs = okrs([
 *   {
 *     objective: 'Achieve Product-Market Fit',
 *     description: 'Validate that our product solves a real problem for customers',
 *     period: 'Q2 2024',
 *     owner: 'CEO',
 *     keyResults: [
 *       {
 *         description: 'Increase Net Promoter Score',
 *         metric: 'NPS',
 *         startValue: 40,
 *         targetValue: 60,
 *         currentValue: 52,
 *         unit: 'score',
 *         progress: 60,
 *       },
 *       {
 *         description: 'Reduce monthly churn rate',
 *         metric: 'Churn Rate',
 *         startValue: 8,
 *         targetValue: 4,
 *         currentValue: 5.5,
 *         unit: 'percent',
 *         progress: 62.5,
 *       },
 *       {
 *         description: 'Achieve customer retention',
 *         metric: 'Customers with 3+ months',
 *         startValue: 50,
 *         targetValue: 200,
 *         currentValue: 125,
 *         unit: 'customers',
 *         progress: 50,
 *       },
 *     ],
 *     status: 'on-track',
 *     confidence: 75,
 *   },
 * ])
 * ```
 */
export function okrs(definitions: OKRDefinition[]): OKRDefinition[] {
  return definitions.map((okr) => validateAndNormalizeOKR(okr))
}

/**
 * Define a single OKR
 */
export function okr(definition: OKRDefinition): OKRDefinition {
  return validateAndNormalizeOKR(definition)
}

/**
 * Validate and normalize an OKR definition
 */
function validateAndNormalizeOKR(okr: OKRDefinition): OKRDefinition {
  if (!okr.objective) {
    throw new Error('OKR objective is required')
  }

  // Calculate progress for key results if not set
  const keyResults = okr.keyResults?.map((kr) => ({
    ...kr,
    progress: kr.progress ?? calculateKeyResultProgress(kr),
  }))

  return {
    ...okr,
    keyResults,
    status: okr.status || 'not-started',
    confidence: okr.confidence ?? calculateConfidence(keyResults || []),
    metadata: okr.metadata || {},
  }
}

/**
 * Calculate key result progress
 */
export function calculateKeyResultProgress(kr: KeyResult): number {
  if (kr.currentValue === undefined || kr.startValue === undefined) return 0

  const total = kr.targetValue - kr.startValue
  if (total === 0) return 100

  const current = kr.currentValue - kr.startValue
  const progress = (current / total) * 100

  return Math.max(0, Math.min(100, progress))
}

/**
 * Calculate overall OKR progress
 */
export function calculateOKRProgress(okr: OKRDefinition): number {
  if (!okr.keyResults || okr.keyResults.length === 0) return 0

  const totalProgress = okr.keyResults.reduce((sum, kr) => {
    return sum + (kr.progress ?? calculateKeyResultProgress(kr))
  }, 0)

  return totalProgress / okr.keyResults.length
}

/**
 * Calculate confidence score based on key results
 */
export function calculateConfidence(keyResults: KeyResult[]): number {
  if (keyResults.length === 0) return 0

  const totalProgress = keyResults.reduce((sum, kr) => {
    return sum + (kr.progress ?? calculateKeyResultProgress(kr))
  }, 0)

  const avgProgress = totalProgress / keyResults.length

  // Confidence tends to be slightly lower than actual progress
  return Math.max(0, Math.min(100, avgProgress - 10))
}

/**
 * Update key result current value
 */
export function updateKeyResult(
  okr: OKRDefinition,
  krDescription: string,
  currentValue: number
): OKRDefinition {
  const keyResults = okr.keyResults?.map((kr) => {
    if (kr.description === krDescription) {
      const updatedKR = { ...kr, currentValue }
      return {
        ...updatedKR,
        progress: calculateKeyResultProgress(updatedKR),
      }
    }
    return kr
  })

  // Recalculate overall status and confidence
  const progress = calculateOKRProgress({ ...okr, keyResults })
  const status = determineOKRStatus(progress, okr.confidence || 0)

  return {
    ...okr,
    keyResults,
    status,
    confidence: calculateConfidence(keyResults || []),
  }
}

/**
 * Determine OKR status based on progress and confidence
 */
function determineOKRStatus(progress: number, confidence: number): OKRDefinition['status'] {
  if (progress === 0) return 'not-started'
  if (progress === 100) return 'completed'
  if (confidence < 50 || progress < 30) return 'at-risk'
  return 'on-track'
}

/**
 * Check if key result is on track
 */
export function isKeyResultOnTrack(kr: KeyResult): boolean {
  const progress = kr.progress ?? calculateKeyResultProgress(kr)
  return progress >= 70
}

/**
 * Check if OKR is on track
 */
export function isOKROnTrack(okr: OKRDefinition): boolean {
  const progress = calculateOKRProgress(okr)
  return progress >= 70 && (okr.confidence ?? 0) >= 60
}

/**
 * Get key results that are on track
 */
export function getKeyResultsOnTrack(okr: OKRDefinition): KeyResult[] {
  return okr.keyResults?.filter(isKeyResultOnTrack) || []
}

/**
 * Get key results that are at risk
 */
export function getKeyResultsAtRisk(okr: OKRDefinition): KeyResult[] {
  return okr.keyResults?.filter((kr) => !isKeyResultOnTrack(kr)) || []
}

/**
 * Get OKRs by owner
 */
export function getOKRsByOwner(okrs: OKRDefinition[], owner: string): OKRDefinition[] {
  return okrs.filter((okr) => okr.owner === owner)
}

/**
 * Get OKRs by period
 */
export function getOKRsByPeriod(okrs: OKRDefinition[], period: string): OKRDefinition[] {
  return okrs.filter((okr) => okr.period === period)
}

/**
 * Get OKRs by status
 */
export function getOKRsByStatus(
  okrs: OKRDefinition[],
  status: OKRDefinition['status']
): OKRDefinition[] {
  return okrs.filter((okr) => okr.status === status)
}

/**
 * Calculate success rate across all OKRs
 */
export function calculateSuccessRate(okrs: OKRDefinition[]): number {
  if (okrs.length === 0) return 0

  const avgProgress =
    okrs.reduce((sum, okr) => {
      return sum + calculateOKRProgress(okr)
    }, 0) / okrs.length

  return avgProgress
}

/**
 * Format key result for display
 */
export function formatKeyResult(kr: KeyResult): string {
  const progress = kr.progress ?? calculateKeyResultProgress(kr)
  const current = kr.currentValue ?? kr.startValue ?? 0
  const target = kr.targetValue

  return `${kr.description}: ${current}/${target} ${kr.unit || ''} (${progress.toFixed(0)}%)`
}

/**
 * Compare OKR performance between periods
 */
export function compareOKRPerformance(
  current: OKRDefinition,
  previous: OKRDefinition
): {
  progressDelta: number
  confidenceDelta: number
  improved: boolean
} {
  const currentProgress = calculateOKRProgress(current)
  const previousProgress = calculateOKRProgress(previous)
  const progressDelta = currentProgress - previousProgress

  const currentConfidence = current.confidence ?? 0
  const previousConfidence = previous.confidence ?? 0
  const confidenceDelta = currentConfidence - previousConfidence

  const improved = progressDelta > 0 && confidenceDelta >= 0

  return { progressDelta, confidenceDelta, improved }
}

/**
 * Validate OKR definitions
 */
export function validateOKRs(okrs: OKRDefinition[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const okr of okrs) {
    if (!okr.objective) {
      errors.push('OKR objective is required')
    }

    if (okr.objective && okr.objective.length < 10) {
      errors.push(`OKR objective "${okr.objective}" should be at least 10 characters`)
    }

    if (okr.confidence !== undefined && (okr.confidence < 0 || okr.confidence > 100)) {
      errors.push(`OKR "${okr.objective}" confidence must be between 0 and 100`)
    }

    if (okr.keyResults) {
      if (okr.keyResults.length === 0) {
        errors.push(`OKR "${okr.objective}" must have at least one key result`)
      }

      if (okr.keyResults.length > 5) {
        errors.push(`OKR "${okr.objective}" should have no more than 5 key results`)
      }

      for (const kr of okr.keyResults) {
        if (!kr.description) {
          errors.push(`Key result in OKR "${okr.objective}" must have a description`)
        }

        if (!kr.metric) {
          errors.push(`Key result "${kr.description}" must have a metric`)
        }

        if (kr.progress !== undefined && (kr.progress < 0 || kr.progress > 100)) {
          errors.push(`Key result "${kr.description}" progress must be between 0 and 100`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
