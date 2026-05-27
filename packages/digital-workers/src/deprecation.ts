/**
 * Deprecation telemetry — shared across the Layer 5 packages whose Verb
 * exports are being retired in favour of the unified `digital-workers`
 * action surface (PRD: route Layer 5 through digital-workers, aip-qozi /
 * aip-2q19 / aip-9l4r / aip-hhzf / aip-chuu).
 *
 * This module gives the deletion slice (aip-x6js) the evidence it needs to
 * confirm there are no remaining callers of the deprecated verbs before
 * removing the wrappers. Each first-time deprecation notice:
 *
 *   1. Logs to `console.warn` (so the developer sees it inline)
 *   2. Increments an in-memory counter keyed by `'<package>.<verb>'`
 *   3. Appends a `{ key, timestamp }` entry to an in-memory log
 *
 * Tests that exercise the wrappers themselves should NOT count for
 * production telemetry — they're testing the wrappers. Test files call
 * {@link resetDeprecationTelemetry} in their `beforeEach` to scope the
 * counts. Production callsites (which should be zero by the time the
 * deletion slice runs) never call reset, so any non-zero count there is a
 * real caller that still needs migration.
 *
 * Usage from a Layer 5 package's `actions.ts` / `helpers.ts`:
 *
 * ```ts
 * import { warnDeprecatedOnce } from 'digital-workers/deprecation'
 *
 * export function ask(...args) {
 *   warnDeprecatedOnce(
 *     'autonomous-agents.ask',
 *     '[autonomous-agents] DEPRECATED: ...'
 *   )
 *   // ... delegate to digital-workers.ask ...
 * }
 * ```
 *
 * Usage from CI / a guard script (aip-x6js):
 *
 * ```ts
 * import { getDeprecationCounts } from 'digital-workers/deprecation'
 *
 * // After running the production workload (or the full repo test suite
 * // minus the wrapper-internal tests):
 * const counts = getDeprecationCounts()
 * if (Object.keys(counts).length > 0) {
 *   throw new Error(`Deprecated verbs still in use: ${JSON.stringify(counts)}`)
 * }
 * ```
 *
 * @packageDocumentation
 */

/**
 * A telemetry entry recorded the first time a deprecated verb is called.
 *
 * `key` is the `'<package>.<verb>'` identifier (e.g. `'autonomous-agents.ask'`,
 * `'human-in-the-loop.approve'`, `'services-as-software.notify'`). `timestamp`
 * is `Date.now()` at the moment of the first call.
 */
export interface DeprecationLogEntry {
  key: string
  timestamp: number
}

/**
 * One-time deprecation notice tracker.
 *
 * @internal
 */
const notified = new Set<string>()

/**
 * Total times each deprecated key has been invoked (across all calls, not
 * just first-time). Useful evidence for the deletion slice: a non-zero
 * count means a real caller is still on the deprecated path.
 *
 * @internal
 */
const counts: Record<string, number> = {}

/**
 * Chronological log of every first-time deprecation notice.
 *
 * @internal
 */
const log: DeprecationLogEntry[] = []

/**
 * Log a deprecation notice once per process for the given key, and record
 * a telemetry entry every time (so callers can be counted, not just notified
 * once).
 *
 * - The console.warn fires at most once per `key` per process.
 * - {@link getDeprecationCounts} reflects EVERY call (not just first-time).
 * - {@link getDeprecationLog} captures only first-time entries (one per key).
 *
 * @param key   `'<package>.<verb>'` identifier (e.g. `'autonomous-agents.ask'`)
 * @param message Human-readable deprecation message logged to console.warn
 */
export function warnDeprecatedOnce(key: string, message: string): void {
  counts[key] = (counts[key] ?? 0) + 1
  if (notified.has(key)) return
  notified.add(key)
  log.push({ key, timestamp: Date.now() })
  console.warn(message)
}

/**
 * Read the current deprecation counts as a snapshot. The deletion slice
 * (aip-x6js) asserts this is empty before removing the wrappers.
 *
 * @returns A `{ key: count }` map. Empty if no deprecated verb has been
 *          called since process start (or since the last reset).
 */
export function getDeprecationCounts(): Record<string, number> {
  return { ...counts }
}

/**
 * Read the chronological log of first-time deprecation notices.
 *
 * @returns A copy of the log array (so callers can't mutate internal state).
 */
export function getDeprecationLog(): readonly DeprecationLogEntry[] {
  return log.slice()
}

/**
 * Reset all deprecation telemetry — counts, log, and the one-time notice
 * tracker. Intended for use in test `beforeEach` blocks that exercise the
 * deprecated wrappers themselves; production code should never call this.
 *
 * @internal
 */
export function resetDeprecationTelemetry(): void {
  notified.clear()
  for (const k of Object.keys(counts)) delete counts[k]
  log.length = 0
}
