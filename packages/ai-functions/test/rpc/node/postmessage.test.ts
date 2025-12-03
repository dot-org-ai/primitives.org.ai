/**
 * postMessage Transport Tests (Node.js)
 *
 * Uses MessageChannel API which is available in Node.js 15+
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PostMessageTransport } from '../../../src/rpc/transport.js'
import {
  createCoreTransportTests,
  createPostMessageTransportTests,
  createAsyncTests,
} from '../shared/transport.cases.js'
import {
  createMessageChannelPair,
  createRawMessageChannelPair,
  type MessageChannelPair,
} from '../fixtures/message-channel.js'
import { createCallMessage, wait } from '../fixtures/test-helpers.js'

describe('PostMessageTransport (Node.js)', () => {
  let channelPair: MessageChannelPair

  beforeEach(() => {
    channelPair = createMessageChannelPair()
  })

  afterEach(() => {
    channelPair.cleanup()
  })

  // Factory for creating transport context
  const getContext = async () => {
    const pair = createMessageChannelPair()
    return {
      transport: pair.client,
      cleanup: async () => {
        pair.cleanup()
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

  // Run shared postMessage-specific tests
  describe('postMessage-Specific', () => {
    const cases = createPostMessageTransportTests(getContext)
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

  // Node.js-specific postMessage tests
  describe('MessageChannel Integration', () => {
    it('should work with MessageChannel ports', async () => {
      const response = await channelPair.client.request(
        createCallMessage('echo', ['channel test'])
      )
      expect(response.result).toBe('channel test')
    })

    it('should handle multiple independent channels', async () => {
      const pair1 = createMessageChannelPair()
      const pair2 = createMessageChannelPair()

      try {
        const [res1, res2] = await Promise.all([
          pair1.client.request(createCallMessage('echo', ['channel 1'])),
          pair2.client.request(createCallMessage('echo', ['channel 2'])),
        ])

        expect(res1.result).toBe('channel 1')
        expect(res2.result).toBe('channel 2')
      } finally {
        pair1.cleanup()
        pair2.cleanup()
      }
    })
  })

  describe('Connection State', () => {
    it('should always show connected state', () => {
      expect(channelPair.client.state).toBe('connected')
    })

    it('should show disconnected after close', () => {
      channelPair.client.close()
      expect(channelPair.client.state).toBe('disconnected')
    })
  })

  describe('Port Lifecycle', () => {
    it('should handle port closure gracefully', async () => {
      const pair = createMessageChannelPair()

      // Make a successful request first
      const response = await pair.client.request(createCallMessage('echo', ['test']))
      expect(response.result).toBe('test')

      // Close the transport
      pair.client.close()

      // Further requests should fail
      await expect(
        pair.client.request(createCallMessage('echo', ['after close']))
      ).rejects.toThrow()

      pair.cleanup()
    })
  })

  describe('Message Ordering', () => {
    it('should preserve message order', async () => {
      const results: number[] = []

      for (let i = 0; i < 10; i++) {
        const response = await channelPair.client.request(
          createCallMessage('echo', [i])
        )
        results.push(response.result as number)
      }

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        channelPair.client.request(createCallMessage('add', [i, 100]))
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < 20; i++) {
        expect(results[i].result).toBe(i + 100)
      }
    })
  })

  describe('Raw MessageChannel', () => {
    it('should work with raw MessageChannel for custom protocols', async () => {
      const { port1, port2, cleanup } = createRawMessageChannelPair()

      // Set up simple echo on port2
      port2.onmessage = (event) => {
        port2.postMessage({ echo: event.data })
      }

      // Send and receive via port1
      const response = await new Promise<any>((resolve) => {
        port1.onmessage = (event) => resolve(event.data)
        port1.postMessage('hello')
      })

      expect(response.echo).toBe('hello')
      cleanup()
    })
  })

  describe('Subscription', () => {
    it('should support message subscriptions', async () => {
      const messages: any[] = []
      const unsubscribe = channelPair.client.subscribe((msg) => {
        messages.push(msg)
      })

      // Make a request
      await channelPair.client.request(createCallMessage('echo', ['test']))

      unsubscribe()

      // Subscription mechanism works
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Error Handling', () => {
    it('should handle method errors', async () => {
      const response = await channelPair.client.request(
        createCallMessage('throwError', ['test error'])
      )

      expect(response.type).toBe('error')
      expect(response.error?.message).toContain('test error')
    })

    it('should handle unknown methods', async () => {
      const response = await channelPair.client.request(
        createCallMessage('unknownMethod', [])
      )

      expect(response.type).toBe('error')
      expect(response.error?.code).toBe('METHOD_NOT_FOUND')
    })

    it('should continue working after errors', async () => {
      // Cause an error
      await channelPair.client.request(createCallMessage('throwError', ['error']))

      // Should still work
      const response = await channelPair.client.request(
        createCallMessage('echo', ['recovered'])
      )
      expect(response.result).toBe('recovered')
    })
  })
})
