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

  async function slackApi(method: string, body?: Record<string, unknown>): Promise<any> {
    const response = await fetch(`${SLACK_API_URL}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()
    return data
  }

  return {
    info: slackInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      token = (cfg.accessToken || cfg.botToken) as string
      if (!token) {
        throw new Error('Slack access token or bot token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const data = await slackApi('auth.test')
        return {
          healthy: data.ok === true,
          latencyMs: Date.now() - start,
          message: data.ok ? `Connected as ${data.user}` : data.error,
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
        body.channel = options.channel
      } else if (options.userId) {
        // Open DM conversation first
        const dm = await slackApi('conversations.open', { users: options.userId })
        if (!dm.ok) {
          return {
            success: false,
            error: { code: dm.error, message: `Failed to open DM: ${dm.error}` },
          }
        }
        body.channel = dm.channel.id
      } else {
        return {
          success: false,
          error: { code: 'MISSING_TARGET', message: 'Either channel or userId is required' },
        }
      }

      if (options.threadId) {
        body.thread_ts = options.threadId
      }

      if (options.blocks) {
        body.blocks = options.blocks
      }

      if (options.metadata) {
        body.metadata = {
          event_type: 'message_metadata',
          event_payload: options.metadata,
        }
      }

      const data = await slackApi('chat.postMessage', body)

      if (data.ok) {
        return {
          success: true,
          messageId: data.ts,
          timestamp: data.ts,
          channel: data.channel,
        }
      }

      return {
        success: false,
        error: { code: data.error, message: data.error },
      }
    },

    async edit(messageId: string, text: string, blocks?: unknown[]): Promise<SendMessageResult> {
      const body: Record<string, unknown> = {
        ts: messageId,
        text,
      }

      if (blocks) {
        body.blocks = blocks
      }

      const data = await slackApi('chat.update', body)

      if (data.ok) {
        return {
          success: true,
          messageId: data.ts,
          timestamp: data.ts,
          channel: data.channel,
        }
      }

      return {
        success: false,
        error: { code: data.error, message: data.error },
      }
    },

    async delete(messageId: string, channel: string): Promise<boolean> {
      const data = await slackApi('chat.delete', { ts: messageId, channel })
      return data.ok === true
    },

    async react(messageId: string, channel: string, emoji: string): Promise<boolean> {
      const data = await slackApi('reactions.add', {
        name: emoji.replace(/:/g, ''),
        timestamp: messageId,
        channel,
      })
      return data.ok === true
    },

    async unreact(messageId: string, channel: string, emoji: string): Promise<boolean> {
      const data = await slackApi('reactions.remove', {
        name: emoji.replace(/:/g, ''),
        timestamp: messageId,
        channel,
      })
      return data.ok === true
    },

    async getMessage(messageId: string, channel: string): Promise<MessageData | null> {
      const data = await slackApi('conversations.history', {
        channel,
        latest: messageId,
        inclusive: true,
        limit: 1,
      })

      if (!data.ok || !data.messages?.length) {
        return null
      }

      const msg = data.messages[0]
      return mapSlackMessage(msg, channel)
    },

    async listMessages(channel: string, options?: MessageListOptions): Promise<PaginatedResult<MessageData>> {
      const body: Record<string, unknown> = {
        channel,
        limit: options?.limit || 100,
      }

      if (options?.cursor) {
        body.cursor = options.cursor
      }
      if (options?.since) {
        body.oldest = (options.since.getTime() / 1000).toString()
      }
      if (options?.until) {
        body.latest = (options.until.getTime() / 1000).toString()
      }

      const data = await slackApi('conversations.history', body)

      if (!data.ok) {
        return { items: [], hasMore: false }
      }

      return {
        items: data.messages.map((msg: any) => mapSlackMessage(msg, channel)),
        hasMore: data.has_more || false,
        nextCursor: data.response_metadata?.next_cursor,
      }
    },

    async searchMessages(query: string, options?: MessageSearchOptions): Promise<PaginatedResult<MessageData>> {
      const data = await slackApi('search.messages', {
        query,
        count: options?.limit || 100,
        page: options?.offset ? Math.floor(options.offset / (options.limit || 100)) + 1 : 1,
      })

      if (!data.ok) {
        return { items: [], hasMore: false }
      }

      return {
        items: data.messages.matches.map((match: any) => mapSlackMessage(match, match.channel.id)),
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
        body.cursor = options.cursor
      }

      if (options?.types) {
        body.types = options.types.map((t) => (t === 'private' ? 'private_channel' : 'public_channel')).join(',')
      }

      const data = await slackApi('conversations.list', body)

      if (!data.ok) {
        return { items: [], hasMore: false }
      }

      return {
        items: data.channels.map(mapSlackChannel),
        hasMore: data.response_metadata?.next_cursor ? true : false,
        nextCursor: data.response_metadata?.next_cursor,
      }
    },

    async getChannel(channelId: string): Promise<ChannelData | null> {
      const data = await slackApi('conversations.info', { channel: channelId })

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

      const data = await slackApi('conversations.create', body)

      if (!data.ok) {
        throw new Error(`Failed to create channel: ${data.error}`)
      }

      const channel = mapSlackChannel(data.channel)

      // Set topic if provided
      if (options?.topic) {
        await slackApi('conversations.setTopic', {
          channel: data.channel.id,
          topic: options.topic,
        })
      }

      // Set description/purpose if provided
      if (options?.description) {
        await slackApi('conversations.setPurpose', {
          channel: data.channel.id,
          purpose: options.description,
        })
      }

      return channel
    },

    async archiveChannel(channelId: string): Promise<boolean> {
      const data = await slackApi('conversations.archive', { channel: channelId })
      return data.ok === true
    },

    async joinChannel(channelId: string): Promise<boolean> {
      const data = await slackApi('conversations.join', { channel: channelId })
      return data.ok === true
    },

    async leaveChannel(channelId: string): Promise<boolean> {
      const data = await slackApi('conversations.leave', { channel: channelId })
      return data.ok === true
    },

    async listMembers(options?: MemberListOptions): Promise<PaginatedResult<MemberData>> {
      const body: Record<string, unknown> = {
        limit: options?.limit || 100,
      }

      if (options?.cursor) {
        body.cursor = options.cursor
      }

      let data: any

      if (options?.channel) {
        // Get members of specific channel
        data = await slackApi('conversations.members', { ...body, channel: options.channel })
        if (!data.ok) {
          return { items: [], hasMore: false }
        }

        // Fetch user info for each member
        const members = await Promise.all(
          data.members.map(async (userId: string) => {
            const userInfo = await slackApi('users.info', { user: userId })
            return userInfo.ok ? mapSlackUser(userInfo.user) : null
          })
        )

        return {
          items: members.filter(Boolean) as MemberData[],
          hasMore: data.response_metadata?.next_cursor ? true : false,
          nextCursor: data.response_metadata?.next_cursor,
        }
      } else {
        // Get all workspace members
        data = await slackApi('users.list', body)
        if (!data.ok) {
          return { items: [], hasMore: false }
        }

        return {
          items: data.members.filter((m: any) => !m.deleted).map(mapSlackUser),
          hasMore: data.response_metadata?.next_cursor ? true : false,
          nextCursor: data.response_metadata?.next_cursor,
        }
      }
    },

    async getMember(userId: string): Promise<MemberData | null> {
      const data = await slackApi('users.info', { user: userId })

      if (!data.ok) {
        return null
      }

      return mapSlackUser(data.user)
    },

    async getPresence(userId: string): Promise<PresenceData> {
      const data = await slackApi('users.getPresence', { user: userId })

      return {
        userId,
        presence: data.presence === 'active' ? 'online' : 'away',
      }
    },

    async getWorkspace(): Promise<WorkspaceData> {
      const data = await slackApi('team.info')

      if (!data.ok) {
        throw new Error(`Failed to get workspace info: ${data.error}`)
      }

      return {
        id: data.team.id,
        name: data.team.name,
        domain: data.team.domain,
        icon: data.team.icon?.image_132,
      }
    },
  }
}

function mapSlackMessage(msg: any, channel: string): MessageData {
  return {
    id: msg.ts,
    channel,
    userId: msg.user,
    text: msg.text,
    timestamp: msg.ts,
    threadId: msg.thread_ts,
    replyCount: msg.reply_count,
    reactions: msg.reactions?.map((r: any) => ({
      emoji: r.name,
      count: r.count,
      users: r.users,
    })),
    edited: !!msg.edited,
    editedAt: msg.edited?.ts ? new Date(parseFloat(msg.edited.ts) * 1000) : undefined,
  }
}

function mapSlackChannel(ch: any): ChannelData {
  return {
    id: ch.id,
    name: ch.name,
    topic: ch.topic?.value,
    description: ch.purpose?.value,
    isPrivate: ch.is_private || false,
    isArchived: ch.is_archived || false,
    memberCount: ch.num_members || 0,
    createdAt: new Date(ch.created * 1000),
  }
}

function mapSlackUser(user: any): MemberData {
  return {
    id: user.id,
    username: user.name,
    displayName: user.real_name || user.profile?.display_name || user.name,
    email: user.profile?.email,
    avatar: user.profile?.image_192,
    title: user.profile?.title,
    isAdmin: user.is_admin || user.is_owner || false,
    isBot: user.is_bot || false,
    timezone: user.tz,
  }
}

/**
 * Slack provider definition
 */
export const slackProvider = defineProvider(slackInfo, async (config) =>
  createSlackProvider(config)
)
