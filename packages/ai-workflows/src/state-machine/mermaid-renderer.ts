/**
 * Mermaid `stateDiagram-v2` renderer - the FLAT subset (Slice: aip-jsvj).
 *
 * The exact inverse of {@link import('./mermaid-parser.js').fromMermaid}: walks
 * an xstate `MachineConfig` and emits mermaid `stateDiagram-v2` source for the
 * flat subset (states, initial, transitions, guards, entry/exit actions, final
 * states). Authors who write xstate get a diagram for free; authors who write
 * mermaid see the same diagram round-trip (ADR-0011 — "a diagram is always
 * available regardless of which surface was authored").
 *
 * ## Emitted constructs (this slice — symmetric with the parser)
 *
 *   - **Initial state** — top-level `initial: 'foo'` → `[*] --> foo`.
 *   - **State declarations** — every key in `states` is declared by appearing
 *     in a transition; a state with no transitions/actions and no `final`
 *     marker is emitted as a bare `state foo` line so it is not dropped.
 *   - **Transitions** — `foo.on.EV = 'bar'` → `foo --> bar : EV`.
 *   - **Guarded transitions** — `foo.on.EV = { target: 'bar', guard: 'g' }` →
 *     `foo --> bar : EV [g]`.
 *   - **Entry / exit actions** — `foo.entry = ['act']` → `foo : entry / act`
 *     (one line per action name); likewise `foo.exit`.
 *   - **Final state** — `type: 'final'` → `foo --> [*]`.
 *
 * Guards and actions are **string names** in the config (the parser emits
 * names, never implementations); the renderer emits those names verbatim. This
 * keeps the wire format implementation-free and the round-trip lossless.
 *
 * ## Active-state highlight
 *
 * `toMermaid(config, { highlight })` marks the active state(s) with a mermaid
 * `classDef`. The `highlight` value is an xstate `StateValue`: a string for a
 * flat state (`'running'`), or the nested object xstate uses for composite /
 * parallel configurations (`{ review: 'awaiting' }`). Only flat (string) leaf
 * values are meaningful in this slice; for a nested object the leaf state
 * value(s) are extracted and highlighted. The convention:
 *
 * ```
 * classDef active fill:#fdd835,stroke:#f57f17,stroke-width:2px,color:#000
 * class running active
 * ```
 *
 * `active` is the single highlight class; every active leaf state gets
 * `class <state> active`. The classDef + class lines are appended after the
 * structural lines so the diagram body is identical with or without a
 * highlight (the highlight is purely additive).
 *
 * A highlighted render is a **terminal visualization** (operators / dashboards
 * fetching the current diagram), not a round-trippable wire format: the parser
 * does not consume `classDef` / `class` lines. Round-trip the un-highlighted
 * render (`toMermaid(config)`); the highlighted body up to the first `classDef`
 * line is byte-identical to it.
 *
 * ## Out of scope (later slice: aip-4fay)
 *
 * Composite / nested states (`state X { states: {...} }`), parallel regions
 * (`type: 'parallel'`), and history pseudostates are NOT rendered here.
 * Encountering any of them throws a specific {@link MermaidRenderError} naming
 * the construct — symmetric with the parser's loud rejection, no silent
 * downgrade.
 *
 * @packageDocumentation
 */

import type { MachineConfig, StateValue } from 'xstate'

// =============================================================================
// Types
// =============================================================================

/**
 * The xstate config this renderer consumes. Context / event types are loose
 * (`any`) because the wire format is structural — the same shape the parser
 * produces (see {@link import('./mermaid-parser.js').ParsedMachineConfig}).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RenderableMachineConfig = MachineConfig<any, any>

/** Options for {@link toMermaid}. */
export interface ToMermaidOptions {
  /**
   * Active state value to visually highlight via a mermaid `classDef`. A string
   * for a flat state (`'running'`), or the nested object xstate uses for
   * composite / parallel state configurations. The leaf state value(s) are
   * extracted and marked with the `active` class. When omitted, no highlight is
   * applied and the diagram body is structural only.
   */
  highlight?: StateValue
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Thrown when the config contains a construct outside this slice's flat subset
 * (composite / nested states, parallel regions, history pseudostates). The
 * message names the offending construct and the state it appears on, so the
 * failure is actionable — symmetric with the parser's
 * {@link import('./mermaid-parser.js').MermaidParseError}.
 */
export class MermaidRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MermaidRenderError'
  }
}

// =============================================================================
// Internal state-node shape (mirrors the parser's FlatStateNode)
// =============================================================================

/**
 * The flat-state node shape the renderer reads. Mirrors the xstate shape the
 * parser emits: a transition map, optional entry/exit action-name lists, and an
 * optional `type: 'final'` marker. Out-of-scope members (`states`, `type:
 * 'parallel'`, `history`) are detected and rejected.
 */
interface FlatStateNode {
  on?: Record<string, string | { target?: string; guard?: string } | unknown>
  entry?: unknown
  exit?: unknown
  type?: string
  states?: Record<string, unknown>
  history?: unknown
}

