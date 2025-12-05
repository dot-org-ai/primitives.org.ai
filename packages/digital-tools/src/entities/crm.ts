/**
 * CRM/Sales Entity Types (Nouns)
 *
 * Semantic type definitions for Customer Relationship Management and Sales tools.
 * Each entity defines properties, relationships, actions (Verbs), and events that
 * can be used by both remote human workers AND AI agents.
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Lead Management
// =============================================================================

/**
 * Lead entity
 *
 * Represents a potential customer/sales opportunity that has not yet been qualified
 */
export const Lead: Noun = {
  singular: 'lead',
  plural: 'leads',
  description: 'A potential customer or sales opportunity',

  properties: {
    // Identity
    firstName: {
      type: 'string',
      description: 'Lead first name',
    },
    lastName: {
      type: 'string',
      description: 'Lead last name',
    },
    fullName: {
      type: 'string',
      optional: true,
      description: 'Full name (computed or provided)',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },

    // Contact Information
    email: {
      type: 'string',
      optional: true,
      description: 'Primary email address',
    },
    phone: {
      type: 'string',
      optional: true,
      description: 'Primary phone number',
    },
    mobile: {
      type: 'string',
      optional: true,
      description: 'Mobile phone number',
    },
    website: {
      type: 'url',
      optional: true,
      description: 'Personal or company website',
    },

    // Company Information
    company: {
      type: 'string',
      optional: true,
      description: 'Company name',
    },
    industry: {
      type: 'string',
      optional: true,
      description: 'Industry or vertical',
    },
    companySize: {
      type: 'string',
      optional: true,
      description: 'Company size range (e.g., 1-10, 11-50, 51-200)',
      examples: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    revenue: {
      type: 'number',
      optional: true,
      description: 'Annual revenue in USD',
    },

    // Address
    street: {
      type: 'string',
      optional: true,
      description: 'Street address',
    },
    city: {
      type: 'string',
      optional: true,
      description: 'City',
    },
    state: {
      type: 'string',
      optional: true,
      description: 'State or province',
    },
    postalCode: {
      type: 'string',
      optional: true,
      description: 'ZIP or postal code',
    },
    country: {
      type: 'string',
      optional: true,
      description: 'Country',
    },

    // Lead Qualification
    status: {
      type: 'string',
      description: 'Lead status: new, contacted, qualified, unqualified, converted, lost',
      examples: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'],
    },
    source: {
      type: 'string',
      optional: true,
      description: 'Lead source: website, referral, advertisement, event, social, cold-call, partner',
      examples: ['website', 'referral', 'advertisement', 'event', 'social', 'cold-call', 'partner', 'imported'],
    },
    score: {
      type: 'number',
      optional: true,
      description: 'Lead score (0-100) indicating likelihood to convert',
    },
    rating: {
      type: 'string',
      optional: true,
      description: 'Lead quality rating: hot, warm, cold',
      examples: ['hot', 'warm', 'cold'],
    },

    // Context
    description: {
      type: 'string',
      optional: true,
      description: 'Notes or description about the lead',
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Additional notes',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Campaign
    campaign: {
      type: 'string',
      optional: true,
      description: 'Marketing campaign that generated this lead',
    },
    referredBy: {
      type: 'string',
      optional: true,
      description: 'Who referred this lead',
    },

    // Tracking
    lastContactedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the lead was last contacted',
    },
    convertedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the lead was converted to an account/opportunity',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Sales rep or user who owns this lead',
    },
    activities: {
      type: 'Activity[]',
      backref: 'lead',
      description: 'Activities associated with this lead',
    },
    convertedAccount: {
      type: 'Account',
      required: false,
      description: 'Account created when lead was converted',
    },
    convertedDeal: {
      type: 'Deal',
      required: false,
      description: 'Deal/opportunity created when lead was converted',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'qualify',
    'disqualify',
    'convert',
    'assign',
    'contact',
    'score',
    'merge',
    'import',
    'export',
    'tag',
    'untag',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'qualified',
    'disqualified',
    'converted',
    'assigned',
    'contacted',
    'scored',
    'merged',
    'imported',
    'exported',
    'tagged',
  ],
}

// =============================================================================
// Deal/Opportunity Management
// =============================================================================

/**
 * Deal entity (also known as Opportunity in some CRMs)
 *
 * Represents a qualified sales opportunity with revenue potential
 */
export const Deal: Noun = {
  singular: 'deal',
  plural: 'deals',
  description: 'A sales opportunity or deal in progress',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Deal name or title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of the opportunity',
    },

    // Financial
    value: {
      type: 'number',
      description: 'Deal value or amount in USD',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    },
    expectedRevenue: {
      type: 'number',
      optional: true,
      description: 'Expected revenue (value * probability)',
    },

    // Deal Stage & Status
    stage: {
      type: 'string',
      description: 'Current pipeline stage',
      examples: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
    },
    probability: {
      type: 'number',
      optional: true,
      description: 'Win probability percentage (0-100)',
    },
    status: {
      type: 'string',
      description: 'Deal status: open, won, lost, abandoned',
      examples: ['open', 'won', 'lost', 'abandoned'],
    },

    // Dates
    closeDate: {
      type: 'date',
      optional: true,
      description: 'Expected or actual close date',
    },
    closedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the deal was closed',
    },
    lastActivityAt: {
      type: 'datetime',
      optional: true,
      description: 'Last activity timestamp',
    },

    // Context
    source: {
      type: 'string',
      optional: true,
      description: 'How the opportunity was sourced',
      examples: ['inbound', 'outbound', 'referral', 'partner', 'marketing'],
    },
    type: {
      type: 'string',
      optional: true,
      description: 'Deal type: new-business, upsell, renewal, cross-sell',
      examples: ['new-business', 'upsell', 'renewal', 'cross-sell'],
    },
    priority: {
      type: 'string',
      optional: true,
      description: 'Deal priority: low, medium, high, critical',
      examples: ['low', 'medium', 'high', 'critical'],
    },

    // Loss/Win Analysis
    lostReason: {
      type: 'string',
      optional: true,
      description: 'Reason why deal was lost',
      examples: ['price', 'competition', 'timing', 'no-decision', 'product-fit'],
    },
    competitorName: {
      type: 'string',
      optional: true,
      description: 'Competitor involved in the deal',
    },

    // Notes
    notes: {
      type: 'string',
      optional: true,
      description: 'Notes about the deal',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
  },

  relationships: {
    account: {
      type: 'Account',
      backref: 'deals',
      description: 'The account/company this deal is with',
    },
    owner: {
      type: 'Contact',
      description: 'Sales rep who owns this deal',
    },
    pipeline: {
      type: 'Pipeline',
      backref: 'deals',
      description: 'Sales pipeline this deal belongs to',
    },
    currentStage: {
      type: 'Stage',
      description: 'Current pipeline stage',
    },
    contacts: {
      type: 'Contact[]',
      description: 'Contacts involved in this deal',
    },
    activities: {
      type: 'Activity[]',
      backref: 'deal',
      description: 'Activities related to this deal',
    },
    quotes: {
      type: 'Quote[]',
      backref: 'deal',
      description: 'Quotes/proposals sent for this deal',
    },
    products: {
      type: 'Product[]',
      description: 'Products included in this deal',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'advance',
    'moveToStage',
    'win',
    'lose',
    'abandon',
    'reopen',
    'clone',
    'assign',
    'addContact',
    'removeContact',
    'addProduct',
    'removeProduct',
    'createQuote',
    'logActivity',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'advanced',
    'stageChanged',
    'won',
    'lost',
    'abandoned',
    'reopened',
    'cloned',
    'assigned',
    'contactAdded',
    'contactRemoved',
    'productAdded',
    'productRemoved',
    'quoteCreated',
    'activityLogged',
  ],
}

