/**
 * Workflow context implementation
 */

import type { WorkflowContext, WorkflowState, WorkflowHistoryEntry, OnProxy, EveryProxy } from './types.js'

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
      return new Proxy({}, {
        get() {
          return () => {}
        }
      })
    }
  })

  const noOpEveryProxy = new Proxy(function() {} as any, {
    get() {
      return () => () => {}
    },
    apply() {}
  }) as EveryProxy

  return {
    async send<T = unknown>(event: string, data: T): Promise<void> {
      addHistory({ type: 'event', name: event, data })
      await eventBus.emit(event, data)
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

    log(message: string, data?: unknown): void {
      addHistory({ type: 'action', name: 'log', data: { message, data } })
      console.log(`[workflow] ${message}`, data ?? '')
    },
  }
}

/**
 * Create an isolated workflow context (not connected to event bus)
 * Useful for testing or standalone execution
 */
export function createIsolatedContext(): WorkflowContext & { getEmittedEvents: () => Array<{ event: string; data: unknown }> } {
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