// =============================================================================
// Constants
// =============================================================================

const DIAGRAM_HEADER = 'stateDiagram-v2'
const PSEUDO_INITIAL_FINAL = '[*]'
const HIGHLIGHT_CLASS = 'active'
const HIGHLIGHT_CLASSDEF = `classDef ${HIGHLIGHT_CLASS} fill:#fdd835,stroke:#f57f17,stroke-width:2px,color:#000`

// =============================================================================
// Entry point
// =============================================================================

/**
 * Render an xstate `MachineConfig` to flat-subset mermaid `stateDiagram-v2`
 * source — the exact inverse of
 * {@link import('./mermaid-parser.js').fromMermaid}.
 *
 * The output is deterministic: the header, then the `[*] --> initial` line (if
 * the config has a top-level `initial`), then each state in `states` insertion
 * order — its entry actions, exit actions, outgoing transitions, and its final
 * marker (`foo --> [*]`). A state with no lines of its own is emitted as a bare
 * `state foo` declaration so it survives the round-trip.
 *
 * @param config an xstate `MachineConfig` (the flat subset).
 * @param options optional {@link ToMermaidOptions} — `highlight` marks active
 *   state(s) with a `classDef`.
 * @returns mermaid `stateDiagram-v2` source.
 * @throws {MermaidRenderError} when the config contains an unsupported construct
 *   (composite / nested, parallel, history).
 *
 * @example
 * ```ts
 * const config = {
 *   initial: 'idle',
 *   states: {
 *     idle: { on: { START: 'running' } },
 *     running: { on: { STOP: { target: 'idle', guard: 'canStop' } }, type: 'final' },
 *   },
 * }
 * toMermaid(config)
 * // stateDiagram-v2
 * //   [*] --> idle
 * //   idle --> running : START
 * //   running --> idle : STOP [canStop]
 * //   running --> [*]
 * ```
 */
export function toMermaid(config: RenderableMachineConfig, options: ToMermaidOptions = {}): string {
  const states = (config.states ?? {}) as Record<string, FlatStateNode>
  const initial = typeof config.initial === 'string' ? config.initial : undefined

  // A top-level parallel machine has no flat projection.
  if (config.type === 'parallel') {
    throw new MermaidRenderError(
      'Parallel machines (`type: "parallel"`) are not supported in the flat ' +
        'subset (later slice aip-4fay adds parallel regions)'
    )
  }

  const lines: string[] = [DIAGRAM_HEADER]

  if (initial !== undefined) {
    lines.push(`${indent()}${PSEUDO_INITIAL_FINAL} --> ${initial}`)
  }

  for (const [name, rawNode] of Object.entries(states)) {
    const node = (rawNode ?? {}) as FlatStateNode
    rejectUnsupported(name, node)
    renderState(name, node, lines)
  }

  if (options.highlight !== undefined) {
    appendHighlight(options.highlight, lines)
  }

  return lines.join('\n') + '\n'
}

// =============================================================================
// State rendering
// =============================================================================

/** Two-space indent, matching the parser's tolerated / typical formatting. */
function indent(): string {
  return '  '
}

/**
 * Emit every line a single state contributes, in a deterministic order:
 * entry actions, exit actions, outgoing transitions, then a final marker.
 *
 * A state that contributes no lines at all (no actions, no transitions, not
 * final) is emitted as a bare `state foo` declaration so it round-trips — the
 * parser would otherwise never see it. (States that are only referenced as a
 * transition target are emitted by the source state's transition line, so a
 * referenced-only state needs no bare declaration; we detect "contributes a
 * line" structurally below.)
 */
function renderState(name: string, node: FlatStateNode, lines: string[]): void {
  let emitted = false

  for (const action of toActionNames(node.entry, name, 'entry')) {
    lines.push(`${indent()}${name} : entry / ${action}`)
    emitted = true
  }

  for (const action of toActionNames(node.exit, name, 'exit')) {
    lines.push(`${indent()}${name} : exit / ${action}`)
    emitted = true
  }

  const on = (node.on ?? {}) as Record<string, unknown>
  for (const [event, transition] of Object.entries(on)) {
    lines.push(`${indent()}${renderTransition(name, event, transition)}`)
    emitted = true
  }

  if (node.type === 'final') {
    lines.push(`${indent()}${name} --> ${PSEUDO_INITIAL_FINAL}`)
    emitted = true
  }

  if (!emitted) {
    // Bare declaration so a state with no transitions / actions survives the
    // round-trip (the parser's `state foo` form).
    lines.push(`${indent()}state ${name}`)
  }
}

/**
 * Render one transition line for `state --EVENT--> target`, with an optional
 * guard suffix. Mirrors the parser's label grammar exactly:
 *
 *   - string target           → `state --> target : EVENT`
 *   - `{ target, guard }`      → `state --> target : EVENT [guard]`
 */