// =============================================================================
// Account Management
// =============================================================================

/**
 * Account entity
 *
 * Represents a company or organization (customer or prospect)
 */
export const Account: Noun = {
  singular: 'account',
  plural: 'accounts',
  description: 'A company or organization account',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Account/company name',
    },
    legalName: {
      type: 'string',
      optional: true,
      description: 'Legal business name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of the account',
    },

    // Company Information
    industry: {
      type: 'string',
      optional: true,
      description: 'Industry or vertical',
    },
    website: {
      type: 'url',
      optional: true,
      description: 'Company website',
    },
    employeeCount: {
      type: 'number',
      optional: true,
      description: 'Number of employees',
    },
    revenue: {
      type: 'number',
      optional: true,
      description: 'Annual revenue in USD',
    },

    // Contact Information
    phone: {
      type: 'string',
      optional: true,
      description: 'Main phone number',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'General contact email',
    },

    // Address
    billingStreet: {
      type: 'string',
      optional: true,
      description: 'Billing street address',
    },
    billingCity: {
      type: 'string',
      optional: true,
      description: 'Billing city',
    },
    billingState: {
      type: 'string',
      optional: true,
      description: 'Billing state/province',
    },
    billingPostalCode: {
      type: 'string',
      optional: true,
      description: 'Billing ZIP/postal code',
    },
    billingCountry: {
      type: 'string',
      optional: true,
      description: 'Billing country',
    },
    shippingStreet: {
      type: 'string',
      optional: true,
      description: 'Shipping street address',
    },
    shippingCity: {
      type: 'string',
      optional: true,
      description: 'Shipping city',
    },
    shippingState: {
      type: 'string',
      optional: true,
      description: 'Shipping state/province',
    },
    shippingPostalCode: {
      type: 'string',
      optional: true,
      description: 'Shipping ZIP/postal code',
    },
    shippingCountry: {
      type: 'string',
      optional: true,
      description: 'Shipping country',
    },

    // Account Status
    type: {
      type: 'string',
      optional: true,
      description: 'Account type: prospect, customer, partner, competitor, other',
      examples: ['prospect', 'customer', 'partner', 'competitor', 'other'],
    },
    status: {
      type: 'string',
      optional: true,
      description: 'Account status: active, inactive, suspended, churned',
      examples: ['active', 'inactive', 'suspended', 'churned'],
    },
    priority: {
      type: 'string',
      optional: true,
      description: 'Account priority: low, medium, high, strategic',
      examples: ['low', 'medium', 'high', 'strategic'],
    },
    tier: {
      type: 'string',
      optional: true,
      description: 'Customer tier: bronze, silver, gold, platinum',
      examples: ['bronze', 'silver', 'gold', 'platinum'],
    },

    // Financials
    lifetime_value: {
      type: 'number',
      optional: true,
      description: 'Total lifetime value of the account',
    },
    totalRevenue: {
      type: 'number',
      optional: true,
      description: 'Total revenue from this account',
    },

    // Metadata
    notes: {
      type: 'string',
      optional: true,
      description: 'Notes about the account',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Tracking
    lastContactedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last contact timestamp',
    },
    customerSince: {
      type: 'date',
      optional: true,
      description: 'Date became a customer',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Account owner (sales rep or CSM)',
    },
    parentAccount: {
      type: 'Account',
      required: false,
      description: 'Parent account if this is a subsidiary',
    },
    childAccounts: {
      type: 'Account[]',
      description: 'Subsidiary accounts',
    },
    contacts: {
      type: 'Contact[]',
      backref: 'account',
      description: 'Contacts at this account',
    },
    deals: {
      type: 'Deal[]',
      backref: 'account',
      description: 'Deals/opportunities with this account',
    },
    activities: {
      type: 'Activity[]',
      backref: 'account',
      description: 'Activities related to this account',
    },
    quotes: {
      type: 'Quote[]',
      backref: 'account',
      description: 'Quotes sent to this account',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'merge',
    'activate',
    'deactivate',
    'suspend',
    'assign',
    'addContact',
    'removeContact',
    'createDeal',
    'createQuote',
    'logActivity',
    'upgrade',
    'downgrade',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'merged',
    'activated',
    'deactivated',
    'suspended',
    'assigned',
    'contactAdded',
    'contactRemoved',
    'dealCreated',
    'quoteCreated',
    'activityLogged',
    'upgraded',
    'downgraded',
  ],
}

