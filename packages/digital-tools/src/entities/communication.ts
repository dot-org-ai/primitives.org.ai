/**
 * Communication Entity Types (Nouns)
 *
 * Simplified single-word nouns for all communication primitives.
 * Uses `type` property to distinguish variants rather than separate entities.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Message
// =============================================================================

/**
 * Message entity
 *
 * Universal async communication unit. The `type` property distinguishes:
 * - email: Traditional email message
 * - text: SMS/MMS text message
 * - chat: Team chat message (Slack, Teams, Discord)
 * - direct: Person-to-person direct message
 * - voicemail: Recorded voice message
 */
export const Message: Noun = {
  singular: 'message',
  plural: 'messages',
  description: 'An async communication unit (email, text, chat, direct, voicemail)',

  properties: {
    // Type
    type: {
      type: 'string',
      description: 'Message type: email, text, chat, direct, voicemail',
      examples: ['email', 'text', 'chat', 'direct', 'voicemail'],
    },

    // Identity
    id: {
      type: 'string',
      description: 'Unique message identifier',
    },

    // Addressing
    from: {
      type: 'string',
      description: 'Sender address (email, phone, user ID)',
    },
    to: {
      type: 'string',
      array: true,
      description: 'Recipient addresses',
    },
    cc: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Carbon copy recipients (email only)',
    },
    bcc: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Blind carbon copy recipients (email only)',
    },
    replyTo: {
      type: 'string',
      optional: true,
      description: 'Reply-to address',
    },

    // Content
    subject: {
      type: 'string',
      optional: true,
      description: 'Message subject (email, some chat systems)',
    },
    body: {
      type: 'string',
      description: 'Message content (plain text)',
    },
    html: {
      type: 'string',
      optional: true,
      description: 'HTML content (email)',
    },
    mediaUrl: {
      type: 'url',
      optional: true,
      description: 'Media URL (voicemail audio, MMS image)',
    },

    // Threading
    threadId: {
      type: 'string',
      optional: true,
      description: 'Thread/conversation identifier',
    },
    parentId: {
      type: 'string',
      optional: true,
      description: 'Parent message ID (for replies)',
    },
    replyToId: {
      type: 'string',
      optional: true,
      description: 'Message being replied to',
    },

    // Channel context (for chat type)
    channelId: {
      type: 'string',
      optional: true,
      description: 'Channel identifier (chat messages)',
    },
    workspaceId: {
      type: 'string',
      optional: true,
      description: 'Workspace identifier (chat messages)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Message status',
      examples: ['draft', 'queued', 'sent', 'delivered', 'read', 'failed', 'bounced'],
    },
    read: {
      type: 'boolean',
      optional: true,
      description: 'Whether message has been read',
    },
    starred: {
      type: 'boolean',
      optional: true,
      description: 'Whether message is starred/flagged',
    },

    // Voicemail specific
    duration: {
      type: 'number',
      optional: true,
      description: 'Duration in seconds (voicemail)',
    },
    transcription: {
      type: 'string',
      optional: true,
      description: 'Transcribed text (voicemail)',
    },

    // Metadata
    labels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Labels or tags',
    },
    priority: {
      type: 'string',
      optional: true,
      description: 'Priority: low, normal, high, urgent',
      examples: ['low', 'normal', 'high', 'urgent'],
    },
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    thread: {
      type: 'Thread',
      backref: 'messages',
      required: false,
      description: 'Thread this message belongs to',
    },
    sender: {
      type: 'Contact',
      description: 'Sender as contact',
    },
    recipients: {
      type: 'Contact[]',
      description: 'Recipients as contacts',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'File attachments',
    },
    reactions: {
      type: 'Reaction[]',
      backref: 'message',
      description: 'Emoji reactions',
    },
    channel: {
      type: 'Channel',
      required: false,
      description: 'Channel (for chat messages)',
    },
  },

  actions: [
    'send',
    'reply',
    'forward',
    'edit',
    'delete',
    'archive',
    'star',
    'unstar',
    'read',
    'unread',
    'label',
    'unlabel',
    'pin',
    'unpin',
    'react',
    'transcribe',
    'schedule',
  ],

  events: [
    'sent',
    'delivered',
    'read',
    'failed',
    'bounced',
    'opened',
    'clicked',
    'replied',
    'forwarded',
    'edited',
    'deleted',
    'archived',
    'starred',
    'labeled',
    'pinned',
    'reacted',
    'transcribed',
  ],
}

