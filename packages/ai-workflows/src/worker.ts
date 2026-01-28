/**
 * Worker Export - WorkerEntrypoint for RPC access to AI Workflows
 *
 * Exposes workflow functionality via Cloudflare RPC.
 * Works both in Cloudflare Workers and standalone (for testing).
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "WORKFLOWS", "service": "ai-workflows" }
 *   ]
 * }
 *
 * // worker.ts - consuming service
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.WORKFLOWS.connect()
 *     const workflow = service.create('my-workflow', {
 *       context: { userId: '123' }
 *     })
 *     await workflow.emit('Customer.created', { name: 'John' })
 *     return Response.json({ status: 'ok' })
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'
import type {
  WorkflowContext,
  WorkflowState,
  WorkflowDefinition,
  WorkflowOptions,
  EventRegistration,
  ScheduleRegistration,
  ScheduleInterval,
  ParsedEvent,
} from './types.js'
import { Workflow, parseEvent, createTestContext } from './workflow.js'
import { registerEventHandler, getEventHandlers, clearEventHandlers } from './on.js'
import {
  registerScheduleHandler,
  getScheduleHandlers,
  clearScheduleHandlers,
  toCron,
  intervalToMs,
  formatInterval,
} from './every.js'
import { send, getEventBus } from './send.js'

/**
 * Environment bindings for the worker
 */
export interface Env {
  // Future: Add Durable Object binding for workflow persistence
  // WORKFLOW_DO?: DurableObjectNamespace
}

/**
 * Workflow instance info returned by the service
 */
export interface WorkflowInstanceInfo {
  id: string
  name: string
  state: WorkflowState
  eventCount: number
  scheduleCount: number
  started: boolean
}

/**
 * Global workflow registry for in-memory workflow instances
 * This enables workflow isolation and persistence across connect() calls in tests
 */
const workflowRegistry = new Map<
  string,
  {
    instance: ReturnType<typeof Workflow>
    name: string
    started: boolean
  }
>()

/**
 * Counter for generating unique workflow IDs
 */
let workflowIdCounter = 0

/**
 * Generate a unique workflow ID
 */
function generateWorkflowId(): string {
  return `wf-${++workflowIdCounter}-${Date.now()}`
}

/**
 * WorkflowServiceCore - RpcTarget wrapper around workflow functionality
 *
 * Exposes all required methods as RPC-callable methods.
 * This is the core service class that can be instantiated directly.
 */
export class WorkflowServiceCore extends RpcTarget {
  constructor() {
    super()
  }

  // ==================== Workflow Creation ====================

  /**
   * Create a new workflow instance
   *
   * @param name - Optional workflow name
   * @param options - Workflow options (initial context, etc.)
   * @returns Workflow instance info including ID
   */
  create(name?: string, options: WorkflowOptions = {}): WorkflowInstanceInfo {
    const id = generateWorkflowId()
    const workflowName = name ?? id

    // Create a basic workflow with empty setup
    // The actual handlers will be registered via registerEvent/registerSchedule
    const instance = Workflow(($) => {
      // Empty setup - handlers registered separately
    }, options)

    // Store in registry
    workflowRegistry.set(id, {
      instance,
      name: workflowName,
      started: false,
    })

    return {
      id,
      name: workflowName,
      state: instance.state,
      eventCount: instance.definition.events.length,
      scheduleCount: instance.definition.schedules.length,
      started: false,
    }
  }

  /**
   * Create a workflow with a definition function
   * The definition function receives the $ context for registering handlers
   *
   * @param setup - Setup function that receives $ context
   * @param options - Workflow options
   * @returns Workflow instance info
   */
  createWithSetup(
    setup: ($: WorkflowContext) => void,
    options: WorkflowOptions = {}
  ): WorkflowInstanceInfo {
    const id = generateWorkflowId()
    const instance = Workflow(setup, options)
    const workflowName = instance.definition.name

    workflowRegistry.set(id, {
      instance,
      name: workflowName,
      started: false,
    })

    return {
      id,
      name: workflowName,
      state: instance.state,
      eventCount: instance.definition.events.length,
      scheduleCount: instance.definition.schedules.length,
      started: false,
    }
  }

  // ==================== Workflow Lifecycle ====================

  /**
   * Start a workflow (begin processing schedules)
   *
   * @param workflowId - The workflow ID to start
   */
  async start(workflowId: string): Promise<void> {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    if (entry.started) {
      return // Already started
    }
    await entry.instance.start()
    entry.started = true
  }

  /**
   * Stop a workflow
   *
   * @param workflowId - The workflow ID to stop
   */
  async stop(workflowId: string): Promise<void> {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    await entry.instance.stop()
    entry.started = false
  }

  /**
   * Destroy a workflow and clean up resources
   *
   * @param workflowId - The workflow ID to destroy
   */
  async destroy(workflowId: string): Promise<void> {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    await entry.instance.destroy()
    workflowRegistry.delete(workflowId)
  }

  // ==================== Event Emission ====================

  /**
   * Send an event to a workflow
   *
   * @param workflowId - The workflow ID
   * @param event - Event name in Noun.event format (e.g., 'Customer.created')
   * @param data - Event data
   * @returns Event ID
   */
  emit<T = unknown>(workflowId: string, event: string, data: T): string {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    return entry.instance.$.send(event, data)
  }

  /**
   * Send an event using the global event bus (for standalone/testing)
   *
   * @param event - Event name
   * @param data - Event data
   */
  async sendGlobal<T = unknown>(event: string, data: T): Promise<void> {
    await send(event, data)
  }

  // ==================== State Management ====================

