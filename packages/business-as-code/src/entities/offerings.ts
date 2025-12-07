/**
 * Offering Entity Types (Nouns)
 *
 * Product and service offerings: Product, Service, Feature, Pricing.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Product
// =============================================================================

/**
 * Product entity
 *
 * Represents a product offering.
 */
export const Product: Noun = {
  singular: 'product',
  plural: 'products',
  description: 'A product offering',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Product name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Product description',
    },
    tagline: {
      type: 'string',
      optional: true,
      description: 'Product tagline',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Product type',
      examples: ['saas', 'app', 'platform', 'api', 'hardware', 'digital', 'physical'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Product category',
    },

    // Market
    targetSegment: {
      type: 'string',
      optional: true,
      description: 'Target customer segment',
    },
    valueProposition: {
      type: 'string',
      optional: true,
      description: 'Value proposition',
    },
    useCases: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Use cases',
    },

    // Pricing
    pricingModel: {
      type: 'string',
      optional: true,
      description: 'Pricing model',
      examples: ['free', 'freemium', 'subscription', 'one-time', 'usage-based', 'tiered', 'per-seat'],
    },
    price: {
      type: 'number',
      optional: true,
      description: 'Base price',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },
    billingPeriod: {
      type: 'string',
      optional: true,
      description: 'Billing period',
      examples: ['monthly', 'yearly', 'one-time'],
    },

    // Economics
    cogs: {
      type: 'number',
      optional: true,
      description: 'Cost of goods sold',
    },
    grossMargin: {
      type: 'number',
      optional: true,
      description: 'Gross margin percentage',
    },

    // Lifecycle
    stage: {
      type: 'string',
      optional: true,
      description: 'Product stage',
      examples: ['concept', 'development', 'alpha', 'beta', 'ga', 'growth', 'mature', 'decline', 'sunset'],
    },
    launchedAt: {
      type: 'date',
      optional: true,
      description: 'Launch date',
    },
    sunsetAt: {
      type: 'date',
      optional: true,
      description: 'Sunset date',
    },

    // Status
    status: {
      type: 'string',
      description: 'Product status',
      examples: ['draft', 'active', 'paused', 'sunset', 'archived'],
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Visibility',
      examples: ['public', 'private', 'beta', 'waitlist'],
    },
  },

  relationships: {
    business: {
      type: 'Business',
      description: 'Parent business',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Product team',
    },
    features: {
      type: 'Feature[]',
      description: 'Product features',
    },
    pricingPlans: {
      type: 'PricingPlan[]',
      description: 'Pricing plans',
    },
    roadmap: {
      type: 'RoadmapItem[]',
      description: 'Product roadmap',
    },
    metrics: {
      type: 'KPI[]',
      description: 'Product metrics',
    },
  },

  actions: [
    'create',
    'update',
    'launch',
    'pause',
    'resume',
    'updatePricing',
    'addFeature',
    'removeFeature',
    'sunset',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'launched',
    'paused',
    'resumed',
    'pricingUpdated',
    'featureAdded',
    'featureRemoved',
    'sunset',
    'archived',
  ],
}

// =============================================================================
// Service
// =============================================================================

/**
 * Service entity
 *
 * Represents a service offering.
 */
