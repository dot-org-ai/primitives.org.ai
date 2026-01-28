/**
 * Types for autonomous-agents
 *
 * Primitives for building and orchestrating autonomous AI agents that operate
 * within a company boundary using the digital-workers interface.
 *
 * ## Type Migration Notes
 *
 * This package uses agent-specific types that are specialized versions of the
 * consolidated types from org.ai/types. The key differences are:
 *
 * - **Role**: Local type uses `tools?: AIFunctionDefinition[]` for executable tools,
 *   while org.ai uses `tools?: string[]` for tool name references.
 * - **TeamMember**: Local type uses `role: Role` (required Role object),
 *   while org.ai uses `role?: string` (optional role ID reference).
 * - **Goal**: Local type uses different status values ('active' | 'completed' | 'blocked' | 'cancelled')
 *   optimized for agent workflows.
 *
 * For new projects that need the canonical, interoperable types, import from 'org.ai/types'.
 * The org.ai types are re-exported with 'Org' prefix for interoperability.
 */

import type { AIFunctionDefinition, AIGenerateOptions, SimpleSchema } from 'ai-functions'

// Re-export consolidated types from org.ai/types for interoperability
// Use these Org-prefixed types when you need compatibility with other packages
export type {
  Role as OrgRole,
  Team as OrgTeam,
  TeamMember as OrgTeamMember,
  Channel as OrgChannel,
  Goal as OrgGoal,
  Goals as OrgGoals,
  GoalPriority as OrgGoalPriority,
  GoalStatus as OrgGoalStatus,
  KPI as OrgKPI,
  OKR as OrgOKR,
  KeyResult as OrgKeyResult,
} from 'org.ai/types'

// Re-export for use in other files
export type { AIFunctionDefinition }

/**
 * Agent execution mode determines how the agent processes tasks
 */
export type AgentMode = 'autonomous' | 'supervised' | 'manual'

/**
 * Agent status during execution
 */
export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'waiting' | 'completed' | 'error'

/**
 * Priority levels for tasks and decisions
 */
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Decision approval status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

/**
 * Role definition for an agent or human worker
 *
 * This is an agent-specific role type that supports executable tool definitions.
 * For interoperability with other packages, see `OrgRole` which uses string-based tool references.
 *
 * @see OrgRole - The canonical org.ai role type with string-based tools
 */
export interface Role {
  /** Unique role identifier */
  id: string
  /** Role name (e.g., "Product Manager", "Software Engineer") */
  name: string
  /** Role description and responsibilities */
  description: string
  /** Skills and capabilities required for this role */
  skills: string[]
  /** Permissions and access levels */
  permissions?: string[]
  /** Tools available to this role (executable function definitions) */
  tools?: AIFunctionDefinition[]
  /** Expected outputs from this role */
  outputs?: string[]
}

/**
 * Team composition and coordination
 *
 * This is an agent-specific team type where members have full Role objects.
 * For interoperability with other packages, see `OrgTeam` which uses string-based role references.
 *
 * @see OrgTeam - The canonical org.ai team type with string-based roles
 */
export interface Team {
  /** Unique team identifier */
  id: string
  /** Team name */
  name: string
  /** Team description and purpose */
  description?: string
  /** Team members (agents and humans) with full Role objects */
  members: TeamMember[]
  /** Team goals */
  goals?: Goal[]
  /** Shared context for the team */
  context?: Record<string, unknown>
  /** Communication channels */
  channels?: CommunicationChannel[]
}

/**
 * Team member representation
 *
 * This is an agent-specific team member type where role is a full Role object.
 * For interoperability with other packages, see `OrgTeamMember` which uses string-based role references.
 *
 * @see OrgTeamMember - The canonical org.ai team member type with string-based roles
 */
export interface TeamMember {
  /** Member ID (agent or human) */
  id: string
  /** Member name */
  name: string
  /** Member role on the team (full Role object with tools and skills) */
  role: Role
  /** Member type */
  type: 'agent' | 'human'
  /** Member status */
  status?: 'active' | 'inactive' | 'away'
  /** Member availability */
  availability?: 'available' | 'busy' | 'offline'
}

/**
 * Communication channel for team collaboration
 */
export interface CommunicationChannel {
  /** Channel identifier */
  id: string
  /** Channel type */
  type: 'slack' | 'email' | 'web' | 'sms' | 'custom'
  /** Channel configuration */
  config: Record<string, unknown>
}

/**
 * Goal definition with measurable outcomes
 *
 * This is an agent-specific goal type optimized for agent workflows.
 * For interoperability with other packages, see `OrgGoal` which has a richer status model.
 *
 * @see OrgGoal - The canonical org.ai goal type with comprehensive status tracking
 */
export interface Goal {
  /** Unique goal identifier */
  id: string
  /** Goal description */
  description: string
  /** Target outcome or metric */
  target: string | number
  /** Current progress */
  progress?: string | number
  /** Goal deadline */
  deadline?: Date
  /** Goal priority */
  priority?: Priority
  /** Goal status (agent workflow states) */
  status?: 'active' | 'completed' | 'blocked' | 'cancelled'
  /** Sub-goals */
  subgoals?: Goal[]
  /** Success criteria */
  successCriteria?: string[]
}

/**
 * Agent configuration and behavior
 */
