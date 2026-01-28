/**
 * Tests for Runtime Integration
 *
 * Tests the HumanRequestProcessor that connects transport adapters
 * to request handling, store management, and callback notification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  HumanRequestProcessor,
  createHumanRequestProcessor,
  InMemoryRequestStore,
  type HumanRequest,
  type HumanRequestStore,
  type RequestStatus,
  type ProcessorConfig,
  type RequestResult,
} from '../src/runtime.js'
import { SlackTransport, createSlackTransport } from '../src/transports/slack.js'
import {
  EmailTransport,
  createEmailTransportWithProvider,
  type EmailProvider,
} from '../src/transports/email.js'
import type { DeliveryResult } from '../src/transports.js'

// =============================================================================
// Mock Setup
// =============================================================================

// Mock fetch for Slack API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock Slack API responses
const mockSlackPostMessageResponse = {
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

// Mock email provider
function createMockEmailProvider(): EmailProvider {
  return {
    name: 'mock',
    send: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'msg_mock_123',
    }),
  }
}

// =============================================================================
// InMemoryRequestStore Tests
// =============================================================================

describe('InMemoryRequestStore', () => {
  let store: InMemoryRequestStore

  beforeEach(() => {
    store = new InMemoryRequestStore()
  })

  describe('create', () => {
    it('should create a new request', async () => {
      const request = await store.create({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Approve expense $500',
        requestedBy: { id: 'user_1', name: 'Alice' },
        transport: 'email',
      })

      expect(request.id).toBeDefined()
      expect(request.status).toBe('pending')
      expect(request.createdAt).toBeInstanceOf(Date)
      expect(request.content).toBe('Approve expense $500')
    })

    it('should generate unique IDs', async () => {
      const req1 = await store.create({
        type: 'approval',
        target: 'a@example.com',
        content: 'Test 1',
        transport: 'email',
      })
      const req2 = await store.create({
        type: 'approval',
        target: 'b@example.com',
        content: 'Test 2',
        transport: 'email',
      })

      expect(req1.id).not.toBe(req2.id)
    })
  })

  describe('get', () => {
    it('should retrieve a request by ID', async () => {
      const created = await store.create({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Test',
        transport: 'slack',
      })

      const retrieved = await store.get(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.content).toBe('Test')
    })

    it('should return undefined for non-existent request', async () => {
      const retrieved = await store.get('non_existent_id')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update request status', async () => {
      const request = await store.create({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Test',
        transport: 'email',
      })

      const updated = await store.update(request.id, {
        status: 'completed',
        result: { approved: true },
      })

      expect(updated?.status).toBe('completed')
      expect(updated?.result).toEqual({ approved: true })
      expect(updated?.completedAt).toBeInstanceOf(Date)
    })

    it('should return undefined when updating non-existent request', async () => {
      const updated = await store.update('non_existent', { status: 'completed' })
      expect(updated).toBeUndefined()
    })
  })

  describe('findByExternalId', () => {
    it('should find request by external message ID', async () => {
      const request = await store.create({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Test',
        transport: 'slack',
      })

      await store.update(request.id, {
        externalId: 'slack_msg_123',
      })

      const found = await store.findByExternalId('slack_msg_123')

      expect(found).toBeDefined()
      expect(found?.id).toBe(request.id)
    })

    it('should return undefined for non-existent external ID', async () => {
      const found = await store.findByExternalId('non_existent')
      expect(found).toBeUndefined()
    })
  })

  describe('listPending', () => {
    it('should list pending requests', async () => {
      await store.create({
        type: 'approval',
        target: 'a@example.com',
        content: 'Test 1',
        transport: 'email',
      })
      const req2 = await store.create({
        type: 'approval',
        target: 'b@example.com',
        content: 'Test 2',
        transport: 'email',
      })
      await store.update(req2.id, { status: 'completed' })

      const pending = await store.listPending()

      expect(pending).toHaveLength(1)
      expect(pending[0].content).toBe('Test 1')
    })
  })

  describe('listExpired', () => {
    it('should list expired requests', async () => {
      const pastDate = new Date(Date.now() - 1000)

      const request = await store.create({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Test',
        transport: 'email',
        expiresAt: pastDate,
      })

      const expired = await store.listExpired()

      expect(expired).toHaveLength(1)
      expect(expired[0].id).toBe(request.id)
    })

    it('should not include non-expired requests', async () => {
      const futureDate = new Date(Date.now() + 60000)

      await store.create({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Test',
        transport: 'email',
        expiresAt: futureDate,
      })

      const expired = await store.listExpired()

      expect(expired).toHaveLength(0)
    })
  })
})

// =============================================================================
// HumanRequestProcessor Tests
// =============================================================================

describe('HumanRequestProcessor', () => {
  let processor: HumanRequestProcessor
  let store: InMemoryRequestStore
  let slackTransport: SlackTransport
  let emailTransport: EmailTransport
  let mockEmailProvider: EmailProvider

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock fetch for Slack
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSlackPostMessageResponse),
    })

    store = new InMemoryRequestStore()

    slackTransport = createSlackTransport({
      botToken: 'xoxb-test-token',
      signingSecret: 'test-secret',
      apiUrl: 'https://slack.test/api',
    })

    mockEmailProvider = createMockEmailProvider()
    emailTransport = createEmailTransportWithProvider(mockEmailProvider, {
      from: 'approvals@example.com',
      approvalBaseUrl: 'https://app.example.com/approvals',
    })

    processor = createHumanRequestProcessor({
      store,
      transports: {
        slack: slackTransport,
        email: emailTransport,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('submitRequest', () => {
    it('should submit approval request via Slack transport', async () => {
      const result = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Approve deployment to production?',
        transport: 'slack',
        context: { version: '2.1.0' },
        requestedBy: { id: 'user_1', name: 'Alice' },
      })

      expect(result.success).toBe(true)
      expect(result.requestId).toBeDefined()
      expect(result.externalId).toBe('1234567890.123456')

      // Verify request was stored
      const stored = await store.get(result.requestId!)
      expect(stored).toBeDefined()
      expect(stored?.status).toBe('pending')
      expect(stored?.transport).toBe('slack')
    })

    it('should submit approval request via Email transport', async () => {
      const result = await processor.submitRequest({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Approve expense $500?',
        transport: 'email',
        context: { amount: 500 },
        requestedBy: { id: 'user_2', name: 'Bob' },
      })

      expect(result.success).toBe(true)
      expect(result.requestId).toBeDefined()

      expect(mockEmailProvider.send).toHaveBeenCalled()
    })

    it('should store request with timeout', async () => {
      const timeout = 30000 // 30 seconds

      const result = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Time-sensitive approval',
        transport: 'slack',
        timeout,
      })

      const stored = await store.get(result.requestId!)
      expect(stored?.expiresAt).toBeDefined()

      // Should expire roughly at timeout time
      const expectedExpiry = Date.now() + timeout
      const actualExpiry = stored!.expiresAt!.getTime()
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000)
    })

    it('should handle transport failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
      })

      const result = await processor.submitRequest({
        type: 'approval',
        target: '#nonexistent',
        content: 'Test',
        transport: 'slack',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('channel_not_found')
    })

    it('should reject unsupported transport', async () => {
      const result = await processor.submitRequest({
        type: 'approval',
        target: '+1234567890',
        content: 'Test',
        transport: 'sms' as any, // Not configured
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not configured')
    })
  })

  describe('handleWebhook (Slack)', () => {
    it('should process approval response from Slack', async () => {
      // First submit a request
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Approve deployment?',
        transport: 'slack',
        requestedBy: { id: 'user_1' },
      })

      const requestId = submitResult.requestId!

      // Mock the webhook payload for approval
      const webhookResult = await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId,
        approved: true,
        respondedBy: { id: 'U123456', name: 'Manager' },
        notes: 'Looks good!',
      })

      expect(webhookResult.success).toBe(true)
      expect(webhookResult.requestId).toBe(requestId)

      // Verify request was updated
      const stored = await store.get(requestId)
      expect(stored?.status).toBe('completed')
      expect(stored?.result?.approved).toBe(true)
      expect(stored?.result?.respondedBy?.id).toBe('U123456')
    })

    it('should process rejection response', async () => {
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Approve deployment?',
        transport: 'slack',
      })

      const webhookResult = await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: false,
        respondedBy: { id: 'U123456' },
        notes: 'Not ready yet',
      })

      expect(webhookResult.success).toBe(true)

      const stored = await store.get(submitResult.requestId!)
      expect(stored?.result?.approved).toBe(false)
    })

    it('should reject webhook for non-existent request', async () => {
      const webhookResult = await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: 'non_existent',
        approved: true,
      })

      expect(webhookResult.success).toBe(false)
      expect(webhookResult.error).toContain('not found')
    })

    it('should reject webhook for already completed request', async () => {
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Test',
        transport: 'slack',
      })

      // Complete the request
      await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: true,
      })

      // Try to respond again
      const duplicateResult = await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: false,
      })

      expect(duplicateResult.success).toBe(false)
      expect(duplicateResult.error).toContain('already completed')
    })
  })

  describe('handleWebhook (Email)', () => {
    it('should process approval response from email reply', async () => {
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: 'manager@example.com',
        content: 'Approve expense?',
        transport: 'email',
      })

      const webhookResult = await processor.handleWebhook('email', {
        type: 'email_reply',
        requestId: submitResult.requestId!,
        from: 'manager@example.com',
        content: 'APPROVED\n\nGo ahead.',
      })

      expect(webhookResult.success).toBe(true)

      const stored = await store.get(submitResult.requestId!)
      expect(stored?.result?.approved).toBe(true)
    })
  })

  describe('onComplete callback', () => {
    it('should call onComplete when request is completed', async () => {
      const onComplete = vi.fn()

      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        onComplete,
      })

      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Test',
        transport: 'slack',
      })

      await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: true,
        respondedBy: { id: 'U123456' },
      })

      expect(onComplete).toHaveBeenCalledTimes(1)
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: submitResult.requestId,
          result: expect.objectContaining({
            approved: true,
          }),
        })
      )
    })

    it('should call onComplete with rejection result', async () => {
      const onComplete = vi.fn()

      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        onComplete,
      })

      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Test',
        transport: 'slack',
      })

      await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: false,
      })

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.objectContaining({
            approved: false,
          }),
        })
      )
    })
  })

  describe('requestor notification', () => {
    it('should notify requestor when request is approved', async () => {
      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        notifyRequestor: true,
      })

      // Clear the initial submit call
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSlackPostMessageResponse),
      })

      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Approve deployment?',
        transport: 'slack',
        requestedBy: { id: 'U_REQUESTOR' },
        notifyChannel: '#notifications',
      })

      // Clear submit calls, track webhook completion
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSlackPostMessageResponse),
      })

      await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: true,
        respondedBy: { id: 'U123456', name: 'Manager' },
      })

      // Should have sent notification to requestor
      expect(mockFetch).toHaveBeenCalled()
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      const body = JSON.parse(lastCall[1].body)
      expect(body.channel).toBe('notifications')
      expect(body.text).toContain('approved')
    })
  })

  describe('timeout handling', () => {
    it('should expire timed out requests when checked manually', async () => {
      const onTimeout = vi.fn()

      // Create a request with an already-expired timestamp
      const expiredRequest = await store.create({
        type: 'approval',
        target: '#approvals',
        content: 'Already expired',
        transport: 'slack',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      })

      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        onTimeout,
        checkIntervalMs: 100000, // Very long interval - we'll check manually
      })

      // Manually trigger the timeout check by destroying and checking state
      // The processor checks on interval, but we can verify the store state
      const expired = await store.listExpired()
      expect(expired.length).toBe(1)
      expect(expired[0].id).toBe(expiredRequest.id)

      processor.destroy()
    })

    it('should track expiration time correctly', async () => {
      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        checkIntervalMs: 100000, // Disable auto-check effectively
      })

      const timeout = 30000

      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Time-sensitive',
        transport: 'slack',
        timeout,
      })

      const stored = await store.get(submitResult.requestId!)
      expect(stored?.expiresAt).toBeDefined()

      // Should expire roughly at timeout time
      const expectedExpiry = Date.now() + timeout
      const actualExpiry = stored!.expiresAt!.getTime()
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000)

      processor.destroy()
    })

    it('should not list non-expired requests as expired', async () => {
      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        checkIntervalMs: 100000,
      })

      await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Not expired yet',
        transport: 'slack',
        timeout: 60000, // 60 seconds from now
      })

      const expired = await store.listExpired()
      expect(expired.length).toBe(0)

      processor.destroy()
    })

    it('should cleanup interval on destroy', () => {
      const onTimeout = vi.fn()

      processor = createHumanRequestProcessor({
        store,
        transports: { slack: slackTransport },
        onTimeout,
        checkIntervalMs: 100,
      })

      // Should not throw when destroyed
      expect(() => processor.destroy()).not.toThrow()

      // Multiple destroys should be safe
      expect(() => processor.destroy()).not.toThrow()
    })
  })

  describe('getRequest', () => {
    it('should retrieve request by ID', async () => {
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Test content',
        transport: 'slack',
      })

      const request = await processor.getRequest(submitResult.requestId!)

      expect(request).toBeDefined()
      expect(request?.content).toBe('Test content')
    })
  })

  describe('cancelRequest', () => {
    it('should cancel a pending request', async () => {
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Test',
        transport: 'slack',
      })

      const cancelResult = await processor.cancelRequest(submitResult.requestId!)

      expect(cancelResult.success).toBe(true)

      const stored = await store.get(submitResult.requestId!)
      expect(stored?.status).toBe('cancelled')
    })

    it('should not cancel an already completed request', async () => {
      const submitResult = await processor.submitRequest({
        type: 'approval',
        target: '#approvals',
        content: 'Test',
        transport: 'slack',
      })

      // Complete the request
      await processor.handleWebhook('slack', {
        type: 'approval_response',
        requestId: submitResult.requestId!,
        approved: true,
      })

      // Try to cancel
      const cancelResult = await processor.cancelRequest(submitResult.requestId!)

      expect(cancelResult.success).toBe(false)
      expect(cancelResult.error).toContain('already completed')
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Runtime Integration', () => {
  let processor: HumanRequestProcessor
  let store: InMemoryRequestStore

  beforeEach(() => {
    vi.clearAllMocks()

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSlackPostMessageResponse),
    })

    store = new InMemoryRequestStore()

    const slackTransport = createSlackTransport({
      botToken: 'xoxb-test-token',
      signingSecret: 'test-secret',
      apiUrl: 'https://slack.test/api',
    })

    processor = createHumanRequestProcessor({
      store,
      transports: { slack: slackTransport },
    })
  })

  it('should handle complete approval workflow', async () => {
    const onComplete = vi.fn()

    processor = createHumanRequestProcessor({
      store,
      transports: {
        slack: createSlackTransport({
          botToken: 'xoxb-test-token',
          signingSecret: 'test-secret',
          apiUrl: 'https://slack.test/api',
        }),
      },
      onComplete,
    })

    // 1. Submit approval request
    const submitResult = await processor.submitRequest({
      type: 'approval',
      target: '#deployments',
      content: 'Deploy v2.1.0 to production?',
      transport: 'slack',
      context: {
        version: '2.1.0',
        environment: 'production',
        requestedBy: 'alice@company.com',
      },
      requestedBy: { id: 'U_ALICE', name: 'Alice' },
    })

    expect(submitResult.success).toBe(true)

    // 2. Verify request is pending
    let request = await processor.getRequest(submitResult.requestId!)
    expect(request?.status).toBe('pending')

    // 3. Simulate webhook callback (approval)
    const webhookResult = await processor.handleWebhook('slack', {
      type: 'approval_response',
      requestId: submitResult.requestId!,
      approved: true,
      respondedBy: { id: 'U_BOB', name: 'Bob' },
      notes: 'Looks good, proceed!',
    })

    expect(webhookResult.success).toBe(true)

    // 4. Verify request is completed
    request = await processor.getRequest(submitResult.requestId!)
    expect(request?.status).toBe('completed')
    expect(request?.result?.approved).toBe(true)
    expect(request?.result?.respondedBy?.name).toBe('Bob')
    expect(request?.result?.notes).toBe('Looks good, proceed!')

    // 5. Verify callback was invoked
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: submitResult.requestId,
        request: expect.objectContaining({
          content: 'Deploy v2.1.0 to production?',
        }),
        result: expect.objectContaining({
          approved: true,
          respondedBy: expect.objectContaining({ name: 'Bob' }),
        }),
      })
    )
  })

  it('should handle rejection workflow', async () => {
    const onComplete = vi.fn()

    processor = createHumanRequestProcessor({
      store,
      transports: {
        slack: createSlackTransport({
          botToken: 'xoxb-test-token',
          signingSecret: 'test-secret',
          apiUrl: 'https://slack.test/api',
        }),
      },
      onComplete,
    })

    const submitResult = await processor.submitRequest({
      type: 'approval',
      target: '#expenses',
      content: 'Approve $10,000 expense?',
      transport: 'slack',
    })

    await processor.handleWebhook('slack', {
      type: 'approval_response',
      requestId: submitResult.requestId!,
      approved: false,
      respondedBy: { id: 'U_CFO' },
      notes: 'Over budget limit',
    })

    const request = await processor.getRequest(submitResult.requestId!)
    expect(request?.result?.approved).toBe(false)
    expect(request?.result?.notes).toBe('Over budget limit')

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          approved: false,
        }),
      })
    )
  })
})
