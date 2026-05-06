/**
 * UI shape value types — six "what does the customer-runtime render?" surfaces
 * per v3 §8 (carried from v2 §5.1–§5.6).
 *
 * These are *value-side* types: the renderers themselves live in
 * `digital-products` / `ai-props`. This module only declares the typed JSON
 * shapes the customer-runtime consumes. The companion `derive-*.ts` modules
 * compute defaults from a {@link ServiceInstance}; consumers may override any
 * of the five overridable shapes on `Service.define()` (the sixth,
 * `IntegrationsShape`, is purely derived from `binding.toolPermissions`).
 *
 * Per v3 §8 derivation map:
 *
 * | Shape          | Derived from                                                                        | Override only when                                |
 * | -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
 * | `catalog`      | `name`, `promise`, `audience`, `pricing.summary`, `archetype.heroTemplate`          | Custom hero / social proof / comparison rows      |
 * | `order`        | `schema.input` + `pricing.tiers` + `audience` (which determines identity flow)      | Multi-step guided flow / consultation-first       |
 * | `onboarding`   | `binding.toolPermissions` × `audience` (KYC depth)                                  | Custom welcome flow / explicit prerequisites      |
 * | `delivery`     | `archetype.estimatedCost` (time proxy) + `binding.cascade.length` + oversight       | Custom previews / branded progress UI             |
 * | `portal`       | Default columns: `state`, `createdAt`, `cost`, `duration`                           | Custom columns / filtering                        |
 * | `integrations` | `binding.toolPermissions` × `KNOWN_PROVIDERS` registry metadata                     | (purely derived; not overridable)                 |
 *
 * @packageDocumentation
 */

import type { ServiceRef } from '../types.js'
import type { InvocationState } from '../invoke/invocation-state.js'

// Re-exported so consumers of `./shapes/` don't need to reach into `invoke/`
// when they only want to render the UI shapes.
export type { InvocationState }

// ============================================================================
// Duration — small ad-hoc value to avoid pulling in date libraries
// ============================================================================

/**
 * Coarse human-facing duration. Pure value type — no arithmetic; consumers
 * format on render. v3 §8 keeps the unit set small (seconds → days) because
 * UI surfaces never need millisecond precision and never need months/years
 * (longer-lived contracts express via `pricing.subscription.interval`).
 */
export interface Duration {
  value: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
}

// ============================================================================
// CatalogShape — the "browse" surface (v3 §8 / v2 §5.1)
// ============================================================================

/**
 * Hero block rendered at the top of the catalog page. All fields optional —
 * the renderer falls back to `name` + `promise` when absent.
 */
export interface CatalogHero {
  headline?: string
  subheadline?: string
  /** Asset reference (image / video / lottie) resolved by the renderer. */
  visual?: string
}

/**
 * How the catalog page summarises pricing in card UI before a buyer clicks
 * through. Concrete pricing details still come from the Service's `pricing`
 * value; this is a layout hint.
 */
export type PricingSummary = 'starting-at' | 'per-call' | 'tier-comparison' | 'contact-us'

/** Social-proof slot a catalog page can render. */
export type CatalogSocialProofSlot = 'testimonials' | 'logos' | 'badges' | 'metrics'

/**
 * How the archetype preview is shown ("what does this look like in action?").
 * `'none'` suppresses the preview entirely.
 */
export type ArchetypePreviewMode = 'before-after' | 'live-demo' | 'video' | 'none'

/**
 * Catalog comparison-table row — used when a Service ships against named
 * competitors or against a "before AI" baseline.
 */
export interface CatalogComparisonRow {
  label: string
  values: Record<string, string | boolean>
}

/**
 * Browse-side catalog UI shape. Per v3 §8, derived from `name` / `promise` /
 * `audience` / `pricing.summary` / `archetype.heroTemplate`; all fields opt-in.
 */
export interface CatalogShape {
  hero?: CatalogHero
  pricingSummary: PricingSummary
  socialProofSlots?: CatalogSocialProofSlot[]
  archetypePreviewMode?: ArchetypePreviewMode
  comparisonRows?: CatalogComparisonRow[]
}

