/**
 * REPL sessions for ai-evaluate (`ai-evaluate/repl`)
 *
 * A session is a thin client over `evaluate()`: every `eval(code)` is one
 * evaluation against a fixed `sandboxId`, with a `ReplState` facet (see
 * `./facets.ts`) holding the session's variables in the sandbox's own
 * SQLite-backed Durable Object storage. Each evaluation hydrates the
 * variables it knows about from the facet (`load`), runs the code, and hands
 * the declared variables back (`save`) - structured-cloneable values only.
 * Values never leave the sandbox to be re-serialized into source: the client
 * tracks names, the facet holds values.
 *
 * What structured clone cannot carry - functions, class instances (their
 * prototype would be lost), symbols, `undefined` - is not stored. The code
 * that declared such a name is instead replayed, as the user wrote it, at
 * the start of every later evaluation, so `const sum = (a, b) => a + b`
 * followed by `sum(1, 2)` works; the replayed code's side effects repeat
 * each time, and its other declarations are recreated rather than restored.
 * A later evaluation that re-declares a replayed name retires the replay.
 *
 * Local sessions run on the process-wide host of `ai-evaluate/node`, whose
 * Miniflare host worker has the `SandboxHost` Durable Object; a session with
 * an `env` runs `evaluate()` from 'ai-evaluate' directly and needs a host
 * worker that exports `SandboxHost` (see `./worker.ts`).
 */

import type { EvaluateOptions, EvaluateResult, SandboxEnv, SDKConfig } from './types.js'

/** The facet class that holds a session's variables */
export const REPL_FACET_CLASS = 'ReplState'

/** The env key the session's evaluations reach the facet under */
export const REPL_FACET_BINDING = 'REPL'

/**
 * The `ReplState` facet: the session's variables as keys of the facet's
 * storage (SQLite-backed, structured-cloned values). A plain class - the
 * facet worker wraps it in a `DurableObject` subclass (see
 * `generateFacetWorkerCode`). `clear` deletes the keys it lists rather than
 * calling `deleteAll()`, which the local workerd answers with an internal
 * error from inside a facet.
 */
export const REPL_STATE_MODULE = `
export class ${REPL_FACET_CLASS} {
  constructor(ctx) { this.storage = ctx.storage }
  async load() { return Object.fromEntries(await this.storage.list()) }
  async save(values, dropped) {
    await this.remove(dropped)
    if (Object.keys(values).length > 0) await this.storage.put(values)
    return this.load()
  }
  async remove(keys) {
    // storage.delete takes at most 128 keys per call
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128))
  }
  async clear() { await this.remove([...(await this.storage.list()).keys()]) }
}
`

/**
 * REPL session configuration
 */
export interface ReplSessionConfig {
  /** Use the local Miniflare host of `ai-evaluate/node` (the default without an `env`) */
  local?: boolean
  /** Authentication token for remote execution */
  auth?: string
  /** SDK configuration for platform primitives */
  sdk?: SDKConfig | boolean
  /**
   * Module code every evaluation runs with (imports, helpers): its exports
   * are in scope of each `eval`, and it is part of the facet worker, so it
   * runs once per session in the facet too.
   */
  prelude?: string
  /** Timeout for each evaluation in milliseconds */
  timeout?: number
  /** Allow network access */
  allowNetwork?: boolean
  /**
   * Identity of the sandbox whose facet holds the session's variables. Two
   * sessions with the same id share state, and a session that resumes one
   * finds its variables in scope again; a session created without one gets
   * a random id and drops its state on `close()`.
   */
  sandboxId?: string
}

/**
 * Result from a REPL evaluation: an `EvaluateResult` whose `value` is the
 * value of the code's last expression (or of its trailing `return`).
 */
export type ReplEvalResult = EvaluateResult

/**
 * REPL session with persistent context
 */
export interface ReplSession {
  /** The sandbox the session's variables live in */
  readonly sandboxId: string

  /** Evaluate code in the session context */
  eval(code: string): Promise<ReplEvalResult>

  /**
   * The session's variables as last reported by the sandbox: a snapshot of
   * the facet's stored values after the most recent `eval`, as they crossed
   * the result boundary (JSON on the local host).
   *
   * @deprecated The context lives in the sandbox's facet, not in the client;
   * evaluate an expression to read a variable. Kept for 2.x callers; warns
   * once per process.
   */
  getContext(): Record<string, unknown>

  /** Set a variable for the next evaluation (a JSON-serializable value) */
  setContext(key: string, value: unknown): void

  /** Drop every variable (applied at the next evaluation) */
  clearContext(): void

  /** Warm the session up: attach the facet with the prelude (called by the first `eval`) */
  runPrelude(): Promise<void>

