/**
 * Digital Tool Entity Types (Nouns)
 *
 * Semantic type definitions for digital tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Email
// =============================================================================

/**
 * Email message entity
 *
 * Represents an email that can be composed, sent, received, replied to, etc.
 */
export const Email: Noun = {
  singular: 'email',
  plural: 'emails',
  description: 'An electronic mail message',

  properties: {
    // Identity
    messageId: {
      type: 'string',
      description: 'Unique message identifier (Message-ID header)',
    },

    // Addressing
    from: {
      type: 'string',
      description: 'Sender email address',
    },
    to: {
      type: 'string',
      array: true,
      description: 'Primary recipient email addresses',
    },
    cc: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Carbon copy recipient addresses',
    },
    bcc: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Blind carbon copy recipient addresses',
    },
    replyTo: {
      type: 'string',
      optional: true,
      description: 'Reply-to address if different from sender',
    },

    // Content
    subject: {
      type: 'string',
      description: 'Email subject line',
    },
    body: {
      type: 'string',
      description: 'Plain text body content',
    },
    html: {
      type: 'string',
      optional: true,
      description: 'HTML body content',
    },

    // Threading
    inReplyTo: {
      type: 'string',
      optional: true,
      description: 'Message-ID of the email being replied to',
    },
    references: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Message-IDs of the conversation thread',
    },
    threadId: {
      type: 'string',
      optional: true,
      description: 'Conversation thread identifier',
    },

    // Status
    status: {
      type: 'string',
      description: 'Email status: draft, queued, sent, delivered, bounced, failed',
      examples: ['draft', 'queued', 'sent', 'delivered', 'bounced', 'failed'],
    },
    read: {
      type: 'boolean',
      optional: true,
      description: 'Whether the email has been read',
    },
    starred: {
      type: 'boolean',
      optional: true,
      description: 'Whether the email is starred/flagged',
    },
    labels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Labels or folders applied to the email',
    },

    // Metadata
    priority: {
      type: 'string',
      optional: true,
      description: 'Email priority: low, normal, high',
      examples: ['low', 'normal', 'high'],
    },
    headers: {
      type: 'json',
      optional: true,
      description: 'Additional email headers',
    },
  },

  relationships: {
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to the email',
    },
    sender: {
      type: 'Contact',
      description: 'The sender as a contact entity',
    },
    recipients: {
      type: 'Contact[]',
      description: 'All recipients as contact entities',
    },
    thread: {
      type: 'EmailThread',
      backref: 'emails',
      description: 'The conversation thread this email belongs to',
    },
  },

  actions: [
    'compose',
    'send',
    'reply',
    'replyAll',
    'forward',
    'archive',
    'delete',
    'markRead',
    'markUnread',
    'star',
    'unstar',
    'label',
    'unlabel',
    'move',
    'schedule',
  ],

  events: [
    'composed',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'replied',
    'forwarded',
    'archived',
    'deleted',
    'read',
    'starred',
    'labeled',
    'moved',
  ],
}

/**
 * Email thread/conversation
 */
export const EmailThread: Noun = {
  singular: 'email thread',
  plural: 'email threads',
  description: 'A conversation thread of related emails',

  properties: {
    subject: {
      type: 'string',
      description: 'Thread subject (from first email)',
    },
    snippet: {
      type: 'string',
      optional: true,
      description: 'Preview snippet of latest message',
    },
    messageCount: {
      type: 'number',
      description: 'Number of emails in the thread',
    },
    unreadCount: {
      type: 'number',
      optional: true,
      description: 'Number of unread emails',
    },
    participants: {
      type: 'string',
      array: true,
      description: 'Email addresses of all participants',
    },
    lastMessageAt: {
      type: 'datetime',
      description: 'Timestamp of the most recent message',
    },
  },

  relationships: {
    emails: {
      type: 'Email[]',
      backref: 'thread',
      description: 'All emails in this thread',
    },
  },

  actions: ['archive', 'delete', 'markRead', 'markUnread', 'mute', 'unmute'],

  events: ['updated', 'archived', 'deleted', 'muted'],
}

