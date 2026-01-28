/**
 * Slack Messaging Provider
 *
 * Concrete implementation of MessagingProvider using Slack API.
 *
 * @packageDocumentation
 */

import type {
  MessagingProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  SendMessageOptions,
  SendMessageResult,
  MessageData,
  MessageListOptions,
  MessageSearchOptions,
  ChannelData,
  ChannelListOptions,
  CreateChannelOptions,
  MemberData,
  MemberListOptions,
  PresenceData,
  WorkspaceData,
  PaginatedResult,
} from '../types.js'
import { defineProvider } from '../registry.js'

const SLACK_API_URL = 'https://slack.com/api'

// =============================================================================
// Slack API Response Types
// =============================================================================

/** Slack API response base */
interface SlackApiResponse {
  ok: boolean
  error?: string
}

/** Slack reaction from API */
interface SlackReaction {
  name: string
  count: number
  users: string[]
}

/** Slack message edit info */
interface SlackEditInfo {
  ts?: string
}

/** Slack message from API */
interface SlackMessage {
  ts: string
  user: string
  text: string
  thread_ts?: string
  reply_count?: number
  reactions?: SlackReaction[]
  edited?: SlackEditInfo
  channel?: { id: string }
}

/** Slack channel topic/purpose from API */
interface SlackChannelMeta {
  value?: string
}

/** Slack channel from API */
interface SlackChannel {
  id: string
  name: string
  topic?: SlackChannelMeta
  purpose?: SlackChannelMeta
  is_private?: boolean
  is_archived?: boolean
  num_members?: number
  created: number
}

/** Slack user profile from API */
interface SlackUserProfile {
  display_name?: string
  email?: string
  image_192?: string
  title?: string
}

/** Slack user from API */
interface SlackUser {
  id: string
  name: string
  real_name?: string
  profile?: SlackUserProfile
  is_admin?: boolean
  is_owner?: boolean
  is_bot?: boolean
  deleted?: boolean
  tz?: string
}

/** Slack team icon from API */
interface SlackTeamIcon {
  image_132?: string
}

/** Slack team from API */
interface SlackTeam {
  id: string
  name: string
  domain: string
  icon?: SlackTeamIcon
}

/** Slack response metadata */
interface SlackResponseMetadata {
  next_cursor?: string
}

/** Slack paging info */
interface SlackPaging {
  pages: number
  page: number
}

/** Slack messages search result */
interface SlackMessagesSearchResult {
  matches: SlackMessage[]
  paging: SlackPaging
  total: number
}

/** Slack auth test response */
interface SlackAuthTestResponse extends SlackApiResponse {
  user?: string
}

/** Slack conversations open response */
interface SlackConversationsOpenResponse extends SlackApiResponse {
  channel?: { id: string }
}

/** Slack post message response */
interface SlackPostMessageResponse extends SlackApiResponse {
  ts?: string
  channel?: string
}

/** Slack conversations history response */
interface SlackConversationsHistoryResponse extends SlackApiResponse {
  messages?: SlackMessage[]
  has_more?: boolean
  response_metadata?: SlackResponseMetadata
}

/** Slack search messages response */
interface SlackSearchMessagesResponse extends SlackApiResponse {
  messages: SlackMessagesSearchResult
}

/** Slack conversations list response */
interface SlackConversationsListResponse extends SlackApiResponse {
  channels: SlackChannel[]
  response_metadata?: SlackResponseMetadata
}

/** Slack conversations info response */
interface SlackConversationsInfoResponse extends SlackApiResponse {
  channel: SlackChannel
}

/** Slack conversations members response */
interface SlackConversationsMembersResponse extends SlackApiResponse {
  members: string[]
  response_metadata?: SlackResponseMetadata
}

/** Slack users list response */
interface SlackUsersListResponse extends SlackApiResponse {
  members: SlackUser[]
  response_metadata?: SlackResponseMetadata
}

/** Slack users info response */
interface SlackUsersInfoResponse extends SlackApiResponse {
  user: SlackUser
}

/** Slack presence response */
interface SlackPresenceResponse extends SlackApiResponse {
  presence: string
}

/** Slack team info response */
interface SlackTeamInfoResponse extends SlackApiResponse {
  team: SlackTeam
}

/**
 * Slack provider info
 */
