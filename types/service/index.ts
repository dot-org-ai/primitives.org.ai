/**
 * Service Types
 *
 * Types for service offerings:
 * Service, SaaS.
 *
 * @module service
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// Import core Subscription for use in service contexts
import type { Subscription } from '@/core/entities'

// Re-export core Subscription types
export type {
  Subscription,
  SubscriptionInput,
  SubscriptionOutput,
  SubscriptionStatus,
  SubscriptionItem,
  SubscriptionDiscount,
  SubscriptionPause,
  BillingInterval,
} from '@/core/entities'

// Re-export core subscription actions/events/resource for convenience
export type {
  SubscriptionActions,
  SubscriptionEvents,
  SubscriptionResource,
} from '@/core/entities'

// =============================================================================
// Service - Capability Delivered to Customers
// =============================================================================

/**
 * Service type.
 */
export type ServiceType = 'consulting' | 'managed' | 'support' | 'professional' | 'implementation' | 'training' | 'custom'

/**
 * Service status.
 */
export type ServiceStatus = 'draft' | 'active' | 'paused' | 'deprecated' | 'archived'

/**
 * Service delivery model.
 */
export type DeliveryModel = 'remote' | 'onsite' | 'hybrid' | 'self-service'

/**
 * Capability delivered to customers.
 *
 * Services represent professional or managed services
 * that businesses offer alongside or independent of products.
 *
 * @example
 * ```ts
 * const consultingService: Service = {
 *   id: 'svc_consulting',
 *   name: 'CRM Implementation',
 *   type: 'implementation',
 *   status: 'active',
 *   description: 'Full CRM setup and customization',
 *   deliveryModel: 'hybrid',
 *   pricing: {
 *     model: 'fixed',
 *     startingPrice: 5000,
 *     currency: 'USD'
 *   },
 *   sla: {
 *     responseTime: '4h',
 *     availability: 0.99
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Service {
  /** Unique identifier */
  id: string

  /** Service name */
  name: string

  /** Service type */
  type: ServiceType

  /** Current status */
  status: ServiceStatus

  /** Human-readable description */
  description?: string

  /** Detailed overview */
  overview?: string

  /** How the service is delivered */
  deliveryModel?: DeliveryModel

  /** Pricing configuration */
  pricing?: {
    model: 'hourly' | 'daily' | 'fixed' | 'retainer' | 'custom'
    startingPrice?: number
    currency?: string
    hourlyRate?: number
    packages?: Array<{
      name: string
      price: number
      description?: string
      includes?: string[]
      duration?: string
    }>
  }

  /** Service Level Agreement */
  sla?: {
    responseTime?: string
    resolutionTime?: string
    availability?: number
    supportHours?: string
    channels?: Array<'email' | 'phone' | 'chat' | 'ticket'>
  }

  /** Service scope/deliverables */
  scope?: string[]

  /** Prerequisites */
  prerequisites?: string[]

  /** Duration estimate */
  duration?: {
    min?: string
    max?: string
    typical?: string
  }

  /** Target industries */
  industries?: string[]

  /** Related product IDs */
  productIds?: string[]

  /** Metrics */
  metrics?: {
    engagements?: number
    avgDuration?: number
    satisfaction?: number
    nps?: number
  }

  /** Owner business ID */
  businessId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ServiceInput = Input<Service>
export type ServiceOutput = Output<Service>

// =============================================================================
// SaaS - Software as a Service
// =============================================================================

/**
 * SaaS status.
 */
export type SaaSStatus = 'development' | 'beta' | 'live' | 'maintenance' | 'deprecated'

/**
 * Pricing tier for subscription-based services.
 *
 * Defines a pricing level with associated features,
 * limits, and billing configuration.
 *
 * @example
 * ```ts
 * const proTier: PricingTier = {
 *   id: 'tier_pro',
 *   name: 'Pro',
 *   price: 4900,
 *   interval: 'month',
 *   description: 'For growing teams',
 *   features: ['Unlimited users', 'Priority support', 'API access'],
 *   limits: { users: -1, storage: 100 },
 *   popular: true
 * }
 * ```
 */
export interface PricingTier {
  /** Unique identifier */
  id?: string

  /** Tier name */
  name: string