// =============================================================================
// Thread
// =============================================================================

/**
 * Thread entity
 *
 * Container for related messages. Works for email threads, chat threads,
 * SMS conversations, etc.
 */
export const Thread: Noun = {
  singular: 'thread',
  plural: 'threads',
  description: 'A container for related messages (conversation)',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique thread identifier',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Thread type: email, text, chat',
      examples: ['email', 'text', 'chat'],
    },

    // Content summary
    subject: {
      type: 'string',
      optional: true,
      description: 'Thread subject',
    },
    snippet: {
      type: 'string',
      optional: true,
      description: 'Preview of latest message',
    },
    messageCount: {
      type: 'number',
      optional: true,
      description: 'Number of messages in thread',
    },

    // Participants
    participants: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Participant addresses/IDs',
    },

    // Status
    read: {
      type: 'boolean',
      optional: true,
      description: 'Whether all messages are read',
    },
    unreadCount: {
      type: 'number',
      optional: true,
      description: 'Number of unread messages',
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether thread is archived',
    },
    muted: {
      type: 'boolean',
      optional: true,
      description: 'Whether notifications are muted',
    },
    starred: {
      type: 'boolean',
      optional: true,
      description: 'Whether thread is starred',
    },
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether thread is pinned',
    },

    // Metadata
    labels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Labels or tags',
    },
    lastMessageAt: {
      type: 'datetime',
      optional: true,
      description: 'Timestamp of last message',
    },
  },

  relationships: {
    messages: {
      type: 'Message[]',
      backref: 'thread',
      description: 'Messages in this thread',
    },
    channel: {
      type: 'Channel',
      required: false,
      description: 'Channel (for chat threads)',
    },
  },

  actions: [
    'archive',
    'unarchive',
    'delete',
    'read',
    'unread',
    'mute',
    'unmute',
    'star',
    'unstar',
    'pin',
    'unpin',
    'label',
    'unlabel',
    'move',
  ],

  events: [
    'created',
    'updated',
    'archived',
    'deleted',
    'read',
    'muted',
    'unmuted',
    'starred',
    'pinned',
    'labeled',
    'moved',
  ],
}

// =============================================================================
// Call
// =============================================================================

/**
 * Call entity
 *
 * Real-time voice/video communication. The `type` property distinguishes:
 * - phone: Traditional phone call
 * - web: Browser-based call
 * - video: Video call
 */
