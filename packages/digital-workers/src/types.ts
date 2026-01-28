/**
 * Type definitions for digital-workers
 *
 * Digital workers (Agents and Humans) communicate through Actions that integrate
 * with the ai-workflows system. Worker actions (notify, ask, approve, decide)
 * are durable workflow actions with Actor/Object semantics.
 *
 * ## Key Concepts
 *
 * - **Worker**: Common interface for Agent and Human
 * - **Contacts**: How a worker can be reached (email, slack, phone, etc.)
 * - **Action**: Durable workflow action (notify, ask, approve, decide)
 * - **Team**: Group of workers with shared contacts
 * - **CapabilityTier**: Agent capability level (code, generative, agentic, human)
 *
 * @packageDocumentation
 */

import type { SimpleSchema } from 'ai-functions'
import type { CapabilityTier, CapabilityProfile } from './capability-tiers.js'

// Import consolidated types from org.ai
import type { Role, Team, Goal, Goals, KPI, OKR, TeamMember, KeyResult } from 'org.ai'

// Re-export org.ai types for convenience
export type { Role, Team, Goal, Goals, KPI, OKR, TeamMember, KeyResult }

// ============================================================================
// Worker Types
// ============================================================================

/**
 * Worker type - either an AI agent or a human
 */
export type WorkerType = 'agent' | 'human'

/**
 * Worker status
 */
export type WorkerStatus =
  | 'available' // Ready to accept work
  | 'busy' // Currently working
  | 'away' // Not available (break, offline)
  | 'offline' // Disconnected

// ============================================================================
// Contact Channel Types
// ============================================================================

/**
 * Contact channel names - how workers can be reached
 */
export type ContactChannel =
  | 'email' // Email communication
  | 'slack' // Slack workspace
  | 'teams' // Microsoft Teams
  | 'discord' // Discord server
  | 'phone' // Voice calls
  | 'sms' // SMS text messages
  | 'whatsapp' // WhatsApp messaging
  | 'telegram' // Telegram messaging
  | 'web' // Web UI/dashboard
  | 'api' // Programmatic API
  | 'webhook' // Webhook callbacks

/**
 * Email contact - simple string or config object
 */
export interface EmailContact {
  address: string
  name?: string
  verified?: boolean
}

/**
 * Slack contact - mention, channel, or config
 */
export interface SlackContact {
  workspace?: string
  user?: string
  channel?: string
  botToken?: string
}

/**
 * Teams contact
 */
export interface TeamsContact {
  tenant?: string
  user?: string
  team?: string
  channel?: string
}

/**
 * Discord contact
 */
export interface DiscordContact {
  server?: string
  user?: string
  channel?: string
}

/**
 * Phone contact
 */
export interface PhoneContact {
  number: string
  country?: string
  verified?: boolean
  voice?: string
  language?: string
}

/**
 * SMS contact
 */
export interface SmsContact {
  number: string
  verified?: boolean
}

/**
 * WhatsApp contact
 */
export interface WhatsAppContact {
  number: string
  verified?: boolean
}

/**
 * Telegram contact
 */
export interface TelegramContact {
  user?: string
  chat?: string
}

/**
 * Web UI contact
 */
export interface WebContact {
  url?: string
  userId?: string
  pushEnabled?: boolean
}

/**
 * API contact (for agents)
 */
export interface ApiContact {
  endpoint: string
  auth?: 'bearer' | 'api-key' | 'oauth' | 'none'
  version?: string
}

/**
 * Webhook contact
 */
export interface WebhookContact {
  url: string
  secret?: string
  events?: string[]
}

/**
 * Contacts - how a worker can be reached
 *
 * Each channel can be a simple string or a config object.
 *
 * @example
 * ```ts
 * contacts: {
 *   email: 'alice@company.com',
 *   slack: { workspace: 'acme', user: 'U123' },
 *   phone: '+1-555-1234',
 * }
 * ```
 */
