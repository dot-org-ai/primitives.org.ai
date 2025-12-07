/**
 * Productivity Tool Entity Types (Nouns)
 *
 * Semantic type definitions for productivity digital tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Calendar
// =============================================================================

/**
 * Calendar entity
 *
 * Represents a calendar containing events, meetings, and appointments.
 */
export const Calendar: Noun = {
  singular: 'calendar',
  plural: 'calendars',
  description: 'A calendar containing events, meetings, and appointments',

  properties: {
    name: {
      type: 'string',
      description: 'Calendar name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Calendar description or purpose',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Color code for visual identification',
    },
    timezone: {
      type: 'string',
      description: 'Default timezone for events (IANA timezone identifier)',
    },
    visibility: {
      type: 'string',
      description: 'Calendar visibility: public, private, shared',
      examples: ['public', 'private', 'shared'],
    },
    accessRole: {
      type: 'string',
      optional: true,
      description: 'User access role: owner, writer, reader, freeBusyReader',
      examples: ['owner', 'writer', 'reader', 'freeBusyReader'],
    },
    primary: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the user primary calendar',
    },
    defaultReminders: {
      type: 'json',
      optional: true,
      description: 'Default reminder settings for events',
    },
  },

  relationships: {
    events: {
      type: 'Event[]',
      backref: 'calendar',
      description: 'Events in this calendar',
    },
    owner: {
      type: 'Contact',
      description: 'Calendar owner',
    },
    subscribers: {
      type: 'Contact[]',
      description: 'People who have subscribed to this calendar',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'share',
    'unshare',
    'subscribe',
    'unsubscribe',
    'export',
    'import',
    'sync',
    'setColor',
    'setTimezone',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'shared',
    'unshared',
    'subscribed',
    'unsubscribed',
    'exported',
    'imported',
    'synced',
  ],
}

/**
 * Event entity
 *
 * Represents a calendar event, meeting, or appointment with attendees, time, location, and recurrence.
 */
export const Event: Noun = {
  singular: 'event',
  plural: 'events',
  description: 'A calendar event, meeting, or appointment',

  properties: {
    // Basic details
    title: {
      type: 'string',
      description: 'Event title or summary',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Event description or notes',
    },
    location: {
      type: 'string',
      optional: true,
      description: 'Event location (address, room, or virtual meeting link)',
    },

    // Timing
    startTime: {
      type: 'datetime',
      description: 'Event start date and time',
    },
    endTime: {
      type: 'datetime',
      description: 'Event end date and time',
    },
    allDay: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is an all-day event',
    },
    timezone: {
      type: 'string',
      optional: true,
      description: 'Event timezone (IANA timezone identifier)',
    },

    // Recurrence
    recurring: {
      type: 'boolean',
      optional: true,
      description: 'Whether this event recurs',
    },
    recurrenceRule: {
      type: 'string',
      optional: true,
      description: 'Recurrence rule in RRULE format (RFC 5545)',
    },
    recurrenceId: {
      type: 'string',
      optional: true,
      description: 'Parent recurring event ID if this is an occurrence',
    },
    exceptions: {
      type: 'datetime',
      array: true,
      optional: true,
      description: 'Dates excluded from the recurrence',
    },

    // Attendees
    attendees: {
      type: 'json',
      array: true,
      optional: true,
      description: 'List of attendees with email, name, response status',
    },
    organizer: {
      type: 'json',
      optional: true,
      description: 'Event organizer information',
    },

    // Status
    status: {
      type: 'string',
      description: 'Event status: confirmed, tentative, cancelled',
      examples: ['confirmed', 'tentative', 'cancelled'],
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Event visibility: public, private, confidential',
      examples: ['public', 'private', 'confidential'],
    },
    transparency: {
      type: 'string',
      optional: true,
      description: 'Free/busy status: opaque (busy), transparent (free)',
      examples: ['opaque', 'transparent'],
    },

    // Reminders
    reminders: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Reminder notifications with method and time offset',
    },

    // Meeting details
    conferenceData: {
      type: 'json',
      optional: true,
      description: 'Video/phone conference details (Zoom, Meet, Teams links)',
    },
    attachments: {
      type: 'json',
      array: true,
      optional: true,
      description: 'File attachments with URLs',
    },

    // Metadata
    color: {
      type: 'string',
      optional: true,
      description: 'Event color override',
    },
    responseStatus: {
      type: 'string',
      optional: true,
      description: 'User response: accepted, declined, tentative, needsAction',
      examples: ['accepted', 'declined', 'tentative', 'needsAction'],
    },
  },

  relationships: {
    calendar: {
      type: 'Calendar',
      backref: 'events',
      description: 'Calendar this event belongs to',
    },
    relatedTasks: {
      type: 'Task[]',
      description: 'Tasks associated with this event',
    },
    relatedNotes: {
      type: 'Note[]',
      description: 'Notes related to this event',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'cancel',
    'reschedule',
    'invite',
    'respond',
    'accept',
    'decline',
    'markTentative',
    'addAttendee',
    'removeAttendee',
    'addReminder',
    'removeReminder',
    'duplicate',
    'move',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'cancelled',
    'rescheduled',
    'invitationSent',
    'responseReceived',
    'accepted',
    'declined',
    'tentative',
    'attendeeAdded',
    'attendeeRemoved',
    'reminderTriggered',
    'started',
    'ended',
  ],
}

