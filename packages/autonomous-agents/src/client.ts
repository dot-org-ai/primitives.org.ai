/**
 * RPC Client for Autonomous Agents
 *
 * Provides a typed RPC client that connects to the deployed
 * autonomous-agents worker using rpc.do for remote procedure calls.
 *
 * @example
 * ```ts
 * import { createAgentClient } from 'autonomous-agents/client'
 *
 * const client = createAgentClient('https://autonomous-agents.workers.dev')
 * const agent = await client.create({ name: 'Research Agent', model: 'claude-sonnet' })
 * await client.setGoal(agent.id, { description: 'Research topic X', priority: 'high' })
 * const plan = await client.plan(agent.id)
 * ```
 *
 * @packageDocumentation
 */

import { RPC } from 'rpc.do'

import type {
  AgentConfig,
  AgentState,
  AgentGoal,
  AgentMemory,
  ActionPlan,
  ActionResult,
  CoordinationPattern,
  CoordinationResult,
} from './worker.js'

// ==================== API Type ====================

/**
 * AgentServiceAPI - Type-safe interface matching AgentServiceCore RPC methods
 *
 * This interface mirrors all public methods on AgentServiceCore so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface AgentServiceAPI {
  // Agent Lifecycle
  create(config: AgentConfig): Promise<AgentState>
  get(agentId: string): Promise<AgentState | null>
  list(options?: { status?: string; limit?: number }): Promise<AgentState[]>
  terminate(agentId: string): Promise<boolean>

  // Goal Management
  setGoal(agentId: string, goal: Omit<AgentGoal, 'id' | 'status'>): Promise<AgentGoal>
  getGoals(agentId: string): Promise<AgentGoal[]>
  updateGoal(agentId: string, goalId: string, updates: Partial<AgentGoal>): Promise<AgentGoal>
  removeGoal(agentId: string, goalId: string): Promise<boolean>

  // Reasoning and Planning
  plan(agentId: string, objective?: string): Promise<ActionPlan>
  getPlan(agentId: string): Promise<ActionPlan | null>
  updatePlan(agentId: string, updates: Partial<ActionPlan>): Promise<ActionPlan>

  // Action Execution
  execute(agentId: string, action: string, params?: Record<string, unknown>): Promise<ActionResult>
  executeStep(agentId: string, stepId: string): Promise<ActionResult>
  executePlan(agentId: string): Promise<ActionResult[]>

  // Memory and Context
  getMemory(agentId: string): Promise<AgentMemory>
  updateMemory(agentId: string, updates: Partial<AgentMemory>): Promise<AgentMemory>
  addToMemory(
    agentId: string,
    type: 'shortTerm' | 'longTerm' | 'context',
    data: unknown
  ): Promise<void>
  clearMemory(agentId: string, type?: 'shortTerm' | 'longTerm' | 'context' | 'all'): Promise<void>

  // Multi-Agent Coordination
  coordinate(pattern: CoordinationPattern): Promise<CoordinationResult>
  broadcast(agentIds: string[], message: string): Promise<void>
  delegate(fromAgentId: string, toAgentId: string, task: string): Promise<ActionResult>
}

// ==================== Client Options ====================

/**
 * Options for creating an agent RPC client
 */
export interface AgentClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client Factory ====================

/** Default URL for the autonomous-agents worker */
const DEFAULT_URL = 'https://autonomous-agents.workers.dev'

/**
 * Create a typed RPC client for the autonomous-agents worker
 *
 * @param url - The URL of the deployed autonomous-agents worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all AgentServiceCore methods
 *
 * @example
 * ```ts
 * import { createAgentClient } from 'autonomous-agents/client'
 *
 * // Connect to production
 * const client = createAgentClient('https://autonomous-agents.workers.dev')
 *
 * // Create an agent
 * const agent = await client.create({
 *   name: 'Research Agent',
 *   model: 'claude-sonnet',
 *   role: 'researcher',
 * })
 *
 * // Set a goal
 * await client.setGoal(agent.id, {
 *   description: 'Research quantum computing advances',
 *   priority: 'high',
 * })
 *
 * // Generate and execute a plan
 * const plan = await client.plan(agent.id)
 * const results = await client.executePlan(agent.id)
 *
 * // Multi-agent coordination
 * const agent2 = await client.create({ name: 'Writer Agent', role: 'writer' })
 * const coordination = await client.coordinate({
 *   type: 'sequential',
 *   agents: [agent.id, agent2.id],
 *   goal: 'Research and write a report on quantum computing',
 * })
 * ```
 */
export function createAgentClient(url: string = DEFAULT_URL, options?: AgentClientOptions) {
  return RPC<AgentServiceAPI>(url, options)
}

/**
 * Default client instance connected to the production autonomous-agents worker
 *
 * @example
 * ```ts
 * import client from 'autonomous-agents/client'
 *
 * const agent = await client.create({ name: 'MyAgent' })
 * ```
 */
const client = createAgentClient()

export default client
