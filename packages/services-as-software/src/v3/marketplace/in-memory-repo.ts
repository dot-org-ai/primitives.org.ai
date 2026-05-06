/**
 * In-memory adapters for {@link MarketplaceRepo} and {@link RuntimeUnitRepo}.
 *
 * Process-local Map-backed implementations that satisfy the async ports.
 * These are the **default** until a caller wires a real DB-backed repo via
 * {@link configureMarketplaceRepo} / {@link configureRuntimeUnitRepo} from
 * `./persistence.ts`.
 *
 * Round-4 behavior is preserved: every async method resolves synchronously
 * with the same filter semantics + `byService` "latest by timestamp"
 * convention as the original `marketplaceStore` / `runtimeUnitStore`.
 *
 * @packageDocumentation
 */

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
// Helpers
// ============================================================================

function versionVectorEquals(a: VersionVector, b: VersionVector): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof VersionVector>
  for (const k of keys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

// ============================================================================
// MarketplaceRepo — in-memory adapter
// ============================================================================

/**
 * Map-backed {@link MarketplaceRepo}. Keyed by `MarketplaceListing.$id`.
 * Default repo when no `ai-database` provider is wired.
 */
export class InMemoryMarketplaceRepo implements MarketplaceRepo {
  private readonly listings = new Map<string, MarketplaceListing>()

  async put(listing: MarketplaceListing): Promise<void> {
    this.listings.set(listing.$id, listing)
  }

  async get(id: string): Promise<MarketplaceListing | undefined> {
    return this.listings.get(id)
  }

  async list(filter?: MarketplaceListingFilter): Promise<MarketplaceListing[]> {
    const out: MarketplaceListing[] = []
    for (const listing of this.listings.values()) {
      if (filter?.visibility !== undefined && listing.visibility !== filter.visibility) continue
      if (filter?.tenantRef !== undefined && listing.tenantRef !== filter.tenantRef) continue
      if (filter?.serviceRef !== undefined && listing.serviceRef !== filter.serviceRef) continue
      // `archetype` is forward-compat — MarketplaceListing has no archetype
      // field today, so we accept the filter and ignore it (no listing
      // matches a present `archetype` filter until the field exists).
      if (filter?.archetype !== undefined) continue
      out.push(listing)
    }
    return out
  }

  async byService(serviceRef: string): Promise<MarketplaceListing | undefined> {
    let latest: MarketplaceListing | undefined
    for (const listing of this.listings.values()) {
      if (listing.serviceRef !== serviceRef) continue
      if (!latest || listing.publishedAt > latest.publishedAt) latest = listing
    }
    return latest
  }

  /** Test seam — clear all in-memory state. Production never calls this. */
  __resetForTests(): void {
    this.listings.clear()
  }
}

// ============================================================================
// RuntimeUnitRepo — in-memory adapter
// ============================================================================

/**
 * Map-backed {@link RuntimeUnitRepo}. Keyed by `RuntimeUnit.$id`.
 */
export class InMemoryRuntimeUnitRepo implements RuntimeUnitRepo {
  private readonly units = new Map<string, RuntimeUnit>()

  async put(unit: RuntimeUnit): Promise<void> {
    this.units.set(unit.$id, unit)
  }

  async get(id: string): Promise<RuntimeUnit | undefined> {
    return this.units.get(id)
  }

  async list(filter?: RuntimeUnitFilter): Promise<RuntimeUnit[]> {
    const out: RuntimeUnit[] = []
    for (const unit of this.units.values()) {
      if (filter?.serviceRef !== undefined && unit.serviceRef !== filter.serviceRef) continue
      if (filter?.tenantRef !== undefined && unit.tenantRef !== filter.tenantRef) continue
      out.push(unit)
    }
    return out
  }

  async byService(serviceRef: string): Promise<RuntimeUnit | undefined> {
    let latest: RuntimeUnit | undefined
    for (const unit of this.units.values()) {
      if (unit.serviceRef !== serviceRef) continue
      if (!latest || unit.emittedAt > latest.emittedAt) latest = unit
    }
    return latest
  }

  async byVersionVector(vv: VersionVector): Promise<RuntimeUnit | undefined> {
    for (const unit of this.units.values()) {
      if (versionVectorEquals(unit.versionVector, vv)) return unit
    }
    return undefined
  }

  /** Test seam — clear all in-memory state. */
  __resetForTests(): void {
    this.units.clear()
  }
}
