/**
 * Load Balancing and Routing Tests
 *
 * TDD tests for agent coordination with load balancing and routing capabilities.
 * Following Red-Green-Refactor methodology.
 */

import { describe, it, expect, beforeEach, afterEach, vi, expectTypeOf } from 'vitest'
import type {
  LoadBalancer,
  BalancerStrategy,
  AgentInfo,
  RouteResult,
  TaskRequest,
  AgentAvailability,
  RoutingRule,
  RoutingRuleCondition,
  RoutingMetrics,
  CompositeBalancerConfig,
} from '../src/load-balancing.js'
import {
  createRoundRobinBalancer,
  createLeastBusyBalancer,
  createCapabilityRouter,
  createPriorityQueueBalancer,
  createAgentAvailabilityTracker,
  createCompositeBalancer,
  createRoutingRuleEngine,
  // Metrics
  collectRoutingMetrics,
  resetRoutingMetrics,
} from '../src/load-balancing.js'
import type { Worker, WorkerStatus } from '../src/types.js'

// ============================================================================
// Test Fixtures
// ============================================================================

const createAgent = (
  id: string,
  skills: string[] = [],
  status: WorkerStatus = 'available',
  currentLoad = 0
): AgentInfo => ({
  id,
  name: `Agent ${id}`,
  type: 'agent',
  status,
  skills,
  currentLoad,
  maxLoad: 10,
  contacts: { api: `https://agent-${id}.example.com` },
  metadata: {},
})

const createTask = (
  id: string,
  requiredSkills: string[] = [],
  priority: number = 5
): TaskRequest => ({
  id,
  name: `Task ${id}`,
  requiredSkills,
  priority,
  metadata: {},
})

// ============================================================================
// Round-Robin Balancer Tests
// ============================================================================

describe('RoundRobinBalancer', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('agent-1', ['code', 'review']),
      createAgent('agent-2', ['code', 'test']),
      createAgent('agent-3', ['code', 'deploy']),
    ]
  })

  describe('route()', () => {
    it('should distribute tasks in round-robin order', () => {
      const balancer = createRoundRobinBalancer(agents)

      const task1 = createTask('task-1')
      const task2 = createTask('task-2')
      const task3 = createTask('task-3')
      const task4 = createTask('task-4')

      const result1 = balancer.route(task1)
      const result2 = balancer.route(task2)
      const result3 = balancer.route(task3)
      const result4 = balancer.route(task4)

      expect(result1.agent.id).toBe('agent-1')
      expect(result2.agent.id).toBe('agent-2')
      expect(result3.agent.id).toBe('agent-3')
      expect(result4.agent.id).toBe('agent-1') // Wraps around
    })

    it('should skip unavailable agents', () => {
      agents[1].status = 'offline'
      const balancer = createRoundRobinBalancer(agents)

      const task1 = createTask('task-1')
      const task2 = createTask('task-2')
      const task3 = createTask('task-3')

      const result1 = balancer.route(task1)
      const result2 = balancer.route(task2)
      const result3 = balancer.route(task3)

      expect(result1.agent.id).toBe('agent-1')
      expect(result2.agent.id).toBe('agent-3')
      expect(result3.agent.id).toBe('agent-1')
    })

    it('should return null route if no agents available', () => {
      agents.forEach(a => a.status = 'offline')
      const balancer = createRoundRobinBalancer(agents)

      const result = balancer.route(createTask('task-1'))

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-available-agents')
    })

    it('should include routing metadata in result', () => {
      const balancer = createRoundRobinBalancer(agents)
      const task = createTask('task-1')

      const result = balancer.route(task)

      expect(result.strategy).toBe('round-robin')
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.task).toBe(task)
    })
  })

  describe('addAgent() / removeAgent()', () => {
    it('should add new agents to the pool', () => {
      const balancer = createRoundRobinBalancer(agents)
      const newAgent = createAgent('agent-4', ['security'])

      balancer.addAgent(newAgent)

      // Route through all agents
      balancer.route(createTask('t1'))
      balancer.route(createTask('t2'))
      balancer.route(createTask('t3'))
      const result = balancer.route(createTask('t4'))

      expect(result.agent.id).toBe('agent-4')
    })

    it('should remove agents from the pool', () => {
      const balancer = createRoundRobinBalancer(agents)

      balancer.removeAgent('agent-2')

      const result1 = balancer.route(createTask('t1'))
      const result2 = balancer.route(createTask('t2'))
      const result3 = balancer.route(createTask('t3'))

      expect(result1.agent.id).toBe('agent-1')
      expect(result2.agent.id).toBe('agent-3')
      expect(result3.agent.id).toBe('agent-1')
    })
  })

  describe('getAgents()', () => {
    it('should return current agent list', () => {
      const balancer = createRoundRobinBalancer(agents)

      expect(balancer.getAgents()).toHaveLength(3)
      expect(balancer.getAgents().map(a => a.id)).toEqual([
        'agent-1',
        'agent-2',
        'agent-3',
      ])
    })
  })
})

