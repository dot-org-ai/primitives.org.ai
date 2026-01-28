/**
 * Tests for llm.do WebSocket transport
 *
 * Covers:
 * - LLM class instantiation and configuration
 * - WebSocket connection management
 * - Message handling (universal.create/created/stream/done/error)
 * - Fetch adapter functionality
 * - Provider detection from URLs
 * - Streaming support
 * - Auto-reconnect behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  LLM,
  getLLM,
  createLLMFetch,
  type LLMConfig,
  type UniversalRequest,
  type UniversalCreated,
  type UniversalStream,
  type UniversalDone,
  type UniversalError,
} from '../src/llm.do.js'

// Polyfill CloseEvent for Node.js
class MockCloseEvent extends Event {
  constructor(type: string) {
    super(type)
  }
}

// Mock WebSocket for testing
class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  sentMessages: string[] = []
  url: string
  protocols: string | string[] | undefined

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new MockCloseEvent('close'))
    }
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen(new Event('open'))
    }
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new MockCloseEvent('close'))
    }
  }

  static reset(): void {
    MockWebSocket.instances = []
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
}

// Store original WebSocket
const OriginalWebSocket = globalThis.WebSocket

describe('LLM', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    // @ts-expect-error - Mocking WebSocket
    globalThis.WebSocket = MockWebSocket
  })

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket
  })

  describe('instantiation', () => {
    it('creates instance with required config', () => {
      const llm = new LLM({ token: 'test-token' })
      expect(llm).toBeDefined()
      expect(llm.config.token).toBe('test-token')
    })

    it('uses default URL when not specified', () => {
      const llm = new LLM({ token: 'test-token' })
      expect(llm.wsUrl).toBe('wss://llm.do/ws')
    })

    it('accepts custom URL', () => {
      const llm = new LLM({
        token: 'test-token',
        url: 'wss://custom.llm.do/ws',
      })
      expect(llm.wsUrl).toBe('wss://custom.llm.do/ws')
    })

    it('has default auto-reconnect settings', () => {
      const llm = new LLM({ token: 'test-token' })
      expect(llm.config.autoReconnect).toBe(true)
      expect(llm.config.maxReconnectAttempts).toBe(5)
      expect(llm.config.reconnectDelay).toBe(1000)
    })

    it('accepts custom reconnect settings', () => {
      const llm = new LLM({
        token: 'test-token',
        autoReconnect: false,
        maxReconnectAttempts: 10,
        reconnectDelay: 2000,
      })
      expect(llm.config.autoReconnect).toBe(false)
      expect(llm.config.maxReconnectAttempts).toBe(10)
      expect(llm.config.reconnectDelay).toBe(2000)
    })
  })

  describe('connection state', () => {
    it('starts disconnected', () => {
      const llm = new LLM({ token: 'test-token' })
      expect(llm.connectionState).toBe('disconnected')
      expect(llm.isConnected).toBe(false)
    })

    it('transitions to connecting when connect() called', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()

      expect(llm.connectionState).toBe('connecting')

      // Simulate successful connection
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()

      await connectPromise
      expect(llm.connectionState).toBe('connected')
      expect(llm.isConnected).toBe(true)
    })

    it('transitions to closed when close() called', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connectPromise

      llm.close()
      expect(llm.connectionState).toBe('closed')
      expect(llm.isConnected).toBe(false)
    })
  })

  describe('WebSocket authentication', () => {
    it('passes token via subprotocol header', async () => {
      const llm = new LLM({ token: 'my-secret-token' })
      llm.connect()

      const ws = MockWebSocket.getLastInstance()!
      expect(ws.protocols).toContain('cf-aig-authorization.my-secret-token')
    })
  })

  describe('connect()', () => {
    it('resolves when connection opens', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()

      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()

      await expect(connectPromise).resolves.toBeUndefined()
    })

    it('rejects on connection error', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()

      const ws = MockWebSocket.getLastInstance()!
      ws.simulateError()

      await expect(connectPromise).rejects.toThrow('WebSocket connection failed')
    })

    it('returns immediately if already connected', async () => {
      const llm = new LLM({ token: 'test-token' })

      // First connection
      const connect1 = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connect1

      // Second connect should resolve immediately
      const connect2 = llm.connect()
      await expect(connect2).resolves.toBeUndefined()

      // Should not create a new WebSocket
      expect(MockWebSocket.instances.length).toBe(1)
    })

    it('deduplicates concurrent connect() calls', async () => {
      const llm = new LLM({ token: 'test-token' })

      // Start multiple connections concurrently
      const connect1 = llm.connect()
      const connect2 = llm.connect()
      const connect3 = llm.connect()

      // Simulate open
      MockWebSocket.getLastInstance()!.simulateOpen()

      // All should resolve
      await Promise.all([connect1, connect2, connect3])

      // Should only create one WebSocket
      expect(MockWebSocket.instances.length).toBe(1)
    })
  })

  describe('fetch()', () => {
    it('sends universal.create message', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      // Start fetch (don't await yet)
      const fetchPromise = llm.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
      })

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      // Check sent message
      expect(ws.sentMessages.length).toBe(1)
      const sentMessage = JSON.parse(ws.sentMessages[0]!) as UniversalRequest
      expect(sentMessage.type).toBe('universal.create')
      expect(sentMessage.request.provider).toBe('openai')
      expect(sentMessage.request.endpoint).toBe('/v1/chat/completions')
      expect(sentMessage.request.query).toEqual({ model: 'gpt-4o', messages: [] })

      // Simulate response
      ws.simulateMessage({
        type: 'universal.created',
        eventId: sentMessage.request.eventId,
        response: { status: 200, body: { id: 'test' } },
      } satisfies UniversalCreated)

      const response = await fetchPromise
      expect(response.status).toBe(200)
    })

    it('auto-connects if not connected', async () => {
      const llm = new LLM({ token: 'test-token' })

      // Start fetch without connecting first
      const fetchPromise = llm.fetch('https://api.openai.com/v1/test', {
        method: 'GET',
      })

      // Simulate connection
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      // Simulate response
      const sentMessage = JSON.parse(ws.sentMessages[0]!) as UniversalRequest
      ws.simulateMessage({
        type: 'universal.created',
        eventId: sentMessage.request.eventId,
        response: { status: 200, body: {} },
      })

      const response = await fetchPromise
      expect(response.status).toBe(200)
    })

    it('returns Response object', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      const fetchPromise = llm.fetch('https://api.openai.com/v1/test')

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      const sentMessage = JSON.parse(ws.sentMessages[0]!) as UniversalRequest
      ws.simulateMessage({
        type: 'universal.created',
        eventId: sentMessage.request.eventId,
        response: { status: 200, body: { result: 'test' } },
      })

      const response = await fetchPromise
      expect(response).toBeInstanceOf(Response)

      const body = await response.json()
      expect(body).toEqual({ result: 'test' })
    })
  })

  describe('provider detection', () => {
    let llm: LLM
    let ws: MockWebSocket

    beforeEach(async () => {
      llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise
    })

    const testProvider = async (url: string, expectedProvider: string) => {
      llm.fetch(url)
      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))
      const sentMessage = JSON.parse(
        ws.sentMessages[ws.sentMessages.length - 1]!
      ) as UniversalRequest
      expect(sentMessage.request.provider).toBe(expectedProvider)
    }

    it('detects OpenAI', async () => {
      await testProvider('https://api.openai.com/v1/chat/completions', 'openai')
    })

    it('detects Anthropic', async () => {
      await testProvider('https://api.anthropic.com/v1/messages', 'anthropic')
    })

    it('detects Google AI Studio', async () => {
      await testProvider(
        'https://generativelanguage.googleapis.com/v1/models/gemini',
        'google-ai-studio'
      )
    })

    it('detects OpenRouter', async () => {
      await testProvider('https://openrouter.ai/api/v1/chat/completions', 'openrouter')
    })

    it('detects Cloudflare Workers AI', async () => {
      await testProvider(
        'https://api.cloudflare.com/client/v4/accounts/123/ai/run/model',
        'workers-ai'
      )
    })
  })

  describe('streaming', () => {
    it('returns streaming response for stream: true requests', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      const fetchPromise = llm.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4o', stream: true }),
      })

      const response = await fetchPromise
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.body).toBeDefined()
    })

    it('receives stream chunks via universal.stream', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      const fetchPromise = llm.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4o', stream: true }),
      })

      const response = await fetchPromise
      const reader = response.body!.getReader()

      // Get event ID from sent message
      const sentMessage = JSON.parse(ws.sentMessages[0]!) as UniversalRequest
      const eventId = sentMessage.request.eventId

      // Simulate stream chunks
      ws.simulateMessage({
        type: 'universal.stream',
        eventId,
        chunk: 'Hello',
      } satisfies UniversalStream)

      ws.simulateMessage({
        type: 'universal.stream',
        eventId,
        chunk: ' World',
      } satisfies UniversalStream)

      ws.simulateMessage({
        type: 'universal.done',
        eventId,
      } satisfies UniversalDone)

      // Read all chunks
      const chunks: string[] = []
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(decoder.decode(value))
      }

      expect(chunks.join('')).toBe('Hello World')
    })
  })

  describe('error handling', () => {
    it('handles universal.error message', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      const fetchPromise = llm.fetch('https://api.openai.com/v1/test')

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      const sentMessage = JSON.parse(ws.sentMessages[0]!) as UniversalRequest
      ws.simulateMessage({
        type: 'universal.error',
        eventId: sentMessage.request.eventId,
        error: { message: 'Rate limit exceeded', code: 'rate_limit' },
      } satisfies UniversalError)

      await expect(fetchPromise).rejects.toThrow('Rate limit exceeded')
    })

    it('rejects pending requests on disconnect', async () => {
      const llm = new LLM({ token: 'test-token', autoReconnect: false })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      const fetchPromise = llm.fetch('https://api.openai.com/v1/test')

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      // Disconnect before response
      ws.simulateClose()

      await expect(fetchPromise).rejects.toThrow('WebSocket disconnected')
    })

    it('rejects pending requests on close()', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      const ws = MockWebSocket.getLastInstance()!
      ws.simulateOpen()
      await connectPromise

      const fetchPromise = llm.fetch('https://api.openai.com/v1/test')

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      llm.close()

      await expect(fetchPromise).rejects.toThrow('Connection closed')
    })
  })

  describe('auto-reconnect', () => {
    it('attempts to reconnect after disconnect', async () => {
      vi.useFakeTimers()

      const llm = new LLM({
        token: 'test-token',
        autoReconnect: true,
        reconnectDelay: 1000,
        maxReconnectAttempts: 3,
      })

      const connectPromise = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connectPromise

      // Simulate disconnect
      MockWebSocket.getLastInstance()!.simulateClose()

      expect(llm.connectionState).toBe('disconnected')

      // Advance timer to trigger reconnect
      await vi.advanceTimersByTimeAsync(1000)

      // Should have created a new WebSocket
      expect(MockWebSocket.instances.length).toBe(2)

      vi.useRealTimers()
    })

    it('respects maxReconnectAttempts', async () => {
      vi.useFakeTimers()

      const llm = new LLM({
        token: 'test-token',
        autoReconnect: true,
        reconnectDelay: 100,
        maxReconnectAttempts: 2,
      })

      const connectPromise = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connectPromise

      // Simulate multiple disconnects
      for (let i = 0; i < 3; i++) {
        MockWebSocket.getLastInstance()!.simulateClose()
        await vi.advanceTimersByTimeAsync(100 * (i + 1))
      }

      // Should stop after maxReconnectAttempts
      // Initial + 2 reconnect attempts = 3 instances
      expect(MockWebSocket.instances.length).toBeLessThanOrEqual(3)

      vi.useRealTimers()
    })

    it('does not reconnect when autoReconnect is false', async () => {
      const llm = new LLM({
        token: 'test-token',
        autoReconnect: false,
      })

      const connectPromise = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connectPromise

      MockWebSocket.getLastInstance()!.simulateClose()

      // Should not create a new WebSocket
      expect(MockWebSocket.instances.length).toBe(1)
    })

    it('does not reconnect after explicit close()', async () => {
      vi.useFakeTimers()

      const llm = new LLM({
        token: 'test-token',
        autoReconnect: true,
        reconnectDelay: 100,
      })

      const connectPromise = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connectPromise

      // Explicit close
      llm.close()

      await vi.advanceTimersByTimeAsync(200)

      // Should not reconnect
      expect(MockWebSocket.instances.length).toBe(1)

      vi.useRealTimers()
    })
  })

  describe('createFetch()', () => {
    it('returns a bound fetch function', async () => {
      const llm = new LLM({ token: 'test-token' })
      const connectPromise = llm.connect()
      MockWebSocket.getLastInstance()!.simulateOpen()
      await connectPromise

      const customFetch = llm.createFetch()
      expect(typeof customFetch).toBe('function')

      const fetchPromise = customFetch('https://api.openai.com/v1/test')

      // Wait a tick for the message to be sent
      await new Promise((r) => setTimeout(r, 0))

      const ws = MockWebSocket.getLastInstance()!
      const sentMessage = JSON.parse(ws.sentMessages[0]!) as UniversalRequest
      ws.simulateMessage({
        type: 'universal.created',
        eventId: sentMessage.request.eventId,
        response: { status: 200, body: {} },
      })

      const response = await fetchPromise
      expect(response.status).toBe(200)
    })
  })
})

describe('getLLM', () => {
  const originalEnv = process.env

  beforeEach(async () => {
    // Reset modules to clear the singleton
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws if DO_TOKEN not set', async () => {
    delete process.env.DO_TOKEN

    // Re-import after resetting modules
    const { getLLM: freshGetLLM } = await import('../src/llm.do.js')
    expect(() => freshGetLLM()).toThrow('llm.do requires DO_TOKEN environment variable')
  })

  it('returns singleton instance', async () => {
    process.env.DO_TOKEN = 'test-token'

    const { getLLM: freshGetLLM } = await import('../src/llm.do.js')
    const llm1 = freshGetLLM()
    const llm2 = freshGetLLM()

    expect(llm1).toBe(llm2)
  })

  it('uses LLM_URL environment variable', async () => {
    process.env.DO_TOKEN = 'test-token'
    process.env.LLM_URL = 'wss://custom.llm.do/ws'

    const { getLLM: freshGetLLM } = await import('../src/llm.do.js')
    const llm = freshGetLLM()
    expect(llm.wsUrl).toBe('wss://custom.llm.do/ws')
  })

  it('creates new instance with explicit config', async () => {
    process.env.DO_TOKEN = 'env-token'

    const { getLLM: freshGetLLM } = await import('../src/llm.do.js')
    const llm = freshGetLLM({ token: 'explicit-token' })
    expect(llm.config.token).toBe('explicit-token')
  })
})

describe('createLLMFetch', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // @ts-expect-error - Mocking WebSocket
    globalThis.WebSocket = MockWebSocket
    MockWebSocket.reset()
  })

  afterEach(() => {
    process.env = originalEnv
    globalThis.WebSocket = OriginalWebSocket
  })

  it('returns a fetch function', () => {
    process.env.DO_TOKEN = 'test-token'

    const customFetch = createLLMFetch()
    expect(typeof customFetch).toBe('function')
  })

  it('accepts explicit config', () => {
    const customFetch = createLLMFetch({ token: 'my-token' })
    expect(typeof customFetch).toBe('function')
  })
})

describe('message types', () => {
  it('UniversalRequest has correct structure', () => {
    const request: UniversalRequest = {
      type: 'universal.create',
      request: {
        eventId: 'evt_123',
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json' },
        query: { model: 'gpt-4o' },
      },
    }
    expect(request.type).toBe('universal.create')
    expect(request.request.eventId).toBe('evt_123')
  })

  it('UniversalCreated has correct structure', () => {
    const created: UniversalCreated = {
      type: 'universal.created',
      eventId: 'evt_123',
      metadata: { cacheStatus: 'MISS', requestId: 'req_456' },
      response: { status: 200, body: { result: 'ok' } },
    }
    expect(created.type).toBe('universal.created')
    expect(created.response.status).toBe(200)
  })

  it('UniversalStream has correct structure', () => {
    const stream: UniversalStream = {
      type: 'universal.stream',
      eventId: 'evt_123',
      chunk: 'Hello',
    }
    expect(stream.type).toBe('universal.stream')
    expect(stream.chunk).toBe('Hello')
  })

  it('UniversalDone has correct structure', () => {
    const done: UniversalDone = {
      type: 'universal.done',
      eventId: 'evt_123',
      metadata: {
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      },
    }
    expect(done.type).toBe('universal.done')
    expect(done.metadata?.usage?.totalTokens).toBe(30)
  })

  it('UniversalError has correct structure', () => {
    const error: UniversalError = {
      type: 'universal.error',
      eventId: 'evt_123',
      error: { message: 'Something went wrong', code: 'internal_error' },
    }
    expect(error.type).toBe('universal.error')
    expect(error.error.message).toBe('Something went wrong')
  })
})
