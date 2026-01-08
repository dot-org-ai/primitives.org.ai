/**
 * Actions API - Public interface for durable execution
 *
 * Actions represent long-running operations that survive restarts.
 * They track progress through a lifecycle: pending -> active -> completed/failed.
 *
 * Key use cases:
 * - Batch operations (processing thousands of records)
 * - Background jobs (generating reports, sending emails)
 * - Resumable workflows (surviving crashes and restarts)
 * - Progress tracking (showing users what percentage is complete)
 *
 * @module actions
 *
 * @example Basic usage - creating and tracking an action
 * ```ts
 * import { DB } from '@org.ai/db'
 *
 * const { db, actions } = DB({
 *   Lead: { name: 'string', email: 'string', score: 'number' },
 * })
 *
 * // Create a long-running action
 * const action = await actions.create({
 *   actor: 'system',
 *   action: 'generate',
 *   object: 'Lead',
 *   objectData: { count: 1000 },
 *   total: 1000,
 * })
 *
 * console.log(action.id)       // 'action-abc123'
 * console.log(action.status)   // 'pending'
 * console.log(action.activity) // 'generating' (auto-conjugated)
 *
 * // Start the action
 * await actions.update(action.id, { status: 'active' })
 *
 * // Update progress during processing
 * for (let i = 0; i < 1000; i += 100) {
 *   await processLeads(i, i + 100)
 *   await actions.update(action.id, { progress: i + 100 })
 * }
 *
 * // Complete the action
 * await actions.update(action.id, {
 *   status: 'completed',
 *   result: { processed: 1000 },
 * })
 * ```
 *
 * @example Using forEach with persistence
 * ```ts
 * // Actions integrate with forEach for automatic progress tracking
 * const result = await db.Lead.forEach(
 *   async (lead) => {
 *     await enrichLead(lead)
 *   },
 *   {
 *     persist: true,  // Creates an action automatically
 *     concurrency: 10,
 *   }
 * )
 *
 * console.log(result.actionId) // Can be used to resume if interrupted
 * ```
 *
 * @example Resuming after a crash
 * ```ts
 * // If your process restarts, resume from where you left off
 * const result = await db.Lead.forEach(
 *   async (lead) => {
 *     await enrichLead(lead)
 *   },
 *   {
 *     resume: 'action-abc123',  // Skip already-processed items
 *   }
 * )
 * ```
 *
 * @example Listing and monitoring actions
 * ```ts
 * // Find all active actions
 * const active = await actions.list({ status: 'active' })
 * for (const action of active) {
 *   console.log(`${action.activity} ${action.object}: ${action.progress}/${action.total}`)
 * }
 *
 * // Find failed actions to retry
 * const failed = await actions.list({ status: 'failed' })
 * for (const action of failed) {
 *   console.log(`Failed: ${action.error}`)
 *   await actions.retry(action.id)
 * }
 * ```
 *
 * @example Cancelling actions
 * ```ts
 * // Cancel a pending or active action
 * const action = await actions.create({
 *   actor: 'user:john',
 *   action: 'export',
 *   object: 'Report',
 *   objectData: { format: 'csv' },
 * })
 *
 * // User changes their mind
 * await actions.cancel(action.id)
 * ```
 *
 * @example Verb conjugation
 * ```ts
 * // Actions auto-conjugate verbs for semantic clarity
 * const action = await actions.create({
 *   actor: 'system',
 *   action: 'generate', // Base verb
 *   object: 'Lead',
 * })
 *
 * console.log(action.action)   // 'generate' - base form
 * console.log(action.act)      // 'generates' - 3rd person present
 * console.log(action.activity) // 'generating' - gerund (for "currently...")
 *
 * // Use conjugate() to get all forms for any verb
 * const verb = actions.conjugate('publish')
 * console.log(verb)
 * // { action: 'publish', act: 'publishes', activity: 'publishing', actor: 'publisher' }
 * ```
 */

