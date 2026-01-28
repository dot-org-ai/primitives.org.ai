/**
 * KPI and OKR tracking functionality for digital workers
 */

import type { KPI, OKR, KeyResult } from 'org.ai'
import { calculateProgress, isOnTrack, calculateGap } from 'org.ai'
import type { WorkerKPI, WorkerOKR } from './types.js'

// Re-export KPI, OKR from org.ai for convenience
export type { KPI, OKR, KeyResult } from 'org.ai'

/**
 * Define and track Key Performance Indicators
 *
 * Uses WorkerKPI which has a simpler interface with `current` and `target`
 * as required number fields. For the full org.ai KPI with `id`, `value`,
 * `category`, and `history`, use the KPI type directly.
 *
 * @param definition - KPI definition or array of KPIs
 * @returns The defined KPI(s)
 *
 * @example
 * ```ts
 * const deploymentFrequency = kpis({
 *   name: 'Deployment Frequency',
 *   description: 'Number of deployments per week',
 *   current: 5,
 *   target: 10,
 *   unit: 'deploys/week',
 *   trend: 'up',
 *   period: 'weekly',
 * })
 * ```
 *
 * @example
 * ```ts
 * // Define multiple KPIs
 * const teamKPIs = kpis([
 *   {
 *     name: 'Code Quality',
 *     description: 'SonarQube quality score',
 *     current: 85,
 *     target: 90,
 *     unit: 'score',
 *     trend: 'up',
 *   },
 *   {
 *     name: 'Test Coverage',
 *     description: 'Percentage of code covered by tests',
 *     current: 75,
 *     target: 80,
 *     unit: '%',
 *     trend: 'up',
 *   },
 * ])
 * ```
 */
export function kpis(definition: WorkerKPI): WorkerKPI
export function kpis(definition: WorkerKPI[]): WorkerKPI[]
export function kpis(definition: WorkerKPI | WorkerKPI[]): WorkerKPI | WorkerKPI[] {
  return definition
}

/**
 * Update a KPI's current value
 *
 * @param kpi - The KPI to update
 * @param current - New current value
 * @returns Updated KPI
 *
 * @example
 * ```ts
 * const updated = kpis.update(deploymentFrequency, 8)
 * console.log(updated.current) // 8
 * console.log(updated.trend) // 'up' (automatically determined)
 * ```
 */
kpis.update = (kpi: WorkerKPI, current: number): WorkerKPI => {
  // Determine trend
  let trend: WorkerKPI['trend'] = 'stable'
  if (current > kpi.current) {
    trend = 'up'
  } else if (current < kpi.current) {
    trend = 'down'
  }

  return {
    ...kpi,
    current,
    trend,
  }
}

/**
 * Calculate progress towards target (0-1)
 *
 * @param kpi - The KPI
 * @returns Progress as a decimal (0-1)
 *
 * @example
 * ```ts
 * const kpi = { current: 75, target: 100 }
 * const progress = kpis.progress(kpi) // 0.75
 * ```
 */
kpis.progress = (kpi: Pick<WorkerKPI, 'current' | 'target'>): number => {
  return calculateProgress(kpi)
}

/**
 * Check if a KPI is on track
 *
 * @param kpi - The KPI
 * @param threshold - Minimum progress to be "on track" (default: 0.8)
 * @returns Whether the KPI is on track
 *
 * @example
 * ```ts
 * const kpi = { current: 85, target: 100 }
 * const onTrack = kpis.onTrack(kpi) // true (85% >= 80%)
 * ```
 */
kpis.onTrack = (kpi: Pick<WorkerKPI, 'current' | 'target'>, threshold = 0.8): boolean => {
  return isOnTrack(kpi, threshold)
}

/**
 * Get the gap to target
 *
 * @param kpi - The KPI
 * @returns Difference between target and current
 *
 * @example
 * ```ts
 * const kpi = { current: 75, target: 100 }
 * const gap = kpis.gap(kpi) // 25
 * ```
 */
kpis.gap = (kpi: Pick<WorkerKPI, 'current' | 'target'>): number => {
  return calculateGap(kpi)
}

/**
 * Format a KPI for display
 *
 * @param kpi - The KPI
 * @returns Formatted string
 *
 * @example
 * ```ts
 * const kpi = {
 *   name: 'Deployment Frequency',
 *   current: 5,
 *   target: 10,
 *   unit: 'deploys/week',
 *   trend: 'up',
 * }
 * const formatted = kpis.format(kpi)
 * // "Deployment Frequency: 5/10 deploys/week (50%, trending up)"
 * ```
 */
kpis.format = (kpi: WorkerKPI): string => {
  const progress = kpis.progress(kpi)
  const progressPercent = Math.round(progress * 100)
  const trendEmoji = kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'

  return `${kpi.name}: ${kpi.current}/${kpi.target} ${kpi.unit} (${progressPercent}%, trending ${kpi.trend} ${trendEmoji})`
}

