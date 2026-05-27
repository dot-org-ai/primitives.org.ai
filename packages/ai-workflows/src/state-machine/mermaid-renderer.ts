/**
 * Mermaid `stateDiagram-v2` renderer - FULL Harel statechart coverage (Slice:
 * aip-4fay).
 *
 * The exact inverse of {@link import('./mermaid-parser.js').fromMermaid}: walks
 * an xstate `MachineConfig` and emits mermaid `stateDiagram-v2` source. Authors
 * who write xstate get a diagram for free; authors who write mermaid see the
 * same diagram round-trip (ADR-0011 — "a diagram is always available regardless
 * of which surface was authored").
 *
 * This slice widens the earlier flat-subset renderer (aip-jsvj) to the full
 * statechart formalism, staying the exact inverse of the parser at every step.
 *
 * ## Emitted constructs (symmetric with the parser)
 *
 *   - **Initial state** — a scope's `initial: 'foo'` → `[*] --> foo` (top-level
 *     or inside a composite / region).
 *   - **State declarations** — every key in `states` is declared by appearing
 *     in a transition; a state with no transitions/actions and no `final`
 *     marker is emitted as a bare `state foo` line so it is not dropped.
 *   - **Transitions** — `foo.on.EV = 'bar'` → `foo --> bar : EV`.
 *   - **Guarded transitions** — `foo.on.EV = { target: 'bar', guard: 'g' }` →
 *     `foo --> bar : EV [g]`.
 *   - **Entry / exit actions** — `foo.entry = ['act']` → `foo : entry / act`
 *     (one line per action name); likewise `foo.exit`.
 *   - **Final state** — `type: 'final'` → `foo --> [*]`.
 *   - **Composite (nested) states** — a node with nested `states` → `state Foo
 *     { ... }`; the scope's `initial` becomes the inner `[*] --> child`.
 *   - **Parallel regions** — `type: 'parallel'` → a composite whose child
 *     regions are separated by `--`; each region is emitted as a nested
 *     `state Region { ... }` block.
 *   - **History pseudostates** — a `{ type: 'history', history: 'shallow' }`
 *     node is NOT declared as a state; transitions targeting it render `--> [H]`
 *     (`'deep'` → `[H*]`), and an optional default target renders `[H] -->
 *     default`.
 *   - **Choice pseudostates** — a node with an `always` array → `state c
 *     <<choice>>` plus `c --> target : [guard]` / `c --> target : [else]`
 *     outgoing branches.
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
 * parallel configurations (`{ review: 'awaiting' }`). The leaf state value(s)
 * are extracted and highlighted. The convention:
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
 * Thrown when the config contains a construct the renderer cannot map back to
 * mermaid — an inline (non-string) guard / action, a transition with no string
 * target, or an `<<fork>>` / `<<join>>`-shaped construct outside the parallel
 * model. The message names the offending construct and the state it appears on,
 * so the failure is actionable — symmetric with the parser's
 * {@link import('./mermaid-parser.js').MermaidParseError}.
 */
export class MermaidRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MermaidRenderError'
  }
}

// =============================================================================
// Internal state-node shape (mirrors the parser's StateNode)
// =============================================================================

/** A transition value as it appears in a `MachineConfig`. */
type RawTransition = string | { target?: unknown; guard?: unknown } | unknown

/**
 * The state-node shape the renderer reads. Mirrors the xstate shape the parser
 * emits across the full statechart formalism: a transition map, eventless
 * `always` branches (choice), entry/exit action-name lists, an optional state
 * `type`, history depth + default target, and nested child states.
 */
interface RenderStateNode {
  on?: Record<string, RawTransition>
  always?: unknown
  entry?: unknown
  exit?: unknown
  type?: string
  history?: unknown
  target?: unknown
  initial?: unknown
  states?: Record<string, unknown>
}

// =============================================================================
// Constants
// =============================================================================

const DIAGRAM_HEADER = 'stateDiagram-v2'
const PSEUDO_INITIAL_FINAL = '[*]'
const HISTORY_SHALLOW = '[H]'
const HISTORY_DEEP = '[H*]'
const HIGHLIGHT_CLASS = 'active'
const HIGHLIGHT_CLASSDEF = `classDef ${HIGHLIGHT_CLASS} fill:#fdd835,stroke:#f57f17,stroke-width:2px,color:#000`

// =============================================================================
// Entry point
// =============================================================================

