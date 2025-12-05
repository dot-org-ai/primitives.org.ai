/**
 * Digital Tool Entity Types (Nouns)
 *
 * Comprehensive entity definitions for all digital tools that can be used
 * by both remote human workers AND AI agents.
 *
 * Categories use single-word identifiers for use as JS/TS var/component/function names.
 *
 * @packageDocumentation
 */

// =============================================================================
// Message (unified: email, text, chat, direct, voicemail)
// =============================================================================

export {
  // Core entities (single-word nouns)
  Message,
  Thread,
  Call,
  Channel,
  Workspace,
  Member,
  Contact,
  Attachment,
  Reaction,

  // Collections
  CommunicationEntities as MessageEntities,
  CommunicationCategories as MessageCategories,
} from './communication.js'

// =============================================================================
// Productivity (Calendar, Tasks, Notes)
// =============================================================================

export {
  Calendar,
  Event,
  Task,
  Checklist,
  Note,
  Notebook,
  Reminder,
  Bookmark,
  ProductivityEntities,
  ProductivityCategories,
} from './productivity.js'

// =============================================================================
// Project (Projects, Issues, Sprints, Repositories)
// =============================================================================

export {
  Project,
  Issue,
  Sprint,
  Milestone,
  Board,
  Column,
  Label,
  Epic,
  ProjectManagementEntities as ProjectEntities,
  ProjectManagementCategories as ProjectCategories,
} from './project-management.js'

// =============================================================================
// Code (Repositories, PRs, Commits)
// =============================================================================

export {
  Repository,
  Branch,
  Commit,
  PullRequest,
  CodeReview,
  CodeIssue,
  Release,
  Workflow,
  WorkflowRun,
  DevelopmentEntities as CodeEntities,
  DevelopmentCategories as CodeCategories,
} from './development.js'

// =============================================================================
// Sales (Leads, Deals, Accounts)
// =============================================================================

export {
  Lead,
  Deal,
  Account,
  Pipeline,
  Stage,
  Activity,
  Quote,
  QuoteLineItem,
  Product as CRMProduct,
  CRMEntities as SalesEntities,
  CRMCategories as SalesCategories,
} from './crm.js'

// =============================================================================
// Finance (Stripe-based: Payments, Billing, Connect, Treasury, Issuing)
// =============================================================================

export {
  // Core
  Customer as FinanceCustomer,
  Product as FinanceProduct,
  Price,

  // Payments
  PaymentMethod,
  PaymentIntent,
  Charge,
  Refund,

  // Billing
  Invoice,
  InvoiceLineItem,
  Subscription,
  SubscriptionItem,
  Quote as FinanceQuote,

  // Balance
  Balance,
  BalanceTransaction,

  // Connect
  Account as ConnectAccount,
  AccountLink,
  Transfer,
  Payout,
  ApplicationFee,

  // Treasury
  FinancialAccount,
  TreasuryTransaction,
  InboundTransfer,
  OutboundTransfer,
  OutboundPayment,
  ReceivedCredit,
  ReceivedDebit,

  // Issuing
  IssuingCard,
  IssuingCardholder,
  IssuingAuthorization,
  IssuingTransaction,
  IssuingDispute,

  // Bank
  BankAccount,

  // Webhooks
  WebhookEndpoint,
  Event as FinanceEvent,

  // Collections
  FinanceEntities,
  FinanceCategories,
} from './finance.js'

// =============================================================================
// Support (Tickets, Conversations, Help)
// =============================================================================

export {
  SupportTicket,
  TicketComment,
  Conversation,
  ConversationMessage,
  HelpArticle,
  HelpCategory,
  FAQ,
  SatisfactionRating,
  SupportEntities,
  SupportCategories,
} from './support.js'

// =============================================================================
// Media (Images, Videos, Audio)
// =============================================================================

export {
  Image,
  Video,
  Audio,
  Screenshot,
  Album,
  MediaLibrary,
  Transcript,
  Caption,
  MediaEntities,
  MediaCategories,
} from './media.js'

// =============================================================================
// Marketing (Campaigns, Audiences, Templates)
// =============================================================================

export {
  Campaign,
  Audience,
  EmailTemplate,
  LandingPage,
  FormSubmission,
  SocialPost,
  AdCreative,
  UTMLink,
  MarketingEntities,
  MarketingCategories,
} from './marketing.js'

// =============================================================================
// Knowledge (Wiki, Articles, Glossary)
// =============================================================================

export {
  WikiPage,
  WikiSpace,
  WikiRevision,
  Article,
  KnowledgeBase,
  Glossary,
  GlossaryTerm,
  SearchIndex,
  Tag,
  Category,
  KnowledgeEntities,
  KnowledgeCategories,
} from './knowledge.js'

// =============================================================================
// Commerce (Products, Orders, Carts)
// =============================================================================

export {
  Product,
  ProductVariant,
  Order,
  OrderItem,
  Cart,
  Customer,
  Inventory,
  Discount,
  Review,
  EcommerceEntities as CommerceEntities,
  EcommerceCategories as CommerceCategories,
} from './ecommerce.js'

// =============================================================================
// Analytics (Reports, Dashboards, Metrics)
// =============================================================================