// =============================================================================
// Task Management
// =============================================================================

/**
 * Task entity
 *
 * Represents a todo item with status, priority, due date, and assignee.
 */
export const Task: Noun = {
  singular: 'task',
  plural: 'tasks',
  description: 'A todo item or work task to be completed',

  properties: {
    // Basic details
    title: {
      type: 'string',
      description: 'Task title or summary',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Detailed task description',
    },

    // Status and progress
    status: {
      type: 'string',
      description: 'Task status: todo, in-progress, blocked, done, cancelled',
      examples: ['todo', 'in-progress', 'blocked', 'done', 'cancelled'],
    },
    completed: {
      type: 'boolean',
      optional: true,
      description: 'Whether the task is completed',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the task was completed',
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Task progress percentage (0-100)',
    },

    // Scheduling
    dueDate: {
      type: 'datetime',
      optional: true,
      description: 'Task due date',
    },
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Task start date',
    },
    estimatedDuration: {
      type: 'number',
      optional: true,
      description: 'Estimated time to complete in minutes',
    },
    actualDuration: {
      type: 'number',
      optional: true,
      description: 'Actual time spent in minutes',
    },

    // Priority and categorization
    priority: {
      type: 'string',
      optional: true,
      description: 'Task priority: low, medium, high, urgent',
      examples: ['low', 'medium', 'high', 'urgent'],
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    labels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Labels for organization',
    },

    // Assignment
    assignee: {
      type: 'string',
      optional: true,
      description: 'Person assigned to this task',
    },
    reporter: {
      type: 'string',
      optional: true,
      description: 'Person who created/reported this task',
    },

    // Organization
    project: {
      type: 'string',
      optional: true,
      description: 'Project this task belongs to',
    },
    section: {
      type: 'string',
      optional: true,
      description: 'Section or column within a project',
    },
    position: {
      type: 'number',
      optional: true,
      description: 'Position in the task list',
    },

    // Dependencies
    blockedBy: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Task IDs that block this task',
    },
    blocking: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Task IDs that this task blocks',
    },

    // Metadata
    recurring: {
      type: 'boolean',
      optional: true,
      description: 'Whether this task recurs',
    },
    recurrenceRule: {
      type: 'string',
      optional: true,
      description: 'Recurrence rule in RRULE format',
    },
  },

  relationships: {
    subtasks: {
      type: 'Task[]',
      description: 'Subtasks of this task',
    },
    parentTask: {
      type: 'Task',
      required: false,
      description: 'Parent task if this is a subtask',
    },
    checklist: {
      type: 'Checklist',
      required: false,
      backref: 'tasks',
      description: 'Checklist this task belongs to',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to this task',
    },
    comments: {
      type: 'Comment[]',
      description: 'Comments on this task',
    },
    relatedEvents: {
      type: 'Event[]',
      description: 'Calendar events related to this task',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'complete',
    'uncomplete',
    'start',
    'pause',
    'block',
    'unblock',
    'assign',
    'unassign',
    'setPriority',
    'setDueDate',
    'addSubtask',
    'removeSubtask',
    'addTag',
    'removeTag',
    'move',
    'duplicate',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'completed',
    'uncompleted',
    'started',
    'paused',
    'blocked',
    'unblocked',
    'assigned',
    'unassigned',
    'priorityChanged',
    'dueDateChanged',
    'overdue',
    'subtaskAdded',
    'subtaskCompleted',
    'commented',
    'archived',
  ],
}

/**
 * Checklist entity
 *
 * Represents a list of checkbox items or tasks.
 */
