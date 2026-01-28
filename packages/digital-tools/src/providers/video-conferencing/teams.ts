/**
 * Microsoft Teams Video Conferencing Provider
 *
 * Concrete implementation of VideoConferencingProvider using Microsoft Graph API
 * to create and manage Microsoft Teams online meetings.
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

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0'

/**
 * Microsoft Teams provider info
 */
export const teamsInfo: ProviderInfo = {
  id: 'meeting.teams',
  name: 'Microsoft Teams',
  description: 'Microsoft Teams video conferencing via Microsoft Graph API',
  category: 'video-conferencing',
  website: 'https://teams.microsoft.com',
  docsUrl: 'https://docs.microsoft.com/en-us/graph/api/resources/onlinemeeting',
  requiredConfig: ['accessToken'],
  optionalConfig: ['clientId', 'clientSecret', 'tenantId'],
}

/**
 * Microsoft Graph API response types
 */
interface GraphOnlineMeeting {
  id: string
  subject: string
  startDateTime: string
  endDateTime: string
  joinWebUrl: string
  joinUrl?: string
  videoTeleconferenceId?: string
  participants?: {
    organizer?: {
      identity: {
        user?: {
          id: string
          displayName?: string
        }
      }
    }
    attendees?: Array<{
      identity: {
        user?: {
          id: string
          displayName?: string
        }
      }
    }>
  }
  lobbyBypassSettings?: {
    scope: string
    isDialInBypassEnabled: boolean
  }
  audioConferencing?: {
    tollNumber?: string
    tollFreeNumber?: string
    conferenceId?: string
  }
  chatInfo?: {
    threadId: string
  }
  creationDateTime: string
}

interface GraphOnlineMeetingList {
  value: GraphOnlineMeeting[]
  '@odata.nextLink'?: string
}

interface GraphTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  refresh_token?: string
}

interface GraphUser {
  id: string
  displayName: string
  mail?: string
}

/**
 * Create Microsoft Teams provider
 */
export function createTeamsProvider(config: ProviderConfig): VideoConferencingProvider {
  let accessToken: string
  let clientId: string | undefined
  let clientSecret: string | undefined
  let tenantId: string | undefined
  let tokenExpiresAt: number = 0
  let currentUserId: string | undefined

  /**
   * Refresh OAuth access token
   */
  async function refreshAccessToken(): Promise<string> {
    if (!clientId || !clientSecret || !tenantId) {
      throw new Error('clientId, clientSecret, and tenantId required for token refresh')
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to refresh access token: HTTP ${response.status}`)
    }

    const data = (await response.json()) as GraphTokenResponse
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

    // Try to refresh if we have credentials
    if (tenantId && clientId && clientSecret) {
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
    const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_URL}${endpoint}`

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
        `Microsoft Graph API error: ${response.status} - ${
          (errorData as any)?.error?.message || response.statusText
        }`
      )
    }

    return response.json() as Promise<T>
  }

  /**
   * Get current user ID
   */
  async function getUserId(): Promise<string> {
    if (currentUserId) {
      return currentUserId
    }

    const user = await apiRequest<GraphUser>('/me')
    currentUserId = user.id
    return currentUserId
  }

  /**
   * Convert Graph online meeting to MeetingData
   */
  function convertMeeting(meeting: GraphOnlineMeeting): MeetingData {
    const startTime = new Date(meeting.startDateTime)
    const endTime = new Date(meeting.endDateTime)
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000) // minutes

    return {
      id: meeting.id,
      topic: meeting.subject,
      startTime,
      duration,
      joinUrl: meeting.joinWebUrl || meeting.joinUrl || '',
      hostId: meeting.participants?.organizer?.identity?.user?.id || '',
      status: 'waiting',
      createdAt: new Date(meeting.creationDateTime),
    }
  }

  return {
    info: teamsInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      clientId = cfg['clientId'] as string | undefined
      clientSecret = cfg['clientSecret'] as string | undefined
      tenantId = cfg['tenantId'] as string | undefined

      if (!accessToken) {
        throw new Error('Microsoft Teams requires accessToken')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Get current user to verify API access
        await apiRequest('/me')

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
      currentUserId = undefined
    },

    async createMeeting(meeting: CreateMeetingOptions): Promise<MeetingData> {
      const userId = await getUserId()
      const startTime = meeting.startTime || new Date()
      const endTime = new Date(startTime.getTime() + (meeting.duration || 60) * 60000)

      const body = {
        subject: meeting.topic,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
        participants: {
          attendees: [],
        },
      }

      const response = await apiRequest<GraphOnlineMeeting>(`/users/${userId}/onlineMeetings`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      return convertMeeting(response)
    },

    async getMeeting(meetingId: string): Promise<MeetingData | null> {
      try {
        const userId = await getUserId()
        const response = await apiRequest<GraphOnlineMeeting>(
          `/users/${userId}/onlineMeetings/${meetingId}`
        )
        return convertMeeting(response)
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
      const userId = await getUserId()

      // First get the current meeting
      const current = await this.getMeeting(meetingId)
      if (!current) {
        throw new Error(`Meeting ${meetingId} not found`)
      }

      const body: Record<string, unknown> = {}

      if (updates.topic) body['subject'] = updates.topic

      if (updates.startTime) {
        const endTime = new Date(
          updates.startTime.getTime() + (updates.duration || current.duration || 60) * 60000
        )
        body['startDateTime'] = updates.startTime.toISOString()
        body['endDateTime'] = endTime.toISOString()
      }

      const response = await apiRequest<GraphOnlineMeeting>(
        `/users/${userId}/onlineMeetings/${meetingId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      )

      return convertMeeting(response)
    },

    async deleteMeeting(meetingId: string): Promise<boolean> {
      try {
        const userId = await getUserId()
        await apiRequest(`/users/${userId}/onlineMeetings/${meetingId}`, {
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
      const userId = await getUserId()
      const params = new URLSearchParams()

      if (options.limit) params.append('$top', options.limit.toString())

      // Note: Graph API doesn't provide easy filtering by time for online meetings
      // We'll fetch and filter client-side if needed
      let endpoint = `/users/${userId}/onlineMeetings`
      if (params.toString()) {
        endpoint += `?${params.toString()}`
      }

      // Handle pagination cursor
      const url = options.cursor || endpoint

      const response = await apiRequest<GraphOnlineMeetingList>(url)

      return {
        items: response.value.map(convertMeeting),
        hasMore: !!response['@odata.nextLink'],
        ...(response['@odata.nextLink'] !== undefined && {
          nextCursor: response['@odata.nextLink'],
        }),
      }
    },

    endMeeting: async function (meetingId: string): Promise<boolean> {
      // Microsoft Teams doesn't support programmatically ending meetings
      // We can delete the meeting instead
      return await this.deleteMeeting!(meetingId)
    },

    async getParticipants(meetingId: string): Promise<ParticipantData[]> {
      // Microsoft Graph API doesn't provide detailed participant data
      // This would require Teams Meeting Recording APIs with admin consent
      return []
    },

    async getRecordings(meetingId: string): Promise<MeetingRecordingData[]> {
      // Microsoft Teams recordings are stored in OneDrive/SharePoint
      // This would require additional Graph API calls with different permissions
      return []
    },
  }
}

/**
 * Microsoft Teams provider definition
 */
export const teamsProvider = defineProvider(teamsInfo, async (config) =>
  createTeamsProvider(config)
)