// ============================================================================
// OrderShape — the "buy" surface (v3 §8 / v2 §5.2)
// ============================================================================

/**
 * Top-level order-flow shape.
 *
 * - `instant`             — single-field schema → a one-step form (e.g.
 *                           summarise text).
 * - `guided`              — multi-field schema → step-by-step wizard auto-
 *                           derived from input fields.
 * - `consultation-first`  — high-touch / regulated / enterprise services that
 *                           kick off via human consultation before commerce.
 */
export type OrderFlow = 'instant' | 'guided' | 'consultation-first'

/**
 * Single step in a `guided` order flow. Field names are JSON-pointer-style
 * paths into the validated input (e.g. `'/repoRef'`, `'/featureBrief'`).
 */
export interface OrderStep {
  title: string
  /** Field paths into `schema.input` rendered on this step. */
  fields: string[]
  helpText?: string
}

/**
 * Legal copy block rendered on the order page. `tosRef` is an opaque ref to
 * the buyer-facing terms (resolved by the renderer); `jurisdictionNotices`
 * are short strings ("California residents: ...").
 */
export interface OrderLegal {
  tosRef: string
  jurisdictionNotices: string[]
}

/**
 * Buy-side order UI shape. Per v3 §8, derived from `schema.input` (field
 * count picks `flow`) + `pricing` (tier picker) + `audience` (identity
 * flow).
 */
export interface OrderShape {
  flow: OrderFlow
  /** Required when `flow === 'guided'`; renderer auto-derives from fields. */
  steps?: OrderStep[]
  /** Optional cross-sell of related Services at order time. */
  upsells?: ServiceRef[]
  legal: OrderLegal
}

// ============================================================================
// OnboardingShape — the "set up" surface (v3 §8 / v2 §5.3)
// ============================================================================

/**
 * Required external-tool integration. `provider` is the lowercase key the
 * runtime's `$.api` registry uses (e.g. `'github'`, `'salesforce'`); `scopes`
 * are the OAuth scope strings the cascade requires.
 */
export interface IntegrationRequirement {
  provider: string
  scopes: string[]
  required: boolean
}

/**
 * Required identity / business / tax verification before delivery starts.
 * `kind` enumerates the canonical kits the runtime knows how to drive;
 * `'custom'` lets a Service plug in its own verification spec.
 */
export interface VerificationRequirement {
  kind: 'kyc-light' | 'kyc-full' | 'business-verification' | 'tax-form' | 'custom'
  /** Optional kit-specific spec (e.g. tax-form id, KYC tier). */
  spec?: unknown
}

/**
 * Free-form prerequisite the buyer must satisfy before delivery. The
 * `check` and `resolve` fields are opaque function refs (resolved by the
 * runtime); the shape carries them so the customer-runtime UI can offer a
 * "Resolve now" button without round-tripping to the Service definition.
 *
 * Note: `unknown` is intentional here — we don't want to commit to a worker
 * wiring shape inside the UI value type.
 */
export interface PrerequisiteRequirement {
  description: string
  /** Opaque ref to a check function ({@link unknown} to avoid wiring deps). */
  check?: unknown
  /** Opaque ref to a resolve function. */
  resolve?: unknown
}

/**
 * Onboarding welcome step rendered before delivery starts (intro, video,
 * sample-output preview).
 */
export interface WelcomeStep {
  title: string
  body?: string
  /** Asset reference (video / image / md doc) resolved by the renderer. */
  asset?: string
}

/**
 * Set-up-side onboarding UI shape. Per v3 §8, derived from
 * `binding.toolPermissions` (one IntegrationRequirement per provider) plus
 * `audience` (KYC depth).
 */
export interface OnboardingShape {
  integrations: IntegrationRequirement[]
  verifications: VerificationRequirement[]
  prerequisites: PrerequisiteRequirement[]
  welcomeFlow?: WelcomeStep[]
}

// ============================================================================
// DeliveryShape — the "in-flight" surface (v3 §8 / v2 §5.4)
// ============================================================================

/**
 * Step in the in-flight progress UI. `fromState` is the
 * {@link InvocationState} the indicator is shown for; `label` is the
 * humanised copy ("Drafting cold email…"); `estimatedRemaining` lets the UI
 * render a countdown.
 */
