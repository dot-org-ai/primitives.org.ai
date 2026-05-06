/**
 * `ServiceCollection` — typed cursor over the catalog read-path.
 *
 * Round-13 deliverable for ADR-0005. The {@link MarketplaceRepo.list} surface
 * returns ALL listings matching a filter; that's fine for in-memory dev/test
 * but the 1M-Service thesis requires a paginated read-path that maps cleanly
 * onto the production ClickHouse materialized view (`services_catalog_mv`).
 *
 * Per ADR-0005 the production read-path uses keyset pagination on
 * `(popularity_score DESC, service_id ASC)` — never OFFSET, which degrades
 * sharply past the first few pages at catalog scale. {@link ServiceCollectionOpts}
 * encodes that contract on the type surface so the in-memory adapter and the
 * future CH-backed adapter present the same API.
 *
 * Two adapters live alongside this file:
 *   - {@link InMemoryServiceCollection} (`./in-memory-collection.ts`) —
 *     wraps {@link InMemoryMarketplaceRepo}; default for dev/test.
 *   - {@link CHServiceCollection} (`./ch-collection.ts`) — production stub
 *     that throws {@link NotImplementedError} until round-14 wires the actual
 *     ClickHouse client per ADR-0005.
 *
 * Callers reach the configured singleton through `Service.collection(...)`
 * (see `../service/index.ts`); the singleton is wired through
 * {@link configureServiceCollection} / {@link getServiceCollection} in
 * `./persistence.ts`.
 *
 * @packageDocumentation
 */

import type { ServiceArchetypeRef } from '../archetype/registry.js'
import type { Audience } from '../types.js'
import type { MarketplaceListing, MarketplaceVisibility } from './listing.js'

// ============================================================================
// Filter
// ============================================================================

/**
 * Filter accepted by {@link ServiceCollection.page}. All fields are AND-ed; an
 * absent field matches anything. Mirrors {@link MarketplaceListingFilter} but
 * adds the catalog-only `audience` + `query` axes per ADR-0005.
 *
 * - `query` is a free-text search matched against the listing's name + promise
 *   (+ description, when round-14 lands the description carrier on
 *   {@link MarketplaceListing}). The in-memory adapter does case-insensitive
 *   substring; the CH adapter delegates to the Vectorize sidecar per
 *   ADR-0005.
 */
export interface ServiceCollectionFilter {
  visibility?: MarketplaceVisibility
  tenantRef?: string
  archetype?: ServiceArchetypeRef
  audience?: Audience
  /** Free-text search; case-insensitive substring on `name + promise`. */
  query?: string
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Keyset cursor for paginating across pages of a {@link ServiceCollection}.
 * Per ADR-0005, ordering is `(popularity_score DESC, service_id ASC)` — the
 * cursor pins the last row's sort key so the next page resumes deterministically
 * even as new listings publish.
 */
export interface ServiceCollectionCursor {
  popularityScore: number
  serviceId: string
}

/**
 * Sort order for a {@link ServiceCollection} page. ADR-0005 picks
 * `'popularity'` as the catalog default; `'recent'` and `'name'` are
 * supported for niche browse paths (e.g. "newest first" admin views).
 */
export type ServiceCollectionOrder = 'popularity' | 'recent' | 'name'

/**
 * Default page size — matches the typical catalog browse density. Capped by
 * {@link MAX_PAGE_SIZE} to bound CH MV scan cost per request.
 */
export const DEFAULT_PAGE_SIZE = 25

/**
 * Hard cap on `pageSize` — beyond this the catalog UI should switch to
 * `Service.collection.stream(...)` (round-14+) rather than fetch a single
 * jumbo page.
 */
export const MAX_PAGE_SIZE = 100

/**
 * Options accepted by {@link ServiceCollection.page}.
 *
 * - `pageSize` — defaults to {@link DEFAULT_PAGE_SIZE}; clamped to
 *   {@link MAX_PAGE_SIZE}.
 * - `after` — keyset cursor handed back from a previous page's
 *   {@link ServiceCollectionPage.nextCursor}. Absent for the first page.
 * - `orderBy` — sort key; defaults to `'popularity'` per ADR-0005.
 */
export interface ServiceCollectionOpts {
  pageSize?: number
  after?: ServiceCollectionCursor
  orderBy?: ServiceCollectionOrder
}

// ============================================================================
// Page result
// ============================================================================

/**
 * One page of {@link MarketplaceListing} rows returned by
 * {@link ServiceCollection.page}.
 *
 * - `items` — listings on this page, in the requested order.
 * - `nextCursor` — keyset cursor for the next page; `undefined` when this page
 *   is the last.
 * - `totalEstimate` — approximate total count when cheap to compute (the
 *   in-memory adapter sets it from `Map.size`); `undefined` when not cheap.
 *   The CH adapter intentionally returns `undefined` to avoid a `COUNT(*)`
 *   scan on every page request — callers that need an exact count should
 *   issue a separate aggregate query.
 */
export interface ServiceCollectionPage {
  items: MarketplaceListing[]
  nextCursor?: ServiceCollectionCursor
  totalEstimate?: number
}

// ============================================================================
// Service collection port
// ============================================================================

/**
 * Async port for the catalog read-path. Both adapters (in-memory and CH-backed)
 * satisfy this surface; consumers reach it via `Service.collection(...)` once
 * a singleton is wired through {@link configureServiceCollection}.
 */
export interface ServiceCollection {
  /**
   * Return a single page of listings matching `filter` in the order described
   * by `opts.orderBy`, starting after `opts.after` when supplied.
   */
  page(
    filter?: ServiceCollectionFilter,
    opts?: ServiceCollectionOpts
  ): Promise<ServiceCollectionPage>
}

// ============================================================================
// Helpers — pageSize clamping shared by adapters
// ============================================================================

/**
 * Clamp a caller-supplied `pageSize` into the legal range
 * `[1, {@link MAX_PAGE_SIZE}]`. Out-of-range values silently snap to the
 * nearest valid bound; `undefined` returns {@link DEFAULT_PAGE_SIZE}.
 */
export function clampPageSize(pageSize: number | undefined): number {
  if (pageSize === undefined) return DEFAULT_PAGE_SIZE
  if (!Number.isFinite(pageSize) || pageSize < 1) return 1
  if (pageSize > MAX_PAGE_SIZE) return MAX_PAGE_SIZE
  return Math.floor(pageSize)
}
