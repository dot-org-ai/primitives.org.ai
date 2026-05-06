/**
 * In-memory persistence for {@link MarketplaceListing} + {@link RuntimeUnit}.
 *
 * Round-4 stop-gap. Two `Map<string, T>` registries keyed by `$id`, plus a
 * tiny CRUD-shaped namespace per record type. Tests reset state via
 * `__resetForTests()`.
 *
 * TODO: replace in-memory store with ai-database Repo writes (round 5+).
 *
 * @packageDocumentation
 */

import type { MarketplaceListing } from './listing.js'
import type { RuntimeUnit } from './runtime-unit.js'

// ============================================================================
// MarketplaceListing store
// ============================================================================

const listings = new Map<string, MarketplaceListing>()

/**
 * Filter applied by {@link marketplaceStore.list}. All fields are AND-ed; an
 * absent field matches anything.
 */
export interface MarketplaceListFilter {
  visibility?: MarketplaceListing['visibility']
  tenantRef?: string
  serviceRef?: string
}

export const marketplaceStore = {
  /** Insert or replace a listing keyed by `$id`. */
  put(listing: MarketplaceListing): void {
    listings.set(listing.$id, listing)
  },
  /** Fetch by `$id`; `undefined` when absent. */
  get(id: string): MarketplaceListing | undefined {
    return listings.get(id)
  },
  /** Enumerate listings, optionally filtered. */
  list(filter?: MarketplaceListFilter): MarketplaceListing[] {
    const out: MarketplaceListing[] = []
    for (const listing of listings.values()) {
      if (filter?.visibility !== undefined && listing.visibility !== filter.visibility) continue
      if (filter?.tenantRef !== undefined && listing.tenantRef !== filter.tenantRef) continue
      if (filter?.serviceRef !== undefined && listing.serviceRef !== filter.serviceRef) continue
      out.push(listing)
    }
    return out
  },
  /**
   * Convenience accessor — return the most-recently-published listing for a
   * given service ref, or `undefined` when none exist.
   */
  byService(serviceRef: string): MarketplaceListing | undefined {
    let latest: MarketplaceListing | undefined
    for (const listing of listings.values()) {
      if (listing.serviceRef !== serviceRef) continue
      if (!latest || listing.publishedAt > latest.publishedAt) latest = listing
    }
    return latest
  },
  /** Test seam: clear state. Production code never calls this. */
  __resetForTests(): void {
    listings.clear()
  },
}

// ============================================================================
// RuntimeUnit store
// ============================================================================

const runtimeUnits = new Map<string, RuntimeUnit>()

/**
 * Filter applied by {@link runtimeUnitStore.list}. All fields are AND-ed.
 */
export interface RuntimeUnitListFilter {
  serviceRef?: string
  tenantRef?: string
}

export const runtimeUnitStore = {
  /** Insert or replace a runtime unit keyed by `$id`. */
  put(unit: RuntimeUnit): void {
    runtimeUnits.set(unit.$id, unit)
  },
  /** Fetch by `$id`; `undefined` when absent. */
  get(id: string): RuntimeUnit | undefined {
    return runtimeUnits.get(id)
  },
  /** Enumerate runtime units, optionally filtered. */
  list(filter?: RuntimeUnitListFilter): RuntimeUnit[] {
    const out: RuntimeUnit[] = []
    for (const unit of runtimeUnits.values()) {
      if (filter?.serviceRef !== undefined && unit.serviceRef !== filter.serviceRef) continue
      if (filter?.tenantRef !== undefined && unit.tenantRef !== filter.tenantRef) continue
      out.push(unit)
    }
    return out
  },
  /** Convenience accessor — most recent runtime unit for a service. */
  byService(serviceRef: string): RuntimeUnit | undefined {
    let latest: RuntimeUnit | undefined
    for (const unit of runtimeUnits.values()) {
      if (unit.serviceRef !== serviceRef) continue
      if (!latest || unit.emittedAt > latest.emittedAt) latest = unit
    }
    return latest
  },
  /** Test seam: clear state. Production code never calls this. */
  __resetForTests(): void {
    runtimeUnits.clear()
  },
}