// =============================================================================
// Spreadsheet
// =============================================================================

/**
 * Spreadsheet workbook entity
 */
export const Spreadsheet: Noun = {
  singular: 'spreadsheet',
  plural: 'spreadsheets',
  description: 'A workbook containing sheets of tabular data with formulas',

  properties: {
    name: {
      type: 'string',
      description: 'Spreadsheet name/title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of the spreadsheet contents',
    },
    format: {
      type: 'string',
      description: 'File format: xlsx, xls, csv, ods, gsheet',
      examples: ['xlsx', 'xls', 'csv', 'ods', 'gsheet'],
    },
    locale: {
      type: 'string',
      optional: true,
      description: 'Locale for number/date formatting',
    },
    timeZone: {
      type: 'string',
      optional: true,
      description: 'Timezone for date calculations',
    },
    sheetCount: {
      type: 'number',
      description: 'Number of sheets in the workbook',
    },
    size: {
      type: 'number',
      optional: true,
      description: 'File size in bytes',
    },
  },

  relationships: {
    sheets: {
      type: 'Sheet[]',
      backref: 'spreadsheet',
      description: 'Sheets/worksheets in this spreadsheet',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the spreadsheet',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to edit',
    },
  },

  actions: [
    'create',
    'open',
    'save',
    'export',
    'import',
    'share',
    'duplicate',
    'rename',
    'delete',
    'addSheet',
    'removeSheet',
  ],

  events: [
    'created',
    'opened',
    'saved',
    'exported',
    'imported',
    'shared',
    'duplicated',
    'renamed',
    'deleted',
    'sheetAdded',
    'sheetRemoved',
  ],
}

/**
 * Individual sheet/worksheet within a spreadsheet
 */
export const Sheet: Noun = {
  singular: 'sheet',
  plural: 'sheets',
  description: 'A single worksheet within a spreadsheet',

  properties: {
    name: {
      type: 'string',
      description: 'Sheet tab name',
    },
    index: {
      type: 'number',
      description: 'Position in the workbook (0-indexed)',
    },
    rowCount: {
      type: 'number',
      description: 'Number of rows with data',
    },
    columnCount: {
      type: 'number',
      description: 'Number of columns with data',
    },
    frozenRows: {
      type: 'number',
      optional: true,
      description: 'Number of frozen header rows',
    },
    frozenColumns: {
      type: 'number',
      optional: true,
      description: 'Number of frozen columns',
    },
    hidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether the sheet is hidden',
    },
    protected: {
      type: 'boolean',
      optional: true,
      description: 'Whether the sheet is protected from editing',
    },
  },

  relationships: {
    spreadsheet: {
      type: 'Spreadsheet',
      backref: 'sheets',
      description: 'Parent spreadsheet',
    },
    cells: {
      type: 'Cell[]',
      description: 'Cells in this sheet',
    },
    charts: {
      type: 'Chart[]',
      description: 'Charts embedded in this sheet',
    },
  },

  actions: [
    'rename',
    'duplicate',
    'delete',
    'hide',
    'show',
    'protect',
    'unprotect',
    'clear',
    'sort',
    'filter',
    'insertRow',
    'insertColumn',
    'deleteRow',
    'deleteColumn',
  ],

  events: [
    'renamed',
    'duplicated',
    'deleted',
    'hidden',
    'shown',
    'protected',
    'cleared',
    'sorted',
    'filtered',
    'rowInserted',
    'columnInserted',
  ],
}

/**
 * Cell within a sheet
 */
