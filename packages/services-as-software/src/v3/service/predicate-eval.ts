/**
 * Real ProofPredicate evaluator for `Service.verify()` per v3 §10 + cluster-1
 * (sb-v3-migration) gap-fix.
 *
 * Replaces the `evaluator-pass`-only stub in `verify.ts`. Covers all 9 leaf
 * predicate kinds plus AND/OR composition:
 *
 *   1. `schema-match`            — Standard-Schema `~standard.validate` pass
 *   2. `evaluator-pass`          — verify-time PanelVerdict matches threshold
 *   3. `human-sign`              — recorded HumanSign event covers all roles
 *   4. `external`                — registered ExternalVerifier passes
 *   5. `load-bearing-pass`       — every `itemSet` rubric item passes
 *   6. `overall-floor`           — at least `minPasses` rubric items pass
 *   7. `unmet-requirements-pass` — no blocking unmet requirements (sb-n7d)
 *   8. `and`                     — all child predicates pass; first failure short-circuits
 *   9. `or`                      — first child to pass short-circuits; all-fail aggregates
 *
 * The evaluator is **side-effect free apart from the registered external
 * verifier's `verify()` call**. Failure surfaces aggregate via the returned
 * `failures: string[]` array — the v3 substrate (`verifyService`) folds these
 * into `VerificationFailure.detail` on the report.
 *
 * @packageDocumentation
 */

import type { ProofPredicate } from 'business-as-code/finance'
import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { PanelVerdict } from '../evaluator-panel.js'
import { getVerifier } from './external-verifiers.js'

// ============================================================================
// Public surface
// ============================================================================

/**
 * One rubric-item breakdown read by `load-bearing-pass` + `overall-floor`.
 *
 * Two pass-shapes coexist in the wild:
 *   - sb-style: `score: 0 | 1` (numeric)
 *   - v3 fixture-style: `passed: true | false` (boolean)
 *
 * The evaluator accepts either; `score === 1` OR `passed === true` counts as
 * a pass. Items that have neither set count as fail (defensive default).
 */
export interface RubricItemBreakdown {
  id: string
  score?: 0 | 1
  passed?: boolean
  /**
   * Whether this item is load-bearing for the current Service. Optional —
   * `load-bearing-pass` reads its own `itemSet`; this hint is informational
   * only (mirrors the sb killThreshold shape on `RuntimeUnitInput`).
   */
  loadBearing?: boolean
}

/**
 * One UnmetRequirement read by `unmet-requirements-pass` (sb-n7d).
 *
 * `severity: 'blocking'` items fail the predicate; `'warning'` items are
 * informational and never fail it. `category` is matched case-sensitively
 * against the predicate's optional `categories` filter.
 */
export interface UnmetRequirement {
  category: string
  description: string
  severity: 'blocking' | 'warning'
}

/**
 * Verify-time evaluation context aggregated by `verifyService` from a
 * fixture run. Each predicate kind reads at most one slot.
 */
export interface EvaluationContext {
  /** Cascade output, validated by `schema-match`. */
  output?: unknown
  /** Aggregate panel verdict, consumed by `evaluator-pass`. */
  panelVerdict?: PanelVerdict
  /**
   * Roles whose HumanSign event was recorded during the fixture run.
   * `human-sign` requires every role in `signerRoles` to be present.
   */
  humanSignatures?: { signerRole: string }[]
  /**
   * Pre-computed external-verifier results, keyed by verifier name. When a
   * predicate's verifier is present here, the evaluator skips the registry
   * lookup and uses the cached value (useful in tests + when verify-time
   * already ran the verifier inline). The runtime value is matched
   * structurally against the predicate's `spec` only when the cached value
   * is an `{ passed, detail }`-shaped record.
   */
  externalResults?: Record<string, unknown>
  /** Per-item rubric breakdown read by `load-bearing-pass` + `overall-floor`. */
  rubricBreakdown?: RubricItemBreakdown[]
  /** UnmetRequirement list read by `unmet-requirements-pass`. */
  unmetRequirements?: UnmetRequirement[]
}

