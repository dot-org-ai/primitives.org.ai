/**
 * Workflow runner with xstate state machine support
 */

import { createActor, type AnyActorLogic, type AnyEventObject, type Snapshot } from 'xstate'
import type {
  WorkflowDefinition,
  WorkflowRunnerOptions,
  WorkflowState,
  WorkflowContext,
  WorkflowStorage,
  WorkflowLogger,
  EventRegistration,
  ScheduleRegistration,
} from './types.js'
import { getEventHandlers, clearEventHandlers } from './on.js'
import { getScheduleHandlers, clearScheduleHandlers, toCron } from './every.js'
import { createWorkflowContext } from './context.js'
import { getEventBus } from './send.js'

/**
 * Default console logger
 */
const defaultLogger: WorkflowLogger = {
  debug: (msg, data) => console.debug(`[workflow] ${msg}`, data ?? ''),
  info: (msg, data) => console.info(`[workflow] ${msg}`, data ?? ''),
  warn: (msg, data) => console.warn(`[workflow] ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[workflow] ${msg}`, data ?? ''),
}

/**
 * Workflow instance
 */
export interface Workflow {
  /** Workflow name */
  name: string
  /** Current state */
  state: WorkflowState
  /** Send event to workflow */
  send: <T = unknown>(event: string, data: T) => Promise<void>
  /** Start the workflow */
  start: () => Promise<void>
  /** Stop the workflow */
  stop: () => Promise<void>
  /** Get current state machine snapshot (if using xstate) */
  getSnapshot: () => Snapshot<unknown> | null
}

/**
 * Create a workflow definition
 */
export function defineWorkflow(
  name: string,
  options?: {
    machine?: AnyActorLogic
    initialContext?: Record<string, unknown>
  }
): WorkflowDefinition {
  // Capture current handlers
  const events = getEventHandlers()
  const schedules = getScheduleHandlers()

  return {
    name,
    events,
    schedules,
    machine: options?.machine,
    initialContext: options?.initialContext,
  }
}

/**
 * Create and run a workflow
 */
export function createWorkflow(
  definition: WorkflowDefinition,
  options: WorkflowRunnerOptions = {}
): Workflow {
  const { storage, logger = defaultLogger } = options

  let state: WorkflowState = {
    context: { ...definition.initialContext },
    history: [],
  }

  let machineActor: ReturnType<typeof createActor> | null = null
  let scheduleTimers: NodeJS.Timeout[] = []

  // Create event bus context
  const eventBus = getEventBus()
  const ctx = createWorkflowContext(eventBus)

  // If using state machine
  if (definition.machine) {
    machineActor = createActor(definition.machine, {
      input: definition.initialContext,
    })
  }

  const workflow: Workflow = {
    name: definition.name,

    get state() {
      return state
    },

    async send<T = unknown>(event: string, data: T): Promise<void> {
      logger.debug(`Sending event: ${event}`, data)

      // Add to history
      state.history.push({
        timestamp: Date.now(),
        type: 'event',
        name: event,
        data,
      })

      // If using state machine, send to actor
      if (machineActor) {
        const parts = event.split('.')
        const machineEvent: AnyEventObject = {
          type: parts.length === 2 ? `${parts[0]}.${parts[1]}` : event,
          data,
        }
        machineActor.send(machineEvent)
      }

      // Also emit to global event bus for handlers
      await eventBus.emit(event, data)

      // Persist state if storage configured
      if (storage) {
        await storage.set(definition.name, state)
      }
    },

    async start(): Promise<void> {
      logger.info(`Starting workflow: ${definition.name}`)

      // Load persisted state if available
      if (storage) {
        const persisted = await storage.get(definition.name)
        if (persisted) {
          state = persisted
          logger.debug('Loaded persisted state')
        }
      }

      // Start state machine if configured
      if (machineActor) {
        machineActor.start()
        state.current = JSON.stringify(machineActor.getSnapshot().value)
      }

      // Start schedule handlers
      for (const schedule of definition.schedules) {
        await startSchedule(schedule, ctx, logger, scheduleTimers)
      }

      logger.info(`Workflow started with ${definition.events.length} event handlers and ${definition.schedules.length} schedules`)
    },

    async stop(): Promise<void> {
      logger.info(`Stopping workflow: ${definition.name}`)

      // Stop state machine
      if (machineActor) {
        machineActor.stop()
      }

      // Clear schedule timers
      for (const timer of scheduleTimers) {
        clearInterval(timer)
      }
      scheduleTimers = []

      // Persist final state
      if (storage) {
        await storage.set(definition.name, state)
      }
    },

    getSnapshot(): Snapshot<unknown> | null {
      return machineActor?.getSnapshot() ?? null
    },
  }

  return workflow
}

/**
 * Start a schedule handler
 */
async function startSchedule(
  schedule: ScheduleRegistration,
  ctx: WorkflowContext,
  logger: WorkflowLogger,
  timers: NodeJS.Timeout[]
): Promise<void> {
  const { interval, handler } = schedule

  // For simple intervals, use setInterval
  let ms = 0
  switch (interval.type) {
    case 'second':
      ms = (interval.value ?? 1) * 1000
      break
    case 'minute':
      ms = (interval.value ?? 1) * 60 * 1000
      break
    case 'hour':
      ms = (interval.value ?? 1) * 60 * 60 * 1000
      break
    case 'day':
      ms = (interval.value ?? 1) * 24 * 60 * 60 * 1000
      break
    case 'week':
      ms = (interval.value ?? 1) * 7 * 24 * 60 * 60 * 1000
      break
    case 'cron':
      // For cron, we'd need a cron parser - for now just log
      logger.warn(`Cron scheduling requires cron parser: ${interval.expression}`)
      return
    case 'natural':
      // Natural language needs AI conversion
      try {
        const cron = await toCron(interval.description)
        logger.info(`Converted "${interval.description}" to cron: ${cron}`)
        // Would need cron parser here too
      } catch (e) {
        logger.error(`Failed to convert natural schedule: ${interval.description}`)
      }
      return
  }

  if (ms > 0) {
    logger.debug(`Starting interval timer: ${ms}ms`)
    const timer = setInterval(async () => {
      try {
        await handler(ctx)
      } catch (error) {
        logger.error('Schedule handler error', error)
      }
    }, ms)
    timers.push(timer)
  }
}

/**
 * In-memory workflow storage (for development/testing)
 */
export function createMemoryStorage(): WorkflowStorage {
  const store = new Map<string, WorkflowState>()

  return {
    async get(workflowId: string): Promise<WorkflowState | null> {
      return store.get(workflowId) ?? null
    },
    async set(workflowId: string, state: WorkflowState): Promise<void> {
      store.set(workflowId, state)
    },
    async delete(workflowId: string): Promise<void> {
      store.delete(workflowId)
    },
  }
}

/**
 * Clear all registered handlers (useful for testing)
 */
export function clearAllHandlers(): void {
  clearEventHandlers()
  clearScheduleHandlers()
}