// =============================================================================
// Pipeline & Stage Management
// =============================================================================

/**
 * Pipeline entity
 *
 * Represents a sales pipeline with defined stages
 */
export const Pipeline: Noun = {
  singular: 'pipeline',
  plural: 'pipelines',
  description: 'A sales pipeline with defined stages',

  properties: {
    name: {
      type: 'string',
      description: 'Pipeline name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of the pipeline',
    },
    type: {
      type: 'string',
      optional: true,
      description: 'Pipeline type: sales, partnership, renewal',
      examples: ['sales', 'partnership', 'renewal'],
    },
    isDefault: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the default pipeline',
    },
    isActive: {
      type: 'boolean',
      optional: true,
      description: 'Whether this pipeline is active',
    },
    stageCount: {
      type: 'number',
      optional: true,
      description: 'Number of stages in the pipeline',
    },
    totalValue: {
      type: 'number',
      optional: true,
      description: 'Total value of all deals in this pipeline',
    },
    dealCount: {
      type: 'number',
      optional: true,
      description: 'Number of deals in this pipeline',
    },
  },

  relationships: {
    stages: {
      type: 'Stage[]',
      backref: 'pipeline',
      description: 'Stages in this pipeline',
    },
    deals: {
      type: 'Deal[]',
      backref: 'pipeline',
      description: 'Deals in this pipeline',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'activate',
    'deactivate',
    'setDefault',
    'addStage',
    'removeStage',
    'reorderStages',
    'clone',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'activated',
    'deactivated',
    'setAsDefault',
    'stageAdded',
    'stageRemoved',
    'stagesReordered',
    'cloned',
  ],
}

