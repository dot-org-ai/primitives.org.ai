/**
 * Email Transport Adapter for digital-workers
 *
 * Implements the transport interface for sending notifications, approval requests,
 * and handling email replies. Designed primarily for Resend but with a
 * provider-agnostic interface.
 *
 * @packageDocumentation
 */

import type {
  Transport,
  TransportConfig,
  MessagePayload,
  DeliveryResult,
  TransportHandler,
} from '../transports.js'
import { registerTransport } from '../transports.js'
import type { WorkerRef, ApprovalResult, ContactChannel } from '../types.js'
import { generateRequestId } from '../utils/id.js'

// =============================================================================
// Email Provider Interface (Provider-Agnostic)
// =============================================================================

/**
 * Email message to be sent
 */
export interface EmailMessage {
  /** Recipient email address(es) */
  to: string | string[]
  /** Sender email address */
  from: string
  /** Reply-to address */
  replyTo?: string
  /** Email subject line */
  subject: string
  /** Plain text body */
  text?: string
  /** HTML body */
  html?: string
  /** Custom headers */
  headers?: Record<string, string>
  /** Attachments */
  attachments?: EmailAttachment[]
  /** Tags for categorization */
  tags?: EmailTag[]
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  /** Filename */
  filename: string
  /** Content as base64 or Buffer */
  content: string | ArrayBuffer
  /** MIME type */
  contentType?: string
}

/**
 * Email tag for categorization
 */
export interface EmailTag {
  /** Tag name */
  name: string
  /** Tag value */
  value: string
}

/**
 * Result of sending an email
 */
export interface EmailSendResult {
  /** Whether the send was successful */
  success: boolean
  /** Provider-specific message ID */
  messageId?: string
  /** Error message if failed */
  error?: string
  /** Raw provider response */
  raw?: unknown
}

/**
 * Email provider interface - implement this for different email services
 */
export interface EmailProvider {
  /** Provider name (e.g., 'resend', 'sendgrid', 'ses') */
  name: string
  /** Send an email */
  send(message: EmailMessage): Promise<EmailSendResult>
  /** Verify the provider is configured correctly */
  verify?(): Promise<boolean>
}

// =============================================================================
// Email Transport Configuration
// =============================================================================

/**
 * Email transport configuration
 */
export interface EmailTransportConfig extends TransportConfig {
  transport: 'email'
  /** Email provider to use */
  provider?: 'resend' | 'sendgrid' | 'ses' | 'smtp' | 'custom'
  /** API key for the provider */
  apiKey?: string
  /** API URL (for custom providers) */
  apiUrl?: string
  /** Default sender address */
  from?: string
  /** Default reply-to address */
  replyTo?: string
  /** Base URL for approval links */
  approvalBaseUrl?: string
  /** Custom email provider instance */
  customProvider?: EmailProvider
  /** Template options */
  templates?: EmailTemplateOptions
}

/**
 * Template customization options
 */
export interface EmailTemplateOptions {
  /** Custom CSS styles */
  styles?: string
  /** Company/product name */
  brandName?: string
  /** Logo URL */
  logoUrl?: string
  /** Primary brand color */
  primaryColor?: string
  /** Footer text */
  footerText?: string
}

// =============================================================================
// Approval Request/Response Types
// =============================================================================

/**
 * Approval request data encoded in email
 */
export interface ApprovalRequestData {
  /** Unique approval request ID */
  requestId: string
  /** What is being requested */
  request: string
  /** Who initiated the request */
  requestedBy?: WorkerRef | string
  /** Additional context */
  context?: Record<string, unknown>
  /** Expiration timestamp */
  expiresAt?: number
  /** Callback URL for webhook notifications */
  callbackUrl?: string
}

/**
 * Parsed email reply for approval
 */
export interface ParsedEmailReply {
  /** Whether this is an approval response */
  isApprovalResponse: boolean
  /** The decision */
  approved?: boolean
  /** The approval request ID */
  requestId?: string
  /** Any notes/comments from the approver */
  notes?: string
  /** Who replied */
  from?: string
  /** When they replied */
  repliedAt?: Date
  /** Raw email content */
  rawContent?: string
}

