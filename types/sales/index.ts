/**
 * Sales & Revenue Types
 *
 * Types for sales operations and revenue management:
 * Lead, Opportunity, Pipeline, Stage, Quote, Order, Contract,
 * Territory, SalesRep, Commission, Forecast, Target, Activity,
 * Cadence, PriceBook, Discount, Competitor.
 *
 * @module sales
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
// Enums & Types
// =============================================================================

/**
 * Lead status.
 */
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'dead'

/**
 * Lead source.
 */
export type LeadSource =
  | 'website'
  | 'referral'
  | 'social_media'
  | 'email_campaign'
  | 'cold_call'
  | 'event'
  | 'advertisement'
  | 'partner'
  | 'organic'
  | 'other'

/**
 * Opportunity status.
 */
export type OpportunityStatus =
  | 'open'
  | 'won'
  | 'lost'
  | 'abandoned'

/**
 * Quote status.
 */
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

/**
 * Order status.
 */
export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

/**
 * Contract status.
 */
export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'renewed'

/**
 * Activity type.
 */
export type ActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'demo'
  | 'presentation'
  | 'follow_up'
  | 'proposal'
  | 'negotiation'
  | 'other'

/**
 * Forecast category.
 */
export type ForecastCategory =
  | 'pipeline'
  | 'best_case'
  | 'commit'
  | 'closed'
  | 'omitted'

// =============================================================================
// Lead - Sales Lead
// =============================================================================

/**
 * Sales lead representing a potential customer.
 *
 * Leads are unqualified potential customers that need
 * to be nurtured and qualified before becoming opportunities.
 *
 * @example
 * ```ts
 * const lead: Lead = {
 *   id: 'lead_123',
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   email: 'jane.doe@example.com',
 *   company: 'Acme Corp',
 *   status: 'new',
 *   source: 'website',
 *   score: 75,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Lead {
  /** Unique identifier */
  id: string

  /** First name */
  firstName?: string

  /** Last name */
  lastName?: string

  /** Email address */
  email: string

  /** Phone number */
  phone?: string

  /** Company name */
  company?: string

  /** Job title */
  jobTitle?: string

  /** Lead status */
  status: LeadStatus

  /** Lead source */
  source?: LeadSource

  /** Lead score (0-100) */
  score?: number

  /** Industry */
  industry?: string

  /** Company size */
  companySize?: string

  /** Annual revenue estimate */
  annualRevenue?: number

  /** Currency */
  currency?: string

  /** Website */
  website?: string

  /** Address */
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Assigned sales rep ID */
  ownerId?: string

  /** Territory ID */
  territoryId?: string

  /** Campaign ID */
  campaignId?: string

  /** Notes */
  notes?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Last contacted timestamp */
  lastContactedAt?: Date

  /** Converted to opportunity ID */
  convertedOpportunityId?: string

  /** Converted timestamp */
  convertedAt?: Date

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LeadInput = Input<Lead>
export type LeadOutput = Output<Lead>

// =============================================================================
// Opportunity - Sales Opportunity/Deal
// =============================================================================

/**
 * Sales opportunity representing a qualified deal.
 *
 * Opportunities are qualified leads that are actively
 * being pursued through the sales pipeline.
 *
 * @example
 * ```ts
 * const opportunity: Opportunity = {
 *   id: 'opp_123',
 *   name: 'Acme Enterprise Deal',
 *   amount: 100000,
 *   currency: 'USD',
 *   status: 'open',
 *   probability: 60,
 *   pipelineId: 'pipeline_1',
 *   stageId: 'stage_proposal',
 *   expectedCloseDate: new Date('2025-03-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Opportunity {
  /** Unique identifier */
  id: string

  /** Opportunity name */
  name: string

  /** Deal amount */
  amount?: number

  /** Currency */
  currency?: string

  /** Opportunity status */
  status: OpportunityStatus

  /** Win probability (0-100) */
  probability?: number

  /** Pipeline ID */
  pipelineId?: string

  /** Current stage ID */
  stageId?: string

  /** Expected close date */
  expectedCloseDate?: Date

  /** Actual close date */
  closedAt?: Date

  /** Associated lead ID */
  leadId?: string

  /** Primary contact ID */
  contactId?: string

  /** Company/account ID */
  accountId?: string

  /** Assigned sales rep ID */
  ownerId?: string

  /** Territory ID */
  territoryId?: string

  /** Deal type */
  type?: string

  /** Deal source */
  source?: LeadSource

  /** Win reason */
  winReason?: string

  /** Loss reason */
  lossReason?: string

  /** Competitor (if lost) */
  competitorId?: string

  /** Next step */
  nextStep?: string

  /** Description */
  description?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Last activity timestamp */
  lastActivityAt?: Date

  /** Stage entry timestamp */
  stageEnteredAt?: Date

  /** Days in current stage */
  daysInStage?: number

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OpportunityInput = Input<Opportunity>
export type OpportunityOutput = Output<Opportunity>

// =============================================================================
// Pipeline - Sales Pipeline
// =============================================================================

/**
 * Sales pipeline defining the stages of the sales process.
 *
 * @example
 * ```ts
 * const pipeline: Pipeline = {
 *   id: 'pipeline_1',
 *   name: 'Enterprise Sales',
 *   description: 'Pipeline for enterprise deals',
 *   isDefault: true,
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Pipeline {
  /** Unique identifier */
  id: string

  /** Pipeline name */
  name: string

  /** Description */
  description?: string

  /** Is default pipeline */
  isDefault?: boolean

  /** Is active */
  isActive?: boolean

  /** Display order */
  order?: number

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PipelineInput = Input<Pipeline>
export type PipelineOutput = Output<Pipeline>

// =============================================================================
// Stage - Pipeline Stage
// =============================================================================

/**
 * Stage within a sales pipeline.
 *
 * @example
 * ```ts
 * const stage: Stage = {
 *   id: 'stage_proposal',
 *   pipelineId: 'pipeline_1',
 *   name: 'Proposal',
 *   probability: 60,
 *   order: 3,
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Stage {
  /** Unique identifier */
  id: string

  /** Pipeline ID */
  pipelineId: string

  /** Stage name */
  name: string

  /** Default probability (0-100) */
  probability?: number

  /** Display order */
  order: number

  /** Is active */
  isActive?: boolean

  /** Is closed/won stage */
  isWon?: boolean

  /** Is closed/lost stage */
  isLost?: boolean

  /** Rotation rules */
  rotationRules?: Record<string, unknown>

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type StageInput = Input<Stage>
export type StageOutput = Output<Stage>

// =============================================================================
// Quote - Sales Quote/Proposal
// =============================================================================

/**
 * Sales quote or proposal.
 *
 * @example
 * ```ts
 * const quote: Quote = {
 *   id: 'quote_123',
 *   quoteNumber: 'Q-2025-001',
 *   name: 'Enterprise License Quote',
 *   status: 'sent',
 *   opportunityId: 'opp_123',
 *   subtotal: 95000,
 *   tax: 5000,
 *   total: 100000,
 *   currency: 'USD',
 *   validUntil: new Date('2025-02-28'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Quote {
  /** Unique identifier */
  id: string

  /** Quote number */
  quoteNumber?: string

  /** Quote name/title */
  name: string

  /** Quote status */
  status: QuoteStatus

  /** Associated opportunity ID */
  opportunityId?: string

  /** Contact ID */
  contactId?: string

  /** Account ID */
  accountId?: string

  /** Assigned sales rep ID */
  ownerId?: string

  /** Subtotal amount */
  subtotal?: number

  /** Tax amount */
  tax?: number

  /** Discount amount */
  discount?: number

  /** Shipping amount */
  shipping?: number

  /** Total amount */
  total?: number

  /** Currency */
  currency?: string

  /** Valid until date */
  validUntil?: Date

  /** Sent timestamp */
  sentAt?: Date

  /** Viewed timestamp */
  viewedAt?: Date

  /** Accepted timestamp */
  acceptedAt?: Date

  /** Rejected timestamp */
  rejectedAt?: Date

  /** Rejection reason */
  rejectionReason?: string

  /** Terms and conditions */
  terms?: string

  /** Notes */
  notes?: string

  /** Template ID */
  templateId?: string

  /** PDF URL */
  pdfUrl?: string

  /** Billing address */
  billingAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Shipping address */
  shippingAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type QuoteInput = Input<Quote>