export interface ProgressIndicator {
  fromState: InvocationState
  label: string
  estimatedRemaining?: Duration
}

/**
 * Slot in the delivery surface that previews intermediate output. The
 * `rendererRef` is resolved by `digital-products` / `ai-props` at render time.
 */
export interface PreviewSlot {
  whenStateReached: InvocationState
  rendererRef: string
}

/** States in which the delivery UI may pause for a human touchpoint. */
export type HITLState = 'NEEDS_CLARIFICATION' | 'QUALITY_REVIEW' | 'ESCALATED_TO_HUMAN_REVIEW'

/** Channel a HITL touchpoint reaches the customer / reviewer through. */
export type HITLChannel = 'web' | 'email' | 'slack' | 'sms'

/** Behaviour when a HITL touchpoint times out without a response. */
export type HITLTimeoutBehaviour = 'auto-proceed' | 'auto-escalate' | 'auto-cancel'

/**
 * Human-in-the-loop touchpoint along the delivery path. v2 §5.4 / v3 §8.
 */
export interface HITLTouchpoint {
  fromState: HITLState
  channel: HITLChannel
  timeoutBehavior: HITLTimeoutBehaviour
  timeoutAfter: Duration
}

/**
 * In-flight delivery UI shape. Per v3 §8, derived from
 * `archetype.estimatedCost` (as a time proxy) + `binding.cascade.length`
 * (progress-indicator count) + oversight policy + `clarificationPolicy`.
 */
export interface DeliveryShape {
  estimatedTime: { min: Duration; max: Duration }
  progressIndicators: ProgressIndicator[]
  previewSlots?: PreviewSlot[]
  hitlTouchpoints: HITLTouchpoint[]
}

// ============================================================================
// PortalShape — the "manage" surface (v3 §8 / v2 §5.5)
// ============================================================================

/** Filterable column on the portal's invocation history table. */
export type PortalFilterableColumn = 'state' | 'date' | 'cost' | 'duration'

/**
 * Subscription overview block — only rendered for Services with
 * subscription-shaped pricing.
 */
export interface PortalSubscriptionView {
  columns: string[]
}

/** Dispute-flow gating in the portal. */
export interface PortalDisputeFlow {
  enabled: boolean
  /** Invocation states from which the buyer may open a dispute. */
  openableFromStates: InvocationState[]
}

/**
 * Manage-side portal UI shape. Per v3 §8, default columns are
 * `state` / `createdAt` / `cost` / `duration`; receipts are always enabled;
 * dispute flow depends on whether the Service declares a `refundContract`.
 */
export interface PortalShape {
  subscriptionView?: PortalSubscriptionView
  invocationHistoryColumns: string[]
  filterableBy: PortalFilterableColumn[]
  receiptsEnabled: boolean
  disputeFlow: PortalDisputeFlow
}

// ============================================================================
// IntegrationsShape — the "connections" surface (v3 §8 / v2 §5.6)
// ============================================================================

/**
 * Integration provider entry. Mirrors {@link IntegrationRequirement} but
 * lives on the integrations panel (not the onboarding flow); duplicated so
 * the integrations panel stays purely derived from `binding.toolPermissions`
 * even when a Service overrides its `OnboardingShape`.
 */
export interface IntegrationsProvider {
  name: string
  scopes: string[]
  required: boolean
}

/**
 * Integrations connection-panel shape. Per v3 §8, purely derived from
 * `binding.toolPermissions` × the `KNOWN_PROVIDERS` registry — never
 * overridable. Renderer joins against runtime `$.api` provider metadata for
 * OAuth URLs, scope descriptions, and connection-health probes.
 */
export interface IntegrationsShape {
  providers: IntegrationsProvider[]
}

// ============================================================================
// Aggregate
// ============================================================================

/**
 * Bundle of every UI shape returned by {@link deriveAll}. Each field is
 * either the override the spec carried or the derive-function output.
 */
export interface ServiceShapes {
  catalog: CatalogShape
  order: OrderShape
  onboarding: OnboardingShape
  delivery: DeliveryShape
  portal: PortalShape
  integrations: IntegrationsShape
}
