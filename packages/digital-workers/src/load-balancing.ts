/**
 * Load Balancing and Routing for Agent Coordination
 *
 * Provides intelligent task distribution and priority-based handling for
 * coordinating work across multiple agents. Includes multiple balancing
 * strategies, capability-based routing, and comprehensive metrics.
 *
 * @packageDocumentation
 */

import type { WorkerStatus, Contacts } from './types.js'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Balancer strategy identifier
 */
export type BalancerStrategy =
  | 'round-robin'
  | 'least-busy'
  | 'capability'
  | 'priority-queue'
  | 'custom'

/**
 * Extended agent information for load balancing
 */
export interface AgentInfo {
  id: string
  name: string
  type: 'agent'
  status: WorkerStatus
  skills: string[]
  currentLoad: number
  maxLoad: number
  contacts: Contacts
  metadata: Record<string, unknown>
}

/**
 * Task request for routing
 */
export interface TaskRequest {
  id: string
  name: string
  requiredSkills: string[]
  priority: number
  metadata: Record<string, unknown>
  enqueuedAt?: Date
}

/**
 * Result of a routing decision
 */
export interface RouteResult {
  agent: AgentInfo | null
  task: TaskRequest
  strategy: BalancerStrategy
  timestamp: Date
  reason?: string
  matchScore?: number
  matchedRule?: string | null
  usedDefault?: boolean
  usedFallback?: boolean
  strategies?: BalancerStrategy[]
  strategyScores?: Record<string, number>
}

/**
 * Agent availability information
 */
export interface AgentAvailability {
  status: WorkerStatus
  lastSeen: Date
  currentLoad?: number
  maxLoad?: number
}

/**
 * Routing rule definition
 */
export interface RoutingRule {
  name: string
  priority: number
  condition: RoutingRuleCondition
  action: (task: TaskRequest, agents: AgentInfo[]) => AgentInfo | null
  enabled?: boolean
}

/**
 * Routing rule condition - function or declarative
 */
export type RoutingRuleCondition =
  | ((task: TaskRequest) => boolean)
  | {
      requiredSkills?: { contains: string }
      priority?: { gte?: number; lte?: number }
      metadata?: Record<string, unknown>
    }

/**
 * Routing metrics
 */
export interface RoutingMetrics {
  totalRouted: number
  failedRoutes: number
  averageLatencyMs: number
  perAgent: Record<string, { routedCount: number; lastRouted?: Date }>
  strategyUsage: Record<string, number>
}

/**
 * Composite balancer configuration
 */
export interface CompositeBalancerConfig {
  strategies: Array<BalancerStrategy | { strategy: BalancerStrategy; weight: number }>
  fallbackBehavior?: 'next-strategy' | 'none'
  customStrategies?: Record<string, (task: TaskRequest, agents: AgentInfo[]) => AgentInfo | null>
  /**
   * Optional metrics collector for isolated metrics tracking.
   * If not provided, uses the default global collector.
   */
  metricsCollector?: MetricsCollector
}

/**
 * Load balancer interface
 */
export interface LoadBalancer {
  route(task: TaskRequest): RouteResult
  addAgent(agent: AgentInfo): void
  removeAgent(agentId: string): void
  getAgents(): AgentInfo[]
}

/**
 * Metrics collector interface for thread-safe metrics collection.
 *
 * Each MetricsCollector instance maintains its own isolated state,
 * allowing multiple balancers to either share a collector for
 * aggregated metrics or use separate collectors for isolated tracking.
 *
 * @remarks
 * Thread-safety is achieved through instance isolation. Each collector
 * maintains its own metrics state, eliminating race conditions between
 * different balancer instances. For shared metrics across multiple
 * balancers, pass the same collector instance to each balancer.
 */
export interface MetricsCollector {
  /**
   * Record a routing event.
   * @internal This method is called by balancers during routing.
   */
  record(result: RouteResult, latencyMs: number, strategy: BalancerStrategy): void

  /**
   * Collect current routing metrics.
   * @returns A copy of the current metrics state
   */
  collect(): RoutingMetrics

  /**
   * Reset all metrics to initial state.
   */
  reset(): void
}

// ============================================================================
// Safe Array Access Utilities
// ============================================================================

/**
 * Safely get the first element of an array.
 *
 * Provides type-safe access to array elements without non-null assertions.
 *
 * @param arr - The array to access
 * @returns The first element or undefined if array is empty
 */
