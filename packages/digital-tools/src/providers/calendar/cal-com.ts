/**
 * Cal.com Provider
 *
 * Concrete implementation of CalendarProvider using Cal.com API v1.
 * Cal.com is an open-source Calendly alternative for scheduling.
 *
 * @packageDocumentation
 */

import type {
  CalendarProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  CalendarData,
  CreateEventOptions,
  EventData,
  EventListOptions,
  PaginatedResult,
  AvailabilityData,
  PaginationOptions,
} from '../types.js'
import { defineProvider } from '../registry.js'

const DEFAULT_BASE_URL = 'https://api.cal.com/v1'

/**
 * Cal.com provider info
 */
export const calComInfo: ProviderInfo = {
  id: 'calendar.cal-com',
  name: 'Cal.com',
  description:
    'Cal.com API for scheduling and calendar management (open-source Calendly alternative)',
  category: 'calendar',
  website: 'https://cal.com',
  docsUrl: 'https://cal.com/docs/api-reference',
  requiredConfig: ['apiKey'],
  optionalConfig: ['baseUrl'],
}

/**
 * Cal.com API Response Types
 */
interface CalComEventType {
  id: number
  title: string
  slug: string
  length: number
  description?: string
  hidden: boolean
  position: number
  userId?: number
  teamId?: number
  locations?: Array<{ type: string; address?: string; link?: string }>
}

interface CalComBooking {
  id: number
  uid: string
  title: string
  description?: string
  startTime: string
  endTime: string
  status: 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'REJECTED'
  attendees: Array<{
    email: string
    name: string
    timeZone: string
    locale?: string
  }>
  location?: string
  eventTypeId: number
  userId?: number
  metadata?: Record<string, unknown>
}

interface CalComAvailability {
  busy: Array<{
    start: string
    end: string
  }>
}

/**
 * Create Cal.com provider
 */
