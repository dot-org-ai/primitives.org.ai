/**
 * Business goals definition and tracking
 *
 * Uses org.ai Goal types for standardized goal definitions across the ecosystem.
 */

import type { GoalDefinition } from './types.js'
import type {
  Goal as OrgGoal,
  Goals as OrgGoals,
  GoalStatus,
  GoalCategory,
  GoalPriority,
} from 'org.ai'

// Re-export org.ai goal types for convenience
export type { OrgGoal, OrgGoals, GoalStatus, GoalCategory, GoalPriority }

/**
 * Convert a business-as-code GoalDefinition to an org.ai Goal
 *
 * @param definition - Business goal definition
 * @param id - Unique identifier for the goal
 * @returns org.ai Goal object
 */
export function toOrgGoal(definition: GoalDefinition, id: string): OrgGoal {
  const result: OrgGoal = {
    id,
    name: definition.name,
    description: definition.description || definition.name,
    target: 100,
    progress: definition.progress || 0,
    status: definition.status || 'not-started',
  }
  if (definition.targetDate) {
    result.targetDate = definition.targetDate
    result.deadline = definition.targetDate
  }
  if (definition.owner) result.owner = definition.owner
  if (definition.category) result.category = definition.category
  if (definition.metrics) result.metrics = definition.metrics
  if (definition.dependencies) result.dependencies = definition.dependencies
  if (definition.metadata) result.metadata = definition.metadata
  return result
}

/**
 * Convert an org.ai Goal to a business-as-code GoalDefinition
 *
 * @param goal - org.ai Goal object
 * @returns Business goal definition
 */
export function fromOrgGoal(goal: OrgGoal): GoalDefinition {
  const result: GoalDefinition = {
    name: goal.name,
    progress: typeof goal.progress === 'number' ? goal.progress : 0,
  }
  if (goal.description) result.description = goal.description
  const cat = goal.category
  if (cat) result.category = cat as NonNullable<GoalDefinition['category']>
  if (goal.targetDate) result.targetDate = goal.targetDate
  else if (goal.deadline) result.targetDate = goal.deadline
  if (goal.owner) result.owner = goal.owner
  if (goal.metrics) result.metrics = goal.metrics
  const st = goal.status
  if (st) result.status = st as NonNullable<GoalDefinition['status']>
  if (goal.dependencies) result.dependencies = goal.dependencies
  if (goal.metadata) result.metadata = goal.metadata
  return result
}

/**
 * Define a business goal with metrics and tracking
 *
 * @example
 * ```ts
 * const goals = Goals([
 *   {
 *     name: 'Launch MVP',
 *     description: 'Ship minimum viable product to early customers',
 *     category: 'strategic',
 *     targetDate: new Date('2024-06-30'),
 *     owner: 'Product Team',
 *     metrics: ['User signups', 'Feature completion rate'],
 *     status: 'in-progress',
 *     progress: 65,
 *   },
 *   {
 *     name: 'Achieve Product-Market Fit',
 *     description: 'Validate product value with target customers',
 *     category: 'strategic',
 *     targetDate: new Date('2024-12-31'),
 *     owner: 'CEO',
 *     metrics: ['NPS > 50', 'Churn < 5%', '100+ paying customers'],
 *     status: 'in-progress',
 *     progress: 30,
 *     dependencies: ['Launch MVP'],
 *   },
 * ])
 * ```
 */
export function Goals(definitions: GoalDefinition[]): GoalDefinition[] {
  return definitions.map((goal) => validateAndNormalizeGoal(goal))
}

/**
 * Define a single goal
 */
export function Goal(definition: GoalDefinition): GoalDefinition {
  return validateAndNormalizeGoal(definition)
}

/**
 * Validate and normalize a goal definition
 */
function validateAndNormalizeGoal(goal: GoalDefinition): GoalDefinition {
  if (!goal.name) {
    throw new Error('Goal name is required')
  }

  return {
    ...goal,
    category: goal.category || 'operational',
    status: goal.status || 'not-started',
    progress: goal.progress || 0,
    metrics: goal.metrics || [],
    dependencies: goal.dependencies || [],
    metadata: goal.metadata || {},
  }
}