export const Call: Noun = {
  singular: 'call',
  plural: 'calls',
  description: 'A real-time voice or video communication',

  properties: {
    // Type
    type: {
      type: 'string',
      description: 'Call type: phone, web, video',
      examples: ['phone', 'web', 'video'],
    },

    // Identity
    id: {
      type: 'string',
      description: 'Unique call identifier',
    },

    // Direction
    direction: {
      type: 'string',
      description: 'Call direction: inbound, outbound',
      examples: ['inbound', 'outbound'],
    },

    // Participants
    from: {
      type: 'string',
      description: 'Caller address (phone number, user ID)',
    },
    to: {
      type: 'string',
      description: 'Callee address',
    },
    participants: {
      type: 'string',
      array: true,
      optional: true,
      description: 'All participants (for group calls)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Call status',
      examples: ['queued', 'ringing', 'answered', 'active', 'hold', 'ended', 'failed', 'busy', 'noanswer'],
    },

    // Timing
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When call started',
    },
    answeredAt: {
      type: 'datetime',
      optional: true,
      description: 'When call was answered',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'When call ended',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Call duration in seconds',
    },

    // Recording
    recorded: {
      type: 'boolean',
      optional: true,
      description: 'Whether call was recorded',
    },
    recordingUrl: {
      type: 'url',
      optional: true,
      description: 'URL to recording',
    },

    // Transcription
    transcription: {
      type: 'string',
      optional: true,
      description: 'Call transcription',
    },
    transcript: {
      type: 'json',
      optional: true,
      description: 'Detailed transcript with timestamps',
    },

    // AI/Assistant (for voice AI calls)
    assistantId: {
      type: 'string',
      optional: true,
      description: 'AI assistant ID (for AI calls)',
    },
    summary: {
      type: 'string',
      optional: true,
      description: 'AI-generated call summary',
    },
    analysis: {
      type: 'json',
      optional: true,
      description: 'Call analysis/structured data',
    },

    // Cost
    cost: {
      type: 'number',
      optional: true,
      description: 'Call cost',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Quality
    quality: {
      type: 'string',
      optional: true,
      description: 'Call quality: excellent, good, fair, poor',
      examples: ['excellent', 'good', 'fair', 'poor'],
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    caller: {
      type: 'Contact',
      description: 'Caller as contact',
    },
    callee: {
      type: 'Contact',
      description: 'Callee as contact',
    },
    messages: {
      type: 'Message[]',
      description: 'Related messages (voicemail if missed)',
    },
  },

  actions: [
    'initiate',
    'answer',
    'reject',
    'hold',
    'unhold',
    'mute',
    'unmute',
    'transfer',
    'merge',
    'record',
    'transcribe',
    'end',
  ],

  events: [
    'initiated',
    'ringing',
    'answered',
    'rejected',
    'held',
    'unheld',
    'muted',
    'unmuted',
    'transferred',
    'merged',
    'recorded',
    'transcribed',
    'ended',
    'failed',
  ],
}

// =============================================================================
// Channel
// =============================================================================

/**
 * Channel entity
 *
 * Persistent topic-based communication space.
 */
export const Channel: Noun = {
  singular: 'channel',
  plural: 'channels',
  description: 'A persistent topic-based communication space',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique channel identifier',
    },
    name: {
      type: 'string',
      description: 'Channel name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Channel description/purpose',
    },
    topic: {
      type: 'string',
      optional: true,
      description: 'Current topic',
    },

    // Type
    type: {
      type: 'string',
      description: 'Channel type: public, private, shared',
      examples: ['public', 'private', 'shared'],
    },

    // Status
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether channel is archived',
    },
    muted: {
      type: 'boolean',
      optional: true,
      description: 'Whether notifications are muted',
    },

    // Membership
    memberCount: {
      type: 'number',
      optional: true,
      description: 'Number of members',
    },

    // Metadata
    createdAt: {
      type: 'datetime',
      description: 'Creation timestamp',
    },
    lastActivityAt: {
      type: 'datetime',
      optional: true,
      description: 'Last activity timestamp',
    },
  },

  relationships: {
    workspace: {
      type: 'Workspace',
      backref: 'channels',
      description: 'Parent workspace',
    },
    members: {
      type: 'Member[]',
      backref: 'channels',
      description: 'Channel members',
    },
    messages: {
      type: 'Message[]',
      description: 'Messages in channel',
    },
    threads: {
      type: 'Thread[]',
      backref: 'channel',
      description: 'Threads in channel',
    },
    pins: {
      type: 'Message[]',
      description: 'Pinned messages',
    },
  },

  actions: [
    'create',
    'rename',
    'topic',
    'archive',
    'unarchive',
    'delete',
    'join',
    'leave',
    'invite',
    'kick',
    'mute',
    'unmute',
    'pin',
    'unpin',
  ],

  events: [
    'created',
    'renamed',
    'topicSet',
    'archived',
    'unarchived',
    'deleted',
    'joined',
    'left',
    'invited',
    'kicked',
    'muted',
    'unmuted',
    'pinned',
    'unpinned',
  ],
}

