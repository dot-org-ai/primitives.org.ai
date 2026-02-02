/**
 * Workflow context implementation
 */

import type {
  WorkflowContext,
  WorkflowState,
  WorkflowHistoryEntry,
  OnProxy,
  EveryProxy,
  EveryProxyTarget,
  ScheduleHandler,
} from './types.js'
import { getLogger } from './logger.js'

/**
 * Event bus interface (imported from send.ts to avoid circular dependency)
 */
interface EventBusLike {
  emit(event: string, data: unknown): Promise<void>
}

/**
 * Create a workflow context
 */
export function createWorkflowContext(eventBus: EventBusLike): WorkflowContext {
  const workflowState: WorkflowState = {
    context: {},
    history: [],
  }

  const addHistory = (entry: Omit<WorkflowHistoryEntry, 'timestamp'>) => {
    workflowState.history.push({
      ...entry,
      timestamp: Date.now(),
    })
  }

  // Create no-op proxies for on/every (these are used in send context, not workflow setup)
  const noOpOnProxy = new Proxy({} as OnProxy, {
    get() {
      return new Proxy(
        {},
        {
          get() {
            return () => {}
          },
        }
      )
    },
  })

  // Cast to EveryProxy is safe: Proxy handler implements all EveryProxy behaviors dynamically
  const noOpEveryProxy = new Proxy(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ((_description: string, _handler: ScheduleHandler) => {}) as EveryProxyTarget,
    {
      get() {
        return () => () => {}
      },
      apply() {},
    }
  ) as EveryProxy

  return {
    track(event: string, data: unknown): void {
      // Fire and forget - swallow errors
      try {
        addHistory({ type: 'event', name: `track:${event}`, data })
        eventBus.emit(event, data).catch(() => {})
      } catch {
        // Silently swallow errors
      }
    },

    send<T = unknown>(event: string, data: T): string {
      const eventId = crypto.randomUUID()
      addHistory({ type: 'event', name: event, data })
      // Fire async but don't await - guaranteed delivery via event bus
      eventBus.emit(event, { ...(data as object), _eventId: eventId }).catch((err) => {
        getLogger().error(`[workflow] Failed to send event ${event}:`, err)
      })
      return eventId
    },

    async do<TData = unknown, TResult = unknown>(_event: string, _data: TData): Promise<TResult> {
      throw new Error('$.do not available in this context')
    },

    async try<TData = unknown, TResult = unknown>(_event: string, _data: TData): Promise<TResult> {
      throw new Error('$.try not available in this context')
    },

    on: noOpOnProxy,
    every: noOpEveryProxy,

    state: workflowState.context,

    getState(): WorkflowState {
      // Return a deep copy to prevent mutation
      return {
        ...(workflowState.current !== undefined && { current: workflowState.current }),
        context: { ...workflowState.context },
        history: [...workflowState.history],
      }
    },

    set<T = unknown>(key: string, value: T): void {
      workflowState.context[key] = value
    },

    get<T = unknown>(key: string): T | undefined {
      return workflowState.context[key] as T | undefined
    },

    log(message: string, data?: unknown): void {
      addHistory({ type: 'action', name: 'log', data: { message, data } })
      getLogger().log(`[workflow] ${message}`, data ?? '')
    },
  }
}

/**
 * Create an isolated workflow context (not connected to event bus)
 * Useful for testing or standalone execution
 */
export function createIsolatedContext(): WorkflowContext & {
  getEmittedEvents: () => Array<{ event: string; data: unknown }>
} {
  const emittedEvents: Array<{ event: string; data: unknown }> = []

  const ctx = createWorkflowContext({
    async emit(event: string, data: unknown): Promise<void> {
      emittedEvents.push({ event, data })
    },
  })

  return {
    ...ctx,
    getEmittedEvents: () => [...emittedEvents],
  }
}
