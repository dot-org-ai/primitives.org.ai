/**
 * In-memory adapter for {@link ServiceCollection}.
 *
 * Wraps an {@link InMemoryMarketplaceRepo} (or any other {@link MarketplaceRepo}
 * for that matter) and implements filter + sort + keyset pagination over
 * `repo.list()`. This is the **default** until a caller wires
 * {@link CHServiceCollection} at boot via
 * {@link configureServiceCollection}.
 *
 * Sort + cursor semantics match ADR-0005 so test fixtures written against this
 * adapter port cleanly to the CH-backed adapter:
 *   - default order: `(popularity_score DESC, service_id ASC)`
 *   - `'recent'`:    `(publishedAt DESC, service_id ASC)`
 *   - `'name'`:      `(name ASC, service_id ASC)`
 *
 * Note on `popularity_score`: round-13 doesn't yet carry a popularity field on
 * {@link MarketplaceListing} — every listing scores `0` by default, which means
 * the in-memory order degenerates to `serviceId ASC` until round-14 wires
 * usage telemetry. The `nextCursor` shape is still emitted correctly so
 * consumer code is exercised end-to-end.
 *
 * Free-text `query` filtering uses case-insensitive substring matching on the
 * listing's rendered hero (`headline + subheadline`), which is the only
 * carrier of name/promise on a {@link MarketplaceListing} today. Round-14 may
 * add a denormalised `name`/`promise`/`description` carrier for richer search
 * — at which point this method updates without touching the surface.
 *
 * @packageDocumentation
 */

import type { MarketplaceListing } from './listing.js'
import type { MarketplaceRepo, MarketplaceListingFilter } from './repo.js'
import {
  clampPageSize,
  type ServiceCollection,
  type ServiceCollectionCursor,
  type ServiceCollectionFilter,
  type ServiceCollectionOpts,
  type ServiceCollectionPage,
} from './collection.js'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Pull a popularity score off a listing. Round-13 has no carrier for this on
 * {@link MarketplaceListing}, so every listing scores `0` until round-14 wires
 * invocation-count telemetry. The accessor is centralised here so the
 * upgrade path is a single edit.
 */
function popularityOf(_listing: MarketplaceListing): number {
  // TODO(round-14): wire from usage telemetry (invocation count over a sliding
  // window). Until then every listing scores 0; sort falls through to
  // `serviceId ASC`.
  return 0
}

/**
 * Lower-case haystack assembled from the listing's rendered hero. Used by
 * `query` filtering — see file-level note on round-14 description-carrier.
 */
function searchHaystack(listing: MarketplaceListing): string {
  const hero = listing.rendered?.catalog?.hero
  const parts: string[] = []
  if (hero?.headline) parts.push(hero.headline)
  if (hero?.subheadline) parts.push(hero.subheadline)
  // serviceRef + archetype are always present and are useful for matching
  // archetype-keyworded queries like 'summarization'.
  parts.push(listing.serviceRef)
  parts.push(listing.archetype)
  return parts.join(' ').toLowerCase()
}

function compareForOrder(
  order: 'popularity' | 'recent' | 'name',
  a: MarketplaceListing,
  b: MarketplaceListing
): number {
  switch (order) {
    case 'popularity': {
      const pa = popularityOf(a)
      const pb = popularityOf(b)
      if (pa !== pb) return pb - pa // DESC
      return a.$id < b.$id ? -1 : a.$id > b.$id ? 1 : 0
    }
    case 'recent': {
      if (a.publishedAt !== b.publishedAt) {
        return a.publishedAt < b.publishedAt ? 1 : -1 // DESC
      }
      return a.$id < b.$id ? -1 : a.$id > b.$id ? 1 : 0
    }
    case 'name': {
      const na = (a.rendered?.catalog?.hero?.headline ?? a.serviceRef).toLowerCase()
      const nb = (b.rendered?.catalog?.hero?.headline ?? b.serviceRef).toLowerCase()
      if (na !== nb) return na < nb ? -1 : 1
      return a.$id < b.$id ? -1 : a.$id > b.$id ? 1 : 0
    }
  }
}