/**
 * Render an xstate `MachineConfig` to mermaid `stateDiagram-v2` source — the
 * exact inverse of {@link import('./mermaid-parser.js').fromMermaid}.
 *
 * The output is deterministic: the header, then the `[*] --> initial` line (if
 * the scope has an `initial`), then each state in `states` insertion order — its
 * entry / exit actions, outgoing transitions, nested body (for composite /
 * parallel states), and its final marker (`foo --> [*]`). A state with no lines
 * of its own is emitted as a bare `state foo` declaration so it survives the
 * round-trip. History nodes are not declared as states (they appear only as
 * transition targets `[H]` / `[H*]`); choice nodes emit a `<<choice>>`
 * declaration plus their guarded `always` branches.
 *
 * @param config an xstate `MachineConfig`.
 * @param options optional {@link ToMermaidOptions} — `highlight` marks active
 *   state(s) with a `classDef`.
 * @returns mermaid `stateDiagram-v2` source.
 * @throws {MermaidRenderError} when the config contains a construct that cannot
 *   be mapped back to mermaid (inline guard / action, targetless transition).
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
  const lines: string[] = [DIAGRAM_HEADER]

  // The top-level scope is the machine config itself; render it like any other
  // scope at depth 1 (one indent under the header).
  renderScope(config as RenderStateNode, lines, 1)

  if (options.highlight !== undefined) {
    appendHighlight(options.highlight, lines)
  }

  return lines.join('\n') + '\n'
}

// =============================================================================
// Scope rendering (recursive — composites and parallel regions nest)
// =============================================================================

/**
 * Render one scope — the top-level machine, the body of a composite state, or
 * the body of one parallel region — into `lines`, indented to `depth`.
 *
 * Order: the scope's `[*] --> initial` line (when present and not parallel),
 * then each non-history state in `states` insertion order, then the scope's
 * history default-target lines. Parallel scopes (`type: 'parallel'`) emit each
 * child region as a nested `state Region { ... }` block separated by `--`.
 */
function renderScope(scope: RenderStateNode, lines: string[], depth: number): void {
  const states = (scope.states ?? {}) as Record<string, RenderStateNode>

  if (scope.type === 'parallel') {
    renderParallelRegions(states, lines, depth)
    return
  }

  if (typeof scope.initial === 'string') {
    lines.push(`${indent(depth)}${PSEUDO_INITIAL_FINAL} --> ${scope.initial}`)
  }

  // History nodes are not declared as states; collect them so transitions can
  // resolve a target name to its `[H]` / `[H*]` token, and emit their default
  // targets after the regular states.
  const histTokens = historyTokens(states)
  const histTargetedInScope = inScopeHistoryTargets(states)

  for (const [name, rawNode] of Object.entries(states)) {
    const node = (rawNode ?? {}) as RenderStateNode
    if (node.type === 'history') continue // rendered as `[H]` targets, not states
    renderState(name, node, lines, depth, histTokens)
  }

  // History children: emit a bare `[H]` / `[H*]` declaration for any that no
  // in-scope transition targets (they are re-entered only by a cross-boundary
  // `Composite[H]` from an outer state, so without this line the composite would
  // not declare its history child), and a `[H] --> default` line for any with a
  // default target.
  for (const [name, rawNode] of Object.entries(states)) {
    const node = (rawNode ?? {}) as RenderStateNode
    if (node.type !== 'history') continue
    if (typeof node.target === 'string' && node.target !== '') {
      lines.push(`${indent(depth)}${historyToken(node)} --> ${node.target}`)
    } else if (!histTargetedInScope.has(name)) {
      lines.push(`${indent(depth)}${historyToken(node)}`)
    }
  }
}

/**
 * Collect the set of history-child names that an in-scope transition targets
 * (`foo --> hist`). A history child targeted in-scope is rendered via that
 * transition's `[H]` token; one targeted only across a composite boundary needs
 * a bare `[H]` declaration line so the composite still declares it.
 */
function inScopeHistoryTargets(states: Record<string, RenderStateNode>): Set<string> {
  const targeted = new Set<string>()
  const histNames = new Set(
    Object.entries(states)
      .filter(([, n]) => (n as RenderStateNode | undefined)?.type === 'history')
      .map(([name]) => name)
  )
  for (const rawNode of Object.values(states)) {
    const node = (rawNode ?? {}) as RenderStateNode
    const on = (node.on ?? {}) as Record<string, RawTransition>
    for (const transition of Object.values(on)) {
      const target =
        typeof transition === 'string'
          ? transition
          : transition && typeof transition === 'object' && !Array.isArray(transition)
          ? (transition as { target?: unknown }).target
          : undefined
      if (typeof target === 'string' && histNames.has(target)) targeted.add(target)
    }
  }
  return targeted
}

