/**
 * Human Approval E2E Test Suite
 *
 * End-to-end tests for full human-in-the-loop approval workflow.
 * This suite demonstrates the complete expense approval flow:
 *
 * 1. Submit expense for approval
 * 2. AI analyzes expense (valid/suspicious)
 * 3. Route to human approver via Slack/Email
 * 4. Human approves/rejects
 * 5. Workflow completes with result
 *
 * This suite is environment-agnostic -- the same tests run in
 * browser, node, and vitest-pool-workers.
 *
 * @see examples/expense-approval for reference implementation
 * @packageDocumentation
 */

import type { TestSuite, ClientFactory } from '../types.js'
import { testId, assertDefined, assertEqual, assertTrue, assertFalse, sleep } from '../helpers.js'

// =============================================================================
// Type Definitions for Human Approval Workflow
// =============================================================================

/**
 * Expense submission input
 */
export interface ExpenseSubmission {
  /** Unique expense ID */
  id: string
  /** Amount in cents to avoid floating point issues */
  amountCents: number
  /** Currency code (e.g., 'USD', 'EUR') */
  currency: string
  /** Expense category */
  category: 'travel' | 'meals' | 'supplies' | 'equipment' | 'services' | 'other'
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
}

/**
 * AI analysis result for expense
 */
export interface ExpenseAnalysis {
  /** Whether the expense appears valid */
  isValid: boolean
  /** Risk score (0-100, higher = more suspicious) */
  riskScore: number
  /** Risk level classification */
  riskLevel: 'low' | 'medium' | 'high'
  /** Flags for suspicious patterns */
  flags: string[]
  /** Whether human review is required */
  requiresHumanReview: boolean
  /** Suggested action */
  suggestedAction: 'auto_approve' | 'human_review' | 'auto_reject'
  /** Reason for the suggestion */
  reason: string
  /** Confidence score (0-1) */
  confidence: number
}

/**
 * Human approval response
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
  approvalChannel?: 'slack' | 'email' | 'web'
}

/**
 * Complete workflow result
 */
export interface WorkflowResult {
  /** Expense ID */
  expenseId: string
  /** Workflow status */
  status: 'approved' | 'rejected' | 'pending' | 'escalated' | 'cancelled'
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

/**
 * Workflow event for audit trail
 */
export interface WorkflowEvent {
  /** Event type */
  type: 'submitted' | 'analyzed' | 'routed' | 'approved' | 'rejected' | 'escalated'
  /** Event timestamp */
  timestamp: Date
  /** Actor (system, AI, or human ID) */
  actor: string
  /** Event details */
  details?: Record<string, unknown>
}

/**
 * Human approval client interface for E2E testing
 * This extends the base RPCClient with human-in-the-loop specific operations
 */
export interface HumanApprovalClient {
  /**
   * Submit an expense for approval
   */
  submitExpense(expense: ExpenseSubmission): Promise<{ requestId: string }>

  /**
   * Analyze an expense using AI
   */
  analyzeExpense(expense: ExpenseSubmission): Promise<ExpenseAnalysis>

  /**
   * Route approval request to human via specified channel
   */
  routeToApprover(
    requestId: string,
    expense: ExpenseSubmission,
    analysis: ExpenseAnalysis,
    channel: 'slack' | 'email' | 'web'
  ): Promise<{ delivered: boolean; messageId?: string }>

  /**
   * Simulate human response (for testing)
   * In production, this would come from webhook/polling
   */
  simulateHumanResponse(requestId: string, response: ApprovalResponse): Promise<void>

  /**
   * Get the current status of a request
   */
  getRequestStatus(requestId: string): Promise<WorkflowResult | null>

  /**
   * Complete the workflow and get final result
   */
  completeWorkflow(requestId: string): Promise<WorkflowResult>

