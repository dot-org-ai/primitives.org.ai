/**
 * Repo singletons + factory accessors for {@link MarketplaceListing} +
 * {@link RuntimeUnit} persistence.
 *
 * Round-5+ replaces the round-4 in-memory `Map<string, T>` registries with
 * a {@link MarketplaceRepo} / {@link RuntimeUnitRepo} port (see
 * `./repo.ts`). The default repo is the in-memory adapter
 * (`./in-memory-repo.ts`) so callers that haven't wired `ai-database` keep
 * compiling and tests still pass without setup. Production callers wire
 * the `ai-database`-backed adapter via {@link configureMarketplaceRepo} /
 * {@link configureRuntimeUnitRepo}.
 *
 * @example Wire production persistence
 * ```ts
 * import { DB } from 'ai-database'
 * import {
 *   AiDatabaseMarketplaceRepo,
 *   AiDatabaseRuntimeUnitRepo,
 *   MarketplaceRepoSchema,
 *   configureMarketplaceRepo,
 *   configureRuntimeUnitRepo,
 * } from 'services-as-software/v3'
 *
 * const { db } = DB({ ...MarketplaceRepoSchema })
 * configureMarketplaceRepo(new AiDatabaseMarketplaceRepo(db))
 * configureRuntimeUnitRepo(new AiDatabaseRuntimeUnitRepo(db))
 * ```
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
import { InMemoryMarketplaceRepo, InMemoryRuntimeUnitRepo } from './in-memory-repo.js'
import type { ServiceCollection } from './collection.js'
import { InMemoryServiceCollection } from './in-memory-collection.js'

// ============================================================================
// Backward-compat filter aliases
// ============================================================================

/**
 * @deprecated Round-4 alias retained for source-compat. Use
 * {@link MarketplaceListingFilter} from `./repo.js` directly.
 */
export type MarketplaceListFilter = MarketplaceListingFilter

/**
 * @deprecated Round-4 alias retained for source-compat. Use
 * {@link RuntimeUnitFilter} from `./repo.js` directly.
 */
export type RuntimeUnitListFilter = RuntimeUnitFilter

// ============================================================================
// Singleton repo holders
// ============================================================================

let activeMarketplaceRepo: MarketplaceRepo = new InMemoryMarketplaceRepo()
let activeRuntimeUnitRepo: RuntimeUnitRepo = new InMemoryRuntimeUnitRepo()
// Default {@link ServiceCollection} wraps whatever {@link MarketplaceRepo} is
// active at the time of first read; replace via {@link configureServiceCollection}.
let activeServiceCollection: ServiceCollection | undefined

// ============================================================================
// Factory-pattern accessors
// ============================================================================

/**
 * Get the currently-configured {@link MarketplaceRepo}. Defaults to a
 * process-local in-memory adapter; replace via
 * {@link configureMarketplaceRepo}.
 */
export function getMarketplaceRepo(): MarketplaceRepo {
  return activeMarketplaceRepo
}

/**
 * Get the currently-configured {@link RuntimeUnitRepo}. Defaults to a
 * process-local in-memory adapter; replace via
 * {@link configureRuntimeUnitRepo}.
 */
export function getRuntimeUnitRepo(): RuntimeUnitRepo {
  return activeRuntimeUnitRepo
}

/**
 * Replace the active {@link MarketplaceRepo}. Production callers wire the
 * `ai-database`-backed adapter at boot. Tests that need a clean store
 * may construct a fresh {@link InMemoryMarketplaceRepo} and pass it here.
 */
export function configureMarketplaceRepo(repo: MarketplaceRepo): void {
  activeMarketplaceRepo = repo
}

/**
 * Replace the active {@link RuntimeUnitRepo}. See
 * {@link configureMarketplaceRepo}.
 */
export function configureRuntimeUnitRepo(repo: RuntimeUnitRepo): void {
  activeRuntimeUnitRepo = repo
}

