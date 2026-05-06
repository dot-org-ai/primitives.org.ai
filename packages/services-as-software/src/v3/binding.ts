/**
 * ServiceBinding — declarative wiring of a Service to its cascade, tool
 * permissions, clarification policy, and (NEW in v3) trigger routing.
 *
 * Per v3 §6, three of the five seed catalog Services need declarative
 * mid-cascade routing (`reconciliation_break > $100`, `confidence < 0.7`,
 * `revenue > $100M`). Triggers are evaluated against each cascade-step's
 * inferred output type; the first matching trigger fires, dispatching to a
 * named target Function (`route-to`), an {@link OversightPolicy} escalation
 * (`escalate`), or a deterministic resolution (`auto-fail` / `auto-accept`).
 *
 * @packageDocumentation
 */

import type { FunctionRef } from 'digital-tools'

// ============================================================================
// Out-of-cascade trigger targets
// ============================================================================

/**
 * Well-known target names for `BindingTrigger.action === 'route-to'` that
 * resolve OUTSIDE the current Service's cascade — typically sibling Services
 * or human-handoff queues. The runtime dispatches these via cross-cascade
 * routing once that lands (round 9+); until then, the Service.define()
 * validator simply allows them through with an internal note.
 *
 * Kept as a `Set<string>` (not a string-literal union) so adapters can
 * augment the catalogue at runtime without a type change here.
 */
export const OUT_OF_CASCADE_TARGETS: ReadonlySet<string> = new Set([
  'csm-handoff',
  'collections-handoff',
  'human-agent',
  'sdr-review',
  'cfo-review',
  'attorney-review',
  'controller-review',
])

/**
 * Error thrown by `Service.define()` when a {@link BindingTrigger} declares a
 * `target` that is neither a {@link FunctionRef.name} in the cascade nor one
 * of the {@link OUT_OF_CASCADE_TARGETS} well-known handoffs.
 *
 * The thrown error includes both the offending target and the list of valid
 * in-cascade names so catalog authors get an immediately-actionable hint.
 */
export class ServiceDefineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServiceDefineError'
  }
}

/**
 * Validate {@link ServiceBinding.triggers} against the cascade.
 *
 * For each trigger with `action === 'route-to'`:
 *   - if `target` matches a {@link FunctionRef.name} in `cascade` → OK
 *   - else if `target` is in {@link OUT_OF_CASCADE_TARGETS} → OK
 *     (cross-cascade dispatch lands round 9+)
 *   - else → throw {@link ServiceDefineError} with the valid names listed
 *
 * Triggers with `action !== 'route-to'` (escalate / auto-fail / auto-accept)
 * skip the target check — those actions don't need a target.
 *
 * `'route-to'` triggers MUST declare a `target`; missing target throws.
 */
export function validateTriggers(
  cascade: ReadonlyArray<FunctionRef>,
  triggers: ReadonlyArray<BindingTrigger> | undefined,
  serviceName: string
): void {
  if (!triggers || triggers.length === 0) return

  const inCascadeNames = new Set(cascade.map((fn) => fn.name))

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i]!
    if (trigger.action !== 'route-to') continue

    if (trigger.target === undefined) {
      throw new ServiceDefineError(
        `Service.define(${JSON.stringify(serviceName)}): binding.triggers[${i}] has ` +
          `action: 'route-to' but no 'target' is declared.`
      )
    }

    if (inCascadeNames.has(trigger.target)) continue
    if (OUT_OF_CASCADE_TARGETS.has(trigger.target)) continue

    const validInCascade = [...inCascadeNames].map((n) => JSON.stringify(n)).join(', ')
    const validOutOfCascade = [...OUT_OF_CASCADE_TARGETS].map((n) => JSON.stringify(n)).join(', ')
    throw new ServiceDefineError(
      `Service.define(${JSON.stringify(serviceName)}): binding.triggers[${i}].target ` +
        `${JSON.stringify(
          trigger.target
        )} is not a known cascade Function name or out-of-cascade ` +
        `handoff target. Valid in-cascade names: ${validInCascade}. ` +
        `Valid out-of-cascade handoffs: ${validOutOfCascade}.`
    )
  }
}

// ============================================================================
// Trigger routing (NEW in v3 §6)
// ============================================================================

