/**
 * EvalLogStore — pluggable persistence primitive for trace/eval entries.
 *
 * Exports the {@link EvalLogStore} contract, the
 * {@link InMemoryEvalLogStore} default implementation, and a global
 * accessor pair (`getEvalLogStore` / `configureEvalLogStore`) mirroring the
 * marketplace persistence pattern from round 9.
 *
 * @packageDocumentation
 */

import { InMemoryEvalLogStore } from './in-memory.js'
import type { EvalLogStore } from './types.js'

export type { EvalLogEntry, EvalLogListOptions, EvalLogStore } from './types.js'
export { InMemoryEvalLogStore } from './in-memory.js'

// ============================================================================
// Global accessor (lazy default + override)
// ============================================================================

let _store: EvalLogStore | null = null

/**
 * Get the global {@link EvalLogStore}. Lazily constructs an
 * {@link InMemoryEvalLogStore} on first call when no store has been
 * configured.
 *
 * Match the round-9 marketplace persistence accessor: callers that don't
 * care about isolation read the global; callers that do (tests, multi-tenant
 * apps) install their own via {@link configureEvalLogStore}.
 */
export function getEvalLogStore(): EvalLogStore {
  if (_store === null) {
    _store = new InMemoryEvalLogStore()
  }
  return _store
}

/**
 * Install a global {@link EvalLogStore}. Pass `null` to reset to the lazy
 * in-memory default (useful in test teardown).
 */
export function configureEvalLogStore(store: EvalLogStore | null): void {
  _store = store
}
