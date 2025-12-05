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
