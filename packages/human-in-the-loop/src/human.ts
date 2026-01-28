/**
 * Human-in-the-loop primitives implementation
 */

import type { Role, Team, Goal, KPI, OKR } from 'org.ai'
import type {
  Human as HumanType,
  HumanOptions,
  HumanStore,
  ApprovalRequest,
  ApprovalResponse,
  QuestionRequest,
  TaskRequest,
  DecisionRequest,
  ReviewRequest,
  ReviewResponse,
  Notification,
  ReviewQueue,
  EscalationPolicy,
  ApprovalWorkflow,
  Priority,
  HumanRequest,
  RetryOptions,
  CircuitBreakerOptions,
  SLAOptions,
} from './types.js'
import { InMemoryHumanStore } from './store.js'
import {
  HumanRetryPolicy,
  HumanCircuitBreaker,
  SLATracker,
  withRetry,
  type BackoffConfig,
} from './timeout-retry.js'

/**
 * Human-in-the-loop manager
 *
 * Provides primitives for integrating human oversight and intervention
 * in AI workflows.
 *
 * @example
 * ```ts
 * const human = Human({
 *   defaultTimeout: 3600000, // 1 hour
 *   autoEscalate: true,
 * })
 *
 * // Request approval
 * const approval = await human.approve({
 *   title: 'Deploy to production',
 *   description: 'Approve deployment of v2.0.0',
 *   subject: 'Production Deployment',
 *   assignee: 'tech-lead@example.com',
 *   priority: 'high',
 * })
 *
 * if (approval.approved) {
 *   await deploy()
 * }
 * ```
 */
export class HumanManager {
  private store: HumanStore
  private options: Required<Omit<HumanOptions, 'retry' | 'circuitBreaker' | 'sla'>> & {
    retry?: RetryOptions
    circuitBreaker?: CircuitBreakerOptions
    sla?: SLAOptions
  }
  private roles = new Map<string, Role>()
  private teams = new Map<string, Team>()
  private humans = new Map<string, HumanType>()
  private escalationPolicies = new Map<string, EscalationPolicy>()
  private workflows = new Map<string, ApprovalWorkflow>()

  // Timeout/Retry components
  private retryPolicy?: HumanRetryPolicy
  private circuitBreaker?: HumanCircuitBreaker
  private slaTracker?: SLATracker

  constructor(options: HumanOptions = {}) {
    this.store = options.store || new InMemoryHumanStore()
    this.options = {
      store: this.store,
      defaultTimeout: options.defaultTimeout || 0, // No timeout by default
      defaultPriority: options.defaultPriority || 'normal',
      escalationPolicies: options.escalationPolicies || [],
      autoEscalate: options.autoEscalate ?? false,
      retry: options.retry,
      circuitBreaker: options.circuitBreaker,
      sla: options.sla,
    }

    // Register escalation policies
    for (const policy of this.options.escalationPolicies) {
      this.escalationPolicies.set(policy.id, policy)
    }

    // Initialize retry/circuit breaker/SLA components
    this.initializeRetryComponents(options)
  }

  /**
   * Initialize timeout/retry components based on options
   */
  private initializeRetryComponents(options: HumanOptions): void {
    // Initialize retry policy
    if (options.retry) {
      this.retryPolicy = new HumanRetryPolicy({
        maxRetries: options.retry.maxRetries ?? 5,
        retryableErrors: options.retry.retryableErrors,
      })
    }

    // Initialize circuit breaker
    if (options.circuitBreaker) {
      this.circuitBreaker = new HumanCircuitBreaker({
        failureThreshold: options.circuitBreaker.failureThreshold ?? 5,
        resetTimeoutMs: options.circuitBreaker.resetTimeoutMs,
        halfOpenMaxAttempts: options.circuitBreaker.halfOpenMaxAttempts,
      })
    }

    // Initialize SLA tracker
    if (options.sla) {
      this.slaTracker = new SLATracker({
        deadlineMs: options.sla.deadlineMs,
        warningThresholdMs: options.sla.warningThresholdMs,
        tiers: options.sla.tiers,
        onWarning: (requestId, ctx) => {
          // Could be extended to emit events or call callbacks
          console.warn(`SLA warning for request ${requestId}: ${ctx.remainingMs}ms remaining`)
        },
        onViolation: (requestId, ctx) => {
          console.error(`SLA violated for request ${requestId}`)
        },
      })
    }
  }

  /**
   * Get the retry policy instance
   */
  getRetryPolicy(): HumanRetryPolicy | undefined {
    return this.retryPolicy
  }

