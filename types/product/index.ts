/**
 * Product Types
 *
 * Types for offerings and marketplaces:
 * Product, Marketplace, Roadmap, Feature, Epic, Story, Bug, Backlog.
 *
 * @module product
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

// =============================================================================
// Product - Value Offering
// =============================================================================

/**
 * Product type.
 */
export type ProductType = 'physical' | 'digital' | 'hybrid' | 'subscription' | 'service'

/**
 * Product status.
 */
export type ProductStatus = 'draft' | 'active' | 'paused' | 'discontinued' | 'archived'

/**
 * Pricing model.
 */
export type PricingModel = 'one-time' | 'subscription' | 'usage-based' | 'freemium' | 'free' | 'custom'

/**
 * Offering that delivers value to customers.
 *
 * Products are the primary value units that businesses
 * sell to customers. They can be physical goods, digital
 * products, subscriptions, or services.
 *
 * @example
 * ```ts
 * const crmProduct: Product = {
 *   id: 'prod_crm',
 *   name: 'CRM Pro',
 *   type: 'digital',
 *   status: 'active',
 *   description: 'Professional CRM for growing teams',
 *   pricing: {
 *     model: 'subscription',
 *     currency: 'USD',
 *     plans: [
 *       { name: 'Starter', price: 29, interval: 'month' },
 *       { name: 'Pro', price: 99, interval: 'month' },
 *       { name: 'Enterprise', price: 299, interval: 'month' }
 *     ]
 *   },
 *   features: ['Contact Management', 'Deal Pipeline', 'Email Integration'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Product {
  /** Unique identifier */
  id: string

  /** Product name */
  name: string

  /** Product type */
  type: ProductType

  /** Current status */
  status: ProductStatus

  /** Human-readable description */
  description?: string

  /** Short tagline */
  tagline?: string

  /** Product URL/slug */
  slug?: string

  /** Product website */
  website?: string

  /** Pricing configuration */
  pricing?: {
    model: PricingModel
    currency?: string
    basePrice?: number
    plans?: Array<{
      id?: string
      name: string
      price: number
      interval?: 'day' | 'week' | 'month' | 'year' | 'one-time'
      features?: string[]
      limits?: Record<string, number>
      popular?: boolean
    }>
    customPricing?: boolean
  }

  /** Feature list */
  features?: string[]

  /** Categories/tags */
  categories?: string[]

  /** Target audience */
  audience?: {
    segments?: string[]
    industries?: string[]
    companySize?: string[]
  }

  /** Media assets */
  media?: {
    logo?: string
    icon?: string
    images?: string[]
    videos?: string[]
  }

  /** Version information */
  version?: string

  /** Release date */
  releasedAt?: Date

  /** Metrics */
  metrics?: {
    customers?: number
    mrr?: number
    rating?: number
    reviews?: number
  }

  /** Related product IDs */
  relatedProducts?: string[]

  /** Integration IDs */
  integrations?: string[]

  /** Owner business ID */
  businessId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ProductInput = Input<Product>
export type ProductOutput = Output<Product>

// =============================================================================
// Marketplace - Platform for Transactions
// =============================================================================

/**
 * Marketplace type.
 */
export type MarketplaceType = 'b2b' | 'b2c' | 'c2c' | 'services' | 'apps' | 'integrations'

/**
 * Marketplace status.
 */
export type MarketplaceStatus = 'development' | 'beta' | 'live' | 'paused' | 'deprecated'

