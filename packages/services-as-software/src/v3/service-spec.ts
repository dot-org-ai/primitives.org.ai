/**
 * ServiceSpec — input to `Service.define()` per v3 §5.
 *
 * `ServiceSpec<TIn, TOut>` is the *spec* (mutable, partial-able) accepted by
 * the factory. The factory normalises it into a {@link ServiceInstance} (the
 * read-only shape; lives in `./service.ts`).
 *
 * Several fields are placeholder-typed pending parallel agent work:
 *   - `evaluators?` — `unknown` until the EvaluatorPanel agent ships its type.
 *
 * The five UI override shapes (`catalog? / order? / onboarding? / delivery?
 * / portal?`) reference the real value types shipped in `./shapes/` (per
 * v3 §8); the sixth shape (`integrations`) is purely derived from
 * `binding.toolPermissions` and is not overridable.
 *
 * All other fields reference real shipped types from `digital-tools`,
 * `business-as-code/finance`, and the sibling v3 modules.
 *
 * @packageDocumentation
 */

import type { AgentMode, PromotionPolicy, RewardSignal } from 'digital-tools'
import type {
  AuthorityBoundaryRef,
  CostModel,
  OutcomeContract,
  Pricing,
  RefundContractRef,
} from 'business-as-code/finance'

import type { ServiceBinding } from './binding.js'
import type { OutputContract } from './output-contract.js'
import type { ServiceLineage } from './lineage.js'
import type { Audience, Schema } from './types.js'
import type { ServiceArchetypeRef } from './archetype/registry.js'
import type { EvaluatorPanel } from './evaluator-panel.js'

// Real UI shape value types live in `./shapes/types.ts` and are re-exported
// here so existing consumers of `services-as-software/v3` import points stay
// stable (CatalogShape / OrderShape / OnboardingShape / DeliveryShape /
// PortalShape — IntegrationsShape is purely derived, not overridable here).
import type {
  CatalogShape,
  DeliveryShape,
  OnboardingShape,
  OrderShape,
  PortalShape,
} from './shapes/types.js'

export type { CatalogShape, OrderShape, OnboardingShape, DeliveryShape, PortalShape }

// ============================================================================
// OversightPolicy on the Service itself (distinct from per-Function oversight)
// ============================================================================

/**
 * Service-level oversight policy. Per v3 §5, the Service carries a single
 * `oversight?` knob that establishes the default {@link AgentMode} for all
 * agentic Functions in its cascade plus an optional cross-cascade
 * {@link PromotionPolicy} for earned-autonomy promotions.
 *
 * This is intentionally distinct from the per-Function `OversightPolicy` in
 * `digital-tools`: per-Function settings always win when both are present.
 */
export interface OversightPolicy {
  mode: AgentMode
  promotionPolicy?: PromotionPolicy
}

// ============================================================================
// ServiceSpec
// ============================================================================

/**
 * Input shape accepted by `Service.define()`.
 *
 * Required fields are the minimum needed to mint a Service ({@link name},
 * {@link promise}, {@link audience}, {@link archetype}, {@link schema},
 * {@link binding}). The rest is opt-in and unlocks publish, billing,
 * earned-autonomy, marketplace, and UI override behaviour.
 */
export interface ServiceSpec<TIn, TOut> {
  // ---- identity -----------------------------------------------------------

  /** MDXLD `$id`; defaults to a slug derived from {@link name}. */
  $id?: string
  /** Human-readable Service name. */
  name: string
  /** One-line promise rendered in catalog UI. */
  promise: string
  /** Optional longer description. */
  description?: string

  // ---- shape --------------------------------------------------------------

  /** Audience(s) the Service serves; drives default UI shape. */
  audience: Audience | Audience[]
  /** Archetype id; the registry resolves defaults from this. */
  archetype: ServiceArchetypeRef
  /** Input + output validation schemas (Standard Schema). */
  schema: { input: Schema<TIn>; output: Schema<TOut> }
  /** Wiring of the cascade + tool permissions + clarification policy. */
  binding: ServiceBinding
  /** Optional richer technical contract (sensitivity tier + UI hints + examples). */
  outputContract?: OutputContract<TIn, TOut>

  // ---- evaluation + outcome ----------------------------------------------

  /**
   * EvaluatorPanel reference or inline value. Placeholder type until the
   * EvaluatorPanel agent ships the real shape.
   *
   * TODO(next-agent: EvaluatorPanel)
   */
  evaluators?: EvaluatorPanel
  /** Definition-of-done predicate + escrow rules (lives in business-as-code/finance). */
  outcomeContract?: OutcomeContract

  // ---- billing + finance --------------------------------------------------

  /** Pricing (one of `outcome` / `subscription` / `per-invocation` / `composite`). */
  pricing?: Pricing
  /** Refund contract reference (one of the seven canonical templates). */
  refundContract?: RefundContractRef
  /** Authority-boundary tag controlling regulatory routing + HITL gates. */
  authorityBoundary?: AuthorityBoundaryRef
  /** Declared cost model used for budgeting + price quoting. */
  costModel?: CostModel

  // ---- reward + oversight -------------------------------------------------

  /** Service-level reward signal — the KeyResult this Service moves. */
  reward?: RewardSignal
  /** Service-level oversight + promotion policy. */
  oversight?: OversightPolicy

  // ---- provenance ---------------------------------------------------------

  /** Lineage of the Service (cell / ICP / hypothesis / studio / cascade run). */
  lineage?: ServiceLineage

  // ---- UI overrides (auto-derived per v3 §8 when omitted) ----------------

  /**
   * Override for the auto-derived catalog UI shape (v3 §8).
   * Defaults from `name` / `promise` / `audience` / `pricing.summary` /
   * `archetype.heroTemplate` via {@link deriveCatalog}.
   */
  catalog?: CatalogShape
  /**
   * Override for the auto-derived order UI shape (v3 §8).
   * Defaults from `schema.input` (field count picks `flow`) +
   * `pricing` + `audience` via {@link deriveOrder}.
   */
  order?: OrderShape
  /**
   * Override for the auto-derived onboarding UI shape (v3 §8).
   * Defaults from `binding.toolPermissions` (one IntegrationRequirement per
   * provider) + `audience` (KYC depth) via {@link deriveOnboarding}.
   */
  onboarding?: OnboardingShape
  /**
   * Override for the auto-derived delivery UI shape (v3 §8).
   * Defaults from `archetype.estimatedCost` (time proxy) +
   * `binding.cascade.length` + oversight via {@link deriveDelivery}.
   */
  delivery?: DeliveryShape
  /**
   * Override for the auto-derived customer-portal UI shape (v3 §8).
   * Defaults to four columns (`state`/`createdAt`/`cost`/`duration`),
   * receipts always enabled, dispute flow gated on `refundContract`
   * presence, via {@link derivePortal}.
   */
  portal?: PortalShape
}
