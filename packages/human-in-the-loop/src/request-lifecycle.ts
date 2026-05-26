/**
 * request-lifecycle — pure state machine for Human Function requests.
 *
 * No I/O, no framework deps. Safe to import in any context (browser, workers,
 * Node, edge).
 *
 * Request kinds: approve | ask | decide | review | do | notify
 *
 * Status graph:
 *   pending     → claimed                          (claim)
 *   claimed     → in_progress                      (startProgress)
 *   claimed     → released                         (release)
 *   in_progress → released                         (release)
 *   in_progress → completed                        (resolve)
 *   claimed     → completed  (shortcut — no startProgress required)
 *   pending | claimed | in_progress → timeout      (timeout)
 *   pending | claimed | in_progress → escalated    (escalate)
 *   pending | claimed | in_progress → cancelled    (cancel)
 *
 * Fail-closed: invalid transitions return an Error, never mutate the input.
 *
 * All 6 request kinds (approve | ask | decide | review | do | notify) share
 * the same transition surface — kind-specific behaviour is encoded in the
 * item's payload fields, not in the state machine itself.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * The six kinds of Human Function requests.
 *
 * Extends the existing HumanRequest.type vocabulary (approval | question |
 * task | decision | review | notification) with the canonical single-word
 * verbs used by the Cascade execution model per CONTEXT.md.
 */
export type RequestKind = 'approve' | 'ask' | 'decide' | 'review' | 'do' | 'notify'

/**
 * Status of a lifecycle item.
 *
 * Extends HumanRequestStatus from types.ts with the management.studio-proven
 * status set (adds 'claimed' and 'released' for queue-hold semantics).
 */
export type LifecycleStatus =
  | 'pending' // Waiting — available to claim
  | 'claimed' // Locked by an assignee; others cannot claim
  | 'in_progress' // Actively being resolved
  | 'completed' // Resolved successfully
  | 'released' // Returned to queue from claimed/in_progress
  | 'timeout' // Exceeded SLA — awaiting escalation
  | 'escalated' // Manually or auto-escalated to a higher tier
  | 'cancelled' // Cancelled before completion

/**
 * Priority level for lifecycle items.
 *
 * Matches Priority from types.ts — re-declared here so this module has
 * no import dependencies (pure portability).
 */
export type LifecyclePriority = 'low' | 'normal' | 'high' | 'critical'

/**
 * A lightweight reference to the artifact (Object in the SVO triple)
 * being acted upon by a Human Function.
 */
export interface ArtifactRef {
  /** Resource kind (e.g. 'Invoice', 'Refund', 'PullRequest') */
  kind: string
  /** Unique ID of the artifact */
  id: string
  /** Human-readable title */
  title?: string
  /** URL to the artifact if navigable */
  url?: string
  /** Arbitrary context fields from the originating Workflow */
  context?: Record<string, unknown>
}

/**
 * Cascade provenance — where the Human Function originated.
 */
export interface CascadeRef {
  workflowId?: string
  workflowTitle?: string
  cascadeId?: string
  /** ID of the function that produced this item; used for escalation threading */
  functionId?: string
}

/**
 * The resolution recorded when a Human Function reaches 'completed'.
 */
export interface Resolution {
  /**
   * Action verb: 'approve' | 'reject' | 'answered' | 'decided' | 'reviewed' | 'done'
   * For 'notify' kind the typical verb is 'acknowledged'.
   */
  verb: string
  /** Who resolved it (personId / assignee identifier) */
  resolvedBy: string
  /** When it was resolved */
  resolvedAt: Date
  /** Optional comments from the resolver */
  comments?: string
  /** Arbitrary additional data (approval code, decision value, etc.) */
  data?: Record<string, unknown>
}

/**
 * A Human Function lifecycle item.
 *
 * This is the canonical upstream type. It reconciles with the management.studio
 * fixture HumanFunction shape (hitl-queue/types.ts) and extends the package's
 * existing HumanRequest<TInput, TOutput> with queue-specific fields.
 *
 * The state machine operates on this type.
 */
export interface LifecycleItem {
  /** Unique ID */
  id: string

  /** Request kind — drives resolution UI and verb set */
  kind: RequestKind

  /**
   * Kind-specific payload. Exactly one of these is populated based on `kind`:
   *   ask    → askPayload
   *   decide → decidePayload
   *   review → reviewPayload
   *   do     → doPayload
   *   approve / notify — no extra payload needed
   */
  askPayload?: {
    question: string
    suggestions?: string[]
    /** If set, the answer must be one of these values */
    outputSchema?: string[]
  }
  decidePayload?: {
    options: string[]
    criteria?: string
  }
  reviewPayload?: {
    content: string
    criteria?: string
  }
  doPayload?: {
    instructions: string
    tools?: string[]
  }

  /** Current lifecycle status */
  status: LifecycleStatus

