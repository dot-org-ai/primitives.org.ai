/**
 * Runtime type guards for JSON response validation
 */

import type { EvaluateResult, LogEntry, TestResults, TestResult } from './types.js'

/**
 * Check if a value is a valid LogEntry
 */
function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check level is one of the allowed values
  const validLevels = ['log', 'warn', 'error', 'info', 'debug']
  if (typeof obj.level !== 'string' || !validLevels.includes(obj.level)) {
    return false
  }

  // Check message is a string
  if (typeof obj.message !== 'string') {
    return false
  }

  // Check timestamp is a number
  if (typeof obj.timestamp !== 'number') {
    return false
  }

  return true
}

/**
 * Check if a value is a valid TestResult
 */
function isTestResult(value: unknown): value is TestResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check required fields
  if (typeof obj.name !== 'string') {
    return false
  }

  if (typeof obj.passed !== 'boolean') {
    return false
  }

  if (typeof obj.duration !== 'number') {
    return false
  }

  // Check optional error field
  if (obj.error !== undefined && typeof obj.error !== 'string') {
    return false
  }

  return true
}

/**
 * Check if a value is a valid TestResults
 */
function isTestResults(value: unknown): value is TestResults {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check required numeric fields
  if (typeof obj.total !== 'number') {
    return false
  }

  if (typeof obj.passed !== 'number') {
    return false
  }

  if (typeof obj.failed !== 'number') {
    return false
  }

  if (typeof obj.skipped !== 'number') {
    return false
  }

  if (typeof obj.duration !== 'number') {
    return false
  }

  // Check tests array
  if (!Array.isArray(obj.tests)) {
    return false
  }

  for (const test of obj.tests) {
    if (!isTestResult(test)) {
      return false
    }
  }

  return true
}

/**
 * Type guard to check if a value is a valid EvaluateResult
 *
 * Validates all required fields: success, duration, logs
 *
 * @param value - The value to check
 * @returns True if the value is a valid EvaluateResult
 */
export function isEvaluateResult(value: unknown): value is EvaluateResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check required fields
  if (typeof obj.success !== 'boolean') {
    return false
  }

  if (typeof obj.duration !== 'number') {
    return false
  }

  // Check logs is an array of valid LogEntry objects
  if (!Array.isArray(obj.logs)) {
    return false
  }

  for (const log of obj.logs) {
    if (!isLogEntry(log)) {
      return false
    }
  }

  // Check optional fields have correct types if present
  if (obj.error !== undefined && typeof obj.error !== 'string') {
    return false
  }

  if (obj.testResults !== undefined && !isTestResults(obj.testResults)) {
    return false
  }

  // value can be any type, so no validation needed for it

  return true
}

/**
 * Assertion function that throws a descriptive error if the value is not a valid EvaluateResult
 *
 * @param value - The value to validate
 * @throws Error with descriptive message if validation fails
 */