function safeFirst<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[0] : undefined
}

/**
 * Safely get an element at a specific index.
 *
 * Provides type-safe access with bounds checking.
 *
 * @param arr - The array to access
 * @param index - The index to access
 * @returns The element at the index or undefined if out of bounds
 */
function safeAt<T>(arr: T[], index: number): T | undefined {
  if (arr.length === 0 || index < 0 || index >= arr.length) {
    return undefined
  }
  return arr[index]
}

// ============================================================================
// MetricsCollector Implementation
// ============================================================================

/**
 * Create a new MetricsCollector instance with isolated state.
 *
 * This factory function creates a thread-safe metrics collector that
 * encapsulates all metrics state within the returned instance. Multiple
 * collectors can be used independently without interference.
 *
 * @example
 * ```typescript
 * // Create isolated collectors for different environments
 * const prodCollector = createMetricsCollector()
 * const testCollector = createMetricsCollector()
 *
 * // Balancers with separate metrics
 * const prodBalancer = createRoundRobinBalancer(agents, { metricsCollector: prodCollector })
 * const testBalancer = createRoundRobinBalancer(agents, { metricsCollector: testCollector })
 * ```
 *
 * @example
 * ```typescript
 * // Shared collector for aggregated metrics
 * const sharedCollector = createMetricsCollector()
 * const balancer1 = createRoundRobinBalancer(agents, { metricsCollector: sharedCollector })
 * const balancer2 = createLeastBusyBalancer(agents, { metricsCollector: sharedCollector })
 *
 * // Get combined metrics
 * const metrics = sharedCollector.collect()
 * ```
 *
 * @returns A new MetricsCollector instance
 */
export function createMetricsCollector(): MetricsCollector {
  // Instance-local state - each collector has its own isolated metrics
  let metricsState: RoutingMetrics = {
    totalRouted: 0,
    failedRoutes: 0,
    averageLatencyMs: 0,
    perAgent: {},
    strategyUsage: {},
  }
  let totalLatency = 0

  function record(result: RouteResult, latencyMs: number, strategy: BalancerStrategy): void {
    metricsState.totalRouted++
    totalLatency += latencyMs
    metricsState.averageLatencyMs = totalLatency / metricsState.totalRouted

    if (!result.agent) {
      metricsState.failedRoutes++
    } else {
      const agentId = result.agent.id
      if (!metricsState.perAgent[agentId]) {
        metricsState.perAgent[agentId] = { routedCount: 0 }
      }
      metricsState.perAgent[agentId].routedCount++
      metricsState.perAgent[agentId].lastRouted = new Date()
    }

    metricsState.strategyUsage[strategy] = (metricsState.strategyUsage[strategy] || 0) + 1
  }

  function collect(): RoutingMetrics {
    // Return a deep copy to prevent external mutation
    return {
      ...metricsState,
      perAgent: { ...metricsState.perAgent },
      strategyUsage: { ...metricsState.strategyUsage },
    }
  }

  function reset(): void {
    metricsState = {
      totalRouted: 0,
      failedRoutes: 0,
      averageLatencyMs: 0,
      perAgent: {},
      strategyUsage: {},
    }
    totalLatency = 0
  }

  return { record, collect, reset }
}

// ============================================================================
// Default Global Metrics Collector (Backward Compatibility)
// ============================================================================

/**
 * Default metrics collector singleton for backward compatibility.
 * Used when no explicit collector is provided to balancer factories.
 */
const defaultMetricsCollector = createMetricsCollector()

/**
 * Collect current routing metrics from the default global collector.
 *
 * @remarks
 * This function is provided for backward compatibility. For new code,
 * consider using explicit MetricsCollector instances for better isolation.
 *
 * @returns Current routing metrics
 */
export function collectRoutingMetrics(): RoutingMetrics {
  return defaultMetricsCollector.collect()
}

/**
 * Reset all routing metrics in the default global collector.
 *
 * @remarks
 * This function is provided for backward compatibility. For new code,
 * consider using explicit MetricsCollector instances for better isolation.
 */
export function resetRoutingMetrics(): void {
  defaultMetricsCollector.reset()
}

// ============================================================================
// Round-Robin Balancer
// ============================================================================

/**
 * Options for round-robin load balancer
 */
interface RoundRobinBalancerOptions {
  /**
   * Optional metrics collector for isolated metrics tracking.
   * If not provided, uses the default global collector.
   */
  metricsCollector?: MetricsCollector
}