  /** Price in smallest currency unit (e.g., cents) */
  price: number

  /** Billing interval */
  interval?: 'month' | 'year'

  /** Human-readable description */
  description?: string

  /** List of included features */
  features?: string[]

  /** Usage limits (-1 for unlimited) */
  limits?: Record<string, number>

  /** Whether this is the recommended/highlighted tier */
  popular?: boolean

  /** Whether this is an enterprise tier requiring contact */
  enterprise?: boolean

  /** Currency code (defaults to USD) */
  currency?: string

  /** Setup fee (one-time) */
  setupFee?: number

  /** Trial days included */
  trialDays?: number
}

/**
 * Software delivered as a subscription service.
 *
 * SaaS represents cloud-hosted software products
 * with subscription pricing, multi-tenancy, and
 * continuous delivery.
 *
 * @example
 * ```ts
 * const crmSaaS: SaaS = {
 *   id: 'saas_crm',
 *   name: 'CRM Cloud',
 *   status: 'live',
 *   description: 'Cloud-based CRM platform',
 *   url: 'https://app.crm.example.com',
 *   tiers: [
 *     { name: 'Free', price: 0, limits: { users: 2, contacts: 100 } },
 *     { name: 'Pro', price: 49, limits: { users: 10, contacts: 10000 } },
 *     { name: 'Enterprise', price: 199, limits: { users: -1, contacts: -1 } }
 *   ],
 *   features: ['Contact Management', 'Deal Pipeline', 'Email Integration'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SaaS {
  /** Unique identifier */
  id: string

  /** SaaS name */
  name: string

  /** Current status */
  status: SaaSStatus

  /** Human-readable description */
  description?: string

  /** Application URL */
  url?: string

  /** API URL */
  apiUrl?: string

  /** Documentation URL */
  docsUrl?: string

  /** Pricing tiers */
  tiers?: PricingTier[]

  /** Feature list */
  features?: string[]

  /** Current version */
  version?: string

  /** Uptime SLA */
  uptime?: number

  /** Security certifications */
  security?: {
    certifications?: string[]
    compliance?: string[]
    soc2?: boolean
    gdpr?: boolean
    hipaa?: boolean
  }

  /** Data residency options */
  dataResidency?: string[]

  /** SSO/auth options */
  auth?: {
    sso?: boolean
    providers?: string[]
    mfa?: boolean
    scim?: boolean
  }

  /** Integration options */
  integrations?: {
    native?: string[]
    marketplace?: boolean
    api?: boolean
    webhooks?: boolean
  }

  /** Support options */
  support?: {
    channels?: Array<'email' | 'chat' | 'phone' | 'community'>
    hours?: string
    sla?: boolean
    dedicatedRep?: boolean
  }

  /** Metrics */
  metrics?: {
    customers?: number
    mrr?: number
    arr?: number
    churnRate?: number
    nps?: number
  }

  /** Related product ID */
  productId?: string

  /** Related app ID */
  appId?: string

  /** Related API ID */
  apiId?: string

  /** Owner business ID */
  businessId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SaaSInput = Input<SaaS>
export type SaaSOutput = Output<SaaS>

// =============================================================================
// Subscription - Re-exported from core/entities
// =============================================================================
// See ../core/entities.js for the universal Subscription type

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface ServiceActions extends CRUDResource<Service, ServiceInput> {
  /** Publish service */
  publish: Action<{ id: string }, Service>

  /** Unpublish service */
  unpublish: Action<{ id: string }, Service>

  /** Deprecate service */
  deprecate: Action<{ id: string; reason?: string }, Service>

  /** Archive service */
  archive: Action<{ id: string }, Service>

  /** Get engagements */
  getEngagements: Action<{ id: string } & ListParams, PaginatedResult<ServiceEngagement>>

  /** Create engagement */
  createEngagement: Action<{ serviceId: string; customerId: string; details?: Record<string, unknown> }, ServiceEngagement>

  /** Get metrics */
  getMetrics: Action<{ id: string; from?: Date; to?: Date }, ServiceMetrics>
}

export interface SaaSActions extends CRUDResource<SaaS, SaaSInput> {
  /** Launch SaaS */
  launch: Action<{ id: string }, SaaS>

