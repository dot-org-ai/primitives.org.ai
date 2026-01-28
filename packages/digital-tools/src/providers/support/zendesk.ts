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

// =============================================================================
// Zendesk API Response Types
// =============================================================================

/**
 * Zendesk API error response
 */
interface ZendeskErrorResponse {
  error?: string
  description?: string
  details?: Record<string, unknown>
}

/**
 * Zendesk ticket from API
 */
interface ZendeskTicket {
  id: number
  subject: string
  description: string
  status: string
  priority: string | null
  type: string | null
  requester_id: number | null
  assignee_id: number | null
  tags: string[]
  created_at: string
  updated_at: string
  solved_at: string | null
}

/**
 * Zendesk single ticket response
 */
interface ZendeskTicketResponse {
  ticket: ZendeskTicket
}

/**
 * Zendesk tickets list response
 */
interface ZendeskTicketsListResponse {
  tickets: ZendeskTicket[]
  count?: number
  next_page: string | null
  after_cursor?: string
}

/**
 * Zendesk comment from API
 */
interface ZendeskComment {
  id: number
  body: string
  plain_body?: string
  author_id: number | null
  public: boolean
  created_at: string
}

/**
 * Zendesk comments list response
 */
interface ZendeskCommentsResponse {
  comments: ZendeskComment[]
}

/**
 * Zendesk audit event
 */
interface ZendeskAuditEvent {
  type: string
  id?: number
}

/**
 * Zendesk audit from ticket update
 */
interface ZendeskAudit {
  id?: number
  author_id?: number
  created_at?: string
  events?: ZendeskAuditEvent[]
}

/**
 * Zendesk ticket update response with audit
 */
interface ZendeskTicketUpdateResponse {
  ticket: ZendeskTicket
  audit?: ZendeskAudit
}

/**
 * Zendesk user from API
 */
interface ZendeskUser {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

/**
 * Zendesk single user response
 */
interface ZendeskUserResponse {
  user: ZendeskUser
}

/**
 * Zendesk users search response
 */
interface ZendeskUsersSearchResponse {
  users: ZendeskUser[]
}

/**
 * Zendesk ticket update request body
 */
interface ZendeskTicketUpdateBody {
  subject?: string
  priority?: string
  type?: string
  assignee_id?: string
  tags?: string[]
  custom_fields?: Record<string, unknown>
  comment?: { body: string }
}

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
      subdomain = cfg['subdomain'] as string
      apiKey = cfg['apiKey'] as string
      email = cfg['email'] as string

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
          const error = (await response.json().catch(() => ({}))) as ZendeskErrorResponse
          throw new Error(error.error || `HTTP ${response.status}`)
        }

        const data = (await response.json()) as ZendeskTicketResponse
        return mapZendeskTicket(data.ticket)
      } catch (error) {
        throw new Error(
          `Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
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

        const data = (await response.json()) as ZendeskTicketResponse
        return mapZendeskTicket(data.ticket)
      } catch {
        return null
      }
    },

    async updateTicket(
      ticketId: string,
      updates: Partial<CreateTicketOptions>
    ): Promise<TicketData> {
      const ticketBody: ZendeskTicketUpdateBody = {
        ...(updates.subject && { subject: updates.subject }),
        ...(updates.priority && { priority: updates.priority }),
        ...(updates.type && { type: updates.type }),
        ...(updates.assigneeId && { assignee_id: updates.assigneeId }),
        ...(updates.tags && { tags: updates.tags }),
        ...(updates.customFields && { custom_fields: updates.customFields }),
      }

      // Add comment if description is provided
      if (updates.description) {
        ticketBody.comment = { body: updates.description }
      }

      const body = { ticket: ticketBody }

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
          const error = (await response.json().catch(() => ({}))) as ZendeskErrorResponse
          throw new Error(error.error || `HTTP ${response.status}`)
        }

        const data = (await response.json()) as ZendeskTicketResponse
        return mapZendeskTicket(data.ticket)
      } catch (error) {
        throw new Error(
          `Failed to update ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
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

        const data = (await response.json()) as ZendeskTicketsListResponse
        const tickets = (data.tickets || []).map(mapZendeskTicket)

        return {
          items: tickets,
          ...(data.count !== undefined && { total: data.count }),
          hasMore: data.next_page !== null,
          ...(data.after_cursor !== undefined && { nextCursor: data.after_cursor }),
        }
      } catch (error) {
        throw new Error(
          `Failed to list tickets: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
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

    async addTicketComment(
      ticketId: string,
      body: string,
      isPublic: boolean = true
    ): Promise<TicketCommentData> {
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
          const error = (await response.json().catch(() => ({}))) as ZendeskErrorResponse
          throw new Error(error.error || `HTTP ${response.status}`)
        }

        const data = (await response.json()) as ZendeskTicketUpdateResponse
        const audit: ZendeskAudit = data.audit || {}
        const comment = audit.events?.find((e: ZendeskAuditEvent) => e.type === 'Comment')

        return {
          id: audit.id?.toString() || '',
          ticketId,
          body,
          authorId: audit.author_id?.toString() || '',
          isPublic,
          createdAt: new Date(audit.created_at || Date.now()),
        }
      } catch (error) {
        throw new Error(
          `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
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

        const data = (await response.json()) as ZendeskCommentsResponse
        return (data.comments || []).map((comment: ZendeskComment) => ({
          id: comment.id.toString(),
          ticketId,
          body: comment.body || comment.plain_body || '',
          authorId: comment.author_id?.toString() || '',
          isPublic: comment.public !== false,
          createdAt: new Date(comment.created_at),
        }))
      } catch (error) {
        throw new Error(
          `Failed to list comments: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
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

        const data = (await response.json()) as ZendeskUserResponse
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

        const data = (await response.json()) as ZendeskUsersSearchResponse
        return (data.users || []).map(mapZendeskUser)
      } catch (error) {
        throw new Error(
          `Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  }
}

/**
 * Map Zendesk ticket to TicketData
 */
function mapZendeskTicket(ticket: ZendeskTicket): TicketData {
  return {
    id: ticket.id.toString(),
    subject: ticket.subject || '',
    description: ticket.description || '',
    status: mapZendeskStatus(ticket.status),
    priority: ticket.priority || 'normal',
    ...(ticket.type !== null && { type: ticket.type }),
    ...(ticket.requester_id !== null && { requesterId: ticket.requester_id.toString() }),
    ...(ticket.assignee_id !== null && { assigneeId: ticket.assignee_id.toString() }),
    tags: ticket.tags || [],
    createdAt: new Date(ticket.created_at),
    updatedAt: new Date(ticket.updated_at),
    ...(ticket.solved_at !== null && { solvedAt: new Date(ticket.solved_at) }),
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
function mapZendeskUser(user: ZendeskUser): SupportUserData {
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
