/**
 * Mermaid `stateDiagram-v2` FULL statechart coverage tests (slice aip-4fay).
 *
 * Widens the flat-subset parser / renderer tests to the full Harel formalism:
 * composite (nested) states, parallel regions, history pseudostates, and choice
 * pseudostates. Each construct is exercised three ways, per the PRD's testing
 * decisions:
 *
 *   1. **Parse → expected config** — `fromMermaid(source)` produces the expected
 *      `MachineConfig` shape (nested `states`, `type: 'parallel'`, history nodes,
 *      `always` branches — guards / actions as string names).
 *   2. **Config → render → expected mermaid** — `toMermaid(config)` emits the
 *      expected source (the exact inverse of the parser).
 *   3. **Run via `runMachine` + in-memory storage** — the produced config runs
 *      under xstate and follows the expected event trace (parallel → multi-active
 *      state; history → resume to the prior sub-state; choice → guarded routing).
 *
 * Plus a full round-trip corpus (both directions) and an active-state durability
 * test: run a parallel/composite machine partway, persist its snapshot through
 * the in-memory storage, resume a fresh actor, and assert every active region +
 * history slot is restored.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import {
  fromMermaid,
  toMermaid,
  runMachine,
  createInMemoryStateMachineStorage,
  createStateMachine,
} from '../src/index.js'

// ============================================================================
// Normalization helpers (shared with the flat-subset renderer tests)
// ============================================================================

/**
 * Canonicalize a parsed config for equality comparison: recursively sort
 * object keys so insertion-order differences don't cause false negatives.
 * Arrays keep their order (action sequence / choice-branch order is meaningful).
 */
function canon(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canon)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canon((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

/** Normalize mermaid source for textual comparison: trim each line, drop blanks. */
function canonMermaid(source: string): string {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n')
}

// ============================================================================
// 1. Composite (nested) states
// ============================================================================

describe('composite (nested) states', () => {
  const source = `
    stateDiagram-v2
      [*] --> Review
      state Review {
        [*] --> awaiting
        awaiting --> approved : APPROVE
        approved --> [*]
      }
      Review --> Done : SHIP
  `

  it('parses to nested `states` with the inner `[*] -->` as the child initial', () => {
    const config = fromMermaid(source)
    expect(config.initial).toBe('Review')
    const review = (
      config.states as Record<string, { initial?: string; on?: object; states?: object }>
    ).Review
    expect(review.initial).toBe('awaiting')
    expect(review.on).toEqual({ SHIP: 'Done' })
    const inner = review.states as Record<string, { on?: object; type?: string }>
    expect(inner.awaiting.on).toEqual({ APPROVE: 'approved' })
    expect(inner.approved.type).toBe('final')
  })

  it('renders back to the expected composite mermaid', () => {
    const out = toMermaid(fromMermaid(source))
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> Review
        Review --> Done : SHIP
        state Review {
          [*] --> awaiting
          awaiting --> approved : APPROVE
          approved --> [*]
        }
        state Done
      `)
    )
  })

  it('runs: enters the composite at its child initial and advances out on SHIP', async () => {
    const handle = await runMachine(fromMermaid(source), createInMemoryStateMachineStorage())
    expect(handle.getState()).toEqual({ Review: 'awaiting' })
    handle.send('APPROVE')
    // `approved` is final within Review, so the parent's `Review` is done.
    handle.send('SHIP')
    expect(handle.getState()).toBe('Done')
  })
})

// ============================================================================
// 2. Parallel regions
// ============================================================================

describe('parallel regions', () => {
  const source = `
    stateDiagram-v2
      [*] --> Working
      state Working {
        state Coding {
          [*] --> writing
          writing --> reviewing : SUBMIT
        }
        --
        state Watching {
          [*] --> idle
          idle --> cancelled : CANCEL
        }
      }
  `

  it('parses `--` into a `type: "parallel"` node with one child region per block', () => {
    const config = fromMermaid(source)
    const working = (config.states as Record<string, { type?: string; states?: object }>).Working
    expect(working.type).toBe('parallel')
    const regions = working.states as Record<string, { initial?: string }>
    expect(Object.keys(regions).sort()).toEqual(['Coding', 'Watching'])
    expect(regions.Coding.initial).toBe('writing')
    expect(regions.Watching.initial).toBe('idle')
  })

  it('renders back to `--`-separated nested region blocks', () => {
    const out = toMermaid(fromMermaid(source))
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> Working
        state Working {
          state Coding {
            [*] --> writing
            writing --> reviewing : SUBMIT
            state reviewing
          }
          --
          state Watching {
            [*] --> idle
            idle --> cancelled : CANCEL
            state cancelled
          }
        }
      `)
    )
  })

  it('runs: both regions are active and advance independently (multi-active state)', async () => {
    const handle = await runMachine(fromMermaid(source), createInMemoryStateMachineStorage())
    expect(handle.getState()).toEqual({ Working: { Coding: 'writing', Watching: 'idle' } })

    handle.send('SUBMIT')
    expect(handle.getState()).toEqual({ Working: { Coding: 'reviewing', Watching: 'idle' } })

    handle.send('CANCEL')
    expect(handle.getState()).toEqual({ Working: { Coding: 'reviewing', Watching: 'cancelled' } })
  })
})