/**
 * Create a round-robin load balancer
 *
 * Distributes tasks evenly across all available agents in order.
 *
 * @param initialAgents - Initial set of agents to balance across
 * @param options - Optional configuration including metricsCollector
 * @returns A LoadBalancer instance
 */
export function createRoundRobinBalancer(
  initialAgents: AgentInfo[],
  options: RoundRobinBalancerOptions = {}
): LoadBalancer {
  let agents = [...initialAgents]
  let currentIndex = 0
  const collector = options.metricsCollector ?? defaultMetricsCollector

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter((a) => a.status === 'available' || a.status === 'busy')
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const available = getAvailableAgents()

    if (available.length === 0) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'round-robin',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'round-robin')
      return result
    }

    // Find the next available agent starting from current index
    let attempts = 0
    while (attempts < agents.length) {
      const agent = safeAt(agents, currentIndex % agents.length)
      currentIndex++
      if (!agent) {
        attempts++
        continue
      }

      if (agent.status === 'available' || agent.status === 'busy') {
        const result: RouteResult = {
          agent,
          task,
          strategy: 'round-robin',
          timestamp: new Date(),
        }
        collector.record(result, performance.now() - start, 'round-robin')
        return result
      }
      attempts++
    }

    const result: RouteResult = {
      agent: null,
      task,
      strategy: 'round-robin',
      timestamp: new Date(),
      reason: 'no-available-agents',
    }
    collector.record(result, performance.now() - start, 'round-robin')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter((a) => a.id !== agentId)
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  return { route, addAgent, removeAgent, getAgents }
}

// ============================================================================
// Least-Busy Balancer
// ============================================================================

interface LeastBusyBalancer extends LoadBalancer {
  getLoadMetrics(): Record<string, number>
  releaseLoad(agentId: string): void
  setLoad(agentId: string, load: number): void
}

/**
 * Options for least-busy load balancer
 */
interface LeastBusyBalancerOptions {
  /**
   * Optional metrics collector for isolated metrics tracking.
   * If not provided, uses the default global collector.
   */
  metricsCollector?: MetricsCollector
}

/**
 * Create a least-busy load balancer
 *
 * Routes tasks to agents with the lowest current load.
 *
 * @param initialAgents - Initial set of agents to balance across
 * @param options - Optional configuration including metricsCollector
 * @returns A LeastBusyBalancer instance
 */
export function createLeastBusyBalancer(
  initialAgents: AgentInfo[],
  options: LeastBusyBalancerOptions = {}
): LeastBusyBalancer {
  let agents = [...initialAgents]
  const loadTracking = new Map<string, number>()
  let lastRoutedIndex = -1
  const collector = options.metricsCollector ?? defaultMetricsCollector

  // Initialize load tracking
  agents.forEach((a) => loadTracking.set(a.id, a.currentLoad))

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter((a) => {
      if (a.status !== 'available' && a.status !== 'busy') return false
      const load = loadTracking.get(a.id) ?? a.currentLoad
      return load < a.maxLoad
    })
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const available = getAvailableAgents()

    if (available.length === 0) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'least-busy',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'least-busy')
      return result
    }

    // Sort by load percentage
    const sorted = [...available].sort((a, b) => {
      const loadA = (loadTracking.get(a.id) ?? a.currentLoad) / a.maxLoad
      const loadB = (loadTracking.get(b.id) ?? b.currentLoad) / b.maxLoad
      if (loadA === loadB) {
        // Tie-breaking with round-robin behavior
        const indexA = agents.indexOf(a)
        const indexB = agents.indexOf(b)
        const distA = (indexA - lastRoutedIndex + agents.length) % agents.length
        const distB = (indexB - lastRoutedIndex + agents.length) % agents.length
        return distA - distB
      }
      return loadA - loadB
    })

    const selected = safeFirst(sorted)
    if (!selected) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'least-busy',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'least-busy')
      return result
    }
    lastRoutedIndex = agents.indexOf(selected)

    // Increment load
    const currentLoad = loadTracking.get(selected.id) ?? selected.currentLoad
    loadTracking.set(selected.id, currentLoad + 1)

    const result: RouteResult = {
      agent: selected,
      task,
      strategy: 'least-busy',
      timestamp: new Date(),
    }
    collector.record(result, performance.now() - start, 'least-busy')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
    loadTracking.set(agent.id, agent.currentLoad)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter((a) => a.id !== agentId)
    loadTracking.delete(agentId)
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  function getLoadMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {}
    agents.forEach((a) => {
      const load = loadTracking.get(a.id) ?? a.currentLoad
      metrics[a.id] = load / a.maxLoad
    })
    return metrics
  }

  function releaseLoad(agentId: string): void {
    const current = loadTracking.get(agentId)
    if (current !== undefined && current > 0) {
      loadTracking.set(agentId, current - 1)
    }
  }

  function setLoad(agentId: string, load: number): void {
    loadTracking.set(agentId, load)
  }

  return { route, addAgent, removeAgent, getAgents, getLoadMetrics, releaseLoad, setLoad }
}

