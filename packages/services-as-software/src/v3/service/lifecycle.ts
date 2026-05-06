/**
 * ServiceLifecycle — mint-side FSM for the Service primitive (v3 §10).
 *
 * One of two FSMs locked in v3 §3 decision (9): `ServiceLifecycle` (mint side,
 * here) and `InvocationLifecycle` (deliver side, lands in `./invoke/*`).
 *
 * The lifecycle tracks a Service through five states:
 *
 *   `draft`      → registered by `Service.define()` (this round, round 3)
 *   `verified`   → set by `Service.verify()`     (round 5)
 *   `published`  → set by `Service.publish()`    (round 5)
 *   `retired`    → set by `Service.retire()`     (this round)
 *   `discarded`  → terminal failure / explicit drop (round 5+)
 *
 * Transitions follow the diagram in v3 §10:
 *
 *   draft --verify--> verified --publish--> published --retire--> retired
 *     \                  \                                          ^
 *      \                  \--------(skipReverify=false fails)-------/
 *       \--discard--> discarded   (any state may discard)
 *
 * **Persistence is in-process only** for this round. Real persistence
 * (Cloudflare KV / D1 / Iceberg per ADR-0005) lands in round 5+ alongside
 * `Service.publish()` real wiring. The in-process Map is intentionally
 * module-local — multi-tenant runtimes constructing per-request registries
 * land later as part of the production hardening work.
 *
 * @packageDocumentation
 */

import type { ServiceInstance, MarketplaceListing, VerificationReport } from '../service.js'

// ============================================================================
// State enum
// ============================================================================

/**
 * The five states a Service may occupy on the mint side. See module-level
 * doc for the transition diagram.
 */
export type ServiceLifecycleState = 'draft' | 'verified' | 'published' | 'retired' | 'discarded'

// ============================================================================
// Errors
// ============================================================================

/**
 * Error class for invalid lifecycle transitions on the publish path.
 *
 * - `code: 'NOT_FOUND'`  — the serviceId is not registered in the lifecycle
 *                          (the service was never `Service.define()`d, or its
 *                          registry entry was evicted).
 * - `code: 'UNVERIFIED'` — `Service.publish()` was called before
 *                          `Service.verify()` produced a VerificationReport
 *                          (per v3 §11 re-verify policy).
 */
export class ServicePublishError extends Error {
  readonly code: 'UNVERIFIED' | 'NOT_FOUND'

  constructor(opts: { code: 'UNVERIFIED' | 'NOT_FOUND'; serviceId: string; message?: string }) {
    super(opts.message ?? `ServicePublishError(${opts.code}): ${opts.serviceId}`)
    this.name = 'ServicePublishError'
    this.code = opts.code
  }
}

// ============================================================================
// Internal registry entry
// ============================================================================

/**
 * Per-service registry entry. Holds the current state, the materialised
 * `ServiceInstance`, and (when relevant) the latest `VerificationReport` and
 * `MarketplaceListing` once those rounds wire through.
 */
interface ServiceLifecycleEntry {
  state: ServiceLifecycleState
  service: ServiceInstance<unknown, unknown>
  verificationReport?: VerificationReport
  marketplaceListing?: MarketplaceListing
  retiredAt?: string
  retiredReason?: string
  discardedAt?: string
  discardedReason?: string
}

const registry = new Map<string, ServiceLifecycleEntry>()

// ============================================================================
// FSM API — `ServiceLifecycle` namespace
// ============================================================================

/**
 * Mint-side lifecycle FSM. All mutations route through this namespace so the
 * registry stays consistent and round-5 persistence has a single seam.
 */