export const Checklist: Noun = {
  singular: 'checklist',
  plural: 'checklists',
  description: 'A list of checkbox items or tasks to be completed',

  properties: {
    title: {
      type: 'string',
      description: 'Checklist title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Checklist description',
    },
    itemCount: {
      type: 'number',
      optional: true,
      description: 'Total number of items',
    },
    completedCount: {
      type: 'number',
      optional: true,
      description: 'Number of completed items',
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Completion progress percentage (0-100)',
    },
    template: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a reusable template',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
  },

  relationships: {
    tasks: {
      type: 'Task[]',
      backref: 'checklist',
      description: 'Tasks/items in this checklist',
    },
    relatedNote: {
      type: 'Note',
      required: false,
      description: 'Note this checklist is embedded in',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'addItem',
    'removeItem',
    'checkItem',
    'uncheckItem',
    'reorderItems',
    'clear',
    'reset',
    'duplicate',
    'convertToTemplate',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'itemAdded',
    'itemRemoved',
    'itemChecked',
    'itemUnchecked',
    'itemsReordered',
    'cleared',
    'completed',
    'duplicated',
  ],
}

// =============================================================================
// Note Taking
// =============================================================================

/**
 * Note entity
 *
 * Represents a note or memo (like Notion, Evernote, OneNote).
 */
export const Note: Noun = {
  singular: 'note',
  plural: 'notes',
  description: 'A note, memo, or document for capturing information',

  properties: {
    title: {
      type: 'string',
      description: 'Note title',
    },
    content: {
      type: 'markdown',
      description: 'Note content (markdown, rich text, or blocks)',
    },
    plainText: {
      type: 'string',
      optional: true,
      description: 'Plain text version of the content',
    },
    format: {
      type: 'string',
      optional: true,
      description: 'Content format: markdown, html, blocks, plaintext',
      examples: ['markdown', 'html', 'blocks', 'plaintext'],
    },

    // Organization
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or path within notebook',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Status
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether the note is pinned',
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the note is archived',
    },
    favorited: {
      type: 'boolean',
      optional: true,
      description: 'Whether the note is favorited/starred',
    },
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether the note is locked from editing',
    },

    // Metadata
    wordCount: {
      type: 'number',
      optional: true,
      description: 'Number of words in the note',
    },
    characterCount: {
      type: 'number',
      optional: true,
      description: 'Number of characters',
    },
    language: {
      type: 'string',
      optional: true,
      description: 'Note language code',
    },

    // Sharing and collaboration
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether the note is shared',
    },
    publicUrl: {
      type: 'url',
      optional: true,
      description: 'Public sharing URL if shared',
    },

    // Source
    sourceUrl: {
      type: 'url',
      optional: true,
      description: 'Original source URL if clipped from web',
    },
    author: {
      type: 'string',
      optional: true,
      description: 'Original author if sourced externally',
    },
  },

  relationships: {
    notebook: {
      type: 'Notebook',
      backref: 'notes',
      description: 'Notebook this note belongs to',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files, images, audio attached to this note',
    },
    checklists: {
      type: 'Checklist[]',
      description: 'Embedded checklists',
    },
    linkedNotes: {
      type: 'Note[]',
      description: 'Other notes linked from this note',
    },
    backlinks: {
      type: 'Note[]',
      description: 'Notes that link to this note',
    },
    tasks: {
      type: 'Task[]',
      description: 'Tasks embedded in this note',
    },
    reminders: {
      type: 'Reminder[]',
      description: 'Reminders associated with this note',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'archive',
    'unarchive',
    'pin',
    'unpin',
    'favorite',
    'unfavorite',
    'lock',
    'unlock',
    'share',
    'unshare',
    'duplicate',
    'export',
    'print',
    'addTag',
    'removeTag',
    'move',
    'merge',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'archived',
    'unarchived',
    'pinned',
    'unpinned',
    'favorited',
    'unfavorited',
    'locked',
    'unlocked',
    'shared',
    'unshared',
    'duplicated',
    'exported',
    'printed',
    'moved',
    'merged',
  ],
}

/**
 * Notebook entity
 *
 * Represents a collection of notes (like an Evernote notebook or Notion workspace).
 */
