/**
 * Support & Customer Success Tool Types
 *
 * Types for customer support and success integrations:
 * Ticket, Queue, Agent, SLA, Knowledge Base, Automation, CSAT, NPS, Health Score.
 *
 * @module support
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
// Ticket
// =============================================================================

/**
 * Ticket status.
 */
export type TicketStatus = 'new' | 'open' | 'pending' | 'on_hold' | 'solved' | 'closed'

/**
 * Ticket priority level.
 */
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

/**
 * Ticket type/category.
 */
export type TicketType = 'question' | 'incident' | 'problem' | 'feature_request' | 'bug' | 'task'

/**
 * Customer support ticket.
 *
 * @example
 * ```ts
 * const ticket: Ticket = {
 *   id: 'tkt_123',
 *   number: 1042,
 *   subject: 'Cannot login to account',
 *   description: 'Getting error when trying to login...',
 *   status: 'open',
 *   priority: 'high',
 *   type: 'incident',
 *   customerId: 'cus_123',
 *   assigneeId: 'agent_456',
 *   queueId: 'queue_789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Ticket {
  /** Unique identifier */
  id: string

  /** Ticket number (auto-incrementing) */
  number?: number

  /** Ticket subject/title */
  subject: string

  /** Ticket description/body */
  description: string

  /** Current status */
  status: TicketStatus

  /** Priority level */
  priority: TicketPriority

  /** Ticket type */
  type: TicketType

  /** Customer/requester ID */
  customerId: string

  /** Customer email */
  customerEmail?: string

  /** Customer name */
  customerName?: string

  /** Assigned agent ID */
  assigneeId?: string

  /** Support queue/group */
  queueId?: string

  /** Channel of origin */
  channel?: 'email' | 'chat' | 'phone' | 'web' | 'api' | 'social'

  /** Related tickets */
  relatedTicketIds?: string[]

  /** Merged into ticket ID (if merged) */
  mergedIntoId?: string

  /** Parent ticket ID (for sub-tickets) */
  parentTicketId?: string

  /** SLA policy ID */
  slaPolicyId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Time tracking */
  timeTracking?: {
    /** Time spent (minutes) */
    timeSpent?: number
    /** Billable time (minutes) */
    billableTime?: number
  }

  /** First response timestamp */
  firstRespondedAt?: Date

  /** Resolution timestamp */
  resolvedAt?: Date

  /** Due date */
  dueAt?: Date

  /** Last activity timestamp */
  lastActivityAt?: Date

  /** Satisfaction rating */
  satisfactionRating?: {
    score: number
    comment?: string
    ratedAt: Date
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs for various platforms */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TicketInput = Input<Ticket>
export type TicketOutput = Output<Ticket>

// =============================================================================
// TicketComment
// =============================================================================

/**
 * Ticket comment/reply.
 *
 * @example
 * ```ts
 * const comment: TicketComment = {
 *   id: 'cmt_123',
 *   ticketId: 'tkt_123',
 *   body: 'Thank you for contacting support...',
 *   authorId: 'agent_456',
 *   isPublic: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TicketComment {
  /** Unique identifier */
  id: string

  /** Ticket ID */
  ticketId: string

  /** Comment body/content */
  body: string

  /** Body in HTML format */
  bodyHtml?: string

  /** Author ID (agent or customer) */
  authorId: string

  /** Author type */
  authorType?: 'agent' | 'customer' | 'system'

  /** Public or internal note */
  isPublic: boolean

  /** Attachments */
  attachments?: Array<{
    id: string
    filename: string
    contentType: string
    size: number
    url: string
  }>

  /** Via channel */
  via?: 'email' | 'chat' | 'phone' | 'web' | 'api'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TicketCommentInput = Input<TicketComment>
export type TicketCommentOutput = Output<TicketComment>

// =============================================================================
// TicketTag
// =============================================================================

/**
 * Tag for categorizing tickets.
 *
 * @example
 * ```ts
 * const tag: TicketTag = {
 *   id: 'tag_123',
 *   name: 'billing',
 *   color: '#FF5733',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TicketTag {
  /** Unique identifier */
  id: string

  /** Tag name */
  name: string

  /** Tag description */
  description?: string

  /** Tag color (hex) */
  color?: string

  /** Usage count */
  count?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TicketTagInput = Input<TicketTag>
export type TicketTagOutput = Output<TicketTag>

// =============================================================================
// Queue
// =============================================================================

/**
 * Support queue/team.
 *
 * @example
 * ```ts
 * const queue: Queue = {
 *   id: 'queue_123',
 *   name: 'Tier 1 Support',
 *   description: 'First line of support',
 *   email: 'support@example.com',
 *   agentIds: ['agent_1', 'agent_2'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Queue {
  /** Unique identifier */
  id: string

  /** Queue name */
  name: string

  /** Queue description */
  description?: string

  /** Queue email address */
  email?: string

  /** Member agent IDs */
  agentIds?: string[]

  /** Default assignee (round-robin, etc) */
  defaultAssignmentMode?: 'round_robin' | 'load_balanced' | 'manual'

  /** SLA policy ID */
  slaPolicyId?: string

  /** Business hours */
  businessHours?: {
    timezone: string
    schedule: Record<string, { start: string; end: string }>
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type QueueInput = Input<Queue>
export type QueueOutput = Output<Queue>

// =============================================================================
// Agent
// =============================================================================

/**
 * Agent status.
 */
export type AgentStatus = 'available' | 'busy' | 'away' | 'offline'

/**
 * Support agent/representative.
 *
 * @example
 * ```ts
 * const agent: Agent = {
 *   id: 'agent_123',
 *   userId: 'user_123',
 *   email: 'agent@example.com',
 *   name: 'Jane Smith',
 *   status: 'available',
 *   role: 'agent',
 *   queueIds: ['queue_1', 'queue_2'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Agent {
  /** Unique identifier */
  id: string

  /** User ID (if linked to user account) */
  userId?: string

  /** Email address */
  email: string

  /** Full name */
  name: string

  /** Agent status */
  status: AgentStatus

  /** Role/level */
  role?: 'agent' | 'lead' | 'manager' | 'admin'

  /** Avatar URL */
  avatar?: string

  /** Queue memberships */
  queueIds?: string[]

  /** Agent groups */
  groupIds?: string[]

  /** Signature */
  signature?: string

  /** Skills/specialties */
  skills?: string[]

  /** Performance metrics */
  metrics?: {
    /** Total tickets handled */
    totalTickets?: number
    /** Average resolution time (minutes) */
    avgResolutionTime?: number
    /** Customer satisfaction score */
    csatScore?: number
    /** First response time (minutes) */
    avgFirstResponseTime?: number
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AgentInput = Input<Agent>
export type AgentOutput = Output<Agent>

// =============================================================================
// AgentGroup
// =============================================================================

/**
 * Agent team/group.
 *
 * @example
 * ```ts
 * const group: AgentGroup = {
 *   id: 'grp_123',
 *   name: 'Enterprise Support',
 *   agentIds: ['agent_1', 'agent_2'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface AgentGroup {
  /** Unique identifier */
  id: string

  /** Group name */
  name: string

  /** Group description */
  description?: string

  /** Member agent IDs */
  agentIds?: string[]

  /** Group lead ID */
  leadId?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AgentGroupInput = Input<AgentGroup>
export type AgentGroupOutput = Output<AgentGroup>

// =============================================================================
// SLA
// =============================================================================

/**
 * SLA status.
 */
export type SLAStatus = 'active' | 'breached' | 'paused' | 'achieved'

/**
 * Service Level Agreement instance.
 *
 * @example
 * ```ts
 * const sla: SLA = {
 *   id: 'sla_123',
 *   ticketId: 'tkt_123',
 *   policyId: 'policy_123',
 *   status: 'active',
 *   firstResponseDueAt: new Date('2024-01-15T10:00:00Z'),
 *   resolutionDueAt: new Date('2024-01-15T18:00:00Z'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SLA {
  /** Unique identifier */
  id: string

  /** Ticket ID */
  ticketId: string

  /** SLA policy ID */
  policyId: string

  /** Current status */
  status: SLAStatus

  /** First response due date */
  firstResponseDueAt?: Date

  /** First response achieved date */
  firstResponseAchievedAt?: Date

  /** Resolution due date */
  resolutionDueAt?: Date

  /** Resolution achieved date */
  resolutionAchievedAt?: Date

  /** Time paused (minutes) */
  pausedTime?: number

  /** Breach events */
  breaches?: Array<{
    metric: 'first_response' | 'resolution'
    breachedAt: Date
  }>

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SLAInput = Input<SLA>
export type SLAOutput = Output<SLA>

// =============================================================================
// SLAPolicy
// =============================================================================

/**
 * SLA policy/configuration.
 *
 * @example
 * ```ts
 * const policy: SLAPolicy = {
 *   id: 'policy_123',
 *   name: 'Premium Support SLA',
 *   description: 'SLA for premium customers',
 *   targets: {
 *     firstResponse: { urgent: 60, high: 240, normal: 480, low: 1440 },
 *     resolution: { urgent: 480, high: 1440, normal: 2880, low: 5760 }
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SLAPolicy {
  /** Unique identifier */
  id: string

  /** Policy name */
  name: string

  /** Policy description */
  description?: string

  /** Target times by priority (in minutes) */
  targets: {
    /** First response targets */
    firstResponse?: {
      urgent?: number
      high?: number
      normal?: number
      low?: number
      critical?: number
    }
    /** Resolution targets */
    resolution?: {
      urgent?: number
      high?: number
      normal?: number
      low?: number
      critical?: number
    }
  }

  /** Business hours only */
  businessHoursOnly?: boolean

  /** Business hours configuration */
  businessHours?: {
    timezone: string
    schedule: Record<string, { start: string; end: string }>
  }

  /** Active/inactive */
  isActive?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SLAPolicyInput = Input<SLAPolicy>
export type SLAPolicyOutput = Output<SLAPolicy>

// =============================================================================
// Escalation
// =============================================================================

/**
 * Escalation level.
 */
export type EscalationLevel = 'level_1' | 'level_2' | 'level_3' | 'executive'

/**
 * Ticket escalation record.
 *
 * @example
 * ```ts
 * const escalation: Escalation = {
 *   id: 'esc_123',
 *   ticketId: 'tkt_123',
 *   level: 'level_2',
 *   reason: 'SLA breach imminent',
 *   escalatedToId: 'agent_manager',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Escalation {
  /** Unique identifier */
  id: string

  /** Ticket ID */
  ticketId: string

  /** Escalation level */
  level: EscalationLevel

  /** Reason for escalation */
  reason: string

  /** Escalated to agent/group */
  escalatedToId?: string

  /** Escalated to type */
  escalatedToType?: 'agent' | 'group' | 'queue'

  /** Escalated by agent */
  escalatedById?: string

  /** Escalation rule that triggered */
  ruleId?: string

  /** Resolved */
  resolved?: boolean

  /** Resolution timestamp */
  resolvedAt?: Date

  /** Resolution notes */
  resolutionNotes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EscalationInput = Input<Escalation>
export type EscalationOutput = Output<Escalation>

// =============================================================================
// EscalationRule
// =============================================================================

/**
 * Automated escalation rule.
 *
 * @example
 * ```ts
 * const rule: EscalationRule = {
 *   id: 'rule_123',
 *   name: 'Urgent Ticket Escalation',
 *   conditions: {
 *     priority: ['urgent', 'critical'],
 *     status: ['open'],
 *     noResponseTime: 120
 *   },
 *   actions: {
 *     escalateTo: 'queue_senior',
 *     level: 'level_2'
 *   },
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EscalationRule {
  /** Unique identifier */
  id: string

  /** Rule name */
  name: string

  /** Rule description */
  description?: string

  /** Trigger conditions */
  conditions: {
    /** Priority levels */
    priority?: TicketPriority[]
    /** Ticket status */
    status?: TicketStatus[]
    /** Time since creation (minutes) */
    timeSinceCreation?: number
    /** Time without response (minutes) */
    noResponseTime?: number
    /** SLA breach */
    slaBreached?: boolean
    /** Tags */
    tags?: string[]
    /** Custom field conditions */
    customFields?: Record<string, unknown>
  }

  /** Escalation actions */
  actions: {
    /** Escalate to agent/group/queue */
    escalateTo?: string
    /** Escalate to type */
    escalateToType?: 'agent' | 'group' | 'queue'
    /** Escalation level */
    level: EscalationLevel
    /** Notification recipients */
    notifyIds?: string[]
  }

  /** Rule enabled */
  isActive: boolean

  /** Execution order/priority */
  priority?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EscalationRuleInput = Input<EscalationRule>
export type EscalationRuleOutput = Output<EscalationRule>

// =============================================================================
// KnowledgeBase
// =============================================================================

/**
 * Knowledge base/help center.
 *
 * @example
 * ```ts
 * const kb: KnowledgeBase = {
 *   id: 'kb_123',
 *   name: 'Help Center',
 *   description: 'Customer self-service portal',
 *   url: 'https://help.example.com',
 *   locale: 'en',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface KnowledgeBase {
  /** Unique identifier */
  id: string

  /** Knowledge base name */
  name: string

  /** Description */
  description?: string

  /** Public URL */
  url?: string

  /** Default locale */
  locale?: string

  /** Supported locales */
  locales?: string[]

  /** Branding/theme */
  theme?: {
    primaryColor?: string
    logo?: string
    favicon?: string
  }

  /** SEO settings */
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type KnowledgeBaseInput = Input<KnowledgeBase>
export type KnowledgeBaseOutput = Output<KnowledgeBase>

// =============================================================================
// Article
// =============================================================================

/**
 * Article status.
 */
export type ArticleStatus = 'draft' | 'published' | 'archived'

/**
 * Knowledge base article.
 *
 * @example
 * ```ts
 * const article: Article = {
 *   id: 'art_123',
 *   knowledgeBaseId: 'kb_123',
 *   title: 'How to reset your password',
 *   body: 'To reset your password, follow these steps...',
 *   status: 'published',
 *   categoryId: 'cat_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Article {
  /** Unique identifier */
  id: string

  /** Knowledge base ID */
  knowledgeBaseId: string

  /** Article title */
  title: string

  /** Article body (HTML or markdown) */
  body: string

  /** Article summary/excerpt */
  summary?: string

  /** Publication status */
  status: ArticleStatus

  /** Category ID */
  categoryId?: string

  /** Author ID */
  authorId?: string

  /** Locale */
  locale?: string

  /** Slug/URL path */
  slug?: string

  /** Tags */
  tags?: string[]

  /** Related article IDs */
  relatedArticleIds?: string[]

  /** SEO metadata */
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
  }

  /** View count */
  viewCount?: number

  /** Helpful votes */
  helpfulCount?: number

  /** Not helpful votes */
  notHelpfulCount?: number

  /** Featured article */
  isFeatured?: boolean

  /** Published timestamp */
  publishedAt?: Date

  /** Archived timestamp */
  archivedAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ArticleInput = Input<Article>
export type ArticleOutput = Output<Article>

// =============================================================================
// ArticleCategory
// =============================================================================

/**
 * Article category/section.
 *
 * @example
 * ```ts
 * const category: ArticleCategory = {
 *   id: 'cat_123',
 *   knowledgeBaseId: 'kb_123',
 *   name: 'Getting Started',
 *   description: 'Articles for new users',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ArticleCategory {
  /** Unique identifier */
  id: string

  /** Knowledge base ID */
  knowledgeBaseId: string

  /** Category name */
  name: string

  /** Category description */
  description?: string

  /** Slug/URL path */
  slug?: string

  /** Parent category ID */
  parentCategoryId?: string

  /** Display order */
  position?: number

  /** Icon */
  icon?: string

  /** Locale */
  locale?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ArticleCategoryInput = Input<ArticleCategory>
export type ArticleCategoryOutput = Output<ArticleCategory>

// =============================================================================
// ArticleFeedback
// =============================================================================

/**
 * Article feedback/rating.
 *
 * @example
 * ```ts
 * const feedback: ArticleFeedback = {
 *   id: 'fb_123',
 *   articleId: 'art_123',
 *   helpful: true,
 *   comment: 'Very clear instructions!',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ArticleFeedback {
  /** Unique identifier */
  id: string

  /** Article ID */
  articleId: string

  /** User ID (if authenticated) */
  userId?: string

  /** Helpful or not */
  helpful: boolean

  /** Optional comment */
  comment?: string

  /** Rating (1-5) */
  rating?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ArticleFeedbackInput = Input<ArticleFeedback>
export type ArticleFeedbackOutput = Output<ArticleFeedback>

// =============================================================================
// Macro
// =============================================================================

/**
 * Response macro/template.
 *
 * @example
 * ```ts
 * const macro: Macro = {
 *   id: 'macro_123',
 *   name: 'Welcome Email',
 *   subject: 'Welcome to our service!',
 *   body: 'Thank you for contacting us...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Macro {
  /** Unique identifier */
  id: string

  /** Macro name */
  name: string

  /** Macro description */
  description?: string

  /** Subject template (for emails) */
  subject?: string

  /** Body template */
  body: string

  /** Category/folder */
  category?: string

  /** Actions to perform */
  actions?: {
    /** Set status */
    setStatus?: TicketStatus
    /** Set priority */
    setPriority?: TicketPriority
    /** Add tags */
    addTags?: string[]
    /** Assign to */
    assignTo?: string
  }

  /** Available to agents */
  agentIds?: string[]

  /** Available to groups */
  groupIds?: string[]

  /** Usage count */
  usageCount?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MacroInput = Input<Macro>
export type MacroOutput = Output<Macro>

// =============================================================================
// Trigger
// =============================================================================

/**
 * Automation trigger/workflow.
 *
 * @example
 * ```ts
 * const trigger: Trigger = {
 *   id: 'trig_123',
 *   name: 'Auto-assign urgent tickets',
 *   conditions: {
 *     priority: ['urgent'],
 *     status: ['new']
 *   },
 *   actions: {
 *     assignTo: 'queue_urgent',
 *     setPriority: 'urgent'
 *   },
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Trigger {
  /** Unique identifier */
  id: string

  /** Trigger name */
  name: string

  /** Trigger description */
  description?: string

  /** Trigger conditions */
  conditions: {
    /** Priority match */
    priority?: TicketPriority[]
    /** Status match */
    status?: TicketStatus[]
    /** Type match */
    type?: TicketType[]
    /** Tags match (any/all) */
    tags?: {
      mode: 'any' | 'all'
      values: string[]
    }
    /** Channel match */
    channel?: Array<'email' | 'chat' | 'phone' | 'web' | 'api' | 'social'>
    /** Custom field conditions */
    customFields?: Record<string, unknown>
  }

  /** Actions to perform */
  actions: {
    /** Assign to agent/queue */
    assignTo?: string
    /** Assign to type */
    assignToType?: 'agent' | 'queue'
    /** Set priority */
    setPriority?: TicketPriority
    /** Set status */
    setStatus?: TicketStatus
    /** Add tags */
    addTags?: string[]
    /** Remove tags */
    removeTags?: string[]
    /** Send notification */
    notifyIds?: string[]
    /** Apply macro */
    macroId?: string
  }

  /** Active/inactive */
  isActive: boolean

  /** Execution order */
  position?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TriggerInput = Input<Trigger>
export type TriggerOutput = Output<Trigger>

// =============================================================================
// Automation
// =============================================================================

/**
 * Support automation workflow.
 *
 * @example
 * ```ts
 * const automation: Automation = {
 *   id: 'auto_123',
 *   name: 'Close inactive tickets',
 *   type: 'scheduled',
 *   schedule: '0 0 * * *',
 *   conditions: {
 *     status: ['pending'],
 *     inactiveFor: 10080
 *   },
 *   actions: {
 *     setStatus: 'closed'
 *   },
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Automation {
  /** Unique identifier */
  id: string

  /** Automation name */
  name: string

  /** Automation description */
  description?: string

  /** Automation type */
  type: 'trigger' | 'scheduled' | 'webhook'

  /** Schedule (cron expression for scheduled) */
  schedule?: string

  /** Conditions */
  conditions: {
    /** Priority match */
    priority?: TicketPriority[]
    /** Status match */
    status?: TicketStatus[]
    /** Inactive for (minutes) */
    inactiveFor?: number
    /** Tags match */
    tags?: string[]
    /** Custom field conditions */
    customFields?: Record<string, unknown>
  }

  /** Actions to perform */
  actions: {
    /** Set status */
    setStatus?: TicketStatus
    /** Set priority */
    setPriority?: TicketPriority
    /** Add tags */
    addTags?: string[]
    /** Send email */
    sendEmail?: {
      to: string
      subject: string
      body: string
    }
    /** Call webhook */
    webhook?: {
      url: string
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      headers?: Record<string, string>
      body?: string
    }
  }

  /** Active/inactive */
  isActive: boolean

  /** Last run timestamp */
  lastRunAt?: Date

  /** Next run timestamp */
  nextRunAt?: Date

  /** Run count */
  runCount?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AutomationInput = Input<Automation>
export type AutomationOutput = Output<Automation>

// =============================================================================
// Satisfaction
// =============================================================================

/**
 * Satisfaction rating scale.
 */
export type SatisfactionRating = 'very_dissatisfied' | 'dissatisfied' | 'neutral' | 'satisfied' | 'very_satisfied'

/**
 * CSAT (Customer Satisfaction) survey.
 *
 * @example
 * ```ts
 * const survey: Satisfaction = {
 *   id: 'csat_123',
 *   name: 'Post-ticket CSAT',
 *   question: 'How satisfied are you with the support you received?',
 *   type: 'csat',
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Satisfaction {
  /** Unique identifier */
  id: string

  /** Survey name */
  name: string

  /** Survey question */
  question: string

  /** Survey type */
  type: 'csat' | 'ces' | 'custom'

  /** Follow-up question */
  followUpQuestion?: string

  /** Rating scale */
  scale?: {
    min: number
    max: number
    labels?: Record<number, string>
  }

  /** Active/inactive */
  isActive: boolean

  /** Send triggers */
  triggers?: {
    /** On ticket resolution */
    onResolution?: boolean
    /** On ticket closure */
    onClosure?: boolean
    /** Delay after trigger (minutes) */
    delayMinutes?: number
  }

  /** Response rate */
  responseRate?: number

  /** Average score */
  averageScore?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SatisfactionInput = Input<Satisfaction>
export type SatisfactionOutput = Output<Satisfaction>

// =============================================================================
// SatisfactionResponse
// =============================================================================

/**
 * CSAT survey response.
 *
 * @example
 * ```ts
 * const response: SatisfactionResponse = {
 *   id: 'resp_123',
 *   surveyId: 'csat_123',
 *   ticketId: 'tkt_123',
 *   rating: 'satisfied',
 *   score: 4,
 *   comment: 'Great service!',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SatisfactionResponse {
  /** Unique identifier */
  id: string

  /** Survey ID */
  surveyId: string

  /** Ticket ID */
  ticketId: string

  /** Customer ID */
  customerId?: string

  /** Agent ID */
  agentId?: string

  /** Rating */
  rating?: SatisfactionRating

  /** Numeric score */
  score: number

  /** Comment/feedback */
  comment?: string

  /** Follow-up response */
  followUpResponse?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SatisfactionResponseInput = Input<SatisfactionResponse>
export type SatisfactionResponseOutput = Output<SatisfactionResponse>

// =============================================================================
// NPS
// =============================================================================

/**
 * NPS category.
 */
export type NPSCategory = 'detractor' | 'passive' | 'promoter'

/**
 * Net Promoter Score survey.
 *
 * @example
 * ```ts
 * const nps: NPS = {
 *   id: 'nps_123',
 *   name: 'Quarterly NPS',
 *   question: 'How likely are you to recommend us to a friend?',
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface NPS {
  /** Unique identifier */
  id: string

  /** Survey name */
  name: string

  /** Survey question */
  question: string

  /** Follow-up question for promoters */
  promoterQuestion?: string

  /** Follow-up question for passives */
  passiveQuestion?: string

  /** Follow-up question for detractors */
  detractorQuestion?: string

  /** Active/inactive */
  isActive: boolean

  /** Send schedule */
  schedule?: {
    /** Frequency */
    frequency?: 'once' | 'quarterly' | 'biannually' | 'annually'
    /** Next send date */
    nextSendAt?: Date
  }

  /** NPS score */
  score?: number

  /** Response rate */
  responseRate?: number

  /** Distribution */
  distribution?: {
    promoters: number
    passives: number
    detractors: number
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type NPSInput = Input<NPS>
export type NPSOutput = Output<NPS>

// =============================================================================
// NPSResponse
// =============================================================================

/**
 * NPS survey response.
 *
 * @example
 * ```ts
 * const response: NPSResponse = {
 *   id: 'npsresp_123',
 *   surveyId: 'nps_123',
 *   customerId: 'cus_123',
 *   score: 9,
 *   category: 'promoter',
 *   comment: 'Love the product!',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface NPSResponse {
  /** Unique identifier */
  id: string

  /** Survey ID */
  surveyId: string

  /** Customer ID */
  customerId: string

  /** NPS score (0-10) */
  score: number

  /** Category (based on score) */
  category: NPSCategory

  /** Comment/feedback */
  comment?: string

  /** Follow-up response */
  followUpResponse?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type NPSResponseInput = Input<NPSResponse>
export type NPSResponseOutput = Output<NPSResponse>

// =============================================================================
// HealthScore
// =============================================================================

/**
 * Health status.
 */
export type HealthStatus = 'at_risk' | 'poor' | 'fair' | 'good' | 'excellent'

/**
 * Customer health score.
 *
 * @example
 * ```ts
 * const health: HealthScore = {
 *   id: 'health_123',
 *   customerId: 'cus_123',
 *   score: 85,
 *   status: 'good',
 *   metrics: {
 *     product_usage: { score: 90, weight: 0.4 },
 *     support_satisfaction: { score: 80, weight: 0.3 },
 *     engagement: { score: 85, weight: 0.3 }
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface HealthScore {
  /** Unique identifier */
  id: string

  /** Customer ID */
  customerId: string

  /** Overall health score (0-100) */
  score: number

  /** Health status */
  status: HealthStatus

  /** Previous score */
  previousScore?: number

  /** Score trend */
  trend?: 'improving' | 'stable' | 'declining'

  /** Component metrics */
  metrics?: Record<string, {
    /** Metric score */
    score: number
    /** Weight in overall score */
    weight: number
  }>

  /** Risk factors */
  riskFactors?: Array<{
    /** Risk type */
    type: string
    /** Severity */
    severity: 'low' | 'medium' | 'high' | 'critical'
    /** Description */
    description: string
  }>

  /** Positive indicators */
  positiveIndicators?: string[]

  /** Last calculated */
  calculatedAt: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    gainsight?: string
    totango?: string
    planhat?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type HealthScoreInput = Input<HealthScore>
export type HealthScoreOutput = Output<HealthScore>

// =============================================================================
// HealthScoreMetric
// =============================================================================

/**
 * Health score metric/component.
 *
 * @example
 * ```ts
 * const metric: HealthScoreMetric = {
 *   id: 'metric_123',
 *   name: 'Product Usage',
 *   description: 'Measures product engagement',
 *   weight: 0.4,
 *   calculation: 'percentage',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface HealthScoreMetric {
  /** Unique identifier */
  id: string

  /** Metric name */
  name: string

  /** Metric description */
  description?: string

  /** Weight in overall score (0-1) */
  weight: number

  /** Calculation method */
  calculation: 'percentage' | 'count' | 'average' | 'custom'

  /** Custom calculation formula */
  formula?: string

  /** Data source */
  dataSource?: string

  /** Refresh frequency */
  refreshFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly'

  /** Threshold ranges */
  thresholds?: {
    at_risk?: { min: number; max: number }
    poor?: { min: number; max: number }
    fair?: { min: number; max: number }
    good?: { min: number; max: number }
    excellent?: { min: number; max: number }
  }

  /** Active/inactive */
  isActive: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    gainsight?: string
    totango?: string
    planhat?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type HealthScoreMetricInput = Input<HealthScoreMetric>
export type HealthScoreMetricOutput = Output<HealthScoreMetric>

// =============================================================================
// CustomerSuccess
// =============================================================================

/**
 * Customer success account record.
 *
 * @example
 * ```ts
 * const csAccount: CustomerSuccess = {
 *   id: 'cs_123',
 *   customerId: 'cus_123',
 *   csmId: 'csm_456',
 *   tier: 'enterprise',
 *   healthScore: 85,
 *   status: 'healthy',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CustomerSuccess {
  /** Unique identifier */
  id: string

  /** Customer ID */
  customerId: string

  /** Customer Success Manager ID */
  csmId?: string

  /** Account tier/segment */
  tier?: 'enterprise' | 'mid_market' | 'smb' | 'startup'

  /** Health score ID */
  healthScoreId?: string

  /** Current health score value */
  healthScore?: number

  /** Health status */
  status?: HealthStatus

  /** Lifecycle stage */
  lifecycleStage?: 'onboarding' | 'adoption' | 'value_realization' | 'expansion' | 'renewal' | 'at_risk' | 'churned'

  /** Onboarding status */
  onboardingStatus?: 'not_started' | 'in_progress' | 'completed'

  /** Onboarding completion % */
  onboardingProgress?: number

  /** Next renewal date */
  nextRenewalDate?: Date

  /** ARR/MRR */
  arr?: number
  mrr?: number

  /** Expansion opportunity */
  expansionOpportunity?: number

  /** Churn risk */
  churnRisk?: 'low' | 'medium' | 'high' | 'critical'

  /** Success plan ID */
  successPlanId?: string

  /** Engagement score */
  engagementScore?: number

  /** Product adoption score */
  adoptionScore?: number

  /** Last touch timestamp */
  lastTouchAt?: Date

  /** Next scheduled touch */
  nextTouchAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    gainsight?: string
    totango?: string
    planhat?: string
    churnzero?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CustomerSuccessInput = Input<CustomerSuccess>
export type CustomerSuccessOutput = Output<CustomerSuccess>

// =============================================================================
// SuccessPlan
// =============================================================================

/**
 * Customer success plan.
 *
 * @example
 * ```ts
 * const plan: SuccessPlan = {
 *   id: 'plan_123',
 *   customerId: 'cus_123',
 *   name: 'Q1 2024 Success Plan',
 *   objectives: ['Increase adoption', 'Reduce support tickets'],
 *   status: 'active',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SuccessPlan {
  /** Unique identifier */
  id: string

  /** Customer ID */
  customerId: string

  /** Plan name */
  name: string

  /** Plan description */
  description?: string

  /** Success objectives */
  objectives?: string[]

  /** Plan status */
  status: 'draft' | 'active' | 'completed' | 'cancelled'

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Owner CSM ID */
  ownerId?: string

  /** Milestones */
  milestoneIds?: string[]

  /** Progress percentage */
  progress?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    gainsight?: string
    totango?: string
    planhat?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SuccessPlanInput = Input<SuccessPlan>
export type SuccessPlanOutput = Output<SuccessPlan>

// =============================================================================
// Milestone
// =============================================================================

/**
 * Success plan milestone.
 *
 * @example
 * ```ts
 * const milestone: Milestone = {
 *   id: 'mile_123',
 *   successPlanId: 'plan_123',
 *   name: 'Complete onboarding',
 *   description: 'Finish all onboarding tasks',
 *   status: 'completed',
 *   dueDate: new Date('2024-02-15'),
 *   completedAt: new Date('2024-02-10'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Milestone {
  /** Unique identifier */
  id: string

  /** Success plan ID */
  successPlanId: string

  /** Milestone name */
  name: string

  /** Milestone description */
  description?: string

  /** Status */
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'

  /** Due date */
  dueDate?: Date

  /** Completed date */
  completedAt?: Date

  /** Owner ID */
  ownerId?: string

  /** Dependencies */
  dependencies?: string[]

  /** Progress percentage */
  progress?: number

  /** Tasks/checklist */
  tasks?: Array<{
    id: string
    title: string
    completed: boolean
  }>

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    gainsight?: string
    totango?: string
    planhat?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MilestoneInput = Input<Milestone>
export type MilestoneOutput = Output<Milestone>

// =============================================================================
// ChatConversation
// =============================================================================

/**
 * Conversation status.
 */
export type ConversationStatus = 'active' | 'waiting' | 'closed'

/**
 * Live chat conversation.
 *
 * @example
 * ```ts
 * const conversation: ChatConversation = {
 *   id: 'conv_123',
 *   customerId: 'cus_123',
 *   agentId: 'agent_456',
 *   status: 'active',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ChatConversation {
  /** Unique identifier */
  id: string

  /** Customer ID */
  customerId?: string

  /** Customer name */
  customerName?: string

  /** Customer email */
  customerEmail?: string

  /** Assigned agent ID */
  agentId?: string

  /** Conversation status */
  status: ConversationStatus

  /** Subject/topic */
  subject?: string

  /** Queue ID */
  queueId?: string

  /** Priority */
  priority?: TicketPriority

  /** Tags */
  tags?: string[]

  /** Related ticket ID */
  ticketId?: string

  /** Message count */
  messageCount?: number

  /** Last message timestamp */
  lastMessageAt?: Date

  /** Customer last message timestamp */
  customerLastMessageAt?: Date

  /** Agent last message timestamp */
  agentLastMessageAt?: Date

  /** First response timestamp */
  firstResponseAt?: Date

  /** Closed timestamp */
  closedAt?: Date

  /** Wait time (minutes) */
  waitTime?: number

  /** Duration (minutes) */
  duration?: number

  /** Rating */
  rating?: {
    score: number
    comment?: string
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    drift?: string
    livechat?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ChatConversationInput = Input<ChatConversation>
export type ChatConversationOutput = Output<ChatConversation>

// =============================================================================
// ChatMessage
// =============================================================================

/**
 * Live chat message.
 *
 * @example
 * ```ts
 * const message: ChatMessage = {
 *   id: 'msg_123',
 *   conversationId: 'conv_123',
 *   authorId: 'agent_456',
 *   authorType: 'agent',
 *   body: 'How can I help you today?',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ChatMessage {
  /** Unique identifier */
  id: string

  /** Conversation ID */
  conversationId: string

  /** Message author ID */
  authorId: string

  /** Author type */
  authorType: 'customer' | 'agent' | 'bot' | 'system'

  /** Message body */
  body: string

  /** Message type */
  messageType?: 'text' | 'image' | 'file' | 'card' | 'system'

  /** Attachments */
  attachments?: Array<{
    id: string
    filename: string
    contentType: string
    size: number
    url: string
  }>

  /** Read status */
  isRead?: boolean

  /** Read timestamp */
  readAt?: Date

  /** Delivered status */
  isDelivered?: boolean

  /** Delivered timestamp */
  deliveredAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    zendesk?: string
    intercom?: string
    freshdesk?: string
    helpscout?: string
    frontapp?: string
    kustomer?: string
    drift?: string
    livechat?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ChatMessageInput = Input<ChatMessage>
export type ChatMessageOutput = Output<ChatMessage>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface TicketActions extends CRUDResource<Ticket, TicketInput> {
  /** Search tickets */
  search: Action<{ query: string } & ListParams, PaginatedResult<Ticket>>

  /** Update status */
  updateStatus: Action<{ id: string; status: TicketStatus }, Ticket>

  /** Update priority */
  updatePriority: Action<{ id: string; priority: TicketPriority }, Ticket>

  /** Assign to agent */
  assign: Action<{ id: string; agentId: string }, Ticket>

  /** Add tag */
  addTag: Action<{ id: string; tag: string }, Ticket>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, Ticket>

  /** Merge tickets */
  merge: Action<{ sourceId: string; targetId: string }, Ticket>

  /** Add comment */
  addComment: Action<{ ticketId: string; comment: TicketCommentInput }, TicketComment>

  /** Get comments */
  getComments: Action<{ id: string } & ListParams, PaginatedResult<TicketComment>>

  /** Apply macro */
  applyMacro: Action<{ id: string; macroId: string }, Ticket>
}

export interface TicketCommentActions extends CRUDResource<TicketComment, TicketCommentInput> {
  /** Mark as public/private */
  setVisibility: Action<{ id: string; isPublic: boolean }, TicketComment>
}

export interface TicketTagActions extends CRUDResource<TicketTag, TicketTagInput> {
  /** Search tags */
  search: Action<{ query: string }, TicketTag[]>
}

export interface QueueActions extends CRUDResource<Queue, QueueInput> {
  /** Add agent to queue */
  addAgent: Action<{ id: string; agentId: string }, Queue>

  /** Remove agent from queue */
  removeAgent: Action<{ id: string; agentId: string }, Queue>

  /** Get tickets */
  getTickets: Action<{ id: string } & ListParams, PaginatedResult<Ticket>>

  /** Get statistics */
  getStats: Action<{ id: string }, {
    ticketCount: number
    avgResponseTime: number
    avgResolutionTime: number
  }>
}

export interface AgentActions extends CRUDResource<Agent, AgentInput> {
  /** Update status */
  updateStatus: Action<{ id: string; status: AgentStatus }, Agent>

  /** Get assigned tickets */
  getTickets: Action<{ id: string } & ListParams, PaginatedResult<Ticket>>

  /** Get performance metrics */
  getMetrics: Action<{ id: string; startDate?: Date; endDate?: Date }, {
    totalTickets: number
    avgResolutionTime: number
    csatScore: number
    avgFirstResponseTime: number
  }>
}

export interface AgentGroupActions extends CRUDResource<AgentGroup, AgentGroupInput> {
  /** Add agent */
  addAgent: Action<{ id: string; agentId: string }, AgentGroup>

  /** Remove agent */
  removeAgent: Action<{ id: string; agentId: string }, AgentGroup>
}

export interface SLAActions extends CRUDResource<SLA, SLAInput> {
  /** Pause SLA */
  pause: Action<{ id: string }, SLA>

  /** Resume SLA */
  resume: Action<{ id: string }, SLA>

  /** Get by ticket */
  getByTicket: Action<{ ticketId: string }, SLA>
}

export interface SLAPolicyActions extends CRUDResource<SLAPolicy, SLAPolicyInput> {
  /** Activate policy */
  activate: Action<{ id: string }, SLAPolicy>

  /** Deactivate policy */
  deactivate: Action<{ id: string }, SLAPolicy>
}

export interface EscalationActions extends CRUDResource<Escalation, EscalationInput> {
  /** Resolve escalation */
  resolve: Action<{ id: string; notes?: string }, Escalation>

  /** Get by ticket */
  getByTicket: Action<{ ticketId: string }, Escalation[]>
}

export interface EscalationRuleActions extends CRUDResource<EscalationRule, EscalationRuleInput> {
  /** Activate rule */
  activate: Action<{ id: string }, EscalationRule>

  /** Deactivate rule */
  deactivate: Action<{ id: string }, EscalationRule>
}

export interface KnowledgeBaseActions extends CRUDResource<KnowledgeBase, KnowledgeBaseInput> {
  /** Get articles */
  getArticles: Action<{ id: string } & ListParams, PaginatedResult<Article>>

  /** Search articles */
  searchArticles: Action<{ id: string; query: string } & ListParams, PaginatedResult<Article>>
}

export interface ArticleActions extends CRUDResource<Article, ArticleInput> {
  /** Search articles */
  search: Action<{ query: string; knowledgeBaseId?: string } & ListParams, PaginatedResult<Article>>

  /** Publish article */
  publish: Action<{ id: string }, Article>

  /** Archive article */
  archive: Action<{ id: string }, Article>

  /** Get feedback */
  getFeedback: Action<{ id: string } & ListParams, PaginatedResult<ArticleFeedback>>

  /** Submit feedback */
  submitFeedback: Action<{ articleId: string; feedback: ArticleFeedbackInput }, ArticleFeedback>
}

export interface ArticleCategoryActions extends CRUDResource<ArticleCategory, ArticleCategoryInput> {
  /** Get articles */
  getArticles: Action<{ id: string } & ListParams, PaginatedResult<Article>>

  /** Reorder */
  reorder: Action<{ id: string; position: number }, ArticleCategory>
}

export interface ArticleFeedbackActions extends CRUDResource<ArticleFeedback, ArticleFeedbackInput> {
  /** Get by article */
  getByArticle: Action<{ articleId: string } & ListParams, PaginatedResult<ArticleFeedback>>
}

export interface MacroActions extends CRUDResource<Macro, MacroInput> {
  /** Search macros */
  search: Action<{ query: string }, Macro[]>

  /** Apply to ticket */
  apply: Action<{ id: string; ticketId: string }, Ticket>
}

export interface TriggerActions extends CRUDResource<Trigger, TriggerInput> {
  /** Activate trigger */
  activate: Action<{ id: string }, Trigger>

  /** Deactivate trigger */
  deactivate: Action<{ id: string }, Trigger>

  /** Test trigger */
  test: Action<{ id: string; ticketId: string }, { matches: boolean; actions: string[] }>
}

export interface AutomationActions extends CRUDResource<Automation, AutomationInput> {
  /** Activate automation */
  activate: Action<{ id: string }, Automation>

  /** Deactivate automation */
  deactivate: Action<{ id: string }, Automation>

  /** Run now */
  runNow: Action<{ id: string }, { executedCount: number }>

  /** Get execution history */
  getHistory: Action<{ id: string } & ListParams, PaginatedResult<{
    id: string
    runAt: Date
    executedCount: number
    errors?: string[]
  }>>
}

export interface SatisfactionActions extends CRUDResource<Satisfaction, SatisfactionInput> {
  /** Activate survey */
  activate: Action<{ id: string }, Satisfaction>

  /** Deactivate survey */
  deactivate: Action<{ id: string }, Satisfaction>

  /** Get responses */
  getResponses: Action<{ id: string } & ListParams, PaginatedResult<SatisfactionResponse>>

  /** Get statistics */
  getStats: Action<{ id: string; startDate?: Date; endDate?: Date }, {
    totalResponses: number
    averageScore: number
    responseRate: number
    distribution: Record<string, number>
  }>
}

export interface SatisfactionResponseActions extends CRUDResource<SatisfactionResponse, SatisfactionResponseInput> {
  /** Get by ticket */
  getByTicket: Action<{ ticketId: string }, SatisfactionResponse>
}

export interface NPSActions extends CRUDResource<NPS, NPSInput> {
  /** Activate survey */
  activate: Action<{ id: string }, NPS>

  /** Deactivate survey */
  deactivate: Action<{ id: string }, NPS>

  /** Get responses */
  getResponses: Action<{ id: string } & ListParams, PaginatedResult<NPSResponse>>

  /** Get statistics */
  getStats: Action<{ id: string; startDate?: Date; endDate?: Date }, {
    totalResponses: number
    npsScore: number
    promoters: number
    passives: number
    detractors: number
  }>

  /** Send survey */
  send: Action<{ id: string; customerIds: string[] }, { sent: number }>
}

export interface NPSResponseActions extends CRUDResource<NPSResponse, NPSResponseInput> {
  /** Get by customer */
  getByCustomer: Action<{ customerId: string } & ListParams, PaginatedResult<NPSResponse>>
}

export interface HealthScoreActions extends CRUDResource<HealthScore, HealthScoreInput> {
  /** Calculate score */
  calculate: Action<{ customerId: string }, HealthScore>

  /** Get by customer */
  getByCustomer: Action<{ customerId: string }, HealthScore>

  /** Get history */
  getHistory: Action<{ customerId: string } & ListParams, PaginatedResult<HealthScore>>
}

export interface HealthScoreMetricActions extends CRUDResource<HealthScoreMetric, HealthScoreMetricInput> {
  /** Activate metric */
  activate: Action<{ id: string }, HealthScoreMetric>

  /** Deactivate metric */
  deactivate: Action<{ id: string }, HealthScoreMetric>
}

export interface CustomerSuccessActions extends CRUDResource<CustomerSuccess, CustomerSuccessInput> {
  /** Assign CSM */
  assignCSM: Action<{ id: string; csmId: string }, CustomerSuccess>

  /** Update lifecycle stage */
  updateLifecycleStage: Action<{ id: string; stage: string }, CustomerSuccess>

  /** Get accounts by CSM */
  getByCSM: Action<{ csmId: string } & ListParams, PaginatedResult<CustomerSuccess>>

  /** Get at-risk accounts */
  getAtRisk: Action<ListParams, PaginatedResult<CustomerSuccess>>
}

export interface SuccessPlanActions extends CRUDResource<SuccessPlan, SuccessPlanInput> {
  /** Activate plan */
  activate: Action<{ id: string }, SuccessPlan>

  /** Complete plan */
  complete: Action<{ id: string }, SuccessPlan>

  /** Get milestones */
  getMilestones: Action<{ id: string } & ListParams, PaginatedResult<Milestone>>

  /** Add milestone */
  addMilestone: Action<{ successPlanId: string; milestone: MilestoneInput }, Milestone>
}

export interface MilestoneActions extends CRUDResource<Milestone, MilestoneInput> {
  /** Update status */
  updateStatus: Action<{ id: string; status: string }, Milestone>

  /** Complete milestone */
  complete: Action<{ id: string }, Milestone>
}

export interface ChatConversationActions extends CRUDResource<ChatConversation, ChatConversationInput> {
  /** Assign to agent */
  assign: Action<{ id: string; agentId: string }, ChatConversation>

  /** Close conversation */
  close: Action<{ id: string }, ChatConversation>

  /** Get messages */
  getMessages: Action<{ id: string } & ListParams, PaginatedResult<ChatMessage>>

  /** Send message */
  sendMessage: Action<{ conversationId: string; message: ChatMessageInput }, ChatMessage>

  /** Create ticket from conversation */
  createTicket: Action<{ id: string; ticketData: Partial<TicketInput> }, Ticket>
}

export interface ChatMessageActions extends CRUDResource<ChatMessage, ChatMessageInput> {
  /** Mark as read */
  markAsRead: Action<{ id: string }, ChatMessage>
}

// =============================================================================
// Events
// =============================================================================

export interface TicketEvents {
  created: BaseEvent<'ticket.created', Ticket>
  updated: BaseEvent<'ticket.updated', Ticket>
  deleted: BaseEvent<'ticket.deleted', { id: string }>
  status_changed: BaseEvent<'ticket.status_changed', { ticketId: string; oldStatus: TicketStatus; newStatus: TicketStatus }>
  priority_changed: BaseEvent<'ticket.priority_changed', { ticketId: string; oldPriority: TicketPriority; newPriority: TicketPriority }>
  assigned: BaseEvent<'ticket.assigned', { ticketId: string; agentId: string }>
  tagged: BaseEvent<'ticket.tagged', { ticketId: string; tag: string }>
  untagged: BaseEvent<'ticket.untagged', { ticketId: string; tag: string }>
  merged: BaseEvent<'ticket.merged', { sourceId: string; targetId: string; result: Ticket }>
  comment_added: BaseEvent<'ticket.comment_added', { ticketId: string; comment: TicketComment }>
}

export interface QueueEvents {
  created: BaseEvent<'queue.created', Queue>
  updated: BaseEvent<'queue.updated', Queue>
  deleted: BaseEvent<'queue.deleted', { id: string }>
  agent_added: BaseEvent<'queue.agent_added', { queueId: string; agentId: string }>
  agent_removed: BaseEvent<'queue.agent_removed', { queueId: string; agentId: string }>
}

export interface AgentEvents {
  created: BaseEvent<'agent.created', Agent>
  updated: BaseEvent<'agent.updated', Agent>
  deleted: BaseEvent<'agent.deleted', { id: string }>
  status_changed: BaseEvent<'agent.status_changed', { agentId: string; oldStatus: AgentStatus; newStatus: AgentStatus }>
}

export interface SLAEvents {
  created: BaseEvent<'sla.created', SLA>
  updated: BaseEvent<'sla.updated', SLA>
  breached: BaseEvent<'sla.breached', { slaId: string; ticketId: string; metric: string }>
  paused: BaseEvent<'sla.paused', { slaId: string }>
  resumed: BaseEvent<'sla.resumed', { slaId: string }>
}

export interface EscalationEvents {
  created: BaseEvent<'escalation.created', Escalation>
  updated: BaseEvent<'escalation.updated', Escalation>
  resolved: BaseEvent<'escalation.resolved', { escalationId: string }>
}

export interface ArticleEvents {
  created: BaseEvent<'article.created', Article>
  updated: BaseEvent<'article.updated', Article>
  deleted: BaseEvent<'article.deleted', { id: string }>
  published: BaseEvent<'article.published', Article>
  archived: BaseEvent<'article.archived', { articleId: string }>
  feedback_received: BaseEvent<'article.feedback_received', { articleId: string; feedback: ArticleFeedback }>
}

export interface SatisfactionEvents {
  response_received: BaseEvent<'satisfaction.response_received', SatisfactionResponse>
}

export interface NPSEvents {
  response_received: BaseEvent<'nps.response_received', NPSResponse>
}

export interface HealthScoreEvents {
  calculated: BaseEvent<'health_score.calculated', HealthScore>
  status_changed: BaseEvent<'health_score.status_changed', { customerId: string; oldStatus: HealthStatus; newStatus: HealthStatus }>
  at_risk_detected: BaseEvent<'health_score.at_risk_detected', { customerId: string; healthScore: HealthScore }>
}

export interface CustomerSuccessEvents {
  created: BaseEvent<'customer_success.created', CustomerSuccess>
  updated: BaseEvent<'customer_success.updated', CustomerSuccess>
  csm_assigned: BaseEvent<'customer_success.csm_assigned', { customerId: string; csmId: string }>
  lifecycle_changed: BaseEvent<'customer_success.lifecycle_changed', { customerId: string; oldStage: string; newStage: string }>
}

export interface SuccessPlanEvents {
  created: BaseEvent<'success_plan.created', SuccessPlan>
  updated: BaseEvent<'success_plan.updated', SuccessPlan>
  activated: BaseEvent<'success_plan.activated', { planId: string }>
  completed: BaseEvent<'success_plan.completed', { planId: string }>
  milestone_added: BaseEvent<'success_plan.milestone_added', { planId: string; milestone: Milestone }>
}

export interface MilestoneEvents {
  created: BaseEvent<'milestone.created', Milestone>
  updated: BaseEvent<'milestone.updated', Milestone>
  completed: BaseEvent<'milestone.completed', { milestoneId: string }>
}

export interface ChatConversationEvents {
  created: BaseEvent<'chat_conversation.created', ChatConversation>
  updated: BaseEvent<'chat_conversation.updated', ChatConversation>
  assigned: BaseEvent<'chat_conversation.assigned', { conversationId: string; agentId: string }>
  closed: BaseEvent<'chat_conversation.closed', { conversationId: string }>
  message_received: BaseEvent<'chat_conversation.message_received', { conversationId: string; message: ChatMessage }>
}

// =============================================================================
// Resources
// =============================================================================

export interface TicketResource extends TicketActions {
  on: <K extends keyof TicketEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TicketEvents[K], TProxy>
  ) => () => void
}

export interface TicketCommentResource extends TicketCommentActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface TicketTagResource extends TicketTagActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface QueueResource extends QueueActions {
  on: <K extends keyof QueueEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<QueueEvents[K], TProxy>
  ) => () => void
}

export interface AgentResource extends AgentActions {
  on: <K extends keyof AgentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AgentEvents[K], TProxy>
  ) => () => void
}

export interface AgentGroupResource extends AgentGroupActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface SLAResource extends SLAActions {
  on: <K extends keyof SLAEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SLAEvents[K], TProxy>
  ) => () => void
}

