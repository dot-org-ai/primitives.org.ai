/**
 * WorkflowRuntime - Owns the `$` runtime contract
 *
 * Purpose: Single module that owns end-to-end construction of the `$` context
 * a workflow handler receives. Before this module existed the answer to
 * "what does the handler see when it runs?" was stitched together from three
 * separate modules:
 *
 *   - cascade-context.ts (5W+H tracing)
 *   - database-context.ts (DB injection)
 *   - on.ts / send.ts / every.ts (event dispatch)
 *
 * Callers reading `$.on.Order.placed(...)` had no single place to discover
 * what `$` contains. Tests had to assemble three contexts independently to
 * exercise a handler.
 *
 * `WorkflowRuntime` collapses these into one port:
 *
 *   - {@link createWorkflowRuntime} builds the runtime, owning the event/
 *     schedule registries, the optional `DatabaseContext` injection, and the
 *     optional cascade context.
 *   - The runtime exposes `$` (a {@link WorkflowContext}) and `dispatch()` —
 *     the latter is the test surface for exercising a handler against an
 *     event without spinning up a full {@link Workflow}.
 *
 * The cascade-context, database-context, and on/send/every modules continue
 * to exist as **internal seams** — private adapters the runtime composes.
 * `DatabaseContext` stays as an injected port so callers can wire either
 * `ai-database`'s adapter or an in-memory adapter; this keeps `ai-workflows`
 * Layer 0.
 *
 * @example Basic usage
 * ```ts
 * import { createWorkflowRuntime } from 'ai-workflows'
 *
 * const runtime = createWorkflowRuntime()
 * runtime.register('Customer', 'created', async (customer, $) => {
 *   $.log('New customer:', customer)
 * })
 * await runtime.dispatch('Customer.created', { id: '123' })
 * ```
 *
 * @example With injected DatabaseContext
 * ```ts
 * import { createWorkflowRuntime, createMemoryDatabaseContext } from 'ai-workflows'
 *
 * const runtime = createWorkflowRuntime({ db: createMemoryDatabaseContext() })
 * ```
 *
 * @example Direct handler dispatch (test surface)
 * ```ts
 * const runtime = createWorkflowRuntime()
 * const handler = vi.fn()
 * runtime.register('Order', 'placed', handler)
 * await runtime.dispatch('Order.placed', { id: 'o-1' })
 * expect(handler).toHaveBeenCalled()
 * ```
 *
 * @packageDocumentation
 */

import type {
  DatabaseContext,
  EventHandler,
  EventRegistration,
  ParsedEvent,
  ScheduleHandler,
  ScheduleInterval,
  ScheduleRegistration,
  WorkflowContext,
  WorkflowHistoryEntry,
  WorkflowState,
  DependencyConfig,
  OnProxy,
  EveryProxy,
} from './types.js'
import { createTypedOnProxy } from './on.js'
import { createTypedEveryProxy } from './every.js'
import { createCascadeContext, type CascadeContext } from './cascade-context.js'
import { getLogger } from './logger.js'

/**
 * Parse an event string in `Noun.event` form. Returns `null` for invalid
 * input. Lives on the runtime because dispatch is the only thing that needs
 * to crack event names; `workflow.ts` re-exports it for back-compat.
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
 * Options for constructing a {@link WorkflowRuntime}.
 *
 * All options are optional — a runtime constructed with no arguments runs
 * fully in-memory with no persistence and no parent trace.
 */
export interface WorkflowRuntimeOptions {
  /**
   * Initial state context (key/value bag exposed as `$.state`).
   * Cloned defensively at construction so the caller's object is not mutated.
   */
  context?: Record<string, unknown>

  /**
   * Optional persistence port. When provided, `$.send` records events and
   * `$.do` records actions through this adapter. When omitted, events and
   * actions are still delivered in-memory but not persisted.
   */
  db?: DatabaseContext

  /**
   * Optional cascade context for distributed tracing / 5W+H step recording.
   * If omitted a fresh root cascade context is created.
   */
  cascade?: CascadeContext

  /**
   * Optional name for the cascade context (used when cascade is auto-created).
   */
  name?: string
}

