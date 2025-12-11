/**
 * Marketing & Growth Tool Types
 *
 * Types for marketing and growth integrations:
 * Campaign, CampaignAsset, Channel, Audience, AudienceMember, EmailTemplate,
 * EmailCampaign, EmailSend, EmailEvent, LandingPage, Form, FormSubmission,
 * Content, ContentCalendar, SocialPost, SocialAccount, Ad, AdGroup, AdCampaign,
 * Attribution, TouchPoint, Journey, JourneyStep, ABTest, ABTestVariant, UTM, Referral.
 *
 * @module tool/marketing
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
// Enums and Constants
// =============================================================================

/**
 * Campaign status.
 */
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived'

/**
 * Campaign type.
 */
export type CampaignType =
  | 'email'
  | 'social'
  | 'paid_search'
  | 'display'
  | 'content'
  | 'event'
  | 'direct_mail'
  | 'webinar'
  | 'other'

/**
 * Marketing channel type.
 */
export type MarketingChannelType =
  | 'organic_search'
  | 'paid_search'
  | 'email'
  | 'social_organic'
  | 'social_paid'
  | 'display'
  | 'direct'
  | 'referral'
  | 'affiliate'
  | 'content'
  | 'video'
  | 'offline'
  | 'other'

/**
 * Email status.
 */
export type EmailCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'

/**
 * Content status.
 */
export type ContentStatus =
  | 'draft'
  | 'in_review'
  | 'scheduled'
  | 'published'
  | 'archived'

/**
 * Content type.
 */
export type ContentType =
  | 'blog_post'
  | 'article'
  | 'video'
  | 'podcast'
  | 'ebook'
  | 'whitepaper'
  | 'case_study'
  | 'infographic'
  | 'webinar'
  | 'guide'
  | 'other'

/**
 * Ad status.
 */
export type AdStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'completed'

/**
 * Ad type.
 */
export type AdType =
  | 'search'
  | 'display'
  | 'video'
  | 'shopping'
  | 'social'
  | 'native'
  | 'remarketing'

/**
 * Attribution model.
 */
export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'data_driven'

/**
 * Journey status.
 */
export type JourneyStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'abandoned'

/**
 * A/B test status.
 */
export type ABTestStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'

// =============================================================================
// Campaign
// =============================================================================

/**
 * Marketing campaign.
 *
 * @example
 * ```ts
 * const campaign: Campaign = {
 *   id: 'camp_123',
 *   name: 'Q1 Product Launch',
 *   type: 'email',
 *   status: 'active',
 *   objective: 'Generate 500 qualified leads',
 *   budget: {
 *     amount: 50000,
 *     currency: 'USD',
 *     spent: 12500
 *   },
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-03-31'),
 *   metrics: {
 *     impressions: 150000,
 *     clicks: 7500,
 *     conversions: 375,
 *     revenue: 187500
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Campaign {
  /** Unique identifier */
  id: string

  /** Campaign name */
  name: string

  /** Campaign type */
  type: CampaignType

  /** Campaign status */
  status: CampaignStatus

  /** Campaign description */
  description?: string

  /** Campaign objective */
  objective?: string

  /** Target audience ID */
  audienceId?: string

  /** Budget information */
  budget?: {
    amount: number
    currency: string
    spent?: number
    remaining?: number
  }

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Campaign owner ID */
  ownerId?: string

  /** Tags */
  tags?: string[]

  /** Campaign metrics */
  metrics?: {
    impressions?: number
    clicks?: number
    conversions?: number
    leads?: number
    revenue?: number
    ctr?: number
    conversionRate?: number
    cpc?: number
    cpa?: number
    roas?: number
  }

  /** UTM parameters */
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }

  /** Associated channels */
  channels?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    hubspot?: string
    google_ads?: string
    facebook_ads?: string
    salesforce?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CampaignInput = Input<Campaign>
export type CampaignOutput = Output<Campaign>

// =============================================================================
// CampaignAsset
// =============================================================================

/**
 * Campaign creative asset.
 *
 * @example
 * ```ts
 * const asset: CampaignAsset = {
 *   id: 'asset_123',
 *   campaignId: 'camp_123',
 *   name: 'Hero Banner',
 *   type: 'image',
 *   url: 'https://cdn.example.com/hero-banner.jpg',
 *   format: 'jpg',
 *   size: 245760,
 *   dimensions: { width: 1200, height: 630 },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CampaignAsset {
  /** Unique identifier */
  id: string

  /** Associated campaign ID */
  campaignId: string

  /** Asset name */
  name: string

  /** Asset type */
  type: 'image' | 'video' | 'audio' | 'document' | 'html' | 'other'

  /** Asset URL */
  url: string

  /** File format */
  format?: string

  /** File size in bytes */
  size?: number

  /** Dimensions (for images/videos) */
  dimensions?: {
    width: number
    height: number
  }

  /** Duration in seconds (for video/audio) */
  duration?: number

  /** Description */
  description?: string

  /** Alt text (for images) */
  altText?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    cloudinary?: string
    s3?: string
    gcs?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CampaignAssetInput = Input<CampaignAsset>
export type CampaignAssetOutput = Output<CampaignAsset>

// =============================================================================
// Channel
// =============================================================================

/**
 * Marketing channel.
 *
 * @example
 * ```ts
 * const channel: MarketingChannel = {
 *   id: 'chan_123',
 *   name: 'Organic Search',
 *   type: 'organic_search',
 *   status: 'active',
 *   metrics: {
 *     sessions: 15000,
 *     conversions: 750,
 *     revenue: 375000
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface MarketingChannel {
  /** Unique identifier */
  id: string

  /** Channel name */
  name: string

  /** Channel type */
  type: MarketingChannelType

  /** Channel status */
  status: 'active' | 'inactive'

  /** Description */
  description?: string

  /** Budget allocation */
  budget?: {
    amount: number
    currency: string
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  }

  /** Channel metrics */
  metrics?: {
    sessions?: number
    users?: number
    conversions?: number
    revenue?: number
    cac?: number
  }

  /** Configuration */
  config?: Record<string, unknown>

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    google_analytics?: string
    mixpanel?: string
    amplitude?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MarketingChannelInput = Input<MarketingChannel>
export type MarketingChannelOutput = Output<MarketingChannel>

// =============================================================================
// Audience
// =============================================================================

/**
 * Target audience/segment.
 *
 * @example
 * ```ts
 * const audience: Audience = {
 *   id: 'aud_123',
 *   name: 'Enterprise Decision Makers',
 *   description: 'C-level executives at companies with 500+ employees',
 *   size: 15000,
 *   criteria: {
 *     jobTitle: ['CEO', 'CTO', 'CFO'],
 *     companySize: '500+',
 *     industry: ['Technology', 'Finance']
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Audience {
  /** Unique identifier */
  id: string

  /** Audience name */
  name: string

  /** Description */
  description?: string

  /** Audience type */
  type?: 'static' | 'dynamic' | 'lookalike' | 'custom'

  /** Audience size (member count) */
  size?: number

  /** Segmentation criteria */
  criteria?: {
    demographics?: Record<string, unknown>
    geography?: string[]
    behaviors?: string[]
    interests?: string[]
    customFilters?: Record<string, unknown>
  }

  /** Source audience ID (for lookalike) */
  sourceAudienceId?: string

  /** Tags */
  tags?: string[]

  /** Last synced timestamp */
  lastSyncedAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    hubspot?: string
    facebook?: string
    google_ads?: string
    linkedin?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AudienceInput = Input<Audience>
export type AudienceOutput = Output<Audience>

// =============================================================================
// AudienceMember
// =============================================================================

/**
 * Audience membership.
 *
 * @example
 * ```ts
 * const member: AudienceMember = {
 *   id: 'audmem_123',
 *   audienceId: 'aud_123',
 *   contactId: 'cntct_123',
 *   email: 'john@example.com',
 *   status: 'active',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface AudienceMember {
  /** Unique identifier */
  id: string

  /** Audience ID */
  audienceId: string

  /** Contact/user ID */
  contactId?: string

  /** Email address */
  email?: string

  /** Membership status */
  status: 'active' | 'inactive' | 'unsubscribed'

  /** Source of addition */
  source?: string

  /** Custom attributes */
  attributes?: Record<string, unknown>

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    hubspot?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AudienceMemberInput = Input<AudienceMember>
export type AudienceMemberOutput = Output<AudienceMember>

// =============================================================================
// EmailTemplate
// =============================================================================

