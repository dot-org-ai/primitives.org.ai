/**
 * Business Types
 *
 * Types for organizational entities and actors:
 * Business, Agent, Human.
 *
 * @module business
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Business - Organization
// =============================================================================

/**
 * Business lifecycle stage.
 */
export type BusinessStage = 'ideation' | 'startup' | 'growth' | 'scaling' | 'mature' | 'acquired' | 'closed'

/**
 * Business type.
 */
export type BusinessType = 'startup' | 'smb' | 'enterprise' | 'agency' | 'nonprofit' | 'government' | 'individual'

/**
 * Organization that creates and delivers value.
 *
 * Businesses are the top-level organizational entities
 * that own products, services, and employ people and agents.
 *
 * @example
 * ```ts
 * const acmeCorp: Business = {
 *   id: 'biz_acme',
 *   name: 'Acme Corporation',
 *   type: 'startup',
 *   stage: 'growth',
 *   description: 'Building the future of widgets',
 *   legalName: 'Acme Corp, Inc.',
 *   website: 'https://acme.example.com',
 *   industry: 'Technology',
 *   founded: new Date('2020-01-15'),
 *   employees: { count: 50, range: '11-50' },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Business {
  /** Unique identifier */
  id: string

  /** Business name */
  name: string

  /** Business type */
  type: BusinessType

  /** Lifecycle stage */
  stage: BusinessStage

  /** Human-readable description */
  description?: string

  /** Legal entity name */
  legalName?: string

  /** Primary website */
  website?: string

  /** Primary industry */
  industry?: string

  /** Date founded */
  founded?: Date

  /** Headquarters location */
  headquarters?: {
    address?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  }

  /** Employee information */
  employees?: {
    count?: number
    range?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5000+'
  }

  /** Revenue information */
  revenue?: {
    amount?: number
    currency?: string
    range?: 'pre-revenue' | '<1M' | '1-10M' | '10-50M' | '50-100M' | '100M+'
  }

  /** Funding information */
  funding?: {
    total?: number
    currency?: string
    stage?: 'bootstrapped' | 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c+' | 'public'
    lastRound?: Date
  }

  /** Contact information */
  contact?: {
    email?: string
    phone?: string
    support?: string
  }

  /** Social profiles */
  social?: {
    linkedin?: string
    twitter?: string
    github?: string
  }

  /** Domain URL (for domain context) */
  domainUrl?: string

  /** Tax/registration IDs */
  identifiers?: {
    ein?: string
    vatId?: string
    registrationNumber?: string
  }

  /** Logo URL */
  logoUrl?: string

  /** Owner/admin user ID */
  ownerId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BusinessInput = Input<Business>
export type BusinessOutput = Output<Business>

// =============================================================================
// Agent - Autonomous AI Actor
// =============================================================================

/**
 * Agent status.
 */
export type AgentStatus = 'idle' | 'working' | 'paused' | 'error' | 'offline'

/**
 * Agent type/role.
 */
export type AgentRole = 'assistant' | 'specialist' | 'executor' | 'monitor' | 'coordinator' | 'custom'

/**
 * Autonomous AI actor that performs tasks.
 *
 * Agents are AI-powered workers that can execute
 * functions, use tools, and operate workflows
 * autonomously or semi-autonomously.
 *
 * @example
 * ```ts
 * const salesAgent: Agent = {
 *   id: 'agent_sales',
 *   name: 'Sales Assistant',
 *   role: 'assistant',
 *   status: 'idle',
 *   description: 'Helps with lead qualification and follow-up',
 *   model: 'claude-3-sonnet',
 *   capabilities: ['email', 'crm', 'calendar'],
 *   tools: ['send_email', 'create_task', 'schedule_meeting'],
 *   systemPrompt: 'You are a helpful sales assistant...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Agent {
  /** Unique identifier */
  id: string

  /** Agent name */
  name: string

  /** Agent role */
  role: AgentRole

  /** Current status */
  status: AgentStatus

  /** Human-readable description */
  description?: string

  /** AI model to use */
  model?: string

  /** System prompt/instructions */
  systemPrompt?: string

  /** High-level capabilities */
  capabilities?: string[]

  /** Available tools (function names) */
  tools?: string[]

  /** Available workflows */
  workflows?: string[]

  /** Maximum concurrent tasks */
  maxConcurrency?: number

  /** Memory/context configuration */
  memory?: {
    type?: 'none' | 'short-term' | 'long-term' | 'persistent'
    maxTokens?: number
    retention?: string
  }

  /** Execution limits */
  limits?: {
    maxIterations?: number
    maxTokensPerTask?: number
    timeout?: number
  }

  /** Current task ID (if working) */
  currentTaskId?: string

  /** Tasks completed count */
  tasksCompleted?: number

  /** Error rate (0-1) */
  errorRate?: number

  /** Average task duration (ms) */
  avgTaskDuration?: number

  /** Owner business/user ID */
  ownerId?: string

  /** Avatar/icon URL */
  avatarUrl?: string

  /** Webhook URL for notifications */
  webhookUrl?: string

  /** Custom configuration */
  config?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AgentInput = Input<Agent>
