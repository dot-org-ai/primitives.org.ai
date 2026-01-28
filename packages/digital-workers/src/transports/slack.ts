/**
 * Slack Transport Adapter for Digital Workers
 *
 * Provides Slack-based communication for worker notifications, questions,
 * and approval workflows using the Slack Web API and Block Kit.
 *
 * Features:
 * - Send notifications to channels (#channel) and DMs (@user)
 * - Rich message formatting with Block Kit
 * - Interactive button components for approvals
 * - Webhook handling for button interactions
 * - Request signature verification
 *
 * @packageDocumentation
 */

import type {
  Transport,
  TransportConfig,
  MessagePayload,
  MessageAction,
  DeliveryResult,
  TransportHandler,
} from '../transports.js'
import { registerTransport } from '../transports.js'
import type { Logger } from '../logger.js'
import { noopLogger } from '../logger.js'
import { generateRequestId } from '../utils/id.js'

// =============================================================================
// Crypto Functions for Signature Verification
// =============================================================================

/**
 * Compute HMAC-SHA256 and return the result as a hex string.
 * Uses the Web Crypto API which works in both Node.js and Cloudflare Workers.
 *
 * @param data - The data to sign
 * @param secret - The signing secret
 * @returns A hex-encoded HMAC-SHA256 hash
 */
export async function computeHmacSha256Hex(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()

  // Import the secret as a crypto key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign the data
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify a Slack request signature using HMAC-SHA256.
 * Uses the Web Crypto API which works in both Node.js and Cloudflare Workers.
 *
 * @param signature - The x-slack-signature header value (v0=...)
 * @param timestamp - The x-slack-request-timestamp header value
 * @param body - The raw request body
 * @param signingSecret - The Slack signing secret
 * @returns true if the signature is valid, false otherwise
 */
export async function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string,
  signingSecret: string
): Promise<boolean> {
  // Slack signatures have the format "v0=<hex>"
  if (!signature.startsWith('v0=')) {
    return false
  }

  // Compute the expected signature
  const baseString = `v0:${timestamp}:${body}`
  const expectedHmac = await computeHmacSha256Hex(baseString, signingSecret)
  const expectedSignature = `v0=${expectedHmac}`

  // Constant-time comparison to prevent timing attacks
  return secureCompare(signature, expectedSignature)
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal, false otherwise.
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// =============================================================================
// Slack API Types
// =============================================================================

/**
 * Slack transport configuration
 */
export interface SlackTransportConfig extends TransportConfig {
  transport: 'slack'
  /** Bot OAuth token (xoxb-...) */
  botToken: string
  /** Signing secret for webhook verification */
  signingSecret: string
  /** Optional app ID */
  appId?: string
  /** Optional default channel for notifications */
  defaultChannel?: string
  /** API base URL (for testing/enterprise) */
  apiUrl?: string
  /** Optional logger for error logging */
  logger?: Logger
}

/**
 * Slack Block Kit block types
 */
export type SlackBlockType =
  | 'section'
  | 'divider'
  | 'header'
  | 'context'
  | 'actions'
  | 'image'
  | 'input'

/**
 * Slack text object
 */
export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn'
  text: string
  emoji?: boolean
  verbatim?: boolean
}

/**
 * Slack button element
 */
export interface SlackButtonElement {
  type: 'button'
  text: SlackTextObject
  action_id: string
  value?: string
  style?: 'primary' | 'danger'
  url?: string
  confirm?: SlackConfirmDialog
}

/**
 * Slack confirm dialog
 */
export interface SlackConfirmDialog {
  title: SlackTextObject
  text: SlackTextObject
  confirm: SlackTextObject
  deny: SlackTextObject
  style?: 'primary' | 'danger'
}

/**
 * Slack section block
 */
export interface SlackSectionBlock {
  type: 'section'
  text?: SlackTextObject
  block_id?: string
  fields?: SlackTextObject[]
  accessory?: SlackButtonElement
}

/**
 * Slack divider block
 */
export interface SlackDividerBlock {
  type: 'divider'
  block_id?: string
}

/**
 * Slack header block
 */
export interface SlackHeaderBlock {
  type: 'header'
  text: SlackTextObject
  block_id?: string
}

/**
 * Slack context block
 */
export interface SlackContextBlock {
  type: 'context'
  elements: SlackTextObject[]
  block_id?: string
}

/**
 * Slack actions block
 */
export interface SlackActionsBlock {
  type: 'actions'
  elements: SlackButtonElement[]
  block_id?: string
}

