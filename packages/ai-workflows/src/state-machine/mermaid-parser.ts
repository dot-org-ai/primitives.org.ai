/**
 * Mermaid `stateDiagram-v2` parser - FULL Harel statechart coverage (Slice: aip-4fay).
 *
 * Parses mermaid `stateDiagram-v2` source into an xstate `MachineConfig` that
 * {@link import('./runtime.js').runMachine | runMachine} can execute. It is the
 * LLM-authorable / human-readable wire format from ADR-0011: an LLM emits
 * mermaid, this parser validates it by turning it into a runnable config, and
 * generations that fail to parse are retried upstream.
 *
 * This slice widens the earlier flat subset (aip-mdw0) to the full statechart
 * formalism. Both formats express the same Harel statechart; xstate v5 has the
 * runtime feature for each construct, so this is TRANSLATION, not runtime work.
 *
 * ## Supported constructs
 *
 *   - **State declarations** — `state foo`, `state "Label" as foo`, and
 *     implicit states that first appear in a transition.
 *   - **Initial state** — `[*] --> foo` maps to the enclosing scope's
 *     `initial: 'foo'` (top-level or inside a composite/region).
 *   - **Transitions** — `foo --> bar : EVENT` maps to `foo.on.EVENT = 'bar'`.
 *   - **Guarded transitions** — `foo --> bar : EVENT [guardName]` maps to
 *     `foo.on.EVENT = { target: 'bar', guard: 'guardName' }`.
 *   - **Entry / exit actions** — `foo : entry / actName` maps to
 *     `foo.entry = ['actName']`; `foo : exit / actName` maps to
 *     `foo.exit = ['actName']`.
 *   - **Final state** — `foo --> [*]` marks `foo` as a `type: 'final'` state.
 *   - **Composite (nested) states** — `state Foo { ... }` maps to a nested
 *     `states` config; the inner `[*] --> child` sets the composite's `initial`.
 *   - **Parallel regions** — `--` separators inside a composite map to
 *     `type: 'parallel'` with one child region state per separated block.
 *   - **History pseudostates** — `[H]` maps to a `{ type: 'history', history:
 *     'shallow' }` node, `[H*]` to `history: 'deep'`. A transition to `[H]`
 *     targets that node, so resume returns to the prior sub-state.
 *   - **Choice pseudostates** — `state c <<choice>>` plus guarded outgoing
 *     transitions map to an xstate transient state whose `always` array holds
 *     the guarded branches (and an optional unguarded `[else]` default).
 *   - **Notes** — `note ... end note` parsed and ignored (documentation only).
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
 * This keeps the wire format implementation-free — the renderer and any caller
 * round-trip against names alone.
 *
 * ## Choice-pseudostate mapping (the least-obvious one)
 *
 * mermaid has a `<<choice>>` pseudostate with guarded outgoing transitions but
 * no event labels (the diamond is entered, a guard is evaluated, and flow
 * continues immediately). xstate v5 has no dedicated "choice" node type; its
 * faithful equivalent is a **transient state** — a state with an eventless
 * `always` transition array. The actor passes through the choice state in the
 * same macrostep, evaluating each `always` branch's guard in order and taking
 * the first that passes (or the unguarded `[else]` / default branch). So:
 *
 * ```
 * state decide <<choice>>
 * inspect --> decide : DONE
 * decide --> big : [isBig]
 * decide --> small : [else]
 * ```
 * ↔
 * ```ts
 * decide: { always: [ { target: 'big', guard: 'isBig' }, { target: 'small' } ] }
 * ```
 *
 * The `decide` node carries a `_choice: true` marker (a private hint dropped
 * from the emitted config but used by the renderer to re-emit `<<choice>>`).
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

/** A guarded / unguarded transition target. */
interface TransitionObject {
  target: string
  guard?: string
}

/** A single transition value — a bare string target or a `{ target, guard }`. */
type Transition = string | TransitionObject

/**
 * A state node in the config under construction. Mirrors the xstate shapes this
 * parser emits across the full statechart formalism.
 */