export interface SLAPolicyResource extends SLAPolicyActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface EscalationResource extends EscalationActions {
  on: <K extends keyof EscalationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EscalationEvents[K], TProxy>
  ) => () => void
}

export interface EscalationRuleResource extends EscalationRuleActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface KnowledgeBaseResource extends KnowledgeBaseActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ArticleResource extends ArticleActions {
  on: <K extends keyof ArticleEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ArticleEvents[K], TProxy>
  ) => () => void
}

export interface ArticleCategoryResource extends ArticleCategoryActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ArticleFeedbackResource extends ArticleFeedbackActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface MacroResource extends MacroActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface TriggerResource extends TriggerActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface AutomationResource extends AutomationActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface SatisfactionResource extends SatisfactionActions {
  on: <K extends keyof SatisfactionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SatisfactionEvents[K], TProxy>
  ) => () => void
}

export interface SatisfactionResponseResource extends SatisfactionResponseActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface NPSResource extends NPSActions {
  on: <K extends keyof NPSEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<NPSEvents[K], TProxy>
  ) => () => void
}

export interface NPSResponseResource extends NPSResponseActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface HealthScoreResource extends HealthScoreActions {
  on: <K extends keyof HealthScoreEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<HealthScoreEvents[K], TProxy>
  ) => () => void
}