// ============================================================================
// Least-Busy Balancer Tests
// ============================================================================

describe('LeastBusyBalancer', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('agent-1', ['code'], 'available', 5),  // 50% load
      createAgent('agent-2', ['code'], 'available', 2),  // 20% load
      createAgent('agent-3', ['code'], 'available', 8),  // 80% load
    ]
  })

  describe('route()', () => {
    it('should route to agent with lowest load', () => {
      const balancer = createLeastBusyBalancer(agents)

      const result = balancer.route(createTask('task-1'))

      expect(result.agent.id).toBe('agent-2') // Lowest load (20%)
    })

    it('should update load tracking after routing', () => {
      const balancer = createLeastBusyBalancer(agents)

      const result1 = balancer.route(createTask('task-1'))
      expect(result1.agent.id).toBe('agent-2')

      // After routing, agent-2's load increases
      const result2 = balancer.route(createTask('task-2'))
      // Now agent-2 has load 3, agent-1 has load 5
      expect(result2.agent.id).toBe('agent-2') // Still lowest
    })

    it('should skip agents at max capacity', () => {
      agents[1].currentLoad = 10 // Max capacity
      const balancer = createLeastBusyBalancer(agents)

      const result = balancer.route(createTask('task-1'))

      expect(result.agent.id).toBe('agent-1') // Next lowest
    })

    it('should calculate load percentage correctly', () => {
      const balancer = createLeastBusyBalancer(agents)

      const metrics = balancer.getLoadMetrics()

      expect(metrics['agent-1']).toBe(0.5)  // 5/10 = 50%
      expect(metrics['agent-2']).toBe(0.2)  // 2/10 = 20%
      expect(metrics['agent-3']).toBe(0.8)  // 8/10 = 80%
    })

    it('should handle tie-breaking with round-robin', () => {
      agents[0].currentLoad = 2
      agents[1].currentLoad = 2
      const balancer = createLeastBusyBalancer(agents)

      const result1 = balancer.route(createTask('task-1'))
      const result2 = balancer.route(createTask('task-2'))

      // Both have same load, should alternate
      expect(result1.agent.id).not.toBe(result2.agent.id)
    })
  })

  describe('releaseLoad()', () => {
    it('should decrease agent load when task completes', () => {
      const balancer = createLeastBusyBalancer(agents)

      balancer.route(createTask('task-1')) // Increases agent-2 load
      balancer.releaseLoad('agent-2')

      const metrics = balancer.getLoadMetrics()
      expect(metrics['agent-2']).toBe(0.2) // Back to original
    })
  })

  describe('setLoad()', () => {
    it('should allow manual load adjustment', () => {
      const balancer = createLeastBusyBalancer(agents)

      balancer.setLoad('agent-1', 1)

      const metrics = balancer.getLoadMetrics()
      expect(metrics['agent-1']).toBe(0.1)
    })
  })
})

// ============================================================================
// Capability-Based Router Tests
// ============================================================================