interface StateNode {
  on?: Record<string, Transition>
  /** Eventless guarded transitions for a `<<choice>>` (transient) state. */
  always?: TransitionObject[]
  entry?: string[]
  exit?: string[]
  type?: 'final' | 'parallel' | 'history'
  /** History depth — only set when `type === 'history'`. */
  history?: 'shallow' | 'deep'
  /**
   * Default target for a history node — the sub-state entered when the
   * composite is resumed via history but no prior state was recorded. Set by
   * a `[H] --> default` line. Only meaningful when `type === 'history'`.
   */
  target?: string
  /** Child states for a composite / parallel state. */
  states?: Record<string, StateNode>
  /** Initial child of a composite (non-parallel) state. */
  initial?: string
  /** Private marker: this state is a `<<choice>>` pseudostate. */
  _choice?: true
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Thrown when a line cannot be parsed, or when the source uses a genuinely
 * unsupported / ambiguous construct (`<<fork>>` / `<<join>>` — orthogonal to
 * the parallel-region model; an unterminated composite block; an empty
 * choice). The message names the offending construct and (where known) the
 * 1-based source line, so an LLM retry round produces a corrected output.
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
 * Parse mermaid `stateDiagram-v2` source into an xstate `MachineConfig`.
 *
 * The produced config has a top-level `initial` (from `[*] --> foo`) and a
 * `states` map; composite states carry their own nested `states` + `initial`,
 * parallel states carry `type: 'parallel'`, history nodes carry `type:
 * 'history'`, and choice pseudostates become transient `always` states.
 * Guards and entry/exit actions become string names the caller provides at
 * machine-creation time. The result drops straight into `runMachine` /
 * `createStateMachine`.
 *
 * @param source mermaid `stateDiagram-v2` source text.
 * @returns an xstate `MachineConfig` ready for `createMachine` / `runMachine`.
 * @throws {MermaidParseError} when a line cannot be parsed or uses a genuinely
 *   unsupported / ambiguous construct.
 *
 * @example
 * ```ts
 * const config = fromMermaid(`
 *   stateDiagram-v2
 *     [*] --> Review
 *     state Review {
 *       [*] --> awaiting
 *       awaiting --> approved : APPROVE
 *     }
 * `)
 * // config.initial === 'Review'
 * // config.states.Review.initial === 'awaiting'
 * // config.states.Review.states.awaiting.on.APPROVE === 'approved'
 * ```
 */
export function fromMermaid(source: string): ParsedMachineConfig {
  const lines = preprocess(source)
  const { node } = parseScope(lines, 0, /* depth */ 0)

  // The top-level scope is the machine config itself. Its members map straight
  // onto `MachineConfig`. Emit it minimally (drop empty optional members).
  return emitScope(node) as ParsedMachineConfig
}

// =============================================================================
// Scope parsing (recursive — composites and parallel regions nest)
// =============================================================================

/**
 * A parse scope under construction: an ordered `states` map plus the scope's
 * own `initial` (set by `[*] --> child`). The top-level call builds the machine
 * config; each `state Foo { ... }` recurses into a child scope.
 */
interface Scope {
  states: Map<string, StateNode>
  initial?: string
  /**
   * Parallel-region children, when the scope contains `--` separators. When
   * present, the scope is a parallel state: each entry is one region's child
   * states + initial.
   */
  regions?: Scope[]
}

/**
 * Parse the lines of one scope (the top-level diagram, or the body of one
 * `state Foo { ... }` block) starting at `start`, until the matching closing
 * `}` (or end of input at the top level). Returns the assembled {@link StateNode}
 * for the scope and the index just past the consumed lines.
 *
 * `--` separators split the scope into parallel regions; when any are present
 * the scope becomes a `type: 'parallel'` node and each region is wrapped in a
 * synthetic region child state.
 */
function parseScope(
  lines: SourceLine[],
  start: number,
  depth: number
): { node: StateNode; end: number } {
  // Accumulate one or more regions. Most scopes have exactly one (no `--`); a
  // parallel scope has more. We always parse into the current region; a `--`
  // line opens the next.
  const regions: Scope[] = [{ states: new Map() }]
  let i = start

  function current(): Scope {
    return regions[regions.length - 1]!
  }

  function nodeFor(name: string): StateNode {
    const scope = current()
    let n = scope.states.get(name)
    if (!n) {
      n = {}
      scope.states.set(name, n)
    }
    return n
  }

  for (; i < lines.length; i++) {
    const line = lines[i]!
    const { text } = line

    // End of this scope.
    if (text === '}') {
      if (depth === 0) {
        throw new MermaidParseError('Unexpected `}` with no matching composite state', line.number)
      }
      break
    }

    // Parallel region separator — open a new region in this scope.
    if (text === '--') {
      regions.push({ states: new Map() })
      continue
    }

    // Composite (nested) state: `state Foo {` opens a child scope on this line.
    const compositeName = matchCompositeOpen(text)
    if (compositeName !== undefined) {
      const child = parseScope(lines, i + 1, depth + 1)
      // `child.end` points at the closing `}` line; advance past it.
      i = child.end
      const existing = nodeFor(compositeName)
      mergeComposite(existing, child.node, line)
      continue
    }

    if (tryHistoryDeclaration(line, nodeFor, depth)) continue
    if (tryChoiceDeclaration(text, nodeFor)) continue
    if (tryPseudostateRejection(line)) continue // throws for fork/join
    if (tryTransition(line, nodeFor, (init) => (current().initial = init))) continue
    if (tryStateAttribute(line, nodeFor)) continue
    if (tryStateDeclaration(line, nodeFor)) continue

    throw new MermaidParseError(`Could not parse line: "${text}"`, line.number)
  }

  if (depth > 0 && i >= lines.length) {
    throw new MermaidParseError('Unterminated composite state (missing `}`)')
  }

  return { node: assembleScope(regions), end: i }
}

/**
 * Assemble one or more parsed regions into a single {@link StateNode}. A single
 * region becomes a plain composite-or-flat node; multiple regions become a
 * `type: 'parallel'` node, one child region state per separated block.
 *
 * Region naming follows the mermaid `state A { ... } -- state B { ... }` idiom:
 * when a region consists of exactly one composite state and nothing else, that
 * composite IS the region (its name is the region name) — so the canonical form
 * round-trips losslessly. For inline regions (bare transitions between `--`
 * separators) a stable synthetic `region_<initial>` name is derived.
 */
function assembleScope(regions: Scope[]): StateNode {
  if (regions.length === 1) {
    return regionToNode(regions[0]!)
  }

  // Parallel: one child region state per separated block.
  const node: StateNode = { type: 'parallel', states: {} }
  const used = new Set<string>()
  regions.forEach((region, idx) => {
    const sole = soleCompositeRegion(region)
    if (sole) {
      // `state A { ... } -- state B { ... }` — the composite is the region.
      ;(node.states as Record<string, StateNode>)[uniqueName(sole.name, used)] = sole.node
    } else {
      ;(node.states as Record<string, StateNode>)[uniqueName(regionName(region, idx), used)] =
        regionToNode(region)
    }
  })
  return node
}

/**
 * When a region's only content is a single composite (nested) state — the
 * `state A { ... }` form — return that composite's name and node so it becomes
 * the region directly. Returns `undefined` for inline / multi-state regions.
 */
function soleCompositeRegion(region: Scope): { name: string; node: StateNode } | undefined {
  if (region.initial !== undefined || region.states.size !== 1) return undefined
  const [name, node] = region.states.entries().next().value as [string, StateNode]
  // A composite has its own nested states (or is itself parallel).
  if (node.states === undefined && node.type !== 'parallel') return undefined
  return { name, node }
}

/** Derive a synthetic name for an inline parallel region from its initial child. */
function regionName(region: Scope, idx: number): string {
  if (region.initial) return `region_${region.initial}`
  const first = region.states.keys().next().value as string | undefined
  return first ? `region_${first}` : `region${idx + 1}`
}

/** Ensure a region name is unique within the parallel parent (append `_N`). */
function uniqueName(base: string, used: Set<string>): string {
  let name = base
  let n = 2
  while (used.has(name)) name = `${base}_${n++}`
  used.add(name)
  return name
}

/** Turn a single region's `states` + `initial` into a {@link StateNode}. */
function regionToNode(region: Scope): StateNode {
  const node: StateNode = {}
  if (region.initial !== undefined) node.initial = region.initial
  if (region.states.size > 0) {
    node.states = {}
    for (const [name, child] of region.states) {
      ;(node.states as Record<string, StateNode>)[name] = child
    }
  }
  return node
}

/**
 * Merge a parsed composite child scope's node into the existing node for that
 * composite name. The composite name may have appeared earlier in a transition
 * (e.g. `[*] --> Review` before `state Review { ... }`), so we merge rather
 * than overwrite — preserving any `on` transitions declared on the composite.
 */
function mergeComposite(existing: StateNode, child: StateNode, line: SourceLine): void {
  if (existing.states !== undefined || existing.type === 'parallel') {
    throw new MermaidParseError(
      `Composite state declared more than once in the same scope`,
      line.number
    )
  }
  if (child.type === 'parallel') existing.type = 'parallel'
  if (child.initial !== undefined) existing.initial = child.initial
  if (child.states) existing.states = child.states
}

// =============================================================================
// Emit — turn the parse tree into a minimal, stable MachineConfig
// =============================================================================

/**
 * Recursively emit a {@link StateNode} into the minimal xstate shape: strip
 * empty optional members and the private `_choice` hint so the emitted config
 * is stable for round-trip comparison.
 */
function emitScope(node: StateNode): StateNode {
  const out: StateNode = {}

  if (node.type === 'parallel') out.type = 'parallel'
  if (node.type === 'final') out.type = 'final'
  if (node.type === 'history') {
    out.type = 'history'
    out.history = node.history ?? 'shallow'
    if (node.target !== undefined) out.target = node.target
  }

  if (node.initial !== undefined) out.initial = node.initial

  if (node.entry && node.entry.length > 0) out.entry = node.entry
  if (node.exit && node.exit.length > 0) out.exit = node.exit

  if (node.always && node.always.length > 0) out.always = node.always
  if (node.on && Object.keys(node.on).length > 0) out.on = node.on

  if (node.states && Object.keys(node.states).length > 0) {
    out.states = {}
    for (const [name, child] of Object.entries(node.states)) {
      ;(out.states as Record<string, StateNode>)[name] = emitScope(child)
    }
  }

  return out
}

// =============================================================================
// Preprocessing
// =============================================================================

/**
 * Strip the diagram header, comments, blank lines, and `note` blocks; return
 * the remaining significant lines with their original 1-based numbers. Also
 * splits a `state Foo {` whose body opens on the same physical line, and a
 * trailing `}` onto its own logical line, so the scope parser sees `{` / `}` as
 * standalone tokens.
 *
 * - The leading `stateDiagram-v2` (and the legacy `stateDiagram`) directive is
 *   dropped; its presence is not required but is tolerated.
 * - `%%` line comments and trailing `%% ...` comments are removed.
 * - `note ... end note` blocks and single-line `note ... : ...` are ignored
 *   (documentation only).
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
        inNoteBlock = true
      }
      continue
    }

    // Normalise `state Foo {` (and a trailing `}` after content) into standalone
    // brace tokens so the scope parser can treat `{` / `}` as scope delimiters.
    for (const piece of splitBraces(text)) {
      out.push({ text: piece, number })
    }
  }

  if (inNoteBlock) {
    throw new MermaidParseError('Unterminated `note` block (missing `end note`)')
  }

  return out
}

/**
 * Split a physical line containing braces into logical tokens so a composite
 * opener and its closer stand alone. `state Foo {` → `['state Foo {']` is kept
 * whole (the opener is detected by {@link matchCompositeOpen}); a bare trailing
 * `}` (possibly with leading content like `approved }`) is split off so the
 * scope parser sees `}` on its own. Content and a `}` on one line is rare in
 * authored mermaid but tolerated.
 */
function splitBraces(text: string): string[] {
  // A line that is exactly `}` (or `{`) passes through unchanged.
  if (text === '}' || text === '{') return [text]

  // `... }` — peel a trailing close brace onto its own token.
  if (text.endsWith('}') && !text.endsWith('{')) {
    const head = text.slice(0, -1).trim()
    return head === '' ? ['}'] : [head, '}']
  }

  return [text]
}

/** Remove a `%%` comment from a line (mermaid uses `%%` for comments). */
function stripComment(line: string): string {
  const idx = line.indexOf('%%')
  return idx === -1 ? line : line.slice(0, idx)
}

/**
 * Detect a composite-state opener `state Foo {` (or `state "Label" as foo {`)
 * and return the composite's id, or `undefined` when the line is not an opener.
 * The opening brace must be the last non-space character on the line.
 */
function matchCompositeOpen(text: string): string | undefined {
  if (!/\{\s*$/.test(text)) return undefined

  const body = text.replace(/\{\s*$/, '').trim()

  // `state "Label" as id`
  const aliased = body.match(/^state\s+"[^"]*"\s+as\s+([A-Za-z0-9_]+)$/)
  if (aliased && aliased[1]) return aliased[1]

  // `state id`
  const named = body.match(/^state\s+([A-Za-z0-9_]+)$/)
  if (named && named[1]) return named[1]

  throw new MermaidParseError(`Malformed composite state opener: "${text}"`)
}

// =============================================================================
// Pseudostate handling (choice supported; fork/join rejected loudly)
// =============================================================================

/**
 * Parse a choice-pseudostate declaration `state c <<choice>>`. Marks the state
 * as a transient (`always`) node; its guarded outgoing transitions are gathered
 * later by {@link tryTransition} (which routes a choice state's outgoing
 * transitions into `always` rather than `on`). Returns true when consumed.
 */
function tryChoiceDeclaration(text: string, nodeFor: (name: string) => StateNode): boolean {
  const m = text.match(/^state\s+([A-Za-z0-9_]+)\s+<<\s*choice\s*>>\s*$/i)
  if (!m || !m[1]) return false
  const node = nodeFor(m[1])
  node._choice = true
  return true
}

/**
 * Parse a history-node declaration line — either a bare history token or a
 * history token as a transition SOURCE:
 *
 *   - `[H]`               → declare this scope's shallow-history child (named
 *     `hist`). The child is the re-entry point an outer `Composite[H]`
 *     transition targets.
 *   - `[H*]`              → declare the deep-history child (`deepHist`).
 *   - `[H] --> default`   → declare the shallow-history child AND record
 *     `default` as its default target (entered on resume when no prior
 *     sub-state was recorded).
 *   - `[H*] --> default`  → likewise for the deep-history child.
 *
 * A transition whose source is `[H]` / `[H*]` never carries an event label
 * (history nodes are transient). The history child can also be materialised by
 * an in-scope transition that *targets* it (`foo --> [H]`, handled in
 * {@link tryTransition}); this helper covers the bare-declaration and
 * set-the-default forms so all of them round-trip.
 *
 * Returns true when the line was a history declaration; false otherwise (the
 * caller falls through to the next parser).
 */
function tryHistoryDeclaration(
  line: SourceLine,
  nodeFor: (name: string) => StateNode,
  depth: number
): boolean {
  const arrowIdx = line.text.indexOf('-->')

  // Bare `[H]` / `[H*]` declaration (no arrow).
  if (arrowIdx === -1) {
    if (!isHistoryToken(line.text)) return false
    if (depth === 0) {
      throw new MermaidParseError(
        'A history pseudostate (`[H]` / `[H*]`) is only meaningful inside a ' +
          'composite state; it has no top-level meaning',
        line.number
      )
    }
    const meta = historyTarget(line.text)!
    const node = nodeFor(meta.name)
    node.type = 'history'
    node.history = meta.history
    return true
  }

  const source = line.text.slice(0, arrowIdx).trim()
  if (!isHistoryToken(source)) return false

  if (depth === 0) {
    throw new MermaidParseError(
      'A history pseudostate (`[H]` / `[H*]`) is only meaningful inside a ' +
        'composite state; it has no top-level meaning',
      line.number
    )
  }

  const rest = line.text.slice(arrowIdx + 3).trim()
  const colonIdx = rest.indexOf(':')
  const target = (colonIdx === -1 ? rest : rest.slice(0, colonIdx)).trim()
  const label = colonIdx === -1 ? undefined : rest.slice(colonIdx + 1).trim()

  if (label) {
    throw new MermaidParseError(
      'A history default transition `[H] --> default` does not take an event label',
      line.number
    )
  }
  if (target === '' || target === PSEUDO_INITIAL_FINAL || isHistoryToken(target)) {
    throw new MermaidParseError(
      'A history default transition `[H] --> default` must target a named ' +
        'sub-state of the composite',
      line.number
    )
  }

  const meta = historyTarget(source)!
  const node = nodeFor(meta.name)
  node.type = 'history'
  node.history = meta.history
  node.target = target
  nodeFor(target) // ensure the default target state exists
  return true
}

/**
 * Reject `<<fork>>` / `<<join>>` pseudostates loudly — they model a different
 * concurrency entry/exit pattern than the `--` parallel-region model this
 * parser maps, and supporting them ambiguously would be worse than rejecting.
 * Returns true only to signal "I handled this line" — but it always throws when
 * it matches, so the return is effectively unreachable on a fork/join line.
 */
function tryPseudostateRejection(line: SourceLine): boolean {
  const m = line.text.match(/<<\s*(fork|join)\s*>>/i)
  if (!m) return false
  const kind = (m[1] ?? '').toLowerCase()
  throw new MermaidParseError(
    `\`<<${kind}>>\` pseudostates are not supported; express concurrency with ` +
      'parallel regions (`--` inside a composite state) instead',
    line.number
  )
}

// =============================================================================
// Line parsers - each returns true when it consumed the line
// =============================================================================

/**
 * Parse a transition line: `A --> B`, optionally `: EVENT` and `[guard]`, and
 * the `[*]` / `[H]` / `[H*]` pseudostates.
 *
 *   - `[*] --> foo`          → sets this scope's `initial = 'foo'`
 *   - `foo --> [*]`          → marks `foo` as `type: 'final'`
 *   - `foo --> [H]`          → targets `foo`'s scope's shallow-history node
 *   - `foo --> [H*]`         → targets the deep-history node
 *   - `foo --> bar : EV`     → `foo.on.EV = 'bar'`
 *   - `foo --> bar : EV [g]` → `foo.on.EV = { target: 'bar', guard: 'g' }`
 *   - choice outgoing: `decide --> big : [g]` / `decide --> small : [else]`
 *     route into `decide.always` (eventless guarded branches)
 */
function tryTransition(
  line: SourceLine,
  nodeFor: (name: string) => StateNode,
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
    if (isHistoryToken(target)) {
      throw new MermaidParseError(
        'The initial transition `[*] --> ...` cannot target a history pseudostate',
        line.number
      )
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
    if (label) {
      throw new MermaidParseError(
        'A final transition `foo --> [*]` does not take an event label; mark the ' +
          'target state final instead',
        line.number
      )
    }
    return true
  }

  // History target: `foo --> [H]` / `foo --> [H*]`. The history node lives in
  // the SAME scope as `foo` (a transition to history re-enters the composite at
  // its remembered sub-state). We materialise a history child node and target
  // it; the source's transition keys on the event label.
  const histTarget = historyTarget(target)
  if (histTarget) {
    return wireTransition(line, nodeFor, source, histTarget.name, label, histTarget)
  }

  // Cross-boundary history target: `Paused --> Composite[H]` / `Composite[H*]`.
  // An OUTER state re-enters a composite at its remembered sub-state — the form
  // that genuinely exercises history (the composite is exited and re-entered).
  // The target resolves to a dotted xstate id (`Composite.hist`) that names the
  // composite's history child; `wireTransition` emits it as a plain string
  // target (xstate resolves the dotted id at run time). The composite itself
  // declares the history child (via a `[H]` inside its block).
  const crossHist = crossBoundaryHistoryTarget(target)
  if (crossHist) {
    return wireTransition(line, nodeFor, source, crossHist, label, undefined)
  }

  // Regular transition between two named states.
  nodeFor(target) // ensure the target exists as a state
  return wireTransition(line, nodeFor, source, target, label, undefined)
}

/**
 * Wire one parsed transition onto the source node. Routes a `<<choice>>`
 * source's outgoing transitions into its `always` array (eventless guarded
 * branches); routes everything else into `on[event]`. When `history` is given,
 * the target name is a synthetic history node that is also materialised here.
 */
function wireTransition(
  line: SourceLine,
  nodeFor: (name: string) => StateNode,
  source: string,
  target: string,
  label: string | undefined,
  history: { name: string; history: 'shallow' | 'deep' } | undefined
): boolean {
  const node = nodeFor(source)

  // Materialise a history node target in this scope when needed.
  if (history) {
    const hist = nodeFor(history.name)
    hist.type = 'history'
    hist.history = history.history
  }

  // Choice pseudostate: outgoing transitions are eventless guarded branches.
  if (node._choice) {
    const { guard, isElse } = parseChoiceLabel(label, line)
    node.always ??= []
    if (isElse || guard === undefined) {
      // The default branch — must be last and unguarded.
      node.always.push({ target })
    } else {
      node.always.push({ target, guard })
    }
    return true
  }

  // A normal transition needs an event label to key `on` on.
  if (!label) {
    throw new MermaidParseError(
      `Transition "${source} --> ${target}" needs an event label (\`: EVENT\`); ` +
        'unlabelled (always) transitions are only valid out of a `<<choice>>` state',
      line.number
    )
  }

  const { event, guard } = parseLabel(label, line)
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

/** Is `token` a history pseudostate token (`[H]` or `[H*]`)? */
function isHistoryToken(token: string): boolean {
  return token === '[H]' || token === '[H*]'
}

/**
 * Map a history target token to a synthetic history node name + depth, or
 * `undefined` when the token is not history. `[H]` → shallow, `[H*]` → deep.
 * The synthetic node name is stable per depth so repeated `--> [H]` in one
 * scope reuse the same history node.
 */
function historyTarget(target: string): { name: string; history: 'shallow' | 'deep' } | undefined {
  if (target === '[H]') return { name: 'hist', history: 'shallow' }
  if (target === '[H*]') return { name: 'deepHist', history: 'deep' }
  return undefined
}

/**
 * Map a cross-boundary history target `Composite[H]` / `Composite[H*]` to the
 * dotted xstate id of the composite's history child (`Composite.hist` /
 * `Composite.deepHist`), or `undefined` when the target is not of that form.
 *
 * This is the OUTER-state re-entry form: a state outside `Composite` transitions
 * into `Composite`'s remembered sub-state. xstate resolves the dotted id at run
 * time, so we emit it as a plain string target. The composite must declare the
 * corresponding history child (a bare `[H]` / `[H*]` line inside its block).
 */
function crossBoundaryHistoryTarget(target: string): string | undefined {
  const m = target.match(/^([A-Za-z0-9_]+)\s*(\[H\*\]|\[H\])$/)
  if (!m || !m[1] || !m[2]) return undefined
  const child = m[2] === '[H*]' ? 'deepHist' : 'hist'
  return `${m[1]}.${child}`
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
 * Parse a `<<choice>>` outgoing transition label into a guard name (or the
 * `[else]` default). Choice branches are eventless: the label is either a
 * guard `[g]`, the literal `[else]` default, or absent (also a default).
 */
function parseChoiceLabel(
  label: string | undefined,
  line: SourceLine
): { guard?: string; isElse: boolean } {
  if (label === undefined || label === '') return { isElse: true }

  const guardMatch = label.match(/^\[([^\]]*)\]\s*$/)
  if (!guardMatch) {
    throw new MermaidParseError(
      `Outgoing transition from a \`<<choice>>\` state must be a guard \`[guard]\` ` +
        `or \`[else]\`, not an event label ("${label}")`,
      line.number
    )
  }
  const inner = (guardMatch[1] ?? '').trim()
  if (inner === '') {
    throw new MermaidParseError(`Empty guard "[]" on a choice transition`, line.number)
  }
  if (inner.toLowerCase() === 'else') return { isElse: true }
  return { guard: inner, isElse: false }
}

/**
 * Parse a state-attribute line: `foo : entry / actName` or
 * `foo : exit / actName`. Returns false (not consumed) when the line is not a
 * `state : ...` attribute — the caller falls through to the next parser.
 *
 * Only `entry / X` and `exit / X` are recognised. Any other `state : text`
 * (a description) is treated as a documentation label and ignored, with the
 * state ensured to exist.
 */
function tryStateAttribute(line: SourceLine, nodeFor: (name: string) => StateNode): boolean {
  const colonIdx = line.text.indexOf(':')
  if (colonIdx === -1) return false
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
function tryStateDeclaration(line: SourceLine, nodeFor: (name: string) => StateNode): boolean {
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
