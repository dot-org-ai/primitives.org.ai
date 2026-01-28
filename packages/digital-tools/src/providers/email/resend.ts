/**
 * Resend Email Provider
 *
 * Concrete implementation of EmailProvider using Resend API.
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
  DomainVerification,
  DomainInfo,
} from '../types.js'
import { defineProvider } from '../registry.js'

const RESEND_API_URL = 'https://api.resend.com'

// =============================================================================
// Resend API Response Types
// =============================================================================

/** Resend success response for sending email */
interface ResendSendResponse {
  id: string
}

/** Resend error response */
interface ResendErrorResponse {
  name?: string
  message?: string
}

/** Resend batch send response item */
interface ResendBatchItem {
  id: string
}

/** Resend batch send response */
interface ResendBatchResponse {
  data: ResendBatchItem[]
}

/** Resend email data from API */
interface ResendEmailData {
  id: string
  from: string
  to: string | string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text?: string
  html?: string
  last_event: string
  created_at?: string
}

/** Resend DNS record from API */
interface ResendDNSRecord {
  type: string
  name: string
  value: string
  status: string
}

/** Resend domain response from API */
interface ResendDomainResponse {
  name: string
  status: string
  records?: ResendDNSRecord[]
}

/** Resend domain list item from API */
interface ResendDomainListItem {
  name: string
  status: string
  created_at: string
}

/** Resend domains list response */
interface ResendDomainsListResponse {
  data?: ResendDomainListItem[]
}

/**
 * Resend provider info
 */
export const resendInfo: ProviderInfo = {
  id: 'email.resend',
  name: 'Resend',
  description: 'Modern email API for developers',
  category: 'email',
  website: 'https://resend.com',
  docsUrl: 'https://resend.com/docs',
  requiredConfig: ['apiKey'],
  optionalConfig: ['defaultFrom'],
}

/**
 * Create Resend email provider
 */
export function createResendProvider(config: ProviderConfig): EmailProvider {
  let apiKey: string
  let defaultFrom: string | undefined

  return {
    info: resendInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      apiKey = cfg.apiKey as string
      defaultFrom = cfg.defaultFrom as string | undefined

      if (!apiKey) {
        throw new Error('Resend API key is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${RESEND_API_URL}/domains`, {
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

      const body: Record<string, unknown> = {
        from,
        to: options.to,
        subject: options.subject,
        ...(options.cc && { cc: options.cc }),
        ...(options.bcc && { bcc: options.bcc }),
        ...(options.replyTo && { reply_to: options.replyTo }),
        ...(options.text && { text: options.text }),
        ...(options.html && { html: options.html }),
        ...(options.headers && { headers: options.headers }),
        ...(options.tags && { tags: options.tags.map((name) => ({ name })) }),
      }

      if (options.attachments?.length) {
        body.attachments = options.attachments.map((att) => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          content_type: att.contentType,
        }))
      }

      if (options.sendAt) {
        body.scheduled_at = options.sendAt.toISOString()
      }

      try {
        const response = await fetch(`${RESEND_API_URL}/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        })

        const data = await response.json()

        if (response.ok) {
          const sendResponse = data as ResendSendResponse
          return {
            success: true,
            messageId: sendResponse.id,
          }
        }

        const errorResponse = data as ResendErrorResponse
        return {
          success: false,
          error: {
            code: errorResponse.name || `HTTP_${response.status}`,
            message: errorResponse.message || response.statusText,
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
      // Resend has a batch endpoint
      const from = defaultFrom
      const batch = emails.map((options) => ({
        from: options.from || from,
        to: options.to,
        subject: options.subject,
        ...(options.cc && { cc: options.cc }),
        ...(options.bcc && { bcc: options.bcc }),
        ...(options.replyTo && { reply_to: options.replyTo }),
        ...(options.text && { text: options.text }),
        ...(options.html && { html: options.html }),
      }))

      try {
        const response = await fetch(`${RESEND_API_URL}/emails/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(batch),
        })

        const data = await response.json()

        if (response.ok) {
          const batchResponse = data as ResendBatchResponse
          return batchResponse.data.map((item) => ({
            success: true,
            messageId: item.id,
          }))
        }

        // If batch fails, return error for all
        const errorResponse = data as ResendErrorResponse
        return emails.map(() => ({
          success: false,
          error: {
            code: errorResponse.name || `HTTP_${response.status}`,
            message: errorResponse.message || response.statusText,
          },
        }))
      } catch (error) {
        return emails.map(() => ({
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        }))
      }
    },

    async get(messageId: string): Promise<EmailData | null> {
      try {
        const response = await fetch(`${RESEND_API_URL}/emails/${messageId}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })

        if (!response.ok) {
          if (response.status === 404) return null
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as ResendEmailData
        return {
          id: data.id,
          from: data.from,
          to: Array.isArray(data.to) ? data.to : [data.to],
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          text: data.text,
          html: data.html,
          status: mapResendStatus(data.last_event),
          sentAt: data.created_at ? new Date(data.created_at) : undefined,
        }
      } catch {
        return null
      }
    },

    async verifyDomain(domain: string): Promise<DomainVerification> {
      const response = await fetch(`${RESEND_API_URL}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ name: domain }),
      })

      const data = (await response.json()) as ResendDomainResponse

      return {
        domain: data.name,
        verified: data.status === 'verified',
        dnsRecords:
          data.records?.map((r) => ({
            type: r.type as 'TXT' | 'CNAME' | 'MX',
            name: r.name,
            value: r.value,
            verified: r.status === 'verified',
          })) || [],
      }
    },

    async listDomains(): Promise<DomainInfo[]> {
      const response = await fetch(`${RESEND_API_URL}/domains`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      const data = (await response.json()) as ResendDomainsListResponse
      return (
        data.data?.map((d) => ({
          domain: d.name,
          verified: d.status === 'verified',
          createdAt: new Date(d.created_at),
        })) || []
      )
    },
  }
}

function mapResendStatus(event: string): EmailData['status'] {
  switch (event) {
    case 'delivered':
      return 'delivered'
    case 'bounced':
      return 'bounced'
    case 'complained':
      return 'failed'
    default:
      return 'sent'
  }
}

/**
 * Resend provider definition
 */
export const resendProvider = defineProvider(resendInfo, async (config) =>
  createResendProvider(config)
)