/**
 * Platform for transactions between parties.
 *
 * Marketplaces connect buyers and sellers,
 * facilitating discovery, transactions, and
 * fulfillment of products and services.
 *
 * @example
 * ```ts
 * const appMarketplace: Marketplace = {
 *   id: 'mkt_apps',
 *   name: 'App Marketplace',
 *   type: 'apps',
 *   status: 'live',
 *   description: 'Discover integrations and apps',
 *   url: 'https://marketplace.example.com',
 *   commission: {
 *     type: 'percentage',
 *     rate: 0.15
 *   },
 *   categories: ['Analytics', 'Communication', 'Productivity'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Marketplace {
  /** Unique identifier */
  id: string

  /** Marketplace name */
  name: string

  /** Marketplace type */
  type: MarketplaceType

  /** Current status */
  status: MarketplaceStatus

  /** Human-readable description */
  description?: string

  /** Marketplace URL */
  url?: string

  /** Commission structure */
  commission?: {
    type: 'percentage' | 'flat' | 'tiered'
    rate?: number
    flatFee?: number
    tiers?: Array<{
      upTo: number
      rate: number
    }>
  }

  /** Available categories */
  categories?: string[]

  /** Featured products/listings */
  featured?: string[]

  /** Listing requirements */
  requirements?: {
    approval?: boolean
    verification?: boolean
    minRating?: number
    documents?: string[]
  }

  /** Payment configuration */
  payments?: {
    providers?: string[]
    currencies?: string[]
    escrow?: boolean
    instantPayout?: boolean
  }

  /** Review/rating configuration */
  reviews?: {
    enabled: boolean
    moderated?: boolean
    requirePurchase?: boolean
  }

  /** Metrics */
  metrics?: {
    listings?: number
    sellers?: number
    buyers?: number
    gmv?: number
    avgOrderValue?: number
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

export type MarketplaceInput = Input<Marketplace>
export type MarketplaceOutput = Output<Marketplace>

// =============================================================================
// Marketplace Listing
// =============================================================================

/**
 * Listing status.
 */
export type ListingStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'active' | 'paused' | 'removed'

/**
 * A product/service listing in a marketplace.
 */
export interface Listing {
  /** Unique identifier */
  id: string

  /** Marketplace ID */
  marketplaceId: string

  /** Product/item name */
  name: string

  /** Current status */
  status: ListingStatus

  /** Description */
  description?: string

  /** Price */
  price?: {
    amount: number
    currency: string
    type?: 'fixed' | 'starting-at' | 'negotiable'
  }

  /** Category */
  categoryId?: string

  /** Tags */
  tags?: string[]

  /** Media */
  media?: {
    images?: string[]
    videos?: string[]
    documents?: string[]
  }

  /** Seller ID */
  sellerId: string

  /** Product ID (if linked) */
  productId?: string

  /** Rating */
  rating?: {
    average: number
    count: number
  }

  /** Sales count */
  salesCount?: number

  /** View count */
  viewCount?: number

  /** Custom attributes */
  attributes?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date

  /** Published timestamp */
  publishedAt?: Date
}

export type ListingInput = Input<Listing>
export type ListingOutput = Output<Listing>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface ProductActions extends CRUDResource<Product, ProductInput> {
  /** Publish product */
  publish: Action<{ id: string }, Product>

  /** Unpublish product */
  unpublish: Action<{ id: string }, Product>

  /** Discontinue product */
  discontinue: Action<{ id: string; reason?: string }, Product>

  /** Archive product */
  archive: Action<{ id: string }, Product>

  /** Clone product */
  clone: Action<{ id: string; name: string }, Product>

  /** Update pricing */
  updatePricing: Action<{ id: string; pricing: Product['pricing'] }, Product>

  /** Add feature */
  addFeature: Action<{ id: string; feature: string }, Product>

  /** Remove feature */
  removeFeature: Action<{ id: string; feature: string }, Product>

  /** Get customers */
  getCustomers: Action<{ id: string } & ListParams, PaginatedResult<unknown>>

  /** Get revenue metrics */
  getRevenue: Action<{ id: string; from?: Date; to?: Date }, ProductRevenue>

  /** Get related products */
  getRelated: Action<{ id: string }, Product[]>
}

export interface MarketplaceActions extends CRUDResource<Marketplace, MarketplaceInput> {
  /** Launch marketplace */
  launch: Action<{ id: string }, Marketplace>

  /** Pause marketplace */
  pause: Action<{ id: string }, Marketplace>

  /** Get listings */
  getListings: Action<{ id: string } & ListParams, PaginatedResult<Listing>>

  /** Get featured listings */
  getFeatured: Action<{ id: string }, Listing[]>

  /** Get categories */
  getCategories: Action<{ id: string }, MarketplaceCategory[]>

  /** Add category */
  addCategory: Action<{ id: string; category: MarketplaceCategoryInput }, MarketplaceCategory>

  /** Remove category */
  removeCategory: Action<{ id: string; categoryId: string }, void>

  /** Get sellers */
  getSellers: Action<{ id: string } & ListParams, PaginatedResult<MarketplaceSeller>>

  /** Get analytics */
  getAnalytics: Action<{ id: string; from?: Date; to?: Date }, MarketplaceAnalytics>
}

export interface ListingActions extends CRUDResource<Listing, ListingInput> {
  /** Submit for approval */
  submit: Action<{ id: string }, Listing>

  /** Approve listing */
  approve: Action<{ id: string }, Listing>

  /** Reject listing */
  reject: Action<{ id: string; reason: string }, Listing>

  /** Publish listing */
  publish: Action<{ id: string }, Listing>

  /** Pause listing */
  pause: Action<{ id: string }, Listing>

  /** Feature listing */
  feature: Action<{ id: string; duration?: number }, Listing>

  /** Unfeature listing */
  unfeature: Action<{ id: string }, Listing>

  /** Report listing */
  report: Action<{ id: string; reason: string; details?: string }, void>

  /** Get reviews */
  getReviews: Action<{ id: string } & ListParams, PaginatedResult<ListingReview>>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface ProductRevenue {
  productId: string
  period: { from: Date; to: Date }
  revenue: {
    total: number
    recurring: number
    oneTime: number
  }
  customers: {
    total: number
    new: number
    churned: number
  }
  byPlan?: Record<string, {
    revenue: number
    customers: number
  }>
}

export interface MarketplaceCategory {
  id: string
  name: string
  slug?: string
  description?: string
  parentId?: string
  icon?: string
  listingCount?: number
  order?: number
}

export type MarketplaceCategoryInput = Input<MarketplaceCategory>

export interface MarketplaceSeller {
  id: string
  name: string
  status: 'pending' | 'approved' | 'suspended'
  rating?: number
  listingCount?: number
  salesCount?: number
  joinedAt: Date
}

export interface MarketplaceAnalytics {
  marketplaceId: string
  period: { from: Date; to: Date }
  gmv: number
  transactions: number
  avgOrderValue: number
  commission: number
  newListings: number
  newSellers: number
  newBuyers: number
  topCategories: Array<{ categoryId: string; name: string; gmv: number }>
  topListings: Array<{ listingId: string; name: string; sales: number }>
}

export interface ListingReview {
  id: string
  listingId: string
  buyerId: string
  rating: number
  title?: string
  body?: string
  verified: boolean
  helpful?: number
  createdAt: Date
  response?: {
    body: string
    createdAt: Date
  }
}

// =============================================================================
// Events
// =============================================================================

export interface ProductEvents {
  created: BaseEvent<'product.created', Product>
  updated: BaseEvent<'product.updated', Product>
  deleted: BaseEvent<'product.deleted', { id: string }>
  published: BaseEvent<'product.published', Product>
  unpublished: BaseEvent<'product.unpublished', { id: string }>
  discontinued: BaseEvent<'product.discontinued', { id: string; reason?: string }>
  archived: BaseEvent<'product.archived', { id: string }>
  cloned: BaseEvent<'product.cloned', { sourceId: string; newProduct: Product }>
  pricing_updated: BaseEvent<'product.pricing_updated', { id: string; pricing: Product['pricing'] }>
  feature_added: BaseEvent<'product.feature_added', { id: string; feature: string }>
  feature_removed: BaseEvent<'product.feature_removed', { id: string; feature: string }>
}

export interface MarketplaceEvents {
  created: BaseEvent<'marketplace.created', Marketplace>
  updated: BaseEvent<'marketplace.updated', Marketplace>
  deleted: BaseEvent<'marketplace.deleted', { id: string }>
  launched: BaseEvent<'marketplace.launched', Marketplace>
  paused: BaseEvent<'marketplace.paused', { id: string }>
  category_added: BaseEvent<'marketplace.category_added', { marketplaceId: string; category: MarketplaceCategory }>
  category_removed: BaseEvent<'marketplace.category_removed', { marketplaceId: string; categoryId: string }>
}

export interface ListingEvents {
  created: BaseEvent<'listing.created', Listing>
  updated: BaseEvent<'listing.updated', Listing>
  deleted: BaseEvent<'listing.deleted', { id: string }>
  submitted: BaseEvent<'listing.submitted', Listing>
  approved: BaseEvent<'listing.approved', Listing>
  rejected: BaseEvent<'listing.rejected', { listingId: string; reason: string }>
  published: BaseEvent<'listing.published', Listing>
  paused: BaseEvent<'listing.paused', { id: string }>
  featured: BaseEvent<'listing.featured', { listingId: string; until?: Date }>
  unfeatured: BaseEvent<'listing.unfeatured', { listingId: string }>
  reported: BaseEvent<'listing.reported', { listingId: string; reason: string }>
  reviewed: BaseEvent<'listing.reviewed', ListingReview>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface ProductResource extends ProductActions {
  on: <K extends keyof ProductEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ProductEvents[K], TProxy>
  ) => () => void
}

export interface MarketplaceResource extends MarketplaceActions {
  on: <K extends keyof MarketplaceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MarketplaceEvents[K], TProxy>
  ) => () => void
}

export interface ListingResource extends ListingActions {
  on: <K extends keyof ListingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ListingEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Roadmap - Strategic Product Planning
// =============================================================================

/**
 * Roadmap status.
 */
export type RoadmapStatus = 'draft' | 'active' | 'archived'

/**
 * Roadmap timeframe.
 */
export type RoadmapTimeframe = 'quarterly' | 'half-yearly' | 'yearly' | 'custom'

/**
 * Roadmap representing strategic product planning.
 *
 * Tracks product direction, themes, and planned features
 * for communication with stakeholders.
 *
 * @example
 * ```ts
 * const roadmap: Roadmap = {
 *   id: 'roadmap_2024_q1',
 *   productId: 'prod_001',
 *   name: 'Q1 2024 Roadmap',
 *   status: 'active',
 *   timeframe: 'quarterly',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-03-31'),
 *   themes: [
 *     { name: 'Performance', color: '#3B82F6' },
 *     { name: 'User Experience', color: '#10B981' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Roadmap {
  /** Unique identifier */
  id: string

  /** Product ID */
  productId: string

  /** Roadmap name */
  name: string

  /** Current status */
  status: RoadmapStatus

  /** Description */
  description?: string

  /** Timeframe type */
  timeframe: RoadmapTimeframe

  /** Start date */
  startDate: Date

  /** End date */
  endDate: Date

  /** Strategic themes */
  themes?: Array<{
    id?: string
    name: string
    description?: string
    color?: string
  }>

  /** Goals/objectives for this period */
  goals?: Array<{
    id?: string
    title: string
    description?: string
    metric?: string
    target?: number
    current?: number
  }>

  /** Visibility settings */
  visibility: 'internal' | 'team' | 'stakeholders' | 'public'

  /** Public URL (if published) */
  publicUrl?: string

  /** Owner ID */
  ownerId?: string

  /** Stakeholders */
  stakeholders?: string[]

  /** Last published date */
  publishedAt?: Date

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RoadmapInput = Input<Roadmap>
export type RoadmapOutput = Output<Roadmap>

// =============================================================================
// Feature - Product Capability
// =============================================================================

/**
 * Feature status.
 */
export type FeatureStatus =
  | 'idea'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'testing'
  | 'released'
  | 'deprecated'
  | 'rejected'

/**
 * Feature priority.
 */
export type FeaturePriority = 'critical' | 'high' | 'medium' | 'low' | 'none'

/**
 * Feature representing a product capability.
 *
 * Tracks feature lifecycle from idea to release.
 *
 * @example
 * ```ts
 * const feature: Feature = {
 *   id: 'feat_001',
 *   productId: 'prod_001',
 *   name: 'Advanced Reporting',
 *   status: 'in_progress',
 *   priority: 'high',
 *   description: 'Custom report builder with visualizations',
 *   targetRelease: '2.0.0',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Feature {
  /** Unique identifier */
  id: string

  /** Product ID */
  productId: string

  /** Feature name */
  name: string

  /** Current status */
  status: FeatureStatus

  /** Priority */
  priority: FeaturePriority

  /** Description */
  description?: string

  /** Problem being solved */
  problemStatement?: string

  /** Success criteria */
  successCriteria?: string[]

  /** Theme ID (from roadmap) */
  themeId?: string

  /** Roadmap ID */
  roadmapId?: string

  /** Target release version */
  targetRelease?: string

  /** Planned start date */
  plannedStartDate?: Date

  /** Planned end date */
  plannedEndDate?: Date

  /** Actual start date */
  actualStartDate?: Date

  /** Actual release date */
  releasedAt?: Date

  /** Effort estimate (story points or days) */
  effort?: number

  /** Value score (1-10) */
  valueScore?: number

  /** Confidence score (1-10) */
  confidenceScore?: number

  /** RICE score (calculated) */
  riceScore?: number

  /** Owner ID */
  ownerId?: string

  /** Team ID */
  teamId?: string

  /** Customer requests linked */
  customerRequests?: Array<{
    requestId: string
    customerId: string
    description?: string
  }>

  /** Related feature flag */
  featureFlagKey?: string

  /** Dependencies */
  dependencies?: string[]

  /** Blockers */
  blockers?: Array<{
    description: string
    blockedBy?: string
    resolvedAt?: Date
  }>

  /** Specs/design documents */
  documents?: Array<{
    type: 'spec' | 'design' | 'prd' | 'rfc' | 'other'
    name: string
    url: string
  }>

  /** Tags */
  tags?: string[]

  /** Votes/upvotes count */
  votes?: number

  /** Comments count */
  commentsCount?: number

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FeatureInput = Input<Feature>
export type FeatureOutput = Output<Feature>

// =============================================================================
// Epic - Large Initiative
// =============================================================================

/**
 * Epic status.
 */
export type EpicStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled'

/**
 * Epic representing a large initiative containing multiple stories.
 *
 * Epics group related user stories and track progress
 * toward a larger goal.
 *
 * @example
 * ```ts
 * const epic: Epic = {
 *   id: 'epic_001',
 *   projectId: 'proj_001',
 *   featureId: 'feat_001',
 *   name: 'User Authentication Overhaul',
 *   status: 'in_progress',
 *   description: 'Modernize authentication with OAuth2 and MFA',
 *   progress: 45,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Epic {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Feature ID (if linked) */
  featureId?: string

  /** Epic name */
  name: string

  /** Current status */
  status: EpicStatus

  /** Description */
  description?: string

  /** Acceptance criteria */
  acceptanceCriteria?: string[]

  /** Priority */
  priority?: FeaturePriority

  /** Owner ID */
  ownerId?: string

  /** Team ID */
  teamId?: string

  /** Start date */
  startDate?: Date

  /** Target end date */
  targetDate?: Date

  /** Completed date */
  completedAt?: Date

  /** Progress percentage (0-100) */
  progress: number

  /** Total story points */
  totalPoints?: number

  /** Completed story points */
  completedPoints?: number

  /** Story count */
  storyCount?: number

  /** Completed story count */
  completedStoryCount?: number

  /** Labels */
  labels?: string[]

  /** Color for display */
  color?: string

  /** Parent epic ID (for hierarchy) */
  parentEpicId?: string

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EpicInput = Input<Epic>
export type EpicOutput = Output<Epic>

// =============================================================================
// Story - User Story
// =============================================================================

/**
 * Story status.
 */
export type StoryStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'in_review'
  | 'testing'
  | 'done'
  | 'blocked'
  | 'cancelled'

/**
 * Story type.
 */
export type StoryType = 'feature' | 'improvement' | 'chore' | 'spike' | 'tech_debt'

/**
 * Story representing a user story or task.
 *
 * User stories describe functionality from a user's perspective
 * and are the primary unit of work in agile development.
 *
 * @example
 * ```ts
 * const story: Story = {
 *   id: 'story_001',
 *   projectId: 'proj_001',
 *   epicId: 'epic_001',
 *   title: 'As a user, I can reset my password via email',
 *   type: 'feature',
 *   status: 'in_progress',
 *   points: 3,
 *   priority: 'high',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Story {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Epic ID */
  epicId?: string

  /** Sprint ID */
  sprintId?: string

  /** Story title */
  title: string

  /** Story type */
  type: StoryType

  /** Current status */
  status: StoryStatus

  /** Description (user story format or general) */
  description?: string

  /** User story format */
  userStory?: {
    asA: string
    iWant: string
    soThat: string
  }

  /** Acceptance criteria */
  acceptanceCriteria?: Array<{
    description: string
    completed: boolean
  }>

  /** Priority */
  priority: FeaturePriority

  /** Story points */
  points?: number

  /** Time estimate (hours) */
  estimatedHours?: number

  /** Actual hours */
  actualHours?: number

  /** Assignee ID */
  assigneeId?: string

  /** Reporter ID */
  reporterId?: string

  /** Reviewer IDs */
  reviewerIds?: string[]

  /** Started date */
  startedAt?: Date

  /** Completed date */
  completedAt?: Date

  /** Due date */
  dueDate?: Date

  /** Labels */
  labels?: string[]

  /** Related pull requests */
  pullRequests?: Array<{
    url: string
    status: 'open' | 'merged' | 'closed'
  }>

  /** Subtasks */
  subtasks?: Array<{
    id: string
    title: string
    completed: boolean
    assigneeId?: string
  }>

  /** Dependencies (blocked by) */
  blockedBy?: string[]

  /** Stories this blocks */
  blocks?: string[]

  /** Attachments */
  attachments?: Array<{
    name: string
    url: string
    type: string
  }>

  /** Comments count */
  commentsCount?: number

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    jira?: string
    linear?: string
    asana?: string
    clickup?: string
    github?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type StoryInput = Input<Story>
export type StoryOutput = Output<Story>

// =============================================================================
// Bug - Defect Tracking
// =============================================================================

/**
 * Bug severity.
 */
export type BugSeverity = 'critical' | 'major' | 'minor' | 'trivial'

/**
 * Bug status.
 */
export type BugStatus =
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'in_review'
  | 'testing'
  | 'verified'
  | 'closed'
  | 'wont_fix'
  | 'duplicate'
  | 'cannot_reproduce'

/**
 * Bug representing a defect in the product.
 *
 * Tracks bugs from report through resolution.
 *
 * @example
 * ```ts
 * const bug: Bug = {
 *   id: 'bug_001',
 *   projectId: 'proj_001',
 *   title: 'Login button unresponsive on Safari',
 *   severity: 'major',
 *   priority: 'high',
 *   status: 'in_progress',
 *   environment: 'production',
 *   browser: 'Safari 17',
 *   reportedBy: 'user_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Bug {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Related epic ID */
  epicId?: string

  /** Related sprint ID */
  sprintId?: string

  /** Bug title */
  title: string

  /** Severity */
  severity: BugSeverity

  /** Priority */
  priority: FeaturePriority

  /** Current status */
  status: BugStatus

  /** Description */
  description?: string

  /** Steps to reproduce */
  stepsToReproduce?: string[]

  /** Expected behavior */
  expectedBehavior?: string

  /** Actual behavior */
  actualBehavior?: string

  /** Environment */
  environment?: string

  /** Affected version */
  affectedVersion?: string

  /** Fixed in version */
  fixedInVersion?: string

  /** Browser (for web apps) */
  browser?: string

  /** Operating system */
  os?: string

  /** Device */
  device?: string

  /** Screenshot/video URLs */
  media?: Array<{
    type: 'screenshot' | 'video' | 'log'
    url: string
    description?: string
  }>

  /** Stack trace */
  stackTrace?: string

  /** Error message */
  errorMessage?: string

  /** Reported by */
  reportedBy: string

  /** Reporter type */
  reporterType?: 'user' | 'internal' | 'automated'

  /** Assignee ID */
  assigneeId?: string

  /** Triaged by */
  triagedBy?: string

  /** Triaged date */
  triagedAt?: Date

  /** Started date */
  startedAt?: Date

  /** Resolved date */
  resolvedAt?: Date

  /** Resolution */
  resolution?: string

  /** Root cause */
  rootCause?: string

  /** Related bugs */
  relatedBugs?: string[]

  /** Duplicate of */
  duplicateOf?: string

  /** Regression */
  isRegression?: boolean

  /** Labels */
  labels?: string[]

  /** Affected users count */
  affectedUsersCount?: number

  /** Pull request URLs */
  pullRequests?: Array<{
    url: string
    status: 'open' | 'merged' | 'closed'
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    jira?: string
    linear?: string
    github?: string
    sentry?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BugInput = Input<Bug>
export type BugOutput = Output<Bug>

// =============================================================================
// Backlog - Work Queue
// =============================================================================

/**
 * Backlog type.
 */
export type BacklogType = 'product' | 'sprint' | 'team' | 'release'

/**
 * Backlog item type.
 */
export type BacklogItemType = 'story' | 'bug' | 'task' | 'epic'

/**
 * Backlog representing a prioritized list of work.
 *
 * Manages and prioritizes work items for development.
 *
 * @example
 * ```ts
 * const backlog: Backlog = {
 *   id: 'backlog_prod_001',
 *   projectId: 'proj_001',
 *   name: 'Product Backlog',
 *   type: 'product',
 *   ownerId: 'pm_001',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Backlog {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Backlog name */
  name: string

  /** Backlog type */
  type: BacklogType

  /** Description */
  description?: string

  /** Owner ID (product owner) */
  ownerId?: string

  /** Team ID */
  teamId?: string

  /** Sprint ID (for sprint backlogs) */
  sprintId?: string

  /** Release ID (for release backlogs) */
  releaseId?: string

  /** Total items */
  totalItems?: number

  /** Total story points */
  totalPoints?: number

  /** Groomed items (ready for sprint) */
  groomedItems?: number

  /** Last grooming session */
  lastGroomedAt?: Date

  /** Prioritization method */
  prioritizationMethod?: 'manual' | 'rice' | 'wsjf' | 'moscow' | 'kano'

  /** Default item columns */
  columns?: Array<{
    name: string
    statuses: string[]
    wipLimit?: number
  }>

  /** Filters saved */
  savedFilters?: Array<{
    name: string
    filter: Record<string, unknown>
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    jira?: string
    linear?: string
    asana?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BacklogInput = Input<Backlog>
export type BacklogOutput = Output<Backlog>

/**
 * Backlog item representing a work item in the backlog.
 */
export interface BacklogItem {
  /** Unique identifier */
  id: string

  /** Backlog ID */
  backlogId: string

  /** Item type */
  itemType: BacklogItemType

  /** Reference ID (story, bug, or epic ID) */
  itemId: string

  /** Position/rank in backlog */
  position: number

  /** Priority score */
  priorityScore?: number

  /** Added to backlog date */
  addedAt: Date

  /** Added by */
  addedBy?: string

  /** Notes */
  notes?: string
}

export type BacklogItemInput = Input<BacklogItem>
export type BacklogItemOutput = Output<BacklogItem>

// =============================================================================
// Product Management Actions
// =============================================================================

export interface RoadmapActions extends CRUDResource<Roadmap, RoadmapInput> {
  /** List roadmaps by product */
  listByProduct: Action<{ productId: string } & ListParams, PaginatedResult<Roadmap>>
  /** Publish roadmap */
  publish: Action<{ id: string }, Roadmap>
  /** Archive roadmap */
  archive: Action<{ id: string }, Roadmap>
  /** Add theme */
  addTheme: Action<{ id: string; theme: NonNullable<Roadmap['themes']>[0] }, Roadmap>
  /** Remove theme */
  removeTheme: Action<{ id: string; themeId: string }, Roadmap>
  /** Get features */
  getFeatures: Action<{ id: string } & ListParams, PaginatedResult<Feature>>
}

export interface FeatureActions extends CRUDResource<Feature, FeatureInput> {
  /** List features by product */
  listByProduct: Action<{ productId: string } & ListParams, PaginatedResult<Feature>>
  /** List features by roadmap */
  listByRoadmap: Action<{ roadmapId: string } & ListParams, PaginatedResult<Feature>>
  /** Update status */
  updateStatus: Action<{ id: string; status: FeatureStatus; notes?: string }, Feature>
  /** Vote for feature */
  vote: Action<{ id: string; userId: string }, Feature>
  /** Link customer request */
  linkCustomerRequest: Action<
    { id: string; requestId: string; customerId: string; description?: string },
    Feature
  >
  /** Calculate RICE score */
  calculateRice: Action<
    { id: string; reach: number; impact: number; confidence: number; effort: number },
    Feature
  >
  /** Get related epics */
  getEpics: Action<{ id: string } & ListParams, PaginatedResult<Epic>>
}

export interface EpicActions extends CRUDResource<Epic, EpicInput> {
  /** List epics by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Epic>>
  /** List epics by feature */
  listByFeature: Action<{ featureId: string } & ListParams, PaginatedResult<Epic>>
  /** Update status */
  updateStatus: Action<{ id: string; status: EpicStatus }, Epic>
  /** Update progress */
  updateProgress: Action<{ id: string }, Epic>
  /** Get stories */
  getStories: Action<{ id: string } & ListParams, PaginatedResult<Story>>
  /** Add story */
  addStory: Action<{ id: string; storyId: string }, Epic>
  /** Remove story */
  removeStory: Action<{ id: string; storyId: string }, Epic>
}

export interface StoryActions extends CRUDResource<Story, StoryInput> {
  /** List stories by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Story>>
  /** List stories by epic */
  listByEpic: Action<{ epicId: string } & ListParams, PaginatedResult<Story>>
  /** List stories by sprint */
  listBySprint: Action<{ sprintId: string } & ListParams, PaginatedResult<Story>>
  /** Update status */
  updateStatus: Action<{ id: string; status: StoryStatus }, Story>
  /** Assign */
  assign: Action<{ id: string; assigneeId: string }, Story>
  /** Add to sprint */
  addToSprint: Action<{ id: string; sprintId: string }, Story>
  /** Remove from sprint */
  removeFromSprint: Action<{ id: string }, Story>
  /** Estimate */
  estimate: Action<{ id: string; points: number }, Story>
  /** Add subtask */
  addSubtask: Action<{ id: string; title: string; assigneeId?: string }, Story>
  /** Complete subtask */
  completeSubtask: Action<{ id: string; subtaskId: string }, Story>
  /** Link pull request */
  linkPullRequest: Action<{ id: string; url: string }, Story>
}

export interface BugActions extends CRUDResource<Bug, BugInput> {
  /** List bugs by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Bug>>
  /** List bugs by severity */
  listBySeverity: Action<{ projectId: string; severity: BugSeverity } & ListParams, PaginatedResult<Bug>>
  /** Triage bug */
  triage: Action<{ id: string; severity: BugSeverity; priority: FeaturePriority; assigneeId?: string }, Bug>
  /** Update status */
  updateStatus: Action<{ id: string; status: BugStatus; resolution?: string }, Bug>
  /** Assign */
  assign: Action<{ id: string; assigneeId: string }, Bug>
  /** Mark as duplicate */
  markDuplicate: Action<{ id: string; duplicateOf: string }, Bug>
  /** Link pull request */
  linkPullRequest: Action<{ id: string; url: string }, Bug>
}

export interface BacklogActions extends CRUDResource<Backlog, BacklogInput> {
  /** List backlogs by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Backlog>>
  /** Get items */
  getItems: Action<{ id: string } & ListParams, PaginatedResult<BacklogItem>>
  /** Add item */
  addItem: Action<{ id: string; itemType: BacklogItemType; itemId: string }, BacklogItem>
  /** Remove item */
  removeItem: Action<{ id: string; itemId: string }, void>
  /** Reorder items */
  reorder: Action<{ id: string; itemIds: string[] }, Backlog>
  /** Move item */
  moveItem: Action<{ id: string; itemId: string; position: number }, BacklogItem>
  /** Groom */
  groom: Action<{ id: string }, Backlog>
  /** Calculate metrics */
  calculateMetrics: Action<{ id: string }, { totalItems: number; totalPoints: number; groomedItems: number }>
}

// =============================================================================
// Product Management Events
// =============================================================================

export interface RoadmapEvents {
  created: BaseEvent<'roadmap.created', Roadmap>
  updated: BaseEvent<'roadmap.updated', { before: Roadmap; after: Roadmap }>
  published: BaseEvent<'roadmap.published', Roadmap>
  archived: BaseEvent<'roadmap.archived', Roadmap>
}

export interface FeatureEvents {
  created: BaseEvent<'feature.created', Feature>
  updated: BaseEvent<'feature.updated', { before: Feature; after: Feature }>
  status_changed: BaseEvent<'feature.status_changed', { feature: Feature; previousStatus: FeatureStatus }>
  released: BaseEvent<'feature.released', Feature>
  deprecated: BaseEvent<'feature.deprecated', Feature>
  voted: BaseEvent<'feature.voted', { featureId: string; userId: string; totalVotes: number }>
}

export interface EpicEvents {
  created: BaseEvent<'epic.created', Epic>
  updated: BaseEvent<'epic.updated', { before: Epic; after: Epic }>
  status_changed: BaseEvent<'epic.status_changed', { epic: Epic; previousStatus: EpicStatus }>
  completed: BaseEvent<'epic.completed', Epic>
  progress_updated: BaseEvent<'epic.progress_updated', { epic: Epic; progress: number }>
}

export interface StoryEvents {
  created: BaseEvent<'story.created', Story>
  updated: BaseEvent<'story.updated', { before: Story; after: Story }>
  status_changed: BaseEvent<'story.status_changed', { story: Story; previousStatus: StoryStatus }>
  assigned: BaseEvent<'story.assigned', { story: Story; assigneeId: string }>
  completed: BaseEvent<'story.completed', Story>
  sprint_added: BaseEvent<'story.sprint_added', { storyId: string; sprintId: string }>
  sprint_removed: BaseEvent<'story.sprint_removed', { storyId: string; sprintId: string }>
}

export interface BugEvents {
  created: BaseEvent<'bug.created', Bug>
  updated: BaseEvent<'bug.updated', { before: Bug; after: Bug }>
  triaged: BaseEvent<'bug.triaged', Bug>
  status_changed: BaseEvent<'bug.status_changed', { bug: Bug; previousStatus: BugStatus }>
  assigned: BaseEvent<'bug.assigned', { bug: Bug; assigneeId: string }>
  resolved: BaseEvent<'bug.resolved', Bug>
  reopened: BaseEvent<'bug.reopened', Bug>
}

export interface BacklogEvents {
  created: BaseEvent<'backlog.created', Backlog>
  updated: BaseEvent<'backlog.updated', { before: Backlog; after: Backlog }>
  item_added: BaseEvent<'backlog.item_added', { backlog: Backlog; item: BacklogItem }>
  item_removed: BaseEvent<'backlog.item_removed', { backlogId: string; itemId: string }>
  reordered: BaseEvent<'backlog.reordered', { backlogId: string; itemIds: string[] }>
  groomed: BaseEvent<'backlog.groomed', Backlog>
}

// =============================================================================
// Product Management Resources
// =============================================================================

export interface RoadmapResource extends RoadmapActions {
  on: <E extends keyof RoadmapEvents>(
    event: E,
    handler: EventHandler<RoadmapEvents[E]>
  ) => () => void
}

export interface FeatureResource extends FeatureActions {
  on: <E extends keyof FeatureEvents>(
    event: E,
    handler: EventHandler<FeatureEvents[E]>
  ) => () => void
}

export interface EpicResource extends EpicActions {
  on: <E extends keyof EpicEvents>(
    event: E,
    handler: EventHandler<EpicEvents[E]>
  ) => () => void
}

export interface StoryResource extends StoryActions {
  on: <E extends keyof StoryEvents>(
    event: E,
    handler: EventHandler<StoryEvents[E]>
  ) => () => void
}

export interface BugResource extends BugActions {
  on: <E extends keyof BugEvents>(
    event: E,
    handler: EventHandler<BugEvents[E]>
  ) => () => void
}

export interface BacklogResource extends BacklogActions {
  on: <E extends keyof BacklogEvents>(
    event: E,
    handler: EventHandler<BacklogEvents[E]>
  ) => () => void
}

// =============================================================================
// Updated Product Proxy
// =============================================================================

/**
 * Product module proxy for RPC access.
 */
export interface ProductProxy {
  products: ProductResource
  marketplaces: MarketplaceResource
  listings: ListingResource
  roadmaps: RoadmapResource
  features: FeatureResource
  epics: EpicResource
  stories: StoryResource
  bugs: BugResource
  backlogs: BacklogResource
}
