/**
 * Notification functionality for digital workers
 */

import { generateObject } from 'ai-functions'
import type { Channel, NotifyResult, NotifyOptions } from './types.js'

/**
 * Send a notification to one or more channels
 *
 * Routes notifications through various channels (Slack, email, SMS, etc.)
 * with appropriate formatting for each channel.
 *
 * @param message - The notification message
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * // Send a simple notification
 * const result = await notify('Deployment completed successfully', {
 *   channels: 'slack',
 *   recipients: ['#engineering', '@alice'],
 *   priority: 'medium',
 * })
 * ```
 *
 * @example
 * ```ts
 * // Send to multiple channels
 * const result = await notify('Critical: Database connection lost', {
 *   channels: ['slack', 'email', 'sms'],
 *   recipients: ['oncall@company.com'],
 *   priority: 'urgent',
 *   metadata: {
 *     service: 'api',
 *     timestamp: new Date().toISOString(),
 *     severity: 'critical',
 *   },
 * })
 * ```
 */
export async function notify(
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const {
    channels = 'web',
    recipients = [],
    priority = 'medium',
    metadata = {},
  } = options

  const channelList = Array.isArray(channels) ? channels : [channels]

  // Generate channel-specific message formats
  const channelMessages = await Promise.all(
    channelList.map((channel) =>
      generateChannelMessage(message, channel, { priority, metadata })
    )
  )

  // In a real implementation, this would:
  // 1. Format the message for each channel
  // 2. Send to appropriate APIs/services
  // 3. Handle delivery confirmation
  // 4. Track message IDs

  // For now, simulate successful delivery
  return {
    sent: true,
    channels: channelList,
    recipients: recipients.length > 0 ? recipients : undefined,
    sentAt: new Date(),
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
}

/**
 * Generate a message formatted for a specific channel
 */
async function generateChannelMessage(
  message: string,
  channel: Channel,
  options: { priority?: string; metadata?: Record<string, unknown> }
): Promise<unknown> {
  const { priority, metadata } = options

  const channelSchemas: Record<Channel, object> = {
    slack: {
      text: 'Plain text fallback',
      blocks: ['Slack BlockKit blocks as JSON array'],
    },
    email: {
      subject: 'Email subject line',
      html: 'HTML email body',
      text: 'Plain text email body',
    },
    web: {
      title: 'Notification title',
      body: 'Notification body',
      icon: 'Icon name or emoji',
    },
    sms: {
      text: 'SMS message text (max 160 chars)',
    },
    custom: {
      message: 'The formatted message',
      format: 'The format used',
    },
  }

  const result = await generateObject({
    model: 'sonnet',
    schema: channelSchemas[channel],
    system: `You are a notification formatter. Create ${channel}-appropriate messages.

Priority: ${priority || 'medium'}
${metadata && Object.keys(metadata).length > 0 ? `Metadata: ${JSON.stringify(metadata)}` : ''}`,
    prompt: `Format this notification for ${channel}:

${message}

Create an appropriate message format for this channel.`,
  })

  return result.object
}

/**
 * Send a notification with rich formatting
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * const result = await notify.rich(
 *   'Deployment Complete',
 *   'Version 2.1.0 has been deployed to production successfully.',
 *   {
 *     channels: 'slack',
 *     recipients: ['#engineering'],
 *     metadata: {
 *       version: '2.1.0',
 *       environment: 'production',
 *       duration: '3m 42s',
 *     },
 *   }
 * )
 * ```
 */
notify.rich = async (
  title: string,
  body: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  const message = `**${title}**\n\n${body}`
  return notify(message, options)
}

/**
 * Send an alert notification (high priority)
 *
 * @param message - Alert message
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * const result = await notify.alert(
 *   'High memory usage detected: 95%',
 *   {
 *     channels: ['slack', 'sms'],
 *     recipients: ['oncall@company.com'],
 *   }
 * )
 * ```
 */
notify.alert = async (
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  return notify(message, {
    ...options,
    priority: 'urgent',
  })
}

/**
 * Send an info notification (low priority)
 *
 * @param message - Info message
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * const result = await notify.info(
 *   'Weekly backup completed',
 *   { channels: 'email' }
 * )
 * ```
 */
notify.info = async (
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  return notify(message, {
    ...options,
    priority: 'low',
  })
}

/**
 * Send a notification to a specific team
 *
 * @param team - Team identifier
 * @param message - Message to send
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * const result = await notify.team(
 *   'engineering',
 *   'New PR ready for review',
 *   { channels: 'slack' }
 * )
 * ```
 */
notify.team = async (
  team: string,
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  return notify(message, {
    ...options,
    recipients: [...(options.recipients || []), `@team-${team}`],
  })
}

/**
 * Send a notification to a specific person
 *
 * @param person - Person identifier (email, username, etc.)
 * @param message - Message to send
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * const result = await notify.person(
 *   'alice@company.com',
 *   'Your approval is needed for expense #1234',
 *   { channels: ['email', 'slack'] }
 * )
 * ```
 */
notify.person = async (
  person: string,
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  return notify(message, {
    ...options,
    recipients: [...(options.recipients || []), person],
  })
}

/**
 * Send notifications in batch
 *
 * @param notifications - Array of notification configurations
 * @returns Promise resolving to array of notification results
 *
 * @example
 * ```ts
 * const results = await notify.batch([
 *   { message: 'Task 1 completed', channels: 'slack' },
 *   { message: 'Task 2 completed', channels: 'email' },
 *   { message: 'Task 3 completed', channels: 'sms' },
 * ])
 * ```
 */
notify.batch = async (
  notifications: Array<{ message: string; options?: NotifyOptions }>
): Promise<NotifyResult[]> => {
  return Promise.all(
    notifications.map(({ message, options }) => notify(message, options))
  )
}

/**
 * Schedule a notification for later
 *
 * @param message - Message to send
 * @param when - When to send (Date or delay in ms)
 * @param options - Notification options
 * @returns Promise resolving to scheduled notification info
 *
 * @example
 * ```ts
 * // Schedule for specific time
 * const result = await notify.schedule(
 *   'Reminder: Team meeting in 15 minutes',
 *   new Date('2024-01-15T14:45:00Z'),
 *   { channels: 'slack' }
 * )
 *
 * // Schedule with delay
 * const result = await notify.schedule(
 *   'Reminder: Review PR',
 *   60000, // 1 minute
 *   { channels: 'slack' }
 * )
 * ```
 */
notify.schedule = async (
  message: string,
  when: Date | number,
  options: NotifyOptions = {}
): Promise<{ scheduled: true; scheduledFor: Date; messageId: string }> => {
  const scheduledFor = when instanceof Date ? when : new Date(Date.now() + when)

  // In a real implementation, this would:
  // 1. Store the scheduled notification
  // 2. Use a job queue or scheduler
  // 3. Send at the specified time

  return {
    scheduled: true,
    scheduledFor,
    messageId: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
}
