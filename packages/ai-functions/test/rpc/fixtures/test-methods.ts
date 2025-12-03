/**
 * Test RPC methods for transport testing
 *
 * These methods cover various scenarios:
 * - Basic request/response (echo, add)
 * - Error handling (throwError)
 * - Async operations (delay)
 * - Stateful operations (counter)
 * - Callbacks (withCallback)
 * - Streaming (streamNumbers)
 * - Nested objects (getUser) for promise pipelining
 */

import type { RPCMethods } from '../../../src/rpc/server.js'

export interface TestContext {
  requestId?: string
}

/**
 * Simple echo - returns the input value
 */
export function echo(_ctx: TestContext, value: unknown): unknown {
  return value
}

/**
 * Add two numbers
 */
export function add(_ctx: TestContext, a: number, b: number): number {
  return a + b
}

/**
 * Multiply two numbers
 */
export function multiply(_ctx: TestContext, a: number, b: number): number {
  return a * b
}

/**
 * Throw an error with the given message
 */
export function throwError(_ctx: TestContext, message: string): never {
  throw new Error(message)
}

/**
 * Delay and return a value
 */
export async function delay(
  _ctx: TestContext,
  ms: number,
  value: unknown
): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return value
}

/**
 * Counter that increments on each call (stateful)
 */
let counterValue = 0
export function counter(_ctx: TestContext): number {
  return ++counterValue
}

/**
 * Reset the counter (for test isolation)
 */
export function resetCounter(_ctx: TestContext): void {
  counterValue = 0
}

/**
 * Execute a callback with a value
 */
export async function withCallback(
  _ctx: TestContext,
  value: number,
  callback: (n: number) => number | Promise<number>
): Promise<number> {
  const result = await callback(value)
  return result * 2
}

/**
 * Generate a stream of numbers
 */
export async function* streamNumbers(
  _ctx: TestContext,
  count: number,
  delayMs = 0
): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    yield i
  }
}

/**
 * Get user object (for complex data tests)
 * Note: Only returns serializable data - no functions
 */
export function getUser(_ctx: TestContext, id: string) {
  return {
    id,
    name: `User ${id}`,
    profile: {
      email: `user${id}@example.com`,
      avatar: `https://example.com/avatars/${id}.png`,
      settings: {
        theme: 'dark',
        notifications: true,
      },
    },
  }
}

/**
 * Get multiple items (for array pipelining tests)
 */
export function getItems(_ctx: TestContext, ids: string[]) {
  return ids.map((id) => ({
    id,
    name: `Item ${id}`,
    price: parseInt(id, 10) * 10,
  }))
}

/**
 * Combined test methods object
 */
export const testMethods: RPCMethods<TestContext> = {
  echo,
  add,
  multiply,
  throwError,
  delay,
  counter,
  resetCounter,
  withCallback,
  streamNumbers,
  getUser,
  getItems,
}

/**
 * Reset all stateful test methods
 */
export function resetTestState(): void {
  counterValue = 0
}
