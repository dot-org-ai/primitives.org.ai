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

// ============================================================================
// Global Metrics State
// ============================================================================

let metricsState: RoutingMetrics = {
  totalRouted: 0,
  failedRoutes: 0,
  averageLatencyMs: 0,
  perAgent: {},
  strategyUsage: {},
}

let totalLatency = 0

/**
 * Record a routing event for metrics
 */
function recordRouting(
  result: RouteResult,
  latencyMs: number,
  strategy: BalancerStrategy
): void {
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

/**
 * Collect current routing metrics
 */
export function collectRoutingMetrics(): RoutingMetrics {
  return { ...metricsState }
}

/**
 * Reset all routing metrics
 */
export function resetRoutingMetrics(): void {
  metricsState = {
    totalRouted: 0,
    failedRoutes: 0,
    averageLatencyMs: 0,
    perAgent: {},
    strategyUsage: {},
  }
  totalLatency = 0
}

// ============================================================================
// Round-Robin Balancer
// ============================================================================

/**
 * Create a round-robin load balancer
 *
 * Distributes tasks evenly across all available agents in order.
 */
export function createRoundRobinBalancer(initialAgents: AgentInfo[]): LoadBalancer {
  let agents = [...initialAgents]
  let currentIndex = 0

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter(a => a.status === 'available' || a.status === 'busy')
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
      recordRouting(result, performance.now() - start, 'round-robin')
      return result
    }

    // Find the next available agent starting from current index
    let attempts = 0
    while (attempts < agents.length) {
      const agent = agents[currentIndex % agents.length]!
      currentIndex++

      if (agent.status === 'available' || agent.status === 'busy') {
        const result: RouteResult = {
          agent,
          task,
          strategy: 'round-robin',
          timestamp: new Date(),
        }
        recordRouting(result, performance.now() - start, 'round-robin')
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
    recordRouting(result, performance.now() - start, 'round-robin')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter(a => a.id !== agentId)
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
 * Create a least-busy load balancer
 *
 * Routes tasks to agents with the lowest current load.
 */
export function createLeastBusyBalancer(initialAgents: AgentInfo[]): LeastBusyBalancer {
  let agents = [...initialAgents]
  const loadTracking = new Map<string, number>()
  let lastRoutedIndex = -1

  // Initialize load tracking
  agents.forEach(a => loadTracking.set(a.id, a.currentLoad))

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter(a => {
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
      recordRouting(result, performance.now() - start, 'least-busy')
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

    const selected = sorted[0]!
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
    recordRouting(result, performance.now() - start, 'least-busy')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
    loadTracking.set(agent.id, agent.currentLoad)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter(a => a.id !== agentId)
    loadTracking.delete(agentId)
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  function getLoadMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {}
    agents.forEach(a => {
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

interface CapabilityRouterOptions {
  preferExactMatch?: boolean
}

interface CapabilityRouter extends LoadBalancer {
  findAgentsWithSkills(skills: string[]): AgentInfo[]
  getSkillCoverage(): Record<string, number>
}

/**
 * Create a capability-based router
 *
 * Routes tasks to agents that have the required skills.
 */
export function createCapabilityRouter(
  initialAgents: AgentInfo[],
  options: CapabilityRouterOptions = {}
): CapabilityRouter {
  let agents = [...initialAgents]

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter(a => a.status === 'available' || a.status === 'busy')
  }

  function hasAllSkills(agent: AgentInfo, requiredSkills: string[]): boolean {
    return requiredSkills.every(skill => agent.skills.includes(skill))
  }

  function calculateMatchScore(agent: AgentInfo, requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1
    const matchingSkills = requiredSkills.filter(s => agent.skills.includes(s))
    return matchingSkills.length / requiredSkills.length
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const available = getAvailableAgents()

    // Find agents with all required skills
    let candidates = available.filter(a => hasAllSkills(a, task.requiredSkills))

    if (candidates.length === 0) {
      const result: RouteResult = {
        agent: null,
        task,
        strategy: 'capability',
        timestamp: new Date(),
        reason: 'no-matching-capability',
      }
      recordRouting(result, performance.now() - start, 'capability')
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

    const selected = candidates[0]!
    const matchScore = calculateMatchScore(selected, task.requiredSkills)

    const result: RouteResult = {
      agent: selected,
      task,
      strategy: 'capability',
      timestamp: new Date(),
      matchScore,
    }
    recordRouting(result, performance.now() - start, 'capability')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter(a => a.id !== agentId)
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  function findAgentsWithSkills(skills: string[]): AgentInfo[] {
    return agents.filter(a => hasAllSkills(a, skills))
  }

  function getSkillCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {}
    agents.forEach(a => {
      a.skills.forEach(skill => {
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

interface PriorityQueueOptions {
  enableAging?: boolean
  agingBoostPerSecond?: number
  maxWaitTime?: number
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
 */
export function createPriorityQueueBalancer(
  initialAgents: AgentInfo[],
  options: PriorityQueueOptions = {}
): PriorityQueueBalancer {
  let agents = [...initialAgents]
  const queue: TaskRequest[] = []
  const { enableAging = false, agingBoostPerSecond = 1, maxWaitTime } = options

  function getAvailableAgents(): AgentInfo[] {
    return agents.filter(a => a.status === 'available' || a.status === 'busy')
  }

  function getEffectivePriority(taskId: string): number {
    const task = queue.find(t => t.id === taskId)
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
    const task = queue.shift()!
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
      recordRouting(result, performance.now() - start, 'priority-queue')
      return result
    }

    // Simple round-robin among available for now
    const agent = available[0]!

    const result: RouteResult = {
      agent,
      task,
      strategy: 'priority-queue',
      timestamp: new Date(),
    }
    recordRouting(result, performance.now() - start, 'priority-queue')
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
      recordRouting(result, performance.now() - start, 'priority-queue')
      return result
    }

    const agent = available[0]!
    const result: RouteResult = {
      agent,
      task,
      strategy: 'priority-queue',
      timestamp: new Date(),
    }
    recordRouting(result, performance.now() - start, 'priority-queue')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter(a => a.id !== agentId)
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
  initialAgents.forEach(a => {
    agents.set(a.id, a)
    availability.set(a.id, {
      status: a.status,
      lastSeen: new Date(),
      currentLoad: a.currentLoad,
      maxLoad: a.maxLoad,
    })
  })

  function getAvailability(agentId: string): AgentAvailability {
    return availability.get(agentId) ?? {
      status: 'offline',
      lastSeen: new Date(0),
    }
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
      handlers.forEach(h => h(event))
    }
  }

  function getAvailableAgents(): AgentInfo[] {
    return Array.from(agents.values()).filter(a => {
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

interface RoutingRuleEngineOptions {
  defaultStrategy?: 'round-robin' | 'least-busy' | 'capability'
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
 */
export function createRoutingRuleEngine(
  initialAgents: AgentInfo[],
  options: RoutingRuleEngineOptions = {}
): RoutingRuleEngine {
  let agents = [...initialAgents]
  const rules: RoutingRule[] = []
  const { defaultStrategy = 'round-robin' } = options

  // Create default balancer for fallback
  let defaultBalancer: LoadBalancer

  function getDefaultBalancer(): LoadBalancer {
    if (!defaultBalancer) {
      switch (defaultStrategy) {
        case 'least-busy':
          defaultBalancer = createLeastBusyBalancer(agents)
          break
        case 'capability':
          defaultBalancer = createCapabilityRouter(agents)
          break
        default:
          defaultBalancer = createRoundRobinBalancer(agents)
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
      .filter(r => r.enabled !== false)
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
          recordRouting(result, performance.now() - start, 'custom')
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
    const index = rules.findIndex(r => r.name === name)
    if (index !== -1) {
      rules.splice(index, 1)
    }
  }

  function updateRule(name: string, updates: Partial<RoutingRule>): void {
    const rule = rules.find(r => r.name === name)
    if (rule) {
      Object.assign(rule, updates)
    }
  }

  function enableRule(name: string): void {
    const rule = rules.find(r => r.name === name)
    if (rule) {
      rule.enabled = true
    }
  }

  function disableRule(name: string): void {
    const rule = rules.find(r => r.name === name)
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
    agents = agents.filter(a => a.id !== agentId)
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
 */
export function createCompositeBalancer(
  initialAgents: AgentInfo[],
  config: CompositeBalancerConfig
): CompositeBalancer {
  let agents = [...initialAgents]
  const balancers = new Map<BalancerStrategy, LoadBalancer>()

  // Initialize balancers
  function getOrCreateBalancer(strategy: BalancerStrategy): LoadBalancer {
    if (!balancers.has(strategy)) {
      switch (strategy) {
        case 'round-robin':
          balancers.set(strategy, createRoundRobinBalancer(agents))
          break
        case 'least-busy':
          balancers.set(strategy, createLeastBusyBalancer(agents))
          break
        case 'capability':
          balancers.set(strategy, createCapabilityRouter(agents))
          break
        case 'custom':
          // Custom strategies are handled separately
          break
        default:
          balancers.set(strategy, createRoundRobinBalancer(agents))
      }
    }
    return balancers.get(strategy)!
  }

  function route(task: TaskRequest): RouteResult {
    const start = performance.now()
    const strategies: BalancerStrategy[] = []
    const strategyScores: Record<string, number> = {}
    let usedFallback = false

    // Handle weighted strategies
    const weightedStrategies = config.strategies.map(s => {
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
            recordRouting(result, performance.now() - start, 'custom')
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
        recordRouting(finalResult, performance.now() - start, strategy)
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
    recordRouting(result, performance.now() - start, 'custom')
    return result
  }

  function addAgent(agent: AgentInfo): void {
    agents.push(agent)
    balancers.forEach(b => b.addAgent(agent))
  }

  function removeAgent(agentId: string): void {
    agents = agents.filter(a => a.id !== agentId)
    balancers.forEach(b => b.removeAgent(agentId))
  }

  function getAgents(): AgentInfo[] {
    return [...agents]
  }

  return { route, addAgent, removeAgent, getAgents }
}
