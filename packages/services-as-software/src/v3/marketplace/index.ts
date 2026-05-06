/**
 * Marketplace barrel — surfaces {@link MarketplaceListing}, {@link RuntimeUnit},
 * and the round-4 in-memory persistence helpers.
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

export {
  marketplaceStore,
  runtimeUnitStore,
  type MarketplaceListFilter,
  type RuntimeUnitListFilter,
} from './persistence.js'
