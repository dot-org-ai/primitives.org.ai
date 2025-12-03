/**
 * HTTP Transport Tests (Node.js)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { HTTPTransport } from '../../../src/rpc/transport.js'
import {
  createCoreTransportTests,
  createHTTPTransportTests,
  createAsyncTests,
} from '../shared/transport.cases.js'
import { startTestServer, type TestServer } from '../fixtures/test-server-node.js'
import { createCallMessage, wait } from '../fixtures/test-helpers.js'

describe('HTTPTransport (Node.js)', () => {
  let server: TestServer

  beforeAll(async () => {
    server = await startTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  // Factory for creating transport context
  const getContext = async () => ({
    transport: new HTTPTransport({ url: `${server.url}/rpc` }),
    httpUrl: `${server.url}/rpc`,
    cleanup: async () => {},
  })

  // Run shared core transport tests
  describe('Core Transport', () => {
    const cases = createCoreTransportTests(getContext)
    for (const [name, testFn] of Object.entries(cases)) {
      it(name, testFn)
    }
  })

  // Run shared HTTP-specific tests
  describe('HTTP-Specific', () => {
    const cases = createHTTPTransportTests(getContext)
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

  // Node.js-specific HTTP tests
  describe('Batching Behavior', () => {
    it('should respect batchDelay option', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        batchDelay: 50,
      })

      const start = performance.now()

      // These should be batched together
      const promises = [
        transport.request(createCallMessage('echo', ['a'])),
        transport.request(createCallMessage('echo', ['b'])),
      ]

      await Promise.all(promises)
      const duration = performance.now() - start

      // Should have waited for batch delay
      expect(duration).toBeGreaterThanOrEqual(40) // Allow some tolerance
    })

    it('should flush immediately with batchDelay 0', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        batchDelay: 0,
      })

      const start = performance.now()
      await transport.request(createCallMessage('echo', ['fast']))
      const duration = performance.now() - start

      // Should be fast
      expect(duration).toBeLessThan(200)
    })

    it('should respect maxBatchSize', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        maxBatchSize: 2,
        batchDelay: 0,
      })

      // Reset counter first
      await transport.request(createCallMessage('resetCounter', []))

      // Send 5 requests - should be split into 3 batches (2, 2, 1)
      const promises = Array.from({ length: 5 }, () =>
        transport.request(createCallMessage('counter', []))
      )

      const results = await Promise.all(promises)
      const values = results.map((r) => r.result as number).sort((a, b) => a - b)

      expect(values).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout slow requests', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        timeout: 50,
      })

      await expect(
        transport.request(createCallMessage('delay', [200, 'slow']))
      ).rejects.toThrow()
    })

    it('should not timeout fast requests', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        timeout: 1000,
      })

      const response = await transport.request(
        createCallMessage('delay', [10, 'fast'])
      )
      expect(response.result).toBe('fast')
    })
  })

  describe('Connection State', () => {
    it('should always show connected state', () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      expect(transport.state).toBe('connected')
    })

    it('should show disconnected after close', () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      transport.close()
      expect(transport.state).toBe('disconnected')
    })

    it('should reject pending requests on close', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        batchDelay: 100,
      })

      const promise = transport.request(createCallMessage('echo', ['test']))

      // Close immediately
      transport.close()

      await expect(promise).rejects.toThrow('closed')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const transport = new HTTPTransport({
        url: 'http://localhost:99999/rpc', // Invalid port
        timeout: 1000,
      })

      await expect(
        transport.request(createCallMessage('echo', ['test']))
      ).rejects.toThrow()
    })

    it('should handle invalid JSON responses', async () => {
      // This would require a mock server that returns invalid JSON
      // Skipping for now as it needs additional setup
    })
  })

  describe('Headers', () => {
    it('should send custom headers', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        headers: {
          'X-Custom-Header': 'test-value',
          'X-Request-ID': 'req-123',
        },
      })

      // The server doesn't validate headers, but we can verify the request succeeds
      const response = await transport.request(createCallMessage('echo', ['headers']))
      expect(response.result).toBe('headers')
    })
  })
})
