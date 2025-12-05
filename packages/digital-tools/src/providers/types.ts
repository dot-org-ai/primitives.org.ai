/**
 * Provider Interface Types
 *
 * Defines the contract that concrete providers must implement.
 * Each provider binds abstract entity types (Nouns) to real APIs/services.
 *
 * @packageDocumentation
 */

import type {
  Email,
  EmailThread,
  Spreadsheet,
  Sheet,
  Cell,
  Document,
  Presentation,
  Slide,
  PhoneCall,
  Voicemail,
  Workspace,
  Channel,
  Message,
  Thread,
  DirectMessage,
  Member,
  Attachment,
  Contact,
} from '../entities.js'

// =============================================================================
// Base Provider Types
// =============================================================================

/**
 * Provider metadata
 */
export interface ProviderInfo {
  /** Unique provider identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Provider description */
  description: string
  /** Provider category */
  category: ProviderCategory
  /** Website URL */
  website?: string
  /** Documentation URL */
  docsUrl?: string
  /** Required configuration keys */
  requiredConfig: string[]
  /** Optional configuration keys */
  optionalConfig?: string[]
}

/**
 * Provider categories
 */
export type ProviderCategory =
  | 'email'
  | 'messaging'
  | 'spreadsheet'
  | 'document'
  | 'presentation'
  | 'phone'
  | 'storage'
  | 'calendar'
  | 'tasks'
  | 'project-management'
  | 'crm'
  | 'development'
  | 'finance'
  | 'support'
  | 'media'
  | 'marketing'
  | 'knowledge'
  | 'ecommerce'
  | 'analytics'
  | 'video-conferencing'
  | 'forms'

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API key or token */
  apiKey?: string
  /** API secret */
  apiSecret?: string
  /** OAuth access token */
  accessToken?: string
  /** OAuth refresh token */
  refreshToken?: string
  /** Base URL override */
  baseUrl?: string
  /** Webhook URL for callbacks */
  webhookUrl?: string
  /** Additional provider-specific config */
  [key: string]: unknown
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  healthy: boolean
  latencyMs?: number
  message?: string
  checkedAt: Date
}

/**
 * Base provider interface
 */
export interface BaseProvider {
  /** Provider metadata */
  readonly info: ProviderInfo

  /** Initialize the provider with config */
  initialize(config: ProviderConfig): Promise<void>

  /** Check provider health/connectivity */
  healthCheck(): Promise<ProviderHealth>

  /** Dispose of provider resources */
  dispose(): Promise<void>
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number
  offset?: number
  cursor?: string
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[]
  total?: number
  hasMore: boolean
  nextCursor?: string
}

// =============================================================================
// Email Provider
// =============================================================================

/**
 * Email send options
 */
export interface SendEmailOptions {
  to: string[]
  cc?: string[]
  bcc?: string[]
  from?: string
  replyTo?: string
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType?: string
    contentId?: string
  }>
  headers?: Record<string, string>
  tags?: string[]
  metadata?: Record<string, string>
  /** Schedule send time */
  sendAt?: Date
  /** Track opens */
  trackOpens?: boolean
  /** Track clicks */
  trackClicks?: boolean
}

/**
 * Email send result
 */
export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: {
    code: string
    message: string
  }
}

/**
 * Email provider interface
 */
export interface EmailProvider extends BaseProvider {
  /** Send an email */
  send(options: SendEmailOptions): Promise<SendEmailResult>

  /** Send multiple emails (batch) */
  sendBatch?(emails: SendEmailOptions[]): Promise<SendEmailResult[]>

  /** Get email by ID */
  get?(messageId: string): Promise<EmailData | null>

  /** List emails */
  list?(options?: EmailListOptions): Promise<PaginatedResult<EmailData>>

  /** Search emails */
  search?(query: string, options?: EmailListOptions): Promise<PaginatedResult<EmailData>>

  /** Get email thread */
  getThread?(threadId: string): Promise<EmailThreadData | null>

  /** Verify domain */
  verifyDomain?(domain: string): Promise<DomainVerification>

  /** List verified domains */
  listDomains?(): Promise<DomainInfo[]>
}

export interface EmailData {
  id: string
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text?: string
  html?: string
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed'
  sentAt?: Date
  deliveredAt?: Date
  openedAt?: Date
  clickedAt?: Date
}

export interface EmailThreadData {
  id: string
  subject: string
  messages: EmailData[]
  participantCount: number
  lastMessageAt: Date
}

export interface EmailListOptions extends PaginationOptions {
  status?: string
  from?: string
  to?: string
  since?: Date
  until?: Date
}

export interface DomainVerification {
  domain: string
  verified: boolean
  dnsRecords: Array<{
    type: 'TXT' | 'CNAME' | 'MX'
    name: string
    value: string
    verified: boolean
  }>
}

export interface DomainInfo {
  domain: string
  verified: boolean
  createdAt: Date
}

// =============================================================================
// Messaging Provider (Slack/Teams/Discord/SMS)
// =============================================================================

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Channel ID or name */
  channel?: string
  /** User ID for DM */
  userId?: string
  /** Thread ID for replies */
  threadId?: string
  /** Message text */
  text: string
  /** Rich blocks/attachments */
  blocks?: unknown[]
  /** Attachments */
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType?: string
  }>
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Send message result
 */
export interface SendMessageResult {
  success: boolean
  messageId?: string
  timestamp?: string
  channel?: string
  error?: {
    code: string
    message: string
  }
}

/**
 * Messaging provider interface
 */
export interface MessagingProvider extends BaseProvider {
  /** Send a message */
  send(options: SendMessageOptions): Promise<SendMessageResult>

  /** Edit a message */
  edit?(messageId: string, text: string, blocks?: unknown[]): Promise<SendMessageResult>

  /** Delete a message */
  delete?(messageId: string, channel: string): Promise<boolean>

  /** React to a message */
  react?(messageId: string, channel: string, emoji: string): Promise<boolean>

  /** Remove reaction */
  unreact?(messageId: string, channel: string, emoji: string): Promise<boolean>

  /** Get message */
  getMessage?(messageId: string, channel: string): Promise<MessageData | null>

  /** List messages in channel */
  listMessages?(channel: string, options?: MessageListOptions): Promise<PaginatedResult<MessageData>>

  /** Search messages */
  searchMessages?(query: string, options?: MessageSearchOptions): Promise<PaginatedResult<MessageData>>

