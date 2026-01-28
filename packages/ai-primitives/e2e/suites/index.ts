/**
 * E2E Test Suites Index
 *
 * Re-exports all test suite factories. Environment runners import from here
 * to register the shared, environment-agnostic test suites.
 *
 * @packageDocumentation
 */

export { createSmokeTests } from './smoke.suite.js'
export { createDatabaseTests } from './ai-database.suite.js'
export { createDigitalObjectsTests } from './digital-objects.suite.js'
export { createProvidersTests } from './ai-providers.suite.js'
export { createWorkflowsTests } from './workflows.suite.js'
export { createHumanApprovalTests } from './human-approval.suite.js'

// Export types for human-approval workflow
export type {
  ExpenseSubmission,
  ExpenseAnalysis,
  ApprovalResponse,
  WorkflowResult,
  WorkflowEvent,
  HumanApprovalClient,
  HumanApprovalClientFactory,
} from './human-approval.suite.js'