/**
 * Stage entity
 *
 * Represents a stage within a sales pipeline
 */
export const Stage: Noun = {
  singular: 'stage',
  plural: 'stages',
  description: 'A stage in a sales pipeline',

  properties: {
    name: {
      type: 'string',
      description: 'Stage name',
      examples: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of what this stage represents',
    },
    order: {
      type: 'number',
      description: 'Display order in the pipeline (0-indexed)',
    },
    probability: {
      type: 'number',
      optional: true,
      description: 'Default win probability for deals in this stage (0-100)',
    },
    type: {
      type: 'string',
      description: 'Stage type: open, won, lost',
      examples: ['open', 'won', 'lost'],
    },
    rottenDays: {
      type: 'number',
      optional: true,
      description: 'Number of days before deals in this stage are considered stale',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Display color for the stage (hex code)',
    },
    dealCount: {
      type: 'number',
      optional: true,
      description: 'Number of deals currently in this stage',
    },
    totalValue: {
      type: 'number',
      optional: true,
      description: 'Total value of deals in this stage',
    },
  },

  relationships: {
    pipeline: {
      type: 'Pipeline',
      backref: 'stages',
      description: 'Pipeline this stage belongs to',
    },
    deals: {
      type: 'Deal[]',
      description: 'Deals currently in this stage',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'reorder',
    'moveDeals',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'reordered',
    'dealsMoved',
  ],
}

// =============================================================================
// Activity Management
// =============================================================================

/**
 * Activity entity
 *
 * Represents a CRM activity (call, email, meeting, note, task)
 */
export const Activity: Noun = {
  singular: 'activity',
  plural: 'activities',
  description: 'A CRM activity such as a call, email, meeting, or note',

  properties: {
    // Activity Details
    type: {
      type: 'string',
      description: 'Activity type: call, email, meeting, task, note, demo, lunch, other',
      examples: ['call', 'email', 'meeting', 'task', 'note', 'demo', 'lunch', 'other'],
    },
    subject: {
      type: 'string',
      description: 'Activity subject or title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Detailed description or notes',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Activity status: scheduled, completed, canceled, no-show',
      examples: ['scheduled', 'completed', 'canceled', 'no-show'],
    },
    outcome: {
      type: 'string',
      optional: true,
      description: 'Activity outcome: successful, unsuccessful, left-voicemail, no-answer',
      examples: ['successful', 'unsuccessful', 'left-voicemail', 'no-answer', 'busy'],
    },

    // Timing
    scheduledAt: {
      type: 'datetime',
      optional: true,
      description: 'When the activity is scheduled',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the activity was completed',
    },
    dueAt: {
      type: 'datetime',
      optional: true,
      description: 'When the activity is due (for tasks)',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Duration in minutes',
    },

    // Priority
    priority: {
      type: 'string',
      optional: true,
      description: 'Priority: low, medium, high',
      examples: ['low', 'medium', 'high'],
    },

    // Context
    direction: {
      type: 'string',
      optional: true,
      description: 'For calls/emails: inbound, outbound',
      examples: ['inbound', 'outbound'],
    },
    location: {
      type: 'string',
      optional: true,
      description: 'Meeting location or phone number',
    },

    // Flags
    isPrivate: {
      type: 'boolean',
      optional: true,
      description: 'Whether the activity is private',
    },
    isArchived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the activity is archived',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Person who owns/created this activity',
    },
    lead: {
      type: 'Lead',
      required: false,
      backref: 'activities',
      description: 'Lead associated with this activity',
    },
    deal: {
      type: 'Deal',
      required: false,
      backref: 'activities',
      description: 'Deal associated with this activity',
    },
    account: {
      type: 'Account',
      required: false,
      backref: 'activities',
      description: 'Account associated with this activity',
    },
    contacts: {
      type: 'Contact[]',
      description: 'Contacts involved in this activity',
    },
    attendees: {
      type: 'Contact[]',
      description: 'Meeting attendees',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'complete',
    'schedule',
    'reschedule',
    'cancel',
    'archive',
    'unarchive',
    'addAttendee',
    'removeAttendee',
    'log',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'completed',
    'scheduled',
    'rescheduled',
    'canceled',
    'archived',
    'unarchived',
    'attendeeAdded',
    'attendeeRemoved',
    'logged',
  ],
}

// =============================================================================
// Quote & Product Management
// =============================================================================

/**
 * Quote entity
 *
 * Represents a sales quote or proposal with line items
 */
export const Quote: Noun = {
  singular: 'quote',
  plural: 'quotes',
  description: 'A sales quote or proposal',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Quote name or title',
    },
    quoteNumber: {
      type: 'string',
      optional: true,
      description: 'Unique quote number',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Quote description',
    },

    // Status
    status: {
      type: 'string',
      description: 'Quote status: draft, sent, viewed, accepted, rejected, expired',
      examples: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
    },

    // Financials
    subtotal: {
      type: 'number',
      description: 'Subtotal before tax and discount',
    },
    discount: {
      type: 'number',
      optional: true,
      description: 'Discount amount',
    },
    discountPercent: {
      type: 'number',
      optional: true,
      description: 'Discount percentage',
    },
    tax: {
      type: 'number',
      optional: true,
      description: 'Tax amount',
    },
    taxPercent: {
      type: 'number',
      optional: true,
      description: 'Tax percentage',
    },
    total: {
      type: 'number',
      description: 'Total amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    },

    // Terms
    validUntil: {
      type: 'date',
      optional: true,
      description: 'Quote expiration date',
    },
    terms: {
      type: 'string',
      optional: true,
      description: 'Terms and conditions',
    },
    paymentTerms: {
      type: 'string',
      optional: true,
      description: 'Payment terms: net-30, net-60, due-on-receipt',
      examples: ['net-30', 'net-60', 'net-90', 'due-on-receipt'],
    },

    // Tracking
    sentAt: {
      type: 'datetime',
      optional: true,
      description: 'When the quote was sent',
    },
    viewedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the quote was first viewed',
    },
    acceptedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the quote was accepted',
    },

    // Document
    documentUrl: {
      type: 'url',
      optional: true,
      description: 'URL to the quote document (PDF)',
    },
    publicUrl: {
      type: 'url',
      optional: true,
      description: 'Public URL for customer to view quote',
    },

    // Notes
    notes: {
      type: 'string',
      optional: true,
      description: 'Internal notes about the quote',
    },
  },

  relationships: {
    deal: {
      type: 'Deal',
      required: false,
      backref: 'quotes',
      description: 'Deal this quote is for',
    },
    account: {
      type: 'Account',
      required: false,
      backref: 'quotes',
      description: 'Account receiving this quote',
    },
    owner: {
      type: 'Contact',
      description: 'Sales rep who created the quote',
    },
    lineItems: {
      type: 'QuoteLineItem[]',
      backref: 'quote',
      description: 'Line items in this quote',
    },
    contact: {
      type: 'Contact',
      required: false,
      description: 'Primary contact for this quote',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'send',
    'resend',
    'accept',
    'reject',
    'expire',
    'clone',
    'generatePdf',
    'addLineItem',
    'removeLineItem',
    'applyDiscount',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'sent',
    'resent',
    'viewed',
    'accepted',
    'rejected',
    'expired',
    'cloned',
    'pdfGenerated',
    'lineItemAdded',
    'lineItemRemoved',
    'discountApplied',
  ],
}