export const ServiceLifecycle = {
  /**
   * Register a freshly-defined Service in the `draft` state. Called by
   * `Service.define()` immediately after the spec is normalised.
   *
   * Re-registering the same `$id` is treated as an idempotent overwrite — the
   * common case is hot-reload during development. Production callers should
   * not rely on this and round-5 persistence may make it an error.
   */
  draft(svc: ServiceInstance<unknown, unknown>): void {
    registry.set(svc.$id, { state: 'draft', service: svc })
  },

  /**
   * Mark a Service as `verified`, attaching the {@link VerificationReport}
   * for downstream `publish()` to consult. Round-5 work.
   */
  markVerified(serviceId: string, report: VerificationReport): void {
    const entry = registry.get(serviceId)
    if (!entry) throw new ServicePublishError({ code: 'NOT_FOUND', serviceId })
    entry.state = 'verified'
    entry.verificationReport = report
  },

  /**
   * Mark a Service as `published`, attaching the resulting
   * {@link MarketplaceListing}. Throws `ServicePublishError({code:'UNVERIFIED'})`
   * unless the Service is currently in `verified` state — see
   * {@link canPublish}. Round-5 work.
   */
  markPublished(serviceId: string, listing: MarketplaceListing): void {
    const entry = registry.get(serviceId)
    if (!entry) throw new ServicePublishError({ code: 'NOT_FOUND', serviceId })
    if (entry.state !== 'verified') {
      throw new ServicePublishError({ code: 'UNVERIFIED', serviceId })
    }
    entry.state = 'published'
    entry.marketplaceListing = listing
  },

  /**
   * Mark a Service as `retired`. Pending invocations drain per the existing
   * SLA (round-4 invoke FSM enforcement); no new invocations are accepted.
   *
   * Calling `markRetired` on an unknown serviceId is a no-op — retirement is
   * eventually-consistent and the registry entry may already have been
   * evicted by other paths.
   */
  markRetired(serviceId: string, reason?: string): void {
    const entry = registry.get(serviceId)
    if (!entry) return
    entry.state = 'retired'
    entry.retiredAt = new Date().toISOString()
    if (reason !== undefined) entry.retiredReason = reason
  },

  /**
   * Mark a Service as `discarded` — terminal failure path. Distinct from
   * `retired` in that discarded Services were never published or were
   * explicitly dropped before any invocations occurred.
   */
  markDiscarded(serviceId: string, reason?: string): void {
    const entry = registry.get(serviceId)
    if (!entry) return
    entry.state = 'discarded'
    entry.discardedAt = new Date().toISOString()
    if (reason !== undefined) entry.discardedReason = reason
  },

  /**
   * Look up the current state of a Service. Returns `undefined` when the
   * Service is unknown to the registry (never registered, or evicted).
   */
  getState(serviceId: string): ServiceLifecycleState | undefined {
    return registry.get(serviceId)?.state
  },

  /**
   * True iff the Service is currently in `verified` state and may be
   * published. `Service.publish()` consults this before mutating state.
   */
  canPublish(serviceId: string): boolean {
    return registry.get(serviceId)?.state === 'verified'
  },

  /**
   * Retrieve the latest {@link VerificationReport} for a Service, if one has
   * been produced. Round-5 publish gates use this.
   */
  getVerificationReport(serviceId: string): VerificationReport | undefined {
    return registry.get(serviceId)?.verificationReport
  },

  /**
   * Retrieve the latest {@link MarketplaceListing} for a Service, if one has
   * been produced. Round-5 publish gates use this.
   */
  getMarketplaceListing(serviceId: string): MarketplaceListing | undefined {
    return registry.get(serviceId)?.marketplaceListing
  },

  /**
   * Retrieve the registered ServiceInstance (e.g. for `Service.load()` once
   * round-5 persistence wires through). Returns `undefined` for unknown ids.
   */
  getService(serviceId: string): ServiceInstance<unknown, unknown> | undefined {
    return registry.get(serviceId)?.service
  },

  /**
   * Test seam: clear the in-process registry. Production code never calls
   * this; tests use it to isolate state between cases.
   */
  __resetForTests(): void {
    registry.clear()
  },
}