export type QuoteOutput = Output<Quote>

// =============================================================================
// QuoteLineItem - Quote Line Item
// =============================================================================

/**
 * Line item within a quote.
 *
 * @example
 * ```ts
 * const lineItem: QuoteLineItem = {
 *   id: 'qli_123',
 *   quoteId: 'quote_123',
 *   productId: 'prod_456',
 *   name: 'Enterprise License',
 *   quantity: 100,
 *   unitPrice: 1000,
 *   subtotal: 100000,
 *   total: 100000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface QuoteLineItem {
  /** Unique identifier */
  id: string

  /** Quote ID */
  quoteId: string

  /** Product ID */
  productId?: string

  /** Price book entry ID */
  priceBookEntryId?: string

  /** Item name */
  name: string

  /** Description */
  description?: string

  /** Quantity */
  quantity: number

  /** Unit price */
  unitPrice: number

  /** Discount percentage */
  discountPercent?: number

  /** Discount amount */
  discountAmount?: number

  /** Subtotal (before discount) */
  subtotal?: number

  /** Total (after discount) */
  total?: number

  /** Tax rate */
  taxRate?: number

  /** Tax amount */
  taxAmount?: number

  /** SKU */
  sku?: string

  /** Display order */
  order?: number

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type QuoteLineItemInput = Input<QuoteLineItem>
export type QuoteLineItemOutput = Output<QuoteLineItem>

// =============================================================================
// Order - Sales Order
// =============================================================================

/**
 * Sales order.
 *
 * @example
 * ```ts
 * const order: Order = {
 *   id: 'order_123',
 *   orderNumber: 'ORD-2025-001',
 *   status: 'confirmed',
 *   quoteId: 'quote_123',
 *   opportunityId: 'opp_123',
 *   subtotal: 95000,
 *   tax: 5000,
 *   total: 100000,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Order {
  /** Unique identifier */
  id: string

  /** Order number */
  orderNumber?: string

  /** Order status */
  status: OrderStatus

  /** Associated quote ID */
  quoteId?: string

  /** Associated opportunity ID */
  opportunityId?: string

  /** Contact ID */
  contactId?: string

  /** Account ID */
  accountId?: string

  /** Assigned sales rep ID */
  ownerId?: string

  /** Subtotal amount */
  subtotal?: number

  /** Tax amount */
  tax?: number

  /** Discount amount */
  discount?: number

  /** Shipping amount */
  shipping?: number

  /** Total amount */
  total?: number

  /** Currency */
  currency?: string

  /** Purchase order number */
  poNumber?: string

  /** Billing address */
  billingAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Shipping address */
  shippingAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Expected delivery date */
  expectedDeliveryDate?: Date

  /** Actual delivery date */
  deliveredAt?: Date

  /** Confirmed timestamp */
  confirmedAt?: Date

  /** Shipped timestamp */
  shippedAt?: Date

  /** Cancelled timestamp */
  cancelledAt?: Date

  /** Cancellation reason */
  cancellationReason?: string

  /** Tracking number */
  trackingNumber?: string

  /** Carrier */
  carrier?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OrderInput = Input<Order>
export type OrderOutput = Output<Order>

// =============================================================================
// OrderLineItem - Order Line Item
// =============================================================================

/**
 * Line item within an order.
 *
 * @example
 * ```ts
 * const lineItem: OrderLineItem = {
 *   id: 'oli_123',
 *   orderId: 'order_123',
 *   productId: 'prod_456',
 *   name: 'Enterprise License',
 *   quantity: 100,
 *   unitPrice: 1000,
 *   total: 100000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface OrderLineItem {
  /** Unique identifier */
  id: string

  /** Order ID */
  orderId: string

  /** Product ID */
  productId?: string

  /** Quote line item ID */
  quoteLineItemId?: string

  /** Item name */
  name: string

  /** Description */
  description?: string

  /** Quantity */
  quantity: number

  /** Unit price */
  unitPrice: number

  /** Discount amount */
  discountAmount?: number

  /** Subtotal */
  subtotal?: number

  /** Total */
  total?: number

  /** Tax amount */
  taxAmount?: number

  /** SKU */
  sku?: string

  /** Display order */
  order?: number

  /** Fulfillment status */
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OrderLineItemInput = Input<OrderLineItem>
export type OrderLineItemOutput = Output<OrderLineItem>

// =============================================================================
// Contract - Sales Contract
// =============================================================================

/**
 * Sales contract.
 *
 * @example
 * ```ts
 * const contract: Contract = {
 *   id: 'contract_123',
 *   contractNumber: 'CNT-2025-001',
 *   name: 'Enterprise Services Agreement',
 *   status: 'active',
 *   opportunityId: 'opp_123',
 *   value: 500000,
 *   currency: 'USD',
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2026-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Contract {
  /** Unique identifier */
  id: string

  /** Contract number */
  contractNumber?: string

  /** Contract name/title */
  name: string

  /** Contract status */
  status: ContractStatus

  /** Associated opportunity ID */
  opportunityId?: string

  /** Account ID */
  accountId?: string

  /** Contact ID */
  contactId?: string

  /** Assigned sales rep ID */
  ownerId?: string

  /** Contract value */
  value?: number

  /** Currency */
  currency?: string

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Billing frequency */
  billingFrequency?: 'monthly' | 'quarterly' | 'annually' | 'one-time'

  /** Payment terms */
  paymentTerms?: string

  /** Auto-renew */
  autoRenew?: boolean

  /** Renewal term (months) */
  renewalTerm?: number

  /** Notice period (days) */
  noticePeriod?: number

  /** Terms and conditions */
  terms?: string

  /** Special terms */
  specialTerms?: string

  /** Signed timestamp */
  signedAt?: Date

  /** Activated timestamp */
  activatedAt?: Date

  /** Expired timestamp */
  expiredAt?: Date

  /** Cancelled timestamp */
  cancelledAt?: Date

  /** Cancellation reason */
  cancellationReason?: string

  /** Renewed to contract ID */
  renewedToContractId?: string

  /** Renewed from contract ID */
  renewedFromContractId?: string

  /** Document URL */
  documentUrl?: string

  /** Signed document URL */
  signedDocumentUrl?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContractInput = Input<Contract>
export type ContractOutput = Output<Contract>

// =============================================================================
// Territory - Sales Territory
// =============================================================================

/**
 * Sales territory for geographic or account-based assignment.
 *
 * @example
 * ```ts
 * const territory: Territory = {
 *   id: 'terr_123',
 *   name: 'West Coast Enterprise',
 *   type: 'geographic',
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Territory {
  /** Unique identifier */
  id: string

  /** Territory name */
  name: string

  /** Description */
  description?: string

  /** Territory type */
  type?: 'geographic' | 'industry' | 'account_based' | 'product' | 'custom'

  /** Is active */
  isActive?: boolean

  /** Parent territory ID */
  parentTerritoryId?: string

  /** Assigned sales rep IDs */
  salesRepIds?: string[]

  /** Manager ID */
  managerId?: string

  /** Geographic regions */
  regions?: string[]

  /** Countries */
  countries?: string[]

  /** States/provinces */
  states?: string[]

  /** Cities */
  cities?: string[]

  /** Postal codes */
  postalCodes?: string[]

  /** Industries */
  industries?: string[]

  /** Account IDs */
  accountIds?: string[]

  /** Custom rules */
  rules?: Record<string, unknown>

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TerritoryInput = Input<Territory>
export type TerritoryOutput = Output<Territory>