export const Cell: Noun = {
  singular: 'cell',
  plural: 'cells',
  description: 'A single cell in a spreadsheet sheet',

  properties: {
    address: {
      type: 'string',
      description: 'Cell address (e.g., A1, B2)',
    },
    row: {
      type: 'number',
      description: 'Row number (1-indexed)',
    },
    column: {
      type: 'number',
      description: 'Column number (1-indexed)',
    },
    value: {
      type: 'json',
      description: 'The cell value (string, number, boolean, null)',
    },
    formula: {
      type: 'string',
      optional: true,
      description: 'Formula if the cell contains one',
    },
    displayValue: {
      type: 'string',
      optional: true,
      description: 'Formatted display value',
    },
    format: {
      type: 'json',
      optional: true,
      description: 'Cell formatting (font, color, borders, etc.)',
    },
    dataType: {
      type: 'string',
      description: 'Data type: string, number, boolean, date, formula, empty',
      examples: ['string', 'number', 'boolean', 'date', 'formula', 'empty'],
    },
    note: {
      type: 'string',
      optional: true,
      description: 'Cell comment/note',
    },
  },

  actions: ['set', 'clear', 'format', 'addNote', 'removeNote', 'copy', 'cut', 'paste'],

  events: ['changed', 'cleared', 'formatted', 'noteAdded', 'noteRemoved'],
}

// =============================================================================
// Document
// =============================================================================

/**
 * Word processor document entity
 */
export const Document: Noun = {
  singular: 'document',
  plural: 'documents',
  description: 'A word processor document with rich text content',

  properties: {
    title: {
      type: 'string',
      description: 'Document title',
    },
    content: {
      type: 'markdown',
      description: 'Document content (as markdown or rich text)',
    },
    format: {
      type: 'string',
      description: 'File format: docx, doc, odt, rtf, gdoc, md',
      examples: ['docx', 'doc', 'odt', 'rtf', 'gdoc', 'md'],
    },
    wordCount: {
      type: 'number',
      optional: true,
      description: 'Number of words in the document',
    },
    characterCount: {
      type: 'number',
      optional: true,
      description: 'Number of characters',
    },
    pageCount: {
      type: 'number',
      optional: true,
      description: 'Number of pages',
    },
    language: {
      type: 'string',
      optional: true,
      description: 'Document language code',
    },
    template: {
      type: 'string',
      optional: true,
      description: 'Template used to create the document',
    },
    status: {
      type: 'string',
      optional: true,
      description: 'Document status: draft, review, final, published',
      examples: ['draft', 'review', 'final', 'published'],
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Document owner',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with edit access',
    },
    comments: {
      type: 'Comment[]',
      backref: 'document',
      description: 'Comments on the document',
    },
    revisions: {
      type: 'Revision[]',
      backref: 'document',
      description: 'Version history',
    },
  },

  actions: [
    'create',
    'open',
    'edit',
    'save',
    'export',
    'print',
    'share',
    'comment',
    'suggest',
    'accept',
    'reject',
    'resolve',
    'duplicate',
    'rename',
    'delete',
    'restore',
  ],

  events: [
    'created',
    'opened',
    'edited',
    'saved',
    'exported',
    'printed',
    'shared',
    'commented',
    'suggested',
    'accepted',
    'rejected',
    'resolved',
    'duplicated',
    'renamed',
    'deleted',
    'restored',
  ],
}

// =============================================================================
// Presentation
// =============================================================================

/**
 * Presentation/slide deck entity
 */
export const Presentation: Noun = {
  singular: 'presentation',
  plural: 'presentations',
  description: 'A slide deck for presenting information',

  properties: {
    title: {
      type: 'string',
      description: 'Presentation title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Presentation description or summary',
    },
    format: {
      type: 'string',
      description: 'File format: pptx, ppt, odp, gslides, key',
      examples: ['pptx', 'ppt', 'odp', 'gslides', 'key'],
    },
    slideCount: {
      type: 'number',
      description: 'Number of slides',
    },
    aspectRatio: {
      type: 'string',
      optional: true,
      description: 'Slide aspect ratio: 16:9, 4:3, etc.',
      examples: ['16:9', '4:3', '16:10'],
    },
    theme: {
      type: 'string',
      optional: true,
      description: 'Applied theme or template name',
    },
    speakerNotes: {
      type: 'boolean',
      optional: true,
      description: 'Whether presentation has speaker notes',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Estimated presentation duration in minutes',
    },
  },

  relationships: {
    slides: {
      type: 'Slide[]',
      backref: 'presentation',
      description: 'Slides in this presentation',
    },
    owner: {
      type: 'Contact',
      description: 'Presentation owner',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with edit access',
    },
  },

  actions: [
    'create',
    'open',
    'edit',
    'save',
    'export',
    'present',
    'share',
    'duplicate',
    'rename',
    'delete',
    'addSlide',
    'removeSlide',
    'reorderSlides',
    'applyTheme',
  ],

  events: [
    'created',
    'opened',
    'edited',
    'saved',
    'exported',
    'presented',
    'shared',
    'duplicated',
    'renamed',
    'deleted',
    'slideAdded',
    'slideRemoved',
    'slidesReordered',
    'themeApplied',
  ],
}

