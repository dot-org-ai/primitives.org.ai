/**
 * Tests for Extended Entity Types
 *
 * Covers entity types from the entities/ directory including:
 * - Communication, Productivity, Project Management
 * - Development, CRM, Finance, Support
 * - Media, Marketing, Knowledge, Ecommerce
 * - Analytics, Storage, Video Conferencing, Forms
 * - And many more...
 */

import { describe, it, expect } from 'vitest'
import {
  // Site
  Site,
  SiteEntities,
  SiteTypes,

  // Communication/Message
  Message,
  Thread,
  Call,
  Channel,
  Workspace,
  Member,
  Contact,
  Attachment,
  Reaction,
  MessageEntities,

  // Productivity
  Calendar,
  Event,
  Task,
  Note,
  Notebook,
  Reminder,
  ProductivityEntities,

  // Project Management
  Project,
  Issue,
  Sprint,
  Milestone,
  Board,
  ProjectEntities,

  // Development/Code
  Repository,
  Branch,
  Commit,
  PullRequest,
  CodeReview,
  Release,
  CodeEntities,

  // CRM/Sales
  Lead,
  Deal,
  Account,
  Pipeline,
  SalesEntities,

  // Finance
  Customer as FinanceCustomer,
  Price,
  PaymentIntent,
  Invoice,
  Subscription,
  FinanceEntities,

  // Support
  SupportTicket,
  Conversation,
  HelpArticle,
  SupportEntities,

  // Media
  Image,
  Video,
  Audio,
  Screenshot,
  MediaEntities,

  // Marketing
  Campaign,
  Audience,
  EmailTemplate,
  MarketingEntities,

  // Knowledge
  WikiPage,
  Article,
  KnowledgeBase,
  KnowledgeEntities,

  // Ecommerce/Commerce
  Product,
  Order,
  Cart,
  Customer,
  CommerceEntities,

  // Analytics
  Report,
  Dashboard,
  Metric,
  AnalyticsEntities,

  // Storage
  File,
  Folder,
  Drive,
  StorageEntities,

  // Video Conferencing/Meeting
  Meeting,
  MeetingParticipant,
  MeetingRoom,
  MeetingEntities,

  // Forms
  Form,
  FormField,
  FormResponse,
  FormEntities,

  // Signature
  SignatureDocument,
  SignatureRequest,
  Signer,
  SignatureEntities,

  // Document
  Document,
  DocumentVersion,
  DocumentEntities,

  // Spreadsheet
  Spreadsheet,
  Sheet,
  Cell,
  SpreadsheetEntities,

  // Presentation
  Presentation,
  Slide,
  PresentationEntities,

  // Infrastructure
  Config,
  Database,
  Hosting,
  InfrastructureEntities,

  // Experiment
  FeatureFlag,
  Experiment,
  ExperimentEntities,

  // Advertising
  Ad,
  AdCampaign,
  AdvertisingEntities,

  // Video/Streaming
  VideoChannel,
  Playlist,
  LiveStream,
  VideoEntities,

  // Identity
  Organization,
  SSOConnection,
  IdentityEntities,

  // Notification
  Notification,
  SMS,
  PushNotification,
  NotificationEntities,

  // HR
  Employee,
  Team,
  TimeOff,
  HREntities,

  // Recruiting
  Job,
  Candidate,
  Interview,
  RecruitingEntities,

  // Design
  DesignFile,
  Component,
  DesignEntities,

  // Shipping
  Shipment,
  Package,
  ShippingEntities,

  // Automation
  AutomationWorkflow,
  Trigger,
  Action,
  AutomationEntities,

  // AI
  Model,
  Prompt,
  Agent,
  AIEntities,

  // Collections
  AllEntities,
  EntityCategories,
} from '../src/entities/index.js'

describe('Site Entities', () => {
  it('Site has correct noun definition', () => {
    expect(Site.singular).toBe('site')
    expect(Site.plural).toBe('sites')
    expect(Site.description).toBeDefined()
  })

  it('Site has required properties', () => {
    expect(Site.properties).toHaveProperty('name')
    expect(Site.properties).toHaveProperty('domain')
    expect(Site.properties).toHaveProperty('type')
    expect(Site.properties).toHaveProperty('status')
  })

  it('SiteEntities collection exists', () => {
    expect(SiteEntities).toHaveProperty('Site')
  })

  it('SiteTypes are defined', () => {
    expect(SiteTypes).toContain('store')
    expect(SiteTypes).toContain('marketplace')
    expect(SiteTypes).toContain('api')
    expect(SiteTypes).toContain('docs')
    expect(SiteTypes).toContain('app')
    expect(SiteTypes).toContain('blog')
  })
})

