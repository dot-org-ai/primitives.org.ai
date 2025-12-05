/**
 * Support/Helpdesk Entity Types (Nouns)
 *
 * Semantic type definitions for support and helpdesk tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Support Ticket
// =============================================================================

/**
 * Support ticket entity
 *
 * Represents a customer support request or issue that needs resolution
 */
export const SupportTicket: Noun = {
  singular: 'support ticket',
  plural: 'support tickets',
  description: 'A customer support request or issue requiring assistance',

  properties: {
    // Identity
    ticketNumber: {
      type: 'string',
      description: 'Unique ticket identifier or number',
    },

    // Content
    subject: {
      type: 'string',
      description: 'Brief subject or title of the issue',
    },
    description: {
      type: 'string',
      description: 'Detailed description of the issue or request',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Ticket type: question, problem, incident, task, feature-request',
      examples: ['question', 'problem', 'incident', 'task', 'feature-request'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Category or department: technical, billing, general, etc.',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization and filtering',
    },

    // Priority & Status
    priority: {
      type: 'string',
      description: 'Ticket priority: low, normal, high, urgent, critical',
      examples: ['low', 'normal', 'high', 'urgent', 'critical'],
    },
    status: {
      type: 'string',
      description: 'Ticket status: new, open, pending, on-hold, solved, closed',
      examples: ['new', 'open', 'pending', 'on-hold', 'solved', 'closed'],
    },

    // Assignment
    assigneeId: {
      type: 'string',
      optional: true,
      description: 'ID of the agent assigned to this ticket',
    },
    groupId: {
      type: 'string',
      optional: true,
      description: 'ID of the team/group assigned to this ticket',
    },

    // Customer
    requesterId: {
      type: 'string',
      description: 'ID of the customer who created the ticket',
    },
    requesterEmail: {
      type: 'string',
      description: 'Email address of the requester',
    },
    requesterName: {
      type: 'string',
      optional: true,
      description: 'Name of the requester',
    },

    // Channel
    channel: {
      type: 'string',
      optional: true,
      description: 'How the ticket was created: email, web, chat, phone, api',
      examples: ['email', 'web', 'chat', 'phone', 'api'],
    },

    // Timing
    dueAt: {
      type: 'datetime',
      optional: true,
      description: 'Due date/time for resolution',
    },
    firstResponseAt: {
      type: 'datetime',
      optional: true,
      description: 'When the first response was sent',
    },
    resolvedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the ticket was resolved',
    },
    closedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the ticket was closed',
    },

    // Metrics
    responseTime: {
      type: 'number',
      optional: true,
      description: 'Time to first response in minutes',
    },
    resolutionTime: {
      type: 'number',
      optional: true,
      description: 'Time to resolution in minutes',
    },

    // Additional
    customFields: {
      type: 'json',
      optional: true,
      description: 'Custom field values specific to organization',
    },
    isPublic: {
      type: 'boolean',
      optional: true,
      description: 'Whether the ticket is publicly visible',
    },
    satisfaction: {
      type: 'string',
      optional: true,
      description: 'Customer satisfaction rating: good, bad',
      examples: ['good', 'bad'],
    },
  },

  relationships: {
    requester: {
      type: 'Contact',
      description: 'The customer who submitted the ticket',
    },
    assignee: {
      type: 'Contact',
      required: false,
      description: 'The support agent assigned to the ticket',
    },
    comments: {
      type: 'TicketComment[]',
      backref: 'ticket',
      description: 'Comments and replies on this ticket',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to the ticket',
    },
    relatedTickets: {
      type: 'SupportTicket[]',
      description: 'Related or linked tickets',
    },
    satisfactionRating: {
      type: 'SatisfactionRating',
      required: false,
      backref: 'ticket',
      description: 'Customer satisfaction rating for this ticket',
    },
  },

  actions: [
    'create',
    'update',
    'assign',
    'reassign',
    'escalate',
    'merge',
    'split',
    'reply',
    'addComment',
    'addAttachment',
    'setPriority',
    'setStatus',
    'addTags',
    'removeTags',
    'markSpam',
    'delete',
    'close',
    'reopen',
    'requestFeedback',
  ],

  events: [
    'created',
    'updated',
    'assigned',
    'reassigned',
    'escalated',
    'merged',
    'split',
    'replied',
    'commented',
    'priorityChanged',
    'statusChanged',
    'tagged',
    'markedSpam',
    'deleted',
    'closed',
    'reopened',
    'rated',
    'solved',
  ],
}

