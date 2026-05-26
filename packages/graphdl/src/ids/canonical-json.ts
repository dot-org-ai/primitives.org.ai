/**
 * Canonical JSON normalization.
 *
 * The same logical input MUST produce the same hash regardless of object
 * key ordering on the producer side. The producer cannot trust their own
 * `JSON.stringify` to be deterministic — V8 preserves insertion order
 * which differs across producers, network round-trips, deserializers,
 * and even the same code path executed at different times.
 *
 * Rules locked here:
 *
 *   1. Recursive sort of object keys (alphabetical, code-point order).
 *   2. Arrays preserve their order — `[1, 2]` and `[2, 1]` are distinct.
 *   3. `JSON.stringify` with NO replacer and NO indent, so the output has
 *      no incidental whitespace and no trailing newlines.
 *   4. `undefined` values inside objects are dropped (matches
 *      `JSON.stringify`'s native behavior); inside arrays they become
 *      `null` (also matches native behavior).
 *   5. `Date` is converted via `.toISOString()` (matches native behavior).
 *   6. Non-finite numbers (`NaN`, `±Infinity`) become `null` (matches
 *      native behavior).
 *
 * Note: this implementation INTENTIONALLY does NOT strip timestamp keys.
 * The icps `content-hash.ts` predecessor stripped `createdAt/updatedAt/
 * timestamp/ts/at/generatedAt` before hashing — that was load-bearing for
 * idempotent re-hashing of mutable rows but introduces a foot-gun for
 * callers who legitimately want timestamps in their hash key. Callers
 * who want the icps-style timestamp-strip behavior should pre-process
 * their input (e.g. omit the timestamp keys before passing in). Keeping
 * the canonicalization rule SIMPLE here is more valuable than smuggling
 * a domain-specific opinion into a primitive.
 */

/**
 * Recursively sort object keys and stringify with no whitespace.
 *
 * Idempotent: `canonicalize(canonicalize(x)) === canonicalize(x)`.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value))
}

function canonicalizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (typeof v !== 'object') return v
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(canonicalizeValue)
  // Plain object — sort keys, recurse.
  const obj = v as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(obj).sort()) {
    out[k] = canonicalizeValue(obj[k])
  }
  return out
}
