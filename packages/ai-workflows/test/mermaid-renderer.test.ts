/**
 * Mermaid `stateDiagram-v2` renderer tests - flat subset (aip-jsvj).
 *
 * The renderer ({@link toMermaid}) is the exact inverse of the parser
 * ({@link fromMermaid}) for the flat subset. The heart of this slice is the
 * **bidirectional round-trip**, per the PRD's testing decisions:
 *
 *   1. **Direct render** — `toMermaid(config)` emits the expected source for a
 *      corpus of flat configs.
 *   2. **mermaid → config → mermaid → config** — for each mermaid sample,
 *      `fromMermaid` → `toMermaid` → `fromMermaid` and compare the two configs
 *      (equality up to normalization).
 *   3. **config → mermaid → config → mermaid** — for each config, `toMermaid` →
 *      `fromMermaid` → `toMermaid` and compare the two strings (up to
 *      normalization).
 *   4. **Highlight** — `toMermaid(config, { highlight })` applies the expected
 *      `classDef active` styling to the active leaf state(s).
 *
 * Normalization (below) canonicalizes object-key order and trims/strips blank
 * lines so the comparisons assert structural / textual identity, not incidental
 * ordering or whitespace.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { fromMermaid } from '../src/state-machine/mermaid-parser.js'
import {
  toMermaid,
  MermaidRenderError,
  type RenderableMachineConfig,
} from '../src/state-machine/mermaid-renderer.js'

// ============================================================================
// Normalization helpers
// ============================================================================

/**
 * Canonicalize a parsed config for equality comparison: recursively sort
 * object keys so insertion-order differences (the parser's first-seen order vs
 * the renderer's `Object.entries` order) don't cause false negatives. Values
 * (strings, arrays) keep their order — arrays are meaningful (action sequence).
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
// Corpus - flat configs covering every supported construct
// ============================================================================

const corpus: Record<string, RenderableMachineConfig> = {
  'initial + simple transition': {
    initial: 'idle',
    states: {
      idle: { on: { START: 'running' } },
      running: {},
    },
  },
  'guarded transition': {
    initial: 'open',
    states: {
      open: { on: { CLOSE: { target: 'closed', guard: 'canClose' } } },
      closed: {},
    },
  },
  'entry / exit actions': {
    initial: 'active',
    states: {
      active: { entry: ['logEnter'], exit: ['logExit'], on: { SLEEP: 'idle' } },
      idle: { entry: ['logIdle'] },
    },
  },
  'final state': {
    initial: 'working',
    states: {
      working: { on: { FINISH: 'done' } },
      done: { type: 'final' },
    },
  },
  'multiple events on one state': {
    initial: 'menu',
    states: {
      menu: { on: { START: 'play', EXIT: 'quit' } },
      play: {},
      quit: {},
    },
  },
  'traffic light cycle': {
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: { on: { TIMER: 'red' } },
      red: { on: { TIMER: 'green' } },
    },
  },
}

// ============================================================================
// 1. Direct render - toMermaid emits expected source
// ============================================================================

describe('toMermaid - emits expected source', () => {
  it('renders initial + a simple transition', () => {
    const out = toMermaid(corpus['initial + simple transition'])
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> idle
        idle --> running : START
        state running
      `)
    )
  })

  it('renders a guarded transition as `: EVENT [guard]`', () => {
    const out = toMermaid(corpus['guarded transition'])
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> open
        open --> closed : CLOSE [canClose]
        state closed
      `)
    )
  })

  it('renders entry / exit actions one line each', () => {
    const out = toMermaid(corpus['entry / exit actions'])
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> active
        active : entry / logEnter
        active : exit / logExit
        active --> idle : SLEEP
        idle : entry / logIdle
      `)
    )
  })

  it('renders a final state as `foo --> [*]`', () => {
    const out = toMermaid(corpus['final state'])
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> working
        working --> done : FINISH
        done --> [*]
      `)
    )
  })

  it('renders multiple distinct events from one state', () => {
    const out = toMermaid(corpus['multiple events on one state'])
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> menu
        menu --> play : START
        menu --> quit : EXIT
        state play
        state quit
      `)
    )
  })

  it('begins with the `stateDiagram-v2` header and ends with a newline', () => {
    const out = toMermaid(corpus['traffic light cycle'])
    expect(out.startsWith('stateDiagram-v2\n')).toBe(true)
    expect(out.endsWith('\n')).toBe(true)
  })
})

// ============================================================================
// 2. Round-trip: mermaid -> config -> mermaid -> config (compare configs)
// ============================================================================

const mermaidSamples: Record<string, string> = {
  'simple cycle': `
    stateDiagram-v2
      [*] --> green
      green --> yellow : TIMER
      yellow --> red : TIMER
      red --> green : TIMER
  `,
  'guarded + final': `
    stateDiagram-v2
      [*] --> working
      working --> done : FINISH [isComplete]
      done --> [*]
  `,
  'entry / exit + branch': `
    stateDiagram-v2
      [*] --> active
      active : entry / logEnter
      active : exit / logExit
      active --> play : START
      active --> quit : EXIT
      play : entry / startGame
  `,
}

describe('round-trip mermaid -> config -> mermaid -> config', () => {
  for (const [name, source] of Object.entries(mermaidSamples)) {
    it(`config is stable across a render cycle: ${name}`, () => {
      const config1 = fromMermaid(source)
      const rendered = toMermaid(config1)
      const config2 = fromMermaid(rendered)
      expect(canon(config2)).toEqual(canon(config1))
    })
  }
})

// ============================================================================
// 3. Round-trip: config -> mermaid -> config -> mermaid (compare strings)
// ============================================================================

describe('round-trip config -> mermaid -> config -> mermaid', () => {
  for (const [name, config] of Object.entries(corpus)) {
    it(`mermaid string is stable across a parse cycle: ${name}`, () => {
      const mermaid1 = toMermaid(config)
      const config2 = fromMermaid(mermaid1)
      const mermaid2 = toMermaid(config2)
      expect(canonMermaid(mermaid2)).toBe(canonMermaid(mermaid1))
    })

    it(`config survives a full render -> parse round-trip: ${name}`, () => {
      const roundTripped = fromMermaid(toMermaid(config))
      // The corpus configs are already in the parser's minimal flat shape
      // (empty `{}` states, string/array members), so render -> parse returns
      // the same config up to key-order normalization.
      expect(canon(roundTripped)).toEqual(canon(config))
    })
  }
})

// ============================================================================
// 4. Active-state highlight - classDef styling
// ============================================================================

describe('toMermaid - active-state highlight', () => {
  it('appends a classDef and a `class <state> active` line for a flat string value', () => {
    const out = toMermaid(corpus['traffic light cycle'], { highlight: 'yellow' })
    expect(out).toContain('classDef active fill:#fdd835,stroke:#f57f17,stroke-width:2px,color:#000')
    expect(out).toContain('class yellow active')
    // The highlight is additive: the structural body (without the trailing
    // classDef / class visualization lines) is identical to the un-highlighted
    // render and parses cleanly. The highlighted output itself is a terminal
    // visualization (operators / dashboards), not a round-trippable wire format
    // — the parser does not consume `classDef` / `class` lines.
    const structural = toMermaid(corpus['traffic light cycle'])
    expect(out.startsWith(structural.trimEnd())).toBe(true)
    expect(() => fromMermaid(structural)).not.toThrow()
  })

  it('omits highlight lines entirely when no highlight is given', () => {
    const out = toMermaid(corpus['traffic light cycle'])
    expect(out).not.toContain('classDef')
    expect(out).not.toContain('class ')
  })

  it('extracts leaf state values from a nested (composite/parallel) value', () => {
    const out = toMermaid(corpus['traffic light cycle'], {
      highlight: { review: 'awaiting' } as never,
    })
    expect(out).toContain('class awaiting active')
  })

  it('matches the expected highlight block (snapshot)', () => {
    const out = toMermaid(corpus['final state'], { highlight: 'working' })
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> working
        working --> done : FINISH
        done --> [*]
        classDef active fill:#fdd835,stroke:#f57f17,stroke-width:2px,color:#000
        class working active
      `)
    )
  })
})

// ============================================================================
// 5. Full statechart constructs are now SUPPORTED (slice aip-4fay)
//
// These cases previously asserted the flat-subset renderer THREW on composite /
// parallel / history. aip-4fay makes the renderer the exact inverse of the
// widened parser, so they now assert the emitted source. Full round-trip + run
// coverage lives in mermaid-full-coverage.test.ts.
// ============================================================================

describe('toMermaid - full statechart constructs (slice aip-4fay)', () => {
  it('renders a composite (nested) state as `state Foo { ... }`', () => {
    const out = toMermaid({
      initial: 'Review',
      states: {
        Review: {
          initial: 'awaiting',
          states: { awaiting: { on: { APPROVE: 'approved' } }, approved: {} },
        } as never,
      },
    })
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> Review
        state Review {
          [*] --> awaiting
          awaiting --> approved : APPROVE
          state approved
        }
      `)
    )
  })

  it('renders a parallel state with `--`-separated regions', () => {
    const out = toMermaid({
      initial: 'Working',
      states: {
        Working: {
          type: 'parallel',
          states: {
            Coding: { initial: 'writing', states: { writing: {} } },
            Watching: { initial: 'idle', states: { idle: {} } },
          },
        } as never,
      },
    })
    expect(canonMermaid(out)).toBe(
      canonMermaid(`
        stateDiagram-v2
        [*] --> Working
        state Working {
          state Coding {
            [*] --> writing
            state writing
          }
          --
          state Watching {
            [*] --> idle
            state idle
          }
        }
      `)
    )
  })

  it('renders a history target as `--> [H]` and never declares the history node', () => {
    const out = toMermaid({
      initial: 'Active',
      states: {
        Active: {
          initial: 'running',
          states: {
            running: { on: { PAUSE: 'paused' } },
            paused: { on: { RESUME: 'hist' } },
            hist: { type: 'history', history: 'shallow' },
          },
        } as never,
      },
    })
    expect(out).toContain('paused --> [H] : RESUME')
    expect(out).not.toContain('state hist')
  })

  it('renders a deep-history target as `--> [H*]`', () => {
    const out = toMermaid({
      initial: 'A',
      states: {
        A: {
          initial: 'x',
          states: { x: { on: { R: 'dh' } }, dh: { type: 'history', history: 'deep' } },
        } as never,
      },
    })
    expect(out).toContain('x --> [H*] : R')
  })

  it('renders a choice node as `state c <<choice>>` plus guarded branches', () => {
    const out = toMermaid({
      initial: 'inspect',
      states: {
        inspect: { on: { DONE: 'decide' } },
        decide: { always: [{ target: 'big', guard: 'isBig' }, { target: 'small' }] } as never,
        big: {},
        small: {},
      },
    })
    expect(out).toContain('state decide <<choice>>')
    expect(out).toContain('decide --> big : [isBig]')
    expect(out).toContain('decide --> small : [else]')
  })

  it('still throws (MermaidRenderError) on an inline (non-string) action', () => {
    try {
      toMermaid({ initial: 'a', states: { a: { entry: [() => {}] } as never } })
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MermaidRenderError)
    }
  })
})