// ============================================================================
// Capability-Based Router
// ============================================================================

/**
 * Options for capability-based router
 */
interface CapabilityRouterOptions {
  /**
   * Prefer agents with exact skill match over agents with additional skills
   */
  preferExactMatch?: boolean
  /**
   * Optional metrics collector for isolated metrics tracking.
   * If not provided, uses the default global collector.
   */
  metricsCollector?: MetricsCollector
}

interface CapabilityRouter extends LoadBalancer {
  findAgentsWithSkills(skills: string[]): AgentInfo[]
  getSkillCoverage(): Record<string, number>
}

/**
 * Create a capability-based router
 *
 * Routes tasks to agents that have the required skills.
 *
 * @param initialAgents - Initial set of agents to route to
 * @param options - Optional configuration including metricsCollector
 * @returns A CapabilityRouter instance
 */
export function createCapabilityRouter(
  initialAgents: AgentInfo[],
  options: CapabilityRouterOptions = {}
): CapabilityRouter {
  let agents = [...initialAgents]
  const collector = options.metricsCollector ?? defaultMetricsCollector

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter((a) => a.status === 'available' || a.status === 'busy')
  }

  function hasAllSkills(agent: AgentInfo, requiredSkills: string[]): boolean {
    return requiredSkills.every((skill) => agent.skills.includes(skill))
  }

  function calculateMatchScore(agent: AgentInfo, requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1
    const matchingSkills = requiredSkills.filter((s) => agent.skills.includes(s))
    return matchingSkills.length / requiredSkills.length
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const available = getAvailableAgents()

    // Find agents with all required skills
    let candidates = available.filter((a) => hasAllSkills(a, task.requiredSkills))

    if (candidates.length === 0) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'capability',
        timestamp: new Date(),
        reason: 'no-matching-capability',
      }
      collector.record(result, performance.now() - start, 'capability')
      return result
    }

    // Sort by match quality
    if (options.preferExactMatch) {
      // Prefer agents with closest skill count to requirements
      candidates.sort((a, b) => {
        const diffA = Math.abs(a.skills.length - task.requiredSkills.length)
        const diffB = Math.abs(b.skills.length - task.requiredSkills.length)
        return diffA - diffB
      })
    }

    const selected = safeFirst(candidates)
    if (!selected) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'capability',
        timestamp: new Date(),
        reason: 'no-matching-capability',
      }
      collector.record(result, performance.now() - start, 'capability')
      return result
    }
    const matchScore = calculateMatchScore(selected, task.requiredSkills)

    const result: RouteResult = {
      agent: selected,
      task,
      strategy: 'capability',
      timestamp: new Date(),
      matchScore,
    }
    collector.record(result, performance.now() - start, 'capability')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter((a) => a.id !== agentId)
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  function findAgentsWithSkills(skills: string[]): AgentInfo[] {
    return agents.filter((a) => hasAllSkills(a, skills))
  }

  function getSkillCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {}
    agents.forEach((a) => {
      a.skills.forEach((skill) => {
        coverage[skill] = (coverage[skill] || 0) + 1
      })
    })
    return coverage
  }

  return { route, addAgent, removeAgent, getAgents, findAgentsWithSkills, getSkillCoverage }
}

// ============================================================================
// Priority Queue Balancer
// ============================================================================

/**
 * Options for priority queue balancer
 */
interface PriorityQueueOptions {
  /**
   * Enable priority aging to prevent task starvation
   */
  enableAging?: boolean
  /**
   * Priority boost per second when aging is enabled
   */
  agingBoostPerSecond?: number
  /**
   * Maximum wait time before task is promoted to highest priority
   */
  maxWaitTime?: number
  /**
   * Optional metrics collector for isolated metrics tracking.
   * If not provided, uses the default global collector.
   */
  metricsCollector?: MetricsCollector
}

