/**
 * Re-verify policy — ADR-0006 field-diff classifier.
 *
 * `Service.publish()` consults {@link requiresReverify} to decide whether the
 * latest {@link VerificationReport} is still valid for the current spec. Per
 * ADR-0006:
 *
 *   - Behavioral fields (cascade, tool perms, schemas, evaluators, predicate,
 *     per-cascade-Function oversight) → re-verify required when changed.
 *   - Cosmetic fields (pricing, UI shape overrides, name/promise/description,
 *     lineage, tags, category) → no re-verify required.
 *
 * Implementation is a path walker: paths in {@link BEHAVIORAL_FIELDS} are
 * resolved on both prev + current; the first mismatch (deep-equal) triggers
 * re-verify. Cascade-step `oversight.mode` is checked across every Function
 * in `binding.cascade`.
 *
 * @packageDocumentation
 */

import type { ServiceInstance } from '../service.js'

// ============================================================================
// Behavioral field paths (ADR-0006 table)
// ============================================================================

/**
 * Dot-path list of fields that, when changed, invalidate a prior
 * {@link VerificationReport}. Per ADR-0006.
 *
 * `binding.cascade[*].oversight.mode` is handled explicitly in
 * {@link requiresReverify} (not via this list) because dot-path notation
 * doesn't capture the array iteration cleanly.
 */
export const BEHAVIORAL_FIELDS: readonly string[] = [
  'binding.cascade',
  'binding.toolPermissions',
  'schema.input',
  'schema.output',
  'evaluators.personas',
  'outcomeContract.predicate',
]

// ============================================================================
// Path walk + deep equality
// ============================================================================

/**
 * Resolve a dot-path into a value. Returns `undefined` for any missing
 * segment. Arrays are walked as object property lookups.
 */
function getByPath(root: unknown, path: string): unknown {
  if (root === null || root === undefined) return undefined
  let cur: unknown = root
  const parts = path.split('.')
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/**
 * Conservative structural equality. Catches:
 *   - primitives via `===`
 *   - arrays of equal length with element-wise deep equality
 *   - plain objects (constructor === Object) with key-set equality
 *
 * Anything else (functions, class instances) falls back to `===`. That is
 * deliberate for the re-verify path — a class-instance change is treated as
 * "different" by reference identity, which is what we want for round 4.
 *
 * Standard-Schema validators are functions internally and so will compare by
 * reference; round-5 work may swap this for a content-hash comparator.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(b)) return false

  // Plain-object compare. For class instances + exotic objects we fall through
  // to the ref check at top, which already returned false above.
  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false
    }
  }
  return true
}

// ============================================================================
// Cascade-Function oversight comparison
// ============================================================================

interface CascadeStepLite {
  $id?: string
  name?: string
  oversight?: { mode?: unknown }
}

/**
 * Compare per-cascade-Function `oversight.mode` between prev + current.
 * Returns `true` if any Function in the cascade has a different oversight
 * mode (added, removed, or changed).
 */
function cascadeOversightChanged(
  prev: ServiceInstance<unknown, unknown>,
  current: ServiceInstance<unknown, unknown>
): boolean {
  const prevSteps = (prev.binding?.cascade ?? []) as unknown as CascadeStepLite[]
  const currentSteps = (current.binding?.cascade ?? []) as unknown as CascadeStepLite[]

  if (prevSteps.length !== currentSteps.length) return true

  for (let i = 0; i < prevSteps.length; i++) {
    const p = prevSteps[i]
    const c = currentSteps[i]
    const pMode = p?.oversight?.mode
    const cMode = c?.oversight?.mode
    if (pMode !== cMode) return true
  }
  return false
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Return `true` iff the spec changed in a way that invalidates the prior
 * {@link VerificationReport} per ADR-0006.
 *
 * Compares each {@link BEHAVIORAL_FIELDS} path with {@link deepEqual}, then
 * walks the cascade for per-Function `oversight.mode` differences.
 */
export function requiresReverify(
  prevVerifiedSpec: ServiceInstance<unknown, unknown>,
  currentSpec: ServiceInstance<unknown, unknown>
): boolean {
  for (const path of BEHAVIORAL_FIELDS) {
    const prev = getByPath(prevVerifiedSpec, path)
    const curr = getByPath(currentSpec, path)
    if (!deepEqual(prev, curr)) return true
  }
  if (cascadeOversightChanged(prevVerifiedSpec, currentSpec)) return true
  return false
}