export interface Contacts {
  email?: string | EmailContact
  slack?: string | SlackContact
  teams?: string | TeamsContact
  discord?: string | DiscordContact
  phone?: string | PhoneContact
  sms?: string | SmsContact
  whatsapp?: string | WhatsAppContact
  telegram?: string | TelegramContact
  web?: string | WebContact
  api?: string | ApiContact
  webhook?: string | WebhookContact
}

/**
 * Contact preferences for routing
 */
export interface ContactPreferences {
  primary?: ContactChannel
  urgent?: ContactChannel
  fallback?: ContactChannel[]
  quietHours?: {
    start: string
    end: string
    timezone?: string
  }
}

// ============================================================================
// Core Worker Interface
// ============================================================================

/**
 * Worker - common interface for Agent and Human
 *
 * Workers are execution entities that can perform tasks and be reached
 * through their configured contact channels.
 *
 * @example
 * ```ts
 * const alice: Worker = {
 *   id: 'user_alice',
 *   name: 'Alice',
 *   type: 'human',
 *   status: 'available',
 *   contacts: {
 *     email: 'alice@company.com',
 *     slack: { workspace: 'acme', user: 'U123' },
 *     phone: '+1-555-1234',
 *   },
 * }
 * ```
 */
export interface Worker {
  id: string
  name: string
  type: WorkerType
  status: WorkerStatus
  contacts: Contacts
  preferences?: ContactPreferences
  role?: WorkerRole
  teams?: string[]
  skills?: string[]
  tools?: string[]
  /** Capability tier (code, generative, agentic, human) */
  capabilityTier?: CapabilityTier
  /** Full capability profile for detailed configuration */
  capabilityProfile?: CapabilityProfile
  metadata?: Record<string, unknown>
}

/**
 * Worker reference - lightweight reference
 */
export interface WorkerRef {
  id: string
  type?: WorkerType
  name?: string
  role?: string
  /** Capability tier for routing decisions */
  capabilityTier?: CapabilityTier
}

// ============================================================================
// Team Interface
// ============================================================================

/**
 * WorkerTeam - group of workers with shared contacts
 *
 * This is the digital-workers team interface that includes
 * worker-specific contact channels. For the base Team type,
 * use Team from org.ai.
 *
 * @example
 * ```ts
 * const engineering: WorkerTeam = {
 *   id: 'team_eng',
 *   name: 'Engineering',
 *   members: [alice, bob, deployBot],
 *   contacts: {
 *     slack: '#engineering',
 *     email: 'eng@company.com',
 *   },
 * }
 * ```
 */
