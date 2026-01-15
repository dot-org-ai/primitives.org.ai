/**
 * Namespace ID Validation Tests
 *
 * Tests for validateNamespaceId() function and worker fetch handler integration.
 *
 * Issue: aip-b5g0
 *
 * The namespace ID is extracted from the 'ns' query parameter and used to
 * identify a Durable Object instance. Invalid namespace IDs should be rejected
 * with a 400 Bad Request response.
 *
 * Valid namespace IDs:
 * - Alphanumeric characters (a-z, A-Z, 0-9)
 * - Hyphens (-)
 * - Underscores (_)
 * - Length: 1-64 characters
 *
 * Invalid namespace IDs:
 * - Empty string
 * - Dots, slashes, special characters
 * - Length > 64 characters
 */

import { describe, it, expect, vi } from 'vitest'
import { validateNamespaceId } from '../src/ns.js'
import worker from '../src/ns.js'
import type { Env } from '../src/ns.js'

describe('Namespace ID Validation', () => {
  describe('validateNamespaceId()', () => {
    describe('valid namespace patterns', () => {
      it('should accept simple alphanumeric namespaces', () => {
        expect(validateNamespaceId('default')).toBe(true)
        expect(validateNamespaceId('tenant1')).toBe(true)
        expect(validateNamespaceId('MyNamespace')).toBe(true)
        expect(validateNamespaceId('UPPERCASE')).toBe(true)
        expect(validateNamespaceId('lowercase')).toBe(true)
        expect(validateNamespaceId('MixedCase123')).toBe(true)
      })

      it('should accept namespaces with hyphens', () => {
        expect(validateNamespaceId('my-namespace')).toBe(true)
        expect(validateNamespaceId('tenant-1')).toBe(true)
        expect(validateNamespaceId('a-b-c-d')).toBe(true)
        expect(validateNamespaceId('My-Mixed-Case')).toBe(true)
      })

      it('should accept namespaces with underscores', () => {
        expect(validateNamespaceId('my_namespace')).toBe(true)
        expect(validateNamespaceId('tenant_1')).toBe(true)
        expect(validateNamespaceId('a_b_c_d')).toBe(true)
        expect(validateNamespaceId('My_Mixed_Case')).toBe(true)
      })

      it('should accept namespaces with mixed hyphens and underscores', () => {
        expect(validateNamespaceId('my-namespace_v1')).toBe(true)
        expect(validateNamespaceId('tenant_1-prod')).toBe(true)
        expect(validateNamespaceId('a_b-c_d')).toBe(true)
      })

      it('should accept single character namespaces', () => {
        expect(validateNamespaceId('a')).toBe(true)
        expect(validateNamespaceId('Z')).toBe(true)
        expect(validateNamespaceId('1')).toBe(true)
        expect(validateNamespaceId('_')).toBe(true)
        expect(validateNamespaceId('-')).toBe(true)
      })

      it('should accept namespaces starting with numbers', () => {
        expect(validateNamespaceId('123')).toBe(true)
        expect(validateNamespaceId('1st-tenant')).toBe(true)
        expect(validateNamespaceId('2_namespace')).toBe(true)
      })

      it('should accept maximum length namespace (64 chars)', () => {
        const maxLengthNs = 'a'.repeat(64)
        expect(validateNamespaceId(maxLengthNs)).toBe(true)
      })
    })

    describe('invalid namespace patterns', () => {
      it('should reject empty string', () => {
        expect(validateNamespaceId('')).toBe(false)
      })

      it('should reject namespaces with dots', () => {
        expect(validateNamespaceId('namespace.v1')).toBe(false)
        expect(validateNamespaceId('a.b.c')).toBe(false)
        expect(validateNamespaceId('.hidden')).toBe(false)
        expect(validateNamespaceId('trailing.')).toBe(false)
      })

      it('should reject namespaces with slashes', () => {
        expect(validateNamespaceId('namespace/v1')).toBe(false)
        expect(validateNamespaceId('a/b/c')).toBe(false)
        expect(validateNamespaceId('/leading')).toBe(false)
        expect(validateNamespaceId('trailing/')).toBe(false)
        expect(validateNamespaceId('back\\slash')).toBe(false)
      })

      it('should reject namespaces with special characters', () => {
        expect(validateNamespaceId('namespace!')).toBe(false)
        expect(validateNamespaceId('namespace@')).toBe(false)
        expect(validateNamespaceId('namespace#')).toBe(false)
        expect(validateNamespaceId('namespace$')).toBe(false)
        expect(validateNamespaceId('namespace%')).toBe(false)
        expect(validateNamespaceId('namespace^')).toBe(false)
        expect(validateNamespaceId('namespace&')).toBe(false)
        expect(validateNamespaceId('namespace*')).toBe(false)
        expect(validateNamespaceId('namespace(')).toBe(false)
        expect(validateNamespaceId('namespace)')).toBe(false)
        expect(validateNamespaceId('namespace=')).toBe(false)
        expect(validateNamespaceId('namespace+')).toBe(false)
        expect(validateNamespaceId('namespace[')).toBe(false)
        expect(validateNamespaceId('namespace]')).toBe(false)
        expect(validateNamespaceId('namespace{')).toBe(false)
        expect(validateNamespaceId('namespace}')).toBe(false)
        expect(validateNamespaceId('namespace|')).toBe(false)
        expect(validateNamespaceId('namespace;')).toBe(false)
        expect(validateNamespaceId('namespace:')).toBe(false)
        expect(validateNamespaceId("namespace'")).toBe(false)
        expect(validateNamespaceId('namespace"')).toBe(false)
        expect(validateNamespaceId('namespace<')).toBe(false)
        expect(validateNamespaceId('namespace>')).toBe(false)
        expect(validateNamespaceId('namespace,')).toBe(false)
        expect(validateNamespaceId('namespace?')).toBe(false)
        expect(validateNamespaceId('namespace`')).toBe(false)
        expect(validateNamespaceId('namespace~')).toBe(false)
      })

      it('should reject namespaces with spaces', () => {
        expect(validateNamespaceId('my namespace')).toBe(false)
        expect(validateNamespaceId(' leading')).toBe(false)
        expect(validateNamespaceId('trailing ')).toBe(false)
        expect(validateNamespaceId('  ')).toBe(false)
      })

      it('should reject namespaces exceeding 64 characters', () => {
        const tooLongNs = 'a'.repeat(65)
        expect(validateNamespaceId(tooLongNs)).toBe(false)
      })

      it('should reject very long namespaces', () => {
        const veryLongNs = 'a'.repeat(100)
        expect(validateNamespaceId(veryLongNs)).toBe(false)

        const extremelyLongNs = 'a'.repeat(1000)
        expect(validateNamespaceId(extremelyLongNs)).toBe(false)
      })

      it('should reject namespaces with unicode characters', () => {
        expect(validateNamespaceId('namespace\u0000')).toBe(false) // null byte
        expect(validateNamespaceId('namespace\u00e9')).toBe(false) // é
        expect(validateNamespaceId('namespace\u4e2d')).toBe(false) // 中
        expect(validateNamespaceId('\u2603')).toBe(false) // snowman emoji
      })

      it('should reject namespaces with newlines or tabs', () => {
        expect(validateNamespaceId('namespace\n')).toBe(false)
        expect(validateNamespaceId('namespace\r')).toBe(false)
        expect(validateNamespaceId('namespace\t')).toBe(false)
        expect(validateNamespaceId('\nleading')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle boundary length (63, 64, 65 characters)', () => {
        expect(validateNamespaceId('a'.repeat(63))).toBe(true) // just under
        expect(validateNamespaceId('a'.repeat(64))).toBe(true) // exactly at limit
        expect(validateNamespaceId('a'.repeat(65))).toBe(false) // just over
      })
    })
  })

  describe('Worker fetch handler integration', () => {
    const createMockEnv = (): Env => {
      const mockStub = {
        fetch: vi.fn().mockResolvedValue(new Response('OK')),
      }

      return {
        NS: {
          idFromName: vi.fn().mockReturnValue('mock-id'),
          get: vi.fn().mockReturnValue(mockStub),
        } as unknown as DurableObjectNamespace,
      }
    }

    it('should allow valid namespace and forward to Durable Object', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns?ns=my-tenant-1')

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(200)
      expect(env.NS.idFromName).toHaveBeenCalledWith('my-tenant-1')
    })

    it('should use default namespace when ns parameter is omitted', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns')

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(200)
      expect(env.NS.idFromName).toHaveBeenCalledWith('default')
    })

    it('should return 400 for invalid namespace with dots', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns?ns=my.namespace')

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('INVALID_NAMESPACE')
      expect(body.message).toContain('Invalid namespace ID')
      // Should NOT have called idFromName
      expect(env.NS.idFromName).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid namespace with slashes', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns?ns=namespace/v1')

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('INVALID_NAMESPACE')
      expect(env.NS.idFromName).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid namespace with special characters', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns?ns=' + encodeURIComponent('ns@#$%'))

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('INVALID_NAMESPACE')
      expect(env.NS.idFromName).not.toHaveBeenCalled()
    })

    it('should return 400 for namespace exceeding 64 characters', async () => {
      const env = createMockEnv()
      const longNs = 'a'.repeat(65)
      const request = new Request(`https://example.com/nouns?ns=${longNs}`)

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('INVALID_NAMESPACE')
      expect(env.NS.idFromName).not.toHaveBeenCalled()
    })

    it('should return 400 for empty namespace string', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns?ns=')

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('INVALID_NAMESPACE')
      expect(env.NS.idFromName).not.toHaveBeenCalled()
    })

    it('should return 400 for namespace with spaces', async () => {
      const env = createMockEnv()
      const request = new Request(
        'https://example.com/nouns?ns=' + encodeURIComponent('my namespace')
      )

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('INVALID_NAMESPACE')
      expect(env.NS.idFromName).not.toHaveBeenCalled()
    })

    it('should allow valid namespaces with hyphens and underscores', async () => {
      const env = createMockEnv()
      const request = new Request('https://example.com/nouns?ns=my-tenant_v1')

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(200)
      expect(env.NS.idFromName).toHaveBeenCalledWith('my-tenant_v1')
    })

    it('should allow 64-character namespace (boundary test)', async () => {
      const env = createMockEnv()
      const maxNs = 'a'.repeat(64)
      const request = new Request(`https://example.com/nouns?ns=${maxNs}`)

      const response = await worker.fetch(request, env)

      expect(response.status).toBe(200)
      expect(env.NS.idFromName).toHaveBeenCalledWith(maxNs)
    })
  })
})
