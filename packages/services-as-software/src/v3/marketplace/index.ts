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
  configureMarketplaceRepo,
  configureRuntimeUnitRepo,
  __resetMarketplaceReposForTests,
  // Backward-compat surface (deprecated wrappers + filter aliases)
  marketplaceStore,
  runtimeUnitStore,
  type MarketplaceListFilter,
  type RuntimeUnitListFilter,
} from './persistence.js'