// =============================================================================
// SalesRep - Sales Representative
// =============================================================================

/**
 * Sales representative.
 *
 * @example
 * ```ts
 * const salesRep: SalesRep = {
 *   id: 'rep_123',
 *   userId: 'user_456',
 *   email: 'john.sales@example.com',
 *   firstName: 'John',
 *   lastName: 'Sales',
 *   role: 'account_executive',
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SalesRep {
  /** Unique identifier */
  id: string

  /** User ID */
  userId?: string

  /** Email address */
  email: string

  /** First name */
  firstName?: string

  /** Last name */
  lastName?: string

  /** Phone number */
  phone?: string

  /** Role */
  role?: 'sdr' | 'bdr' | 'account_executive' | 'account_manager' | 'sales_manager' | 'vp_sales' | 'other'

  /** Is active */
  isActive?: boolean

  /** Territory IDs */
  territoryIds?: string[]

  /** Manager ID */
  managerId?: string

  /** Team ID */
  teamId?: string

  /** Quota (annual) */
  quota?: number

  /** Quota currency */
  quotaCurrency?: string

  /** Commission plan ID */
  commissionPlanId?: string

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Skills */
  skills?: string[]

  /** Languages */
  languages?: string[]

  /** Avatar URL */
  avatarUrl?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SalesRepInput = Input<SalesRep>
export type SalesRepOutput = Output<SalesRep>

// =============================================================================
// Commission - Commission Record
// =============================================================================

/**
 * Commission record for a sales transaction.
 *
 * @example
 * ```ts
 * const commission: Commission = {
 *   id: 'comm_123',
 *   salesRepId: 'rep_123',
 *   opportunityId: 'opp_123',
 *   amount: 5000,
 *   currency: 'USD',
 *   rate: 0.05,
 *   status: 'pending',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Commission {
  /** Unique identifier */
  id: string

  /** Sales rep ID */
  salesRepId: string

  /** Opportunity ID */
  opportunityId?: string

  /** Order ID */
  orderId?: string

  /** Contract ID */
  contractId?: string

  /** Commission plan ID */
  commissionPlanId?: string

  /** Commission amount */
  amount: number

  /** Currency */
  currency?: string

  /** Commission rate */
  rate?: number

  /** Base amount (deal value) */
  baseAmount?: number

  /** Status */
  status?: 'pending' | 'approved' | 'paid' | 'cancelled'

  /** Period start */
  periodStart?: Date

  /** Period end */
  periodEnd?: Date

  /** Payment date */
  paymentDate?: Date

  /** Payment method */
  paymentMethod?: string

  /** Payment reference */
  paymentReference?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CommissionInput = Input<Commission>
export type CommissionOutput = Output<Commission>

// =============================================================================
// CommissionPlan - Commission Structure
// =============================================================================

/**
 * Commission plan defining commission structure.
 *
 * @example
 * ```ts
 * const plan: CommissionPlan = {
 *   id: 'plan_123',
 *   name: 'Standard Sales Commission',
 *   isActive: true,
 *   baseRate: 0.05,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CommissionPlan {
  /** Unique identifier */
  id: string

  /** Plan name */
  name: string

  /** Description */
  description?: string

  /** Is active */
  isActive?: boolean

  /** Base commission rate */
  baseRate?: number

  /** Tiered rates */
  tiers?: Array<{
    from: number
    to?: number
    rate: number
  }>

  /** Product-specific rates */
  productRates?: Record<string, number>

  /** Multipliers */
  multipliers?: {
    newBusiness?: number
    renewal?: number
    upsell?: number
  }

  /** Minimum deal size */
  minDealSize?: number

  /** Maximum commission per deal */
  maxCommissionPerDeal?: number

  /** Payment frequency */
  paymentFrequency?: 'monthly' | 'quarterly' | 'annually'

  /** Payment timing */
  paymentTiming?: 'on_close' | 'on_payment' | 'on_delivery'

  /** Clawback period (days) */
  clawbackPeriod?: number

  /** Custom rules */
  rules?: Record<string, unknown>

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CommissionPlanInput = Input<CommissionPlan>
export type CommissionPlanOutput = Output<CommissionPlan>

// =============================================================================
// Forecast - Sales Forecast
// =============================================================================

/**
 * Sales forecast for a period.
 *
 * @example
 * ```ts
 * const forecast: Forecast = {
 *   id: 'forecast_123',
 *   salesRepId: 'rep_123',
 *   period: 'Q1 2025',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-03-31'),
 *   category: 'commit',
 *   amount: 250000,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Forecast {
  /** Unique identifier */
  id: string

  /** Sales rep ID */
  salesRepId?: string

  /** Territory ID */
  territoryId?: string

  /** Team ID */
  teamId?: string

  /** Period name */
  period: string

  /** Period start date */
  periodStart: Date

  /** Period end date */
  periodEnd: Date

  /** Forecast category */
  category: ForecastCategory

  /** Forecasted amount */
  amount: number

  /** Currency */
  currency?: string

  /** Quota for period */
  quota?: number

  /** Quota attainment percentage */
  quotaAttainment?: number

  /** Opportunity IDs included */
  opportunityIds?: string[]

  /** Weighted amount */
  weightedAmount?: number

  /** Notes */
  notes?: string

  /** Submitted timestamp */
  submittedAt?: Date

  /** Submitted by */
  submittedBy?: string

  /** Approved timestamp */
  approvedAt?: Date

  /** Approved by */
  approvedBy?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ForecastInput = Input<Forecast>
export type ForecastOutput = Output<Forecast>

// =============================================================================
// Target - Sales Target/Quota
// =============================================================================

/**
 * Sales target or quota.
 *
 * @example
 * ```ts
 * const target: Target = {
 *   id: 'target_123',
 *   salesRepId: 'rep_123',
 *   period: 'Q1 2025',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-03-31'),
 *   target: 300000,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Target {
  /** Unique identifier */
  id: string

  /** Sales rep ID */
  salesRepId?: string

  /** Territory ID */
  territoryId?: string

  /** Team ID */
  teamId?: string

  /** Period name */
  period: string

  /** Period start date */
  periodStart: Date

  /** Period end date */
  periodEnd: Date

  /** Target amount */
  target: number

  /** Currency */
  currency?: string

  /** Target type */
  type?: 'revenue' | 'bookings' | 'deals' | 'activities' | 'custom'

  /** Actual achieved */
  actual?: number

  /** Achievement percentage */
  achievement?: number

  /** Metric unit */
  metricUnit?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TargetInput = Input<Target>
export type TargetOutput = Output<Target>

// =============================================================================
// Activity - Sales Activity
// =============================================================================

