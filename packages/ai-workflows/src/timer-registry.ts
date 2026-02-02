/**
 * Global timer registry for workflow timers
 *
 * This module tracks all active timers across workflows to enable:
 * - Timer cleanup when workflows are destroyed
 * - Global timer count for debugging
 * - Process exit cleanup
 */

interface TimerEntry {
  timerId: NodeJS.Timeout
  workflowId: string
  registeredAt: number
}

/**
 * Global registry of active timers
 */
const activeTimers: Map<string, TimerEntry> = new Map()

/**
 * Counter for generating unique timer IDs
 */
let timerCounter = 0

/**
 * Generate a unique timer ID
 */
function generateTimerId(workflowId: string): string {
  return `${workflowId}-timer-${++timerCounter}`
}

/**
 * Register a timer in the global registry
 */
export function registerTimer(workflowId: string, timerId: NodeJS.Timeout): string {
  const id = generateTimerId(workflowId)
  activeTimers.set(id, {
    timerId,
    workflowId,
    registeredAt: Date.now(),
  })
  return id
}

/**
 * Unregister a timer from the global registry
 */
export function unregisterTimer(id: string): boolean {
  const entry = activeTimers.get(id)
  if (entry) {
    clearInterval(entry.timerId)
    activeTimers.delete(id)
    return true
  }
  return false
}

/**
 * Get all timer IDs for a specific workflow
 */
export function getTimerIdsForWorkflow(workflowId: string): string[] {
  const ids: string[] = []
  for (const [id, entry] of activeTimers) {
    if (entry.workflowId === workflowId) {
      ids.push(id)
    }
  }
  return ids
}

/**
 * Clear all timers for a specific workflow
 */
export function clearTimersForWorkflow(workflowId: string): number {
  const ids = getTimerIdsForWorkflow(workflowId)
  for (const id of ids) {
    unregisterTimer(id)
  }
  return ids.length
}

/**
 * Get the count of all active timers
 */
export function getActiveTimerCount(): number {
  return activeTimers.size
}

/**
 * Clear all timers from all workflows
 */
export function clearAllTimers(): void {
  for (const [id, entry] of activeTimers) {
    clearInterval(entry.timerId)
    activeTimers.delete(id)
  }
}

/**
 * Timer registry object for external access
 */
export const timerRegistry = {
  register: registerTimer,
  unregister: unregisterTimer,
  getTimerIdsForWorkflow,
  clearForWorkflow: clearTimersForWorkflow,
  getActiveCount: getActiveTimerCount,
  clearAll: clearAllTimers,
  getAll: () => Array.from(activeTimers.entries()),
}

// Global registration is opt-in to avoid namespace pollution
declare const global: typeof globalThis

let globalRegistrationEnabled = false

function registerGlobalFunctions(target: typeof globalThis) {
  ;(target as unknown as Record<string, unknown>)['getActiveWorkflowTimerCount'] =
    getActiveTimerCount
  ;(target as unknown as Record<string, unknown>)['clearAllWorkflowTimers'] = clearAllTimers
}

/**
 * Enable global timer registry functions.
 *
 * This opt-in function registers `getActiveWorkflowTimerCount` and `clearAllWorkflowTimers`
 * on the global scope for debugging and cleanup purposes.
 *
 * Call this function explicitly if you need global access to timer management:
 *
 * @example
 * ```ts
 * import { enableGlobalTimerRegistry } from 'ai-workflows'
 *
 * // Enable global registration
 * enableGlobalTimerRegistry()
 *
 * // Now these are available globally:
 * // globalThis.getActiveWorkflowTimerCount()
 * // globalThis.clearAllWorkflowTimers()
 * ```
 */
export function enableGlobalTimerRegistry(): void {
  if (globalRegistrationEnabled) return
  globalRegistrationEnabled = true

  // Register on globalThis (standard)
  if (typeof globalThis !== 'undefined') {
    registerGlobalFunctions(globalThis)
  }

  // Also register on global (Node.js specific, used in some test environments)
  if (typeof global !== 'undefined' && global !== globalThis) {
    registerGlobalFunctions(global)
  }
}

/**
 * Check if global timer registry is enabled
 */
export function isGlobalTimerRegistryEnabled(): boolean {
  return globalRegistrationEnabled
}

// Register process exit handlers for cleanup
let cleanupRegistered = false

export function registerProcessCleanup(): void {
  if (cleanupRegistered) return
  cleanupRegistered = true

  const cleanup = () => {
    clearAllTimers()
  }

  process.on('exit', cleanup)
  process.on('beforeExit', cleanup)
}