/**
 * Ticket comment entity
 *
 * Represents a comment or reply on a support ticket
 */
export const TicketComment: Noun = {
  singular: 'ticket comment',
  plural: 'ticket comments',
  description: 'A comment or reply on a support ticket',

  properties: {
    // Content
    body: {
      type: 'string',
      description: 'Comment text content',
    },
    html: {
      type: 'string',
      optional: true,
      description: 'HTML formatted content',
    },
    plainText: {
      type: 'string',
      optional: true,
      description: 'Plain text version of the comment',
    },

    // Visibility
    isPublic: {
      type: 'boolean',
      description: 'Whether the comment is visible to the customer (vs internal note)',
    },

    // Author
    authorId: {
      type: 'string',
      description: 'ID of the person who wrote the comment',
    },
    authorType: {
      type: 'string',
      description: 'Type of author: agent, customer, system',
      examples: ['agent', 'customer', 'system'],
    },

    // Channel
    channel: {
      type: 'string',
      optional: true,
      description: 'How the comment was created: web, email, chat, api',
      examples: ['web', 'email', 'chat', 'api'],
    },

    // Email specific
    from: {
      type: 'string',
      optional: true,
      description: 'Sender email address if from email',
    },
    to: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Recipient email addresses if via email',
    },
    cc: {
      type: 'string',
      array: true,
      optional: true,
      description: 'CC email addresses',
    },

    // Metadata
    edited: {
      type: 'boolean',
      optional: true,
      description: 'Whether the comment was edited',
    },
    editedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the comment was last edited',
    },
  },

  relationships: {
    ticket: {
      type: 'SupportTicket',
      backref: 'comments',
      description: 'The ticket this comment belongs to',
    },
    author: {
      type: 'Contact',
      description: 'Who wrote the comment',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to this comment',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'makePublic',
    'makePrivate',
    'addAttachment',
    'removeAttachment',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'madePublic',
    'madePrivate',
    'attachmentAdded',
    'attachmentRemoved',
  ],
}

// =============================================================================
// Live Chat Conversation
// =============================================================================

/**
 * Live chat conversation entity
 *
 * Represents a real-time chat conversation between customer and support (Intercom, Zendesk Chat style)
 */
export const Conversation: Noun = {
  singular: 'conversation',
  plural: 'conversations',
  description: 'A live chat conversation between customer and support',

  properties: {
    // Status
    status: {
      type: 'string',
      description: 'Conversation status: open, active, pending, closed, snoozed',
      examples: ['open', 'active', 'pending', 'closed', 'snoozed'],
    },
    state: {
      type: 'string',
      optional: true,
      description: 'Conversation state: waiting, assigned, resolved',
      examples: ['waiting', 'assigned', 'resolved'],
    },

    // Participants
    customerId: {
      type: 'string',
      description: 'ID of the customer in the conversation',
    },
    assigneeId: {
      type: 'string',
      optional: true,
      description: 'ID of the assigned agent',
    },

    // Channel & Source
    channel: {
      type: 'string',
      description: 'Channel type: web, mobile, email, facebook, twitter, etc.',
      examples: ['web', 'mobile', 'email', 'facebook', 'twitter', 'whatsapp'],
    },
    source: {
      type: 'json',
      optional: true,
      description: 'Source information (URL, device, etc.)',
    },

    // Classification
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    priority: {
      type: 'number',
      optional: true,
      description: 'Priority score or level',
    },

    // Metrics
    messageCount: {
      type: 'number',
      optional: true,
      description: 'Total number of messages',
    },
    responseTime: {
      type: 'number',
      optional: true,
      description: 'Average response time in seconds',
    },
    waitingTime: {
      type: 'number',
      optional: true,
      description: 'Total time customer waited in seconds',
    },

    // Timing
    startedAt: {
      type: 'datetime',
      description: 'When the conversation started',
    },
    lastMessageAt: {
      type: 'datetime',
      optional: true,
      description: 'When the last message was sent',
    },
    closedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the conversation was closed',
    },
    snoozedUntil: {
      type: 'datetime',
      optional: true,
      description: 'When a snoozed conversation should reopen',
    },

    // Customer context
    customerContext: {
      type: 'json',
      optional: true,
      description: 'Customer context data (location, device, page visited, etc.)',
    },

    // Rating
    rated: {
      type: 'boolean',
      optional: true,
      description: 'Whether the customer rated the conversation',
    },
  },

  relationships: {
    customer: {
      type: 'Contact',
      description: 'The customer in the conversation',
    },
    assignee: {
      type: 'Contact',
      required: false,
      description: 'The assigned support agent',
    },
    messages: {
      type: 'ConversationMessage[]',
      backref: 'conversation',
      description: 'Messages in this conversation',
    },
    ticket: {
      type: 'SupportTicket',
      required: false,
      description: 'Support ticket created from this conversation',
    },
    satisfactionRating: {
      type: 'SatisfactionRating',
      required: false,
      backref: 'conversation',
      description: 'Customer satisfaction rating for this conversation',
    },
  },

  actions: [
    'start',
    'reply',
    'assign',
    'reassign',
    'transfer',
    'close',
    'reopen',
    'snooze',
    'unsnooze',
    'addTags',
    'removeTags',
    'addNote',
    'markSpam',
    'createTicket',
    'requestRating',
  ],

  events: [
    'started',
    'messageSent',
    'messageReceived',
    'assigned',
    'reassigned',
    'transferred',
    'closed',
    'reopened',
    'snoozed',
    'unsnoozed',
    'tagged',
    'noteAdded',
    'markedSpam',
    'ticketCreated',
    'rated',
  ],
}