describe('Communication/Message Entities', () => {
  it('Message has correct structure', () => {
    expect(Message.singular).toBe('message')
    expect(Message.plural).toBe('messages')
    expect(Message.properties).toHaveProperty('body')
    expect(Message.properties).toHaveProperty('type')
  })

  it('Thread has correct structure', () => {
    expect(Thread.singular).toBe('thread')
    expect(Thread.plural).toBe('threads')
  })

  it('Call has correct structure', () => {
    expect(Call.singular).toBe('call')
    expect(Call.plural).toBe('calls')
    expect(Call.properties).toHaveProperty('from')
    expect(Call.properties).toHaveProperty('to')
    expect(Call.properties).toHaveProperty('duration')
  })

  it('Channel has correct structure', () => {
    expect(Channel.singular).toBe('channel')
    expect(Channel.plural).toBe('channels')
  })

  it('Workspace has correct structure', () => {
    expect(Workspace.singular).toBe('workspace')
    expect(Workspace.plural).toBe('workspaces')
  })

  it('Member has correct structure', () => {
    expect(Member.singular).toBe('member')
    expect(Member.plural).toBe('members')
  })

  it('Contact has correct structure', () => {
    expect(Contact.singular).toBe('contact')
    expect(Contact.plural).toBe('contacts')
    expect(Contact.properties).toHaveProperty('name')
    expect(Contact.properties).toHaveProperty('email')
  })

  it('Attachment has correct structure', () => {
    expect(Attachment.singular).toBe('attachment')
    expect(Attachment.plural).toBe('attachments')
    expect(Attachment.properties).toHaveProperty('name')
    expect(Attachment.properties).toHaveProperty('size')
  })

  it('Reaction has correct structure', () => {
    expect(Reaction.singular).toBe('reaction')
    expect(Reaction.plural).toBe('reactions')
  })

  it('MessageEntities collection exists', () => {
    expect(MessageEntities).toBeDefined()
    expect(Object.keys(MessageEntities).length).toBeGreaterThan(0)
  })
})

describe('Productivity Entities', () => {
  it('Calendar has correct structure', () => {
    expect(Calendar.singular).toBe('calendar')
    expect(Calendar.plural).toBe('calendars')
  })

  it('Event has correct structure', () => {
    expect(Event.singular).toBe('event')
    expect(Event.plural).toBe('events')
    expect(Event.properties).toHaveProperty('title')
    expect(Event.properties).toHaveProperty('startTime')
  })

  it('Task has correct structure', () => {
    expect(Task.singular).toBe('task')
    expect(Task.plural).toBe('tasks')
    expect(Task.properties).toHaveProperty('title')
    expect(Task.properties).toHaveProperty('status')
  })

  it('Note has correct structure', () => {
    expect(Note.singular).toBe('note')
    expect(Note.plural).toBe('notes')
    expect(Note.properties).toHaveProperty('title')
    expect(Note.properties).toHaveProperty('content')
  })

  it('Notebook has correct structure', () => {
    expect(Notebook.singular).toBe('notebook')
    expect(Notebook.plural).toBe('notebooks')
  })

  it('Reminder has correct structure', () => {
    expect(Reminder.singular).toBe('reminder')
    expect(Reminder.plural).toBe('reminders')
  })

  it('ProductivityEntities collection exists', () => {
    expect(ProductivityEntities).toBeDefined()
    expect(Object.keys(ProductivityEntities).length).toBeGreaterThan(0)
  })
})

describe('Project Management Entities', () => {
  it('Project has correct structure', () => {
    expect(Project.singular).toBe('project')
    expect(Project.plural).toBe('projects')
    expect(Project.properties).toHaveProperty('name')
  })

  it('Issue has correct structure', () => {
    expect(Issue.singular).toBe('issue')
    expect(Issue.plural).toBe('issues')
    expect(Issue.properties).toHaveProperty('title')
    expect(Issue.properties).toHaveProperty('status')
  })

  it('Sprint has correct structure', () => {
    expect(Sprint.singular).toBe('sprint')
    expect(Sprint.plural).toBe('sprints')
    expect(Sprint.properties).toHaveProperty('name')
    expect(Sprint.properties).toHaveProperty('startDate')
    expect(Sprint.properties).toHaveProperty('endDate')
  })

  it('Milestone has correct structure', () => {
    expect(Milestone.singular).toBe('milestone')
    expect(Milestone.plural).toBe('milestones')
  })

  it('Board has correct structure', () => {
    expect(Board.singular).toBe('board')
    expect(Board.plural).toBe('boards')
  })

  it('ProjectEntities collection exists', () => {
    expect(ProjectEntities).toBeDefined()
    expect(Object.keys(ProjectEntities).length).toBeGreaterThan(0)
  })
})