describe('CapabilityRouter', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('code-agent', ['code', 'review', 'test']),
      createAgent('deploy-agent', ['deploy', 'monitor', 'rollback']),
      createAgent('ml-agent', ['ml', 'data', 'train']),
      createAgent('full-stack', ['code', 'deploy', 'ml']),
    ]
  })

  describe('route()', () => {
    it('should route to agent with matching skills', () => {
      const router = createCapabilityRouter(agents)

      const task = createTask('code-task', ['code'])
      const result = router.route(task)

      expect(result.agent).not.toBeNull()
      expect(result.agent.skills).toContain('code')
    })

    it('should route to agent with all required skills', () => {
      const router = createCapabilityRouter(agents)

      const task = createTask('full-stack-task', ['code', 'deploy'])
      const result = router.route(task)

      expect(result.agent.id).toBe('full-stack')
    })

    it('should return null if no agent has required skills', () => {
      const router = createCapabilityRouter(agents)

      const task = createTask('impossible', ['quantum', 'teleport'])
      const result = router.route(task)

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-matching-capability')
    })

    it('should prefer agent with closest skill match (avoid over-qualification)', () => {
      const router = createCapabilityRouter(agents, { preferExactMatch: true })

      const task = createTask('code-only', ['code'])
      const result = router.route(task)

      // Should prefer code-agent over full-stack (closer match)
      expect(result.agent.id).toBe('code-agent')
    })

    it('should include skill match score in result', () => {
      const router = createCapabilityRouter(agents)

      const task = createTask('code-task', ['code', 'review'])
      const result = router.route(task)

      expect(result.matchScore).toBeDefined()
      expect(result.matchScore).toBeGreaterThan(0)
      expect(result.matchScore).toBeLessThanOrEqual(1)
    })
  })

  describe('findAgentsWithSkills()', () => {
    it('should return all agents with specified skills', () => {
      const router = createCapabilityRouter(agents)

      const matches = router.findAgentsWithSkills(['code'])

      expect(matches).toHaveLength(2)
      expect(matches.map(a => a.id)).toContain('code-agent')
      expect(matches.map(a => a.id)).toContain('full-stack')
    })

    it('should return empty array if no matches', () => {
      const router = createCapabilityRouter(agents)

      const matches = router.findAgentsWithSkills(['nonexistent'])

      expect(matches).toHaveLength(0)
    })
  })

  describe('getSkillCoverage()', () => {
    it('should return skill coverage across all agents', () => {
      const router = createCapabilityRouter(agents)

      const coverage = router.getSkillCoverage()

      expect(coverage.code).toBe(2) // 2 agents have 'code'
      expect(coverage.deploy).toBe(2)
      expect(coverage.ml).toBe(2)
      expect(coverage.review).toBe(1)
    })
  })
})

// ============================================================================
// Priority Queue Balancer Tests
// ============================================================================

