/**
 * InvocationLifecycle FSM — the deliver-side state machine per v3 §10.
 *
 * v3 §10 pins **11 customer-visible states** the buyer (and customer-runtime
 * UI) can observe while an invocation is in flight, plus three **terminal /
 * branch** states (`CANCELLED`, `FAILED`, `CLOSED`) the runtime uses to
 * unambiguously close out an invocation. The full set ships here as a single
 * union so exhaustive `switch` statements narrow correctly.
 *
 * The mapping back to the 11-state v3 customer-visible lifecycle (per v3 §10):
 *
 *   ORDERED → ONBOARDING → ACTIVE ↔ DELIVERING ↔ NEEDS_CLARIFICATION
 *           → QUALITY_REVIEW → DELIVERED → ACCEPTED | DISPUTED
 *           → ESCALATED_TO_HUMAN_REVIEW → REFUNDED | CLOSED
 *
 * Plus terminals reachable from anywhere: `CANCELLED` (caller cancelled before
 * delivery) and `FAILED` (deterministic failure: timeout, evaluator-blocked,
 * budget-exceeded, external-failure).
 *
 * This module is the **source of truth** for the FSM. The mock cascade walker
 * in `runtime.ts` consumes {@link TRANSITIONS} and {@link canTransition}; the
 * future durable adapter (per ADR-0004 / CF Workflows) will too.
 *
 * @packageDocumentation
 */

// ============================================================================
// State enum
// ============================================================================

/**
 * Every state an invocation can occupy. The 11 customer-visible states are
 * authoritative per v3 §10; the 3 additional terminals (`CANCELLED`, `FAILED`,
 * `CLOSED`) are runtime-internal but observable on the handle.
 *
 * Use `isTerminal(state)` to test for end-of-life and `isWaitingOnCustomer`
 * for the "buyer must act" subset (NEEDS_CLARIFICATION + DELIVERED).
 */
export type InvocationState =
  | 'ORDERED'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'DELIVERING'
  | 'NEEDS_CLARIFICATION'
  | 'QUALITY_REVIEW'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'DISPUTED'
  | 'ESCALATED_TO_HUMAN_REVIEW'
  | 'REFUNDED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'FAILED'

// ============================================================================
// Transition table
// ============================================================================

/**
 * One legal edge in the FSM. `trigger` names the runtime event that drives
 * the transition (the cascade walker, the buyer's `clarify()` reply, the
 * evaluator panel sign-off, the timeout sweep, etc).
 */
export interface Transition {
  from: InvocationState
  to: InvocationState
  trigger: string
}

/**
 * Full transition table per v3 §10. Order is conventional (forward-progress
 * first, escalation/cancellation last) so a reader can scan top-to-bottom and
 * see the happy path.
 */
