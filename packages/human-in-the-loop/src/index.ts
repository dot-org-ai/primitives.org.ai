/**
 * human-in-the-loop - Primitives for integrating human oversight and intervention in AI workflows
 *
 * This package provides primitives for human oversight and intervention in AI workflows:
 * - Approval gates and workflows
 * - Review processes and queues
 * - Escalation paths
 * - Human intervention points
 * - Role and team management
 * - Goals, KPIs, and OKRs tracking
 *
 * Implements the digital-workers interface for humans operating within a company boundary.
 *
 * @packageDocumentation
 * @example
 * ```ts
 * import { Human, approve, ask, notify } from 'human-in-the-loop'
 *
 * // Create a Human-in-the-loop manager
 * const human = Human({
 *   defaultTimeout: 3600000, // 1 hour
 *   autoEscalate: true,
 * })
 *
 * // Request approval
 * const result = await approve({
 *   title: 'Deploy to production',
 *   description: 'Approve deployment of v2.0.0',
 *   subject: 'Production Deployment',
 *   assignee: 'tech-lead@example.com',
 *   priority: 'high',
 * })
 *
 * if (result.approved) {
 *   await deploy()
 *   await notify({
 *     type: 'success',
 *     title: 'Deployment complete',
 *     message: 'v2.0.0 deployed to production',
 *     recipient: 'team@example.com',
 *   })
 * }
 * ```
 */

// Export main Human constructor and manager
export { Human, HumanManager } from './human.js'

// Export helper functions (convenience API)
export {
  Role,
  Team,
  Goals,
  approve,
  ask,
  do,
  decide,
  generate,
  is,
  notify,
  kpis,
  okrs,
  registerHuman,
  getDefaultHuman,
} from './helpers.js'

// Export store implementations
export { InMemoryHumanStore } from './store.js'

// Export all types
export type {
  // Status and enums
  HumanRequestStatus,
  Priority,

  // Core entities
  Role as RoleType,
  Team as TeamType,
  Human as HumanType,
  Goals as GoalsType,
  KPIs,
  OKRs,

  // Request types
  HumanRequest,
  ApprovalRequest,
  ApprovalResponse,
  QuestionRequest,
  TaskRequest,
  DecisionRequest,
  ReviewRequest,
  ReviewResponse,
  Notification,

  // Management
  ReviewQueue,
  EscalationPolicy,
  ApprovalWorkflow,

  // Store interface
  HumanStore,
  HumanOptions,
} from './types.js'
