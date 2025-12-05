/**
 * Google Calendar Provider
 *
 * Concrete implementation of CalendarProvider using Google Calendar API v3.
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

const GOOGLE_CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

/**
 * Google Calendar provider info
 */
export const googleCalendarInfo: ProviderInfo = {
  id: 'calendar.google-calendar',
  name: 'Google Calendar',
  description: 'Google Calendar API for managing calendars and events',
  category: 'calendar',
  website: 'https://calendar.google.com',
  docsUrl: 'https://developers.google.com/calendar/api/v3/reference',
  requiredConfig: ['accessToken'],
  optionalConfig: ['calendarId'],
}

/**
 * Create Google Calendar provider
 */
export function createGoogleCalendarProvider(config: ProviderConfig): CalendarProvider {
  let accessToken: string
  let defaultCalendarId: string | undefined

  /**
   * Helper to make authenticated API requests
   */
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    try {
      const response = await fetch(`${GOOGLE_CALENDAR_API_URL}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
        error: (errorData as any)?.error?.message || response.statusText,
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
    info: googleCalendarInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      defaultCalendarId = cfg.calendarId as string | undefined

      if (!accessToken) {
        throw new Error('Google Calendar access token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      const result = await apiRequest('/users/me/calendarList', { method: 'GET' })

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
      const params = new URLSearchParams()
      if (options?.limit) params.append('maxResults', String(options.limit))
      if (options?.cursor) params.append('pageToken', options.cursor)

      const result = await apiRequest<{
        items: any[]
        nextPageToken?: string
      }>(`/users/me/calendarList?${params}`)

      if (!result.ok || !result.data) {
        return { items: [], hasMore: false }
      }

      const items = result.data.items.map((cal: any) => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        primary: cal.primary || false,
        accessRole: cal.accessRole,
      }))

      return {
        items,
        hasMore: !!result.data.nextPageToken,
        nextCursor: result.data.nextPageToken,
      }
    },

    async getCalendar(calendarId: string): Promise<CalendarData | null> {
      const result = await apiRequest<any>(`/calendars/${encodeURIComponent(calendarId)}`)

      if (!result.ok || !result.data) {
        return null
      }

      const cal = result.data
      return {
        id: cal.id,
        name: cal.summary,
        description: cal.description,
        timeZone: cal.timeZone,
        primary: false,
        accessRole: 'owner',
      }
    },

    async createEvent(calendarId: string, event: CreateEventOptions): Promise<EventData> {
      const body = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: 'UTC',
        },
        attendees: event.attendees?.map((email) => ({ email })),
        reminders: event.reminders
          ? {
              useDefault: false,
              overrides: event.reminders.map((r) => ({ method: r.method, minutes: r.minutes })),
            }
          : { useDefault: true },
        recurrence: event.recurrence,
        conferenceData: event.conferenceData
          ? {
              createRequest: {
                requestId: `${Date.now()}-${Math.random()}`,
                conferenceSolutionKey: {
                  type: event.conferenceData.type === 'hangoutsMeet' ? 'hangoutsMeet' : 'hangoutsMeet',
                },
              },
            }
          : undefined,
      }

      const params = event.conferenceData ? '?conferenceDataVersion=1' : ''
      const result = await apiRequest<any>(`/calendars/${encodeURIComponent(calendarId)}/events${params}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to create event')
      }

      const evt = result.data
      return {
        id: evt.id,
        calendarId,
        summary: evt.summary,
        description: evt.description,
        location: evt.location,
        start: new Date(evt.start.dateTime || evt.start.date),
        end: new Date(evt.end.dateTime || evt.end.date),
        attendees: evt.attendees?.map((a: any) => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })),
        status: evt.status,
        recurringEventId: evt.recurringEventId,
        htmlLink: evt.htmlLink,
      }
    },

    async getEvent(calendarId: string, eventId: string): Promise<EventData | null> {
      const result = await apiRequest<any>(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
      )

      if (!result.ok || !result.data) {
        return null
      }

      const evt = result.data
      return {
        id: evt.id,
        calendarId,
        summary: evt.summary,
        description: evt.description,
        location: evt.location,
        start: new Date(evt.start.dateTime || evt.start.date),
        end: new Date(evt.end.dateTime || evt.end.date),
        attendees: evt.attendees?.map((a: any) => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })),
        status: evt.status,
        recurringEventId: evt.recurringEventId,
        htmlLink: evt.htmlLink,
      }
    },

    async updateEvent(
      calendarId: string,
      eventId: string,
      updates: Partial<CreateEventOptions>
    ): Promise<EventData> {
      const body: any = {}
      if (updates.summary !== undefined) body.summary = updates.summary
      if (updates.description !== undefined) body.description = updates.description
      if (updates.location !== undefined) body.location = updates.location
      if (updates.start) {
        body.start = {
          dateTime: updates.start.toISOString(),
          timeZone: 'UTC',
        }
      }
      if (updates.end) {
        body.end = {
          dateTime: updates.end.toISOString(),
          timeZone: 'UTC',
        }
      }
      if (updates.attendees) {
        body.attendees = updates.attendees.map((email) => ({ email }))
      }
      if (updates.reminders) {
        body.reminders = {
          useDefault: false,
          overrides: updates.reminders.map((r) => ({ method: r.method, minutes: r.minutes })),
        }
      }
      if (updates.recurrence) {
        body.recurrence = updates.recurrence
      }

      const result = await apiRequest<any>(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      )

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to update event')
      }

      const evt = result.data
      return {
        id: evt.id,
        calendarId,
        summary: evt.summary,
        description: evt.description,
        location: evt.location,
        start: new Date(evt.start.dateTime || evt.start.date),
        end: new Date(evt.end.dateTime || evt.end.date),
        attendees: evt.attendees?.map((a: any) => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })),
        status: evt.status,
        recurringEventId: evt.recurringEventId,
        htmlLink: evt.htmlLink,
      }
    },

    async deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
      const result = await apiRequest(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
        }
      )

      return result.ok
    },

    async listEvents(
      calendarId: string,
      options?: EventListOptions
    ): Promise<PaginatedResult<EventData>> {
      const params = new URLSearchParams()
      if (options?.limit) params.append('maxResults', String(options.limit))
      if (options?.cursor) params.append('pageToken', options.cursor)
      if (options?.timeMin) params.append('timeMin', options.timeMin.toISOString())
      if (options?.timeMax) params.append('timeMax', options.timeMax.toISOString())
      if (options?.singleEvents !== undefined) params.append('singleEvents', String(options.singleEvents))
      if (options?.orderBy) params.append('orderBy', options.orderBy)

      const result = await apiRequest<{
        items: any[]
        nextPageToken?: string
      }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`)

      if (!result.ok || !result.data) {
        return { items: [], hasMore: false }
      }

      const items = result.data.items.map((evt: any) => ({
        id: evt.id,
        calendarId,
        summary: evt.summary,
        description: evt.description,
        location: evt.location,
        start: new Date(evt.start.dateTime || evt.start.date),
        end: new Date(evt.end.dateTime || evt.end.date),
        attendees: evt.attendees?.map((a: any) => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })),
        status: evt.status,
        recurringEventId: evt.recurringEventId,
        htmlLink: evt.htmlLink,
      }))

      return {
        items,
        hasMore: !!result.data.nextPageToken,
        nextCursor: result.data.nextPageToken,
      }
    },

    async findAvailability(
      calendarIds: string[],
      timeMin: Date,
      timeMax: Date
    ): Promise<AvailabilityData[]> {
      const body = {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      }

      const result = await apiRequest<{
        calendars: Record<string, { busy: Array<{ start: string; end: string }> }>
      }>('/freeBusy', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!result.ok || !result.data) {
        return []
      }

      return calendarIds.map((calendarId) => {
        const calendar = result.data!.calendars[calendarId]
        return {
          calendarId,
          busy: calendar?.busy?.map((slot) => ({
            start: new Date(slot.start),
            end: new Date(slot.end),
          })) || [],
        }
      })
    },
  }
}

/**
 * Google Calendar provider definition
 */
export const googleCalendarProvider = defineProvider(googleCalendarInfo, async (config) =>
  createGoogleCalendarProvider(config)
)