  /**
   * Close the session: forget the client's state, and - for a session with
   * a generated `sandboxId` - delete the facet's storage.
   *
   * Local sessions share the process-wide host from 'ai-evaluate/node', which
   * is not released here - it is unref'd while idle (so the process still exits
   * on its own) and can be shut down early with `dispose()` from that module.
   */
  close(): Promise<void>
}

/** Whether `getContext()` has printed its deprecation notice in this process */
let getContextWarned = false

/** A top-level statement of a code chunk, by position */
interface Statement {
  text: string
  start: number
  end: number
}

/** Characters after which a line break does not end a statement */
const CONTINUES_AFTER = new Set([...'=,.+-*/%&|^<>?:([{!~'])
/** Characters before which a line break does not end a statement */
const CONTINUES_BEFORE = new Set([...'.?:+-*/%&|^<>=,)]}'])

/**
 * Split code into its top-level statements: at `;` and at line breaks outside
 * brackets, strings, template literals and comments, unless the break sits
 * inside an expression (after or before an operator, a comma, a dot).
 * Heuristic, not a parser - regular expression literals are not tracked.
 */
export function splitStatements(code: string): Statement[] {
  const statements: Statement[] = []
  let start = 0
  let depth = 0
  let i = 0
  const push = (end: number): void => {
    const text = code.slice(start, end)
    if (text.trim()) statements.push({ text, start, end })
    start = end + 1
  }
  const skipString = (quote: string): void => {
    for (i++; i < code.length && code[i] !== quote; i++) if (code[i] === '\\') i++
  }
  const skipTemplate = (): void => {
    for (i++; i < code.length && code[i] !== '`'; i++) {
      if (code[i] === '\\') i++
      else if (code[i] === '$' && code[i + 1] === '{') {
        let inner = 1
        for (i += 2; i < code.length && inner > 0; i++) {
          const c = code[i]
          if (c === '{') inner++
          else if (c === '}') inner--
          else if (c === '`') skipTemplate()
          else if (c === "'" || c === '"') skipString(c)
        }
        i--
      }
    }
  }
  for (; i < code.length; i++) {
    const c = code[i]!
    if (c === "'" || c === '"') skipString(c)
    else if (c === '`') skipTemplate()
    else if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++
      i--
    } else if (c === '/' && code[i + 1] === '*') {
      const close = code.indexOf('*/', i + 2)
      i = close === -1 ? code.length : close + 1
    } else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0 && c === ';') push(i)
    else if (depth === 0 && c === '\n') {
      const before = code.slice(start, i).trimEnd()
      const after = code.slice(i + 1).trimStart()
      const last = before[before.length - 1]
      const next = after[0]
      const continues =
        (last !== undefined &&
          CONTINUES_AFTER.has(last) &&
          !before.endsWith('++') &&
          !before.endsWith('--')) ||
        (next !== undefined &&
          CONTINUES_BEFORE.has(next) &&
          !after.startsWith('++') &&
          !after.startsWith('--'))
      if (!continues) push(i)
    }
  }
  push(code.length)
  return statements
}

/** Keywords that begin a statement which is not an expression */
const STATEMENT_KEYWORD =
  /^\s*(?:const|let|var|function|async\s+function|class|if|for|while|do|switch|try|throw|import|export|break|continue|debugger|with)\b/

/**
 * Rewrite the code's last top-level statement so that its value lands in
 * `__value__`: an expression statement becomes `__value__ = (expr)`, a
 * trailing `return expr` becomes the same, and anything else (a declaration,
 * control flow) is left alone - the value is then `undefined`.
 */
export function captureLastExpression(code: string): string {
  const statements = splitStatements(code)
  const last = statements[statements.length - 1]
  if (!last) return code
  const text = last.text.trim()
  if (text.startsWith('{')) return code
  let expression: string | null = null
  if (/^return\b/.test(text)) expression = text.slice('return'.length).trim() || 'undefined'
  else if (!STATEMENT_KEYWORD.test(text)) expression = text
  if (expression === null) return code
  const indent = last.text.slice(0, last.text.length - last.text.trimStart().length)
  return `${code.slice(0, last.start)}${indent}__value__ = (${expression});${code.slice(last.end)}`
}

const IDENTIFIER = /[A-Za-z_$][\w$]*/g

/** The identifiers a binding pattern declares: `a`, `{ a, b: c = 1, ...rest }`, `[x, , y]` */
function patternNames(pattern: string): string[] {
  const withoutDefaults = pattern.replace(/=\s*[^,}\]]+/g, '')
  const withoutKeys = withoutDefaults.replace(/[A-Za-z_$][\w$]*\s*:/g, '')
  return [...withoutKeys.matchAll(IDENTIFIER)].map((match) => match[0])
}

/**
 * The binding pattern of a `const` / `let` / `var` statement: what sits
 * between the keyword and the first `=` outside brackets (a default value
 * inside a destructuring pattern has its own `=`), or the whole rest for a
 * bare `let x`.
 */
