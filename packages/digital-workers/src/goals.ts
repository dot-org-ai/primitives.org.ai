/**
 * Goals definition for digital workers
 */

import type { WorkerGoals, KPI } from './types.js'

/**
 * Define worker goals
 *
 * Goals provide direction and metrics for workers and teams.
 * Supports short-term, long-term, and strategic objectives with KPIs.
 *
 * @param definition - Goals definition
 * @returns The defined goals
 *
 * @example
 * ```ts
 * const engineeringGoals = Goals({
 *   shortTerm: [
 *     'Complete Q1 roadmap features',
 *     'Reduce bug backlog by 30%',
 *     'Improve test coverage to 80%',
 *   ],
 *   longTerm: [
 *     'Migrate to microservices architecture',
 *     'Achieve 99.9% uptime',
 *     'Build scalable platform for 1M users',
 *   ],
 *   strategic: [
 *     'Become industry leader in performance',
 *     'Enable product innovation through technology',
 *   ],
 *   metrics: [
 *     {
 *       name: 'Deployment Frequency',
 *       description: 'Number of deployments per week',
 *       current: 5,
 *       target: 10,
 *       unit: 'deploys/week',
 *       trend: 'up',
 *       period: 'weekly',
 *     },
 *     {
 *       name: 'Mean Time to Recovery',
 *       description: 'Average time to recover from incidents',
 *       current: 45,
 *       target: 30,
 *       unit: 'minutes',
 *       trend: 'down',
 *       period: 'monthly',
 *     },
 *   ],
 * })
 * ```
 *
 * @example
 * ```ts
 * const supportGoals = Goals({
 *   shortTerm: [
 *     'Achieve 95% customer satisfaction',
 *     'Reduce average response time to < 5 min',
 *   ],
 *   longTerm: [
 *     'Build comprehensive knowledge base',
 *     'Implement AI-first support workflow',
 *   ],
 *   metrics: [
 *     {
 *       name: 'Customer Satisfaction',
 *       description: 'CSAT score from surveys',
 *       current: 92,
 *       target: 95,
 *       unit: '%',
 *       trend: 'up',
 *       period: 'monthly',
 *     },
 *   ],
 * })
 * ```
 */
export function Goals(definition: WorkerGoals): WorkerGoals {
  return definition
}

/**
 * Add a short-term goal
 *
 * @param goals - The goals object
 * @param goal - Goal to add
 * @returns Updated goals
 *
 * @example
 * ```ts
 * const updated = Goals.addShortTerm(engineeringGoals, 'Complete security audit')
 * ```
 */
Goals.addShortTerm = (goals: WorkerGoals, goal: string): WorkerGoals => ({
  ...goals,
  shortTerm: [...goals.shortTerm, goal],
})

/**
 * Add a long-term goal
 *
 * @param goals - The goals object
 * @param goal - Goal to add
 * @returns Updated goals
 *
 * @example
 * ```ts
 * const updated = Goals.addLongTerm(engineeringGoals, 'Build ML platform')
 * ```
 */
Goals.addLongTerm = (goals: WorkerGoals, goal: string): WorkerGoals => ({
  ...goals,
  longTerm: [...goals.longTerm, goal],
})

/**
 * Add a strategic goal
 *
 * @param goals - The goals object
 * @param goal - Goal to add
 * @returns Updated goals
 *
 * @example
 * ```ts
 * const updated = Goals.addStrategic(engineeringGoals, 'Become carbon neutral')
 * ```
 */
Goals.addStrategic = (goals: WorkerGoals, goal: string): WorkerGoals => ({
  ...goals,
  strategic: [...(goals.strategic || []), goal],
})

/**
 * Add a KPI metric
 *
 * @param goals - The goals object
 * @param kpi - KPI to add
 * @returns Updated goals
 *
 * @example
 * ```ts
 * const updated = Goals.addMetric(engineeringGoals, {
 *   name: 'Code Quality',
 *   description: 'Code quality score from SonarQube',
 *   current: 85,
 *   target: 90,
 *   unit: 'score',
 *   trend: 'up',
 *   period: 'weekly',
 * })
 * ```
 */
Goals.addMetric = (goals: WorkerGoals, kpi: KPI): WorkerGoals => ({
  ...goals,
  metrics: [...(goals.metrics || []), kpi],
})

/**
 * Update a KPI metric
 *
 * @param goals - The goals object
 * @param name - Name of KPI to update
 * @param updates - Fields to update
 * @returns Updated goals
 *
 * @example
 * ```ts
 * const updated = Goals.updateMetric(engineeringGoals, 'Deployment Frequency', {
 *   current: 8,
 *   trend: 'up',
 * })
 * ```
 */
Goals.updateMetric = (
  goals: WorkerGoals,
  name: string,
  updates: Partial<Omit<KPI, 'name'>>
): WorkerGoals => ({
  ...goals,
  metrics: goals.metrics?.map((kpi) =>
    kpi.name === name ? { ...kpi, ...updates } : kpi
  ),
})

/**
 * Get progress for a KPI (0-1)
 *
 * @param kpi - The KPI
 * @returns Progress value between 0 and 1
 *
 * @example
 * ```ts
 * const kpi = { current: 75, target: 100 }
 * const progress = Goals.progress(kpi) // 0.75
 * ```
 */
Goals.progress = (kpi: Pick<KPI, 'current' | 'target'>): number => {
  if (kpi.target === 0) return 0
  return Math.min(1, Math.max(0, kpi.current / kpi.target))
}

/**
 * Check if a KPI is on track
 *
 * @param kpi - The KPI
 * @param threshold - Minimum progress to be considered "on track" (default: 0.8)
 * @returns Whether the KPI is on track
 *
 * @example
 * ```ts
 * const kpi = { current: 85, target: 100 }
 * const onTrack = Goals.onTrack(kpi) // true (85% >= 80% threshold)
 * ```
 */
Goals.onTrack = (kpi: Pick<KPI, 'current' | 'target'>, threshold = 0.8): boolean => {
  return Goals.progress(kpi) >= threshold
}