export const Service: Noun = {
  singular: 'service',
  plural: 'services',
  description: 'A service offering',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Service name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Service description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Service type',
      examples: ['consulting', 'implementation', 'support', 'training', 'managed', 'professional'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Service category',
    },

    // Market
    targetSegment: {
      type: 'string',
      optional: true,
      description: 'Target customer segment',
    },
    valueProposition: {
      type: 'string',
      optional: true,
      description: 'Value proposition',
    },

    // Pricing
    pricingModel: {
      type: 'string',
      optional: true,
      description: 'Pricing model',
      examples: ['hourly', 'daily', 'fixed', 'retainer', 'value-based', 'milestone'],
    },
    hourlyRate: {
      type: 'number',
      optional: true,
      description: 'Hourly rate',
    },
    dailyRate: {
      type: 'number',
      optional: true,
      description: 'Daily rate',
    },
    fixedPrice: {
      type: 'number',
      optional: true,
      description: 'Fixed price',
    },
    retainerPrice: {
      type: 'number',
      optional: true,
      description: 'Monthly retainer',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Delivery
    deliveryTime: {
      type: 'string',
      optional: true,
      description: 'Typical delivery time',
    },
    deliveryModel: {
      type: 'string',
      optional: true,
      description: 'Delivery model',
      examples: ['onsite', 'remote', 'hybrid'],
    },

    // SLA
    slaUptime: {
      type: 'number',
      optional: true,
      description: 'SLA uptime percentage',
    },
    slaResponseTime: {
      type: 'string',
      optional: true,
      description: 'SLA response time',
    },
    slaSupportHours: {
      type: 'string',
      optional: true,
      description: 'SLA support hours',
    },

    // Scope
    inclusions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'What is included',
    },
    exclusions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'What is excluded',
    },
    deliverables: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Deliverables',
    },

    // Status
    status: {
      type: 'string',
      description: 'Service status',
      examples: ['draft', 'active', 'paused', 'discontinued', 'archived'],
    },
  },

  relationships: {
    business: {
      type: 'Business',
      description: 'Parent business',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Service team',
    },
    engagements: {
      type: 'Engagement[]',
      description: 'Active engagements',
    },
  },

  actions: [
    'create',
    'update',
    'publish',
    'pause',
    'resume',
    'updatePricing',
    'updateSLA',
    'discontinue',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'published',
    'paused',
    'resumed',
    'pricingUpdated',
    'slaUpdated',
    'discontinued',
    'archived',
  ],
}

// =============================================================================
// Feature
// =============================================================================

/**
 * Feature entity
 *
 * Represents a product feature or capability.
 */
export const Feature: Noun = {
  singular: 'feature',
  plural: 'features',
  description: 'A product feature or capability',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Feature name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Feature description',
    },

    // Classification
    category: {
      type: 'string',
      optional: true,
      description: 'Feature category',
    },
    type: {
      type: 'string',
      optional: true,
      description: 'Feature type',
      examples: ['core', 'premium', 'add-on', 'beta', 'experimental'],
    },

    // Value
    benefit: {
      type: 'string',
      optional: true,
      description: 'User benefit',
    },

    // Availability
    availability: {
      type: 'string',
      optional: true,
      description: 'Availability',
      examples: ['all', 'paid', 'enterprise', 'beta', 'early-access'],
    },
    enabledByDefault: {
      type: 'boolean',
      optional: true,
      description: 'Enabled by default',
    },

    // Status
    status: {
      type: 'string',
      description: 'Feature status',
      examples: ['planned', 'in-development', 'beta', 'ga', 'deprecated'],
    },
  },

  relationships: {
    product: {
      type: 'Product',
      description: 'Parent product',
    },
    plans: {
      type: 'PricingPlan[]',
      description: 'Available in plans',
    },
  },

  actions: [
    'create',
    'update',
    'enable',
    'disable',
    'deprecate',
    'remove',
  ],

  events: [
    'created',
    'updated',
    'enabled',
    'disabled',
    'deprecated',
    'removed',
  ],
}

// =============================================================================
// PricingPlan
// =============================================================================

/**
 * PricingPlan entity
 *
 * Represents a pricing plan or tier.
 */