export type AgentOutput = Output<Agent>

// =============================================================================
// Human - Person
// =============================================================================

/**
 * Human status.
 */
export type HumanStatus = 'active' | 'inactive' | 'pending' | 'suspended'

/**
 * Human role.
 */
export type HumanRole = 'owner' | 'admin' | 'member' | 'guest' | 'viewer'

/**
 * Person who interacts with the system.
 *
 * Humans represent real people who use, operate,
 * or interact with the system. They have roles,
 * permissions, and can own resources.
 *
 * @example
 * ```ts
 * const johnDoe: Human = {
 *   id: 'user_john',
 *   email: 'john@example.com',
 *   name: 'John Doe',
 *   status: 'active',
 *   role: 'admin',
 *   title: 'Head of Sales',
 *   department: 'Sales',
 *   permissions: ['read', 'write', 'admin'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Human {
  /** Unique identifier */
  id: string

  /** Email address */
  email: string

  /** Display name */
  name?: string

  /** First name */
  firstName?: string

  /** Last name */
  lastName?: string

  /** Current status */
  status: HumanStatus

  /** Primary role */
  role: HumanRole

  /** Job title */
  title?: string

  /** Department */
  department?: string

  /** Phone number */
  phone?: string

  /** Timezone */
  timezone?: string

  /** Locale/language */
  locale?: string

  /** Avatar URL */
  avatarUrl?: string

  /** Permissions */
  permissions?: string[]

  /** Team/group IDs */
  teamIds?: string[]

  /** Manager ID */
  managerId?: string

  /** Last active timestamp */
  lastActiveAt?: Date

  /** Last login timestamp */
  lastLoginAt?: Date

  /** Authentication provider */
  authProvider?: 'email' | 'google' | 'github' | 'microsoft' | 'saml' | 'oidc'

  /** External provider ID */
  externalId?: string

  /** Notification preferences */
  notifications?: {
    email?: boolean
    push?: boolean
    sms?: boolean
    slack?: boolean
  }

  /** Working hours */
  workingHours?: {
    timezone?: string
    schedule?: Record<string, { start: string; end: string }>
  }

  /** Skills/expertise */
  skills?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Business ID this human belongs to */
  businessId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type HumanInput = Input<Human>
export type HumanOutput = Output<Human>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface BusinessActions extends CRUDResource<Business, BusinessInput> {
  /** Get products owned by business */
  getProducts: Action<{ id: string } & ListParams, PaginatedResult<unknown>>

  /** Get services offered by business */
  getServices: Action<{ id: string } & ListParams, PaginatedResult<unknown>>

  /** Get team members */
  getMembers: Action<{ id: string } & ListParams, PaginatedResult<Human>>

  /** Get agents owned by business */
  getAgents: Action<{ id: string } & ListParams, PaginatedResult<Agent>>

  /** Add team member */
  addMember: Action<{ id: string; userId: string; role?: HumanRole }, Human>

  /** Remove team member */
  removeMember: Action<{ id: string; userId: string }, void>

  /** Update member role */
  updateMemberRole: Action<{ id: string; userId: string; role: HumanRole }, Human>

  /** Get analytics/metrics */
  getAnalytics: Action<{ id: string; from?: Date; to?: Date }, BusinessAnalytics>
}

export interface AgentActions extends CRUDResource<Agent, AgentInput> {
  /** Start the agent */
  start: Action<{ id: string }, Agent>

  /** Stop the agent */
  stop: Action<{ id: string }, Agent>

  /** Pause the agent */
  pause: Action<{ id: string }, Agent>

  /** Resume the agent */
  resume: Action<{ id: string }, Agent>

  /** Assign a task to the agent */
  assignTask: Action<{ id: string; taskId: string; input?: unknown }, { assignmentId: string }>

  /** Get agent's current task */
  getCurrentTask: Action<{ id: string }, AgentTask | null>

  /** Get task history */
  getTaskHistory: Action<{ id: string } & ListParams, PaginatedResult<AgentTask>>

  /** Update agent configuration */
  configure: Action<{ id: string; config: Partial<Agent> }, Agent>

  /** Get performance metrics */
  getMetrics: Action<{ id: string; from?: Date; to?: Date }, AgentMetrics>

  /** Chat with the agent */
  chat: Action<{ id: string; message: string; context?: unknown }, AgentChatResponse>
}

export interface HumanActions extends CRUDResource<Human, HumanInput> {
  /** Invite a new user */
  invite: Action<{ email: string; role?: HumanRole; teamIds?: string[] }, Human>

  /** Resend invitation */
  resendInvite: Action<{ id: string }, { sent: boolean }>

  /** Activate user */
  activate: Action<{ id: string }, Human>

  /** Deactivate user */
  deactivate: Action<{ id: string }, Human>