/**
 * Inbound email for parsing
 */
export interface InboundEmail {
  /** Sender address */
  from: string
  /** Recipient address */
  to: string | string[]
  /** Email subject */
  subject: string
  /** Plain text body */
  text?: string
  /** HTML body */
  html?: string
  /** In-Reply-To header */
  inReplyTo?: string
  /** References header */
  references?: string
  /** Custom headers */
  headers?: Record<string, string>
}

// =============================================================================
// Resend Provider Implementation
// =============================================================================

/**
 * Resend email provider
 *
 * @example
 * ```ts
 * const resend = createResendProvider({ apiKey: 'your-api-key' })
 * const transport = new EmailTransport({ provider: resend })
 * ```
 */
export function createResendProvider(config: { apiKey: string; apiUrl?: string }): EmailProvider {
  const apiUrl = config.apiUrl || 'https://api.resend.com'

  return {
    name: 'resend',

    async send(message: EmailMessage): Promise<EmailSendResult> {
      try {
        const response = await fetch(`${apiUrl}/emails`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: message.from,
            to: Array.isArray(message.to) ? message.to : [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            reply_to: message.replyTo,
            headers: message.headers,
            tags: message.tags,
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: response.statusText }))
          return {
            success: false,
            error: (error as { message?: string }).message || 'Failed to send email',
            raw: error,
          }
        }

        const result = (await response.json()) as { id?: string }
        const sendResult: EmailSendResult = {
          success: true,
          raw: result,
        }
        if (result.id) {
          sendResult.messageId = result.id
        }
        return sendResult
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },

    async verify(): Promise<boolean> {
      try {
        const response = await fetch(`${apiUrl}/domains`, {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
        })
        return response.ok
      } catch {
        return false
      }
    },
  }
}

// =============================================================================
// Email Templates
// =============================================================================

/**
 * Default CSS styles for email templates
 */
const DEFAULT_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }
  .container {
    background: #ffffff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 24px;
  }
  .header {
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .header h1 {
    margin: 0;
    font-size: 20px;
    color: #111;
  }
  .content {
    margin-bottom: 24px;
  }
  .content p {
    margin: 0 0 16px;
  }
  .context {
    background: #f9f9f9;
    border-radius: 6px;
    padding: 16px;
    margin: 16px 0;
  }
  .context-item {
    display: flex;
    margin-bottom: 8px;
  }
  .context-label {
    font-weight: 600;
    min-width: 120px;
    color: #666;
  }
  .actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }
  .btn {
    display: inline-block;
    padding: 12px 24px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    text-align: center;
  }
  .btn-primary {
    background: #0066cc;
    color: #ffffff;
  }
  .btn-danger {
    background: #dc3545;
    color: #ffffff;
  }
  .btn-secondary {
    background: #6c757d;
    color: #ffffff;
  }
  .footer {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e5e5e5;
    font-size: 12px;
    color: #666;
  }
  .reply-instructions {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 6px;
    padding: 12px;
    margin-top: 16px;
    font-size: 13px;
  }
`

/**
 * Generate notification email HTML
 */
export function generateNotificationEmail(
  message: string,
  options: {
    subject?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    metadata?: Record<string, unknown>
    templates?: EmailTemplateOptions
  } = {}
): { subject: string; html: string; text: string } {
  const priority = options.priority ?? 'normal'
  const metadata = options.metadata
  const templates = options.templates ?? {}
  const styles = templates.styles || DEFAULT_STYLES
  const brandName = templates.brandName || 'Digital Workers'
  const footerText = templates.footerText || 'Sent via Digital Workers notification system'

  const priorityBadge =
    priority === 'urgent' || priority === 'high'
      ? `<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">${priority.toUpperCase()}</span>`
      : ''

  const subject =
    options.subject || `[${brandName}] Notification${priority === 'urgent' ? ' - URGENT' : ''}`

  const contextHtml = metadata
    ? `
    <div class="context">
      ${Object.entries(metadata)
        .map(
          ([key, value]) =>
            `<div class="context-item"><span class="context-label">${key}:</span><span>${String(
              value
            )}</span></div>`
        )
        .join('')}
    </div>
  `
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Notification${priorityBadge}</h1>
    </div>
    <div class="content">
      <p>${escapeHtml(message)}</p>
      ${contextHtml}
    </div>
    <div class="footer">
      <p>${footerText}</p>
    </div>
  </div>
