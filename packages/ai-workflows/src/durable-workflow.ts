/**
 * DurableWorkflow - Persistent workflow implementation using digital-objects
 *
 * Provides durable, recoverable workflows with:
 * - Workflow state stored as Things
 * - History and events stored as Actions
 * - Automatic state recovery on restart
 * - Graph-based dependency tracking
 *
 * @example
 * ```typescript
 * import { createMemoryProvider } from 'digital-objects'
 * import { DurableWorkflow } from 'ai-workflows'
 *
 * const provider = createMemoryProvider()
 * const workflow = new DurableWorkflow(provider)
 *
 * await workflow.initialize('my-workflow', $ => {
 *   $.on.Order.created(async (order, $) => {
 *     await $.send('Invoice.generate', { orderId: order.id })
 *   })
 * })
 *
 * await workflow.start()
 * await workflow.send('Order.created', { id: 'order-1', total: 100 })
 * ```
 *
 * @packageDocumentation
 */

import type { DigitalObjectsProvider, Thing, Action } from 'digital-objects'
import type {
  WorkflowContext,
  WorkflowState,
  WorkflowHistoryEntry,
  EventHandler,
  ScheduleHandler,
  EventRegistration,
  ScheduleRegistration,
  ScheduleInterval,
  OnProxy,
  EveryProxy,
  EveryProxyTarget,
  ParsedEvent,
} from './types.js'
import { PLURAL_UNITS, isPluralUnitKey } from './types.js'
import {
  createDigitalObjectsAdapter,
  type WorkflowThingData,
  type DigitalObjectsDatabaseContext,
} from './digital-objects-adapter.js'
import { parseEvent } from './workflow.js'
import {
  registerTimer,
  clearTimersForWorkflow,
  getTimerIdsForWorkflow,
  registerProcessCleanup,
} from './timer-registry.js'
import { getLogger } from './logger.js'

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
 * Durable workflow state stored in digital-objects
 */
export interface DurableWorkflowState extends WorkflowThingData {
  version: number
  createdAt: number
  updatedAt: number
}

/**
 * History entry stored as an Action
 */
export interface DurableHistoryEntry {
  type: 'event' | 'schedule' | 'transition' | 'action'
  name: string
  data?: unknown
}

/**
 * Options for DurableWorkflow
 */
export interface DurableWorkflowOptions {
  /**
   * Existing workflow instance ID to restore
   */
  instanceId?: string

  /**
   * Auto-persist state changes immediately
   * @default true
   */
  autoPersist?: boolean

  /**
   * Initial context data
   */
  context?: Record<string, unknown>
}

/**
 * DurableWorkflow - A workflow implementation with persistent state
 *
 * Uses digital-objects as the backing store:
 * - Workflow instance stored as a Thing
 * - Events and history stored as Actions
 * - State changes create audit trail
 */
export class DurableWorkflow {
  private provider: DigitalObjectsProvider
  private db!: DigitalObjectsDatabaseContext
  private instanceId: string
  private autoPersist: boolean
  private initialized = false

  // Internal state (cached from digital-objects)
  private eventRegistry: EventRegistration[] = []
  private scheduleRegistry: ScheduleRegistration[] = []
  private state: WorkflowState = { context: {}, history: [] }
  private scheduleTimers: NodeJS.Timeout[] = []

  // The $ context
  private $!: WorkflowContext

