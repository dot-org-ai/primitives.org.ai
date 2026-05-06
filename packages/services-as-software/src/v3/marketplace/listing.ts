/**
 * MarketplaceListing — the typed record `Service.publish()` emits per v3 §11.
 *
 * One listing per (Service revision × tenant scope). Carries the rendered
 * UI shapes (per v3 §8) so a catalog frontend can serve the listing without
 * re-running the derive functions, plus provenance (lineage + verification
 * report ref) and a back-reference to the {@link RuntimeUnit} the runtime
 * dispatches against.
 *
 * Round-4 deliverable. Persisted in-memory via `./persistence.ts`; round 5+
 * wires `ai-database` Repo writes.
 *
 * @packageDocumentation
 */

import type { ServiceLineage } from '../lineage.js'
import type {
  CatalogShape,
  DeliveryShape,
  IntegrationsShape,
  OnboardingShape,
  OrderShape,
  PortalShape,
} from '../shapes/types.js'

// ============================================================================
// Visibility
// ============================================================================

/**
 * Listing visibility. `'public'` lists in the catalog for everyone;
 * `'tenant'` requires `tenantRef` and limits access to that tenant; the
 * `string[]` form pins access to an explicit allow-list of tenant refs.
 */
export type MarketplaceVisibility = 'public' | 'tenant' | string[]

// ============================================================================
// Provenance
// ============================================================================

/**
 * Provenance block on a {@link MarketplaceListing}. Carries the lineage of
 * the originating Service (when present) plus the `$id` of the
 * `VerificationReport` that gated this publish (per ADR-0006).
 */
export interface MarketplaceListingProvenance {
  lineage?: ServiceLineage
  verificationReportRef: string
}

// ============================================================================
// Rendered shapes
// ============================================================================

/**
 * Pre-rendered UI shapes attached to the listing — what the catalog frontend
 * renders without re-deriving. Filled by {@link deriveAll} at publish time.
 */
export interface MarketplaceListingRendered {
  catalog: CatalogShape
  order: OrderShape
  onboarding: OnboardingShape
  delivery: DeliveryShape
  portal: PortalShape
  integrations: IntegrationsShape
}

// ============================================================================
// MarketplaceListing
// ============================================================================

/**
 * Typed marketplace listing. Persisted by `./persistence.ts`; one is emitted
 * per successful `Service.publish()` per v3 §11.
 */
export interface MarketplaceListing {
  readonly $id: string
  readonly $type: 'MarketplaceListing'
  readonly serviceRef: string
  readonly visibility: MarketplaceVisibility
  readonly tenantRef?: string
  readonly publishedAt: string
  readonly retiredAt?: string
  readonly rendered: MarketplaceListingRendered
  readonly provenance: MarketplaceListingProvenance
  readonly runtimeUnitRef: string
}
