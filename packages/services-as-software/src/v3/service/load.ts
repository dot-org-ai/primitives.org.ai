/**
 * `Service.load()` — load a previously-published Service from the marketplace.
 *
 * Round-15+ implementation. Hydrates a {@link ServiceInstance} from the
 * persisted {@link MarketplaceListing} + {@link RuntimeUnit} pair emitted by
 * `Service.publish()`. The load reverses the publish-time projection:
 *
 *   - {@link MarketplaceListing} contributes the catalog-side denormalized
 *     fields (`name`, `promise`, `description`, `audience`, `archetype`,
 *     `lineage`) plus the pre-rendered UI shapes (`rendered.{catalog,order,
 *     onboarding,delivery,portal}`).
 *   - {@link RuntimeUnit} contributes the runtime-side fields (`schema`,
 *     `binding`, `evaluators`, `outcomeContract`, `oversight`, `pricing`,
 *     `refundContract`, `authorityBoundary`).
 *
 * The hydrated value is registered in {@link ServiceLifecycle} as `'published'`
 * — load implies the service was published before, so the FSM jumps straight
 * to that state. Bound runtime methods are fresh closures (function identity
 * is not preserved across persistence; only readable spec fields are).
 *
 * **Round-trip limitations.** The persistence layer is intentionally narrower
 * than the in-memory {@link ServiceInstance} surface. Three fields cannot
 * round-trip and are therefore absent on the loaded instance:
 *
 *   - `outputContract` — function-valued (`derive`, `validate`); not stored
 *     anywhere on listing/runtime-unit.
 *   - `costModel`     — typically lambda-valued (`compute(input) → cost`);
 *     not stored.
 *   - `reward`        — function-valued ({@link RewardSignal} carries
 *     callbacks); not stored.
 *
 * Callers that need these fields must reconstruct them in-process from the
 * Service module they originally defined. The catalog persistence is the
 * source of truth for everything the marketplace cares about — the
 * function-valued fields are runtime concerns that live with the original
 * code module.
 *
 * **Type inference.** `Service.load<TIn, TOut>(ref)` returns
 * `ServiceInstance<TIn, TOut>` — but the persisted shape can't preserve
 * compile-time generics. Callers MUST supply the type params explicitly
 * (or accept the `unknown` defaults). The cast inside this function is safe
 * insofar as the runtime schema validates inputs at invoke time.
 *
 * @packageDocumentation
 */

import { createInvocationHandle } from '../invoke/runtime.js'
import {
  getMarketplaceRepo,
  getRuntimeUnitRepo,
  type MarketplaceListing,
  type RuntimeUnit,
} from '../marketplace/index.js'
import type {
  InvocationHandle,
  InvokeOpts,
  PublishOpts,
  ServiceInstance,
  VerificationReport,
  VerifyOpts,
} from '../service.js'
import type { Schema } from '../types.js'
import type { ServiceRef } from '../types.js'

import { ServiceLifecycle } from './lifecycle.js'
import { verifyService } from './verify.js'
import { publishService } from './publish.js'

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when {@link load} cannot resolve a {@link ServiceRef} to a
 * persisted Service.
 *
 * - `code: 'NOT_FOUND'`     — no listing exists for `ref` in the configured
 *                             {@link MarketplaceRepo}.
 * - `code: 'CORRUPT_STATE'` — a listing exists but its paired
 *                             {@link RuntimeUnit} is missing (or vice-versa).
 *                             Indicates a partial publish or repo drift.
 * - `code: 'INVALID_REF'`   — the ref string is malformed (empty, wrong
 *                             prefix, etc.).
 */
export class ServiceLoadError extends Error {
  readonly code: 'NOT_FOUND' | 'CORRUPT_STATE' | 'INVALID_REF'
  readonly ref: ServiceRef

  constructor(opts: {
    code: 'NOT_FOUND' | 'CORRUPT_STATE' | 'INVALID_REF'
    ref: ServiceRef
    detail?: string
  }) {
    const detail = opts.detail !== undefined ? `: ${opts.detail}` : ''
    super(`ServiceLoadError(${opts.code}): ${JSON.stringify(opts.ref)}${detail}`)
    this.name = 'ServiceLoadError'
    this.code = opts.code
    this.ref = opts.ref
  }
}

// ============================================================================
// Bound method builder (mirrors define.ts → buildBoundMethods)
// ============================================================================