</body>
</html>
`

  const text = `${brandName} Notification\n\n${message}\n\n${
    metadata
      ? Object.entries(metadata)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      : ''
  }\n\n${footerText}`

  return { subject, html, text }
}

/**
 * Generate approval request email HTML
 */
export function generateApprovalEmail(
  request: string,
  requestData: ApprovalRequestData,
  options: {
    approveUrl?: string
    rejectUrl?: string
    templates?: EmailTemplateOptions
  } = {}
): { subject: string; html: string; text: string } {
  const { approveUrl, rejectUrl } = options
  const templates = options.templates ?? {}
  const styles = templates.styles || DEFAULT_STYLES
  const brandName = templates.brandName || 'Digital Workers'
  const footerText = templates.footerText || 'Sent via Digital Workers approval system'

  const subject = `[${brandName}] Approval Required: ${truncate(request, 50)}`

  const contextHtml = requestData.context
    ? `
    <div class="context">
      <strong>Additional Context:</strong>
      ${Object.entries(requestData.context)
        .map(
          ([key, value]) =>
            `<div class="context-item"><span class="context-label">${key}:</span><span>${String(
              value
            )}</span></div>`
        )
        .join('')}
    </div>
  `
    : ''

  const actionsHtml =
    approveUrl && rejectUrl
      ? `
    <div class="actions">
      <a href="${approveUrl}" class="btn btn-primary">Approve</a>
      <a href="${rejectUrl}" class="btn btn-danger">Reject</a>
    </div>
  `
      : ''

  const replyInstructions = `
    <div class="reply-instructions">
      <strong>Reply via Email:</strong> You can also respond by replying to this email with:
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li><strong>APPROVED</strong> - to approve this request</li>
        <li><strong>REJECTED</strong> - to reject this request</li>
      </ul>
      Add any notes after your decision.
    </div>
  `

  const expiresHtml = requestData.expiresAt
    ? `<p style="color: #dc3545; font-size: 13px;">This request expires at ${new Date(
        requestData.expiresAt
      ).toLocaleString()}</p>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Approval Required</h1>
    </div>
    <div class="content">
      <p><strong>Request:</strong></p>
      <p>${escapeHtml(request)}</p>
      ${contextHtml}
      ${expiresHtml}
      ${actionsHtml}
      ${replyInstructions}
    </div>
    <div class="footer">
      <p>${footerText}</p>
      <p style="font-size: 10px; color: #999;">Request ID: ${requestData.requestId}</p>
    </div>
  </div>
</body>
</html>
`

  const text = `${brandName} - Approval Required

Request: ${request}

${
  requestData.context
    ? Object.entries(requestData.context)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : ''
}

To respond, reply to this email with:
- APPROVED - to approve this request
- REJECTED - to reject this request

Add any notes after your decision.

${
  requestData.expiresAt
    ? `This request expires at ${new Date(requestData.expiresAt).toLocaleString()}`
    : ''
}

