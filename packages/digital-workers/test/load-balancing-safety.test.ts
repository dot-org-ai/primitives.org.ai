/**
 * Load Balancing Safety Tests
 *
 * TDD tests for ensuring proper bounds checking and null safety
 * in load balancing operations. Replaces non-null assertions with
 * explicit bounds checks.
 *
 * Issue: aip-w8mm
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { AgentInfo, TaskRequest } from '../src/load-balancing.js'
import {
  createRoundRobinBalancer,
  createLeastBusyBalancer,
  createCapabilityRouter,
  createPriorityQueueBalancer,
  createMetricsCollector,
} from '../src/load-balancing.js'
import type { WorkerStatus } from '../src/types.js'

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
// Empty Agent Array Handling Tests
// ============================================================================

describe('Empty Agent Array Handling', () => {
  describe('RoundRobinBalancer with empty agents', () => {
    it('should handle empty agent array gracefully', () => {
      const balancer = createRoundRobinBalancer([])
      const task = createTask('task-1')

      const result = balancer.route(task)

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-available-agents')
      expect(result.strategy).toBe('round-robin')
    })

    it('should not throw when routing with zero agents', () => {
      const balancer = createRoundRobinBalancer([])

      expect(() => balancer.route(createTask('task-1'))).not.toThrow()
      expect(() => balancer.route(createTask('task-2'))).not.toThrow()
      expect(() => balancer.route(createTask('task-3'))).not.toThrow()
    })

    it('should handle agents being removed until empty', () => {
      const agents = [createAgent('agent-1')]
      const balancer = createRoundRobinBalancer(agents)

      // First route works
      const result1 = balancer.route(createTask('task-1'))
      expect(result1.agent?.id).toBe('agent-1')

      // Remove the only agent
      balancer.removeAgent('agent-1')

      // Now routing should handle empty gracefully
      const result2 = balancer.route(createTask('task-2'))
      expect(result2.agent).toBeNull()
      expect(result2.reason).toBe('no-available-agents')
    })
  })

  describe('LeastBusyBalancer with empty agents', () => {
    it('should handle empty agent array gracefully', () => {
      const balancer = createLeastBusyBalancer([])
      const task = createTask('task-1')

      const result = balancer.route(task)

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-available-agents')
      expect(result.strategy).toBe('least-busy')
    })

    it('should not throw when sorting empty available agents', () => {
      // All agents are at max capacity
      const agents = [
        createAgent('agent-1', [], 'available', 10), // maxLoad is 10
        createAgent('agent-2', [], 'available', 10),
      ]
      const balancer = createLeastBusyBalancer(agents)

      // Should not throw when sorting an empty array after filtering
      expect(() => balancer.route(createTask('task-1'))).not.toThrow()
    })

    it('should handle all agents being removed', () => {
      const agents = [createAgent('agent-1')]
      const balancer = createLeastBusyBalancer(agents)

      balancer.removeAgent('agent-1')

      const result = balancer.route(createTask('task-1'))
      expect(result.agent).toBeNull()
    })
  })

  describe('CapabilityRouter with empty agents', () => {
    it('should handle empty agent array gracefully', () => {
      const router = createCapabilityRouter([])
      const task = createTask('task-1', ['code'])

      const result = router.route(task)

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-matching-capability')
    })

    it('should handle empty candidates after skill filtering', () => {
      const agents = [createAgent('agent-1', ['deploy']), createAgent('agent-2', ['monitor'])]
      const router = createCapabilityRouter(agents)

      // No agent has 'code' skill
      const result = router.route(createTask('code-task', ['code']))

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-matching-capability')
    })
  })

  describe('PriorityQueueBalancer with empty agents', () => {
    it('should handle empty agent array gracefully', () => {
      const balancer = createPriorityQueueBalancer([])
      const task = createTask('task-1')

      const result = balancer.route(task)

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-available-agents')
    })

    it('should handle routeNext with empty agents', async () => {
      const balancer = createPriorityQueueBalancer([])
      balancer.enqueue(createTask('task-1', [], 5))

      const result = await balancer.routeNext()

      expect(result).not.toBeNull()
      expect(result?.agent).toBeNull()
      expect(result?.reason).toBe('no-available-agents')
    })
  })
})

// ============================================================================
// Single Agent Selection Tests
// ============================================================================

describe('Single Agent Selection', () => {
  describe('RoundRobinBalancer with single agent', () => {
    it('should always route to the single available agent', () => {
      const agents = [createAgent('only-agent')]
      const balancer = createRoundRobinBalancer(agents)

      for (let i = 0; i < 5; i++) {
        const result = balancer.route(createTask(`task-${i}`))
        expect(result.agent?.id).toBe('only-agent')
      }
    })

    it('should handle single offline agent', () => {
      const agents = [createAgent('offline-agent', [], 'offline')]
      const balancer = createRoundRobinBalancer(agents)

      const result = balancer.route(createTask('task-1'))

      expect(result.agent).toBeNull()
      expect(result.reason).toBe('no-available-agents')
    })
  })

  describe('LeastBusyBalancer with single agent', () => {
    it('should route to single agent regardless of load', () => {
      const agents = [createAgent('only-agent', [], 'available', 5)]
      const balancer = createLeastBusyBalancer(agents)

      const result = balancer.route(createTask('task-1'))

      expect(result.agent?.id).toBe('only-agent')
    })

    it('should not route when single agent is at max capacity', () => {
      const agents = [createAgent('full-agent', [], 'available', 10)]
      const balancer = createLeastBusyBalancer(agents)

      const result = balancer.route(createTask('task-1'))

      expect(result.agent).toBeNull()
    })
  })

  describe('CapabilityRouter with single agent', () => {
    it('should route when single agent has required skills', () => {
      const agents = [createAgent('skilled-agent', ['code', 'review'])]
      const router = createCapabilityRouter(agents)

      const result = router.route(createTask('code-task', ['code']))

      expect(result.agent?.id).toBe('skilled-agent')
    })

    it('should not route when single agent lacks skills', () => {
      const agents = [createAgent('wrong-skills', ['deploy'])]
      const router = createCapabilityRouter(agents)

      const result = router.route(createTask('code-task', ['code']))

      expect(result.agent).toBeNull()
    })
  })
})

// ============================================================================
// Empty Queue Handling Tests
// ============================================================================

describe('Empty Queue Handling', () => {
  describe('PriorityQueueBalancer empty queue', () => {
    it('should return null for routeNext on empty queue', async () => {
      const agents = [createAgent('agent-1')]
      const balancer = createPriorityQueueBalancer(agents)

      const result = await balancer.routeNext()

      expect(result).toBeNull()
    })

    it('should return null for peek on empty queue', () => {
      const agents = [createAgent('agent-1')]
      const balancer = createPriorityQueueBalancer(agents)

      const peeked = balancer.peek()

      expect(peeked).toBeNull()
    })

    it('should handle queue being emptied', async () => {
      const agents = [createAgent('agent-1')]
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('task-1', [], 5))

      // Dequeue the only task
      const result1 = await balancer.routeNext()
      expect(result1?.task.id).toBe('task-1')

      // Queue is now empty
      const result2 = await balancer.routeNext()
      expect(result2).toBeNull()
    })

    it('should handle clear then routeNext', async () => {
      const agents = [createAgent('agent-1')]
      const balancer = createPriorityQueueBalancer(agents)

      balancer.enqueue(createTask('task-1', [], 5))
      balancer.enqueue(createTask('task-2', [], 5))

      balancer.clear()

      const result = await balancer.routeNext()
      expect(result).toBeNull()
    })
  })
})

// ============================================================================
// Edge Cases with Zero-Length Arrays
// ============================================================================

describe('Edge Cases with Zero-Length Arrays', () => {
  describe('Index out of bounds prevention', () => {
    it('should handle modulo on empty array length safely', () => {
      // This tests the fix for: const agent = agents[currentIndex % agents.length]!
      // When agents.length is 0, this would cause division by zero
      const balancer = createRoundRobinBalancer([])

      // Route multiple times to test index incrementing
      for (let i = 0; i < 10; i++) {
        expect(() => balancer.route(createTask(`task-${i}`))).not.toThrow()
      }
    })

    it('should handle sorted array access on empty result safely', () => {
      // This tests the fix for: const selected = sorted[0]!
      // When sorted is empty, this would throw
      const balancer = createLeastBusyBalancer([])

      expect(() => balancer.route(createTask('task-1'))).not.toThrow()
    })

    it('should handle shift on empty queue safely', async () => {
      // This tests the fix for: const task = queue.shift()!
      const balancer = createPriorityQueueBalancer([createAgent('agent-1')])

      // Don't enqueue anything, just try to route
      const result = await balancer.routeNext()
      expect(result).toBeNull()
    })
  })

  describe('Concurrent agent modifications', () => {
    it('should handle agent removal during routing iteration', () => {
      const agents = [createAgent('agent-1'), createAgent('agent-2'), createAgent('agent-3')]
      const balancer = createRoundRobinBalancer(agents)

      // Route once
      balancer.route(createTask('task-1'))

      // Remove an agent
      balancer.removeAgent('agent-2')

      // Should still work
      expect(() => balancer.route(createTask('task-2'))).not.toThrow()
    })

    it('should handle all agents being removed during operation', () => {
      const agents = [createAgent('agent-1'), createAgent('agent-2')]
      const balancer = createRoundRobinBalancer(agents)

      balancer.removeAgent('agent-1')
      balancer.removeAgent('agent-2')

      const result = balancer.route(createTask('task-1'))
      expect(result.agent).toBeNull()
    })
  })

  describe('Metrics collection with empty results', () => {
    it('should collect metrics even with empty agent arrays', () => {
      const collector = createMetricsCollector()
      const balancer = createRoundRobinBalancer([], { metricsCollector: collector })

      balancer.route(createTask('task-1'))
      balancer.route(createTask('task-2'))

      const metrics = collector.collect()

      expect(metrics.totalRouted).toBe(2)
      expect(metrics.failedRoutes).toBe(2)
    })
  })

  describe('Return type consistency', () => {
    it('should always return RouteResult even when no agent found', () => {
      const balancer = createRoundRobinBalancer([])
      const task = createTask('task-1')

      const result = balancer.route(task)

      // Verify all required properties exist
      expect(result).toHaveProperty('agent')
      expect(result).toHaveProperty('task')
      expect(result).toHaveProperty('strategy')
      expect(result).toHaveProperty('timestamp')
      expect(result.task).toBe(task)
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should return null agent, not undefined', () => {
      const balancer = createRoundRobinBalancer([])

      const result = balancer.route(createTask('task-1'))

      expect(result.agent).toBeNull()
      expect(result.agent).not.toBeUndefined()
    })
  })
})