/**
 * Individual slide within a presentation
 */
export const Slide: Noun = {
  singular: 'slide',
  plural: 'slides',
  description: 'A single slide in a presentation',

  properties: {
    title: {
      type: 'string',
      optional: true,
      description: 'Slide title',
    },
    index: {
      type: 'number',
      description: 'Position in the presentation (0-indexed)',
    },
    layout: {
      type: 'string',
      optional: true,
      description: 'Slide layout type: title, titleAndContent, blank, etc.',
      examples: ['title', 'titleAndContent', 'sectionHeader', 'twoColumn', 'blank'],
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Speaker notes for this slide',
    },
    hidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether slide is hidden from presentation',
    },
    transition: {
      type: 'json',
      optional: true,
      description: 'Slide transition effect settings',
    },
  },

  relationships: {
    presentation: {
      type: 'Presentation',
      backref: 'slides',
      description: 'Parent presentation',
    },
    elements: {
      type: 'SlideElement[]',
      description: 'Elements on this slide (text boxes, images, shapes)',
    },
  },

  actions: [
    'edit',
    'duplicate',
    'delete',
    'hide',
    'show',
    'move',
    'addElement',
    'removeElement',
    'setLayout',
    'setTransition',
    'addNote',
  ],

  events: [
    'edited',
    'duplicated',
    'deleted',
    'hidden',
    'shown',
    'moved',
    'elementAdded',
    'elementRemoved',
    'layoutChanged',
    'transitionChanged',
  ],
}

// =============================================================================
// Phone / Voice Call
// =============================================================================

/**
 * Phone call entity
 */
export const PhoneCall: Noun = {
  singular: 'phone call',
  plural: 'phone calls',
  description: 'A voice telephone call',

  properties: {
    // Parties
    from: {
      type: 'string',
      description: 'Caller phone number (E.164 format)',
    },
    to: {
      type: 'string',
      description: 'Recipient phone number (E.164 format)',
    },
    direction: {
      type: 'string',
      description: 'Call direction: inbound, outbound',
      examples: ['inbound', 'outbound'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Call status: ringing, in-progress, completed, busy, failed, no-answer, canceled',
      examples: ['ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled'],
    },

    // Timing
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the call was initiated',
    },
    answeredAt: {
      type: 'datetime',
      optional: true,
      description: 'When the call was answered',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the call ended',
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
      description: 'Whether the call was recorded',
    },
    recordingUrl: {
      type: 'url',
      optional: true,
      description: 'URL to the call recording',
    },
    transcription: {
      type: 'string',
      optional: true,
      description: 'Transcription of the call',
    },

    // Context
    notes: {
      type: 'string',
      optional: true,
      description: 'Notes about the call',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags/labels for the call',
    },
  },

  relationships: {
    caller: {
      type: 'Contact',
      description: 'The person who made the call',
    },
    recipient: {
      type: 'Contact',
      description: 'The person who received the call',
    },
    voicemail: {
      type: 'Voicemail',
      required: false,
      description: 'Voicemail left if call was not answered',
    },
  },

  actions: [
    'dial',
    'answer',
    'hangup',
    'hold',
    'resume',
    'transfer',
    'mute',
    'unmute',
    'record',
    'stopRecording',
    'sendDtmf',
    'addParticipant',
  ],

  events: [
    'initiated',
    'ringing',
    'answered',
    'held',
    'resumed',
    'transferred',
    'muted',
    'unmuted',
    'recordingStarted',
    'recordingStopped',
    'ended',
    'voicemailLeft',
  ],
}

