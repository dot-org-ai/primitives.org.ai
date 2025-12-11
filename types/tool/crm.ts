/**
 * CRM Tool Types
 *
 * Types for CRM integrations:
 * Contact, Company, Deal.
 *
 * @module tool/crm
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
// Contact
// =============================================================================

/**
 * Contact status in CRM.
 */
export type ContactStatus = 'lead' | 'prospect' | 'customer' | 'churned' | 'inactive'

/**
 * Contact lifecycle stage.
 */
export type ContactLifecycleStage =
  | 'subscriber'
  | 'lead'
  | 'marketing_qualified_lead'
  | 'sales_qualified_lead'
  | 'opportunity'
  | 'customer'
  | 'evangelist'
  | 'other'

/**
 * Individual person in the CRM system.
 *
 * @example
 * ```ts
 * const contact: Contact = {
 *   id: 'cntct_123',
 *   email: 'john.doe@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   status: 'lead',
 *   lifecycleStage: 'marketing_qualified_lead',
 *   company: 'Acme Corp',
 *   jobTitle: 'VP of Engineering',
 *   source: 'website',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Contact {
  /** Unique identifier */
  id: string

  /** Primary email address */
  email: string

  /** First name */
  firstName?: string

  /** Last name */
  lastName?: string

  /** Phone number */
  phone?: string

  /** Mobile phone */
  mobilePhone?: string

  /** Contact status */
  status: ContactStatus

  /** Lifecycle stage */
  lifecycleStage?: ContactLifecycleStage

  /** Company name */
  company?: string

  /** Company ID (linked) */
  companyId?: string

  /** Job title */
  jobTitle?: string

  /** Department */
  department?: string

  /** Personal website */
  website?: string

  /** Mailing address */
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Lead source */
  source?: string

  /** Owner ID */
  ownerId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Social profiles */
  social?: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }

  /** Last contacted timestamp */
  lastContactedAt?: Date

  /** Last activity timestamp */
  lastActivityAt?: Date

  /** Lead score */
  leadScore?: number

  /** Marketing consent */
  marketingConsent?: boolean

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContactInput = Input<Contact>
export type ContactOutput = Output<Contact>

// =============================================================================
// Company
// =============================================================================

/**
 * Company size range.
 */
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5000+'

/**
 * Company revenue range.
 */
export type CompanyRevenue = '<1M' | '1-10M' | '10-50M' | '50-100M' | '100-500M' | '500M-1B' | '1B+'

/**
 * Business organization in the CRM system.
 *
 * @example
 * ```ts
 * const company: Company = {
 *   id: 'comp_123',
 *   name: 'Acme Corporation',
 *   domain: 'acme.example.com',
 *   industry: 'Technology',
 *   size: '51-200',
 *   annualRevenue: '10-50M',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Company {
  /** Unique identifier */
  id: string

  /** Company name */
  name: string

  /** Website domain */
  domain?: string

  /** Company description */
  description?: string

  /** Industry */
  industry?: string

  /** Company size */
  size?: CompanySize

  /** Annual revenue range */
  annualRevenue?: CompanyRevenue

  /** Specific revenue amount */
  revenue?: {
    amount: number
    currency: string
  }

  /** Employee count */
  employeeCount?: number

  /** Year founded */
  founded?: number

  /** Headquarters address */
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Phone number */
  phone?: string

  /** Website URL */
  website?: string

  /** LinkedIn URL */
  linkedin?: string

  /** Owner ID */
  ownerId?: string

  /** Parent company ID */
  parentCompanyId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Technology stack (if tracked) */
  technologies?: string[]

  /** Last activity timestamp */
  lastActivityAt?: Date

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CompanyInput = Input<Company>
export type CompanyOutput = Output<Company>

// =============================================================================
// Deal
// =============================================================================

/**
 * Deal line item.
 */
export interface DealLineItem {
  productId?: string
  name: string
  quantity: number
  price: number
  discount?: number
}

/**
 * Deal stage.
 */
