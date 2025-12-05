/**
 * Zendesk Support Provider
 *
 * Concrete implementation of SupportProvider using Zendesk API v2.
 *
 * @packageDocumentation
 */

import type {
  SupportProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  CreateTicketOptions,
  TicketData,
  TicketListOptions,
  PaginatedResult,
  TicketCommentData,
  SupportUserData,
} from '../types.js'
import { defineProvider } from '../registry.js'

/**
 * Zendesk provider info
 */
export const zendeskInfo: ProviderInfo = {
  id: 'support.zendesk',
  name: 'Zendesk',
  description: 'Zendesk customer support and ticketing platform',
  category: 'support',
  website: 'https://www.zendesk.com',
  docsUrl: 'https://developer.zendesk.com/api-reference/',
  requiredConfig: ['subdomain', 'apiKey', 'email'],
  optionalConfig: ['apiVersion'],
}

/**
 * Create Zendesk support provider
 */
export function createZendeskProvider(config: ProviderConfig): SupportProvider {
  let subdomain: string
  let apiKey: string
  let email: string
  let baseUrl: string

  return {
    info: zendeskInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      subdomain = cfg.subdomain as string
      apiKey = cfg.apiKey as string
      email = cfg.email as string

      if (!subdomain || !apiKey || !email) {
        throw new Error('Zendesk subdomain, API key, and email are required')
      }

      baseUrl = `https://${subdomain}.zendesk.com/api/v2`
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${baseUrl}/users/me.json`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
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

    async createTicket(ticket: CreateTicketOptions): Promise<TicketData> {
      const body = {
        ticket: {
          subject: ticket.subject,
          comment: { body: ticket.description },
          priority: ticket.priority || 'normal',
          type: ticket.type || 'question',
          ...(ticket.requesterId && { requester_id: ticket.requesterId }),
          ...(ticket.assigneeId && { assignee_id: ticket.assigneeId }),
          ...(ticket.tags && { tags: ticket.tags }),
          ...(ticket.customFields && { custom_fields: ticket.customFields }),
        },
      }

      try {
        const response = await fetch(`${baseUrl}/tickets.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error((error as any)?.error || `HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        return mapZendeskTicket(data.ticket)
      } catch (error) {
        throw new Error(`Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    async getTicket(ticketId: string): Promise<TicketData | null> {
      try {
        const response = await fetch(`${baseUrl}/tickets/${ticketId}.json`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 404) return null
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        return mapZendeskTicket(data.ticket)
      } catch {
        return null
      }
    },

    async updateTicket(ticketId: string, updates: Partial<CreateTicketOptions>): Promise<TicketData> {
      const body: Record<string, unknown> = {
        ticket: {
          ...(updates.subject && { subject: updates.subject }),
          ...(updates.priority && { priority: updates.priority }),
          ...(updates.type && { type: updates.type }),
          ...(updates.assigneeId && { assignee_id: updates.assigneeId }),
          ...(updates.tags && { tags: updates.tags }),
          ...(updates.customFields && { custom_fields: updates.customFields }),
        },
      }

      // Add comment if description is provided
      if (updates.description) {
        (body.ticket as any).comment = { body: updates.description }
      }

      try {
        const response = await fetch(`${baseUrl}/tickets/${ticketId}.json`, {
          method: 'PUT',
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error((error as any)?.error || `HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        return mapZendeskTicket(data.ticket)
      } catch (error) {
        throw new Error(`Failed to update ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    async listTickets(options?: TicketListOptions): Promise<PaginatedResult<TicketData>> {
      const params = new URLSearchParams()

      if (options?.limit) params.append('per_page', options.limit.toString())
      if (options?.cursor) params.append('page[after]', options.cursor)
      if (options?.status) params.append('status', options.status)
      if (options?.priority) params.append('priority', options.priority)
      if (options?.assigneeId) params.append('assignee_id', options.assigneeId)
      if (options?.requesterId) params.append('requester_id', options.requesterId)

      const url = `${baseUrl}/tickets.json${params.toString() ? `?${params.toString()}` : ''}`

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        const tickets = (data.tickets || []).map(mapZendeskTicket)

        return {
          items: tickets,
          total: data.count,
          hasMore: data.next_page !== null,
          nextCursor: data.after_cursor,
        }
      } catch (error) {
        throw new Error(`Failed to list tickets: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    async closeTicket(ticketId: string): Promise<boolean> {
      try {
        const response = await fetch(`${baseUrl}/tickets/${ticketId}.json`, {
          method: 'PUT',
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticket: {
              status: 'closed',
            },
          }),
        })

        return response.ok
      } catch {
        return false
      }
    },

    async addTicketComment(ticketId: string, body: string, isPublic: boolean = true): Promise<TicketCommentData> {
      try {
        const response = await fetch(`${baseUrl}/tickets/${ticketId}.json`, {
          method: 'PUT',
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticket: {
              comment: {
                body,
                public: isPublic,
              },
            },
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error((error as any)?.error || `HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        const audit = data.audit || {}
        const comment = audit.events?.find((e: any) => e.type === 'Comment')

        return {
          id: audit.id?.toString() || '',
          ticketId,
          body,
          authorId: audit.author_id?.toString() || '',
          isPublic,
          createdAt: new Date(audit.created_at || Date.now()),
        }
      } catch (error) {
        throw new Error(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    async listTicketComments(ticketId: string): Promise<TicketCommentData[]> {
      try {
        const response = await fetch(`${baseUrl}/tickets/${ticketId}/comments.json`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        return (data.comments || []).map((comment: any) => ({
          id: comment.id.toString(),
          ticketId,
          body: comment.body || comment.plain_body || '',
          authorId: comment.author_id?.toString() || '',
          isPublic: comment.public !== false,
          createdAt: new Date(comment.created_at),
        }))
      } catch (error) {
        throw new Error(`Failed to list comments: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },

    async getUser(userId: string): Promise<SupportUserData | null> {
      try {
        const response = await fetch(`${baseUrl}/users/${userId}.json`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 404) return null
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        return mapZendeskUser(data.user)
      } catch {
        return null
      }
    },

    async searchUsers(query: string): Promise<SupportUserData[]> {
      try {
        const params = new URLSearchParams({ query })
        const response = await fetch(`${baseUrl}/users/search.json?${params.toString()}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${email}/token:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        return (data.users || []).map(mapZendeskUser)
      } catch (error) {
        throw new Error(`Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
  }
}

/**
 * Map Zendesk ticket to TicketData
 */
function mapZendeskTicket(ticket: any): TicketData {
  return {
    id: ticket.id.toString(),
    subject: ticket.subject || '',
    description: ticket.description || '',
    status: mapZendeskStatus(ticket.status),
    priority: ticket.priority || 'normal',
    type: ticket.type,
    requesterId: ticket.requester_id?.toString(),
    assigneeId: ticket.assignee_id?.toString(),
    tags: ticket.tags || [],
    createdAt: new Date(ticket.created_at),
    updatedAt: new Date(ticket.updated_at),
    solvedAt: ticket.solved_at ? new Date(ticket.solved_at) : undefined,
  }
}

/**
 * Map Zendesk status to standard status
 */
function mapZendeskStatus(status: string): TicketData['status'] {
  switch (status) {
    case 'new':
      return 'new'
    case 'open':
      return 'open'
    case 'pending':
      return 'pending'
    case 'hold':
      return 'hold'
    case 'solved':
      return 'solved'
    case 'closed':
      return 'closed'
    default:
      return 'open'
  }
}

/**
 * Map Zendesk user to SupportUserData
 */
function mapZendeskUser(user: any): SupportUserData {
  return {
    id: user.id.toString(),
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'end-user',
    createdAt: new Date(user.created_at),
  }
}

/**
 * Zendesk provider definition
 */
export const zendeskProvider = defineProvider(zendeskInfo, async (config) =>
  createZendeskProvider(config)
)
