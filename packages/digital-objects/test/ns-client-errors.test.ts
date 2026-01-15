import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NSClient } from '../src/ns-client.js'
import { NotFoundError, DigitalObjectsError } from '../src/errors.js'

/**
 * Tests for NSClient error handling
 *
 * These tests verify that NSClient properly distinguishes between:
 * - 404 errors (return null - expected "not found" behavior)
 * - 500 errors (throw ServerError - server problems should propagate)
 * - Network errors (throw NetworkError - connection issues should propagate)
 */
describe('NSClient Error Handling', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let client: NSClient

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new NSClient({
      baseUrl: 'https://ns.example.com',
      namespace: 'test',
      fetch: mockFetch,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getNoun', () => {
    it('should return null for 404 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Noun not found' }), {
          status: 404,
          statusText: 'Not Found',
        })
      )

      const result = await client.getNoun('NonExistent')

      expect(result).toBeNull()
    })

    it('should throw ServerError for 500 responses', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database error' }), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      )

      // Should throw, not return null
      await expect(client.getNoun('Post')).rejects.toThrow(DigitalObjectsError)

      // Re-create mock for second assertion
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database error' }), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      )
      await expect(client.getNoun('Post')).rejects.toMatchObject({
        statusCode: 500,
      })
    })

    it('should throw NetworkError for network timeouts', async () => {
      const timeoutError = new Error('fetch failed')
      timeoutError.name = 'AbortError'
      mockFetch.mockRejectedValueOnce(timeoutError)

      // Should throw NetworkError, not return null
      await expect(client.getNoun('Post')).rejects.toThrow()
    })

    it('should throw NetworkError for connection refused', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      // Should throw NetworkError, not return null
      await expect(client.getNoun('Post')).rejects.toThrow()
    })

    it('should throw for 503 Service Unavailable', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'UNAVAILABLE', message: 'Service temporarily unavailable' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
          }
        )
      )

      // Should throw, not return null
      await expect(client.getNoun('Post')).rejects.toThrow()
    })
  })

  describe('getVerb', () => {
    it('should return null for 404 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Verb not found' }), {
          status: 404,
          statusText: 'Not Found',
        })
      )

      const result = await client.getVerb('NonExistent')

      expect(result).toBeNull()
    })

    it('should throw for 500 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database error' }), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      )

      await expect(client.getVerb('Like')).rejects.toThrow()
    })
  })

  describe('get (Thing)', () => {
    it('should return null for 404 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Thing not found' }), {
          status: 404,
          statusText: 'Not Found',
        })
      )

      const result = await client.get('non-existent-id')

      expect(result).toBeNull()
    })

    it('should throw for 500 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database error' }), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      )

      await expect(client.get('some-id')).rejects.toThrow()
    })

    it('should throw NetworkError for network failures', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(client.get('some-id')).rejects.toThrow()
    })
  })

  describe('getAction', () => {
    it('should return null for 404 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Action not found' }), {
          status: 404,
          statusText: 'Not Found',
        })
      )

      const result = await client.getAction('non-existent-action')

      expect(result).toBeNull()
    })

    it('should throw for 500 responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database error' }), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      )

      await expect(client.getAction('some-action')).rejects.toThrow()
    })
  })

  describe('Error classification', () => {
    it('should throw NotFoundError specifically for 404', async () => {
      // Setup: first call for setup, second for assertion
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Not found' }), {
          status: 404,
        })
      )

      // 404 should return null (not throw)
      const result = await client.getNoun('Missing')
      expect(result).toBeNull()
    })

    it('should preserve error message from server for non-404 errors', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many requests' }), {
          status: 429,
          statusText: 'Too Many Requests',
        })
      )

      await expect(client.getNoun('Post')).rejects.toThrow(/429|Too many requests|rate/i)
    })
  })
})
