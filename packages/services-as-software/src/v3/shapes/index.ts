/**
 * Shapes barrel — re-exports every UI shape value type and derive function.
 *
 * Per v3 §8, the six UI shapes (`catalog`, `order`, `onboarding`,
 * `delivery`, `portal`, `integrations`) are *value-side* JSON shapes the
 * customer-runtime renders. The renderers themselves live in
 * `digital-products` / `ai-props`; this layer only emits the typed shape.
 *
 * @packageDocumentation
 */

// ----------------------------------------------------------------------------
// Value types
// ----------------------------------------------------------------------------

export type {
  // Aggregates
  ServiceShapes,
  Duration,
  // FSM state alias re-exported from `../invoke/invocation-state.js` so
  // shape consumers don't need to reach into the invoke module.
  InvocationState,
  // Catalog
  CatalogShape,
  CatalogHero,
  PricingSummary,
  CatalogSocialProofSlot,
  ArchetypePreviewMode,
  CatalogComparisonRow,
  // Order
  OrderShape,
  OrderFlow,
  OrderStep,
  OrderLegal,
  // Onboarding
  OnboardingShape,
  IntegrationRequirement,
  VerificationRequirement,
  PrerequisiteRequirement,
  WelcomeStep,
  // Delivery
  DeliveryShape,
  ProgressIndicator,
  PreviewSlot,
  HITLState,
  HITLChannel,
  HITLTimeoutBehaviour,
  HITLTouchpoint,
  // Portal
  PortalShape,
  PortalFilterableColumn,
  PortalSubscriptionView,
  PortalDisputeFlow,
  // Integrations
  IntegrationsShape,
  IntegrationsProvider,
} from './types.js'

// ----------------------------------------------------------------------------
// KNOWN_PROVIDERS registry + helpers
// ----------------------------------------------------------------------------

export {
  KNOWN_PROVIDERS,
  parseToolPermission,
  providerScopesFor,
  providerDisplayName,
} from './known-providers.js'
export type { KnownProviderMeta } from './known-providers.js'

// ----------------------------------------------------------------------------
// Derive functions (six + aggregate)
// ----------------------------------------------------------------------------

export { deriveCatalog } from './derive-catalog.js'
export { deriveOrder } from './derive-order.js'
export { deriveOnboarding } from './derive-onboarding.js'
export { deriveDelivery } from './derive-delivery.js'
export { derivePortal } from './derive-portal.js'
export { deriveIntegrations } from './derive-integrations.js'
export { deriveAll } from './derive-all.js'
