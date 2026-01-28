/**
 * Tests for all type guard functions in org.ai
 *
 * Tests isRole, isTeam, isGoal, isKPI, isOKR and all other type guards
 * from both org.ai organizational types and @org.ai/types foundation types.
 */

import { describe, it, expect } from 'vitest'

import {
  // Organizational type guards
  isRole,
  isTeam,
  isGoal,
  isKPI,
  isOKR,
  // Foundation type guards from @org.ai/types
  isWorker,
  isAgent,
  isHuman,
  isTool,
  isToolParameter,
  isToolExecutionResult,
  isToolValidationError,
  isLeanCanvas,
  isStoryBrand,
  isFounder,
  isStartup,
  isICP,
  isThingId,
  isActionId,
  isEventId,
  isToolId,
  // Type constants for test data
  WORKER_TYPE,
  AGENT_TYPE,
  HUMAN_TYPE,
  TOOL_TYPE,
  LEAN_CANVAS_TYPE,
  STORY_BRAND_TYPE,
  FOUNDER_TYPE,
  STARTUP_TYPE,
  ICP_TYPE,
} from '../src/index.js'

describe('Type Guards', () => {
  // ==========================================================================
  // Organizational Type Guards
  // ==========================================================================
  describe('isRole', () => {
    it('returns true for valid minimal role', () => {
      const role = {
        id: 'role_1',
        name: 'Engineer',
        description: 'Software engineer role',
        skills: ['TypeScript', 'React'],
      }
      expect(isRole(role)).toBe(true)
    })

    it('returns true for role with all optional fields', () => {
      const role = {
        id: 'role_2',
        name: 'Manager',
        description: 'Engineering manager',
        skills: ['leadership', 'communication'],
        permissions: ['team:manage'],
        type: 'manager',
        department: 'Engineering',
        level: 5,
        workerType: 'human',
      }
      expect(isRole(role)).toBe(true)
    })

    it('returns false for missing id', () => {
      const invalid = {
        name: 'Test Role',
        description: 'Test',
        skills: [],
      }
      expect(isRole(invalid)).toBe(false)
    })

    it('returns false for missing name', () => {
      const invalid = {
        id: 'role_1',
        description: 'Test',
        skills: [],
      }
      expect(isRole(invalid)).toBe(false)
    })

    it('returns false for missing description', () => {
      const invalid = {
        id: 'role_1',
        name: 'Test',
        skills: [],
      }
      expect(isRole(invalid)).toBe(false)
    })

    it('returns false for missing skills array', () => {
      const invalid = {
        id: 'role_1',
        name: 'Test',
        description: 'Test',
      }
      expect(isRole(invalid)).toBe(false)
    })

    it('returns false for non-array skills', () => {
      const invalid = {
        id: 'role_1',
        name: 'Test',
        description: 'Test',
        skills: 'not-an-array',
      }
      expect(isRole(invalid)).toBe(false)
    })

    it('returns false for null', () => {
      expect(isRole(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isRole(undefined)).toBe(false)
    })

    it('returns false for primitive values', () => {
      expect(isRole('string')).toBe(false)
      expect(isRole(123)).toBe(false)
      expect(isRole(true)).toBe(false)
    })
  })

  describe('isTeam', () => {
    it('returns true for valid minimal team', () => {
      const team = {
        id: 'team_1',
        name: 'Engineering',
        members: [],
      }
      expect(isTeam(team)).toBe(true)
    })

    it('returns true for team with members', () => {
      const team = {
        id: 'team_2',
        name: 'Product',
        members: [
          { id: 'member_1', name: 'Alice', type: 'human' },
          { id: 'member_2', name: 'Bob', type: 'agent' },
        ],
      }
      expect(isTeam(team)).toBe(true)
    })

    it('returns true for team with all optional fields', () => {
      const team = {
        id: 'team_3',
        name: 'Full Team',
        description: 'A complete team',
        members: [],
        lead: { id: 'lead_1', name: 'Lead', type: 'human' },
        goals: [],
        channels: [],
        contacts: { slack: '#team' },
        context: { project: 'main' },
        metadata: { costCenter: 'CC-001' },
      }
      expect(isTeam(team)).toBe(true)
    })

    it('returns false for missing id', () => {
      expect(isTeam({ name: 'Team', members: [] })).toBe(false)
    })

    it('returns false for missing name', () => {
      expect(isTeam({ id: 'team_1', members: [] })).toBe(false)
    })

    it('returns false for missing members', () => {
      expect(isTeam({ id: 'team_1', name: 'Team' })).toBe(false)
    })

    it('returns false for non-array members', () => {
      expect(isTeam({ id: 'team_1', name: 'Team', members: 'not-array' })).toBe(false)
    })

    it('returns false for null and undefined', () => {
      expect(isTeam(null)).toBe(false)
      expect(isTeam(undefined)).toBe(false)
    })
  })

  describe('isGoal', () => {
    it('returns true for valid goal with numeric target', () => {
      const goal = {
        id: 'goal_1',
        name: 'Revenue Goal',
        description: 'Increase revenue',
        target: 1000000,
        progress: 500000,
        status: 'in-progress',
      }
      expect(isGoal(goal)).toBe(true)
    })

    it('returns true for valid goal with string target', () => {
      const goal = {
        id: 'goal_2',
        name: 'Launch Goal',
        description: 'Launch product',
        target: 'Q4 2024',
        progress: 'On track',
        status: 'in-progress',
      }
      expect(isGoal(goal)).toBe(true)
    })

    it('returns true for goal with all optional fields', () => {
      const goal = {
        id: 'goal_3',
        name: 'Complete Goal',
        description: 'Full goal',
        target: 100,
        progress: 75,
        status: 'in-progress',
        targetDate: new Date(),
        owner: 'CEO',
        category: 'strategic',
        priority: 'high',
        successCriteria: ['Metric > X'],
        metrics: ['Revenue'],
        dependencies: ['goal_1'],
        subgoals: [],
        metadata: {},
      }
      expect(isGoal(goal)).toBe(true)
    })

    it('returns false for missing required fields', () => {
      expect(isGoal({ name: 'Test' })).toBe(false)
      expect(isGoal({ id: 'goal_1' })).toBe(false)
      expect(isGoal({ id: 'goal_1', name: 'Test' })).toBe(false)
    })

    it('returns false for invalid target type', () => {
      const invalid = {
        id: 'goal_1',
        name: 'Test',
        description: 'Test',
        target: { invalid: true },
        progress: 50,
        status: 'in-progress',
      }
      expect(isGoal(invalid)).toBe(false)
    })

    it('returns false for null and undefined', () => {
      expect(isGoal(null)).toBe(false)
      expect(isGoal(undefined)).toBe(false)
    })
  })

  describe('isKPI', () => {
    it('returns true for valid KPI with numeric value', () => {
      const kpi = {
        id: 'kpi_1',
        name: 'MRR',
        value: 85000,
        target: 100000,
        unit: 'USD',
      }
      expect(isKPI(kpi)).toBe(true)
    })

    it('returns true for valid KPI with string value', () => {
      const kpi = {
        id: 'kpi_2',
        name: 'Customer Satisfaction',
        value: 'High',
        target: 'Very High',
        unit: 'rating',
      }
      expect(isKPI(kpi)).toBe(true)
    })

    it('returns true for KPI with all optional fields', () => {
      const kpi = {
        id: 'kpi_3',
        name: 'Complete KPI',
        description: 'Full KPI',
        value: 75,
        current: 75,
        target: 100,
        unit: 'percent',
        trend: 'up',
        frequency: 'monthly',
        category: 'financial',
        dataSource: 'Analytics',
        formula: 'value/target*100',
        history: [{ timestamp: new Date(), value: 50 }],
        metadata: {},
      }
      expect(isKPI(kpi)).toBe(true)
    })

    it('returns false for missing required fields', () => {
      expect(isKPI({ name: 'Test' })).toBe(false)
      expect(isKPI({ id: 'kpi_1', name: 'Test' })).toBe(false)
      expect(isKPI({ id: 'kpi_1', name: 'Test', value: 100 })).toBe(false)
    })

    it('returns false for invalid value type', () => {
      const invalid = {
        id: 'kpi_1',
        name: 'Test',
        value: { invalid: true },
        target: 100,
        unit: 'count',
      }
      expect(isKPI(invalid)).toBe(false)
    })

    it('returns false for null and undefined', () => {
      expect(isKPI(null)).toBe(false)
      expect(isKPI(undefined)).toBe(false)
    })
  })

  describe('isOKR', () => {
    it('returns true for valid minimal OKR', () => {
      const okr = {
        objective: 'Improve customer satisfaction',
        keyResults: [{ description: 'Increase NPS', targetValue: 60 }],
      }
      expect(isOKR(okr)).toBe(true)
    })

    it('returns true for OKR with id', () => {
      const okr = {
        id: 'okr_1',
        objective: 'Test objective',
        keyResults: [{ description: 'KR 1', targetValue: 100 }],
      }
      expect(isOKR(okr)).toBe(true)
    })

    it('returns true for OKR with all optional fields', () => {
      const okr = {
        id: 'okr_2',
        objective: 'Complete OKR',
        description: 'Full OKR with all fields',
        keyResults: [
          {
            id: 'kr_1',
            description: 'Key Result 1',
            metric: 'Revenue',
            startValue: 0,
            targetValue: 100,
            currentValue: 50,
            current: 50,
            target: 100,
            unit: 'percent',
            progress: 50,
            status: 'on-track',
          },
        ],
        owner: 'CEO',
        period: 'Q1 2024',
        dueDate: new Date(),
        status: 'on-track',
        progress: 50,
        confidence: 80,
        metadata: {},
      }
      expect(isOKR(okr)).toBe(true)
    })

    it('returns false for missing objective', () => {
      expect(isOKR({ keyResults: [] })).toBe(false)
    })

    it('returns false for missing keyResults', () => {
      expect(isOKR({ objective: 'Test' })).toBe(false)
    })

    it('returns false for non-array keyResults', () => {
      expect(isOKR({ objective: 'Test', keyResults: 'not-array' })).toBe(false)
    })

    it('returns false for null and undefined', () => {
      expect(isOKR(null)).toBe(false)
      expect(isOKR(undefined)).toBe(false)
    })
  })

  // ==========================================================================
  // Foundation Type Guards
  // ==========================================================================
  describe('isWorker', () => {
    it('returns true for valid worker', () => {
      const worker = {
        $id: 'https://example.com/workers/1',
        $type: WORKER_TYPE,
        status: 'idle',
      }
      expect(isWorker(worker)).toBe(true)
    })

    it('returns true for agent (subtype of worker)', () => {
      const agent = {
        $id: 'https://example.com/agents/1',
        $type: AGENT_TYPE,
        status: 'working',
        model: 'claude-3',
        autonomous: true,
      }
      expect(isWorker(agent)).toBe(true)
    })

    it('returns true for human (subtype of worker)', () => {
      const human = {
        $id: 'https://example.com/humans/1',
        $type: HUMAN_TYPE,
        status: 'idle',
      }
      expect(isWorker(human)).toBe(true)
    })

    it('returns false for invalid status', () => {
      const invalid = {
        $id: 'https://example.com/workers/1',
        $type: WORKER_TYPE,
        status: 'invalid-status',
      }
      expect(isWorker(invalid)).toBe(false)
    })

    it('returns false for null and undefined', () => {
      expect(isWorker(null)).toBe(false)
      expect(isWorker(undefined)).toBe(false)
    })
  })

  describe('isAgent', () => {
    it('returns true for valid agent', () => {
      const agent = {
        $id: 'https://example.com/agents/1',
        $type: AGENT_TYPE,
        status: 'idle',
        model: 'claude-3-opus',
        autonomous: false,
      }
      expect(isAgent(agent)).toBe(true)
    })

    it('returns false for human', () => {
      const human = {
        $id: 'https://example.com/humans/1',
        $type: HUMAN_TYPE,
        status: 'idle',
      }
      expect(isAgent(human)).toBe(false)
    })

    it('returns false for missing model', () => {
      const invalid = {
        $id: 'https://example.com/agents/1',
        $type: AGENT_TYPE,
        status: 'idle',
        autonomous: true,
      }
      expect(isAgent(invalid)).toBe(false)
    })

    it('returns false for missing autonomous', () => {
      const invalid = {
        $id: 'https://example.com/agents/1',
        $type: AGENT_TYPE,
        status: 'idle',
        model: 'test',
      }
      expect(isAgent(invalid)).toBe(false)
    })
  })

  describe('isHuman', () => {
    it('returns true for valid human', () => {
      const human = {
        $id: 'https://example.com/humans/1',
        $type: HUMAN_TYPE,
        status: 'idle',
      }
      expect(isHuman(human)).toBe(true)
    })

    it('returns false for agent', () => {
      const agent = {
        $id: 'https://example.com/agents/1',
        $type: AGENT_TYPE,
        status: 'idle',
        model: 'test',
        autonomous: false,
      }
      expect(isHuman(agent)).toBe(false)
    })
  })

  describe('isTool', () => {
    it('returns true for valid tool', () => {
      const tool = {
        $id: 'https://example.com/tools/search',
        $type: TOOL_TYPE,
        name: 'Search',
      }
      expect(isTool(tool)).toBe(true)
    })

    it('returns false for wrong $type', () => {
      const invalid = {
        $id: 'https://example.com/tools/1',
        $type: 'https://other.type',
        name: 'Test',
      }
      expect(isTool(invalid)).toBe(false)
    })

    it('returns false for missing name', () => {
      const invalid = {
        $id: 'https://example.com/tools/1',
        $type: TOOL_TYPE,
      }
      expect(isTool(invalid)).toBe(false)
    })
  })

  describe('Business Framework Type Guards', () => {
    it('isLeanCanvas validates lean canvas', () => {
      const canvas = {
        $id: 'https://example.com/canvas/1',
        $type: LEAN_CANVAS_TYPE,
      }
      expect(isLeanCanvas(canvas)).toBe(true)
      expect(isLeanCanvas({})).toBe(false)
    })

    it('isStoryBrand validates story brand', () => {
      const brand = {
        $id: 'https://example.com/brand/1',
        $type: STORY_BRAND_TYPE,
      }
      expect(isStoryBrand(brand)).toBe(true)
      expect(isStoryBrand({})).toBe(false)
    })

    it('isFounder validates founder', () => {
      const founder = {
        $id: 'https://example.com/founders/1',
        $type: FOUNDER_TYPE,
      }
      expect(isFounder(founder)).toBe(true)
      expect(isFounder({})).toBe(false)
    })

    it('isStartup validates startup', () => {
      const startup = {
        $id: 'https://example.com/startups/1',
        $type: STARTUP_TYPE,
        name: 'Acme Inc',
        stage: 'validating',
      }
      expect(isStartup(startup)).toBe(true)
      expect(isStartup({ $type: STARTUP_TYPE })).toBe(false) // missing required fields
    })

    it('isICP validates ICP', () => {
      const icp = {
        $id: 'https://example.com/icps/1',
        $type: ICP_TYPE,
      }
      expect(isICP(icp)).toBe(true)
      expect(isICP({})).toBe(false)
    })
  })

  describe('Branded ID Type Guards', () => {
    it('isThingId validates thing IDs', () => {
      expect(isThingId('https://example.com/things/123')).toBe(true)
      expect(isThingId('https://example.com/customers/456')).toBe(true)
      expect(isThingId('simple-string')).toBe(false)
    })

    it('isActionId validates action IDs', () => {
      expect(isActionId('act_123abc')).toBe(true)
      expect(isActionId('act_')).toBe(true)
      expect(isActionId('action_123')).toBe(false)
      expect(isActionId('123')).toBe(false)
    })

    it('isEventId validates event IDs', () => {
      expect(isEventId('evt_123abc')).toBe(true)
      expect(isEventId('evt_')).toBe(true)
      expect(isEventId('event_123')).toBe(false)
      expect(isEventId('123')).toBe(false)
    })

    it('isToolId validates tool IDs', () => {
      expect(isToolId('https://example.com/tool/search')).toBe(true)
      expect(isToolId('https://example.com/tools/calculator')).toBe(true)
      expect(isToolId('https://example.com/other/thing')).toBe(false)
    })
  })
})