  // Channel operations
  /** List channels */
  listChannels?(options?: ChannelListOptions): Promise<PaginatedResult<ChannelData>>

  /** Get channel */
  getChannel?(channelId: string): Promise<ChannelData | null>

  /** Create channel */
  createChannel?(name: string, options?: CreateChannelOptions): Promise<ChannelData>

  /** Archive channel */
  archiveChannel?(channelId: string): Promise<boolean>

  /** Join channel */
  joinChannel?(channelId: string): Promise<boolean>

  /** Leave channel */
  leaveChannel?(channelId: string): Promise<boolean>

  // User/Member operations
  /** List members */
  listMembers?(options?: MemberListOptions): Promise<PaginatedResult<MemberData>>

  /** Get member */
  getMember?(userId: string): Promise<MemberData | null>

  /** Get user presence */
  getPresence?(userId: string): Promise<PresenceData>

  // Workspace operations
  /** Get workspace info */
  getWorkspace?(): Promise<WorkspaceData>
}

export interface MessageData {
  id: string
  channel: string
  userId: string
  text: string
  timestamp: string
  threadId?: string
  replyCount?: number
  reactions?: Array<{ emoji: string; count: number; users: string[] }>
  edited?: boolean
  editedAt?: Date
}

export interface MessageListOptions extends PaginationOptions {
  since?: Date
  until?: Date
  inclusive?: boolean
}

export interface MessageSearchOptions extends PaginationOptions {
  channels?: string[]
  users?: string[]
  since?: Date
  until?: Date
}

export interface ChannelData {
  id: string
  name: string
  topic?: string
  description?: string
  isPrivate: boolean
  isArchived: boolean
  memberCount: number
  createdAt: Date
}

export interface ChannelListOptions extends PaginationOptions {
  types?: ('public' | 'private')[]
  excludeArchived?: boolean
}

export interface CreateChannelOptions {
  isPrivate?: boolean
  topic?: string
  description?: string
}

export interface MemberData {
  id: string
  username: string
  displayName: string
  email?: string
  avatar?: string
  title?: string
  isAdmin: boolean
  isBot: boolean
  timezone?: string
}

export interface MemberListOptions extends PaginationOptions {
  channel?: string
}

export interface PresenceData {
  userId: string
  presence: 'online' | 'away' | 'dnd' | 'offline'
  statusText?: string
  statusEmoji?: string
}

export interface WorkspaceData {
  id: string
  name: string
  domain?: string
  icon?: string
  memberCount?: number
}

// =============================================================================
// SMS Provider (Twilio, etc.)
// =============================================================================

/**
 * Send SMS options
 */
export interface SendSmsOptions {
  to: string
  from?: string
  body: string
  mediaUrls?: string[]
  statusCallback?: string
}

/**
 * SMS provider interface
 */
export interface SmsProvider extends BaseProvider {
  /** Send SMS */
  send(options: SendSmsOptions): Promise<SendSmsResult>

  /** Send MMS with media */
  sendMms?(options: SendSmsOptions & { mediaUrls: string[] }): Promise<SendSmsResult>

  /** Get message status */
  getStatus?(messageId: string): Promise<SmsStatus>

  /** List messages */
  list?(options?: SmsListOptions): Promise<PaginatedResult<SmsData>>
}

export interface SendSmsResult {
  success: boolean
  messageId?: string
  status?: string
  error?: {
    code: string
    message: string
  }
}

export interface SmsStatus {
  messageId: string
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered'
  errorCode?: string
  errorMessage?: string
}

export interface SmsData {
  id: string
  to: string
  from: string
  body: string
  status: string
  direction: 'inbound' | 'outbound'
  sentAt?: Date
  deliveredAt?: Date
}

export interface SmsListOptions extends PaginationOptions {
  to?: string
  from?: string
  since?: Date
  until?: Date
}

// =============================================================================
// Spreadsheet Provider (Google Sheets, xlsx, Excel Online)
// =============================================================================

/**
 * Spreadsheet provider interface
 */
export interface SpreadsheetProvider extends BaseProvider {
  /** Create spreadsheet */
  create(name: string, options?: CreateSpreadsheetOptions): Promise<SpreadsheetData>

  /** Get spreadsheet */
  get(spreadsheetId: string): Promise<SpreadsheetData | null>

  /** List spreadsheets */
  list?(options?: SpreadsheetListOptions): Promise<PaginatedResult<SpreadsheetData>>

  /** Delete spreadsheet */
  delete?(spreadsheetId: string): Promise<boolean>

  // Sheet operations
  /** Get sheet */
  getSheet(spreadsheetId: string, sheetId: string | number): Promise<SheetData | null>

  /** Add sheet */
  addSheet(spreadsheetId: string, name: string, options?: AddSheetOptions): Promise<SheetData>

  /** Delete sheet */
  deleteSheet(spreadsheetId: string, sheetId: string | number): Promise<boolean>

  /** Rename sheet */
  renameSheet?(spreadsheetId: string, sheetId: string | number, name: string): Promise<boolean>

  // Cell operations
  /** Read cell range */
  readRange(spreadsheetId: string, range: string): Promise<CellValue[][]>

  /** Write cell range */
  writeRange(spreadsheetId: string, range: string, values: CellValue[][]): Promise<UpdateResult>

  /** Append rows */
  appendRows(spreadsheetId: string, range: string, values: CellValue[][]): Promise<AppendResult>

  /** Clear range */
  clearRange(spreadsheetId: string, range: string): Promise<boolean>

  /** Batch read */
  batchRead?(spreadsheetId: string, ranges: string[]): Promise<Map<string, CellValue[][]>>

  /** Batch write */
  batchWrite?(spreadsheetId: string, data: Array<{ range: string; values: CellValue[][] }>): Promise<UpdateResult>

  // Import/Export
  /** Export to format */
  export?(spreadsheetId: string, format: 'xlsx' | 'csv' | 'pdf'): Promise<Buffer>

  /** Import from file */
  import?(file: Buffer, format: 'xlsx' | 'csv', options?: ImportOptions): Promise<SpreadsheetData>
}

export type CellValue = string | number | boolean | null | Date

export interface SpreadsheetData {
  id: string
  name: string
  sheets: SheetInfo[]
  createdAt?: Date
  modifiedAt?: Date
  url?: string
}

export interface SheetInfo {
  id: string | number
  name: string
  index: number
  rowCount?: number
  columnCount?: number
}