interface PriorityQueueBalancer extends LoadBalancer {
  enqueue(task: TaskRequest): void
  routeNext(): Promise<RouteResult | null>
  queueSize(): number
  clear(): void
  peek(): TaskRequest | null
  getEffectivePriority(taskId: string): number
}

/**
 * Create a priority queue balancer
 *
 * Processes tasks in priority order with optional aging to prevent starvation.
 *
 * @param initialAgents - Initial set of agents to balance across
 * @param options - Optional configuration including metricsCollector
 * @returns A PriorityQueueBalancer instance
 */
export function createPriorityQueueBalancer(
  initialAgents: AgentInfo[],
  options: PriorityQueueOptions = {}
): PriorityQueueBalancer {
  let agents = [...initialAgents]
  const queue: TaskRequest[] = []
  const { enableAging = false, agingBoostPerSecond = 1, maxWaitTime } = options
  const collector = options.metricsCollector ?? defaultMetricsCollector

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter((a) => a.status === 'available' || a.status === 'busy')
  }

  function getEffectivePriority(taskId: string): number {
    const task = queue.find((t) => t.id === taskId)
    if (!task) return 0

    let priority = task.priority

    if (enableAging && task.enqueuedAt) {
      const waitTimeMs = Date.now() - task.enqueuedAt.getTime()
      const waitTimeSeconds = waitTimeMs / 1000
      priority += waitTimeSeconds * agingBoostPerSecond
    }

    if (maxWaitTime && task.enqueuedAt) {
      const waitTimeMs = Date.now() - task.enqueuedAt.getTime()
      if (waitTimeMs >= maxWaitTime) {
        priority = Infinity // Promote to highest priority
      }
    }

    return priority
  }

  function sortQueue(): void {
    queue.sort((a, b) => {
      const priorityA = getEffectivePriority(a.id)
      const priorityB = getEffectivePriority(b.id)
      if (priorityB !== priorityA) {
        return priorityB - priorityA // Higher priority first
      }
      // FIFO for equal priority
      const timeA = a.enqueuedAt?.getTime() ?? 0
      const timeB = b.enqueuedAt?.getTime() ?? 0
      return timeA - timeB
    })
  }

  function enqueue(task: TaskRequest): void {
    if (task.priority < 1 || task.priority > 10) {
      throw new Error('Priority must be between 1 and 10')
    }
    const taskWithTime = { ...task, enqueuedAt: new Date() }
    queue.push(taskWithTime)
    sortQueue()
  }

  async function routeNext(): Promise<RouteResult | null> {
    if (queue.length === 0) return null

    sortQueue()
    const task = queue.shift()
    if (!task) return null
    const start = performance.now()
    const available = getAvailableAgents()

    if (available.length === 0) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'priority-queue',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'priority-queue')
      return result
    }

    // Simple round-robin among available for now
    const agent = safeFirst(available)
    if (!agent) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'priority-queue',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'priority-queue')
      return result
    }

    const result: RouteResult = {
      agent,
      task,
      strategy: 'priority-queue',
      timestamp: new Date(),
    }
    collector.record(result, performance.now() - start, 'priority-queue')
    return result
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const available = getAvailableAgents()

    if (available.length === 0) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'priority-queue',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'priority-queue')
      return result
    }

    const agent = safeFirst(available)
    if (!agent) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'priority-queue',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      collector.record(result, performance.now() - start, 'priority-queue')
      return result
    }
    const result: RouteResult = {
      agent,
      task,
      strategy: 'priority-queue',
      timestamp: new Date(),
    }
    collector.record(result, performance.now() - start, 'priority-queue')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter((a) => a.id !== agentId)
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  function queueSize(): number {
    return queue.length
  }

  function clear(): void {
    queue.length = 0
  }

  function peek(): TaskRequest | null {
    if (queue.length === 0) return null
    sortQueue()
    return queue[0] ?? null
  }

  return {
    route,
    addAgent,
    removeAgent,
    getAgents,
    enqueue,
    routeNext,
    queueSize,
    clear,
    peek,
    getEffectivePriority,
  }
}

// ============================================================================
// Agent Availability Tracker
// ============================================================================

interface AvailabilityTrackerOptions {
  heartbeatTimeout?: number
}

