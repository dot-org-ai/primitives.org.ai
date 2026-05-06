/**
 * `Service.collection()` — typed cursor over the catalog read-path.
 *
 * Round-13 deliverable for ADR-0005. Today {@link MarketplaceRepo.list}
 * returns ALL listings matching a filter; that's fine for in-memory dev/test
 * but the 1M-Service thesis requires a paginated, keyset-cursor read-path
 * that maps cleanly onto the production ClickHouse materialized view per
 * ADR-0005.
 *
 * `Service.collection` resolves the configured singleton from
 * `../marketplace/persistence.ts` and forwards to its `page()` method. Wire
 * production by calling `configureServiceCollection(new CHServiceCollection(...))`
 * at boot; the default is the in-memory adapter so dev/test code keeps
 * working without setup.
 *
 * @packageDocumentation
 */

import { getServiceCollection } from '../marketplace/persistence.js'
import type {
  ServiceCollectionFilter,
  ServiceCollectionOpts,
  ServiceCollectionPage,
} from '../marketplace/collection.js'

/**
 * Return one page of {@link MarketplaceListing} rows matching `filter`,
 * paginated per `opts`. Per ADR-0005 the default sort is
 * `(popularity_score DESC, service_id ASC)` with keyset pagination.
 *
 * Resolves the configured {@link ServiceCollection} singleton each call so
 * tests that swap the singleton mid-run see the new adapter.
 */
export function collection(
  filter?: ServiceCollectionFilter,
  opts?: ServiceCollectionOpts
): Promise<ServiceCollectionPage> {
  return getServiceCollection().page(filter, opts)
}
