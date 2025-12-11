/**
 * Communication & Collaboration Tool Types
 *
 * Types for collaboration and communication integrations:
 * Messages, Channels, Email, Calendar, Meetings, Documents, Files, Notifications, and more.
 *
 * @module tool/collab
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
// Enums and Types
// =============================================================================

/**
 * Message type.
 */
export type MessageType = 'text' | 'file' | 'image' | 'video' | 'audio' | 'link' | 'code' | 'system'

/**
 * Message status.
 */
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'deleted'

/**
 * Channel type.
 */
export type ChannelType = 'public' | 'private' | 'direct' | 'group' | 'announcement'

/**
 * Channel visibility.
 */
export type ChannelVisibility = 'public' | 'private' | 'secret'

/**
 * Email status.
 */
export type EmailStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'

/**
 * Calendar event status.
 */
export type CalendarEventStatus = 'tentative' | 'confirmed' | 'cancelled'

/**
 * Meeting status.
 */
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

/**
 * Document status.
 */
export type DocumentStatus = 'draft' | 'published' | 'archived'

/**
 * File type category.
 */
export type FileType = 'document' | 'spreadsheet' | 'presentation' | 'image' | 'video' | 'audio' | 'archive' | 'other'

/**
 * Share permission level.
 */
export type SharePermission = 'view' | 'comment' | 'edit' | 'admin'

/**
 * Notification type.
 */
export type NotificationType =
  | 'message'
  | 'mention'
  | 'reaction'
  | 'comment'
  | 'share'
  | 'calendar'
  | 'meeting'
  | 'announcement'
  | 'system'

/**
 * Notification delivery channel.
 */
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push' | 'webhook'

// =============================================================================
// Message
// =============================================================================

/**
 * Message attachment.
 */
export interface MessageAttachment {
  /** Unique identifier */
  id: string

  /** File name */
  name: string

  /** File URL */
  url: string

  /** File type */
  type: string

  /** File size in bytes */
  size: number

