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
  EventHandler,
  ScheduleHandler,
  EventRegistration,
  ScheduleRegistration,
  ScheduleInterval,
  WorkflowDefinition,
  WorkflowOptions,
  OnProxy,
  EveryProxy,
  EveryProxyTarget,
  ParsedEvent,
  DatabaseContext,
} from './types.js'
import { PLURAL_UNITS, isPluralUnitKey } from './types.js'

/**
 * Well-known cron patterns for common schedules
 */
const KNOWN_PATTERNS: Record<string, string> = {
  second: '* * * * * *',
  minute: '* * * * *',
  hour: '0 * * * *',
  day: '0 0 * * *',
  week: '0 0 * * 0',
  month: '0 0 1 * *',
  year: '0 0 1 1 *',
  Monday: '0 0 * * 1',
  Tuesday: '0 0 * * 2',
  Wednesday: '0 0 * * 3',
  Thursday: '0 0 * * 4',
  Friday: '0 0 * * 5',
  Saturday: '0 0 * * 6',
  Sunday: '0 0 * * 0',
  weekday: '0 0 * * 1-5',
  weekend: '0 0 * * 0,6',
  midnight: '0 0 * * *',
  noon: '0 12 * * *',
}

/**
 * Time suffixes for day-based schedules
 */
const TIME_PATTERNS: Record<string, { hour: number; minute: number }> = {
  at6am: { hour: 6, minute: 0 },
  at7am: { hour: 7, minute: 0 },
  at8am: { hour: 8, minute: 0 },
  at9am: { hour: 9, minute: 0 },
  at10am: { hour: 10, minute: 0 },
  at11am: { hour: 11, minute: 0 },
  at12pm: { hour: 12, minute: 0 },
  atnoon: { hour: 12, minute: 0 },
  at1pm: { hour: 13, minute: 0 },
  at2pm: { hour: 14, minute: 0 },
  at3pm: { hour: 15, minute: 0 },
  at4pm: { hour: 16, minute: 0 },
  at5pm: { hour: 17, minute: 0 },
  at6pm: { hour: 18, minute: 0 },
  at7pm: { hour: 19, minute: 0 },
  at8pm: { hour: 20, minute: 0 },
  at9pm: { hour: 21, minute: 0 },
  atmidnight: { hour: 0, minute: 0 },
}

/**
 * Combine a day pattern with a time pattern
 */
function combineWithTime(baseCron: string, time: { hour: number; minute: number }): string {
  const parts = baseCron.split(' ')
  parts[0] = String(time.minute)
  parts[1] = String(time.hour)
  return parts.join(' ')
}

/**
 * Parse event string into noun and event
 */
