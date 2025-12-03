/**
 * ai-workflows - Event-driven workflows with state machine support
 *
 * @example
 * ```ts
 * import { on, every, send, defineWorkflow, createWorkflow } from 'ai-workflows'
 *
 * // Register event handlers
 * on.Customer.created(async (customer, ctx) => {
 *   console.log('Customer created:', customer.name)
 *   await ctx.send('Email.welcome', { to: customer.email })
 * })
 *
 * on.Order.completed(async (order, ctx) => {
 *   console.log('Order completed:', order.id)
 * })
 *
 * // Register scheduled tasks
 * every.hour(async (ctx) => {
 *   console.log('Hourly task')
 * })
 *
 * every.Monday.at9am(async (ctx) => {
 *   console.log('Monday standup reminder')
 * })
 *
 * every.minutes(30)(async (ctx) => {
 *   console.log('Every 30 minutes')
 * })
 *
 * // Natural language scheduling (requires AI converter)
 * every('first Monday of the month at 9am', async (ctx) => {
 *   console.log('Monthly report')
 * })
 *
 * // Create and start workflow
 * const workflow = defineWorkflow('my-workflow')
 * const runner = createWorkflow(workflow)
 * await runner.start()
 *
 * // Emit events
 * await send('Customer.created', { id: '123', name: 'John', email: 'john@example.com' })
 * ```
 */

// Event handling
export { on, registerEventHandler, getEventHandlers, clearEventHandlers } from './on.js'

// Scheduling
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
export { send, parseEvent, getEventBus } from './send.js'

// Workflow context
export { createWorkflowContext, createIsolatedContext } from './context.js'

// Workflow runner
export {
  defineWorkflow,
  createWorkflow,
  createMemoryStorage,
  clearAllHandlers,
  type Workflow,
} from './workflow.js'

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
  WorkflowRunnerOptions,
  WorkflowStorage,
  WorkflowLogger,
  ParsedEvent,
} from './types.js'