/**
 * Conversation message entity
 *
 * Represents a single message in a live chat conversation
 */
export const ConversationMessage: Noun = {
  singular: 'conversation message',
  plural: 'conversation messages',
  description: 'A single message in a live chat conversation',

  properties: {
    // Content
    body: {
      type: 'string',
      description: 'Message text content',
    },
    html: {
      type: 'string',
      optional: true,
      description: 'HTML formatted content',
    },

    // Type
    messageType: {
      type: 'string',
      description: 'Message type: text, note, assignment, system',
      examples: ['text', 'note', 'assignment', 'system'],
    },

    // Author
    senderId: {
      type: 'string',
      description: 'ID of the person who sent the message',
    },
    senderType: {
      type: 'string',
      description: 'Type of sender: customer, agent, bot, system',
      examples: ['customer', 'agent', 'bot', 'system'],
    },

    // Delivery
    deliveredAt: {
      type: 'datetime',
      optional: true,
      description: 'When the message was delivered',
    },
    readAt: {
      type: 'datetime',
      optional: true,
      description: 'When the message was read',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional message metadata',
    },
  },

  relationships: {
    conversation: {
      type: 'Conversation',
      backref: 'messages',
      description: 'The conversation this message belongs to',
    },
    sender: {
      type: 'Contact',
      description: 'Who sent the message',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to this message',
    },
  },

  actions: [
    'send',
    'edit',
    'delete',
    'markRead',
    'addAttachment',
    'react',
  ],

  events: [
    'sent',
    'delivered',
    'read',
    'edited',
    'deleted',
    'attachmentAdded',
    'reacted',
  ],
}

// =============================================================================
// Help Center / Knowledge Base
// =============================================================================

/**
 * Help article entity
 *
 * Represents a help center or knowledge base article
 */