export function parseEvent(event: string): ParsedEvent | null {
  const parts = event.split('.')
  if (parts.length !== 2) {
    return null
  }
  const [noun, eventName] = parts
  if (!noun || !eventName) {
    return null
  }
  return { noun, event: eventName }
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
export function Workflow(
  setup: ($: WorkflowContext) => void,
  options: WorkflowOptions = {}
): WorkflowInstance {
  // Registries for handlers captured during setup
  const eventRegistry: EventRegistration[] = []
  const scheduleRegistry: ScheduleRegistration[] = []

  // State
  const state: WorkflowState = {
    context: { ...options.context },
    history: [],
  }

  // Schedule timers
  let scheduleTimers: NodeJS.Timeout[] = []

  /**
   * Add to history
   */
  const addHistory = (entry: Omit<WorkflowHistoryEntry, 'timestamp'>) => {
    state.history.push({
      ...entry,
      timestamp: Date.now(),
    })
  }

  /**
   * Register an event handler
   */
  const registerEventHandler = (noun: string, event: string, handler: EventHandler) => {
    eventRegistry.push({
      noun,
      event,
      handler,
      source: handler.toString(),
    })
  }

  /**
   * Register a schedule handler
   */
  const registerScheduleHandler = (interval: ScheduleInterval, handler: ScheduleHandler) => {
    scheduleRegistry.push({
      interval,
      handler,
      source: handler.toString(),
    })
  }

  /**
   * Create the $.on proxy
   */
  const createOnProxy = (): OnProxy => {
    return new Proxy({} as OnProxy, {
      get(_target, noun: string) {
        return new Proxy({}, {
          get(_eventTarget, event: string) {
            return (handler: EventHandler) => {
              registerEventHandler(noun, event, handler)
            }
          }
        })
      }
    })
  }

  /**
   * Create the $.every proxy
   */
  const createEveryProxy = (): EveryProxy => {
    const handler = {
      get(_target: unknown, prop: string) {
        const pattern = KNOWN_PATTERNS[prop]
        if (pattern) {
          const result = (handlerFn: ScheduleHandler) => {
            registerScheduleHandler({ type: 'cron', expression: pattern, natural: prop }, handlerFn)
          }
          return new Proxy(result, {
            get(_t, timeKey: string) {
              const time = TIME_PATTERNS[timeKey]
              if (time) {
                const cron = combineWithTime(pattern, time)
                return (handlerFn: ScheduleHandler) => {
                  registerScheduleHandler({ type: 'cron', expression: cron, natural: `${prop}.${timeKey}` }, handlerFn)
                }
              }
              return undefined
            },
            apply(_t, _thisArg, args) {
              registerScheduleHandler({ type: 'cron', expression: pattern, natural: prop }, args[0])
            }
          })
        }

        // Plural units (seconds, minutes, hours, days, weeks)
        // Using type guard and typed constant for type-safe interval creation
        if (isPluralUnitKey(prop)) {
          const intervalType = PLURAL_UNITS[prop]
          return (value: number) => (handlerFn: ScheduleHandler) => {
            registerScheduleHandler(
              { type: intervalType, value, natural: `${value} ${prop}` },
              handlerFn
            )
          }
        }

        return undefined
      },

      apply(_target: unknown, _thisArg: unknown, args: unknown[]) {
        const [description, handler] = args as [string, ScheduleHandler]
        if (typeof description === 'string' && typeof handler === 'function') {
          registerScheduleHandler({ type: 'natural', description }, handler)
        }
      }
    }

    // Create callable target with proper typing
    // The function serves as the Proxy target - actual behavior is in the handler's apply trap
    // Cast to EveryProxy is safe: Proxy handler implements all EveryProxy behaviors dynamically
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const target: EveryProxyTarget = function(_description: string, _handler: ScheduleHandler) {}
    return new Proxy(target, handler) as unknown as EveryProxy
  }

  /**
   * Deliver an event to matching handlers (fire and forget)
   */
  const deliverEvent = async (event: string, data: unknown): Promise<void> => {
    const parsed = parseEvent(event)
    if (!parsed) {
      console.warn(`Invalid event format: ${event}. Expected Noun.event`)
      return
    }

    const matching = eventRegistry.filter(
      h => h.noun === parsed.noun && h.event === parsed.event
    )

    if (matching.length === 0) {
      return
    }

    await Promise.all(
      matching.map(async ({ handler }) => {
        try {
          await handler(data, $)
        } catch (error) {
          console.error(`Error in handler for ${event}:`, error)
        }
      })
    )
  }

  /**
   * Execute an event and wait for result from first matching handler
   */
  const executeEvent = async <TResult = unknown>(
    event: string,
    data: unknown,
    durable: boolean
  ): Promise<TResult> => {
    const parsed = parseEvent(event)
    if (!parsed) {
      throw new Error(`Invalid event format: ${event}. Expected Noun.event`)
    }

    const matching = eventRegistry.filter(
      h => h.noun === parsed.noun && h.event === parsed.event
    )

    if (matching.length === 0) {
      throw new Error(`No handler registered for ${event}`)
    }

    // Use first matching handler for result
    const { handler } = matching[0]!

    if (durable && options.db) {
      // Create action for durability tracking
      await options.db.createAction({
        actor: 'workflow',
        object: event,
        action: 'execute',
        metadata: { data },
      })
    }

    try {
      const result = await handler(data, $)
      return result as TResult
    } catch (error) {
      if (durable) {
        // Could implement retry logic here
        console.error(`[workflow] Durable action failed for ${event}:`, error)
      }
      throw error
    }
  }

  /**
   * Create the $ context
   */
  const $: WorkflowContext = {
    track(event: string, data: unknown): void {
      // Fire and forget - swallow errors
      try {
        addHistory({ type: 'event', name: `track:${event}`, data })
        deliverEvent(event, data).catch(() => {})
      } catch {
        // Silently swallow errors
      }
    },

    send<T = unknown>(event: string, data: T): string {
      const eventId = crypto.randomUUID()
      addHistory({ type: 'event', name: event, data })

      // Record to database if connected (durable) - fire async
      if (options.db) {
        options.db.recordEvent(event, { ...data as object, _eventId: eventId }).catch(err => {
          console.error(`[workflow] Failed to record event ${event}:`, err)
        })
      }

      // Deliver event asynchronously
      deliverEvent(event, { ...data as object, _eventId: eventId }).catch(err => {
        console.error(`[workflow] Failed to deliver event ${event}:`, err)
      })

      return eventId
    },

    async do<TData = unknown, TResult = unknown>(event: string, data: TData): Promise<TResult> {
      addHistory({ type: 'action', name: `do:${event}`, data })

      // Record to database (durable)
      if (options.db) {
        await options.db.recordEvent(event, data)
      }

      return executeEvent<TResult>(event, data, true)
    },

    async try<TData = unknown, TResult = unknown>(event: string, data: TData): Promise<TResult> {
      addHistory({ type: 'action', name: `try:${event}`, data })

      // Non-durable - no database recording
      return executeEvent<TResult>(event, data, false)
    },

    on: createOnProxy(),
    every: createEveryProxy(),

    // Direct access to state context
    state: state.context,

    getState(): WorkflowState {
      // Return a deep copy to prevent mutation
      return structuredClone({
        current: state.current,
        context: state.context,
        history: state.history,
      })
    },

    set<T = unknown>(key: string, value: T): void {
      state.context[key] = value
    },

    get<T = unknown>(key: string): T | undefined {
      return state.context[key] as T | undefined
    },

    log(message: string, data?: unknown): void {
      addHistory({ type: 'action', name: 'log', data: { message, data } })
      console.log(`[workflow] ${message}`, data ?? '')
    },

    db: options.db,
  }

  // Run setup to capture handlers
  setup($)

  /**
   * Start schedule handlers
   */
  const startSchedules = async (): Promise<void> => {
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
        case 'cron':
        case 'natural':
          // Cron/natural need special handling - throw error to avoid silent failures
          throw new Error(
            `Cron scheduling not yet implemented: "${interval.type === 'cron' ? interval.expression : interval.description}". ` +
            `Use interval-based patterns like $.every.seconds(30), $.every.minutes(5), or $.every.hours(1) instead.`
          )
      }

      if (ms > 0) {
        const timer = setInterval(async () => {
          try {
            addHistory({ type: 'schedule', name: interval.natural ?? interval.type })
            await handler($)
          } catch (error) {
            console.error('[workflow] Schedule handler error:', error)
          }
        }, ms)
        scheduleTimers.push(timer)
      }
    }
  }

  const instance: WorkflowInstance = {
    definition: {
      name: 'workflow',
      events: eventRegistry,
      schedules: scheduleRegistry,
      initialContext: options.context,
    },

    get state() {
      return state
    },

    $,

    async send<T = unknown>(event: string, data: T): Promise<void> {
      await $.send(event, data)
    },

    async start(): Promise<void> {
      console.log(`[workflow] Starting with ${eventRegistry.length} event handlers and ${scheduleRegistry.length} schedules`)
      await startSchedules()
    },

    async stop(): Promise<void> {
      console.log('[workflow] Stopping')
      for (const timer of scheduleTimers) {
        clearInterval(timer)
      }
      scheduleTimers = []
    },
  }

  return instance
}

/**
 * Create an isolated $ context for testing
 */
export function createTestContext(): WorkflowContext & { emittedEvents: Array<{ event: string; data: unknown }> } {
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
      emittedEvents.push({ event, data: { ...data as object, _eventId: eventId } })
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
        return new Proxy({}, {
          get() {
            return () => {} // No-op for testing
          }
        })
      }
    }),

    // Cast to EveryProxy is safe: Proxy handler implements all EveryProxy behaviors dynamically
    every: new Proxy(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ((_description: string, _handler: ScheduleHandler) => {}) as EveryProxyTarget,
      {
        get() {
          return () => () => {} // No-op for testing
        },
        apply() {}
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
      console.log(`[test] ${message}`, data ?? '')
    },
  }

  return $
}

// Also export standalone on/every for import { on, every } usage
export { on, registerEventHandler, getEventHandlers, clearEventHandlers } from './on.js'
export { every, registerScheduleHandler, getScheduleHandlers, clearScheduleHandlers, toCron, intervalToMs, formatInterval, setCronConverter } from './every.js'
export { send } from './send.js'
