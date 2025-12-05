/**
 * Video Conferencing Entity Types (Nouns)
 *
 * Semantic type definitions for video conferencing tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Meeting
// =============================================================================

/**
 * Meeting - A video meeting/conference call
 *
 * Represents a scheduled or instant video meeting with participants.
 * This is the brand-agnostic equivalent of:
 * - Zoom Meeting
 * - Google Meet
 * - Microsoft Teams Meeting
 */
export const Meeting: Noun = {
  singular: 'meeting',
  plural: 'meetings',
  description: 'A video conference meeting with participants',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Meeting title or topic',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Meeting description or agenda',
    },
    meetingId: {
      type: 'string',
      description: 'Unique meeting identifier',
    },
    passcode: {
      type: 'string',
      optional: true,
      description: 'Meeting passcode for security',
    },

    // URL/Link
    joinUrl: {
      type: 'url',
      description: 'URL to join the meeting',
    },
    startUrl: {
      type: 'url',
      optional: true,
      description: 'URL for the host to start the meeting',
    },

    // Scheduling
    scheduledAt: {
      type: 'datetime',
      optional: true,
      description: 'When the meeting is scheduled to start',
    },
    scheduledDuration: {
      type: 'number',
      optional: true,
      description: 'Scheduled duration in minutes',
    },
    timezone: {
      type: 'string',
      optional: true,
      description: 'Timezone for the meeting',
    },

    // Status & Timing
    status: {
      type: 'string',
      description: 'Meeting status: scheduled, waiting, in-progress, ended, canceled',
      examples: ['scheduled', 'waiting', 'in-progress', 'ended', 'canceled'],
    },
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the meeting actually started',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the meeting ended',
    },
    actualDuration: {
      type: 'number',
      optional: true,
      description: 'Actual meeting duration in minutes',
    },

    // Settings
    isRecurring: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a recurring meeting',
    },
    recurrenceRule: {
      type: 'string',
      optional: true,
      description: 'Recurrence pattern (RRULE format)',
    },
    requiresPassword: {
      type: 'boolean',
      optional: true,
      description: 'Whether a password is required to join',
    },
    waitingRoomEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether waiting room is enabled',
    },
    recordingEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether recording is enabled',
    },
    autoRecording: {
      type: 'boolean',
      optional: true,
      description: 'Whether to automatically start recording',
    },
    muteOnEntry: {
      type: 'boolean',
      optional: true,
      description: 'Whether participants are muted on entry',
    },
    allowScreenSharing: {
      type: 'boolean',
      optional: true,
      description: 'Whether screen sharing is allowed',
    },
    allowChat: {
      type: 'boolean',
      optional: true,
      description: 'Whether chat is enabled',
    },

    // Statistics
    participantCount: {
      type: 'number',
      optional: true,
      description: 'Current or maximum number of participants',
    },
    maxParticipants: {
      type: 'number',
      optional: true,
      description: 'Maximum allowed participants',
    },

    // Integration
    calendarEventId: {
      type: 'string',
      optional: true,
      description: 'Associated calendar event ID',
    },
  },

  relationships: {
    host: {
      type: 'Contact',
      description: 'Meeting host/organizer',
    },
    participants: {
      type: 'MeetingParticipant[]',
      backref: 'meeting',
      description: 'Participants in the meeting',
    },
    recordings: {
      type: 'MeetingRecording[]',
      backref: 'meeting',
      description: 'Recordings of this meeting',
    },
    breakoutRooms: {
      type: 'BreakoutRoom[]',
      backref: 'meeting',
      description: 'Breakout rooms created in this meeting',
    },
    polls: {
      type: 'MeetingPoll[]',
      backref: 'meeting',
      description: 'Polls launched during the meeting',
    },
    chat: {
      type: 'MeetingChat',
      backref: 'meeting',
      description: 'Chat messages during the meeting',
    },
    room: {
      type: 'MeetingRoom',
      required: false,
      description: 'Virtual meeting room if this is a persistent room',
    },
  },

  actions: [
    'schedule',
    'start',
    'join',
    'leave',
    'end',
    'cancel',
    'reschedule',
    'invite',
    'admit',
    'remove',
    'mute',
    'unmute',
    'muteAll',
    'unmuteAll',
    'startRecording',
    'stopRecording',
    'pauseRecording',
    'resumeRecording',
    'shareScreen',
    'stopScreenShare',
    'lock',
    'unlock',
    'createBreakoutRooms',
    'launchPoll',
    'sendChat',
  ],

  events: [
    'scheduled',
    'started',
    'joined',
    'left',
    'ended',
    'canceled',
    'rescheduled',
    'participantJoined',
    'participantLeft',
    'participantAdmitted',
    'participantRemoved',
    'recordingStarted',
    'recordingStopped',
    'recordingPaused',
    'recordingResumed',
    'screenShareStarted',
    'screenShareStopped',
    'locked',
    'unlocked',
    'breakoutRoomsCreated',
    'breakoutRoomsClosed',
    'pollLaunched',
    'chatMessageSent',
  ],
}