  /** Priority — drives queue sort order */
  priority: LifecyclePriority

  /** Human-readable title */
  title: string

  /** Detailed description */
  description?: string

  /** The artifact (Thing) this Function is about — the Action Object */
  artifact: ArtifactRef

  // ── Assignee scope (must match vantage-resolver ResourceRef fields) ─────

  /** The Person (or team/role) this Function is assigned to */
  assignee: string

  /** Team scope */
  teamId?: string

  /** Business scope */
  businessId?: string

  /** Studio scope */
  studioId?: string

  // ── Cascade provenance ──────────────────────────────────────────────────

  cascade?: CascadeRef

  // ── Timing / SLA ────────────────────────────────────────────────────────

  /** When the Function was created */
  createdAt: Date

  /** When the SLA deadline fires */
  slaDeadline: Date

  /** When the item was last updated */
  updatedAt: Date

  /** Who claimed it (assignee identifier), if claimed */
  claimedBy?: string

  /** When it was claimed */
  claimedAt?: Date

  /** When it reached a terminal status */
  completedAt?: Date

  /** The resolution (set when status becomes 'completed') */
  resolution?: Resolution
}

// ============================================================================
// Transition input types
// ============================================================================

export interface ClaimInput {
  /** Identifier of the claimer (personId / assignee id) */
  claimedBy: string
  /** When the claim happened (defaults to now) */
  claimedAt?: Date
}

export interface StartProgressInput {
  /** When work started (defaults to now) */
  startedAt?: Date
}

export interface ReleaseInput {
  /** Identifier of who released the item */
  releasedBy: string
}

export interface ResolveInput {
  /** Action verb: 'approve' | 'reject' | 'answered' | 'decided' | 'reviewed' | 'done' */
  verb: string
  /** Who resolved it */
  resolvedBy: string
  /** When resolved (defaults to now) */
  resolvedAt?: Date
  /** Optional comments */
  comments?: string
  /** Optional arbitrary additional data */
  data?: Record<string, unknown>
}

export interface TimeoutInput {
  /** When the timeout occurred (defaults to now) */
  timedOutAt?: Date
}

export interface EscalateInput {
  /** When escalation occurred (defaults to now) */
  escalatedAt?: Date
  /** Optional human-readable reason for escalation */
  reason?: string
}

export interface CancelInput {
  /** When cancellation occurred (defaults to now) */
  cancelledAt?: Date
  /** Optional reason for cancellation */
  reason?: string
}

// ============================================================================
// Internal helpers
// ============================================================================

/** The set of statuses that are still "active" (can be transitioned). */
const ACTIVE_STATUSES: LifecycleStatus[] = ['pending', 'claimed', 'in_progress']

function isActive(item: LifecycleItem): boolean {
  return ACTIVE_STATUSES.includes(item.status)
}

function invalidTransition(item: LifecycleItem, verb: string, allowed: LifecycleStatus[]): Error {
  return new Error(
    `request-lifecycle: cannot ${verb} item "${item.id}" — ` +
      `current status is "${item.status}"; ` +
      `required one of: ${allowed.join(', ')}.`
  )
}

// ============================================================================
// Priority rank (highest first) — used by sortByPriorityThenSLA
// ============================================================================

const PRIORITY_RANK: Record<LifecyclePriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
  low: 0,
}

// ============================================================================
// Transitions
// ============================================================================

/**
 * claim — pending → claimed
 *
 * Locks the item to a specific claimer so others cannot claim it.
 * Fail-closed: returns Error if item is not pending.
 */
export function claim(item: LifecycleItem, input: ClaimInput): LifecycleItem | Error {
  if (item.status !== 'pending') {
    return invalidTransition(item, 'claim', ['pending'])
  }
  const now = input.claimedAt ?? new Date()
  return {
    ...item,
    status: 'claimed',
    claimedBy: input.claimedBy,
    claimedAt: now,
    updatedAt: now,
  }
}

/**
 * startProgress — claimed → in_progress
 *
 * Moves from claimed to in_progress (work has started).
 * Fail-closed: returns Error if item is not claimed.
 */
export function startProgress(
  item: LifecycleItem,
  input: StartProgressInput
): LifecycleItem | Error {
  if (item.status !== 'claimed') {
    return invalidTransition(item, 'startProgress', ['claimed'])
  }
  const now = input.startedAt ?? new Date()
  return {
    ...item,
    status: 'in_progress',
    updatedAt: now,
  }
}

/**
 * release — claimed | in_progress → released
 *
 * Returns the item to the queue (e.g. IC cannot handle it right now).
 * Strips claimer info so the item is available for re-claiming.
 * Fail-closed: returns Error if item is not claimed or in_progress.
 */