export interface HealthScoreMetricResource extends HealthScoreMetricActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface CustomerSuccessResource extends CustomerSuccessActions {
  on: <K extends keyof CustomerSuccessEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CustomerSuccessEvents[K], TProxy>
  ) => () => void
}

export interface SuccessPlanResource extends SuccessPlanActions {
  on: <K extends keyof SuccessPlanEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SuccessPlanEvents[K], TProxy>
  ) => () => void
}

export interface MilestoneResource extends MilestoneActions {
  on: <K extends keyof MilestoneEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MilestoneEvents[K], TProxy>
  ) => () => void
}

export interface ChatConversationResource extends ChatConversationActions {
  on: <K extends keyof ChatConversationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ChatConversationEvents[K], TProxy>
  ) => () => void
}

export interface ChatMessageResource extends ChatMessageActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

// =============================================================================
// Support Proxy (unified interface)
// =============================================================================

/**
 * Complete Support & Customer Success interface combining all resources.
 *
 * @example
 * ```ts
 * const support: SupportProxy = getSupportProxy()
 *
 * // Create a ticket
 * const ticket = await support.tickets.create({
 *   subject: 'Cannot login',
 *   description: 'Getting error when trying to login...',
 *   customerId: 'cus_123',
 *   priority: 'high',
 *   status: 'new',
 *   type: 'incident'
 * })
 *
 * // Subscribe to events
 * support.tickets.on('created', (event, ctx) => {
 *   console.log('New ticket:', event.data.subject)
 * })
 *
 * // Create a knowledge base article
 * const article = await support.articles.create({
 *   knowledgeBaseId: 'kb_123',
 *   title: 'How to reset password',
 *   body: 'Follow these steps...',
 *   status: 'published'
 * })
 *
 * // Track customer health
 * const health = await support.healthScores.getByCustomer({
 *   customerId: 'cus_123'
 * })
 * ```
 */