export function assertEvaluateResult(value: unknown): asserts value is EvaluateResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      `Invalid EvaluateResult: expected object, got ${value === null ? 'null' : typeof value}`
    )
  }

  const obj = value as Record<string, unknown>

  // Validate required field: success
  if (typeof obj.success !== 'boolean') {
    throw new Error(
      `Invalid EvaluateResult: 'success' must be a boolean, got ${typeof obj.success}`
    )
  }

  // Validate required field: duration
  if (typeof obj.duration !== 'number') {
    throw new Error(
      `Invalid EvaluateResult: 'duration' must be a number, got ${typeof obj.duration}`
    )
  }

  // Validate required field: logs
  if (!Array.isArray(obj.logs)) {
    throw new Error(`Invalid EvaluateResult: 'logs' must be an array, got ${typeof obj.logs}`)
  }

  // Validate each log entry
  for (let i = 0; i < obj.logs.length; i++) {
    const log = obj.logs[i]
    if (typeof log !== 'object' || log === null) {
      throw new Error(
        `Invalid EvaluateResult: logs[${i}] must be an object, got ${
          log === null ? 'null' : typeof log
        }`
      )
    }

    const logObj = log as Record<string, unknown>
    const validLevels = ['log', 'warn', 'error', 'info', 'debug']

    if (typeof logObj.level !== 'string' || !validLevels.includes(logObj.level)) {
      throw new Error(
        `Invalid EvaluateResult: logs[${i}].level must be one of ${validLevels.join(', ')}, got '${
          logObj.level
        }'`
      )
    }

    if (typeof logObj.message !== 'string') {
      throw new Error(
        `Invalid EvaluateResult: logs[${i}].message must be a string, got ${typeof logObj.message}`
      )
    }

    if (typeof logObj.timestamp !== 'number') {
      throw new Error(
        `Invalid EvaluateResult: logs[${i}].timestamp must be a number, got ${typeof logObj.timestamp}`
      )
    }
  }

  // Validate optional field: error
  if (obj.error !== undefined && typeof obj.error !== 'string') {
    throw new Error(
      `Invalid EvaluateResult: 'error' must be a string if present, got ${typeof obj.error}`
    )
  }

  // Validate optional field: testResults
  if (obj.testResults !== undefined) {
    if (typeof obj.testResults !== 'object' || obj.testResults === null) {
      throw new Error(
        `Invalid EvaluateResult: 'testResults' must be an object if present, got ${
          obj.testResults === null ? 'null' : typeof obj.testResults
        }`
      )
    }

    const testResults = obj.testResults as Record<string, unknown>

    if (typeof testResults.total !== 'number') {
      throw new Error(
        `Invalid EvaluateResult: testResults.total must be a number, got ${typeof testResults.total}`
      )
    }

    if (typeof testResults.passed !== 'number') {
      throw new Error(
        `Invalid EvaluateResult: testResults.passed must be a number, got ${typeof testResults.passed}`
      )
    }

    if (typeof testResults.failed !== 'number') {
      throw new Error(
        `Invalid EvaluateResult: testResults.failed must be a number, got ${typeof testResults.failed}`
      )
    }

    if (typeof testResults.skipped !== 'number') {
      throw new Error(
        `Invalid EvaluateResult: testResults.skipped must be a number, got ${typeof testResults.skipped}`
      )
    }

    if (typeof testResults.duration !== 'number') {
      throw new Error(
        `Invalid EvaluateResult: testResults.duration must be a number, got ${typeof testResults.duration}`
      )
    }

    if (!Array.isArray(testResults.tests)) {
      throw new Error(
        `Invalid EvaluateResult: testResults.tests must be an array, got ${typeof testResults.tests}`
      )
    }

    // Validate each test result
    for (let i = 0; i < testResults.tests.length; i++) {
      const test = testResults.tests[i]
      if (typeof test !== 'object' || test === null) {
        throw new Error(
          `Invalid EvaluateResult: testResults.tests[${i}] must be an object, got ${
            test === null ? 'null' : typeof test
          }`
        )
      }

      const testObj = test as Record<string, unknown>

      if (typeof testObj.name !== 'string') {
        throw new Error(
          `Invalid EvaluateResult: testResults.tests[${i}].name must be a string, got ${typeof testObj.name}`
        )
      }

      if (typeof testObj.passed !== 'boolean') {
        throw new Error(
          `Invalid EvaluateResult: testResults.tests[${i}].passed must be a boolean, got ${typeof testObj.passed}`
        )
      }

      if (typeof testObj.duration !== 'number') {
        throw new Error(
          `Invalid EvaluateResult: testResults.tests[${i}].duration must be a number, got ${typeof testObj.duration}`
        )
      }

      if (testObj.error !== undefined && typeof testObj.error !== 'string') {
        throw new Error(
          `Invalid EvaluateResult: testResults.tests[${i}].error must be a string if present, got ${typeof testObj.error}`
        )
      }
    }
  }
}