/**
 * QuoteLineItem entity
 *
 * Represents a single line item on a quote
 */
export const QuoteLineItem: Noun = {
  singular: 'quote line item',
  plural: 'quote line items',
  description: 'A line item on a sales quote',

  properties: {
    description: {
      type: 'string',
      description: 'Item description',
    },
    quantity: {
      type: 'number',
      description: 'Quantity',
    },
    unitPrice: {
      type: 'number',
      description: 'Price per unit',
    },
    discount: {
      type: 'number',
      optional: true,
      description: 'Discount amount per unit',
    },
    discountPercent: {
      type: 'number',
      optional: true,
      description: 'Discount percentage',
    },
    total: {
      type: 'number',
      description: 'Total line item amount (quantity * unitPrice - discount)',
    },
    order: {
      type: 'number',
      optional: true,
      description: 'Display order',
    },
  },

  relationships: {
    quote: {
      type: 'Quote',
      backref: 'lineItems',
      description: 'Quote this line item belongs to',
    },
    product: {
      type: 'Product',
      required: false,
      description: 'Product being sold (if applicable)',
    },
  },

  actions: ['create', 'update', 'delete', 'reorder'],

  events: ['created', 'updated', 'deleted', 'reordered'],
}

/**
 * Product entity
 *
 * Represents a product or service that can be sold
 */
