/**
 * Workflow context implementation
 */

import type { WorkflowContext, WorkflowState, WorkflowHistoryEntry } from './types.js'

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
  const state: WorkflowState = {
    context: {},
    history: [],
  }

  const addHistory = (entry: Omit<WorkflowHistoryEntry, 'timestamp'>) => {
    state.history.push({
      ...entry,
      timestamp: Date.now(),
    })
  }

  return {
    async send<T = unknown>(event: string, data: T): Promise<void> {
      addHistory({ type: 'event', name: event, data })
      await eventBus.emit(event, data)
    },

    getState(): WorkflowState {
      return {
        ...state,
        context: { ...state.context },
        history: [...state.history],
      }
    },

    set(key: string, value: unknown): void {
      state.context[key] = value
    },

    get<T = unknown>(key: string): T | undefined {
      return state.context[key] as T | undefined
    },

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
export function createIsolatedContext(): WorkflowContext {
  const emittedEvents: Array<{ event: string; data: unknown }> = []

  const ctx = createWorkflowContext({
    async emit(event: string, data: unknown): Promise<void> {
      emittedEvents.push({ event, data })
    },
  })

  // Add method to get emitted events for testing
  ;(ctx as any).getEmittedEvents = () => [...emittedEvents]

  return ctx
}
