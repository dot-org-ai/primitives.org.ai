/**
 * InvokeOpts — options accepted by `service.invoke()` per v3 §5.
 *
 * Carries the buyer-facing knobs the v3 design pinned: `worker` (the buyer
 * Worker — Person / Agent / Role per commerce topology), `idempotencyKey`
 * (de-dupes identical re-tries), `budget` (per-invocation cost ceiling),
 * `priority` (queue ordering hint), and `tenantRef` (logical tenant for
 * isolation per ADR-0007).
 *
 * The shape stays small and string-keyed — additional fields land additively.
 *
 * @packageDocumentation
 */

import type { Money } from 'autonomous-finance'

// ============================================================================
// WorkerRef — loose for now
// ============================================================================

/**
 * Reference to the buyer Worker (Person / Agent / Role) on whose behalf the
 * invocation runs. Loose `string` today (typically an MDXLD `$id` like
 * `'worker:person:alice'` or `'worker:agent:nightly-bookkeeper'`); tightens to
 * a branded type once `digital-workers` ships its `WorkerRef` brand.
 *
 * TODO(future): replace with the branded `WorkerRef` from `digital-workers`.
 */
export type WorkerRef = string

// ============================================================================
// InvokeOpts
// ============================================================================

/**
 * Options accepted by `service.invoke(input, opts)`.
 *
 * All fields optional — the runtime falls back to context defaults
 * (`AsyncLocalStorage` per `ai-functions` `withContext`) when omitted.
 */
export interface InvokeOpts {
  /**
   * Buyer Worker the invocation runs on behalf of. Used by the FSM to
   * attribute cost, route HITL clarifications back to the originating buyer,
   * and apply earned-autonomy policies.
   */
  worker?: WorkerRef
  /**
   * Caller-supplied idempotency key. Two invocations with the same `(svc.$id,
   * idempotencyKey)` pair short-circuit to the original handle (per v3 §5).
   */
  idempotencyKey?: string
  /**
   * Per-invocation cost ceiling. The runtime emits `'failed'` with
   * `reason: 'budget-exceeded'` if the cumulative cost (across cascade
   * Functions + evaluator panel) would exceed this {@link Money} amount.
   */
  budget?: Money
  /**
   * Queue priority hint. Drives ordering in the durable execution backend
   * (CF Workflows per ADR-0004). Defaults to `'normal'`.
   */
  priority?: 'low' | 'normal' | 'high'
  /**
   * Logical tenant the invocation runs under (per ADR-0007). When omitted,
   * resolved from context.
   */
  tenantRef?: string
}