describe('Development/Code Entities', () => {
  it('Repository has correct structure', () => {
    expect(Repository.singular).toBe('repository')
    expect(Repository.plural).toBe('repositories')
    expect(Repository.properties).toHaveProperty('name')
    expect(Repository.properties).toHaveProperty('visibility')
  })

  it('Branch has correct structure', () => {
    expect(Branch.singular).toBe('branch')
    expect(Branch.plural).toBe('branches')
    expect(Branch.properties).toHaveProperty('name')
  })

  it('Commit has correct structure', () => {
    expect(Commit.singular).toBe('commit')
    expect(Commit.plural).toBe('commits')
    expect(Commit.properties).toHaveProperty('sha')
    expect(Commit.properties).toHaveProperty('message')
  })

  it('PullRequest has correct structure', () => {
    expect(PullRequest.singular).toBe('pull request')
    expect(PullRequest.plural).toBe('pull requests')
    expect(PullRequest.properties).toHaveProperty('title')
    expect(PullRequest.properties).toHaveProperty('status')
  })

  it('CodeReview has correct structure', () => {
    expect(CodeReview.singular).toBe('code review')
    expect(CodeReview.plural).toBe('code reviews')
  })

  it('Release has correct structure', () => {
    expect(Release.singular).toBe('release')
    expect(Release.plural).toBe('releases')
    expect(Release.properties).toHaveProperty('tagName')
    expect(Release.properties).toHaveProperty('name')
  })

  it('CodeEntities collection exists', () => {
    expect(CodeEntities).toBeDefined()
    expect(Object.keys(CodeEntities).length).toBeGreaterThan(0)
  })
})

describe('CRM/Sales Entities', () => {
  it('Lead has correct structure', () => {
    expect(Lead.singular).toBe('lead')
    expect(Lead.plural).toBe('leads')
    expect(Lead.properties).toHaveProperty('firstName')
    expect(Lead.properties).toHaveProperty('email')
    expect(Lead.properties).toHaveProperty('status')
  })

  it('Deal has correct structure', () => {
    expect(Deal.singular).toBe('deal')
    expect(Deal.plural).toBe('deals')
    expect(Deal.properties).toHaveProperty('name')
    expect(Deal.properties).toHaveProperty('value')
    expect(Deal.properties).toHaveProperty('stage')
  })

  it('Account has correct structure', () => {
    expect(Account.singular).toBe('account')
    expect(Account.plural).toBe('accounts')
    expect(Account.properties).toHaveProperty('name')
  })

  it('Pipeline has correct structure', () => {
    expect(Pipeline.singular).toBe('pipeline')
    expect(Pipeline.plural).toBe('pipelines')
    expect(Pipeline.properties).toHaveProperty('name')
  })

  it('SalesEntities collection exists', () => {
    expect(SalesEntities).toBeDefined()
    expect(Object.keys(SalesEntities).length).toBeGreaterThan(0)
  })
})

describe('Finance Entities', () => {
  it('FinanceCustomer has correct structure', () => {
    expect(FinanceCustomer.singular).toBe('customer')
    expect(FinanceCustomer.plural).toBe('customers')
    expect(FinanceCustomer.properties).toHaveProperty('email')
  })

  it('Price has correct structure', () => {
    expect(Price.singular).toBe('price')
    expect(Price.plural).toBe('prices')
    expect(Price.properties).toHaveProperty('unitAmount')
    expect(Price.properties).toHaveProperty('currency')
  })

  it('PaymentIntent has correct structure', () => {
    expect(PaymentIntent.singular).toBe('payment intent')
    expect(PaymentIntent.plural).toBe('payment intents')
    expect(PaymentIntent.properties).toHaveProperty('amount')
    expect(PaymentIntent.properties).toHaveProperty('currency')
    expect(PaymentIntent.properties).toHaveProperty('status')
  })

  it('Invoice has correct structure', () => {
    expect(Invoice.singular).toBe('invoice')
    expect(Invoice.plural).toBe('invoices')
    expect(Invoice.properties).toHaveProperty('number')
    expect(Invoice.properties).toHaveProperty('status')
  })

  it('Subscription has correct structure', () => {
    expect(Subscription.singular).toBe('subscription')
    expect(Subscription.plural).toBe('subscriptions')
    expect(Subscription.properties).toHaveProperty('status')
  })

  it('FinanceEntities collection exists', () => {
    expect(FinanceEntities).toBeDefined()
    expect(Object.keys(FinanceEntities).length).toBeGreaterThan(0)
  })
})

describe('Support Entities', () => {
  it('SupportTicket has correct structure', () => {
    expect(SupportTicket.singular).toBe('support ticket')
    expect(SupportTicket.plural).toBe('support tickets')
    expect(SupportTicket.properties).toHaveProperty('subject')
    expect(SupportTicket.properties).toHaveProperty('status')
    expect(SupportTicket.properties).toHaveProperty('priority')
  })

  it('Conversation has correct structure', () => {
    expect(Conversation.singular).toBe('conversation')
    expect(Conversation.plural).toBe('conversations')
  })

  it('HelpArticle has correct structure', () => {
    expect(HelpArticle.singular).toBe('help article')
    expect(HelpArticle.plural).toBe('help articles')
    expect(HelpArticle.properties).toHaveProperty('title')
    expect(HelpArticle.properties).toHaveProperty('body')
  })

  it('SupportEntities collection exists', () => {
    expect(SupportEntities).toBeDefined()
    expect(Object.keys(SupportEntities).length).toBeGreaterThan(0)
  })
})

