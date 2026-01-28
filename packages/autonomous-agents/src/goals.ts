/**
 * Goals - Define and track goals for agents and teams
 *
 * Goals provide direction and measurable outcomes for autonomous agents
 * and teams to work towards.
 *
 * @packageDocumentation
 */

import { calculateProgressPercent } from 'org.ai'
import type { Goal, GoalsConfig, Priority } from './types.js'

/**
 * Create a goals configuration
 *
 * @example
 * ```ts
 * import { Goals } from 'autonomous-agents'
 *
 * const goals = Goals({
 *   goals: [
 *     {
 *       id: 'revenue-q1',
 *       description: 'Increase Q1 revenue by 20%',
 *       target: 120000,
 *       progress: 45000,
 *       priority: 'high',
 *       deadline: new Date('2024-03-31'),
 *       status: 'in-progress',
 *     },
 *     {
 *       id: 'feature-launch',
 *       description: 'Launch new AI features',
 *       target: '100%',
 *       progress: '60%',
 *       priority: 'high',
 *       deadline: new Date('2024-02-15'),
 *       status: 'in-progress',
 *       subgoals: [
 *         {
 *           id: 'feature-design',
 *           description: 'Complete feature designs',
 *           target: '100%',
 *           progress: '100%',
 *           status: 'completed',
 *         },
 *         {
 *           id: 'feature-dev',
 *           description: 'Implement features',
 *           target: '100%',
 *           progress: '80%',
 *           status: 'in-progress',
 *         },
 *       ],
 *     },
 *   ],
 *   strategy: 'Focus on high-impact features that drive revenue growth',
 *   timeHorizon: 'Q1 2024',
 * })
 * ```
 */
export function Goals(config: GoalsConfig): GoalsInstance {
  const state = {
    goals: config.goals,
    ...(config.strategy !== undefined && { strategy: config.strategy }),
    ...(config.timeHorizon !== undefined && { timeHorizon: config.timeHorizon }),
  }

  return {
    ...state,
    addGoal,
    removeGoal,
    getGoal,
    getGoals,
    getActiveGoals,
    getCompletedGoals,
    getBlockedGoals,
    getGoalsByPriority,
    updateGoal,
    updateProgress,
    markCompleted,
    markBlocked,
    getProgress,
    getOverallProgress,
  }

  /**
   * Add a new goal
   */
  function addGoal(goal: Goal): void {
    state.goals.push(goal)
  }

  /**
   * Remove a goal
   */
  function removeGoal(goalId: string): boolean {
    const index = state.goals.findIndex((g) => g.id === goalId)
    if (index === -1) return false
    state.goals.splice(index, 1)
    return true
  }

  /**
   * Get a specific goal
   */
  function getGoal(goalId: string): Goal | undefined {
    return findGoalRecursive(state.goals, goalId)
  }

  /**
   * Get all goals
   */
  function getGoals(): Goal[] {
    return [...state.goals]
  }

  /**
   * Get active goals
   */
  function getActiveGoals(): Goal[] {
    return state.goals.filter((g) => g.status === 'active')
  }

  /**
   * Get completed goals
   */
  function getCompletedGoals(): Goal[] {
    return state.goals.filter((g) => g.status === 'completed')
  }

  /**
   * Get blocked goals
   */
  function getBlockedGoals(): Goal[] {
    return state.goals.filter((g) => g.status === 'blocked')
  }

  /**
   * Get goals by priority
   */
  function getGoalsByPriority(priority: Priority): Goal[] {
    return state.goals.filter((g) => g.priority === priority)
  }

  /**
   * Update a goal
   */
  function updateGoal(goalId: string, updates: Partial<Omit<Goal, 'id'>>): void {
    const goal = findGoalRecursive(state.goals, goalId)
    if (!goal) {
      throw new Error(`Goal with id ${goalId} not found`)
    }
    Object.assign(goal, updates)
  }

  /**
   * Update goal progress
   */
  function updateProgress(goalId: string, progress: string | number): void {
    const goal = findGoalRecursive(state.goals, goalId)
    if (!goal) {
      throw new Error(`Goal with id ${goalId} not found`)
    }
    goal.progress = progress

    // Auto-complete if progress reaches target
    if (isGoalComplete(goal)) {
      goal.status = 'completed'
    }
  }

  /**
   * Mark goal as completed
   */
  function markCompleted(goalId: string): void {
    const goal = findGoalRecursive(state.goals, goalId)
    if (!goal) {
      throw new Error(`Goal with id ${goalId} not found`)
    }
    goal.status = 'completed'
    goal.progress = goal.target
  }

  /**
   * Mark goal as blocked
   */
  function markBlocked(goalId: string, reason?: string): void {
    const goal = findGoalRecursive(state.goals, goalId)
    if (!goal) {
      throw new Error(`Goal with id ${goalId} not found`)
    }
    goal.status = 'blocked'
  }

  /**
   * Get progress for a specific goal
   */
  function getProgress(goalId: string): number {
    const goal = findGoalRecursive(state.goals, goalId)
    if (!goal) return 0
    return calculateProgress(goal)
  }

  /**
   * Get overall progress across all goals
   */
  function getOverallProgress(): number {
    if (state.goals.length === 0) return 0

    const totalProgress = state.goals.reduce((sum, goal) => sum + calculateProgress(goal), 0)
    return totalProgress / state.goals.length
  }
}

/**
 * Goals instance with methods
 */