// Re-export action types from schema
export type {
  DBAction,
  ActionsAPI,
  CreateActionOptions,
} from './schema.js'

// Re-export ActionStatus from types for convenience
export type { ActionStatus } from './types.js'

/**
 * Standard action statuses
 *
 * Actions move through these statuses during their lifecycle:
 *
 * ```
 * pending -> active -> completed
 *                  \-> failed
 *                  \-> cancelled
 * ```
 *
 * - `pending`: Action created but not started
 * - `active`: Action is currently running
 * - `completed`: Action finished successfully
 * - `failed`: Action encountered an error
 * - `cancelled`: Action was cancelled before completion
 */
export const ActionStatuses = {
  /** Action created but not yet started */
  PENDING: 'pending',
  /** Action is currently running */
  ACTIVE: 'active',
  /** Action completed successfully */
  COMPLETED: 'completed',
  /** Action failed with an error */
  FAILED: 'failed',
  /** Action was cancelled */
  CANCELLED: 'cancelled',
} as const

/**
 * Type for action status values
 */
export type ActionStatusType = (typeof ActionStatuses)[keyof typeof ActionStatuses]

/**
 * Check if an action is in a terminal state (completed, failed, or cancelled)
 *
 * @example
 * ```ts
 * const action = await actions.get(id)
 * if (isTerminal(action.status)) {
 *   console.log('Action is finished')
 * }
 * ```
 */
export function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

/**
 * Check if an action is still in progress (pending or active)
 *
 * @example
 * ```ts
 * const action = await actions.get(id)
 * if (isInProgress(action.status)) {
 *   console.log('Action is still running')
 * }
 * ```
 */
export function isInProgress(status: string): boolean {
  return status === 'pending' || status === 'active'
}

/**
 * Check if an action can be retried (only failed actions)
 *
 * @example
 * ```ts
 * const action = await actions.get(id)
 * if (canRetry(action.status)) {
 *   await actions.retry(action.id)
 * }
 * ```
 */
export function canRetry(status: string): boolean {
  return status === 'failed'
}

/**
 * Check if an action can be cancelled (pending or active)
 *
 * @example
 * ```ts
 * const action = await actions.get(id)
 * if (canCancel(action.status)) {
 *   await actions.cancel(action.id)
 * }
 * ```
 */
export function canCancel(status: string): boolean {
  return status === 'pending' || status === 'active'
}

/**
 * Calculate progress percentage for an action
 *
 * @example
 * ```ts
 * const action = await actions.get(id)
 * console.log(`Progress: ${getProgressPercent(action)}%`)
 * ```
 */
export function getProgressPercent(action: { progress?: number; total?: number }): number {
  if (!action.total || action.total === 0) return 0
  const progress = action.progress ?? 0
  return Math.round((progress / action.total) * 100)
}

/**
 * Format action status for display
 *
 * @example
 * ```ts
 * const action = await actions.get(id)
 * console.log(formatActionStatus(action))
 * // 'generating leads (45%)'
 * // or 'completed: generated 1000 leads'
 * // or 'failed: Connection timeout'
 * ```
 */
export function formatActionStatus(action: {
  status: string
  activity?: string
  object?: string
  progress?: number
  total?: number
  result?: unknown
  error?: string
}): string {
  switch (action.status) {
    case 'pending':
      return `pending: ${action.activity ?? 'waiting to start'} ${action.object ?? ''}`
    case 'active': {
      const percent = getProgressPercent(action)
      return `${action.activity ?? 'processing'} ${action.object ?? ''} (${percent}%)`
    }
    case 'completed':
      return `completed: ${action.result ? JSON.stringify(action.result) : 'done'}`
    case 'failed':
      return `failed: ${action.error ?? 'unknown error'}`
    case 'cancelled':
      return 'cancelled'
    default:
      return action.status
  }
}
