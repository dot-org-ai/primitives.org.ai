/**
 * Core types for human-in-the-loop workflows
 */

import type { AIFunctionDefinition, JSONSchema } from 'ai-functions'

/**
 * Status of a human interaction request
 */
export type HumanRequestStatus =
  | 'pending'      // Waiting for human response
  | 'in_progress'  // Being handled by a human
  | 'completed'    // Completed successfully
  | 'rejected'     // Rejected or declined
  | 'timeout'      // Timed out waiting for response
  | 'escalated'    // Escalated to higher authority
  | 'cancelled'    // Cancelled before completion

/**
 * Priority level for human requests
 */
export type Priority = 'low' | 'normal' | 'high' | 'critical'

/**
 * Human role definition
 */
export interface Role {
  /** Unique role identifier */
  id: string
  /** Role name */
  name: string
  /** Role description */
  description?: string
  /** Role capabilities/permissions */
  capabilities?: string[]
  /** Default escalation role */
  escalatesTo?: string
}

/**
 * Team composition
 */
export interface Team {
  /** Team identifier */
  id: string
  /** Team name */
  name: string
  /** Team description */
  description?: string
  /** Team members (role IDs or user IDs) */
  members: string[]
  /** Team lead */
  lead?: string
}

/**
 * Human worker/assignee
 */
export interface Human {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Email address */
  email?: string
  /** Assigned roles */
  roles?: string[]
  /** Teams the human belongs to */
  teams?: string[]
  /** Contact channels */
  channels?: {
    slack?: string
    email?: string
    sms?: string
    web?: boolean
  }
}

/**
 * Goals and objectives
 */
export interface Goals {
  /** Goal identifier */
  id: string
  /** Goals/objectives */
  objectives: string[]
  /** Success criteria */
  successCriteria?: string[]
  /** Key results */
  keyResults?: string[]
  /** Target date */
  targetDate?: Date
}

/**
 * Key Performance Indicators
 */
export interface KPIs {
  /** KPI identifier */
  id: string
  /** Metric name */
  name: string
  /** Current value */
  value: number
  /** Target value */
  target?: number
  /** Unit of measurement */
  unit?: string
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable'
}

/**
 * Objectives and Key Results
 */
export interface OKRs {
  /** OKR identifier */
  id: string
  /** Objective statement */
  objective: string
  /** Key results */
  keyResults: Array<{
    /** Key result description */
    description: string
    /** Current progress (0-1) */
    progress: number
    /** Target value */
    target?: number
    /** Current value */
    current?: number
  }>
  /** Quarter or time period */
  period?: string
  /** Owner */
  owner?: string
}

/**
 * Base human request
 */