/**
 * Sales activity (call, email, meeting, etc.).
 *
 * @example
 * ```ts
 * const activity: Activity = {
 *   id: 'act_123',
 *   type: 'call',
 *   subject: 'Discovery call with Acme',
 *   leadId: 'lead_123',
 *   ownerId: 'rep_123',
 *   scheduledAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Activity {
  /** Unique identifier */
  id: string

  /** Activity type */
  type: ActivityType

  /** Subject/title */
  subject?: string

  /** Description */
  description?: string

  /** Associated lead ID */
  leadId?: string

  /** Associated opportunity ID */
  opportunityId?: string

  /** Associated contact ID */
  contactId?: string

  /** Associated account ID */
  accountId?: string

  /** Assigned sales rep ID */
  ownerId?: string

  /** Status */
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'

  /** Scheduled date/time */
  scheduledAt?: Date

  /** Completed date/time */
  completedAt?: Date

  /** Duration (minutes) */
  duration?: number

  /** Outcome */
  outcome?: string

  /** Follow-up required */
  followUpRequired?: boolean

  /** Follow-up date */
  followUpDate?: Date

  /** Attendees */
  attendees?: string[]

  /** Location */
  location?: string

  /** Meeting URL */
  meetingUrl?: string

  /** Recording URL */
  recordingUrl?: string

  /** Cadence ID */
  cadenceId?: string

  /** Cadence step ID */
  cadenceStepId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    calendar?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ActivityInput = Input<Activity>
export type ActivityOutput = Output<Activity>

// =============================================================================
// Cadence - Sales Sequence/Cadence
// =============================================================================

/**
 * Sales cadence or sequence for automated outreach.
 *
 * @example
 * ```ts
 * const cadence: Cadence = {
 *   id: 'cadence_123',
 *   name: 'Enterprise Outreach',
 *   description: '7-day enterprise lead nurture sequence',
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Cadence {
  /** Unique identifier */
  id: string

  /** Cadence name */
  name: string

  /** Description */
  description?: string

  /** Is active */
  isActive?: boolean

  /** Target audience */
  targetAudience?: string

  /** Goals */
  goals?: string[]

  /** Owner ID */
  ownerId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    outreach?: string
    salesloft?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CadenceInput = Input<Cadence>
export type CadenceOutput = Output<Cadence>

// =============================================================================
// CadenceStep - Cadence Step
// =============================================================================

/**
 * Individual step within a sales cadence.
 *
 * @example
 * ```ts
 * const step: CadenceStep = {
 *   id: 'step_123',
 *   cadenceId: 'cadence_123',
 *   order: 1,
 *   type: 'email',
 *   delayDays: 0,
 *   subject: 'Introduction to our platform',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CadenceStep {
  /** Unique identifier */
  id: string

  /** Cadence ID */
  cadenceId: string

  /** Step order */
  order: number

  /** Step type */
  type: ActivityType

  /** Delay from previous step (days) */
  delayDays: number

  /** Subject (for emails) */
  subject?: string

  /** Body/content */
  body?: string

  /** Template ID */
  templateId?: string

  /** Duration (for calls/meetings) */
  duration?: number

  /** Is automated */
  isAutomated?: boolean

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    outreach?: string
    salesloft?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CadenceStepInput = Input<CadenceStep>
export type CadenceStepOutput = Output<CadenceStep>

// =============================================================================
// PriceBook - Pricing Catalog
// =============================================================================

/**
 * Price book containing product pricing.
 *
 * @example
 * ```ts
 * const priceBook: PriceBook = {
 *   id: 'pb_123',
 *   name: 'Standard Price Book',
 *   isActive: true,
 *   isStandard: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PriceBook {
  /** Unique identifier */
  id: string

  /** Price book name */
  name: string

  /** Description */
  description?: string

  /** Is active */
  isActive?: boolean

  /** Is standard price book */
  isStandard?: boolean

  /** Currency */
  currency?: string

  /** Valid from date */
  validFrom?: Date

  /** Valid until date */
  validUntil?: Date

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PriceBookInput = Input<PriceBook>
export type PriceBookOutput = Output<PriceBook>

// =============================================================================
// PriceBookEntry - Price Book Entry
// =============================================================================

/**
 * Price book entry for a specific product.
 *
 * @example
 * ```ts
 * const entry: PriceBookEntry = {
 *   id: 'pbe_123',
 *   priceBookId: 'pb_123',
 *   productId: 'prod_456',
 *   unitPrice: 1000,
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PriceBookEntry {
  /** Unique identifier */
  id: string

  /** Price book ID */
  priceBookId: string

  /** Product ID */
  productId: string

  /** Unit price */
  unitPrice: number

  /** Currency */
  currency?: string

  /** Is active */
  isActive?: boolean

  /** Valid from date */
  validFrom?: Date

  /** Valid until date */
  validUntil?: Date

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PriceBookEntryInput = Input<PriceBookEntry>
export type PriceBookEntryOutput = Output<PriceBookEntry>

// =============================================================================
// Discount - Discount Rule
// =============================================================================

/**
 * Discount rule for pricing.
 *
 * @example
 * ```ts
 * const discount: Discount = {
 *   id: 'disc_123',
 *   name: 'Q1 Promotion',
 *   type: 'percentage',
 *   value: 15,
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Discount {
  /** Unique identifier */
  id: string

  /** Discount name */
  name: string

  /** Description */
  description?: string

  /** Discount type */
  type: 'percentage' | 'fixed_amount'

  /** Discount value */
  value: number

  /** Currency (for fixed_amount) */
  currency?: string

  /** Is active */
  isActive?: boolean

  /** Valid from date */
  validFrom?: Date

  /** Valid until date */
  validUntil?: Date

  /** Minimum order value */
  minOrderValue?: number

  /** Maximum discount amount */
  maxDiscountAmount?: number

  /** Applicable product IDs */
  productIds?: string[]

  /** Applicable customer segments */
  customerSegments?: string[]

  /** Promo code */
  promoCode?: string

  /** Usage limit */
  usageLimit?: number

  /** Times used */
  timesUsed?: number

  /** Stackable with other discounts */
  stackable?: boolean

  /** Auto-apply */
  autoApply?: boolean

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DiscountInput = Input<Discount>
export type DiscountOutput = Output<Discount>

// =============================================================================
// Competitor - Competitive Intelligence
// =============================================================================

/**
 * Competitor information for competitive intelligence.
 *
 * @example
 * ```ts
 * const competitor: Competitor = {
 *   id: 'comp_123',
 *   name: 'Competitor Inc',
 *   website: 'https://competitor.example.com',
 *   strengths: ['Market leader', 'Strong brand'],
 *   weaknesses: ['High pricing', 'Poor support'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Competitor {
  /** Unique identifier */
  id: string

  /** Competitor name */
  name: string

  /** Description */
  description?: string

  /** Website */
  website?: string

  /** Headquarters location */
  headquarters?: string

  /** Company size */
  companySize?: string

  /** Revenue estimate */
  revenue?: string

  /** Funding */
  funding?: string

  /** Market position */
  marketPosition?: 'leader' | 'challenger' | 'follower' | 'niche'

  /** Strengths */
  strengths?: string[]

  /** Weaknesses */
  weaknesses?: string[]

  /** Key products */
  products?: string[]

  /** Pricing model */
  pricingModel?: string

  /** Target market */
  targetMarket?: string[]

  /** Win rate against (%) */
  winRate?: number

  /** Battle cards URL */
  battleCardUrl?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    salesforce?: string
    hubspot?: string
    pipedrive?: string
    zoho?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CompetitorInput = Input<Competitor>
export type CompetitorOutput = Output<Competitor>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface LeadActions extends CRUDResource<Lead, LeadInput> {
  /** Search leads */
  search: Action<{ query: string } & ListParams, PaginatedResult<Lead>>

  /** Convert lead to opportunity */
  convert: Action<{ id: string; opportunityName?: string }, { opportunity: Opportunity; contact?: unknown }>

  /** Qualify lead */
  qualify: Action<{ id: string }, Lead>

  /** Disqualify lead */
  disqualify: Action<{ id: string; reason?: string }, Lead>

  /** Assign to sales rep */
  assign: Action<{ id: string; ownerId: string }, Lead>

  /** Update score */
  updateScore: Action<{ id: string; score: number }, Lead>

  /** Merge leads */
  merge: Action<{ sourceId: string; targetId: string }, Lead>

  /** Import leads */
  import: Action<{ leads: LeadInput[] }, { imported: number; failed: number }>
}

