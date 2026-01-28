/**
 * Integration tests for autonomous-agents package
 *
 * These tests use REAL AI calls via the Cloudflare AI Gateway.
 * The gateway caches responses, so repeated test runs are fast and free.
 *
 * Required env vars:
 * - AI_GATEWAY_URL: Cloudflare AI Gateway URL
 * - AI_GATEWAY_TOKEN: Gateway auth token (or individual provider keys like ANTHROPIC_API_KEY)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  Agent,
  Role,
  Team,
  Goals,
  kpi,
  okr,
  createGoal,
  hasSkill,
  hasPermission,
  getTeamSkills,
  findBestMemberForTask,
  type AgentType,
  type RoleType,
  type TeamInstance,
  type GoalsInstance,
} from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// Use haiku model for fast/cheap tests
const TEST_MODEL = 'haiku'

describe('autonomous-agents exports', () => {
  it('should export all main functions and types', () => {
    expect(Agent).toBeDefined()
    expect(typeof Agent).toBe('function')

    expect(Role).toBeDefined()
    expect(typeof Role).toBe('function')

    expect(Team).toBeDefined()
    expect(typeof Team).toBe('function')

    expect(Goals).toBeDefined()
    expect(typeof Goals).toBe('function')

    expect(kpi).toBeDefined()
    expect(typeof kpi).toBe('function')

    expect(okr).toBeDefined()
    expect(typeof okr).toBe('function')
  })

  it('should export helper functions', () => {
    expect(createGoal).toBeDefined()
    expect(hasSkill).toBeDefined()
    expect(hasPermission).toBeDefined()
    expect(getTeamSkills).toBeDefined()
    expect(findBestMemberForTask).toBeDefined()
  })
})

describe('Role creation', () => {
  it('should create a role with basic config', () => {
    const role = Role({
      name: 'Software Engineer',
      description: 'Develops software applications',
      skills: ['coding', 'debugging', 'testing'],
    })

    expect(role).toBeDefined()
    expect(role.name).toBe('Software Engineer')
    expect(role.description).toBe('Develops software applications')
    expect(role.skills).toContain('coding')
    expect(role.skills).toContain('debugging')
    expect(role.skills).toContain('testing')
  })

  it('should create a role with permissions', () => {
    const role = Role({
      name: 'Admin',
      description: 'System administrator',
      skills: ['system-management'],
      permissions: ['read', 'write', 'delete', 'admin'],
    })

    expect(hasPermission(role, 'read')).toBe(true)
    expect(hasPermission(role, 'admin')).toBe(true)
    expect(hasPermission(role, 'superuser')).toBe(false)
  })

  it('should check skills correctly', () => {
    const role = Role({
      name: 'Data Scientist',
      description: 'Analyzes data',
      skills: ['python', 'machine-learning', 'statistics'],
    })

    expect(hasSkill(role, 'python')).toBe(true)
    expect(hasSkill(role, 'machine-learning')).toBe(true)
    expect(hasSkill(role, 'javascript')).toBe(false)
  })
})

describe('Team creation', () => {
  let engineerRole: RoleType
  let designerRole: RoleType

  beforeEach(() => {
    engineerRole = Role({
      name: 'Engineer',
      description: 'Software engineer',
      skills: ['coding', 'architecture'],
    })

    designerRole = Role({
      name: 'Designer',
      description: 'UI/UX designer',
      skills: ['design', 'prototyping', 'user-research'],
    })
  })

  it('should create a team with members', () => {
    const team = Team({
      name: 'Product Team',
      description: 'Builds the product',
      members: [
        { id: 'eng1', name: 'Alice', role: engineerRole, type: 'human' },
        { id: 'des1', name: 'Bob', role: designerRole, type: 'human' },
      ],
    })

    expect(team).toBeDefined()
    expect(team.name).toBe('Product Team')
    expect(team.members.length).toBe(2)
  })

  it('should aggregate team skills', () => {
    const team = Team({
      name: 'Full Stack Team',
      description: 'Full stack development team',
      members: [
        { id: 'eng1', name: 'Alice', role: engineerRole, type: 'human' },
        { id: 'des1', name: 'Bob', role: designerRole, type: 'human' },
      ],
    })

    const skills = getTeamSkills(team)
    expect(skills).toContain('coding')
    expect(skills).toContain('architecture')
    expect(skills).toContain('design')
    expect(skills).toContain('prototyping')
  })

  it('should find best member for task', () => {
    const team = Team({
      name: 'Mixed Team',
      description: 'Team with varied skills',
      members: [
        {
          id: 'eng1',
          name: 'Alice',
          role: engineerRole,
          type: 'human',
          status: 'active',
          availability: 'available',
        },
        {
          id: 'des1',
          name: 'Bob',
          role: designerRole,
          type: 'human',
          status: 'active',
          availability: 'available',
        },
      ],
    })

    const bestForDesign = findBestMemberForTask(team, ['design', 'prototyping'])
    expect(bestForDesign?.name).toBe('Bob')

    const bestForCoding = findBestMemberForTask(team, ['coding', 'architecture'])
    expect(bestForCoding?.name).toBe('Alice')
  })
})

describe('Goals management', () => {
  it('should create goals instance', () => {
    const goals = Goals({
      goals: [
        createGoal({
          id: 'g1',
          description: 'Increase monthly revenue by 20%',
          target: '20%',
          priority: 'high',
        }),
        createGoal({
          id: 'g2',
          description: 'Improve NPS score to 70+',
          target: 70,
          priority: 'medium',
        }),
      ],
    })

    expect(goals).toBeDefined()
    expect(goals.goals.length).toBe(2)
    expect(goals.goals[0].description).toBe('Increase monthly revenue by 20%')
  })

  it('should track goal status', () => {
    const goal = createGoal({
      id: 'g1',
      description: 'Launch the new feature by Q1',
      target: '100%',
      priority: 'high',
      deadline: new Date('2025-03-31'),
    })

    // createGoal defaults to 'active' status
    expect(goal.status).toBe('active')
    expect(goal.priority).toBe('high')
    expect(goal.deadline).toBeDefined()
  })
})

describe('KPI tracking', () => {
  it('should create a KPI', () => {
    const revenueKpi = kpi({
      name: 'Monthly Revenue',
      description: 'Monthly recurring revenue',
      value: 100000,
      target: 150000,
      unit: 'USD',
      frequency: 'monthly',
    })

    expect(revenueKpi).toBeDefined()
    expect(revenueKpi.name).toBe('Monthly Revenue')
    expect(revenueKpi.value).toBe(100000)
    expect(revenueKpi.target).toBe(150000)
  })

  it('should track KPI progress', () => {
    const npsKpi = kpi({
      name: 'NPS Score',
      description: 'Net Promoter Score',
      value: 45,
      target: 70,
      unit: 'points',
      frequency: 'quarterly',
    })

    const progress = npsKpi.getProgress()
    expect(progress).toBeCloseTo(64.29, 1)
  })
})

describe('OKR management', () => {
  it('should create an OKR', () => {
    const growthOkr = okr({
      objective: 'Achieve market leadership',
      description: 'Become the market leader in our segment',
      keyResults: [
        {
          id: 'kr1',
          description: 'Reach 1M users',
          target: 1000000,
          current: 500000,
          status: 'in_progress',
        },
        {
          id: 'kr2',
          description: 'Achieve 90% retention',
          target: 90,
          current: 75,
          status: 'in_progress',
        },
        {
          id: 'kr3',
          description: 'Launch in 5 new markets',
          target: 5,
          current: 2,
          status: 'in_progress',
        },
      ],
      status: 'active',
      period: 'Q1 2025',
    })

    expect(growthOkr).toBeDefined()
    expect(growthOkr.objective).toBe('Achieve market leadership')
    expect(growthOkr.keyResults.length).toBe(3)
  })

  it('should calculate OKR progress', () => {
    const productOkr = okr({
      objective: 'Improve product quality',
      description: 'Reduce bugs and improve user experience',
      keyResults: [
        {
          id: 'kr1',
          description: 'Reduce bugs by 50%',
          target: 50,
          current: 30,
          status: 'in_progress',
        },
        {
          id: 'kr2',
          description: 'Increase test coverage to 90%',
          target: 90,
          current: 80,
          status: 'in_progress',
        },
      ],
      status: 'active',
      period: 'Q1 2025',
    })

    // Calculate average progress
    const totalProgress = productOkr.keyResults.reduce((sum, kr) => {
      return sum + ((kr.current ?? 0) / (kr.target ?? 1)) * 100
    }, 0)
    const avgProgress = totalProgress / productOkr.keyResults.length

    expect(avgProgress).toBeGreaterThan(50)
  })
})

describe.skipIf(!hasGateway)('Agent AI integration', () => {
  let agent: AgentType

  beforeEach(() => {
    const role = Role({
      name: 'Assistant',
      description: 'A helpful AI assistant',
      skills: ['writing', 'analysis', 'coding'],
    })

    agent = Agent({
      name: 'TestAgent',
      role,
      mode: 'supervised',
      model: TEST_MODEL,
    })
  })

  it('should create an agent with correct properties', () => {
    expect(agent).toBeDefined()
    expect(agent.config.name).toBe('TestAgent')
    expect(agent.config.role.name).toBe('Assistant')
    expect(agent.config.mode).toBe('supervised')
  })

  it('should execute a simple task with do()', async () => {
    const result = await agent.do('What is 2 + 2? Answer with just the number.')

    expect(result).toBeDefined()
    // The result should contain the answer
    const resultStr = String(result)
    expect(resultStr).toMatch(/4/)
  }, 30000)

  it('should answer questions with ask()', async () => {
    const answer = await agent.ask('What color is the sky on a clear day? Answer in one word.')

    expect(answer).toBeDefined()
    const answerStr = String(answer).toLowerCase()
    expect(answerStr).toMatch(/blue/)
  }, 30000)

  it('should make decisions with decide()', async () => {
    const decision = await agent.decide(
      ['TypeScript', 'JavaScript', 'Python'],
      'Which language has the best type system?'
    )

    expect(decision).toBeDefined()
    // decide() returns the chosen option directly
    expect(['TypeScript', 'JavaScript', 'Python']).toContain(decision)
  }, 30000)

  it('should validate with is()', async () => {
    const isValid = await agent.is('test@example.com', 'a valid email address')
    expect(typeof isValid).toBe('boolean')
    expect(isValid).toBe(true)

    const isInvalid = await agent.is('not-an-email', 'a valid email address')
    expect(typeof isInvalid).toBe('boolean')
    expect(isInvalid).toBe(false)
  }, 30000)

  it('should track agent status', async () => {
    expect(agent.status).toBe('idle')

    // Status changes during task execution
    const taskPromise = agent.do('Say hello')
    // Note: Status may change too quickly to reliably test mid-execution
    await taskPromise

    expect(agent.status).toBe('idle')
  }, 30000)

  it('should maintain history', async () => {
    expect(agent.getHistory().length).toBe(0)

    await agent.do('Say hello')
    expect(agent.getHistory().length).toBeGreaterThan(0)

    await agent.ask('What is 1+1?')
    expect(agent.getHistory().length).toBeGreaterThan(1)
  }, 60000)
})

describe.skipIf(!hasGateway)('Agent with goals integration', () => {
  it('should create agent with goals and track progress', async () => {
    const role = Role({
      name: 'Sales Agent',
      description: 'Handles sales tasks',
      skills: ['negotiation', 'communication', 'product-knowledge'],
    })

    const salesGoals = Goals({
      goals: [
        createGoal({
          id: 'g1',
          description: 'Close 10 new deals this month',
          target: 10,
          priority: 'high',
        }),
      ],
    })

    const agent = Agent({
      name: 'SalesBot',
      role,
      mode: 'supervised',
      model: TEST_MODEL,
      goals: salesGoals.goals,
    })

    expect(agent.config.goals).toBeDefined()
    expect(agent.config.goals?.length).toBe(1)

    // Agent should be able to reference goals in context
    const answer = await agent.ask('What is your primary goal?')
    expect(answer).toBeDefined()
  }, 30000)
})

describe.skipIf(!hasGateway)('Team collaboration integration', () => {
  it('should route tasks to appropriate team members', async () => {
    const engineerRole = Role({
      name: 'Engineer',
      description: 'Software engineer',
      skills: ['coding', 'debugging'],
    })

    const writerRole = Role({
      name: 'Writer',
      description: 'Content writer',
      skills: ['writing', 'editing'],
    })

    const team = Team({
      name: 'Content Team',
      description: 'Creates content',
      members: [
        { id: 'eng1', name: 'Alice', role: engineerRole, type: 'ai' },
        { id: 'writer1', name: 'Bob', role: writerRole, type: 'ai' },
      ],
    })

    // Find best member for writing task
    const bestWriter = findBestMemberForTask(team, ['writing', 'editing'])
    expect(bestWriter?.name).toBe('Bob')

    // Find best member for coding task
    const bestCoder = findBestMemberForTask(team, ['coding'])
    expect(bestCoder?.name).toBe('Alice')
  })
})