/**
 * Compare two KPI snapshots to see change over time
 *
 * @param previous - Previous KPI state
 * @param current - Current KPI state
 * @returns Change analysis
 *
 * @example
 * ```ts
 * const change = kpis.compare(previousKPI, currentKPI)
 * console.log(change.delta) // 5
 * console.log(change.percentChange) // 10
 * console.log(change.improved) // true
 * ```
 */
kpis.compare = (
  previous: Pick<WorkerKPI, 'current' | 'target'>,
  current: Pick<WorkerKPI, 'current' | 'target'>
): {
  delta: number
  percentChange: number
  improved: boolean
} => {
  const delta = current.current - previous.current
  const percentChange = previous.current !== 0 ? (delta / previous.current) * 100 : 0

  // Improved if we got closer to the target
  const previousGap = Math.abs(previous.target - previous.current)
  const currentGap = Math.abs(current.target - current.current)
  const improved = currentGap < previousGap

  return {
    delta,
    percentChange,
    improved,
  }
}

/**
 * Define OKRs (Objectives and Key Results)
 *
 * Uses WorkerOKR which has WorkerRef for owner.
 * For the full org.ai OKR with `id`, `status`, `period`, etc.,
 * use the OKR type directly.
 *
 * @param definition - OKR definition
 * @returns The defined OKR
 *
 * @example
 * ```ts
 * const engineeringOKR = okrs({
 *   objective: 'Improve development velocity',
 *   keyResults: [
 *     {
 *       name: 'Deployment Frequency',
 *       current: 5,
 *       target: 10,
 *       unit: 'deploys/week',
 *     },
 *     {
 *       name: 'Lead Time',
 *       current: 48,
 *       target: 24,
 *       unit: 'hours',
 *     },
 *     {
 *       name: 'Change Failure Rate',
 *       current: 15,
 *       target: 5,
 *       unit: '%',
 *     },
 *   ],
 *   owner: { id: 'engineering-team', type: 'agent' },
 *   dueDate: new Date('2024-03-31'),
 * })
 * ```
 */
export function okrs(definition: WorkerOKR): WorkerOKR {
  return definition
}

/**
 * Calculate overall OKR progress
 *
 * @param okr - The OKR
 * @returns Average progress across all key results (0-1)
 *
 * @example
 * ```ts
 * const progress = okrs.progress(engineeringOKR)
 * console.log(progress) // 0.67 (67% complete)
 * ```
 */
okrs.progress = (okr: WorkerOKR): number => {
  if (okr.keyResults.length === 0) return 0

  const totalProgress = okr.keyResults.reduce((sum, kr) => {
    return sum + kpis.progress(kr)
  }, 0)

  return totalProgress / okr.keyResults.length
}

/**
 * Update a key result in an OKR
 *
 * @param okr - The OKR
 * @param keyResultName - Name of key result to update
 * @param current - New current value
 * @returns Updated OKR
 *
 * @example
 * ```ts
 * const updated = okrs.updateKeyResult(
 *   engineeringOKR,
 *   'Deployment Frequency',
 *   8
 * )
 * ```
 */
okrs.updateKeyResult = (okr: WorkerOKR, keyResultName: string, current: number): WorkerOKR => {
  const { progress: _progress, ...rest } = okr
  return {
    ...rest,
    keyResults: okr.keyResults.map((kr) => (kr.name === keyResultName ? { ...kr, current } : kr)),
  }
}

/**
 * Check if OKR is on track
 *
 * @param okr - The OKR
 * @param threshold - Minimum progress to be "on track" (default: 0.7)
 * @returns Whether the OKR is on track
 *
 * @example
 * ```ts
 * const onTrack = okrs.onTrack(engineeringOKR)
 * ```
 */
okrs.onTrack = (okr: WorkerOKR, threshold = 0.7): boolean => {
  return okrs.progress(okr) >= threshold
}

/**
 * Format OKR for display
 *
 * @param okr - The OKR
 * @returns Formatted string
 *
 * @example
 * ```ts
 * const formatted = okrs.format(engineeringOKR)
 * console.log(formatted)
 * // Improve development velocity (67% complete)
 * // • Deployment Frequency: 5/10 deploys/week (50%)
 * // • Lead Time: 48/24 hours (200%)
 * // • Change Failure Rate: 15/5 % (300%)
 * ```
 */
okrs.format = (okr: WorkerOKR): string => {
  const progress = okrs.progress(okr)
  const progressPercent = Math.round(progress * 100)

  const lines = [
    `${okr.objective} (${progressPercent}% complete)`,
    ...okr.keyResults.map((kr) => {
      const krProgress = kpis.progress(kr)
      const krPercent = Math.round(krProgress * 100)
      return `  - ${kr.name}: ${kr.current}/${kr.target} ${kr.unit} (${krPercent}%)`
    }),
  ]

  if (okr.owner) {
    const ownerDisplay = typeof okr.owner === 'string' ? okr.owner : okr.owner.id
    lines.push(`  Owner: ${ownerDisplay}`)
  }

  if (okr.dueDate) {
    lines.push(`  Due: ${okr.dueDate.toLocaleDateString()}`)
  }

  return lines.join('\n')
}
