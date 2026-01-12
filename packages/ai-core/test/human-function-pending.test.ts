/**
 * Tests for HumanFunctionPending type guard
 *
 * Tests the isPendingHumanResult() type guard that identifies pending human
 * function results. This is critical for type-safe handling of human-in-the-loop
 * functions that may return placeholder results.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import {
  isPendingHumanResult,
  HumanFunctionPending,
  PENDING_HUMAN_RESULT_SYMBOL,
  type HumanChannel,
} from '../src/index.js'

describe('isPendingHumanResult type guard', () => {
  describe('positive cases - should return true', () => {
    it('returns true for a valid HumanFunctionPending object', () => {
      const pending: HumanFunctionPending = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'web',
        artifacts: { form: 'approval-form' },
        expectedResponseType: { approved: 'boolean' },
      }

      expect(isPendingHumanResult(pending)).toBe(true)
    })

    it('returns true for all valid channel types', () => {
      const channels: HumanChannel[] = ['chat', 'email', 'phone', 'sms', 'workspace', 'web']

      for (const channel of channels) {
        const pending: HumanFunctionPending = {
          [PENDING_HUMAN_RESULT_SYMBOL]: true,
          _pending: true,
          channel,
          artifacts: {},
          expectedResponseType: {},
        }

        expect(isPendingHumanResult(pending)).toBe(true)
      }
    })

    it('returns true with complex artifacts', () => {
      const pending: HumanFunctionPending = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'email',
        artifacts: {
          subject: 'Approval Required',
          html: '<h1>Please approve</h1>',
          text: 'Please approve',
        },
        expectedResponseType: {
          approved: 'boolean',
          reason: 'string',
        },
      }

      expect(isPendingHumanResult(pending)).toBe(true)
    })

    it('returns true with typed expected response', () => {
      interface ApprovalResponse {
        approved: boolean
        reason?: string
        timestamp: number
      }

      const pending: HumanFunctionPending<ApprovalResponse> = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'workspace',
        artifacts: { blocks: [] },
        expectedResponseType: {
          approved: true,
          reason: 'Looks good',
          timestamp: Date.now(),
        },
      }

      expect(isPendingHumanResult(pending)).toBe(true)
    })
  })

  describe('negative cases - should return false', () => {
    it('returns false for null', () => {
      expect(isPendingHumanResult(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isPendingHumanResult(undefined)).toBe(false)
    })

    it('returns false for primitive types', () => {
      expect(isPendingHumanResult('string')).toBe(false)
      expect(isPendingHumanResult(123)).toBe(false)
      expect(isPendingHumanResult(true)).toBe(false)
      expect(isPendingHumanResult(false)).toBe(false)
      expect(isPendingHumanResult(Symbol('test'))).toBe(false)
      expect(isPendingHumanResult(BigInt(123))).toBe(false)
    })

    it('returns false for empty object', () => {
      expect(isPendingHumanResult({})).toBe(false)
    })

    it('returns false for arrays', () => {
      expect(isPendingHumanResult([])).toBe(false)
      expect(isPendingHumanResult([1, 2, 3])).toBe(false)
    })

    it('returns false for functions', () => {
      expect(isPendingHumanResult(() => {})).toBe(false)
      expect(isPendingHumanResult(function() {})).toBe(false)
    })

    it('returns false for Date objects', () => {
      expect(isPendingHumanResult(new Date())).toBe(false)
    })

    it('returns false for regular business objects', () => {
      const approval = {
        approved: true,
        reason: 'Looks correct',
        reviewedBy: 'john@example.com',
      }

      expect(isPendingHumanResult(approval)).toBe(false)
    })

    it('returns false for objects with only _pending flag', () => {
      const partialPending = {
        _pending: true,
        channel: 'web',
      }

      expect(isPendingHumanResult(partialPending)).toBe(false)
    })

    it('returns false for objects with _pending set to false', () => {
      const notPending = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: false, // Not pending
        channel: 'web' as HumanChannel,
        artifacts: {},
        expectedResponseType: {},
      }

      expect(isPendingHumanResult(notPending)).toBe(false)
    })

    it('returns false for objects without the symbol marker', () => {
      const missingSymbol = {
        _pending: true,
        channel: 'web' as HumanChannel,
        artifacts: {},
        expectedResponseType: {},
      }

      expect(isPendingHumanResult(missingSymbol)).toBe(false)
    })
  })

  describe('type narrowing behavior', () => {
    it('narrows type correctly in conditional', () => {
      interface ApprovalResult {
        approved: boolean
        amount: number
      }

      const result: ApprovalResult | HumanFunctionPending<ApprovalResult> = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'web',
        artifacts: {},
        expectedResponseType: { approved: true, amount: 100 },
      }

      if (isPendingHumanResult(result)) {
        // TypeScript should know result is HumanFunctionPending here
        expect(result.channel).toBe('web')
        expect(result._pending).toBe(true)
        expect(result.artifacts).toBeDefined()
      } else {
        // TypeScript should know result is ApprovalResult here
        // This branch won't execute in this test
        expect(result.approved).toBeDefined()
      }
    })

    it('allows access to channel property after narrowing', () => {
      const maybeResult: unknown = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'email',
        artifacts: { subject: 'Test' },
        expectedResponseType: {},
      }

      if (isPendingHumanResult(maybeResult)) {
        // After type narrowing, we can safely access properties
        expect(maybeResult.channel).toBe('email')
        expect(maybeResult.artifacts).toEqual({ subject: 'Test' })
      }
    })

    it('enables handling both pending and completed states', () => {
      interface ReviewResult {
        status: 'approved' | 'rejected'
        comments: string
      }

      function handleResult(result: ReviewResult | HumanFunctionPending<ReviewResult>): string {
        if (isPendingHumanResult(result)) {
          return `Awaiting review via ${result.channel}`
        }
        return `Review ${result.status}: ${result.comments}`
      }

      const pending: HumanFunctionPending<ReviewResult> = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'workspace',
        artifacts: {},
        expectedResponseType: { status: 'approved', comments: '' },
      }

      const completed: ReviewResult = {
        status: 'approved',
        comments: 'Looks good!',
      }

      expect(handleResult(pending)).toBe('Awaiting review via workspace')
      expect(handleResult(completed)).toBe('Review approved: Looks good!')
    })
  })

  describe('edge cases', () => {
    it('handles objects with extra properties', () => {
      const pendingWithExtras = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'web' as HumanChannel,
        artifacts: {},
        expectedResponseType: {},
        extraProperty: 'should be ignored',
        anotherExtra: 123,
      }

      expect(isPendingHumanResult(pendingWithExtras)).toBe(true)
    })

    it('handles frozen objects', () => {
      const frozen = Object.freeze({
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'chat' as HumanChannel,
        artifacts: {},
        expectedResponseType: {},
      })

      expect(isPendingHumanResult(frozen)).toBe(true)
    })

    it('handles sealed objects', () => {
      const sealed = Object.seal({
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'sms' as HumanChannel,
        artifacts: {},
        expectedResponseType: {},
      })

      expect(isPendingHumanResult(sealed)).toBe(true)
    })

    it('returns false for objects created by Object.create(null)', () => {
      const nullPrototype = Object.create(null)
      nullPrototype._pending = true
      // Cannot add symbol to null-prototype objects in the same way
      // This tests robustness

      expect(isPendingHumanResult(nullPrototype)).toBe(false)
    })

    it('works correctly with Symbol.for consistency', () => {
      // Symbol.for creates a global symbol registry entry
      // This ensures the same symbol is used across module boundaries
      const symbolFromFor = Symbol.for('HumanFunctionPending')

      const pending = {
        [symbolFromFor]: true,
        _pending: true,
        channel: 'phone' as HumanChannel,
        artifacts: {},
        expectedResponseType: {},
      }

      // Should work because Symbol.for returns the same symbol
      expect(isPendingHumanResult(pending)).toBe(true)
    })
  })

  describe('exports', () => {
    it('exports isPendingHumanResult function', async () => {
      const aiCore = await import('../src/index.js')
      expect(aiCore.isPendingHumanResult).toBeDefined()
      expect(typeof aiCore.isPendingHumanResult).toBe('function')
    })

    it('exports HumanFunctionPending type (verified by compile)', async () => {
      // TypeScript compile-time check - if this compiles, the type exists
      const pending: HumanFunctionPending = {
        [PENDING_HUMAN_RESULT_SYMBOL]: true,
        _pending: true,
        channel: 'web',
        artifacts: {},
        expectedResponseType: {},
      }
      expect(pending).toBeDefined()
    })

    it('exports PENDING_HUMAN_RESULT_SYMBOL', async () => {
      const aiCore = await import('../src/index.js')
      expect(aiCore.PENDING_HUMAN_RESULT_SYMBOL).toBeDefined()
      expect(typeof aiCore.PENDING_HUMAN_RESULT_SYMBOL).toBe('symbol')
    })
  })
})
