/**
 * ServiceSpec — input to `Service.define()` per v3 §5.
 *
 * `ServiceSpec<TIn, TOut>` is the *spec* (mutable, partial-able) accepted by
 * the factory. The factory normalises it into a {@link ServiceInstance} (the
 * read-only shape; lives in `./service.ts`).
 *
 * Several fields are placeholder-typed pending parallel agent work:
 *   - `evaluators?` — `unknown` until the EvaluatorPanel agent ships its type.
 *   - `catalog? / order? / onboarding? / delivery? / portal?` — `unknown`
 *     until the UI shapes agent ships its types.
 *
 * All other fields reference real shipped types from `digital-tools`,
 * `autonomous-finance`, and the sibling v3 modules.
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
} from 'autonomous-finance'

import type { ServiceBinding } from './binding.js'
import type { OutputContract } from './output-contract.js'
import type { ServiceLineage } from './lineage.js'
import type { Audience, Schema } from './types.js'
import type { ServiceArchetypeRef } from './archetype/registry.js'
import type { EvaluatorPanel } from './evaluator-panel.js'

// ============================================================================
// Placeholder types — real types ship in parallel-agent work
// ============================================================================

/**
 * Placeholder for the catalog UI shape override. The UI shapes agent ships
 * the real `CatalogShape` value type.
 *
 * TODO(next-agent: UI shapes): replace `unknown` with `CatalogShape`.
 */
export type CatalogShape = unknown

/**
 * Placeholder for the order UI shape override.
 *
 * TODO(next-agent: UI shapes): replace `unknown` with `OrderShape`.
 */
export type OrderShape = unknown

/**
 * Placeholder for the onboarding UI shape override.
 *
 * TODO(next-agent: UI shapes): replace `unknown` with `OnboardingShape`.
 */
export type OnboardingShape = unknown

/**
 * Placeholder for the delivery UI shape override.
 *
 * TODO(next-agent: UI shapes): replace `unknown` with `DeliveryShape`.
 */
export type DeliveryShape = unknown

/**
 * Placeholder for the customer-portal UI shape override.
 *
 * TODO(next-agent: UI shapes): replace `unknown` with `PortalShape`.
 */
export type PortalShape = unknown

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
  /** Definition-of-done predicate + escrow rules (lives in autonomous-finance). */
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

  // ---- UI overrides (placeholder until UI shapes agent ships) -------------

  /**
   * Override for the auto-derived catalog UI shape. Placeholder until the
   * UI shapes agent ships the real type.
   *
   * TODO(next-agent: UI shapes)
   */
  catalog?: CatalogShape
  /**
   * Override for the auto-derived order UI shape. Placeholder.
   *
   * TODO(next-agent: UI shapes)
   */
  order?: OrderShape
  /**
   * Override for the auto-derived onboarding UI shape. Placeholder.
   *
   * TODO(next-agent: UI shapes)
   */
  onboarding?: OnboardingShape
  /**
   * Override for the auto-derived delivery UI shape. Placeholder.
   *
   * TODO(next-agent: UI shapes)
   */
  delivery?: DeliveryShape
  /**
   * Override for the auto-derived customer-portal UI shape. Placeholder.
   *
   * TODO(next-agent: UI shapes)
   */
  portal?: PortalShape
}
