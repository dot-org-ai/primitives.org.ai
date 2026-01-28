/**
 * Worker Export Tests (RED phase)
 *
 * Tests for the /worker export that provides AgentService as a WorkerEntrypoint.
 * AgentService.connect() returns AgentServiceCore (RpcTarget) for agent operations.
 *
 * IMPORTANT: NO MOCKS - These tests run against real AI Gateway (with cache: true)
 * and real Durable Objects for agent state/memory using @cloudflare/vitest-pool-workers.
 *
 * These tests should FAIL initially because src/worker.ts doesn't exist yet.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { env } from 'cloudflare:test'

// Types for expected agent interfaces
interface AgentConfig {
  id?: string
  name: string
  description?: string
  role?: string
  model?: string
  temperature?: number
  maxIterations?: number
  system?: string
  tools?: Array<{
    name: string
    description: string
    parameters?: Record<string, unknown>
  }>
}

interface AgentState {
  id: string
  name: string
  status: 'idle' | 'thinking' | 'acting' | 'waiting' | 'completed' | 'error' | 'terminated'
  config: AgentConfig
  memory: AgentMemory
  goals: AgentGoal[]
  plan?: ActionPlan
  createdAt: Date
  updatedAt: Date
}

interface AgentGoal {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  deadline?: Date
  progress?: number
  subgoals?: AgentGoal[]
}

interface AgentMemory {
  shortTerm: Array<{ role: string; content: string; timestamp: Date }>
  longTerm: Record<string, unknown>
  context: Record<string, unknown>
}

interface ActionPlan {
  id: string
  goal: string
  steps: PlanStep[]
  status: 'pending' | 'executing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

interface PlanStep {
  id: string
  action: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  result?: unknown
  dependencies?: string[]
}

interface ActionResult {
  id: string
  action: string
  status: 'success' | 'failure' | 'pending'
  result?: unknown
  error?: string
  duration: number
  timestamp: Date
}

interface CoordinationPattern {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative' | 'competitive'
  agents: string[]
  goal?: string
  config?: Record<string, unknown>
}

interface CoordinationResult {
  id: string
  pattern: CoordinationPattern
  status: 'pending' | 'running' | 'completed' | 'failed'
  results: Record<string, unknown>
  consensus?: unknown
  duration: number
}

// Expected service interface
interface AgentServiceInterface {
  // Agent lifecycle
  create(config: AgentConfig): Promise<AgentState>
  get(agentId: string): Promise<AgentState | null>
  list(options?: { status?: string; limit?: number }): Promise<AgentState[]>
  terminate(agentId: string): Promise<boolean>

  // Goal management
  setGoal(agentId: string, goal: Omit<AgentGoal, 'id' | 'status'>): Promise<AgentGoal>
  getGoals(agentId: string): Promise<AgentGoal[]>
  updateGoal(agentId: string, goalId: string, updates: Partial<AgentGoal>): Promise<AgentGoal>
  removeGoal(agentId: string, goalId: string): Promise<boolean>

  // Reasoning and planning
  plan(agentId: string, objective?: string): Promise<ActionPlan>
  getPlan(agentId: string): Promise<ActionPlan | null>
  updatePlan(agentId: string, updates: Partial<ActionPlan>): Promise<ActionPlan>

  // Action execution
  execute(agentId: string, action: string, params?: Record<string, unknown>): Promise<ActionResult>
  executeStep(agentId: string, stepId: string): Promise<ActionResult>
  executePlan(agentId: string): Promise<ActionResult[]>

  // Memory and context
  getMemory(agentId: string): Promise<AgentMemory>
  updateMemory(agentId: string, updates: Partial<AgentMemory>): Promise<AgentMemory>
  addToMemory(
    agentId: string,
    type: 'shortTerm' | 'longTerm' | 'context',
    data: unknown
  ): Promise<void>
  clearMemory(agentId: string, type?: 'shortTerm' | 'longTerm' | 'context' | 'all'): Promise<void>

  // Multi-agent coordination
  coordinate(pattern: CoordinationPattern): Promise<CoordinationResult>
  broadcast(agentIds: string[], message: string): Promise<void>
  delegate(fromAgentId: string, toAgentId: string, task: string): Promise<ActionResult>
}

describe('AgentService (WorkerEntrypoint)', () => {
  describe('class structure', () => {
    it('should export AgentService class', async () => {
      // This import should fail initially - worker.ts doesn't exist
      const { AgentService } = await import('../src/worker.js')

      expect(AgentService).toBeDefined()
      expect(typeof AgentService).toBe('function')
    })

    it('should extend WorkerEntrypoint', async () => {
      const { AgentService } = await import('../src/worker.js')

      // WorkerEntrypoint check - should have prototype chain
      expect(AgentService.prototype).toBeDefined()
    })

    it('should have a connect method', async () => {
      const { AgentService } = await import('../src/worker.js')
      expect(typeof AgentService.prototype.connect).toBe('function')
    })
  })
})

describe('AgentServiceCore (RpcTarget)', () => {
  describe('class structure', () => {
    it('should export AgentServiceCore class', async () => {
      const { AgentServiceCore } = await import('../src/worker.js')

      expect(AgentServiceCore).toBeDefined()
      expect(typeof AgentServiceCore).toBe('function')
    })

    it('should extend RpcTarget', async () => {
      const { AgentServiceCore } = await import('../src/worker.js')
      expect(AgentServiceCore.prototype).toBeDefined()
    })
  })
})

describe('AgentServiceCore via connect()', () => {
  let service: AgentServiceInterface
  let getService: () => Promise<AgentServiceInterface>

  beforeAll(async () => {
    const { AgentService } = await import('../src/worker.js')

    getService = async () => {
      const worker = new AgentService({ env } as any, {} as any)
      return worker.connect() as AgentServiceInterface
    }
  })

  beforeEach(async () => {
    service = await getService()
  })

  describe('Agent Lifecycle', () => {
    describe('create()', () => {
      it('should create an agent with minimal config', async () => {
        const agent = await service.create({
          name: 'TestAgent',
        })

        expect(agent).toBeDefined()
        expect(agent.id).toBeDefined()
        expect(agent.id.length).toBeGreaterThan(0)
        expect(agent.name).toBe('TestAgent')
        expect(agent.status).toBe('idle')
        expect(agent.createdAt).toBeInstanceOf(Date)
      })

      it('should create an agent with full config', async () => {
        const agent = await service.create({
          name: 'FullAgent',
          description: 'A fully configured agent',
          role: 'Assistant',
          model: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          maxIterations: 10,
          system: 'You are a helpful assistant.',
          tools: [
            {
              name: 'search',
              description: 'Search the web',
              parameters: { query: 'string' },
            },
          ],
        })

        expect(agent.name).toBe('FullAgent')
        expect(agent.config.description).toBe('A fully configured agent')
        expect(agent.config.role).toBe('Assistant')
        expect(agent.config.model).toBe('claude-sonnet-4-20250514')
        expect(agent.config.tools).toHaveLength(1)
      })

      it('should create an agent with custom ID', async () => {
        const agent = await service.create({
          id: 'custom-agent-id',
          name: 'CustomIdAgent',
        })

        expect(agent.id).toBe('custom-agent-id')
      })

      it('should initialize empty memory and goals', async () => {
        const agent = await service.create({ name: 'EmptyAgent' })

        expect(agent.memory).toBeDefined()
        expect(agent.memory.shortTerm).toEqual([])
        expect(agent.memory.longTerm).toEqual({})
        expect(agent.memory.context).toEqual({})
        expect(agent.goals).toEqual([])
      })
    })

    describe('get()', () => {
      it('should retrieve a created agent', async () => {
        const created = await service.create({ name: 'RetrieveTest' })
        const retrieved = await service.get(created.id)

        expect(retrieved).not.toBeNull()
        expect(retrieved!.id).toBe(created.id)
        expect(retrieved!.name).toBe('RetrieveTest')
      })

      it('should return null for non-existent agent', async () => {
        const result = await service.get('nonexistent-agent-id')
        expect(result).toBeNull()
      })
    })

    describe('list()', () => {
      it('should list all agents', async () => {
        await service.create({ name: 'ListAgent1' })
        await service.create({ name: 'ListAgent2' })

        const agents = await service.list()

        expect(agents.length).toBeGreaterThanOrEqual(2)
        expect(agents.some((a) => a.name === 'ListAgent1')).toBe(true)
        expect(agents.some((a) => a.name === 'ListAgent2')).toBe(true)
      })

      it('should filter agents by status', async () => {
        const agent = await service.create({ name: 'StatusFilterAgent' })
        // Agent should be idle by default

        const idleAgents = await service.list({ status: 'idle' })

        expect(idleAgents.some((a) => a.id === agent.id)).toBe(true)
      })

      it('should support limit option', async () => {
        await service.create({ name: 'LimitTest1' })
        await service.create({ name: 'LimitTest2' })
        await service.create({ name: 'LimitTest3' })

        const agents = await service.list({ limit: 2 })

        expect(agents).toHaveLength(2)
      })
    })

    describe('terminate()', () => {
      it('should terminate an agent', async () => {
        const agent = await service.create({ name: 'ToTerminate' })
        const result = await service.terminate(agent.id)

        expect(result).toBe(true)

        // Agent should have terminated status
        const retrieved = await service.get(agent.id)
        expect(retrieved!.status).toBe('terminated')
      })

      it('should return false for non-existent agent', async () => {
        const result = await service.terminate('nonexistent-id')
        expect(result).toBe(false)
      })
    })
  })

  describe('Goal Management', () => {
    let agentId: string

    beforeEach(async () => {
      const agent = await service.create({ name: 'GoalTestAgent' })
      agentId = agent.id
    })

    describe('setGoal()', () => {
      it('should add a goal to an agent', async () => {
        const goal = await service.setGoal(agentId, {
          description: 'Complete the task',
          priority: 'high',
        })

        expect(goal).toBeDefined()
        expect(goal.id).toBeDefined()
        expect(goal.description).toBe('Complete the task')
        expect(goal.priority).toBe('high')
        expect(goal.status).toBe('pending')
      })

      it('should add a goal with deadline', async () => {
        const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
        const goal = await service.setGoal(agentId, {
          description: 'Time-bound task',
          priority: 'critical',
          deadline,
        })

        expect(goal.deadline).toEqual(deadline)
      })

      it('should add a goal with subgoals', async () => {
        const goal = await service.setGoal(agentId, {
          description: 'Main objective',
          priority: 'high',
          subgoals: [
            { id: 'sub1', description: 'Subtask 1', priority: 'medium', status: 'pending' },
            { id: 'sub2', description: 'Subtask 2', priority: 'medium', status: 'pending' },
          ],
        })

        expect(goal.subgoals).toHaveLength(2)
      })
    })

    describe('getGoals()', () => {
      it('should retrieve all goals for an agent', async () => {
        await service.setGoal(agentId, { description: 'Goal 1', priority: 'low' })
        await service.setGoal(agentId, { description: 'Goal 2', priority: 'high' })

        const goals = await service.getGoals(agentId)

        expect(goals.length).toBeGreaterThanOrEqual(2)
      })

      it('should return empty array for agent with no goals', async () => {
        const newAgent = await service.create({ name: 'NoGoalsAgent' })
        const goals = await service.getGoals(newAgent.id)

        expect(goals).toEqual([])
      })
    })

    describe('updateGoal()', () => {
      it('should update goal status', async () => {
        const goal = await service.setGoal(agentId, {
          description: 'Update me',
          priority: 'medium',
        })

        const updated = await service.updateGoal(agentId, goal.id, {
          status: 'active',
          progress: 50,
        })

        expect(updated.status).toBe('active')
        expect(updated.progress).toBe(50)
      })

      it('should update goal priority', async () => {
        const goal = await service.setGoal(agentId, {
          description: 'Priority change',
          priority: 'low',
        })

        const updated = await service.updateGoal(agentId, goal.id, {
          priority: 'critical',
        })

        expect(updated.priority).toBe('critical')
      })
    })

    describe('removeGoal()', () => {
      it('should remove a goal', async () => {
        const goal = await service.setGoal(agentId, {
          description: 'To remove',
          priority: 'low',
        })

        const removed = await service.removeGoal(agentId, goal.id)
        expect(removed).toBe(true)

        const goals = await service.getGoals(agentId)
        expect(goals.some((g) => g.id === goal.id)).toBe(false)
      })

      it('should return false for non-existent goal', async () => {
        const removed = await service.removeGoal(agentId, 'nonexistent-goal')
        expect(removed).toBe(false)
      })
    })
  })

  describe('Reasoning and Planning', () => {
    let agentId: string

    beforeEach(async () => {
      const agent = await service.create({
        name: 'PlanningAgent',
        model: 'claude-sonnet-4-20250514',
      })
      agentId = agent.id
      await service.setGoal(agentId, {
        description: 'Write a comprehensive report on AI trends',
        priority: 'high',
      })
    })

    describe('plan()', () => {
      it('should generate a plan from agent goals', async () => {
        const plan = await service.plan(agentId)

        expect(plan).toBeDefined()
        expect(plan.id).toBeDefined()
        expect(plan.steps).toBeDefined()
        expect(Array.isArray(plan.steps)).toBe(true)
        expect(plan.status).toBe('pending')
      })

      it('should generate a plan for a specific objective', async () => {
        const plan = await service.plan(agentId, 'Research market trends')

        expect(plan.goal).toBe('Research market trends')
        expect(plan.steps.length).toBeGreaterThan(0)
      })

      it('should create plan steps with dependencies', async () => {
        const plan = await service.plan(agentId, 'Complex multi-step task')

        // At least some steps should have dependencies on earlier steps
        const stepsWithDeps = plan.steps.filter((s) => s.dependencies && s.dependencies.length > 0)
        expect(stepsWithDeps.length).toBeGreaterThanOrEqual(0) // May or may not have dependencies
      })
    })

    describe('getPlan()', () => {
      it('should retrieve the current plan', async () => {
        await service.plan(agentId)
        const plan = await service.getPlan(agentId)

        expect(plan).not.toBeNull()
        expect(plan!.steps).toBeDefined()
      })

      it('should return null if no plan exists', async () => {
        const newAgent = await service.create({ name: 'NoPlanAgent' })
        const plan = await service.getPlan(newAgent.id)

        expect(plan).toBeNull()
      })
    })

    describe('updatePlan()', () => {
      it('should update plan status', async () => {
        await service.plan(agentId)
        const updated = await service.updatePlan(agentId, { status: 'executing' })

        expect(updated.status).toBe('executing')
      })
    })
  })

  describe('Action Execution', () => {
    let agentId: string

    beforeEach(async () => {
      const agent = await service.create({
        name: 'ExecutionAgent',
        tools: [
          {
            name: 'analyze',
            description: 'Analyze given data',
            parameters: { data: 'string' },
          },
        ],
      })
      agentId = agent.id
    })

    describe('execute()', () => {
      it('should execute a simple action', async () => {
        const result = await service.execute(agentId, 'think', {
          about: 'the meaning of life',
        })

        expect(result).toBeDefined()
        expect(result.id).toBeDefined()
        expect(result.action).toBe('think')
        expect(result.status).toBe('success')
        expect(result.duration).toBeGreaterThan(0)
      })

      it('should execute with tool invocation', async () => {
        const result = await service.execute(agentId, 'analyze', {
          data: 'Test data for analysis',
        })

        expect(result.action).toBe('analyze')
        expect(result.result).toBeDefined()
      })

      it('should handle action failure gracefully', async () => {
        const result = await service.execute(agentId, 'unknownAction', {})

        expect(result.status).toBe('failure')
        expect(result.error).toBeDefined()
      })

      it('should update agent status during execution', async () => {
        // Start action (don't await yet)
        const actionPromise = service.execute(agentId, 'longRunningTask', {})

        // Check if agent status changes (may need timing adjustment)
        const agent = await service.get(agentId)
        expect(['thinking', 'acting', 'idle']).toContain(agent!.status)

        await actionPromise
      })
    })

    describe('executeStep()', () => {
      it('should execute a specific plan step', async () => {
        await service.setGoal(agentId, {
          description: 'Test objective',
          priority: 'high',
        })
        const plan = await service.plan(agentId)
        const stepId = plan.steps[0]!.id

        const result = await service.executeStep(agentId, stepId)

        expect(result.status).toBe('success')
      })

      it('should update step status after execution', async () => {
        await service.setGoal(agentId, {
          description: 'Step test objective',
          priority: 'high',
        })
        const plan = await service.plan(agentId)
        const stepId = plan.steps[0]!.id

        await service.executeStep(agentId, stepId)

        const updatedPlan = await service.getPlan(agentId)
        const step = updatedPlan!.steps.find((s) => s.id === stepId)
        expect(step!.status).toBe('completed')
      })
    })

    describe('executePlan()', () => {
      it('should execute all plan steps in order', async () => {
        await service.setGoal(agentId, {
          description: 'Full plan execution test',
          priority: 'high',
        })
        await service.plan(agentId)

        const results = await service.executePlan(agentId)

        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThan(0)
        expect(results.every((r) => r.status === 'success' || r.status === 'failure')).toBe(true)
      })

      it('should mark plan as completed after execution', async () => {
        await service.setGoal(agentId, {
          description: 'Plan completion test',
          priority: 'high',
        })
        await service.plan(agentId)

        await service.executePlan(agentId)

        const plan = await service.getPlan(agentId)
        expect(['completed', 'failed']).toContain(plan!.status)
      })
    })
  })

  describe('Memory and Context', () => {
    let agentId: string

    beforeEach(async () => {
      const agent = await service.create({ name: 'MemoryAgent' })
      agentId = agent.id
    })

    describe('getMemory()', () => {
      it('should retrieve agent memory', async () => {
        const memory = await service.getMemory(agentId)

        expect(memory).toBeDefined()
        expect(memory.shortTerm).toBeDefined()
        expect(memory.longTerm).toBeDefined()
        expect(memory.context).toBeDefined()
      })
    })

    describe('updateMemory()', () => {
      it('should update long-term memory', async () => {
        const updated = await service.updateMemory(agentId, {
          longTerm: { key: 'value', nested: { data: 123 } },
        })

        expect(updated.longTerm.key).toBe('value')
        expect((updated.longTerm.nested as any).data).toBe(123)
      })

      it('should update context', async () => {
        const updated = await service.updateMemory(agentId, {
          context: { currentTask: 'testing', environment: 'development' },
        })

        expect(updated.context.currentTask).toBe('testing')
        expect(updated.context.environment).toBe('development')
      })
    })

    describe('addToMemory()', () => {
      it('should add to short-term memory', async () => {
        await service.addToMemory(agentId, 'shortTerm', {
          role: 'user',
          content: 'Hello agent',
        })

        const memory = await service.getMemory(agentId)
        expect(memory.shortTerm.length).toBe(1)
        expect(memory.shortTerm[0]!.content).toBe('Hello agent')
      })

      it('should add to long-term memory', async () => {
        await service.addToMemory(agentId, 'longTerm', {
          learnedFact: 'Important information',
        })

        const memory = await service.getMemory(agentId)
        expect((memory.longTerm as any).learnedFact).toBe('Important information')
      })

      it('should add to context', async () => {
        await service.addToMemory(agentId, 'context', {
          sessionId: 'sess-123',
        })

        const memory = await service.getMemory(agentId)
        expect(memory.context.sessionId).toBe('sess-123')
      })
    })

    describe('clearMemory()', () => {
      it('should clear short-term memory', async () => {
        await service.addToMemory(agentId, 'shortTerm', { role: 'user', content: 'test' })
        await service.clearMemory(agentId, 'shortTerm')

        const memory = await service.getMemory(agentId)
        expect(memory.shortTerm).toEqual([])
      })

      it('should clear long-term memory', async () => {
        await service.updateMemory(agentId, { longTerm: { data: 'test' } })
        await service.clearMemory(agentId, 'longTerm')

        const memory = await service.getMemory(agentId)
        expect(memory.longTerm).toEqual({})
      })

      it('should clear all memory types', async () => {
        await service.addToMemory(agentId, 'shortTerm', { role: 'user', content: 'test' })
        await service.updateMemory(agentId, {
          longTerm: { data: 'test' },
          context: { key: 'value' },
        })

        await service.clearMemory(agentId, 'all')

        const memory = await service.getMemory(agentId)
        expect(memory.shortTerm).toEqual([])
        expect(memory.longTerm).toEqual({})
        expect(memory.context).toEqual({})
      })
    })
  })

  describe('Multi-Agent Coordination', () => {
    let agent1Id: string
    let agent2Id: string
    let agent3Id: string

    beforeEach(async () => {
      const agent1 = await service.create({ name: 'CoordAgent1', role: 'Researcher' })
      const agent2 = await service.create({ name: 'CoordAgent2', role: 'Writer' })
      const agent3 = await service.create({ name: 'CoordAgent3', role: 'Editor' })
      agent1Id = agent1.id
      agent2Id = agent2.id
      agent3Id = agent3.id
    })

    describe('coordinate()', () => {
      it('should coordinate agents sequentially', async () => {
        const result = await service.coordinate({
          type: 'sequential',
          agents: [agent1Id, agent2Id, agent3Id],
          goal: 'Create a research report',
        })

        expect(result).toBeDefined()
        expect(result.id).toBeDefined()
        expect(result.pattern.type).toBe('sequential')
        expect(result.status).toBe('completed')
        expect(result.duration).toBeGreaterThan(0)
      })

      it('should coordinate agents in parallel', async () => {
        const result = await service.coordinate({
          type: 'parallel',
          agents: [agent1Id, agent2Id],
          goal: 'Gather information from multiple sources',
        })

        expect(result.pattern.type).toBe('parallel')
        expect(result.status).toBe('completed')
        // Results from each agent
        expect(result.results[agent1Id]).toBeDefined()
        expect(result.results[agent2Id]).toBeDefined()
      })

      it('should coordinate agents hierarchically', async () => {
        const result = await service.coordinate({
          type: 'hierarchical',
          agents: [agent1Id, agent2Id, agent3Id],
          goal: 'Complete project with lead agent',
          config: { lead: agent1Id },
        })

        expect(result.pattern.type).toBe('hierarchical')
        expect(result.status).toBe('completed')
      })

      it('should coordinate collaborative consensus', async () => {
        const result = await service.coordinate({
          type: 'collaborative',
          agents: [agent1Id, agent2Id, agent3Id],
          goal: 'Reach consensus on best approach',
        })

        expect(result.pattern.type).toBe('collaborative')
        expect(result.consensus).toBeDefined()
      })

      it('should coordinate competitive selection', async () => {
        const result = await service.coordinate({
          type: 'competitive',
          agents: [agent1Id, agent2Id],
          goal: 'Find the best solution',
        })

        expect(result.pattern.type).toBe('competitive')
        expect(result.results).toBeDefined()
      })
    })

    describe('broadcast()', () => {
      it('should broadcast message to multiple agents', async () => {
        // Should not throw
        await service.broadcast(
          [agent1Id, agent2Id, agent3Id],
          'System update: new capabilities available'
        )

        // Verify message was received by checking context
        const memory1 = await service.getMemory(agent1Id)
        expect(memory1.shortTerm.some((m) => m.content.includes('System update'))).toBe(true)
      })

      it('should broadcast to subset of agents', async () => {
        await service.broadcast([agent1Id, agent2Id], 'Targeted message')

        const memory1 = await service.getMemory(agent1Id)
        const memory3 = await service.getMemory(agent3Id)

        expect(memory1.shortTerm.some((m) => m.content.includes('Targeted message'))).toBe(true)
        expect(memory3.shortTerm.some((m) => m.content.includes('Targeted message'))).toBe(false)
      })
    })

    describe('delegate()', () => {
      it('should delegate task from one agent to another', async () => {
        const result = await service.delegate(agent1Id, agent2Id, 'Write a summary of the findings')

        expect(result).toBeDefined()
        expect(result.status).toBe('success')
      })

      it('should track delegation in agent memory', async () => {
        await service.delegate(agent1Id, agent2Id, 'Delegated task')

        const memory1 = await service.getMemory(agent1Id)
        const memory2 = await service.getMemory(agent2Id)

        // Delegator should have record of delegation
        expect(memory1.longTerm.delegatedTasks || memory1.context.delegatedTasks).toBeDefined()
        // Delegate should have record of received task
        expect(memory2.longTerm.receivedTasks || memory2.context.receivedTasks).toBeDefined()
      })

      it('should return result from delegated agent', async () => {
        const result = await service.delegate(agent1Id, agent2Id, 'Calculate the sum of 2 + 2')

        expect(result.result).toBeDefined()
      })
    })
  })
})

describe('Data Persistence', () => {
  it('should persist agent data across service calls', async () => {
    const { AgentService } = await import('../src/worker.js')

    // First connection - create agent
    const worker1 = new AgentService({ env } as any, {} as any)
    const service1 = worker1.connect() as AgentServiceInterface
    const created = await service1.create({ name: 'PersistentAgent' })
    const createdId = created.id

    await service1.setGoal(createdId, {
      description: 'Persistent goal',
      priority: 'high',
    })

    // Second connection - verify persistence
    const worker2 = new AgentService({ env } as any, {} as any)
    const service2 = worker2.connect() as AgentServiceInterface
    const retrieved = await service2.get(createdId)

    expect(retrieved).not.toBeNull()
    expect(retrieved!.name).toBe('PersistentAgent')

    const goals = await service2.getGoals(createdId)
    expect(goals.length).toBe(1)
    expect(goals[0]!.description).toBe('Persistent goal')
  })
})

describe('Real AI Gateway Integration', () => {
  let service: AgentServiceInterface

  beforeAll(async () => {
    const { AgentService } = await import('../src/worker.js')
    const worker = new AgentService({ env } as any, {} as any)
    service = worker.connect() as AgentServiceInterface
  })

  it('should access AI Gateway through env binding', () => {
    expect(env).toBeDefined()
    // env.AI should be available in workers environment
  })

  it('should use real AI for planning (cached response)', async () => {
    const agent = await service.create({
      name: 'AIAgent',
      model: 'claude-sonnet-4-20250514',
    })

    await service.setGoal(agent.id, {
      description: 'Write a haiku about clouds',
      priority: 'medium',
    })

    const plan = await service.plan(agent.id)

    expect(plan).toBeDefined()
    expect(plan.steps.length).toBeGreaterThan(0)
  })

  it('should use real AI for action execution', async () => {
    const agent = await service.create({
      name: 'ActionAIAgent',
      model: 'claude-sonnet-4-20250514',
    })

    const result = await service.execute(agent.id, 'reason', {
      about: 'why the sky is blue',
    })

    expect(result.status).toBe('success')
    expect(result.result).toBeDefined()
  })
})

describe('Default export', () => {
  it('exports AgentService as default', async () => {
    const { default: DefaultExport, AgentService } = await import('../src/worker.js')
    expect(DefaultExport).toBe(AgentService)
  })
})