describe('PriorityQueueBalancer', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('agent-1', ['general']),
      createAgent('agent-2', ['general']),
    ]
  })

  describe('enqueue() / route()', () => {
    it('should process higher priority tasks first', async () => {
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('low', [], 1))
      balancer.enqueue(createTask('high', [], 10))
      balancer.enqueue(createTask('medium', [], 5))

      const result1 = await balancer.routeNext()
      const result2 = await balancer.routeNext()
      const result3 = await balancer.routeNext()

      expect(result1.task.id).toBe('high')
      expect(result2.task.id).toBe('medium')
      expect(result3.task.id).toBe('low')
    })

    it('should handle equal priority with FIFO', async () => {
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('first', [], 5))
      balancer.enqueue(createTask('second', [], 5))
      balancer.enqueue(createTask('third', [], 5))

      const result1 = await balancer.routeNext()
      const result2 = await balancer.routeNext()
      const result3 = await balancer.routeNext()

      expect(result1.task.id).toBe('first')
      expect(result2.task.id).toBe('second')
      expect(result3.task.id).toBe('third')
    })

    it('should return null if queue is empty', async () => {
      const balancer = createPriorityQueueBalancer(agents)

      const result = await balancer.routeNext()

      expect(result).toBeNull()
    })
  })

  describe('priority preemption', () => {
    it('should support priority levels (1-10)', () => {
      const balancer = createPriorityQueueBalancer(agents)

      expect(() => balancer.enqueue(createTask('valid', [], 1))).not.toThrow()
      expect(() => balancer.enqueue(createTask('valid', [], 10))).not.toThrow()
      expect(() => balancer.enqueue(createTask('invalid', [], 0))).toThrow()
      expect(() => balancer.enqueue(createTask('invalid', [], 11))).toThrow()
    })

it('should support priority boost for aging tasks', async () => {
      vi.useFakeTimers()
      try {
        const balancer = createPriorityQueueBalancer(agents, {
          enableAging: true,
          agingBoostPerSecond: 1,
        })

        balancer.enqueue(createTask('old', [], 1))

        // Simulate time passing
        vi.advanceTimersByTime(5000)

        // Priority should have increased
        const effectivePriority = balancer.getEffectivePriority('old')
        expect(effectivePriority).toBeGreaterThan(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('starvation prevention', () => {
    it('should prevent task starvation with max wait time', async () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
      try {
        const balancer = createPriorityQueueBalancer(agents, {
          maxWaitTime: 10000, // 10 seconds max wait
        })

        const oldTask = createTask('starving', [], 1)
        balancer.enqueue(oldTask)

        // Advance time before adding high priority tasks
        vi.advanceTimersByTime(11000)

        // Keep adding higher priority tasks (these are added AFTER the wait time)
        for (let i = 0; i < 10; i++) {
          balancer.enqueue(createTask(`high-${i}`, [], 10))
        }

        // Starving task should be promoted due to max wait time exceeded
        const result = await balancer.routeNext()
        expect(result.task.id).toBe('starving')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('queue management', () => {
    it('should return queue size', () => {
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('t1'))
      balancer.enqueue(createTask('t2'))
      balancer.enqueue(createTask('t3'))

      expect(balancer.queueSize()).toBe(3)
    })

    it('should clear the queue', () => {
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('t1'))
      balancer.enqueue(createTask('t2'))

      balancer.clear()

      expect(balancer.queueSize()).toBe(0)
    })

    it('should peek at next task without removing', () => {
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('t1', [], 5))
      balancer.enqueue(createTask('t2', [], 10))

      const peeked = balancer.peek()
      expect(peeked.id).toBe('t2')
      expect(balancer.queueSize()).toBe(2) // Still 2
    })
  })
})

// ============================================================================
// Agent Availability Tracker Tests
// ============================================================================

describe('AgentAvailabilityTracker', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('agent-1'),
      createAgent('agent-2'),
      createAgent('agent-3', [], 'offline'),
    ]
  })

  describe('tracking availability', () => {
    it('should track agent availability status', () => {
      const tracker = createAgentAvailabilityTracker(agents)

      const availability = tracker.getAvailability('agent-1')

      expect(availability.status).toBe('available')
      expect(availability.lastSeen).toBeInstanceOf(Date)
    })

    it('should update agent status', () => {
      const tracker = createAgentAvailabilityTracker(agents)

      tracker.updateStatus('agent-1', 'busy')

      const availability = tracker.getAvailability('agent-1')
      expect(availability.status).toBe('busy')
    })

    it('should return all available agents', () => {
      const tracker = createAgentAvailabilityTracker(agents)

      const available = tracker.getAvailableAgents()

      expect(available).toHaveLength(2)
      expect(available.map(a => a.id)).toContain('agent-1')
      expect(available.map(a => a.id)).toContain('agent-2')
    })
  })

  describe('heartbeat tracking', () => {
    it('should update lastSeen on heartbeat', () => {
      vi.useFakeTimers()
      try {
        const tracker = createAgentAvailabilityTracker(agents)

        const before = tracker.getAvailability('agent-1').lastSeen

        vi.advanceTimersByTime(1000)
        tracker.heartbeat('agent-1')

        const after = tracker.getAvailability('agent-1').lastSeen
        expect(after.getTime()).toBeGreaterThan(before.getTime())
      } finally {
        vi.useRealTimers()
      }
    })

    it('should mark agent offline after timeout', () => {
      vi.useFakeTimers()
      try {
        const tracker = createAgentAvailabilityTracker(agents, {
          heartbeatTimeout: 5000,
        })

        vi.advanceTimersByTime(6000)
        tracker.checkTimeouts()

        const availability = tracker.getAvailability('agent-1')
        expect(availability.status).toBe('offline')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('availability events', () => {
    it('should emit events on status change', () => {
      const tracker = createAgentAvailabilityTracker(agents)
      const handler = vi.fn()

      tracker.onStatusChange(handler)
      tracker.updateStatus('agent-1', 'busy')

      expect(handler).toHaveBeenCalledWith({
        agentId: 'agent-1',
        previousStatus: 'available',
        currentStatus: 'busy',
        timestamp: expect.any(Date),
      })
    })
  })

  describe('capacity tracking', () => {
    it('should track current capacity utilization', () => {
      const tracker = createAgentAvailabilityTracker(agents)

      tracker.updateLoad('agent-1', 5, 10) // 50% capacity
      tracker.updateLoad('agent-2', 8, 10) // 80% capacity

      const utilization = tracker.getCapacityUtilization()

      expect(utilization['agent-1']).toBe(0.5)
      expect(utilization['agent-2']).toBe(0.8)
    })

    it('should calculate overall capacity', () => {
      const tracker = createAgentAvailabilityTracker(agents)

      tracker.updateLoad('agent-1', 5, 10)
      tracker.updateLoad('agent-2', 8, 10)

      const overall = tracker.getOverallCapacity()

      expect(overall.total).toBe(20)       // 2 available agents * 10 max each
      expect(overall.used).toBe(13)        // 5 + 8
      expect(overall.available).toBe(7)   // 20 - 13
      expect(overall.utilization).toBeCloseTo(0.65) // 13/20
    })
  })
})

// ============================================================================
// Routing Rule Engine Tests
// ============================================================================

describe('RoutingRuleEngine', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('fast-agent', ['code'], 'available', 0),
      createAgent('slow-agent', ['code'], 'available', 5),
      createAgent('secure-agent', ['security'], 'available', 0),
    ]
  })

  describe('rule definition', () => {
    it('should create routing rules', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'security-tasks',
        priority: 10,
        condition: (task) => task.requiredSkills.includes('security'),
        action: (task, agents) => agents.find(a => a.id === 'secure-agent'),
      })

      const rules = engine.getRules()
      expect(rules).toHaveLength(1)
      expect(rules[0].name).toBe('security-tasks')
    })

    it('should validate rule structure', () => {
      const engine = createRoutingRuleEngine(agents)

      expect(() => engine.addRule({
        name: '',  // Invalid: empty name
        priority: 1,
        condition: () => true,
        action: () => null,
      })).toThrow()

      expect(() => engine.addRule({
        name: 'valid',
        priority: -1,  // Invalid: negative priority
        condition: () => true,
        action: () => null,
      })).toThrow()
    })
  })

  describe('rule evaluation', () => {
    it('should evaluate rules in priority order', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'low-priority',
        priority: 1,
        condition: () => true,
        action: () => agents[1], // slow-agent
      })

      engine.addRule({
        name: 'high-priority',
        priority: 10,
        condition: () => true,
        action: () => agents[0], // fast-agent
      })

      const result = engine.route(createTask('test'))

      expect(result.agent.id).toBe('fast-agent')
      expect(result.matchedRule).toBe('high-priority')
    })

    it('should skip rules with false conditions', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'never-match',
        priority: 10,
        condition: () => false,
        action: () => agents[0],
      })

      engine.addRule({
        name: 'always-match',
        priority: 1,
        condition: () => true,
        action: () => agents[1],
      })

      const result = engine.route(createTask('test'))

      expect(result.agent.id).toBe('slow-agent')
      expect(result.matchedRule).toBe('always-match')
    })

    it('should use default routing if no rules match', () => {
      const engine = createRoutingRuleEngine(agents, {
        defaultStrategy: 'least-busy',
      })

      engine.addRule({
        name: 'never-match',
        priority: 10,
        condition: () => false,
        action: () => agents[0],
      })

      const result = engine.route(createTask('test'))

      // Should use default strategy when no rules match
      // fast-agent and secure-agent both have load 0, so either could be selected
      expect(['fast-agent', 'secure-agent']).toContain(result.agent.id)
      expect(result.matchedRule).toBeNull()
      expect(result.usedDefault).toBe(true)
    })
  })

  describe('condition types', () => {
    it('should support skill-based conditions', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'security-route',
        priority: 5,
        condition: { requiredSkills: { contains: 'security' } },
        action: () => agents.find(a => a.id === 'secure-agent'),
      })

      const secTask = createTask('sec-task', ['security'])
      const codeTask = createTask('code-task', ['code'])

      const secResult = engine.route(secTask)
      expect(secResult.agent.id).toBe('secure-agent')

      // Code task shouldn't match security rule
      const codeResult = engine.route(codeTask)
      expect(codeResult.matchedRule).not.toBe('security-route')
    })

    it('should support priority-based conditions', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'high-priority-route',
        priority: 10,
        condition: { priority: { gte: 8 } },
        action: () => agents[0], // Fast agent for high priority
      })

      const highPriority = createTask('urgent', [], 9)
      const lowPriority = createTask('normal', [], 3)

      expect(engine.route(highPriority).matchedRule).toBe('high-priority-route')
      expect(engine.route(lowPriority).matchedRule).not.toBe('high-priority-route')
    })

    it('should support metadata-based conditions', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'internal-route',
        priority: 5,
        condition: { metadata: { source: 'internal' } },
        action: () => agents[0],
      })

      const internalTask = createTask('internal-task')
      internalTask.metadata = { source: 'internal' }

      const externalTask = createTask('external-task')
      externalTask.metadata = { source: 'external' }

      expect(engine.route(internalTask).matchedRule).toBe('internal-route')
      expect(engine.route(externalTask).matchedRule).not.toBe('internal-route')
    })
  })

  describe('rule management', () => {
    it('should remove rules by name', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'temp-rule',
        priority: 1,
        condition: () => true,
        action: () => agents[0],
      })

      expect(engine.getRules()).toHaveLength(1)

      engine.removeRule('temp-rule')

      expect(engine.getRules()).toHaveLength(0)
    })

    it('should update existing rules', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'my-rule',
        priority: 1,
        condition: () => true,
        action: () => agents[0],
      })

      engine.updateRule('my-rule', { priority: 10 })

      const rules = engine.getRules()
      expect(rules[0].priority).toBe(10)
    })

    it('should enable/disable rules', () => {
      const engine = createRoutingRuleEngine(agents)

      engine.addRule({
        name: 'toggleable',
        priority: 10,
        condition: () => true,
        action: () => agents[0],
      })

      engine.disableRule('toggleable')
      expect(engine.route(createTask('test')).matchedRule).not.toBe('toggleable')

      engine.enableRule('toggleable')
      expect(engine.route(createTask('test')).matchedRule).toBe('toggleable')
    })
  })
})