export const HelpArticle: Noun = {
  singular: 'help article',
  plural: 'help articles',
  description: 'A help center or knowledge base article',

  properties: {
    // Content
    title: {
      type: 'string',
      description: 'Article title',
    },
    body: {
      type: 'markdown',
      description: 'Article content in markdown',
    },
    html: {
      type: 'string',
      optional: true,
      description: 'Article content in HTML',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Brief description or excerpt',
    },

    // Organization
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly slug',
    },
    categoryId: {
      type: 'string',
      optional: true,
      description: 'ID of the category this article belongs to',
    },
    position: {
      type: 'number',
      optional: true,
      description: 'Display order within category',
    },

    // Visibility
    status: {
      type: 'string',
      description: 'Article status: draft, published, archived',
      examples: ['draft', 'published', 'archived'],
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Who can see: public, internal, restricted',
      examples: ['public', 'internal', 'restricted'],
    },

    // Author & Attribution
    authorId: {
      type: 'string',
      optional: true,
      description: 'ID of the article author',
    },
    lastUpdatedBy: {
      type: 'string',
      optional: true,
      description: 'ID of the last person to update the article',
    },

    // Engagement
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of times article has been viewed',
    },
    upvoteCount: {
      type: 'number',
      optional: true,
      description: 'Number of positive votes',
    },
    downvoteCount: {
      type: 'number',
      optional: true,
      description: 'Number of negative votes',
    },
    helpfulCount: {
      type: 'number',
      optional: true,
      description: 'Number of "helpful" votes',
    },

    // SEO
    metaTitle: {
      type: 'string',
      optional: true,
      description: 'SEO meta title',
    },
    metaDescription: {
      type: 'string',
      optional: true,
      description: 'SEO meta description',
    },
    keywords: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Keywords for search',
    },

    // Timing
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the article was published',
    },
    lastUpdatedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the article was last updated',
    },

    // Localization
    locale: {
      type: 'string',
      optional: true,
      description: 'Language/locale code',
    },
  },

  relationships: {
    category: {
      type: 'HelpCategory',
      required: false,
      backref: 'articles',
      description: 'Category this article belongs to',
    },
    author: {
      type: 'Contact',
      required: false,
      description: 'Article author',
    },
    relatedArticles: {
      type: 'HelpArticle[]',
      description: 'Related or suggested articles',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Images and files in the article',
    },
  },

  actions: [
    'create',
    'edit',
    'publish',
    'unpublish',
    'archive',
    'delete',
    'move',
    'duplicate',
    'translate',
    'upvote',
    'downvote',
    'markHelpful',
    'markNotHelpful',
    'view',
    'search',
  ],

  events: [
    'created',
    'edited',
    'published',
    'unpublished',
    'archived',
    'deleted',
    'moved',
    'duplicated',
    'translated',
    'viewed',
    'upvoted',
    'downvoted',
    'markedHelpful',
    'markedNotHelpful',
  ],
}

/**
 * Help category entity
 *
 * Represents a category for organizing help articles
 */
export const HelpCategory: Noun = {
  singular: 'help category',
  plural: 'help categories',
  description: 'A category for organizing help articles',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Category name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Category description',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly slug',
    },

    // Organization
    parentId: {
      type: 'string',
      optional: true,
      description: 'ID of parent category for nested structure',
    },
    position: {
      type: 'number',
      optional: true,
      description: 'Display order',
    },

    // Display
    icon: {
      type: 'string',
      optional: true,
      description: 'Icon name or emoji',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Display color (hex code)',
    },

    // Visibility
    visibility: {
      type: 'string',
      optional: true,
      description: 'Who can see: public, internal, restricted',
      examples: ['public', 'internal', 'restricted'],
    },

    // Metrics
    articleCount: {
      type: 'number',
      optional: true,
      description: 'Number of articles in this category',
    },

    // Localization
    locale: {
      type: 'string',
      optional: true,
      description: 'Language/locale code',
    },
  },

  relationships: {
    parent: {
      type: 'HelpCategory',
      required: false,
      description: 'Parent category for nested structure',
    },
    subcategories: {
      type: 'HelpCategory[]',
      description: 'Child categories',
    },
    articles: {
      type: 'HelpArticle[]',
      backref: 'category',
      description: 'Articles in this category',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'move',
    'reorder',
    'addArticle',
    'removeArticle',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'moved',
    'reordered',
    'articleAdded',
    'articleRemoved',
  ],
}

/**
 * FAQ entity
 *
 * Represents a frequently asked question with answer
 */
export const FAQ: Noun = {
  singular: 'FAQ',
  plural: 'FAQs',
  description: 'A frequently asked question with answer',

  properties: {
    // Content
    question: {
      type: 'string',
      description: 'The question text',
    },
    answer: {
      type: 'string',
      description: 'The answer text',
    },
    answerHtml: {
      type: 'string',
      optional: true,
      description: 'HTML formatted answer',
    },

    // Organization
    categoryId: {
      type: 'string',
      optional: true,
      description: 'Category or topic ID',
    },
    position: {
      type: 'number',
      optional: true,
      description: 'Display order',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Visibility
    status: {
      type: 'string',
      description: 'Status: draft, published, archived',
      examples: ['draft', 'published', 'archived'],
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Who can see: public, internal',
      examples: ['public', 'internal'],
    },

    // Engagement
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of views',
    },
    helpfulCount: {
      type: 'number',
      optional: true,
      description: 'Number of "helpful" votes',
    },
    notHelpfulCount: {
      type: 'number',
      optional: true,
      description: 'Number of "not helpful" votes',
    },

    // Timing
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When published',
    },

    // Localization
    locale: {
      type: 'string',
      optional: true,
      description: 'Language/locale code',
    },
  },

  relationships: {
    category: {
      type: 'HelpCategory',
      required: false,
      description: 'Category this FAQ belongs to',
    },
    relatedArticles: {
      type: 'HelpArticle[]',
      description: 'Related help articles',
    },
  },

  actions: [
    'create',
    'edit',
    'publish',
    'unpublish',
    'archive',
    'delete',
    'reorder',
    'markHelpful',
    'markNotHelpful',
    'view',
  ],

  events: [
    'created',
    'edited',
    'published',
    'unpublished',
    'archived',
    'deleted',
    'reordered',
    'viewed',
    'markedHelpful',
    'markedNotHelpful',
  ],
}

