/**
 * Progress calculation utilities
 *
 * Shared utilities for calculating progress towards targets across KPIs, OKRs, and goals.
 *
 * @packageDocumentation
 */

/**
 * Input type for progress calculation
 */
export interface ProgressInput {
  current: number
  target: number
}

/**
 * Calculate progress towards a target as a decimal (0-1)
 *
 * Handles edge cases:
 * - Returns 0 when target is 0 (avoid division by zero)
 * - Clamps result to 0-1 range (never negative, never exceeds 100%)
 *
 * @param input - Object with current and target values
 * @returns Progress as a decimal between 0 and 1
 *
 * @example
 * ```ts
 * import { calculateProgress } from 'org.ai'
 *
 * const progress = calculateProgress({ current: 75, target: 100 }) // 0.75
 * const clamped = calculateProgress({ current: 150, target: 100 }) // 1 (clamped)
 * const zero = calculateProgress({ current: 50, target: 0 }) // 0 (target is 0)
 * ```
 */
export function calculateProgress(input: Pick<ProgressInput, 'current' | 'target'>): number {
  if (input.target === 0) return 0
  return Math.min(1, Math.max(0, input.current / input.target))
}

/**
 * Calculate progress as a percentage (0-100)
 *
 * Same as calculateProgress but returns percentage instead of decimal.
 *
 * @param input - Object with current and target values
 * @returns Progress as a percentage between 0 and 100
 *
 * @example
 * ```ts
 * import { calculateProgressPercent } from 'org.ai'
 *
 * const progress = calculateProgressPercent({ current: 75, target: 100 }) // 75
 * const clamped = calculateProgressPercent({ current: 150, target: 100 }) // 100 (clamped)
 * ```
 */
export function calculateProgressPercent(input: Pick<ProgressInput, 'current' | 'target'>): number {
  return calculateProgress(input) * 100
}

/**
 * Check if progress is on track based on a threshold
 *
 * @param input - Object with current and target values
 * @param threshold - Minimum progress to be considered "on track" (default: 0.8)
 * @returns Whether the progress meets or exceeds the threshold
 *
 * @example
 * ```ts
 * import { isOnTrack } from 'org.ai'
 *
 * const onTrack = isOnTrack({ current: 85, target: 100 }) // true (85% >= 80%)
 * const atRisk = isOnTrack({ current: 50, target: 100 }) // false (50% < 80%)
 * const custom = isOnTrack({ current: 70, target: 100 }, 0.7) // true (70% >= 70%)
 * ```
 */
export function isOnTrack(
  input: Pick<ProgressInput, 'current' | 'target'>,
  threshold = 0.8
): boolean {
  return calculateProgress(input) >= threshold
}

/**
 * Calculate the gap between current and target
 *
 * @param input - Object with current and target values
 * @returns The difference (target - current)
 *
 * @example
 * ```ts
 * import { calculateGap } from 'org.ai'
 *
 * const gap = calculateGap({ current: 75, target: 100 }) // 25
 * const exceeded = calculateGap({ current: 120, target: 100 }) // -20
 * ```
 */
export function calculateGap(input: Pick<ProgressInput, 'current' | 'target'>): number {
  return input.target - input.current
}
