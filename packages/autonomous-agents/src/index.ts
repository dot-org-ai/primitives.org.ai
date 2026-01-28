/**
 * autonomous-agents - Primitives for building and orchestrating autonomous AI agents
 *
 * This package provides primitives for creating autonomous AI agents that can:
 * - Execute tasks and make decisions
 * - Work in teams with other agents and humans
 * - Track goals and metrics (KPIs, OKRs)
 * - Request approvals and human oversight
 * - Operate within defined roles and responsibilities
 *
 * @example
 * ```ts
 * import { Agent, Role, Team, Goals } from 'autonomous-agents'
 *
 * // Create a role
 * const productManager = Role({
 *   name: 'Product Manager',
 *   description: 'Manages product strategy and roadmap',
 *   skills: ['product strategy', 'user research', 'roadmap planning'],
 * })
 *
 * // Create an agent
 * const agent = Agent({
 *   name: 'ProductAgent',
 *   role: productManager,
 *   mode: 'autonomous',
 *   goals: [
 *     { id: 'g1', description: 'Define Q1 roadmap', target: '100%' }
 *   ],
 * })
 *
 * // Execute tasks
 * const result = await agent.do('Create product brief for feature X')
 *
 * // Make decisions
 * const choice = await agent.decide(['A', 'B', 'C'], 'Which feature to prioritize?')
 *
 * // Request approval
 * const approval = await agent.approve({
 *   title: 'Budget Request',
 *   description: 'Request $50k for research',
 *   data: { amount: 50000 },
 * })
 * ```
 *
 * @packageDocumentation
 */

// Core types
export type {
  Agent as AgentType,
  AgentConfig,
  AgentMode,
  AgentStatus,
  AgentHistoryEntry,
  Role as RoleType,
  Team as TeamType,
  TeamMember,
  Goal,
  GoalsConfig,
  KPI,
  OKR,
  KeyResult,
  Priority,
  ApprovalRequest,
  ApprovalResult,
  ApprovalStatus,
  NotificationOptions,
  CommunicationChannel,
} from './types.js'

// Agent creation and management
export { Agent } from './agent.js'

// Role definitions
export {
  Role,
  Roles,
  hasPermission,
  hasSkill,
  getPermissions,
  getSkills,
  mergeRoles,
} from './role.js'

// Team collaboration
export {
  Team,
  type TeamInstance,
  createTeamMember,
  teamMemberFromAgent,
  calculateTeamCapacity,
  getTeamSkills,
  teamHasSkill,
  findBestMemberForTask,
} from './team.js'

// Goals and objectives
export {
  Goals,
  type GoalsInstance,
  createGoal,
  createGoalWithSubgoals,
  isGoalOverdue,
  getOverdueGoals,
  getGoalsDueSoon,
  getGoalsByStatus,
  getTimeRemaining,
} from './goals.js'

// Metrics and performance tracking
export {
  kpi,
  kpis,
  okr,
  okrs,
  type KPIInstance,
  type KPIsCollection,
  type OKRInstance,
  type OKRsCollection,
  createKeyResult,
  updateKeyResultStatus,
} from './metrics.js'