export type DealStage =
  | 'new'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'
  | 'custom'

/**
 * Sales opportunity tracked through pipeline stages.
 *
 * @example
 * ```ts
 * const deal: Deal = {
 *   id: 'deal_123',
 *   name: 'Acme Enterprise Deal',
 *   stage: 'proposal',
 *   amount: 50000,
 *   currency: 'USD',
 *   probability: 0.6,
 *   expectedCloseDate: new Date('2024-03-31'),
 *   contactId: 'cntct_123',
 *   companyId: 'comp_123',
 *   ownerId: 'user_456',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Deal {
  /** Unique identifier */
  id: string

  /** Deal name */
  name: string

  /** Pipeline stage */
  stage: DealStage

  /** Custom stage name (if stage is 'custom') */
  customStage?: string

  /** Deal amount */
  amount?: number

  /** Currency */
  currency?: string

  /** Win probability (0-1) */
  probability?: number

  /** Expected close date */
  expectedCloseDate?: Date

  /** Actual close date */
  closeDate?: Date

  /** Pipeline ID */
  pipelineId?: string

  /** Primary contact ID */
  contactId?: string

  /** Company ID */
  companyId?: string

  /** Deal owner ID */
  ownerId?: string

  /** Deal source */
  source?: string

  /** Deal type */
  type?: string

  /** Loss reason (if closed_lost) */
  lossReason?: string

  /** Competitor (if lost to competitor) */
  competitor?: string

  /** Products/line items */
  lineItems?: DealLineItem[]

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Next step */
  nextStep?: string

  /** Last activity timestamp */
  lastActivityAt?: Date

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DealInput = Input<Deal>
export type DealOutput = Output<Deal>

// =============================================================================
// Activity
// =============================================================================

/**
 * Activity type.
 */
export type ActivityType = 'email' | 'call' | 'meeting' | 'task' | 'note' | 'linkedin' | 'custom'

/**
 * CRM activity record.
 */
export interface Activity {
  /** Unique identifier */
  id: string

  /** Activity type */
  type: ActivityType

  /** Subject/title */
  subject?: string

  /** Body/description */
  body?: string

  /** Related contact ID */
  contactId?: string

  /** Related company ID */
  companyId?: string

  /** Related deal ID */
  dealId?: string

  /** Owner ID */
  ownerId?: string

  /** Duration (minutes) */
  duration?: number

  /** Outcome */
  outcome?: string

  /** Activity timestamp */
  timestamp: Date

  /** Scheduled date (if future) */
  scheduledAt?: Date

  /** Completed date */
  completedAt?: Date

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ActivityInput = Input<Activity>
export type ActivityOutput = Output<Activity>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface ContactActions extends CRUDResource<Contact, ContactInput> {
  /** Search contacts */
  search: Action<{ query: string } & ListParams, PaginatedResult<Contact>>

  /** Merge contacts */
  merge: Action<{ sourceId: string; targetId: string }, Contact>

  /** Add tag */
  addTag: Action<{ id: string; tag: string }, Contact>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, Contact>

  /** Set owner */
  setOwner: Action<{ id: string; ownerId: string }, Contact>

  /** Update lifecycle stage */
  updateLifecycleStage: Action<{ id: string; stage: ContactLifecycleStage }, Contact>

  /** Get activities */
  getActivities: Action<{ id: string } & ListParams, PaginatedResult<Activity>>

  /** Add activity */
  addActivity: Action<{ contactId: string; activity: ActivityInput }, Activity>

  /** Get deals */
  getDeals: Action<{ id: string } & ListParams, PaginatedResult<Deal>>

  /** Subscribe to marketing */
  subscribe: Action<{ id: string }, Contact>

  /** Unsubscribe from marketing */
  unsubscribe: Action<{ id: string }, Contact>

  /** Enrich contact data */
  enrich: Action<{ id: string }, Contact>
}

export interface CompanyActions extends CRUDResource<Company, CompanyInput> {
  /** Search companies */
  search: Action<{ query: string } & ListParams, PaginatedResult<Company>>

