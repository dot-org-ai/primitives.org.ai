/**
 * postMessage Transport Tests (Cloudflare Workers)
 *
 * Tests MessageChannel-based postMessage in Workers environment.
 * Note: MessageChannel may not be available in all Workers test environments.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { PostMessageTransport } from '../../../src/rpc/transport.js'
import type { RPCMessage } from '../../../src/rpc/transport.js'
import { createCallMessage } from '../fixtures/test-helpers.js'
import { testMethods, type TestContext } from '../fixtures/test-methods.js'

// Check if MessageChannel is available
const hasMessageChannel = typeof MessageChannel !== 'undefined'

describe.skipIf(!hasMessageChannel)('PostMessageTransport (Workers)', () => {
  let channel: MessageChannel
  let clientTransport: PostMessageTransport

  beforeEach(() => {
    channel = new MessageChannel()

    // Client transport uses port1
    clientTransport = new PostMessageTransport({
      target: channel.port1,
    })

    // Server handler on port2
    channel.port2.onmessage = async (event: MessageEvent) => {
      const message = event.data as RPCMessage

      if (message.type === 'call' && message.method) {
        const method = testMethods[message.method]

        if (!method) {
          channel.port2.postMessage({
            id: message.id,
            type: 'error',
            error: { message: `Unknown method: ${message.method}`, code: 'METHOD_NOT_FOUND' },
          } satisfies RPCMessage)
          return
        }

        try {
          const ctx: TestContext = {}
          const result = await (method as Function)(ctx, ...(message.params || []))

          channel.port2.postMessage({
            id: message.id,
            type: 'result',
            result,
          } satisfies RPCMessage)
        } catch (err) {
          channel.port2.postMessage({
            id: message.id,
            type: 'error',
            error: {
              message: err instanceof Error ? err.message : String(err),
              code: 'INTERNAL_ERROR',
            },
          } satisfies RPCMessage)
        }
      }
    }

    // Start both ports
    channel.port1.start()
    channel.port2.start()
  })

  afterEach(() => {
    channel.port1.close()
    channel.port2.close()
  })

  describe('Basic Operations', () => {
    it('should send and receive messages', async () => {
      const response = await clientTransport.request(
        createCallMessage('echo', ['workers postMessage'])
      )
      expect(response.result).toBe('workers postMessage')
    })

    it('should handle method calls with arguments', async () => {
      const response = await clientTransport.request(
        createCallMessage('add', [10, 20])
      )
      expect(response.result).toBe(30)
    })

    it('should handle errors', async () => {
      const response = await clientTransport.request(
        createCallMessage('throwError', ['test error'])
      )
      expect(response.type).toBe('error')
      expect(response.error?.message).toContain('test error')
    })

    it('should handle unknown methods', async () => {
      const response = await clientTransport.request(
        createCallMessage('unknownMethod', [])
      )
      expect(response.type).toBe('error')
      expect(response.error?.code).toBe('METHOD_NOT_FOUND')
    })
  })

  describe('Complex Data', () => {
    it('should handle object results', async () => {
      const response = await clientTransport.request(
        createCallMessage('getUser', ['u456'])
      )
      expect((response.result as any).id).toBe('u456')
      expect((response.result as any).name).toBe('User u456')
      expect((response.result as any).profile.email).toBe('useru456@example.com')
    })

    it('should handle array results', async () => {
      const response = await clientTransport.request(
        createCallMessage('getItems', [['x', 'y', 'z']])
      )
      expect(Array.isArray(response.result)).toBe(true)
      expect((response.result as any[]).length).toBe(3)
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [
        clientTransport.request(createCallMessage('add', [1, 1])),
        clientTransport.request(createCallMessage('add', [2, 2])),
        clientTransport.request(createCallMessage('add', [3, 3])),
      ]

      const results = await Promise.all(promises)

      expect(results[0].result).toBe(2)
      expect(results[1].result).toBe(4)
      expect(results[2].result).toBe(6)
    })

    it('should correlate responses correctly', async () => {
      const msg1 = { ...createCallMessage('echo', ['first']), id: 'msg-1' }
      const msg2 = { ...createCallMessage('echo', ['second']), id: 'msg-2' }

      const [res1, res2] = await Promise.all([
        clientTransport.request(msg1),
        clientTransport.request(msg2),
      ])

      expect(res1.id).toBe('msg-1')
      expect(res1.result).toBe('first')
      expect(res2.id).toBe('msg-2')
      expect(res2.result).toBe('second')
    })
  })

  describe('Connection State', () => {
    it('should show connected state', () => {
      expect(clientTransport.state).toBe('connected')
    })

    it('should show disconnected after close', () => {
      clientTransport.close()
      expect(clientTransport.state).toBe('disconnected')
    })
  })

  describe('Sequential Requests', () => {
    it('should handle many sequential requests', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await clientTransport.request(
          createCallMessage('multiply', [i, 3])
        )
        expect(response.result).toBe(i * 3)
      }
    })
  })
})