export const PricingPlan: Noun = {
  singular: 'pricing-plan',
  plural: 'pricing-plans',
  description: 'A pricing plan or tier',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Plan name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Plan description',
    },

    // Classification
    tier: {
      type: 'string',
      optional: true,
      description: 'Plan tier',
      examples: ['free', 'starter', 'pro', 'business', 'enterprise', 'custom'],
    },

    // Pricing
    price: {
      type: 'number',
      description: 'Plan price',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },
    billingPeriod: {
      type: 'string',
      optional: true,
      description: 'Billing period',
      examples: ['monthly', 'yearly', 'one-time'],
    },
    annualDiscount: {
      type: 'number',
      optional: true,
      description: 'Annual discount percentage',
    },

    // Usage
    includedUnits: {
      type: 'number',
      optional: true,
      description: 'Included units/seats',
    },
    unitPrice: {
      type: 'number',
      optional: true,
      description: 'Price per additional unit',
    },
    usageLimits: {
      type: 'json',
      optional: true,
      description: 'Usage limits',
    },

    // Trial
    trialDays: {
      type: 'number',
      optional: true,
      description: 'Trial period in days',
    },

    // Display
    highlighted: {
      type: 'boolean',
      optional: true,
      description: 'Highlight on pricing page',
    },
    displayOrder: {
      type: 'number',
      optional: true,
      description: 'Display order',
    },

    // Status
    status: {
      type: 'string',
      description: 'Plan status',
      examples: ['active', 'hidden', 'discontinued', 'legacy'],
    },
  },

  relationships: {
    product: {
      type: 'Product',
      description: 'Parent product',
    },
    features: {
      type: 'Feature[]',
      description: 'Included features',
    },
    subscriptions: {
      type: 'Subscription[]',
      description: 'Active subscriptions',
    },
  },

  actions: [
    'create',
    'update',
    'publish',
    'hide',
    'updatePrice',
    'addFeature',
    'removeFeature',
    'discontinue',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'published',
    'hidden',
    'priceUpdated',
    'featureAdded',
    'featureRemoved',
    'discontinued',
    'archived',
  ],
}

// =============================================================================
// RoadmapItem
// =============================================================================

/**
 * RoadmapItem entity
 *
 * Represents an item on the product roadmap.
 */
export const RoadmapItem: Noun = {
  singular: 'roadmap-item',
  plural: 'roadmap-items',
  description: 'An item on the product roadmap',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Item name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Item description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Item type',
      examples: ['feature', 'improvement', 'bug-fix', 'refactor', 'infrastructure'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Item category',
    },

    // Timeline
    quarter: {
      type: 'string',
      optional: true,
      description: 'Target quarter (e.g., "Q1 2025")',
    },
    targetDate: {
      type: 'date',
      optional: true,
      description: 'Target date',
    },
    completedAt: {
      type: 'date',
      optional: true,
      description: 'Completion date',
    },

    // Priority
    priority: {
      type: 'string',
      optional: true,
      description: 'Priority level',
      examples: ['critical', 'high', 'medium', 'low'],
    },
    effort: {
      type: 'string',
      optional: true,
      description: 'Effort estimate',
      examples: ['xs', 's', 'm', 'l', 'xl'],
    },
    impact: {
      type: 'string',
      optional: true,
      description: 'Expected impact',
      examples: ['high', 'medium', 'low'],
    },

    // Progress
    progress: {
      type: 'number',
      optional: true,
      description: 'Progress percentage (0-100)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Item status',
      examples: ['idea', 'planned', 'in-progress', 'completed', 'cancelled', 'deferred'],
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Public visibility',
      examples: ['public', 'private'],
    },
  },

  relationships: {
    product: {
      type: 'Product',
      description: 'Parent product',
    },
    feature: {
      type: 'Feature',
      required: false,
      description: 'Related feature',
    },
    owner: {
      type: 'Worker',
      required: false,
      description: 'Item owner',
    },
  },

  actions: [
    'create',
    'update',
    'schedule',
    'start',
    'complete',
    'defer',
    'cancel',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'scheduled',
    'started',
    'completed',
    'deferred',
    'cancelled',
    'archived',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const OfferingEntities = {
  Product,
  Service,
  Feature,
  PricingPlan,
  RoadmapItem,
}

export const OfferingCategories = {
  products: ['Product', 'Feature', 'RoadmapItem'],
  services: ['Service'],
  pricing: ['PricingPlan'],
} as const
