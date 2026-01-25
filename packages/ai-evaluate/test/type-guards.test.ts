import { describe, it, expect } from 'vitest'
import { isEvaluateResult, assertEvaluateResult } from '../src/type-guards.js'

describe('type guards', () => {
  describe('isEvaluateResult', () => {
    it('returns true for valid EvaluateResult', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
      }
      expect(isEvaluateResult(result)).toBe(true)
    })

    it('returns true for valid EvaluateResult with value', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
        value: 42,
      }
      expect(isEvaluateResult(result)).toBe(true)
    })

    it('returns true for valid EvaluateResult with error', () => {
      const result = {
        success: false,
        duration: 100,
        logs: [],
        error: 'Something went wrong',
      }
      expect(isEvaluateResult(result)).toBe(true)
    })

    it('returns true for valid EvaluateResult with logs', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [
          { level: 'log' as const, message: 'hello', timestamp: 1234567890 },
          { level: 'error' as const, message: 'oops', timestamp: 1234567891 },
        ],
      }
      expect(isEvaluateResult(result)).toBe(true)
    })

    it('returns true for valid EvaluateResult with testResults', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
        testResults: {
          total: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          duration: 50,
          tests: [
            { name: 'test1', passed: true, duration: 25 },
            { name: 'test2', passed: false, duration: 25, error: 'failed' },
          ],
        },
      }
      expect(isEvaluateResult(result)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isEvaluateResult(null)).toBe(false)
    })

    it('returns false for non-object', () => {
      expect(isEvaluateResult('string')).toBe(false)
      expect(isEvaluateResult(123)).toBe(false)
      expect(isEvaluateResult(undefined)).toBe(false)
    })

    it('returns false for missing success', () => {
      const result = {
        duration: 100,
        logs: [],
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for missing duration', () => {
      const result = {
        success: true,
        logs: [],
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for missing logs', () => {
      const result = {
        success: true,
        duration: 100,
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for wrong type success', () => {
      const result = {
        success: 'true',
        duration: 100,
        logs: [],
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for wrong type duration', () => {
      const result = {
        success: true,
        duration: '100',
        logs: [],
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for logs not being array', () => {
      const result = {
        success: true,
        duration: 100,
        logs: {},
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for invalid log entry', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [{ level: 'invalid', message: 'hello', timestamp: 1234 }],
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for error being wrong type', () => {
      const result = {
        success: false,
        duration: 100,
        logs: [],
        error: 123,
      }
      expect(isEvaluateResult(result)).toBe(false)
    })

    it('returns false for invalid testResults', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
        testResults: {
          total: 'not a number',
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          tests: [],
        },
      }
      expect(isEvaluateResult(result)).toBe(false)
    })
  })

  describe('assertEvaluateResult', () => {
    it('does not throw for valid EvaluateResult', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
      }
      expect(() => assertEvaluateResult(result)).not.toThrow()
    })

    it('throws for null', () => {
      expect(() => assertEvaluateResult(null)).toThrow(
        'Invalid EvaluateResult: expected object, got null'
      )
    })

    it('throws for non-object', () => {
      expect(() => assertEvaluateResult('string')).toThrow(
        'Invalid EvaluateResult: expected object, got string'
      )
    })

    it('throws for missing success', () => {
      const result = { duration: 100, logs: [] }
      expect(() => assertEvaluateResult(result)).toThrow(
        "Invalid EvaluateResult: 'success' must be a boolean, got undefined"
      )
    })

    it('throws for missing duration', () => {
      const result = { success: true, logs: [] }
      expect(() => assertEvaluateResult(result)).toThrow(
        "Invalid EvaluateResult: 'duration' must be a number, got undefined"
      )
    })

    it('throws for missing logs', () => {
      const result = { success: true, duration: 100 }
      expect(() => assertEvaluateResult(result)).toThrow(
        "Invalid EvaluateResult: 'logs' must be an array, got undefined"
      )
    })

    it('throws for invalid log entry level', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [{ level: 'invalid', message: 'hello', timestamp: 1234 }],
      }
      expect(() => assertEvaluateResult(result)).toThrow(
        'Invalid EvaluateResult: logs[0].level must be one of log, warn, error, info, debug'
      )
    })

    it('throws for invalid log entry message', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [{ level: 'log', message: 123, timestamp: 1234 }],
      }
      expect(() => assertEvaluateResult(result)).toThrow(
        'Invalid EvaluateResult: logs[0].message must be a string'
      )
    })

    it('throws for invalid log entry timestamp', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [{ level: 'log', message: 'hello', timestamp: 'not a number' }],
      }
      expect(() => assertEvaluateResult(result)).toThrow(
        'Invalid EvaluateResult: logs[0].timestamp must be a number'
      )
    })

    it('throws for invalid error type', () => {
      const result = {
        success: false,
        duration: 100,
        logs: [],
        error: 123,
      }
      expect(() => assertEvaluateResult(result)).toThrow(
        "Invalid EvaluateResult: 'error' must be a string if present"
      )
    })

    it('throws for invalid testResults.total', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
        testResults: {
          total: 'not a number',
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          tests: [],
        },
      }
      expect(() => assertEvaluateResult(result)).toThrow(
        'Invalid EvaluateResult: testResults.total must be a number'
      )
    })

    it('throws for invalid test result', () => {
      const result = {
        success: true,
        duration: 100,
        logs: [],
        testResults: {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 50,
          tests: [{ name: 'test1', passed: 'not a boolean', duration: 25 }],
        },
      }
      expect(() => assertEvaluateResult(result)).toThrow(
        'Invalid EvaluateResult: testResults.tests[0].passed must be a boolean'
      )
    })

    it('validates all log level types', () => {
      const levels = ['log', 'warn', 'error', 'info', 'debug'] as const
      for (const level of levels) {
        const result = {
          success: true,
          duration: 100,
          logs: [{ level, message: 'test', timestamp: 1234 }],
        }
        expect(() => assertEvaluateResult(result)).not.toThrow()
      }
    })
  })
})