// =============================================================================
// Workspace
// =============================================================================

/**
 * Workspace entity
 *
 * Team/organization container for channels and members.
 */
export const Workspace: Noun = {
  singular: 'workspace',
  plural: 'workspaces',
  description: 'A team or organization container',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique workspace identifier',
    },
    name: {
      type: 'string',
      description: 'Workspace name',
    },
    domain: {
      type: 'string',
      optional: true,
      description: 'Workspace domain/slug',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Workspace description',
    },

    // Branding
    icon: {
      type: 'url',
      optional: true,
      description: 'Workspace icon URL',
    },

    // Status
    plan: {
      type: 'string',
      optional: true,
      description: 'Subscription plan',
    },

    // Counts
    memberCount: {
      type: 'number',
      optional: true,
      description: 'Number of members',
    },
    channelCount: {
      type: 'number',
      optional: true,
      description: 'Number of channels',
    },
  },

  relationships: {
    channels: {
      type: 'Channel[]',
      backref: 'workspace',
      description: 'Channels in workspace',
    },
    members: {
      type: 'Member[]',
      backref: 'workspace',
      description: 'Workspace members',
    },
    owner: {
      type: 'Contact',
      description: 'Workspace owner',
    },
  },

  actions: [
    'create',
    'rename',
    'invite',
    'remove',
    'archive',
    'delete',
    'transfer',
  ],

  events: [
    'created',
    'renamed',
    'invited',
    'removed',
    'archived',
    'deleted',
    'transferred',
  ],
}

// =============================================================================
// Member
// =============================================================================

/**
 * Member entity
 *
 * A user's membership in a workspace/channel.
 */
export const Member: Noun = {
  singular: 'member',
  plural: 'members',
  description: 'A user membership in a workspace or channel',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique member identifier',
    },
    userId: {
      type: 'string',
      description: 'User identifier',
    },

    // Profile
    name: {
      type: 'string',
      description: 'Display name',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Email address',
    },
    avatar: {
      type: 'url',
      optional: true,
      description: 'Avatar URL',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },

    // Role
    role: {
      type: 'string',
      description: 'Member role: owner, admin, member, guest',
      examples: ['owner', 'admin', 'member', 'guest'],
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Presence status: active, away, dnd, offline',
      examples: ['active', 'away', 'dnd', 'offline'],
    },
    statusText: {
      type: 'string',
      optional: true,
      description: 'Custom status text',
    },
    statusEmoji: {
      type: 'string',
      optional: true,
      description: 'Status emoji',
    },

    // Activity
    lastActiveAt: {
      type: 'datetime',
      optional: true,
      description: 'Last activity timestamp',
    },
    joinedAt: {
      type: 'datetime',
      description: 'Join timestamp',
    },
  },

  relationships: {
    workspace: {
      type: 'Workspace',
      backref: 'members',
      description: 'Workspace membership',
    },
    channels: {
      type: 'Channel[]',
      backref: 'members',
      description: 'Channel memberships',
    },
    contact: {
      type: 'Contact',
      description: 'Associated contact',
    },
  },

  actions: [
    'invite',
    'remove',
    'promote',
    'demote',
    'activate',
    'deactivate',
    'status',
  ],

  events: [
    'invited',
    'joined',
    'removed',
    'promoted',
    'demoted',
    'activated',
    'deactivated',
    'statusChanged',
  ],
}

// =============================================================================
// Contact
// =============================================================================

/**
 * Contact entity
 *
 * A person or entity you communicate with.
 */
