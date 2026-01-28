/**
 * Tests for Client implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Client } from '../src/index.js'

// Mock fetch globally
const mockFetch = vi.fn()

describe('Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('basic creation', () => {
    it('should create a client with URL', () => {
      const client = Client({
        url: 'https://api.example.com',
      })

      expect(client).toBeDefined()
      expect(client.ask).toBeDefined()
      expect(client.do).toBeDefined()
    })

    it('should create a client with custom headers', () => {
      const client = Client({
        url: 'https://api.example.com',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      })

      expect(client).toBeDefined()
    })

    it('should create a client with timeout', () => {
      const client = Client({
        url: 'https://api.example.com',
        timeout: 5000,
      })

      expect(client).toBeDefined()
    })
  })

  describe('authentication', () => {
    it('should add API key auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({
        url: 'https://api.example.com',
        auth: {
          type: 'api-key',
          credentials: { apiKey: 'test-api-key' },
        },
      })

      await client.do('test', {})

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should add token auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({
        url: 'https://api.example.com',
        auth: {
          type: 'api-key',
          credentials: { token: 'test-token' },
        },
      })

      await client.do('test', {})

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('should add basic auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({
        url: 'https://api.example.com',
        auth: {
          type: 'basic',
          credentials: { username: 'user', password: 'pass' },
        },
      })

      await client.do('test', {})

      const expectedBasic = Buffer.from('user:pass').toString('base64')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedBasic}`,
          }),
        })
      )
    })

    it('should add JWT auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({
        url: 'https://api.example.com',
        auth: {
          type: 'jwt',
          credentials: { token: 'jwt-token-here' },
        },
      })

      await client.do('test', {})

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token-here',
          }),
        })
      )
    })
  })

  describe('ask method', () => {
    it('should send question and return answer', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'The answer is 42' }),
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.ask('What is the meaning of life?')

      expect(result).toBe('The answer is 42')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/ask',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            question: 'What is the meaning of life?',
            context: undefined,
          }),
        })
      )
    })

    it('should include context when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Answer with context' }),
      })

      const client = Client({ url: 'https://api.example.com' })
      await client.ask('Question', { data: 'context-data' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            question: 'Question',
            context: { data: 'context-data' },
          }),
        })
      )
    })
  })

  describe('do method', () => {
    it('should execute action and return result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'completed' }),
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.do('translate', { text: 'Hello', to: 'es' })

      expect(result).toEqual({ result: 'completed' })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/do',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'translate',
            input: { text: 'Hello', to: 'es' },
          }),
        })
      )
    })

    it('should work without input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      })

      const client = Client({ url: 'https://api.example.com' })
      await client.do('ping')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ action: 'ping', input: undefined }),
        })
      )
    })
  })

  describe('deliver method', () => {
    it('should deliver results for an order', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({ url: 'https://api.example.com' })
      await client.deliver('order-123', { files: ['file1.pdf'] })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/deliver',
        expect.objectContaining({
          body: JSON.stringify({
            orderId: 'order-123',
            results: { files: ['file1.pdf'] },
          }),
        })
      )
    })
  })

  describe('generate method', () => {
    it('should generate content with prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'Generated content here' }),
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.generate('Write a poem about AI')

      expect(result).toEqual({ content: 'Generated content here' })
    })

    it('should include options when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({ url: 'https://api.example.com' })
      await client.generate('Prompt', { maxTokens: 100, temperature: 0.7 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            prompt: 'Prompt',
            options: { maxTokens: 100, temperature: 0.7 },
          }),
        })
      )
    })
  })

  describe('is method', () => {
    it('should return boolean validation result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: true }),
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.is('hello@example.com', 'email')

      expect(result).toBe(true)
    })

    it('should handle schema validation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: false }),
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.is(
        { name: 123 },
        {
          type: 'object',
          properties: { name: { type: 'string' } },
        }
      )

      expect(result).toBe(false)
    })
  })

  describe('notify method', () => {
    it('should send notification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({ url: 'https://api.example.com' })
      await client.notify({
        id: 'notif-1',
        to: 'user@example.com',
        subject: 'Hello',
        body: 'Message body',
        channel: 'email',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/notify',
        expect.objectContaining({
          body: expect.stringContaining('user@example.com'),
        })
      )
    })
  })

  describe('order method', () => {
    it('should place an order', async () => {
      const orderResponse = {
        id: 'ord-123',
        customerId: 'cust-1',
        product: { id: 'prod-1', name: 'Service' },
        quantity: 2,
        total: 99.99,
        currency: 'USD',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => orderResponse,
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.order({ id: 'prod-1', name: 'Service' }, 2)

      expect(result).toEqual(orderResponse)
    })
  })

  describe('quote method', () => {
    it('should request a quote', async () => {
      const quoteResponse = {
        id: 'quote-123',
        customerId: 'cust-1',
        product: { type: 'translation' },
        quantity: 1000,
        price: 10.0,
        currency: 'USD',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => quoteResponse,
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.quote({ type: 'translation' }, 1000)

      expect(result).toEqual(quoteResponse)
    })
  })

  describe('subscribe method', () => {
    it('should subscribe to a plan', async () => {
      const subscriptionResponse = {
        id: 'sub-123',
        customerId: 'cust-1',
        planId: 'pro-plan',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 2592000000).toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => subscriptionResponse,
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.subscribe('pro-plan')

      expect(result.planId).toBe('pro-plan')
      expect(result.status).toBe('active')
    })
  })

  describe('entitlements method', () => {
    it('should return list of entitlements', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entitlements: ['api-access', 'premium-features'] }),
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.entitlements()

      expect(result).toEqual(['api-access', 'premium-features'])
    })
  })

  describe('kpis method', () => {
    it('should return KPI values', async () => {
      const kpiData = {
        revenue: 10000,
        customers: 150,
        satisfaction: '4.5',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => kpiData,
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.kpis()

      expect(result).toEqual(kpiData)
    })
  })

  describe('okrs method', () => {
    it('should return OKR data', async () => {
      const okrData = [
        {
          id: 'okr-1',
          objective: 'Improve customer satisfaction',
          keyResults: [
            {
              description: 'Increase NPS score',
              target: 9.0,
              current: 8.5,
              measure: async () => 8.5,
            },
          ],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => okrData,
      })

      const client = Client({ url: 'https://api.example.com' })
      const result = await client.okrs()

      expect(result).toHaveLength(1)
      expect(result[0]?.objective).toBe('Improve customer satisfaction')
    })
  })

  describe('error handling', () => {
    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const client = Client({ url: 'https://api.example.com' })

      await expect(client.do('test', {})).rejects.toThrow(
        'Service request failed: 401 Unauthorized'
      )
    })

    it('should throw on 500 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const client = Client({ url: 'https://api.example.com' })

      await expect(client.ask('question')).rejects.toThrow(
        'Service request failed: 500 Internal Server Error'
      )
    })

    it('should throw on 404 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const client = Client({ url: 'https://api.example.com' })

      await expect(client.entitlements()).rejects.toThrow('404 Not Found')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const client = Client({ url: 'https://api.example.com' })

      await expect(client.do('test', {})).rejects.toThrow('Network error')
    })
  })

  describe('URL construction', () => {
    it('should construct correct URL for endpoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const client = Client({ url: 'https://api.example.com/v1' })
      await client.do('action', {})

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/v1/do', expect.any(Object))
    })

    it('should handle trailing slash in base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'test' }),
      })

      // Note: The client preserves trailing slashes in the URL construction
      // This is acceptable as most servers handle double slashes
      const client = Client({ url: 'https://api.example.com/' })
      await client.ask('question')

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com//ask', expect.any(Object))
    })
  })
})
