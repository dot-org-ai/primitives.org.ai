/**
 * Consolidated KPI type for org.ai
 *
 * Combines the best features from:
 * - digital-workers KPI (name, description, current, target, unit, trend, period)
 * - autonomous-agents KPI (id, name, description, value, target, unit, frequency, trend, history)
 * - business-as-code KPIDefinition (category, dataSource, formula)
 */

/**
 * KPICategory - classification of KPIs
 */
export type KPICategory = 'financial' | 'customer' | 'operations' | 'people' | 'growth'

/**
 * KPITrend - direction of change
 */
export type KPITrend = 'up' | 'down' | 'stable'

/**
 * KPIFrequency - how often the KPI is measured
 */
export type KPIFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

/**
 * KPIHistoryEntry - a historical data point
 */
export interface KPIHistoryEntry {
  /** Timestamp of the measurement */
  timestamp: Date
  /** Value at that time */
  value: number | string
}

/**
 * KPI interface - consolidated KPI definition
 *
 * Combines identity, values, trend tracking, categorization,
 * and historical data.
 */
export interface KPI {
  // Core identity
  /** Unique KPI identifier */
  id: string
  /** Human-readable KPI name */
  name: string
  /** KPI description */
  description?: string

  // Values (flexible types)
  /** Current value */
  value: number | string
  /** Alias for value (current) */
  current?: number | string
  /** Target value */
  target: number | string
  /** Unit of measurement */
  unit: string

  // Trend and tracking
  /** Current trend direction */
  trend?: KPITrend
  /** Measurement frequency */
  frequency?: KPIFrequency

  // Categorization (from business-as-code)
  /** KPI category */
  category?: KPICategory
  /** Data source for this KPI */
  dataSource?: string
  /** Formula for calculating the KPI */
  formula?: string

  // Historical data (from autonomous-agents)
  /** Historical values */
  history?: KPIHistoryEntry[]

  // Extensibility
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * KPIDefinition - alias for KPI (for business-as-code compatibility)
 */
export type KPIDefinition = KPI

/**
 * Type guard for KPI
 */
export function isKPI(value: unknown): value is KPI {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    (typeof v['value'] === 'number' || typeof v['value'] === 'string') &&
    (typeof v['target'] === 'number' || typeof v['target'] === 'string') &&
    typeof v['unit'] === 'string'
  )
}
