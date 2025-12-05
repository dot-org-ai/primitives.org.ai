/**
 * Digital Tool Providers
 *
 * Concrete implementations of entity types using third-party APIs.
 *
 * @packageDocumentation
 */

// Provider types and registry
export * from './types.js'
export {
  providerRegistry,
  createProviderRegistry,
  registerProvider,
  getProvider,
  createProvider,
  listProviders,
  defineProvider,
} from './registry.js'

// Email providers
export {
  sendgridInfo,
  sendgridProvider,
  createSendGridProvider,
  resendInfo,
  resendProvider,
  createResendProvider,
  registerEmailProviders,
  emailProviders,
} from './email/index.js'

// Messaging providers
export {
  slackInfo,
  slackProvider,
  createSlackProvider,
  twilioSmsInfo,
  twilioSmsProvider,
  createTwilioSmsProvider,
  registerMessagingProviders,
  messagingProviders,
} from './messaging/index.js'

// Spreadsheet providers
export {
  xlsxInfo,
  xlsxProvider,
  createXlsxProvider,
  googleSheetsInfo,
  googleSheetsProvider,
  createGoogleSheetsProvider,
  registerSpreadsheetProviders,
  spreadsheetProviders,
} from './spreadsheet/index.js'

// Media providers
export {
  cloudinaryInfo,
  cloudinaryProvider,
  createCloudinaryProvider,
  registerMediaProviders,
  mediaProviders,
} from './media/index.js'

// Task providers
export {
  todoistInfo,
  todoistProvider,
  createTodoistProvider,
  registerTaskProviders,
  taskProviders,
} from './tasks/index.js'

// Finance providers
export {
  stripeInfo,
  stripeProvider,
  createStripeProvider,
  registerFinanceProviders,
  financeProviders,
} from './finance/index.js'

// Support providers
export {
  zendeskInfo,
  zendeskProvider,
  createZendeskProvider,
  registerSupportProviders,
  supportProviders,
} from './support/index.js'

// Project management providers
export {
  linearInfo,
  linearProvider,
  createLinearProvider,
  registerProjectManagementProviders,
  projectManagementProviders,
} from './project-management/index.js'

// Knowledge providers
export {
  notionInfo,
  notionProvider,
  createNotionProvider,
  registerKnowledgeProviders,
  knowledgeProviders,
} from './knowledge/index.js'

// CRM providers
export {
  hubspotInfo,
  hubspotProvider,
  createHubSpotProvider,
  registerCRMProviders,
  crmProviders,
} from './crm/index.js'

// E-commerce providers
export {
  shopifyInfo,
  shopifyProvider,
  createShopifyProvider,
  registerEcommerceProviders,
  ecommerceProviders,
} from './ecommerce/index.js'

// Development providers
export {
  githubInfo,
  githubProvider,
  createGitHubProvider,
  registerDevelopmentProviders,
  developmentProviders,
} from './development/index.js'

// Forms providers
export {
  typeformInfo,
  typeformProvider,
  createTypeformProvider,
  registerFormsProviders,
  formsProviders,
} from './forms/index.js'

// Analytics providers
export {
  mixpanelInfo,
  mixpanelProvider,
  createMixpanelProvider,
  registerAnalyticsProviders,
  analyticsProviders,
} from './analytics/index.js'

// Video conferencing providers
export {
  zoomInfo,
  zoomProvider,
  createZoomProvider,
  googleMeetInfo,
  googleMeetProvider,
  createGoogleMeetProvider,
  teamsInfo,
  teamsProvider,
  createTeamsProvider,
  jitsiInfo,
  jitsiProvider,
  createJitsiProvider,
  registerVideoConferencingProviders,
  videoConferencingProviders,
} from './video-conferencing/index.js'

// Calendar providers
export {
  googleCalendarInfo,
  googleCalendarProvider,
  createGoogleCalendarProvider,
  registerCalendarProviders,
  calendarProviders,
} from './calendar/index.js'

// Storage providers
export {
  s3Info,
  s3Provider,
  createS3Provider,
  registerStorageProviders,
  storageProviders,
} from './storage/index.js'

// Import for registration
import { registerEmailProviders } from './email/index.js'
import { registerMessagingProviders } from './messaging/index.js'
import { registerSpreadsheetProviders } from './spreadsheet/index.js'
import { registerMediaProviders } from './media/index.js'
import { registerTaskProviders } from './tasks/index.js'
import { registerFinanceProviders } from './finance/index.js'
import { registerKnowledgeProviders } from './knowledge/index.js'
import { registerCRMProviders } from './crm/index.js'
import { registerSupportProviders } from './support/index.js'
import { registerProjectManagementProviders } from './project-management/index.js'
import { registerEcommerceProviders } from './ecommerce/index.js'
import { registerDevelopmentProviders } from './development/index.js'
import { registerFormsProviders } from './forms/index.js'
import { registerAnalyticsProviders } from './analytics/index.js'
import { registerVideoConferencingProviders } from './video-conferencing/index.js'
import { registerCalendarProviders } from './calendar/index.js'
import { registerStorageProviders } from './storage/index.js'


/**
 * Register all built-in providers in the global registry
 */
export function registerAllProviders(): void {
  registerEmailProviders()
  registerMessagingProviders()
  registerSpreadsheetProviders()
  registerMediaProviders()
  registerTaskProviders()
  registerFinanceProviders()
  registerKnowledgeProviders()
  registerSupportProviders()
  registerProjectManagementProviders()
  registerCRMProviders()
  registerEcommerceProviders()
  registerDevelopmentProviders()
  registerFormsProviders()
  registerAnalyticsProviders()
  registerVideoConferencingProviders()
  registerCalendarProviders()
  registerStorageProviders()
}

/**
 * All providers by category (single-word identifiers)
 */
export const allProviders = {
  // Message category (email, messaging)
  email: ['email.sendgrid', 'email.resend'],
  messaging: ['messaging.slack', 'messaging.twilio-sms'],

  // Productivity
  calendar: ['calendar.google-calendar', 'calendar.cal-com'],
  task: ['task.todoist'],

  // Project management & Code
  project: ['project.linear'],
  code: ['code.github'],

  // Business
  sales: ['sales.hubspot'],
  finance: ['finance.stripe'],
  support: ['support.zendesk'],
  commerce: ['commerce.shopify'],

  // Content
  knowledge: ['knowledge.notion'],
  media: ['media.cloudinary'],
  form: ['form.typeform'],
  analytics: ['analytics.mixpanel'],

  // Office suite
  document: [], // TODO: Google Docs, Office365, Markdown providers
  spreadsheet: ['spreadsheet.xlsx', 'spreadsheet.google-sheets'],
  presentation: [], // TODO: Google Slides, PowerPoint providers

  // Communication
  meeting: [
    'meeting.zoom',
    'meeting.google-meet',
    'meeting.teams',
    'meeting.jitsi',
  ],

  // Infrastructure
  storage: ['storage.s3'],

  // Signature (e-sign)
  signature: [], // TODO: DocuSign, DocuSeal providers
} as const