function renderTransition(state: string, event: string, transition: unknown): string {
  if (typeof transition === 'string') {
    return `${state} --> ${transition} : ${event}`
  }

  if (transition && typeof transition === 'object' && !Array.isArray(transition)) {
    const t = transition as { target?: unknown; guard?: unknown }
    if (typeof t.target !== 'string' || t.target === '') {
      throw new MermaidRenderError(
        `Transition for event "${event}" on state "${state}" has no string ` +
          '`target`; the flat subset requires a single named target state'
      )
    }
    const target = t.target
    if (t.guard !== undefined) {
      if (typeof t.guard !== 'string') {
        throw new MermaidRenderError(
          `Guard on event "${event}" of state "${state}" must be a string name ` +
            '(the wire format references guards by name, not implementation)'
        )
      }
      return `${state} --> ${target} : ${event} [${t.guard}]`
    }
    return `${state} --> ${target} : ${event}`
  }

  // Arrays (`[ {target}, {target} ]`) are multiple/conditional transitions —
  // out of the flat subset's one-target-per-event grammar.
  throw new MermaidRenderError(
    `Transition for event "${event}" on state "${state}" is not a string ` +
      'target or a single `{ target, guard }` object; multiple / conditional ' +
      'transitions are not in the flat subset (later slice aip-4fay)'
  )
}

/**
 * Coerce an `entry` / `exit` member into a list of string action names. xstate
 * accepts a single action or an array; the parser only ever emits a
 * `string[]`, but we tolerate a lone string too. Non-string actions (inline
 * functions / action objects) are rejected — the wire format references
 * actions by name.
 */
function toActionNames(value: unknown, state: string, kind: 'entry' | 'exit'): string[] {
  if (value === undefined) return []
  const list = Array.isArray(value) ? value : [value]
  return list.map((action) => {
    if (typeof action !== 'string') {
      throw new MermaidRenderError(
        `${kind} action on state "${state}" must be a string name (the wire ` +
          'format references actions by name, not implementation)'
      )
    }
    return action
  })
}

// =============================================================================
// Unsupported-construct detection (loud rejection, symmetric with parser)
// =============================================================================

/**
 * Throw a specific {@link MermaidRenderError} when a state uses a construct
 * outside this slice's flat subset — composite / nested states, parallel
 * regions, or history pseudostates. Symmetric with the parser's
 * `rejectUnsupported`.
 */
function rejectUnsupported(name: string, node: FlatStateNode): void {
  if (node.states && Object.keys(node.states).length > 0) {
    throw new MermaidRenderError(
      `Composite (nested) state "${name}" is not supported in the flat subset; ` +
        'render a flat machine (later slice aip-4fay adds composite states)'
    )
  }

  if (node.type === 'parallel') {
    throw new MermaidRenderError(
      `Parallel state "${name}" (\`type: "parallel"\`) is not supported in the ` +
        'flat subset (later slice aip-4fay adds parallel regions)'
    )
  }

  if (node.type === 'history') {
    throw new MermaidRenderError(
      `History state "${name}" (\`type: "history"\`) is not supported in the ` +
        'flat subset (later slice aip-4fay adds history)'
    )
  }

  if (node.history !== undefined) {
    throw new MermaidRenderError(
      `History marker on state "${name}" is not supported in the flat subset ` +
        '(later slice aip-4fay adds history)'
    )
  }

  if (node.type !== undefined && node.type !== 'final') {
    throw new MermaidRenderError(
      `Unsupported state type "${String(node.type)}" on state "${name}"; the ` +
        'flat subset supports only `type: "final"`'
    )
  }
}

// =============================================================================
// Highlight
// =============================================================================

/**
 * Append the highlight `classDef` and a `class <state> active` line for every
 * active leaf state extracted from `highlight`. The lines are additive — the
 * structural diagram above is unchanged whether or not a highlight is applied.
 */
function appendHighlight(highlight: StateValue, lines: string[]): void {
  const active = leafStateValues(highlight)
  if (active.length === 0) return

  lines.push(`${indent()}${HIGHLIGHT_CLASSDEF}`)
  for (const state of active) {
    lines.push(`${indent()}class ${state} ${HIGHLIGHT_CLASS}`)
  }
}

/**
 * Extract the leaf state value(s) from an xstate `StateValue`. A string is a
 * single flat leaf. A nested object (composite / parallel) is walked to its
 * leaves: each value that is itself a string is a leaf; each value that is an
 * object recurses. Duplicate leaf names are de-duplicated while preserving
 * first-seen order.
 */
function leafStateValues(value: StateValue): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  function walk(v: StateValue): void {
    if (typeof v === 'string') {
      if (!seen.has(v)) {
        seen.add(v)
        out.push(v)
      }
      return
    }
    // A nested object: keys name regions / parent states; values are the
    // active child value(s). Walk the values down to their leaves.
    for (const child of Object.values(v)) {
      walk(child as StateValue)
    }
  }

  walk(value)
  return out
}