/**
 * Email template.
 *
 * @example
 * ```ts
 * const template: EmailTemplate = {
 *   id: 'tmpl_123',
 *   name: 'Welcome Email',
 *   subject: 'Welcome to {{company}}!',
 *   htmlBody: '<h1>Welcome {{firstName}}!</h1>...',
 *   textBody: 'Welcome {{firstName}}!...',
 *   variables: ['company', 'firstName'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmailTemplate {
  /** Unique identifier */
  id: string

  /** Template name */
  name: string

  /** Email subject line */
  subject: string

  /** HTML body */
  htmlBody: string

  /** Plain text body */
  textBody?: string

  /** Template variables */
  variables?: string[]

  /** Preview text */
  previewText?: string

  /** From name */
  fromName?: string

  /** From email */
  fromEmail?: string

  /** Reply-to email */
  replyTo?: string

  /** Category/folder */
  category?: string

  /** Tags */
  tags?: string[]

  /** Thumbnail URL */
  thumbnailUrl?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    sendgrid?: string
    postmark?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailTemplateInput = Input<EmailTemplate>
export type EmailTemplateOutput = Output<EmailTemplate>

// =============================================================================
// EmailCampaign
// =============================================================================

/**
 * Email campaign.
 *
 * @example
 * ```ts
 * const emailCampaign: EmailCampaign = {
 *   id: 'ecamp_123',
 *   campaignId: 'camp_123',
 *   name: 'Product Launch Announcement',
 *   templateId: 'tmpl_123',
 *   audienceId: 'aud_123',
 *   status: 'sent',
 *   scheduledAt: new Date('2024-01-15T10:00:00Z'),
 *   sentAt: new Date('2024-01-15T10:00:12Z'),
 *   metrics: {
 *     sent: 10000,
 *     delivered: 9850,
 *     opened: 3940,
 *     clicked: 788,
 *     bounced: 150,
 *     unsubscribed: 25
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmailCampaign {
  /** Unique identifier */
  id: string

  /** Parent campaign ID */
  campaignId?: string

  /** Campaign name */
  name: string

  /** Email template ID */
  templateId?: string

  /** Target audience ID */
  audienceId?: string

  /** Campaign status */
  status: EmailCampaignStatus

  /** Subject line */
  subject?: string

  /** Preview text */
  previewText?: string

  /** From name */
  fromName?: string

  /** From email */
  fromEmail?: string

  /** Reply-to email */
  replyTo?: string

  /** Scheduled send time */
  scheduledAt?: Date

  /** Actual send time */
  sentAt?: Date

  /** A/B test ID */
  abTestId?: string

  /** Email metrics */
  metrics?: {
    sent?: number
    delivered?: number
    opened?: number
    clicked?: number
    bounced?: number
    unsubscribed?: number
    complained?: number
    openRate?: number
    clickRate?: number
    bounceRate?: number
  }

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    sendgrid?: string
    hubspot?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailCampaignInput = Input<EmailCampaign>
export type EmailCampaignOutput = Output<EmailCampaign>

// =============================================================================
// EmailSend
// =============================================================================

/**
 * Individual email send record.
 *
 * @example
 * ```ts
 * const emailSend: EmailSend = {
 *   id: 'send_123',
 *   emailCampaignId: 'ecamp_123',
 *   email: 'john@example.com',
 *   status: 'delivered',
 *   sentAt: new Date('2024-01-15T10:00:12Z'),
 *   deliveredAt: new Date('2024-01-15T10:00:15Z'),
 *   openedAt: new Date('2024-01-15T14:23:45Z'),
 *   clickedAt: new Date('2024-01-15T14:24:12Z'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmailSend {
  /** Unique identifier */
  id: string

  /** Email campaign ID */
  emailCampaignId: string

  /** Contact ID */
  contactId?: string

  /** Recipient email */
  email: string

  /** Send status */
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'deferred'

  /** Subject line (with variables replaced) */
  subject?: string

  /** Sent timestamp */
  sentAt?: Date

  /** Delivered timestamp */
  deliveredAt?: Date

  /** Opened timestamp */
  openedAt?: Date

  /** Clicked timestamp */
  clickedAt?: Date

  /** Bounced timestamp */
  bouncedAt?: Date

  /** Bounce reason */
  bounceReason?: string

  /** Open count */
  openCount?: number

  /** Click count */
  clickCount?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    sendgrid?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailSendInput = Input<EmailSend>
export type EmailSendOutput = Output<EmailSend>

// =============================================================================
// EmailEvent
// =============================================================================

/**
 * Email event (open, click, etc.).
 *
 * @example
 * ```ts
 * const emailEvent: EmailEvent = {
 *   id: 'evt_123',
 *   emailSendId: 'send_123',
 *   type: 'click',
 *   url: 'https://example.com/product',
 *   userAgent: 'Mozilla/5.0...',
 *   ipAddress: '192.168.1.1',
 *   timestamp: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmailEvent {
  /** Unique identifier */
  id: string

  /** Email send ID */
  emailSendId: string

  /** Event type */
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed'

  /** URL clicked (for click events) */
  url?: string

  /** Link ID */
  linkId?: string

  /** User agent */
  userAgent?: string

  /** IP address */
  ipAddress?: string

  /** Location data */
  location?: {
    city?: string
    region?: string
    country?: string
  }

  /** Device type */
  device?: 'desktop' | 'mobile' | 'tablet' | 'other'

  /** Event timestamp */
  timestamp: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    mailchimp?: string
    sendgrid?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailEventInput = Input<EmailEvent>
export type EmailEventOutput = Output<EmailEvent>

// =============================================================================
// LandingPage
// =============================================================================

/**
 * Landing page.
 *
 * @example
 * ```ts
 * const landingPage: LandingPage = {
 *   id: 'lp_123',
 *   name: 'Product Launch Page',
 *   slug: 'product-launch',
 *   url: 'https://example.com/product-launch',
 *   status: 'published',
 *   campaignId: 'camp_123',
 *   metrics: {
 *     visits: 5000,
 *     conversions: 250,
 *     conversionRate: 0.05
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface LandingPage {
  /** Unique identifier */
  id: string

  /** Page name */
  name: string

  /** URL slug */
  slug: string

  /** Full URL */
  url: string

  /** Page status */
  status: 'draft' | 'published' | 'archived'

  /** Page title (SEO) */
  title?: string

  /** Meta description */
  description?: string

  /** Campaign ID */
  campaignId?: string

  /** Form ID (primary CTA form) */
  formId?: string

  /** Template/theme */
  template?: string

  /** Page content (JSON or HTML) */
  content?: string

  /** Thumbnail URL */
  thumbnailUrl?: string

  /** A/B test ID */
  abTestId?: string

  /** Published date */
  publishedAt?: Date

  /** Page metrics */
  metrics?: {
    visits?: number
    uniqueVisitors?: number
    conversions?: number
    conversionRate?: number
    bounceRate?: number
    avgTimeOnPage?: number
  }

  /** SEO settings */
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
    ogImage?: string
    noIndex?: boolean
  }

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    unbounce?: string
    leadpages?: string
    instapage?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LandingPageInput = Input<LandingPage>
export type LandingPageOutput = Output<LandingPage>

// =============================================================================
// Form
// =============================================================================

/**
 * Lead capture form.
 *
 * @example
 * ```ts
 * const form: Form = {
 *   id: 'form_123',
 *   name: 'Contact Us',
 *   type: 'contact',
 *   fields: [
 *     { name: 'email', type: 'email', required: true },
 *     { name: 'firstName', type: 'text', required: true },
 *     { name: 'company', type: 'text', required: false }
 *   ],
 *   status: 'active',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Form {
  /** Unique identifier */
  id: string

  /** Form name */
  name: string

  /** Form type */
  type: 'contact' | 'newsletter' | 'demo' | 'download' | 'registration' | 'survey' | 'other'

  /** Form status */
  status: 'draft' | 'active' | 'inactive' | 'archived'

  /** Form fields */
  fields?: Array<{
    name: string
    type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file'
    label?: string
    placeholder?: string
    required?: boolean
    options?: string[]
    validation?: Record<string, unknown>
  }>

  /** Submit button text */
  submitText?: string

  /** Success message */
  successMessage?: string

  /** Redirect URL after submission */
  redirectUrl?: string

  /** Notification email */
  notificationEmail?: string

  /** Auto-response settings */
  autoResponse?: {
    enabled: boolean
    emailTemplateId?: string
    subject?: string
    message?: string
  }

  /** Associated campaign ID */
  campaignId?: string

  /** Submission count */
  submissionCount?: number

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    typeform?: string
    jotform?: string
    gravity_forms?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FormInput = Input<Form>
export type FormOutput = Output<Form>

// =============================================================================
// FormSubmission
// =============================================================================