/**
 * Public surface of the workflow runtime.
 *
 * The runtime owns construction of `$` and provides a single dispatch port
 * for delivering events. Internal modules (cascade-context, database-context,
 * on/send/every) are composed here, not exposed.
 */
export interface WorkflowRuntime {
  /**
   * The `$` context handed to event and schedule handlers. This is the
   * single source of truth for "what does a handler see when it runs."
   */
  readonly $: WorkflowContext

  /**
   * The cascade context owned by this runtime. Exposed for distributed
   * tracing integration; not part of the handler-facing surface.
   */
  readonly cascade: CascadeContext

  /**
   * Register an event handler under a noun/event pair.
   *
   * Equivalent to `$.on.<Noun>.<event>(handler)`; provided as a direct method
   * for tests and callers that hold the runtime reference rather than `$`.
   */
  register(
    noun: string,
    event: string,
    handler: EventHandler,
    dependencies?: DependencyConfig
  ): void

  /**
   * Register a schedule handler under an interval.
   * Schedule timers are not started by the runtime — the {@link Workflow}
   * instance handles that. The runtime only tracks registrations.
   */
  registerSchedule(interval: ScheduleInterval, handler: ScheduleHandler): void

  /**
   * Dispatch an event to all matching registered handlers.
   *
   * This is the canonical test surface — exercise a handler by registering
   * it on the runtime and calling `dispatch`. Awaits all handlers; rethrows
   * the first error if any handler throws.
   */
  dispatch(event: string, data: unknown): Promise<void>

  /**
   * Dispatch an event and return the result of the first matching handler.
   * Used by `$.do` and `$.try` semantics — `do` is the durable variant that
   * also persists through the database adapter when one is configured.
   */
  execute<TResult = unknown>(event: string, data: unknown, durable: boolean): Promise<TResult>

  /**
   * All event handlers registered on this runtime.
   * Returns the live array (mutated as new handlers register) so callers
   * such as the {@link Workflow} lifecycle wrapper can read it as a definition.
   */
  getEventRegistry(): EventRegistration[]

  /**
   * All schedule handlers registered on this runtime. See {@link getEventRegistry}
   * for sharing semantics.
   */
  getScheduleRegistry(): ScheduleRegistration[]

  /** Mutable workflow state (context bag + history). */
  readonly state: WorkflowState
}

/**
 * Internal: append a history entry with the current timestamp.
 */
function pushHistory(state: WorkflowState, entry: Omit<WorkflowHistoryEntry, 'timestamp'>): void {
  state.history.push({ ...entry, timestamp: Date.now() })
}

/**
 * Construct a {@link WorkflowRuntime}.
 *
 * The runtime is the single owner of the `$` contract — it composes:
 *
 *   1. Event/schedule registries (the dispatch half of on/send/every).
 *   2. The optional injected `DatabaseContext` for durable record-keeping.
 *   3. A cascade context for 5W+H tracing.
 *
 * The returned `runtime.$` is what handlers receive; `runtime.dispatch` is
 * the canonical test surface.
 */