  /**
   * Create a new DurableWorkflow
   *
   * @param provider - The digital-objects provider (MemoryProvider, NS, etc.)
   * @param options - Configuration options
   */
  constructor(provider: DigitalObjectsProvider, options: DurableWorkflowOptions = {}) {
    this.provider = provider
    this.instanceId =
      options.instanceId ?? `workflow-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    this.autoPersist = options.autoPersist ?? true

    if (options.context) {
      this.state.context = { ...options.context }
    }
  }

  /**
   * Get the workflow instance ID
   */
  get id(): string {
    return this.instanceId
  }

  /**
   * Get the current workflow state
   */
  getState(): WorkflowState {
    return structuredClone({
      ...(this.state.current !== undefined && { current: this.state.current }),
      context: this.state.context,
      history: this.state.history,
    })
  }

  /**
   * Initialize the workflow
   *
   * Creates or restores the workflow instance and runs the setup function
   * to register event and schedule handlers.
   *
   * @param name - Workflow name for identification
   * @param setup - Setup function that registers handlers using $
   */
  async initialize(name: string, setup: ($: WorkflowContext) => void): Promise<void> {
    if (this.initialized) {
      throw new Error('Workflow already initialized')
    }

    // Create the database adapter
    this.db = await createDigitalObjectsAdapter(this.provider, {
      workflowId: this.instanceId,
    })

    // Check if workflow instance exists (for recovery)
    const existing = await this.provider.get<DurableWorkflowState>(this.instanceId)

    if (existing) {
      // Restore state from existing workflow
      this.state.context = existing.data.context
      getLogger().log(`[durable-workflow] Restored workflow ${this.instanceId}`)

      // Load history from actions
      const actions = await this.db.listWorkflowActions<DurableHistoryEntry>(this.instanceId)
      this.state.history = actions.map((a) => ({
        timestamp: a.createdAt.getTime(),
        type: a.data?.type ?? 'action',
        name: a.data?.name ?? a.verb,
        data: a.data?.data,
      }))
    } else {
      // Create new workflow instance
      await this.provider.create<DurableWorkflowState>(
        'Workflow',
        {
          name,
          status: 'initializing',
          context: this.state.context,
          registeredEvents: [],
          registeredSchedules: [],
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        this.instanceId
      )

      getLogger().log(`[durable-workflow] Created workflow ${this.instanceId}`)
    }

    // Create the $ context
    this.$ = this.createContext()

    // Run setup to capture handlers
    setup(this.$)

    // Update workflow with registered handlers
    await this.provider.update<DurableWorkflowState>(this.instanceId, {
      status: 'running',
      registeredEvents: this.eventRegistry.map((e) => `${e.noun}.${e.event}`),
      registeredSchedules: this.scheduleRegistry.map((s) =>
        s.interval.type === 'natural'
          ? s.interval.description
          : s.interval.type === 'cron'
          ? s.interval.expression
          : `${s.interval.type}:${s.interval.value ?? 1}`
      ),
      updatedAt: Date.now(),
    })

    this.initialized = true
  }

  /**
   * Start the workflow (begin processing schedules)
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Workflow not initialized. Call initialize() first.')
    }

    getLogger().log(
      `[durable-workflow] Starting with ${this.eventRegistry.length} event handlers and ${this.scheduleRegistry.length} schedules`
    )

    // Register process cleanup
    registerProcessCleanup()

    // Start schedules
    for (const schedule of this.scheduleRegistry) {
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
          throw new Error(
            `Cron scheduling not yet implemented: "${
              interval.type === 'cron' ? interval.expression : interval.description
            }". Use interval-based patterns instead.`
          )
      }

      if (ms > 0) {
        const timer = setInterval(async () => {
          try {
            await this.addHistory('schedule', interval.natural ?? interval.type)
            await handler(this.$)
          } catch (error) {
            getLogger().error('[durable-workflow] Schedule handler error:', error)
          }
        }, ms)
        this.scheduleTimers.push(timer)
        registerTimer(this.instanceId, timer)
      }
    }

    // Record start action
    await this.addHistory('transition', 'workflow.started')
  }

  /**
   * Stop the workflow
   */
  async stop(): Promise<void> {
    getLogger().log('[durable-workflow] Stopping')
    this.cleanup()

    await this.provider.update<DurableWorkflowState>(this.instanceId, {
      status: 'paused',
      updatedAt: Date.now(),
    })

    await this.addHistory('transition', 'workflow.stopped')
  }

  /**
   * Send an event to the workflow
   */
  async send<T = unknown>(event: string, data: T): Promise<string> {
    if (!this.initialized) {
      throw new Error('Workflow not initialized')
    }

    const eventId = this.$.send(event, data)

    // Deliver to handlers
    await this.deliverEvent(event, { ...(data as object), _eventId: eventId })

    return eventId
  }

  /**
   * Destroy the workflow and clean up all resources
   */
  async destroy(): Promise<void> {
    this.cleanup()

    await this.provider.update<DurableWorkflowState>(this.instanceId, {
      status: 'completed',
      updatedAt: Date.now(),
    })
  }

  /**
   * Get the number of active timers
   */
  get timerCount(): number {
    return getTimerIdsForWorkflow(this.instanceId).length
  }

  /**
   * Get timer IDs for this workflow
   */
  getTimerIds(): string[] {
    return getTimerIdsForWorkflow(this.instanceId)
  }

  // ==========================================================================
  // Private methods
  // ==========================================================================

  /**
   * Create the $ context
   */
  private createContext(): WorkflowContext {
    const self = this

    return {
      track(event: string, data: unknown): void {
        try {
          self.addHistory('event', `track:${event}`, data).catch(() => {})
          self.deliverEvent(event, data).catch(() => {})
        } catch {
          // Silently swallow errors
        }
      },

      send<T = unknown>(event: string, data: T): string {
        const eventId = crypto.randomUUID()
        self.addHistory('event', event, data).catch((err) => {
          getLogger().error(`[durable-workflow] Failed to record event ${event}:`, err)
        })

        // Record to database (durable)
        self.db.recordEvent(event, { ...(data as object), _eventId: eventId }).catch((err) => {
          getLogger().error(`[durable-workflow] Failed to persist event ${event}:`, err)
        })

        return eventId
      },

      async do<TData = unknown, TResult = unknown>(event: string, data: TData): Promise<TResult> {
        await self.addHistory('action', `do:${event}`, data)
        await self.db.recordEvent(event, data)
        return self.executeEvent<TResult>(event, data, true)
      },

      async try<TData = unknown, TResult = unknown>(event: string, data: TData): Promise<TResult> {
        await self.addHistory('action', `try:${event}`, data)
        return self.executeEvent<TResult>(event, data, false)
      },

      on: self.createOnProxy(),
      every: self.createEveryProxy(),

      state: self.state.context,

      getState(): WorkflowState {
        return self.getState()
      },

      set<T = unknown>(key: string, value: T): void {
        self.state.context[key] = value
        if (self.autoPersist) {
          self.persistState().catch((err) => {
            getLogger().error(`[durable-workflow] Failed to persist state:`, err)
          })
        }
      },

      get<T = unknown>(key: string): T | undefined {
        return self.state.context[key] as T | undefined
      },

      log(message: string, data?: unknown): void {
        self.addHistory('action', 'log', { message, data }).catch(() => {})
        getLogger().log(`[durable-workflow] ${message}`, data ?? '')
      },

      db: self.db,
    }
  }

  /**
   * Create the $.on proxy
   */
  private createOnProxy(): OnProxy {
    const self = this
    return new Proxy({} as OnProxy, {
      get(_target, noun: string) {
        return new Proxy(
          {},
          {
            get(_eventTarget, event: string) {
              return (handler: EventHandler) => {
                self.eventRegistry.push({
                  noun,
                  event,
                  handler,
                  source: handler.toString(),
                })
              }
            },
          }
        )
      },
    })
  }

  /**
   * Create the $.every proxy
   */
  private createEveryProxy(): EveryProxy {
    const self = this

    const handler = {
      get(_target: unknown, prop: string) {
        const pattern = KNOWN_PATTERNS[prop]
        if (pattern) {
          const result = (handlerFn: ScheduleHandler) => {
            self.scheduleRegistry.push({
              interval: { type: 'cron', expression: pattern, natural: prop },
              handler: handlerFn,
              source: handlerFn.toString(),
            })
          }
          return new Proxy(result, {
            get(_t, timeKey: string) {
              const time = TIME_PATTERNS[timeKey]
              if (time) {
                const cron = combineWithTime(pattern, time)
                return (handlerFn: ScheduleHandler) => {
                  self.scheduleRegistry.push({
                    interval: { type: 'cron', expression: cron, natural: `${prop}.${timeKey}` },
                    handler: handlerFn,
                    source: handlerFn.toString(),
                  })
                }
              }
              return undefined
            },
            apply(_t, _thisArg, args) {
              self.scheduleRegistry.push({
                interval: { type: 'cron', expression: pattern, natural: prop },
                handler: args[0],
                source: args[0].toString(),
              })
            },
          })
        }

        // Plural units (seconds, minutes, hours, days, weeks)
        if (isPluralUnitKey(prop)) {
          const intervalType = PLURAL_UNITS[prop]
          return (value: number) => (handlerFn: ScheduleHandler) => {
            self.scheduleRegistry.push({
              interval: { type: intervalType, value, natural: `${value} ${prop}` },
              handler: handlerFn,
              source: handlerFn.toString(),
            })
          }
        }

        return undefined
      },

      apply(_target: unknown, _thisArg: unknown, args: unknown[]) {
        const [description, handlerFn] = args as [string, ScheduleHandler]
        if (typeof description === 'string' && typeof handlerFn === 'function') {
          self.scheduleRegistry.push({
            interval: { type: 'natural', description },
            handler: handlerFn,
            source: handlerFn.toString(),
          })
        }
      },
    }

    const target: EveryProxyTarget = function (_description: string, _handler: ScheduleHandler) {}
    return new Proxy(target, handler) as unknown as EveryProxy
  }

  /**
   * Add history entry (persisted as Action)
   */
  private async addHistory(
    type: WorkflowHistoryEntry['type'],
    name: string,
    data?: unknown
  ): Promise<void> {
    const entry: WorkflowHistoryEntry = {
      timestamp: Date.now(),
      type,
      name,
      data,
    }
    this.state.history.push(entry)

    // Persist as Action
    await this.provider.perform<DurableHistoryEntry>(type, this.instanceId, undefined, {
      type,
      name,
      data,
    })
  }

  /**
   * Persist current state to digital-objects
   */
  private async persistState(): Promise<void> {
    await this.provider.update<DurableWorkflowState>(this.instanceId, {
      context: this.state.context,
      updatedAt: Date.now(),
    })
  }

  /**
   * Deliver an event to matching handlers
   */
  private async deliverEvent(event: string, data: unknown): Promise<void> {
    const parsed = parseEvent(event)
    if (!parsed) {
      getLogger().warn(`Invalid event format: ${event}. Expected Noun.event`)
      return
    }

    const matching = this.eventRegistry.filter(
      (h) => h.noun === parsed.noun && h.event === parsed.event
    )

    if (matching.length === 0) {
      return
    }

    await Promise.all(
      matching.map(async ({ handler }) => {
        try {
          await handler(data, this.$)
        } catch (error) {
          getLogger().error(`Error in handler for ${event}:`, error)
        }
      })
    )
  }

  /**
   * Execute an event and wait for result
   */
  private async executeEvent<TResult>(
    event: string,
    data: unknown,
    durable: boolean
  ): Promise<TResult> {
    const parsed = parseEvent(event)
    if (!parsed) {
      throw new Error(`Invalid event format: ${event}. Expected Noun.event`)
    }

    const matching = this.eventRegistry.filter(
      (h) => h.noun === parsed.noun && h.event === parsed.event
    )

    if (matching.length === 0) {
      throw new Error(`No handler registered for ${event}`)
    }

    const { handler } = matching[0]!

    if (durable) {
      await this.db.createAction({
        actor: 'workflow',
        object: event,
        action: 'execute',
        metadata: { data },
      })
    }

    try {
      const result = await handler(data, this.$)
      return result as TResult
    } catch (error) {
      if (durable) {
        getLogger().error(`[durable-workflow] Durable action failed for ${event}:`, error)
      }
      throw error
    }
  }

  /**
   * Clean up timers
   */
  private cleanup(): void {
    clearTimersForWorkflow(this.instanceId)
    this.scheduleTimers = []
  }
}

/**
 * Factory function to create a DurableWorkflow
 *
 * @param provider - The digital-objects provider
 * @param options - Configuration options
 * @returns A new DurableWorkflow instance
 */
export function createDurableWorkflow(
  provider: DigitalObjectsProvider,
  options?: DurableWorkflowOptions
): DurableWorkflow {
  return new DurableWorkflow(provider, options)
}