/**
 * Action a {@link BindingTrigger} performs when its predicate is true.
 *
 * - `route-to`     — dispatch to a named FunctionRef (or HumanFunction); the
 *                    cascade resumes at that step. Requires `target`.
 * - `escalate`     — hand off to an EvaluatorPanel / human reviewer per the
 *                    Service's {@link OversightPolicy}.
 * - `auto-fail`    — terminate the invocation with an `OutcomeNotMet` failure.
 * - `auto-accept`  — terminate the invocation as `OutcomeMet` (used when the
 *                    cascade short-circuits early on a definitive signal).
 */
export type BindingTriggerAction = 'route-to' | 'escalate' | 'auto-fail' | 'auto-accept'

/**
 * Declarative routing rule fired after each cascade step.
 *
 * `when` is a string predicate compiled at `Service.define()` time against
 * the inferred output types of preceding cascade steps + invocation context.
 * The string form keeps triggers serialisable (so they survive `Service.publish()`
 * and persistence in the catalog database) without forcing a closure type.
 *
 * `target` is required when `action === 'route-to'`; type-checking against
 * the cascade's FunctionRef names lives in the cascade compiler, not in this
 * primitive shape.
 */
export interface BindingTrigger {
  /**
   * Expression evaluated against cascade-step output + invocation context.
   *
   * Examples (per v3 §6):
   *   - `'reconciliation_break.amount > 10000n'`
   *   - `'classify.confidence < 0.7'`
   *   - `'enrichment.company.revenue > 100_000_000_00n'`
   */
  when: string
  /** What to do when {@link when} is true. */
  action: BindingTriggerAction
  /** Required for `action === 'route-to'`; FunctionRef or HumanFunction name. */
  target?: string
}

// ============================================================================
// Clarification policy
// ============================================================================

/**
 * Trigger conditions that can request a clarification round-trip from the
 * caller. v3 §11 keeps this set small so customer-facing copy can pre-render
 * the prompt for each case.
 */
export type ClarificationTrigger =
  | 'schema-validation-fail'
  | 'evaluator-uncertainty'
  | 'binding-explicit'

/**
 * Policy controlling when (and how often) a Service may pause an invocation
 * to request clarification from the caller.
 *
 * Discriminated on `enabled`:
 *   - `{ enabled: false }` — clarification is disabled; no other fields needed.
 *   - `{ enabled: true; maxRoundTrips; escalateTo; triggers? }` — full shape.
 *
 * When enabled, `maxRoundTrips` caps the dialogue depth before falling through
 * to `escalateTo` (typically a human reviewer or panel); `triggers` declares
 * which mid-cascade signals are allowed to start a clarification — schema
 * validation failures and evaluator uncertainty are the two common ones, plus
 * an explicit programmatic request from the binding (`binding-explicit`).
 */
export type ClarificationPolicy =
  | {
      enabled: false
      /**
       * Optional hard cap retained on the disabled variant for symmetry; the
       * runtime ignores it when `enabled === false`.
       */
      maxRoundTrips?: number
      /**
       * Optional escalation target retained on the disabled variant for
       * symmetry; the runtime ignores it when `enabled === false`.
       */
      escalateTo?: string
      triggers?: ClarificationTrigger[]
    }
  | {
      enabled: true
      /** Hard cap on clarification round-trips before escalation. */
      maxRoundTrips: number
      /** Worker / role / panel ref to escalate to once `maxRoundTrips` exceeded. */
      escalateTo: string
      /** Signals that may start a clarification round; defaults to all three. */
      triggers?: ClarificationTrigger[]
    }

// ============================================================================
// ServiceBinding
// ============================================================================

/**
 * Declarative wiring between a Service and the cascade that fulfils it.
 *
 * The binding is persisted as part of the Service definition, surfaces in
 * the customer-runtime UI (which can render the cascade step-by-step), and
 * is the authoritative source for the runtime's invocation orchestration.
 */
export interface ServiceBinding {
  /**
   * Ordered list of {@link FunctionRef}s comprising the cascade. Each step's
   * inferred output type feeds the next; the trigger compiler narrows on the
   * types returned by preceding steps.
   */
  cascade: FunctionRef[]
  /**
   * Tool-permission scope strings (e.g. `'github.repos'`, `'fs.read'`) that
   * any agentic Function in the cascade may request. Per-Function
   * `toolPermissions` must be a subset of this set.
   */
  toolPermissions: string[]
  /** Clarification round-trip policy; required (but may have `enabled: false`). */
  clarificationPolicy: ClarificationPolicy
  /** Optional declarative routing rules per v3 §6; evaluated post-step. */
  triggers?: BindingTrigger[]
}