export interface SupportProxy {
  /** Ticket resources */
  tickets: TicketResource
  /** Ticket comment resources */
  ticketComments: TicketCommentResource
  /** Ticket tag resources */
  ticketTags: TicketTagResource
  /** Queue resources */
  queues: QueueResource
  /** Agent resources */
  agents: AgentResource
  /** Agent group resources */
  agentGroups: AgentGroupResource
  /** SLA resources */
  slas: SLAResource
  /** SLA policy resources */
  slaPolicies: SLAPolicyResource
  /** Escalation resources */
  escalations: EscalationResource
  /** Escalation rule resources */
  escalationRules: EscalationRuleResource
  /** Knowledge base resources */
  knowledgeBases: KnowledgeBaseResource
  /** Article resources */
  articles: ArticleResource
  /** Article category resources */
  articleCategories: ArticleCategoryResource
  /** Article feedback resources */
  articleFeedback: ArticleFeedbackResource
  /** Macro resources */
  macros: MacroResource
  /** Trigger resources */
  triggers: TriggerResource
  /** Automation resources */
  automations: AutomationResource
  /** Satisfaction survey resources */
  satisfaction: SatisfactionResource
  /** Satisfaction response resources */
  satisfactionResponses: SatisfactionResponseResource
  /** NPS survey resources */
  nps: NPSResource
  /** NPS response resources */
  npsResponses: NPSResponseResource
  /** Health score resources */
  healthScores: HealthScoreResource
  /** Health score metric resources */
  healthScoreMetrics: HealthScoreMetricResource
  /** Customer success resources */
  customerSuccess: CustomerSuccessResource
  /** Success plan resources */
  successPlans: SuccessPlanResource
  /** Milestone resources */
  milestones: MilestoneResource
  /** Chat conversation resources */
  chatConversations: ChatConversationResource
  /** Chat message resources */
  chatMessages: ChatMessageResource
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported support/customer success providers.
 */
export type SupportProvider =
  | 'zendesk'
  | 'intercom'
  | 'freshdesk'
  | 'helpscout'
  | 'frontapp'
  | 'kustomer'
  | 'gainsight'
  | 'totango'
  | 'planhat'
  | 'churnzero'

/**
 * Provider configuration.
 */
export interface SupportProviderConfig {
  provider: SupportProvider
  apiKey?: string
  apiToken?: string
  accessToken?: string
  subdomain?: string
  domain?: string
  apiVersion?: string
}
