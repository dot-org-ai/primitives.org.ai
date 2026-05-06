/**
 * `ai-database`-backed adapters for {@link MarketplaceRepo} and
 * {@link RuntimeUnitRepo}.
 *
 * Production round-5+ persistence path. Wraps a `DB` instance (from
 * `ai-database`) and routes `put`/`get`/`list`/`byService` through the
 * configured `DBProvider`. The Nouns for `MarketplaceListing` and
 * `RuntimeUnit` are declared at module scope so the same Noun shape is
 * shared across every catalog reader.
 *
 * Round-10 will materialize the catalog read-path into a ClickHouse MV
 * (per ADR-0005); the writes remain on this adapter, the reads fan out to
 * the MV. At that point this module gets a sibling `clickhouse-repo.ts`
 * with the same {@link MarketplaceRepo} surface.
 *
 * @packageDocumentation
 */

import { defineNoun, type DBResult, type DatabaseSchema } from 'ai-database'

import type { MarketplaceListing } from './listing.js'
import type { RuntimeUnit } from './runtime-unit.js'
import type {
  MarketplaceListingFilter,
  MarketplaceRepo,
  RuntimeUnitFilter,
  RuntimeUnitRepo,
} from './repo.js'
import type { VersionVector } from '../lineage.js'

// ============================================================================
// Noun definitions — MDXLD-style with `$id` / `$type`
// ============================================================================

/**
 * `MarketplaceListing` Noun. The schema declares the **filterable** scalar
 * fields the catalog read-path indexes on (`serviceRef`, `archetype`,
 * `visibility`, `tenantRef`, `publishedAt`); the deeply-nested `rendered` /
 * `provenance` blocks ride along as opaque payload via `metadata`.
 *
 * MDXLD conventions: every persisted listing carries `$id` (the canonical
 * id minted by `Service.publish`) and `$type === 'MarketplaceListing'`.
 */
export const MarketplaceListingNoun = defineNoun({
  singular: 'marketplaceListing',
  plural: 'marketplaceListings',
  description:
    'Catalog-side artifact emitted by Service.publish per v3 §11. ' +
    'Carries pre-rendered UI shapes, lineage, verification-report ref, ' +
    'and a back-reference to the paired RuntimeUnit.',
  properties: {
    serviceRef: { type: 'string', description: 'Originating Service `$id`.' },
    archetype: { type: 'string', description: 'Originating Service archetype ref.' },
    visibility: { type: 'string', description: "'public' | 'tenant' | tenant-id list (JSON)." },
    tenantRef: { type: 'string', description: 'Owning tenant; required when visibility=tenant.' },
    publishedAt: { type: 'string', description: 'ISO-8601 publish timestamp.' },
    retiredAt: { type: 'string', description: 'ISO-8601 retire timestamp; absent when active.' },
    runtimeUnitRef: { type: 'string', description: 'Paired RuntimeUnit `$id`.' },
  },
})

/**
 * `RuntimeUnit` Noun. Filterable scalars are `serviceRef`, `tenantRef`,
 * and the version-vector axes (engine/ontology/...); the structured
 * `commitment` / `fulfillment` / `demand` blocks ride as payload.
 */
export const RuntimeUnitNoun = defineNoun({
  singular: 'runtimeUnit',
  plural: 'runtimeUnits',
  description:
    'Runtime-side artifact paired 1:1 with a MarketplaceListing per v3 §11. ' +
    'Pins the behavioral commitment, fulfillment mechanics, demand-side ' +
    'commitments, and verify-time provenance for runtime dispatch.',
  properties: {
    serviceRef: { type: 'string', description: 'Originating Service `$id`.' },
    tenantRef: { type: 'string', description: 'Owning tenant.' },
    listingRef: { type: 'string', description: 'Paired MarketplaceListing `$id`.' },
    emittedAt: { type: 'string', description: 'ISO-8601 emission timestamp.' },
    syntheticInvocationRef: { type: 'string', description: 'VerificationReport `$id` (today).' },
  },
})