interface StatusChangeEvent {
  agentId: string
  previousStatus: WorkerStatus
  currentStatus: WorkerStatus
  timestamp: Date
}

interface CapacityInfo {
  total: number
  used: number
  available: number
  utilization: number
}

interface AgentAvailabilityTracker {
  getAvailability(agentId: string): AgentAvailability
  updateStatus(agentId: string, status: WorkerStatus): void
  getAvailableAgents(): AgentInfo[]
  heartbeat(agentId: string): void
  checkTimeouts(): void
  onStatusChange(handler: (event: StatusChangeEvent) => void): void
  updateLoad(agentId: string, current: number, max: number): void
  getCapacityUtilization(): Record<string, number>
  getOverallCapacity(): CapacityInfo
}

/**
 * Create an agent availability tracker
 *
 * Tracks agent status, heartbeats, and capacity.
 */
export function createAgentAvailabilityTracker(
  initialAgents: AgentInfo[],
  options: AvailabilityTrackerOptions = {}
): AgentAvailabilityTracker {
  const agents = new Map<string, AgentInfo>()
  const availability = new Map<string, AgentAvailability>()
  const handlers: Array<(event: StatusChangeEvent) => void> = []
  const { heartbeatTimeout = 30000 } = options

  // Initialize
  initialAgents.forEach((a) => {
    agents.set(a.id, a)
    availability.set(a.id, {
      status: a.status,
      lastSeen: new Date(),
      currentLoad: a.currentLoad,
      maxLoad: a.maxLoad,
    })
  })

  function getAvailability(agentId: string): AgentAvailability {
    return (
      availability.get(agentId) ?? {
        status: 'offline',
        lastSeen: new Date(0),
      }
    )
  }

  function updateStatus(agentId: string, status: WorkerStatus): void {
    const current = availability.get(agentId)
    const previousStatus = current?.status ?? 'offline'

    availability.set(agentId, {
      ...current,
      status,
      lastSeen: new Date(),
    })

    const agent = agents.get(agentId)
    if (agent) {
      agent.status = status
    }

    // Emit status change event
    if (previousStatus !== status) {
      const event: StatusChangeEvent = {
        agentId,
        previousStatus,
        currentStatus: status,
        timestamp: new Date(),
      }
      handlers.forEach((h) => h(event))
    }
  }

  function getAvailableAgents(): AgentInfo[] {
    return Array.from(agents.values()).filter((a) => {
      const avail = availability.get(a.id)
      return avail?.status === 'available' || avail?.status === 'busy'
    })
  }

  function heartbeat(agentId: string): void {
    const current = availability.get(agentId)
    if (current) {
      availability.set(agentId, {
        ...current,
        lastSeen: new Date(),
      })
    }
  }

  function checkTimeouts(): void {
    const now = Date.now()
    availability.forEach((avail, agentId) => {
      if (avail.status !== 'offline') {
        const timeSinceLastSeen = now - avail.lastSeen.getTime()
        if (timeSinceLastSeen > heartbeatTimeout) {
          updateStatus(agentId, 'offline')
        }
      }
    })
  }

  function onStatusChange(handler: (event: StatusChangeEvent) => void): void {
    handlers.push(handler)
  }

  function updateLoad(agentId: string, current: number, max: number): void {
    const avail = availability.get(agentId)
    if (avail) {
      availability.set(agentId, {
        ...avail,
        currentLoad: current,
        maxLoad: max,
      })
    }
  }

  function getCapacityUtilization(): Record<string, number> {
    const result: Record<string, number> = {}
    availability.forEach((avail, agentId) => {
      if (avail.currentLoad !== undefined && avail.maxLoad !== undefined && avail.maxLoad > 0) {
        result[agentId] = avail.currentLoad / avail.maxLoad
      }
    })
    return result
  }

  function getOverallCapacity(): CapacityInfo {
    let total = 0
    let used = 0

    availability.forEach((avail, agentId) => {
      const agent = agents.get(agentId)
      if (agent && (avail.status === 'available' || avail.status === 'busy')) {
        total += avail.maxLoad ?? agent.maxLoad
        used += avail.currentLoad ?? agent.currentLoad
      }
    })

    return {
      total,
      used,
      available: total - used,
      utilization: total > 0 ? used / total : 0,
    }
  }

  return {
    getAvailability,
    updateStatus,
    getAvailableAgents,
    heartbeat,
    checkTimeouts,
    onStatusChange,
    updateLoad,
    getCapacityUtilization,
    getOverallCapacity,
  }
}

