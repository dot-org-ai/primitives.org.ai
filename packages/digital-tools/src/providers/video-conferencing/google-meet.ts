/**
 * Google Meet Video Conferencing Provider
 *
 * Concrete implementation of VideoConferencingProvider using Google Calendar API v3
 * to create and manage Google Meet video conferences.
 *
 * @packageDocumentation
 */

import type {
  VideoConferencingProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  CreateMeetingOptions,
  MeetingData,
  MeetingListOptions,
  PaginatedResult,
  ParticipantData,
  MeetingRecordingData,
} from '../types.js'
import { defineProvider } from '../registry.js'

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

/**
 * Google Meet provider info
 */
export const googleMeetInfo: ProviderInfo = {
  id: 'meeting.google-meet',
  name: 'Google Meet',
  description: 'Google Meet video conferencing via Google Calendar API',
  category: 'video-conferencing',
  website: 'https://meet.google.com',
  docsUrl: 'https://developers.google.com/calendar/api',
  requiredConfig: ['accessToken'],
  optionalConfig: ['clientId', 'clientSecret', 'refreshToken'],
}

/**
 * Google Calendar API response types
 */
interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: {
    dateTime: string
    timeZone?: string
  }
  end: {
    dateTime: string
    timeZone?: string
  }
  hangoutLink?: string
  conferenceData?: {
    conferenceId: string
    conferenceSolution: {
      name: string
      iconUri?: string
    }
    entryPoints: Array<{
      entryPointType: string
      uri: string
      label?: string
    }>
  }
  status: string
  created: string
  creator?: {
    id?: string
    email?: string
  }
}

interface GoogleCalendarEventList {
  items: GoogleCalendarEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  refresh_token?: string
}

/**
 * Create Google Meet provider
 */
