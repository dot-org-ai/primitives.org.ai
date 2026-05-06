/**
 * `Service.publish()` — round-4 implementation per v3 §11 + ADR-0006.
 *
 * Pipeline:
 *   1. Fetch the latest {@link VerificationReport} via
 *      {@link ServiceLifecycle.getVerificationReport}; throw `VerifyRequired`
 *      (`ServicePublishError({ code: 'UNVERIFIED' })`) if absent.
 *   2. Apply ADR-0006 field-diff via {@link requiresReverify} between the
 *      currently-registered service and the verified version (today: same
 *      reference; future: a snapshotted spec on the report). Throw
 *      `VerifyRequired` if behavioral fields differ — overridable with
 *      `opts.force`.
 *   3. Mint a {@link RuntimeUnit} from svc + report.
 *   4. Mint a {@link MarketplaceListing} from svc + RuntimeUnit + the
 *      auto-derived UI shapes (via {@link deriveAll}).
 *   5. Persist both via the configured `MarketplaceRepo` / `RuntimeUnitRepo`
 *      (in-memory by default; `ai-database`-backed in production).
 *   6. Transition `verified → published` via
 *      {@link ServiceLifecycle.markPublished}.
 *
 * @packageDocumentation
 */

import { deriveAll } from '../shapes/derive-all.js'
import {
  getMarketplaceRepo,
  getRuntimeUnitRepo,
  type MarketplaceListing,
  type MarketplaceVisibility,
  type RuntimeUnit,
} from '../marketplace/index.js'
import type { ServiceInstance } from '../service.js'
import type { Schema } from '../types.js'

import { ServiceLifecycle, ServicePublishError } from './lifecycle.js'
import { requiresReverify } from './reverify-policy.js'
import type { VerificationReport } from './verify.js'

// ============================================================================
// Public option type
// ============================================================================

/**
 * Options accepted by `service.publish()` per v3 §11.
 *
 * `visibility` defaults to `'public'`; `tenantRef` is required when
 * `visibility === 'tenant'`. `force` overrides the ADR-0006 re-verify gate
 * (use sparingly — every behavioral edit should re-verify).
 *
 * `publishedBy` identifies the actor (a `digital-objects` ThingRef-shaped
 * id, e.g. `'role:service-operator'` or `'user:alice'`) that becomes the
 * `subject` of the SVO `publish` Action emitted on success. Defaults to
 * `'role:service-operator'` when omitted.
 */
export interface PublishOpts {
  visibility?: MarketplaceVisibility
  tenantRef?: string
  force?: boolean
  publishedBy?: string
}

// ============================================================================
// ID minting
// ============================================================================

function mintListingId(): string {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 0xffffff).toString(36)
  return `lst:${t}-${r}`
}

function mintRuntimeUnitId(): string {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 0xffffff).toString(36)
  return `rtu:${t}-${r}`
}

// ============================================================================
// Builders
// ============================================================================

/**
 * Build a {@link RuntimeUnit} from a Service + the verification report. The
 * unit's `runtimeContract.syntheticInvocationRef` points back at the report
 * id (today the report is also the synthetic invocation marker; round 5
 * will split them).
 */
function buildRuntimeUnit(
  svc: ServiceInstance<unknown, unknown>,
  report: VerificationReport,
  listingId: string,
  tenantRef: string | undefined
): RuntimeUnit {
  const passingFixtures = report.evaluatorPasses.map((p) => p.reviewer)

  return {
    $id: mintRuntimeUnitId(),
    $type: 'RuntimeUnit',
    serviceRef: svc.$id,
    ...(tenantRef !== undefined && { tenantRef }),
    versionVector: report.versionVector,
    commitment: {
      schema: svc.schema as { input: Schema<unknown>; output: Schema<unknown> },
      binding: svc.binding,
    },
    fulfillment: {
      ...(svc.evaluators !== undefined && { evaluators: svc.evaluators }),
      ...(svc.outcomeContract !== undefined && { outcomeContract: svc.outcomeContract }),
      ...(svc.oversight !== undefined && { oversight: svc.oversight }),
    },
    demand: {
      ...(svc.pricing !== undefined && { pricing: svc.pricing }),
      ...(svc.refundContract !== undefined && { refundContract: svc.refundContract }),
      ...(svc.authorityBoundary !== undefined && { authorityBoundary: svc.authorityBoundary }),
    },
    marketplace: { listingRef: listingId },
    runtimeContract: {
      syntheticInvocationRef: report.$id,
      passingFixtures,
    },
    emittedAt: new Date().toISOString(),
  }
}

/**
 * Build a {@link MarketplaceListing} from svc + the runtime unit + the
 * pre-derived UI shapes. Calls {@link deriveAll} for the rendered block.
 */
function buildListing(
  svc: ServiceInstance<unknown, unknown>,
  reportId: string,
  runtimeUnitId: string,
  listingId: string,
  visibility: MarketplaceVisibility,
  tenantRef: string | undefined
): MarketplaceListing {
  const rendered = deriveAll(svc)

  return {
    $id: listingId,
    $type: 'MarketplaceListing',
    serviceRef: svc.$id,
    archetype: svc.archetype,
    visibility,
    ...(tenantRef !== undefined && { tenantRef }),
    publishedAt: new Date().toISOString(),
    rendered,
    provenance: {
      ...(svc.lineage !== undefined && { lineage: svc.lineage }),
      verificationReportRef: reportId,
    },
    runtimeUnitRef: runtimeUnitId,
  }
}