/**
 * Render a `type: 'parallel'` scope's child regions as `--`-separated nested
 * `state Region { ... }` blocks. Each region child is itself a composite (the
 * `state A { ... } -- state B { ... }` idiom the parser canonicalises to), so
 * we emit it as a nested composite and join successive regions with a `--`
 * separator line.
 */
function renderParallelRegions(
  states: Record<string, RenderStateNode>,
  lines: string[],
  depth: number
): void {
  const entries = Object.entries(states)
  entries.forEach(([name, rawNode], idx) => {
    if (idx > 0) lines.push(`${indent(depth)}--`)
    const node = (rawNode ?? {}) as RenderStateNode
    renderComposite(name, node, lines, depth)
  })
}

/**
 * Emit every line a single (non-history) state contributes, in a deterministic
 * order: entry actions, exit actions, a `<<choice>>` declaration + its branches,
 * outgoing transitions, a nested composite / parallel body, then a final
 * marker.
 *
 * A state that contributes no lines at all (no actions, transitions, choice,
 * nested body, and not final) is emitted as a bare `state foo` declaration so
 * it round-trips — the parser would otherwise never see it.
 */
function renderState(
  name: string,
  node: RenderStateNode,
  lines: string[],
  depth: number,
  histTokens: Map<string, string>
): void {
  let emitted = false
  const ind = indent(depth)

  for (const action of toActionNames(node.entry, name, 'entry')) {
    lines.push(`${ind}${name} : entry / ${action}`)
    emitted = true
  }

  for (const action of toActionNames(node.exit, name, 'exit')) {
    lines.push(`${ind}${name} : exit / ${action}`)
    emitted = true
  }

  // Choice pseudostate: declare `<<choice>>` then emit each `always` branch.
  if (node.always !== undefined) {
    lines.push(`${ind}state ${name} <<choice>>`)
    renderChoiceBranches(name, node.always, lines, depth, histTokens)
    emitted = true
  }

  const on = (node.on ?? {}) as Record<string, RawTransition>
  for (const [event, transition] of Object.entries(on)) {
    lines.push(`${ind}${renderTransition(name, event, transition, histTokens)}`)
    emitted = true
  }

  // Nested composite / parallel body.
  if (isComposite(node)) {
    renderComposite(name, node, lines, depth)
    emitted = true
  }

  if (node.type === 'final') {
    lines.push(`${ind}${name} --> ${PSEUDO_INITIAL_FINAL}`)
    emitted = true
  }

  if (!emitted) {
    // Bare declaration so a state with no transitions / actions survives the
    // round-trip (the parser's `state foo` form).
    lines.push(`${ind}state ${name}`)
  }
}

/**
 * Render a composite (or parallel) state as a `state Foo { ... }` block: the
 * opener, the recursively-rendered inner scope (indented one level deeper), and
 * the closing brace.
 */
function renderComposite(
  name: string,
  node: RenderStateNode,
  lines: string[],
  depth: number
): void {
  lines.push(`${indent(depth)}state ${name} {`)
  renderScope(node, lines, depth + 1)
  lines.push(`${indent(depth)}}`)
}

/**
 * Render a `<<choice>>` state's `always` array into eventless guarded outgoing
 * lines: `name --> target : [guard]`, and `name --> target : [else]` for the
 * unguarded default branch (the branch with no `guard`).
 */
function renderChoiceBranches(
  name: string,
  always: unknown,
  lines: string[],
  depth: number,
  histTokens: Map<string, string>
): void {
  if (!Array.isArray(always)) {
    throw new MermaidRenderError(
      `Choice state "${name}" has a non-array \`always\`; the wire format ` +
        'expects an ordered list of guarded branches'
    )
  }
  for (const branch of always) {
    if (!branch || typeof branch !== 'object' || Array.isArray(branch)) {
      throw new MermaidRenderError(
        `Choice state "${name}" has a branch that is not a \`{ target, guard }\` object`
      )
    }
    const b = branch as { target?: unknown; guard?: unknown }
    if (typeof b.target !== 'string' || b.target === '') {
      throw new MermaidRenderError(`A branch of choice state "${name}" has no string \`target\``)
    }
    const target = resolveTarget(b.target, histTokens)
    if (b.guard === undefined) {
      lines.push(`${indent(depth)}${name} --> ${target} : [else]`)
    } else {
      if (typeof b.guard !== 'string') {
        throw new MermaidRenderError(
          `Guard on a branch of choice state "${name}" must be a string name ` +
            '(the wire format references guards by name, not implementation)'
        )
      }
      lines.push(`${indent(depth)}${name} --> ${target} : [${b.guard}]`)
    }
  }
}

