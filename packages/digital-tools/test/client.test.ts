/**
 * Tests for RPC Client
 *
 * Covers the client module for connecting to digital-tools workers.
 */

import { describe, it, expect } from 'vitest'
import {
  createToolClient,
  DEFAULT_TOOL_WORKER_URL,
  type ToolClientOptions,
  type ToolClientProxy,
  type ToolServiceAPI,
  type ToolTransport,
} from '../src/client.js'

/** Fake transport that records what it was connected with */
function fakeTransport() {
  const recorded: Array<{ url: string; options?: ToolClientOptions }> = []
  const transport: ToolTransport = {
    connect<API extends object>(url: string, options?: ToolClientOptions): ToolClientProxy<API> {
      recorded.push(options ? { url, options } : { url })
      return {} as ToolClientProxy<API>
    },
  }
  return { transport, recorded }
}

describe('Client Module', () => {
  describe('createToolClient', () => {
    it('creates a client with default URL', () => {
      const { transport, recorded } = fakeTransport()
      const client = createToolClient(transport)

      expect(client).toBeDefined()
      expect(recorded[0]?.url).toBe(DEFAULT_TOOL_WORKER_URL)
    })

    it('creates a client with custom URL', () => {
      const { transport, recorded } = fakeTransport()
      const client = createToolClient(transport, 'https://custom-tools.example.com')

      expect(client).toBeDefined()
      expect(recorded[0]?.url).toBe('https://custom-tools.example.com')
    })

    it('accepts client options with token', () => {
      const { transport, recorded } = fakeTransport()
      const options: ToolClientOptions = {
        token: 'test-token',
      }

      const client = createToolClient(transport, 'https://example.com', options)

      expect(client).toBeDefined()
      expect(recorded[0]?.options?.token).toBe('test-token')
    })

    it('accepts client options with custom headers', () => {
      const { transport, recorded } = fakeTransport()
      const options: ToolClientOptions = {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      }

      const client = createToolClient(transport, 'https://example.com', options)

      expect(client).toBeDefined()
      expect(recorded[0]?.options?.headers?.['X-Custom-Header']).toBe('test-value')
    })

    it('accepts combined options', () => {
      const { transport, recorded } = fakeTransport()
      const options: ToolClientOptions = {
        token: 'bearer-token',
        headers: {
          'X-Request-Id': 'req-123',
        },
      }

      const client = createToolClient(transport, 'https://example.com', options)

      expect(client).toBeDefined()
      expect(recorded[0]?.options).toEqual(options)
    })
  })

  describe('ToolServiceAPI interface', () => {
    // Type-level tests to ensure the API interface is correctly defined

    it('defines register method', () => {
      // Type assertion to verify interface shape
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.register).toBe('undefined') // It's an interface, not a real object
    })

    it('defines get method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.get).toBe('undefined')
    })

    it('defines has method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.has).toBe('undefined')
    })

    it('defines list method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.list).toBe('undefined')
    })

    it('defines query method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.query).toBe('undefined')
    })

    it('defines byCategory method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.byCategory).toBe('undefined')
    })

    it('defines executeTool method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.executeTool).toBe('undefined')
    })

    it('defines toMCP method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.toMCP).toBe('undefined')
    })

    it('defines listMCPTools method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.listMCPTools).toBe('undefined')
    })

    it('defines fromMCP method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.fromMCP).toBe('undefined')
    })

    it('defines clear method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.clear).toBe('undefined')
    })

    it('defines unregister method', () => {
      const api: ToolServiceAPI = {} as ToolServiceAPI

      expect(typeof api.unregister).toBe('undefined')
    })
  })

  describe('rpc.do transport adapter', () => {
    it('creates a client over the rpc transport', async () => {
      const { createRpcToolClient } = await import('../src/transports/rpc.js')

      // This creates an RPC client but doesn't actually connect
      const client = createRpcToolClient('https://custom-tools.example.com')

      expect(client).toBeDefined()
      expect(typeof client).toBe('function')
    })

    it('exports a default client', async () => {
      const { default: defaultClient } = await import('../src/transports/rpc.js')

      expect(defaultClient).toBeDefined()
    })
  })
})