/**
 * Form submission.
 *
 * @example
 * ```ts
 * const submission: FormSubmission = {
 *   id: 'sub_123',
 *   formId: 'form_123',
 *   data: {
 *     email: 'john@example.com',
 *     firstName: 'John',
 *     company: 'Acme Corp'
 *   },
 *   source: {
 *     url: 'https://example.com/contact',
 *     referrer: 'https://google.com',
 *     utm: {
 *       source: 'google',
 *       medium: 'cpc'
 *     }
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface FormSubmission {
  /** Unique identifier */
  id: string

  /** Form ID */
  formId: string

  /** Contact ID (if linked) */
  contactId?: string

  /** Submission data */
  data: Record<string, unknown>

  /** Submission source */
  source?: {
    url?: string
    referrer?: string
    ipAddress?: string
    userAgent?: string
    utm?: {
      source?: string
      medium?: string
      campaign?: string
      term?: string
      content?: string
    }
  }

  /** Lead score */
  leadScore?: number

  /** Follow-up status */
  followUpStatus?: 'pending' | 'contacted' | 'qualified' | 'converted' | 'disqualified'

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    hubspot?: string
    salesforce?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FormSubmissionInput = Input<FormSubmission>
export type FormSubmissionOutput = Output<FormSubmission>

// =============================================================================
// Content
// =============================================================================

/**
 * Content piece (blog, video, etc.).
 *
 * @example
 * ```ts
 * const content: Content = {
 *   id: 'cnt_123',
 *   title: 'How to Scale Your SaaS Business',
 *   type: 'blog_post',
 *   status: 'published',
 *   slug: 'how-to-scale-saas-business',
 *   url: 'https://example.com/blog/how-to-scale-saas-business',
 *   authorId: 'user_123',
 *   publishedAt: new Date(),
 *   metrics: {
 *     views: 5000,
 *     shares: 250,
 *     conversions: 50
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Content {
  /** Unique identifier */
  id: string

  /** Content title */
  title: string

  /** Content type */
  type: ContentType

  /** Content status */
  status: ContentStatus

  /** URL slug */
  slug?: string

  /** Full URL */
  url?: string

  /** Author ID */
  authorId?: string

  /** Summary/excerpt */
  summary?: string

  /** Full content body */
  body?: string

  /** Featured image URL */
  featuredImage?: string

  /** Video URL */
  videoUrl?: string

  /** Podcast URL */
  podcastUrl?: string

  /** Category/topic */
  category?: string

  /** Tags */
  tags?: string[]

  /** Target keywords */
  keywords?: string[]

  /** Campaign ID */
  campaignId?: string

  /** Call-to-action */
  cta?: {
    text: string
    url: string
    type?: 'button' | 'link' | 'form'
  }

  /** Publishing schedule */
  scheduledAt?: Date

  /** Published date */
  publishedAt?: Date

  /** Content metrics */
  metrics?: {
    views?: number
    uniqueViews?: number
    shares?: number
    comments?: number
    likes?: number
    conversions?: number
    avgTimeOnPage?: number
  }

  /** SEO settings */
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
    ogImage?: string
    noIndex?: boolean
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wordpress?: string
    contentful?: string
    ghost?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContentInput = Input<Content>
export type ContentOutput = Output<Content>

// =============================================================================
// ContentCalendar
// =============================================================================

/**
 * Editorial calendar entry.
 *
 * @example
 * ```ts
 * const calendarEntry: ContentCalendar = {
 *   id: 'cal_123',
 *   title: 'Q1 Product Launch Blog Series',
 *   contentId: 'cnt_123',
 *   scheduledDate: new Date('2024-01-15'),
 *   status: 'scheduled',
 *   assigneeId: 'user_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ContentCalendar {
  /** Unique identifier */
  id: string

  /** Entry title */
  title: string

  /** Content ID (if created) */
  contentId?: string

  /** Content type */
  type: ContentType

  /** Scheduled publish date */
  scheduledDate: Date

  /** Entry status */
  status: 'planned' | 'in_progress' | 'in_review' | 'scheduled' | 'published' | 'cancelled'

  /** Assigned team member */
  assigneeId?: string

  /** Campaign ID */
  campaignId?: string

  /** Topic/theme */
  topic?: string

  /** Target keywords */
  keywords?: string[]

  /** Notes */
  notes?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContentCalendarInput = Input<ContentCalendar>
export type ContentCalendarOutput = Output<ContentCalendar>

// =============================================================================
// SocialPost
// =============================================================================