/**
 * Test whether `listing` lies strictly after `cursor` under the given sort.
 * Used to skip rows up to and including the cursor row.
 */
function isAfterCursor(
  order: 'popularity' | 'recent' | 'name',
  listing: MarketplaceListing,
  cursor: ServiceCollectionCursor
): boolean {
  if (order === 'popularity') {
    const score = popularityOf(listing)
    if (score < cursor.popularityScore) return true
    if (score > cursor.popularityScore) return false
    return listing.$id > cursor.serviceId
  }
  // For 'recent' / 'name' we encode the secondary tiebreaker into the cursor's
  // serviceId; popularityScore is unused but echoed back for API symmetry.
  return listing.$id > cursor.serviceId
}

function audienceMatches(
  listing: MarketplaceListing,
  audience: ServiceCollectionFilter['audience']
): boolean {
  if (audience === undefined) return true
  // Audience is not denormalised onto MarketplaceListing today; the only
  // surface that hints at it is the OrderShape's identity flow. Round-14 will
  // add an explicit `audience` carrier per ADR-0005's MV schema. For now we
  // accept the row when audience is unspecified on the listing — the in-memory
  // adapter is permissive so callers that pass `audience` don't get an empty
  // page during the round-13/14 transition.
  void listing
  return true
}

function passesFilter(
  listing: MarketplaceListing,
  filter: ServiceCollectionFilter | undefined
): boolean {
  if (!filter) return true
  if (filter.visibility !== undefined && listing.visibility !== filter.visibility) return false
  if (filter.tenantRef !== undefined && listing.tenantRef !== filter.tenantRef) return false
  if (filter.archetype !== undefined && listing.archetype !== filter.archetype) return false
  if (!audienceMatches(listing, filter.audience)) return false
  if (filter.query !== undefined && filter.query.length > 0) {
    const needle = filter.query.toLowerCase()
    if (!searchHaystack(listing).includes(needle)) return false
  }
  return true
}

// ============================================================================
// InMemoryServiceCollection
// ============================================================================

/**
 * In-memory {@link ServiceCollection}. Wraps any {@link MarketplaceRepo} (the
 * default in `./persistence.ts` is {@link InMemoryMarketplaceRepo}) and serves
 * `page()` requests by listing + filtering + sorting + paginating in-process.
 */
export class InMemoryServiceCollection implements ServiceCollection {
  constructor(private readonly repo: MarketplaceRepo) {}

  async page(
    filter?: ServiceCollectionFilter,
    opts?: ServiceCollectionOpts
  ): Promise<ServiceCollectionPage> {
    const order = opts?.orderBy ?? 'popularity'
    const pageSize = clampPageSize(opts?.pageSize)

    // Push the cheap filters down to the repo so an `ai-database` adapter
    // can use its own indexes; everything else (audience / query / order /
    // cursor) is handled in-memory.
    const repoFilter: MarketplaceListingFilter = {
      ...(filter?.visibility !== undefined && { visibility: filter.visibility }),
      ...(filter?.tenantRef !== undefined && { tenantRef: filter.tenantRef }),
      ...(filter?.archetype !== undefined && { archetype: filter.archetype }),
    }

    const all = await this.repo.list(repoFilter)
    const matched = all.filter((l) => passesFilter(l, filter))
    matched.sort((a, b) => compareForOrder(order, a, b))

    let startIdx = 0
    if (opts?.after) {
      const cursor = opts.after
      // Linear scan — fine at in-memory scale (Map<string, T>); the CH
      // adapter uses keyset SQL.
      startIdx = matched.findIndex((l) => isAfterCursor(order, l, cursor))
      if (startIdx === -1) startIdx = matched.length
    }

    const slice = matched.slice(startIdx, startIdx + pageSize)
    const hasMore = startIdx + pageSize < matched.length
    const tail = slice[slice.length - 1]
    const nextCursor: ServiceCollectionCursor | undefined =
      hasMore && tail ? { popularityScore: popularityOf(tail), serviceId: tail.$id } : undefined

    return {
      items: slice,
      ...(nextCursor !== undefined && { nextCursor }),
      totalEstimate: matched.length,
    }
  }
}
