/**
 * Communication Tools - Email, messaging, notifications
 *
 * These tools define the interface for communication.
 * Actual implementations would integrate with email services,
 * Slack, etc. in production.
 *
 * @packageDocumentation
 */

import { defineTool } from '../define.js'
import type { AnyTool } from '../types.js'

/**
 * Email input type
 */
interface EmailInput {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  html?: string
  attachments?: Array<{
    filename: string
    content: string
    contentType?: string
  }>
}

/**
 * Send an email
 */
export const sendEmail = defineTool<
  EmailInput,
  { success: boolean; messageId?: string; error?: string }
>({
  id: 'communication.email.send',
  name: 'Send Email',
  description: 'Send an email to one or more recipients',
  category: 'communication',
  subcategory: 'email',
  input: {
    type: 'object',
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
      cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
      bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Plain text body' },
      html: { type: 'string', description: 'HTML body (optional)' },
      attachments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' },
            contentType: { type: 'string' },
          },
        },
        description: 'File attachments',
      },
    },
    required: ['to', 'subject', 'body'],
  },
  handler: async (input) => {
    // In production, this would integrate with an email service
    // (SendGrid, SES, Postmark, etc.)
    console.log('[Email] Sending to:', input.to.join(', '))
    console.log('[Email] Subject:', input.subject)

    // Simulate sending
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    }
  },
  options: {
    audience: 'both',
    tags: ['email', 'send', 'notify'],
    requiresConfirmation: true,
    permissions: [{ type: 'execute', resource: 'email' }],
  },
})

/**
 * Slack message input
 */
interface SlackMessageInput {
  channel: string
  text: string
  blocks?: unknown[]
  threadTs?: string
  unfurlLinks?: boolean
}

/**
 * Send a Slack message
 */
export const sendSlackMessage = defineTool<
  SlackMessageInput,
  { success: boolean; ts?: string; channel?: string; error?: string }
>({
  id: 'communication.slack.send',
  name: 'Send Slack Message',
  description: 'Send a message to a Slack channel or thread',
  category: 'communication',
  subcategory: 'slack',
  input: {
    type: 'object',
    properties: {
      channel: { type: 'string', description: 'Channel ID or name (e.g., #general)' },
      text: { type: 'string', description: 'Message text' },
      blocks: { type: 'array', description: 'Slack Block Kit blocks' },
      threadTs: { type: 'string', description: 'Thread timestamp for replies' },
      unfurlLinks: { type: 'boolean', description: 'Unfurl URLs in the message' },
    },
    required: ['channel', 'text'],
  },
  handler: async (input) => {
    // In production, this would integrate with Slack API
    console.log('[Slack] Sending to:', input.channel)
    console.log('[Slack] Message:', input.text)

    return {
      success: true,
      ts: `${Date.now()}.000001`,
      channel: input.channel,
    }
  },
  options: {
    audience: 'both',
    tags: ['slack', 'message', 'chat'],
    permissions: [{ type: 'execute', resource: 'slack' }],
  },
})

/**
 * Notification input
 */
interface NotificationInput {
  channel: 'email' | 'slack' | 'sms' | 'push' | 'webhook'
  recipients: string[]
  title: string
  message: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  data?: Record<string, unknown>
}

/**
 * Send a notification
 */
export const sendNotification = defineTool<
  NotificationInput,
  { success: boolean; notificationId: string; delivered: string[] }
>({
  id: 'communication.notify',
  name: 'Send Notification',
  description: 'Send a notification through various channels',
  category: 'communication',
  subcategory: 'notification',
  input: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        enum: ['email', 'slack', 'sms', 'push', 'webhook'],
        description: 'Notification channel',
      },
      recipients: { type: 'array', items: { type: 'string' }, description: 'Recipients' },
      title: { type: 'string', description: 'Notification title' },
      message: { type: 'string', description: 'Notification message' },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'Priority level',
      },
      data: { type: 'object', description: 'Additional data' },
    },
    required: ['channel', 'recipients', 'title', 'message'],
  },
  handler: async (input) => {
    console.log(`[Notification] [${input.channel}] ${input.title}`)
    console.log(`[Notification] Recipients:`, input.recipients)
    console.log(`[Notification] Priority:`, input.priority || 'normal')

    return {
      success: true,
      notificationId: `notif_${Date.now()}`,
      delivered: input.recipients,
    }
  },
  options: {
    audience: 'both',
    tags: ['notify', 'alert', 'message'],
  },
})

/**
 * SMS input
 */
interface SmsInput {
  to: string
  message: string
  from?: string
}

/**
 * Send an SMS
 */
export const sendSms = defineTool<
  SmsInput,
  { success: boolean; messageId?: string; error?: string }
>({
  id: 'communication.sms.send',
  name: 'Send SMS',
  description: 'Send an SMS text message',
  category: 'communication',
  subcategory: 'sms',
  input: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Phone number (E.164 format)' },
      message: { type: 'string', description: 'SMS message (max 160 chars recommended)' },
      from: { type: 'string', description: 'Sender phone number or ID' },
    },
    required: ['to', 'message'],
  },
  handler: async (input) => {
    // In production, this would integrate with Twilio, etc.
    console.log('[SMS] Sending to:', input.to)
    console.log('[SMS] Message:', input.message.slice(0, 160))

    return {
      success: true,
      messageId: `sms_${Date.now()}`,
    }
  },
  options: {
    audience: 'both',
    tags: ['sms', 'text', 'mobile'],
    requiresConfirmation: true,
    permissions: [{ type: 'execute', resource: 'sms' }],
  },
})

/**
 * All communication tools
 */
export const communicationTools: AnyTool[] = [
  sendEmail,
  sendSlackMessage,
  sendNotification,
  sendSms,
]
