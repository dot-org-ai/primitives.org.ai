/**
 * Expense Approval Workflow
 *
 * Orchestrates the complete human-in-the-loop workflow for expense approvals:
 *
 * 1. Submit expense for approval
 * 2. AI analyzes expense (valid/suspicious)
 * 3. Route to human approver via Slack/Email
 * 4. Human approves/rejects
 * 5. Workflow completes with result
 *
 * This module integrates:
 * - ai-functions for AI analysis
 * - digital-workers for routing
 * - human-in-the-loop for approval management
 * - Slack/Email transports for notifications
 *
 * @example
 * ```ts
 * import { createExpenseWorkflow } from './workflow'
 *
 * const workflow = createExpenseWorkflow()
 *
 * // Submit expense
 * const { requestId } = await workflow.submit(expense)
 *
 * // Run full workflow (async)
 * const result = await workflow.run(expense)
 * console.log(`Status: ${result.status}`)
 * ```
 *
 * @packageDocumentation
 */

import type {
  ExpenseSubmission,
  ExpenseAnalysis,
  ApprovalResponse,
  WorkflowResult,
  WorkflowEvent,
  WorkflowStatus,
  ExpensePolicy,
  ApprovalChannel,
  DeliveryResult,
} from './types.js'
import { DEFAULT_EXPENSE_POLICY } from './types.js'
import { ExpenseAnalyzer, createExpenseAnalyzer } from './analyzer.js'
import { ApprovalRouter, createApprovalRouter } from './router.js'

// =============================================================================
// Workflow Types
// =============================================================================

/**
 * Expense workflow configuration
 */
export interface ExpenseWorkflowConfig {
  /** Expense policy for approval rules */
  policy?: Partial<ExpensePolicy>
  /** Preferred notification channel */
  defaultChannel?: ApprovalChannel
  /** Enable mock mode for testing */
  mockMode?: boolean
  /** Slack bot token */
  slackBotToken?: string
  /** Email API key */
  emailApiKey?: string
  /** Callback for workflow events */
  onEvent?: (event: WorkflowEvent) => void
}

/**
 * Pending request state
 */
interface PendingRequest {
  /** Request ID */
  requestId: string
  /** Original expense */
  expense: ExpenseSubmission
  /** AI analysis */
  analysis?: ExpenseAnalysis
  /** Human approval response */
  approval?: ApprovalResponse
  /** Current status */
  status: WorkflowStatus
  /** Audit trail */
  auditTrail: WorkflowEvent[]
  /** Start time for processing time calculation */
  startTime: number
  /** Delivery result */
  delivery?: DeliveryResult
}

// =============================================================================
// Expense Workflow Class
// =============================================================================

/**
 * Expense Approval Workflow
 *
 * Orchestrates the complete human-in-the-loop workflow for expense approvals.
 * Manages state, coordinates components, and maintains audit trail.
 *
 * @example
 * ```ts
 * const workflow = new ExpenseWorkflow()
 *
 * // Submit and process expense
 * const { requestId } = await workflow.submit(expense)
 * const analysis = await workflow.analyze(requestId)
 *
 * // Route to approver
 * await workflow.routeToApprover(requestId, 'slack')
 *
 * // Handle response (from webhook/polling)
 * await workflow.handleResponse(requestId, { approved: true, ... })
 *
 * // Complete and get result
 * const result = await workflow.complete(requestId)
 * ```
 */
export class ExpenseWorkflow {
  private config: ExpenseWorkflowConfig
  private policy: ExpensePolicy
  private analyzer: ExpenseAnalyzer
  private router: ApprovalRouter
  private requests: Map<string, PendingRequest>
  private requestIdCounter: number

  constructor(config: ExpenseWorkflowConfig = {}) {
    this.config = {
      mockMode: true,
      defaultChannel: 'slack',
      ...config,
    }

    this.policy = {
      ...DEFAULT_EXPENSE_POLICY,
      ...config.policy,
    }

    // Initialize components
    this.analyzer = createExpenseAnalyzer({ policy: config.policy })
    this.router = createApprovalRouter({
      mockMode: config.mockMode,
      slackBotToken: config.slackBotToken,
      emailApiKey: config.emailApiKey,
    })

    this.requests = new Map()
    this.requestIdCounter = 0
  }

  // ===========================================================================
  // Step 1: Submit Expense
  // ===========================================================================

  /**
   * Submit an expense for approval
   *
   * Creates a new workflow request and records the submission event.
   *
   * @param expense - The expense to submit
   * @returns Object containing the request ID
   */
  async submit(expense: ExpenseSubmission): Promise<{ requestId: string }> {
    // Generate unique request ID
    const requestId = this.generateRequestId()

    // Create pending request
    const request: PendingRequest = {
      requestId,
      expense,
      status: 'pending',
      auditTrail: [],
      startTime: Date.now(),
    }

    // Record submission event
    this.addEvent(request, 'submitted', expense.submittedBy, {
      expenseId: expense.id,
      amount: expense.amountCents,
      category: expense.category,
    })

    // Store request
    this.requests.set(requestId, request)

    return { requestId }
  }

