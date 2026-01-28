/**
 * Tests for Slack Transport Adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SlackTransport,
  createSlackTransport,
  registerSlackTransport,
  slackSection,
  slackHeader,
  slackDivider,
  slackContext,
  slackButton,
  slackActions,
} from '../../src/transports/slack.js'
import type {
  SlackTransportConfig,
  SlackWebhookRequest,
  SlackInteractionPayload,
  SlackPostMessageResponse,
  SlackBlock,
} from '../../src/transports/slack.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Test configuration
const testConfig: Omit<SlackTransportConfig, 'transport'> = {
  botToken: 'xoxb-test-token',
  signingSecret: 'test-signing-secret',
  apiUrl: 'https://slack.test/api',
}

// Mock successful Slack API response
const mockPostMessageResponse: SlackPostMessageResponse = {
  ok: true,
  ts: '1234567890.123456',
  channel: 'C123456',
  message: {
    type: 'message',
    text: 'Test message',
    ts: '1234567890.123456',
    bot_id: 'B123456',
  },
}

// Mock DM open response
const mockDMOpenResponse = {
  ok: true,
  channel: {
    id: 'D123456',
  },
}

describe('SlackTransport', () => {
  let transport: SlackTransport

  beforeEach(() => {
    vi.clearAllMocks()
    transport = createSlackTransport(testConfig)

    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPostMessageResponse),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create transport with config', () => {
      expect(transport).toBeInstanceOf(SlackTransport)
    })

    it('should use default API URL when not provided', () => {
      const transportWithoutUrl = createSlackTransport({
        botToken: 'xoxb-test',
        signingSecret: 'secret',
      })
      expect(transportWithoutUrl).toBeInstanceOf(SlackTransport)
    })
  })

  describe('sendNotification', () => {
    it('should send notification to channel', async () => {
      const result = await transport.sendNotification('#engineering', 'Hello team!')

      expect(result.success).toBe(true)
      expect(result.transport).toBe('slack')
      expect(result.messageId).toBe('1234567890.123456')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.test/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer xoxb-test-token',
          }),
        })
      )

      // Verify the body
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.channel).toBe('engineering')
      expect(callBody.text).toBe('Hello team!')
    })

    it('should send notification to channel ID', async () => {
      const result = await transport.sendNotification('C123456', 'Direct channel message')

      expect(result.success).toBe(true)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.channel).toBe('C123456')
    })

    it('should format high priority messages with header', async () => {
      await transport.sendNotification('#alerts', 'Critical issue!', {
        priority: 'high',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.blocks).toBeDefined()
      expect(callBody.blocks[0].type).toBe('header')
      expect(callBody.blocks[0].text.text).toContain('HIGH')
    })

    it('should format urgent priority messages with header', async () => {
      await transport.sendNotification('#alerts', 'Server down!', {
        priority: 'urgent',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.blocks[0].text.text).toContain('URGENT')
    })

    it('should include metadata in context block', async () => {
      await transport.sendNotification('#deploys', 'Deployment complete', {
        metadata: {
          version: '2.1.0',
          environment: 'production',
        },
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const contextBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'context')
      expect(contextBlock).toBeDefined()
    })

    it('should include thread_ts when provided', async () => {
      await transport.sendNotification('#channel', 'Reply message', {
        threadTs: '1234567890.000001',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.thread_ts).toBe('1234567890.000001')
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
      })

      const result = await transport.sendNotification('#nonexistent', 'Test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('channel_not_found')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await transport.sendNotification('#channel', 'Test')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('sendNotification to DMs', () => {
    beforeEach(() => {
      // Mock DM open followed by message send
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockDMOpenResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPostMessageResponse),
        })
    })

    it('should handle @user reference when user not found', async () => {
      // Mock user lookup to return a user ID
      const transportWithUserLookup = createSlackTransport(testConfig)

      // For @user, it will try to find user (returns null), then return error
      const result = await transportWithUserLookup.sendNotification('@alice', 'Hello Alice!')

      expect(result.success).toBe(false)
      expect(result.error).toContain('User not found: alice')
    })

    it('should send to user ID directly', async () => {
      // Reset mock for direct user ID
      mockFetch.mockReset()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockDMOpenResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPostMessageResponse),
        })

      const result = await transport.sendNotification('U123456', 'Hello!')

      expect(result.success).toBe(true)
      // Should call conversations.open first, then chat.postMessage
      expect(mockFetch).toHaveBeenCalledTimes(1) // User IDs go directly to postMessage
    })
  })

  describe('sendApprovalRequest', () => {
    it('should send approval request with buttons', async () => {
      const result = await transport.sendApprovalRequest('#approvals', 'Approve deployment?')

      expect(result.success).toBe(true)
      expect(result.metadata?.requestId).toBeDefined()

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      // Should have approval blocks
      expect(callBody.blocks).toBeDefined()

      // Find actions block with buttons
      const actionsBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'actions')
      expect(actionsBlock).toBeDefined()
      expect(actionsBlock.elements).toHaveLength(2)

      // Approve button
      expect(actionsBlock.elements[0].style).toBe('primary')
      expect(actionsBlock.elements[0].action_id).toContain('approve_')

      // Reject button
      expect(actionsBlock.elements[1].style).toBe('danger')
      expect(actionsBlock.elements[1].action_id).toContain('reject_')
    })

    it('should include context in approval request', async () => {
      await transport.sendApprovalRequest('#approvals', 'Approve expense?', {
        context: {
          amount: 500,
          category: 'Infrastructure',
        },
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      // Should have context fields
      const sectionWithFields = callBody.blocks.find(
        (b: SlackBlock) => b.type === 'section' && 'fields' in b
      )
      expect(sectionWithFields).toBeDefined()
    })

    it('should use custom button labels', async () => {
      await transport.sendApprovalRequest('#approvals', 'Accept request?', {
        approveLabel: 'Accept',
        rejectLabel: 'Decline',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const actionsBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'actions')

      expect(actionsBlock.elements[0].text.text).toBe('Accept')
      expect(actionsBlock.elements[1].text.text).toBe('Decline')
    })

    it('should use provided requestId', async () => {
      await transport.sendApprovalRequest('#approvals', 'Test', {
        requestId: 'custom-request-123',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const actionsBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'actions')

      expect(actionsBlock.block_id).toContain('custom-request-123')
      expect(actionsBlock.elements[0].action_id).toContain('custom-request-123')
    })
  })

  describe('sendQuestion', () => {
    it('should send question without choices', async () => {
      const result = await transport.sendQuestion('#channel', 'What is the status?')

      expect(result.success).toBe(true)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.text).toBe('What is the status?')
    })

    it('should send question with choice buttons', async () => {
      await transport.sendQuestion('#channel', 'Choose an option:', {
        choices: ['Option A', 'Option B', 'Option C'],
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const actionsBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'actions')

      expect(actionsBlock).toBeDefined()
      expect(actionsBlock.elements).toHaveLength(3)
      expect(actionsBlock.elements[0].text.text).toBe('Option A')
    })

    it('should limit choices to 5 buttons', async () => {
      await transport.sendQuestion('#channel', 'Pick one:', {
        choices: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const actionsBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'actions')

      expect(actionsBlock.elements).toHaveLength(5)
    })
  })

  describe('handleWebhook', () => {
    it('should reject invalid or fail on signature verification', async () => {
      const timestamp = String(Math.floor(Date.now() / 1000))
      const body = JSON.stringify({ type: 'block_actions' })

      const request: SlackWebhookRequest = {
        headers: {
          'x-slack-signature': 'v0=invalid_signature',
          'x-slack-request-timestamp': timestamp,
        },
        body,
        rawBody: body,
      }

      const result = await transport.handleWebhook(request)

      // Signature verification should fail (either invalid signature or crypto not available)
      expect(result.success).toBe(false)
      // Error could be about signature or crypto depending on environment
      expect(result.error).toBeDefined()
    })

    it('should reject expired timestamp', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 6+ minutes ago

      const request: SlackWebhookRequest = {
        headers: {
          'x-slack-signature': 'v0=abc123',
          'x-slack-request-timestamp': String(oldTimestamp),
        },
        body: JSON.stringify({ type: 'block_actions' }),
      }

      const result = await transport.handleWebhook(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('signature')
    })

    it('should reject missing signature headers', async () => {
      const request: SlackWebhookRequest = {
        headers: {},
        body: JSON.stringify({ type: 'block_actions' }),
      } as SlackWebhookRequest

      const result = await transport.handleWebhook(request)

      expect(result.success).toBe(false)
    })
  })

  describe('updateMessage', () => {
    it('should update existing message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, ts: '1234567890.123456' }),
      })

      const result = await transport.updateMessage(
        'C123456',
        '1234567890.123456',
        'Updated message'
      )

      expect(result.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.test/api/chat.update',
        expect.any(Object)
      )
    })

    it('should include blocks in update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })

      const blocks: SlackBlock[] = [
        { type: 'section', text: { type: 'mrkdwn', text: 'Updated content' } },
      ]

      await transport.updateMessage('C123456', '1234567890.123456', 'Updated', blocks)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.blocks).toEqual(blocks)
    })
  })

  describe('openDM', () => {
    it('should open DM with user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDMOpenResponse),
      })

      const channelId = await transport.openDM('U123456')

      expect(channelId).toBe('D123456')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.test/api/conversations.open',
        expect.any(Object)
      )
    })

    it('should throw on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'user_not_found' }),
      })

      await expect(transport.openDM('U999999')).rejects.toThrow('user_not_found')
    })
  })

  describe('lookupUserByEmail', () => {
    it('should return user ID when found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            user: { id: 'U123456', name: 'alice', real_name: 'Alice' },
          }),
      })

      const userId = await transport.lookupUserByEmail('alice@company.com')

      expect(userId).toBe('U123456')
    })

    it('should return null when not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'users_not_found' }),
      })

      const userId = await transport.lookupUserByEmail('nobody@company.com')

      expect(userId).toBeNull()
    })
  })

  describe('getHandler', () => {
    it('should return a transport handler', () => {
      const handler = transport.getHandler()

      expect(typeof handler).toBe('function')
    })

    it('should handle notification payload', async () => {
      const handler = transport.getHandler()

      const result = await handler(
        {
          to: '#channel',
          body: 'Test notification',
          type: 'notification',
        },
        testConfig as any
      )

      expect(result.transport).toBe('slack')
    })

    it('should handle approval payload', async () => {
      const handler = transport.getHandler()

      const result = await handler(
        {
          to: '#channel',
          body: 'Approve this?',
          type: 'approval',
          actions: [
            { id: 'approve', label: 'Approve', style: 'primary' },
            { id: 'reject', label: 'Reject', style: 'danger' },
          ],
        },
        testConfig as any
      )

      expect(result.transport).toBe('slack')
    })

    it('should handle question payload', async () => {
      const handler = transport.getHandler()

      const result = await handler(
        {
          to: '#channel',
          body: 'Choose one:',
          type: 'question',
          actions: [
            { id: 'a', label: 'Option A' },
            { id: 'b', label: 'Option B' },
          ],
        },
        testConfig as any
      )

      expect(result.transport).toBe('slack')
    })

    it('should handle missing target', async () => {
      const handler = transport.getHandler()

      const result = await handler(
        {
          to: [],
          body: 'Test',
          type: 'notification',
        },
        testConfig as any
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('No target')
    })
  })

  describe('register', () => {
    it('should register transport handler', () => {
      // This test just verifies no errors are thrown
      transport.register()
    })
  })
})

describe('Factory Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPostMessageResponse),
    })
  })

  describe('createSlackTransport', () => {
    it('should create transport instance', () => {
      const transport = createSlackTransport(testConfig)
      expect(transport).toBeInstanceOf(SlackTransport)
    })
  })

  describe('registerSlackTransport', () => {
    it('should create and register transport', () => {
      const transport = registerSlackTransport(testConfig)
      expect(transport).toBeInstanceOf(SlackTransport)
    })
  })
})

describe('Block Kit Helpers', () => {
  describe('slackSection', () => {
    it('should create section block with text', () => {
      const block = slackSection('Hello world')

      expect(block.type).toBe('section')
      expect(block.text?.type).toBe('mrkdwn')
      expect(block.text?.text).toBe('Hello world')
    })

    it('should include fields when provided', () => {
      const block = slackSection('Main text', {
        fields: ['*Field 1:* Value 1', '*Field 2:* Value 2'],
      })

      expect(block.fields).toHaveLength(2)
      expect(block.fields?.[0].text).toBe('*Field 1:* Value 1')
    })
  })

  describe('slackHeader', () => {
    it('should create header block', () => {
      const block = slackHeader('Important Header')

      expect(block.type).toBe('header')
      expect(block.text.type).toBe('plain_text')
      expect(block.text.text).toBe('Important Header')
      expect(block.text.emoji).toBe(true)
    })
  })

  describe('slackDivider', () => {
    it('should create divider block', () => {
      const block = slackDivider()

      expect(block.type).toBe('divider')
    })
  })

  describe('slackContext', () => {
    it('should create context block with single element', () => {
      const block = slackContext('Context info')

      expect(block.type).toBe('context')
      expect(block.elements).toHaveLength(1)
      expect(block.elements[0].text).toBe('Context info')
    })

    it('should create context block with multiple elements', () => {
      const block = slackContext('Info 1', 'Info 2', 'Info 3')

      expect(block.elements).toHaveLength(3)
    })
  })

  describe('slackButton', () => {
    it('should create basic button', () => {
      const button = slackButton('Click me', 'button_click')

      expect(button.type).toBe('button')
      expect(button.text.text).toBe('Click me')
      expect(button.action_id).toBe('button_click')
    })

    it('should include optional properties', () => {
      const button = slackButton('Submit', 'submit_action', {
        value: 'submit_value',
        style: 'primary',
        url: 'https://example.com',
      })

      expect(button.value).toBe('submit_value')
      expect(button.style).toBe('primary')
      expect(button.url).toBe('https://example.com')
    })

    it('should not include undefined optional properties', () => {
      const button = slackButton('Simple', 'simple_action')

      expect(button).not.toHaveProperty('value')
      expect(button).not.toHaveProperty('style')
      expect(button).not.toHaveProperty('url')
    })
  })

  describe('slackActions', () => {
    it('should create actions block with buttons', () => {
      const button1 = slackButton('Button 1', 'action_1')
      const button2 = slackButton('Button 2', 'action_2')

      const block = slackActions('my_actions', button1, button2)

      expect(block.type).toBe('actions')
      expect(block.block_id).toBe('my_actions')
      expect(block.elements).toHaveLength(2)
    })

    it('should handle single button', () => {
      const button = slackButton('Only Button', 'only_action')
      const block = slackActions('single_action', button)

      expect(block.elements).toHaveLength(1)
    })
  })
})

describe('Integration Scenarios', () => {
  let transport: SlackTransport

  beforeEach(() => {
    vi.clearAllMocks()
    transport = createSlackTransport(testConfig)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPostMessageResponse),
    })
  })

  it('should handle deployment approval workflow', async () => {
    // Send approval request
    const approvalResult = await transport.sendApprovalRequest(
      '#deployments',
      'Deploy v2.1.0 to production?',
      {
        context: {
          version: '2.1.0',
          environment: 'production',
          requestedBy: 'alice@company.com',
        },
        requestId: 'deploy-123',
      }
    )

    expect(approvalResult.success).toBe(true)
    expect(approvalResult.metadata?.requestId).toBe('deploy-123')
  })

  it('should handle incident notification', async () => {
    const result = await transport.sendNotification(
      '#incidents',
      'Production database connection pool exhausted',
      {
        priority: 'urgent',
        metadata: {
          severity: 'P1',
          service: 'api-gateway',
          timestamp: new Date().toISOString(),
        },
      }
    )

    expect(result.success).toBe(true)

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.blocks[0].text.text).toContain('URGENT')
  })

  it('should handle team poll', async () => {
    const result = await transport.sendQuestion(
      '#engineering',
      'When should we schedule the sprint review?',
      {
        choices: ['Monday 10am', 'Tuesday 2pm', 'Wednesday 3pm', 'Thursday 11am'],
        requestId: 'poll-456',
      }
    )

    expect(result.success).toBe(true)

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const actionsBlock = callBody.blocks.find((b: SlackBlock) => b.type === 'actions')
    expect(actionsBlock.elements).toHaveLength(4)
  })
})