export function createWorkflowRuntime(options: WorkflowRuntimeOptions = {}): WorkflowRuntime {
  // ---------------------------------------------------------------------------
  // State + registries (the runtime is the sole owner)
  // ---------------------------------------------------------------------------

  const state: WorkflowState = {
    context: { ...(options.context ?? {}) },
    history: [],
  }

  const eventRegistry: EventRegistration[] = []
  const scheduleRegistry: ScheduleRegistration[] = []

  // Cascade context (auto-created if not supplied)
  const cascade =
    options.cascade ??
    createCascadeContext(options.name !== undefined ? { name: options.name } : {})

  const db = options.db

  // ---------------------------------------------------------------------------
  // Registration (these are the "right halves" of on / every — the registry
  // halves. The proxy halves live in on.ts/every.ts as factories we reuse.)
  // ---------------------------------------------------------------------------

  const register: WorkflowRuntime['register'] = (noun, event, handler, dependencies) => {
    eventRegistry.push({
      noun,
      event,
      handler,
      source: handler.toString(),
      ...(dependencies !== undefined && { dependencies }),
    })
  }

  const registerSchedule: WorkflowRuntime['registerSchedule'] = (interval, handler) => {
    scheduleRegistry.push({
      interval,
      handler,
      source: handler.toString(),
    })
  }

  // ---------------------------------------------------------------------------
  // Dispatch (the runtime's core: take an event, find handlers, run them)
  // ---------------------------------------------------------------------------

  const findMatching = (event: string): EventHandler[] => {
    const parsed = parseEvent(event)
    if (!parsed) {
      getLogger().warn(`Invalid event format: ${event}. Expected Noun.event`)
      return []
    }
    return eventRegistry
      .filter((h) => h.noun === parsed.noun && h.event === parsed.event)
      .map((h) => h.handler)
  }

  const dispatch: WorkflowRuntime['dispatch'] = async (event, data) => {
    const matching = findMatching(event)
    if (matching.length === 0) return

    await Promise.all(
      matching.map(async (handler) => {
        try {
          await handler(data, $)
        } catch (error) {
          getLogger().error(`Error in handler for ${event}:`, error)
        }
      })
    )
  }

  const execute: WorkflowRuntime['execute'] = async <TResult = unknown>(
    event: string,
    data: unknown,
    durable: boolean
  ): Promise<TResult> => {
    const parsed = parseEvent(event)
    if (!parsed) {
      throw new Error(`Invalid event format: ${event}. Expected Noun.event`)
    }
    const matching = eventRegistry.filter((h) => h.noun === parsed.noun && h.event === parsed.event)
    if (matching.length === 0) {
      throw new Error(`No handler registered for ${event}`)
    }

    const { handler } = matching[0]!

    if (durable && db) {
      await db.createAction({
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
        getLogger().error(`[runtime] Durable action failed for ${event}:`, error)
      }
      throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Build the `$` context. This is the WHOLE answer to "what does a handler
  // see when it runs?" — every property below is a deliberate part of the
  // handler-facing surface.
  // ---------------------------------------------------------------------------

  const onProxy: OnProxy = createTypedOnProxy((noun, event, handler, deps) => {
    register(noun, event, handler, deps)
  })

  const everyProxy: EveryProxy = createTypedEveryProxy((interval, handler) => {
    registerSchedule(interval, handler)
  })

  const $: WorkflowContext = {
    track(event: string, data: unknown): void {
      try {
        pushHistory(state, { type: 'event', name: `track:${event}`, data })
        dispatch(event, data).catch(() => {
          // track() swallows errors by design
        })
      } catch {
        // Silently swallow errors
      }
    },

    send<T = unknown>(event: string, data: T): string {
      const eventId = crypto.randomUUID()
      pushHistory(state, { type: 'event', name: event, data })

      const payload = { ...(data as object), _eventId: eventId }

      // Persist if a DatabaseContext is wired
      if (db) {
        db.recordEvent(event, payload).catch((err) => {
          getLogger().error(`[runtime] Failed to record event ${event}:`, err)
        })
      }

      // Deliver
      dispatch(event, payload).catch((err) => {
        getLogger().error(`[runtime] Failed to deliver event ${event}:`, err)
      })

      return eventId
    },

    async do<TResult = unknown, TInput = unknown>(event: string, data: TInput): Promise<TResult> {
      pushHistory(state, { type: 'action', name: `do:${event}`, data })
      if (db) {
        await db.recordEvent(event, data)
      }
      return execute<TResult>(event, data, true)
    },

    async try<TResult = unknown, TInput = unknown>(event: string, data: TInput): Promise<TResult> {
      pushHistory(state, { type: 'action', name: `try:${event}`, data })
      return execute<TResult>(event, data, false)
    },

    on: onProxy,
    every: everyProxy,

    state: state.context,

    getState(): WorkflowState {
      return structuredClone({
        ...(state.current !== undefined && { current: state.current }),
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
      pushHistory(state, { type: 'action', name: 'log', data: { message, data } })
      getLogger().log(`[workflow] ${message}`, data ?? '')
    },

    ...(db !== undefined && { db }),
  }

  // ---------------------------------------------------------------------------
  // Public surface
  // ---------------------------------------------------------------------------

  return {
    $,
    cascade,
    register,
    registerSchedule,
    dispatch,
    execute,
    getEventRegistry: () => eventRegistry,
    getScheduleRegistry: () => scheduleRegistry,
    state,
  }
}