export function release(item: LifecycleItem, input: ReleaseInput): LifecycleItem | Error {
  if (item.status !== 'claimed' && item.status !== 'in_progress') {
    return invalidTransition(item, 'release', ['claimed', 'in_progress'])
  }
  const now = new Date()
  // Omit claimedBy and claimedAt (exactOptionalPropertyTypes: strip by spreading without them)
  const { claimedBy: _claimedBy, claimedAt: _claimedAt, ...rest } = item
  return {
    ...rest,
    status: 'released',
    updatedAt: now,
  }
}

/**
 * resolve — in_progress | claimed → completed
 *
 * Records the final resolution (approve, reject, answered, decided, etc.).
 *
 * UX note: claim → (optional startProgress) → resolve.
 * Resolving directly from 'claimed' is allowed as a shortcut for
 * approve/reject flows where clicking a button is the entire resolution.
 *
 * Fail-closed: returns Error if item is not in_progress or claimed.
 */
export function resolve(item: LifecycleItem, input: ResolveInput): LifecycleItem | Error {
  if (item.status !== 'in_progress' && item.status !== 'claimed') {
    return invalidTransition(item, 'resolve', ['in_progress', 'claimed'])
  }
  const now = input.resolvedAt ?? new Date()
  const resolution: Resolution = {
    verb: input.verb,
    resolvedBy: input.resolvedBy,
    resolvedAt: now,
    ...(input.comments !== undefined ? { comments: input.comments } : {}),
    ...(input.data !== undefined ? { data: input.data } : {}),
  }
  return {
    ...item,
    status: 'completed',
    completedAt: now,
    updatedAt: now,
    resolution,
  }
}

/**
 * timeout — pending | claimed | in_progress → timeout
 *
 * SLA breach: item was not resolved in time.
 * Fail-closed: returns Error if item is already terminal.
 */
export function timeout(item: LifecycleItem, input: TimeoutInput): LifecycleItem | Error {
  if (!isActive(item)) {
    return invalidTransition(item, 'timeout', ACTIVE_STATUSES)
  }
  const now = input.timedOutAt ?? new Date()
  return {
    ...item,
    status: 'timeout',
    updatedAt: now,
  }
}

/**
 * escalate — pending | claimed | in_progress → escalated
 *
 * Manual or policy-driven escalation to a higher tier.
 * Fail-closed: returns Error if item is already terminal.
 */
export function escalate(item: LifecycleItem, input: EscalateInput): LifecycleItem | Error {
  if (!isActive(item)) {
    return invalidTransition(item, 'escalate', ACTIVE_STATUSES)
  }
  const now = input.escalatedAt ?? new Date()
  return {
    ...item,
    status: 'escalated',
    updatedAt: now,
  }
}

/**
 * cancel — pending | claimed | in_progress → cancelled
 *
 * Workflow-side cancellation before resolution.
 * Fail-closed: returns Error if item is already terminal.
 */
export function cancel(item: LifecycleItem, input: CancelInput): LifecycleItem | Error {
  if (!isActive(item)) {
    return invalidTransition(item, 'cancel', ACTIVE_STATUSES)
  }
  const now = input.cancelledAt ?? new Date()
  return {
    ...item,
    status: 'cancelled',
    updatedAt: now,
  }
}

// ============================================================================
// Queries
// ============================================================================

/**
 * forAssignee — filter items by assignee identifier.
 *
 * Returns only items where item.assignee === assigneeId.
 * Does NOT filter by status — callers can filter further if needed.
 * Pure — does not mutate the input array.
 */
export function forAssignee(items: LifecycleItem[], assigneeId: string): LifecycleItem[] {
  return items.filter((item) => item.assignee === assigneeId)
}

/**
 * sortByPriorityThenSLA — sort items for queue display.
 *
 * Primary:   priority descending (critical → high → normal → low).
 * Secondary: SLA proximity ascending (closest to deadline first).
 *
 * Items with the same priority that are closest to their SLA deadline
 * appear first — i.e., the most urgent work bubbles to the top.
 *
 * Pure — does not mutate the input array.
 */
export function sortByPriorityThenSLA(items: LifecycleItem[], now: Date): LifecycleItem[] {
  return [...items].sort((a, b) => {
    // 1. Priority descending
    const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (priorityDiff !== 0) return priorityDiff

    // 2. SLA proximity ascending (smaller time-to-deadline = more urgent)
    const aMs = a.slaDeadline.getTime() - now.getTime()
    const bMs = b.slaDeadline.getTime() - now.getTime()
    return aMs - bMs
  })
}

/**
 * timeToDeadline — milliseconds until the SLA deadline from `now`.
 *
 * Negative value means SLA has already breached.
 */
export function timeToDeadline(item: LifecycleItem, now: Date): number {
  return item.slaDeadline.getTime() - now.getTime()
}

/**
 * isBreached — true if the SLA deadline has passed.
 */
export function isBreached(item: LifecycleItem, now: Date): boolean {
  return timeToDeadline(item, now) < 0
}