export interface SheetData extends SheetInfo {
  data?: CellValue[][]
  frozenRows?: number
  frozenColumns?: number
}

export interface CreateSpreadsheetOptions {
  sheets?: Array<{ name: string }>
  locale?: string
  timeZone?: string
}

export interface SpreadsheetListOptions extends PaginationOptions {
  query?: string
}

export interface AddSheetOptions {
  index?: number
  rowCount?: number
  columnCount?: number
}

export interface UpdateResult {
  updatedRange: string
  updatedRows: number
  updatedColumns: number
  updatedCells: number
}

export interface AppendResult {
  spreadsheetId: string
  updatedRange: string
  updatedRows: number
}

export interface ImportOptions {
  name?: string
  sheetName?: string
}

// =============================================================================
// Document Provider (Google Docs, docx, etc.)
// =============================================================================

/**
 * Document provider interface
 */
export interface DocumentProvider extends BaseProvider {
  /** Create document */
  create(title: string, options?: CreateDocumentOptions): Promise<DocumentData>

  /** Get document */
  get(documentId: string): Promise<DocumentData | null>

  /** List documents */
  list?(options?: DocumentListOptions): Promise<PaginatedResult<DocumentData>>

  /** Delete document */
  delete?(documentId: string): Promise<boolean>

  /** Get document content */
  getContent(documentId: string): Promise<DocumentContent>

  /** Update document content */
  updateContent(documentId: string, content: DocumentContent): Promise<boolean>

  /** Insert text */
  insertText?(documentId: string, text: string, index?: number): Promise<boolean>

  /** Delete content */
  deleteContent?(documentId: string, startIndex: number, endIndex: number): Promise<boolean>

  // Export/Import
  /** Export document */
  export?(documentId: string, format: 'docx' | 'pdf' | 'txt' | 'html' | 'md'): Promise<Buffer>

  /** Import document */
  import?(file: Buffer, format: 'docx' | 'txt' | 'html' | 'md', options?: ImportDocumentOptions): Promise<DocumentData>
}

export interface DocumentData {
  id: string
  title: string
  createdAt?: Date
  modifiedAt?: Date
  url?: string
  wordCount?: number
  characterCount?: number
}

export interface DocumentContent {
  /** Plain text content */
  text?: string
  /** HTML content */
  html?: string
  /** Markdown content */
  markdown?: string
  /** Structured content (for Google Docs) */
  body?: unknown
}

export interface CreateDocumentOptions {
  content?: string
  template?: string
}

export interface DocumentListOptions extends PaginationOptions {
  query?: string
}

export interface ImportDocumentOptions {
  title?: string
}

// =============================================================================
// Presentation Provider (Google Slides, pptx, etc.)
// =============================================================================

/**
 * Presentation provider interface
 */
export interface PresentationProvider extends BaseProvider {
  /** Create presentation */
  create(title: string, options?: CreatePresentationOptions): Promise<PresentationData>

  /** Get presentation */
  get(presentationId: string): Promise<PresentationData | null>

  /** List presentations */
  list?(options?: PresentationListOptions): Promise<PaginatedResult<PresentationData>>

  /** Delete presentation */
  delete?(presentationId: string): Promise<boolean>

  // Slide operations
  /** Get slide */
  getSlide(presentationId: string, slideId: string): Promise<SlideData | null>

  /** Add slide */
  addSlide(presentationId: string, options?: AddSlideOptions): Promise<SlideData>

  /** Delete slide */
  deleteSlide(presentationId: string, slideId: string): Promise<boolean>

  /** Reorder slides */
  reorderSlides?(presentationId: string, slideIds: string[]): Promise<boolean>

  /** Update slide content */
  updateSlide?(presentationId: string, slideId: string, updates: SlideUpdates): Promise<boolean>

  // Export/Import
  /** Export presentation */
  export?(presentationId: string, format: 'pptx' | 'pdf' | 'png'): Promise<Buffer>

  /** Import presentation */
  import?(file: Buffer, format: 'pptx', options?: ImportPresentationOptions): Promise<PresentationData>
}

export interface PresentationData {
  id: string
  title: string
  slideCount: number
  slides?: SlideInfo[]
  createdAt?: Date
  modifiedAt?: Date
  url?: string
}

export interface SlideInfo {
  id: string
  index: number
  layout?: string
}

export interface SlideData extends SlideInfo {
  title?: string
  notes?: string
  elements?: SlideElement[]
}

export interface SlideElement {
  id: string
  type: 'text' | 'image' | 'shape' | 'table' | 'chart'
  position: { x: number; y: number }
  size: { width: number; height: number }
  content?: unknown
}

export interface CreatePresentationOptions {
  template?: string
  aspectRatio?: '16:9' | '4:3'
}

export interface PresentationListOptions extends PaginationOptions {
  query?: string
}

export interface AddSlideOptions {
  layout?: string
  index?: number
}

export interface SlideUpdates {
  title?: string
  notes?: string
  elements?: Partial<SlideElement>[]
}

export interface ImportPresentationOptions {
  title?: string
}

// =============================================================================
// Phone Provider (Twilio, Vonage, etc.)
// =============================================================================

/**
 * Phone provider interface
 */
export interface PhoneProvider extends BaseProvider {
  /** Make outbound call */
  call(to: string, from: string, options?: CallOptions): Promise<CallResult>

  /** Get call status */
  getCall(callId: string): Promise<CallData | null>

  /** List calls */
  listCalls?(options?: CallListOptions): Promise<PaginatedResult<CallData>>

  /** Hangup call */
  hangup?(callId: string): Promise<boolean>

  /** Transfer call */
  transfer?(callId: string, to: string): Promise<boolean>

  /** Play audio */
  playAudio?(callId: string, audioUrl: string): Promise<boolean>

  /** Send DTMF tones */
  sendDtmf?(callId: string, digits: string): Promise<boolean>

  /** Start recording */
  startRecording?(callId: string): Promise<RecordingData>

  /** Stop recording */
  stopRecording?(callId: string, recordingId: string): Promise<boolean>

  /** Get recording */
  getRecording?(recordingId: string): Promise<RecordingData | null>

  /** Transcribe recording */
  transcribe?(recordingId: string): Promise<TranscriptionData>

  // Voicemail
  /** List voicemails */
  listVoicemails?(options?: VoicemailListOptions): Promise<PaginatedResult<VoicemailData>>