describe('Media Entities', () => {
  it('Image has correct structure', () => {
    expect(Image.singular).toBe('image')
    expect(Image.plural).toBe('images')
    expect(Image.properties).toHaveProperty('url')
    expect(Image.properties).toHaveProperty('width')
    expect(Image.properties).toHaveProperty('height')
  })

  it('Video has correct structure', () => {
    expect(Video.singular).toBe('video')
    expect(Video.plural).toBe('videos')
    expect(Video.properties).toHaveProperty('url')
    expect(Video.properties).toHaveProperty('duration')
  })

  it('Audio has correct structure', () => {
    expect(Audio.singular).toBe('audio')
    expect(Audio.plural).toBe('audio files')
    expect(Audio.properties).toHaveProperty('url')
    expect(Audio.properties).toHaveProperty('duration')
  })

  it('Screenshot has correct structure', () => {
    expect(Screenshot.singular).toBe('screenshot')
    expect(Screenshot.plural).toBe('screenshots')
  })

  it('MediaEntities collection exists', () => {
    expect(MediaEntities).toBeDefined()
    expect(Object.keys(MediaEntities).length).toBeGreaterThan(0)
  })
})

describe('Marketing Entities', () => {
  it('Campaign has correct structure', () => {
    expect(Campaign.singular).toBe('campaign')
    expect(Campaign.plural).toBe('campaigns')
    expect(Campaign.properties).toHaveProperty('name')
    expect(Campaign.properties).toHaveProperty('status')
  })

  it('Audience has correct structure', () => {
    expect(Audience.singular).toBe('audience')
    expect(Audience.plural).toBe('audiences')
    expect(Audience.properties).toHaveProperty('name')
  })

  it('EmailTemplate has correct structure', () => {
    expect(EmailTemplate.singular).toBe('email template')
    expect(EmailTemplate.plural).toBe('email templates')
    expect(EmailTemplate.properties).toHaveProperty('name')
    expect(EmailTemplate.properties).toHaveProperty('subject')
  })

  it('MarketingEntities collection exists', () => {
    expect(MarketingEntities).toBeDefined()
    expect(Object.keys(MarketingEntities).length).toBeGreaterThan(0)
  })
})

describe('Knowledge Entities', () => {
  it('WikiPage has correct structure', () => {
    expect(WikiPage.singular).toBe('wiki page')
    expect(WikiPage.plural).toBe('wiki pages')
    expect(WikiPage.properties).toHaveProperty('title')
    expect(WikiPage.properties).toHaveProperty('content')
  })

  it('Article has correct structure', () => {
    expect(Article.singular).toBe('article')
    expect(Article.plural).toBe('articles')
    expect(Article.properties).toHaveProperty('title')
    expect(Article.properties).toHaveProperty('content')
  })

  it('KnowledgeBase has correct structure', () => {
    expect(KnowledgeBase.singular).toBe('knowledge base')
    expect(KnowledgeBase.plural).toBe('knowledge bases')
    expect(KnowledgeBase.properties).toHaveProperty('name')
  })

  it('KnowledgeEntities collection exists', () => {
    expect(KnowledgeEntities).toBeDefined()
    expect(Object.keys(KnowledgeEntities).length).toBeGreaterThan(0)
  })
})

describe('Commerce Entities', () => {
  it('Product has correct structure', () => {
    expect(Product.singular).toBe('product')
    expect(Product.plural).toBe('products')
    expect(Product.properties).toHaveProperty('name')
    expect(Product.properties).toHaveProperty('price')
  })

  it('Order has correct structure', () => {
    expect(Order.singular).toBe('order')
    expect(Order.plural).toBe('orders')
    expect(Order.properties).toHaveProperty('status')
    expect(Order.properties).toHaveProperty('total')
  })

  it('Cart has correct structure', () => {
    expect(Cart.singular).toBe('cart')
    expect(Cart.plural).toBe('carts')
  })

  it('Customer has correct structure', () => {
    expect(Customer.singular).toBe('customer')
    expect(Customer.plural).toBe('customers')
    expect(Customer.properties).toHaveProperty('email')
  })

  it('CommerceEntities collection exists', () => {
    expect(CommerceEntities).toBeDefined()
    expect(Object.keys(CommerceEntities).length).toBeGreaterThan(0)
  })
})

describe('Analytics Entities', () => {
  it('Report has correct structure', () => {
    expect(Report.singular).toBe('report')
    expect(Report.plural).toBe('reports')
    expect(Report.properties).toHaveProperty('title')
  })

  it('Dashboard has correct structure', () => {
    expect(Dashboard.singular).toBe('dashboard')
    expect(Dashboard.plural).toBe('dashboards')
    expect(Dashboard.properties).toHaveProperty('name')
  })

  it('Metric has correct structure', () => {
    expect(Metric.singular).toBe('metric')
    expect(Metric.plural).toBe('metrics')
    expect(Metric.properties).toHaveProperty('name')
    expect(Metric.properties).toHaveProperty('value')
  })

  it('AnalyticsEntities collection exists', () => {
    expect(AnalyticsEntities).toBeDefined()
    expect(Object.keys(AnalyticsEntities).length).toBeGreaterThan(0)
  })
})

