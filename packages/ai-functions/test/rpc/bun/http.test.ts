/**
 * HTTP Transport Tests (Bun)
 *
 * Run with: bun test test/rpc/bun/http.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { HTTPTransport } from '../../../src/rpc/transport.js'
import { startBunTestServer, type BunTestServer } from '../fixtures/test-server-bun.js'
import { createCallMessage } from '../fixtures/test-helpers.js'

describe('HTTPTransport (Bun)', () => {
  let server: BunTestServer

  beforeAll(() => {
    server = startBunTestServer()
  })

  afterAll(() => {
    server.close()
  })

  describe('Basic Operations', () => {
    it('should send and receive messages', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const response = await transport.request(createCallMessage('echo', ['bun test']))
      expect(response.result).toBe('bun test')
    })

    it('should handle method calls with arguments', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const response = await transport.request(createCallMessage('add', [100, 200]))
      expect(response.result).toBe(300)
    })

    it('should handle errors', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const response = await transport.request(
        createCallMessage('throwError', ['bun error'])
      )
      expect(response.type).toBe('error')
      expect(response.error?.message).toContain('bun error')
    })

    it('should handle unknown methods', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const response = await transport.request(createCallMessage('unknownMethod', []))
      expect(response.type).toBe('error')
    })
  })

  describe('Batching', () => {
    it('should batch concurrent requests', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        batchDelay: 0,
      })

      // Reset counter
      await transport.request(createCallMessage('resetCounter', []))

      const promises = Array.from({ length: 5 }, () =>
        transport.request(createCallMessage('counter', []))
      )

      const results = await Promise.all(promises)
      const values = results.map((r) => r.result as number).sort((a, b) => a - b)

      expect(values).toEqual([1, 2, 3, 4, 5])
    })

    it('should respect maxBatchSize', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        maxBatchSize: 2,
        batchDelay: 0,
      })

      await transport.request(createCallMessage('resetCounter', []))

      const promises = Array.from({ length: 4 }, () =>
        transport.request(createCallMessage('counter', []))
      )

      const results = await Promise.all(promises)
      const values = results.map((r) => r.result as number).sort((a, b) => a - b)

      expect(values).toEqual([1, 2, 3, 4])
    })
  })

  describe('Complex Data', () => {
    it('should handle object results', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const response = await transport.request(createCallMessage('getUser', ['bun-user']))

      expect((response.result as any).id).toBe('bun-user')
      expect((response.result as any).name).toBe('User bun-user')
    })

    it('should handle array results', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const response = await transport.request(
        createCallMessage('getItems', [['a', 'b', 'c']])
      )

      expect(Array.isArray(response.result)).toBe(true)
      expect((response.result as any[]).length).toBe(3)
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle many concurrent requests', async () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      const count = 30

      const promises = Array.from({ length: count }, (_, i) =>
        transport.request(createCallMessage('add', [i, 1]))
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < count; i++) {
        expect(results[i].result).toBe(i + 1)
      }
    })
  })

  describe('Connection State', () => {
    it('should show connected state', () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      expect(transport.state).toBe('connected')
    })

    it('should show disconnected after close', () => {
      const transport = new HTTPTransport({ url: `${server.url}/rpc` })
      transport.close()
      expect(transport.state).toBe('disconnected')
    })
  })

  describe('Async Operations', () => {
    it('should handle delayed responses', async () => {
      const transport = new HTTPTransport({
        url: `${server.url}/rpc`,
        timeout: 5000,
      })
      const response = await transport.request(
        createCallMessage('delay', [50, 'delayed'])
      )
      expect(response.result).toBe('delayed')
    })
  })
})