  /**
   * Clear test data (for cleanup)
   */
  clear(): void
}

// =============================================================================
// Test Suite Factory
// =============================================================================

/**
 * Client factory type that includes human approval client
 */
export type HumanApprovalClientFactory = () => {
  humanApproval: HumanApprovalClient
}

/**
 * Create the Human Approval test suite
 *
 * This suite tests the complete human-in-the-loop workflow for expense approvals.
 * It demonstrates integration of:
 * - AI functions for expense analysis
 * - Digital workers for routing
 * - Human-in-the-loop for approvals
 * - Slack/Email transports for notifications
 */
export function createHumanApprovalTests(getClient: HumanApprovalClientFactory): TestSuite {
  let client: HumanApprovalClient

  // Sample expenses for testing
  const validExpense = (): ExpenseSubmission => ({
    id: testId('exp'),
    amountCents: 4500, // $45.00
    currency: 'USD',
    category: 'meals',
    description: 'Team lunch meeting with client',
    submittedBy: 'alice@company.com',
    submittedAt: new Date(),
    vendor: 'Restaurant ABC',
    project: 'CLIENT-001',
  })

  const suspiciousExpense = (): ExpenseSubmission => ({
    id: testId('exp'),
    amountCents: 999900, // $9,999.00 (just under $10k reporting threshold)
    currency: 'USD',
    category: 'equipment',
    description: 'Computer equipment',
    submittedBy: 'bob@company.com',
    submittedAt: new Date(),
    receipt: undefined, // Missing receipt for large expense
    vendor: undefined, // Missing vendor
  })

  const autoApproveExpense = (): ExpenseSubmission => ({
    id: testId('exp'),
    amountCents: 1500, // $15.00
    currency: 'USD',
    category: 'supplies',
    description: 'Office supplies - pens and notebooks',
    submittedBy: 'charlie@company.com',
    submittedAt: new Date(),
    vendor: 'Office Depot',
    receipt: 'receipt://od-12345',
  })

  return {
    name: 'Human Approval Workflow',

    beforeEach: async () => {
      client = getClient().humanApproval
      client.clear()
    },

    tests: [
      // =========================================================================
      // Step 1: Submit expense for approval
      // =========================================================================
      {
        name: 'should submit expense and receive request ID',
        fn: async () => {
          const expense = validExpense()
          const result = await client.submitExpense(expense)

          assertDefined(result, 'Should return submission result')
          assertDefined(result.requestId, 'Should have a request ID')
          assertTrue(result.requestId.length > 0, 'Request ID should not be empty')
        },
      },

      {
        name: 'should track submitted expense status',
        fn: async () => {
          const expense = validExpense()
          const { requestId } = await client.submitExpense(expense)

          const status = await client.getRequestStatus(requestId)

          assertDefined(status, 'Should have status')
          assertEqual(status.expenseId, expense.id)
          assertEqual(status.status, 'pending')
          assertTrue(status.auditTrail.length > 0, 'Should have audit trail')
          assertEqual(status.auditTrail[0].type, 'submitted')
        },
      },

      // =========================================================================
      // Step 2: AI analyzes expense (valid/suspicious)
      // =========================================================================
      {
        name: 'should analyze valid expense with low risk',
        fn: async () => {
          const expense = validExpense()
          const analysis = await client.analyzeExpense(expense)

          assertDefined(analysis, 'Should return analysis')
          assertTrue(analysis.isValid, 'Valid expense should be valid')
          assertEqual(analysis.riskLevel, 'low', 'Valid expense should have low risk')
          assertTrue(analysis.riskScore < 30, 'Risk score should be low')
          assertTrue(analysis.confidence > 0.7, 'Should have high confidence')
          assertEqual(analysis.flags.length, 0, 'Should have no flags')
        },
      },

      {
        name: 'should analyze suspicious expense with high risk',
        fn: async () => {
          const expense = suspiciousExpense()
          const analysis = await client.analyzeExpense(expense)

          assertDefined(analysis, 'Should return analysis')
          assertEqual(analysis.riskLevel, 'high', 'Suspicious expense should have high risk')
          assertTrue(analysis.riskScore >= 70, 'Risk score should be high')
          assertTrue(analysis.requiresHumanReview, 'Should require human review')
          assertTrue(analysis.flags.length > 0, 'Should have flags')
          assertEqual(analysis.suggestedAction, 'human_review', 'Should suggest human review')
        },
      },

      {
        name: 'should suggest auto-approve for low-value expenses',
        fn: async () => {
          const expense = autoApproveExpense()
          const analysis = await client.analyzeExpense(expense)

          assertDefined(analysis, 'Should return analysis')
          assertTrue(analysis.isValid, 'Should be valid')
          assertFalse(analysis.requiresHumanReview, 'Should not require human review')
          assertEqual(analysis.suggestedAction, 'auto_approve', 'Should suggest auto-approve')
        },
      },

      // =========================================================================
      // Step 3: Route to human approver via Slack/Email
      // =========================================================================
      {
        name: 'should route approval request via Slack',
        fn: async () => {
          const expense = suspiciousExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)

          const result = await client.routeToApprover(requestId, expense, analysis, 'slack')

          assertTrue(result.delivered, 'Should be delivered')
          assertDefined(result.messageId, 'Should have message ID')
        },
      },

      {
        name: 'should route approval request via Email',
        fn: async () => {
          const expense = suspiciousExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)

          const result = await client.routeToApprover(requestId, expense, analysis, 'email')

          assertTrue(result.delivered, 'Should be delivered')
          assertDefined(result.messageId, 'Should have message ID')
        },
      },

      {
        name: 'should record routing in audit trail',
        fn: async () => {
          const expense = suspiciousExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'slack')

          const status = await client.getRequestStatus(requestId)

          assertDefined(status, 'Should have status')
          const routedEvent = status.auditTrail.find((e) => e.type === 'routed')
          assertDefined(routedEvent, 'Should have routed event')
          assertEqual(routedEvent.details?.channel, 'slack', 'Should record channel')
        },
      },