  /**
   * Get the circuit breaker instance
   */
  getCircuitBreaker(): HumanCircuitBreaker | undefined {
    return this.circuitBreaker
  }

  /**
   * Get the SLA tracker instance
   */
  getSLATracker(): SLATracker | undefined {
    return this.slaTracker
  }

  /**
   * Define a role
   */
  defineRole(role: Role): Role {
    this.roles.set(role.id, role)
    return role
  }

  /**
   * Get a role by ID
   */
  getRole(id: string): Role | undefined {
    return this.roles.get(id)
  }

  /**
   * Define a team
   */
  defineTeam(team: Team): Team {
    this.teams.set(team.id, team)
    return team
  }

  /**
   * Get a team by ID
   */
  getTeam(id: string): Team | undefined {
    return this.teams.get(id)
  }

  /**
   * Register a human worker
   */
  registerHuman(human: HumanType): HumanType {
    this.humans.set(human.id, human)
    return human
  }

  /**
   * Get a human by ID
   */
  getHuman(id: string): HumanType | undefined {
    return this.humans.get(id)
  }

  /**
   * Request approval from a human
   *
   * @example
   * ```ts
   * const result = await human.approve({
   *   title: 'Approve expense',
   *   description: 'Employee expense claim for $150',
   *   subject: 'Expense Claim #1234',
   *   input: { amount: 150, category: 'Travel' },
   *   assignee: 'manager@example.com',
   *   priority: 'normal',
   * })
   * ```
   */
  async approve<TData = unknown>(params: {
    title: string
    description: string
    subject: string
    input: TData
    assignee?: string | string[]
    role?: string
    team?: string
    priority?: Priority
    timeout?: number
    escalatesTo?: string | string[]
    requiresApproval?: boolean
    approvers?: string[]
    metadata?: Record<string, unknown>
  }): Promise<ApprovalResponse> {
    const request = await this.store.create<ApprovalRequest<TData>>({
      type: 'approval',
      status: 'pending',
      title: params.title,
      description: params.description,
      subject: params.subject,
      input: params.input,
      assignee: params.assignee,
      role: params.role,
      team: params.team,
      priority: params.priority || this.options.defaultPriority,
      timeout: params.timeout || this.options.defaultTimeout,
      escalatesTo: params.escalatesTo,
      requiresApproval: params.requiresApproval ?? true,
      approvers: params.approvers,
      currentApproverIndex: 0,
      metadata: params.metadata,
    })

    // In a real implementation, this would:
    // 1. Send notification to assignee
    // 2. Wait for response (polling, webhook, or event)
    // 3. Handle timeout and escalation
    // 4. Return the response

    // For now, return the request ID as a placeholder
    return this.waitForResponse<ApprovalRequest<TData>, ApprovalResponse>(request)
  }

