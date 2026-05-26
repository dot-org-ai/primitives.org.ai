/**
 * escalation-engine — pure SLA evaluation and escalation decision engine.
 *
 * No I/O, no framework deps. Safe to import in any context (browser, workers,
 * Node, edge).
 *
 * Core API:
 *   evaluateEscalation(item, policy, now) → EscalationDecision
 *
 * Properties:
 *   - Idempotent: re-evaluating an already-escalated or terminal item is a no-op.
 *   - Timeout-vs-not: only triggers if the SLA deadline has passed.
 *   - Policy-driven routing: the Vantage ladder IC→Team→Business→Studio.
 *   - Pure: no side effects — the caller is responsible for applying the decision.
 */

import type { LifecycleItem, LifecyclePriority } from './request-lifecycle.js'

// ============================================================================
// Public types
// ============================================================================

/**
 * A lightweight reference to an escalation assignee.
 *
 * Matches management.studio's PersonRef shape — a pointer into the
 * id.org.ai identity graph (opaque string + enough display metadata
 * for audit logs and UI rendering).
 */
export interface AssigneeRef {
  /** Unique assignee identifier (personId / team ID / role ID) */
  assigneeId: string
  /** Display name for audit log legibility */
  name: string
  /**
   * Vantage role kind of this escalation target.
   * Drives routing verification and display labels.
   */
  roleKind: 'ic' | 'team' | 'business' | 'studio'
}

/**
 * One tier in an escalation ladder.
 *
 * `afterMs` is the cumulative milliseconds past `slaDeadline` after which
 * this level activates. Level 0 fires immediately on breach (afterMs = 0).
 */
export interface EscalationLevel {
  /** Who receives the item at this escalation level */
  assignee: AssigneeRef
  /**
   * Cumulative milliseconds past `slaDeadline` before this level fires.
   * 0 = fires immediately on SLA breach; positive = additional grace period.
   */
  afterMs: number
}

/**
 * An EscalationPolicy defines when and how a past-SLA item is routed.
 *
 * Extends / replaces the package's existing EscalationPolicy from types.ts
 * with the management.studio-proven AssigneeRef shape instead of bare strings.
 *
 * The engine evaluates `conditions` to decide whether to escalate;
 * `escalationPath[0]` is the first escalation target on SLA breach.
 */
export interface EscalationPolicy {
  /** Unique identifier for the policy */
  id: string
  /** Human-readable name */
  name: string
  /**
   * Conditions that trigger escalation.
   * The engine checks `timeout` (SLA breach) as the primary condition.
   */
  conditions: {
    /**
     * Escalate if the item is still active after this many milliseconds
     * past its `slaDeadline`. 0 = escalate immediately on breach.
     */
    timeout?: number
    /**
     * Only escalate items at or above this priority level.
     * Undefined = escalate all priorities.
     */
    minPriority?: LifecyclePriority
  }
  /**
   * Ordered list of escalation levels.
   *
   * Level 0 fires on the first SLA breach (afterMs = 0 by convention).
   * Subsequent levels define additional grace periods for further escalation.
   *
   * The engine applies the highest level whose `afterMs` threshold has been
   * reached given the current `now` vs `slaDeadline` delta.
   */
  escalationPath: EscalationLevel[]
}

/**
 * The decision returned by evaluateEscalation.
 *
 * When `escalate` is true, `nextAssignee` will be populated and `reason`
 * will contain a human-readable explanation.
 *
 * When `escalate` is false, `reason` explains why escalation was skipped
 * (within-SLA, already terminal, no policy, priority below threshold, etc.).
 */
export interface EscalationDecision {
  /** Whether the item should be escalated */
  escalate: boolean
  /** The recommended next assignee (populated when escalate=true) */
  nextAssignee?: AssigneeRef
  /** Human-readable reason for the decision */
  reason?: string
}

// ============================================================================
// Priority ordering (for minPriority threshold check)
// ============================================================================

const PRIORITY_RANK: Record<LifecyclePriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
  low: 0,
}

function meetsMinPriority(
  itemPriority: LifecyclePriority,
  minPriority: LifecyclePriority | undefined
): boolean {
  if (minPriority === undefined) return true
  return PRIORITY_RANK[itemPriority] >= PRIORITY_RANK[minPriority]
}

// ============================================================================
// Core engine
// ============================================================================

/**
 * evaluateEscalation — pure escalation decision function.
 *
 * Given a lifecycle item, an escalation policy, and the current time,
 * returns an EscalationDecision:
 *   { escalate: true,  nextAssignee, reason } → caller should escalate
 *   { escalate: false, reason }               → no action needed
 *
 * Idempotency contract:
 *   - Already-terminal items (timeout, escalated, completed, cancelled,
 *     released) always return escalate=false.
 *   - Running over the same active item before SLA breach returns false.
 *   - Running over the same active item after SLA breach returns true (once);
 *     after the caller applies the timeout transition the item becomes
 *     terminal and subsequent calls return false.
 *
 * The function applies the highest-level escalation path entry whose
 * `afterMs` threshold has been met:
 *   overdueMsFromSla = now - slaDeadline
 *   highest level where level.afterMs <= overdueMsFromSla
 *
 * This enables multi-hop escalation ladders where level 1 fires immediately
 * and level 2 fires after another N hours of silence.
 *
 * @param item   - The lifecycle item to evaluate
 * @param policy - The escalation policy to apply
 * @param now    - Current time (injectable for deterministic tests)
 */