export interface WorkerTeam {
  /** Team identifier */
  id: string
  /** Team name */
  name: string
  /** Team description */
  description?: string
  /** Team members as WorkerRefs */
  members: WorkerRef[]
  /** Worker-specific contact channels */
  contacts: Contacts
  /** Team lead as WorkerRef */
  lead?: WorkerRef
  /** Team goals */
  goals?: string[]
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// ============================================================================
// Action Types - Workflow Integration
// ============================================================================

/**
 * Worker action types
 *
 * These are the actions that can be performed on/by workers.
 * They integrate with ai-workflows as durable actions.
 */
export type WorkerAction = 'notify' | 'ask' | 'approve' | 'decide' | 'do'

/**
 * Base action data - integrates with ai-workflows ActionData
 *
 * Every worker action has:
 * - actor: Who is performing/initiating the action
 * - object: Who/what is being acted upon
 * - action: The action type
 * - via: Channel(s) to use
 */
export interface WorkerActionData {
  /** Who is performing/initiating the action */
  actor: WorkerRef | string
  /** Who/what is being acted upon */
  object: Worker | Team | WorkerRef | string
  /** The action being performed */
  action: WorkerAction
  /** Channel(s) to use */
  via?: ContactChannel | ContactChannel[]
  /** Action status */
  status?: 'pending' | 'active' | 'completed' | 'failed'
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Notify action data
 *
 * @example
 * ```ts
 * await $.do('Worker.notify', {
 *   actor: system,
 *   object: alice,
 *   message: 'Deployment complete',
 *   via: 'slack',
 * })
 * ```
 */
export interface NotifyActionData extends WorkerActionData {
  action: 'notify'
  message: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

/**
 * Ask action data
 *
 * @example
 * ```ts
 * const answer = await $.do('Worker.ask', {
 *   actor: system,
 *   object: alice,
 *   question: 'What is the priority?',
 *   via: 'slack',
 *   schema: { priority: 'low | normal | high' },
 * })
 * ```
 */
export interface AskActionData extends WorkerActionData {
  action: 'ask'
  question: string
  schema?: SimpleSchema
  timeout?: number
}

/**
 * Approve action data
 *
 * @example
 * ```ts
 * const result = await $.do('Worker.approve', {
 *   actor: manager,
 *   object: expense,
 *   request: 'Expense: $500 for AWS',
 *   via: 'slack',
 * })
 * ```
 */
export interface ApproveActionData extends WorkerActionData {
  action: 'approve'
  request: string
  context?: Record<string, unknown>
  timeout?: number
  escalate?: boolean
}

/**
 * Decide action data
 *
 * @example
 * ```ts
 * const decision = await $.do('Worker.decide', {
 *   actor: alice,
 *   object: 'technology choice',
 *   options: ['React', 'Vue', 'Svelte'],
 *   criteria: ['DX', 'Performance', 'Ecosystem'],
 * })
 * ```
 */
export interface DecideActionData extends WorkerActionData {
  action: 'decide'
  options: unknown[]
  context?: string | Record<string, unknown>
  criteria?: string[]
}

/**
 * Do action data - execute a task
 *
 * @example
 * ```ts
 * const result = await $.do('Worker.do', {
 *   actor: deployBot,
 *   object: 'production',
 *   instruction: 'Deploy v2.1.0',
 * })
 * ```
 */
export interface DoActionData extends WorkerActionData {
  action: 'do'
  instruction: string
  timeout?: number
  maxRetries?: number
}

// ============================================================================
// Action Results
// ============================================================================

/**
 * Notify result
 */
export interface NotifyResult {
  sent: boolean
  via: ContactChannel[]
  recipients?: WorkerRef[]
  sentAt?: Date
  messageId?: string
  delivery?: Array<{
    channel: ContactChannel
    status: 'sent' | 'delivered' | 'failed'
    error?: string
  }>
}

/**
 * Ask result
 */
export interface AskResult<T = string> {
  answer: T
  answeredBy?: WorkerRef
  answeredAt?: Date
  via?: ContactChannel
}

/**
 * Approve result
 */
export interface ApprovalResult {
  approved: boolean
  approvedBy?: WorkerRef
  approvedAt?: Date
  notes?: string
  via?: ContactChannel
}

/**
 * Decide result
 */
export interface DecideResult<T = string> {
  choice: T
  reasoning: string
  confidence: number
  alternatives?: Array<{ option: T; score: number }>
}

/**
 * Do result
 */
export interface DoResult<T = unknown> {
  result: T
  success: boolean
  error?: string
  duration?: number
  steps?: Array<{
    action: string
    result: unknown
    timestamp: Date
  }>
}

// ============================================================================
// Worker Verbs - Following ai-database Verb pattern
// ============================================================================

/**
 * Worker verbs following the ai-database conjugation pattern
 *
 * Each verb has:
 * - action: Base form (notify, ask, approve, decide)
 * - actor: Who does it (notifier, asker, approver, decider)
 * - activity: Gerund (notifying, asking, approving, deciding)
 * - reverse: Past forms (notifiedAt, notifiedBy, askedAt, etc.)
 */
export const WorkerVerbs = {
  notify: {
    action: 'notify',
    actor: 'notifier',
    act: 'notifies',
    activity: 'notifying',
    result: 'notification',
    reverse: { at: 'notifiedAt', by: 'notifiedBy', via: 'notifiedVia' },
  },
  ask: {
    action: 'ask',
    actor: 'asker',
    act: 'asks',
    activity: 'asking',
    result: 'question',
    reverse: { at: 'askedAt', by: 'askedBy', via: 'askedVia' },
  },
  approve: {
    action: 'approve',
    actor: 'approver',
    act: 'approves',
    activity: 'approving',
    result: 'approval',
    reverse: { at: 'approvedAt', by: 'approvedBy', via: 'approvedVia' },
    inverse: 'reject',
  },
  decide: {
    action: 'decide',
    actor: 'decider',
    act: 'decides',
    activity: 'deciding',
    result: 'decision',
    reverse: { at: 'decidedAt', by: 'decidedBy' },
  },
  do: {
    action: 'do',
    actor: 'doer',
    act: 'does',
    activity: 'doing',
    result: 'task',
    reverse: { at: 'doneAt', by: 'doneBy' },
  },
} as const

// ============================================================================
// Workflow Integration Types
// ============================================================================

/**
 * Worker event names for workflow registration
 *
 * These events can be handled via $.on.Worker.notify, $.on.Worker.ask, etc.
 */
export type WorkerEvent =
  | 'Worker.notify'
  | 'Worker.ask'
  | 'Worker.approve'
  | 'Worker.decide'
  | 'Worker.do'
  // Result events
  | 'Worker.notified'
  | 'Worker.answered'
  | 'Worker.approved'
  | 'Worker.rejected'
  | 'Worker.decided'
  | 'Worker.done'
  | 'Worker.failed'

/**
 * Worker context extension for WorkflowContext
 *
 * Provides convenience methods on $ for worker actions.
 *
 * @example
 * ```ts
 * Workflow($ => {
 *   $.on.Expense.submitted(async (expense, $) => {
 *     // Use worker actions via $
 *     await $.notify(finance, `New expense: ${expense.amount}`)
 *
 *     const approval = await $.approve(expense.description, manager, {
 *       via: 'slack',
 *       context: { amount: expense.amount },
 *     })
 *
 *     if (approval.approved) {
 *       await $.notify(expense.submitter, 'Your expense was approved!')
 *     }
 *   })
 * })
 * ```
 */
export interface WorkerContext {
  /**
   * Send a notification to a worker/team
   */
  notify(
    target: Worker | Team | WorkerRef | string,
    message: string,
    options?: NotifyOptions
  ): Promise<NotifyResult>