/**
 * Social media post.
 *
 * @example
 * ```ts
 * const socialPost: SocialPost = {
 *   id: 'post_123',
 *   accountId: 'acct_123',
 *   platform: 'twitter',
 *   content: 'Excited to announce our new product launch!',
 *   status: 'published',
 *   publishedAt: new Date(),
 *   metrics: {
 *     impressions: 10000,
 *     likes: 500,
 *     shares: 100,
 *     comments: 50,
 *     clicks: 250
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SocialPost {
  /** Unique identifier */
  id: string

  /** Social account ID */
  accountId: string

  /** Platform */
  platform: 'twitter' | 'facebook' | 'linkedin' | 'instagram' | 'youtube' | 'tiktok' | 'other'

  /** Post content/text */
  content: string

  /** Post status */
  status: 'draft' | 'scheduled' | 'published' | 'failed'

  /** Media attachments */
  media?: Array<{
    type: 'image' | 'video' | 'gif'
    url: string
    thumbnailUrl?: string
  }>

  /** Link URL */
  linkUrl?: string

  /** Campaign ID */
  campaignId?: string

  /** Scheduled publish time */
  scheduledAt?: Date

  /** Published time */
  publishedAt?: Date

  /** Post metrics */
  metrics?: {
    impressions?: number
    reach?: number
    likes?: number
    shares?: number
    comments?: number
    clicks?: number
    saves?: number
    engagementRate?: number
  }

  /** Hashtags */
  hashtags?: string[]

  /** Mentions */
  mentions?: string[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    twitter?: string
    facebook?: string
    linkedin?: string
    instagram?: string
    hootsuite?: string
    buffer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SocialPostInput = Input<SocialPost>
export type SocialPostOutput = Output<SocialPost>

// =============================================================================
// SocialAccount
// =============================================================================

/**
 * Connected social media account.
 *
 * @example
 * ```ts
 * const socialAccount: SocialAccount = {
 *   id: 'acct_123',
 *   platform: 'twitter',
 *   username: 'example',
 *   displayName: 'Example Company',
 *   profileUrl: 'https://twitter.com/example',
 *   status: 'active',
 *   followers: 10000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SocialAccount {
  /** Unique identifier */
  id: string

  /** Platform */
  platform: 'twitter' | 'facebook' | 'linkedin' | 'instagram' | 'youtube' | 'tiktok' | 'other'

  /** Username/handle */
  username: string

  /** Display name */
  displayName?: string

  /** Profile URL */
  profileUrl?: string

  /** Account status */
  status: 'active' | 'disconnected' | 'expired' | 'error'

  /** Profile image URL */
  profileImageUrl?: string

  /** Follower count */
  followers?: number

  /** Following count */
  following?: number

  /** Access token (encrypted) */
  accessToken?: string

  /** Token expiry */
  tokenExpiresAt?: Date

  /** Last synced */
  lastSyncedAt?: Date

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    twitter?: string
    facebook?: string
    linkedin?: string
    instagram?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SocialAccountInput = Input<SocialAccount>
export type SocialAccountOutput = Output<SocialAccount>

// =============================================================================
// Ad
// =============================================================================

/**
 * Paid advertisement.
 *
 * @example
 * ```ts
 * const ad: Ad = {
 *   id: 'ad_123',
 *   adGroupId: 'adg_123',
 *   name: 'Product Launch Ad',
 *   type: 'search',
 *   status: 'active',
 *   headline: 'Revolutionary SaaS Platform',
 *   description: 'Boost productivity by 10x',
 *   targetUrl: 'https://example.com/product',
 *   metrics: {
 *     impressions: 50000,
 *     clicks: 2500,
 *     conversions: 125,
 *     spend: 5000,
 *     ctr: 0.05,
 *     cpc: 2.00,
 *     cpa: 40.00
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Ad {
  /** Unique identifier */
  id: string

  /** Ad group ID */
  adGroupId: string

  /** Ad name */
  name: string

  /** Ad type */
  type: AdType

  /** Ad status */
  status: AdStatus

  /** Headline/title */
  headline: string

  /** Description */
  description?: string

  /** Display URL */
  displayUrl?: string

  /** Target URL */
  targetUrl: string

  /** Image/video URL */
  mediaUrl?: string

  /** Call to action */
  callToAction?: string

  /** Ad copy variations */
  variations?: Array<{
    headline: string
    description?: string
  }>

  /** Ad metrics */
  metrics?: {
    impressions?: number
    clicks?: number
    conversions?: number
    spend?: number
    revenue?: number
    ctr?: number
    cpc?: number
    cpm?: number
    cpa?: number
    roas?: number
  }

  /** Quality score */
  qualityScore?: number

  /** Bid amount */
  bid?: {
    amount: number
    strategy: 'manual' | 'auto' | 'target_cpa' | 'target_roas'
  }

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    google_ads?: string
    facebook_ads?: string
    linkedin_ads?: string
    microsoft_ads?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AdInput = Input<Ad>
export type AdOutput = Output<Ad>

// =============================================================================
// AdGroup
// =============================================================================

/**
 * Ad group.
 *
 * @example
 * ```ts
 * const adGroup: AdGroup = {
 *   id: 'adg_123',
 *   adCampaignId: 'adc_123',
 *   name: 'Product Keywords',
 *   status: 'active',
 *   targeting: {
 *     keywords: ['saas platform', 'productivity tool'],
 *     locations: ['US', 'CA', 'UK'],
 *     demographics: { age: '25-54' }
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface AdGroup {
  /** Unique identifier */
  id: string

  /** Ad campaign ID */
  adCampaignId: string

  /** Ad group name */
  name: string

  /** Ad group status */
  status: AdStatus

  /** Default bid */
  defaultBid?: {
    amount: number
    strategy: 'manual' | 'auto' | 'target_cpa' | 'target_roas'
  }

  /** Targeting criteria */
  targeting?: {
    keywords?: string[]
    negativeKeywords?: string[]
    locations?: string[]
    demographics?: Record<string, unknown>
    interests?: string[]
    behaviors?: string[]
    devices?: ('desktop' | 'mobile' | 'tablet')[]
    audiences?: string[]
  }

  /** Budget */
  budget?: {
    daily?: number
    total?: number
    currency: string
  }

  /** Ad group metrics */
  metrics?: {
    impressions?: number
    clicks?: number
    conversions?: number
    spend?: number
  }

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    google_ads?: string
    facebook_ads?: string
    linkedin_ads?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AdGroupInput = Input<AdGroup>
export type AdGroupOutput = Output<AdGroup>

// =============================================================================
// AdCampaign
// =============================================================================

/**
 * Advertising campaign.
 *
 * @example
 * ```ts
 * const adCampaign: AdCampaign = {
 *   id: 'adc_123',
 *   campaignId: 'camp_123',
 *   name: 'Q1 Product Launch Ads',
 *   platform: 'google_ads',
 *   objective: 'conversions',
 *   status: 'active',
 *   budget: {
 *     daily: 500,
 *     total: 15000,
 *     currency: 'USD'
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface AdCampaign {
  /** Unique identifier */
  id: string

  /** Parent campaign ID */
  campaignId?: string

  /** Campaign name */
  name: string

  /** Ad platform */
  platform: 'google_ads' | 'facebook_ads' | 'linkedin_ads' | 'microsoft_ads' | 'twitter_ads' | 'other'

  /** Campaign objective */
  objective: 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversions' | 'sales' | 'app_installs'

  /** Campaign status */
  status: AdStatus

  /** Budget */
  budget: {
    daily?: number
    total?: number
    currency: string
    spent?: number
  }

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Campaign metrics */
  metrics?: {
    impressions?: number
    clicks?: number
    conversions?: number
    spend?: number
    revenue?: number
    roas?: number
  }

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    google_ads?: string
    facebook_ads?: string
    linkedin_ads?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AdCampaignInput = Input<AdCampaign>
export type AdCampaignOutput = Output<AdCampaign>

// =============================================================================
// Attribution
// =============================================================================

/**
 * Marketing attribution record.
 *
 * @example
 * ```ts
 * const attribution: Attribution = {
 *   id: 'attr_123',
 *   contactId: 'cntct_123',
 *   conversionType: 'purchase',
 *   revenue: 9999,
 *   model: 'first_touch',
 *   firstTouchChannel: 'organic_search',
 *   lastTouchChannel: 'email',
 *   touchPointCount: 5,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Attribution {
  /** Unique identifier */
  id: string

  /** Contact ID */
  contactId?: string

  /** Conversion type */
  conversionType: 'lead' | 'trial' | 'purchase' | 'upgrade' | 'renewal' | 'other'

  /** Revenue value */
  revenue?: number

  /** Currency */
  currency?: string

  /** Attribution model */
  model: AttributionModel

  /** First touch channel */
  firstTouchChannel?: string

  /** Last touch channel */
  lastTouchChannel?: string

  /** Channel credits (for weighted models) */
  channelCredits?: Array<{
    channel: string
    credit: number
    weight: number
  }>

  /** Touch point count */
  touchPointCount?: number

  /** Campaign ID */
  campaignId?: string

  /** Conversion timestamp */
  convertedAt?: Date

  /** Days to conversion */
  daysToConversion?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    google_analytics?: string
    mixpanel?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AttributionInput = Input<Attribution>
export type AttributionOutput = Output<Attribution>

// =============================================================================
// TouchPoint
// =============================================================================

/**
 * Customer touchpoint.
 *
 * @example
 * ```ts
 * const touchPoint: TouchPoint = {
 *   id: 'tp_123',
 *   contactId: 'cntct_123',
 *   type: 'website_visit',
 *   channel: 'organic_search',
 *   source: 'google',
 *   medium: 'organic',
 *   campaign: 'brand_search',
 *   timestamp: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TouchPoint {
  /** Unique identifier */
  id: string

  /** Contact ID */
  contactId?: string

  /** Session ID */
  sessionId?: string

  /** Touch point type */
  type:
    | 'website_visit'
    | 'email_open'
    | 'email_click'
    | 'ad_click'
    | 'social_engagement'
    | 'form_submission'
    | 'content_view'
    | 'webinar_attendance'
    | 'event_attendance'
    | 'demo_request'
    | 'other'

  /** Channel */
  channel?: MarketingChannelType

  /** Traffic source */
  source?: string

  /** Medium */
  medium?: string

  /** Campaign name */
  campaign?: string

  /** Content/variation */
  content?: string

  /** Page URL */
  pageUrl?: string

  /** Referrer URL */
  referrerUrl?: string

  /** Device type */
  device?: 'desktop' | 'mobile' | 'tablet'

  /** Location */
  location?: {
    city?: string
    region?: string
    country?: string
  }

  /** Touch point timestamp */
  timestamp: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    google_analytics?: string
    segment?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TouchPointInput = Input<TouchPoint>
export type TouchPointOutput = Output<TouchPoint>

// =============================================================================
// Journey
// =============================================================================

/**
 * Customer journey.
 *
 * @example
 * ```ts
 * const journey: Journey = {
 *   id: 'jrn_123',
 *   contactId: 'cntct_123',
 *   name: 'Onboarding Journey',
 *   status: 'active',
 *   currentStepId: 'step_2',
 *   startedAt: new Date(),
 *   completionRate: 0.4,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Journey {
  /** Unique identifier */
  id: string

  /** Contact ID */
  contactId: string

  /** Journey name/template */
  name: string

  /** Journey status */
  status: JourneyStatus

  /** Current step ID */
  currentStepId?: string

  /** Journey stage */
  stage?: 'awareness' | 'consideration' | 'decision' | 'retention' | 'advocacy'

  /** Started timestamp */
  startedAt: Date

  /** Completed timestamp */
  completedAt?: Date

  /** Abandoned timestamp */
  abandonedAt?: Date

  /** Completion rate (0-1) */
  completionRate?: number

  /** Total steps */
  totalSteps?: number

  /** Completed steps */
  completedSteps?: number

  /** Campaign ID */
  campaignId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    hubspot?: string
    marketo?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type JourneyInput = Input<Journey>
export type JourneyOutput = Output<Journey>

// =============================================================================
// JourneyStep
// =============================================================================

/**
 * Journey step.
 *
 * @example
 * ```ts
 * const journeyStep: JourneyStep = {
 *   id: 'step_123',
 *   journeyId: 'jrn_123',
 *   name: 'Welcome Email',
 *   type: 'email',
 *   order: 1,
 *   status: 'completed',
 *   completedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface JourneyStep {
  /** Unique identifier */
  id: string

  /** Journey ID */
  journeyId: string

  /** Step name */
  name: string

  /** Step type */
  type:
    | 'email'
    | 'sms'
    | 'notification'
    | 'task'
    | 'wait'
    | 'condition'
    | 'webhook'
    | 'other'

  /** Step order */
  order: number

  /** Step status */
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'failed'

  /** Delay (for wait steps) */
  delay?: {
    value: number
    unit: 'minutes' | 'hours' | 'days' | 'weeks'
  }

  /** Condition (for conditional steps) */
  condition?: {
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
    value: unknown
  }

  /** Action configuration */
  config?: Record<string, unknown>

  /** Started timestamp */
  startedAt?: Date

  /** Completed timestamp */
  completedAt?: Date

  /** Failed timestamp */
  failedAt?: Date

  /** Failure reason */
  failureReason?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type JourneyStepInput = Input<JourneyStep>
export type JourneyStepOutput = Output<JourneyStep>

// =============================================================================
// ABTest
// =============================================================================

/**
 * A/B test.
 *
 * @example
 * ```ts
 * const abTest: ABTest = {
 *   id: 'test_123',
 *   name: 'Email Subject Line Test',
 *   type: 'email',
 *   status: 'running',
 *   startDate: new Date(),
 *   sampleSize: 1000,
 *   confidenceLevel: 0.95,
 *   winner: 'variant_a',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ABTest {
  /** Unique identifier */
  id: string

  /** Test name */
  name: string

  /** Test type */
  type: 'email' | 'landing_page' | 'ad' | 'content' | 'other'

  /** Test status */
  status: ABTestStatus

  /** Hypothesis */
  hypothesis?: string

  /** Success metric */
  successMetric: 'open_rate' | 'click_rate' | 'conversion_rate' | 'revenue' | 'other'

  /** Start date */
  startDate: Date

  /** End date */
  endDate?: Date

  /** Sample size */
  sampleSize?: number

  /** Confidence level (0-1) */
  confidenceLevel?: number

  /** Statistical significance */
  significant?: boolean

  /** Winning variant ID */
  winner?: string

  /** Campaign ID */
  campaignId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    optimizely?: string
    google_optimize?: string
    vwo?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ABTestInput = Input<ABTest>
export type ABTestOutput = Output<ABTest>

// =============================================================================
// ABTestVariant
// =============================================================================

/**
 * A/B test variant.
 *
 * @example
 * ```ts
 * const variant: ABTestVariant = {
 *   id: 'variant_a',
 *   abTestId: 'test_123',
 *   name: 'Variant A - Current',
 *   isControl: true,
 *   trafficAllocation: 0.5,
 *   metrics: {
 *     impressions: 500,
 *     clicks: 75,
 *     conversions: 15,
 *     conversionRate: 0.03
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ABTestVariant {
  /** Unique identifier */
  id: string

  /** A/B test ID */
  abTestId: string

  /** Variant name */
  name: string

  /** Is control/baseline */
  isControl: boolean

  /** Traffic allocation (0-1) */
  trafficAllocation: number

  /** Variant content/config */
  content?: Record<string, unknown>

  /** Variant metrics */
  metrics?: {
    impressions?: number
    clicks?: number
    conversions?: number
    revenue?: number
    conversionRate?: number
    confidenceInterval?: {
      lower: number
      upper: number
    }
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    optimizely?: string
    google_optimize?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ABTestVariantInput = Input<ABTestVariant>
export type ABTestVariantOutput = Output<ABTestVariant>

// =============================================================================
// UTM
// =============================================================================

/**
 * UTM tracking parameters.
 *
 * @example
 * ```ts
 * const utm: UTM = {
 *   id: 'utm_123',
 *   campaignId: 'camp_123',
 *   source: 'google',
 *   medium: 'cpc',
 *   campaign: 'product_launch',
 *   term: 'saas platform',
 *   content: 'variant_a',
 *   url: 'https://example.com/product?utm_source=google&utm_medium=cpc...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface UTM {
  /** Unique identifier */
  id: string

  /** Campaign ID */
  campaignId?: string

  /** UTM source */
  source: string

  /** UTM medium */
  medium: string

  /** UTM campaign */
  campaign: string

  /** UTM term (for paid search) */
  term?: string

  /** UTM content (for A/B testing) */
  content?: string

  /** Full URL with UTM parameters */
  url?: string

  /** Short URL */
  shortUrl?: string

  /** Click count */
  clickCount?: number

  /** Conversion count */
  conversionCount?: number

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    bitly?: string
    rebrandly?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type UTMInput = Input<UTM>
export type UTMOutput = Output<UTM>

// =============================================================================
// Referral
// =============================================================================

/**
 * Referral tracking.
 *
 * @example
 * ```ts
 * const referral: Referral = {
 *   id: 'ref_123',
 *   referrerId: 'cntct_123',
 *   referredId: 'cntct_456',
 *   code: 'FRIEND20',
 *   status: 'converted',
 *   reward: {
 *     type: 'credit',
 *     amount: 20,
 *     currency: 'USD'
 *   },
 *   convertedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Referral {
  /** Unique identifier */
  id: string

  /** Referrer contact ID */
  referrerId: string

  /** Referred contact ID */
  referredId?: string

  /** Referral code */
  code: string

  /** Referral status */
  status: 'pending' | 'converted' | 'rewarded' | 'expired' | 'cancelled'

  /** Referral source */
  source?: string

  /** Campaign ID */
  campaignId?: string

  /** Reward configuration */
  reward?: {
    type: 'credit' | 'discount' | 'gift' | 'cash' | 'other'
    amount?: number
    currency?: string
    description?: string
  }

  /** Clicked timestamp */
  clickedAt?: Date

  /** Signed up timestamp */
  signedUpAt?: Date

  /** Converted timestamp */
  convertedAt?: Date

  /** Rewarded timestamp */
  rewardedAt?: Date

  /** Expiry date */
  expiresAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    referral_candy?: string
    friendbuy?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReferralInput = Input<Referral>
export type ReferralOutput = Output<Referral>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface CampaignActions extends CRUDResource<Campaign, CampaignInput> {
  /** Search campaigns */
  search: Action<{ query: string } & ListParams, PaginatedResult<Campaign>>

  /** Update status */
  updateStatus: Action<{ id: string; status: CampaignStatus }, Campaign>

  /** Get metrics */
  getMetrics: Action<{ id: string; period?: string }, Campaign['metrics']>

  /** Clone campaign */
  clone: Action<{ id: string; name?: string }, Campaign>

  /** Get assets */
  getAssets: Action<{ id: string } & ListParams, PaginatedResult<CampaignAsset>>

  /** Get performance report */
  getReport: Action<{ id: string; startDate?: Date; endDate?: Date }, Record<string, unknown>>
}

export interface CampaignAssetActions extends CRUDResource<CampaignAsset, CampaignAssetInput> {
  /** Search assets */
  search: Action<{ campaignId: string; query?: string } & ListParams, PaginatedResult<CampaignAsset>>

  /** Upload asset */
  upload: Action<{ campaignId: string; file: File }, CampaignAsset>
}

export interface MarketingChannelActions extends CRUDResource<MarketingChannel, MarketingChannelInput> {
  /** Get channel performance */
  getPerformance: Action<{ id: string; period?: string }, MarketingChannel['metrics']>

  /** Compare channels */
  compare: Action<{ marketingChannelIds: string[]; metric: string }, Array<{ marketingChannelId: string; value: number }>>
}

export interface AudienceActions extends CRUDResource<Audience, AudienceInput> {
  /** Search audiences */
  search: Action<{ query: string } & ListParams, PaginatedResult<Audience>>

  /** Sync audience */
  sync: Action<{ id: string }, Audience>

  /** Get members */
  getMembers: Action<{ id: string } & ListParams, PaginatedResult<AudienceMember>>

  /** Add members */
  addMembers: Action<{ id: string; members: AudienceMemberInput[] }, Audience>

  /** Remove members */
  removeMembers: Action<{ id: string; memberIds: string[] }, Audience>

  /** Create lookalike */
  createLookalike: Action<{ sourceId: string; name: string; size?: number }, Audience>
}

export interface AudienceMemberActions extends CRUDResource<AudienceMember, AudienceMemberInput> {
  /** Bulk import */
  bulkImport: Action<{ audienceId: string; members: AudienceMemberInput[] }, { added: number; failed: number }>

  /** Update status */
  updateStatus: Action<{ id: string; status: AudienceMember['status'] }, AudienceMember>
}

export interface EmailTemplateActions extends CRUDResource<EmailTemplate, EmailTemplateInput> {
  /** Search templates */
  search: Action<{ query: string } & ListParams, PaginatedResult<EmailTemplate>>

  /** Clone template */
  clone: Action<{ id: string; name?: string }, EmailTemplate>

  /** Preview template */
  preview: Action<{ id: string; variables?: Record<string, string> }, { html: string; text?: string }>

  /** Test send */
  testSend: Action<{ id: string; email: string; variables?: Record<string, string> }, void>
}

export interface EmailCampaignActions extends CRUDResource<EmailCampaign, EmailCampaignInput> {
  /** Search campaigns */
  search: Action<{ query: string } & ListParams, PaginatedResult<EmailCampaign>>

  /** Schedule campaign */
  schedule: Action<{ id: string; scheduledAt: Date }, EmailCampaign>

  /** Send campaign */
  send: Action<{ id: string }, EmailCampaign>

  /** Cancel campaign */
  cancel: Action<{ id: string }, EmailCampaign>

  /** Get metrics */
  getMetrics: Action<{ id: string }, EmailCampaign['metrics']>

  /** Get sends */
  getSends: Action<{ id: string } & ListParams, PaginatedResult<EmailSend>>
}

export interface EmailSendActions extends CRUDResource<EmailSend, EmailSendInput> {
  /** Get events */
  getEvents: Action<{ id: string } & ListParams, PaginatedResult<EmailEvent>>

  /** Resend */
  resend: Action<{ id: string }, EmailSend>
}

export interface EmailEventActions extends CRUDResource<EmailEvent, EmailEventInput> {
  /** Query events */
  query: Action<{ emailSendId?: string; type?: EmailEvent['type'] } & ListParams, PaginatedResult<EmailEvent>>
}

export interface LandingPageActions extends CRUDResource<LandingPage, LandingPageInput> {
  /** Search pages */
  search: Action<{ query: string } & ListParams, PaginatedResult<LandingPage>>

  /** Publish page */
  publish: Action<{ id: string }, LandingPage>

  /** Unpublish page */
  unpublish: Action<{ id: string }, LandingPage>

  /** Clone page */
  clone: Action<{ id: string; name?: string }, LandingPage>

  /** Get metrics */
  getMetrics: Action<{ id: string; startDate?: Date; endDate?: Date }, LandingPage['metrics']>
}

export interface FormActions extends CRUDResource<Form, FormInput> {
  /** Search forms */
  search: Action<{ query: string } & ListParams, PaginatedResult<Form>>

  /** Get submissions */
  getSubmissions: Action<{ id: string } & ListParams, PaginatedResult<FormSubmission>>

  /** Export submissions */
  exportSubmissions: Action<{ id: string; format: 'csv' | 'json' }, { url: string }>
}

export interface FormSubmissionActions extends CRUDResource<FormSubmission, FormSubmissionInput> {
  /** Query submissions */
  query: Action<{ formId?: string; contactId?: string } & ListParams, PaginatedResult<FormSubmission>>

  /** Update follow-up status */
  updateFollowUp: Action<{ id: string; status: FormSubmission['followUpStatus'] }, FormSubmission>
}

export interface ContentActions extends CRUDResource<Content, ContentInput> {
  /** Search content */
  search: Action<{ query: string; type?: ContentType } & ListParams, PaginatedResult<Content>>

  /** Publish content */
  publish: Action<{ id: string; publishedAt?: Date }, Content>

  /** Unpublish content */
  unpublish: Action<{ id: string }, Content>

  /** Schedule content */
  schedule: Action<{ id: string; scheduledAt: Date }, Content>

  /** Get metrics */
  getMetrics: Action<{ id: string; startDate?: Date; endDate?: Date }, Content['metrics']>
}

export interface ContentCalendarActions extends CRUDResource<ContentCalendar, ContentCalendarInput> {
  /** Get calendar view */
  getCalendar: Action<{ startDate: Date; endDate: Date }, PaginatedResult<ContentCalendar>>

  /** Update status */
  updateStatus: Action<{ id: string; status: ContentCalendar['status'] }, ContentCalendar>

  /** Assign */
  assign: Action<{ id: string; assigneeId: string }, ContentCalendar>
}

export interface SocialPostActions extends CRUDResource<SocialPost, SocialPostInput> {
  /** Search posts */
  search: Action<{ accountId?: string; platform?: SocialPost['platform'] } & ListParams, PaginatedResult<SocialPost>>

  /** Schedule post */
  schedule: Action<{ id: string; scheduledAt: Date }, SocialPost>

  /** Publish post */
  publish: Action<{ id: string }, SocialPost>

  /** Cancel post */
  cancel: Action<{ id: string }, SocialPost>

  /** Get metrics */
  getMetrics: Action<{ id: string }, SocialPost['metrics']>
}

export interface SocialAccountActions extends CRUDResource<SocialAccount, SocialAccountInput> {
  /** Connect account */
  connect: Action<{ platform: SocialAccount['platform']; accessToken: string }, SocialAccount>

  /** Disconnect account */
  disconnect: Action<{ id: string }, void>

  /** Sync account */
  sync: Action<{ id: string }, SocialAccount>

  /** Get posts */
  getPosts: Action<{ id: string } & ListParams, PaginatedResult<SocialPost>>
}

export interface AdActions extends CRUDResource<Ad, AdInput> {
  /** Search ads */
  search: Action<{ adGroupId?: string; query?: string } & ListParams, PaginatedResult<Ad>>

  /** Update status */
  updateStatus: Action<{ id: string; status: AdStatus }, Ad>

  /** Update bid */
  updateBid: Action<{ id: string; bid: Ad['bid'] }, Ad>

  /** Get metrics */
  getMetrics: Action<{ id: string; startDate?: Date; endDate?: Date }, Ad['metrics']>

  /** Clone ad */
  clone: Action<{ id: string; name?: string }, Ad>
}

export interface AdGroupActions extends CRUDResource<AdGroup, AdGroupInput> {
  /** Search ad groups */
  search: Action<{ adCampaignId?: string; query?: string } & ListParams, PaginatedResult<AdGroup>>

  /** Update status */
  updateStatus: Action<{ id: string; status: AdStatus }, AdGroup>

  /** Update targeting */
  updateTargeting: Action<{ id: string; targeting: AdGroup['targeting'] }, AdGroup>

  /** Get ads */
  getAds: Action<{ id: string } & ListParams, PaginatedResult<Ad>>
}

export interface AdCampaignActions extends CRUDResource<AdCampaign, AdCampaignInput> {
  /** Search campaigns */
  search: Action<{ platform?: AdCampaign['platform']; query?: string } & ListParams, PaginatedResult<AdCampaign>>

  /** Update status */
  updateStatus: Action<{ id: string; status: AdStatus }, AdCampaign>

  /** Get ad groups */
  getAdGroups: Action<{ id: string } & ListParams, PaginatedResult<AdGroup>>

  /** Get metrics */
  getMetrics: Action<{ id: string; startDate?: Date; endDate?: Date }, AdCampaign['metrics']>
}

export interface AttributionActions extends CRUDResource<Attribution, AttributionInput> {
  /** Query attributions */
  query: Action<{ contactId?: string; model?: AttributionModel } & ListParams, PaginatedResult<Attribution>>

  /** Calculate attribution */
  calculate: Action<{ contactId: string; model: AttributionModel; conversionType: string }, Attribution>

  /** Get report */
  getReport: Action<{ model: AttributionModel; startDate?: Date; endDate?: Date }, Record<string, unknown>>
}

export interface TouchPointActions extends CRUDResource<TouchPoint, TouchPointInput> {
  /** Query touch points */
  query: Action<{ contactId?: string; sessionId?: string } & ListParams, PaginatedResult<TouchPoint>>

  /** Get journey */
  getJourney: Action<{ contactId: string; startDate?: Date; endDate?: Date }, TouchPoint[]>
}

export interface JourneyActions extends CRUDResource<Journey, JourneyInput> {
  /** Search journeys */
  search: Action<{ contactId?: string; status?: JourneyStatus } & ListParams, PaginatedResult<Journey>>

  /** Start journey */
  start: Action<{ contactId: string; name: string }, Journey>

  /** Complete journey */
  complete: Action<{ id: string }, Journey>

  /** Abandon journey */
  abandon: Action<{ id: string }, Journey>

  /** Get steps */
  getSteps: Action<{ id: string } & ListParams, PaginatedResult<JourneyStep>>
}

export interface JourneyStepActions extends CRUDResource<JourneyStep, JourneyStepInput> {
  /** Complete step */
  complete: Action<{ id: string }, JourneyStep>

  /** Skip step */
  skip: Action<{ id: string; reason?: string }, JourneyStep>

  /** Retry step */
  retry: Action<{ id: string }, JourneyStep>
}

export interface ABTestActions extends CRUDResource<ABTest, ABTestInput> {
  /** Search tests */
  search: Action<{ type?: ABTest['type']; status?: ABTestStatus } & ListParams, PaginatedResult<ABTest>>

  /** Start test */
  start: Action<{ id: string }, ABTest>

  /** Stop test */
  stop: Action<{ id: string }, ABTest>

  /** Declare winner */
  declareWinner: Action<{ id: string; variantId: string }, ABTest>

  /** Get variants */
  getVariants: Action<{ id: string }, ABTestVariant[]>

  /** Get results */
  getResults: Action<{ id: string }, Record<string, unknown>>
}

export interface ABTestVariantActions extends CRUDResource<ABTestVariant, ABTestVariantInput> {
  /** Update allocation */
  updateAllocation: Action<{ id: string; trafficAllocation: number }, ABTestVariant>

  /** Get metrics */
  getMetrics: Action<{ id: string }, ABTestVariant['metrics']>
}

export interface UTMActions extends CRUDResource<UTM, UTMInput> {
  /** Search UTMs */
  search: Action<{ campaignId?: string; query?: string } & ListParams, PaginatedResult<UTM>>

  /** Generate URL */
  generateUrl: Action<{ baseUrl: string; utm: Partial<UTM> }, UTM>

  /** Shorten URL */
  shortenUrl: Action<{ id: string }, UTM>

  /** Get analytics */
  getAnalytics: Action<{ id: string; startDate?: Date; endDate?: Date }, Record<string, unknown>>
}

export interface ReferralActions extends CRUDResource<Referral, ReferralInput> {
  /** Search referrals */
  search: Action<{ referrerId?: string; status?: Referral['status'] } & ListParams, PaginatedResult<Referral>>

  /** Generate code */
  generateCode: Action<{ referrerId: string; campaignId?: string }, Referral>

  /** Track click */
  trackClick: Action<{ code: string; source?: string }, Referral>

  /** Convert referral */
  convert: Action<{ id: string; referredId: string }, Referral>

  /** Reward referral */
  reward: Action<{ id: string }, Referral>

  /** Get leaderboard */
  getLeaderboard: Action<{ limit?: number; period?: string }, Array<{ referrerId: string; conversions: number }>>
}

// =============================================================================
// Events
// =============================================================================

export interface CampaignEvents {
  created: BaseEvent<'campaign.created', Campaign>
  updated: BaseEvent<'campaign.updated', Campaign>
  deleted: BaseEvent<'campaign.deleted', { id: string }>
  status_changed: BaseEvent<'campaign.status_changed', { campaignId: string; oldStatus: CampaignStatus; newStatus: CampaignStatus }>
  started: BaseEvent<'campaign.started', Campaign>
  completed: BaseEvent<'campaign.completed', Campaign>
  budget_exceeded: BaseEvent<'campaign.budget_exceeded', { campaignId: string; budget: number; spent: number }>
}

export interface CampaignAssetEvents {
  created: BaseEvent<'campaign_asset.created', CampaignAsset>
  updated: BaseEvent<'campaign_asset.updated', CampaignAsset>
  deleted: BaseEvent<'campaign_asset.deleted', { id: string }>
  uploaded: BaseEvent<'campaign_asset.uploaded', CampaignAsset>
}

export interface MarketingChannelEvents {
  created: BaseEvent<'marketing_channel.created', MarketingChannel>
  updated: BaseEvent<'marketing_channel.updated', MarketingChannel>
  deleted: BaseEvent<'marketing_channel.deleted', { id: string }>
  performance_updated: BaseEvent<'marketing_channel.performance_updated', { marketingChannelId: string; metrics: MarketingChannel['metrics'] }>
}

export interface AudienceEvents {
  created: BaseEvent<'audience.created', Audience>
  updated: BaseEvent<'audience.updated', Audience>
  deleted: BaseEvent<'audience.deleted', { id: string }>
  synced: BaseEvent<'audience.synced', { audienceId: string; size: number }>
  member_added: BaseEvent<'audience.member_added', { audienceId: string; memberId: string }>
  member_removed: BaseEvent<'audience.member_removed', { audienceId: string; memberId: string }>
}

export interface AudienceMemberEvents {
  created: BaseEvent<'audience_member.created', AudienceMember>
  updated: BaseEvent<'audience_member.updated', AudienceMember>
  deleted: BaseEvent<'audience_member.deleted', { id: string }>
  status_changed: BaseEvent<'audience_member.status_changed', { memberId: string; oldStatus: string; newStatus: string }>
}

export interface EmailTemplateEvents {
  created: BaseEvent<'email_template.created', EmailTemplate>
  updated: BaseEvent<'email_template.updated', EmailTemplate>
  deleted: BaseEvent<'email_template.deleted', { id: string }>
  cloned: BaseEvent<'email_template.cloned', { sourceId: string; newTemplate: EmailTemplate }>
}

export interface EmailCampaignEvents {
  created: BaseEvent<'email_campaign.created', EmailCampaign>
  updated: BaseEvent<'email_campaign.updated', EmailCampaign>
  deleted: BaseEvent<'email_campaign.deleted', { id: string }>
  scheduled: BaseEvent<'email_campaign.scheduled', EmailCampaign>
  sent: BaseEvent<'email_campaign.sent', EmailCampaign>
  cancelled: BaseEvent<'email_campaign.cancelled', { campaignId: string }>
}

export interface EmailSendEvents {
  created: BaseEvent<'email_send.created', EmailSend>
  updated: BaseEvent<'email_send.updated', EmailSend>
  sent: BaseEvent<'email_send.sent', EmailSend>
  delivered: BaseEvent<'email_send.delivered', EmailSend>
  opened: BaseEvent<'email_send.opened', EmailSend>
  clicked: BaseEvent<'email_send.clicked', EmailSend>
  bounced: BaseEvent<'email_send.bounced', EmailSend>
}

export interface EmailEventEvents {
  created: BaseEvent<'email_event.created', EmailEvent>
}

export interface LandingPageEvents {
  created: BaseEvent<'landing_page.created', LandingPage>
  updated: BaseEvent<'landing_page.updated', LandingPage>
  deleted: BaseEvent<'landing_page.deleted', { id: string }>
  published: BaseEvent<'landing_page.published', LandingPage>
  unpublished: BaseEvent<'landing_page.unpublished', { pageId: string }>
}

export interface FormEvents {
  created: BaseEvent<'form.created', Form>
  updated: BaseEvent<'form.updated', Form>
  deleted: BaseEvent<'form.deleted', { id: string }>
  submitted: BaseEvent<'form.submitted', { formId: string; submission: FormSubmission }>
}

export interface FormSubmissionEvents {
  created: BaseEvent<'form_submission.created', FormSubmission>
  updated: BaseEvent<'form_submission.updated', FormSubmission>
  deleted: BaseEvent<'form_submission.deleted', { id: string }>
  follow_up_updated: BaseEvent<'form_submission.follow_up_updated', { submissionId: string; status: string }>
}

export interface ContentEvents {
  created: BaseEvent<'content.created', Content>
  updated: BaseEvent<'content.updated', Content>
  deleted: BaseEvent<'content.deleted', { id: string }>
  published: BaseEvent<'content.published', Content>
  unpublished: BaseEvent<'content.unpublished', { contentId: string }>
  scheduled: BaseEvent<'content.scheduled', { contentId: string; scheduledAt: Date }>
}

export interface ContentCalendarEvents {
  created: BaseEvent<'content_calendar.created', ContentCalendar>
  updated: BaseEvent<'content_calendar.updated', ContentCalendar>
  deleted: BaseEvent<'content_calendar.deleted', { id: string }>
  status_changed: BaseEvent<'content_calendar.status_changed', { entryId: string; oldStatus: string; newStatus: string }>
  assigned: BaseEvent<'content_calendar.assigned', { entryId: string; assigneeId: string }>
}

export interface SocialPostEvents {
  created: BaseEvent<'social_post.created', SocialPost>
  updated: BaseEvent<'social_post.updated', SocialPost>
  deleted: BaseEvent<'social_post.deleted', { id: string }>
  scheduled: BaseEvent<'social_post.scheduled', SocialPost>
  published: BaseEvent<'social_post.published', SocialPost>
  failed: BaseEvent<'social_post.failed', { postId: string; reason: string }>
}

export interface SocialAccountEvents {
  created: BaseEvent<'social_account.created', SocialAccount>
  updated: BaseEvent<'social_account.updated', SocialAccount>
  deleted: BaseEvent<'social_account.deleted', { id: string }>
  connected: BaseEvent<'social_account.connected', SocialAccount>
  disconnected: BaseEvent<'social_account.disconnected', { accountId: string }>
  synced: BaseEvent<'social_account.synced', { accountId: string; followers: number }>
}

export interface AdEvents {
  created: BaseEvent<'ad.created', Ad>
  updated: BaseEvent<'ad.updated', Ad>
  deleted: BaseEvent<'ad.deleted', { id: string }>
  status_changed: BaseEvent<'ad.status_changed', { adId: string; oldStatus: AdStatus; newStatus: AdStatus }>
  bid_updated: BaseEvent<'ad.bid_updated', { adId: string; bid: Ad['bid'] }>
}

export interface AdGroupEvents {
  created: BaseEvent<'ad_group.created', AdGroup>
  updated: BaseEvent<'ad_group.updated', AdGroup>
  deleted: BaseEvent<'ad_group.deleted', { id: string }>
  status_changed: BaseEvent<'ad_group.status_changed', { adGroupId: string; oldStatus: AdStatus; newStatus: AdStatus }>
}

export interface AdCampaignEvents {
  created: BaseEvent<'ad_campaign.created', AdCampaign>
  updated: BaseEvent<'ad_campaign.updated', AdCampaign>
  deleted: BaseEvent<'ad_campaign.deleted', { id: string }>
  status_changed: BaseEvent<'ad_campaign.status_changed', { campaignId: string; oldStatus: AdStatus; newStatus: AdStatus }>
  budget_exceeded: BaseEvent<'ad_campaign.budget_exceeded', { campaignId: string; budget: number; spent: number }>
}

export interface AttributionEvents {
  created: BaseEvent<'attribution.created', Attribution>
  calculated: BaseEvent<'attribution.calculated', Attribution>
}

export interface TouchPointEvents {
  created: BaseEvent<'touch_point.created', TouchPoint>
}

export interface JourneyEvents {
  created: BaseEvent<'journey.created', Journey>
  updated: BaseEvent<'journey.updated', Journey>
  deleted: BaseEvent<'journey.deleted', { id: string }>
  started: BaseEvent<'journey.started', Journey>
  completed: BaseEvent<'journey.completed', Journey>
  abandoned: BaseEvent<'journey.abandoned', Journey>
  step_completed: BaseEvent<'journey.step_completed', { journeyId: string; stepId: string }>
}

export interface JourneyStepEvents {
  created: BaseEvent<'journey_step.created', JourneyStep>
  updated: BaseEvent<'journey_step.updated', JourneyStep>
  deleted: BaseEvent<'journey_step.deleted', { id: string }>
  completed: BaseEvent<'journey_step.completed', JourneyStep>
  skipped: BaseEvent<'journey_step.skipped', { stepId: string; reason?: string }>
  failed: BaseEvent<'journey_step.failed', { stepId: string; reason: string }>
}

export interface ABTestEvents {
  created: BaseEvent<'ab_test.created', ABTest>
  updated: BaseEvent<'ab_test.updated', ABTest>
  deleted: BaseEvent<'ab_test.deleted', { id: string }>
  started: BaseEvent<'ab_test.started', ABTest>
  stopped: BaseEvent<'ab_test.stopped', ABTest>
  winner_declared: BaseEvent<'ab_test.winner_declared', { testId: string; winnerId: string }>
}

export interface ABTestVariantEvents {
  created: BaseEvent<'ab_test_variant.created', ABTestVariant>
  updated: BaseEvent<'ab_test_variant.updated', ABTestVariant>
  deleted: BaseEvent<'ab_test_variant.deleted', { id: string }>
}

export interface UTMEvents {
  created: BaseEvent<'utm.created', UTM>
  updated: BaseEvent<'utm.updated', UTM>
  deleted: BaseEvent<'utm.deleted', { id: string }>
  clicked: BaseEvent<'utm.clicked', { utmId: string; clickCount: number }>
}

export interface ReferralEvents {
  created: BaseEvent<'referral.created', Referral>
  updated: BaseEvent<'referral.updated', Referral>
  deleted: BaseEvent<'referral.deleted', { id: string }>
  clicked: BaseEvent<'referral.clicked', Referral>
  converted: BaseEvent<'referral.converted', Referral>
  rewarded: BaseEvent<'referral.rewarded', Referral>
}

// =============================================================================
// Resources
// =============================================================================

export interface CampaignResource extends CampaignActions {
  on: <K extends keyof CampaignEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CampaignEvents[K], TProxy>
  ) => () => void
}

export interface CampaignAssetResource extends CampaignAssetActions {
  on: <K extends keyof CampaignAssetEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CampaignAssetEvents[K], TProxy>
  ) => () => void
}