/**
 * Voicemail message
 */
export const Voicemail: Noun = {
  singular: 'voicemail',
  plural: 'voicemails',
  description: 'A voicemail message',

  properties: {
    from: {
      type: 'string',
      description: 'Caller phone number',
    },
    to: {
      type: 'string',
      description: 'Recipient phone number',
    },
    duration: {
      type: 'number',
      description: 'Voicemail duration in seconds',
    },
    audioUrl: {
      type: 'url',
      description: 'URL to the audio file',
    },
    transcription: {
      type: 'string',
      optional: true,
      description: 'Transcription of the voicemail',
    },
    read: {
      type: 'boolean',
      description: 'Whether the voicemail has been listened to',
    },
  },

  relationships: {
    caller: {
      type: 'Contact',
      description: 'The person who left the voicemail',
    },
    call: {
      type: 'PhoneCall',
      description: 'The missed call this voicemail is associated with',
    },
  },

  actions: ['play', 'markRead', 'markUnread', 'delete', 'transcribe', 'callback'],

  events: ['received', 'played', 'read', 'deleted', 'transcribed'],
}

// =============================================================================
// Channel / Team Messaging (Slack/Teams/Discord alternative naming)
// =============================================================================

/**
 * Workspace - The top-level container for team messaging
 *
 * This is the brand-agnostic equivalent of:
 * - Slack Workspace
 * - Microsoft Teams Team
 * - Discord Server
 */
export const Workspace: Noun = {
  singular: 'workspace',
  plural: 'workspaces',
  description: 'A collaborative workspace for team communication and coordination',

  properties: {
    name: {
      type: 'string',
      description: 'Workspace name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Workspace description or purpose',
    },
    icon: {
      type: 'url',
      optional: true,
      description: 'Workspace icon/logo URL',
    },
    domain: {
      type: 'string',
      optional: true,
      description: 'Custom domain or URL slug',
    },
    visibility: {
      type: 'string',
      description: 'Workspace visibility: public, private, organization',
      examples: ['public', 'private', 'organization'],
    },
    memberCount: {
      type: 'number',
      optional: true,
      description: 'Number of members',
    },
    plan: {
      type: 'string',
      optional: true,
      description: 'Subscription plan: free, pro, business, enterprise',
    },
  },

  relationships: {
    channels: {
      type: 'Channel[]',
      backref: 'workspace',
      description: 'Channels in this workspace',
    },
    members: {
      type: 'Member[]',
      backref: 'workspace',
      description: 'Members of the workspace',
    },
    owner: {
      type: 'Contact',
      description: 'Workspace owner/creator',
    },
  },

  actions: [
    'create',
    'configure',
    'invite',
    'remove',
    'archive',
    'delete',
    'createChannel',
    'setPermissions',
  ],

  events: [
    'created',
    'configured',
    'memberJoined',
    'memberLeft',
    'memberRemoved',
    'channelCreated',
    'archived',
    'deleted',
  ],
}

/**
 * Channel - A communication channel within a workspace
 *
 * This is the brand-agnostic equivalent of:
 * - Slack Channel
 * - Microsoft Teams Channel
 * - Discord Channel
 */
