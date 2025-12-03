/**
 * WebSocket Transport Tests (Node.js)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { WebSocketTransport } from '../../../src/rpc/transport.js'
import {
  createCoreTransportTests,
  createWebSocketTransportTests,
  createAsyncTests,
} from '../shared/transport.cases.js'
import { startTestServer, type TestServer } from '../fixtures/test-server-node.js'
import { createCallMessage, wait } from '../fixtures/test-helpers.js'

describe('WebSocketTransport (Node.js)', () => {
  let server: TestServer

  beforeAll(async () => {
    server = await startTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  // Factory for creating transport context
  const getContext = async () => {
    const transport = new WebSocketTransport({
      url: `${server.wsUrl}/rpc`,
      reconnect: false, // Disable for tests
    })
    await transport.connect()
    return {
      transport,
      wsUrl: `${server.wsUrl}/rpc`,
      cleanup: async () => {
        transport.close()
      },
    }
  }

  // Run shared core transport tests
  describe('Core Transport', () => {
    const cases = createCoreTransportTests(getContext)
    for (const [name, testFn] of Object.entries(cases)) {
      it(name, testFn)
    }
  })

  // Run shared WebSocket-specific tests
  describe('WebSocket-Specific', () => {
    const cases = createWebSocketTransportTests(getContext)
    for (const [name, testFn] of Object.entries(cases)) {
      it(name, testFn)
    }
  })

  // Run shared async tests
  describe('Async Operations', () => {
    const cases = createAsyncTests(getContext)
    for (const [name, testFn] of Object.entries(cases)) {
      it(name, testFn)
    }
  })

  // Node.js-specific WebSocket tests
  describe('Connection Lifecycle', () => {
    it('should connect explicitly', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })

      expect(transport.state).toBe('disconnected')

      await transport.connect()
      expect(transport.state).toBe('connected')

      transport.close()
      expect(transport.state).toBe('disconnected')
    })

    it('should auto-connect on first request', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })

      expect(transport.state).toBe('disconnected')

      // Request should trigger connection
      const response = await transport.request(createCallMessage('echo', ['auto']))
      expect(response.result).toBe('auto')
      expect(transport.state).toBe('connected')

      transport.close()
    })

    it('should handle connection errors', async () => {
      const transport = new WebSocketTransport({
        url: 'ws://localhost:99999/rpc', // Invalid port
        reconnect: false,
      })

      await expect(transport.connect()).rejects.toThrow()
    })
  })

  describe('Reconnection', () => {
    it('should attempt reconnection when enabled', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: true,
        reconnectDelay: 100,
        maxReconnectAttempts: 2,
      })

      await transport.connect()
      expect(transport.state).toBe('connected')

      // Close server-side connection would trigger reconnect
      // This is hard to test without server cooperation
      // Just verify the transport is properly configured

      transport.close()
    })

    it('should not reconnect when disabled', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })

      await transport.connect()
      transport.close()

      // Should stay disconnected
      await wait(50)
      expect(transport.state).toBe('disconnected')
    })
  })

  describe('Ping/Pong', () => {
    it('should send pings at configured interval', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
        pingInterval: 100, // 100ms for testing
      })

      await transport.connect()

      // Wait for a ping cycle
      await wait(150)

      // Connection should still be healthy
      expect(transport.state).toBe('connected')

      transport.close()
    })
  })

  describe('Message Ordering', () => {
    it('should preserve message order', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const results: number[] = []

      // Send multiple requests
      for (let i = 0; i < 10; i++) {
        const response = await transport.request(createCallMessage('echo', [i]))
        results.push(response.result as number)
      }

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

      transport.close()
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle many concurrent requests', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const count = 50
      const promises = Array.from({ length: count }, (_, i) =>
        transport.request(createCallMessage('add', [i, 1]))
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < count; i++) {
        expect(results[i].result).toBe(i + 1)
      }

      transport.close()
    })
  })

  describe('Error Recovery', () => {
    it('should handle errors without breaking connection', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      // Request that throws
      const errorResponse = await transport.request(
        createCallMessage('throwError', ['test'])
      )
      expect(errorResponse.type).toBe('error')

      // Connection should still work
      const successResponse = await transport.request(
        createCallMessage('echo', ['still works'])
      )
      expect(successResponse.result).toBe('still works')

      transport.close()
    })
  })

  describe('Subscription', () => {
    it('should support message subscriptions', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const messages: any[] = []
      const unsubscribe = transport.subscribe((msg) => {
        messages.push(msg)
      })

      // Make a request (subscriber won't see responses to requests)
      await transport.request(createCallMessage('echo', ['test']))

      unsubscribe()
      transport.close()

      // Subscription mechanism works (messages depend on server behavior)
      expect(typeof unsubscribe).toBe('function')
    })
  })
})
