/**
 * Jitsi Meet Video Conferencing Provider
 *
 * Concrete implementation of VideoConferencingProvider using Jitsi Meet.
 * Self-hostable open source video conferencing solution.
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

const DEFAULT_JITSI_SERVER = 'https://meet.jit.si'

/**
 * Jitsi Meet provider info
 */
export const jitsiInfo: ProviderInfo = {
  id: 'meeting.jitsi',
  name: 'Jitsi Meet',
  description: 'Open source self-hostable video conferencing solution',
  category: 'video-conferencing',
  website: 'https://jitsi.org',
  docsUrl: 'https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker',
  requiredConfig: [],
  optionalConfig: ['serverUrl', 'jwtSecret'],
}

/**
 * In-memory meeting storage (since Jitsi is stateless by default)
 */
interface StoredMeeting {
  id: string
  topic: string
  startTime?: Date
  duration?: number
  timezone?: string
  agenda?: string
  joinUrl: string
  hostId: string
  status: 'waiting' | 'started' | 'finished'
  password?: string
  createdAt: Date
  roomName: string
}

/**
 * Create Jitsi Meet provider
 */
export function createJitsiProvider(config: ProviderConfig): VideoConferencingProvider {
  let serverUrl: string
  let jwtSecret: string | undefined
  let hostId: string

  // In-memory storage for meetings
  const meetings = new Map<string, StoredMeeting>()

  /**
   * Generate a unique room name
   */
  function generateRoomName(topic: string): string {
    // Create URL-safe room name from topic
    const safeTopic = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)

    // Add random suffix to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    return `${safeTopic}-${randomSuffix}`
  }

  /**
   * Generate JWT token for secure Jitsi meeting (if JWT is enabled)
   */
  function generateJWT(roomName: string, moderator: boolean = true): string | undefined {
    if (!jwtSecret) {
      return undefined
    }

    // Note: In production, you would use a proper JWT library
    // This is a simplified placeholder
    // In real implementation, use jsonwebtoken package
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    }

    const payload = {
      context: {
        user: {
          moderator,
          id: hostId,
        },
      },
      aud: 'jitsi',
      iss: 'jitsi',
      sub: serverUrl.replace(/^https?:\/\//, ''),
      room: roomName,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    }

    // This is a placeholder - in real implementation use proper JWT signing
    return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`
  }

  /**
   * Build join URL for a Jitsi room
   */
  function buildJoinUrl(roomName: string, jwt?: string): string {
    let url = `${serverUrl}/${roomName}`

    if (jwt) {
      url += `?jwt=${jwt}`
    }

    return url
  }

  /**
   * Convert stored meeting to MeetingData
   */
  function convertMeeting(meeting: StoredMeeting): MeetingData {
    return {
      id: meeting.id,
      topic: meeting.topic,
      startTime: meeting.startTime,
      duration: meeting.duration,
      timezone: meeting.timezone,
      agenda: meeting.agenda,
      joinUrl: meeting.joinUrl,
      hostId: meeting.hostId,
      status: meeting.status,
      password: meeting.password,
      createdAt: meeting.createdAt,
    }
  }

  return {
    info: jitsiInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      serverUrl = (cfg.serverUrl as string) || DEFAULT_JITSI_SERVER
      jwtSecret = cfg.jwtSecret as string | undefined
      hostId = (cfg.hostId as string) || 'default-host'

      // Remove trailing slash from server URL
      serverUrl = serverUrl.replace(/\/$/, '')
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Check if Jitsi server is accessible
        const response = await fetch(serverUrl, {
          method: 'HEAD',
        })

        if (!response.ok && response.status !== 404) {
          throw new Error(`Server returned status ${response.status}`)
        }

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
      // Clear all stored meetings
      meetings.clear()
    },

    async createMeeting(meeting: CreateMeetingOptions): Promise<MeetingData> {
      const id = `jitsi-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const roomName = generateRoomName(meeting.topic)
      const jwt = generateJWT(roomName, true)
      const joinUrl = buildJoinUrl(roomName, jwt)

      const storedMeeting: StoredMeeting = {
        id,
        topic: meeting.topic,
        startTime: meeting.startTime,
        duration: meeting.duration,
        timezone: meeting.timezone,
        agenda: meeting.agenda,
        joinUrl,
        hostId,
        status: 'waiting',
        password: meeting.password,
        createdAt: new Date(),
        roomName,
      }

      meetings.set(id, storedMeeting)

      return convertMeeting(storedMeeting)
    },

    async getMeeting(meetingId: string): Promise<MeetingData | null> {
      const meeting = meetings.get(meetingId)
      return meeting ? convertMeeting(meeting) : null
    },

    async updateMeeting(
      meetingId: string,
      updates: Partial<CreateMeetingOptions>
    ): Promise<MeetingData> {
      const meeting = meetings.get(meetingId)
      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found`)
      }

      // Update meeting properties
      if (updates.topic) meeting.topic = updates.topic
      if (updates.startTime !== undefined) meeting.startTime = updates.startTime
      if (updates.duration !== undefined) meeting.duration = updates.duration
      if (updates.timezone !== undefined) meeting.timezone = updates.timezone
      if (updates.agenda !== undefined) meeting.agenda = updates.agenda
      if (updates.password !== undefined) meeting.password = updates.password

      // If topic changed, regenerate room name and URL
      if (updates.topic) {
        meeting.roomName = generateRoomName(updates.topic)
        const jwt = generateJWT(meeting.roomName, true)
        meeting.joinUrl = buildJoinUrl(meeting.roomName, jwt)
      }

      meetings.set(meetingId, meeting)

      return convertMeeting(meeting)
    },

    async deleteMeeting(meetingId: string): Promise<boolean> {
      return meetings.delete(meetingId)
    },

    async listMeetings(options: MeetingListOptions = {}): Promise<PaginatedResult<MeetingData>> {
      let items = Array.from(meetings.values())

      // Filter by type
      const now = new Date()
      if (options.type === 'upcoming' || options.type === 'scheduled') {
        items = items.filter((m) => m.startTime && m.startTime > now)
      } else if (options.type === 'previous') {
        items = items.filter((m) => m.startTime && m.startTime < now)
      } else if (options.type === 'live') {
        items = items.filter((m) => m.status === 'started')
      }

      // Sort by start time
      items.sort((a, b) => {
        const aTime = a.startTime?.getTime() || 0
        const bTime = b.startTime?.getTime() || 0
        return aTime - bTime
      })

      // Apply pagination
      const offset = parseInt(options.cursor || '0', 10)
      const limit = options.limit || 50
      const paginatedItems = items.slice(offset, offset + limit)

      return {
        items: paginatedItems.map(convertMeeting),
        hasMore: offset + limit < items.length,
        nextCursor: offset + limit < items.length ? (offset + limit).toString() : undefined,
      }
    },

    async endMeeting(meetingId: string): Promise<boolean> {
      const meeting = meetings.get(meetingId)
      if (!meeting) {
        return false
      }

      meeting.status = 'finished'
      meetings.set(meetingId, meeting)

      return true
    },

    async getParticipants(meetingId: string): Promise<ParticipantData[]> {
      // Jitsi doesn't provide a built-in API for participant data
      // This would require setting up Jitsi Meet API with prosody modules
      // or integrating with jitsi-videobridge stats
      return []
    },

    async getRecordings(meetingId: string): Promise<MeetingRecordingData[]> {
      // Jitsi recordings would need to be configured with Jibri
      // and would require integration with your recording storage
      return []
    },
  }
}

/**
 * Jitsi Meet provider definition
 */
export const jitsiProvider = defineProvider(jitsiInfo, async (config) =>
  createJitsiProvider(config)
)