export interface OpportunityActions extends CRUDResource<Opportunity, OpportunityInput> {
  /** Search opportunities */
  search: Action<{ query: string } & ListParams, PaginatedResult<Opportunity>>

  /** Move to stage */
  moveToStage: Action<{ id: string; stageId: string }, Opportunity>

  /** Mark as won */
  win: Action<{ id: string; closeDate?: Date; winReason?: string }, Opportunity>

  /** Mark as lost */
  lose: Action<{ id: string; closeDate?: Date; lossReason: string; competitorId?: string }, Opportunity>

  /** Reopen opportunity */
  reopen: Action<{ id: string }, Opportunity>

  /** Clone opportunity */
  clone: Action<{ id: string; name: string }, Opportunity>

  /** Assign to sales rep */
  assign: Action<{ id: string; ownerId: string }, Opportunity>

  /** Get activities */
  getActivities: Action<{ id: string } & ListParams, PaginatedResult<Activity>>

  /** Get quotes */
  getQuotes: Action<{ id: string } & ListParams, PaginatedResult<Quote>>
}

export interface PipelineActions extends CRUDResource<Pipeline, PipelineInput> {
  /** Get stages */
  getStages: Action<{ id: string }, Stage[]>

  /** Add stage */
  addStage: Action<{ id: string; stage: StageInput }, Stage>

  /** Reorder stages */
  reorderStages: Action<{ id: string; stageIds: string[] }, Pipeline>

  /** Set as default */
  setDefault: Action<{ id: string }, Pipeline>

  /** Activate */
  activate: Action<{ id: string }, Pipeline>

  /** Deactivate */
  deactivate: Action<{ id: string }, Pipeline>
}

export interface StageActions extends CRUDResource<Stage, StageInput> {
  /** Get opportunities in stage */
  getOpportunities: Action<{ id: string } & ListParams, PaginatedResult<Opportunity>>

  /** Activate */
  activate: Action<{ id: string }, Stage>

  /** Deactivate */
  deactivate: Action<{ id: string }, Stage>
}

export interface QuoteActions extends CRUDResource<Quote, QuoteInput> {
  /** Search quotes */
  search: Action<{ query: string } & ListParams, PaginatedResult<Quote>>

  /** Send quote */
  send: Action<{ id: string; to: string; message?: string }, Quote>

  /** Accept quote */
  accept: Action<{ id: string }, Quote>

  /** Reject quote */
  reject: Action<{ id: string; reason?: string }, Quote>

  /** Generate PDF */
  generatePdf: Action<{ id: string }, { pdfUrl: string }>

  /** Clone quote */
  clone: Action<{ id: string }, Quote>

  /** Get line items */
  getLineItems: Action<{ id: string }, QuoteLineItem[]>

  /** Add line item */
  addLineItem: Action<{ id: string; lineItem: QuoteLineItemInput }, QuoteLineItem>

  /** Update line item */
  updateLineItem: Action<{ id: string; lineItemId: string; updates: Partial<QuoteLineItemInput> }, QuoteLineItem>

  /** Remove line item */
  removeLineItem: Action<{ id: string; lineItemId: string }, void>

  /** Convert to order */
  convertToOrder: Action<{ id: string }, Order>
}

export interface QuoteLineItemActions extends CRUDResource<QuoteLineItem, QuoteLineItemInput> {
  /** Apply discount */
  applyDiscount: Action<{ id: string; discountPercent?: number; discountAmount?: number }, QuoteLineItem>
}

export interface OrderActions extends CRUDResource<Order, OrderInput> {
  /** Search orders */
  search: Action<{ query: string } & ListParams, PaginatedResult<Order>>

  /** Confirm order */
  confirm: Action<{ id: string }, Order>

  /** Ship order */
  ship: Action<{ id: string; trackingNumber?: string; carrier?: string }, Order>

  /** Deliver order */
  deliver: Action<{ id: string; deliveryDate?: Date }, Order>

  /** Cancel order */
  cancel: Action<{ id: string; reason?: string }, Order>

  /** Refund order */
  refund: Action<{ id: string; amount?: number }, Order>

  /** Get line items */
  getLineItems: Action<{ id: string }, OrderLineItem[]>
}

export interface OrderLineItemActions extends CRUDResource<OrderLineItem, OrderLineItemInput> {
  /** Update fulfillment status */
  updateFulfillmentStatus: Action<{ id: string; status: OrderLineItem['fulfillmentStatus'] }, OrderLineItem>
}

export interface ContractActions extends CRUDResource<Contract, ContractInput> {
  /** Search contracts */
  search: Action<{ query: string } & ListParams, PaginatedResult<Contract>>

  /** Sign contract */
  sign: Action<{ id: string; signedDocumentUrl?: string }, Contract>

  /** Activate contract */
  activate: Action<{ id: string }, Contract>

  /** Cancel contract */
  cancel: Action<{ id: string; reason?: string }, Contract>

  /** Renew contract */
  renew: Action<{ id: string; renewalTerm?: number }, Contract>

  /** Get expiring contracts */
  getExpiring: Action<{ daysUntilExpiry: number } & ListParams, PaginatedResult<Contract>>
}

export interface TerritoryActions extends CRUDResource<Territory, TerritoryInput> {
  /** Assign sales rep */
  assignSalesRep: Action<{ id: string; salesRepId: string }, Territory>

  /** Remove sales rep */
  removeSalesRep: Action<{ id: string; salesRepId: string }, Territory>

  /** Get leads */
  getLeads: Action<{ id: string } & ListParams, PaginatedResult<Lead>>

  /** Get opportunities */
  getOpportunities: Action<{ id: string } & ListParams, PaginatedResult<Opportunity>>

  /** Get sales reps */
  getSalesReps: Action<{ id: string }, SalesRep[]>
}

export interface SalesRepActions extends CRUDResource<SalesRep, SalesRepInput> {
  /** Search sales reps */
  search: Action<{ query: string } & ListParams, PaginatedResult<SalesRep>>

  /** Activate */
  activate: Action<{ id: string }, SalesRep>

  /** Deactivate */
  deactivate: Action<{ id: string }, SalesRep>

  /** Assign territory */
  assignTerritory: Action<{ id: string; territoryId: string }, SalesRep>

  /** Remove territory */
  removeTerritory: Action<{ id: string; territoryId: string }, SalesRep>

  /** Get leads */
  getLeads: Action<{ id: string } & ListParams, PaginatedResult<Lead>>

  /** Get opportunities */
  getOpportunities: Action<{ id: string } & ListParams, PaginatedResult<Opportunity>>

  /** Get performance */
  getPerformance: Action<{ id: string; periodStart?: Date; periodEnd?: Date }, SalesRepPerformance>
}

export interface CommissionActions extends CRUDResource<Commission, CommissionInput> {
  /** Approve commission */
  approve: Action<{ id: string }, Commission>

  /** Pay commission */
  pay: Action<{ id: string; paymentDate?: Date; paymentMethod?: string; paymentReference?: string }, Commission>

  /** Cancel commission */
  cancel: Action<{ id: string; reason?: string }, Commission>

  /** Get commissions by sales rep */
  getBySalesRep: Action<{ salesRepId: string } & ListParams, PaginatedResult<Commission>>

  /** Calculate commission */
  calculate: Action<{ salesRepId: string; opportunityId: string }, { amount: number; rate: number }>
}

export interface CommissionPlanActions extends CRUDResource<CommissionPlan, CommissionPlanInput> {
  /** Activate plan */
  activate: Action<{ id: string }, CommissionPlan>