export interface MarketingChannelResource extends MarketingChannelActions {
  on: <K extends keyof MarketingChannelEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MarketingChannelEvents[K], TProxy>
  ) => () => void
}

export interface AudienceResource extends AudienceActions {
  on: <K extends keyof AudienceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AudienceEvents[K], TProxy>
  ) => () => void
}

export interface AudienceMemberResource extends AudienceMemberActions {
  on: <K extends keyof AudienceMemberEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AudienceMemberEvents[K], TProxy>
  ) => () => void
}

export interface EmailTemplateResource extends EmailTemplateActions {
  on: <K extends keyof EmailTemplateEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailTemplateEvents[K], TProxy>
  ) => () => void
}

export interface EmailCampaignResource extends EmailCampaignActions {
  on: <K extends keyof EmailCampaignEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailCampaignEvents[K], TProxy>
  ) => () => void
}

export interface EmailSendResource extends EmailSendActions {
  on: <K extends keyof EmailSendEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailSendEvents[K], TProxy>
  ) => () => void
}

export interface EmailEventResource extends EmailEventActions {
  on: <K extends keyof EmailEventEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailEventEvents[K], TProxy>
  ) => () => void
}

export interface LandingPageResource extends LandingPageActions {
  on: <K extends keyof LandingPageEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LandingPageEvents[K], TProxy>
  ) => () => void
}

