/**
 * Worker Export - HumanReviewService WorkerEntrypoint
 *
 * Provides HumanReviewWorker (WorkerEntrypoint with connect() method)
 * and HumanReviewServiceCore (RpcTarget with review service methods).
 *
 * @packageDocumentation
 */

// @ts-expect-error - cloudflare:workers is available at runtime
import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'

/**
 * Environment bindings for the HumanReviewWorker
 */
export interface Env {
  AI: Ai
  // @ts-expect-error - DurableObjectNamespace is a Cloudflare global
  HUMAN_REVIEW_STATE: DurableObjectNamespace
}

// Type definitions matching the test file expectations
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

interface CreateRequestParams {
  type: ReviewRequestType
  status: ReviewRequestStatus
  priority: ReviewPriority
  title: string
  description: string
  content: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  metadata?: Record<string, unknown>
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

// Valid types and priorities for validation
const VALID_TYPES: ReviewRequestType[] = ['approval', 'question', 'task', 'decision', 'review']
const VALID_PRIORITIES: ReviewPriority[] = ['low', 'normal', 'high', 'critical']

// Priority order for sorting (higher number = higher priority)
const PRIORITY_ORDER: Record<ReviewPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
}

/**
 * Shared module-level store for persistence across worker instances.
 * In production, this would be backed by a Durable Object or database.
 */
class SharedStore {
  private requests = new Map<string, ReviewRequest>()
  private decisions = new Map<string, ReviewDecision>()
  private feedbacks = new Map<string, ReviewFeedback[]>()
  private idCounter = 0

  generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.idCounter}`
  }

  // Request methods
  createRequest(params: CreateRequestParams): ReviewRequest {
    const now = new Date()
    const fullRequest: ReviewRequest = {
      id: this.generateId('req'),
      type: params.type,
      status: params.status,
      priority: params.priority,
      title: params.title,
      description: params.description,
      content: params.content,
      createdAt: now,
      updatedAt: now,
    }

    // Only set optional properties if they have values
    if (params.assignee !== undefined) {
      fullRequest.assignee = params.assignee
    }
    if (params.role !== undefined) {
      fullRequest.role = params.role
    }
    if (params.team !== undefined) {
      fullRequest.team = params.team
    }
    if (params.metadata !== undefined) {
      fullRequest.metadata = params.metadata
    }

    this.requests.set(fullRequest.id, fullRequest)
    return fullRequest
  }

  getRequest(id: string): ReviewRequest | null {
    const request = this.requests.get(id)
    return request || null
  }

  updateRequest(id: string, updates: Partial<ReviewRequest>): ReviewRequest {
    const request = this.requests.get(id)
    if (!request) {
      throw new Error(`Request not found: ${id}`)
    }

    // Create updated object starting from current state
    const updated: ReviewRequest = {
      ...request,
      updatedAt: new Date(),
    }

    // Apply updates, but only set defined values
    if (updates.status !== undefined) updated.status = updates.status
    if (updates.priority !== undefined) updated.priority = updates.priority
    if (updates.title !== undefined) updated.title = updates.title
    if (updates.description !== undefined) updated.description = updates.description
    if (updates.content !== undefined) updated.content = updates.content
    if (updates.assignee !== undefined) updated.assignee = updates.assignee
    if (updates.role !== undefined) updated.role = updates.role
    if (updates.team !== undefined) updated.team = updates.team
    if (updates.completedAt !== undefined) updated.completedAt = updates.completedAt
    if (updates.respondedBy !== undefined) updated.respondedBy = updates.respondedBy
    if (updates.response !== undefined) updated.response = updates.response
    if (updates.rejectionReason !== undefined) updated.rejectionReason = updates.rejectionReason
    if (updates.escalatedTo !== undefined) updated.escalatedTo = updates.escalatedTo
    if (updates.escalatedAt !== undefined) updated.escalatedAt = updates.escalatedAt
    if (updates.metadata !== undefined) updated.metadata = updates.metadata

    this.requests.set(id, updated)
    return updated
  }

  listRequests(options?: QueueOptions): ReviewRequest[] {
    let results = Array.from(this.requests.values())

    // Apply filters
    if (options?.filters) {
      const { status, priority, assignee, role, team, type } = options.filters

      if (status && status.length > 0) {
        results = results.filter((r) => status.includes(r.status))
      }
      if (priority && priority.length > 0) {
        results = results.filter((r) => priority.includes(r.priority))
      }
      if (type && type.length > 0) {
        results = results.filter((r) => type.includes(r.type))
      }
      if (assignee && assignee.length > 0) {
        results = results.filter((r) => {
          if (!r.assignee) return false
          const assignees = Array.isArray(r.assignee) ? r.assignee : [r.assignee]
          return assignees.some((a) => assignee.includes(a))
        })
      }
      if (role && role.length > 0) {
        results = results.filter((r) => r.role && role.includes(r.role))
      }
      if (team && team.length > 0) {
        results = results.filter((r) => r.team && team.includes(r.team))
      }
    }

    // Apply sorting
    const sortBy = options?.sortBy || 'createdAt'
    const sortDirection = options?.sortDirection || 'desc'

    results.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'createdAt') {
        comparison = a.createdAt.getTime() - b.createdAt.getTime()
      } else if (sortBy === 'updatedAt') {
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime()
      } else if (sortBy === 'priority') {
        comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      }
      return sortDirection === 'desc' ? -comparison : comparison
    })

    // Apply offset and limit
    if (options?.offset && options.offset > 0) {
      results = results.slice(options.offset)
    }
    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  getStats(): QueueStats {
    const requests = Array.from(this.requests.values())
    const byPriority: Record<string, number> = {
      low: 0,
      normal: 0,
      high: 0,
      critical: 0,
    }

    let pending = 0
    let inProgress = 0
    let completed = 0
    let rejected = 0
    let escalated = 0
    let totalResponseTime = 0
    let completedCount = 0

    for (const r of requests) {
      byPriority[r.priority] = (byPriority[r.priority] || 0) + 1

      switch (r.status) {
        case 'pending':
          pending++
          break
        case 'in_progress':
          inProgress++
          break
        case 'completed':
          completed++
          if (r.completedAt) {
            totalResponseTime += r.completedAt.getTime() - r.createdAt.getTime()
            completedCount++
          }
          break
        case 'rejected':
          rejected++
          break
        case 'escalated':
          escalated++
          break
      }
    }

    const stats: QueueStats = {
      total: requests.length,
      pending,
      inProgress,
      completed,
      rejected,
      escalated,
      byPriority,
    }

    if (completedCount > 0) {
      stats.avgResponseTime = totalResponseTime / completedCount
    }

    return stats
  }

  // Decision methods
  createDecision(decision: ReviewDecision): ReviewDecision {
    this.decisions.set(decision.requestId, decision)
    return decision
  }

  getDecision(requestId: string): ReviewDecision | null {
    return this.decisions.get(requestId) || null
  }

  // Feedback methods
  addFeedback(feedback: ReviewFeedback): ReviewFeedback {
    const existing = this.feedbacks.get(feedback.requestId) || []
    existing.push(feedback)
    this.feedbacks.set(feedback.requestId, existing)
    return feedback
  }

  listFeedback(requestId: string): ReviewFeedback[] {
    return this.feedbacks.get(requestId) || []
  }
}

// Module-level store instance for persistence across worker instances
const sharedStore = new SharedStore()

/**
 * HumanReviewServiceCore - RpcTarget that provides human review operations
 *
 * This class is returned by HumanReviewWorker.connect() and provides:
 * - requestReview() - create review requests
 * - approve() - approve items
 * - reject() - reject items
 * - escalate() - escalate to higher authority
 * - getQueue() - list pending reviews
 * - addFeedback() - collect human feedback
 * - getDecision() - retrieve review decisions
 */
export class HumanReviewServiceCore extends RpcTarget {
  #env: Env
  #store: SharedStore

  constructor(env: Env) {
    super()
    this.#env = env
    this.#store = sharedStore
  }

  /**
   * Create a new review request
   */
  async requestReview(params: RequestReviewParams): Promise<ReviewRequest> {
    // Validate required fields
    if (!params.title || params.title.trim() === '') {
      throw new Error('Title is required')
    }
    if (!params.type || !VALID_TYPES.includes(params.type)) {
      throw new Error(
        `Invalid request type: ${params.type}. Must be one of: ${VALID_TYPES.join(', ')}`
      )
    }
    if (params.priority && !VALID_PRIORITIES.includes(params.priority)) {
      throw new Error(
        `Invalid priority: ${params.priority}. Must be one of: ${VALID_PRIORITIES.join(', ')}`
      )
    }

    const createParams: CreateRequestParams = {
      type: params.type,
      status: 'pending',
      priority: params.priority || 'normal',
      title: params.title,
      description: params.description,
      content: params.content,
    }

    if (params.assignee !== undefined) {
      createParams.assignee = params.assignee
    }
    if (params.role !== undefined) {
      createParams.role = params.role
    }
    if (params.team !== undefined) {
      createParams.team = params.team
    }
    if (params.metadata !== undefined) {
      createParams.metadata = params.metadata
    }

    return this.#store.createRequest(createParams)
  }

  /**
   * Approve a pending request
   */
  async approve(requestId: string, params: ApproveParams): Promise<ReviewDecision> {
    const request = this.#store.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }
    if (request.status === 'completed' || request.status === 'rejected') {
      throw new Error(`Request already ${request.status}: ${requestId}`)
    }

    const decision: ReviewDecision = {
      requestId,
      decision: 'approved',
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
    }

    if (params.comments !== undefined) {
      decision.comments = params.comments
    }
    if (params.conditions !== undefined) {
      decision.conditions = params.conditions
    }

    this.#store.createDecision(decision)
    this.#store.updateRequest(requestId, {
      status: 'completed',
      respondedBy: params.decidedBy,
      completedAt: new Date(),
      response: { approved: true, comments: params.comments, conditions: params.conditions },
    })

    return decision
  }

  /**
   * Reject a pending request
   */
  async reject(requestId: string, params: RejectParams): Promise<ReviewDecision> {
    const request = this.#store.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }
    if (request.status === 'completed' || request.status === 'rejected') {
      throw new Error(`Request already ${request.status}: ${requestId}`)
    }
    if (!params.reason || params.reason.trim() === '') {
      throw new Error('Rejection reason is required')
    }

    const decision: ReviewDecision = {
      requestId,
      decision: 'rejected',
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      comments: params.reason,
    }

    if (params.feedback !== undefined) {
      decision.feedback = params.feedback
    }

    this.#store.createDecision(decision)
    this.#store.updateRequest(requestId, {
      status: 'rejected',
      respondedBy: params.decidedBy,
      completedAt: new Date(),
      rejectionReason: params.reason,
      response: { approved: false, reason: params.reason, feedback: params.feedback },
    })

    return decision
  }

  /**
   * Escalate a request to a higher authority
   */
  async escalate(requestId: string, options: EscalationOptions): Promise<ReviewRequest> {
    const request = this.#store.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    const updates: Partial<ReviewRequest> = {
      status: 'escalated',
      escalatedTo: options.to,
      escalatedAt: new Date(),
    }

    if (options.priority !== undefined) {
      updates.priority = options.priority
    }

    return this.#store.updateRequest(requestId, updates)
  }

  /**
   * Get the review queue with optional filtering
   */
  async getQueue(options?: QueueOptions): Promise<ReviewRequest[]> {
    return this.#store.listRequests(options)
  }

  /**
   * Add feedback to a request
   */
  async addFeedback(params: AddFeedbackParams): Promise<ReviewFeedback> {
    const request = this.#store.getRequest(params.requestId)
    if (!request) {
      throw new Error(`Request not found: ${params.requestId}`)
    }
    if (!params.comments || params.comments.trim() === '') {
      throw new Error('Feedback comments are required')
    }
    if (params.rating !== undefined && (params.rating < 1 || params.rating > 5)) {
      throw new Error('Rating must be between 1 and 5')
    }

    const feedback: ReviewFeedback = {
      id: this.#store.generateId('fb'),
      requestId: params.requestId,
      feedbackBy: params.feedbackBy,
      feedbackAt: new Date(),
      comments: params.comments,
    }

    if (params.rating !== undefined) {
      feedback.rating = params.rating
    }
    if (params.suggestions !== undefined) {
      feedback.suggestions = params.suggestions
    }
    if (params.tags !== undefined) {
      feedback.tags = params.tags
    }

    return this.#store.addFeedback(feedback)
  }

  /**
   * Get the decision for a request
   */
  async getDecision(requestId: string): Promise<ReviewDecision | null> {
    return this.#store.getDecision(requestId)
  }

  /**
   * Get a request by ID
   */
  async getRequest(requestId: string): Promise<ReviewRequest | null> {
    return this.#store.getRequest(requestId)
  }

  /**
   * List all feedback for a request
   */
  async listFeedback(requestId: string): Promise<ReviewFeedback[]> {
    return this.#store.listFeedback(requestId)
  }

  /**
   * Update the status of a request
   */
  async updateStatus(
    requestId: string,
    status: ReviewRequestStatus,
    respondedBy?: string
  ): Promise<ReviewRequest> {
    const request = this.#store.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    const updates: Partial<ReviewRequest> = { status }
    if (respondedBy !== undefined) {
      updates.respondedBy = respondedBy
    }
    if (status === 'completed') {
      updates.completedAt = new Date()
    }

    return this.#store.updateRequest(requestId, updates)
  }

  /**
   * Assign a request to one or more users
   */
  async assign(requestId: string, assignee: string | string[]): Promise<ReviewRequest> {
    const request = this.#store.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    return this.#store.updateRequest(requestId, { assignee })
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    return this.#store.getStats()
  }
}

/**
 * HumanReviewWorker - WorkerEntrypoint for human review service
 *
 * Extends WorkerEntrypoint to provide RPC access to HumanReviewServiceCore.
 * The connect() method returns an RpcTarget that can be used via Service Bindings.
 *
 * Usage:
 * ```ts
 * // In another worker with a service binding
 * const service = env.HUMAN_REVIEW.connect()
 * const request = await service.requestReview({...})
 * ```
 */
export class HumanReviewWorker extends WorkerEntrypoint<Env> {
  /**
   * Returns an RpcTarget that provides human review service methods
   */
  connect(): HumanReviewServiceCore {
    // @ts-expect-error - this.env is provided by WorkerEntrypoint at runtime
    return new HumanReviewServiceCore(this.env)
  }
}

// Default export for wrangler
export default HumanReviewWorker