  /** Enter maintenance mode */
  enterMaintenance: Action<{ id: string; message?: string; estimatedEnd?: Date }, SaaS>

  /** Exit maintenance mode */
  exitMaintenance: Action<{ id: string }, SaaS>

  /** Deprecate SaaS */
  deprecate: Action<{ id: string; sunsetDate?: Date; message?: string }, SaaS>

  /** Get subscriptions */
  getSubscriptions: Action<{ id: string } & ListParams, PaginatedResult<Subscription>>

  /** Add tier */
  addTier: Action<{ id: string; tier: PricingTier }, SaaS>

  /** Update tier */
  updateTier: Action<{ id: string; tierId: string; tier: Partial<PricingTier> }, SaaS>

  /** Remove tier */
  removeTier: Action<{ id: string; tierId: string }, SaaS>

  /** Get metrics */
  getMetrics: Action<{ id: string; from?: Date; to?: Date }, SaaSMetrics>

  /** Get feature usage */
  getFeatureUsage: Action<{ id: string; from?: Date; to?: Date }, Record<string, number>>
}

// SubscriptionActions is re-exported from core/entities

// =============================================================================
// Supporting Types
// =============================================================================

export interface ServiceEngagement {
  id: string
  serviceId: string
  customerId: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  startDate?: Date
  endDate?: Date
  deliverables?: string[]
  notes?: string
  satisfaction?: number
  value?: number
  createdAt: Date
  updatedAt: Date
}

export interface ServiceMetrics {
  serviceId: string
  period: { from: Date; to: Date }
  engagements: {
    total: number
    completed: number
    cancelled: number
    inProgress: number
  }
  revenue: number
  avgDuration: number
  satisfaction: number
}

export interface SaaSMetrics {
  saasId: string
  period: { from: Date; to: Date }
  mrr: number
  arr: number
  newSubscriptions: number
  churnedSubscriptions: number
  upgrades: number
  downgrades: number
  trialConversions: number
  trialConversionRate: number
  churnRate: number
  avgRevenuePerUser: number
  byTier: Record<string, {
    subscriptions: number
    mrr: number
  }>
}

// =============================================================================
// Events
// =============================================================================

export interface ServiceEvents {
  created: BaseEvent<'service.created', Service>
  updated: BaseEvent<'service.updated', Service>
  deleted: BaseEvent<'service.deleted', { id: string }>
  published: BaseEvent<'service.published', Service>
  unpublished: BaseEvent<'service.unpublished', { id: string }>
  deprecated: BaseEvent<'service.deprecated', { id: string; reason?: string }>
  archived: BaseEvent<'service.archived', { id: string }>
  engagement_created: BaseEvent<'service.engagement_created', ServiceEngagement>
  engagement_completed: BaseEvent<'service.engagement_completed', ServiceEngagement>
  engagement_cancelled: BaseEvent<'service.engagement_cancelled', { engagementId: string }>
}

export interface SaaSEvents {
  created: BaseEvent<'saas.created', SaaS>
  updated: BaseEvent<'saas.updated', SaaS>
  deleted: BaseEvent<'saas.deleted', { id: string }>
  launched: BaseEvent<'saas.launched', SaaS>
  maintenance_started: BaseEvent<'saas.maintenance_started', { id: string; message?: string; estimatedEnd?: Date }>
  maintenance_ended: BaseEvent<'saas.maintenance_ended', { id: string }>
  deprecated: BaseEvent<'saas.deprecated', { id: string; sunsetDate?: Date }>
  tier_added: BaseEvent<'saas.tier_added', { saasId: string; tier: PricingTier }>
  tier_updated: BaseEvent<'saas.tier_updated', { saasId: string; tierId: string }>
  tier_removed: BaseEvent<'saas.tier_removed', { saasId: string; tierId: string }>
}

// SubscriptionEvents is re-exported from core/entities

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface ServiceResource extends ServiceActions {
  on: <K extends keyof ServiceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ServiceEvents[K], TProxy>
  ) => () => void
}

export interface SaaSResource extends SaaSActions {
  on: <K extends keyof SaaSEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SaaSEvents[K], TProxy>
  ) => () => void
}

// SubscriptionResource is re-exported from core/entities
