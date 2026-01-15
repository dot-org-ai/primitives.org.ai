/**
 * Relation Operator Constants Tests
 *
 * Tests for RelationOperator constant object that replaces magic strings.
 *
 * Issue: aip-f140 (RED), aip-tdg0 (GREEN)
 */

import { describe, it, expect } from 'vitest'
import { RelationOperator, type RelationOperatorType } from '../src/index.js'

describe('RelationOperator constants', () => {
  describe('export', () => {
    it('should export RelationOperator constant object', () => {
      expect(RelationOperator).toBeDefined()
      expect(typeof RelationOperator).toBe('object')
    })
  })

  describe('forward operators', () => {
    it('should have FORWARD_EXACT equal to "->"', () => {
      expect(RelationOperator.FORWARD_EXACT).toBe('->')
    })

    it('should have FORWARD_FUZZY equal to "~>"', () => {
      expect(RelationOperator.FORWARD_FUZZY).toBe('~>')
    })
  })

  describe('backward operators', () => {
    it('should have BACKWARD_EXACT equal to "<-"', () => {
      expect(RelationOperator.BACKWARD_EXACT).toBe('<-')
    })

    it('should have BACKWARD_FUZZY equal to "<~"', () => {
      expect(RelationOperator.BACKWARD_FUZZY).toBe('<~')
    })
  })

  describe('type safety', () => {
    it('should be readonly (const assertion)', () => {
      // TypeScript compile-time check: attempting to modify should fail
      // @ts-expect-error - RelationOperator should be readonly
      // This line is just for documentation - it won't run at runtime
      // RelationOperator.FORWARD_EXACT = '->'

      // Runtime check: verify the object has all expected properties
      const operators = Object.keys(RelationOperator)
      expect(operators).toContain('FORWARD_EXACT')
      expect(operators).toContain('FORWARD_FUZZY')
      expect(operators).toContain('BACKWARD_EXACT')
      expect(operators).toContain('BACKWARD_FUZZY')
      expect(operators).toHaveLength(4)
    })

    it('should have RelationOperatorType as union of operator strings', () => {
      // Type assertion: each operator value should be assignable to RelationOperatorType
      const forwardExact: RelationOperatorType = RelationOperator.FORWARD_EXACT
      const forwardFuzzy: RelationOperatorType = RelationOperator.FORWARD_FUZZY
      const backwardExact: RelationOperatorType = RelationOperator.BACKWARD_EXACT
      const backwardFuzzy: RelationOperatorType = RelationOperator.BACKWARD_FUZZY

      // Runtime verification
      expect(forwardExact).toBe('->')
      expect(forwardFuzzy).toBe('~>')
      expect(backwardExact).toBe('<-')
      expect(backwardFuzzy).toBe('<~')
    })

    it('should allow using operators as type guards', () => {
      const validOperator = (op: string): op is RelationOperatorType => {
        return Object.values(RelationOperator).includes(op as RelationOperatorType)
      }

      expect(validOperator('->')).toBe(true)
      expect(validOperator('~>')).toBe(true)
      expect(validOperator('<-')).toBe(true)
      expect(validOperator('<~')).toBe(true)
      expect(validOperator('=')).toBe(false)
      expect(validOperator('!=')).toBe(false)
    })
  })

  describe('completeness', () => {
    it('should contain all valid relation operators', () => {
      const allOperators = Object.values(RelationOperator)

      // These are the four operators used in parse.ts
      expect(allOperators).toContain('->')
      expect(allOperators).toContain('~>')
      expect(allOperators).toContain('<-')
      expect(allOperators).toContain('<~')
    })
  })
})
