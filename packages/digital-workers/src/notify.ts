/**
 * Notification functionality for digital workers
 */

import type {
  Worker,
  Team,
  WorkerRef,
  ActionTarget,
  ContactChannel,
  NotifyResult,
  NotifyOptions,
  Contacts,
} from './types.js'

/**
 * Send a notification to a worker or team
 *
 * Routes notifications through the specified channel(s), falling back
 * to the target's preferred channel if not specified.
 *
 * @param target - The worker or team to notify
 * @param message - The notification message
 * @param options - Notification options
 * @returns Promise resolving to notification result
 *
 * @example
 * ```ts
 * // Notify a worker via their preferred channel
 * await notify(alice, 'Deployment completed successfully')
 *
 * // Notify via specific channel
 * await notify(alice, 'Urgent: Server down!', { via: 'slack' })
 *
 * // Notify via multiple channels
 * await notify(alice, 'Critical alert', { via: ['slack', 'sms'] })
 *
 * // Notify a team
 * await notify(engineering, 'Sprint planning tomorrow', { via: 'slack' })
 * ```
 */
export async function notify(
  target: ActionTarget,
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const { via, priority = 'normal', fallback = false, timeout, context, metadata } = options

  // Resolve target to get contacts
  const { contacts, recipients } = resolveTarget(target)

  // Determine which channels to use
  const channels = resolveChannels(via, contacts, priority)

  if (channels.length === 0) {
    return {
      sent: false,
      via: [],
      sentAt: new Date(),
      messageId: generateMessageId(),
      delivery: [],
    }
  }

  // Send to each channel
  const delivery = await Promise.all(
    channels.map(async (channel) => {
      try {
        await sendToChannel(channel, message, contacts, { priority, metadata })
        return { channel, status: 'sent' as const }
      } catch (error) {
        return {
          channel,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  )

  const sent = delivery.some((d) => d.status === 'sent')

  return {
    sent,
    via: channels,
    recipients,
    sentAt: new Date(),
    messageId: generateMessageId(),
    delivery,
  }
}

/**
 * Send a high-priority alert notification
 *
 * @example
 * ```ts
 * await notify.alert(oncallEngineer, 'Production is down!')
 * ```
 */
notify.alert = async (
  target: ActionTarget,
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  return notify(target, message, { ...options, priority: 'urgent' })
}

/**
 * Send a low-priority info notification
 *
 * @example
 * ```ts
 * await notify.info(team, 'Weekly sync notes posted')
 * ```
 */
notify.info = async (
  target: ActionTarget,
  message: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  return notify(target, message, { ...options, priority: 'low' })
}

/**
 * Send a rich notification with title and body
 *
 * @example
 * ```ts
 * await notify.rich(alice, 'Deployment Complete', 'Version 2.1.0 deployed to production', {
 *   via: 'slack',
 *   metadata: { version: '2.1.0', environment: 'production' },
 * })
 * ```
 */
notify.rich = async (
  target: ActionTarget,
  title: string,
  body: string,
  options: NotifyOptions = {}
): Promise<NotifyResult> => {
  const message = `**${title}**\n\n${body}`
  return notify(target, message, options)
}

/**
 * Send notifications in batch
 *
 * @example
 * ```ts
 * await notify.batch([
 *   { target: alice, message: 'Task 1 complete' },
 *   { target: bob, message: 'Task 2 complete' },
 *   { target: team, message: 'All tasks done', options: { via: 'slack' } },
 * ])
 * ```
 */
notify.batch = async (
  notifications: Array<{
    target: ActionTarget
    message: string
    options?: NotifyOptions
  }>
): Promise<NotifyResult[]> => {
  return Promise.all(
    notifications.map(({ target, message, options }) => notify(target, message, options))
  )
}

/**
 * Schedule a notification for later
 *
 * @example
 * ```ts
 * // Schedule for specific time
 * await notify.schedule(alice, 'Meeting in 15 minutes', new Date('2024-01-15T14:45:00Z'))
 *
 * // Schedule with delay
 * await notify.schedule(alice, 'Reminder', 60000)  // 1 minute
 * ```
 */
notify.schedule = async (
  target: ActionTarget,
  message: string,
  when: Date | number,
  options: NotifyOptions = {}
): Promise<{ scheduled: true; scheduledFor: Date; messageId: string }> => {
  const scheduledFor = when instanceof Date ? when : new Date(Date.now() + when)

  // In a real implementation, this would store the scheduled notification
  return {
    scheduled: true,
    scheduledFor,
    messageId: generateMessageId('scheduled'),
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Resolve an action target to contacts and recipients
 */
function resolveTarget(target: ActionTarget): {
  contacts: Contacts
  recipients: WorkerRef[]
} {
  if (typeof target === 'string') {
    // Just an ID - return empty contacts, would need to look up
    return {
      contacts: {},
      recipients: [{ id: target }],
    }
  }

  if ('contacts' in target) {
    // Worker or Team
    const recipients: WorkerRef[] =
      'members' in target
        ? target.members // Team
        : [{ id: target.id, type: target.type, name: target.name }] // Worker

    return {
      contacts: target.contacts,
      recipients,
    }
  }

  // WorkerRef - no contacts available
  return {
    contacts: {},
    recipients: [target],
  }
}

/**
 * Determine which channels to use based on options and contacts
 */
function resolveChannels(
  via: ContactChannel | ContactChannel[] | undefined,
  contacts: Contacts,
  priority: string
): ContactChannel[] {
  // If specific channels requested, use those
  if (via) {
    const requested = Array.isArray(via) ? via : [via]
    // Filter to only channels that exist in contacts
    return requested.filter((channel) => contacts[channel] !== undefined)
  }

  // Otherwise, use available channels based on priority
  const available = Object.keys(contacts) as ContactChannel[]

  if (available.length === 0) {
    return []
  }

  const firstChannel = available[0]
  if (!firstChannel) {
    return []
  }

  // For urgent, try multiple channels
  if (priority === 'urgent') {
    const urgentChannels: ContactChannel[] = ['slack', 'sms', 'phone']
    return available.filter((c) => urgentChannels.includes(c))
  }

  // Default to first available
  return [firstChannel]
}

/**
 * Send a notification to a specific channel
 */
async function sendToChannel(
  channel: ContactChannel,
  message: string,
  contacts: Contacts,
  options: { priority?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const contact = contacts[channel]

  if (!contact) {
    throw new Error(`No ${channel} contact configured`)
  }

  // In a real implementation, this would:
  // 1. Format the message for the channel
  // 2. Send via the appropriate API (Slack, SendGrid, Twilio, etc.)
  // 3. Handle delivery confirmation

  // For now, simulate success
  await new Promise((resolve) => setTimeout(resolve, 10))
}

/**
 * Generate a unique message ID
 */
function generateMessageId(prefix = 'msg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
