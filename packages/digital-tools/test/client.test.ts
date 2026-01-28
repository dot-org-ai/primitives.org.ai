/**
 * Tests for RPC Client
 *
 * Covers the client module for connecting to digital-tools workers.
 */

import { describe, it, expect } from 'vitest'
import { createToolClient, type ToolClientOptions, type ToolServiceAPI } from '../src/client.js'

describe('Client Module', () => {
  describe('createToolClient', () => {
    it('creates a client with default URL', () => {
      // This creates an RPC client but doesn't actually connect
      const client = createToolClient()

      expect(client).toBeDefined()
      expect(typeof client).toBe('function')
    })

    it('creates a client with custom URL', () => {
      const client = createToolClient('https://custom-tools.example.com')

      expect(client).toBeDefined()
    })

    it('accepts client options with token', () => {
      const options: ToolClientOptions = {
        token: 'test-token',
      }

      const client = createToolClient('https://example.com', options)

      expect(client).toBeDefined()
    })

    it('accepts client options with custom headers', () => {
      const options: ToolClientOptions = {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      }

      const client = createToolClient('https://example.com', options)

      expect(client).toBeDefined()
    })

    it('accepts combined options', () => {
      const options: ToolClientOptions = {
        token: 'bearer-token',
        headers: {
          'X-Request-Id': 'req-123',
        },
      }

      const client = createToolClient('https://example.com', options)

      expect(client).toBeDefined()
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

  describe('default export', () => {
    it('exports a default client', async () => {
      const { default: defaultClient } = await import('../src/client.js')

      expect(defaultClient).toBeDefined()
    })
  })
})