export const Channel: Noun = {
  singular: 'channel',
  plural: 'channels',
  description: 'A communication channel for group messaging and collaboration',

  properties: {
    name: {
      type: 'string',
      description: 'Channel name (typically lowercase with hyphens)',
    },
    topic: {
      type: 'string',
      optional: true,
      description: 'Channel topic or purpose',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Detailed channel description',
    },
    visibility: {
      type: 'string',
      description: 'Channel visibility: public, private',
      examples: ['public', 'private'],
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the channel is archived',
    },
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether the channel is pinned for easy access',
    },
    muted: {
      type: 'boolean',
      optional: true,
      description: 'Whether notifications are muted',
    },
    memberCount: {
      type: 'number',
      optional: true,
      description: 'Number of channel members',
    },
    lastActivityAt: {
      type: 'datetime',
      optional: true,
      description: 'Timestamp of last message or activity',
    },
  },

  relationships: {
    workspace: {
      type: 'Workspace',
      backref: 'channels',
      description: 'Parent workspace',
    },
    messages: {
      type: 'Message[]',
      backref: 'channel',
      description: 'Messages in this channel',
    },
    members: {
      type: 'Member[]',
      description: 'Members who have access to this channel',
    },
    pinnedMessages: {
      type: 'Message[]',
      description: 'Pinned messages in this channel',
    },
  },

  actions: [
    'create',
    'rename',
    'setTopic',
    'invite',
    'remove',
    'join',
    'leave',
    'archive',
    'unarchive',
    'delete',
    'pin',
    'unpin',
    'mute',
    'unmute',
  ],

  events: [
    'created',
    'renamed',
    'topicChanged',
    'memberJoined',
    'memberLeft',
    'memberRemoved',
    'archived',
    'unarchived',
    'deleted',
    'pinned',
    'unpinned',
    'muted',
    'unmuted',
  ],
}

/**
 * Message - A message in a channel or direct conversation
 */
export const Message: Noun = {
  singular: 'message',
  plural: 'messages',
  description: 'A message in a channel or conversation',

  properties: {
    text: {
      type: 'string',
      description: 'Message text content',
    },
    richText: {
      type: 'json',
      optional: true,
      description: 'Rich text content (formatted blocks)',
    },

    // Threading
    threadId: {
      type: 'string',
      optional: true,
      description: 'Thread identifier if part of a thread',
    },
    replyCount: {
      type: 'number',
      optional: true,
      description: 'Number of replies if this is a thread parent',
    },

    // Status
    edited: {
      type: 'boolean',
      optional: true,
      description: 'Whether the message has been edited',
    },
    editedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the message was last edited',
    },
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether the message is pinned',
    },

    // Mentions & References
    mentions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'User IDs mentioned in the message',
    },
    channelMentions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Channel IDs mentioned',
    },
  },

  relationships: {
    channel: {
      type: 'Channel',
      backref: 'messages',
      description: 'Channel this message was posted in',
    },
    sender: {
      type: 'Member',
      description: 'Who sent the message',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to the message',
    },
    reactions: {
      type: 'Reaction[]',
      backref: 'message',
      description: 'Emoji reactions to the message',
    },
    thread: {
      type: 'Thread',
      required: false,
      description: 'Thread this message belongs to or started',
    },
  },

  actions: [
    'send',
    'edit',
    'delete',
    'react',
    'unreact',
    'reply',
    'pin',
    'unpin',
    'share',
    'bookmark',
    'report',
  ],

  events: [
    'sent',
    'edited',
    'deleted',
    'reacted',
    'unreacted',
    'replied',
    'pinned',
    'unpinned',
    'shared',
    'bookmarked',
  ],
}

/**
 * Thread - A threaded conversation within a channel
 */
export const Thread: Noun = {
  singular: 'thread',
  plural: 'threads',
  description: 'A threaded conversation branching from a message',

  properties: {
    replyCount: {
      type: 'number',
      description: 'Number of replies in the thread',
    },
    participantCount: {
      type: 'number',
      optional: true,
      description: 'Number of unique participants',
    },
    lastReplyAt: {
      type: 'datetime',
      optional: true,
      description: 'Timestamp of the last reply',
    },
    subscribed: {
      type: 'boolean',
      optional: true,
      description: 'Whether the current user is subscribed to replies',
    },
  },

  relationships: {
    parentMessage: {
      type: 'Message',
      description: 'The message that started this thread',
    },
    replies: {
      type: 'Message[]',
      description: 'Reply messages in this thread',
    },
    participants: {
      type: 'Member[]',
      description: 'People who have replied in this thread',
    },
  },

  actions: ['reply', 'subscribe', 'unsubscribe', 'markRead'],

  events: ['replied', 'subscribed', 'unsubscribed', 'read'],
}

/**
 * DirectMessage - Private one-on-one or group conversation
 */
