/**
 * Zoom Video Conferencing Provider
 *
 * Concrete implementation of VideoConferencingProvider using Zoom API v2.
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

const ZOOM_API_URL = 'https://api.zoom.us/v2'

/**
 * Zoom provider info
 */
export const zoomInfo: ProviderInfo = {
  id: 'video-conferencing.zoom',
  name: 'Zoom',
  description: 'Zoom video conferencing and webinar platform',
  category: 'video-conferencing',
  website: 'https://zoom.us',
  docsUrl: 'https://developers.zoom.us/docs/api/',
  requiredConfig: ['accountId', 'clientId', 'clientSecret'],
  optionalConfig: ['accessToken'],
}

/**
 * Zoom API response types
 */
interface ZoomMeetingResponse {
  id: number
  topic: string
  start_time?: string
  duration?: number
  timezone?: string
  agenda?: string
  join_url: string
  host_id: string
  status: string
  password?: string
  created_at: string
  settings?: {
    host_video?: boolean
    participant_video?: boolean
    join_before_host?: boolean
    mute_upon_entry?: boolean
    waiting_room?: boolean
    auto_recording?: string
  }
}

interface ZoomMeetingListResponse {
  meetings: ZoomMeetingResponse[]
  page_count: number
  page_number: number
  page_size: number
  total_records: number
  next_page_token?: string
}

interface ZoomParticipantResponse {
  id: string
  name: string
  user_email?: string
  join_time: string
  leave_time?: string
  duration?: number
}

interface ZoomRecordingResponse {
  id: string
  meeting_id: string
  recording_type: string
  file_type: string
  download_url: string
  file_size?: number
  recording_start: string
}

/**
 * OAuth token response
 */
interface ZoomTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

/**
 * Create Zoom video conferencing provider
 */