export interface FormResource extends FormActions {
  on: <K extends keyof FormEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FormEvents[K], TProxy>
  ) => () => void
}

export interface FormSubmissionResource extends FormSubmissionActions {
  on: <K extends keyof FormSubmissionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FormSubmissionEvents[K], TProxy>
  ) => () => void
}

export interface ContentResource extends ContentActions {
  on: <K extends keyof ContentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContentEvents[K], TProxy>
  ) => () => void
}

export interface ContentCalendarResource extends ContentCalendarActions {
  on: <K extends keyof ContentCalendarEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContentCalendarEvents[K], TProxy>
  ) => () => void
}

export interface SocialPostResource extends SocialPostActions {
  on: <K extends keyof SocialPostEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SocialPostEvents[K], TProxy>
  ) => () => void
}

export interface SocialAccountResource extends SocialAccountActions {
  on: <K extends keyof SocialAccountEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SocialAccountEvents[K], TProxy>
  ) => () => void
}

export interface AdResource extends AdActions {
  on: <K extends keyof AdEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AdEvents[K], TProxy>
  ) => () => void
}

export interface AdGroupResource extends AdGroupActions {
  on: <K extends keyof AdGroupEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AdGroupEvents[K], TProxy>
  ) => () => void
}

export interface AdCampaignResource extends AdCampaignActions {
  on: <K extends keyof AdCampaignEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AdCampaignEvents[K], TProxy>
  ) => () => void
}

