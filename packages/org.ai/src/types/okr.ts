/**
 * Consolidated OKR type for org.ai
 *
 * Combines the best features from:
 * - digital-workers OKR (objective, keyResults, owner, dueDate, progress)
 * - autonomous-agents OKR (id, objective, description, keyResults, period, owner, status, progress)
 * - business-as-code OKRDefinition (confidence)
 */

/**
 * OKRStatus - possible states of an OKR
 */
export type OKRStatus =
  | 'not-started'
  | 'on-track'
  | 'at-risk'
  | 'off-track'
  | 'completed'
  | 'cancelled'

/**
 * KeyResultStatus - status for individual key results
 */
export type KeyResultStatus = 'not-started' | 'on-track' | 'at-risk' | 'off-track' | 'completed'

/**
 * KeyResult interface - measurable outcome for an objective
 *
 * Supports both detailed tracking (startValue, targetValue, currentValue)
 * and simplified tracking (current, target) for compatibility.
 */
export interface KeyResult {
  // Identity
  /** Unique key result identifier */
  id?: string
  /** Key result description */
  description: string
  /** Alias for description (name) - for backward compatibility */
  name?: string

  // Metric details
  /** Metric being tracked */
  metric?: string
  /** Starting value */
  startValue?: number
  /** Target value to achieve */
  targetValue?: number
  /** Current value */
  currentValue?: number

  // Aliases for compatibility (digital-workers style)
  /** Alias for currentValue */
  current?: number
  /** Alias for targetValue */
  target?: number

  // Unit and progress
  /** Unit of measurement */
  unit?: string
  /** Progress percentage (0-100) */
  progress?: number

  // Status
  /** Current status */
  status?: KeyResultStatus
}

/**
 * OKR interface - consolidated OKR definition
 *
 * Combines objective, key results, ownership, timing,
 * status tracking, and confidence scoring.
 */
export interface OKR {
  // Core identity
  /** Unique OKR identifier */
  id?: string
  /** The objective - what you want to achieve */
  objective: string
  /** Detailed description of the objective */
  description?: string

  // Key results (detailed)
  /** Measurable outcomes */
  keyResults: KeyResult[]

  // Ownership and timing
  /** Owner (person or role) */
  owner?: string
  /** Time period (e.g., "Q2 2024") */
  period?: string
  /** Due date */
  dueDate?: Date

  // Status and progress
  /** Current status */
  status?: OKRStatus
  /** Overall progress percentage (often average of key results) */
  progress?: number

  // Confidence (from business-as-code)
  /** Confidence level (0-100) */
  confidence?: number

  // Extensibility
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Type guard for OKR
 */
export function isOKR(value: unknown): value is OKR {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['objective'] === 'string' && Array.isArray(v['keyResults'])
}
