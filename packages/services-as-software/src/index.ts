/**
 * services-as-software - Primitives for building AI-powered services that operate as software
 *
 * Services are a superset of digital-workers with a payment/business overlay,
 * capable of crossing company/business boundaries.
 *
 * @packageDocumentation
 */

// Core service primitives
export { Service } from './service.js'
export { Endpoint, GET, POST, PUT, DELETE, PATCH } from './endpoint.js'
export { Client } from './client.js'
export { Provider, providers } from './provider.js'

// Helper functions for common operations
export {
  ask,
  deliver,
  do_ as do,
  generate,
  is,
  notify,
  on,
  order,
  queue,
  quote,
  subscribe,
  every,
  entitlements,
  kpis,
  okrs,
  Plan,
  KPI,
  OKR,
  Entitlement,
} from './helpers.js'

// Export all types
export type {
  // Core types
  Service as ServiceType,
  ServiceDefinition,
  ServiceClient,
  ServiceContext,
  ServiceStatus,

  // Endpoint types
  EndpointDefinition,

  // Pricing types
  PricingModel,
  PricingConfig,
  PricingTier,
  BillingInterval,
  Currency,

  // Order/Quote/Subscription types
  Order,
  OrderStatus,
  Quote,
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,

  // Notification types
  Notification,

  // Event/Task types
  EventHandler,
  ScheduledTask,

  // Entitlement/KPI/OKR types
  EntitlementDefinition,
  KPIDefinition,
  OKRDefinition,
  KeyResult,

  // Usage tracking types
  UsageTracker,
  UsageEvent,
  Usage,

  // Client/Provider types
  ClientConfig,
  Provider as ProviderType,

  // Re-export useful types from ai-functions
  JSONSchema,
} from './types.js'

// Re-export endpoint config type
export type { EndpointConfig } from './endpoint.js'
export type { ProviderConfig } from './provider.js'