  /** Thumbnail URL */
  thumbnailUrl?: string

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Message in a conversation, channel, or thread.
 *
 * @example
 * ```ts
 * const message: Message = {
 *   id: 'msg_123',
 *   threadId: 'thread_456',
 *   channelId: 'chan_789',
 *   type: 'text',
 *   content: 'Hello team!',
 *   senderId: 'user_123',
 *   status: 'sent',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Message {
  /** Unique identifier */
  id: string

  /** Thread ID (if part of a thread) */
  threadId?: string

  /** Channel ID (if in a channel) */
  channelId?: string

  /** Conversation ID (if in a conversation) */
  conversationId?: string

  /** Direct message ID (if in a DM) */
  directMessageId?: string

  /** Message type */
  type: MessageType

  /** Message content */
  content: string

  /** Sender user ID */
  senderId: string

  /** Message status */
  status: MessageStatus

  /** Attachments */
  attachments?: MessageAttachment[]

  /** Mentions (user IDs) */
  mentions?: string[]

  /** Reactions */
  reactions?: Array<{
    emoji: string
    userId: string
    createdAt: Date
  }>

  /** Reply to message ID */
  replyToId?: string

  /** Is edited */
  isEdited?: boolean

  /** Edit timestamp */
  editedAt?: Date

  /** Is pinned */
  isPinned?: boolean

  /** Read by user IDs */
  readBy?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MessageInput = Input<Message>
export type MessageOutput = Output<Message>

// =============================================================================
// Thread
// =============================================================================

/**
 * Message thread (conversation within a message).
 *
 * @example
 * ```ts
 * const thread: Thread = {
 *   id: 'thread_123',
 *   parentMessageId: 'msg_456',
 *   channelId: 'chan_789',
 *   messageCount: 5,
 *   participantIds: ['user_1', 'user_2', 'user_3'],
 *   lastMessageAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Thread {
  /** Unique identifier */
  id: string

  /** Parent message ID */
  parentMessageId: string

  /** Channel ID */
  channelId?: string

  /** Thread title */
  title?: string

  /** Message count */
  messageCount: number

  /** Participant user IDs */
  participantIds: string[]

  /** Is archived */
  isArchived?: boolean

  /** Last message timestamp */
  lastMessageAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ThreadInput = Input<Thread>
export type ThreadOutput = Output<Thread>

// =============================================================================
// Channel
// =============================================================================

/**
 * Communication channel (Slack-like).
 *
 * @example
 * ```ts
 * const channel: Channel = {
 *   id: 'chan_123',
 *   name: 'general',
 *   type: 'public',
 *   visibility: 'public',
 *   description: 'General discussion',
 *   memberCount: 150,
 *   createdBy: 'user_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Channel {
  /** Unique identifier */
  id: string

  /** Channel name */
  name: string

  /** Channel type */
  type: ChannelType

  /** Visibility setting */
  visibility: ChannelVisibility

  /** Description */
  description?: string

  /** Topic */
  topic?: string

  /** Member count */
  memberCount: number

  /** Owner user ID */
  ownerId?: string

  /** Created by user ID */
  createdBy: string

  /** Is archived */
  isArchived?: boolean

  /** Is default (auto-join) */
  isDefault?: boolean

  /** Is read-only */
  isReadOnly?: boolean

  /** Custom settings */
  settings?: {
    allowReactions?: boolean
    allowThreads?: boolean
    allowFileUploads?: boolean
    retentionDays?: number
  }

  /** Last message timestamp */
  lastMessageAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ChannelInput = Input<Channel>
export type ChannelOutput = Output<Channel>

// =============================================================================
// ChannelMember
// =============================================================================

/**
 * Channel membership.
 *
 * @example
 * ```ts
 * const member: ChannelMember = {
 *   id: 'member_123',
 *   channelId: 'chan_456',
 *   userId: 'user_789',
 *   role: 'member',
 *   joinedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ChannelMember {
  /** Unique identifier */
  id: string

  /** Channel ID */
  channelId: string

  /** User ID */
  userId: string

  /** Member role */
  role: 'owner' | 'admin' | 'member' | 'guest'

  /** Is muted */
  isMuted?: boolean

  /** Notification preference */
  notificationPreference?: 'all' | 'mentions' | 'none'

  /** Joined timestamp */
  joinedAt: Date

  /** Last read message ID */
  lastReadMessageId?: string

  /** Last read timestamp */
  lastReadAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ChannelMemberInput = Input<ChannelMember>
export type ChannelMemberOutput = Output<ChannelMember>

// =============================================================================
// DirectMessage
// =============================================================================

/**
 * Direct message container.
 *
 * @example
 * ```ts
 * const dm: DirectMessage = {
 *   id: 'dm_123',
 *   participantIds: ['user_1', 'user_2'],
 *   messageCount: 42,
 *   lastMessageAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface DirectMessage {
  /** Unique identifier */
  id: string

  /** Participant user IDs */
  participantIds: string[]

  /** Message count */
  messageCount: number

  /** Last message timestamp */
  lastMessageAt?: Date

  /** Is archived */
  isArchived?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DirectMessageInput = Input<DirectMessage>
export type DirectMessageOutput = Output<DirectMessage>

// =============================================================================
// Conversation
// =============================================================================

/**
 * Conversation container (generic).
 *
 * @example
 * ```ts
 * const conversation: Conversation = {
 *   id: 'conv_123',
 *   title: 'Project Discussion',
 *   participantIds: ['user_1', 'user_2', 'user_3'],
 *   messageCount: 28,
 *   lastMessageAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Conversation {
  /** Unique identifier */
  id: string

  /** Conversation title */
  title?: string

  /** Participant user IDs */
  participantIds: string[]

  /** Message count */
  messageCount: number

  /** Last message timestamp */
  lastMessageAt?: Date

  /** Is archived */
  isArchived?: boolean

  /** Is muted */
  isMuted?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    intercom?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ConversationInput = Input<Conversation>
export type ConversationOutput = Output<Conversation>

// =============================================================================
// Email
// =============================================================================

/**
 * Email message.
 *
 * @example
 * ```ts
 * const email: Email = {
 *   id: 'email_123',
 *   threadId: 'thread_456',
 *   subject: 'Project Update',
 *   from: 'sender@example.com',
 *   to: ['recipient@example.com'],
 *   body: 'Email content...',
 *   status: 'sent',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Email {
  /** Unique identifier */
  id: string

  /** Thread ID */
  threadId?: string

  /** Subject line */
  subject: string

  /** From address */
  from: string

  /** To addresses */
  to: string[]

  /** CC addresses */
  cc?: string[]

  /** BCC addresses */
  bcc?: string[]

  /** Reply-to address */
  replyTo?: string

  /** Email body (HTML) */
  body: string

  /** Plain text body */
  bodyText?: string

  /** Email status */
  status: EmailStatus

  /** Attachments */
  attachments?: MessageAttachment[]

  /** Is draft */
  isDraft?: boolean

  /** Is read */
  isRead?: boolean

  /** Is starred */
  isStarred?: boolean

  /** Labels/tags */
  labels?: string[]

  /** Sent timestamp */
  sentAt?: Date

  /** Delivered timestamp */
  deliveredAt?: Date

  /** Opened timestamp */
  openedAt?: Date

  /** Click tracking */
  clickedLinks?: Array<{
    url: string
    clickedAt: Date
  }>

  /** Bounce reason */
  bounceReason?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    gmail?: string
    outlook?: string
    sendgrid?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailInput = Input<Email>
export type EmailOutput = Output<Email>

// =============================================================================
// EmailThread
// =============================================================================

/**
 * Email thread (conversation).
 *
 * @example
 * ```ts
 * const thread: EmailThread = {
 *   id: 'thread_123',
 *   subject: 'Project Update',
 *   participantEmails: ['alice@example.com', 'bob@example.com'],
 *   messageCount: 5,
 *   lastMessageAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmailThread {
  /** Unique identifier */
  id: string

  /** Thread subject */
  subject: string

  /** Participant email addresses */
  participantEmails: string[]

  /** Message count */
  messageCount: number

  /** Has unread messages */
  hasUnread?: boolean

  /** Is starred */
  isStarred?: boolean

  /** Labels */
  labels?: string[]

  /** Last message timestamp */
  lastMessageAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    gmail?: string
    outlook?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailThreadInput = Input<EmailThread>
export type EmailThreadOutput = Output<EmailThread>

// =============================================================================
// CalendarEvent
// =============================================================================

/**
 * Event attendee.
 */
export interface EventAttendee {
  /** Email address */
  email: string

  /** Display name */
  name?: string

  /** Response status */
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needs_action'

  /** Is optional */
  optional?: boolean

  /** Is organizer */
  organizer?: boolean
}

/**
 * Event recurrence rule.
 */
export interface RecurrenceRule {
  /** Frequency (daily, weekly, monthly, yearly) */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'

  /** Interval (every N days/weeks/etc) */
  interval?: number

  /** Days of week (for weekly recurrence) */
  daysOfWeek?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[]

  /** Day of month (for monthly recurrence) */
  dayOfMonth?: number

  /** End date */
  until?: Date

  /** Count of occurrences */
  count?: number
}

/**
 * Calendar event.
 *
 * @example
 * ```ts
 * const event: CalendarEvent = {
 *   id: 'evt_123',
 *   calendarId: 'cal_456',
 *   title: 'Team Standup',
 *   startTime: new Date('2024-01-15T09:00:00Z'),
 *   endTime: new Date('2024-01-15T09:30:00Z'),
 *   status: 'confirmed',
 *   attendees: [
 *     { email: 'alice@example.com', responseStatus: 'accepted' },
 *     { email: 'bob@example.com', responseStatus: 'tentative' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CalendarEvent {
  /** Unique identifier */
  id: string

  /** Calendar ID */
  calendarId: string

  /** Event title */
  title: string

  /** Description */
  description?: string

  /** Location */
  location?: string

  /** Start time */
  startTime: Date

  /** End time */
  endTime: Date

  /** Is all-day event */
  isAllDay?: boolean

  /** Timezone */
  timezone?: string

  /** Event status */
  status: CalendarEventStatus

  /** Organizer email */
  organizerEmail?: string

  /** Attendees */
  attendees?: EventAttendee[]

  /** Recurrence rule */
  recurrence?: RecurrenceRule

  /** Recurring event ID (parent) */
  recurringEventId?: string

  /** Meeting URL */
  meetingUrl?: string

  /** Meeting ID */
  meetingId?: string

  /** Reminders (minutes before) */
  reminders?: number[]

  /** Color */
  color?: string

  /** Visibility */
  visibility?: 'public' | 'private' | 'confidential'

  /** Is busy (blocks calendar) */
  isBusy?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    google?: string
    outlook?: string
    apple?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CalendarEventInput = Input<CalendarEvent>
export type CalendarEventOutput = Output<CalendarEvent>

// =============================================================================
// CalendarInvite
// =============================================================================

/**
 * Calendar event invitation.
 *
 * @example
 * ```ts
 * const invite: CalendarInvite = {
 *   id: 'inv_123',
 *   eventId: 'evt_456',
 *   attendeeEmail: 'bob@example.com',
 *   responseStatus: 'needs_action',
 *   sentAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CalendarInvite {
  /** Unique identifier */
  id: string

  /** Calendar event ID */
  eventId: string

  /** Attendee email */
  attendeeEmail: string

  /** Attendee name */
  attendeeName?: string

  /** Response status */
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needs_action'

  /** Is optional attendee */
  optional?: boolean

  /** Sent timestamp */
  sentAt?: Date

  /** Response timestamp */
  respondedAt?: Date

  /** Response comment */
  responseComment?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    google?: string
    outlook?: string
    apple?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CalendarInviteInput = Input<CalendarInvite>
export type CalendarInviteOutput = Output<CalendarInvite>

// =============================================================================
// Calendar
// =============================================================================

/**
 * Calendar.
 *
 * @example
 * ```ts
 * const calendar: Calendar = {
 *   id: 'cal_123',
 *   name: 'Work Calendar',
 *   ownerId: 'user_456',
 *   timezone: 'America/New_York',
 *   isDefault: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Calendar {
  /** Unique identifier */
  id: string

  /** Calendar name */
  name: string

  /** Description */
  description?: string

  /** Owner user ID */
  ownerId: string

  /** Timezone */
  timezone?: string

  /** Color */
  color?: string

  /** Is default calendar */
  isDefault?: boolean

  /** Is public */
  isPublic?: boolean

  /** Can edit */
  canEdit?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    google?: string
    outlook?: string
    apple?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CalendarInput = Input<Calendar>
export type CalendarOutput = Output<Calendar>

// =============================================================================
// Availability
// =============================================================================

/**
 * Availability slot.
 *
 * @example
 * ```ts
 * const availability: Availability = {
 *   id: 'avail_123',
 *   userId: 'user_456',
 *   dayOfWeek: 'monday',
 *   startTime: '09:00',
 *   endTime: '17:00',
 *   timezone: 'America/New_York',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Availability {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Day of week */
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

  /** Start time (HH:MM) */
  startTime: string

  /** End time (HH:MM) */
  endTime: string

  /** Timezone */
  timezone?: string

  /** Is available */
  isAvailable: boolean

  /** Recurrence rule */
  recurrence?: RecurrenceRule

  /** Valid from date */
  validFrom?: Date

  /** Valid until date */
  validUntil?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    calendly?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AvailabilityInput = Input<Availability>
export type AvailabilityOutput = Output<Availability>

// =============================================================================
// Meeting
// =============================================================================

/**
 * Meeting.
 *
 * @example
 * ```ts
 * const meeting: Meeting = {
 *   id: 'meet_123',
 *   title: 'Product Review',
 *   eventId: 'evt_456',
 *   status: 'scheduled',
 *   startTime: new Date('2024-01-15T14:00:00Z'),
 *   endTime: new Date('2024-01-15T15:00:00Z'),
 *   participantIds: ['user_1', 'user_2', 'user_3'],
 *   meetingUrl: 'https://zoom.us/j/123456789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Meeting {
  /** Unique identifier */
  id: string

  /** Meeting title */
  title: string

  /** Description/agenda */
  description?: string

  /** Related calendar event ID */
  eventId?: string

  /** Meeting status */
  status: MeetingStatus

  /** Start time */
  startTime: Date

  /** End time */
  endTime: Date

  /** Timezone */
  timezone?: string

  /** Meeting URL (Zoom, Meet, Teams, etc.) */
  meetingUrl?: string

  /** Meeting password */
  meetingPassword?: string

  /** Host user ID */
  hostId: string

  /** Participant user IDs */
  participantIds: string[]

  /** Actual start time */
  actualStartTime?: Date

  /** Actual end time */
  actualEndTime?: Date

  /** Recording URL */
  recordingUrl?: string

  /** Recording ID */
  recordingId?: string

  /** Transcript ID */
  transcriptId?: string

  /** Notes */
  notes?: string

  /** Action items */
  actionItems?: Array<{
    description: string
    assigneeId?: string
    dueDate?: Date
  }>

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    zoom?: string
    meet?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MeetingInput = Input<Meeting>
export type MeetingOutput = Output<Meeting>

// =============================================================================
// MeetingRecording
// =============================================================================

/**
 * Meeting recording.
 *
 * @example
 * ```ts
 * const recording: MeetingRecording = {
 *   id: 'rec_123',
 *   meetingId: 'meet_456',
 *   name: 'Product Review Recording',
 *   url: 'https://recordings.example.com/rec_123',
 *   duration: 3600,
 *   size: 1048576000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface MeetingRecording {
  /** Unique identifier */
  id: string

  /** Meeting ID */
  meetingId: string

  /** Recording name */
  name: string

  /** Recording URL */
  url: string

  /** Download URL */
  downloadUrl?: string

  /** Duration in seconds */
  duration?: number

  /** File size in bytes */
  size?: number

  /** Recording format */
  format?: string

  /** Is processing */
  isProcessing?: boolean

  /** Processing status */
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'

  /** Started recording timestamp */
  recordingStartedAt?: Date

  /** Stopped recording timestamp */
  recordingEndedAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    zoom?: string
    meet?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MeetingRecordingInput = Input<MeetingRecording>
export type MeetingRecordingOutput = Output<MeetingRecording>

// =============================================================================
// MeetingTranscript
// =============================================================================

/**
 * Meeting transcript segment.
 */
export interface TranscriptSegment {
  /** Speaker ID */
  speakerId?: string

  /** Speaker name */
  speakerName?: string

  /** Text content */
  text: string

  /** Start time in seconds */
  startTime: number

  /** End time in seconds */
  endTime: number

  /** Confidence score */
  confidence?: number
}

/**
 * Meeting transcript.
 *
 * @example
 * ```ts
 * const transcript: MeetingTranscript = {
 *   id: 'trans_123',
 *   meetingId: 'meet_456',
 *   recordingId: 'rec_789',
 *   language: 'en',
 *   segments: [
 *     { speakerName: 'Alice', text: 'Welcome everyone', startTime: 0, endTime: 2 },
 *     { speakerName: 'Bob', text: 'Thanks for having me', startTime: 3, endTime: 5 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface MeetingTranscript {
  /** Unique identifier */
  id: string

  /** Meeting ID */
  meetingId: string

  /** Recording ID */
  recordingId?: string

  /** Language code */
  language?: string

  /** Full transcript text */
  fullText?: string

  /** Transcript segments */
  segments: TranscriptSegment[]

  /** Is processing */
  isProcessing?: boolean

  /** Processing status */
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    zoom?: string
    meet?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MeetingTranscriptInput = Input<MeetingTranscript>
export type MeetingTranscriptOutput = Output<MeetingTranscript>

// =============================================================================
// Document
// =============================================================================

/**
 * Collaborative document.
 *
 * @example
 * ```ts
 * const document: Document = {
 *   id: 'doc_123',
 *   title: 'Product Roadmap',
 *   content: 'Document content...',
 *   status: 'published',
 *   ownerId: 'user_456',
 *   folderId: 'folder_789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Document {
  /** Unique identifier */
  id: string

  /** Document title */
  title: string

  /** Document content */
  content: string

  /** Content type (html, markdown, plain) */
  contentType?: 'html' | 'markdown' | 'plain'

  /** Document status */
  status: DocumentStatus

  /** Owner user ID */
  ownerId: string

  /** Folder ID */
  folderId?: string

  /** Current version number */
  version?: number

  /** Is template */
  isTemplate?: boolean

  /** Is public */
  isPublic?: boolean

  /** Tags */
  tags?: string[]

  /** Last edited by user ID */
  lastEditedBy?: string

  /** Published timestamp */
  publishedAt?: Date

  /** Archived timestamp */
  archivedAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    notion?: string
    google?: string
    confluence?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DocumentInput = Input<Document>
export type DocumentOutput = Output<Document>

// =============================================================================
// DocumentVersion
// =============================================================================

/**
 * Document version.
 *
 * @example
 * ```ts
 * const version: DocumentVersion = {
 *   id: 'ver_123',
 *   documentId: 'doc_456',
 *   version: 3,
 *   content: 'Version 3 content...',
 *   createdBy: 'user_789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface DocumentVersion {
  /** Unique identifier */
  id: string

  /** Document ID */
  documentId: string

  /** Version number */
  version: number

  /** Content snapshot */
  content: string

  /** Created by user ID */
  createdBy: string

  /** Change description */
  changeDescription?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    notion?: string
    google?: string
    confluence?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DocumentVersionInput = Input<DocumentVersion>
export type DocumentVersionOutput = Output<DocumentVersion>

// =============================================================================
// Comment
// =============================================================================

/**
 * Comment on document, task, or other entity.
 *
 * @example
 * ```ts
 * const comment: Comment = {
 *   id: 'cmt_123',
 *   entityType: 'document',
 *   entityId: 'doc_456',
 *   content: 'Great work on this section!',
 *   authorId: 'user_789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Comment {
  /** Unique identifier */
  id: string

  /** Entity type (document, task, etc.) */
  entityType: string

  /** Entity ID */
  entityId: string

  /** Comment content */
  content: string

  /** Author user ID */
  authorId: string

  /** Parent comment ID (for replies) */
  parentId?: string

  /** Is resolved */
  isResolved?: boolean

  /** Resolved by user ID */
  resolvedBy?: string

  /** Resolved timestamp */
  resolvedAt?: Date

  /** Is edited */
  isEdited?: boolean

  /** Edit timestamp */
  editedAt?: Date

  /** Mentions */
  mentions?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    notion?: string
    google?: string
    jira?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CommentInput = Input<Comment>
export type CommentOutput = Output<Comment>

// =============================================================================
// Mention
// =============================================================================

/**
 * Mention (@user) in message or document.
 *
 * @example
 * ```ts
 * const mention: Mention = {
 *   id: 'mention_123',
 *   entityType: 'message',
 *   entityId: 'msg_456',
 *   userId: 'user_789',
 *   mentionedBy: 'user_012',
 *   isRead: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Mention {
  /** Unique identifier */
  id: string

  /** Entity type (message, comment, document) */
  entityType: string

  /** Entity ID */
  entityId: string

  /** Mentioned user ID */
  userId: string

  /** Mentioned by user ID */
  mentionedBy: string

  /** Is read */
  isRead?: boolean

  /** Read timestamp */
  readAt?: Date

  /** Context text */
  context?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    notion?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MentionInput = Input<Mention>
export type MentionOutput = Output<Mention>

// =============================================================================
// Reaction
// =============================================================================

/**
 * Reaction (emoji) to message or content.
 *
 * @example
 * ```ts
 * const reaction: Reaction = {
 *   id: 'react_123',
 *   entityType: 'message',
 *   entityId: 'msg_456',
 *   emoji: '👍',
 *   userId: 'user_789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Reaction {
  /** Unique identifier */
  id: string

  /** Entity type (message, comment, etc.) */
  entityType: string

  /** Entity ID */
  entityId: string

  /** Emoji */
  emoji: string

  /** User ID who reacted */
  userId: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    discord?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReactionInput = Input<Reaction>
export type ReactionOutput = Output<Reaction>

// =============================================================================
// File
// =============================================================================

/**
 * File upload.
 *
 * @example
 * ```ts
 * const file: File = {
 *   id: 'file_123',
 *   name: 'presentation.pdf',
 *   type: 'document',
 *   mimeType: 'application/pdf',
 *   size: 2048576,
 *   url: 'https://storage.example.com/files/file_123',
 *   uploadedBy: 'user_456',
 *   folderId: 'folder_789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface File {
  /** Unique identifier */
  id: string

  /** File name */
  name: string

  /** File type category */
  type: FileType

  /** MIME type */
  mimeType: string

  /** File size in bytes */
  size: number

  /** File URL */
  url: string

  /** Download URL */
  downloadUrl?: string

  /** Thumbnail URL */
  thumbnailUrl?: string

  /** Preview URL */
  previewUrl?: string

  /** Uploaded by user ID */
  uploadedBy: string

  /** Folder ID */
  folderId?: string

  /** Is public */
  isPublic?: boolean

  /** Hash (for deduplication) */
  hash?: string

  /** Tags */
  tags?: string[]

  /** Virus scan status */
  virusScanStatus?: 'pending' | 'clean' | 'infected' | 'error'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    dropbox?: string
    google?: string
    s3?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FileInput = Input<File>
export type FileOutput = Output<File>

// =============================================================================
// Folder
// =============================================================================

/**
 * Folder structure.
 *
 * @example
 * ```ts
 * const folder: Folder = {
 *   id: 'folder_123',
 *   name: 'Projects',
 *   ownerId: 'user_456',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Folder {
  /** Unique identifier */
  id: string

  /** Folder name */
  name: string

  /** Description */
  description?: string

  /** Parent folder ID */
  parentId?: string

  /** Owner user ID */
  ownerId: string

  /** Is public */
  isPublic?: boolean

  /** Path (breadcrumb) */
  path?: string

  /** Color */
  color?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    dropbox?: string
    google?: string
    notion?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FolderInput = Input<Folder>
export type FolderOutput = Output<Folder>

// =============================================================================
// Share
// =============================================================================

/**
 * Sharing permission.
 *
 * @example
 * ```ts
 * const share: Share = {
 *   id: 'share_123',
 *   entityType: 'document',
 *   entityId: 'doc_456',
 *   userId: 'user_789',
 *   permission: 'edit',
 *   sharedBy: 'user_012',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Share {
  /** Unique identifier */
  id: string

  /** Entity type (document, file, folder) */
  entityType: string

  /** Entity ID */
  entityId: string

  /** Shared with user ID (if user-specific) */
  userId?: string

  /** Shared with email (if external) */
  email?: string

  /** Permission level */
  permission: SharePermission

  /** Shared by user ID */
  sharedBy: string

  /** Is public link */
  isPublicLink?: boolean

  /** Public link token */
  publicLinkToken?: string

  /** Expires timestamp */
  expiresAt?: Date

  /** Require password */
  requirePassword?: boolean

  /** Password hash */
  passwordHash?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    dropbox?: string
    google?: string
    notion?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShareInput = Input<Share>
export type ShareOutput = Output<Share>

// =============================================================================
// Notification
// =============================================================================

/**
 * Notification.
 *
 * @example
 * ```ts
 * const notification: Notification = {
 *   id: 'notif_123',
 *   type: 'mention',
 *   userId: 'user_456',
 *   title: 'You were mentioned',
 *   message: 'Alice mentioned you in #general',
 *   isRead: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Notification {
  /** Unique identifier */
  id: string

  /** Notification type */
  type: NotificationType

  /** User ID (recipient) */
  userId: string

  /** Title */
  title: string

  /** Message */
  message: string

  /** Is read */
  isRead: boolean

  /** Read timestamp */
  readAt?: Date

  /** Action URL */
  actionUrl?: string

  /** Related entity type */
  entityType?: string

  /** Related entity ID */
  entityId?: string

  /** Actor user ID (who triggered) */
  actorId?: string

  /** Delivery channels */
  channels?: NotificationChannel[]

  /** Priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type NotificationInput = Input<Notification>
export type NotificationOutput = Output<Notification>

// =============================================================================
// NotificationPreference
// =============================================================================

/**
 * Notification preferences.
 *
 * @example
 * ```ts
 * const pref: NotificationPreference = {
 *   id: 'pref_123',
 *   userId: 'user_456',
 *   type: 'mention',
 *   channels: ['in_app', 'email'],
 *   isEnabled: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface NotificationPreference {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Notification type */
  type: NotificationType

  /** Enabled channels */
  channels: NotificationChannel[]

  /** Is enabled */
  isEnabled: boolean

  /** Quiet hours start (HH:MM) */
  quietHoursStart?: string

  /** Quiet hours end (HH:MM) */
  quietHoursEnd?: string

  /** Timezone */
  timezone?: string

  /** Frequency (immediate, hourly, daily) */
  frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type NotificationPreferenceInput = Input<NotificationPreference>
export type NotificationPreferenceOutput = Output<NotificationPreference>

// =============================================================================
// Announcement
// =============================================================================

/**
 * Company announcement.
 *
 * @example
 * ```ts
 * const announcement: Announcement = {
 *   id: 'ann_123',
 *   title: 'New Product Launch',
 *   content: 'Exciting news...',
 *   authorId: 'user_456',
 *   publishedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Announcement {
  /** Unique identifier */
  id: string

  /** Title */
  title: string

  /** Content */
  content: string

  /** Author user ID */
  authorId: string

  /** Target audience (all, team IDs, user IDs) */
  targetAudience?: {
    type: 'all' | 'teams' | 'users'
    teamIds?: string[]
    userIds?: string[]
  }

  /** Is pinned */
  isPinned?: boolean

  /** Priority */
  priority?: 'low' | 'normal' | 'high'

  /** Category */
  category?: string

  /** Published timestamp */
  publishedAt?: Date

  /** Expires timestamp */
  expiresAt?: Date

  /** Read by user IDs */
  readBy?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AnnouncementInput = Input<Announcement>
export type AnnouncementOutput = Output<Announcement>

// =============================================================================
// Poll
// =============================================================================

/**
 * Poll option.
 */
export interface PollOption {
  /** Option ID */
  id: string

  /** Option text */
  text: string

  /** Vote count */
  voteCount: number

  /** Voter user IDs */
  voterIds?: string[]
}

/**
 * Poll/survey.
 *
 * @example
 * ```ts
 * const poll: Poll = {
 *   id: 'poll_123',
 *   question: 'Where should we have the team offsite?',
 *   options: [
 *     { id: 'opt_1', text: 'San Francisco', voteCount: 5 },
 *     { id: 'opt_2', text: 'New York', voteCount: 8 }
 *   ],
 *   createdBy: 'user_456',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Poll {
  /** Unique identifier */
  id: string

  /** Poll question */
  question: string

  /** Poll options */
  options: PollOption[]

  /** Created by user ID */
  createdBy: string

  /** Channel ID (if in channel) */
  channelId?: string

  /** Message ID (if in message) */
  messageId?: string

  /** Allow multiple selections */
  allowMultipleSelections?: boolean

  /** Is anonymous */
  isAnonymous?: boolean

  /** Is closed */
  isClosed?: boolean

  /** Closes timestamp */
  closesAt?: Date

  /** Total vote count */
  totalVotes?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    slack?: string
    teams?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PollInput = Input<Poll>
export type PollOutput = Output<Poll>

// =============================================================================
// Actions
// =============================================================================

export interface MessageActions extends CRUDResource<Message, MessageInput> {
  /** Send a message */
  send: Action<MessageInput, Message>

  /** Edit a message */
  edit: Action<{ id: string; content: string }, Message>

  /** Delete a message */
  deleteMessage: Action<{ id: string }, void>

  /** Add reaction */
  addReaction: Action<{ id: string; emoji: string; userId: string }, Message>

  /** Remove reaction */
  removeReaction: Action<{ id: string; emoji: string; userId: string }, Message>

  /** Pin message */
  pin: Action<{ id: string }, Message>

  /** Unpin message */
  unpin: Action<{ id: string }, Message>

  /** Mark as read */
  markAsRead: Action<{ id: string; userId: string }, Message>

  /** Search messages */
  search: Action<{ query: string; channelId?: string } & ListParams, PaginatedResult<Message>>
}

export interface ThreadActions extends CRUDResource<Thread, ThreadInput> {
  /** Add message to thread */
  addMessage: Action<{ threadId: string; message: MessageInput }, Thread>

  /** Archive thread */
  archive: Action<{ id: string }, Thread>

  /** Unarchive thread */
  unarchive: Action<{ id: string }, Thread>
}

export interface ChannelActions extends CRUDResource<Channel, ChannelInput> {
  /** Add member */
  addMember: Action<{ channelId: string; userId: string; role?: string }, ChannelMember>

  /** Remove member */
  removeMember: Action<{ channelId: string; userId: string }, void>

  /** Update member role */
  updateMemberRole: Action<{ channelId: string; userId: string; role: string }, ChannelMember>

  /** Archive channel */
  archive: Action<{ id: string }, Channel>

  /** Unarchive channel */
  unarchive: Action<{ id: string }, Channel>

  /** Get members */
  getMembers: Action<{ channelId: string } & ListParams, PaginatedResult<ChannelMember>>

  /** Search channels */
  search: Action<{ query: string } & ListParams, PaginatedResult<Channel>>
}

export interface ChannelMemberActions extends CRUDResource<ChannelMember, ChannelMemberInput> {
  /** Mute channel */
  mute: Action<{ id: string }, ChannelMember>

  /** Unmute channel */
  unmute: Action<{ id: string }, ChannelMember>

  /** Update notification preference */
  updateNotificationPreference: Action<{ id: string; preference: string }, ChannelMember>
}

export interface DirectMessageActions extends CRUDResource<DirectMessage, DirectMessageInput> {
  /** Get or create DM */
  getOrCreate: Action<{ participantIds: string[] }, DirectMessage>

  /** Archive DM */
  archive: Action<{ id: string }, DirectMessage>
}

export interface ConversationActions extends CRUDResource<Conversation, ConversationInput> {
  /** Archive conversation */
  archive: Action<{ id: string }, Conversation>

  /** Mute conversation */
  mute: Action<{ id: string }, Conversation>
}

export interface EmailActions extends CRUDResource<Email, EmailInput> {
  /** Send email */
  send: Action<EmailInput, Email>

  /** Reply to email */
  reply: Action<{ id: string; body: string; replyAll?: boolean }, Email>

  /** Forward email */
  forward: Action<{ id: string; to: string[]; body?: string }, Email>

  /** Mark as read */
  markAsRead: Action<{ id: string }, Email>

  /** Mark as unread */
  markAsUnread: Action<{ id: string }, Email>

  /** Star email */
  star: Action<{ id: string }, Email>

  /** Unstar email */
  unstar: Action<{ id: string }, Email>

  /** Add label */
  addLabel: Action<{ id: string; label: string }, Email>

  /** Remove label */
  removeLabel: Action<{ id: string; label: string }, Email>

  /** Search emails */
  search: Action<{ query: string } & ListParams, PaginatedResult<Email>>
}

export interface EmailThreadActions extends CRUDResource<EmailThread, EmailThreadInput> {
  /** Get thread messages */
  getMessages: Action<{ threadId: string } & ListParams, PaginatedResult<Email>>

  /** Mark thread as read */
  markAsRead: Action<{ id: string }, EmailThread>

  /** Star thread */
  star: Action<{ id: string }, EmailThread>
}

export interface CalendarEventActions extends CRUDResource<CalendarEvent, CalendarEventInput> {
  /** Accept event */
  accept: Action<{ id: string; userId: string }, CalendarEvent>

  /** Decline event */
  decline: Action<{ id: string; userId: string; comment?: string }, CalendarEvent>

  /** Tentative response */
  tentative: Action<{ id: string; userId: string }, CalendarEvent>

  /** Add attendee */
  addAttendee: Action<{ id: string; attendee: EventAttendee }, CalendarEvent>

  /** Remove attendee */
  removeAttendee: Action<{ id: string; email: string }, CalendarEvent>

  /** Get events in range */
  getInRange: Action<{ calendarId: string; startTime: Date; endTime: Date }, CalendarEvent[]>

  /** Search events */
  search: Action<{ query: string; calendarId?: string } & ListParams, PaginatedResult<CalendarEvent>>
}

export interface CalendarInviteActions extends CRUDResource<CalendarInvite, CalendarInviteInput> {
  /** Respond to invite */
  respond: Action<{ id: string; responseStatus: string; comment?: string }, CalendarInvite>

  /** Resend invite */
  resend: Action<{ id: string }, CalendarInvite>
}

export interface CalendarActions extends CRUDResource<Calendar, CalendarInput> {
  /** Get user calendars */
  getUserCalendars: Action<{ userId: string }, Calendar[]>

  /** Share calendar */
  share: Action<{ id: string; userId: string; permission: SharePermission }, void>

  /** Unshare calendar */
  unshare: Action<{ id: string; userId: string }, void>
}

export interface AvailabilityActions extends CRUDResource<Availability, AvailabilityInput> {
  /** Get user availability */
  getUserAvailability: Action<{ userId: string; startDate?: Date; endDate?: Date }, Availability[]>

  /** Find available slots */
  findSlots: Action<{ userIds: string[]; duration: number; startDate: Date; endDate: Date }, Array<{ startTime: Date; endTime: Date }>>
}

export interface MeetingActions extends CRUDResource<Meeting, MeetingInput> {
  /** Start meeting */
  start: Action<{ id: string }, Meeting>

  /** End meeting */
  end: Action<{ id: string }, Meeting>

  /** Cancel meeting */
  cancel: Action<{ id: string; reason?: string }, Meeting>

  /** Add participant */
  addParticipant: Action<{ id: string; userId: string }, Meeting>

  /** Remove participant */
  removeParticipant: Action<{ id: string; userId: string }, Meeting>

  /** Update notes */
  updateNotes: Action<{ id: string; notes: string }, Meeting>

  /** Add action item */
  addActionItem: Action<{ id: string; description: string; assigneeId?: string; dueDate?: Date }, Meeting>
}

export interface MeetingRecordingActions extends CRUDResource<MeetingRecording, MeetingRecordingInput> {
  /** Start recording */
  startRecording: Action<{ meetingId: string }, MeetingRecording>

  /** Stop recording */
  stopRecording: Action<{ id: string }, MeetingRecording>

  /** Get meeting recordings */
  getMeetingRecordings: Action<{ meetingId: string }, MeetingRecording[]>
}

export interface MeetingTranscriptActions extends CRUDResource<MeetingTranscript, MeetingTranscriptInput> {
  /** Generate transcript */
  generate: Action<{ meetingId: string; recordingId?: string }, MeetingTranscript>

  /** Search transcript */
  search: Action<{ id: string; query: string }, TranscriptSegment[]>
}

export interface DocumentActions extends CRUDResource<Document, DocumentInput> {
  /** Publish document */
  publish: Action<{ id: string }, Document>

  /** Archive document */
  archive: Action<{ id: string }, Document>

  /** Duplicate document */
  duplicate: Action<{ id: string; title?: string }, Document>

  /** Move to folder */
  moveToFolder: Action<{ id: string; folderId: string }, Document>

  /** Add tag */
  addTag: Action<{ id: string; tag: string }, Document>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, Document>

  /** Search documents */
  search: Action<{ query: string; folderId?: string } & ListParams, PaginatedResult<Document>>
}

export interface DocumentVersionActions extends CRUDResource<DocumentVersion, DocumentVersionInput> {
  /** Get document versions */
  getDocumentVersions: Action<{ documentId: string } & ListParams, PaginatedResult<DocumentVersion>>

  /** Restore version */
  restore: Action<{ id: string }, Document>
}

export interface CommentActions extends CRUDResource<Comment, CommentInput> {
  /** Get entity comments */
  getEntityComments: Action<{ entityType: string; entityId: string } & ListParams, PaginatedResult<Comment>>

  /** Resolve comment */
  resolve: Action<{ id: string; userId: string }, Comment>

  /** Unresolve comment */
  unresolve: Action<{ id: string }, Comment>

  /** Reply to comment */
  reply: Action<{ parentId: string; content: string; authorId: string }, Comment>
}

export interface MentionActions extends CRUDResource<Mention, MentionInput> {
  /** Get user mentions */
  getUserMentions: Action<{ userId: string; isRead?: boolean } & ListParams, PaginatedResult<Mention>>

  /** Mark as read */
  markAsRead: Action<{ id: string }, Mention>

  /** Mark all as read */
  markAllAsRead: Action<{ userId: string }, void>
}

export interface ReactionActions extends CRUDResource<Reaction, ReactionInput> {
  /** Get entity reactions */
  getEntityReactions: Action<{ entityType: string; entityId: string }, Reaction[]>

  /** Toggle reaction */
  toggle: Action<{ entityType: string; entityId: string; emoji: string; userId: string }, Reaction | null>
}

export interface FileActions extends CRUDResource<File, FileInput> {
  /** Upload file */
  upload: Action<{ name: string; content: Blob; folderId?: string; uploadedBy: string }, File>

  /** Download file */
  download: Action<{ id: string }, Blob>

  /** Move to folder */
  moveToFolder: Action<{ id: string; folderId: string }, File>

  /** Add tag */
  addTag: Action<{ id: string; tag: string }, File>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, File>

  /** Search files */
  search: Action<{ query: string; folderId?: string; type?: FileType } & ListParams, PaginatedResult<File>>
}

export interface FolderActions extends CRUDResource<Folder, FolderInput> {
  /** Get folder contents */
  getContents: Action<{ id: string } & ListParams, { files: File[]; folders: Folder[] }>

  /** Move folder */
  move: Action<{ id: string; parentId: string }, Folder>

  /** Get folder tree */
  getTree: Action<{ rootId?: string }, Folder[]>
}

export interface ShareActions extends CRUDResource<Share, ShareInput> {
  /** Get entity shares */
  getEntityShares: Action<{ entityType: string; entityId: string }, Share[]>

  /** Create public link */
  createPublicLink: Action<{ entityType: string; entityId: string; permission: SharePermission; expiresAt?: Date }, Share>

  /** Revoke share */
  revoke: Action<{ id: string }, void>

  /** Update permission */
  updatePermission: Action<{ id: string; permission: SharePermission }, Share>
}

export interface NotificationActions extends CRUDResource<Notification, NotificationInput> {
  /** Get user notifications */
  getUserNotifications: Action<{ userId: string; isRead?: boolean } & ListParams, PaginatedResult<Notification>>

  /** Mark as read */
  markAsRead: Action<{ id: string }, Notification>

  /** Mark all as read */
  markAllAsRead: Action<{ userId: string }, void>

  /** Send notification */
  send: Action<NotificationInput, Notification>
}

export interface NotificationPreferenceActions extends CRUDResource<NotificationPreference, NotificationPreferenceInput> {
  /** Get user preferences */
  getUserPreferences: Action<{ userId: string }, NotificationPreference[]>

  /** Update preference */
  updatePreference: Action<{ id: string; isEnabled?: boolean; channels?: NotificationChannel[] }, NotificationPreference>

  /** Set quiet hours */
  setQuietHours: Action<{ id: string; start: string; end: string; timezone?: string }, NotificationPreference>
}

export interface AnnouncementActions extends CRUDResource<Announcement, AnnouncementInput> {
  /** Publish announcement */
  publish: Action<{ id: string }, Announcement>

  /** Pin announcement */
  pin: Action<{ id: string }, Announcement>

  /** Unpin announcement */
  unpin: Action<{ id: string }, Announcement>

  /** Mark as read */
  markAsRead: Action<{ id: string; userId: string }, void>

  /** Get active announcements */
  getActive: Action<{ userId?: string } & ListParams, PaginatedResult<Announcement>>
}

export interface PollActions extends CRUDResource<Poll, PollInput> {
  /** Vote on poll */
  vote: Action<{ id: string; optionIds: string[]; userId: string }, Poll>

  /** Close poll */
  close: Action<{ id: string }, Poll>

  /** Get results */
  getResults: Action<{ id: string }, Poll>
}

// =============================================================================
// Events
// =============================================================================

export interface MessageEvents {
  created: BaseEvent<'message.created', Message>
  updated: BaseEvent<'message.updated', Message>
  deleted: BaseEvent<'message.deleted', { id: string }>
  sent: BaseEvent<'message.sent', Message>
  delivered: BaseEvent<'message.delivered', Message>
  read: BaseEvent<'message.read', { messageId: string; userId: string }>
  reaction_added: BaseEvent<'message.reaction_added', { messageId: string; emoji: string; userId: string }>
  reaction_removed: BaseEvent<'message.reaction_removed', { messageId: string; emoji: string; userId: string }>
  pinned: BaseEvent<'message.pinned', Message>
  unpinned: BaseEvent<'message.unpinned', Message>
}

export interface ThreadEvents {
  created: BaseEvent<'thread.created', Thread>
  updated: BaseEvent<'thread.updated', Thread>
  archived: BaseEvent<'thread.archived', { id: string }>
}

export interface ChannelEvents {
  created: BaseEvent<'channel.created', Channel>
  updated: BaseEvent<'channel.updated', Channel>
  deleted: BaseEvent<'channel.deleted', { id: string }>
  archived: BaseEvent<'channel.archived', { id: string }>
  unarchived: BaseEvent<'channel.unarchived', { id: string }>
  member_added: BaseEvent<'channel.member_added', { channelId: string; userId: string }>
  member_removed: BaseEvent<'channel.member_removed', { channelId: string; userId: string }>
}

export interface ChannelMemberEvents {
  created: BaseEvent<'channel_member.created', ChannelMember>
  updated: BaseEvent<'channel_member.updated', ChannelMember>
  deleted: BaseEvent<'channel_member.deleted', { id: string }>
}

export interface DirectMessageEvents {
  created: BaseEvent<'direct_message.created', DirectMessage>
  archived: BaseEvent<'direct_message.archived', { id: string }>
}

export interface ConversationEvents {
  created: BaseEvent<'conversation.created', Conversation>
  updated: BaseEvent<'conversation.updated', Conversation>
  archived: BaseEvent<'conversation.archived', { id: string }>
}

export interface EmailEvents {
  created: BaseEvent<'email.created', Email>
  sent: BaseEvent<'email.sent', Email>
  delivered: BaseEvent<'email.delivered', Email>
  opened: BaseEvent<'email.opened', Email>
  clicked: BaseEvent<'email.clicked', { emailId: string; url: string }>
  bounced: BaseEvent<'email.bounced', { emailId: string; reason: string }>
  failed: BaseEvent<'email.failed', { emailId: string; error: string }>
}

export interface EmailThreadEvents {
  created: BaseEvent<'email_thread.created', EmailThread>
  updated: BaseEvent<'email_thread.updated', EmailThread>
}

export interface CalendarEventEvents {
  created: BaseEvent<'calendar_event.created', CalendarEvent>
  updated: BaseEvent<'calendar_event.updated', CalendarEvent>
  deleted: BaseEvent<'calendar_event.deleted', { id: string }>
  cancelled: BaseEvent<'calendar_event.cancelled', CalendarEvent>
  attendee_responded: BaseEvent<'calendar_event.attendee_responded', { eventId: string; email: string; response: string }>
}

export interface CalendarInviteEvents {
  created: BaseEvent<'calendar_invite.created', CalendarInvite>
  responded: BaseEvent<'calendar_invite.responded', CalendarInvite>
}

export interface CalendarEvents {
  created: BaseEvent<'calendar.created', Calendar>
  updated: BaseEvent<'calendar.updated', Calendar>
  deleted: BaseEvent<'calendar.deleted', { id: string }>
}

export interface AvailabilityEvents {
  created: BaseEvent<'availability.created', Availability>
  updated: BaseEvent<'availability.updated', Availability>
  deleted: BaseEvent<'availability.deleted', { id: string }>
}

export interface MeetingEvents {
  created: BaseEvent<'meeting.created', Meeting>
  updated: BaseEvent<'meeting.updated', Meeting>
  started: BaseEvent<'meeting.started', Meeting>
  ended: BaseEvent<'meeting.ended', Meeting>
  cancelled: BaseEvent<'meeting.cancelled', { id: string; reason?: string }>
  participant_joined: BaseEvent<'meeting.participant_joined', { meetingId: string; userId: string }>
  participant_left: BaseEvent<'meeting.participant_left', { meetingId: string; userId: string }>
}

export interface MeetingRecordingEvents {
  created: BaseEvent<'meeting_recording.created', MeetingRecording>
  started: BaseEvent<'meeting_recording.started', MeetingRecording>
  stopped: BaseEvent<'meeting_recording.stopped', MeetingRecording>
  completed: BaseEvent<'meeting_recording.completed', MeetingRecording>
  failed: BaseEvent<'meeting_recording.failed', { id: string; error: string }>
}

export interface MeetingTranscriptEvents {
  created: BaseEvent<'meeting_transcript.created', MeetingTranscript>
  completed: BaseEvent<'meeting_transcript.completed', MeetingTranscript>
  failed: BaseEvent<'meeting_transcript.failed', { id: string; error: string }>
}

export interface DocumentEvents {
  created: BaseEvent<'document.created', Document>
  updated: BaseEvent<'document.updated', Document>
  deleted: BaseEvent<'document.deleted', { id: string }>
  published: BaseEvent<'document.published', Document>
  archived: BaseEvent<'document.archived', { id: string }>
}

export interface DocumentVersionEvents {
  created: BaseEvent<'document_version.created', DocumentVersion>
  restored: BaseEvent<'document_version.restored', { versionId: string; documentId: string }>
}

export interface CommentEvents {
  created: BaseEvent<'comment.created', Comment>
  updated: BaseEvent<'comment.updated', Comment>
  deleted: BaseEvent<'comment.deleted', { id: string }>
  resolved: BaseEvent<'comment.resolved', Comment>
  unresolved: BaseEvent<'comment.unresolved', Comment>
}

export interface MentionEvents {
  created: BaseEvent<'mention.created', Mention>
  read: BaseEvent<'mention.read', { id: string }>
}

export interface ReactionEvents {
  created: BaseEvent<'reaction.created', Reaction>
  deleted: BaseEvent<'reaction.deleted', { id: string }>
}

export interface FileEvents {
  created: BaseEvent<'file.created', File>
  updated: BaseEvent<'file.updated', File>
  deleted: BaseEvent<'file.deleted', { id: string }>
  uploaded: BaseEvent<'file.uploaded', File>
  downloaded: BaseEvent<'file.downloaded', { id: string; userId: string }>
}

export interface FolderEvents {
  created: BaseEvent<'folder.created', Folder>
  updated: BaseEvent<'folder.updated', Folder>
  deleted: BaseEvent<'folder.deleted', { id: string }>
  moved: BaseEvent<'folder.moved', { id: string; oldParentId?: string; newParentId?: string }>
}

export interface ShareEvents {
  created: BaseEvent<'share.created', Share>
  updated: BaseEvent<'share.updated', Share>
  revoked: BaseEvent<'share.revoked', { id: string }>
}

export interface NotificationEvents {
  created: BaseEvent<'notification.created', Notification>
  sent: BaseEvent<'notification.sent', Notification>
  read: BaseEvent<'notification.read', { id: string }>
}

export interface NotificationPreferenceEvents {
  created: BaseEvent<'notification_preference.created', NotificationPreference>
  updated: BaseEvent<'notification_preference.updated', NotificationPreference>
}

export interface AnnouncementEvents {
  created: BaseEvent<'announcement.created', Announcement>
  updated: BaseEvent<'announcement.updated', Announcement>
  published: BaseEvent<'announcement.published', Announcement>
  pinned: BaseEvent<'announcement.pinned', { id: string }>
  unpinned: BaseEvent<'announcement.unpinned', { id: string }>
}

export interface PollEvents {
  created: BaseEvent<'poll.created', Poll>
  updated: BaseEvent<'poll.updated', Poll>
  voted: BaseEvent<'poll.voted', { pollId: string; userId: string; optionIds: string[] }>
  closed: BaseEvent<'poll.closed', Poll>
}

// =============================================================================
// Resources
// =============================================================================

export interface MessageResource extends MessageActions {
  on: <K extends keyof MessageEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MessageEvents[K], TProxy>
  ) => () => void
}

export interface ThreadResource extends ThreadActions {
  on: <K extends keyof ThreadEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ThreadEvents[K], TProxy>
  ) => () => void
}

export interface ChannelResource extends ChannelActions {
  on: <K extends keyof ChannelEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ChannelEvents[K], TProxy>
  ) => () => void
}

