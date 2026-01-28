/**
 * Communication Transports Bridge
 *
 * Connects digital-workers contact channels to digital-tools
 * communication providers (Message, Call).
 *
 * @packageDocumentation
 */

import type {
  Worker,
  Team,
  WorkerRef,
  Contacts,
  ContactChannel,
  NotifyActionData,
  AskActionData,
  ApproveActionData,
  NotifyResult,
  AskResult,
  ApprovalResult,
} from './types.js'

// =============================================================================
// Transport Types
// =============================================================================

/**
 * Communication transport - maps contact channels to delivery mechanisms
 */
export type Transport =
  | 'email' // Email transport (SendGrid, Resend, etc.)
  | 'sms' // SMS transport (Twilio, etc.)
  | 'voice' // Voice call transport (Vapi, Twilio, etc.)
  | 'slack' // Slack API
  | 'teams' // Microsoft Teams API
  | 'discord' // Discord API
  | 'whatsapp' // WhatsApp Business API
  | 'telegram' // Telegram Bot API
  | 'web' // Web push/in-app
  | 'webhook' // Generic webhook

/**
 * Transport configuration
 */
export interface TransportConfig {
  transport: Transport
  provider?: string // Specific provider (e.g., 'sendgrid', 'resend')
  apiKey?: string
  apiUrl?: string
  options?: Record<string, unknown>
}

/**
 * Message payload for transport
 */
export interface MessagePayload {
  // Addressing
  to: string | string[]
  from?: string
  replyTo?: string

  // Content
  subject?: string
  body: string
  html?: string

  // Metadata
  type: 'notification' | 'question' | 'approval'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  threadId?: string
  metadata?: Record<string, unknown>

  // Interactive (for questions/approvals)
  actions?: MessageAction[]
  schema?: unknown // SimpleSchema from ai-functions
  timeout?: number
}

/**
 * Interactive message action
 */
export interface MessageAction {
  id: string
  label: string
  style?: 'primary' | 'secondary' | 'danger'
  value?: unknown
}

/**
 * Transport delivery result
 */
export interface DeliveryResult {
  success: boolean
  transport: Transport
  messageId?: string
  error?: string
  metadata?: Record<string, unknown>
}

// =============================================================================
// Channel to Transport Mapping
// =============================================================================

/**
 * Map contact channel to transport
 */
export function channelToTransport(channel: ContactChannel): Transport {
  const mapping: Record<ContactChannel, Transport> = {
    email: 'email',
    slack: 'slack',
    teams: 'teams',
    discord: 'discord',
    phone: 'voice',
    sms: 'sms',
    whatsapp: 'whatsapp',
    telegram: 'telegram',
    web: 'web',
    api: 'webhook',
    webhook: 'webhook',
  }
  return mapping[channel] || 'webhook'
}

/**
 * Get available transports for a worker
 */
export function getWorkerTransports(worker: Worker): Transport[] {
  const transports: Transport[] = []
  const contacts = worker.contacts

  if (contacts.email) transports.push('email')
  if (contacts.slack) transports.push('slack')
  if (contacts.teams) transports.push('teams')
  if (contacts.discord) transports.push('discord')
  if (contacts.phone) transports.push('voice')
  if (contacts.sms) transports.push('sms')
  if (contacts.whatsapp) transports.push('whatsapp')
  if (contacts.telegram) transports.push('telegram')
  if (contacts.web) transports.push('web')
  if (contacts.webhook) transports.push('webhook')

  return transports
}

/**
 * Get team transports (union of all member transports + team contacts)
 */
export function getTeamTransports(team: Team): Transport[] {
  const transports = new Set<Transport>()

  // Add team-level contacts
  const contacts = team.contacts
  if (contacts?.['email']) transports.add('email')
  if (contacts?.['slack']) transports.add('slack')
  if (contacts?.['teams']) transports.add('teams')
  if (contacts?.['discord']) transports.add('discord')
  if (contacts?.['phone']) transports.add('voice')
  if (contacts?.['sms']) transports.add('sms')
  if (contacts?.['whatsapp']) transports.add('whatsapp')
  if (contacts?.['telegram']) transports.add('telegram')
  if (contacts?.['web']) transports.add('web')
  if (contacts?.['webhook']) transports.add('webhook')

  return Array.from(transports)
}

// =============================================================================
// Address Resolution
// =============================================================================

