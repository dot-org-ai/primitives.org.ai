/**
 * Marketplace barrel — surfaces {@link MarketplaceListing}, {@link RuntimeUnit},
 * the round-5+ async repo ports, and both adapter implementations.
 *
 * @packageDocumentation
 */

export type {
  MarketplaceListing,
  MarketplaceListingProvenance,
  MarketplaceListingRendered,
  MarketplaceVisibility,
} from './listing.js'

export type {
  RuntimeUnit,
  RuntimeUnitCommitment,
  RuntimeUnitContract,
  RuntimeUnitDemand,
  RuntimeUnitFulfillment,
  RuntimeUnitMarketplace,
} from './runtime-unit.js'

// Async repo ports — round 5+ persistence surface
export type {
  MarketplaceListingFilter,
  MarketplaceRepo,
  RuntimeUnitFilter,
  RuntimeUnitRepo,
} from './repo.js'

// In-memory adapters — default
export { InMemoryMarketplaceRepo, InMemoryRuntimeUnitRepo } from './in-memory-repo.js'

// ai-database adapters — production opt-in
export {
  AiDatabaseMarketplaceRepo,
  AiDatabaseRuntimeUnitRepo,
  MarketplaceListingNoun,
  RuntimeUnitNoun,
  MarketplaceRepoSchema,
} from './ai-database-repo.js'

// Factory accessors + configure functions
export {
  getMarketplaceRepo,
  getRuntimeUnitRepo,
  getServiceCollection,
  configureMarketplaceRepo,
  configureRuntimeUnitRepo,
  configureServiceCollection,
  __resetMarketplaceReposForTests,
  // Backward-compat surface (deprecated wrappers + filter aliases)
  marketplaceStore,
  runtimeUnitStore,
  type MarketplaceListFilter,
  type RuntimeUnitListFilter,
} from './persistence.js'

// ServiceCollection — round-13 catalog read-path primitive (per ADR-0005)
export type {
  ServiceCollection,
  ServiceCollectionFilter,
  ServiceCollectionOpts,
  ServiceCollectionPage,
  ServiceCollectionCursor,
  ServiceCollectionOrder,
} from './collection.js'
export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, clampPageSize } from './collection.js'

// In-memory adapter — default
export { InMemoryServiceCollection } from './in-memory-collection.js'

// CH-backed adapter — round-13 stub for ADR-0005 production read-path
export {
  CHServiceCollection,
  type CHServiceCollectionOpts,
  type CHClientPort,
} from './ch-collection.js'
