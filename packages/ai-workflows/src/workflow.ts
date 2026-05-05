/**
 * Unified Workflow API
 *
 * Usage:
 *   Workflow($ => {
 *     $.on.Customer.created(async (customer, $) => {
 *       $.log('Customer created', customer)
 *       await $.send('Email.welcome', { to: customer.email })
 *     })
 *
 *     $.every.Monday.at9am(async ($) => {
 *       $.log('Weekly standup reminder')
 *     })
 *   })
 */

import type {
  WorkflowContext,
  WorkflowState,
  WorkflowHistoryEntry,
  ScheduleHandler,
  WorkflowDefinition,
  WorkflowOptions,
  OnProxy,
  EveryProxy,
  EveryProxyTarget,
  ParsedEvent,
} from './types.js'
import {
  registerTimer,
  clearTimersForWorkflow,
  getTimerIdsForWorkflow,
  registerProcessCleanup,
} from './timer-registry.js'
import { createCronJob, stopCronJob, type CronJob } from './cron-scheduler.js'
import { toCron } from './every.js'
import { getLogger } from './logger.js'
import { createWorkflowRuntime, parseEvent as runtimeParseEvent } from './runtime.js'

/**
 * Parse event string into noun and event.
 * Re-exported from runtime.ts for backward compatibility — the canonical
 * implementation lives there because dispatch owns event-name parsing.
 */
export function parseEvent(event: string): ParsedEvent | null {
  return runtimeParseEvent(event)
}

/**
 * Workflow instance returned by Workflow()
 */
export interface WorkflowInstance {
  /** Workflow definition with captured handlers */
  definition: WorkflowDefinition
  /** Current state */
  state: WorkflowState
  /** The $ context */
  $: WorkflowContext
  /** Send an event */
  send: <T = unknown>(event: string, data: T) => Promise<void>
  /** Start the workflow (begin processing schedules) */
  start: () => Promise<void>
  /** Stop the workflow */
  stop: () => Promise<void>
  /** Destroy the workflow and clean up all resources */
  destroy: () => Promise<void>
  /** Dispose pattern for cleanup */
  dispose: () => void
  /** Symbol.dispose for using declaration support */
  [Symbol.dispose]: () => void
  /** Number of active timers */
  timerCount: number
  /** Get timer IDs for this workflow */
  getTimerIds: () => string[]
}

/**
 * Create a workflow with the $ context
 *
 * @example
 * ```ts
 * const workflow = Workflow($ => {
 *   $.on.Customer.created(async (customer, $) => {
 *     $.log('New customer:', customer.name)
 *     await $.send('Email.welcome', { to: customer.email })
 *   })
 *
 *   $.every.hour(async ($) => {
 *     $.log('Hourly check')
 *   })
 *
 *   $.every.Monday.at9am(async ($) => {
 *     $.log('Weekly standup')
 *   })
 *
 *   $.every('first Monday of the month', async ($) => {
 *     $.log('Monthly report')
 *   })
 * })
 *
 * await workflow.start()
 * await workflow.send('Customer.created', { name: 'John', email: 'john@example.com' })
 * ```
 */
// Counter for generating unique workflow IDs
let workflowCounter = 0