// ============================================================================
// Routing Rule Engine
// ============================================================================

/**
 * Options for routing rule engine
 */
interface RoutingRuleEngineOptions {
  /**
   * Default strategy to use when no rules match
   */
  defaultStrategy?: 'round-robin' | 'least-busy' | 'capability'
  /**
   * Optional metrics collector for isolated metrics tracking.
   * If not provided, uses the default global collector.
   */
  metricsCollector?: MetricsCollector
}

interface RoutingRuleEngine extends LoadBalancer {
  addRule(rule: RoutingRule): void
  removeRule(name: string): void
  updateRule(name: string, updates: Partial<RoutingRule>): void
  enableRule(name: string): void
  disableRule(name: string): void
  getRules(): RoutingRule[]
}

/**
 * Create a routing rule engine
 *
 * Evaluates routing rules in priority order to determine task routing.
 *
 * @param initialAgents - Initial set of agents to route to
 * @param options - Optional configuration including metricsCollector
 * @returns A RoutingRuleEngine instance
 */
export function createRoutingRuleEngine(
  initialAgents: AgentInfo[],
  options: RoutingRuleEngineOptions = {}
): RoutingRuleEngine {
  let agents = [...initialAgents]
  const rules: RoutingRule[] = []
  const { defaultStrategy = 'round-robin' } = options
  const collector = options.metricsCollector ?? defaultMetricsCollector

  // Create default balancer for fallback
  let defaultBalancer: LoadBalancer

  function getDefaultBalancer(): LoadBalancer {
    if (!defaultBalancer) {
      const balancerOptions = { metricsCollector: collector }
      switch (defaultStrategy) {
        case 'least-busy':
          defaultBalancer = createLeastBusyBalancer(agents, balancerOptions)
          break
        case 'capability':
          defaultBalancer = createCapabilityRouter(agents, balancerOptions)
          break
        default:
          defaultBalancer = createRoundRobinBalancer(agents, balancerOptions)
      }
    }
    return defaultBalancer
  }

  function evaluateCondition(condition: RoutingRuleCondition, task: TaskRequest): boolean {
    if (typeof condition === 'function') {
      return condition(task)
    }

    // Declarative condition evaluation
    if (condition.requiredSkills?.contains) {
      if (!task.requiredSkills.includes(condition.requiredSkills.contains)) {
        return false
      }
    }

    if (condition.priority) {
      if (condition.priority.gte !== undefined && task.priority < condition.priority.gte) {
        return false
      }
      if (condition.priority.lte !== undefined && task.priority > condition.priority.lte) {
        return false
      }
    }

    if (condition.metadata) {
      for (const [key, value] of Object.entries(condition.metadata)) {
        if (task.metadata[key] !== value) {
          return false
        }
      }
    }

    return true
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()

    // Sort rules by priority (descending)
    const sortedRules = [...rules]
      .filter((r) => r.enabled !== false)
      .sort((a, b) => b.priority - a.priority)

    // Evaluate rules
    for (const rule of sortedRules) {
      if (evaluateCondition(rule.condition, task)) {
        const agent = rule.action(task, agents)
        if (agent) {
          const result: RouteResult = {
            agent,
            task,
            strategy: 'custom',
            timestamp: new Date(),
            matchedRule: rule.name,
          }
          collector.record(result, performance.now() - start, 'custom')
          return result
        }
      }
    }

    // Use default strategy as fallback
    const defaultResult = getDefaultBalancer().route(task)
    return {
      ...defaultResult,
      matchedRule: null,
      usedDefault: true,
    }
  }

  function addRule(rule: RoutingRule): void {
    if (!rule.name || rule.name.trim() === '') {
      throw new Error('Rule name is required')
    }
    if (rule.priority < 0) {
      throw new Error('Rule priority must be non-negative')
    }
    rules.push({ ...rule, enabled: rule.enabled ?? true })
  }

  function removeRule(name: string): void {
    const index = rules.findIndex((r) => r.name === name)
    if (index !== -1) {
      rules.splice(index, 1)
    }
  }

  function updateRule(name: string, updates: Partial<RoutingRule>): void {
    const rule = rules.find((r) => r.name === name)
    if (rule) {
      Object.assign(rule, updates)
    }
  }

  function enableRule(name: string): void {
    const rule = rules.find((r) => r.name === name)
    if (rule) {
      rule.enabled = true
    }
  }

  function disableRule(name: string): void {
    const rule = rules.find((r) => r.name === name)
    if (rule) {
      rule.enabled = false
    }
  }

  function getRules(): RoutingRule[] {
    return [...rules]
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
    defaultBalancer = undefined as any // Reset default balancer
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter((a) => a.id !== agentId)
    defaultBalancer = undefined as any // Reset default balancer
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  return {
    route,
    addAgent,
    removeAgent,
    getAgents,
    addRule,
    removeRule,
    updateRule,
    enableRule,
    disableRule,
    getRules,
  }
}

// ============================================================================
// Composite Balancer
// ============================================================================

interface CompositeBalancer extends LoadBalancer {
  // No additional methods for now
}

/**
 * Create a composite load balancer
 *
 * Combines multiple balancing strategies for sophisticated routing decisions.
 *
 * @param initialAgents - Initial set of agents to balance across
 * @param config - Configuration including strategies and optional metricsCollector
 * @returns A CompositeBalancer instance
 */
export function createCompositeBalancer(
  initialAgents: AgentInfo[],
  config: CompositeBalancerConfig
): CompositeBalancer {
  let agents = [...initialAgents]
  const balancers = new Map<BalancerStrategy, LoadBalancer>()
  const collector = config.metricsCollector ?? defaultMetricsCollector

  // Initialize balancers
  function getOrCreateBalancer(strategy: BalancerStrategy): LoadBalancer {
    if (!balancers.has(strategy)) {
      const balancerOptions = { metricsCollector: collector }
      switch (strategy) {
        case 'round-robin':
          balancers.set(strategy, createRoundRobinBalancer(agents, balancerOptions))
          break
        case 'least-busy':
          balancers.set(strategy, createLeastBusyBalancer(agents, balancerOptions))
          break
        case 'capability':
          balancers.set(strategy, createCapabilityRouter(agents, balancerOptions))
          break
        case 'custom':
          // Custom strategies are handled separately
          break
        default:
          balancers.set(strategy, createRoundRobinBalancer(agents, balancerOptions))
      }
    }
    const balancer = balancers.get(strategy)
    if (!balancer) {
      // Fallback to round-robin if strategy not found
      const fallback = createRoundRobinBalancer(agents, { metricsCollector: collector })
      balancers.set(strategy, fallback)
      return fallback
    }
    return balancer
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const strategies: BalancerStrategy[] = []
    const strategyScores: Record<string, number> = {}
    let usedFallback = false

    // Handle weighted strategies
    const weightedStrategies = config.strategies.map((s) => {
      if (typeof s === 'string') {
        return { strategy: s, weight: 1 }
      }
      return s
    })

    // Try each strategy in order
    for (const { strategy, weight } of weightedStrategies) {
      strategies.push(strategy)

      // Handle custom strategies
      if (strategy === 'custom' && config.customStrategies) {
        for (const [name, fn] of Object.entries(config.customStrategies)) {
          const agent = fn(task, agents)
          if (agent) {
            const result: RouteResult = {
              agent,
              task,
              strategy: 'custom',
              timestamp: new Date(),
              strategies,
              strategyScores,
            }
            collector.record(result, performance.now() - start, 'custom')
            return result
          }
        }
        continue
      }

      const balancer = getOrCreateBalancer(strategy)
      const result = balancer.route(task)

      if (result.agent) {
        // Calculate score for weighted strategies
        strategyScores[strategy] = weight

        const finalResult: RouteResult = {
          ...result,
          strategies,
          strategyScores,
          usedFallback,
        }
        collector.record(finalResult, performance.now() - start, strategy)
        return finalResult
      }

      // Handle fallback
      if (config.fallbackBehavior === 'next-strategy') {
        usedFallback = true
        continue
      }
    }

    // No strategy succeeded
    const result: RouteResult = {
      agent: null,
      task,
      strategy: 'custom',
      timestamp: new Date(),
      reason: 'no-strategy-succeeded',
      strategies,
      strategyScores,
      usedFallback,
    }
    collector.record(result, performance.now() - start, 'custom')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
    balancers.forEach((b) => b.addAgent(agent))
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter((a) => a.id !== agentId)
    balancers.forEach((b) => b.removeAgent(agentId))
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  return { route, addAgent, removeAgent, getAgents }
}
