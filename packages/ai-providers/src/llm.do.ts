/**
 * llm.do - Universal LLM Gateway WebSocket Transport
 *
 * Provides a persistent WebSocket connection to llm.do gateway
 * that replaces repeated fetch calls with multiplexed requests.
 *
 * Benefits:
 * - Persistent connection (no repeated handshakes)
 * - Lower latency for multiple requests
 * - Unified authentication across all providers
 * - Automatic provider routing
 *
 * @packageDocumentation
 */

/**
 * WebSocket message types (Cloudflare AI Gateway protocol)
 */
export interface UniversalRequest {
  type: 'universal.create'
  request: {
    eventId: string
    provider: string
    endpoint: string
    headers?: Record<string, string>
    query?: Record<string, unknown>
  }
}

export interface UniversalCreated {
  type: 'universal.created'
  eventId: string
  metadata?: {
    cacheStatus?: string
    requestId?: string
  }
  response: {
    status: number
    headers?: Record<string, string>
    body: unknown
  }
}

export interface UniversalStream {
  type: 'universal.stream'
  eventId: string
  chunk: string | unknown
}

export interface UniversalDone {
  type: 'universal.done'
  eventId: string
  metadata?: {
    cacheStatus?: string
    requestId?: string
    usage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
    }
  }
}

export interface UniversalError {
  type: 'universal.error'
  eventId: string
  error: {
    message: string
    code?: string
  }
}

export type GatewayMessage = UniversalCreated | UniversalStream | UniversalDone | UniversalError

/**
 * Pending request with promise resolvers
 */
interface PendingRequest {
  resolve: (response: Response) => void
  reject: (error: Error) => void
  streaming: boolean
  chunks: string[]
  controller?: ReadableStreamDefaultController<Uint8Array>
}

/**
 * Connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closed'

/**
 * llm.do configuration
 */
export interface LLMConfig {
  /** llm.do WebSocket URL (default: wss://llm.do/ws) */
  url: string
  /** Authentication token (DO_TOKEN) */
  token: string
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean | undefined
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number | undefined
  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number | undefined
}

/**
 * llm.do WebSocket client
 *
 * Maintains a persistent WebSocket connection and provides a fetch-compatible
 * interface that routes requests through llm.do gateway.
 *
 * @example
 * ```ts
 * const llm = new LLM({ token: process.env.DO_TOKEN })
 *
 * await llm.connect()
 *
 * // Use as fetch replacement
 * const response = await llm.fetch('https://api.openai.com/v1/chat/completions', {
 *   method: 'POST',
 *   body: JSON.stringify({ ... })
 * })
 * ```
 */
export class LLM {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private pendingRequests = new Map<string, PendingRequest>()
  private connectPromise: Promise<void> | null = null
  private reconnectAttempts = 0
  private eventIdCounter = 0

  readonly config: Required<
    Omit<LLMConfig, 'autoReconnect' | 'maxReconnectAttempts' | 'reconnectDelay'>
  > & { autoReconnect: boolean; maxReconnectAttempts: number; reconnectDelay: number }

  constructor(config: LLMConfig) {
    this.config = {
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      url: config.url,
      token: config.token,
    }
  }

  /**
   * Get the WebSocket URL
   */
  get wsUrl(): string {
    return this.config.url
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Connect to llm.do
   */
  async connect(): Promise<void> {
    if (this.state === 'connected') return
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = this.doConnect()
    try {
      await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.state = 'connecting'

      // Create WebSocket with auth in subprotocol header (browser-compatible)
      const ws = new WebSocket(this.wsUrl, [`cf-aig-authorization.${this.config.token}`])

      ws.addEventListener('open', () => {
        this.ws = ws
        this.state = 'connected'
        this.reconnectAttempts = 0
        resolve()
      })

      ws.addEventListener('error', () => {
        const error = new Error('WebSocket connection failed')
        if (this.state === 'connecting') {
          reject(error)
        }
      })

      ws.addEventListener('close', () => {
        this.handleDisconnect()
      })

      ws.addEventListener('message', (event) => {
        this.handleMessage(event.data as string)
      })
    })
  }

