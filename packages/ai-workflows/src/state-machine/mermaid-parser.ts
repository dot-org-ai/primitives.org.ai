/**
 * Mermaid `stateDiagram-v2` parser - the FLAT subset (Slice: aip-mdw0).
 *
 * Parses the flat subset of mermaid `stateDiagram-v2` source into an xstate
 * `MachineConfig` that {@link import('./runtime.js').runMachine | runMachine}
 * can execute. It is the LLM-authorable / human-readable wire format from
 * ADR-0011: an LLM emits mermaid, this parser validates it by turning it into a
 * runnable config, and generations that fail to parse are retried upstream.
 *
 * ## Supported constructs (this slice)
 *
 *   - **State declarations** — `state foo`, `state "Label" as foo`, and
 *     implicit states that first appear in a transition.
 *   - **Initial state** — `[*] --> foo` maps to the top-level `initial: 'foo'`.
 *   - **Transitions** — `foo --> bar : EVENT` maps to `foo.on.EVENT = 'bar'`.
 *   - **Guarded transitions** — `foo --> bar : EVENT [guardName]` maps to
 *     `foo.on.EVENT = { target: 'bar', guard: 'guardName' }`.
 *   - **Entry / exit actions** — `foo : entry / actName` maps to
 *     `foo.entry = ['actName']`; `foo : exit / actName` maps to
 *     `foo.exit = ['actName']`.
 *   - **Final state** — `foo --> [*]` marks `foo` as a `type: 'final'` state.
 *
 * ## How parsed configs reference guards and actions
 *
 * Guards and actions are emitted as **string names** (`guard: 'guardName'`,
 * `entry: ['actName']`) — never inline implementations. xstate resolves these
 * names at machine-creation time, so the caller supplies the implementations
 * via `setup({ guards, actions }).createMachine(config)` or
 * `createMachine(config).provide({ guards, actions })`. A `MachineConfig` whose
 * guards/actions are unprovided still creates; an unprovided guard evaluates
 * falsy (the transition does not fire) and an unprovided action is a no-op.
 * This keeps the wire format implementation-free — later slices (renderer,
 * event bridge) and any caller round-trip against names alone.
 *
 * ## Out of scope (later slice: aip-4fay)
 *
 * Composite / nested states (`state X { ... }`), parallel regions (`--`),
 * history pseudostates (`[H]` / `[H*]`), and choice pseudostates
 * (`<<choice>>`) are NOT handled here. Encountering any of them throws a
 * specific, actionable error naming the construct — there is no silent
 * downgrade (per ADR-0011: "reject ambiguous syntax loudly").
 *
 * @packageDocumentation
 */

import type { MachineConfig } from 'xstate'

// =============================================================================
// Types
// =============================================================================

/**
 * The xstate config this parser produces. Context and event types are loose
 * (`any`) because the wire format is structural — the produced config is fed
 * straight into `createMachine` / `runMachine`, which are wire-format-agnostic.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParsedMachineConfig = MachineConfig<any, any>

/**
 * A single flat-state node in the config under construction. Mirrors the xstate
 * shape this slice emits: a transition map, optional entry/exit action-name
 * lists, and an optional `type: 'final'` marker.
 */
interface FlatStateNode {
  on?: Record<string, string | { target: string; guard: string }>
  entry?: string[]
  exit?: string[]
  type?: 'final'
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Thrown when the source contains a `stateDiagram-v2` construct outside this
 * slice's flat subset (composite states, parallel regions, history / choice
 * pseudostates), or when a line cannot be parsed. The message names the
 * offending construct and (where known) the 1-based source line, so an LLM
 * retry round produces a corrected output.
 */
export class MermaidParseError extends Error {
  /** 1-based line number the error was detected on, when known. */
  readonly line: number | undefined

  constructor(message: string, line?: number) {
    super(line ? `${message} (line ${line})` : message)
    this.name = 'MermaidParseError'
    this.line = line
  }
}

// =============================================================================
// Token / line shapes
// =============================================================================

/** A source line paired with its 1-based number, after stripping comments. */
interface SourceLine {
  readonly text: string
  readonly number: number
}

const PSEUDO_INITIAL_FINAL = '[*]'

// =============================================================================
// Entry point
// =============================================================================

