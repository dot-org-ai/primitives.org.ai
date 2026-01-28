/**
 * Approval Router
 *
 * Routes approval requests to the appropriate human approvers via
 * Slack or Email using digital-workers transports.
 *
 * The router:
 * - Determines the best approver based on expense category and amount
 * - Formats the request for the chosen transport (Slack/Email)
 * - Tracks delivery status
 * - Handles transport failures and fallbacks
 *
 * @example
 * ```ts
 * import { createApprovalRouter, routeToApprover } from './router'
 *
 * // Simple usage with mock transport
 * const result = await routeToApprover({
 *   requestId: 'req-001',
 *   expense,
 *   analysis,
 *   approvers: ['manager@company.com'],
 *   channel: 'slack',
 * })
 *
 * // With custom transports
 * const router = createApprovalRouter({
 *   slackBotToken: process.env.SLACK_BOT_TOKEN,
 *   emailApiKey: process.env.RESEND_API_KEY,
 * })
 * ```
 *
 * @packageDocumentation
 */

import type {
  ExpenseSubmission,
  ExpenseAnalysis,
  ApprovalRequest,
  DeliveryResult,
  ApprovalChannel,
  ExpensePolicy,
} from './types.js'
import { DEFAULT_EXPENSE_POLICY } from './types.js'

// =============================================================================
// Router Types
// =============================================================================

/**
 * Approval router configuration
 */
export interface ApprovalRouterConfig {
  /** Slack bot token (optional - uses mock if not provided) */
  slackBotToken?: string
  /** Slack signing secret */
  slackSigningSecret?: string
  /** Email API key (optional - uses mock if not provided) */
  emailApiKey?: string
  /** Default sender email */
  emailFrom?: string
  /** Expense policy for approver selection */
  policy?: Partial<ExpensePolicy>
  /** Base URL for approval web interface */
  approvalBaseUrl?: string
  /** Enable mock mode for testing */
  mockMode?: boolean
}

/**
 * Approver selection result
 */
export interface ApproverSelection {
  /** Selected approvers */
  approvers: string[]
  /** Reason for selection */
  reason: string
  /** Escalation chain if initial approvers don't respond */
  escalationChain?: string[]
}

// =============================================================================
// Approval Router Class
// =============================================================================

/**
 * Approval Router
 *
 * Routes expense approval requests to humans via Slack or Email.
 * Handles approver selection, message formatting, and delivery tracking.
 *
 * @example
 * ```ts
 * const router = new ApprovalRouter({
 *   slackBotToken: process.env.SLACK_BOT_TOKEN,
 *   mockMode: process.env.NODE_ENV === 'test',
 * })
 *
 * const result = await router.route({
 *   requestId: 'req-001',
 *   expense,
 *   analysis,
 *   approvers: ['manager@company.com'],
 *   channel: 'slack',
 * })
 * ```
 */
export class ApprovalRouter {
  private config: ApprovalRouterConfig
  private policy: ExpensePolicy
  private deliveryLog: Map<string, DeliveryResult>

  constructor(config: ApprovalRouterConfig = {}) {
    this.config = {
      mockMode: true, // Default to mock mode for safety
      ...config,
    }
    this.policy = {
      ...DEFAULT_EXPENSE_POLICY,
      ...config.policy,
    }
    this.deliveryLog = new Map()
  }

  /**
   * Route an approval request to the specified channel
   *
   * @param request - The approval request to route
   * @returns Delivery result
   */
  async route(request: ApprovalRequest): Promise<DeliveryResult> {
    // Step 1: Validate request
    this.validateRequest(request)

    // Step 2: Format message for the channel
    const formattedMessage = this.formatMessage(request)

    // Step 3: Send via appropriate transport
    let result: DeliveryResult

    if (this.config.mockMode) {
      // Mock delivery for testing
      result = this.mockDelivery(request.channel, request.requestId)
    } else {
      // Real delivery
      result = await this.deliver(request.channel, formattedMessage, request)
    }

    // Step 4: Log delivery
    this.deliveryLog.set(request.requestId, result)

    return result
  }