// ============================================================================
// 3. History pseudostates
// ============================================================================

describe('history pseudostates', () => {
  // The faithful history pattern: an OUTER state (`Paused`) re-enters the
  // composite (`Active`) at its remembered sub-state via `Active[H]`. History is
  // only meaningful when the composite is genuinely exited and re-entered — a
  // transition between siblings inside the composite never records history.
  const shallow = `
    stateDiagram-v2
      [*] --> Active
      state Active {
        [*] --> running
        running --> stepTwo : NEXT
        [H]
      }
      Active --> Paused : PAUSE
      Paused --> Active[H] : RESUME
  `

  it('parses a bare `[H]` into a shallow-history child and `Active[H]` into a dotted target', () => {
    const config = fromMermaid(shallow)
    const active = (config.states as Record<string, { states: Record<string, never> }>).Active
    const states = active.states as Record<string, { type?: string; history?: string }>
    expect(states.hist.type).toBe('history')
    expect(states.hist.history).toBe('shallow')
    const paused = (config.states as Record<string, { on?: Record<string, unknown> }>).Paused
    expect(paused.on).toEqual({ RESUME: 'Active.hist' })
  })

  it('parses a bare `[H*]` into a deep-history child', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> A
        state A {
          [*] --> x
          [H*]
        }
        A --> P : PAUSE
        P --> A[H*] : RESUME
    `)
    const a = (config.states as Record<string, { states: Record<string, never> }>).A
    const states = a.states as Record<string, { type?: string; history?: string }>
    expect(states.deepHist.type).toBe('history')
    expect(states.deepHist.history).toBe('deep')
  })

  it('renders the bare history child as `[H]` and the re-entry as `Active[H]`', () => {
    const out = toMermaid(fromMermaid(shallow))
    expect(out).toContain('Paused --> Active[H] : RESUME')
    expect(out).not.toContain('state hist')
    // The bare `[H]` declaration survives inside the composite block.
    expect(canonMermaid(out)).toContain('\n[H]')
  })

  it('runs: RESUME returns to the remembered sub-state, not the composite initial', async () => {
    const handle = await runMachine(fromMermaid(shallow), createInMemoryStateMachineStorage())
    expect(handle.getState()).toEqual({ Active: 'running' })

    // Advance to a non-initial sub-state, exit the composite, then re-enter via
    // history — it restores `stepTwo`, not the `running` initial.
    handle.send('NEXT')
    expect(handle.getState()).toEqual({ Active: 'stepTwo' })
    handle.send('PAUSE')
    expect(handle.getState()).toBe('Paused')
    handle.send('RESUME')
    expect(handle.getState()).toEqual({ Active: 'stepTwo' })
  })
})

// ============================================================================
// 4. Choice pseudostates
// ============================================================================

describe('choice pseudostates', () => {
  const source = `
    stateDiagram-v2
      [*] --> inspect
      state decide <<choice>>
      inspect --> decide : DONE
      decide --> big : [isBig]
      decide --> small : [else]
  `

  it('parses `<<choice>>` + guarded outgoing into a transient `always` node', () => {
    const config = fromMermaid(source)
    const decide = (config.states as Record<string, { always?: unknown }>).decide
    expect(decide.always).toEqual([{ target: 'big', guard: 'isBig' }, { target: 'small' }])
  })

  it('renders back to a `<<choice>>` declaration + guarded / [else] branches', () => {
    const out = toMermaid(fromMermaid(source))
    expect(out).toContain('state decide <<choice>>')
    expect(out).toContain('decide --> big : [isBig]')
    expect(out).toContain('decide --> small : [else]')
  })

  it('runs: takes the guarded branch when its guard passes', async () => {
    const machine = createStateMachine(fromMermaid(source)).provide({
      guards: { isBig: () => true },
    })
    const handle = await runMachine(machine, createInMemoryStateMachineStorage(), {
      machineId: 'choice-big',
    })
    handle.send('DONE')
    expect(handle.getState()).toBe('big')
  })

  it('runs: falls through to the `[else]` default when the guard fails', async () => {
    const machine = createStateMachine(fromMermaid(source)).provide({
      guards: { isBig: () => false },
    })
    const handle = await runMachine(machine, createInMemoryStateMachineStorage(), {
      machineId: 'choice-small',
    })
    handle.send('DONE')
    expect(handle.getState()).toBe('small')
  })
})

// ============================================================================
// 5. Notes are parsed and ignored
// ============================================================================

describe('notes (parse and ignore)', () => {
  it('ignores block and single-line notes inside a composite', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> Review
        state Review {
          [*] --> awaiting
          note right of awaiting
            multi-line documentation
          end note
          awaiting --> approved : APPROVE
          note left of approved : single line
        }
    `)
    const review = (config.states as Record<string, { states: Record<string, never> }>).Review
    expect(Object.keys(review.states).sort()).toEqual(['approved', 'awaiting'])
  })
})