/**
 * MeetingParticipant - A participant in a meeting
 *
 * Represents an individual participant's session within a meeting.
 */
export const MeetingParticipant: Noun = {
  singular: 'meeting participant',
  plural: 'meeting participants',
  description: 'A participant in a video meeting',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Participant display name',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Participant email address',
    },
    userId: {
      type: 'string',
      optional: true,
      description: 'User ID if authenticated',
    },

    // Role
    role: {
      type: 'string',
      description: 'Participant role: host, co-host, panelist, attendee, guest',
      examples: ['host', 'co-host', 'panelist', 'attendee', 'guest'],
    },

    // Timing
    joinedAt: {
      type: 'datetime',
      description: 'When the participant joined',
    },
    leftAt: {
      type: 'datetime',
      optional: true,
      description: 'When the participant left',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Duration of participation in minutes',
    },

    // Status
    status: {
      type: 'string',
      description: 'Participant status: waiting, admitted, in-meeting, left, removed',
      examples: ['waiting', 'admitted', 'in-meeting', 'left', 'removed'],
    },
    isOnline: {
      type: 'boolean',
      optional: true,
      description: 'Whether currently connected',
    },

    // Media State
    audioEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether audio is enabled',
    },
    videoEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether video is enabled',
    },
    screenSharing: {
      type: 'boolean',
      optional: true,
      description: 'Whether currently sharing screen',
    },
    handRaised: {
      type: 'boolean',
      optional: true,
      description: 'Whether hand is raised',
    },

    // Device & Connection
    deviceType: {
      type: 'string',
      optional: true,
      description: 'Device type: desktop, mobile, tablet, phone',
      examples: ['desktop', 'mobile', 'tablet', 'phone'],
    },
    connectionQuality: {
      type: 'string',
      optional: true,
      description: 'Connection quality: excellent, good, fair, poor',
      examples: ['excellent', 'good', 'fair', 'poor'],
    },
    location: {
      type: 'string',
      optional: true,
      description: 'Geographic location (city, country)',
    },
  },

  relationships: {
    meeting: {
      type: 'Meeting',
      backref: 'participants',
      description: 'The meeting this participant is in',
    },
    contact: {
      type: 'Contact',
      required: false,
      description: 'Associated contact record',
    },
    breakoutRoom: {
      type: 'BreakoutRoom',
      required: false,
      description: 'Current breakout room if assigned',
    },
  },

  actions: [
    'admit',
    'remove',
    'promote',
    'demote',
    'mute',
    'unmute',
    'disableVideo',
    'enableVideo',
    'spotlight',
    'pin',
    'sendToBreakoutRoom',
    'allowToTalk',
    'putOnHold',
  ],

  events: [
    'joined',
    'left',
    'admitted',
    'removed',
    'promoted',
    'demoted',
    'muted',
    'unmuted',
    'videoDisabled',
    'videoEnabled',
    'startedScreenShare',
    'stoppedScreenShare',
    'raisedHand',
    'loweredHand',
    'sentToBreakoutRoom',
    'returnedFromBreakoutRoom',
  ],
}

/**
 * MeetingRecording - A recording of a meeting
 *
 * Represents a video/audio recording of a meeting session.
 */