export {
  Report,
  Dashboard,
  Widget,
  Metric,
  Goal,
  DataSource,
  Query,
  Alert,
  AnalyticsEntities,
  AnalyticsCategories,
} from './analytics.js'

// =============================================================================
// Storage (Files, Folders, Drives)
// =============================================================================

export {
  File,
  Folder,
  Drive,
  SharedLink,
  FileVersion,
  StorageQuota,
  Sync,
  Backup,
  StorageEntities,
  StorageCategories,
} from './storage.js'

// =============================================================================
// Meeting (Video Conferencing, Webinars)
// =============================================================================

export {
  Meeting,
  MeetingParticipant,
  MeetingRecording,
  Webinar,
  WebinarRegistrant,
  MeetingRoom,
  BreakoutRoom,
  MeetingPoll,
  MeetingChat,
  VideoConferencingEntities as MeetingEntities,
  VideoConferencingCategories as MeetingCategories,
} from './video-conferencing.js'

// =============================================================================
// Form (Forms, Surveys, Quizzes)
// =============================================================================

export {
  Form,
  FormField,
  FormResponse,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  Quiz,
  QuizQuestion,
  QuizResult,
  FormsEntities as FormEntities,
  FormsCategories as FormCategories,
} from './forms.js'

// =============================================================================
// Signature (E-signatures, DocuSign, DocuSeal)
// =============================================================================

export {
  SignatureDocument,
  SignatureRequest,
  Signer,
  SignatureField,
  Signature,
  SignatureTemplate,
  AuditTrail,
  SignatureEntities,
  SignatureCategories,
} from './signature.js'

// =============================================================================
// Document (Word Processing: Google Docs, Word, Markdown)
// =============================================================================

export {
  Document,
  DocumentVersion,
  DocumentComment,
  DocumentCollaborator,
  DocumentEntities,
  DocumentCategories,
} from './document.js'

// =============================================================================
// Spreadsheet (Google Sheets, Excel, CSV)
// =============================================================================

export {
  Spreadsheet,
  Sheet,
  Cell,
  Range,
  Chart,
  PivotTable,
  SpreadsheetEntities,
  SpreadsheetCategories,
} from './spreadsheet.js'

// =============================================================================
// Presentation (Google Slides, PowerPoint, Reveal.js)
// =============================================================================

export {
  Presentation,
  Slide,
  SlideElement,
  SpeakerNotes,
  Animation,
  PresentationEntities,
  PresentationCategories,
} from './presentation.js'

// =============================================================================
// All Entities Collection
// =============================================================================

import { CommunicationEntities as MessageEntities } from './communication.js'
import { ProductivityEntities } from './productivity.js'
import { ProjectManagementEntities as ProjectEntities } from './project-management.js'
import { DevelopmentEntities as CodeEntities } from './development.js'
import { CRMEntities as SalesEntities } from './crm.js'
import { FinanceEntities } from './finance.js'
import { SupportEntities } from './support.js'
import { MediaEntities } from './media.js'
import { MarketingEntities } from './marketing.js'
import { KnowledgeEntities } from './knowledge.js'
import { EcommerceEntities as CommerceEntities } from './ecommerce.js'
import { AnalyticsEntities } from './analytics.js'
import { StorageEntities } from './storage.js'
import { VideoConferencingEntities as MeetingEntities } from './video-conferencing.js'
import { FormsEntities as FormEntities } from './forms.js'
import { SignatureEntities } from './signature.js'
import { DocumentEntities } from './document.js'
import { SpreadsheetEntities } from './spreadsheet.js'
import { PresentationEntities } from './presentation.js'

/**
 * All digital tool entities organized by category (single-word keys)
 */
export const AllEntities = {
  message: MessageEntities,
  productivity: ProductivityEntities,
  project: ProjectEntities,
  code: CodeEntities,
  sales: SalesEntities,
  finance: FinanceEntities,
  support: SupportEntities,
  media: MediaEntities,
  marketing: MarketingEntities,
  knowledge: KnowledgeEntities,
  commerce: CommerceEntities,
  analytics: AnalyticsEntities,
  storage: StorageEntities,
  meeting: MeetingEntities,
  form: FormEntities,
  signature: SignatureEntities,
  document: DocumentEntities,
  spreadsheet: SpreadsheetEntities,
  presentation: PresentationEntities,
} as const

/**
 * All entity category names (single-word identifiers)
 */
export const EntityCategories = [
  'message',
  'productivity',
  'project',
  'code',
  'sales',
  'finance',
  'support',
  'media',
  'marketing',
  'knowledge',
  'commerce',
  'analytics',
  'storage',
  'meeting',
  'form',
  'signature',
  'document',
  'spreadsheet',
  'presentation',
] as const

export type EntityCategory = (typeof EntityCategories)[number]

// =============================================================================
// Legacy aliases for backwards compatibility
// =============================================================================

// Re-export legacy names as aliases
export {
  MessageEntities as CommunicationEntities,
  ProjectEntities as ProjectManagementEntities,
  CodeEntities as DevelopmentEntities,
  SalesEntities as CRMEntities,
  CommerceEntities as EcommerceEntities,
  MeetingEntities as VideoConferencingEntities,
  FormEntities as FormsEntities,
}