/**
 * Identifier for a communication address
 */
export interface Address {
  transport: Transport
  value: string
  name?: string
  metadata?: Record<string, unknown>
}

/**
 * Resolve contact to address
 */
export function resolveAddress(contacts: Contacts, channel: ContactChannel): Address | null {
  const contact = contacts[channel]
  if (!contact) return null

  const transport = channelToTransport(channel)

  if (typeof contact === 'string') {
    return { transport, value: contact }
  }

  // Handle structured contact types
  switch (channel) {
    case 'email':
      const emailContact = contact as { address: string; name?: string }
      return {
        transport,
        value: emailContact.address,
        ...(emailContact.name !== undefined && { name: emailContact.name }),
      }
    case 'phone':
    case 'sms':
    case 'whatsapp':
      const phoneContact = contact as { number: string }
      return { transport, value: phoneContact.number }
    case 'slack':
      const slackContact = contact as { user?: string; channel?: string; workspace?: string }
      return {
        transport,
        value: slackContact.user || slackContact.channel || '',
        metadata: { workspace: slackContact.workspace },
      }
    case 'teams':
      const teamsContact = contact as { user?: string; channel?: string; team?: string }
      return {
        transport,
        value: teamsContact.user || teamsContact.channel || '',
        metadata: { team: teamsContact.team },
      }
    case 'discord':
      const discordContact = contact as { user?: string; channel?: string; server?: string }
      return {
        transport,
        value: discordContact.user || discordContact.channel || '',
        metadata: { server: discordContact.server },
      }
    case 'telegram':
      const telegramContact = contact as { user?: string; chat?: string }
      return { transport, value: telegramContact.user || telegramContact.chat || '' }
    case 'web':
      const webContact = contact as { userId?: string; url?: string }
      return { transport, value: webContact.userId || '', metadata: { url: webContact.url } }
    case 'webhook':
      const webhookContact = contact as { url: string; secret?: string }
      return { transport, value: webhookContact.url, metadata: { secret: webhookContact.secret } }
    case 'api':
      const apiContact = contact as { endpoint: string; auth?: string }
      return { transport, value: apiContact.endpoint, metadata: { auth: apiContact.auth } }
    default:
      return null
  }
}

/**
 * Resolve all addresses for a worker
 */
export function resolveWorkerAddresses(worker: Worker): Address[] {
  const addresses: Address[] = []
  const channels: ContactChannel[] = [
    'email',
    'slack',
    'teams',
    'discord',
    'phone',
    'sms',
    'whatsapp',
    'telegram',
    'web',
    'api',
    'webhook',
  ]

  for (const channel of channels) {
    const address = resolveAddress(worker.contacts, channel)
    if (address) addresses.push(address)
  }

  return addresses
}

/**
 * Get primary address for a worker based on preferences
 */
export function getPrimaryAddress(worker: Worker): Address | null {
  const preferences = worker.preferences
  if (preferences?.primary) {
    return resolveAddress(worker.contacts, preferences.primary)
  }

  // Default priority: slack > email > teams > sms > phone
  const defaultPriority: ContactChannel[] = ['slack', 'email', 'teams', 'sms', 'phone']
  for (const channel of defaultPriority) {
    const address = resolveAddress(worker.contacts, channel)
    if (address) return address
  }

  // Fall back to any available
  const addresses = resolveWorkerAddresses(worker)
  return addresses[0] || null
}

// =============================================================================
// Transport Registry
// =============================================================================

/**
 * Transport handler function type
 */
export type TransportHandler = (
  payload: MessagePayload,
  config: TransportConfig
) => Promise<DeliveryResult>

/**
 * Transport registry
 */
const transportRegistry = new Map<Transport, TransportHandler>()

/**
 * Register a transport handler
 */
export function registerTransport(transport: Transport, handler: TransportHandler): void {
  transportRegistry.set(transport, handler)
}

/**
 * Get transport handler
 */
export function getTransportHandler(transport: Transport): TransportHandler | undefined {
  return transportRegistry.get(transport)
}

/**
 * Check if transport is registered
 */
export function hasTransport(transport: Transport): boolean {
  return transportRegistry.has(transport)
}

/**
 * List registered transports
 */
export function listTransports(): Transport[] {
  return Array.from(transportRegistry.keys())
}

