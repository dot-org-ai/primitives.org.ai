/**
 * Service client for connecting to remote services
 */

import type {
  ServiceClient,
  ClientConfig,
  Order,
  Quote,
  Subscription,
  Notification,
  OKRDefinition,
  JSONSchema,
} from './types.js'

/**
 * Create a client to connect to a remote service
 *
 * @example
 * ```ts
 * const client = Client({
 *   url: 'https://api.example.com/translation',
 *   auth: {
 *     type: 'api-key',
 *     credentials: { apiKey: process.env.API_KEY },
 *   },
 * })
 *
 * const result = await client.do('translate', {
 *   text: 'Hello world',
 *   to: 'es',
 * })
 * ```
 */
export function Client(config: ClientConfig): ServiceClient {
  const baseUrl = config.url || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  }

  // Add auth headers
  if (config.auth) {
    switch (config.auth.type) {
      case 'api-key':
        headers['Authorization'] = `Bearer ${
          config.auth.credentials['apiKey'] || config.auth.credentials['token']
        }`
        break
      case 'basic':
        const basicAuth = Buffer.from(
          `${config.auth.credentials['username']}:${config.auth.credentials['password']}`
        ).toString('base64')
        headers['Authorization'] = `Basic ${basicAuth}`
        break
      case 'jwt':
        headers['Authorization'] = `Bearer ${config.auth.credentials['token']}`
        break
      // OAuth would require more complex flow
    }
  }

  /**
   * Make an HTTP request to the service
   */
  async function request<T>(endpoint: string, body?: unknown): Promise<T> {
    const url = `${baseUrl}/${endpoint.replace(/^\//, '')}`
    const bodyStr = body ? JSON.stringify(body) : undefined
    const signal = config.timeout ? AbortSignal.timeout(config.timeout) : undefined
    const response = await fetch(url, {
      method: 'POST',
      headers,
      ...(bodyStr !== undefined && { body: bodyStr }),
      ...(signal !== undefined && { signal }),
    })

    if (!response.ok) {
      throw new Error(`Service request failed: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  return {
    async ask(question: string, context?: unknown): Promise<string> {
      const result = await request<{ answer: string }>('ask', { question, context })
      return result.answer
    },

    async deliver(orderId: string, results: unknown): Promise<void> {
      await request('deliver', { orderId, results })
    },

    async do(action: string, input?: unknown): Promise<unknown> {
      return request('do', { action, input })
    },

    async generate(prompt: string, options?: unknown): Promise<unknown> {
      return request('generate', { prompt, options })
    },

    async is(value: unknown, type: string | JSONSchema): Promise<boolean> {
      const result = await request<{ result: boolean }>('is', { value, type })
      return result.result
    },

    async notify(notification: Notification): Promise<void> {
      await request('notify', notification)
    },

    async order<TProduct>(product: TProduct, quantity: number): Promise<Order<TProduct>> {
      return request('order', { product, quantity })
    },

    async quote<TProduct>(product: TProduct, quantity: number): Promise<Quote<TProduct>> {
      return request('quote', { product, quantity })
    },

    async subscribe(planId: string): Promise<Subscription> {
      return request('subscribe', { planId })
    },

    async entitlements(): Promise<string[]> {
      const result = await request<{ entitlements: string[] }>('entitlements', {})
      return result.entitlements
    },

    async kpis(): Promise<Record<string, number | string>> {
      return request('kpis', {})
    },

    async okrs(): Promise<OKRDefinition[]> {
      return request('okrs', {})
    },
  }
}
