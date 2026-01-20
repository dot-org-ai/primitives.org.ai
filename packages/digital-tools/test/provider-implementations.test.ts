/**
 * Tests for Provider Implementations
 *
 * Tests the actual provider factory functions and provider behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  // Email providers
  createResendProvider,
  createSendGridProvider,
  resendInfo,
  sendgridInfo,

  // Messaging providers
  createSlackProvider,
  createTwilioSmsProvider,
  slackInfo,
  twilioSmsInfo,

  // Spreadsheet providers
  createXlsxProvider,
  createGoogleSheetsProvider,
  xlsxInfo,
  googleSheetsInfo,

  // Other providers
  createCloudinaryProvider,
  createTodoistProvider,
  createStripeProvider,
  createZendeskProvider,
  createLinearProvider,
  createNotionProvider,
  createHubSpotProvider,
  createShopifyProvider,
  createGitHubProvider,
  createTypeformProvider,
  createMixpanelProvider,
  createZoomProvider,
  createGoogleMeetProvider,
  createTeamsProvider,
  createJitsiProvider,
  createGoogleCalendarProvider,
  createS3Provider,
} from '../src/providers/index.js'

import type {
  EmailProvider,
  MessagingProvider,
  SpreadsheetProvider,
  ProviderConfig,
} from '../src/providers/types.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Email Provider Implementations', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('Resend Provider', () => {
    let provider: EmailProvider

    beforeEach(async () => {
      provider = createResendProvider({ apiKey: 'test-api-key' })
      await provider.initialize({ apiKey: 'test-api-key' })
    })

    it('has correct info', () => {
      expect(provider.info.id).toBe('email.resend')
      expect(provider.info.name).toBe('Resend')
      expect(provider.info.category).toBe('email')
    })

    it('throws without API key', async () => {
      const emptyProvider = createResendProvider({})
      await expect(emptyProvider.initialize({})).rejects.toThrow('API key is required')
    })

    it('sends email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'msg_123' }),
      })

      const result = await provider.send({
        to: ['test@example.com'],
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Hello',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('msg_123')
    })

    it('handles send failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ name: 'validation_error', message: 'Invalid email' }),
      })

      const result = await provider.send({
        to: ['invalid'],
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Hello',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('validation_error')
    })

    it('returns error when from address is missing', async () => {
      const providerNoDefault = createResendProvider({ apiKey: 'key' })
      await providerNoDefault.initialize({ apiKey: 'key' })

      const result = await providerNoDefault.send({
        to: ['test@example.com'],
        subject: 'Test',
        text: 'Hello',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('MISSING_FROM')
    })

    it('performs health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
      expect(health.checkedAt).toBeInstanceOf(Date)
    })

    it('reports unhealthy on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Network error')
    })

    it('gets email by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          text: 'Test body',
          last_event: 'delivered',
          created_at: '2024-01-01T00:00:00Z',
        }),
      })

      const email = await provider.get!('msg_123')

      expect(email).not.toBeNull()
      expect(email?.id).toBe('msg_123')
      expect(email?.status).toBe('delivered')
    })

    it('returns null for non-existent email', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const email = await provider.get!('non-existent')

      expect(email).toBeNull()
    })

    it('sends batch emails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'msg_1' },
            { id: 'msg_2' },
          ],
        }),
      })

      const results = await provider.sendBatch!([
        { to: ['a@example.com'], subject: 'Test 1', text: 'Hello 1' },
        { to: ['b@example.com'], subject: 'Test 2', text: 'Hello 2' },
      ])

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[0].messageId).toBe('msg_1')
    })

    it('lists domains', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: 'example.com', status: 'verified', created_at: '2024-01-01T00:00:00Z' },
          ],
        }),
      })

      const domains = await provider.listDomains!()

      expect(domains).toHaveLength(1)
      expect(domains[0].domain).toBe('example.com')
      expect(domains[0].verified).toBe(true)
    })

    it('disposes without error', async () => {
      await expect(provider.dispose()).resolves.toBeUndefined()
    })
  })

  describe('SendGrid Provider', () => {
    let provider: EmailProvider

    beforeEach(async () => {
      provider = createSendGridProvider({ apiKey: 'test-api-key' })
      await provider.initialize({ apiKey: 'test-api-key' })
    })

    it('has correct info', () => {
      expect(provider.info.id).toBe('email.sendgrid')
      expect(provider.info.name).toBe('SendGrid')
      expect(provider.info.category).toBe('email')
    })
  })
})

describe('Messaging Provider Implementations', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('Slack Provider', () => {
    let provider: MessagingProvider

    beforeEach(async () => {
      provider = createSlackProvider({ accessToken: 'xoxb-test-token' })
      await provider.initialize({ accessToken: 'xoxb-test-token' })
    })

    it('has correct info', () => {
      expect(provider.info.id).toBe('messaging.slack')
      expect(provider.info.name).toBe('Slack')
      expect(provider.info.category).toBe('messaging')
    })

    it('throws without token', async () => {
      const emptyProvider = createSlackProvider({})
      await expect(emptyProvider.initialize({})).rejects.toThrow('token is required')
    })

    it('sends message to channel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          channel: 'C123',
        }),
      })

      const result = await provider.send({
        channel: 'C123',
        text: 'Hello Slack!',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('1234567890.123456')
      expect(result.channel).toBe('C123')
    })

    it('sends DM to user', async () => {
      // Mock conversations.open
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: { id: 'D123' },
        }),
      })
      // Mock chat.postMessage
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          channel: 'D123',
        }),
      })

      const result = await provider.send({
        userId: 'U123',
        text: 'Hello User!',
      })

      expect(result.success).toBe(true)
      expect(result.channel).toBe('D123')
    })

    it('returns error when target is missing', async () => {
      const result = await provider.send({
        text: 'No target!',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('MISSING_TARGET')
    })

    it('handles send failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      })

      const result = await provider.send({
        channel: 'C999',
        text: 'Hello!',
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('channel_not_found')
    })

    it('performs health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: 'testbot',
        }),
      })

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Connected as testbot')
    })

    it('edits message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          channel: 'C123',
        }),
      })

      const result = await provider.edit!('1234567890.123456', 'Updated text')

      expect(result.success).toBe(true)
    })

    it('deletes message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      const deleted = await provider.delete!('1234567890.123456', 'C123')

      expect(deleted).toBe(true)
    })

    it('adds reaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      const reacted = await provider.react!('1234567890.123456', 'C123', ':thumbsup:')

      expect(reacted).toBe(true)
    })

    it('lists channels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [
            {
              id: 'C123',
              name: 'general',
              is_private: false,
              is_archived: false,
              num_members: 10,
              created: 1609459200,
            },
          ],
          response_metadata: {},
        }),
      })

      const result = await provider.listChannels!()

      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('general')
      expect(result.items[0].isPrivate).toBe(false)
    })

    it('gets channel info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: {
            id: 'C123',
            name: 'general',
            is_private: false,
            is_archived: false,
            num_members: 10,
            created: 1609459200,
          },
        }),
      })

      const channel = await provider.getChannel!('C123')

      expect(channel).not.toBeNull()
      expect(channel?.id).toBe('C123')
    })

    it('creates channel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: {
            id: 'C456',
            name: 'new-channel',
            is_private: false,
            is_archived: false,
            num_members: 1,
            created: 1609459200,
          },
        }),
      })

      const channel = await provider.createChannel!('new-channel')

      expect(channel.id).toBe('C456')
      expect(channel.name).toBe('new-channel')
    })

    it('gets workspace info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          team: {
            id: 'T123',
            name: 'Test Workspace',
            domain: 'testworkspace',
            icon: { image_132: 'https://example.com/icon.png' },
          },
        }),
      })

      const workspace = await provider.getWorkspace!()

      expect(workspace.id).toBe('T123')
      expect(workspace.name).toBe('Test Workspace')
      expect(workspace.domain).toBe('testworkspace')
    })

    it('gets member info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user: {
            id: 'U123',
            name: 'testuser',
            real_name: 'Test User',
            is_admin: false,
            is_bot: false,
            tz: 'America/New_York',
            profile: {
              email: 'test@example.com',
              image_192: 'https://example.com/avatar.png',
              title: 'Developer',
            },
          },
        }),
      })

      const member = await provider.getMember!('U123')

      expect(member).not.toBeNull()
      expect(member?.id).toBe('U123')
      expect(member?.displayName).toBe('Test User')
      expect(member?.email).toBe('test@example.com')
    })

    it('gets user presence', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          presence: 'active',
        }),
      })

      const presence = await provider.getPresence!('U123')

      expect(presence.userId).toBe('U123')
      expect(presence.presence).toBe('online')
    })
  })

  describe('Twilio SMS Provider', () => {
    let provider: any

    beforeEach(async () => {
      provider = createTwilioSmsProvider({
        accountSid: 'AC123',
        authToken: 'auth-token',
        fromNumber: '+15551234567',
      })
      await provider.initialize({
        accountSid: 'AC123',
        authToken: 'auth-token',
        fromNumber: '+15551234567',
      })
    })

    it('has correct info', () => {
      expect(provider.info.id).toBe('messaging.twilio-sms')
      expect(provider.info.name).toBe('Twilio SMS')
      expect(provider.info.category).toBe('messaging')
    })
  })
})

describe('Spreadsheet Provider Implementations', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('XLSX Provider', () => {
    let provider: SpreadsheetProvider

    beforeEach(async () => {
      provider = createXlsxProvider({})
      await provider.initialize({})
    })

    it('has correct info', () => {
      expect(provider.info.id).toBe('spreadsheet.xlsx')
      expect(provider.info.name).toBe('XLSX (SheetJS)')
      expect(provider.info.category).toBe('spreadsheet')
    })

    it('creates spreadsheet', async () => {
      const spreadsheet = await provider.create('Test Spreadsheet')

      expect(spreadsheet.name).toBe('Test Spreadsheet')
      expect(spreadsheet.sheets.length).toBeGreaterThanOrEqual(1)
    })

    it('reads and writes cell ranges', async () => {
      const spreadsheet = await provider.create('Test')
      const sheetId = spreadsheet.sheets[0].id

      // Write data
      await provider.writeRange(spreadsheet.id, 'Sheet1!A1:B2', [
        ['Name', 'Value'],
        ['Test', '123'],
      ])

      // Read data back
      const data = await provider.readRange(spreadsheet.id, 'Sheet1!A1:B2')

      expect(data).toHaveLength(2)
      expect(data[0]).toEqual(['Name', 'Value'])
      expect(data[1]).toEqual(['Test', '123'])
    })

    it('adds and removes sheets', async () => {
      const spreadsheet = await provider.create('Test')

      // Add sheet
      const newSheet = await provider.addSheet(spreadsheet.id, 'NewSheet')
      expect(newSheet.name).toBe('NewSheet')

      // Delete sheet
      const deleted = await provider.deleteSheet(spreadsheet.id, newSheet.id)
      expect(deleted).toBe(true)
    })
  })

  describe('Google Sheets Provider', () => {
    let provider: SpreadsheetProvider

    beforeEach(async () => {
      provider = createGoogleSheetsProvider({
        accessToken: 'test-token',
      })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('has correct info', () => {
      expect(provider.info.id).toBe('spreadsheet.google-sheets')
      expect(provider.info.name).toBe('Google Sheets')
      expect(provider.info.category).toBe('spreadsheet')
    })
  })
})

describe('Provider Factory Functions', () => {
  it('creates Cloudinary provider', async () => {
    const provider = createCloudinaryProvider({
      cloudName: 'test',
      apiKey: 'key',
      apiSecret: 'secret',
    })
    expect(provider.info.id).toBe('media.cloudinary')
  })

  it('creates Todoist provider', async () => {
    const provider = createTodoistProvider({ apiKey: 'token' })
    expect(provider.info.id).toBe('tasks.todoist')
  })

  it('creates Stripe provider', async () => {
    const provider = createStripeProvider({ apiKey: 'sk_test' })
    expect(provider.info.id).toBe('finance.stripe')
  })

  it('creates Zendesk provider', async () => {
    const provider = createZendeskProvider({ subdomain: 'test', email: 'test@test.com', apiKey: 'token' })
    expect(provider.info.id).toBe('support.zendesk')
  })

  it('creates Linear provider', async () => {
    const provider = createLinearProvider({ apiKey: 'key' })
    expect(provider.info.id).toBe('project-management.linear')
  })

  it('creates Notion provider', async () => {
    const provider = createNotionProvider({ integrationToken: 'key' })
    expect(provider.info.id).toBe('knowledge.notion')
  })

  it('creates HubSpot provider', async () => {
    const provider = createHubSpotProvider({ accessToken: 'token' })
    expect(provider.info.id).toBe('crm.hubspot')
  })

  it('creates Shopify provider', async () => {
    const provider = createShopifyProvider({ shopDomain: 'test', accessToken: 'token' })
    expect(provider.info.id).toBe('ecommerce.shopify')
  })

  it('creates GitHub provider', async () => {
    const provider = createGitHubProvider({ accessToken: 'token' })
    expect(provider.info.id).toBe('development.github')
  })

  it('creates Typeform provider', async () => {
    const provider = createTypeformProvider({ accessToken: 'token' })
    expect(provider.info.id).toBe('forms.typeform')
  })

  it('creates Mixpanel provider', async () => {
    const provider = createMixpanelProvider({ projectToken: 'token' })
    expect(provider.info.id).toBe('analytics.mixpanel')
  })

  it('creates Zoom provider', async () => {
    const provider = createZoomProvider({ accountId: 'id', clientId: 'client', clientSecret: 'secret' })
    expect(provider.info.id).toBe('video-conferencing.zoom')
  })

  it('creates Google Meet provider', async () => {
    const provider = createGoogleMeetProvider({ accessToken: 'token' })
    expect(provider.info.id).toBe('meeting.google-meet')
  })

  it('creates Teams provider', async () => {
    const provider = createTeamsProvider({ accessToken: 'token' })
    expect(provider.info.id).toBe('meeting.teams')
  })

  it('creates Jitsi provider', async () => {
    const provider = createJitsiProvider({})
    expect(provider.info.id).toBe('meeting.jitsi')
  })

  it('creates Google Calendar provider', async () => {
    const provider = createGoogleCalendarProvider({ accessToken: 'token' })
    expect(provider.info.id).toBe('calendar.google-calendar')
  })

  it('creates S3 provider', async () => {
    const provider = createS3Provider({
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'bucket',
      region: 'us-east-1',
    })
    expect(provider.info.id).toBe('storage.s3')
  })
})