describe('Storage Entities', () => {
  it('File has correct structure', () => {
    expect(File.singular).toBe('file')
    expect(File.plural).toBe('files')
    expect(File.properties).toHaveProperty('name')
    expect(File.properties).toHaveProperty('size')
    expect(File.properties).toHaveProperty('mimeType')
  })

  it('Folder has correct structure', () => {
    expect(Folder.singular).toBe('folder')
    expect(Folder.plural).toBe('folders')
    expect(Folder.properties).toHaveProperty('name')
  })

  it('Drive has correct structure', () => {
    expect(Drive.singular).toBe('drive')
    expect(Drive.plural).toBe('drives')
    expect(Drive.properties).toHaveProperty('name')
  })

  it('StorageEntities collection exists', () => {
    expect(StorageEntities).toBeDefined()
    expect(Object.keys(StorageEntities).length).toBeGreaterThan(0)
  })
})

describe('Meeting Entities', () => {
  it('Meeting has correct structure', () => {
    expect(Meeting.singular).toBe('meeting')
    expect(Meeting.plural).toBe('meetings')
    expect(Meeting.properties).toHaveProperty('title')
    expect(Meeting.properties).toHaveProperty('scheduledAt')
  })

  it('MeetingParticipant has correct structure', () => {
    expect(MeetingParticipant.singular).toBe('meeting participant')
    expect(MeetingParticipant.plural).toBe('meeting participants')
  })

  it('MeetingRoom has correct structure', () => {
    expect(MeetingRoom.singular).toBe('meeting room')
    expect(MeetingRoom.plural).toBe('meeting rooms')
    expect(MeetingRoom.properties).toHaveProperty('name')
  })

  it('MeetingEntities collection exists', () => {
    expect(MeetingEntities).toBeDefined()
    expect(Object.keys(MeetingEntities).length).toBeGreaterThan(0)
  })
})

describe('Form Entities', () => {
  it('Form has correct structure', () => {
    expect(Form.singular).toBe('form')
    expect(Form.plural).toBe('forms')
    expect(Form.properties).toHaveProperty('title')
  })

  it('FormField has correct structure', () => {
    expect(FormField.singular).toBe('form field')
    expect(FormField.plural).toBe('form fields')
    expect(FormField.properties).toHaveProperty('type')
    expect(FormField.properties).toHaveProperty('label')
  })

  it('FormResponse has correct structure', () => {
    expect(FormResponse.singular).toBe('form response')
    expect(FormResponse.plural).toBe('form responses')
  })

  it('FormEntities collection exists', () => {
    expect(FormEntities).toBeDefined()
    expect(Object.keys(FormEntities).length).toBeGreaterThan(0)
  })
})

describe('Signature Entities', () => {
  it('SignatureDocument has correct structure', () => {
    expect(SignatureDocument.singular).toBe('signature document')
    expect(SignatureDocument.plural).toBe('signature documents')
    expect(SignatureDocument.properties).toHaveProperty('title')
    expect(SignatureDocument.properties).toHaveProperty('status')
  })

  it('SignatureRequest has correct structure', () => {
    expect(SignatureRequest.singular).toBe('signature request')
    expect(SignatureRequest.plural).toBe('signature requests')
  })

  it('Signer has correct structure', () => {
    expect(Signer.singular).toBe('signer')
    expect(Signer.plural).toBe('signers')
    expect(Signer.properties).toHaveProperty('email')
    expect(Signer.properties).toHaveProperty('status')
  })

  it('SignatureEntities collection exists', () => {
    expect(SignatureEntities).toBeDefined()
    expect(Object.keys(SignatureEntities).length).toBeGreaterThan(0)
  })
})

describe('Document Entities', () => {
  it('Document has correct structure', () => {
    expect(Document.singular).toBe('document')
    expect(Document.plural).toBe('documents')
    expect(Document.properties).toHaveProperty('title')
    expect(Document.properties).toHaveProperty('content')
  })

  it('DocumentVersion has correct structure', () => {
    expect(DocumentVersion.singular).toBe('document version')
    expect(DocumentVersion.plural).toBe('document versions')
    expect(DocumentVersion.properties).toHaveProperty('versionNumber')
  })

  it('DocumentEntities collection exists', () => {
    expect(DocumentEntities).toBeDefined()
    expect(Object.keys(DocumentEntities).length).toBeGreaterThan(0)
  })
})

describe('Spreadsheet Entities', () => {
  it('Spreadsheet has correct structure', () => {
    expect(Spreadsheet.singular).toBe('spreadsheet')
    expect(Spreadsheet.plural).toBe('spreadsheets')
    expect(Spreadsheet.properties).toHaveProperty('title')
  })

  it('Sheet has correct structure', () => {
    expect(Sheet.singular).toBe('sheet')
    expect(Sheet.plural).toBe('sheets')
    expect(Sheet.properties).toHaveProperty('name')
    expect(Sheet.properties).toHaveProperty('index')
  })

  it('Cell has correct structure', () => {
    expect(Cell.singular).toBe('cell')
    expect(Cell.plural).toBe('cells')
    expect(Cell.properties).toHaveProperty('address')
    expect(Cell.properties).toHaveProperty('value')
  })

  it('SpreadsheetEntities collection exists', () => {
    expect(SpreadsheetEntities).toBeDefined()
    expect(Object.keys(SpreadsheetEntities).length).toBeGreaterThan(0)
  })
})