  /**
   * Ask a question to a worker/team
   */
  ask<T = string>(
    target: Worker | Team | WorkerRef | string,
    question: string,
    options?: AskOptions
  ): Promise<AskResult<T>>

  /**
   * Request approval from a worker/team
   */
  approve(
    request: string,
    target: Worker | Team | WorkerRef | string,
    options?: ApproveOptions
  ): Promise<ApprovalResult>

  /**
   * Make a decision (AI or human)
   */
  decide<T = string>(options: DecideOptions<T>): Promise<DecideResult<T>>
}

// ============================================================================
// Action Options
// ============================================================================

/**
 * Base options for worker actions
 */
export interface ActionOptions {
  via?: ContactChannel | ContactChannel[]
  timeout?: number
  context?: Record<string, unknown>
}

/**
 * Notify options
 */
export interface NotifyOptions extends ActionOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  fallback?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Ask options
 */
export interface AskOptions extends ActionOptions {
  schema?: SimpleSchema
}

/**
 * Approve options
 */
export interface ApproveOptions extends ActionOptions {
  escalate?: boolean
}

/**
 * Decide options
 */
export interface DecideOptions<T = string> {
  options: T[]
  context?: string | Record<string, unknown>
  criteria?: string[]
  includeReasoning?: boolean
}

// ============================================================================
// Role and Goals
// ============================================================================

/**
 * WorkerRole - extends Role from org.ai with worker-specific requirements
 *
 * Inherits all fields from the base Role type (id, name, description, skills,
 * permissions, tools, outputs, type, department, etc.) and makes responsibilities
 * required for worker role definitions.
 *
 * @example
 * ```ts
 * const engineerRole: WorkerRole = {
 *   id: 'role_engineer',
 *   name: 'Software Engineer',
 *   description: 'Builds and maintains software',
 *   skills: ['typescript', 'react', 'node'],
 *   responsibilities: ['write code', 'review PRs', 'fix bugs'],
 * }
 * ```
 */
export interface WorkerRole extends Role {
  /** List of responsibilities (required for worker roles) */
  responsibilities: string[]
}

/**
 * WorkerGoals - categorized goals with metrics
 *
 * Organizes goals by timeframe (short-term, long-term, strategic)
 * and includes associated KPI metrics for tracking.
 *
 * Note: org.ai's Goals is a simpler type (Goal[]). WorkerGoals
 * provides additional structure for worker/team goal planning
 * with string-based goals for simplicity.
 */
export interface WorkerGoals {
  /** Short-term goals (days to weeks) */
  shortTerm: string[]
  /** Long-term goals (months to year) */
  longTerm: string[]
  /** Strategic goals (multi-year vision) */
  strategic?: string[]
  /** Associated KPI metrics */
  metrics?: WorkerKPI[]
}

/**
 * WorkerKPI - simplified KPI for worker goals
 *
 * A simpler KPI interface used in WorkerGoals.metrics.
 * For the full KPI type with id, category, history, etc.,
 * use KPI from org.ai.
 */
export interface WorkerKPI {
  /** KPI name */
  name: string
  /** Description of what this measures */
  description: string
  /** Current value */
  current: number
  /** Target value */
  target: number
  /** Unit of measurement */
  unit: string
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable'
  /** Measurement period */
  period?: string
}

/**
 * WorkerOKR - worker-specific OKR definition
 *
 * Uses WorkerRef for owner and simplified key results with
 * required `current` and `target` fields for progress tracking.
 * For the full org.ai OKR with `id`, `status`, `period`, etc.,
 * import OKR from 'org.ai' directly.
 */
export interface WorkerOKR {
  /** The objective - what you want to achieve */
  objective: string
  /** Measurable key results */
  keyResults: Array<{
    name: string
    current: number
    target: number
    unit: string
  }>
  /** Owner as WorkerRef */
  owner?: WorkerRef
  /** Due date */
  dueDate?: Date
  /** Overall progress percentage */
  progress?: number
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Target for an action - Worker, Team, or reference
 */
export type ActionTarget = Worker | Team | WorkerRef | string

/**
 * Union of all action data types
 */
export type AnyWorkerActionData =
  | NotifyActionData
  | AskActionData
  | ApproveActionData
  | DecideActionData
  | DoActionData

// ============================================================================
// Backwards Compatibility Aliases
// ============================================================================

/**
 * @deprecated Use DecideResult instead
 */
export type Decision<T = string> = DecideResult<T>

/**
 * @deprecated Use DoResult instead
 */
export type TaskResult<T = unknown> = DoResult<T>

/**
 * @deprecated Use ApproveOptions instead
 */
export type ApprovalOptions = ApproveOptions

/**
 * Options for task execution
 */
export interface DoOptions {
  maxRetries?: number
  timeout?: number
  background?: boolean
  context?: Record<string, unknown>
}

// ============================================================================
// Generation Types
// ============================================================================

/**
 * Content type for generation
 */
export type GenerationType = 'text' | 'code' | 'structured' | 'image' | 'video' | 'audio'

/**
 * Options for content generation
 */
export interface GenerateOptions {
  type?: GenerationType
  model?: string
  instructions?: string
  schema?: import('ai-functions').SimpleSchema
  maxTokens?: number
  temperature?: number
  format?: string
  language?: string
}

/**
 * Result of content generation
 */
export interface GenerateResult<T = string> {
  content: T
  type: GenerationType
  model?: string
  tokensUsed?: number
  cached?: boolean
  metadata?: Record<string, unknown>
}

// ============================================================================
// Type Checking Types
// ============================================================================

/**
 * Options for type checking
 */
export interface IsOptions {
  coerce?: boolean
  strict?: boolean
  errorMessages?: Record<string, string>
}

/**
 * Result of type checking
 */
export interface TypeCheckResult<T = unknown> {
  valid: boolean
  value?: T
  errors?: string[]
  coerced?: boolean
}

// ============================================================================
// Team Alias - Backwards Compatibility
// ============================================================================

// WorkerTeam is now the primary type that extends Team from org.ai
// The base Team type is re-exported from org.ai
