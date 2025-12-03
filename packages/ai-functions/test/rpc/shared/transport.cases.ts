/**
 * Shared transport test cases
 *
 * These test case factories can be used with any transport implementation.
 * Each factory returns an object of test functions that can be spread into
 * a test suite.
 */

import { expect } from 'vitest'
import type { Transport, RPCMessage } from '../../../src/rpc/transport.js'
import {
  type TransportTestContext,
  type TransportContextFactory,
  createCallMessage,
  wait,
  expectReject,
} from '../fixtures/test-helpers.js'

// =============================================================================
// Core Transport Tests
// =============================================================================

/**
 * Create core transport test cases
 *
 * Tests basic send/receive, error handling, and connection state.
 */
export function createCoreTransportTests(getContext: TransportContextFactory) {
  return {
    'should send and receive a simple message': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message = createCallMessage('echo', ['hello'])
        const response = await transport.request(message)

        expect(response.type).toBe('result')
        expect(response.result).toBe('hello')
      } finally {
        await cleanup()
      }
    },

    'should handle method calls with multiple arguments': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message = createCallMessage('add', [2, 3])
        const response = await transport.request(message)

        expect(response.type).toBe('result')
        expect(response.result).toBe(5)
      } finally {
        await cleanup()
      }
    },

    'should handle errors from RPC methods': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message = createCallMessage('throwError', ['test error'])
        const response = await transport.request(message)

        expect(response.type).toBe('error')
        expect(response.error?.message).toContain('test error')
      } finally {
        await cleanup()
      }
    },

    'should handle unknown methods': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message = createCallMessage('unknownMethod', [])
        const response = await transport.request(message)

        expect(response.type).toBe('error')
        expect(response.error?.message).toContain('unknownMethod')
      } finally {
        await cleanup()
      }
    },

    'should track connection state': async () => {
      const { transport, cleanup } = await getContext()
      try {
        // State should be connected or connecting
        expect(['connecting', 'connected']).toContain(transport.state)
      } finally {
        transport.close()
        expect(transport.state).toBe('disconnected')
        await cleanup()
      }
    },

    'should handle concurrent requests': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const promises = [
          transport.request(createCallMessage('add', [1, 1])),
          transport.request(createCallMessage('add', [2, 2])),
          transport.request(createCallMessage('add', [3, 3])),
        ]

        const results = await Promise.all(promises)

        expect(results[0].result).toBe(2)
        expect(results[1].result).toBe(4)
        expect(results[2].result).toBe(6)
      } finally {
        await cleanup()
      }
    },

    'should correlate responses to requests by ID': async () => {
      const { transport, cleanup } = await getContext()
      try {
        // Send requests with specific IDs
        const msg1 = { ...createCallMessage('echo', ['first']), id: 'custom-1' }
        const msg2 = { ...createCallMessage('echo', ['second']), id: 'custom-2' }

        const [res1, res2] = await Promise.all([
          transport.request(msg1),
          transport.request(msg2),
        ])

        expect(res1.id).toBe('custom-1')
        expect(res1.result).toBe('first')
        expect(res2.id).toBe('custom-2')
        expect(res2.result).toBe('second')
      } finally {
        await cleanup()
      }
    },

    'should handle object results': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message = createCallMessage('getUser', ['u123'])
        const response = await transport.request(message)

        expect(response.type).toBe('result')
        expect((response.result as any).id).toBe('u123')
        expect((response.result as any).name).toBe('User u123')
        expect((response.result as any).profile.email).toBe('useru123@example.com')
      } finally {
        await cleanup()
      }
    },

    'should handle array results': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message = createCallMessage('getItems', [['a', 'b', 'c']])
        const response = await transport.request(message)

        expect(response.type).toBe('result')
        expect(Array.isArray(response.result)).toBe(true)
        expect((response.result as any[]).length).toBe(3)
      } finally {
        await cleanup()
      }
    },
  }
}