export interface ChannelMemberResource extends ChannelMemberActions {
  on: <K extends keyof ChannelMemberEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ChannelMemberEvents[K], TProxy>
  ) => () => void
}

export interface DirectMessageResource extends DirectMessageActions {
  on: <K extends keyof DirectMessageEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DirectMessageEvents[K], TProxy>
  ) => () => void
}

export interface ConversationResource extends ConversationActions {
  on: <K extends keyof ConversationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ConversationEvents[K], TProxy>
  ) => () => void
}

export interface EmailResource extends EmailActions {
  on: <K extends keyof EmailEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailEvents[K], TProxy>
  ) => () => void
}

export interface EmailThreadResource extends EmailThreadActions {
  on: <K extends keyof EmailThreadEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailThreadEvents[K], TProxy>
  ) => () => void
}

export interface CalendarEventResource extends CalendarEventActions {
  on: <K extends keyof CalendarEventEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CalendarEventEvents[K], TProxy>
  ) => () => void
}

export interface CalendarInviteResource extends CalendarInviteActions {
  on: <K extends keyof CalendarInviteEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CalendarInviteEvents[K], TProxy>
  ) => () => void
}

export interface CalendarResource extends CalendarActions {
  on: <K extends keyof CalendarEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CalendarEvents[K], TProxy>
  ) => () => void
}

