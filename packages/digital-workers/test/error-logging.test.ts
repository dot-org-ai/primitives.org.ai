/**
 * Error Logging Tests
 *
 * TDD tests verifying that catch blocks log errors instead of silently returning null.
 * Following Red-Green-Refactor methodology.
 *
 * Bead issue: aip-prsc
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Logger } from '../src/logger.js'
import { createSlackTransport } from '../src/transports/slack.js'
import type { SlackTransportConfig } from '../src/transports/slack.js'

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock logger for testing
 */
function createMockLogger(): Logger & {
  calls: {
    debug: Array<{ msg: string; meta?: object }>
    info: Array<{ msg: string; meta?: object }>
    warn: Array<{ msg: string; meta?: object }>
    error: Array<{ msg: string; error?: Error; meta?: object }>
  }
} {
  const calls = {
    debug: [] as Array<{ msg: string; meta?: object }>,
    info: [] as Array<{ msg: string; meta?: object }>,
    warn: [] as Array<{ msg: string; meta?: object }>,
    error: [] as Array<{ msg: string; error?: Error; meta?: object }>,
  }

  return {
    calls,
    debug(msg: string, meta?: object) {
      calls.debug.push({ msg, meta })
    },
    info(msg: string, meta?: object) {
      calls.info.push({ msg, meta })
    },
    warn(msg: string, meta?: object) {
      calls.warn.push({ msg, meta })
    },
    error(msg: string, error?: Error, meta?: object) {
      calls.error.push({ msg, error, meta })
    },
  }
}

// Test configuration
const testConfig: Omit<SlackTransportConfig, 'transport'> = {
  botToken: 'xoxb-test-token',
  signingSecret: 'test-signing-secret',
  apiUrl: 'https://slack.test/api',
}

// ============================================================================
// Slack Transport Error Logging Tests
// ============================================================================

describe('SlackTransport Error Logging', () => {
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockFetch: ReturnType<typeof vi.fn>
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockFetch = vi.fn()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('lookupUserByEmail', () => {
    it('should log error when API call throws', async () => {
      // Arrange: Make fetch throw an error
      const apiError = new Error('Network error')
      mockFetch.mockRejectedValue(apiError)

      const transport = createSlackTransport({
        ...testConfig,
        logger: mockLogger,
      })

      // Act
      const result = await transport.lookupUserByEmail('test@example.com')

      // Assert: Original behavior preserved
      expect(result).toBeNull()

      // Assert: Error was logged with context
      expect(mockLogger.calls.error.length).toBe(1)
      expect(mockLogger.calls.error[0].msg).toContain('lookupUserByEmail')
      expect(mockLogger.calls.error[0].error).toBe(apiError)
      expect(mockLogger.calls.error[0].meta).toMatchObject({
        email: 'test@example.com',
      })
    })

    it('should not log when no error occurs', async () => {
      // Arrange: Successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, user: { id: 'U123' } }),
      })

      const transport = createSlackTransport({
        ...testConfig,
        logger: mockLogger,
      })

      // Act
      const result = await transport.lookupUserByEmail('test@example.com')

      // Assert
      expect(result).toBe('U123')
      expect(mockLogger.calls.error.length).toBe(0)
    })

    it('should work without logger (backward compatibility)', async () => {
      // Arrange: Make fetch throw an error
      mockFetch.mockRejectedValue(new Error('Network error'))

      const transport = createSlackTransport(testConfig)

      // Act & Assert: Should not throw when no logger provided
      const result = await transport.lookupUserByEmail('test@example.com')
      expect(result).toBeNull()
    })
  })

  describe('parseWebhookPayload', () => {
    it('should log error when JSON parsing fails', () => {
      // Arrange
      const transport = createSlackTransport({
        ...testConfig,
        logger: mockLogger,
      })

      // Create invalid JSON payload
      const invalidRequest = {
        body: 'payload={invalid-json}',
        headers: {},
        timestamp: Date.now().toString(),
        signature: 'v0=invalid',
      }

      // Act
      const result = transport.parseWebhookPayloadForTesting(invalidRequest)

      // Assert: Original behavior preserved
      expect(result).toBeNull()

      // Assert: Error was logged
      expect(mockLogger.calls.error.length).toBe(1)
      expect(mockLogger.calls.error[0].msg).toContain('parseWebhookPayload')
      expect(mockLogger.calls.error[0].error).toBeInstanceOf(SyntaxError)
    })

    it('should not log when parsing succeeds', () => {
      // Arrange
      const transport = createSlackTransport({
        ...testConfig,
        logger: mockLogger,
      })

      const validPayload = { type: 'block_actions', user: { id: 'U123' } }
      const validRequest = {
        body: `payload=${encodeURIComponent(JSON.stringify(validPayload))}`,
        headers: {},
        timestamp: Date.now().toString(),
        signature: 'v0=test',
      }

      // Act
      const result = transport.parseWebhookPayloadForTesting(validRequest)

      // Assert
      expect(result).toEqual(validPayload)
      expect(mockLogger.calls.error.length).toBe(0)
    })

    it('should work without logger (backward compatibility)', () => {
      // Arrange
      const transport = createSlackTransport(testConfig)

      const invalidRequest = {
        body: 'payload={invalid-json}',
        headers: {},
        timestamp: Date.now().toString(),
        signature: 'v0=invalid',
      }

      // Act & Assert: Should not throw when no logger provided
      const result = transport.parseWebhookPayloadForTesting(invalidRequest)
      expect(result).toBeNull()
    })
  })

  describe('parseActionValue', () => {
    it('should log debug when JSON parsing fails (expected for string values)', () => {
      // Arrange
      const transport = createSlackTransport({
        ...testConfig,
        logger: mockLogger,
      })

      // Act: Parse a plain string (not JSON)
      const result = transport.parseActionValueForTesting('plain-string-value')

      // Assert: Original behavior preserved (returns original value)
      expect(result).toBe('plain-string-value')

      // Assert: Debug was logged (this is expected behavior, not an error)
      expect(mockLogger.calls.debug.length).toBe(1)
      expect(mockLogger.calls.debug[0].msg).toContain('parseActionValue')
    })

    it('should not log when JSON parsing succeeds', () => {
      // Arrange
      const transport = createSlackTransport({
        ...testConfig,
        logger: mockLogger,
      })

      const jsonValue = { action: 'approve', data: 123 }

      // Act
      const result = transport.parseActionValueForTesting(JSON.stringify(jsonValue))

      // Assert
      expect(result).toEqual(jsonValue)
      expect(mockLogger.calls.debug.length).toBe(0)
    })
  })
})

