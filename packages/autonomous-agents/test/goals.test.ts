/**
 * Tests for Goals functionality
 *
 * Covers goals creation, progress tracking, and helper functions.
 */

import { describe, it, expect } from 'vitest'
import {
  Goals,
  createGoal,
  createGoalWithSubgoals,
  isGoalOverdue,
  getOverdueGoals,
  getGoalsDueSoon,
  getGoalsByStatus,
  getTimeRemaining,
} from '../src/index.js'
import type { Goal, GoalsConfig } from '../src/index.js'

describe('Goals', () => {
  describe('Goals creation', () => {
    it('creates goals instance with initial goals', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Launch MVP',
        target: '100%',
        status: 'active',
        priority: 'high',
      }

      const goals = Goals({ goals: [goal] })

      expect(goals.getGoals()).toHaveLength(1)
      expect(goals.getGoal('goal1')?.description).toBe('Launch MVP')
    })

    it('creates empty goals instance', () => {
      const goals = Goals({ goals: [] })

      expect(goals.getGoals()).toHaveLength(0)
    })

    it('creates goals with strategy', () => {
      const goals = Goals({
        goals: [],
        strategy: 'Focus on revenue',
      })

      expect(goals.strategy).toBe('Focus on revenue')
    })

    it('creates goals with time horizon', () => {
      const goals = Goals({
        goals: [],
        timeHorizon: 'Q1 2024',
      })

      expect(goals.timeHorizon).toBe('Q1 2024')
    })
  })

  describe('Goals management', () => {
    it('adds a goal', () => {
      const goals = Goals({ goals: [] })

      const goal: Goal = {
        id: 'goal1',
        description: 'New Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
      }

      goals.addGoal(goal)

      expect(goals.getGoals()).toHaveLength(1)
    })

    it('removes a goal', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      const result = goals.removeGoal('goal1')

      expect(result).toBe(true)
      expect(goals.getGoals()).toHaveLength(0)
    })

    it('returns false when removing non-existent goal', () => {
      const goals = Goals({ goals: [] })

      const result = goals.removeGoal('nonexistent')

      expect(result).toBe(false)
    })

    it('updates a goal', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      goals.updateGoal('goal1', { status: 'completed' })

      expect(goals.getGoal('goal1')?.status).toBe('completed')
    })

    it('throws when updating non-existent goal', () => {
      const goals = Goals({ goals: [] })

      expect(() => {
        goals.updateGoal('nonexistent', { status: 'completed' })
      }).toThrow()
    })

    it('gets a goal by id', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      const retrieved = goals.getGoal('goal1')

      expect(retrieved?.description).toBe('Goal')
    })

    it('returns undefined for non-existent goal', () => {
      const goals = Goals({ goals: [] })

      expect(goals.getGoal('nonexistent')).toBeUndefined()
    })
  })

  describe('Goals progress', () => {
    it('updates progress', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: 100,
        progress: 0,
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      goals.updateProgress('goal1', 50)

      expect(goals.getGoal('goal1')?.progress).toBe(50)
    })

    it('marks goal as completed when progress reaches target', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: 100,
        progress: 50,
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      goals.updateProgress('goal1', 100)

      expect(goals.getGoal('goal1')?.status).toBe('completed')
    })

    it('marks goal as completed', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: 100,
        progress: 50,
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      goals.markCompleted('goal1')

      expect(goals.getGoal('goal1')?.status).toBe('completed')
      expect(goals.getGoal('goal1')?.progress).toBe(100)
    })

    it('marks goal as blocked', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: 100,
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      goals.markBlocked('goal1', 'Waiting on resources')

      expect(goals.getGoal('goal1')?.status).toBe('blocked')
    })

    it('gets progress for a goal', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: 100,
        progress: 75,
        status: 'active',
        priority: 'medium',
      }

      const goals = Goals({ goals: [goal] })

      const progress = goals.getProgress('goal1')

      expect(progress).toBe(75)
    })

    it('calculates overall progress', () => {
      const goals = Goals({
        goals: [
          { id: '1', description: 'Goal 1', target: 100, progress: 50, status: 'active', priority: 'medium' },
          { id: '2', description: 'Goal 2', target: 100, progress: 100, status: 'completed', priority: 'medium' },
        ],
      })

      const progress = goals.getOverallProgress()

      expect(progress).toBe(75) // (50 + 100) / 2
    })

    it('returns 0 for empty goals', () => {
      const goals = Goals({ goals: [] })

      const progress = goals.getOverallProgress()

      expect(progress).toBe(0)
    })
  })

  describe('Goals filtering', () => {
    it('gets active goals', () => {
      const goals = Goals({
        goals: [
          { id: '1', description: 'Goal 1', target: 100, status: 'active', priority: 'medium' },
          { id: '2', description: 'Goal 2', target: 100, status: 'completed', priority: 'medium' },
          { id: '3', description: 'Goal 3', target: 100, status: 'active', priority: 'medium' },
        ],
      })

      const active = goals.getActiveGoals()

      expect(active).toHaveLength(2)
    })

    it('gets completed goals', () => {
      const goals = Goals({
        goals: [
          { id: '1', description: 'Goal 1', target: 100, status: 'active', priority: 'medium' },
          { id: '2', description: 'Goal 2', target: 100, status: 'completed', priority: 'medium' },
        ],
      })

      const completed = goals.getCompletedGoals()

      expect(completed).toHaveLength(1)
    })

    it('gets blocked goals', () => {
      const goals = Goals({
        goals: [
          { id: '1', description: 'Goal 1', target: 100, status: 'active', priority: 'medium' },
          { id: '2', description: 'Goal 2', target: 100, status: 'blocked', priority: 'medium' },
        ],
      })

      const blocked = goals.getBlockedGoals()

      expect(blocked).toHaveLength(1)
    })

    it('gets goals by priority', () => {
      const goals = Goals({
        goals: [
          { id: '1', description: 'Goal 1', target: 100, status: 'active', priority: 'high' },
          { id: '2', description: 'Goal 2', target: 100, status: 'active', priority: 'medium' },
          { id: '3', description: 'Goal 3', target: 100, status: 'active', priority: 'high' },
        ],
      })

      const highPriority = goals.getGoalsByPriority('high')

      expect(highPriority).toHaveLength(2)
    })
  })

  describe('createGoal', () => {
    it('creates a basic goal', () => {
      const goal = createGoal({
        id: 'goal1',
        description: 'Launch Product',
        target: '100%',
        priority: 'high',
      })

      expect(goal.id).toBe('goal1')
      expect(goal.description).toBe('Launch Product')
      expect(goal.status).toBe('active')
      expect(goal.priority).toBe('high')
    })

    it('creates a goal with deadline', () => {
      const deadline = new Date('2024-12-31')
      const goal = createGoal({
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        deadline,
      })

      expect(goal.deadline).toEqual(deadline)
    })

    it('uses default priority', () => {
      const goal = createGoal({
        id: 'goal1',
        description: 'Goal',
        target: '100%',
      })

      expect(goal.priority).toBe('medium')
    })
  })

  describe('createGoalWithSubgoals', () => {
    it('creates a goal with subgoals', () => {
      const goal = createGoalWithSubgoals({
        id: 'main',
        description: 'Main Goal',
        target: '100%',
        priority: 'high',
        subgoals: [
          { id: 'sub1', description: 'Subgoal 1', target: '100%', status: 'active', priority: 'medium' },
          { id: 'sub2', description: 'Subgoal 2', target: '100%', status: 'active', priority: 'medium' },
        ],
      })

      expect(goal.subgoals).toHaveLength(2)
      expect(goal.subgoals?.[0]?.description).toBe('Subgoal 1')
    })
  })

  describe('isGoalOverdue', () => {
    it('returns true for overdue goal', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
        deadline: new Date('2020-01-01'),
      }

      expect(isGoalOverdue(goal)).toBe(true)
    })

    it('returns false for future goal', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
        deadline: new Date('2030-01-01'),
      }

      expect(isGoalOverdue(goal)).toBe(false)
    })

    it('returns false for completed goal', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'completed',
        priority: 'medium',
        deadline: new Date('2020-01-01'),
      }

      expect(isGoalOverdue(goal)).toBe(false)
    })

    it('returns false for goal without deadline', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
      }

      expect(isGoalOverdue(goal)).toBe(false)
    })
  })

  describe('getOverdueGoals', () => {
    it('returns all overdue goals', () => {
      const goalsArray: Goal[] = [
        { id: '1', description: 'Goal 1', target: '100%', status: 'active', priority: 'medium', deadline: new Date('2020-01-01') },
        { id: '2', description: 'Goal 2', target: '100%', status: 'active', priority: 'medium', deadline: new Date('2030-01-01') },
        { id: '3', description: 'Goal 3', target: '100%', status: 'completed', priority: 'medium', deadline: new Date('2020-01-01') },
      ]

      const overdue = getOverdueGoals(goalsArray)

      expect(overdue).toHaveLength(1)
      expect(overdue[0]?.id).toBe('1')
    })

    it('returns empty array when no overdue goals', () => {
      const goalsArray: Goal[] = [
        { id: '1', description: 'Goal 1', target: '100%', status: 'completed', priority: 'medium' },
        { id: '2', description: 'Goal 2', target: '100%', status: 'active', priority: 'medium', deadline: new Date('2030-01-01') },
      ]

      const overdue = getOverdueGoals(goalsArray)

      expect(overdue).toHaveLength(0)
    })
  })

  describe('getGoalsDueSoon', () => {
    it('returns goals due within specified days', () => {
      const today = new Date()
      const inTwoDays = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
      const inTenDays = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)

      const goalsArray: Goal[] = [
        { id: '1', description: 'Goal 1', target: '100%', status: 'active', priority: 'medium', deadline: inTwoDays },
        { id: '2', description: 'Goal 2', target: '100%', status: 'active', priority: 'medium', deadline: inTenDays },
      ]

      const dueSoon = getGoalsDueSoon(goalsArray, 7)

      expect(dueSoon).toHaveLength(1)
      expect(dueSoon[0]?.id).toBe('1')
    })

    it('excludes completed goals', () => {
      const today = new Date()
      const inTwoDays = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)

      const goalsArray: Goal[] = [
        { id: '1', description: 'Goal 1', target: '100%', status: 'completed', priority: 'medium', deadline: inTwoDays },
      ]

      const dueSoon = getGoalsDueSoon(goalsArray, 7)

      expect(dueSoon).toHaveLength(0)
    })
  })

  describe('getGoalsByStatus', () => {
    it('returns goals matching status', () => {
      const goalsArray: Goal[] = [
        { id: '1', description: 'Goal 1', target: '100%', status: 'active', priority: 'medium' },
        { id: '2', description: 'Goal 2', target: '100%', status: 'blocked', priority: 'medium' },
        { id: '3', description: 'Goal 3', target: '100%', status: 'completed', priority: 'medium' },
        { id: '4', description: 'Goal 4', target: '100%', status: 'active', priority: 'medium' },
      ]

      expect(getGoalsByStatus(goalsArray, 'active')).toHaveLength(2)
      expect(getGoalsByStatus(goalsArray, 'blocked')).toHaveLength(1)
      expect(getGoalsByStatus(goalsArray, 'completed')).toHaveLength(1)
    })
  })

  describe('getTimeRemaining', () => {
    it('returns time remaining for future goal', () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
        deadline: future,
      }

      const remaining = getTimeRemaining(goal)

      expect(remaining).not.toBeNull()
      expect(remaining!.days).toBeGreaterThanOrEqual(1)
    })

    it('returns null for goal without deadline', () => {
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
      }

      const remaining = getTimeRemaining(goal)

      expect(remaining).toBeNull()
    })

    it('returns zero values for overdue goal', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      const goal: Goal = {
        id: 'goal1',
        description: 'Goal',
        target: '100%',
        status: 'active',
        priority: 'medium',
        deadline: past,
      }

      const remaining = getTimeRemaining(goal)

      expect(remaining).not.toBeNull()
      expect(remaining!.days).toBe(0)
      expect(remaining!.hours).toBe(0)
      expect(remaining!.minutes).toBe(0)
    })
  })

  describe('Goals with subgoals', () => {
    it('finds goal within subgoals', () => {
      const goals = Goals({
        goals: [
          {
            id: 'main',
            description: 'Main Goal',
            target: '100%',
            status: 'active',
            priority: 'high',
            subgoals: [
              { id: 'sub1', description: 'Subgoal 1', target: '100%', status: 'active', priority: 'medium' },
            ],
          },
        ],
      })

      const subgoal = goals.getGoal('sub1')

      expect(subgoal?.description).toBe('Subgoal 1')
    })
  })
})
