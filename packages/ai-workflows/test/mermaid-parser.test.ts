/**
 * Mermaid `stateDiagram-v2` parser tests - flat subset (aip-mdw0).
 *
 * Two assertions per corpus snippet, per the PRD's testing decisions:
 *
 *   1. **Shape** — `fromMermaid(source)` produces the expected `MachineConfig`
 *      shape (initial, states, transitions, guards as string names, entry/exit
 *      action-name lists, final states).
 *   2. **Behaviour** — the produced config, run via {@link runMachine} with the
 *      in-memory storage, follows the expected event trace. Tests cross the
 *      runtime's natural seam (drive events, assert state values) rather than
 *      asserting on parser internals.
 *
 * Guards and actions are referenced by string name in the parsed config; the
 * caller supplies implementations via `createStateMachine(config).provide(...)`
 * — exercised end-to-end in the guard / action tests.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import {
  fromMermaid,
  MermaidParseError,
  runMachine,
  createInMemoryStateMachineStorage,
  createStateMachine,
} from '../src/index.js'

// ============================================================================
// 1. State declarations, implicit states, initial / final
// ============================================================================

describe('fromMermaid - states, initial, final', () => {
  it('maps `[*] --> foo` to a top-level initial', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> idle
    `)
    expect(config.initial).toBe('idle')
    expect(config.states).toHaveProperty('idle')
  })

  it('declares implicit states from transitions and explicit states from `state X`', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        state declared
        [*] --> idle
        idle --> running : START
    `)
    expect(Object.keys(config.states ?? {}).sort()).toEqual(['declared', 'idle', 'running'])
  })

  it('marks `foo --> [*]` as a final state', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> working
        working --> done : FINISH
        done --> [*]
    `)
    const states = config.states as Record<string, { type?: string }>
    expect(states.done.type).toBe('final')
  })

  it('accepts `state "Label" as id` aliased declarations', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        state "In Progress" as inProgress
        [*] --> inProgress
    `)
    expect(config.states).toHaveProperty('inProgress')
  })

  it('runs a flat machine through its event trace', async () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> green
        green --> yellow : TIMER
        yellow --> red : TIMER
        red --> green : TIMER
    `)
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(config, storage)

    expect(handle.getState()).toBe('green')
    handle.send('TIMER')
    expect(handle.getState()).toBe('yellow')
    handle.send('TIMER')
    expect(handle.getState()).toBe('red')
    handle.send('TIMER')
    expect(handle.getState()).toBe('green')
  })

  it('reaches a final state via its event trace', async () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> working
        working --> done : FINISH
        done --> [*]
    `)
    const storage = createInMemoryStateMachineStorage()
    const handle = await runMachine(config, storage)

    expect(handle.getState()).toBe('working')
    handle.send('FINISH')
    expect(handle.getState()).toBe('done')
    expect(handle.getSnapshot().status).toBe('done')
  })
})

// ============================================================================
// 2. Transitions
// ============================================================================

describe('fromMermaid - transitions', () => {
  it('maps `foo --> bar : EV` to `foo.on.EV = "bar"`', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> a
        a --> b : GO
    `)
    const states = config.states as Record<string, { on?: Record<string, unknown> }>
    expect(states.a.on).toEqual({ GO: 'b' })
  })

  it('keeps multiple distinct events on one state', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> menu
        menu --> play : START
        menu --> quit : EXIT
    `)
    const states = config.states as Record<string, { on?: Record<string, unknown> }>
    expect(states.menu.on).toEqual({ START: 'play', EXIT: 'quit' })
  })

  it('drives a branching machine down each event path', async () => {
    const source = `
      stateDiagram-v2
        [*] --> menu
        menu --> play : START
        menu --> quit : EXIT
    `
    const storage = createInMemoryStateMachineStorage()

    const a = await runMachine(fromMermaid(source), storage, { machineId: 'm-a' })
    a.send('START')
    expect(a.getState()).toBe('play')

    const b = await runMachine(fromMermaid(source), storage, { machineId: 'm-b' })
    b.send('EXIT')
    expect(b.getState()).toBe('quit')
  })

  it('rejects an unlabelled transition between two named states', () => {
    expect(() =>
      fromMermaid(`
        stateDiagram-v2
          [*] --> a
          a --> b
      `)
    ).toThrow(/needs an event label/)
  })

  it('rejects a duplicate transition for the same event', () => {
    expect(() =>
      fromMermaid(`
        stateDiagram-v2
          [*] --> a
          a --> b : GO
          a --> c : GO
      `)
    ).toThrow(/Duplicate transition/)
  })
})

// ============================================================================
// 3. Guarded transitions - referenced by string name, provided by the caller
// ============================================================================

describe('fromMermaid - guarded transitions', () => {
  it('maps `: EV [guard]` to `{ target, guard }` with a string guard name', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> open
        open --> closed : CLOSE [canClose]
    `)
    const states = config.states as Record<string, { on?: Record<string, unknown> }>
    expect(states.open.on).toEqual({ CLOSE: { target: 'closed', guard: 'canClose' } })
  })

  it('a guarded transition fires only when the provided guard passes', async () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> open
        open --> closed : CLOSE [canClose]
    `)

    // Guard returns false: transition does NOT fire.
    const blocked = createStateMachine(config).provide({ guards: { canClose: () => false } })
    const blockedHandle = await runMachine(blocked, createInMemoryStateMachineStorage(), {
      machineId: 'g-blocked',
    })
    blockedHandle.send('CLOSE')
    expect(blockedHandle.getState()).toBe('open')

    // Guard returns true: transition fires.
    const allowed = createStateMachine(config).provide({ guards: { canClose: () => true } })
    const allowedHandle = await runMachine(allowed, createInMemoryStateMachineStorage(), {
      machineId: 'g-allowed',
    })
    allowedHandle.send('CLOSE')
    expect(allowedHandle.getState()).toBe('closed')
  })
})

// ============================================================================
// 4. Entry / exit actions - string names, provided by the caller
// ============================================================================

describe('fromMermaid - entry / exit actions', () => {
  it('maps `foo : entry / act` and `foo : exit / act` to string-name lists', () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> active
        active : entry / logEnter
        active : exit / logExit
        active --> idle : SLEEP
    `)
    const states = config.states as Record<string, { entry?: string[]; exit?: string[] }>
    expect(states.active.entry).toEqual(['logEnter'])
    expect(states.active.exit).toEqual(['logExit'])
  })

  it('runs entry / exit actions provided by the caller as the machine transitions', async () => {
    const config = fromMermaid(`
      stateDiagram-v2
        [*] --> active
        active : entry / logEnter
        active : exit / logExit
        active --> idle : SLEEP
        idle : entry / logIdle
    `)

    const calls: string[] = []
    const machine = createStateMachine(config).provide({
      actions: {
        logEnter: () => calls.push('enter:active'),
        logExit: () => calls.push('exit:active'),
        logIdle: () => calls.push('enter:idle'),
      },
    })

    const handle = await runMachine(machine, createInMemoryStateMachineStorage(), {
      machineId: 'act-1',
    })
    // entry on initial state.
    expect(calls).toEqual(['enter:active'])

    handle.send('SLEEP')
    // exit of active, then entry of idle.
    expect(calls).toEqual(['enter:active', 'exit:active', 'enter:idle'])
    expect(handle.getState()).toBe('idle')
  })
})

// ============================================================================
// 5. Preprocessing - comments, directives, notes
// ============================================================================

describe('fromMermaid - preprocessing', () => {
  it('ignores comments, the diagram directive, direction, and notes', () => {
    const config = fromMermaid(`
      %% a leading comment
      stateDiagram-v2
        direction LR
        [*] --> idle  %% trailing comment
        idle --> busy : WORK
        note right of busy
          this is documentation
        end note
        note left of idle : single-line note
    `)
    expect(config.initial).toBe('idle')
    const states = config.states as Record<string, { on?: Record<string, unknown> }>
    expect(states.idle.on).toEqual({ WORK: 'busy' })
    expect(Object.keys(config.states ?? {}).sort()).toEqual(['busy', 'idle'])
  })

  it('works without an explicit `stateDiagram-v2` directive', () => {
    const config = fromMermaid(`
      [*] --> a
      a --> b : GO
    `)
    expect(config.initial).toBe('a')
  })
})

// ============================================================================
// 6. Unsupported constructs - loud rejection naming the construct
// ============================================================================

describe('fromMermaid - unsupported constructs (later slice aip-4fay)', () => {
  it('throws naming composite (nested) states', () => {
    expect(() =>
      fromMermaid(`
        stateDiagram-v2
          [*] --> Review
          state Review {
            [*] --> awaiting
            awaiting --> approved : APPROVE
          }
      `)
    ).toThrow(/Composite \(nested\) states are not supported/)
  })

  it('throws naming parallel regions (`--`)', () => {
    expect(() =>
      fromMermaid(`
        stateDiagram-v2
          [*] --> working
          --
          [*] --> watching
      `)
    ).toThrow(/Parallel regions/)
  })

  it('throws naming history pseudostates', () => {
    expect(() =>
      fromMermaid(`
        stateDiagram-v2
          [*] --> Review
          Review --> [H]
      `)
    ).toThrow(/History pseudostates/)
  })

  it('throws naming choice pseudostates', () => {
    expect(() =>
      fromMermaid(`
        stateDiagram-v2
          state decide <<choice>>
          [*] --> decide
      `)
    ).toThrow(/Choice\/fork\/join pseudostates/)
  })

  it('errors are MermaidParseError instances carrying a line number', () => {
    try {
      fromMermaid(`
        stateDiagram-v2
          [*] --> a
          a --> b
      `)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MermaidParseError)
      expect((err as MermaidParseError).line).toBeTypeOf('number')
    }
  })
})