export const Notebook: Noun = {
  singular: 'notebook',
  plural: 'notebooks',
  description: 'A collection or folder of related notes',

  properties: {
    name: {
      type: 'string',
      description: 'Notebook name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Notebook description or purpose',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Color for visual identification',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Icon or emoji for the notebook',
    },
    type: {
      type: 'string',
      optional: true,
      description: 'Notebook type: personal, shared, business, archive',
      examples: ['personal', 'shared', 'business', 'archive'],
    },
    defaultNote: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the default notebook for new notes',
    },
    noteCount: {
      type: 'number',
      optional: true,
      description: 'Number of notes in this notebook',
    },
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether the notebook is shared',
    },
    position: {
      type: 'number',
      optional: true,
      description: 'Position in the notebook list',
    },
  },

  relationships: {
    notes: {
      type: 'Note[]',
      backref: 'notebook',
      description: 'Notes in this notebook',
    },
    parentNotebook: {
      type: 'Notebook',
      required: false,
      description: 'Parent notebook if this is nested',
    },
    subNotebooks: {
      type: 'Notebook[]',
      description: 'Child notebooks',
    },
    owner: {
      type: 'Contact',
      description: 'Notebook owner',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to this notebook',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'rename',
    'share',
    'unshare',
    'move',
    'duplicate',
    'export',
    'import',
    'merge',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'renamed',
    'shared',
    'unshared',
    'moved',
    'duplicated',
    'exported',
    'imported',
    'merged',
    'archived',
  ],
}

// =============================================================================
// Reminders and Bookmarks
// =============================================================================

/**
 * Reminder entity
 *
 * Represents a time-based reminder or alert.
 */
export const Reminder: Noun = {
  singular: 'reminder',
  plural: 'reminders',
  description: 'A time-based reminder or notification',

  properties: {
    title: {
      type: 'string',
      description: 'Reminder title or message',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Additional reminder details',
    },

    // Timing
    dueDate: {
      type: 'datetime',
      description: 'When the reminder should trigger',
    },
    timezone: {
      type: 'string',
      optional: true,
      description: 'Timezone for the reminder (IANA timezone identifier)',
    },
    allDay: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is an all-day reminder',
    },

    // Recurrence
    recurring: {
      type: 'boolean',
      optional: true,
      description: 'Whether this reminder recurs',
    },
    recurrenceRule: {
      type: 'string',
      optional: true,
      description: 'Recurrence rule in RRULE format',
    },

    // Status
    completed: {
      type: 'boolean',
      optional: true,
      description: 'Whether the reminder has been completed',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the reminder was marked complete',
    },
    snoozedUntil: {
      type: 'datetime',
      optional: true,
      description: 'Snoozed until this time',
    },
    triggered: {
      type: 'boolean',
      optional: true,
      description: 'Whether the reminder notification has been triggered',
    },
    triggeredAt: {
      type: 'datetime',
      optional: true,
      description: 'When the reminder was triggered',
    },

    // Priority and categorization
    priority: {
      type: 'string',
      optional: true,
      description: 'Reminder priority: low, medium, high',
      examples: ['low', 'medium', 'high'],
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    list: {
      type: 'string',
      optional: true,
      description: 'List or category the reminder belongs to',
    },

    // Notification
    notificationMethod: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Notification methods: push, email, sms',
      examples: ['push', 'email', 'sms'],
    },
  },

  relationships: {
    relatedTask: {
      type: 'Task',
      required: false,
      description: 'Task associated with this reminder',
    },
    relatedEvent: {
      type: 'Event',
      required: false,
      description: 'Calendar event associated with this reminder',
    },
    relatedNote: {
      type: 'Note',
      required: false,
      description: 'Note associated with this reminder',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'complete',
    'uncomplete',
    'snooze',
    'dismiss',
    'trigger',
    'reschedule',
    'duplicate',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'completed',
    'uncompleted',
    'snoozed',
    'dismissed',
    'triggered',
    'rescheduled',
    'duplicated',
  ],
}

/**
 * Bookmark entity
 *
 * Represents a saved link or URL with tags and metadata.
 */