export const MeetingRecording: Noun = {
  singular: 'meeting recording',
  plural: 'meeting recordings',
  description: 'A recording of a video meeting',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Recording title (often same as meeting title)',
    },
    recordingId: {
      type: 'string',
      description: 'Unique recording identifier',
    },

    // Type & Format
    recordingType: {
      type: 'string',
      description: 'Recording type: cloud, local',
      examples: ['cloud', 'local'],
    },
    format: {
      type: 'string',
      description: 'File format: mp4, m4a, mp3, txt, vtt',
      examples: ['mp4', 'm4a', 'mp3', 'txt', 'vtt'],
    },
    fileType: {
      type: 'string',
      description: 'Content type: video, audio, transcript, chat',
      examples: ['video', 'audio', 'transcript', 'chat'],
    },

    // Status & Timing
    status: {
      type: 'string',
      description: 'Recording status: recording, processing, completed, failed',
      examples: ['recording', 'processing', 'completed', 'failed'],
    },
    startedAt: {
      type: 'datetime',
      description: 'When recording started',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'When recording ended',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Recording duration in minutes',
    },

    // File Info
    size: {
      type: 'number',
      optional: true,
      description: 'File size in bytes',
    },
    url: {
      type: 'url',
      optional: true,
      description: 'URL to download/stream the recording',
    },
    playUrl: {
      type: 'url',
      optional: true,
      description: 'URL to play the recording',
    },
    downloadUrl: {
      type: 'url',
      optional: true,
      description: 'URL to download the recording',
    },

    // Security
    passcode: {
      type: 'string',
      optional: true,
      description: 'Passcode to access the recording',
    },
    shareUrl: {
      type: 'url',
      optional: true,
      description: 'Shareable URL for the recording',
    },

    // Features
    hasTranscript: {
      type: 'boolean',
      optional: true,
      description: 'Whether transcript is available',
    },
    hasCaptions: {
      type: 'boolean',
      optional: true,
      description: 'Whether captions are available',
    },
    transcriptUrl: {
      type: 'url',
      optional: true,
      description: 'URL to transcript file',
    },

    // Settings
    autoDelete: {
      type: 'boolean',
      optional: true,
      description: 'Whether recording will be auto-deleted',
    },
    autoDeleteDate: {
      type: 'datetime',
      optional: true,
      description: 'When recording will be auto-deleted',
    },
  },

  relationships: {
    meeting: {
      type: 'Meeting',
      backref: 'recordings',
      description: 'The meeting that was recorded',
    },
    recordedBy: {
      type: 'Contact',
      description: 'Who started the recording',
    },
  },

  actions: [
    'start',
    'stop',
    'pause',
    'resume',
    'download',
    'play',
    'share',
    'delete',
    'transcribe',
    'generateCaptions',
    'setExpiration',
  ],

  events: [
    'started',
    'stopped',
    'paused',
    'resumed',
    'completed',
    'failed',
    'downloaded',
    'shared',
    'deleted',
    'transcribed',
    'viewed',
  ],
}

// =============================================================================
// Webinar
// =============================================================================

/**
 * Webinar - A webinar event with registration and large audience
 *
 * Represents a large-scale online presentation or seminar, typically with
 * panelists presenting to attendees who have registered.
 */