// =============================================================================
// Customer Feedback
// =============================================================================

/**
 * Satisfaction rating entity
 *
 * Represents a CSAT/NPS rating from a customer
 */
export const SatisfactionRating: Noun = {
  singular: 'satisfaction rating',
  plural: 'satisfaction ratings',
  description: 'A customer satisfaction (CSAT) or NPS rating',

  properties: {
    // Rating
    score: {
      type: 'number',
      description: 'Rating score (e.g., 1-5 for CSAT, 0-10 for NPS)',
    },
    ratingType: {
      type: 'string',
      description: 'Type of rating: csat, nps, ces, custom',
      examples: ['csat', 'nps', 'ces', 'custom'],
    },
    sentiment: {
      type: 'string',
      optional: true,
      description: 'Calculated sentiment: positive, neutral, negative, promoter, passive, detractor',
      examples: ['positive', 'neutral', 'negative', 'promoter', 'passive', 'detractor'],
    },

    // Feedback
    comment: {
      type: 'string',
      optional: true,
      description: 'Optional text feedback from customer',
    },
    reason: {
      type: 'string',
      optional: true,
      description: 'Reason for the rating (category)',
    },

    // Context
    customerId: {
      type: 'string',
      description: 'ID of the customer who provided the rating',
    },
    agentId: {
      type: 'string',
      optional: true,
      description: 'ID of the agent who was rated',
    },

    // Association
    ticketId: {
      type: 'string',
      optional: true,
      description: 'ID of the ticket being rated',
    },
    conversationId: {
      type: 'string',
      optional: true,
      description: 'ID of the conversation being rated',
    },

    // Source
    channel: {
      type: 'string',
      optional: true,
      description: 'How the rating was collected: email, web, in-app, sms',
      examples: ['email', 'web', 'in-app', 'sms'],
    },

    // Timing
    requestedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the rating was requested',
    },
    respondedAt: {
      type: 'datetime',
      description: 'When the customer responded',
    },

    // Status
    reviewed: {
      type: 'boolean',
      optional: true,
      description: 'Whether the rating has been reviewed by staff',
    },
    reviewedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the rating was reviewed',
    },
    reviewedBy: {
      type: 'string',
      optional: true,
      description: 'ID of the person who reviewed the rating',
    },

    // Follow-up
    followedUp: {
      type: 'boolean',
      optional: true,
      description: 'Whether follow-up action was taken',
    },
    followUpNote: {
      type: 'string',
      optional: true,
      description: 'Notes about follow-up action',
    },
  },

  relationships: {
    customer: {
      type: 'Contact',
      description: 'The customer who provided the rating',
    },
    agent: {
      type: 'Contact',
      required: false,
      description: 'The agent who was rated',
    },
    ticket: {
      type: 'SupportTicket',
      required: false,
      backref: 'satisfactionRating',
      description: 'The ticket being rated',
    },
    conversation: {
      type: 'Conversation',
      required: false,
      backref: 'satisfactionRating',
      description: 'The conversation being rated',
    },
  },

  actions: [
    'submit',
    'update',
    'review',
    'followUp',
    'dismiss',
    'export',
    'analyze',
  ],

  events: [
    'submitted',
    'updated',
    'reviewed',
    'followedUp',
    'dismissed',
    'exported',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All support/helpdesk entity types
 */
export const SupportEntities = {
  // Support Tickets
  SupportTicket,
  TicketComment,

  // Live Chat
  Conversation,
  ConversationMessage,

  // Help Center
  HelpArticle,
  HelpCategory,
  FAQ,

  // Feedback
  SatisfactionRating,
}

/**
 * Entity categories for organization
 */
export const SupportCategories = {
  tickets: ['SupportTicket', 'TicketComment'],
  liveChat: ['Conversation', 'ConversationMessage'],
  helpCenter: ['HelpArticle', 'HelpCategory', 'FAQ'],
  feedback: ['SatisfactionRating'],
} as const
