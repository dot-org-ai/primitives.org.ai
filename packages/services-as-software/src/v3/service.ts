/**
 * ServiceInstance — read-only shape returned by `Service.define()` per v3 §5.
 *
 * Methods (`invoke`, `verify`, `publish`, `retire`) are declared as types only;
 * the concrete implementations ship in sibling modules:
 *
 *   - `invoke` / `InvocationHandle` / `InvokeOpts` — `./invoke/` (round 4)
 *   - `verify` / `VerificationReport` — placeholder, round 5
 *   - `publish` / `MarketplaceListing` — placeholder, round 5
 *
 * @packageDocumentation
 */

import type {
  AuthorityBoundaryRef,
  CostModel,
  OutcomeContract,
  Pricing,
  RefundContractRef,
} from 'business-as-code/finance'
import type { RewardSignal } from 'digital-tools'

import type { ServiceBinding } from './binding.js'
import type { OutputContract } from './output-contract.js'
import type { ServiceLineage } from './lineage.js'
import type { Audience, Schema } from './types.js'
import type { ServiceArchetypeRef } from './archetype/registry.js'
import type {
  CatalogShape,
  DeliveryShape,
  OnboardingShape,
  OrderShape,
  PortalShape,
} from './shapes/types.js'
import type { OversightPolicy } from './service-spec.js'
import type { EvaluatorPanel } from './evaluator-panel.js'
import type { InvocationHandle, InvokeOpts } from './invoke/index.js'

// Re-export the real `invoke` types so existing `import { InvocationHandle,
// InvokeOpts } from './service.js'` callers (notably `service/define.ts`)
// keep working without churn.
export type { InvocationHandle, InvokeOpts } from './invoke/index.js'

// ============================================================================
// Verify / Publish / Marketplace types (real shapes from sibling modules)
// ============================================================================

// Round-4 deliverable: real shapes ship from `./service/verify.js` +
// `./service/publish.js` + `./marketplace/`. We import them locally so
// `ServiceInstance` below can reference them by name, and re-export so the
// historical `service.js` import points stay stable.

import type {
  VerifyOpts,
  VerificationReport,
  VerificationFailure,
  VerificationEvaluatorPass,
  VerifyFixture,
} from './service/verify.js'

import type { PublishOpts } from './service/publish.js'

import type {
  MarketplaceListing,
  MarketplaceListingProvenance,
  MarketplaceListingRendered,
  MarketplaceVisibility,
  RuntimeUnit,
  RuntimeUnitCommitment,
  RuntimeUnitContract,
  RuntimeUnitDemand,
  RuntimeUnitFulfillment,
  RuntimeUnitMarketplace,
} from './marketplace/index.js'

export type {
  VerifyOpts,
  VerificationReport,
  VerificationFailure,
  VerificationEvaluatorPass,
  VerifyFixture,
  PublishOpts,
  MarketplaceListing,
  MarketplaceListingProvenance,
  MarketplaceListingRendered,
  MarketplaceVisibility,
  RuntimeUnit,
  RuntimeUnitCommitment,
  RuntimeUnitContract,
  RuntimeUnitDemand,
  RuntimeUnitFulfillment,
  RuntimeUnitMarketplace,
}

// ============================================================================
// ServiceInstance
// ============================================================================

/**
 * Read-only shape of a Service value. Per v3 §5, every field is `readonly`;
 * mutation goes through `Service.define()` (republish a new revision) or the
 * runtime methods (`invoke` / `verify` / `publish` / `retire`).
 *
 * Most consumers don't need the type alias — `const svc = Service.define({...})`
 * infers `ServiceInstance<TIn, TOut>` automatically.
 */
export interface ServiceInstance<TIn, TOut> {
  // ---- identity (readonly) ------------------------------------------------

  readonly $id: string
  readonly $type: 'Service'
  readonly name: string
  readonly promise: string
  readonly description?: string

  // ---- shape (readonly) ---------------------------------------------------

  readonly audience: Audience | Audience[]
  readonly archetype: ServiceArchetypeRef
  readonly schema: { input: Schema<TIn>; output: Schema<TOut> }
  readonly binding: ServiceBinding
  readonly outputContract?: OutputContract<TIn, TOut>

  // ---- evaluation + outcome (readonly) -----------------------------------

  /**
   * Materialised EvaluatorPanel value. Placeholder type until the
   * EvaluatorPanel agent ships the real shape.
   */
  readonly evaluators?: EvaluatorPanel
  readonly outcomeContract?: OutcomeContract

  // ---- billing + finance (readonly) --------------------------------------

  readonly pricing?: Pricing
  readonly refundContract?: RefundContractRef
  readonly authorityBoundary?: AuthorityBoundaryRef
  readonly costModel?: CostModel

  // ---- reward + oversight (readonly) -------------------------------------

  readonly reward?: RewardSignal
  readonly oversight?: OversightPolicy

  // ---- provenance (readonly) ---------------------------------------------

  readonly lineage?: ServiceLineage

  // ---- UI overrides (readonly; auto-derived per v3 §8 when omitted) ------

  readonly catalog?: CatalogShape
  readonly order?: OrderShape
  readonly onboarding?: OnboardingShape
  readonly delivery?: DeliveryShape
  readonly portal?: PortalShape

  // ---- runtime methods (declared only; impl is the next agent) -----------

  /**
   * Invoke the Service against `input`, returning an {@link InvocationHandle}
   * whose `result` resolves to the typed output.
   *
   * Per v3 §5, the same value runs in three execution targets (in-process,
   * Cloudflare Workers, `api.services`) — the runtime is selected by the
   * surrounding context, not the call site.
   */
  invoke(input: TIn, opts?: InvokeOpts): InvocationHandle<TOut>

  /**
   * Run the cascade against fixture inputs and return a {@link VerificationReport}.
   * Per v3 §10, verify-time events stay sandboxed unless
   * `emitToCascadeEventLog: true`.
   */
  verify(opts?: VerifyOpts): Promise<VerificationReport>

  /**
   * Publish the Service to a marketplace as a {@link MarketplaceListing}.
   * Per v3 §11, requires a fresh {@link VerificationReport} unless
   * `skipReverifyGate` is set.
   */
  publish(opts?: PublishOpts): Promise<MarketplaceListing>

  /**
   * Retire the Service — pending invocations drain per the existing SLA, and
   * no new invocations are accepted.
   */
  retire(reason?: string): Promise<void>
}