export interface GoalsInstance extends GoalsConfig {
  /** Add a new goal */
  addGoal(goal: Goal): void
  /** Remove a goal */
  removeGoal(goalId: string): boolean
  /** Get a specific goal */
  getGoal(goalId: string): Goal | undefined
  /** Get all goals */
  getGoals(): Goal[]
  /** Get active goals */
  getActiveGoals(): Goal[]
  /** Get completed goals */
  getCompletedGoals(): Goal[]
  /** Get blocked goals */
  getBlockedGoals(): Goal[]
  /** Get goals by priority */
  getGoalsByPriority(priority: Priority): Goal[]
  /** Update a goal */
  updateGoal(goalId: string, updates: Partial<Omit<Goal, 'id'>>): void
  /** Update goal progress */
  updateProgress(goalId: string, progress: string | number): void
  /** Mark goal as completed */
  markCompleted(goalId: string): void
  /** Mark goal as blocked */
  markBlocked(goalId: string, reason?: string): void
  /** Get progress for a specific goal */
  getProgress(goalId: string): number
  /** Get overall progress across all goals */
  getOverallProgress(): number
}

/**
 * Find a goal recursively (including subgoals)
 */
function findGoalRecursive(goals: Goal[], goalId: string): Goal | undefined {
  for (const goal of goals) {
    if (goal.id === goalId) return goal
    if (goal.subgoals) {
      const found = findGoalRecursive(goal.subgoals, goalId)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Calculate progress percentage for a goal
 */
function calculateProgress(goal: Goal): number {
  // If no progress set, return 0
  if (goal.progress === undefined) return 0

  // If goal is completed, return 100
  if (goal.status === 'completed') return 100

  // Handle numeric progress
  if (typeof goal.progress === 'number' && typeof goal.target === 'number') {
    return calculateProgressPercent({ current: goal.progress, target: goal.target })
  }

  // Handle percentage strings
  if (typeof goal.progress === 'string' && typeof goal.target === 'string') {
    const progressMatch = goal.progress.match(/(\d+)%?/)
    const targetMatch = goal.target.match(/(\d+)%?/)

    if (progressMatch && targetMatch) {
      const progressNum = parseInt(progressMatch[1]!, 10)
      const targetNum = parseInt(targetMatch[1]!, 10)
      return calculateProgressPercent({ current: progressNum, target: targetNum })
    }
  }

  // If we have subgoals, calculate from them
  if (goal.subgoals && goal.subgoals.length > 0) {
    const subgoalProgress = goal.subgoals.reduce(
      (sum, subgoal) => sum + calculateProgress(subgoal),
      0
    )
    return subgoalProgress / goal.subgoals.length
  }

  return 0
}

/**
 * Check if a goal is complete
 */
function isGoalComplete(goal: Goal): boolean {
  // Check status
  if (goal.status === 'completed') return true

  // Check numeric progress vs target
  if (typeof goal.progress === 'number' && typeof goal.target === 'number') {
    return goal.progress >= goal.target
  }

  // Check percentage strings
  if (typeof goal.progress === 'string' && typeof goal.target === 'string') {
    const progressMatch = goal.progress.match(/(\d+)%?/)
    const targetMatch = goal.target.match(/(\d+)%?/)

    if (progressMatch && targetMatch) {
      return parseInt(progressMatch[1]!, 10) >= parseInt(targetMatch[1]!, 10)
    }
  }

  // Check subgoals
  if (goal.subgoals && goal.subgoals.length > 0) {
    return goal.subgoals.every((subgoal) => isGoalComplete(subgoal))
  }

  return false
}

/**
 * Create a simple goal
 */
export function createGoal(config: {
  id: string
  description: string
  target: string | number
  priority?: Priority
  deadline?: Date
}): Goal {
  return {
    id: config.id,
    description: config.description,
    target: config.target,
    priority: config.priority || 'medium',
    ...(config.deadline !== undefined && { deadline: config.deadline }),
    status: 'active',
  }
}

/**
 * Create a goal with subgoals
 */
export function createGoalWithSubgoals(config: {
  id: string
  description: string
  target: string | number
  subgoals: Goal[]
  priority?: Priority
  deadline?: Date
}): Goal {
  return {
    id: config.id,
    description: config.description,
    target: config.target,
    subgoals: config.subgoals,
    priority: config.priority || 'medium',
    ...(config.deadline !== undefined && { deadline: config.deadline }),
    status: 'active',
  }
}

/**
 * Check if a goal is overdue
 */
export function isGoalOverdue(goal: Goal): boolean {
  if (!goal.deadline) return false
  return new Date() > goal.deadline && goal.status !== 'completed'
}

/**
 * Get goals that are overdue
 */
export function getOverdueGoals(goals: Goal[]): Goal[] {
  return goals.filter(isGoalOverdue)
}

/**
 * Get goals due soon (within specified days)
 */
export function getGoalsDueSoon(goals: Goal[], days: number = 7): Goal[] {
  const now = new Date()
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  return goals.filter((goal) => {
    if (!goal.deadline || goal.status === 'completed') return false
    return goal.deadline <= threshold && goal.deadline > now
  })
}

/**
 * Get goals by status
 */
export function getGoalsByStatus(
  goals: Goal[],
  status: 'active' | 'completed' | 'blocked' | 'cancelled'
): Goal[] {
  return goals.filter((g) => g.status === status)
}

/**
 * Calculate time remaining until deadline
 */
export function getTimeRemaining(goal: Goal): {
  days: number
  hours: number
  minutes: number
} | null {
  if (!goal.deadline) return null

  const now = new Date()
  const diff = goal.deadline.getTime() - now.getTime()

  if (diff < 0) return { days: 0, hours: 0, minutes: 0 }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes }
}
