import { describe, it, expect } from 'vitest'
import { defineStartup, advance, validateStartup } from '../src/index.js'
import type { AutonomousStartup, LifecycleState } from '../src/index.js'
import { business, agentWorker, badWorker, offer, tool, tenant, passFor } from './fixtures.js'

/** Force a construct to a state for validating readiness invariants directly. */
function at(state: LifecycleState, s: AutonomousStartup<LifecycleState>): AutonomousStartup<LifecycleState> {
  return { ...s, state } as AutonomousStartup<LifecycleState>
}

describe('validateStartup', () => {
  it('never throws and returns a typed result', () => {
    const result = validateStartup(defineStartup({ name: 'Inbox Zero', business }))
    expect(result).toHaveProperty('valid')
    expect(Array.isArray(result.issues)).toBe(true)
  })

  it('flags an empty name as an error', () => {
    const result = validateStartup(defineStartup({ name: '   ', business }))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'name.empty' && i.severity === 'error')).toBe(true)
  })

  it('flags a worker with an invalid type', () => {
    const s = defineStartup({ name: 'Inbox Zero', business, workforce: [badWorker], tools: [tool] })
    const result = validateStartup(s)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'worker.type.invalid')).toBe(true)
  })

  it('warns on empty tools and empty pre-running workforce, but stays valid', () => {
    const result = validateStartup(defineStartup({ name: 'Inbox Zero', business }))
    expect(result.valid).toBe(true)
    expect(result.issues.some((i) => i.code === 'tools.empty' && i.severity === 'warning')).toBe(true)
    expect(result.issues.some((i) => i.code === 'workforce.empty' && i.severity === 'warning')).toBe(true)
  })

  it('requires something to sell once sellable', () => {
    const idea = defineStartup({ name: 'Inbox Zero', business, tools: [tool] })
    const sellable = at('sellable', idea)
    const result = validateStartup(sellable)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'sellable.nothing-to-sell')).toBe(true)
  })

  it('passes a sellable construct that has an offer', () => {
    const s = defineStartup({ name: 'Inbox Zero', business, offers: [offer], tools: [tool] })
    const result = validateStartup(at('sellable', s))
    expect(result.issues.some((i) => i.code === 'sellable.nothing-to-sell')).toBe(false)
  })

  it('requires a workforce once running', () => {
    const s = defineStartup({ name: 'Inbox Zero', business, offers: [offer], tools: [tool] })
    const result = validateStartup(at('running', s))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'running.no-workforce')).toBe(true)
  })

  it('does not hold a dissolved construct to sellable/running readiness invariants', () => {
    // A dissolved construct with nothing to sell and no workforce is still "valid" — it is
    // terminal, not held to live-state readiness. Only the always-on checks (name/business) apply.
    const dead = at('dissolved', defineStartup({ name: 'X', business, tools: [tool] }))
    const result = validateStartup(dead)
    expect(result.issues.some((i) => i.code === 'sellable.nothing-to-sell')).toBe(false)
    expect(result.issues.some((i) => i.code === 'running.no-workforce')).toBe(false)
    expect(result.valid).toBe(true)
  })

  it('passes an end-to-end running construct with all five registers', () => {
    const prin = tenant('acme')
    let s: AutonomousStartup<LifecycleState> = defineStartup({
      name: 'Inbox Zero',
      business,
      offers: [offer],
      tools: [tool],
      workforce: [agentWorker],
      principal: prin,
    })
    s = advance(s as AutonomousStartup<'idea', typeof prin>, passFor('idea', prin))
    s = advance(s as AutonomousStartup<'named', typeof prin>, passFor('named', prin))
    s = advance(s as AutonomousStartup<'sited', typeof prin>, passFor('sited', prin))
    s = advance(s as AutonomousStartup<'sellable', typeof prin>, passFor('sellable', prin))
    expect(s.state).toBe('running')
    const result = validateStartup(s)
    expect(result.valid).toBe(true)
    expect(result.issues.every((i) => i.severity !== 'error')).toBe(true)
  })
})