  /**
   * Select appropriate approvers based on expense details
   *
   * @param expense - The expense to find approvers for
   * @param analysis - The AI analysis result
   * @returns Approver selection with reasoning
   */
  selectApprovers(expense: ExpenseSubmission, analysis: ExpenseAnalysis): ApproverSelection {
    const approvers: string[] = []
    let reason = ''

    // High-risk expenses go to senior approvers
    if (analysis.riskLevel === 'high') {
      approvers.push('cfo@company.com')
      reason = 'High-risk expense requires CFO approval'
    }
    // High-value expenses need director approval
    else if (expense.amountCents >= 100000) {
      // $1000+
      approvers.push('director@company.com')
      reason = 'Expense over $1000 requires director approval'
    }
    // Equipment purchases need IT approval
    else if (expense.category === 'equipment') {
      approvers.push('it-manager@company.com')
      reason = 'Equipment purchases require IT manager approval'
    }
    // Default to manager
    else {
      approvers.push(...this.policy.defaultApprovers)
      reason = 'Standard expense routed to direct manager'
    }

    // Build escalation chain
    const escalationChain = this.buildEscalationChain(approvers)

    return { approvers, reason, escalationChain }
  }

  /**
   * Get delivery status for a request
   */
  getDeliveryStatus(requestId: string): DeliveryResult | undefined {
    return this.deliveryLog.get(requestId)
  }

