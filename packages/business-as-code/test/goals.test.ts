/**
 * Tests for goals.ts - Business goals definition and tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Goals,
  Goal,
  updateProgress,
  markAtRisk,
  complete,
  isOverdue,
  getGoalsByCategory,
  getGoalsByStatus,
  getGoalsByOwner,
  calculateOverallProgress,
  hasCircularDependencies,
  sortByDependencies,
  validateGoals,
} from '../src/goals.js'
import type { GoalDefinition } from '../src/types.js'

describe('Goals', () => {
  describe('Goals()', () => {
    it('should create multiple goals', () => {
      const goals = Goals([{ name: 'Goal 1' }, { name: 'Goal 2' }])

      expect(goals).toHaveLength(2)
      expect(goals[0]?.name).toBe('Goal 1')
      expect(goals[1]?.name).toBe('Goal 2')
    })

    it('should normalize goal defaults', () => {
      const goals = Goals([{ name: 'Test Goal' }])

      expect(goals[0]?.category).toBe('operational')
      expect(goals[0]?.status).toBe('not-started')
      expect(goals[0]?.progress).toBe(0)
      expect(goals[0]?.metrics).toEqual([])
      expect(goals[0]?.dependencies).toEqual([])
      expect(goals[0]?.metadata).toEqual({})
    })

    it('should preserve provided values', () => {
      const goals = Goals([
        {
          name: 'Strategic Goal',
          category: 'strategic',
          status: 'in-progress',
          progress: 50,
          metrics: ['Revenue', 'Growth'],
        },
      ])

      expect(goals[0]?.category).toBe('strategic')
      expect(goals[0]?.status).toBe('in-progress')
      expect(goals[0]?.progress).toBe(50)
      expect(goals[0]?.metrics).toEqual(['Revenue', 'Growth'])
    })

    it('should throw error for goal without name', () => {
      expect(() => Goals([{ name: '' }])).toThrow('Goal name is required')
    })
  })

  describe('Goal()', () => {
    it('should create a single goal', () => {
      const goal = Goal({ name: 'Single Goal', category: 'financial' })

      expect(goal.name).toBe('Single Goal')
      expect(goal.category).toBe('financial')
    })

    it('should throw error for goal without name', () => {
      expect(() => Goal({ name: '' })).toThrow('Goal name is required')
    })
  })

  describe('updateProgress()', () => {
    it('should update progress to 50%', () => {
      const goal = Goal({ name: 'Test' })
      const updated = updateProgress(goal, 50)

      expect(updated.progress).toBe(50)
      expect(updated.status).toBe('in-progress')
    })

    it('should mark as completed at 100%', () => {
      const goal = Goal({ name: 'Test', status: 'in-progress' })
      const updated = updateProgress(goal, 100)

      expect(updated.progress).toBe(100)
      expect(updated.status).toBe('completed')
    })

    it('should mark as not-started at 0%', () => {
      const goal = Goal({ name: 'Test', status: 'in-progress', progress: 50 })
      const updated = updateProgress(goal, 0)

      expect(updated.progress).toBe(0)
      expect(updated.status).toBe('not-started')
    })

    it('should throw error for progress below 0', () => {
      const goal = Goal({ name: 'Test' })
      expect(() => updateProgress(goal, -10)).toThrow('Progress must be between 0 and 100')
    })

    it('should throw error for progress above 100', () => {
      const goal = Goal({ name: 'Test' })
      expect(() => updateProgress(goal, 150)).toThrow('Progress must be between 0 and 100')
    })

    it('should handle edge case of exactly 0', () => {
      const goal = Goal({ name: 'Test', progress: 50 })
      const updated = updateProgress(goal, 0)

      expect(updated.progress).toBe(0)
      expect(updated.status).toBe('not-started')
    })

    it('should handle edge case of exactly 100', () => {
      const goal = Goal({ name: 'Test' })
      const updated = updateProgress(goal, 100)

      expect(updated.progress).toBe(100)
      expect(updated.status).toBe('completed')
    })
  })

  describe('markAtRisk()', () => {
    it('should mark goal as at-risk', () => {
      const goal = Goal({ name: 'Test', status: 'in-progress' })
      const updated = markAtRisk(goal)

      expect(updated.status).toBe('at-risk')
    })

    it('should preserve other goal properties', () => {
      const goal = Goal({ name: 'Test', progress: 50, owner: 'Alice' })
      const updated = markAtRisk(goal)

      expect(updated.name).toBe('Test')
      expect(updated.progress).toBe(50)
      expect(updated.owner).toBe('Alice')
    })
  })

  describe('complete()', () => {
    it('should mark goal as completed with 100% progress', () => {
      const goal = Goal({ name: 'Test', status: 'in-progress', progress: 80 })
      const updated = complete(goal)

      expect(updated.status).toBe('completed')
      expect(updated.progress).toBe(100)
    })
  })

  describe('isOverdue()', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return true for overdue goal', () => {
      const goal = Goal({
        name: 'Test',
        targetDate: new Date('2024-06-01'),
        status: 'in-progress',
      })

      expect(isOverdue(goal)).toBe(true)
    })

    it('should return false for goal with future target date', () => {
      const goal = Goal({
        name: 'Test',
        targetDate: new Date('2024-12-31'),
        status: 'in-progress',
      })

      expect(isOverdue(goal)).toBe(false)
    })

    it('should return false for completed goal even if past target date', () => {
      const goal = Goal({
        name: 'Test',
        targetDate: new Date('2024-06-01'),
        status: 'completed',
      })

      expect(isOverdue(goal)).toBe(false)
    })

    it('should return false for goal without target date', () => {
      const goal = Goal({ name: 'Test' })
      expect(isOverdue(goal)).toBe(false)
    })
  })

  describe('getGoalsByCategory()', () => {
    const goals = Goals([
      { name: 'Goal 1', category: 'strategic' },
      { name: 'Goal 2', category: 'operational' },
      { name: 'Goal 3', category: 'strategic' },
      { name: 'Goal 4', category: 'financial' },
    ])

    it('should filter goals by category', () => {
      const strategic = getGoalsByCategory(goals, 'strategic')

      expect(strategic).toHaveLength(2)
      expect(strategic[0]?.name).toBe('Goal 1')
      expect(strategic[1]?.name).toBe('Goal 3')
    })

    it('should return empty array for non-existent category', () => {
      const learning = getGoalsByCategory(goals, 'learning')
      expect(learning).toHaveLength(0)
    })
  })

  describe('getGoalsByStatus()', () => {
    const goals = Goals([
      { name: 'Goal 1', status: 'in-progress' },
      { name: 'Goal 2', status: 'completed' },
      { name: 'Goal 3', status: 'in-progress' },
    ])

    it('should filter goals by status', () => {
      const inProgress = getGoalsByStatus(goals, 'in-progress')

      expect(inProgress).toHaveLength(2)
      expect(inProgress[0]?.name).toBe('Goal 1')
      expect(inProgress[1]?.name).toBe('Goal 3')
    })

    it('should return empty array for non-existent status', () => {
      const cancelled = getGoalsByStatus(goals, 'cancelled')
      expect(cancelled).toHaveLength(0)
    })
  })

  describe('getGoalsByOwner()', () => {
    const goals = Goals([
      { name: 'Goal 1', owner: 'Alice' },
      { name: 'Goal 2', owner: 'Bob' },
      { name: 'Goal 3', owner: 'Alice' },
    ])

    it('should filter goals by owner', () => {
      const aliceGoals = getGoalsByOwner(goals, 'Alice')

      expect(aliceGoals).toHaveLength(2)
      expect(aliceGoals[0]?.name).toBe('Goal 1')
      expect(aliceGoals[1]?.name).toBe('Goal 3')
    })

    it('should return empty array for non-existent owner', () => {
      const charlieGoals = getGoalsByOwner(goals, 'Charlie')
      expect(charlieGoals).toHaveLength(0)
    })
  })

  describe('calculateOverallProgress()', () => {
    it('should return 0 for empty goals array', () => {
      expect(calculateOverallProgress([])).toBe(0)
    })

    it('should calculate average progress', () => {
      const goals = Goals([
        { name: 'Goal 1', progress: 50 },
        { name: 'Goal 2', progress: 100 },
      ])

      expect(calculateOverallProgress(goals)).toBe(75)
    })

    it('should handle goals with 0 progress', () => {
      const goals = Goals([
        { name: 'Goal 1', progress: 0 },
        { name: 'Goal 2', progress: 100 },
      ])

      expect(calculateOverallProgress(goals)).toBe(50)
    })

    it('should handle single goal', () => {
      const goals = Goals([{ name: 'Goal 1', progress: 75 }])
      expect(calculateOverallProgress(goals)).toBe(75)
    })
  })

  describe('hasCircularDependencies()', () => {
    it('should return false for goals without dependencies', () => {
      const goals = Goals([{ name: 'Goal 1' }, { name: 'Goal 2' }])

      expect(hasCircularDependencies(goals)).toBe(false)
    })

    it('should return false for linear dependencies', () => {
      const goals = Goals([
        { name: 'Goal 1' },
        { name: 'Goal 2', dependencies: ['Goal 1'] },
        { name: 'Goal 3', dependencies: ['Goal 2'] },
      ])

      expect(hasCircularDependencies(goals)).toBe(false)
    })

    it('should detect direct circular dependency', () => {
      const goals: GoalDefinition[] = [
        { name: 'Goal 1', dependencies: ['Goal 2'] },
        { name: 'Goal 2', dependencies: ['Goal 1'] },
      ]

      expect(hasCircularDependencies(goals)).toBe(true)
    })

    it('should detect indirect circular dependency', () => {
      const goals: GoalDefinition[] = [
        { name: 'Goal 1', dependencies: ['Goal 3'] },
        { name: 'Goal 2', dependencies: ['Goal 1'] },
        { name: 'Goal 3', dependencies: ['Goal 2'] },
      ]

      expect(hasCircularDependencies(goals)).toBe(true)
    })

    it('should handle self-referencing dependency', () => {
      const goals: GoalDefinition[] = [{ name: 'Goal 1', dependencies: ['Goal 1'] }]

      expect(hasCircularDependencies(goals)).toBe(true)
    })
  })

  describe('sortByDependencies()', () => {
    it('should return goals in dependency order', () => {
      const goals = Goals([
        { name: 'Goal C', dependencies: ['Goal B'] },
        { name: 'Goal A' },
        { name: 'Goal B', dependencies: ['Goal A'] },
      ])

      const sorted = sortByDependencies(goals)

      expect(sorted[0]?.name).toBe('Goal A')
      expect(sorted[1]?.name).toBe('Goal B')
      expect(sorted[2]?.name).toBe('Goal C')
    })

    it('should handle goals without dependencies', () => {
      const goals = Goals([{ name: 'Goal B' }, { name: 'Goal A' }])

      const sorted = sortByDependencies(goals)

      expect(sorted).toHaveLength(2)
    })

    it('should handle complex dependency graph', () => {
      const goals = Goals([
        { name: 'Deploy', dependencies: ['Test', 'Build'] },
        { name: 'Build', dependencies: ['Design'] },
        { name: 'Design' },
        { name: 'Test', dependencies: ['Build'] },
      ])

      const sorted = sortByDependencies(goals)

      // Design should come before Build
      const designIndex = sorted.findIndex((g) => g.name === 'Design')
      const buildIndex = sorted.findIndex((g) => g.name === 'Build')
      const testIndex = sorted.findIndex((g) => g.name === 'Test')
      const deployIndex = sorted.findIndex((g) => g.name === 'Deploy')

      expect(designIndex).toBeLessThan(buildIndex)
      expect(buildIndex).toBeLessThan(testIndex)
      expect(testIndex).toBeLessThan(deployIndex)
    })
  })

  describe('validateGoals()', () => {
    it('should validate valid goals', () => {
      const goals = Goals([
        { name: 'Goal 1', progress: 50 },
        { name: 'Goal 2', progress: 75 },
      ])

      const result = validateGoals(goals)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for goal without name', () => {
      const goals: GoalDefinition[] = [{ name: '' }]
      const result = validateGoals(goals)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Goal name is required')
    })

    it('should fail for progress out of range', () => {
      const goals: GoalDefinition[] = [{ name: 'Test', progress: 150 }]
      const result = validateGoals(goals)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Goal Test progress must be between 0 and 100')
    })

    it('should fail for negative progress', () => {
      const goals: GoalDefinition[] = [{ name: 'Test', progress: -10 }]
      const result = validateGoals(goals)

      expect(result.valid).toBe(false)
    })

    it('should fail for unknown dependency', () => {
      const goals: GoalDefinition[] = [{ name: 'Goal 1', dependencies: ['NonExistent'] }]
      const result = validateGoals(goals)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Goal Goal 1 depends on unknown goal: NonExistent')
    })

    it('should fail for circular dependencies', () => {
      const goals: GoalDefinition[] = [
        { name: 'Goal 1', dependencies: ['Goal 2'] },
        { name: 'Goal 2', dependencies: ['Goal 1'] },
      ]
      const result = validateGoals(goals)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Circular dependencies detected in goals')
    })

    it('should return multiple errors', () => {
      const goals: GoalDefinition[] = [
        { name: '', progress: 150 },
        { name: 'Goal 2', dependencies: ['NonExistent'] },
      ]
      const result = validateGoals(goals)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})