describe('Presentation Entities', () => {
  it('Presentation has correct structure', () => {
    expect(Presentation.singular).toBe('presentation')
    expect(Presentation.plural).toBe('presentations')
    expect(Presentation.properties).toHaveProperty('title')
  })

  it('Slide has correct structure', () => {
    expect(Slide.singular).toBe('slide')
    expect(Slide.plural).toBe('slides')
    expect(Slide.properties).toHaveProperty('index')
  })

  it('PresentationEntities collection exists', () => {
    expect(PresentationEntities).toBeDefined()
    expect(Object.keys(PresentationEntities).length).toBeGreaterThan(0)
  })
})

describe('Infrastructure Entities', () => {
  it('Config has correct structure', () => {
    expect(Config.singular).toBe('config')
    expect(Config.plural).toBe('configs')
    expect(Config.properties).toHaveProperty('name')
  })

  it('Database has correct structure', () => {
    expect(Database.singular).toBe('database')
    expect(Database.plural).toBe('databases')
    expect(Database.properties).toHaveProperty('name')
  })

  it('Hosting has correct structure', () => {
    expect(Hosting.singular).toBe('hosting')
    expect(Hosting.plural).toBe('hostings')
  })

  it('InfrastructureEntities collection exists', () => {
    expect(InfrastructureEntities).toBeDefined()
    expect(Object.keys(InfrastructureEntities).length).toBeGreaterThan(0)
  })
})

describe('Experiment Entities', () => {
  it('FeatureFlag has correct structure', () => {
    expect(FeatureFlag.singular).toBe('feature flag')
    expect(FeatureFlag.plural).toBe('feature flags')
    expect(FeatureFlag.properties).toHaveProperty('key')
    expect(FeatureFlag.properties).toHaveProperty('enabled')
  })

  it('Experiment has correct structure', () => {
    expect(Experiment.singular).toBe('experiment')
    expect(Experiment.plural).toBe('experiments')
    expect(Experiment.properties).toHaveProperty('name')
    expect(Experiment.properties).toHaveProperty('status')
  })

  it('ExperimentEntities collection exists', () => {
    expect(ExperimentEntities).toBeDefined()
    expect(Object.keys(ExperimentEntities).length).toBeGreaterThan(0)
  })
})

describe('Advertising Entities', () => {
  it('Ad has correct structure', () => {
    expect(Ad.singular).toBe('ad')
    expect(Ad.plural).toBe('ads')
    expect(Ad.properties).toHaveProperty('name')
    expect(Ad.properties).toHaveProperty('status')
  })

  it('AdCampaign has correct structure', () => {
    expect(AdCampaign.singular).toBe('ad campaign')
    expect(AdCampaign.plural).toBe('ad campaigns')
    expect(AdCampaign.properties).toHaveProperty('name')
    expect(AdCampaign.properties).toHaveProperty('budget')
  })

  it('AdvertisingEntities collection exists', () => {
    expect(AdvertisingEntities).toBeDefined()
    expect(Object.keys(AdvertisingEntities).length).toBeGreaterThan(0)
  })
})

describe('Video/Streaming Entities', () => {
  it('VideoChannel has correct structure', () => {
    expect(VideoChannel.singular).toBe('video channel')
    expect(VideoChannel.plural).toBe('video channels')
    expect(VideoChannel.properties).toHaveProperty('name')
  })

  it('Playlist has correct structure', () => {
    expect(Playlist.singular).toBe('playlist')
    expect(Playlist.plural).toBe('playlists')
    expect(Playlist.properties).toHaveProperty('title')
  })

  it('LiveStream has correct structure', () => {
    expect(LiveStream.singular).toBe('live stream')
    expect(LiveStream.plural).toBe('live streams')
    expect(LiveStream.properties).toHaveProperty('title')
    expect(LiveStream.properties).toHaveProperty('status')
  })

  it('VideoEntities collection exists', () => {
    expect(VideoEntities).toBeDefined()
    expect(Object.keys(VideoEntities).length).toBeGreaterThan(0)
  })
})

describe('Identity Entities', () => {
  it('Organization has correct structure', () => {
    expect(Organization.singular).toBe('organization')
    expect(Organization.plural).toBe('organizations')
    expect(Organization.properties).toHaveProperty('name')
  })

  it('SSOConnection has correct structure', () => {
    expect(SSOConnection.singular).toBe('sso connection')
    expect(SSOConnection.plural).toBe('sso connections')
    expect(SSOConnection.properties).toHaveProperty('type')
  })

  it('IdentityEntities collection exists', () => {
    expect(IdentityEntities).toBeDefined()
    expect(Object.keys(IdentityEntities).length).toBeGreaterThan(0)
  })
})