// ============================================================================
// 6. Full round-trip corpus - both directions
// ============================================================================

const mermaidCorpus: Record<string, string> = {
  composite: `
    stateDiagram-v2
      [*] --> Review
      state Review {
        [*] --> awaiting
        awaiting --> approved : APPROVE
        approved --> [*]
      }
      Review --> Done : SHIP
  `,
  parallel: `
    stateDiagram-v2
      [*] --> Working
      state Working {
        state Coding {
          [*] --> writing
          writing --> reviewing : SUBMIT
        }
        --
        state Watching {
          [*] --> idle
          idle --> cancelled : CANCEL
        }
      }
  `,
  history: `
    stateDiagram-v2
      [*] --> Active
      state Active {
        [*] --> running
        running --> stepTwo : NEXT
        [H]
      }
      Active --> Paused : PAUSE
      Paused --> Active[H] : RESUME
  `,
  choice: `
    stateDiagram-v2
      [*] --> inspect
      state decide <<choice>>
      inspect --> decide : DONE
      decide --> big : [isBig]
      decide --> small : [else]
  `,
  'composite with guard + actions': `
    stateDiagram-v2
      [*] --> Review
      state Review {
        [*] --> awaiting
        awaiting : entry / notifyReviewers
        awaiting --> approved : APPROVE [allSignedOff]
      }
  `,
}

describe('round-trip mermaid -> config -> mermaid -> config (config equal)', () => {
  for (const [name, source] of Object.entries(mermaidCorpus)) {
    it(`config stable across a render cycle: ${name}`, () => {
      const config1 = fromMermaid(source)
      const config2 = fromMermaid(toMermaid(config1))
      expect(canon(config2)).toEqual(canon(config1))
    })
  }
})

describe('round-trip config -> mermaid -> config -> mermaid (string equal)', () => {
  for (const [name, source] of Object.entries(mermaidCorpus)) {
    it(`mermaid string stable across a parse cycle: ${name}`, () => {
      const config1 = fromMermaid(source)
      const mermaid1 = toMermaid(config1)
      const mermaid2 = toMermaid(fromMermaid(mermaid1))
      expect(canonMermaid(mermaid2)).toBe(canonMermaid(mermaid1))
    })
  }
})

// ============================================================================
// 7. Active-state durability — persist a partway run, resume a fresh actor
// ============================================================================

describe('active-state durability (snapshot + resume)', () => {
  it('resumes a parallel machine with both regions restored to their advanced states', async () => {
    const source = mermaidCorpus.parallel
    const config = fromMermaid(source)
    const storage = createInMemoryStateMachineStorage()

    // Run partway: advance one region, leave the other at its initial.
    const first = await runMachine(config, storage, { machineId: 'durable-parallel' })
    first.send('SUBMIT')
    expect(first.getState()).toEqual({ Working: { Coding: 'reviewing', Watching: 'idle' } })
    first.stop()

    // Resume a FRESH actor from the persisted snapshot.
    const resumed = await runMachine(config, storage, {
      machineId: 'durable-parallel',
      resume: true,
    })
    // Both regions restored: the advanced one stays advanced, the other stays
    // at its initial — the full multi-active configuration survived.
    expect(resumed.getState()).toEqual({ Working: { Coding: 'reviewing', Watching: 'idle' } })

    // And it keeps running correctly from the resumed configuration.
    resumed.send('CANCEL')
    expect(resumed.getState()).toEqual({ Working: { Coding: 'reviewing', Watching: 'cancelled' } })
  })

  it('resumes a history machine to the correct remembered sub-state slot', async () => {
    const source = `
      stateDiagram-v2
        [*] --> Active
        state Active {
          [*] --> running
          running --> stepTwo : NEXT
          [H]
        }
        Active --> Paused : PAUSE
        Paused --> Active[H] : RESUME
    `
    const config = fromMermaid(source)
    const storage = createInMemoryStateMachineStorage()

    // Advance to `stepTwo` (a NON-initial sub-state), then exit the composite to
    // `Paused` — the history slot for Active records `stepTwo`.
    const first = await runMachine(config, storage, { machineId: 'durable-history' })
    first.send('NEXT')
    expect(first.getState()).toEqual({ Active: 'stepTwo' })
    first.send('PAUSE')
    expect(first.getState()).toBe('Paused')
    first.stop()

    // Resume a FRESH actor from the persisted snapshot (which carries the
    // history slot), then fire RESUME — history restores `stepTwo`, not the
    // composite's `running` initial.
    const resumed = await runMachine(config, storage, {
      machineId: 'durable-history',
      resume: true,
    })
    expect(resumed.getState()).toBe('Paused')
    resumed.send('RESUME')
    expect(resumed.getState()).toEqual({ Active: 'stepTwo' })
  })
})