// ============================================================================
// Logger Interface Tests
// ============================================================================

describe('Logger Interface', () => {
  it('should define all required log levels', async () => {
    // Import the Logger interface and verify it has all required methods
    const { Logger } = await import('../src/logger.js')

    // This test verifies the interface exists - actual type checking is done by TypeScript
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    // Verify methods are callable
    mockLogger.debug('test debug')
    mockLogger.info('test info', { key: 'value' })
    mockLogger.warn('test warn')
    mockLogger.error('test error', new Error('test'), { context: 'test' })

    expect(mockLogger.debug).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledTimes(1)
    expect(mockLogger.warn).toHaveBeenCalledTimes(1)
    expect(mockLogger.error).toHaveBeenCalledTimes(1)
  })

  it('should allow optional meta parameter', async () => {
    const { Logger } = await import('../src/logger.js')

    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    // All methods should work without meta
    mockLogger.debug('no meta')
    mockLogger.info('no meta')
    mockLogger.warn('no meta')
    mockLogger.error('no meta')

    // Error method should work with error but no meta
    mockLogger.error('with error', new Error('test'))

    expect(mockLogger.debug).toHaveBeenCalledWith('no meta')
    expect(mockLogger.error).toHaveBeenCalledWith('with error', new Error('test'))
  })
})

// ============================================================================
// Error Context Preservation Tests
// ============================================================================

describe('Error Context Preservation', () => {
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockFetch: ReturnType<typeof vi.fn>
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockFetch = vi.fn()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should preserve error stack trace', async () => {
    // Arrange
    const apiError = new Error('API failure')
    mockFetch.mockRejectedValue(apiError)

    const transport = createSlackTransport({
      ...testConfig,
      logger: mockLogger,
    })

    // Act
    await transport.lookupUserByEmail('test@example.com')

    // Assert: Error object with stack trace is passed to logger
    const loggedError = mockLogger.calls.error[0].error
    expect(loggedError).toBe(apiError)
    expect(loggedError?.stack).toBeDefined()
  })

  it('should include operation context in log metadata', async () => {
    // Arrange
    mockFetch.mockRejectedValue(new Error('Network error'))

    const transport = createSlackTransport({
      ...testConfig,
      logger: mockLogger,
    })

    // Act
    await transport.lookupUserByEmail('user@example.com')

    // Assert: Context metadata is included
    const meta = mockLogger.calls.error[0].meta
    expect(meta).toMatchObject({
      email: 'user@example.com',
      operation: 'lookupUserByEmail',
    })
  })
})