  /**
   * Clear delivery log (for testing)
   */
  clearLog(): void {
    this.deliveryLog.clear()
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Validate approval request
   */
  private validateRequest(request: ApprovalRequest): void {
    if (!request.requestId) {
      throw new Error('Request ID is required')
    }
    if (!request.expense) {
      throw new Error('Expense is required')
    }
    if (!request.approvers.length) {
      throw new Error('At least one approver is required')
    }
    if (!['slack', 'email', 'web'].includes(request.channel)) {
      throw new Error(`Invalid channel: ${request.channel}`)
    }
  }

  /**
   * Format message for the channel
   */
  private formatMessage(request: ApprovalRequest): FormattedMessage {
    const { expense, analysis, requestId } = request
    const amount = `$${(expense.amountCents / 100).toFixed(2)} ${expense.currency}`

    // Build base message
    const subject = `Expense Approval Required: ${amount}`
    const body = this.buildMessageBody(expense, analysis)
    const actions = this.buildActions(requestId)

    return {
      subject,
      body,
      actions,
      metadata: {
        requestId,
        expenseId: expense.id,
        amount: expense.amountCents,
        category: expense.category,
        riskLevel: analysis.riskLevel,
      },
    }
  }

  /**
   * Build message body with expense details
   */
  private buildMessageBody(expense: ExpenseSubmission, analysis: ExpenseAnalysis): string {
    const amount = `$${(expense.amountCents / 100).toFixed(2)} ${expense.currency}`
    const lines = [
      `**Expense Approval Request**`,
      ``,
      `**Amount:** ${amount}`,
      `**Category:** ${expense.category}`,
      `**Description:** ${expense.description}`,
      `**Submitted by:** ${expense.submittedBy}`,
      `**Date:** ${expense.submittedAt.toLocaleDateString()}`,
    ]

    if (expense.vendor) {
      lines.push(`**Vendor:** ${expense.vendor}`)
    }
    if (expense.project) {
      lines.push(`**Project:** ${expense.project}`)
    }
    if (expense.receipt) {
      lines.push(`**Receipt:** ${expense.receipt}`)
    }

    // Add AI analysis summary
    lines.push(``)
    lines.push(`**AI Analysis:**`)
    lines.push(`- Risk Level: ${analysis.riskLevel.toUpperCase()}`)
    lines.push(`- Risk Score: ${analysis.riskScore}/100`)
    if (analysis.flags.length > 0) {
      lines.push(`- Flags: ${analysis.flags.join(', ')}`)
    }
    lines.push(`- Recommendation: ${analysis.reason}`)

    return lines.join('\n')
  }

  /**
   * Build approval/rejection actions
   */
  private buildActions(requestId: string): MessageAction[] {
    const baseUrl = this.config.approvalBaseUrl || 'https://approvals.example.com'

    return [
      {
        id: 'approve',
        label: 'Approve',
        style: 'primary',
        url: `${baseUrl}/${requestId}/approve`,
      },
      {
        id: 'reject',
        label: 'Reject',
        style: 'danger',
        url: `${baseUrl}/${requestId}/reject`,
      },
      {
        id: 'request_info',
        label: 'Request More Info',
        style: 'secondary',
        url: `${baseUrl}/${requestId}/info`,
      },
    ]
  }

  /**
   * Build escalation chain from initial approvers
   */
  private buildEscalationChain(initialApprovers: string[]): string[] {
    const chain: string[] = []

    // If not already including director, add them
    if (!initialApprovers.includes('director@company.com')) {
      chain.push('director@company.com')
    }

    // Always escalate to CFO if not already included
    if (!initialApprovers.includes('cfo@company.com')) {
      chain.push('cfo@company.com')
    }

    return chain
  }

  /**
   * Mock delivery for testing
   */
  private mockDelivery(channel: ApprovalChannel, requestId: string): DeliveryResult {
    // Simulate successful delivery
    return {
      success: true,
      messageId: `mock_${channel}_${requestId}_${Date.now()}`,
      transport: channel === 'web' ? 'email' : channel,
    }
  }

  /**
   * Deliver message via real transport
   */
  private async deliver(
    channel: ApprovalChannel,
    message: FormattedMessage,
    request: ApprovalRequest
  ): Promise<DeliveryResult> {
    // In a real implementation, this would use the actual transports:
    // - SlackTransport from digital-workers
    // - EmailTransport from digital-workers

    if (channel === 'slack') {
      return this.deliverViaSlack(message, request)
    } else if (channel === 'email') {
      return this.deliverViaEmail(message, request)
    } else {
      // Web channel - store for web UI polling
      return this.deliverViaWeb(message, request)
    }
  }

  /**
   * Deliver via Slack
   */
  private async deliverViaSlack(
    message: FormattedMessage,
    request: ApprovalRequest
  ): Promise<DeliveryResult> {
    // This would integrate with SlackTransport from digital-workers
    // For now, simulate the call

    try {
      // In production:
      // const slack = new SlackTransport({ botToken: this.config.slackBotToken })
      // return await slack.sendApprovalRequest(approver, message.body, { context: message.metadata })

      return {
        success: true,
        messageId: `slack_${Date.now()}`,
        transport: 'slack',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Slack delivery failed',
        transport: 'slack',
      }
    }
  }

  /**
   * Deliver via Email
   */
  private async deliverViaEmail(
    message: FormattedMessage,
    request: ApprovalRequest
  ): Promise<DeliveryResult> {
    // This would integrate with EmailTransport from digital-workers
    // For now, simulate the call

    try {
      // In production:
      // const email = new EmailTransport({ apiKey: this.config.emailApiKey })
      // return await email.sendApprovalRequest({ to: approvers, request: message.subject, ... })

      return {
        success: true,
        messageId: `email_${Date.now()}`,
        transport: 'email',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email delivery failed',
        transport: 'email',
      }
    }
  }

  /**
   * Store for web UI access
   */
  private async deliverViaWeb(
    message: FormattedMessage,
    request: ApprovalRequest
  ): Promise<DeliveryResult> {
    // Store in a queue for web UI to poll
    // In production, this would use a database or message queue

    return {
      success: true,
      messageId: `web_${Date.now()}`,
      transport: 'email', // Web uses email as fallback transport type
    }
  }
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Formatted message for delivery
 */
interface FormattedMessage {
  subject: string
  body: string
  actions: MessageAction[]
  metadata: Record<string, unknown>
}

/**
 * Message action button
 */
interface MessageAction {
  id: string
  label: string
  style: 'primary' | 'danger' | 'secondary'
  url: string
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an approval router with custom configuration
 *
 * @param config - Router configuration
 * @returns Configured approval router
 *
 * @example
 * ```ts
 * const router = createApprovalRouter({
 *   slackBotToken: process.env.SLACK_BOT_TOKEN,
 *   emailApiKey: process.env.RESEND_API_KEY,
 *   mockMode: false,
 * })
 * ```
 */
export function createApprovalRouter(config: ApprovalRouterConfig = {}): ApprovalRouter {
  return new ApprovalRouter(config)
}

/**
 * Route an approval request using default settings
 *
 * Convenience function for quick routing without creating a router.
 * Uses mock mode by default for safety.
 *
 * @param request - The approval request to route
 * @returns Delivery result
 *
 * @example
 * ```ts
 * const result = await routeToApprover({
 *   requestId: 'req-001',
 *   expense,
 *   analysis,
 *   approvers: ['manager@company.com'],
 *   channel: 'slack',
 * })
 * ```
 */
export async function routeToApprover(request: ApprovalRequest): Promise<DeliveryResult> {
  const router = createApprovalRouter({ mockMode: true })
  return router.route(request)
}