export function createCalComProvider(config: ProviderConfig): CalendarProvider {
  let apiKey: string
  let baseUrl: string

  /**
   * Helper to make authenticated API requests
   */
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    try {
      const url = `${baseUrl}${endpoint}`
      const params = new URLSearchParams()

      // Cal.com uses apiKey query parameter for authentication
      params.append('apiKey', apiKey)

      const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${params}`

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (response.ok) {
        const data = (await response.json()) as T
        return { ok: true, status: response.status, data }
      }

      const errorData = await response.json().catch(() => ({}))
      return {
        ok: false,
        status: response.status,
        error: (errorData as any)?.message || response.statusText,
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    info: calComInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      apiKey = cfg.apiKey as string
      baseUrl = (cfg.baseUrl as string) || DEFAULT_BASE_URL

      if (!apiKey) {
        throw new Error('Cal.com API key is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      const result = await apiRequest('/me', { method: 'GET' })

      return {
        healthy: result.ok,
        latencyMs: Date.now() - start,
        message: result.ok ? 'Connected' : result.error || `HTTP ${result.status}`,
        checkedAt: new Date(),
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async listCalendars(options?: PaginationOptions): Promise<PaginatedResult<CalendarData>> {
      // Cal.com uses "event types" as calendar configurations
      const params = new URLSearchParams()
      if (options?.limit) params.append('take', String(options.limit))
      if (options?.cursor) params.append('skip', String(options.cursor))

      const result = await apiRequest<{
        event_types: CalComEventType[]
      }>(`/event-types?${params}`)

      if (!result.ok || !result.data) {
        return { items: [], hasMore: false }
      }

      const items = result.data.event_types
        .filter((et) => !et.hidden)
        .map((et) => ({
          id: String(et.id),
          name: et.title,
          ...(et.description !== undefined && { description: et.description }),
          timeZone: 'UTC', // Cal.com handles timezone per user
          primary: et.position === 0,
          accessRole: 'owner' as const,
        }))

      return {
        items,
        hasMore: result.data.event_types.length >= (options?.limit || 10),
      }
    },

    async getCalendar(calendarId: string): Promise<CalendarData | null> {
      const result = await apiRequest<{
        event_type: CalComEventType
      }>(`/event-types/${calendarId}`)

      if (!result.ok || !result.data) {
        return null
      }

      const et = result.data.event_type
      return {
        id: String(et.id),
        name: et.title,
        ...(et.description !== undefined && { description: et.description }),
        timeZone: 'UTC',
        primary: et.position === 0,
        accessRole: 'owner',
      }
    },

    async createEvent(calendarId: string, event: CreateEventOptions): Promise<EventData> {
      // In Cal.com, creating a booking is done through the booking endpoint
      const body = {
        eventTypeId: parseInt(calendarId, 10),
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        responses: {
          name: event.summary,
          email: event.attendees?.[0] || 'guest@example.com',
          notes: event.description,
          location: event.location,
        },
        timeZone: 'UTC',
        language: 'en',
        metadata: {},
      }

      const result = await apiRequest<{
        booking: CalComBooking
      }>('/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to create booking')
      }

      const booking = result.data.booking
      return {
        id: booking.uid,
        calendarId,
        summary: booking.title,
        ...(booking.description !== undefined && { description: booking.description }),
        ...(booking.location !== undefined && { location: booking.location }),
        start: new Date(booking.startTime),
        end: new Date(booking.endTime),
        attendees: booking.attendees.map((a) => ({
          email: a.email,
          responseStatus: booking.status === 'ACCEPTED' ? 'accepted' : 'needsAction',
        })),
        status: (booking.status === 'CANCELLED' ? 'cancelled' : 'confirmed') as
          | 'confirmed'
          | 'tentative'
          | 'cancelled',
        htmlLink: `${baseUrl.replace('/v1', '')}/booking/${booking.uid}`,
      }
    },

    async getEvent(calendarId: string, eventId: string): Promise<EventData | null> {
      const result = await apiRequest<{
        booking: CalComBooking
      }>(`/bookings/${eventId}`)

      if (!result.ok || !result.data) {
        return null
      }

      const booking = result.data.booking
      return {
        id: booking.uid,
        calendarId: String(booking.eventTypeId),
        summary: booking.title,
        ...(booking.description !== undefined && { description: booking.description }),
        ...(booking.location !== undefined && { location: booking.location }),
        start: new Date(booking.startTime),
        end: new Date(booking.endTime),
        attendees: booking.attendees.map((a) => ({
          email: a.email,
          responseStatus: booking.status === 'ACCEPTED' ? 'accepted' : 'needsAction',
        })),
        status: (booking.status === 'CANCELLED' ? 'cancelled' : 'confirmed') as
          | 'confirmed'
          | 'tentative'
          | 'cancelled',
        htmlLink: `${baseUrl.replace('/v1', '')}/booking/${booking.uid}`,
      }
    },

    async updateEvent(
      calendarId: string,
      eventId: string,
      updates: Partial<CreateEventOptions>
    ): Promise<EventData> {
      // Cal.com bookings are typically rescheduled rather than updated
      const body: any = {}

      if (updates.start && updates.end) {
        body.start = updates.start.toISOString()
        body.end = updates.end.toISOString()
      }

      if (updates.summary) {
        body.title = updates.summary
      }

      if (updates.description) {
        body.description = updates.description
      }

      const result = await apiRequest<{
        booking: CalComBooking
      }>(`/bookings/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to update booking')
      }

      const booking = result.data.booking
      return {
        id: booking.uid,
        calendarId: String(booking.eventTypeId),
        summary: booking.title,
        ...(booking.description !== undefined && { description: booking.description }),
        ...(booking.location !== undefined && { location: booking.location }),
        start: new Date(booking.startTime),
        end: new Date(booking.endTime),
        attendees: booking.attendees.map((a) => ({
          email: a.email,
          responseStatus: booking.status === 'ACCEPTED' ? 'accepted' : 'needsAction',
        })),
        status: (booking.status === 'CANCELLED' ? 'cancelled' : 'confirmed') as
          | 'confirmed'
          | 'tentative'
          | 'cancelled',
        htmlLink: `${baseUrl.replace('/v1', '')}/booking/${booking.uid}`,
      }
    },

    async deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
      // Cancel the booking
      const result = await apiRequest(`/bookings/${eventId}`, {
        method: 'DELETE',
      })

      return result.ok
    },

    async listEvents(
      calendarId: string,
      options?: EventListOptions
    ): Promise<PaginatedResult<EventData>> {
      const params = new URLSearchParams()

      if (options?.limit) params.append('take', String(options.limit))
      if (options?.cursor) params.append('skip', String(options.cursor))

      // Filter by event type (calendar)
      params.append('eventTypeId', calendarId)

      if (options?.timeMin) params.append('afterStart', options.timeMin.toISOString())
      if (options?.timeMax) params.append('beforeEnd', options.timeMax.toISOString())

      const result = await apiRequest<{
        bookings: CalComBooking[]
      }>(`/bookings?${params}`)

      if (!result.ok || !result.data) {
        return { items: [], hasMore: false }
      }

      const items = result.data.bookings.map((booking) => ({
        id: booking.uid,
        calendarId: String(booking.eventTypeId),
        summary: booking.title,
        ...(booking.description !== undefined && { description: booking.description }),
        ...(booking.location !== undefined && { location: booking.location }),
        start: new Date(booking.startTime),
        end: new Date(booking.endTime),
        attendees: booking.attendees.map((a) => ({
          email: a.email,
          responseStatus: booking.status === 'ACCEPTED' ? 'accepted' : 'needsAction',
        })),
        status: (booking.status === 'CANCELLED' ? 'cancelled' : 'confirmed') as
          | 'confirmed'
          | 'tentative'
          | 'cancelled',
        htmlLink: `${baseUrl.replace('/v1', '')}/booking/${booking.uid}`,
      }))

      return {
        items,
        hasMore: result.data.bookings.length >= (options?.limit || 10),
      }
    },

    async findAvailability(
      calendarIds: string[],
      timeMin: Date,
      timeMax: Date
    ): Promise<AvailabilityData[]> {
      // Cal.com's availability endpoint
      const results: AvailabilityData[] = []

      for (const calendarId of calendarIds) {
        const params = new URLSearchParams()
        params.append('eventTypeId', calendarId)
        params.append('dateFrom', timeMin.toISOString())
        params.append('dateTo', timeMax.toISOString())

        const result = await apiRequest<CalComAvailability>(`/availability?${params}`)

        if (result.ok && result.data) {
          results.push({
            calendarId,
            busy: result.data.busy.map((slot) => ({
              start: new Date(slot.start),
              end: new Date(slot.end),
            })),
          })
        } else {
          results.push({
            calendarId,
            busy: [],
          })
        }
      }

      return results
    },
  }
}

/**
 * Cal.com provider definition
 */
export const calComProvider = defineProvider(calComInfo, async (config) =>
  createCalComProvider(config)
)