export const Webinar: Noun = {
  singular: 'webinar',
  plural: 'webinars',
  description: 'A webinar event with registration, panelists, and attendees',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Webinar title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Webinar description and details',
    },
    webinarId: {
      type: 'string',
      description: 'Unique webinar identifier',
    },

    // Scheduling
    scheduledAt: {
      type: 'datetime',
      description: 'When the webinar is scheduled to start',
    },
    scheduledDuration: {
      type: 'number',
      description: 'Scheduled duration in minutes',
    },
    timezone: {
      type: 'string',
      description: 'Timezone for the webinar',
    },

    // Status & Timing
    status: {
      type: 'string',
      description: 'Webinar status: draft, scheduled, live, ended, canceled',
      examples: ['draft', 'scheduled', 'live', 'ended', 'canceled'],
    },
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the webinar actually started',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the webinar ended',
    },

    // Registration
    registrationRequired: {
      type: 'boolean',
      description: 'Whether registration is required',
    },
    registrationUrl: {
      type: 'url',
      optional: true,
      description: 'URL for registration page',
    },
    approvalRequired: {
      type: 'boolean',
      optional: true,
      description: 'Whether registrations need approval',
    },
    registrationCapacity: {
      type: 'number',
      optional: true,
      description: 'Maximum number of registrants',
    },
    registrationCount: {
      type: 'number',
      optional: true,
      description: 'Current number of registrants',
    },
    attendeeCount: {
      type: 'number',
      optional: true,
      description: 'Number of attendees who joined',
    },

    // URLs
    joinUrl: {
      type: 'url',
      description: 'URL for attendees to join',
    },
    startUrl: {
      type: 'url',
      optional: true,
      description: 'URL for host to start the webinar',
    },
    practiceSessionUrl: {
      type: 'url',
      optional: true,
      description: 'URL for practice session',
    },

    // Settings
    recordingEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether recording is enabled',
    },
    autoRecording: {
      type: 'boolean',
      optional: true,
      description: 'Whether to automatically start recording',
    },
    allowQA: {
      type: 'boolean',
      optional: true,
      description: 'Whether Q&A is enabled',
    },
    allowPolls: {
      type: 'boolean',
      optional: true,
      description: 'Whether polls are enabled',
    },
    allowChat: {
      type: 'boolean',
      optional: true,
      description: 'Whether chat is enabled',
    },
    practiceSessionEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether practice session is available',
    },

    // Email Notifications
    sendConfirmationEmail: {
      type: 'boolean',
      optional: true,
      description: 'Whether to send confirmation emails',
    },
    sendReminderEmail: {
      type: 'boolean',
      optional: true,
      description: 'Whether to send reminder emails',
    },
  },

  relationships: {
    host: {
      type: 'Contact',
      description: 'Webinar host/organizer',
    },
    panelists: {
      type: 'Contact[]',
      description: 'Webinar panelists/presenters',
    },
    registrants: {
      type: 'WebinarRegistrant[]',
      backref: 'webinar',
      description: 'People registered for the webinar',
    },
    recordings: {
      type: 'MeetingRecording[]',
      description: 'Recordings of the webinar',
    },
    polls: {
      type: 'MeetingPoll[]',
      description: 'Polls used in the webinar',
    },
  },

  actions: [
    'create',
    'schedule',
    'start',
    'end',
    'cancel',
    'reschedule',
    'addPanelist',
    'removePanelist',
    'approveRegistrant',
    'rejectRegistrant',
    'sendInvitation',
    'sendReminder',
    'startPracticeSession',
    'startRecording',
    'stopRecording',
    'launchPoll',
    'muteAttendees',
  ],

  events: [
    'created',
    'scheduled',
    'started',
    'ended',
    'canceled',
    'rescheduled',
    'panelistAdded',
    'panelistRemoved',
    'registrantRegistered',
    'registrantApproved',
    'registrantRejected',
    'registrantJoined',
    'registrantLeft',
    'recordingStarted',
    'recordingStopped',
    'pollLaunched',
  ],
}

/**
 * WebinarRegistrant - A registrant for a webinar
 *
 * Represents someone who has registered for a webinar.
 */
export const WebinarRegistrant: Noun = {
  singular: 'webinar registrant',
  plural: 'webinar registrants',
  description: 'A person registered for a webinar',

  properties: {
    // Identity
    email: {
      type: 'string',
      description: 'Registrant email address',
    },
    firstName: {
      type: 'string',
      description: 'First name',
    },
    lastName: {
      type: 'string',
      description: 'Last name',
    },
    organization: {
      type: 'string',
      optional: true,
      description: 'Organization or company',
    },
    jobTitle: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },

    // Registration
    registeredAt: {
      type: 'datetime',
      description: 'When they registered',
    },
    registrationStatus: {
      type: 'string',
      description: 'Registration status: pending, approved, rejected, canceled',
      examples: ['pending', 'approved', 'rejected', 'canceled'],
    },

    // Attendance
    attended: {
      type: 'boolean',
      optional: true,
      description: 'Whether they attended the webinar',
    },
    joinedAt: {
      type: 'datetime',
      optional: true,
      description: 'When they joined the webinar',
    },
    leftAt: {
      type: 'datetime',
      optional: true,
      description: 'When they left the webinar',
    },
    attendanceDuration: {
      type: 'number',
      optional: true,
      description: 'Duration of attendance in minutes',
    },

    // Access
    joinUrl: {
      type: 'url',
      optional: true,
      description: 'Personal join URL',
    },

    // Custom Questions
    customAnswers: {
      type: 'json',
      optional: true,
      description: 'Answers to custom registration questions',
    },
  },

  relationships: {
    webinar: {
      type: 'Webinar',
      backref: 'registrants',
      description: 'The webinar they registered for',
    },
    contact: {
      type: 'Contact',
      required: false,
      description: 'Associated contact record',
    },
  },

  actions: [
    'register',
    'approve',
    'reject',
    'cancel',
    'sendJoinUrl',
    'sendReminder',
  ],

  events: [
    'registered',
    'approved',
    'rejected',
    'canceled',
    'joined',
    'left',
    'reminderSent',
  ],
}

// =============================================================================
// Meeting Room
// =============================================================================

/**
 * MeetingRoom - A persistent virtual meeting room
 *
 * Represents a permanent virtual room with a fixed URL that can be used
 * for multiple meetings over time. Similar to Zoom Personal Meeting Room.
 */