  // ===========================================================================
  // Step 2: AI Analysis
  // ===========================================================================

  /**
   * Analyze an expense using AI
   *
   * Runs the expense through the analyzer to determine risk level
   * and whether human review is required.
   *
   * @param requestId - The request ID to analyze
   * @returns Analysis result
   */
  async analyze(requestId: string): Promise<ExpenseAnalysis> {
    const request = this.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    // Update status
    request.status = 'analyzing'

    // Run analysis
    const analysis = await this.analyzer.analyze(request.expense)

    // Store analysis result
    request.analysis = analysis

    // Record analysis event
    this.addEvent(request, 'analyzed', 'system:ai-analyzer', {
      riskLevel: analysis.riskLevel,
      riskScore: analysis.riskScore,
      suggestedAction: analysis.suggestedAction,
      flags: analysis.flags,
    })

    // Update status based on analysis
    if (analysis.suggestedAction === 'auto_approve') {
      // Will be auto-approved when completed
      request.status = 'pending'
    } else if (analysis.suggestedAction === 'auto_reject') {
      request.status = 'rejected'
    } else {
      request.status = 'awaiting_approval'
    }

    return analysis
  }

  // ===========================================================================
  // Step 3: Route to Approver
  // ===========================================================================

  /**
   * Route approval request to human via specified channel
   *
   * Sends the expense details and analysis to the appropriate approver(s)
   * via Slack or Email.
   *
   * @param requestId - The request ID to route
   * @param channel - Channel to use (slack, email)
   * @returns Delivery result
   */
  async routeToApprover(
    requestId: string,
    channel: ApprovalChannel = this.config.defaultChannel || 'slack'
  ): Promise<DeliveryResult> {
    const request = this.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }
    if (!request.analysis) {
      throw new Error(`Request not analyzed: ${requestId}`)
    }

    // Select approvers based on expense and analysis
    const { approvers, reason } = this.router.selectApprovers(request.expense, request.analysis)

    // Route to approvers
    const result = await this.router.route({
      requestId,
      expense: request.expense,
      analysis: request.analysis,
      approvers,
      channel,
    })

    // Store delivery result
    request.delivery = result

    // Record routing event
    this.addEvent(request, 'routed', 'system:router', {
      channel,
      approvers,
      reason,
      delivered: result.success,
      messageId: result.messageId,
    })