export const slackInfo: ProviderInfo = {
  id: 'messaging.slack',
  name: 'Slack',
  description: 'Slack team messaging platform',
  category: 'messaging',
  website: 'https://slack.com',
  docsUrl: 'https://api.slack.com/docs',
  requiredConfig: ['accessToken'],
  optionalConfig: ['botToken', 'signingSecret'],
}

/**
 * Create Slack messaging provider
 */
export function createSlackProvider(config: ProviderConfig): MessagingProvider {
  let token: string

  async function slackApi<T extends SlackApiResponse>(
    method: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${SLACK_API_URL}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })

    const data = (await response.json()) as T
    return data
  }

  return {
    info: slackInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      token = (cfg['accessToken'] || cfg['botToken']) as string
      if (!token) {
        throw new Error('Slack access token or bot token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const data = await slackApi<SlackAuthTestResponse>('auth.test')
        return {
          healthy: data.ok === true,
          latencyMs: Date.now() - start,
          message: data.ok ? `Connected as ${data.user}` : data.error || 'Unknown error',
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

    async send(options: SendMessageOptions): Promise<SendMessageResult> {
      const body: Record<string, unknown> = {
        text: options.text,
      }

      if (options.channel) {
        body['channel'] = options.channel
      } else if (options.userId) {
        // Open DM conversation first
        const dm = await slackApi<SlackConversationsOpenResponse>('conversations.open', {
          users: options.userId,
        })
        if (!dm.ok) {
          return {
            success: false,
            error: { code: dm.error || 'UNKNOWN', message: `Failed to open DM: ${dm.error}` },
          }
        }
        body['channel'] = dm.channel?.id
      } else {
        return {
          success: false,
          error: { code: 'MISSING_TARGET', message: 'Either channel or userId is required' },
        }
      }

      if (options.threadId) {
        body['thread_ts'] = options.threadId
      }

      if (options.blocks) {
        body['blocks'] = options.blocks
      }

      if (options.metadata) {
        body['metadata'] = {
          event_type: 'message_metadata',
          event_payload: options.metadata,
        }
      }

      const data = await slackApi<SlackPostMessageResponse>('chat.postMessage', body)

      if (data.ok) {
        return {
          success: true,
          ...(data.ts !== undefined && { messageId: data.ts }),
          ...(data.ts !== undefined && { timestamp: data.ts }),
          ...(data.channel !== undefined && { channel: data.channel }),
        }
      }

      return {
        success: false,
        error: { code: data.error || 'UNKNOWN', message: data.error || 'Unknown error' },
      }
    },

    async edit(messageId: string, text: string, blocks?: unknown[]): Promise<SendMessageResult> {
      const body: Record<string, unknown> = {
        ts: messageId,
        text,
      }

      if (blocks) {
        body['blocks'] = blocks
      }

      const data = await slackApi<SlackPostMessageResponse>('chat.update', body)

      if (data.ok) {
        return {
          success: true,
          ...(data.ts !== undefined && { messageId: data.ts }),
          ...(data.ts !== undefined && { timestamp: data.ts }),
          ...(data.channel !== undefined && { channel: data.channel }),
        }
      }

      return {
        success: false,
        error: { code: data.error || 'UNKNOWN', message: data.error || 'Unknown error' },
      }
    },

    async delete(messageId: string, channel: string): Promise<boolean> {
      const data = await slackApi<SlackApiResponse>('chat.delete', { ts: messageId, channel })
      return data.ok === true
    },

    async react(messageId: string, channel: string, emoji: string): Promise<boolean> {
      const data = await slackApi<SlackApiResponse>('reactions.add', {
        name: emoji.replace(/:/g, ''),
        timestamp: messageId,
        channel,
      })
      return data.ok === true
    },

    async unreact(messageId: string, channel: string, emoji: string): Promise<boolean> {
      const data = await slackApi<SlackApiResponse>('reactions.remove', {
        name: emoji.replace(/:/g, ''),
        timestamp: messageId,
        channel,
      })
      return data.ok === true
    },

    async getMessage(messageId: string, channel: string): Promise<MessageData | null> {
      const data = await slackApi<SlackConversationsHistoryResponse>('conversations.history', {
        channel,
        latest: messageId,
        inclusive: true,
        limit: 1,
      })

      if (!data.ok || !data.messages?.length) {
        return null
      }

      const msg = data.messages[0]
      if (!msg) return null
      return mapSlackMessage(msg, channel)
    },

    async listMessages(
      channel: string,
      options?: MessageListOptions
    ): Promise<PaginatedResult<MessageData>> {
      const body: Record<string, unknown> = {
        channel,
        limit: options?.limit || 100,
      }

      if (options?.cursor) {
        body['cursor'] = options.cursor
      }
      if (options?.since) {
        body['oldest'] = (options.since.getTime() / 1000).toString()
      }
      if (options?.until) {
        body['latest'] = (options.until.getTime() / 1000).toString()
      }

      const data = await slackApi<SlackConversationsHistoryResponse>('conversations.history', body)

      if (!data.ok) {
        return { items: [], hasMore: false }
      }

      return {
        items: (data.messages || []).map((msg) => mapSlackMessage(msg, channel)),
        hasMore: data.has_more || false,
        ...(data.response_metadata?.next_cursor !== undefined && {
          nextCursor: data.response_metadata.next_cursor,
        }),
      }
    },

    async searchMessages(
      query: string,
      options?: MessageSearchOptions
    ): Promise<PaginatedResult<MessageData>> {
      const data = await slackApi<SlackSearchMessagesResponse>('search.messages', {
        query,
        count: options?.limit || 100,
        page: options?.offset ? Math.floor(options.offset / (options.limit || 100)) + 1 : 1,
      })

      if (!data.ok) {
        return { items: [], hasMore: false }
      }

      return {
        items: data.messages.matches.map((match) =>
          mapSlackMessage(match, match.channel?.id || '')
        ),
        hasMore: data.messages.paging.pages > data.messages.paging.page,
        total: data.messages.total,
      }
    },

    async listChannels(options?: ChannelListOptions): Promise<PaginatedResult<ChannelData>> {
      const body: Record<string, unknown> = {
        limit: options?.limit || 100,
        exclude_archived: options?.excludeArchived !== false,
      }

      if (options?.cursor) {
        body['cursor'] = options.cursor
      }

      if (options?.types) {
        body['types'] = options.types
          .map((t) => (t === 'private' ? 'private_channel' : 'public_channel'))
          .join(',')
      }

      const data = await slackApi<SlackConversationsListResponse>('conversations.list', body)

      if (!data.ok) {
        return { items: [], hasMore: false }
      }

      return {
        items: data.channels.map(mapSlackChannel),
        hasMore: data.response_metadata?.next_cursor ? true : false,
        ...(data.response_metadata?.next_cursor !== undefined && {
          nextCursor: data.response_metadata.next_cursor,
        }),
      }
    },

    async getChannel(channelId: string): Promise<ChannelData | null> {
      const data = await slackApi<SlackConversationsInfoResponse>('conversations.info', {
        channel: channelId,
      })

      if (!data.ok) {
        return null
      }

      return mapSlackChannel(data.channel)
    },

    async createChannel(name: string, options?: CreateChannelOptions): Promise<ChannelData> {
      const body: Record<string, unknown> = {
        name,
        is_private: options?.isPrivate || false,
      }

      const data = await slackApi<SlackConversationsInfoResponse>('conversations.create', body)

      if (!data.ok) {
        throw new Error(`Failed to create channel: ${data.error}`)
      }

      const channel = mapSlackChannel(data.channel)

      // Set topic if provided
      if (options?.topic) {
        await slackApi<SlackApiResponse>('conversations.setTopic', {
          channel: data.channel.id,
          topic: options.topic,
        })
      }

      // Set description/purpose if provided
      if (options?.description) {
        await slackApi<SlackApiResponse>('conversations.setPurpose', {
          channel: data.channel.id,
          purpose: options.description,
        })
      }

      return channel
    },

    async archiveChannel(channelId: string): Promise<boolean> {
      const data = await slackApi<SlackApiResponse>('conversations.archive', { channel: channelId })
      return data.ok === true
    },

    async joinChannel(channelId: string): Promise<boolean> {
      const data = await slackApi<SlackApiResponse>('conversations.join', { channel: channelId })
      return data.ok === true
    },

    async leaveChannel(channelId: string): Promise<boolean> {
      const data = await slackApi<SlackApiResponse>('conversations.leave', { channel: channelId })
      return data.ok === true
    },

    async listMembers(options?: MemberListOptions): Promise<PaginatedResult<MemberData>> {
      const body: Record<string, unknown> = {
        limit: options?.limit || 100,
      }

      if (options?.cursor) {
        body['cursor'] = options.cursor
      }

      if (options?.channel) {
        // Get members of specific channel
        const channelData = await slackApi<SlackConversationsMembersResponse>(
          'conversations.members',
          { ...body, channel: options.channel }
        )
        if (!channelData.ok) {
          return { items: [], hasMore: false }
        }

        // Fetch user info for each member
        const members = await Promise.all(
          channelData.members.map(async (userId: string) => {
            const userInfo = await slackApi<SlackUsersInfoResponse>('users.info', { user: userId })
            return userInfo.ok ? mapSlackUser(userInfo.user) : null
          })
        )

        return {
          items: members.filter((m): m is MemberData => m !== null),
          hasMore: channelData.response_metadata?.next_cursor ? true : false,
          ...(channelData.response_metadata?.next_cursor !== undefined && {
            nextCursor: channelData.response_metadata.next_cursor,
          }),
        }
      } else {
        // Get all workspace members
        const usersData = await slackApi<SlackUsersListResponse>('users.list', body)
        if (!usersData.ok) {
          return { items: [], hasMore: false }
        }

        return {
          items: usersData.members.filter((m) => !m.deleted).map(mapSlackUser),
          hasMore: usersData.response_metadata?.next_cursor ? true : false,
          ...(usersData.response_metadata?.next_cursor !== undefined && {
            nextCursor: usersData.response_metadata.next_cursor,
          }),
        }
      }
    },

    async getMember(userId: string): Promise<MemberData | null> {
      const data = await slackApi<SlackUsersInfoResponse>('users.info', { user: userId })

      if (!data.ok) {
        return null
      }

      return mapSlackUser(data.user)
    },

    async getPresence(userId: string): Promise<PresenceData> {
      const data = await slackApi<SlackPresenceResponse>('users.getPresence', { user: userId })

      return {
        userId,
        presence: data.presence === 'active' ? 'online' : 'away',
      }
    },

    async getWorkspace(): Promise<WorkspaceData> {
      const data = await slackApi<SlackTeamInfoResponse>('team.info')

      if (!data.ok) {
        throw new Error(`Failed to get workspace info: ${data.error}`)
      }

      return {
        id: data.team.id,
        name: data.team.name,
        domain: data.team.domain,
        ...(data.team.icon?.image_132 !== undefined && { icon: data.team.icon.image_132 }),
      }
    },
  }
}

function mapSlackMessage(msg: SlackMessage, channel: string): MessageData {
  return {
    id: msg.ts,
    channel,
    userId: msg.user,
    text: msg.text,
    timestamp: msg.ts,
    ...(msg.thread_ts !== undefined && { threadId: msg.thread_ts }),
    ...(msg.reply_count !== undefined && { replyCount: msg.reply_count }),
    ...(msg.reactions && {
      reactions: msg.reactions.map((r) => ({
        emoji: r.name,
        count: r.count,
        users: r.users,
      })),
    }),
    edited: !!msg.edited,
    ...(msg.edited?.ts && { editedAt: new Date(parseFloat(msg.edited.ts) * 1000) }),
  }
}

function mapSlackChannel(ch: SlackChannel): ChannelData {
  return {
    id: ch.id,
    name: ch.name,
    ...(ch.topic?.value !== undefined && { topic: ch.topic.value }),
    ...(ch.purpose?.value !== undefined && { description: ch.purpose.value }),
    isPrivate: ch.is_private || false,
    isArchived: ch.is_archived || false,
    memberCount: ch.num_members || 0,
    createdAt: new Date(ch.created * 1000),
  }
}

function mapSlackUser(user: SlackUser): MemberData {
  return {
    id: user.id,
    username: user.name,
    displayName: user.real_name || user.profile?.display_name || user.name,
    ...(user.profile?.email !== undefined && { email: user.profile.email }),
    ...(user.profile?.image_192 !== undefined && { avatar: user.profile.image_192 }),
    ...(user.profile?.title !== undefined && { title: user.profile.title }),
    isAdmin: user.is_admin || user.is_owner || false,
    isBot: user.is_bot || false,
    ...(user.tz !== undefined && { timezone: user.tz }),
  }
}

/**
 * Slack provider definition
 */
export const slackProvider = defineProvider(slackInfo, async (config) =>
  createSlackProvider(config)
)
