/**
 * WebSocket Transport Tests (Bun)
 *
 * Run with: bun test test/rpc/bun/websocket.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { WebSocketTransport } from '../../../src/rpc/transport.js'
import { startBunTestServer, type BunTestServer } from '../fixtures/test-server-bun.js'
import { createCallMessage } from '../fixtures/test-helpers.js'

describe('WebSocketTransport (Bun)', () => {
  let server: BunTestServer

  beforeAll(() => {
    server = startBunTestServer()
  })

  afterAll(() => {
    server.close()
  })

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

      const response = await transport.request(createCallMessage('echo', ['auto']))
      expect(response.result).toBe('auto')
      expect(transport.state).toBe('connected')

      transport.close()
    })
  })

  describe('Basic Operations', () => {
    it('should send and receive messages', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const response = await transport.request(
        createCallMessage('echo', ['bun websocket'])
      )
      expect(response.result).toBe('bun websocket')

      transport.close()
    })

    it('should handle method calls with arguments', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const response = await transport.request(createCallMessage('multiply', [7, 8]))
      expect(response.result).toBe(56)

      transport.close()
    })

    it('should handle errors', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const response = await transport.request(
        createCallMessage('throwError', ['ws error'])
      )
      expect(response.type).toBe('error')
      expect(response.error?.message).toContain('ws error')

      transport.close()
    })
  })

  describe('Persistent Connection', () => {
    it('should maintain connection across requests', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      // Multiple requests on same connection
      for (let i = 0; i < 5; i++) {
        const response = await transport.request(createCallMessage('echo', [i]))
        expect(response.result).toBe(i)
        expect(transport.state).toBe('connected')
      }

      transport.close()
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const promises = Array.from({ length: 20 }, (_, i) =>
        transport.request(createCallMessage('add', [i, 100]))
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < 20; i++) {
        expect(results[i].result).toBe(i + 100)
      }

      transport.close()
    })
  })

  describe('Complex Data', () => {
    it('should handle object results', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      const response = await transport.request(
        createCallMessage('getUser', ['ws-user'])
      )

      expect((response.result as any).id).toBe('ws-user')
      expect((response.result as any).profile.email).toBe('userws-user@example.com')

      transport.close()
    })
  })

  describe('Error Recovery', () => {
    it('should continue working after errors', async () => {
      const transport = new WebSocketTransport({
        url: `${server.wsUrl}/rpc`,
        reconnect: false,
      })
      await transport.connect()

      // Cause error
      const errorResponse = await transport.request(
        createCallMessage('throwError', ['test'])
      )
      expect(errorResponse.type).toBe('error')

      // Should still work
      const successResponse = await transport.request(
        createCallMessage('echo', ['recovered'])
      )
      expect(successResponse.result).toBe('recovered')

      transport.close()
    })
  })
})
