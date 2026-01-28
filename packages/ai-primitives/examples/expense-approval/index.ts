/**
 * Expense Approval Example
 *
 * A complete human-in-the-loop workflow example demonstrating:
 *
 * 1. **Submit expense** - User submits an expense for approval
 * 2. **AI analyzes** - AI evaluates risk and determines if human review needed
 * 3. **Route to approver** - Send to human via Slack or Email
 * 4. **Human responds** - Approver approves/rejects via Slack/Email/Web
 * 5. **Complete workflow** - Final result with audit trail
 *
 * This example integrates:
 * - `ai-functions` for AI analysis
 * - `digital-workers` for routing and transports
 * - `human-in-the-loop` for approval management
 * - Slack/Email transports for notifications
 *
 * @example
 * ```ts
 * import { createExpenseWorkflow, type ExpenseSubmission } from '@ai-primitives/examples/expense-approval'
 *
 * // Create workflow
 * const workflow = createExpenseWorkflow({
 *   slackBotToken: process.env.SLACK_BOT_TOKEN,
 *   mockMode: false,
 * })
 *
 * // Submit expense
 * const expense: ExpenseSubmission = {
 *   id: 'exp-001',
 *   amountCents: 15000, // $150.00
 *   currency: 'USD',
 *   category: 'travel',
 *   description: 'Flight to NYC for client meeting',
 *   submittedBy: 'alice@company.com',
 *   submittedAt: new Date(),
 *   vendor: 'United Airlines',
 *   receipt: 'https://receipts.example.com/exp-001.pdf',
 * }
 *
 * // Run complete workflow
 * const result = await workflow.run(expense)
 * console.log(`Status: ${result.status}`)
 * console.log(`Approved by: ${result.approval?.approvedBy}`)
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Expense types
  ExpenseCategory,
  ExpenseSubmission,

  // Analysis types
  RiskLevel,
  SuggestedAction,
  ExpenseAnalysis,

  // Approval types
  ApprovalChannel,
  ApprovalResponse,

  // Workflow types
  WorkflowStatus,
  WorkflowEventType,
  WorkflowEvent,
  WorkflowResult,

  // Configuration types
  ExpensePolicy,
  DeliveryResult,
  ApprovalRequest,
} from './types.js'

// Export default policy
export { DEFAULT_EXPENSE_POLICY } from './types.js'

// =============================================================================
// Analyzer Exports
// =============================================================================

export {
  // Class
  ExpenseAnalyzer,
  // Factory
  createExpenseAnalyzer,
  // Convenience function
  analyzeExpense,
  // AI schema for future use
  EXPENSE_ANALYSIS_SCHEMA,
  // Types
  type ExpenseAnalyzerOptions,
} from './analyzer.js'

// =============================================================================
// Router Exports
// =============================================================================

export {
  // Class
  ApprovalRouter,
  // Factory
  createApprovalRouter,
  // Convenience function
  routeToApprover,
  // Types
  type ApprovalRouterConfig,
  type ApproverSelection,
} from './router.js'

// =============================================================================
// Workflow Exports
// =============================================================================

export {
  // Class
  ExpenseWorkflow,
  // Factory
  createExpenseWorkflow,
  // Mock client for testing
  createMockHumanApprovalClient,
  // Types
  type ExpenseWorkflowConfig,
} from './workflow.js'