// ============================================================================
// Composite Balancer Tests
// ============================================================================

describe('CompositeBalancer', () => {
  let agents: AgentInfo[]

  beforeEach(() => {
    agents = [
      createAgent('agent-1', ['code'], 'available', 2),
      createAgent('agent-2', ['code', 'review'], 'available', 5),
      createAgent('agent-3', ['deploy'], 'available', 1),
    ]
  })

  describe('strategy composition', () => {
    it('should use first successful strategy', () => {
      const balancer = createCompositeBalancer(agents, {
        strategies: ['capability', 'least-busy'],
      })

      const task = createTask('code-task', ['code'])
      const result = balancer.route(task)

      // Capability router finds agent-1 (has 'code' skill)
      expect(result.agent.id).toBe('agent-1')
      // Only includes strategies attempted before success
      expect(result.strategies).toContain('capability')
    })

    it('should fallback through strategies', () => {
      const balancer = createCompositeBalancer(agents, {
        strategies: ['capability', 'round-robin'],
        fallbackBehavior: 'next-strategy',
      })

      // Task with no matching skills
      const task = createTask('unknown-task', ['quantum'])

      // Should fallback to round-robin since no capability match
      const result = balancer.route(task)
      expect(result.agent).not.toBeNull()
      expect(result.usedFallback).toBe(true)
    })

    it('should support weighted strategy combination', () => {
      const balancer = createCompositeBalancer(agents, {
        strategies: [
          { strategy: 'capability', weight: 0.7 },
          { strategy: 'least-busy', weight: 0.3 },
        ],
      })

      const task = createTask('weighted-task', ['code'])
      const result = balancer.route(task)

      // When capability succeeds, it records the weight
      expect(result.strategyScores).toBeDefined()
      expect(result.strategyScores.capability).toBe(0.7)
    })
  })

  describe('custom strategy plugins', () => {
    it('should support custom routing strategies', () => {
      const balancer = createCompositeBalancer(agents, {
        strategies: ['custom'],
        customStrategies: {
          custom: (task, agents) => {
            // Always pick the last agent
            return agents[agents.length - 1]
          },
        },
      })

      const result = balancer.route(createTask('test'))

      expect(result.agent.id).toBe('agent-3')
    })
  })
})