  /** Deactivate plan */
  deactivate: Action<{ id: string }, CommissionPlan>

  /** Calculate for deal */
  calculateForDeal: Action<{ id: string; dealAmount: number; dealType?: string }, { commission: number }>
}

export interface ForecastActions extends CRUDResource<Forecast, ForecastInput> {
  /** Submit forecast */
  submit: Action<{ id: string }, Forecast>

  /** Approve forecast */
  approve: Action<{ id: string }, Forecast>

  /** Get by sales rep */
  getBySalesRep: Action<{ salesRepId: string } & ListParams, PaginatedResult<Forecast>>

  /** Get by territory */
  getByTerritory: Action<{ territoryId: string } & ListParams, PaginatedResult<Forecast>>

  /** Get rollup */
  getRollup: Action<{ periodStart: Date; periodEnd: Date; groupBy?: 'salesRep' | 'territory' | 'team' }, ForecastRollup[]>
}

export interface TargetActions extends CRUDResource<Target, TargetInput> {
  /** Get by sales rep */
  getBySalesRep: Action<{ salesRepId: string } & ListParams, PaginatedResult<Target>>

  /** Get by territory */
  getByTerritory: Action<{ territoryId: string } & ListParams, PaginatedResult<Target>>

  /** Update achievement */
  updateAchievement: Action<{ id: string }, Target>
}

export interface ActivityActions extends CRUDResource<Activity, ActivityInput> {
  /** Search activities */
  search: Action<{ query: string } & ListParams, PaginatedResult<Activity>>

  /** Complete activity */
  complete: Action<{ id: string; outcome?: string }, Activity>

  /** Cancel activity */
  cancel: Action<{ id: string }, Activity>

  /** Reschedule activity */
  reschedule: Action<{ id: string; scheduledAt: Date }, Activity>

  /** Log call */
  logCall: Action<{ leadId?: string; opportunityId?: string; duration: number; outcome?: string; notes?: string }, Activity>

  /** Log email */
  logEmail: Action<{ leadId?: string; opportunityId?: string; subject: string; body?: string }, Activity>

  /** Log meeting */
  logMeeting: Action<{ leadId?: string; opportunityId?: string; subject: string; duration: number; attendees?: string[] }, Activity>
}

export interface CadenceActions extends CRUDResource<Cadence, CadenceInput> {
  /** Activate cadence */
  activate: Action<{ id: string }, Cadence>

  /** Deactivate cadence */
  deactivate: Action<{ id: string }, Cadence>

  /** Get steps */
  getSteps: Action<{ id: string }, CadenceStep[]>

  /** Add step */
  addStep: Action<{ id: string; step: CadenceStepInput }, CadenceStep>

  /** Enroll lead */
  enrollLead: Action<{ id: string; leadId: string; startDate?: Date }, { enrollmentId: string }>

  /** Enroll opportunity */
  enrollOpportunity: Action<{ id: string; opportunityId: string; startDate?: Date }, { enrollmentId: string }>

  /** Get enrollments */
  getEnrollments: Action<{ id: string } & ListParams, PaginatedResult<CadenceEnrollment>>
}

export interface CadenceStepActions extends CRUDResource<CadenceStep, CadenceStepInput> {
  /** Reorder steps */
  reorder: Action<{ cadenceId: string; stepIds: string[] }, CadenceStep[]>
}

export interface PriceBookActions extends CRUDResource<PriceBook, PriceBookInput> {
  /** Activate price book */
  activate: Action<{ id: string }, PriceBook>

  /** Deactivate price book */
  deactivate: Action<{ id: string }, PriceBook>

  /** Set as standard */
  setStandard: Action<{ id: string }, PriceBook>

  /** Get entries */
  getEntries: Action<{ id: string } & ListParams, PaginatedResult<PriceBookEntry>>

  /** Add entry */
  addEntry: Action<{ id: string; entry: PriceBookEntryInput }, PriceBookEntry>
}

export interface PriceBookEntryActions extends CRUDResource<PriceBookEntry, PriceBookEntryInput> {
  /** Activate entry */
  activate: Action<{ id: string }, PriceBookEntry>

  /** Deactivate entry */
  deactivate: Action<{ id: string }, PriceBookEntry>

  /** Update price */
  updatePrice: Action<{ id: string; unitPrice: number }, PriceBookEntry>
}

export interface DiscountActions extends CRUDResource<Discount, DiscountInput> {
  /** Activate discount */
  activate: Action<{ id: string }, Discount>

  /** Deactivate discount */
  deactivate: Action<{ id: string }, Discount>

  /** Apply to quote */
  applyToQuote: Action<{ id: string; quoteId: string }, Quote>

  /** Validate promo code */
  validatePromoCode: Action<{ promoCode: string; orderValue?: number }, { valid: boolean; discount?: Discount }>
}

export interface CompetitorActions extends CRUDResource<Competitor, CompetitorInput> {
  /** Search competitors */
  search: Action<{ query: string } & ListParams, PaginatedResult<Competitor>>

  /** Get win/loss record */
  getWinLossRecord: Action<{ id: string; from?: Date; to?: Date }, { wins: number; losses: number; winRate: number }>