export function createZoomProvider(config: ProviderConfig): VideoConferencingProvider {
  let accountId: string
  let clientId: string
  let clientSecret: string
  let accessToken: string | undefined
  let tokenExpiresAt: number = 0

  /**
   * Get OAuth access token using Server-to-Server OAuth
   */
  async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5-minute buffer)
    if (accessToken && Date.now() < tokenExpiresAt - 300000) {
      return accessToken
    }

    // Get new token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get access token: HTTP ${response.status}`)
    }

    const data = (await response.json()) as ZoomTokenResponse
    accessToken = data.access_token
    tokenExpiresAt = Date.now() + data.expires_in * 1000

    return accessToken
  }

  /**
   * Make authenticated API request
   */
  async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken()
    const url = `${ZOOM_API_URL}${endpoint}`

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
        `Zoom API error: ${response.status} - ${(errorData as any)?.message || response.statusText}`
      )
    }

    return response.json() as Promise<T>
  }

  /**
   * Convert Zoom meeting response to MeetingData
   */
  function convertMeeting(meeting: ZoomMeetingResponse): MeetingData {
    return {
      id: meeting.id.toString(),
      topic: meeting.topic,
      ...(meeting.start_time !== undefined && { startTime: new Date(meeting.start_time) }),
      ...(meeting.duration !== undefined && { duration: meeting.duration }),
      ...(meeting.timezone !== undefined && { timezone: meeting.timezone }),
      ...(meeting.agenda !== undefined && { agenda: meeting.agenda }),
      joinUrl: meeting.join_url,
      hostId: meeting.host_id,
      status: meeting.status as 'waiting' | 'started' | 'finished',
      ...(meeting.password !== undefined && { password: meeting.password }),
      createdAt: new Date(meeting.created_at),
    }
  }

  return {
    info: zoomInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accountId = cfg['accountId'] as string
      clientId = cfg['clientId'] as string
      clientSecret = cfg['clientSecret'] as string
      accessToken = cfg.accessToken as string | undefined

      if (!accountId || !clientId || !clientSecret) {
        throw new Error('Zoom requires accountId, clientId, and clientSecret')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Get current user to verify API access
        await apiRequest('/users/me')

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
      accessToken = undefined
      tokenExpiresAt = 0
    },

    async createMeeting(meeting: CreateMeetingOptions): Promise<MeetingData> {
      const body: Record<string, unknown> = {
        topic: meeting.topic,
        type: meeting.startTime ? 2 : 1, // 1 = instant, 2 = scheduled
        ...(meeting.startTime && {
          start_time: meeting.startTime.toISOString(),
        }),
        ...(meeting.duration && { duration: meeting.duration }),
        ...(meeting.timezone && { timezone: meeting.timezone }),
        ...(meeting.agenda && { agenda: meeting.agenda }),
        ...(meeting.password && { password: meeting.password }),
      }

      if (meeting.settings) {
        body['settings'] = {
          ...(meeting.settings.hostVideo !== undefined && {
            host_video: meeting.settings.hostVideo,
          }),
          ...(meeting.settings.participantVideo !== undefined && {
            participant_video: meeting.settings.participantVideo,
          }),
          ...(meeting.settings.joinBeforeHost !== undefined && {
            join_before_host: meeting.settings.joinBeforeHost,
          }),
          ...(meeting.settings.muteUponEntry !== undefined && {
            mute_upon_entry: meeting.settings.muteUponEntry,
          }),
          ...(meeting.settings.waitingRoom !== undefined && {
            waiting_room: meeting.settings.waitingRoom,
          }),
          ...(meeting.settings.autoRecording && {
            auto_recording: meeting.settings.autoRecording,
          }),
        }
      }

      const response = await apiRequest<ZoomMeetingResponse>('/users/me/meetings', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      return convertMeeting(response)
    },

    async getMeeting(meetingId: string): Promise<MeetingData | null> {
      try {
        const response = await apiRequest<ZoomMeetingResponse>(`/meetings/${meetingId}`)
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
      const body: Record<string, unknown> = {}

      if (updates.topic) body['topic'] = updates.topic
      if (updates.startTime) body['start_time'] = updates.startTime.toISOString()
      if (updates.duration !== undefined) body['duration'] = updates.duration
      if (updates.timezone) body['timezone'] = updates.timezone
      if (updates.agenda !== undefined) body['agenda'] = updates.agenda
      if (updates.password !== undefined) body['password'] = updates.password

      if (updates.settings) {
        body['settings'] = {
          ...(updates.settings.hostVideo !== undefined && {
            host_video: updates.settings.hostVideo,
          }),
          ...(updates.settings.participantVideo !== undefined && {
            participant_video: updates.settings.participantVideo,
          }),
          ...(updates.settings.joinBeforeHost !== undefined && {
            join_before_host: updates.settings.joinBeforeHost,
          }),
          ...(updates.settings.muteUponEntry !== undefined && {
            mute_upon_entry: updates.settings.muteUponEntry,
          }),
          ...(updates.settings.waitingRoom !== undefined && {
            waiting_room: updates.settings.waitingRoom,
          }),
          ...(updates.settings.autoRecording !== undefined && {
            auto_recording: updates.settings.autoRecording,
          }),
        }
      }

      await apiRequest(`/meetings/${meetingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })

      // Fetch updated meeting
      const updated = await this.getMeeting(meetingId)
      if (!updated) {
        throw new Error(`Failed to fetch updated meeting ${meetingId}`)
      }
      return updated
    },

    async deleteMeeting(meetingId: string): Promise<boolean> {
      try {
        await apiRequest(`/meetings/${meetingId}`, {
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

      // Map type option to Zoom API parameter
      const typeMap: Record<string, string> = {
        scheduled: 'scheduled',
        live: 'live',
        upcoming: 'upcoming',
        previous: 'previous_meetings',
      }

      if (options.type) {
        params.append('type', typeMap[options.type] || 'scheduled')
      } else {
        params.append('type', 'scheduled')
      }

      if (options.limit) params.append('page_size', options.limit.toString())
      if (options.cursor) params.append('next_page_token', options.cursor)

      const response = await apiRequest<ZoomMeetingListResponse>(
        `/users/me/meetings?${params.toString()}`
      )

      return {
        items: response.meetings.map(convertMeeting),
        total: response.total_records,
        hasMore: !!response.next_page_token,
        ...(response.next_page_token !== undefined && { nextCursor: response.next_page_token }),
      }
    },

    async endMeeting(meetingId: string): Promise<boolean> {
      try {
        await apiRequest(`/meetings/${meetingId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ action: 'end' }),
        })
        return true
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return false
        }
        throw error
      }
    },

    async getParticipants(meetingId: string): Promise<ParticipantData[]> {
      try {
        const response = await apiRequest<{ participants: ZoomParticipantResponse[] }>(
          `/past_meetings/${meetingId}/participants`
        )

        return response.participants.map(
          (p): ParticipantData => ({
            id: p.id,
            name: p.name,
            ...(p.user_email !== undefined && { email: p.user_email }),
            joinTime: new Date(p.join_time),
            ...(p.leave_time !== undefined && { leaveTime: new Date(p.leave_time) }),
            ...(p.duration !== undefined && { duration: p.duration }),
          })
        )
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return []
        }
        throw error
      }
    },

    async getRecordings(meetingId: string): Promise<MeetingRecordingData[]> {
      try {
        const response = await apiRequest<{ recording_files: ZoomRecordingResponse[] }>(
          `/meetings/${meetingId}/recordings`
        )

        return response.recording_files.map(
          (r): MeetingRecordingData => ({
            id: r.id,
            meetingId: r.meeting_id,
            type:
              r.recording_type === 'audio_only'
                ? 'audio'
                : r.file_type === 'TRANSCRIPT'
                ? 'transcript'
                : 'video',
            url: r.download_url,
            ...(r.file_size !== undefined && { size: r.file_size }),
            createdAt: new Date(r.recording_start),
          })
        )
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return []
        }
        throw error
      }
    },
  }
}

/**
 * Zoom provider definition
 */
export const zoomProvider = defineProvider(zoomInfo, async (config) => createZoomProvider(config))
