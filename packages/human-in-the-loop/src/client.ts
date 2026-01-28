/**
 * RPC Client for Human-in-the-Loop
 *
 * Provides a typed RPC client that connects to the deployed
 * human-in-the-loop worker using rpc.do for remote procedure calls.
 *
 * @example
 * ```ts
 * import { createHumanReviewClient } from 'human-in-the-loop/client'
 *
 * const client = createHumanReviewClient('https://human-in-the-loop.workers.dev')
 * const request = await client.requestReview({
 *   type: 'approval',
 *   title: 'Deploy to production',
 *   description: 'Review and approve production deployment',
 *   content: { version: '2.0.0', changes: ['feature X', 'bugfix Y'] },
 * })
 * ```
 *
 * @packageDocumentation
 */

import { RPC } from 'rpc.do'

// ==================== Types ====================

type ReviewRequestType = 'approval' | 'question' | 'task' | 'decision' | 'review'
type ReviewRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'escalated'
  | 'timeout'
  | 'cancelled'
type ReviewPriority = 'low' | 'normal' | 'high' | 'critical'

interface ReviewRequest {
  id: string
  type: ReviewRequestType
  status: ReviewRequestStatus
  priority: ReviewPriority
  title: string
  description: string
  content: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  respondedBy?: string
  response?: unknown
  rejectionReason?: string
  escalatedTo?: string
  escalatedAt?: Date
  metadata?: Record<string, unknown>
}

interface ReviewDecision {
  requestId: string
  decision: 'approved' | 'rejected'
  decidedBy: string
  decidedAt: Date
  comments?: string
  conditions?: string[]
  feedback?: string
}

interface ReviewFeedback {
  id: string
  requestId: string
  feedbackBy: string
  feedbackAt: Date
  rating?: number
  comments: string
  suggestions?: string[]
  tags?: string[]
}

interface QueueFilters {
  status?: ReviewRequestStatus[]
  priority?: ReviewPriority[]
  assignee?: string[]
  role?: string[]
  team?: string[]
  type?: ReviewRequestType[]
}

interface QueueOptions {
  filters?: QueueFilters
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'priority' | 'updatedAt'
  sortDirection?: 'asc' | 'desc'
}

interface EscalationOptions {
  to: string
  reason?: string
  priority?: ReviewPriority
  notifyVia?: ('slack' | 'email' | 'sms' | 'web')[]
}

interface RequestReviewParams {
  type: ReviewRequestType
  title: string
  description: string
  content: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: ReviewPriority
  timeout?: number
  metadata?: Record<string, unknown>
}

interface ApproveParams {
  decidedBy: string
  comments?: string
  conditions?: string[]
}

interface RejectParams {
  decidedBy: string
  reason: string
  feedback?: string
}

interface AddFeedbackParams {
  requestId: string
  feedbackBy: string
  rating?: number
  comments: string
  suggestions?: string[]
  tags?: string[]
}

interface QueueStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  rejected: number
  escalated: number
  byPriority: Record<string, number>
  avgResponseTime?: number
}

// ==================== API Type ====================

/**
 * HumanReviewAPI - Type-safe interface matching HumanReviewServiceCore RPC methods
 *
 * This interface mirrors all public methods on HumanReviewServiceCore so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface HumanReviewAPI {
  // Review Requests
  requestReview(params: RequestReviewParams): Promise<ReviewRequest>
  getRequest(requestId: string): Promise<ReviewRequest | null>
  getQueue(options?: QueueOptions): Promise<ReviewRequest[]>

  // Decisions
  approve(requestId: string, params: ApproveParams): Promise<ReviewDecision>
  reject(requestId: string, params: RejectParams): Promise<ReviewDecision>
  getDecision(requestId: string): Promise<ReviewDecision | null>

  // Escalation
  escalate(requestId: string, options: EscalationOptions): Promise<ReviewRequest>

  // Feedback
  addFeedback(params: AddFeedbackParams): Promise<ReviewFeedback>
  listFeedback(requestId: string): Promise<ReviewFeedback[]>

  // Status and Assignment
  updateStatus(
    requestId: string,
    status: ReviewRequestStatus,
    respondedBy?: string
  ): Promise<ReviewRequest>
  assign(requestId: string, assignee: string | string[]): Promise<ReviewRequest>

  // Statistics
  getQueueStats(): Promise<QueueStats>
}

// ==================== Client Options ====================

/**
 * Options for creating a human review RPC client
 */
export interface HumanReviewClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client Factory ====================

/** Default URL for the human-in-the-loop worker */
const DEFAULT_URL = 'https://human-in-the-loop.workers.dev'

/**
 * Create a typed RPC client for the human-in-the-loop worker
 *
 * @param url - The URL of the deployed human-in-the-loop worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all HumanReviewServiceCore methods
 *
 * @example
 * ```ts
 * import { createHumanReviewClient } from 'human-in-the-loop/client'
 *
 * // Connect to production
 * const client = createHumanReviewClient('https://human-in-the-loop.workers.dev')
 *
 * // Request a review
 * const request = await client.requestReview({
 *   type: 'approval',
 *   title: 'Production deployment',
 *   description: 'Deploy v2.0.0 to production',
 *   content: { version: '2.0.0' },
 *   assignee: 'team-lead',
 *   priority: 'high',
 * })
 *
 * // Approve the request
 * const decision = await client.approve(request.id, {
 *   decidedBy: 'team-lead',
 *   comments: 'Looks good to ship',
 * })
 *
 * // Check queue stats
 * const stats = await client.getQueueStats()
 * ```
 */
export function createHumanReviewClient(
  url: string = DEFAULT_URL,
  options?: HumanReviewClientOptions
) {
  return RPC<HumanReviewAPI>(url, options)
}

/**
 * Default client instance connected to the production human-in-the-loop worker
 *
 * @example
 * ```ts
 * import client from 'human-in-the-loop/client'
 *
 * const request = await client.requestReview({
 *   type: 'approval',
 *   title: 'Review changes',
 *   description: 'Please review these changes',
 *   content: { diff: '...' },
 * })
 * ```
 */
const client = createHumanReviewClient()

export default client
