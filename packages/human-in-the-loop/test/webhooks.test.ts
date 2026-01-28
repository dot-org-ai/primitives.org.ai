/**
 * Tests for event-driven human response webhooks
 *
 * TDD: RED Phase - These tests are written first, before implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Human } from '../src/human.js'
import { InMemoryHumanStore } from '../src/store.js'
import {
  WebhookRegistry,
  createWebhookRegistry,
  signPayload,
  verifySignature,
  type WebhookConfig,
  type WebhookEvent,
  type WebhookEventType,
  type DeliveryResult,
} from '../src/webhooks.js'

describe('Event-driven Human Response Webhooks', () => {
  let registry: WebhookRegistry
  let store: InMemoryHumanStore
  let human: ReturnType<typeof Human>

  beforeEach(() => {
    vi.useFakeTimers()
    registry = createWebhookRegistry()
    store = new InMemoryHumanStore()
    human = Human({ store })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Webhook Registration', () => {
    it('should register a webhook with URL, events, and secret', () => {
      const config: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created', 'request.completed'],
        secret: 'my-secret-key',
        enabled: true,
      }

      const registered = registry.register(config)

      expect(registered.id).toBe('wh_123')
      expect(registered.url).toBe('https://example.com/webhook')
      expect(registered.events).toContain('request.created')
      expect(registered.events).toContain('request.completed')
      expect(registered.secret).toBe('my-secret-key')
      expect(registered.enabled).toBe(true)
    })

    it('should generate an ID if not provided', () => {
      const config: Omit<WebhookConfig, 'id'> = {
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      }

      const registered = registry.register(config)

      expect(registered.id).toBeDefined()
      expect(registered.id).toMatch(/^wh_/)
    })

    it('should validate webhook URL format', () => {
      expect(() => {
        registry.register({
          url: 'not-a-valid-url',
          events: ['request.created'],
          secret: 'secret',
          enabled: true,
        })
      }).toThrow(/invalid.*url/i)
    })

    it('should require at least one event type', () => {
      expect(() => {
        registry.register({
          url: 'https://example.com/webhook',
          events: [],
          secret: 'secret',
          enabled: true,
        })
      }).toThrow(/at least one event/i)
    })

    it('should retrieve a registered webhook by ID', () => {
      const config: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      }

      registry.register(config)
      const retrieved = registry.get('wh_123')

      expect(retrieved).toBeDefined()
      expect(retrieved?.url).toBe('https://example.com/webhook')
    })

    it('should return undefined for non-existent webhook', () => {
      const retrieved = registry.get('non-existent')
      expect(retrieved).toBeUndefined()
    })

    it('should list all registered webhooks', () => {
      registry.register({
        id: 'wh_1',
        url: 'https://example.com/webhook1',
        events: ['request.created'],
        secret: 'secret1',
        enabled: true,
      })
      registry.register({
        id: 'wh_2',
        url: 'https://example.com/webhook2',
        events: ['request.completed'],
        secret: 'secret2',
        enabled: false,
      })

      const webhooks = registry.list()

      expect(webhooks).toHaveLength(2)
      expect(webhooks.map((w) => w.id)).toContain('wh_1')
      expect(webhooks.map((w) => w.id)).toContain('wh_2')
    })

    it('should unregister a webhook', () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const removed = registry.unregister('wh_123')

      expect(removed).toBe(true)
      expect(registry.get('wh_123')).toBeUndefined()
    })

    it('should return false when unregistering non-existent webhook', () => {
      const removed = registry.unregister('non-existent')
      expect(removed).toBe(false)
    })

    it('should enable/disable a webhook', () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      registry.disable('wh_123')
      expect(registry.get('wh_123')?.enabled).toBe(false)

      registry.enable('wh_123')
      expect(registry.get('wh_123')?.enabled).toBe(true)
    })

    it('should support multiple webhooks for same event type', () => {
      registry.register({
        id: 'wh_1',
        url: 'https://example1.com/webhook',
        events: ['request.completed'],
        secret: 'secret1',
        enabled: true,
      })
      registry.register({
        id: 'wh_2',
        url: 'https://example2.com/webhook',
        events: ['request.completed'],
        secret: 'secret2',
        enabled: true,
      })

      const webhooks = registry.getByEvent('request.completed')

      expect(webhooks).toHaveLength(2)
    })

    it('should only return enabled webhooks for event', () => {
      registry.register({
        id: 'wh_1',
        url: 'https://example1.com/webhook',
        events: ['request.completed'],
        secret: 'secret1',
        enabled: true,
      })
      registry.register({
        id: 'wh_2',
        url: 'https://example2.com/webhook',
        events: ['request.completed'],
        secret: 'secret2',
        enabled: false,
      })

      const webhooks = registry.getByEvent('request.completed')

      expect(webhooks).toHaveLength(1)
      expect(webhooks[0]?.id).toBe('wh_1')
    })
  })

  describe('Webhook Event Payload', () => {
    it('should construct event payload with required fields', () => {
      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        data: {
          requestId: 'req_456',
          type: 'approval',
          status: 'pending',
          title: 'Test Request',
        },
      }

      expect(event.id).toBe('evt_123')
      expect(event.type).toBe('request.created')
      expect(event.timestamp).toEqual(new Date('2024-01-01T00:00:00Z'))
      expect(event.data.requestId).toBe('req_456')
    })

    it('should include optional metadata in payload', () => {
      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.completed',
        timestamp: new Date(),
        data: {
          requestId: 'req_456',
          type: 'approval',
          status: 'completed',
          title: 'Test',
          response: { approved: true },
        },
        metadata: {
          version: '1.0',
          source: 'human-in-the-loop',
        },
      }

      expect(event.metadata?.version).toBe('1.0')
      expect(event.metadata?.source).toBe('human-in-the-loop')
    })
  })

  describe('Webhook Signature', () => {
    it('should sign payload with HMAC-SHA256', () => {
      const payload = { data: 'test' }
      const secret = 'my-secret-key'
      const timestamp = Date.now()

      const signature = signPayload(payload, secret, timestamp)

      expect(signature).toBeDefined()
      expect(signature).toMatch(/^sha256=/)
    })

    it('should produce different signatures for different payloads', () => {
      const secret = 'my-secret-key'
      const timestamp = Date.now()

      const sig1 = signPayload({ data: 'test1' }, secret, timestamp)
      const sig2 = signPayload({ data: 'test2' }, secret, timestamp)

      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different secrets', () => {
      const payload = { data: 'test' }
      const timestamp = Date.now()

      const sig1 = signPayload(payload, 'secret1', timestamp)
      const sig2 = signPayload(payload, 'secret2', timestamp)

      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different timestamps', () => {
      const payload = { data: 'test' }
      const secret = 'my-secret-key'

      const sig1 = signPayload(payload, secret, 1000)
      const sig2 = signPayload(payload, secret, 2000)

      expect(sig1).not.toBe(sig2)
    })

    it('should verify valid signature', () => {
      const payload = { data: 'test' }
      const secret = 'my-secret-key'
      const timestamp = Date.now()

      const signature = signPayload(payload, secret, timestamp)
      const isValid = verifySignature(payload, secret, timestamp, signature)

      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = { data: 'test' }
      const secret = 'my-secret-key'
      const timestamp = Date.now()

      const isValid = verifySignature(payload, secret, timestamp, 'sha256=invalid')

      expect(isValid).toBe(false)
    })

    it('should reject signature with wrong secret', () => {
      const payload = { data: 'test' }
      const timestamp = Date.now()

      const signature = signPayload(payload, 'correct-secret', timestamp)
      const isValid = verifySignature(payload, 'wrong-secret', timestamp, signature)

      expect(isValid).toBe(false)
    })
  })

  describe('Webhook Delivery', () => {
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should deliver webhook with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      })

      const config: WebhookConfig = {
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'my-secret',
        enabled: true,
      }

      registry.register(config)

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const result = await registry.deliver('wh_123', event)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-ID': 'wh_123',
            'X-Event-Type': 'request.created',
            'X-Event-ID': 'evt_123',
          }),
        })
      )
    })

    it('should include signature header', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'my-secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      await registry.deliver('wh_123', event)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Signature': expect.stringMatching(/^sha256=/),
            'X-Timestamp': expect.any(String),
          }),
        })
      )
    })

    it('should return success for 2xx responses', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const result = await registry.deliver('wh_123', event)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
    })

    it('should return failure for non-2xx responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const result = await registry.deliver('wh_123', event)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.error).toContain('Internal Server Error')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const result = await registry.deliver('wh_123', event)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })

    it('should retry on failure with exponential backoff', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 })

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const resultPromise = registry.deliverWithRetry('wh_123', event, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
      })

      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(100) // First retry delay
      await vi.advanceTimersByTimeAsync(200) // Second retry delay (exponential)

      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(3)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should fail after max retries exceeded', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const resultPromise = registry.deliverWithRetry('wh_123', event, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
      })

      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)
      await vi.advanceTimersByTimeAsync(400)

      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(4) // Initial + 3 retries
      expect(result.error).toContain('Max retries exceeded')
    })

    it('should not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' })

      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      const result = await registry.deliverWithRetry('wh_123', event, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
      })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1) // No retries for 4xx
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Real-time Status Updates via Webhook', () => {
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      vi.stubGlobal('fetch', mockFetch)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should emit webhook on request creation', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      // Create a request that triggers webhook
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test Approval',
        description: 'Test',
        subject: 'Test',
        input: { data: 'test' },
        priority: 'normal' as const,
      })

      // Emit the event
      await registry.emit('request.created', {
        requestId: request.id,
        type: request.type,
        status: request.status,
        title: request.title,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          body: expect.stringContaining(request.id),
        })
      )
    })

    it('should emit webhook on status change to in_progress', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.in_progress'],
        secret: 'secret',
        enabled: true,
      })

      await registry.emit('request.in_progress', {
        requestId: 'req_123',
        type: 'approval',
        status: 'in_progress',
        title: 'Test',
        assignee: 'alice@example.com',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('request.in_progress')
      expect(body.data.status).toBe('in_progress')
    })

    it('should emit webhook on request completion', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.completed'],
        secret: 'secret',
        enabled: true,
      })

      await registry.emit('request.completed', {
        requestId: 'req_123',
        type: 'approval',
        status: 'completed',
        title: 'Test',
        response: { approved: true, comments: 'Looks good!' },
        respondedBy: 'alice@example.com',
        completedAt: new Date().toISOString(),
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('request.completed')
      expect(body.data.response.approved).toBe(true)
    })

    it('should emit webhook on request rejection', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.rejected'],
        secret: 'secret',
        enabled: true,
      })

      await registry.emit('request.rejected', {
        requestId: 'req_123',
        type: 'approval',
        status: 'rejected',
        title: 'Test',
        rejectionReason: 'Not approved at this time',
        respondedBy: 'alice@example.com',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('request.rejected')
      expect(body.data.rejectionReason).toBe('Not approved at this time')
    })

    it('should emit webhook on request escalation', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.escalated'],
        secret: 'secret',
        enabled: true,
      })

      await registry.emit('request.escalated', {
        requestId: 'req_123',
        type: 'approval',
        status: 'escalated',
        title: 'Test',
        previousAssignee: 'alice@example.com',
        newAssignee: 'manager@example.com',
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('request.escalated')
      expect(body.data.newAssignee).toBe('manager@example.com')
    })

    it('should emit webhook on request timeout', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.timeout'],
        secret: 'secret',
        enabled: true,
      })

      await registry.emit('request.timeout', {
        requestId: 'req_123',
        type: 'approval',
        status: 'timeout',
        title: 'Test',
        timeoutMs: 3600000,
      })

      expect(mockFetch).toHaveBeenCalled()
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('request.timeout')
    })

    it('should emit to multiple webhooks subscribed to same event', async () => {
      registry.register({
        id: 'wh_1',
        url: 'https://example1.com/webhook',
        events: ['request.completed'],
        secret: 'secret1',
        enabled: true,
      })
      registry.register({
        id: 'wh_2',
        url: 'https://example2.com/webhook',
        events: ['request.completed'],
        secret: 'secret2',
        enabled: true,
      })

      await registry.emit('request.completed', {
        requestId: 'req_123',
        type: 'approval',
        status: 'completed',
        title: 'Test',
        response: { approved: true },
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not emit to webhooks not subscribed to event', async () => {
      registry.register({
        id: 'wh_1',
        url: 'https://example1.com/webhook',
        events: ['request.created'],
        secret: 'secret1',
        enabled: true,
      })
      registry.register({
        id: 'wh_2',
        url: 'https://example2.com/webhook',
        events: ['request.completed'],
        secret: 'secret2',
        enabled: true,
      })

      await registry.emit('request.completed', {
        requestId: 'req_123',
        type: 'approval',
        status: 'completed',
        title: 'Test',
        response: { approved: true },
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('https://example2.com/webhook', expect.anything())
    })
  })

  describe('Webhook Batching (Refactor Phase)', () => {
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      vi.stubGlobal('fetch', mockFetch)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should batch multiple events within time window', async () => {
      const batchingRegistry = createWebhookRegistry({ batchingEnabled: true, batchWindowMs: 100 })

      batchingRegistry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      // Emit multiple events rapidly
      await batchingRegistry.emit('request.created', {
        requestId: 'req_1',
        type: 'approval',
        status: 'pending',
        title: 'Test 1',
      })
      await batchingRegistry.emit('request.created', {
        requestId: 'req_2',
        type: 'approval',
        status: 'pending',
        title: 'Test 2',
      })
      await batchingRegistry.emit('request.created', {
        requestId: 'req_3',
        type: 'approval',
        status: 'pending',
        title: 'Test 3',
      })

      // Before window expires, no fetch should occur
      expect(mockFetch).not.toHaveBeenCalled()

      // After window expires, batch should be sent
      await vi.advanceTimersByTimeAsync(100)
      await batchingRegistry.flush()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.events).toHaveLength(3)
    })

    it('should flush immediately when max batch size reached', async () => {
      const batchingRegistry = createWebhookRegistry({
        batchingEnabled: true,
        batchWindowMs: 1000,
        maxBatchSize: 2,
      })

      batchingRegistry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      await batchingRegistry.emit('request.created', {
        requestId: 'req_1',
        type: 'approval',
        status: 'pending',
        title: 'Test 1',
      })
      await batchingRegistry.emit('request.created', {
        requestId: 'req_2',
        type: 'approval',
        status: 'pending',
        title: 'Test 2',
      })

      // Should flush immediately when max size reached
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.events).toHaveLength(2)
    })
  })

  describe('Dead Letter Queue (Refactor Phase)', () => {
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', mockFetch)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should add failed deliveries to dead letter queue', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      // Deliver with retry exhausted
      const resultPromise = registry.deliverWithRetry('wh_123', event, {
        maxRetries: 1,
        initialDelayMs: 10,
        maxDelayMs: 100,
      })

      await vi.advanceTimersByTimeAsync(10)
      await resultPromise

      const dlq = registry.getDeadLetterQueue()
      expect(dlq).toHaveLength(1)
      expect(dlq[0]?.event.id).toBe('evt_123')
      expect(dlq[0]?.webhookId).toBe('wh_123')
    })

    it('should retry dead letter queue items', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      // First delivery fails
      await registry.deliverWithRetry('wh_123', event, {
        maxRetries: 0,
        initialDelayMs: 10,
        maxDelayMs: 100,
      })

      expect(registry.getDeadLetterQueue()).toHaveLength(1)

      // Now make fetch succeed
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      // Retry DLQ
      const results = await registry.retryDeadLetterQueue()

      expect(results).toHaveLength(1)
      expect(results[0]?.success).toBe(true)
      expect(registry.getDeadLetterQueue()).toHaveLength(0)
    })

    it('should limit dead letter queue size', async () => {
      const limitedRegistry = createWebhookRegistry({ maxDeadLetterQueueSize: 2 })

      limitedRegistry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      // Add 3 items to DLQ
      for (let i = 0; i < 3; i++) {
        const event: WebhookEvent = {
          id: `evt_${i}`,
          type: 'request.created',
          timestamp: new Date(),
          data: { requestId: `req_${i}`, type: 'approval', status: 'pending', title: 'Test' },
        }

        await limitedRegistry.deliverWithRetry('wh_123', event, {
          maxRetries: 0,
          initialDelayMs: 10,
          maxDelayMs: 100,
        })
      }

      const dlq = limitedRegistry.getDeadLetterQueue()
      expect(dlq).toHaveLength(2)
      // Should keep most recent items
      expect(dlq[0]?.event.id).toBe('evt_1')
      expect(dlq[1]?.event.id).toBe('evt_2')
    })

    it('should clear dead letter queue', async () => {
      registry.register({
        id: 'wh_123',
        url: 'https://example.com/webhook',
        events: ['request.created'],
        secret: 'secret',
        enabled: true,
      })

      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'request.created',
        timestamp: new Date(),
        data: { requestId: 'req_456', type: 'approval', status: 'pending', title: 'Test' },
      }

      await registry.deliverWithRetry('wh_123', event, {
        maxRetries: 0,
        initialDelayMs: 10,
        maxDelayMs: 100,
      })

      expect(registry.getDeadLetterQueue()).toHaveLength(1)

      registry.clearDeadLetterQueue()

      expect(registry.getDeadLetterQueue()).toHaveLength(0)
    })
  })
})
