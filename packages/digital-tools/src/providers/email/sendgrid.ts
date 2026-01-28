/**
 * SendGrid Email Provider
 *
 * Concrete implementation of EmailProvider using SendGrid API.
 *
 * @packageDocumentation
 */

import type {
  EmailProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  SendEmailOptions,
  SendEmailResult,
  EmailData,
  EmailListOptions,
  PaginatedResult,
} from '../types.js'
import { defineProvider } from '../registry.js'

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3'

/**
 * SendGrid provider info
 */
export const sendgridInfo: ProviderInfo = {
  id: 'email.sendgrid',
  name: 'SendGrid',
  description: 'SendGrid email delivery service by Twilio',
  category: 'email',
  website: 'https://sendgrid.com',
  docsUrl: 'https://docs.sendgrid.com',
  requiredConfig: ['apiKey'],
  optionalConfig: ['defaultFrom', 'sandboxMode'],
}

/**
 * Create SendGrid email provider
 */
export function createSendGridProvider(config: ProviderConfig): EmailProvider {
  let apiKey: string
  let defaultFrom: string | undefined

  return {
    info: sendgridInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      apiKey = cfg.apiKey as string
      defaultFrom = cfg['defaultFrom'] as string | undefined

      if (!apiKey) {
        throw new Error('SendGrid API key is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${SENDGRID_API_URL}/scopes`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })

        return {
          healthy: response.ok,
          latencyMs: Date.now() - start,
          message: response.ok ? 'Connected' : `HTTP ${response.status}`,
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async send(options: SendEmailOptions): Promise<SendEmailResult> {
      const from = options.from || defaultFrom
      if (!from) {
        return {
          success: false,
          error: { code: 'MISSING_FROM', message: 'From address is required' },
        }
      }

      const personalizations = [
        {
          to: options.to.map((email) => ({ email })),
          ...(options.cc && { cc: options.cc.map((email) => ({ email })) }),
          ...(options.bcc && { bcc: options.bcc.map((email) => ({ email })) }),
        },
      ]

      const body: Record<string, unknown> = {
        personalizations,
        from: { email: from },
        subject: options.subject,
        content: [
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          ...(options.html ? [{ type: 'text/html', value: options.html }] : []),
        ],
      }

      if (options.replyTo) {
        body['reply_to'] = { email: options.replyTo }
      }

      if (options.attachments?.length) {
        body['attachments'] = options.attachments.map((att) => ({
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          filename: att.filename,
          type: att.contentType,
          content_id: att.contentId,
          disposition: att.contentId ? 'inline' : 'attachment',
        }))
      }

      if (options.sendAt) {
        body['send_at'] = Math.floor(options.sendAt.getTime() / 1000)
      }

      if (options.trackOpens !== undefined || options.trackClicks !== undefined) {
        body['tracking_settings'] = {
          ...(options.trackOpens !== undefined && {
            open_tracking: { enable: options.trackOpens },
          }),
          ...(options.trackClicks !== undefined && {
            click_tracking: { enable: options.trackClicks },
          }),
        }
      }

      if (options.tags?.length) {
        body['categories'] = options.tags
      }

      if (options.metadata) {
        body['custom_args'] = options.metadata
      }

      try {
        const response = await fetch(`${SENDGRID_API_URL}/mail/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        })

        if (response.ok || response.status === 202) {
          const messageId = response.headers.get('X-Message-Id')
          return {
            success: true,
            ...(messageId !== null && { messageId }),
          }
        }

        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: (errorData as any)?.errors?.[0]?.message || response.statusText,
          },
        }
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        }
      }
    },

    async sendBatch(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
      // SendGrid doesn't have a true batch endpoint, so we send in parallel
      return Promise.all(emails.map((email) => this.send(email)))
    },
  }
}

/**
 * SendGrid provider definition
 */
export const sendgridProvider = defineProvider(sendgridInfo, async (config) =>
  createSendGridProvider(config)
)