export const MeetingRoom: Noun = {
  singular: 'meeting room',
  plural: 'meeting rooms',
  description: 'A persistent virtual meeting room with a permanent URL',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Room name',
    },
    roomId: {
      type: 'string',
      description: 'Unique room identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Room description or purpose',
    },

    // Access
    permanentUrl: {
      type: 'url',
      description: 'Permanent URL to join this room',
    },
    roomNumber: {
      type: 'string',
      optional: true,
      description: 'Room number or ID (e.g., PMI)',
    },
    passcode: {
      type: 'string',
      optional: true,
      description: 'Passcode to join the room',
    },

    // Settings
    isPublic: {
      type: 'boolean',
      optional: true,
      description: 'Whether the room is publicly accessible',
    },
    requiresPassword: {
      type: 'boolean',
      optional: true,
      description: 'Whether password is required',
    },
    waitingRoomEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether waiting room is enabled',
    },
    maxParticipants: {
      type: 'number',
      optional: true,
      description: 'Maximum number of participants',
    },

    // Status
    isActive: {
      type: 'boolean',
      optional: true,
      description: 'Whether there is currently an active meeting',
    },
    currentParticipantCount: {
      type: 'number',
      optional: true,
      description: 'Current number of participants',
    },

    // Usage
    totalMeetings: {
      type: 'number',
      optional: true,
      description: 'Total number of meetings held in this room',
    },
    lastUsedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the room was last used',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Room owner',
    },
    coHosts: {
      type: 'Contact[]',
      description: 'Co-hosts with access to manage the room',
    },
    meetings: {
      type: 'Meeting[]',
      description: 'Meetings held in this room',
    },
  },

  actions: [
    'create',
    'configure',
    'start',
    'lock',
    'unlock',
    'delete',
    'addCoHost',
    'removeCoHost',
    'generateInvite',
    'resetPasscode',
  ],

  events: [
    'created',
    'configured',
    'meetingStarted',
    'meetingEnded',
    'locked',
    'unlocked',
    'deleted',
    'coHostAdded',
    'coHostRemoved',
  ],
}

// =============================================================================
// Breakout Room
// =============================================================================

/**
 * BreakoutRoom - A breakout room within a meeting
 *
 * Represents a separate sub-meeting room where participants can split
 * into smaller groups for discussions.
 */
export const BreakoutRoom: Noun = {
  singular: 'breakout room',
  plural: 'breakout rooms',
  description: 'A breakout room for small group discussions within a meeting',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Breakout room name',
    },
    roomNumber: {
      type: 'number',
      description: 'Room number (1, 2, 3, etc.)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Room status: created, open, closed',
      examples: ['created', 'open', 'closed'],
    },
    isOpen: {
      type: 'boolean',
      optional: true,
      description: 'Whether the room is currently open',
    },

    // Timing
    duration: {
      type: 'number',
      optional: true,
      description: 'Duration in minutes',
    },
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the room was opened',
    },
    closedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the room was closed',
    },

    // Settings
    allowParticipantsToReturn: {
      type: 'boolean',
      optional: true,
      description: 'Whether participants can return to main room',
    },
    autoMoveParticipants: {
      type: 'boolean',
      optional: true,
      description: 'Whether to automatically move participants',
    },

    // Statistics
    participantCount: {
      type: 'number',
      optional: true,
      description: 'Number of participants in this room',
    },
  },

  relationships: {
    meeting: {
      type: 'Meeting',
      backref: 'breakoutRooms',
      description: 'Parent meeting',
    },
    participants: {
      type: 'MeetingParticipant[]',
      description: 'Participants assigned to this room',
    },
  },

  actions: [
    'create',
    'open',
    'close',
    'assignParticipant',
    'removeParticipant',
    'broadcast',
    'rename',
  ],

  events: [
    'created',
    'opened',
    'closed',
    'participantAssigned',
    'participantRemoved',
    'participantJoined',
    'participantLeft',
    'messageReceived',
  ],
}

// =============================================================================
// Meeting Poll
// =============================================================================

/**
 * MeetingPoll - A poll launched during a meeting
 *
 * Represents a poll or survey that can be launched during a meeting
 * to gather real-time feedback from participants.
 */