// ============================================================================
// Routing Metrics Tests
// ============================================================================

describe('RoutingMetrics', () => {
  beforeEach(() => {
    resetRoutingMetrics()
  })

  describe('collectRoutingMetrics()', () => {
    it('should track routing decisions', () => {
      const agents = [createAgent('agent-1')]
      const balancer = createRoundRobinBalancer(agents)

      balancer.route(createTask('t1'))
      balancer.route(createTask('t2'))
      balancer.route(createTask('t3'))

      const metrics = collectRoutingMetrics()

      expect(metrics.totalRouted).toBe(3)
    })

    it('should track routing latency', () => {
      const agents = [createAgent('agent-1')]
      const balancer = createRoundRobinBalancer(agents)

      balancer.route(createTask('t1'))

      const metrics = collectRoutingMetrics()

      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0)
    })

    it('should track per-agent distribution', () => {
      const agents = [
        createAgent('agent-1'),
        createAgent('agent-2'),
      ]
      const balancer = createRoundRobinBalancer(agents)

      balancer.route(createTask('t1'))
      balancer.route(createTask('t2'))
      balancer.route(createTask('t3'))
      balancer.route(createTask('t4'))

      const metrics = collectRoutingMetrics()

      expect(metrics.perAgent['agent-1'].routedCount).toBe(2)
      expect(metrics.perAgent['agent-2'].routedCount).toBe(2)
    })

    it('should track failed routing attempts', () => {
      const agents = [createAgent('agent-1', [], 'offline')]
      const balancer = createRoundRobinBalancer(agents)

      balancer.route(createTask('t1'))

      const metrics = collectRoutingMetrics()

      expect(metrics.failedRoutes).toBe(1)
    })

    it('should track strategy usage', () => {
      const agents = [createAgent('agent-1')]
      const rrBalancer = createRoundRobinBalancer(agents)
      const lbBalancer = createLeastBusyBalancer(agents)

      rrBalancer.route(createTask('t1'))
      rrBalancer.route(createTask('t2'))
      lbBalancer.route(createTask('t3'))

      const metrics = collectRoutingMetrics()

      expect(metrics.strategyUsage['round-robin']).toBe(2)
      expect(metrics.strategyUsage['least-busy']).toBe(1)
    })
  })

  describe('resetRoutingMetrics()', () => {
    it('should reset all metrics to zero', () => {
      const agents = [createAgent('agent-1')]
      const balancer = createRoundRobinBalancer(agents)

      balancer.route(createTask('t1'))

      resetRoutingMetrics()

      const metrics = collectRoutingMetrics()
      expect(metrics.totalRouted).toBe(0)
    })
  })
})