/**
 * Union of all Slack block types
 */
export type SlackBlock =
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackHeaderBlock
  | SlackContextBlock
  | SlackActionsBlock

/**
 * Slack message payload
 */
export interface SlackMessage {
  channel: string
  text: string
  blocks?: SlackBlock[]
  thread_ts?: string
  reply_broadcast?: boolean
  unfurl_links?: boolean
  unfurl_media?: boolean
  metadata?: {
    event_type: string
    event_payload: Record<string, unknown>
  }
}

/**
 * Slack API response
 */
export interface SlackApiResponse<T = unknown> {
  ok: boolean
  error?: string
  warning?: string
  response_metadata?: {
    scopes?: string[]
    acceptedScopes?: string[]
    warnings?: string[]
  }
  ts?: string
  channel?:
    | string
    | {
        id: string
        name?: string
        is_channel?: boolean
        is_group?: boolean
        is_im?: boolean
        is_mpim?: boolean
        is_private?: boolean
        is_member?: boolean
      }
  message?: T
}

/**
 * Slack post message response
 */
export interface SlackPostMessageResponse extends SlackApiResponse {
  ts: string
  channel: string
  message: {
    type: string
    subtype?: string
    text: string
    ts: string
    username?: string
    bot_id?: string
    blocks?: SlackBlock[]
  }
}

/**
 * Slack user info response
 */
export interface SlackUserInfoResponse extends SlackApiResponse {
  user: {
    id: string
    team_id: string
    name: string
    real_name: string
    profile: {
      email?: string
      display_name?: string
    }
    is_bot: boolean
  }
}

/**
 * Slack conversation info response
 */
export interface SlackConversationInfoResponse extends SlackApiResponse {
  channel: {
    id: string
    name: string
    is_channel: boolean
    is_group: boolean
    is_im: boolean
    is_mpim: boolean
    is_private: boolean
    is_member: boolean
  }
}

/**
 * Slack interaction payload (from button clicks, etc.)
 */
export interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | 'view_closed' | 'shortcut'
  team: {
    id: string
    domain: string
  }
  user: {
    id: string
    username: string
    name: string
    team_id: string
  }
  channel?: {
    id: string
    name: string
  }
  message?: {
    type: string
    ts: string
    text: string
    blocks?: SlackBlock[]
  }
  container?: {
    type: string
    message_ts: string
    channel_id: string
  }
  actions?: SlackActionPayload[]
  response_url: string
  trigger_id: string
  api_app_id: string
  token: string // Deprecated but still sent
}

/**
 * Slack action payload (button click data)
 */
export interface SlackActionPayload {
  type: 'button'
  action_id: string
  block_id: string
  value: string
  action_ts: string
}

/**
 * Webhook request for signature verification
 */
export interface SlackWebhookRequest {
  headers: {
    'x-slack-signature': string
    'x-slack-request-timestamp': string
    [key: string]: string
  }
  body: string | SlackInteractionPayload
  rawBody?: string
}

/**
 * Webhook handler result
 */
export interface WebhookHandlerResult {
  success: boolean
  actionId?: string
  userId?: string
  channelId?: string
  messageTs?: string
  value?: unknown
  error?: string
}

// =============================================================================
// SlackTransport Class
// =============================================================================

/**
 * Slack Transport for digital-workers communication
 *
 * @example
 * ```ts
 * const slack = new SlackTransport({
 *   botToken: process.env.SLACK_BOT_TOKEN!,
 *   signingSecret: process.env.SLACK_SIGNING_SECRET!,
 * })
 *
 * // Send notification to a channel
 * await slack.sendNotification('#engineering', 'Deployment complete!')
 *
 * // Send approval request
 * const result = await slack.sendApprovalRequest('@alice', 'Approve deployment?', {
 *   context: { version: '2.1.0' },
 * })
 *
 * // Handle webhook
 * app.post('/slack/events', async (req, res) => {
 *   const result = await slack.handleWebhook(req)
 *   res.json({ ok: result.success })
 * })
 * ```
 */
export class SlackTransport {
  private config: SlackTransportConfig
  private apiBaseUrl: string
  private logger: Logger