/**
 * Render one transition line for `state --EVENT--> target`, with an optional
 * guard suffix. A target that names a history node in the current scope renders
 * as the `[H]` / `[H*]` token. Mirrors the parser's label grammar exactly:
 *
 *   - string target           → `state --> target : EVENT`
 *   - `{ target, guard }`      → `state --> target : EVENT [guard]`
 */
function renderTransition(
  state: string,
  event: string,
  transition: RawTransition,
  histTokens: Map<string, string>
): string {
  if (typeof transition === 'string') {
    return `${state} --> ${resolveTarget(transition, histTokens)} : ${event}`
  }

  if (transition && typeof transition === 'object' && !Array.isArray(transition)) {
    const t = transition as { target?: unknown; guard?: unknown }
    if (typeof t.target !== 'string' || t.target === '') {
      throw new MermaidRenderError(
        `Transition for event "${event}" on state "${state}" has no string ` +
          '`target`; a single named target state is required'
      )
    }
    const target = resolveTarget(t.target, histTokens)
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

  // Arrays (`[ {target}, {target} ]`) are multiple/conditional transitions on a
  // regular `on` event — not expressible in mermaid's one-target-per-event
  // grammar (choice states use `always`, not an `on`-keyed array).
  throw new MermaidRenderError(
    `Transition for event "${event}" on state "${state}" is not a string ` +
      'target or a single `{ target, guard }` object; multiple / conditional ' +
      'transitions on a single event are not expressible in mermaid'
  )
}

/**
 * Resolve a transition target name to the mermaid token to emit:
 *
 *   - a target naming a history node in the CURRENT scope → its `[H]` / `[H*]`
 *     token (the in-scope history form);
 *   - a dotted cross-boundary target `Composite.hist` / `Composite.deepHist`
 *     (an outer state re-entering a composite's history) → `Composite[H]` /
 *     `Composite[H*]`;
 *   - everything else → the name verbatim.
 */
function resolveTarget(target: string, histTokens: Map<string, string>): string {
  const inScope = histTokens.get(target)
  if (inScope) return inScope

  const dotted = target.match(/^([A-Za-z0-9_]+)\.(deepHist|hist)$/)
  if (dotted && dotted[1] && dotted[2]) {
    return `${dotted[1]}${dotted[2] === 'deepHist' ? HISTORY_DEEP : HISTORY_SHALLOW}`
  }

  return target
}

/**
 * Build a map from history-node name to its mermaid token (`[H]` for shallow,
 * `[H*]` for deep) for the states in one scope. Used to re-emit a transition
 * that targets a history node as `--> [H]` / `--> [H*]`.
 */
function historyTokens(states: Record<string, RenderStateNode>): Map<string, string> {
  const map = new Map<string, string>()
  for (const [name, rawNode] of Object.entries(states)) {
    const node = (rawNode ?? {}) as RenderStateNode
    if (node.type === 'history') map.set(name, historyToken(node))
  }
  return map
}

/** The mermaid token for a history node: `[H*]` when deep, `[H]` otherwise. */
function historyToken(node: RenderStateNode): string {
  return node.history === 'deep' ? HISTORY_DEEP : HISTORY_SHALLOW
}

/**
 * A node is a composite when it has nested `states` (or is parallel). History
 * nodes never reach here (they are filtered before {@link renderState}).
 */
function isComposite(node: RenderStateNode): boolean {
  if (node.type === 'parallel') return true
  return node.states !== undefined && Object.keys(node.states).length > 0
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
// Indentation
// =============================================================================

/**
 * Two spaces per nesting level. The parser trims leading whitespace, so
 * indentation is cosmetic for round-trip purposes — but nesting composites
 * makes the emitted diagram readable.
 */
function indent(depth: number): string {
  return '  '.repeat(depth)
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

  lines.push(`${indent(1)}${HIGHLIGHT_CLASSDEF}`)
  for (const state of active) {
    lines.push(`${indent(1)}class ${state} ${HIGHLIGHT_CLASS}`)
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
