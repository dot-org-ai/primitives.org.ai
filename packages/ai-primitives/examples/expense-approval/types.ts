/**
 * Type definitions for the Expense Approval Workflow
 *
 * This module exports all types used in the human-in-the-loop expense
 * approval workflow. These types are designed to be reusable across
 * different implementations.
 *
 * @packageDocumentation
 */

// =============================================================================
// Expense Types
// =============================================================================

/**
 * Expense category for classification
 */
export type ExpenseCategory = 'travel' | 'meals' | 'supplies' | 'equipment' | 'services' | 'other'

/**
 * Expense submission input
 *
 * @example
 * ```ts
 * const expense: ExpenseSubmission = {
 *   id: 'exp-001',
 *   amountCents: 4500, // $45.00
 *   currency: 'USD',
 *   category: 'meals',
 *   description: 'Team lunch with client',
 *   submittedBy: 'alice@company.com',
 *   submittedAt: new Date(),
 *   vendor: 'Restaurant ABC',
 *   receipt: 'https://storage.example.com/receipts/exp-001.pdf',
 * }
 * ```
 */
export interface ExpenseSubmission {
  /** Unique expense ID */
  id: string
  /** Amount in cents to avoid floating point issues */
  amountCents: number
  /** Currency code (e.g., 'USD', 'EUR') */
  currency: string
  /** Expense category */
  category: ExpenseCategory
  /** Description of the expense */
  description: string
  /** Receipt URL or reference */
  receipt?: string
  /** Submitter ID */
  submittedBy: string
  /** Submission timestamp */
  submittedAt: Date
  /** Optional vendor name */
  vendor?: string
  /** Project or cost center */
  project?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// =============================================================================
// AI Analysis Types
// =============================================================================

/**
 * Risk level classification for expenses
 */
export type RiskLevel = 'low' | 'medium' | 'high'

/**
 * Suggested action based on AI analysis
 */
export type SuggestedAction = 'auto_approve' | 'human_review' | 'auto_reject'

/**
 * AI analysis result for expense
 *
 * The AI analyzes each expense and produces this structured output
 * to determine if human review is required.
 *
 * @example
 * ```ts
 * const analysis: ExpenseAnalysis = {
 *   isValid: true,
 *   riskScore: 15,
 *   riskLevel: 'low',
 *   flags: [],
 *   requiresHumanReview: false,
 *   suggestedAction: 'auto_approve',
 *   reason: 'Low-value expense with receipt and vendor information',
 *   confidence: 0.95,
 * }
 * ```
 */
export interface ExpenseAnalysis {
  /** Whether the expense appears valid */
  isValid: boolean
  /** Risk score (0-100, higher = more suspicious) */
  riskScore: number
  /** Risk level classification */
  riskLevel: RiskLevel
  /** Flags for suspicious patterns */
  flags: string[]
  /** Whether human review is required */
  requiresHumanReview: boolean
  /** Suggested action */
  suggestedAction: SuggestedAction
  /** Reason for the suggestion */
  reason: string
  /** Confidence score (0-1) */
  confidence: number
}

// =============================================================================
// Approval Types
// =============================================================================

/**
 * Channel used for approval
 */
export type ApprovalChannel = 'slack' | 'email' | 'web'

/**
 * Human approval response
 *
 * Represents the response from a human approver, whether they
 * approve, reject, or approve with conditions.
 *
 * @example
 * ```ts
 * // Approval with conditions
 * const response: ApprovalResponse = {
 *   approved: true,
 *   approvedBy: 'manager@company.com',
 *   approvedAt: new Date(),
 *   comments: 'Approved with conditions',
 *   conditions: ['Upload receipt within 30 days'],
 *   approvalChannel: 'slack',
 * }
 * ```
 */
export interface ApprovalResponse {
  /** Whether approved */
  approved: boolean
  /** Approver ID */
  approvedBy?: string
  /** Approval timestamp */
  approvedAt?: Date
  /** Comments from approver */
  comments?: string
  /** Conditions or requirements */
  conditions?: string[]
  /** Channel used for approval (slack, email, web) */
  approvalChannel?: ApprovalChannel
}

// =============================================================================
// Workflow Types
// =============================================================================

/**
 * Workflow status
 */
export type WorkflowStatus =
  | 'pending'
  | 'analyzing'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'cancelled'

/**
 * Workflow event types for audit trail
 */
export type WorkflowEventType =
  | 'submitted'
  | 'analyzed'
  | 'routed'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'cancelled'

/**
 * Workflow event for audit trail
 *
 * Each event in the workflow is recorded for compliance and debugging.
 */
export interface WorkflowEvent {
  /** Event type */
  type: WorkflowEventType
  /** Event timestamp */
  timestamp: Date
  /** Actor (system, AI, or human ID) */
  actor: string
  /** Event details */
  details?: Record<string, unknown>
}

/**
 * Complete workflow result
 *
 * The final output of the expense approval workflow, including
 * all analysis, approval data, and audit trail.
 *
 * @example
 * ```ts
 * const result: WorkflowResult = {
 *   expenseId: 'exp-001',
 *   status: 'approved',
 *   analysis: { ... },
 *   approval: { approved: true, ... },
 *   completedAt: new Date(),
 *   processingTimeMs: 5230,
 *   auditTrail: [
 *     { type: 'submitted', timestamp: ..., actor: 'alice@company.com' },
 *     { type: 'analyzed', timestamp: ..., actor: 'system:ai-analyzer' },
 *     { type: 'routed', timestamp: ..., actor: 'system:router' },
 *     { type: 'approved', timestamp: ..., actor: 'manager@company.com' },
 *   ],
 * }
 * ```
 */
export interface WorkflowResult {
  /** Expense ID */
  expenseId: string
  /** Workflow status */
  status: WorkflowStatus
  /** AI analysis */
  analysis: ExpenseAnalysis
  /** Human approval (if obtained) */
  approval?: ApprovalResponse
  /** Final decision timestamp */
  completedAt?: Date
  /** Total processing time in milliseconds */
  processingTimeMs: number
  /** Audit trail of events */
  auditTrail: WorkflowEvent[]
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Expense policy configuration
 *
 * Defines the rules for automatic approval and human review thresholds.
 */
export interface ExpensePolicy {
  /** Maximum amount (cents) for auto-approval */
  autoApproveMaxCents: number
  /** Minimum amount (cents) requiring human review */
  humanReviewMinCents: number
  /** Categories that always require review */
  alwaysReviewCategories: ExpenseCategory[]
  /** Maximum risk score for auto-approval */
  maxAutoApproveRiskScore: number
  /** Default approver(s) */
  defaultApprovers: string[]
  /** Escalation timeout in milliseconds */
  escalationTimeoutMs: number
}

/**
 * Default expense policy
 */
export const DEFAULT_EXPENSE_POLICY: ExpensePolicy = {
  autoApproveMaxCents: 5000, // $50.00
  humanReviewMinCents: 50000, // $500.00
  alwaysReviewCategories: ['equipment', 'services'],
  maxAutoApproveRiskScore: 20,
  defaultApprovers: ['manager@company.com'],
  escalationTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
}

// =============================================================================
// Transport Types
// =============================================================================

/**
 * Notification delivery result
 */
export interface DeliveryResult {
  /** Whether delivery succeeded */
  success: boolean
  /** Message ID from the transport */
  messageId?: string
  /** Error message if failed */
  error?: string
  /** Transport used */
  transport: 'slack' | 'email'
}

/**
 * Approval request for routing
 */
export interface ApprovalRequest {
  /** Request ID */
  requestId: string
  /** Expense being approved */
  expense: ExpenseSubmission
  /** AI analysis result */
  analysis: ExpenseAnalysis
  /** Approver(s) to notify */
  approvers: string[]
  /** Preferred notification channel */
  channel: ApprovalChannel
  /** Request timeout in milliseconds */
  timeoutMs?: number
}
