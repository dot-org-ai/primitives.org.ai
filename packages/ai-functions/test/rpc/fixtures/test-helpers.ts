/**
 * Test helpers and utilities for RPC transport testing
 */

import type { Transport, RPCMessage } from '../../../src/rpc/transport.js'

// =============================================================================
// Runtime Detection
// =============================================================================

declare const Bun: unknown
declare const caches: unknown

export const runtime = {
  /** Running in Node.js */
  isNode: typeof process !== 'undefined' && !!(process as any).versions?.node,
  /** Running in Bun */
  isBun: typeof Bun !== 'undefined',
  /** Running in Cloudflare Workers */
  isWorkers: typeof caches !== 'undefined' && typeof (globalThis as any).window === 'undefined',
  /** Running in a browser */
  isBrowser: typeof window !== 'undefined' && typeof document !== 'undefined',
}

export type Runtime = 'node' | 'bun' | 'workers' | 'browser' | 'unknown'

/**
 * Get the current runtime
 */
export function getCurrentRuntime(): Runtime {
  if (runtime.isBun) return 'bun'
  if (runtime.isNode) return 'node'
  if (runtime.isWorkers) return 'workers'
  if (runtime.isBrowser) return 'browser'
  return 'unknown'
}

/**
 * Skip test if running in specified runtime(s)
 */
export function skipIfRuntime(...runtimes: Runtime[]): boolean {
  return runtimes.includes(getCurrentRuntime())
}

/**
 * Only run test if running in specified runtime(s)
 */
export function onlyIfRuntime(...runtimes: Runtime[]): boolean {
  return !runtimes.includes(getCurrentRuntime())
}

// =============================================================================
// Test Context
// =============================================================================

export interface TransportTestContext {
  /** The transport under test */
  transport: Transport
  /** Base URL for HTTP requests */
  httpUrl?: string
  /** WebSocket URL */
  wsUrl?: string
  /** Cleanup function */
  cleanup: () => Promise<void>
}

/**
 * Factory function type for creating transport test contexts
 */
export type TransportContextFactory = () => Promise<TransportTestContext>

// =============================================================================
// Message Helpers
// =============================================================================

let messageIdCounter = 0

/**
 * Generate a unique message ID for tests
 */
export function generateTestMessageId(): string {
  return `test-${++messageIdCounter}-${Date.now().toString(36)}`
}

/**
 * Reset message ID counter (for test isolation)
 */
export function resetMessageIdCounter(): void {
  messageIdCounter = 0
}

/**
 * Create an RPC call message
 */
export function createCallMessage(
  method: string,
  params: unknown[] = [],
  id?: string
): RPCMessage {
  return {
    id: id ?? generateTestMessageId(),
    type: 'call',
    method,
    params,
  }
}

/**
 * Create an RPC result message
 */
export function createResultMessage(id: string, result: unknown): RPCMessage {
  return {
    id,
    type: 'result',
    result,
  }
}

/**
 * Create an RPC error message
 */
export function createErrorMessage(
  id: string,
  message: string,
  code?: string
): RPCMessage {
  return {
    id,
    type: 'error',
    error: { message, code },
  }
}

// =============================================================================
// Timing Helpers
// =============================================================================

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 10 } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) return
    await wait(interval)
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  return { result, duration }
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that a promise rejects with an error matching the message
 */
export async function expectReject(
  promise: Promise<unknown>,
  messagePattern?: string | RegExp
): Promise<Error> {
  try {
    await promise
    throw new Error('Expected promise to reject but it resolved')
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error(`Expected Error but got: ${typeof error}`)
    }
    if (messagePattern) {
      const matches =
        typeof messagePattern === 'string'
          ? error.message.includes(messagePattern)
          : messagePattern.test(error.message)
      if (!matches) {
        throw new Error(
          `Expected error message to match "${messagePattern}" but got "${error.message}"`
        )
      }
    }
    return error
  }
}

/**
 * Assert that an async iterator yields expected values
 */
export async function expectIteratorValues<T>(
  iterator: AsyncIterable<T>,
  expected: T[]
): Promise<void> {
  const actual: T[] = []
  for await (const value of iterator) {
    actual.push(value)
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Iterator values mismatch.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    )
  }
}

// =============================================================================
// Port Helpers
// =============================================================================

/**
 * Find an available port (Node.js/Bun only)
 */
export async function findAvailablePort(startPort = 3000): Promise<number> {
  if (runtime.isWorkers) {
    throw new Error('findAvailablePort not available in Workers')
  }

  // Dynamic import to avoid bundling issues
  const net = await import('net')

  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Could not get port')))
      }
    })
    server.on('error', reject)
  })
}