// ============================================================================
// Schema shape passed to DB() — minimal scalar fields for filtering
// ============================================================================

/**
 * Schema fragment a caller passes to `DB()` to enable both adapters. We
 * only declare the filterable scalar fields; deep payloads serialize as
 * additional fields on the stored Thing via `upsert`.
 *
 * @example
 * ```ts
 * import { DB } from 'ai-database'
 * import {
 *   MarketplaceRepoSchema,
 *   AiDatabaseMarketplaceRepo,
 *   AiDatabaseRuntimeUnitRepo,
 *   configureMarketplaceRepo,
 *   configureRuntimeUnitRepo,
 * } from 'services-as-software/v3'
 *
 * const { db } = DB({ ...MarketplaceRepoSchema, ...someOtherSchema })
 * configureMarketplaceRepo(new AiDatabaseMarketplaceRepo(db))
 * configureRuntimeUnitRepo(new AiDatabaseRuntimeUnitRepo(db))
 * ```
 */
export const MarketplaceRepoSchema = {
  MarketplaceListing: {
    serviceRef: 'string',
    archetype: 'string',
    visibility: 'string',
    'tenantRef?': 'string',
    publishedAt: 'string',
    'retiredAt?': 'string',
    runtimeUnitRef: 'string',
  },
  RuntimeUnit: {
    serviceRef: 'string',
    'tenantRef?': 'string',
    listingRef: 'string',
    emittedAt: 'string',
    syntheticInvocationRef: 'string',
  },
} as const satisfies DatabaseSchema

// ============================================================================
// Internal helpers
// ============================================================================

type AnyDB = DBResult<DatabaseSchema>

interface PersistedListing extends MarketplaceListing {
  // `ai-database` augments stored entities with createdAt/updatedAt; the
  // shape we receive back is a superset of MarketplaceListing.
  readonly createdAt?: string
  readonly updatedAt?: string
}

interface PersistedUnit extends RuntimeUnit {
  readonly createdAt?: string
  readonly updatedAt?: string
}