/**
 * Parse flat-subset mermaid `stateDiagram-v2` source into an xstate
 * `MachineConfig`.
 *
 * The produced config has a top-level `initial` (from `[*] --> foo`) and a
 * `states` map. Transitions become `on` entries; guards and entry/exit actions
 * become string names the caller provides at machine-creation time (see the
 * module docs). The result drops straight into `runMachine` /
 * `createStateMachine`.
 *
 * @param source mermaid `stateDiagram-v2` source text.
 * @returns an xstate `MachineConfig` ready for `createMachine` / `runMachine`.
 * @throws {MermaidParseError} when the source contains an unsupported construct
 *   (composite, parallel, history, choice) or a line cannot be parsed.
 *
 * @example
 * ```ts
 * const config = fromMermaid(`
 *   stateDiagram-v2
 *     [*] --> idle
 *     idle --> running : START
 *     running --> idle : STOP [canStop]
 *     running --> [*]
 * `)
 * // config.initial === 'idle'
 * // config.states.idle.on.START === 'running'
 * // config.states.running.on.STOP === { target: 'idle', guard: 'canStop' }
 *
 * const handle = await runMachine(
 *   createStateMachine(config).provide({ guards: { canStop: () => true } }),
 *   createInMemoryStateMachineStorage()
 * )
 * ```
 */
export function fromMermaid(source: string): ParsedMachineConfig {
  const lines = preprocess(source)

  // States are inserted in first-seen order so the output is stable.
  const states = new Map<string, FlatStateNode>()
  let initial: string | undefined

  function nodeFor(name: string): FlatStateNode {
    let node = states.get(name)
    if (!node) {
      node = {}
      states.set(name, node)
    }
    return node
  }

  for (const line of lines) {
    rejectUnsupported(line)

    if (tryTransition(line, nodeFor, (init) => (initial = init))) continue
    if (tryStateAttribute(line, nodeFor)) continue
    if (tryStateDeclaration(line, nodeFor)) continue

    throw new MermaidParseError(`Could not parse line: "${line.text}"`, line.number)
  }

  // Assemble the config. `initial` is omitted (rather than set to undefined)
  // when no `[*] --> foo` line was present — a machine without an explicit
  // initial is still a valid (if unusual) config; xstate defaults to the
  // first declared state.
  const config: ParsedMachineConfig = { states: {} }
  if (initial !== undefined) config.initial = initial

  for (const [name, node] of states) {
    // Strip empty optional members so the emitted config is minimal and stable
    // for round-trip comparison.
    const out: FlatStateNode = {}
    if (node.on && Object.keys(node.on).length > 0) out.on = node.on
    if (node.entry && node.entry.length > 0) out.entry = node.entry
    if (node.exit && node.exit.length > 0) out.exit = node.exit
    if (node.type) out.type = node.type
    ;(config.states as Record<string, FlatStateNode>)[name] = out
  }

  if (initial !== undefined && !states.has(initial)) {
    // `[*] --> foo` named a target that never appeared elsewhere; it is still
    // a real state. (nodeFor created it during the transition parse, so this
    // is defensive — kept for clarity.)
    ;(config.states as Record<string, FlatStateNode>)[initial] = {}
  }

  return config
}

// =============================================================================
// Preprocessing
// =============================================================================

/**
 * Strip the diagram header, comments, blank lines, and `note` blocks; return
 * the remaining significant lines with their original 1-based numbers.
 *
 * - The leading `stateDiagram-v2` (and the legacy `stateDiagram`) directive is
 *   dropped; its presence is not required but is tolerated.
 * - `%%` line comments and trailing `%% ...` comments are removed.
 * - `note ... end note` blocks and single-line `note ... : ...` are ignored
 *   (documentation only, per the mapping table).
 * - `direction TB|LR|...` layout hints are ignored.
 */
function preprocess(source: string): SourceLine[] {
  const out: SourceLine[] = []
  let inNoteBlock = false

  const rawLines = source.split(/\r?\n/)
  for (let i = 0; i < rawLines.length; i++) {
    const number = i + 1
    const text = stripComment(rawLines[i] ?? '').trim()
    if (text === '') continue

    // Drop the diagram directive (with optional trailing tokens).
    if (/^stateDiagram(-v2)?\b/.test(text)) continue

    // Ignore layout direction hints.
    if (/^direction\s+/i.test(text)) continue

    // `note` handling — documentation only.
    if (inNoteBlock) {
      if (/^end\s+note\b/i.test(text)) inNoteBlock = false
      continue
    }
    if (/^note\b/i.test(text)) {
      // A single-line note (`note right of foo : text`) ends on the same line;
      // a block note (`note right of foo` ... `end note`) opens a block.
      if (!text.includes(':') && !/^end\s+note/i.test(text)) {
        // Heuristic: `note <pos> of X` with no colon opens a block.
        inNoteBlock = true
      }
      continue
    }

    out.push({ text, number })
  }

  if (inNoteBlock) {
    throw new MermaidParseError('Unterminated `note` block (missing `end note`)')
  }

  return out
}