${footerText}
Request ID: ${requestData.requestId}`

  return { subject, html, text }
}

// =============================================================================
// Email Reply Parser
// =============================================================================

/**
 * Parse an email reply for approval response
 */
export function parseApprovalReply(email: InboundEmail): ParsedEmailReply {
  const content = email.text || stripHtml(email.html || '')
  const contentLower = content.toLowerCase().trim()

  // Extract request ID from subject or references
  const requestIdMatch =
    email.subject?.match(/Request ID:\s*([a-zA-Z0-9_-]+)/i) ||
    content.match(/Request ID:\s*([a-zA-Z0-9_-]+)/i)

  // Check for approval/rejection keywords
  const approvedPatterns = [/^approved\b/i, /\bapprove\b/i, /\byes\b/i, /\blgtm\b/i, /\bok\b/i]
  const rejectedPatterns = [/^rejected\b/i, /\breject\b/i, /\bno\b/i, /\bdeny\b/i, /\bdecline\b/i]

  // Get the first meaningful line (skip quoted content)
  const lines = content.split('\n').filter((line) => !line.startsWith('>') && line.trim())
  const firstLine = lines[0] || ''
  const firstLineLower = firstLine.toLowerCase().trim()

  let isApprovalResponse = false
  let approved: boolean | undefined

  // Check first line for explicit approval/rejection
  for (const pattern of approvedPatterns) {
    if (pattern.test(firstLineLower)) {
      isApprovalResponse = true
      approved = true
      break
    }
  }

  if (!isApprovalResponse) {
    for (const pattern of rejectedPatterns) {
      if (pattern.test(firstLineLower)) {
        isApprovalResponse = true
        approved = false
        break
      }
    }
  }

  // Extract notes (everything after the decision keyword)
  let notes: string | undefined
  if (isApprovalResponse && lines.length > 1) {
    notes = lines.slice(1).join('\n').trim()
  } else if (isApprovalResponse) {
    // Notes might be on the same line after the keyword
    const keywordMatch = firstLine.match(
      /^(approved|rejected|approve|reject|yes|no|lgtm|ok)\b[:\s]*(.*)/i
    )
    if (keywordMatch && keywordMatch[2]) {
      notes = keywordMatch[2].trim()
    }
  }

  // Build result with only defined properties
  const result: ParsedEmailReply = {
    isApprovalResponse,
    from: email.from,
    repliedAt: new Date(),
    rawContent: content,
  }

  if (approved !== undefined) {
    result.approved = approved
  }
  if (requestIdMatch?.[1]) {
    result.requestId = requestIdMatch[1]
  }
  if (notes) {
    result.notes = notes
  }

  return result
}

// =============================================================================
// EmailTransport Class
// =============================================================================

/**
 * Email transport for digital-workers notifications and approvals
 *
 * @example
 * ```ts
 * // Create with Resend
 * const transport = new EmailTransport({
 *   apiKey: process.env.RESEND_API_KEY,
 *   from: 'notifications@example.com',
 *   approvalBaseUrl: 'https://app.example.com/approvals',
 * })
 *
 * // Send notification
 * await transport.sendNotification({
 *   to: 'user@example.com',
 *   message: 'Deployment completed',
 *   priority: 'normal',
 * })
 *
 * // Send approval request
 * await transport.sendApprovalRequest({
 *   to: 'manager@example.com',
 *   request: 'Expense: $500 for cloud services',
 *   requestId: 'apr_123',
 *   context: { amount: 500, category: 'Infrastructure' },
 * })
 * ```
 */
export class EmailTransport {
  private provider: EmailProvider
  private config: EmailTransportConfig

  constructor(config: EmailTransportConfig) {
    this.config = config

    // Initialize provider
    if (config.customProvider) {
      this.provider = config.customProvider
    } else if (config.apiKey) {
      // Default to Resend
      const providerConfig: { apiKey: string; apiUrl?: string } = {
        apiKey: config.apiKey,
      }
      if (config.apiUrl) {
        providerConfig.apiUrl = config.apiUrl
      }
      this.provider = createResendProvider(providerConfig)
    } else {
      throw new Error('Email transport requires either apiKey or customProvider')
    }
  }

  /**
   * Get the underlying email provider
   */
  getProvider(): EmailProvider {
    return this.provider
  }

  /**
   * Get the transport configuration
   */
  getConfig(): EmailTransportConfig {
    return this.config
  }

  /**
   * Send a notification email
   */
  async sendNotification(options: {
    to: string | string[]
    message: string
    subject?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    metadata?: Record<string, unknown>
    from?: string
    replyTo?: string
  }): Promise<DeliveryResult> {
    const templateOptions: {
      subject?: string
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      metadata?: Record<string, unknown>
      templates?: EmailTemplateOptions
    } = {}

    if (options.subject) {
      templateOptions.subject = options.subject
    }
    if (options.priority) {
      templateOptions.priority = options.priority
    }
    if (options.metadata) {
      templateOptions.metadata = options.metadata
    }
    if (this.config.templates) {
      templateOptions.templates = this.config.templates
    }

    const { subject, html, text } = generateNotificationEmail(options.message, templateOptions)

    const emailMessage: EmailMessage = {
      to: options.to,
      from: options.from || this.config.from || 'notifications@example.com',
      subject,
      html,
      text,
      tags: [
        { name: 'type', value: 'notification' },
        { name: 'priority', value: options.priority || 'normal' },
      ],
    }

    const replyTo = options.replyTo || this.config.replyTo
    if (replyTo) {
      emailMessage.replyTo = replyTo
    }

    const result = await this.provider.send(emailMessage)

    const deliveryResult: DeliveryResult = {
      success: result.success,
      transport: 'email',
      metadata: { provider: this.provider.name, raw: result.raw },
    }

    if (result.messageId) {
      deliveryResult.messageId = result.messageId
    }
    if (result.error) {
      deliveryResult.error = result.error
    }

    return deliveryResult
  }

  /**
   * Send an approval request email
   */
  async sendApprovalRequest(options: {
    to: string | string[]
    request: string
    requestId: string
    requestedBy?: WorkerRef | string
    context?: Record<string, unknown>
    expiresAt?: Date | number
    callbackUrl?: string
    from?: string
    replyTo?: string
  }): Promise<DeliveryResult> {
    const requestData: ApprovalRequestData = {
      requestId: options.requestId,
      request: options.request,
    }

    if (options.requestedBy) {
      requestData.requestedBy = options.requestedBy
    }
    if (options.context) {
      requestData.context = options.context
    }
    if (options.expiresAt) {
      requestData.expiresAt =
        options.expiresAt instanceof Date ? options.expiresAt.getTime() : options.expiresAt
    }
    if (options.callbackUrl) {
      requestData.callbackUrl = options.callbackUrl
    }

    // Generate approval/reject URLs if base URL is configured
    let approveUrl: string | undefined
    let rejectUrl: string | undefined

    if (this.config.approvalBaseUrl) {
      const baseUrl = this.config.approvalBaseUrl.replace(/\/$/, '')
      approveUrl = `${baseUrl}/${options.requestId}/approve`
      rejectUrl = `${baseUrl}/${options.requestId}/reject`
    }

    const templateOptions: {
      approveUrl?: string
      rejectUrl?: string
      templates?: EmailTemplateOptions
    } = {}

    if (approveUrl) {
      templateOptions.approveUrl = approveUrl
    }
    if (rejectUrl) {
      templateOptions.rejectUrl = rejectUrl
    }
    if (this.config.templates) {
      templateOptions.templates = this.config.templates
    }

    const { subject, html, text } = generateApprovalEmail(
      options.request,
      requestData,
      templateOptions
    )

    const emailMessage: EmailMessage = {
      to: options.to,
      from: options.from || this.config.from || 'approvals@example.com',
      subject,
      html,
      text,
      headers: {
        'X-Approval-Request-Id': options.requestId,
      },
      tags: [
        { name: 'type', value: 'approval' },
        { name: 'request_id', value: options.requestId },
      ],
    }

    const replyTo = options.replyTo || this.config.replyTo
    if (replyTo) {
      emailMessage.replyTo = replyTo
    }

    const result = await this.provider.send(emailMessage)

    const deliveryMetadata: Record<string, unknown> = {
      provider: this.provider.name,
      requestId: options.requestId,
      raw: result.raw,
    }
    if (approveUrl) {
      deliveryMetadata['approveUrl'] = approveUrl
    }
    if (rejectUrl) {
      deliveryMetadata['rejectUrl'] = rejectUrl
    }

    const deliveryResult: DeliveryResult = {
      success: result.success,
      transport: 'email',
      metadata: deliveryMetadata,
    }

    if (result.messageId) {
      deliveryResult.messageId = result.messageId
    }
    if (result.error) {
      deliveryResult.error = result.error
    }

    return deliveryResult
  }

  /**
   * Parse an email reply for approval response
   */
  parseReply(email: InboundEmail): ParsedEmailReply {
    return parseApprovalReply(email)
  }

  /**
   * Convert parsed reply to ApprovalResult
   */
  toApprovalResult(reply: ParsedEmailReply, approver?: WorkerRef): ApprovalResult {
    const result: ApprovalResult = {
      approved: reply.approved ?? false,
      via: 'email' as ContactChannel,
    }

    if (approver) {
      result.approvedBy = approver
    } else if (reply.from) {
      result.approvedBy = { id: reply.from }
    }

    if (reply.repliedAt) {
      result.approvedAt = reply.repliedAt
    }

    if (reply.notes) {
      result.notes = reply.notes
    }

    return result
  }

  /**
   * Create transport handler for registration
   */
  createHandler(): TransportHandler {
    return async (payload: MessagePayload, _config: TransportConfig): Promise<DeliveryResult> => {
      const to = Array.isArray(payload.to) ? payload.to : [payload.to]

      if (payload.type === 'notification') {
        const notifyOptions: {
          to: string[]
          message: string
          subject?: string
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          metadata?: Record<string, unknown>
          from?: string
          replyTo?: string
        } = {
          to,
          message: payload.body,
        }

        if (payload.subject) {
          notifyOptions.subject = payload.subject
        }
        if (payload.priority) {
          notifyOptions.priority = payload.priority
        }
        if (payload.metadata) {
          notifyOptions.metadata = payload.metadata
        }
        if (payload.from) {
          notifyOptions.from = payload.from
        }
        if (payload.replyTo) {
          notifyOptions.replyTo = payload.replyTo
        }

        return this.sendNotification(notifyOptions)
      }

      if (payload.type === 'approval') {
        const requestId = (payload.metadata?.['requestId'] as string) || generateRequestId('apr')

        const approvalOptions: {
          to: string[]
          request: string
          requestId: string
          context?: Record<string, unknown>
          from?: string
          replyTo?: string
        } = {
          to,
          request: payload.body,
          requestId,
        }

        if (payload.metadata) {
          approvalOptions.context = payload.metadata
        }
        if (payload.from) {
          approvalOptions.from = payload.from
        }
        if (payload.replyTo) {
          approvalOptions.replyTo = payload.replyTo
        }

        return this.sendApprovalRequest(approvalOptions)
      }

      // Default: send as notification
      const defaultOptions: {
        to: string[]
        message: string
        subject?: string
        metadata?: Record<string, unknown>
        from?: string
        replyTo?: string
      } = {
        to,
        message: payload.body,
      }

      if (payload.subject) {
        defaultOptions.subject = payload.subject
      }
      if (payload.metadata) {
        defaultOptions.metadata = payload.metadata
      }
      if (payload.from) {
        defaultOptions.from = payload.from
      }
      if (payload.replyTo) {
        defaultOptions.replyTo = payload.replyTo
      }

      return this.sendNotification(defaultOptions)
    }
  }

  /**
   * Register this transport with the transport registry
   */
  register(): void {
    registerTransport('email', this.createHandler())
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an email transport with Resend
 */
export function createEmailTransport(
  config: Omit<EmailTransportConfig, 'transport'>
): EmailTransport {
  return new EmailTransport({ ...config, transport: 'email' })
}

/**
 * Create an email transport with a custom provider
 */
export function createEmailTransportWithProvider(
  provider: EmailProvider,
  config?: Partial<Omit<EmailTransportConfig, 'transport' | 'customProvider'>>
): EmailTransport {
  return new EmailTransport({
    transport: 'email',
    customProvider: provider,
    ...config,
  })
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return (
    html
      // Add newlines before block elements
      .replace(/<(p|div|br|li|h[1-6]|tr)[^>]*>/gi, '\n')
      // Remove all HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      // Normalize whitespace
      .replace(/\n\s*\n/g, '\n')
      .trim()
  )
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an object is an EmailTransportConfig
 */
export function isEmailTransportConfig(config: unknown): config is EmailTransportConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    (config as TransportConfig).transport === 'email'
  )
}

/**
 * Check if a parsed reply indicates approval
 */
export function isApproved(reply: ParsedEmailReply): boolean {
  return reply.isApprovalResponse && reply.approved === true
}

/**
 * Check if a parsed reply indicates rejection
 */
export function isRejected(reply: ParsedEmailReply): boolean {
  return reply.isApprovalResponse && reply.approved === false
}