export interface HumanRequest<TInput = unknown, TOutput = unknown> {
  /** Request ID */
  id: string
  /** Request type */
  type: 'approval' | 'question' | 'task' | 'decision' | 'review' | 'notification'
  /** Request status */
  status: HumanRequestStatus
  /** Priority level */
  priority: Priority
  /** Title or summary */
  title: string
  /** Detailed description */
  description: string
  /** Input data for the request */
  input: TInput
  /** Expected output schema */
  outputSchema?: JSONSchema
  /** Who should handle this */
  assignee?: string | string[]
  /** Assigned role */
  role?: string
  /** Assigned team */
  team?: string
  /** Escalation path */
  escalatesTo?: string | string[]
  /** Timeout in milliseconds */
  timeout?: number
  /** When the request was created */
  createdAt: Date
  /** When it was last updated */
  updatedAt: Date
  /** When it was completed */
  completedAt?: Date
  /** Who responded */
  respondedBy?: string
  /** The response */
  response?: TOutput
  /** Rejection reason */
  rejectionReason?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Approval request
 */
export interface ApprovalRequest<TData = unknown> extends HumanRequest<TData, ApprovalResponse> {
  type: 'approval'
  /** What is being approved */
  subject: string
  /** Default is approve required */
  requiresApproval?: boolean
  /** Approval chain (multiple approvers) */
  approvers?: string[]
  /** Current approver index */
  currentApproverIndex?: number
}

/**
 * Approval response
 */
export interface ApprovalResponse {
  /** Whether approved */
  approved: boolean
  /** Comments from approver */
  comments?: string
  /** Conditions or requirements */
  conditions?: string[]
}

/**
 * Question request
 */
export interface QuestionRequest extends HumanRequest<{ question: string; context?: unknown }, string> {
  type: 'question'
  /** The question */
  question: string
  /** Additional context */
  context?: unknown
  /** Suggested answers */
  suggestions?: string[]
}

/**
 * Task request
 */
export interface TaskRequest<TInput = unknown, TOutput = unknown> extends HumanRequest<TInput, TOutput> {
  type: 'task'
  /** Task instructions */
  instructions: string
  /** Required tools/resources */
  tools?: AIFunctionDefinition[]
  /** Estimated effort */
  estimatedEffort?: string
}

/**
 * Decision request
 */
export interface DecisionRequest<TOptions extends string = string>
  extends HumanRequest<{ options: TOptions[]; context?: unknown }, TOptions> {
  type: 'decision'
  /** Available options */
  options: TOptions[]
  /** Decision context */
  context?: unknown
  /** Criteria for decision */
  criteria?: string[]
}

/**
 * Review request
 */
export interface ReviewRequest<TContent = unknown>
  extends HumanRequest<TContent, ReviewResponse> {
  type: 'review'
  /** Content to review */
  content: TContent
  /** Review criteria/checklist */
  criteria?: string[]
  /** Review type */
  reviewType?: 'code' | 'content' | 'design' | 'data' | 'other'
}

/**
 * Review response
 */
export interface ReviewResponse {
  /** Whether approved */
  approved: boolean
  /** Review comments */
  comments: string
  /** Required changes */
  changes?: string[]
  /** Rating (1-5) */
  rating?: number
}

/**
 * Notification
 */
export interface Notification {
  /** Notification ID */
  id: string
  /** Notification type */
  type: 'info' | 'warning' | 'error' | 'success'
  /** Title */
  title: string
  /** Message */
  message: string
  /** Recipient(s) */
  recipient: string | string[]
  /** Channel(s) to use */
  channels?: ('slack' | 'email' | 'sms' | 'web')[]
  /** Priority */
  priority?: Priority
  /** Additional data */
  data?: unknown
  /** When created */
  createdAt: Date
  /** When delivered */
  deliveredAt?: Date
  /** Whether read */
  read?: boolean
}

/**
 * Review queue for managing pending human requests
 */
export interface ReviewQueue<T extends HumanRequest = HumanRequest> {
  /** Queue identifier */
  id: string
  /** Queue name */
  name: string
  /** Queue description */
  description?: string
  /** Items in the queue */
  items: T[]
  /** Queue filters */
  filters?: {
    status?: HumanRequestStatus[]
    priority?: Priority[]
    assignee?: string[]
    role?: string[]
    team?: string[]
  }
  /** Sort order */
  sortBy?: 'createdAt' | 'priority' | 'updatedAt'
  /** Sort direction */
  sortDirection?: 'asc' | 'desc'
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  /** Policy ID */
  id: string
  /** Policy name */
  name: string
  /** When to escalate */
  conditions: {
    /** Escalate if no response after N milliseconds */
    timeout?: number
    /** Escalate on rejection */
    onRejection?: boolean
    /** Escalate if priority is at or above */
    minPriority?: Priority
  }
  /** Escalation path */
  escalationPath: Array<{
    /** Who to escalate to */
    assignee: string
    /** After how long (cumulative) */
    afterMs: number
    /** Notify via these channels */
    notifyVia?: ('slack' | 'email' | 'sms' | 'web')[]
  }>
}

/**
 * Approval workflow configuration
 */
export interface ApprovalWorkflow {
  /** Workflow ID */
  id: string
  /** Workflow name */
  name: string
  /** Workflow steps */
  steps: Array<{
    /** Step name */
    name: string
    /** Required role */
    role?: string
    /** Required approvers */
    approvers: string[]
    /** All must approve or just one */
    requireAll?: boolean
    /** Auto-approve after timeout */
    autoApproveAfter?: number
  }>
  /** Current step index */
  currentStep?: number
  /** Workflow status */
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
}

/**
 * Human-in-the-loop store interface
 */
export interface HumanStore {
  /** Create a new request */
  create<T extends HumanRequest>(request: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>

  /** Get a request by ID */
  get<T extends HumanRequest>(id: string): Promise<T | null>

  /** Update a request */
  update<T extends HumanRequest>(id: string, updates: Partial<T>): Promise<T>

  /** List requests with filters */
  list<T extends HumanRequest>(filters?: ReviewQueue['filters'], limit?: number): Promise<T[]>

  /** Complete a request */
  complete<T extends HumanRequest>(id: string, response: T['response']): Promise<T>

  /** Reject a request */
  reject(id: string, reason: string): Promise<HumanRequest>

  /** Escalate a request */
  escalate(id: string, to: string): Promise<HumanRequest>

  /** Cancel a request */
  cancel(id: string): Promise<HumanRequest>
}

/**
 * Options for human interactions
 */
export interface HumanOptions {
  /** Storage backend */
  store?: HumanStore
  /** Default timeout in milliseconds */
  defaultTimeout?: number
  /** Default priority */
  defaultPriority?: Priority
  /** Escalation policies */
  escalationPolicies?: EscalationPolicy[]
  /** Auto-escalate on timeout */
  autoEscalate?: boolean
}
