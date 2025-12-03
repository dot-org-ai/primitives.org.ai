/**
 * Type definitions for digital-workers
 *
 * Common abstract interface over AI Agents and Humans.
 * Digital workers operate within a company/business boundary and share
 * interfaces with Services, which can cross company boundaries.
 */

import type { SimpleSchema } from 'ai-functions'

/**
 * Communication channels for notifications and human interaction
 */
export type Channel = 'slack' | 'email' | 'web' | 'sms' | 'custom'

/**
 * Decision outcome with reasoning
 */
export interface Decision<T = string> {
  /** The decision made */
  choice: T
  /** Reasoning behind the decision */
  reasoning: string
  /** Confidence level (0-1) */
  confidence: number
  /** Alternative options considered */
  alternatives?: Array<{ option: T; score: number }>
}

/**
 * Approval request result
 */
export interface ApprovalResult {
  /** Whether the request was approved */
  approved: boolean
  /** Who approved/rejected */
  approvedBy?: string
  /** When the decision was made */
  approvedAt?: Date
  /** Notes or feedback from approver */
  notes?: string
  /** Channel used for approval */
  channel: Channel
}

/**
 * Question/answer result
 */
export interface AskResult<T = string> {
  /** The answer provided */
  answer: T
  /** Who answered */
  answeredBy?: string
  /** When it was answered */
  answeredAt?: Date
  /** Channel used */
  channel: Channel
}

/**
 * Notification result
 */
export interface NotifyResult {
  /** Whether notification was sent successfully */
  sent: boolean
  /** Channel(s) used */
  channels: Channel[]
  /** Recipients */
  recipients?: string[]
  /** Timestamp */
  sentAt?: Date
  /** Message ID or tracking info */
  messageId?: string
}

/**
 * Generated content result
 */
export interface GenerateResult<T = string> {
  /** The generated content */
  content: T
  /** Type of content generated */
  type: 'text' | 'code' | 'image' | 'video' | 'audio' | 'structured'
  /** Metadata about the generation */
  metadata?: {
    model?: string
    tokens?: number
    duration?: number
  }
}

/**
 * Task execution result
 */
export interface TaskResult<T = unknown> {
  /** The result of the task */
  result: T
  /** Whether the task was successful */
  success: boolean
  /** Error if task failed */
  error?: string
  /** Time taken to complete (ms) */
  duration?: number
  /** Steps taken to complete the task */
  steps?: Array<{
    action: string
    result: unknown
    timestamp: Date
  }>
}

/**
 * Type validation result
 */
export interface TypeCheckResult {
  /** Whether the value matches the expected type */
  valid: boolean
  /** Validation errors if invalid */
  errors?: string[]
  /** The validated/coerced value */
  value?: unknown
}

/**
 * Key Performance Indicator definition
 */
export interface KPI {
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
  /** Time period */
  period?: string
}

/**
 * Objective and Key Results
 */
export interface OKR {
  /** Objective description */
  objective: string
  /** Key results to measure success */
  keyResults: Array<{
    name: string
    current: number
    target: number
    unit: string
  }>
  /** Owner of this OKR */
  owner?: string
  /** Due date */
  dueDate?: Date
  /** Progress (0-1) */
  progress?: number
}

/**
 * Worker role definition
 */
export interface WorkerRole {
  /** Role name */
  name: string
  /** Role description */
  description: string
  /** Responsibilities */
  responsibilities: string[]
  /** Skills required */
  skills?: string[]
  /** Permissions/capabilities */
  permissions?: string[]
  /** Whether this is an AI or human role */
  type?: 'ai' | 'human' | 'hybrid'
}

/**
 * Team definition
 */
export interface WorkerTeam {
  /** Team name */
  name: string
  /** Team description */
  description: string
  /** Team members */
  members: Array<{
    id: string
    name: string
    role: string
    type: 'ai' | 'human'
  }>
  /** Team goals */
  goals?: string[]
  /** Team lead */
  lead?: string
}

/**
 * Goals definition
 */
export interface WorkerGoals {
  /** Short-term goals */
  shortTerm: string[]
  /** Long-term goals */
  longTerm: string[]
  /** Strategic objectives */
  strategic?: string[]
  /** Success metrics */
  metrics?: KPI[]
}

/**
 * Options for approval requests
 */
export interface ApprovalOptions {
  /** Channel to use for approval */
  channel?: Channel
  /** Who should approve */
  approver?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Options for asking questions
 */
export interface AskOptions {
  /** Channel to use */
  channel?: Channel
  /** Who to ask */
  askee?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Expected response schema */
  schema?: SimpleSchema
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Options for task execution
 */
export interface DoOptions {
  /** Maximum retries on failure */
  maxRetries?: number
  /** Timeout in milliseconds */
  timeout?: number
  /** Whether to run in background */
  background?: boolean
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Options for decision making
 */
export interface DecideOptions<T = string> {
  /** Options to choose from */
  options: T[]
  /** Additional context for the decision */
  context?: string | Record<string, unknown>
  /** Criteria for evaluation */
  criteria?: string[]
  /** Whether to include reasoning */
  includeReasoning?: boolean
}

/**
 * Options for content generation
 */
export interface GenerateOptions {
  /** Type of content to generate */
  type?: 'text' | 'code' | 'image' | 'video' | 'audio' | 'structured'
  /** Output schema for structured content */
  schema?: SimpleSchema
  /** Additional instructions */
  instructions?: string
  /** Model to use */
  model?: string
}

/**
 * Options for notifications
 */
export interface NotifyOptions {
  /** Channel(s) to use */
  channels?: Channel | Channel[]
  /** Recipients */
  recipients?: string[]
  /** Priority */
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Options for type validation
 */
export interface IsOptions {
  /** Whether to coerce the value to the expected type */
  coerce?: boolean
  /** Whether to throw on validation failure */
  strict?: boolean
}