  /**
   * Ask a question to a human
   *
   * @example
   * ```ts
   * const answer = await human.ask({
   *   title: 'Product naming',
   *   question: 'What should we name the new feature?',
   *   context: { feature: 'AI Assistant' },
   *   assignee: 'product-manager@example.com',
   * })
   * ```
   */
  async ask(params: {
    title: string
    question: string
    context?: unknown
    assignee?: string | string[]
    role?: string
    team?: string
    priority?: Priority
    timeout?: number
    suggestions?: string[]
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const request = await this.store.create<QuestionRequest>({
      type: 'question',
      status: 'pending',
      title: params.title,
      description: params.question,
      question: params.question,
      input: { question: params.question, context: params.context },
      context: params.context,
      suggestions: params.suggestions,
      assignee: params.assignee,
      role: params.role,
      team: params.team,
      priority: params.priority || this.options.defaultPriority,
      timeout: params.timeout || this.options.defaultTimeout,
      metadata: params.metadata,
    })

    return this.waitForResponse<QuestionRequest, string>(request)
  }

  /**
   * Request a human to perform a task
   *
   * @example
   * ```ts
   * const result = await human.do({
   *   title: 'Review code',
   *   instructions: 'Review the PR and provide feedback',
   *   input: { prUrl: 'https://github.com/...' },
   *   assignee: 'senior-dev@example.com',
   * })
   * ```
   */
  async do<TInput = unknown, TOutput = unknown>(params: {
    title: string
    instructions: string
    input: TInput
    assignee?: string | string[]
    role?: string
    team?: string
    priority?: Priority
    timeout?: number
    tools?: any[]
    estimatedEffort?: string
    metadata?: Record<string, unknown>
  }): Promise<TOutput> {
    const request = await this.store.create<TaskRequest<TInput, TOutput>>({
      type: 'task',
      status: 'pending',
      title: params.title,
      description: params.instructions,
      instructions: params.instructions,
      input: params.input,
      assignee: params.assignee,
      role: params.role,
      team: params.team,
      priority: params.priority || this.options.defaultPriority,
      timeout: params.timeout || this.options.defaultTimeout,
      tools: params.tools,
      estimatedEffort: params.estimatedEffort,
      metadata: params.metadata,
    })

    return this.waitForResponse<TaskRequest<TInput, TOutput>, TOutput>(request)
  }

  /**
   * Request a human to make a decision
   *
   * @example
   * ```ts
   * const choice = await human.decide({
   *   title: 'Pick deployment strategy',
   *   options: ['blue-green', 'canary', 'rolling'],
   *   context: { risk: 'high', users: 100000 },
   *   assignee: 'devops-lead@example.com',
   * })
   * ```
   */
  async decide<TOptions extends string = string>(params: {
    title: string
    description?: string
    options: TOptions[]
    context?: unknown
    assignee?: string | string[]
    role?: string
    team?: string
    priority?: Priority
    timeout?: number
    criteria?: string[]
    metadata?: Record<string, unknown>
  }): Promise<TOptions> {
    const request = await this.store.create<DecisionRequest<TOptions>>({
      type: 'decision',
      status: 'pending',
      title: params.title,
      description: params.description || `Choose from: ${params.options.join(', ')}`,
      input: { options: params.options, context: params.context },
      options: params.options,
      context: params.context,
      criteria: params.criteria,
      assignee: params.assignee,
      role: params.role,
      team: params.team,
      priority: params.priority || this.options.defaultPriority,
      timeout: params.timeout || this.options.defaultTimeout,
      metadata: params.metadata,
    })

    return this.waitForResponse<DecisionRequest<TOptions>, TOptions>(request)
  }

  /**
   * Request a human to review content
   *
   * @example
   * ```ts
   * const review = await human.review({
   *   title: 'Review blog post',
   *   content: { title: 'My Post', body: '...' },
   *   reviewType: 'content',
   *   criteria: ['Grammar', 'Tone', 'Accuracy'],
   *   assignee: 'editor@example.com',
   * })
   * ```
   */
  async review<TContent = unknown>(params: {
    title: string
    description?: string
    content: TContent
    reviewType?: 'code' | 'content' | 'design' | 'data' | 'other'
    criteria?: string[]
    assignee?: string | string[]
    role?: string
    team?: string
    priority?: Priority
    timeout?: number
    metadata?: Record<string, unknown>
  }): Promise<ReviewResponse> {
    const request = await this.store.create<ReviewRequest<TContent>>({
      type: 'review',
      status: 'pending',
      title: params.title,
      description: params.description || `Review requested: ${params.reviewType || 'other'}`,
      input: params.content,
      content: params.content,
      reviewType: params.reviewType,
      criteria: params.criteria,
      assignee: params.assignee,
      role: params.role,
      team: params.team,
      priority: params.priority || this.options.defaultPriority,
      timeout: params.timeout || this.options.defaultTimeout,
      metadata: params.metadata,
    })

    return this.waitForResponse<ReviewRequest<TContent>, ReviewResponse>(request)
  }

  /**
   * Send a notification to a human
   *
   * @example
   * ```ts
   * await human.notify({
   *   type: 'info',
   *   title: 'Deployment complete',
   *   message: 'Version 2.0.0 deployed successfully',
   *   recipient: 'team@example.com',
   *   channels: ['slack', 'email'],
   * })
   * ```
   */
  async notify(params: {
    type: 'info' | 'warning' | 'error' | 'success'
    title: string
    message: string
    recipient: string | string[]
    channels?: ('slack' | 'email' | 'sms' | 'web')[]
    priority?: Priority
    data?: unknown
  }): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: params.type,
      title: params.title,
      message: params.message,
      recipient: params.recipient,
      channels: params.channels,
      priority: params.priority,
      data: params.data,
      createdAt: new Date(),
    }

    // In a real implementation, this would:
    // 1. Send the notification via specified channels
    // 2. Track delivery status
    // 3. Handle failures and retries