export function createGoogleMeetProvider(config: ProviderConfig): VideoConferencingProvider {
  let accessToken: string
  let clientId: string | undefined
  let clientSecret: string | undefined
  let refreshToken: string | undefined
  let tokenExpiresAt: number = 0
  let calendarId = 'primary'

  /**
   * Refresh OAuth access token
   */
  async function refreshAccessToken(): Promise<string> {
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('clientId, clientSecret, and refreshToken required for token refresh')
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh access token: HTTP ${response.status}`)
    }

    const data = (await response.json()) as GoogleTokenResponse
    accessToken = data.access_token
    tokenExpiresAt = Date.now() + data.expires_in * 1000

    return accessToken
  }

  /**
   * Get valid access token
   */
  async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5-minute buffer)
    if (accessToken && Date.now() < tokenExpiresAt - 300000) {
      return accessToken
    }

    // Try to refresh if we have refresh token
    if (refreshToken) {
      return refreshAccessToken()
    }

    // Otherwise use the provided token
    return accessToken
  }

  /**
   * Make authenticated API request
   */
  async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken()
    const url = `${CALENDAR_API_URL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Google Calendar API error: ${response.status} - ${
          (errorData as any)?.error?.message || response.statusText
        }`
      )
    }

    return response.json() as Promise<T>
  }

  /**
   * Convert Google Calendar event to MeetingData
   */
  function convertEvent(event: GoogleCalendarEvent): MeetingData {
    const startTime = new Date(event.start.dateTime)
    const endTime = new Date(event.end.dateTime)
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000) // minutes

    return {
      id: event.id,
      topic: event.summary,
      startTime,
      duration,
      ...(event.start.timeZone !== undefined && { timezone: event.start.timeZone }),
      ...(event.description !== undefined && { agenda: event.description }),
      joinUrl: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || '',
      hostId: event.creator?.id || event.creator?.email || '',
      status: event.status === 'confirmed' ? 'waiting' : 'finished',
      createdAt: new Date(event.created),
    }
  }

  return {
    info: googleMeetInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      clientId = cfg['clientId'] as string | undefined
      clientSecret = cfg['clientSecret'] as string | undefined
      refreshToken = cfg.refreshToken as string | undefined

      if (!accessToken) {
        throw new Error('Google Meet requires accessToken')
      }

      // Override calendar ID if provided
      if (cfg['calendarId']) {
        calendarId = cfg['calendarId'] as string
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Get calendar to verify API access
        await apiRequest(`/calendars/${calendarId}`)

        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: 'Connected',
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
      // Clear cached token
      accessToken = ''
      tokenExpiresAt = 0
    },

    async createMeeting(meeting: CreateMeetingOptions): Promise<MeetingData> {
      const endTime = meeting.startTime
        ? new Date(meeting.startTime.getTime() + (meeting.duration || 60) * 60000)
        : new Date(Date.now() + (meeting.duration || 60) * 60000)

      const body = {
        summary: meeting.topic,
        description: meeting.agenda,
        start: {
          dateTime: (meeting.startTime || new Date()).toISOString(),
          timeZone: meeting.timezone || 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: meeting.timezone || 'UTC',
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      }

      const response = await apiRequest<GoogleCalendarEvent>(
        `/calendars/${calendarId}/events?conferenceDataVersion=1`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      )

      return convertEvent(response)
    },

    async getMeeting(meetingId: string): Promise<MeetingData | null> {
      try {
        const response = await apiRequest<GoogleCalendarEvent>(
          `/calendars/${calendarId}/events/${meetingId}`
        )
        return convertEvent(response)
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null
        }
        throw error
      }
    },

    async updateMeeting(
      meetingId: string,
      updates: Partial<CreateMeetingOptions>
    ): Promise<MeetingData> {
      // First get the current event
      const current = await this.getMeeting(meetingId)
      if (!current) {
        throw new Error(`Meeting ${meetingId} not found`)
      }

      const body: Record<string, unknown> = {}

      if (updates.topic) body['summary'] = updates.topic
      if (updates.agenda !== undefined) body['description'] = updates.agenda

      if (updates.startTime) {
        const endTime = new Date(
          updates.startTime.getTime() + (updates.duration || current.duration || 60) * 60000
        )
        body['start'] = {
          dateTime: updates.startTime.toISOString(),
          timeZone: updates.timezone || current.timezone || 'UTC',
        }
        body['end'] = {
          dateTime: endTime.toISOString(),
          timeZone: updates.timezone || current.timezone || 'UTC',
        }
      }

      const response = await apiRequest<GoogleCalendarEvent>(
        `/calendars/${calendarId}/events/${meetingId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      )

      return convertEvent(response)
    },

    async deleteMeeting(meetingId: string): Promise<boolean> {
      try {
        await apiRequest(`/calendars/${calendarId}/events/${meetingId}`, {
          method: 'DELETE',
        })
        return true
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return false
        }
        throw error
      }
    },

    async listMeetings(options: MeetingListOptions = {}): Promise<PaginatedResult<MeetingData>> {
      const params = new URLSearchParams()

      // Set time range based on type
      const now = new Date()
      if (options.type === 'upcoming' || options.type === 'scheduled') {
        params.append('timeMin', now.toISOString())
      } else if (options.type === 'previous') {
        params.append('timeMax', now.toISOString())
      }

      params.append('singleEvents', 'true')
      params.append('orderBy', 'startTime')

      if (options.limit) params.append('maxResults', options.limit.toString())
      if (options.cursor) params.append('pageToken', options.cursor)

      const response = await apiRequest<GoogleCalendarEventList>(
        `/calendars/${calendarId}/events?${params.toString()}`
      )

      // Filter to only events with Meet links
      const meetEvents = response.items.filter((event) => event.hangoutLink || event.conferenceData)

      return {
        items: meetEvents.map(convertEvent),
        hasMore: !!response.nextPageToken,
        ...(response.nextPageToken !== undefined && { nextCursor: response.nextPageToken }),
      }
    },

    endMeeting: async function (meetingId: string): Promise<boolean> {
      // Google Meet doesn't support programmatically ending meetings
      // We can delete the calendar event instead
      return await this.deleteMeeting!(meetingId)
    },

    async getParticipants(meetingId: string): Promise<ParticipantData[]> {
      // Google Calendar API doesn't provide participant data for past meetings
      // This would require Google Meet API access which is more restricted
      return []
    },

    async getRecordings(meetingId: string): Promise<MeetingRecordingData[]> {
      // Google Meet recordings are stored in Google Drive
      // This would require Google Drive API access
      return []
    },
  }
}

/**
 * Google Meet provider definition
 */
export const googleMeetProvider = defineProvider(googleMeetInfo, async (config) =>
  createGoogleMeetProvider(config)
)