  /** Merge companies */
  merge: Action<{ sourceId: string; targetId: string }, Company>

  /** Add tag */
  addTag: Action<{ id: string; tag: string }, Company>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, Company>

  /** Set owner */
  setOwner: Action<{ id: string; ownerId: string }, Company>

  /** Get contacts */
  getContacts: Action<{ id: string } & ListParams, PaginatedResult<Contact>>

  /** Get deals */
  getDeals: Action<{ id: string } & ListParams, PaginatedResult<Deal>>

  /** Get activities */
  getActivities: Action<{ id: string } & ListParams, PaginatedResult<Activity>>

  /** Enrich company data */
  enrich: Action<{ id: string }, Company>

  /** Get subsidiaries */
  getSubsidiaries: Action<{ id: string }, Company[]>
}

export interface DealActions extends CRUDResource<Deal, DealInput> {
  /** Search deals */
  search: Action<{ query: string } & ListParams, PaginatedResult<Deal>>

  /** Move to stage */
  moveToStage: Action<{ id: string; stage: DealStage }, Deal>

  /** Set owner */
  setOwner: Action<{ id: string; ownerId: string }, Deal>

  /** Add line item */
  addLineItem: Action<{ id: string; lineItem: DealLineItem }, Deal>

  /** Remove line item */
  removeLineItem: Action<{ id: string; lineItemIndex: number }, Deal>

  /** Win deal */
  win: Action<{ id: string; closeDate?: Date }, Deal>

  /** Lose deal */
  lose: Action<{ id: string; reason: string; competitor?: string }, Deal>

  /** Get activities */
  getActivities: Action<{ id: string } & ListParams, PaginatedResult<Activity>>

  /** Add activity */
  addActivity: Action<{ dealId: string; activity: ActivityInput }, Activity>

  /** Get contacts */
  getContacts: Action<{ id: string }, Contact[]>

  /** Associate contact */
  associateContact: Action<{ id: string; contactId: string }, Deal>

  /** Disassociate contact */
  disassociateContact: Action<{ id: string; contactId: string }, Deal>
}

export interface ActivityActions extends CRUDResource<Activity, ActivityInput> {
  /** Complete activity */
  complete: Action<{ id: string; outcome?: string }, Activity>

  /** Reschedule activity */
  reschedule: Action<{ id: string; scheduledAt: Date }, Activity>

  /** Log email */
  logEmail: Action<{ contactId: string; subject: string; body: string; direction: 'inbound' | 'outbound' }, Activity>

  /** Log call */
  logCall: Action<{ contactId: string; duration: number; outcome?: string; notes?: string }, Activity>