/**
 * Get the currently-configured {@link ServiceCollection}. Defaults to an
 * {@link InMemoryServiceCollection} wrapping the active
 * {@link MarketplaceRepo}; replace via {@link configureServiceCollection}.
 *
 * The default is constructed lazily on first read so that callers who
 * configure a custom {@link MarketplaceRepo} via {@link configureMarketplaceRepo}
 * don't get a collection pinned to a stale repo.
 */
export function getServiceCollection(): ServiceCollection {
  if (activeServiceCollection === undefined) {
    activeServiceCollection = new InMemoryServiceCollection(activeMarketplaceRepo)
  }
  return activeServiceCollection
}

/**
 * Replace the active {@link ServiceCollection}. Production callers wire the
 * `CHServiceCollection` (per ADR-0005) at boot.
 */
export function configureServiceCollection(collection: ServiceCollection): void {
  activeServiceCollection = collection
}

/**
 * Reset both repos + the {@link ServiceCollection} singleton to fresh
 * in-memory adapters. Test seam.
 */
export function __resetMarketplaceReposForTests(): void {
  activeMarketplaceRepo = new InMemoryMarketplaceRepo()
  activeRuntimeUnitRepo = new InMemoryRuntimeUnitRepo()
  activeServiceCollection = undefined
}

// ============================================================================
// Backward-compat wrappers — DEPRECATED
// ============================================================================

/**
 * @deprecated Round-4 in-memory store wrapper. Forwards to the configured
 * {@link MarketplaceRepo} via {@link getMarketplaceRepo}. Migrate callers
 * to `await getMarketplaceRepo().put(listing)` etc. — every method is now
 * async.
 *
 * Retained so the v3 barrel keeps compiling for callers that haven't
 * migrated yet (no in-tree caller does today).
 */
export const marketplaceStore = {
  /** @deprecated Use `await getMarketplaceRepo().put(listing)`. */
  put(listing: MarketplaceListing): Promise<void> {
    return getMarketplaceRepo().put(listing)
  },
  /** @deprecated Use `await getMarketplaceRepo().get(id)`. */
  get(id: string): Promise<MarketplaceListing | undefined> {
    return getMarketplaceRepo().get(id)
  },
  /** @deprecated Use `await getMarketplaceRepo().list(filter)`. */
  list(filter?: MarketplaceListFilter): Promise<MarketplaceListing[]> {
    return getMarketplaceRepo().list(filter)
  },
  /** @deprecated Use `await getMarketplaceRepo().byService(serviceRef)`. */
  byService(serviceRef: string): Promise<MarketplaceListing | undefined> {
    return getMarketplaceRepo().byService(serviceRef)
  },
  /** @deprecated Use {@link __resetMarketplaceReposForTests}. */
  __resetForTests(): void {
    __resetMarketplaceReposForTests()
  },
}

/**
 * @deprecated Round-4 in-memory store wrapper. See {@link marketplaceStore}.
 */
export const runtimeUnitStore = {
  /** @deprecated Use `await getRuntimeUnitRepo().put(unit)`. */
  put(unit: RuntimeUnit): Promise<void> {
    return getRuntimeUnitRepo().put(unit)
  },
  /** @deprecated Use `await getRuntimeUnitRepo().get(id)`. */
  get(id: string): Promise<RuntimeUnit | undefined> {
    return getRuntimeUnitRepo().get(id)
  },
  /** @deprecated Use `await getRuntimeUnitRepo().list(filter)`. */
  list(filter?: RuntimeUnitListFilter): Promise<RuntimeUnit[]> {
    return getRuntimeUnitRepo().list(filter)
  },
  /** @deprecated Use `await getRuntimeUnitRepo().byService(serviceRef)`. */
  byService(serviceRef: string): Promise<RuntimeUnit | undefined> {
    return getRuntimeUnitRepo().byService(serviceRef)
  },
  /** @deprecated Use {@link __resetMarketplaceReposForTests}. */
  __resetForTests(): void {
    __resetMarketplaceReposForTests()
  },
}
