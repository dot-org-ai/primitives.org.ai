/**
 * lifecycle-store — HumanStore port for LifecycleItem persistence.
 *
 * This module defines the persistence interface for Human Function lifecycle
 * items. All state transitions are expected to go through the request-lifecycle
 * state machine (fail-closed); the store persists the results.
 *
 * The in-memory implementation (LifecycleStoreMemory) is the reference
 * implementation for tests and dev. Production implementations (e.g.
 * drizzle-human-store in management.studio) implement this same interface.
 *
 * Interface: LifecycleStore
 *   create(item)                     → LifecycleItem
 *   get(id)                          → LifecycleItem | null
 *   update(id, patch)                → LifecycleItem
 *   list(filters?)                   → LifecycleItem[]
 *   complete(id, response)           → LifecycleItem   (claimed | in_progress → completed)
 *   reject(id, reason)               → LifecycleItem   (active → completed w/ reject verb)
 *   escalate(id, toAssignee)         → LifecycleItem   (active → escalated)
 *   cancel(id)                       → LifecycleItem   (active → cancelled)
 */

import type { LifecycleItem, LifecycleStatus, RequestKind } from './request-lifecycle.js'

// ============================================================================
// Filter types
// ============================================================================

/**
 * Filters for LifecycleStore.list().
 *
 * All filters are optional. Multiple filters are ANDed together.
 */
export interface LifecycleStoreFilters {
  /** Filter by assignee identifier */
  assignee?: string
  /** Filter by one or more statuses */
  status?: LifecycleStatus | LifecycleStatus[]
  /** Filter by one or more request kinds */
  kind?: RequestKind | RequestKind[]
  /** Filter by teamId */
  teamId?: string
  /** Filter by businessId */
  businessId?: string
  /** Filter by studioId */
  studioId?: string
}

// ============================================================================
// Patch type
// ============================================================================

/**
 * Allowed partial update to a LifecycleItem.
 *
 * Callers should prefer the dedicated transition methods (complete, reject,
 * escalate, cancel) which route through the request-lifecycle state machine.
 * `update` is available for metadata patches (title, description, priority,
 * assignee reassignment, etc.) that do not require a lifecycle transition.
 *
 * Immutable fields (id, kind, createdAt) are excluded from the patch type.
 */
export type LifecycleItemPatch = Partial<Omit<LifecycleItem, 'id' | 'kind' | 'createdAt'>>

// ============================================================================
// Response type (for complete / reject)
// ============================================================================

/**
 * Human-provided response for completing or rejecting a lifecycle item.
 *
 * Maps to the `Resolution` shape in request-lifecycle, but simplified for
 * store callers who don't need to build the full Resolution object.
 */
export interface LifecycleResponse {
  /**
   * Action verb describing what the human did.
   * Examples: 'approve', 'reject', 'answered', 'decided', 'reviewed', 'done', 'acknowledged'
   */
  verb: string
  /** Who provided the response (personId / assignee identifier) */
  resolvedBy: string
  /** When the response was provided (defaults to now) */
  resolvedAt?: Date
  /** Optional free-text comments */
  comments?: string
  /** Optional structured data (approval code, decision value, etc.) */
  data?: Record<string, unknown>
}

// ============================================================================
// LifecycleStore interface
// ============================================================================

/**
 * Persistence port for Human Function lifecycle items.
 *
 * Implementations must:
 * 1. Route status-changing operations through the request-lifecycle state
 *    machine (fail-closed on illegal transitions).
 * 2. Return LifecycleItem (never mutate in place without persisting).
 * 3. Throw on item-not-found (rather than returning null for mutations).
 *
 * Consumers are responsible for creating LifecycleItems with the correct
 * `id` and `createdAt` before calling `create`. The store persists as-is.
 */
export interface LifecycleStore {
  /**
   * Persist a new LifecycleItem.
   *
   * The item must have a unique `id`. The store does not generate IDs —
   * callers are responsible (use `crypto.randomUUID()` or equivalent).
   *
   * @throws if an item with the same `id` already exists
   */
  create(item: LifecycleItem): Promise<LifecycleItem>

  /**
   * Retrieve an item by ID.
   *
   * @returns the item, or null if not found
   */
  get(id: string): Promise<LifecycleItem | null>

  /**
   * Apply a partial update (metadata patch) to an existing item.
   *
   * Always sets `updatedAt` to the current time.
   * Does NOT enforce lifecycle transitions — use the dedicated methods for that.
   *
   * @throws if the item is not found
   */
  update(id: string, patch: LifecycleItemPatch): Promise<LifecycleItem>

  /**
   * List items, optionally filtered.
   *
   * Returns items ordered by priority (critical → low) then SLA proximity
   * (closest deadline first). The order matches `sortByPriorityThenSLA`.
   */
  list(filters?: LifecycleStoreFilters): Promise<LifecycleItem[]>

  /**
   * Mark a lifecycle item as completed.
   *
   * Routes through the request-lifecycle `resolve` transition:
   *   claimed | in_progress → completed
   *
   * @throws if the item is not found
   * @throws (as Error value embedded in returned Error) if the transition is illegal
   */
  complete(id: string, response: LifecycleResponse): Promise<LifecycleItem>

  /**
   * Reject a lifecycle item (records a 'reject' verb resolution).
   *
   * Routes through the request-lifecycle `resolve` transition with verb='reject':
   *   claimed | in_progress → completed
   *
   * Different from `cancel` — reject is a human decision; cancel is a
   * workflow-side cancellation before the human acts.
   *
   * @throws if the item is not found
   * @throws if the transition is illegal (not claimed or in_progress)
   */
  reject(id: string, reason: string, rejectedBy: string): Promise<LifecycleItem>

  /**
   * Escalate a lifecycle item to a new assignee.
   *
   * Routes through the request-lifecycle `escalate` transition:
   *   pending | claimed | in_progress → escalated
   *
   * Sets `assignee` to `toAssignee` so the escalation target receives the item.
   *
   * @throws if the item is not found
   * @throws if the transition is illegal (already terminal)
   */
  escalate(id: string, toAssignee: string): Promise<LifecycleItem>

  /**
   * Cancel a lifecycle item.
   *
   * Routes through the request-lifecycle `cancel` transition:
   *   pending | claimed | in_progress → cancelled
   *
   * @throws if the item is not found
   * @throws if the transition is illegal (already terminal)
   */
  cancel(id: string): Promise<LifecycleItem>

  /**
   * Reset the store to an empty state (for tests only).
   */
  reset(): void
}