export interface AttributionResource extends AttributionActions {
  on: <K extends keyof AttributionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AttributionEvents[K], TProxy>
  ) => () => void
}

export interface TouchPointResource extends TouchPointActions {
  on: <K extends keyof TouchPointEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TouchPointEvents[K], TProxy>
  ) => () => void
}

export interface JourneyResource extends JourneyActions {
  on: <K extends keyof JourneyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<JourneyEvents[K], TProxy>
  ) => () => void
}

export interface JourneyStepResource extends JourneyStepActions {
  on: <K extends keyof JourneyStepEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<JourneyStepEvents[K], TProxy>
  ) => () => void
}

export interface ABTestResource extends ABTestActions {
  on: <K extends keyof ABTestEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ABTestEvents[K], TProxy>
  ) => () => void
}

export interface ABTestVariantResource extends ABTestVariantActions {
  on: <K extends keyof ABTestVariantEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ABTestVariantEvents[K], TProxy>
  ) => () => void
}

export interface UTMResource extends UTMActions {
  on: <K extends keyof UTMEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<UTMEvents[K], TProxy>
  ) => () => void
}

export interface ReferralResource extends ReferralActions {
  on: <K extends keyof ReferralEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReferralEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Marketing Proxy (unified interface)
// =============================================================================

/**
 * Complete Marketing & Growth interface combining all resources.
 *
 * @example
 * ```ts
 * const marketing: MarketingProxy = getMarketingProxy()
 *
 * // Create a campaign
 * const campaign = await marketing.campaigns.create({
 *   name: 'Q1 Product Launch',
 *   type: 'email',
 *   status: 'draft'
 * })
 *
 * // Subscribe to events
 * marketing.campaigns.on('created', (event, ctx) => {
 *   console.log('New campaign:', event.data.name)
 * })
 *
 * // Create an email campaign
 * const emailCampaign = await marketing.emailCampaigns.create({
 *   campaignId: campaign.id,
 *   name: 'Product Launch Announcement',
 *   templateId: 'tmpl_123',
 *   audienceId: 'aud_123'
 * })
 * ```
 */
export interface MarketingProxy {
  campaigns: CampaignResource
  campaignAssets: CampaignAssetResource
  channels: MarketingChannelResource
  audiences: AudienceResource
  audienceMembers: AudienceMemberResource
  emailTemplates: EmailTemplateResource
  emailCampaigns: EmailCampaignResource
  emailSends: EmailSendResource
  emailEvents: EmailEventResource
  landingPages: LandingPageResource
  forms: FormResource
  formSubmissions: FormSubmissionResource
  content: ContentResource
  contentCalendar: ContentCalendarResource
  socialPosts: SocialPostResource
  socialAccounts: SocialAccountResource
  ads: AdResource
  adGroups: AdGroupResource
  adCampaigns: AdCampaignResource
  attributions: AttributionResource
  touchPoints: TouchPointResource
  journeys: JourneyResource
  journeySteps: JourneyStepResource
  abTests: ABTestResource
  abTestVariants: ABTestVariantResource
  utms: UTMResource
  referrals: ReferralResource
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported marketing providers.
 */
export type MarketingProvider =
  | 'mailchimp'
  | 'hubspot'
  | 'marketo'
  | 'sendgrid'
  | 'postmark'
  | 'google_ads'
  | 'facebook_ads'
  | 'linkedin_ads'
  | 'twitter_ads'
  | 'google_analytics'
  | 'mixpanel'
  | 'amplitude'
  | 'segment'
  | 'hootsuite'
  | 'buffer'

/**
 * Provider configuration.
 */
export interface MarketingProviderConfig {
  provider: MarketingProvider
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  accountId?: string
  apiVersion?: string
}