  /** Get lost deals */
  getLostDeals: Action<{ id: string } & ListParams, PaginatedResult<Opportunity>>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface SalesRepPerformance {
  salesRepId: string
  period: { from: Date; to: Date }
  quota?: number
  quotaAttainment?: number
  revenue: {
    total: number
    won: number
    pipeline: number
  }
  deals: {
    total: number
    won: number
    lost: number
    winRate: number
  }
  activities: {
    total: number
    calls: number
    emails: number
    meetings: number
  }
  avgDealSize?: number
  avgSalesCycle?: number
  commissionEarned?: number
}

export interface ForecastRollup {
  id: string
  name: string
  period: { from: Date; to: Date }
  forecasts: {
    pipeline: number
    bestCase: number
    commit: number
    closed: number
  }
  quota?: number
  quotaAttainment?: number
}

export interface CadenceEnrollment {
  id: string
  cadenceId: string
  leadId?: string
  opportunityId?: string
  contactId?: string
  salesRepId?: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  currentStepId?: string
  startDate: Date
  endDate?: Date
  completedSteps: number
  totalSteps: number
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// Events
// =============================================================================

export interface LeadEvents {
  created: BaseEvent<'lead.created', Lead>
  updated: BaseEvent<'lead.updated', Lead>
  deleted: BaseEvent<'lead.deleted', { id: string }>
  converted: BaseEvent<'lead.converted', { leadId: string; opportunityId: string }>
  qualified: BaseEvent<'lead.qualified', Lead>
  disqualified: BaseEvent<'lead.disqualified', { leadId: string; reason?: string }>
  assigned: BaseEvent<'lead.assigned', { leadId: string; ownerId: string }>
  score_updated: BaseEvent<'lead.score_updated', { leadId: string; oldScore?: number; newScore: number }>
  merged: BaseEvent<'lead.merged', { sourceId: string; targetId: string }>
}

export interface OpportunityEvents {
  created: BaseEvent<'opportunity.created', Opportunity>
  updated: BaseEvent<'opportunity.updated', Opportunity>
  deleted: BaseEvent<'opportunity.deleted', { id: string }>
  stage_changed: BaseEvent<'opportunity.stage_changed', { opportunityId: string; oldStageId?: string; newStageId: string }>
  won: BaseEvent<'opportunity.won', Opportunity>
  lost: BaseEvent<'opportunity.lost', { opportunityId: string; lossReason: string; competitorId?: string }>
  reopened: BaseEvent<'opportunity.reopened', Opportunity>
  assigned: BaseEvent<'opportunity.assigned', { opportunityId: string; ownerId: string }>
  amount_changed: BaseEvent<'opportunity.amount_changed', { opportunityId: string; oldAmount?: number; newAmount?: number }>
}

export interface PipelineEvents {
  created: BaseEvent<'pipeline.created', Pipeline>
  updated: BaseEvent<'pipeline.updated', Pipeline>
  deleted: BaseEvent<'pipeline.deleted', { id: string }>
  activated: BaseEvent<'pipeline.activated', Pipeline>
  deactivated: BaseEvent<'pipeline.deactivated', { id: string }>
  set_default: BaseEvent<'pipeline.set_default', Pipeline>
  stage_added: BaseEvent<'pipeline.stage_added', { pipelineId: string; stage: Stage }>
  stages_reordered: BaseEvent<'pipeline.stages_reordered', { pipelineId: string; stageIds: string[] }>
}

export interface StageEvents {
  created: BaseEvent<'stage.created', Stage>
  updated: BaseEvent<'stage.updated', Stage>
  deleted: BaseEvent<'stage.deleted', { id: string }>
  activated: BaseEvent<'stage.activated', Stage>
  deactivated: BaseEvent<'stage.deactivated', { id: string }>
}

export interface QuoteEvents {
  created: BaseEvent<'quote.created', Quote>
  updated: BaseEvent<'quote.updated', Quote>
  deleted: BaseEvent<'quote.deleted', { id: string }>
  sent: BaseEvent<'quote.sent', Quote>
  viewed: BaseEvent<'quote.viewed', { quoteId: string; viewedAt: Date }>
  accepted: BaseEvent<'quote.accepted', Quote>
  rejected: BaseEvent<'quote.rejected', { quoteId: string; reason?: string }>
  expired: BaseEvent<'quote.expired', { quoteId: string }>
  line_item_added: BaseEvent<'quote.line_item_added', { quoteId: string; lineItem: QuoteLineItem }>
  line_item_updated: BaseEvent<'quote.line_item_updated', { quoteId: string; lineItem: QuoteLineItem }>
  line_item_removed: BaseEvent<'quote.line_item_removed', { quoteId: string; lineItemId: string }>
  converted_to_order: BaseEvent<'quote.converted_to_order', { quoteId: string; orderId: string }>
}

export interface QuoteLineItemEvents {
  created: BaseEvent<'quote_line_item.created', QuoteLineItem>
  updated: BaseEvent<'quote_line_item.updated', QuoteLineItem>
  deleted: BaseEvent<'quote_line_item.deleted', { id: string }>
  discount_applied: BaseEvent<'quote_line_item.discount_applied', QuoteLineItem>
}

export interface OrderEvents {
  created: BaseEvent<'order.created', Order>
  updated: BaseEvent<'order.updated', Order>
  deleted: BaseEvent<'order.deleted', { id: string }>
  confirmed: BaseEvent<'order.confirmed', Order>
  shipped: BaseEvent<'order.shipped', { orderId: string; trackingNumber?: string }>
  delivered: BaseEvent<'order.delivered', Order>
  cancelled: BaseEvent<'order.cancelled', { orderId: string; reason?: string }>
  refunded: BaseEvent<'order.refunded', { orderId: string; amount?: number }>
}

export interface OrderLineItemEvents {
  created: BaseEvent<'order_line_item.created', OrderLineItem>
  updated: BaseEvent<'order_line_item.updated', OrderLineItem>
  deleted: BaseEvent<'order_line_item.deleted', { id: string }>
  fulfillment_updated: BaseEvent<'order_line_item.fulfillment_updated', OrderLineItem>
}

export interface ContractEvents {
  created: BaseEvent<'contract.created', Contract>
  updated: BaseEvent<'contract.updated', Contract>
  deleted: BaseEvent<'contract.deleted', { id: string }>
  signed: BaseEvent<'contract.signed', Contract>
  activated: BaseEvent<'contract.activated', Contract>
  expired: BaseEvent<'contract.expired', { contractId: string }>
  cancelled: BaseEvent<'contract.cancelled', { contractId: string; reason?: string }>
  renewed: BaseEvent<'contract.renewed', { contractId: string; newContractId: string }>
}

export interface TerritoryEvents {
  created: BaseEvent<'territory.created', Territory>
  updated: BaseEvent<'territory.updated', Territory>
  deleted: BaseEvent<'territory.deleted', { id: string }>
  sales_rep_assigned: BaseEvent<'territory.sales_rep_assigned', { territoryId: string; salesRepId: string }>
  sales_rep_removed: BaseEvent<'territory.sales_rep_removed', { territoryId: string; salesRepId: string }>
}

export interface SalesRepEvents {
  created: BaseEvent<'sales_rep.created', SalesRep>
  updated: BaseEvent<'sales_rep.updated', SalesRep>
  deleted: BaseEvent<'sales_rep.deleted', { id: string }>
  activated: BaseEvent<'sales_rep.activated', SalesRep>
  deactivated: BaseEvent<'sales_rep.deactivated', { id: string }>
  territory_assigned: BaseEvent<'sales_rep.territory_assigned', { salesRepId: string; territoryId: string }>
  territory_removed: BaseEvent<'sales_rep.territory_removed', { salesRepId: string; territoryId: string }>
}

export interface CommissionEvents {
  created: BaseEvent<'commission.created', Commission>
  updated: BaseEvent<'commission.updated', Commission>
  deleted: BaseEvent<'commission.deleted', { id: string }>
  approved: BaseEvent<'commission.approved', Commission>
  paid: BaseEvent<'commission.paid', Commission>
  cancelled: BaseEvent<'commission.cancelled', { commissionId: string; reason?: string }>
}

export interface CommissionPlanEvents {
  created: BaseEvent<'commission_plan.created', CommissionPlan>
  updated: BaseEvent<'commission_plan.updated', CommissionPlan>
  deleted: BaseEvent<'commission_plan.deleted', { id: string }>
  activated: BaseEvent<'commission_plan.activated', CommissionPlan>
  deactivated: BaseEvent<'commission_plan.deactivated', { id: string }>
}

export interface ForecastEvents {
  created: BaseEvent<'forecast.created', Forecast>
  updated: BaseEvent<'forecast.updated', Forecast>
  deleted: BaseEvent<'forecast.deleted', { id: string }>
  submitted: BaseEvent<'forecast.submitted', Forecast>
  approved: BaseEvent<'forecast.approved', Forecast>
}

export interface TargetEvents {
  created: BaseEvent<'target.created', Target>
  updated: BaseEvent<'target.updated', Target>
  deleted: BaseEvent<'target.deleted', { id: string }>
  achievement_updated: BaseEvent<'target.achievement_updated', Target>
}

export interface ActivityEvents {
  created: BaseEvent<'activity.created', Activity>
  updated: BaseEvent<'activity.updated', Activity>
  deleted: BaseEvent<'activity.deleted', { id: string }>
  completed: BaseEvent<'activity.completed', Activity>
  cancelled: BaseEvent<'activity.cancelled', { id: string }>
  rescheduled: BaseEvent<'activity.rescheduled', { activityId: string; oldDate?: Date; newDate: Date }>
}

export interface CadenceEvents {
  created: BaseEvent<'cadence.created', Cadence>
  updated: BaseEvent<'cadence.updated', Cadence>
  deleted: BaseEvent<'cadence.deleted', { id: string }>
  activated: BaseEvent<'cadence.activated', Cadence>
  deactivated: BaseEvent<'cadence.deactivated', { id: string }>
  step_added: BaseEvent<'cadence.step_added', { cadenceId: string; step: CadenceStep }>
  lead_enrolled: BaseEvent<'cadence.lead_enrolled', { cadenceId: string; leadId: string; enrollmentId: string }>
  opportunity_enrolled: BaseEvent<'cadence.opportunity_enrolled', { cadenceId: string; opportunityId: string; enrollmentId: string }>
}

export interface CadenceStepEvents {
  created: BaseEvent<'cadence_step.created', CadenceStep>
  updated: BaseEvent<'cadence_step.updated', CadenceStep>
  deleted: BaseEvent<'cadence_step.deleted', { id: string }>
  reordered: BaseEvent<'cadence_step.reordered', { cadenceId: string; stepIds: string[] }>
}

export interface PriceBookEvents {
  created: BaseEvent<'price_book.created', PriceBook>
  updated: BaseEvent<'price_book.updated', PriceBook>
  deleted: BaseEvent<'price_book.deleted', { id: string }>
  activated: BaseEvent<'price_book.activated', PriceBook>
  deactivated: BaseEvent<'price_book.deactivated', { id: string }>
  set_standard: BaseEvent<'price_book.set_standard', PriceBook>
  entry_added: BaseEvent<'price_book.entry_added', { priceBookId: string; entry: PriceBookEntry }>
}

export interface PriceBookEntryEvents {
  created: BaseEvent<'price_book_entry.created', PriceBookEntry>
  updated: BaseEvent<'price_book_entry.updated', PriceBookEntry>
  deleted: BaseEvent<'price_book_entry.deleted', { id: string }>
  activated: BaseEvent<'price_book_entry.activated', PriceBookEntry>
  deactivated: BaseEvent<'price_book_entry.deactivated', { id: string }>
  price_updated: BaseEvent<'price_book_entry.price_updated', { entryId: string; oldPrice?: number; newPrice: number }>
}

export interface DiscountEvents {
  created: BaseEvent<'discount.created', Discount>
  updated: BaseEvent<'discount.updated', Discount>
  deleted: BaseEvent<'discount.deleted', { id: string }>
  activated: BaseEvent<'discount.activated', Discount>
  deactivated: BaseEvent<'discount.deactivated', { id: string }>
  applied: BaseEvent<'discount.applied', { discountId: string; quoteId: string }>
}

export interface CompetitorEvents {
  created: BaseEvent<'competitor.created', Competitor>
  updated: BaseEvent<'competitor.updated', Competitor>
  deleted: BaseEvent<'competitor.deleted', { id: string }>
  deal_lost_to: BaseEvent<'competitor.deal_lost_to', { competitorId: string; opportunityId: string }>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface LeadResource extends LeadActions {
  on: <K extends keyof LeadEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LeadEvents[K], TProxy>
  ) => () => void
}

export interface OpportunityResource extends OpportunityActions {
  on: <K extends keyof OpportunityEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OpportunityEvents[K], TProxy>
  ) => () => void
}

export interface PipelineResource extends PipelineActions {
  on: <K extends keyof PipelineEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PipelineEvents[K], TProxy>
  ) => () => void
}