/**
 * Build the bound runtime methods for a hydrated Service. Identical in shape
 * to `define.ts → buildBoundMethods`; we re-derive here to avoid an internal
 * cross-import (and to keep `Service.load` independent of `Service.define`'s
 * internals — the two factories share semantics, not code).
 */
function buildBoundMethods<TIn, TOut>(
  serviceId: string
): {
  invoke: (input: TIn, opts?: InvokeOpts) => InvocationHandle<TOut>
  verify: (opts?: VerifyOpts) => Promise<VerificationReport>
  publish: (opts?: PublishOpts) => Promise<MarketplaceListing>
  retire: (reason?: string) => Promise<void>
} {
  return {
    invoke(input: TIn, opts?: InvokeOpts): InvocationHandle<TOut> {
      const service = ServiceLifecycle.getService(serviceId) as
        | ServiceInstance<TIn, TOut>
        | undefined
      if (!service) {
        throw new Error(
          `Service ${serviceId} not registered in lifecycle — was it loaded via Service.load()?`
        )
      }
      return createInvocationHandle<TIn, TOut>(service, input, opts)
    },

    verify(opts?: VerifyOpts): Promise<VerificationReport> {
      const service = ServiceLifecycle.getService(serviceId) as
        | ServiceInstance<TIn, TOut>
        | undefined
      if (!service) {
        return Promise.reject(
          new Error(
            `Service ${serviceId} not registered in lifecycle — was it loaded via Service.load()?`
          )
        )
      }
      return verifyService<TIn, TOut>(service, opts)
    },

    publish(opts?: PublishOpts): Promise<MarketplaceListing> {
      const service = ServiceLifecycle.getService(serviceId) as
        | ServiceInstance<TIn, TOut>
        | undefined
      if (!service) {
        return Promise.reject(
          new Error(
            `Service ${serviceId} not registered in lifecycle — was it loaded via Service.load()?`
          )
        )
      }
      return publishService<TIn, TOut>(service, opts)
    },

    retire(reason?: string): Promise<void> {
      ServiceLifecycle.markRetired(serviceId, reason)
      return Promise.resolve()
    },
  }
}

// ============================================================================
// Ref resolution
// ============================================================================

/**
 * Resolve a {@link ServiceRef} to a {@link MarketplaceListing}. Accepts
 * either a service `$id` (preferred — `'svc:...'`) or a listing `$id`
 * (`'lst:...'`); both are supported because round-9 marketplace persistence
 * indexes by both.
 *
 * Returns `undefined` when no listing matches.
 */
async function resolveListing(ref: ServiceRef): Promise<MarketplaceListing | undefined> {
  const repo = getMarketplaceRepo()
  // Try as a listing id first (cheapest single-key lookup), then fall back to
  // the service-keyed accessor. The two ranges (`lst:` vs `svc:`) don't
  // overlap in practice; if they did, the listing-key path wins which matches
  // user intent ("I have the listing id, dereference it").
  const direct = await repo.get(ref)
  if (direct !== undefined) return direct
  return repo.byService(ref)
}

// ============================================================================
// Hydration
// ============================================================================

/**
 * Materialise a read-only {@link ServiceInstance} from the persisted
 * `(listing, runtimeUnit)` pair. Mirrors `define.ts → buildServiceInstance`
 * but pulls fields from the persisted records rather than the input spec.
 */