describe('Notification Entities', () => {
  it('Notification has correct structure', () => {
    expect(Notification.singular).toBe('notification')
    expect(Notification.plural).toBe('notifications')
    expect(Notification.properties).toHaveProperty('title')
    expect(Notification.properties).toHaveProperty('body')
  })

  it('SMS has correct structure', () => {
    expect(SMS.singular).toBe('sms')
    expect(SMS.plural).toBe('sms-messages')
    expect(SMS.properties).toHaveProperty('to')
    expect(SMS.properties).toHaveProperty('body')
  })

  it('PushNotification has correct structure', () => {
    expect(PushNotification.singular).toBe('push-notification')
    expect(PushNotification.plural).toBe('push-notifications')
    expect(PushNotification.properties).toHaveProperty('title')
    expect(PushNotification.properties).toHaveProperty('body')
  })

  it('NotificationEntities collection exists', () => {
    expect(NotificationEntities).toBeDefined()
    expect(Object.keys(NotificationEntities).length).toBeGreaterThan(0)
  })
})

describe('HR Entities', () => {
  it('Employee has correct structure', () => {
    expect(Employee.singular).toBe('employee')
    expect(Employee.plural).toBe('employees')
    expect(Employee.properties).toHaveProperty('firstName')
    expect(Employee.properties).toHaveProperty('email')
  })

  it('Team has correct structure', () => {
    expect(Team.singular).toBe('team')
    expect(Team.plural).toBe('teams')
    expect(Team.properties).toHaveProperty('name')
  })

  it('TimeOff has correct structure', () => {
    expect(TimeOff.singular).toBe('time-off')
    expect(TimeOff.plural).toBe('time-off-requests')
    expect(TimeOff.properties).toHaveProperty('type')
    expect(TimeOff.properties).toHaveProperty('status')
  })

  it('HREntities collection exists', () => {
    expect(HREntities).toBeDefined()
    expect(Object.keys(HREntities).length).toBeGreaterThan(0)
  })
})

describe('Recruiting Entities', () => {
  it('Job has correct structure', () => {
    expect(Job.singular).toBe('job')
    expect(Job.plural).toBe('jobs')
    expect(Job.properties).toHaveProperty('title')
    expect(Job.properties).toHaveProperty('status')
  })

  it('Candidate has correct structure', () => {
    expect(Candidate.singular).toBe('candidate')
    expect(Candidate.plural).toBe('candidates')
    expect(Candidate.properties).toHaveProperty('firstName')
    expect(Candidate.properties).toHaveProperty('email')
  })

  it('Interview has correct structure', () => {
    expect(Interview.singular).toBe('interview')
    expect(Interview.plural).toBe('interviews')
    expect(Interview.properties).toHaveProperty('type')
    expect(Interview.properties).toHaveProperty('scheduledAt')
  })

  it('RecruitingEntities collection exists', () => {
    expect(RecruitingEntities).toBeDefined()
    expect(Object.keys(RecruitingEntities).length).toBeGreaterThan(0)
  })
})

describe('Design Entities', () => {
  it('DesignFile has correct structure', () => {
    expect(DesignFile.singular).toBe('design-file')
    expect(DesignFile.plural).toBe('design-files')
    expect(DesignFile.properties).toHaveProperty('name')
  })

  it('Component has correct structure', () => {
    expect(Component.singular).toBe('component')
    expect(Component.plural).toBe('components')
    expect(Component.properties).toHaveProperty('name')
  })

  it('DesignEntities collection exists', () => {
    expect(DesignEntities).toBeDefined()
    expect(Object.keys(DesignEntities).length).toBeGreaterThan(0)
  })
})

describe('Shipping Entities', () => {
  it('Shipment has correct structure', () => {
    expect(Shipment.singular).toBe('shipment')
    expect(Shipment.plural).toBe('shipments')
    expect(Shipment.properties).toHaveProperty('status')
    expect(Shipment.properties).toHaveProperty('trackingNumber')
  })

  it('Package has correct structure', () => {
    expect(Package.singular).toBe('package')
    expect(Package.plural).toBe('packages')
    expect(Package.properties).toHaveProperty('weight')
  })

  it('ShippingEntities collection exists', () => {
    expect(ShippingEntities).toBeDefined()
    expect(Object.keys(ShippingEntities).length).toBeGreaterThan(0)
  })
})

describe('Automation Entities', () => {
  it('AutomationWorkflow has correct structure', () => {
    expect(AutomationWorkflow.singular).toBe('automation-workflow')
    expect(AutomationWorkflow.plural).toBe('automation-workflows')
    expect(AutomationWorkflow.properties).toHaveProperty('name')
    expect(AutomationWorkflow.properties).toHaveProperty('status')
  })

  it('Trigger has correct structure', () => {
    expect(Trigger.singular).toBe('trigger')
    expect(Trigger.plural).toBe('triggers')
    expect(Trigger.properties).toHaveProperty('type')
  })

  it('Action has correct structure', () => {
    expect(Action.singular).toBe('action')
    expect(Action.plural).toBe('actions')
    expect(Action.properties).toHaveProperty('type')
  })

  it('AutomationEntities collection exists', () => {
    expect(AutomationEntities).toBeDefined()
    expect(Object.keys(AutomationEntities).length).toBeGreaterThan(0)
  })
})