  /** Log meeting */
  logMeeting: Action<{ contactId: string; subject: string; duration: number; attendees?: string[]; notes?: string }, Activity>
}

// =============================================================================
// Events
// =============================================================================

export interface ContactEvents {
  created: BaseEvent<'contact.created', Contact>
  updated: BaseEvent<'contact.updated', Contact>
  deleted: BaseEvent<'contact.deleted', { id: string }>
  merged: BaseEvent<'contact.merged', { sourceId: string; targetId: string; result: Contact }>
  tagged: BaseEvent<'contact.tagged', { contactId: string; tag: string }>
  untagged: BaseEvent<'contact.untagged', { contactId: string; tag: string }>
  owner_changed: BaseEvent<'contact.owner_changed', { contactId: string; oldOwnerId?: string; newOwnerId: string }>
  lifecycle_changed: BaseEvent<'contact.lifecycle_changed', { contactId: string; oldStage?: string; newStage: string }>
  subscribed: BaseEvent<'contact.subscribed', { contactId: string }>
  unsubscribed: BaseEvent<'contact.unsubscribed', { contactId: string }>
  enriched: BaseEvent<'contact.enriched', Contact>
  activity_added: BaseEvent<'contact.activity_added', { contactId: string; activity: Activity }>
}

export interface CompanyEvents {
  created: BaseEvent<'company.created', Company>
  updated: BaseEvent<'company.updated', Company>
  deleted: BaseEvent<'company.deleted', { id: string }>
  merged: BaseEvent<'company.merged', { sourceId: string; targetId: string; result: Company }>
  tagged: BaseEvent<'company.tagged', { companyId: string; tag: string }>
  untagged: BaseEvent<'company.untagged', { companyId: string; tag: string }>
  owner_changed: BaseEvent<'company.owner_changed', { companyId: string; oldOwnerId?: string; newOwnerId: string }>
  enriched: BaseEvent<'company.enriched', Company>
  contact_associated: BaseEvent<'company.contact_associated', { companyId: string; contactId: string }>
  contact_disassociated: BaseEvent<'company.contact_disassociated', { companyId: string; contactId: string }>
}

export interface DealEvents {
  created: BaseEvent<'deal.created', Deal>
  updated: BaseEvent<'deal.updated', Deal>
  deleted: BaseEvent<'deal.deleted', { id: string }>
  stage_changed: BaseEvent<'deal.stage_changed', { dealId: string; oldStage: string; newStage: string }>
  owner_changed: BaseEvent<'deal.owner_changed', { dealId: string; oldOwnerId?: string; newOwnerId: string }>
  amount_changed: BaseEvent<'deal.amount_changed', { dealId: string; oldAmount?: number; newAmount: number }>
  won: BaseEvent<'deal.won', Deal>
  lost: BaseEvent<'deal.lost', { dealId: string; reason: string; competitor?: string }>
  line_item_added: BaseEvent<'deal.line_item_added', { dealId: string; lineItem: DealLineItem }>
  line_item_removed: BaseEvent<'deal.line_item_removed', { dealId: string; lineItemIndex: number }>
  contact_associated: BaseEvent<'deal.contact_associated', { dealId: string; contactId: string }>
  contact_disassociated: BaseEvent<'deal.contact_disassociated', { dealId: string; contactId: string }>
}

export interface ActivityEvents {
  created: BaseEvent<'activity.created', Activity>
  updated: BaseEvent<'activity.updated', Activity>
  deleted: BaseEvent<'activity.deleted', { id: string }>
  completed: BaseEvent<'activity.completed', Activity>
  rescheduled: BaseEvent<'activity.rescheduled', { activityId: string; oldDate: Date; newDate: Date }>
}

// =============================================================================
// Resources
// =============================================================================

export interface ContactResource extends ContactActions {
  on: <K extends keyof ContactEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContactEvents[K], TProxy>
  ) => () => void
}

export interface CompanyResource extends CompanyActions {
  on: <K extends keyof CompanyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CompanyEvents[K], TProxy>
  ) => () => void
}

export interface DealResource extends DealActions {
  on: <K extends keyof DealEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DealEvents[K], TProxy>
  ) => () => void
}

export interface ActivityResource extends ActivityActions {
  on: <K extends keyof ActivityEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ActivityEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// CRM Proxy (unified interface)
// =============================================================================

/**
 * Complete CRM interface combining all resources.
 *
 * @example
 * ```ts
 * const crm: CRMProxy = getCRMProxy()
 *
 * // Create a contact
 * const contact = await crm.contacts.create({
 *   email: 'john@example.com',
 *   firstName: 'John'
 * })
 *
 * // Subscribe to events
 * crm.contacts.on('created', (event, ctx) => {
 *   console.log('New contact:', event.data.email)
 * })
 *
 * // Create a deal
 * const deal = await crm.deals.create({
 *   name: 'New Opportunity',
 *   stage: 'new',
 *   contactId: contact.id
 * })
 * ```
 */
export interface CRMProxy {
  contacts: ContactResource
  companies: CompanyResource
  deals: DealResource
  activities: ActivityResource
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported CRM providers.
 */
export type CRMProvider = 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho' | 'close' | 'freshsales'

/**
 * Provider configuration.
 */
export interface CRMProviderConfig {
  provider: CRMProvider
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  instanceUrl?: string
  apiVersion?: string
}