      // =========================================================================
      // Step 4: Human approves/rejects
      // =========================================================================
      {
        name: 'should handle human approval',
        fn: async () => {
          const expense = validExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'slack')

          // Simulate human approving via Slack
          await client.simulateHumanResponse(requestId, {
            approved: true,
            approvedBy: 'manager@company.com',
            approvedAt: new Date(),
            comments: 'Looks good, approved.',
            approvalChannel: 'slack',
          })

          const status = await client.getRequestStatus(requestId)

          assertDefined(status, 'Should have status')
          assertDefined(status.approval, 'Should have approval')
          assertTrue(status.approval.approved, 'Should be approved')
          assertEqual(status.approval.approvedBy, 'manager@company.com')
          assertEqual(status.approval.approvalChannel, 'slack')
        },
      },

      {
        name: 'should handle human rejection',
        fn: async () => {
          const expense = suspiciousExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'email')

          // Simulate human rejecting via Email
          await client.simulateHumanResponse(requestId, {
            approved: false,
            approvedBy: 'cfo@company.com',
            approvedAt: new Date(),
            comments: 'Missing receipt and vendor information. Please resubmit.',
            approvalChannel: 'email',
          })

          const status = await client.getRequestStatus(requestId)

          assertDefined(status, 'Should have status')
          assertDefined(status.approval, 'Should have approval response')
          assertFalse(status.approval.approved, 'Should be rejected')
          assertTrue(
            (status.approval.comments ?? '').includes('Missing receipt'),
            'Should include rejection reason'
          )
        },
      },

      {
        name: 'should handle conditional approval',
        fn: async () => {
          const expense = validExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'web')

          // Simulate human approving with conditions
          await client.simulateHumanResponse(requestId, {
            approved: true,
            approvedBy: 'director@company.com',
            approvedAt: new Date(),
            comments: 'Approved with conditions',
            conditions: ['Upload receipt within 30 days', 'Confirm attendee list'],
            approvalChannel: 'web',
          })

          const status = await client.getRequestStatus(requestId)

          assertDefined(status?.approval, 'Should have approval')
          assertTrue(status.approval.approved, 'Should be approved')
          assertEqual(status.approval.conditions?.length, 2, 'Should have 2 conditions')
        },
      },

      // =========================================================================
      // Step 5: Workflow completes with result
      // =========================================================================
      {
        name: 'should complete workflow with approved status',
        fn: async () => {
          const expense = validExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'slack')
          await client.simulateHumanResponse(requestId, {
            approved: true,
            approvedBy: 'manager@company.com',
            approvedAt: new Date(),
            approvalChannel: 'slack',
          })

          const result = await client.completeWorkflow(requestId)

          assertDefined(result, 'Should return result')
          assertEqual(result.status, 'approved')
          assertDefined(result.analysis, 'Should include analysis')
          assertDefined(result.approval, 'Should include approval')
          assertDefined(result.completedAt, 'Should have completion time')
          assertTrue(result.processingTimeMs > 0, 'Should have processing time')
        },
      },

      {
        name: 'should complete workflow with rejected status',
        fn: async () => {
          const expense = suspiciousExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'email')
          await client.simulateHumanResponse(requestId, {
            approved: false,
            approvedBy: 'cfo@company.com',
            approvedAt: new Date(),
            comments: 'Rejected due to policy violation',
            approvalChannel: 'email',
          })

          const result = await client.completeWorkflow(requestId)

          assertEqual(result.status, 'rejected')
          assertDefined(result.approval, 'Should include rejection response')
          assertFalse(result.approval.approved, 'Should not be approved')
        },
      },

      {
        name: 'should auto-approve low-risk expenses',
        fn: async () => {
          const expense = autoApproveExpense()
          const { requestId } = await client.submitExpense(expense)

          // Complete workflow - should auto-approve without human
          const result = await client.completeWorkflow(requestId)

          assertEqual(result.status, 'approved', 'Should be auto-approved')
          assertEqual(result.analysis.suggestedAction, 'auto_approve')
          // No human approval for auto-approved expenses
          assertEqual(
            result.approval?.approvedBy,
            'system:auto-approve',
            'Should be system approved'
          )
        },
      },

      {
        name: 'should include complete audit trail',
        fn: async () => {
          const expense = validExpense()
          const { requestId } = await client.submitExpense(expense)
          const analysis = await client.analyzeExpense(expense)
          await client.routeToApprover(requestId, expense, analysis, 'slack')
          await client.simulateHumanResponse(requestId, {
            approved: true,
            approvedBy: 'manager@company.com',
            approvedAt: new Date(),
            approvalChannel: 'slack',
          })

          const result = await client.completeWorkflow(requestId)

          // Verify audit trail has all expected events
          const eventTypes = result.auditTrail.map((e) => e.type)
          assertTrue(eventTypes.includes('submitted'), 'Should have submitted event')
          assertTrue(eventTypes.includes('analyzed'), 'Should have analyzed event')
          assertTrue(eventTypes.includes('routed'), 'Should have routed event')
          assertTrue(eventTypes.includes('approved'), 'Should have approved event')

          // Verify events are in chronological order
          for (let i = 1; i < result.auditTrail.length; i++) {
            assertTrue(
              result.auditTrail[i].timestamp >= result.auditTrail[i - 1].timestamp,
              'Events should be in chronological order'
            )
          }
        },
      },

      // =========================================================================
      // Edge Cases and Error Handling
      // =========================================================================
      {
        name: 'should handle missing expense gracefully',
        fn: async () => {
          const status = await client.getRequestStatus('non-existent-id')
          assertEqual(status, null, 'Should return null for missing expense')
        },
      },

      {
        name: 'should handle duplicate submissions',
        fn: async () => {
          const expense = validExpense()
          const first = await client.submitExpense(expense)
          const second = await client.submitExpense(expense)

          // Should get different request IDs for same expense
          assertTrue(first.requestId !== second.requestId, 'Should create separate requests')
        },
      },

      {
        name: 'should measure processing time accurately',
        fn: async () => {
          const expense = autoApproveExpense()
          const { requestId } = await client.submitExpense(expense)

          // Add small delay to ensure measurable time
          await sleep(50)

          const result = await client.completeWorkflow(requestId)

          assertTrue(
            result.processingTimeMs >= 50,
            `Processing time should be at least 50ms, got ${result.processingTimeMs}ms`
          )
        },
      },
    ],
  }
}