  /** Suspend user */
  suspend: Action<{ id: string; reason?: string }, Human>

  /** Update role */
  updateRole: Action<{ id: string; role: HumanRole }, Human>

  /** Update permissions */
  updatePermissions: Action<{ id: string; permissions: string[] }, Human>

  /** Add to team */
  addToTeam: Action<{ id: string; teamId: string }, Human>

  /** Remove from team */
  removeFromTeam: Action<{ id: string; teamId: string }, Human>

  /** Get assigned tasks */
  getTasks: Action<{ id: string } & ListParams, PaginatedResult<unknown>>

  /** Get activity log */
  getActivity: Action<{ id: string } & ListParams, PaginatedResult<ActivityLogEntry>>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface BusinessAnalytics {
  businessId: string
  period: { from: Date; to: Date }
  revenue?: {
    total: number
    growth: number
    byProduct?: Record<string, number>
  }
  customers?: {
    total: number
    new: number
    churned: number
  }
  employees?: {
    total: number
    hired: number
    departed: number
  }
  agents?: {
    total: number
    tasksCompleted: number
    successRate: number
  }
}

export interface AgentTask {
  id: string
  agentId: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  input?: unknown
  output?: unknown
  startedAt?: Date
  completedAt?: Date
  error?: string
  iterations?: number
  tokensUsed?: number
}

export interface AgentMetrics {
  agentId: string
  period: { from: Date; to: Date }
  tasksCompleted: number
  tasksFailed: number
  avgDuration: number
  avgIterations: number
  tokensUsed: number
  errorRate: number
  uptime: number
}

export interface AgentChatResponse {
  message: string
  thinking?: string
  toolCalls?: Array<{
    name: string
    arguments: unknown
    result?: unknown
  }>
  metadata?: Record<string, unknown>
}

export interface ActivityLogEntry {
  id: string
  userId: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, unknown>
  ip?: string
  userAgent?: string
  timestamp: Date
}

// =============================================================================
// Events
// =============================================================================

export interface BusinessEvents {
  created: BaseEvent<'business.created', Business>
  updated: BaseEvent<'business.updated', Business>
  deleted: BaseEvent<'business.deleted', { id: string }>
  member_added: BaseEvent<'business.member_added', { businessId: string; userId: string; role: string }>
  member_removed: BaseEvent<'business.member_removed', { businessId: string; userId: string }>
  member_role_changed: BaseEvent<'business.member_role_changed', { businessId: string; userId: string; oldRole: string; newRole: string }>
  stage_changed: BaseEvent<'business.stage_changed', { businessId: string; oldStage: string; newStage: string }>
}

export interface AgentEvents {
  created: BaseEvent<'agent.created', Agent>
  updated: BaseEvent<'agent.updated', Agent>
  deleted: BaseEvent<'agent.deleted', { id: string }>
  started: BaseEvent<'agent.started', Agent>
  stopped: BaseEvent<'agent.stopped', Agent>
  paused: BaseEvent<'agent.paused', Agent>
  resumed: BaseEvent<'agent.resumed', Agent>
  task_assigned: BaseEvent<'agent.task_assigned', { agentId: string; taskId: string }>
  task_completed: BaseEvent<'agent.task_completed', { agentId: string; taskId: string; output?: unknown }>
  task_failed: BaseEvent<'agent.task_failed', { agentId: string; taskId: string; error: string }>
  error: BaseEvent<'agent.error', { agentId: string; error: string }>
  message: BaseEvent<'agent.message', { agentId: string; message: string; type: 'info' | 'thinking' | 'tool_call' | 'result' }>
}

export interface HumanEvents {
  created: BaseEvent<'human.created', Human>
  updated: BaseEvent<'human.updated', Human>
  deleted: BaseEvent<'human.deleted', { id: string }>
  invited: BaseEvent<'human.invited', { email: string; invitedBy: string }>
  activated: BaseEvent<'human.activated', Human>
  deactivated: BaseEvent<'human.deactivated', Human>
  suspended: BaseEvent<'human.suspended', { id: string; reason?: string }>
  role_changed: BaseEvent<'human.role_changed', { id: string; oldRole: string; newRole: string }>
  logged_in: BaseEvent<'human.logged_in', { id: string; provider: string; ip?: string }>
  logged_out: BaseEvent<'human.logged_out', { id: string }>
  team_joined: BaseEvent<'human.team_joined', { userId: string; teamId: string }>
  team_left: BaseEvent<'human.team_left', { userId: string; teamId: string }>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface BusinessResource extends BusinessActions {
  on: <K extends keyof BusinessEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BusinessEvents[K], TProxy>
  ) => () => void
}

export interface AgentResource extends AgentActions {
  on: <K extends keyof AgentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AgentEvents[K], TProxy>
  ) => () => void
}

export interface HumanResource extends HumanActions {
  on: <K extends keyof HumanEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<HumanEvents[K], TProxy>
  ) => () => void
}