// =============================================================================
// HTTP-Specific Tests
// =============================================================================

/**
 * Create HTTP transport-specific test cases
 *
 * Tests batching, timeouts, and HTTP-specific behavior.
 */
export function createHTTPTransportTests(getContext: TransportContextFactory) {
  return {
    'should batch concurrent requests': async () => {
      const { transport, cleanup } = await getContext()
      try {
        // Reset counter
        await transport.request(createCallMessage('resetCounter', []))

        // Send multiple requests that should be batched
        const promises = Array.from({ length: 5 }, () =>
          transport.request(createCallMessage('counter', []))
        )

        const results = await Promise.all(promises)
        const values = results.map((r) => r.result as number)

        // All requests should have been processed
        expect(values.sort()).toEqual([1, 2, 3, 4, 5])
      } finally {
        await cleanup()
      }
    },

    'should handle empty params': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const message: RPCMessage = {
          id: 'test-empty',
          type: 'call',
          method: 'counter',
        }
        const response = await transport.request(message)

        expect(response.type).toBe('result')
        expect(typeof response.result).toBe('number')
      } finally {
        await cleanup()
      }
    },
  }
}

// =============================================================================
// WebSocket-Specific Tests
// =============================================================================

/**
 * Create WebSocket transport-specific test cases
 *
 * Tests persistent connections, reconnection, and streaming.
 */
export function createWebSocketTransportTests(getContext: TransportContextFactory) {
  return {
    'should maintain persistent connection': async () => {
      const { transport, cleanup } = await getContext()
      try {
        // First request
        const res1 = await transport.request(createCallMessage('echo', ['first']))
        expect(res1.result).toBe('first')

        // Wait a bit
        await wait(100)

        // Second request on same connection
        const res2 = await transport.request(createCallMessage('echo', ['second']))
        expect(res2.result).toBe('second')

        // Connection should still be connected
        expect(transport.state).toBe('connected')
      } finally {
        await cleanup()
      }
    },

    'should handle rapid sequential requests': async () => {
      const { transport, cleanup } = await getContext()
      try {
        for (let i = 0; i < 10; i++) {
          const response = await transport.request(createCallMessage('add', [i, 1]))
          expect(response.result).toBe(i + 1)
        }
      } finally {
        await cleanup()
      }
    },
  }
}

// =============================================================================
// postMessage-Specific Tests
// =============================================================================

/**
 * Create postMessage transport-specific test cases
 */
export function createPostMessageTransportTests(getContext: TransportContextFactory) {
  return {
    'should work with MessageChannel': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const response = await transport.request(createCallMessage('echo', ['channel']))
        expect(response.result).toBe('channel')
      } finally {
        await cleanup()
      }
    },

    'should handle multiple messages in sequence': async () => {
      const { transport, cleanup } = await getContext()
      try {
        for (let i = 0; i < 5; i++) {
          const response = await transport.request(
            createCallMessage('multiply', [i, 2])
          )
          expect(response.result).toBe(i * 2)
        }
      } finally {
        await cleanup()
      }
    },
  }
}

// =============================================================================
// Async Operation Tests
// =============================================================================

/**
 * Create async operation test cases
 */
export function createAsyncTests(getContext: TransportContextFactory) {
  return {
    'should handle delayed responses': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const response = await transport.request(
          createCallMessage('delay', [50, 'delayed'])
        )
        expect(response.result).toBe('delayed')
      } finally {
        await cleanup()
      }
    },

    'should handle multiple delayed responses': async () => {
      const { transport, cleanup } = await getContext()
      try {
        const promises = [
          transport.request(createCallMessage('delay', [100, 'slow'])),
          transport.request(createCallMessage('delay', [10, 'fast'])),
        ]

        const [slow, fast] = await Promise.all(promises)
        expect(slow.result).toBe('slow')
        expect(fast.result).toBe('fast')
      } finally {
        await cleanup()
      }
    },
  }
}
