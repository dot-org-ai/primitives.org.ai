/**
 * HTTP Transport Tests (Cloudflare Workers)
 *
 * These tests run in miniflare via @cloudflare/vitest-pool-workers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { HTTPTransport } from '../../../src/rpc/transport.js'
import { createCallMessage } from '../fixtures/test-helpers.js'

describe('HTTPTransport (Workers)', () => {
  // In Workers, we use SELF to make requests to our own worker
  const rpcUrl = 'http://localhost/rpc'

  describe('Direct Fetch', () => {
    it('should handle RPC call via fetch', async () => {
      const response = await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createCallMessage('echo', ['workers test'])]),
      })

      expect(response.ok).toBe(true)
      const results = await response.json()
      expect(results[0].result).toBe('workers test')
    })

    it('should handle multiple batched calls', async () => {
      const calls = [
        createCallMessage('add', [1, 2]),
        createCallMessage('add', [3, 4]),
        createCallMessage('multiply', [5, 6]),
      ]

      const response = await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calls),
      })

      const results = await response.json()
      expect(results[0].result).toBe(3)
      expect(results[1].result).toBe(7)
      expect(results[2].result).toBe(30)
    })

    it('should handle errors gracefully', async () => {
      const response = await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createCallMessage('throwError', ['test error'])]),
      })

      const results = await response.json()
      expect(results[0].type).toBe('error')
      expect(results[0].error.message).toContain('test error')
    })

    it('should handle unknown methods', async () => {
      const response = await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createCallMessage('unknownMethod', [])]),
      })

      const results = await response.json()
      expect(results[0].type).toBe('error')
      expect(results[0].error.message).toContain('unknownMethod')
    })

    it('should return complex objects', async () => {
      const response = await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createCallMessage('getUser', ['u123'])]),
      })

      const results = await response.json()
      expect(results[0].result.id).toBe('u123')
      expect(results[0].result.name).toBe('User u123')
      expect(results[0].result.profile.email).toBe('useru123@example.com')
    })
  })

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      const response = await SELF.fetch('http://localhost/health')
      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.status).toBe('ok')
    })
  })

  describe('Reset Endpoint', () => {
    it('should reset test state', async () => {
      // First call counter
      await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createCallMessage('counter', [])]),
      })

      // Reset
      const resetResponse = await SELF.fetch('http://localhost/reset', {
        method: 'POST',
      })
      expect(resetResponse.ok).toBe(true)

      // Counter should be reset (start from 1 again)
      const response = await SELF.fetch('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createCallMessage('counter', [])]),
      })
      const results = await response.json()
      expect(results[0].result).toBe(1)
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle many concurrent requests', async () => {
      const count = 20
      const promises = Array.from({ length: count }, (_, i) =>
        SELF.fetch('http://localhost/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([createCallMessage('add', [i, 1])]),
        }).then((r) => r.json())
      )

      const results = await Promise.all(promises)

      for (let i = 0; i < count; i++) {
        expect(results[i][0].result).toBe(i + 1)
      }
    })
  })

  describe('Bridge HTML', () => {
    it('should serve bridge HTML', async () => {
      const response = await SELF.fetch('http://localhost/rpc.html')
      expect(response.ok).toBe(true)
      expect(response.headers.get('content-type')).toContain('text/html')

      const html = await response.text()
      expect(html).toContain('RPC Bridge')
      expect(html).toContain('postMessage')
    })
  })
})