/** Remove a `%%` comment from a line (mermaid uses `%%` for comments). */
function stripComment(line: string): string {
  const idx = line.indexOf('%%')
  return idx === -1 ? line : line.slice(0, idx)
}

// =============================================================================
// Unsupported-construct detection (loud rejection, no silent downgrade)
// =============================================================================

/**
 * Throw a specific {@link MermaidParseError} when a line uses a construct
 * outside this slice's flat subset. Detected here so the error names the exact
 * unsupported feature rather than failing as a generic parse error downstream.
 */
function rejectUnsupported(line: SourceLine): void {
  const { text, number } = line

  // Composite / nested state: `state Foo {` or a bare `{` / `}`.
  if (/\bstate\b[^:]*\{/.test(text) || text === '{' || text === '}' || /\{\s*$/.test(text)) {
    throw new MermaidParseError(
      'Composite (nested) states are not supported in the flat subset; ' +
        'use a flat diagram (later slice aip-4fay adds composite states)',
      number
    )
  }

  // Parallel region separator: a line that is exactly `--` (concurrency).
  if (text === '--') {
    throw new MermaidParseError(
      'Parallel regions (`--`) are not supported in the flat subset ' +
        '(later slice aip-4fay adds parallel regions)',
      number
    )
  }

  // History pseudostates: `[H]` (shallow) / `[H*]` (deep).
  if (/\[H\*?\]/.test(text)) {
    throw new MermaidParseError(
      'History pseudostates (`[H]` / `[H*]`) are not supported in the flat ' +
        'subset (later slice aip-4fay adds history)',
      number
    )
  }

  // Choice / fork / join pseudostates: `state foo <<choice>>` etc.
  const pseudo = text.match(/<<\s*(choice|fork|join)\s*>>/i)
  if (pseudo) {
    const kind = (pseudo[1] ?? '').toLowerCase()
    throw new MermaidParseError(
      `Choice/fork/join pseudostates (\`<<${kind}>>\`) are ` +
        'not supported in the flat subset (later slice aip-4fay adds them)',
      number
    )
  }
}

// =============================================================================
// Line parsers - each returns true when it consumed the line
// =============================================================================

/**
 * Parse a transition line: `A --> B`, optionally `: EVENT` and `[guard]`, and
 * the `[*]` pseudostate on either side.
 *
 *   - `[*] --> foo`        → sets `initial = 'foo'`
 *   - `foo --> [*]`        → marks `foo` as `type: 'final'`
 *   - `foo --> bar : EV`   → `foo.on.EV = 'bar'`
 *   - `foo --> bar : EV [g]` → `foo.on.EV = { target: 'bar', guard: 'g' }`
 *   - `foo --> bar`        → `foo.on[''] = 'bar'` is rejected; an unlabelled
 *     transition between two real states has no event to key on, so it is a
 *     parse error (an always-transition would be `foo --> bar` in xstate's
 *     `always`, which is out of this flat subset).
 */
function tryTransition(
  line: SourceLine,
  nodeFor: (name: string) => FlatStateNode,
  setInitial: (name: string) => void
): boolean {
  const arrowIdx = line.text.indexOf('-->')
  if (arrowIdx === -1) return false

  const source = line.text.slice(0, arrowIdx).trim()
  const rest = line.text.slice(arrowIdx + 3).trim()

  // Split the target from an optional `: label`.
  let target: string
  let label: string | undefined
  const colonIdx = rest.indexOf(':')
  if (colonIdx === -1) {
    target = rest.trim()
  } else {
    target = rest.slice(0, colonIdx).trim()
    label = rest.slice(colonIdx + 1).trim()
  }

  if (source === '' || target === '') {
    throw new MermaidParseError(`Malformed transition: "${line.text}"`, line.number)
  }

  // Initial: `[*] --> foo`
  if (source === PSEUDO_INITIAL_FINAL) {
    if (target === PSEUDO_INITIAL_FINAL) {
      throw new MermaidParseError('Transition from `[*]` to `[*]` is meaningless', line.number)
    }
    nodeFor(target) // ensure the initial state exists
    setInitial(target)
    if (label) {
      throw new MermaidParseError(
        'The initial transition `[*] --> foo` does not take an event label',
        line.number
      )
    }
    return true
  }

  // Final: `foo --> [*]`
  if (target === PSEUDO_INITIAL_FINAL) {
    const node = nodeFor(source)
    node.type = 'final'
    // An event label on a final transition (`foo --> [*] : DONE`) is dropped —
    // entering `foo` is itself terminal in this flat model. Reject it so the
    // author does not assume event-gated finalisation.
    if (label) {
      throw new MermaidParseError(
        'A final transition `foo --> [*]` does not take an event label in the ' +
          'flat subset; mark the target state final instead',
        line.number
      )
    }
    return true
  }

  // Regular transition between two named states. An event label is required —
  // the flat subset keys transitions on events (`on.EVENT`).
  if (!label) {
    throw new MermaidParseError(
      `Transition "${source} --> ${target}" needs an event label ` +
        '(`: EVENT`); unlabelled (always) transitions are not in the flat subset',
      line.number
    )
  }

  const { event, guard } = parseLabel(label, line)
  nodeFor(target) // ensure the target exists as a state
  const node = nodeFor(source)
  node.on ??= {}

  if (node.on[event] !== undefined) {
    throw new MermaidParseError(
      `Duplicate transition for event "${event}" from state "${source}"`,
      line.number
    )
  }

  node.on[event] = guard ? { target, guard } : target
  return true
}

/**
 * Parse a transition label into an event name and optional guard.
 *
 *   - `EVENT`           → `{ event: 'EVENT' }`
 *   - `EVENT [guard]`   → `{ event: 'EVENT', guard: 'guard' }`
 */
function parseLabel(label: string, line: SourceLine): { event: string; guard?: string } {
  const guardMatch = label.match(/^(.*?)\s*\[([^\]]*)\]\s*$/)
  if (guardMatch) {
    const event = (guardMatch[1] ?? '').trim()
    const guard = (guardMatch[2] ?? '').trim()
    if (event === '') {
      throw new MermaidParseError(
        `Guarded transition is missing an event name before "[${guard}]"`,
        line.number
      )
    }
    if (guard === '') {
      throw new MermaidParseError(`Empty guard "[]" in transition label`, line.number)
    }
    return { event, guard }
  }
  return { event: label }
}

/**
 * Parse a state-attribute line: `foo : entry / actName` or
 * `foo : exit / actName`. Returns false (not consumed) when the line is not a
 * `state : ...` attribute (e.g. it is a `state "label" as id` declaration,
 * handled elsewhere) — the caller falls through to the next parser.
 *
 * Only `entry / X` and `exit / X` are recognised. Any other `state : text`
 * (a description) is treated as a documentation label and ignored, with the
 * state ensured to exist.
 */
function tryStateAttribute(line: SourceLine, nodeFor: (name: string) => FlatStateNode): boolean {
  // Must contain a colon and must NOT be a transition (already handled).
  const colonIdx = line.text.indexOf(':')
  if (colonIdx === -1) return false
  // A `state "X" as id` declaration also has no colon-attribute meaning here.
  if (/^state\b/.test(line.text)) return false

  const name = line.text.slice(0, colonIdx).trim()
  const attr = line.text.slice(colonIdx + 1).trim()
  if (name === '' || name.includes(' ')) return false // not a simple `id : ...`

  const action = attr.match(/^(entry|exit)\s*\/\s*(.+)$/)
  if (action) {
    const kind = action[1] as 'entry' | 'exit'
    const actionName = (action[2] ?? '').trim()
    if (actionName === '') {
      throw new MermaidParseError(`Empty ${kind} action name in "${line.text}"`, line.number)
    }
    const node = nodeFor(name)
    const list = (node[kind] ??= [])
    list.push(actionName)
    return true
  }

  // A plain description label (`idle : waiting for input`) — ensure the state
  // exists and ignore the label (documentation only).
  nodeFor(name)
  return true
}

/**
 * Parse a bare state declaration:
 *
 *   - `state foo`            → ensures `foo` exists
 *   - `state "Label" as foo` → ensures `foo` exists (label is documentation)
 *   - `foo`                  → a bare identifier on its own line declares a
 *     state (mermaid allows this)
 */
function tryStateDeclaration(line: SourceLine, nodeFor: (name: string) => FlatStateNode): boolean {
  const text = line.text

  // `state "Label" as id`
  const aliased = text.match(/^state\s+"[^"]*"\s+as\s+([A-Za-z0-9_]+)\s*$/)
  if (aliased && aliased[1]) {
    nodeFor(aliased[1])
    return true
  }

  // `state id`
  const declared = text.match(/^state\s+([A-Za-z0-9_]+)\s*$/)
  if (declared && declared[1]) {
    nodeFor(declared[1])
    return true
  }

  // bare `id`
  if (/^[A-Za-z0-9_]+$/.test(text)) {
    nodeFor(text)
    return true
  }

  return false
}
