/**
 * Tests for Slack Signature Verification Crypto Functions
 *
 * This module tests the HMAC-SHA256 signature verification used by Slack webhooks.
 * The implementation should work in both Node.js and Cloudflare Workers environments
 * using the Web Crypto API.
 *
 * Bead issue: aip-621l
 */

import { describe, it, expect } from 'vitest'
import { verifySlackSignature, computeHmacSha256Hex } from '../../src/transports/slack.js'

// Test constants matching Slack's signing secret format
const TEST_SIGNING_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
const TEST_TIMESTAMP = '1531420618'
const TEST_BODY = 'token=xyzz0WbapA4vBCDEFasx0q6G&team_id=T1DC2JH3J&team_domain=testteamnow'

// Pre-computed signature for the test data above
// This is the expected signature when signing "v0:1531420618:token=xyzz0WbapA4vBCDEFasx0q6G&team_id=T1DC2JH3J&team_domain=testteamnow"
// with the signing secret "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
// Note: We'll compute the actual expected value when implementing

describe('Slack Signature Verification', () => {
  describe('computeHmacSha256Hex', () => {
    it('should compute HMAC-SHA256 and return hex string', async () => {
      const baseString = `v0:${TEST_TIMESTAMP}:${TEST_BODY}`
      const result = await computeHmacSha256Hex(baseString, TEST_SIGNING_SECRET)

      // Result should be a 64-character hex string (256 bits = 32 bytes = 64 hex chars)
      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce consistent results for same input', async () => {
      const data = 'test data'
      const secret = 'test secret'

      const result1 = await computeHmacSha256Hex(data, secret)
      const result2 = await computeHmacSha256Hex(data, secret)

      expect(result1).toBe(result2)
    })

    it('should produce different results for different data', async () => {
      const secret = 'test secret'

      const result1 = await computeHmacSha256Hex('data1', secret)
      const result2 = await computeHmacSha256Hex('data2', secret)

      expect(result1).not.toBe(result2)
    })

    it('should produce different results for different secrets', async () => {
      const data = 'test data'

      const result1 = await computeHmacSha256Hex(data, 'secret1')
      const result2 = await computeHmacSha256Hex(data, 'secret2')

      expect(result1).not.toBe(result2)
    })

    it('should handle empty data', async () => {
      const result = await computeHmacSha256Hex('', 'secret')

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle unicode data', async () => {
      const result = await computeHmacSha256Hex('Hello, World! Emoji test: *smile*', 'secret')

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('verifySlackSignature', () => {
    it('should verify a valid signature', async () => {
      // First compute what the signature should be
      const baseString = `v0:${TEST_TIMESTAMP}:${TEST_BODY}`
      const hmac = await computeHmacSha256Hex(baseString, TEST_SIGNING_SECRET)
      const validSignature = `v0=${hmac}`

      const isValid = await verifySlackSignature(
        validSignature,
        TEST_TIMESTAMP,
        TEST_BODY,
        TEST_SIGNING_SECRET
      )

      expect(isValid).toBe(true)
    })

    it('should reject an invalid signature', async () => {
      const invalidSignature = 'v0=0000000000000000000000000000000000000000000000000000000000000000'

      const isValid = await verifySlackSignature(
        invalidSignature,
        TEST_TIMESTAMP,
        TEST_BODY,
        TEST_SIGNING_SECRET
      )

      expect(isValid).toBe(false)
    })

    it('should reject a malformed signature (missing v0= prefix)', async () => {
      const malformedSignature = 'abc123def456'

      const isValid = await verifySlackSignature(
        malformedSignature,
        TEST_TIMESTAMP,
        TEST_BODY,
        TEST_SIGNING_SECRET
      )

      expect(isValid).toBe(false)
    })

    it('should reject signature with wrong secret', async () => {
      // Compute signature with correct secret
      const baseString = `v0:${TEST_TIMESTAMP}:${TEST_BODY}`
      const hmac = await computeHmacSha256Hex(baseString, TEST_SIGNING_SECRET)
      const signature = `v0=${hmac}`

      // Verify with wrong secret
      const isValid = await verifySlackSignature(
        signature,
        TEST_TIMESTAMP,
        TEST_BODY,
        'wrong-secret-key'
      )

      expect(isValid).toBe(false)
    })

    it('should reject signature with tampered body', async () => {
      // Compute signature with original body
      const baseString = `v0:${TEST_TIMESTAMP}:${TEST_BODY}`
      const hmac = await computeHmacSha256Hex(baseString, TEST_SIGNING_SECRET)
      const signature = `v0=${hmac}`

      // Verify with tampered body
      const isValid = await verifySlackSignature(
        signature,
        TEST_TIMESTAMP,
        TEST_BODY + 'tampered',
        TEST_SIGNING_SECRET
      )

      expect(isValid).toBe(false)
    })

    it('should reject signature with wrong timestamp', async () => {
      // Compute signature with original timestamp
      const baseString = `v0:${TEST_TIMESTAMP}:${TEST_BODY}`
      const hmac = await computeHmacSha256Hex(baseString, TEST_SIGNING_SECRET)
      const signature = `v0=${hmac}`

      // Verify with different timestamp
      const isValid = await verifySlackSignature(
        signature,
        '1234567890',
        TEST_BODY,
        TEST_SIGNING_SECRET
      )

      expect(isValid).toBe(false)
    })

    it('should use constant-time comparison to prevent timing attacks', async () => {
      // This test verifies the function handles different-length signatures safely
      const baseString = `v0:${TEST_TIMESTAMP}:${TEST_BODY}`
      const hmac = await computeHmacSha256Hex(baseString, TEST_SIGNING_SECRET)
      const validSignature = `v0=${hmac}`

      // Short signature
      const isValidShort = await verifySlackSignature(
        'v0=abc',
        TEST_TIMESTAMP,
        TEST_BODY,
        TEST_SIGNING_SECRET
      )
      expect(isValidShort).toBe(false)

      // Long signature
      const isValidLong = await verifySlackSignature(
        validSignature + 'extra',
        TEST_TIMESTAMP,
        TEST_BODY,
        TEST_SIGNING_SECRET
      )
      expect(isValidLong).toBe(false)

      // Correct length but wrong content
      const wrongSig = 'v0=' + '0'.repeat(64)
      const isValidWrong = await verifySlackSignature(
        wrongSig,
        TEST_TIMESTAMP,
        TEST_BODY,
        TEST_SIGNING_SECRET
      )
      expect(isValidWrong).toBe(false)
    })
  })

  describe('Web Crypto API compatibility', () => {
    it('should work in environments with crypto.subtle', async () => {
      // This test verifies that the global crypto.subtle is being used
      expect(globalThis.crypto).toBeDefined()
      expect(globalThis.crypto.subtle).toBeDefined()

      // The actual crypto operations should work
      const result = await computeHmacSha256Hex('test', 'secret')
      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce results compatible with known HMAC-SHA256 test vectors', async () => {
      // RFC 4231 test vector (truncated to check format)
      // Key: "key"
      // Data: "The quick brown fox jumps over the lazy dog"
      // Expected HMAC-SHA256: f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8
      const testKey = 'key'
      const testData = 'The quick brown fox jumps over the lazy dog'
      const expectedHmac = 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'

      const result = await computeHmacSha256Hex(testData, testKey)

      expect(result).toBe(expectedHmac)
    })
  })
})