// =============================================================================
// Default Transport Handlers (Stubs - implemented by providers)
// =============================================================================

/**
 * Send via transport
 */
export async function sendViaTransport(
  transport: Transport,
  payload: MessagePayload,
  config?: TransportConfig
): Promise<DeliveryResult> {
  const handler = transportRegistry.get(transport)
  if (!handler) {
    return {
      success: false,
      transport,
      error: `Transport '${transport}' not registered`,
    }
  }

  try {
    return await handler(payload, config || { transport })
  } catch (error) {
    return {
      success: false,
      transport,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Send to multiple transports (fan-out)
 */
export async function sendToMultipleTransports(
  transports: Transport[],
  payload: MessagePayload,
  configs?: Record<Transport, TransportConfig>
): Promise<DeliveryResult[]> {
  const results = await Promise.all(
    transports.map((transport) => sendViaTransport(transport, payload, configs?.[transport]))
  )
  return results
}

// =============================================================================
// Worker Action to Transport
// =============================================================================

/**
 * Build message payload from notify action
 */
export function buildNotifyPayload(action: NotifyActionData): MessagePayload {
  return {
    to: resolveActionTarget(action.object),
    body: action.message,
    type: 'notification',
    priority: action.priority || 'normal',
    ...(action.metadata !== undefined && { metadata: action.metadata }),
  }
}

/**
 * Build message payload from ask action
 */
export function buildAskPayload(action: AskActionData): MessagePayload {
  return {
    to: resolveActionTarget(action.object),
    body: action.question,
    type: 'question',
    ...(action.schema !== undefined && { schema: action.schema }),
    ...(action.timeout !== undefined && { timeout: action.timeout }),
    ...(action.metadata !== undefined && { metadata: action.metadata }),
  }
}

/**
 * Build message payload from approve action
 */
export function buildApprovePayload(action: ApproveActionData): MessagePayload {
  return {
    to: resolveActionTarget(action.object),
    body: action.request,
    type: 'approval',
    ...(action.timeout !== undefined && { timeout: action.timeout }),
    actions: [
      { id: 'approve', label: 'Approve', style: 'primary', value: true },
      { id: 'reject', label: 'Reject', style: 'danger', value: false },
    ],
    metadata: {
      ...action.metadata,
      context: action.context,
    },
  }
}

/**
 * Resolve action target to address string
 */
function resolveActionTarget(target: Worker | Team | WorkerRef | string): string {
  if (typeof target === 'string') return target
  if ('contacts' in target) {
    const address = getPrimaryAddress(target as Worker)
    return address?.value || target.id
  }
  return target.id
}

// =============================================================================
// Integration with digital-tools Message/Call types
// =============================================================================

/**
 * Message type mapping (from digital-tools)
 */
export const MessageTypeMapping = {
  email: 'email',
  sms: 'text',
  slack: 'chat',
  teams: 'chat',
  discord: 'chat',
  whatsapp: 'text',
  telegram: 'text',
  voice: 'voicemail', // For voicemail messages
} as const

/**
 * Call type mapping (from digital-tools)
 */
export const CallTypeMapping = {
  phone: 'phone',
  voice: 'phone',
  web: 'web',
  video: 'video',
} as const

/**
 * Convert worker notification to digital-tools Message format
 */
export function toDigitalToolsMessage(
  payload: MessagePayload,
  transport: Transport
): Record<string, unknown> {
  const messageType = MessageTypeMapping[transport as keyof typeof MessageTypeMapping] || 'chat'

  return {
    type: messageType,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    from: payload.from,
    subject: payload.subject,
    body: payload.body,
    html: payload.html,
    metadata: {
      ...payload.metadata,
      workerActionType: payload.type,
      priority: payload.priority,
    },
  }
}

/**
 * Convert digital-tools Message to worker notification format
 */
export function fromDigitalToolsMessage(message: Record<string, unknown>): Partial<MessagePayload> {
  const to = message['to'] as string | string[]
  const from = message['from'] as string | undefined
  const subject = message['subject'] as string | undefined
  const body = message['body'] as string
  const html = message['html'] as string | undefined
  const metadata = message['metadata'] as Record<string, unknown> | undefined
  return {
    to,
    body,
    ...(from !== undefined && { from }),
    ...(subject !== undefined && { subject }),
    ...(html !== undefined && { html }),
    ...(metadata !== undefined && { metadata }),
  }
}