export const MeetingPoll: Noun = {
  singular: 'meeting poll',
  plural: 'meeting polls',
  description: 'A poll or survey during a meeting',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Poll title or question',
    },
    pollId: {
      type: 'string',
      description: 'Unique poll identifier',
    },

    // Question
    question: {
      type: 'string',
      description: 'Poll question text',
    },
    questionType: {
      type: 'string',
      description: 'Question type: single-choice, multiple-choice, rating, open-ended',
      examples: ['single-choice', 'multiple-choice', 'rating', 'open-ended'],
    },

    // Options
    options: {
      type: 'json',
      array: true,
      description: 'Poll answer options',
    },

    // Status
    status: {
      type: 'string',
      description: 'Poll status: draft, active, ended, results-shared',
      examples: ['draft', 'active', 'ended', 'results-shared'],
    },
    launchedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the poll was launched',
    },
    endedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the poll was ended',
    },

    // Settings
    anonymous: {
      type: 'boolean',
      optional: true,
      description: 'Whether responses are anonymous',
    },
    allowMultipleAnswers: {
      type: 'boolean',
      optional: true,
      description: 'Whether multiple answers are allowed',
    },
    showResults: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show results to participants',
    },

    // Results
    totalResponses: {
      type: 'number',
      optional: true,
      description: 'Total number of responses',
    },
    results: {
      type: 'json',
      optional: true,
      description: 'Poll results and statistics',
    },
  },

  relationships: {
    meeting: {
      type: 'Meeting',
      backref: 'polls',
      description: 'Meeting this poll belongs to',
    },
    createdBy: {
      type: 'Contact',
      description: 'Who created the poll',
    },
  },

  actions: [
    'create',
    'launch',
    'end',
    'delete',
    'shareResults',
    'hideResults',
    'export',
  ],

  events: [
    'created',
    'launched',
    'ended',
    'deleted',
    'responseReceived',
    'resultsShared',
    'resultsHidden',
  ],
}

// =============================================================================
// Meeting Chat
// =============================================================================

/**
 * MeetingChat - Chat messages during a meeting
 *
 * Represents the chat functionality within a meeting, including
 * messages sent to everyone or privately.
 */
export const MeetingChat: Noun = {
  singular: 'meeting chat',
  plural: 'meeting chats',
  description: 'Chat messages and conversations during a meeting',

  properties: {
    // Message
    text: {
      type: 'string',
      description: 'Message text content',
    },
    messageId: {
      type: 'string',
      description: 'Unique message identifier',
    },

    // Timing
    sentAt: {
      type: 'datetime',
      description: 'When the message was sent',
    },

    // Recipient
    recipientType: {
      type: 'string',
      description: 'Who can see the message: everyone, private, panelists, host',
      examples: ['everyone', 'private', 'panelists', 'host'],
    },
    recipientId: {
      type: 'string',
      optional: true,
      description: 'Recipient user ID for private messages',
    },

    // Content Type
    messageType: {
      type: 'string',
      description: 'Message type: text, file, emoji, system',
      examples: ['text', 'file', 'emoji', 'system'],
    },

    // File Attachment
    fileUrl: {
      type: 'url',
      optional: true,
      description: 'URL to attached file',
    },
    fileName: {
      type: 'string',
      optional: true,
      description: 'Name of attached file',
    },
    fileSize: {
      type: 'number',
      optional: true,
      description: 'Size of attached file in bytes',
    },
  },

  relationships: {
    meeting: {
      type: 'Meeting',
      backref: 'chat',
      description: 'Meeting this chat belongs to',
    },
    sender: {
      type: 'MeetingParticipant',
      description: 'Participant who sent the message',
    },
    recipient: {
      type: 'MeetingParticipant',
      required: false,
      description: 'Recipient for private messages',
    },
  },

  actions: [
    'send',
    'delete',
    'save',
    'export',
    'enable',
    'disable',
    'restrictToHost',
  ],

  events: [
    'messageSent',
    'messageDeleted',
    'chatSaved',
    'chatExported',
    'chatEnabled',
    'chatDisabled',
  ],
}

// =============================================================================
// Export all entities
// =============================================================================

/**
 * All video conferencing entity types
 */
export const VideoConferencingEntities = {
  Meeting,
  MeetingParticipant,
  MeetingRecording,
  Webinar,
  WebinarRegistrant,
  MeetingRoom,
  BreakoutRoom,
  MeetingPoll,
  MeetingChat,
}

/**
 * Entity categories for organization
 */
export const VideoConferencingCategories = {
  meeting: ['Meeting', 'MeetingParticipant', 'MeetingRecording', 'MeetingRoom'],
  webinar: ['Webinar', 'WebinarRegistrant'],
  interaction: ['BreakoutRoom', 'MeetingPoll', 'MeetingChat'],
} as const