export const Product: Noun = {
  singular: 'product',
  plural: 'products',
  description: 'A product or service that can be sold',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Product name',
    },
    sku: {
      type: 'string',
      optional: true,
      description: 'Stock keeping unit (SKU)',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Product code',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Product description',
    },

    // Categorization
    category: {
      type: 'string',
      optional: true,
      description: 'Product category',
    },
    type: {
      type: 'string',
      optional: true,
      description: 'Product type: physical, service, subscription, digital',
      examples: ['physical', 'service', 'subscription', 'digital'],
    },

    // Pricing
    price: {
      type: 'number',
      description: 'Base price',
    },
    cost: {
      type: 'number',
      optional: true,
      description: 'Cost of goods sold',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code (ISO 4217)',
      examples: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    },
    priceUnit: {
      type: 'string',
      optional: true,
      description: 'Pricing unit: unit, hour, day, month, year',
      examples: ['unit', 'hour', 'day', 'month', 'year'],
    },

    // Status
    isActive: {
      type: 'boolean',
      optional: true,
      description: 'Whether the product is active/available',
    },
    isRecurring: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a recurring/subscription product',
    },
    isTaxable: {
      type: 'boolean',
      optional: true,
      description: 'Whether the product is taxable',
    },

    // Inventory (if applicable)
    stock: {
      type: 'number',
      optional: true,
      description: 'Current stock quantity',
    },
    reorderPoint: {
      type: 'number',
      optional: true,
      description: 'Inventory level triggering reorder',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Product tags',
    },
    imageUrl: {
      type: 'url',
      optional: true,
      description: 'Product image URL',
    },
  },

  relationships: {
    deals: {
      type: 'Deal[]',
      description: 'Deals including this product',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'activate',
    'deactivate',
    'adjustPrice',
    'updateStock',
    'reorder',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'activated',
    'deactivated',
    'priceAdjusted',
    'stockUpdated',
    'reordered',
  ],
}

// =============================================================================
// Export all CRM entities
// =============================================================================

/**
 * All CRM/Sales entity types
 */
export const CRMEntities = {
  // Core Entities
  Lead,
  Deal,
  Account,

  // Pipeline
  Pipeline,
  Stage,

  // Activities
  Activity,

  // Quotes & Products
  Quote,
  QuoteLineItem,
  Product,
}

/**
 * CRM Entity categories for organization
 */
export const CRMCategories = {
  leads: ['Lead'],
  opportunities: ['Deal'],
  accounts: ['Account'],
  pipeline: ['Pipeline', 'Stage'],
  activities: ['Activity'],
  quotes: ['Quote', 'QuoteLineItem'],
  products: ['Product'],
} as const