/**
 * Update goal progress
 */
export function updateProgress(goal: GoalDefinition, progress: number): GoalDefinition {
  if (progress < 0 || progress > 100) {
    throw new Error('Progress must be between 0 and 100')
  }

  // Auto-update status based on progress
  let status = goal.status
  if (progress === 0) {
    status = 'not-started'
  } else if (progress === 100) {
    status = 'completed'
  } else if (progress > 0) {
    status = 'in-progress'
  }

  return {
    ...goal,
    progress,
    status,
  }
}

/**
 * Mark goal as at-risk
 */
export function markAtRisk(goal: GoalDefinition): GoalDefinition {
  return {
    ...goal,
    status: 'at-risk',
  }
}

/**
 * Mark goal as completed
 */
export function complete(goal: GoalDefinition): GoalDefinition {
  return {
    ...goal,
    status: 'completed',
    progress: 100,
  }
}

/**
 * Check if goal is overdue
 */
export function isOverdue(goal: GoalDefinition): boolean {
  if (!goal.targetDate) return false
  return new Date() > goal.targetDate && goal.status !== 'completed'
}

/**
 * Get goals by category
 */
export function getGoalsByCategory(
  goals: GoalDefinition[],
  category: GoalDefinition['category']
): GoalDefinition[] {
  return goals.filter((g) => g.category === category)
}

/**
 * Get goals by status
 */
export function getGoalsByStatus(
  goals: GoalDefinition[],
  status: GoalDefinition['status']
): GoalDefinition[] {
  return goals.filter((g) => g.status === status)
}

/**
 * Get goals by owner
 */
export function getGoalsByOwner(goals: GoalDefinition[], owner: string): GoalDefinition[] {
  return goals.filter((g) => g.owner === owner)
}

/**
 * Calculate overall progress across all goals
 */
export function calculateOverallProgress(goals: GoalDefinition[]): number {
  if (goals.length === 0) return 0

  const totalProgress = goals.reduce((sum, goal) => sum + (goal.progress || 0), 0)
  return totalProgress / goals.length
}

/**
 * Check for circular dependencies
 */
export function hasCircularDependencies(goals: GoalDefinition[]): boolean {
  const goalMap = new Map(goals.map((g) => [g.name, g]))

  function checkCircular(goalName: string, visited = new Set<string>()): boolean {
    if (visited.has(goalName)) return true

    const goal = goalMap.get(goalName)
    if (!goal || !goal.dependencies) return false

    visited.add(goalName)

    for (const dep of goal.dependencies) {
      if (checkCircular(dep, new Set(visited))) {
        return true
      }
    }

    return false
  }

  return goals.some((goal) => checkCircular(goal.name))
}

/**
 * Get goals in dependency order
 */
export function sortByDependencies(goals: GoalDefinition[]): GoalDefinition[] {
  const goalMap = new Map(goals.map((g) => [g.name, g]))
  const sorted: GoalDefinition[] = []
  const visited = new Set<string>()

  function visit(goalName: string) {
    if (visited.has(goalName)) return

    const goal = goalMap.get(goalName)
    if (!goal) return

    visited.add(goalName)

    // Visit dependencies first
    if (goal.dependencies) {
      for (const dep of goal.dependencies) {
        visit(dep)
      }
    }

    sorted.push(goal)
  }

  for (const goal of goals) {
    visit(goal.name)
  }

  return sorted
}

/**
 * Validate goals
 */
export function validateGoals(goals: GoalDefinition[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const goal of goals) {
    if (!goal.name) {
      errors.push('Goal name is required')
    }

    if (goal.progress && (goal.progress < 0 || goal.progress > 100)) {
      errors.push(`Goal ${goal.name} progress must be between 0 and 100`)
    }

    if (goal.dependencies) {
      const goalNames = new Set(goals.map((g) => g.name))
      for (const dep of goal.dependencies) {
        if (!goalNames.has(dep)) {
          errors.push(`Goal ${goal.name} depends on unknown goal: ${dep}`)
        }
      }
    }
  }

  if (hasCircularDependencies(goals)) {
    errors.push('Circular dependencies detected in goals')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