// ============================================================================
// Type Definition Tests
// ============================================================================

describe('Type Definitions', () => {
  it('should have correct LoadBalancer interface', () => {
    const balancer: LoadBalancer = {
      route: vi.fn(),
      addAgent: vi.fn(),
      removeAgent: vi.fn(),
      getAgents: vi.fn().mockReturnValue([]),
    }

    expectTypeOf(balancer.route).toBeFunction()
    expectTypeOf(balancer.addAgent).toBeFunction()
    expectTypeOf(balancer.removeAgent).toBeFunction()
    expectTypeOf(balancer.getAgents).toBeFunction()
  })

  it('should have correct AgentInfo type', () => {
    const agent: AgentInfo = {
      id: 'test',
      name: 'Test Agent',
      type: 'agent',
      status: 'available',
      skills: [],
      currentLoad: 0,
      maxLoad: 10,
      contacts: {},
      metadata: {},
    }

    expectTypeOf(agent).toHaveProperty('id')
    expectTypeOf(agent).toHaveProperty('skills')
    expectTypeOf(agent).toHaveProperty('currentLoad')
    expectTypeOf(agent).toHaveProperty('maxLoad')
  })

  it('should have correct RouteResult type', () => {
    const result: RouteResult = {
      agent: null as any,
      task: null as any,
      strategy: 'round-robin',
      timestamp: new Date(),
    }

    expectTypeOf(result).toHaveProperty('agent')
    expectTypeOf(result).toHaveProperty('task')
    expectTypeOf(result).toHaveProperty('strategy')
    expectTypeOf(result).toHaveProperty('timestamp')
  })

  it('should have correct TaskRequest type', () => {
    const task: TaskRequest = {
      id: 'test',
      name: 'Test Task',
      requiredSkills: [],
      priority: 5,
      metadata: {},
    }

    expectTypeOf(task).toHaveProperty('id')
    expectTypeOf(task).toHaveProperty('requiredSkills')
    expectTypeOf(task).toHaveProperty('priority')
  })

  it('should have correct RoutingRule type', () => {
    const rule: RoutingRule = {
      name: 'test-rule',
      priority: 1,
      condition: () => true,
      action: () => null as any,
    }

    expectTypeOf(rule).toHaveProperty('name')
    expectTypeOf(rule).toHaveProperty('priority')
    expectTypeOf(rule).toHaveProperty('condition')
    expectTypeOf(rule).toHaveProperty('action')
  })
})
