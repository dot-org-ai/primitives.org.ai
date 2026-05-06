/**
 * `Service` namespace + factory exports for the v3 Service primitive (§5).
 *
 * Per v3 §5 the value-vs-type rename:
 *   - `Service`         (this namespace value)         — `Service.define`, `Service.fromFunction`, `Service.load`
 *   - `ServiceInstance` (the type, in `../service.ts`) — what the factories return
 *
 * @packageDocumentation
 */

import { define } from './define.js'
import { fromFunction } from './from-function.js'
import { load } from './load.js'
import { collection } from './collection.js'

// ============================================================================
// Namespace value
// ============================================================================

/**
 * The `Service` namespace value. Carries the four factory functions per
 * v3 §5 + ADR-0005:
 *   - `define`        — full specs
 *   - `fromFunction`  — migrating existing `ai-functions` calls
 *   - `load`          — fetching published Services from the marketplace
 *   - `collection`    — paginated catalog read-path (round-13, ADR-0005)
 */
export const Service = {
  define,
  fromFunction,
  load,
  collection,
}

// ============================================================================
// Re-exports
// ============================================================================

export { define, fromFunction, load, collection }

export type { FromFunctionOpts } from './from-function.js'

export { ServiceLifecycle, ServicePublishError, type ServiceLifecycleState } from './lifecycle.js'

export { mintServiceId } from './mint-id.js'

export {
  expandDoSugar,
  NotImplementedError,
  type ServiceSpecWithDoSugar,
  type TierZeroDoCallback,
} from './expand-do-sugar.js'