export const TRANSITIONS: readonly Transition[] = [
  // ---- forward-progress (happy path) -------------------------------------
  { from: 'ORDERED', to: 'ONBOARDING', trigger: 'order-accepted' },
  { from: 'ONBOARDING', to: 'ACTIVE', trigger: 'onboarding-complete' },
  { from: 'ACTIVE', to: 'DELIVERING', trigger: 'cascade-start' },
  { from: 'DELIVERING', to: 'QUALITY_REVIEW', trigger: 'cascade-complete' },
  { from: 'QUALITY_REVIEW', to: 'DELIVERED', trigger: 'evaluators-approved' },
  { from: 'DELIVERED', to: 'ACCEPTED', trigger: 'buyer-accept' },

  // ---- clarification round-trips (suspend/resume) ------------------------
  { from: 'DELIVERING', to: 'NEEDS_CLARIFICATION', trigger: 'clarification-needed' },
  { from: 'ACTIVE', to: 'NEEDS_CLARIFICATION', trigger: 'clarification-needed' },
  { from: 'NEEDS_CLARIFICATION', to: 'DELIVERING', trigger: 'clarification-resolved' },
  { from: 'NEEDS_CLARIFICATION', to: 'ACTIVE', trigger: 'clarification-resolved' },

  // ---- evaluator rejection loops back ------------------------------------
  { from: 'QUALITY_REVIEW', to: 'DELIVERING', trigger: 'evaluators-rejected-retry' },

  // ---- dispute → escalate → refund | close -------------------------------
  { from: 'DELIVERED', to: 'DISPUTED', trigger: 'buyer-dispute' },
  { from: 'ACCEPTED', to: 'DISPUTED', trigger: 'buyer-dispute' },
  { from: 'DISPUTED', to: 'ESCALATED_TO_HUMAN_REVIEW', trigger: 'dispute-escalated' },
  { from: 'ESCALATED_TO_HUMAN_REVIEW', to: 'REFUNDED', trigger: 'human-rules-refund' },
  { from: 'ESCALATED_TO_HUMAN_REVIEW', to: 'CLOSED', trigger: 'human-rules-no-refund' },

  // ---- cancellation (caller-initiated) — reachable anywhere pre-terminal -
  { from: 'ORDERED', to: 'CANCELLED', trigger: 'caller-cancel' },
  { from: 'ONBOARDING', to: 'CANCELLED', trigger: 'caller-cancel' },
  { from: 'ACTIVE', to: 'CANCELLED', trigger: 'caller-cancel' },
  { from: 'DELIVERING', to: 'CANCELLED', trigger: 'caller-cancel' },
  { from: 'NEEDS_CLARIFICATION', to: 'CANCELLED', trigger: 'caller-cancel' },
  { from: 'QUALITY_REVIEW', to: 'CANCELLED', trigger: 'caller-cancel' },

  // ---- deterministic failure (timeout / evaluator-blocked / budget / external) --
  { from: 'ORDERED', to: 'FAILED', trigger: 'failure' },
  { from: 'ONBOARDING', to: 'FAILED', trigger: 'failure' },
  { from: 'ACTIVE', to: 'FAILED', trigger: 'failure' },
  { from: 'DELIVERING', to: 'FAILED', trigger: 'failure' },
  { from: 'NEEDS_CLARIFICATION', to: 'FAILED', trigger: 'failure' },
  { from: 'QUALITY_REVIEW', to: 'FAILED', trigger: 'failure' },
]

// ============================================================================
// Predicates
// ============================================================================

/**
 * True for the five end-of-life states (no outbound transitions).
 *
 * Terminals: `ACCEPTED`, `REFUNDED`, `CLOSED`, `CANCELLED`, `FAILED`.
 */
export function isTerminal(state: InvocationState): boolean {
  switch (state) {
    case 'ACCEPTED':
    case 'REFUNDED':
    case 'CLOSED':
    case 'CANCELLED':
    case 'FAILED':
      return true
    case 'ORDERED':
    case 'ONBOARDING':
    case 'ACTIVE':
    case 'DELIVERING':
    case 'NEEDS_CLARIFICATION':
    case 'QUALITY_REVIEW':
    case 'DELIVERED':
    case 'DISPUTED':
    case 'ESCALATED_TO_HUMAN_REVIEW':
      return false
  }
}

/**
 * True when the runtime is parked waiting for the buyer to take action — the
 * customer-runtime UI should render a primary CTA in these states.
 *
 * Waiting-on-customer: `NEEDS_CLARIFICATION` (answer the question) and
 * `DELIVERED` (accept or dispute the result).
 */
export function isWaitingOnCustomer(state: InvocationState): boolean {
  return state === 'NEEDS_CLARIFICATION' || state === 'DELIVERED'
}

/**
 * Test whether a `from → to` transition is permitted by the table.
 *
 * Used by the runtime's transition guard so an out-of-band trigger (a stale
 * timeout, a duplicate clarification reply, a buyer disputing an already-
 * disputed invocation) is rejected at the FSM boundary rather than silently
 * corrupting state.
 */
export function canTransition(from: InvocationState, to: InvocationState): boolean {
  for (const t of TRANSITIONS) {
    if (t.from === from && t.to === to) return true
  }
  return false
}
