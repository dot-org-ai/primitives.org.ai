/**
 * Consolidated Goal type for org.ai
 *
 * Combines the best features from:
 * - autonomous-agents Goal (id, description, target, progress, deadline, priority, status, subgoals, successCriteria)
 * - business-as-code GoalDefinition (name, category, owner, metrics, dependencies)
 */

/**
 * GoalStatus - possible states of a goal
 */
export type GoalStatus =
  | 'not-started'
  | 'in-progress'
  | 'at-risk'
  | 'blocked'
  | 'completed'
  | 'cancelled'

/**
 * GoalCategory - classification of goals
 */
export type GoalCategory =
  | 'strategic'
  | 'operational'
  | 'financial'
  | 'customer'
  | 'internal'
  | 'learning'

/**
 * GoalPriority - urgency/importance level
 */
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Goal interface - consolidated goal definition
 *
 * Combines identity, targets, timing, ownership, success criteria,
 * dependencies, and hierarchy.
 */
export interface Goal {
  // Core identity
  /** Unique goal identifier */
  id: string
  /** Human-readable goal name */
  name: string
  /** Goal description */
  description: string

  // Target and progress (flexible types for numeric or qualitative goals)
  /** Target value (number or string) */
  target: number | string
  /** Current progress (number or string) */
  progress: number | string
  /** Current status */
  status: GoalStatus

  // Timing
  /** Target completion date */
  targetDate?: Date
  /** Alias for targetDate (deadline) */
  deadline?: Date

  // Ownership and categorization
  /** Goal owner (person or role) */
  owner?: string
  /** Goal category */
  category?: GoalCategory
  /** Priority level */
  priority?: GoalPriority

  // Success criteria and metrics (from business-as-code)
  /** List of success criteria */
  successCriteria?: string[]
  /** Metrics to track */
  metrics?: string[]

  // Dependencies (from business-as-code)
  /** IDs of goals this depends on */
  dependencies?: string[]

  // Hierarchy (from autonomous-agents)
  /** Sub-goals */
  subgoals?: Goal[]

  // Extensibility
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Goals - collection type alias for Goal[]
 */
export type Goals = Goal[]

/**
 * Type guard for Goal
 */
export function isGoal(value: unknown): value is Goal {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['description'] === 'string' &&
    (typeof v['target'] === 'number' || typeof v['target'] === 'string') &&
    (typeof v['progress'] === 'number' || typeof v['progress'] === 'string') &&
    typeof v['status'] === 'string'
  )
}