  /** Get voicemail */
  getVoicemail?(voicemailId: string): Promise<VoicemailData | null>

  /** Delete voicemail */
  deleteVoicemail?(voicemailId: string): Promise<boolean>
}

export interface CallOptions {
  /** TwiML or webhook URL for call handling */
  url?: string
  /** Status callback URL */
  statusCallback?: string
  /** Timeout in seconds */
  timeout?: number
  /** Record the call */
  record?: boolean
  /** Machine detection */
  machineDetection?: 'Enable' | 'DetectMessageEnd'
}

export interface CallResult {
  success: boolean
  callId?: string
  status?: string
  error?: {
    code: string
    message: string
  }
}

export interface CallData {
  id: string
  to: string
  from: string
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled'
  direction: 'inbound' | 'outbound'
  duration?: number
  startedAt?: Date
  answeredAt?: Date
  endedAt?: Date
  recordingUrl?: string
}

export interface CallListOptions extends PaginationOptions {
  status?: string
  to?: string
  from?: string
  since?: Date
  until?: Date
}

export interface RecordingData {
  id: string
  callId: string
  duration: number
  url: string
  status: 'processing' | 'completed' | 'failed'
  createdAt: Date
}

export interface TranscriptionData {
  id: string
  recordingId: string
  text: string
  confidence?: number
  status: 'processing' | 'completed' | 'failed'
}

export interface VoicemailData {
  id: string
  from: string
  to: string
  duration: number
  audioUrl: string
  transcription?: string
  read: boolean
  createdAt: Date
}

export interface VoicemailListOptions extends PaginationOptions {
  read?: boolean
  since?: Date
}

// =============================================================================
// Calendar Provider (Google Calendar, Outlook, Calendly)
// =============================================================================

export interface CalendarProvider extends BaseProvider {
  listCalendars?(options?: PaginationOptions): Promise<PaginatedResult<CalendarData>>
  getCalendar?(calendarId: string): Promise<CalendarData | null>
  createEvent(calendarId: string, event: CreateEventOptions): Promise<EventData>
  getEvent(calendarId: string, eventId: string): Promise<EventData | null>
  updateEvent(calendarId: string, eventId: string, updates: Partial<CreateEventOptions>): Promise<EventData>
  deleteEvent(calendarId: string, eventId: string): Promise<boolean>
  listEvents(calendarId: string, options?: EventListOptions): Promise<PaginatedResult<EventData>>
  findAvailability?(calendarIds: string[], timeMin: Date, timeMax: Date): Promise<AvailabilityData[]>
}

export interface CalendarData {
  id: string
  name: string
  description?: string
  timeZone: string
  primary: boolean
  accessRole: 'owner' | 'writer' | 'reader'
}

export interface CreateEventOptions {
  summary: string
  description?: string
  location?: string
  start: Date
  end: Date
  attendees?: string[]
  reminders?: Array<{ method: 'email' | 'popup'; minutes: number }>
  recurrence?: string[]
  conferenceData?: { type: 'hangoutsMeet' | 'zoom' | 'teams' }
}

export interface EventData {
  id: string
  calendarId: string
  summary: string
  description?: string
  location?: string
  start: Date
  end: Date
  attendees?: Array<{ email: string; responseStatus: string }>
  status: 'confirmed' | 'tentative' | 'cancelled'
  recurringEventId?: string
  htmlLink?: string
}

export interface EventListOptions extends PaginationOptions {
  timeMin?: Date
  timeMax?: Date
  singleEvents?: boolean
  orderBy?: 'startTime' | 'updated'
}

export interface AvailabilityData {
  calendarId: string
  busy: Array<{ start: Date; end: Date }>
}

// =============================================================================
// Task Provider (Todoist, Asana, Things)
// =============================================================================

export interface TaskProvider extends BaseProvider {
  listProjects?(): Promise<ProjectData[]>
  createTask(task: CreateTaskOptions): Promise<TaskData>
  getTask(taskId: string): Promise<TaskData | null>
  updateTask(taskId: string, updates: Partial<CreateTaskOptions>): Promise<TaskData>
  deleteTask(taskId: string): Promise<boolean>
  completeTask(taskId: string): Promise<boolean>
  reopenTask?(taskId: string): Promise<boolean>
  listTasks(options?: TaskListOptions): Promise<PaginatedResult<TaskData>>
  addComment?(taskId: string, content: string): Promise<CommentData>
}

export interface ProjectData {
  id: string
  name: string
  color?: string
  parentId?: string
}

export interface CreateTaskOptions {
  content: string
  description?: string
  projectId?: string
  parentId?: string
  priority?: 1 | 2 | 3 | 4
  dueDate?: Date
  dueString?: string
  labels?: string[]
  assigneeId?: string
}

export interface TaskData {
  id: string
  content: string
  description?: string
  projectId?: string
  parentId?: string
  priority: number
  dueDate?: Date
  completed: boolean
  labels: string[]
  createdAt: Date
  completedAt?: Date
}

export interface TaskListOptions extends PaginationOptions {
  projectId?: string
  filter?: string
  completed?: boolean
}

export interface CommentData {
  id: string
  taskId: string
  content: string
  authorId: string
  createdAt: Date
}

// =============================================================================
// Project Management Provider (Jira, Linear, Asana, Monday)
// =============================================================================

export interface ProjectManagementProvider extends BaseProvider {
  listProjects(options?: PaginationOptions): Promise<PaginatedResult<PMProjectData>>
  getProject(projectId: string): Promise<PMProjectData | null>
  createIssue(projectId: string, issue: CreateIssueOptions): Promise<IssueData>
  getIssue(issueId: string): Promise<IssueData | null>
  updateIssue(issueId: string, updates: Partial<CreateIssueOptions>): Promise<IssueData>
  deleteIssue?(issueId: string): Promise<boolean>
  listIssues(projectId: string, options?: IssueListOptions): Promise<PaginatedResult<IssueData>>
  searchIssues?(query: string, options?: IssueListOptions): Promise<PaginatedResult<IssueData>>
  addComment(issueId: string, body: string): Promise<IssueCommentData>
  transition?(issueId: string, statusId: string): Promise<boolean>
  assign?(issueId: string, userId: string): Promise<boolean>
}

export interface PMProjectData {
  id: string
  key: string
  name: string
  description?: string
  lead?: string
  url?: string
}

