/**
 * Slack Messaging Provider Tests
 *
 * Tests for the Slack messaging provider implementation covering:
 * - Provider initialization with access/bot tokens
 * - Message sending, editing, and deletion
 * - Channel operations
 * - Member and workspace management
 * - Reactions and presence
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { createSlackProvider, slackInfo } from '../../src/providers/messaging/slack.js'
import type { MessagingProvider } from '../../src/providers/types.js'
import {
  setupMockFetch,
  resetMockFetch,
  mockJsonResponse,
  mockNetworkError,
  getLastFetchCall,
  getFetchCall,
  parseFetchJsonBody,
  slackMocks,
} from './helpers.js'

describe('Slack Messaging Provider', () => {
  let mockFetch: MockInstance
  let provider: MessagingProvider

  beforeEach(() => {
    mockFetch = setupMockFetch()
  })

  afterEach(() => {
    resetMockFetch(mockFetch)
  })

  // ===========================================================================
  // Provider Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('should have correct provider info', () => {
      const provider = createSlackProvider({})
      expect(provider.info).toBe(slackInfo)
      expect(provider.info.id).toBe('messaging.slack')
      expect(provider.info.name).toBe('Slack')
      expect(provider.info.category).toBe('messaging')
    })

    it('should require access token for initialization', async () => {
      provider = createSlackProvider({})
      await expect(provider.initialize({})).rejects.toThrow('token is required')
    })

    it('should initialize successfully with access token', async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await expect(provider.initialize({ accessToken: 'xoxb-test-token' })).resolves.toBeUndefined()
    })

    it('should initialize successfully with bot token', async () => {
      provider = createSlackProvider({ botToken: 'xoxb-bot-token' })
      await expect(provider.initialize({ botToken: 'xoxb-bot-token' })).resolves.toBeUndefined()
    })

    it('should include requiredConfig in provider info', () => {
      provider = createSlackProvider({})
      expect(provider.info.requiredConfig).toContain('accessToken')
    })

    it('should include optionalConfig in provider info', () => {
      provider = createSlackProvider({})
      expect(provider.info.optionalConfig).toContain('botToken')
      expect(provider.info.optionalConfig).toContain('signingSecret')
    })
  })

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe('healthCheck', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should return healthy status on successful auth.test', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse({ user: 'testbot' })))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Connected as testbot')
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
      expect(health.checkedAt).toBeInstanceOf(Date)
    })

    it('should call auth.test endpoint for health check', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse({ user: 'bot' })))

      await provider.healthCheck()

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('auth.test')
    })

    it('should return unhealthy status on API error', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.errorResponse('invalid_auth')))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('invalid_auth')
    })

    it('should return unhealthy status on network error', async () => {
      mockFetch.mockRejectedValueOnce(mockNetworkError('Connection timeout'))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Connection timeout')
    })
  })

  // ===========================================================================
  // Message Sending Tests
  // ===========================================================================

  describe('send', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should send message to channel', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('1234567890.123456', 'C123'))
      )

      const result = await provider.send({
        channel: 'C123',
        text: 'Hello Slack!',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('1234567890.123456')
      expect(result.channel).toBe('C123')
    })

    it('should format request body correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('ts', 'C123'))
      )

      await provider.send({
        channel: 'C123',
        text: 'Test message',
      })

      const body = parseFetchJsonBody(mockFetch) as { text: string; channel: string }
      expect(body.text).toBe('Test message')
      expect(body.channel).toBe('C123')
    })

    it('should send DM by opening conversation first', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse({ channel: { id: 'D123' } })))
        .mockResolvedValueOnce(mockJsonResponse(slackMocks.postMessageResponse('ts', 'D123')))

      const result = await provider.send({
        userId: 'U456',
        text: 'Direct message',
      })

      expect(result.success).toBe(true)
      expect(result.channel).toBe('D123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should return error when DM open fails', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.errorResponse('user_not_found')))

      const result = await provider.send({
        userId: 'U999',
        text: 'Message',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('user_not_found')
    })

    it('should return error when neither channel nor userId provided', async () => {
      const result = await provider.send({
        text: 'No target',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('MISSING_TARGET')
    })

    it('should include thread_ts for threaded replies', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('ts', 'C123'))
      )

      await provider.send({
        channel: 'C123',
        text: 'Reply',
        threadId: '1234567890.000000',
      })

      const body = parseFetchJsonBody(mockFetch) as { thread_ts: string }
      expect(body.thread_ts).toBe('1234567890.000000')
    })

    it('should include blocks when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('ts', 'C123'))
      )

      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: '*Bold*' } }]
      await provider.send({
        channel: 'C123',
        text: 'Fallback',
        blocks,
      })

      const body = parseFetchJsonBody(mockFetch) as { blocks: unknown[] }
      expect(body.blocks).toEqual(blocks)
    })

    it('should include metadata when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('ts', 'C123'))
      )

      await provider.send({
        channel: 'C123',
        text: 'Message',
        metadata: { key: 'value' },
      })

      const body = parseFetchJsonBody(mockFetch) as { metadata: unknown }
      expect(body.metadata).toBeDefined()
    })

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.errorResponse('channel_not_found'))
      )

      const result = await provider.send({
        channel: 'C999',
        text: 'Message',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('channel_not_found')
    })
  })

  // ===========================================================================
  // Message Editing Tests
  // ===========================================================================

  describe('edit', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should edit existing message', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('1234567890.123456', 'C123'))
      )

      const result = await provider.edit!('1234567890.123456', 'Updated text')

      expect(result.success).toBe(true)
    })

    it('should call chat.update endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('ts', 'C123'))
      )

      await provider.edit!('ts', 'New text')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('chat.update')
    })

    it('should include blocks when editing', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.postMessageResponse('ts', 'C123'))
      )

      const blocks = [{ type: 'section', text: { type: 'plain_text', text: 'Updated' } }]
      await provider.edit!('ts', 'Text', blocks)

      const body = parseFetchJsonBody(mockFetch) as { blocks: unknown[] }
      expect(body.blocks).toEqual(blocks)
    })
  })

  // ===========================================================================
  // Message Deletion Tests
  // ===========================================================================

  describe('delete', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should delete message', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      const result = await provider.delete!('1234567890.123456', 'C123')

      expect(result).toBe(true)
    })

    it('should call chat.delete endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      await provider.delete!('ts', 'C123')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('chat.delete')
    })

    it('should return false on deletion failure', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.errorResponse('message_not_found'))
      )

      const result = await provider.delete!('ts', 'C123')

      expect(result).toBe(false)
    })
  })

  // ===========================================================================
  // Reaction Tests
  // ===========================================================================

  describe('react', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should add reaction to message', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      const result = await provider.react!('ts', 'C123', 'thumbsup')

      expect(result).toBe(true)
    })

    it('should strip colons from emoji name', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      await provider.react!('ts', 'C123', ':thumbsup:')

      const body = parseFetchJsonBody(mockFetch) as { name: string }
      expect(body.name).toBe('thumbsup')
    })

    it('should call reactions.add endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      await provider.react!('ts', 'C123', 'emoji')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('reactions.add')
    })
  })

  describe('unreact', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should remove reaction from message', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      const result = await provider.unreact!('ts', 'C123', 'thumbsup')

      expect(result).toBe(true)
    })

    it('should call reactions.remove endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      await provider.unreact!('ts', 'C123', 'emoji')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('reactions.remove')
    })
  })

  // ===========================================================================
  // Message Retrieval Tests
  // ===========================================================================

  describe('getMessage', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should retrieve message by timestamp', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          slackMocks.conversationsHistoryResponse([slackMocks.message('ts', 'C123', 'Hello')])
        )
      )

      const message = await provider.getMessage!('ts', 'C123')

      expect(message).not.toBeNull()
      expect(message?.id).toBe('ts')
      expect(message?.text).toBe('Hello')
    })

    it('should return null when message not found', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.conversationsHistoryResponse([])))

      const message = await provider.getMessage!('ts', 'C123')

      expect(message).toBeNull()
    })
  })

  describe('listMessages', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should return paginated messages', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          slackMocks.conversationsHistoryResponse(
            [
              slackMocks.message('ts1', 'C123', 'Message 1'),
              slackMocks.message('ts2', 'C123', 'Message 2'),
            ],
            true,
            'cursor123'
          )
        )
      )

      const result = await provider.listMessages!('C123')

      expect(result.items).toHaveLength(2)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe('cursor123')
    })

    it('should apply pagination options', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.conversationsHistoryResponse([])))

      await provider.listMessages!('C123', { limit: 50, cursor: 'cursor' })

      const body = parseFetchJsonBody(mockFetch) as { limit: number; cursor: string }
      expect(body.limit).toBe(50)
      expect(body.cursor).toBe('cursor')
    })

    it('should apply date filters', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.conversationsHistoryResponse([])))

      const since = new Date('2024-01-01')
      const until = new Date('2024-01-31')
      await provider.listMessages!('C123', { since, until })

      const body = parseFetchJsonBody(mockFetch) as { oldest: string; latest: string }
      expect(body.oldest).toBeDefined()
      expect(body.latest).toBeDefined()
    })
  })

  describe('searchMessages', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should search messages by query', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          messages: {
            matches: [
              slackMocks.message('ts', 'C123', 'Found message', { channel: { id: 'C123' } }),
            ],
            paging: { pages: 1, page: 1 },
            total: 1,
          },
        })
      )

      const result = await provider.searchMessages!('query')

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  // ===========================================================================
  // Channel Operations Tests
  // ===========================================================================

  describe('listChannels', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should return list of channels', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          slackMocks.conversationsListResponse([
            slackMocks.channel('C1', 'general'),
            slackMocks.channel('C2', 'random'),
          ])
        )
      )

      const result = await provider.listChannels!()

      expect(result.items).toHaveLength(2)
      expect(result.items[0].name).toBe('general')
    })

    it('should filter by channel types', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.conversationsListResponse([])))

      await provider.listChannels!({ types: ['private'] })

      const body = parseFetchJsonBody(mockFetch) as { types: string }
      expect(body.types).toContain('private_channel')
    })

    it('should exclude archived channels by default', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.conversationsListResponse([])))

      await provider.listChannels!()

      const body = parseFetchJsonBody(mockFetch) as { exclude_archived: boolean }
      expect(body.exclude_archived).toBe(true)
    })
  })

  describe('getChannel', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should retrieve channel by ID', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          channel: slackMocks.channel('C123', 'general'),
        })
      )

      const channel = await provider.getChannel!('C123')

      expect(channel).not.toBeNull()
      expect(channel?.id).toBe('C123')
      expect(channel?.name).toBe('general')
    })

    it('should return null for non-existent channel', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(slackMocks.errorResponse('channel_not_found'))
      )

      const channel = await provider.getChannel!('C999')

      expect(channel).toBeNull()
    })
  })

  describe('createChannel', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should create new channel', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          channel: slackMocks.channel('C456', 'new-channel'),
        })
      )

      const channel = await provider.createChannel!('new-channel')

      expect(channel.id).toBe('C456')
      expect(channel.name).toBe('new-channel')
    })

    it('should create private channel when specified', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          channel: slackMocks.channel('C456', 'private', { is_private: true }),
        })
      )

      await provider.createChannel!('private', { isPrivate: true })

      const body = parseFetchJsonBody(mockFetch) as { is_private: boolean }
      expect(body.is_private).toBe(true)
    })

    it('should set topic when provided', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            channel: slackMocks.channel('C456', 'channel'),
          })
        )
        .mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      await provider.createChannel!('channel', { topic: 'Channel topic' })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const { url } = getFetchCall(mockFetch, 1)
      expect(url).toContain('conversations.setTopic')
    })

    it('should throw on creation failure', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.errorResponse('name_taken')))

      await expect(provider.createChannel!('existing')).rejects.toThrow('name_taken')
    })
  })

  describe('archiveChannel', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should archive channel', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      const result = await provider.archiveChannel!('C123')

      expect(result).toBe(true)
    })
  })

  describe('joinChannel', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should join channel', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      const result = await provider.joinChannel!('C123')

      expect(result).toBe(true)
    })
  })

  describe('leaveChannel', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should leave channel', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse()))

      const result = await provider.leaveChannel!('C123')

      expect(result).toBe(true)
    })
  })

  // ===========================================================================
  // Member Operations Tests
  // ===========================================================================

  describe('listMembers', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should list workspace members', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          slackMocks.usersListResponse([
            slackMocks.user('U1', 'user1'),
            slackMocks.user('U2', 'user2'),
          ])
        )
      )

      const result = await provider.listMembers!()

      expect(result.items).toHaveLength(2)
      expect(result.items[0].username).toBe('user1')
    })

    it('should list channel members when channel specified', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            members: ['U1', 'U2'],
            response_metadata: {},
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            user: slackMocks.user('U1', 'user1'),
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            ok: true,
            user: slackMocks.user('U2', 'user2'),
          })
        )

      const result = await provider.listMembers!({ channel: 'C123' })

      expect(result.items).toHaveLength(2)
    })

    it('should filter out deleted users', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          slackMocks.usersListResponse([
            slackMocks.user('U1', 'active'),
            slackMocks.user('U2', 'deleted', { deleted: true }),
          ])
        )
      )

      const result = await provider.listMembers!()

      expect(result.items).toHaveLength(1)
      expect(result.items[0].username).toBe('active')
    })
  })

  describe('getMember', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should retrieve member by ID', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          user: slackMocks.user('U123', 'testuser'),
        })
      )

      const member = await provider.getMember!('U123')

      expect(member).not.toBeNull()
      expect(member?.id).toBe('U123')
      expect(member?.username).toBe('testuser')
    })

    it('should return null for non-existent user', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.errorResponse('user_not_found')))

      const member = await provider.getMember!('U999')

      expect(member).toBeNull()
    })

    it('should map user fields correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          user: slackMocks.user('U123', 'dev', {
            is_admin: true,
            is_bot: false,
            tz: 'America/Los_Angeles',
          }),
        })
      )

      const member = await provider.getMember!('U123')

      expect(member?.isAdmin).toBe(true)
      expect(member?.isBot).toBe(false)
      expect(member?.timezone).toBe('America/Los_Angeles')
    })
  })

  describe('getPresence', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should return online presence', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ ok: true, presence: 'active' }))

      const presence = await provider.getPresence!('U123')

      expect(presence.userId).toBe('U123')
      expect(presence.presence).toBe('online')
    })

    it('should return away presence', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ ok: true, presence: 'away' }))

      const presence = await provider.getPresence!('U123')

      expect(presence.presence).toBe('away')
    })
  })

  // ===========================================================================
  // Workspace Tests
  // ===========================================================================

  describe('getWorkspace', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should retrieve workspace info', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          team: slackMocks.team('T123', 'Test Workspace', 'testworkspace'),
        })
      )

      const workspace = await provider.getWorkspace!()

      expect(workspace.id).toBe('T123')
      expect(workspace.name).toBe('Test Workspace')
      expect(workspace.domain).toBe('testworkspace')
    })

    it('should throw on API failure', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.errorResponse('team_not_found')))

      await expect(provider.getWorkspace!()).rejects.toThrow('team_not_found')
    })
  })

  // ===========================================================================
  // API Request Formatting Tests
  // ===========================================================================

  describe('API request formatting', () => {
    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('should use POST method for all API calls', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse({ user: 'bot' })))

      await provider.healthCheck()

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.method).toBe('POST')
    })

    it('should use JSON content type', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.postMessageResponse('ts', 'C')))

      await provider.send({ channel: 'C', text: 'Test' })

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Content-Type', 'application/json; charset=utf-8')
    })

    it('should include Bearer token authorization', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.postMessageResponse('ts', 'C')))

      await provider.send({ channel: 'C', text: 'Test' })

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Authorization', 'Bearer xoxb-test-token')
    })

    it('should use correct base URL', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(slackMocks.okResponse({ user: 'bot' })))

      await provider.healthCheck()

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('https://slack.com/api/')
    })
  })

  // ===========================================================================
  // Dispose Tests
  // ===========================================================================

  describe('dispose', () => {
    it('should dispose without error', async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })

      await expect(provider.dispose()).resolves.toBeUndefined()
    })
  })
})