describe('AI Entities', () => {
  it('Model has correct structure', () => {
    expect(Model.singular).toBe('model')
    expect(Model.plural).toBe('models')
    expect(Model.properties).toHaveProperty('name')
    expect(Model.properties).toHaveProperty('provider')
  })

  it('Prompt has correct structure', () => {
    expect(Prompt.singular).toBe('prompt')
    expect(Prompt.plural).toBe('prompts')
    expect(Prompt.properties).toHaveProperty('template')
  })

  it('Agent has correct structure', () => {
    expect(Agent.singular).toBe('agent')
    expect(Agent.plural).toBe('agents')
    expect(Agent.properties).toHaveProperty('name')
    expect(Agent.properties).toHaveProperty('systemPrompt')
  })

  it('AIEntities collection exists', () => {
    expect(AIEntities).toBeDefined()
    expect(Object.keys(AIEntities).length).toBeGreaterThan(0)
  })
})

describe('AllEntities Collection', () => {
  it('contains all entity categories', () => {
    expect(AllEntities).toHaveProperty('site')
    expect(AllEntities).toHaveProperty('message')
    expect(AllEntities).toHaveProperty('productivity')
    expect(AllEntities).toHaveProperty('project')
    expect(AllEntities).toHaveProperty('code')
    expect(AllEntities).toHaveProperty('sales')
    expect(AllEntities).toHaveProperty('finance')
    expect(AllEntities).toHaveProperty('support')
    expect(AllEntities).toHaveProperty('media')
    expect(AllEntities).toHaveProperty('marketing')
    expect(AllEntities).toHaveProperty('knowledge')
    expect(AllEntities).toHaveProperty('commerce')
    expect(AllEntities).toHaveProperty('analytics')
    expect(AllEntities).toHaveProperty('storage')
    expect(AllEntities).toHaveProperty('meeting')
    expect(AllEntities).toHaveProperty('form')
    expect(AllEntities).toHaveProperty('signature')
    expect(AllEntities).toHaveProperty('document')
    expect(AllEntities).toHaveProperty('spreadsheet')
    expect(AllEntities).toHaveProperty('presentation')
    expect(AllEntities).toHaveProperty('infrastructure')
    expect(AllEntities).toHaveProperty('experiment')
    expect(AllEntities).toHaveProperty('advertising')
    expect(AllEntities).toHaveProperty('video')
    expect(AllEntities).toHaveProperty('identity')
    expect(AllEntities).toHaveProperty('notification')
    expect(AllEntities).toHaveProperty('hr')
    expect(AllEntities).toHaveProperty('recruiting')
    expect(AllEntities).toHaveProperty('design')
    expect(AllEntities).toHaveProperty('shipping')
    expect(AllEntities).toHaveProperty('automation')
    expect(AllEntities).toHaveProperty('ai')
  })

  it('has 32 entity categories', () => {
    expect(Object.keys(AllEntities)).toHaveLength(32)
  })
})

describe('EntityCategories', () => {
  it('contains all category names', () => {
    expect(EntityCategories).toContain('site')
    expect(EntityCategories).toContain('message')
    expect(EntityCategories).toContain('productivity')
    expect(EntityCategories).toContain('project')
    expect(EntityCategories).toContain('code')
    expect(EntityCategories).toContain('sales')
    expect(EntityCategories).toContain('finance')
    expect(EntityCategories).toContain('support')
    expect(EntityCategories).toContain('media')
    expect(EntityCategories).toContain('marketing')
    expect(EntityCategories).toContain('knowledge')
    expect(EntityCategories).toContain('commerce')
    expect(EntityCategories).toContain('analytics')
    expect(EntityCategories).toContain('storage')
    expect(EntityCategories).toContain('meeting')
    expect(EntityCategories).toContain('form')
    expect(EntityCategories).toContain('signature')
    expect(EntityCategories).toContain('document')
    expect(EntityCategories).toContain('spreadsheet')
    expect(EntityCategories).toContain('presentation')
    expect(EntityCategories).toContain('infrastructure')
    expect(EntityCategories).toContain('experiment')
    expect(EntityCategories).toContain('advertising')
    expect(EntityCategories).toContain('video')
    expect(EntityCategories).toContain('identity')
    expect(EntityCategories).toContain('notification')
    expect(EntityCategories).toContain('hr')
    expect(EntityCategories).toContain('recruiting')
    expect(EntityCategories).toContain('design')
    expect(EntityCategories).toContain('shipping')
    expect(EntityCategories).toContain('automation')
    expect(EntityCategories).toContain('ai')
  })

  it('has 32 categories', () => {
    expect(EntityCategories).toHaveLength(32)
  })

  it('matches AllEntities keys', () => {
    const allEntityKeys = Object.keys(AllEntities)
    expect(EntityCategories).toEqual(expect.arrayContaining(allEntityKeys))
    expect(allEntityKeys).toEqual(expect.arrayContaining([...EntityCategories]))
  })
})
