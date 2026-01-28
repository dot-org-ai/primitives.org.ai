/**
 * TDD RED Phase: Failing tests for consolidated types in org.ai
 *
 * These tests define the expected interface for consolidated types that combine
 * the best features from:
 * - digital-workers
 * - autonomous-agents
 * - human-in-the-loop
 * - business-as-code
 *
 * These tests SHOULD FAIL initially because org.ai doesn't export these yet.
 */

import { describe, it, expect } from 'vitest'

// These imports should fail until we implement the consolidated types
// Import from the index file to test exports
import {
  // Role types
  type Role,
  type RoleType,
  isRole,
  createRole,
  // Team types
  type Team,
  type TeamMember,
  isTeam,
  createTeam,
  // Goal types
  type Goal,
  type Goals,
  type GoalStatus,
  type GoalCategory,
  isGoal,
  // KPI types
  type KPI,
  type KPIDefinition,
  type KPICategory,
  type KPITrend,
  isKPI,
  // OKR types
  type OKR,
  type KeyResult,
  type OKRStatus,
  isOKR,
} from '../src/index.js'

describe('Consolidated Types - org.ai', () => {
  // ==========================================================================
  // Role Types
  // ==========================================================================
  describe('Role types', () => {
    it('exports Role interface with all required fields', () => {
      // Role should combine the best of:
      // - autonomous-agents Role (id, name, description, skills, permissions, tools, outputs)
      // - business-as-code BusinessRole (type, department, responsibilities, canHandle, canDelegate, canApprove)
      const role: Role = {
        // Core identity
        id: 'role_engineer',
        name: 'Software Engineer',
        description: 'Develops and maintains software systems',

        // Capabilities (from autonomous-agents)
        skills: ['TypeScript', 'React', 'Node.js'],
        permissions: ['repository:read', 'repository:write', 'ci:trigger'],

        // Business context (from business-as-code)
        type: 'engineer',
        department: 'Engineering',
        responsibilities: ['Write code', 'Review PRs', 'Fix bugs'],

        // Task capabilities
        canHandle: ['coding', 'code-review', 'bug-fix'],
        canDelegate: ['testing'],
        canApprove: ['pull-request'],

        // Hierarchy
        escalateTo: 'role_lead',
        reportsTo: 'role_manager',
        level: 3,

        // Worker preference
        workerType: 'hybrid', // 'ai' | 'human' | 'hybrid'

        // Extensibility
        metadata: { team: 'platform' },
      }

      expect(role.id).toBe('role_engineer')
      expect(role.name).toBe('Software Engineer')
      expect(role.description).toBe('Develops and maintains software systems')
      expect(role.skills).toContain('TypeScript')
      expect(role.permissions).toContain('repository:read')
      expect(role.type).toBe('engineer')
      expect(role.department).toBe('Engineering')
      expect(role.responsibilities).toContain('Write code')
      expect(role.canHandle).toContain('coding')
      expect(role.canDelegate).toContain('testing')
      expect(role.canApprove).toContain('pull-request')
      expect(role.escalateTo).toBe('role_lead')
      expect(role.reportsTo).toBe('role_manager')
      expect(role.level).toBe(3)
      expect(role.workerType).toBe('hybrid')
      expect(role.metadata).toEqual({ team: 'platform' })
    })

    it('exports RoleType union type', () => {
      // RoleType should include standard business role types
      const types: RoleType[] = [
        // Executive
        'ceo',
        'cto',
        'cfo',
        'coo',
        'cmo',
        'cpo',
        // Management
        'director',
        'manager',
        'lead',
        'supervisor',
        // Individual Contributors
        'engineer',
        'designer',
        'analyst',
        'specialist',
        'coordinator',
        // Operations
        'operator',
        'agent',
        'assistant',
      ]

      expect(types).toHaveLength(18)
      expect(types).toContain('engineer')
      expect(types).toContain('manager')
    })

    it('exports isRole type guard', () => {
      const validRole = {
        id: 'role_1',
        name: 'Test Role',
        description: 'A test role',
        skills: ['testing'],
      }

      const invalidRole = {
        name: 'Missing ID',
      }

      expect(isRole(validRole)).toBe(true)
      expect(isRole(invalidRole)).toBe(false)
      expect(isRole(null)).toBe(false)
      expect(isRole(undefined)).toBe(false)
      expect(isRole('string')).toBe(false)
    })

    it('exports createRole factory function', () => {
      const role = createRole({
        id: 'role_new',
        name: 'New Role',
        description: 'A new role',
        skills: ['skill1'],
      })

      expect(role.id).toBe('role_new')
      expect(role.name).toBe('New Role')
      expect(isRole(role)).toBe(true)
    })

    it('supports optional fields with sensible defaults', () => {
      // Minimal role should work
      const minimalRole: Role = {
        id: 'role_minimal',
        name: 'Minimal Role',
        description: 'Minimal description',
        skills: [],
      }

      expect(minimalRole.permissions).toBeUndefined()
      expect(minimalRole.department).toBeUndefined()
      expect(minimalRole.level).toBeUndefined()
    })
  })

  // ==========================================================================
  // Team Types
  // ==========================================================================
  describe('Team types', () => {
    it('exports Team interface with all required fields', () => {
      // Team should combine the best of:
      // - digital-workers Team (id, name, description, members as WorkerRef[], contacts, lead, goals, metadata)
      // - autonomous-agents Team (goals as Goal[], context, channels)
      // - human-in-the-loop Team (members as string[], lead)
      const team: Team = {
        // Core identity
        id: 'team_engineering',
        name: 'Engineering Team',
        description: 'Core platform engineering team',

        // Members (typed)
        members: [
          { id: 'worker_alice', name: 'Alice', role: 'lead', type: 'human' },
          { id: 'worker_bob', name: 'Bob', role: 'engineer', type: 'human' },
          { id: 'agent_cody', name: 'Cody', role: 'assistant', type: 'agent' },
        ],

        // Leadership
        lead: { id: 'worker_alice', name: 'Alice', type: 'human' },

        // Goals (from autonomous-agents)
        goals: [
          {
            id: 'goal_1',
            name: 'Ship MVP',
            description: 'Launch minimum viable product',
            target: 100,
            progress: 75,
            status: 'in-progress',
          },
        ],

        // Communication (from autonomous-agents/digital-workers)
        channels: [{ id: 'slack_eng', type: 'slack', config: { channel: '#engineering' } }],
        contacts: {
          slack: '#engineering',
          email: 'engineering@company.com',
        },

        // Shared context
        context: {
          repository: 'acme/platform',
          sprint: 'Q1-2024',
        },

        // Extensibility
        metadata: { costCenter: 'CC-001' },
      }

      expect(team.id).toBe('team_engineering')
      expect(team.name).toBe('Engineering Team')
      expect(team.description).toBe('Core platform engineering team')
      expect(team.members).toHaveLength(3)
      expect(team.members[0].name).toBe('Alice')
      expect(team.lead?.id).toBe('worker_alice')
      expect(team.goals).toHaveLength(1)
      expect(team.goals![0].name).toBe('Ship MVP')
      expect(team.channels).toHaveLength(1)
      expect(team.contacts?.slack).toBe('#engineering')
      expect(team.context?.repository).toBe('acme/platform')
      expect(team.metadata).toEqual({ costCenter: 'CC-001' })
    })

    it('exports TeamMember interface', () => {
      const member: TeamMember = {
        id: 'member_1',
        name: 'John Doe',
        role: 'engineer',
        type: 'human',
        status: 'active',
        availability: 'available',
      }

      expect(member.id).toBe('member_1')
      expect(member.name).toBe('John Doe')
      expect(member.role).toBe('engineer')
      expect(member.type).toBe('human')
      expect(member.status).toBe('active')
      expect(member.availability).toBe('available')
    })

    it('exports isTeam type guard', () => {
      const validTeam = {
        id: 'team_1',
        name: 'Test Team',
        members: [],
      }

      const invalidTeam = {
        name: 'Missing ID and members',
      }

      expect(isTeam(validTeam)).toBe(true)
      expect(isTeam(invalidTeam)).toBe(false)
      expect(isTeam(null)).toBe(false)
      expect(isTeam(undefined)).toBe(false)
    })

    it('exports createTeam factory function', () => {
      const team = createTeam({
        id: 'team_new',
        name: 'New Team',
        members: [],
      })

      expect(team.id).toBe('team_new')
      expect(team.name).toBe('New Team')
      expect(isTeam(team)).toBe(true)
    })

    it('supports optional fields', () => {
      const minimalTeam: Team = {
        id: 'team_minimal',
        name: 'Minimal Team',
        members: [],
      }

      expect(minimalTeam.description).toBeUndefined()
      expect(minimalTeam.lead).toBeUndefined()
      expect(minimalTeam.goals).toBeUndefined()
      expect(minimalTeam.channels).toBeUndefined()
    })
  })

  // ==========================================================================
  // Goal Types
  // ==========================================================================
  describe('Goals types', () => {
    it('exports Goal interface with all required fields', () => {
      // Goal should combine the best of:
      // - autonomous-agents Goal (id, description, target, progress, deadline, priority, status, subgoals, successCriteria)
      // - business-as-code GoalDefinition (name, category, owner, metrics, dependencies)
      const goal: Goal = {
        // Core identity
        id: 'goal_pmf',
        name: 'Achieve Product-Market Fit',
        description: 'Validate that our product solves a real problem for customers',

        // Target and progress
        target: 100, // Can be number or string
        progress: 65,
        status: 'in-progress',

        // Timing
        targetDate: new Date('2024-12-31'),
        deadline: new Date('2024-12-31'), // Alias for targetDate

        // Ownership and categorization
        owner: 'CEO',
        category: 'strategic',
        priority: 'high',

        // Success criteria and metrics (from business-as-code)
        successCriteria: ['NPS > 50', 'Churn < 5%', '100+ paying customers'],
        metrics: ['NPS', 'Churn Rate', 'Customer Count'],

        // Dependencies (from business-as-code)
        dependencies: ['goal_mvp_launch'],

        // Hierarchy (from autonomous-agents)
        subgoals: [
          {
            id: 'goal_nps',
            name: 'Improve NPS',
            description: 'Increase NPS to 50+',
            target: 50,
            progress: 48,
            status: 'in-progress',
          },
        ],

        // Extensibility
        metadata: { quarter: 'Q4-2024' },
      }

      expect(goal.id).toBe('goal_pmf')
      expect(goal.name).toBe('Achieve Product-Market Fit')
      expect(goal.description).toContain('product solves a real problem')
      expect(goal.target).toBe(100)
      expect(goal.progress).toBe(65)
      expect(goal.status).toBe('in-progress')
      expect(goal.targetDate).toEqual(new Date('2024-12-31'))
      expect(goal.owner).toBe('CEO')
      expect(goal.category).toBe('strategic')
      expect(goal.priority).toBe('high')
      expect(goal.successCriteria).toContain('NPS > 50')
      expect(goal.metrics).toContain('NPS')
      expect(goal.dependencies).toContain('goal_mvp_launch')
      expect(goal.subgoals).toHaveLength(1)
      expect(goal.metadata).toEqual({ quarter: 'Q4-2024' })
    })

    it('exports Goals collection type', () => {
      const goals: Goals = [
        {
          id: 'goal_1',
          name: 'Goal 1',
          description: 'First goal',
          target: 100,
          progress: 50,
          status: 'in-progress',
        },
        {
          id: 'goal_2',
          name: 'Goal 2',
          description: 'Second goal',
          target: 200,
          progress: 100,
          status: 'completed',
        },
      ]

      expect(goals).toHaveLength(2)
      expect(goals[0].name).toBe('Goal 1')
      expect(goals[1].status).toBe('completed')
    })

    it('exports GoalStatus type', () => {
      const statuses: GoalStatus[] = [
        'not-started',
        'in-progress',
        'at-risk',
        'blocked',
        'completed',
        'cancelled',
      ]

      expect(statuses).toContain('in-progress')
      expect(statuses).toContain('at-risk')
      expect(statuses).toContain('blocked')
    })

    it('exports GoalCategory type', () => {
      const categories: GoalCategory[] = [
        'strategic',
        'operational',
        'financial',
        'customer',
        'internal',
        'learning',
      ]

      expect(categories).toContain('strategic')
      expect(categories).toContain('financial')
    })

    it('exports isGoal type guard', () => {
      const validGoal = {
        id: 'goal_1',
        name: 'Test Goal',
        description: 'A test goal',
        target: 100,
        progress: 50,
        status: 'in-progress',
      }

      const invalidGoal = {
        name: 'Missing required fields',
      }

      expect(isGoal(validGoal)).toBe(true)
      expect(isGoal(invalidGoal)).toBe(false)
      expect(isGoal(null)).toBe(false)
    })

    it('supports flexible target types (number or string)', () => {
      const numericGoal: Goal = {
        id: 'goal_numeric',
        name: 'Numeric Target',
        description: 'Goal with numeric target',
        target: 1000000,
        progress: 500000,
        status: 'in-progress',
      }

      const stringGoal: Goal = {
        id: 'goal_string',
        name: 'String Target',
        description: 'Goal with string target',
        target: 'Launch by Q4',
        progress: 'On track',
        status: 'in-progress',
      }

      expect(numericGoal.target).toBe(1000000)
      expect(stringGoal.target).toBe('Launch by Q4')
    })
  })

  // ==========================================================================
  // KPI Types
  // ==========================================================================
  describe('KPI types', () => {
    it('exports KPI interface with all required fields', () => {
      // KPI should combine the best of:
      // - digital-workers KPI (name, description, current, target, unit, trend, period)
      // - autonomous-agents KPI (id, name, description, value, target, unit, frequency, trend, history)
      // - business-as-code KPIDefinition (category, dataSource, formula)
      const kpi: KPI = {
        // Core identity
        id: 'kpi_mrr',
        name: 'Monthly Recurring Revenue',
        description: 'Total predictable revenue per month',

        // Values
        value: 85000,
        current: 85000, // Alias for value
        target: 100000,
        unit: 'USD',

        // Trend and tracking
        trend: 'up',
        frequency: 'monthly',

        // Categorization (from business-as-code)
        category: 'financial',
        dataSource: 'Billing System',
        formula: 'SUM(active_subscriptions.price)',

        // Historical data (from autonomous-agents)
        history: [
          { timestamp: new Date('2024-01-01'), value: 75000 },
          { timestamp: new Date('2024-02-01'), value: 80000 },
          { timestamp: new Date('2024-03-01'), value: 85000 },
        ],

        // Extensibility
        metadata: { dashboard: 'finance' },
      }

      expect(kpi.id).toBe('kpi_mrr')
      expect(kpi.name).toBe('Monthly Recurring Revenue')
      expect(kpi.description).toContain('predictable revenue')
      expect(kpi.value).toBe(85000)
      expect(kpi.current).toBe(85000)
      expect(kpi.target).toBe(100000)
      expect(kpi.unit).toBe('USD')
      expect(kpi.trend).toBe('up')
      expect(kpi.frequency).toBe('monthly')
      expect(kpi.category).toBe('financial')
      expect(kpi.dataSource).toBe('Billing System')
      expect(kpi.formula).toContain('SUM')
      expect(kpi.history).toHaveLength(3)
      expect(kpi.metadata).toEqual({ dashboard: 'finance' })
    })

    it('exports KPIDefinition type (alias for KPI)', () => {
      // KPIDefinition should be compatible with KPI
      const definition: KPIDefinition = {
        id: 'kpi_churn',
        name: 'Churn Rate',
        value: 3.2,
        target: 5,
        unit: 'percent',
        category: 'customer',
      }

      expect(definition.name).toBe('Churn Rate')
      expect(definition.value).toBe(3.2)
    })

    it('exports KPICategory type', () => {
      const categories: KPICategory[] = ['financial', 'customer', 'operations', 'people', 'growth']

      expect(categories).toContain('financial')
      expect(categories).toContain('customer')
      expect(categories).toContain('operations')
    })

    it('exports KPITrend type', () => {
      const trends: KPITrend[] = ['up', 'down', 'stable']

      expect(trends).toContain('up')
      expect(trends).toContain('down')
      expect(trends).toContain('stable')
    })

    it('exports isKPI type guard', () => {
      const validKPI = {
        id: 'kpi_1',
        name: 'Test KPI',
        value: 100,
        target: 150,
        unit: 'count',
      }

      const invalidKPI = {
        name: 'Missing required fields',
      }

      expect(isKPI(validKPI)).toBe(true)
      expect(isKPI(invalidKPI)).toBe(false)
      expect(isKPI(null)).toBe(false)
    })

    it('supports value as number or string', () => {
      const numericKPI: KPI = {
        id: 'kpi_numeric',
        name: 'Numeric KPI',
        value: 42,
        target: 100,
        unit: 'count',
      }

      const stringKPI: KPI = {
        id: 'kpi_string',
        name: 'String KPI',
        value: 'High',
        target: 'Very High',
        unit: 'rating',
      }

      expect(numericKPI.value).toBe(42)
      expect(stringKPI.value).toBe('High')
    })
  })

  // ==========================================================================
  // OKR Types
  // ==========================================================================
  describe('OKR types', () => {
    it('exports OKR interface with all required fields', () => {
      // OKR should combine the best of:
      // - digital-workers OKR (objective, keyResults, owner, dueDate, progress)
      // - autonomous-agents OKR (id, objective, description, keyResults, period, owner, status, progress)
      // - business-as-code OKRDefinition (confidence)
      const okr: OKR = {
        // Core identity
        id: 'okr_pmf',
        objective: 'Achieve Product-Market Fit',
        description: 'Validate that our product solves a real problem',

        // Key results (detailed)
        keyResults: [
          {
            id: 'kr_nps',
            description: 'Increase Net Promoter Score',
            metric: 'NPS',
            startValue: 40,
            targetValue: 60,
            currentValue: 52,
            current: 52, // Alias
            target: 60, // Alias
            unit: 'score',
            progress: 60,
            status: 'on-track',
          },
          {
            id: 'kr_churn',
            description: 'Reduce monthly churn rate',
            metric: 'Churn Rate',
            startValue: 8,
            targetValue: 4,
            currentValue: 5.5,
            current: 5.5,
            target: 4,
            unit: 'percent',
            progress: 62.5,
            status: 'on-track',
          },
        ],

        // Ownership and timing
        owner: 'CEO',
        period: 'Q2 2024',
        dueDate: new Date('2024-06-30'),

        // Status and progress
        status: 'on-track',
        progress: 61.25, // Average of key results

        // Confidence (from business-as-code)
        confidence: 75,

        // Extensibility
        metadata: { initiative: 'growth' },
      }

      expect(okr.id).toBe('okr_pmf')
      expect(okr.objective).toBe('Achieve Product-Market Fit')
      expect(okr.description).toContain('product solves a real problem')
      expect(okr.keyResults).toHaveLength(2)
      expect(okr.keyResults[0].description).toBe('Increase Net Promoter Score')
      expect(okr.keyResults[0].progress).toBe(60)
      expect(okr.owner).toBe('CEO')
      expect(okr.period).toBe('Q2 2024')
      expect(okr.dueDate).toEqual(new Date('2024-06-30'))
      expect(okr.status).toBe('on-track')
      expect(okr.progress).toBe(61.25)
      expect(okr.confidence).toBe(75)
      expect(okr.metadata).toEqual({ initiative: 'growth' })
    })

    it('exports KeyResult type with full details', () => {
      const keyResult: KeyResult = {
        // Identity
        id: 'kr_1',
        description: 'Increase customer satisfaction',

        // Metric details
        metric: 'CSAT',
        startValue: 70,
        targetValue: 90,
        currentValue: 82,

        // Aliases for compatibility
        current: 82,
        target: 90,

        // Unit and progress
        unit: 'percent',
        progress: 60, // (82-70)/(90-70) * 100

        // Status
        status: 'on-track',
      }

      expect(keyResult.id).toBe('kr_1')
      expect(keyResult.description).toBe('Increase customer satisfaction')
      expect(keyResult.metric).toBe('CSAT')
      expect(keyResult.startValue).toBe(70)
      expect(keyResult.targetValue).toBe(90)
      expect(keyResult.currentValue).toBe(82)
      expect(keyResult.current).toBe(82)
      expect(keyResult.target).toBe(90)
      expect(keyResult.unit).toBe('percent')
      expect(keyResult.progress).toBe(60)
      expect(keyResult.status).toBe('on-track')
    })

    it('exports OKRStatus type', () => {
      const statuses: OKRStatus[] = [
        'not-started',
        'on-track',
        'at-risk',
        'off-track',
        'completed',
        'cancelled',
      ]

      expect(statuses).toContain('on-track')
      expect(statuses).toContain('at-risk')
      expect(statuses).toContain('off-track')
    })

    it('exports isOKR type guard', () => {
      const validOKR = {
        id: 'okr_1',
        objective: 'Test Objective',
        keyResults: [
          {
            description: 'Key Result 1',
            targetValue: 100,
            currentValue: 50,
          },
        ],
      }

      const invalidOKR = {
        objective: 'Missing key results',
      }

      expect(isOKR(validOKR)).toBe(true)
      expect(isOKR(invalidOKR)).toBe(false)
      expect(isOKR(null)).toBe(false)
    })

    it('supports minimal OKR with required fields only', () => {
      const minimalOKR: OKR = {
        objective: 'Improve team velocity',
        keyResults: [
          {
            description: 'Increase sprint completion rate',
            targetValue: 95,
          },
        ],
      }

      expect(minimalOKR.objective).toBe('Improve team velocity')
      expect(minimalOKR.keyResults).toHaveLength(1)
      expect(minimalOKR.id).toBeUndefined()
      expect(minimalOKR.owner).toBeUndefined()
      expect(minimalOKR.progress).toBeUndefined()
    })

    it('supports simplified key results (name, current, target, unit)', () => {
      // For backward compatibility with digital-workers OKR
      const okr: OKR = {
        objective: 'Scale infrastructure',
        keyResults: [
          {
            name: 'Reduce latency', // Alias for description
            description: 'Reduce latency',
            current: 200,
            target: 100,
            unit: 'ms',
          },
        ],
      }

      expect(okr.keyResults[0].name).toBe('Reduce latency')
      expect(okr.keyResults[0].current).toBe(200)
      expect(okr.keyResults[0].target).toBe(100)
    })
  })

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Type Integration', () => {
    it('Role can be assigned to TeamMember', () => {
      const role: Role = {
        id: 'role_eng',
        name: 'Engineer',
        description: 'Software Engineer',
        skills: ['TypeScript'],
      }

      const member: TeamMember = {
        id: 'member_1',
        name: 'Alice',
        role: role.name, // Reference by name
        type: 'human',
      }

      expect(member.role).toBe('Engineer')
    })

    it('Team can have Goals', () => {
      const goal: Goal = {
        id: 'goal_1',
        name: 'Ship Feature',
        description: 'Ship the new feature',
        target: 100,
        progress: 50,
        status: 'in-progress',
      }

      const team: Team = {
        id: 'team_1',
        name: 'Product Team',
        members: [],
        goals: [goal],
      }

      expect(team.goals![0].name).toBe('Ship Feature')
    })

    it('KPIs can track Goal progress', () => {
      const kpi: KPI = {
        id: 'kpi_goal_progress',
        name: 'Goal Completion Rate',
        value: 75,
        target: 100,
        unit: 'percent',
        category: 'operations',
      }

      expect(kpi.value).toBe(75)
      expect(kpi.target).toBe(100)
    })

    it('OKR keyResults can reference KPIs', () => {
      const okr: OKR = {
        objective: 'Improve operational efficiency',
        keyResults: [
          {
            description: 'Increase goal completion rate',
            metric: 'Goal Completion Rate', // References KPI name
            targetValue: 100,
            currentValue: 75,
          },
        ],
      }

      expect(okr.keyResults[0].metric).toBe('Goal Completion Rate')
    })
  })
})