function declaratorPattern(statement: string): string | null {
  const keyword = statement.match(/^(?:const|let|var)\s+/)
  if (!keyword) return null
  let depth = 0
  for (let i = keyword[0].length; i < statement.length; i++) {
    const c = statement[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === '=' && depth === 0) return statement.slice(keyword[0].length, i)
  }
  return statement.slice(keyword[0].length)
}

/**
 * The names a code chunk declares at its top level: `const` / `let` / `var`
 * declarators (the first, destructuring included), function and class
 * declarations. Nothing inside a block or a function body counts.
 */
export function declaredNames(code: string): string[] {
  const names = new Set<string>()
  for (const { text } of splitStatements(code)) {
    const statement = text.trim().replace(/^export\s+/, '')
    const pattern = declaratorPattern(statement)
    if (pattern !== null) {
      for (const name of patternNames(pattern)) names.add(name)
      continue
    }
    const callable = statement.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/)
    if (callable?.[1]) {
      names.add(callable[1])
      continue
    }
    const klass = statement.match(/^class\s+([A-Za-z_$][\w$]*)/)
    if (klass?.[1]) names.add(klass[1])
  }
  return [...names]
}

/** What one REPL evaluation returns to the client, wrapped in the script's result */
interface ReplPayload {
  __repl__: true
  value: unknown
  saved: string[]
  dropped: string[]
  context: Record<string, unknown>
}

function isReplPayload(value: unknown): value is ReplPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __repl__?: unknown }).__repl__ === true &&
    Array.isArray((value as { saved?: unknown }).saved) &&
    Array.isArray((value as { dropped?: unknown }).dropped)
  )
}

/** A previous chunk replayed before each evaluation, with the names it declares */
interface ReplayChunk {
  code: string
  names: string[]
}

/**
 * The script of one evaluation: clear (if pending), hydrate the known
 * variables from the facet, replay the chunks that declare non-storable
 * values, apply pending `setContext` values, run the code with its last
 * expression captured, then store every variable that structured clone can
 * carry and report the rest as dropped.
 */
export function buildReplScript(input: {
  code: string
  hydrate: string[]
  replay: string[]
  assignments: [string, unknown][]
  names: string[]
  clear: boolean
}): string {
  const binding = `env.${REPL_FACET_BINDING}`
  const hydrate =
    input.hydrate.length > 0 ? `let { ${input.hydrate.join(', ')} } = __context__;` : ''
  const assignments = input.assignments
    .map(([key, value]) => `let ${key} = ${JSON.stringify(value) ?? 'undefined'};`)
    .join('\n')
  const names = input.names.map((name) => `${name}: ${name}`).join(', ')
  return `
${input.clear ? `await ${binding}.clear();` : ''}
const __context__ = await ${binding}.load();
${hydrate}
${input.replay.join('\n')}
${assignments}
let __value__;
${captureLastExpression(input.code)}
const __persistable__ = (v) => {
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return false;
  try {
    const c = structuredClone(v);
    return typeof v !== 'object' || v === null || Object.getPrototypeOf(c) === Object.getPrototypeOf(v);
  } catch {
    return false;
  }
};
const __saved__ = {};
const __dropped__ = [];
for (const [__k__, __v__] of Object.entries({ ${names} })) {
  if (__persistable__(__v__)) __saved__[__k__] = __v__; else __dropped__.push(__k__);
}
const __snapshot__ = await ${binding}.save(__saved__, __dropped__);
return { __repl__: true, value: __value__, saved: Object.keys(__saved__), dropped: __dropped__, context: __snapshot__ };
`
}

/**
 * Create a REPL session for interactive code evaluation
 *
 * @example
 * ```ts
 * import { createReplSession } from 'ai-evaluate/repl'
 *
 * const session = await createReplSession({ local: true })
 *
 * await session.eval('const sum = (a, b) => a + b')
 * const result = await session.eval('sum(1, 2)')
 * console.log(result.value) // 3
 *
 * await session.close()
 * ```
 */
