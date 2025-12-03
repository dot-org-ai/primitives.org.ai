/**
 * Key Performance Indicators (KPIs) management
 */

import type { KPIDefinition, TimePeriod } from './types.js'

/**
 * Define Key Performance Indicators for tracking business metrics
 *
 * @example
 * ```ts
 * const businessKPIs = kpis([
 *   {
 *     name: 'Monthly Recurring Revenue',
 *     description: 'Total predictable revenue per month',
 *     category: 'financial',
 *     unit: 'USD',
 *     target: 100000,
 *     current: 85000,
 *     frequency: 'monthly',
 *     dataSource: 'Billing System',
 *     formula: 'SUM(active_subscriptions.price)',
 *   },
 *   {
 *     name: 'Customer Churn Rate',
 *     description: 'Percentage of customers lost per month',
 *     category: 'customer',
 *     unit: 'percent',
 *     target: 5,
 *     current: 3.2,
 *     frequency: 'monthly',
 *     dataSource: 'CRM',
 *     formula: '(churned_customers / total_customers) * 100',
 *   },
 *   {
 *     name: 'Net Promoter Score',
 *     description: 'Customer satisfaction and loyalty metric',
 *     category: 'customer',
 *     unit: 'score',
 *     target: 50,
 *     current: 48,
 *     frequency: 'quarterly',
 *     dataSource: 'Survey Platform',
 *   },
 * ])
 * ```
 */
export function kpis(definitions: KPIDefinition[]): KPIDefinition[] {
  return definitions.map(kpi => validateAndNormalizeKPI(kpi))
}

/**
 * Define a single KPI
 */
export function kpi(definition: KPIDefinition): KPIDefinition {
  return validateAndNormalizeKPI(definition)
}

/**
 * Validate and normalize a KPI definition
 */
function validateAndNormalizeKPI(kpi: KPIDefinition): KPIDefinition {
  if (!kpi.name) {
    throw new Error('KPI name is required')
  }

  return {
    ...kpi,
    category: kpi.category || 'operations',
    frequency: kpi.frequency || 'monthly',
    metadata: kpi.metadata || {},
  }
}

/**
 * Calculate KPI achievement percentage
 */
export function calculateAchievement(kpi: KPIDefinition): number {
  if (kpi.target === undefined || kpi.current === undefined) return 0
  if (kpi.target === 0) return 100
  return (kpi.current / kpi.target) * 100
}

/**
 * Check if KPI meets target
 */
export function meetsTarget(kpi: KPIDefinition): boolean {
  if (kpi.target === undefined || kpi.current === undefined) return false

  // For metrics where lower is better (like churn rate)
  const lowerIsBetter = ['churn', 'cost', 'time', 'error', 'downtime'].some(term =>
    kpi.name.toLowerCase().includes(term)
  )

  if (lowerIsBetter) {
    return kpi.current <= kpi.target
  }

  return kpi.current >= kpi.target
}

/**
 * Update KPI current value
 */
export function updateCurrent(kpi: KPIDefinition, value: number): KPIDefinition {
  return {
    ...kpi,
    current: value,
  }
}

/**
 * Update KPI target
 */
export function updateTarget(kpi: KPIDefinition, target: number): KPIDefinition {
  return {
    ...kpi,
    target,
  }
}

/**
 * Get KPIs by category
 */
export function getKPIsByCategory(
  kpis: KPIDefinition[],
  category: KPIDefinition['category']
): KPIDefinition[] {
  return kpis.filter(k => k.category === category)
}

/**
 * Get KPIs by frequency
 */
export function getKPIsByFrequency(kpis: KPIDefinition[], frequency: TimePeriod): KPIDefinition[] {
  return kpis.filter(k => k.frequency === frequency)
}

/**
 * Get KPIs that meet their targets
 */
export function getKPIsOnTarget(kpis: KPIDefinition[]): KPIDefinition[] {
  return kpis.filter(meetsTarget)
}

/**
 * Get KPIs that don't meet their targets
 */
export function getKPIsOffTarget(kpis: KPIDefinition[]): KPIDefinition[] {
  return kpis.filter(kpi => !meetsTarget(kpi))
}

/**
 * Calculate overall KPI health score (0-100)
 */
export function calculateHealthScore(kpis: KPIDefinition[]): number {
  if (kpis.length === 0) return 0

  const onTarget = getKPIsOnTarget(kpis).length
  return (onTarget / kpis.length) * 100
}

/**
 * Group KPIs by category
 */
export function groupByCategory(kpis: KPIDefinition[]): Map<string, KPIDefinition[]> {
  const groups = new Map<string, KPIDefinition[]>()

  for (const kpi of kpis) {
    const category = kpi.category || 'other'
    const existing = groups.get(category) || []
    groups.set(category, [...existing, kpi])
  }

  return groups
}

/**
 * Calculate variance from target
 */
export function calculateVariance(kpi: KPIDefinition): number {
  if (kpi.target === undefined || kpi.current === undefined) return 0
  return kpi.current - kpi.target
}

/**
 * Calculate variance percentage from target
 */
export function calculateVariancePercentage(kpi: KPIDefinition): number {
  if (kpi.target === undefined || kpi.current === undefined) return 0
  if (kpi.target === 0) return 0
  return ((kpi.current - kpi.target) / kpi.target) * 100
}

/**
 * Format KPI value with unit
 */
export function formatValue(kpi: KPIDefinition, value?: number): string {
  const val = value ?? kpi.current
  if (val === undefined) return 'N/A'

  const formatted = val.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  if (!kpi.unit) return formatted

  switch (kpi.unit.toLowerCase()) {
    case 'usd':
    case 'eur':
    case 'gbp':
      return `$${formatted}`
    case 'percent':
    case '%':
      return `${formatted}%`
    default:
      return `${formatted} ${kpi.unit}`
  }
}

/**
 * Compare KPI performance over time
 */
export function comparePerformance(
  current: KPIDefinition,
  previous: KPIDefinition
): {
  change: number
  changePercent: number
  improved: boolean
} {
  if (current.current === undefined || previous.current === undefined) {
    return { change: 0, changePercent: 0, improved: false }
  }

  const change = current.current - previous.current
  const changePercent =
    previous.current !== 0 ? (change / previous.current) * 100 : 0

  // Determine if change is an improvement
  const lowerIsBetter = ['churn', 'cost', 'time', 'error', 'downtime'].some(term =>
    current.name.toLowerCase().includes(term)
  )

  const improved = lowerIsBetter ? change < 0 : change > 0

  return { change, changePercent, improved }
}

/**
 * Validate KPI definitions
 */
export function validateKPIs(kpis: KPIDefinition[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const kpi of kpis) {
    if (!kpi.name) {
      errors.push('KPI name is required')
    }

    if (kpi.target !== undefined && kpi.target < 0) {
      errors.push(`KPI ${kpi.name} target cannot be negative`)
    }

    if (kpi.current !== undefined && kpi.current < 0) {
      errors.push(`KPI ${kpi.name} current value cannot be negative`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