function hydrateServiceInstance<TIn, TOut>(
  listing: MarketplaceListing,
  runtimeUnit: RuntimeUnit
): ServiceInstance<TIn, TOut> {
  const serviceId = listing.serviceRef
  const methods = buildBoundMethods<TIn, TOut>(serviceId)

  // exactOptionalPropertyTypes — only set optional fields that are present.
  const instance: ServiceInstance<TIn, TOut> = {
    $id: serviceId,
    $type: 'Service' as const,
    name: listing.name,
    promise: listing.promise,
    ...(listing.description !== undefined && { description: listing.description }),
    audience: listing.audience,
    archetype: listing.archetype,
    schema: runtimeUnit.commitment.schema as { input: Schema<TIn>; output: Schema<TOut> },
    binding: runtimeUnit.commitment.binding,
    // outputContract / costModel / reward are not persisted (function-valued);
    // see module-level JSDoc on round-trip limitations.
    ...(runtimeUnit.fulfillment.evaluators !== undefined && {
      evaluators: runtimeUnit.fulfillment.evaluators,
    }),
    ...(runtimeUnit.fulfillment.outcomeContract !== undefined && {
      outcomeContract: runtimeUnit.fulfillment.outcomeContract,
    }),
    ...(runtimeUnit.demand.pricing !== undefined && { pricing: runtimeUnit.demand.pricing }),
    ...(runtimeUnit.demand.refundContract !== undefined && {
      refundContract: runtimeUnit.demand.refundContract,
    }),
    ...(runtimeUnit.demand.authorityBoundary !== undefined && {
      authorityBoundary: runtimeUnit.demand.authorityBoundary,
    }),
    ...(runtimeUnit.fulfillment.oversight !== undefined && {
      oversight: runtimeUnit.fulfillment.oversight,
    }),
    ...(listing.provenance.lineage !== undefined && { lineage: listing.provenance.lineage }),
    // Pre-rendered UI shapes (post-deriveAll). Round-trip note: the original
    // `define()`-time partial overrides are not separable from the derived
    // shapes once persisted — what comes back is the merged rendered form.
    catalog: listing.rendered.catalog,
    order: listing.rendered.order,
    onboarding: listing.rendered.onboarding,
    delivery: listing.rendered.delivery,
    portal: listing.rendered.portal,
    invoke: methods.invoke,
    verify: methods.verify,
    publish: methods.publish,
    retire: methods.retire,
  }

  return Object.freeze(instance)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load a {@link ServiceInstance} by its {@link ServiceRef} from the
 * marketplace.
 *
 * Pipeline:
 *   1. Validate the ref (non-empty string).
 *   2. Resolve to a {@link MarketplaceListing} via the configured
 *      {@link MarketplaceRepo} — try as listing id, then as service id.
 *   3. Resolve the paired {@link RuntimeUnit} via
 *      {@link RuntimeUnitRepo.byService}.
 *   4. Hydrate the readonly {@link ServiceInstance} from the persisted pair.
 *   5. Register in {@link ServiceLifecycle} as `'published'` (load implies the
 *      service was published before, so we skip the draft → verified →
 *      published walk).
 *
 * Throws {@link ServiceLoadError} on any of:
 *   - `INVALID_REF`   — empty / non-string ref.
 *   - `NOT_FOUND`     — no listing exists for the ref.
 *   - `CORRUPT_STATE` — listing exists but the runtime unit is missing.
 *
 * Type params `TIn` / `TOut` cannot be recovered from persisted state and
 * MUST be supplied by the caller (or default to `unknown`). The function
 * casts internally; runtime schema validation at invoke time is the safety
 * net.
 */
export async function load<TIn = unknown, TOut = unknown>(
  ref: ServiceRef
): Promise<ServiceInstance<TIn, TOut>> {
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new ServiceLoadError({
      code: 'INVALID_REF',
      ref,
      detail: 'ref must be a non-empty string',
    })
  }

  const listing = await resolveListing(ref)
  if (!listing) {
    throw new ServiceLoadError({ code: 'NOT_FOUND', ref })
  }

  const runtimeUnit = await getRuntimeUnitRepo().byService(listing.serviceRef)
  if (!runtimeUnit) {
    throw new ServiceLoadError({
      code: 'CORRUPT_STATE',
      ref,
      detail: `listing ${listing.$id} exists but runtime unit for service ${listing.serviceRef} is missing`,
    })
  }

  const instance = hydrateServiceInstance<TIn, TOut>(listing, runtimeUnit)

  // Register as `published` — load implies the service was published before.
  // The lifecycle FSM expects a draft → verified → published walk; for loads
  // we re-seed via `draft()` (idempotent overwrite) and then mark verified +
  // published using the persisted records as the report/listing payloads.
  ServiceLifecycle.draft(instance as ServiceInstance<unknown, unknown>)
  // Synthesise a minimal verification-report shim for the FSM transition.
  // The persisted runtimeUnit carries `runtimeContract.syntheticInvocationRef`
  // which IS the original report's `$id` — we surface it so callers reading
  // `ServiceLifecycle.getVerificationReport()` get a stable ref back.
  ServiceLifecycle.markVerified(listing.serviceRef, {
    $id: runtimeUnit.runtimeContract.syntheticInvocationRef,
    $type: 'VerificationReport',
    serviceRef: listing.serviceRef,
    passed: true,
    failures: [],
    evaluatorPasses: [],
    versionVector: runtimeUnit.versionVector,
    verifiedAt: runtimeUnit.emittedAt,
  })
  ServiceLifecycle.markPublished(listing.serviceRef, listing)

  return instance
}
