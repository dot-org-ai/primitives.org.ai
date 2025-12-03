/**
 * postMessage Transport Tests (Bun)
 *
 * Run with: bun test test/rpc/bun/postmessage.test.ts
 *
 * Uses MessageChannel API which is available in Bun.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { PostMessageTransport } from '../../../src/rpc/transport.js'
import type { RPCMessage } from '../../../src/rpc/transport.js'
import { createCallMessage } from '../fixtures/test-helpers.js'
import { testMethods, type TestContext } from '../fixtures/test-methods.js'

describe('PostMessageTransport (Bun)', () => {
  let channel: MessageChannel
  let clientTransport: PostMessageTransport

  beforeEach(() => {
    channel = new MessageChannel()

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
        createCallMessage('echo', ['bun postMessage'])
      )
      expect(response.result).toBe('bun postMessage')
    })

    it('should handle method calls with arguments', async () => {
      const response = await clientTransport.request(
        createCallMessage('add', [50, 50])
      )
      expect(response.result).toBe(100)
    })

    it('should handle errors', async () => {
      const response = await clientTransport.request(
        createCallMessage('throwError', ['pm error'])
      )
      expect(response.type).toBe('error')
      expect(response.error?.message).toContain('pm error')
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
        createCallMessage('getUser', ['pm-user'])
      )

      const result = response.result as any
      expect(result.id).toBe('pm-user')
      expect(result.name).toBe('User pm-user')
      expect(result.profile.email).toBe('userpm-user@example.com')
    })

    it('should handle array results', async () => {
      const response = await clientTransport.request(
        createCallMessage('getItems', [['1', '2', '3', '4']])
      )

      expect(Array.isArray(response.result)).toBe(true)
      expect((response.result as any[]).length).toBe(4)
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        clientTransport.request(createCallMessage('multiply', [i, i]))
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < 10; i++) {
        expect(results[i].result).toBe(i * i)
      }
    })

    it('should correlate responses correctly', async () => {
      const msg1 = { ...createCallMessage('echo', ['msg-a']), id: 'id-a' }
      const msg2 = { ...createCallMessage('echo', ['msg-b']), id: 'id-b' }

      const [res1, res2] = await Promise.all([
        clientTransport.request(msg1),
        clientTransport.request(msg2),
      ])

      expect(res1.id).toBe('id-a')
      expect(res1.result).toBe('msg-a')
      expect(res2.id).toBe('id-b')
      expect(res2.result).toBe('msg-b')
    })
  })

  describe('Sequential Requests', () => {
    it('should handle sequential requests', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await clientTransport.request(
          createCallMessage('add', [i, 1])
        )
        expect(response.result).toBe(i + 1)
      }
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

  describe('Error Recovery', () => {
    it('should continue working after errors', async () => {
      // Cause error
      await clientTransport.request(createCallMessage('throwError', ['error']))

      // Should still work
      const response = await clientTransport.request(
        createCallMessage('echo', ['still working'])
      )
      expect(response.result).toBe('still working')
    })
  })
})