export interface CreateIssueOptions {
  title: string
  description?: string
  type: string
  priority?: string
  labels?: string[]
  assigneeId?: string
  sprintId?: string
  parentId?: string
  estimate?: number
}

export interface IssueData {
  id: string
  key: string
  title: string
  description?: string
  type: string
  status: string
  priority?: string
  labels: string[]
  assigneeId?: string
  reporterId?: string
  createdAt: Date
  updatedAt: Date
  url?: string
}

export interface IssueListOptions extends PaginationOptions {
  status?: string[]
  type?: string[]
  assignee?: string
  labels?: string[]
  sprintId?: string
}

export interface IssueCommentData {
  id: string
  issueId: string
  body: string
  authorId: string
  createdAt: Date
}

// =============================================================================
// CRM Provider (Salesforce, HubSpot, Pipedrive)
// =============================================================================

export interface CRMProvider extends BaseProvider {
  // Contacts
  createContact(contact: CreateContactOptions): Promise<CRMContactData>
  getContact(contactId: string): Promise<CRMContactData | null>
  updateContact(contactId: string, updates: Partial<CreateContactOptions>): Promise<CRMContactData>
  listContacts(options?: ContactListOptions): Promise<PaginatedResult<CRMContactData>>
  searchContacts?(query: string): Promise<CRMContactData[]>
  // Deals
  createDeal(deal: CreateDealOptions): Promise<DealData>
  getDeal(dealId: string): Promise<DealData | null>
  updateDeal(dealId: string, updates: Partial<CreateDealOptions>): Promise<DealData>
  listDeals(options?: DealListOptions): Promise<PaginatedResult<DealData>>
  // Activities
  logActivity?(contactId: string, activity: CreateActivityOptions): Promise<CRMActivityData>
  listActivities?(contactId: string): Promise<CRMActivityData[]>
}

export interface CreateContactOptions {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  company?: string
  title?: string
  customFields?: Record<string, unknown>
}