export function evaluateEscalation(
  item: LifecycleItem,
  policy: EscalationPolicy,
  now: Date
): EscalationDecision {
  // 1. Idempotency: terminal or released items are never re-escalated.
  const terminalStatuses = ['completed', 'cancelled', 'timeout', 'escalated', 'released']
  if (terminalStatuses.includes(item.status)) {
    return {
      escalate: false,
      reason: `item "${item.id}" is already in terminal status "${item.status}" — no-op`,
    }
  }

  // 2. Priority threshold check.
  if (!meetsMinPriority(item.priority, policy.conditions.minPriority)) {
    return {
      escalate: false,
      reason: `item "${item.id}" priority "${item.priority}" is below policy minPriority "${policy.conditions.minPriority}"`,
    }
  }

  // 3. SLA breach check — policy.conditions.timeout is the grace period
  //    in ms past the SLA deadline before escalation fires. Default is 0.
  const gracePeriodMs = policy.conditions.timeout ?? 0
  const msSinceSla = now.getTime() - item.slaDeadline.getTime()

  if (msSinceSla < gracePeriodMs) {
    // Either within SLA or within the grace period — not yet.
    if (msSinceSla < 0) {
      return {
        escalate: false,
        reason: `item "${item.id}" SLA deadline has not passed (${Math.abs(
          msSinceSla
        )}ms remaining)`,
      }
    }
    return {
      escalate: false,
      reason: `item "${item.id}" is within grace period (${msSinceSla}ms past SLA, grace=${gracePeriodMs}ms)`,
    }
  }

  // 4. No escalation path defined.
  if (policy.escalationPath.length === 0) {
    return {
      escalate: false,
      reason: `policy "${policy.id}" has no escalation path defined`,
    }
  }

  // 5. Select the appropriate level.
  //    Apply the highest level whose afterMs threshold has been reached.
  const eligibleLevels = policy.escalationPath.filter((level) => msSinceSla >= level.afterMs)

  if (eligibleLevels.length === 0) {
    return {
      escalate: false,
      reason: `no escalation level threshold met yet for item "${item.id}"`,
    }
  }

  // Pick the highest eligible level (last in the sorted array by afterMs).
  const selectedLevel = eligibleLevels.reduce((best, level) =>
    level.afterMs >= best.afterMs ? level : best
  )

  return {
    escalate: true,
    nextAssignee: selectedLevel.assignee,
    reason: `SLA breached by ${msSinceSla}ms — escalating to "${selectedLevel.assignee.name}" (${selectedLevel.assignee.roleKind})`,
  }
}

// ============================================================================
// Vantage escalation ladder (canonical policy factory)
// ============================================================================

/**
 * buildVantageLadder — build the standard IC→Team→Business→Studio escalation
 * policy for a given IC assignee.
 *
 * The Vantage hierarchy (per CONTEXT.md):
 *   IC (widest operational view) → Team manager → Business operator → Studio operator
 *
 * This factory produces a single-hop policy (escalationPath[0] only) for
 * the given assignee → nextAssignee pair. Chain multiple policies (one per
 * level) or supply a multi-step escalationPath for multi-hop escalation.
 *
 * @param id           - Policy ID (must be unique in the policy registry)
 * @param name         - Human-readable policy name
 * @param nextAssignee - The AssigneeRef to escalate to on SLA breach
 * @param opts         - Optional overrides (gracePeriodMs, minPriority)
 */
export function buildVantageLadder(
  id: string,
  name: string,
  nextAssignee: AssigneeRef,
  opts?: {
    /** Grace period in ms past the SLA before escalation fires. Default 0. */
    gracePeriodMs?: number
    /** Only escalate items at or above this priority. Default: all. */
    minPriority?: LifecyclePriority
  }
): EscalationPolicy {
  const gracePeriodMs = opts?.gracePeriodMs ?? 0
  const conditions: EscalationPolicy['conditions'] = { timeout: gracePeriodMs }
  if (opts?.minPriority !== undefined) {
    conditions.minPriority = opts.minPriority
  }
  return {
    id,
    name,
    conditions,
    escalationPath: [
      {
        assignee: nextAssignee,
        afterMs: gracePeriodMs,
      },
    ],
  }
}

// ============================================================================
// Built-in Vantage fixture policies (IC→Team→Business→Studio)
// ============================================================================
//
// These use the canonical fixture assignee IDs from management.studio.
// They can be overridden / replaced by consumers who bring their own
// identity graph (id.org.ai lookup, database, etc.).
//

/** Fixture: IC-tier assignee (Alex Rivera) */
export const FIXTURE_IC: AssigneeRef = {
  assigneeId: 'person-alex',
  name: 'Alex Rivera',
  roleKind: 'ic',
}