export const Contact: Noun = {
  singular: 'contact',
  plural: 'contacts',
  description: 'A person or entity for communication',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique contact identifier',
    },

    // Name
    name: {
      type: 'string',
      description: 'Full name',
    },
    firstName: {
      type: 'string',
      optional: true,
      description: 'First name',
    },
    lastName: {
      type: 'string',
      optional: true,
      description: 'Last name',
    },
    nickname: {
      type: 'string',
      optional: true,
      description: 'Nickname',
    },

    // Contact info
    email: {
      type: 'string',
      optional: true,
      description: 'Email address',
    },
    phone: {
      type: 'string',
      optional: true,
      description: 'Phone number',
    },
    avatar: {
      type: 'url',
      optional: true,
      description: 'Avatar URL',
    },

    // Organization
    company: {
      type: 'string',
      optional: true,
      description: 'Company name',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },

    // Address
    address: {
      type: 'json',
      optional: true,
      description: 'Address',
    },

    // Social
    social: {
      type: 'json',
      optional: true,
      description: 'Social media handles',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags',
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Notes',
    },
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional metadata',
    },
  },

  relationships: {
    messages: {
      type: 'Message[]',
      description: 'Messages with this contact',
    },
    calls: {
      type: 'Call[]',
      description: 'Calls with this contact',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'merge',
    'tag',
    'untag',
    'block',
    'unblock',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'merged',
    'tagged',
    'blocked',
    'unblocked',
  ],
}

// =============================================================================
// Attachment
// =============================================================================

/**
 * Attachment entity
 *
 * A file attached to a message.
 */
export const Attachment: Noun = {
  singular: 'attachment',
  plural: 'attachments',
  description: 'A file attached to a message',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique attachment identifier',
    },

    // File info
    name: {
      type: 'string',
      description: 'File name',
    },
    type: {
      type: 'string',
      description: 'MIME type',
    },
    size: {
      type: 'number',
      description: 'File size in bytes',
    },
    url: {
      type: 'url',
      description: 'Download URL',
    },

    // Preview
    thumbnail: {
      type: 'url',
      optional: true,
      description: 'Thumbnail URL',
    },
    preview: {
      type: 'string',
      optional: true,
      description: 'Preview content',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'File metadata',
    },
  },

  relationships: {
    message: {
      type: 'Message',
      backref: 'attachments',
      description: 'Parent message',
    },
  },

  actions: [
    'upload',
    'download',
    'preview',
    'delete',
  ],

  events: [
    'uploaded',
    'downloaded',
    'previewed',
    'deleted',
  ],
}

// =============================================================================
// Reaction
// =============================================================================

/**
 * Reaction entity
 *
 * An emoji reaction to a message.
 */
export const Reaction: Noun = {
  singular: 'reaction',
  plural: 'reactions',
  description: 'An emoji reaction to a message',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Unique reaction identifier',
    },

    // Emoji
    emoji: {
      type: 'string',
      description: 'Emoji character or code',
    },
    name: {
      type: 'string',
      optional: true,
      description: 'Emoji name',
    },

    // Count
    count: {
      type: 'number',
      optional: true,
      description: 'Number of users who reacted',
    },
  },

  relationships: {
    message: {
      type: 'Message',
      backref: 'reactions',
      description: 'Message being reacted to',
    },
    user: {
      type: 'Contact',
      description: 'User who reacted',
    },
  },

  actions: [
    'add',
    'remove',
  ],

  events: [
    'added',
    'removed',
  ],
}

// =============================================================================
// Export
// =============================================================================

/**
 * All communication entities
 */
export const CommunicationEntities = {
  Message,
  Thread,
  Call,
  Channel,
  Workspace,
  Member,
  Contact,
  Attachment,
  Reaction,
}

/**
 * Communication categories
 */
export const CommunicationCategories = {
  messaging: ['Message', 'Thread', 'Attachment', 'Reaction'],
  voice: ['Call'],
  team: ['Channel', 'Workspace', 'Member'],
  contacts: ['Contact'],
} as const
