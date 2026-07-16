import { describe, it, expect } from 'vitest'
import {
  LIFECYCLE_STATES,
  NEXT_STATE,
  TRANSITION_DOMAIN,
  legalNextStates,
  canTransition,
} from '../src/index.js'

describe('lifecycle machine', () => {
  it('is the linear idea → named → sited → sellable → running sequence', () => {
    expect(LIFECYCLE_STATES).toEqual(['idea', 'named', 'sited', 'sellable', 'running'])
  })

  it('gives every non-terminal state exactly one legal successor', () => {
    expect(legalNextStates('idea')).toEqual(['named'])
    expect(legalNextStates('named')).toEqual(['sited'])
    expect(legalNextStates('sited')).toEqual(['sellable'])
    expect(legalNextStates('sellable')).toEqual(['running'])
  })

  it('has no successor for the terminal running state', () => {
    expect(legalNextStates('running')).toEqual([])
    expect(NEXT_STATE.running).toBeNull()
  })

  it('accepts only forward-by-one transitions', () => {
    expect(canTransition('idea', 'named')).toBe(true)
    expect(canTransition('sellable', 'running')).toBe(true)
  })

  it('rejects skips, reversals, and self-loops', () => {
    expect(canTransition('idea', 'sited')).toBe(false) // skip
    expect(canTransition('idea', 'running')).toBe(false) // skip
    expect(canTransition('sited', 'named')).toBe(false) // reversal
    expect(canTransition('running', 'running')).toBe(false) // self-loop / terminal
    expect(canTransition('idea', 'idea')).toBe(false) // self-loop
  })

  it('draws each transition on a distinct competence domain', () => {
    expect(TRANSITION_DOMAIN.idea).toBe('growth')
    expect(TRANSITION_DOMAIN.named).toBe('product')
    expect(TRANSITION_DOMAIN.sited).toBe('money')
    expect(TRANSITION_DOMAIN.sellable).toBe('delivery')
    expect(TRANSITION_DOMAIN.running).toBeNull()
  })
})