/** Fixture: Team-tier assignee (Sam Okafor) */
export const FIXTURE_TEAM: AssigneeRef = {
  assigneeId: 'person-sam',
  name: 'Sam Okafor',
  roleKind: 'team',
}

/** Fixture: Business-tier assignee (Jordan Chen) */
export const FIXTURE_BUSINESS: AssigneeRef = {
  assigneeId: 'person-jordan',
  name: 'Jordan Chen',
  roleKind: 'business',
}

/** Fixture: Studio-tier assignee (Morgan Park) */
export const FIXTURE_STUDIO: AssigneeRef = {
  assigneeId: 'person-morgan',
  name: 'Morgan Park',
  roleKind: 'studio',
}

/**
 * FIXTURE_POLICIES — the default Vantage escalation map.
 *
 * Keyed by `assigneeId` so callers can look up a policy for the item's
 * current assignee:
 *
 * ```ts
 * const policy = FIXTURE_POLICIES[item.assignee]
 * if (!policy) { ... } // Studio operator (no further escalation)
 * ```
 */
export const FIXTURE_POLICIES: Record<string, EscalationPolicy> = {
  [FIXTURE_IC.assigneeId]: buildVantageLadder(
    'policy-ic-to-team',
    'IC → Team manager on SLA breach',
    FIXTURE_TEAM
  ),
  [FIXTURE_TEAM.assigneeId]: buildVantageLadder(
    'policy-team-to-business',
    'Team manager → Business operator on SLA breach',
    FIXTURE_BUSINESS
  ),
  [FIXTURE_BUSINESS.assigneeId]: buildVantageLadder(
    'policy-business-to-studio',
    'Business operator → Studio operator on SLA breach',
    FIXTURE_STUDIO
  ),
  // FIXTURE_STUDIO has no further escalation target — not in the map.
}

/**
 * getFixturePolicy — look up the default Vantage escalation policy for an
 * assignee ID.
 *
 * Returns `undefined` for the Studio operator (Morgan) or any unknown
 * assignee — caller should treat undefined as "no escalation available".
 */
export function getFixturePolicy(assigneeId: string): EscalationPolicy | undefined {
  return FIXTURE_POLICIES[assigneeId]
}

// ============================================================================
// Batch escalation tick helper
// ============================================================================

/**
 * batchEvaluate — evaluate escalation for a list of items.
 *
 * For each item, looks up the policy (via the policyLookup function),
 * calls evaluateEscalation, and collects the decisions.
 *
 * Returns a flat list of { item, decision } pairs for ALL items — callers
 * filter on `decision.escalate` to find items that need action.
 *
 * @param items        - Items to evaluate
 * @param policyLookup - Function mapping assigneeId → EscalationPolicy | undefined
 * @param now          - Current time
 */
export function batchEvaluate(
  items: LifecycleItem[],
  policyLookup: (assigneeId: string) => EscalationPolicy | undefined,
  now: Date
): Array<{
  item: LifecycleItem
  policy: EscalationPolicy | undefined
  decision: EscalationDecision
}> {
  return items.map((item) => {
    const policy = policyLookup(item.assignee)
    if (!policy) {
      return {
        item,
        policy: undefined,
        decision: {
          escalate: false,
          reason: `no escalation policy found for assignee "${item.assignee}"`,
        },
      }
    }
    return {
      item,
      policy,
      decision: evaluateEscalation(item, policy, now),
    }
  })
}

/**
 * buildEscalatedItem — build a new LifecycleItem for the escalation target.
 *
 * Copies the original item's content but:
 *   - Assigns a new ID (prefixed with 'esc-' + original ID + timestamp)
 *   - Sets status to 'pending' (target needs to claim it)
 *   - Reassigns assignee to the next assignee
 *   - Clears claimer info (target hasn't claimed it yet)
 *   - Sets a fresh SLA deadline (preserves original SLA duration)
 *   - Embeds the original item's ID in cascade.functionId for traceability
 *   - Preserves teamId/businessId/studioId (work still belongs to same scope)
 *   - Prepends "[Escalated] " to the title so the target sees context
 *
 * This is a pure helper — the caller is responsible for persisting the result.
 */
export function buildEscalatedItem(
  original: LifecycleItem,
  nextAssignee: AssigneeRef,
  now: Date
): LifecycleItem {
  // Preserve original SLA duration for the new item's deadline
  const originalSlaDuration = original.slaDeadline.getTime() - original.createdAt.getTime()
  const newSlaDeadline = new Date(now.getTime() + originalSlaDuration)

  // Strip optional fields that must not carry over (exactOptionalPropertyTypes compliance)
  const {
    claimedBy: _claimedBy,
    claimedAt: _claimedAt,
    completedAt: _completedAt,
    resolution: _resolution,
    ...rest
  } = original

  return {
    ...rest,
    id: `esc-${original.id}-${now.getTime()}`,
    status: 'pending',
    assignee: nextAssignee.assigneeId,
    createdAt: now,
    slaDeadline: newSlaDeadline,
    updatedAt: now,
    // Thread the original item's ID through cascade provenance
    cascade: {
      ...original.cascade,
      functionId: original.id,
    },
    title: `[Escalated] ${original.title}`,
  }
}