function versionVectorEquals(a: VersionVector, b: VersionVector): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof VersionVector>
  for (const k of keys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function stripPersistenceMeta<T extends { createdAt?: string; updatedAt?: string }>(
  raw: T
): Omit<T, 'createdAt' | 'updatedAt'> {
  const { createdAt: _c, updatedAt: _u, ...rest } = raw
  return rest
}

// ============================================================================
// MarketplaceRepo — ai-database adapter
// ============================================================================

/**
 * `ai-database`-backed {@link MarketplaceRepo}. Routes writes through the
 * provided `DB` instance's configured provider; reads use `list()` +
 * client-side filter (round 10 swaps the read-path for the CH MV per
 * ADR-0005).
 */
export class AiDatabaseMarketplaceRepo implements MarketplaceRepo {
  constructor(private readonly db: AnyDB) {}

  async put(listing: MarketplaceListing): Promise<void> {
    // Use upsert so re-publish of the same listing id (rare; usually a new
    // id per publish) is idempotent rather than throwing EntityAlreadyExists.
    const ops = this.db['MarketplaceListing'] as
      | { upsert(id: string, data: Record<string, unknown>): Promise<unknown> }
      | undefined
    if (!ops) {
      throw new Error(
        "AiDatabaseMarketplaceRepo: DB instance has no 'MarketplaceListing' entity. " +
          'Did you spread `MarketplaceRepoSchema` into your DB() schema?'
      )
    }
    const { $id, $type: _t, ...data } = listing
    await ops.upsert($id, data as Record<string, unknown>)
  }

  async get(id: string): Promise<MarketplaceListing | undefined> {
    const ops = this.db['MarketplaceListing'] as
      | { get(id: string): PromiseLike<PersistedListing | null> }
      | undefined
    if (!ops) return undefined
    const raw = await ops.get(id)
    if (!raw) return undefined
    return stripPersistenceMeta(raw) as unknown as MarketplaceListing
  }

  async list(filter?: MarketplaceListingFilter): Promise<MarketplaceListing[]> {
    const ops = this.db['MarketplaceListing'] as
      | { list(): PromiseLike<PersistedListing[]> }
      | undefined
    if (!ops) return []
    const raw = await ops.list()
    const out: MarketplaceListing[] = []
    for (const r of raw) {
      const listing = stripPersistenceMeta(r) as unknown as MarketplaceListing
      if (filter?.visibility !== undefined && listing.visibility !== filter.visibility) continue
      if (filter?.tenantRef !== undefined && listing.tenantRef !== filter.tenantRef) continue
      if (filter?.serviceRef !== undefined && listing.serviceRef !== filter.serviceRef) continue
      if (filter?.archetype !== undefined && listing.archetype !== filter.archetype) continue
      out.push(listing)
    }
    return out
  }

  async byService(serviceRef: string): Promise<MarketplaceListing | undefined> {
    const all = await this.list({ serviceRef })
    let latest: MarketplaceListing | undefined
    for (const listing of all) {
      if (!latest || listing.publishedAt > latest.publishedAt) latest = listing
    }
    return latest
  }
}

// ============================================================================
// RuntimeUnitRepo — ai-database adapter
// ============================================================================

/**
 * `ai-database`-backed {@link RuntimeUnitRepo}.
 */
export class AiDatabaseRuntimeUnitRepo implements RuntimeUnitRepo {
  constructor(private readonly db: AnyDB) {}

  async put(unit: RuntimeUnit): Promise<void> {
    const ops = this.db['RuntimeUnit'] as
      | { upsert(id: string, data: Record<string, unknown>): Promise<unknown> }
      | undefined
    if (!ops) {
      throw new Error(
        "AiDatabaseRuntimeUnitRepo: DB instance has no 'RuntimeUnit' entity. " +
          'Did you spread `MarketplaceRepoSchema` into your DB() schema?'
      )
    }
    const { $id, $type: _t, ...data } = unit
    await ops.upsert($id, data as Record<string, unknown>)
  }

  async get(id: string): Promise<RuntimeUnit | undefined> {
    const ops = this.db['RuntimeUnit'] as
      | { get(id: string): PromiseLike<PersistedUnit | null> }
      | undefined
    if (!ops) return undefined
    const raw = await ops.get(id)
    if (!raw) return undefined
    return stripPersistenceMeta(raw) as unknown as RuntimeUnit
  }

  async list(filter?: RuntimeUnitFilter): Promise<RuntimeUnit[]> {
    const ops = this.db['RuntimeUnit'] as { list(): PromiseLike<PersistedUnit[]> } | undefined
    if (!ops) return []
    const raw = await ops.list()
    const out: RuntimeUnit[] = []
    for (const r of raw) {
      const unit = stripPersistenceMeta(r) as unknown as RuntimeUnit
      if (filter?.serviceRef !== undefined && unit.serviceRef !== filter.serviceRef) continue
      if (filter?.tenantRef !== undefined && unit.tenantRef !== filter.tenantRef) continue
      out.push(unit)
    }
    return out
  }

  async byService(serviceRef: string): Promise<RuntimeUnit | undefined> {
    const all = await this.list({ serviceRef })
    let latest: RuntimeUnit | undefined
    for (const unit of all) {
      if (!latest || unit.emittedAt > latest.emittedAt) latest = unit
    }
    return latest
  }

  async byVersionVector(vv: VersionVector): Promise<RuntimeUnit | undefined> {
    const all = await this.list()
    for (const unit of all) {
      if (versionVectorEquals(unit.versionVector, vv)) return unit
    }
    return undefined
  }
}