  /**
   * Get workflow state
   *
   * @param workflowId - The workflow ID
   * @returns Current workflow state
   */
  getState(workflowId: string): WorkflowState {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    return entry.instance.$.getState()
  }

  /**
   * Set a value in workflow context
   *
   * @param workflowId - The workflow ID
   * @param key - Context key
   * @param value - Value to set
   */
  setState<T = unknown>(workflowId: string, key: string, value: T): void {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    entry.instance.$.set(key, value)
  }

  /**
   * Get a value from workflow context
   *
   * @param workflowId - The workflow ID
   * @param key - Context key
   * @returns Value or undefined
   */
  getValue<T = unknown>(workflowId: string, key: string): T | undefined {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    return entry.instance.$.get<T>(key)
  }

  // ==================== Workflow Info ====================

  /**
   * Get workflow info
   *
   * @param workflowId - The workflow ID
   * @returns Workflow instance info
   */
  get(workflowId: string): WorkflowInstanceInfo | null {
    const entry = workflowRegistry.get(workflowId)
    if (!entry) {
      return null
    }
    return {
      id: workflowId,
      name: entry.name,
      state: entry.instance.state,
      eventCount: entry.instance.definition.events.length,
      scheduleCount: entry.instance.definition.schedules.length,
      started: entry.started,
    }
  }

  /**
   * List all workflow IDs
   *
   * @returns Array of workflow IDs
   */
  list(): string[] {
    return Array.from(workflowRegistry.keys())
  }

  /**
   * Check if a workflow exists
   *
   * @param workflowId - The workflow ID
   * @returns True if workflow exists
   */
  has(workflowId: string): boolean {
    return workflowRegistry.has(workflowId)
  }

  // ==================== Global Event Handlers ====================

  /**
   * Register a global event handler (for standalone usage)
   *
   * @param noun - Noun (e.g., 'Customer')
   * @param event - Event name (e.g., 'created')
   * @param handler - Handler function
   */
  registerGlobalEvent(
    noun: string,
    event: string,
    handler: (data: unknown, $: WorkflowContext) => void | Promise<void>
  ): void {
    registerEventHandler(noun, event, handler)
  }

  /**
   * Get all global event handlers
   *
   * @returns Array of event registrations
   */
  getGlobalEventHandlers(): EventRegistration[] {
    return getEventHandlers()
  }

  /**
   * Clear all global event handlers
   */
  clearGlobalEventHandlers(): void {
    clearEventHandlers()
  }

  // ==================== Global Schedule Handlers ====================

  /**
   * Register a global schedule handler (for standalone usage)
   *
   * @param interval - Schedule interval
   * @param handler - Handler function
   */
  registerGlobalSchedule(
    interval: ScheduleInterval,
    handler: ($: WorkflowContext) => void | Promise<void>
  ): void {
    registerScheduleHandler(interval, handler)
  }

  /**
   * Get all global schedule handlers
   *
   * @returns Array of schedule registrations
   */
  getGlobalScheduleHandlers(): ScheduleRegistration[] {
    return getScheduleHandlers()
  }

  /**
   * Clear all global schedule handlers
   */
  clearGlobalScheduleHandlers(): void {
    clearScheduleHandlers()
  }

  // ==================== Utilities ====================

  /**
   * Parse an event string into noun and event
   *
   * @param event - Event string (e.g., 'Customer.created')
   * @returns Parsed event or null if invalid
   */
  parseEvent(event: string): ParsedEvent | null {
    return parseEvent(event)
  }

  /**
   * Convert a natural language schedule description to cron expression
   *
   * @param description - Natural language description (e.g., 'every hour', 'every Monday')
   * @returns Cron expression
   */
  async toCron(description: string): Promise<string> {
    return toCron(description)
  }

  /**
   * Convert a schedule interval to milliseconds
   *
   * @param interval - Schedule interval
   * @returns Milliseconds
   */
  intervalToMs(interval: ScheduleInterval): number {
    return intervalToMs(interval)
  }

  /**
   * Format a schedule interval as a human-readable string
   *
   * @param interval - Schedule interval
   * @returns Formatted string
   */
  formatInterval(interval: ScheduleInterval): string {
    return formatInterval(interval)
  }

  /**
   * Create an isolated test context
   *
   * @returns Test context with emittedEvents tracking
   */
  createTestContext(): WorkflowContext & {
    emittedEvents: Array<{ event: string; data: unknown }>
  } {
    return createTestContext()
  }

  /**
   * Clear all workflows (for testing)
   */
  clear(): void {
    for (const [id, entry] of workflowRegistry) {
      entry.instance.destroy().catch(() => {})
    }
    workflowRegistry.clear()
    workflowIdCounter = 0
  }
}

/**
 * WorkflowService - WorkerEntrypoint for RPC access
 *
 * Provides `connect()` method that returns an RpcTarget service
 * with all workflow methods.
 *
 * @example
 * ```typescript
 * // In consuming worker
 * const service = env.WORKFLOWS.connect()
 * const workflow = service.create('my-workflow')
 * await service.start(workflow.id)
 * service.emit(workflow.id, 'Customer.created', { name: 'John' })
 * ```
 */
export class WorkflowService extends WorkerEntrypoint<Env> {
  /**
   * Connect to the workflow service and get an RPC-enabled service
   *
   * @returns WorkflowServiceCore instance for RPC calls
   */
  connect(): WorkflowServiceCore {
    return new WorkflowServiceCore()
  }
}

/**
 * Default export for Cloudflare Workers
 */
export default {
  fetch: () => new Response('ai-workflows worker - use RPC via service binding'),
}

// Export aliases
export { WorkflowService as WorkflowWorker }