export interface CRMContactData {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  company?: string
  title?: string
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface ContactListOptions extends PaginationOptions {
  ownerId?: string
  company?: string
}

export interface CreateDealOptions {
  name: string
  value?: number
  currency?: string
  stage: string
  contactId?: string
  companyId?: string
  closeDate?: Date
  probability?: number
}

export interface DealData {
  id: string
  name: string
  value?: number
  currency?: string
  stage: string
  probability?: number
  contactId?: string
  companyId?: string
  ownerId?: string
  closeDate?: Date
  createdAt: Date
  updatedAt: Date
  wonAt?: Date
  lostAt?: Date
}

export interface DealListOptions extends PaginationOptions {
  stage?: string
  ownerId?: string
  minValue?: number
  maxValue?: number
}

export interface CreateActivityOptions {
  type: 'call' | 'email' | 'meeting' | 'task' | 'note'
  subject: string
  body?: string
  dueDate?: Date
  duration?: number
}

export interface CRMActivityData {
  id: string
  type: string
  subject: string
  body?: string
  contactId: string
  ownerId: string
  dueDate?: Date
  completedAt?: Date
  createdAt: Date
}

// =============================================================================
// Development Provider (GitHub, GitLab, Bitbucket)
// =============================================================================

export interface DevelopmentProvider extends BaseProvider {
  // Repositories
  listRepos(options?: RepoListOptions): Promise<PaginatedResult<RepoData>>
  getRepo(owner: string, repo: string): Promise<RepoData | null>
  // Issues
  createIssue(owner: string, repo: string, issue: CreateDevIssueOptions): Promise<DevIssueData>
  getIssue(owner: string, repo: string, issueNumber: number): Promise<DevIssueData | null>
  updateIssue(owner: string, repo: string, issueNumber: number, updates: Partial<CreateDevIssueOptions>): Promise<DevIssueData>
  listIssues(owner: string, repo: string, options?: DevIssueListOptions): Promise<PaginatedResult<DevIssueData>>
  // Pull Requests
  createPullRequest(owner: string, repo: string, pr: CreatePROptions): Promise<PRData>
  getPullRequest(owner: string, repo: string, prNumber: number): Promise<PRData | null>
  listPullRequests(owner: string, repo: string, options?: PRListOptions): Promise<PaginatedResult<PRData>>
  mergePullRequest?(owner: string, repo: string, prNumber: number): Promise<boolean>
  // Comments
  addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<DevCommentData>
}

export interface RepoListOptions extends PaginationOptions {
  visibility?: 'public' | 'private' | 'all'
  sort?: 'created' | 'updated' | 'pushed'
}

export interface RepoData {
  id: string
  owner: string
  name: string
  fullName: string
  description?: string
  private: boolean
  defaultBranch: string
  url: string
  cloneUrl: string
  stars: number
  forks: number
  openIssues: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateDevIssueOptions {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
  milestone?: number
}

export interface DevIssueData {
  id: string
  number: number
  title: string
  body?: string
  state: 'open' | 'closed'
  labels: string[]
  assignees: string[]
  authorId: string
  url: string
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
}

export interface DevIssueListOptions extends PaginationOptions {
  state?: 'open' | 'closed' | 'all'
  labels?: string[]
  assignee?: string
  sort?: 'created' | 'updated' | 'comments'
}

export interface CreatePROptions {
  title: string
  body?: string
  head: string
  base: string
  draft?: boolean
}

export interface PRData {
  id: string
  number: number
  title: string
  body?: string
  state: 'open' | 'closed' | 'merged'
  head: string
  base: string
  authorId: string
  draft: boolean
  mergeable?: boolean
  url: string
  createdAt: Date
  updatedAt: Date
  mergedAt?: Date
  closedAt?: Date
}

export interface PRListOptions extends PaginationOptions {
  state?: 'open' | 'closed' | 'all'
  sort?: 'created' | 'updated' | 'popularity'
  direction?: 'asc' | 'desc'
}

export interface DevCommentData {
  id: string
  body: string
  authorId: string
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// Finance Provider (Stripe, QuickBooks, Xero)
// =============================================================================

export interface FinanceProvider extends BaseProvider {
  // Invoices
  createInvoice(invoice: CreateInvoiceOptions): Promise<InvoiceData>
  getInvoice(invoiceId: string): Promise<InvoiceData | null>
  updateInvoice?(invoiceId: string, updates: Partial<CreateInvoiceOptions>): Promise<InvoiceData>
  listInvoices(options?: InvoiceListOptions): Promise<PaginatedResult<InvoiceData>>
  sendInvoice?(invoiceId: string): Promise<boolean>
  voidInvoice?(invoiceId: string): Promise<boolean>
  // Payments
  createPayment(payment: CreatePaymentOptions): Promise<PaymentData>
  getPayment(paymentId: string): Promise<PaymentData | null>
  listPayments(options?: PaymentListOptions): Promise<PaginatedResult<PaymentData>>
  refundPayment?(paymentId: string, amount?: number): Promise<RefundData>
  // Customers
  createCustomer?(customer: CreateFinanceCustomerOptions): Promise<FinanceCustomerData>
  getCustomer?(customerId: string): Promise<FinanceCustomerData | null>
  listCustomers?(options?: PaginationOptions): Promise<PaginatedResult<FinanceCustomerData>>
}

export interface CreateInvoiceOptions {
  customerId: string
  lineItems: Array<{ description: string; quantity: number; unitPrice: number }>
  currency?: string
  dueDate?: Date
  memo?: string
}

export interface InvoiceData {
  id: string
  number: string
  customerId: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  currency: string
  subtotal: number
  tax?: number
  total: number
  amountDue: number
  amountPaid: number
  dueDate?: Date
  paidAt?: Date
  url?: string
  createdAt: Date
}

export interface InvoiceListOptions extends PaginationOptions {
  customerId?: string
  status?: string
  since?: Date
  until?: Date
}

export interface CreatePaymentOptions {
  amount: number
  currency: string
  customerId?: string
  invoiceId?: string
  paymentMethod: string
  description?: string
}

export interface PaymentData {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  customerId?: string
  invoiceId?: string
  paymentMethod: string
  description?: string
  createdAt: Date
  refundedAt?: Date
}

export interface PaymentListOptions extends PaginationOptions {
  customerId?: string
  status?: string
  since?: Date
  until?: Date
}

export interface RefundData {
  id: string
  paymentId: string
  amount: number
  status: string
  createdAt: Date
}

export interface CreateFinanceCustomerOptions {
  name: string
  email?: string
  phone?: string
  address?: {
    line1: string
    line2?: string
    city: string
    state?: string
    postalCode: string
    country: string
  }
}

export interface FinanceCustomerData {
  id: string
  name: string
  email?: string
  phone?: string
  balance?: number
  createdAt: Date
}

// =============================================================================
// Support Provider (Zendesk, Intercom, Freshdesk)
// =============================================================================

export interface SupportProvider extends BaseProvider {
  // Tickets
  createTicket(ticket: CreateTicketOptions): Promise<TicketData>
  getTicket(ticketId: string): Promise<TicketData | null>
  updateTicket(ticketId: string, updates: Partial<CreateTicketOptions>): Promise<TicketData>
  listTickets(options?: TicketListOptions): Promise<PaginatedResult<TicketData>>
  closeTicket?(ticketId: string): Promise<boolean>
  // Comments
  addTicketComment(ticketId: string, body: string, isPublic?: boolean): Promise<TicketCommentData>
  listTicketComments(ticketId: string): Promise<TicketCommentData[]>
  // Users
  getUser?(userId: string): Promise<SupportUserData | null>
  searchUsers?(query: string): Promise<SupportUserData[]>
}

export interface CreateTicketOptions {
  subject: string
  description: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  type?: 'question' | 'incident' | 'problem' | 'task'
  requesterId?: string
  assigneeId?: string
  tags?: string[]
  customFields?: Record<string, unknown>
}

export interface TicketData {
  id: string
  subject: string
  description: string
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed'
  priority: string
  type?: string
  requesterId?: string
  assigneeId?: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  solvedAt?: Date
}

export interface TicketListOptions extends PaginationOptions {
  status?: string
  priority?: string
  assigneeId?: string
  requesterId?: string
}

export interface TicketCommentData {
  id: string
  ticketId: string
  body: string
  authorId: string
  isPublic: boolean
  createdAt: Date
}

export interface SupportUserData {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date
}

// =============================================================================
// Media Provider (Cloudinary, ImageKit, Mux)
// =============================================================================

export interface MediaProvider extends BaseProvider {
  upload(file: Buffer | string, options?: UploadOptions): Promise<MediaAssetData>
  get(assetId: string): Promise<MediaAssetData | null>
  delete(assetId: string): Promise<boolean>
  list(options?: MediaListOptions): Promise<PaginatedResult<MediaAssetData>>
  transform?(assetId: string, transformations: TransformOptions): Promise<string>
  getUrl(assetId: string, options?: UrlOptions): Promise<string>
}

export interface UploadOptions {
  folder?: string
  publicId?: string
  resourceType?: 'image' | 'video' | 'raw' | 'auto'
  tags?: string[]
  metadata?: Record<string, string>
}

export interface MediaAssetData {
  id: string
  publicId: string
  url: string
  secureUrl: string
  resourceType: 'image' | 'video' | 'raw'
  format: string
  bytes: number
  width?: number
  height?: number
  duration?: number
  createdAt: Date
}

export interface MediaListOptions extends PaginationOptions {
  resourceType?: string
  folder?: string
  tags?: string[]
}

export interface TransformOptions {
  width?: number
  height?: number
  crop?: string
  quality?: number | 'auto'
  format?: string
}

export interface UrlOptions {
  transformation?: TransformOptions
  signed?: boolean
  expiration?: Date
}

// =============================================================================
// Marketing Provider (Mailchimp, HubSpot Marketing, Klaviyo)
// =============================================================================

export interface MarketingProvider extends BaseProvider {
  // Audiences/Lists
  listAudiences(): Promise<AudienceData[]>
  getAudience(audienceId: string): Promise<AudienceData | null>
  // Subscribers
  addSubscriber(audienceId: string, subscriber: AddSubscriberOptions): Promise<SubscriberData>
  updateSubscriber(audienceId: string, email: string, updates: Partial<AddSubscriberOptions>): Promise<SubscriberData>
  removeSubscriber?(audienceId: string, email: string): Promise<boolean>
  listSubscribers(audienceId: string, options?: SubscriberListOptions): Promise<PaginatedResult<SubscriberData>>
  // Campaigns
  createCampaign(campaign: CreateCampaignOptions): Promise<CampaignData>
  getCampaign(campaignId: string): Promise<CampaignData | null>
  updateCampaign?(campaignId: string, updates: Partial<CreateCampaignOptions>): Promise<CampaignData>
  listCampaigns(options?: CampaignListOptions): Promise<PaginatedResult<CampaignData>>
  sendCampaign?(campaignId: string): Promise<boolean>
  scheduleCampaign?(campaignId: string, sendAt: Date): Promise<boolean>
  getCampaignReport?(campaignId: string): Promise<CampaignReportData>
}

export interface AudienceData {
  id: string
  name: string
  memberCount: number
  createdAt: Date
}

export interface AddSubscriberOptions {
  email: string
  firstName?: string
  lastName?: string
  tags?: string[]
  mergeFields?: Record<string, unknown>
  status?: 'subscribed' | 'pending' | 'unsubscribed'
}

export interface SubscriberData {
  id: string
  email: string
  firstName?: string
  lastName?: string
  status: string
  tags: string[]
  subscribedAt?: Date
  unsubscribedAt?: Date
}

export interface SubscriberListOptions extends PaginationOptions {
  status?: string
  sinceSubscribed?: Date
}

export interface CreateCampaignOptions {
  name: string
  audienceId: string
  subject: string
  fromName: string
  fromEmail: string
  content?: { html?: string; text?: string }
  templateId?: string
}

export interface CampaignData {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
  audienceId: string
  subject: string
  fromName: string
  fromEmail: string
  sentAt?: Date
  scheduledAt?: Date
  createdAt: Date
}

export interface CampaignListOptions extends PaginationOptions {
  status?: string
  since?: Date
}

export interface CampaignReportData {
  campaignId: string
  sent: number
  delivered: number
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  bounces: number
  unsubscribes: number
  openRate: number
  clickRate: number
}

// =============================================================================
// Knowledge Provider (Notion, Confluence, GitBook)
// =============================================================================

export interface KnowledgeProvider extends BaseProvider {
  // Pages
  createPage(page: CreatePageOptions): Promise<PageData>
  getPage(pageId: string): Promise<PageData | null>
  updatePage(pageId: string, updates: Partial<CreatePageOptions>): Promise<PageData>
  deletePage?(pageId: string): Promise<boolean>
  listPages(options?: PageListOptions): Promise<PaginatedResult<PageData>>
  searchPages(query: string, options?: PaginationOptions): Promise<PaginatedResult<PageData>>
  // Databases/Spaces
  listSpaces?(): Promise<SpaceData[]>
  getSpace?(spaceId: string): Promise<SpaceData | null>
}

export interface CreatePageOptions {
  title: string
  content?: string
  parentId?: string
  spaceId?: string
  icon?: string
  cover?: string
}

export interface PageData {
  id: string
  title: string
  content?: string
  parentId?: string
  spaceId?: string
  url: string
  icon?: string
  cover?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  updatedBy?: string
}

export interface PageListOptions extends PaginationOptions {
  parentId?: string
  spaceId?: string
}

export interface SpaceData {
  id: string
  name: string
  description?: string
  icon?: string
  url?: string
}

// =============================================================================
// E-commerce Provider (Shopify, WooCommerce, Stripe Commerce)
// =============================================================================

export interface EcommerceProvider extends BaseProvider {
  // Products
  createProduct(product: CreateProductOptions): Promise<EcommerceProductData>
  getProduct(productId: string): Promise<EcommerceProductData | null>
  updateProduct(productId: string, updates: Partial<CreateProductOptions>): Promise<EcommerceProductData>
  deleteProduct?(productId: string): Promise<boolean>
  listProducts(options?: ProductListOptions): Promise<PaginatedResult<EcommerceProductData>>
  // Orders
  getOrder(orderId: string): Promise<OrderData | null>
  listOrders(options?: OrderListOptions): Promise<PaginatedResult<OrderData>>
  updateOrderStatus?(orderId: string, status: string): Promise<OrderData>
  // Customers
  getEcommerceCustomer?(customerId: string): Promise<EcommerceCustomerData | null>
  listEcommerceCustomers?(options?: PaginationOptions): Promise<PaginatedResult<EcommerceCustomerData>>
  // Inventory
  updateInventory?(productId: string, variantId: string, quantity: number): Promise<boolean>
}

export interface CreateProductOptions {
  title: string
  description?: string
  price: number
  compareAtPrice?: number
  sku?: string
  inventory?: number
  images?: string[]
  variants?: Array<{ title: string; price: number; sku?: string; inventory?: number }>
  tags?: string[]
  status?: 'active' | 'draft' | 'archived'
}

export interface EcommerceProductData {
  id: string
  title: string
  description?: string
  price: number
  compareAtPrice?: number
  sku?: string
  inventory?: number
  images: string[]
  variants?: Array<{ id: string; title: string; price: number; sku?: string; inventory?: number }>
  tags: string[]
  status: string
  url?: string
  createdAt: Date
  updatedAt: Date
}

export interface ProductListOptions extends PaginationOptions {
  status?: string
  collection?: string
  vendor?: string
}

export interface OrderData {
  id: string
  orderNumber: string
  status: string
  financialStatus: string
  fulfillmentStatus: string
  customerId?: string
  email: string
  lineItems: Array<{ productId: string; variantId?: string; title: string; quantity: number; price: number }>
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  shippingAddress?: AddressData
  billingAddress?: AddressData
  createdAt: Date
  updatedAt: Date
}

export interface OrderListOptions extends PaginationOptions {
  status?: string
  financialStatus?: string
  fulfillmentStatus?: string
  customerId?: string
  since?: Date
  until?: Date
}

export interface AddressData {
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  province?: string
  postalCode: string
  country: string
  phone?: string
}

export interface EcommerceCustomerData {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  ordersCount: number
  totalSpent: number
  createdAt: Date
}

// =============================================================================
// Analytics Provider (Google Analytics, Mixpanel, Amplitude)
// =============================================================================

export interface AnalyticsProvider extends BaseProvider {
  track(event: TrackEventOptions): Promise<boolean>
  identify?(userId: string, traits?: Record<string, unknown>): Promise<boolean>
  page?(name: string, properties?: Record<string, unknown>): Promise<boolean>
  alias?(userId: string, previousId: string): Promise<boolean>
  getReport?(reportId: string): Promise<AnalyticsReportData | null>
  runQuery?(query: AnalyticsQueryOptions): Promise<AnalyticsQueryResult>
}

export interface TrackEventOptions {
  event: string
  userId?: string
  anonymousId?: string
  properties?: Record<string, unknown>
  timestamp?: Date
}

export interface AnalyticsQueryOptions {
  metrics: string[]
  dimensions?: string[]
  dateRange: { start: Date; end: Date }
  filters?: Array<{ dimension: string; operator: string; value: string }>
  orderBy?: Array<{ field: string; order: 'asc' | 'desc' }>
  limit?: number
}

export interface AnalyticsQueryResult {
  rows: Array<Record<string, unknown>>
  totals?: Record<string, number>
  rowCount: number
}

export interface AnalyticsReportData {
  id: string
  name: string
  description?: string
  query: AnalyticsQueryOptions
  result?: AnalyticsQueryResult
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// Storage Provider (AWS S3, Google Cloud Storage, Dropbox)
// =============================================================================

export interface StorageProvider extends BaseProvider {
  upload(path: string, content: Buffer | string, options?: StorageUploadOptions): Promise<StorageFileData>
  download(path: string): Promise<Buffer>
  delete(path: string): Promise<boolean>
  list(prefix?: string, options?: StorageListOptions): Promise<PaginatedResult<StorageFileData>>
  getMetadata(path: string): Promise<StorageFileData | null>
  copy?(source: string, destination: string): Promise<StorageFileData>
  move?(source: string, destination: string): Promise<StorageFileData>
  getSignedUrl?(path: string, expiresIn?: number): Promise<string>
  createFolder?(path: string): Promise<boolean>
}

export interface StorageUploadOptions {
  contentType?: string
  metadata?: Record<string, string>
  acl?: 'private' | 'public-read'
}

export interface StorageFileData {
  path: string
  name: string
  size: number
  contentType?: string
  etag?: string
  lastModified: Date
  isFolder: boolean
  url?: string
}

export interface StorageListOptions extends PaginationOptions {
  delimiter?: string
  recursive?: boolean
}

// =============================================================================
// Video Conferencing Provider (Zoom, Google Meet, Microsoft Teams)
// =============================================================================

export interface VideoConferencingProvider extends BaseProvider {
  createMeeting(meeting: CreateMeetingOptions): Promise<MeetingData>
  getMeeting(meetingId: string): Promise<MeetingData | null>
  updateMeeting?(meetingId: string, updates: Partial<CreateMeetingOptions>): Promise<MeetingData>
  deleteMeeting?(meetingId: string): Promise<boolean>
  listMeetings(options?: MeetingListOptions): Promise<PaginatedResult<MeetingData>>
  endMeeting?(meetingId: string): Promise<boolean>
  getParticipants?(meetingId: string): Promise<ParticipantData[]>
  getRecordings?(meetingId: string): Promise<MeetingRecordingData[]>
}

export interface CreateMeetingOptions {
  topic: string
  startTime?: Date
  duration?: number
  timezone?: string
  agenda?: string
  password?: string
  settings?: {
    hostVideo?: boolean
    participantVideo?: boolean
    joinBeforeHost?: boolean
    muteUponEntry?: boolean
    waitingRoom?: boolean
    autoRecording?: 'none' | 'local' | 'cloud'
  }
}

export interface MeetingData {
  id: string
  topic: string
  startTime?: Date
  duration?: number
  timezone?: string
  agenda?: string
  joinUrl: string
  hostId: string
  status: 'waiting' | 'started' | 'finished'
  password?: string
  createdAt: Date
}

export interface MeetingListOptions extends PaginationOptions {
  type?: 'scheduled' | 'live' | 'upcoming' | 'previous'
}

export interface ParticipantData {
  id: string
  name: string
  email?: string
  joinTime: Date
  leaveTime?: Date
  duration?: number
}

export interface MeetingRecordingData {
  id: string
  meetingId: string
  type: 'video' | 'audio' | 'transcript'
  url: string
  size?: number
  duration?: number
  createdAt: Date
}

// =============================================================================
// Forms Provider (Typeform, Google Forms, JotForm)
// =============================================================================

export interface FormsProvider extends BaseProvider {
  createForm(form: CreateFormOptions): Promise<FormData>
  getForm(formId: string): Promise<FormData | null>
  updateForm?(formId: string, updates: Partial<CreateFormOptions>): Promise<FormData>
  deleteForm?(formId: string): Promise<boolean>
  listForms(options?: PaginationOptions): Promise<PaginatedResult<FormData>>
  getResponses(formId: string, options?: ResponseListOptions): Promise<PaginatedResult<FormResponseData>>
  getResponse?(formId: string, responseId: string): Promise<FormResponseData | null>
}

export interface CreateFormOptions {
  title: string
  description?: string
  fields: FormFieldOption[]
  settings?: {
    isPublic?: boolean
    submitOnce?: boolean
    showProgressBar?: boolean
    confirmationMessage?: string
    redirectUrl?: string
  }
}

export interface FormFieldOption {
  type: 'text' | 'email' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'radio' | 'textarea' | 'file'
  title: string
  description?: string
  required?: boolean
  choices?: string[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

export interface FormData {
  id: string
  title: string
  description?: string
  fields: FormFieldOption[]
  responseCount: number
  url: string
  createdAt: Date
  updatedAt: Date
}

export interface ResponseListOptions extends PaginationOptions {
  since?: Date
  until?: Date
  completed?: boolean
}

export interface FormResponseData {
  id: string
  formId: string
  answers: Array<{ fieldId: string; value: unknown }>
  submittedAt: Date
  metadata?: {
    ip?: string
    userAgent?: string
    referer?: string
  }
}

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Provider factory function
 */
export type ProviderFactory<T extends BaseProvider> = (config: ProviderConfig) => Promise<T>

/**
 * Registered provider entry
 */
export interface RegisteredProvider<T extends BaseProvider = BaseProvider> {
  info: ProviderInfo
  factory: ProviderFactory<T>
}

/**
 * Provider registry for discovering and instantiating providers
 */
export interface ProviderRegistry {
  /** Register a provider */
  register<T extends BaseProvider>(info: ProviderInfo, factory: ProviderFactory<T>): void

  /** Get provider by ID */
  get<T extends BaseProvider>(providerId: string): RegisteredProvider<T> | undefined

  /** List providers by category */
  list(category?: ProviderCategory): RegisteredProvider[]

  /** Create provider instance */
  create<T extends BaseProvider>(providerId: string, config: ProviderConfig): Promise<T>

  /** Check if provider exists */
  has(providerId: string): boolean
}