/**
 * Result of evaluating one predicate.
 *
 * `passed` is authoritative; `failures` is an array of human-readable
 * diagnostics (one per failed leaf when AND-composed) suitable for surfacing
 * into `VerificationFailure.detail`.
 */
export interface PredicateEvalResult {
  passed: boolean
  failures: string[]
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Read whether a rubric item passes. Treats `score === 1` OR `passed === true`
 * as a pass; everything else is a fail (including missing/undefined).
 */
function rubricItemPassed(item: RubricItemBreakdown): boolean {
  if (item.passed === true) return true
  if (item.score === 1) return true
  return false
}

/**
 * Best-effort detection of a Standard-Schema-shaped validator. We accept
 * either a real `StandardSchemaV1` (`'~standard'` field present) OR a Zod
 * schema (`safeParse` method). Anything else fails the predicate with a
 * descriptive diagnostic — the predicate carries arbitrary `unknown`, so we
 * cannot let a bad schema silently approve.
 */
function isStandardSchema(s: unknown): s is StandardSchemaV1<unknown, unknown> {
  if (s === null || typeof s !== 'object') return false
  return '~standard' in s && typeof (s as { '~standard': unknown })['~standard'] === 'object'
}

interface ZodLikeSchema {
  safeParse(value: unknown): { success: boolean; error?: { message?: string } }
}

function isZodLike(s: unknown): s is ZodLikeSchema {
  if (s === null || typeof s !== 'object') return false
  return typeof (s as { safeParse?: unknown }).safeParse === 'function'
}

// ============================================================================
// Per-kind evaluators
// ============================================================================

function evalSchemaMatch(
  predicate: Extract<ProofPredicate, { kind: 'schema-match' }>,
  ctx: EvaluationContext
): PredicateEvalResult {
  if (ctx.output === undefined) {
    return {
      passed: false,
      failures: ['schema-match: no output captured during verify run'],
    }
  }
  const schema = predicate.schema
  if (isStandardSchema(schema)) {
    const result = schema['~standard'].validate(ctx.output)
    // Standard Schema returns `{ value }` on success or `{ issues }` on fail.
    // The result may be Promise-like, but verify-time wires only sync
    // validators today (mirrors how Schema<T> is consumed elsewhere in v3).
    if (result instanceof Promise) {
      return {
        passed: false,
        failures: ['schema-match: async Standard-Schema validators not yet supported'],
      }
    }
    if ('issues' in result && result.issues !== undefined) {
      const issueText = result.issues.map((i) => i.message ?? '(no message)').join('; ')
      return {
        passed: false,
        failures: [`schema-match: ${issueText || 'validation failed'}`],
      }
    }
    return { passed: true, failures: [] }
  }
  if (isZodLike(schema)) {
    const r = schema.safeParse(ctx.output)
    if (r.success) return { passed: true, failures: [] }
    const msg = r.error?.message ?? 'validation failed'
    return { passed: false, failures: [`schema-match: ${msg}`] }
  }
  return {
    passed: false,
    failures: ['schema-match: predicate.schema is neither Standard-Schema nor Zod-shaped'],
  }
}

function evalEvaluatorPass(
  predicate: Extract<ProofPredicate, { kind: 'evaluator-pass' }>,
  ctx: EvaluationContext
): PredicateEvalResult {
  const verdict = ctx.panelVerdict
  if (!verdict) {
    return {
      passed: false,
      failures: ['evaluator-pass: no PanelVerdict captured during verify run'],
    }
  }
  const { minScore } = predicate
  if (minScore === 'all-approved') {
    if (verdict.verdict === 'all-approved') return { passed: true, failures: [] }
    return {
      passed: false,
      failures: [
        `evaluator-pass: required 'all-approved', got '${verdict.verdict}' ` +
          `(${verdict.rejections.length} rejection${verdict.rejections.length === 1 ? '' : 's'})`,
      ],
    }
  }
  if (minScore === 'majority') {
    if (verdict.verdict === 'all-approved') return { passed: true, failures: [] }
    // 'partial' with > 50% approvals also satisfies majority.
    const total = verdict.approvals.length + verdict.rejections.length
    if (total > 0 && verdict.approvals.length > total / 2) {
      return { passed: true, failures: [] }
    }
    return {
      passed: false,
      failures: [
        `evaluator-pass: required 'majority', got ${verdict.approvals.length}/${total} approvals`,
      ],
    }
  }
  // Numeric threshold — count approvals against personas.
  const total = verdict.approvals.length + verdict.rejections.length
  const ratio = total === 0 ? 0 : verdict.approvals.length / total
  if (ratio >= minScore) return { passed: true, failures: [] }
  return {
    passed: false,
    failures: [
      `evaluator-pass: required ratio >= ${minScore}, got ${ratio.toFixed(3)} ` +
        `(${verdict.approvals.length}/${total})`,
    ],
  }
}

function evalHumanSign(
  predicate: Extract<ProofPredicate, { kind: 'human-sign' }>,
  ctx: EvaluationContext
): PredicateEvalResult {
  const sigs = ctx.humanSignatures ?? []
  if (sigs.length === 0) {
    // TODO(round 7+): drive this off the clarification-inbox HumanSign event
    // stream — until then, we fail closed when no Human is present in the
    // cascade. Tests can stub `humanSignatures` to exercise the pass path.
    return {
      passed: false,
      failures: [
        `human-sign: no HumanSign events captured (required roles: ${predicate.signerRoles.join(
          ', '
        )})`,
      ],
    }
  }
  const present = new Set(sigs.map((s) => s.signerRole))
  const missing = predicate.signerRoles.filter((r) => !present.has(r))
  if (missing.length === 0) return { passed: true, failures: [] }
  return {
    passed: false,
    failures: [`human-sign: missing signatures for role(s) [${missing.join(', ')}]`],
  }
}

async function evalExternal(
  predicate: Extract<ProofPredicate, { kind: 'external' }>,
  ctx: EvaluationContext
): Promise<PredicateEvalResult> {
  // Cached result short-circuit. Accept either `{ passed, detail }` or a raw
  // `boolean` (legacy callers).
  const cached = ctx.externalResults?.[predicate.verifier]
  if (cached !== undefined) {
    if (typeof cached === 'boolean') {
      if (cached) return { passed: true, failures: [] }
      return {
        passed: false,
        failures: [`external[${predicate.verifier}]: cached result was false`],
      }
    }
    if (cached !== null && typeof cached === 'object' && 'passed' in cached) {
      const r = cached as { passed: boolean; detail?: string }
      if (r.passed) return { passed: true, failures: [] }
      return {
        passed: false,
        failures: [
          `external[${predicate.verifier}]: ${r.detail ?? 'cached result reported failure'}`,
        ],
      }
    }
    // Unrecognised cached shape — fall through to the registry path.
  }
  const verifier = getVerifier(predicate.verifier)
  if (!verifier) {
    return {
      passed: false,
      failures: [
        `external[${predicate.verifier}]: no verifier registered for "${predicate.verifier}"`,
      ],
    }
  }
  try {
    const result = await verifier.verify(predicate.spec, ctx)
    if (result.passed) return { passed: true, failures: [] }
    return {
      passed: false,
      failures: [
        `external[${predicate.verifier}]: ${result.detail ?? 'verifier reported failure'}`,
      ],
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      passed: false,
      failures: [`external[${predicate.verifier}]: verifier threw — ${msg}`],
    }
  }
}

function evalLoadBearingPass(
  predicate: Extract<ProofPredicate, { kind: 'load-bearing-pass' }>,
  ctx: EvaluationContext
): PredicateEvalResult {
  const breakdown = ctx.rubricBreakdown ?? []
  if (predicate.itemSet.length === 0) return { passed: true, failures: [] }
  const byId = new Map(breakdown.map((b) => [b.id, b]))
  const missing: string[] = []
  const failed: string[] = []
  for (const id of predicate.itemSet) {
    const item = byId.get(id)
    if (item === undefined) {
      missing.push(id)
      continue
    }
    if (!rubricItemPassed(item)) failed.push(id)
  }
  if (missing.length === 0 && failed.length === 0) {
    return { passed: true, failures: [] }
  }
  const failures: string[] = []
  if (missing.length > 0) {
    failures.push(`load-bearing-pass: missing rubric item(s) [${missing.join(', ')}]`)
  }
  if (failed.length > 0) {
    failures.push(`load-bearing-pass: failing rubric item(s) [${failed.join(', ')}]`)
  }
  return { passed: false, failures }
}

function evalOverallFloor(
  predicate: Extract<ProofPredicate, { kind: 'overall-floor' }>,
  ctx: EvaluationContext
): PredicateEvalResult {
  const breakdown = ctx.rubricBreakdown ?? []
  let passes = 0
  for (const item of breakdown) if (rubricItemPassed(item)) passes++
  if (passes >= predicate.minPasses) return { passed: true, failures: [] }
  return {
    passed: false,
    failures: [
      `overall-floor: required ${predicate.minPasses} passes (of ${predicate.outOfTotal}), ` +
        `got ${passes} (rubricBreakdown size=${breakdown.length})`,
    ],
  }
}

function evalUnmetRequirementsPass(
  predicate: Extract<ProofPredicate, { kind: 'unmet-requirements-pass' }>,
  ctx: EvaluationContext
): PredicateEvalResult {
  const all = ctx.unmetRequirements ?? []
  const filtered =
    predicate.categories === undefined
      ? all
      : all.filter((u) => predicate.categories!.includes(u.category))
  const blocking = filtered.filter((u) => u.severity === 'blocking')
  if (blocking.length === 0) return { passed: true, failures: [] }
  const detail = blocking.map((u) => `${u.category}: ${u.description}`).join('; ')
  return {
    passed: false,
    failures: [`unmet-requirements-pass: ${blocking.length} blocking requirement(s) — ${detail}`],
  }
}

// ============================================================================
// Public dispatch
// ============================================================================

/**
 * Evaluate a {@link ProofPredicate} against an {@link EvaluationContext}.
 *
 * Returns a {@link PredicateEvalResult} carrying the boolean verdict and a
 * `failures: string[]` array suitable for surfacing into
 * `VerificationFailure.detail` on the report.
 *
 * AND short-circuits on the first failing child (preserves the failure
 * chain). OR short-circuits on the first passing child; when all children
 * fail, every child's failures aggregate into the result.
 */
export async function evaluatePredicate(
  predicate: ProofPredicate,
  ctx: EvaluationContext
): Promise<PredicateEvalResult> {
  switch (predicate.kind) {
    case 'schema-match':
      return evalSchemaMatch(predicate, ctx)
    case 'evaluator-pass':
      return evalEvaluatorPass(predicate, ctx)
    case 'human-sign':
      return evalHumanSign(predicate, ctx)
    case 'external':
      return evalExternal(predicate, ctx)
    case 'load-bearing-pass':
      return evalLoadBearingPass(predicate, ctx)
    case 'overall-floor':
      return evalOverallFloor(predicate, ctx)
    case 'unmet-requirements-pass':
      return evalUnmetRequirementsPass(predicate, ctx)
    case 'and': {
      const failures: string[] = []
      for (const child of predicate.predicates) {
        const r = await evaluatePredicate(child, ctx)
        if (!r.passed) {
          // Short-circuit: append this child's failures and return.
          failures.push(...r.failures)
          return { passed: false, failures }
        }
      }
      return { passed: true, failures: [] }
    }
    case 'or': {
      const aggregated: string[] = []
      for (const child of predicate.predicates) {
        const r = await evaluatePredicate(child, ctx)
        if (r.passed) return { passed: true, failures: [] }
        aggregated.push(...r.failures)
      }
      // All children failed — surface every failure for diagnostic clarity.
      return { passed: false, failures: aggregated }
    }
  }
}
