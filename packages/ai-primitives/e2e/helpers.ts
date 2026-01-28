/**
 * E2E Test Helpers
 *
 * Common assertion helpers and utilities used across all test suites.
 * These are environment-agnostic and work with any test runner.
 *
 * @packageDocumentation
 */

import type { RPCClient, EntityResult, Thing, Action } from './types.js'

/**
 * Generate a unique test ID to prevent collisions between test runs
 */
export function testId(prefix: string = 'e2e'): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Generate a unique namespace for test isolation
 */
export function testNamespace(): string {
  return testId('ns')
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    backoffMultiplier?: number
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options

  let lastError: unknown
  let currentDelay = delayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries && shouldRetry(error)) {
        await sleep(currentDelay)
        currentDelay *= backoffMultiplier
      }
    }
  }

  throw lastError
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined')
  }
}

/**
 * Assert that two values are equal
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    )
  }
}

/**
 * Assert that a value is truthy
 */
export function assertTrue(value: unknown, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected truthy value but got ${JSON.stringify(value)}`)
  }
}

/**
 * Assert that a value is falsy
 */
export function assertFalse(value: unknown, message?: string): void {
  if (value) {
    throw new Error(message || `Expected falsy value but got ${JSON.stringify(value)}`)
  }
}

/**
 * Assert that an array has a specific length
 */
export function assertLength(arr: unknown[], expected: number, message?: string): void {
  if (arr.length !== expected) {
    throw new Error(message || `Expected array length ${expected} but got ${arr.length}`)
  }
}

/**
 * Assert that an array is not empty
 */
export function assertNotEmpty(arr: unknown[], message?: string): void {
  if (arr.length === 0) {
    throw new Error(message || 'Expected non-empty array')
  }
}

/**
 * Assert that an operation throws an error
 */
export async function assertThrows(
  fn: () => Promise<unknown>,
  messagePattern?: RegExp | string
): Promise<void> {
  try {
    await fn()
    throw new Error('Expected function to throw but it did not')
  } catch (error) {
    if (error instanceof Error && error.message === 'Expected function to throw but it did not') {
      throw error
    }
    if (messagePattern) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (typeof messagePattern === 'string') {
        if (!errorMessage.includes(messagePattern)) {
          throw new Error(
            `Expected error message to contain "${messagePattern}" but got "${errorMessage}"`
          )
        }
      } else {
        if (!messagePattern.test(errorMessage)) {
          throw new Error(
            `Expected error message to match ${messagePattern} but got "${errorMessage}"`
          )
        }
      }
    }
  }
}

/**
 * Assert that a value contains specified properties
 */
export function assertContains(
  obj: Record<string, unknown>,
  expected: Record<string, unknown>,
  message?: string
): void {
  for (const [key, value] of Object.entries(expected)) {
    if (obj[key] !== value) {
      throw new Error(
        message ||
          `Expected property "${key}" to be ${JSON.stringify(value)} but got ${JSON.stringify(
            obj[key]
          )}`
      )
    }
  }
}

/**
 * Assert that a value has a specific type
 */
export function assertType(value: unknown, expectedType: string, message?: string): void {
  const actualType = typeof value
  if (actualType !== expectedType) {
    throw new Error(message || `Expected type "${expectedType}" but got "${actualType}"`)
  }
}

/**
 * Assert deep equality
 */
export function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  const actualStr = JSON.stringify(actual, null, 2)
  const expectedStr = JSON.stringify(expected, null, 2)
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Deep equality assertion failed:\nExpected: ${expectedStr}\nActual: ${actualStr}`
    )
  }
}

/**
 * Assert that an array includes a value
 */
export function assertIncludes<T>(arr: T[], value: T, message?: string): void {
  if (!arr.includes(value)) {
    throw new Error(message || `Expected array to include ${JSON.stringify(value)}`)
  }
}

/**
 * Assert that a number is greater than another
 */
export function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(message || `Expected ${actual} to be greater than ${expected}`)
  }
}

/**
 * Assert that a number is greater than or equal to another
 */
export function assertGreaterThanOrEqual(actual: number, expected: number, message?: string): void {
  if (actual < expected) {
    throw new Error(message || `Expected ${actual} to be greater than or equal to ${expected}`)
  }
}