export const DirectMessage: Noun = {
  singular: 'direct message',
  plural: 'direct messages',
  description: 'A private conversation between two or more people',

  properties: {
    name: {
      type: 'string',
      optional: true,
      description: 'Custom name for group DMs',
    },
    isGroup: {
      type: 'boolean',
      description: 'Whether this is a group DM (more than 2 people)',
    },
    lastMessageAt: {
      type: 'datetime',
      optional: true,
      description: 'Timestamp of the last message',
    },
    unreadCount: {
      type: 'number',
      optional: true,
      description: 'Number of unread messages',
    },
    muted: {
      type: 'boolean',
      optional: true,
      description: 'Whether notifications are muted',
    },
  },

  relationships: {
    participants: {
      type: 'Member[]',
      description: 'People in this conversation',
    },
    messages: {
      type: 'Message[]',
      description: 'Messages in this conversation',
    },
  },

  actions: [
    'send',
    'archive',
    'leave',
    'addParticipant',
    'removeParticipant',
    'mute',
    'unmute',
    'markRead',
  ],

  events: [
    'messageSent',
    'archived',
    'left',
    'participantAdded',
    'participantRemoved',
    'muted',
    'unmuted',
    'read',
  ],
}

/**
 * Member - A member of a workspace
 */
export const Member: Noun = {
  singular: 'member',
  plural: 'members',
  description: 'A member of a workspace or channel',

  properties: {
    displayName: {
      type: 'string',
      description: 'Display name',
    },
    username: {
      type: 'string',
      optional: true,
      description: 'Username handle',
    },
    avatar: {
      type: 'url',
      optional: true,
      description: 'Profile picture URL',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },
    status: {
      type: 'string',
      optional: true,
      description: 'Custom status message',
    },
    presence: {
      type: 'string',
      description: 'Online presence: online, away, dnd, offline',
      examples: ['online', 'away', 'dnd', 'offline'],
    },
    role: {
      type: 'string',
      description: 'Role in workspace: owner, admin, member, guest',
      examples: ['owner', 'admin', 'member', 'guest'],
    },
    timezone: {
      type: 'string',
      optional: true,
      description: 'Member timezone',
    },
  },

  relationships: {
    workspace: {
      type: 'Workspace',
      backref: 'members',
      description: 'Workspace this member belongs to',
    },
    contact: {
      type: 'Contact',
      description: 'Associated contact record',
    },
  },

  actions: [
    'invite',
    'remove',
    'setRole',
    'setStatus',
    'setPresence',
    'mention',
    'message',
    'block',
    'unblock',
  ],

  events: [
    'joined',
    'left',
    'removed',
    'roleChanged',
    'statusChanged',
    'presenceChanged',
    'blocked',
    'unblocked',
  ],
}

/**
 * Reaction - An emoji reaction to a message
 */
export const Reaction: Noun = {
  singular: 'reaction',
  plural: 'reactions',
  description: 'An emoji reaction to a message',

  properties: {
    emoji: {
      type: 'string',
      description: 'Emoji character or shortcode',
    },
    count: {
      type: 'number',
      description: 'Number of users who added this reaction',
    },
  },

  relationships: {
    message: {
      type: 'Message',
      backref: 'reactions',
      description: 'Message this reaction is on',
    },
    users: {
      type: 'Member[]',
      description: 'Users who added this reaction',
    },
  },

  actions: ['add', 'remove'],

  events: ['added', 'removed'],
}

// =============================================================================
// Supporting Entities
// =============================================================================

/**
 * Attachment - A file attachment
 */
export const Attachment: Noun = {
  singular: 'attachment',
  plural: 'attachments',
  description: 'A file attachment to an email, message, or document',

  properties: {
    filename: {
      type: 'string',
      description: 'Original filename',
    },
    mimeType: {
      type: 'string',
      description: 'MIME type of the file',
    },
    size: {
      type: 'number',
      description: 'File size in bytes',
    },
    url: {
      type: 'url',
      description: 'URL to download the file',
    },
    thumbnailUrl: {
      type: 'url',
      optional: true,
      description: 'URL to a thumbnail preview',
    },
    contentId: {
      type: 'string',
      optional: true,
      description: 'Content ID for inline attachments',
    },
  },

  actions: ['upload', 'download', 'preview', 'delete', 'share'],

  events: ['uploaded', 'downloaded', 'previewed', 'deleted', 'shared'],
}

