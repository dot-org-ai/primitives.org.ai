import { describe, it, expect } from 'vitest'
import {
  LIFECYCLE_VERSION,
  LIFECYCLE_STATES,
  LIVE_STATES,
  TERMINAL_STATES,
  EDGE_KINDS,
  STATEGRAPH,
  NEXT_STATE,
  TRANSITION_DOMAIN,
  isLive,
  edgesFrom,
  edgeFor,
  canTransition,
  legalNextStates,
} from '../src/index.js'
import type { EdgeKind, LifecycleState } from '../src/index.js'

describe('lifecycle@1 stategraph', () => {
  it('is version 1', () => {
    expect(LIFECYCLE_VERSION).toBe(1)
  })

  it('has the six states, five live plus the terminal dissolved', () => {
    expect(LIFECYCLE_STATES).toEqual(['idea', 'named', 'sited', 'sellable', 'running', 'dissolved'])
    expect(LIVE_STATES).toEqual(['idea', 'named', 'sited', 'sellable', 'running'])
    expect(TERMINAL_STATES).toEqual(['dissolved'])
  })

  it('has exactly the five edge kinds', () => {
    expect(EDGE_KINDS).toEqual(['advance', 'revert', 'pivot', 'dissolve', 'rename'])
  })

  it('treats every state but dissolved as live', () => {
    expect(isLive('idea')).toBe(true)
    expect(isLive('running')).toBe(true)
    expect(isLive('dissolved')).toBe(false)
  })
})

describe('advance edges (the forward build spine)', () => {
  it('links idea → named → sited → sellable → running, each on a distinct domain', () => {
    expect(canTransition('advance', 'idea', 'named')).toBe(true)
    expect(canTransition('advance', 'named', 'sited')).toBe(true)
    expect(canTransition('advance', 'sited', 'sellable')).toBe(true)
    expect(canTransition('advance', 'sellable', 'running')).toBe(true)
    expect(edgeFor('advance', 'idea')?.domain).toBe('growth')
    expect(edgeFor('advance', 'named')?.domain).toBe('product')
    expect(edgeFor('advance', 'sited')?.domain).toBe('money')
    expect(edgeFor('advance', 'sellable')?.domain).toBe('delivery')
  })

  it('has no forward edge out of running or dissolved', () => {
    expect(edgeFor('advance', 'running')).toBeNull()
    expect(edgeFor('advance', 'dissolved')).toBeNull()
    expect(legalNextStates('running')).toEqual([])
    expect(NEXT_STATE.running).toBeNull()
  })

  it('rejects skips, and advance is not a reversal', () => {
    expect(canTransition('advance', 'idea', 'sited')).toBe(false) // skip
    expect(canTransition('advance', 'idea', 'running')).toBe(false) // skip
    expect(canTransition('advance', 'sited', 'named')).toBe(false) // that is a revert, not an advance
  })

  it('keeps the advance-spine TRANSITION_DOMAIN view', () => {
    expect(TRANSITION_DOMAIN.idea).toBe('growth')
    expect(TRANSITION_DOMAIN.sellable).toBe('delivery')
    expect(TRANSITION_DOMAIN.running).toBeNull()
    expect(TRANSITION_DOMAIN.dissolved).toBeNull()
  })
})

describe('revert edges (undo the last build step)', () => {
  it('links running → sellable → sited → named → idea on the SAME domain as the forward edge', () => {
    expect(canTransition('revert', 'running', 'sellable')).toBe(true)
    expect(canTransition('revert', 'sellable', 'sited')).toBe(true)
    expect(canTransition('revert', 'sited', 'named')).toBe(true)
    expect(canTransition('revert', 'named', 'idea')).toBe(true)
    // reverting running→sellable un-does the sellable→running (delivery) edge
    expect(edgeFor('revert', 'running')?.domain).toBe('delivery')
    expect(edgeFor('revert', 'sellable')?.domain).toBe('money')
    expect(edgeFor('revert', 'sited')?.domain).toBe('product')
    expect(edgeFor('revert', 'named')?.domain).toBe('growth')
  })

  it('has no backward edge out of idea (nothing to undo) or dissolved', () => {
    expect(edgeFor('revert', 'idea')).toBeNull()
    expect(edgeFor('revert', 'dissolved')).toBeNull()
  })
})

describe('pivot edges (re-idea-with-lineage)', () => {
  it('links every formed live state back to idea on the growth domain, carrying lineage', () => {
    for (const from of ['named', 'sited', 'sellable', 'running'] as const) {
      expect(canTransition('pivot', from, 'idea')).toBe(true)
      const e = edgeFor('pivot', from)
      expect(e?.domain).toBe('growth')
      expect(e?.carriesLineage).toBe(true)
    }
  })

  it('is illegal from idea (nothing to re-idea) and from dissolved (terminal)', () => {
    expect(edgeFor('pivot', 'idea')).toBeNull()
    expect(edgeFor('pivot', 'dissolved')).toBeNull()
  })
})

describe('dissolve edges (wind down)', () => {
  it('links every live state to dissolved on the legal domain', () => {
    for (const from of LIVE_STATES) {
      expect(canTransition('dissolve', from, 'dissolved')).toBe(true)
      expect(edgeFor('dissolve', from)?.domain).toBe('legal')
    }
  })

  it('is illegal out of the terminal dissolved state', () => {
    expect(edgeFor('dissolve', 'dissolved')).toBeNull()
    expect(edgesFrom('dissolved')).toEqual([])
  })
})

describe('rename edges (self-edge, identity kept)', () => {
  it('is a self-edge on every live state, on the schema domain', () => {
    for (const from of LIVE_STATES) {
      expect(canTransition('rename', from, from)).toBe(true)
      const e = edgeFor('rename', from)
      expect(e?.to).toBe(from)
      expect(e?.domain).toBe('schema')
    }
  })

  it('is illegal on the terminal dissolved state', () => {
    expect(edgeFor('rename', 'dissolved')).toBeNull()
  })
})

describe('stategraph shape', () => {
  it('has dissolved as a true sink — no edge leaves it', () => {
    expect(STATEGRAPH.some((e) => e.from === 'dissolved')).toBe(false)
  })

  it('enumerates the expected number of edges (4 advance + 4 revert + 4 pivot + 5 dissolve + 5 rename)', () => {
    const count = (kind: EdgeKind): number => STATEGRAPH.filter((e) => e.kind === kind).length
    expect(count('advance')).toBe(4)
    expect(count('revert')).toBe(4)
    expect(count('pivot')).toBe(4)
    expect(count('dissolve')).toBe(5)
    expect(count('rename')).toBe(5)
    expect(STATEGRAPH.length).toBe(22)
  })

  it('every edge references only known states', () => {
    const known = new Set<LifecycleState>(LIFECYCLE_STATES)
    for (const e of STATEGRAPH) {
      expect(known.has(e.from)).toBe(true)
      expect(known.has(e.to)).toBe(true)
    }
  })
})