export async function createReplSession(
  config?: ReplSessionConfig,
  env?: SandboxEnv
): Promise<ReplSession> {
  const ephemeral = config?.sandboxId === undefined
  const sandboxId = config?.sandboxId ?? `repl-${crypto.randomUUID()}`
  /** Names the facet may hold (declared by some chunk, or set through `setContext`) */
  let known = new Set<string>()
  /** Chunks replayed before each evaluation: those that declared non-storable values */
  let replay: ReplayChunk[] = []
  let pending = new Map<string, unknown>()
  let pendingClear = false
  let snapshot: Record<string, unknown> = {}
  let preludeRun = false
  let evaluated = false
  /** Whether a resumed session (caller-supplied `sandboxId`) has read the facet's stored names */
  let discovered = ephemeral

  // Use the local host, or `evaluate()` from 'ai-evaluate' with the given env
  const evaluate: (options: EvaluateOptions) => Promise<EvaluateResult> =
    env && !config?.local
      ? await import('./evaluate.js').then(
          ({ evaluate }) =>
            (options) =>
              evaluate(options, env)
        )
      : await import('./node.js').then(
          ({ evaluate }) =>
            (options) =>
              evaluate(options)
        )

  const base = (): EvaluateOptions => ({
    module: `${config?.prelude ?? ''}\n${REPL_STATE_MODULE}`,
    facet: { class: REPL_FACET_CLASS, binding: REPL_FACET_BINDING },
    sandboxId,
    ...(config?.sdk !== undefined && { sdk: config.sdk }),
    ...(config?.timeout !== undefined && { timeout: config.timeout }),
    ...(config?.allowNetwork === false && { fetch: null }),
  })

  async function runPrelude(): Promise<void> {
    if (preludeRun) return
    preludeRun = true
    if (!config?.prelude) return
    // Attaches the facet with the prelude; a failing prelude is reported by
    // every evaluation as a module error, not here.
    await evaluate({ ...base(), script: 'return true' })
  }

  const reset = (): void => {
    known = new Set()
    replay = []
    pending = new Map()
    snapshot = {}
  }

  return {
    sandboxId,

    async eval(code: string): Promise<ReplEvalResult> {
      await runPrelude()
      if (!discovered) {
        // Resuming a sandbox: the facet knows its variables, the client does not yet
        discovered = true
        const stored = await evaluate({
          ...base(),
          script: `return Object.keys(await env.${REPL_FACET_BINDING}.load())`,
        })
        if (stored.success && Array.isArray(stored.value)) {
          for (const name of stored.value) if (typeof name === 'string') known.add(name)
        }
      }
      const declared = new Set(declaredNames(code))
      // A chunk this code re-declares is retired: the new code takes over
      replay = replay.filter((chunk) => !chunk.names.some((name) => declared.has(name)))
      const replayDeclared = new Set(replay.flatMap((chunk) => chunk.names))
      const assignments = [...pending].filter(
        ([key]) => !declared.has(key) && !replayDeclared.has(key)
      )
      const assigned = new Set(assignments.map(([key]) => key))
      const hydrate = [...known].filter(
        (name) => !declared.has(name) && !replayDeclared.has(name) && !assigned.has(name)
      )
      const names = [...new Set([...known, ...declared, ...replayDeclared, ...assigned])]
      const script = buildReplScript({
        code,
        hydrate,
        replay: replay.map((chunk) => chunk.code),
        assignments,
        names,
        clear: pendingClear,
      })
      const clearing = pendingClear
      pendingClear = false
      pending = new Map()
      evaluated = true

      const result = await evaluate({ ...base(), script })
      if (!result.success) {
        // The clear ran first, before the code could fail
        if (clearing) snapshot = {}
        return result
      }
      const payload = result.value
      if (!isReplPayload(payload)) return result

      for (const name of [...payload.saved, ...payload.dropped]) known.add(name)
      const dropped = new Set(payload.dropped)
      if ([...declared].some((name) => dropped.has(name)) && !replay.some((c) => c.code === code)) {
        replay.push({ code, names: [...declared] })
      }
      snapshot = payload.context
      return { ...result, value: payload.value }
    },

    getContext(): Record<string, unknown> {
      if (!getContextWarned) {
        getContextWarned = true
        console.warn(
          '[ai-evaluate] ReplSession.getContext() is deprecated: the context lives in the ' +
            "sandbox's facet, not in the client; evaluate an expression to read a variable"
        )
      }
      return { ...snapshot }
    },

    setContext(key: string, value: unknown): void {
      pending.set(key, value)
    },

    clearContext(): void {
      reset()
      pendingClear = true
    },

    runPrelude,

    async close(): Promise<void> {
      const drop = ephemeral && evaluated
      reset()
      pendingClear = false
      preludeRun = false
      evaluated = false
      discovered = ephemeral
      if (drop) await evaluate({ ...base(), script: `await env.${REPL_FACET_BINDING}.clear()` })
    },
  }
}

/**
 * Quick evaluation helper for one-off evaluations
 *
 * @example
 * ```ts
 * import { quickEval } from 'ai-evaluate/repl'
 *
 * const result = await quickEval('1 + 2 * 3')
 * console.log(result.value) // 7
 * ```
 */
export async function quickEval(
  code: string,
  config?: ReplSessionConfig,
  env?: SandboxEnv
): Promise<ReplEvalResult> {
  const session = await createReplSession(config, env)
  try {
    return await session.eval(code)
  } finally {
    await session.close()
  }
}