export interface AvailabilityResource extends AvailabilityActions {
  on: <K extends keyof AvailabilityEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AvailabilityEvents[K], TProxy>
  ) => () => void
}

export interface MeetingResource extends MeetingActions {
  on: <K extends keyof MeetingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MeetingEvents[K], TProxy>
  ) => () => void
}

export interface MeetingRecordingResource extends MeetingRecordingActions {
  on: <K extends keyof MeetingRecordingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MeetingRecordingEvents[K], TProxy>
  ) => () => void
}

export interface MeetingTranscriptResource extends MeetingTranscriptActions {
  on: <K extends keyof MeetingTranscriptEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MeetingTranscriptEvents[K], TProxy>
  ) => () => void
}

export interface DocumentResource extends DocumentActions {
  on: <K extends keyof DocumentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DocumentEvents[K], TProxy>
  ) => () => void
}

export interface DocumentVersionResource extends DocumentVersionActions {
  on: <K extends keyof DocumentVersionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DocumentVersionEvents[K], TProxy>
  ) => () => void
}

export interface CommentResource extends CommentActions {
  on: <K extends keyof CommentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CommentEvents[K], TProxy>
  ) => () => void
}

export interface MentionResource extends MentionActions {
  on: <K extends keyof MentionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MentionEvents[K], TProxy>
  ) => () => void
}