    return notification
  }

  /**
   * Get a review queue
   *
   * @example
   * ```ts
   * const queue = await human.getQueue({
   *   name: 'Pending Approvals',
   *   filters: {
   *     status: ['pending'],
   *     priority: ['high', 'critical'],
   *   },
   * })
   * ```
   */
  async getQueue(params: {
    name: string
    description?: string
    filters?: ReviewQueue['filters']
    sortBy?: 'createdAt' | 'priority' | 'updatedAt'
    sortDirection?: 'asc' | 'desc'
    limit?: number
  }): Promise<ReviewQueue> {
    const items = await this.store.list(params.filters, params.limit)

    return {
      id: `queue_${Date.now()}`,
      name: params.name,
      description: params.description,
      items,
      filters: params.filters,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
    }
  }

  /**
   * Get a request by ID
   */
  async getRequest<T extends HumanRequest = HumanRequest>(id: string): Promise<T | null> {
    return this.store.get<T>(id)
  }

  /**
   * Complete a request with a response
   */
  async completeRequest<T extends HumanRequest = HumanRequest>(
    id: string,
    response: T['response']
  ): Promise<T> {
    return this.store.complete<T>(id, response)
  }

  /**
   * Reject a request
   */
  async rejectRequest(id: string, reason: string): Promise<HumanRequest> {
    return this.store.reject(id, reason)
  }

  /**
   * Escalate a request
   */
  async escalateRequest(id: string, to: string): Promise<HumanRequest> {
    return this.store.escalate(id, to)
  }

  /**
   * Cancel a request
   */
  async cancelRequest(id: string): Promise<HumanRequest> {
    return this.store.cancel(id)
  }

  /**
   * Define or update goals
   */
  defineGoals(goals: Goal[]): Goal[] {
    // In a real implementation, this would persist goals
    return goals
  }

  /**
   * Track KPIs
   */
  trackKPIs(kpi: KPI): KPI {
    // In a real implementation, this would persist KPIs
    return kpi
  }

  /**
   * Define or update OKRs
   */
  defineOKRs(okr: OKR): OKR {
    // In a real implementation, this would persist OKRs
    return okr
  }

  /**
   * Create an approval workflow
   */
  createWorkflow(workflow: ApprovalWorkflow): ApprovalWorkflow {
    this.workflows.set(workflow.id, workflow)
    return workflow
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(id: string): ApprovalWorkflow | undefined {
    return this.workflows.get(id)
  }

  /**
   * Wait for a human response
   *
   * In a real implementation, this would:
   * 1. Poll the store for updates
   * 2. Listen for webhooks/events
   * 3. Handle timeouts and escalations
   * 4. Return the response when available
   *
   * For now, this throws an error to indicate manual completion is needed
   */
  private async waitForResponse<TRequest extends HumanRequest, TResponse>(
    request: TRequest
  ): Promise<TResponse> {
    // Check if there's a timeout
    if (request.timeout && request.timeout > 0) {
      // Set up timeout handler
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request ${request.id} timed out after ${request.timeout}ms`))
        }, request.timeout)
      })

      // Poll for completion
      const pollPromise = this.pollForCompletion<TRequest, TResponse>(request.id)

      // Race between timeout and completion
      try {
        return await Promise.race([pollPromise, timeoutPromise])
      } catch (error) {
        // On timeout, escalate if configured
        if (this.options.autoEscalate && request.escalatesTo) {
          const escalateTo = Array.isArray(request.escalatesTo)
            ? request.escalatesTo[0]
            : request.escalatesTo
          if (escalateTo) {
            await this.store.escalate(request.id, escalateTo)
          } else {
            await this.store.update(request.id, { status: 'timeout' })
          }
        } else {
          await this.store.update(request.id, { status: 'timeout' })
        }
        throw error
      }
    }

    // No timeout, just poll indefinitely
    return this.pollForCompletion<TRequest, TResponse>(request.id)
  }

  /**
   * Poll for request completion
   */
  private async pollForCompletion<TRequest extends HumanRequest, TResponse>(
    requestId: string
  ): Promise<TResponse> {
    // In a real implementation, use webhooks, WebSockets, or event emitters
    // This is a simplified polling implementation
    const pollInterval = 1000 // 1 second

    while (true) {
      const request = await this.store.get<TRequest>(requestId)

      if (!request) {
        throw new Error(`Request ${requestId} not found`)
      }

      if (request.status === 'completed' && request.response) {
        return request.response as TResponse
      }

      if (request.status === 'rejected') {
        throw new Error(`Request ${requestId} was rejected: ${request.rejectionReason}`)
      }

      if (request.status === 'cancelled') {
        throw new Error(`Request ${requestId} was cancelled`)
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  }
}

/**
 * Create a Human-in-the-loop manager instance
 *
 * @example
 * ```ts
 * import { Human } from 'human-in-the-loop'
 *
 * const human = Human({
 *   defaultTimeout: 3600000, // 1 hour
 *   autoEscalate: true,
 * })
 * ```
 */
export function Human(options?: HumanOptions): HumanManager {
  return new HumanManager(options)
}