// ============================================================================
// SVO Action emission (round-9 follow-up: emit `publish` Action on success)
// ============================================================================

/**
 * Default publisher identity when `PublishOpts.publishedBy` is omitted.
 * `role:`-prefixed id is the `digital-objects` ThingRef convention for an
 * unattributed actor acting in a named role.
 */
const DEFAULT_PUBLISHER = 'role:service-operator'

/**
 * Best-effort SVO Action emission for `Service.publish` per CONTEXT.md.
 * Shape: `{ verb: 'publish', subject: <publisher>, object: <serviceRef>,
 * recipient: <listingId> }`.
 *
 * When the configured `MarketplaceRepo` is the `ai-database`-backed adapter
 * we route through the repo's `db.actions.create` surface; for the in-memory
 * default we skip emission (no Action store today — round-11+ wires a
 * standalone in-memory Action sink).
 *
 * Failure to emit MUST NOT fail the publish — the listing is the source of
 * truth and the Action log is observability. Emission errors are swallowed
 * with a `console.warn` so callers see them in dev without breaking prod.
 */
async function emitPublishAction(
  svc: ServiceInstance<unknown, unknown>,
  listing: MarketplaceListing,
  publishedBy: string
): Promise<void> {
  const repo = getMarketplaceRepo()
  // Duck-type check: ai-database adapter exposes a `db` field with an
  // `actions.create` API. The in-memory adapter does not — skip silently.
  const dbHolder = repo as unknown as {
    db?: { actions?: { create(opts: unknown): Promise<unknown> } }
  }
  const create = dbHolder.db?.actions?.create
  if (typeof create !== 'function') return

  try {
    await create.call(dbHolder.db!.actions, {
      actor: publishedBy,
      action: 'publish',
      object: svc.$id,
      objectData: { listingRef: listing.$id, recipient: listing.$id },
      meta: { archetype: svc.archetype, visibility: listing.visibility },
    })
  } catch (err) {
    // Observability surface — do not fail publish on Action-log error.
    console.warn(
      `[Service.publish] SVO Action emission failed for ${svc.$id} → ${listing.$id}:`,
      err
    )
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run `service.publish()` per v3 §11.
 *
 * Throws {@link ServicePublishError} with `code: 'UNVERIFIED'` if no report
 * exists, or if the spec has drifted on a behavioral field per ADR-0006
 * (overridable with `opts.force`).
 */
export async function publishService<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  opts?: PublishOpts
): Promise<MarketplaceListing> {
  // 1. Fetch the latest report; absent → UNVERIFIED.
  const report = ServiceLifecycle.getVerificationReport(svc.$id)
  if (!report) {
    throw new ServicePublishError({
      code: 'UNVERIFIED',
      serviceId: svc.$id,
      message: `Service.publish requires a VerificationReport — call Service.verify() first (${svc.$id}).`,
    })
  }

  // 2. ADR-0006 field-diff. The verified spec is the currently-registered
  //    service today (round 4); round 5 will snapshot the spec onto the
  //    report so the comparison is exact across in-place mutations.
  const verifiedSvc = ServiceLifecycle.getService(svc.$id)
  if (verifiedSvc && !opts?.force) {
    if (
      requiresReverify(
        verifiedSvc as ServiceInstance<unknown, unknown>,
        svc as ServiceInstance<unknown, unknown>
      )
    ) {
      throw new ServicePublishError({
        code: 'UNVERIFIED',
        serviceId: svc.$id,
        message: `Service.publish detected behavioral-field drift (ADR-0006); re-run Service.verify() (${svc.$id}).`,
      })
    }
  }

  // 3. Build the RuntimeUnit + Listing (cross-referenced by id).
  const visibility: MarketplaceVisibility = opts?.visibility ?? 'public'
  const tenantRef = opts?.tenantRef
  const listingId = mintListingId()

  const runtimeUnit = buildRuntimeUnit(
    svc as ServiceInstance<unknown, unknown>,
    report,
    listingId,
    tenantRef
  )

  const listing = buildListing(
    svc as ServiceInstance<unknown, unknown>,
    report.$id,
    runtimeUnit.$id,
    listingId,
    visibility,
    tenantRef
  )

  // 4. Persist both. Order matters only insofar as a concurrent reader
  //    should never see a listing whose runtimeUnit isn't yet present.
  await getRuntimeUnitRepo().put(runtimeUnit)
  await getMarketplaceRepo().put(listing)

  // 5. Transition `verified → published`.
  ServiceLifecycle.markPublished(svc.$id, listing)

  // 6. Emit SVO `publish` Action — best-effort, swallowed on failure
  //    (ai-database backend only; in-memory backend is a no-op).
  const publishedBy = opts?.publishedBy ?? DEFAULT_PUBLISHER
  await emitPublishAction(svc as ServiceInstance<unknown, unknown>, listing, publishedBy)

  return listing
}
