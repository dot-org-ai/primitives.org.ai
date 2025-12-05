/**
 * digital-tools - Tools that can be used by both humans and AI agents
 *
 * This package provides:
 * - Core Tool interface and types
 * - Tool ontology/categories for organization
 * - Tool registry for registration and discovery
 * - Tool definition helpers with type safety
 * - Common pre-built tool implementations
 * - MCP (Model Context Protocol) compatibility
 *
 * @packageDocumentation
 */

// Export all types
export type * from './types.js'

// Re-export AnyTool as a convenience value export
export type { AnyTool, Tool, ToolCategory, ToolSubcategory, ToolRegistry } from './types.js'

// Export entity type definitions (Nouns for digital tools)
export {
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

  // Team Messaging (Slack/Teams/Discord equivalent)
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

  // Collections
  DigitalToolEntities,
  DigitalToolCategories,
} from './entities.js'

// Export registry
export {
  registry,
  createRegistry,
  registerTool,
  getTool,
  executeTool,
  toMCP,
  listMCPTools,
} from './registry.js'

// Export tool definition helpers
export {
  defineTool,
  defineAndRegister,
  createToolExecutor,
  toolBuilder,
} from './define.js'

// Export pre-built tools
export {
  // Web tools
  fetchUrl,
  parseHtml,
  readUrl,
  webTools,

  // Data tools
  parseJson,
  stringifyJson,
  parseCsv,
  transformData,
  filterData,
  dataTools,

  // Communication tools
  sendEmail,
  sendSlackMessage,
  sendNotification,
  sendSms,
  communicationTools,
} from './tools/index.js'

// Export providers (concrete implementations using third-party APIs)
export {
  // Provider types and registry
  type EmailProvider,
  type MessagingProvider,
  type SmsProvider,
  type SpreadsheetProvider,
  type DocumentProvider,
  type PresentationProvider,
  type PhoneProvider,
  type ProviderConfig,
  type ProviderInfo,
  type ProviderCategory,
  type BaseProvider,

  // Provider registry
  providerRegistry,
  createProviderRegistry,
  registerProvider,
  getProvider,
  createProvider,
  listProviders,
  defineProvider,

  // Email providers
  sendgridProvider,
  resendProvider,
  createSendGridProvider,
  createResendProvider,

  // Messaging providers
  slackProvider,
  twilioSmsProvider,
  createSlackProvider,
  createTwilioSmsProvider,

  // Spreadsheet providers
  xlsxProvider,
  googleSheetsProvider,
  createXlsxProvider,
  createGoogleSheetsProvider,

  // Registration helpers
  registerAllProviders,
  registerEmailProviders,
  registerMessagingProviders,
  registerSpreadsheetProviders,
  allProviders,
} from './providers/index.js'

// Convenience function to register all built-in tools
import { registry } from './registry.js'
import { webTools } from './tools/web.js'
import { dataTools } from './tools/data.js'
import { communicationTools } from './tools/communication.js'

/**
 * Register all built-in tools in the global registry
 */
export function registerBuiltinTools(): void {
  for (const tool of [...webTools, ...dataTools, ...communicationTools]) {
    registry.register(tool)
  }
}

/**
 * Get all built-in tools
 */
export function getBuiltinTools() {
  return [...webTools, ...dataTools, ...communicationTools]
}