  private handleDisconnect(): void {
    // Don't handle if already closed (explicit close() call)
    if (this.state === 'closed') {
      return
    }

    const wasConnected = this.state === 'connected'
    this.state = 'disconnected'
    this.ws = null

    // Reject all pending requests
    for (const [eventId, request] of this.pendingRequests) {
      request.reject(new Error('WebSocket disconnected'))
    }
    this.pendingRequests.clear()

    // Auto-reconnect if enabled
    if (
      wasConnected &&
      this.config.autoReconnect &&
      this.reconnectAttempts < this.config.maxReconnectAttempts
    ) {
      this.reconnectAttempts++
      const delay = this.config.reconnectDelay * this.reconnectAttempts
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnect failed, will retry
        })
      }, delay)
    }
  }

  private handleMessage(data: string): void {
    let message: GatewayMessage
    try {
      message = JSON.parse(data)
    } catch {
      console.error('Failed to parse gateway message:', data)
      return
    }

    const pending = this.pendingRequests.get(message.eventId)
    if (!pending) {
      // Orphaned message - request may have timed out
      return
    }

    switch (message.type) {
      case 'universal.created':
        if (!pending.streaming) {
          // Non-streaming: complete immediately with full response
          this.pendingRequests.delete(message.eventId)
          const response = new Response(JSON.stringify(message.response.body), {
            status: message.response.status,
            ...(message.response.headers && { headers: message.response.headers }),
          })
          pending.resolve(response)
        }
        break

      case 'universal.stream':
        if (pending.streaming && pending.controller) {
          // Streaming: push chunk to the stream
          const chunk =
            typeof message.chunk === 'string' ? message.chunk : JSON.stringify(message.chunk)
          pending.controller.enqueue(new TextEncoder().encode(chunk))
        } else {
          // Collect chunks for non-streaming mode
          pending.chunks.push(
            typeof message.chunk === 'string' ? message.chunk : JSON.stringify(message.chunk)
          )
        }
        break

      case 'universal.done':
        this.pendingRequests.delete(message.eventId)
        if (pending.streaming && pending.controller) {
          // Close the stream
          pending.controller.close()
        } else {
          // Complete with collected chunks
          const body = pending.chunks.join('')
          pending.resolve(new Response(body, { status: 200 }))
        }
        break

      case 'universal.error':
        this.pendingRequests.delete(message.eventId)
        if (pending.streaming && pending.controller) {
          pending.controller.error(new Error(message.error.message))
        }
        pending.reject(new Error(message.error.message))
        break
    }
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventIdCounter}`
  }

  /**
   * Detect provider from URL
   */
  private detectProvider(url: string): string {
    const urlObj = new URL(url)
    const host = urlObj.hostname.toLowerCase()

    if (host.includes('openai.com')) return 'openai'
    if (host.includes('anthropic.com')) return 'anthropic'
    if (host.includes('generativelanguage.googleapis.com')) return 'google-ai-studio'
    if (host.includes('openrouter.ai')) return 'openrouter'
    if (host.includes('cloudflare.com')) return 'workers-ai'

    // Default to the host as provider
    return host.split('.')[0] || 'unknown'
  }

  /**
   * Extract endpoint path from URL
   */
  private extractEndpoint(url: string): string {
    const urlObj = new URL(url)
    return urlObj.pathname + urlObj.search
  }

  /**
   * Fetch-compatible interface that routes through llm.do
   *
   * @example
   * ```ts
   * const response = await llm.fetch('https://api.openai.com/v1/chat/completions', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({
   *     model: 'gpt-4o',
   *     messages: [{ role: 'user', content: 'Hello!' }]
   *   })
   * })
   * ```
   */
  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    // Ensure connected
    await this.connect()

    if (!this.isConnected) {
      throw new Error('Not connected to llm.do')
    }

    const urlString = url.toString()
    const eventId = this.generateEventId()
    const provider = this.detectProvider(urlString)
    const endpoint = this.extractEndpoint(urlString)

    // Parse headers
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const h = init.headers
      if (h instanceof Headers) {
        h.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(h)) {
        for (const entry of h) {
          if (entry[0] && entry[1]) {
            headers[entry[0]] = entry[1]
          }
        }
      } else {
        Object.assign(headers, h)
      }
    }

    // Parse body as query payload
    let query: Record<string, unknown> = {}
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          query = JSON.parse(init.body)
        } catch {
          query = { body: init.body }
        }
      } else if (init.body instanceof FormData) {
        // Convert FormData to object
        init.body.forEach((value, key) => {
          query[key] = value
        })
      }
    }

    // Check if this is a streaming request
    const isStreaming = query['stream'] === true

    // Create the WebSocket message
    const message: UniversalRequest = {
      type: 'universal.create',
      request: {
        eventId,
        provider,
        endpoint,
        headers,
        query,
      },
    }

    return new Promise((resolve, reject) => {
      if (isStreaming) {
        // Create a readable stream for streaming responses
        let controller: ReadableStreamDefaultController<Uint8Array>
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            controller = c
          },
        })

        this.pendingRequests.set(eventId, {
          resolve: () => {}, // Not used for streaming
          reject,
          streaming: true,
          chunks: [],
          controller: controller!,
        })

        // Return the streaming response immediately
        resolve(
          new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        )
      } else {
        this.pendingRequests.set(eventId, {
          resolve,
          reject,
          streaming: false,
          chunks: [],
        })
      }

      // Send the request
      this.ws!.send(JSON.stringify(message))
    })
  }

  /**
   * Create a fetch function bound to this connection
   *
   * Returns a function that can be used as a drop-in replacement for fetch
   * in AI SDK provider configurations.
   */
  createFetch(): typeof fetch {
    return this.fetch.bind(this) as typeof fetch
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.state = 'closed'
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Reject all pending requests
    for (const [eventId, request] of this.pendingRequests) {
      request.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()
  }
}

// Singleton instance management
let defaultLLM: LLM | null = null

/**
 * Get or create the default llm.do connection
 *
 * Uses environment variables for configuration:
 * - LLM_URL: WebSocket URL (default: wss://llm.do/ws)
 * - DO_TOKEN: Authentication token
 *
 * @example
 * ```ts
 * const llm = getLLM()
 * await llm.connect()
 * const response = await llm.fetch(url, options)
 * ```
 */
export function getLLM(config?: LLMConfig): LLM {
  if (config) {
    return new LLM(config)
  }

  if (defaultLLM) {
    return defaultLLM
  }

  // Get config from environment
  const url = process.env['LLM_URL'] || 'wss://llm.do/ws'
  const token = process.env['DO_TOKEN']

  if (!token) {
    throw new Error('llm.do requires DO_TOKEN environment variable')
  }

  defaultLLM = new LLM({ url, token })
  return defaultLLM
}

/**
 * Create a fetch function that uses llm.do WebSocket
 *
 * Drop-in replacement for the custom fetch in provider configuration.
 * Automatically connects on first use.
 *
 * @example
 * ```ts
 * import { createOpenAI } from '@ai-sdk/openai'
 * import { createLLMFetch } from 'ai-providers'
 *
 * const openai = createOpenAI({
 *   apiKey: 'llm.do', // Placeholder - llm.do handles auth
 *   baseURL: 'https://api.openai.com/v1',
 *   fetch: createLLMFetch()
 * })
 * ```
 */
export function createLLMFetch(config?: LLMConfig): typeof fetch {
  const llm = config ? new LLM(config) : getLLM()
  return llm.createFetch()
}
