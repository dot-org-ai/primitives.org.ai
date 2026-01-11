/**
 * ai-workflows - Event-driven workflows with $ context
 *
 * @example
 * ```ts
 * import { Workflow } from 'ai-workflows'
 *
 * // Create a workflow with $ context
 * const workflow = Workflow($ => {
 *   // Register event handlers
 *   $.on.Customer.created(async (customer, $) => {
 *     $.log('New customer:', customer.name)
 *     await $.send('Email.welcome', { to: customer.email })
 *   })
 *
 *   $.on.Order.completed(async (order, $) => {
 *     $.log('Order completed:', order.id)
 *   })
 *
 *   // Register scheduled tasks
 *   $.every.hour(async ($) => {
 *     $.log('Hourly check')
 *   })
 *
 *   $.every.Monday.at9am(async ($) => {
 *     $.log('Weekly standup reminder')
 *   })
 *
 *   $.every.minutes(30)(async ($) => {
 *     $.log('Every 30 minutes')
 *   })
 *
 *   // Natural language scheduling
 *   $.every('first Monday of the month', async ($) => {
 *     $.log('Monthly report')
 *   })
 * })
 *
 * // Start the workflow
 * await workflow.start()
 *
 * // Emit events
 * await workflow.send('Customer.created', { name: 'John', email: 'john@example.com' })
 * ```
 *
 * @example
 * // Alternative: Use standalone on/every for global registration
 * ```ts
 * import { on, every, send } from 'ai-workflows'
 *
 * on.Customer.created(async (customer, $) => {
 *   await $.send('Email.welcome', { to: customer.email })
 * })
 *
 * every.hour(async ($) => {
 *   $.log('Hourly task')
 * })
 *
 * await send('Customer.created', { name: 'John' })
 * ```
 */

// Main Workflow API
export { Workflow, createTestContext, parseEvent, type WorkflowInstance } from './workflow.js'

// Standalone event handling (for global registration)
export { on, registerEventHandler, getEventHandlers, clearEventHandlers } from './on.js'

// Standalone scheduling (for global registration)
export {
  every,
  registerScheduleHandler,
  getScheduleHandlers,
  clearScheduleHandlers,
  setCronConverter,
  toCron,
  intervalToMs,
  formatInterval,
} from './every.js'

// Event emission
export { send, getEventBus } from './send.js'

// Context
export { createWorkflowContext, createIsolatedContext } from './context.js'

// Cascade Context - Correlation IDs and step metadata
export {
  createCascadeContext,
  recordStep,
  withCascadeContext,
  type CascadeContext,
  type CascadeStep,
  type CascadeContextOptions,
  type SerializedCascadeContext,
  type SerializedCascadeStep,
  type TraceContext,
  type FiveWHEvent,
  type StepStatus,
} from './cascade-context.js'

// Dependency Graph
export {
  DependencyGraph,
  CircularDependencyError,
  MissingDependencyError,
  type GraphNode,
  type ParallelGroup,
  type GraphJSON,
  type EventRegistrationWithDeps,
} from './dependency-graph.js'

// Barrier/Join Semantics - Parallel step coordination
export {
  Barrier,
  BarrierTimeoutError,
  createBarrier,
  waitForAll,
  waitForAny,
  withConcurrencyLimit,
  type BarrierOptions,
  type BarrierProgress,
  type BarrierResult,
  type WaitForAllOptions,
  type WaitForAnyOptions,
  type WaitForAnyResult,
  type ConcurrencyOptions,
} from './barrier.js'

// Cascade Executor - code -> generative -> agentic -> human pattern
export {
  CascadeExecutor,
  CascadeTimeoutError,
  TierSkippedError,
  AllTiersFailedError,
  TIER_ORDER,
  DEFAULT_TIER_TIMEOUTS,
  type CapabilityTier,
  type TierHandler,
  type TierContext,
  type TierResult,
  type TierRetryConfig,
  type CascadeConfig,
  type CascadeResult,
  type CascadeMetrics,
  type SkipCondition,
} from './cascade-executor.js'

// Types
export type {
  EventHandler,
  ScheduleHandler,
  WorkflowContext,
  WorkflowState,
  WorkflowHistoryEntry,
  EventRegistration,
  ScheduleRegistration,
  ScheduleInterval,
  WorkflowDefinition,
  WorkflowOptions,
  ParsedEvent,
  OnProxy,
  EveryProxy,
  HandlerFunction,
  DatabaseContext,
  ActionData,
  ArtifactData,
  DependencyConfig,
  DependencyType,
} from './types.js'