  constructor(config: Omit<SlackTransportConfig, 'transport'>) {
    this.config = {
      ...config,
      transport: 'slack',
    }
    this.apiBaseUrl = config.apiUrl || 'https://slack.com/api'
    this.logger = config.logger ?? noopLogger
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Send a notification message
   *
   * @param target - Channel (#channel) or user (@user or user ID)
   * @param message - Message text
   * @param options - Additional message options
   */
  async sendNotification(
    target: string,
    message: string,
    options: {
      threadTs?: string
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<DeliveryResult> {
    try {
      const channel = await this.resolveTarget(target)
      const blocks = this.formatNotificationBlocks(message, options)

      const thread_ts = options.threadTs
      const metadata = options.metadata
        ? {
            event_type: 'notification',
            event_payload: options.metadata,
          }
        : undefined

      const response = await this.postMessage({
        channel,
        text: message,
        blocks,
        ...(thread_ts !== undefined && { thread_ts }),
        ...(metadata !== undefined && { metadata }),
      })

      return {
        success: response.ok,
        transport: 'slack',
        messageId: response.ts,
        metadata: {
          channel: response.channel,
          ts: response.ts,
        },
      }
    } catch (error) {
      return {
        success: false,
        transport: 'slack',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Send an approval request with interactive buttons
   *
   * @param target - Channel (#channel) or user (@user or user ID)
   * @param request - Approval request text
   * @param options - Additional options
   */
  async sendApprovalRequest(
    target: string,
    request: string,
    options: {
      context?: Record<string, unknown>
      approveLabel?: string
      rejectLabel?: string
      requestId?: string
      timeout?: number
    } = {}
  ): Promise<DeliveryResult> {
    try {
      const channel = await this.resolveTarget(target)
      const requestId = options.requestId || this.generateRequestId()
      const blocks = this.formatApprovalBlocks(request, {
        ...options,
        requestId,
      })

      const response = await this.postMessage({
        channel,
        text: `Approval Request: ${request}`,
        blocks,
        metadata: {
          event_type: 'approval_request',
          event_payload: {
            requestId,
            context: options.context,
            timeout: options.timeout,
          },
        },
      })

      return {
        success: response.ok,
        transport: 'slack',
        messageId: response.ts,
        metadata: {
          channel: response.channel,
          ts: response.ts,
          requestId,
        },
      }
    } catch (error) {
      return {
        success: false,
        transport: 'slack',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Send a question with optional response options
   *
   * @param target - Channel (#channel) or user (@user or user ID)
   * @param question - Question text
   * @param options - Additional options
   */
  async sendQuestion(
    target: string,
    question: string,
    options: {
      choices?: string[]
      threadTs?: string
      requestId?: string
    } = {}
  ): Promise<DeliveryResult> {
    try {
      const channel = await this.resolveTarget(target)
      const requestId = options.requestId || this.generateRequestId()
      const blocks = this.formatQuestionBlocks(question, {
        ...options,
        requestId,
      })

      const thread_ts = options.threadTs
      const choices = options.choices
      const metadata = {
        event_type: 'question',
        event_payload: {
          requestId,
          ...(choices !== undefined && { choices }),
        },
      }

      const response = await this.postMessage({
        channel,
        text: question,
        blocks,
        ...(thread_ts !== undefined && { thread_ts }),
        ...(metadata !== undefined && { metadata }),
      })

      return {
        success: response.ok,
        transport: 'slack',
        messageId: response.ts,
        metadata: {
          channel: response.channel,
          ts: response.ts,
          requestId,
        },
      }
    } catch (error) {
      return {
        success: false,
        transport: 'slack',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Handle incoming webhook from Slack (button interactions, etc.)
   *
   * @param request - Webhook request with headers and body
   */
  async handleWebhook(request: SlackWebhookRequest): Promise<WebhookHandlerResult> {
    // Verify signature using async Web Crypto API
    try {
      const isValid = await this.verifySignatureAsync(request)
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid request signature',
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Signature verification failed',
      }
    }

    // Parse payload
    const payload = this.parseWebhookPayload(request)
    if (!payload) {
      return {
        success: false,
        error: 'Invalid webhook payload',
      }
    }

    // Handle block actions (button clicks)
    if (payload.type === 'block_actions' && payload.actions?.length) {
      const action = payload.actions[0]
      if (!action) {
        return {
          success: false,
          error: 'No action found in payload',
        }
      }

      const channelId = payload.channel?.id
      const messageTs = payload.message?.ts

      return {
        success: true,
        actionId: action.action_id,
        userId: payload.user.id,
        ...(channelId !== undefined && { channelId }),
        ...(messageTs !== undefined && { messageTs }),
        value: this.parseActionValue(action.value),
      }
    }

    return {
      success: false,
      error: `Unsupported interaction type: ${payload.type}`,
    }
  }

  /**
   * Update an existing message (for approval status updates, etc.)
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param text - New text
   * @param blocks - New blocks
   */
  async updateMessage(
    channel: string,
    ts: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<SlackApiResponse> {
    return this.callApi('chat.update', {
      channel,
      ts,
      text,
      blocks,
    })
  }

  /**
   * Open a DM channel with a user
   *
   * @param userId - User ID to open DM with
   */
  async openDM(userId: string): Promise<string> {
    const response = await this.callApi<SlackApiResponse<unknown> & { channel?: { id: string } }>(
      'conversations.open',
      {
        users: userId,
      }
    )

    if (!response.ok || !response.channel?.id) {
      throw new Error(response.error || 'Failed to open DM')
    }

    return response.channel.id
  }

  /**
   * Look up user by email
   *
   * @param email - User email address
   */
  async lookupUserByEmail(email: string): Promise<string | null> {
    try {
      const response = await this.callApi<SlackUserInfoResponse>('users.lookupByEmail', {
        email,
      })

      if (!response.ok) {
        return null
      }

      return response.user?.id || null
    } catch (error) {
      // User not found or other API error - log for debugging
      this.logger.error('lookupUserByEmail failed', error instanceof Error ? error : undefined, {
        email,
        operation: 'lookupUserByEmail',
      })
      return null
    }
  }

  /**
   * Get the transport handler for registration
   */
  getHandler(): TransportHandler {
    return async (payload: MessagePayload, config: TransportConfig): Promise<DeliveryResult> => {
      const target = Array.isArray(payload.to) ? payload.to[0] : payload.to
      if (!target) {
        return {
          success: false,
          transport: 'slack',
          error: 'No target specified',
        }
      }

      if (payload.type === 'approval') {
        const context = payload.metadata
        return this.sendApprovalRequest(target, payload.body, {
          ...(context !== undefined && { context }),
        })
      }

      if (payload.type === 'question') {
        const choices = payload.actions?.map((a) => a.label)
        return this.sendQuestion(target, payload.body, {
          ...(choices !== undefined && { choices }),
        })
      }

      const priority = payload.priority
      const metadata = payload.metadata
      return this.sendNotification(target, payload.body, {
        ...(priority !== undefined && { priority }),
        ...(metadata !== undefined && { metadata }),
      })
    }
  }

  /**
   * Register this transport with the transport registry
   */
  register(): void {
    registerTransport('slack', this.getHandler())
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Resolve target to channel ID
   * - #channel -> channel name lookup
   * - @user -> DM with user
   * - C/U/D ID -> direct use
   */
  private async resolveTarget(target: string): Promise<string> {
    // Already a channel/user ID
    if (/^[CUD][A-Z0-9]+$/.test(target)) {
      return target
    }

    // Channel reference (#channel)
    if (target.startsWith('#')) {
      // Return channel name, Slack API accepts this
      return target.slice(1)
    }

    // User reference (@user)
    if (target.startsWith('@')) {
      const username = target.slice(1)
      // Try to find user and open DM
      const userId = await this.findUserByName(username)
      if (userId) {
        return this.openDM(userId)
      }
      throw new Error(`User not found: ${username}`)
    }

    // Assume it's a channel name or ID
    return target
  }

  /**
   * Find user by display name (limited functionality)
   */
  private async findUserByName(name: string): Promise<string | null> {
    // Note: This would require users:read scope and iterating through users
    // For production, you'd want to implement proper user lookup
    // or use users.lookupByEmail if you have the email
    return null
  }

  /**
   * Format notification message blocks
   */
  private formatNotificationBlocks(
    message: string,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'urgent'
      metadata?: Record<string, unknown>
    }
  ): SlackBlock[] {
    const blocks: SlackBlock[] = []

    // Add priority indicator for high/urgent
    if (options.priority === 'urgent' || options.priority === 'high') {
      const emoji = options.priority === 'urgent' ? ':rotating_light:' : ':warning:'
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${options.priority.toUpperCase()}`,
          emoji: true,
        },
      })
    }

    // Main message
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message,
      },
    })

    // Add context if metadata provided
    if (options.metadata && Object.keys(options.metadata).length > 0) {
      blocks.push({
        type: 'divider',
      })
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: Object.entries(options.metadata)
              .map(([k, v]) => `*${k}:* ${v}`)
              .join(' | '),
          },
        ],
      })
    }

    return blocks
  }

  /**
   * Format approval request blocks with buttons
   */
  private formatApprovalBlocks(
    request: string,
    options: {
      context?: Record<string, unknown>
      approveLabel?: string
      rejectLabel?: string
      requestId: string
    }
  ): SlackBlock[] {
    const blocks: SlackBlock[] = []

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Approval Request',
        emoji: true,
      },
    })

    // Request text
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: request,
      },
    })

    // Context information
    if (options.context && Object.keys(options.context).length > 0) {
      blocks.push({
        type: 'divider',
      })

      const contextFields: SlackTextObject[] = Object.entries(options.context).map(([k, v]) => ({
        type: 'mrkdwn' as const,
        text: `*${k}:*\n${v}`,
      }))

      // Split into chunks of 10 (Slack's limit for fields)
      for (let i = 0; i < contextFields.length; i += 10) {
        blocks.push({
          type: 'section',
          fields: contextFields.slice(i, i + 10),
        })
      }
    }

    // Action buttons
    blocks.push({
      type: 'divider',
    })
    blocks.push({
      type: 'actions',
      block_id: `approval_actions_${options.requestId}`,
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: options.approveLabel || 'Approve',
            emoji: true,
          },
          style: 'primary',
          action_id: `approve_${options.requestId}`,
          value: JSON.stringify({ action: 'approve', requestId: options.requestId }),
          confirm: {
            title: { type: 'plain_text', text: 'Confirm Approval' },
            text: { type: 'mrkdwn', text: 'Are you sure you want to approve this request?' },
            confirm: { type: 'plain_text', text: 'Approve' },
            deny: { type: 'plain_text', text: 'Cancel' },
          },
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: options.rejectLabel || 'Reject',
            emoji: true,
          },
          style: 'danger',
          action_id: `reject_${options.requestId}`,
          value: JSON.stringify({ action: 'reject', requestId: options.requestId }),
          confirm: {
            title: { type: 'plain_text', text: 'Confirm Rejection' },
            text: { type: 'mrkdwn', text: 'Are you sure you want to reject this request?' },
            confirm: { type: 'plain_text', text: 'Reject' },
            deny: { type: 'plain_text', text: 'Cancel' },
            style: 'danger',
          },
        },
      ],
    })

    return blocks
  }

  /**
   * Format question blocks with optional choice buttons
   */
  private formatQuestionBlocks(
    question: string,
    options: {
      choices?: string[]
      requestId: string
    }
  ): SlackBlock[] {
    const blocks: SlackBlock[] = []

    // Question text
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: question,
      },
    })

    // Choice buttons if provided
    if (options.choices && options.choices.length > 0) {
      blocks.push({
        type: 'actions',
        block_id: `question_choices_${options.requestId}`,
        elements: options.choices.slice(0, 5).map(
          (choice, index): SlackButtonElement => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: choice,
              emoji: true,
            },
            action_id: `choice_${options.requestId}_${index}`,
            value: JSON.stringify({ choice, requestId: options.requestId }),
          })
        ),
      })
    }

    return blocks
  }

  /**
   * Post a message to Slack
   */
  private async postMessage(message: SlackMessage): Promise<SlackPostMessageResponse> {
    return this.callApi<SlackPostMessageResponse>(
      'chat.postMessage',
      message as unknown as Record<string, unknown>
    )
  }

  /**
   * Call Slack API
   */
  private async callApi<T extends SlackApiResponse = SlackApiResponse>(
    method: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as T
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`)
    }

    return data
  }

  /**
   * Verify Slack request signature using Web Crypto API.
   * Works in both Node.js and Cloudflare Workers environments.
   */
  private async verifySignatureAsync(request: SlackWebhookRequest): Promise<boolean> {
    const signature = request.headers['x-slack-signature']
    const timestamp = request.headers['x-slack-request-timestamp']

    if (!signature || !timestamp) {
      return false
    }

    // Check timestamp to prevent replay attacks (5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const requestTimestamp = parseInt(timestamp, 10)
    if (Math.abs(now - requestTimestamp) > 300) {
      return false
    }

    // Get raw body for verification
    const rawBody =
      request.rawBody ||
      (typeof request.body === 'string' ? request.body : JSON.stringify(request.body))

    // Use the exported async signature verification function
    return verifySlackSignature(signature, timestamp, rawBody, this.config.signingSecret)
  }

  /**
   * Parse webhook payload
   */
  private parseWebhookPayload(request: SlackWebhookRequest): SlackInteractionPayload | null {
    try {
      if (typeof request.body === 'string') {
        // URL-encoded payload (application/x-www-form-urlencoded)
        if (request.body.startsWith('payload=')) {
          const decoded = decodeURIComponent(request.body.slice(8))
          return JSON.parse(decoded) as SlackInteractionPayload
        }
        // JSON payload
        return JSON.parse(request.body) as SlackInteractionPayload
      }
      return request.body as SlackInteractionPayload
    } catch (error) {
      // Parse error - log for debugging
      this.logger.error('parseWebhookPayload failed', error instanceof Error ? error : undefined, {
        operation: 'parseWebhookPayload',
        bodyType: typeof request.body,
        bodyPreview: typeof request.body === 'string' ? request.body.slice(0, 100) : '[object]',
      })
      return null
    }
  }

  /**
   * Parse action value (JSON or string)
   */
  private parseActionValue(value: string): unknown {
    try {
      return JSON.parse(value)
    } catch {
      // Non-JSON value - this is expected for string values, log at debug level
      this.logger.debug('parseActionValue: value is not JSON, returning as string', {
        operation: 'parseActionValue',
        valuePreview: value.slice(0, 50),
      })
      return value
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return generateRequestId('req')
  }

  // ===========================================================================
  // Testing Utilities
  // ===========================================================================

  /**
   * Expose parseWebhookPayload for testing
   * @internal
   */
  parseWebhookPayloadForTesting(request: SlackWebhookRequest): SlackInteractionPayload | null {
    return this.parseWebhookPayload(request)
  }

  /**
   * Expose parseActionValue for testing
   * @internal
   */
  parseActionValueForTesting(value: string): unknown {
    return this.parseActionValue(value)
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a Slack transport instance
 *
 * @example
 * ```ts
 * const slack = createSlackTransport({
 *   botToken: process.env.SLACK_BOT_TOKEN!,
 *   signingSecret: process.env.SLACK_SIGNING_SECRET!,
 * })
 *
 * await slack.sendNotification('#engineering', 'Hello!')
 * ```
 */
export function createSlackTransport(
  config: Omit<SlackTransportConfig, 'transport'>
): SlackTransport {
  return new SlackTransport(config)
}

/**
 * Create and register a Slack transport handler
 *
 * @example
 * ```ts
 * registerSlackTransport({
 *   botToken: process.env.SLACK_BOT_TOKEN!,
 *   signingSecret: process.env.SLACK_SIGNING_SECRET!,
 * })
 *
 * // Now 'slack' transport is available via sendViaTransport
 * await sendViaTransport('slack', payload)
 * ```
 */
export function registerSlackTransport(
  config: Omit<SlackTransportConfig, 'transport'>
): SlackTransport {
  const transport = createSlackTransport(config)
  transport.register()
  return transport
}

// =============================================================================
// Block Kit Helpers
// =============================================================================

/**
 * Create a section block
 */
export function slackSection(text: string, options?: { fields?: string[] }): SlackSectionBlock {
  const block: SlackSectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text,
    },
  }

  if (options?.fields) {
    block.fields = options.fields.map((f) => ({
      type: 'mrkdwn' as const,
      text: f,
    }))
  }

  return block
}

/**
 * Create a header block
 */
export function slackHeader(text: string): SlackHeaderBlock {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text,
      emoji: true,
    },
  }
}

/**
 * Create a divider block
 */
export function slackDivider(): SlackDividerBlock {
  return { type: 'divider' }
}

/**
 * Create a context block
 */
export function slackContext(...texts: string[]): SlackContextBlock {
  return {
    type: 'context',
    elements: texts.map((text) => ({
      type: 'mrkdwn' as const,
      text,
    })),
  }
}

/**
 * Create a button element
 */
export function slackButton(
  text: string,
  actionId: string,
  options?: {
    value?: string
    style?: 'primary' | 'danger'
    url?: string
  }
): SlackButtonElement {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      text,
      emoji: true,
    },
    action_id: actionId,
    ...(options?.value !== undefined && { value: options.value }),
    ...(options?.style !== undefined && { style: options.style }),
    ...(options?.url !== undefined && { url: options.url }),
  }
}

/**
 * Create an actions block with buttons
 */
export function slackActions(blockId: string, ...buttons: SlackButtonElement[]): SlackActionsBlock {
  return {
    type: 'actions',
    block_id: blockId,
    elements: buttons,
  }
}