export function Workflow(
  setup: ($: WorkflowContext) => void,
  options: WorkflowOptions = {}
): WorkflowInstance {
  // Generate unique workflow ID
  const workflowId = `workflow-${++workflowCounter}-${Date.now()}`

  // Construct the runtime — it owns the $ contract end-to-end:
  // event registry, schedule registry, dispatch, history, and state. The
  // Workflow wrapper here is just a lifecycle shell around the runtime
  // (timers, cron jobs, dispose pattern).
  const runtime = createWorkflowRuntime({
    ...(options.context !== undefined && { context: options.context }),
    ...(options.db !== undefined && { db: options.db }),
    name: 'workflow',
  })

  const $ = runtime.$
  const state = runtime.state
  const eventRegistry = runtime.getEventRegistry()
  const scheduleRegistry = runtime.getScheduleRegistry()

  // Schedule timers (local reference, actual timers are in registry)
  let scheduleTimers: NodeJS.Timeout[] = []
  // Cron jobs for cron/natural schedules
  const cronJobs: CronJob[] = []

  /**
   * Append to workflow history (used by schedule firing below).
   */
  const addHistory = (entry: Omit<WorkflowHistoryEntry, 'timestamp'>) => {
    state.history.push({
      ...entry,
      timestamp: Date.now(),
    })
  }

  // Run setup to capture handlers via $.on / $.every (which delegate to the runtime).
  setup($)

  /**
   * Start schedule handlers
   */
  const startSchedules = async (): Promise<void> => {
    // Register process cleanup on first schedule start
    registerProcessCleanup()

    for (const schedule of scheduleRegistry) {
      const { interval, handler } = schedule

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
        case 'cron': {
          // Schedule using cron expression
          const cronExpression = interval.expression
          const job = createCronJob(
            cronExpression,
            async () => {
              try {
                addHistory({ type: 'schedule', name: interval.natural ?? `cron:${cronExpression}` })
                await handler($)
              } catch (error) {
                getLogger().error('[workflow] Cron schedule handler error:', error)
              }
            },
            {
              id: `${workflowId}-cron-${scheduleRegistry.indexOf(schedule)}`,
              onError: (error) => {
                getLogger().error('[workflow] Cron job error:', error)
              },
            }
          )
          cronJobs.push(job)
          break
        }
        case 'natural': {
          // Convert natural language to cron using toCron()
          // This may be async if AI converter is set
          const naturalDesc = interval.description
          toCron(naturalDesc)
            .then((cronExpression) => {
              const job = createCronJob(
                cronExpression,
                async () => {
                  try {
                    addHistory({ type: 'schedule', name: naturalDesc })
                    await handler($)
                  } catch (error) {
                    getLogger().error('[workflow] Natural schedule handler error:', error)
                  }
                },
                {
                  id: `${workflowId}-natural-${scheduleRegistry.indexOf(schedule)}`,
                  onError: (error) => {
                    getLogger().error('[workflow] Natural schedule job error:', error)
                  },
                }
              )
              cronJobs.push(job)
            })
            .catch((error) => {
              getLogger().error(
                `[workflow] Failed to parse natural schedule "${naturalDesc}":`,
                error
              )
            })
          break
        }
      }

      if (ms > 0) {
        // Get schedule name based on interval type
        const scheduleName =
          'natural' in interval && interval.natural ? interval.natural : interval.type
        const timer = setInterval(async () => {
          try {
            addHistory({ type: 'schedule', name: scheduleName })
            await handler($)
          } catch (error) {
            getLogger().error('[workflow] Schedule handler error:', error)
          }
        }, ms)
        scheduleTimers.push(timer)
        // Register timer with global registry for cleanup tracking
        registerTimer(workflowId, timer)
      }
    }
  }

  /**
   * Clean up all timers and resources
   */
  const cleanup = (): void => {
    // Clear via global registry (this also clears the intervals)
    clearTimersForWorkflow(workflowId)
    // Clear local references
    scheduleTimers = []
    // Stop all cron jobs
    for (const job of cronJobs) {
      stopCronJob(job)
    }
    cronJobs.length = 0
  }

  const instance: WorkflowInstance = {
    definition: {
      name: 'workflow',
      events: eventRegistry,
      schedules: scheduleRegistry,
      ...(options.context !== undefined && { initialContext: options.context }),
    },

    get state() {
      return state
    },

    $,

    async send<T = unknown>(event: string, data: T): Promise<void> {
      await $.send(event, data)
    },

    async start(): Promise<void> {
      getLogger().log(
        `[workflow] Starting with ${eventRegistry.length} event handlers and ${scheduleRegistry.length} schedules`
      )
      await startSchedules()
    },

    async stop(): Promise<void> {
      getLogger().log('[workflow] Stopping')
      cleanup()
    },

    async destroy(): Promise<void> {
      cleanup()
    },

    dispose(): void {
      cleanup()
    },

    [Symbol.dispose](): void {
      cleanup()
    },

    get timerCount(): number {
      return getTimerIdsForWorkflow(workflowId).length + cronJobs.filter((j) => !j.stopped).length
    },

    getTimerIds(): string[] {
      return getTimerIdsForWorkflow(workflowId)
    },
  }

  return instance
}

/**
 * Create an isolated $ context for testing
 */
export function createTestContext(): WorkflowContext & {
  emittedEvents: Array<{ event: string; data: unknown }>
} {
  const emittedEvents: Array<{ event: string; data: unknown }> = []
  const stateContext: Record<string, unknown> = {}
  const history: WorkflowHistoryEntry[] = []

  const $: WorkflowContext & { emittedEvents: Array<{ event: string; data: unknown }> } = {
    emittedEvents,

    track(event: string, data: unknown): void {
      // Fire and forget for testing - just record it
      emittedEvents.push({ event: `track:${event}`, data })
    },

    send<T = unknown>(event: string, data: T): string {
      const eventId = crypto.randomUUID()
      emittedEvents.push({ event, data: { ...(data as object), _eventId: eventId } })
      return eventId
    },

    async do<TData = unknown, TResult = unknown>(_event: string, _data: TData): Promise<TResult> {
      throw new Error('$.do not implemented in test context - register handlers via Workflow()')
    },

    async try<TData = unknown, TResult = unknown>(_event: string, _data: TData): Promise<TResult> {
      throw new Error('$.try not implemented in test context - register handlers via Workflow()')
    },

    on: new Proxy({} as OnProxy, {
      get() {
        return new Proxy(
          {},
          {
            get() {
              return () => {} // No-op for testing
            },
          }
        )
      },
    }),

    // Cast to EveryProxy is safe: Proxy handler implements all EveryProxy behaviors dynamically
    every: new Proxy(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ((_description: string, _handler: ScheduleHandler) => {}) as EveryProxyTarget,
      {
        get() {
          return () => () => {} // No-op for testing
        },
        apply() {},
      }
    ) as unknown as EveryProxy,

    state: stateContext,

    getState(): WorkflowState {
      return {
        context: { ...stateContext },
        history: [...history],
      }
    },

    set<T = unknown>(key: string, value: T): void {
      stateContext[key] = value
    },

    get<T = unknown>(key: string): T | undefined {
      return stateContext[key] as T | undefined
    },

    log(message: string, data?: unknown) {
      getLogger().log(`[test] ${message}`, data ?? '')
    },
  }

  return $
}

// Also export standalone on/every for import { on, every } usage
export { on, registerEventHandler, getEventHandlers, clearEventHandlers } from './on.js'
export {
  every,
  registerScheduleHandler,
  getScheduleHandlers,
  clearScheduleHandlers,
  toCron,
  intervalToMs,
  formatInterval,
  setCronConverter,
} from './every.js'
export { send } from './send.js'