export const Bookmark: Noun = {
  singular: 'bookmark',
  plural: 'bookmarks',
  description: 'A saved link, URL, or web page reference',

  properties: {
    title: {
      type: 'string',
      description: 'Bookmark title or page title',
    },
    url: {
      type: 'url',
      description: 'The bookmarked URL',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Bookmark description or notes',
    },

    // Metadata
    favicon: {
      type: 'url',
      optional: true,
      description: 'URL to the site favicon',
    },
    screenshot: {
      type: 'url',
      optional: true,
      description: 'Screenshot or preview image URL',
    },
    excerpt: {
      type: 'string',
      optional: true,
      description: 'Text excerpt from the page',
    },

    // Organization
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or collection the bookmark belongs to',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Status
    favorited: {
      type: 'boolean',
      optional: true,
      description: 'Whether the bookmark is favorited',
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the bookmark is archived',
    },
    private: {
      type: 'boolean',
      optional: true,
      description: 'Whether the bookmark is private',
    },
    unread: {
      type: 'boolean',
      optional: true,
      description: 'Whether the bookmark is marked as unread',
    },

    // Web page metadata
    author: {
      type: 'string',
      optional: true,
      description: 'Page author if available',
    },
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the page was published',
    },
    siteName: {
      type: 'string',
      optional: true,
      description: 'Name of the website',
    },
    domain: {
      type: 'string',
      optional: true,
      description: 'Domain name of the URL',
    },

    // Archive
    archived_content: {
      type: 'markdown',
      optional: true,
      description: 'Archived page content',
    },
    archivedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the page content was archived',
    },

    // Access
    lastVisitedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the bookmark was last visited',
    },
    visitCount: {
      type: 'number',
      optional: true,
      description: 'Number of times visited',
    },
  },

  relationships: {
    relatedNotes: {
      type: 'Note[]',
      description: 'Notes that reference this bookmark',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'visit',
    'favorite',
    'unfavorite',
    'archive',
    'unarchive',
    'addTag',
    'removeTag',
    'move',
    'share',
    'export',
    'import',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'visited',
    'favorited',
    'unfavorited',
    'archived',
    'unarchived',
    'moved',
    'shared',
    'exported',
    'imported',
  ],
}

// =============================================================================
// Availability
// =============================================================================

/**
 * Availability entity
 *
 * Represents a user's available time windows for scheduling meetings.
 * Used by scheduling tools like Calendly, Cal.com, etc.
 */
export const Availability: Noun = {
  singular: 'availability',
  plural: 'availabilities',
  description: "A user's available time windows for scheduling",

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Availability schedule name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of this availability schedule',
    },

    // Timezone
    timezone: {
      type: 'string',
      description: 'Timezone for availability windows',
    },

    // Weekly recurring schedule
    schedule: {
      type: 'json',
      description: 'Weekly recurring availability (day -> time ranges)',
    },

    // Exceptions
    dateOverrides: {
      type: 'json',
      optional: true,
      description: 'Specific date overrides to the regular schedule',
    },
    blockedDates: {
      type: 'datetime',
      array: true,
      optional: true,
      description: 'Dates when unavailable',
    },

    // Buffer settings
    bufferBefore: {
      type: 'number',
      optional: true,
      description: 'Buffer time before meetings in minutes',
    },
    bufferAfter: {
      type: 'number',
      optional: true,
      description: 'Buffer time after meetings in minutes',
    },
    minimumNotice: {
      type: 'number',
      optional: true,
      description: 'Minimum advance notice required in hours',
    },

    // Scheduling window
    daysInAdvance: {
      type: 'number',
      optional: true,
      description: 'How many days in advance can be booked',
    },
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Date when availability starts',
    },
    endDate: {
      type: 'datetime',
      optional: true,
      description: 'Date when availability ends',
    },

    // Status
    isDefault: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the default availability',
    },
    active: {
      type: 'boolean',
      description: 'Whether this availability is active',
    },
  },

  relationships: {
    calendar: {
      type: 'Calendar',
      required: false,
      description: 'Associated calendar for conflict checking',
    },
    user: {
      type: 'User',
      description: 'User this availability belongs to',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'activate',
    'deactivate',
    'setDefault',
    'addOverride',
    'removeOverride',
    'blockDate',
    'unblockDate',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'activated',
    'deactivated',
    'overrideAdded',
    'overrideRemoved',
    'dateBlocked',
    'dateUnblocked',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All productivity tool entity types
 */
export const ProductivityEntities = {
  // Calendar & Scheduling
  Calendar,
  Event,
  Availability,

  // Task Management
  Task,
  Checklist,

  // Note Taking
  Note,
  Notebook,

  // Reminders and Bookmarks
  Reminder,
  Bookmark,
}

/**
 * Entity categories for organization
 */
export const ProductivityCategories = {
  calendar: ['Calendar', 'Event', 'Availability'],
  tasks: ['Task', 'Checklist'],
  notes: ['Note', 'Notebook'],
  reminders: ['Reminder'],
  bookmarks: ['Bookmark'],
} as const