export interface AgentConfig {
  /** Agent name */
  name: string
  /** Agent description and purpose */
  description?: string
  /** Agent role */
  role: Role
  /** Agent execution mode */
  mode?: AgentMode
  /** Agent goals */
  goals?: Goal[]
  /** Agent tools (functions) */
  tools?: AIFunctionDefinition[]
  /** Agent memory/context */
  context?: Record<string, unknown>
  /** Model to use for agent reasoning */
  model?: string
  /** System prompt for the agent */
  system?: string
  /** Maximum iterations per task */
  maxIterations?: number
  /** Temperature for AI generation */
  temperature?: number
  /** Team the agent belongs to */
  team?: Team
  /** Approval requirements */
  requiresApproval?: boolean
  /** Human supervisor (for supervised mode) */
  supervisor?: string
}

/**
 * Agent instance with methods and state
 */
export interface Agent {
  /** Agent configuration */
  config: AgentConfig
  /** Agent current status */
  status: AgentStatus
  /** Agent state/memory */
  state: Record<string, unknown>

  /** Execute a task */
  do: <TResult = unknown>(task: string, context?: unknown) => Promise<TResult>

  /** Ask a question */
  ask: <TResult = unknown>(question: string, context?: unknown) => Promise<TResult>

  /** Make a decision */
  decide: <T extends string>(options: T[], context?: string) => Promise<T>

  /** Request approval */
  approve: <TResult = unknown>(request: ApprovalRequest) => Promise<ApprovalResult<TResult>>

  /** Generate content */
  generate: (options: AIGenerateOptions) => Promise<unknown>

  /** Type checking/validation */
  is: (value: unknown, type: string | SimpleSchema) => Promise<boolean>

  /** Send notification */
  notify: (message: string, channel?: string) => Promise<void>

  /** Update agent state */
  setState: (key: string, value: unknown) => void

  /** Get agent state */
  getState: <T = unknown>(key: string) => T | undefined

  /** Get agent history */
  getHistory: () => AgentHistoryEntry[]

  /** Reset agent state */
  reset: () => void
}

/**
 * Approval request structure
 */
export interface ApprovalRequest {
  /** Request title/summary */
  title: string
  /** Detailed description */
  description: string
  /** Data to be approved */
  data: unknown
  /** Priority level */
  priority?: Priority
  /** Approver (user ID, email, or role) */
  approver?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Channel for approval request */
  channel?: 'slack' | 'email' | 'web' | 'sms' | 'custom'
  /** Expected response schema */
  responseSchema?: SimpleSchema
}

/**
 * Approval result
 */
export interface ApprovalResult<T = unknown> {
  /** Approval status */
  status: ApprovalStatus
  /** Response data */
  response?: T
  /** Who approved/rejected */
  approver?: string
  /** When the decision was made */
  timestamp?: Date
  /** Optional notes */
  notes?: string
}

/**
 * Agent history entry
 */
export interface AgentHistoryEntry {
  /** Timestamp */
  timestamp: Date
  /** Action type */
  type: 'task' | 'question' | 'decision' | 'approval' | 'notification' | 'error'
  /** Action description */
  action: string
  /** Input data */
  input?: unknown
  /** Output result */
  output?: unknown
  /** Error if any */
  error?: string
  /** Duration in milliseconds */
  duration?: number
}

/**
 * Key Performance Indicator
 *
 * This is an agent-specific KPI type with optional fields.
 * For interoperability with other packages, see `OrgKPI` which has required unit and target fields.
 *
 * @see OrgKPI - The canonical org.ai KPI type with stricter requirements
 */
export interface KPI {
  /** KPI identifier */
  id: string
  /** KPI name */
  name: string
  /** KPI description */
  description?: string
  /** Current value */
  value: number | string
  /** Target value */
  target?: number | string
  /** Unit of measurement */
  unit?: string
  /** Measurement frequency */
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable'
  /** Historical data */
  history?: Array<{ timestamp: Date; value: number | string }>
}

/**
 * Objectives and Key Results
 *
 * This is an agent-specific OKR type with required id field.
 * For interoperability with other packages, see `OrgOKR` which has optional id.
 *
 * @see OrgOKR - The canonical org.ai OKR type
 */
export interface OKR {
  /** OKR identifier */
  id: string
  /** Objective statement */
  objective: string
  /** Objective description */
  description?: string
  /** Key results */
  keyResults: KeyResult[]
  /** Time period */
  period?: string
  /** Owner (agent, team, or person) */
  owner?: string
  /** Status */
  status?: 'active' | 'completed' | 'at-risk' | 'cancelled'
  /** Overall progress (0-100) */
  progress?: number
}

/**
 * Key Result within an OKR
 *
 * This is an agent-specific KeyResult type with required id and simplified value fields.
 * For interoperability with other packages, see `OrgKeyResult` which has more flexible value handling.
 *
 * @see OrgKeyResult - The canonical org.ai KeyResult type with startValue/targetValue/currentValue
 */
export interface KeyResult {
  /** Key result identifier */
  id: string
  /** Key result description */
  description: string
  /** Current value */
  current: number | string
  /** Target value */
  target: number | string
  /** Unit of measurement */
  unit?: string
  /** Progress (0-100) */
  progress?: number
  /** Status */
  status?: 'on-track' | 'at-risk' | 'off-track' | 'completed'
}

/**
 * Goals configuration
 */
export interface GoalsConfig {
  /** Goals list */
  goals: Goal[]
  /** Strategy or context */
  strategy?: string
  /** Time horizon */
  timeHorizon?: string
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Message to send */
  message: string
  /** Notification channel */
  channel?: 'slack' | 'email' | 'web' | 'sms' | 'custom'
  /** Recipients */
  recipients?: string[]
  /** Priority */
  priority?: Priority
  /** Additional data */
  data?: Record<string, unknown>
}
