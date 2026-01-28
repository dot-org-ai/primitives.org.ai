/**
 * Twilio SMS Provider
 *
 * Concrete implementation of SmsProvider using Twilio API.
 *
 * @packageDocumentation
 */

import type {
  SmsProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  SendSmsOptions,
  SendSmsResult,
  SmsStatus,
  SmsData,
  SmsListOptions,
  PaginatedResult,
} from '../types.js'
import { defineProvider } from '../registry.js'

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01'

/**
 * Twilio SMS provider info
 */
export const twilioSmsInfo: ProviderInfo = {
  id: 'messaging.twilio-sms',
  name: 'Twilio SMS',
  description: 'Twilio SMS messaging service',
  category: 'messaging',
  website: 'https://twilio.com',
  docsUrl: 'https://www.twilio.com/docs/sms',
  requiredConfig: ['accountSid', 'authToken'],
  optionalConfig: ['defaultFrom', 'messagingServiceSid'],
}

/**
 * Create Twilio SMS provider
 */
export function createTwilioSmsProvider(config: ProviderConfig): SmsProvider {
  let accountSid: string
  let authToken: string
  let defaultFrom: string | undefined
  let messagingServiceSid: string | undefined

  function getAuthHeader(): string {
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
  }

  async function twilioApi(
    path: string,
    method: string = 'GET',
    body?: URLSearchParams
  ): Promise<any> {
    const url = `${TWILIO_API_URL}/Accounts/${accountSid}${path}`

    const headers: Record<string, string> = {
      Authorization: getAuthHeader(),
    }
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    const bodyStr = body?.toString()
    const response = await fetch(url, {
      method,
      headers,
      ...(bodyStr !== undefined && { body: bodyStr }),
    })

    return response.json()
  }

  return {
    info: twilioSmsInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accountSid = cfg['accountSid'] as string
      authToken = cfg['authToken'] as string
      defaultFrom = cfg['defaultFrom'] as string | undefined
      messagingServiceSid = cfg['messagingServiceSid'] as string | undefined

      if (!accountSid || !authToken) {
        throw new Error('Twilio account SID and auth token are required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const data = await twilioApi('.json')

        return {
          healthy: data.status === 'active',
          latencyMs: Date.now() - start,
          message: data.status === 'active' ? 'Connected' : `Status: ${data.status}`,
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

    async send(options: SendSmsOptions): Promise<SendSmsResult> {
      const from = options.from || defaultFrom
      if (!from && !messagingServiceSid) {
        return {
          success: false,
          error: {
            code: 'MISSING_FROM',
            message: 'From number or messaging service SID is required',
          },
        }
      }

      const body = new URLSearchParams()
      body.append('To', options.to)
      body.append('Body', options.body)

      if (messagingServiceSid) {
        body.append('MessagingServiceSid', messagingServiceSid)
      } else if (from) {
        body.append('From', from)
      }

      if (options.statusCallback) {
        body.append('StatusCallback', options.statusCallback)
      }

      try {
        const data = await twilioApi('/Messages.json', 'POST', body)

        if (data.sid) {
          return {
            success: true,
            messageId: data.sid,
            status: data.status,
          }
        }

        return {
          success: false,
          error: {
            code: data.code?.toString() || 'UNKNOWN',
            message: data.message || 'Failed to send SMS',
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

    async sendMms(options: SendSmsOptions & { mediaUrls: string[] }): Promise<SendSmsResult> {
      const from = options.from || defaultFrom
      if (!from && !messagingServiceSid) {
        return {
          success: false,
          error: {
            code: 'MISSING_FROM',
            message: 'From number or messaging service SID is required',
          },
        }
      }

      const body = new URLSearchParams()
      body.append('To', options.to)
      body.append('Body', options.body)

      if (messagingServiceSid) {
        body.append('MessagingServiceSid', messagingServiceSid)
      } else if (from) {
        body.append('From', from)
      }

      // Add media URLs
      options.mediaUrls.forEach((url) => {
        body.append('MediaUrl', url)
      })

      if (options.statusCallback) {
        body.append('StatusCallback', options.statusCallback)
      }

      try {
        const data = await twilioApi('/Messages.json', 'POST', body)

        if (data.sid) {
          return {
            success: true,
            messageId: data.sid,
            status: data.status,
          }
        }

        return {
          success: false,
          error: {
            code: data.code?.toString() || 'UNKNOWN',
            message: data.message || 'Failed to send MMS',
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

    async getStatus(messageId: string): Promise<SmsStatus> {
      const data = await twilioApi(`/Messages/${messageId}.json`)

      return {
        messageId: data.sid,
        status: mapTwilioStatus(data.status),
        errorCode: data.error_code?.toString(),
        errorMessage: data.error_message,
      }
    },

    async list(options?: SmsListOptions): Promise<PaginatedResult<SmsData>> {
      const params = new URLSearchParams()

      if (options?.limit) {
        params.append('PageSize', options.limit.toString())
      }
      if (options?.to) {
        params.append('To', options.to)
      }
      if (options?.from) {
        params.append('From', options.from)
      }
      if (options?.since) {
        const sincePart = options.since.toISOString().split('T')[0]
        if (sincePart) {
          params.append('DateSent>', sincePart)
        }
      }
      if (options?.until) {
        const untilPart = options.until.toISOString().split('T')[0]
        if (untilPart) {
          params.append('DateSent<', untilPart)
        }
      }

      const queryString = params.toString()
      const path = `/Messages.json${queryString ? `?${queryString}` : ''}`

      const data = await twilioApi(path)

      return {
        items: data.messages?.map(mapTwilioMessage) || [],
        hasMore: !!data.next_page_uri,
        nextCursor: data.next_page_uri,
      }
    },
  }
}

function mapTwilioStatus(status: string): SmsStatus['status'] {
  switch (status) {
    case 'queued':
    case 'accepted':
      return 'queued'
    case 'sending':
      return 'sending'
    case 'sent':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'failed':
      return 'failed'
    case 'undelivered':
      return 'undelivered'
    default:
      return 'queued'
  }
}

function mapTwilioMessage(msg: any): SmsData {
  const sentAt = msg.date_sent ? new Date(msg.date_sent) : undefined
  const deliveredAt = msg.status === 'delivered' ? new Date(msg.date_updated) : undefined

  return {
    id: msg.sid,
    to: msg.to,
    from: msg.from,
    body: msg.body,
    status: msg.status,
    direction: msg.direction === 'inbound' ? 'inbound' : 'outbound',
    ...(sentAt !== undefined && { sentAt }),
    ...(deliveredAt !== undefined && { deliveredAt }),
  }
}

/**
 * Twilio SMS provider definition
 */
export const twilioSmsProvider = defineProvider(twilioSmsInfo, async (config) =>
  createTwilioSmsProvider(config)
)
