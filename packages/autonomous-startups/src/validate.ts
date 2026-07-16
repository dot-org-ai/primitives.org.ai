// =====================================================================================
// validateStartup — readiness validation that RETURNS issues, never throws.
//
// The checks are keyed to the lifecycle: a construct must satisfy the invariants of its
// current state (and every state below it). A startup at `sellable` must have something to
// sell; a startup at `running` must have a workforce to run it. Issues carry a stable
// code, a severity, the path they concern, and a human-readable message, so callers can
// route them without string-matching prose.
// =====================================================================================

import type { AutonomousStartup } from './startup.js'
import type { Worker } from './composition.js'
import type { LifecycleState } from './lifecycle.js'
import { LIFECYCLE_STATES } from './lifecycle.js'

export type IssueSeverity = 'error' | 'warning'

/** One problem found on a startup construct. */
export interface ValidationIssue {
  /** Stable machine-readable code (e.g. `workforce.empty`). */
  readonly code: string
  /** `error` blocks validity; `warning` is advisory. */
  readonly severity: IssueSeverity
  /** Dotted path to the offending part of the construct. */
  readonly path: string
  /** Human-readable explanation. */
  readonly message: string
}

/** The outcome of validating a startup construct. */
export interface ValidationResult {
  /** True when there are no `error`-severity issues. */
  readonly valid: boolean
  /** Every issue found, errors and warnings alike. */
  readonly issues: readonly ValidationIssue[]
}

const ORDINAL: Record<LifecycleState, number> = {
  idea: 0,
  named: 1,
  sited: 2,
  sellable: 3,
  running: 4,
}

const WORKER_TYPES: ReadonlySet<string> = new Set(['agent', 'human'])

/**
 * Validate a startup construct against the invariants of its lifecycle state. Never
 * throws — every problem is returned as a typed issue.
 */
export function validateStartup(startup: AutonomousStartup<LifecycleState>): ValidationResult {
  const issues: ValidationIssue[] = []
  const at = ORDINAL[startup.state]
  const { composition } = startup

  if (startup.name.trim().length === 0) {
    issues.push({
      code: 'name.empty',
      severity: 'error',
      path: 'name',
      message: 'A startup requires a non-empty name.',
    })
  }

  if (!LIFECYCLE_STATES.includes(startup.state)) {
    issues.push({
      code: 'state.unknown',
      severity: 'error',
      path: 'state',
      message: `Unknown lifecycle state: ${String(startup.state)}.`,
    })
  }

  // The business model is the one always-required register.
  if (composition.business === undefined || composition.business === null) {
    issues.push({
      code: 'business.missing',
      severity: 'error',
      path: 'composition.business',
      message: 'A startup requires a business model (business-as-code).',
    })
  }

  // Every worker declares whether an agent or a human performs it.
  composition.workforce.forEach((worker: Worker, i: number) => {
    const type = (worker as { type?: unknown }).type
    if (typeof type !== 'string' || !WORKER_TYPES.has(type)) {
      issues.push({
        code: 'worker.type.invalid',
        severity: 'error',
        path: `composition.workforce[${i}].type`,
        message: "Each worker must declare type 'agent' or 'human' (digital-workers).",
      })
    }
  })

  // Sellable and beyond: there must be something to sell.
  if (at >= ORDINAL.sellable && composition.offers.length === 0 && composition.products.length === 0) {
    issues.push({
      code: 'sellable.nothing-to-sell',
      severity: 'error',
      path: 'composition',
      message: 'A sellable startup needs at least one offer (services-as-software) or product (digital-products).',
    })
  }

  // Running: there must be a workforce to run it.
  if (at >= ORDINAL.running && composition.workforce.length === 0) {
    issues.push({
      code: 'running.no-workforce',
      severity: 'error',
      path: 'composition.workforce',
      message: 'A running startup needs at least one worker to perform its work (digital-workers).',
    })
  }

  // Advisory: an idle-but-not-yet-running startup with no workforce is worth flagging early.
  if (at < ORDINAL.running && composition.workforce.length === 0) {
    issues.push({
      code: 'workforce.empty',
      severity: 'warning',
      path: 'composition.workforce',
      message: 'No workforce declared yet; a running startup will need one.',
    })
  }

  // Advisory: a startup that wields no tools is unusual for an autonomous operation.
  if (composition.tools.length === 0) {
    issues.push({
      code: 'tools.empty',
      severity: 'warning',
      path: 'composition.tools',
      message: 'No tools declared (digital-tools); an autonomous startup usually wields some.',
    })
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  }
}
