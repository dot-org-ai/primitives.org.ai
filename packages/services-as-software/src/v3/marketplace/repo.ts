/**
 * Marketplace repo ports — async storage abstraction over
 * {@link MarketplaceListing} and {@link RuntimeUnit}.
 *
 * Replaces the round-4 in-memory `Map<string, T>` registries with a thin
 * Promise-shaped surface so callers can swap between the in-memory adapter
 * (default; used by tests + dev) and the `ai-database` Repo writes (round
 * 5+; production catalog read-path per ADR-0005).
 *
 * - {@link InMemoryMarketplaceRepo} / {@link InMemoryRuntimeUnitRepo} —
 *   process-local Map-backed adapter. Default until a caller wires a real
 *   provider via {@link configureMarketplaceRepo}.
 * - `AiDatabaseMarketplaceRepo` / `AiDatabaseRuntimeUnitRepo` (in
 *   `./ai-database-repo.ts`) — production path, wraps a `DB` instance.
 *
 * Tenant-scoping is filter-shaped per ADR-0007: callers pass `tenantRef` /
 * `visibility` to {@link MarketplaceRepo.list} and the adapter ANDs them.
 *
 * @packageDocumentation
 */

import type { MarketplaceListing, MarketplaceVisibility } from './listing.js'
import type { RuntimeUnit } from './runtime-unit.js'
import type { VersionVector } from '../lineage.js'

// ============================================================================
// MarketplaceListing repo port
// ============================================================================

/**
 * Filter accepted by {@link MarketplaceRepo.list}. All fields are AND-ed; an
 * absent field matches anything.
 *
 * `archetype` is forward-compat — accepted today but not yet a first-class
 * field on {@link MarketplaceListing}; adapters MAY ignore it until the
 * field is added (round 6+).
 */
export interface MarketplaceListingFilter {
  visibility?: MarketplaceVisibility
  tenantRef?: string
  serviceRef?: string
  archetype?: string
}

/**
 * Async port for {@link MarketplaceListing} persistence. Both adapters
 * (in-memory and `ai-database`-backed) satisfy this surface.
 */
export interface MarketplaceRepo {
  /** Insert or replace a listing keyed by `$id`. */
  put(listing: MarketplaceListing): Promise<void>

  /** Fetch by `$id`; resolves to `undefined` when absent. */
  get(id: string): Promise<MarketplaceListing | undefined>

  /** Enumerate listings, optionally filtered. Order is adapter-defined. */
  list(filter?: MarketplaceListingFilter): Promise<MarketplaceListing[]>

  /**
   * Convenience accessor — return the most-recently-published listing for
   * a given service ref, or `undefined` when none exist.
   */
  byService(serviceRef: string): Promise<MarketplaceListing | undefined>
}

// ============================================================================
// RuntimeUnit repo port
// ============================================================================

/**
 * Filter accepted by {@link RuntimeUnitRepo.list}.
 */
export interface RuntimeUnitFilter {
  serviceRef?: string
  tenantRef?: string
}

/**
 * Async port for {@link RuntimeUnit} persistence.
 */
export interface RuntimeUnitRepo {
  /** Insert or replace a runtime unit keyed by `$id`. */
  put(unit: RuntimeUnit): Promise<void>

  /** Fetch by `$id`; resolves to `undefined` when absent. */
  get(id: string): Promise<RuntimeUnit | undefined>

  /** Enumerate runtime units, optionally filtered. */
  list(filter?: RuntimeUnitFilter): Promise<RuntimeUnit[]>

  /** Convenience accessor — most recent runtime unit for a service. */
  byService(serviceRef: string): Promise<RuntimeUnit | undefined>

  /**
   * Lookup by exact {@link VersionVector} match. Returns the unit whose
   * `versionVector` field deep-equals `vv`, or `undefined` when none match.
   * Used by the runtime when invoking against a pinned spec revision.
   */
  byVersionVector(vv: VersionVector): Promise<RuntimeUnit | undefined>
}