export interface StageResource extends StageActions {
  on: <K extends keyof StageEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<StageEvents[K], TProxy>
  ) => () => void
}

export interface QuoteResource extends QuoteActions {
  on: <K extends keyof QuoteEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<QuoteEvents[K], TProxy>
  ) => () => void
}

export interface QuoteLineItemResource extends QuoteLineItemActions {
  on: <K extends keyof QuoteLineItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<QuoteLineItemEvents[K], TProxy>
  ) => () => void
}

export interface OrderResource extends OrderActions {
  on: <K extends keyof OrderEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OrderEvents[K], TProxy>
  ) => () => void
}

export interface OrderLineItemResource extends OrderLineItemActions {
  on: <K extends keyof OrderLineItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OrderLineItemEvents[K], TProxy>
  ) => () => void
}

export interface ContractResource extends ContractActions {
  on: <K extends keyof ContractEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContractEvents[K], TProxy>
  ) => () => void
}

export interface TerritoryResource extends TerritoryActions {
  on: <K extends keyof TerritoryEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TerritoryEvents[K], TProxy>
  ) => () => void
}

export interface SalesRepResource extends SalesRepActions {
  on: <K extends keyof SalesRepEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SalesRepEvents[K], TProxy>
  ) => () => void
}

export interface CommissionResource extends CommissionActions {
  on: <K extends keyof CommissionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CommissionEvents[K], TProxy>
  ) => () => void
}

export interface CommissionPlanResource extends CommissionPlanActions {
  on: <K extends keyof CommissionPlanEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CommissionPlanEvents[K], TProxy>
  ) => () => void
}

export interface ForecastResource extends ForecastActions {
  on: <K extends keyof ForecastEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ForecastEvents[K], TProxy>
  ) => () => void
}

export interface TargetResource extends TargetActions {
  on: <K extends keyof TargetEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TargetEvents[K], TProxy>
  ) => () => void
}

export interface ActivityResource extends ActivityActions {
  on: <K extends keyof ActivityEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ActivityEvents[K], TProxy>
  ) => () => void
}

export interface CadenceResource extends CadenceActions {
  on: <K extends keyof CadenceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CadenceEvents[K], TProxy>
  ) => () => void
}

export interface CadenceStepResource extends CadenceStepActions {
  on: <K extends keyof CadenceStepEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CadenceStepEvents[K], TProxy>
  ) => () => void
}

export interface PriceBookResource extends PriceBookActions {
  on: <K extends keyof PriceBookEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PriceBookEvents[K], TProxy>
  ) => () => void
}

export interface PriceBookEntryResource extends PriceBookEntryActions {
  on: <K extends keyof PriceBookEntryEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PriceBookEntryEvents[K], TProxy>
  ) => () => void
}

export interface DiscountResource extends DiscountActions {
  on: <K extends keyof DiscountEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DiscountEvents[K], TProxy>
  ) => () => void
}

export interface CompetitorResource extends CompetitorActions {
  on: <K extends keyof CompetitorEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CompetitorEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Sales Proxy (unified interface)
// =============================================================================

/**
 * Complete Sales & Revenue interface combining all resources.
 *
 * @example
 * ```ts
 * const sales: SalesProxy = getSalesProxy()
 *
 * // Create a lead
 * const lead = await sales.leads.create({
 *   email: 'prospect@example.com',
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   company: 'Acme Corp',
 *   status: 'new',
 *   source: 'website'
 * })
 *
 * // Subscribe to events
 * sales.leads.on('converted', (event, ctx) => {
 *   console.log('Lead converted:', event.data.opportunityId)
 * })
 *
 * // Convert lead to opportunity
 * const { opportunity } = await sales.leads.convert({
 *   id: lead.id,
 *   opportunityName: 'Acme Enterprise Deal'
 * })
 *
 * // Create a quote
 * const quote = await sales.quotes.create({
 *   name: 'Q1 2025 Proposal',
 *   status: 'draft',
 *   opportunityId: opportunity.id,
 *   currency: 'USD'
 * })
 * ```
 */
export interface SalesProxy {
  leads: LeadResource
  opportunities: OpportunityResource
  pipelines: PipelineResource
  stages: StageResource
  quotes: QuoteResource
  quoteLineItems: QuoteLineItemResource
  orders: OrderResource
  orderLineItems: OrderLineItemResource
  contracts: ContractResource
  territories: TerritoryResource
  salesReps: SalesRepResource
  commissions: CommissionResource
  commissionPlans: CommissionPlanResource
  forecasts: ForecastResource
  targets: TargetResource
  activities: ActivityResource
  cadences: CadenceResource
  cadenceSteps: CadenceStepResource
  priceBooks: PriceBookResource
  priceBookEntries: PriceBookEntryResource
  discounts: DiscountResource
  competitors: CompetitorResource
}