    return result
  }

  // ===========================================================================
  // Step 4: Handle Human Response
  // ===========================================================================

  /**
   * Handle human approval/rejection response
   *
   * Called when a human responds to the approval request
   * (via Slack button, email reply, or web UI).
   *
   * @param requestId - The request ID
   * @param response - The approval response
   */
  async handleResponse(requestId: string, response: ApprovalResponse): Promise<void> {
    const request = this.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    // Store approval response
    request.approval = response

    // Record approval/rejection event
    const eventType = response.approved ? 'approved' : 'rejected'
    this.addEvent(request, eventType, response.approvedBy || 'unknown', {
      approved: response.approved,
      comments: response.comments,
      conditions: response.conditions,
      channel: response.approvalChannel,
    })

    // Update status
    request.status = response.approved ? 'approved' : 'rejected'
  }

  // ===========================================================================
  // Step 5: Complete Workflow
  // ===========================================================================

  /**
   * Complete the workflow and get final result
   *
   * Finalizes the workflow, applying auto-approval rules if applicable,
   * and returns the complete result with audit trail.
   *
   * @param requestId - The request ID to complete
   * @returns Final workflow result
   */
  async complete(requestId: string): Promise<WorkflowResult> {
    const request = this.getRequest(requestId)
    if (!request) {
      throw new Error(`Request not found: ${requestId}`)
    }

    // Ensure analysis exists
    if (!request.analysis) {
      request.analysis = await this.analyze(requestId)
    }

    // Handle auto-approval for low-risk expenses
    if (request.analysis.suggestedAction === 'auto_approve' && !request.approval) {
      request.approval = {
        approved: true,
        approvedBy: 'system:auto-approve',
        approvedAt: new Date(),
        comments: `Auto-approved: ${request.analysis.reason}`,
        approvalChannel: 'web',
      }
      request.status = 'approved'

      this.addEvent(request, 'approved', 'system:auto-approve', {
        autoApproved: true,
        reason: request.analysis.reason,
      })
    }

    // Handle auto-rejection for high-risk expenses
    if (request.analysis.suggestedAction === 'auto_reject' && !request.approval) {
      request.approval = {
        approved: false,
        approvedBy: 'system:auto-reject',
        approvedAt: new Date(),
        comments: `Auto-rejected: ${request.analysis.reason}`,
        approvalChannel: 'web',
      }
      request.status = 'rejected'

      this.addEvent(request, 'rejected', 'system:auto-reject', {
        autoRejected: true,
        reason: request.analysis.reason,
      })
    }

    // Calculate processing time
    const processingTimeMs = Date.now() - request.startTime

    // Build final result
    const result: WorkflowResult = {
      expenseId: request.expense.id,
      status: request.status,
      analysis: request.analysis,
      approval: request.approval,
      completedAt: new Date(),
      processingTimeMs,
      auditTrail: [...request.auditTrail],
    }

    return result
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Run the complete workflow for an expense
   *
   * This is a convenience method that runs all steps in sequence.
   * For testing, you may want to call individual steps.
   *
   * @param expense - The expense to process
   * @param options - Optional overrides
   * @returns Final workflow result
   */
  async run(
    expense: ExpenseSubmission,
    options: { channel?: ApprovalChannel; simulateApproval?: ApprovalResponse } = {}
  ): Promise<WorkflowResult> {
    // Step 1: Submit
    const { requestId } = await this.submit(expense)

    // Step 2: Analyze
    const analysis = await this.analyze(requestId)

    // Step 3: Route if human review needed
    if (analysis.requiresHumanReview) {
      await this.routeToApprover(requestId, options.channel || this.config.defaultChannel)

      // Step 4: Handle response (simulated for testing)
      if (options.simulateApproval) {
        await this.handleResponse(requestId, options.simulateApproval)
      }
    }

    // Step 5: Complete
    return this.complete(requestId)
  }

  /**
   * Get current status of a request
   *
   * @param requestId - The request ID
   * @returns Current workflow result or null
   */
  getStatus(requestId: string): WorkflowResult | null {
    const request = this.getRequest(requestId)
    if (!request) {
      return null
    }

    return {
      expenseId: request.expense.id,
      status: request.status,
      analysis: request.analysis || {
        isValid: true,
        riskScore: 0,
        riskLevel: 'low',
        flags: [],
        requiresHumanReview: false,
        suggestedAction: 'auto_approve',
        reason: 'Pending analysis',
        confidence: 0,
      },
      approval: request.approval,
      processingTimeMs: Date.now() - request.startTime,
      auditTrail: [...request.auditTrail],
    }
  }

  /**
   * Clear all requests (for testing)
   */
  clear(): void {
    this.requests.clear()
    this.router.clearLog()
    this.requestIdCounter = 0
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get request by ID
   */
  private getRequest(requestId: string): PendingRequest | undefined {
    return this.requests.get(requestId)
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`
  }

  /**
   * Add event to audit trail
   */
  private addEvent(
    request: PendingRequest,
    type: WorkflowEvent['type'],
    actor: string,
    details?: Record<string, unknown>
  ): void {
    const event: WorkflowEvent = {
      type,
      timestamp: new Date(),
      actor,
      details,
    }

    request.auditTrail.push(event)

    // Notify callback if configured
    if (this.config.onEvent) {
      this.config.onEvent(event)
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an expense workflow with custom configuration
 *
 * @param config - Workflow configuration
 * @returns Configured expense workflow
 *
 * @example
 * ```ts
 * const workflow = createExpenseWorkflow({
 *   mockMode: false,
 *   slackBotToken: process.env.SLACK_BOT_TOKEN,
 *   defaultChannel: 'slack',
 *   onEvent: (event) => console.log(`Event: ${event.type}`),
 * })
 * ```
 */
export function createExpenseWorkflow(config: ExpenseWorkflowConfig = {}): ExpenseWorkflow {
  return new ExpenseWorkflow(config)
}

// =============================================================================
// Mock Client for E2E Testing
// =============================================================================

/**
 * Create a mock human approval client for E2E testing
 *
 * This client wraps the ExpenseWorkflow and provides the interface
 * expected by the human-approval E2E test suite.
 *
 * @returns HumanApprovalClient implementation
 */
export function createMockHumanApprovalClient() {
  const workflow = createExpenseWorkflow({ mockMode: true })

  return {
    async submitExpense(expense: ExpenseSubmission) {
      return workflow.submit(expense)
    },

    async analyzeExpense(expense: ExpenseSubmission) {
      const { requestId } = await workflow.submit(expense)
      return workflow.analyze(requestId)
    },

    async routeToApprover(
      requestId: string,
      expense: ExpenseSubmission,
      analysis: ExpenseAnalysis,
      channel: 'slack' | 'email'
    ) {
      // Ensure request exists and has analysis
      const status = workflow.getStatus(requestId)
      if (!status) {
        // Create request with analysis
        await workflow.submit(expense)
        await workflow.analyze(requestId)
      }
      const result = await workflow.routeToApprover(requestId, channel)
      return { delivered: result.success, messageId: result.messageId }
    },

    async simulateHumanResponse(requestId: string, response: ApprovalResponse) {
      await workflow.handleResponse(requestId, response)
    },

    getRequestStatus(requestId: string) {
      return Promise.resolve(workflow.getStatus(requestId))
    },

    async completeWorkflow(requestId: string) {
      return workflow.complete(requestId)
    },

    clear() {
      workflow.clear()
    },
  }
}
