/**
 * RuntimeUnit — the typed record `Service.publish()` emits alongside
 * {@link MarketplaceListing} per v3 §11 + §3 (decision 7 — "first-class
 * primitives").
 *
 * Where the {@link MarketplaceListing} is the catalog-side artifact (renders
 * for browse / order / portal), the RuntimeUnit is the runtime-side artifact:
 * it pins the exact behavioral surface (`commitment`), the fulfillment
 * mechanics (evaluators / outcome contract / oversight), the demand-side
 * commitments (pricing / refund / authority), and a pointer to the
 * synthetic invocation + passing fixtures from verify time.
 *
 * Round-4 deliverable. Persisted in-memory via `./persistence.ts`; round 5+
 * wires `ai-database` Repo writes.
 *
 * @packageDocumentation
 */

import type {
  AuthorityBoundaryRef,
  OutcomeContract,
  Pricing,
  RefundContractRef,
} from 'autonomous-finance'

import type { ServiceBinding } from '../binding.js'
import type { EvaluatorPanel } from '../evaluator-panel.js'
import type { OversightPolicy } from '../service-spec.js'
import type { VersionVector } from '../lineage.js'
import type { Schema } from '../types.js'

// ============================================================================
// Sub-records
// ============================================================================

/**
 * The behavioral commitment captured at publish time — schema + binding,
 * exactly as ADR-0006's behavioral-fields hash sees them.
 */
export interface RuntimeUnitCommitment {
  schema: { input: Schema<unknown>; output: Schema<unknown> }
  binding: ServiceBinding
}

/**
 * Fulfillment mechanics — how the RuntimeUnit satisfies the commitment.
 */
export interface RuntimeUnitFulfillment {
  evaluators?: EvaluatorPanel
  outcomeContract?: OutcomeContract
  oversight?: OversightPolicy
}

/**
 * Demand-side commitments to the buyer.
 */
export interface RuntimeUnitDemand {
  pricing?: Pricing
  refundContract?: RefundContractRef
  authorityBoundary?: AuthorityBoundaryRef
}

/**
 * Marketplace back-pointer — the {@link MarketplaceListing.$id} the runtime
 * unit is currently surfaced through.
 */
export interface RuntimeUnitMarketplace {
  listingRef: string
}

/**
 * Verify-time provenance attached to the unit. `syntheticInvocationRef` is
 * the synthetic invocation `$id` (today: the verification-report id), and
 * `passingFixtures` is the list of fixture refs that passed.
 */
export interface RuntimeUnitContract {
  syntheticInvocationRef: string
  passingFixtures: string[]
}

// ============================================================================
// RuntimeUnit
// ============================================================================

/**
 * Typed runtime-side artifact paired 1:1 with a {@link MarketplaceListing}.
 * Persisted by `./persistence.ts`.
 */
export interface RuntimeUnit {
  readonly $id: string
  readonly $type: 'RuntimeUnit'
  readonly serviceRef: string
  readonly tenantRef?: string
  readonly versionVector: VersionVector
  readonly commitment: RuntimeUnitCommitment
  readonly fulfillment: RuntimeUnitFulfillment
  readonly demand: RuntimeUnitDemand
  readonly marketplace: RuntimeUnitMarketplace
  readonly runtimeContract: RuntimeUnitContract
  readonly emittedAt: string
}