/**
 * Contact - A person's contact information
 */
export const Contact: Noun = {
  singular: 'contact',
  plural: 'contacts',
  description: 'Contact information for a person or organization',

  properties: {
    name: {
      type: 'string',
      description: 'Full name',
    },
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
    company: {
      type: 'string',
      optional: true,
      description: 'Company or organization',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },
    avatar: {
      type: 'url',
      optional: true,
      description: 'Profile photo URL',
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Notes about this contact',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags/labels for categorization',
    },
  },

  actions: ['create', 'update', 'delete', 'merge', 'export', 'import'],

  events: ['created', 'updated', 'deleted', 'merged', 'exported', 'imported'],
}

/**
 * Comment - A comment on a document or other entity
 */
export const Comment: Noun = {
  singular: 'comment',
  plural: 'comments',
  description: 'A comment or annotation on a document',

  properties: {
    text: {
      type: 'string',
      description: 'Comment text',
    },
    anchor: {
      type: 'json',
      optional: true,
      description: 'Location anchor (selection, range, etc.)',
    },
    resolved: {
      type: 'boolean',
      optional: true,
      description: 'Whether the comment has been resolved',
    },
  },

  relationships: {
    document: {
      type: 'Document',
      backref: 'comments',
      description: 'Document this comment is on',
    },
    author: {
      type: 'Contact',
      description: 'Who wrote the comment',
    },
    replies: {
      type: 'Comment[]',
      description: 'Replies to this comment',
    },
  },

  actions: ['create', 'edit', 'delete', 'resolve', 'unresolve', 'reply'],

  events: ['created', 'edited', 'deleted', 'resolved', 'unresololved', 'replied'],
}

/**
 * Revision - A version/revision of a document
 */
export const Revision: Noun = {
  singular: 'revision',
  plural: 'revisions',
  description: 'A saved version of a document',

  properties: {
    version: {
      type: 'number',
      description: 'Version number',
    },
    label: {
      type: 'string',
      optional: true,
      description: 'Optional version label',
    },
    changes: {
      type: 'string',
      optional: true,
      description: 'Summary of changes',
    },
    size: {
      type: 'number',
      optional: true,
      description: 'Document size at this revision',
    },
  },

  relationships: {
    document: {
      type: 'Document',
      backref: 'revisions',
      description: 'Document this is a revision of',
    },
    author: {
      type: 'Contact',
      description: 'Who made this revision',
    },
  },

  actions: ['view', 'restore', 'compare', 'download'],

  events: ['created', 'restored', 'compared'],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All digital tool entity types
 */
export const DigitalToolEntities = {
  // Email
  Email,
  EmailThread,

  // Spreadsheet
  Spreadsheet,
  Sheet,
  Cell,

  // Document
  Document,

  // Presentation
  Presentation,
  Slide,

  // Phone
  PhoneCall,
  Voicemail,

  // Team Messaging (Slack/Teams/Discord)
  Workspace,
  Channel,
  Message,
  Thread,
  DirectMessage,
  Member,
  Reaction,

  // Supporting
  Attachment,
  Contact,
  Comment,
  Revision,
}

/**
 * Entity categories for organization
 */
export const DigitalToolCategories = {
  email: ['Email', 'EmailThread'],
  spreadsheet: ['Spreadsheet', 'Sheet', 'Cell'],
  document: ['Document', 'Comment', 'Revision'],
  presentation: ['Presentation', 'Slide'],
  phone: ['PhoneCall', 'Voicemail'],
  messaging: ['Workspace', 'Channel', 'Message', 'Thread', 'DirectMessage', 'Member', 'Reaction'],
  shared: ['Attachment', 'Contact'],
} as const