export interface ReactionResource extends ReactionActions {
  on: <K extends keyof ReactionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReactionEvents[K], TProxy>
  ) => () => void
}

export interface FileResource extends FileActions {
  on: <K extends keyof FileEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FileEvents[K], TProxy>
  ) => () => void
}

export interface FolderResource extends FolderActions {
  on: <K extends keyof FolderEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FolderEvents[K], TProxy>
  ) => () => void
}

export interface ShareResource extends ShareActions {
  on: <K extends keyof ShareEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ShareEvents[K], TProxy>
  ) => () => void
}

export interface NotificationResource extends NotificationActions {
  on: <K extends keyof NotificationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<NotificationEvents[K], TProxy>
  ) => () => void
}

export interface NotificationPreferenceResource extends NotificationPreferenceActions {
  on: <K extends keyof NotificationPreferenceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<NotificationPreferenceEvents[K], TProxy>
  ) => () => void
}

export interface AnnouncementResource extends AnnouncementActions {
  on: <K extends keyof AnnouncementEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AnnouncementEvents[K], TProxy>
  ) => () => void
}

export interface PollResource extends PollActions {
  on: <K extends keyof PollEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PollEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Proxy Interface
// =============================================================================

/**
 * Collaboration RPC proxy combining all resources.
 *
 * @example
 * ```ts
 * const collab: CollabProxy = ...
 *
 * // Send a message
 * const message = await collab.messages.send({
 *   channelId: 'chan_123',
 *   content: 'Hello team!',
 *   senderId: 'user_456',
 *   type: 'text',
 *   status: 'sent'
 * })
 *
 * // Create a meeting
 * const meeting = await collab.meetings.create({
 *   title: 'Sprint Planning',
 *   startTime: new Date('2024-01-15T14:00:00Z'),
 *   endTime: new Date('2024-01-15T15:00:00Z'),
 *   hostId: 'user_123',
 *   participantIds: ['user_456', 'user_789'],
 *   status: 'scheduled'
 * })
 *
 * // Listen for new messages
 * collab.messages.on('created', async (event, ctx) => {
 *   console.log('New message:', event.data.content)
 * })
 * ```
 */
export interface CollabProxy {
  messages: MessageResource
  threads: ThreadResource
  channels: ChannelResource
  channelMembers: ChannelMemberResource
  directMessages: DirectMessageResource
  conversations: ConversationResource
  emails: EmailResource
  emailThreads: EmailThreadResource
  calendarEvents: CalendarEventResource
  calendarInvites: CalendarInviteResource
  calendars: CalendarResource
  availability: AvailabilityResource
  meetings: MeetingResource
  meetingRecordings: MeetingRecordingResource
  meetingTranscripts: MeetingTranscriptResource
  documents: DocumentResource
  documentVersions: DocumentVersionResource
  comments: CommentResource
  mentions: MentionResource
  reactions: ReactionResource
  files: FileResource
  folders: FolderResource
  shares: ShareResource
  notifications: NotificationResource
  notificationPreferences: NotificationPreferenceResource
  announcements: AnnouncementResource
  polls: PollResource
}
